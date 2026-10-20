// Colyseus link to Hair-escape-backend (room "world"): loads/saves the persisted half of `state`,
// relays this player's pose (with the hair cable) / hair look / avatar, and exposes the other players
// and the leaderboards.
// Never throws and never blocks play: with no server (or an unreachable one) the game simply runs
// offline on local state.
import { Client } from '@colyseus/sdk'
import { Vector3 } from 'three'
import { DEV_MODE, GAME_SLUG, NET, SERVER_URL } from './config.js'
import { authState, getEquippedAvatar, getProportions, getSkinTextureUrl, sdk, subscribeAuth } from './bloxity.js'
import { hydrate, onChange, setTutorialReady, state, visibleHair } from './game/state.js'

// The keys the server persists (backend src/sanitize.ts); `lastSeen` is stamped when sending.
const SAVED = ['hair', 'level', 'xp', 'wins', 'rebirths', 'prestige', 'upgrades', 'equipped', 'owned', 'spinAt', 'chests', 'quest', 'tutorial', 'bestHair', 'stageReached','giftAt', 'boostUntil', 'flags', 'cut', 'charms', 'aura', 'trail', 'lengthPick', 'days', 'lastDay']
const AVATAR_MAX = 3000 // backend AVATAR_MAX_LEN

export const net = {
  room: null,
  connected: false,
  hydrated: false, // a progress/noProgress answer arrived: saving is allowed
  leaderboard: { wins: [], hair: [], rebirths: [], prestige: [] }, // rows { id, name, value, avatar? }
  get sessionId() {
    return this.room?.sessionId ?? null
  },
  get players() {
    return this.room?.state?.players ?? null
  },
}

const boardListeners = new Set()
export function onLeaderboard(fn) {
  boardListeners.add(fn)
  fn(net.leaderboard)
  return () => boardListeners.delete(fn)
}

const hydrateListeners = new Set()
// Fires after the account's save replaced the local state; gets the hair earned while away.
export const onHydrated = (fn) => (hydrateListeners.add(fn), () => hydrateListeners.delete(fn))

// --- Identity ----------------------------------------------------------------
// Signed-in players use their Bloxity id; everyone else a per-browser guest id (never saved).
function guestId() {
  const make = () => `guest-${Math.random().toString(36).slice(2, 10)}`
  try {
    let id = localStorage.getItem('hair-escape-guest')
    if (!id) localStorage.setItem('hair-escape-guest', (id = make()))
    return id
  } catch {
    return make()
  }
}
const GUEST = guestId()

function identity() {
  const u = authState.user
  const id = u && (u._id || u.id || u.userId || u.uid)
  if (!id) return { userId: GUEST, username: authState.guest?.displayName || authState.guest?.username || 'Guest' }
  return { userId: String(id), username: String(u.displayName || u.username || u.name || 'Player') }
}

// Bloxity avatar as the server relays it: JSON { equipped, proportions, skin }, length-capped.
// The skin URL is the first thing dropped when it does not fit.
function avatarJson() {
  if (!authState.user) return ''
  const equipped = getEquippedAvatar()
  if (!equipped) return ''
  for (const skin of [getSkinTextureUrl(), null]) {
    try {
      const json = JSON.stringify({ equipped, proportions: getProportions(), skin })
      if (json.length <= AVATAR_MAX) return json
    } catch {
      return ''
    }
  }
  return ''
}

// --- Saving ------------------------------------------------------------------
let lastSaved = ''
let saveTimer = 0
let firstDirty = 0
let sentId = '' // identity the server currently attributes saves to
let hydratedId = '' // identity whose save already replaced the local state (a reconnect keeps local progress)

const snapshot = () => JSON.stringify(Object.fromEntries(SAVED.map((k) => [k, state[k]])))
const isGuest = () => sentId.startsWith('guest-')

export function saveNow() {
  clearTimeout(saveTimer)
  saveTimer = 0
  firstDirty = 0
  if (!net.connected || !net.hydrated) return
  const snap = snapshot()
  if (snap === lastSaved) return
  lastSaved = snap
  send('saveProgress', { ...JSON.parse(snap), lastSeen: Date.now() })
}

function scheduleSave() {
  if (!net.connected || !net.hydrated) return
  const now = performance.now()
  if (!firstDirty) firstDirty = now
  clearTimeout(saveTimer)
  const wait = Math.min(NET.saveDebounce * 1000, Math.max(0, firstDirty + NET.saveMaxWait * 1000 - now))
  saveTimer = setTimeout(saveNow, wait)
}

// --- Messages out ------------------------------------------------------------
function send(type, payload) {
  try {
    net.room?.send(type, payload)
  } catch (err) {
    console.warn('[net] send failed', type, err)
  }
}

// The hair cable's state on the wire (server PlayerState.cable); remotePlayers.js draws it.
export const CABLE_CODE = { idle: 0, flying: 1, riding: 2, retracting: 3 }

