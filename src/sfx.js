// Sound effects: one lazily made <audio> element per sound in SFX (config.js), restarted on each
// play, plus a delegated click / hover tick for every UI <button>. Playback is best effort: a
// blocked autoplay or missing file just stays silent. Volumes follow the sfx_volume setting.
// The error buzzer, the level-up jingle and the tutorial party's poppers, blower and balloon pops
// are synthesised with Web Audio instead (no files), see ERROR_SFX, LEVEL_SFX and PARTY_SFX.
import { ERROR_SFX, LEVEL_SFX, PARTY_SFX, SFX } from './config.js'
import { settings } from './bloxity.js'

const players = {}
const SLEEP_AFTER = 3 // s of silence before the synth context is suspended (battery)

let ctx = null // made at the first gesture (installClickSound), so iOS lets it play later on
let sleepTimer = 0
let hall = null // shared short reverb, made with the first jingle
let noiseBuf = null // 1 s of white noise, looped by the crack / swoosh / crackle sources
let lastError = -Infinity // s, ctx time of the last buzzer
let lastLevel = -Infinity // s, ctx time of the last level-up jingle
let hushUntil = 0 // ms (performance.now) the treadmill step tick stays quiet until

function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    ctx = new Ctx()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// Suspend the context once the last scheduled sound (ctx time `until`) has died away.
function rest(until) {
  clearTimeout(sleepTimer)
  sleepTimer = setTimeout(() => ctx?.suspend().catch(() => {}), (until - ctx.currentTime + SLEEP_AFTER) * 1000)
}

// A one-shot's output: master gain (scaled by sfx_volume), optional stereo pan and a send into the
// hall. Returns null when muted. `done(out, until)` unhooks it after ctx time `until`.
function bus(level, wet = 0, pan = 0) {
  const vol = level * (settings.sfx_volume ?? 1)
  if (vol <= 0) return null
  const out = ctx.createGain()
  out.gain.value = vol
  let head = out
  if (pan && ctx.createStereoPanner) {
    head = ctx.createStereoPanner()
    head.pan.value = pan
    out.connect(head)
  }
  head.connect(ctx.destination)
  if (wet > 0) {
    const send = ctx.createGain()
    send.gain.value = wet
    head.connect(send).connect(reverb())
  }
  return out
}
function done(out, until) {
  setTimeout(() => out.disconnect(), (until - ctx.currentTime) * 1000 + 200)
  rest(until)
}

function reverb() {
  if (hall) return hall
  const len = Math.round(ctx.sampleRate * LEVEL_SFX.reverbTime)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  }
  hall = ctx.createConvolver()
  hall.buffer = buf
  hall.connect(ctx.destination)
  return hall
}

// White noise from ctx time t for len s into dest.
function noise(t, len, dest) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  src.connect(dest)
  src.start(t, Math.random() * 0.5)
  src.stop(t + len + 0.02)
}

// A gain that strikes to `level` in `attack` s and decays away by t + len.
function strike(t, attack, len, level, dest) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(level, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  g.connect(dest)
  return g
}

// An oscillator gliding f0 -> f1 Hz over len s, struck and decaying.
function sweep(type, f0, f1, t, len, level, dest) {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(f0, t)
  osc.frequency.exponentialRampToValueAtTime(f1, t + len)
  osc.connect(strike(t, 0.003, len, level, dest))
  osc.start(t)
  osc.stop(t + len + 0.02)
}

// A bell-ish note: a triangle fundamental with two soft sine overtones that die sooner.
const BELL = [[1, 1, 'triangle'], [2, 0.3, 'sine'], [3.98, 0.08, 'sine']] // [frequency factor, gain, wave]
const GLINT = [[1, 1, 'sine']]
function bell(f, t, len, level, dest, partials = BELL) {
  for (const [mult, amp, type] of partials) {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = f * mult
    const end = t + len / Math.sqrt(mult)
    osc.connect(strike(t, 0.005, end - t, level * amp, dest))
    osc.start(t)
    osc.stop(end + 0.02)
  }
}

