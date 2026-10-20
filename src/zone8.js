// Zone 8: VIOLET TOWER. Zone 7's last yellow platform steps onto a pale start
// platform (cyan lanterns on its back corners) at the foot of a tall, open-roofed
// purple tower under the "RECOMMENDED / LEVEL 64" sign. Three cross walls climb
// it: each has a dark recessed band (almost to the beams) over a ledge, a deep
// teal-framed opening in the band with a teal arrow pointing down at it and a
// cyan-framed window beside it, and a teal-framed blue hex climbing panel under
// the opening (hold any move key against it, like Zones 4 and 6). A +1 Win ring
// stands on the first ledge west of the opening. Between the walls: a landing
// inside each opening, a pale platform across the pit and a foot ledge under the
// next panel with big cyan mushroom lanterns on its front corners. The dark
// indigo side walls carry violet pilaster strips, teal-slatted windows and big
// teal-framed panels with yellow up arrows; purple beams cross the top. The last opening leads onto the final
// platform: the yellow pad (the zone's wins, then home) with a big gold trophy,
// a cyan "+200 Wins" pad (decoration) and an x2 Hair treadmill, and past it the
// next zone's mine deck in a crystal cave: wooden frames, a rail track, barrels,
// crates, crystal pillars and the "LEVEL 71" sign. Falling into the pit puts you
// back on the start platform. Procedural like Zones 2-7.
//
// Built at the same scale as Zone 7 (1.8 m player): gaps of 3.5-4 m rising
// 0.5 m, and 3-5 m climbs up the panels.
import { BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, TorusGeometry } from 'three'
import { kit, voxelTexture } from './lavaPath.js'
import { arrowTexture, decal } from './zone4.js'
import { hexTexture } from './zone6.js'
import { ZONE7_EXIT } from './zone7.js'
import { label } from './lobby/labels.js'
import { buildTreadmill } from './lobby/treadmill.js'
import { makeCanvas } from './lobby/paint.js'

export const ZONE8_NAME = 'VIOLET TOWER'
export const ZONE8_BONUS = 1 // wins for the ring on the first ledge
export const ZONE8_WIN = 100 // wins for the yellow pad on the final platform
export const ZONE8_Z0 = ZONE7_EXIT.z // the entrance edge (Zone 7's north end)

const CX = (ZONE7_EXIT.x0 + ZONE7_EXIT.x1) / 2 // the tower's centre line, in line with Zone 7's hall
const FLOOR = ZONE7_EXIT.top // the start platform, flush with Zone 7's last platform
const HALF = 8 // m, half the tower's inner width
const WALL = { thick: 3, top: FLOOR + 30 } // side walls
const PIT_Y = FLOOR - 12 // the pit's floor
const FALL_Y = FLOOR - 4 // feet below this = respawn
const at = (e) => ZONE8_Z0 - e // m north of the entrance -> world z

// The course, as distances north of the entrance; the gaps between are pit.
const START = { e0: 0, e1: 14, half: 6, top: FLOOR }
// Cross walls: south face `e`, the foot ledge's top in front (none: the start platform), the
// ledge's top (the riser climbed by the panel), and the x of the panel and the opening above it.
const WALLS = [
  { e: 14, foot: null, ledge: FLOOR + 3, x: CX + 2.5 },
  { e: 38, foot: FLOOR + 4, ledge: FLOOR + 9, x: CX + 1 },
  { e: 62, foot: FLOOR + 10, ledge: FLOOR + 15, x: CX - 1 },
]
const CROSS = { depth: 4, ledge: 1.5, bandTop: FLOOR + 24, foot: 3 } // m: wall depth, ledge depth, the top of the dark recessed band (a fixed height, so it runs almost to the beams), foot ledge depth
const OPEN = { half: 1.8, h: 4, frame: 0.4 } // the openings in the bands
const PANEL_W = 4 // m, climbing panel width
const LANDINGS = [[18, 21.5, FLOOR + 3, CX + 2.5], [42, 45.5, FLOOR + 9, CX + 1]] // just inside the first two openings (e0, e1, top, x)
const PLATFORMS = [[25, 31, FLOOR + 3.5], [49, 55, FLOOR + 9.5]] // pale lantern platforms (e0, e1, top), 8 m wide
const FINAL = { e0: 66, e1: 86, top: FLOOR + 15 } // the final platform, flush with the last ledge
const DECK = { e0: 86, e1: 112, top: FINAL.top + 0.6, half: 7 } // the next zone's mine deck
const BACK_E = DECK.e1 // the zone's north face: the mine deck opens straight into Zone 9's cavern
const RING = { x: CX - 2.5, y: WALLS[0].ledge + 1.7, z: at(WALLS[0].e + 0.75), radius: 1.3, reach: 1.3 } // bonus ring on the first ledge; reach: m either side of its plane that count
const WIN_PAD = { x: CX - 3, z: at(FINAL.e0 + 6), size: 3.6 }
const PAID_PAD = { x: CX - 5.5, z: at(FINAL.e0 + 14) } // the cyan "+200 Wins" pad (decoration)
const TREAD = { x: CX + 4.5, z: at(FINAL.e0 + 10), len: 4.8, w: 2.4, mult: 2 } // the x2 Hair treadmill (m), console to the north
const BEAMS = [24, 32, 48, 56, 72, 80] // purple beams across the top (e)
const SLATS = [8, 28, 52, 76] // teal-slatted windows on both side walls (e)
const STRIPS = 6 // m between the violet pilaster strips along the side walls
// Big teal-framed panels with a yellow up arrow on the side walls (as on the reference towers): [side, e, width, height, bottom y, 'hex' | 'violet' | 'blue']
const SIDE_PANELS = [[1, 30, 7, 6, FLOOR + 6, 'hex'], [-1, 44, 5, 4, FLOOR + 12, 'violet'], [1, 60, 5, 4, FLOOR + 18, 'blue']]

