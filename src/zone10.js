// Zone 10: SKY GARDENS. Through the doorway in the back of Zone 9's candy deck, a
// chain of floating islands hangs in the open sky over a sea of cloud puffs: grass
// tops on white stone rims over dirt sides and rocky undersides, wreathed in clouds.
// Hop the first islands, then land on a pink CLOUD SPRING (a bounce pad: it throws
// you ~8 m up, far higher than a jump) to reach the garden island, through the +1 Win
// ring floating in the arc. A rainbow bridge arches on to the windmill island, whose
// own spring throws you up to the summit: the yellow win pad (the zone's wins), a
// cyan "+700 Wins" pad (decoration), an x2.5 Hair treadmill, a gold gazebo and the
// cloud gate at the back into Zone 11. A hot-air balloon drifts past; the clouds
// drift below. Falling off puts you back on the start island. Procedural like Zones 2-9.
//
// Same scale as Zone 9 (1.8 m player): 4 m hops rising 0.5 m; the springs
// (PHYSICS.bounceSpeed) clear 10-11 m gaps rising 4-4.5 m with ~4 m of landing room.
import { BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, Quaternion, RepeatWrapping, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3 } from 'three'
import { kit, voxelTexture } from './lavaPath.js'
import { arrowTexture } from './zone4.js'
import { ZONE9_EXIT } from './zone9.js'
import { label } from './lobby/labels.js'
import { buildTreadmill } from './lobby/treadmill.js'
import { makeCanvas } from './lobby/paint.js'
import { bonusRing, floorDecal, levelSign, paidPad, winPad } from './zoneProps.js'

export const ZONE10_NAME = 'SKY GARDENS'
export const ZONE10_BONUS = 1 // wins for the ring in the first spring's arc
export const ZONE10_WIN = 350 // wins for the yellow pad on the summit island
export const ZONE10_LEVEL = 240 // the recommended level on the sign
export const ZONE10_Z0 = ZONE9_EXIT.z // the entrance edge (the doorway in Zone 9's back building)

const CX = (ZONE9_EXIT.x0 + ZONE9_EXIT.x1) / 2 // the islands' centre line, in line with Zone 9's doorway
const T = ZONE9_EXIT.top // the start island, flush with Zone 9's candy deck
const at = (e) => ZONE10_Z0 - e // m north of the entrance -> world z
const FALL_Y = T - 6 // feet below this = respawn (the clouds are decoration, not floor)
const SIDE = 40 // m either side of the centre line that counts as in the zone

// The islands, as distances north of the entrance (e0, e1 = near / far edge; half = half width; top).
const ISLANDS = [
  { e0: 0, e1: 14, half: 7, top: T, start: true },
  { e0: 18, e1: 26, half: 4, top: T + 0.5 },
  { e0: 30, e1: 38, half: 4, top: T + 1 },
  { e0: 42, e1: 48, half: 3.5, top: T + 1 },
  { e0: 56, e1: 66, half: 5, top: T + 5, garden: true },
  { e0: 84, e1: 96, half: 5, top: T + 5.5, windmill: true },
  { e0: 104, e1: 107, half: 6, top: T + 9.5 }, // the summit's front porch: a lower landing step
  { e0: 107, e1: 130, half: 8, top: T + 10, summit: true },
]
const SUMMIT = ISLANDS[7]
const END_E = SUMMIT.e1 // the zone's north face (the cloud gate)
// The cloud springs [x, e, top of the island they sit on]: the first on island 3 throws you to the garden island, the second on the windmill island to the porch.
const SPRINGS = [[CX, 45.5, T + 1], [CX + 1, 93.5, T + 5.5]]
const SPRING_R = 1.6 // m, a spring's radius
const BRIDGE = { e0: 68, e1: 82, w: 3, rises: [0.4, 0.8, 1.2, 1.4, 1.2, 0.8, 0.4], colors: ['#ff4a4a', '#ff9a2a', '#ffe02a', '#5fdc4a', '#3fa8ff', '#6a5aff', '#c45aff'] } // seven slabs arching from the garden to the windmill island
const RING = { x: CX, y: T + 9, z: at(51), radius: 1.8, reach: 1.5 } // bonus ring in the first spring's arc (the chest passes ~8 m up); reach: m either side of its plane that count
const WIN_PAD = { x: CX - 3, z: at(111) }
const PAID_PAD = { x: CX - 5.5, z: at(116) } // the cyan "+700 Wins" pad (decoration)
const TREAD = { x: CX + 4, z: at(114), len: 4.8, w: 2.4, mult: 2.5 } // the x2.5 Hair treadmill (m), console to the north
const GAZEBO = { x: CX, e: 122, r: 3.5, h: 4.5 } // gold gazebo on the summit, walked through on the way to the gate
const GATE = { e: 128.5, half: 4, h: 6 } // the cloud gate's pillars either side of the exit
const WINDMILL = { x: CX - 3.5, e: 88, h: 7, blade: 3.5 } // on the windmill island
const BALLOON = { x: CX - 24, y: T + 6, e: 60, r: 3 } // the hot-air balloon's drift centre
const CLOUDS = 140 // instanced cloud puffs

