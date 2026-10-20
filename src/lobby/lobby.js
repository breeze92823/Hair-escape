// The lobby: an open-roofed lavender stud-brick hall. Looking north from spawn
// (the reference shot): a red carpet with yellow borders runs up to the gold
// START portal, flanked by the TOP WINS / TOP HAIR boards on the left and
// TOP REBIRTHS / TOP PRESTIGE on the right. The west side is red bleachers
// with the hair styles on display (the HAIR SHOP); the east wall is the
// TREADMILLS row (x1 to x100), with the sleeping AFK guy on a ledge above and
// the Lucky Spin tower in the corner. Bunting and clouds overhead.
//
// Axes: +X east (right), -Z north (toward the portal). Units are metres.
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, OctahedronGeometry, PlaneGeometry, Shape, ShapeGeometry,
  SphereGeometry, SRGBColorSpace, TorusGeometry, ExtrudeGeometry,
} from 'three'
import { floorMaterial, makeCanvas, onFontReady, outlinedText, studMaterial } from './paint.js'
import { label } from './labels.js'
import { buildLeaderboards } from './leaderboards.js'
import { buildTreadmill } from './treadmill.js'
import { buildHairShop, showNearestInfo } from './hairShop.js'
import {
  BUNDLE, rebirthLevel, canAcquire, canEquip, canRebirth, claimGift, equip, giftAmount, giftReady, GIFT_COOLDOWN, HAIR_STYLES,
  SPIN_COOLDOWN, SPIN_PRIZES, buy, owns, rebirth, requirementText, spin, spinReady, state as progress, styleReq,
} from '../game/state.js'
import { formatNumber } from './leaderboards.js'
import { C, add, bundleBoard, clock, slab, std } from './build.js'
import { buildSouth } from './south.js'

// The hall runs from the START portal (north) to the CHESTS wall (south).
export const ROOM = { minX: -26, maxX: 26, minZ: -34, maxZ: 50, wallH: 13.5, wallT: 1.2 }
// ---------------------------------------------------------------------------
function buildShell(g, addCollider) {
  const { minX, maxX, minZ, maxZ, wallH, wallT } = ROOM
  const W = maxX - minX
  const D = maxZ - minZ
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2

  // Floor (sits a hair above the outdoor grass).
  const floor = add(g, new PlaneGeometry(W, D), floorMaterial(W, D), [cx, 0.01, cz], { rot: [-Math.PI / 2, 0, 0], cast: false })
  floor.receiveShadow = true

  // Walls: studded lavender. [centre x, centre z, length along x, along z]
  const walls = [
    // North wall is split around the START doorway (x within +-4.5) so the course connects directly.
    [(minX - wallT + -4.5) / 2, minZ - wallT / 2, -4.5 - (minX - wallT), wallT],
    [(maxX + wallT + 4.5) / 2, minZ - wallT / 2, maxX + wallT - 4.5, wallT],
    [cx, maxZ + wallT / 2, W + wallT * 2, wallT],
    [minX - wallT / 2, cz, wallT, D],
    [maxX + wallT / 2, cz, wallT, D],
  ]
  for (const [x, z, w, d] of walls) {
    slab(g, studMaterial(C.wall, Math.max(w, d), wallH), x, z, w, d, 0, wallH)
    addCollider(x, z, w, d, wallH + 5)
    // Cream coping on top.
    slab(g, std(C.cream), x, z, w + (d > w ? 0.6 : 0), d + (w > d ? 0.6 : 0), wallH, wallH + 0.45)
  }

  // Yellow / red / yellow band near the top, and a yellow skirting at the floor, on every inner face.
  const bands = [
    [10.3, 10.6, C.yellow],
    [10.6, 11.6, C.red],
    [11.6, 11.9, C.yellow],
    [0, 0.35, C.yellow],
  ]
  const inner = [
    { x: cx, z: minZ + 0.1, w: W, d: 0.25 },
    { x: cx, z: maxZ - 0.1, w: W, d: 0.25 },
    { x: minX + 0.1, z: cz, w: 0.25, d: D },
    { x: maxX - 0.1, z: cz, w: 0.25, d: D },
  ]
  const bandMats = new Map()
  for (const f of inner) {
    for (const [y0, y1, col] of bands) {
      if (!bandMats.has(col)) bandMats.set(col, std(col, { roughness: 0.4 }))
      slab(g, bandMats.get(col), f.x, f.z, f.w, f.d, y0, y1)
    }
  }

  // Pillars along the side walls and in the corners, with yellow capitals.
  const pillarMat = studMaterial(C.pillar, 1.8, wallH)
  const capMat = std(C.yellow, { roughness: 0.4 })
  const pillarSpots = []
  for (const z of [minZ + 0.6, -20, 20, 32, maxZ - 0.6]) pillarSpots.push([minX + 0.6, z]) // west: frames the HAIR SHOP wall
  for (const z of [minZ + 0.6, -0.9, 37, maxZ - 0.6]) pillarSpots.push([maxX - 0.6, z]) // east: splits the treadmill row
  for (const x of [-21, 21]) pillarSpots.push([x, minZ + 0.6])
  for (const [x, z] of pillarSpots) {
    slab(g, pillarMat, x, z, 1.8, 1.8, 0, wallH + 0.2)
    slab(g, capMat, x, z, 2.3, 2.3, 9.7, 10.25)
    slab(g, capMat, x, z, 2.2, 2.2, wallH + 0.2, wallH + 0.75)
    slab(g, std(C.cream), x, z, 2.1, 2.1, 0, 0.5)
    addCollider(x, z, 2.1, 2.1, wallH + 5)
  }
}

