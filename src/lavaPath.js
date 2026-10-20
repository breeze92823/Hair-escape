// Zone 2: LAVA RUN. Beyond the START doorway a lava river runs north down a
// voxel canyon: brown cliffs topped with grass terraces and blocky trees, a
// chain of thick stone slabs across the lava, a slate arch bridge overhead, and
// the finish platform at the far end, which doubles as the entrance to Zone 3
// (the ICE LAKE, zone3.js). Dropping into the canyon sends you back to spawn;
// the yellow pad on the finish awards a Win. Everything is procedural (canvas
// textures, boxes, cones).
import {
  BoxGeometry, CanvasTexture, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace,
} from 'three'
import { ROOM } from './lobby/lobby.js'
import { label } from './lobby/labels.js'
import { makeCanvas } from './lobby/paint.js'

export const ZONE_NAME = 'LAVA RUN'

const START_Z = ROOM.minZ // the doorway
const LAVA_Y = 0.08
const TOP = 1.6 // walkable top of every slab and the finish platform

// South to north. z0 is the near (south) edge; the gaps between are lava.
const SLABS = [
  { z0: START_Z, z1: START_Z - 16, w: 9, chevrons: [[0, START_Z - 6], [0, START_Z - 11]] },
  { z0: START_Z - 19, z1: START_Z - 29, w: 8.5, chevrons: [[0, START_Z - 23]] },
  { z0: START_Z - 32, z1: START_Z - 40, w: 8.5, chevrons: [[0, START_Z - 35.5]] },
  { z0: START_Z - 43, z1: START_Z - 50, w: 8, chevrons: [[0, START_Z - 46.5]] },
]
// Stairs from the Hub doorway up to the first slab: five 0.26 m risers (from the Hub's 0.3 m step), 0.9 m treads.
const STAIR = { from: 0.3, count: 5, run: 0.9, rise: 0.26 } // m
const STAIR_END_Z = START_Z + 0.6 - STAIR.count * STAIR.run
const FINISH = { z0: START_Z - 53, z1: START_Z - 63, w: 12 }
const finishZ = (FINISH.z0 + FINISH.z1) / 2
const PAD = { x: -3, size: 3 } // the yellow +1 Win pad, left of centre on the finish
const LADDER_X = 3.5 // the x1 Hair ladder, right of centre

const CANYON = { halfW: 15, endZ: FINISH.z1 } // lava floor between the cliffs; Zone 3's lake starts past it
const TERRACE = { x1: 32, top: 6 } // grass terraces from |x| 15 to 32
const PLATEAU = { x1: 80, top: 8, endZ: CANYON.endZ } // dark outer ground beyond them
// Spans the canyon just short of the finish, framing it from the slabs (and
// staying behind the camera once you look out over the ice lake).
const ARCH = { z: FINISH.z0 + 1.5, span: 46, foot: PLATEAU.top, rise: 8, band: 2.6, depth: 5 }

// Zone 3 builds its entrance off the finish platform.
export const LAVA_FINISH = { z: finishZ, z0: FINISH.z0, z1: FINISH.z1, w: FINISH.w, top: TOP, padX: PAD.x }

const COL = {
  dirt: '#6b4226',
  grass: '#7ed321',
  slateSide: '#3a4150',
  slabTop: '#d9d2c3',
  slabRim: '#eee8db',
  arch: '#3d4452',
  plateau: '#4b505c',
  plateauTop: '#5c616d',
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
const rand = mulberry32(2024)
const pick = (list) => list[Math.floor(rand() * list.length)]
const between = (a, b) => a + rand() * (b - a)

// --- Textures ---------------------------------------------------------------
// One tile of `cells` x `cells` voxel squares, each a slightly different shade
// of `base`, with faint grid lines: the blocky Roblox terrain look.
const voxelCanvases = new Map()
function voxelTexture(base, { cells = 4, jitter = 0.09, grid = 0.14 } = {}) {
  const key = `${base}|${cells}|${jitter}|${grid}`
  if (voxelCanvases.has(key)) return voxelCanvases.get(key)
  const S = 128
  const c = makeCanvas(S)
  const ctx = c.getContext('2d')
  const r = mulberry32(base.length * 97 + cells)
  const col = new Color(base)
  const cs = S / cells
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      ctx.fillStyle = `#${col.clone().multiplyScalar(1 + (r() - 0.5) * 2 * jitter).getHexString()}`
      ctx.fillRect(i * cs, j * cs, cs, cs)
    }
  }
  if (grid) {
    ctx.strokeStyle = `rgba(0,0,0,${grid})`
    ctx.lineWidth = 2
    for (let k = 0; k <= cells; k++) {
      ctx.beginPath()
      ctx.moveTo(k * cs, 0)
      ctx.lineTo(k * cs, S)
      ctx.moveTo(0, k * cs)
      ctx.lineTo(S, k * cs)
      ctx.stroke()
    }
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  voxelCanvases.set(key, t)
  return t
}