// The gate at the summit's back, where Zone 11's terrace carries on north.
export const ZONE10_EXIT = { x0: CX - 3, x1: CX + 3, z: at(END_E), top: SUMMIT.top }

// Where a fall puts you: the start island, facing north.
export const ZONE10_SPAWN = { x: CX, y: T + 0.1, z: at(3) }

const COL = {
  grass: '#6fd63a',
  dirt: '#8a5a34',
  rock: '#6d6a7a',
  stone: '#f4f1e8',
  gold: '#ffcf1f',
  pink: '#ff7ad0',
  wood: '#8a5a34',
  yellow: '#ffd21a',
}

const tex = {}
function textures() {
  tex.grass = voxelTexture(COL.grass, { cells: 4, jitter: 0.07, grid: 0.12 })
  tex.dirt = voxelTexture(COL.dirt, { cells: 4, jitter: 0.1, grid: 0.2 })
  tex.stone = voxelTexture(COL.stone, { cells: 4, jitter: 0.03, grid: 0.08 })
}

// Red-and-white vertical stripes for the balloon's envelope.
function stripeTexture() {
  const c = makeCanvas(64)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = '#ff4a4a'
  ctx.fillRect(0, 0, 32, 64)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(6, 1)
  t.colorSpace = SRGBColorSpace
  return t
}

let mats = null
const material = (k) => (mats ??= {
  cloud: k.std('#ffffff', { emissive: '#dfe9ff', emissiveIntensity: 0.25, roughness: 1 }),
  rock: k.std(COL.rock, { roughness: 0.95, flatShading: true }),
  stone: k.std(COL.stone, { roughness: 0.8 }),
  gold: k.std(COL.gold, { emissive: '#d99a00', emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.3 }),
  pink: k.std(COL.pink, { emissive: '#ff3fb0', emissiveIntensity: 0.5, roughness: 0.4 }),
  wood: k.std(COL.wood, { roughness: 0.85 }),
  blade: k.std('#f6f1e2', { roughness: 0.7 }),
  water: k.std('#5fc8ff', { emissive: '#2a90ff', emissiveIntensity: 0.4, transparent: true, opacity: 0.8, roughness: 0.2 }),
  basket: k.std('#a0702a', { roughness: 0.9 }),
  rope: k.std('#4a3a2a', { roughness: 0.9 }),
})

// Tiny seeded generator so the gardens look the same every load.
let seed = 10
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const between = (a, b) => a + rand() * (b - a)

// Cloud puffs are collected here and drawn as one instanced mesh.
const puffs = []
const puff = (x, y, z, s) => puffs.push([x, y, z, s])

