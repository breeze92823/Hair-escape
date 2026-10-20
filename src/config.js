// All tunables. Ported from Clean Leaves for Loot, trimmed to the basics.
export const GAME_SLUG = 'hair-escape' // slug registered on bloxity.io
export const GAME_TITLE = 'Hair Escape'
// VITE_DEV_MODE=true skips the Bloxity SDK / avatar CDN.
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- World ------------------------------------------------------------------
export const GROUND_Y = 0
export const GROUND_SIZE = 640 // square ground centred on the origin
export const WORLD_BOUNDS = { minX: -195, maxX: 195, minZ: -1500, maxZ: 195 } // north reaches past the back wall of Zone 14's Star Palace (z ~-1484)
export const SPAWN = { x: 0, y: 0.3, z: 2 } // lobby, on the red carpet facing the START portal
export const SPAWN_FACING = Math.PI // yaw the character faces on spawn (PI = toward -Z)

// --- Physics feel (player.js) -----------------------------------------------
export const PHYSICS = {
  moveSpeed: 10, // m/s on flat ground
  accel: 75, // m/s^2 toward the target velocity
  decel: 69, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  gravity: -22, // m/s^2
  jumpSpeed: 7.5, // m/s
  stepUp: 0.6, // m: box tops this far above the feet are walked onto, not collided with
  climbSpeed: 6, // m/s up a climbing panel while a move key is held
  climbSlide: 1.5, // m/s max slide down a climbing panel with no key held
  bounceSpeed: 19, // m/s up off a cloud spring (Zone 10): ~8 m high, 10-11 m gaps at a run
  spaceGravity: 0.45, // gravity scale in the Star Summit (Zone 14): floaty jumps that cross 8 m gaps
  killY: -30, // fell this far below the ground: respawn
}
export const PLAYER_DIMS = { radius: 0.4, height: 1.8 }

// --- Look ------------------------------------------------------------------
export const COLORS = {
  horizon: '#f6e4ef',
  zenith: '#7fc4ff',
  grass: '#4cc23e',
  grassDark: '#3aa830',
}
export const FOG = { near: 90, far: 260 }
export const LIGHT = {
  sunColor: '#fff2d6',
  sunIntensity: 2.4,
  sunPosition: [30, 60, 20],
  shadowMapSize: 2048,
  shadowRange: 40, // half-width of the shadow frustum around the player
  hemiSky: '#e4f1ff',
  hemiGround: '#b9a98a',
  hemiIntensity: 1.5,
}
export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
  STONE: { roughness: 0.85, metalness: 0 },
  WOOD: { roughness: 0.75, metalness: 0 },
}

// Default (signed-out / fallback) character look.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f9e8f', hair: '#c8782a' }

// Hair (avatar/hair.js). Lengths are the game's "hair length" stat; the back
// section hangs `hangPerLength` rig units per point of length, so the start
// length of 3 reaches just below the neck and the max stops short of the floor.
export const HAIR = {
  startLength: 3,
  minLength: 1,
  maxLength: 13,
  visualScale: 0.5, // share of the grown length (hang and floor trail) drawn on the avatar; the cable still reaches with all of it
  hangPerLength: 0.4, // rig units of hang per length point
  maxSegment: 0.6, // rig units; longer hair adds segments instead of stretching them
  chainRootY: 1.0, // where the hanging section starts, in head-local y (head spans 0..1.6)
  growEase: 6, // 1/s the visible hair eases toward the target length
  sprintSpeed: 13, // m/s that streams the hair fully backwards
}

