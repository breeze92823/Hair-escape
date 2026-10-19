import { Clock, Group, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { CAMERA, SPAWN, SPAWN_FACING } from './config.js'
import * as bloxity from './bloxity.js'
import { inputState, install as installInput } from './input.js'
import { floorAt, player, resetPlayer, step as stepPlayer } from './player.js'
import { syncYawToPlayer, update as updateCamera } from './camera.js'
import { createFog, createGround, createLights, createSky } from './world.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { attachHair, createHairTrail, setHairColor, setHairLength, setTrailLength } from './avatar/hair.js'
import { isEquipped } from './avatar/cdn.js'
import { addCollider } from './colliders.js'
import { buildLobby } from './lobby/lobby.js'
import { STEP_TIME } from './lobby/treadmill.js'
import { buildCourse } from './course.js'
import { createHud } from './hud.js'
import * as game from './game/state.js'

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

const renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(bloxity.showMenu, renderer.domElement)

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

scene.add(createSky(), createGround())
const lights = createLights()
scene.add(lights.hemi, lights.sun, lights.sun.target)

// --- World: the lobby (spawn) and the course behind its START portal --------
const lobby = buildLobby(scene, addCollider, { onEvent: () => hud.openEvent() })
const course = buildCourse(scene, addCollider)

// --- HUD + progression ------------------------------------------------------
const hud = createHud({
  onMenu: bloxity.showMenu,
  onSkipQuest: () => game.skipQuest(),
  onClaimBoost: () => {
    if (game.boostActive()) return
    game.startBoost()
    hud.toast('2x HAIR BOOST!', '#ffd21a')
    hud.chat('<b>[Event]</b> 2x Hair boost active for 5 minutes!')
  },
})
const playerName = () => {
  const u = bloxity.authState.user
  return (u && (u.displayName || u.username || u.name)) || 'You'
}

game.onChange((s) => {
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
  setHairLength(game.hairLengthFor(s.hair))
  setTrailLength(game.trailLengthFor(s.hair))
  setHairColor(game.HAIR_STYLES[s.equipped].color)
  lobby.refresh(s, playerName())
})
game.onEvent((e) => {
  if (e.type === 'level') {
    hud.toast(`LEVEL UP! Level ${e.level}`, '#5fe0ff')
    hud.chat(`<b>[Server]</b> You reached Level ${e.level}!`)
  } else if (e.type === 'quest') {
    hud.toast('Quest Complete!', '#b6ff7a')
  } else if (e.type === 'win') {
    hud.toast('ESCAPED! +1 Win', '#ffd21a')
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
const playerGroup = new Group()
scene.add(playerGroup)
const hairTrail = createHairTrail(scene, floorAt)
const lastFeet = { x: 0, z: 0 }

let avatar = null
let animator = null
let hair = null
let generation = 0

function setAvatar(next, equipped = null) {
  if (avatar) playerGroup.remove(avatar)
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

function teleport(spot, facing = Math.PI) {
  resetPlayer(spot, facing)
  syncYawToPlayer()
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
function updateCourse(dt, time) {
  const p = player.position
  if (lobby.portalHit(p) && !game.state.flags?.portal) {
    game.setFlag('portal')
    hud.toast('Escape the course!', '#ffffff')
  }
  let gatePrompt = null
  for (const e of course.update(dt, time, p, game.state.hair)) {
    if (e === 'fell') {
      teleport(course.checkpoint())
      hud.toast('Oops!', '#ff8a8a')
    } else if (e === 'checkpoint') hud.toast('Checkpoint!', '#b6ff7a')
    else if (e === 'bounce') {
      player.velocity.y = course.BOUNCE.speed
      player.grounded = false
    } else if (e === 'finish') {
      game.addWin()
      clearTimeout(finishTimer)
      finishTimer = setTimeout(() => {
        course.reset()
        teleport(SPAWN, SPAWN_FACING)
      }, 1800)
    } else if (e.gate) gatePrompt = `Grow ${e.gate.need} hair to open this gate (you have ${game.state.hair})`
  }
  return gatePrompt
}

// Nearest interactable in range drives the prompt; E (or clicking the prompt) runs it.
function updateInteraction(gatePrompt) {
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
  if (best) {
    const [text, enabled] = best.prompt()
    hud.setPrompt(text, enabled, best.action)
    if (inputState.interact && enabled) best.action()
  } else hud.setPrompt(gatePrompt, false)
  inputState.interact = false
}

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
let time = 0

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  time += dt
  stepPlayer(dt)
  updateTreadmills(dt)
  updateInteraction(updateCourse(dt, time))
  lobby.update(dt, time)
  hud.setBoost(Math.max(0, Math.ceil((game.state.boostUntil - Date.now()) / 1000)))

  playerGroup.position.set(player.position.x, player.position.y, player.position.z)
  playerGroup.rotation.y = player.facing
  const speed = Math.hypot(player.velocity.x, player.velocity.z)
  animator?.update(dt, {
    grounded: player.grounded,
    speed,
    verticalVelocity: player.velocity.y,
    turn: inputState.move.x,
  })
  hair?.update(dt, speed)
  playerGroup.updateMatrixWorld(true)
  const jumped = Math.hypot(player.position.x - lastFeet.x, player.position.z - lastFeet.z) > 8 // a teleport, not a step
  lastFeet.x = player.position.x
  lastFeet.z = player.position.z
  hairTrail.update(dt, hair, jumped, player.facing)

  updateCamera(camera, dt)
  lights.follow(player.position.x, player.position.z)
  renderer.render(scene, camera)
  bloxity.notifyFirstFrame()
})

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(10, 0, -5)
if (import.meta.env.DEV) {
  window.__game = { player, game, course, setHairLength, teleport: (x, y, z, facing = player.facing) => { resetPlayer({ x, y, z }, facing); syncYawToPlayer() } }
}
