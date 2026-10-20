// Player progression: hair (the currency), level/XP, wins, rebirths, prestige,
// the rebirth upgrades, the equipped hair style and the tutorial quest chain. One mutable singleton;
// anything that changes it calls `changed()` so the HUD, leaderboards and the
// avatar's hair follow. Saved to localStorage (per browser, best effort).
import { HAIR, DEV_MODE, clamp } from '../config.js'
import { AURAS, CHARM_SLOTS, CHARMS, CUTS, DEFAULT_AURA, DEFAULT_CUT, DEFAULT_TRAIL, LENGTH_ANCHORS, TRAILS } from './cosmetics.js'

// Hair styles in the HAIR SHOP (west bleachers), also the salon's Colors tab. `bonus` is hair per
// treadmill step. `price` is Wins, spent once to own it (shown as buyable once the player has that
// many); no price = free. `rebirths` / `prestige` are thresholds that must be met first (not spent), and
// `limitedUntil` the date a limited drop stops being sold.
// `kind` / `extra` pick the display model (hairShop.js).
export const LIMITED_END = Date.parse('2026-10-24T00:00:00Z') // the "5 DAYS" Twin Braids drop
// Limited bundles: a fixed stock that counts down over the drop window. Prices are in Wins.
export const BUNDLE = { id: 'princess', name: 'CELESTIAL PRINCESS BUNDLE', stock: 1000, price: 600 }
export const DRAGON_BUNDLE = { id: 'dragon', name: 'DRAGON LORD BUNDLE', stock: 1000, price: 1000 }
export const HAIR_STYLES = {
  golden: { name: 'Golden Hair', bonus: 1, color: '#f5a321', tip: '#ffd447', label: ['#fff27a', '#ffb000'] },
  blueberry: { name: 'Blueberry Hair', bonus: 2, price: 1, color: '#c08cff', tip: '#8f6bff', label: ['#cfe2ff', '#6f8dff'] },
  slime: { name: 'Slime Hair', bonus: 3, price: 2, color: '#8cf531', tip: '#ff8c1a', label: ['#eaff52', '#45e01e'], extra: 'drip' },
  orange: { name: 'Orange Hair', bonus: 4, price: 3, color: '#ffa21a', tip: '#ff6a00', label: ['#ffd37a', '#ff7a00'] },
  emerald: { name: 'Emerald Hair', bonus: 5, price: 5, color: '#19e6a4', tip: '#0fbf86', label: ['#a8ffd9', '#10d48f'], extra: 'sparkle' },
  grape: { name: 'Grape Hair', bonus: 6, price: 7, color: '#d63cff', tip: '#9a1fe0', label: ['#f2b8ff', '#c02cf0'] },
  ocean: { name: 'Ocean Hair', bonus: 8, price: 10, color: '#2fd8ff', tip: '#0aa0e0', label: ['#bff4ff', '#1fb8f0'], extra: 'sparkle' },
  crystal: { name: 'Crystal Hair', bonus: 10, price: 15, color: '#5ff3ff', tip: '#d8fdff', label: ['#ffffff', '#7fe8ff'], extra: 'crystal' },
  void: { name: 'Void Hair', bonus: 12, price: 20, color: '#4b1fa8', tip: '#1a0840', label: ['#c9a8ff', '#6a2cf0'], extra: 'void' },
  ruby: { name: 'Ruby Hair', bonus: 15, price: 30, color: '#ff2f9a', tip: '#ff8ac8', label: ['#ffb8e0', '#ff2f8a'], extra: 'glow' },
  gummy: { name: 'Gummy Hair', bonus: 20, price: 50, color: '#ffe04a', tip: '#ff5fb4', stripes: ['#ffe04a', '#4cd9ff', '#7dff5a', '#ff7ad1'], label: ['#ffd6f4', '#ff5fc0'], extra: 'heart' },
  braids: { name: 'Twin Braids', bonus: 6, price: 7, limitedUntil: LIMITED_END, color: '#b86bff', tip: '#7d3dff', label: ['#ffc8ff', '#c04cff'], kind: 'braids' },
  tails: { name: 'Twin Tails', bonus: 18, price: 40, rebirths: 6, color: '#ff8ad8', tip: '#ffffff', label: ['#ffd0f0', '#ff4cc0'], kind: 'braids' },
  curly: { name: 'Curly', bonus: 9, price: 12, rebirths: 2, color: '#ffcf3a', tip: '#ff9a1a', label: ['#e0f0ff', '#6f8dff'], kind: 'curly' },
  princess: { name: 'Celestial Princess', bonus: 96, price: BUNDLE.price, color: '#ffd23a', tip: '#ffffff', label: ['#fff27a', '#ffb000'], kind: 'curly', extra: 'sparkle' },
  // The NEW! hairstyles by the south wall.
  pony: { name: 'Princess Pony', bonus: 30, price: 100, color: '#ff8ad8', tip: '#ffd6f4', label: ['#ffd0f0', '#ff4cc0'], extra: 'bow' },
  pigtails: { name: 'Curly Pigtails', bonus: 40, price: 150, color: '#ffd23a', tip: '#ff9a1a', label: ['#fff27a', '#ffb000'], kind: 'braids' },
  dragon: { name: 'Dragon Lord', bonus: 150, price: DRAGON_BUNDLE.price, color: '#ff3b2f', tip: '#ffb000', label: ['#ffd37a', '#ff3b2f'], extra: 'horns' },
  // Prestige prizes (PRESTIGE_PRIZES): unlocked by the prestige count, so a prestige never takes them back.
  prestigeGold: { name: 'Prestige Gold Hair', bonus: 60, prestige: 1, color: '#ffc21a', tip: '#ff5fc8', label: ['#fff27a', '#ff5fc8'], extra: 'sparkle' },
  prestigeDiamond: { name: 'Prestige Diamond Hair', bonus: 120, prestige: 2, color: '#bff4ff', tip: '#ff8ad8', label: ['#ffffff', '#7fe8ff'], extra: 'crystal' },
}