// Hair cable (hairCable.js): Space shoots the hair tip out of the head; while it
// flies the look input (pointer-lock mouse, right-drag, touch drag) and WASD/arrows
// steer it, the camera turning with the steering so the view always looks where the
// tip is heading, until it sticks to a surface or the hair runs out. The player then
// hangs beneath it and travels the path it took to the anchor.
// Reach grows with the hair: base + per length point + every metre of floor trail.
export const GRAPPLE = {
  baseReach: 8, // m
  reachPerLength: 2, // m per hair length point
  ropePoints: 400, // path points the drawn strand can hold; a longer cable is drawn with every few stored points
  hairReachScale: 0.325, // m per sqrt(hair) once that beats the length+trail reach (3.4M hair = 600 m)
  maxReach: 2000, // m (the sqrt curve gets there at about 38M hair)
  segment: 0.5, // m between stored path points
  tipSpeed: 12, // m/s the steered tip flies at
  launchPitch: 0.3, // rad above the horizon the tip leaves at
  steerSensitivity: 0.003, // rad of aim per pixel of drag (times the portal's camera sensitivity)
  keyTurnRate: 1.8, // rad/s A/D (or the arrows) turn the aim
  keyPitchRate: 1.2, // rad/s W/S tilt the aim up/down
  steerEase: 6, // 1/s the tip's heading glides onto the aim (lower = softer turns)
  maxTipPitch: 1.3, // rad up or down the tip can be aimed
  anchorOffset: 0.05, // m the anchored tip sits off the surface it hit
  flySway: 0.12, // m sideways the flying strand ripples, mid-length
  flySwayFreq: 9, // rad/s of that ripple
  camFollowLerp: 6, // 1/s the camera's focus eases onto the flying tip
  camReturnLerp: 4, // 1/s it eases back to the player once the tip anchors or runs out
  camTurnLerp: 12, // 1/s the orbit swings onto the aim: fast, so the view turns with the steering and leads the tip
  camDistance: 3, // m boom length while watching the flying tip
  camLead: 1.5, // m ahead of the tip the camera looks, so the path ahead is in view
  camPitch: 0.4, // rad the boom is lifted when aiming level, so it looks down on the strand, not along it
  camPitchFollow: 0.6, // rad of boom tilt per rad of aim pitch: aiming up drops the boom, aiming down lifts it
  camMinPitch: -0.5, // rad the boom may drop to while following an upward aim (below CAMERA.minPitch)
  retractSpeed: 80, // m/s it reels back in
  zipStartSpeed: 8, // m/s at the grab
  zipSpeed: 14, // m/s top speed along the cable
  zipAccel: 20, // m/s^2
  hangDrop: 2.2, // m the feet hang below the gripping hands
  vaultUp: 6, // m/s up at the far end (climbs a ledge the hair draped onto)
  vaultForward: 4, // m/s onward at the far end
  stuckTime: 0.5, // s blocked by a wall before the ride gives up
}

// Speed rush while zipping along the hair cable (speedFx.js): radial streaks, a
// tinted vignette, a wider FOV, a faint shake and a glow on the player.
export const SPEED_FX = {
  fadeIn: 5, // 1/s the effect ramps up as the ride starts
  fadeOut: 3, // 1/s it clears after letting go
  baseIntensity: 0.35, // 0..1 at the grab; the rest comes with the ride speed
  streaks: 70, // streak count on desktop
  touchStreaks: 36, // on touch-first devices (phones run hot)
  resolution: 0.5, // overlay canvas pixels per CSS px (thin lines survive low res)
  clearRadius: 0.28, // fraction of the half-diagonal kept free of streaks round the centre
  streakSpeed: 2.2, // half-diagonals per second a streak travels outward at full rush
  streakLength: [0.12, 0.35], // half-diagonals, min..max
  streakWidth: [1, 3], // overlay px, min..max
  maxOpacity: 0.75, // streak alpha at full rush
  vignette: 0.55, // edge tint opacity at full rush
  fovBoost: 8, // degrees added at full rush (on top of CAMERA.speedFov)
  shake: 0.035, // m camera jitter at full rush
  glowOpacity: 0.55, // player glow sprite alpha at full rush
  glowSize: 3.2, // m across
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 600,
  startPitch: 0.05, // radians above the horizon (low, Roblox-style framing)
  minPitch: -0.1,
  maxPitch: 1.2,
  distance: 9, // resting boom length, m
  minDistance: 3,
  maxDistance: 15,
  followLerp: 10, // 1/s: the ONE smoothing stage, on the point the camera follows
  targetHeight: 0.6, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of mouse movement
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedDistance: 0.8, // m the boom pulls back at full speed
  speedFov: 4, // degrees the FOV widens at full speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 4, // 1/s the boom eases back out after a wall pulled it in
}

