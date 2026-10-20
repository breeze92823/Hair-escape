// DOM HUD over the canvas, styled after the Roblox-sim look in the reference:
// the navy quest pill top-centre, the Rebirth / Wins counters and the 2x3 button
// grid down the left (Shop, Backpack, Rebirth, Teleport, Claim, Hair), the bottom
// stack of the hair counter over the Level bar and the four level packs, and the
// Starter Pack / x2 Hair offers on the right. Plus prompts, toasts, "+N" popups,
// a chat log and the panels the buttons open.
import * as game from './game/state.js'
import { clamp, DEV_MODE } from './config.js'

// Dev runs (same test as the save skip in state.js) can teleport to any built stage, ignoring its Level / Wins requirement.
const FREE_TELEPORT = DEV_MODE || import.meta.env.DEV || import.meta.env.MODE === 'development'

// Three significant digits like the reference ("1.36K", "25K", "12.9M"), always rounded down.
const formatNumber = (n) => {
  for (const [v, u] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
    if (n < v) continue
    const x = n / v
    const step = x >= 100 ? 1 : x >= 10 ? 10 : 100
    return `${Math.floor(x * step) / step}${u}`
  }
  return String(Math.floor(n))
}

// The HUD is authored at a 1918x993 viewport. Its tallest column (the left buttons) and the bottom stack never
// overlap vertically at that height, so scaling by height alone keeps them apart on any screen.
const REF_HEIGHT = 993 // px
const BOTTOM_WIDTH = 980 // px, the level packs row plus its price-tag overhang
const MAX_HUD_SCALE = 1.25 // stop growing on very tall screens
// Touch screens (html.touch-ui, set by touch.js). A phone that would shrink the full layout below COMPACT_BELOW
// gets the compact one: no level packs or Starter Pack on screen (both stay in the Shop), the buttons 3x2 under
// the top bar, and the lower left kept free for the move stick.
const COMPACT_BELOW = 0.6
const TOUCH_TOP_SCALE = 0.8 // the top-bar buttons never drop below ~45 px tall on touch
const COMPACT_LEFT_HEIGHT = 350 // px, the counters row plus the 3x2 button grid
const COMPACT_BOTTOM_WIDTH = 840 // px, the Level bar
const STICK_ROOM = 130 // screen px kept clear under the buttons for the move stick
const ACTION_CLEAR = 130 // screen px at the right edge taken by touch.js's Jump / Hair buttons