// Where Zone 9 carries on: the mine deck's north end, the cave's inner width and the deck's top.
export const ZONE8_EXIT = { x0: CX - HALF, x1: CX + HALF, z: at(DECK.e1), top: DECK.top }

// Where a fall puts you: the start platform, facing the first wall.
export const ZONE8_SPAWN = { x: CX, y: FLOOR + 0.1, z: at(3) }

const COL = {
  violet: '#7d3bd8',
  recess: '#3a1a7a',
  indigo: '#21164f',
  lilac: '#d8c4f2',
  pale: '#f6e8f6',
  teal: '#3fe0c8',
  cyan: '#5ff2e8',
  post: '#1a1430',
  wood: '#c27434',
  woodDark: '#7a4320',
  rock: '#6d5f8f',
  yellow: '#ffd21a',
}

const tex = {}
function textures() {
  tex.violet = voxelTexture(COL.violet, { cells: 4, jitter: 0.05, grid: 0.16 })
  tex.recess = voxelTexture(COL.recess, { cells: 4, jitter: 0.06, grid: 0.2 })
  tex.indigo = voxelTexture(COL.indigo, { cells: 4, jitter: 0.06, grid: 0.22 })
  tex.lilac = voxelTexture(COL.lilac, { cells: 4, jitter: 0.03, grid: 0.08 })
  tex.pale = voxelTexture(COL.pale, { cells: 4, jitter: 0.02, grid: 0.06 })
  tex.teal = voxelTexture(COL.teal, { cells: 4, jitter: 0.04, grid: 0.1 })
  tex.wood = voxelTexture(COL.wood, { cells: 4, jitter: 0.08, grid: 0.28 })
  tex.woodDark = voxelTexture(COL.woodDark, { cells: 4, jitter: 0.08, grid: 0.25 })
  tex.rock = facetTexture()
}

// Faceted low-poly rock: random triangles in purples, indigos and blues, the crystal
// cave's walls and ceiling (`dark` for the ceiling). Tiled; one tile is meant to cover ~12 m.
const facetCache = new Map()
export function facetTexture(dark = false) {
  if (facetCache.has(dark)) return facetCache.get(dark)
  const S = 256
  const c = makeCanvas(S)
  const ctx = c.getContext('2d')
  ctx.fillStyle = dark ? '#3a2f6a' : '#4f4290'
  ctx.fillRect(0, 0, S, S)
  const shades = dark ? ['#2f2660', '#3a3172', '#453b84', '#4e4590', '#3a4a86', '#56508a'] : ['#443878', '#4e4196', '#58489e', '#6356b0', '#6e64bc', '#7a74c8', '#5468b4', '#8a90d6', '#9aa8e8']
  let seed = 21
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 110; i++) {
    const x = rnd() * S
    const y = rnd() * S
    const r = 28 + rnd() * 50
    ctx.fillStyle = rnd() < 0.03 ? '#58c8f0' : shades[Math.floor(rnd() * shades.length)]
    ctx.beginPath()
    for (let v = 0; v < 3; v++) {
      const a = rnd() * Math.PI * 2
      const d = r * (0.5 + rnd() * 0.5)
      ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d)
    }
    ctx.closePath()
    ctx.fill()
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  facetCache.set(dark, t)
  return t
}