// Level up: the arpeggio rings up into the chord over a swoosh, glints sparkle on top, and the
// treadmill tick hushes for a moment so it reads. `big` (tutorial complete) adds a bass, more
// glints and a longer ring, and always plays.
export function playLevelUp(big = false) {
  try {
    const L = LEVEL_SFX
    if (!audio()) return
    const now = ctx.currentTime + 0.01
    if (!big && now - lastLevel < L.minGap) return
    lastLevel = now
    hushUntil = performance.now() + L.duck
    const out = bus(L.volume * (big ? L.bigBoost : 1), L.reverb)
    if (!out) return
    L.notes.forEach((f, i) => bell(f, now + i * L.step, L.noteLength, 0.5, out))
    const at = now + L.notes.length * L.step
    const ring = L.chordLength * (big ? L.bigRing : 1)
    for (const f of L.chord) bell(f, at, ring, 0.26, out)
    if (big) for (const f of L.bass) bell(f, at, ring, 0.4, out)
    // The swoosh: noise through a bandpass sweeping up into the chord.
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.2
    bp.frequency.setValueAtTime(500, now)
    bp.frequency.exponentialRampToValueAtTime(5000, at)
    const swell = ctx.createGain()
    swell.gain.setValueAtTime(0, now)
    swell.gain.linearRampToValueAtTime(L.riser, at)
    swell.gain.exponentialRampToValueAtTime(0.0001, at + 0.25)
    bp.connect(swell).connect(out)
    noise(now, at + 0.25 - now, bp)
    const [lo, hi] = L.sparkleRange
    for (let i = 0, n = L.sparkles * (big ? 2 : 1); i < n; i++) bell(lo + Math.random() * (hi - lo), at + Math.random() * ring * 0.7, 0.16, 0.1, out, GLINT)
    done(out, at + ring + L.reverbTime)
  } catch {}
}

// A confetti popper going off: a punchy noise crack over a low kick, then the paper rustling out.
export function playPopper(pan = 0) {
  try {
    const P = PARTY_SFX
    if (!audio()) return
    const now = ctx.currentTime + 0.005
    const out = bus(P.volume, P.reverb, pan)
    if (!out) return
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = P.crackFreq
    bp.Q.value = 0.8
    bp.connect(strike(now, 0.002, P.crackLength, 1, out))
    noise(now, P.crackLength, bp)
    const [k0, k1, kLen] = P.thump
    sweep('sine', k0, k1, now, kLen, 0.9, out)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 3500
    hp.connect(out)
    for (let i = 0; i < P.crackles; i++) {
      const at = Math.random() * P.crackleSpread
      const t = now + 0.03 + at
      noise(t, 0.012, strike(t, 0.001, 0.012, 0.25 * (1 - at / (P.crackleSpread + 0.1)), hp))
    }
    done(out, now + P.crackleSpread + 0.3)
  } catch {}
}

// The party blower: two buzzy detuned saws unroll up in pitch, wobble, then sag as the breath runs out.
export function playPartyHorn() {
  try {
    const H = PARTY_SFX.horn
    if (!audio()) return
    const now = ctx.currentTime + 0.005
    const out = bus(PARTY_SFX.volume * H.level, PARTY_SFX.reverb)
    if (!out) return
    const end = now + H.length
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = H.cutoff
    lp.Q.value = 3
    const breath = ctx.createGain()
    breath.gain.setValueAtTime(0, now)
    breath.gain.linearRampToValueAtTime(1, now + 0.03)
    breath.gain.setValueAtTime(1, end - 0.08)
    breath.gain.exponentialRampToValueAtTime(0.0001, end)
    lp.connect(breath).connect(out)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = H.vibrato[0]
    const depth = ctx.createGain()
    depth.gain.value = H.vibrato[1]
    lfo.connect(depth)
    for (const detune of [-9, 9]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.detune.value = detune
      osc.frequency.setValueAtTime(H.from, now)
      osc.frequency.linearRampToValueAtTime(H.to, now + H.unroll)
      osc.frequency.setValueAtTime(H.to, now + H.length * 0.7)
      osc.frequency.linearRampToValueAtTime(H.to * H.sag, end)
      depth.connect(osc.frequency)
      osc.connect(lp)
      osc.start(now)
      osc.stop(end + 0.02)
    }
    lfo.start(now)
    lfo.stop(end + 0.02)
    done(out, end + 0.3)
  } catch {}
}

