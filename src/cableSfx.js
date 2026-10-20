// Hair cable foley: the strand whipping off the head, streaming and fluttering through
// the air, striking a surface and creaking taut under the player's weight, the rush of
// wind and the hiss of the hands sliding along it on the zip, and the whizz back in.
// It is all synthesised live with Web Audio from shaped noise (pink and brown
// noise, sparse fibre crackle and stick-slip creak) pushed through moving filters and
// random flutter, the way foley whooshes, wind and rope are designed. There are no
// oscillators, so nothing reads as a beep. Every one-shot is re-randomised (pitch,
// length, which slice of noise) so no two casts sound alike, and the loops follow the
// cable live: a turning tip whooshes harder, a faster ride roars brighter.
// The audio context is made at the first user gesture (autoplay rules) and suspended
// once the cable has rested a few seconds, so it costs nothing when unused.
import { CABLE_SFX, GRAPPLE, clamp } from './config.js'
import { settings } from './bloxity.js'

const NOISE_RMS = 0.25 // every noise buffer is scaled to this RMS so the mix gains below compare
const MOD_RMS = 0.5 // modulator buffers: wobbles of about +-1
const MOD_RATE = 8000 // Hz sample rate of the modulator buffers (they hold nothing above 100 Hz)
const LOOP_SEAM = 0.05 // s crossfaded where a looping buffer wraps, so the loop never clicks
const TURN_FULL = 0.5 // rad of tip still turning that counts as a hard swing
const ARRIVE_SLACK = 1 // m of hair still ahead when the ride ends that still counts as reaching the end
const GRAIN_CREST = 2.5 // the loudest rustle grain, in multiples of the rustle's RMS
const LIMIT_KNEE = 0.7 // output level the safety limiter starts bending at (1 = full scale)
const MAX_RUSH = 1.6 // ride speed (in GRAPPLE.zipSpeed units, Zippy Hair goes past 1) the wind stops growing at

let ctx = null
let bank = null // generated buffers
let dry = null // one-shots and loops -> master
let send = null // reverb input
let master = null
let loops = null // the live nodes the per-frame update drives
let asleep = false // suspended by us after a quiet spell (or a hidden tab)
let waking = false
let quiet = 0 // s the cable has been at rest (a gesture that wakes the context resets it)
const last = new Float32Array(10).fill(-1) // last target sent to each driven param

const rand = () => Math.random() * 2 - 1
const vary = (x, amount) => x * (1 + rand() * amount)

function normalize(d, rms = NOISE_RMS) {
  let sum = 0
  for (let i = 0; i < d.length; i++) sum += d[i] * d[i]
  const k = rms / Math.sqrt(sum / d.length || 1e-12)
  for (let i = 0; i < d.length; i++) d[i] *= k
}

// n samples of pink (-3 dB/octave, Paul Kellet's filter) or brown (-6 dB/octave, leaky integral) noise.
const noise = (color) => (n) => {
  const d = new Float32Array(n)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < n; i++) {
    const w = rand()
    if (color === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099
      b1 = 0.963 * b1 + w * 0.2965
      b2 = 0.57 * b2 + w * 1.0526
      d[i] = b0 + b1 + b2 + w * 0.1848
    } else {
      b0 = (b0 + 0.02 * w) / 1.02
      d[i] = b0
    }
  }
  return d
}

// Random values about `rate` times a second (each gap jittered), eased between with a cosine:
// an irregular wobble with no pitch, for flutter, gusts and grit.
const wobble = (rate) => (n, sr) => {
  const d = new Float32Array(n)
  let a = rand()
  let b = rand()
  let f = 0
  let df = rate / sr
  for (let i = 0; i < n; i++) {
    f += df
    if (f >= 1) {
      f -= 1
      a = b
      b = rand()
      df = (rate * (0.6 + 0.8 * Math.random())) / sr
    }
    d[i] = a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * f))
  }
  return d
}

// Sparse fibre ticks, `rate` a second on average (Poisson spaced), each a 1.5-5 ms decaying
// grain of noise, mostly tiny with the odd loud one: hair rubbing on hair.
const crackle = (rate) => (n, sr) => {
  const d = new Float32Array(n)
  let i = 0
  for (;;) {
    i += Math.max(1, Math.round((-Math.log(1 - Math.random()) / rate) * sr))
    if (i >= n) break
    const len = Math.round(sr * (0.0015 + 0.0035 * Math.random())) // long enough to be a soft brush, not a click
    const amp = Math.random() ** 3
    for (let j = 0; j < len && i + j < n; j++) d[i + j] += rand() * amp * Math.exp((-5 * j) / len)
  }
  // Round off the rare huge grain so the rustle stays a texture, not a pop.
  let sum = 0
  for (let k = 0; k < n; k++) sum += d[k] * d[k]
  const top = GRAIN_CREST * Math.sqrt(sum / n || 1e-12)
  for (let k = 0; k < n; k++) d[k] = top * Math.tanh(d[k] / top)
  return d
}

