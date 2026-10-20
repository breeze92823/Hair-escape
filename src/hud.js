// DOM HUD over the canvas, styled after the Roblox-sim look in the reference:
// the navy quest pill top-centre, the Rebirth / Wins counters and the 2-column button
// grid down the left (Backpack, Rebirth, Teleport, Hair), the bottom
// stack of the hair counter over the Level bar and the four level packs, and the
// Starter Pack / x2 Hair offers on the right. Plus prompts, toasts, "+N" popups,
// a chat log and the panels the buttons open.
import * as game from './game/state.js'
import { clamp, DEV_MODE } from './config.js'
import { playSfx } from './sfx.js'
import { CHARMS } from './game/cosmetics.js'
import { TAB_ICONS, charmIcon, colorIcon } from './salon/icons.js'

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
.hud-quest .lines { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; }
.hud-quest .text { width: 100%; text-align: center; font-size: 31px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hud-quest .hint { max-width: 100%; font-size: 21px; font-weight: 600; color: #cfe0ff; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hud-quest .hint:empty { display: none; }
.hud-quest .hl { color: #ffd21a; }
.hud-quest .skip { position: absolute; top: -2px; left: 50%; transform: translateX(-50%); padding: 0 8px; font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.55); }
.hud-quest .skip:hover { color: #fff; }
.hud-quest.done .skip { display: none; }
.hud-quest.done .badge { background: linear-gradient(#b6ff7a, #33d11c); border-color: #154a00; }
/* New-player tutorial (tutorial.js) drives the same pill: a TUTORIAL tag, a pulsing gold rim and a real Skip button under it. */
.hud-quest .tag { display: none; position: absolute; top: -20px; left: 40px; padding: 1px 14px; border-radius: 14px; font-size: 19px; letter-spacing: 2px; background: linear-gradient(#ffe46b, #ffb800); border: 3px solid #4a3000; }
.hud-quest.tutorial .tag { display: block; }
.hud-quest.tutorial { border-color: #ffb800; animation: tut-rim 1.4s ease-in-out infinite; }
.hud-quest.tutorial.done { border-color: #33d11c; animation: none; }
.hud-quest.tutorial.done .tag { background: linear-gradient(#b6ff7a, #33d11c); border-color: #154a00; }
.hud-quest.tutorial .skip { top: auto; bottom: -34px; padding: 2px 18px; font-size: 19px; color: #fff; border-radius: 14px; background: linear-gradient(#ff6a5a, #d8352e); border: 3px solid #5a0f0c; }
.hud-quest.tutorial .skip::after { content: ''; position: absolute; left: 50%; top: 50%; width: max(100%, calc(88px / var(--s))); height: max(100%, calc(44px / var(--s))); transform: translate(-50%, -50%); } /* ≥44 px tap area at any HUD scale */
@keyframes tut-rim { 50% { box-shadow: inset 0 3px 0 rgba(255,255,255,0.12), 0 0 0 4px rgba(255,210,58,0.85), 0 0 22px 6px rgba(255,190,30,0.55); } }

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
.hud-tile.backpack { background: linear-gradient(#ffbf45, #ff9a14); }
.hud-tile.rebirth { background: linear-gradient(#64c0ff, #2f8ff0); }
.hud-tile.teleport { background: linear-gradient(#c977ff, #9a3df0); }
.hud-tile.hair { background: linear-gradient(#ffe24a, #ffbe14); }
.hud-tile.rebirth .lbl { color: #ffe02a; }
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

.hud-pop { position: absolute; display: flex; align-items: center; gap: 6px; font-size: clamp(26px, 3vw, 38px); color: #ffd77a; transform: translate(-50%, -50%); animation: pop 0.9s ease-out forwards; }
.hud-pop-ico { display: block; width: 1.15em; height: 1.15em; filter: drop-shadow(0 0 8px rgba(255, 120, 200, 0.9)); animation: pop-whirl 0.9s cubic-bezier(0.3, 0.6, 0.5, 1) forwards; }
.hud-pop-ico > svg { width: 100%; height: 100%; display: block; }
@keyframes pop-whirl { 0% { transform: rotate(0deg) scale(0.4) } 25% { transform: rotate(240deg) scale(1.25) } 100% { transform: rotate(900deg) scale(0.85) } }
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
#hud.compact .hud-quest .hint { font-size: 20px; white-space: normal; }
#hud.compact .hud-quest.tutorial .skip { font-size: 24px; bottom: -40px; }
#hud.compact .hud-prompt { bottom: calc(130px * var(--s) + var(--bt)); }
/* Portrait: the quest pill spans the width, so the columns start below it, and EVENT drops its label to fit beside the top bar. */
#hud.compact.portrait .hud-event { width: 56px; padding: 0 !important; justify-content: center; }
#hud.compact.portrait .hud-event span { display: none; }
#hud.compact.portrait .hud-left, #hud.compact.portrait .hud-right { top: calc(240px * var(--s) + var(--tp)); }
#hud.compact.portrait:has(.hud-quest.tutorial) :is(.hud-left, .hud-right) { top: calc(300px * var(--s) + var(--tp)); } /* room for the hint and Skip tutorial */
/* Hair Salon open (salon/): only the top bar, EVENT and toasts stay; the salon overlay draws the rest. */
#hud.salon :is(.hud-quest, .hud-left, .hud-bottom, .hud-right, .hud-prompt, .hud-chat) { display: none !important; }
`

// The Teleport window (stage list), laid out in reference pixels at 1920x1000
// and scaled by --k (set from the viewport) so it keeps its proportions.
const u = (n) => `calc(${n} * var(--k, 1px))`
// Two-tone stud pattern (the brick look on cards and buttons).
const STUDS = (dark, light) => `background-image: radial-gradient(circle at 42% 58%, ${dark} 27%, transparent 31%), radial-gradient(circle at 50% 50%, ${light} 27%, transparent 31%); background-size: ${u(36)} ${u(36)};`
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
/* Worlds tab: the globe badge and a row of world cards replace the portal, header and stage list. */
#hud .tp-globe { position: absolute; left: ${u(-56)}; top: ${u(-70)}; width: ${u(170)}; height: ${u(170)}; z-index: 3; display: none; }
#hud .tp-globe svg { width: 100%; height: 100%; filter: drop-shadow(0 ${u(5)} 0 rgba(0,0,0,0.3)); }
#hud .tp-worlds { position: absolute; left: ${u(40)}; right: ${u(40)}; top: ${u(96)}; bottom: ${u(40)}; display: none; justify-content: center; align-items: flex-start; gap: ${u(28)}; }
#hud .tp-win.worlds :is(.tp-portal, .tp-head, .tp-list) { display: none; }
#hud .tp-win.worlds .tp-globe { display: block; }
#hud .tp-win.worlds .tp-worlds { display: flex; }
#hud .tp-card { position: relative; flex: 1; max-width: ${u(336)}; height: ${u(506)}; padding: ${u(16)} ${u(16)} ${u(18)}; border-radius: ${u(22)}; border: ${u(6)} solid #24252e;
  display: flex; flex-direction: column; align-items: center; line-height: 1; text-align: center; }
#hud .tp-card.cur { background-color: #4cc456; ${STUDS('rgba(0,60,0,0.16)', 'rgba(255,255,255,0.16)')} box-shadow: inset 0 0 0 ${u(5)} #8ef08a; }
#hud .tp-card.lock { background-color: #4a96e2; ${STUDS('rgba(0,40,120,0.16)', 'rgba(255,255,255,0.14)')} box-shadow: inset 0 0 0 ${u(5)} #9fd2ff; }
#hud .tp-card.soon { background-color: #8b8e99; ${STUDS('rgba(30,30,40,0.16)', 'rgba(255,255,255,0.12)')} box-shadow: inset 0 0 0 ${u(5)} #b8bbc4; }
#hud .tp-card .art { position: relative; width: 100%; height: ${u(212)}; flex: none; border-radius: ${u(16)}; border: ${u(5)} solid #24252e; overflow: hidden; background: #24252e; }
#hud .tp-card .art > svg { display: block; width: 100%; height: 100%; }
#hud .tp-card.soon .art > svg { filter: grayscale(0.35) brightness(0.62); }
#hud .tp-card .art .lock { position: absolute; left: 50%; top: 50%; width: ${u(108)}; height: ${u(116)}; transform: translate(-50%, -50%); }
#hud .tp-card .art .lock svg { width: 100%; height: 100%; filter: drop-shadow(0 ${u(4)} 0 rgba(0,0,0,0.4)); }
#hud .tp-card .nm { margin-top: ${u(12)}; font-size: ${u(60)}; white-space: nowrap; }
#hud .tp-card .sub { margin-top: ${u(2)}; font-size: ${u(36)}; color: #ffd21a; white-space: nowrap; }
#hud .tp-card .st { margin-top: ${u(10)}; font-size: ${u(29)}; line-height: 1.1; }
#hud .tp-card.cur .st { color: #9dff6e; }
#hud .tp-card.lock .st { color: #ffd21a; }
#hud .tp-wbtn { flex: none; margin-top: auto; min-width: ${u(216)}; height: ${u(92)}; padding: 0 ${u(18)}; border-radius: ${u(36)}; border: ${u(5)} solid #15151f; display: inline-flex; align-items: center; justify-content: center; gap: ${u(6)};
  font-size: ${u(36)}; line-height: 1; white-space: nowrap; transition: transform .1s, filter .1s; }
#hud .tp-wbtn.here { background: linear-gradient(#3fdc5a, #1fae3c); box-shadow: inset 0 ${u(4)} 0 rgba(255,255,255,0.35); cursor: default; }
#hud .tp-wbtn.rb { border-radius: ${u(8)}; background-color: #ffc928; ${STUDS('rgba(170,100,0,0.18)', 'rgba(255,240,170,0.5)')} box-shadow: inset 0 0 0 ${u(4)} #ffe27a, inset 0 ${u(-6)} 0 rgba(170,100,0,0.25); font-size: ${u(30)}; }
#hud .tp-wbtn.go { border-radius: ${u(8)}; background-color: #4bdc3a; box-shadow: inset 0 0 0 ${u(4)} #8cff6e, inset 0 ${u(-6)} 0 rgba(0,90,0,0.25); }
#hud .tp-wbtn:is(.rb, .go):hover { transform: scale(1.05); filter: brightness(1.06); }
#hud .tp-wbtn:is(.rb, .go):active { transform: scale(0.96); }
#hud .tp-wbtn svg { width: ${u(48)}; height: ${u(48)}; flex: none; }
/* Portrait Worlds tab: a narrower, taller window with the cards stacked as rows (picture left, text right), so it
   can scale up enough for the buttons to stay tappable. */
#hud .tp-win.worlds.portrait { width: ${u(720)}; height: ${u(1120)}; transform: translate(-43%, -50%); }
#hud .tp-win.worlds.portrait .tp-worlds { flex-direction: column; align-items: stretch; top: ${u(110)}; bottom: ${u(30)}; gap: ${u(22)}; left: ${u(30)}; right: ${u(30)}; }
#hud .tp-win.worlds.portrait .tp-card { flex: none; max-width: none; height: ${u(312)}; display: grid; grid-template-columns: ${u(250)} 1fr; grid-template-rows: auto auto auto 1fr; column-gap: ${u(18)}; justify-items: center; }
#hud .tp-win.worlds.portrait .tp-card .art { grid-row: 1 / 5; height: 100%; }
#hud .tp-win.worlds.portrait .tp-card .nm { margin-top: ${u(4)}; }
#hud .tp-win.worlds.portrait .tp-wbtn { align-self: end; height: ${u(110)}; font-size: ${u(40)}; }
#hud .tp-win.worlds.portrait .tp-wbtn.rb { font-size: ${u(32)}; }
`

// The Rebirth window, laid out in reference pixels at 1918x993 and scaled by --k like the Teleport window, with
// three tabs: Rebirth (Before -> After cards, the level goal bar), Prestige (the multiplier, its prizes, the
// rebirth goal) and Upgrades (rebirth-gated levels). Portrait stacks the columns.
const RB_CSS = `
#hud .rb-win { position: absolute; top: 50%; left: 50%; width: ${u(1486)}; transform: translate(calc(-50% + ${u(76)}), -46%); display: none; pointer-events: auto; z-index: 20; }
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
#hud .rb-win.portrait { width: ${u(800)}; }
#hud .rb-win.portrait .rb-body { padding: ${u(110)} ${u(36)} ${u(40)}; }
#hud .rb-win.portrait .rb-cols { grid-template-columns: 1fr; }
#hud .rb-win.portrait .rb-arrows { display: none; }
#hud .rb-win.portrait .rb-down { display: grid; place-items: center; height: ${u(64)}; }
#hud .rb-win.portrait .rb-down svg { transform: rotate(90deg); }
#hud .rb-win.portrait .rb-keep { font-size: ${u(30)}; }
#hud .rb-win.portrait .rb-btns { flex-direction: column; align-items: center; gap: ${u(36)}; margin-top: ${u(24)}; }
#hud .rb-win.portrait .rb-btn { width: 100%; height: ${u(116)}; }

/* Tabs down the left edge (Rebirth / Prestige / Upgrades); only the picked tab's pane shows. Landscape shifts the
   window right by half the tab overhang (in .rb-win above) so the pair stays centred. Portrait puts the tabs in a row under the body. */
#hud .rb-tabs { position: absolute; right: 100%; top: ${u(120)}; display: flex; flex-direction: column; align-items: flex-end; gap: ${u(18)}; margin-right: ${u(-14)}; }
#hud .rb-tab { position: relative; width: ${u(164)}; height: ${u(160)}; padding: ${u(6)} ${u(14)} ${u(10)} ${u(4)}; white-space: nowrap; border-radius: ${u(16)} 0 0 ${u(16)}; border: ${u(5)} solid #24252e; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
  font-size: ${u(30)}; line-height: 1; box-shadow: inset 0 ${u(4)} 0 rgba(255,255,255,0.3), 0 ${u(4)} 0 rgba(0,0,0,0.3); transition: transform .1s, width .1s; }
#hud .rb-tab:hover { transform: translateX(${u(-4)}); }
#hud .rb-tab svg { width: ${u(100)}; height: ${u(100)}; margin-bottom: ${u(2)}; filter: drop-shadow(0 ${u(3)} 0 rgba(0,0,0,0.3)); }
#hud .rb-tab.rebirth { background-color: #2ea4f6; ${STUDS('rgba(0,40,120,0.16)', 'rgba(255,255,255,0.14)')} }
#hud .rb-tab.prestige { background-color: #ffc928; ${STUDS('rgba(170,100,0,0.18)', 'rgba(255,240,170,0.5)')} }
#hud .rb-tab.upgrades { background-color: #3fcf3a; ${STUDS('rgba(0,60,0,0.16)', 'rgba(255,255,255,0.18)')} }
#hud .rb-tab.on { width: ${u(182)}; }
#hud .rb-tab:not(.on) { filter: brightness(0.88); }
#hud .rb-tab .bang { display: none; position: absolute; left: ${u(-22)}; top: ${u(-18)}; width: ${u(48)}; height: ${u(52)}; border-radius: ${u(8)}; border: ${u(4)} solid #24252e; background: #e8243a; font-size: ${u(38)}; place-items: center; -webkit-text-stroke: 0.12em #15151f; }
#hud .rb-tab.alert .bang { display: grid; }
#hud .rb-pane { display: none; }
#hud .rb-win[data-tab="rebirth"] .rb-pane.rebirth, #hud .rb-win[data-tab="prestige"] .rb-pane.prestige, #hud .rb-win[data-tab="upgrades"] .rb-pane.upgrades { display: block; }
#hud .rb-win.portrait { transform: translate(-50%, -50%); }
#hud .rb-win.portrait.open { display: flex; flex-direction: column; }
#hud .rb-win.portrait .rb-tabs { order: 2; position: static; flex-direction: row; justify-content: center; align-items: flex-start; margin: ${u(-14)} 0 0; }
#hud .rb-win.portrait .rb-tab { width: ${u(200)}; height: ${u(150)}; border-radius: 0 0 ${u(16)} ${u(16)}; padding: ${u(14)} ${u(6)} ${u(8)}; }
#hud .rb-win.portrait .rb-tab.on { width: ${u(200)}; height: ${u(166)}; }
#hud .rb-win.portrait .rb-tab:hover { transform: none; }

/* Prestige: Before -> After multiplier cards, the next prestige's prizes, what resets, the rebirth goal bar. */
#hud .pr-cols { display: grid; grid-template-columns: 1fr ${u(150)} 1fr; align-items: end; }
#hud .pr-arrow { height: ${u(150)}; display: grid; place-items: center; }
#hud .pr-arrow svg { width: ${u(50)}; height: ${u(64)}; }
#hud .pr-card { position: relative; height: ${u(150)}; border-radius: ${u(14)}; border: ${u(5)} solid #24252e; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-left: ${u(150)}; line-height: 1; }
#hud .pr-card.gold { background-color: #ffc928; ${STUDS('rgba(170,100,0,0.18)', 'rgba(255,240,170,0.5)')} box-shadow: inset 0 0 0 ${u(4)} #ffe27a, inset 0 ${u(-10)} 0 rgba(170,100,0,0.25); }
#hud .pr-card.pink { background-color: #e45cf0; ${STUDS('rgba(110,0,120,0.16)', 'rgba(255,255,255,0.16)')} box-shadow: inset 0 0 0 ${u(4)} #ffa8ff, inset 0 ${u(-10)} 0 rgba(110,0,120,0.25); }
#hud .pr-card .ico { position: absolute; left: ${u(14)}; top: 50%; transform: translateY(-50%); width: ${u(150)}; height: ${u(126)}; }
#hud .pr-card .ico svg { width: 100%; height: 100%; filter: drop-shadow(0 ${u(3)} 0 rgba(0,0,0,0.3)); }
#hud .pr-card .big { font-size: ${u(76)}; -webkit-text-stroke: 0.15em #15151f; }
#hud .pr-card .sub { font-size: ${u(36)}; margin-top: ${u(2)}; color: #ffe02a; -webkit-text-stroke: 0.2em #15151f; }
#hud .pr-prizes { display: flex; align-items: center; justify-content: center; gap: ${u(18)}; margin-top: ${u(12)}; min-height: ${u(176)}; }
#hud .pr-plbl { width: ${u(230)}; font-size: ${u(42)}; line-height: 1.05; text-align: center; color: #ffd21a; -webkit-text-stroke: 0.18em #15151f; }
#hud .pr-prize { position: relative; width: ${u(172)}; height: ${u(176)}; border-radius: ${u(10)}; border: ${u(5)} solid #24252e; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: ${u(6)} ${u(4)}; line-height: 1;
  box-shadow: inset 0 0 0 ${u(4)} rgba(255,255,255,0.35); }
#hud .pr-prize.skin { background: radial-gradient(circle at 50% 50%, #ffd6f4, #ff5f9a 70%); }
#hud .pr-prize.charm { background: radial-gradient(circle at 50% 50%, #fff6c0, #ffa21a 70%); }
#hud .pr-prize.slot { background: radial-gradient(circle at 50% 50%, #e6c8ff, #9a3df0 70%); }
#hud .pr-prize .hd { font-size: ${u(25)}; -webkit-text-stroke: 0.18em #15151f; white-space: nowrap; }
#hud .pr-prize .ico { flex: 1; width: 70%; display: grid; place-items: center; }
#hud .pr-prize .ico svg { width: 100%; height: 100%; max-height: ${u(90)}; filter: drop-shadow(0 ${u(3)} 0 rgba(0,0,0,0.3)); }
#hud .pr-prize .nm { font-size: ${u(19)}; text-align: center; -webkit-text-stroke: 0.2em #15151f; }
#hud .pr-reset, #hud .pr-keep { margin: ${u(8)} 0 0; font-size: ${u(32)}; line-height: 1.1; text-align: center; color: #ff3d6a; -webkit-text-stroke: 0.18em #15151f; }
#hud .pr-keep { margin: ${u(2)} 0 ${u(10)}; font-size: ${u(24)}; color: #7dff3a; }
#hud .pr-barwrap { position: relative; margin: 0 ${u(22)} 0 ${u(70)}; }
#hud .pr-barwrap .rb-bar { margin: 0; }
#hud .pr-barwrap .rb-bar .fill { background: linear-gradient(#ffe46b, #ffb800); }
#hud .pr-barwrap .rb-bar .lbl { left: ${u(96)}; }
#hud .pr-barwrap .bico { position: absolute; left: ${u(-30)}; top: 50%; transform: translateY(-50%) rotate(-8deg); width: ${u(96)}; height: ${u(96)}; z-index: 1; }
#hud .pr-barwrap .bico svg { width: 100%; height: 100%; filter: drop-shadow(0 ${u(3)} 0 rgba(0,0,0,0.3)); }
#hud .pr-go.ready { background-color: #b44cf0; ${STUDS('rgba(60,0,110,0.18)', 'rgba(255,255,255,0.14)')} box-shadow: inset 0 0 0 ${u(4)} #dc9bff, inset 0 ${u(-8)} 0 rgba(60,0,110,0.3); animation: rbpulse 1.2s ease-in-out infinite; }
#hud .pr-go.sure { background-color: #e8243a; box-shadow: inset 0 0 0 ${u(4)} #ff8c94; animation: none; }
#hud .pr-go.sure .t { font-size: ${u(46)}; }
#hud .rb-win.portrait .pr-cols { grid-template-columns: 1fr; }
#hud .rb-win.portrait .pr-arrow { height: ${u(60)}; }
#hud .rb-win.portrait .pr-arrow svg { transform: rotate(90deg); }
#hud .rb-win.portrait .pr-prizes { flex-wrap: wrap; }
#hud .rb-win.portrait .pr-plbl { width: 100%; }

/* Upgrades: the rebirth count, the hint, and a scrolling 2-column card grid (1 column in portrait). */
#hud .up-head { display: flex; align-items: center; gap: ${u(40)}; margin: ${u(-10)} 0 ${u(18)}; }
#hud .up-count { flex: none; width: ${u(420)}; height: ${u(66)}; border-radius: ${u(12)}; border: ${u(5)} solid #24252e; display: flex; align-items: center; justify-content: center; gap: ${u(8)}; font-size: ${u(46)}; line-height: 1;
  background-color: #2ea4f6; ${STUDS('rgba(0,40,120,0.16)', 'rgba(255,255,255,0.14)')} box-shadow: inset 0 0 0 ${u(4)} #7fd2ff; }
#hud .up-count svg { width: ${u(58)}; height: ${u(58)}; }
#hud .up-hint { flex: 1; font-size: ${u(32)}; line-height: 1.1; text-align: center; -webkit-text-stroke: 0.18em #15151f; }
#hud .up-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${u(24)}; max-height: ${u(520)}; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; padding: ${u(4)} ${u(14)} ${u(4)} ${u(4)}; }
#hud .up-grid::-webkit-scrollbar { width: ${u(12)}; }
#hud .up-grid::-webkit-scrollbar-thumb { background: #8e94a0; border-radius: ${u(6)}; }
#hud .up-card { position: relative; height: ${u(244)}; border-radius: ${u(22)}; border: ${u(5)} solid #24252e; padding: ${u(26)} ${u(180)} ${u(20)} ${u(150)}; display: flex; flex-direction: column; justify-content: space-between; line-height: 1; }
#hud .up-card.blue { background-color: #2ea4f6; ${STUDS('rgba(0,40,120,0.16)', 'rgba(255,255,255,0.14)')} box-shadow: inset 0 0 0 ${u(5)} #7fd2ff; }
#hud .up-card.gold { background-color: #ffc928; ${STUDS('rgba(170,100,0,0.18)', 'rgba(255,240,170,0.5)')} box-shadow: inset 0 0 0 ${u(5)} #ffe27a; }
#hud .up-card.purple { background-color: #b44cf0; ${STUDS('rgba(60,0,110,0.18)', 'rgba(255,255,255,0.14)')} box-shadow: inset 0 0 0 ${u(5)} #dc9bff; }
#hud .up-card.orange { background-color: #ff9a1a; ${STUDS('rgba(150,60,0,0.18)', 'rgba(255,220,150,0.3)')} box-shadow: inset 0 0 0 ${u(5)} #ffc46b; }
#hud .up-card.green { background-color: #3fcf3a; ${STUDS('rgba(0,60,0,0.16)', 'rgba(255,255,255,0.18)')} box-shadow: inset 0 0 0 ${u(5)} #8cff6e; }
#hud .up-card.pink { background-color: #e04cf0; ${STUDS('rgba(110,0,120,0.16)', 'rgba(255,255,255,0.16)')} box-shadow: inset 0 0 0 ${u(5)} #ffa8ff; }
#hud .up-card .ico { position: absolute; left: ${u(8)}; top: 50%; transform: translateY(-50%); width: ${u(140)}; height: ${u(160)}; }
#hud .up-card .ico svg { width: 100%; height: 100%; filter: drop-shadow(0 ${u(4)} 0 rgba(0,0,0,0.3)); }
#hud .up-card .nm { font-size: ${u(44)}; -webkit-text-stroke: 0.16em #15151f; white-space: nowrap; }
#hud .up-card .fx { font-size: ${u(30)}; -webkit-text-stroke: 0.18em #15151f; white-space: nowrap; }
#hud .up-card .fx .nx { color: #7dff3a; }
#hud .up-card .pips { display: flex; align-items: center; gap: ${u(4)}; }
#hud .up-card .pips i { width: ${u(20)}; height: ${u(36)}; border-radius: ${u(10)}; border: ${u(3)} solid #15151f; background: rgba(0,0,0,0.3); }
#hud .up-card .pips i.on { background: linear-gradient(#fff27a, #ffc21a); }
#hud .up-card .pips .cnt { margin-left: ${u(8)}; font-size: ${u(34)}; color: #ffe02a; -webkit-text-stroke: 0.2em #15151f; }
#hud .up-go { position: absolute; right: ${u(16)}; top: 50%; transform: translateY(-50%); width: ${u(150)}; height: ${u(120)}; border-radius: ${u(12)}; border: ${u(5)} solid #24252e; display: flex; align-items: center; justify-content: center; gap: ${u(4)};
  font-size: ${u(50)}; line-height: 1; background: #3e6aa8; box-shadow: inset 0 0 0 ${u(4)} #6f95cc, inset 0 ${u(-8)} 0 rgba(0,0,0,0.2); transition: transform .1s, filter .1s; }
#hud .up-go svg { width: ${u(76)}; height: ${u(76)}; filter: drop-shadow(0 ${u(2)} 0 rgba(0,0,0,0.3)); }
#hud .up-go.ready { background-color: #4bdc3a; ${STUDS('rgba(0,60,0,0.16)', 'rgba(255,255,255,0.18)')} box-shadow: inset 0 0 0 ${u(4)} #8cff6e, inset 0 ${u(-8)} 0 rgba(0,90,0,0.25); animation: uppulse 1.2s ease-in-out infinite; }
@keyframes uppulse { 0%, 100% { transform: translateY(-50%) scale(1) } 50% { transform: translateY(-50%) scale(1.06) } }
#hud .up-go:hover { filter: brightness(1.08); }
#hud .up-go.max { background-color: #c9ccd4; ${STUDS('rgba(60,66,84,0.12)', 'rgba(255,255,255,0.45)')} box-shadow: inset 0 0 0 ${u(4)} #eceef2; font-size: ${u(30)}; cursor: default; }
#hud .rb-win.portrait .up-head { flex-direction: column; gap: ${u(12)}; }
#hud .rb-win.portrait .up-grid { grid-template-columns: minmax(0, 1fr); max-height: ${u(1000)}; }
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
// World card pictures (Worlds tab), keyed by a world's `art`: Hairy Heights (sea, voxel pillars, a hair
// cable), Wonder Worlds (lava cave) and the mystery world (night castle and rainbow).
const voxel = (x, y, w, h, side, top) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${side}" stroke="#24252e" stroke-width="2.5"/><rect x="${x}" y="${y}" width="${w}" height="9" fill="${top}" stroke="#24252e" stroke-width="2.5"/>`
const WORLD_ART = {
  heights: `<svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="wa1s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cc8ff"/><stop offset="1" stop-color="#d6f3ff"/></linearGradient><linearGradient id="wa1w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2bb4f0"/><stop offset="1" stop-color="#0a62b8"/></linearGradient></defs>
    <rect width="300" height="200" fill="url(#wa1s)"/><ellipse cx="70" cy="34" rx="34" ry="11" fill="#fff" opacity="0.9"/><ellipse cx="226" cy="22" rx="28" ry="9" fill="#fff" opacity="0.85"/>
    ${voxel(196, 72, 26, 40, '#d9733a', '#ff9a52')}${voxel(222, 60, 30, 52, '#c8602e', '#ff8a44')}${voxel(252, 80, 48, 32, '#7f8794', '#b8bfca')}
    <rect y="104" width="300" height="96" fill="url(#wa1w)"/><path d="M90 128q10-5 20 0t20 0M170 160q10-5 20 0t20 0M24 176q10-5 20 0t20 0" fill="none" stroke="#bff0ff" stroke-width="3" stroke-linecap="round"/>
    ${voxel(0, 86, 74, 114, '#8a5a30', '#5fd13a')}${voxel(126, 118, 34, 82, '#6e7684', '#aab2be')}${voxel(176, 134, 34, 66, '#6e7684', '#aab2be')}${voxel(228, 112, 34, 88, '#6e7684', '#aab2be')}
    <path d="M140 170l14-20 6 20z" fill="#7f8a9a" stroke="#24252e" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M44 84Q140 40 248 58" fill="none" stroke="#5a3200" stroke-width="9" stroke-linecap="round"/><path d="M44 84Q140 40 248 58" fill="none" stroke="#ffd21a" stroke-width="5" stroke-linecap="round"/>
    <circle cx="160" cy="52" r="9" fill="#ffd9b0" stroke="#24252e" stroke-width="2.5"/><path d="M152 60l-6 16h28l-6-16z" fill="#ff5fb4" stroke="#24252e" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  wonder: `<svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="wa2s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1210"/><stop offset="1" stop-color="#7a2a14"/></linearGradient><linearGradient id="wa2l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb21a"/><stop offset="1" stop-color="#e8361a"/></linearGradient></defs>
    <rect width="300" height="200" fill="url(#wa2s)"/><circle cx="150" cy="70" r="46" fill="#8a3a1a" opacity="0.55"/><path d="M128 64q6-8 12 0M160 64q6-8 12 0M132 86q18 14 36 0" fill="none" stroke="#3a1210" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
    <rect x="40" y="0" width="14" height="140" fill="#ff7a1a" opacity="0.75"/><rect x="246" y="0" width="12" height="140" fill="#ff7a1a" opacity="0.75"/>
    <rect y="140" width="300" height="60" fill="url(#wa2l)"/><circle cx="70" cy="168" r="6" fill="#ffe27a"/><circle cx="210" cy="180" r="5" fill="#ffe27a"/>
    ${voxel(0, 104, 60, 96, '#3a2a28', '#5a4440')}${voxel(92, 134, 40, 66, '#3a2a28', '#5a4440')}${voxel(170, 120, 40, 80, '#3a2a28', '#5a4440')}${voxel(240, 100, 60, 100, '#3a2a28', '#5a4440')}</svg>`,
  mystery: `<svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="wa3s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a6a"/><stop offset="1" stop-color="#6a4ab0"/></linearGradient></defs>
    <rect width="300" height="200" fill="url(#wa3s)"/><circle cx="40" cy="30" r="2" fill="#fff"/><circle cx="110" cy="18" r="1.5" fill="#fff"/><circle cx="250" cy="40" r="2" fill="#fff"/><circle cx="200" cy="14" r="1.5" fill="#fff"/>
    <path d="M150 170a110 110 0 0 1 150-90" fill="none" stroke="#ff5a5a" stroke-width="7" opacity="0.7"/><path d="M160 172a104 104 0 0 1 140-82" fill="none" stroke="#ffd21a" stroke-width="7" opacity="0.7"/><path d="M170 174a98 98 0 0 1 130-74" fill="none" stroke="#4be03a" stroke-width="7" opacity="0.7"/><path d="M180 176a92 92 0 0 1 120-66" fill="none" stroke="#3aa0ff" stroke-width="7" opacity="0.7"/>
    <path d="M60 150V80l12-18 12 18v20h14V64l16-26 16 26v36h14V80l12-18 12 18v70z" fill="#3a2a7a" stroke="#1a103a" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="114" cy="158" rx="80" ry="18" fill="#4a3a8a"/><path d="M50 160q64 40 128 0" fill="#2a1a5a"/><path d="M200 150l10-20 10 20z" fill="#7fe8ff" opacity="0.8"/></svg>`,
}
// White chevron with a dark outline (the Before -> After arrows).
const CHEVRON_ICON = `<svg viewBox="0 0 44 56"><path d="M12 8l20 20-20 20" fill="none" stroke="#15151f" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8l20 20-20 20" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
// Five-point star path round (cx, cy), outer radius R, inner r.
const starPath = (cx, cy, R, r) => Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 - Math.PI / 2
  const d = i % 2 ? r : R
  return `${i ? 'L' : 'M'}${(cx + Math.cos(a) * d).toFixed(1)} ${(cy + Math.sin(a) * d).toFixed(1)}`
}).join('') + 'z'
// Gold star with a pink gem and white wings (Prestige).
const PRESTIGE_ICON = (() => {
  const wing = 'M40 50C26 30 8 28 4 34c6 2 8 5 8 8-5 0-8 3-8 6 6 0 9 2 10 5-4 2-5 5-4 8 10-2 22-6 30-11z'
  const sparkle = (x, y, s) => `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}z" fill="#fff" stroke="#24252e" stroke-width="1.5"/>`
  return `<svg viewBox="0 0 120 100"><path d="${wing}" fill="#fff" stroke="#24252e" stroke-width="3.5" stroke-linejoin="round"/><path d="${wing}" transform="matrix(-1 0 0 1 120 0)" fill="#fff" stroke="#24252e" stroke-width="3.5" stroke-linejoin="round"/><path d="M12 40c6 1 12 4 18 8M12 54c6 0 12-1 18-3" transform="matrix(-1 0 0 1 120 0)" fill="none" stroke="#c9d8ff" stroke-width="2.5" stroke-linecap="round"/><path d="M12 40c6 1 12 4 18 8M12 54c6 0 12-1 18-3" fill="none" stroke="#c9d8ff" stroke-width="2.5" stroke-linecap="round"/><path d="${starPath(60, 54, 38, 17)}" fill="#ffd21a" stroke="#24252e" stroke-width="4" stroke-linejoin="round"/><path d="${starPath(60, 54, 30, 13)}" fill="none" stroke="#fff27a" stroke-width="2.5" stroke-linejoin="round"/><circle cx="60" cy="56" r="10" fill="#ff3dc8" stroke="#5a0a3a" stroke-width="3"/><circle cx="57" cy="53" r="3" fill="#ffc8f0"/>${sparkle(100, 16, 8)}${sparkle(22, 86, 6)}</svg>`
})()
// Green up arrow over a chevron (Upgrades).
const UPGRADES_ICON = `<svg viewBox="0 0 64 64"><path d="M32 4 56 30H42v12H22V30H8z" fill="#3fdc3a" stroke="#0d4a0a" stroke-width="3.5" stroke-linejoin="round"/><path d="M32 10 48 27" stroke="#b6ff7a" stroke-width="3.5" stroke-linecap="round"/><path d="M14 52 32 42l18 10v8L32 50 14 60z" fill="#3fdc3a" stroke="#0d4a0a" stroke-width="3.5" stroke-linejoin="round"/></svg>`
// Upgrade card art: sleeping moon in a nightcap, the cable's T-handle on a gold rope, a four-leaf clover, a winged sneaker.
const MOON_ICON = `<svg viewBox="0 0 64 64"><path d="M30 10a24 24 0 1 0 26 30A20 20 0 0 1 30 10z" fill="#ffe04a" stroke="#5a3a00" stroke-width="3" stroke-linejoin="round"/><path d="M22 36q3 3 6 0M34 44q3 3 6 0" fill="none" stroke="#5a3a00" stroke-width="2.6" stroke-linecap="round"/><path d="M14 22c4-12 16-16 24-12l8-6c-1 6 0 10 4 12-8-2-22 0-36 6z" fill="#4a8cff" stroke="#14244a" stroke-width="2.6" stroke-linejoin="round"/><circle cx="52" cy="16" r="4.5" fill="#fff" stroke="#14244a" stroke-width="2.4"/><text x="50" y="40" font-family="Fredoka, sans-serif" font-weight="700" font-size="14" fill="#5fd8ff" stroke="#14244a" stroke-width="3" paint-order="stroke">z</text><text x="56" y="30" font-family="Fredoka, sans-serif" font-weight="700" font-size="10" fill="#5fd8ff" stroke="#14244a" stroke-width="2.5" paint-order="stroke">z</text></svg>`
const ZIP_ICON = `<svg viewBox="0 0 64 64"><path d="M2 16c10 4 20 6 30 6s20-2 30-6" fill="none" stroke="#5a3200" stroke-width="9" stroke-linecap="round"/><path d="M2 16c10 4 20 6 30 6s20-2 30-6" fill="none" stroke="#ffd21a" stroke-width="5" stroke-linecap="round" stroke-dasharray="6 3"/><circle cx="32" cy="22" r="7" fill="#ffc21a" stroke="#5a3200" stroke-width="3"/><path d="M32 28v18" stroke="#5a0a0a" stroke-width="10" stroke-linecap="round"/><path d="M32 28v18" stroke="#e8243a" stroke-width="5" stroke-linecap="round"/><rect x="10" y="44" width="44" height="12" rx="6" fill="#e8243a" stroke="#5a0a0a" stroke-width="3"/><path d="M4 30h12M2 38h10" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`
const CLOVER_ICON = (() => {
  const leaf = (r) => `<path d="M32 32C20 30 14 18 22 12s12 4 10 20z" transform="rotate(${r} 32 32)" fill="#3fdc3a" stroke="#0d4a0a" stroke-width="3" stroke-linejoin="round"/>`
  return `<svg viewBox="0 0 64 64"><path d="M32 34c2 10 6 18 14 24" fill="none" stroke="#0d4a0a" stroke-width="7" stroke-linecap="round"/><path d="M32 34c2 10 6 18 14 24" fill="none" stroke="#3fdc3a" stroke-width="3.5" stroke-linecap="round"/>${[0, 90, 180, 270].map((r) => leaf(r + 45)).join('')}<path d="M54 6l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ffd21a" stroke="#5a3200" stroke-width="1.5"/></svg>`
})()
const SHOE_ICON = `<svg viewBox="0 0 64 64"><path d="M6 30c4-10 10-14 16-12-4 2-6 6-6 8 4-6 10-8 14-6-4 2-6 6-6 8z" fill="#fff" stroke="#24252e" stroke-width="2.6" stroke-linejoin="round"/><path d="M14 40c4-8 10-12 18-12 6 6 14 8 22 10 6 2 8 6 6 10H14z" fill="#e8243a" stroke="#5a0a0a" stroke-width="3" stroke-linejoin="round"/><path d="M12 48h50v4a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z" fill="#fff" stroke="#24252e" stroke-width="3"/><path d="M30 32l6 4M34 30l6 4M38 29l5 4" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M2 42h8M0 50h8" stroke="#c9d8ff" stroke-width="3" stroke-linecap="round"/></svg>`
const BIG_X_ICON = `<svg viewBox="0 0 40 40"><path d="M9 9l22 22M31 9 9 31" stroke="#15151f" stroke-width="13" stroke-linecap="round"/><path d="M9 9l22 22M31 9 9 31" stroke="#fff" stroke-width="7" stroke-linecap="round"/></svg>`

// Golden S-shaped lock of hair with a pink bead (the HUD currency icon).
const HAIR_ICON = `<svg viewBox="0 0 48 48"><defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe86b"/><stop offset="1" stop-color="#f5a00c"/></linearGradient></defs><path d="M31 3c-10-1-19 4-19 12 0 7 7 10 12 13 4 2 6 5 3 8-3 2-8 2-12-1 1 6 8 9 14 8 8-2 11-8 9-14-2-5-8-8-12-10-4-2-4-5-1-7 3-2 8-1 12 1 1-5-2-9-6-10z" fill="url(#hg)" stroke="#5a3200" stroke-width="2.6" stroke-linejoin="round"/><path d="M17 13c1-3 5-5 9-5M27 31c2 1 2 3 1 5" fill="none" stroke="#fff6c0" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="40" r="4" fill="#ff5fb4" stroke="#5a0a3a" stroke-width="2"/></svg>`
// Red / blue swap arrows (rebirths), the Clean Leaves for Loot icon. An <svg> wrapper so it sizes
// like the other inline icons.
const REBIRTH_ICON = `<svg viewBox="0 0 64 64"><image href="${import.meta.env.BASE_URL}UI/rebirth.png" width="64" height="64"/></svg>`
// Gold trophy (wins).
const TROPHY_ICON = `<svg viewBox="0 0 64 64"><path d="M16 8h32v16c0 10-7 18-16 18S16 34 16 24z" fill="#ffd21a" stroke="#5a3200" stroke-width="3" stroke-linejoin="round"/><path d="M16 12H8v6c0 7 5 12 10 12M48 12h8v6c0 7-5 12-10 12" fill="none" stroke="#5a3200" stroke-width="3"/><path d="M10 14h6v10c-3-1-6-4-6-8zM54 14h-6v10c3-1 6-4 6-8z" fill="#ffb000"/><path d="M28 42h8v8h-8z" fill="#ffb000" stroke="#5a3200" stroke-width="3"/><rect x="18" y="50" width="28" height="8" rx="2" fill="#ffd21a" stroke="#5a3200" stroke-width="3"/><path d="M24 14c0 6 2 10 5 13" fill="none" stroke="#fff6c0" stroke-width="3" stroke-linecap="round"/></svg>`
// Green hexagon with a white rounded square (the premium currency).
const ROBUX_ICON = `<svg viewBox="0 0 64 64"><path d="M32 3 57 17.5v29L32 61 7 46.5v-29z" fill="#2fcf6a" stroke="#0b5a28" stroke-width="3" stroke-linejoin="round"/><rect x="20" y="20" width="24" height="24" rx="4" fill="#fff" transform="rotate(10 32 32)"/><rect x="26" y="26" width="12" height="12" rx="2" fill="#2fcf6a" transform="rotate(10 32 32)"/></svg>`
// Red backpack with white buckles.
const BACKPACK_ICON = `<svg viewBox="0 0 64 64"><path d="M24 12a8 8 0 0 1 16 0" fill="none" stroke="#4a0a0a" stroke-width="4" stroke-linecap="round"/><rect x="4" y="22" width="9" height="24" rx="3" fill="#c81e1e" stroke="#4a0a0a" stroke-width="3"/><rect x="51" y="22" width="9" height="24" rx="3" fill="#c81e1e" stroke="#4a0a0a" stroke-width="3"/><rect x="11" y="12" width="42" height="47" rx="11" fill="#f0302a" stroke="#4a0a0a" stroke-width="3"/><path d="M11 26c8 4 34 4 42 0" fill="none" stroke="#4a0a0a" stroke-width="3"/><path d="M15 20c3-4 8-5 12-5" fill="none" stroke="#ff8a7a" stroke-width="3" stroke-linecap="round"/><rect x="17" y="35" width="30" height="18" rx="5" fill="#d42020" stroke="#4a0a0a" stroke-width="3"/><rect x="21" y="29" width="7" height="12" rx="2" fill="#eef0f6" stroke="#4a0a0a" stroke-width="2.5"/><rect x="36" y="29" width="7" height="12" rx="2" fill="#eef0f6" stroke="#4a0a0a" stroke-width="2.5"/></svg>`
// Blue swirl portal in a violet ring.
const PORTAL_ICON = `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="32" rx="23" ry="27" fill="#8a4dff" stroke="#2a0a5a" stroke-width="3"/><ellipse cx="32" cy="32" rx="17" ry="21" fill="#4a7bff"/><ellipse cx="32" cy="32" rx="12" ry="15" fill="#6fd8ff"/><path d="M32 13c11 1 15 11 9 17s-17 4-15 12 11 7 11 7M22 22c-3 4-3 9 0 12" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="32" cy="32" rx="4" ry="5.5" fill="#2a2aa8"/><circle cx="12" cy="18" r="2.5" fill="#ff8aff"/><circle cx="53" cy="47" r="2.5" fill="#ff8aff"/></svg>`
// Gift box (the Starter Pack).
const giftIcon = (box, dark) => `<svg viewBox="0 0 64 64"><rect x="8" y="26" width="48" height="32" rx="4" fill="${box}" stroke="${dark}" stroke-width="3"/><rect x="4" y="16" width="56" height="14" rx="4" fill="${box}" stroke="${dark}" stroke-width="3"/><rect x="26" y="16" width="12" height="42" fill="#ffd21a" stroke="${dark}" stroke-width="3"/><path d="M32 16c-2-8-14-12-14-4 0 5 8 5 14 4zM32 16c2-8 14-12 14-4 0 5-8 5-14 4z" fill="#ffd21a" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/></svg>`
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
export { BIG_X_ICON, HAIR_ICON, HAIRSTYLE_ICON, PADLOCK_ICON, PRESTIGE_ICON, REBIRTH_ICON, ROBUX_ICON, TROPHY_ICON, formatNumber }

// Level packs along the bottom and the two offers on the right. They cost Wins (see the shop offers in state.js).
const { LEVEL_PACKS, STARTER_PACK, X2_HAIR } = game

const el = (tag, cls, html = '') => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  e.innerHTML = html
  return e
}
const price = (n) => `<span class="hud-price stroke">${TROPHY_ICON}${n}</span>`
const packHtml = (p, i) => `<span class="ico">${HAIR_ICON}</span><span class="lv stroke">+${p.levels} LV</span><span class="amt stroke">+${formatNumber(p.hair)}</span>${price(p.price)}`
const packButtons = () => LEVEL_PACKS.map((p, i) => `<button class="hud-pack studs ${p.color}" data-pack="${i}">${packHtml(p, i)}</button>`).join('')
const clockText = (ms) => {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s % 60).padStart(2, '0')}`
}

// Teleport window: `world` is its header name, `stages` [{ level, wins, spot? }]
// in order (a stage without a spot is "Coming Soon"), `worlds` [{ name, spot?, prestige?, art? }]
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

  const quest = el('div', 'hud-quest', `<button class="skip">Skip</button><div class="tag stroke">TUTORIAL</div><div class="badge stroke">1/6</div><div class="lines"><div class="text stroke"></div><div class="hint"></div></div>`)
  root.appendChild(quest)

  // --- Left: counters + button grid
  const left = el('div', 'hud-left', `
    <div class="hud-cur rebirths"><span class="wrap">${REBIRTH_ICON}</span><span class="n stroke">0</span></div>
    <div class="hud-cur wins"><span class="wrap">${TROPHY_ICON}<button class="plus stroke" title="Get more Wins">+</button></span><span class="n stroke">0</span></div>
    <div class="hud-grid">
      <button class="hud-tile studs backpack">${BACKPACK_ICON}<span class="lbl stroke">Backpack</span></button>
      <button class="hud-tile studs rebirth">${REBIRTH_ICON}<span class="lbl stroke">REBIRTH!</span><span class="bang">!</span></button>
      <button class="hud-tile studs teleport">${PORTAL_ICON}<span class="lbl stroke">Teleport</span></button>
      <button class="hud-tile studs hair">${HAIRSTYLE_ICON}<span class="lbl stroke">Hair</span></button>
    </div>`)
  root.appendChild(left)

  // --- Bottom: hair counter, level bar, level packs
  const bottom = el('div', 'hud-bottom')
  const hair = el('div', 'hud-hair', `<span class="cnt">${HAIR_ICON}<span class="n stroke">0</span><span class="hud-boost stroke"></span></span><span class="rb">${REBIRTH_ICON}<span class="pct stroke">+0%</span></span>`)
  const level = el('div', 'hud-level', `<div class="fill"></div><span class="lv stroke">Level 1</span><span class="xp stroke">0/12</span>`)
  const packs = el('div', 'hud-packs', packButtons())
  const cableBar = el('div', 'hud-cable', `<div class="fill"></div><span class="len stroke"></span>`) // remaining hair length while the cable is out
  bottom.append(hair, cableBar, level, packs)
  root.appendChild(bottom)

  // --- Right: Starter Pack + x2 Hair
  const right = el('div', 'hud-right', `
    <button class="hud-starter"><span class="title stroke">Starter Pack</span>${STARTER_ICON}
      <span class="rewards"><span class="stroke">${HAIR_ICON}+${formatNumber(STARTER_PACK.hair)}</span><span class="stroke">${TROPHY_ICON}+${STARTER_PACK.wins}</span></span>
      ${price(STARTER_PACK.price)}</button>
    <button class="hud-x2"><span class="in">${HAIR_ICON}<span class="stroke">x2 Hair</span></span></button>
    <span class="hud-only stroke">ONLY ${TROPHY_ICON}${X2_HAIR.price}</span>`)
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
  const shopPanel = panel('wide', `<h2 class="stroke">🛒 Shop</h2><div class="hud-shop"></div><p class="hud-empty">Spend your Wins on boosts and level packs.</p>`)
  const backpackPanel = panel('wide', `<h2 class="stroke">🎒 Backpack</h2><div class="hud-list"></div>`)
  // Rebirth window: the renderer fills the Before / After columns.
  const rbCol = (side, title) => `<div class="rb-col rb-${side}"><h3 class="stroke">${title}</h3>
    <div class="rb-card blue"><span class="ico">${HAIR_ICON}</span><span class="big stroke"></span></div>
    <div class="rb-card blue"><span class="ico rb">${REBIRTH_ICON}</span><span class="num stroke"></span><span class="sub stroke"></span></div>
    <div class="rb-card gold"><span class="ico">${stageIcon('', true)}</span><span class="num stroke"></span><span class="sub stroke"></span></div></div>`
  const rbTab = (id, icon, name) => `<button class="rb-tab ${id}" data-tab="${id}">${icon}<span class="stroke">${name}</span><span class="bang stroke">!</span></button>`
  const prCard = (side, title, color) => `<div class="rb-col pr-${side}"><h3 class="stroke">${title}</h3>
    <div class="pr-card ${color}"><span class="ico">${PRESTIGE_ICON}</span><span class="big stroke"></span><span class="sub stroke"></span></div></div>`
  const rebirthPanel = el('div', 'rb-win', `
    <div class="rb-tabs">${rbTab('rebirth', REBIRTH_ICON, 'Rebirth')}${rbTab('prestige', PRESTIGE_ICON, 'Prestige')}${rbTab('upgrades', UPGRADES_ICON, 'Upgrades')}</div>
    <div class="rb-body">
      <span class="rb-badge"></span>
      <h2 class="rb-title stroke">Rebirth</h2>
      <button class="rb-x hud-close" title="Close">${BIG_X_ICON}</button>
      <div class="rb-pane prestige">
        <div class="pr-cols">${prCard('before', 'Before', 'gold')}<div class="pr-arrow">${CHEVRON_ICON}</div>${prCard('after', 'After', 'pink')}</div>
        <div class="pr-prizes"></div>
        <p class="pr-reset stroke">Resets: Hair, Wins, Rebirths, Upgrades, Treadmills, Skins &amp; Trails</p>
        <p class="pr-keep stroke">Keeps: charms, styles, auras, Shop boosts &amp; your day streak</p>
        <div class="pr-barwrap"><span class="bico">${REBIRTH_ICON}</span><div class="rb-bar"><div class="fill"></div><span class="lbl stroke"></span><span class="val stroke"></span></div></div>
        <div class="rb-btns"><button class="rb-btn pr-go"><span class="t stroke">Prestige Now!</span></button></div>
      </div>
      <div class="rb-pane upgrades">
        <div class="up-head"><span class="up-count">${REBIRTH_ICON}<span class="n stroke">0</span></span><span class="up-hint stroke">Upgrades level up as you Rebirth! Prestige resets them.</span></div>
        <div class="up-grid"></div>
      </div>
      <div class="rb-pane rebirth">
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
      </div>
      </div>
    </div>`)
  root.appendChild(rebirthPanel)
  let rbTabOpen = 'rebirth'
  let prestigeSure = false // the Prestige button asks once more before it resets everything
  // 1 reference px -> screen px, with the overhanging badge, close button and side tabs kept on screen. Portrait
  // uses the stacked layout (authored ~800 wide, ~1350 tall plus the tab row under it).
  const fitRebirth = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const portrait = h > w * 1.1
    rebirthPanel.classList.toggle('portrait', portrait)
    const k = portrait ? Math.min(1, (w - 16) / 860, (h - 16) / 1580) : Math.min(1, (w - 16) / 1780, (h - 16) / 880)
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
      <span class="tp-globe">${GLOBE_ICON}</span>
      <h2 class="tp-title stroke">Teleport</h2>
      <button class="tp-x hud-close" title="Close">${BIG_X_ICON}</button>
      <div class="tp-head"><span class="tp-world stroke"></span><span class="tp-wins">${TROPHY_ICON}<span class="n stroke">0</span></span><span class="tp-lv">${HAIR_ICON}<span class="n stroke">Lv 0</span></span></div>
      <div class="tp-list"></div>
      <div class="tp-worlds"></div>
    </div>`)
  root.appendChild(teleportPanel)
  let tpTab = 'stages'
  // Keep the window at the reference proportions: 1px of the 1920-wide layout, shrunk to fit. Portrait's Worlds
  // tab uses the stacked layout (authored 720 wide plus the side tabs, 1120 tall).
  const fitTeleport = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const portrait = h > w * 1.1 && tpTab === 'worlds'
    teleportPanel.classList.toggle('portrait', portrait)
    // The Worlds cards fit a shorter box (no stage list below them), so landscape can scale a bit larger there too.
    const k = portrait ? Math.min(1, (w - 16) / 900, (h - 16) / 1220) : Math.min(1, w / 1400, tpTab === 'worlds' ? (h - 16) / 740 : h / 800)
    teleportPanel.style.setProperty('--k', `${k}px`)
  }
  window.addEventListener('resize', fitTeleport)
  fitTeleport()
  const panels = [eventPanel, helpPanel, shopPanel, backpackPanel, rebirthPanel, teleportPanel]
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
  // Rebirth window panes. The prize row and the upgrade grid rebuild only when what they show changes, so the
  // pulsing buttons don't restart (and the grid keeps its scroll) on every hair step.
  const rbPane = (tab) => rebirthPanel.querySelector(`.rb-pane.${tab}`)
  const renderRebirth = () => {
    const s = game.state
    const pane = rbPane('rebirth')
    const need = game.rebirthLevel()
    const fill = (side, rebirths, rbSub, lv, lvSub) => {
      const col = pane.querySelector(`.rb-${side}`)
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
    pane.querySelector('.rb-bar .fill').style.width = `${Math.min(100, (s.level / need) * 100)}%`
    pane.querySelector('.rb-bar .val').textContent = `${Math.min(s.level, need)}/${need}`
    pane.querySelector('.rb-go').classList.toggle('ready', game.canRebirth())
  }
  const PRIZE_TILE = {
    skin: (p) => ({ hd: 'NEW SKIN', icon: colorIcon(game.HAIR_STYLES[p.id]), nm: game.HAIR_STYLES[p.id].name }),
    charm: (p) => ({ hd: 'CHARM', icon: charmIcon(CHARMS[p.id]), nm: CHARMS[p.id].name }),
    slot: () => ({ hd: '+1 SLOT', icon: TAB_ICONS.charms(), nm: 'Charm slot' }),
  }
  const renderPrestige = () => {
    const s = game.state
    const pane = rbPane('prestige')
    const p = s.prestige
    const card = (side, n, sub) => {
      const c = pane.querySelector(`.pr-${side}`)
      c.querySelector('.big').textContent = `x${game.prestigeMultiplier(n)} Hair`
      c.querySelector('.sub').textContent = sub
    }
    card('before', p, `x${game.prestigeMultiplier(p)} Wins`)
    card('after', p + 1, `x${game.prestigeMultiplier(p + 1)} Wins FOREVER!`)
    set('prPrizes', p, () => {
      const prizes = game.prestigePrizes(p + 1)
      pane.querySelector('.pr-prizes').innerHTML = `<span class="pr-plbl stroke">Prestige ${p + 1}${prizes.length ? ' prizes:' : `: x${game.prestigeMultiplier(p + 1)} Hair &amp; Wins!`}</span>` +
        prizes.map((it) => {
          const t = PRIZE_TILE[it.kind](it)
          return `<span class="pr-prize ${it.kind}"><span class="hd">${t.hd}</span><span class="ico">${t.icon}</span><span class="nm">${t.nm}</span></span>`
        }).join('')
    })
    const need = game.prestigeRebirths()
    pane.querySelector('.rb-bar .fill').style.width = `${Math.min(100, (s.rebirths / need) * 100)}%`
    pane.querySelector('.rb-bar .lbl').textContent = `Rebirths ${formatNumber(s.rebirths)}`
    pane.querySelector('.rb-bar .val').textContent = `${Math.min(s.rebirths, need)}/${need}`
    const go = pane.querySelector('.pr-go')
    const ready = game.canPrestige()
    if (!ready) prestigeSure = false
    go.classList.toggle('ready', ready)
    go.classList.toggle('sure', prestigeSure)
    go.querySelector('.t').textContent = prestigeSure ? 'Tap again to Prestige!' : 'Prestige Now!'
  }
  const UPGRADE_ICONS = { hair: HAIR_ICON, wins: TROPHY_ICON, sleepy: MOON_ICON, zippy: ZIP_ICON, lucky: CLOVER_ICON, feet: SHOE_ICON }
  // An upgrade's effect at `level` ("+250%", "+8h", "+12").
  const upgradeText = (up, level) => {
    const v = level * up.per
    return up.unit === '%' ? `+${Math.round(v * 100)}%` : `+${+v.toFixed(1)}${up.unit}`
  }
  const renderUpgrades = () => {
    const s = game.state
    const pane = rbPane('upgrades')
    pane.querySelector('.up-count .n').textContent = formatNumber(s.rebirths)
    set('upGrid', `${s.rebirths}|${JSON.stringify(s.upgrades)}`, () => {
      pane.querySelector('.up-grid').innerHTML = Object.entries(game.UPGRADES).map(([id, up]) => {
        const lv = game.upgradeLevel(id)
        const max = lv >= up.max
        const need = game.upgradeNeed(id)
        const fx = max ? `${upgradeText(up, lv)} ${up.what}` : `${upgradeText(up, lv)} → <span class="nx">${upgradeText(up, lv + 1)}</span> ${up.what}`
        const pips = Array.from({ length: up.max }, (_, i) => `<i${i < lv ? ' class="on"' : ''}></i>`).join('')
        const btn = max
          ? `<span class="up-go max stroke">MAX!</span>`
          : `<button class="up-go${game.canUpgrade(id) ? ' ready' : ''}" data-up="${id}" title="Needs ${need} Rebirths">${REBIRTH_ICON}<span class="stroke">${need}</span></button>`
        return `<div class="up-card ${up.color}"><span class="ico">${UPGRADE_ICONS[id]}</span><span class="nm stroke">${up.name}</span><span class="fx stroke">${fx}</span>
          <span class="pips">${pips}<span class="cnt stroke">${max ? 'MAX' : `${lv}/${up.max}`}</span></span>${btn}</div>`
      }).join('')
    })
  }
  const renderers = new Map([
    [shopPanel, () => {
      const sp = STARTER_PACK
      const f = game.state.flags
      shopPanel.querySelector('.hud-shop').innerHTML = packButtons() +
        `<button class="hud-pack studs red" data-offer="x2"><span class="lv stroke">Permanent boost</span><span class="amt stroke">x2 Hair</span>${f.x2 ? '<span class="hud-price stroke">OWNED</span>' : price(X2_HAIR.price)}</button>` +
        `<button class="hud-pack studs purple full" data-offer="starter"><span class="lv stroke">Starter Pack</span><span class="amt stroke">+${formatNumber(sp.hair)} Hair · +${sp.wins} Wins</span>${f.starter ? '<span class="hud-price stroke">CLAIMED</span>' : price(sp.price)}</button>`
    }],
    [backpackPanel, () => {
      const list = backpackPanel.querySelector('.hud-list')
      const styles = Object.entries(game.HAIR_STYLES).filter(([id]) => game.canEquip(id))
      list.innerHTML = styles.map(([id, st]) => hairRow(id, st)).join('')
    }],
    [rebirthPanel, () => {
      const tab = rbTabOpen
      rebirthPanel.dataset.tab = tab
      rebirthPanel.querySelectorAll('.rb-tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab))
      rebirthPanel.querySelector('.rb-tab.rebirth').classList.toggle('alert', game.canRebirth())
      rebirthPanel.querySelector('.rb-tab.prestige').classList.toggle('alert', game.canPrestige())
      rebirthPanel.querySelector('.rb-tab.upgrades').classList.toggle('alert', game.anyUpgradeReady())
      rebirthPanel.querySelector('.rb-title').textContent = { rebirth: 'Rebirth', prestige: 'Prestige', upgrades: 'Upgrades' }[tab]
      const badge = rebirthPanel.querySelector('.rb-badge')
      if (badge.dataset.tab !== tab) {
        badge.dataset.tab = tab
        badge.innerHTML = { rebirth: REBIRTH_ICON, prestige: PRESTIGE_ICON, upgrades: UPGRADES_ICON }[tab]
      }
      if (tab === 'prestige') renderPrestige()
      else if (tab === 'upgrades') renderUpgrades()
      else renderRebirth()
    }],
    [teleportPanel, () => {
      const s = game.state
      const here = currentStage()
      teleportPanel.querySelectorAll('.tp-tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tpTab))
      teleportPanel.classList.toggle('worlds', tpTab === 'worlds')
      fitTeleport()
      teleportPanel.querySelector('.tp-title').textContent = tpTab === 'stages' ? 'Teleport' : 'Worlds'
      if (tpTab === 'worlds') {
        // One card per world: the current one (green), one gated by Prestige (blue, padlocked until met), or unbuilt (grey).
        teleportPanel.querySelector('.tp-worlds').innerHTML = worlds.map((w, i) => {
          const need = w.prestige ?? 0
          const locked = s.prestige < need
          let cls, status, btn = ''
          if (i === 0) [cls, status, btn] = ['cur', 'Current world', `<span class="tp-wbtn here stroke">You are here!</span>`]
          else if (locked) [cls, status, btn] = ['lock', `Prestige ${formatNumber(s.prestige)} / ${formatNumber(need)} needed`, `<button class="tp-wbtn rb stroke" data-act="prestige">${PRESTIGE_ICON}GO PRESTIGE!</button>`]
          else if (w.spot) [cls, status, btn] = ['lock', 'Unlocked!', `<button class="tp-wbtn go stroke" data-act="go" data-world="${i}">TELEPORT</button>`]
          else [cls, status] = [need ? 'lock' : 'soon', 'Coming soon!']
          return `<div class="tp-card ${cls}">
            <span class="art">${WORLD_ART[w.art] ?? WORLD_ART.mystery}${locked ? `<span class="lock">${PADLOCK_ICON}</span>` : ''}</span>
            <span class="nm stroke">World ${i + 1}</span>
            <span class="sub stroke">${w.name}</span>
            <span class="st stroke">${status}</span>${btn}</div>`
        }).join('')
        return
      }
      teleportPanel.querySelector('.tp-world').textContent = world
      teleportPanel.querySelector('.tp-wins .n').textContent = formatNumber(s.wins)
      teleportPanel.querySelector('.tp-lv .n').textContent = `Lv ${s.level}`
      const you = `<span class="you stroke">YOU!</span>`
      teleportPanel.querySelector('.tp-list').innerHTML = stages.map((st, i) => {
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
  // Every offer buys with Wins; the HUD buttons open the Shop, and the Shop's buttons (and the pack bar) buy.
  const buy = (btn) => {
    if (!btn) return
    const { pack, offer } = btn.dataset
    let ok
    let msg
    if (pack != null) (ok = game.buyLevelPack(+pack)), (msg = `+${LEVEL_PACKS[+pack].levels} Levels!`)
    else if (offer === 'x2') {
      if (game.state.flags.x2) return api.toast('Already owned', '#ffb0b0')
      ok = game.buyX2Hair()
      msg = 'x2 Hair unlocked!'
    } else if (offer === 'starter') {
      if (game.state.flags.starter) return api.toast('Already claimed', '#ffb0b0')
      ok = game.buyStarterPack()
      msg = 'Starter Pack claimed!'
    }
    if (ok) {
      api.toast(msg, '#b6ff7a')
      renderOpen()
    } else api.toast('Not enough Wins!', '#ffb0b0')
  }
  for (const sel of ['.hud-cur.wins .plus', '.hud-starter', '.hud-x2']) q(sel).addEventListener('click', () => openPanel(shopPanel))
  packs.addEventListener('click', (e) => buy(e.target.closest('.hud-pack')))
  shopPanel.addEventListener('click', (e) => buy(e.target.closest('.hud-pack')))
  q('.hud-tile.backpack').addEventListener('click', () => openPanel(backpackPanel))
  q('.hud-tile.hair').addEventListener('click', () => {
    closePanels()
    onOpenSalon?.()
  })
  q('.hud-tile.rebirth').addEventListener('click', () => {
    prestigeSure = false
    openPanel(rebirthPanel)
  })
  q('.hud-tile.teleport').addEventListener('click', () => openPanel(teleportPanel))
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
  rebirthPanel.addEventListener('click', (e) => {
    const tab = e.target.closest('.rb-tab')?.dataset.tab
    if (tab) {
      rbTabOpen = tab
      prestigeSure = false
      return render(rebirthPanel)
    }
    const up = e.target.closest('[data-up]')?.dataset.up
    if (up) {
      if (!game.upgrade(up)) api.toast(`Need ${game.upgradeNeed(up)} Rebirths!`, '#ffb0b0')
      return
    }
    if (e.target.closest('.pr-go')) {
      if (!game.canPrestige()) return api.toast(`Need ${game.prestigeRebirths()} Rebirths!`, '#ffb0b0')
      if (!prestigeSure) {
        prestigeSure = true
        return render(rebirthPanel)
      }
      prestigeSure = false
      if (game.prestige()) closePanels()
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
    const act = e.target.closest('[data-act]')
    if (act?.dataset.act === 'prestige') {
      // Straight to the Rebirth window's Prestige tab.
      rbTabOpen = 'prestige'
      prestigeSure = false
      return openPanel(rebirthPanel)
    }
    if (act?.dataset.act === 'go') {
      const w = worlds[act.dataset.world]
      return go(w.spot, w.name)
    }
    const row = e.target.closest('.tp-row')
    if (!row) return
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
      set('canRebirth', game.canRebirth() || game.canPrestige() || game.anyUpgradeReady(), (ok) => q('.hud-tile.rebirth').classList.toggle('alert', ok))
      renderOpen()
    },
    // `opts.tutorial` switches the pill to the new-player tutorial look; `opts.hint` is a smaller second line.
    // Live counters in the text repaint it without replaying the pop, which only marks a new step.
    setQuest(index, total, text, { tutorial = false, hint = '' } = {}) {
      set('quest', `${tutorial}|${index}|${text}|${hint}`, () => {
        const done = index >= total
        quest.classList.toggle('done', done)
        quest.classList.toggle('tutorial', tutorial)
        quest.querySelector('.skip').textContent = tutorial ? 'Skip tutorial' : 'Skip'
        quest.querySelector('.badge').textContent = `${Math.min(index + 1, total)}/${total}`
        const safe = text.replace(/[<>&]/g, '')
        quest.querySelector('.text').innerHTML = safe.replace(/\*(.+?)\*/g, '<span class="hl">$1</span>')
        quest.querySelector('.hint').textContent = hint
        set('questStep', `${tutorial}|${index}`, () => {
          quest.classList.add('pop')
          setTimeout(() => quest.classList.remove('pop'), 250)
        })
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
      playSfx('hairGain')
      const p = el('div', 'hud-pop stroke')
      p.innerHTML = `<span class="hud-pop-ico">${HAIR_ICON}</span><span>${text}</span>`
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