// A floating island: grass top on a white stone rim, dirt sides, a rocky underside cone, flowers, and cloud puffs round its base.
function island(k, isl) {
  const m = material(k)
  const z0 = at(isl.e0)
  const z1 = at(isl.e1)
  const w = isl.half * 2
  const d = isl.e1 - isl.e0
  const zc = (z0 + z1) / 2
  k.voxSpan(CX - isl.half, CX + isl.half, z0, z1, { y0: isl.top - 0.5, y1: isl.top, side: tex.grass, top: tex.grass, cell: 2, collide: false, cast: false })
  k.voxSpan(CX - isl.half - 0.25, CX + isl.half + 0.25, z0 + 0.25, z1 - 0.25, { y0: isl.top - 1.1, y1: isl.top - 0.5, side: tex.stone, top: tex.stone, cell: 1, collide: false, cast: false })
  k.voxSpan(CX - isl.half, CX + isl.half, z0, z1, { y0: isl.top - 3, y1: isl.top - 1.1, side: tex.dirt, top: tex.dirt, cell: 2, collide: false, cast: false })
  k.addCollider(CX, zc, w, d, isl.top, 0, isl.top - 3) // one box for the whole island, so the cable can grab its sides
  // The underside: a rock cone hanging under the dirt.
  const cone = k.mesh(new ConeGeometry(Math.min(w, d) * 0.55, Math.min(w, d) * 0.7 + 2, 7), m.rock, CX, isl.top - 3 - (Math.min(w, d) * 0.7 + 2) / 2, zc, { cast: false })
  cone.rotation.x = Math.PI
  // Flowers: little coloured cubes in the grass, away from the walking line.
  if (!isl.summit) {
    for (let i = 0; i < 4 + isl.half; i++) {
      const s = i % 2 ? -1 : 1
      k.mesh(new BoxGeometry(0.3, 0.3, 0.3), k.std(['#ff5a8a', '#ffd21a', '#ffffff', '#b45aff'][i % 4]), CX + s * between(isl.half - 1.2, isl.half - 0.5), isl.top + 0.15, between(z1 + 0.6, z0 - 0.6), { cast: false })
    }
  }
  // Cloud puffs round the base.
  const n = 4 + Math.round(isl.half)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand()
    puff(CX + Math.cos(a) * (isl.half + 1.2), isl.top - 2.2 + between(-0.6, 0.4), zc + Math.sin(a) * (d / 2 + 1.2), between(1.4, 2.6))
  }
}

// A pink cloud spring: a white puffy ring round a glowing pink cushion, an up arrow beside it. main.js launches a grounded player standing on it.
function spring(k, [x, e, top]) {
  const m = material(k)
  const z = at(e)
  const cushion = k.mesh(new CylinderGeometry(SPRING_R, SPRING_R + 0.2, 0.5, 20), m.pink, x, top + 0.25, z, { cast: false })
  k.mesh(new TorusGeometry(SPRING_R + 0.15, 0.45, 10, 24), m.cloud, x, top + 0.3, z, { cast: false }).rotation.x = Math.PI / 2
  label(k.g, [{ text: 'BOUNCE!', size: 0.5, fill: ['#ffd0f0', '#ff7ad0'], stroke: '#4a0a3a' }], [x, top + 2.4, z], { unit: 1.2 })
  return cushion
}

// The rainbow bridge: seven coloured slabs, each a step up to the middle then down.
function bridge(k) {
  const b = BRIDGE
  const n = b.rises.length
  const len = (b.e1 - b.e0) / n
  const base = ISLANDS[4].top
  for (let i = 0; i < n; i++) {
    const z0 = at(b.e0 + i * len)
    const z1 = at(b.e0 + (i + 1) * len)
    const top = base + b.rises[i]
    const mat = k.std(b.colors[i], { emissive: b.colors[i], emissiveIntensity: 0.2, roughness: 0.5 })
    k.mesh(new BoxGeometry(b.w, 0.6, len + 0.05), mat, CX, top - 0.3, (z0 + z1) / 2, { cast: false })
    k.addCollider(CX, (z0 + z1) / 2, b.w, len, top, 0, top - 0.6)
  }
  for (let i = 0; i < 6; i++) puff(CX + (i % 2 ? 2.6 : -2.6), base - 0.6 + between(-0.3, 0.3), at(b.e0 + 2 + i * 2.2), between(1.2, 1.8))
}

// The windmill: a tapered stone tower with a wooden cap, four blades turning on its south face. Solid, so the cable can grab it.
function windmill(k) {
  const m = material(k)
  const w = WINDMILL
  const base = ISLANDS[5].top
  const z = at(w.e)
  k.mesh(new CylinderGeometry(0.9, 1.3, w.h, 10), m.stone, w.x, base + w.h / 2, z, { cast: false })
  k.mesh(new ConeGeometry(1.4, 1.2, 10), m.wood, w.x, base + w.h + 0.6, z, { cast: false })
  k.addCollider(w.x, z, 2.2, 2.2, base + w.h, 0, base)
  const hub = new Group()
  hub.position.set(w.x, base + w.h - 0.6, z + 1.3)
  hub.add(new Mesh(new CylinderGeometry(0.3, 0.3, 0.8, 8), m.wood).rotateX(Math.PI / 2))
  for (let i = 0; i < 4; i++) {
    const blade = new Mesh(new BoxGeometry(0.7, w.blade, 0.1), m.blade)
    blade.position.set(0, 0, 0.3)
    const arm = new Group()
    arm.rotation.z = (i * Math.PI) / 2
    blade.position.y = w.blade / 2 + 0.3
    arm.add(blade)
    hub.add(arm)
  }
  k.g.add(hub)
  return hub
}

