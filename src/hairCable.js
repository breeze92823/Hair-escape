// The hair cable: Space shoots the player's hair tip out of the head. While it
// flies, the player steers it like a camera: the look input (pointer-lock mouse,
// right-drag, a touch drag on the look area) and WASD/arrows turn its aim at once,
// the camera turns with the aim and the tip curves onto it a moment later, so the
// view always looks where the tip is heading next. No gravity. It keeps going
// until it sticks to the first surface it meets (box face or ground) or has used the whole reach, in which case it goes limp and reels back in. Anchored,
// the player grabs it overhead with both hands and travels the path the tip took to
// the anchor; the rope always runs from their head forward, the part behind them
// re-absorbed as they advance. Space again mid-flight or mid-ride lets go.
//
// States: idle -> flying -> riding -> idle, plus retracting (let go early or missed:
// the remaining path reels back into the head). The flown path is recorded as it
// goes; createHairRope draws it (pathPoints) in the ridged-tube hair style.
import { Vector3 } from 'three'
import { GRAPPLE, clamp } from './config.js'
import { raycast } from './colliders.js'
import { hairState } from './avatar/hair.js'
import { getYaw, getCameraSensitivity, setCameraFocus, clearCameraFocus } from './camera.js'
import { inputState } from './input.js'

// Metres the hair can stretch: grows with the hanging length and the floor trail.
// Past the length and trail caps (about 46k hair) the reach keeps growing with the hair stat itself.
export const cableReach = () =>
  clamp(Math.max(GRAPPLE.baseReach + hairState.grownLength * GRAPPLE.reachPerLength + hairState.grownTrail, GRAPPLE.hairReachScale * Math.sqrt(hairState.grownHair)), GRAPPLE.baseReach, GRAPPLE.maxReach)

const MAX_PTS = Math.ceil(GRAPPLE.maxReach / GRAPPLE.segment) + 2
const MIN_RIDE = 2 // m of path below which an anchor is too close to ride

