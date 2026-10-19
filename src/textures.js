import { BoxGeometry, CanvasTexture, Group, Mesh, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'
import { MATERIAL_PBR } from './config.js'

// Procedural canvas textures + PBR materials (no image assets). Each painter
// returns { color, height } canvases; `pbrMaterial` wires them into a
// MeshStandardMaterial with a bump map.
const SIZE = 256

function mulberry32(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvases() {
  const color = document.createElement('canvas')
  const height = document.createElement('canvas')
  color.width = color.height = height.width = height.height = SIZE
  return { color, height, c: color.getContext('2d'), h: height.getContext('2d') }
}

function paintBricks() {
  const rand = mulberry32(7)
  const { color, height, c, h } = canvases()
  c.fillStyle = '#6f675d'
  c.fillRect(0, 0, SIZE, SIZE)
  h.fillStyle = '#202020'
  h.fillRect(0, 0, SIZE, SIZE)
  const rows = 4
  const cols = 2
  const bh = SIZE / rows
  const bw = SIZE / cols
  for (let r = 0; r < rows; r++) {
    for (let k = -1; k <= cols; k++) {
      const x = k * bw + (r % 2 ? bw / 2 : 0)
      c.fillStyle = `hsl(28 ${12 + rand() * 8}% ${58 + rand() * 12}%)`
      c.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6)
      h.fillStyle = '#d0d0d0'
      h.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6)
    }
  }
  return { color, height }
}

function paintPlanks() {
  const rand = mulberry32(21)
  const { color, height, c, h } = canvases()
  const planks = 4
  const pw = SIZE / planks
  for (let i = 0; i < planks; i++) {
    c.fillStyle = `hsl(28 48% ${36 + rand() * 12}%)`
    c.fillRect(i * pw, 0, pw, SIZE)
    h.fillStyle = '#c0c0c0'
    h.fillRect(i * pw, 0, pw, SIZE)
    for (let g = 0; g < 18; g++) {
      const x = i * pw + rand() * pw
      c.strokeStyle = `rgba(60,30,10,${0.15 + rand() * 0.2})`
      c.lineWidth = 1
      c.beginPath()
      c.moveTo(x, 0)
      c.lineTo(x + (rand() - 0.5) * 4, SIZE)
      c.stroke()
    }
    c.fillStyle = '#4a2a10'
    c.fillRect(i * pw, 0, 2, SIZE)
    h.fillStyle = '#101010'
    h.fillRect(i * pw, 0, 2, SIZE)
  }
  return { color, height }
}

function texture(canvas, srgb, repeatX, repeatY) {
  const t = new CanvasTexture(canvas)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.anisotropy = 8
  if (srgb) t.colorSpace = SRGBColorSpace
  return t
}

export function pbrMaterial({ color, height }, pbr, repeatX = 1, repeatY = 1, bumpScale = 1) {
  return new MeshStandardMaterial({
    map: texture(color, true, repeatX, repeatY),
    bumpMap: texture(height, false, repeatX, repeatY),
    bumpScale,
    ...pbr,
  })
}

const PAINTERS = {
  brick: () => pbrMaterial(paintBricks(), MATERIAL_PBR.STONE, 1, 1, 1.5),
  wood: () => pbrMaterial(paintPlanks(), MATERIAL_PBR.WOOD, 1, 1, 1),
}

// A solid box prop. Registers its (yaw-rotated) collider so the player walks
// into / onto it. Each box gets its own material so texture repeat follows its
// size and the pattern stays roughly 1 tile per 2 m.
function solidBox(parent, addCollider, { x, z, w, d, h, y0 = 0, rotY = 0, material = 'brick' }) {
  const mat = PAINTERS[material]()
  const rx = Math.max(1, Math.round(Math.max(w, d) / 2))
  const ry = Math.max(1, Math.round(h / 2))
  mat.map.repeat.set(rx, ry)
  mat.bumpMap.repeat.set(rx, ry)
  const mesh = new Mesh(new BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y0 + h / 2, z)
  mesh.rotation.y = rotY
  mesh.castShadow = mesh.receiveShadow = true
  parent.add(mesh)
  addCollider(x, z, w, d, y0 + h, rotY, y0)
  return mesh
}
