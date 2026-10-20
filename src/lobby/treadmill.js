// Treadmills: the hair-growing machines along the east wall. The belt runs
// along X; the console stands at the wall (+X) end with its screen facing the
// room, so the runner faces the wall and the belt drags them back toward -X.
// Every `STEP_TIME` of running on an unlocked belt is one "step" of hair.
//
// Each tier has a theme (frame / trim / glow colours) and an optional `deco`:
// crown, neon fins, angel wings, green spikes, a ringed planet, a black-hole vortex.
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, OctahedronGeometry, PlaneGeometry, RingGeometry, Shape, ShapeGeometry, SphereGeometry, SRGBColorSpace, TorusGeometry,
} from 'three'
import { beltTexture, makeCanvas, onFontReady, outlinedText } from './paint.js'
import { label } from './labels.js'

export const BELT_SPEED = 4.5 // m/s the belt drags the runner away from the console
export const STEP_TIME = 1 // s of running per hair step (x1 belt, Golden Hair, no rebirth = 1 hair/s)
const BELT_TOP = 0.42

export const THEMES = {
  dark: { frame: '#3b3e4a', trim: '#5c6070', glow: '#9fe8ff', screen: '#10161f' },
  blue: { frame: '#2a6bff', trim: '#1b3fae', glow: '#41e3ff', screen: '#0b1b4a' },
  pink: { frame: '#ff4fd0', trim: '#7a2cf0', glow: '#ffb0f0', screen: '#2a0b3a' },
  gold: { frame: '#ffc21a', trim: '#d48a00', glow: '#fff3a0', screen: '#2a1a00' },
  neon: { frame: '#9a2cff', trim: '#5a10b0', glow: '#ff5cf0', screen: '#1a0533' },
  angel: { frame: '#f4f6ff', trim: '#c9d4ff', glow: '#7fe8ff', screen: '#0d1630' },
  spike: { frame: '#15161c', trim: '#2a2c35', glow: '#3cff7a', screen: '#04140a' },
  galaxy: { frame: '#4a3ad0', trim: '#1a1060', glow: '#c8a8ff', screen: '#0c0630' },
  cosmic: { frame: '#ff3fa8', trim: '#5a0a3a', glow: '#ffd21a', screen: '#1a0010' },
  rainbow: { frame: '#ffffff', trim: '#ff5fc0', glow: '#7dff5a', screen: '#1a0a2a' },
}

const box = (w, h, d, material) => {
  const m = new Mesh(new BoxGeometry(w, h, d), material)
  m.castShadow = m.receiveShadow = true
  return m
}

function paintScreen(ctx, w, h, theme, mult, locked, steps) {
  ctx.fillStyle = theme.screen
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = theme.glow
  ctx.lineWidth = 6
  ctx.strokeRect(6, 6, w - 12, h - 12)
  // Side "speaker" dashes, as on the reference consoles.
  ctx.fillStyle = theme.glow
  ctx.fillRect(18, h / 2 - 4, 22, 8)
  ctx.fillRect(w - 40, h / 2 - 4, 22, 8)
  if (locked) {
    outlinedText(ctx, '🔒', w / 2, h / 2, 64, { stroke: null })
    return
  }
  ctx.strokeStyle = theme.glow
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.arc(w * 0.36, h / 2, h * 0.28, 0, Math.PI * 2)
  ctx.stroke()
  outlinedText(ctx, String(steps % 100).padStart(2, '0'), w * 0.36, h / 2 + 2, 34, { fill: '#ffffff', stroke: null })
  outlinedText(ctx, `x${mult}`, w * 0.68, h / 2, 40, { fill: theme.glow, stroke: null })
}

// --- Decorations, built in the treadmill's local frame (console at -X here; the
// group is turned to face the wall). `spin` collects { mesh, kind } to animate.
function wing(material, side) {
  const s = new Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.4, 0.9, 1.2, 1.6, 1.0, 2.2)
  s.bezierCurveTo(0.7, 1.7, 0.6, 1.5, 0.45, 1.4)
  s.bezierCurveTo(0.55, 1.2, 0.5, 1.0, 0.35, 0.9)
  s.bezierCurveTo(0.4, 0.7, 0.3, 0.5, 0, 0)
  const m = new Mesh(new ShapeGeometry(s), material)
  m.scale.set(side, 1, 1)
  return m
}

