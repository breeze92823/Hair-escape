// Zone 6: TEAL CITADEL. Through an opening in the back wall of Zone 5's lava
// chamber, a pale bridge leads onto a cream start platform with two lantern
// posts (dark post, glowing cyan lantern, flared yellow cap), under the
// "RECOMMENDED / LEVEL 52" sign. The whole zone is a walled pit of glowing teal
// goo between tall dark-teal walls with mint caps. Hop three lantern caps (the
// same design as the posts) to the court at the foot of two towers; a
// gold-framed blue hex climbing panel with a yellow up arrow on the ledge block
// in front of each tower lifts you (hold any move key against it, like Zone 4's
// blue panels) onto the ledge between them. A +1 Win ring stands on the ledge
// just west of the gold-rimmed cyan octagon window in the navy wall, which leads into the
// hall behind (a tall banded pillar on its west side). There, two more caps lead
// to the foot of the summit block, whose own climbing panels take you up to its
// wide cream front: the win pad (the zone's wins), the treadmill, and a navy
// corridor narrowing to the next zone's board between orange lanterns, over the
// doorway into Zone 7. Falling into the goo puts
// you back on the start platform. Procedural like Zones 2-5 (voxel canvas
// textures, boxes).
//
// Built at the same scale as Zone 5 (1.8 m player): hops of 2.5-3.5 m with up
// to 0.5 m rise, an 8 m climb to the ledge and a 9 m climb to the summit.
import { BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, TorusGeometry } from 'three'
import { kit, voxelTexture } from './lavaPath.js'
import { arrowTexture, decal } from './zone4.js'
import { ZONE5_EXIT } from './zone5.js'
import { label } from './lobby/labels.js'
import { buildTreadmill } from './lobby/treadmill.js'
import { makeCanvas } from './lobby/paint.js'

export const ZONE6_NAME = 'TEAL CITADEL'
export const ZONE6_BONUS = 1 // wins for walking through the ring on the tower ledge
export const ZONE6_WIN = 30 // wins for the pad on the summit
export const ZONE6_Z0 = ZONE5_EXIT.z1 // the entrance edge (the north face of Zone 5's back wall)

const CX = (ZONE5_EXIT.x0 + ZONE5_EXIT.x1) / 2 // the zone's centre line, in line with Zone 5's final platform
const FLOOR = ZONE5_EXIT.top // the start platform, flush with Zone 5's final platform
const GOO_Y = 21 // the goo surface, level with Zone 5's lava
const WALLS = { x0: CX - 20, x1: CX + 20, thick: 4, top: FLOOR + 26 } // outer teal walls (inner faces)
const START = { x0: CX - 12, x1: CX + 12, z0: ZONE6_Z0, z1: ZONE6_Z0 - 18, top: FLOOR } // cream start platform
const CAP = 4 // m, a lantern cap's walkable width
const HOPS = [[CX - 3, START.z1 - 5.5, FLOOR + 0.5], [CX + 3, START.z1 - 12, FLOOR + 1], [CX - 3, START.z1 - 18.5, FLOOR + 1.5]] // lantern caps across the goo (x, z, top)
const COURT = { x0: CX - 12, x1: CX + 12, z0: START.z1 - 23, z1: START.z1 - 35, top: FLOOR + 2 } // the court at the towers' foot
const WIN_Y = COURT.top + 8 // the ledge between the towers and the window sill
const LEDGE = { x0: CX - 11, x1: CX + 11, z0: COURT.z1, z1: COURT.z1 - 3 } // block in front of the towers, climbing panels on its south face
const TOWER = { w: 8, z0: LEDGE.z1, z1: LEDGE.z1 - 9, top: FLOOR + 30 } // towers either side of the window wall
const WINDOW = { w: 4, h: 5, frame: 0.8, wall: 3 } // octagon opening through the wall between the towers
const PANEL = { w: 4, xs: [CX - 7, CX + 7] } // the two tower climbing panels (centres)
const RING = { x: CX - 4.6, y: WIN_Y + 1.7, z: (LEDGE.z0 + LEDGE.z1) / 2, radius: 1.3, reach: 1.3 } // bonus ring standing mid-ledge, just west of the window; reach: m either side of its plane that count
const LANDING = { x0: CX - 3, x1: CX + 3, z0: LEDGE.z1 - WINDOW.wall, z1: LEDGE.z1 - WINDOW.wall - 4, top: WIN_Y } // just inside the window
const HALL_HOPS = [[CX, LANDING.z1 - 5, WIN_Y + 0.5], [CX - 4, LANDING.z1 - 11, WIN_Y + 1]] // caps across the hall's goo
const FOOT = { x0: CX - 8, x1: CX + 8, z0: LANDING.z1 - 15, z1: LANDING.z1 - 17.5, top: WIN_Y + 1 } // ledge at the summit's foot
const SUMMIT = { x0: CX - 10, x1: CX + 10, z0: FOOT.z1, z1: FOOT.z1 - 14.5, top: WIN_Y + 10 } // the summit block, its panels on the south face
const SUMMIT_PANELS = [CX - 4, CX + 4]
const BACK_Z = SUMMIT.z1 - WALLS.thick // the zone's north face
const WIN_PAD = { x: CX - 4.5, z: SUMMIT.z0 - 7.5, size: 3.6 } // yellow win pad, west of centre; the blue one is north of it
const TREAD = { len: 4.8, w: 2.4, mult: 1.6 } // the summit's x1.6 Hair treadmill (m), east of centre
const CORRIDOR = { half: 6.5, z0: SUMMIT.z0 - 11, top: SUMMIT.top + 9 } // navy walls narrowing the summit to the next zone's board
const PILLAR = { x0: CX - 10, x1: CX - 7, z0: LANDING.z1 - 6.5, z1: LANDING.z1 - 9.5, top: WIN_Y + 15 } // tall banded pillar in the hall
const DOOR = { half: 2, h: 3.4, band: 0.4 } // the doorway under the next zone's board (m), red band over it
const BOARD = { size: 5.2, y: SUMMIT.top + DOOR.h + DOOR.band + 2.6 } // the next zone's board, sitting on the red band