// ---------------------------------------------------------------------------
function buildCarpet(g) {
  const carpetZ0 = -27
  const carpetZ1 = ROOM.maxZ - 6 // stops short of the chests
  const carpetD = carpetZ1 - carpetZ0
  const carpetC = (carpetZ0 + carpetZ1) / 2
  const carpetMat = studMaterial(C.red, 9, carpetD, { bump: 0.6 })
  slab(g, carpetMat, 0, carpetC, 9, carpetD, 0, 0.04).castShadow = false
  const yellow = std(C.yellow, { roughness: 0.4 })
  for (const side of [-1, 1]) slab(g, yellow, side * 4.8, carpetC, 0.6, carpetD, 0, 0.07).castShadow = false

  // The round gold pad in front of the portal.
  add(g, new CylinderGeometry(3.9, 3.9, 0.08, 48), std('#ffc21a', { roughness: 0.35, emissive: '#ffb000', emissiveIntensity: 0.2 }), [0, 0.04, -29.4], { cast: false })
  add(g, new TorusGeometry(3.9, 0.14, 8, 64), std('#ff9a00', { roughness: 0.4 }), [0, 0.09, -29.4], { rot: [Math.PI / 2, 0, 0], cast: false })
}

// ---------------------------------------------------------------------------
// The window into the course: sky, pale towers, floating platforms and the
// RECOMMENDED / LEVEL 3 sign.
function paintPortalView(ctx, w, h, level) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#9fd8ff')
  sky.addColorStop(0.7, '#e9f7ff')
  sky.addColorStop(1, '#f8fdff')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  // Soft clouds.
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (const [x, y, r] of [[80, 120, 40], [120, 110, 30], [400, 90, 46], [450, 100, 34], [300, 180, 26]]) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // Distant towers.
  const towers = [[20, 250, 50, 210, '#b9dcf5'], [70, 300, 40, 160, '#a8d0f0'], [420, 230, 60, 230, '#b6daf3'], [470, 290, 42, 170, '#9ecbee'], [360, 320, 30, 140, '#c6e3f7']]
  for (const [x, y, tw, th, col] of towers) {
    ctx.fillStyle = col
    ctx.fillRect(x, y, tw, th)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(x + 4, y + 6, tw * 0.3, th - 12)
  }
  // Floating platforms receding to a vanishing point.
  const plats = [[256, 400, 170, 26, '#5b6b7d'], [150, 352, 70, 16, '#6e8296'], [356, 340, 80, 16, '#6e8296'], [250, 300, 60, 12, '#8597aa'], [190, 270, 40, 9, '#94a6b8'], [300, 255, 36, 8, '#9fb0c2']]
  for (const [x, y, pw, ph, col] of plats) {
    ctx.fillStyle = col
    ctx.fillRect(x - pw / 2, y, pw, ph)
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.fillRect(x - pw / 2, y, pw, ph * 0.3)
    // Little pillars under the near platforms.
    if (ph > 14) {
      ctx.fillStyle = 'rgba(70,90,110,0.7)'
      ctx.fillRect(x - 6, y + ph, 12, 40)
    }
  }
  // A goal flag far off.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(246, 214, 3, 40)
  ctx.fillStyle = '#ffcf1a'
  ctx.beginPath()
  ctx.moveTo(249, 214)
  ctx.lineTo(268, 221)
  ctx.lineTo(249, 228)
  ctx.fill()
  outlinedText(ctx, 'RECOMMENDED', w / 2, 46, 30, { fill: ['#c9ff6b', '#3fcf28'], stroke: '#2b5a14', strokeRatio: 0.16 })
  outlinedText(ctx, `LEVEL ${level}`, w / 2, 92, 52, { fill: ['#ffffff', '#dfe6ee'], stroke: '#4c5866', strokeRatio: 0.14 })
}

function buildPortal(g, addCollider) {
  const z = ROOM.minZ
  const W = 9
  const H = 8.6
  const post = 1.3
  const depth = 1.9
  const fz = z + depth / 2
  const gold = std(C.gold, { roughness: 0.35, metalness: 0.1, emissive: '#7a4a00', emissiveIntensity: 0.15 })
  const goldDark = std(C.goldDark, { roughness: 0.4 })
  const stud = studMaterial(C.gold, 4, 4, { emissive: '#7a4a00' })

  for (const side of [-1, 1]) {
    slab(g, stud, side * (W / 2 + post / 2), fz, post, depth, 0, H + post)
    slab(g, goldDark, side * (W / 2 + 0.12), fz + 0.2, 0.24, depth, 0, H) // inner trim
    addCollider(side * (W / 2 + post / 2), fz, post, depth, H + post)
  }
  slab(g, stud, 0, fz, W + post * 2, depth, H, H + post)
  slab(g, goldDark, 0, fz + 0.2, W, depth, H - 0.24, H)
  // Stepped (ziggurat) crown.
  slab(g, gold, 0, fz - 0.15, 7.6, depth - 0.3, H + post, H + post + 0.9)
  slab(g, gold, 0, fz - 0.3, 3.4, depth - 0.6, H + post + 0.9, H + post + 1.7)
  add(g, new PlaneGeometry(1.1, 0.4), new MeshBasicMaterial({ color: '#7dffc8', toneMapped: false }), [0, H + post + 1.3, fz - 0.3 + (depth - 0.6) / 2 + 0.01])

  // The view into the course.
  const canvas = makeCanvas(512, 490)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const repaint = () => {
    paintPortalView(canvas.getContext('2d'), 512, 490, 3)
    tex.needsUpdate = true
  }
  repaint()
  onFontReady(repaint)
  // The doorway is open: you walk straight out onto the course (no painted view / teleport).
  void tex
  const shimmer = add(
    g,
    new PlaneGeometry(W, H),
    new MeshBasicMaterial({ color: '#bfefff', transparent: true, opacity: 0.12, blending: AdditiveBlending, depthWrite: false }),
    [0, H / 2, z + 0.25],
    { cast: false },
  )

  // Lintel above the doorway, closing the gap in the wall.
  slab(g, studMaterial(C.wall, W, ROOM.wallH - H), 0, z - ROOM.wallT / 2, W, ROOM.wallT, H, ROOM.wallH)
  addCollider(0, z - ROOM.wallT / 2, W, ROOM.wallT, ROOM.wallH + 5, 0, H)

  // Blue steps up into it.
  const blue = studMaterial(C.blue, W, 2, { bump: 0.8 })
  slab(g, blue, 0, z + 0.95, W, 1.9, 0, 0.3)
  slab(g, blue, 0, z + 2.3, W - 0.6, 0.8, 0, 0.15)
  addCollider(0, z + 0.95, W, 1.9, 0.3)
  addCollider(0, z + 2.3, W - 0.6, 0.8, 0.15)

  label(g, [{ text: 'START', size: 1, fill: ['#d6ff6a', '#45e01e'], stroke: '#14400c' }], [0, H + post + 2.6, fz], { unit: 1.5 })

  return {
    shimmer,
    // Walking out through the doorway counts as entering the course.
    hit: (p) => Math.abs(p.x) < W / 2 && p.z < z - 1 && p.z > z - 6,
  }
}

