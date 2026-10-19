// The player's hair: the game's core mechanic. Built from rigid boxes in the same
// blocky style as the Bloxity rig and parented to the Neck1 bone (the head), so
// it follows every head move (bob, lean, twist, headScale). Neck1's local frame
// is the head's: y 0..1.6 spans the 1.6-unit cube head, +Z is the face, -Z the
// back of the head (player.glb default_head bounds). The torso is as deep as
// the head (z +-0.8), so the long back section hangs just behind z = -0.8.
//
// Layout, from the front/side/back references:
//   crown + spikes : swept-back volume on top of the head
//   fringe         : thin lip over the top of the forehead
//   sideburns      : cover the ears either side
//   nape           : fills the back of the head down to the neck
//   chain          : the segments hanging down the back; its length is the
//                    game's `hairLength`, and it grows/shrinks smoothly
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { CHARACTER_COLORS, HAIR, MATERIAL_PBR, clamp } from '../config.js'

// The single source of truth for the hair length (HAIR.startLength at spawn).
// Progress code calls setHairLength(); live hair instances ease toward it.
export const hairState = { length: HAIR.startLength, trail: 0 }

export function setHairLength(length) {
  const n = Number(length)
  if (!Number.isFinite(n)) return hairState.length
  hairState.length = clamp(n, HAIR.minLength, HAIR.maxLength)
  return hairState.length
}

export const getHairLength = () => hairState.length

// Metres of hair dragging along the floor behind the player, past the hanging back.
export function setTrailLength(metres) {
  const n = Number(metres)
  hairState.trail = Number.isFinite(n) ? clamp(n, 0, TRAIL.maxLength) : 0
}

// Recolours every live hair (the equipped hair style from the lobby shop).
export function setHairColor(color) {
  const { light, dark } = sharedAssets()
  light.color.set(color)
  dark.color.set(color).multiplyScalar(0.86)
}

// Hair length -> metres-of-rig the back section hangs below the chain root.
const hangFor = (length) => length * HAIR.hangPerLength

const POOL = Math.ceil(hangFor(HAIR.maxLength) / HAIR.maxSegment)
const lerp = (a, b, t) => a + (b - a) * t

let shared = null
function sharedAssets() {
  if (shared) return shared
  const base = { ...MATERIAL_PBR.PLAYER }
  const light = new MeshStandardMaterial({ ...base, color: CHARACTER_COLORS.hair })
  const dark = new MeshStandardMaterial({ ...base, color: CHARACTER_COLORS.hair }).clone()
  dark.color.multiplyScalar(0.86)
  shared = { box: new BoxGeometry(1, 1, 1), light, dark }
  return shared
}

function block(parent, material, [w, h, d], [x, y, z], [rx = 0, ry = 0, rz = 0] = []) {
  const m = new Mesh(sharedAssets().box, material)
  m.scale.set(w, h, d)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  m.castShadow = true
  parent.add(m)
  return m
}

class Hair {
  constructor(head) {
    const { light, dark } = sharedAssets()
    this.root = new Group()
    this.root.name = 'hair'
    head.add(this.root)

    // Volume on top of / around the head. Hidden under a hat (see setHatEquipped).
    this.crown = new Group()
    this.crown.name = 'hair_crown'
    block(this.crown, light, [1.8, 0.5, 1.8], [0, 1.62, -0.1])
    block(this.crown, dark, [1.74, 0.42, 0.22], [0, 1.4, 0.76]) // fringe
    const spikes = [
      [[-0.6, 2.0, -0.1], [-0.35, 0, 0.12], light],
      [[-0.2, 2.15, -0.22], [-0.45, 0, -0.05], dark],
      [[0.22, 2.2, -0.28], [-0.5, 0, 0.06], light],
      [[0.6, 2.02, -0.12], [-0.35, 0, -0.14], dark],
      [[0, 1.98, 0.28], [-0.25, 0, 0], light],
    ]
    for (const [pos, rot, mat] of spikes) block(this.crown, mat, [0.5, 0.75, 0.5], pos, rot)
    this.root.add(this.crown)

    // Always visible: sides, nape and the long back.
    for (const side of [-1, 1]) block(this.root, dark, [0.22, 1.1, 1.0], [side * 0.9, 1.0, -0.2])
    block(this.root, light, [1.86, 0.95, 0.52], [0, 1.12, -0.93]) // nape

    // Back chain: segment i is a child of segment i-1, so bends accumulate
    // down the strand and the whole thing stays attached at the root.
    this.chain = new Group()
    this.chain.position.set(0, HAIR.chainRootY, -1.07)
    this.root.add(this.chain)
    this.segments = []
    let parent = this.chain
    for (let i = 0; i < POOL; i++) {
      const joint = new Group()
      const mesh = new Mesh(sharedAssets().box, i % 2 ? dark : light)
      mesh.castShadow = true
      joint.add(mesh)
      parent.add(joint)
      this.segments.push({ joint, mesh })
      parent = joint
    }

    this.shown = hairState.length
    this.time = 0
    this.layout()
    this.sway(0)
  }

