// Tutorial-complete party: two confetti poppers slide in at the bottom corners and fire, glossy
// balloons float up the screen on wavy strings (tap or click one to pop it into shards), confetti
// rains from the top and a TUTORIAL COMPLETE! banner bounces in over slowly turning sun rays, with
// its own sounds (the poppers, the level-up jingle's big take, a party blower).
//
// Kept cheap for phones: one overlay canvas at a capped pixel ratio with no pointer events (taps
// are hit-tested from a passive window listener, so the game still gets them), balloons drawn from
// sprites painted once and kept, confetti from a fixed pool of objects (no per-frame allocation),
// the banner animated with CSS transforms and opacity only, and the whole overlay removed once the
// last piece has left the screen. Sized in vmin / em, so it fits phones in either orientation.
import { PARTY, clamp } from './config.js'
import { playBalloonPop, playLevelUp, playPartyHorn, playPopper } from './sfx.js'

const CSS = `
#party { position: fixed; inset: 0; z-index: 65; pointer-events: none; overflow: hidden; user-select: none; -webkit-user-select: none;
  font-family: "Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif; font-weight: 700; color: #fff; transition: opacity 0.4s;
  --ray: min(118vmin, 900px); --pop: min(18vmin, 128px); --mid: 42%; }
#party.fade { opacity: 0; }
#party canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
/* Sun rays and a warm glow behind the banner */
#party .pt-rays { position: absolute; left: calc(50% - var(--ray) / 2); top: calc(var(--mid) - var(--ray) / 2); width: var(--ray); height: var(--ray); animation: pt-grow 0.6s ease-out both; }
#party .pt-rays::before { content: ''; position: absolute; inset: 24%; border-radius: 50%; background: radial-gradient(closest-side, rgba(255,250,215,0.9), rgba(255,215,110,0.4) 45%, transparent); }
#party .pt-rays i { position: absolute; inset: 0; border-radius: 50%; will-change: transform; animation: pt-spin 14s linear infinite;
  background: repeating-conic-gradient(rgba(255,228,110,0.55) 0deg 8deg, rgba(255,228,110,0) 8deg 20deg);
  -webkit-mask: radial-gradient(closest-side, transparent 10%, #000 24%, rgba(0,0,0,0.45) 60%, transparent);
  mask: radial-gradient(closest-side, transparent 10%, #000 24%, rgba(0,0,0,0.45) 60%, transparent); }
#party .pt-rays.out { animation: pt-fade 0.45s ease-in forwards; }
/* The banner: a zero-height row at --mid that centres the card on it */
#party .pt-mid { position: absolute; left: 0; right: 0; top: var(--mid); height: 0; display: flex; align-items: center; justify-content: center; }
#party .pt-card { position: relative; isolation: isolate; display: flex; flex-direction: column; align-items: center; font-size: min(12vw, 9.5vh, 100px); animation: pt-in 0.7s ease-out both; }
#party .pt-card.out { animation: pt-out 0.45s ease-in forwards; }
#party .pt-star { width: 1.5em; margin-bottom: -0.12em; filter: drop-shadow(0 0.06em 0 rgba(0,0,0,0.3)); animation: pt-star-in 0.9s ease-out 0.15s both, pt-bob 1.8s ease-in-out 1.05s infinite; }
#party .pt-star svg { display: block; width: 100%; }
#party .pt-title { position: relative; z-index: 0; display: flex; flex-direction: column; align-items: center; line-height: 0.95; letter-spacing: 0.02em; white-space: nowrap; }
#party .pt-title span { position: relative; padding: 0 0.1em; color: transparent; -webkit-background-clip: text; background-clip: text; }
#party .pt-title span::before { content: attr(data-t); position: absolute; left: 0.1em; top: 0; z-index: -1; color: #15152a; -webkit-text-stroke: 0.2em #15152a;
  text-shadow: 0 0.09em 0 #15152a, 0 0.16em 0.22em rgba(0,0,0,0.4); }
#party .pt-title .a { font-size: 0.66em; background-image: linear-gradient(#fff 25%, #c4f5ff 60%, #5fd8ff); }
#party .pt-title .b { background-image: linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.95) 50%, transparent 58%), linear-gradient(#fff7b8 10%, #ffd21a 50%, #ff9a0a 92%);
  background-size: 250% 100%, 100% 100%; background-repeat: no-repeat; animation: pt-shine 1.3s ease-in-out 0.7s 2 both; }
#party .pt-ribbon { position: relative; margin-top: 0.24em; padding: 0.2em 0.9em 0.26em; font-size: 0.34em; white-space: nowrap;
  background: linear-gradient(#ff7ab5, #ff3f86 55%, #e0256b); border: 0.12em solid #15152a; border-radius: 0.35em;
  box-shadow: 0 0.16em 0 #15152a, inset 0 0.14em 0 rgba(255,255,255,0.35); -webkit-text-stroke: 0.16em #6a0b33; paint-order: stroke fill;
  animation: pt-rib 0.5s ease-out 0.35s both; }
#party .pt-ribbon::before, #party .pt-ribbon::after { content: ''; position: absolute; top: 0.45em; width: 1.3em; height: 100%; z-index: -1;
  background: linear-gradient(#d4206a, #a3134f); border: 0.12em solid #15152a; }
#party .pt-ribbon::before { left: -0.95em; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 35% 50%); }
#party .pt-ribbon::after { right: -0.95em; clip-path: polygon(0 0, 100% 0, 65% 50%, 100% 100%, 0 100%); }
#party .pt-spark { position: absolute; width: 0.45em; opacity: 0; animation: pt-twinkle 1.3s ease-in-out infinite; }
#party .pt-spark svg { display: block; width: 100%; }
#party .pt-spark.s1 { left: -0.55em; top: 1.5em; animation-delay: 0.5s; }
#party .pt-spark.s2 { right: -0.6em; top: 1.1em; width: 0.35em; animation-delay: 0.8s; }
#party .pt-spark.s3 { left: -0.3em; bottom: 0.1em; width: 0.3em; animation-delay: 1.1s; }
#party .pt-spark.s4 { right: -0.45em; bottom: 0.45em; width: 0.55em; animation-delay: 0.65s; }
#party .pt-spark.s5 { left: 22%; top: -0.1em; width: 0.3em; animation-delay: 0.95s; }
#party .pt-spark.s6 { right: 18%; top: 0.2em; width: 0.38em; animation-delay: 1.25s; }
/* The confetti poppers in the bottom corners */
#party .pt-popper { position: absolute; bottom: calc(env(safe-area-inset-bottom, 0px) - var(--pop) * 0.1); width: var(--pop); height: var(--pop);
  filter: drop-shadow(0 4px 0 rgba(0,0,0,0.3)); animation: pt-pop-in 0.35s ease-out both; }
#party .pt-popper.l { --d: 1; left: calc(env(safe-area-inset-left, 0px) - var(--pop) * 0.1); }
#party .pt-popper.r { --d: -1; right: calc(env(safe-area-inset-right, 0px) - var(--pop) * 0.1); }
#party .pt-popper.r svg { transform: scaleX(-1); }
#party .pt-popper svg { display: block; width: 100%; height: 100%; }
#party .pt-popper.fire { animation: pt-kick 0.35s ease-out; }
#party .pt-popper.out { animation: pt-pop-out 0.4s ease-in forwards; }
@keyframes pt-spin { to { transform: rotate(360deg); } }
@keyframes pt-grow { from { opacity: 0; transform: scale(0.4); } }
@keyframes pt-fade { to { opacity: 0; transform: scale(1.15); } }
@keyframes pt-in { 0% { opacity: 0; transform: scale(0.2) rotate(-8deg); } 55% { opacity: 1; transform: scale(1.1) rotate(2deg); } 78% { transform: scale(0.97) rotate(-1deg); } 100% { transform: none; } }
@keyframes pt-out { to { opacity: 0; transform: translateY(-0.6em) scale(0.7); } }
@keyframes pt-star-in { 0% { transform: scale(0) rotate(-180deg); } 70% { transform: scale(1.2) rotate(10deg); } 100% { transform: none; } }
@keyframes pt-bob { 0%, 100% { transform: rotate(-4deg); } 50% { transform: translateY(-0.08em) rotate(4deg); } }
@keyframes pt-shine { from { background-position: 150% 0, 0 0; } to { background-position: -50% 0, 0 0; } }
@keyframes pt-rib { from { opacity: 0; transform: translateY(0.6em) scale(0.6); } }
@keyframes pt-twinkle { 0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); } 50% { opacity: 1; transform: scale(1) rotate(90deg); } }
@keyframes pt-pop-in { from { transform: translate(calc(-70% * var(--d)), 70%) rotate(calc(-25deg * var(--d))); } }
@keyframes pt-kick { 0% { transform: none; } 18% { transform: translate(calc(-9% * var(--d)), 9%) scale(0.88, 1.1); } 100% { transform: none; } }
@keyframes pt-pop-out { to { opacity: 0; transform: translate(calc(-80% * var(--d)), 80%); } }
@media (prefers-reduced-motion: reduce) { #party .pt-rays i, #party .pt-star, #party .pt-spark { animation: none; } #party .pt-spark { opacity: 1; } }
`

