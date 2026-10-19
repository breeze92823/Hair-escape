// Floating billboard text (the Roblox BillboardGui look): stacked lines of
// chunky outlined text on a transparent sprite. `set()` redraws in place.
import { CanvasTexture, LinearFilter, SRGBColorSpace, Sprite, SpriteMaterial } from 'three'
import { FONT, makeCanvas, onFontReady, outlinedText } from './paint.js'

const PX = 96 // canvas pixels per size unit
const PAD = 18

// line: { text, size = 1, fill = '#fff' | [top, bottom], stroke = '#1b1b2a', bg?: pill colour, border?: pill outline }
export class Label {
  constructor(lines, { unit = 0.7, depthTest = true } = {}) {
    this.unit = unit // world metres per size unit
    this.canvas = makeCanvas(8, 8)
    this.texture = new CanvasTexture(this.canvas)
    this.texture.colorSpace = SRGBColorSpace
    this.texture.minFilter = LinearFilter
    this.sprite = new Sprite(new SpriteMaterial({ map: this.texture, transparent: true, depthWrite: false, depthTest }))
    this.sprite.renderOrder = 2
    this.set(lines)
    onFontReady(() => this.draw())
  }

  set(lines) {
    const key = JSON.stringify(lines)
    if (key === this.key) return
    this.key = key
    this.lines = lines
    this.draw()
  }

  draw() {
    const measure = makeCanvas(4, 4).getContext('2d')
    let w = 0
    let h = PAD * 2
    for (const l of this.lines) {
      const px = (l.size ?? 1) * PX
      measure.font = `700 ${px}px ${FONT}`
      w = Math.max(w, measure.measureText(l.text).width + px * (l.bg ? 1.1 : 0.4))
      h += px * 1.08
    }
    w = Math.ceil(w + PAD * 2)
    h = Math.ceil(h)
    // A new canvas size needs a new texture upload size; three handles it on needsUpdate.
    this.canvas.width = w
    this.canvas.height = h
    const ctx = this.canvas.getContext('2d')
    ctx.clearRect(0, 0, w, h)
    let y = PAD
    for (const l of this.lines) {
      const px = (l.size ?? 1) * PX
      if (l.bg) {
        ctx.font = `700 ${px}px ${FONT}`
        const tw = ctx.measureText(l.text).width + px * 0.9
        const ph = px * 1.0
        ctx.beginPath()
        ctx.roundRect(w / 2 - tw / 2, y + px * 0.04, tw, ph, ph / 2)
        ctx.fillStyle = l.bg
        ctx.fill()
        ctx.lineWidth = px * 0.1
        ctx.strokeStyle = l.border ?? '#15152a'
        ctx.stroke()
      }
      outlinedText(ctx, l.text, w / 2, y + px * 0.54, px, { fill: l.fill ?? '#fff', stroke: l.stroke ?? '#1b1b2a', strokeRatio: l.strokeRatio ?? 0.22 })
      y += px * 1.08
    }
    this.texture.dispose() // size may have changed: force a fresh GPU texture
    this.texture.needsUpdate = true
    this.sprite.scale.set((w / PX) * this.unit, (h / PX) * this.unit, 1)
  }
}

export function label(parent, lines, [x, y, z], opts) {
  const l = new Label(lines, opts)
  l.sprite.position.set(x, y, z)
  parent.add(l.sprite)
  return l
}
