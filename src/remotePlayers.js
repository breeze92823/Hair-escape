// The other players in the room (net.js -> server WorldState.players): each one is the game's
// character with their Bloxity cosmetics, an animated hair strand in their hair style's colour whose
// length follows their hair, and a name tag, eased toward the pose the server last relayed. Diffed
// against the roster every frame, so joins/leaves need no events.
//
// Their salon look and hair cable show too, kept cheap for a crowd on a phone:
//  - the strand is one small tube mesh stepped at a reduced rate (see RemoteHair). While their hair
//    cable is out it becomes the cable: a run from the head to the relayed far end (rippling while
//    the tip flies, drooping as it reels in), and they hang from it while they zip;
//  - charms and aura rings ride that strand (avatar/adornments.js, shared charm meshes, scaled to it),
//    the run trail streams behind them (avatar/trail.js, one shared material) and a glow lights them
//    while they zip (speedFx.js). All three are made only when worn and drawn only within
//    NET.cosmeticsDist.
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { GRAPPLE, MATERIAL_PBR, NET, PHYSICS, SPEED_FX, clamp } from './config.js'
import { CABLE_CODE, net } from './net.js'
import { Label } from './lobby/labels.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { createAdornments } from './avatar/adornments.js'
import { TRAIL_MIN_SPEED, createTrail } from './avatar/trail.js'
import { createGlowSprite } from './speedFx.js'
import { HAIR_STYLES } from './game/state.js'
import { CUTS, DEFAULT_CUT } from './game/cosmetics.js'

const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

// Remote hair: ONE tube mesh per player (up to RINGS x SIDES vertices, one draw call, a shared
// material per colour) swept along a short path. Hanging, the path is a follow-the-leader pendulum:
// each joint eases toward the one above it, so the tip lags, streams out with speed and swings on
// turns. It is stepped at a reduced rate (NET.hairNearHz close up, NET.hairFarHz far away) with the
// accumulated dt, so a crowd costs a few dozen joint updates per frame and no allocations. The cut's
// width / wave shape it.
const STRAND = { rootY: 1.55, backZ: -0.18, radius: 0.13, depth: 0.6, minLength: 0.5, maxLength: 3.2, perDecade: 0.75 } // m; depth = front-to-back flattening
const FLOOR_Y = -STRAND.rootY + STRAND.radius * STRAND.depth // the strand's lowest point, resting on the floor under the feet (m, strand space)
const SEGMENTS = 7 // joints of the hanging strand
const CABLE_SEGMENTS = 16 // runs of the shot-out cable
const RINGS = CABLE_SEGMENTS + 1 // most rings a strand sweeps
const SIDES = 6
const SWAY = { lean: 1.1, follow: 9, lag: 0.72, turn: 0.07, maxTurn: 0.6, idle: 0.05, idleHz: 1.6 } // lean = rad at full speed; follow = 1/s; lag = per-joint falloff of follow; turn = rad per rad/s of yaw; idle = rad
// The cable as others see it: only its far end is relayed, not the steered curve, so it runs straight.
const CABLE = { taper: 0.3, sag: 0.8, minLength: 0.4 } // taper = fraction thinner at the far end; sag = m a reeling-in cable droops mid-length; minLength = m below which the strand hangs instead
const HANG_TAPER = 0.55 // fraction thinner at the hanging tip
const CHARM_SCALE = 0.6 // charms and aura rings on the remote strand, which is thinner than the local rope
const GLOW_Y = 1 // m above the feet the zip glow sits
const TELEPORT = 8 // m a remote moves in one frame that re-lays its run trail instead of streaking it
const DEFAULT_COLOR = '#f5a321'

const strandMaterials = new Map() // colour -> shared material
function strandMaterial(color) {
  let m = strandMaterials.get(color)
  if (!m) strandMaterials.set(color, (m = new MeshStandardMaterial({ ...MATERIAL_PBR.PLAYER, color })))
  return m
}
// Hair count -> metres of strand: ~0.5 m at the start, a decade of hair adds perDecade.
const strandLength = (hair) => Math.min(STRAND.maxLength, STRAND.minLength + Math.max(0, Math.log10(Math.max(hair, 1) / 3)) * STRAND.perDecade)

