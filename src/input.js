// WASD/arrows move (camera-relative, consumed by player.js), right-drag look +
// wheel zoom (consumed by camera.js), edge-triggered jump on Shift (cleared by
// player.js) and hair cable on Space (cleared by main.js).
export const inputState = {
  move: { x: 0, z: 0 }, // x = strafe (+ right), z = forward (+ forward)
  look: { dx: 0, dy: 0 }, // raw pixels since the camera last read them
  zoom: 0, // wheel notches since the camera last read them (+ = away)
  jump: false,
  grapple: false, // Space: shoot the hair cable / let go of it
  stopTip: false, // left click: pin the flying tip where it is, even in mid-air
  interact: false, // E: edge-triggered, cleared by the interaction system in main.js
}

// One wheel notch per WheelEvent.deltaMode (pixels, lines, pages), so a trackpad
// and a mouse zoom at the same rate.
const NOTCH_PER_DELTA = [1 / 100, 1 / 3, 1]

const held = new Set()
let orbiting = false // right-drag fallback where pointer lock is refused
let canvas = null
let lockEverGranted = false
let armed = false

const locked = () => !!canvas && document.pointerLockElement === canvas
// Pointer lock can reject (sandboxed frame, post-Escape cooldown); that is not a fault.
// The Hair Salon (body.salon-open) keeps the cursor: its 3D view is dragged and its menus clicked.
function requestLock() {
  if (!canvas || locked() || document.body.classList.contains('salon-open')) return
  const r = canvas.requestPointerLock?.()
  if (r instanceof Promise) r.catch(() => {})
}

function recomputeMove() {
  let x = 0
  let z = 0
  if (held.has('KeyW') || held.has('ArrowUp')) z += 1
  if (held.has('KeyS') || held.has('ArrowDown')) z -= 1
  if (held.has('KeyD') || held.has('ArrowRight')) x += 1
  if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1
  inputState.move.x = x
  inputState.move.z = z
}

// Re-read the held keys (main.js zeroes `move` while the hair tip flies, so keys still down need restoring).
export const refreshMove = recomputeMove

export function install(showMenu, canvasEl) {
  canvas = canvasEl
  document.addEventListener('pointerlockchange', () => {
    if (locked()) {
      lockEverGranted = true
      orbiting = false
    } else {
      held.clear() // cursor is back: nothing is held
      inputState.move.x = inputState.move.z = 0
    }
  })
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return
    if (e.code === 'Escape') showMenu()
    else if (!armed) {
      armed = true // the first keypress is a user gesture: take the mouse without a click
      requestLock()
    }
    held.add(e.code)
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inputState.jump = true
    if (e.code === 'Space') {
      e.preventDefault() // no page scroll / button press
      inputState.grapple = true
    }
    if (e.code === 'KeyE') inputState.interact = true
    recomputeMove()
  })
  window.addEventListener('keyup', (e) => {
    held.delete(e.code)
    recomputeMove()
  })
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return // touch.js owns touch (stick, look, buttons)
    const onWorld = e.target.tagName === 'CANVAS'
    if (e.button === 2 && !lockEverGranted) orbiting = true
    if (e.button === 0) inputState.stopTip = true
    if (e.button === 0 && onWorld) {
      // A click on the world takes the cursor (resuming play after Escape).
      armed = true
      requestLock()
    }
  })
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') return
    if (e.button === 2) orbiting = false
  })
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return
    if (!orbiting && !locked()) return
    inputState.look.dx += e.movementX || 0
    inputState.look.dy += e.movementY || 0
  })
  // Only the game world zooms: a wheel aimed at a HUD panel must not also move the camera.
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.target.tagName !== 'CANVAS') return
      e.preventDefault()
      if (document.body.classList.contains('win-open')) return // a window is open: no camera zoom
      inputState.zoom += e.deltaY * (NOTCH_PER_DELTA[e.deltaMode] ?? NOTCH_PER_DELTA[0])
    },
    { passive: false },
  )
  window.addEventListener('contextmenu', (e) => e.preventDefault())
  window.addEventListener('blur', () => {
    held.clear()
    orbiting = false
    inputState.jump = false
    inputState.grapple = false
    recomputeMove()
  })
}
