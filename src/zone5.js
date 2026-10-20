// Zone 5: PURPLE PALACE. Past Zone 4's pink finish platform a pink walkway runs
// north beside a strip of the pit's lava. A tall dark-purple wall with hot-pink
// beams lines its west side; a raised pink plateau with crystals lines the east,
// open to the sky. Sand blocks at the walkway's edge step across the lava onto
// it. The walkway ends at the palace: two crenellated, thick-walled buildings
// either side of a narrow lava slit (magenta bands, yellow arrows pointing at it,
// gold lines) and a taller plain tower on the east. The slit is lined in magenta
// with a thin pink ledge along each wall and opens into an open-roofed lava
// courtyard: jump from a ledge onto the big pink pedestal in the middle, then
// across through the gold octagon window in the north wall (arrows point at it)
// into the long lava chamber behind: hop the small pillar to the big pink
// landing, jump north through a gold +1 Win ring onto a pedestal, use its yellow
// block to step up to a higher one, then cross to the final platform, whose
// yellow pad awards the zone's wins and sends you home. Banded towers stand in
// the lava. Every jump is 4-6 m, inside the ~6.8 m running-jump reach. Falling into the lava
// (or off the plateau) puts you back at the walkway's start. Procedural like
// Zones 2-4 (voxel canvas textures, boxes; the battlements are instanced).
//
// Measured against the 1.8 m player in the reference shots: the walkway is ~5
// player heights wide, the lava ~2, the buildings ~10 tall with ~1.7-thick
// walls, the pedestal ~4.4 across with a ~1.3-tall crystal and the octagon window ~3 tall.
import { BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, RepeatWrapping, SRGBColorSpace, TorusGeometry } from 'three'
import { kit, lavaTexture, voxelTexture } from './lavaPath.js'
import { arrowTexture, decal, PALACE_Z, ZONE4_FINISH, ZONE4_PIT } from './zone4.js'
import { label } from './lobby/labels.js'
import { makeCanvas } from './lobby/paint.js'

export const ZONE5_NAME = 'PURPLE PALACE'
export const ZONE5_BONUS = 1 // wins for jumping through the chamber's ring
export const ZONE5_WIN = 15 // wins for the pad on the final platform
export const ZONE5_Z0 = ZONE4_FINISH.z1 // the entrance edge (Zone 4's finish platform)

const FLOOR = ZONE4_FINISH.top // the walkway, flush with the finish platform
const LAVA_Y = ZONE4_PIT.floor // the pit's lava runs on at the same level
const F = PALACE_Z // the palace front (south faces)
const WALK = { x0: 4.5, x1: 14 } // the pink walkway, its east edge in line with the finish platform's
const SLIT = { x0: WALK.x1, x1: 18, z1: F - 16, ledge: 1 } // lava slit between the buildings; ledges stay wider than the 0.4 m player radius
const CHANNEL = { x0: SLIT.x0, x1: SLIT.x1 } // the lava strip beside the walkway, in line with the slit
const PLATEAU = { x0: CHANNEL.x1, x1: 34, top: FLOOR + 0.8 } // raised pink east bank, open to the sky past x1
const WALL = 3 // m, the palace's wall thickness
const TOP = FLOOR + 18 // the crenellated buildings' wall tops
const WEST = { x0: -ZONE4_PIT.halfW, x1: SLIT.x0 } // west building
const MID = { x0: SLIT.x1, x1: 27 } // middle building, east of the slit
const EAST = { x0: MID.x1, x1: PLATEAU.x1, top: FLOOR + 24 } // plain tall tower in front; the courtyard's east wall behind it
const GAP = { west: 10, east: 14, ns: 6 } // m of lava between the pedestal and the courtyard walls
const PEDESTAL = { x0: 12, x1: 20, z0: SLIT.z1 - GAP.ns, size: 8, top: FLOOR, slab: 0.8, trim: 0.3 } // 8 m square; 6 m level jumps from the ledges and to the window
PEDESTAL.z1 = PEDESTAL.z0 - PEDESTAL.size
const COURT = { x0: PEDESTAL.x0 - GAP.west, x1: PEDESTAL.x1 + GAP.east, z0: SLIT.z1, z1: PEDESTAL.z1 - GAP.ns } // open-roofed lava courtyard behind the slit
const WINDOW = { x: (PEDESTAL.x0 + PEDESTAL.x1) / 2, y0: FLOOR, w: 4, h: 5, frame: 0.9 } // octagon opening through the north wall
const ROOM2 = { x0: COURT.x0, x1: COURT.x1, z0: COURT.z1 - WALL, z1: COURT.z1 - WALL - 60 } // the long lava chamber through the window, to the finale
const PILLAR = { x0: 22, x1: 27, z0: ROOM2.z0 - 4, z1: ROOM2.z0 - 9, top: FLOOR } // small pedestal, a ~5.7 m diagonal hop from the window
const LANDING = { x0: 4, x1: 16, z0: PILLAR.z1 - 1, z1: PILLAR.z1 - 15, top: FLOOR } // big pink landing, 6 m west of the pillar
const RING = { x: 9, y: FLOOR + 2, z: LANDING.z1 - 2.2, radius: 1.5 } // bonus ring on the jump north off the landing
const STEP1 = { x0: 6, x1: 12, z0: LANDING.z1 - 4.5, z1: LANDING.z1 - 9.5, top: FLOOR + 0.6 } // pedestal 4.5 m north of the landing
const STEP_BLOCK = { x0: 10.2, x1: 11.6, z0: STEP1.z1 + 2.2, z1: STEP1.z1 + 0.8, top: STEP1.top + 0.6 } // yellow block on it, a walk-up step
const STEP2 = { x0: 11, x1: 16, z0: STEP_BLOCK.z1 - 3.9, z1: STEP_BLOCK.z1 - 8.9, top: STEP_BLOCK.top } // higher pedestal, level with the block
const FINALE = { x0: STEP2.x1 + 4, x1: ROOM2.x1 - 1, z0: STEP2.z0 + 2.5, z1: STEP2.z0 - 17.5, top: STEP2.top } // the final platform, 4 m east
const WIN_PAD = { x: FINALE.x1 - 4, z: FINALE.z0 - 6, size: 3.6 } // the zone's win pad (yellow); the blue pad is just north of it
const TOWERS = [[3, 7, STEP1.z1 - 3.5], [3, 7, STEP1.z1 - 12.5]] // banded towers in the lava (x0, x1, south z), 4 m deep
const TOWER_TOP = FLOOR + 16
const BACK_Z = ROOM2.z1 - WALL // the palace's north face
const LEFT_TOP = FLOOR + 10 // the west wall along the walkway
const MERLON = { w: 1.6, h: 1.6, gap: 1.6 } // battlements along the front and sides of each building
const EDGE = 0.8 // m of dark purple left showing at every inner corner of the magenta lining
const BAND = { y: FLOOR + 5.5, h: 3, arrow: 2.6, left: [5.6, 13.2], right: [18.8, 26.2] } // magenta bands (x extents) on the fronts
const GOLD_X = [5.2, 12.8, 19.4, 25.8] // gold lines up the fronts
const SAND_STEP = { x0: 13.4, x1: 15.6, z0: -263.5, z1: -267, top: FLOOR + 0.2 } // stepping block from the walkway into the lava

