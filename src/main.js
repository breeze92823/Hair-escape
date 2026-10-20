import { Clock, Group, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { ANIM, CAMERA, HAIR, PHYSICS, SPAWN, SPAWN_FACING, TOUCH, TUTORIAL } from './config.js'
import * as bloxity from './bloxity.js'
import { inputState, install as installInput, refreshMove } from './input.js'
import { install as installTouch } from './touch.js'
import { floorAt, player, resetPlayer, rotateTowards, step as stepPlayer } from './player.js'
import { syncYawToPlayer, update as updateCamera } from './camera.js'
import { createFog, createGround, createLights, createSky } from './world.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { attachHair, createHairRope, setGrownLength, setHairColor, setHairCut, setHairLength, setTrailLength } from './avatar/hair.js'
import { createAdornments } from './avatar/adornments.js'
import { TRAIL_MIN_SPEED, createTrail } from './avatar/trail.js'
import { isEquipped } from './avatar/cdn.js'
import { addCollider } from './colliders.js'
import { buildLobby } from './lobby/lobby.js'
import { STEP_TIME } from './lobby/treadmill.js'
import { buildLavaPath, LAVA_FINISH } from './lavaPath.js'
import { buildZone3, ZONE3_GOAL, ZONE3_SPAWN, ZONE3_WIN } from './zone3.js'
import { buildZone4, ZONE4_BONUS, ZONE4_SPAWN, ZONE4_WIN } from './zone4.js'
import { buildZone5, ZONE5_BONUS, ZONE5_SPAWN, ZONE5_WIN, ZONE5_Z0 } from './zone5.js'
import { buildZone6, ZONE6_BONUS, ZONE6_SPAWN, ZONE6_WIN, ZONE6_Z0 } from './zone6.js'
import { buildZone7, ZONE7_BONUS, ZONE7_SPAWN, ZONE7_Z0 } from './zone7.js'
import { buildZone8, ZONE8_BONUS, ZONE8_SPAWN, ZONE8_WIN, ZONE8_Z0 } from './zone8.js'
import { buildZone9, ZONE9_BONUS, ZONE9_SPAWN, ZONE9_WIN, ZONE9_Z0 } from './zone9.js'
import { buildZone10, ZONE10_BONUS, ZONE10_SPAWN, ZONE10_WIN, ZONE10_Z0 } from './zone10.js'
import { buildZone11, ZONE11_BONUS, ZONE11_SPAWN, ZONE11_WIN, ZONE11_Z0 } from './zone11.js'
import { buildZone12, ZONE12_BONUS, ZONE12_SPAWN, ZONE12_WIN, ZONE12_Z0 } from './zone12.js'
import { buildZone13, ZONE13_BONUS, ZONE13_SPAWN, ZONE13_WIN, ZONE13_Z0 } from './zone13.js'
import { buildZone14, ZONE14_BONUS, ZONE14_SPAWN, ZONE14_WIN, ZONE14_Z0 } from './zone14.js'
import { createHud } from './hud.js'
import { createHairCable } from './hairCable.js'
import { createSpeedFx } from './speedFx.js'
import { installClickSound, playLevelUp, playSfx } from './sfx.js'
import { celebrate } from './party.js'
import { createCableSfx } from './cableSfx.js'
import * as game from './game/state.js'
import { CUTS } from './game/cosmetics.js'
import { createSalon } from './salon/salon.js'
import { initNet, net, onHydrated, sendPose, syncAvatar } from './net.js'
import { createRemotePlayers } from './remotePlayers.js'
import { createTutorial } from './tutorial.js'

// --- Bloxity + player state -----------------------------------------------
bloxity.init()
resetPlayer(SPAWN, SPAWN_FACING)
syncYawToPlayer()

// --- Renderer / scene -------------------------------------------------------
const GRAPHICS_PRESETS = {
  Low: { shadows: false, antialias: false, dpr: 1 },
  Medium: { shadows: true, antialias: false, dpr: 1.5 },
  High: { shadows: true, antialias: true, dpr: 2 },
  Ultra: { shadows: true, antialias: true, dpr: 2 },
}
const preset = GRAPHICS_PRESETS[bloxity.settings.graphics_quality] ?? GRAPHICS_PRESETS.High
// Phones and tablets: cap the resolution and skip MSAA (High/Ultra then render like Medium), a 3x screen is too much fill.
const touchFirst = window.matchMedia('(pointer: coarse)').matches

const renderer = new WebGLRenderer({ antialias: preset.antialias && !touchFirst, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr, touchFirst ? TOUCH.maxPixelRatio : Infinity))
document.body.appendChild(renderer.domElement)
installInput(bloxity.showMenu, renderer.domElement)
installTouch(renderer.domElement)
installClickSound() // UI button ticks

const scene = new Scene()
scene.fog = createFog()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
camera.position.set(0, 12, 24)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

const sky = createSky() // follows the camera: Zone 4 reaches past its radius
scene.add(sky, createGround())
const lights = createLights()
scene.add(lights.hemi, lights.sun, lights.sun.target)

// --- World: the lobby (spawn) ------------------------------------------------
const lobby = buildLobby(scene, addCollider)
const lava = buildLavaPath(scene, addCollider)
const zone3 = buildZone3(scene, addCollider, { nextWin: ZONE4_WIN })
const zone4 = buildZone4(scene, addCollider)
const zone5 = buildZone5(scene, addCollider)
const zone6 = buildZone6(scene, addCollider)
const zone7 = buildZone7(scene, addCollider)
const zone8 = buildZone8(scene, addCollider)
const zone9 = buildZone9(scene, addCollider)
const zone10 = buildZone10(scene, addCollider)
const zone11 = buildZone11(scene, addCollider)
const zone12 = buildZone12(scene, addCollider)
const zone13 = buildZone13(scene, addCollider)
const zone14 = buildZone14(scene, addCollider)
const HUB_NORTH_Z = -34 // the Hub's north wall (START doorway)

// --- Avatar layer -------------------------------------------------------------
// Everything that draws the player: the character, the hair rope, charms + aura, the run
// trail. One group, so the Hair Salon can move it into its own scene and back.
const remotePlayers = createRemotePlayers(scene) // the other players in the room (net.js)
const avatarLayer = new Group()
scene.add(avatarLayer)
const playerGroup = new Group()
avatarLayer.add(playerGroup)
// The hair lies on the world's floors, or on the salon's pedestal while the salon is open.
const hairRope = createHairRope(avatarLayer, (x, z, feetY) => (salon.active ? salon.floorAt(x, z) : floorAt(x, z, feetY))) // the hanging strand + floor trail, one tube
const adornments = createAdornments(avatarLayer) // charms on the hair, aura rings along it
const runTrail = createTrail(avatarLayer) // the ribbon behind the runner

// --- HUD + progression ------------------------------------------------------
const hud = createHud({
  onMenu: bloxity.showMenu,
  onSkipQuest: () => (tutorial.active() ? tutorial.skip() : game.skipQuest()),
  onTeleport: (spot) => respawn(spot),
  onOpenSalon: () => salon.open(),
  // Teleport window: one stage per zone (Hub, Lava Run, Ice Lake, Desert Canyon, Purple Palace, Teal Citadel, Amber Halls, Violet Tower, Crystal Cavern, Sky Gardens, Jungle Ruins, Magma Forge, Neon Skyline, Star Summit).
  world: 'World 1: Hairy Heights',
  stages: [
    { level: 0, wins: 0, spot: SPAWN },
    { level: 16, wins: 5, spot: { x: 0, y: 1.7, z: -40 } },
    { level: 46, wins: 6, spot: ZONE3_SPAWN },
    { level: 68, wins: 14, spot: ZONE4_SPAWN },
    { level: 95, wins: 30, spot: ZONE5_SPAWN },
    { level: 120, wins: 45, spot: ZONE6_SPAWN },
    { level: 150, wins: 75, spot: ZONE7_SPAWN },
    { level: 180, wins: 110, spot: ZONE8_SPAWN },
    { level: 210, wins: 210, spot: ZONE9_SPAWN },
    { level: 240, wins: 380, spot: ZONE10_SPAWN },
    { level: 270, wins: 700, spot: ZONE11_SPAWN },
    { level: 300, wins: 1200, spot: ZONE12_SPAWN },
    { level: 330, wins: 1900, spot: ZONE13_SPAWN },
    { level: 360, wins: 2900, spot: ZONE14_SPAWN },
  ],
  // Worlds tab cards: World 2 shows as gated by Prestige 1 (a threshold, not spent); neither it nor World 3 is built yet.
  worlds: [{ name: 'Hairy Heights', spot: SPAWN, art: 'heights' }, { name: 'Wonder Worlds', prestige: 1, art: 'wonder' }, { name: '???', art: 'mystery' }],
  // Hub until the START doorway, Lava Run until its finish ends, Ice Lake until its goal platform, Desert Canyon until its finish platform ends, Purple Palace until its back wall, Teal Citadel until its back wall, Amber Halls until its north end, Violet Tower until its mine deck ends, Crystal Cavern until its back building, then each zone until its exit: Sky Gardens, Jungle Ruins, Magma Forge, Neon Skyline, Star Summit.
  currentStage: () => stageHere(),
  onClaimBoost: () => {
    if (game.boostActive()) return
    game.startBoost()
    hud.toast('2x HAIR BOOST!', '#ffd21a')
    hud.chat('<b>[Event]</b> 2x Hair boost active for 5 minutes!')
  },
})
function stageHere() {
    const z = player.position.z
    return z > HUB_NORTH_Z ? 0 : z > LAVA_FINISH.z1 ? 1 : z > ZONE3_GOAL.z0 ? 2 : z > ZONE5_Z0 ? 3 : z > ZONE6_Z0 ? 4 : z > ZONE7_Z0 ? 5 : z > ZONE8_Z0 ? 6 : z > ZONE9_Z0 ? 7 : z > ZONE10_Z0 ? 8 : z > ZONE11_Z0 ? 9 : z > ZONE12_Z0 ? 10 : z > ZONE13_Z0 ? 11 : z > ZONE14_Z0 ? 12 : 13
}
// The Hair Salon (the Hair button): its own scene, camera framing and overlay.
const salon = createSalon({
  renderer,
  camera,
  layer: avatarLayer,
  worldScene: scene,
  toast: (text, fill) => hud.toast(text, fill),
  error: (text) => hud.error(text),
  onToggle: (on) => {
    hud.setSalon(on)
    if (on) cable.release(true)
  },
})
const playerName = () => {
  const u = bloxity.authState.user
  return (u && (u.displayName || u.username || u.name)) || 'You'
}
// The new-player tutorial borrows the quest pill until it is finished or skipped.
const showQuest = (s) => {
  const q = game.QUESTS[s.quest]
  hud.setQuest(s.quest, game.QUESTS.length, q ? q.text : 'All quests done! Keep growing your *hair*!')
}
const firstTreadmill = lobby.treadmills[0].center
const firstStyle = lobby.shopSpot(TUTORIAL.style)
const tutorial = createTutorial(scene, hud, {
  targets: {
    treadmill: { x: firstTreadmill.x, y: firstTreadmill.y - 1, z: firstTreadmill.z },
    portal: { x: 0, y: 0, z: HUB_NORTH_Z - 2 }, // just past the doorway, where the portal flag trips
    winPad: { x: LAVA_FINISH.padX, y: LAVA_FINISH.top, z: LAVA_FINISH.z },
    shop: { x: firstStyle.x, y: firstStyle.y - 1, z: firstStyle.z },
  },
  onBelt: () => treadmillRunning,
  inHub: () => player.position.z > HUB_NORTH_Z,
  getCable: () => cable,
  safeAt: (x, y, z) => floorAt(x, z, y + 0.05) >= LAVA_FINISH.top - 0.1, // a Lava Run slab (or higher) underneath, not the lava
  onEnd: () => showQuest(game.state),
})

game.onChange((s) => {
  hud.setState(s)
  hud.setHair(s.hair)
  hud.setLevel(s.level, s.xp, game.levelRequirement(s.level))
  if (!tutorial.active()) showQuest(s)
  hud.setStats([
    ['Hair', s.hair.toLocaleString()],
    ['Best Hair', s.bestHair.toLocaleString()],
    ['Level', s.level],
    ['Wins', s.wins],
    ['Rebirths', s.rebirths],
    ['Hair / step', `+${game.hairPerStep(1)} (x1 treadmill)`],
  ])
  // The hair shows the grown length cut down to the salon's Length slider; the cable reaches with all of it.
  const shown = game.visibleHair()
  setHairLength(Math.max(HAIR.minLength, game.hairLengthFor(shown) * HAIR.visualScale))
  setTrailLength(game.trailLengthFor(shown) * HAIR.visualScale)
  setGrownLength(game.hairLengthFor(s.hair), game.trailLengthFor(s.hair), s.hair)
  const hairColor = game.HAIR_STYLES[s.equipped].color
  setHairColor(hairColor)
  setHairCut(CUTS[s.cut])
  adornments.setCharms(s.charms)
  adornments.setAura(s.aura, hairColor)
  runTrail.set(s.trail)
  player.moveSpeed = PHYSICS.moveSpeed + game.walkBonus() // Quick Feet upgrade
  lobby.refresh(s, playerName())
  salon.refresh()
})
// One sound per celebration: rebirths fanfare, rewards chime, spending rings the till. A level up
// plays its own synthesised jingle (playLevelUp) and flashes the level bar.
const EVENT_SFX = { rebirth: 'levelUp', prestige: 'levelUp', upgrade: 'winClaim', win: 'winClaim', chest: 'winClaim', quest: 'winClaim', buy: 'cash' }
game.onEvent((e) => {
  const sfx = e.bought ? 'cash' : EVENT_SFX[e.type]
  if (sfx) playSfx(sfx)
  if (e.type === 'level') {
    playLevelUp()
    hud.levelUp()
    hud.toast(`LEVEL UP! Level ${e.level}`, '#5fe0ff')
    hud.chat(`<b>[Server]</b> You reached Level ${e.level}!`)
  } else if (e.type === 'win') {
    hud.toast(`ESCAPED! +${e.amount} Win${e.amount > 1 ? 's' : ''}`, '#ffd21a')
    hud.chat(`<b>[Server]</b> You escaped! Total wins: ${e.wins}`)
  } else if (e.type === 'rebirth') {
    hud.toast(`REBIRTH ${e.rebirths}! +50% Hair`, '#d9a8ff')
    hud.chat(`<b>[Server]</b> Rebirth ${e.rebirths}: hair bonus is now x${1 + e.rebirths * game.REBIRTH_BONUS}`)
  } else if (e.type === 'prestige') {
    hud.toast(`PRESTIGE ${e.prestige}! x${game.prestigeMultiplier()} Hair & Wins`, '#ff9ad3')
    hud.chat(`<b>[Server]</b> Prestige ${e.prestige}: hair and Wins are now x${game.prestigeMultiplier()} for good!`)
  } else if (e.type === 'upgrade') {
    hud.toast(`${game.UPGRADES[e.id].name} Lv ${e.level}!`, '#b6ff7a')
  } else if (e.type === 'chest') {
    hud.toast(`${game.CHESTS[e.id].name}: +${e.amount.toLocaleString()} Hair!`, '#ffd21a')
    hud.chat(`<b>[Chest]</b> You opened the ${game.CHESTS[e.id].name}.`)
  } else if (e.type === 'buy') {
    hud.toast(`Unlocked ${e.key}!`, '#b6ff7a')
  } else if (e.type === 'equip') {
    hud.toast(`Equipped ${game.HAIR_STYLES[e.id].name}!`, game.HAIR_STYLES[e.id].color)
  } else if (e.type === 'wear') {
    hud.toast(`Wearing ${game.SALON_KINDS[e.kind][e.id].name}!`, '#ff9ad3')
  }
})
game.load()
const offline = game.takeOfflineEarnings()
if (offline > 0) {
  hud.toast(`+${offline.toLocaleString()} Hair while offline!`, '#ffd21a')
  hud.chat(`<b>[AFK]</b> You earned ${offline.toLocaleString()} hair while you were away.`)
}
// The account's save from the server (net.js) replaces the local one once it arrives.
onHydrated((away) => {
  if (away > 0) {
    hud.toast(`+${away.toLocaleString()} Hair while offline!`, '#ffd21a')
    hud.chat(`<b>[AFK]</b> You earned ${away.toLocaleString()} hair while you were away.`)
  }
  hud.chat('<b>[Server]</b> Progress loaded.')
})
hud.chat('<b>[Server]</b> Welcome to Hair Escape! Hop on a treadmill to grow your hair.')

// --- Player avatar ----------------------------------------------------------
// The game's own character (player.glb, or the procedural fallback). A signed-in
// player's equipped Bloxity cosmetics are attached and the customizer's body
// proportions applied; it rebuilds on customizer edits and sign-in/out.
// (The avatar layer it lives in is created above the HUD: progression listeners style it.)
const cable = createHairCable() // Space: launch the hair ahead in an arc and ride it
const cableSfx = createCableSfx() // the hair's whip, whoosh, strike, creak, zip wind and reel-in
const syncRideSpeed = () => (cable.speedMult = game.rideMultiplier()) // Zippy Hair upgrade
syncRideSpeed()
game.onChange(syncRideSpeed)
const speedFx = createSpeedFx(playerGroup, player.dims.height) // streaks, vignette, FOV and glow while zipping
const lastFeet = { x: 0, z: 0 }

let avatar = null
let animator = null
let hair = null
let generation = 0

function setAvatar(next, equipped = null) {
  if (avatar) playerGroup.remove(avatar)
  cable.release(true)
  disposeAnimator(animator)
  hair?.dispose()
  avatar = next
  playerGroup.add(avatar)
  animator = makeAnimator(avatar)
  hair = attachHair(avatar) // parented to the head bone; length comes from hairState
  hair?.setHatEquipped(isEquipped(equipped?.hatId)) // the crown would poke through a hat
}

setAvatar(buildDefaultCharacter()) // visible immediately; replaced once the rig loads

async function loadAvatar() {
  // The SDK fires twice per change (optimistic + confirmed); only the newest load may land.
  const mine = ++generation
  const group = await loadBaseCharacter()
  if (mine !== generation) return
  const equipped = bloxity.authState.user ? bloxity.getEquippedAvatar() : null
  await attachEquippedAccessories(group, equipped, { skinTextureUrl: bloxity.getSkinTextureUrl() })
  if (mine !== generation) return
  applyProportions(group, bloxity.getProportions())
  setAvatar(group, equipped)
  syncAvatar() // tell the other players what we look like now
}

let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  if (now !== signedIn) {
    signedIn = now
    loadAvatar() // also runs once at start to swap in the real rig
  }
})
bloxity.onAvatarChanged(loadAvatar)
bloxity.onProportionsChanged(() => applyProportions(avatar, bloxity.getProportions()))
bloxity.onSetting((key, value) => {
  if (key === 'graphics_quality') renderer.shadowMap.enabled = (GRAPHICS_PRESETS[value] ?? GRAPHICS_PRESETS.High).shadows
})

