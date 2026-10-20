// The four boards on the north wall (TOP WINS, TOP HAIR, TOP REBIRTHS,
// TOP PRESTIGE). Each is a framed slab with a canvas face listing ten rows;
// the local player is slotted in live wherever their stat ranks.
import { BoxGeometry, CanvasTexture, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import { makeCanvas, onFontReady, outlinedText, FONT } from './paint.js'
import { label } from './labels.js'
import { net, onLeaderboard } from '../net.js'

// Made-up rival players (deterministic, so the boards look the same every load).
const RIVALS = [
  'NoodleStorm', 'BraidQueen_77', 'xXFluffyXx', 'Sir_Mullet', 'ponytail_pro', 'CurlyCaptain', 'BlueberryBun',
  'ShaggyShark', 'HairSprayHero', 'DreadDragon', 'LongLocksLuna', 'mop_master', 'TangleTom', 'SilkySam9',
]
const seeded = (i, salt) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}
function rivalTable(salt, top, falloff) {
  return RIVALS.map((name, i) => ({
    name: RIVALS[(i + salt) % RIVALS.length],
    value: Math.round(top * Math.pow(falloff, i) * (0.9 + seeded(i, salt) * 0.2)),
    me: false,
    hue: Math.floor(seeded(i, salt + 7) * 360),
  })).slice(0, 12)
}

export const BOARDS = [
  { key: 'wins', title: 'TOP WINS', icon: '🏆', frame: '#ff8a12', inner: '#ffb43a', row: ['#ffcf6a', '#ffbf45'], text: '#5a2a00', x: -17, stat: (s) => s.wins, table: rivalTable(1, 980, 0.78) },
  { key: 'hair', title: 'TOP HAIR', icon: '💇', frame: '#1597e5', inner: '#2bb8ff', row: ['#5fd0ff', '#3fc2ff'], text: '#003a5c', x: -9.5, stat: (s) => s.bestHair, table: rivalTable(4, 18.4e9, 0.62) },
  { key: 'rebirths', title: 'TOP REBIRTHS', icon: '🔄', frame: '#7a2ff0', inner: '#9a52ff', row: ['#b27bff', '#a466ff'], text: '#2b0066', x: 9.5, stat: (s) => s.rebirths, table: rivalTable(8, 4200, 0.74) },
  { key: 'prestige', title: 'TOP PRESTIGE', icon: '👑', frame: '#6c2bd9', inner: '#e0a020', row: ['#ffd05a', '#f5b82e'], text: '#4a2500', x: 17, stat: (s) => s.rebirths * 10 + s.wins, table: rivalTable(11, 152, 0.83) },
]

export function formatNumber(n) {
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]
  for (const [v, u] of units) if (n >= v) return `${(n / v).toFixed(n >= v * 100 ? 0 : 1).replace(/\.0$/, '')}${u}`
  return String(Math.floor(n))
}

const W = 512
const H = 640