// A looping buffer of `channels` independent runs of `gen` (stereo channels are decorrelated
// for width), its tail crossfaded into its head so the wrap is seamless.
function loopBuffer(seconds, channels, gen, rms = NOISE_RMS, sr = ctx.sampleRate) {
  const n = Math.round(seconds * sr)
  const seam = Math.round(LOOP_SEAM * sr)
  const buf = ctx.createBuffer(channels, n, sr)
  for (let c = 0; c < channels; c++) {
    const raw = gen(n + seam, sr)
    const out = buf.getChannelData(c)
    out.set(raw.subarray(0, n))
    for (let i = 0; i < seam; i++) {
      const t = i / seam
      out[i] = raw[i] * Math.sqrt(t) + raw[n + i] * Math.sqrt(1 - t)
    }
    normalize(out, rms)
  }
  return buf
}

// Stick-slip creak of hair hauled taut: an irregular, slowing run of slips (~120 a second),
// each ringing the strand's two loudest body modes briefly, swelling then dying.
function creakBuffer() {
  const sr = ctx.sampleRate
  const dur = 0.24 // s
  const n = Math.round(dur * sr)
  const buf = ctx.createBuffer(1, n, sr)
  const d = buf.getChannelData(0)
  const f1 = vary(620, 0.2) // Hz
  const f2 = f1 * vary(2.3, 0.1) // Hz
  const ring = Math.round(sr * 0.006) // samples each slip rings for
  let t = 0
  let period = 1 / vary(120, 0.2) // s between slips
  while (t < dur) {
    const i = Math.round(t * sr)
    const amp = Math.sin((Math.PI * t) / dur) ** 0.6 * (0.5 + 0.5 * Math.random())
    const ph = Math.random() * 2 * Math.PI
    for (let j = 0; j < ring && i + j < n; j++) {
      const w = (2 * Math.PI * j) / sr
      d[i + j] += amp * Math.exp(-j / (ring * 0.25)) * (Math.sin(f1 * w + ph) + 0.5 * Math.sin(f2 * w) + 0.4 * rand())
    }
    t += period * vary(1, 0.35)
    period *= 1.025
  }
  normalize(d)
  return buf
}

// Short open-air tail: decaying stereo noise that darkens as it dies, like sound off nearby ground and walls.
function airImpulse(seconds) {
  const sr = ctx.sampleRate
  const n = Math.round(seconds * sr)
  const buf = ctx.createBuffer(2, n, sr)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let y = 0
    for (let i = 0; i < n; i++) {
      const t = i / n
      y += (0.9 - 0.75 * t) * (rand() * Math.exp(-6.9 * t) - y)
      d[i] = y
    }
  }
  return buf
}

const gain = (v) => {
  const g = ctx.createGain()
  g.gain.value = v
  return g
}
const filter = (type, freq, q = 0.7) => {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}
function loopSource(buf, rate = 1) {
  const s = ctx.createBufferSource()
  s.buffer = buf
  s.loop = true
  s.playbackRate.value = rate
  s.start(0, Math.random() * buf.duration)
  return s
}
// Push `param` around its own value by `depth` times a modulator buffer.
const modulate = (param, buf, depth, rate = 1) => loopSource(buf, rate).connect(gain(depth)).connect(param)

