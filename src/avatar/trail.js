// The worn run trail (the salon's Trails tab, game/cosmetics.js TRAILS): a glowing
// ribbon that streams behind the player's back while they move and fades out over
// TRAIL_FX.life. One mesh, one draw call: a ring buffer of samples, each drawn as a
// vertical edge (hip to shoulder) with its colour and alpha from its age.
// The salon has no running: it feeds the ribbon a point circling the pedestal so
// the trail can be previewed. Other players get their own ribbons (remotePlayers.js), all
// sharing one material.
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial } from 'three'
import { TRAILS } from '../game/cosmetics.js'

export const TRAIL_MIN_SPEED = 1.5 // m/s the run trail starts streaming at

let material = null
const trailMaterial = () => (material ??= new MeshBasicMaterial({ vertexColors: true, transparent: true, side: DoubleSide, depthWrite: false }))

const TRAIL_FX = {
  samples: 40, // ring buffer size
  life: 0.8, // s a sample lasts
  spacing: 0.22, // m of travel between samples
  low: 0.35, // m above the feet, bottom edge
  high: 1.35, // m above the feet, top edge
  back: 0.3, // m behind the body's centre
  hueCycle: 0.6, // 1/s the multi-colour trails cycle at
}

export function createTrail(parent) {
  const N = TRAIL_FX.samples
  const xs = new Float32Array(N)
  const ys = new Float32Array(N)
  const zs = new Float32Array(N)
  const born = new Float32Array(N) // s, when each sample was laid
  let head = 0 // next slot to write
  let count = 0 // live samples
  let lastX = 0
  let lastZ = 0
  let time = 0
  let def = null // the TRAILS entry on show, or null for none

  const geometry = new BufferGeometry()
  const positions = new Float32Array(N * 2 * 3)
  const colors = new Float32Array(N * 2 * 4)
  const index = new Uint16Array((N - 1) * 6)
  for (let i = 0, w = 0; i < N - 1; i++) {
    const a = i * 2
    index[w++] = a; index[w++] = a + 1; index[w++] = a + 2
    index[w++] = a + 1; index[w++] = a + 3; index[w++] = a + 2
  }
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 4))
  geometry.setIndex(new BufferAttribute(index, 1))
  geometry.setDrawRange(0, 0)
  const mesh = new Mesh(geometry, trailMaterial())
  mesh.frustumCulled = false
  mesh.renderOrder = 2
  parent.add(mesh)

  const ca = new Color()
  const cb = new Color()
  const c = new Color()
  // Colour of a sample at age fraction t (0 new .. 1 gone).
  const colourAt = (t) => {
    const cols = def.colors
    if (cols.length > 2) {
      // Cycle the palette along the ribbon and over time (rainbow).
      const f = (((time * TRAIL_FX.hueCycle + t) % 1) + 1) % 1
      const k = f * cols.length
      const i = Math.floor(k)
      return c.set(cols[i % cols.length]).lerp(cb.set(cols[(i + 1) % cols.length]), k - i)
    }
    return c.copy(ca).lerp(cb, t)
  }

  // Writes ribbon edge `v` (the vertical pair at a sample) and moves on.
  let v = 0
  const edge = (px, py, pz, age) => {
    const t = Math.min(1, age / TRAIL_FX.life)
    const a = 1 - t
    const col = colourAt(t)
    const p = v * 6
    positions[p] = positions[p + 3] = px
    positions[p + 1] = py + TRAIL_FX.low
    positions[p + 4] = py + TRAIL_FX.high
    positions[p + 2] = positions[p + 5] = pz
    const q = v * 8
    colors[q] = colors[q + 4] = col.r
    colors[q + 1] = colors[q + 5] = col.g
    colors[q + 2] = colors[q + 6] = col.b
    colors[q + 3] = a
    colors[q + 7] = a * 0.6
    v++
  }

  return {
    mesh,
    get on() {
      return def !== null
    },
    // Frees the ribbon's buffers (the shared material stays).
    dispose() {
      mesh.parent?.remove(mesh)
      geometry.dispose()
    },
    // id: a TRAILS id ('none' hides it).
    set(id) {
      const next = (id && id !== 'none' && TRAILS[id]) || null
      if (next === def) return
      def = next
      count = 0
      if (def && def.colors.length <= 2) {
        ca.set(def.colors[0])
        cb.set(def.colors[1])
      }
    },
    // x/y/z: the feet; facing: body yaw; moving: whether to lay new samples. reset: drop the
    // ribbon (a teleport or a scene switch would otherwise draw a streak across the map).
    update(dt, x, y, z, facing, moving, reset = false) {
      time += dt
      if (reset) count = 0
      if (!def) {
        geometry.setDrawRange(0, 0)
        return
      }
      const bx = x - Math.sin(facing) * TRAIL_FX.back
      const bz = z - Math.cos(facing) * TRAIL_FX.back
      if (moving && (count === 0 || Math.hypot(bx - lastX, bz - lastZ) > TRAIL_FX.spacing)) {
        xs[head] = bx
        ys[head] = y
        zs[head] = bz
        born[head] = time
        head = (head + 1) % N
        count = Math.min(N, count + 1)
        lastX = bx
        lastZ = bz
      }
      // Drop the expired tail.
      while (count > 0 && time - born[(head - count + N) % N] > TRAIL_FX.life) count--

      // Newest first: the newest edge sits on the body so the ribbon never lags off it.
      v = 0
      if (count > 0) edge(bx, y, bz, 0)
      for (let i = 1; i <= count && v < N; i++) {
        const k = (head - i + N) % N
        edge(xs[k], ys[k], zs[k], time - born[k])
      }
      geometry.setDrawRange(0, Math.max(0, v - 1) * 6)
      geometry.attributes.position.needsUpdate = true
      geometry.attributes.color.needsUpdate = true
    },
  }
}
