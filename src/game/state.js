// Player progression: hair (the currency), level/XP, wins, rebirths, the
// equipped hair style and the tutorial quest chain. One mutable singleton;
// anything that changes it calls `changed()` so the HUD, leaderboards and the
// avatar's hair follow. Saved to localStorage (per browser, best effort).
import { HAIR, clamp } from '../config.js'

// Hair styles in the HAIR SHOP (west bleachers). `bonus` is hair per treadmill
// step. Unlocks: `wins` / `rebirths` thresholds, `cost` (bought once with hair),
// or `limitedUntil` (free to claim until that date, then gone for latecomers).
// `kind` / `extra` pick the display model (hairShop.js).
export const LIMITED_END = Date.parse('2026-10-24T00:00:00Z') // the "5 DAYS" Twin Braids drop
// Limited bundles: a fixed stock that counts down over the drop window. Prices are in hair.
export const BUNDLE = { id: 'princess', name: 'CELESTIAL PRINCESS BUNDLE', stock: 1000, cost: 999000 }
export const DRAGON_BUNDLE = { id: 'dragon', name: 'DRAGON LORD BUNDLE', stock: 1000, cost: 1500000 }
export const HAIR_STYLES = {
  golden: { name: 'Golden Hair', bonus: 1, wins: 0, color: '#f5a321', tip: '#ffd447', label: ['#fff27a', '#ffb000'] },
  blueberry: { name: 'Blueberry Hair', bonus: 2, wins: 1, color: '#c08cff', tip: '#8f6bff', label: ['#cfe2ff', '#6f8dff'] },
  slime: { name: 'Slime Hair', bonus: 3, wins: 2, color: '#8cf531', tip: '#ff8c1a', label: ['#eaff52', '#45e01e'], extra: 'drip' },
  orange: { name: 'Orange Hair', bonus: 4, wins: 3, color: '#ffa21a', tip: '#ff6a00', label: ['#ffd37a', '#ff7a00'] },
  emerald: { name: 'Emerald Hair', bonus: 5, wins: 5, color: '#19e6a4', tip: '#0fbf86', label: ['#a8ffd9', '#10d48f'], extra: 'sparkle' },
  grape: { name: 'Grape Hair', bonus: 6, wins: 7, color: '#d63cff', tip: '#9a1fe0', label: ['#f2b8ff', '#c02cf0'] },
  ocean: { name: 'Ocean Hair', bonus: 8, wins: 10, color: '#2fd8ff', tip: '#0aa0e0', label: ['#bff4ff', '#1fb8f0'], extra: 'sparkle' },
  crystal: { name: 'Crystal Hair', bonus: 10, wins: 15, color: '#5ff3ff', tip: '#d8fdff', label: ['#ffffff', '#7fe8ff'], extra: 'crystal' },
  void: { name: 'Void Hair', bonus: 12, wins: 20, color: '#4b1fa8', tip: '#1a0840', label: ['#c9a8ff', '#6a2cf0'], extra: 'void' },
  ruby: { name: 'Ruby Hair', bonus: 15, wins: 30, color: '#ff2f9a', tip: '#ff8ac8', label: ['#ffb8e0', '#ff2f8a'], extra: 'glow' },
  gummy: { name: 'Gummy Hair', bonus: 20, wins: 50, color: '#ffe04a', tip: '#ff5fb4', stripes: ['#ffe04a', '#4cd9ff', '#7dff5a', '#ff7ad1'], label: ['#ffd6f4', '#ff5fc0'], extra: 'heart' },
  braids: { name: 'Twin Braids', bonus: 6, limitedUntil: LIMITED_END, color: '#b86bff', tip: '#7d3dff', label: ['#ffc8ff', '#c04cff'], kind: 'braids' },
  tails: { name: 'Twin Tails', bonus: 18, rebirths: 6, color: '#ff8ad8', tip: '#ffffff', label: ['#ffd0f0', '#ff4cc0'], kind: 'braids' },
  curly: { name: 'Curly', bonus: 9, rebirths: 2, color: '#ffcf3a', tip: '#ff9a1a', label: ['#e0f0ff', '#6f8dff'], kind: 'curly' },
  princess: { name: 'Celestial Princess', bonus: 96, cost: BUNDLE.cost, color: '#ffd23a', tip: '#ffffff', label: ['#fff27a', '#ffb000'], kind: 'curly', extra: 'sparkle' },
  // The NEW! hairstyles by the south wall.
  pony: { name: 'Princess Pony', bonus: 30, cost: 59000, color: '#ff8ad8', tip: '#ffd6f4', label: ['#ffd0f0', '#ff4cc0'], extra: 'bow' },
  pigtails: { name: 'Curly Pigtails', bonus: 40, cost: 99000, color: '#ffd23a', tip: '#ff9a1a', label: ['#fff27a', '#ffb000'], kind: 'braids' },
  dragon: { name: 'Dragon Lord', bonus: 150, cost: DRAGON_BUNDLE.cost, color: '#ff3b2f', tip: '#ffb000', label: ['#ffd37a', '#ff3b2f'], extra: 'horns' },
}

