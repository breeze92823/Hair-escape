// Touch controls for phones and tablets, the touch half of input.js: a floating
// move stick (touch the left part of the screen and it appears under the thumb),
// drag anywhere else to look, pinch to zoom, and Jump / Hair-cable buttons at the
// bottom right. Everything writes the shared inputState, so player.js, camera.js
// and main.js never know the input came from a finger. The HUD's interaction
// prompt is tappable, so it doubles as the interact button.
//
// The controls switch on for touch-first devices, or at the first touch on any
// other device, by adding `touch-ui` to <html>: the HUD keys its touch layout off
// that class and refits on the resize event fired with it.
import { TOUCH } from './config.js'
import { inputState } from './input.js'

const R = TOUCH.stickRadius
const CSS = `
.touch-ui canvas { touch-action: none; }
.touch-ui body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
#touch { position: fixed; inset: 0; pointer-events: none; z-index: 4; display: none; font-family: "Fredoka", sans-serif;
  --gap: 20px; --jump: clamp(64px, 18vmin, 96px); --cable: clamp(54px, 14vmin, 80px); --lift: var(--touch-lift, 0px); }
.touch-ui #touch { display: block; }
body.win-open #touch, body.salon-open #touch { display: none; }
/* Riding the hair: only the cable button (let go) stays live, the stick and Jump are locked. */
.riding #touch .stick, .riding #touch .jump, .flying #touch .stick, .flying #touch .jump { opacity: 0.25; pointer-events: none; }
/* Cable out: the button now lets go, so it lights up. */
.flying #touch .cable, .riding #touch .cable { background: rgba(255,194,26,0.45); }
#touch .stick { position: absolute; width: ${R * 2}px; height: ${R * 2}px; margin: -${R}px 0 0 -${R}px; border-radius: 50%;
  background: rgba(255,255,255,0.12); border: 3px solid rgba(255,255,255,0.5); box-shadow: 0 2px 8px rgba(0,0,0,0.25); }
#touch .stick.rest { left: calc(24px + ${R}px + env(safe-area-inset-left, 0px)); top: calc(100% - 24px - ${R}px - env(safe-area-inset-bottom, 0px) - var(--lift)); opacity: 0.45; }
#touch .knob { position: absolute; left: 50%; top: 50%; width: 46%; height: 46%; margin: -23% 0 0 -23%; border-radius: 50%; background: rgba(255,255,255,0.85); box-shadow: 0 2px 6px rgba(0,0,0,0.35); }
#touch .act { position: absolute; pointer-events: auto; touch-action: none; -webkit-tap-highlight-color: transparent; border-radius: 50%; padding: 0;
  right: calc(24px + env(safe-area-inset-right, 0px)); display: grid; place-items: center;
  background: rgba(20,20,28,0.4); border: 3px solid rgba(255,255,255,0.75); box-shadow: 0 3px 10px rgba(0,0,0,0.3); transition: transform .08s, background .08s; }
#touch .act.down { transform: scale(0.92); background: rgba(255,255,255,0.35); }
#touch .act svg { width: 58%; height: 58%; filter: drop-shadow(0 2px 0 rgba(0,0,0,0.35)); }
#touch .jump { width: var(--jump); height: var(--jump); bottom: calc(var(--gap) + env(safe-area-inset-bottom, 0px) + var(--lift)); }
#touch .cable { width: var(--cable); height: var(--cable); margin-right: calc((var(--jump) - var(--cable)) / 2);
  bottom: calc(var(--gap) * 1.6 + var(--jump) + env(safe-area-inset-bottom, 0px) + var(--lift)); }
`
const JUMP_ICON = `<svg viewBox="0 0 32 32"><path d="M16 5 5 17h7v10h8V17h7z" fill="#fff" stroke="#15152a" stroke-width="2" stroke-linejoin="round"/></svg>`
// The golden lock of hair (the HUD's currency icon): the cable is the player's hair.
const CABLE_ICON = `<svg viewBox="0 0 48 48"><path d="M31 3c-10-1-19 4-19 12 0 7 7 10 12 13 4 2 6 5 3 8-3 2-8 2-12-1 1 6 8 9 14 8 8-2 11-8 9-14-2-5-8-8-12-10-4-2-4-5-1-7 3-2 8-1 12 1 1-5-2-9-6-10z" fill="#ffc21a" stroke="#5a3200" stroke-width="2.6" stroke-linejoin="round"/></svg>`

