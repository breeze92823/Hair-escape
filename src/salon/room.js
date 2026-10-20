// The Hair Salon room: its own Scene, built once the first time the salon opens.
// A pink-and-white stud-brick parlour (the reference look): checker floor, yellow
// trims, shelves of colourful bottles, yellow-framed mirrors, a pink salon chair, a
// hood dryer and barrels, round a white pedestal with yellow step rings the player
// stands on. Everything is canvas-painted primitives; bottles are two InstancedMeshes.
//
// The player's avatar layer is moved into this scene while the salon is open (salon.js),
// so `floorAt` here is what the hair rope lies on: the pedestal tiers, then the floor.
import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  TorusGeometry,
  Vector3,
} from 'three'
import { SALON } from '../config.js'
import { makeCanvas, texture } from '../lobby/paint.js'
import { add, std } from '../lobby/build.js'

const H = SALON.half
const WALL_H = SALON.height
const BG = '#fdeef6' // background past the open top
const C = {
  wall: '#fff7fb',
  wallMark: '#f6d4e6',
  tileA: '#ffffff',
  tileB: '#ffd6ea',
  yellow: '#ffd21a',
  pink: '#ff4fa3',
  pinkSoft: '#ff9fcb',
  white: '#ffffff',
  mint: '#9ef0c8',
  sky: '#9fe6ff',
}
const BOTTLE_COLORS = ['#ff6fb5', '#4fdcff', '#ffe04a', '#7dffc0', '#c08cff', '#ff9fcb', '#7fd2ff', '#b8ff7a']

// Roblox-style "studs" brick: white with soft pink L-shaped marks, one tile per 2 m.
function wallMaterial(w, h) {
  const size = 256
  const cv = makeCanvas(size)
  const c = cv.getContext('2d')
  c.fillStyle = C.wall
  c.fillRect(0, 0, size, size)
  const n = 4
  const cell = size / n
  c.strokeStyle = C.wallMark
  c.lineWidth = 7
  c.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = i * cell + cell * 0.3
      const y = j * cell + cell * 0.25
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x, y + cell * 0.5)
      c.lineTo(x + cell * 0.38, y + cell * 0.5)
      c.stroke()
    }
  }
  c.strokeStyle = 'rgba(230,180,205,0.35)'
  c.lineWidth = 2
  c.strokeRect(1, 1, size - 2, size - 2)
  return new MeshStandardMaterial({ map: texture(cv, { repeat: [w / 2, h / 2] }), roughness: 0.8, metalness: 0 })
}

// Pink and white checker with the same L marks, one 2x2 tile per 4 m.
function floorMaterial(w, d) {
  const size = 256
  const cv = makeCanvas(size)
  const c = cv.getContext('2d')
  const half = size / 2
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      c.fillStyle = (i + j) % 2 ? C.tileB : C.tileA
      c.fillRect(i * half, j * half, half, half)
      c.strokeStyle = (i + j) % 2 ? 'rgba(255,255,255,0.55)' : 'rgba(255,170,210,0.45)'
      c.lineWidth = 6
      c.lineCap = 'round'
      for (let a = 0; a < 2; a++) {
        for (let b = 0; b < 2; b++) {
          const x = i * half + a * (half / 2) + half * 0.15
          const y = j * half + b * (half / 2) + half * 0.12
          c.beginPath()
          c.moveTo(x, y)
          c.lineTo(x, y + half * 0.22)
          c.lineTo(x + half * 0.18, y + half * 0.22)
          c.stroke()
        }
      }
    }
  }
  return new MeshStandardMaterial({ map: texture(cv, { repeat: [w / 4, d / 4] }), roughness: 0.6, metalness: 0 })
}