function build() {
  bank = {
    pink: loopBuffer(2, 2, noise('pink')),
    brown: loopBuffer(2, 2, noise('brown')),
    rustle: loopBuffer(2, 2, crackle(CABLE_SFX.rustleRate)),
    flutter: loopBuffer(7, 1, wobble(CABLE_SFX.flutterRate), MOD_RMS, MOD_RATE),
    gust: loopBuffer(12, 1, wobble(0.5), MOD_RMS, MOD_RATE),
    grit: loopBuffer(3, 1, wobble(30), MOD_RMS, MOD_RATE),
    creaks: Array.from({ length: 4 }, creakBuffer),
  }

  master = gain(0)
  const comp = ctx.createDynamicsCompressor() // keeps a loud strike over a full-speed rush from clipping
  comp.threshold.value = -16 // dB
  comp.knee.value = 12 // dB
  comp.ratio.value = 3
  comp.attack.value = 0.003 // s
  comp.release.value = 0.2 // s
  // Last stage: linear up to the knee, then a smooth bend toward full scale, so nothing hard-clips
  // (the shaper maps -1..1 onto the curve and holds its end values past that).
  const limit = ctx.createWaveShaper()
  const curve = new Float32Array(1025)
  for (let i = 0; i < curve.length; i++) {
    const x = i / 512 - 1
    const ax = Math.abs(x)
    curve[i] = Math.sign(x) * (ax <= LIMIT_KNEE ? ax : LIMIT_KNEE + (1 - LIMIT_KNEE) * Math.tanh((ax - LIMIT_KNEE) / (1 - LIMIT_KNEE)))
  }
  limit.curve = curve
  // Tone: shelve the top down and cut what is left above toneLowpass, so the foley stays warm and easy on the ears.
  const shelf = ctx.createBiquadFilter()
  shelf.type = 'highshelf'
  shelf.frequency.value = CABLE_SFX.toneCut
  shelf.gain.value = CABLE_SFX.toneCutGain
  master.connect(shelf).connect(filter('lowpass', CABLE_SFX.toneLowpass, 0.5)).connect(comp).connect(limit).connect(ctx.destination)
  dry = gain(1)
  dry.connect(master)
  const verb = ctx.createConvolver()
  verb.buffer = airImpulse(CABLE_SFX.reverbTime)
  send = gain(1)
  send.connect(verb).connect(gain(CABLE_SFX.reverbLevel)).connect(master)

  // Flight: the strand streaming through the air. A broad band of pink noise wandering with
  // slow gusts and a soft fibre rustle, flapping together at the strand flutter rate.
  const fly = gain(0)
  fly.connect(dry)
  const flap = gain(0.65)
  flap.connect(fly)
  modulate(flap.gain, bank.flutter, 0.3)
  const flyBand = filter('bandpass', CABLE_SFX.flightFreq, 0.6)
  modulate(flyBand.frequency, bank.gust, CABLE_SFX.flightFreq * 0.25)
  loopSource(bank.pink).connect(flyBand).connect(gain(2)).connect(flap)
  loopSource(bank.rustle).connect(filter('bandpass', 1500, 0.6)).connect(gain(0.12)).connect(flap)

  // Zip wind: low roar past the ears (brown noise opening up with speed) plus a higher
  // airy band, buffeted a few times a second like wind round a moving head.
  const wind = gain(0)
  wind.connect(dry)
  const buffet = gain(0.65)
  buffet.connect(wind)
  modulate(buffet.gain, bank.gust, 0.35, 6)
  const windLow = filter('lowpass', 300, 0.5)
  loopSource(bank.brown).connect(windLow).connect(buffet)
  const windBand = filter('bandpass', 800, 0.6)
  modulate(windBand.frequency, bank.gust, 200, 1.7)
  const windHiss = gain(0)
  loopSource(bank.pink).connect(windBand).connect(windHiss).connect(buffet)

  // Zip friction: the hands sliding along the hair. A soft, slightly rough band of pink noise
  // plus a faint fibre brush that quickens with the ride.
  const rub = gain(0)
  rub.connect(dry)
  const grit = gain(0.5)
  grit.connect(rub)
  modulate(grit.gain, bank.grit, 0.2)
  const rubBand = filter('bandpass', 900, 0.7)
  loopSource(bank.pink).connect(rubBand).connect(gain(2.5)).connect(grit)
  const fibres = loopSource(bank.rustle)
  fibres.connect(filter('bandpass', 1200, 0.6)).connect(gain(0.25)).connect(grit)

  loops = { fly, flyBand, wind, windLow, windHiss, rub, rubBand, fibres }
}