// Hair Salon (salon/): the dressing room the HUD's Hair button opens. Its own scene
// round the origin: the player stands on a round pedestal facing +Z (toward the
// front-view camera), the hair coils round it on the floor. Metres / radians.
export const SALON = {
  half: 14, // m, half the room's width and depth
  height: 10, // m, wall height
  pedestal: [[3.2, 0.45], [3.75, 0.3], [4.3, 0.15]], // [radius, top height] tiers, top first; the player stands on the first
  facing: 0, // body yaw (0 = +Z, toward the camera)
  coil: { straight: 3.5, radius: 4.2, growth: 0.07 }, // floor hair: m straight back off the pedestal, then a spiral of this radius (m) widening by `growth` m per m
  shadowMapSize: 1024,
  shadowRange: 9, // m half-width of the salon's shadow box
  camera: {
    ease: 5, // 1/s the camera glides between views
    orbitStep: Math.PI / 4, // rad per < / > press
    zoomStep: 1.25, // distance factor per - / + press
    minDistance: 2.5,
    maxDistance: 15,
    dragYaw: 0.006, // rad per px of drag
    dragPitch: 0.004,
    wheelZoom: 0.12, // distance factor per wheel notch
    minPitch: -0.05,
    maxPitch: 1.3,
    wallMargin: 0.8, // m the camera keeps inside the walls
    fov: 50, // degrees: a portrait lens, flatter than the world camera
  },
  // Per tab: orbit yaw (0 = in front of the player), pitch (rad above the horizon), boom (m) and the look-at point.
  views: {
    styles: { yaw: -0.35, pitch: 0.12, distance: 6.5, target: [0, 1.3, 0] },
    colors: { yaw: Math.PI + 0.6, pitch: 0.32, distance: 7.5, target: [0, 0.9, -1.8] },
    charms: { yaw: Math.PI * 0.78, pitch: 0.6, distance: 6.5, target: [0.8, 0.4, -3.2] },
    auras: { yaw: -0.15, pitch: 0.16, distance: 7, target: [0, 1.1, -0.6] },
    trails: { yaw: 0.35, pitch: 0.2, distance: 7.5, target: [0, 1, 0] },
    length: { yaw: Math.PI * 0.85, pitch: 0.55, distance: 9.5, target: [1.5, 0.4, -3.5] },
  },
  // The door transition in and out of the salon (salon/doors.js). Seconds.
  doors: {
    close: 0.42, // the doors slide shut
    hold: 0.38, // shut, with the HAIR SALON badge up, while the scene swaps behind them
    open: 0.55, // the doors slide apart
    reduced: 0.4, // time factor under prefers-reduced-motion
  },
}

// Touch controls (touch.js). Screen sizes are CSS px.
export const TOUCH = {
  stickRadius: 52, // px the knob travels from the stick's centre at full speed
  stickZone: 0.45, // left fraction of the screen where a touch starts the move stick
  deadZone: 0.12, // fraction of stickRadius that still reads as standing still
  lookScale: 1.3, // camera pixels per finger pixel (CAMERA.lookSensitivity is tuned for a mouse)
  pinchZoom: 1 / 40, // wheel notches per px the two fingers move apart
  maxPixelRatio: 1.5, // render resolution cap on touch-first devices: phones at 3x run hot and slow
}