function addDeco(g, deco, theme, { front, width, spin }) {
  if (deco === 'crown') {
    const gold = new MeshStandardMaterial({ color: '#ffd21a', metalness: 0.4, roughness: 0.3, emissive: '#ffb000', emissiveIntensity: 0.3 })
    const crown = new Group()
    crown.position.set(front - 0.2, 2.75, 0)
    const band = new Mesh(new CylinderGeometry(0.42, 0.42, 0.22, 16, 1, true), gold)
    band.material.side = DoubleSide
    crown.add(band)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const c = new Mesh(new ConeGeometry(0.1, 0.32, 6), gold)
      c.position.set(Math.cos(a) * 0.42, 0.26, Math.sin(a) * 0.42)
      crown.add(c)
    }
    g.add(crown)
    spin.push({ mesh: crown, kind: 'spinY' })
    for (const side of [-1, 1]) {
      const post = new Mesh(new ConeGeometry(0.16, 0.45, 6), gold)
      post.position.set(front - 0.05, 2.3, side * (width / 2 - 0.08))
      g.add(post)
    }
  } else if (deco === 'neon') {
    for (const side of [-1, 1]) {
      const fin = new Mesh(new ConeGeometry(0.22, 1.2, 4), new MeshStandardMaterial({ color: theme.frame, emissive: theme.glow, emissiveIntensity: 0.5 }))
      fin.position.set(front - 0.05, 2.75, side * (width / 2 + 0.05))
      fin.rotation.x = side * 0.35
      g.add(fin)
    }
  } else if (deco === 'wings') {
    const white = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, side: DoubleSide, emissive: '#dfe8ff', emissiveIntensity: 0.25 })
    for (const side of [-1, 1]) {
      const w = wing(white, side)
      w.position.set(front - 0.1, 1.6, side * (width / 2 + 0.05))
      w.rotation.y = Math.PI / 2
      g.add(w)
      spin.push({ mesh: w, kind: 'flap', side })
    }
  } else if (deco === 'spikes') {
    const dark = new MeshStandardMaterial({ color: '#0d0e12', roughness: 0.4 })
    const green = new MeshStandardMaterial({ color: '#1a3a22', emissive: theme.glow, emissiveIntensity: 0.6 })
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const c = new Mesh(new ConeGeometry(0.16, 0.55, 6), i % 2 ? green : dark)
        c.position.set(front + 0.6 + i * 1.3, 0.75, side * (width / 2 + 0.05))
        g.add(c)
      }
      const horn = new Mesh(new ConeGeometry(0.14, 1.3, 6), green)
      horn.position.set(front - 0.05, 3.0, side * (width / 2 + 0.15))
      horn.rotation.x = side * 0.45
      g.add(horn)
    }
  } else if (deco === 'planet') {
    const planet = new Group()
    planet.position.set(front - 0.2, 3.5, 0)
    planet.add(new Mesh(new SphereGeometry(0.55, 24, 16), new MeshStandardMaterial({ color: '#b98cff', roughness: 0.5, emissive: '#6a3cff', emissiveIntensity: 0.3 })))
    const ring = new Mesh(new TorusGeometry(0.85, 0.07, 8, 40), new MeshStandardMaterial({ color: '#e8d8ff', emissive: '#c8a8ff', emissiveIntensity: 0.4 }))
    ring.rotation.x = Math.PI / 2.4
    planet.add(ring)
    g.add(planet)
    spin.push({ mesh: planet, kind: 'spinY' })
    const starMat = new MeshBasicMaterial({ color: '#fff6b0', toneMapped: false })
    for (let i = 0; i < 6; i++) {
      const st = new Mesh(new OctahedronGeometry(0.1), starMat)
      st.userData.phase = i
      g.add(st)
      spin.push({ mesh: st, kind: 'orbit', front })
    }
  } else if (deco === 'rainbow') {
    // A rainbow arching over the console, with a gold star on top.
    const cols = ['#ff3b3b', '#ff9a1a', '#ffd21a', '#45e01e', '#2fb8ff', '#7a3cff']
    const arc = new Group()
    arc.position.set(front - 0.1, 2.7, 0)
    arc.rotation.y = Math.PI / 2
    cols.forEach((c, i) => {
      const band = new Mesh(new TorusGeometry(1.5 - i * 0.12, 0.06, 6, 32, Math.PI), new MeshBasicMaterial({ color: c, toneMapped: false }))
      arc.add(band)
    })
    g.add(arc)
    const star = new Mesh(new OctahedronGeometry(0.35), new MeshStandardMaterial({ color: '#ffd21a', emissive: '#ffb000', emissiveIntensity: 0.6 }))
    star.position.set(front - 0.1, 4.4, 0)
    g.add(star)
    spin.push({ mesh: star, kind: 'spinY' })
  } else if (deco === 'vortex') {
    const vortex = new Group()
    vortex.position.set(front - 0.1, 3.4, 0)
    vortex.rotation.y = Math.PI / 2 // face the runner (local +X)
    const cols = ['#ffd21a', '#ff7a1a', '#ff2f5a', '#1a0010']
    cols.forEach((c, i) => {
      const r = new Mesh(new RingGeometry(0.2 + i * 0.22, 0.42 + i * 0.22, 32), new MeshBasicMaterial({ color: c, side: DoubleSide, toneMapped: false }))
      r.position.z = -i * 0.01
      vortex.add(r)
    })
    vortex.add(new Mesh(new CircleGeometry(0.22, 24), new MeshBasicMaterial({ color: '#000000', side: DoubleSide })))
    g.add(vortex)
    spin.push({ mesh: vortex, kind: 'spinZ' })
  }
  // Coloured swirl of light at the belt's foot (the higher tiers' effect).
  if (deco) {
    const swirl = new Mesh(
      new RingGeometry(0.6, 1.2, 32),
      new MeshBasicMaterial({ color: theme.glow, transparent: true, opacity: 0.35, blending: AdditiveBlending, side: DoubleSide, depthWrite: false }),
    )
    swirl.rotation.x = -Math.PI / 2
    swirl.position.set(-front - 0.5, 0.06, 0)
    g.add(swirl)
    spin.push({ mesh: swirl, kind: 'swirl' })
  }
}