export const REBIRTH_LEVEL = 5 // level needed for the first rebirth
export const REBIRTH_LEVEL_STEP = 3 // levels the goal rises with every rebirth
// Shop offers, bought with Wins (spent). Level packs and the skip can be bought repeatedly; the starter pack and x2 Hair once.
export const LEVEL_PACKS = [
  { levels: 24, hair: 25000, price: 8, color: 'orange' },
  { levels: 35, hair: 100000, price: 20, color: 'blue' },
  { levels: 48, hair: 500000, price: 45, color: 'red' },
  { levels: 75, hair: 12900000, price: 120, color: 'purple' },
]
export const STARTER_PACK = { hair: 25000, wins: 50, price: 10 } // pays back more Wins than it costs, so it is one-time
export const X2_HAIR = { price: 25, mult: 2 } // permanent hair-per-step multiplier
export const REBIRTH_BONUS = 0.5 // +50% hair per rebirth
export const EVENT_BOOST = { mult: 2, seconds: 300 }

// Prestige (the Rebirth window's Prestige tab): needs PRESTIGE_REBIRTHS rebirths, PRESTIGE_STEP more each
// time, and multiplies hair and Wins by 1 + prestiges for good. It resets hair, Wins, rebirths, upgrades,
// treadmills, hair colours (skins) and trails; charms, cuts, auras and the day streak stay.
export const PRESTIGE_REBIRTHS = 10
export const PRESTIGE_STEP = 5
// What reaching each prestige unlocks (the items carry `prestige: n`). Index 0 is Prestige 1.
export const PRESTIGE_PRIZES = [
  [{ kind: 'skin', id: 'prestigeGold' }, { kind: 'charm', id: 'prestigeStar' }, { kind: 'slot' }],
  [{ kind: 'skin', id: 'prestigeDiamond' }, { kind: 'charm', id: 'prestigeCrown' }],
]

// Upgrades (the Upgrades tab): each level opens at a rebirth count (`UPGRADE_REBIRTHS[level]`, a threshold,
// not spent) and is claimed with its button; a prestige takes them back to 0. `per` is the gain per level:
// a fraction (hair, wins, ride, luck), hours (offline) or m/s (walk).
export const UPGRADE_REBIRTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
export const UPGRADES = {
  hair: { name: 'Hair Power', per: 0.25, max: 10, unit: '%', what: 'Hair', color: 'blue' },
  wins: { name: 'Win Magnet', per: 0.25, max: 10, unit: '%', what: 'Wins', color: 'gold' },
  sleepy: { name: 'Sleepy Hair', per: 1, max: 8, unit: 'h', what: 'Offline', color: 'purple' },
  zippy: { name: 'Zippy Hair', per: 0.05, max: 10, unit: '%', what: 'Ride Speed', color: 'orange' },
  lucky: { name: 'Lucky Locks', per: 0.1, max: 10, unit: '%', what: 'Luck', color: 'green' },
  feet: { name: 'Quick Feet', per: 1.5, max: 8, unit: '', what: 'Walk Speed', color: 'pink' },
}

