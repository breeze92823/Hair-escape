// Shared props for the outer zones (10-14), so each zone file stays about its own
// theme: the yellow win pad with its red rim and spinning gold trophy, the cyan "paid"
// pad with a glass cup (decoration, as on Zones 8-9), the gold bonus ring with its hit
// test, the floating "RECOMMENDED / LEVEL" sign, floor decals, checkpoints (where a
// fall puts you back), and moving platforms that carry the player standing on them
// (rafts, hover pads, orbiting rocks). Zones 2-9 build their own copies of the pads.
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, TorusGeometry } from 'three'
import { label } from './lobby/labels.js'

export const PAD_SIZE = 3.6 // m, the win pads
const CARRY_MARGIN = 0.3 // m past a mover's edge that still counts as standing on it (the player's radius)
const CHEST = 0.9 // m above the feet the rings test against

let mats = null
const materials = (k) => (mats ??= {
  rim: k.std('#ff3d3d'),
  pad: k.std('#ffe11a', { emissive: '#ffc400', emissiveIntensity: 0.45, roughness: 0.4 }),
  gold: k.std('#ffcf1f', { emissive: '#d99a00', emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.3 }),
  cyan: k.std('#3fe0ff', { emissive: '#1aa8e0', emissiveIntensity: 0.45, roughness: 0.4 }),
  glass: k.std('#c8f8ff', { emissive: '#6ad8f0', emissiveIntensity: 0.3, transparent: true, opacity: 0.65, roughness: 0.1 }),
  ring: k.std('#ffd21a', { emissive: '#ffb000', emissiveIntensity: 0.6, roughness: 0.3 }),
})

// The yellow win pad with a red rim, a big spinning gold trophy and a "+N Wins" label.
// Returns { onPad(p), update(time) }.
export function winPad(k, x, z, top, wins) {
  const m = materials(k)
  k.mesh(new BoxGeometry(PAD_SIZE + 0.4, 0.1, PAD_SIZE + 0.4), m.rim, x, top + 0.05, z, { cast: false })
  k.mesh(new BoxGeometry(PAD_SIZE, 0.16, PAD_SIZE), m.pad, x, top + 0.08, z, { cast: false })
  const trophy = new Group()
  const part = (geo, y) => {
    const t = new Mesh(geo, m.gold)
    t.position.y = y
    trophy.add(t)
  }
  part(new BoxGeometry(0.55, 0.16, 0.55), 0)
  part(new CylinderGeometry(0.07, 0.1, 0.3, 10), 0.23)
  part(new CylinderGeometry(0.38, 0.16, 0.5, 16), 0.63)
  part(new BoxGeometry(0.95, 0.08, 0.08), 0.68) // handles
  trophy.scale.setScalar(1.6)
  trophy.position.set(x, top + 1.2, z)
  k.g.add(trophy)
  label(k.g, [{ text: `+${wins} Wins`, size: 0.7, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }], [x, top + 3.2, z], { unit: 1.4 })
  return {
    onPad: (p) => Math.abs(p.x - x) < PAD_SIZE / 2 && Math.abs(p.z - z) < PAD_SIZE / 2 && p.y >= top - 0.05,
    update(time) {
      trophy.rotation.y = time * 1.5
      trophy.position.y = top + 1.2 + Math.sin(time * 2) * 0.1
    },
  }
}

// The cyan "+N Wins" pad with a glass cup: decoration, advertising a bigger prize.
export function paidPad(k, x, z, top, text) {
  const m = materials(k)
  k.mesh(new BoxGeometry(PAD_SIZE, 0.14, PAD_SIZE), m.cyan, x, top + 0.07, z, { cast: false })
  k.mesh(new CylinderGeometry(0.5, 0.22, 0.8, 16), m.glass, x, top + 1.1, z, { cast: false })
  k.mesh(new CylinderGeometry(0.1, 0.12, 0.5, 8), m.glass, x, top + 0.45, z, { cast: false })
  label(k.g, [{ text, size: 0.7, fill: ['#d6fbff', '#3fd8ff'], stroke: '#0a3a5a' }], [x, top + 2.4, z], { unit: 1.4 })
}

