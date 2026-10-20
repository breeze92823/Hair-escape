// Zone 4: DESERT CANYON. Past the Ice Lake goal platform (which doubles as this
// zone's entrance) a basin of wavy quicksand runs north between stepped
// terracotta sandstone cliffs dotted with cacti. Hop the sand slab and the
// banded island pillar to a bridge through the diamond gate (a bonus ring hangs
// in the gap), climb a blue panel up one of the two courtyard pillars, cross the
// red-lava pit on stepping blocks and reach the win pad on the pink platform,
// where Zone 5's pink walkway leads on to the purple palace. Falling into the
// sand or the lava puts you back on the entrance. Procedural like Zones 2 and 3 (voxel canvas textures,
// boxes); the cacti are instanced.
//
// Built at S x the scale of the other zones, measured against the 1.8 m player
// in the reference shots (the island pillar is ~7.5 player heights across).
// Walkable heights and gaps are NOT scaled: they stay within a jump (~1.28 m up,
// ~6.8 m across) and the climbing panels carry the extra height.
import {
  BoxGeometry, CanvasTexture, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D,
  PlaneGeometry, RepeatWrapping, SRGBColorSpace, TorusGeometry,
} from 'three'
import { kit, lavaTexture, voxelTexture } from './lavaPath.js'
import { ZONE3_GOAL } from './zone3.js'
import { label } from './lobby/labels.js'
import { makeCanvas } from './lobby/paint.js'
import { paidPad, winPad } from './zoneProps.js'

export const ZONE4_NAME = 'DESERT CANYON'
export const ZONE4_WIN = 10 // wins for the pad on the pink platform (advertised on the Ice Lake trophy)
export const ZONE4_BONUS = 1 // wins for walking through the ring in the diamond gate
// Where a fall puts you: on the entrance, clear of the win pad.
export const ZONE4_SPAWN = { x: 1, y: ZONE3_GOAL.top + 0.1, z: ZONE3_GOAL.z0 - 1.5 }

const S = 2 // zone scale relative to the player-sized Zones 1-3
const CACTUS_S = 1.4 // cacti measure ~1.9 player heights in the references
const SAND_Y = 0.08 // the quicksand surface
const Z0 = ZONE3_GOAL.z1 // the entrance edge
const FAR_Z = -375 // north edge of everything (runs on behind Zone 5's palace)

// The two climbing pillars: x is each centre's |x|; the blue panel runs from panelY0 to the top.
const PILLAR = { x: 4 * S, z0: -211, z1: -217.4, w: 3.2 * S, top: 24.8, base: 3.4, panelY0: 3.5, panelW: 2 * S }
const BASIN = { halfW: 16 * S, z0: Z0, z1: PILLAR.z1 } // quicksand from the entrance to the pit wall
const GATE = { z0: -191, z1: -203, gap: 2.6 * S, top: 12 * S } // the two diamond walls and the gap between them
const WING = { x0: 10 * S, x1: 24 * S, top: 16 * S } // tall walls enclosing the courtyard and the pit
const PIT = { halfW: WING.x0, z0: PILLAR.z1, z1: -259.2, floor: 21 } // the red-lava pit on the upper level
const FINISH = { z0: -242.4, z1: PIT.z1, w: 14 * S, top: 26.3 } // the pink platform
const WING_CAP = { x0: 11 * S, x1: 16 * S, z0: PIT.z1 + 4 * S } // purple blocks topping the wings beside Zone 5's palace