// XP to go from `level` to level + 1. Level 1 needs 12 (the reference HUD's "3/12").
export const levelRequirement = (level) => Math.round(12 * Math.pow(1.6, level - 1))

// Hair count -> the avatar's visual hair length (the start count of 3 is the start length).
// Past ~150 hair the back reaches the floor and the rest drags behind (metres).
export const trailLengthFor = (hair) => clamp(4.2 * Math.log2(Math.max(hair, 1) / 150), 0, 36)

export const hairLengthFor = (hair) =>
  clamp(HAIR.startLength * Math.pow(Math.max(hair, 1) / HAIR.startLength, 0.36), HAIR.minLength, HAIR.maxLength)

const fresh = () => ({
  hair: 3,
  level: 1,
  xp: 3,
  wins: 0,
  rebirths: 0,
  prestige: 0, // prestiges done
  upgrades: {}, // upgrade id -> level claimed (UPGRADES)
  equipped: 'golden',
  owned: [], // hair styles bought or claimed (treadmills unlock with rebirths and are not owned)
  spinAt: 0, // ms timestamp of the last Lucky Spin
  chests: {}, // chest id -> last opened (ms), or for the rebirth chest the number claimed
  lastSeen: 0, // ms timestamp of the last save (offline earnings)
  quest: 0,
  bestHair: 3,
  giftAt: 0, // ms timestamp the daily gift was last claimed
  boostUntil: 0, // ms timestamp the event boost runs out
  flags: { treadmill: false, portal: false, starter: false, x2: false },
  // Hair Salon (cosmetics.js). Bought / earned salon items go in `owned` as 'cut:<id>', 'charm:<id>', 'aura:<id>', 'trail:<id>'.
  cut: DEFAULT_CUT,
  charms: { top: null, middle: null, tip: null, bonus: null }, // slot -> charm id
  aura: DEFAULT_AURA,
  trail: DEFAULT_TRAIL,
  lengthPick: 1, // Length slider: the shown fraction of the grown hair (1 = longest)
  days: 0, // distinct days played (the "Day N" unlocks)
  lastDay: '', // the day `days` last counted (local date string)
})

export const state = fresh()

// --- Quests (top-centre pill). `text` marks the highlighted word with *stars*.
export const QUESTS = [
  { text: 'Walk onto the *treadmill* to grow your hair!', done: (s) => s.flags.treadmill },
  { text: 'Grow your hair to *25 hair*!', done: (s) => s.hair >= 25 },
  { text: 'Reach *Level 3* on the treadmill!', done: (s) => s.level >= 3 },
  { text: 'Walk through the *START* portal!', done: (s) => s.flags.portal },
  { text: 'Escape the course to earn a *Win*!', done: (s) => s.wins >= 1 },
  { text: 'Equip *Blueberry Hair* on the stairs!', done: (s) => s.equipped !== 'golden' },
]

const listeners = new Set()
const eventListeners = new Set()
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn))
// One-off moments the HUD celebrates: { type: 'level' | 'quest' | 'win' | 'rebirth' | 'equip', ... }
export const onEvent = (fn) => (eventListeners.add(fn), () => eventListeners.delete(fn))
const emit = (e) => eventListeners.forEach((fn) => fn(e))

function changed() {
  // Quests can complete several in a row (e.g. a save that already has the hair).
  while (state.quest < QUESTS.length && QUESTS[state.quest].done(state)) {
    state.quest++
    emit({ type: 'quest', index: state.quest })
  }
  state.bestHair = Math.max(state.bestHair, state.hair)
  listeners.forEach((fn) => fn(state))
  scheduleSave()
}

export const boostActive = () => Date.now() < state.boostUntil

// Hair per treadmill step for a treadmill of multiplier `mult`.
export function hairPerStep(mult) {
  const style = HAIR_STYLES[state.equipped] ?? HAIR_STYLES.golden
  const boost = boostActive() ? EVENT_BOOST.mult : 1
  const x2 = state.flags.x2 ? X2_HAIR.mult : 1
  return Math.max(1, Math.round(style.bonus * mult * hairMultiplier() * boost * x2 * charmMultiplier() * trailMultiplier() * (1 + upgradeValue('hair')) * prestigeMultiplier()))
}