// --- Gameplay glue ------------------------------------------------------------
const screenPos = new Vector3()
function popupAt(text, x, y, z) {
  screenPos.set(x, y, z).project(camera)
  if (screenPos.z > 1) return
  hud.popup(text, ((screenPos.x + 1) / 2) * window.innerWidth, ((1 - screenPos.y) / 2) * window.innerHeight)
}

// Treadmills (the Hub's row and the zones' goal-platform ones): the belt drags the runner away from its console; running on it grows hair.
const treadmills = [lobby, zone3, zone5, zone6, zone8, zone9, zone10, zone11, zone12, zone13, zone14].flatMap((z) => z.treadmills)
let stepTimer = 0
let treadmillRunning = false // training on a belt: the run animation plays even though the belt cancels the motion
function updateTreadmills(dt) {
  const p = player.position
  treadmillRunning = false
  const belt = player.grounded ? treadmills.find((t) => !t.locked && t.contains(p)) : null
  if (!belt) {
    stepTimer = 0
    return
  }
  game.setFlag('treadmill')
  // Steering off the belt fights its drag; with no input the runner jogs in place, facing against the belt.
  const steering = Math.hypot(inputState.move.x, inputState.move.z) > 0.1
  if (steering) {
    p.x += belt.beltPush.x * dt
    p.z += belt.beltPush.z * dt
  } else player.facing = rotateTowards(player.facing, Math.atan2(-belt.beltPush.x, -belt.beltPush.z), PHYSICS.turnSpeed * dt)
  treadmillRunning = true
  stepTimer += dt
  while (stepTimer >= STEP_TIME) {
    stepTimer -= STEP_TIME
    const n = game.hairPerStep(belt.mult)
    game.addHair(n)
    belt.steps++
    belt.repaint()
    popupAt(`+${n}`, p.x, p.y + player.dims.height + 0.6, p.z)
  }
}