const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; font-family: "Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif; font-weight: 700; color: #fff; user-select: none; z-index: 5; }
#hud * { box-sizing: border-box; }
#hud .stroke { -webkit-text-stroke: 0.18em #15152a; paint-order: stroke fill; }
/* :where() keeps this reset at zero-ID specificity so the per-button classes below can set their own backgrounds. */
:where(#hud) button { pointer-events: auto; font: inherit; cursor: pointer; border: 0; color: inherit; background: none; padding: 0; }
#hud .studs::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background-image: radial-gradient(rgba(255,255,255,0.16) 30%, transparent 34%); background-size: 18px 18px; background-position: 3px 3px; pointer-events: none; }

/* Top bar: the Roblox-style system buttons top-left and the EVENT pill top-right. */
/* Each anchored group is laid out at the 1918x993 reference size and scaled by --s (set in fit()) from its
   screen corner, so the whole HUD shrinks together on short or narrow screens instead of running off the edge.
   --t scales the top bar (it stays tappable on touch), and --l / --r / --tp / --bt keep clear of the notch and home bar. */
#hud { --s: 1; --t: 1; --l: env(safe-area-inset-left, 0px); --r: env(safe-area-inset-right, 0px); --tp: env(safe-area-inset-top, 0px); --bt: env(safe-area-inset-bottom, 0px); }
.hud-top { position: absolute; top: calc(14px * var(--t) + var(--tp)); left: calc(20px * var(--t) + var(--l)); display: flex; gap: 11px; transform: scale(var(--t)); transform-origin: top left; }
.hud-sys { pointer-events: auto; height: 56px; border-radius: 28px; background: rgba(17,18,22,0.78) !important; display: flex; align-items: center; justify-content: center; gap: 18px; padding: 0 18px !important; }
.hud-sys.round { width: 56px; padding: 0 !important; }
.hud-sys svg { width: 30px; height: 30px; display: block; }
.hud-sys button:hover svg, button.hud-sys:hover svg { transform: scale(1.1); }
.hud-sys .chat.on svg { filter: drop-shadow(0 0 4px #fff); }
.hud-event { position: absolute; top: calc(14px * var(--t) + var(--tp)); right: calc(14px * var(--t) + var(--r)); transform: scale(var(--t)); transform-origin: top right; height: 56px; padding: 0 22px 0 16px !important; border-radius: 28px; background: rgba(17,18,22,0.78) !important; display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600; letter-spacing: 0.02em; }
.hud-event svg { width: 36px; height: 36px; }
.hud-top, .hud-event, .hud-right, .hud-packs { display: none !important; }
.hud-event:hover { background: rgba(40,42,52,0.85) !important; }

.hud-quest { position: absolute; top: calc(140px * var(--s) + var(--tp)); left: 50%; transform: translateX(-50%) scale(var(--s)); transform-origin: top center; display: flex; align-items: center; gap: 18px; padding: 8px 32px 8px 10px; width: 840px; border-radius: 40px;
  background: linear-gradient(#34355a, #1f2040); border: 4px solid #0d0e1c; box-shadow: inset 0 3px 0 rgba(255,255,255,0.12), 0 4px 10px rgba(0,0,0,0.35); transition: transform .25s; }
.hud-quest::before { content: ''; position: absolute; inset: 4px; border-radius: 36px; background-image: radial-gradient(rgba(255,255,255,0.06) 30%, transparent 32%); background-size: 22px 22px; pointer-events: none; }
.hud-quest.pop { transform: translateX(-50%) scale(calc(var(--s) * 1.06)); }
.hud-quest .badge { flex: none; min-width: 74px; height: 52px; border-radius: 26px; display: grid; place-items: center; font-size: 30px; background: linear-gradient(#ffe46b, #ffb800); border: 3px solid #4a3000; box-shadow: inset 0 -4px 0 rgba(160,90,0,0.5); }
.hud-quest .text { flex: 1; text-align: center; font-size: 31px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hud-quest .hl { color: #ffd21a; }
.hud-quest .skip { position: absolute; top: -2px; left: 50%; transform: translateX(-50%); padding: 0 8px; font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.55); }
.hud-quest .skip:hover { color: #fff; }
.hud-quest.done .skip { display: none; }
.hud-quest.done .badge { background: linear-gradient(#b6ff7a, #33d11c); border-color: #154a00; }

/* Left column: Rebirth / Wins counters over the 2x3 button grid. */
.hud-left { position: absolute; left: calc(30px * var(--s) + var(--l)); top: calc(215px * var(--s) + var(--tp)); transform: scale(var(--s)); transform-origin: top left; display: flex; flex-direction: column; gap: 10px; }
.hud-cur { display: flex; align-items: center; gap: 16px; height: 66px; font-size: 52px; line-height: 1; }
.hud-cur .wrap { position: relative; width: 64px; height: 64px; flex: none; }
.hud-cur .wrap svg { width: 64px; height: 64px; filter: drop-shadow(0 2px 0 rgba(0,0,0,0.35)); }
.hud-cur .plus { position: absolute; right: -14px; bottom: -14px; font-size: 38px; line-height: 1; color: #3fe23a; }
.hud-cur .plus:hover { transform: scale(1.15); }
.hud-grid { display: grid; grid-template-columns: repeat(2, 124px); gap: 24px 18px; margin-top: 16px; }
.hud-tile { position: relative; width: 124px; height: 122px; border-radius: 14px; border: 4px solid #15152a; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.3), inset 0 4px 0 rgba(255,255,255,0.28), inset 0 -5px 0 rgba(0,0,0,0.12); transition: transform .1s; overflow: visible; }
.hud-tile:hover { transform: scale(1.06); }
.hud-tile:active { transform: scale(0.96); }
.hud-tile > svg { position: absolute; top: 2px; left: 50%; transform: translateX(-50%); width: 86px; height: 86px; filter: drop-shadow(0 3px 0 rgba(0,0,0,0.3)); }
.hud-tile .lbl { position: relative; font-size: 26px; line-height: 1; letter-spacing: 0.01em; white-space: nowrap; }
.hud-tile.shop { background: linear-gradient(#f77cff, #d23fe6); }
.hud-tile.backpack { background: linear-gradient(#ffbf45, #ff9a14); }
.hud-tile.rebirth { background: linear-gradient(#64c0ff, #2f8ff0); }
.hud-tile.teleport { background: linear-gradient(#c977ff, #9a3df0); }
.hud-tile.claim { background: linear-gradient(#72ec4c, #36c21c); }
.hud-tile.hair { background: linear-gradient(#ffe24a, #ffbe14); }
.hud-tile.rebirth .lbl, .hud-tile.claim .lbl { color: #ffe02a; }
.hud-tile .tag { position: absolute; top: -26px; right: -18px; transform: rotate(10deg); font-size: 34px; line-height: 1; color: #ff9d1a; -webkit-text-stroke: 0.2em #b8160a; paint-order: stroke fill; text-shadow: 0 3px 0 rgba(0,0,0,0.3); }
.hud-tile .bang { position: absolute; top: -12px; right: -12px; width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(#ff4d5a, #d81a28); border: 3px solid #fff; display: none; place-items: center; font-size: 26px; line-height: 1; color: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.45); animation: bang 1.2s ease-in-out infinite; }
.hud-tile.alert .bang { display: grid; }
@keyframes bang { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.15) } }

/* Bottom stack: hair + rebirth bonus, the Level bar, the four level packs. */
/* The packs row is the widest piece; the hair line and the Level bar sit centred over it at 88% width. */
.hud-bottom { position: absolute; bottom: calc(10px * var(--s) + var(--bt)); left: 50%; transform: translateX(-50%) scale(var(--s)); transform-origin: bottom center; width: 934px; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.hud-hair { position: relative; width: 88%; height: 42px; display: flex; align-items: center; justify-content: center; }
.hud-hair .cnt { display: flex; align-items: center; gap: 4px; font-size: 30px; transition: transform .15s; }
.hud-hair .cnt.bump { transform: scale(1.22); }
.hud-hair svg { width: 42px; height: 42px; filter: drop-shadow(0 2px 0 rgba(0,0,0,0.35)); }
.hud-hair .rb { position: absolute; right: 0; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 2px; font-size: 22px; color: #ff6ae6; }
.hud-hair .rb svg { width: 32px; height: 32px; }
.hud-boost { font-size: 16px; color: #ffd21a; margin-left: 8px; }
.hud-level { position: relative; width: 88%; height: 60px; border-radius: 9px; border: 4px solid #12142a; background: #eef1f6; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.25); }
.hud-level::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(150,165,190,0.4) 28%, transparent 31%); background-size: 24px 24px; background-position: 6px 6px; }
.hud-cable { position: relative; width: 88%; height: 44px; border-radius: 9px; border: 4px solid #12142a; background: #eef1f6; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.25); display: none; }
.hud-cable.on { display: block; }
.hud-cable::before, .hud-cable .fill::after { content: ''; position: absolute; inset: 0; background-size: 24px 24px; background-position: 6px 6px; }
.hud-cable::before { background-image: radial-gradient(rgba(150,165,190,0.4) 28%, transparent 31%); }
.hud-cable .fill::after { background-image: radial-gradient(rgba(255,255,255,0.35) 28%, transparent 31%); }
.hud-cable .len { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 30px; line-height: 1; }
.hud-cable .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; background: linear-gradient(#ffe978 0%, #ffd21a 45%, #f2aa00 100%); box-shadow: inset 0 3px 0 rgba(255,255,255,0.35); }
.hud-level .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; min-width: 26%; background: linear-gradient(#5fd0ff 0%, #34b4fb 45%, #1e9cec 100%); transition: width .25s ease-out; box-shadow: inset 0 4px 0 rgba(255,255,255,0.3); }
.hud-level .fill::after { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.25) 28%, transparent 31%); background-size: 24px 24px; background-position: 6px 6px; }
.hud-level .lv, .hud-level .xp { position: absolute; top: 50%; transform: translateY(-50%); font-size: 42px; line-height: 1; }
.hud-level .lv { left: 16px; }
.hud-level .xp { right: 16px; }
.hud-packs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; width: 100%; margin-top: 6px; }
.hud-pack { position: relative; height: 80px; border-radius: 10px; border: 4px solid #15152a; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; line-height: 1; box-shadow: inset 0 4px 0 rgba(255,255,255,0.3), inset 0 -5px 0 rgba(0,0,0,0.12), 0 3px 0 rgba(0,0,0,0.3); transition: transform .1s; }
.hud-pack:hover { transform: scale(1.05); }
.hud-pack:active { transform: scale(0.97); }
.hud-pack .ico { position: absolute; top: 2px; left: 50%; transform: translateX(-50%); width: 44px; height: 44px; }
.hud-pack .lv { font-size: 19px; position: relative; }
.hud-pack .amt { font-size: 34px; position: relative; }
.hud-pack.orange { background: linear-gradient(#ffcf45, #ffa514); }
.hud-pack.blue { background: linear-gradient(#64c6ff, #2c9cf0); }
.hud-pack.red { background: linear-gradient(#ff6e6e, #e8383a); }
.hud-pack.purple { background: linear-gradient(#ca72ff, #9a3df0); }
.hud-price { display: inline-flex; align-items: center; gap: 3px; color: #8dff5c; }
.hud-price svg { width: 1.1em; height: 1.1em; }
.hud-pack .hud-price { position: absolute; top: -18px; right: -6px; font-size: 24px; transform: rotate(14deg); }

/* Right column: Starter Pack over the x2 Hair offer. */
.hud-right { position: absolute; right: calc(30px * var(--s) + var(--r)); top: calc(296px * var(--s) + var(--tp)); transform: scale(var(--s)); transform-origin: top right; width: 270px; display: flex; flex-direction: column; align-items: center; }
.hud-starter { display: flex; flex-direction: column; align-items: center; transition: transform .1s; }
.hud-starter:hover { transform: scale(1.04); }
.hud-starter .title { font-size: 38px; line-height: 1; white-space: nowrap; }
.hud-starter > svg { width: 116px; height: 116px; margin: 2px 0 -24px; filter: drop-shadow(0 0 14px rgba(255,220,80,0.85)); animation: wobble 2.4s ease-in-out infinite; }
@keyframes wobble { 0%, 100% { transform: rotate(-5deg) } 50% { transform: rotate(5deg) } }
.hud-starter .rewards { position: relative; display: flex; gap: 46px; font-size: 30px; line-height: 1; }
.hud-starter .rewards span { display: inline-flex; align-items: center; gap: 2px; }
.hud-starter .rewards svg { width: 38px; height: 38px; }
.hud-starter .hud-price { font-size: 32px; margin-top: 4px; }
.hud-x2 { position: relative; width: 264px; height: 86px; margin-top: 22px; border-radius: 12px; border: 4px solid #15152a !important; overflow: hidden; transition: transform .1s;
  background: linear-gradient(90deg, #ff2d2d, #ff9a1a, #ffe11a, #4fe23a, #2ad4ff, #3a6bff, #c43aff, #ff3ab0, #ff2d2d) !important; background-size: 200% 100% !important; animation: rainbow 4s linear infinite; box-shadow: 0 4px 0 rgba(0,0,0,0.3); }
.hud-x2:hover { transform: scale(1.04); }
@keyframes rainbow { to { background-position: -200% 0 } }
.hud-x2 .in { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 48px; line-height: 1; box-shadow: inset 0 5px 0 rgba(255,255,255,0.3), inset 0 -6px 0 rgba(0,0,0,0.15); }
.hud-x2 .in svg { width: 62px; height: 62px; margin-left: -10px; filter: drop-shadow(0 2px 0 rgba(0,0,0,0.35)); }
.hud-only { font-size: 26px; margin-top: 6px; display: inline-flex; align-items: center; gap: 6px; color: #9dff3a; }
.hud-only svg { width: 30px; height: 30px; }

.hud-prompt { position: absolute; bottom: calc(225px * var(--s) + var(--bt)); left: 50%; transform: translateX(-50%) scale(max(var(--s), 0.7)); transform-origin: bottom center; display: none; align-items: center; gap: 10px; padding: 8px 18px 8px 8px; border-radius: 14px; background: rgba(18,18,24,0.85); font-size: 20px; pointer-events: auto; cursor: pointer; }
.hud-prompt .key { width: 38px; height: 38px; border-radius: 8px; background: #fff; color: #15152a; display: grid; place-items: center; font-size: 22px; box-shadow: inset 0 -3px 0 #b8bccc; }
.hud-prompt.dim { cursor: default; }
.hud-prompt.dim .key { display: none; }
.hud-prompt.dim span { color: #ffb0b0; }

.hud-toasts { position: absolute; top: calc(220px * var(--s) + var(--tp)); left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.hud-toast { font-size: clamp(24px, 3.2vw, 46px); animation: toast 2.6s ease-out forwards; white-space: nowrap; }
@keyframes toast { 0% { opacity: 0; transform: scale(0.4) } 10% { opacity: 1; transform: scale(1.12) } 18% { transform: scale(1) } 80% { opacity: 1 } 100% { opacity: 0; transform: translateY(-30px) } }

.hud-pop { position: absolute; font-size: 30px; color: #ffd21a; transform: translate(-50%, -50%); animation: pop 0.9s ease-out forwards; }
@keyframes pop { 0% { opacity: 0; transform: translate(-50%, -20%) scale(0.5) } 15% { opacity: 1; transform: translate(-50%, -50%) scale(1.15) } 100% { opacity: 0; transform: translate(-50%, -260%) scale(0.9) } }

.hud-chat { position: absolute; top: calc(80px * var(--t) + 6px + var(--tp)); left: calc(20px * var(--s) + var(--l)); width: 340px; max-height: 120px; padding: 10px 12px; border-radius: 12px; background: rgba(18,18,24,0.6); font-size: 15px; font-weight: 500; display: none; flex-direction: column; gap: 4px; overflow: hidden; }
.hud-chat.open { display: flex; }
.hud-chat b { color: #ffd21a; }

.hud-panel { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(460px, 92vw); padding: 22px 24px 24px; border-radius: 22px; background: linear-gradient(#3a3b66, #24254a); border: 4px solid #0d0e1c; box-shadow: 0 10px 30px rgba(0,0,0,0.45); display: none; pointer-events: auto; text-align: center; max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px); overflow-y: auto; }
.hud-panel.open { display: block; }
.hud-panel.wide { width: min(640px, 94vw); }
.hud-panel h2 { margin: 0 0 10px; font-size: 34px; }
.hud-panel p { margin: 8px 0; font-size: 18px; font-weight: 500; line-height: 1.35; }
.hud-panel .big { font-size: 22px; font-weight: 700; color: #ffd21a; }
.hud-panel .row { display: flex; gap: 10px; justify-content: center; margin-top: 16px; }
.hud-btn { padding: 12px 26px; border-radius: 14px; font-size: 22px; color: #fff; background: linear-gradient(#7dff5a, #22b91a); border: 3px solid #0f4a0a !important; box-shadow: inset 0 -4px 0 rgba(0,0,0,0.2); }
.hud-btn.grey { background: linear-gradient(#b8bccc, #7d8299); border-color: #2a2d3a !important; }
.hud-btn.gold { background: linear-gradient(#ffe46b, #ffb800); border-color: #4a3000 !important; }
.hud-btn.red { background: linear-gradient(#ff6b6b, #e02424); border-color: #4a0a0a !important; }
.hud-btn:disabled { filter: grayscale(1); opacity: 0.6; cursor: default; }
.hud-close { position: absolute; top: 10px; right: 10px; width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(#ff6b6b, #e02424); border: 3px solid #4a0a0a !important; color: #fff; font-size: 22px; }
.hud-panel table { width: 100%; font-size: 17px; font-weight: 500; border-collapse: collapse; }
.hud-panel td { padding: 4px 6px; text-align: left; }
.hud-panel td:first-child { color: #ffd21a; font-weight: 700; width: 40%; }
.hud-list { display: flex; flex-direction: column; gap: 8px; max-height: 56vh; overflow-y: auto; padding: 2px 4px; text-align: left; }
.hud-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 12px; background: rgba(0,0,0,0.25); font-size: 18px; }
.hud-row .sw { flex: none; width: 36px; height: 36px; border-radius: 50%; border: 3px solid #15152a; }
.hud-row .sw.ico { border: 0; border-radius: 0; }
.hud-row .sw svg { width: 36px; height: 36px; }
.hud-row .nm { flex: 1; min-width: 0; }
.hud-row .sub { display: block; font-size: 14px; font-weight: 500; opacity: 0.8; }
.hud-row .hud-btn { padding: 6px 14px; font-size: 16px; white-space: nowrap; }
.hud-row.on { outline: 3px solid #ffd21a; }
.hud-row .req { font-size: 14px; font-weight: 600; color: #ffb0b0; white-space: nowrap; }
.hud-shop { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; max-height: 60vh; overflow-y: auto; padding: 14px 4px 4px; }
.hud-shop .hud-pack { height: 96px; }
.hud-shop .hud-pack.full { grid-column: 1 / -1; }
.hud-empty { font-size: 16px; font-weight: 500; opacity: 0.8; padding: 12px; }

/* Touch: ~44 px hit areas on the small buttons, the prompt is tapped instead of pressing E, touch help rows. */
.touch-ui #hud button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.touch-ui #hud :is(.hud-sys button, .skip, .plus, .hud-close)::after { content: ''; position: absolute; inset: -10px; }
.touch-ui #hud :is(.skip, .plus)::after { inset: -18px; }
.touch-ui #hud .hud-sys button { position: relative; height: 56px; padding: 0 4px; }
.touch-ui #hud .hud-prompt { padding: 10px 22px; }
.touch-ui #hud .hud-prompt .key { display: none; }
.hud-panel .ctl-touch, .touch-ui .hud-panel .ctl-keys { display: none; }
.touch-ui .hud-panel .ctl-touch { display: table-row-group; }

/* Compact (touch phones, see COMPACT_BELOW): both side columns tuck under the top bar, the counters share a row
   over a 3x2 grid, and the bottom is just the hair count and Level bar. */
#hud.compact .hud-packs, #hud.compact .hud-starter { display: none; }
#hud.compact .hud-bottom { width: 840px; }
#hud.compact .hud-hair, #hud.compact .hud-level { width: 100%; }
#hud.compact .hud-left { top: calc(70px * var(--t) + 10px + var(--tp)); width: 408px; flex-direction: row; flex-wrap: wrap; column-gap: 44px; }
#hud.compact .hud-grid { flex-basis: 100%; grid-template-columns: repeat(3, 124px); }
#hud.compact .hud-right { top: calc(70px * var(--t) + 10px + var(--tp)); }
#hud.compact .hud-x2 { margin-top: 0; }
#hud.compact .hud-right { transform: scale(max(var(--s), 0.5)); } /* keeps x2 Hair ~44 px tall on the smallest phones */
#hud.compact .hud-quest { width: 540px; }
#hud.compact .hud-quest .text { font-size: 26px; line-height: 1.1; white-space: normal; }
#hud.compact .hud-prompt { bottom: calc(130px * var(--s) + var(--bt)); }
/* Portrait: the quest pill spans the width, so the columns start below it, and EVENT drops its label to fit beside the top bar. */
#hud.compact.portrait .hud-event { width: 56px; padding: 0 !important; justify-content: center; }
#hud.compact.portrait .hud-event span { display: none; }
#hud.compact.portrait .hud-left, #hud.compact.portrait .hud-right { top: calc(240px * var(--s) + var(--tp)); }
/* Hair Salon open (salon/): only the top bar, EVENT and toasts stay; the salon overlay draws the rest. */
#hud.salon :is(.hud-quest, .hud-left, .hud-bottom, .hud-right, .hud-prompt, .hud-chat) { display: none !important; }
`

// The Teleport window (stage list), laid out in reference pixels at 1920x1000
// and scaled by --k (set from the viewport) so it keeps its proportions.
const u = (n) => `calc(${n} * var(--k, 1px))`
const TP_CSS = `
#hud .tp-win { position: absolute; top: 50%; left: 50%; width: ${u(1170)}; height: ${u(665)}; transform: translate(-46%, -44%); display: none; pointer-events: auto; z-index: 20; }
#hud .tp-win.open { display: block; }
#hud:has(.tp-win.open) .hud-quest { visibility: hidden; }
#hud .tp-body { position: absolute; inset: 0; border-radius: ${u(26)}; background-color: #e3e5eb; border: ${u(6)} solid #24252e;
  background-image: radial-gradient(circle at 42% 58%, rgba(60,66,84,0.10) 27%, transparent 31%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.7) 27%, transparent 31%);
  background-size: ${u(44)} ${u(44)}; box-shadow: inset 0 0 0 ${u(5)} #f6f7fa, 0 ${u(10)} ${u(30)} rgba(0,0,0,0.45); z-index: 2; }
#hud .tp-portal { position: absolute; left: ${u(-36)}; top: ${u(-72)}; width: ${u(128)}; height: ${u(158)}; z-index: 3; }
#hud .tp-portal svg { width: 100%; height: 100%; filter: drop-shadow(0 ${u(4)} 0 rgba(0,0,0,0.3)); }
#hud .tp-title { position: absolute; left: 50%; top: ${u(-58)}; transform: translateX(-50%); margin: 0; font-size: ${u(104)}; line-height: 1; letter-spacing: 0.01em; -webkit-text-stroke: 0.15em #15151f; z-index: 3; white-space: nowrap; }
#hud .tp-win .tp-x { position: absolute; top: ${u(-44)}; right: ${u(-42)}; width: ${u(104)}; height: ${u(104)}; border-radius: ${u(14)}; border: ${u(5)} solid #24252e; z-index: 3;
  background: linear-gradient(#ff5a64, #e3212f); box-shadow: inset 0 0 0 ${u(4)} #ff8c94, 0 ${u(4)} 0 rgba(0,0,0,0.35); display: grid; place-items: center; transition: transform .1s; }
#hud .tp-win .tp-x:hover { transform: scale(1.06); }
#hud .tp-win .tp-x svg { width: 62%; height: 62%; }
#hud .tp-head { position: absolute; left: ${u(36)}; right: ${u(58)}; top: ${u(88)}; display: flex; align-items: center; font-size: ${u(52)}; line-height: 1; }
#hud .tp-head .tp-world { flex: 1; white-space: nowrap; overflow: hidden; }
#hud .tp-head .tp-wins, #hud .tp-head .tp-lv { display: inline-flex; align-items: center; gap: ${u(6)}; }
#hud .tp-head .tp-wins { margin-right: ${u(90)}; color: #4be03a; }
#hud .tp-head .tp-lv { color: #ffd21a; }
#hud .tp-head svg { width: ${u(66)}; height: ${u(66)}; filter: drop-shadow(0 ${u(2)} 0 rgba(0,0,0,0.3)); }
#hud .tp-list { position: absolute; left: ${u(38)}; right: ${u(32)}; top: ${u(160)}; bottom: ${u(18)}; overflow-y: auto; padding: ${u(4)} ${u(26)} ${u(8)} 0; display: flex; flex-direction: column; gap: ${u(10)}; }
#hud .tp-list::-webkit-scrollbar { width: ${u(10)}; }
#hud .tp-list::-webkit-scrollbar-track { background: transparent; }
#hud .tp-list::-webkit-scrollbar-thumb { background: #b8bbc4; border-radius: ${u(6)}; }
#hud .tp-row { position: relative; display: block; width: 100%; text-align: left; flex: none; height: ${u(122)}; border-radius: ${u(22)}; border: ${u(5)} solid #3a3c47; background-color: #cdd1d9;
  background-image: radial-gradient(circle at 42% 58%, rgba(60,66,84,0.09) 27%, transparent 31%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 27%, transparent 31%);
  background-size: ${u(44)} ${u(44)}; box-shadow: inset 0 0 0 ${u(4)} #eef0f4; }
#hud .tp-row.here { background-color: #ffc928; box-shadow: inset 0 0 0 ${u(4)} #ffe27a; background-image: radial-gradient(circle at 42% 58%, rgba(170,100,0,0.18) 27%, transparent 31%), radial-gradient(circle at 50% 50%, rgba(255,240,170,0.6) 27%, transparent 31%); }
#hud .tp-row .ico { position: absolute; left: ${u(22)}; top: ${u(4)}; width: ${u(100)}; height: ${u(110)}; }
#hud .tp-row .ico > svg { width: 100%; height: 100%; }
#hud .tp-row .lock { position: absolute; left: ${u(48)}; top: ${u(38)}; width: ${u(66)}; height: ${u(70)}; }
#hud .tp-row .lock svg { width: 100%; height: 100%; }
#hud .tp-row .nm { position: absolute; left: ${u(142)}; top: ${u(10)}; font-size: ${u(54)}; line-height: 1.1; white-space: nowrap; }
#hud .tp-row .lv { position: absolute; left: ${u(142)}; top: ${u(70)}; display: flex; align-items: center; gap: ${u(6)}; font-size: ${u(34)}; line-height: 1; }
#hud .tp-row .lv svg { width: ${u(40)}; height: ${u(40)}; }
#hud .tp-row .lv.no { color: #ff3b3b; }
#hud .tp-row .you { position: absolute; left: ${u(402)}; top: ${u(12)}; padding: ${u(4)} ${u(20)}; border-radius: ${u(30)}; font-size: ${u(38)}; line-height: 1.2; transform: rotate(6deg);
  background: linear-gradient(#3fdc5a, #1fae3c); border: ${u(4)} solid #15151f; box-shadow: inset 0 ${u(3)} 0 rgba(255,255,255,0.35); }
#hud .tp-row .tp-go { position: absolute; right: ${u(22)}; top: 50%; transform: translateY(-50%); width: ${u(312)}; height: ${u(88)}; border-radius: ${u(8)}; border: ${u(5)} solid #24252e;
  display: flex; align-items: center; justify-content: center; gap: ${u(6)}; font-size: ${u(52)}; line-height: 1; transition: transform .1s, filter .1s;
  background-color: #3d9a49; background-image: radial-gradient(circle at 42% 58%, rgba(0,40,0,0.18) 27%, transparent 31%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.12) 27%, transparent 31%);
  background-size: ${u(36)} ${u(36)}; box-shadow: inset 0 0 0 ${u(4)} #5cb866; }
#hud .tp-row .tp-go.ready { background-color: #4bdc3a; box-shadow: inset 0 0 0 ${u(4)} #8cff6e, inset 0 ${u(-8)} 0 rgba(0,90,0,0.25); }
#hud .tp-row .tp-go:hover { transform: translateY(-50%) scale(1.04); filter: brightness(1.08); }
#hud .tp-row .tp-go:active { transform: translateY(-50%) scale(0.97); }
#hud .tp-row .tp-go svg { width: ${u(66)}; height: ${u(66)}; filter: drop-shadow(0 ${u(2)} 0 rgba(0,0,0,0.3)); }
#hud .tp-row .tp-go .c { color: #ff4a2c; }
#hud .tp-row .tp-go.free { font-size: ${u(56)}; }
#hud .tp-row .tp-go.soon { font-size: ${u(40)}; filter: grayscale(0.6); }
#hud .tp-tabs { position: absolute; right: 100%; top: ${u(112)}; display: flex; flex-direction: column; align-items: flex-end; gap: ${u(18)}; margin-right: ${u(-14)}; z-index: 1; }
#hud .tp-tab { position: relative; height: ${u(140)}; padding: ${u(8)} ${u(24)} ${u(8)} ${u(10)}; border-radius: ${u(16)} 0 0 ${u(16)}; border: ${u(5)} solid #24252e; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
  font-size: ${u(38)}; line-height: 1; box-shadow: inset 0 ${u(4)} 0 rgba(255,255,255,0.3), 0 ${u(4)} 0 rgba(0,0,0,0.3); transition: transform .1s, width .1s; }
#hud .tp-tab:hover { transform: translateX(${u(-4)}); }
#hud .tp-tab svg { width: ${u(92)}; height: ${u(92)}; margin-bottom: ${u(-4)}; filter: drop-shadow(0 ${u(3)} 0 rgba(0,0,0,0.3)); }
#hud .tp-tab.stages { width: ${u(132)}; background: #40c844; }
#hud .tp-tab.worlds { width: ${u(132)}; background: #3878d6; }
#hud .tp-tab.on { width: ${u(146)}; }
#hud .tp-tab:not(.on) { filter: brightness(0.9); }
`

// The Rebirth window (Before -> After cards, the level goal bar, Rebirth / Skip), laid out in reference pixels
// at 1918x993 and scaled by --k like the Teleport window. Portrait stacks the Before column over the After one.
const STUDS = (dark, light) => `background-image: radial-gradient(circle at 42% 58%, ${dark} 27%, transparent 31%), radial-gradient(circle at 50% 50%, ${light} 27%, transparent 31%); background-size: ${u(36)} ${u(36)};`
const RB_CSS = `
#hud .rb-win { position: absolute; top: 50%; left: 50%; width: ${u(1486)}; transform: translate(-50%, -46%); display: none; pointer-events: auto; z-index: 20; }
#hud .rb-win.open { display: block; }
#hud:has(.rb-win.open) .hud-quest { visibility: hidden; }
#hud .rb-body { position: relative; padding: ${u(92)} ${u(42)} ${u(34)}; border-radius: ${u(26)}; background-color: #e3e5eb; border: ${u(6)} solid #24252e;
  background-image: radial-gradient(circle at 42% 58%, rgba(60,66,84,0.10) 27%, transparent 31%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.7) 27%, transparent 31%);
  background-size: ${u(44)} ${u(44)}; box-shadow: inset 0 0 0 ${u(5)} #f6f7fa, 0 ${u(10)} ${u(30)} rgba(0,0,0,0.45); }
#hud .rb-badge { position: absolute; left: ${u(-58)}; top: ${u(-84)}; width: ${u(176)}; height: ${u(176)}; z-index: 3; transform: rotate(-6deg); }
#hud .rb-badge svg { width: 100%; height: 100%; filter: drop-shadow(0 ${u(5)} 0 rgba(0,0,0,0.3)); }
#hud .rb-title { position: absolute; left: 50%; top: ${u(-50)}; transform: translateX(-50%); margin: 0; font-size: ${u(112)}; line-height: 1; letter-spacing: 0.01em; -webkit-text-stroke: 0.15em #15151f; z-index: 3; white-space: nowrap; }
#hud .rb-win .rb-x { position: absolute; top: ${u(-44)}; right: ${u(-42)}; width: ${u(112)}; height: ${u(112)}; border-radius: ${u(14)}; border: ${u(5)} solid #24252e; z-index: 3;
  background: linear-gradient(#ff5a64, #e3212f); box-shadow: inset 0 0 0 ${u(4)} #ff8c94, 0 ${u(4)} 0 rgba(0,0,0,0.35); display: grid; place-items: center; transition: transform .1s; }
#hud .rb-win .rb-x:hover { transform: scale(1.06); }
#hud .rb-win .rb-x svg { width: 62%; height: 62%; }
#hud .rb-cols { display: grid; grid-template-columns: 1fr ${u(190)} 1fr; }
#hud .rb-col { display: flex; flex-direction: column; gap: ${u(8)}; }
#hud .rb-col h3 { margin: 0 0 ${u(-2)}; font-size: ${u(34)}; line-height: 1; text-align: center; -webkit-text-stroke: 0.2em #15151f; }
#hud .rb-arrows { display: flex; flex-direction: column; gap: ${u(8)}; padding-top: ${u(40)}; }
#hud .rb-arrows span { height: ${u(112)}; display: grid; place-items: center; }
#hud .rb-arrows svg, #hud .rb-down svg { width: ${u(44)}; height: ${u(56)}; }
#hud .rb-down { display: none; }
#hud .rb-card { position: relative; height: ${u(112)}; border-radius: ${u(12)}; border: ${u(5)} solid #24252e; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-left: ${u(90)}; line-height: 1; }
#hud .rb-card.blue { background-color: #2ea4f6; ${STUDS('rgba(0,40,120,0.16)', 'rgba(255,255,255,0.14)')} box-shadow: inset 0 0 0 ${u(4)} #7fd2ff, inset 0 ${u(-10)} 0 rgba(0,50,140,0.25); }
#hud .rb-card.gold { background-color: #ffc928; ${STUDS('rgba(170,100,0,0.18)', 'rgba(255,240,170,0.5)')} box-shadow: inset 0 0 0 ${u(4)} #ffe27a, inset 0 ${u(-10)} 0 rgba(170,100,0,0.25); }
#hud .rb-card .ico { position: absolute; left: ${u(36)}; top: 50%; transform: translateY(-54%); width: ${u(104)}; height: ${u(112)}; }
#hud .rb-card .ico svg { width: 100%; height: 100%; filter: drop-shadow(0 ${u(3)} 0 rgba(0,0,0,0.3)); }
#hud .rb-card .ico.rb svg { transform: rotate(-8deg); }
#hud .rb-card .big { font-size: ${u(64)}; -webkit-text-stroke: 0.16em #15151f; }
#hud .rb-card .num { font-size: ${u(54)}; -webkit-text-stroke: 0.16em #15151f; }
#hud .rb-card .sub { font-size: ${u(22)}; margin-top: ${u(2)}; color: #ffe02a; -webkit-text-stroke: 0.22em #15151f; letter-spacing: 0.02em; }
#hud .rb-keep { margin: ${u(12)} 0 ${u(6)}; font-size: ${u(32)}; line-height: 1.1; text-align: center; color: #b8ff2a; -webkit-text-stroke: 0.18em #15151f; }
#hud .rb-bar { position: relative; height: ${u(64)}; margin: 0 ${u(22)}; border-radius: ${u(10)}; border: ${u(5)} solid #24252e; background: #f4f5f8; overflow: hidden; box-shadow: inset 0 ${u(-6)} 0 rgba(0,0,0,0.08); }
#hud .rb-bar .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(#7cf04a, #3fcf2a); box-shadow: inset 0 ${u(5)} 0 rgba(255,255,255,0.3); transition: width .25s ease-out; }
#hud .rb-bar .lbl, #hud .rb-bar .val { position: absolute; top: 50%; transform: translateY(-50%); font-size: ${u(44)}; line-height: 1; -webkit-text-stroke: 0.16em #15151f; }
#hud .rb-bar .lbl { left: ${u(38)}; }
#hud .rb-bar .val { right: ${u(36)}; }
#hud .rb-btns { display: flex; justify-content: center; gap: ${u(74)}; margin-top: ${u(14)}; }
#hud .rb-btn { position: relative; width: ${u(540)}; height: ${u(94)}; border-radius: ${u(8)}; border: ${u(5)} solid #24252e; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; transition: transform .1s, filter .1s; }
#hud .rb-btn:hover { transform: scale(1.03); filter: brightness(1.06); }
#hud .rb-btn:active { transform: scale(0.97); }
#hud .rb-btn .t { font-size: ${u(60)}; -webkit-text-stroke: 0.15em #15151f; }
#hud .rb-go { background-color: #c9ccd4; ${STUDS('rgba(60,66,84,0.12)', 'rgba(255,255,255,0.45)')} box-shadow: inset 0 0 0 ${u(4)} #eceef2, inset 0 ${u(-8)} 0 rgba(0,0,0,0.1); }
#hud .rb-go.ready { background-color: #4bdc3a; ${STUDS('rgba(0,60,0,0.16)', 'rgba(255,255,255,0.18)')} box-shadow: inset 0 0 0 ${u(4)} #8cff6e, inset 0 ${u(-8)} 0 rgba(0,90,0,0.25); animation: rbpulse 1.2s ease-in-out infinite; }
@keyframes rbpulse { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.04) } }
#hud .rb-skip { background-color: #ffc928; ${STUDS('rgba(170,100,0,0.18)', 'rgba(255,240,170,0.5)')} box-shadow: inset 0 0 0 ${u(4)} #ffe27a, inset 0 ${u(-8)} 0 rgba(170,100,0,0.25); padding-bottom: ${u(10)}; }
#hud .rb-skip .note { position: absolute; bottom: ${u(-12)}; left: 50%; transform: translateX(-50%); font-size: ${u(25)}; white-space: nowrap; -webkit-text-stroke: 0.2em #15151f; }
#hud .rb-skip .hud-price { position: absolute; top: ${u(-22)}; right: ${u(58)}; font-size: ${u(34)}; transform: rotate(16deg); }
#hud .rb-win.portrait { width: ${u(800)}; }
#hud .rb-win.portrait .rb-body { padding: ${u(110)} ${u(36)} ${u(40)}; }
#hud .rb-win.portrait .rb-cols { grid-template-columns: 1fr; }
#hud .rb-win.portrait .rb-arrows { display: none; }
#hud .rb-win.portrait .rb-down { display: grid; place-items: center; height: ${u(64)}; }
#hud .rb-win.portrait .rb-down svg { transform: rotate(90deg); }
#hud .rb-win.portrait .rb-keep { font-size: ${u(30)}; }
#hud .rb-win.portrait .rb-btns { flex-direction: column; align-items: center; gap: ${u(36)}; margin-top: ${u(24)}; }
#hud .rb-win.portrait .rb-btn { width: 100%; height: ${u(116)}; }
`

// Grey building brick with a flagpole and a red flag (a stage marker): `mark`
// is the big number by the pole, or with `star` a white star on the flag.
const stageIcon = (mark, star = false) => `<svg viewBox="0 0 100 110"><path d="M10 78h80v24a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="#8e94a0" stroke="#24252e" stroke-width="4" stroke-linejoin="round"/><path d="M10 78l12-10h56l12 10z" fill="#c3c8d2" stroke="#24252e" stroke-width="4" stroke-linejoin="round"/><ellipse cx="34" cy="72" rx="10" ry="4.5" fill="#dfe3ea" stroke="#24252e" stroke-width="3"/><ellipse cx="66" cy="72" rx="10" ry="4.5" fill="#dfe3ea" stroke="#24252e" stroke-width="3"/><path d="M40 74V14" stroke="#24252e" stroke-width="10" stroke-linecap="round"/><path d="M40 74V14" stroke="#c9ced8" stroke-width="5" stroke-linecap="round"/><path d="M43 14 92 26 43 44z" fill="#e8243a" stroke="#24252e" stroke-width="4" stroke-linejoin="round"/><path d="M46 19l26 7" stroke="#ff7a86" stroke-width="3" stroke-linecap="round"/><circle cx="40" cy="11" r="8" fill="#ffd21a" stroke="#24252e" stroke-width="3.5"/>${star
  ? `<path d="M60 20l3 6 6.5 1-4.7 4.4 1.1 6.4-5.9-3.1-5.9 3.1 1.1-6.4-4.7-4.4 6.5-1z" fill="#fff" stroke="#24252e" stroke-width="1.5" stroke-linejoin="round"/>`
  : `<text x="38" y="70" text-anchor="middle" font-family="Fredoka, Arial Rounded MT Bold, sans-serif" font-weight="700" font-size="46" fill="#fff" stroke="#15151f" stroke-width="8" paint-order="stroke" stroke-linejoin="round">${mark}</text>`}</svg>`
const PADLOCK_ICON = `<svg viewBox="0 0 60 64"><path d="M16 30V20a14 14 0 0 1 28 0v10" fill="none" stroke="#24252e" stroke-width="13"/><path d="M16 30V20a14 14 0 0 1 28 0v10" fill="none" stroke="#e9ebf0" stroke-width="6"/><rect x="5" y="27" width="50" height="34" rx="7" fill="#ffc21a" stroke="#24252e" stroke-width="4"/><rect x="9" y="31" width="42" height="8" rx="3" fill="#ffe27a"/><circle cx="30" cy="44" r="5" fill="#24252e"/><path d="M28 46h4l1 8h-6z" fill="#24252e"/></svg>`
// Purple stone portal ring with gold studs, a cyan swirl and sparkles (the Teleport window badge).
const BIG_PORTAL_ICON = (() => {
  const studs = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 + 0.3
    return `<circle cx="${(60 + Math.cos(a) * 45).toFixed(1)}" cy="${(78 + Math.sin(a) * 60).toFixed(1)}" r="5.5" fill="#ffd21a" stroke="#6a3a00" stroke-width="2.5"/>`
  }).join('')
  const sparkle = (x, y, s) => `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}z" fill="#fff" stroke="#6a4ad0" stroke-width="1.5"/>`
  return `<svg viewBox="0 0 120 156"><ellipse cx="60" cy="78" rx="55" ry="72" fill="#8b4fe8" stroke="#24252e" stroke-width="5"/><ellipse cx="60" cy="78" rx="49" ry="66" fill="#a874ff"/><ellipse cx="60" cy="78" rx="35" ry="50" fill="#1e9cf0" stroke="#4a2aa0" stroke-width="5"/><ellipse cx="60" cy="78" rx="28" ry="42" fill="#5fd2ff"/><path d="M60 78m-4 0a4 4 0 1 1 8 0a9 11 0 1 1-18 0a15 19 0 1 1 30 0a21 28 0 1 1-42 0" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>${studs}${sparkle(98, 26, 11)}${sparkle(22, 118, 9)}${sparkle(84, 112, 6)}</svg>`
})()
// Blue globe with green land and an orange ring (the Worlds tab).
const GLOBE_ICON = `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="#2f8fff" stroke="#14244a" stroke-width="3"/><path d="M18 20c5-3 9 0 12 4s-2 7 2 10 7 0 7 5-6 9-11 9c-2-4 1-8-3-11s-9 0-10-5 0-9 3-12zM40 14c4 1 8 4 10 9-4 1-7-1-9-3s-3-4-1-6z" fill="#5fd13a" stroke="#1d5a10" stroke-width="2" stroke-linejoin="round"/><path d="M14 22c6-2 12 0 14 2" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.8"/><ellipse cx="32" cy="34" rx="30" ry="9" fill="none" stroke="#24252e" stroke-width="7" transform="rotate(-18 32 34)"/><ellipse cx="32" cy="34" rx="30" ry="9" fill="none" stroke="#ffb020" stroke-width="3.5" transform="rotate(-18 32 34)"/></svg>`
// White chevron with a dark outline (the Before -> After arrows).
const CHEVRON_ICON = `<svg viewBox="0 0 44 56"><path d="M12 8l20 20-20 20" fill="none" stroke="#15151f" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8l20 20-20 20" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const BIG_X_ICON = `<svg viewBox="0 0 40 40"><path d="M9 9l22 22M31 9 9 31" stroke="#15151f" stroke-width="13" stroke-linecap="round"/><path d="M9 9l22 22M31 9 9 31" stroke="#fff" stroke-width="7" stroke-linecap="round"/></svg>`

// Golden S-shaped lock of hair with a pink bead (the HUD currency icon).
const HAIR_ICON = `<svg viewBox="0 0 48 48"><defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe86b"/><stop offset="1" stop-color="#f5a00c"/></linearGradient></defs><path d="M31 3c-10-1-19 4-19 12 0 7 7 10 12 13 4 2 6 5 3 8-3 2-8 2-12-1 1 6 8 9 14 8 8-2 11-8 9-14-2-5-8-8-12-10-4-2-4-5-1-7 3-2 8-1 12 1 1-5-2-9-6-10z" fill="url(#hg)" stroke="#5a3200" stroke-width="2.6" stroke-linejoin="round"/><path d="M17 13c1-3 5-5 9-5M27 31c2 1 2 3 1 5" fill="none" stroke="#fff6c0" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="40" r="4" fill="#ff5fb4" stroke="#5a0a3a" stroke-width="2"/></svg>`
// White tilted badge with a red cap and a black S (rebirths).
const REBIRTH_ICON = `<svg viewBox="0 0 64 64"><defs><clipPath id="rbc"><rect x="9" y="9" width="46" height="46" rx="10" transform="rotate(-14 32 32)"/></clipPath></defs><g clip-path="url(#rbc)"><rect width="64" height="64" fill="#fff"/><path d="M0 0H64V20L0 36Z" fill="#ef2f4d"/><path d="M0 36 64 20V25L0 41Z" fill="#b81530"/></g><rect x="9" y="9" width="46" height="46" rx="10" transform="rotate(-14 32 32)" fill="none" stroke="#15152a" stroke-width="4"/><path d="M41 22c-4-4-15-3-15 3 0 7 15 5 15 12 0 6-11 8-16 3" fill="none" stroke="#15152a" stroke-width="6.5" stroke-linecap="round"/></svg>`
// Gold trophy (wins).
const TROPHY_ICON = `<svg viewBox="0 0 64 64"><path d="M16 8h32v16c0 10-7 18-16 18S16 34 16 24z" fill="#ffd21a" stroke="#5a3200" stroke-width="3" stroke-linejoin="round"/><path d="M16 12H8v6c0 7 5 12 10 12M48 12h8v6c0 7-5 12-10 12" fill="none" stroke="#5a3200" stroke-width="3"/><path d="M10 14h6v10c-3-1-6-4-6-8zM54 14h-6v10c3-1 6-4 6-8z" fill="#ffb000"/><path d="M28 42h8v8h-8z" fill="#ffb000" stroke="#5a3200" stroke-width="3"/><rect x="18" y="50" width="28" height="8" rx="2" fill="#ffd21a" stroke="#5a3200" stroke-width="3"/><path d="M24 14c0 6 2 10 5 13" fill="none" stroke="#fff6c0" stroke-width="3" stroke-linecap="round"/></svg>`
// Green hexagon with a white rounded square (the premium currency).
const ROBUX_ICON = `<svg viewBox="0 0 64 64"><path d="M32 3 57 17.5v29L32 61 7 46.5v-29z" fill="#2fcf6a" stroke="#0b5a28" stroke-width="3" stroke-linejoin="round"/><rect x="20" y="20" width="24" height="24" rx="4" fill="#fff" transform="rotate(10 32 32)"/><rect x="26" y="26" width="12" height="12" rx="2" fill="#2fcf6a" transform="rotate(10 32 32)"/></svg>`
// Pink shopping basket.
const SHOP_ICON = `<svg viewBox="0 0 64 64"><path d="M20 24 30 8M44 24 34 8" stroke="#5a0a3a" stroke-width="4" stroke-linecap="round"/><path d="M8 24h48l-6 30H14z" fill="#ff5fb4" stroke="#5a0a3a" stroke-width="3" stroke-linejoin="round"/><path d="M20 30v18M32 30v18M44 30v18" stroke="#ffb3dc" stroke-width="4" stroke-linecap="round"/><rect x="6" y="20" width="52" height="8" rx="3" fill="#ff8ad0" stroke="#5a0a3a" stroke-width="3"/></svg>`
// Red backpack with white buckles.
const BACKPACK_ICON = `<svg viewBox="0 0 64 64"><path d="M24 12a8 8 0 0 1 16 0" fill="none" stroke="#4a0a0a" stroke-width="4" stroke-linecap="round"/><rect x="4" y="22" width="9" height="24" rx="3" fill="#c81e1e" stroke="#4a0a0a" stroke-width="3"/><rect x="51" y="22" width="9" height="24" rx="3" fill="#c81e1e" stroke="#4a0a0a" stroke-width="3"/><rect x="11" y="12" width="42" height="47" rx="11" fill="#f0302a" stroke="#4a0a0a" stroke-width="3"/><path d="M11 26c8 4 34 4 42 0" fill="none" stroke="#4a0a0a" stroke-width="3"/><path d="M15 20c3-4 8-5 12-5" fill="none" stroke="#ff8a7a" stroke-width="3" stroke-linecap="round"/><rect x="17" y="35" width="30" height="18" rx="5" fill="#d42020" stroke="#4a0a0a" stroke-width="3"/><rect x="21" y="29" width="7" height="12" rx="2" fill="#eef0f6" stroke="#4a0a0a" stroke-width="2.5"/><rect x="36" y="29" width="7" height="12" rx="2" fill="#eef0f6" stroke="#4a0a0a" stroke-width="2.5"/></svg>`
// Blue swirl portal in a violet ring.
const PORTAL_ICON = `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="32" rx="23" ry="27" fill="#8a4dff" stroke="#2a0a5a" stroke-width="3"/><ellipse cx="32" cy="32" rx="17" ry="21" fill="#4a7bff"/><ellipse cx="32" cy="32" rx="12" ry="15" fill="#6fd8ff"/><path d="M32 13c11 1 15 11 9 17s-17 4-15 12 11 7 11 7M22 22c-3 4-3 9 0 12" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="32" cy="32" rx="4" ry="5.5" fill="#2a2aa8"/><circle cx="12" cy="18" r="2.5" fill="#ff8aff"/><circle cx="53" cy="47" r="2.5" fill="#ff8aff"/></svg>`
// Gift box: blue box, yellow ribbon (the Claim button) or red box (the Starter Pack).
const giftIcon = (box, dark) => `<svg viewBox="0 0 64 64"><rect x="8" y="26" width="48" height="32" rx="4" fill="${box}" stroke="${dark}" stroke-width="3"/><rect x="4" y="16" width="56" height="14" rx="4" fill="${box}" stroke="${dark}" stroke-width="3"/><rect x="26" y="16" width="12" height="42" fill="#ffd21a" stroke="${dark}" stroke-width="3"/><path d="M32 16c-2-8-14-12-14-4 0 5 8 5 14 4zM32 16c2-8 14-12 14-4 0 5-8 5-14 4z" fill="#ffd21a" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/></svg>`
const CLAIM_ICON = giftIcon('#3a7bff', '#0a1a5a')
const STARTER_ICON = giftIcon('#e8243a', '#5a0a14')
// Golden hair with scissors (the Hair button).
const HAIRSTYLE_ICON = `<svg viewBox="0 0 64 64"><path d="M30 6c-11 0-18 9-16 19 1 7 7 10 7 17 0 6-5 9-5 13 4 0 11-4 12-11 1-6-4-10-4-16 0-5 4-9 9-9s8 4 7 9c-1 5-6 6-6 11 0 4 4 6 7 6-1-3-2-6 2-10 5-5 7-9 6-15-1-8-9-14-19-14z" fill="#ffd21a" stroke="#5a3200" stroke-width="3" stroke-linejoin="round"/><path d="M22 18c2-5 8-7 13-5" fill="none" stroke="#fff6c0" stroke-width="3" stroke-linecap="round"/><path d="M40 40 56 20M40 24l16 20" stroke="#5a0a3a" stroke-width="6.5" stroke-linecap="round"/><path d="M40 40 56 20M40 24l16 20" stroke="#ffd6f0" stroke-width="3.5" stroke-linecap="round"/><circle cx="36" cy="45" r="5.5" fill="none" stroke="#5a0a3a" stroke-width="7"/><circle cx="36" cy="45" r="5.5" fill="none" stroke="#ff5fc8" stroke-width="4"/><circle cx="36" cy="19" r="5.5" fill="none" stroke="#5a0a3a" stroke-width="7"/><circle cx="36" cy="19" r="5.5" fill="none" stroke="#ff5fc8" stroke-width="4"/></svg>`
// Top-bar glyphs: the tilted-square menu logo, menu lines, chat bubble, music note, phone, and the EVENT crown.
const LOGO_ICON = `<svg viewBox="0 0 32 32"><g transform="rotate(15 16 16)"><rect x="6" y="6" width="20" height="20" rx="2.5" fill="#fff"/><rect x="13" y="13" width="6" height="6" fill="#16171b"/></g></svg>`
const BURGER_ICON = `<svg viewBox="0 0 32 32"><path d="M5 8h22M5 16h22M5 24h22" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`
const CHAT_ICON = `<svg viewBox="0 0 32 32"><path d="M5 6h22v15H14l-6 5v-5H5z" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="M10 12h12M10 16h8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`
const MUSIC_ICON = `<svg viewBox="0 0 32 32"><path d="M14 23V5c4 1 9 3 10 9-2-3-6-4-7-4v13" fill="#ff3d9a" stroke="#ff3d9a" stroke-width="2.4" stroke-linejoin="round"/><ellipse cx="10.5" cy="23.5" rx="5.5" ry="4.5" fill="#ff3d9a" transform="rotate(-20 10.5 23.5)"/></svg>`
const PHONE_ICON = `<svg viewBox="0 0 32 32"><rect x="8" y="2.5" width="16" height="27" rx="3.5" fill="#2c6bff" stroke="#c9d8ff" stroke-width="2"/><rect x="10.5" y="6.5" width="11" height="17" rx="1" fill="#7fd6ff"/><circle cx="16" cy="26.5" r="1.3" fill="#fff"/></svg>`
const CROWN_ICON = `<svg viewBox="0 0 48 48"><path d="M6 16l9 9 9-15 9 15 9-9-4 22H10z" fill="#ffc21a" stroke="#7a4a00" stroke-width="2.5" stroke-linejoin="round"/><rect x="10" y="36" width="28" height="6" rx="2" fill="#ffd84a" stroke="#7a4a00" stroke-width="2.5"/><circle cx="24" cy="27" r="3.2" fill="#ff3d5a"/><circle cx="16" cy="30" r="2.4" fill="#3ad0ff"/><circle cx="32" cy="30" r="2.4" fill="#3ad0ff"/><circle cx="6" cy="16" r="2.6" fill="#ffd84a" stroke="#7a4a00" stroke-width="2"/><circle cx="24" cy="9" r="2.6" fill="#ffd84a" stroke="#7a4a00" stroke-width="2"/><circle cx="42" cy="16" r="2.6" fill="#ffd84a" stroke="#7a4a00" stroke-width="2"/></svg>`

// Shared with the Hair Salon UI (salon/salonUi.js), so both overlays draw the same currency and glyphs.
export { BIG_X_ICON, HAIR_ICON, HAIRSTYLE_ICON, PADLOCK_ICON, REBIRTH_ICON, ROBUX_ICON, TROPHY_ICON, formatNumber }

// Level packs along the bottom and the two offers on the right (premium
// currency). Display only in this build: there is no payment flow yet.
export const LEVEL_PACKS = [
  { levels: 24, hair: 25000, price: 25, color: 'orange' },
  { levels: 35, hair: 100000, price: 79, color: 'blue' },
  { levels: 48, hair: 500000, price: 199, color: 'red' },
  { levels: 75, hair: 12900000, price: 449, color: 'purple' },
]
export const STARTER_PACK = { hair: 25000, wins: 50, price: 20 }
export const X2_HAIR = { price: 6 }

const el = (tag, cls, html = '') => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  e.innerHTML = html
  return e
}
const price = (n) => `<span class="hud-price stroke">${ROBUX_ICON}${n}</span>`
const packHtml = (p) => `<span class="ico">${HAIR_ICON}</span><span class="lv stroke">+${p.levels} LV</span><span class="amt stroke">+${formatNumber(p.hair)}</span>${price(p.price)}`
const clockText = (ms) => {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s % 60).padStart(2, '0')}`
}

// Teleport window: `world` is its header name, `stages` [{ level, wins, spot? }]
// in order (a stage without a spot is "Coming Soon"), `worlds` [{ name, spot? }]
// for the Worlds tab, `currentStage()` the index the player stands in (the
// YOU! row), and `onTeleport(spot)` moves the player. A stage opens at its
// level and needs `wins` Wins (a requirement, not spent). `onOpenSalon()` opens the Hair Salon (the Hair button).
export function createHud({ onMenu, onClaimBoost, onSkipQuest, onTeleport, onOpenSalon, world = 'World 1', stages = [], worlds = [], currentStage = () => 0 }) {
  const style = document.createElement('style')
  style.textContent = CSS + TP_CSS + RB_CSS
  document.head.appendChild(style)

  const root = el('div', '')
  root.id = 'hud'
  document.body.appendChild(root)

  // --- Top: system buttons (left) and the EVENT pill (right)
  const top = el('div', 'hud-top', `
    <button class="hud-sys round logo" title="Menu">${LOGO_ICON}</button>
    <span class="hud-sys"><button class="menu" title="Settings">${BURGER_ICON}</button><button class="chat" title="Chat">${CHAT_ICON}</button></span>
    <button class="hud-sys round music" title="Music">${MUSIC_ICON}</button>
    <button class="hud-sys round phone" title="How to play">${PHONE_ICON}</button>`)
  const eventBtn = el('button', 'hud-event', `${CROWN_ICON}<span>EVENT</span>`)
  root.append(top, eventBtn)

  const quest = el('div', 'hud-quest', `<button class="skip">Skip</button><div class="badge stroke">1/6</div><div class="text stroke"></div>`)
  root.appendChild(quest)

  // --- Left: counters + button grid
  const left = el('div', 'hud-left', `
    <div class="hud-cur rebirths"><span class="wrap">${REBIRTH_ICON}</span><span class="n stroke">0</span></div>
    <div class="hud-cur wins"><span class="wrap">${TROPHY_ICON}<button class="plus stroke" title="Get more Wins">+</button></span><span class="n stroke">0</span></div>
    <div class="hud-grid">
      <button class="hud-tile studs shop">${SHOP_ICON}<span class="lbl stroke">Shop</span><span class="tag">OP!</span></button>
      <button class="hud-tile studs backpack">${BACKPACK_ICON}<span class="lbl stroke">Backpack</span></button>
      <button class="hud-tile studs rebirth">${REBIRTH_ICON}<span class="lbl stroke">REBIRTH!</span><span class="bang">!</span></button>
      <button class="hud-tile studs teleport">${PORTAL_ICON}<span class="lbl stroke">Teleport</span></button>
      <button class="hud-tile studs claim">${CLAIM_ICON}<span class="lbl stroke">CLAIM!</span><span class="bang">!</span></button>
      <button class="hud-tile studs hair">${HAIRSTYLE_ICON}<span class="lbl stroke">Hair</span></button>
    </div>`)
  root.appendChild(left)

  // --- Bottom: hair counter, level bar, level packs
  const bottom = el('div', 'hud-bottom')
  const hair = el('div', 'hud-hair', `<span class="cnt">${HAIR_ICON}<span class="n stroke">0</span><span class="hud-boost stroke"></span></span><span class="rb">${REBIRTH_ICON}<span class="pct stroke">+0%</span></span>`)
  const level = el('div', 'hud-level', `<div class="fill"></div><span class="lv stroke">Level 1</span><span class="xp stroke">0/12</span>`)
  const packs = el('div', 'hud-packs', LEVEL_PACKS.map((p) => `<button class="hud-pack studs ${p.color}">${packHtml(p)}</button>`).join(''))
  const cableBar = el('div', 'hud-cable', `<div class="fill"></div><span class="len stroke"></span>`) // remaining hair length while the cable is out
  bottom.append(hair, cableBar, level, packs)
  root.appendChild(bottom)

  // --- Right: Starter Pack + x2 Hair
  const right = el('div', 'hud-right', `
    <button class="hud-starter"><span class="title stroke">Starter Pack</span>${STARTER_ICON}
      <span class="rewards"><span class="stroke">${HAIR_ICON}+${formatNumber(STARTER_PACK.hair)}</span><span class="stroke">${TROPHY_ICON}+${STARTER_PACK.wins}</span></span>
      ${price(STARTER_PACK.price)}</button>
    <button class="hud-x2"><span class="in">${HAIR_ICON}<span class="stroke">x2 Hair</span></span></button>
    <span class="hud-only stroke">ONLY ${ROBUX_ICON}${X2_HAIR.price}</span>`)
  root.appendChild(right)

  // HUD scale --s: fit the reference layout's height, and the bottom stack's width on narrow screens. Touch phones
  // switch to the compact layout and scale it by the room left beside the stick and the Jump / Hair buttons.
  const fitHud = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const touch = document.documentElement.classList.contains('touch-ui')
    const portrait = h > w
    let s = Math.min(MAX_HUD_SCALE, h / REF_HEIGHT, (w - 16) / BOTTOM_WIDTH)
    const compact = touch && s < COMPACT_BELOW
    if (compact) {
      const leftTop = 70 * Math.max(s, TOUCH_TOP_SCALE) + 10 // px, where the button grid starts under the top bar
      s = Math.min(MAX_HUD_SCALE, (w - 16) / COMPACT_BOTTOM_WIDTH)
      // Landscape: leave the stick room under the buttons and keep the Level bar clear of the Jump / Hair buttons.
      if (!portrait) s = Math.min(s, (h - leftTop - STICK_ROOM) / COMPACT_LEFT_HEIGHT, (w / 2 - ACTION_CLEAR) / (COMPACT_BOTTOM_WIDTH / 2))
    }
    const t = touch ? Math.max(s, TOUCH_TOP_SCALE) : s
    root.classList.toggle('compact', compact)
    root.classList.toggle('portrait', portrait)
    root.style.setProperty('--s', s.toFixed(3))
    root.style.setProperty('--t', t.toFixed(3))
    // Where the bottom stack reaches under the Jump / Hair buttons (portrait), touch.js lifts them above it.
    const halfBottom = (compact ? COMPACT_BOTTOM_WIDTH : BOTTOM_WIDTH) / 2
    const lift = touch && w / 2 + halfBottom * s > w - ACTION_CLEAR ? bottom.getBoundingClientRect().height + 10 * s : 0
    document.documentElement.style.setProperty('--touch-lift', `${Math.round(lift)}px`)
  }
  window.addEventListener('resize', fitHud)
  fitHud()

  const prompt = el('div', 'hud-prompt', `<div class="key">E</div><span class="stroke"></span>`)
  root.appendChild(prompt)

  const toasts = el('div', 'hud-toasts')
  root.appendChild(toasts)

  const chat = el('div', 'hud-chat')
  root.appendChild(chat)

  // --- Panels
  const panel = (cls, html) => {
    const p = el('div', `hud-panel ${cls}`, `<button class="hud-close">✕</button>${html}`)
    root.appendChild(p)
    return p
  }
  const eventPanel = panel('', `
    <h2 class="stroke">👑 Hair Festival</h2>
    <p>The festival is on! Claim a <span class="big">2x Hair</span> boost for 5 minutes of treadmill time.</p>
    <p class="status"></p>
    <div class="row"><button class="hud-btn stroke claim">CLAIM 2x</button></div>`)
  const helpPanel = panel('', `
    <h2 class="stroke">How to play</h2>
    <table>
      <tbody class="ctl-keys">
        <tr><td>Move</td><td>WASD / Arrows</td></tr>
        <tr><td>Jump</td><td>Shift</td></tr>
        <tr><td>Hair cable</td><td>Space launches it ahead; Space again lets go</td></tr>
        <tr><td>Look</td><td>Mouse (click to lock), wheel to zoom</td></tr>
        <tr><td>Interact</td><td>E</td></tr>
      </tbody>
      <tbody class="ctl-touch">
        <tr><td>Move</td><td>Touch the left side and slide your thumb</td></tr>
        <tr><td>Jump</td><td>The arrow button, bottom right</td></tr>
        <tr><td>Hair cable</td><td>The hair button launches it ahead; tap again to let go</td></tr>
        <tr><td>Look</td><td>Drag the right side; pinch to zoom</td></tr>
        <tr><td>Interact</td><td>Tap the prompt</td></tr>
      </tbody>
    </table>
    <p>Run on a <span class="big">treadmill</span> to grow hair. Hair opens the gates in the course behind <span class="big">START</span>. Escape to earn Wins and unlock new hair styles!</p>
    <table class="stats"></table>
    <div class="row"><button class="hud-btn grey stroke menu">Settings</button></div>`)
  const shopPanel = panel('wide', `<h2 class="stroke">🛒 Shop</h2><div class="hud-shop"></div><p class="hud-empty">Premium purchases are not available in this version.</p>`)
  const backpackPanel = panel('wide', `<h2 class="stroke">🎒 Backpack</h2><div class="hud-list"></div>`)
  // Rebirth window: the renderer fills the Before / After columns.
  const rbCol = (side, title) => `<div class="rb-col rb-${side}"><h3 class="stroke">${title}</h3>
    <div class="rb-card blue"><span class="ico">${HAIR_ICON}</span><span class="big stroke"></span></div>
    <div class="rb-card blue"><span class="ico rb">${REBIRTH_ICON}</span><span class="num stroke"></span><span class="sub stroke"></span></div>
    <div class="rb-card gold"><span class="ico">${stageIcon('', true)}</span><span class="num stroke"></span><span class="sub stroke"></span></div></div>`
  const rebirthPanel = el('div', 'rb-win', `
    <div class="rb-body">
      <span class="rb-badge">${REBIRTH_ICON}</span>
      <h2 class="rb-title stroke">Rebirth</h2>
      <button class="rb-x hud-close" title="Close">${BIG_X_ICON}</button>
      <div class="rb-cols">
        ${rbCol('before', 'Before')}
        <div class="rb-arrows"><span>${CHEVRON_ICON}</span><span>${CHEVRON_ICON}</span><span>${CHEVRON_ICON}</span></div>
        <div class="rb-down">${CHEVRON_ICON}</div>
        ${rbCol('after', 'After')}
      </div>
      <p class="rb-keep stroke">You KEEP your Wins, Hair Styles &amp; Treadmills! Only Hair &amp; Level reset.</p>
      <div class="rb-bar"><div class="fill"></div><span class="lbl stroke">Level</span><span class="val stroke"></span></div>
      <div class="rb-btns">
        <button class="rb-btn rb-go"><span class="t stroke">Rebirth</span></button>
        <button class="rb-btn rb-skip"><span class="t stroke">Skip Rebirth</span><span class="note stroke">NO LEVELS NEEDED!</span>${price(game.SKIP_REBIRTH.price)}</button>
      </div>
    </div>`)
  root.appendChild(rebirthPanel)
  // 1 reference px -> screen px, with the overhanging badge and close button kept on screen. Portrait uses the
  // stacked layout (authored ~800 wide, ~1350 tall).
  const fitRebirth = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const portrait = h > w * 1.1
    rebirthPanel.classList.toggle('portrait', portrait)
    const k = portrait ? Math.min(1, (w - 16) / 860, (h - 16) / 1420) : Math.min(1, (w - 16) / 1600, (h - 16) / 880)
    rebirthPanel.style.setProperty('--k', `${k}px`)
  }
  window.addEventListener('resize', fitRebirth)
  fitRebirth()
  const teleportPanel = el('div', 'tp-win', `
    <div class="tp-tabs">
      <button class="tp-tab stages on" data-tab="stages">${stageIcon('', true)}<span class="stroke">Stages</span></button>
      <button class="tp-tab worlds" data-tab="worlds">${GLOBE_ICON}<span class="stroke">Worlds</span></button>
    </div>
    <div class="tp-body">
      <span class="tp-portal">${BIG_PORTAL_ICON}</span>
      <h2 class="tp-title stroke">Teleport</h2>
      <button class="tp-x hud-close" title="Close">${BIG_X_ICON}</button>
      <div class="tp-head"><span class="tp-world stroke"></span><span class="tp-wins">${TROPHY_ICON}<span class="n stroke">0</span></span><span class="tp-lv">${HAIR_ICON}<span class="n stroke">Lv 0</span></span></div>
      <div class="tp-list"></div>
    </div>`)
  root.appendChild(teleportPanel)
  let tpTab = 'stages'
  // Keep the window at the reference proportions: 1px of the 1920-wide layout, shrunk to fit.
  const fitTeleport = () => teleportPanel.style.setProperty('--k', `${Math.min(1, window.innerWidth / 1400, window.innerHeight / 800)}px`)
  window.addEventListener('resize', fitTeleport)
  fitTeleport()
  const claimPanel = panel('', `
    <h2 class="stroke">🎁 Free Gift</h2>
    <p>A free hair gift every <span class="big">${game.GIFT_COOLDOWN / 3600e3} hours</span>. The more levels you have, the bigger the gift.</p>
    <p class="status"></p>
    <div class="row"><button class="hud-btn stroke go">CLAIM!</button></div>`)

  const panels = [eventPanel, helpPanel, shopPanel, backpackPanel, rebirthPanel, teleportPanel, claimPanel]
  const closePanels = () => {
    panels.forEach((x) => x.classList.remove('open'))
    document.body.classList.remove('win-open')
  }
  const openPanel = (p) => {
    const was = p.classList.contains('open')
    closePanels()
    if (was) return
    p.classList.add('open')
    document.body.classList.add('win-open')
    if (document.pointerLockElement) document.exitPointerLock?.()
    render(p)
  }
  for (const p of panels) p.querySelector('.hud-close').addEventListener('click', closePanels)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && document.body.classList.contains('win-open')) closePanels()
  })

  // --- Panel contents (rebuilt on open and whenever the state changes while open)
  const hairRow = (id, st) => {
    const equipped = game.state.equipped === id
    let action
    if (equipped) action = `<button class="hud-btn gold stroke" disabled>EQUIPPED</button>`
    else if (game.canEquip(id)) action = `<button class="hud-btn stroke" data-equip="${id}">EQUIP</button>`
    else if (game.canAcquire(id)) action = `<button class="hud-btn gold stroke" data-equip="${id}">BUY 🏆${formatNumber(st.price)}</button>`
    else action = `<span class="req">${game.requirementText(id)}</span>`
    const sw = st.stripes ? `linear-gradient(135deg, ${st.stripes.join(',')})` : `linear-gradient(${st.tip}, ${st.color})`
    return `<div class="hud-row${equipped ? ' on' : ''}"><span class="sw" style="background:${sw}"></span><span class="nm">${st.name}<span class="sub">+${st.bonus} hair per step</span></span>${action}</div>`
  }
  const renderers = new Map([
    [shopPanel, () => {
      const sp = STARTER_PACK
      shopPanel.querySelector('.hud-shop').innerHTML =
        LEVEL_PACKS.map((p) => `<button class="hud-pack studs ${p.color}">${packHtml(p)}</button>`).join('') +
        `<button class="hud-pack studs red"><span class="lv stroke">Permanent boost</span><span class="amt stroke">x2 Hair</span>${price(X2_HAIR.price)}</button>` +
        `<button class="hud-pack studs purple full"><span class="lv stroke">Starter Pack</span><span class="amt stroke">+${formatNumber(sp.hair)} Hair · +${sp.wins} Wins</span>${price(sp.price)}</button>`
    }],
    [backpackPanel, () => {
      const list = backpackPanel.querySelector('.hud-list')
      const styles = Object.entries(game.HAIR_STYLES).filter(([id]) => game.canEquip(id))
      const treadmills = game.state.owned.filter((k) => k.startsWith('tm:')).map((k) => k.slice(3))
      list.innerHTML = styles.map(([id, st]) => hairRow(id, st)).join('') +
        (treadmills.length ? `<div class="hud-row"><span class="sw ico">${HAIRSTYLE_ICON}</span><span class="nm">Treadmills<span class="sub">${treadmills.join(', ')}</span></span></div>` : '')
    }],
    [rebirthPanel, () => {
      const s = game.state
      const need = game.rebirthLevel()
      const fill = (side, rebirths, rbSub, lv, lvSub) => {
        const col = rebirthPanel.querySelector(`.rb-${side}`)
        const [r, l] = col.querySelectorAll('.num')
        const [rs, ls] = col.querySelectorAll('.sub')
        col.querySelector('.big').textContent = `x${+game.hairMultiplier(rebirths).toFixed(2)} Hair`
        r.textContent = formatNumber(rebirths)
        rs.textContent = rbSub
        l.textContent = `Lv ${lv}`
        ls.textContent = lvSub
      }
      fill('before', s.rebirths, 'REBIRTHS', need, 'TO REBIRTH')
      fill('after', s.rebirths + 1, '+1 REBIRTH', game.rebirthLevel(s.rebirths + 1), 'NEXT GOAL')
      rebirthPanel.querySelector('.rb-bar .fill').style.width = `${Math.min(100, (s.level / need) * 100)}%`
      rebirthPanel.querySelector('.rb-bar .val').textContent = `${Math.min(s.level, need)}/${need}`
      rebirthPanel.querySelector('.rb-go').classList.toggle('ready', game.canRebirth())
    }],
    [teleportPanel, () => {
      const s = game.state
      const here = currentStage()
      teleportPanel.querySelectorAll('.tp-tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tpTab))
      teleportPanel.querySelector('.tp-world').textContent = tpTab === 'stages' ? world : 'Worlds'
      teleportPanel.querySelector('.tp-wins .n').textContent = formatNumber(s.wins)
      teleportPanel.querySelector('.tp-lv .n').textContent = `Lv ${s.level}`
      const you = `<span class="you stroke">YOU!</span>`
      teleportPanel.querySelector('.tp-list').innerHTML = tpTab === 'stages'
        ? stages.map((st, i) => {
          const lvOk = FREE_TELEPORT || s.level >= st.level
          let go
          if (!st.wins || (FREE_TELEPORT && st.spot)) go = `<span class="tp-go ready free stroke">FREE!</span>`
          else go = `<span class="tp-go${st.spot && lvOk && s.wins >= st.wins ? ' ready' : ''}">${TROPHY_ICON}<span class="c stroke">${formatNumber(st.wins)}</span></span>`
          return `<button class="tp-row${i === here ? ' here' : ''}" data-stage="${i}">
            <span class="ico">${stageIcon(i + 1)}${lvOk ? '' : `<span class="lock">${PADLOCK_ICON}</span>`}</span>
            <span class="nm stroke">Stage ${i + 1}</span>
            <span class="lv${lvOk ? '' : ' no'}">${HAIR_ICON}<span class="stroke">Lv ${st.level}</span></span>
            ${i === here ? you : ''}${go}</button>`
        }).join('')
        : worlds.map((w, i) => `<button class="tp-row${i === 0 ? ' here' : ''}" data-world="${i}">
            <span class="ico">${GLOBE_ICON}${w.spot ? '' : `<span class="lock">${PADLOCK_ICON}</span>`}</span>
            <span class="nm stroke">World ${i + 1}</span>
            <span class="lv"><span class="stroke">${w.name}</span></span>
            ${i === 0 ? you : ''}${w.spot ? `<span class="tp-go ready free stroke">FREE!</span>` : `<span class="tp-go soon stroke">SOON</span>`}</button>`).join('')
    }],
    [claimPanel, () => {
      const wait = game.GIFT_COOLDOWN - (Date.now() - game.state.giftAt)
      const ready = wait <= 0
      claimPanel.querySelector('.status').innerHTML = ready
        ? `Your gift: <span class="big">+${game.giftAmount().toLocaleString()} Hair</span>`
        : `Next gift in <span class="big">${clockText(wait)}</span>`
      claimPanel.querySelector('.go').disabled = !ready
    }],
  ])
  const render = (p) => renderers.get(p)?.()
  const renderOpen = () => panels.forEach((p) => p.classList.contains('open') && render(p))

  // --- Wiring
  const api = {} // filled below; click handlers use api.toast
  const q = (sel) => root.querySelector(sel)
  quest.querySelector('.skip').addEventListener('click', () => onSkipQuest?.())
  helpPanel.querySelector('.menu').addEventListener('click', () => onMenu?.())
  eventPanel.querySelector('.claim').addEventListener('click', () => onClaimBoost?.())
  for (const sel of ['.hud-tile.shop', '.hud-cur.wins .plus', '.hud-starter', '.hud-x2']) q(sel).addEventListener('click', () => openPanel(shopPanel))
  packs.addEventListener('click', (e) => e.target.closest('.hud-pack') && openPanel(shopPanel))
  shopPanel.addEventListener('click', (e) => {
    if (e.target.closest('.hud-pack')) api.toast('Not available in this version', '#ffb0b0')
  })
  q('.hud-tile.backpack').addEventListener('click', () => openPanel(backpackPanel))
  q('.hud-tile.hair').addEventListener('click', () => {
    closePanels()
    onOpenSalon?.()
  })
  q('.hud-tile.rebirth').addEventListener('click', () => openPanel(rebirthPanel))
  q('.hud-tile.teleport').addEventListener('click', () => openPanel(teleportPanel))
  q('.hud-tile.claim').addEventListener('click', () => openPanel(claimPanel))
  for (const sel of ['.hud-top .logo', '.hud-top .menu']) q(sel).addEventListener('click', () => onMenu?.())
  q('.hud-top .phone').addEventListener('click', () => openPanel(helpPanel))
  q('.hud-top .music').addEventListener('click', () => api.toast('No music in this version', '#ffb0b0'))
  q('.hud-top .chat').addEventListener('click', (e) => {
    const on = chat.classList.toggle('open')
    e.currentTarget.classList.toggle('on', on)
  })
  eventBtn.addEventListener('click', () => openPanel(eventPanel))
  backpackPanel.addEventListener('click', (e) => {
    const id = e.target.closest('[data-equip]')?.dataset.equip
    if (id && !game.equip(id)) api.toast('Not enough Wins!', '#ffb0b0')
  })
  rebirthPanel.querySelector('.rb-go').addEventListener('click', () => {
    if (game.rebirth()) closePanels()
    else api.toast(`Reach Level ${game.rebirthLevel()}!`, '#ffb0b0')
  })
  rebirthPanel.querySelector('.rb-skip').addEventListener('click', () => api.toast('Not available in this version', '#ffb0b0'))
  claimPanel.querySelector('.go').addEventListener('click', () => {
    const n = game.claimGift()
    if (n > 0) {
      api.toast(`+${n.toLocaleString()} Hair!`, '#b6ff7a')
      render(claimPanel)
    }
  })
  teleportPanel.addEventListener('click', (e) => {
    const tab = e.target.closest('.tp-tab')?.dataset.tab
    if (tab) {
      tpTab = tab
      render(teleportPanel)
      return
    }
    const go = (spot, name) => {
      closePanels()
      onTeleport?.(spot)
      api.toast(name, '#5fe0ff')
    }
    const row = e.target.closest('.tp-row')
    if (!row) return
    if (row.dataset.world != null) {
      const w = worlds[row.dataset.world]
      if (w.spot) go(w.spot, w.name)
      else api.toast('Coming soon!', '#ffb0b0')
      return
    }
    const i = Number(row.dataset.stage)
    const st = stages[i]
    const s = game.state
    if (!st.spot) api.toast('Coming soon!', '#ffb0b0')
    else if (FREE_TELEPORT) go(st.spot, `Stage ${i + 1}`)
    else if (s.level < st.level) api.toast(`Reach Level ${st.level}!`, '#ffb0b0')
    else if (s.wins < st.wins) api.toast(`Need ${st.wins} Wins!`, '#ffb0b0')
    else go(st.spot, `Stage ${i + 1}`)
  })

  let promptAction = null
  prompt.addEventListener('click', () => promptAction?.())

  // Cached last-shown values so the DOM only changes when something does.
  const last = {}
  const set = (key, value, fn) => {
    if (last[key] === value) return
    last[key] = value
    fn(value)
  }

  // Time-driven bits: the gift's "!" badge and its countdown.
  const tick = () => {
    const ready = game.giftReady()
    set('giftReady', ready, () => q('.hud-tile.claim').classList.toggle('alert', ready))
    if (claimPanel.classList.contains('open')) render(claimPanel)
  }
  setInterval(tick, 1000)

  Object.assign(api, {
    openEvent: () => openPanel(eventPanel),
    // The Hair Salon covers the screen: close any window and hide everything but the top bar and toasts.
    setSalon(on) {
      closePanels()
      root.classList.toggle('salon', on)
    },
    // Everything derived from the progression state: counters, badges, open panels.
    setState(s) {
      set('rebirths', s.rebirths, () => (q('.hud-cur.rebirths .n').textContent = formatNumber(s.rebirths)))
      set('wins', s.wins, () => (q('.hud-cur.wins .n').textContent = formatNumber(s.wins)))
      set('rbPct', s.rebirths, () => (hair.querySelector('.pct').textContent = `+${Math.round(s.rebirths * game.REBIRTH_BONUS * 100)}%`))
      set('canRebirth', game.canRebirth(), (ok) => q('.hud-tile.rebirth').classList.toggle('alert', ok))
      tick()
      renderOpen()
    },
    setQuest(index, total, text) {
      set('quest', `${index}|${text}`, () => {
        const done = index >= total
        quest.classList.toggle('done', done)
        quest.querySelector('.badge').textContent = `${Math.min(index + 1, total)}/${total}`
        const safe = text.replace(/[<>&]/g, '')
        quest.querySelector('.text').innerHTML = safe.replace(/\*(.+?)\*/g, '<span class="hl">$1</span>')
        quest.classList.add('pop')
        setTimeout(() => quest.classList.remove('pop'), 250)
      })
    },
    setHair(n) {
      set('hair', n, () => {
        hair.querySelector('.n').textContent = formatNumber(n)
        const cnt = hair.querySelector('.cnt')
        cnt.classList.add('bump')
        setTimeout(() => cnt.classList.remove('bump'), 140)
      })
    },
    // Remaining hair length of the cable in flight as a 0..1 fraction of `full` metres; null hides the bar.
    setCableLength(fraction, full = 0) {
      const w = fraction == null ? '' : Math.round(clamp(fraction, 0, 1) * 200) / 2
      const txt = w === '' ? '' : `${Math.ceil((w / 100) * full)}/${Math.round(full)}m`
      set('cableLen', `${w}|${txt}`, () => {
        cableBar.classList.toggle('on', w !== '')
        if (w === '') return
        cableBar.firstChild.style.width = `${w}%`
        cableBar.querySelector('.len').textContent = txt
      })
    },
    setBoost(secondsLeft) {
      const txt = secondsLeft > 0 ? `2x ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` : ''
      set('boost', txt, () => (hair.querySelector('.hud-boost').textContent = txt))
      const status = secondsLeft > 0 ? `Boost active: ${txt.slice(3)} left` : 'Ready to claim!'
      set('boostStatus', status, () => {
        eventPanel.querySelector('.status').textContent = status
        eventPanel.querySelector('.claim').disabled = secondsLeft > 0
      })
    },
    setLevel(lv, xp, req) {
      set('level', `${lv}|${xp}|${req}`, () => {
        level.querySelector('.lv').textContent = `Level ${lv}`
        level.querySelector('.xp').textContent = `${formatNumber(xp)}/${formatNumber(req)}`
        level.querySelector('.fill').style.width = `${Math.min(100, (xp / req) * 100)}%`
      })
    },
    setStats(rows) {
      set('stats', JSON.stringify(rows), () => {
        helpPanel.querySelector('.stats').innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')
      })
    },
    // text: string or null. `enabled` false shows it greyed with no key (a requirement, not an action).
    setPrompt(text, enabled = true, action = null) {
      promptAction = enabled ? action : null
      set('prompt', `${text}|${enabled}`, () => {
        prompt.style.display = text ? 'flex' : 'none'
        prompt.classList.toggle('dim', !enabled)
        prompt.querySelector('span').textContent = text ?? ''
      })
    },
    toast(text, fill = '#ffd21a') {
      const t = el('div', 'hud-toast stroke')
      t.textContent = text
      t.style.color = fill
      toasts.appendChild(t)
      setTimeout(() => t.remove(), 2600)
    },
    popup(text, x, y) {
      const p = el('div', 'hud-pop stroke')
      p.textContent = text
      p.style.left = `${x + (Math.random() - 0.5) * 60}px`
      p.style.top = `${y}px`
      root.appendChild(p)
      setTimeout(() => p.remove(), 900)
    },
    chat(html) {
      const line = el('div', '', html)
      chat.appendChild(line)
      while (chat.children.length > 9) chat.firstChild.remove()
    },
  })
  return api
}