const ringCos = Array.from({ length: SIDES }, (_, i) => Math.cos((i / SIDES) * Math.PI * 2))
const ringSin = Array.from({ length: SIDES }, (_, i) => Math.sin((i / SIDES) * Math.PI * 2))
const strandIndex = (() => {
  const idx = []
  for (let r = 0; r < RINGS - 1; r++) {
    for (let s = 0; s < SIDES; s++) {
      const a = r * SIDES + s
      const b = r * SIDES + ((s + 1) % SIDES)
      idx.push(a, a + SIDES, b, b, a + SIDES, b + SIDES)
    }
  }
  return new BufferAttribute(new Uint16Array(idx), 1)
})()

// Scratch for the sweep (remotes update one at a time).
const UP = new Vector3(0, 1, 0)
const side = new Vector3()
const upv = new Vector3()
const tan = new Vector3()

class RemoteHair {
  constructor(parent) {
    const verts = RINGS * SIDES
    this.geometry = new BufferGeometry()
    this.pos = new BufferAttribute(new Float32Array(verts * 3), 3).setUsage(DynamicDrawUsage)
    this.nor = new BufferAttribute(new Float32Array(verts * 3), 3).setUsage(DynamicDrawUsage)
    this.geometry.setAttribute('position', this.pos)
    this.geometry.setAttribute('normal', this.nor)
    this.geometry.setIndex(strandIndex)
    this.mesh = new Mesh(this.geometry, strandMaterial(DEFAULT_COLOR))
    this.mesh.frustumCulled = false // the vertices are rewritten each step, so the first bounding sphere would go stale
    this.mesh.position.set(0, STRAND.rootY, STRAND.backZ)
    parent.add(this.mesh)
    // The path in the mesh's space (root at the origin), its arc length, and how many points are live.
    this.px = new Float32Array(RINGS)
    this.py = new Float32Array(RINGS)
    this.pz = new Float32Array(RINGS)
    this.cum = new Float32Array(RINGS)
    this.n = 0
    this.pitch = new Float32Array(SEGMENTS) // rad per joint; positive swings the tip toward -Z, away from the body
    this.yaw = new Float32Array(SEGMENTS) // rad per joint; positive swings the tip toward +X
    this.hangLength = STRAND.minLength // m
    this.width = 1
    this.wave = 0
    this.time = Math.random() * 10 // s, desyncs the idle sway between players
    this.acc = 0 // s since the last step
    this.hang(0, 0, 0)
  }

  // One step of the hanging strand. dt = the time since the last step; speed01 (0..1) and yawRate
  // (rad/s) drive the streaming; grounded lays what reaches the feet along the floor.
  hang(dt, speed01, yawRate, grounded = true) {
    this.time += dt
    const lean = speed01 * SWAY.lean
    const bend = clamp(-yawRate * SWAY.turn, -SWAY.maxTurn, SWAY.maxTurn)
    const seg = this.hangLength / SEGMENTS
    const P = this.pitch
    const Y = this.yaw
    let sumP = 0.05
    let sumY = 0
    let x = 0
    let y = 0
    let z = 0
    for (let i = 0; i <= SEGMENTS; i++) {
      this.px[i] = x
      this.py[i] = y
      this.pz[i] = z
      if (i === SEGMENTS) break
      // Joint i eases toward its share of the lean / turn bend plus an idle wave; lower joints follow slower.
      const k = 1 - Math.exp(-SWAY.follow * Math.pow(SWAY.lag, i) * dt)
      const idle = Math.sin(this.time * SWAY.idleHz * Math.PI * 2 - i * 0.7) * SWAY.idle * (1 + this.wave * 0.4) * (0.4 + i / SEGMENTS)
      P[i] += ((lean / SEGMENTS) * (1 + i * 0.25) + idle - P[i]) * k
      Y[i] += ((bend / SEGMENTS) * (1 + i * 0.3) + idle * 0.5 - Y[i]) * k
      sumP += P[i]
      sumY += Y[i]
      const cy = Math.cos(sumY)
      let sx = Math.sin(sumY) * seg
      let sy = -Math.cos(sumP) * cy * seg
      let sz = -Math.sin(sumP) * cy * seg
      if (grounded && y + sy < FLOOR_Y) {
        // Long hair reaching the feet drapes onto the floor and runs on behind instead of sinking in.
        const flat = Math.hypot(sx, sz)
        const k = flat > 1e-4 ? seg / flat : 0
        sx = flat > 1e-4 ? sx * k : 0
        sz = flat > 1e-4 ? sz * k : -seg
        sy = FLOOR_Y - y
      }
      x += sx
      y += sy
      z += sz
    }
    this.n = SEGMENTS + 1
    this.sweep(HANG_TAPER)
  }

