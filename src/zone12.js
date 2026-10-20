// Zone 12: MAGMA FORGE. Through the serpent doorway in Zone 11's temple, an iron
// deck looks down a hall carved inside a volcano: black obsidian walls veined with
// glowing orange seams, lava falls pouring down them, chains hanging from a rock
// ceiling split by a glowing crack, embers drifting in the heat, and a lake of lava
// a few metres below. Four SINKING BLOCKS cross it: each sinks while you stand on it
// and rises again once you leave, so keep moving. The forge deck beyond holds a
// furnace and an anvil, and the +1 Win ring. Then three giant SPINNING GEARS bridge
// the lava to the forge hall: the yellow win pad (the zone's wins), a cyan "+1500
// Wins" pad (decoration), an x4 Hair treadmill, the great hammer and a crucible, and
// the iron door at the back into Zone 13. Dropping into the lava puts you back on the
// last checkpoint (deck, forge deck or hall). Procedural like Zones 2-11.
//
// Same scale as Zone 11 (1.8 m player): 2-5 m hops; a block burns you ~1.4 s after
// you land on it (SINK), so each one is a hop, not a rest.
import { BoxGeometry, BufferGeometry, CanvasTexture, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Points, PointsMaterial, Quaternion, RepeatWrapping, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3 } from 'three'
import { kit, lavaTexture, voxelTexture } from './lavaPath.js'
import { arrowTexture, decal } from './zone4.js'
import { ZONE11_EXIT } from './zone11.js'
import { label } from './lobby/labels.js'
import { buildTreadmill } from './lobby/treadmill.js'
import { makeCanvas } from './lobby/paint.js'
import { bonusRing, createCheckpoints, floorDecal, levelSign, paidPad, winPad } from './zoneProps.js'

export const ZONE12_NAME = 'MAGMA FORGE'
export const ZONE12_BONUS = 1 // wins for the ring on the forge deck
export const ZONE12_WIN = 750 // wins for the yellow pad in the forge hall
export const ZONE12_LEVEL = 300 // the recommended level on the sign
export const ZONE12_Z0 = ZONE11_EXIT.z // the entrance edge (Zone 11's serpent doorway)

const CX = (ZONE11_EXIT.x0 + ZONE11_EXIT.x1) / 2 // the hall's centre line, in line with Zone 11's doorway
const T = ZONE11_EXIT.top // the iron deck, flush with Zone 11's temple top
const at = (e) => ZONE12_Z0 - e // m north of the entrance -> world z
const HALF = 12 // m, half the hall's inner width
const WALL = { thick: 3, top: T + 22 } // obsidian side walls; the rock ceiling sits on them
const LAVA_Y = T - 4 // the lava lake
const BURN_Y = T - 1.6 // feet below this = burned (a sunk block gets you there)

// The course, as distances north of the entrance.
const START = { e0: 0, e1: 12, half: 7, top: T }
const SINKERS = [{ e: 16, dx: -2 }, { e: 23, dx: 2 }, { e: 30, dx: -2 }, { e: 37, dx: 2 }] // 4 x 4 m blocks (centre e, x offset)
const SINK = { size: 4, top: T + 0.3, depth: 2.6, rate: 1.4, rise: 1 } // m, m, m it sinks, m/s down while stood on, m/s back up
const FORGE = { e0: 44, e1: 56, half: 9, top: T + 0.3 }
const GEARS = [61, 68, 75] // gear centres (e); radius 3, each spinning the other way from its neighbour
const GEAR = { r: 3, half: 2.5, top: T + 0.3, teeth: 10, rate: 0.5 } // m, m walkable half-width, m, count, rad/s
const FINAL = { e0: 80, e1: 100, half: 10, top: T + 0.3 }
const BACK = { e0: 100, e1: 104, door: { half: 2.5, h: 4.5 } } // the back wall and its iron door into Zone 13
const END_E = BACK.e1
const RING = { x: CX, y: FORGE.top + 1.7, z: at(46), radius: 1.3, reach: 1.3 } // bonus ring standing on the forge deck's front; reach: m either side of its plane that count
const WIN_PAD = { x: CX - 3, z: at(86) }
const PAID_PAD = { x: CX - 5.5, z: at(92) } // the cyan "+1500 Wins" pad (decoration)
const TREAD = { x: CX + 4, z: at(89), len: 4.8, w: 2.4, mult: 4 } // the x4 Hair treadmill (m), console to the north
const FALLS = [[-1, 20], [1, 50], [-1, 70], [1, 92]] // lava falls [side, e] on the walls
const CHAINS = [[-7, 48], [7, 48], [-7, 86], [7, 86], [0, 64]] // chains hanging from the ceiling [x offset, e]
const CHAIN = { links: 14, link: 0.7 } // links per chain, m per link
const EMBERS = 220

