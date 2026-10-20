// New-player tutorial: walks a first-time player through the first loop (treadmill → level 3 →
// START portal → swing on the hair over the lava → the Lava Run's Win pad → back home → buy
// Blueberry Hair).
// It speaks through the quest pill (hud.setQuest in its tutorial look, whose Skip button skips the
// whole tutorial), lays a crawling trail of arrowheads from the player to the step's target with a
// spinning beacon over it, and points a bobbing arrow at the HUD / touch button to press. The hair
// moves fast, so the lava lesson freezes the game at its three key moments (at the slab's edge: throw;
// the tip above the next slab: stop it; the ride starts: hold on) and shows a card that waits for the
// very input it teaches. The step lives in state.tutorial and is saved with the account;
// tutorialLogic.js decides when it moves. Ported from Kick-per-click's tutorial.
import { ExtrudeGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Shape } from 'three'
import { DISABLE_TUTORIAL, TUTORIAL } from './config.js'
import { inputState } from './input.js'
import { player } from './player.js'
import { HAIR_STYLES, isTutorialReady, setTutorialStep, state } from './game/state.js'
import { saveNow } from './net.js'
import { playSfx } from './sfx.js'
import { celebrate } from './party.js'
import { nextStep } from './tutorialLogic.js'

const CSS = `
.tut-arrow { position: fixed; left: 0; top: 0; z-index: 60; width: 54px; height: 72px; pointer-events: none; transform: translate(-50%, -100%); filter: drop-shadow(0 4px 0 rgba(0,0,0,0.35)); }
.tut-arrow[hidden] { display: none; }
.tut-arrow svg { display: block; width: 100%; height: 100%; animation: tut-bob 0.7s ease-in-out infinite; }
@keyframes tut-bob { 50% { transform: translateY(12px); } }
.tut-hl { animation: tut-glow 0.9s ease-in-out infinite !important; }
@keyframes tut-glow { 50% { box-shadow: 0 0 0 6px rgba(255,210,58,0.95), 0 0 24px 8px rgba(255,210,58,0.7); } }

/* Freeze-frame card of the lava lesson: over the world, under the touch controls (4) and the HUD (5). */
/* Low and compact: the camera keeps the flying tip near the middle of the screen, and the card must not hide it. */
.tut-pause { position: fixed; inset: 0; z-index: 3; display: flex; align-items: flex-end; justify-content: center; padding: 0 16px calc(env(safe-area-inset-bottom) + max(96px, 13vh));
  background: radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(5,8,20,0.55) 100%); pointer-events: none;
  font-family: 'Fredoka', 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif; font-weight: 700; color: #fff; }
.tut-pause[hidden] { display: none; }
.tut-pause.tap { pointer-events: auto; cursor: pointer; }
.touch-ui .tut-pause { align-items: flex-start; padding: calc(env(safe-area-inset-top) + max(120px, 22vh)) 16px 0; }
.tut-card { width: min(680px, 100%); padding: clamp(8px, 1.8vmin, 14px) clamp(14px, 3vmin, 26px); border-radius: 22px; text-align: center;
  background: linear-gradient(rgba(52,53,90,0.94), rgba(31,32,64,0.94)); border: 4px solid #ffb800; box-shadow: 0 0 0 3px #0d0e1c, 0 10px 30px rgba(0,0,0,0.45); animation: tut-card-in 0.28s ease-out; }
.tut-pause.warn .tut-card { border-color: #ff3b3b; }
.tut-paused { display: inline-block; padding: 2px 12px; border-radius: 12px; background: #ffb800; color: #3a2400; font-size: clamp(11px, 2.4vmin, 15px); letter-spacing: 2px; }
.tut-pause.warn .tut-paused { background: #ff3b3b; color: #fff; }
.tut-title { margin-top: 4px; font-size: clamp(22px, 5vmin, 36px); line-height: 1.1; -webkit-text-stroke: 5px #0d0e1c; paint-order: stroke fill; }
.tut-title .hl { color: #ffd21a; }
.tut-pause.warn .tut-title .hl { color: #ff8a7a; }
.tut-body { margin-top: 4px; font-size: clamp(14px, 2.6vmin, 18px); font-weight: 600; color: #dfe8ff; line-height: 1.3; }
.tut-act { margin-top: 8px; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 10px; font-size: clamp(15px, 3.2vmin, 22px); }
.tut-key { display: inline-block; min-width: 2.6em; padding: 4px 14px; border-radius: 10px; background: linear-gradient(#fff, #d9dde6); color: #1b1b28; border: 3px solid #1b1b28; box-shadow: 0 4px 0 #1b1b28; animation: tut-press 0.9s ease-in-out infinite; }
.tut-btn { font: inherit; min-height: 48px; min-width: 160px; padding: 8px 24px; border-radius: 16px; border: 4px solid #154a00; background: linear-gradient(#b6ff7a, #33d11c); color: #fff;
  font-size: clamp(18px, 4vmin, 26px); -webkit-text-stroke: 4px #154a00; paint-order: stroke fill; animation: tut-press 0.9s ease-in-out infinite; }
@keyframes tut-press { 50% { transform: translateY(3px); box-shadow: 0 1px 0 #1b1b28; } }
@keyframes tut-card-in { 0% { transform: scale(0.7); opacity: 0; } 70% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
@media (max-height: 480px) { .tut-pause { padding-bottom: calc(env(safe-area-inset-bottom) + 70px); } .touch-ui .tut-pause { padding-top: calc(env(safe-area-inset-top) + 96px); } .tut-body { display: none; } }
`
const ARROW_SVG = '<svg viewBox="0 0 60 80"><path d="M18 4h24v34h14L30 76 4 38h14z" fill="#ffd23a" stroke="#121212" stroke-width="6" stroke-linejoin="round"/></svg>'
const TRAIL_TILT = 0.35 // rad the trail arrows lift their tips off flat
const BEACON_SCALE = 3.2
const BEACON_BOB = { amp: 0.35, rate: 4 } // m, rad/s
const BEACON_SPIN = 2 // rad/s

