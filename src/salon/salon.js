// The Hair Salon: what the HUD's Hair button opens. A separate dressing-room scene
// (room.js) where the player's own avatar (the Bloxity character with its hair, charms,
// aura and trail: main.js's avatar layer) stands on a pedestal while the overlay
// (salonUi.js) lists cuts, colours, charms, auras, trails and the hair length.
//
// Opening moves the avatar layer into the salon scene and main.js renders that scene
// with this module's camera instead of stepping the world; closing moves it back. The
// world is left exactly as it was (the player's position never changes).
//
// Camera: each tab has a framing (SALON.views) the camera glides to; < / > orbit,
// - / + zoom, VIEW hides the menus; dragging the 3D view orbits, the wheel / a pinch
// zooms. The projection is offset (setViewOffset) so the player sits in the middle of
// the screen area the panels leave free, and scaled to fit that area.
import { Vector3 } from 'three'
import { SALON, clamp } from '../config.js'
import { buildSalonRoom } from './room.js'
import { createSalonUi } from './salonUi.js'

const CAM = SALON.camera
const TAU = Math.PI * 2
const wrap = (a) => a - Math.round(a / TAU) * TAU // to -PI..PI
const FIT_MARGIN = 1.1 // the base framing spans this many times the free area's height
const NOTCH_PER_DELTA = [1 / 100, 1 / 3, 1] // wheel notches per WheelEvent.deltaMode (like input.js)
const ZOOM_MIN = 0.3 // user zoom factors on the tab's boom (the boom is also clamped to CAM's distances)
const ZOOM_MAX = 3