// One noise burst: `buf` (from a random slice, or `from` s) through a `type` filter whose
// frequency moves through `freq` ([s, Hz] points), shaped by `env` ([s, 0..1] points: linear
// rises, exponential falls) times `level`; `wet` of it also rings in the air tail.
function burst(buf, { type, q = 0.7, freq, env, level, wet = 0, delay = 0, rate = 1, from = null }) {
  const t0 = ctx.currentTime + delay
  const end = env[env.length - 1][0]
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = rate
  const f = filter(type, freq[0][1], q)
  f.frequency.setValueAtTime(freq[0][1], t0)
  for (let i = 1; i < freq.length; i++) f.frequency.exponentialRampToValueAtTime(freq[i][1], t0 + freq[i][0])
  const g = gain(0)
  g.gain.setValueAtTime(env[0][1] * level, t0)
  for (let i = 1; i < env.length; i++) {
    const v = Math.max(env[i][1] * level, 1e-4)
    if (env[i][1] >= env[i - 1][1]) g.gain.linearRampToValueAtTime(v, t0 + env[i][0])
    else g.gain.exponentialRampToValueAtTime(v, t0 + env[i][0])
  }
  src.connect(f).connect(g).connect(dry)
  if (wet) g.connect(gain(wet)).connect(send)
  const offset = from ?? Math.random() * Math.max(0, buf.duration - end * rate - 0.05)
  src.start(t0, offset)
  src.stop(t0 + end + 0.05)
  src.onended = () => g.disconnect()
}

// Space: the strand whips off the scalp and cuts away through the air.
function shoot() {
  const p = vary(1, 0.08) // pitch
  const d = vary(1, 0.12) // length
  burst(bank.pink, { type: 'bandpass', freq: [[0, 1500 * p]], env: [[0, 0], [0.004, 1], [0.04 * d, 0]], level: 0.9, wet: 0.1 }) // the flick
  burst(bank.pink, { type: 'bandpass', q: 1.1, freq: [[0, 400 * p], [0.07 * d, 1500 * p], [0.36 * d, 500 * p]], env: [[0, 0], [0.06 * d, 1], [0.13 * d, 0.5], [0.38 * d, 0]], level: 3, wet: 0.2 }) // the swish, rising and falling as it rushes past
  burst(bank.rustle, { type: 'bandpass', q: 0.6, freq: [[0, 1400 * p]], env: [[0, 0], [0.03, 1], [0.3 * d, 0]], level: 0.35, rate: p, wet: 0.15 }) // strands unfurling
  burst(bank.brown, { type: 'lowpass', freq: [[0, 900], [0.16, 220]], env: [[0, 0], [0.012, 1], [0.18, 0]], level: 1.2 }) // the push of air
}

// The hair snapping taut under the player's weight, and the hands closing on it.
function strain(delay = 0, level = 0.7) {
  const p = vary(1, 0.1)
  const creak = bank.creaks[(Math.random() * bank.creaks.length) | 0]
  burst(creak, { type: 'highpass', freq: [[0, 180]], env: [[0, 1], [0.24, 1]], level: level * 0.9, rate: p, wet: 0.25, delay, from: 0 })
  burst(bank.rustle, { type: 'bandpass', q: 0.6, freq: [[0, 1500 * p]], env: [[0, 0], [0.01, 1], [0.12, 0]], level: level * 0.5, delay: delay + 0.03 }) // the grip
}

// The tip strikes a surface and sticks: a dull thud, the slap of hair on it, then the strain.
function strike() {
  const p = vary(1, 0.1)
  burst(bank.brown, { type: 'lowpass', q: 1, freq: [[0, 500 * p], [0.12, 110]], env: [[0, 0], [0.003, 1], [0.17, 0]], level: 2, wet: 0.3 })
  burst(bank.pink, { type: 'bandpass', q: 0.8, freq: [[0, 1100 * p], [0.06, 600 * p]], env: [[0, 0], [0.003, 1], [0.07, 0]], level: 2, wet: 0.25 })
  strain(0.05, 1)
}

// Let go or missed: the hair whizzes back in (as long as it takes to come home), then flops onto the back.
function reel(length) {
  const d = clamp(length / GRAPPLE.retractSpeed, 0.15, 0.7) // s
  const p = vary(1, 0.08)
  burst(bank.pink, { type: 'bandpass', q: 1.2, freq: [[0, 1200 * p], [d, 400 * p]], env: [[0, 0], [0.03, 0.8], [d * 0.7, 0.55], [d + 0.06, 0]], level: 2.6, wet: 0.15 })
  burst(bank.rustle, { type: 'bandpass', q: 0.6, freq: [[0, 1300 * p]], env: [[0, 0], [0.02, 1], [d, 0]], level: 0.3 })
  burst(bank.brown, { type: 'lowpass', freq: [[0, 700], [0.12, 200]], env: [[0, 0], [0.004, 1], [0.15, 0]], level: 1.2, delay: d, wet: 0.15 })
  burst(bank.rustle, { type: 'bandpass', q: 0.6, freq: [[0, 1300 * p]], env: [[0, 0], [0.005, 1], [0.14, 0]], level: 0.4, delay: d })
}

