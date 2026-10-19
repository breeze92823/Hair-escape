// Zone 3: ICE LAKE. Past the Lava Run finish (which doubles as this zone's
// entrance) a long sunken lake runs north between sheer dark-blue walls,
// stepped glaciers and tall crystal spikes, with grass terraces, blocky trees
// and grey mountains beyond. Hop the ice floes to the golden ring on the far
// platform, under a sandstone fortress that teases the next zone. Falling in
// the water puts you back on the entrance; the ring awards ZONE3_WIN wins.
// Procedural like Zone 2 (voxel canvas textures, boxes, cones).
import {
  BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, TorusGeometry,
} from 'three'
import { LAVA_FINISH, buildTree, kit, voxelTexture } from './lavaPath.js'
import { label } from './lobby/labels.js'
import { makeCanvas } from './lobby/paint.js'

export const ZONE3_NAME = 'ICE LAKE'
export const ZONE3_WIN = 5 // wins for reaching the ring (advertised on the entrance trophy)
// Where a fall into the lake puts you: on the entrance, clear of the win pad.
export const ZONE3_SPAWN = { x: 1, y: LAVA_FINISH.top + 0.1, z: LAVA_FINISH.z - 1 }

const WATER_Y = 0.12
const LAKE = { halfW: 22, z0: LAVA_FINISH.z1, z1: -162 } // the water between the walls
const BANK = { x1: 30, top: 3 } // sheer dark-blue walls, snow on top
const SHELF = { x1: 40, top: 6 } // first ice terrace
const GLACIER = { x1: 50, top: 9 } // high ice terrace with the tallest spikes
const OUTER = { x1: 80, top: 7 } // grass beyond, like the Lava Run terraces
const FAR_Z = -176 // north edge of everything (the fortress backs onto it)
const FLOE_TOP = 1

// The jump path, south to north: [x, z, w, d, top]. Gaps are 2-3.5 m (a flat
// running jump clears ~6.8 m); the two rest blocks rise at most 1 m above a floe.
const PATH = [
  [0, -101, 4, 4, FLOE_TOP],
  [-4.5, -107, 4.5, 4, FLOE_TOP],
  [-1, -115, 8, 6, 1.8],
  [5, -122, 3.5, 3.5, FLOE_TOP],
  [0.5, -127.5, 3, 3, FLOE_TOP],
  [-4, -133, 3.5, 3, FLOE_TOP],
  [1, -140.5, 8, 6, 2],
]
const GOAL = { z0: -147, z1: -157, w: 14, top: 1.6 } // the ice platform under the ring
const goalZ = (GOAL.z0 + GOAL.z1) / 2
const RING = { z: goalZ - 1, y: GOAL.top + 2.6, radius: 1.9 }
const FORT = { z: LAKE.z1, halfW: 24 } // front face and half-width of the fortress facade

const COL = {
  deep: '#1f52c9',
  ice: '#8fd0ff',
  iceMid: '#5fb2ee',
  snow: '#f4fbff',
  floeTop: '#e8f7ff',
  dirt: '#6b4226',
  grass: '#7ed321',
  rock: '#4b505c',
  rockTop: '#5c616d',
  sand: '#e2873b',
  sandLight: '#f3a85a',
  sandDark: '#c26626',
}

