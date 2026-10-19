// The south end of the hall (looking back from the portal): the CHESTS wall
// with a blue swirl arch in the middle, the Rebirth Chest on the east side,
// the Group / Shampoo / Golden Comb chests on the west, and the NEW!
// HAIRSTYLES corner with the LIMITED Dragon Lord bundle.
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, CircleGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
  OctahedronGeometry, PlaneGeometry, SphereGeometry, SRGBColorSpace, TorusGeometry,
} from 'three'
import { makeCanvas, onFontReady, outlinedText, studMaterial } from './paint.js'
import { label } from './labels.js'
import { add, bundleBoard, clock, slab, std } from './build.js'
import { CHESTS, DRAGON_BUNDLE, HAIR_STYLES, chestRequirement, chestWait, openChest } from '../game/state.js'

// Big painted lettering on a wall: a transparent plane facing `rotY`.
export function wallText(g, text, fill, stroke, [x, y, z], rotY, width = 15) {
  const canvas = makeCanvas(1024, 192)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const paint = () => {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 1024, 192)
    outlinedText(ctx, text, 512, 100, 140, { fill, stroke, strokeRatio: 0.12 })
    tex.needsUpdate = true
  }
  paint()
  onFontReady(paint)
  add(g, new PlaneGeometry(width, width * 0.1875), new MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }), [x, y, z], { rot: [0, rotY, 0], cast: false })
}

// --- Chests -----------------------------------------------------------------
// A chunky treasure chest: box body, half-barrel lid hinged at the back,
// metal bands and a lock plate. Returns the group and its lid pivot.
function chestModel({ body, trim, lid = body, inner = '#fff27a' }) {
  const g = new Group()
  const bodyMat = std(body, { roughness: 0.45 })
  const trimMat = std(trim, { roughness: 0.3, metalness: 0.4 })
  add(g, new BoxGeometry(1.6, 0.9, 1.1), bodyMat, [0, 0.45, 0])
  for (const x of [-0.6, 0.6]) add(g, new BoxGeometry(0.14, 0.92, 1.12), trimMat, [x, 0.45, 0])
  add(g, new BoxGeometry(1.62, 0.1, 1.12), trimMat, [0, 0.05, 0])
  // Glow inside, seen when the lid lifts.
  const glow = add(g, new PlaneGeometry(1.4, 0.9), new MeshBasicMaterial({ color: inner, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }), [0, 0.92, 0], { rot: [-Math.PI / 2, 0, 0], cast: false })
  const pivot = new Group()
  pivot.position.set(0, 0.9, -0.55)
  g.add(pivot)
  const lidGeo = new CylinderGeometry(0.55, 0.55, 1.6, 20, 1, false, 0, Math.PI)
  // Half cylinder (theta 0..PI is its x >= 0 side); turning its axis onto X puts that half on top.
  add(pivot, lidGeo, std(lid, { roughness: 0.45 }), [0, 0, 0.55], { rot: [0, 0, Math.PI / 2] })
  for (const x of [-0.6, 0.6]) {
    add(pivot, new CylinderGeometry(0.57, 0.57, 0.14, 20, 1, false, 0, Math.PI), trimMat, [x, 0, 0.55], { rot: [0, 0, Math.PI / 2] })
  }
  add(pivot, new BoxGeometry(0.34, 0.4, 0.08), trimMat, [0, -0.05, 1.12]) // lock plate
  return { g, pivot, glow }
}