export function addHair(n) {
  state.hair += n
  state.xp += n
  let levels = 0
  while (state.xp >= levelRequirement(state.level)) {
    state.xp -= levelRequirement(state.level)
    state.level++
    levels++
  }
  if (levels) emit({ type: 'level', level: state.level })
  changed()
}

// The quest pill's Skip button: move past the current step without doing it.
export function skipQuest() {
  if (state.quest >= QUESTS.length) return
  state.quest++
  changed()
}

export function setFlag(name) {
  if (state.flags[name]) return
  state.flags[name] = true
  changed()
}

// Every Win award goes through the Win Magnet upgrade and the prestige multiplier.
export const winMultiplier = () => (1 + upgradeValue('wins')) * prestigeMultiplier()
export function addWin(base = 1) {
  const amount = Math.max(1, Math.round(base * winMultiplier()))
  state.wins += amount
  emit({ type: 'win', wins: state.wins, amount })
  changed()
}

// Shop purchases. Each spends Wins and returns false when short (or already owned, for the one-time offers).
function spendWins(price) {
  if (state.wins < price) return false
  state.wins -= price
  return true
}

export function buyLevelPack(index) {
  const p = LEVEL_PACKS[index]
  if (!p || !spendWins(p.price)) return false
  state.hair += p.hair
  state.level += p.levels
  state.xp = 0
  emit({ type: 'level', level: state.level })
  changed()
  return true
}

export function buyStarterPack() {
  if (state.flags.starter || !spendWins(STARTER_PACK.price)) return false
  state.flags.starter = true
  state.wins += STARTER_PACK.wins
  addHair(STARTER_PACK.hair)
  return true
}

export function buyX2Hair() {
  if (state.flags.x2 || !spendWins(X2_HAIR.price)) return false
  state.flags.x2 = true
  changed()
  return true
}

export const limitedLeft =(id) => Math.max(0, (HAIR_STYLES[id]?.limitedUntil ?? 0) - Date.now())

// What still stands between the player and an item that is not theirs yet, or null when it is free.
// Thresholds come first (not spent), then the Wins price (spent):
// { type: 'prestige' | 'rebirths' | 'days' | 'owns' | 'expired' | 'price', value }
function unlockReq(it) {
  if (it.prestige && state.prestige < it.prestige) return { type: 'prestige', value: it.prestige }
  if (it.rebirths && state.rebirths < it.rebirths) return { type: 'rebirths', value: it.rebirths }
  if (it.days && state.days < it.days) return { type: 'days', value: it.days }
  if (it.owns && !state.owned.includes(it.owns)) return { type: 'owns', value: it.owns }
  if (it.limitedUntil != null && Date.now() >= it.limitedUntil) return { type: 'expired', value: 0 }
  if (it.price) return { type: 'price', value: it.price }
  return null
}
// A requirement the player can meet right now by paying: a Wins price they can afford.
export const affordable = (req) => req?.type === 'price' && state.wins >= req.value

// Spends `price` Wins and adds `key` to the owned list. False when short.
function buyWithWins(key, price) {
  if (state.wins < price) return false
  state.wins -= price
  state.owned = [...state.owned, key]
  return true
}

// Hair styles: null when owned or free, else what is missing (see unlockReq).
export function styleReq(id) {
  const st = HAIR_STYLES[id]
  if (!st || state.owned.includes(id)) return null
  return unlockReq(st)
}

// Unlocked for good: free, or bought earlier.
export const canEquip = (id) => !!HAIR_STYLES[id] && !styleReq(id)

// Can be bought right now with E / the salon (its thresholds are met and the Wins are there).
export const canAcquire = (id) => affordable(styleReq(id))

// What still stands between the player and this style, for signs and prompts.
export function requirementText(id) {
  const r = styleReq(id)
  if (!r) return 'Unlocked'
  if (r.type === 'prestige') return `Prestige ${r.value} Required`
  if (r.type === 'rebirths') return `${r.value} Rebirth${r.value === 1 ? '' : 's'} Required`
  if (r.type === 'expired') return 'Expired'
  return `🏆 ${r.value} Win${r.value === 1 ? '' : 's'}`
}

