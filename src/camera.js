import { inputState } from './input.js'
import { player, floorAt } from './player.js'
import { segmentClear } from './colliders.js'
import { CAMERA, PHYSICS } from './config.js'

// Third-person chase camera, ported from +1 Cut Grass Adventure. It owns its own
// yaw/pitch (right-drag) and orbits the player, so the movement keys never steer
// the view. ONE smoothing stage, on the point it follows: position and look-at
// both derive from it, so they cannot disagree (separate rates read as jitter).
// The wheel sets a zoom target that glides; speed pulls the boom back and widens
// the FOV; solid props pull the boom in until clear.
const state = { yaw: 0, pitch: CAMERA.startPitch }
const FLOOR_MARGIN = 0.3 // m the camera stays above the surface under it
const TELEPORT_DISTANCE = 15 // a same-frame jump bigger than this is a respawn: snap

// Driven by the Bloxity `camera_sensitivity` setting.
let sensitivity = 1
export function setCameraSensitivity(value) {
  sensitivity = value
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

// A zone asks for its framing: the pitch eases there (until the player drags
// the view), the zoom glides to the distance, and the look-at point eases
// `ahead` m in front of the player (dropping them lower in the frame).
let pitchGoal = null
let aheadGoal = 0
let ahead = 0
export function setFraming(pitch, distance, lookAhead = 0) {
  pitchGoal = pitch
  zoomTarget = clamp(distance, CAMERA.minDistance, CAMERA.maxDistance)
  aheadGoal = lookAhead
}

export function getYaw() {
  return state.yaw
}

// Snaps the orbit to sit directly behind the player.
export function syncYawToPlayer() {
  state.yaw = player.facing + Math.PI
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export function update(camera, dt) {
  state.yaw -= inputState.look.dx * CAMERA.lookSensitivity * sensitivity
  state.pitch += inputState.look.dy * CAMERA.lookSensitivity * sensitivity
  if (inputState.look.dx || inputState.look.dy) pitchGoal = null
  else if (pitchGoal !== null) {
    state.pitch += (pitchGoal - state.pitch) * (1 - Math.exp(-CAMERA.framingEase * dt))
    if (Math.abs(pitchGoal - state.pitch) < 0.002) pitchGoal = null
  }
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

  const distance = Math.max(1, zoomEased + CAMERA.speedDistance * rush)
  const fov = CAMERA.fov + CAMERA.speedFov * rush + fovExtra
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }

  ahead += (aheadGoal - ahead) * (1 - Math.exp(-CAMERA.framingEase * dt))
  look.x = followed.x - Math.sin(state.yaw) * ahead
  look.y = followed.y + player.dims.height * CAMERA.targetHeight
  look.z = followed.z - Math.cos(state.yaw) * ahead

  const cp = Math.cos(state.pitch)
  const px = look.x + Math.sin(state.yaw) * cp * distance
  const py = Math.max(look.y + Math.sin(state.pitch) * distance, floorAt() + FLOOR_MARGIN)
  const pz = look.z + Math.cos(state.yaw) * cp * distance

  // Never inside a solid: pull in to the first one between the player and the
  // camera at once, and ease back out once it is clear.
  const hit = segmentClear(look.x, look.y, look.z, px, py, pz, followed.y + PHYSICS.stepUp)
  const want = hit < 1 ? Math.max(0.08, hit - 0.06) : 1
  clearance = want < clearance ? want : clearance + (want - clearance) * (1 - Math.exp(-CAMERA.clearEase * dt))

  camera.position.set(
    look.x + (px - look.x) * clearance,
    look.y + (py - look.y) * clearance,
    look.z + (pz - look.z) * clearance,
  )
  camera.lookAt(look.x, look.y, look.z)
}