// A cute gold star: rounded points, a gloss streak, a face.
const STAR_SVG = `<svg viewBox="0 0 100 100"><defs><linearGradient id="pt-star-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a0"/><stop offset="0.45" stop-color="#ffd21a"/><stop offset="1" stop-color="#ff9f0a"/></linearGradient></defs>
<path d="M50 8L62.3 37L93.7 39.8L70 60.5L77 91.2L50 75L23 91.2L30 60.5L6.3 39.8L37.7 37Z" fill="url(#pt-star-g)" stroke="#15152a" stroke-width="6" stroke-linejoin="round"/>
<path d="M50 17L59 39L82 41.5" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cx="37" cy="44" rx="7" ry="3.5" transform="rotate(-30 37 44)" fill="#fff" fill-opacity="0.7"/>
<circle cx="36" cy="64" r="4" fill="#ff7a59" fill-opacity="0.55"/><circle cx="64" cy="64" r="4" fill="#ff7a59" fill-opacity="0.55"/>
<ellipse cx="42.5" cy="56" rx="3.4" ry="4.8" fill="#3a2300"/><ellipse cx="57.5" cy="56" rx="3.4" ry="4.8" fill="#3a2300"/>
<circle cx="43.6" cy="54.2" r="1.3" fill="#fff"/><circle cx="58.6" cy="54.2" r="1.3" fill="#fff"/>
<path d="M44 65Q50 71 56 65" fill="none" stroke="#3a2300" stroke-width="3" stroke-linecap="round"/></svg>`