function paintBoard(ctx, board, rows) {
  ctx.fillStyle = board.inner
  ctx.fillRect(0, 0, W, H)
  // Header strip with the board icon.
  ctx.fillStyle = board.frame
  ctx.fillRect(0, 0, W, 72)
  ctx.font = `44px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(board.icon, 22, 38)
  outlinedText(ctx, board.title, W / 2 + 20, 38, 40, { fill: '#fff', stroke: 'rgba(0,0,0,0.55)', strokeRatio: 0.16 })
  const rowH = (H - 84) / 10
  rows.forEach((r, i) => {
    const y = 80 + i * rowH
    ctx.fillStyle = r.me ? '#fff6a8' : board.row[i % 2]
    ctx.fillRect(10, y, W - 20, rowH - 6)
    // Rank badge (gold / silver / bronze for the podium).
    const medal = ['#ffd700', '#d9e2ec', '#e3934f'][r.rank - 1] ?? 'rgba(0,0,0,0.22)'
    ctx.fillStyle = medal
    ctx.beginPath()
    ctx.arc(40, y + rowH / 2 - 3, 18, 0, Math.PI * 2)
    ctx.fill()
    outlinedText(ctx, `#${r.rank}`, 40, y + rowH / 2 - 2, 20, { fill: '#fff', stroke: '#222', strokeRatio: 0.25 })
    // Avatar square.
    ctx.fillStyle = r.me ? '#ffb000' : `hsl(${r.hue} 70% 60%)`
    ctx.fillRect(70, y + 6, rowH - 18, rowH - 18)
    ctx.fillStyle = '#f2c79a'
    ctx.fillRect(70 + (rowH - 18) * 0.25, y + 6 + (rowH - 18) * 0.35, (rowH - 18) * 0.5, (rowH - 18) * 0.5)
    ctx.font = `600 26px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillStyle = board.text
    ctx.fillText(r.name.length > 15 ? `${r.name.slice(0, 14)}…` : r.name, 70 + rowH, y + rowH / 2 - 2)
    ctx.textAlign = 'right'
    ctx.font = `700 26px ${FONT}`
    ctx.fillText(formatNumber(r.value), W - 26, y + rowH / 2 - 2)
  })
}

// Builds the boards into `parent` against the wall at `wallZ`.
export function buildLeaderboards(parent, addCollider, wallZ) {
  const boards = BOARDS.map((b) => {
    const bw = 6.8
    const bh = 8
    const base = 0.7
    const z = wallZ + 0.45
    const frameMat = new MeshStandardMaterial({ color: b.frame, roughness: 0.55 })
    const frame = new Mesh(new BoxGeometry(bw + 0.5, bh + 0.5, 0.8), frameMat)
    frame.position.set(b.x, base + bh / 2, z)
    frame.castShadow = frame.receiveShadow = true
    parent.add(frame)
    const plinth = new Mesh(new BoxGeometry(bw + 0.9, base, 1.2), new MeshStandardMaterial({ color: '#2d2a55', roughness: 0.6 }))
    plinth.position.set(b.x, base / 2, z + 0.1)
    plinth.receiveShadow = true
    parent.add(plinth)
    addCollider(b.x, z + 0.1, bw + 0.9, 1.2, base + bh + 0.25)

    const canvas = makeCanvas(W, H)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8
    const face = new Mesh(new PlaneGeometry(bw, bh), new MeshBasicMaterial({ map: tex, toneMapped: false }))
    face.position.set(b.x, base + bh / 2, z + 0.41)
    parent.add(face)

    label(parent, [{ text: `${b.icon} ${b.title}`, size: 0.5, fill: '#ffffff', stroke: b.frame }], [b.x, base + bh + 0.85, z + 0.4], { unit: 1.3 })
    return { ...b, ctx: canvas.getContext('2d'), tex, lastKey: '' }
  })

  let me = { name: 'You', state: null }
  // The server's top 10 (net.js) once it arrives, else the made-up rivals; the player is always on the board.
  const hueOf = (name) => [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7)
  const redraw = (force) => {
    if (!me.state) return
    for (const b of boards) {
      const live = net.leaderboard[b.key]
      const table = live?.length ? live.filter((r) => r.id !== net.sessionId).map((r) => ({ name: r.name, value: r.value, me: false, hue: hueOf(r.name) })) : b.table
      const mine = { name: me.name, value: b.stat(me.state), me: true, hue: 40 }
      const ranked = [...table, mine].sort((a, c) => c.value - a.value).map((r, i) => ({ ...r, rank: i + 1 }))
      // Always show the player: off the top 10, they take the last row with their real rank.
      const rows = ranked.slice(0, 10)
      if (!rows.some((r) => r.me)) rows[9] = ranked.find((r) => r.me)
      const key = `${mine.name}|${mine.value}|${live?.length ? JSON.stringify(live.map((r) => [r.name, r.value])) : ''}`
      if (!force && key === b.lastKey) continue
      b.lastKey = key
      paintBoard(b.ctx, b, rows)
      b.tex.needsUpdate = true
    }
  }
  onFontReady(() => redraw(true))
  onLeaderboard(() => redraw(false))

  return {
    update(state, name) {
      me = { name: name || 'You', state }
      redraw(false)
    },
  }
}