let finishTimer = null
let runOpen = false // the player has left the Hub; coming back resets every zone's once-per-run awards
function respawn(spot = SPAWN) {
  clearTimeout(finishTimer)
  cable.release(true)
  resetPlayer(spot, SPAWN_FACING)
  syncYawToPlayer()
}
// A win pad awards its Wins, then sends the player home to the Hub (which also resets every zone's awards).
const HOME_DELAY = 1800 // ms the win lingers before the trip home
function winAndGoHome(wins) {
  game.addWin(wins)
  clearTimeout(finishTimer)
  finishTimer = setTimeout(() => respawn(), HOME_DELAY)
}
function updateZones(dt, time) {
  const p = player.position
  if (lobby.portalHit(p) && !game.state.flags?.portal) game.setFlag('portal')
  if (p.z < HUB_NORTH_Z) runOpen = true
  else if (runOpen) {
    runOpen = false
    lava.reset()
    zone3.reset()
    zone4.reset()
    zone5.reset()
    zone6.reset()
    zone7.reset()
    zone8.reset()
    zone9.reset()
    zone10.reset()
    zone11.reset()
    zone12.reset()
    zone13.reset()
    zone14.reset()
  }
  // Zone 2: the finish pad awards a Win and the run carries on into Zone 3.
  const lavaEvent = lava.update(dt, time, p)
  if (lavaEvent === 'fell') {
    lava.reset()
    respawn()
    tutorial.noteFell()
    hud.toast('Oops! Lava!', '#ff8a8a')
  } else if (lavaEvent === 'finish') winAndGoHome(1)
  // Zone 3: a fall puts you back on its entrance; the goal pad awards wins and the run carries on into Zone 4.
  const iceEvent = zone3.update(dt, time, p)
  if (iceEvent === 'fell') {
    respawn()
    hud.toast('Brrr! Too cold!', '#9fdcff')
  } else if (iceEvent === 'finish') winAndGoHome(ZONE3_WIN)
  // Climbing panels (Zones 4, 6, 8 and the vine panels of 11) lift the player while a move key is held against them.
  if (!cable.zipping && (zone4.climbAt(p) || zone6.climbAt(p) || zone8.climbAt(p) || zone11.climbAt(p))) {
    const v = player.velocity
    v.y = Math.hypot(inputState.move.x, inputState.move.z) > 0.1 ? PHYSICS.climbSpeed : Math.max(v.y, -PHYSICS.climbSlide)
  }
  // Zone 10's cloud springs launch a player standing on them; Zone 14 is low gravity.
  if (!cable.zipping && player.grounded && zone10.bounceAt(p)) player.velocity.y = PHYSICS.bounceSpeed
  player.gravityScale = zone14.contains(p) ? PHYSICS.spaceGravity : 1
  // Zone 4: blue panels climb the courtyard pillars; a fall puts you back on its
  // entrance; the gate ring is a bonus win; the pink platform's pad awards wins and the run carries on into Zone 5.
  const desertEvent = zone4.update(dt, time, p)
  if (desertEvent === 'fell' || desertEvent === 'burned') {
    respawn()
    hud.toast(desertEvent === 'burned' ? 'Ouch! Hot lava!' : 'Sinking sand!', '#ffb36b')
  } else if (desertEvent === 'bonus') game.addWin(ZONE4_BONUS)
  else if (desertEvent === 'finish') winAndGoHome(ZONE4_WIN)
  // Zone 5: the lava, or a fall off the open plateau, puts you back at the walkway's start; the chamber ring is a bonus win and the final pad the zone's win (the run carries on into Zone 6).
  const palaceEvent = zone5.update(dt, time, p)
  if (palaceEvent === 'burned' || palaceEvent === 'fell') {
    respawn()
    hud.toast(palaceEvent === 'burned' ? 'Ouch! Hot lava!' : 'Watch your step!', '#ff8ad8')
  } else if (palaceEvent === 'bonus') game.addWin(ZONE5_BONUS)
  else if (palaceEvent === 'finish') winAndGoHome(ZONE5_WIN)
  // Zone 6: the goo puts you back on its start platform; the ledge ring is a bonus win and the summit pad the zone's win (the run carries on into Zone 7).
  const citadelEvent = zone6.update(dt, time, p)
  if (citadelEvent === 'fell') {
    respawn()
    hud.toast('Splash! Sticky goo!', '#7ff6ff')
  } else if (citadelEvent === 'bonus') game.addWin(ZONE6_BONUS)
  else if (citadelEvent === 'finish') winAndGoHome(ZONE6_WIN)
  // Zone 7: the pit puts you back at the hall's entrance; the gate ring is a bonus win (the run carries on into Zone 8).
  const hallsEvent = zone7.update(dt, time, p)
  if (hallsEvent === 'fell') {
    respawn()
    hud.toast('Mind the gap!', '#ffb36b')
  } else if (hallsEvent === 'bonus') game.addWin(ZONE7_BONUS)
  // Zone 8: panels climb the cross walls; the pit puts you back on its start platform; the ledge ring is a bonus win.
  const towerEvent = zone8.update(dt, time, p)
  if (towerEvent === 'fell') {
    respawn()
    hud.toast('Whoops! Climb again!', '#c79bff')
  } else if (towerEvent === 'bonus') game.addWin(ZONE8_BONUS)
  else if (towerEvent === 'finish') winAndGoHome(ZONE8_WIN)
  // Zone 9: only the hair cable crosses the chasm; a fall puts you back on its deck; the mid-gap ring is a bonus win and the candy deck's pad the zone's win.
  const cavernEvent = zone9.update(dt, time, p)
  if (cavernEvent === 'fell') {
    respawn()
    hud.toast('Use your hair cable!', '#c79bff')
  } else if (cavernEvent === 'bonus') game.addWin(ZONE9_BONUS)
  else if (cavernEvent === 'finish') winAndGoHome(ZONE9_WIN)
  // Zones 10-14 carry the player on moving platforms, so they are told when the cable has them instead.
  const carry = !cable.zipping
  // Zone 10: the springs bounce you between the islands; a fall puts you back on the start island; the ring in the first arc is a bonus win.
  const skyEvent = zone10.update(dt, time, p, carry)
  if (skyEvent === 'fell') {
    respawn()
    hud.toast('Lost in the clouds!', '#bfe4ff')
  } else if (skyEvent === 'bonus') game.addWin(ZONE10_BONUS)
  else if (skyEvent === 'finish') winAndGoHome(ZONE10_WIN)
  // Zone 11: the rafts and the ferry move; vine panels climb the temple; the swamp puts you back on the last checkpoint.
  const jungleEvent = zone11.update(dt, time, p, carry)
  if (jungleEvent === 'fell') {
    respawn()
    hud.toast('Splash! Sticky swamp!', '#b6ff5a')
  } else if (jungleEvent === 'bonus') game.addWin(ZONE11_BONUS)
  else if (jungleEvent === 'finish') winAndGoHome(ZONE11_WIN)
  // Zone 12: the blocks sink under you and the gears turn; the lava puts you back on the last checkpoint.
  const forgeEvent = zone12.update(dt, time, p, carry)
  if (forgeEvent === 'burned') {
    respawn()
    hud.toast('Ouch! Molten lava!', '#ffb347')
  } else if (forgeEvent === 'bonus') game.addWin(ZONE12_BONUS)
  else if (forgeEvent === 'finish') winAndGoHome(ZONE12_WIN)
  // Zone 13: lasers sweep the roofs and the taxi shuttles; a fall or a zap puts you back on the last checkpoint; the wide street needs the cable.
  const neonEvent = zone13.update(dt, time, p, carry)
  if (neonEvent === 'fell' || neonEvent === 'zapped') {
    respawn()
    hud.toast(neonEvent === 'zapped' ? 'Zzzap! Jump the lasers!' : 'Long way down!', '#ff5fd0')
  } else if (neonEvent === 'bonus') game.addWin(ZONE13_BONUS)
  else if (neonEvent === 'finish') winAndGoHome(ZONE13_WIN)
  // Zone 14: low gravity and orbiting rocks; a fall puts you back on the last checkpoint; the palace pad ends the run.
  const starEvent = zone14.update(dt, time, p, carry)
  if (starEvent === 'fell') {
    respawn()
    hud.toast('Lost in space!', '#c79bff')
  } else if (starEvent === 'bonus') game.addWin(ZONE14_BONUS)
  else if (starEvent === 'finish') winAndGoHome(ZONE14_WIN)
}

