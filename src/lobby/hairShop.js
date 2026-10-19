// The HAIR SHOP on the west bleachers: every style on display as a big strand
// turning slowly over a glowing ring, with its name, bonus and unlock state
// floating above. Walk up and press E to equip (or buy / claim) it.
//
// Models by `kind`: 'wavy' (default S-curve strand), 'braids' (twin plaits),
// 'curly' (a tight spiral). `stripes` paints the blobs in bands; `extra` adds
// a flourish: heart, crystal shards, a void swirl, sparkles, a glow or drips.
import {
  AdditiveBlending, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, OctahedronGeometry, RingGeometry,
  Shape, ExtrudeGeometry, SphereGeometry, TorusGeometry, ConeGeometry,
} from 'three'
import { label } from './labels.js'
import { player } from '../player.js'
import { HAIR_STYLES, canAcquire, canEquip, limitedLeft, requirementText } from '../game/state.js'

const sphere = new SphereGeometry(1, 20, 14)
const mats = new Map()
function hairMat(color, glow = 0.12) {
  const key = `${color}|${glow}`
  if (!mats.has(key)) mats.set(key, new MeshStandardMaterial({ color, roughness: 0.42, emissive: color, emissiveIntensity: glow }))
  return mats.get(key)
}

function blob(g, material, r, x, y, z, stretch = 1.25) {
  const m = new Mesh(sphere, material)
  m.scale.set(r, r * stretch, r)
  m.position.set(x, y, z)
  m.castShadow = true
  g.add(m)
  return m
}

// One strand of `n` blobs from `top` down `len`, swinging `swing` sideways.
function strand(g, style, { x0 = 0, top = 3.3, len = 3, n = 16, r0 = 0.5, r1 = 0.24, swing = 0.42, waves = 2.2, phase = 0, glow }) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const color = style.stripes ? style.stripes[Math.floor(i / 2) % style.stripes.length] : i === n - 1 ? style.tip : style.color
    blob(g, hairMat(color, glow), r0 - t * (r0 - r1), x0 + Math.sin(t * Math.PI * waves + phase) * swing, top - t * len, Math.cos(t * Math.PI * 1.4 + phase) * 0.15)
  }
}

function heartMesh() {
  const s = new Shape()
  s.moveTo(0, -0.5)
  s.bezierCurveTo(-0.9, 0.1, -0.5, 0.8, 0, 0.35)
  s.bezierCurveTo(0.5, 0.8, 0.9, 0.1, 0, -0.5)
  const geo = new ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06 })
  geo.translate(0, 0, -0.125)
  return new Mesh(geo, new MeshStandardMaterial({ color: '#ff4fa8', roughness: 0.3, emissive: '#ff2f8a', emissiveIntensity: 0.35 }))
}