// ---------------------------------------------------------------------------
// West bleachers: three long red studded steps rising to the wall.
const STEPS = [
  { x0: -15, x1: -10.5, h: 0.55 },
  { x0: -19.5, x1: -15, h: 1.1 },
  { x0: ROOM.minX, x1: -19.5, h: 1.65 },
]
const BLEACHER_Z = [-28, 20]

function buildBleachers(g, addCollider) {
  const [z0, z1] = BLEACHER_Z
  const d = z1 - z0
  const zc = (z0 + z1) / 2
  const yellow = std(C.yellow, { roughness: 0.4 })
  for (const s of STEPS) {
    const w = s.x1 - s.x0
    const xc = (s.x0 + s.x1) / 2
    slab(g, studMaterial(C.red, d, w), xc, zc, w, d, 0, s.h)
    addCollider(xc, zc, w, d, s.h)
    // Yellow lip along the front (east) edge and the north end.
    slab(g, yellow, s.x1 - 0.15, zc, 0.3, d, s.h, s.h + 0.08)
    slab(g, yellow, xc, z0 + 0.15, w, 0.3, s.h, s.h + 0.08)
    slab(g, yellow, s.x1 + 0.02, zc, 0.06, d, s.h - 0.2, s.h - 0.06) // stripe on the riser
  }
}

// ---------------------------------------------------------------------------
// The white gift box with pink trim and a floating pink gem (free hair every few hours).
function buildGift(g, addCollider) {
  const x = -7.6
  const z = -24.5
  const s = 2.2
  const root = new Group()
  root.position.set(x, 0, z)
  g.add(root)
  add(root, new BoxGeometry(s, s, s), std('#ffffff', { roughness: 0.35 }), [0, s / 2, 0])
  const pink = std('#ff3fb0', { roughness: 0.35, emissive: '#ff1f9a', emissiveIntensity: 0.25 })
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) add(root, new BoxGeometry(0.2, s + 0.02, 0.2), pink, [sx * (s / 2), s / 2, sz * (s / 2)])
    add(root, new BoxGeometry(0.2, 0.2, s + 0.2), pink, [sx * (s / 2), s, 0])
    add(root, new BoxGeometry(s + 0.2, 0.2, 0.2), pink, [0, s, sx * (s / 2)])
  }
  // Ribbon across the faces.
  add(root, new BoxGeometry(s + 0.04, s + 0.04, 0.35), pink, [0, s / 2, 0])
  add(root, new BoxGeometry(0.35, s + 0.04, s + 0.04), pink, [0, s / 2, 0])
  const gem = add(root, new OctahedronGeometry(0.55), std('#ff4fd0', { roughness: 0.15, metalness: 0.3, emissive: '#ff2fb8', emissiveIntensity: 0.5 }), [0, s + 1, 0])
  gem.scale.y = 1.35
  addCollider(x, z, s + 0.2, s + 0.2, s + 0.1)
  const sign = label(g, [], [x, s + 2.6, z], { unit: 0.9 })

  return {
    update(dt, time) {
      gem.rotation.y += dt * 1.8
      gem.position.y = s + 1 + Math.sin(time * 2.2) * 0.15
      if (giftReady()) sign.set([{ text: 'FREE GIFT!', size: 0.8, fill: ['#ffd6f4', '#ff3fb0'], stroke: '#5a0a3a' }])
      else {
        const left = Math.max(0, GIFT_COOLDOWN - (Date.now() - progress.giftAt))
        sign.set([{ text: 'FREE GIFT', size: 0.7, fill: '#ffffff', stroke: '#5a0a3a' }, { text: clock(left), size: 0.6, fill: '#ffd6f4' }])
      }
    },
    interact: {
      position: { x, y: 1, z },
      radius: 3.4,
      prompt: () => (giftReady() ? [`Claim Free Gift (+${giftAmount()} Hair)`, true] : ['Gift is recharging...', false]),
      action: () => claimGift(),
    },
  }
}


// ---------------------------------------------------------------------------
// Big yellow bobbing arrow (points down at the FREE treadmill).
function arrowMesh() {
  const sh = new Shape()
  sh.moveTo(-0.45, 1.6)
  sh.lineTo(0.45, 1.6)
  sh.lineTo(0.45, 0.7)
  sh.lineTo(1.0, 0.7)
  sh.lineTo(0, -0.4)
  sh.lineTo(-1.0, 0.7)
  sh.lineTo(-0.45, 0.7)
  sh.closePath()
  const geo = new ExtrudeGeometry(sh, { depth: 0.45, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 })
  geo.translate(0, 0, -0.225)
  const m = new Mesh(geo, std('#ffd21a', { roughness: 0.35, emissive: '#ffb000', emissiveIntensity: 0.35 }))
  m.castShadow = true
  return m
}