export function equip(id) {
  if (state.equipped === id) return false
  const bought = !canEquip(id)
  if (bought && (!canAcquire(id) || !buyWithWins(id, HAIR_STYLES[id].price))) return false
  state.equipped = id
  emit({ type: 'equip', id, bought })
  changed()
  return true
}

// --- Hair Salon (cosmetics.js): cuts, charms, auras, trails, length ----------
export const SALON_KINDS = { cut: CUTS, charm: CHARMS, aura: AURAS, trail: TRAILS }

// What still stands between the player and a salon item: null when it is free or theirs (see unlockReq).
export function cosmeticReq(kind, id) {
  const it = SALON_KINDS[kind]?.[id]
  if (!it || state.owned.includes(`${kind}:${id}`)) return null
  return unlockReq(it)
}
export const cosmeticUnlocked = (kind, id) => !!SALON_KINDS[kind]?.[id] && !cosmeticReq(kind, id)

export function isWorn(kind, id) {
  if (kind === 'charm') return state.charms[CHARMS[id]?.slot] === id
  return state[kind] === id
}

// Wear a salon item, buying it with Wins first when it has a price. False when it stays locked.
export function wearCosmetic(kind, id) {
  const it = SALON_KINDS[kind]?.[id]
  if (!it) return false
  const req = cosmeticReq(kind, id)
  if (req && (!affordable(req) || !buyWithWins(`${kind}:${id}`, req.value))) return false
  if (kind === 'charm') state.charms = { ...state.charms, [it.slot]: id }
  else state[kind] = id
  emit({ type: 'wear', kind, id, bought: !!req })
  changed()
  return true
}

// Back to the default (classic cut, no aura / trail, an empty charm slot).
export function takeOffCosmetic(kind, id) {
  if (!isWorn(kind, id)) return
  if (kind === 'charm') state.charms = { ...state.charms, [CHARMS[id].slot]: null }
  else state[kind] = { cut: DEFAULT_CUT, aura: DEFAULT_AURA, trail: DEFAULT_TRAIL }[kind]
  changed()
}

// The salon's "Best!" button: the strongest unlocked charm in every slot. False when nothing changed.
export function wearBestCharms() {
  const next = { ...state.charms }
  for (const slot of CHARM_SLOTS) {
    for (const [id, c] of Object.entries(CHARMS)) {
      if (c.slot === slot && cosmeticUnlocked('charm', id) && c.mult > (CHARMS[next[slot]]?.mult ?? 0)) next[slot] = id
    }
  }
  if (CHARM_SLOTS.every((s) => next[s] === state.charms[s])) return false
  state.charms = next
  changed()
  return true
}

// The charm slots open to the player: the bonus slot comes with the first prestige.
export const charmSlots = () => CHARM_SLOTS.filter((slot) => slot !== 'bonus' || state.prestige >= 1)

// Charms add up (1 + the sum of each one's extra), the trail multiplies.
export const charmMultiplier = () => 1 + charmSlots().reduce((sum, slot) => sum + Math.max(0, (CHARMS[state.charms[slot]]?.mult ?? 1) - 1), 0)
export const trailMultiplier = () => TRAILS[state.trail]?.mult ?? 1

// Length slider: x (0..1 along the bar) <-> the hair count whose look it shows, log-interpolated between anchors.
export function hairAtLengthX(x) {
  const a = LENGTH_ANCHORS
  if (x <= a[0][0]) return a[0][1]
  for (let i = 1; i < a.length; i++) {
    if (x > a[i][0]) continue
    const t = (x - a[i - 1][0]) / (a[i][0] - a[i - 1][0])
    return Math.exp(Math.log(a[i - 1][1]) + (Math.log(a[i][1]) - Math.log(a[i - 1][1])) * t)
  }
  return a[a.length - 1][1]
}
export function lengthXForHair(hair) {
  const a = LENGTH_ANCHORS
  const h = Math.max(hair, a[0][1])
  for (let i = 1; i < a.length; i++) {
    if (h > a[i][1]) continue
    return a[i - 1][0] + ((Math.log(h) - Math.log(a[i - 1][1])) / (Math.log(a[i][1]) - Math.log(a[i - 1][1]))) * (a[i][0] - a[i - 1][0])
  }
  return 1
}
// The hair count the avatar's hair looks like: the grown hair, cut down to the Length slider.
export const visibleHair = () =>
  state.lengthPick >= 1 ? state.hair : Math.min(state.hair, hairAtLengthX(lengthXForHair(state.hair) * state.lengthPick))