// A dark frame with four teal slats (the side walls' windows).
function slatTexture() {
  const c = makeCanvas(64, 80)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#3b2a8a'
  ctx.fillRect(0, 0, 64, 80)
  ctx.fillStyle = '#120c2e'
  ctx.fillRect(6, 6, 52, 68)
  ctx.fillStyle = COL.teal
  for (let i = 0; i < 4; i++) ctx.fillRect(10 + i * 12, 10, 7, 60)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

let mats = null
const material = (k) => (mats ??= {
  teal: k.std(COL.teal, { emissive: '#14b0a0', emissiveIntensity: 0.45, roughness: 0.35 }),
  cyan: k.std(COL.cyan, { emissive: '#18c8c0', emissiveIntensity: 0.7, roughness: 0.3 }),
  post: k.std(COL.post, { roughness: 0.8 }),
  violet: k.std('#8f4ae8', { emissive: '#4a1a90', emissiveIntensity: 0.2, roughness: 0.6 }),
  gold: k.std('#ffcf1f', { emissive: '#d99a00', emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.3 }),
  glass: k.std('#c8f8ff', { emissive: '#6ad8f0', emissiveIntensity: 0.3, transparent: true, opacity: 0.65, roughness: 0.1 }),
  panel: new MeshStandardMaterial({ map: hexTexture(), emissive: '#1a2a90', emissiveIntensity: 0.25, roughness: 0.6 }),
  slat: new MeshBasicMaterial({ map: slatTexture() }),
  bluePanel: k.std('#3f4fd8', { emissive: '#1a2a90', emissiveIntensity: 0.3, roughness: 0.5 }),
  crystalTeal: k.std('#3fe8d8', { emissive: '#18b8b0', emissiveIntensity: 0.55, roughness: 0.25, flatShading: true }),
  crystalPurple: k.std('#b070ff', { emissive: '#7a2ae0', emissiveIntensity: 0.5, roughness: 0.25, flatShading: true }),
  lamp: k.std('#ffe9a0', { emissive: '#ffc040', emissiveIntensity: 1, roughness: 0.3 }),
  rail: k.std('#4a4a58', { metalness: 0.6, roughness: 0.4 }),
})

// Shared lantern geometry (one set for every lantern).
let lanternGeo = null
// A cyan lantern: dark post, glowing cyan block, wide flared cyan cap. Stands on `base`, ~3.6 m tall.
function lantern(k, x, z, base) {
  const m = material(k)
  lanternGeo ??= {
    post: new BoxGeometry(0.7, 1.6, 0.7),
    lamp: new BoxGeometry(1.7, 1.3, 1.7),
    flare: new BoxGeometry(3, 0.45, 3),
    cap: new BoxGeometry(2.1, 0.35, 2.1),
  }
  k.mesh(lanternGeo.post, m.post, x, base + 0.8, z, { cast: false })
  k.mesh(lanternGeo.lamp, m.cyan, x, base + 2.25, z, { cast: false })
  k.mesh(lanternGeo.flare, m.teal, x, base + 3.1, z, { cast: false })
  k.mesh(lanternGeo.cap, m.cyan, x, base + 3.5, z, { cast: false })
  k.addCollider(x, z, 1.4, 1.4, base + 3.7, 0, base)
}

// A walkable block: violet body, lilac band, pale top, a teal lip along its north and south edges.
function slab(k, x0, x1, e0, e1, top, { pale = true } = {}) {
  k.voxSpan(x0, x1, at(e0), at(e1), { y0: PIT_Y, y1: top - 0.6, side: tex.violet, cell: 2, collide: false, cast: false })
  k.voxSpan(x0, x1, at(e0), at(e1), { y0: top - 0.6, y1: top, side: tex.lilac, top: pale ? tex.pale : tex.lilac, cell: 1, collide: false, cast: false })
  k.addCollider((x0 + x1) / 2, (at(e0) + at(e1)) / 2, x1 - x0, e1 - e0, top, 0, PIT_Y)
  for (const e of [e0, e1]) k.mesh(new BoxGeometry(x1 - x0 + 0.1, 0.25, 0.2), material(k).teal, (x0 + x1) / 2, top - 0.12, at(e), { cast: false })
}

// A teal-framed blue hex climbing panel on a south face at z, from y0 to y1, a yellow up arrow under it when there's room.
function climbPanel(k, x, z, y0, y1) {
  const m = material(k)
  const vy0 = y1 - y0 > 4 ? y0 + 1.6 : y0 + 0.2
  const h = y1 - vy0
  k.mesh(new BoxGeometry(PANEL_W + 0.6, h + 0.3, 0.2), m.teal, x, vy0 + h / 2, z + 0.1, { cast: false })
  k.mesh(new BoxGeometry(PANEL_W, h - 0.3, 0.3), m.panel, x, vy0 + h / 2, z + 0.15, { cast: false })
  if (vy0 > y0 + 1) decal(k, arrowTexture(COL.yellow), x, y0 + 0.8, z + 0.02, 1.5, 1.5)
}

// --- The shell: pit, indigo side walls with slatted windows, beams, pilasters ---
function buildShell(k) {
  const m = material(k)
  const z0 = ZONE8_Z0
  const z1 = at(FINAL.e1)
  k.voxSpan(CX - HALF, CX + HALF, z0, z1, { y1: PIT_Y, side: tex.recess, cell: 3, cast: false })
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [CX - HALF - WALL.thick, CX - HALF] : [CX + HALF, CX + HALF + WALL.thick]
    k.voxSpan(x0, x1, z0, z1, { y1: WALL.top, side: tex.indigo, top: tex.violet, cell: 3, cast: false })
    k.voxSpan(x0 - 0.3, x1 + 0.3, z0, z1, { y0: WALL.top, y1: WALL.top + 0.5, side: tex.teal, top: tex.violet, cell: 1, collide: false, cast: false })
    // Violet pilasters where the cross walls meet the side walls, and at the entrance.
    for (const e of [0, ...WALLS.map((w) => w.e)]) {
      const xa = CX + s * HALF
      const xb = CX + s * (e === 0 ? ZONE7_EXIT.x1 - CX : HALF - 1.2)
      k.voxSpan(Math.min(xa, xb), Math.max(xa, xb), at(e) + (e === 0 ? 0 : 1), at(e) - 1.5, { y0: PIT_Y, y1: WALL.top + 0.6, side: tex.violet, top: tex.teal, cell: 1.5, cast: false })
    }
    // Violet pilaster strips with teal edges all along the side wall, as on the reference tower.
    for (let e = STRIPS / 2; e < FINAL.e1; e += STRIPS) {
      if (WALLS.some((w) => Math.abs(w.e - e) < 3)) continue
      const xa = CX + s * HALF
      const xb = CX + s * (HALF - 0.4)
      k.voxSpan(Math.min(xa, xb), Math.max(xa, xb), at(e) + 0.8, at(e) - 0.8, { y0: PIT_Y, y1: WALL.top, side: tex.violet, top: tex.violet, cell: 1.5, collide: false, cast: false })
      for (const dz of [-0.9, 0.9]) k.mesh(new BoxGeometry(0.5, WALL.top - PIT_Y, 0.12), m.teal, CX + s * (HALF - 0.25), (WALL.top + PIT_Y) / 2, at(e) + dz, { cast: false })
    }
    // A dark teal-lipped shelf on each side wall over the lantern platforms.
    const [e0, e1, y] = s < 0 ? [26, 34, FLOOR + 10.5] : [50, 58, FLOOR + 16.5]
    k.voxSpan(CX + s * HALF, CX + s * (HALF - 1.6), at(e0), at(e1), { y0: y, y1: y + 0.8, side: tex.recess, top: tex.recess, cell: 1, cast: false })
    k.mesh(new BoxGeometry(0.25, 0.25, e1 - e0), m.teal, CX + s * (HALF - 1.6), y + 0.7, at((e0 + e1) / 2), { cast: false })
  }
  // Big teal-framed panels with a yellow up arrow and a teal ledge strip on the side walls (decoration).
  for (const [s, e, w, h, y0, kind] of SIDE_PANELS) {
    const x = CX + s * (HALF - 0.2)
    const frame = k.mesh(new BoxGeometry(w + 0.8, h + 0.8, 0.3), m.teal, x, y0 + h / 2, at(e), { cast: false })
    frame.rotation.y = Math.PI / 2
    const face = k.mesh(new BoxGeometry(w, h, 0.5), kind === 'hex' ? m.panel : kind === 'blue' ? m.bluePanel : m.violet, x, y0 + h / 2, at(e), { cast: false })
    face.rotation.y = Math.PI / 2
    const arrow = decal(k, arrowTexture(COL.yellow), CX + s * (HALF - 0.5), y0 - 1.6, at(e), 2.2, 2.2)
    arrow.rotation.y = -s * Math.PI / 2
    k.mesh(new BoxGeometry(0.3, 0.3, w + 2), m.teal, CX + s * (HALF - 0.3), y0 - 0.4, at(e), { cast: false })
  }
  // Teal-slatted windows high on both side walls.
  const winGeo = new PlaneGeometry(4, 5)
  for (const e of SLATS) {
    for (const s of [-1, 1]) {
      const w = k.mesh(winGeo, m.slat, CX + s * (HALF - 0.03), FLOOR + 18, at(e), { cast: false })
      w.rotation.y = -s * Math.PI / 2
      w.receiveShadow = false
    }
  }
  // Purple beams across the top, a teal strip along each.
  const beamGeo = new BoxGeometry(HALF * 2, 1, 1.2)
  const stripGeo = new BoxGeometry(HALF * 2, 0.2, 0.25)
  for (const e of BEAMS) {
    k.mesh(beamGeo, m.violet, CX, WALL.top - 2, at(e), { cast: false })
    k.mesh(stripGeo, m.teal, CX, WALL.top - 1.4, at(e) + 0.6, { cast: false })
  }
}