// The ride reaches the end: the body swings off and the hands let go.
function arrive() {
  const p = vary(1, 0.1)
  burst(bank.pink, { type: 'bandpass', q: 0.9, freq: [[0, 500 * p], [0.16, 1000 * p], [0.36, 400 * p]], env: [[0, 0], [0.08, 1], [0.38, 0]], level: 1.8, wet: 0.15 })
  burst(bank.rustle, { type: 'bandpass', q: 0.6, freq: [[0, 1300 * p]], env: [[0, 0], [0.008, 1], [0.15, 0]], level: 0.4 })
}

// Ease a driven param (slot `i` in `last`) toward `v` with time constant `tau` s, skipping repeats.
function glide(i, param, v, tau) {
  if (Math.abs(v - last[i]) <= 1e-3 * Math.max(1, Math.abs(v))) return
  last[i] = v
  param.setTargetAtTime(v, ctx.currentTime, tau)
}

function wake() {
  if (!ctx || document.hidden || waking || (!asleep && ctx.state === 'running')) return
  waking = true
  asleep = false
  quiet = 0
  ctx.resume().catch(() => {}).finally(() => (waking = false))
}

function sleep() {
  if (!ctx || asleep) return
  asleep = true
  ctx.suspend().catch(() => {})
}

// Made inside a user gesture so autoplay rules allow it; later gestures resume it (iOS needs that).
function unlock() {
  if (ctx) {
    wake()
    return
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) throw new Error('no Web Audio')
    ctx = new Ctx({ latencyHint: 'interactive' })
    build()
  } catch (e) {
    console.warn('[cableSfx] no cable sounds:', e)
    ctx = null
    for (const type of GESTURES) window.removeEventListener(type, unlock, true)
  }
}
const GESTURES = ['pointerdown', 'keydown', 'touchend']

export function createCableSfx() {
  for (const type of GESTURES) window.addEventListener(type, unlock, true)
  document.addEventListener('visibilitychange', () => document.hidden && sleep())
  let prev = 'idle'

  // Every frame (also in the salon, so a dropped cable's loops still fade).
  function update(dt, cable) {
    const st = cable.state
    if (!ctx || !loops) {
      prev = st
      return
    }
    if (st !== prev) {
      wake()
      if (prev === 'idle') shoot()
      if (st === 'riding') {
        if (cable.anchored) strike()
        else strain() // ran out of hair: it pulls taut on nothing
      } else if (st === 'retracting') {
        if (prev === 'riding' && cable.outLength < ARRIVE_SLACK) arrive()
        else reel(cable.outLength)
      }
      // flying / riding straight to idle is an instant drop (respawn, salon): the loops just fade
      prev = st
    }
    if (cable.active) {
      quiet = 0
      wake()
    } else if ((quiet += dt) > CABLE_SFX.sleepAfter) sleep()
    if (asleep) return

    const { attack, release } = CABLE_SFX
    const flying = st === 'flying'
    const turn = flying ? clamp(cable.tipTurn / TURN_FULL, 0, 1) : 0
    glide(0, loops.fly.gain, flying ? CABLE_SFX.flight * (1 + 0.4 * turn) : 0, flying ? attack : release * 0.5)
    glide(1, loops.flyBand.frequency, CABLE_SFX.flightFreq * (1 + 0.25 * turn), 0.1)
    const v = cable.zipping ? clamp(cable.rideSpeed() * cable.speedMult, 0, MAX_RUSH) : 0
    const on = v > 0
    glide(2, loops.wind.gain, CABLE_SFX.wind * v ** 1.5, on ? attack : release * 1.5) // the wind outlasts the grip a moment
    glide(3, loops.windLow.frequency, 350 + 900 * v * v, 0.15) // Hz
    glide(4, loops.windHiss.gain, 0.35 + 0.35 * v * v, 0.15)
    glide(5, loops.rub.gain, on ? CABLE_SFX.friction * (0.5 + 0.5 * v) : 0, on ? attack : 0.04) // stops dead when the hands open
    glide(6, loops.rubBand.frequency, 800 + 400 * v, 0.1) // Hz
    glide(7, loops.fibres.playbackRate, 0.8 + 0.3 * v, 0.1)
    glide(8, master.gain, CABLE_SFX.volume * (settings.sfx_volume ?? 1), 0.05)
  }

  return { update }
}
