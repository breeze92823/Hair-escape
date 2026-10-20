// The other players in the room (net.js -> server WorldState.players): each one is the game's
// character with their Bloxity cosmetics, a hair strand in their hair style's colour whose length
// follows their hair, and a name tag, eased toward the pose the server last relayed. Diffed against
// the roster every frame, so joins/leaves need no events. Remote hair is a single cheap box: the full
// rope, cuts, charms and auras are local-player only (they share one global look, avatar/hair.js).
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { MATERIAL_PBR, NET, PHYSICS } from './config.js'
import { net } from './net.js'
import { Label } from './lobby/labels.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { HAIR_STYLES } from './game/state.js'

const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

const STRAND = { width: 0.26, depth: 0.12, rootY: 1.55, backZ: -0.18, minLength: 0.5, maxLength: 3.2, perDecade: 0.75, sway: 0.5 } // m; sway = rad of streaming at full speed
const strandGeometry = new BoxGeometry(1, 1, 1)
const strandMaterials = new Map() // colour -> shared material
function strandMaterial(color) {
  let m = strandMaterials.get(color)
  if (!m) strandMaterials.set(color, (m = new MeshStandardMaterial({ ...MATERIAL_PBR.PLAYER, color })))
  return m
}
// Hair count -> metres of strand: ~0.5 m at the start, a decade of hair adds perDecade.
const strandLength = (hair) => Math.min(STRAND.maxLength, STRAND.minLength + Math.max(0, Math.log10(Math.max(hair, 1) / 3)) * STRAND.perDecade)

class Remote {
  constructor(parent) {
    this.group = new Group()
    this.group.visible = false
    parent.add(this.group)
    this.avatar = null
    this.animator = null
    this.avatarJson = null // what the current rig was built from
    this.generation = 0
    this.nameText = null
    this.label = null
    this.placed = false
    this.vy = 0
    this.length = STRAND.minLength
    // The strand hangs from a pivot at the back of the head, so tilting the pivot streams it behind.
    this.pivot = new Group()
    this.pivot.position.set(0, STRAND.rootY, STRAND.backZ)
    this.strand = new Mesh(strandGeometry, strandMaterial('#f5a321'))
    this.strand.castShadow = false
    this.pivot.add(this.strand)
    this.group.add(this.pivot)
    this.setAvatar(buildDefaultCharacter())
  }

  setAvatar(next) {
    if (this.avatar) this.group.remove(this.avatar)
    disposeAnimator(this.animator)
    this.avatar = next
    this.group.add(next)
    this.animator = makeAnimator(next)
  }

  // A signed-in player's look arrives as JSON { equipped, proportions, skin }; "" = default.
  async syncAvatar(json) {
    if (json === this.avatarJson) return
    this.avatarJson = json
    if (!json) return this.setAvatar(buildDefaultCharacter())
    const mine = ++this.generation
    let look = null
    try {
      look = JSON.parse(json)
    } catch {
      return
    }
    const group = await loadBaseCharacter()
    if (mine !== this.generation) return
    await attachEquippedAccessories(group, look?.equipped, { skinTextureUrl: look?.skin || undefined })
    if (mine !== this.generation) return
    applyProportions(group, look?.proportions)
    this.setAvatar(group)
  }

  syncName(name) {
    if (name === this.nameText) return
    this.nameText = name
    const lines = [{ text: name, size: 0.5 }]
    if (!this.label) {
      this.label = new Label(lines, { unit: 0.5 })
      this.label.sprite.position.y = NET.nameHeight
      this.group.add(this.label.sprite)
    } else this.label.set(lines)
  }

  syncHair(p) {
    this.strand.material = strandMaterial(HAIR_STYLES[p.equipped]?.color ?? '#f5a321')
    this.length = strandLength(p.hair)
    this.strand.scale.set(STRAND.width, this.length, STRAND.depth)
    this.strand.position.y = -this.length / 2
  }

  update(p, dt) {
    this.syncName(p.username || 'Player')
    this.syncAvatar(p.avatar)
    this.syncHair(p)

    const g = this.group
    const k = this.placed ? 1 - Math.exp(-NET.remoteLerp * dt) : 1
    const prevY = g.position.y
    g.position.x += (p.x - g.position.x) * k
    g.position.y += (p.y - g.position.y) * k
    g.position.z += (p.z - g.position.z) * k
    g.rotation.y += angleDelta(g.rotation.y, p.yaw) * k
    this.vy = this.placed ? this.vy + ((g.position.y - prevY) / dt - this.vy) * Math.min(1, dt * 10) : 0
    this.placed = true

    this.pivot.rotation.x = 0.05 + p.speed01 * STRAND.sway // positive x swings the tip toward -Z, away from the body
    this.animator?.update(dt, {
      grounded: p.grounded,
      speed: p.speed01 * PHYSICS.moveSpeed,
      verticalVelocity: this.vy,
      turn: 0,
      hanging: false,
      hangPitch: 0,
    })
  }

  dispose(parent) {
    parent.remove(this.group)
    disposeAnimator(this.animator)
    if (this.label) {
      this.label.texture.dispose()
      this.label.sprite.material.dispose()
    }
  }
}

export function createRemotePlayers(scene) {
  const root = new Group()
  scene.add(root)
  const remotes = new Map() // sessionId -> Remote
  const near = [] // scratch, reused every frame

  return {
    update(dt, viewer) {
      const players = net.players
      const mine = net.sessionId
      if (!players || !net.connected) {
        for (const r of remotes.values()) r.dispose(root)
        remotes.clear()
        return
      }
      // Nearest first, capped, so a full room of 50 does not drown the frame rate.
      near.length = 0
      players.forEach((p, id) => {
        if (id !== mine) near.push({ id, p, d: Math.hypot(p.x - viewer.x, p.z - viewer.z) })
      })
      near.sort((a, b) => a.d - b.d)
      const keep = new Set()
      for (const { id, p, d } of near.slice(0, NET.maxRemotes)) {
        keep.add(id)
        let r = remotes.get(id)
        if (!r) remotes.set(id, (r = new Remote(root)))
        r.group.visible = d < NET.remoteFade
        if (r.group.visible) r.update(p, dt)
        else {
          r.placed = false // out of range: skip the work, snap into place when it comes back
          r.group.position.set(p.x, p.y, p.z)
        }
      }
      for (const [id, r] of remotes) {
        if (keep.has(id)) continue
        r.dispose(root)
        remotes.delete(id)
      }
    },
  }
}