// Materials keyed by texture + repeat; clones share the canvas upload.
const matCache = new Map()
function voxelMaterial(tex, rx, ry, extra = {}) {
  const key = `${tex.uuid}|${rx.toFixed(2)}|${ry.toFixed(2)}`
  if (matCache.has(key)) return matCache.get(key)
  const map = tex.clone()
  map.repeat.set(rx, ry)
  const m = new MeshStandardMaterial({ map, roughness: 0.9, metalness: 0, ...extra })
  matCache.set(key, m)
  return m
}

// Cracked lava: Voronoi cells in reds and oranges, separated by bright yellow
// seams with a darker rim. Seamless (cells are wrapped across the tile edges).
// Painted once; Zone 4 clones it (clones share the canvas upload).
let lavaTex = null
function lavaTexture() {
  if (lavaTex) return lavaTex
  const S = 256
  const c = makeCanvas(S)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(S, S)
  const r = mulberry32(11)
  const pts = []
  for (let i = 0; i < 26; i++) {
    const x = r() * S
    const y = r() * S
    const tone = r()
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) pts.push(x + ox, y + oy, tone)
  }
  const lo = [255, 74, 12]
  const hi = [255, 142, 30]
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let d1 = Infinity
      let d2 = Infinity
      let tone = 0
      for (let i = 0; i < pts.length; i += 3) {
        const dx = pts[i] - x
        const dy = pts[i + 1] - y
        const d = dx * dx + dy * dy
        if (d < d1) {
          d2 = d1
          d1 = d
          tone = pts[i + 2]
        } else if (d < d2) d2 = d
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1)
      let rgb
      if (edge < 3) rgb = [255, 246, 150]
      else if (edge < 7) rgb = [255, 214, 20]
      else if (edge < 10) rgb = [226, 58, 8]
      else rgb = lo.map((v, k) => v + (hi[k] - v) * tone)
      const o = (y * S + x) * 4
      img.data[o] = rgb[0]
      img.data[o + 1] = rgb[1]
      img.data[o + 2] = rgb[2]
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  lavaTex = t
  return t
}

// Floor arrows: `count` stacked white chevrons pointing up the canvas (north).
function chevronTexture(count) {
  const S = 256
  const c = makeCanvas(S)
  const ctx = c.getContext('2d')
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 22
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const step = 90
  const y0 = S / 2 - ((count - 1) * step) / 2
  for (let i = 0; i < count; i++) {
    const y = y0 + i * step
    ctx.beginPath()
    ctx.moveTo(48, y + 40)
    ctx.lineTo(S / 2, y - 40)
    ctx.lineTo(S - 48, y + 40)
    ctx.stroke()
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

// --- Builders ---------------------------------------------------------------
function kit(g, addCollider) {
  const std = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...extra })

  const mesh = (geo, material, x, y, z, { cast = true } = {}) => {
    const m = new Mesh(geo, material)
    m.position.set(x, y, z)
    m.castShadow = cast
    m.receiveShadow = true
    g.add(m)
    return m
  }

  // Axis-aligned voxel box: `side` texture on the walls, `top` on top and
  // bottom, each face repeated so one voxel tile covers `cell` metres.
  const voxBox = ({ x, z, w, d, y0 = 0, y1, side, top = side, cell = 2, collide = true, cast = true }) => {
    const h = y1 - y0
    const mx = voxelMaterial(side, d / cell, h / cell)
    const mz = voxelMaterial(side, w / cell, h / cell)
    const my = voxelMaterial(top, w / cell, d / cell)
    const m = mesh(new BoxGeometry(w, h, d), [mx, mx, my, my, mz, mz], x, (y0 + y1) / 2, z, { cast })
    if (collide) addCollider(x, z, w, d, y1, 0, y0)
    return m
  }

  // Box by its x/z extents rather than centre and size.
  const voxSpan = (xa, xb, za, zb, opts) =>
    voxBox({ x: (xa + xb) / 2, z: (za + zb) / 2, w: Math.abs(xb - xa), d: Math.abs(zb - za), ...opts })

  return { g, std, mesh, voxBox, voxSpan, addCollider }
}

