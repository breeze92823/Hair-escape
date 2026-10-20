// SVG art for the Hair Salon UI: the six tab icons, card art for every cut, hair
// colour, charm, aura and trail, and small glyphs (collection book, check, flame,
// heart knob). Inline SVG strings like hud.js, so nothing is loaded. Gradients get
// unique ids: the same icon appears many times on one page.

let uid = 0
const gid = () => `sl${++uid}`
const OUT = '#5a3200' // gold outline
const INK = '#15151f'

// Vertical gradient fill: returns [defs, url].
function grad(top, bottom) {
  const id = gid()
  return [`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>`, `url(#${id})`]
}
const GOLD = ['#ffe86b', '#f5a00c']

// --- Hair cut art (golden, like the reference's Styles cards) ----------------------
const S_LOCK = 'M31 3c-10-1-19 4-19 12 0 7 7 10 12 13 4 2 6 5 3 8-3 2-8 2-12-1 1 6 8 9 14 8 8-2 11-8 9-14-2-5-8-8-12-10-4-2-4-5-1-7 3-2 8-1 12 1 1-5-2-9-6-10z'
const CUT_ART = {
  lock: (f) => `<path d="${S_LOCK}" fill="${f}" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/><path d="M17 13c1-3 5-5 9-5" fill="none" stroke="#fff6c0" stroke-width="2.4" stroke-linecap="round"/>`,
  braid: (f) => [0, 1, 2, 3, 4].map((i) => `<ellipse cx="${24 + (i % 2 ? 3 : -3)}" cy="${8 + i * 7.5}" rx="7.5" ry="5.2" transform="rotate(${i % 2 ? -30 : 30} ${24 + (i % 2 ? 3 : -3)} ${8 + i * 7.5})" fill="${f}" stroke="${OUT}" stroke-width="2.2"/>`).join('') + `<path d="M24 42c-2 2-1 4 0 5 1-1 2-3 0-5z" fill="${f}" stroke="${OUT}" stroke-width="2"/><rect x="19" y="38" width="10" height="4" rx="2" fill="#ff5fb4" stroke="#5a0a3a" stroke-width="1.5"/>`,
  pony: (f) => `<circle cx="20" cy="15" r="11" fill="${f}" stroke="${OUT}" stroke-width="2.6"/><path d="M28 12c10 2 12 12 8 20s-3 12 2 14c-8 1-13-5-11-13s3-12-3-16z" fill="${f}" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="29" cy="13" r="3.5" fill="#ff5fb4" stroke="#5a0a3a" stroke-width="1.6"/>`,
  curly: (f) => [[24, 8], [18, 16], [29, 18], [22, 26], [30, 30], [20, 36], [26, 42]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.5" fill="${f}" stroke="${OUT}" stroke-width="2.2"/><path d="M${x - 2} ${y}a2.5 2.5 0 1 1 3 2" fill="none" stroke="${OUT}" stroke-width="1.6"/>`).join(''),
  tails: (f) => `<path d="M18 6c-8 2-12 10-9 18s0 14-4 18c8 0 14-6 13-14s2-14 0-22z" fill="${f}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/><path d="M30 6c8 2 12 10 9 18s0 14 4 18c-8 0-14-6-13-14s-2-14 0-22z" fill="${f}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="17" cy="8" r="3.4" fill="#ff5fb4" stroke="#5a0a3a" stroke-width="1.5"/><circle cx="31" cy="8" r="3.4" fill="#ff5fb4" stroke="#5a0a3a" stroke-width="1.5"/>`,
  wavy: (f) => `<path d="M18 4c10 0 14 6 8 12s-8 10 0 15 6 12-4 14c4-4 4-8-2-12s-8-11-1-16 6-9-1-13z" fill="${f}" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/><path d="M21 8c3 0 5 2 3 4" fill="none" stroke="#fff6c0" stroke-width="2.2" stroke-linecap="round"/>`,
  bubble: (f) => [[24, 9, 7.5], [24, 22, 6.5], [24, 33, 5.5], [24, 42, 4.3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="${OUT}" stroke-width="2.3"/>`).join('') + [16, 28, 38].map((y) => `<rect x="19" y="${y - 1.5}" width="10" height="3" rx="1.5" fill="#ff5fb4" stroke="#5a0a3a" stroke-width="1.2"/>`).join(''),
  dreads: (f) => `<path d="M8 10c4-8 28-8 32 0" fill="${f}" stroke="${OUT}" stroke-width="2.4"/>` + [11, 18, 25, 32, 38].map((x, i) => `<path d="M${x} 9c-1 10 ${i % 2 ? 2 : -2} 22 0 ${30 + (i % 3) * 3}" fill="none" stroke="${OUT}" stroke-width="7" stroke-linecap="round"/><path d="M${x} 9c-1 10 ${i % 2 ? 2 : -2} 22 0 ${30 + (i % 3) * 3}" fill="none" stroke="${f}" stroke-width="3.6" stroke-linecap="round"/>`).join(''),
  fishtail: (f) => `<path d="M24 3c7 6 7 30 0 42-7-12-7-36 0-42z" fill="${f}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>` + [10, 16, 22, 28, 34].map((y) => `<path d="M19 ${y}l5 4 5-4" fill="none" stroke="${OUT}" stroke-width="1.8" stroke-linecap="round"/>`).join(''),
  buns: (f) => `<circle cx="13" cy="13" r="9" fill="${f}" stroke="${OUT}" stroke-width="2.4"/><circle cx="35" cy="13" r="9" fill="${f}" stroke="${OUT}" stroke-width="2.4"/><path d="M8 28c4-10 28-10 32 0v8c-6 6-26 6-32 0z" fill="${f}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/><path d="M10 13a3 3 0 0 1 4-4M32 13a3 3 0 0 1 4-4" fill="none" stroke="#fff6c0" stroke-width="2" stroke-linecap="round"/>`,
}
export function cutIcon(kind) {
  const [defs, f] = grad(...GOLD)
  return `<svg viewBox="0 0 48 48">${defs}${(CUT_ART[kind] ?? CUT_ART.lock)(f)}</svg>`
}

// --- Hair colour art: the S lock in the colour, tip colour below (stripes for multi-colour) ---
export function colorIcon(style) {
  const id = gid()
  const stops = style.stripes
    ? style.stripes.map((c, i, a) => `<stop offset="${i / (a.length - 1)}" stop-color="${c}"/>`).join('')
    : `<stop offset="0" stop-color="${style.color}"/><stop offset="0.6" stop-color="${style.color}"/><stop offset="1" stop-color="${style.tip}"/>`
  return `<svg viewBox="0 0 48 48"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0.3" y2="1">${stops}</linearGradient></defs><path d="${S_LOCK}" fill="url(#${id})" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M17 13c1-3 5-5 9-5M27 31c2 1 2 3 1 5" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2.4" stroke-linecap="round"/></svg>`
}

// --- Charm art -------------------------------------------------------------------
const ringArt = (ring, bead, n = 8, fat = false) => {
  const dots = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return `<circle cx="${(24 + Math.cos(a) * 17).toFixed(1)}" cy="${(26 + Math.sin(a) * 7).toFixed(1)}" r="${fat ? 2.2 : 3.2}" fill="${bead}" stroke="${INK}" stroke-width="1.2"/>`
  }).join('')
  return `<ellipse cx="24" cy="26" rx="17" ry="7" fill="none" stroke="${INK}" stroke-width="${fat ? 11 : 6}"/><ellipse cx="24" cy="26" rx="17" ry="7" fill="none" stroke="${ring}" stroke-width="${fat ? 7.5 : 3}"/>${dots}`
}
const CHARM_ART = {
  bow: ([a, b]) => `<path d="M24 24 6 12v24zM24 24l18-12v24z" fill="${a}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="24" cy="24" r="5" fill="${b}" stroke="${INK}" stroke-width="2.2"/>`,
  heart: ([a, b]) => `<path d="M24 42C8 31 4 22 8 14s14-8 16 0c2-8 12-8 16 0s0 17-16 28z" fill="${a}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M13 16c2-3 5-3 7-1" fill="none" stroke="${b}" stroke-width="2.6" stroke-linecap="round"/>`,
  star: ([a, b]) => `<path d="M24 4l6 13 14 2-10 10 2 14-12-7-12 7 2-14L4 19l14-2z" fill="${a}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M20 16l4-8" stroke="${b}" stroke-width="2.6" stroke-linecap="round"/>`,
  crystal: ([a, b]) => `<path d="M24 4 32 18 26 42 18 18z" fill="${a}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 14l6 6-2 18-6-12zM36 12l-6 8 2 18 7-13z" fill="${b}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M24 8v28" stroke="#fff" stroke-width="2" opacity="0.7"/>`,
  crown: ([a, b]) => `<path d="M6 16l9 8 9-14 9 14 9-8-4 22H10z" fill="${a}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="24" cy="29" r="3.5" fill="${b}" stroke="${INK}" stroke-width="1.5"/>`,
  beads: ([a, b]) => ringArt(b, a, 10),
  pearls: ([a, b]) => ringArt(b, a, 14),
  ring: ([a, b]) => ringArt(a, b, 8),
  donut: ([a, b]) => ringArt(a, b, 12, true),
  rainbow: () => ['#ff3d5a', '#ffb000', '#4fe23a', '#2ad4ff', '#8a4dff'].map((c, i) => `<ellipse cx="24" cy="${18 + i * 4}" rx="17" ry="6" fill="none" stroke="${INK}" stroke-width="5"/><ellipse cx="24" cy="${18 + i * 4}" rx="17" ry="6" fill="none" stroke="${c}" stroke-width="2.5"/>`).join(''),
  pompom: ([a, b]) => `<circle cx="24" cy="26" r="15" fill="${a}" stroke="${INK}" stroke-width="2.4" stroke-dasharray="3 2"/><circle cx="24" cy="26" r="11" fill="${b}" opacity="0.6"/><rect x="20" y="4" width="8" height="8" rx="2" fill="${a}" stroke="${INK}" stroke-width="2"/>`,
  tassel: ([a, b]) => `<circle cx="24" cy="11" r="7" fill="${b}" stroke="${INK}" stroke-width="2.2"/><path d="M17 16h14l6 26H11z" fill="${a}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M18 22l-3 18M24 22v19M30 22l3 18" stroke="${INK}" stroke-width="1.5" opacity="0.5"/>`,
  bell: ([a, b]) => `<path d="M24 8c-10 0-12 10-12 18s-4 10-4 12h32c0-2-4-4-4-12S34 8 24 8z" fill="${a}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="24" cy="42" r="4" fill="${b}" stroke="${INK}" stroke-width="2"/><circle cx="24" cy="6" r="3" fill="none" stroke="${INK}" stroke-width="2"/>`,
  lantern: ([a, b]) => `<rect x="16" y="14" width="16" height="22" rx="3" fill="${a}" stroke="${INK}" stroke-width="2.4"/><rect x="13" y="10" width="22" height="6" rx="2" fill="${b}" stroke="${INK}" stroke-width="2"/><rect x="13" y="34" width="22" height="6" rx="2" fill="${b}" stroke="${INK}" stroke-width="2"/><path d="M24 10V4" stroke="${INK}" stroke-width="2.4"/><path d="M20 18v14" stroke="#fff" stroke-width="2.2" opacity="0.8"/>`,
  gem: ([a, b]) => `<path d="M24 44 8 20l8-12h16l8 12z" fill="${a}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M8 20h32M16 8l8 36 8-36" fill="none" stroke="${b}" stroke-width="1.8"/>`,
}
export const charmIcon = (charm) => `<svg viewBox="0 0 48 48">${CHARM_ART[charm.model](charm.colors)}</svg>`

// --- Aura art: a tilted beaded ring with sparkles ------------------------------------
const sparkle = (x, y, s, fill = '#fff') => `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}z" fill="${fill}" stroke="${INK}" stroke-width="1"/>`
export function auraIcon(aura, hairColor = '#2fd8ff') {
  if (!aura.ring) return `<svg viewBox="0 0 48 48" opacity="0.55"><ellipse cx="24" cy="26" rx="18" ry="9" fill="none" stroke="${INK}" stroke-width="7" transform="rotate(-14 24 26)"/><ellipse cx="24" cy="26" rx="18" ry="9" fill="none" stroke="#9fb4d8" stroke-width="3.5" transform="rotate(-14 24 26)"/></svg>`
  const ring = aura.ring === 'hair' ? hairColor : aura.ring === 'rainbow' ? null : aura.ring
  const id = gid()
  const stroke = ring ?? `url(#${id})`
  const defs = ring ? '' : `<defs><linearGradient id="${id}"><stop offset="0" stop-color="#ff3d5a"/><stop offset="0.33" stop-color="#ffe94a"/><stop offset="0.66" stop-color="#2ad4ff"/><stop offset="1" stop-color="#8a4dff"/></linearGradient></defs>`
  const dots = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + 0.4
    return `<circle cx="${(24 + Math.cos(a) * 18).toFixed(1)}" cy="${(26 + Math.sin(a) * 9).toFixed(1)}" r="2.8" fill="${aura.bead}" stroke="${INK}" stroke-width="1.2"/>`
  }).join('')
  return `<svg viewBox="0 0 48 48">${defs}<g transform="rotate(-14 24 26)"><ellipse cx="24" cy="26" rx="18" ry="9" fill="none" stroke="${INK}" stroke-width="8"/><ellipse cx="24" cy="26" rx="18" ry="9" fill="none" stroke="${stroke}" stroke-width="4.5"/>${dots}</g>${sparkle(40, 9, 5)}${sparkle(8, 40, 4)}</svg>`
}