// SDK setting keys this game listens for (they appear in the portal's settings menu).
export const SETTINGS = {
  graphics_quality: { def: 'High', type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  fullscreen: { def: 'false', type: 'bool' },
  sfx_volume: { def: '1', type: 'number', min: 0, max: 1 }, // master volume for every sound effect
}

// Hair cable foley (cableSfx.js): synthesised live from shaped noise, so there are no files and no tones.
// Levels are 0..1-ish mix gains, all scaled by the sfx_volume setting.
export const CABLE_SFX = {
  volume: 0.65, // master for every cable sound
  flight: 1.4, // the strand streaming through the air while the tip flies
  flightFreq: 750, // Hz centre of that whoosh (it brightens a little as the tip turns)
  flutterRate: 22, // 1/s the strands flap at in the airflow
  rustleRate: 420, // fibre ticks per second in the hair rustle
  wind: 1.3, // the wind past the ears at full ride speed
  friction: 0.55, // the hands sliding along the hair while riding
  attack: 0.07, // s time constant the loops swell in with
  release: 0.22, // s time constant they die away with
  reverbTime: 0.55, // s of the short open-air tail the one-shots ring into
  reverbLevel: 0.35, // gain of that tail
  toneCut: 2500, // Hz above which the whole cable mix is shelved down: soft, not hissy
  toneCutGain: -7, // dB of that shelf
  toneLowpass: 6000, // Hz, nothing harsh gets past this
  sleepAfter: 3, // s of silence before the audio context is suspended (battery)
}

// Sound effects (public/audio/): file and base volume (0..1, scaled by the sfx_volume setting).
export const SFX = {
  click: { file: 'button-click.mp3', volume: 0.4 }, // any HUD / salon button press
  hover: { file: 'button-hover.mp3', volume: 0.5 }, // pointer moves onto a button (mouse only)
  hairGain: { file: 'power_gain.mp3', volume: 0.3 }, // every treadmill step; quiet, it repeats
  cash: { file: 'cash.mp3', volume: 0.5 }, // spending hair or Wins
  levelUp: { file: 'level_up.mp3', volume: 0.4 }, // rebirth and prestige (a level up has its own jingle, LEVEL_SFX)
  winClaim: { file: 'win-claim.mp3', volume: 0.35 }, // zone wins, chests, quests, free gift
}

// Level-up jingle (sfx.js `playLevelUp`, synthesised): a bell arpeggio rising into a shimmering
// chord with a noise swoosh under it and glints on top, into a short hall. The tutorial's finish
// plays the `big` take: a bass under the chord, more glints and a longer ring.
export const LEVEL_SFX = {
  volume: 0.32, // master
  notes: [784, 1047, 1319, 1568], // Hz G5 C6 E6 G6, the rising arpeggio
  step: 0.07, // s between arpeggio notes
  noteLength: 0.34, // s each arpeggio note rings
  chord: [1047, 1319, 1568, 2093], // Hz C6 E6 G6 C7, the bloom after the arpeggio
  chordLength: 1.1, // s the chord rings
  bass: [262, 392], // Hz C4 G4 under the chord (big take only)
  sparkles: 8, // glints over the chord (twice as many in the big take)
  sparkleRange: [2600, 5200], // Hz
  riser: 0.12, // gain of the swoosh up into the chord
  reverb: 0.35, // wet gain of the hall tail
  reverbTime: 0.8, // s of that tail
  bigBoost: 1.25, // volume of the big take against the normal one
  bigRing: 1.6, // chord length factor of the big take
  minGap: 0.35, // s between jingles, so a run of quick levels doesn't stack
  duck: 1000, // ms the treadmill's step tick stays quiet so the jingle reads
}

// Tutorial-complete party sounds (sfx.js, synthesised): the confetti poppers, the party blower
// and a tapped balloon popping. Scaled by the sfx_volume setting.
export const PARTY_SFX = {
  volume: 0.42, // master
  reverb: 0.25, // wet gain into the level-up hall
  crackFreq: 1400, // Hz centre of a popper's crack
  crackLength: 0.09, // s
  thump: [150, 45, 0.16], // [Hz start, Hz end, s] the low kick under the crack
  crackles: 14, // paper ticks in the confetti's rustle after a pop
  crackleSpread: 0.45, // s those ticks spread over
  horn: { from: 330, to: 620, unroll: 0.14, length: 0.62, sag: 0.82, vibrato: [8, 14], cutoff: 2200, level: 0.3 }, // party blower: Hz, Hz, s, s, end pitch factor, [Hz rate, Hz depth], Hz lowpass, gain
  balloon: 0.55, // gain of a tapped balloon's pop
}

// Error buzzer (sfx.js `playError`, synthesised): a thump under two quick falling buzzes, the
// game-show "nuh-uh" for a denied action ("Need 3 Rebirths!"). Scaled by the sfx_volume setting.
export const ERROR_SFX = {
  volume: 0.3, // master
  buzzes: [[340, 230, 0], [270, 150, 0.12]], // [Hz start, Hz end, s offset]: each buzz glides down
  length: 0.15, // s per buzz
  detune: 14, // cents the square and saw layers spread apart (a fat, slightly sour tone)
  cutoff: 2000, // Hz lowpass that rounds off the buzz
  resonance: 5, // Q of that lowpass (a little "wah" bite)
  thump: [160, 50, 0.14], // [Hz start, Hz end, s] sine kick under the first buzz
  thumpLevel: 0.9, // gain of the thump against the buzzes
  minGap: 0.15, // s between buzzers, so rapid taps don't stack
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js). Rotations are radians in CHARACTER space:
// +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-8), z: deg(14) },
      ArmL2: { x: deg(38) },
      ArmR1: { x: deg(4), z: deg(-6) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  // Riding the hair cable: both arms reach up the cable (pitched by its elevation
  // in animator.js), legs tucked a little.
  hang: {
    pose: {
      ArmL1: { x: deg(-90), z: deg(8) }, ArmR1: { x: deg(-90), z: deg(-8) },
      ArmL2: { x: deg(6) }, ArmR2: { x: deg(6) },
      LegL1: { x: deg(-24) }, LegR1: { x: deg(-10) }, LegL2: { x: deg(38) }, LegR2: { x: deg(24) },
      Spine1: { x: deg(-4) },
    },
    swayFrequency: 1.6,
    swayAmount: deg(6),
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06, toHang: 0.1 }, // s to blend a pose change
}

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true'
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}

