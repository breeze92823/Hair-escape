// The player's hair: the game's core mechanic. A smooth brown cap on the head and
// one thick ridged rope of hair that leaves the back of the head, hangs down the
// back, bends onto the floor and drags along behind the player (the reference look:
// a single continuous lock made of many fine parallel strands).
//
// The cap is parented to the Neck1 bone (the head), so it follows every head move
// (bob, lean, twist, headScale). Neck1's local frame is the head's: y 0..1.6 spans the
// 1.6-unit cube head, +Z is the face, -Z the back of the head (player.glb default_head
// bounds). The torso is as deep as the head (z +-0.8).
//
// The rope has two parts:
//   chain : invisible joints parented to the head; segment i is a child of segment
//           i-1, so sways accumulate down the strand. Its length is the game's
//           `hairLength`, and it grows/shrinks smoothly
//   trail : very long hair lies on the floor past the hanging tip, a
//           follow-the-leader chain in world space (see createHairRope)
// Both are drawn by one world-space mesh (createHairRope): a tube swept along the
// joint positions and then the trail points, with a grooved cross-section for strands.
//
// The worn hair cut (the salon's Styles, game/cosmetics.js CUTS) shapes the rope
// (strand count, braid twist, bubbles, waves, thickness) and adds pieces on the head
// (ponytail, buns, bunches, bow).
import { BoxGeometry, BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import { CHARACTER_COLORS, HAIR, MATERIAL_PBR, clamp } from '../config.js'
import { CUTS, DEFAULT_CUT } from '../game/cosmetics.js'

// The single source of truth for the hair length (HAIR.startLength at spawn).
// Progress code calls setHairLength(); live hair instances ease toward it.
// `length` / `trail` are what is shown (the salon's Length slider can cut it shorter);
// `grownLength` / `grownTrail` are what the player has grown (the hair cable's reach).
export const hairState = {
  length: HAIR.startLength,
  trail: 0,
  grownLength: HAIR.startLength,
  grownTrail: 0,
  cut: CUTS[DEFAULT_CUT],
  cutVersion: 0, // bumps on every cut change, so hair instances re-style once
}

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

// The full grown hair (length points, trail metres), whatever the Length slider shows.
export function setGrownLength(length, trailMetres) {
  hairState.grownLength = clamp(Number(length) || HAIR.minLength, HAIR.minLength, HAIR.maxLength)
  hairState.grownTrail = clamp(Number(trailMetres) || 0, 0, TRAIL.maxLength)
}

// The worn hair cut (a CUTS entry).
export function setHairCut(cut) {
  if (!cut || hairState.cut === cut) return
  hairState.cut = cut
  hairState.cutVersion++
}

// Recolours every live hair (the equipped hair style from the lobby shop).
export function setHairColor(color) {
  const { light, dark, rope } = sharedAssets()
  light.color.set(color)
  dark.color.set(color).multiplyScalar(0.86)
  rope.color.set(color)
}

// Hair length -> metres-of-rig the back section hangs below the chain root.
const hangFor = (length) => length * HAIR.hangPerLength

const POOL = Math.ceil(hangFor(HAIR.maxLength) / HAIR.maxSegment)
const lerp = (a, b, t) => a + (b - a) * t

let shared = null
// { box, sphere, torus, light, dark, rope, accent }: the geometries and materials every hair
// piece shares (the hair cable draws with them too, so setHairColor recolours it). `rope`
// tints by vertex colour (the strand grooves), so it is its own material. `accent` is the bow.
export function sharedAssets() {
  if (shared) return shared
  const base = { ...MATERIAL_PBR.PLAYER }
  const light = new MeshStandardMaterial({ ...base, color: CHARACTER_COLORS.hair })
  const dark = new MeshStandardMaterial({ ...base, color: CHARACTER_COLORS.hair })
  dark.color.multiplyScalar(0.86)
  const rope = new MeshStandardMaterial({ ...base, color: CHARACTER_COLORS.hair, vertexColors: true })
  const accent = new MeshStandardMaterial({ ...base, color: '#ff4fae', roughness: 0.45 })
  shared = { box: new BoxGeometry(1, 1, 1), sphere: new SphereGeometry(1, 24, 16), torus: new TorusGeometry(1, 0.32, 10, 24), light, dark, rope, accent }
  return shared
}

// A smooth rounded lump of hair: a scaled sphere, sizes/positions in head-local units.
function lump(parent, material, [w, h, d], [x, y, z]) {
  const m = new Mesh(sharedAssets().sphere, material)
  m.scale.set(w / 2, h / 2, d / 2)
  m.position.set(x, y, z)
  m.castShadow = true
  parent.add(m)
  return m
}

// Head pieces a hair cut can add (CUTS `extras`), head-local units.
function buildExtras(root) {
  const { light, dark, accent, torus } = sharedAssets()
  const group = (name) => {
    const g = new Group()
    g.name = `hair_${name}`
    g.visible = false
    root.add(g)
    return g
  }
  const pony = group('pony') // a high gathered tuft the strand leaves from, with a scrunchie
  lump(pony, light, [1.2, 1.0, 1.0], [0, 1.6, -0.95])
  const band = new Mesh(torus, accent)
  band.scale.setScalar(0.32)
  band.position.set(0, 1.5, -1.25)
  band.rotation.x = 0.5
  pony.add(band)
  const buns = group('buns') // two round buns on top
  for (const s of [-1, 1]) {
    lump(buns, light, [0.95, 0.9, 0.95], [s * 0.72, 1.75, -0.1])
    lump(buns, dark, [0.5, 0.35, 0.5], [s * 0.72, 2.12, -0.1])
  }
  const pigtails = group('pigtails') // a bunch over each ear
  for (const s of [-1, 1]) {
    lump(pigtails, light, [0.55, 0.55, 0.55], [s * 1.0, 1.25, -0.3])
    lump(pigtails, light, [0.6, 1.5, 0.6], [s * 1.12, 0.45, -0.35])
    lump(pigtails, dark, [0.45, 0.6, 0.45], [s * 1.12, -0.35, -0.35])
  }
  const bow = group('bow') // a pink bow on the back of the crown
  for (const s of [-1, 1]) lump(bow, accent, [0.75, 0.55, 0.28], [s * 0.42, 1.95, -0.85])
  lump(bow, accent, [0.3, 0.3, 0.3], [0, 1.95, -0.88])
  return { pony, buns, pigtails, bow }
}

class Hair {
  constructor(head) {
    const { light } = sharedAssets()
    this.root = new Group()
    this.root.name = 'hair'
    head.add(this.root)

    // Smooth cap over the top and back of the head. Hidden under a hat (see setHatEquipped).
    this.crown = new Group()
    this.crown.name = 'hair_crown'
    lump(this.crown, light, [2.0, 1.5, 2.1], [0, 1.2, -0.2]) // the cap
    lump(this.crown, light, [1.9, 0.8, 1.2], [0, 1.45, 0.35]) // rounded brow / fringe
    this.root.add(this.crown)

    // Always visible: the mane at the back of the head the rope comes out of.
    lump(this.root, light, [1.9, 1.5, 1.1], [0, 0.95, -0.75])
    this.extras = buildExtras(this.root)
    this.hat = false

    // Back chain: invisible joints, segment i a child of segment i-1, so bends
    // accumulate down the strand and the whole thing stays attached at the root.
    // createHairRope sweeps the visible tube through their world positions.
    this.chain = new Group()
    this.chain.position.set(0, HAIR.chainRootY, -1.0)
    this.root.add(this.chain)
    this.joints = []
    let parent = this.chain
    for (let i = 0; i < POOL; i++) {
      const joint = new Group()
      parent.add(joint)
      this.joints.push(joint)
      parent = joint
    }

    this.shown = hairState.length
    this.stretched = false
    this.time = 0
    this.cutVersion = -1
    this.applyCut()
    this.layout()
    this.sway(0)
  }

  // World position of the bottom of the hanging back (where a floor trail starts).
  tipWorld(target) {
    return this.joints[this.count - 1].localToWorld(target.set(0, -this.segH, 0))
  }

  // World position where the back strand leaves the head (the hair cable starts here).
  rootWorld(target) {
    return this.chain.localToWorld(target.set(0, -0.3, 0))
  }

  // World position on top of the head, over the crown (the cable runs over it to the hands).
  crownWorld(target) {
    return this.root.localToWorld(target.set(0, 1.95, 0))
  }

  // Writes the world positions of the hanging strand (root first, tip last) into
  // `out[offset..]` and returns how many it wrote: zero while the strand is the cable.
  hangPoints(out, offset) {
    if (this.stretched) return 0
    this.chain.localToWorld(out[offset].set(0, 0, 0))
    for (let i = 0; i < this.count; i++) this.joints[i].localToWorld(out[offset + 1 + i].set(0, -this.segH, 0))
    return this.count + 1
  }

  // While the hair is shot out as a cable the hanging back strand is the cable: hide it.
  setStretched(on) {
    this.stretched = on
  }

  setHatEquipped(on) {
    this.hat = on
    this.crown.visible = !on
    this.applyCut()
  }

  // Head pieces and the strand's root height for the worn cut. Buns and bows would poke through a hat.
  applyCut() {
    const cut = hairState.cut
    this.cutVersion = hairState.cutVersion
    for (const [name, g] of Object.entries(this.extras)) g.visible = cut.extras.includes(name) && !(this.hat && (name === 'buns' || name === 'bow'))
    this.chain.position.y = HAIR.chainRootY + cut.rootLift
  }

  // Joints are laid out for the displayed (eased) length.
  layout() {
    const hang = hangFor(this.shown)
    const count = clamp(Math.ceil(hang / HAIR.maxSegment), 1, POOL)
    this.count = count
    this.segH = hang / count
    this.joints.forEach((j, i) => {
      j.position.y = i === 0 ? 0 : -this.segH
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
      this.joints[i].rotation.x = Math.max(0, bend)
    }
  }

  update(dt, speed) {
    this.time += dt
    if (this.cutVersion !== hairState.cutVersion) this.applyCut()
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

// --- Hair rope -----------------------------------------------------------------
// Very long hair: once the back reaches the floor, the rest lies on the ground and
// is dragged along behind. A follow-the-leader chain in world space: point 0 sits
// under the hanging tip, each next point keeps one segment behind the previous one,
// so the trail traces the player's path and stays put when they stop.
//
// The whole rope (hanging strand + floor trail) is one tube mesh: a grooved
// cross-section swept along the path with parallel-transported frames, so the wide
// axis stays sideways round the bend onto the floor. Sizes are metres.
const TRAIL = { maxLength: 36, segment: 0.42, wiggle: 0.1, ease: 2 }
const TRAIL_MAX = Math.ceil(TRAIL.maxLength / TRAIL.segment)
const ROPE = {
  rootWidth: 0.5, // across, where it leaves the head and down the back
  tipWidth: 0.34, // across, at the far end of the trail
  squash: 0.8, // height / width of the cross-section
  radial: 27, // verts per ring (3 per strand at the classic 9 strands)
  clearance: 0.04, // m the floor part floats above the ground
}
const MAX_POINTS = POOL + 1 + TRAIL_MAX + 1 // hang (root + joints) + trail
const CAP = 3 // extra rings that round off each end
const TAU = Math.PI * 2

export function createHairRope(scene, floorAt) {
  const { rope } = sharedAssets()
  const R = ROPE.radial
  const rings = MAX_POINTS + 2 * CAP
  const geometry = new BufferGeometry()
  const positions = new Float32Array(rings * R * 3)
  const colors = new Float32Array(rings * R * 3)
  const index = new Uint32Array((rings - 1) * R * 6)
  // Fixed topology: ring j, vert k joins ring j+1. Rings past the draw range are never drawn.
  for (let j = 0, w = 0; j < rings - 1; j++) {
    for (let k = 0; k < R; k++) {
      const a = j * R + k
      const b = j * R + ((k + 1) % R)
      index[w++] = a; index[w++] = a + R; index[w++] = b
      index[w++] = b; index[w++] = a + R; index[w++] = b + R
    }
  }
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(rings * R * 3), 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.setIndex(new BufferAttribute(index, 1))
  geometry.setDrawRange(0, 0)
  const mesh = new Mesh(geometry, rope)
  mesh.castShadow = true
  mesh.frustumCulled = false
  scene.add(mesh)

  // Groove profile and shade per radial vert (strand crests light, grooves dark), from the cut.
  // The twist spins the ring round the path, so vert k keeps its profile and shade and the
  // grooves spiral: a braid for free.
  const profile = new Float32Array(R)
  let styleVersion = -1
  const restyle = () => {
    const cut = hairState.cut
    styleVersion = hairState.cutVersion
    const darkest = 0.26 + cut.depth * 0.5
    for (let k = 0; k < R; k++) {
      const c = Math.cos((k / R) * TAU * cut.ridges)
      profile[k] = 1 + cut.depth * (c - 0.5)
      const shade = 1 - darkest * (0.5 - 0.5 * c)
      for (let j = 0; j < rings; j++) colors.set([shade, shade, shade], (j * R + k) * 3)
    }
    geometry.attributes.color.needsUpdate = true
  }

  const pts = Array.from({ length: MAX_POINTS }, () => new Vector3()) // rope path, root first
  const cum = new Float32Array(MAX_POINTS) // arc length from the root to each path point, m
  let pathN = 0 // path points drawn last update (0 = hidden)
  const trail = Array.from({ length: TRAIL_MAX + 1 }, () => new Vector3()) // floor points, head end first
  let active = 0 // trail points currently laid out
  let shown = 0 // eased trail length, metres
  const tip = new Vector3()
  const dir = new Vector3()
  const side = new Vector3()
  const upv = new Vector3()
  const tangent = new Vector3()
  const centre = new Vector3()
  const v = new Vector3()
  const up = new Vector3(0, 1, 0)
  const halfHeight = (w) => (w * ROPE.squash) / 2
  // Rests on the floor found from `refY` (the player's feet, then the previous point's floor), so
  // the trail climbs/descends with the terrain and never sinks into the ground the player stands on.
  const ground = (p, refY, w) => floorAt(p.x, p.z, refY) + halfHeight(w) + ROPE.clearance
  const trailWidth = (t) => lerp(ROPE.rootWidth, ROPE.tipWidth, t)

  // Writes ring `ring` round `centre` on axes `side` (wide) and `upv`, half sizes hw / hh, spun by `phase` rad.
  const writeRing = (ring, hw, hh, phase) => {
    for (let k = 0; k < R; k++) {
      const a = (k / R) * TAU + phase
      v.copy(centre).addScaledVector(side, Math.cos(a) * hw * profile[k]).addScaledVector(upv, Math.sin(a) * hh * profile[k])
      positions[(ring * R + k) * 3] = v.x
      positions[(ring * R + k) * 3 + 1] = v.y
      positions[(ring * R + k) * 3 + 2] = v.z
    }
  }

  return {
    mesh,
    // hair: the live Hair (may be null while the avatar loads); facing: the body's yaw, so a
    // fresh trail is laid straight out behind. Re-laid when the player teleports.
    // cable: the hair cable (hairCable.js); while it is out, its curve IS the rope.
    // curl: optional (metres along the trail) -> rad per metre a freshly laid trail turns
    // (the salon coils it round the pedestal instead of through the wall).
    update(dt, hair, teleported, facing, feetY = 0, cable = null, curl = null) {
      if (styleVersion !== hairState.cutVersion) restyle()
      const cut = hairState.cut
      shown += (hairState.trail - shown) * (1 - Math.exp(-TRAIL.ease * dt))
      if (teleported) shown = hairState.trail
      pathN = 0
      if (!hair) {
        geometry.setDrawRange(0, 0)
        active = 0
        return
      }

      let n
      let hangN
      if (cable?.active) {
        // The strand is launched: sweep the cable's path instead of hang + trail,
        // at the full root width all along. The trail re-lays itself afterwards.
        n = cable.pathPoints(pts, 0)
        hangN = n
        active = 0
        if (n < 2) {
          geometry.setDrawRange(0, 0)
          return
        }
      } else {
        // Floor trail: follow-the-leader behind the hanging tip.
        const trailN = Math.min(TRAIL_MAX, Math.floor(shown / TRAIL.segment))
        if (trailN > 0) {
          hair.tipWorld(tip)
          trail[0].set(tip.x, 0, tip.z)
          trail[0].y = ground(trail[0], feetY, ROPE.rootWidth)
          if (teleported) active = 0
          for (let i = 1; i <= trailN; i++) {
            const p = trail[i]
            const prev = trail[i - 1]
            if (i > active) {
              // New point: continue the line the trail was already making (or lay it straight back).
              if (i >= 2) dir.subVectors(prev, trail[i - 2]).setY(0)
              else dir.set(0, 0, 0)
              if (dir.lengthSq() < 1e-6) dir.set(-Math.sin(facing), 0, -Math.cos(facing))
              dir.normalize()
              if (curl) {
                const turn = curl(i * TRAIL.segment) * TRAIL.segment
                const c = Math.cos(turn)
                const s = Math.sin(turn)
                dir.set(dir.x * c - dir.z * s, 0, dir.x * s + dir.z * c)
              }
              p.copy(prev).addScaledVector(dir, TRAIL.segment)
            } else {
              dir.subVectors(p, prev).setY(0)
              const d = dir.length()
              if (d > TRAIL.segment) p.copy(prev).addScaledVector(dir, TRAIL.segment / d)
            }
            p.y = ground(p, prev.y, trailWidth(i / trailN))
          }
        }
        active = trailN

        // Path: hanging strand (root -> tip) then the floor trail. The hanging tip and
        // trail[0] sit on top of each other, so trail[0] is skipped when the hang is drawn.
        hangN = hair.hangPoints(pts, 0)
        n = hangN
        for (let i = hangN > 0 ? 1 : 0; i <= trailN; i++) pts[n++].copy(trail[i])
        if (n < 2) {
          geometry.setDrawRange(0, 0)
          return
        }
        // A slight sideways wave along the floor so it reads as a lock, not a ribbon (wavy cuts: more).
        const wiggle = TRAIL.wiggle * cut.wave
        for (let i = Math.max(1, hangN + 1); i < n - 1; i++) {
          dir.subVectors(pts[i + 1], pts[i - 1])
          side.set(dir.z, 0, -dir.x)
          if (side.lengthSq() > 1e-8) side.normalize()
          pts[i].addScaledVector(side, Math.sin(i * 0.75) * wiggle)
        }
      }

      // Arc length along the path: drives the cut's twist and bulges, and sample() below.
      cum[0] = 0
      for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + pts[i].distanceTo(pts[i - 1])
      pathN = n
      const twist = cut.twist * TAU // rad per metre
      const swell = (s) => 1 + cut.bulge * Math.cos(s * cut.freq * TAU)

      // Sweep. The wide axis starts as the body's right and is parallel-transported along.
      side.set(Math.cos(facing), 0, -Math.sin(facing))
      let ring = 0
      for (let i = 0; i < n; i++) {
        if (i === 0) tangent.subVectors(pts[1], pts[0])
        else if (i === n - 1) tangent.subVectors(pts[n - 1], pts[n - 2])
        else tangent.subVectors(pts[i + 1], pts[i - 1])
        if (tangent.lengthSq() < 1e-10) tangent.set(0, -1, 0)
        tangent.normalize()
        side.addScaledVector(tangent, -side.dot(tangent))
        if (side.lengthSq() < 1e-6) side.crossVectors(up, tangent)
        side.normalize()
        upv.crossVectors(side, tangent).normalize()
        const w = (i < hangN ? ROPE.rootWidth : trailWidth(n - hangN > 1 ? (i - hangN) / (n - hangN - 1) : 0)) * cut.width
        const phase = cum[i] * twist
        const hw = w / 2
        const hh = halfHeight(w)
        if (i === 0) {
          // Rounded start, tucked back toward the head.
          for (let c = CAP; c >= 1; c--) {
            const t = c / (CAP + 0.5)
            const r = Math.sqrt(1 - t * t)
            centre.copy(pts[0]).addScaledVector(tangent, -t * hw * 0.8)
            writeRing(ring++, hw * r, hh * r, phase)
          }
        }
        centre.copy(pts[i])
        const k = swell(cum[i])
        writeRing(ring++, hw * k, hh * k, phase)
        if (i === n - 1) {
          // Rounded tip.
          for (let c = 1; c <= CAP; c++) {
            const t = c / (CAP + 0.5)
            const r = Math.sqrt(1 - t * t)
            centre.copy(pts[n - 1]).addScaledVector(tangent, t * hw * 0.9)
            writeRing(ring++, hw * r * k, hh * r * k, phase)
          }
        }
      }
      geometry.setDrawRange(0, (ring - 1) * R * 6)
      geometry.attributes.position.needsUpdate = true
      geometry.computeVertexNormals()
    },

    // Metres of rope drawn last update (0 while hidden).
    length: () => (pathN > 1 ? cum[pathN - 1] : 0),

    // The point `dist` metres along the rope from the root (clamped to its ends) into `pos`,
    // and its unit direction into `tan`. False while hidden.
    sample(dist, pos, tan) {
      if (pathN < 2) return false
      const d = clamp(dist, 0, cum[pathN - 1])
      let i = 1
      while (i < pathN - 1 && cum[i] < d) i++
      const span = cum[i] - cum[i - 1]
      const t = span > 1e-6 ? (d - cum[i - 1]) / span : 0
      pos.lerpVectors(pts[i - 1], pts[i], t)
      tan.subVectors(pts[i], pts[i - 1])
      if (tan.lengthSq() < 1e-10) tan.set(0, -1, 0)
      tan.normalize()
      return true
    },
  }
}