let lastPose = ''
let lastPoseAt = 0
const cableEnd = new Vector3()
// Throttled to NET.poseHz; skips repeats while standing still. `cable` (hairCable.js) adds its
// state and the far end of the visible rope while it is out.
export function sendPose(player, speed, cable = null, pose = null) {
  if (!net.connected) return
  const now = performance.now()
  if (now - lastPoseAt < 1000 / NET.poseHz) return
  lastPoseAt = now
  const r = (n) => Math.round(n * 100) / 100
  const msg = { x: r(player.position.x), y: r(player.position.y), z: r(player.position.z), yaw: r(player.facing), speed01: r(Math.min(1, speed / player.moveSpeed)), grounded: player.grounded, pose, cable: 0 }
  if (cable?.endPoint(cableEnd)) {
    msg.cable = CABLE_CODE[cable.state] ?? 0
    msg.tx = r(cableEnd.x)
    msg.ty = r(cableEnd.y)
    msg.tz = r(cableEnd.z)
  }
  const key = JSON.stringify(msg)
  if (key === lastPose) return
  lastPose = key
  send('pose', msg)
}

// The hair look others see: style, cut, aura, trail, charms and the shown hair count.
let sentLook = ''
function syncLook() {
  if (!net.connected) return
  const look = { equipped: state.equipped, cut: state.cut, aura: state.aura, trail: state.trail, charms: state.charms, hair: Math.round(visibleHair()) }
  const key = JSON.stringify(look)
  if (key === sentLook) return
  sentLook = key
  send('setLook', look)
}

let sentAvatar = null
export function syncAvatar() {
  if (!net.connected) return
  const avatar = avatarJson()
  if (avatar === sentAvatar) return
  sentAvatar = avatar
  send('setAvatar', { avatar })
}

// --- Connection --------------------------------------------------------------
function attach(room) {
  net.room = room
  net.connected = true
  room.onMessage('progress', (doc) => {
    net.hydrated = true
    const { serverTime, ...saved } = doc ?? {}
    if (hydratedId !== sentId) {
      hydratedId = sentId
      const away = hydrate(saved)
      for (const fn of hydrateListeners) fn(away)
    }
    setTutorialReady()
    lastSaved = snapshot() // what the server holds: don't echo it straight back
    syncLook()
  })
  room.onMessage('noProgress', () => {
    // New account, guest or no database: keep what we have and push it as the first save.
    net.hydrated = true
    hydratedId = sentId
    lastSaved = ''
    setTutorialReady() // the tutorial carries on from the local step
    if (!isGuest()) saveNow()
    syncLook()
  })
  room.onMessage('serverError', () => {
    // The save exists but could not be read: never overwrite it.
    net.hydrated = false
    setTutorialReady() // play on from the local save
    console.warn('[net] server could not read the saved progress; saving is off for this session')
  })
  room.onMessage('leaderboard', (rows) => {
    net.leaderboard = { wins: rows?.wins ?? [], hair: rows?.hair ?? [], rebirths: rows?.rebirths ?? [], prestige: rows?.prestige ?? [] }
    for (const fn of boardListeners) fn(net.leaderboard)
  })
  room.onLeave(() => {
    if (net.room !== room) return
    net.room = null
    net.connected = false
    net.hydrated = false
    setTimeout(connect, 3000) // keep trying; local play is unaffected meanwhile
  })
  sentLook = ''
  sentAvatar = null
  lastPose = ''
  syncAvatar()
}

// Bloxity hosting has no fixed socket URL: the SDK resolves the endpoint of this game's server
// (a dev-channel page reaches the dev backend, prod the prod one) on every connect, and each
// resolve needs its own Client. A configured SERVER_URL (config.js) wins.
const canResolve = () => typeof sdk()?.net?.resolveEndpoint === 'function'
async function serverUrl() {
  if (SERVER_URL) return SERVER_URL
  const { endpoint } = await sdk().net.resolveEndpoint(GAME_SLUG)
  return endpoint
}

let connecting = false
async function connect() {
  if (!(SERVER_URL || canResolve()) || connecting || net.connected) return
  connecting = true
  try {
    const id = identity()
    sentId = id.userId
    const client = new Client(await serverUrl())
    attach(await client.joinOrCreate('world', { ...id, avatar: avatarJson() }))
  } catch (err) {
    console.warn('[net] could not reach the server; playing offline', err?.message ?? err)
    setTutorialReady() // offline: the local save is all there is
    setTimeout(connect, NET.retryDelay * 1000)
  } finally {
    connecting = false
  }
}

export function initNet() {
  if (!SERVER_URL && !canResolve()) {
    setTutorialReady()
    return console.info('[net] no server configured; playing offline')
  }
  // The account's save normally answers within a second; never hold the tutorial back for good
  // if auth or the server never does.
  setTimeout(setTutorialReady, NET.tutorialWait * 1000)
  onChange(() => {
    scheduleSave()
    syncLook()
  })
  // The first ready call connects; later ones are sign-in / sign-out.
  subscribeAuth((s) => {
    if (!s.ready) return
    if (!net.connected) return void connect()
    const id = identity()
    if (id.userId === sentId) return send('identify', { username: id.username })
    saveNow() // under the old id, before switching
    net.hydrated = false
    sentId = id.userId
    send('identify', id)
    syncAvatar()
  })
  window.addEventListener('beforeunload', saveNow)
  document.addEventListener('visibilitychange', () => document.hidden && saveNow())
}
