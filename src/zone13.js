// Zone 13: NEON SKYLINE. Through Zone 12's iron door, out onto the rooftops of a
// night city: dark towers with glowing window grids rise from a street 30 m below,
// neon strips run along every roof edge, holographic signs float over the skyline
// and hover cars cruise between the towers (Zone 14 builds the night dome and stars
// over both zones). Roof A has a helipad; roof B is swept by two pink LASER BEAMS,
// knee-high and crossing: jump over each as it passes. A HOVER TAXI shuttles from
// roof C to roof D (the +1 Win ring on its front edge, two more lasers). Past it the
// street is 28 m wide: only the hair cable crosses, to the anchor cube on the big
// neon billboard over roof E, the HAIR TOWER: the yellow win pad (the zone's wins), a
// cyan "+2000 Wins" pad (decoration), an x5 Hair treadmill, a neon crown and a lift
// at the back into Zone 14. A fall, or a zap, puts you back on the last checkpoint
// (roofs A, C, D or E). Procedural like Zones 2-12.
//
// Same scale as Zone 12 (1.8 m player): 4 m hops rising 0.5 m, a laser is cleared
// with feet 0.7 m up (a jump rises 1.28 m, ~0.45 s above the beam), and the 28 m
// gap needs the cable (reach 8 m + 2 m per hair length, well past it here).
import { BoxGeometry, CanvasTexture, CylinderGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping, SphereGeometry, SRGBColorSpace } from 'three'
import { kit, voxelTexture } from './lavaPath.js'
import { arrowTexture, decal } from './zone4.js'
import { ZONE12_EXIT } from './zone12.js'
import { label } from './lobby/labels.js'
import { buildTreadmill } from './lobby/treadmill.js'
import { makeCanvas } from './lobby/paint.js'
import { bonusRing, createCheckpoints, createMovers, floorDecal, levelSign, paidPad, winPad } from './zoneProps.js'

export const ZONE13_NAME = 'NEON SKYLINE'
export const ZONE13_BONUS = 1 // wins for the ring on roof D
export const ZONE13_WIN = 1000 // wins for the yellow pad on the Hair Tower
export const ZONE13_LEVEL = 330 // the recommended level on the sign
export const ZONE13_Z0 = ZONE12_EXIT.z // the entrance edge (Zone 12's iron door)

const CX = (ZONE12_EXIT.x0 + ZONE12_EXIT.x1) / 2 // the rooftops' centre line, in line with Zone 12's door
const T = ZONE12_EXIT.top // roof A, flush with Zone 12's forge hall
const at = (e) => ZONE13_Z0 - e // m north of the entrance -> world z
const STREET_Y = T - 30 // the street far below
const FALL_Y = T - 6 // feet below this = respawn
const SIDE = 45 // m either side of the centre line that counts as in the zone

