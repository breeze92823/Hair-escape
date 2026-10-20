// Zone 3: ICE LAKE. Past the Lava Run finish (which doubles as this zone's
// entrance) a long sunken lake runs north between sheer dark-blue walls,
// stepped glaciers and tall crystal spikes, with grass terraces, blocky trees
// and grey mountains beyond. Hop the ice floes to the goal platform, which
// doubles as the entrance to Zone 4 (the DESERT CANYON, zone4.js): its yellow
// pad awards ZONE3_WIN wins and the run carries on. Falling in the water puts
// you back on the entrance. Procedural like Zone 2 (voxel canvas textures,
// boxes, cones).
import {
  ConeGeometry, Group, MeshStandardMaterial, PlaneGeometry,
} from 'three'
import { LAVA_FINISH, buildTree, kit, voxelTexture } from './lavaPath.js'
import { label } from './lobby/labels.js'
import { buildTreadmill } from './lobby/treadmill.js'
import { winPad } from './zoneProps.js'

export const ZONE3_NAME = 'ICE LAKE'
export const ZONE3_WIN = 3 // wins for stepping on the goal pad (advertised on the Lava Run trophy)
// Where a fall into the lake puts you: on the entrance, clear of the win pad.
export const ZONE3_SPAWN = { x: 1, y: LAVA_FINISH.top + 0.1, z: LAVA_FINISH.z - 1 }

const WATER_Y = 0.12
const LAKE = { halfW: 22, z0: LAVA_FINISH.z1, z1: -157 } // the water between the walls; Zone 4's lava starts past it
const BANK = { x1: 30, top: 3 } // sheer dark-blue walls, snow on top
const SHELF = { x1: 40, top: 6 } // first ice terrace
const GLACIER = { x1: 50, top: 9 } // high ice terrace with the tallest spikes
const OUTER = { x1: 80, top: 7 } // grass beyond, like the Lava Run terraces
const FAR_Z = -159 // north edge of the banks (Zone 4's sandstone terraces take over)
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
const GOAL = { z0: -147, z1: LAKE.z1, w: 14, top: 1.6 } // the ice platform at the end of the lake
const goalZ = (GOAL.z0 + GOAL.z1) / 2
const PAD = { x: -3.2 } // the yellow win pad, left of centre
const TREAD = { x: 3.4, len: 4.8, w: 2.4, mult: 1.1 } // the x1.1 Hair treadmill, right of centre (m); its console faces north
const COLUMN_H = 5 // m: the tall ice columns on the canyon-side corners

// Zone 4 builds its entrance off the goal platform.
export const ZONE3_GOAL = { z: goalZ, z0: GOAL.z0, z1: GOAL.z1, w: GOAL.w, top: GOAL.top, padX: PAD.x }

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