let enabled = false
const stick = { id: null, x: 0, y: 0, el: null, knob: null }
const looks = new Map() // pointerId -> last { x, y } of each look finger
let pinchDist = 0

const fingerGap = () => {
  const [a, b] = looks.values()
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function releaseStick() {
  stick.id = null
  inputState.move.x = inputState.move.z = 0
  stick.el.classList.add('rest')
  stick.el.style.left = stick.el.style.top = ''
  stick.knob.style.transform = ''
}

function releaseAll() {
  if (stick.id !== null) releaseStick()
  looks.clear()
}

function moveStick(x, y) {
  const dx = x - stick.x
  const dy = y - stick.y
  const len = Math.hypot(dx, dy)
  const reach = Math.min(len, R)
  const kx = len > 0 ? (dx / len) * reach : 0
  const ky = len > 0 ? (dy / len) * reach : 0
  stick.knob.style.transform = `translate(${kx}px, ${ky}px)`
  // Past the dead zone the push ramps 0..1, so a light thumb walks and a full one runs.
  const push = Math.max(0, (reach / R - TOUCH.deadZone) / (1 - TOUCH.deadZone))
  inputState.move.x = len > 0 ? (dx / len) * push : 0
  inputState.move.z = len > 0 ? (-dy / len) * push : 0
}

// A held button: `press` runs on touch down (edge-triggered like the keys).
function actionButton(cls, icon, title, press) {
  const b = document.createElement('button')
  b.className = `act ${cls}`
  b.title = title
  b.innerHTML = icon
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    b.classList.add('down')
    press()
  })
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(type, () => b.classList.remove('down'))
  return b
}

function enable() {
  if (enabled) return
  enabled = true
  document.documentElement.classList.add('touch-ui')
  window.dispatchEvent(new Event('resize')) // the HUD refits for the touch layout
}

export function install(canvas) {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.id = 'touch'
  stick.el = document.createElement('div')
  stick.el.className = 'stick rest'
  stick.knob = document.createElement('div')
  stick.knob.className = 'knob'
  stick.el.appendChild(stick.knob)
  root.append(
    stick.el,
    actionButton('jump', JUMP_ICON, 'Jump', () => (inputState.jump = true)),
    actionButton('cable', CABLE_ICON, 'Hair cable', () => (inputState.grapple = true)),
  )
  document.body.appendChild(root)

  if (window.matchMedia('(pointer: coarse)').matches) enable()

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return
    enable()
    if (document.body.classList.contains('win-open') || document.body.classList.contains('salon-open')) return // a window or the Hair Salon is open: the world is paused for input
    canvas.setPointerCapture?.(e.pointerId)
    // While the tip flies every finger steers it: the stick is locked, so the left side must not swallow the drag.
    const flying = document.documentElement.classList.contains('flying')
    if (stick.id === null && !flying && e.clientX < window.innerWidth * TOUCH.stickZone) {
      stick.id = e.pointerId
      stick.x = e.clientX
      stick.y = e.clientY
      stick.el.classList.remove('rest')
      stick.el.style.left = `${e.clientX}px`
      stick.el.style.top = `${e.clientY}px`
      moveStick(e.clientX, e.clientY)
    } else {
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY })
      inputState.steer = true
      if (looks.size === 2) pinchDist = fingerGap()
    }
  })
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') return
    if (e.pointerId === stick.id) return moveStick(e.clientX, e.clientY)
    const p = looks.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    if (looks.size >= 2) {
      // Two look fingers pinch: apart zooms in, like the wheel rolled toward you.
      const d = fingerGap()
      inputState.zoom -= (d - pinchDist) * TOUCH.pinchZoom
      pinchDist = d
    } else {
      inputState.look.dx += dx * TOUCH.lookScale
      inputState.look.dy += dy * TOUCH.lookScale
    }
  })
  const end = (e) => {
    if (e.pointerType !== 'touch') return
    if (e.pointerId === stick.id) releaseStick()
    if (looks.delete(e.pointerId) && looks.size === 2) pinchDist = fingerGap()
    if (looks.size === 0) inputState.steer = false
  }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)

  // A window or the salon opening (or the tab losing focus) mid-drag must not leave the player walking.
  const paused = () => document.body.classList.contains('win-open') || document.body.classList.contains('salon-open')
  new MutationObserver(() => paused() && releaseAll()).observe(document.body, { attributes: true, attributeFilter: ['class'] })
  window.addEventListener('blur', releaseAll)
}