// --- Multiplayer (net.js, remotePlayers.js; server: Hair-escape-backend) -----------------------------------
// A configured websocket URL wins (dev defaults to a local server); empty = net.js asks the Bloxity SDK for
// the channel's endpoint, and with neither the game simply runs offline.
const SERVER_URL_DEV = import.meta.env.VITE_SERVER_URL_DEV || (import.meta.env.DEV ? 'ws://localhost:2567' : '')
const SERVER_URL_MAIN = import.meta.env.VITE_SERVER_URL_MAIN || ''
export const SERVER_URL = import.meta.env.MODE === 'production' ? SERVER_URL_MAIN : SERVER_URL_DEV
export const NET = {
  poseHz: 12, // Hz the pose is sent at
  saveDebounce: 3, // s after the last change before a save goes out
  saveMaxWait: 15, // s a steady stream of changes may delay a save
  retryDelay: 10, // s between reconnect attempts
  remoteLerp: 12, // 1/s: how fast remote players ease toward their last relayed pose
  maxRemotes: 24, // other players drawn at once (nearest first)
  remoteFade: 90, // m: farther players are hidden
  hairNearDist: 25, // m: remote players closer than this step their hair at hairNearHz
  hairNearHz: 30, // Hz
  hairFarHz: 10, // Hz: farther remote players' hair (cheaper)
  nameHeight: 2.9, // m above a remote player's feet the name tag floats
  tutorialWait: 10, // s the tutorial waits for the account's save before starting from the local one
}

// --- New-player tutorial (tutorial.js, tutorialLogic.js) ---------------------------------------------------
// The step is saved with the account (state.tutorial); a save from before the tutorial counts as finished.
export const DISABLE_TUTORIAL = import.meta.env.VITE_DISABLE_TUTORIAL === 'true'
// Tutorial-complete party (party.js): two confetti poppers fire from the bottom corners, glossy
// balloons float up the screen (tap one to pop it) and a TUTORIAL COMPLETE! banner bounces in over
// spinning sun rays. One overlay canvas at a capped pixel ratio, balloons drawn from sprites
// painted once, and everything is torn down when the last piece leaves the screen.
export const PARTY = {
  maxDpr: 1.5, // pixel-ratio cap of the overlay canvas
  smallScreen: 600, // css px: a shorter side under this is a phone (fewer balloons and pieces)
  balloons: 16, // balloons on a big screen
  balloonsSmall: 10, // ... on a phone
  balloonSize: 0.11, // balloon width as a fraction of the screen's shorter side
  balloonMin: 48, // css px, smallest balloon width
  balloonMax: 116, // css px, largest
  spawnSpread: 1.6, // s over which the balloons are let go
  riseTime: [4.2, 6.2], // s a balloon takes to float up one screen height
  sway: [10, 26], // css px side-to-side drift
  confetti: 200, // cannon and rain pieces on a big screen
  confettiSmall: 120, // ... on a phone
  rainShare: 0.3, // fraction of those that rain down from the top edge
  rainSpread: 1.2, // s the rain is let go over
  popPieces: 12, // shards a popped balloon bursts into
  fireAt: [0.3, 0.45], // s after the start the left and right poppers fire
  hornAt: 1.1, // s after the start the party blower sounds
  speed: [2.2, 3.6], // screen heights / s a popper throws its confetti
  gravity: 0.8, // screen heights / s²
  drag: 3, // 1/s air drag: confetti flutters down at about gravity / drag
  bannerMs: 4200, // ms the banner stays before it bows out
  maxTime: 9, // s after which the party stops even if pieces are left
  colors: ['#ff4f6d', '#ffb020', '#ffe14a', '#46d36a', '#3fb7ff', '#9a6bff', '#ff7ad9'], // balloons and confetti
}

export const TUTORIAL = {
  done: 7, // state.tutorial value meaning "finished" (backend constants.ts TUTORIAL_DONE must match)
  level: 3, // step 1: run on the treadmill up to this level
  style: 'blueberry', // step 6: the hair style the player is sent to buy
  completeMs: 3500, // ms the "Tutorial Complete!" pill stays up
  spacing: 1.1, // m between trail arrows
  speed: 1.8, // m/s the trail crawls toward the target
  maxArrows: 140, // trail arrows drawn at most
  hideWithin: 2.5, // m from the target where the trail disappears (the beacon stays)
  lift: 0.3, // m the trail floats over the line from the player's feet to the target
  beaconHeight: 4.5, // m above the target the big arrow floats
  edgeLook: 2.5, // m ahead of the player checked for lava: at a slab's edge the game pauses to teach the hair throw
  steerAfter: 2, // m of hair out before the game pauses to teach steering the tip
  steerNudge: 12, // px of mouse / drag look input that counts as steering (resumes the steer pause)
}