// --- The cross walls: foot ledge, riser with its panel, recessed band with the opening --
function buildWall(k, w) {
  const m = material(k)
  const c = CROSS
  const xL = CX - HALF
  const xR = CX + HALF
  if (w.foot !== null) {
    slab(k, xL, xR, w.e - c.foot, w.e, w.foot)
    k.mesh(new BoxGeometry(5, 2.4, 0.2), m.teal, CX, w.foot - 2.2, at(w.e - c.foot) + 0.1, { cast: false })
    for (const s of [-1, 1]) lantern(k, CX + s * 5.2, at(w.e - c.foot + 1.3), w.foot)
  }
  // The riser (its top is the ledge in front of the band and the opening's floor).
  k.voxSpan(xL, xR, at(w.e), at(w.e + c.depth), { y0: PIT_Y, y1: w.ledge, side: tex.violet, top: tex.lilac, cell: 1.5, cast: false })
  k.mesh(new BoxGeometry(HALF * 2, 0.25, 0.25), m.teal, CX, w.ledge - 0.12, at(w.e) + 0.1, { cast: false })
  climbPanel(k, w.x, at(w.e), w.foot ?? START.top, w.ledge)

  // The recessed band and the wall above it, with the opening.
  const b0 = at(w.e + c.ledge)
  const b1 = at(w.e + c.depth)
  const yo = w.ledge + OPEN.h
  const body = (x0, x1, y0) => k.voxSpan(x0, x1, b0, b1, { y0, y1: WALL.top, side: tex.recess, top: tex.violet, cell: 1.5, cast: false })
  body(xL, w.x - OPEN.half, w.ledge)
  body(w.x + OPEN.half, xR, w.ledge)
  body(w.x - OPEN.half, w.x + OPEN.half, yo)
  k.voxSpan(xL, xR, at(w.e), b0, { y0: c.bandTop, y1: WALL.top, side: tex.violet, top: tex.violet, cell: 1.5, cast: false })
  k.mesh(new BoxGeometry(HALF * 2, 0.3, 0.3), m.teal, CX, WALL.top + 0.15, at(w.e) - 0.6, { cast: false })

  // The teal frame round the opening runs the full depth of the wall (a short tunnel), pale strips along its sill and lintel; a teal arrow points down at it.
  const f = OPEN.frame
  const depth = c.depth - c.ledge
  const zc = (b0 + b1) / 2
  for (const s of [-1, 1]) k.mesh(new BoxGeometry(f, OPEN.h + f, depth + 0.4), m.teal, w.x + s * (OPEN.half + f / 2), w.ledge + (OPEN.h + f) / 2, zc, { cast: false })
  k.mesh(new BoxGeometry(OPEN.half * 2 + f * 2, f, depth + 0.4), m.teal, w.x, yo + f / 2, zc, { cast: false })
  k.mesh(new BoxGeometry(OPEN.half * 2 + f * 2, f, depth + 0.4), m.teal, w.x, w.ledge - f / 2, zc, { cast: false })
  for (const y of [w.ledge + 0.08, yo - 0.08]) k.mesh(new BoxGeometry(OPEN.half * 2 - 0.4, 0.12, 0.12), k.std(COL.pale, { emissive: '#ffffff', emissiveIntensity: 0.35 }), w.x, y, b0 + 0.3, { cast: false })
  decal(k, arrowTexture(COL.teal), w.x, yo + f + 1.6, b0 + 0.02, 2, 2, Math.PI)

  // A cyan-framed window up in the band beside the opening (the first wall carries the sign instead).
  if (w.foot === null) return
  const wx = w.x > CX ? CX - 4.5 : CX + 4.5
  const wy = yo + 5
  k.mesh(new BoxGeometry(3.6, 3.6, 0.3), m.cyan, wx, wy, b0 + 0.15, { cast: false })
  k.mesh(new BoxGeometry(2.9, 2.9, 0.4), m.post, wx, wy, b0 + 0.15, { cast: false })
}