  // The shot-out cable: a run from the root to (lx, ly, lz) in the mesh's space. `state` is a
  // CABLE_CODE: it ripples sideways while the tip flies (like hairCable.js) and droops reeling in.
  cable(dt, lx, ly, lz, state) {
    this.time += dt
    const len = Math.hypot(lx, ly, lz)
    const flat = Math.hypot(lx, lz)
    const sx = flat > 1e-4 ? lz / flat : 1 // horizontal, square to the run
    const sz = flat > 1e-4 ? -lx / flat : 0
    const flying = state === CABLE_CODE.flying
    const sag = state === CABLE_CODE.retracting ? CABLE.sag : 0
    for (let i = 0; i <= CABLE_SEGMENTS; i++) {
      const f = i / CABLE_SEGMENTS
      const arch = Math.sin(Math.PI * f)
      const w = flying ? GRAPPLE.flySway * arch * Math.sin(GRAPPLE.flySwayFreq * this.time - f * len) : 0
      this.px[i] = lx * f + sx * w
      this.py[i] = ly * f - sag * arch
      this.pz[i] = lz * f + sz * w
    }
    this.n = RINGS
    this.sweep(CABLE.taper)
  }

  // Sweeps the tube along the path: rings on parallel-transported frames (the wide axis starts as
  // the body's right, so the hanging strand is flattened front-to-back), thinning by `taper`.
  sweep(taper) {
    const { px, py, pz, cum, n } = this
    const pa = this.pos.array
    const na = this.nor.array
    side.set(1, 0, 0)
    cum[0] = 0
    for (let i = 0; i < n; i++) {
      if (i > 0) cum[i] = cum[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1], pz[i] - pz[i - 1])
      const a = i > 0 ? i - 1 : 0
      const b = i < n - 1 ? i + 1 : n - 1
      tan.set(px[b] - px[a], py[b] - py[a], pz[b] - pz[a])
      if (tan.lengthSq() < 1e-10) tan.set(0, -1, 0)
      tan.normalize()
      side.addScaledVector(tan, -side.dot(tan))
      if (side.lengthSq() < 1e-6) side.crossVectors(UP, tan)
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
      side.normalize()
      upv.crossVectors(side, tan)
      const radius = STRAND.radius * this.width * (1 - taper * (i / (n - 1)))
      for (let s = 0; s < SIDES; s++) {
        const o = (i * SIDES + s) * 3
        const c = ringCos[s]
        const d = ringSin[s] * STRAND.depth
        pa[o] = px[i] + (side.x * c + upv.x * d) * radius
        pa[o + 1] = py[i] + (side.y * c + upv.y * d) * radius
        pa[o + 2] = pz[i] + (side.z * c + upv.z * d) * radius
        // The flattened ring's normal: the ellipse's (depth cos, sin), on the same axes.
        const nc = c * STRAND.depth
        const ns = ringSin[s]
        const inv = 1 / Math.hypot(nc, ns)
        na[o] = (side.x * nc + upv.x * ns) * inv
        na[o + 1] = (side.y * nc + upv.y * ns) * inv
        na[o + 2] = (side.z * nc + upv.z * ns) * inv
      }
    }
    this.geometry.setDrawRange(0, (n - 1) * SIDES * 6)
    this.pos.needsUpdate = true
    this.nor.needsUpdate = true
  }

  // The rope interface adornments.js rides: metres of strand, and the point `dist` m from the root
  // with its unit direction (both in the mesh's space).
  length() {
    return this.n > 1 ? this.cum[this.n - 1] : 0
  }

  sample(dist, pos, dir) {
    const { px, py, pz, cum, n } = this
    if (n < 2) return false
    const d = clamp(dist, 0, cum[n - 1])
    let i = 1
    while (i < n - 1 && cum[i] < d) i++
    const span = cum[i] - cum[i - 1]
    const t = span > 1e-6 ? (d - cum[i - 1]) / span : 0
    pos.set(px[i - 1] + (px[i] - px[i - 1]) * t, py[i - 1] + (py[i] - py[i - 1]) * t, pz[i - 1] + (pz[i] - pz[i - 1]) * t)
    dir.set(px[i] - px[i - 1], py[i] - py[i - 1], pz[i] - pz[i - 1])
    if (dir.lengthSq() < 1e-10) dir.set(0, -1, 0)
    dir.normalize()
    return true
  }

  setLook(p) {
    this.mesh.material = strandMaterial(HAIR_STYLES[p.equipped]?.color ?? DEFAULT_COLOR)
    this.hangLength = strandLength(p.hair)
    const cut = CUTS[p.cut] ?? CUTS[DEFAULT_CUT]
    this.width = cut.width ?? 1
    this.wave = cut.wave ?? 0
  }

  dispose(parent) {
    parent.remove(this.mesh)
    this.geometry.dispose()
  }
}

