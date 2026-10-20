// Zone 7: AMBER HALLS. Through the doorway under Zone 6's "LEVEL 58" board, a
// long open-roofed hall of tall dark-navy walls runs north: brown pillars with
// orange braces up to a brown top beam, blue-framed windows with orange slats,
// and a dark pit under everything. Brown floors (orange arrows pointing on) and
// yellow platforms (orange lanterns on their back corners) alternate across the
// pit, and three gate walls cross the hall: a brown face with a yellow arrow
// pointing down at an orange-framed doorway under a red band. A +1 Win ring
// hangs in front of the second gate. Past the last yellow platform the hall
// opens straight onto Zone 8's pale start platform (zone8.js). Falling into the
// pit puts you back at the entrance. Procedural like Zones 2-6.
//
// Built at the same scale as Zone 6 (1.8 m player): gaps of 3-4.5 m, each
// platform 0.5 m above the floor before it (a running jump reaches ~6.8 m and
// rises ~1.3 m).
import { BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, TorusGeometry } from 'three'
import { kit, voxelTexture } from './lavaPath.js'
import { arrowTexture } from './zone4.js'
import { ZONE6_EXIT } from './zone6.js'
import { label } from './lobby/labels.js'
import { makeCanvas } from './lobby/paint.js'

export const ZONE7_NAME = 'AMBER HALLS'
export const ZONE7_BONUS = 1 // wins for the ring in front of the second gate
export const ZONE7_Z0 = ZONE6_EXIT.z1 // the entrance edge (the north face of Zone 6's back wall)

const CX = (ZONE6_EXIT.x0 + ZONE6_EXIT.x1) / 2 // the hall's centre line, in line with Zone 6's doorway
const FLOOR = ZONE6_EXIT.top // the brown floors, flush with Zone 6's summit
const STEP = 0.5 // m, each yellow platform's rise over the floor before it
const HALF = 6 // m, half the hall's inner width
const WALL = { thick: 3, top: FLOOR + 18 } // side, gate and back walls
const PIT_Y = FLOOR - 14 // the pit's floor
const FALL_Y = FLOOR - 4 // feet below this = respawn
const at = (d) => ZONE7_Z0 - d // m north of the entrance -> world z

// The course, as distances north of the entrance (d0 near, d1 far); the gaps between are pit.
const FLOORS = [[0, 6], [19.5, 31], [44.5, 60], [74, 85]] // brown floors, top FLOOR
const PLATFORMS = [[10, 16], [35, 41], [64.5, 70.5], [89, 95]] // yellow platforms, top FLOOR + STEP, 8 m wide
const PLAT_HALF = 4
const ARROWS = [[3, 2.6], [29, 2.6], [56, 4], [83.5, 2.6]] // orange floor arrows pointing on (d, size)
const GATE = { ds: [23, 48, 77.5], depth: 4, half: 4.5, h: 6.5, frame: 0.6, band: 1 } // gate walls (south face d), their doorway and red band
const STATIONS = [8, 33, 62.5, 87] // pillar pairs with a top beam and braces, over the gaps
const WINDOWS = [13, 38, 67.5, 92] // window pairs on the side walls, over the platforms
const END_D = 97 // the hall's north end, 2 m past the last platform, where Zone 8 starts
const RING = { x: CX, y: FLOOR + 1.7, z: at(46.2), radius: 1.3, reach: 1.3 } // bonus ring in front of the second gate; reach: m either side of its plane that count

// Where Zone 8 carries on: the hall's north end, its inner width and the last platform's top.
export const ZONE7_EXIT = { x0: CX - HALF, x1: CX + HALF, z: at(END_D), top: FLOOR + STEP }

// Where a fall puts you: the first floor, facing the hall.
export const ZONE7_SPAWN = { x: CX, y: FLOOR + 0.1, z: at(2) }

const COL = {
  navy: '#1b2547',
  navyDark: '#10162c',
  brown: '#7a3a24',
  orange: '#ff8a1a',
  red: '#ff3d10',
  yellow: '#ffc21f',
  yellowPale: '#ffe27a',
  post: '#1a1a24',
}