export function setLengthPick(fraction) {
  const f = clamp(Number(fraction) || 0, 0, 1)
  if (Math.abs(f - state.lengthPick) < 1e-4) return
  state.lengthPick = f
  changed()
}

// Level needed for the next rebirth after `rebirths` rebirths.
export const rebirthLevel = (rebirths = state.rebirths) => REBIRTH_LEVEL + rebirths * REBIRTH_LEVEL_STEP
export const hairMultiplier = (rebirths = state.rebirths) => 1 + rebirths * REBIRTH_BONUS
export const canRebirth = () => state.level >= rebirthLevel()

export function rebirth() {
  if (!canRebirth()) return false
  state.rebirths++
  state.hair = 3
  state.level = 1
  state.xp = 3
  emit({ type: 'rebirth', rebirths: state.rebirths })
  changed()
  return true
}

// --- Upgrades ---------------------------------------------------------------
export const upgradeLevel = (id) => state.upgrades[id] ?? 0
// The upgrade's current effect (see UPGRADES `per`).
export const upgradeValue = (id) => upgradeLevel(id) * UPGRADES[id].per
// Rebirths needed for the next level, or null at max.
export const upgradeNeed = (id) => (upgradeLevel(id) < UPGRADES[id].max ? UPGRADE_REBIRTHS[upgradeLevel(id)] : null)
export const canUpgrade = (id) => upgradeNeed(id) != null && state.rebirths >= upgradeNeed(id)
export const anyUpgradeReady = () => Object.keys(UPGRADES).some(canUpgrade)
export function upgrade(id) {
  if (!UPGRADES[id] || !canUpgrade(id)) return false
  state.upgrades = { ...state.upgrades, [id]: upgradeLevel(id) + 1 }
  emit({ type: 'upgrade', id, level: state.upgrades[id] })
  changed()
  return true
}
export const walkBonus = () => upgradeValue('feet') // m/s on top of PHYSICS.moveSpeed
export const rideMultiplier = () => 1 + upgradeValue('zippy') // times the cable's zip speed
export const luck = () => upgradeValue('lucky') // chance of a second, better Lucky Spin roll

// --- Prestige ---------------------------------------------------------------
export const prestigeRebirths = (p = state.prestige) => PRESTIGE_REBIRTHS + p * PRESTIGE_STEP
export const prestigeMultiplier = (p = state.prestige) => 1 + p
export const canPrestige = () => state.rebirths >= prestigeRebirths()
// The prizes for reaching prestige `p` (1-based), [] past the list.
export const prestigePrizes = (p = state.prestige + 1) => PRESTIGE_PRIZES[p - 1] ?? []

export function prestige() {
  if (!canPrestige()) return false
  // Charms, cuts and auras are kept: record the ones unlocked by a threshold so they stay unlocked.
  const keep = ['cut', 'charm', 'aura'].flatMap((kind) => Object.keys(SALON_KINDS[kind]).filter((id) => cosmeticUnlocked(kind, id)).map((id) => `${kind}:${id}`))
  state.owned = [...new Set([...state.owned, ...keep])].filter((k) => !k.startsWith('tm:') && !k.startsWith('trail:') && !HAIR_STYLES[k])
  state.prestige++
  state.hair = 3
  state.level = 1
  state.xp = 3
  state.wins = 0
  state.rebirths = 0
  state.upgrades = {}
  state.chests = { ...state.chests, rebirth: 0 }
  state.equipped = 'golden'
  state.trail = DEFAULT_TRAIL
  emit({ type: 'prestige', prestige: state.prestige })
  changed()
  return true
}

// Buy a one-off unlock with hair. Returns false when short. (Nothing in the
// Hub sells for hair right now: treadmills unlock with rebirths.)
export const owns = (key) => state.owned.includes(key)
export function buy(key, cost) {
  if (owns(key) || state.hair < cost) return false
  state.hair -= cost
  state.owned = [...state.owned, key]
  emit({ type: 'buy', key })
  changed()
  return true
}