// Thick stone slab: dark slate body, light rim, beige top, with arrows and moss.
function buildSlab(k, x, z0, z1, w, chevrons = []) {
  const d = z0 - z1
  const z = (z0 + z1) / 2
  const slate = voxelTexture(COL.slateSide, { cells: 4, jitter: 0.1, grid: 0.25 })
  k.voxBox({ x, z, w, d, y1: TOP - 0.16, side: slate, cell: 1.4, collide: false })
  k.mesh(new BoxGeometry(w, 0.16, d), k.std(COL.slabRim, { roughness: 0.85 }), x, TOP - 0.08, z)
  const topTex = voxelTexture(COL.slabTop, { cells: 4, jitter: 0.03, grid: 0.05 })
  const inset = k.mesh(new PlaneGeometry(w - 0.5, d - 0.5), voxelMaterial(topTex, (w - 0.5) / 2, (d - 0.5) / 2), x, TOP + 0.003, z, { cast: false })
  inset.rotation.x = -Math.PI / 2
  k.addCollider(x, z, w, d, TOP)

  for (const [cx, cz, count = 2] of chevrons) {
    const arrow = k.mesh(
      new PlaneGeometry(2.6, 2.6),
      new MeshBasicMaterial({ map: chevronTexture(count), transparent: true, depthWrite: false }),
      cx, TOP + 0.01, cz, { cast: false },
    )
    arrow.rotation.x = -Math.PI / 2
  }
  // A few moss squares on the stone.
  const moss = k.std('#8fd14f', { roughness: 0.9 })
  for (let i = 0; i < 3; i++) {
    const s = between(0.5, 0.9)
    k.mesh(new BoxGeometry(s, 0.05, s), moss, x + between(-w / 2 + 0.8, w / 2 - 0.8), TOP + 0.02, between(z1 + 0.8, z0 - 0.8), { cast: false })
  }
}

// Brown dirt cliffs dropping to the lava, grass terraces on top, and a ragged
// voxel edge of ledges and grass lips along the canyon.
function buildCanyon(k) {
  const dirt = voxelTexture(COL.dirt, { cells: 4, jitter: 0.12, grid: 0.18 })
  const grass = voxelTexture(COL.grass, { cells: 4, jitter: 0.06, grid: 0.16 })
  const rock = voxelTexture(COL.plateau, { cells: 4, jitter: 0.08, grid: 0.2 })
  const rockTop = voxelTexture(COL.plateauTop, { cells: 4, jitter: 0.06, grid: 0.12 })
  const zNear = START_Z - 0.6 // tucked into the hub's north wall

  for (const s of [-1, 1]) {
    k.voxSpan(s * CANYON.halfW, s * TERRACE.x1, zNear, PLATEAU.endZ, { y1: TERRACE.top, side: dirt, top: grass, cell: 2 })
    k.voxSpan(s * TERRACE.x1, s * PLATEAU.x1, zNear, PLATEAU.endZ, { y1: PLATEAU.top, side: rock, top: rockTop, cell: 2.5 })

    // Ragged edge: dirt ledges stepping out into the canyon, grass lips on top.
    for (let z = zNear - 1; z > CANYON.endZ; z -= between(2.5, 5)) {
      const len = between(2, 4.5)
      const out = between(0.6, 1.4)
      const h = between(1.8, TERRACE.top - 1)
      if (rand() < 0.6) k.voxBox({ x: s * (CANYON.halfW - out / 2), z: z - len / 2, w: out, d: len, y1: h, side: dirt, top: grass, cell: 1 })
      if (rand() < 0.55) {
        k.voxBox({ x: s * (CANYON.halfW + 0.6), z: z - len / 2, w: 2.4, d: len, y0: TERRACE.top, y1: TERRACE.top + between(0.5, 1), side: grass, cell: 1, collide: false })
      }
    }
    // Steps up from the terrace to the dark plateau.
    for (let z = zNear - 3; z > PLATEAU.endZ + 10; z -= between(6, 12)) {
      const len = between(3, 7)
      k.voxBox({ x: s * (TERRACE.x1 - 1), z: z - len / 2, w: 2, d: len, y0: TERRACE.top, y1: TERRACE.top + between(0.8, 1.6), side: rock, top: grass, cell: 1, collide: false })
    }
  }
}

