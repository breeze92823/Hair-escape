// The Hair Salon catalogs (the Hair button): hair cuts (the Styles tab), charms
// clipped along the hair, auras that ring the hair, run trails, and the named
// marks of the Length slider. Pure data; state.js owns what is unlocked / worn,
// avatar/ draws it, salon/ lists it. Hair colours (the Colors tab) are
// HAIR_STYLES in state.js: they carry the hair-per-step bonus.
//
// Unlock fields (state.js `cosmeticReq`). Thresholds, met first and never spent:
//   rebirths   rebirths done             days   distinct days played
//   owns       a HAIR_STYLES key (the LIMITED bundles)
// then `price`: Wins, spent once to own it (buyable as soon as the player has that many).
// None of these: free.

export const RARITY = {
  common: { name: 'Common', card: '#c9ccd4', light: '#eceef2', dark: 'rgba(60,66,84,0.12)', glow: 'rgba(255,255,255,0.45)' },
  uncommon: { name: 'Uncommon', card: '#4bdc3a', light: '#8cff6e', dark: 'rgba(0,60,0,0.16)', glow: 'rgba(255,255,255,0.18)' },
  rare: { name: 'Rare', card: '#2ea4f6', light: '#7fd2ff', dark: 'rgba(0,40,120,0.16)', glow: 'rgba(255,255,255,0.14)' },
  epic: { name: 'Epic', card: '#b44cf0', light: '#dc9bff', dark: 'rgba(60,0,110,0.18)', glow: 'rgba(255,255,255,0.14)' },
  legendary: { name: 'Legendary', card: '#ffb81a', light: '#ffe27a', dark: 'rgba(170,100,0,0.18)', glow: 'rgba(255,240,170,0.5)' },
  mythic: { name: 'Mythic', card: '#e8364a', light: '#ff8c94', dark: 'rgba(110,0,20,0.18)', glow: 'rgba(255,255,255,0.14)' },
}

// Hair colours have no rarity of their own: it follows their hair-per-step bonus.
export const rarityForBonus = (bonus) =>
  bonus <= 2 ? 'common' : bonus <= 4 ? 'uncommon' : bonus <= 8 ? 'rare' : bonus <= 15 ? 'epic' : bonus <= 60 ? 'legendary' : 'mythic'

// Hair cuts: the rope's cross-section and shape (avatar/hair.js) plus pieces on the head.
//   ridges / depth  strands round the rope and how deep the grooves between them are (0..1 of the radius)
//   twist           turns per metre the strands spiral (braids)
//   bulge / freq    radius swell (fraction) and swells per metre (bubbles, plaits)
//   wave            sideways wiggle on the floor, times the default
//   width           rope thickness, times the default
//   rootLift        head-local units the strand leaves the head higher (ponytails)
//   extras          head pieces: 'pony', 'buns', 'pigtails', 'bow'
//   icon            card art (salon/icons.js)
const ROPE_DEFAULT = { ridges: 9, depth: 0.13, twist: 0, bulge: 0, freq: 0, wave: 1, width: 1, rootLift: 0, extras: [] }
const cut = (o) => ({ ...ROPE_DEFAULT, ...o })
export const CUTS = {
  classic: cut({ name: 'Classic', rarity: 'common', icon: 'lock' }),
  braid: cut({ name: 'Braid', rarity: 'uncommon', price: 3, icon: 'braid', ridges: 3, depth: 0.42, twist: 0.9, bulge: 0.1, freq: 1.8 }),
  ponytail: cut({ name: 'Ponytail', rarity: 'rare', price: 12, icon: 'pony', twist: 0.12, rootLift: 0.55, extras: ['pony'] }),
  curly: cut({ name: 'Spiral Curls', rarity: 'rare', rebirths: 1, icon: 'curly', ridges: 6, depth: 0.3, bulge: 0.2, freq: 3.2, wave: 2.2 }),
  bunches: cut({ name: 'Bunches', rarity: 'rare', price: 20, icon: 'tails', extras: ['pigtails'] }),
  crown: cut({ name: 'Crown Braid', rarity: 'epic', days: 5, icon: 'braid', ridges: 3, depth: 0.5, twist: 1.3, bulge: 0.12, freq: 2.6, extras: ['buns'] }),
  wavy: cut({ name: 'Wavy', rarity: 'rare', price: 25, icon: 'wavy', twist: 0.25, wave: 3.5 }),
  bubble: cut({ name: 'Bubble Pony', rarity: 'legendary', rebirths: 3, icon: 'bubble', depth: 0.06, bulge: 0.42, freq: 1.4, rootLift: 0.55, extras: ['pony'] }),
  dreads: cut({ name: 'Dreads', rarity: 'epic', price: 60, icon: 'dreads', depth: 0.5, twist: 0.05, width: 1.1 }),
  fishtail: cut({ name: 'Fishtail', rarity: 'legendary', price: 150, icon: 'fishtail', ridges: 6, depth: 0.35, twist: 2, bulge: 0.08, freq: 4.5 }),
  buns: cut({ name: 'Space Buns', rarity: 'epic', price: 40, icon: 'buns', extras: ['buns'] }),
  royal: cut({ name: 'Royal Pony', rarity: 'legendary', price: 150, icon: 'pony', twist: 0.2, rootLift: 0.55, extras: ['pony', 'bow'] }),
  pigtails: cut({ name: 'Curly Bunches', rarity: 'epic', price: 80, icon: 'tails', ridges: 6, depth: 0.3, bulge: 0.18, freq: 3, wave: 2, extras: ['pigtails'] }),
  ribbon: cut({ name: 'Ribbon Braid', rarity: 'epic', price: 100, icon: 'braid', ridges: 3, depth: 0.42, twist: 0.9, bulge: 0.1, freq: 1.8, extras: ['bow'] }),
  mermaid: cut({ name: 'Mermaid Waves', rarity: 'mythic', price: 250, icon: 'wavy', ridges: 6, depth: 0.25, twist: 0.5, bulge: 0.08, freq: 1, wave: 4.5, width: 1.15 }),
}
export const DEFAULT_CUT = 'classic'

