// The south end of the hall (looking back from the portal): the NEW!
// HAIRSTYLES corner with the LIMITED Dragon Lord bundle.
import {
  AdditiveBlending, CanvasTexture, CylinderGeometry, MeshBasicMaterial,
  PlaneGeometry, SphereGeometry, SRGBColorSpace, 
} from 'three'
import { makeCanvas, onFontReady, outlinedText, studMaterial } from './paint.js'
import { label } from './labels.js'
import { add, bundleBoard, slab, std } from './build.js'
import { DRAGON_BUNDLE, HAIR_STYLES } from '../game/state.js'

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

// --- NEW! HAIRSTYLES corner (south-west): white stage, wall lettering, NEW! sign,
// and the Dragon Lord bundle billboard. Returns the shop spots for hairShop.js.
function buildHairstyles(g, addCollider, minX) {
  const x0 = minX
  const x1 = -16.5
  const z0 = 21 // m, just south of the bleachers: the stage's north half is the braids / curls shelf
  const z1 = 48.5
  const h = 0.4 // m: well under PHYSICS.stepUp, so you walk onto the stage without jumping
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
      // The braided / curled cuts in a compact line up the shelf, north to south.
      { id: 'braids', x: -21.5, y: h, z: 22.8, scale: 0.7, compact: true },
      { id: 'tails', x: -21.5, y: h, z: 26.1, scale: 0.7, compact: true },
      { id: 'curly', x: -21.5, y: h, z: 29.4, scale: 0.7, compact: true },
      { id: 'princess', x: -21.5, y: h, z: 32.7, scale: 0.7, compact: true },
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

export function buildSouth(g, addCollider, room) {
  const styles = buildHairstyles(g, addCollider, room.minX)
  return {
    shopSpots: styles.spots,
    interactables: [],
    update(dt, time) {
      styles.update(time)
    },
  }
}