// The rooftops, as distances north of the entrance (e0, e1 = near / far edge; half = half width; top; window colour).
const ROOFS = [
  { e0: 0, e1: 16, half: 7, top: T, win: 'cyan', name: 'A' },
  { e0: 20, e1: 40, half: 6, top: T + 0.5, win: 'pink', name: 'B' },
  { e0: 44, e1: 54, half: 5, top: T + 1, win: 'yellow', name: 'C' },
  { e0: 75, e1: 95, half: 7, top: T + 1.5, win: 'cyan', name: 'D' },
  { e0: 123, e1: 150, half: 9, top: T + 2, win: 'pink', name: 'E' },
]
const [ROOF_A, ROOF_B, ROOF_C, ROOF_D, ROOF_E] = ROOFS
const END_E = ROOF_E.e1
const TAXI = { e: 64, amp: 6.5, rate: 0.45, w: 4, h: 0.6, top: T + 1 } // the hover taxi (mover) shuttling along z between roofs C and D
// Laser beams [roof, centre e, sweep amplitude, rad/s, phase]: each sweeps along z over its roof, knee-high.
const LASERS = [[ROOF_B, 30, 8, 0.6, 0], [ROOF_B, 30, 8, 0.6, Math.PI], [ROOF_D, 85, 7, 0.7, 0], [ROOF_D, 85, 7, 0.7, Math.PI]]
const LASER = { height: 0.5, zapAbove: 0.7, reach: 0.35 } // m above the roof, feet below this are zapped, m either side of the beam that count
const BILLBOARD = { e: 124.5, h: 12, w: 8, panel: 5 } // the billboard frame on roof E's front: the cable's anchor
const RING = { x: CX, y: ROOF_D.top + 1.7, z: at(77.5), radius: 1.3, reach: 1.3 } // bonus ring standing on roof D's front; reach: m either side of its plane that count
const WIN_PAD = { x: CX - 3, z: at(130) }
const PAID_PAD = { x: CX - 5.5, z: at(136) } // the cyan "+2000 Wins" pad (decoration)
const TREAD = { x: CX + 4, z: at(133), len: 4.8, w: 2.4, mult: 5 } // the x5 Hair treadmill (m), console to the north
const LIFT = { e0: 147, e1: 150, half: 4, h: 5, door: { half: 2.5, h: 4 } } // the lift at the back of roof E
// The skyline either side [x offset, e, width, depth, top, window colour]; none reach the walking line.
const TOWERS = [
  [-19, 4, 10, 14, T + 12, 'pink'], [19, 2, 9, 12, T + 6, 'cyan'], [-21, 24, 12, 16, T + 26, 'cyan'], [20, 26, 10, 12, T - 4, 'yellow'],
  [-18, 48, 8, 10, T + 3, 'yellow'], [22, 48, 12, 14, T + 18, 'pink'], [-24, 66, 14, 16, T + 32, 'cyan'], [18, 68, 8, 8, T + 8, 'pink'],
  [-19, 90, 10, 12, T + 14, 'pink'], [21, 92, 12, 14, T + 22, 'cyan'], [-22, 112, 12, 14, T + 9, 'yellow'], [20, 110, 9, 10, T + 28, 'pink'],
  [-21, 136, 10, 12, T + 20, 'cyan'], [23, 138, 12, 16, T + 36, 'yellow'], [-36, 40, 14, 20, T + 16, 'pink'], [36, 80, 14, 22, T + 24, 'cyan'],
]
const HOLOS = [[-19, 4, T + 18, 'HAIR', '#ff5fd0'], [22, 48, T + 24, 'ZIP!', '#3fe8ff'], [-24, 66, T + 38, 'NEON', '#ffe11a'], [20, 110, T + 34, 'WOW', '#ff5fd0']] // holographic signs [x offset, e, y, text, colour]
const CARS = [[-16, 10, 0], [16, 8, 60], [-30, 12, 120]] // hover cars [x offset, m/s, start offset m] looping north over the street

// The lift door at the back of roof E, where Zone 14's moon base carries on north.
export const ZONE13_EXIT = { x0: CX - LIFT.door.half, x1: CX + LIFT.door.half, z: at(END_E), top: ROOF_E.top }

// Where a fall puts you before the first checkpoint: roof A, facing north.
export const ZONE13_SPAWN = { x: CX, y: T + 0.1, z: at(3) }
const CHECKPOINTS = [
  { z: at(0), spot: ZONE13_SPAWN },
  { z: at(ROOF_C.e0), spot: { x: CX, y: ROOF_C.top + 0.1, z: at(ROOF_C.e0 + 3) } },
  { z: at(ROOF_D.e0), spot: { x: CX, y: ROOF_D.top + 0.1, z: at(ROOF_D.e0 + 1) } }, // short of the lasers' sweep
  { z: at(ROOF_E.e0), spot: { x: CX, y: ROOF_E.top + 0.1, z: at(ROOF_E.e0 + 3) } },
]

const COL = {
  concrete: '#262a36',
  roof: '#1c1f2a',
  pink: '#ff3fc8',
  cyan: '#3fe8ff',
  yellow: '#ffe11a',
  steel: '#8a90a8',
}
const NEON = { pink: '#ff3fc8', cyan: '#3fe8ff', yellow: '#ffe11a' }