// The summit's gazebo: eight gold posts round a white floor disc under a gold cone roof with a ball on top.
function gazebo(k) {
  const m = material(k)
  const g = GAZEBO
  const base = SUMMIT.top
  const z = at(g.e)
  k.mesh(new CylinderGeometry(g.r + 0.6, g.r + 0.6, 0.2, 24), m.stone, g.x, base + 0.1, z, { cast: false })
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const x = g.x + Math.cos(a) * g.r
    const pz = z + Math.sin(a) * g.r
    k.mesh(new CylinderGeometry(0.22, 0.22, g.h, 8), m.gold, x, base + g.h / 2, pz, { cast: false })
    k.addCollider(x, pz, 0.5, 0.5, base + g.h, 0, base)
  }
  k.mesh(new ConeGeometry(g.r + 1, 2.4, 8), m.gold, g.x, base + g.h + 1.2, z, { cast: false })
  k.mesh(new SphereGeometry(0.5, 10, 8), m.gold, g.x, base + g.h + 2.7, z, { cast: false })
}

// The cloud gate: white pillars with gold caps either side of the exit, a gold arch over them.
function gate(k) {
  const m = material(k)
  const z = at(GATE.e)
  for (const s of [-1, 1]) {
    const x = CX + s * GATE.half
    k.mesh(new CylinderGeometry(0.8, 0.9, GATE.h, 10), m.stone, x, SUMMIT.top + GATE.h / 2, z, { cast: false })
    k.mesh(new BoxGeometry(2, 0.5, 2), m.gold, x, SUMMIT.top + GATE.h + 0.25, z, { cast: false })
    k.addCollider(x, z, 1.8, 1.8, SUMMIT.top + GATE.h + 0.5, 0, SUMMIT.top)
    puff(x + s * 1.2, SUMMIT.top + 0.6, z + 0.6, 1.6)
  }
  k.mesh(new TorusGeometry(GATE.half, 0.35, 8, 20, Math.PI), m.gold, CX, SUMMIT.top + GATE.h + 0.5, z, { cast: false }) // the arc stands in the x-y plane: an arch over the gate
  label(k.g, [{ text: 'JUNGLE RUINS →', size: 0.5, fill: ['#d6ffb0', '#6fd63a'], stroke: '#0a2a0a' }], [CX, SUMMIT.top + GATE.h + 6, z], { unit: 1.4 })
}

// The hot-air balloon: a striped envelope, ropes and a basket, drifting on a slow loop.
function balloon(k) {
  const m = material(k)
  const g = new Group()
  const env = new Mesh(new SphereGeometry(BALLOON.r, 14, 12), k.std('#ffffff', { map: stripeTexture(), roughness: 0.6 }))
  env.scale.y = 1.2
  g.add(env)
  const basket = new Mesh(new BoxGeometry(1.4, 1, 1.4), m.basket)
  basket.position.y = -BALLOON.r * 1.2 - 2.2
  g.add(basket)
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const rope = new Mesh(new CylinderGeometry(0.04, 0.04, 2.6, 4), m.rope)
    rope.position.set(sx * 0.6, -BALLOON.r * 1.2 - 0.9, sz * 0.6)
    g.add(rope)
  }
  k.g.add(g)
  return g
}