// Where a fall puts you: the start of the walkway, facing the palace.
export const ZONE5_SPAWN = { x: (WALK.x0 + WALK.x1) / 2, y: FLOOR + 0.1, z: ZONE5_Z0 - 2 }

const COL = {
  purple: '#2c0f50',
  purpleMid: '#4a1a82',
  violet: '#6e2a96',
  pink: '#f5a9d3',
  pinkLight: '#ffd6ee',
  pinkHot: '#e2479f',
  pinkLedge: '#f78ccb',
  magenta: '#c8358f',
  brown: '#5a2e1a',
  sand: '#e8c27a',
  sandLight: '#f7dfa4',
  yellow: '#ffd21a',
}

const tex = {}
function textures() {
  tex.purple = voxelTexture(COL.purple, { cells: 4, jitter: 0.1, grid: 0.3 })
  tex.purpleMid = voxelTexture(COL.purpleMid, { cells: 4, jitter: 0.08, grid: 0.25 })
  tex.violet = voxelTexture(COL.violet, { cells: 4, jitter: 0.06, grid: 0.18 })
  tex.pink = voxelTexture(COL.pink, { cells: 4, jitter: 0.04, grid: 0.1 })
  tex.pinkHot = voxelTexture(COL.pinkHot, { cells: 4, jitter: 0.05, grid: 0.15 })
  tex.pinkLedge = voxelTexture(COL.pinkLedge, { cells: 4, jitter: 0.04, grid: 0.12 })
  tex.magenta = voxelTexture(COL.magenta, { cells: 4, jitter: 0.05, grid: 0.15 })
  tex.brown = voxelTexture(COL.brown, { cells: 4, jitter: 0.1, grid: 0.25 })
  tex.sand = voxelTexture(COL.sand, { cells: 4, jitter: 0.05, grid: 0.15 })
  tex.sandLight = voxelTexture(COL.sandLight, { cells: 4, jitter: 0.04, grid: 0.12 })
}

// A lava plane over x0..x1, z0..z1 (z0 south) on a brown bed, tiled every 5 m like the pit.
function lava(k, x0, x1, z0, z1) {
  k.voxSpan(x0, x1, z0, z1, { y1: LAVA_Y, side: tex.brown, cell: 2, cast: false })
  const t = lavaTexture().clone()
  t.repeat.set((x1 - x0) / 5, (z0 - z1) / 5)
  const m = k.mesh(new PlaneGeometry(x1 - x0, z0 - z1), new MeshBasicMaterial({ map: t, toneMapped: false }), (x0 + x1) / 2, LAVA_Y + 0.03, (z0 + z1) / 2, { cast: false })
  m.rotation.x = -Math.PI / 2
  m.receiveShadow = false
}

