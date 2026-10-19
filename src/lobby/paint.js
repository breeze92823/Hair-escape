// Canvas painters for the lobby: Lego-stud surfaces, floor tiles, the
// treadmill belt, and the shared outlined game font. Everything procedural.
import { CanvasTexture, Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'

export const FONT = '"Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif'

export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function texture(canvas, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new CanvasTexture(canvas)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = aniso
  if (srgb) t.colorSpace = SRGBColorSpace
  return t
}

const shade = (hex, f) => {
  const c = new Color(hex)
  c.multiplyScalar(f)
  return `#${c.getHexString()}`
}
const tint = (hex, t) => `#${new Color(hex).lerp(new Color('#ffffff'), t).getHexString()}`

// One tile of studs (`n` x `n`) on `base`: the Roblox/Lego "studs" surface.
// Returns colour + bump canvases; cached by colour.
const studCache = new Map()
function paintStuds(base, n = 4, size = 256) {
  const key = `${base}|${n}`
  if (studCache.has(key)) return studCache.get(key)
  const color = makeCanvas(size)
  const height = makeCanvas(size)
  const c = color.getContext('2d')
  const h = height.getContext('2d')
  c.fillStyle = base
  c.fillRect(0, 0, size, size)
  h.fillStyle = '#7a7a7a'
  h.fillRect(0, 0, size, size)
  const cell = size / n
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = i * cell
      const y = j * cell
      // Faint seams between plates.
      c.strokeStyle = shade(base, 0.9)
      c.lineWidth = 2
      c.strokeRect(x + 1, y + 1, cell - 2, cell - 2)
      h.strokeStyle = '#5a5a5a'
      h.strokeRect(x + 1, y + 1, cell - 2, cell - 2)
      // Stud: shadow crescent, body, highlight.
      const cx = x + cell / 2
      const cy = y + cell / 2
      const r = cell * 0.3
      c.fillStyle = shade(base, 0.88)
      c.beginPath()
      c.arc(cx + r * 0.18, cy + r * 0.22, r, 0, Math.PI * 2)
      c.fill()
      const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r)
      g.addColorStop(0, tint(base, 0.22))
      g.addColorStop(1, base)
      c.fillStyle = g
      c.beginPath()
      c.arc(cx, cy, r, 0, Math.PI * 2)
      c.fill()
      h.fillStyle = '#d8d8d8'
      h.beginPath()
      h.arc(cx, cy, r, 0, Math.PI * 2)
      h.fill()
    }
  }
  const out = { color, height }
  studCache.set(key, out)
  return out
}

// A studded MeshStandardMaterial, `studsPerMetre` studs along each axis of
// a face that is `w` x `h` metres.
export function studMaterial(base, w, h, { studsPerMetre = 3, rough = 0.6, bump = 0.9, emissive = null } = {}) {
  const { color, height } = paintStuds(base)
  const rx = Math.max(0.25, (w * studsPerMetre) / 4)
  const ry = Math.max(0.25, (h * studsPerMetre) / 4)
  return new MeshStandardMaterial({
    map: texture(color, { repeat: [rx, ry] }),
    bumpMap: texture(height, { repeat: [rx, ry], srgb: false }),
    bumpScale: bump,
    roughness: rough,
    metalness: 0,
    ...(emissive ? { emissive, emissiveIntensity: 0.25 } : {}),
  })
}

// Cream floor tiles: big 2x2 checker with soft studs, one tile per 4 m.
export function floorMaterial(w, d) {
  const size = 512
  const color = makeCanvas(size)
  const height = makeCanvas(size)
  const c = color.getContext('2d')
  const h = height.getContext('2d')
  const tones = ['#fff1c2', '#fbe6a8']
  const half = size / 2
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      c.fillStyle = tones[(i + j) % 2]
      c.fillRect(i * half, j * half, half, half)
    }
  }
  h.fillStyle = '#808080'
  h.fillRect(0, 0, size, size)
  const n = 8
  const cell = size / n
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cx = i * cell + cell / 2
      const cy = j * cell + cell / 2
      c.fillStyle = 'rgba(255,255,255,0.28)'
      c.beginPath()
      c.arc(cx - 2, cy - 2, cell * 0.28, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = 'rgba(190,150,60,0.12)'
      c.beginPath()
      c.arc(cx + 3, cy + 3, cell * 0.28, 0, Math.PI * 2)
      c.fill()
      h.fillStyle = '#b8b8b8'
      h.beginPath()
      h.arc(cx, cy, cell * 0.28, 0, Math.PI * 2)
      h.fill()
    }
  }
  c.strokeStyle = 'rgba(200,160,80,0.35)'
  c.lineWidth = 3
  c.strokeRect(0, 0, size, size)
  c.beginPath()
  c.moveTo(half, 0)
  c.lineTo(half, size)
  c.moveTo(0, half)
  c.lineTo(size, half)
  c.stroke()
  const repeat = [w / 8, d / 8]
  return new MeshStandardMaterial({
    map: texture(color, { repeat }),
    bumpMap: texture(height, { repeat, srgb: false }),
    bumpScale: 0.6,
    roughness: 0.55,
    metalness: 0,
  })
}

// Treadmill belt: dark rubber with slats; the caller scrolls `map.offset.x`.
export function beltTexture(lengthM, widthM) {
  const color = makeCanvas(256, 64)
  const c = color.getContext('2d')
  c.fillStyle = '#26272d'
  c.fillRect(0, 0, 256, 64)
  for (let i = 0; i < 16; i++) {
    c.fillStyle = i % 2 ? '#2f3038' : '#1d1e23'
    c.fillRect(i * 16, 0, 10, 64)
  }
  c.fillStyle = 'rgba(255,255,255,0.05)'
  c.fillRect(0, 28, 256, 8)
  return texture(color, { repeat: [lengthM / 4, widthM / 2.4] })
}

// Draws outlined text (the chunky game look) centred at (x, y).
export function outlinedText(ctx, text, x, y, px, { fill = '#fff', stroke = '#1b1b2a', strokeRatio = 0.2, align = 'center' } = {}) {
  ctx.font = `700 ${px}px ${FONT}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = px * strokeRatio
    ctx.strokeText(text, x, y)
  }
  if (Array.isArray(fill)) {
    const g = ctx.createLinearGradient(0, y - px / 2, 0, y + px / 2)
    fill.forEach((col, i) => g.addColorStop(i / (fill.length - 1), col))
    ctx.fillStyle = g
  } else ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

// Repaint hooks for once the web font arrives (canvases drawn before it use the fallback).
const fontHooks = new Set()
export function onFontReady(fn) {
  fontHooks.add(fn)
}
if (typeof document !== 'undefined' && document.fonts?.load) {
  document.fonts
    .load(`700 64px Fredoka`)
    .then(() => fontHooks.forEach((fn) => fn()))
    .catch(() => {})
}