export function createHairCable() {
  let state = 'idle'
  const points = Array.from({ length: MAX_PTS }, () => new Vector3())
  const cum = new Float32Array(MAX_PTS) // arc length from the root to each point
  let count = 0 // the last point is the live tip while flying
  let total = 0 // path length so far (flying) or in full (riding), m
  let reach = 0 // m of hair available for this shot
  let tailEnd = 0 // m of path still out while retracting (reels back toward s)
  let s = 0 // the hands' arc-length progress while riding
  let speed = 0
  let landY = 0 // lowest the body may hang: launch feet or the anchor, whichever is lower
  let lag = 0 // s the body has been held far behind its target (stuck guard)
  let clock = 0 // s, drives the flying strand's ripple
  let tipYaw = 0 // rad, facing convention (atan2(x, z))
  let tipPitch = 0 // rad above the horizon
  let aimYaw = 0 // rad, where the drag wants the tip to head
  let aimPitch = 0 // rad
  let keyTurn = 0 // -1..1, A/D (+ = right) this frame, from steerKeys
  let keyTilt = 0 // -1..1, W/S (+ = up)
  let anchorBox = null // the collider the tip stuck to (null: ground or nothing)
  let anchorFloor = -Infinity // y of an upward-facing surface the tip stuck to: the feet never hang below it, so the landing is on top, not inside
  let anchored = false // the tip hit a surface (box or ground), as opposed to running out of hair
  let playerRef = null
  let hairRef = null
  const root = new Vector3() // where the strand leaves the head, updated every frame
  const tip = new Vector3()
  const dir = new Vector3()
  const hands = new Vector3()
  const tangent = new Vector3()
  const a = new Vector3()
  const b = new Vector3()
  // speedMult: times the zip speeds (the Zippy Hair upgrade, set by main.js).
  const api = { active: false, zipping: false, speedMult: 1, get flying() { return state === 'flying' }, pitch: 0, fire, stopTip, release, update, steerKeys, pathPoints, remaining, fullLength: () => reach, rideSpeed: () => (state === 'riding' ? speed / (GRAPPLE.zipSpeed * api.speedMult) : 0) }
  // Read-only views for the foley (cableSfx.js) and the tutorial's coaching (tutorial.js): the state,
  // the live tip position (do not mutate), whether the tip struck a surface, m of hair still out ahead
  // of the hands, and rad the flying tip is still turning toward its aim.
  Object.defineProperties(api, {
    state: { get: () => state },
    tip: { get: () => tip },
    anchored: { get: () => anchored },
    outLength: { get: () => (state === 'retracting' ? tailEnd : total) - s },
    tipTurn: { get: () => Math.abs(aimYaw - tipYaw) + Math.abs(aimPitch - tipPitch) },
  })

  // Fraction (0..1) of the hair still unused, for the HUD bar: it drains as the tip
  // flies and the rest drains as the player rides to the anchor. null while the
  // cable is not out (idle / retracting).
  function remaining() {
    if (state === 'flying') return 1 - total / reach
    if (state === 'riding') return (1 - total / reach) * (1 - s / Math.max(total, 1e-3))
    return null
  }

  // Move the live tip (the last point) to `tip`, `len` m along the path; a new
  // point is committed whenever the tip is a full segment past the previous one.
  function advanceTip(len) {
    if (len - cum[count - 2] >= GRAPPLE.segment && count < MAX_PTS) {
      points[count].copy(points[count - 1])
      cum[count] = cum[count - 1]
      count++
    }
    points[count - 1].copy(tip)
    cum[count - 1] = len
    total = len
  }

  // The movement keys this frame (main.js passes them while the tip flies): x turns, z tilts.
  function steerKeys(x, z) {
    keyTurn = x
    keyTilt = z
  }

  // One frame of flight: steer the aim, glide the heading onto it, then sweep the
  // tip forward and stick it to the first surface in the way.
  function fly(dt, player) {
    // The look input turns the aim like it turns the camera (same direction, same
    // sensitivity setting); it is used up here, the camera follows the aim instead.
    const look = inputState.look
    const k = GRAPPLE.steerSensitivity * getCameraSensitivity()
    aimYaw -= look.dx * k + keyTurn * GRAPPLE.keyTurnRate * dt
    aimPitch = clamp(aimPitch - look.dy * k + keyTilt * GRAPPLE.keyPitchRate * dt, -GRAPPLE.maxTipPitch, GRAPPLE.maxTipPitch)
    look.dx = 0
    look.dy = 0
    keyTurn = keyTilt = 0
    // The heading glides onto the aim (no gravity, no turn cap) so a flick bends the strand instead of snapping it.
    const ease = 1 - Math.exp(-GRAPPLE.steerEase * dt)
    tipYaw += (aimYaw - tipYaw) * ease
    tipPitch += (aimPitch - tipPitch) * ease
    const cp = Math.cos(tipPitch)
    dir.set(Math.sin(tipYaw) * cp, Math.sin(tipPitch), Math.cos(tipYaw) * cp)

    const d = Math.min(GRAPPLE.tipSpeed * dt, reach - total)
    const hit = d > 1e-6 ? raycast(tip.x, tip.y, tip.z, dir.x, dir.y, dir.z, d) : null
    if (hit) {
      tip.set(hit.x + hit.nx * GRAPPLE.anchorOffset, hit.y + hit.ny * GRAPPLE.anchorOffset, hit.z + hit.nz * GRAPPLE.anchorOffset)
      advanceTip(total + hit.dist)
      anchorBox = hit.box
      anchorFloor = hit.ny > 0.5 ? hit.y - GRAPPLE.anchorOffset * hit.ny : -Infinity
      anchored = true
      if (total >= MIN_RIDE) startRide(player)
      else release()
      return
    }
    tip.addScaledVector(dir, d)
    advanceTip(total + d)
    if (total >= reach - 1e-4) {
      // Out of hair with nothing to hold: the player still rides it out and lets go off the free end.
      if (total >= MIN_RIDE) startRide(player)
      else release()
      return
    }
    const lead = GRAPPLE.camLead
    setCameraFocus(tip.x + dir.x * lead, tip.y + dir.y * lead, tip.z + dir.z * lead, aimYaw, aimPitch)
  }

  // Point (and optionally the forward tangent) of the curve at arc length `t`.
  function sample(t, out, tan = null) {
    t = clamp(t, 0, total)
    let i = 1
    while (i < count - 1 && cum[i] < t) i++
    const span = cum[i] - cum[i - 1] || 1
    const f = (t - cum[i - 1]) / span
    out.copy(points[i - 1]).lerp(points[i], f)
    if (tan) tan.subVectors(points[i], points[i - 1]).divideScalar(span)
  }

  // Space. Idle: shoot the tip toward where the camera looks ("player targets camera").
  // Flying / riding: let go.
  function fire() {
    if (!playerRef || !hairRef) return
    if (state === 'flying' || state === 'riding') {
      release()
      return
    }
    if (state !== 'idle') return
    playerRef.facing = getYaw() + Math.PI // square up with the camera
    landY = playerRef.position.y
    reach = cableReach()
    tipYaw = aimYaw = playerRef.facing
    tipPitch = aimPitch = GRAPPLE.launchPitch
    tip.copy(root)
    points[0].copy(root)
    points[1].copy(root)
    cum[0] = cum[1] = 0
    count = 2
    total = 0
    s = 0
    anchorBox = null
    anchorFloor = -Infinity
    anchored = false
    state = 'flying'
  }

  // Left click while the tip flies: pin it where it is (mid-air is fine) and ride to that point.
  function stopTip(player) {
    if (state !== 'flying') return
    anchorBox = null
    anchorFloor = -Infinity
    anchored = true
    if (total >= MIN_RIDE) startRide(player)
    else release()
  }

  // Let go. `instant` (respawn, avatar swap) drops the cable at once instead of reeling it in.
  function release(instant = false) {
    if (playerRef) playerRef.zipping = false
    api.zipping = false
    api.pitch = 0
    clearCameraFocus()
    if (instant || state === 'idle') {
      state = 'idle'
      return
    }
    if (state === 'flying') s = 0
    tailEnd = total
    state = 'retracting'
  }

  function startRide(player) {
    clearCameraFocus()
    state = 'riding'
    api.zipping = true
    player.zipping = true
    s = 0
    speed = GRAPPLE.zipStartSpeed * api.speedMult
    lag = 0
    landY = Math.min(landY, tip.y)
  }

  function ride(dt, player) {
    if (anchorBox?.off) {
      release() // what the tip stuck to is gone
      return
    }
    const top = GRAPPLE.zipSpeed * api.speedMult // m/s
    speed = Math.min(top, speed + GRAPPLE.zipAccel * api.speedMult * dt)
    s = Math.min(s + speed * dt, total)
    sample(s, hands, tangent)
    // Face and pitch along the cable; the body hangs below the hands.
    const flat = Math.hypot(tangent.x, tangent.z)
    if (flat > 0.2) player.facing = Math.atan2(tangent.x, tangent.z)
    api.pitch = Math.atan2(tangent.y, Math.max(flat, 1e-3))
    a.set(hands.x, Math.max(hands.y - GRAPPLE.hangDrop, landY, anchorFloor), hands.z)
    b.set(a.x - player.position.x, a.y - player.position.y, a.z - player.position.z)
    const dist = b.length()
    if (s >= total) {
      if (!anchorBox && !anchored) {
        // Free end, nothing attached: let go and carry on through the air along the cable.
        player.velocity.x = tangent.x * top
        player.velocity.y = tangent.y * top
        player.velocity.z = tangent.z * top
        release()
        return
      }
      // The far end: a small hop off so a ledge the hair draped onto is climbed.
      player.velocity.x = (flat > 1e-3 ? tangent.x / flat : 0) * GRAPPLE.vaultForward
      player.velocity.y = GRAPPLE.vaultUp
      player.velocity.z = (flat > 1e-3 ? tangent.z / flat : 0) * GRAPPLE.vaultForward
      release()
      return
    }
    // Chase the point under the hands; walls (pushOut) can hold the body back.
    const cap = top * 2
    const k = Math.min(1 / Math.max(dt, 1e-3), cap / Math.max(dist, 1e-6))
    player.velocity.x = b.x * k
    player.velocity.y = b.y * k
    player.velocity.z = b.z * k
    lag = dist > 2.5 ? lag + dt : 0
    if (lag > GRAPPLE.stuckTime) release()
  }

  function update(dt, { hair, player }) {
    playerRef = player
    hairRef = hair
    if (!hair) {
      release(true)
      api.active = false
      return
    }
    hair.rootWorld(root)
    clock += dt
    switch (state) {
      case 'flying':
        fly(dt, player)
        break
      case 'riding':
        ride(dt, player)
        break
      case 'retracting':
        tailEnd -= GRAPPLE.retractSpeed * dt
        if (tailEnd <= s + 0.5) state = 'idle'
        break
    }
    api.active = state !== 'idle'
  }

  // Writes the visible rope path (head first) into `out[offset..]`; returns how
  // many points it wrote. While riding, only the path ahead of the hands is left;
  // while flying, the inner points ripple sideways behind the tip.
  function pathPoints(out, offset) {
    if (state === 'idle' || count < 2) return 0
    const from = state === 'flying' ? 0 : s + 0.4 // ahead of the player's head
    const to = state === 'retracting' ? tailEnd : total
    if (to - from < 0.3) return 0
    let n = 0
    const put = (p) => {
      if (offset + n < out.length) out[offset + n++].copy(p)
    }
    put(root)
    sample(from, a)
    if (a.distanceToSquared(root) > 0.09) put(a)
    // A long cable stores more points than the rope can draw: keep every stride-th one, never dropping the tip.
    const stride = Math.max(1, Math.ceil(count / Math.max(1, out.length - offset - 4)))
    for (let i = 1; i < count; i++) {
      if (cum[i] <= from + 0.2) continue
      if (cum[i] >= to) break
      if (i % stride) continue
      put(points[i])
      if (state === 'flying' && offset + n - 1 < out.length) {
        const w = GRAPPLE.flySway * Math.sin((Math.PI * cum[i]) / to) * Math.sin(GRAPPLE.flySwayFreq * clock - cum[i])
        out[offset + n - 1].x += Math.cos(tipYaw) * w // sideways to the tip's heading
        out[offset + n - 1].z -= Math.sin(tipYaw) * w
      }
    }
    sample(to, b)
    put(b)
    return n >= 2 ? n : 0
  }

  return api
}