const SPARK_SVG = '<svg viewBox="0 0 20 20"><path d="M10 0Q11.6 8.4 20 10Q11.6 11.6 10 20Q8.4 11.6 0 10Q8.4 8.4 10 0Z" fill="#fff8c8" stroke="#15152a" stroke-width="1.2" stroke-linejoin="round"/></svg>'
const SPARKS = [1, 2, 3, 4, 5, 6].map((i) => `<i class="pt-spark s${i}">${SPARK_SVG}</i>`).join('')

// A striped party popper whose mouth points up and to the right, a little confetti peeking out.
// The cone runs from its tip (12, 88) to the mouth centred at (66, 34); `id` keeps the defs unique.
function popperSvg(id) {
  const cone = 'M12 88L50.4 18.4L81.6 49.6Z'
  return `<svg viewBox="0 0 100 100"><defs><linearGradient id="pt-pg-${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#6a3de0"/><stop offset="1" stop-color="#b590ff"/></linearGradient>
<clipPath id="pt-pc-${id}"><path d="${cone}"/></clipPath></defs>
<path d="${cone}" fill="url(#pt-pg-${id})"/>
<g clip-path="url(#pt-pc-${id})"><path d="M-2.5 46.5L53.5 102.5M11 33L67 89M24.5 19.5L80.5 75.5" stroke="#ffd21a" stroke-width="7"/>
<path d="M22 80L50 30" stroke="#fff" stroke-opacity="0.35" stroke-width="4" stroke-linecap="round"/></g>
<path d="${cone}" fill="none" stroke="#15152a" stroke-width="4" stroke-linejoin="round"/>
<ellipse cx="66" cy="34" rx="22" ry="9" transform="rotate(45 66 34)" fill="#2a1650" stroke="#15152a" stroke-width="9"/>
<ellipse cx="66" cy="34" rx="22" ry="9" transform="rotate(45 66 34)" fill="none" stroke="#ffe14a" stroke-width="4"/>
<rect x="67" y="15" width="7" height="4" rx="1" fill="#ff4f6d" stroke="#15152a" stroke-width="1.2" transform="rotate(25 70 17)"/>
<rect x="80" y="24" width="4" height="8" rx="1" fill="#3fb7ff" stroke="#15152a" stroke-width="1.2" transform="rotate(-20 82 28)"/>
<rect x="74" y="31" width="6" height="4" rx="1" fill="#46d36a" stroke="#15152a" stroke-width="1.2" transform="rotate(40 77 33)"/>
<circle cx="61" cy="22" r="2.6" fill="#ffe14a" stroke="#15152a" stroke-width="1.2"/></svg>`
}