  // World position of the bottom of the hanging back (where a floor trail starts).
  tipWorld(target) {
    const last = this.segments[this.count - 1].joint
    return last.localToWorld(target.set(0, -this.segH, 0))
  }

  setHatEquipped(on) {
    this.crown.visible = !on
  }

  // Segments are laid out for the displayed (eased) length.
  layout() {
    const hang = hangFor(this.shown)
    const count = clamp(Math.ceil(hang / HAIR.maxSegment), 1, POOL)
    const segH = hang / count
    this.count = count
    this.segH = segH
    this.segments.forEach((s, i) => {
      s.joint.visible = i < count
      if (i >= count) return
      const t = count > 1 ? i / (count - 1) : 0
      s.joint.position.y = i === 0 ? 0 : -segH
      s.mesh.position.y = -segH / 2
      // Slight overlap so a bent chain never shows gaps between segments.
      s.mesh.scale.set(lerp(1.86, 1.2, t), segH + 0.06, lerp(0.52, 0.42, t))
    })
  }

  // `speed01`: 0 standing .. 1 full sprint. Positive x-rotation swings a
  // segment's tip toward -Z (away from the body), so hair streams backwards.
  sway(speed01) {
    const share = Math.min(1, 4 / this.count)
    const stream = speed01 * 0.5
    for (let i = 0; i < this.count; i++) {
      const wave = Math.sin(this.time * 2.4 - i * 0.55) * 0.05 * (0.4 + speed01) * share
      const bend = 0.03 + (stream / this.count) * 1.6 + wave
      this.segments[i].joint.rotation.x = Math.max(0, bend)
    }
  }

  update(dt, speed) {
    this.time += dt
    const target = hairState.length
    if (Math.abs(target - this.shown) > 1e-3) {
      this.shown += (target - this.shown) * (1 - Math.exp(-HAIR.growEase * dt))
      this.layout()
    } else if (this.shown !== target) {
      this.shown = target
      this.layout()
    }
    this.sway(clamp(speed / HAIR.sprintSpeed, 0, 1))
  }

  dispose() {
    this.root.parent?.remove(this.root)
  }
}

// Attach hair to a character from character.js. Returns null when it has no head bone.
export function attachHair(character) {
  const head = character?.nodes?.Neck1
  return head ? new Hair(head) : null
}

// --- Floor trail ---------------------------------------------------------------
// Very long hair: once the back reaches the floor, the rest lies on the ground
// and is dragged along behind. A follow-the-leader chain in world space: point 0
// sits under the hanging tip, each next point keeps one segment behind the
// previous one, so the trail traces the player's path and stays put when they
// stop. Drawn as one InstancedMesh of blocks in the hair's shared colour.
const TRAIL = { maxLength: 36, segment: 0.42, height: 0.32, rootWidth: 0.6, tipWidth: 0.26, wiggle: 0.22, ease: 2 }
const TRAIL_MAX = Math.ceil(TRAIL.maxLength / TRAIL.segment)