// Charms: one per slot along the hair. `mult` adds to hair per step: the worn
// charms give 1 + the sum of (mult - 1), so x2 + x2 + x1.25 is x4.25.
// `model` / `colors` pick the 3D piece (avatar/adornments.js) and the card art.
export const CHARM_SLOTS = ['top', 'middle', 'tip']
export const SLOT_NAMES = { top: 'Top', middle: 'Middle', tip: 'Tip' }
export const CHARMS = {
  bowClip: { name: 'Bow Clip', slot: 'top', mult: 1.1, rarity: 'common', price: 2, model: 'bow', colors: ['#ff5fb4', '#ff9ad3'] },
  heartClip: { name: 'Heart Clip', slot: 'top', mult: 1.25, rarity: 'uncommon', price: 5, model: 'heart', colors: ['#ff3d6a', '#ff8aa8'] },
  starClip: { name: 'Star Clip', slot: 'top', mult: 1.5, rarity: 'rare', price: 10, model: 'star', colors: ['#ffd21a', '#fff27a'] },
  crystalClip: { name: 'Crystal Clip', slot: 'top', mult: 2, rarity: 'epic', price: 40, model: 'crystal', colors: ['#7fe8ff', '#d8fdff'] },
  crownClip: { name: 'Tiny Crown', slot: 'top', mult: 3, rarity: 'legendary', price: 200, model: 'crown', colors: ['#ffc21a', '#ff3d5a'] },
  beadBand: { name: 'Bead Band', slot: 'middle', mult: 1.1, rarity: 'common', price: 3, model: 'beads', colors: ['#5f8dff', '#bcd0ff'] },
  pearlString: { name: 'Pearl String', slot: 'middle', mult: 1.25, rarity: 'uncommon', price: 8, model: 'pearls', colors: ['#fff6e8', '#e6d6c0'] },
  goldRing: { name: 'Gold Ring', slot: 'middle', mult: 1.5, rarity: 'rare', price: 20, model: 'ring', colors: ['#ffc21a', '#ffe86b'] },
  donutBand: { name: 'Donut Band', slot: 'middle', mult: 2, rarity: 'epic', price: 60, model: 'donut', colors: ['#ff8ad8', '#ffd84a'] },
  rainbowRing: { name: 'Rainbow Ring', slot: 'middle', mult: 3, rarity: 'legendary', price: 250, model: 'rainbow', colors: ['#ff3d5a', '#3ad0ff'] },
  pomPom: { name: 'Pom Pom', slot: 'tip', mult: 1.1, rarity: 'common', price: 2, model: 'pompom', colors: ['#ff8ad8', '#ffd0f0'] },
  tassel: { name: 'Tassel', slot: 'tip', mult: 1.25, rarity: 'uncommon', price: 6, model: 'tassel', colors: ['#ff3b2f', '#ffd21a'] },
  bell: { name: 'Golden Bell', slot: 'tip', mult: 1.5, rarity: 'rare', price: 15, model: 'bell', colors: ['#ffc21a', '#7a4a00'] },
  lantern: { name: 'Lantern', slot: 'tip', mult: 2, rarity: 'epic', price: 50, model: 'lantern', colors: ['#fff27a', '#d98a00'] },
  gemDrop: { name: 'Gem Drop', slot: 'tip', mult: 3, rarity: 'legendary', price: 220, model: 'gem', colors: ['#ff2f6a', '#ff9ac0'] },
}

