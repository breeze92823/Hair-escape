// Zone 9: CRYSTAL CAVERN. Past Zone 8's mine deck the cave runs on over a pale snowy
// floor a few metres down (landing on it respawns you), between faceted purple rock
// walls under a ceiling of hanging ice spikes, vines and drifting sparkles. Huge crystal pillars (teal, purple, blue, magenta) rise from the floor, and
// the only way across is the hair cable: three platforms hang 24-28 m apart, each a
// wooden scaffold or a rock ledge backed by a crystal pillar with a blue anchor cube
// and a yellow arrow pointing at it. A +1 Win ring hangs in the middle of the gap
// between the first two. Purple geode portals glow on the walls. The last platform
// runs into two terracotta walls and a wooden gate onto a candy-land deck: giant
// lollipops, candy arches, the yellow win pad (the zone's wins; the run carries on
// through the doorway in the back building into Zone 10), a cyan "+400 Wins" pad
// (decoration) and an x2 Hair treadmill. Falling into the
// chasm puts you back on the deck. Procedural like Zones 2-8.
//
// Built at the same scale as Zone 8 (1.8 m player): the gaps are far past a jump
// (~7 m), so the cable (reach 8 m + 2 m per hair length, up to 2000 m) is the only way.
import { BoxGeometry, BufferGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Points, PointsMaterial, Quaternion, RepeatWrapping, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3 } from 'three'
import { kit, voxelTexture } from './lavaPath.js'
import { arrowTexture, decal } from './zone4.js'
import { facetTexture, ZONE8_EXIT } from './zone8.js'
import { label } from './lobby/labels.js'
import { buildTreadmill } from './lobby/treadmill.js'
import { makeCanvas } from './lobby/paint.js'
import { paidPad, winPad } from './zoneProps.js'

export const ZONE9_NAME = 'CRYSTAL CAVERN'
export const ZONE9_BONUS = 1 // wins for the ring between the first two platforms
export const ZONE9_WIN = 200 // wins for the yellow pad on the candy deck
export const ZONE9_Z0 = ZONE8_EXIT.z // the entrance edge (Zone 8's mine deck, north end)

const CX = (ZONE8_EXIT.x0 + ZONE8_EXIT.x1) / 2 // the cave's centre line, in line with Zone 8's tower
const T = ZONE8_EXIT.top // the deck, flush with Zone 8's mine deck
const MOUTH = (ZONE8_EXIT.x1 - ZONE8_EXIT.x0) / 2 // m, half the mine cave's width where it opens into the cavern
const HALF = 12 // m, half the cavern's inner width
const WALL = { thick: 3, top: T + 22 } // side walls
const FLOOR_Y = T - 5 // the snowy floor under the platforms
const FALL_Y = T - 2.5 // feet below this = respawn (before they reach the snow)
const at = (e) => ZONE9_Z0 - e // m north of the entrance -> world z