// Balloon sprites: painted once at this size and drawn scaled.
const SPRITE_W = 120 // px
const SPRITE_H = 172 // px
const KNOT_Y = 143 // px, where the string ties on
const BODY_Y = 66 // px, the body's centre (the tap target)
const BODY = 'M60 6C98 6 112 38 110 66C108 98 82 124 60 130C38 124 12 98 10 66C8 38 22 6 60 6Z'
const KNOT = 'M60 127L51 142Q60 146 69 142Z'
const TAU = Math.PI * 2
const POP_TIME = 0.3 // s a popped balloon's ring and POP! last

const rgbOf = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
// k > 0 mixes toward white, k < 0 toward black.
const shade = ([r, g, b], k) => {
  const to = k > 0 ? 255 : 0
  const a = Math.abs(k)
  return `rgb(${Math.round(r + (to - r) * a)},${Math.round(g + (to - g) * a)},${Math.round(b + (to - b) * a)})`
}
const FRONT = PARTY.colors // confetti face colours
const BACK = PARTY.colors.map((c) => shade(rgbOf(c), -0.35)) // ... and their shaded backs

function paintBalloon(hex) {
  const c = document.createElement('canvas')
  c.width = SPRITE_W
  c.height = SPRITE_H
  const g = c.getContext('2d')
  const rgb = rgbOf(hex)
  const body = new Path2D(BODY)
  const fill = g.createRadialGradient(40, 38, 4, 60, 66, 84)
  fill.addColorStop(0, shade(rgb, 0.6))
  fill.addColorStop(0.25, shade(rgb, 0.15))
  fill.addColorStop(0.62, hex)
  fill.addColorStop(1, shade(rgb, -0.45))
  g.fillStyle = fill
  g.fill(body)
  g.save()
  g.clip(body)
  const soft = g.createRadialGradient(38, 34, 0, 38, 34, 34)
  soft.addColorStop(0, 'rgba(255,255,255,0.5)')
  soft.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = soft
  g.fillRect(0, 0, SPRITE_W, SPRITE_H)
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.beginPath()
  g.ellipse(36, 34, 8, 16, -0.55, 0, TAU)
  g.fill()
  g.fillStyle = 'rgba(255,255,255,0.6)'
  g.beginPath()
  g.arc(33, 58, 3.5, 0, TAU)
  g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.28)' // rim light down the shaded side
  g.lineWidth = 4
  g.beginPath()
  g.ellipse(60, 68, 43, 54, 0, 0.1 * Math.PI, 0.55 * Math.PI)
  g.stroke()
  g.restore()
  g.lineJoin = 'round'
  g.lineWidth = 4
  g.strokeStyle = shade(rgb, -0.65)
  g.stroke(body)
  const knot = new Path2D(KNOT)
  g.fillStyle = shade(rgb, -0.2)
  g.fill(knot)
  g.lineWidth = 3
  g.stroke(knot)
  return c
}

let sprites = null // made, with the stylesheet, at the first party
let active = false

// Throw the party. Ignored while one is already running.
export function celebrate() {
  if (active) return
  active = true
  try {
    run()
  } catch (e) {
    console.warn('[party] no party:', e)
    document.getElementById('party')?.remove()
    active = false
  }
}