// The iron door through the back wall, where Zone 13's first rooftop carries on north.
export const ZONE12_EXIT = { x0: CX - BACK.door.half, x1: CX + BACK.door.half, z: at(END_E), top: FINAL.top }

// Where a fall puts you before the first checkpoint: the iron deck, facing the lava.
export const ZONE12_SPAWN = { x: CX, y: T + 0.1, z: at(3) }
const CHECKPOINTS = [
  { z: at(0), spot: ZONE12_SPAWN },
  { z: at(FORGE.e0), spot: { x: CX, y: FORGE.top + 0.1, z: at(FORGE.e0 + 4) } },
  { z: at(FINAL.e0), spot: { x: CX, y: FINAL.top + 0.1, z: at(FINAL.e0 + 3) } },
]

const COL = {
  iron: '#4a4a55',
  ironDark: '#2e2e36',
  obsidian: '#1e1826',
  rock: '#2a2030',
  orange: '#ff7a1a',
  yellow: '#ffd21a',
}

const tex = {}
function textures() {
  tex.iron = voxelTexture(COL.iron, { cells: 4, jitter: 0.08, grid: 0.4 })
  tex.ironDark = voxelTexture(COL.ironDark, { cells: 4, jitter: 0.08, grid: 0.3 })
  tex.obsidian = obsidianTexture()
  tex.rock = voxelTexture(COL.rock, { cells: 4, jitter: 0.12, grid: 0.3 })
}

