// Zone 14: STAR SUMMIT. Through the lift at the back of Zone 13's Hair Tower, out
// onto a moon base under the stars: this zone builds the night dome and starfield
// that also cover Zone 13's skyline, with planets (a ringed one, a red one, a blue
// one), a distant sun and comets streaking past. Gravity is LOW here
// (PHYSICS.spaceGravity): jumps float twice as far. Hop the asteroids to a small
// purple planet with three ROCKS ORBITING it: ride one round (through the +1 Win
// ring at the orbit's east point) to the far side and hop off to the last asteroids
// and the summit, where the Star Palace stands: white columns under a gold dome,
// the throne, the yellow win pad (the zone's wins, then home: World 1 is escaped), a
// cyan "+5000 Wins" pad (decoration), an x10 Hair treadmill and crystal stars
// bobbing round it. Falling off puts you back on the last checkpoint (base, third
// asteroid, far asteroid or summit). Procedural like Zones 2-13.
//
// Same scale as Zone 13 (1.8 m player), in low gravity: 8 m hops rising 1.5 m (a
// jump here rises ~2.8 m and carries ~13 m), 2 m hops on and off the orbiting rocks.
import { BackSide, BoxGeometry, BufferGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, OctahedronGeometry, Points, PointsMaterial, Quaternion, RepeatWrapping, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3 } from 'three'
import { kit, voxelTexture } from './lavaPath.js'
import { arrowTexture } from './zone4.js'
import { ZONE13_EXIT, ZONE13_Z0 } from './zone13.js'
import { label } from './lobby/labels.js'
import { buildTreadmill } from './lobby/treadmill.js'
import { makeCanvas } from './lobby/paint.js'
import { bonusRing, createCheckpoints, createMovers, floorDecal, levelSign, paidPad, winPad } from './zoneProps.js'

export const ZONE14_NAME = 'STAR SUMMIT'
export const ZONE14_BONUS = 1 // wins for the ring on the orbit
export const ZONE14_WIN = 2000 // wins for the yellow pad in the Star Palace
export const ZONE14_LEVEL = 360 // the recommended level on the sign
export const ZONE14_Z0 = ZONE13_EXIT.z // the entrance edge (Zone 13's lift)

const CX = (ZONE13_EXIT.x0 + ZONE13_EXIT.x1) / 2 // the course's centre line, in line with Zone 13's lift
const T = ZONE13_EXIT.top // the moon base, flush with Zone 13's Hair Tower roof
const at = (e) => ZONE14_Z0 - e // m north of the entrance -> world z
const FALL_Y = T - 8 // feet below this = respawn (into the stars)
const SIDE = 60 // m either side of the centre line that counts as in the zone