// The relayed salon look, compared field by field so an unchanged look costs no allocation.
const LOOK_KEYS = ['equipped', 'cut', 'aura', 'trail', 'charmTop', 'charmMiddle', 'charmTip', 'charmBonus', 'hair']

class Remote {
  constructor(parent) {
    this.world = parent // world-space layer (the run trail lives here)
    this.group = new Group()
    this.group.visible = false
    parent.add(this.group)
    this.avatar = null
    this.animator = null
    this.avatarJson = null // what the current rig was built from
    this.generation = 0
    this.nameText = null
    this.label = null
    this.placed = false
    this.vy = 0
    this.yawRate = 0 // rad/s, smoothed
    this.hair = new RemoteHair(this.group)
    this.look = {} // LOOK_KEYS -> last applied value
    this.adorn = null // charms + aura, made at the first one worn
    this.adornAcc = 0 // s since the adornments last moved
    this.trail = null // run ribbon, made at the first trail worn
    this.trailLive = false // drawn last frame (else re-laid when it shows again)
    this.lastX = 0
    this.lastZ = 0
    this.glow = null // zip glow, made at the first ride seen up close
    this.glowLevel = 0 // 0..1, eased
    this.cableState = CABLE_CODE.idle
    this.cableEnd = new Vector3() // world, eased toward the relayed far end
    this.setAvatar(buildDefaultCharacter())
  }

  setAvatar(next) {
    if (this.avatar) this.group.remove(this.avatar)
    disposeAnimator(this.animator)
    this.avatar = next
    this.group.add(next)
    this.animator = makeAnimator(next)
  }

  // A signed-in player's look arrives as JSON { equipped, proportions, skin }; "" = default.
  async syncAvatar(json) {
    if (json === this.avatarJson) return
    this.avatarJson = json
    if (!json) return this.setAvatar(buildDefaultCharacter())
    const mine = ++this.generation
    let look = null
    try {
      look = JSON.parse(json)
    } catch {
      return
    }
    try {
      const group = await loadBaseCharacter()
      if (mine !== this.generation) return
      await attachEquippedAccessories(group, look?.equipped, { skinTextureUrl: look?.skin || undefined })
      if (mine !== this.generation) return
      applyProportions(group, look?.proportions)
      this.setAvatar(group)
    } catch (err) {
      console.warn('[remotePlayers] avatar load failed', err) // keep the default look
    }
  }

  syncName(name) {
    if (name === this.nameText) return
    this.nameText = name
    const lines = [{ text: name, size: 0.5 }]
    if (!this.label) {
      this.label = new Label(lines, { unit: 0.5 })
      this.label.sprite.position.y = NET.nameHeight
      this.group.add(this.label.sprite)
    } else this.label.set(lines)
  }