// A pink-topped slab on a purple base, from the lava up to `top`.
function pinkSlab(k, x0, x1, z0, z1, top) {
  k.voxSpan(x0, x1, z0, z1, { y0: LAVA_Y, y1: top - 0.8, side: tex.purple, cell: 1.5, collide: false, cast: false })
  k.voxSpan(x0, x1, z0, z1, { y0: top - 0.8, y1: top, side: tex.pink, cell: 1, collide: false, cast: false })
  k.addCollider((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z0 - z1, top)
}

// A six-sided crystal standing on `y`, with a pointed cap.
function crystal(k, x, y, z, r, h, color, emissive) {
  const mat = k.std(color, { emissive, emissiveIntensity: 0.35, roughness: 0.3 })
  k.mesh(new CylinderGeometry(r, r, h, 6), mat, x, y + h / 2, z)
  k.mesh(new ConeGeometry(r, r * 1.4, 6), mat, x, y + h + r * 0.7, z)
  k.addCollider(x, z, r * 1.6, r * 1.6, y + h)
}

// --- The approach: walkway, lava strip, sand step, east plateau, west wall ------------
function buildApproach(k) {
  const len = ZONE5_Z0 - F
  pinkSlab(k, WALK.x0, WALK.x1, ZONE5_Z0, F, FLOOR)
  // Two pale inlay stripes along the walkway.
  const stripe = k.std(COL.pinkLight, { emissive: COL.pinkLight, emissiveIntensity: 0.25 })
  for (const x of [WALK.x0 + 1.2, WALK.x1 - 1.2]) k.mesh(new BoxGeometry(0.35, 0.04, len), stripe, x, FLOOR + 0.02, (ZONE5_Z0 + F) / 2, { cast: false })

  lava(k, CHANNEL.x0, CHANNEL.x1, ZONE5_Z0, F)
  // Sand blocks at the walkway's edge: a step into the lava, a small one stacked beside it.
  const st = SAND_STEP
  k.voxSpan(st.x0, st.x1, st.z0, st.z1, { y0: LAVA_Y, y1: st.top, side: tex.sand, top: tex.sandLight, cell: 0.8, cast: false })
  k.voxSpan(st.x0 + 0.2, st.x0 + 1.2, st.z0 + 1.4, st.z0, { y0: FLOOR, y1: FLOOR + 0.9, side: tex.sand, top: tex.sandLight, cell: 0.5, cast: false })

  // The raised east plateau with a tall hot-pink crystal and a pale one.
  pinkSlab(k, PLATEAU.x0, PLATEAU.x1, ZONE5_Z0, F, PLATEAU.top)
  crystal(k, 25, PLATEAU.top, -265, 0.9, 2.8, '#ff2f8f', '#c0105a')
  crystal(k, 22.6, PLATEAU.top, -267.5, 0.45, 1.3, '#efe8ff', '#b8a8e8')

  // The tall west wall, pink-capped, with two hot-pink beams jutting over the walkway.
  k.voxSpan(WEST.x0, WALK.x0, ZONE5_Z0, F, { y0: LAVA_Y, y1: LEFT_TOP, side: tex.purple, top: tex.purpleMid, cell: 2, cast: false })
  k.voxSpan(WEST.x0, WALK.x0 + 0.4, ZONE5_Z0 + 0.4, F, { y0: LEFT_TOP - 0.5, y1: LEFT_TOP + 0.3, side: tex.pink, cell: 1, collide: false, cast: false })
  k.voxSpan(WALK.x0 - 0.5, WALK.x0 + 2, ZONE5_Z0 - 3, ZONE5_Z0 - 9, { y0: LEFT_TOP - 1.6, y1: LEFT_TOP - 0.8, side: tex.pinkHot, cell: 0.8 })
  k.voxSpan(WALK.x0 - 0.5, WALK.x0 + 1.6, F + 9, F + 1, { y0: FLOOR + 6, y1: FLOOR + 6.8, side: tex.pinkHot, cell: 0.8 })
}

// --- The palace front: crenellated buildings, the slit, the tower ------------------
// Battlements are gathered here and drawn as two instanced meshes (purple merlons, pink caps).
const merlons = []
function battlements(x0, x1, z0, z1) {
  const step = MERLON.w + MERLON.gap
  const along = (a0, a1, fn) => {
    const n = Math.floor((a1 - a0 + MERLON.gap) / step)
    const pad = (a1 - a0 - (n * step - MERLON.gap)) / 2
    for (let i = 0; i < n; i++) fn(a0 + pad + i * step + MERLON.w / 2)
  }
  along(x0, x1, (x) => merlons.push([x, z0 - WALL / 2, MERLON.w, WALL])) // front
  along(z1, z0 - WALL, (z) => {
    merlons.push([x0 + WALL / 2, z, WALL, MERLON.w]) // west side
    merlons.push([x1 - WALL / 2, z, WALL, MERLON.w]) // east side
  })
}
function buildMerlons(k) {
  const o = new Object3D()
  const make = (mat, y, h, grow) => {
    const m = new InstancedMesh(new BoxGeometry(1, 1, 1), mat, merlons.length)
    merlons.forEach(([x, z, w, d], i) => {
      o.position.set(x, y, z)
      o.scale.set(w + grow, h, d + grow)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    k.g.add(m)
  }
  make(k.std(COL.purpleMid), TOP + MERLON.h / 2, MERLON.h, 0)
  make(k.std(COL.pink, { roughness: 0.6 }), TOP + MERLON.h + 0.15, 0.3, 0.3)
}

// A thick-walled hollow building, open to the sky inside, with a pink rim and a
// hot-pink stripe under the battlements on its front.
function shell(k, x0, x1, z0, z1) {
  const wall = (a0, a1, b0, b1) => k.voxSpan(a0, a1, b0, b1, { y0: LAVA_Y, y1: TOP, side: tex.purple, top: tex.purpleMid, cell: 2, cast: false })
  wall(x0, x1, z0, z0 - WALL)
  wall(x0, x1, z1 + WALL, z1)
  wall(x0, x0 + WALL, z0 - WALL, z1 + WALL)
  wall(x1 - WALL, x1, z0 - WALL, z1 + WALL)
  k.voxSpan(x0 + WALL, x1 - WALL, z0 - WALL, z1 + WALL, { y0: LAVA_Y, y1: FLOOR, side: tex.purple, top: tex.purpleMid, cell: 2, cast: false })
  k.voxSpan(x0 - 0.3, x1 + 0.3, z0 + 0.3, z0 - WALL, { y0: TOP - 1, y1: TOP, side: tex.pink, cell: 1, collide: false, cast: false })
  k.voxSpan(x0 - 0.15, x1 + 0.15, z0 + 0.15, z0 - WALL, { y0: TOP - 3.4, y1: TOP - 2.2, side: tex.pinkHot, cell: 1, collide: false, cast: false })
  battlements(x0, x1, z0, z1)
}

function buildFront(k) {
  shell(k, WEST.x0, WEST.x1, F, SLIT.z1)
  shell(k, MID.x0, MID.x1, F, SLIT.z1)
  // The plain tower on the east: solid, taller, pink-capped; a wall as tall carries on past the courtyard's east side.
  const eastBlock = (x0, x1, z0, z1) => {
    k.voxSpan(x0, x1, z0, z1, { y0: LAVA_Y, y1: EAST.top, side: tex.purple, top: tex.pink, cell: 2.5, cast: false })
    k.voxSpan(x0 - 0.3, x1 + 0.3, z0 + 0.3, z1 - 0.3, { y0: EAST.top - 1, y1: EAST.top, side: tex.pink, cell: 1, collide: false, cast: false })
  }
  eastBlock(EAST.x0, EAST.x1, F, COURT.z0)
  eastBlock(COURT.x1, COURT.x1 + WALL, COURT.z0, BACK_Z)

  // The slit: magenta-lined, lava between two thin pink ledges at walkway height.
  const T = 0.08 // m lining thickness
  const lining = (x0, x1, z0, z1) => k.voxSpan(x0, x1, z0, z1, { y0: LAVA_Y, y1: TOP - 1, side: tex.magenta, cell: 1.5, collide: false, cast: false })
  lining(SLIT.x0, SLIT.x0 + T, F - EDGE, SLIT.z1)
  lining(SLIT.x1 - T, SLIT.x1, F - EDGE, SLIT.z1)
  // ...and the courtyard faces of the two buildings behind it.
  lining(COURT.x0 + EDGE, SLIT.x0 - EDGE, COURT.z0, COURT.z0 - T)
  lining(SLIT.x1 + EDGE, COURT.x1 - EDGE, COURT.z0, COURT.z0 - T)
  lava(k, SLIT.x0, SLIT.x1, F, SLIT.z1)
  for (const [x0, x1] of [[SLIT.x0, SLIT.x0 + SLIT.ledge], [SLIT.x1 - SLIT.ledge, SLIT.x1]]) {
    k.voxSpan(x0, x1, F, SLIT.z1, { y0: FLOOR - 0.5, y1: FLOOR, side: tex.pinkLedge, cell: 0.5, cast: false })
  }
  k.voxSpan(SLIT.x1 - 0.7, SLIT.x1, F - 4, F - 6.5, { y0: FLOOR + 5, y1: FLOOR + 5.6, side: tex.pinkHot, cell: 0.6, collide: false, cast: false })

  // Magenta bands with yellow arrows pointing at the slit, gold lines up the fronts.
  const band = k.std('#d63fc4', { emissive: '#a01a90', emissiveIntensity: 0.3, roughness: 0.5 })
  for (const [[x0, x1], dir] of [[BAND.left, -1], [BAND.right, 1]]) {
    k.mesh(new BoxGeometry(x1 - x0, BAND.h, 0.4), band, (x0 + x1) / 2, BAND.y, F + 0.2, { cast: false })
    const ax = dir < 0 ? x1 - BAND.arrow : x0 + BAND.arrow // near the slit end
    decal(k, arrowTexture(COL.yellow), ax, BAND.y, F + 0.4, BAND.arrow, BAND.arrow, dir * Math.PI / 2)
  }
  const lineY0 = FLOOR + 2
  const lineH = TOP - 4 - lineY0
  for (const x of GOLD_X) k.mesh(new BoxGeometry(0.4, lineH, 0.3), goldMat(k), x, lineY0 + lineH / 2, F + 0.15, { cast: false })

  buildMerlons(k)
}

let gold = null
const goldMat = (k) => (gold ??= k.std('#ffcf1f', { emissive: '#d99a00', emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.3 }))

// --- Inside: the lava courtyard, the pedestal, the octagon window, the next room ------
// A gold octagon ring around the window: 8 bars, stretched to the window's height.
function octagonFrame(k, x, y, z, depth) {
  const a = WINDOW.w / 2 // inner apothem across
  const t = WINDOW.frame
  const len = 2 * (a + t) * Math.tan(Math.PI / 8) + 0.05
  const ring = new Group()
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4
    const bar = new Mesh(new BoxGeometry(len, t, depth), goldMat(k))
    bar.position.set(Math.cos(ang) * (a + t / 2), Math.sin(ang) * (a + t / 2), 0)
    bar.rotation.z = ang + Math.PI / 2
    bar.castShadow = true
    ring.add(bar)
  }
  ring.position.set(x, y, z)
  ring.scale.y = WINDOW.h / WINDOW.w
  k.g.add(ring)
}

// A yellow arrow on a west-facing wall at x, pointing north.
function arrowOnEastWall(k, x, y, z, s) {
  const m = k.mesh(new PlaneGeometry(s, s), new MeshBasicMaterial({ map: arrowTexture(COL.yellow), transparent: true, depthWrite: false }), x - 0.03, y, z, { cast: false })
  m.rotation.set(0, -Math.PI / 2, Math.PI / 2)
  m.receiveShadow = false
}

// A pink-topped dais: purple body, yellow trim under a pink slab with a pale inlay
// border; optionally a yellow plate on its south face and a dark plinth at the lava.
function dais(k, d, { plate = false, plinth = false } = {}) {
  const { slab, trim } = PEDESTAL
  const dx = (d.x0 + d.x1) / 2
  const dz = (d.z0 + d.z1) / 2
  const dw = d.x1 - d.x0
  const dd = d.z0 - d.z1
  const under = d.top - slab - trim
  if (plinth) k.voxSpan(d.x0 + 0.2, d.x1 - 0.2, d.z0 - 0.2, d.z1 + 0.2, { y0: LAVA_Y, y1: LAVA_Y + 1.6, side: tex.purple, cell: 1, collide: false, cast: false })
  k.voxSpan(d.x0 + 0.5, d.x1 - 0.5, d.z0 - 0.5, d.z1 + 0.5, { y0: LAVA_Y, y1: under, side: tex.purpleMid, cell: 1.5, collide: false, cast: false })
  k.voxSpan(d.x0, d.x1, d.z0, d.z1, { y0: under, y1: d.top - slab, side: voxelYellow(), cell: 0.6, collide: false, cast: false })
  k.voxSpan(d.x0, d.x1, d.z0, d.z1, { y0: d.top - slab, y1: d.top, side: tex.pink, cell: 1, collide: false, cast: false })
  k.addCollider(dx, dz, dw, dd, d.top)
  const inlay = k.std(COL.pinkLight, { emissive: COL.pinkLight, emissiveIntensity: 0.25 })
  const inset = Math.min(0.6, dw / 8)
  for (const s of [-1, 1]) {
    k.mesh(new BoxGeometry(dw - 2 * inset, 0.04, 0.35), inlay, dx, d.top + 0.02, dz + s * (dd / 2 - inset), { cast: false })
    k.mesh(new BoxGeometry(0.35, 0.04, dd - 2 * inset), inlay, dx + s * (dw / 2 - inset), d.top + 0.02, dz, { cast: false })
  }
  if (plate) k.mesh(new BoxGeometry(3.6, 1.1, 0.15), k.std(COL.yellow, { emissive: '#d99a00', emissiveIntensity: 0.3 }), dx + 1.2, under - 0.6, d.z0 - 0.42, { cast: false })
}

function buildInside(k) {
  // Walls around the courtyard and the next room: dark purple west, the tall tower east.
  k.voxSpan(WEST.x0, COURT.x0, COURT.z0, BACK_Z, { y0: LAVA_Y, y1: TOP, side: tex.purple, top: tex.purpleMid, cell: 2.5, cast: false })
  k.voxSpan(COURT.x0, COURT.x1, ROOM2.z1, BACK_Z, { y0: LAVA_Y, y1: TOP, side: tex.purple, top: tex.purpleMid, cell: 2.5, cast: false })
  k.voxSpan(COURT.x0 - 1.2, COURT.x0 + 0.3, COURT.z0, BACK_Z, { y0: TOP - 0.6, y1: TOP + 0.3, side: tex.pink, cell: 1, collide: false, cast: false })
  k.voxSpan(COURT.x0, COURT.x1, ROOM2.z1 + 0.3, BACK_Z, { y0: TOP - 0.6, y1: TOP + 0.3, side: tex.pink, cell: 1, collide: false, cast: false })

  // The courtyard: lava floor, hot-pink beam on the west wall.
  lava(k, COURT.x0, COURT.x1, COURT.z0, COURT.z1)
  k.voxSpan(COURT.x0, COURT.x0 + 1.6, PEDESTAL.z0 - 2, PEDESTAL.z0 - 6, { y0: FLOOR + 6, y1: FLOOR + 6.8, side: tex.pinkHot, cell: 0.8 })

  // The pedestal, with a yellow plate on its front and a crystal near its east edge.
  const p = PEDESTAL
  const pz = (p.z0 + p.z1) / 2
  dais(k, p, { plate: true })
  crystal(k, p.x1 - 1.2, p.top, pz - 0.8, 0.45, 1.8, '#ff2f8f', '#c0105a')

  // The east wall: a gold line and a magenta band whose arrow points north at the window.
  const ex = COURT.x1
  k.mesh(new BoxGeometry(0.3, TOP - 3 - FLOOR, 0.4), goldMat(k), ex - 0.15, (TOP - 3 + FLOOR) / 2, COURT.z0 - 2, { cast: false })
  k.mesh(new BoxGeometry(0.4, 2.6, 8), k.std('#d63fc4', { emissive: '#a01a90', emissiveIntensity: 0.3, roughness: 0.5 }), ex - 0.2, FLOOR + 5, pz, { cast: false })
  arrowOnEastWall(k, ex - 0.4, FLOOR + 5, pz - 1.5, 2.2)

  // The north wall, with the octagon window through it and arrows either side pointing at it.
  const wz0 = COURT.z1
  const wz1 = ROOM2.z0
  const hx0 = WINDOW.x - WINDOW.w / 2
  const hx1 = WINDOW.x + WINDOW.w / 2
  const hy1 = WINDOW.y0 + WINDOW.h
  const wall = (x0, x1, y0, y1, top = tex.purpleMid) => k.voxSpan(x0, x1, wz0, wz1, { y0, y1, side: tex.violet, top, cell: 1.5, cast: false })
  wall(COURT.x0, hx0, LAVA_Y, TOP)
  wall(hx1, COURT.x1, LAVA_Y, TOP)
  wall(hx0, hx1, LAVA_Y, WINDOW.y0, tex.pink) // the window sill, pink, continuous with the landing
  wall(hx0, hx1, hy1, TOP)
  const wy = WINDOW.y0 + WINDOW.h / 2
  octagonFrame(k, WINDOW.x, wy, (wz0 + wz1) / 2, WALL + 1.2)
  const off = WINDOW.w / 2 + WINDOW.frame + 1.6
  decal(k, arrowTexture(COL.yellow), WINDOW.x - off, wy, wz0, 1.8, 1.8, -Math.PI / 2)
  decal(k, arrowTexture(COL.yellow), WINDOW.x + off, wy, wz0, 1.8, 1.8, Math.PI / 2)

  return buildChamber(k, hx0, hx1, wy)
}

// --- The lava chamber behind the window: pillar, big landing, bonus ring -----------
function buildChamber(k, hx0, hx1, wy) {
  const r = ROOM2
  lava(k, r.x0, r.x1, r.z0, r.z1)
  // Magenta on the window wall's chamber face; arrows either side point back at the window.
  k.voxSpan(r.x0 + EDGE, hx0, r.z0, r.z0 - 0.08, { y0: LAVA_Y, y1: TOP - 1, side: tex.magenta, cell: 1.5, collide: false, cast: false })
  k.voxSpan(hx1, r.x1 - EDGE, r.z0, r.z0 - 0.08, { y0: LAVA_Y, y1: TOP - 1, side: tex.magenta, cell: 1.5, collide: false, cast: false })
  const off = WINDOW.w / 2 + WINDOW.frame + 1.6
  for (const [x, dir] of [[WINDOW.x - off, 1], [WINDOW.x + off, -1]]) {
    const m = k.mesh(new PlaneGeometry(1.8, 1.8), new MeshBasicMaterial({ map: arrowTexture(COL.yellow), transparent: true, depthWrite: false }), x, wy, r.z0 - 0.12, { cast: false })
    m.rotation.set(0, Math.PI, dir * Math.PI / 2)
    m.receiveShadow = false
  }

  // Brown rock rim where the lava meets the walls.
  const rim = (x0, x1, z0, z1) => k.voxSpan(x0, x1, z0, z1, { y0: LAVA_Y, y1: LAVA_Y + 0.7, side: tex.brown, cell: 0.7, collide: false, cast: false })
  rim(r.x0, r.x0 + 0.9, r.z0, r.z1)
  rim(r.x1 - 0.9, r.x1, r.z0, r.z1)
  rim(r.x0, r.x1, r.z1 + 0.9, r.z1)

  // The east wall: tall recessed panels, pink beams, a pink-capped inner tier.
  const panel = k.std('#1e0a38', { roughness: 0.9 })
  for (let z = r.z0 - 7; z > r.z1 + 4; z -= 8) k.mesh(new BoxGeometry(0.2, 9, 5), panel, r.x1 - 0.1, FLOOR + 3.5, z, { cast: false })
  k.voxSpan(r.x1 - 1.6, r.x1, r.z0 - 10, r.z0 - 13, { y0: FLOOR + 6, y1: FLOOR + 6.8, side: tex.pinkHot, cell: 0.8 })
  k.voxSpan(r.x1 - 1.6, r.x1, r.z0 - 19, r.z0 - 22, { y0: FLOOR + 3.5, y1: FLOOR + 4.3, side: tex.pinkHot, cell: 0.8 })
  k.voxSpan(r.x1 - 2.2, r.x1, r.z0 - 4, r.z1, { y0: FLOOR + 10, y1: FLOOR + 12, side: tex.purpleMid, top: tex.pink, cell: 1.2, cast: false })
  // The west wall and the far wall: pink beams high up.
  k.voxSpan(r.x0, r.x0 + 1.6, r.z0 - 4, r.z0 - 8, { y0: FLOOR + 5, y1: FLOOR + 5.8, side: tex.pinkHot, cell: 0.8 })
  k.voxSpan(r.x0 + 6, r.x0 + 16, r.z1 + 1.6, r.z1, { y0: FLOOR + 9, y1: FLOOR + 9.8, side: tex.pinkHot, cell: 0.8 })

  // The small pillar on a dark plinth, a crystal near its north edge.
  dais(k, PILLAR, { plinth: true })
  crystal(k, PILLAR.x0 + 1.4, PILLAR.top, PILLAR.z1 + 1.2, 0.35, 1.2, '#ff2f8f', '#c0105a')

  // The big landing: a tall hot-pink crystal and a pale one by its west edge.
  dais(k, LANDING)
  crystal(k, LANDING.x0 + 2.2, LANDING.top, LANDING.z0 - 3, 0.8, 2.6, '#ff2f8f', '#c0105a')
  crystal(k, LANDING.x0 + 1.4, LANDING.top, LANDING.z0 - 5, 0.4, 1.3, '#efe8ff', '#b8a8e8')

  // The bonus ring, standing across the jump north off the landing.
  const ring = new Mesh(new TorusGeometry(RING.radius, 0.16, 10, 36), k.std(COL.yellow, { emissive: '#ffb000', emissiveIntensity: 0.6, roughness: 0.3 }))
  ring.position.set(RING.x, RING.y, RING.z)
  k.g.add(ring)
  return { ring, ...buildFinale(k) }
}

// Dark belt with pale stripes for the decorative treadmill.
function stripeTexture() {
  const c = makeCanvas(64, 16)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#1d2433'
  ctx.fillRect(0, 0, 64, 16)
  ctx.fillStyle = '#e8f2ff'
  for (let x = 4; x < 64; x += 16) ctx.fillRect(x, 0, 6, 16)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

// --- The finale: pedestals stepping up, banded towers, the final platform ---------
function buildFinale(k) {
  const r = ROOM2
  // Pedestal with a yellow walk-up block, then the higher pedestal.
  dais(k, STEP1, { plinth: true })
  const b = STEP_BLOCK
  k.voxSpan(b.x0, b.x1, b.z0, b.z1, { y0: STEP1.top, y1: b.top, side: voxelYellow(), cell: 0.5 })
  crystal(k, STEP1.x0 + 1.2, STEP1.top, STEP1.z1 + 1.2, 0.35, 1.2, '#ff2f8f', '#c0105a')
  dais(k, STEP2, { plate: true })
  crystal(k, STEP2.x0 + 1, STEP2.top, STEP2.z1 + 1, 0.35, 1.2, '#ff2f8f', '#c0105a')

  // Banded towers: violet, gold corner lines, pink bands, a flared pink cap with a crystal.
  const band = k.std(COL.pinkHot, { roughness: 0.6 })
  for (const [x0, x1, z0] of TOWERS) {
    const z1 = z0 - 4
    const tx = (x0 + x1) / 2
    const tz = (z0 + z1) / 2
    k.voxSpan(x0, x1, z0, z1, { y0: LAVA_Y, y1: TOWER_TOP, side: tex.violet, top: tex.purpleMid, cell: 1.5, cast: false })
    for (let y = FLOOR + 1; y < TOWER_TOP - 1; y += 3.5) k.mesh(new BoxGeometry(x1 - x0 + 0.3, 0.35, 4.3), band, tx, y, tz, { cast: false })
    for (const cx of [x0, x1]) for (const cz of [z0, z1]) k.mesh(new BoxGeometry(0.25, TOWER_TOP - FLOOR, 0.25), goldMat(k), cx, (TOWER_TOP + FLOOR) / 2, cz, { cast: false })
    k.voxSpan(x0 - 0.6, x1 + 0.6, z0 + 0.6, z1 - 0.6, { y0: TOWER_TOP, y1: TOWER_TOP + 0.8, side: tex.pink, cell: 0.8, cast: false })
    crystal(k, tx, TOWER_TOP + 0.8, tz, 0.5, 1.8, '#ff2f8f', '#c0105a')
  }

  // A gold-framed purple panel on the west wall with a yellow arrow pointing up at it.
  const pz = STEP1.z1
  k.mesh(new BoxGeometry(0.25, 3.8, 4.6), goldMat(k), r.x0 + 0.12, FLOOR + 7, pz, { cast: false })
  k.mesh(new BoxGeometry(0.3, 3, 3.8), k.std('#5a2bd0', { emissive: '#3a12a0', emissiveIntensity: 0.3 }), r.x0 + 0.15, FLOOR + 7, pz, { cast: false })
  const up = k.mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial({ map: arrowTexture(COL.yellow), transparent: true, depthWrite: false }), r.x0 + 0.05, FLOOR + 4, pz, { cast: false })
  up.rotation.y = Math.PI / 2
  up.receiveShadow = false
  // Crystals up on the east wall's tier.
  crystal(k, r.x1 - 1.1, FLOOR + 12, FINALE.z0 - 4, 0.5, 2, '#ff2f8f', '#c0105a')
  crystal(k, r.x1 - 1.1, FLOOR + 12, FINALE.z0 - 6, 0.3, 1.1, '#efe8ff', '#b8a8e8')

  // The final platform: win pad with a trophy, the blue +30 pad, a decorative x1.4 Hair treadmill, a crystal.
  const f = FINALE
  dais(k, f)
  const pad = (z, color, emissive) => {
    k.mesh(new BoxGeometry(WIN_PAD.size + 0.3, 0.08, WIN_PAD.size + 0.3), k.std('#d9a400'), WIN_PAD.x, f.top + 0.04, z, { cast: false })
    k.mesh(new BoxGeometry(WIN_PAD.size, 0.12, WIN_PAD.size), k.std(color, { emissive, emissiveIntensity: 0.45, roughness: 0.4 }), WIN_PAD.x, f.top + 0.06, z, { cast: false })
  }
  pad(WIN_PAD.z, '#ffe11a', '#ffc400')
  pad(WIN_PAD.z - WIN_PAD.size - 1, '#3fe0ff', '#1aa8e0')
  const trophy = new Group()
  const part = (geo, y) => {
    const m = new Mesh(geo, goldMat(k))
    m.position.y = y
    trophy.add(m)
  }
  part(new BoxGeometry(0.55, 0.16, 0.55), 0)
  part(new CylinderGeometry(0.07, 0.1, 0.3, 10), 0.23)
  part(new CylinderGeometry(0.38, 0.16, 0.5, 16), 0.63)
  part(new BoxGeometry(0.95, 0.08, 0.08), 0.68) // handles
  trophy.position.set(WIN_PAD.x, f.top + 1.4, WIN_PAD.z)
  k.g.add(trophy)

  const tx = f.x0 + 5.5
  const tz = f.z1 + 5
  const TREAD = { len: 3.6, w: 2 }
  k.mesh(new BoxGeometry(TREAD.len + 0.4, 0.3, TREAD.w + 0.3), k.std('#7cc4f5', { roughness: 0.5 }), tx, f.top + 0.15, tz)
  k.addCollider(tx, tz, TREAD.len + 0.4, TREAD.w + 0.3, f.top + 0.32)
  const belt = stripeTexture()
  belt.repeat.set(TREAD.len / 1.2, 1)
  k.mesh(new BoxGeometry(TREAD.len, 0.06, TREAD.w - 0.4), new MeshStandardMaterial({ map: belt, roughness: 0.9 }), tx, f.top + 0.32, tz, { cast: false })
  // Its console: a pink post under a chunky yellow cap.
  const cx = tx - TREAD.len / 2 - 0.6
  k.mesh(new BoxGeometry(0.5, 1.3, 0.8), k.std(COL.pinkHot), cx, f.top + 0.65, tz)
  k.mesh(new BoxGeometry(1.2, 0.5, 1.6), k.std(COL.yellow, { emissive: '#d99a00', emissiveIntensity: 0.2 }), cx, f.top + 1.5, tz)
  k.addCollider(cx, tz, 1.2, 1.6, f.top + 1.75)
  crystal(k, f.x0 + 2, f.top, f.z1 + 2, 0.7, 2.2, '#ff2f8f', '#c0105a')
  return { trophy, belt, treadmill: { x: tx, z: tz } }
}

let yellowTex = null
const voxelYellow = () => (yellowTex ??= voxelTexture(COL.yellow, { cells: 4, jitter: 0.04, grid: 0.12 }))

export function buildZone5(scene, addCollider) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)
  textures()

  buildApproach(k)
  buildFront(k)
  const { ring, trophy, belt, treadmill } = buildInside(k)
  label(g, [{ text: `+${ZONE5_WIN} Wins`, size: 0.7, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }], [WIN_PAD.x, FINALE.top + 2.6, WIN_PAD.z], { unit: 1.4 })
  label(g, [{ text: '+30 Wins', size: 0.7, fill: ['#d6fbff', '#3fd8ff'], stroke: '#0a3a5a' }], [WIN_PAD.x, FINALE.top + 0.9, WIN_PAD.z - WIN_PAD.size - 1], { unit: 1.4 })
  label(g, [
    { text: '[x2 Boost]', size: 0.35, fill: '#ff5a5a', stroke: '#3a0a0a' },
    { text: 'x1.4 Hair', size: 0.6, fill: ['#d6fbff', '#5fd8ff'], stroke: '#0a3a5a' },
  ], [treadmill.x, FINALE.top + 2.6, treadmill.z], { unit: 1.2 })
  label(g, [{ text: `🏆 +${ZONE5_BONUS} Win`, size: 0.5, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }], [RING.x + RING.radius + 1, RING.y, RING.z], { unit: 1.2 })

  label(g, [
    { text: 'RECOMMENDED', size: 0.45, fill: ['#ffe27a', '#ffb000'], stroke: '#4a2a00' },
    { text: 'LEVEL 48', size: 1, fill: ['#ffffff', '#e8dcff'], stroke: '#2a0a4a' },
  ], [7.5, FLOOR + 3.2, F + 3], { unit: 2.2 })

  const inLava = (p) =>
    (p.x > CHANNEL.x0 && p.x < CHANNEL.x1 && p.z < ZONE5_Z0 && p.z > SLIT.z1) ||
    (p.x > COURT.x0 && p.x < COURT.x1 && p.z <= COURT.z0 && p.z > ROOM2.z1)
  let bonus = false
  let won = false
  return {
    // From the finish platform's north edge to the back of the palace.
    contains: (p) => p.z < ZONE5_Z0 && p.z > BACK_Z && p.x > WEST.x0 && p.x < COURT.x1 + WALL,
    // Returns 'burned' (lava), 'fell' (off the open east side of the plateau), 'bonus' (through the ring) or 'finish' (the win pad).
    update(dt, time, p) {
      ring.position.y = RING.y + Math.sin(time * 2) * 0.15
      trophy.rotation.y = time * 1.5
      trophy.position.y = FINALE.top + 1.4 + Math.sin(time * 2) * 0.1
      belt.offset.x = -time * 0.6
      const onPad = Math.abs(p.x - WIN_PAD.x) < WIN_PAD.size / 2 && Math.abs(p.z - WIN_PAD.z) < WIN_PAD.size / 2
      if (!won && onPad && p.y >= FINALE.top - 0.05) {
        won = true
        return 'finish'
      }
      if (!bonus && Math.abs(p.z - RING.z) < 0.8 && Math.hypot(p.x - RING.x, p.y + 0.9 - ring.position.y) < RING.radius) {
        bonus = true
        return 'bonus'
      }
      if (inLava(p) && p.y < LAVA_Y + 0.15) return 'burned'
      if (p.z < ZONE5_Z0 && p.z > BACK_Z && p.x > PLATEAU.x0 && p.y < LAVA_Y - 2) return 'fell'
      return null
    },
    reset() {
      bonus = false
      won = false
    },
  }
}