// Every cloud puff as one instanced mesh (the free-floating sea below the islands is added here too).
function clouds(k) {
  const extra = CLOUDS - puffs.length
  for (let i = 0; i < extra; i++) {
    const s = i % 2 ? -1 : 1
    puff(CX + s * between(6, SIDE - 4), T + between(-14, -4), at(between(-4, END_E + 6)), between(2, 4.5))
  }
  const mesh = new InstancedMesh(new SphereGeometry(1, 8, 6), material(k).cloud, puffs.length)
  const mtx = new Matrix4()
  const q = new Quaternion()
  const pos = new Vector3()
  const scl = new Vector3()
  puffs.forEach(([x, y, z, s], i) => {
    mtx.compose(pos.set(x, y, z), q, scl.set(s, s * 0.6, s * 0.85))
    mesh.setMatrixAt(i, mtx)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.castShadow = false
  mesh.receiveShadow = false
  k.g.add(mesh)
  return mesh
}

export function buildZone10(scene, addCollider) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)
  textures()
  const m = material(k)

  for (const isl of ISLANDS) island(k, isl)
  bridge(k)
  const springs = SPRINGS.map((s) => spring(k, s))
  const arrowMat = arrowTexture(COL.yellow)
  floorDecal(k, arrowMat, CX, T, at(9), 2.6)
  floorDecal(k, arrowMat, CX, ISLANDS[2].top, at(35), 2)
  floorDecal(k, arrowMat, CX, ISLANDS[4].top, at(64), 2)
  // The garden island: a fountain (stone bowl, blue water, a spout) and hedges along its sides.
  const garden = ISLANDS[4]
  for (const s of [-1, 1]) {
    k.voxSpan(CX + s * (garden.half - 0.9), CX + s * garden.half, at(garden.e0 + 1), at(garden.e1 - 1), { y0: garden.top, y1: garden.top + 1, side: tex.grass, cell: 1, cast: false })
    const fx = CX + s * 2.6
    const fz = at(60)
    k.mesh(new CylinderGeometry(1, 1.1, 0.5, 12), m.stone, fx, garden.top + 0.25, fz, { cast: false })
    k.mesh(new CylinderGeometry(0.85, 0.85, 0.15, 12), m.water, fx, garden.top + 0.5, fz, { cast: false })
    k.mesh(new CylinderGeometry(0.1, 0.14, 1.2, 6), m.stone, fx, garden.top + 1, fz, { cast: false })
    k.addCollider(fx, fz, 2.1, 2.1, garden.top + 0.5, 0, garden.top)
  }
  const hub = windmill(k)
  gazebo(k)
  gate(k)
  const ring = bonusRing(k, RING, ZONE10_BONUS)
  const pad = winPad(k, WIN_PAD.x, WIN_PAD.z, SUMMIT.top, ZONE10_WIN)
  paidPad(k, PAID_PAD.x, PAID_PAD.z, SUMMIT.top, '+700 Wins')
  const treadmill = buildTreadmill(g, addCollider, {
    x: TREAD.x, z: TREAD.z, y: SUMMIT.top, yaw: -Math.PI / 2, length: TREAD.len, width: TREAD.w, theme: 'sky', mult: TREAD.mult, labelY: 3.9,
    labels: [
      { text: '[x2 Boost]', size: 0.35, fill: '#ff5a9a', stroke: '#3a0a1a' },
      { text: `x${TREAD.mult} Hair`, size: 0.7, fill: ['#ffffff', '#7fd0ff'], stroke: '#0a2a5a' },
    ],
  })
  const ball = balloon(k)
  const cloud = clouds(k)
  levelSign(g, ZONE10_LEVEL, [CX, T + 7, at(10)])
  label(g, [{ text: 'STEP ON THE SPRINGS!', size: 0.5, fill: ['#ffd0f0', '#ff7ad0'], stroke: '#4a0a3a' }], [CX, T + 5, at(40)], { unit: 1.4 })

  const inZone = (p) => p.z <= ZONE10_Z0 && p.z > at(END_E) && Math.abs(p.x - CX) < SIDE
  let bonus = false
  let won = false
  return {
    treadmills: [treadmill], // main.js runs them with the Hub's
    // From Zone 9's doorway to the cloud gate.
    contains: inZone,
    // True while the player stands on a cloud spring (main.js launches them).
    bounceAt(p) {
      for (const [x, e, top] of SPRINGS) {
        if (Math.abs(p.y - top) < 0.15 && Math.hypot(p.x - x, p.z - at(e)) < SPRING_R) return true
      }
      return false
    },
    // Returns 'fell' (off an island), 'bonus' (through the ring) or 'finish' (the win pad).
    update(dt, time, p) {
      ring.update(time)
      pad.update(time)
      treadmill.update(dt, time)
      hub.rotation.z = time * 1.2
      for (const s of springs) s.scale.y = 1 + Math.sin(time * 3) * 0.12
      ball.position.set(BALLOON.x + Math.sin(time * 0.15) * 4, BALLOON.y + Math.sin(time * 0.4) * 0.8, at(BALLOON.e) + Math.cos(time * 0.15) * 8)
      cloud.position.x = Math.sin(time * 0.08) * 2.5
      if (inZone(p) && p.y < FALL_Y) return 'fell'
      if (!bonus && ring.hit(p)) {
        bonus = true
        return 'bonus'
      }
      if (!won && pad.onPad(p)) {
        won = true
        return 'finish'
      }
      return null
    },
    reset() {
      bonus = false
      won = false
    },
  }
}