// --- Trail art: a running figure with streaks in the trail's colours --------------
export function trailIcon(trail, faded = false) {
  const [a, b] = trail.colors
  const c = trail.colors[2] ?? b
  const streak = (y, col, len) => `<path d="M4 ${y}q${len / 2} -4 ${len} 0" fill="none" stroke="${INK}" stroke-width="6.5" stroke-linecap="round"/><path d="M4 ${y}q${len / 2} -4 ${len} 0" fill="none" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>`
  return `<svg viewBox="0 0 48 48"${faded ? ' opacity="0.5"' : ''}>${streak(18, a, 18)}${streak(27, b, 22)}${streak(36, c, 16)}<circle cx="34" cy="9" r="5" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M33 15l-4 12 6 5 2 10M29 27l-7 6M31 18l8 4 3-4M31 18l-7 2-3 5" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M33 15l-4 12 6 5 2 10M29 27l-7 6M31 18l8 4 3-4M31 18l-7 2-3 5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

// --- Tabs and glyphs -----------------------------------------------------------------
export const TAB_ICONS = {
  styles: () => cutIcon('braid'),
  colors: () => `<svg viewBox="0 0 48 48"><path d="M24 3C16 14 9 22 9 30a15 15 0 0 0 30 0c0-8-7-16-15-27z" fill="#ff4fae" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M24 3c-3 12-6 20-6 27 0 9 3 14 6 15a15 15 0 0 0 15-15c0-8-7-16-15-27z" fill="#3ab6ff"/><path d="M28 18c4 5 8 10 8 13 0 7-5 12-12 13 6-4 6-10 4-26z" fill="#ffd21a"/><path d="M24 3C16 14 9 22 9 30a15 15 0 0 0 30 0c0-8-7-16-15-27z" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M15 26c0-4 2-8 5-11" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity="0.8"/></svg>`,
  charms: () => `<svg viewBox="0 0 48 48">${CHARM_ART.bow(['#ff5fb4', '#ffd21a'])}${sparkle(40, 8, 5, '#ffd21a')}${sparkle(9, 40, 4, '#7fe8ff')}</svg>`,
  auras: () => auraIcon({ ring: '#4a7bff', bead: '#ff8aff' }),
  trails: () => trailIcon({ colors: ['#c43aff', '#8a4dff', '#ff8ad8'] }),
}
export const BOOK_ICON = `<svg viewBox="0 0 48 48"><path d="M8 8c6-3 12-3 16 1v32c-4-4-10-4-16-1z" fill="#9a3df0" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M40 8c-6-3-12-3-16 1v32c4-4 10-4 16-1z" fill="#c977ff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M24 14l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" fill="#ffd21a" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M34 34l4 10 2-4 4 1z" fill="#ff3d5a" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/></svg>`
export const CHECK_ICON = `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#3fdc5a" stroke="${INK}" stroke-width="3"/><circle cx="20" cy="20" r="13" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M12 20l6 6 10-12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
export const FLAME_ICON = `<svg viewBox="0 0 48 48"><path d="M24 4c3 10 14 14 14 26a14 14 0 0 1-28 0c0-7 4-10 6-14 1 4 3 6 5 6-2-8 0-14 3-18z" fill="#ff7a1a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M24 24c2 4 7 6 7 11a7 7 0 0 1-14 0c0-4 4-6 7-11z" fill="#ffd21a"/></svg>`
export const HEART_ICON = `<svg viewBox="0 0 48 48"><path d="M24 42C8 31 4 22 8 14s14-8 16 0c2-8 12-8 16 0s0 17-16 28z" fill="#ff2f6a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M13 16c2-3 5-3 7-1" fill="none" stroke="#ffb3c8" stroke-width="2.8" stroke-linecap="round"/></svg>`
// The salon's sign (doors.js): steel scissors with pink finger rings and a gold pivot.
export const SCISSORS_ICON = `<svg viewBox="0 0 48 48"><g fill="none" stroke-linecap="round"><path d="M17 31L38 6M31 31L10 6" stroke="${INK}" stroke-width="7"/><circle cx="13.5" cy="35.5" r="5.5" stroke="${INK}" stroke-width="6.5"/><circle cx="34.5" cy="35.5" r="5.5" stroke="${INK}" stroke-width="6.5"/><path d="M17 31L38 6" stroke="#eef3fb" stroke-width="3.4"/><path d="M31 31L10 6" stroke="#c9d3e3" stroke-width="3.4"/><circle cx="13.5" cy="35.5" r="5.5" stroke="#ff5fb4" stroke-width="3"/><circle cx="34.5" cy="35.5" r="5.5" stroke="#ff5fb4" stroke-width="3"/></g><circle cx="24" cy="22.7" r="2.6" fill="#ffd21a" stroke="${INK}" stroke-width="1.6"/></svg>`
export const STAR_TAG_ICON =`<svg viewBox="0 0 48 48">${sparkle(24, 24, 18, '#ffd21a')}</svg>`
// Camera bar glyphs.
const chevron = (flip) => `<svg viewBox="0 0 44 56"${flip ? ' style="transform:scaleX(-1)"' : ''}><path d="M14 8l18 20-18 20" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 8l18 20-18 20" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
export const ARROW_LEFT = chevron(true)
export const ARROW_RIGHT = chevron(false)
const bar = (v) => `<svg viewBox="0 0 48 48"><path d="M10 24h28${v ? 'M24 10v28' : ''}" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M10 24h28${v ? 'M24 10v28' : ''}" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/></svg>`
export const MINUS_ICON = bar(false)
export const PLUS_ICON = bar(true)