// Auras: spinning beaded rings that float along the hair. Cosmetic only.
// `ring` / `bead` colours; 'hair' takes the worn hair colour, 'rainbow' cycles hues.
export const AURAS = {
  none: { name: 'No Aura', rarity: 'common' },
  hair: { name: 'Hair Aura', rarity: 'common', ring: 'hair', bead: '#ffd21a' },
  sparkle: { name: 'Sparkle Aura', rarity: 'uncommon', price: 5, ring: '#fff6a8', bead: '#ffffff' },
  heart: { name: 'Heart Aura', rarity: 'rare', price: 25, ring: '#ff5f8a', bead: '#ff2f5a' },
  fire: { name: 'Fire Ring', rarity: 'epic', price: 45, ring: '#ff8a1a', bead: '#ff3b1a' },
  lightning: { name: 'Lightning Aura', rarity: 'legendary', rebirths: 2, ring: '#ffe94a', bead: '#5fd8ff' },
  rainbow: { name: 'Rainbow Aura', rarity: 'legendary', price: 180, ring: 'rainbow', bead: '#ffffff' },
  toxic: { name: 'Toxic Aura', rarity: 'epic', price: 80, ring: '#7dff3a', bead: '#c400ff' },
  galaxy: { name: 'Galaxy Aura', rarity: 'legendary', rebirths: 5, ring: '#6a2cf0', bead: '#ffffff' },
  vip: { name: 'VIP Crown', rarity: 'legendary', price: 300, ring: '#ffc21a', bead: '#ff3d5a' },
  prestige: { name: 'Prestige Glow', rarity: 'mythic', rebirths: 10, ring: '#ffd6f4', bead: '#ffc21a' },
  celestial: { name: 'Celestial Aura', rarity: 'mythic', owns: 'princess', ring: '#bfe8ff', bead: '#ffd23a' },
  dragon: { name: 'Dragon Aura', rarity: 'mythic', owns: 'dragon', ring: '#ff3b2f', bead: '#ffb000' },
  spooky: { name: 'Spooky Aura', rarity: 'epic', price: 120, ring: '#ff7a1a', bead: '#2a1040' },
  ghost: { name: 'Ghost Wisps', rarity: 'epic', price: 120, ring: '#e8f4ff', bead: '#9fdcff' },
}
export const DEFAULT_AURA = 'none'

// Trails: a ribbon streaming behind the runner. `mult` multiplies hair per step.
// `colors` run head -> tail; a third entry or more cycles them (rainbow).
export const TRAILS = {
  none: { name: 'No Trail', mult: 1, rarity: 'common', colors: ['#c9ccd4', '#ffffff'] },
  cloud: { name: 'Cloud Trail', mult: 1.25, rarity: 'common', price: 1, colors: ['#ffffff', '#c9d8ff'] },
  mint: { name: 'Mint Trail', mult: 1.5, rarity: 'uncommon', price: 3, colors: ['#7dffc0', '#2fd88a'] },
  bubblegum: { name: 'Bubblegum Trail', mult: 1.75, rarity: 'uncommon', price: 6, colors: ['#ffb3dc', '#ff5fb4'] },
  ocean: { name: 'Ocean Trail', mult: 2, rarity: 'rare', price: 10, colors: ['#5fd8ff', '#2f6bff'] },
  sky: { name: 'Sky Trail', mult: 2.5, rarity: 'rare', price: 18, colors: ['#bff4ff', '#4ab8ff'] },
  grape: { name: 'Grape Trail', mult: 3, rarity: 'epic', price: 30, colors: ['#e0a8ff', '#9a3df0'] },
  galaxy: { name: 'Galaxy Trail', mult: 3.5, rarity: 'epic', price: 50, colors: ['#ff8ad8', '#3a1a8a'] },
  sunset: { name: 'Sunset Trail', mult: 4, rarity: 'legendary', price: 80, colors: ['#ffe94a', '#ff5a1a'] },
  toxic: { name: 'Toxic Trail', mult: 5, rarity: 'legendary', price: 130, colors: ['#d8ff3a', '#2fbf1a'] },
  inferno: { name: 'Inferno Trail', mult: 6, rarity: 'mythic', price: 200, colors: ['#ffd21a', '#e8160a'] },
  rainbow: { name: 'Rainbow Trail', mult: 8, rarity: 'mythic', price: 320, colors: ['#ff3d5a', '#ffb000', '#ffe94a', '#4fe23a', '#2ad4ff', '#8a4dff'] },
}
export const DEFAULT_TRAIL = 'none'

// Length slider (0..1 across the bar) <-> the hair count whose look it shows.
// Between anchors the hair count is interpolated on a log scale; each named
// mark is where that length starts. The far end is the longest hair there is.
export const LENGTH_ANCHORS = [[0, 0.5], [0.08, 1], [0.2, 3], [0.42, 12], [0.58, 160], [0.92, 30000], [1, 57000]] // [slider x, hair]
export const LENGTH_MARKS = [
  { name: 'Bob', x: 0.08 },
  { name: 'Shoulder', x: 0.2 },
  { name: 'Waist', x: 0.42 },
  { name: 'Floor', x: 0.58 },
  { name: 'Rapunzel', x: 0.92 },
]
