// The other players in the room (net.js -> server WorldState.players): each one is the game's
// character with their Bloxity cosmetics, an animated hair strand in their hair style's colour whose
// length follows their hair, and a name tag, eased toward the pose the server last relayed. Diffed
// against the roster every frame, so joins/leaves need no events. Remote hair is one small tube mesh
// stepped at a reduced rate (see RemoteHair); the full rope, charms and auras are local-player only
// (they share one global look, avatar/hair.js).
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Group, Mesh, MeshStandardMaterial } from 'three'
import { MATERIAL_PBR, NET, PHYSICS, clamp } from './config.js'
import { net } from './net.js'
import { Label } from './lobby/labels.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { HAIR_STYLES } from './game/state.js'
import { CUTS, DEFAULT_CUT } from './game/cosmetics.js'

const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

// Remote hair: ONE tube mesh per player (SEGMENTS x SIDES vertices, one draw call, a shared material
// per colour). The chain is a follow-the-leader pendulum: each joint eases toward the one above it,
// so the tip lags, streams out with speed and swings on turns. It is stepped at a reduced rate
// (NET.hairNearHz close up, NET.hairFarHz far away) with the accumulated dt, so a crowd costs a few
// dozen joint updates per frame and no allocations. The cut's width / wave shape it.
const STRAND = { rootY: 1.55, backZ: -0.18, radius: 0.13, depth: 0.6, minLength: 0.5, maxLength: 3.2, perDecade: 0.75 } // m; depth = front-to-back flattening
const SEGMENTS = 7
const SIDES = 6
const SWAY = { lean: 1.1, follow: 9, lag: 0.72, turn: 0.07, maxTurn: 0.6, idle: 0.05, idleHz: 1.6 } // lean = rad at full speed; follow = 1/s; lag = per-joint falloff of follow; turn = rad per rad/s of yaw; idle = rad
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
  for (let r = 0; r < SEGMENTS; r++) {
    for (let s = 0; s < SIDES; s++) {
      const a = r * SIDES + s
      const b = r * SIDES + ((s + 1) % SIDES)
      idx.push(a, a + SIDES, b, b, a + SIDES, b + SIDES)
    }
  }
  return new BufferAttribute(new Uint16Array(idx), 1)
})()

class RemoteHair {
  constructor(parent) {
    const verts = (SEGMENTS + 1) * SIDES
    this.geometry = new BufferGeometry()
    this.pos = new BufferAttribute(new Float32Array(verts * 3), 3).setUsage(DynamicDrawUsage)
    this.nor = new BufferAttribute(new Float32Array(verts * 3), 3).setUsage(DynamicDrawUsage)
    this.geometry.setAttribute('position', this.pos)
    this.geometry.setAttribute('normal', this.nor)
    this.geometry.setIndex(strandIndex)
    this.mesh = new Mesh(this.geometry, strandMaterial('#f5a321'))
    this.mesh.frustumCulled = false // the vertices are rewritten each step, so the first bounding sphere would go stale
    this.mesh.position.set(0, STRAND.rootY, STRAND.backZ)
    parent.add(this.mesh)
    this.pitch = new Float32Array(SEGMENTS) // rad per joint; positive swings the tip toward -Z, away from the body
    this.yaw = new Float32Array(SEGMENTS) // rad per joint; positive swings the tip toward +X
    this.length = STRAND.minLength
    this.width = 1
    this.wave = 0
    this.time = Math.random() * 10 // s, desyncs the idle sway between players
    this.acc = 0 // s since the last step
    this.step(0, 0, 0)
  }