// The jump path, south to north: [x, z, w, d, top]. Gaps 1.6-3 m, rises <= 0.8 m.
const ENTRY_SLAB = [-8, -162.5, 10, 7, 1.6]
const ISLAND = [-2, -174, 10, 10, 2.4]
const STONE = [0, -185, 6, 6, 3]
const BRIDGE = { w: 4.8 * S, top: 3 } // through the gate gap
const PILLAR_STONE = { z: -207.6, w: 4.4, d: 6, top: 2.6 } // one in front of each pillar, its far edge 0.4 m from the panel
const STEPS = [[-224.4, 25.3], [-235.4, 25.8]] // [z, top] blocks across the pit, 10 x 8 m
const RIGHT_TERRACE = { x0: 14, x1: BASIN.halfW, z0: -163, z1: GATE.z0, top: 6.8 }
const RING = { z: (GATE.z0 + GATE.z1) / 2, y: BRIDGE.top + 2.8, radius: 1.3 * S }
// Zone 5 carries on north from the finish platform, beside the pit's lava.
export const ZONE4_FINISH = FINISH
export const PALACE_Z = -273 // Zone 5's palace front
export const ZONE4_PIT = PIT
const PADS = { yellow: -2.5 * S, blue: 2.5 * S, z: -251 }

// Stepped sandstone terraces either side, rising in three bands toward the
// fortress: [x0, x1, tops per band, south edge]. The innermost stops at the
// wings, the rest run behind them.
const BANDS = [Z0, -183, -209] // south edge of each band
const TERRACES = [
  { x0: BASIN.halfW, x1: WING.x1, tops: [10, 13, 16], z0: Z0, z1: GATE.z1, cast: true },
  { x0: WING.x1, x1: 68, tops: [18, 22, 26], z0: -159, z1: FAR_Z },
  { x0: 68, x1: 100, tops: [28, 34, 40], z0: -159, z1: FAR_Z },
  { x0: 100, x1: 160, tops: [22, 24, 26], z0: -159, z1: FAR_Z },
]