export const REBIRTH_LEVEL = 5 // level needed to rebirth
export const REBIRTH_BONUS = 0.5 // +50% hair per rebirth
export const EVENT_BOOST = { mult: 2, seconds: 300 }

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
  equipped: 'golden',
  owned: [], // hair styles bought or claimed, and bought treadmills ('tm:<key>')
  spinAt: 0, // ms timestamp of the last Lucky Spin
  chests: {}, // chest id -> last opened (ms), or for the rebirth chest the number claimed
  lastSeen: 0, // ms timestamp of the last save (offline earnings)
  quest: 0,
  bestHair: 3,
  giftAt: 0, // ms timestamp the daily gift was last claimed
  boostUntil: 0, // ms timestamp the event boost runs out
  flags: { treadmill: false, portal: false },
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
  return Math.max(1, Math.round(style.bonus * mult * (1 + state.rebirths * REBIRTH_BONUS) * boost))
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

export function addWin() {
  state.wins++
  emit({ type: 'win', wins: state.wins })
  changed()
}

export const limitedLeft = (id) => Math.max(0, (HAIR_STYLES[id]?.limitedUntil ?? 0) - Date.now())

// Unlocked for good: met its thresholds, or bought / claimed earlier.
export function canEquip(id) {
  const st = HAIR_STYLES[id]
  if (!st) return false
  if (state.owned.includes(id)) return true
  if (st.cost != null || st.limitedUntil != null) return false
  return state.wins >= (st.wins ?? 0) && state.rebirths >= (st.rebirths ?? 0)
}

// Can be unlocked right now by pressing E (buy with hair, or claim a limited drop).
export function canAcquire(id) {
  const st = HAIR_STYLES[id]
  if (!st || canEquip(id)) return false
  if (st.cost != null) return state.hair >= st.cost
  if (st.limitedUntil != null) return limitedLeft(id) > 0
  return false
}

// What still stands between the player and this style, for signs and prompts.
export function requirementText(id) {
  const st = HAIR_STYLES[id]
  if (st.cost != null) return `${st.cost} Hair`
  if (st.limitedUntil != null) return limitedLeft(id) > 0 ? 'FREE (Limited)' : 'Expired'
  if (st.rebirths) return `${st.rebirths} Rebirth${st.rebirths === 1 ? '' : 's'} Required`
  return `${st.wins} Win${st.wins === 1 ? '' : 's'} Required`
}

export function equip(id) {
  if (state.equipped === id) return false
  if (!canEquip(id)) {
    if (!canAcquire(id)) return false
    const st = HAIR_STYLES[id]
    if (st.cost != null) state.hair -= st.cost
    state.owned = [...state.owned, id]
  }
  state.equipped = id
  emit({ type: 'equip', id })
  changed()
  return true
}

export const canRebirth = () => state.level >= REBIRTH_LEVEL

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

// Buy a one-off unlock (a treadmill) with hair. Returns false when short.
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
  const index = Math.floor(Math.random() * SPIN_PRIZES.length)
  addHair(SPIN_PRIZES[index] * state.level)
  return index
}

// "YOU EARN HAIR OFFLINE!": one x1 treadmill step every 30 s away, up to 8 h.
const OFFLINE_STEP = 30 * 1000
const OFFLINE_CAP = 8 * 60 * 60 * 1000

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
  if (saveTimer) return
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

export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      Object.assign(state, fresh(), saved, { flags: { ...fresh().flags, ...saved.flags }, chests: { ...saved.chests } })
      if (!HAIR_STYLES[state.equipped]) state.equipped = 'golden'
      const away = Math.min(OFFLINE_CAP, Date.now() - (state.lastSeen || Date.now()))
      const steps = Math.floor(away / OFFLINE_STEP)
      if (steps > 0) {
        const n = steps * hairPerStep(1)
        state.hair += n
        state.xp += n
        while (state.xp >= levelRequirement(state.level)) state.xp -= levelRequirement(state.level++)
        offlineEarned = n
      }
    }
  } catch {
    // Corrupt or blocked: start fresh.
  }
  changed()
}