  // dt = the time since the last step; speed01 (0..1) and yawRate (rad/s) drive the streaming.
  step(dt, speed01, yawRate) {
    this.time += dt
    const lean = speed01 * SWAY.lean
    const bend = clamp(-yawRate * SWAY.turn, -SWAY.maxTurn, SWAY.maxTurn)
    const seg = this.length / SEGMENTS
    const P = this.pitch
    const Y = this.yaw
    const pa = this.pos.array
    const na = this.nor.array
    let sumP = 0.05
    let sumY = 0
    let x = 0
    let y = 0
    let z = 0
    for (let i = 0; i <= SEGMENTS; i++) {
      const radius = STRAND.radius * this.width * (1 - 0.55 * (i / SEGMENTS))
      for (let s = 0; s < SIDES; s++) {
        const o = (i * SIDES + s) * 3
        const cx = ringCos[s]
        const cz = ringSin[s] * STRAND.depth
        pa[o] = x + cx * radius
        pa[o + 1] = y
        pa[o + 2] = z + cz * radius
        const inv = 1 / Math.hypot(cx, cz)
        na[o] = cx * inv
        na[o + 1] = 0
        na[o + 2] = cz * inv
      }
      if (i === SEGMENTS) break
      // Joint i eases toward its share of the lean / turn bend plus an idle wave; lower joints follow slower.
      const k = 1 - Math.exp(-SWAY.follow * Math.pow(SWAY.lag, i) * dt)
      const idle = Math.sin(this.time * SWAY.idleHz * Math.PI * 2 - i * 0.7) * SWAY.idle * (1 + this.wave * 0.4) * (0.4 + i / SEGMENTS)
      P[i] += ((lean / SEGMENTS) * (1 + i * 0.25) + idle - P[i]) * k
      Y[i] += ((bend / SEGMENTS) * (1 + i * 0.3) + idle * 0.5 - Y[i]) * k
      sumP += P[i]
      sumY += Y[i]
      const cy = Math.cos(sumY)
      x += Math.sin(sumY) * seg
      y -= Math.cos(sumP) * cy * seg
      z -= Math.sin(sumP) * cy * seg
    }
    this.pos.needsUpdate = true
    this.nor.needsUpdate = true
  }

  setLook(p) {
    this.mesh.material = strandMaterial(HAIR_STYLES[p.equipped]?.color ?? '#f5a321')
    this.length = strandLength(p.hair)
    const cut = CUTS[p.cut] ?? CUTS[DEFAULT_CUT]
    this.width = cut.width ?? 1
    this.wave = cut.wave ?? 0
  }

  dispose(parent) {
    parent.remove(this.mesh)
    this.geometry.dispose()
  }
}

class Remote {
  constructor(parent) {
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

  update(p, dt, dist) {
    this.syncName(p.username || 'Player')
    this.syncAvatar(p.avatar)
    this.hair.setLook(p)

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

    // Close players step their hair at hairNearHz, distant ones at hairFarHz (accumulated dt).
    const hair = this.hair
    hair.acc += dt
    if (hair.acc >= 1 / (dist < NET.hairNearDist ? NET.hairNearHz : NET.hairFarHz)) {
      hair.step(hair.acc, p.speed01, this.yawRate)
      hair.acc = 0
    }
    this.animator?.update(dt, {
      grounded: p.grounded,
      speed: p.speed01 * PHYSICS.moveSpeed,
      verticalVelocity: this.vy,
      turn: 0,
      hanging: false,
      hangPitch: 0,
    })
  }

  dispose(parent) {
    parent.remove(this.group)
    this.hair.dispose(this.group)
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
      const keep = new Set()
      for (const { id, p, d } of near.slice(0, NET.maxRemotes)) {
        keep.add(id)
        let r = remotes.get(id)
        if (!r) remotes.set(id, (r = new Remote(root)))
        r.group.visible = d < NET.remoteFade
        if (r.group.visible) r.update(p, dt, d)
        else {
          r.placed = false // out of range: skip the work, snap into place when it comes back
          r.group.position.set(p.x, p.y, p.z)
        }
      }
      for (const [id, r] of remotes) {
        if (keep.has(id)) continue
        r.dispose(root)
        remotes.delete(id)
      }
    },
  }
}
