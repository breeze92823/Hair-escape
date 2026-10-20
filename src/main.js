import { Clock, Group, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { CAMERA, PHYSICS, SPAWN, SPAWN_FACING, TOUCH } from './config.js'
import * as bloxity from './bloxity.js'
import { inputState, install as installInput, refreshMove } from './input.js'
import { install as installTouch } from './touch.js'
import { floorAt, player, resetPlayer, step as stepPlayer } from './player.js'
import { syncYawToPlayer, update as updateCamera } from './camera.js'
import { createFog, createGround, createLights, createSky } from './world.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { attachHair, createHairRope, setGrownLength, setHairColor, setHairCut, setHairLength, setTrailLength } from './avatar/hair.js'
import { createAdornments } from './avatar/adornments.js'
import { createTrail } from './avatar/trail.js'
import { isEquipped } from './avatar/cdn.js'
import { addCollider } from './colliders.js'
import { buildLobby } from './lobby/lobby.js'
import { STEP_TIME } from './lobby/treadmill.js'
import { buildLavaPath, LAVA_FINISH } from './lavaPath.js'
import { buildZone3, ZONE3_GOAL, ZONE3_SPAWN, ZONE3_WIN } from './zone3.js'
import { buildZone4, ZONE4_BONUS, ZONE4_SPAWN, ZONE4_WIN } from './zone4.js'
import { buildZone5, ZONE5_BONUS, ZONE5_SPAWN, ZONE5_WIN, ZONE5_Z0 } from './zone5.js'
import { createHud } from './hud.js'
import { createHairCable } from './hairCable.js'
import { createSpeedFx } from './speedFx.js'
import * as game from './game/state.js'
import { CUTS } from './game/cosmetics.js'
import { createSalon } from './salon/salon.js'

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
const lobby = buildLobby(scene, addCollider, { onEvent: () => hud.openEvent() })
const lava = buildLavaPath(scene, addCollider)
const zone3 = buildZone3(scene, addCollider, { nextWin: ZONE4_WIN })
const zone4 = buildZone4(scene, addCollider)
const zone5 = buildZone5(scene, addCollider)
const HUB_NORTH_Z = -34 // the Hub's north wall (START doorway)

// --- Avatar layer -------------------------------------------------------------
// Everything that draws the player: the character, the hair rope, charms + aura, the run
// trail. One group, so the Hair Salon can move it into its own scene and back.
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
  onSkipQuest: () => game.skipQuest(),
  onTeleport: (spot) => respawn(spot),
  onOpenSalon: () => salon.open(),
  // Teleport window: one stage per zone (Hub, Lava Run, Ice Lake, Desert Canyon, Purple Palace).
  world: 'World 1: Hairy Heights',
  stages: [
    { level: 0, wins: 0, spot: SPAWN },
    { level: 16, wins: 5, spot: { x: 0, y: 1.7, z: -40 } },
    { level: 46, wins: 6, spot: ZONE3_SPAWN },
    { level: 68, wins: 14, spot: ZONE4_SPAWN },
    { level: 95, wins: 30, spot: ZONE5_SPAWN },
  ],
  worlds: [{ name: 'Hairy Heights', spot: SPAWN }, { name: 'Coming Soon' }],
  // Hub until the START doorway, Lava Run until its finish ends, Ice Lake until its goal platform, Desert Canyon until its finish platform ends, then Purple Palace.
  currentStage: () => {
    const z = player.position.z
    return z > HUB_NORTH_Z ? 0 : z > LAVA_FINISH.z1 ? 1 : z > ZONE3_GOAL.z0 ? 2 : z > ZONE5_Z0 ? 3 : 4
  },
  onClaimBoost: () => {
    if (game.boostActive()) return
    game.startBoost()
    hud.toast('2x HAIR BOOST!', '#ffd21a')
    hud.chat('<b>[Event]</b> 2x Hair boost active for 5 minutes!')
  },
})
// The Hair Salon (the Hair button): its own scene, camera framing and overlay.
const salon = createSalon({
  renderer,
  camera,
  layer: avatarLayer,
  worldScene: scene,
  toast: (text, fill) => hud.toast(text, fill),
  onToggle: (on) => {
    hud.setSalon(on)
    if (on) cable.release(true)
  },
})
const playerName = () => {
  const u = bloxity.authState.user
  return (u && (u.displayName || u.username || u.name)) || 'You'
}