const CHEST_SPOTS = [
  // The big purple Rebirth Chest on a pink podium (east of the arch).
  { id: 'rebirth', x: 6.2, z: 42, scale: 1.7, colors: { body: '#a03cff', trim: '#ffd21a', lid: '#c06bff', inner: '#ff9cf6' }, podium: '#ff6ad5', top: ['EVERY 3 REBIRTHS', '#ffb0ff'] },
  { id: 'group', x: -5.2, z: 43, scale: 1.25, colors: { body: '#ffcf1a', trim: '#2f7dff', lid: '#ffe46b' }, podium: '#2f7dff' },
  { id: 'shampoo', x: -9.0, z: 41.5, scale: 1.2, lift: 1.5, colors: { body: '#5fe0ff', trim: '#ff5fc0', lid: '#a8f0ff', inner: '#ffffff' }, podium: '#ff9ad8' },
  { id: 'comb', x: -12.8, z: 43, scale: 1.3, colors: { body: '#a0612a', trim: '#ffd21a', lid: '#b9773a' }, podium: '#5fd0ff' },
]

function buildChests(g, addCollider) {
  return CHEST_SPOTS.map((spot) => {
    const { id, x, z, scale } = spot
    const root = new Group()
    root.position.set(x, 0, z)
    g.add(root)
    // Two-tier round podium.
    add(root, new CylinderGeometry(1.6 * scale, 1.75 * scale, 0.35, 32), studMaterial(spot.podium, 3, 1), [0, 0.175, 0])
    add(root, new CylinderGeometry(1.25 * scale, 1.3 * scale, 0.25, 32), std('#ffffff', { roughness: 0.4 }), [0, 0.47, 0])
    addCollider(x, z, 2.6 * scale, 2.6 * scale, 0.6)
    const chest = chestModel(spot.colors)
    chest.g.position.y = 0.6
    chest.g.scale.setScalar(scale)
    chest.g.rotation.y = Math.PI // lock plate faces north, toward the room
    root.add(chest.g)

    // Per-chest props.
    if (id === 'rebirth') {
      const gem = new MeshBasicMaterial({ color: '#ff9cf6', toneMapped: false })
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2
        add(root, new OctahedronGeometry(0.18 + (i % 3) * 0.05), i % 2 ? gem : std('#ffd21a', { metalness: 0.5, roughness: 0.3 }), [Math.cos(a) * 1.9, 0.75, Math.sin(a) * 1.9])
      }
    } else if (id === 'shampoo') {
      // Shampoo bottles around the podium.
      for (const [bx, bz, col] of [[-1.5, 0.6, '#ff5fc0'], [1.5, 0.5, '#5fe0ff'], [1.3, -0.9, '#ffd21a']]) {
        add(root, new CylinderGeometry(0.22, 0.25, 0.8, 14), std(col, { roughness: 0.25 }), [bx, 0.75, bz])
        add(root, new CylinderGeometry(0.1, 0.12, 0.2, 10), std('#ffffff'), [bx, 1.25, bz])
      }
    } else if (id === 'comb') {
      // A golden comb lying on the lid.
      const comb = new Group()
      comb.position.set(0, 0.6 + 1.62 * scale, 0)
      root.add(comb)
      const gold = std('#ffd21a', { metalness: 0.6, roughness: 0.25, emissive: '#b07800', emissiveIntensity: 0.3 })
      add(comb, new BoxGeometry(1.5, 0.22, 0.12), gold, [0, 0.25, 0])
      for (let i = 0; i < 9; i++) add(comb, new BoxGeometry(0.07, 0.4, 0.08), gold, [-0.64 + i * 0.16, 0, 0])
      comb.rotation.z = 0.15
    }

    const lines = (wait) => {
      const top = spot.top ? [{ text: spot.top[0], size: 0.38, fill: spot.top[1] }] : []
      const name = { text: CHESTS[id].name, size: 0.62, fill: ['#ffffff', '#ffe9a8'] }
      let status
      if (wait === 0) status = { text: 'READY!', size: 0.45, fill: '#ffffff', bg: '#33d11c', border: '#0f4a0a' }
      else if (wait === Infinity) status = { text: `🔒 ${chestRequirement(id)}`, size: 0.42, fill: '#ffffff', bg: '#2a2b45' }
      else status = { text: clock(wait), size: 0.45, fill: '#ffffff', bg: '#2a2b45' }
      return [...top, name, status]
    }
    // `lift` staggers neighbouring signs so the close-set chests don't overlap.
    const sign = label(g, lines(chestWait(id)), [x, 2.6 + 1.6 * scale + (spot.lift ?? 0), z], { unit: 1.75 })
    let openT = -1 // lobby time the lid started opening
    let openPending = false

    return {
      update(dt, time) {
        const wait = chestWait(id)
        sign.set(lines(wait))
        if (openPending) {
          openT = time
          openPending = false
        }
        let lidAngle = 0
        if (openT >= 0) {
          const t = time - openT
          lidAngle = t < 0.4 ? (t / 0.4) * 1.9 : t < 2.4 ? 1.9 : Math.max(0, 1.9 - (t - 2.4) * 2)
          if (t > 3.5) openT = -1
          chest.glow.material.opacity = Math.min(1, lidAngle / 1.9) * 0.9
        } else if (wait === 0) {
          lidAngle = 0.12 + Math.abs(Math.sin(time * 3)) * 0.12 // rattles when ready
          chest.glow.material.opacity = 0.3
        } else chest.glow.material.opacity = 0
        chest.pivot.rotation.x = -lidAngle
        chest.g.position.y = 0.6 + (wait === 0 ? Math.abs(Math.sin(time * 3)) * 0.05 : 0)
      },
      interact: {
        position: { x, y: 1, z: z - 1.6 * scale },
        radius: 2.4 + scale,
        prompt: () => {
          const wait = chestWait(id)
          if (wait === 0) return [`Open the ${CHESTS[id].name}`, true]
          if (wait === Infinity) return [`${CHESTS[id].name} needs ${chestRequirement(id)}`, false]
          return [`${CHESTS[id].name} refills in ${clock(wait)}`, false]
        },
        action: () => {
          if (openChest(id) > 0) openPending = true
        },
      },
    }
  })
}