// --- The course: start platform, landings, lantern platforms ---------------------
function buildCourse(k) {
  const m = material(k)
  slab(k, CX - START.half, CX + START.half, START.e0, START.e1, START.top)
  for (const s of [-1, 1]) lantern(k, CX + s * (START.half - 1.8), at(START.e1 - 2.4), START.top)
  for (const w of WALLS) buildWall(k, w)
  for (const [e0, e1, top, x] of LANDINGS) slab(k, x - 3, x + 3, e0, e1, top, { pale: false })
  for (const [e0, e1, top] of PLATFORMS) {
    slab(k, CX - 4, CX + 4, e0, e1, top)
    k.mesh(new BoxGeometry(3.2, 2.2, 0.2), m.teal, CX, top - 2.2, at(e0) + 0.1, { cast: false }) // teal plate on the front
  }

  // The bonus ring on the first ledge, west of the opening.
  const ring = new Mesh(new TorusGeometry(RING.radius, 0.14, 10, 32), k.std(COL.yellow, { emissive: '#ffb000', emissiveIntensity: 0.6, roughness: 0.3 }))
  ring.position.set(RING.x, RING.y, RING.z) // faces south, across the ledge walk
  k.g.add(ring)
  return ring
}

// --- The final platform: win pad + trophy, cyan pad, treadmill, lanterns ---------
function buildFinal(k) {
  const m = material(k)
  slab(k, CX - HALF, CX + HALF, FINAL.e0, FINAL.e1, FINAL.top)
  for (const s of [-1, 1]) {
    k.mesh(new BoxGeometry(0.25, 0.3, FINAL.e1 - FINAL.e0), m.teal, CX + s * (HALF - 0.12), FINAL.top + 0.15, at((FINAL.e0 + FINAL.e1) / 2), { cast: false })
    lantern(k, CX + s * (HALF - 2), at(FINAL.e0 + 2.4), FINAL.top)
    lantern(k, CX + s * (HALF - 2), at(FINAL.e1 - 2.4), FINAL.top)
  }
  const top = FINAL.top
  // The yellow win pad with a red rim and a big gold trophy.
  k.mesh(new BoxGeometry(WIN_PAD.size + 0.4, 0.1, WIN_PAD.size + 0.4), k.std('#ff3d3d'), WIN_PAD.x, top + 0.05, WIN_PAD.z, { cast: false })
  k.mesh(new BoxGeometry(WIN_PAD.size, 0.16, WIN_PAD.size), k.std('#ffe11a', { emissive: '#ffc400', emissiveIntensity: 0.45, roughness: 0.4 }), WIN_PAD.x, top + 0.08, WIN_PAD.z, { cast: false })
  const trophy = new Group()
  const part = (geo, mat, y) => {
    const t = new Mesh(geo, mat)
    t.position.y = y
    trophy.add(t)
  }
  part(new BoxGeometry(0.55, 0.16, 0.55), m.gold, 0)
  part(new CylinderGeometry(0.07, 0.1, 0.3, 10), m.gold, 0.23)
  part(new CylinderGeometry(0.38, 0.16, 0.5, 16), m.gold, 0.63)
  part(new BoxGeometry(0.95, 0.08, 0.08), m.gold, 0.68) // handles
  trophy.scale.setScalar(1.6)
  trophy.position.set(WIN_PAD.x, top + 1.2, WIN_PAD.z)
  k.g.add(trophy)

  // The cyan "+200 Wins" pad with a glass cup (decoration).
  k.mesh(new BoxGeometry(WIN_PAD.size, 0.14, WIN_PAD.size), k.std('#3fe0ff', { emissive: '#1aa8e0', emissiveIntensity: 0.45, roughness: 0.4 }), PAID_PAD.x, top + 0.07, PAID_PAD.z, { cast: false })
  k.mesh(new CylinderGeometry(0.5, 0.22, 0.8, 16), m.glass, PAID_PAD.x, top + 1.1, PAID_PAD.z, { cast: false })
  k.mesh(new CylinderGeometry(0.1, 0.12, 0.5, 8), m.glass, PAID_PAD.x, top + 0.45, PAID_PAD.z, { cast: false })

  // The x2 Hair treadmill: runs like the Hub's, console to the north.
  const treadmill = buildTreadmill(k.g, k.addCollider, {
    x: TREAD.x, z: TREAD.z, y: top, yaw: -Math.PI / 2, length: TREAD.len, width: TREAD.w, theme: 'frost', mult: TREAD.mult, labelY: 3.9,
    labels: [
      { text: '[x2 Boost]', size: 0.35, fill: '#ff5a9a', stroke: '#3a0a1a' },
      { text: `x${TREAD.mult} Hair`, size: 0.7, fill: ['#d6fbff', '#5fd8ff'], stroke: '#0a3a5a' },
    ],
  })
  return { trophy, treadmill }
}

