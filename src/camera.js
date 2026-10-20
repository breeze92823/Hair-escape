import { inputState } from './input.js'
import { player, floorAt } from './player.js'
import { segmentClear } from './colliders.js'
import { CAMERA, GRAPPLE, PHYSICS } from './config.js'

// Third-person chase camera, ported from +1 Cut Grass Adventure. It owns its own
// yaw/pitch (right-drag) and orbits the player, so the movement keys never steer
// the view. ONE smoothing stage, on the point it follows: position and look-at
// both derive from it, so they cannot disagree (separate rates read as jitter).
// The wheel sets a zoom target that glides; speed pulls the boom back and widens
// the FOV; solid props pull the boom in until clear. While the hair cable's tip
// is flying, the look-at point eases onto the tip and the orbit swings round
// behind its heading (setCameraFocus), then eases back to the player.
const state = { yaw: 0, pitch: CAMERA.startPitch }
const FLOOR_MARGIN = 0.3 // m the camera stays above the surface under it
const TELEPORT_DISTANCE = 15 // a same-frame jump bigger than this is a respawn: snap

// Driven by the Bloxity `camera_sensitivity` setting.
let sensitivity = 1
export function setCameraSensitivity(value) {
  sensitivity = value
}

// Camera shake amplitude (m) from other systems (the cable-ride speed rush).
let shake = 0
let shakeTime = 0
export function setCameraShake(metres) {
  shake = metres
}

// Extra FOV (degrees) from other systems (e.g. a power-up punch).
let fovExtra = 0
export function setFovExtra(degrees) {
  fovExtra = degrees
}

const followed = { x: 0, y: 0, z: 0 } // smoothed feet position
const lastPlayerPos = { x: 0, y: 0, z: 0 }
const look = { x: 0, y: 0, z: 0 }
let initialised = false
let zoomTarget = CAMERA.distance // what the wheel asked for
let zoomEased = CAMERA.distance
let rush = 0 // eased 0..1 speed factor
let clearance = 1 // 0..1 of the boom the walls allow, eased back out
const focus = { on: false, x: 0, y: 0, z: 0, yaw: 0 } // a point to watch instead of the player
let focusMix = 0 // eased 0..1 from the player to the focus point

export function getYaw() {
  return state.yaw
}

// Snaps the orbit to sit directly behind the player.
export function syncYawToPlayer() {
  state.yaw = player.facing + Math.PI
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

// Watch a world point (the flying hair tip) heading along `yaw` (rad, facing convention).
export function setCameraFocus(x, y, z, yaw) {
  focus.on = true
  focus.x = x
  focus.y = y
  focus.z = z
  focus.yaw = yaw
}

export function clearCameraFocus() {
  focus.on = false
}

export function update(camera, dt) {
  state.yaw -= inputState.look.dx * CAMERA.lookSensitivity * sensitivity
  state.pitch += inputState.look.dy * CAMERA.lookSensitivity * sensitivity
  inputState.look.dx = 0
  inputState.look.dy = 0
  state.pitch = clamp(state.pitch, CAMERA.minPitch, CAMERA.maxPitch)

  zoomTarget = clamp(zoomTarget + inputState.zoom * CAMERA.zoomStep, CAMERA.minDistance, CAMERA.maxDistance)
  inputState.zoom = 0

  const p = player.position
  const jump = Math.hypot(p.x - lastPlayerPos.x, p.y - lastPlayerPos.y, p.z - lastPlayerPos.z)
  const teleported = initialised && jump > TELEPORT_DISTANCE
  lastPlayerPos.x = p.x
  lastPlayerPos.y = p.y
  lastPlayerPos.z = p.z
  if (teleported) {
    state.yaw = player.facing + Math.PI
    state.pitch = CAMERA.startPitch
  }

  if (!initialised || teleported) {
    followed.x = p.x
    followed.y = p.y
    followed.z = p.z
    clearance = 1
    initialised = true
  } else {
    const t = dt > 0 ? 1 - Math.exp(-CAMERA.followLerp * dt) : 1
    followed.x += (p.x - followed.x) * t
    followed.y += (p.y - followed.y) * t
    followed.z += (p.z - followed.z) * t
  }

  // Speed framing: pulling back has to lag the speed change or every stop punches the camera in.
  const speed = Math.hypot(player.velocity.x, player.velocity.z)
  const targetRush = clamp(speed / player.moveSpeed, 0, 1)
  rush += (targetRush - rush) * (1 - Math.exp(-CAMERA.speedEase * dt))
  zoomEased += (zoomTarget - zoomEased) * (1 - Math.exp(-CAMERA.zoomEase * dt))

  const baseDistance = zoomEased + CAMERA.speedDistance * rush
  const distance = Math.max(1, baseDistance + (Math.min(baseDistance, GRAPPLE.camDistance) - baseDistance) * focusMix) // closer to the tip
  const fov = CAMERA.fov + CAMERA.speedFov * rush + fovExtra
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }

  look.x = followed.x
  look.y = followed.y + player.dims.height * CAMERA.targetHeight
  look.z = followed.z

  // Hair-tip follow: blend the look-at point onto the tip and swing behind its heading.
  const mixRate = focus.on ? GRAPPLE.camFollowLerp : GRAPPLE.camReturnLerp
  focusMix += ((focus.on ? 1 : 0) - focusMix) * (1 - Math.exp(-mixRate * dt))
  if (teleported) focusMix = 0
  if (focusMix > 1e-3) {
    look.x += (focus.x - look.x) * focusMix
    look.y += (focus.y - look.y) * focusMix
    look.z += (focus.z - look.z) * focusMix
  }
  if (focus.on) {
    let d = focus.yaw + Math.PI - state.yaw
    d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2 // shortest way round
    state.yaw += d * (1 - Math.exp(-GRAPPLE.camYawLerp * dt))
    if (state.pitch < GRAPPLE.camPitch) state.pitch += (GRAPPLE.camPitch - state.pitch) * (1 - Math.exp(-GRAPPLE.camYawLerp * dt))
  }

  const cp = Math.cos(state.pitch)
  const px = look.x + Math.sin(state.yaw) * cp * distance
  const py = Math.max(look.y + Math.sin(state.pitch) * distance, floorAt() + FLOOR_MARGIN)
  const pz = look.z + Math.cos(state.yaw) * cp * distance

  // Never inside a solid: pull in to the first one between the player and the
  // camera at once, and ease back out once it is clear.
  const hit = segmentClear(look.x, look.y, look.z, px, py, pz, Math.min(followed.y, look.y) + PHYSICS.stepUp)
  const want = hit < 1 ? Math.max(0.08, hit - 0.06) : 1
  clearance = want < clearance ? want : clearance + (want - clearance) * (1 - Math.exp(-CAMERA.clearEase * dt))

  camera.position.set(
    look.x + (px - look.x) * clearance,
    look.y + (py - look.y) * clearance,
    look.z + (pz - look.z) * clearance,
  )
  if (shake > 0) {
    // Incommensurate sines: a jitter that never visibly loops, no random allocations.
    shakeTime += dt
    camera.position.x += Math.sin(shakeTime * 47) * shake
    camera.position.y += Math.sin(shakeTime * 61 + 1.3) * shake
    camera.position.z += Math.sin(shakeTime * 53 + 2.1) * shake
  }
  camera.lookAt(look.x, look.y, look.z)
}