// Lucky Spin (the rainbow kiosk): a free spin every hour; prizes scale with level.
// Chests on the south wall. Timed chests reopen after `cooldown`; the rebirth
// chest opens once for every `every` rebirths. Rewards scale with level.
export const CHESTS = {
  rebirth: { name: 'Rebirth Chest', every: 3, reward: (s) => 2500 * s.level * Math.max(1, s.rebirths) },
  group: { name: 'Group Chest', cooldown: 12 * 3600e3, reward: (s) => 50 * s.level },
  shampoo: { name: 'Shampoo Chest', wins: 10, cooldown: 6 * 3600e3, reward: (s) => 300 * s.level },
  comb: { name: 'Golden Comb Chest', level: 15, cooldown: 8 * 3600e3, reward: (s) => 800 * s.level },
}
const chestValue = (id) => state.chests?.[id] ?? 0
// ms until a timed chest is ready (0 = ready); Infinity while its requirement is unmet.
export function chestWait(id) {
  const c = CHESTS[id]
  if (c.every) return Math.floor(state.rebirths / c.every) > chestValue(id) ? 0 : Infinity
  if (c.wins && state.wins < c.wins) return Infinity
  if (c.level && state.level < c.level) return Infinity
  return Math.max(0, c.cooldown - (Date.now() - chestValue(id)))
}
export function chestRequirement(id) {
  const c = CHESTS[id]
  if (c.every) return `${state.rebirths % c.every}/${c.every} Rebirths`
  if (c.wins) return `${c.wins} Wins`
  if (c.level) return `Level ${c.level}`
  return null
}
export function openChest(id) {
  if (chestWait(id) > 0) return 0
  const c = CHESTS[id]
  const n = c.reward(state)
  state.chests = { ...state.chests, [id]: c.every ? chestValue(id) + 1 : Date.now() }
  emit({ type: 'chest', id, amount: n })
  addHair(n)
  return n
}

export const SPIN_COOLDOWN = 60 * 60 * 1000
export const SPIN_PRIZES = [25, 50, 100, 25, 250, 50, 500, 1000] // x level, one per wheel segment
export const spinReady = () => Date.now() - state.spinAt >= SPIN_COOLDOWN
export function spin() {
  if (!spinReady()) return -1
  state.spinAt = Date.now()
  const roll = () => Math.floor(Math.random() * SPIN_PRIZES.length)
  let index = roll()
  if (Math.random() < luck()) {
    const again = roll()
    if (SPIN_PRIZES[again] > SPIN_PRIZES[index]) index = again
  }
  addHair(SPIN_PRIZES[index] * state.level)
  return index
}

// "YOU EARN HAIR OFFLINE!": one x1 treadmill step every 30 s away, up to 8 h plus the Sleepy Hair hours.
const OFFLINE_STEP = 30 * 1000
const OFFLINE_CAP = 8 * 60 * 60 * 1000
const offlineCap = () => OFFLINE_CAP + upgradeValue('sleepy') * 3600e3

export const GIFT_COOLDOWN = 4 * 60 * 60 * 1000 // 4 h between free gifts
export const giftReady = () => Date.now() - state.giftAt >= GIFT_COOLDOWN
export const giftAmount = () => 10 * state.level

export function claimGift() {
  if (!giftReady()) return 0
  state.giftAt = Date.now()
  const n = giftAmount()
  addHair(n)
  return n
}

export function startBoost() {
  state.boostUntil = Date.now() + EVENT_BOOST.seconds * 1000
  changed()
}

// --- Persistence (best effort: private windows / blocked storage just don't save)
const KEY = 'hair-escape-save-v1'
// Dev runs (dev server, VITE_DEV_MODE, development-mode build) never read or write the save, so every session starts fresh.
const NO_PERSIST = DEV_MODE || import.meta.env.DEV || import.meta.env.MODE === 'development'
let offlineEarned = 0
// Hair earned while away, reported once after load().
export const takeOfflineEarnings = () => {
  const n = offlineEarned
  offlineEarned = 0
  return n
}
// Keeps `lastSeen` fresh while playing, so offline time is counted from when the tab closed.
if (typeof window !== 'undefined') setInterval(() => scheduleSave(), 15000)
let saveTimer = null
function scheduleSave() {
  if (NO_PERSIST || saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      state.lastSeen = Date.now()
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // Storage unavailable.
    }
  }, 1500)
}