// Floor chevrons leading from spawn to the FREE treadmill.
function buildChevrons(g, from, to, count) {
  const sh = new Shape()
  sh.moveTo(-0.9, 0)
  sh.lineTo(0, 0.75)
  sh.lineTo(0.9, 0)
  sh.lineTo(0.9, -0.38)
  sh.lineTo(0, 0.37)
  sh.lineTo(-0.9, -0.38)
  sh.closePath()
  const geo = new ShapeGeometry(sh)
  const angle = Math.atan2(to.x - from.x, -(to.z - from.z))
  const chevrons = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const mat = new MeshBasicMaterial({ color: '#ffcf1a', transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false })
    const m = new Mesh(geo, mat)
    m.rotation.set(-Math.PI / 2, 0, -angle)
    m.position.set(from.x + (to.x - from.x) * t, 0.06, from.z + (to.z - from.z) * t)
    g.add(m)
    chevrons.push(m)
  }
  return (time) => chevrons.forEach((c, i) => (c.material.opacity = 0.45 + 0.5 * Math.max(0, Math.sin(time * 4 - i * 0.7))))
}

// ---------------------------------------------------------------------------
// AFK shelf: a yellow ledge high on the east wall above the first treadmills,
// with the sleeping party-hat guy (Zs drifting up) and the starry
// "YOU EARN HAIR OFFLINE!" board beside him.
function buildAfkShelf(g) {
  const x0 = ROOM.maxX - 2.4
  const xc = ROOM.maxX - 1.2
  const z0 = -29.5
  const z1 = -18.5
  const zc = (z0 + z1) / 2
  const h = 4.9
  slab(g, studMaterial(C.yellow, z1 - z0, 2.4), xc, zc, 2.4, z1 - z0, h - 0.5, h)
  slab(g, std('#ffffff', { roughness: 0.5 }), x0 + 0.08, zc, 0.16, z1 - z0, h - 0.62, h - 0.42) // white lip
  for (const z of [z0 + 1, zc, z1 - 1]) {
    // Brackets under the ledge.
    add(g, new BoxGeometry(0.3, 1.2, 0.3), std('#d48a00'), [ROOM.maxX - 0.6, h - 1.1, z], { rot: [0, 0, -0.5] })
  }

  // Bed + sleeper lying along Z, head toward the board.
  const bz = -26.4
  slab(g, std('#ffffff', { roughness: 0.8 }), xc, bz, 1.8, 4.2, h, h + 0.35)
  slab(g, std('#9ed8ff', { roughness: 0.8 }), xc, bz + 1.6, 1.4, 0.9, h + 0.35, h + 0.6)
  slab(g, std('#6aa0ff', { roughness: 0.8 }), xc, bz - 0.8, 1.9, 2.4, h + 0.35, h + 0.5)
  const body = new Group()
  body.position.set(xc, h + 0.55, bz)
  g.add(body)
  add(body, new BoxGeometry(1.1, 0.5, 2.0), std('#ffffff'), [0, 0.05, -0.4])
  add(body, new BoxGeometry(0.95, 0.9, 0.9), std('#ffe14d'), [0, 0.35, 1.05])
  add(body, new ConeGeometry(0.4, 1.0, 16), std('#7fd8ff'), [0, 0.4, 1.85], { rot: [Math.PI / 2 - 0.2, 0, 0] })
  add(body, new SphereGeometry(0.13, 10, 8), std('#ff5fb4'), [0, 0.3, 2.35])
  for (const sz of [-0.2, 0.2]) add(body, new BoxGeometry(0.2, 0.06, 0.06), std('#3a2a10'), [-0.48, 0.45, 1.05 + sz])
  const zs = [0, 1, 2].map((i) => label(g, [{ text: 'Z', size: 1, fill: '#ffffff', stroke: '#5a5aa8' }], [xc, h + 2, bz], { unit: 0.55 + i * 0.12 }))

  // The board, standing on the ledge and facing the room.
  const board = new Group()
  board.position.set(xc + 0.3, h + 1.7, -21.4)
  g.add(board)
  add(board, new BoxGeometry(0.35, 3.1, 4.6), std('#2d6dff', { roughness: 0.35 }), [0, 0, 0])
  add(board, new BoxGeometry(0.2, 3.3, 0.25), std('#ffd21a'), [-0.05, 0, -2.35])
  add(board, new BoxGeometry(0.2, 3.3, 0.25), std('#ffd21a'), [-0.05, 0, 2.35])
  const sc = makeCanvas(512, 340)
  const sctx = sc.getContext('2d')
  const paintBoard = () => {
    const bg = sctx.createLinearGradient(0, 0, 0, 340)
    bg.addColorStop(0, '#1a2a8a')
    bg.addColorStop(1, '#2b48c8')
    sctx.fillStyle = bg
    sctx.fillRect(0, 0, 512, 340)
    sctx.strokeStyle = '#ffffff'
    sctx.lineWidth = 6
    sctx.setLineDash([10, 12])
    sctx.strokeRect(14, 14, 484, 312)
    sctx.setLineDash([])
    sctx.fillStyle = '#ffffff'
    for (const [sx, sy] of [[40, 40], [470, 40], [40, 300], [470, 300], [256, 30], [256, 312]]) {
      sctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        const rr = i % 2 ? 6 : 14
        sctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr)
      }
      sctx.fill()
    }
    outlinedText(sctx, 'YOU EARN', 256, 92, 50, { fill: '#ffffff', stroke: '#0a1240', strokeRatio: 0.14 })
    outlinedText(sctx, 'HAIR', 256, 170, 80, { fill: ['#fff27a', '#ffb000'], stroke: '#0a1240', strokeRatio: 0.14 })
    outlinedText(sctx, 'OFFLINE!', 256, 250, 58, { fill: ['#fff27a', '#ffb000'], stroke: '#0a1240', strokeRatio: 0.14 })
  }
  paintBoard()
  const tex = new CanvasTexture(sc)
  tex.colorSpace = SRGBColorSpace
  onFontReady(() => {
    paintBoard()
    tex.needsUpdate = true
  })
  add(board, new PlaneGeometry(4.3, 2.85), new MeshBasicMaterial({ map: tex, toneMapped: false }), [-0.18, 0, 0], { rot: [0, -Math.PI / 2, 0], cast: false })

  return (time) => {
    zs.forEach((zl, i) => {
      const t = (time * 0.45 + i / 3) % 1
      zl.sprite.position.set(xc - 0.4 - t * 0.6, h + 1.4 + t * 2.6, bz + 1.2 + Math.sin(t * 6 + i) * 0.3)
      zl.sprite.material.opacity = Math.sin(t * Math.PI)
    })
  }
}

