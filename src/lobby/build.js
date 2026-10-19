// Small shared builders for the lobby modules: materials, placed meshes,
// axis-aligned slabs, a h:mm:ss clock, and the LIMITED bundle billboard.
import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three'
import { label } from './labels.js'
import { formatNumber } from './leaderboards.js'
import { LIMITED_END, state as progress } from '../game/state.js'

export const C = {
  wall: '#a8a4f2',
  pillar: '#dcd9ff',
  red: '#ff2e2e',
  yellow: '#ffd21a',
  cream: '#fff4cf',
  gold: '#f7b500',
  goldDark: '#d98a00',
  blue: '#2f7dff',
}

export const std = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra })

export function add(parent, geo, material, [x, y, z], { rot = null, cast = true } = {}) {
  const m = new Mesh(geo, material)
  m.position.set(x, y, z)
  if (rot) m.rotation.set(...rot)
  m.castShadow = cast
  m.receiveShadow = true
  parent.add(m)
  return m
}

// An axis-aligned box: centre x/z, size w (x) by d (z), solid from y0 to y1.
export function slab(parent, material, x, z, w, d, y0, y1) {
  return add(parent, new BoxGeometry(w, y1 - y0, d), material, [x, (y0 + y1) / 2, z])
}

export function clock(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// LIMITED / <bundle name> / "854/1000 LEFT" / bonus + price pills. The stock
// counts down across the drop window; owning the bundle swaps the price for OWNED.
const WINDOW = 7 * 86400000
export function bundleBoard(parent, bundle, bonus, [x, y, z], unit = 1.5) {
  const board = label(parent, [], [x, y, z], { unit })
  return () => {
    const left = Math.max(1, Math.round(bundle.stock * Math.min(1, (LIMITED_END - Date.now()) / WINDOW)))
    const owned = progress.owned.includes(bundle.id)
    board.set([
      { text: '✦LIMITED', size: 1.1, fill: ['#fff27a', '#ffc400', '#ff9d00'], stroke: '#3a1d00' },
      { text: bundle.name, size: 0.4, fill: '#ffffff', stroke: '#6a2cf0' },
      { text: `${left}/${bundle.stock} LEFT`, size: 0.42, fill: '#ffffff', bg: '#2a2b45' },
      owned
        ? { text: '✔ OWNED', size: 0.48, fill: '#ffffff', bg: '#33d11c', border: '#0f4a0a' }
        : { text: `x${bonus}  ◎ ${formatNumber(bundle.cost)}`, size: 0.48, fill: '#ffffff', bg: '#33d11c', border: '#0f4a0a' },
    ])
  }
}
