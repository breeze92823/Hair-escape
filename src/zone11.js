// Zone 11: JUNGLE RUINS. Through Zone 10's cloud gate, a mossy stone terrace looks
// out over an acid-green swamp between walls of jungle foliage (canopy blobs, tree
// trunks, hanging vines, ferns, tiki torches, fireflies). Two STONE RAFTS slide
// side to side across the swamp: time your hops as they line up. From the mid
// landing (its +1 Win ring on the front edge, two totems watching) a wooden FERRY
// shuttles back and forth to the temple foot, where two stone serpents guard the
// temple: two tiers of carved stone, each climbed by a VINE PANEL on its face (hold
// any move key against it, like the blue panels of Zones 4, 6 and 8). The temple
// top holds the golden idol, the yellow win pad (the zone's wins), a cyan "+1000
// Wins" pad (decoration), an x3 Hair treadmill and the stone doorway into Zone 12
// under a carved serpent head. Falling into the swamp puts you back on the last
// checkpoint (terrace, mid landing, temple foot or top). Procedural like Zones 2-10.
//
// Same scale as Zone 10 (1.8 m player): 2-4.5 m hops between the rafts when they
// line up (up to ~7.4 m diagonally when they don't: wait), and 6 m vine climbs.
import { BoxGeometry, BufferGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Points, PointsMaterial, Quaternion, RepeatWrapping, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3 } from 'three'
import { kit, voxelTexture } from './lavaPath.js'
import { arrowTexture, decal } from './zone4.js'
import { ZONE10_EXIT } from './zone10.js'
import { label } from './lobby/labels.js'
import { buildTreadmill } from './lobby/treadmill.js'
import { makeCanvas } from './lobby/paint.js'
import { bonusRing, createCheckpoints, createMovers, floorDecal, levelSign, paidPad, winPad } from './zoneProps.js'

export const ZONE11_NAME = 'JUNGLE RUINS'
export const ZONE11_BONUS = 1 // wins for the ring on the mid landing
export const ZONE11_WIN = 500 // wins for the yellow pad on the temple top
export const ZONE11_LEVEL = 270 // the recommended level on the sign
export const ZONE11_Z0 = ZONE10_EXIT.z // the entrance edge (Zone 10's cloud gate)

const CX = (ZONE10_EXIT.x0 + ZONE10_EXIT.x1) / 2 // the ruins' centre line, in line with Zone 10's gate
const T = ZONE10_EXIT.top // the terrace, flush with Zone 10's summit
const at = (e) => ZONE11_Z0 - e // m north of the entrance -> world z
const HALF = 13 // m, half the swamp's width between the jungle walls
const WALL = { thick: 4, top: T + 14 } // the foliage walls
const SWAMP_Y = T - 3.5 // the swamp's surface
const FALL_Y = T - 2 // feet below this = respawn (before they reach the swamp)

// The course, as distances north of the entrance.
const START = { e0: 0, e1: 12, half: 7, top: T }
// The stone rafts (movers): centre e, the sideways swing's amplitude and phase (rad), the top; 4 x 4 m.
const RAFTS = [{ e: 18.5, amp: 3.5, phase: 0, top: T + 0.2 }, { e: 25, amp: -3.5, phase: 0, top: T + 0.4 }]
const RAFT = { w: 4, h: 1, rate: 0.55 } // m, m, rad/s of the swing
const MID = { e0: 29, e1: 41, half: 6, top: T + 0.5 }
const FERRY = { e: 49.5, amp: 5.5, rate: 0.4, w: 5, h: 1.2, top: T + 0.5 } // shuttles along z between the mid landing and the temple foot
const FOOT = { e0: 60, e1: 72, half: 11, top: T + 0.5 }
// The temple's tiers: riser from e0 (its south face carries the vine panel at x) to e1, the ledge's top.
const TIERS = [{ e0: 72, e1: 78, top: T + 6.5, x: CX + 2 }, { e0: 78, e1: 84, top: T + 12.5, x: CX - 2 }]
const TOP = { e0: 84, e1: 102, half: 9, top: T + 12.5 }
const BACK = { e0: 102, e1: 106, door: { half: 2.5, h: 4.5 } } // the back wall and its doorway into Zone 12
const END_E = BACK.e1
const PANEL_W = 4 // m, a vine panel's width
const RING = { x: CX, y: MID.top + 1.7, z: at(31), radius: 1.3, reach: 1.3 } // bonus ring standing on the mid landing's front; reach: m either side of its plane that count
const WIN_PAD = { x: CX - 3, z: at(89) }
const PAID_PAD = { x: CX - 5.5, z: at(95) } // the cyan "+1000 Wins" pad (decoration)
const TREAD = { x: CX + 4, z: at(92), len: 4.8, w: 2.4, mult: 3 } // the x3 Hair treadmill (m), console to the north
const IDOL = { x: CX + 6.5, e: 97 } // the golden idol on its dais
const FIREFLIES = 160

