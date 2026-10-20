// New-player tutorial: walks a first-time player through the first loop (treadmill → level 3 →
// START portal → the Lava Run's Win pad → back home → buy Blueberry Hair → shoot the hair cable).
// It speaks through the quest pill (hud.setQuest in its tutorial look, whose Skip button skips the
// whole tutorial), lays a crawling trail of arrowheads from the player to the step's target with a
// spinning beacon over it, and points a bobbing arrow at the HUD / touch button to press. The step
// lives in state.tutorial and is saved with the account; tutorialLogic.js decides when it moves.
// Ported from Kick-per-click's tutorial.
import { ExtrudeGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Shape } from 'three'
import { DISABLE_TUTORIAL, TUTORIAL } from './config.js'
import { player } from './player.js'
import { HAIR_STYLES, isTutorialReady, setTutorialStep, state } from './game/state.js'
import { saveNow } from './net.js'
import { playSfx } from './sfx.js'
import { nextStep } from './tutorialLogic.js'

const CSS = `
.tut-arrow { position: fixed; left: 0; top: 0; z-index: 60; width: 54px; height: 72px; pointer-events: none; transform: translate(-50%, -100%); filter: drop-shadow(0 4px 0 rgba(0,0,0,0.35)); }
.tut-arrow[hidden] { display: none; }
.tut-arrow svg { display: block; width: 100%; height: 100%; animation: tut-bob 0.7s ease-in-out infinite; }
@keyframes tut-bob { 50% { transform: translateY(12px); } }
.tut-hl { animation: tut-glow 0.9s ease-in-out infinite !important; }
@keyframes tut-glow { 50% { box-shadow: 0 0 0 6px rgba(255,210,58,0.95), 0 0 24px 8px rgba(255,210,58,0.7); } }
`
const ARROW_SVG = '<svg viewBox="0 0 60 80"><path d="M18 4h24v34h14L30 76 4 38h14z" fill="#ffd23a" stroke="#121212" stroke-width="6" stroke-linejoin="round"/></svg>'
const TRAIL_TILT = 0.35 // rad the trail arrows lift their tips off flat
const BEACON_SCALE = 3.2
const BEACON_BOB = { amp: 0.35, rate: 4 } // m, rad/s
const BEACON_SPIN = 2 // rad/s

const isTouch = () => document.documentElement.classList.contains('touch-ui')