const DECK = { e0: 0, e1: 8, half: 7 } // the mine deck, carried on to the chasm's edge
// The three platforms across the chasm (e0, e1 = near / far edge; half = half width; top; kind; the pillar's x offset, colour)
const STATIONS = [
  { e0: 36, e1: 46, half: 5, top: T - 1.5, kind: 'scaffold', pillar: { dx: -2.5, color: 'purple' } },
  { e0: 70, e1: 80, half: 5, top: T + 4.5, kind: 'rock', pillar: { dx: 2.5, color: 'magenta' } },
  { e0: 104, e1: 120, half: 6, top: T + 1, kind: 'scaffold', pillar: { dx: -3, color: 'teal' } },
]
const PILLAR = { size: 2, h: 14, cube: 1.3, cubeY: 2.4 } // m: pillar footprint and height above its platform, the anchor cube and its height above the platform
const GATE = { e0: 120, e1: 128, half: 4, top: T + 1 } // the terracotta walls (door half-width) across the last platform's end
const CANDY = { e0: 128, e1: 152, top: T + 1 } // the candy-land deck
const END_E = CANDY.e1 + 3 // the zone's north face
const DOOR = { half: 3, h: 4.5 } // the doorway through the back building into Zone 10 (m)
const RING = { x: CX, y: T + 3.5, z: at(58), radius: 1.6, reach: 1.3 } // bonus ring mid-gap; reach: m either side of its plane that count
const WIN_PAD = { x: CX - 3, z: at(CANDY.e0 + 10), size: 3.6 }
const PAID_PAD = { x: CX - 5.5, z: at(CANDY.e0 + 17) } // the cyan "+400 Wins" pad (decoration)
const TREAD = { x: CX + 2.5, z: at(CANDY.e0 + 13), len: 4.8, w: 2.4, mult: 2 } // the x2 Hair treadmill (m), console to the north, clear of the gumdrops
// The crystal forest: [x offset from the centre line, e, colour, height above the floor]. The first few flank
// the deck; the rest stand along the walls, clear of the zip line down the middle.
const FOREST = [[-7.5, 4, 'teal', 28], [8, 7, 'blue', 28], [4, 17, 'purple', 27], [-10.4, 24, 'teal', 26], [10.4, 32, 'blue', 28], [-7, 44, 'purple', 24], [10.4, 60, 'blue', 29], [-10.4, 74, 'teal', 26], [9, 86, 'magenta', 25], [-10.4, 98, 'teal', 27], [8, 110, 'magenta', 20]]
const GEODES = [[-1, 36, 6, 4], [1, 54, 8, 6], [-1, 84, 5, 4.5], [1, 100, 4, 3.5]] // [side, e, height above the deck, radius] geode portals on the walls
const SPIKES = { ceiling: 46, floor: 40 } // instanced cones

// The doorway through the candy deck's back building, where Zone 10's start island carries on north.
export const ZONE9_EXIT = { x0: CX - DOOR.half, x1: CX + DOOR.half, z: at(END_E), top: CANDY.top }

// Where a fall puts you: the deck, facing the chasm.
export const ZONE9_SPAWN = { x: CX, y: T + 0.1, z: at(3) }

const COL = {
  rock: '#4d3f86',
  rockDark: '#2f2560',
  snow: '#eef4ff',
  wood: '#c27434',
  woodDark: '#7a4320',
  terracotta: '#c0451f',
  cream: '#fbeadb',
  teal: '#3fe8d8',
  purple: '#8a3bff',
  blue: '#2fb4ff',
  magenta: '#ff3fc8',
  pink: '#ff6fb8',
  yellow: '#ffd21a',
}

const tex = {}
function textures() {
  tex.rock = facetTexture()
  tex.rockDark = facetTexture(true)
  tex.wood = voxelTexture(COL.wood, { cells: 4, jitter: 0.08, grid: 0.28 })
  tex.woodDark = voxelTexture(COL.woodDark, { cells: 4, jitter: 0.08, grid: 0.25 })
  tex.terracotta = voxelTexture(COL.terracotta, { cells: 4, jitter: 0.07, grid: 0.2 })
  tex.cream = voxelTexture(COL.cream, { cells: 4, jitter: 0.03, grid: 0.08 })
}

// Pale snow with faint pink and blue drifts (the chasm floor).
function snowTexture() {
  const c = makeCanvas(128)
  const ctx = c.getContext('2d')
  ctx.fillStyle = COL.snow
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,190,225,0.22)' : 'rgba(170,205,255,0.22)'
    const s = 6 + ((i * 37) % 22)
    ctx.fillRect((i * 53) % 128, (i * 91) % 128, s, s)
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