// The course, as distances north of the entrance.
const BASE = { e0: 0, e1: 16, half: 8, top: T }
// Asteroids (e0, e1, half, top): the first three lead to the orbit, the last two from it to the summit.
const ROCKS = [
  { e0: 24, e1: 30, half: 3, top: T + 1.5 },
  { e0: 38, e1: 44, half: 3, top: T + 3 },
  { e0: 52, e1: 58, half: 3, top: T + 4.5 },
  { e0: 90, e1: 96, half: 3, top: T + 6 },
  { e0: 104, e1: 110, half: 3.5, top: T + 7.5 },
]
const PLANET = { e: 74, r: 5, y: T + 2 } // the small purple planet the rocks orbit
const ORBIT = { r: 12, rate: 0.3, n: 3, half: 2, top: T + 5, h: 2.5 } // m, rad/s, rocks, m half width, m, m deep
const SUMMIT = { e0: 118, e1: 152, half: 12, top: T + 9 }
const BACK = { e0: 152, e1: 156, h: 12 } // the palace's back wall: the last stage, no way on
const END_E = BACK.e1
const PALACE = { e0: 122, e1: 148, half: 9, columns: 6, colH: 8 } // the Star Palace's floor and colonnade on the summit
const THRONE = { e: 145 }
const RING = { x: CX + ORBIT.r, y: ORBIT.top + 1.7, z: at(PLANET.e), radius: 1.5, reach: 1.3 } // bonus ring at the orbit's east point, where the rocks pass heading north; reach: m either side of its plane that count
const WIN_PAD = { x: CX - 3, z: at(128) }
const PAID_PAD = { x: CX - 5.5, z: at(134) } // the cyan "+5000 Wins" pad (decoration)
const TREAD = { x: CX + 4, z: at(131), len: 4.8, w: 2.4, mult: 10 } // the x10 Hair treadmill (m), console to the north
// The night dome over Zones 13 and 14: an ellipsoid from Zone 13's entrance to this zone's back wall (its caps sit inside the walls either end).
const DOME = { rx: 90, rz: (ZONE13_Z0 - at(END_E)) / 2 + 3, y: T - 7, z: (ZONE13_Z0 + at(END_E)) / 2 }
const STARS = 900
const PLANETS = [[-40, 60, 22, 9, '#e8c48a', true], [48, 110, -12, 8, '#d84a2a', false], [34, 20, 32, 5, '#3fa8ff', false]] // [x offset, e, y above T, radius, colour, ringed]
const SUN = { dx: -60, e: 150, y: 45, r: 7 }
const COMETS = [[-45, 10, 60, 30, 18], [50, 140, 110, -30, 14], [-20, 150, 20, 40, 22]] // [x0 offset, e0, y0 above T, drift x per loop, m/s] streaking north and across
const COMET_LEN = 120 // m a comet travels before it loops
const DRIFTERS = 40 // small instanced asteroids drifting round the zone
const CRYSTALS = 8 // crystal stars bobbing round the palace

// Where a fall puts you before the first checkpoint: the moon base, facing north.
export const ZONE14_SPAWN = { x: CX, y: T + 0.1, z: at(3) }
const CHECKPOINTS = [
  { z: at(0), spot: ZONE14_SPAWN },
  { z: at(ROCKS[2].e0), spot: { x: CX, y: ROCKS[2].top + 0.1, z: at(ROCKS[2].e0 + 3) } },
  { z: at(ROCKS[3].e0), spot: { x: CX, y: ROCKS[3].top + 0.1, z: at(ROCKS[3].e0 + 3) } },
  { z: at(SUMMIT.e0), spot: { x: CX, y: SUMMIT.top + 0.1, z: at(SUMMIT.e0 + 2) } },
]

const COL = {
  moon: '#b9bcc8',
  moonDark: '#8a8e9c',
  rock: '#5a4f7a',
  white: '#f6f4ff',
  gold: '#ffcf1f',
  purple: '#8a3bff',
  yellow: '#ffd21a',
}

const tex = {}
function textures() {
  tex.moon = moonTexture()
  tex.moonDark = voxelTexture(COL.moonDark, { cells: 4, jitter: 0.06, grid: 0.2 })
  tex.white = voxelTexture(COL.white, { cells: 4, jitter: 0.02, grid: 0.06 })
  tex.inlay = inlayTexture()
}

// Moon rock: pale grey with darker craters.
function moonTexture() {
  const c = makeCanvas(128)
  const ctx = c.getContext('2d')
  ctx.fillStyle = COL.moon
  ctx.fillRect(0, 0, 128, 128)
  let s = 14
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 14; i++) {
    const r = 4 + rnd() * 10
    const x = rnd() * 128
    const y = rnd() * 128
    ctx.fillStyle = '#9a9eac'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#c8cbd6'
    ctx.beginPath()
    ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.6, 0, Math.PI * 2)
    ctx.fill()
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

