// Speed rush while the player zips along the hair cable: white and pale-cyan
// streaks radiating out from a clear centre, a cyan-tinted vignette, a wider FOV,
// a faint camera shake and a soft glow on the character. It all scales with one
// eased 0..1 intensity that follows the ride speed, and costs nothing at rest:
// the overlay is hidden and the glow switched off once the intensity hits zero.
// The overlay is one low-res canvas between the game canvas and the HUD /
// touch controls, with pointer-events off so it never blocks input.
import { AdditiveBlending, CanvasTexture, Sprite, SpriteMaterial } from 'three'
import { SPEED_FX, clamp } from './config.js'
import { setCameraShake, setFovExtra } from './camera.js'

const CSS = `
#speedfx { position: fixed; inset: 0; pointer-events: none; z-index: 3; display: none; }
#speedfx canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
#speedfx .vig { position: absolute; inset: 0; opacity: 0;
  background: radial-gradient(ellipse at center, transparent 45%, rgba(120,200,255,0.35) 75%, rgba(40,90,170,0.75) 100%); }
`

const lerp = (a, b, t) => a + (b - a) * t

// Soft round glow for the character, painted once and shared by every glow sprite.
let glowMap = null
function glowTexture() {
  if (glowMap) return glowMap
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(160,240,255,1)')
  grad.addColorStop(0.4, 'rgba(90,200,255,0.45)')
  grad.addColorStop(1, 'rgba(60,160,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return (glowMap = new CanvasTexture(c))
}

// A hidden glow sprite (opacity 0) on the shared texture: the local rider's, and each zipping
// remote player's (remotePlayers.js). Scale it to SPEED_FX.glowSize and fade it by opacity.
export function createGlowSprite() {
  const glow = new Sprite(new SpriteMaterial({ map: glowTexture(), blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }))
  glow.scale.setScalar(SPEED_FX.glowSize)
  glow.visible = false
  return glow
}

// `playerGroup` carries the glow; `height` is the player's height in m.
export function createSpeedFx(playerGroup, height) {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)
  const root = document.createElement('div')
  root.id = 'speedfx'
  const canvas = document.createElement('canvas')
  const vig = document.createElement('div')
  vig.className = 'vig'
  root.append(canvas, vig)
  document.body.appendChild(root)
  const ctx = canvas.getContext('2d')

  // Streaks: angle (rad), distance from centre and length (half-diagonals),
  // width (overlay px), speed factor, and which pass (white / cyan) draws it.
  const N = SPEED_FX.streaks
  const ang = new Float32Array(N)
  const dist = new Float32Array(N)
  const len = new Float32Array(N)
  const wid = new Float32Array(N)
  const spd = new Float32Array(N)
  function spawn(i, anywhere) {
    ang[i] = Math.random() * Math.PI * 2
    dist[i] = SPEED_FX.clearRadius + (anywhere ? Math.random() : Math.random() * 0.3)
    len[i] = lerp(SPEED_FX.streakLength[0], SPEED_FX.streakLength[1], Math.random())
    wid[i] = lerp(SPEED_FX.streakWidth[0], SPEED_FX.streakWidth[1], Math.random())
    spd[i] = 0.6 + Math.random() * 0.8
  }
  for (let i = 0; i < N; i++) spawn(i, true)

  let w = 0
  let h = 0
  function resize() {
    w = Math.max(1, Math.round(window.innerWidth * SPEED_FX.resolution))
    h = Math.max(1, Math.round(window.innerHeight * SPEED_FX.resolution))
    canvas.width = w
    canvas.height = h
  }
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('orientationchange', resize)

  const glow = createGlowSprite()
  glow.position.y = height * 0.5
  playerGroup.add(glow)

  let intensity = 0
  let shown = false

  // One pass of streaks with one colour; `odd` picks every other streak.
  function drawPass(count, odd, color, alpha) {
    const cx = w / 2
    const cy = h / 2
    const half = Math.hypot(cx, cy)
    ctx.strokeStyle = color
    ctx.globalAlpha = alpha
    for (let i = odd; i < count; i += 2) {
      const d = dist[i]
      const r0 = d * half
      const r1 = Math.min(d + len[i] * intensity, 1.5) * half
      const c = Math.cos(ang[i])
      const s = Math.sin(ang[i])
      ctx.lineWidth = wid[i]
      ctx.beginPath()
      ctx.moveTo(cx + c * r0, cy + s * r0)
      ctx.lineTo(cx + c * r1, cy + s * r1)
      ctx.stroke()
    }
  }

  // `speed01` is the ride speed as a fraction of top speed, 0 when not riding.
  function update(dt, zipping, speed01) {
    const target = zipping ? SPEED_FX.baseIntensity + (1 - SPEED_FX.baseIntensity) * clamp(speed01, 0, 1) : 0
    const rate = target > intensity ? SPEED_FX.fadeIn : SPEED_FX.fadeOut
    intensity += (target - intensity) * (1 - Math.exp(-rate * dt))
    if (target === 0 && intensity < 0.01) intensity = 0

    setFovExtra(SPEED_FX.fovBoost * intensity)
    setCameraShake(SPEED_FX.shake * intensity * intensity) // only really felt near top speed
    glow.visible = intensity > 0
    glow.material.opacity = SPEED_FX.glowOpacity * intensity

    if (intensity === 0) {
      if (shown) {
        root.style.display = 'none'
        shown = false
      }
      return
    }
    if (!shown) {
      root.style.display = 'block'
      shown = true
    }
    vig.style.opacity = (SPEED_FX.vignette * intensity).toFixed(3)

    const count = document.documentElement.classList.contains('touch-ui') ? Math.min(SPEED_FX.touchStreaks, N) : N
    for (let i = 0; i < count; i++) {
      dist[i] += SPEED_FX.streakSpeed * spd[i] * intensity * dt
      if (dist[i] > 1.3) spawn(i, false)
    }
    ctx.clearRect(0, 0, w, h)
    ctx.lineCap = 'round'
    const alpha = SPEED_FX.maxOpacity * intensity
    drawPass(count, 0, '#ffffff', alpha)
    drawPass(count, 1, '#bff0ff', alpha * 0.8)
    ctx.globalAlpha = 1
  }

  return { update }
}