// --- The blue swirl arch in the middle of the south wall (opens the EVENT panel).
function buildArch(g, addCollider, wallZ, onEvent) {
  const z = wallZ - 0.6
  const blue = std('#2f6dff', { roughness: 0.35, emissive: '#1a3a9a', emissiveIntensity: 0.2 })
  const purple = std('#8a3cff', { roughness: 0.35 })
  for (const side of [-1, 1]) {
    slab(g, blue, side * 2.4, z, 0.9, 1.2, 0, 5)
    addCollider(side * 2.4, z, 0.9, 1.2, 5)
  }
  const arc = add(g, new TorusGeometry(2.4, 0.45, 12, 32, Math.PI), blue, [0, 5, z])
  arc.scale.z = 1.3
  add(g, new TorusGeometry(1.95, 0.12, 8, 32, Math.PI), purple, [0, 5, z + 0.5])
  // Swirl inside.
  const sc = makeCanvas(256, 256)
  const ctx = sc.getContext('2d')
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.25, '#c08cff')
  grad.addColorStop(0.6, '#5a3cff')
  grad.addColorStop(1, '#1a2a8a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 8
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    for (let t = 0; t < 1; t += 0.02) {
      const a = t * Math.PI * 3 + (i * Math.PI) / 2
      ctx.lineTo(128 + Math.cos(a) * t * 120, 128 + Math.sin(a) * t * 120)
    }
    ctx.stroke()
  }
  const tex = new CanvasTexture(sc)
  tex.colorSpace = SRGBColorSpace
  const swirl = add(g, new CircleGeometry(1.95, 40), new MeshBasicMaterial({ map: tex, toneMapped: false }), [0, 4.2, z + 0.1], { rot: [0, Math.PI, 0], cast: false })
  add(g, new PlaneGeometry(3.9, 4.2), new MeshBasicMaterial({ color: '#2a1a8a' }), [0, 2.1, z + 0.05], { rot: [0, Math.PI, 0], cast: false })
  // Small sign plate above.
  label(g, [{ text: '👑 EVENT', size: 0.5, fill: '#ffffff', bg: '#7a3cff', border: '#2a0a5a' }], [0, 8.1, z], { unit: 1.2 })
  return {
    update(time) {
      swirl.rotation.z = time * 1.5
    },
    interact: {
      position: { x: 0, y: 1, z: z - 1.2 },
      radius: 3.2,
      prompt: () => ['Open the Hair Festival event', true],
      action: () => onEvent?.(),
    },
  }
}