// Blocky tree: brown trunk, a root mound of dirt cubes, a canopy of green cubes.
function buildTree(k, x, z, y = TERRACE.top) {
  const trunkH = between(2.4, 4)
  const bark = k.std(pick(['#7a4a2a', '#6b3f24', '#85552f']))
  k.mesh(new BoxGeometry(0.9, trunkH, 0.9), bark, x, y + trunkH / 2, z)
  for (let i = 0; i < 3; i++) {
    const s = between(0.7, 1.4)
    k.mesh(new BoxGeometry(s, s * 0.7, s), k.std(pick(['#6b4226', '#8a5a34', '#5a3520'])), x + between(-1, 1), y + s * 0.35, z + between(-1, 1))
  }
  const greens = ['#6fcf2a', '#7ed321', '#5cb82a', '#8ee03a', '#4fa82a']
  const n = 4 + Math.floor(rand() * 4)
  for (let i = 0; i < n; i++) {
    const s = between(1.5, 2.8)
    k.mesh(new BoxGeometry(s, s * between(0.7, 1), s), k.std(pick(greens), { roughness: 0.85 }), x + between(-1.4, 1.4), y + trunkH + between(-0.3, 1.6), z + between(-1.4, 1.4))
  }
}

function buildTerraceProps(k) {
  for (const s of [-1, 1]) {
    for (let z = START_Z - 4; z > CANYON.endZ + 6; z -= between(6, 10)) {
      buildTree(k, s * between(CANYON.halfW + 3, TERRACE.x1 - 3), z)
    }
    // Small red blocks lying in the grass.
    const red = k.std('#e8312a', { roughness: 0.6 })
    for (let i = 0; i < 5; i++) {
      const m = k.mesh(new BoxGeometry(0.7, 0.45, 1.2), red, s * between(CANYON.halfW + 1.5, TERRACE.x1 - 1), TERRACE.top + 0.22, between(CANYON.endZ, START_Z - 3))
      m.rotation.y = rand() * Math.PI
    }
  }
}

// Dark cobblestone arch spanning the whole canyon, feet on the outer plateau.
function buildArch(k) {
  const tex = voxelTexture(COL.arch, { cells: 4, jitter: 0.14, grid: 0.32 })
  const yTop = (x) => ARCH.foot + ARCH.rise * (1 - (x / ARCH.span) ** 2)
  const N = 24
  for (let i = 0; i < N; i++) {
    const xa = -ARCH.span + (2 * ARCH.span * i) / N
    const xb = -ARCH.span + (2 * ARCH.span * (i + 1)) / N
    const ya = yTop(xa)
    const yb = yTop(xb)
    const len = Math.hypot(xb - xa, yb - ya) + 0.15
    const m = k.mesh(
      new BoxGeometry(len, ARCH.band, ARCH.depth),
      [voxelMaterial(tex, ARCH.depth / 1.4, ARCH.band / 1.4), voxelMaterial(tex, ARCH.depth / 1.4, ARCH.band / 1.4), voxelMaterial(tex, len / 1.4, ARCH.depth / 1.4), voxelMaterial(tex, len / 1.4, ARCH.depth / 1.4), voxelMaterial(tex, len / 1.4, ARCH.band / 1.4), voxelMaterial(tex, len / 1.4, ARCH.band / 1.4)],
      (xa + xb) / 2, (ya + yb) / 2 - ARCH.band / 2, ARCH.z,
    )
    m.rotation.z = Math.atan2(yb - ya, xb - xa)
  }
  // Grass tufts on the low ends of the arch.
  const greens = ['#7ed321', '#6fcf2a', '#8ee03a']
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const x = s * between(ARCH.span * 0.55, ARCH.span * 0.9)
      const sz = between(1, 2)
      k.mesh(new BoxGeometry(sz, sz * 0.8, sz), k.std(pick(greens)), x, yTop(x) + sz * 0.3, ARCH.z + between(-1.5, 1.5))
    }
  }
  return yTop(0)
}

