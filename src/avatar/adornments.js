// What the salon puts on the hair besides its cut and colour: the three charms
// (top / middle / tip, game/cosmetics.js CHARMS) and the aura (AURAS), beaded rings
// that float and spin along the hair. Both ride the hair rope every frame through
// its sample() (avatar/hair.js), so they follow it onto the floor, round corners and
// out along the hair cable.
//
// Charm models are small procedural pieces built once per charm and cached; each is
// authored in metres for the rope's root width with its local +Y along the hair. The
// aura is two InstancedMeshes (rings, beads): two draw calls whatever the hair length.
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { AURAS, CHARM_SLOTS, CHARMS } from '../game/cosmetics.js'

const CHARM_AT = { top: 0.32, middle: 0.5, tip: -0.06 } // m from the root (top), fraction of the length (middle), m from the tip (negative)
const CHARM_SPIN = 1.2 // rad/s the band charms turn round the hair
const AURA = {
  spacing: 3.2, // m of hair per ring
  maxRings: 6,
  radius: 0.46, // m, ring radius round the hair
  tube: 0.045, // m, ring thickness
  beads: 6, // per ring
  beadSize: 0.08, // m
  spin: 1.6, // rad/s
  pulse: 0.06, // fraction the rings breathe
}

const UP = new Vector3(0, 1, 0)
const std = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1, ...extra })

// A band round the hair (axis +Y) with `n` beads on it.
function band(g, ringColor, beadColor, { radius = 0.3, tube = 0.035, n = 8, bead = 0.05, fat = false } = {}) {
  const ring = new Mesh(new TorusGeometry(radius, fat ? tube * 2.6 : tube, 10, 32), std(ringColor))
  ring.rotation.x = Math.PI / 2
  g.add(ring)
  const beadGeo = new SphereGeometry(bead, 10, 8)
  const beadMat = std(beadColor, { metalness: 0.3 })
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const m = new Mesh(beadGeo, beadMat)
    m.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius)
    g.add(m)
  }
}

function starShape(outer, inner, points = 5) {
  const s = new Shape()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  return s
}

function heartShape(size) {
  const s = new Shape()
  const k = size
  s.moveTo(0, -k)
  s.bezierCurveTo(k * 1.4, -k * 0.1, k * 0.9, k * 1.1, 0, k * 0.45)
  s.bezierCurveTo(-k * 0.9, k * 1.1, -k * 1.4, -k * 0.1, 0, -k)
  return s
}