// The doorway through the back wall, where Zone 12's deck carries on north.
export const ZONE11_EXIT = { x0: CX - BACK.door.half, x1: CX + BACK.door.half, z: at(END_E), top: TOP.top }

// Where a fall puts you before the first checkpoint: the terrace, facing the swamp.
export const ZONE11_SPAWN = { x: CX, y: T + 0.1, z: at(3) }
const CHECKPOINTS = [
  { z: at(0), spot: ZONE11_SPAWN },
  { z: at(MID.e0), spot: { x: CX, y: MID.top + 0.1, z: at(MID.e0 + 4) } },
  { z: at(FOOT.e0), spot: { x: CX, y: FOOT.top + 0.1, z: at(FOOT.e0 + 4) } },
  { z: at(TOP.e0), spot: { x: CX, y: TOP.top + 0.1, z: at(TOP.e0 + 2) } },
]

const COL = {
  moss: '#7a8f5a',
  stone: '#8a8f7e',
  stoneDark: '#5c6152',
  leaf: '#2f6b2a',
  leafLight: '#4a9a3a',
  wood: '#7a4a24',
  gold: '#ffcf1f',
  yellow: '#ffd21a',
}

const tex = {}
function textures() {
  tex.moss = voxelTexture(COL.moss, { cells: 4, jitter: 0.08, grid: 0.16 })
  tex.stone = voxelTexture(COL.stone, { cells: 4, jitter: 0.08, grid: 0.2 })
  tex.stoneDark = voxelTexture(COL.stoneDark, { cells: 4, jitter: 0.08, grid: 0.22 })
  tex.leaf = voxelTexture(COL.leaf, { cells: 4, jitter: 0.1, grid: 0.18 })
  tex.wood = voxelTexture(COL.wood, { cells: 4, jitter: 0.08, grid: 0.25 })
  tex.rune = runeTexture()
  tex.vine = vineTexture()
}