// The finish, which doubles as Zone 3's entrance: the beige platform with
// grass-capped stone posts on the lake side, the yellow +1 Win pad (a trophy
// spinning over it) on the left and the x1 Hair ladder on the right.
function buildFinish(k) {
  buildSlab(k, 0, FINISH.z0, FINISH.z1, FINISH.w)
  const stone = k.std('#8d929b', { roughness: 0.85 })
  const grassTex = voxelTexture(COL.grass, { cells: 2, jitter: 0.06, grid: 0.16 })
  for (const s of [-1, 1]) {
    const x = s * (FINISH.w / 2 - 0.8)
    const z = FINISH.z1 + 0.8
    k.mesh(new BoxGeometry(0.8, 1.6, 0.8), stone, x, TOP + 0.8, z)
    k.voxBox({ x, z, w: 1.05, d: 1.05, y0: TOP + 1.6, y1: TOP + 2.1, side: grassTex, cell: 0.5, collide: false })
    k.addCollider(x, z, 0.8, 0.8, TOP + 2.1)
  }

  // +1 Win pad.
  k.mesh(new BoxGeometry(PAD.size + 0.3, 0.08, PAD.size + 0.3), k.std('#d9a400'), PAD.x, TOP + 0.04, finishZ, { cast: false })
  k.mesh(
    new BoxGeometry(PAD.size, 0.12, PAD.size),
    k.std('#ffe11a', { emissive: '#ffc400', emissiveIntensity: 0.45, roughness: 0.4 }),
    PAD.x, TOP + 0.06, finishZ, { cast: false },
  )
  const gold = k.std('#ffcf1f', { emissive: '#d99a00', emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.4 })
  const trophy = new Group()
  const part = (geo, y) => {
    const m = new Mesh(geo, gold)
    m.position.y = y
    m.castShadow = true
    trophy.add(m)
  }
  part(new BoxGeometry(0.55, 0.16, 0.55), 0)
  part(new CylinderGeometry(0.07, 0.1, 0.3, 10), 0.23)
  part(new CylinderGeometry(0.38, 0.16, 0.5, 16), 0.63)
  part(new BoxGeometry(0.95, 0.08, 0.08), 0.68) // handles
  trophy.position.set(PAD.x, TOP + 1.4, finishZ)
  k.g.add(trophy)

  // x1 Hair ladder: a grassy base with a grey ladder leaning back on it.
  k.mesh(new BoxGeometry(1.8, 0.2, 1.4), k.std(COL.grass, { roughness: 0.85 }), LADDER_X, TOP + 0.1, finishZ)
  k.addCollider(LADDER_X, finishZ, 1.8, 1.4, TOP + 0.2)
  const ladder = new Group()
  const rail = k.std('#c9ccd2')
  const rung = k.std('#9aa0aa')
  for (const s of [-1, 1]) {
    const m = new Mesh(new BoxGeometry(0.14, 2.4, 0.14), rail)
    m.position.set(s * 0.45, 1.2, 0)
    m.castShadow = true
    ladder.add(m)
  }
  for (let i = 0; i < 5; i++) {
    const m = new Mesh(new BoxGeometry(0.9, 0.1, 0.1), rung)
    m.position.y = 0.3 + i * 0.45
    ladder.add(m)
  }
  ladder.position.set(LADDER_X, TOP + 0.2, finishZ + 0.3)
  ladder.rotation.x = -0.25
  k.g.add(ladder)
  return trophy
}