// Charm models: a Group in metres, +Y along the hair (root -> tip). `spin` marks the bands.
const MODELS = {
  bow([a, b]) {
    const g = new Group()
    for (const s of [-1, 1]) {
      const wing = new Mesh(new ConeGeometry(0.13, 0.24, 12), std(a))
      wing.rotation.z = (s * Math.PI) / 2
      wing.position.set(s * 0.13, 0, 0.3)
      g.add(wing)
    }
    const knot = new Mesh(new SphereGeometry(0.07, 12, 10), std(b))
    knot.position.z = 0.3
    g.add(knot)
    return g
  },
  heart([a]) {
    const g = new Group()
    const m = new Mesh(new ExtrudeGeometry(heartShape(0.13), { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), std(a))
    m.position.z = 0.28
    m.rotation.y = 0
    g.add(m)
    return g
  },
  star([a]) {
    const g = new Group()
    const m = new Mesh(new ExtrudeGeometry(starShape(0.2, 0.09), { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }), std(a, { emissive: a, emissiveIntensity: 0.25 }))
    m.position.z = 0.28
    g.add(m)
    return g
  },
  crystal([a, b]) {
    const g = new Group()
    const mat = std(a, { emissive: a, emissiveIntensity: 0.35, transparent: true, opacity: 0.9, roughness: 0.15 })
    const tips = [[0, 0.32, 0, 0.1, 0.42], [-0.12, 0.26, 0.4, 0.07, 0.3], [0.13, 0.27, -0.45, 0.075, 0.32], [0.04, 0.24, 0.9, 0.06, 0.24]]
    for (const [x, z, tilt, r, h] of tips) {
      const m = new Mesh(new OctahedronGeometry(1, 0), mat)
      m.scale.set(r, h, r)
      m.position.set(x, h * 0.4, z)
      m.rotation.set(-0.5, 0, tilt)
      g.add(m)
    }
    const base = new Mesh(new SphereGeometry(0.1, 12, 8), std(b))
    base.position.z = 0.26
    g.add(base)
    return g
  },
  crown([a, b]) {
    const g = new Group()
    const ring = new Mesh(new CylinderGeometry(0.16, 0.16, 0.1, 16, 1, true), std(a, { metalness: 0.5, side: 2 }))
    ring.position.set(0, 0, 0.3)
    ring.rotation.x = Math.PI / 2
    g.add(ring)
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2
      const spike = new Mesh(new ConeGeometry(0.04, 0.12, 6), std(a, { metalness: 0.5 }))
      spike.position.set(Math.cos(ang) * 0.16, Math.sin(ang) * 0.16, 0.38)
      spike.rotation.x = Math.PI / 2
      g.add(spike)
    }
    const gem = new Mesh(new SphereGeometry(0.045, 10, 8), std(b, { emissive: b, emissiveIntensity: 0.4 }))
    gem.position.set(0, 0.16, 0.3)
    g.add(gem)
    return g
  },
  beads([a, b]) {
    const g = new Group()
    band(g, b, a, { radius: 0.3, tube: 0.02, n: 10, bead: 0.06 })
    g.userData.spin = true
    return g
  },
  pearls([a, b]) {
    const g = new Group()
    band(g, b, a, { radius: 0.3, tube: 0.015, n: 16, bead: 0.045 })
    band(g, b, a, { radius: 0.3, tube: 0.015, n: 16, bead: 0.045 })
    g.children.slice(17).forEach((m) => (m.position.y -= 0.1))
    g.userData.spin = true
    return g
  },
  ring([a, b]) {
    const g = new Group()
    band(g, a, b, { radius: 0.31, tube: 0.03, n: 8, bead: 0.06 })
    g.userData.spin = true
    return g
  },
  donut([a, b]) {
    const g = new Group()
    band(g, a, b, { radius: 0.32, tube: 0.04, n: 12, bead: 0.035, fat: true })
    g.userData.spin = true
    return g
  },
  rainbow() {
    const g = new Group()
    ;['#ff3d5a', '#ffb000', '#4fe23a', '#2ad4ff', '#8a4dff'].forEach((c, i) => {
      const r = new Mesh(new TorusGeometry(0.3, 0.025, 8, 32), std(c, { emissive: c, emissiveIntensity: 0.3 }))
      r.rotation.x = Math.PI / 2
      r.position.y = (i - 2) * 0.055
      g.add(r)
    })
    g.userData.spin = true
    return g
  },
  pompom([a, b]) {
    const g = new Group()
    const m = new Mesh(new IcosahedronGeometry(0.2, 1), std(a, { flatShading: true, roughness: 0.9 }))
    m.position.y = 0.12
    g.add(m)
    const tie = new Mesh(new TorusGeometry(0.12, 0.035, 8, 20), std(b))
    tie.rotation.x = Math.PI / 2
    g.add(tie)
    return g
  },
  tassel([a, b]) {
    const g = new Group()
    const cap = new Mesh(new SphereGeometry(0.11, 12, 10), std(b, { metalness: 0.4 }))
    g.add(cap)
    const fringe = new Mesh(new ConeGeometry(0.15, 0.4, 14, 1, true), std(a, { side: 2 }))
    fringe.position.y = 0.24
    fringe.rotation.x = Math.PI
    g.add(fringe)
    return g
  },
  bell([a, b]) {
    const g = new Group()
    const body = new Mesh(new SphereGeometry(0.17, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), std(a, { metalness: 0.6, roughness: 0.3, side: 2 }))
    body.position.y = 0.2
    body.rotation.x = Math.PI
    g.add(body)
    const clapper = new Mesh(new SphereGeometry(0.05, 8, 6), std(b))
    clapper.position.y = 0.3
    g.add(clapper)
    const loop = new Mesh(new TorusGeometry(0.06, 0.02, 6, 14), std(a, { metalness: 0.6 }))
    g.add(loop)
    return g
  },
  lantern([a, b]) {
    const g = new Group()
    const glass = new Mesh(new CylinderGeometry(0.13, 0.13, 0.3, 12), std(a, { emissive: a, emissiveIntensity: 0.8 }))
    glass.position.y = 0.3
    g.add(glass)
    for (const y of [0.13, 0.47]) {
      const cap = new Mesh(new CylinderGeometry(0.17, 0.17, 0.06, 12), std(b, { metalness: 0.5 }))
      cap.position.y = y
      g.add(cap)
    }
    const top = new Mesh(new TorusGeometry(0.08, 0.025, 6, 16), std(b, { metalness: 0.5 }))
    top.position.y = 0.05
    g.add(top)
    return g
  },
  gem([a, b]) {
    const g = new Group()
    const m = new Mesh(new OctahedronGeometry(1, 0), std(a, { emissive: a, emissiveIntensity: 0.4, roughness: 0.15 }))
    m.scale.set(0.15, 0.26, 0.15)
    m.position.y = 0.3
    g.add(m)
    const hook = new Mesh(new TorusGeometry(0.06, 0.02, 6, 14), std(b))
    hook.position.y = 0.04
    g.add(hook)
    return g
  },
}