const COL = {
  sand: '#e2873b',
  sandLight: '#f3b866',
  sandDark: '#c26626',
  sandDeep: '#8f3a1c',
  purple: '#2c0f50',
  purpleMid: '#4a1a82',
  magenta: '#d63fc4',
  pink: '#ff9ad6',
  blue: '#2f8fe0',
  pale: '#f6e2b8',
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
const rand = mulberry32(4044)
const between = (a, b) => a + rand() * (b - a)

// --- Textures ---------------------------------------------------------------
const tex = {}
function textures() {
  tex.sand = voxelTexture(COL.sand, { cells: 4, jitter: 0.07, grid: 0.2 })
  tex.sandLight = voxelTexture(COL.sandLight, { cells: 4, jitter: 0.05, grid: 0.14 })
  tex.sandDark = voxelTexture(COL.sandDark, { cells: 4, jitter: 0.08, grid: 0.22 })
  tex.sandDeep = voxelTexture(COL.sandDeep, { cells: 4, jitter: 0.08, grid: 0.24 })
  tex.purple = voxelTexture(COL.purple, { cells: 4, jitter: 0.1, grid: 0.3 })
  tex.purpleMid = voxelTexture(COL.purpleMid, { cells: 4, jitter: 0.08, grid: 0.25 })
  tex.pink = voxelTexture(COL.pink, { cells: 4, jitter: 0.04, grid: 0.1 })
  tex.pale = voxelTexture(COL.pale, { cells: 4, jitter: 0.04, grid: 0.1 })
}

// Quicksand: bright orange with rows of light and dark sine ripples. Seamless.
function quicksandTexture() {
  const T = 256
  const c = makeCanvas(T)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#f5a524'
  ctx.fillRect(0, 0, T, T)
  ctx.lineCap = 'round'
  const rows = 16
  for (let i = 0; i < rows; i++) {
    const y0 = (i * T) / rows
    const light = i % 2 === 0
    ctx.strokeStyle = light ? '#ffd24f' : '#e5841a'
    ctx.lineWidth = light ? 5 : 3
    ctx.beginPath()
    for (let x = 0; x <= T; x += 4) {
      const y = y0 + Math.sin((x / T) * Math.PI * 4 + i * 0.9) * 4
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

// A chunky arrow pointing up the canvas, outlined in dark brown.
const arrowCache = new Map()
export function arrowTexture(color) {
  if (arrowCache.has(color)) return arrowCache.get(color)
  const T = 64
  const c = makeCanvas(T)
  const ctx = c.getContext('2d')
  ctx.beginPath()
  ctx.moveTo(32, 4)
  ctx.lineTo(60, 32)
  ctx.lineTo(42, 32)
  ctx.lineTo(42, 60)
  ctx.lineTo(22, 60)
  ctx.lineTo(22, 32)
  ctx.lineTo(4, 32)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(60,20,0,0.6)'
  ctx.stroke()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  arrowCache.set(color, t)
  return t
}

// --- Shared props -----------------------------------------------------------------
// Cacti are collected here and drawn as two instanced meshes (green parts, red flowers).
const cactusBoxes = []
const flowerBoxes = []
function cactus(x, y, z, h = between(1.6, 3.2)) {
  const c = CACTUS_S
  h *= c
  const side = rand() < 0.5 ? -1 : 1
  const arm = between(0.6, 1.1) * c
  cactusBoxes.push([x, y + h / 2, z, 0.6 * c, h, 0.6 * c])
  cactusBoxes.push([x + side * 0.55 * c, y + h * 0.55 + arm / 2, z, 0.4 * c, arm, 0.4 * c])
  cactusBoxes.push([x + side * 0.35 * c, y + h * 0.55, z, 0.4 * c, 0.35 * c, 0.4 * c])
  if (rand() < 0.35) flowerBoxes.push([x, y + h + 0.12 * c, z, 0.45 * c, 0.25 * c, 0.45 * c])
}
function buildInstances(k, list, material) {
  if (!list.length) return
  const m = new InstancedMesh(new BoxGeometry(1, 1, 1), material, list.length)
  const o = new Object3D()
  list.forEach(([x, y, z, sx, sy, sz], i) => {
    o.position.set(x, y, z)
    o.scale.set(sx, sy, sz)
    o.updateMatrix()
    m.setMatrixAt(i, o.matrix)
  })
  m.castShadow = true
  m.receiveShadow = true
  k.g.add(m)
}

// A flat decal (arrow, strip) just in front of a south-facing wall at z.
export function decal(k, map, x, y, z, w, h, rotZ = 0) {
  const m = k.mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map, transparent: true, depthWrite: false }), x, y, z + 0.03, { cast: false })
  m.rotation.z = rotZ
  m.receiveShadow = false
  return m
}

// Gold diamond with a teal centre on a south-facing wall at z.
let diamondMats = null
function diamond(k, x, y, z, s) {
  if (!diamondMats) {
    diamondMats = {
      gold: k.std('#ffcf1f', { emissive: '#d99a00', emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.3 }),
      teal: k.std('#2fa8d8', { emissive: '#1a78b0', emissiveIntensity: 0.3, roughness: 0.4 }),
    }
  }
  const g = k.mesh(new BoxGeometry(s, s, 0.4), diamondMats.gold, x, y, z + 0.15, { cast: false })
  g.rotation.z = Math.PI / 4
  const c = k.mesh(new BoxGeometry(s * 0.45, s * 0.45, 0.4), diamondMats.teal, x, y, z + 0.3, { cast: false })
  c.rotation.z = Math.PI / 4
}

// Dark strata band across a south-facing wall from xa to xb at height y.
const strata = (k, xa, xb, z, y) => k.voxSpan(xa, xb, z + 0.5, z - 0.5, { y0: y, y1: y + 0.5 * S, side: tex.sandDeep, cell: 1, collide: false, cast: false })

// --- The canyon: quicksand, stepped cliffs, cacti, mesas --------------------------
function terraceTopAt(t, z) {
  const tops = TERRACES[t].tops
  if (z > BANDS[1]) return tops[0]
  if (z > BANDS[2]) return tops[1]
  return tops[2]
}

function buildCanyon(k) {
  const qt = quicksandTexture()
  const w = BASIN.halfW * 2
  const d = BASIN.z0 - BASIN.z1
  qt.repeat.set(w / 8, d / 8)
  const sand = k.mesh(new PlaneGeometry(w, d), new MeshBasicMaterial({ map: qt, toneMapped: false }), 0, SAND_Y, (BASIN.z0 + BASIN.z1) / 2, { cast: false })
  sand.rotation.x = -Math.PI / 2

  for (const s of [-1, 1]) {
    const farZ = s > 0 ? PIT.z1 : FAR_Z // the east side stops at the finish platform: open sky past Zone 5's plateau
    for (const t of TERRACES) {
      for (let i = 0; i < BANDS.length; i++) {
        const za = i === 0 ? t.z0 : BANDS[i]
        const zb = i === BANDS.length - 1 ? Math.max(t.z1, farZ) : BANDS[i + 1]
        const top = t.tops[i]
        k.voxSpan(s * t.x0, s * t.x1, za, zb, { y1: top, side: tex.sand, top: tex.sandLight, cell: 2.5, cast: !!t.cast })
        if (t.x0 > 68) continue
        // Dark strata band and a light overhanging lip along the canyon-facing edge.
        k.voxSpan(s * (t.x0 - 0.5), s * (t.x0 + 0.5), za, zb, { y0: top - 1.7 * S, y1: top - 1.1 * S, side: tex.sandDeep, cell: 1, collide: false, cast: false })
        k.voxSpan(s * (t.x0 - 0.45 * S), s * (t.x0 + 1.6 * S), za, zb, { y0: top - 0.35 * S, y1: top + 0.3 * S, side: tex.sandLight, cell: 1, collide: false, cast: false })
      }
    }

    // Ragged edge on the left (the right has its big terrace): pillars stepping into the sand.
    if (s < 0) {
      for (let z = BASIN.z0 - 3; z > GATE.z0 + 4; z -= between(3, 6) * S) {
        const len = between(2, 4) * S
        const out = between(0.8, 1.6) * S
        if (rand() < 0.7) k.voxBox({ x: s * (BASIN.halfW - out / 2), z: z - len / 2, w: out, d: len, y1: between(2, 4.5) * S, side: rand() < 0.5 ? tex.sand : tex.sandDark, top: tex.sandLight, cell: 1 })
      }
    }
    // Cacti and boulders on the first two terraces, tall mesas on the third.
    for (let i = 0; i < 7; i++) {
      const z = between(BANDS[0] - 3, GATE.z1 + 2)
      cactus(s * between(BASIN.halfW + 4, WING.x1 - 2), terraceTopAt(0, z), z)
    }
    for (let i = 0; i < 6; i++) {
      const z = between(-162, farZ + 6)
      cactus(s * between(WING.x1 + 2, 66), terraceTopAt(1, z), z)
    }
    for (let i = 0; i < 4; i++) {
      const z = between(-162, farZ + 6)
      const b = between(1.2, 2.6) * S
      const y = terraceTopAt(1, z)
      k.voxBox({ x: s * between(WING.x1 + 3, 64), z, w: b, d: b, y0: y, y1: y + b * 0.7, side: tex.sandLight, cell: 1, collide: false, cast: false })
    }
    for (let i = 0; i < 3; i++) {
      const z = between(-170, farZ + 12)
      const base = terraceTopAt(2, z)
      const mw = between(5, 9) * S
      const x = s * between(76, 92)
      k.voxBox({ x, z, w: mw, d: mw, y0: base, y1: base + between(4, 7) * S, side: tex.sandDark, top: tex.sandLight, cell: 2.5, collide: false, cast: false })
      k.voxBox({ x, z, w: mw * 0.6, d: mw * 0.6, y0: base, y1: base + between(8, 12) * S, side: tex.sand, top: tex.sandLight, cell: 2.5, collide: false, cast: false })
    }
  }
}

// --- The basin: entry slab, island pillar, right terrace, stone -------------------
function buildBasin(k) {
  // A sand block: dark base, mid band, light top.
  const block = (x, z, w, d, top, base = tex.sandDark) => {
    k.voxBox({ x, z, w, d, y1: top - 0.6, side: base, cell: 1.2, collide: false })
    k.voxBox({ x, z, w, d, y0: top - 0.6, y1: top, side: tex.sand, top: tex.sandLight, cell: 1.2, collide: false })
    k.addCollider(x, z, w, d, top)
  }
  block(...ENTRY_SLAB)
  block(...STONE)

  // The island pillar: dark red foot, banded sandstone body, light cap, a cactus and a crate.
  const [ix, iz, iw, id, itop] = ISLAND
  const lip = 0.3 * S
  k.voxBox({ x: ix, z: iz, w: iw, d: id, y1: 0.9, side: tex.sandDeep, cell: 1.2, collide: false })
  k.voxBox({ x: ix, z: iz, w: iw - lip, d: id - lip, y0: 0.9, y1: itop - 0.7, side: tex.sandDark, cell: 1.2, collide: false })
  k.voxBox({ x: ix, z: iz, w: iw + lip, d: id + lip, y0: itop - 0.7, y1: itop, side: tex.sand, top: tex.sandLight, cell: 1.2, collide: false })
  k.addCollider(ix, iz, iw + lip, id + lip, itop)
  cactus(ix + 3, itop, iz - 2.6, 1.8)
  k.mesh(new BoxGeometry(0.7 * S, 0.5 * S, 0.7 * S), k.std('#6b3f1f'), ix - 2, itop + 0.25 * S, iz + 2)
  k.voxBox({ x: ix - iw / 2 + 1.2, z: iz + id / 2 - 2, w: 2.4, d: 4, y0: itop - 1.2, y1: itop + 0.3, side: tex.sandLight, cell: 1, collide: false })

  // The big right terrace, banded, with a pale column and cacti.
  const rt = RIGHT_TERRACE
  k.voxSpan(rt.x0, rt.x1, rt.z0, rt.z1, { y1: rt.top, side: tex.sand, top: tex.sandLight, cell: 2 })
  k.voxSpan(rt.x0 - lip, rt.x1, rt.z0 + lip, rt.z1, { y0: rt.top - lip, y1: rt.top + 0.25 * S, side: tex.sandLight, cell: 1, collide: false, cast: false })
  k.voxSpan(rt.x0 - 0.4, rt.x0 + 0.4, rt.z0, rt.z1, { y0: 1.2 * S, y1: 1.7 * S, side: tex.sandDeep, cell: 1, collide: false, cast: false })
  strata(k, rt.x0, rt.x1, rt.z0, 1.2 * S)
  const cx = 25
  const cz = -179
  k.voxBox({ x: cx, z: cz, w: 1.8 * S, d: 1.8 * S, y0: rt.top, y1: rt.top + 0.5 * S, side: tex.pale, cell: 1 })
  k.voxBox({ x: cx, z: cz, w: 1 * S, d: 1 * S, y0: rt.top + 0.5 * S, y1: rt.top + 4 * S, side: tex.pale, cell: 1 })
  k.voxBox({ x: cx, z: cz, w: 1.8 * S, d: 1.8 * S, y0: rt.top + 4 * S, y1: rt.top + 4.5 * S, side: tex.pale, cell: 1, collide: false })
  cactus(19, rt.top, -168, 2.8)
  cactus(29, rt.top, -188)
}

// --- The diamond gate: two tall walls, a bridge through the gap, the bonus ring --------
function buildGate(k) {
  const white = k.std('#ffffff', { roughness: 0.6 })
  const red = k.std('#e8312a', { roughness: 0.6 })
  for (const s of [-1, 1]) {
    k.voxSpan(s * GATE.gap, s * BASIN.halfW, GATE.z0, GATE.z1, { y1: GATE.top, side: tex.sand, top: tex.sandLight, cell: 2.5 })
    k.voxSpan(s * (GATE.gap - 0.3 * S), s * (BASIN.halfW + 0.3 * S), GATE.z0 + 0.3 * S, GATE.z1, { y0: GATE.top - 0.3 * S, y1: GATE.top + 0.3 * S, side: tex.sandLight, cell: 1, collide: false, cast: false })
    strata(k, s * GATE.gap, s * BASIN.halfW, GATE.z0, 3.6 * S)
    strata(k, s * GATE.gap, s * BASIN.halfW, GATE.z0, 9.4 * S)
    diamond(k, s * 9 * S, 6.8 * S, GATE.z0, 2.4 * S)
    // Red-and-white strip down the inner front corner.
    const sx = s * (GATE.gap + 0.2 * S)
    const stripH = GATE.top - 0.4 * S
    k.mesh(new BoxGeometry(0.4 * S, stripH, 0.4 * S), white, sx, stripH / 2, GATE.z0 + 0.1 * S, { cast: false })
    k.mesh(new BoxGeometry(0.45 * S, 1.2 * S, 0.45 * S), red, sx, GATE.top - 2 * S, GATE.z0 + 0.1 * S, { cast: false })
    cactus(s * 12 * S, GATE.top + 0.3 * S, GATE.z1 + 3, 3)
  }
  k.voxSpan(-BRIDGE.w / 2, BRIDGE.w / 2, GATE.z0, GATE.z1, { y1: BRIDGE.top, side: tex.sandDark, top: tex.sandLight, cell: 1.2 })

  const ring = new Mesh(new TorusGeometry(RING.radius, 0.14 * S, 10, 40), k.std('#ffd21a', { emissive: '#ffb000', emissiveIntensity: 0.6, roughness: 0.3 }))
  ring.position.set(0, RING.y, RING.z)
  ring.castShadow = true
  k.g.add(ring)
  return ring
}

// --- The courtyard: two pillars with blue climbing panels --------------------------
function buildCourtyard(k) {
  const panelMat = k.std(COL.blue, { emissive: '#1a5fb0', emissiveIntensity: 0.3, roughness: 0.4 })
  const pz = (PILLAR.z0 + PILLAR.z1) / 2
  const pd = PILLAR.z0 - PILLAR.z1
  const panelH = PILLAR.top - PILLAR.panelY0
  for (const s of [-1, 1]) {
    const x = s * PILLAR.x
    k.voxBox({ x, z: pz, w: PILLAR.w, d: pd, y1: PILLAR.base, side: tex.sandDeep, cell: 1.2, collide: false })
    k.voxBox({ x, z: pz, w: PILLAR.w, d: pd, y0: PILLAR.base, y1: PILLAR.top, side: tex.sand, top: tex.sandLight, cell: 1.2, collide: false })
    k.addCollider(x, pz, PILLAR.w, pd, PILLAR.top)
    k.mesh(new BoxGeometry(PILLAR.panelW, panelH, 0.15), panelMat, x, PILLAR.panelY0 + panelH / 2, PILLAR.z0 + 0.06, { cast: false })
    decal(k, arrowTexture('#ffd21a'), x, PILLAR.panelY0 - 0.5, PILLAR.z0, 0.9, 0.9)
    decal(k, arrowTexture('#e8312a'), x + s * 1.2 * S, PILLAR.top - 0.8 * S, PILLAR.z0, 0.6 * S, 0.6 * S, Math.PI)
    // A stone in front to step off onto the panel.
    const st = PILLAR_STONE
    k.voxBox({ x, z: st.z, w: st.w, d: st.d, y1: st.top, side: tex.sandDark, top: tex.sandLight, cell: 1 })
  }
}

// --- The upper level: red-lava pit, stepping blocks, the pink finish ---------------
function buildUpper(k) {
  k.voxSpan(-PIT.halfW, PIT.halfW, PIT.z0, PIT.z1, { y1: PIT.floor, side: tex.sandDeep, top: tex.sandDeep, cell: 2, cast: false })
  const lt = lavaTexture().clone()
  const w = PIT.halfW * 2
  const d = PIT.z0 - PIT.z1
  lt.repeat.set(w / 5, d / 5)
  const lava = k.mesh(new PlaneGeometry(w, d), new MeshBasicMaterial({ map: lt, toneMapped: false }), 0, PIT.floor + 0.03, (PIT.z0 + PIT.z1) / 2, { cast: false })
  lava.rotation.x = -Math.PI / 2
  // Dark rim along the pit's south edge.
  k.voxSpan(-PIT.halfW, PIT.halfW, PIT.z0, PIT.z0 - 0.5 * S, { y0: PIT.floor, y1: PIT.floor + 0.4 * S, side: tex.sandDeep, cell: 1, collide: false, cast: false })

  for (const [z, top] of STEPS) {
    k.voxBox({ x: 0, z, w: 5 * S, d: 4 * S, y1: top - 0.6, side: tex.sandDark, cell: 1.2, collide: false, cast: false })
    k.voxBox({ x: 0, z, w: 5 * S, d: 4 * S, y0: top - 0.6, y1: top, side: tex.sand, top: tex.sandLight, cell: 1.2, collide: false })
    k.addCollider(0, z, 5 * S, 4 * S, top)
  }

  // Pink platform with the yellow win pad and a blue pad.
  const fz = (FINISH.z0 + FINISH.z1) / 2
  const fd = FINISH.z0 - FINISH.z1
  k.voxBox({ x: 0, z: fz, w: FINISH.w, d: fd, y1: FINISH.top - 1, side: tex.sand, cell: 1.5, collide: false, cast: false })
  k.voxBox({ x: 0, z: fz, w: FINISH.w, d: fd, y0: FINISH.top - 1, y1: FINISH.top, side: tex.pink, cell: 1, collide: false })
  k.addCollider(0, fz, FINISH.w, fd, FINISH.top)
  paidPad(k, PADS.blue, PADS.z, FINISH.top, '+20 Wins')
  cactus(-FINISH.w / 2 + 1.6, FINISH.top, FINISH.z0 - 1.6, 2.2)
  return winPad(k, PADS.yellow, PADS.z, FINISH.top, ZONE4_WIN)
}

// --- The backdrop: wings, purple wing caps, sandstone towers -----------------------
function buildBackdrop(k) {
  // Wings enclosing the courtyard and the pit.
  for (const s of [-1, 1]) {
    const end = s > 0 ? PIT.z1 : FAR_Z // the east wing stops at the finish platform: Zone 5's plateau is open to the sky
    k.voxSpan(s * WING.x0, s * WING.x1, GATE.z1, end, { y1: WING.top, side: tex.sand, top: tex.sandLight, cell: 3, cast: false })
    k.voxSpan(s * (WING.x0 - 0.4 * S), s * (WING.x0 + 1.4 * S), GATE.z1, end, { y0: WING.top - 0.4 * S, y1: WING.top + 0.4 * S, side: tex.sandLight, cell: 1, collide: false, cast: false })
    k.voxSpan(s * (WING.x0 - 0.5), s * (WING.x0 + 0.5), GATE.z1, end, { y0: 5.5 * S, y1: 6 * S, side: tex.sandDeep, cell: 1, collide: false, cast: false })
    cactus(s * 13 * S, WING.top + 0.4 * S, -225)
  }

  // Purple blocks topping the wings beside Zone 5's palace, pink caps.
  for (const s of [-1, 1]) {
    k.voxSpan(s * WING_CAP.x0, s * WING_CAP.x1, WING_CAP.z0, s > 0 ? PIT.z1 : FAR_Z, { y0: WING.top, y1: WING.top + 7 * S, side: tex.purple, top: tex.pink, cell: 2, collide: false, cast: false })
  }

  // Sandstone towers on the wings, and a tall pale obelisk on the right.
  const tower = (x, z, w, y0, y1, side = tex.sand, end = FAR_Z) => k.voxBox({ x, z: (z + end) / 2, w, d: z - end, y0, y1, side, top: tex.sandLight, cell: 3, collide: false, cast: false })
  tower(-19.5 * S, -211, 7 * S, WING.top, WING.top + 10 * S, tex.sandDark)
  tower(-19.5 * S, -219, 4.5 * S, WING.top + 10 * S, WING.top + 14 * S)
  tower(19.5 * S, -241, 7 * S, WING.top, WING.top + 8 * S, tex.sand, PIT.z1) // stops with the east wing
  const ox = 18 * S
  const oz = -223
  k.voxBox({ x: ox, z: oz, w: 3.4 * S, d: 3.4 * S, y0: WING.top, y1: WING.top + 1.2 * S, side: tex.pale, cell: 1, collide: false, cast: false })
  k.voxBox({ x: ox, z: oz, w: 2.2 * S, d: 2.2 * S, y0: WING.top + 1.2 * S, y1: WING.top + 18 * S, side: tex.pale, cell: 1.5, collide: false, cast: false })
  k.voxBox({ x: ox, z: oz, w: 3 * S, d: 3 * S, y0: WING.top + 18 * S, y1: WING.top + 19 * S, side: tex.pale, cell: 1, collide: false, cast: false })
}

export function buildZone4(scene, addCollider) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)
  textures()

  buildCanyon(k)
  buildBasin(k)
  const ring = buildGate(k)
  buildCourtyard(k)
  const pad = buildUpper(k)
  buildBackdrop(k)
  buildInstances(k, cactusBoxes, k.std('#4fa82a', { roughness: 0.85 }))
  buildInstances(k, flowerBoxes, k.std('#ff4a6a', { roughness: 0.6 }))

  label(g, [
    { text: 'RECOMMENDED', size: 0.45, fill: ['#ffb36b', '#ff5a1a'], stroke: '#4a1200' },
    { text: 'LEVEL 46', size: 1, fill: ['#fff4dc', '#ffd8a0'], stroke: '#4a2200' },
  ], [ENTRY_SLAB[0], ENTRY_SLAB[4] + 4.5, ENTRY_SLAB[1]], { unit: 2.2 })
  label(g, [{ text: `🏆 +${ZONE4_BONUS} Win`, size: 0.5, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }], [0, RING.y, RING.z], { unit: 1.2 })

  const pz = (PILLAR.z0 + PILLAR.z1) / 2
  let bonus = false
  let won = false
  return {
    // From the entrance (the Ice Lake goal) north.
    contains: (p) => p.z < Z0 && p.z > FAR_Z && Math.abs(p.x) < TERRACES[2].x1,
    // True while the player is pressed against a blue climbing panel (main.js lifts them).
    climbAt(p) {
      if (p.z > PILLAR.z0 + 0.75 || p.z < pz || p.y > PILLAR.top || p.y < PILLAR.panelY0 - 2) return false
      return Math.abs(Math.abs(p.x) - PILLAR.x) < PILLAR.panelW / 2 + 0.3
    },
    // Returns 'fell' (quicksand), 'burned' (lava pit), 'bonus' or 'finish' when the player triggers one.
    update(dt, time, p) {
      ring.position.y = RING.y + Math.sin(time * 2) * 0.15
      ring.rotation.y = Math.sin(time * 0.8) * 0.3
      pad.update(time)
      const inBasin = Math.abs(p.x) < BASIN.halfW && p.z < BASIN.z0 && p.z > BASIN.z1
      if (inBasin && p.y < SAND_Y + 0.1) return 'fell'
      const inPit = Math.abs(p.x) < PIT.halfW && p.z < PIT.z0 && p.z > PIT.z1
      if (inPit && p.y < PIT.floor + 0.15) return 'burned'
      if (!bonus && Math.abs(p.z - RING.z) < 0.8 && Math.hypot(p.x, p.y + 0.9 - RING.y) < RING.radius) {
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