export function buildLavaPath(scene, addCollider) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)

  const tex = lavaTexture()
  const lavaW = CANYON.halfW * 2
  const lavaD = START_Z - CANYON.endZ
  tex.repeat.set(lavaW / 5, lavaD / 5)
  const lavaMat = new MeshBasicMaterial({ map: tex, toneMapped: false })
  const lava = k.mesh(new PlaneGeometry(lavaW, lavaD), lavaMat, 0, LAVA_Y, (START_Z + CANYON.endZ) / 2, { cast: false })
  lava.rotation.x = -Math.PI / 2

  buildCanyon(k)
  buildTerraceProps(k)

  // Steps out of the doorway up onto the first slab (each within PHYSICS.stepUp).
  const s0 = SLABS[0]
  const stepTex = voxelTexture(COL.slateSide, { cells: 4, jitter: 0.1, grid: 0.25 })
  const stepTop = voxelTexture(COL.slabTop, { cells: 4, jitter: 0.03, grid: 0.05 })
  // The Hub's blue steps top out at 0.3 m; these carry on in even risers up to the slab.
  for (let i = 0; i < STAIR.count; i++) {
    const za = START_Z + 0.6 - i * STAIR.run
    k.voxSpan(-s0.w / 2, s0.w / 2, za, za - STAIR.run, { y1: STAIR.from + (i + 1) * STAIR.rise, side: stepTex, top: stepTop, cell: 1 })
  }
  for (const s of SLABS) buildSlab(k, 0, s === s0 ? STAIR_END_Z : s.z0, s.z1, s.w, s.chevrons)

  const archTop = buildArch(k)
  const trophy = buildFinish(k)

  label(g, [
    { text: ZONE_NAME, size: 1, fill: ['#fff27a', '#ff7a00'], stroke: '#4a1200' },
    { text: 'Stay on the path!', size: 0.4, fill: '#ffffff' },
  ], [0, archTop + 2.4, ARCH.z], { unit: 1.6 })
  label(g, [{ text: '+1 Win', size: 0.7, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }], [PAD.x, TOP + 0.75, finishZ + 1.3], { unit: 0.9 })
  label(g, [{ text: '🏆 +3 Wins', size: 0.6, fill: ['#d6fbff', '#5fd8ff'], stroke: '#0a3a5a' }], [PAD.x, TOP + 2.75, finishZ], { unit: 0.9 })
  label(g, [{ text: 'x1 Hair', size: 0.6, fill: ['#d6fbff', '#5fd8ff'], stroke: '#0a3a5a' }], [LADDER_X, TOP + 3.1, finishZ], { unit: 0.9 })

  let won = false
  return {
    // True from just out of the doorway to the finish platform's far edge.
    contains: (p) => p.z < START_Z - 1 && p.z > PLATEAU.endZ && Math.abs(p.x) < TERRACE.x1,
    // Returns 'fell' or 'finish' when the player triggers one.
    update(dt, time, p) {
      tex.offset.y = time * 0.012
      lavaMat.color.setScalar(0.92 + 0.08 * Math.sin(time * 1.7))
      trophy.rotation.y = time * 1.5
      trophy.position.y = TOP + 1.4 + Math.sin(time * 2) * 0.1
      const inCanyon = Math.abs(p.x) < CANYON.halfW && p.z < START_Z - 0.5 && p.z > CANYON.endZ
      if (inCanyon && p.y < LAVA_Y + 0.1) return 'fell'
      const onPad = Math.abs(p.x - PAD.x) < PAD.size / 2 && Math.abs(p.z - finishZ) < PAD.size / 2
      if (!won && onPad && p.y >= TOP - 0.05) {
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

// Shared with Zones 3 and 4, which are built the same way.
export { buildTree, kit, lavaTexture, voxelTexture }