// opts: { x, z, length, width, theme, deco, mult, labelY, consoleSide (+1 = console at +X) }
export function buildTreadmill(parent, addCollider, opts) {
  const { x, z, length = 6.5, width = 2.8, mult = 1, deco = null } = opts
  const side = opts.consoleSide ?? -1
  const theme = THEMES[opts.theme] ?? THEMES.dark
  const g = new Group()
  g.position.set(x, 0, z)
  if (side === 1) g.rotation.y = Math.PI // the model is built with its console at local -X
  parent.add(g)

  const frameMat = new MeshStandardMaterial({ color: theme.frame, roughness: 0.45, metalness: 0.15 })
  const trimMat = new MeshStandardMaterial({ color: theme.trim, roughness: 0.5, metalness: 0.2 })
  const glowMat = new MeshBasicMaterial({ color: theme.glow, toneMapped: false })

  // Deck + belt.
  const deck = box(length + 0.5, 0.34, width + 0.3, frameMat)
  deck.position.y = 0.17
  g.add(deck)
  const beltMap = beltTexture(length, width - 0.6)
  const belt = new Mesh(new BoxGeometry(length, 0.08, width - 0.6), new MeshStandardMaterial({ map: beltMap, roughness: 0.9 }))
  belt.position.y = BELT_TOP - 0.04
  belt.receiveShadow = true
  g.add(belt)
  for (const end of [-1, 1]) {
    const roller = new Mesh(new CylinderGeometry(0.2, 0.2, width - 0.5, 16), trimMat)
    roller.rotation.x = Math.PI / 2
    roller.position.set(end * (length / 2), 0.28, 0)
    g.add(roller)
  }
  for (const s of [-1, 1]) {
    const rail = box(length + 0.5, 0.14, 0.32, trimMat)
    rail.position.set(0, 0.41, s * (width / 2 - 0.02))
    g.add(rail)
    const strip = new Mesh(new BoxGeometry(length + 0.5, 0.05, 0.06), glowMat)
    strip.position.set(0, 0.2, s * (width / 2 + 0.16))
    g.add(strip)
  }

  // Uprights, handrails and the console.
  const front = -length / 2
  for (const s of [-1, 1]) {
    const post = box(0.18, 1.9, 0.18, trimMat)
    post.position.set(front - 0.05, 0.42 + 0.95, s * (width / 2 - 0.08))
    post.rotation.z = -0.12
    g.add(post)
    const rail = box(1.6, 0.1, 0.1, frameMat)
    rail.position.set(front + 0.75, 1.45, s * (width / 2 - 0.08))
    g.add(rail)
  }
  const console_ = box(0.5, 0.85, width + 0.1, frameMat)
  console_.position.set(front - 0.2, 2.25, 0)
  console_.rotation.z = -0.25
  g.add(console_)
  const screenCanvas = makeCanvas(256, 128)
  const screenTex = new CanvasTexture(screenCanvas)
  screenTex.colorSpace = SRGBColorSpace
  const screen = new Mesh(new PlaneGeometry(width - 0.3, 0.68), new MeshBasicMaterial({ map: screenTex, toneMapped: false }))
  screen.position.set(front + 0.07, 2.3, 0)
  screen.rotation.set(0, Math.PI / 2, 0)
  screen.rotateX(-0.25)
  g.add(screen)

  const spin = []
  addDeco(g, deco, theme, { front, width, spin })

  // The console end blocks running off the front; the deck is walkable floor.
  addCollider(x + side * (length / 2 + 0.25), z, 0.7, width + 0.3, 2.6)
  addCollider(x, z, length + 0.5, width + 0.3, BELT_TOP)

  // Floats over the console half of the belt, in front of the wall decor.
  const signs = label(parent, opts.labels ?? [], [x + side * (length / 2 - 2.2), opts.labelY ?? 4.4, z], { unit: 1.35 })

  const t = {
    mult,
    locked: false,
    steps: 0,
    signs,
    center: { x, y: 1, z },
    beltPush: { x: -side * BELT_SPEED, z: 0 },
    contains(p) {
      return Math.abs(p.x - x) < length / 2 && Math.abs(p.z - z) < width / 2 - 0.25 && p.y < BELT_TOP + 0.15
    },
    repaint() {
      paintScreen(screenCanvas.getContext('2d'), 256, 128, theme, mult, t.locked, t.steps)
      screenTex.needsUpdate = true
    },
    setLocked(locked) {
      if (t.locked === locked) return
      t.locked = locked
      t.repaint()
    },
    update(dt, time) {
      if (!t.locked) beltMap.offset.x -= (BELT_SPEED / 4) * dt // one texture repeat spans 4 m
      for (const s of spin) {
        const m = s.mesh
        if (s.kind === 'spinY') m.rotation.y = time * 1.2
        else if (s.kind === 'spinZ') m.rotation.z = -time * 3
        else if (s.kind === 'flap') m.rotation.z = Math.sin(time * 3) * 0.15
        else if (s.kind === 'swirl') {
          m.rotation.z = time * 2
          m.material.opacity = t.locked ? 0.12 : 0.3 + Math.sin(time * 4) * 0.1
        } else if (s.kind === 'orbit') {
          const a = time * 1.4 + m.userData.phase * 1.05
          m.position.set(s.front - 0.2 + Math.cos(a) * 1.2, 3.5 + Math.sin(a * 1.7) * 0.3, Math.sin(a) * 1.2)
        }
      }
    },
  }
  t.repaint()
  onFontReady(t.repaint)
  return t
}