// --- NEW! HAIRSTYLES corner (south-west): white stage, wall lettering, NEW! sign,
// and the Dragon Lord bundle billboard. Returns the shop spots for hairShop.js.
function buildHairstyles(g, addCollider, minX) {
  const x0 = minX
  const x1 = -16.5
  const z0 = 33
  const z1 = 48.5
  const h = 0.55
  slab(g, studMaterial('#f4f2ff', z1 - z0, x1 - x0), (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0, h)
  addCollider((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h)
  slab(g, std('#ff6ad5', { roughness: 0.4 }), x1 - 0.15, (z0 + z1) / 2, 0.3, z1 - z0, h, h + 0.1)
  wallText(g, 'HAIRSTYLES', ['#ffe0f4', '#ff7ad1', '#d63cff'], '#3a0a3a', [minX + 0.3, 8.2, 40.5], Math.PI / 2, 13)
  const neu = label(g, [{ text: 'NEW!', size: 1, fill: ['#fff27a', '#ffb000'], stroke: '#3a1d00' }], [x1 + 0.6, 4.6, 35], { unit: 1.5 })
  const dragonBoard = bundleBoard(g, DRAGON_BUNDLE, HAIR_STYLES.dragon.bonus, [-21.5, 9.6, 44], 1.3)
  // A red rug and two flame torches flanking the dragon display.
  slab(g, std('#b01a1a', { roughness: 0.8 }), -21.5, 44, 5, 4.5, h, h + 0.04)
  for (const tz of [41.7, 46.3]) {
    add(g, new CylinderGeometry(0.12, 0.16, 1.6, 8), std('#3a2a1a'), [-18.6, h + 0.8, tz])
    const flame = add(g, new SphereGeometry(0.22, 10, 8), new MeshBasicMaterial({ color: '#ffb000', transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }), [-18.6, h + 1.75, tz], { cast: false })
    flame.scale.y = 1.6
    flame.userData.flame = true
  }
  const flames = []
  g.traverse((o) => o.userData.flame && flames.push(o))
  return {
    spots: [
      { id: 'pony', x: -20, y: h, z: 35, scale: 0.7, compact: true },
      { id: 'pigtails', x: -20, y: h, z: 38.6, scale: 0.7, compact: true },
      { id: 'dragon', x: -21.5, y: h, z: 44, scale: 1.2, noName: true },
    ],
    update(time) {
      dragonBoard()
      neu.sprite.position.y = 4.6 + Math.sin(time * 3) * 0.2
      flames.forEach((f, i) => (f.scale.set(1 + Math.sin(time * 9 + i) * 0.15, 1.6 + Math.sin(time * 11 + i) * 0.3, 1)))
    },
  }
}

export function buildSouth(g, addCollider, room, { onEvent } = {}) {
  wallText(g, 'CHESTS', ['#fff27a', '#ffc400', '#ff9d00'], '#3a1d00', [0, 9.2, room.maxZ - 0.3], Math.PI, 17)
  const chests = buildChests(g, addCollider)
  const arch = buildArch(g, addCollider, room.maxZ, onEvent)
  const styles = buildHairstyles(g, addCollider, room.minX)
  return {
    shopSpots: styles.spots,
    interactables: [...chests.map((c) => c.interact), arch.interact],
    update(dt, time) {
      chests.forEach((c) => c.update(dt, time))
      arch.update(time)
      styles.update(time)
    },
  }
}