// The doorway through the back wall, under the next zone's board, where Zone 7's hall carries on north.
export const ZONE6_EXIT = { x0: CX - DOOR.half, x1: CX + DOOR.half, z0: SUMMIT.z1, z1: BACK_Z, top: SUMMIT.top }

// Where a fall puts you: the start platform, facing the towers.
export const ZONE6_SPAWN = { x: CX, y: FLOOR + 0.1, z: ZONE6_Z0 - 4 }

const COL = {
  navy: '#0b2238',
  tealDark: '#0e3349',
  teal: '#137288',
  tealLight: '#22a3b4',
  mint: '#c6f3e2',
  cream: '#f2f5dc',
  cyan: '#3ff0ff',
  yellow: '#ffd21a',
  post: '#16222e',
}

const tex = {}
function textures() {
  tex.navy = voxelTexture(COL.navy, { cells: 4, jitter: 0.06, grid: 0.2 })
  tex.tealDark = voxelTexture(COL.tealDark, { cells: 4, jitter: 0.08, grid: 0.25 })
  tex.teal = voxelTexture(COL.teal, { cells: 4, jitter: 0.07, grid: 0.2 })
  tex.tealLight = voxelTexture(COL.tealLight, { cells: 4, jitter: 0.06, grid: 0.18 })
  tex.mint = voxelTexture(COL.mint, { cells: 4, jitter: 0.04, grid: 0.1 })
  tex.cream = voxelTexture(COL.cream, { cells: 4, jitter: 0.03, grid: 0.08 })
  tex.yellow = voxelTexture(COL.yellow, { cells: 4, jitter: 0.04, grid: 0.12 })
  tex.post = voxelTexture(COL.post, { cells: 4, jitter: 0.06, grid: 0.2 })
}