// targets: { treadmill, portal, winPad, shop } world spots at floor height ({ x, y, z }, `marked`: the
// world already has its own arrow there, so no beacon).
// onBelt() / inHub() / cableActive() read main.js's frame state; onEnd() hands the pill back to the quests.
export function createTutorial(scene, hud, { targets, onBelt, inHub, cableActive, onEnd }) {
  const style = HAIR_STYLES[TUTORIAL.style]
  const css = document.createElement('style')
  css.textContent = CSS
  document.head.appendChild(css)

  // --- HUD pointer: a bobbing arrow over the button to press, which glows
  const arrow = document.createElement('div')
  arrow.className = 'tut-arrow'
  arrow.hidden = true
  arrow.innerHTML = ARROW_SVG
  document.body.appendChild(arrow)
  let hl = null
  let arrowX = -1
  let arrowY = -1
  function clearUi() {
    hl?.classList.remove('tut-hl')
    hl = null
    arrow.hidden = true
  }
  function pointAt(selector) {
    const el = selector && document.querySelector(selector)
    const r = el?.getBoundingClientRect()
    if (!r || r.width === 0 || r.height === 0) return clearUi() // not on screen
    if (hl !== el) {
      hl?.classList.remove('tut-hl')
      el.classList.add('tut-hl')
      hl = el
    }
    arrow.hidden = false
    const x = Math.round(r.left + r.width / 2)
    const y = Math.round(r.top - 6)
    if (x === arrowX && y === arrowY) return
    arrowX = x
    arrowY = y
    arrow.style.left = `${x}px`
    arrow.style.top = `${y}px`
  }
  // Which button each step points at, if any.
  function uiTarget(step) {
    const body = document.body.classList
    if (body.contains('salon-open')) return null
    if (step === 4) return document.querySelector('#hud .tp-win.open') ? '#hud .tp-win.open .tp-row[data-stage="0"] .tp-go' : body.contains('win-open') ? null : '#hud .hud-tile.teleport'
    if (body.contains('win-open')) return null
    if (step === 6 && isTouch()) return '#touch .act.cable'
    return null
  }

  // --- World guide: a trail of arrowheads crawling toward the target, a big arrow over it.
  // Drawn over everything (no depth test) so walls never hide the way. One draw call each.
  const shape = new Shape()
  shape.moveTo(0, 0.42)
  shape.lineTo(0.34, -0.2)
  shape.lineTo(0, -0.05)
  shape.lineTo(-0.34, -0.2)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 })
  geometry.center()
  const trailMat = new MeshStandardMaterial({ color: '#eef1f6', roughness: 0.5, depthTest: false, transparent: true })
  const beaconMat = new MeshStandardMaterial({ color: '#ffd23a', emissive: '#ff9a1f', emissiveIntensity: 0.6, roughness: 0.4, fog: false, depthTest: false, transparent: true })
  const guide = new Group()
  const trail = new InstancedMesh(geometry, trailMat, TUTORIAL.maxArrows)
  trail.frustumCulled = false
  trail.renderOrder = 20
  trail.count = 0
  const beacon = new Mesh(geometry, beaconMat)
  beacon.scale.setScalar(BEACON_SCALE)
  beacon.frustumCulled = false
  beacon.renderOrder = 21
  beacon.visible = false
  guide.add(trail, beacon)
  scene.add(guide)
  const dummy = new Object3D()

  const target = (step) => (step === 0 ? targets.treadmill : step === 2 ? targets.portal : step === 3 ? targets.winPad : step === 5 ? targets.shop : null)
  function drawGuide(step, t) {
    trail.count = 0
    beacon.visible = false
    const to = target(step)
    if (!to) return
    const p = player.position
    const dx = to.x - p.x
    const dz = to.z - p.z
    const dist = Math.hypot(dx, dz)
    const ux = dx / (dist || 1)
    const uz = dz / (dist || 1)
    const heading = Math.atan2(ux, uz)
    const phase = (t * TUTORIAL.speed) % TUTORIAL.spacing
    let n = 0
    if (dist > TUTORIAL.hideWithin) {
      for (let d = 1.4 + phase; d < dist - 0.6 && n < TUTORIAL.maxArrows; d += TUTORIAL.spacing) {
        // No floor query: the trail runs straight from the feet to the target, so it also spans the lava gaps.
        dummy.position.set(p.x + ux * d, p.y + (to.y - p.y) * (d / dist) + TUTORIAL.lift, p.z + uz * d)
        dummy.rotation.set(Math.PI / 2 - TRAIL_TILT, heading, 0, 'YXZ') // lie flat, tip toward the target
        dummy.updateMatrix()
        trail.setMatrixAt(n++, dummy.matrix)
      }
    }
    trail.count = n
    trail.instanceMatrix.needsUpdate = true
    beacon.visible = !to.marked
    beacon.position.set(to.x, to.y + TUTORIAL.beaconHeight + Math.sin(t * BEACON_BOB.rate) * BEACON_BOB.amp, to.z)
    beacon.rotation.set(0, t * BEACON_SPIN, Math.PI, 'YXZ') // point down, spin about the vertical
  }

  // --- The pill: [text with a *highlight*, hint]
  function lines(step) {
    const touch = isTouch()
    const goal = TUTORIAL.level
    switch (step) {
      case 0: return ['Walk onto the *FREE treadmill*!', 'Follow the arrows']
      case 1: return [`Run to *Level ${goal}* on the treadmill (${Math.min(state.level, goal)}/${goal})`, 'Stay on the belt: every step grows your hair']
      case 2: return ['Walk through the *START* portal!', 'Follow the arrows']
      case 3: return ['Cross the *Lava Run* to the Win pad!', `${touch ? 'Tap Jump' : 'Press Shift'} to hop the slabs. Don't touch the lava!`]
      case 4: return ['Head back to the *Hub*!', `${touch ? 'Tap' : 'Click'} Teleport, then Hub`]
      case 5: return [`Buy *${style.name}* for ${style.price} Win!`, `Walk up to it and ${touch ? 'tap the prompt' : 'press E'}`]
      case 6: return ['Shoot your *hair cable*!', touch ? 'Tap the hair cable button' : 'Press Space and steer the tip with the mouse']
      default: return ['*Tutorial Complete!*', 'Now escape for big Wins!']
    }
  }
  let shownKey = -1
  function paintPill(step) {
    const key = step === 1 ? 100 + Math.min(state.level, TUTORIAL.level) : step + (isTouch() ? 0.5 : 0) // repaint on new counters / input
    if (key === shownKey) return
    shownKey = key
    const [text, hint] = lines(step)
    hud.setQuest(step, TUTORIAL.done, text, { tutorial: true, hint })
  }

  const snap = { onBelt: false, level: 1, levelGoal: TUTORIAL.level, inHub: true, wins: 0, hasStyle: false, shot: false, done: TUTORIAL.done }
  let completeUntil = 0 // ms (performance.now) the "Tutorial Complete!" pill shows until
  let showing = false // the pill is the tutorial's

  function end() {
    showing = false
    shownKey = -1
    completeUntil = 0
    drawGuide(-1, 0)
    clearUi()
    onEnd()
  }

  return {
    // Whether the tutorial owns the quest pill (main.js shows the quests otherwise).
    active() {
      return !DISABLE_TUTORIAL && isTutorialReady() && (state.tutorial < TUTORIAL.done || performance.now() < completeUntil)
    },
    // The pill's Skip button while the tutorial runs: finished for good, saved at once.
    skip() {
      setTutorialStep(TUTORIAL.done)
      saveNow()
      end()
    },
    update(t) {
      if (DISABLE_TUTORIAL || !isTutorialReady()) return
      let step = state.tutorial
      if (step < TUTORIAL.done) {
        snap.onBelt = onBelt()
        snap.level = state.level
        snap.inHub = inHub()
        snap.wins = state.wins
        snap.hasStyle = state.owned.includes(TUTORIAL.style) || state.equipped !== 'golden'
        if (step === 6 && cableActive()) snap.shot = true
        const next = nextStep(step, snap)
        if (next !== step) {
          snap.shot = false
          if (next >= TUTORIAL.done) {
            completeUntil = performance.now() + TUTORIAL.completeMs
            playSfx('levelUp')
          }
          setTutorialStep(next)
          step = next
        }
      }
      if (step < TUTORIAL.done || performance.now() < completeUntil) {
        showing = true
        paintPill(step)
        drawGuide(step, t)
        pointAt(uiTarget(step))
      } else if (showing) end() // done, or the account's save says it was finished elsewhere
    },
  }
}