game.onChange((s) => {
  hud.setState(s)
  hud.setHair(s.hair)
  hud.setLevel(s.level, s.xp, game.levelRequirement(s.level))
  const q = game.QUESTS[s.quest]
  hud.setQuest(s.quest, game.QUESTS.length, q ? q.text : 'All quests done! Keep growing your *hair*!')
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
  setHairLength(game.hairLengthFor(shown))
  setTrailLength(game.trailLengthFor(shown))
  setGrownLength(game.hairLengthFor(s.hair), game.trailLengthFor(s.hair))
  const hairColor = game.HAIR_STYLES[s.equipped].color
  setHairColor(hairColor)
  setHairCut(CUTS[s.cut])
  adornments.setCharms(s.charms)
  adornments.setAura(s.aura, hairColor)
  runTrail.set(s.trail)
  lobby.refresh(s, playerName())
  salon.refresh()
})
game.onEvent((e) => {
  if (e.type === 'level') {
    hud.toast(`LEVEL UP! Level ${e.level}`, '#5fe0ff')
    hud.chat(`<b>[Server]</b> You reached Level ${e.level}!`)
  } else if (e.type === 'quest') {
    hud.toast('Quest Complete!', '#b6ff7a')
  } else if (e.type === 'win') {
    hud.toast(`ESCAPED! +${e.amount} Win${e.amount > 1 ? 's' : ''}`, '#ffd21a')
    hud.chat(`<b>[Server]</b> You escaped! Total wins: ${e.wins}`)
  } else if (e.type === 'rebirth') {
    hud.toast(`REBIRTH ${e.rebirths}! +50% Hair`, '#d9a8ff')
    hud.chat(`<b>[Server]</b> Rebirth ${e.rebirths}: hair bonus is now x${1 + e.rebirths * game.REBIRTH_BONUS}`)
  } else if (e.type === 'chest') {
    hud.toast(`${game.CHESTS[e.id].name}: +${e.amount.toLocaleString()} Hair!`, '#ffd21a')
    hud.chat(`<b>[Chest]</b> You opened the ${game.CHESTS[e.id].name}.`)
  } else if (e.type === 'buy') {
    hud.toast(`Unlocked ${e.key.replace('tm:', '')} Hair treadmill!`, '#b6ff7a')
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
hud.chat('<b>[Server]</b> Welcome to Hair Escape! Hop on a treadmill to grow your hair.')

// --- Player avatar ----------------------------------------------------------
// The game's own character (player.glb, or the procedural fallback). A signed-in
// player's equipped Bloxity cosmetics are attached and the customizer's body
// proportions applied; it rebuilds on customizer edits and sign-in/out.
// (The avatar layer it lives in is created above the HUD: progression listeners style it.)
const cable = createHairCable() // Space: launch the hair ahead in an arc and ride it
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

// Treadmills: the belt drags the runner toward +X; running on it grows hair.
let stepTimer = 0
function updateTreadmills(dt) {
  const p = player.position
  const belt = player.grounded ? lobby.treadmills.find((t) => !t.locked && t.contains(p)) : null
  if (!belt) {
    stepTimer = 0
    return
  }
  game.setFlag('treadmill')
  p.x += belt.beltPush.x * dt
  p.z += belt.beltPush.z * dt
  const running = Math.hypot(inputState.move.x, inputState.move.z) > 0.1
  if (!running) return
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
  cable.release(true)
  resetPlayer(spot, SPAWN_FACING)
  syncYawToPlayer()
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
  }
  // Zone 2: the finish pad awards a Win and the run carries on into Zone 3.
  const lavaEvent = lava.update(dt, time, p)
  if (lavaEvent === 'fell') {
    lava.reset()
    respawn()
    hud.toast('Oops! Lava!', '#ff8a8a')
  } else if (lavaEvent === 'finish') game.addWin()
  // Zone 3: a fall puts you back on its entrance; the goal pad awards wins and the run carries on into Zone 4.
  const iceEvent = zone3.update(dt, time, p)
  if (iceEvent === 'fell') {
    respawn(ZONE3_SPAWN)
    hud.toast('Brrr! Too cold!', '#9fdcff')
  } else if (iceEvent === 'finish') game.addWin(ZONE3_WIN)
  // Zone 4: blue panels climb the courtyard pillars; a fall puts you back on its
  // entrance; the gate ring is a bonus win; the pink platform's pad awards wins and the run carries on into Zone 5.
  if (!cable.zipping && zone4.climbAt(p)) {
    const v = player.velocity
    v.y = Math.hypot(inputState.move.x, inputState.move.z) > 0.1 ? PHYSICS.climbSpeed : Math.max(v.y, -PHYSICS.climbSlide)
  }
  const desertEvent = zone4.update(dt, time, p)
  if (desertEvent === 'fell' || desertEvent === 'burned') {
    respawn(ZONE4_SPAWN)
    hud.toast(desertEvent === 'burned' ? 'Ouch! Hot lava!' : 'Sinking sand!', '#ffb36b')
  } else if (desertEvent === 'bonus') game.addWin(ZONE4_BONUS)
  else if (desertEvent === 'finish') game.addWin(ZONE4_WIN)
  // Zone 5: the lava, or a fall off the open plateau, puts you back at the walkway's start; the chamber ring is a bonus win and the final pad the zone's win.
  const palaceEvent = zone5.update(dt, time, p)
  if (palaceEvent === 'burned' || palaceEvent === 'fell') {
    respawn(ZONE5_SPAWN)
    hud.toast(palaceEvent === 'burned' ? 'Ouch! Hot lava!' : 'Watch your step!', '#ff8ad8')
  } else if (palaceEvent === 'bonus') game.addWin(ZONE5_BONUS)
  else if (palaceEvent === 'finish') {
    // The last stage so far: the win pad sends you home, which also resets every zone's awards.
    game.addWin(ZONE5_WIN)
    clearTimeout(finishTimer)
    finishTimer = setTimeout(() => respawn(), 1800)
  }
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
    const [text, enabled] = best.prompt()
    hud.setPrompt(text, enabled, best.action)
    if (inputState.interact && enabled) best.action()
  } else hud.setPrompt(null, false)
  inputState.interact = false
}

// --- Loop -------------------------------------------------------------------
const TRAIL_MIN_SPEED = 1.5 // m/s the run trail starts streaming at
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
  const leftSalon = salon.takeSwitch()
  if (inputState.grapple) {
    cable.fire()
    inputState.grapple = false
  }
  // Riding the hair locks every control but letting go (above) and looking around: the cable carries the player.
  if (cable.zipping) {
    inputState.jump = false
    inputState.zoom = 0 // wheel / pinch do nothing until the player lets go
  }
  // While the tip flies the only controls are the steering drag and letting go: WASD / the stick, jump and interact do nothing.
  if (cable.flying) {
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
  updateInteraction()
  lobby.update(dt, time)
  hud.setBoost(Math.max(0, Math.ceil((game.state.boostUntil - Date.now()) / 1000)))

  playerGroup.position.set(player.position.x, player.position.y, player.position.z)
  playerGroup.rotation.y = player.facing
  const speed = Math.hypot(player.velocity.x, player.velocity.z)
  animator?.update(dt, {
    grounded: player.grounded,
    speed,
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
  const jumped = leftSalon || Math.hypot(player.position.x - lastFeet.x, player.position.z - lastFeet.z) > 8 // a teleport (or back from the salon), not a step
  lastFeet.x = player.position.x
  lastFeet.z = player.position.z
  hairRope.update(dt, hair, jumped, player.facing, player.position.y, cable)
  adornments.update(dt, hairRope, player.facing)
  runTrail.update(dt, player.position.x, player.position.y, player.position.z, player.facing, speed > TRAIL_MIN_SPEED, jumped)

  updateCamera(camera, dt)
  sky.position.copy(camera.position)
  lights.follow(player.position.x, player.position.z)
  renderer.render(scene, camera)
  bloxity.notifyFirstFrame()
})

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(10, 0, -5)
if (import.meta.env.DEV) {
  window.__game = { player, game, setHairLength, teleport: (x, y, z, facing = player.facing) => { resetPlayer({ x, y, z }, facing); syncYawToPlayer() } }
}