export function createSalon({ renderer, camera, layer, worldScene, toast, onToggle }) {
  let room = null // built on first open
  let active = false
  let switched = false // the avatar layer changed scenes this frame (the hair re-lays)

  // Orbit: user offsets on top of the tab's view; `cur` glides to `goal`.
  const user = { yaw: 0, pitch: 0, zoom: 1 }
  const cur = { yaw: 0, pitch: 0, distance: 6, tx: 0, ty: 1, tz: 0 }
  const view = { cx: 0, cy: 0, fullH: 1 } // eased projection window (screen px)
  const pos = new Vector3()

  const resetUser = () => {
    user.yaw = 0
    user.pitch = 0
    user.zoom = 1
  }
  const goal = () => {
    const v = SALON.views[ui.tab] ?? SALON.views.styles
    return {
      yaw: v.yaw + user.yaw,
      pitch: clamp(v.pitch + user.pitch, CAM.minPitch, CAM.maxPitch),
      distance: clamp(v.distance * user.zoom, CAM.minDistance, CAM.maxDistance),
      target: v.target,
    }
  }
  const snap = () => {
    const g = goal()
    Object.assign(cur, { yaw: g.yaw, pitch: g.pitch, distance: g.distance, tx: g.target[0], ty: g.target[1], tz: g.target[2] })
    Object.assign(view, windowGoal())
  }
  // The projection window that centres the look-at point in the free area and fits it.
  const windowGoal = () => {
    const f = ui.free
    return { cx: f.x + f.w / 2, cy: f.y + f.h / 2, fullH: f.h * FIT_MARGIN }
  }

  const ui = createSalonUi({
    toast,
    onClose: () => close(),
    onTab: () => resetUser(),
    onOrbit: (dir) => (user.yaw += dir * CAM.orbitStep),
    onZoom: (dir) => (user.zoom = clamp(user.zoom * (dir > 0 ? CAM.zoomStep : 1 / CAM.zoomStep), ZOOM_MIN, ZOOM_MAX)),
  })

  // --- Drag to orbit, wheel / pinch to zoom (only while open) --------------------
  const canvas = renderer.domElement
  const pointers = new Map() // pointerId -> { x, y }
  let pinch = 0
  const gap = () => {
    const [a, b] = pointers.values()
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (!active) return
    canvas.setPointerCapture?.(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) pinch = gap()
  })
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId)
    if (!active || !p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    if (pointers.size >= 2) {
      const d = gap()
      if (pinch > 0) user.zoom = clamp(user.zoom * (pinch / Math.max(d, 1)), ZOOM_MIN, ZOOM_MAX)
      pinch = d
    } else {
      user.yaw -= dx * CAM.dragYaw
      user.pitch += dy * CAM.dragPitch
    }
  })
  const lift = (e) => {
    pointers.delete(e.pointerId)
    if (pointers.size === 2) pinch = gap()
  }
  canvas.addEventListener('pointerup', lift)
  canvas.addEventListener('pointercancel', lift)
  canvas.addEventListener('wheel', (e) => {
    if (!active) return
    const notches = e.deltaY * (NOTCH_PER_DELTA[e.deltaMode] ?? NOTCH_PER_DELTA[0])
    user.zoom = clamp(user.zoom * Math.exp(notches * CAM.wheelZoom), ZOOM_MIN, ZOOM_MAX)
  }, { passive: true })

  function open(tab = 'styles') {
    if (active) return
    room ??= buildSalonRoom()
    active = true
    switched = true
    room.scene.add(layer)
    document.body.classList.add('salon-open')
    if (document.pointerLockElement) document.exitPointerLock?.()
    pointers.clear()
    resetUser()
    ui.open(tab)
    camera.fov = CAM.fov
    snap()
    onToggle?.(true)
  }

  function close() {
    if (!active) return
    active = false
    switched = true
    worldScene.add(layer)
    document.body.classList.remove('salon-open')
    pointers.clear()
    ui.close()
    camera.clearViewOffset() // camera.js restores the world FOV on its next frame
    onToggle?.(false)
  }

  return {
    open,
    close,
    get active() {
      return active
    },
    get scene() {
      return room?.scene
    },
    get spot() {
      return room.spot
    },
    facing: SALON.facing,
    get tab() {
      return ui.tab
    },
    // True once after the avatar layer changed scenes: the hair trail re-lays, the run trail clears.
    takeSwitch() {
      const s = switched
      switched = false
      return s
    },
    floorAt: (x, z) => room?.floorAt(x, z) ?? 0,
    // The floor hair coils round the pedestal (createHairRope's `curl`): straight back, then a widening spiral.
    curl: (s) => (s < SALON.coil.straight ? 0 : 1 / (SALON.coil.radius + SALON.coil.growth * (s - SALON.coil.straight))),
    refresh: () => ui.refresh(),

    update(dt) {
      const g = goal()
      const k = 1 - Math.exp(-CAM.ease * dt)
      cur.yaw += wrap(g.yaw - cur.yaw) * k
      cur.pitch += (g.pitch - cur.pitch) * k
      cur.distance += (g.distance - cur.distance) * k
      cur.tx += (g.target[0] - cur.tx) * k
      cur.ty += (g.target[1] - cur.ty) * k
      cur.tz += (g.target[2] - cur.tz) * k

      const cp = Math.cos(cur.pitch)
      pos.set(cur.tx + Math.sin(cur.yaw) * cp * cur.distance, cur.ty + Math.sin(cur.pitch) * cur.distance, cur.tz + Math.cos(cur.yaw) * cp * cur.distance)
      room.clampInside(pos, CAM.wallMargin)
      camera.position.copy(pos)
      camera.lookAt(cur.tx, cur.ty, cur.tz)
      if (Math.abs(camera.fov - CAM.fov) > 0.01) camera.fov = CAM.fov

      // Centre and fit the look-at point in the free screen area (eases when VIEW or a resize changes it).
      const w = window.innerWidth
      const h = window.innerHeight
      const wg = windowGoal()
      view.cx += (wg.cx - view.cx) * k
      view.cy += (wg.cy - view.cy) * k
      view.fullH += (wg.fullH - view.fullH) * k
      const fullH = Math.max(1, view.fullH)
      const fullW = fullH * (w / h)
      camera.setViewOffset(fullW, fullH, fullW / 2 - view.cx, fullH / 2 - view.cy, w, h)
    },
  }
}