// Carved stone: grey blocks with lighter zigzag carvings (the temple's faces).
function runeTexture() {
  const c = makeCanvas(128)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#7d8273'
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = '#6a6f61'
  for (let i = 0; i < 4; i++) ctx.fillRect(0, i * 32, 128, 2)
  ctx.strokeStyle = '#a8ad9c'
  ctx.lineWidth = 4
  for (let row = 0; row < 4; row++) {
    ctx.beginPath()
    for (let x = 0; x <= 128; x += 16) ctx.lineTo(x, row * 32 + 10 + (x / 16 % 2) * 12)
    ctx.stroke()
  }
  ctx.fillStyle = '#9ad04a'
  for (let i = 0; i < 12; i++) ctx.fillRect((i * 41) % 124, (i * 67) % 124, 4, 4)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

// A vine curtain: dark stone behind thick green stems with leaves (the climbing panels).
function vineTexture() {
  const c = makeCanvas(64, 128)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#3e4a3a'
  ctx.fillRect(0, 0, 64, 128)
  ctx.strokeStyle = '#4fae3a'
  ctx.lineWidth = 5
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    for (let y = 0; y <= 128; y += 8) ctx.lineTo(10 + i * 15 + Math.sin(y / 10 + i) * 4, y)
    ctx.stroke()
  }
  ctx.fillStyle = '#7fd84a'
  for (let i = 0; i < 18; i++) {
    ctx.beginPath()
    ctx.ellipse(6 + ((i * 23) % 56), (i * 31) % 124, 4, 2.5, (i % 3) * 0.8, 0, Math.PI * 2)
    ctx.fill()
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

// Acid-green swamp: dark blobs and bright bubbles, tiled and drifting.
function swampTexture() {
  const c = makeCanvas(64)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#5c9a1a'
  ctx.fillRect(0, 0, 64, 64)
  let s = 11
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = i % 3 ? '#3e7a12' : '#a8e64a'
    const r = 2 + rnd() * 5
    ctx.beginPath()
    ctx.arc(rnd() * 64, rnd() * 64, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

let mats = null
const material = (k) => (mats ??= {
  stone: k.std(COL.stone, { roughness: 0.9 }),
  stoneDark: k.std(COL.stoneDark, { roughness: 0.9 }),
  moss: k.std('#6fae3a', { roughness: 0.95 }),
  leaf: k.std(COL.leafLight, { roughness: 0.9 }),
  leafDark: k.std(COL.leaf, { roughness: 0.9 }),
  trunk: k.std('#5a3a20', { roughness: 0.9 }),
  wood: k.std(COL.wood, { roughness: 0.85 }),
  lily: k.std('#3f9a2a', { roughness: 0.8 }),
  flame: k.std('#ff9a1a', { emissive: '#ff6a00', emissiveIntensity: 1.2, roughness: 0.4 }),
  gold: k.std(COL.gold, { emissive: '#d99a00', emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.3 }),
  eye: k.std('#ffe11a', { emissive: '#ffc400', emissiveIntensity: 1, roughness: 0.3 }),
  vine: new MeshStandardMaterial({ map: tex.vine, roughness: 0.8 }),
  rune: k.std(COL.stone, { map: tex.rune, roughness: 0.9 }),
  glow: k.std('#8fffd0', { emissive: '#3fffa0', emissiveIntensity: 0.8, roughness: 0.4 }),
})

// Tiny seeded generator so the jungle looks the same every load.
let seed = 11
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const between = (a, b) => a + rand() * (b - a)

const flames = [] // torch flames, flickered in update
// A tiki torch: a dark post with a cloth band and a flame cone. Stands on `base`.
function torch(k, x, z, base) {
  const m = material(k)
  k.mesh(new BoxGeometry(0.3, 2.4, 0.3), m.trunk, x, base + 1.2, z, { cast: false })
  k.mesh(new BoxGeometry(0.5, 0.4, 0.5), k.std('#c84a2a'), x, base + 2.3, z, { cast: false })
  const f = k.mesh(new ConeGeometry(0.35, 1, 7), m.flame, x, base + 3, z, { cast: false })
  flames.push(f)
}

// A walkable mossy stone block from the swamp bed to `top`, with a dark stone band under the moss.
function block(k, x0, x1, e0, e1, top) {
  k.voxSpan(x0, x1, at(e0), at(e1), { y0: SWAMP_Y - 2, y1: top - 0.7, side: tex.stoneDark, cell: 2, collide: false, cast: false })
  k.voxSpan(x0, x1, at(e0), at(e1), { y0: top - 0.7, y1: top, side: tex.stone, top: tex.moss, cell: 1.5, collide: false, cast: false })
  k.addCollider((x0 + x1) / 2, (at(e0) + at(e1)) / 2, x1 - x0, e1 - e0, top, 0, SWAMP_Y - 2)
}

// A vine panel on a south face at z, from y0 to y1, with a yellow up arrow under it.
function vinePanel(k, x, z, y0, y1) {
  const m = material(k)
  const h = y1 - y0 - 1.6
  const yc = y0 + 1.6 + h / 2
  k.mesh(new BoxGeometry(PANEL_W + 0.6, h + 0.3, 0.2), m.stoneDark, x, yc, z + 0.1, { cast: false })
  const face = new Mesh(new PlaneGeometry(PANEL_W, h), m.vine)
  face.position.set(x, yc, z + 0.22)
  face.receiveShadow = false
  k.g.add(face)
  decal(k, arrowTexture(COL.yellow), x, y0 + 0.8, z + 0.02, 1.5, 1.5)
}

// --- The shell: foliage walls, canopy, trunks, swamp, vines, ferns, fireflies --------
function buildShell(k) {
  const m = material(k)
  const z0 = ZONE11_Z0
  const zEnd = at(END_E)
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [CX - HALF - WALL.thick, CX - HALF] : [CX + HALF, CX + HALF + WALL.thick]
    k.voxSpan(x0, x1, z0, zEnd, { y0: SWAMP_Y - 2, y1: WALL.top, side: tex.leaf, cell: 3, cast: false })
  }
  // The swamp (visual: a fall respawns before it), drifting.
  const swamp = swampTexture()
  swamp.repeat.set((HALF * 2) / 4, (FOOT.e0 + 2) / 4)
  k.mesh(new PlaneGeometry(HALF * 2, FOOT.e0 + 2), new MeshStandardMaterial({ map: swamp, roughness: 0.6 }), CX, SWAMP_Y, at((FOOT.e0 + 2) / 2 - 2), { cast: false }).rotation.x = -Math.PI / 2
  // Canopy blobs along the wall tops and trunks behind them, as instanced spheres.
  const blobs = []
  const trunks = []
  for (const s of [-1, 1]) {
    for (let e = 2; e < END_E; e += between(4, 7)) {
      blobs.push([CX + s * (HALF + between(0, 3)), WALL.top + between(-1, 2), at(e), between(3, 5), rand() < 0.5 ? 0 : 1])
      if (rand() < 0.45) {
        const h = between(16, 24)
        trunks.push([CX + s * (HALF + between(1, 3.5)), SWAMP_Y + h / 2, at(e + 1), h])
        blobs.push([CX + s * (HALF + between(0, 3)), SWAMP_Y + h + 1, at(e + 1), between(3.5, 5.5), 1])
      }
    }
  }
  const sphere = new SphereGeometry(1, 8, 6)
  const mtx = new Matrix4()
  const q = new Quaternion()
  const pos = new Vector3()
  const scl = new Vector3()
  for (const kind of [0, 1]) {
    const mine = blobs.filter((b) => b[4] === kind)
    const mesh = new InstancedMesh(sphere, kind ? m.leaf : m.leafDark, mine.length)
    mine.forEach(([x, y, z, r], i) => {
      mtx.compose(pos.set(x, y, z), q, scl.set(r, r * 0.8, r))
      mesh.setMatrixAt(i, mtx)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = mesh.receiveShadow = false
    k.g.add(mesh)
  }
  const trunkMesh = new InstancedMesh(new CylinderGeometry(0.5, 0.7, 1, 7), m.trunk, trunks.length)
  trunks.forEach(([x, y, z, h], i) => {
    mtx.compose(pos.set(x, y, z), q, scl.set(1, h, 1))
    trunkMesh.setMatrixAt(i, mtx)
  })
  trunkMesh.instanceMatrix.needsUpdate = true
  trunkMesh.castShadow = trunkMesh.receiveShadow = false
  k.g.add(trunkMesh)
  // Hanging vines from the wall tops, and ferns (cones) along the banks.
  const vineGeo = new CylinderGeometry(0.08, 0.12, 1, 4)
  const vines = new InstancedMesh(vineGeo, m.moss, 36)
  for (let i = 0; i < 36; i++) {
    const s = i % 2 ? 1 : -1
    const len = between(3, 9)
    mtx.compose(pos.set(CX + s * between(HALF - 1.5, HALF + 0.5), WALL.top - len / 2, at(between(2, END_E - 4))), q, scl.set(1, len, 1))
    vines.setMatrixAt(i, mtx)
  }
  vines.instanceMatrix.needsUpdate = true
  vines.castShadow = vines.receiveShadow = false
  k.g.add(vines)
  const ferns = new InstancedMesh(new ConeGeometry(0.8, 1.4, 6), m.leaf, 40)
  const banks = [[START, T], [MID, MID.top], [FOOT, FOOT.top], [TOP, TOP.top]]
  for (let i = 0; i < 40; i++) {
    const [b, top] = banks[i % banks.length]
    const s = i % 2 ? 1 : -1
    mtx.compose(pos.set(CX + s * between(b.half - 1.6, b.half - 0.7), top + 0.7, at(between(b.e0 + 1, b.e1 - 1))), q, scl.set(between(0.7, 1.3), between(0.8, 1.4), between(0.7, 1.3)))
    ferns.setMatrixAt(i, mtx)
  }
  ferns.instanceMatrix.needsUpdate = true
  ferns.castShadow = ferns.receiveShadow = false
  k.g.add(ferns)
  // Broken stone pillars standing in the swamp off the path, some leaning.
  for (let i = 0; i < 10; i++) {
    const s = i % 2 ? 1 : -1
    const h = between(3, 7)
    const p = k.mesh(new CylinderGeometry(0.6, 0.75, h, 8), m.stone, CX + s * between(8.5, HALF - 1.5), SWAMP_Y + h / 2 - 0.5, at(between(13, FOOT.e0 - 2)), { cast: false })
    p.rotation.z = s * between(0, 0.25)
    k.mesh(new BoxGeometry(1, 0.2, 1), m.moss, p.position.x, p.position.y + h / 2, p.position.z, { cast: false })
  }
  // Glowing mushrooms on the banks.
  for (let i = 0; i < 12; i++) {
    const s = i % 2 ? 1 : -1
    const [b, top] = banks[i % banks.length]
    const x = CX + s * between(b.half - 1, b.half - 0.4)
    const z = at(between(b.e0 + 0.5, b.e1 - 0.5))
    k.mesh(new CylinderGeometry(0.08, 0.1, 0.4, 5), m.stone, x, top + 0.2, z, { cast: false })
    k.mesh(new SphereGeometry(0.22, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), m.glow, x, top + 0.38, z, { cast: false })
  }
  // Fireflies: one point cloud drifting over the swamp.
  const n = FIREFLIES
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = CX + between(-HALF + 1, HALF - 1)
    arr[i * 3 + 1] = T + between(0.5, 8)
    arr[i * 3 + 2] = at(between(2, END_E - 4))
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(arr, 3))
  const flies = new Points(geo, new PointsMaterial({ color: '#d6ff5a', size: 0.12, transparent: true, opacity: 0.9 }))
  k.g.add(flies)
  return { swamp, flies }
}

// A stone raft (mover): a mossy slab with lily pads floating round it.
function raft(k, top, w) {
  const m = material(k)
  const g = new Group()
  const slab = new Mesh(new BoxGeometry(w, RAFT.h, w), [m.stoneDark, m.stoneDark, m.moss, m.stoneDark, m.stoneDark, m.stoneDark])
  slab.position.y = -RAFT.h / 2
  slab.receiveShadow = true
  g.add(slab)
  for (const [dx, dz] of [[w / 2 + 0.8, 0.4], [-w / 2 - 0.7, -0.6], [0.3, w / 2 + 0.9]]) {
    const pad = new Mesh(new CylinderGeometry(0.6, 0.6, 0.08, 10), m.lily)
    pad.position.set(dx, SWAMP_Y - top + 0.05, dz)
    g.add(pad)
  }
  k.g.add(g)
  return g
}

// The ferry (mover): a wooden plank raft with log rails and a lantern post.
function ferry(k) {
  const m = material(k)
  const g = new Group()
  const deck = new Mesh(new BoxGeometry(FERRY.w, FERRY.h, FERRY.w), m.wood)
  deck.position.y = -FERRY.h / 2
  deck.receiveShadow = true
  g.add(deck)
  for (const s of [-1, 1]) {
    const log = new Mesh(new CylinderGeometry(0.3, 0.3, FERRY.w + 0.4, 8), m.trunk)
    log.rotation.x = Math.PI / 2
    log.position.set(s * (FERRY.w / 2 - 0.2), -0.2, 0)
    g.add(log)
  }
  const post = new Mesh(new BoxGeometry(0.25, 2.4, 0.25), m.trunk)
  post.position.set(FERRY.w / 2 - 0.5, 1.2, -FERRY.w / 2 + 0.5)
  g.add(post)
  const lamp = new Mesh(new SphereGeometry(0.3, 8, 6), m.flame)
  lamp.position.set(FERRY.w / 2 - 0.5, 2.6, -FERRY.w / 2 + 0.5)
  g.add(lamp)
  k.g.add(g)
  return g
}

// A stone serpent: a coiled body (torus) with a raised head and glowing eyes, facing south.
function serpent(k, x, z, base, s) {
  const m = material(k)
  const coil = k.mesh(new TorusGeometry(1.2, 0.45, 8, 16), m.stone, x, base + 0.45, z, { cast: false })
  coil.rotation.x = Math.PI / 2
  k.mesh(new CylinderGeometry(0.4, 0.45, 2.2, 8), m.stone, x + s * 0.9, base + 1.6, z, { cast: false })
  k.mesh(new BoxGeometry(1.3, 0.9, 1.6), m.stone, x + s * 0.9, base + 3, z + 0.3, { cast: false })
  for (const ex of [-0.35, 0.35]) k.mesh(new BoxGeometry(0.22, 0.22, 0.1), m.eye, x + s * 0.9 + ex, base + 3.15, z + 1.12, { cast: false })
  k.addCollider(x + s * 0.9, z, 1.3, 1.6, base + 3.5, 0, base)
}

// A totem: stacked stone faces with glowing eyes.
function totem(k, x, z, base) {
  const m = material(k)
  for (let i = 0; i < 3; i++) {
    const y = base + 0.7 + i * 1.4
    k.mesh(new BoxGeometry(1.4, 1.3, 1.2), i % 2 ? m.stoneDark : m.stone, x, y, z, { cast: false })
    for (const ex of [-0.35, 0.35]) k.mesh(new BoxGeometry(0.25, 0.25, 0.1), m.eye, x + ex, y + 0.2, z + 0.62, { cast: false })
  }
  k.mesh(new BoxGeometry(2.2, 0.3, 0.8), m.wood, x, base + 4.4, z, { cast: false })
  k.addCollider(x, z, 1.4, 1.2, base + 4.5, 0, base)
}

// The golden idol on a dais: a seated figure with a crown and gem.
function idol(k) {
  const m = material(k)
  const x = IDOL.x
  const z = at(IDOL.e)
  const base = TOP.top
  k.voxSpan(x - 1.6, x + 1.6, z + 1.6, z - 1.6, { y0: base, y1: base + 0.5, side: tex.stone, top: tex.moss, cell: 1, cast: false })
  k.voxSpan(x - 1.1, x + 1.1, z + 1.1, z - 1.1, { y0: base + 0.5, y1: base + 1, side: tex.stoneDark, cell: 1, cast: false })
  k.mesh(new BoxGeometry(1.4, 1.6, 1.1), m.gold, x, base + 1.8, z, { cast: false })
  k.mesh(new SphereGeometry(0.6, 12, 10), m.gold, x, base + 3, z, { cast: false })
  k.mesh(new ConeGeometry(0.5, 0.7, 6), m.gold, x, base + 3.8, z, { cast: false })
  k.mesh(new SphereGeometry(0.2, 8, 6), m.glow, x, base + 2.1, z + 0.6, { cast: false })
  for (const s of [-1, 1]) k.mesh(new BoxGeometry(0.4, 1.2, 0.4), m.gold, x + s * 0.9, base + 1.9, z + 0.2, { cast: false })
  label(k.g, [{ text: 'GOLDEN IDOL', size: 0.45, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }], [x, base + 5.2, z], { unit: 1.2 })
}

// --- The course: terrace, rafts, landings, the ferry, the temple --------------------
function buildCourse(k, movers) {
  const m = material(k)
  const arrowMat = arrowTexture(COL.yellow)
  block(k, CX - START.half, CX + START.half, START.e0, START.e1, START.top)
  for (const s of [-1, 1]) torch(k, CX + s * (START.half - 1), at(START.e1 - 1.2), START.top)
  floorDecal(k, arrowMat, CX, START.top, at(8), 2.6)
  for (const r of RAFTS) {
    const g = raft(k, r.top, RAFT.w)
    const z = at(r.e)
    movers.add(g, { w: RAFT.w, d: RAFT.w, h: RAFT.h, path: (time, out) => {
      out.x = CX + r.amp * Math.sin(time * RAFT.rate + r.phase)
      out.y = r.top
      out.z = z
    } })
  }
  block(k, CX - MID.half, CX + MID.half, MID.e0, MID.e1, MID.top)
  for (const s of [-1, 1]) {
    totem(k, CX + s * (MID.half - 1.6), at(MID.e0 + 2.5), MID.top)
    torch(k, CX + s * (MID.half - 1), at(MID.e1 - 1), MID.top)
  }
  floorDecal(k, arrowMat, CX, MID.top, at(MID.e1 - 3), 2)
  const f = ferry(k)
  movers.add(f, { w: FERRY.w, d: FERRY.w, h: FERRY.h, path: (time, out) => {
    out.x = CX
    out.y = FERRY.top
    out.z = at(FERRY.e + FERRY.amp * Math.sin(time * FERRY.rate))
  } })
  block(k, CX - FOOT.half, CX + FOOT.half, FOOT.e0, FOOT.e1, FOOT.top)
  for (const s of [-1, 1]) {
    serpent(k, CX + s * 7, at(FOOT.e0 + 4), FOOT.top, -s)
    torch(k, CX + s * (FOOT.half - 1), at(FOOT.e0 + 1), FOOT.top)
  }
  floorDecal(k, arrowMat, CX, FOOT.top, at(FOOT.e0 + 7), 2.4)
  // The temple tiers: full-width carved risers, a vine panel on each south face, stone lips.
  let below = FOOT.top
  for (const t of TIERS) {
    k.voxSpan(CX - FOOT.half, CX + FOOT.half, at(t.e0), at(t.e1), { y0: SWAMP_Y - 2, y1: t.top, side: tex.rune, top: tex.moss, cell: 3, cast: false })
    k.mesh(new BoxGeometry(FOOT.half * 2, 0.3, 0.3), m.stoneDark, CX, t.top - 0.15, at(t.e0) + 0.1, { cast: false })
    vinePanel(k, t.x, at(t.e0), below, t.top)
    for (const s of [-1, 1]) torch(k, CX + s * (FOOT.half - 1), at(t.e0 + 1.5), t.top)
    below = t.top
  }
  // The temple top: a wide mossy stone deck between four pillars, the back wall with its doorway under a serpent head.
  block(k, CX - TOP.half, CX + TOP.half, TOP.e0, TOP.e1, TOP.top)
  for (const s of [-1, 1]) {
    for (const e of [TOP.e0 + 1.5, TOP.e1 - 1.5]) {
      const x = CX + s * (TOP.half - 1.2)
      k.mesh(new CylinderGeometry(0.8, 0.9, 7, 8), m.stone, x, TOP.top + 3.5, at(e), { cast: false })
      k.mesh(new BoxGeometry(2, 0.5, 2), m.stoneDark, x, TOP.top + 7.25, at(e), { cast: false })
      k.addCollider(x, at(e), 1.8, 1.8, TOP.top + 7.5, 0, TOP.top)
      torch(k, x, at(e), TOP.top + 7.5)
    }
  }
  const d = BACK.door
  const zb0 = at(BACK.e0)
  const zb1 = at(BACK.e1)
  k.voxSpan(CX - HALF, CX - d.half, zb0, zb1, { y0: SWAMP_Y - 2, y1: TOP.top + 10, side: tex.rune, top: tex.moss, cell: 3, cast: false })
  k.voxSpan(CX + d.half, CX + HALF, zb0, zb1, { y0: SWAMP_Y - 2, y1: TOP.top + 10, side: tex.rune, top: tex.moss, cell: 3, cast: false })
  k.voxSpan(CX - d.half, CX + d.half, zb0, zb1, { y0: SWAMP_Y - 2, y1: TOP.top, side: tex.stoneDark, top: tex.moss, cell: 3, cast: false })
  k.voxSpan(CX - d.half, CX + d.half, zb0, zb1, { y0: TOP.top + d.h, y1: TOP.top + 10, side: tex.rune, top: tex.moss, cell: 3, cast: false })
  // The serpent head over the door: a big stone head with fangs and glowing eyes.
  k.mesh(new BoxGeometry(5, 3, 2.5), m.stone, CX, TOP.top + d.h + 3, zb0 + 0.6, { cast: false })
  for (const s of [-1, 1]) {
    k.mesh(new BoxGeometry(0.7, 0.7, 0.2), m.eye, CX + s * 1.3, TOP.top + d.h + 3.6, zb0 + 1.95, { cast: false })
    k.mesh(new ConeGeometry(0.25, 0.9, 5), m.stoneDark, CX + s * 1.6, TOP.top + d.h + 1.2, zb0 + 1.6, { cast: false }).rotation.x = Math.PI
  }
  decal(k, arrowMat, CX, TOP.top + d.h + 0.9, zb0, 1.6, 1.6)
  idol(k)
}

export function buildZone11(scene, addCollider) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)
  textures()
  const movers = createMovers(addCollider)

  const { swamp, flies } = buildShell(k)
  buildCourse(k, movers)
  const ring = bonusRing(k, RING, ZONE11_BONUS)
  const pad = winPad(k, WIN_PAD.x, WIN_PAD.z, TOP.top, ZONE11_WIN)
  paidPad(k, PAID_PAD.x, PAID_PAD.z, TOP.top, '+1000 Wins')
  const treadmill = buildTreadmill(g, addCollider, {
    x: TREAD.x, z: TREAD.z, y: TOP.top, yaw: -Math.PI / 2, length: TREAD.len, width: TREAD.w, theme: 'jungle', mult: TREAD.mult, labelY: 3.9,
    labels: [
      { text: '[x2 Boost]', size: 0.35, fill: '#ff5a9a', stroke: '#3a0a1a' },
      { text: `x${TREAD.mult} Hair`, size: 0.7, fill: ['#e8ffb0', '#8fd63a'], stroke: '#0a2a0a' },
    ],
  })
  levelSign(g, ZONE11_LEVEL, [CX, T + 7, at(10)], { fill: ['#d6ffb0', '#6fd63a'], stroke: '#0a2a0a' })
  label(g, [{ text: 'RIDE THE RAFTS!', size: 0.5, fill: ['#e8ffb0', '#8fd63a'], stroke: '#0a2a0a' }], [CX, T + 4.5, at(21)], { unit: 1.4 })
  label(g, [{ text: 'CLIMB THE VINES!', size: 0.5, fill: ['#e8ffb0', '#8fd63a'], stroke: '#0a2a0a' }], [CX, FOOT.top + 9, at(TIERS[0].e0 - 1)], { unit: 1.4 })
  const checkpoints = createCheckpoints(CHECKPOINTS)

  const inZone = (p) => p.z <= ZONE11_Z0 && p.z > at(END_E) && Math.abs(p.x - CX) < HALF + WALL.thick
  let bonus = false
  let won = false
  return {
    treadmills: [treadmill], // main.js runs them with the Hub's
    // From Zone 10's gate to the temple's back wall.
    contains: inZone,
    // The checkpoint a fall puts you back on.
    spawn: () => checkpoints.spot(),
    // True while the player is pressed against a vine panel (main.js lifts them).
    climbAt(p) {
      let below = FOOT.top
      for (const t of TIERS) {
        const z0 = at(t.e0)
        if (p.z <= z0 + 0.75 && p.z > z0 - 1 && p.y >= below - 0.5 && p.y < t.top && Math.abs(p.x - t.x) < PANEL_W / 2 + 0.3) return true
        below = t.top
      }
      return false
    },
    // Returns 'fell' (the swamp), 'bonus' (through the ring) or 'finish' (the win pad). `carry` false while the player rides the cable.
    update(dt, time, p, carry = true) {
      movers.update(time, p, carry)
      ring.update(time)
      pad.update(time)
      treadmill.update(dt, time)
      swamp.offset.x += dt * 0.02
      swamp.offset.y += dt * 0.015
      flies.position.y = Math.sin(time * 0.7) * 0.5
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i]
        f.scale.y = 1 + Math.sin(time * 9 + i) * 0.2
        f.scale.x = f.scale.z = 1 + Math.sin(time * 7 + i * 2) * 0.12
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