// --- The next zone's mine deck in a crystal cave ------------------------------------
function buildMine(k) {
  const m = material(k)
  const d = DECK
  const z0 = at(d.e0)
  const z1 = at(d.e1)
  const top = d.top
  // Cave: rock walls each side and a ceiling (open at the north end: Zone 9 carries on); the deck on wooden stilts.
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [CX - HALF - WALL.thick, CX - HALF] : [CX + HALF, CX + HALF + WALL.thick]
    k.voxSpan(x0, x1, z0, at(BACK_E), { y1: top + 22, side: tex.rock, cell: 12, cast: false })
    k.voxSpan(CX + s * HALF, CX + s * d.half, z0, z1, { y0: top - 1, y1: top + 6 + s, side: tex.rock, cell: 8, cast: false })
  }
  k.voxSpan(CX - HALF - WALL.thick, CX + HALF + WALL.thick, z0 - 4, at(BACK_E), { y0: top + 18, y1: top + 22, side: tex.rock, cell: 12, collide: false, cast: false })
  k.voxSpan(CX - HALF, CX + HALF, z0, z1, { y1: FINAL.top - 2, side: tex.rock, cell: 12, cast: false })
  k.voxSpan(CX - d.half, CX + d.half, z0, z1, { y0: FINAL.top - 2, y1: top, side: tex.woodDark, top: tex.wood, cell: 1.2, cast: false })
  k.mesh(new BoxGeometry(d.half * 2 + 0.2, 0.3, 0.3), k.std(COL.woodDark), CX, top - 0.1, z0, { cast: false })

  // Two wooden frames: posts, a top beam, braces, little lamps.
  const postGeo = new BoxGeometry(0.8, 9, 0.8)
  const braceGeo = new BoxGeometry(0.4, 3, 0.4)
  const wood = k.std('#8a4a22', { roughness: 0.85 })
  for (const e of [d.e0 + 3, d.e0 + 13]) {
    const z = at(e)
    for (const s of [-1, 1]) {
      k.mesh(postGeo, wood, CX + s * (d.half - 0.6), top + 4.5, z, { cast: false })
      k.addCollider(CX + s * (d.half - 0.6), z, 0.8, 0.8, top + 9, 0, top)
      const b = k.mesh(braceGeo, wood, CX + s * (d.half - 1.6), top + 7.8, z, { cast: false })
      b.rotation.z = s * Math.PI / 4
      k.mesh(new BoxGeometry(0.3, 0.4, 0.3), m.lamp, CX + s * (d.half - 0.6), top + 5.5, z + 0.55, { cast: false })
    }
    k.mesh(new BoxGeometry(d.half * 2 + 0.6, 0.8, 0.9), wood, CX, top + 9.2, z, { cast: false })
  }

  // A rail track up the deck, barrels, crates and a gold ore lump.
  const railGeo = new BoxGeometry(0.12, 0.15, d.e1 - d.e0 - 2)
  for (const s of [-1, 1]) k.mesh(railGeo, m.rail, CX + 2 + s * 0.6, top + 0.22, at((d.e0 + d.e1) / 2 + 1), { cast: false })
  const tieGeo = new BoxGeometry(1.8, 0.12, 0.35)
  for (let e = d.e0 + 2; e < d.e1; e += 1.4) k.mesh(tieGeo, wood, CX + 2, top + 0.08, at(e), { cast: false })
  const barrelGeo = new CylinderGeometry(0.55, 0.55, 1.2, 12)
  const barrel = k.std('#9a5a2a', { roughness: 0.8 })
  for (const [x, e] of [[CX + d.half - 1.3, d.e0 + 6], [CX - d.half + 1.4, d.e0 + 9]]) {
    k.mesh(barrelGeo, barrel, x, top + 0.6, at(e), { cast: false })
    k.addCollider(x, at(e), 1.1, 1.1, top + 1.2, 0, top)
  }
  for (const [x, e, y] of [[CX - d.half + 1.3, d.e0 + 5, 0], [CX - d.half + 1.3, d.e0 + 5, 1.1], [CX - d.half + 2.5, d.e0 + 5.2, 0]]) {
    k.voxSpan(x - 0.55, x + 0.55, at(e) + 0.55, at(e) - 0.55, { y0: top + y, y1: top + y + 1.1, side: tex.wood, cell: 0.55, cast: false })
  }
  const arrow = k.mesh(new PlaneGeometry(2.8, 2.8), new MeshBasicMaterial({ map: arrowTexture(COL.yellow), transparent: true, depthWrite: false }), CX - 1.5, top + 0.03, at(d.e0 + 8), { cast: false })
  arrow.rotation.x = -Math.PI / 2
  arrow.receiveShadow = false

}