// The palace floor: white and gold checks with a star in each gold one.
function inlayTexture() {
  const c = makeCanvas(64)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fbf8ff'
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = '#ffd86a'
  ctx.fillRect(0, 0, 32, 32)
  ctx.fillRect(32, 32, 32, 32)
  ctx.fillStyle = '#ffffff'
  for (const [cx, cy] of [[16, 16], [48, 48]]) {
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 3 : 7
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

let mats = null
const material = (k) => (mats ??= {
  rock: k.std(COL.rock, { roughness: 0.95, flatShading: true }),
  rockDark: k.std('#3a3356', { roughness: 0.95, flatShading: true }),
  moon: k.std(COL.moon, { roughness: 0.9 }),
  white: k.std(COL.white, { roughness: 0.5 }),
  gold: k.std(COL.gold, { emissive: '#d99a00', emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.3 }),
  purple: k.std(COL.purple, { emissive: '#4a1aa0', emissiveIntensity: 0.4, roughness: 0.6 }),
  band: k.std('#c89aff', { emissive: '#8a5aff', emissiveIntensity: 0.3, roughness: 0.6 }),
  glass: k.std('#bfe8ff', { emissive: '#5fb8ff', emissiveIntensity: 0.2, transparent: true, opacity: 0.4, roughness: 0.1 }),
  domeGold: k.std('#ffe08a', { emissive: '#ffb020', emissiveIntensity: 0.3, transparent: true, opacity: 0.55, roughness: 0.3 }),
  crystal: k.std('#bff4ff', { emissive: '#5fe0ff', emissiveIntensity: 0.9, roughness: 0.2, flatShading: true }),
  steel: k.std('#8a90a8', { metalness: 0.6, roughness: 0.4 }),
  pink: k.std('#ff5fd0', { emissive: '#ff3fc8', emissiveIntensity: 0.6, roughness: 0.4 }),
  comet: k.std('#9fe8ff', { emissive: '#5fd8ff', emissiveIntensity: 1.2, roughness: 0.3 }),
  tail: k.std('#9fe8ff', { emissive: '#5fd8ff', emissiveIntensity: 0.8, transparent: true, opacity: 0.5, roughness: 0.3 }),
  sun: new MeshBasicMaterial({ color: '#fff0a0', fog: false }),
  sunGlow: new MeshBasicMaterial({ color: '#ffd040', transparent: true, opacity: 0.25, fog: false }),
  night: new MeshBasicMaterial({ color: '#06041a', side: BackSide, fog: false }),
})

// Tiny seeded generator so the stars look the same every load.
let seed = 14
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const between = (a, b) => a + rand() * (b - a)

// An asteroid: a faceted rock with a flat top at `top`, boulders round its rim, a glowing band under the lip. Solid from top - h.
function asteroid(k, x, z, top, half, h = 6) {
  const m = material(k)
  k.mesh(new CylinderGeometry(half * 1.12, half * 0.7, h, 7), m.rock, x, top - h / 2, z, { cast: false }).rotation.y = rand() * Math.PI
  k.mesh(new TorusGeometry(half * 1.05, 0.12, 6, 14), m.band, x, top - 0.35, z, { cast: false }).rotation.x = Math.PI / 2
  for (let i = 0; i < 3; i++) {
    const a = rand() * Math.PI * 2
    const r = between(0.35, 0.7)
    k.mesh(new DodecahedronGeometry(r, 0), m.rockDark, x + Math.cos(a) * (half + 0.3), top - between(1, h - 1), z + Math.sin(a) * (half + 0.3), { cast: false })
  }
  k.addCollider(x, z, half * 2, half * 2, top, 0, top - h)
}

// An orbiting rock (mover): the same look, built round the origin with its top at local y 0.
function orbiter(k) {
  const m = material(k)
  const g = new Group()
  const body = new Mesh(new CylinderGeometry(ORBIT.half * 1.12, ORBIT.half * 0.7, ORBIT.h, 7), m.rock)
  body.position.y = -ORBIT.h / 2
  body.receiveShadow = true
  g.add(body)
  const band = new Mesh(new TorusGeometry(ORBIT.half * 1.05, 0.12, 6, 14), m.band)
  band.rotation.x = Math.PI / 2
  band.position.y = -0.35
  g.add(band)
  k.g.add(g)
  return g
}

// --- The sky: dome, stars, planets, sun, comets, drifting rocks -----------------------
function buildSky(k) {
  const m = material(k)
  const dome = k.mesh(new SphereGeometry(1, 28, 18), m.night, CX, DOME.y, DOME.z, { cast: false })
  dome.scale.set(DOME.rx, DOME.rx, DOME.rz)
  dome.receiveShadow = false
  // Stars: points just inside the dome's surface.
  const arr = new Float32Array(STARS * 3)
  const v = new Vector3()
  for (let i = 0; i < STARS; i++) {
    v.set(between(-1, 1), between(-0.1, 1), between(-1, 1)).normalize().multiplyScalar(0.97)
    arr[i * 3] = CX + v.x * DOME.rx
    arr[i * 3 + 1] = DOME.y + v.y * DOME.rx
    arr[i * 3 + 2] = DOME.z + v.z * DOME.rz
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(arr, 3))
  k.g.add(new Points(geo, new PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.95 })))
  // Planets and the sun.
  for (const [dx, e, y, r, color, ringed] of PLANETS) {
    const p = k.mesh(new SphereGeometry(r, 18, 14), k.std(color, { roughness: 0.8, emissive: color, emissiveIntensity: 0.15 }), CX + dx, T + y, at(e), { cast: false })
    if (ringed) {
      const ring = k.mesh(new TorusGeometry(r * 1.6, r * 0.18, 4, 36), k.std('#d8c8a0', { roughness: 0.7, emissive: '#d8c8a0', emissiveIntensity: 0.15 }), p.position.x, p.position.y, p.position.z, { cast: false })
      ring.rotation.x = Math.PI / 2 + 0.35
      ring.scale.z = 0.15 // a flat band, not a tube
    }
  }
  k.mesh(new SphereGeometry(SUN.r, 16, 12), m.sun, CX + SUN.dx, T + SUN.y, at(SUN.e), { cast: false })
  k.mesh(new SphereGeometry(SUN.r * 1.6, 16, 12), m.sunGlow, CX + SUN.dx, T + SUN.y, at(SUN.e), { cast: false })
  // Comets: a bright head with a long tail, each on its own loop.
  const comets = COMETS.map(() => {
    const g = new Group()
    g.add(new Mesh(new SphereGeometry(0.6, 8, 6), m.comet))
    const tail = new Mesh(new ConeGeometry(0.5, 6, 6), m.tail)
    tail.rotation.x = Math.PI / 2
    tail.position.z = 3.4
    g.add(tail)
    k.g.add(g)
    return g
  })
  // Small asteroids drifting round the zone, off the path.
  const drifters = new InstancedMesh(new DodecahedronGeometry(1, 0), m.rockDark, DRIFTERS)
  const mtx = new Matrix4()
  const q = new Quaternion()
  const pos = new Vector3()
  const scl = new Vector3()
  for (let i = 0; i < DRIFTERS; i++) {
    const s = i % 2 ? 1 : -1
    const r = between(0.8, 2.6)
    q.setFromAxisAngle(pos.set(between(-1, 1), between(-1, 1), between(-1, 1)).normalize(), rand() * Math.PI)
    mtx.compose(pos.set(CX + s * between(16, 50), T + between(-25, 30), at(between(-10, END_E + 10))), q, scl.set(r, r * between(0.7, 1.2), r))
    drifters.setMatrixAt(i, mtx)
  }
  drifters.instanceMatrix.needsUpdate = true
  drifters.castShadow = drifters.receiveShadow = false
  k.g.add(drifters)
  return { comets, drifters }
}