const tex = {}
function textures() {
  tex.navy = voxelTexture(COL.navy, { cells: 4, jitter: 0.06, grid: 0.22 })
  tex.navyDark = voxelTexture(COL.navyDark, { cells: 4, jitter: 0.08, grid: 0.25 })
  tex.brown = voxelTexture(COL.brown, { cells: 4, jitter: 0.06, grid: 0.2 })
  tex.orange = voxelTexture(COL.orange, { cells: 4, jitter: 0.05, grid: 0.14 })
  tex.yellow = voxelTexture(COL.yellow, { cells: 4, jitter: 0.04, grid: 0.12 })
  tex.yellowPale = voxelTexture(COL.yellowPale, { cells: 4, jitter: 0.03, grid: 0.08 })
}

// Solid yellow triangle pointing down, dark outline (the gate faces' arrows).
function triangleTexture() {
  const c = makeCanvas(64)
  const ctx = c.getContext('2d')
  ctx.beginPath()
  ctx.moveTo(4, 6)
  ctx.lineTo(60, 6)
  ctx.lineTo(32, 58)
  ctx.closePath()
  ctx.fillStyle = COL.yellow
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(90,40,0,0.6)'
  ctx.stroke()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

// A blue-framed window with four orange slats on a dark inside.
function windowTexture() {
  const c = makeCanvas(64, 96)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#2c4aa0'
  ctx.fillRect(0, 0, 64, 96)
  ctx.fillStyle = '#0d1430'
  ctx.fillRect(7, 7, 50, 82)
  ctx.fillStyle = COL.orange
  for (let i = 0; i < 4; i++) ctx.fillRect(11 + i * 12, 11, 7, 74)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  for (let i = 0; i < 4; i++) ctx.fillRect(11 + i * 12, 11, 2, 74)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

let mats = null
const material = (k) => (mats ??= {
  orange: k.std(COL.orange, { emissive: '#e05a00', emissiveIntensity: 0.35, roughness: 0.4 }),
  red: k.std(COL.red, { emissive: '#c02000', emissiveIntensity: 0.4, roughness: 0.4 }),
  lantern: k.std('#ff5a1a', { emissive: '#ff3a00', emissiveIntensity: 0.8, roughness: 0.3 }),
  post: k.std(COL.post, { roughness: 0.8 }),
  gold: k.std('#ffcf1f', { emissive: '#d99a00', emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.3 }),
  triangle: new MeshBasicMaterial({ map: triangleTexture(), transparent: true, depthWrite: false }),
  window: new MeshBasicMaterial({ map: windowTexture() }),
  arrow: new MeshBasicMaterial({ map: arrowTexture(COL.orange), transparent: true, depthWrite: false }),
})

// Shared lantern geometry (one set for every lantern; `s` scales the mesh).
let lanternGeo = null
// An orange lantern: dark post, glowing red-orange lantern, flared orange-and-yellow cap.
// Stands on `base`; `s` scales it (1 = ~3 m tall).
function lantern(k, x, z, base, s = 1) {
  const m = material(k)
  lanternGeo ??= {
    post: new BoxGeometry(0.5, 1.6, 0.5),
    lamp: new BoxGeometry(1.1, 0.9, 1.1),
    flare: new BoxGeometry(1.7, 0.35, 1.7),
    cap: new BoxGeometry(1.2, 0.3, 1.2),
  }
  const part = (geo, mat, y) => k.mesh(geo, mat, x, base + y * s, z, { cast: false }).scale.setScalar(s)
  part(lanternGeo.post, m.post, 0.8)
  part(lanternGeo.lamp, m.lantern, 2.05)
  part(lanternGeo.flare, m.orange, 2.67)
  part(lanternGeo.cap, material(k).gold, 2.99)
  k.addCollider(x, z, 0.9 * s, 0.9 * s, base + 3.1 * s, 0, base)
}

// A flat decal lying on a floor at height y, pointing north.
function floorDecal(k, mat, x, y, z, size) {
  const m = k.mesh(new PlaneGeometry(size, size), mat, x, y + 0.02, z, { cast: false })
  m.rotation.x = -Math.PI / 2
  m.receiveShadow = false
}

// --- The shell: pit, side walls with pillars, beams and windows -----------------
function buildShell(k) {
  const m = material(k)
  const z0 = ZONE7_Z0
  const z1 = at(END_D)
  // The pit under the course.
  k.voxSpan(CX - HALF, CX + HALF, z0, z1, { y1: PIT_Y, side: tex.navyDark, cell: 3, cast: false })
  // Side walls, orange-capped.
  for (const [x0, x1] of [[CX - HALF - WALL.thick, CX - HALF], [CX + HALF, CX + HALF + WALL.thick]]) {
    k.voxSpan(x0, x1, z0, z1, { y1: WALL.top, side: tex.navy, top: tex.brown, cell: 3, cast: false })
    k.voxSpan(x0 - 0.3, x1 + 0.3, z0, z1, { y0: WALL.top, y1: WALL.top + 0.6, side: tex.orange, top: tex.brown, cell: 1, collide: false, cast: false })
  }

  // Brown pillars over the gaps, a brown beam across their tops and orange braces in the corners.
  const braceGeo = new BoxGeometry(0.45, 4.2, 0.5)
  for (const d of STATIONS) {
    const z = at(d)
    for (const s of [-1, 1]) {
      const x = CX + s * (HALF - 0.4)
      k.voxSpan(x - 0.4, x + 0.4, z + 0.6, z - 0.6, { y0: PIT_Y, y1: WALL.top, side: tex.brown, cell: 1.2, cast: false })
      const brace = k.mesh(braceGeo, m.orange, CX + s * (HALF - 2.1), WALL.top - 2.6, z, { cast: false })
      brace.rotation.z = s * Math.PI / 4
    }
    k.voxSpan(CX - HALF, CX + HALF, z + 0.6, z - 0.6, { y0: WALL.top - 1.2, y1: WALL.top, side: tex.brown, cell: 1.2, collide: false, cast: false })
  }

  // Blue-framed windows with orange slats, high on both side walls.
  const winGeo = new PlaneGeometry(3, 4.5)
  for (const d of WINDOWS) {
    for (const s of [-1, 1]) {
      const w = k.mesh(winGeo, m.window, CX + s * (HALF - 0.03), FLOOR + 8.5, at(d), { cast: false })
      w.rotation.y = -s * Math.PI / 2
      w.receiveShadow = false
    }
  }
}

// --- The course: brown floors, yellow platforms with lanterns, the gates --------
function buildCourse(k) {
  const m = material(k)
  for (const [d0, d1] of FLOORS) k.voxSpan(CX - HALF, CX + HALF, at(d0), at(d1), { y0: PIT_Y, y1: FLOOR, side: tex.brown, cell: 2, cast: false })
  for (const [d, size] of ARROWS) floorDecal(k, m.arrow, CX, FLOOR, at(d), size)

  for (const [d0, d1] of PLATFORMS) {
    const top = FLOOR + STEP
    const z0 = at(d0)
    const z1 = at(d1)
    k.voxSpan(CX - PLAT_HALF, CX + PLAT_HALF, z0, z1, { y0: PIT_Y, y1: top - 0.6, side: tex.brown, cell: 2, collide: false, cast: false })
    k.voxSpan(CX - PLAT_HALF, CX + PLAT_HALF, z0, z1, { y0: top - 0.6, y1: top, side: tex.yellow, top: tex.yellow, cell: 1, collide: false, cast: false })
    k.voxSpan(CX - PLAT_HALF + 0.3, CX + PLAT_HALF - 0.3, z0 - 0.3, z0 - 1, { y0: top, y1: top + 0.08, side: tex.yellowPale, cell: 0.5, collide: false, cast: false }) // pale lip along the front
    k.addCollider(CX, (z0 + z1) / 2, PLAT_HALF * 2, d1 - d0, top, 0, PIT_Y)
    // Orange trim under the yellow top, and a yellow plate on the front.
    k.mesh(new BoxGeometry(PLAT_HALF * 2 + 0.1, 0.3, 0.1), m.orange, CX, top - 0.75, z0 + 0.05, { cast: false })
    k.voxSpan(CX - 1.6, CX + 1.6, z0 + 0.15, z0, { y0: top - 3.6, y1: top - 1.1, side: tex.yellow, cell: 0.8, collide: false, cast: false })
    for (const s of [-1, 1]) lantern(k, CX + s * (PLAT_HALF - 0.8), z1 + 0.8, top)
  }

  // Gate walls: navy body, a brown south face, an orange-framed doorway under a red
  // band, a navy stripe, and a yellow triangle pointing down at the doorway.
  const g = GATE
  const hx = g.half
  const yd = FLOOR + g.h // the doorway's top
  for (const d of g.ds) {
    const z0 = at(d)
    const z1 = at(d + g.depth)
    const body = (x0, x1, y0) => k.voxSpan(x0, x1, z0, z1, { y0, y1: WALL.top, side: tex.navy, top: tex.brown, cell: 2, cast: false })
    body(CX - HALF, CX - hx, FLOOR)
    body(CX + hx, CX + HALF, FLOOR)
    body(CX - hx, CX + hx, yd)
    const face = (x0, x1, y0) => k.voxSpan(x0, x1, z0 + 0.3, z0, { y0, y1: WALL.top, side: tex.brown, cell: 1.5, collide: false, cast: false })
    face(CX - HALF, CX - hx - g.frame, FLOOR)
    face(CX + hx + g.frame, CX + HALF, FLOOR)
    face(CX - hx - g.frame, CX + hx + g.frame, yd + g.frame)
    for (const s of [-1, 1]) k.voxSpan(CX + s * hx, CX + s * (hx + g.frame), z0 + 0.5, z0, { y0: FLOOR, y1: yd + g.frame, side: tex.orange, cell: 0.6, collide: false, cast: false })
    k.voxSpan(CX - hx, CX + hx, z0 + 0.5, z0, { y0: yd, y1: yd + g.frame, side: tex.orange, cell: 0.6, collide: false, cast: false })
    k.mesh(new BoxGeometry(HALF * 2, g.band, 0.6), m.red, CX, yd + g.frame + g.band / 2, z0 + 0.3, { cast: false })
    k.voxSpan(CX - HALF, CX + HALF, z0 + 0.45, z0, { y0: yd + g.frame + g.band, y1: yd + g.frame + g.band + 0.4, side: tex.navy, cell: 0.4, collide: false, cast: false })
    const tri = k.mesh(new PlaneGeometry(3.4, 3.4), m.triangle, CX, yd + g.frame + g.band + 2.6, z0 + 0.34, { cast: false })
    tri.receiveShadow = false
  }

  // The bonus ring in front of the second gate.
  const ring = new Mesh(new TorusGeometry(RING.radius, 0.14, 10, 32), k.std(COL.yellow, { emissive: '#ffb000', emissiveIntensity: 0.6, roughness: 0.3 }))
  ring.position.set(RING.x, RING.y, RING.z) // faces south, across the walk to the gate
  k.g.add(ring)
  return ring
}

export function buildZone7(scene, addCollider) {
  const g = new Group()
  scene.add(g)
  const k = kit(g, addCollider)
  textures()

  buildShell(k)
  const ring = buildCourse(k)

  label(g, [{ text: `🏆 +${ZONE7_BONUS} Win`, size: 0.5, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }], [RING.x, RING.y + RING.radius + 0.6, RING.z], { unit: 1.2 })

  const inZone = (p) => p.z <= ZONE7_Z0 && p.z > at(END_D) && Math.abs(p.x - CX) < HALF + WALL.thick
  let bonus = false
  return {
    // From the north face of Zone 6's back wall to the hall's north end.
    contains: inZone,
    // Returns 'fell' (the pit) or 'bonus' (through the ring).
    update(dt, time, p) {
      ring.position.y = RING.y + Math.sin(time * 2) * 0.12
      if (inZone(p) && p.y < FALL_Y) return 'fell'
      if (!bonus && Math.abs(p.z - RING.z) < RING.reach && Math.hypot(p.x - RING.x, p.y + 0.9 - ring.position.y) < RING.radius) {
        bonus = true
        return 'bonus'
      }
      return null
    },
    reset() {
      bonus = false
    },
  }
}