// ---------------------------------------------------------------------------
// TREADMILLS lettering on the east wall, above the row.
function buildTreadmillSign(g) {
  const canvas = makeCanvas(1024, 192)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const paint = () => {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 1024, 192)
    outlinedText(ctx, 'TREADMILLS', 512, 100, 140, { fill: ['#c8ffff', '#3fe0ff', '#1aa8f0'], stroke: '#0a1a4a', strokeRatio: 0.12 })
    tex.needsUpdate = true
  }
  paint()
  onFontReady(paint)
  add(g, new PlaneGeometry(15, 2.8), new MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }), [ROOM.maxX - 0.3, 8.9, -11.5], { rot: [0, -Math.PI / 2, 0], cast: false })
}

// ---------------------------------------------------------------------------
// Lucky Spin: a rainbow-striped tower in the south-east corner with a prize
// wheel facing the room. One free spin an hour (E); the wheel spins down onto
// the prize it rolled.
function buildLuckySpin(g, addCollider) {
  const x = 23
  const z = 26.5
  const stripes = ['#ff3b3b', '#ff9a1a', '#ffd21a', '#45e01e', '#2fb8ff', '#7a3cff', '#ff5fc0']
  stripes.forEach((col, i) => slab(g, studMaterial(col, 5, 1), x, z, 5, 5, i * 1.1, (i + 1) * 1.1))
  slab(g, std('#ffffff', { roughness: 0.4 }), x, z, 5.6, 5.6, stripes.length * 1.1, stripes.length * 1.1 + 0.5)
  addCollider(x, z, 5, 5, stripes.length * 1.1 + 0.5)
  // Gold bulbs along the top edge.
  for (let i = 0; i < 8; i++) {
    const b = add(g, new SphereGeometry(0.18, 10, 8), std('#fff27a', { emissive: '#ffcc00', emissiveIntensity: 0.8 }), [x - 2.7, stripes.length * 1.1 + 0.7, z - 2.4 + i * 0.68])
    b.castShadow = false
  }

  // The wheel: a canvas disc of prize segments, on the west face.
  const wc = makeCanvas(512, 512)
  const wtex = new CanvasTexture(wc)
  wtex.colorSpace = SRGBColorSpace
  const paintWheel = () => {
    const ctx = wc.getContext('2d')
    const n = SPIN_PRIZES.length
    for (let i = 0; i < n; i++) {
      ctx.beginPath()
      ctx.moveTo(256, 256)
      ctx.arc(256, 256, 250, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2)
      ctx.fillStyle = stripes[i % stripes.length]
      ctx.fill()
      ctx.save()
      ctx.translate(256, 256)
      ctx.rotate(((i + 0.5) / n) * Math.PI * 2)
      outlinedText(ctx, `${SPIN_PRIZES[i]}x`, 160, 0, 44, { fill: '#ffffff', stroke: '#1b1b2a', strokeRatio: 0.18 })
      ctx.restore()
    }
    ctx.lineWidth = 12
    ctx.strokeStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(256, 256, 248, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(256, 256, 40, 0, Math.PI * 2)
    ctx.fill()
    wtex.needsUpdate = true
  }
  paintWheel()
  onFontReady(paintWheel)
  const wheel = add(g, new CircleGeometry(2.1, 48), new MeshBasicMaterial({ map: wtex, toneMapped: false }), [x - 2.53, 4.6, z], { rot: [0, -Math.PI / 2, 0], cast: false })
  add(g, new TorusGeometry(2.15, 0.14, 10, 48), std('#ffd21a', { metalness: 0.3, roughness: 0.3 }), [x - 2.55, 4.6, z], { rot: [0, Math.PI / 2, 0] })
  // Pointer at the top of the wheel.
  add(g, new ConeGeometry(0.3, 0.7, 4), std('#ffffff'), [x - 2.7, 6.95, z], { rot: [Math.PI, 0, 0] })
  const sign = label(g, [], [x - 2.6, 9.8, z], { unit: 1.2 })

  // Spin animation: ease the wheel to land the rolled segment under the pointer.
  const anim = { from: 0, to: 0, t: 1 }
  const n = SPIN_PRIZES.length
  return {
    update(dt, time) {
      if (anim.t < 1) {
        anim.t = Math.min(1, anim.t + dt / 4)
        const e = 1 - Math.pow(1 - anim.t, 3)
        wheel.rotation.z = anim.from + (anim.to - anim.from) * e
      }
      sign.set(spinReady()
        ? [{ text: 'LUCKY SPIN', size: 0.9, fill: ['#fff27a', '#ff5fc0'], stroke: '#3a0a3a' }, { text: 'FREE SPIN READY!', size: 0.45, fill: '#ffffff', bg: '#33d11c', border: '#0f4a0a' }]
        : [{ text: 'LUCKY SPIN', size: 0.9, fill: ['#fff27a', '#ff5fc0'], stroke: '#3a0a3a' }, { text: `Next spin ${clock(SPIN_COOLDOWN - (Date.now() - progress.spinAt))}`, size: 0.45, fill: '#ffffff', bg: '#2a2b45' }])
    },
    interact: {
      position: { x: x - 3.5, y: 1, z },
      radius: 3.5,
      prompt: () => (spinReady() ? ['Spin the Lucky Wheel (free!)', true] : ['The wheel is recharging...', false]),
      action: () => {
        const index = spin()
        if (index < 0) return
        // Canvas angles run clockwise from 3 o'clock; a +rotation.z turns the disc
        // counter-clockwise, carrying segment centre c to c - rot. The pointer is at
        // 12 o'clock (-90 deg), so land on rot = c + 90 deg, plus five full turns.
        const target = ((index + 0.5) / n) * Math.PI * 2 + Math.PI / 2
        anim.from = wheel.rotation.z % (Math.PI * 2)
        anim.to = target + Math.PI * 2 * 5
        anim.t = 0
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Rebirth altar on the south side (behind spawn): purple pedestal and a spinning halo.
function buildRebirth(g, addCollider) {
  const x = 11.5
  const z = 40.5
  add(g, new CylinderGeometry(2, 2.3, 0.6, 8), studMaterial('#8a3cff', 4, 1), [x, 0.3, z])
  add(g, new CylinderGeometry(1.2, 1.5, 1.4, 8), std('#b47bff', { roughness: 0.35 }), [x, 1.3, z])
  addCollider(x, z, 3.2, 3.2, 2)
  const halo = add(g, new TorusGeometry(1.1, 0.14, 10, 40), std('#ffe45a', { emissive: '#ffcc00', emissiveIntensity: 0.6 }), [x, 3.4, z])
  const orb = add(g, new SphereGeometry(0.5, 20, 14), std('#e9d4ff', { emissive: '#a35bff', emissiveIntensity: 0.8 }), [x, 3.4, z])
  const sign = label(g, [], [x, 5.4, z], { unit: 1 })
  return {
    update(dt, time, state) {
      halo.rotation.x = time * 1.3
      halo.rotation.y = time * 0.9
      orb.position.y = 3.4 + Math.sin(time * 2) * 0.15
      sign.set([
        { text: 'REBIRTH', size: 0.9, fill: ['#f2dcff', '#a35bff'], stroke: '#2a0a5a' },
        canRebirth()
          ? { text: 'Press E: +50% Hair forever', size: 0.5, fill: ['#b6ff7a', '#33d11c'] }
          : { text: `Reach Level ${rebirthLevel()} (you: ${state.level})`, size: 0.5, fill: '#ffffff' },
      ])
    },
    interact: {
      position: { x, y: 1, z },
      radius: 4,
      prompt: () => (canRebirth() ? ['Rebirth (resets hair & level, +50% hair)', true] : [`Rebirth needs Level ${rebirthLevel()}`, false]),
      action: () => rebirth(),
    },
  }
}

// ---------------------------------------------------------------------------
// Bunting strung across the open roof, and clouds drifting overhead.
function buildBunting(g) {
  const tri = new Shape()
  tri.moveTo(-0.45, 0)
  tri.lineTo(0.45, 0)
  tri.lineTo(0, -0.95)
  tri.closePath()
  const geo = new ShapeGeometry(tri)
  const mats = [std('#9b5a24', { side: DoubleSide }), std('#7a4116', { side: DoubleSide }), std('#b8742f', { side: DoubleSide })]
  const ropeMat = std('#5a3a1a')
  const span = ROOM.maxX - ROOM.minX
  for (const z of [38, 20, 2, -16]) {
    add(g, new BoxGeometry(span, 0.05, 0.05), ropeMat, [0, 13.9, z], { cast: false })
    for (let x = ROOM.minX + 0.8, i = 0; x < ROOM.maxX - 0.5; x += 1.6, i++) {
      const sag = 0.5 * (1 - Math.pow(x / (span / 2), 2))
      const f = new Mesh(geo, mats[i % mats.length])
      f.position.set(x, 13.95 - sag, z)
      f.rotation.y = (i % 2) * 0.15 - 0.07
      g.add(f)
    }
  }
}

function buildClouds(g) {
  const white = std('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35 })
  const blue = std('#7cc6ff', { roughness: 1, emissive: '#5ab4ff', emissiveIntensity: 0.3 })
  const clouds = []
  const sphere = new SphereGeometry(1, 14, 10)
  const spots = [
    [-30, 22, -48, 1.4, white], [10, 26, -55, 1.8, white], [40, 20, -40, 1.2, white], [-45, 24, -5, 1.3, white],
    [48, 25, 10, 1.5, white], [0, 30, 40, 1.6, white], [-20, 19, -38, 0.9, blue], [26, 19, -40, 0.8, blue], [-2, 23, -10, 1.1, blue],
  ]
  for (const [x, y, z, s, mat] of spots) {
    const c = new Group()
    c.position.set(x, y, z)
    for (let i = 0; i < 6; i++) {
      const p = new Mesh(sphere, mat)
      const r = (1.8 + ((i * 37) % 10) / 6) * s
      p.scale.set(r, r * 0.8, r)
      p.position.set((i - 2.5) * 1.6 * s, Math.sin(i * 1.7) * 0.6 * s, Math.cos(i * 2.3) * 1.2 * s)
      c.add(p)
    }
    g.add(c)
    clouds.push({ c, x, speed: 0.3 + s * 0.2 })
  }
  return (time) => clouds.forEach((k) => (k.c.position.x = k.x + Math.sin(time * 0.05 * k.speed) * 6))
}

// ---------------------------------------------------------------------------
// The big yellow HAIR SHOP lettering painted on the west wall, above the bleachers.
function buildShopSign(g) {
  const canvas = makeCanvas(1024, 192)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const paint = () => {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 1024, 192)
    outlinedText(ctx, 'HAIR SHOP', 512, 100, 150, { fill: ['#fff27a', '#ffc400', '#ff9d00'], stroke: '#3a1d00', strokeRatio: 0.12 })
    tex.needsUpdate = true
  }
  paint()
  onFontReady(paint)
  add(g, new PlaneGeometry(16, 3), new MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }), [ROOM.minX + 0.3, 8.6, 0], { rot: [0, Math.PI / 2, 0], cast: false })
}

// South-west corner: a raised white studded stage for the limited hair (Twin
// Braids drop, Twin Tails, Curly) and the PRINCESS BUNDLE billboard.
const CORNER = { x0: ROOM.minX, x1: -14.5, z0: 20, z1: 30.4, h: 2.2 }
function buildLimitedCorner(g, addCollider) {
  const { x0, x1, z0, z1, h } = CORNER
  const w = x1 - x0
  const d = z1 - z0
  const xc = (x0 + x1) / 2
  const zc = (z0 + z1) / 2
  slab(g, studMaterial('#f4f2ff', Math.max(w, d), h), xc, zc, w, d, 0, h)
  addCollider(xc, zc, w, d, h)
  const pink = std('#ff6ad5', { roughness: 0.4, emissive: '#ff3fc0', emissiveIntensity: 0.2 })
  const purple = std('#7a3cff', { roughness: 0.4 })
  slab(g, pink, x1 - 0.15, zc, 0.3, d, h, h + 0.12)
  slab(g, pink, xc, z0 + 0.15, w, 0.3, h, h + 0.12)
  slab(g, purple, x1 + 0.03, zc, 0.06, d, 0.1, 0.5)
  slab(g, purple, xc, z0 - 0.03, w, 0.06, 0.1, 0.5)
  // Steps up from the floor on the east face (0.55 m risers, like the bleachers).
  const stepMat = studMaterial('#f4f2ff', 3, 1)
  for (const [dx, top] of [[1.5, 0.55], [1.0, 1.1], [0.5, 1.65]]) {
    slab(g, stepMat, x1 + dx / 2, 24, dx, 3, 0, top)
    addCollider(x1 + dx / 2, 24, dx, 3, top)
  }

  // The bundle display: a yellow gift block and white pedestal beside the hair.
  slab(g, studMaterial('#ffd21a', 1.6, 1.6), -23.5, 23.6, 1.6, 1.6, h, h + 1.6)
  addCollider(-23.5, 23.6, 1.6, 1.6, h + 1.6)
  slab(g, pink, -23.5, 23.6, 1.62, 1.62, h + 0.65, h + 0.95)
  add(g, new CylinderGeometry(0.7, 0.8, 1.0, 20), std('#ffffff', { roughness: 0.35 }), [-24, h + 0.5, 21.6])
  addCollider(-24, 21.6, 1.5, 1.5, h + 1)

  // Billboard: LIMITED / CELESTIAL PRINCESS BUNDLE / stock / bonus + price.
  const board = bundleBoard(g, BUNDLE, HAIR_STYLES.princess.bonus, [-21.5, h + 7.6, 26.5])
  const sparkle = label(g, [{ text: '✦', size: 1, fill: ['#fff6b0', '#ffc400'], stroke: '#7a4a00' }], [-24.6, h + 9.7, 26.5], { unit: 1.1 })
  return {
    update(time) {
      board()
      sparkle.sprite.material.rotation = time * 0.8
      sparkle.sprite.scale.setScalar(1.1 + Math.sin(time * 4) * 0.15)
    },
  }
}

// ---------------------------------------------------------------------------
// opts.onEvent: the south arch opens the EVENT panel.
export function buildLobby(scene, addCollider, { onEvent } = {}) {
  const g = new Group()
  g.name = 'lobby'
  scene.add(g)

  buildShell(g, addCollider)
  buildCarpet(g)
  const portal = buildPortal(g, addCollider)
  const boards = buildLeaderboards(g, addCollider, ROOM.minZ)
  buildBleachers(g, addCollider)
  // Front row on the middle tier, back row staggered between them on the top
  // tier, Golden (the starter) alone on the bottom tier by the portal, and the
  // limited styles on the white corner stage.
  const FRONT = { x: -17.25, y: STEPS[1].h, scale: 0.78 }
  const BACK = { x: -22.75, y: STEPS[2].h, scale: 0.66 }
  const south = buildSouth(g, addCollider, ROOM, { onEvent })
  const shop = buildHairShop(g, addCollider, [
    ...south.shopSpots,
    { id: 'golden', x: -12.75, y: STEPS[0].h, z: -23 },
    { id: 'blueberry', ...FRONT, z: -16 },
    { id: 'slime', ...FRONT, z: -9.5 },
    { id: 'emerald', ...FRONT, z: -3 },
    { id: 'crystal', ...FRONT, z: 3.5 },
    { id: 'ruby', ...FRONT, z: 10 },
    { id: 'gummy', ...FRONT, z: 16.5 },
    { id: 'orange', ...BACK, z: -6.25 },
    { id: 'grape', ...BACK, z: -1.1 },
    { id: 'ocean', ...BACK, z: 1.9 },
    { id: 'void', ...BACK, z: 6.75 },
    { id: 'curly', x: -16.4, y: CORNER.h, z: 21.4, scale: 0.6, compact: true },
    { id: 'tails', x: -16.4, y: CORNER.h, z: 23.6, scale: 0.6, compact: true },
    { id: 'braids', x: -16.4, y: CORNER.h, z: 25.8, scale: 0.6, compact: true },
    { id: 'princess', x: -21.5, y: CORNER.h, z: 26.5, scale: 1.15, noName: true }, // the LIMITED billboard names it
  ])
  buildShopSign(g)
  const corner = buildLimitedCorner(g, addCollider)
  const gift = buildGift(g, addCollider)
  const sleeper = buildAfkShelf(g)
  buildTreadmillSign(g)
  const lucky = buildLuckySpin(g, addCollider)
  const rebirthAltar = buildRebirth(g, addCollider)
  buildBunting(g)
  const clouds = buildClouds(g)

  // The east wall row, north to south, consoles against the wall. Rebirth tiers
  // unlock with rebirths; the top four are bought once with hair (the green-coin price).
  const TM_X = 21
  const tiers = [
    { key: 'x1', z: -26, theme: 'dark', mult: 1, labelY: 4.0 },
    { key: 'x2', z: -20.6, theme: 'blue', mult: 2, rebirths: 1, labelY: 4.3 },
    { key: 'x3', z: -15.2, theme: 'pink', mult: 3, rebirths: 2, labelY: 4.4 },
    { key: 'x4', z: -9.8, theme: 'gold', mult: 4, rebirths: 4, deco: 'crown', labelY: 4.9 },
    { key: 'x6', z: -4.4, theme: 'neon', mult: 6, rebirths: 6, deco: 'neon', labelY: 4.9 },
    { key: 'x8', z: 3.6, theme: 'angel', mult: 8, cost: 85000, deco: 'wings', labelY: 5.3 },
    { key: 'x12', z: 9.0, theme: 'spike', mult: 12, cost: 139000, deco: 'spikes', labelY: 5.5 },
    { key: 'x25', z: 14.4, theme: 'galaxy', mult: 25, cost: 279000, deco: 'planet', labelY: 5.9 },
    { key: 'x100', z: 19.8, theme: 'cosmic', mult: 100, cost: 729000, deco: 'vortex', labelY: 6.4 },
    // Past the Lucky Spin tower.
    { key: 'x500', z: 32.6, theme: 'rainbow', mult: 500, cost: 2239000, deco: 'rainbow', labelY: 7.2 },
  ]
  const MULT_FILL = {
    rainbow: ['#ffffff', '#ff5fc0'],
    dark: '#ffffff', blue: ['#bfe9ff', '#2fb8ff'], pink: ['#ffd0f4', '#ff5fd0'], gold: ['#fff27a', '#ffb000'], neon: ['#ffb8ff', '#d63cff'],
    angel: ['#d8fbff', '#3fe0ff'], spike: ['#c8ffd8', '#3cff7a'], galaxy: ['#e0d0ff', '#9a6bff'], cosmic: ['#fff27a', '#ff7a1a'],
  }
  const treadmills = tiers.map((tier) => {
    const t = buildTreadmill(g, addCollider, { x: TM_X, consoleSide: 1, ...tier })
    return Object.assign(t, { tier })
  })
  const tierLabels = (tier, unlocked) => {
    const lines = []
    if (!tier.rebirths && !tier.cost) lines.push({ text: 'FREE!', size: 0.5, fill: ['#fff27a', '#ffb000'] })
    else if (!unlocked && tier.rebirths) lines.push({ text: `🔒 ${tier.rebirths} Rebirth${tier.rebirths === 1 ? '' : 's'}`, size: 0.42, fill: ['#ffb0b0', '#ff3b3b'] })
    else if (!unlocked && tier.cost) lines.push({ text: `◎ ${formatNumber(tier.cost)}`, size: 0.48, fill: ['#b6ff7a', '#33d11c'] })
    lines.push({ text: `x${tier.mult} Hair`, size: 0.9, fill: MULT_FILL[tier.theme] })
    return lines
  }
  const tierUnlocked = (tier) => (tier.cost ? owns(`tm:${tier.key}`) : progress.rebirths >= (tier.rebirths ?? 0))

  // Lilac stage strip under the row, with a yellow edge on the room side.
  slab(g, std('#c9c2ff', { roughness: 0.5 }), (16.6 + ROOM.maxX) / 2, 4, ROOM.maxX - 16.6, 64, 0, 0.05).castShadow = false
  slab(g, std(C.yellow, { roughness: 0.4 }), 16.75, 4, 0.3, 64, 0, 0.08).castShadow = false

  const arrow = arrowMesh()
  arrow.position.set(TM_X - 1.6, 6.3, -26)
  g.add(arrow)
  const chevrons = buildChevrons(g, { x: 5.2, z: 4 }, { x: 16.5, z: -23.5 }, 9)

  // Interactions (E): equip each displayed hair, the gift, the rebirth altar.
  const interactables = [
    ...south.interactables,
    ...shop.map((s) => ({
      position: s.position,
      radius: 3.6,
      // [text, enabled]: a disabled prompt explains a requirement instead of offering an action.
      prompt: () => {
        const name = s.style.name
        if (progress.equipped === s.id) return [`${name} is equipped`, false]
        if (canEquip(s.id)) return [`Equip ${name} (+${s.style.bonus} / Hair)`, true]
        if (canAcquire(s.id)) return [`Buy ${name} for ${s.style.price} Wins`, true]
        const req = styleReq(s.id)
        if (req.type === 'price') return [`${name} costs ${req.value} Wins (you have ${progress.wins}, escape the course!)`, false]
        return [`${name}: ${requirementText(s.id)}`, false]
      },
      action: () => equip(s.id),
    })),
    // Treadmill consoles: the price / requirement, or buy with E.
    ...treadmills.filter((t) => t.tier.rebirths || t.tier.cost).map((t) => ({
      position: t.center,
      radius: 3.4,
      prompt: () => {
        const { tier } = t
        if (tierUnlocked(tier)) return [`x${tier.mult} Hair treadmill: run on it!`, false]
        if (tier.rebirths) return [`x${tier.mult} Hair needs ${tier.rebirths} Rebirth${tier.rebirths === 1 ? '' : 's'}`, false]
        return progress.hair >= tier.cost
          ? [`Buy x${tier.mult} Hair treadmill for ${formatNumber(tier.cost)} Hair`, true]
          : [`x${tier.mult} Hair costs ${formatNumber(tier.cost)} Hair (you have ${formatNumber(progress.hair)})`, false]
      },
      action: () => buy(`tm:${t.tier.key}`, t.tier.cost),
    })),
    gift.interact,
    rebirthAltar.interact,
    lucky.interact,
  ]

  let lastState = null
  return {
    interactables,
    treadmills,
    portalHit: portal.hit,
    // Called on any progression change.
    refresh(state, playerName) {
      lastState = state
      shop.forEach((s) => s.refresh(state))
      for (const t of treadmills) {
        const open = tierUnlocked(t.tier)
        t.setLocked(!open)
        t.signs.set(tierLabels(t.tier, open))
      }
      boards.update(state, playerName)
    },
    update(dt, time) {
      for (const t of treadmills) t.update(dt, time)
      shop.forEach((s) => s.update(dt, time))
      showNearestInfo(shop)
      corner.update(time)
      lucky.update(dt, time)
      south.update(dt, time)
      gift.update(dt, time)
      if (lastState) rebirthAltar.update(dt, time, lastState)
      sleeper(time)
      clouds(time)
      chevrons(time)
      arrow.position.y = 5.6 + Math.sin(time * 3) * 0.35
      arrow.rotation.y = time * 1.2
      portal.shimmer.material.opacity = 0.1 + Math.sin(time * 2) * 0.06
    },
  }
}

export { HAIR_STYLES }