function hairModel(style) {
  const g = new Group()
  const spin = [] // pieces animated every frame: { mesh, kind }
  const glow = style.extra === 'glow' ? 0.4 : style.id === 'void' ? 0.25 : 0.12

  if (style.kind === 'braids') {
    blob(g, hairMat(style.color, glow), 0.75, 0, 3.45, 0, 0.7) // crown
    for (const side of [-1, 1]) {
      for (let i = 0; i < 14; i++) {
        const t = i / 13
        const r = 0.34 - t * 0.12
        // Alternate the plait's blobs left/right of the strand line.
        const x = side * (0.55 + t * 0.15) + (i % 2 ? 0.1 : -0.1)
        blob(g, hairMat(i % 2 ? style.tip : style.color, glow), r, x, 3.1 - t * 2.9, 0, 1.1)
      }
      const bow = new Mesh(new TorusGeometry(0.16, 0.07, 8, 16), hairMat('#ff5fb4', 0.3))
      bow.position.set(side * 0.7, 0.35, 0.05)
      g.add(bow)
    }
  } else if (style.kind === 'curly') {
    blob(g, hairMat(style.tip, glow), 0.72, 0, 3.5, 0, 0.75)
    for (let i = 0; i < 26; i++) {
      const t = i / 25
      const a = t * Math.PI * 7
      const rad = 0.55 - t * 0.2
      blob(g, hairMat(i % 3 ? style.color : style.tip, glow), 0.32 - t * 0.1, Math.cos(a) * rad, 3.25 - t * 3, Math.sin(a) * rad, 1)
    }
  } else {
    blob(g, hairMat(style.stripes ? style.stripes[0] : style.tip, glow), 0.62, 0, 3.55, 0, 0.8) // cap
    strand(g, style, { glow })
  }

  if (style.extra === 'heart') {
    const h = heartMesh()
    h.position.set(0.55, 3.7, 0.2)
    h.scale.setScalar(0.85)
    g.add(h)
    spin.push({ mesh: h, kind: 'bob' })
  } else if (style.extra === 'crystal') {
    const shardMat = new MeshStandardMaterial({ color: '#e8feff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85, emissive: '#7fe8ff', emissiveIntensity: 0.5 })
    for (const [x, y, z, s] of [[0.7, 2.6, 0.2, 0.32], [-0.6, 1.6, -0.2, 0.26], [0.5, 0.9, -0.3, 0.22], [-0.4, 3.0, 0.3, 0.2]]) {
      const c = new Mesh(new OctahedronGeometry(s), shardMat)
      c.scale.y = 1.8
      c.position.set(x, y, z)
      g.add(c)
      spin.push({ mesh: c, kind: 'twirl' })
    }
  } else if (style.extra === 'void') {
    const swirl = new Group()
    swirl.position.y = 2
    for (let i = 0; i < 3; i++) {
      const ring = new Mesh(
        new TorusGeometry(1.0 + i * 0.25, 0.05, 6, 40, Math.PI * 1.3),
        new MeshBasicMaterial({ color: i % 2 ? '#7a3cff' : '#2a0a6a', transparent: true, opacity: 0.8 }),
      )
      ring.rotation.set(Math.PI / 2 + i * 0.3, 0, i * 2)
      swirl.add(ring)
    }
    g.add(swirl)
    spin.push({ mesh: swirl, kind: 'swirl' })
  } else if (style.extra === 'sparkle') {
    const sparkMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false })
    for (let i = 0; i < 6; i++) {
      const sp = new Mesh(new OctahedronGeometry(0.09), sparkMat)
      sp.userData.phase = i
      g.add(sp)
      spin.push({ mesh: sp, kind: 'orbit' })
    }
  } else if (style.extra === 'drip') {
    const drop = blob(g, hairMat(style.color, 0.2), 0.12, 0.3, 0.1, 0.1, 1.6)
    spin.push({ mesh: drop, kind: 'drip' })
  } else if (style.extra === 'bow') {
    const pink = hairMat('#ff3fa8', 0.3)
    for (const side of [-1, 1]) {
      const loop = new Mesh(new TorusGeometry(0.28, 0.1, 8, 20), pink)
      loop.position.set(side * 0.32, 4.05, 0)
      loop.rotation.y = Math.PI / 2
      loop.scale.set(1, 0.8, 1.3)
      g.add(loop)
    }
    blob(g, pink, 0.14, 0, 4.05, 0, 1)
  } else if (style.extra === 'horns') {
    const horn = new MeshStandardMaterial({ color: '#2a0a0a', roughness: 0.35, emissive: '#ff3b00', emissiveIntensity: 0.25 })
    for (const side of [-1, 1]) {
      const h = new Mesh(new ConeGeometry(0.16, 0.9, 8), horn)
      h.position.set(side * 0.38, 4.05, -0.05)
      h.rotation.z = -side * 0.5
      g.add(h)
    }
    const ember = new MeshBasicMaterial({ color: '#ffb000', transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false })
    for (let i = 0; i < 6; i++) {
      const sp = new Mesh(new OctahedronGeometry(0.08), ember)
      sp.userData.phase = i
      g.add(sp)
      spin.push({ mesh: sp, kind: 'orbit' })
    }
  } else if (style.extra === 'glow') {
    const halo = new Mesh(new SphereGeometry(1.25, 16, 12), new MeshBasicMaterial({ color: style.color, transparent: true, opacity: 0.12, blending: AdditiveBlending, depthWrite: false }))
    halo.scale.set(1, 1.9, 1)
    halo.position.y = 2
    g.add(halo)
    spin.push({ mesh: halo, kind: 'pulse' })
  }

  g.userData.animate = (time) => {
    for (const s of spin) {
      const m = s.mesh
      if (s.kind === 'bob') m.position.y = 3.7 + Math.sin(time * 3) * 0.12
      else if (s.kind === 'twirl') m.rotation.y = time * 2
      else if (s.kind === 'swirl') m.rotation.y = -time * 2.5
      else if (s.kind === 'pulse') m.material.opacity = 0.1 + Math.sin(time * 3) * 0.05
      else if (s.kind === 'drip') {
        const t = (time * 0.7) % 1
        m.position.y = 0.2 - t * 0.6
        m.visible = t < 0.85
      } else if (s.kind === 'orbit') {
        const a = time * 1.8 + m.userData.phase * 1.05
        m.position.set(Math.cos(a) * 0.95, 0.5 + ((time * 0.6 + m.userData.phase / 6) % 1) * 3.2, Math.sin(a) * 0.95)
      }
    }
  }
  return g
}