// Mirror glass: pale blue with two white glare streaks.
function mirrorMaterial() {
  const cv = makeCanvas(128, 256)
  const c = cv.getContext('2d')
  const g = c.createLinearGradient(0, 0, 128, 256)
  g.addColorStop(0, '#d8f6ff')
  g.addColorStop(1, '#8fdcff')
  c.fillStyle = g
  c.fillRect(0, 0, 128, 256)
  c.fillStyle = 'rgba(255,255,255,0.85)'
  for (const [x, w] of [[30, 22], [70, 10]]) {
    c.beginPath()
    c.moveTo(x, 0)
    c.lineTo(x + w, 0)
    c.lineTo(x + w - 60, 256)
    c.lineTo(x - 60, 256)
    c.fill()
  }
  return new MeshBasicMaterial({ map: texture(cv) })
}

// Soft dark disc under the player: grounds them without a big shadow map.
function blobMaterial() {
  const cv = makeCanvas(64)
  const c = cv.getContext('2d')
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(60,20,50,0.35)')
  g.addColorStop(1, 'rgba(60,20,50,0)')
  c.fillStyle = g
  c.fillRect(0, 0, 64, 64)
  return new MeshBasicMaterial({ map: texture(cv), transparent: true, depthWrite: false })
}

// A yellow frame with glass, flat against a wall. `normal` points into the room ([x, z]).
function mirror(g, glass, [x, y, z], w, h, [nx, nz]) {
  const frame = std(C.yellow)
  const rot = Math.atan2(nx, nz)
  const m = new Group()
  m.position.set(x, y, z)
  m.rotation.y = rot
  const t = 0.3
  add(m, new BoxGeometry(w + t * 2, t, 0.25), frame, [0, h / 2 + t / 2, 0.1], { cast: false })
  add(m, new BoxGeometry(w + t * 2, t, 0.25), frame, [0, -h / 2 - t / 2, 0.1], { cast: false })
  add(m, new BoxGeometry(t, h, 0.25), frame, [-w / 2 - t / 2, 0, 0.1], { cast: false })
  add(m, new BoxGeometry(t, h, 0.25), frame, [w / 2 + t / 2, 0, 0.1], { cast: false })
  add(m, new PlaneGeometry(w, h), glass, [0, 0, 0.05], { cast: false })
  g.add(m)
}

// The classic pink salon chair, facing `rotY`.
function salonChair(g, x, z, rotY, seatColor = C.pink) {
  const chair = new Group()
  chair.position.set(x, 0, z)
  chair.rotation.y = rotY
  const seat = std(seatColor)
  const white = std(C.white)
  add(chair, new CylinderGeometry(0.9, 1.1, 0.2, 20), white, [0, 0.1, 0], { cast: false })
  add(chair, new CylinderGeometry(0.22, 0.22, 0.7, 12), white, [0, 0.55, 0], { cast: false })
  add(chair, new BoxGeometry(1.9, 0.55, 1.7), seat, [0, 1.1, 0], { cast: false })
  add(chair, new BoxGeometry(1.9, 2.1, 0.45), seat, [0, 2.2, -0.65], { cast: false })
  add(chair, new BoxGeometry(0.35, 0.5, 1.5), seat, [-1.05, 1.55, 0], { cast: false })
  add(chair, new BoxGeometry(0.35, 0.5, 1.5), seat, [1.05, 1.55, 0], { cast: false })
  add(chair, new BoxGeometry(1.2, 0.18, 0.5), white, [0, 0.5, 1.15], { cast: false })
  g.add(chair)
  return chair
}

// A hood dryer over a light-blue chair (the back wall in the reference's Colors view).
function hoodDryer(g, x, z, rotY) {
  const d = salonChair(g, x, z, rotY, C.sky)
  const dark = std('#2a2b3a')
  add(d, new CylinderGeometry(0.08, 0.08, 2.4, 8), dark, [0, 3.4, -1.0], { cast: false })
  add(d, new CylinderGeometry(0.85, 1.05, 1.25, 20), std(C.mint), [0, 4.3, -0.2], { rot: [0.35, 0, 0], cast: false })
  add(d, new BoxGeometry(0.16, 0.9, 0.16), dark, [0, 5.3, -0.75], { cast: false })
}