// A gold ring at `ring` { x, y, z, radius, reach } whose plane faces south (z = ring.z):
// the hit counts the chest within the radius and `reach` m either side of the plane.
// Returns { mesh, hit(p), update(time) }; the zone keeps the once-per-run flag.
export function bonusRing(k, ring, wins) {
  const mesh = new Mesh(new TorusGeometry(ring.radius, 0.16, 10, 32), materials(k).ring)
  mesh.position.set(ring.x, ring.y, ring.z)
  k.g.add(mesh)
  label(k.g, [{ text: `🏆 +${wins} Win${wins > 1 ? 's' : ''}`, size: 0.5, fill: ['#fff7a8', '#ffd21a'], stroke: '#5a3a00' }], [ring.x, ring.y + ring.radius + 0.6, ring.z], { unit: 1.2 })
  return {
    mesh,
    hit: (p) => Math.abs(p.z - ring.z) < ring.reach && Math.hypot(p.x - ring.x, p.y + CHEST - mesh.position.y) < ring.radius,
    update(time) {
      mesh.position.y = ring.y + Math.sin(time * 2) * 0.12
    },
  }
}

// The floating "RECOMMENDED / LEVEL n" sign.
export function levelSign(g, level, [x, y, z], { fill = ['#7ff6ff', '#3fd8ff'], stroke = '#0a2a3a', big = '#ffffff', bigStroke = '#2a0a4a' } = {}) {
  return label(g, [
    { text: 'RECOMMENDED', size: 0.45, fill, stroke },
    { text: `LEVEL ${level}`, size: 1, fill: big, stroke: bigStroke },
  ], [x, y, z], { unit: 2.2 })
}

// A flat decal lying on a floor at y (an arrow, a helipad mark); rotY turns it (0 = pointing north).
export function floorDecal(k, map, x, y, z, size, rotY = 0) {
  const m = k.mesh(new PlaneGeometry(size, size), new MeshBasicMaterial({ map, transparent: true, depthWrite: false }), x, y + 0.03, z, { cast: false })
  m.rotation.x = -Math.PI / 2
  m.rotation.z = rotY
  m.receiveShadow = false
  return m
}

// Checkpoints: `spots` [{ z, spot }] south to north. The farthest one whose z the
// player has passed, at about its height (so not while falling past it), is where a
// fall puts them. reset() on the way home, with the zone's once-per-run awards.
export function createCheckpoints(spots) {
  let index = 0
  return {
    update(p) {
      for (let i = spots.length - 1; i > index; i--) {
        const s = spots[i]
        if (p.z <= s.z && Math.abs(p.y - s.spot.y) < 1.5) {
          index = i
          break
        }
      }
    },
    spot: () => spots[index].spot,
    reset() {
      index = 0
    },
  }
}

// Moving platforms. `group` holds a platform's meshes built round the origin with the
// walkable top at local y 0; it has a w x d footprint and is `h` deep; path(time, out)
// writes the top centre's world position into `out`. Each frame the collider box and the
// group move to the path, and the player standing on one is carried along with it.
export function createMovers(addCollider) {
  const list = []
  const pos = { x: 0, y: 0, z: 0 }
  return {
    add(group, { w, d, h, path }) {
      path(0, pos)
      group.position.set(pos.x, pos.y, pos.z)
      const box = addCollider(pos.x, pos.z, w, d, pos.y, 0, pos.y - h)
      list.push({ group, box, h, path })
      return box
    },
    // `carry` false while the player rides the hair cable: the platform moves, the player does not follow it.
    update(time, p, carry = true) {
      for (const m of list) {
        const b = m.box
        const standing = carry && p.y <= b.y1 + 0.08 && p.y >= b.y1 - 0.5 && Math.abs(p.x - b.cx) <= b.hx + CARRY_MARGIN && Math.abs(p.z - b.cz) <= b.hz + CARRY_MARGIN
        m.path(time, pos)
        const dx = pos.x - b.cx
        const dz = pos.z - b.cz
        b.cx = pos.x
        b.cz = pos.z
        b.y1 = pos.y
        b.y0 = pos.y - m.h
        m.group.position.set(pos.x, pos.y, pos.z)
        if (standing) {
          p.x += dx
          p.z += dz
          p.y = pos.y
        }
      }
    },
  }
}