// spots: [{ id, x, y (floor height), z, scale = 1, compact = false, noName = false }]
// `compact` items (the limited corner) get a small name with a pill tag. The
// bonus / requirement card only shows on the item nearest the player (see showNearestInfo).
export function buildHairShop(parent, addCollider, spots) {
  return spots.map(({ id, x, y, z, scale = 1, compact = false, noName = false }) => {
    const style = { ...HAIR_STYLES[id], id }
    const root = new Group()
    root.position.set(x, y, z)
    root.scale.setScalar(scale)
    parent.add(root)

    const plinth = new Mesh(new CylinderGeometry(1.25, 1.4, 0.35, 28), new MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }))
    plinth.position.y = 0.175
    plinth.receiveShadow = plinth.castShadow = true
    root.add(plinth)
    const ring = new Mesh(
      new RingGeometry(1.35, 1.75, 40),
      new MeshBasicMaterial({ color: style.color, transparent: true, opacity: 0.55, blending: AdditiveBlending, side: DoubleSide, depthWrite: false }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.03
    root.add(ring)
    addCollider(x, z, 2.2 * scale, 2.2 * scale, y + 0.35 * scale, 0, y)

    const model = hairModel(style)
    model.position.y = 0.35
    root.add(model)

    const nameY = y + (compact ? 4.7 : 4.9) * scale
    const name = label(parent, [], [x, nameY, z], { unit: compact ? 1.0 : 1.25 * scale })
    name.sprite.visible = !noName
    const info = label(parent, [], [x + 1.4 * scale, y + 0.9, z], { unit: compact ? 0.6 : 0.85 })

    const tagFor = () => {
      if (style.limitedUntil != null) {
        const d = Math.ceil(limitedLeft(id) / 86400000)
        return { text: d > 0 ? `⏱ ${d} DAYS` : 'EXPIRED', size: 0.34, fill: '#ffffff', bg: '#ff6a1a' }
      }
      if (style.rebirths) return { text: `🔄 ${style.rebirths} REBIRTHS`, size: 0.34, fill: '#ffffff', bg: '#2a2b45' }
      return null
    }

    return {
      id,
      style,
      position: { x, y: y + 1, z },
      range: compact ? 3 : 7.5,
      distance: () => Math.hypot(player.position.x - x, player.position.z - z) + Math.abs(player.position.y - y),
      showInfo: (on) => (info.sprite.visible = on),
      refresh(state) {
        const tag = compact ? tagFor() : null
        name.set(tag ? [{ text: style.name, size: 0.42, fill: style.label }, tag] : [{ text: style.name, size: 0.9, fill: style.label }])
        const lines = [{ text: `+${style.bonus} / Hair`, size: 0.7, fill: '#ffffff' }]
        if (state.equipped === id) lines.push({ text: 'EQUIPPED', size: 0.7, fill: ['#fff27a', '#ffb000'] })
        else if (canEquip(id)) lines.push({ text: 'Press E to Equip', size: 0.6, fill: ['#b6ff7a', '#33d11c'] })
        else if (canAcquire(id)) lines.push({ text: style.cost != null ? 'Press E to Buy' : 'Press E to Claim', size: 0.6, fill: ['#b6ff7a', '#33d11c'] })
        else lines.push({ text: requirementText(id), size: 0.7, fill: ['#fff27a', '#ffb000'] })
        info.set(lines)
      },
      update(dt, time) {
        model.rotation.y += dt * 0.6
        model.position.y = 0.45 + Math.sin(time * 1.6 + z) * 0.12
        model.userData.animate(time)
        ring.material.opacity = 0.4 + Math.sin(time * 2.4 + z) * 0.15
        name.sprite.position.y = nameY + Math.sin(time * 1.6 + z) * 0.08
      },
    }
  })
}

// Only the closest display within its range shows its bonus / requirement card,
// so a row of hair never stacks a wall of text.
export function showNearestInfo(items) {
  let best = null
  let bestD = Infinity
  for (const it of items) {
    const d = it.distance()
    if (d < bestD) {
      best = it
      bestD = d
    }
  }
  for (const it of items) it.showInfo(it === best && bestD < it.range)
}