function barrel(g, x, z, color, ring) {
  add(g, new CylinderGeometry(0.75, 0.75, 1.6, 20), std(color), [x, 0.8, z], { cast: false })
  for (const y of [0.35, 1.25]) add(g, new TorusGeometry(0.76, 0.06, 6, 24), std(ring), [x, y, z], { rot: [Math.PI / 2, 0, 0], cast: false })
}

// A run of yellow shelf boards along a wall, `along` = the wall's run axis ('x' or 'z').
// Returns the bottle slots on them: [x, y, z] of each board's top.
function shelves(g, [x0, x1], fixed, along, normalSign, heights = [3.4, 5, 6.6]) {
  const board = std(C.yellow)
  const len = x1 - x0
  const mid = (x0 + x1) / 2
  const depth = 1.1
  const inward = fixed + normalSign * (depth / 2)
  const slots = []
  for (const y of heights) {
    const geo = along === 'x' ? new BoxGeometry(len, 0.22, depth) : new BoxGeometry(depth, 0.22, len)
    add(g, geo, board, along === 'x' ? [mid, y, inward] : [inward, y, mid], { cast: false })
    const n = Math.floor(len / 0.75)
    for (let i = 0; i < n; i++) {
      const s = x0 + (i + 0.5) * (len / n)
      slots.push(along === 'x' ? [s, y + 0.11, inward] : [inward, y + 0.11, s])
    }
  }
  return slots
}

// Bottles on every shelf slot: bodies and caps as two InstancedMeshes (two draw calls).
function bottles(g, slots) {
  let seed = 11
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const body = new InstancedMesh(new CylinderGeometry(1, 1, 1, 12), new MeshStandardMaterial({ roughness: 0.35, metalness: 0 }), slots.length)
  const cap = new InstancedMesh(new CylinderGeometry(1, 1, 1, 10), new MeshStandardMaterial({ roughness: 0.5, metalness: 0 }), slots.length)
  const m = new Matrix4()
  const q = new Quaternion()
  const p = new Vector3()
  const s = new Vector3()
  const col = new Color()
  slots.forEach(([x, y, z], i) => {
    const r = 0.2 + rand() * 0.14
    const h = 0.6 + rand() * 0.6
    body.setMatrixAt(i, m.compose(p.set(x + (rand() - 0.5) * 0.15, y + h / 2, z), q, s.set(r, h, r)))
    body.setColorAt(i, col.set(BOTTLE_COLORS[Math.floor(rand() * BOTTLE_COLORS.length)]))
    const ch = 0.12 + rand() * 0.12
    cap.setMatrixAt(i, m.compose(p.set(p.x, y + h + ch / 2, z), q, s.set(r * 0.55, ch, r * 0.55)))
    cap.setColorAt(i, col.set(rand() < 0.5 ? '#ffffff' : BOTTLE_COLORS[Math.floor(rand() * BOTTLE_COLORS.length)]).multiplyScalar(0.9))
  })
  g.add(body, cap)
}