function mulberry32(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(3033)
const pick = (list) => list[Math.floor(rand() * list.length)]
const between = (a, b) => a + rand() * (b - a)

const tex = {}
function textures() {
  tex.deep = voxelTexture(COL.deep, { cells: 4, jitter: 0.08, grid: 0.18 })
  tex.ice = voxelTexture(COL.ice, { cells: 4, jitter: 0.08, grid: 0.12 })
  tex.iceMid = voxelTexture(COL.iceMid, { cells: 4, jitter: 0.08, grid: 0.14 })
  tex.snow = voxelTexture(COL.snow, { cells: 4, jitter: 0.03, grid: 0.08 })
  tex.floeTop = voxelTexture(COL.floeTop, { cells: 4, jitter: 0.03, grid: 0.06 })
  tex.dirt = voxelTexture(COL.dirt, { cells: 4, jitter: 0.12, grid: 0.18 })
  tex.grass = voxelTexture(COL.grass, { cells: 4, jitter: 0.06, grid: 0.16 })
  tex.rock = voxelTexture(COL.rock, { cells: 4, jitter: 0.08, grid: 0.2 })
  tex.rockTop = voxelTexture(COL.rockTop, { cells: 4, jitter: 0.06, grid: 0.12 })
  tex.sand = voxelTexture(COL.sand, { cells: 4, jitter: 0.07, grid: 0.2 })
  tex.sandLight = voxelTexture(COL.sandLight, { cells: 4, jitter: 0.05, grid: 0.14 })
  tex.sandDark = voxelTexture(COL.sandDark, { cells: 4, jitter: 0.08, grid: 0.22 })
}

// One material per crystal colour, shared by every spike and shard.
const crystalMats = new Map()
function crystal(k, color) {
  if (!crystalMats.has(color)) {
    crystalMats.set(color, k.std(color, { roughness: 0.2, emissive: '#4aa0e0', emissiveIntensity: 0.15, flatShading: true }))
  }
  return crystalMats.get(color)
}
const CRYSTALS = ['#9fdcff', '#7cc4f5', '#c8eeff', '#5fb2ee', '#3d8fe0']

// A tilted, flattened four-sided cone: an ice shard rather than a pyramid.
function spike(k, x, z, y, h) {
  const m = k.mesh(new ConeGeometry(h * between(0.14, 0.22), h, 4), crystal(k, pick(CRYSTALS)), x, y + h / 2 - 0.3, z)
  m.scale.z = between(0.35, 0.6)
  m.rotation.set(between(-0.22, 0.22), rand() * Math.PI, between(-0.22, 0.22))
}

// --- The lake and its floes ---------------------------------------------------
function buildLake(k) {
  const water = k.mesh(
    new PlaneGeometry(LAKE.halfW * 2, LAKE.z0 - LAKE.z1),
    new MeshStandardMaterial({ color: '#49b6f5', emissive: '#1e78c8', emissiveIntensity: 0.3, roughness: 0.15, metalness: 0.1 }),
    0, WATER_Y, (LAKE.z0 + LAKE.z1) / 2, { cast: false },
  )
  water.rotation.x = -Math.PI / 2

  // A floe: light-blue ice rising out of the water with a white snow top.
  const floe = (x, z, w, d, top) => {
    k.voxBox({ x, z, w, d, y1: top - 0.2, side: tex.ice, cell: 1, collide: false })
    k.voxBox({ x, z, w, d, y0: top - 0.2, y1: top, side: tex.floeTop, cell: 1, collide: false })
    k.addCollider(x, z, w, d, top)
  }
  // A rest block: dark-blue base, light-blue band, snow cap.
  const block = (x, z, w, d, top) => {
    k.voxBox({ x, z, w, d, y1: top - 0.9, side: tex.deep, cell: 1.4, collide: false })
    k.voxBox({ x, z, w, d, y0: top - 0.9, y1: top - 0.25, side: tex.ice, cell: 1.4, collide: false })
    k.voxBox({ x, z, w, d, y0: top - 0.25, y1: top, side: tex.snow, cell: 1.4, collide: false })
    k.addCollider(x, z, w, d, top)
  }
  for (const [x, z, w, d, top] of PATH) {
    if (top > FLOE_TOP) block(x, z, w, d, top)
    else floe(x, z, w, d, top)
    // A few small shards on top.
    const n = Math.floor(between(0, w * d > 20 ? 4 : 2))
    for (let i = 0; i < n; i++) spike(k, x + between(-w / 2 + 0.5, w / 2 - 0.5), z + between(-d / 2 + 0.5, d / 2 - 0.5), top, between(0.5, 1.1))
  }

  // Scattered thin floes off the path, kept clear of it.
  const nearPath = (x, z, r) => PATH.some(([px, pz, w, d]) => Math.abs(x - px) < w / 2 + r && Math.abs(z - pz) < d / 2 + r)
  for (let placed = 0, tries = 0; placed < 20 && tries < 300; tries++) {
    const w = between(1.2, 3.2)
    const d = between(1.2, 3)
    const x = between(-LAKE.halfW + 2, LAKE.halfW - 2)
    const z = between(GOAL.z0 + 2, LAKE.z0 - 3)
    if (nearPath(x, z, 2.5)) continue
    floe(x, z, w, d, between(0.35, 0.6))
    placed++
  }
}

// --- Banks: walls, ice terraces, spikes, grass and trees ------------------------
function buildBanks(k) {
  for (const s of [-1, 1]) {
    k.voxSpan(s * LAKE.halfW, s * BANK.x1, LAKE.z0, FAR_Z, { y1: BANK.top, side: tex.deep, top: tex.snow, cell: 2 })
    k.voxSpan(s * BANK.x1, s * SHELF.x1, LAKE.z0, FAR_Z, { y1: SHELF.top, side: tex.ice, top: tex.snow, cell: 2 })
    k.voxSpan(s * SHELF.x1, s * GLACIER.x1, LAKE.z0, FAR_Z, { y1: GLACIER.top, side: tex.iceMid, top: tex.snow, cell: 2.5 })
    k.voxSpan(s * GLACIER.x1, s * OUTER.x1, LAKE.z0, FAR_Z, { y1: OUTER.top, side: tex.dirt, top: tex.grass, cell: 2 })

    // Snow-capped ice blocks lining the top of the wall.
    for (let z = LAKE.z0 - 1; z > FAR_Z + 2; z -= between(3, 6)) {
      const len = between(2, 5)
      const w = between(1.5, 3.5)
      k.voxBox({ x: s * (LAKE.halfW + w / 2 + between(0.2, 1.5)), z: z - len / 2, w, d: len, y0: BANK.top, y1: BANK.top + between(0.6, 2.2), side: tex.ice, top: tex.snow, cell: 1, collide: false })
    }
    // Shelves stepping up to the first terrace, and from it to the glacier.
    for (let z = LAKE.z0 - 2; z > FAR_Z + 4; z -= between(4, 8)) {
      const len = between(3, 6)
      k.voxBox({ x: s * (BANK.x1 - 1.2), z: z - len / 2, w: between(2, 3), d: len, y0: BANK.top, y1: between(BANK.top + 1, SHELF.top - 0.4), side: tex.ice, top: tex.snow, cell: 1, collide: false })
    }
    for (let z = LAKE.z0 - 3; z > FAR_Z + 4; z -= between(5, 10)) {
      const len = between(3, 7)
      k.voxBox({ x: s * (SHELF.x1 - 1.4), z: z - len / 2, w: between(2, 3.5), d: len, y0: SHELF.top, y1: between(SHELF.top + 1, GLACIER.top - 0.4), side: tex.iceMid, top: tex.snow, cell: 1, collide: false })
    }

    // Crystal spikes, taller toward the far (north) end.
    const t = (z) => (LAKE.z0 - z) / (LAKE.z0 - FAR_Z)
    for (let i = 0; i < 6; i++) {
      const z = between(FAR_Z + 2, LAKE.z0 - 8)
      spike(k, s * between(LAKE.halfW + 2.5, BANK.x1 - 1), z, BANK.top, between(5, 9) + 6 * t(z))
    }
    for (let i = 0; i < 14; i++) {
      const z = between(FAR_Z + 2, LAKE.z0 - 4)
      spike(k, s * between(BANK.x1 + 1.5, SHELF.x1 - 1.5), z, SHELF.top, between(6, 11) + 8 * t(z))
    }
    for (let i = 0; i < 14; i++) {
      const z = between(FAR_Z + 2, LAKE.z0 - 4)
      spike(k, s * between(SHELF.x1 + 1.5, GLACIER.x1 - 1.5), z, GLACIER.top, between(8, 14) + 10 * t(z))
    }
    // Loose snow chunks on the terraces.
    for (let i = 0; i < 10; i++) {
      const w = between(1.2, 2.6)
      const onGlacier = rand() < 0.5
      const x = onGlacier ? between(SHELF.x1 + 1, GLACIER.x1 - 1) : between(BANK.x1 + 1, SHELF.x1 - 1)
      k.voxBox({ x: s * x, z: between(FAR_Z + 2, LAKE.z0 - 2), w, d: w, y0: onGlacier ? GLACIER.top : SHELF.top, y1: (onGlacier ? GLACIER.top : SHELF.top) + w * 0.6, side: tex.snow, cell: 1, collide: false })
    }

    // Grass beyond the ice: blocky trees.
    for (let z = LAKE.z0 - 5; z > FAR_Z + 6; z -= between(9, 15)) buildTree(k, s * between(GLACIER.x1 + 4, OUTER.x1 - 4), z, OUTER.top)
  }
}

// Dark grey stepped voxel mountains in the distance, mostly to the east.
function buildMountains(k) {
  const peaks = [[100, -125, 38], [128, -158, 52], [104, -185, 34], [150, -112, 28], [-112, -165, 30], [-138, -128, 24]]
  for (const [x, z, h] of peaks) {
    const base = h * 1.1
    for (let i = 0; i < 4; i++) {
      const w = base * (1 - i * 0.22)
      k.voxBox({ x: x + between(-2, 2), z: z + between(-2, 2), w, d: w, y1: (h * (i + 1)) / 4, side: tex.rock, top: tex.rockTop, cell: 4, collide: false, cast: false })
    }
  }
}

// --- The far end: the goal platform and the fortress ---------------------------
function buildGoal(k) {
  const d = GOAL.z0 - GOAL.z1
  k.voxBox({ x: 0, z: goalZ, w: GOAL.w, d, y1: GOAL.top - 0.7, side: tex.deep, cell: 1.4, collide: false })
  k.voxBox({ x: 0, z: goalZ, w: GOAL.w, d, y0: GOAL.top - 0.7, y1: GOAL.top, side: tex.ice, top: tex.floeTop, cell: 1.4, collide: false })
  k.addCollider(0, goalZ, GOAL.w, d, GOAL.top)

  // Low ice pillars on the corners, two taller ones flanking the ring.
  const pillar = (x, z, h) => {
    k.voxBox({ x, z, w: 1, d: 1, y0: GOAL.top, y1: GOAL.top + h, side: tex.ice, cell: 1 })
    k.voxBox({ x, z, w: 1.2, d: 1.2, y0: GOAL.top + h, y1: GOAL.top + h + 0.3, side: tex.snow, cell: 1, collide: false })
  }
  for (const sx of [-1, 1]) {
    for (const z of [GOAL.z0 - 0.9, GOAL.z1 + 0.9]) pillar(sx * (GOAL.w / 2 - 0.9), z, 1.4)
    pillar(sx * 3.2, RING.z, 3.2)
  }

  k.mesh(
    new CylinderGeometry(RING.radius, RING.radius, 0.1, 40),
    k.std('#ffc21a', { emissive: '#ffb000', emissiveIntensity: 0.5, roughness: 0.35 }),
    0, GOAL.top + 0.05, RING.z, { cast: false },
  )
  // Upright, facing south down the lake (a torus lies in the XY plane).
  const ring = new Mesh(new TorusGeometry(RING.radius, 0.2, 12, 48), k.std('#ffd21a', { emissive: '#ffb000', emissiveIntensity: 0.6, roughness: 0.3 }))
  ring.position.set(0, RING.y, RING.z)
  ring.castShadow = true
  k.g.add(ring)
  return ring
}

// Night-sky gate for the top of the keep: deep purple with stars.
function portalTexture() {
  const W = 128
  const H = 160
  const c = makeCanvas(W, H)
  const ctx = c.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#12042e')
  grad.addColorStop(1, '#5a1fa0')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  const r = mulberry32(77)
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`
    const s = r() < 0.15 ? 3 : 2
    ctx.fillRect(r() * W, r() * H, s, s)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

// Terracotta sandstone fortress closing the lake: layered blocky towers with
// purple windows, gold diamonds, cacti and a night-sky gate on top. A facade:
// only its base is solid.
function buildFortress(k) {
  const z0 = FORT.z
  // A tower set `set` m back from the fortress front, from y0 to y1. Returns its front face z.
  const tower = (x, w, y1, set, side = tex.sand, y0 = 0) => {
    k.voxSpan(x - w / 2, x + w / 2, z0 - set, FAR_Z, { y0, y1, side, top: tex.sandLight, cell: 3, collide: y0 === 0, cast: false })
    return z0 - set
  }
  // Merlons along a tower's front edge.
  const crenellate = (x, w, y, front) => {
    const n = Math.max(2, Math.round(w / 2))
    for (let i = 0; i < n; i++) {
      k.voxBox({ x: x - w / 2 + 0.5 + (i * (w - 1)) / (n - 1), z: front - 0.5, w: 1, d: 1, y0: y, y1: y + 1, side: tex.sandLight, cell: 1, collide: false })
    }
  }
  const windowMat = k.std('#6a3cff', { emissive: '#4a1fd0', emissiveIntensity: 0.6, roughness: 0.4 })
  const slit = (x, y, front) => k.mesh(new BoxGeometry(1.1, 2, 0.3), windowMat, x, y, front + 0.1, { cast: false })
  const goldMat = k.std('#ffcf1f', { emissive: '#d99a00', emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.3 })
  const diamond = (x, y, front, s = 1.3) => {
    const m = k.mesh(new BoxGeometry(s, s, 0.25), goldMat, x, y, front + 0.1, { cast: false })
    m.rotation.z = Math.PI / 4
  }
  const cactusMat = k.std('#4fa82a', { roughness: 0.85 })
  const cactus = (x, y, z) => {
    const h = between(1.6, 2.6)
    k.mesh(new BoxGeometry(0.6, h, 0.6), cactusMat, x, y + h / 2, z)
    const arm = between(0.6, 1)
    k.mesh(new BoxGeometry(0.4, arm, 0.4), cactusMat, x + 0.55, y + h * 0.55 + arm / 2, z)
    k.mesh(new BoxGeometry(0.5, 0.35, 0.4), cactusMat, x + 0.35, y + h * 0.55, z)
  }

  // Base wall with a protruding light ledge, a dark doorway and pilasters.
  const baseFront = tower(0, FORT.halfW * 2, 9, 0)
  k.voxSpan(-FORT.halfW - 0.5, FORT.halfW + 0.5, z0 + 0.6, z0 - 1.5, { y0: 8.5, y1: 9.4, side: tex.sandLight, cell: 1, collide: false })
  k.voxBox({ x: 0, z: baseFront + 0.1, w: 5, d: 0.4, y1: 6, side: tex.sandDark, cell: 1, collide: false })
  for (const x of [-16, -8, 8, 16]) k.voxBox({ x, z: baseFront + 0.25, w: 1.4, d: 0.5, y1: 8.5, side: tex.sandDark, cell: 1, collide: false })
  for (const x of [-12, -4, 4, 12]) diamond(x, 4.5, baseFront + 0.25)
  for (const x of [-19, -14, 14, 19]) cactus(x, 9.4, z0 - 0.6)

  for (const s of [-1, 1]) {
    // Outer towers, with a stepped top.
    const outer = tower(s * 20, 8, 20, 1)
    slit(s * 20, 15, outer)
    tower(s * 20, 5.5, 23, 2.5, tex.sandLight, 20)
    crenellate(s * 20, 8, 20, outer)
    cactus(s * 22.6, 20, outer - 0.6)
    // Side towers.
    const side = tower(s * 11.5, 9, 30, 3, tex.sandDark)
    slit(s * 11.5, 22, side)
    slit(s * 11.5, 26.5, side)
    diamond(s * 11.5, 17, side)
    tower(s * 11.5, 6, 34, 4.5, tex.sand, 30)
    crenellate(s * 11.5, 9, 30, side)
    k.voxSpan(s * 7, s * 16, side + 0.4, side - 0.4, { y0: 14, y1: 14.8, side: tex.sandLight, cell: 1, collide: false })
  }

  // Central keep, twin turrets and the night-sky gate between them.
  const keep = tower(0, 12, 37, 5)
  for (const x of [-2.5, 2.5]) slit(x, 30, keep)
  diamond(0, 24, keep, 1.6)
  diamond(0, 13, keep)
  k.voxSpan(-6.5, 6.5, keep + 0.4, keep - 0.4, { y0: 20, y1: 20.8, side: tex.sandLight, cell: 1, collide: false })
  const turretFront = keep - 0.5
  for (const s of [-1, 1]) tower(s * 4.5, 3.5, 45, 5.5, tex.sandDark, 37)
  k.voxSpan(-6.25, 6.25, turretFront, turretFront - 3.5, { y0: 43.5, y1: 45.2, side: tex.sandLight, cell: 1, collide: false, cast: false })
  crenellate(0, 12.5, 45.2, turretFront)
  const gate = k.mesh(new PlaneGeometry(5.5, 6.5), new MeshBasicMaterial({ map: portalTexture(), toneMapped: false }), 0, 37 + 3.25, turretFront - 0.4, { cast: false })
  gate.receiveShadow = false
}

export function buildZone3(scene, addCollider) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)
  textures()

  buildLake(k)
  buildBanks(k)
  buildMountains(k)
  const ring = buildGoal(k)
  buildFortress(k)

  label(g, [
    { text: 'RECOMMENDED', size: 0.45, fill: ['#bff4ff', '#2fd8ff'], stroke: '#0a2a5a' },
    { text: 'LEVEL 16', size: 1, fill: '#ffffff', stroke: '#1b2a4a' },
  ], [0, 3.8, -117], { unit: 1.4 })

  let won = false
  return {
    // From the entrance (the Lava Run finish) north. main.js checks this before the Lava Run.
    contains: (p) => p.z < LAVA_FINISH.z0 && p.z > FAR_Z && Math.abs(p.x) < GLACIER.x1,
    // Returns 'fell' or 'finish' when the player triggers one.
    update(dt, time, p) {
      ring.position.y = RING.y + Math.sin(time * 2) * 0.15
      const inLake = Math.abs(p.x) < LAKE.halfW && p.z < LAKE.z0 && p.z > LAKE.z1
      if (inLake && p.y < WATER_Y + 0.15) return 'fell'
      if (!won && Math.hypot(p.x, p.z - RING.z) < RING.radius + 0.4 && p.y >= GOAL.top - 0.05) {
        won = true
        return 'finish'
      }
      return null
    },
    reset() {
      won = false
    },
  }
}