// Dev-only starting stats from .env (VITE_DEV_HAIR, _LEVEL, _WINS, _REBIRTHS, _PRESTIGE, _OWNED, _EQUIPPED), so you can test late-game without grinding.
function applyDevStats() {
  const env = import.meta.env
  const num = (v) => (v != null && v !== '' && Number.isFinite(+v) ? Math.max(0, Math.floor(+v)) : null)
  const hair = num(env.VITE_DEV_HAIR)
  const level = num(env.VITE_DEV_LEVEL)
  const wins = num(env.VITE_DEV_WINS)
  const rebirths = num(env.VITE_DEV_REBIRTHS)
  if (hair != null) state.hair = state.bestHair = hair
  if (level != null) (state.level = Math.max(1, level)), (state.xp = 0)
  if (wins != null) state.wins = wins
  if (rebirths != null) state.rebirths = rebirths
  const prestiges = num(env.VITE_DEV_PRESTIGE)
  if (prestiges != null) state.prestige = prestiges
  // Comma list of hair style keys and salon items ('cut:braid', 'charm:lantern', ...); 'all' owns every hair style and salon item.
  const owned = (env.VITE_DEV_OWNED ?? '').split(',').map((k) => k.trim()).filter(Boolean)
  const everything = () => [...Object.keys(HAIR_STYLES), ...Object.entries(SALON_KINDS).flatMap(([kind, list]) => Object.keys(list).map((id) => `${kind}:${id}`))]
  state.owned = [...new Set([...state.owned, ...owned.flatMap((k) => (k === 'all' ? everything() : [k]))])]
  const equipped = env.VITE_DEV_EQUIPPED?.trim()
  if (equipped && HAIR_STYLES[equipped]) state.equipped = equipped
  else if (equipped) console.warn(`[state] VITE_DEV_EQUIPPED: unknown hair style '${equipped}'`)
}

// One more day on the "Day N" counter the first time the game runs on a new (local) date.
function countDay() {
  const today = new Date().toDateString()
  if (state.lastDay === today) return
  state.lastDay = today
  state.days++
}

// Saved salon ids that no longer exist in the catalogs fall back to the defaults.
function sanitizeSalon() {
  if (!CUTS[state.cut]) state.cut = DEFAULT_CUT
  if (!AURAS[state.aura]) state.aura = DEFAULT_AURA
  if (!TRAILS[state.trail]) state.trail = DEFAULT_TRAIL
  for (const slot of CHARM_SLOTS) if (CHARMS[state.charms[slot]]?.slot !== slot) state.charms[slot] = null
  state.lengthPick = clamp(Number(state.lengthPick) || 0, 0, 1)
  // Saves from before Wins prices unlocked by threshold and never recorded it: keep what is being worn.
  const keep = [state.equipped, `cut:${state.cut}`, `aura:${state.aura}`, `trail:${state.trail}`, ...CHARM_SLOTS.filter((s) => state.charms[s]).map((s) => `charm:${state.charms[s]}`)]
  state.owned = [...new Set([...state.owned, ...keep])]
}

// Merges a saved document over a fresh state and credits the hair earned while away.
function applySaved(saved) {
  Object.assign(state, fresh(), saved, { flags: { ...fresh().flags, ...saved.flags }, chests: { ...saved.chests }, upgrades: { ...saved.upgrades }, charms: { ...fresh().charms, ...saved.charms } })
  sanitizeSalon()
  if (!HAIR_STYLES[state.equipped]) state.equipped = 'golden'
  const away = Math.min(offlineCap(), Date.now() - (state.lastSeen || Date.now()))
  const steps = Math.floor(away / OFFLINE_STEP)
  if (steps > 0) {
    const n = steps * hairPerStep(1)
    state.hair += n
    state.xp += n
    while (state.xp >= levelRequirement(state.level)) state.xp -= levelRequirement(state.level++)
    offlineEarned += n
  }
}

export function load() {
  if (NO_PERSIST) {
    applyDevStats()
    countDay()
    changed()
    return
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) applySaved(JSON.parse(raw))
  } catch {
    // Corrupt or blocked: start fresh.
  }
  countDay()
  changed()
}

// The account's save from the server (net.js) replaces the local one. Returns the hair earned while away.
export function hydrate(doc) {
  if (NO_PERSIST && Object.keys(import.meta.env).some((k) => k.startsWith('VITE_DEV_') && k !== 'VITE_DEV_MODE' && import.meta.env[k] !== '')) return 0 // keep the .env dev stats instead of the server's save
  const before = offlineEarned
  try {
    applySaved(doc)
  } catch {
    return 0
  }
  countDay()
  changed()
  return offlineEarned - before
}