export function buildZone8(scene, addCollider) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)
  textures()

  buildShell(k)
  const ring = buildCourse(k)
  const { trophy, treadmill } = buildFinal(k)
  buildMine(k)

  label(g, [
    { text: 'RECOMMENDED', size: 0.45, fill: ['#7ff6ff', '#3fd8ff'], stroke: '#0a2a3a' },
    { text: 'LEVEL 64', size: 1, fill: '#ffffff', stroke: '#2a0a4a' },
  ], [CX, WALLS[0].ledge + OPEN.h + 7, at(WALLS[0].e - 0.6)], { unit: 2.2 })
  label(g, [{ text: `🏆 +${ZONE8_BONUS} Win`, size: 0.5, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }], [RING.x, RING.y + RING.radius + 0.6, RING.z], { unit: 1.2 })
  label(g, [{ text: `+${ZONE8_WIN} Wins`, size: 0.7, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }], [WIN_PAD.x, FINAL.top + 3.2, WIN_PAD.z], { unit: 1.4 })
  label(g, [
    { text: '⬢ 85', size: 0.45, fill: '#7dff5a', stroke: '#0a3a0a' },
    { text: '+200 Wins', size: 0.7, fill: ['#d6fbff', '#3fd8ff'], stroke: '#0a3a5a' },
  ], [PAID_PAD.x, FINAL.top + 2.4, PAID_PAD.z], { unit: 1.4 })
  label(g, [
    { text: 'RECOMMENDED', size: 0.45, fill: ['#ffe27a', '#ffb000'], stroke: '#4a2a00' },
    { text: 'LEVEL 71', size: 1, fill: '#ffffff', stroke: '#2a0a2a' },
  ], [CX, DECK.top + 11.5, at(DECK.e0 + 13)], { unit: 2 })

  const inZone = (p) => p.z <= ZONE8_Z0 && p.z > at(DECK.e1) && Math.abs(p.x - CX) < HALF + WALL.thick
  let bonus = false
  let won = false
  return {
    treadmills: [treadmill], // main.js runs them with the Hub's
    // From Zone 7's north end to the mine deck's back wall.
    contains: inZone,
    // True while the player is pressed against a climbing panel (main.js lifts them).
    climbAt(p) {
      for (const w of WALLS) {
        const z0 = at(w.e)
        const y0 = w.foot ?? START.top
        if (p.z <= z0 + 0.75 && p.z > z0 - 1 && p.y >= y0 - 0.5 && p.y < w.ledge && Math.abs(p.x - w.x) < PANEL_W / 2 + 0.3) return true
      }
      return false
    },
    // Returns 'fell' (the pit), 'bonus' (through the ring) or 'finish' (the win pad).
    update(dt, time, p) {
      ring.position.y = RING.y + Math.sin(time * 2) * 0.12
      trophy.rotation.y = time * 1.5
      trophy.position.y = FINAL.top + 1.2 + Math.sin(time * 2) * 0.1
      treadmill.update(dt, time)
      if (inZone(p) && p.y < FALL_Y) return 'fell'
      if (!bonus && Math.abs(p.z - RING.z) < RING.reach && Math.hypot(p.x - RING.x, p.y + 0.9 - ring.position.y) < RING.radius) {
        bonus = true
        return 'bonus'
      }
      const onPad = Math.abs(p.x - WIN_PAD.x) < WIN_PAD.size / 2 && Math.abs(p.z - WIN_PAD.z) < WIN_PAD.size / 2
      if (!won && onPad && p.y >= FINAL.top - 0.05) {
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