function run() {
  if (!sprites) {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)
    sprites = PARTY.colors.map(paintBalloon)
  }
  const root = document.createElement('div')
  root.id = 'party'
  root.innerHTML = `<div class="pt-rays"><i></i></div><canvas></canvas>
<div class="pt-mid"><div class="pt-card">${SPARKS}<div class="pt-star">${STAR_SVG}</div>
<div class="pt-title"><span class="a" data-t="TUTORIAL">TUTORIAL</span><span class="b" data-t="COMPLETE!">COMPLETE!</span></div>
<div class="pt-ribbon">You're ready to escape!</div></div></div>
<div class="pt-popper l">${popperSvg('l')}</div><div class="pt-popper r">${popperSvg('r')}</div>`
  document.body.appendChild(root)
  const canvas = root.querySelector('canvas')
  const g = canvas.getContext('2d')
  const card = root.querySelector('.pt-card')
  const rays = root.querySelector('.pt-rays')
  const poppers = root.querySelectorAll('.pt-popper')

  const small = Math.min(innerWidth, innerHeight) < PARTY.smallScreen
  const thin = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.5 : 1
  const nConfetti = Math.round((small ? PARTY.confettiSmall : PARTY.confetti) * thin)
  const nBalloons = Math.round((small ? PARTY.balloonsSmall : PARTY.balloons) * thin)
  const dpr = Math.min(devicePixelRatio || 1, PARTY.maxDpr)
  let vw = 0 // css px
  let vh = 0
  let short = 0
  let k = 1 // confetti size factor
  function fit() {
    vw = innerWidth
    vh = innerHeight
    short = Math.min(vw, vh)
    k = clamp(short / 800, 0.7, 1.3)
    canvas.width = Math.round(vw * dpr)
    canvas.height = Math.round(vh * dpr)
  }
  fit()

  // Confetti: a fixed pool; `live` marks the pieces in flight.
  const pool = []
  for (let i = 0; i < nConfetti + nBalloons * PARTY.popPieces; i++) pool.push({ live: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, flip: 0, vf: 0, w: 0, h: 0, c: 0 })
  let cursor = 0
  function spawn(x, y, vx, vy, c) {
    for (let n = 0; n < pool.length; n++) {
      const p = pool[cursor]
      cursor = (cursor + 1) % pool.length
      if (p.live) continue
      const strip = Math.random() < 0.25 // a thin curl of ribbon rather than a square
      p.live = true
      p.x = x
      p.y = y
      p.vx = vx
      p.vy = vy
      p.w = (strip ? 3 : 7 + Math.random() * 5) * k
      p.h = strip ? (13 + Math.random() * 6) * k : p.w * (0.45 + Math.random() * 0.25)
      p.rot = Math.random() * TAU
      p.vr = (Math.random() - 0.5) * 12 // rad/s
      p.flip = Math.random() * TAU
      p.vf = 4 + Math.random() * 8 // rad/s tumble
      p.c = c
      return
    }
  }

  // Balloons, let go one by one at shuffled spots across the width.
  const slots = Array.from({ length: nBalloons }, (_, i) => i).sort(() => Math.random() - 0.5)
  const balloons = slots.map((slot, i) => {
    const w = clamp(short * PARTY.balloonSize, PARTY.balloonMin, PARTY.balloonMax) * (0.85 + Math.random() * 0.3)
    const h = (w * SPRITE_H) / SPRITE_W
    return {
      state: 0, // 0 waiting, 1 floating, 2 gone
      at: 0.2 + (PARTY.spawnSpread * i) / nBalloons + Math.random() * 0.15, // s
      slot: (slot + 0.2 + Math.random() * 0.6) / nBalloons, // 0..1 across the screen
      rise: PARTY.riseTime[0] + Math.random() * (PARTY.riseTime[1] - PARTY.riseTime[0]),
      sway: PARTY.sway[0] + Math.random() * (PARTY.sway[1] - PARTY.sway[0]),
      freq: 0.8 + Math.random() * 0.8, // rad/s
      ph: Math.random() * TAU,
      w,
      h,
      len: h * (1.1 + Math.random() * 0.4), // string, css px
      c: i % sprites.length,
      x: 0,
      y: 0,
      tilt: 0, // rad
    }
  })
  const pops = [] // { x, y, r, t } rings of popped balloons

  function pop(b) {
    b.state = 2
    const d = ((KNOT_Y - BODY_Y) / SPRITE_H) * b.h
    const x = b.x + Math.sin(b.tilt) * d
    const y = b.y - Math.cos(b.tilt) * d
    for (let i = 0; i < PARTY.popPieces; i++) {
      const a = (i / PARTY.popPieces) * TAU + Math.random() * 0.4
      const v = short * (0.8 + Math.random() * 0.8)
      spawn(x, y, Math.cos(a) * v, Math.sin(a) * v - short * 0.3, b.c)
    }
    pops.push({ x, y, r: b.w * 0.45, t: 0 })
    playBalloonPop()
  }
  // A tap or click on a balloon pops it (topmost first). The game still gets the same press.
  function onTap(e) {
    if (document.pointerLockElement) return
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i]
      if (b.state !== 1) continue
      const d = ((KNOT_Y - BODY_Y) / SPRITE_H) * b.h
      const dx = (e.clientX - (b.x + Math.sin(b.tilt) * d)) / Math.max(b.w * 0.42, 24)
      const dy = (e.clientY - (b.y - Math.cos(b.tilt) * d)) / Math.max(b.h * 0.36, 28)
      if (dx * dx + dy * dy < 1) return pop(b)
    }
  }

  function fire(side) {
    const el = poppers[side]
    el.classList.add('fire')
    playPopper(side ? 0.6 : -0.6)
    const mouth = Math.min(short * 0.18, 128) * 0.56 // css px from the corner, matches --pop
    const dir = side ? -1 : 1
    const x = side ? vw - mouth : mouth
    const n = Math.round((nConfetti * (1 - PARTY.rainShare)) / 2)
    for (let i = 0; i < n; i++) {
      const a = ((48 + Math.random() * 32) * Math.PI) / 180
      const v = vh * (PARTY.speed[0] + Math.random() * (PARTY.speed[1] - PARTY.speed[0]))
      spawn(x + (Math.random() - 0.5) * 12, vh - mouth, Math.cos(a) * v * dir, -Math.sin(a) * v, i % FRONT.length)
    }
  }
  function bowOut() {
    card.classList.add('out')
    rays.classList.add('out')
    for (const el of poppers) el.classList.add('out')
  }
  const cues = [
    [PARTY.fireAt[0], () => fire(0)],
    [PARTY.fireAt[1], () => fire(1)],
    [PARTY.fireAt[1] + 0.05, () => playLevelUp(true)],
    [PARTY.hornAt, playPartyHorn],
    [PARTY.bannerMs / 1000, bowOut],
  ].sort((a, b) => a[0] - b[0])
  let cue = 0

  const rainTotal = nConfetti - 2 * Math.round((nConfetti * (1 - PARTY.rainShare)) / 2)
  let rainLeft = rainTotal
  let rainAcc = 0
  let t = 0 // s since the start
  let busy = true // pieces or balloons still on screen

  function step(dt) {
    while (cue < cues.length && t >= cues[cue][0]) cues[cue++][1]()
    if (t >= PARTY.fireAt[0] && rainLeft > 0) {
      rainAcc += (rainTotal * dt) / PARTY.rainSpread
      for (; rainAcc >= 1 && rainLeft > 0; rainAcc--, rainLeft--) spawn(Math.random() * vw, -20, (Math.random() - 0.5) * 80 * k, Math.random() * 60 * k, rainLeft % FRONT.length)
    }
    busy = rainLeft > 0
    for (const b of balloons) {
      if (b.state === 0 && t >= b.at) {
        b.state = 1
        b.y = vh + b.h
      }
      if (b.state !== 1) {
        if (b.state === 0) busy = true
        continue
      }
      busy = true
      b.y -= ((vh + b.h + b.len) / b.rise) * dt
      const a = t * b.freq + b.ph
      b.x = b.slot * vw + b.sway * Math.sin(a)
      b.tilt = Math.cos(a) * 0.12
      if (b.y + b.len < 0) b.state = 2
    }
    const grav = PARTY.gravity * vh
    const drag = PARTY.drag
    const flutter = 40 * k // css px/s side drift while tumbling
    for (const p of pool) {
      if (!p.live) continue
      p.vx -= p.vx * drag * dt
      p.vy += (grav - p.vy * drag) * dt
      p.flip += p.vf * dt
      p.rot += p.vr * dt
      p.x += (p.vx + Math.sin(p.flip) * flutter) * dt
      p.y += p.vy * dt
      if (p.y > vh + 30 || p.x < -60 || p.x > vw + 60) p.live = false
      else busy = true
    }
    for (let i = pops.length - 1; i >= 0; i--) if ((pops[i].t += dt) > POP_TIME) pops.splice(i, 1)
  }

  function draw() {
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, canvas.width, canvas.height)
    // Strings: every balloon's in one path, a dark under-stroke and a light one.
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.beginPath()
    for (const b of balloons) {
      if (b.state !== 1) continue
      const w = Math.sin(t * 3 + b.ph) * 6
      g.moveTo(b.x, b.y)
      g.quadraticCurveTo(b.x + w, b.y + b.len * 0.3, b.x - w * 0.4, b.y + b.len * 0.55)
      g.quadraticCurveTo(b.x - w * 1.2, b.y + b.len * 0.8, b.x + w * 0.6 - b.tilt * 60, b.y + b.len)
    }
    g.lineCap = 'round'
    g.strokeStyle = 'rgba(20,20,42,0.35)'
    g.lineWidth = 3
    g.stroke()
    g.strokeStyle = 'rgba(255,255,255,0.85)'
    g.lineWidth = 1.4
    g.stroke()
    for (const b of balloons) {
      if (b.state !== 1) continue
      const c = Math.cos(b.tilt) * dpr
      const s = Math.sin(b.tilt) * dpr
      g.setTransform(c, s, -s, c, b.x * dpr, b.y * dpr)
      g.drawImage(sprites[b.c], -b.w / 2, (-b.h * KNOT_Y) / SPRITE_H, b.w, b.h)
    }
    let fill = ''
    for (const p of pool) {
      if (!p.live) continue
      const sy = Math.cos(p.flip) // the tumble: the piece flattens and shows its back
      const c = Math.cos(p.rot) * dpr
      const s = Math.sin(p.rot) * dpr
      g.setTransform(c, s, -s * sy, c * sy, p.x * dpr, p.y * dpr)
      const f = sy >= 0 ? FRONT[p.c] : BACK[p.c]
      if (f !== fill) g.fillStyle = fill = f
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
    }
    if (pops.length) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.lineJoin = 'round'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      for (const p of pops) {
        const f = p.t / POP_TIME
        g.globalAlpha = 1 - f
        g.strokeStyle = '#fff'
        g.lineWidth = 3
        g.beginPath()
        g.arc(p.x, p.y, p.r * (1 + f * 1.4), 0, TAU)
        g.stroke()
        const size = Math.max(16, p.r * 0.8)
        g.font = `700 ${Math.round(size)}px Fredoka, sans-serif`
        g.strokeStyle = '#15152a'
        g.lineWidth = size * 0.22
        g.strokeText('POP!', p.x, p.y - p.r * f)
        g.fillStyle = fill = '#fff'
        g.fillText('POP!', p.x, p.y - p.r * f)
      }
      g.globalAlpha = 1
    }
  }

  let raf = 0
  let last = performance.now()
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    t += dt
    step(dt)
    draw()
    if ((!busy && t > PARTY.bannerMs / 1000 + 0.5) || t > PARTY.maxTime) return finish()
    raf = requestAnimationFrame(frame)
  }
  function finish() {
    cancelAnimationFrame(raf)
    removeEventListener('resize', fit)
    removeEventListener('pointerdown', onTap, true)
    root.classList.add('fade')
    setTimeout(() => {
      canvas.width = canvas.height = 0 // hand the backing store back now (iOS keeps it otherwise)
      root.remove()
      active = false
    }, 450)
  }
  addEventListener('resize', fit)
  addEventListener('pointerdown', onTap, { capture: true, passive: true })
  raf = requestAnimationFrame(frame)
}