// --- The moon base ---------------------------------------------------------------------
function buildBase(k) {
  const m = material(k)
  const b = BASE
  k.voxSpan(CX - b.half, CX + b.half, at(b.e0), at(b.e1), { y0: T - 4, y1: T, side: tex.moonDark, top: tex.moon, cell: 3, cast: false })
  // The glass dome habitat, the satellite dish and a flag.
  const dx = CX - 5
  const dz = at(11)
  k.mesh(new CylinderGeometry(3.2, 3.2, 0.5, 16), m.steel, dx, T + 0.25, dz, { cast: false })
  k.mesh(new SphereGeometry(3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.glass, dx, T + 0.5, dz, { cast: false })
  k.addCollider(dx, dz, 5.6, 5.6, T + 3, 0, T)
  const sx = CX + 5.5
  const sz = at(13)
  k.mesh(new CylinderGeometry(0.2, 0.3, 2.5, 6), m.steel, sx, T + 1.25, sz, { cast: false })
  const dish = k.mesh(new CylinderGeometry(1.8, 0.4, 0.8, 14), m.white, sx, T + 3, sz, { cast: false })
  dish.rotation.x = -0.6
  k.addCollider(sx, sz, 1, 1, T + 2.5, 0, T)
  k.mesh(new CylinderGeometry(0.06, 0.06, 3, 5), m.steel, CX + 6, T + 1.5, at(4), { cast: false })
  k.mesh(new BoxGeometry(1.4, 0.9, 0.05), m.pink, CX + 6.7, T + 2.5, at(4), { cast: false })
  floorDecal(k, arrowTexture(COL.yellow), CX, T, at(9), 2.6)
}

// --- The course: asteroids, the planet with its orbit, the summit and the palace ---
function buildCourse(k, movers) {
  const m = material(k)
  for (const r of ROCKS) asteroid(k, CX, at((r.e0 + r.e1) / 2), r.top, r.half)
  // The purple planet with a band, and its three orbiting rocks (movers).
  const pz = at(PLANET.e)
  k.mesh(new SphereGeometry(PLANET.r, 18, 14), m.purple, CX, PLANET.y, pz, { cast: false })
  k.mesh(new TorusGeometry(PLANET.r + 0.3, 0.25, 6, 30), m.band, CX, PLANET.y, pz, { cast: false }).rotation.x = Math.PI / 2 + 0.3
  for (let i = 0; i < ORBIT.n; i++) {
    const phase = (i / ORBIT.n) * Math.PI * 2
    movers.add(orbiter(k), { w: ORBIT.half * 2, d: ORBIT.half * 2, h: ORBIT.h, path: (time, out) => {
      const a = time * ORBIT.rate + phase
      out.x = CX + Math.sin(a) * ORBIT.r
      out.y = ORBIT.top
      out.z = pz + Math.cos(a) * ORBIT.r // a = 0 at the south point, heading east then north
    } })
  }
  // The summit: a big asteroid, the palace floor and colonnade on top.
  const s = SUMMIT
  const sz = at((s.e0 + s.e1) / 2)
  const stretch = (s.e1 - s.e0) / (s.half * 2.24) // the rock is longer than it is wide
  const rock = k.mesh(new CylinderGeometry(s.half * 1.12, s.half * 0.7, 10, 9), m.rock, CX, s.top - 5, sz, { cast: false })
  rock.scale.z = stretch
  const lip = k.mesh(new TorusGeometry(s.half * 1.05, 0.14, 6, 24), m.band, CX, s.top - 0.35, sz, { cast: false })
  lip.rotation.x = Math.PI / 2
  lip.scale.y = stretch // local y lies along world z once the torus is flat
  k.addCollider(CX, sz, s.half * 2, s.e1 - s.e0, s.top, 0, s.top - 10)
  const p = PALACE
  const inlay = tex.inlay.clone()
  inlay.repeat.set(p.half * 2 / 3, (p.e1 - p.e0) / 3)
  const floor = k.mesh(new BoxGeometry(p.half * 2, 0.3, p.e1 - p.e0), [m.white, m.white, k.std('#ffffff', { map: inlay, roughness: 0.4 }), m.white, m.white, m.white], CX, s.top + 0.15, at((p.e0 + p.e1) / 2), { cast: false })
  floor.receiveShadow = true
  k.addCollider(CX, at((p.e0 + p.e1) / 2), p.half * 2, p.e1 - p.e0, s.top + 0.3, 0, s.top)
  const step = (p.e1 - p.e0 - 4) / (p.columns - 1)
  for (const side of [-1, 1]) {
    for (let i = 0; i < p.columns; i++) {
      const x = CX + side * (p.half - 1)
      const z = at(p.e0 + 2 + i * step)
      k.mesh(new CylinderGeometry(0.55, 0.65, p.colH, 10), m.white, x, s.top + 0.3 + p.colH / 2, z, { cast: false })
      k.mesh(new BoxGeometry(1.5, 0.4, 1.5), m.gold, x, s.top + 0.3 + p.colH + 0.2, z, { cast: false })
      k.addCollider(x, z, 1.2, 1.2, s.top + 0.3 + p.colH + 0.4, 0, s.top)
    }
    k.mesh(new BoxGeometry(1.8, 0.6, p.e1 - p.e0), m.white, CX + side * (p.half - 1), s.top + 0.3 + p.colH + 0.7, at((p.e0 + p.e1) / 2), { cast: false })
    k.mesh(new BoxGeometry(1.9, 0.15, p.e1 - p.e0), m.gold, CX + side * (p.half - 1), s.top + 0.3 + p.colH + 1.07, at((p.e0 + p.e1) / 2), { cast: false })
  }
  // The gold dome over the throne, and the throne on its dais.
  const tz = at(THRONE.e)
  k.mesh(new SphereGeometry(7, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.domeGold, CX, s.top + 0.3 + p.colH + 1.2, tz, { cast: false })
  k.mesh(new SphereGeometry(0.7, 10, 8), m.gold, CX, s.top + 0.3 + p.colH + 8.5, tz, { cast: false })
  for (const [half, h] of [[3, 0.4], [2.3, 0.8], [1.6, 1.2]]) k.voxSpan(CX - half, CX + half, tz + half, tz - half, { y0: s.top + 0.3, y1: s.top + 0.3 + h, side: tex.white, cell: 1, cast: false })
  const ty = s.top + 1.5
  k.mesh(new BoxGeometry(1.6, 0.7, 1.4), m.purple, CX, ty + 0.35, tz, { cast: false })
  k.mesh(new BoxGeometry(1.8, 2.6, 0.4), m.gold, CX, ty + 1.3, tz - 0.6, { cast: false })
  for (const side of [-1, 1]) k.mesh(new BoxGeometry(0.3, 1.1, 1.4), m.gold, CX + side * 0.95, ty + 0.55, tz, { cast: false })
  k.mesh(new OctahedronGeometry(0.5, 0), m.crystal, CX, ty + 3, tz - 0.6, { cast: false })
  k.addCollider(CX, tz, 2.2, 1.6, ty + 0.7, 0, s.top)
  label(k.g, [{ text: 'YOU ESCAPED!', size: 0.8, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }, { text: 'WORLD 1 COMPLETE', size: 0.5, fill: '#ffffff', stroke: '#2a0a4a' }], [CX, ty + 5, tz], { unit: 1.6 })
  // Crystal stars bobbing round the palace.
  const crystals = []
  for (let i = 0; i < CRYSTALS; i++) {
    const side = i % 2 ? 1 : -1
    crystals.push(k.mesh(new OctahedronGeometry(between(0.5, 0.9), 0), m.crystal, CX + side * between(p.half + 1, s.half - 0.5), s.top + between(2, 6), at(between(p.e0, p.e1)), { cast: false }))
  }
  // The back wall: white with a gold cap and the next world's sign.
  k.voxSpan(CX - s.half, CX + s.half, at(BACK.e0), at(BACK.e1), { y0: s.top - 10, y1: s.top + BACK.h, side: tex.white, cell: 3, cast: false })
  k.mesh(new BoxGeometry(s.half * 2 + 0.4, 0.5, 4.4), m.gold, CX, s.top + BACK.h + 0.25, at((BACK.e0 + BACK.e1) / 2), { cast: false })
  label(k.g, [{ text: 'WORLD 2: WONDER WORLDS', size: 0.6, fill: ['#e0d0ff', '#b48aff'], stroke: '#1a0a3a' }, { text: 'COMING SOON', size: 0.9, fill: '#ffffff', stroke: '#1a0a3a' }], [CX, s.top + 7, at(BACK.e0) + 0.5], { unit: 1.6 })
  return crystals
}

export function buildZone14(scene, addCollider) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)
  textures()
  const movers = createMovers(addCollider)

  const { comets, drifters } = buildSky(k)
  buildBase(k)
  const crystals = buildCourse(k, movers)
  const ring = bonusRing(k, RING, ZONE14_BONUS)
  const pad = winPad(k, WIN_PAD.x, WIN_PAD.z, SUMMIT.top + 0.3, ZONE14_WIN)
  paidPad(k, PAID_PAD.x, PAID_PAD.z, SUMMIT.top + 0.3, '+5000 Wins')
  const treadmill = buildTreadmill(g, addCollider, {
    x: TREAD.x, z: TREAD.z, y: SUMMIT.top + 0.3, yaw: -Math.PI / 2, length: TREAD.len, width: TREAD.w, theme: 'galaxy', mult: TREAD.mult, labelY: 3.9,
    labels: [
      { text: '[x2 Boost]', size: 0.35, fill: '#ff5a9a', stroke: '#3a0a1a' },
      { text: `x${TREAD.mult} Hair`, size: 0.7, fill: ['#e0d0ff', '#b48aff'], stroke: '#1a0a3a' },
    ],
  })
  levelSign(g, ZONE14_LEVEL, [CX, T + 7, at(10)], { fill: ['#e0d0ff', '#b48aff'], stroke: '#1a0a3a' })
  label(g, [{ text: 'LOW GRAVITY!', size: 0.6, fill: ['#e0d0ff', '#b48aff'], stroke: '#1a0a3a' }, { text: 'BIG JUMPS', size: 0.9, fill: '#ffffff', stroke: '#1a0a3a' }], [CX, T + 5, at(20)], { unit: 1.4 })
  label(g, [{ text: 'RIDE A ROCK ROUND!', size: 0.5, fill: ['#e0d0ff', '#b48aff'], stroke: '#1a0a3a' }], [CX, ORBIT.top + 6, at(ROCKS[2].e1)], { unit: 1.4 })
  const checkpoints = createCheckpoints(CHECKPOINTS)

  const inZone = (p) => p.z <= ZONE14_Z0 && p.z > at(END_E) && Math.abs(p.x - CX) < SIDE
  let bonus = false
  let won = false
  return {
    treadmills: [treadmill], // main.js runs them with the Hub's
    // From Zone 13's lift to the palace's back wall (low gravity throughout).
    contains: inZone,
    // The checkpoint a fall puts you back on.
    spawn: () => checkpoints.spot(),
    // Returns 'fell' (off into the stars), 'bonus' (through the ring) or 'finish' (the win pad). `carry` false while the player rides the cable.
    update(dt, time, p, carry = true) {
      movers.update(time, p, carry)
      ring.update(time)
      pad.update(time)
      treadmill.update(dt, time)
      comets.forEach((c, i) => {
        const [x0, e0, y0, drift, speed] = COMETS[i]
        const f = ((time * speed + i * 37) % COMET_LEN) / COMET_LEN
        c.position.set(CX + x0 + drift * f, T + y0 + Math.sin(f * Math.PI) * 6, at(e0 - COMET_LEN / 2 + f * COMET_LEN))
      })
      drifters.position.y = Math.sin(time * 0.3) * 0.8
      for (let i = 0; i < crystals.length; i++) {
        const c = crystals[i]
        c.rotation.y = time * 0.8 + i
        c.position.y += Math.sin(time * 1.4 + i) * 0.004
      }
      if (inZone(p)) checkpoints.update(p)
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
      checkpoints.reset()
    },
  }
}