const isTouch = () => document.documentElement.classList.contains('touch-ui')

// What the hair is doing during the lava lesson (hairPhase): the pill's advice follows it.
const AIM = 0 // not out: time to throw
const FLY_LAVA = 1 // the tip flies over the lava: keep steering, don't stop it
const FLY_SAFE = 2 // the tip is above the next slab: stop it now (click) / bring it down onto the slab
const RIDE_LAVA = 3 // riding over the lava: hold on
const RIDE_SAFE = 4 // riding above a slab: safe to let go
const FLY_NEAR = 5 // the tip is still above the slab it was thrown from: steer it on over the lava

// Freeze-frame cards of the lava lesson, each shown once per try, in ORDER.
const NO_PAUSE = 0
const THROW = 1 // at the slab's edge: waits for the throw (Space / hair button)
const GRAB = 2 // the tip is above the next slab: waits for the stop (click / GRAB button)
const RIDE = 3 // the ride starts: waits for a click / tap (Space would let go)
const STEER = 4 // the tip has just left: waits for a steer (mouse / WASD / touch drag), which then turns it
const ORDER = [THROW, STEER, GRAB, RIDE]

// targets: { treadmill, portal, winPad, shop } world spots at floor height ({ x, y, z }, `marked`: the
// world already has its own arrow there, so no beacon).
// onBelt() / inHub() read main.js's frame state, getCable() returns the hair cable (state, tip; made
// after the tutorial), safeAt(x, y, z) says whether a slab (not the lava) is underneath; onEnd() hands
// the pill back to the quests.
export function createTutorial(scene, hud, { targets, onBelt, inHub, getCable, safeAt, onEnd }) {
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
  // Which button each step points at, if any: on phones the hair button when it is time to throw
  // or to let go (never while riding over the lava).
  function uiTarget(step, phase) {
    const body = document.body.classList
    if (body.contains('salon-open')) return null
    if (step === 5) return document.querySelector('#hud .tp-win.open') ? '#hud .tp-win.open .tp-row[data-stage="0"] .tp-go' : body.contains('win-open') ? null : '#hud .hud-tile.teleport'
    if (body.contains('win-open')) return null
    if (isTouch() && ((step === 3 && pause === THROW) || ((step === 3 || step === 4) && phase === RIDE_SAFE))) return '#touch .act.cable'
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

  const target = (step) => (step === 0 ? targets.treadmill : step === 2 ? targets.portal : step === 3 || step === 4 ? targets.winPad : step === 6 ? targets.shop : null)
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

  // --- Hair coaching over the lava (steps 3-4): what the hair is doing right now decides the advice,
  // so the player stops the tip / lets go only above a slab, never over the lava.
  let tipCrossed = false // this throw's tip has flown over the lava (so a slab under it now is the next one)
  function hairPhase() {
    const cable = getCable()
    if (cable.state === 'flying') {
      const tip = cable.tip
      const safe = safeAt(tip.x, tip.y, tip.z)
      if (!safe) tipCrossed = true
      return safe ? (tipCrossed ? FLY_SAFE : FLY_NEAR) : FLY_LAVA
    }
    tipCrossed = false
    if (cable.state === 'riding') {
      const p = player.position
      return safeAt(p.x, p.y, p.z) ? RIDE_SAFE : RIDE_LAVA
    }
    return AIM
  }
  // [text, desktop hint, touch hint] per phase
  const COACH = {
    [FLY_NEAR]: ['Steer your hair *over the lava*!', 'Move the mouse or press W A S D to aim at the next slab', 'Drag on the screen to aim at the next slab'],
    [FLY_LAVA]: ['Steer your hair to the *next slab*!', 'Steer with the mouse or W A S D. Not yet: the tip is over the lava', 'Drag down to aim the tip at the slab. Not over the lava!'],
    [FLY_SAFE]: [null, 'The tip is above a slab, so you land safely', 'Your hair grabs the slab as soon as it touches it'],
    [RIDE_LAVA]: ["*Hold on!* You're over the lava", "Don't press Space yet or you'll fall in", "Don't tap the hair button yet or you'll fall in"],
    [RIDE_SAFE]: ['Above a slab: *safe to let go*', 'Press Space to drop off, or ride to the end', 'Tap the hair button to drop off, or ride to the end'],
  }

  // --- The pill: [text with a *highlight*, hint]
  function lines(step, phase) {
    const touch = isTouch()
    const goal = TUTORIAL.level
    if ((step === 3 || step === 4) && phase !== AIM) {
      const [text, desk, tap] = COACH[phase]
      if (phase === FLY_SAFE) return [touch ? 'Now drag *down* onto the slab!' : '*Click now* to stop your hair!', touch ? tap : desk]
      return [text, touch ? tap : desk]
    }
    switch (step) {
      case 0: return ['Walk onto the *FREE treadmill*!', 'Follow the arrows']
      case 1: return [`Run to *Level ${goal}* on the treadmill (${Math.min(state.level, goal)}/${goal})`, 'Stay on the belt: every step grows your hair']
      case 2: return ['Walk through the *START* portal!', fell ? 'Oops, lava! Try again: only let go above a slab' : 'Follow the arrows']
      case 3: return ['Walk to the *edge* of the slab!', 'Your hair will swing you over the lava to the next one']
      case 4: return ['Reach the *Win pad* at the end!', `Swing on your hair or ${touch ? 'tap Jump' : 'press Shift'} to hop the slabs. Don't touch the lava!`]
      case 5: return ['Head back to the *Hub*!', `${touch ? 'Tap' : 'Click'} Teleport, then Hub`]
      case 6: return [`Buy *${style.name}* for ${style.price} Win!`, `Walk up to it and ${touch ? 'tap the prompt' : 'press E'}`]
      default: return ['*Tutorial Complete!*', 'Now escape for big Wins!']
    }
  }
  let shownKey = -1
  function paintPill(step, phase) {
    // Repaint on a new step, counter, hair phase, input kind or a lava fall; numeric so no per-frame strings.
    const key = step === 1 ? 1000 + Math.min(state.level, TUTORIAL.level) : step * 100 + phase * 10 + (isTouch() ? 1 : 0) + (fell ? 2 : 0)
    if (key === shownKey) return
    shownKey = key
    const [text, hint] = lines(step, phase)
    hud.setQuest(step, TUTORIAL.done, text, { tutorial: true, hint, warn: phase === FLY_LAVA || phase === RIDE_LAVA })
  }

  // --- Freeze-frame card (lava lesson)
  const overlay = document.createElement('div')
  overlay.className = 'tut-pause'
  overlay.hidden = true
  overlay.innerHTML = '<div class="tut-card"><div class="tut-paused">⏸ PAUSED</div><div class="tut-title"></div><div class="tut-body"></div><div class="tut-act"></div></div>'
  document.body.appendChild(overlay)
  const cardTitle = overlay.querySelector('.tut-title')
  const cardBody = overlay.querySelector('.tut-body')
  const cardAct = overlay.querySelector('.tut-act')
  // A tap on the card (touch: input.js ignores touches) counts like the click it asks for.
  overlay.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && (pause === GRAB || pause === RIDE)) inputState.stopTip = true
  })
  const markup = (s) => s.replace(/\*(.+?)\*/g, '<span class="hl">$1</span>')
  // [title, body, desktop action, touch action] per card
  const CARDS = {
    [THROW]: ['Throw your *hair*!', 'Your hair is your rope. Throw it over the lava, then swing to the next slab.',
      '<span class="tut-key">SPACE</span> to throw your hair', 'Tap the <b>hair button</b> to throw it'],
    [STEER]: ['Steer your *hair*!', 'While it flies, you aim the tip. Guide it over the lava toward the next slab.',
      'Move the <span class="tut-key">MOUSE</span> or press <span class="tut-key">W A S D</span> to steer', 'Drag on the screen to steer ↔'],
    [GRAB]: ['Stop your hair *now*!', 'The tip is above the next slab. Stop it here and you will swing safely onto it.',
      '<span class="tut-key">CLICK</span> to stop it here', '<button class="tut-btn">GRAB HERE!</button>'],
    [RIDE]: ["*Hold on!* Don't let go", "You swing to where your hair stopped. Let go over the lava and you fall in! Above a slab it's safe, or just ride to the end.",
      '<span class="tut-key">CLICK</span> to swing', '<button class="tut-btn">SWING!</button>'],
  }
  let pause = NO_PAUSE
  let steered = 0 // look input (px) gathered while the STEER card is up
  const seen = { [THROW]: false, [STEER]: false, [GRAB]: false, [RIDE]: false } // cards shown on this try
  const cardChip = overlay.querySelector('.tut-paused')
  function showPause(kind) {
    pause = kind
    steered = 0
    const [title, body, desk, tap] = CARDS[kind]
    cardChip.textContent = `⏸ PAUSED · ${ORDER.indexOf(kind) + 1}/${ORDER.length}`
    cardTitle.innerHTML = markup(title)
    cardBody.textContent = body
    cardAct.innerHTML = isTouch() ? tap : desk
    overlay.classList.toggle('warn', kind === RIDE)
    overlay.classList.toggle('tap', kind === GRAB || kind === RIDE) // THROW waits for the real hair button, STEER for a drag on the world underneath
    overlay.hidden = false
    seen[kind] = true
    playSfx('click')
  }
  function resume() {
    pause = NO_PAUSE
    overlay.hidden = true
  }
  // Step 3, every frame: freeze at the next key moment of this try.
  function checkPause(phase) {
    const p = player.position
    const cableState = getCable().state
    if (!seen[THROW] && phase === AIM && cableState === 'idle' && player.grounded && !inHub() && safeAt(p.x, p.y, p.z) && lavaAhead()) showPause(THROW)
    else if (!seen[STEER] && cableState === 'flying' && getCable().outLength >= TUTORIAL.steerAfter) showPause(STEER)
    else if (!seen[GRAB] && phase === FLY_SAFE) showPause(GRAB)
    else if (!seen[RIDE] && cableState === 'riding') showPause(RIDE)
  }
  // Facing north (the run's way) at a slab's edge: lava a step ahead.
  function lavaAhead() {
    const fx = Math.sin(player.facing)
    const fz = Math.cos(player.facing)
    if (fz > -0.5) return false
    const p = player.position
    return !safeAt(p.x + fx * TUTORIAL.edgeLook, p.y, p.z + fz * TUTORIAL.edgeLook)
  }

  const snap = { onBelt: false, level: 1, levelGoal: TUTORIAL.level, inHub: true, wins: 0, hasStyle: false, crossed: false, done: TUTORIAL.done }
  let rode = false // the player rode the hair during step 3
  let fell = false // fell in the lava during the hair lesson (step 2 says so until the next try)
  let completeUntil = 0 // ms (performance.now) the "Tutorial Complete!" pill shows until
  let showing = false // the pill is the tutorial's

  function end() {
    showing = false
    shownKey = -1
    completeUntil = 0
    resume()
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
    // main.js: the player fell in the lava (and is back at the Hub spawn).
    noteFell() {
      if (state.tutorial === 3 || state.tutorial === 4) fell = true
    },
    // While a lava-lesson card is up main.js freezes the world: only render, and call pausedFrame.
    paused: () => pause !== NO_PAUSE,
    // A frozen frame: drop every input but the one the card waits for, and resume when it comes.
    // That input stays set, so the next live frame performs it (throws / stops the tip).
    pausedFrame() {
      const i = inputState
      i.zoom = 0
      i.jump = i.interact = false
      if (pause === STEER) {
        // A real steer (mouse / drag past a nudge, or a WASD key) resumes and is kept, so the tip turns at once.
        i.grapple = i.stopTip = false // Space would let go, a click would pin the tip before it is steered
        steered += Math.abs(i.look.dx) + Math.abs(i.look.dy)
        if (steered >= TUTORIAL.steerNudge || i.move.x || i.move.z) return resume()
        i.look.dx = i.look.dy = 0
        return
      }
      i.look.dx = i.look.dy = 0
      if (pause === THROW) {
        i.stopTip = false
        if (i.grapple) resume()
      } else {
        i.grapple = false // Space would let go
        if (i.stopTip) {
          if (pause === RIDE) i.stopTip = false
          resume()
        }
      }
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
        // The hair lesson ends once the player has ridden the hair and is standing safely on a slab again.
        const cableState = getCable().state
        if (step === 3 && cableState === 'riding') rode = true
        const p = player.position
        snap.crossed = rode && cableState === 'idle' && player.grounded && safeAt(p.x, p.y, p.z)
        const next = nextStep(step, snap)
        if (next !== step) {
          rode = false
          if (next === 3) seen[THROW] = seen[STEER] = seen[GRAB] = seen[RIDE] = false // a new try: the cards again
          if (next === 4) fell = false
          if (next >= TUTORIAL.done) {
            completeUntil = performance.now() + TUTORIAL.completeMs
            celebrate()
          }
          setTutorialStep(next)
          step = next
        }
      }
      if (step < TUTORIAL.done || performance.now() < completeUntil) {
        showing = true
        const phase = step === 3 || step === 4 ? hairPhase() : AIM
        if (step === 3 && !document.body.classList.contains('win-open')) checkPause(phase)
        paintPill(step, phase)
        drawGuide(step, t)
        pointAt(uiTarget(step, phase))
      } else if (showing) end() // done, or the account's save says it was finished elsewhere
    },
  }
}