export function createHairTrail(scene, floorAt) {
  const { light } = sharedAssets()
  const mesh = new InstancedMesh(sharedAssets().box, light, TRAIL_MAX)
  mesh.castShadow = true
  mesh.frustumCulled = false
  mesh.count = 0
  // Alternate light / dark blocks like the hanging strand (instance colour tints the shared material).
  const shadeA = new Color(1, 1, 1)
  const shadeB = new Color(0.82, 0.82, 0.82)
  for (let i = 0; i < TRAIL_MAX; i++) mesh.setColorAt(i, i % 2 ? shadeB : shadeA)
  scene.add(mesh)
  const side = new Vector3()
  const wa = new Vector3()
  const wb = new Vector3()
  const pts = Array.from({ length: TRAIL_MAX + 1 }, () => new Vector3())
  let active = 0 // points currently laid out
  let shown = 0 // eased trail length, metres
  const tip = new Vector3()
  const m = new Matrix4()
  const q = new Quaternion()
  const s = new Vector3()
  const mid = new Vector3()
  const dir = new Vector3()
  const up = new Vector3(0, 0, 1)
  const ground = (p) => floorAt(p.x, p.z, p.y + 0.6) + TRAIL.height / 2 + 0.02

  return {
    // hair: the live Hair (may be null while the avatar loads); facing: the body's yaw, so a
    // fresh trail is laid straight out behind. Re-laid when the player teleports.
    update(dt, hair, teleported, facing) {
      shown += (hairState.trail - shown) * (1 - Math.exp(-TRAIL.ease * dt))
      const n = hair ? Math.min(TRAIL_MAX, Math.floor(shown / TRAIL.segment)) : 0
      if (n === 0) {
        mesh.count = 0
        active = 0
        return
      }
      hair.tipWorld(tip)
      pts[0].set(tip.x, 0, tip.z)
      pts[0].y = ground(pts[0])
      if (teleported) active = 0
      for (let i = 1; i <= n; i++) {
        const p = pts[i]
        const prev = pts[i - 1]
        if (i > active) {
          // New point: continue the line the trail was already making (or lay it straight back).
          if (i >= 2) dir.subVectors(prev, pts[i - 2]).setY(0)
          else dir.set(0, 0, 0)
          if (dir.lengthSq() < 1e-6) dir.set(-Math.sin(facing), 0, -Math.cos(facing))
          p.copy(prev).addScaledVector(dir.normalize(), TRAIL.segment)
        } else {
          dir.subVectors(p, prev).setY(0)
          const d = dir.length()
          if (d > TRAIL.segment) p.copy(prev).addScaledVector(dir, TRAIL.segment / d)
        }
        p.y = ground(p)
      }
      active = n
      // Draw with a sideways wave so it reads as a thick, wavy lock rather than a ribbon.
      const wiggle = (i, out) => {
        const a = pts[Math.max(0, i - 1)]
        const b = pts[Math.min(n, i + 1)]
        side.set(b.z - a.z, 0, a.x - b.x)
        if (side.lengthSq() > 1e-8) side.normalize()
        const amp = TRAIL.wiggle * Math.min(1, i / 4)
        return out.copy(pts[i]).addScaledVector(side, Math.sin(i * 0.75) * amp)
      }
      for (let i = 0; i < n; i++) {
        const a = wiggle(i, wa)
        const b = wiggle(i + 1, wb)
        mid.addVectors(a, b).multiplyScalar(0.5)
        mid.y += 0.04 * Math.sin(i * 1.3)
        dir.subVectors(b, a)
        const len = dir.length() || TRAIL.segment
        q.setFromUnitVectors(up, dir.normalize())
        const t = i / Math.max(1, n - 1)
        const w = TRAIL.rootWidth + (TRAIL.tipWidth - TRAIL.rootWidth) * t
        s.set(w, TRAIL.height * (1 - t * 0.35), len + 0.12)
        m.compose(mid, q, s)
        mesh.setMatrixAt(i, m)
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    },
  }
}