  // Hair style, cut, charms, aura and trail: re-applied only when one of them changed.
  syncLook(p) {
    const look = this.look
    let same = true
    for (let i = 0; i < LOOK_KEYS.length && same; i++) same = look[LOOK_KEYS[i]] === p[LOOK_KEYS[i]]
    if (same) return
    for (const k of LOOK_KEYS) look[k] = p[k]
    this.hair.setLook(p)
    const charms = { top: p.charmTop, middle: p.charmMiddle, tip: p.charmTip, bonus: p.charmBonus }
    if (!this.adorn && (p.charmTop || p.charmMiddle || p.charmTip || p.charmBonus || (p.aura && p.aura !== 'none'))) {
      this.adorn = createAdornments(this.hair.mesh, { scale: CHARM_SCALE, shadows: false })
    }
    if (this.adorn) {
      this.adorn.setCharms(charms)
      this.adorn.setAura(p.aura, HAIR_STYLES[p.equipped]?.color ?? DEFAULT_COLOR)
    }
    if (!this.trail && p.trail && p.trail !== 'none') this.trail = createTrail(this.world)
    this.trail?.set(p.trail)
  }

  // Where the strand leaves the head, in world space.
  headWorld(out) {
    const g = this.group
    const yaw = g.rotation.y
    return out.set(g.position.x + Math.sin(yaw) * STRAND.backZ, g.position.y + STRAND.rootY, g.position.z + Math.cos(yaw) * STRAND.backZ)
  }

  update(p, dt, dist) {
    this.syncName(p.username || 'Player')
    this.syncAvatar(p.avatar)
    this.syncLook(p)

    const g = this.group
    const k = this.placed ? 1 - Math.exp(-NET.remoteLerp * dt) : 1
    const prevY = g.position.y
    g.position.x += (p.x - g.position.x) * k
    g.position.y += (p.y - g.position.y) * k
    g.position.z += (p.z - g.position.z) * k
    const dYaw = angleDelta(g.rotation.y, p.yaw) * k
    g.rotation.y += dYaw
    this.yawRate += ((this.placed ? dYaw / dt : 0) - this.yawRate) * Math.min(1, dt * 8)
    this.vy = this.placed ? this.vy + ((g.position.y - prevY) / dt - this.vy) * Math.min(1, dt * 10) : 0
    this.placed = true
    const near = dist < NET.cosmeticsDist

    // The hair cable (an older server relays none: idle). Redrawn every frame while it is out, as
    // its far end stays put in the world while the body moves.
    const hair = this.hair
    hair.acc += dt
    let stepped = false
    let hanging = false
    let hangPitch = 0
    const cable = p.cable ?? CABLE_CODE.idle
    if (cable !== CABLE_CODE.idle) {
      const end = this.cableEnd
      // A fresh shot starts at the head; one already out when first seen starts where it is.
      if (this.cableState === CABLE_CODE.idle) {
        if (cable === CABLE_CODE.flying) this.headWorld(end)
        else end.set(p.tx, p.ty, p.tz)
      }
      const e = 1 - Math.exp(-NET.cableLerp * dt)
      end.x += (p.tx - end.x) * e
      end.y += (p.ty - end.y) * e
      end.z += (p.tz - end.z) * e
      // Into the strand's space: undo the body's position and yaw, then the strand's seat on the body.
      const dx = end.x - g.position.x
      const dz = end.z - g.position.z
      const c = Math.cos(g.rotation.y)
      const s = Math.sin(g.rotation.y)
      const lx = dx * c - dz * s
      const ly = end.y - g.position.y - STRAND.rootY
      const lz = dx * s + dz * c - STRAND.backZ
      if (Math.hypot(lx, ly, lz) > CABLE.minLength) {
        hair.cable(hair.acc, lx, ly, lz, cable)
        hair.acc = 0
        stepped = true
        hanging = cable === CABLE_CODE.riding
        hangPitch = Math.atan2(ly, Math.max(Math.hypot(lx, lz), 1e-3))
      }
    }
    this.cableState = cable
    // Close players step their hair at hairNearHz, distant ones at hairFarHz (accumulated dt).
    if (!stepped && hair.acc >= 1 / (dist < NET.hairNearDist ? NET.hairNearHz : NET.hairFarHz)) {
      hair.hang(hair.acc, p.speed01, this.yawRate, p.grounded)
      hair.acc = 0
      stepped = true
    }

    // Charms and aura move with the strand, so they update only when it stepped.
    this.adornAcc += dt
    if (this.adorn) {
      if (!near || !this.adorn.wearing) this.adorn.root.visible = false
      else if (stepped) {
        this.adorn.update(this.adornAcc, hair, 0) // the strand's space is unrotated: facing 0 puts the top charm on the back of the head
        this.adornAcc = 0
      }
    }

    if (this.trail) {
      const show = near && this.trail.on
      this.trail.mesh.visible = show
      if (show) {
        const jumped = !this.trailLive || Math.hypot(g.position.x - this.lastX, g.position.z - this.lastZ) > TELEPORT
        this.trail.update(dt, g.position.x, g.position.y, g.position.z, g.rotation.y, p.speed01 * PHYSICS.moveSpeed > TRAIL_MIN_SPEED, jumped)
      }
      this.trailLive = show
      this.lastX = g.position.x
      this.lastZ = g.position.z
    }

    // The zip glow fades in and out like the local rider's (speedFx.js).
    const glowing = hanging && near
    if (glowing && !this.glow) {
      this.glow = createGlowSprite()
      this.glow.position.y = GLOW_Y
      g.add(this.glow)
    }
    if (this.glow) {
      const target = glowing ? 1 : 0
      this.glowLevel += (target - this.glowLevel) * (1 - Math.exp(-(glowing ? SPEED_FX.fadeIn : SPEED_FX.fadeOut) * dt))
      if (!glowing && this.glowLevel < 0.01) this.glowLevel = 0
      this.glow.visible = this.glowLevel > 0
      this.glow.material.opacity = SPEED_FX.glowOpacity * this.glowLevel
    }

    this.animator?.update(dt, {
      grounded: p.grounded,
      speed: p.speed01 * PHYSICS.moveSpeed,
      verticalVelocity: this.vy,
      turn: 0,
      hanging,
      hangPitch,
    })
  }