const tex = {}
function textures() {
  tex.roof = voxelTexture(COL.roof, { cells: 4, jitter: 0.05, grid: 0.3 })
  tex.concrete = voxelTexture(COL.concrete, { cells: 4, jitter: 0.06, grid: 0.3 })
  for (const c of Object.keys(NEON)) tex[c] = windowTexture(NEON[c], c)
  tex.street = streetTexture()
}

// A tower face: dark navy with a grid of windows in `color`, some dark. One tile covers ~4 m.
function windowTexture(color, name) {
  const c = makeCanvas(64)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#141830'
  ctx.fillRect(0, 0, 64, 64)
  let s = name.length * 31 + 7
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = rnd() < 0.3 ? '#0c0e1e' : color
      ctx.fillRect(4 + i * 16, 4 + j * 16, 9, 9)
    }
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

// The street: near-black with a faint cyan grid, as seen from the roofs.
function streetTexture() {
  const c = makeCanvas(64)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#070812'
  ctx.fillRect(0, 0, 64, 64)
  ctx.strokeStyle = 'rgba(63,232,255,0.35)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, 62, 62)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

// A helipad mark: a yellow ring with an H.
function helipadTexture() {
  const c = makeCanvas(128)
  const ctx = c.getContext('2d')
  ctx.strokeStyle = COL.yellow
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(64, 64, 54, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 12
  ctx.beginPath()
  ctx.moveTo(40, 34)
  ctx.lineTo(40, 94)
  ctx.moveTo(88, 34)
  ctx.lineTo(88, 94)
  ctx.moveTo(40, 64)
  ctx.lineTo(88, 64)
  ctx.stroke()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

let mats = null
const material = (k) => (mats ??= {
  concrete: k.std(COL.concrete, { roughness: 0.9 }),
  steel: k.std(COL.steel, { metalness: 0.6, roughness: 0.4 }),
  dark: k.std('#101220', { roughness: 0.8 }),
  pink: k.std(COL.pink, { emissive: COL.pink, emissiveIntensity: 0.9, roughness: 0.3 }),
  cyan: k.std(COL.cyan, { emissive: COL.cyan, emissiveIntensity: 0.9, roughness: 0.3 }),
  yellow: k.std(COL.yellow, { emissive: COL.yellow, emissiveIntensity: 0.8, roughness: 0.3 }),
  red: k.std('#ff2a2a', { emissive: '#ff0000', emissiveIntensity: 1, roughness: 0.3 }),
  cube: k.std('#3a5cff', { emissive: '#2040ff', emissiveIntensity: 0.9, roughness: 0.3 }),
  glass: k.std('#8fd8ff', { emissive: '#3fa8ff', emissiveIntensity: 0.3, transparent: true, opacity: 0.5, roughness: 0.1 }),
  beam: new MeshBasicMaterial({ color: '#ff5fd0', transparent: true, opacity: 0.85 }),
})

// A rooftop: a tower from the street up to its roof (window faces), a dark roof slab, neon strips along the edges. Returns nothing; props go on top.
function roof(k, r, x = CX) {
  const m = material(k)
  const z0 = at(r.e0)
  const z1 = at(r.e1)
  k.voxSpan(x - r.half, x + r.half, z0, z1, { y0: STREET_Y, y1: r.top - 0.4, side: tex[r.win], top: tex.roof, cell: 4, collide: false, cast: false })
  k.voxSpan(x - r.half - 0.2, x + r.half + 0.2, z0 + 0.2, z1 - 0.2, { y0: r.top - 0.4, y1: r.top, side: tex.concrete, top: tex.roof, cell: 2, collide: false, cast: false })
  k.addCollider(x, (z0 + z1) / 2, r.half * 2, r.e1 - r.e0, r.top, 0, STREET_Y)
  const neon = r.win === 'pink' ? m.pink : r.win === 'cyan' ? m.cyan : m.yellow
  for (const e of [r.e0, r.e1]) k.mesh(new BoxGeometry(r.half * 2 + 0.3, 0.15, 0.15), neon, x, r.top - 0.1, at(e), { cast: false })
  for (const s of [-1, 1]) k.mesh(new BoxGeometry(0.15, 0.15, r.e1 - r.e0), neon, x + s * (r.half + 0.08), r.top - 0.1, (z0 + z1) / 2, { cast: false })
}

// An AC unit: a grey box with a dark fan disc on top.
function acUnit(k, x, z, base) {
  const m = material(k)
  k.mesh(new BoxGeometry(1.6, 1, 1.6), m.steel, x, base + 0.5, z, { cast: false })
  k.mesh(new CylinderGeometry(0.6, 0.6, 0.1, 10), m.dark, x, base + 1.05, z, { cast: false })
  k.addCollider(x, z, 1.6, 1.6, base + 1, 0, base)
}

// An antenna mast with a red beacon on top; solid, so the cable can grab it. Returns the beacon (blinked in update).
function mast(k, x, z, base, h) {
  const m = material(k)
  k.mesh(new CylinderGeometry(0.12, 0.3, h, 6), m.steel, x, base + h / 2, z, { cast: false })
  for (const y of [0.35, 0.65]) k.mesh(new BoxGeometry(1.4, 0.1, 0.1), m.steel, x, base + h * y, z, { cast: false })
  k.addCollider(x, z, 0.6, 0.6, base + h, 0, base)
  return k.mesh(new SphereGeometry(0.25, 8, 6), m.red, x, base + h + 0.2, z, { cast: false })
}

// A water tank on four legs.
function waterTank(k, x, z, base) {
  const m = material(k)
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.mesh(new BoxGeometry(0.2, 2, 0.2), m.steel, x + sx * 0.9, base + 1, z + sz * 0.9, { cast: false })
  k.mesh(new CylinderGeometry(1.3, 1.3, 2.4, 12), m.dark, x, base + 3.2, z, { cast: false })
  k.mesh(new CylinderGeometry(1.35, 0.3, 0.6, 12), m.steel, x, base + 4.7, z, { cast: false })
  k.addCollider(x, z, 2.6, 2.6, base + 5, 0, base)
}

// A laser: a pink beam across the roof between two emitter boxes, sweeping along z. Returns the group (moved in update).
function laser(k, [r, e, amp, rate, phase]) {
  const m = material(k)
  const g = new Group()
  const beam = new Mesh(new CylinderGeometry(0.12, 0.12, r.half * 2, 6), m.beam)
  beam.rotation.z = Math.PI / 2
  g.add(beam)
  for (const s of [-1, 1]) {
    const em = new Mesh(new BoxGeometry(0.6, 0.9, 0.6), m.dark)
    em.position.set(s * (r.half + 0.1), -LASER.height + 0.45, 0)
    g.add(em)
    const lamp = new Mesh(new BoxGeometry(0.3, 0.3, 0.3), m.pink)
    lamp.position.set(s * (r.half + 0.1), 0, 0)
    g.add(lamp)
  }
  g.position.set(CX, r.top + LASER.height, at(e))
  g.userData = { r, e, amp, rate, phase }
  k.g.add(g)
  return g
}

// The hover taxi (mover): a neon-edged pad with a cabin and thrusters.
function taxi(k) {
  const m = material(k)
  const g = new Group()
  const pad = new Mesh(new BoxGeometry(TAXI.w, TAXI.h, TAXI.w), m.dark)
  pad.position.y = -TAXI.h / 2
  pad.receiveShadow = true
  g.add(pad)
  const rim = new Mesh(new BoxGeometry(TAXI.w + 0.2, 0.12, TAXI.w + 0.2), m.cyan)
  rim.position.y = -0.1
  g.add(rim)
  const cabin = new Mesh(new BoxGeometry(1.4, 1, 1.2), m.glass)
  cabin.position.set(0, 0.5, -TAXI.w / 2 + 0.7)
  g.add(cabin)
  for (const s of [-1, 1]) {
    const th = new Mesh(new CylinderGeometry(0.35, 0.5, 0.6, 8), m.cyan)
    th.position.set(s * (TAXI.w / 2 - 0.5), -TAXI.h - 0.3, 0)
    g.add(th)
  }
  k.g.add(g)
  return g
}

// The billboard on roof E's front: two posts and a panel with a neon sign, the blue anchor cube on its face with an arrow under it.
function billboard(k) {
  const m = material(k)
  const b = BILLBOARD
  const z = at(b.e)
  const base = ROOF_E.top
  for (const s of [-1, 1]) {
    k.mesh(new BoxGeometry(0.5, b.h, 0.5), m.steel, CX + s * (b.w / 2 - 0.5), base + b.h / 2, z, { cast: false })
    k.addCollider(CX + s * (b.w / 2 - 0.5), z, 0.5, 0.5, base + b.h, 0, base)
  }
  const py = base + b.h - b.panel / 2
  k.mesh(new BoxGeometry(b.w, b.panel, 0.6), m.dark, CX, py, z, { cast: false })
  k.mesh(new BoxGeometry(b.w + 0.4, b.panel + 0.4, 0.2), m.pink, CX, py, z - 0.1, { cast: false })
  k.addCollider(CX, z, b.w, 0.6, base + b.h, 0, py - b.panel / 2)
  const cube = k.mesh(new BoxGeometry(1.3, 1.3, 1.3), m.cube, CX, py + 0.6, z + 0.8, { cast: false })
  cube.rotation.set(0.3, 0.5, 0.2)
  decal(k, arrowTexture(COL.yellow), CX, py - 1.4, z + 0.3, 1.2, 1.2)
  label(k.g, [{ text: 'HAIR TOWER', size: 0.6, fill: ['#ffd0f0', '#ff3fc8'], stroke: '#3a0a2a', bg: '#1a0a2a', border: '#ff3fc8' }], [CX, base + b.h + 1.5, z], { unit: 1.6 })
}

// A hologram sign floating over a tower.
function holo(k, [dx, e, y, text, color]) {
  label(k.g, [{ text, size: 1, fill: color, stroke: '#0a0a1a', bg: 'rgba(10,10,30,0.7)', border: color }], [CX + dx, y, at(e)], { unit: 2 })
}

// A hover car: a rounded body with a glass top and a tail light. Returns the group (flown in update).
function car(k) {
  const m = material(k)
  const g = new Group()
  g.add(new Mesh(new BoxGeometry(1.8, 0.5, 3.2), m.steel))
  const top = new Mesh(new BoxGeometry(1.4, 0.5, 1.6), m.glass)
  top.position.y = 0.45
  g.add(top)
  const tail = new Mesh(new BoxGeometry(1.4, 0.2, 0.1), m.red)
  tail.position.set(0, 0, 1.6)
  g.add(tail)
  const head = new Mesh(new BoxGeometry(1.4, 0.2, 0.1), m.yellow)
  head.position.set(0, 0, -1.6)
  g.add(head)
  k.g.add(g)
  return g
}

// --- The shell: street, skyline, holograms --------------------------------------
function buildShell(k) {
  const street = tex.street
  street.repeat.set(SIDE * 2 / 4, (END_E + 30) / 4)
  const road = k.mesh(new PlaneGeometry(SIDE * 2, END_E + 30), new MeshBasicMaterial({ map: street }), CX, STREET_Y, at(END_E / 2), { cast: false })
  road.rotation.x = -Math.PI / 2
  road.receiveShadow = false
  const beacons = []
  TOWERS.forEach(([dx, e, w, d, top, win], i) => {
    const x = CX + dx
    k.voxSpan(x - w / 2, x + w / 2, at(e), at(e + d), { y0: STREET_Y, y1: top, side: tex[win], top: tex.roof, cell: 4, cast: false })
    const neon = material(k)[win]
    k.mesh(new BoxGeometry(w + 0.2, 0.2, 0.2), neon, x, top - 0.1, at(e), { cast: false })
    k.mesh(new BoxGeometry(0.2, top - STREET_Y, 0.2), neon, x + (dx < 0 ? w / 2 : -w / 2) + 0.05, (top + STREET_Y) / 2, at(e) + 0.1, { cast: false })
    if (i % 3 === 0) beacons.push(mast(k, x, at(e + d / 2), top, 6 + (i % 2) * 3))
  })
  for (const h of HOLOS) holo(k, h)
  return beacons
}

// --- The course: the five roofs and what stands on them --------------------------------
function buildCourse(k, movers) {
  const m = material(k)
  const arrowMat = arrowTexture(COL.yellow)
  for (const r of ROOFS) roof(k, r)
  // Roof A: the helipad, an AC unit, a mast and the entrance sign.
  floorDecal(k, helipadTexture(), CX, ROOF_A.top, at(8), 7)
  acUnit(k, CX - 5.5, at(13), ROOF_A.top)
  const beacons = [mast(k, CX + 5.5, at(3), ROOF_A.top, 8)]
  // Roof B: the two sweeping lasers, AC units on the sides.
  const lasers = LASERS.map((l) => laser(k, l))
  acUnit(k, CX - 4.8, at(21.2), ROOF_B.top)
  acUnit(k, CX + 4.8, at(38.8), ROOF_B.top)
  floorDecal(k, arrowMat, CX, ROOF_B.top, at(21.5), 2)
  // Roof C: the taxi stop (a neon kerb) and the taxi itself.
  k.mesh(new BoxGeometry(4.4, 0.3, 0.3), m.cyan, CX, ROOF_C.top + 0.15, at(ROOF_C.e1) + 0.3, { cast: false })
  label(k.g, [{ text: 'HOVER TAXI', size: 0.5, fill: ['#d6fbff', '#3fe8ff'], stroke: '#0a2a3a' }], [CX, ROOF_C.top + 4, at(ROOF_C.e1)], { unit: 1.3 })
  const tx = taxi(k)
  movers.add(tx, { w: TAXI.w, d: TAXI.w, h: TAXI.h, path: (time, out) => {
    out.x = CX
    out.y = TAXI.top + Math.sin(time * 1.3) * 0.08
    out.z = at(TAXI.e + TAXI.amp * Math.sin(time * TAXI.rate))
  } })
  // Roof D: the ring, the water tank, more lasers.
  waterTank(k, CX - 5, at(92), ROOF_D.top)
  acUnit(k, CX + 5.5, at(92.5), ROOF_D.top)
  // Roof E: the billboard anchor, pads, treadmill, crown, mast and the lift.
  billboard(k)
  beacons.push(mast(k, CX + 7, at(144), ROOF_E.top, 10))
  for (let i = 0; i < 5; i++) {
    const a = -0.6 + i * 0.3
    k.mesh(new BoxGeometry(0.4, 2 + (i === 2 ? 1 : 0), 0.4), m.yellow, CX - 6 + Math.sin(a) * 4, ROOF_E.top + 1 + (i === 2 ? 0.5 : 0), at(142) + Math.cos(a) * 1.5, { cast: false })
  }
  k.mesh(new BoxGeometry(6, 0.4, 0.4), m.yellow, CX - 6, ROOF_E.top + 0.2, at(141.2), { cast: false }) // the crown's band
  const l = LIFT
  const z0 = at(l.e0)
  const z1 = at(l.e1)
  k.voxSpan(CX - l.half, CX - l.door.half, z0, z1, { y0: ROOF_E.top, y1: ROOF_E.top + l.h, side: tex.concrete, top: tex.roof, cell: 2, cast: false })
  k.voxSpan(CX + l.door.half, CX + l.half, z0, z1, { y0: ROOF_E.top, y1: ROOF_E.top + l.h, side: tex.concrete, top: tex.roof, cell: 2, cast: false })
  k.voxSpan(CX - l.door.half, CX + l.door.half, z0, z1, { y0: ROOF_E.top + l.door.h, y1: ROOF_E.top + l.h, side: tex.concrete, top: tex.roof, cell: 2, cast: false })
  k.mesh(new BoxGeometry(l.door.half * 2 + 0.4, 0.3, 0.3), m.cyan, CX, ROOF_E.top + l.door.h + 0.15, z0 + 0.2, { cast: false })
  for (const s of [-1, 1]) k.mesh(new BoxGeometry(0.3, l.door.h, 0.3), m.cyan, CX + s * (l.door.half + 0.15), ROOF_E.top + l.door.h / 2, z0 + 0.2, { cast: false })
  decal(k, arrowMat, CX, ROOF_E.top + l.door.h - 0.9, z0, 1.4, 1.4)
  label(k.g, [{ text: 'STAR SUMMIT →', size: 0.5, fill: ['#e0d0ff', '#b48aff'], stroke: '#1a0a3a' }], [CX, ROOF_E.top + l.h + 1.6, z0], { unit: 1.4 })
  return { lasers, beacons }
}

export function buildZone13(scene, addCollider) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)
  textures()
  const movers = createMovers(addCollider)

  const skyBeacons = buildShell(k)
  const { lasers, beacons } = buildCourse(k, movers)
  beacons.push(...skyBeacons)
  const cars = CARS.map(() => car(k))
  const ring = bonusRing(k, RING, ZONE13_BONUS)
  const pad = winPad(k, WIN_PAD.x, WIN_PAD.z, ROOF_E.top, ZONE13_WIN)
  paidPad(k, PAID_PAD.x, PAID_PAD.z, ROOF_E.top, '+2000 Wins')
  const treadmill = buildTreadmill(g, addCollider, {
    x: TREAD.x, z: TREAD.z, y: ROOF_E.top, yaw: -Math.PI / 2, length: TREAD.len, width: TREAD.w, theme: 'neon', mult: TREAD.mult, labelY: 3.9,
    labels: [
      { text: '[x2 Boost]', size: 0.35, fill: '#ff5a9a', stroke: '#3a0a1a' },
      { text: `x${TREAD.mult} Hair`, size: 0.7, fill: ['#ffd0f0', '#ff5fd0'], stroke: '#3a0a2a' },
    ],
  })
  levelSign(g, ZONE13_LEVEL, [CX, T + 7, at(10)], { fill: ['#ffd0f0', '#ff5fd0'], stroke: '#3a0a2a' })
  label(g, [{ text: 'JUMP THE LASERS!', size: 0.5, fill: ['#ffd0f0', '#ff5fd0'], stroke: '#3a0a2a' }], [CX, ROOF_B.top + 4.5, at(ROOF_B.e0 + 1)], { unit: 1.4 })
  label(g, [
    { text: 'HAIR CABLE ONLY', size: 0.45, fill: ['#7ff6ff', '#3fd8ff'], stroke: '#0a2a3a' },
    { text: 'SPACE = ZIP', size: 0.9, fill: '#ffffff', stroke: '#2a0a4a' },
  ], [CX, ROOF_D.top + 9, at(ROOF_D.e1 + 2)], { unit: 2 })
  const checkpoints = createCheckpoints(CHECKPOINTS)

  const inZone = (p) => p.z <= ZONE13_Z0 && p.z > at(END_E) && Math.abs(p.x - CX) < SIDE
  const zapped = (p) => {
    for (const l of lasers) {
      const { r } = l.userData
      if (Math.abs(p.z - l.position.z) < LASER.reach && p.y < r.top + LASER.zapAbove && p.y > r.top - 0.5 && Math.abs(p.x - CX) < r.half) return true
    }
    return false
  }
  let bonus = false
  let won = false
  return {
    treadmills: [treadmill], // main.js runs them with the Hub's
    // From Zone 12's door to the lift at the back of roof E.
    contains: inZone,
    // The checkpoint a fall or a zap puts you back on.
    spawn: () => checkpoints.spot(),
    // Returns 'fell' (the street), 'zapped' (a laser), 'bonus' (through the ring) or 'finish' (the win pad). `carry` false while the player rides the cable.
    update(dt, time, p, carry = true) {
      movers.update(time, p, carry)
      ring.update(time)
      pad.update(time)
      treadmill.update(dt, time)
      for (const l of lasers) {
        const { e, amp, rate, phase } = l.userData
        l.position.z = at(e + amp * Math.sin(time * rate + phase))
      }
      const blink = Math.sin(time * 4) > 0
      for (const b of beacons) b.visible = blink
      cars.forEach((c, i) => {
        const [dx, speed, offset] = CARS[i]
        c.position.set(CX + dx, T + 10 + Math.sin(time + i) * 0.5, at(((time * speed + offset) % (END_E + 30)) - 15))
      })
      if (inZone(p)) checkpoints.update(p)
      if (inZone(p) && p.y < FALL_Y) return 'fell'
      if (zapped(p)) return 'zapped'
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