export function createAdornments(parent) {
  const root = new Group()
  root.name = 'hair_adornments'
  parent.add(root)

  // --- Charms ---------------------------------------------------------------
  const built = new Map() // charm id -> Group
  const worn = { top: null, middle: null, tip: null } // slot -> Group on show
  const charmFor = (id) => {
    if (!built.has(id)) {
      const c = CHARMS[id]
      const g = MODELS[c.model](c.colors)
      g.traverse((m) => (m.castShadow = !!m.isMesh))
      built.set(id, g)
    }
    return built.get(id)
  }

  // --- Aura -------------------------------------------------------------------
  const ringMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false })
  const beadMat = new MeshBasicMaterial({ color: '#ffffff' })
  const rings = new InstancedMesh(new TorusGeometry(AURA.radius, AURA.tube, 8, 40), ringMat, AURA.maxRings)
  const beads = new InstancedMesh(new SphereGeometry(AURA.beadSize, 10, 8), beadMat, AURA.maxRings * AURA.beads)
  for (const m of [rings, beads]) {
    m.instanceMatrix.setUsage(DynamicDrawUsage)
    m.frustumCulled = false
    m.count = 0
    root.add(m)
  }
  rings.setColorAt(0, new Color()) // allocates instanceColor (the rainbow aura tints per ring)
  let aura = null // the AURAS entry on show, or null

  const pos = new Vector3()
  const tan = new Vector3()
  const q = new Quaternion()
  const spinQ = new Quaternion()
  const m4 = new Matrix4()
  const local = new Matrix4()
  const scl = new Vector3()
  const tmp = new Vector3()
  const hue = new Color()
  const ax = new Vector3()
  const az = new Vector3()
  const fwd = new Vector3()
  let time = 0
  // Turns `quat` so local +Y runs along `tangent` and local +Z leans toward `ref` (the clips' face side).
  const orient = (quat, tangent, ref) => {
    az.copy(ref).addScaledVector(tangent, -ref.dot(tangent))
    if (az.lengthSq() < 1e-6) az.set(tangent.y, -tangent.x, 0) // ref along the hair: any perpendicular
    if (az.lengthSq() < 1e-6) az.set(1, 0, 0)
    az.normalize()
    ax.crossVectors(tangent, az)
    quat.setFromRotationMatrix(m4.makeBasis(ax, tangent, az))
  }

  return {
    root,
    // The worn charms: { top, middle, tip } of CHARMS ids (or null).
    setCharms(charms) {
      for (const slot of CHARM_SLOTS) {
        const next = charms[slot] ? charmFor(charms[slot]) : null
        if (worn[slot] === next) continue
        if (worn[slot]) root.remove(worn[slot])
        worn[slot] = next
        if (next) root.add(next)
      }
    },
    // The worn aura (an AURAS id); `hairColor` tints the 'hair' aura's rings.
    setAura(id, hairColor) {
      const a = AURAS[id]
      aura = a?.ring ? a : null
      if (!aura) return
      if (aura.ring !== 'rainbow') {
        const c = aura.ring === 'hair' ? hairColor : aura.ring
        for (let i = 0; i < AURA.maxRings; i++) rings.setColorAt(i, hue.set(c))
        rings.instanceColor.needsUpdate = true
      }
      beadMat.color.set(aura.bead)
    },

    // rope: the hair rope (createHairRope), after it updated this frame; facing: the body's yaw
    // (the top charm faces out from the back of the head, the others face up).
    update(dt, rope, facing) {
      time += dt
      const len = rope.length()
      const shown = len > 0.3
      root.visible = shown
      if (!shown) return

      for (const slot of CHARM_SLOTS) {
        const g = worn[slot]
        if (!g) continue
        const at = slot === 'middle' ? len * CHARM_AT.middle : CHARM_AT[slot] < 0 ? len + CHARM_AT[slot] : Math.min(CHARM_AT[slot], len * 0.3)
        rope.sample(at, g.position, tan)
        if (slot === 'top') fwd.set(-Math.sin(facing), 0, -Math.cos(facing))
        else fwd.copy(UP)
        orient(g.quaternion, tan, fwd)
        if (g.userData.spin) g.quaternion.multiply(spinQ.setFromAxisAngle(UP, time * CHARM_SPIN))
      }

      if (!aura) {
        rings.count = beads.count = 0
        return
      }
      const n = Math.min(AURA.maxRings, Math.max(1, Math.round(len / AURA.spacing)))
      rings.count = n
      beads.count = n * AURA.beads
      for (let i = 0; i < n; i++) {
        rope.sample(((i + 0.5) / n) * len, pos, tan)
        q.setFromUnitVectors(UP, tan).multiply(spinQ.setFromAxisAngle(UP, time * AURA.spin * (i % 2 ? -1 : 1) + i))
        // The torus lies in its XY plane: turn it to ring the hair (axis +Y).
        const breathe = 1 + Math.sin(time * 3 + i * 1.7) * AURA.pulse
        m4.compose(pos, q, scl.set(breathe, breathe, breathe))
        rings.setMatrixAt(i, local.makeRotationX(Math.PI / 2).premultiply(m4))
        if (aura.ring === 'rainbow') rings.setColorAt(i, hue.setHSL((time * 0.25 + i / n) % 1, 0.9, 0.6))
        for (let j = 0; j < AURA.beads; j++) {
          const a = (j / AURA.beads) * Math.PI * 2
          tmp.set(Math.cos(a) * AURA.radius, 0, Math.sin(a) * AURA.radius).applyMatrix4(m4)
          beads.setMatrixAt(i * AURA.beads + j, local.makeTranslation(tmp.x, tmp.y, tmp.z))
        }
      }
      rings.instanceMatrix.needsUpdate = true
      beads.instanceMatrix.needsUpdate = true
      if (aura.ring === 'rainbow') rings.instanceColor.needsUpdate = true
    },
  }
}