// A purple geode: dark violet with pink and white sparkles.
function geodeTexture() {
  const c = makeCanvas(128)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#4a14b8'
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = ['#ff9be6', '#ffffff', '#b98cff'][i % 3]
    const s = 2 + (i % 4)
    ctx.fillRect((i * 47) % 124, (i * 83) % 124, s, s)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

// A lollipop face: a spiral of `color` on white.
const spiralCache = new Map()
function spiralTexture(color) {
  if (spiralCache.has(color)) return spiralCache.get(color)
  const c = makeCanvas(128)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = color
  ctx.lineWidth = 12
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let a = 0; a < Math.PI * 7; a += 0.1) {
    const r = 4 + a * 2.7
    const x = 64 + Math.cos(a) * r
    const y = 64 + Math.sin(a) * r
    if (a === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  spiralCache.set(color, t)
  return t
}

// Pink and white floor checks for the candy deck.
function candyFloorTexture() {
  const c = makeCanvas(64)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff0f8'
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = '#ffc6e4'
  ctx.fillRect(0, 0, 32, 32)
  ctx.fillRect(32, 32, 32, 32)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

let mats = null
const material = (k) => (mats ??= {
  crystal: {
    teal: k.std(COL.teal, { emissive: '#18b8b0', emissiveIntensity: 0.55, roughness: 0.25, flatShading: true }),
    purple: k.std(COL.purple, { emissive: '#5a1ad0', emissiveIntensity: 0.5, roughness: 0.25, flatShading: true }),
    blue: k.std(COL.blue, { emissive: '#1070d0', emissiveIntensity: 0.55, roughness: 0.25, flatShading: true }),
    magenta: k.std(COL.magenta, { emissive: '#c0108a', emissiveIntensity: 0.5, roughness: 0.25, flatShading: true }),
  },
  shard: k.std('#d8e4ff', { emissive: '#7a9cff', emissiveIntensity: 0.3, roughness: 0.2 }),
  cube: k.std('#3a5cff', { emissive: '#2040ff', emissiveIntensity: 0.9, roughness: 0.3 }),
  gold: k.std('#ffcf1f', { emissive: '#d99a00', emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.3 }),
  glass: k.std('#c8f8ff', { emissive: '#6ad8f0', emissiveIntensity: 0.3, transparent: true, opacity: 0.65, roughness: 0.1 }),
  lamp: k.std('#ffe9a0', { emissive: '#ffc040', emissiveIntensity: 1, roughness: 0.3 }),
  rail: k.std('#4a4a58', { metalness: 0.6, roughness: 0.4 }),
  wood: k.std('#8a4a22', { roughness: 0.85 }),
  boulder: k.std('#2b2a5a', { roughness: 0.9 }),
  geodeRock: k.std('#8a6a4a', { roughness: 0.95 }),
  geode: new MeshBasicMaterial({ map: geodeTexture() }),
  geodeRim: k.std('#ece0ff', { emissive: '#a08cff', emissiveIntensity: 0.3, roughness: 0.4 }),
  stick: k.std('#fff6f0', { roughness: 0.6 }),
})

// Tiny seeded generator so the cave looks the same every load.
let seed = 9
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const between = (a, b) => a + rand() * (b - a)

// A crystal pillar: a square shaft with shards sticking out. Stands on `base`, `h` tall; the collider lets the cable stick to it.
function pillar(k, x, z, base, h, color, { size = PILLAR.size, shards = 3 } = {}) {
  const m = material(k)
  const mat = m.crystal[color]
  // A six-sided shaft (flat-shaded, so each face catches the light differently) with a pointed tip.
  k.mesh(new CylinderGeometry(size * 0.55, size * 0.7, h, 6), mat, x, base + h / 2, z, { cast: false }).rotation.y = Math.PI / 6
  k.mesh(new ConeGeometry(size * 0.55, 2.4, 6), mat, x, base + h + 1.2, z, { cast: false }).rotation.y = Math.PI / 6
  k.addCollider(x, z, size, size, base + h, 0, base)
  // Shards branching off the shaft: tilted six-sided prisms with pointed tips.
  for (let i = 0; i < shards; i++) {
    const len = between(2.5, 4.5)
    const side = i % 2 ? 1 : -1
    const g = new Group()
    g.position.set(x + side * size * 0.3, base + h * between(0.35, 0.9), z + between(-0.5, 0.5))
    g.rotation.z = -side * between(0.5, 0.9) // rad off vertical, leaning away from the shaft
    g.rotation.y = between(-0.6, 0.6)
    const prism = new Mesh(new CylinderGeometry(0.25, 0.42, len, 6), mat)
    prism.position.y = len / 2
    const tip = new Mesh(new ConeGeometry(0.25, 0.8, 6), mat)
    tip.position.y = len + 0.4
    g.add(prism, tip)
    k.g.add(g)
  }
}

// --- The shell: side walls, ceiling, floor, spikes, geodes -----------------------------
function buildShell(k) {
  const m = material(k)
  const z0 = ZONE9_Z0
  const zEnd = at(END_E)
  // Rock walls each side (faceted dark purple) and a ceiling over the whole cave.
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [CX - HALF - WALL.thick, CX - HALF] : [CX + HALF, CX + HALF + WALL.thick]
    k.voxSpan(x0, x1, z0, zEnd, { y1: WALL.top, side: tex.rock, cell: 12, cast: false })
    const [m0, m1] = s < 0 ? [CX - HALF - WALL.thick, CX - MOUTH] : [CX + MOUTH, CX + HALF + WALL.thick]
    k.voxSpan(m0, m1, z0, at(WALL.thick), { y1: WALL.top, side: tex.rock, cell: 12, cast: false }) // the cavern's front, either side of the mine cave's mouth
  }
  k.voxSpan(CX - HALF - WALL.thick, CX + HALF + WALL.thick, z0, at(GATE.e1), { y0: WALL.top, y1: WALL.top + 4, side: tex.rockDark, cell: 12, collide: false, cast: false }) // the roof ends at the gate: the candy deck is under open sky

  // The snowy chasm floor (visual: a fall respawns long before it).
  const snow = snowTexture()
  snow.repeat.set((HALF * 2) / 8, (CANDY.e1 - DECK.e1) / 8)
  const floor = k.mesh(new PlaneGeometry(HALF * 2, CANDY.e1 - DECK.e1), new MeshStandardMaterial({ map: snow, roughness: 0.9 }), CX, FLOOR_Y, at((DECK.e1 + CANDY.e1) / 2), { cast: false })
  floor.rotation.x = -Math.PI / 2

  // Ice spikes: hanging from the ceiling, standing on the floor (one instanced mesh each).
  const place = (mesh, n, y, flip, h0, h1, span0, span1) => {
    const mtx = new Matrix4()
    const q = new Quaternion()
    for (let i = 0; i < n; i++) {
      const h = between(h0, h1)
      q.setFromAxisAngle(new Vector3(1, 0, 0), flip ? Math.PI : 0)
      mtx.compose(new Vector3(CX + between(-HALF + 1, HALF - 1), y + (flip ? -h / 2 : h / 2), at(between(span0, span1))), q, new Vector3(between(0.6, 1.2), h, between(0.6, 1.2)))
      mesh.setMatrixAt(i, mtx)
    }
    mesh.instanceMatrix.needsUpdate = true
    k.g.add(mesh)
  }
  const spikeGeo = new ConeGeometry(1, 1, 5)
  place(new InstancedMesh(spikeGeo, k.std('#a9b8ff', { emissive: '#4a58c0', emissiveIntensity: 0.25, roughness: 0.3 }), SPIKES.ceiling), SPIKES.ceiling, WALL.top, true, 3, 9, 4, GATE.e0)
  place(new InstancedMesh(spikeGeo, k.std('#2b2a5a', { roughness: 0.8 }), SPIKES.floor), SPIKES.floor, FLOOR_Y, false, 1.5, 4, DECK.e1 + 4, CANDY.e1 - 4)

  // The crystal forest, rooted in the snow.
  for (const [dx, e, color, h] of FOREST) pillar(k, CX + dx, at(e), FLOOR_Y, h, color, { size: 2.4, shards: 3 })

  // Geode portals: a brown rock sphere bulging out of the wall, cut open to look back
  // down the cave at the player: a glittering purple face in a lilac-and-white rim.
  const up = new Vector3(0, 1, 0)
  const fwd = new Vector3(0, 0, 1)
  const cut = 0.35 // the cut plane, as a fraction of the radius from the centre
  for (const [s, e, y, R] of GEODES) {
    const axis = new Vector3(-s * 0.4, 0.12, 0.9).normalize()
    const centre = new Vector3(CX + s * (HALF - R * 0.25), T + y, at(e))
    const bowl = k.mesh(new SphereGeometry(R, 18, 12, 0, Math.PI * 2, Math.acos(cut), Math.PI - Math.acos(cut)), m.geodeRock, centre.x, centre.y, centre.z, { cast: false })
    bowl.quaternion.setFromUnitVectors(up, axis)
    const face = centre.clone().addScaledVector(axis, R * cut)
    const r = R * Math.sqrt(1 - cut * cut)
    for (const [geo, mat] of [[new CircleGeometry(r, 28), m.geode], [new TorusGeometry(r, R * 0.09, 8, 28), m.geodeRim], [new TorusGeometry(r - R * 0.16, R * 0.045, 8, 28), m.stick]]) {
      k.mesh(geo, mat, face.x, face.y, face.z, { cast: false }).quaternion.setFromUnitVectors(fwd, axis)
    }
  }

  // Sparkles drifting in the cave air (one point cloud), and vines hanging from the ceiling.
  const n = 400
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    pos[i * 3] = CX + between(-HALF + 1, HALF - 1)
    pos[i * 3 + 1] = T + between(2, 20)
    pos[i * 3 + 2] = at(between(DECK.e1, GATE.e0))
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  const sparkles = new Points(geo, new PointsMaterial({ color: '#ffffff', size: 0.07, transparent: true, opacity: 0.9 }))
  k.g.add(sparkles)
  const vine = k.std('#2f7a2e', { roughness: 0.8 })
  for (let i = 0; i < 22; i++) {
    const len = between(2.5, 6.5)
    k.mesh(new CylinderGeometry(0.1, 0.16, len, 4), vine, CX + between(-5, 5), WALL.top - len / 2, at(between(14, GATE.e0 - 6)), { cast: false })
  }
  return sparkles
}

// --- The mine deck's end and the three platforms ----------------------------------------
function buildCourse(k) {
  const m = material(k)
  const arrowMat = arrowTexture(COL.yellow)
  // The deck, carried on to the chasm's edge: wooden planks on stilts, a rail track and a last lamp post each side.
  const dz0 = at(DECK.e0)
  const dz1 = at(DECK.e1)
  k.voxSpan(CX - DECK.half, CX + DECK.half, dz0, dz1, { y0: T - 1, y1: T, side: tex.woodDark, top: tex.wood, cell: 1.2, cast: false })
  k.voxSpan(CX - DECK.half + 1, CX + DECK.half - 1, dz0, dz1, { y0: FLOOR_Y, y1: T - 1, side: tex.woodDark, cell: 2, collide: false, cast: false })
  const railGeo = new BoxGeometry(0.12, 0.15, DECK.e1 - DECK.e0)
  for (const s of [-1, 1]) k.mesh(railGeo, m.rail, CX + 2 + s * 0.6, T + 0.22, at((DECK.e0 + DECK.e1) / 2), { cast: false })

  for (const st of STATIONS) {
    const z0 = at(st.e0)
    const z1 = at(st.e1)
    const w = st.half * 2
    if (st.kind === 'rock') {
      // A terracotta block from the floor with a pale top.
      k.voxSpan(CX - st.half, CX + st.half, z0, z1, { y0: FLOOR_Y, y1: st.top, side: tex.terracotta, top: tex.cream, cell: 2.5, cast: false })
    } else {
      // A wooden scaffold: planks, stilts to the floor and cross braces. Its collider reaches 4 m down so the cable finds the face.
      k.voxSpan(CX - st.half, CX + st.half, z0, z1, { y0: st.top - 1, y1: st.top, side: tex.woodDark, top: tex.wood, cell: 1.2, collide: false, cast: false })
      k.addCollider(CX, (z0 + z1) / 2, w, st.e1 - st.e0, st.top, 0, st.top - 4)
      const stilt = new BoxGeometry(0.7, st.top - FLOOR_Y, 0.7)
      for (const sx of [-1, 1]) for (const e of [st.e0 + 1, st.e1 - 1]) k.mesh(stilt, m.wood, CX + sx * (st.half - 0.6), (st.top + FLOOR_Y) / 2, at(e), { cast: false })
      const brace = new BoxGeometry(0.35, 9, 0.35)
      for (const sx of [-1, 1]) {
        const b = k.mesh(brace, m.wood, CX + sx * (st.half - 0.6), st.top - 5.5, (z0 + z1) / 2, { cast: false })
        b.rotation.x = Math.atan2(st.e1 - st.e0 - 2, 8)
      }
    }
    // The pillar at the back, its blue anchor cube and the arrow pointing up at it.
    const px = CX + st.pillar.dx
    const pz = at(st.e1 - 1.5)
    pillar(k, px, pz, st.top, PILLAR.h, st.pillar.color, { shards: 4 })
    for (const [ox, oz, h] of [[-1.6, 0.4, 1.6], [1.5, -0.6, 1.2], [0.6, 1.4, 1]]) k.mesh(new ConeGeometry(0.45, h, 5), m.crystal[st.pillar.color], px + ox, st.top + h / 2, pz + oz, { cast: false })
    const faceZ = pz + PILLAR.size / 2
    const cube = k.mesh(new BoxGeometry(PILLAR.cube, PILLAR.cube, PILLAR.cube), m.cube, px, st.top + PILLAR.cubeY, faceZ + 0.5, { cast: false })
    cube.rotation.set(0.3, 0.5, 0.2)
    decal(k, arrowMat, px, st.top + PILLAR.cubeY - 1.4, faceZ, 1.1, 1.1)
  }
}

// --- The gate: terracotta walls, a wooden frame and boulders overhead ---------------------
function buildGate(k) {
  const m = material(k)
  const g = GATE
  const z0 = at(g.e0)
  const z1 = at(g.e1)
  // The last platform's floor carries on through the gate.
  k.voxSpan(CX - HALF, CX + HALF, z0, z1, { y0: FLOOR_Y, y1: g.top, side: tex.terracotta, top: tex.wood, cell: 2.5, cast: false })
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? CX - HALF : CX + g.half
    const x1 = s < 0 ? CX - g.half : CX + HALF
    k.voxSpan(x0, x1, z0, z1, { y0: g.top, y1: WALL.top - 4, side: tex.terracotta, top: tex.cream, cell: 2.5, cast: false })
    k.voxSpan(x0 - 0.2, x1 + 0.2, z0 + 0.2, z1 - 0.2, { y0: WALL.top - 4, y1: WALL.top - 3.4, side: tex.cream, cell: 1, collide: false, cast: false }) // pale lip
  }
  // Dark boulders wedged into the roof above the doorway.
  for (const [dx, dy, dz, r] of [[-3, 0, 1, 3.4], [0.5, 0.8, 2.5, 4], [3.5, 0, 0.5, 3.2], [-0.5, -0.5, 5.5, 3]]) {
    const b = k.mesh(new SphereGeometry(r, 8, 6), m.boulder, CX + dx, WALL.top - 3 + dy, at(g.e0 + dz), { cast: false })
    b.scale.y = 0.8
  }
  // Wooden frame over the track on the candy deck's edge: posts, beam, braces and little lamps.
  const fz = at(CANDY.e0 + 2)
  const post = new BoxGeometry(0.8, 8, 0.8)
  for (const s of [-1, 1]) {
    const x = CX + s * 6
    k.mesh(post, m.wood, x, CANDY.top + 4, fz, { cast: false })
    k.addCollider(x, fz, 0.8, 0.8, CANDY.top + 8, 0, CANDY.top)
    const b = k.mesh(new BoxGeometry(0.4, 3, 0.4), m.wood, x - s * 1.2, CANDY.top + 6.6, fz, { cast: false })
    b.rotation.z = -s * Math.PI / 4
    k.mesh(new BoxGeometry(0.3, 0.4, 0.3), m.lamp, x, CANDY.top + 5, fz + 0.55, { cast: false })
  }
  k.mesh(new BoxGeometry(12.8, 0.8, 0.9), m.wood, CX, CANDY.top + 8.2, fz, { cast: false })
}

// A lollipop on the deck: a white stick and a spiral disc facing south.
function lollipop(k, x, z, base, radius, color) {
  const m = material(k)
  const stickH = radius * 1.6
  k.mesh(new CylinderGeometry(0.18, 0.18, stickH, 8), m.stick, x, base + stickH / 2, z, { cast: false })
  const disc = k.mesh(new CircleGeometry(radius, 28), new MeshBasicMaterial({ map: spiralTexture(color) }), x, base + stickH + radius * 0.6, z + 0.2, { cast: false })
  const back = k.mesh(new CircleGeometry(radius, 28), new MeshBasicMaterial({ map: spiralTexture(color) }), x, base + stickH + radius * 0.6, z - 0.2, { cast: false })
  back.rotation.y = Math.PI
  disc.receiveShadow = false
  k.addCollider(x, z, 0.5, 0.5, base + stickH, 0, base)
}

// --- The candy-land deck: pink-and-white floor, pads, lollipops, arches ------------------------
function buildCandy(k) {
  const m = material(k)
  const c = CANDY
  const z0 = at(c.e0)
  const z1 = at(c.e1)
  // Orange planks (the mine's rail track runs on across them) for the first stretch, then the candy floor.
  const plank = 10 // m
  const zp = at(c.e0 + plank)
  k.addCollider(CX, (z0 + z1) / 2, HALF * 2, c.e1 - c.e0, c.top, 0, FLOOR_Y)
  k.voxSpan(CX - HALF, CX + HALF, z0, zp, { y0: FLOOR_Y, y1: c.top, side: tex.terracotta, top: tex.wood, cell: 2.5, collide: false, cast: false })
  const railGeo = new BoxGeometry(0.12, 0.15, plank)
  for (const s of [-1, 1]) k.mesh(railGeo, m.rail, CX + 2 + s * 0.6, c.top + 0.22, at(c.e0 + plank / 2), { cast: false })
  const tieGeo = new BoxGeometry(1.8, 0.12, 0.35)
  for (let e = c.e0 + 1; e < c.e0 + plank; e += 1.4) k.mesh(tieGeo, m.wood, CX + 2, c.top + 0.08, at(e), { cast: false })
  const floor = candyFloorTexture()
  floor.repeat.set((HALF * 2) / 3, (c.e1 - c.e0 - plank) / 3)
  const slab = k.mesh(new BoxGeometry(HALF * 2, c.top - FLOOR_Y, c.e1 - c.e0 - plank), [k.std(COL.cream), k.std(COL.cream), new MeshStandardMaterial({ map: floor, roughness: 0.8 }), k.std(COL.cream), k.std(COL.cream), k.std(COL.cream)], CX, (c.top + FLOOR_Y) / 2, (zp + z1) / 2, { cast: false })
  slab.receiveShadow = true
  // The brown building at the back, under open sky, with the doorway through it into Zone 10 (a yellow arrow over it).
  const zEnd = at(END_E)
  k.voxSpan(CX - HALF, CX + HALF, z1, zEnd, { y0: FLOOR_Y, y1: c.top, side: tex.terracotta, top: tex.wood, cell: 3, cast: false })
  k.voxSpan(CX - HALF, CX - DOOR.half, z1, zEnd, { y0: c.top, y1: c.top + 9, side: tex.terracotta, top: tex.cream, cell: 3, cast: false })
  k.voxSpan(CX + DOOR.half, CX + HALF, z1, zEnd, { y0: c.top, y1: c.top + 9, side: tex.terracotta, top: tex.cream, cell: 3, cast: false })
  k.voxSpan(CX - DOOR.half, CX + DOOR.half, z1, zEnd, { y0: c.top + DOOR.h, y1: c.top + 9, side: tex.terracotta, top: tex.cream, cell: 3, cast: false })
  decal(k, arrowTexture(COL.yellow), CX, c.top + DOOR.h + 2.2, z1, 2.2, 2.2)

  // Lollipops and candy arches.
  lollipop(k, CX - 5.5, at(c.e0 + 5), c.top, 3.4, COL.pink)
  lollipop(k, CX + 1, at(c.e0 + 6), c.top, 3.2, '#2fd8e8')
  for (const [dx, e, r, color] of [[-6.5, 14, 1.4, COL.pink], [6.2, 11, 1.2, '#2fd8e8'], [5.5, 20, 1.5, COL.pink], [-6, 22, 1.2, '#2fd8e8']]) lollipop(k, CX + dx, at(c.e0 + e), c.top, r, color)
  const archGeo = new TorusGeometry(2.4, 0.35, 8, 20, Math.PI)
  const archMats = [k.std(COL.pink, { roughness: 0.5 }), k.std('#ffffff', { roughness: 0.5 })]
  for (const [dx, e, i] of [[-6.8, 8, 0], [6.8, 16, 1], [-6.8, 18, 1]]) {
    const arch = k.mesh(archGeo, archMats[i], CX + dx, c.top, at(c.e0 + e), { cast: false })
    arch.rotation.y = Math.PI / 2
  }
  // Gumdrops: little cones in pink, teal and lilac along the sides.
  const gumGeo = new ConeGeometry(0.8, 1.2, 10)
  const gums = [k.std('#ff9bd0'), k.std('#7ff0e8'), k.std('#c9a8ff')]
  for (let i = 0; i < 10; i++) {
    const s = i % 2 ? 1 : -1
    k.mesh(gumGeo, gums[i % 3], CX + s * between(HALF - 2.2, HALF - 0.9), c.top + 0.6, at(c.e0 + 3 + i * 2.1), { cast: false })
  }

  const top = c.top
  const pad = winPad(k, WIN_PAD.x, WIN_PAD.z, top, ZONE9_WIN)
  paidPad(k, PAID_PAD.x, PAID_PAD.z, top, '+400 Wins')

  // The x2 Hair treadmill: runs like the Hub's, console to the north.
  const treadmill = buildTreadmill(k.g, k.addCollider, {
    x: TREAD.x, z: TREAD.z, y: top, yaw: -Math.PI / 2, length: TREAD.len, width: TREAD.w, theme: 'frost', mult: TREAD.mult, labelY: 3.9,
    labels: [
      { text: '[x2 Boost]', size: 0.35, fill: '#ff5a9a', stroke: '#3a0a1a' },
      { text: `x${TREAD.mult} Hair`, size: 0.7, fill: ['#d6fbff', '#5fd8ff'], stroke: '#0a3a5a' },
    ],
  })
  return { pad, treadmill }
}

export function buildZone9(scene, addCollider) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)
  textures()

  const sparkles = buildShell(k)
  buildCourse(k)
  buildGate(k)
  const { pad, treadmill } = buildCandy(k)

  const ring = new Mesh(new TorusGeometry(RING.radius, 0.16, 10, 32), k.std(COL.yellow, { emissive: '#ffb000', emissiveIntensity: 0.6, roughness: 0.3 }))
  ring.position.set(RING.x, RING.y, RING.z) // faces south, across the zip line
  g.add(ring)

  label(g, [{ text: `🏆 +${ZONE9_BONUS} Win`, size: 0.5, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }], [RING.x, RING.y + RING.radius + 0.6, RING.z], { unit: 1.2 })
  label(g, [
    { text: 'HAIR CABLE ONLY', size: 0.45, fill: ['#7ff6ff', '#3fd8ff'], stroke: '#0a2a3a' },
    { text: 'SPACE = ZIP', size: 0.9, fill: '#ffffff', stroke: '#2a0a4a' },
  ], [CX, T + 11, at(DECK.e1 + 3)], { unit: 2 })

  const inZone = (p) => p.z <= ZONE9_Z0 && p.z > at(END_E) && Math.abs(p.x - CX) < HALF + WALL.thick
  let bonus = false
  let won = false
  return {
    treadmills: [treadmill], // main.js runs them with the Hub's
    // From Zone 8's mine deck to the candy deck's back building.
    contains: inZone,
    // Returns 'fell' (the chasm), 'bonus' (through the ring) or 'finish' (the win pad).
    update(dt, time, p) {
      ring.position.y = RING.y + Math.sin(time * 2) * 0.12
      pad.update(time)
      treadmill.update(dt, time)
      sparkles.position.y = Math.sin(time * 0.4) * 0.4
      if (inZone(p) && p.y < FALL_Y) return 'fell'
      if (!bonus && Math.abs(p.z - RING.z) < RING.reach && Math.hypot(p.x - RING.x, p.y + 0.9 - ring.position.y) < RING.radius) {
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