// Glowing teal goo: dark teal with bright cyan blobs, tiled and drifting.
function gooTexture() {
  const c = makeCanvas(64)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#2b4c58'
  ctx.fillRect(0, 0, 64, 64)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 46; i++) {
    ctx.fillStyle = i % 3 ? '#356574' : '#4f95a3'
    const s = 3 + rnd() * 7
    ctx.fillRect(rnd() * 64, rnd() * 64, s, s * (0.6 + rnd() * 0.6))
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

// Light-blue hex grid for the climbing panels.
export function hexTexture() {
  const c = makeCanvas(64)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#4c66d8'
  ctx.fillRect(0, 0, 64, 64)
  ctx.strokeStyle = '#7d95f0'
  ctx.lineWidth = 2
  const r = 8
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const cx = col * r * 1.5
      const cy = row * r * Math.sqrt(3) + (col % 2) * r * Math.sqrt(3) / 2
      ctx.beginPath()
      for (let i = 0; i < 6; i++) ctx.lineTo(cx + r * Math.cos(i * Math.PI / 3), cy + r * Math.sin(i * Math.PI / 3))
      ctx.closePath()
      ctx.stroke()
    }
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

let mats = null
const material = (k) => (mats ??= {
  glow: k.std(COL.cyan, { emissive: '#18c8d8', emissiveIntensity: 0.8, roughness: 0.3 }),
  gold: k.std('#ffcf1f', { emissive: '#d99a00', emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.3 }),
  panel: new MeshStandardMaterial({ map: hexTexture(), emissive: '#1a2a90', emissiveIntensity: 0.25, roughness: 0.6 }),
  orange: k.std('#ff7a1a', { emissive: '#e04a00', emissiveIntensity: 0.8, roughness: 0.3 }),
  crystal: k.std('#5ff2ff', { emissive: '#1ab8d0', emissiveIntensity: 0.5, roughness: 0.25 }),
})

// A lantern post: dark post from `base`, glowing cyan lantern, flared yellow cap
// whose top (`top`) is walkable. `size` is the cap's width.
function lantern(k, x, z, top, base, size = CAP, glow = material(k).glow) {
  const m = material(k)
  k.voxSpan(x - 0.7, x + 0.7, z + 0.7, z - 0.7, { y0: base, y1: top - 1.9, side: tex.post, cell: 0.7, collide: false, cast: false })
  k.mesh(new BoxGeometry(size * 0.6, 1.4, size * 0.6), glow, x, top - 1.2, z, { cast: false })
  k.voxSpan(x - size / 2, x + size / 2, z + size / 2, z - size / 2, { y0: top - 0.5, y1: top - 0.2, side: tex.yellow, cell: 0.5, collide: false, cast: false })
  k.voxSpan(x - size / 2 + 0.4, x + size / 2 - 0.4, z + size / 2 - 0.4, z - size / 2 + 0.4, { y0: top - 0.2, y1: top, side: tex.yellow, cell: 0.5, collide: false, cast: false })
  k.addCollider(x, z, size - 0.4, size - 0.4, top, 0, base)
}

// A cream-topped block on a teal body (the walkable platforms).
function slab(k, x0, x1, z0, z1, top, side = tex.teal) {
  k.voxSpan(x0, x1, z0, z1, { y1: top - 0.6, side, cell: 2, collide: false, cast: false })
  k.voxSpan(x0, x1, z0, z1, { y0: top - 0.6, y1: top, side: tex.mint, top: tex.cream, cell: 1, collide: false, cast: false })
  k.addCollider((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z0 - z1, top)
}

// A gold-framed purple climbing panel on a south face at z, from y0 to y1, with a yellow up arrow under it.
function climbPanel(k, x, z, y0, y1) {
  const m = material(k)
  const h = y1 - y0
  k.mesh(new BoxGeometry(PANEL.w + 0.6, h + 0.3, 0.2), m.gold, x, y0 + h / 2, z + 0.1, { cast: false })
  k.mesh(new BoxGeometry(PANEL.w, h - 0.3, 0.3), m.panel, x, y0 + h / 2, z + 0.15, { cast: false })
  decal(k, arrowTexture(COL.yellow), x, y0 - 1, z + 0.02, 1.8, 1.8)
}

// A mint flared cap with a cyan crystal spire, on a tower top.
function crown(k, x0, x1, z0, z1, y) {
  const m = material(k)
  k.voxSpan(x0 - 0.8, x1 + 0.8, z0 + 0.8, z1 - 0.8, { y0: y, y1: y + 0.9, side: tex.mint, cell: 1, collide: false, cast: false })
  k.voxSpan(x0 - 0.2, x1 + 0.2, z0 + 0.2, z1 - 0.2, { y0: y + 0.9, y1: y + 1.4, side: tex.yellow, top: tex.mint, cell: 1, collide: false, cast: false })
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  k.mesh(new CylinderGeometry(0.6, 0.6, 2.4, 6), m.crystal, cx, y + 2.6, cz, { cast: false })
  k.mesh(new ConeGeometry(0.6, 1.4, 6), m.crystal, cx, y + 4.5, cz, { cast: false })
}

// --- The shell: goo pit, outer walls with pilasters, the entry bridge ---------------
function buildShell(k) {
  const w = WALLS
  // The goo pit under everything, and the goo surface.
  k.voxSpan(w.x0, w.x1, ZONE6_Z0, BACK_Z, { y1: GOO_Y, side: tex.tealDark, cell: 3, cast: false })
  const goo = gooTexture()
  goo.repeat.set((w.x1 - w.x0) / 8, (ZONE6_Z0 - BACK_Z) / 8)
  const plane = k.mesh(new PlaneGeometry(w.x1 - w.x0, ZONE6_Z0 - BACK_Z), new MeshBasicMaterial({ map: goo, toneMapped: false }), CX, GOO_Y + 0.03, (ZONE6_Z0 + BACK_Z) / 2, { cast: false })
  plane.rotation.x = -Math.PI / 2
  plane.receiveShadow = false

  // Outer walls (west, east, north), and the strip east of Zone 5's back wall, mint-capped.
  const wall = (x0, x1, z0, z1) => {
    k.voxSpan(x0, x1, z0, z1, { y1: w.top, side: tex.navy, top: tex.teal, cell: 3, cast: false })
    k.voxSpan(x0 - 0.4, x1 + 0.4, z0 + 0.4, z1 - 0.4, { y0: w.top, y1: w.top + 0.8, side: tex.mint, cell: 1, collide: false, cast: false })
  }
  const z0 = ZONE6_Z0 + 3 // overlaps Zone 5's back wall
  wall(w.x0 - w.thick, w.x0, z0, BACK_Z)
  wall(w.x1, w.x1 + w.thick, z0, BACK_Z)
  // The back wall, raised behind the next zone's board, with the doorway under it.
  const c = CORRIDOR
  wall(w.x0 - w.thick, CX - c.half, BACK_Z + w.thick, BACK_Z)
  wall(CX + c.half, w.x1 + w.thick, BACK_Z + w.thick, BACK_Z)
  const back = (x0, x1, y0, y1) => k.voxSpan(x0, x1, BACK_Z + w.thick, BACK_Z, { y0, y1, side: tex.navy, cell: 3, cast: false })
  back(CX - c.half, CX - DOOR.half, 0, c.top)
  back(CX + DOOR.half, CX + c.half, 0, c.top)
  back(CX - DOOR.half, CX + DOOR.half, 0, SUMMIT.top)
  back(CX - DOOR.half, CX + DOOR.half, SUMMIT.top + DOOR.h, c.top)
  wall(ZONE5_EXIT.x1 + 5, w.x1, z0, ZONE6_Z0) // past Zone 5's east wall

  // Stepped pilasters along the side walls, mint-capped, at two heights.
  let i = 0
  for (let z = ZONE6_Z0 - 8; z > BACK_Z + 8; z -= 12, i++) {
    const top = i % 2 ? w.top - 6 : w.top - 12
    for (const [x0, x1] of [[w.x0, w.x0 + 2], [w.x1 - 2, w.x1]]) {
      k.voxSpan(x0, x1, z + 2, z - 2, { y0: GOO_Y, y1: top, side: tex.teal, cell: 2, cast: false })
      k.voxSpan(x0 - 0.2, x1 + 0.2, z + 2.3, z - 2.3, { y0: top, y1: top + 0.6, side: tex.mint, cell: 1, collide: false, cast: false })
    }
  }
  // Cyan crystal spires along the wall tops.
  const m = material(k)
  for (let z = ZONE6_Z0 - 14; z > BACK_Z; z -= 22) {
    for (const x of [w.x0 - 2, w.x1 + 2]) k.mesh(new ConeGeometry(0.9, 4.5, 6), m.crystal, x, w.top + 3, z, { cast: false })
  }

  // The bridge from Zone 5's final platform through its back wall.
  const e = ZONE5_EXIT
  slab(k, e.x0, e.x1, e.z0, ZONE6_Z0, FLOOR, tex.tealDark)
  return goo
}

// --- The approach: start platform, lantern caps, the court ------------------------
function buildApproach(k) {
  slab(k, START.x0, START.x1, START.z0, START.z1, START.top)
  for (const s of [-1, 1]) lantern(k, CX + s * 9, START.z1 + 6, FLOOR + 3.6, FLOOR, 3.2)
  // Cyan crystal clusters along the start platform's edges.
  const m = material(k)
  for (const [x, z, h] of [[START.x0 + 1.2, START.z1 + 3, 3.2], [START.x0 + 2.4, START.z1 + 1.6, 2], [START.x1 - 1.4, START.z0 - 6, 2.6]]) {
    const c = k.mesh(new ConeGeometry(0.8, h, 6), m.crystal, x, FLOOR + h / 2, z, { cast: false })
    c.rotation.z = 0.15
  }
  for (const [x, z, top] of HOPS) lantern(k, x, z, top, GOO_Y)
  slab(k, COURT.x0, COURT.x1, COURT.z0, COURT.z1, COURT.top)
  for (const s of [-1, 1]) lantern(k, CX + s * 10, COURT.z0 - 2.5, COURT.top + 3.6, COURT.top, 3.2)
}

// --- The towers: ledge block with climbing panels, towers, the octagon window -------
function octagonFrame(k, x, y, z, depth, a = WINDOW.w / 2, t = WINDOW.frame, mat = material(k).glow) {
  const len = 2 * (a + t) * Math.tan(Math.PI / 8) + 0.05
  const ring = new Group()
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4
    const bar = new Mesh(new BoxGeometry(len, t, depth), mat)
    bar.position.set(Math.cos(ang) * (a + t / 2), Math.sin(ang) * (a + t / 2), 0)
    bar.rotation.z = ang + Math.PI / 2
    ring.add(bar)
  }
  ring.position.set(x, y, z)
  ring.scale.y = WINDOW.h / WINDOW.w
  k.g.add(ring)
}

function buildTowers(k) {
  const l = LEDGE
  // The ledge block: teal, mint top, a climbing panel in front of each tower.
  k.voxSpan(l.x0, l.x1, l.z0, l.z1, { y1: WIN_Y, side: tex.teal, top: tex.mint, cell: 1.5, cast: false })
  for (const x of PANEL.xs) climbPanel(k, x, l.z0, COURT.top + 2, WIN_Y)
  k.mesh(new BoxGeometry(l.x1 - l.x0 + 0.4, 0.4, 0.5), material(k).gold, CX, WIN_Y - 0.2, l.z0 + 0.2, { cast: false })

  // The two towers, mint bands, crowns, and arrows pointing at the window.
  const tw = TOWER
  for (const [x0, x1] of [[CX - 3 - tw.w, CX - 3], [CX + 3, CX + 3 + tw.w]]) {
    k.voxSpan(x0, x1, tw.z0, tw.z1, { y1: tw.top, side: tex.teal, top: tex.tealLight, cell: 2, cast: false })
    for (let y = WIN_Y + 7; y < tw.top - 2; y += 6) {
      k.voxSpan(x0 - 0.3, x1 + 0.3, tw.z0 + 0.3, tw.z1 - 0.3, { y0: y, y1: y + 0.5, side: tex.mint, cell: 1, collide: false, cast: false })
      k.voxSpan(x0 - 0.2, x1 + 0.2, tw.z0 + 0.2, tw.z1 - 0.2, { y0: y - 0.15, y1: y, side: tex.yellow, cell: 0.5, collide: false, cast: false })
    }
    crown(k, x0, x1, tw.z0, tw.z1, tw.top)
    // Decorative framed panels higher up, as on the reference towers.
    const px = (x0 + x1) / 2
    k.mesh(new BoxGeometry(3.6, 3.6, 0.2), material(k).gold, px, WIN_Y + 10, tw.z0 + 0.1, { cast: false })
    k.mesh(new BoxGeometry(3, 3, 0.3), material(k).panel, px, WIN_Y + 10, tw.z0 + 0.15, { cast: false })
    decal(k, arrowTexture(COL.yellow), px, WIN_Y + 7.6, tw.z0 + 0.02, 1.4, 1.4)
  }
  decal(k, arrowTexture(COL.yellow), CX - 4.4, WIN_Y + 3.9, tw.z0 + 0.02, 1.4, 1.4, -Math.PI / 2)
  decal(k, arrowTexture(COL.yellow), CX + 4.4, WIN_Y + 3.9, tw.z0 + 0.02, 1.4, 1.4, Math.PI / 2)
  // A small lantern on the ledge just east of the window.
  lantern(k, CX + 4.4, LEDGE.z1 + 1.2, WIN_Y + 1.6, WIN_Y, 1.8)

  // The window wall between the towers with the octagon opening.
  const wz0 = tw.z0
  const wz1 = tw.z0 - WINDOW.wall
  const hx0 = CX - WINDOW.w / 2
  const hx1 = CX + WINDOW.w / 2
  const hy1 = WIN_Y + WINDOW.h
  const part = (x0, x1, y0, y1, top = tex.navy) => k.voxSpan(x0, x1, wz0, wz1, { y0, y1, side: tex.navy, top, cell: 1.5, cast: false })
  part(CX - 3, CX + 3, 0, WIN_Y, tex.mint) // sill, level with the ledge
  part(CX - 3, hx0, WIN_Y, tw.top - 8)
  part(hx1, CX + 3, WIN_Y, tw.top - 8)
  part(hx0, hx1, hy1, tw.top - 8)
  k.voxSpan(CX - 3.4, CX + 3.4, wz0 + 0.4, wz1 - 0.4, { y0: tw.top - 8, y1: tw.top - 7.4, side: tex.mint, cell: 1, collide: false, cast: false })
  octagonFrame(k, CX, WIN_Y + WINDOW.h / 2, (wz0 + wz1) / 2, WINDOW.wall + 0.8)
  octagonFrame(k, CX, WIN_Y + WINDOW.h / 2, wz0 + 0.45, 0.4, WINDOW.w / 2 + WINDOW.frame, 0.35, material(k).gold) // gold rim
  // Teal bands with gold edges across the towers' front, below and above the window.
  for (const y of [WIN_Y - 0.1, WIN_Y + WINDOW.h + 1.4]) {
    k.voxSpan(CX - 11, CX + 11, tw.z0 + 0.25, tw.z0, { y0: y, y1: y + 0.6, side: tex.tealLight, cell: 0.6, collide: false, cast: false })
    for (const e of [y - 0.12, y + 0.6]) k.mesh(new BoxGeometry(22, 0.12, 0.3), material(k).gold, CX, e + 0.06, tw.z0 + 0.15, { cast: false })
  }
  k.mesh(new BoxGeometry(5, 0.4, 1.2), k.std(COL.yellow, { emissive: '#d99a00', emissiveIntensity: 0.3 }), CX, WIN_Y - 0.6, wz0 + 0.6, { cast: false })

  // The bonus ring on the ledge, standing across the walk from the west panel to the window.
  const ring = new Mesh(new TorusGeometry(RING.radius, 0.14, 10, 32), k.std(COL.yellow, { emissive: '#ffb000', emissiveIntensity: 0.6, roughness: 0.3 }))
  ring.position.set(RING.x, RING.y, RING.z) // faces south, flat against the wall
  k.g.add(ring)
  return ring
}

// --- The hall behind the window and the summit -------------------------------------
function buildSummit(k) {
  slab(k, LANDING.x0, LANDING.x1, LANDING.z0, LANDING.z1, LANDING.top)
  for (const [x, z, top] of HALL_HOPS) lantern(k, x, z, top, GOO_Y)
  slab(k, FOOT.x0, FOOT.x1, FOOT.z0, FOOT.z1, FOOT.top)

  // The tall banded pillar on the hall's west side, a framed panel near its top.
  const pl = PILLAR
  const px = (pl.x0 + pl.x1) / 2
  k.voxSpan(pl.x0, pl.x1, pl.z0, pl.z1, { y0: GOO_Y, y1: pl.top, side: tex.teal, top: tex.tealLight, cell: 1.5, cast: false })
  for (let y = WIN_Y; y < pl.top - 3; y += 2.6) {
    k.voxSpan(pl.x0 - 0.25, pl.x1 + 0.25, pl.z0 + 0.25, pl.z1 - 0.25, { y0: y, y1: y + 0.35, side: tex.mint, cell: 0.5, collide: false, cast: false })
    k.voxSpan(pl.x0 - 0.15, pl.x1 + 0.15, pl.z0 + 0.15, pl.z1 - 0.15, { y0: y - 0.12, y1: y, side: tex.yellow, cell: 0.5, collide: false, cast: false })
  }
  k.mesh(new BoxGeometry(2.4, 2.2, 0.2), material(k).gold, px, pl.top - 2, pl.z0 + 0.1, { cast: false })
  k.mesh(new BoxGeometry(1.9, 1.7, 0.3), material(k).panel, px, pl.top - 2, pl.z0 + 0.15, { cast: false })
  decal(k, arrowTexture(COL.yellow), px, pl.top - 4, pl.z0 + 0.02, 1.2, 1.2)
  crown(k, pl.x0, pl.x1, pl.z0, pl.z1, pl.top)

  const s = SUMMIT
  k.voxSpan(s.x0, s.x1, s.z0, s.z1, { y1: s.top - 0.6, side: tex.teal, cell: 2, collide: false, cast: false })
  k.voxSpan(s.x0, s.x1, s.z0, s.z1, { y0: s.top - 0.6, y1: s.top, side: tex.mint, top: tex.cream, cell: 1, collide: false, cast: false })
  k.addCollider(CX, (s.z0 + s.z1) / 2, s.x1 - s.x0, s.z0 - s.z1, s.top)
  for (const x of SUMMIT_PANELS) climbPanel(k, x, s.z0, FOOT.top + 1.8, s.top)
  k.mesh(new BoxGeometry(s.x1 - s.x0 + 0.4, 0.4, 0.5), material(k).gold, CX, s.top - 0.2, s.z0 + 0.2, { cast: false })

  // On top: the win pad with a trophy, the blue pad, an x1.6 Hair treadmill, lanterns.
  const pad = (z, color, emissive) => {
    k.mesh(new BoxGeometry(WIN_PAD.size + 0.3, 0.08, WIN_PAD.size + 0.3), k.std('#d9a400'), WIN_PAD.x, s.top + 0.04, z, { cast: false })
    k.mesh(new BoxGeometry(WIN_PAD.size, 0.12, WIN_PAD.size), k.std(color, { emissive, emissiveIntensity: 0.45, roughness: 0.4 }), WIN_PAD.x, s.top + 0.06, z, { cast: false })
  }
  pad(WIN_PAD.z, '#ffe11a', '#ffc400')
  pad(WIN_PAD.z - WIN_PAD.size - 1, '#3fe0ff', '#1aa8e0')
  const trophy = new Group()
  const part = (geo, y) => {
    const m = new Mesh(geo, material(k).gold)
    m.position.y = y
    trophy.add(m)
  }
  part(new BoxGeometry(0.55, 0.16, 0.55), 0)
  part(new CylinderGeometry(0.07, 0.1, 0.3, 10), 0.23)
  part(new CylinderGeometry(0.38, 0.16, 0.5, 16), 0.63)
  part(new BoxGeometry(0.95, 0.08, 0.08), 0.68) // handles
  trophy.position.set(WIN_PAD.x, s.top + 1.4, WIN_PAD.z)
  k.g.add(trophy)

  // The x1.6 Hair treadmill: runs like the Hub's, console to the north (the corridor).
  const treadmill = buildTreadmill(k.g, k.addCollider, {
    x: CX + 5, z: s.z0 - 6.5, y: s.top, yaw: -Math.PI / 2, length: TREAD.len, width: TREAD.w, theme: 'citadel', mult: TREAD.mult, labelY: 3.9,
    labels: [
      { text: '[x2 Boost]', size: 0.35, fill: '#ff5a5a', stroke: '#3a0a0a' },
      { text: `x${TREAD.mult} Hair`, size: 0.6, fill: ['#d6fbff', '#5fd8ff'], stroke: '#0a3a5a' },
    ],
  })
  // Lantern posts at the front corners.
  for (const sx of [-1, 1]) lantern(k, CX + sx * 8, s.z0 - 3.5, s.top + 3.6, s.top, 3.2)

  // The corridor: navy walls with gold caps under a mint overhang, narrowing to the back.
  const c = CORRIDOR
  for (const [x0, x1] of [[s.x0, CX - c.half], [CX + c.half, s.x1]]) {
    k.voxSpan(x0, x1, c.z0, s.z1, { y0: s.top, y1: c.top, side: tex.navy, top: tex.navy, cell: 2, cast: false })
    k.voxSpan(x0 - 0.3, x1 + 0.3, c.z0 + 0.3, s.z1, { y0: c.top, y1: c.top + 0.5, side: tex.yellow, cell: 0.6, collide: false, cast: false })
    k.voxSpan(x0 - 1, x1 + 1, c.z0 + 1.5, s.z1, { y0: c.top + 0.5, y1: c.top + 1.3, side: tex.mint, top: tex.cream, cell: 1, collide: false, cast: false })
  }
  // The next zone's board on the back wall over the doorway (orange frame, red band), its
  // orange arrow pointing down at it, between two orange lanterns.
  const m = material(k)
  k.mesh(new BoxGeometry(BOARD.size + 0.6, BOARD.size + 0.6, 0.2), m.gold, CX, BOARD.y, s.z1 + 0.1, { cast: false })
  k.mesh(new BoxGeometry(BOARD.size, BOARD.size, 0.3), k.std('#5a2a1e', { roughness: 0.8 }), CX, BOARD.y, s.z1 + 0.15, { cast: false })
  decal(k, arrowTexture('#ff8a1a'), CX, BOARD.y - 1.5, s.z1 + 0.3, 1.5, 1.5, Math.PI)
  for (const sx of [-1, 1]) k.mesh(new BoxGeometry(0.4, DOOR.h, 0.3), m.orange, CX + sx * (DOOR.half + 0.2), s.top + DOOR.h / 2, s.z1 + 0.15, { cast: false })
  k.mesh(new BoxGeometry(DOOR.half * 2 + 1.6, DOOR.band, 0.4), k.std('#ff3d10', { emissive: '#c02000', emissiveIntensity: 0.4 }), CX, s.top + DOOR.h + DOOR.band / 2, s.z1 + 0.2, { cast: false })
  for (const sx of [-1, 1]) lantern(k, CX + sx * 4.2, s.z1 + 1.6, s.top + 2.4, s.top, 1.6, material(k).orange)
  return { trophy, treadmill }
}

export function buildZone6(scene, addCollider) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)
  textures()

  const goo = buildShell(k)
  buildApproach(k)
  const ring = buildTowers(k)
  const { trophy, treadmill } = buildSummit(k)

  label(g, [
    { text: 'RECOMMENDED', size: 0.45, fill: ['#ffe27a', '#ffb000'], stroke: '#4a2a00' },
    { text: 'LEVEL 52', size: 1, fill: '#ffffff', stroke: '#0a2a3a' },
  ], [CX, FLOOR + 6, START.z1 - 2], { unit: 2.2 })
  label(g, [{ text: `🏆 +${ZONE6_BONUS} Win`, size: 0.5, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }], [RING.x, RING.y + RING.radius + 0.6, RING.z], { unit: 1.2 })
  label(g, [{ text: `+${ZONE6_WIN} Wins`, size: 0.7, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }], [WIN_PAD.x, SUMMIT.top + 2.6, WIN_PAD.z], { unit: 1.4 })
  label(g, [{ text: '+50 Wins', size: 0.7, fill: ['#d6fbff', '#3fd8ff'], stroke: '#0a3a5a' }], [WIN_PAD.x, SUMMIT.top + 0.9, WIN_PAD.z - WIN_PAD.size - 1], { unit: 1.4 })
  label(g, [
    { text: 'RECOMMENDED', size: 0.45, fill: ['#ffe27a', '#ffb000'], stroke: '#4a2a00' },
    { text: 'LEVEL 58', size: 1, fill: '#ffffff', stroke: '#2a0a0a' },
  ], [CX, BOARD.y + 0.9, SUMMIT.z1 + 0.6], { unit: 1.7 })

  const inZone = (p) => p.z < ZONE6_Z0 && p.z > BACK_Z && p.x > WALLS.x0 && p.x < WALLS.x1
  let bonus = false
  let won = false
  return {
    treadmills: [treadmill], // main.js runs them with the Hub's
    // From the north face of Zone 5's back wall to the zone's own back wall.
    contains: inZone,
    // True while the player is pressed against a climbing panel (main.js lifts them).
    climbAt(p) {
      const near = (xs, z0, y0, y1) => p.z <= z0 + 0.75 && p.z > z0 - 1 && p.y >= y0 - 0.5 && p.y < y1 && xs.some((x) => Math.abs(p.x - x) < PANEL.w / 2 + 0.3)
      return near(PANEL.xs, LEDGE.z0, COURT.top, WIN_Y) || near(SUMMIT_PANELS, SUMMIT.z0, FOOT.top, SUMMIT.top)
    },
    // Returns 'fell' (the goo), 'bonus' (through the ring) or 'finish' (the win pad).
    update(dt, time, p) {
      goo.offset.y = time * 0.03
      ring.position.y = RING.y + Math.sin(time * 2) * 0.12
      trophy.rotation.y = time * 1.5
      trophy.position.y = SUMMIT.top + 1.4 + Math.sin(time * 2) * 0.1
      treadmill.update(dt, time)
      if (inZone(p) && p.y < GOO_Y + 0.15) return 'fell'
      if (!bonus && Math.abs(p.z - RING.z) < RING.reach && Math.hypot(p.x - RING.x, p.y + 0.9 - ring.position.y) < RING.radius) {
        bonus = true
        return 'bonus'
      }
      const onPad = Math.abs(p.x - WIN_PAD.x) < WIN_PAD.size / 2 && Math.abs(p.z - WIN_PAD.z) < WIN_PAD.size / 2
      if (!won && onPad && p.y >= SUMMIT.top - 0.05) {
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