// --- The far end: the goal platform, which doubles as Zone 4's entrance --------
// Snow-white ice platform with tall ice columns on the canyon-side corners, the
// yellow win pad (a trophy spinning over it) on the left, an ice throne behind
// it, and an x1.1 Hair treadmill (the Hub's model and behaviour) on the right.
function buildGoal(k) {
  const d = GOAL.z0 - GOAL.z1
  k.voxBox({ x: 0, z: goalZ, w: GOAL.w, d, y1: GOAL.top - 0.7, side: tex.deep, cell: 1.4, collide: false })
  k.voxBox({ x: 0, z: goalZ, w: GOAL.w, d, y0: GOAL.top - 0.7, y1: GOAL.top, side: tex.ice, top: tex.floeTop, cell: 1.4, collide: false })
  k.addCollider(0, goalZ, GOAL.w, d, GOAL.top)

  // Low ice pillars on the lake-side corners, tall snow-capped columns on the canyon side.
  const pillar = (x, z, w, h) => {
    k.voxBox({ x, z, w, d: w, y0: GOAL.top, y1: GOAL.top + h, side: tex.ice, cell: 1 })
    k.voxBox({ x, z, w: w + 0.3, d: w + 0.3, y0: GOAL.top + h, y1: GOAL.top + h + 0.4, side: tex.snow, cell: 1, collide: false })
  }
  for (const sx of [-1, 1]) {
    pillar(sx * (GOAL.w / 2 - 0.6), GOAL.z0 - 0.6, 1, 1.4)
    pillar(sx * (GOAL.w / 2 - 1.1), GOAL.z1 + 1.1, 2.2, COLUMN_H)
  }

  // The shared yellow win pad with its spinning trophy and "+N Wins" label.
  const pad = winPad(k, PAD.x, goalZ, GOAL.top, ZONE3_WIN)

  // Ice throne behind the pad, facing back down the lake.
  const tx = PAD.x - 2.4
  const tz = goalZ - 3
  k.voxBox({ x: tx, z: tz, w: 1.6, d: 1.4, y0: GOAL.top, y1: GOAL.top + 0.9, side: tex.ice, top: tex.snow, cell: 0.8 })
  k.voxBox({ x: tx, z: tz - 0.55, w: 1.6, d: 0.35, y0: GOAL.top + 0.9, y1: GOAL.top + 2.6, side: tex.ice, top: tex.snow, cell: 0.8, collide: false })
  for (const s of [-1, 1]) k.voxBox({ x: tx + s * 0.72, z: tz, w: 0.25, d: 1.2, y0: GOAL.top + 0.9, y1: GOAL.top + 1.4, side: tex.snow, cell: 0.5, collide: false })

  // x1.1 Hair treadmill: runs like the Hub's, console to the north so the runner faces up the canyon.
  const treadmill = buildTreadmill(k.g, k.addCollider, {
    x: TREAD.x, z: goalZ, y: GOAL.top, yaw: -Math.PI / 2, length: TREAD.len, width: TREAD.w, theme: 'ice', mult: TREAD.mult, labelY: 3.9,
    labels: [
      { text: '[x2 Boost]', size: 0.35, fill: '#ff5a5a', stroke: '#3a0a0a' },
      { text: `x${TREAD.mult} Hair`, size: 0.6, fill: ['#d6fbff', '#5fd8ff'], stroke: '#0a3a5a' },
    ],
  })
  return { pad, treadmill }
}

// `nextWin`: the wins the next zone's finish awards, advertised on the trophy sign.
export function buildZone3(scene, addCollider, { nextWin = 0 } = {}) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)
  textures()

  buildLake(k)
  buildBanks(k)
  buildMountains(k)
  const { pad, treadmill } = buildGoal(k)

  label(g, [
    { text: 'RECOMMENDED', size: 0.45, fill: ['#bff4ff', '#2fd8ff'], stroke: '#0a2a5a' },
    { text: 'LEVEL 16', size: 1, fill: '#ffffff', stroke: '#1b2a4a' },
  ], [0, 3.8, -117], { unit: 1.4 })
  label(g, [{ text: `🏆 +${nextWin} Wins`, size: 0.6, fill: ['#d6fbff', '#5fd8ff'], stroke: '#0a3a5a' }], [PAD.x, GOAL.top + 4.5, goalZ], { unit: 0.9 })

  let won = false
  return {
    treadmills: [treadmill], // main.js runs them with the Hub's
    // From the entrance (the Lava Run finish) to the goal platform. main.js checks this before the Lava Run.
    contains: (p) => p.z < LAVA_FINISH.z0 && p.z > FAR_Z && Math.abs(p.x) < GLACIER.x1,
    // Returns 'fell' or 'finish' when the player triggers one.
    update(dt, time, p) {
      pad.update(time)
      treadmill.update(dt, time)
      const inLake = Math.abs(p.x) < LAKE.halfW && p.z < LAKE.z0 && p.z > LAKE.z1
      if (inLake && p.y < WATER_Y + 0.15) return 'fell'
      if (!won && pad.onPad(p)) {
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