export function buildSalonRoom() {
  const scene = new Scene()
  scene.background = new Color(BG)
  // Never reaches the room; it only keeps the materials' shader programs the same as in the
  // fogged world, so the avatar does not recompile on every switch.
  scene.fog = new Fog(BG, 900, 1000)

  const hemi = new HemisphereLight('#ffffff', '#f6c8de', 1.8)
  const sun = new DirectionalLight('#fff6ee', 1.6)
  sun.position.set(6, 16, 10)
  sun.target.position.set(0, 0, -2)
  sun.castShadow = true
  sun.shadow.mapSize.set(SALON.shadowMapSize, SALON.shadowMapSize)
  const r = SALON.shadowRange
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 40 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  scene.add(hemi, sun, sun.target)

  const g = new Group()
  scene.add(g)

  // Shell: floor, ceiling, four walls (inner faces at +-H), pink skirting and a yellow trim band.
  const floor = add(g, new PlaneGeometry(H * 2, H * 2), floorMaterial(H * 2, H * 2), [0, 0, 0], { rot: [-Math.PI / 2, 0, 0], cast: false })
  floor.receiveShadow = true
  add(g, new PlaneGeometry(H * 2, H * 2), std('#ffffff'), [0, WALL_H, 0], { rot: [Math.PI / 2, 0, 0], cast: false })
  const wall = wallMaterial(H * 2, WALL_H)
  const skirt = std(C.pinkSoft)
  const trim = std(C.yellow)
  for (const [x, z, ry] of [[0, -H, 0], [0, H, Math.PI], [-H, 0, Math.PI / 2], [H, 0, -Math.PI / 2]]) {
    const w = new Group()
    w.position.set(x, 0, z)
    w.rotation.y = ry
    add(w, new PlaneGeometry(H * 2, WALL_H), wall, [0, WALL_H / 2, 0], { cast: false })
    add(w, new BoxGeometry(H * 2, 0.6, 0.2), skirt, [0, 0.3, 0.1], { cast: false })
    add(w, new BoxGeometry(H * 2, 0.35, 0.18), trim, [0, 2.6, 0.09], { cast: false })
    add(w, new BoxGeometry(H * 2, 0.35, 0.18), trim, [0, 8.4, 0.09], { cast: false })
    g.add(w)
  }

  // Back wall (behind the player, seen in the front views): counter + shelves, mirror and pink chair.
  const glass = mirrorMaterial()
  const slots = []
  add(g, new BoxGeometry(7.5, 1.6, 1.4), std(C.white), [-4.6, 0.8, -H + 0.7], { cast: false })
  add(g, new BoxGeometry(7.5, 0.25, 1.45), std(C.pinkSoft), [-4.6, 1.72, -H + 0.7], { cast: false })
  slots.push(...shelves(g, [-8.4, -0.8], -H, 'x', 1))
  mirror(g, glass, [5.6, 4.6, -H + 0.02], 3.2, 4, [0, 1])
  salonChair(g, 5.6, -H + 3.6, 0)
  // Left wall: a big window-like mirror. Right wall: more shelves.
  mirror(g, glass, [-H + 0.02, 5, -3], 5, 4.5, [1, 0])
  slots.push(...shelves(g, [-7, 3], H, 'z', -1))
  // Front wall (seen in the back views): mirror, shelves, hood dryer and barrels.
  mirror(g, glass, [-6.5, 4.6, H - 0.02], 3.4, 4.2, [0, -1])
  slots.push(...shelves(g, [1.5, 9.5], H, 'x', -1, [3.4, 5, 6.6]))
  hoodDryer(g, -2.2, H - 3.2, Math.PI)
  barrel(g, 2.6, H - 1.6, '#c9a8ff', '#9a7ae0')
  barrel(g, 4.4, H - 1.6, '#ffe04a', '#e0b800')
  bottles(g, slots)

  // The pedestal: a white top with yellow step rings.
  const tiers = SALON.pedestal
  tiers.forEach(([radius, top], i) => {
    const m = add(g, new CylinderGeometry(radius, radius, top, 48), std(i === 0 ? C.white : i === 1 ? C.yellow : '#ffe36b'), [0, top / 2, 0], { cast: false })
    m.receiveShadow = true
  })
  const top = tiers[0][1]
  add(g, new CircleGeometry(1.1, 24), blobMaterial(), [0, top + 0.005, 0], { rot: [-Math.PI / 2, 0, 0], cast: false })

  return {
    scene,
    spot: { x: 0, y: top, z: 0 },
    // The floor height under (x, z): the pedestal tier the point is on, else the room floor.
    floorAt(x, z) {
      const d = Math.hypot(x, z)
      for (const [radius, h] of tiers) if (d <= radius) return h
      return 0
    },
    // Keeps a camera position inside the walls and under the ceiling (mutates `p`).
    clampInside(p, margin) {
      const lim = H - margin
      p.x = Math.max(-lim, Math.min(lim, p.x))
      p.z = Math.max(-lim, Math.min(lim, p.z))
      p.y = Math.max(0.4, Math.min(WALL_H - margin, p.y))
    },
  }
}