// Obsidian: near-black blocks veined with thin glowing orange seams (the walls and blocks).
function obsidianTexture() {
  const c = makeCanvas(128)
  const ctx = c.getContext('2d')
  ctx.fillStyle = COL.obsidian
  ctx.fillRect(0, 0, 128, 128)
  let s = 12
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? '#241c2e' : '#171220'
    ctx.fillRect(rnd() * 128, rnd() * 128, 16 + rnd() * 30, 16 + rnd() * 30)
  }
  ctx.strokeStyle = COL.orange
  ctx.lineWidth = 2
  for (let i = 0; i < 6; i++) {
    ctx.beginPath()
    let x = rnd() * 128
    let y = rnd() * 128
    ctx.moveTo(x, y)
    for (let j = 0; j < 5; j++) {
      x += (rnd() - 0.5) * 40
      y += (rnd() - 0.5) * 40
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

// A lava texture clone (clones share the canvas upload) with its own repeat, for the lake and the falls.
function lava(rx, ry) {
  const t = lavaTexture().clone()
  t.repeat.set(rx, ry)
  return t
}

let mats = null
const material = (k) => (mats ??= {
  iron: k.std(COL.iron, { metalness: 0.6, roughness: 0.4 }),
  ironDark: k.std(COL.ironDark, { metalness: 0.6, roughness: 0.5 }),
  obsidian: k.std(COL.obsidian, { roughness: 0.4, metalness: 0.2 }),
  glow: k.std('#ff9a2a', { emissive: '#ff6a00', emissiveIntensity: 1.1, roughness: 0.4 }),
  ember: k.std('#ff5a1a', { emissive: '#ff3a00', emissiveIntensity: 0.8, roughness: 0.5 }),
  gold: k.std('#ffcf1f', { emissive: '#d99a00', emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.3 }),
  wood: k.std('#5a3a20', { roughness: 0.9 }),
  lavaFall: new MeshBasicMaterial({ map: lava(1, 5) }),
})

// Tiny seeded generator so the forge looks the same every load.
let seed = 12
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const between = (a, b) => a + rand() * (b - a)

// A walkable iron deck on obsidian footings from the lava bed to `top`, orange strip lights along its north and south edges.
function deck(k, x0, x1, e0, e1, top) {
  const m = material(k)
  k.voxSpan(x0, x1, at(e0), at(e1), { y0: LAVA_Y - 2, y1: top - 0.6, side: tex.obsidian, cell: 3, collide: false, cast: false })
  k.voxSpan(x0, x1, at(e0), at(e1), { y0: top - 0.6, y1: top, side: tex.ironDark, top: tex.iron, cell: 1, collide: false, cast: false })
  k.addCollider((x0 + x1) / 2, (at(e0) + at(e1)) / 2, x1 - x0, e1 - e0, top, 0, LAVA_Y - 2)
  for (const e of [e0, e1]) k.mesh(new BoxGeometry(x1 - x0 + 0.1, 0.18, 0.18), m.glow, (x0 + x1) / 2, top - 0.1, at(e), { cast: false })
}

// A rune pillar: an obsidian column against a side wall with an orange strip light and a glowing cap.
function pillar(k, s, e) {
  const m = material(k)
  const x = CX + s * (HALF - 0.9)
  k.voxSpan(x - 0.9, x + 0.9, at(e) + 0.9, at(e) - 0.9, { y0: LAVA_Y - 2, y1: WALL.top, side: tex.obsidian, cell: 3, cast: false })
  k.mesh(new BoxGeometry(0.2, WALL.top - T - 4, 0.3), m.glow, x - s * 0.95, (WALL.top + T) / 2, at(e), { cast: false })
  k.mesh(new BoxGeometry(2.2, 0.4, 2.2), m.ember, x, WALL.top - 2, at(e), { cast: false })
}

// A sinking block: obsidian with an iron top, a glowing seam round it. Returns its state for update.
function sinker(k, sk) {
  const x = CX + sk.dx
  const z = at(sk.e)
  const h = SINK.top - (LAVA_Y - 1)
  const mesh = k.voxBox({ x, z, w: SINK.size, d: SINK.size, y0: LAVA_Y - 1, y1: SINK.top, side: tex.obsidian, top: tex.iron, cell: 2, collide: false, cast: false })
  const seam = k.mesh(new BoxGeometry(SINK.size + 0.2, 0.2, SINK.size + 0.2), material(k).glow, x, SINK.top - 0.2, z, { cast: false })
  const box = k.addCollider(x, z, SINK.size, SINK.size, SINK.top, 0, LAVA_Y - 1)
  return { mesh, seam, box, baseY: mesh.position.y, seamY: seam.position.y, depth: 0, h }
}

// A giant gear lying flat on the lava: a toothed iron disc on a hub, its square walkable top at GEAR.top. Returns the group, spun in update.
function gear(k, e, dir) {
  const m = material(k)
  const g = new Group()
  g.position.set(CX, GEAR.top, at(e))
  const disc = new Mesh(new CylinderGeometry(GEAR.r, GEAR.r, 0.8, 24), m.iron)
  disc.position.y = -0.4
  disc.receiveShadow = true
  g.add(disc)
  const tooth = new BoxGeometry(1, 0.8, 0.9)
  for (let i = 0; i < GEAR.teeth; i++) {
    const a = (i / GEAR.teeth) * Math.PI * 2
    const t = new Mesh(tooth, m.ironDark)
    t.position.set(Math.cos(a) * (GEAR.r + 0.3), -0.4, Math.sin(a) * (GEAR.r + 0.3))
    t.rotation.y = -a
    g.add(t)
  }
  const hub = new Mesh(new CylinderGeometry(0.7, 0.7, 0.8, 10), m.ember)
  hub.position.y = 0.1 // its top is a 0.5 m step: walked over, not round
  g.add(hub)
  const axle = new Mesh(new CylinderGeometry(0.5, 0.5, GEAR.top - LAVA_Y + 1, 8), m.ironDark)
  axle.position.y = -(GEAR.top - LAVA_Y + 1) / 2
  g.add(axle)
  k.g.add(g)
  k.addCollider(CX, at(e), GEAR.half * 2, GEAR.half * 2, GEAR.top, 0, LAVA_Y - 1)
  k.addCollider(CX, at(e), 1.4, 1.4, GEAR.top + 0.5, 0, GEAR.top) // the hub
  g.userData.dir = dir
  return g
}

// --- The shell: walls, pillars, ceiling with its crack, lava lake, falls, chains, embers --
function buildShell(k) {
  const m = material(k)
  const z0 = ZONE12_Z0
  const zEnd = at(END_E)
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [CX - HALF - WALL.thick, CX - HALF] : [CX + HALF, CX + HALF + WALL.thick]
    k.voxSpan(x0, x1, z0, zEnd, { y1: WALL.top, side: tex.obsidian, cell: 4, cast: false })
    for (let e = 8; e < END_E - 4; e += 14) pillar(k, s, e)
  }
  k.voxSpan(CX - HALF - WALL.thick, CX + HALF + WALL.thick, z0, zEnd, { y0: WALL.top, y1: WALL.top + 3, side: tex.rock, cell: 4, collide: false, cast: false }) // the rock ceiling
  const crack = k.mesh(new PlaneGeometry(2.2, END_E - 6), new MeshBasicMaterial({ map: lava(1, 12) }), CX, WALL.top - 0.05, at(END_E / 2), { cast: false })
  crack.rotation.x = Math.PI / 2
  crack.receiveShadow = false
  // The lava lake (visual: a burn respawns before it).
  const lake = k.mesh(new PlaneGeometry(HALF * 2, END_E - 4), new MeshBasicMaterial({ map: lava(6, 25) }), CX, LAVA_Y, at(END_E / 2 - 2), { cast: false })
  lake.rotation.x = -Math.PI / 2
  lake.receiveShadow = false
  // Lava falls: a scrolling lava sheet down a wall from the ceiling into the lake, a glow at its foot.
  for (const [s, e] of FALLS) {
    const h = WALL.top - LAVA_Y
    const f = k.mesh(new PlaneGeometry(4, h), m.lavaFall, CX + s * (HALF - 0.08), LAVA_Y + h / 2, at(e), { cast: false })
    f.rotation.y = -s * Math.PI / 2
    f.receiveShadow = false
    k.mesh(new BoxGeometry(5, 0.3, 2.5), m.glow, CX + s * (HALF - 1.2), LAVA_Y + 0.1, at(e), { cast: false })
  }
  // Chains: one instanced torus for every link, alternating orientation.
  const chain = new InstancedMesh(new TorusGeometry(0.28, 0.08, 6, 12), m.iron, CHAINS.length * CHAIN.links)
  const mtx = new Matrix4()
  const q = new Quaternion()
  const pos = new Vector3()
  const scl = new Vector3(1, 1, 1)
  const up = new Vector3(0, 1, 0)
  let i = 0
  for (const [dx, e] of CHAINS) {
    for (let l = 0; l < CHAIN.links; l++) {
      q.setFromAxisAngle(up, l % 2 ? Math.PI / 2 : 0)
      mtx.compose(pos.set(CX + dx, WALL.top - 0.3 - l * (CHAIN.link - 0.2), at(e)), q, scl)
      chain.setMatrixAt(i++, mtx)
    }
    // A hook or a cauldron at the end of the longer chains.
    const end = WALL.top - 0.3 - CHAIN.links * (CHAIN.link - 0.2)
    k.mesh(new SphereGeometry(0.9, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.ironDark, CX + dx, end - 0.4, at(e), { cast: false })
    k.mesh(new CylinderGeometry(0.75, 0.75, 0.2, 12), m.glow, CX + dx, end - 0.35, at(e), { cast: false })
  }
  chain.instanceMatrix.needsUpdate = true
  chain.castShadow = chain.receiveShadow = false
  k.g.add(chain)
  // Embers drifting in the heat: one point cloud.
  const n = EMBERS
  const arr = new Float32Array(n * 3)
  for (let j = 0; j < n; j++) {
    arr[j * 3] = CX + between(-HALF + 1, HALF - 1)
    arr[j * 3 + 1] = T + between(0.5, 16)
    arr[j * 3 + 2] = at(between(2, END_E - 4))
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(arr, 3))
  const embers = new Points(geo, new PointsMaterial({ color: '#ffb03a', size: 0.14, transparent: true, opacity: 0.9 }))
  k.g.add(embers)
  return embers
}

// --- The forge props: furnace, anvil, hammer, crucible -----------------------------
function furnace(k, x, z, base) {
  const m = material(k)
  k.voxSpan(x - 2.5, x + 2.5, z + 2, z - 2, { y0: base, y1: base + 4, side: tex.obsidian, top: tex.rock, cell: 2, cast: false })
  k.mesh(new BoxGeometry(2.4, 2, 0.3), m.glow, x, base + 1.3, z + 2.1, { cast: false })
  k.mesh(new BoxGeometry(3, 0.4, 0.4), m.ironDark, x, base + 2.5, z + 2.15, { cast: false })
  k.mesh(new CylinderGeometry(0.8, 1, 4, 8), m.ironDark, x, base + 6, z - 0.5, { cast: false })
  k.addCollider(x, z - 0.5, 1.8, 1.8, base + 8, 0, base + 4)
}
function anvil(k, x, z, base) {
  const m = material(k)
  k.mesh(new BoxGeometry(1.4, 0.9, 1.4), m.wood, x, base + 0.45, z, { cast: false })
  k.mesh(new BoxGeometry(2.6, 0.7, 1), m.iron, x, base + 1.25, z, { cast: false })
  k.mesh(new CylinderGeometry(0.25, 0.5, 1, 8), m.iron, x + 1.6, base + 1.25, z, { cast: false }).rotation.z = -Math.PI / 2
  k.mesh(new BoxGeometry(0.5, 0.3, 0.5), m.ember, x - 0.4, base + 1.75, z, { cast: false })
  k.addCollider(x, z, 2.6, 1.4, base + 1.6, 0, base)
}
function hammer(k, x, z, base) {
  const m = material(k)
  const g = new Group()
  g.position.set(x, base, z)
  const handle = new Mesh(new CylinderGeometry(0.25, 0.3, 7, 8), m.wood)
  handle.position.y = 3.5
  g.add(handle)
  const head = new Mesh(new BoxGeometry(2.6, 1.8, 1.8), m.iron)
  head.position.y = 7
  g.add(head)
  const band = new Mesh(new BoxGeometry(2.7, 0.3, 1.9), m.glow)
  band.position.y = 7
  g.add(band)
  g.rotation.z = -0.35 // leaning against the wall
  k.g.add(g)
  k.addCollider(x + 1.1, z, 1.5, 1.8, base + 7.5, 0, base)
}
function crucible(k, x, z, base) {
  const m = material(k)
  k.mesh(new CylinderGeometry(1.3, 0.9, 1.6, 12), m.ironDark, x, base + 0.8, z, { cast: false })
  k.mesh(new CylinderGeometry(1.15, 1.15, 0.2, 12), m.glow, x, base + 1.55, z, { cast: false })
  k.addCollider(x, z, 2.4, 2.4, base + 1.6, 0, base)
}

export function buildZone12(scene, addCollider) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)
  textures()
  const m = material(k)
  const arrowMat = arrowTexture(COL.yellow)

  const embers = buildShell(k)
  deck(k, CX - START.half, CX + START.half, START.e0, START.e1, START.top)
  floorDecal(k, arrowMat, CX, START.top, at(8), 2.6)
  const sinkers = SINKERS.map((s) => sinker(k, s))
  deck(k, CX - FORGE.half, CX + FORGE.half, FORGE.e0, FORGE.e1, FORGE.top)
  furnace(k, CX - 5.5, at(FORGE.e0 + 7), FORGE.top)
  anvil(k, CX + 6, at(FORGE.e0 + 6), FORGE.top)
  floorDecal(k, arrowMat, CX, FORGE.top, at(FORGE.e1 - 3), 2)
  const gears = GEARS.map((e, i) => gear(k, e, i % 2 ? -1 : 1))
  deck(k, CX - FINAL.half, CX + FINAL.half, FINAL.e0, FINAL.e1, FINAL.top)
  hammer(k, CX + 8, at(FINAL.e0 + 15), FINAL.top)
  crucible(k, CX - 7.5, at(FINAL.e0 + 16), FINAL.top)
  // The back wall with the iron door: obsidian either side, an iron lintel and frame, a yellow arrow over it.
  const d = BACK.door
  const zb0 = at(BACK.e0)
  const zb1 = at(BACK.e1)
  k.voxSpan(CX - HALF, CX - d.half, zb0, zb1, { y0: LAVA_Y - 2, y1: WALL.top, side: tex.obsidian, cell: 4, cast: false })
  k.voxSpan(CX + d.half, CX + HALF, zb0, zb1, { y0: LAVA_Y - 2, y1: WALL.top, side: tex.obsidian, cell: 4, cast: false })
  k.voxSpan(CX - d.half, CX + d.half, zb0, zb1, { y0: LAVA_Y - 2, y1: FINAL.top, side: tex.ironDark, top: tex.iron, cell: 2, cast: false })
  k.voxSpan(CX - d.half, CX + d.half, zb0, zb1, { y0: FINAL.top + d.h, y1: WALL.top, side: tex.obsidian, cell: 4, cast: false })
  for (const s of [-1, 1]) k.mesh(new BoxGeometry(0.5, d.h + 0.5, 0.5), m.iron, CX + s * (d.half + 0.25), FINAL.top + d.h / 2, zb0 + 0.2, { cast: false })
  k.mesh(new BoxGeometry(d.half * 2 + 1, 0.5, 0.5), m.iron, CX, FINAL.top + d.h + 0.25, zb0 + 0.2, { cast: false })
  decal(k, arrowMat, CX, FINAL.top + d.h + 1.8, zb0, 1.8, 1.8)

  const ring = bonusRing(k, RING, ZONE12_BONUS)
  const pad = winPad(k, WIN_PAD.x, WIN_PAD.z, FINAL.top, ZONE12_WIN)
  paidPad(k, PAID_PAD.x, PAID_PAD.z, FINAL.top, '+1500 Wins')
  const treadmill = buildTreadmill(g, addCollider, {
    x: TREAD.x, z: TREAD.z, y: FINAL.top, yaw: -Math.PI / 2, length: TREAD.len, width: TREAD.w, theme: 'forge', mult: TREAD.mult, labelY: 3.9,
    labels: [
      { text: '[x2 Boost]', size: 0.35, fill: '#ff5a9a', stroke: '#3a0a1a' },
      { text: `x${TREAD.mult} Hair`, size: 0.7, fill: ['#ffe0a0', '#ff8a2a'], stroke: '#3a1000' },
    ],
  })
  levelSign(g, ZONE12_LEVEL, [CX, T + 7, at(10)], { fill: ['#ffe0a0', '#ff8a2a'], stroke: '#3a1000' })
  label(g, [{ text: 'THE BLOCKS SINK!', size: 0.5, fill: ['#ffe0a0', '#ff8a2a'], stroke: '#3a1000' }, { text: 'KEEP MOVING', size: 0.8, fill: '#ffffff', stroke: '#3a1000' }], [CX, T + 5, at(14)], { unit: 1.4 })
  label(g, [{ text: 'MIND THE GEARS', size: 0.5, fill: ['#ffe0a0', '#ff8a2a'], stroke: '#3a1000' }], [CX, T + 4.5, at(FORGE.e1 - 1)], { unit: 1.4 })
  const checkpoints = createCheckpoints(CHECKPOINTS)

  const inZone = (p) => p.z <= ZONE12_Z0 && p.z > at(END_E) && Math.abs(p.x - CX) < HALF + WALL.thick
  let bonus = false
  let won = false
  return {
    treadmills: [treadmill], // main.js runs them with the Hub's
    // From Zone 11's doorway to the iron door.
    contains: inZone,
    // The checkpoint a burn puts you back on.
    spawn: () => checkpoints.spot(),
    // Returns 'burned' (the lava), 'bonus' (through the ring) or 'finish' (the win pad). `carry` false while the player rides the cable.
    update(dt, time, p, carry = true) {
      ring.update(time)
      pad.update(time)
      treadmill.update(dt, time)
      m.lavaFall.map.offset.y -= dt * 0.25
      for (const gr of gears) gr.rotation.y += gr.userData.dir * GEAR.rate * dt
      embers.position.y = Math.sin(time * 0.5) * 0.6
      // The sinking blocks: down while stood on, back up once left; the player standing on one sinks with it.
      for (const s of sinkers) {
        const b = s.box
        const standing = carry && p.y <= b.y1 + 0.08 && p.y >= b.y1 - 0.5 && Math.abs(p.x - b.cx) <= b.hx + 0.3 && Math.abs(p.z - b.cz) <= b.hz + 0.3
        s.depth = Math.max(0, Math.min(SINK.depth, s.depth + (standing ? SINK.rate : -SINK.rise) * dt))
        b.y1 = SINK.top - s.depth
        s.mesh.position.y = s.baseY - s.depth
        s.seam.position.y = s.seamY - s.depth
        if (standing) p.y = b.y1
      }
      if (inZone(p)) checkpoints.update(p)
      if (inZone(p) && p.y < BURN_Y) return 'burned'
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
      for (const s of sinkers) s.depth = 0
    },
  }
}