// A tapped balloon: a sharp bright snap with a quick falling squeak under it, panned a little.
export function playBalloonPop() {
  try {
    if (!audio()) return
    const now = ctx.currentTime + 0.005
    const out = bus(PARTY_SFX.volume * PARTY_SFX.balloon, 0.2, (Math.random() - 0.5) * 0.6)
    if (!out) return
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1200
    hp.connect(strike(now, 0.001, 0.06, 1, out))
    noise(now, 0.06, hp)
    sweep('triangle', 380 + Math.random() * 120, 90, now, 0.07, 0.5, out)
    done(out, now + 0.3)
  } catch {}
}

// Denied action: a thump and two falling square/saw buzzes through a resonant lowpass.
export function playError() {
  try {
    const E = ERROR_SFX
    if (!audio()) return
    const now = ctx.currentTime
    if (now - lastError < E.minGap) return
    lastError = now
    players.click?.pause() // the button tick that led here would blur the buzz
    const vol = E.volume * (settings.sfx_volume ?? 1)
    if (vol <= 0) return

    const out = ctx.createGain()
    out.gain.value = vol
    out.connect(ctx.destination)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = E.cutoff
    lp.Q.value = E.resonance
    lp.connect(out)
    let end = now
    const tone = (type, f0, f1, t, len, level, dest, detune = 0) => {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.detune.value = detune
      osc.frequency.setValueAtTime(f0, t)
      osc.frequency.exponentialRampToValueAtTime(f1, t + len)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(level, t + 0.006)
      env.gain.setValueAtTime(level, t + len * 0.55)
      env.gain.exponentialRampToValueAtTime(0.001, t + len)
      osc.connect(env).connect(dest)
      osc.start(t)
      osc.stop(t + len + 0.02)
      end = Math.max(end, t + len + 0.02)
    }
    const [k0, k1, kLen] = E.thump
    tone('sine', k0, k1, now, kLen, E.thumpLevel, out)
    for (const [f0, f1, at] of E.buzzes) {
      tone('square', f0, f1, now + at, E.length, 0.5, lp, -E.detune)
      tone('sawtooth', f0, f1, now + at, E.length, 0.5, lp, E.detune)
    }
    setTimeout(() => out.disconnect(), (end - now) * 1000 + 100)
    rest(end)
  } catch {}
}

export function playSfx(name) {
  const def = SFX[name]
  if (!def || (name === 'hairGain' && performance.now() < hushUntil)) return
  try {
    let a = players[name]
    if (!a) {
      a = players[name] = new Audio(`${import.meta.env.BASE_URL}audio/${def.file}`)
      a.preload = 'auto'
    }
    a.volume = def.volume * (settings.sfx_volume ?? 1)
    a.currentTime = 0
    a.play()?.catch(() => {})
  } catch {}
}

const canHover = () => matchMedia('(hover: hover)').matches // no hover tick on touch screens
// The touch Jump / Hair-cable pads are game controls, not UI: they stay silent.
const uiButton = (target) => {
  const b = target.closest?.('button')
  return b && !b.disabled && !b.closest('#touch') ? b : null
}

export function installClickSound() {
  // The synth context is made (and so unlocked on iOS) at the first gesture; the level-up jingle
  // plays later, outside any gesture.
  const gestures = ['pointerdown', 'keydown', 'touchend']
  const unlock = () => {
    if (!audio()) return
    rest(ctx.currentTime)
    if (ctx.state === 'running') for (const type of gestures) removeEventListener(type, unlock, true)
  }
  for (const type of gestures) addEventListener(type, unlock, true)
  let lastBtn = null
  document.addEventListener('mouseover', (e) => {
    const b = uiButton(e.target)
    if (b === lastBtn) return
    lastBtn = b
    if (b && canHover()) playSfx('hover')
  })
  document.addEventListener('click', (e) => uiButton(e.target) && playSfx('click'), true)
}