// Nearest interactable in range drives the prompt; E (or clicking the prompt) runs it.
function updateInteraction() {
  const p = player.position
  let best = null
  let bestD = Infinity
  for (const it of lobby.interactables) {
    const d = Math.hypot(p.x - it.position.x, p.z - it.position.z)
    if (d < it.radius && d < bestD && Math.abs(p.y + 1 - it.position.y) < 3) {
      best = it
      bestD = d
    }
  }
  if (best && !cable.zipping && !cable.flying) { // on the hair: no interacting, the only control is letting go
    const [text, enabled, locked] = best.prompt()
    hud.setPrompt(text, enabled, best.action, locked)
    if (inputState.interact) {
      if (enabled) best.action()
      else if (locked) hud.error(locked) // tried a locked one: say why, with the error buzzer
    }
  } else hud.setPrompt(null, false)
  inputState.interact = false
}

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
let time = 0
let wasFlying = false

// The Hair Salon frame: the world is paused, the avatar poses on the pedestal, the salon camera renders its scene.
const SALON_TRAIL_ORBIT = { radius: 2.2, speed: 1.8 } // m, rad/s: the run trail previewed circling the pedestal (Trails tab)
function salonFrame(dt) {
  inputState.jump = inputState.grapple = inputState.interact = false
  inputState.look.dx = inputState.look.dy = inputState.zoom = 0
  const switched = salon.takeSwitch()
  const spot = salon.spot
  playerGroup.position.set(spot.x, spot.y, spot.z)
  playerGroup.rotation.y = salon.facing
  animator?.update(dt, { grounded: true, speed: 0, verticalVelocity: 0, turn: 0, hanging: false, hangPitch: 0 })
  hair?.update(dt, 0)
  hair?.setStretched(false)
  playerGroup.updateMatrixWorld(true)
  speedFx.update(dt, false, 0)
  cableSfx.update(dt, cable) // a cable dropped on entry still fades out
  hud.setCableLength(null)
  hairRope.update(dt, hair, switched, salon.facing, spot.y, null, salon.curl)
  adornments.update(dt, hairRope, salon.facing)
  const a = time * SALON_TRAIL_ORBIT.speed
  const r = SALON_TRAIL_ORBIT.radius
  runTrail.update(dt, Math.sin(a) * r, spot.y, Math.cos(a) * r, a + Math.PI / 2, salon.tab === 'trails', switched)
  salon.update(dt)
  renderer.render(salon.scene, camera)
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  time += dt
  if (salon.active) {
    salonFrame(dt)
    bloxity.notifyFirstFrame()
    return
  }
  // A tutorial card is up (the lava lesson's freeze-frames): the world holds still until the player does what it asks.
  if (tutorial.paused()) {
    tutorial.pausedFrame()
    cableSfx.update(dt, cable, true)
    renderer.render(scene, camera)
    bloxity.notifyFirstFrame()
    return
  }
  const leftSalon = salon.takeSwitch()
  if (inputState.grapple) {
    cable.fire()
    inputState.grapple = false
  }
  if (inputState.stopTip && cable.flying) cable.stopTip(player)
  inputState.stopTip = false
  // Riding the hair locks every control but letting go (above) and looking around: the cable carries the player.
  if (cable.zipping) {
    inputState.jump = false
    inputState.zoom = 0 // wheel / pinch do nothing until the player lets go
  }
  // While the tip flies the only controls are steering it (look input, WASD / arrows) and letting go: the body stays put, jump and interact do nothing.
  if (cable.flying) {
    refreshMove() // the keys still held (zeroed below every frame)
    cable.steerKeys(inputState.move.x, inputState.move.z)
    inputState.move.x = inputState.move.z = 0
    inputState.jump = false
    inputState.interact = false
    inputState.zoom = 0
  } else if (wasFlying) refreshMove() // keys still held when the tip stuck walk on again
  wasFlying = cable.flying
  document.documentElement.classList.toggle('riding', cable.zipping)
  document.documentElement.classList.toggle('flying', cable.flying)
  stepPlayer(dt)
  updateTreadmills(dt)
  updateZones(dt, time)
  game.reachStage(stageHere())
  updateInteraction()
  tutorial.update(time)
  lobby.update(dt, time)
  hud.setBoost(Math.max(0, Math.ceil((game.state.boostUntil - Date.now()) / 1000)))

  playerGroup.position.set(player.position.x, player.position.y, player.position.z)
  playerGroup.rotation.y = player.facing
  const speed = Math.hypot(player.velocity.x, player.velocity.z)
  const animSpeed = treadmillRunning ? Math.max(speed, ANIM.locomotion.runSpeed) : speed
  animator?.update(dt, {
    grounded: player.grounded,
    speed: animSpeed,
    verticalVelocity: player.velocity.y,
    turn: cable.zipping ? 0 : inputState.move.x,
    hanging: cable.zipping,
    hangPitch: cable.pitch,
  })
  hair?.update(dt, speed)
  hair?.setStretched(cable.active) // the back strand is out as the cable
  playerGroup.updateMatrixWorld(true)
  cable.update(dt, { hair, player })
  hud.setCableLength(cable.remaining(), cable.fullLength())
  speedFx.update(dt, cable.zipping, cable.rideSpeed())
  cableSfx.update(dt, cable)
  const jumped = leftSalon || Math.hypot(player.position.x - lastFeet.x, player.position.z - lastFeet.z) > 8 // a teleport (or back from the salon), not a step
  lastFeet.x = player.position.x
  lastFeet.z = player.position.z
  hairRope.update(dt, hair, jumped, player.facing, player.position.y, cable)
  adornments.update(dt, hairRope, player.facing)
  runTrail.update(dt, player.position.x, player.position.y, player.position.z, player.facing, speed > TRAIL_MIN_SPEED, jumped)
  sendPose(player, speed, cable)
  remotePlayers.update(dt, player.position)

  updateCamera(camera, dt)
  sky.position.copy(camera.position)
  lights.follow(player.position.x, player.position.z)
  renderer.render(scene, camera)
  bloxity.notifyFirstFrame()
})

initNet() // after the first avatar and state exist: connects once Bloxity auth settles
window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(10, 0, -5)
if (import.meta.env.DEV) {
  window.__game = { player, game, net, setHairLength, celebrate, teleport: (x, y, z, facing = player.facing) => { resetPlayer({ x, y, z }, facing); syncYawToPlayer() } }
}