  // Out of range: skip the work and snap into place when it comes back.
  park(p) {
    this.placed = false
    this.cableState = CABLE_CODE.idle
    this.trailLive = false
    if (this.trail) this.trail.mesh.visible = false // it lives in world space, not in the hidden group
    this.group.position.set(p.x, p.y, p.z)
  }

  dispose(parent) {
    parent.remove(this.group)
    this.adorn?.dispose()
    this.hair.dispose(this.group)
    this.trail?.dispose()
    this.glow?.material.dispose()
    disposeAnimator(this.animator)
    if (this.label) {
      this.label.texture.dispose()
      this.label.sprite.material.dispose()
    }
  }
}

export function createRemotePlayers(scene) {
  const root = new Group()
  scene.add(root)
  const remotes = new Map() // sessionId -> Remote
  const near = [] // scratch, reused every frame
  const keep = new Set() // scratch

  return {
    update(dt, viewer) {
      const players = net.players
      const mine = net.sessionId
      if (!players || !net.connected) {
        for (const r of remotes.values()) r.dispose(root)
        remotes.clear()
        return
      }
      // Nearest first, capped, so a full room of 50 does not drown the frame rate.
      near.length = 0
      players.forEach((p, id) => {
        if (id !== mine) near.push({ id, p, d: Math.hypot(p.x - viewer.x, p.z - viewer.z) })
      })
      near.sort((a, b) => a.d - b.d)
      keep.clear()
      for (let i = 0; i < near.length && i < NET.maxRemotes; i++) {
        const { id, p, d } = near[i]
        keep.add(id)
        let r = remotes.get(id)
        if (!r) remotes.set(id, (r = new Remote(root)))
        r.group.visible = d < NET.remoteFade
        if (r.group.visible) r.update(p, dt, d)
        else r.park(p)
      }
      for (const [id, r] of remotes) {
        if (keep.has(id)) continue
        r.dispose(root)
        remotes.delete(id)
      }
    },
  }
}
