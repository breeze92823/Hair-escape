// The Hair Salon overlay (DOM, CSS-in-JS like hud.js): the HAIR SALON title, the
// Wins / Rebirths counters, six tabs down the left (Styles, Colors, Charms, Auras,
// Trails, Length), the camera bar (< - VIEW + >) under the player, and the panel on
// the right: header with the collection count, a scrolling card grid, and the
// detail box for the picked card with its Wear / Take off / Buy button.
//
// Laid out in reference pixels (the 1918x993 screenshots) scaled by --k. Portrait
// screens stack it instead: panel along the bottom, tabs in a row over it, camera
// bar over the tabs. `free` is the screen rect left for the 3D view; the salon camera
// centres and fits the player in it (salon.js).
import * as game from '../game/state.js'
import { AURAS, CHARMS, CUTS, LENGTH_MARKS, RARITY, SLOT_NAMES, TRAILS, rarityForBonus } from '../game/cosmetics.js'
import { HAIR, PLAYER_DIMS, RIG_HEIGHT } from '../config.js'
import { BIG_X_ICON, HAIR_ICON, HAIRSTYLE_ICON, PADLOCK_ICON, PRESTIGE_ICON, REBIRTH_ICON, TROPHY_ICON, formatNumber } from '../hud.js'
import {
  ARROW_LEFT, ARROW_RIGHT, BOOK_ICON, CHECK_ICON, FLAME_ICON, HEART_ICON, MINUS_ICON, PLUS_ICON, STAR_TAG_ICON, TAB_ICONS,
  auraIcon, charmIcon, colorIcon, cutIcon, trailIcon,
} from './icons.js'

export const TABS = [
  { id: 'styles', name: 'Styles', title: 'Hairstyles', kind: 'cut', color: '#c24cf0', light: '#e7a2ff' },
  { id: 'colors', name: 'Colors', title: 'Hair Colors', color: '#ff9a1a', light: '#ffd08a' },
  { id: 'charms', name: 'Charms', title: 'Hair Charms', kind: 'charm', color: '#a24cf0', light: '#d6a2ff' },
  { id: 'auras', name: 'Auras', title: 'Auras', kind: 'aura', color: '#2f8ff0', light: '#8ccaff' },
  { id: 'trails', name: 'Trails', title: 'Trails', kind: 'trail', color: '#36c21c', light: '#9cf07e' },
  { id: 'length', name: 'Length', title: 'Hair Length', color: '#ffbe14', light: '#ffe27a' },
]

const REF_W = 1918 // px, the landscape reference
const REF_H = 993
const PORTRAIT_W = 800 // px, the portrait layout's reference width
const PORTRAIT_H = 1500
const PANEL_W = 740 // px (reference), the landscape panel
const TAB_H = 112 // px (reference), one tab tile
const TAB_GAP = 8
const COUNTERS_H = 150 // px (reference), the Wins / Rebirths pair over the tabs
const CAM_H = 82 // px (reference), the camera bar
const PORTRAIT_PANEL = 0.47 // of the screen height
const SMALL_BELOW = 0.55 // --k under which card text is bumped up to stay legible
const METRES_PER_RIG = PLAYER_DIMS.height / RIG_HEIGHT

const u = (n) => `calc(${n} * var(--k))`
const t = (n) => `calc(${n} * var(--tk))`
const STUDS = (dark, light, size = 30) => `background-image: radial-gradient(circle at 42% 58%, ${dark} 27%, transparent 31%), radial-gradient(circle at 50% 50%, ${light} 27%, transparent 31%); background-size: ${u(size)} ${u(size)};`

const CSS = `
#salon { position: fixed; inset: 0; z-index: 4; pointer-events: none; display: none; font-family: "Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif; font-weight: 700; color: #fff; user-select: none; -webkit-user-select: none;
  --k: 1px; --tk: 1px; --top: 96px; --tabs-top: 246px; --cx: 50%; --ph: 400px; --l: env(safe-area-inset-left, 0px); --r: env(safe-area-inset-right, 0px); --bt: env(safe-area-inset-bottom, 0px); }
#salon.open { display: block; }
#salon * { box-sizing: border-box; }
:where(#salon) button { pointer-events: auto; font: inherit; cursor: pointer; border: 0; color: inherit; background: none; padding: 0; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
#salon .st { -webkit-text-stroke: 0.17em #15151f; paint-order: stroke fill; }
#salon svg { display: block; }

#salon .sl-title { position: absolute; top: var(--top); left: var(--cx); transform: translateX(-50%); display: flex; align-items: center; gap: ${u(8)}; font-size: ${u(64)}; line-height: 1; color: #ffd21a; white-space: nowrap; letter-spacing: 0.01em; }
#salon .sl-title svg { width: ${u(84)}; height: ${u(84)}; margin: ${u(-12)} 0; filter: drop-shadow(0 ${u(3)} 0 rgba(0,0,0,0.3)); }

#salon .sl-cur { position: absolute; left: calc(${u(22)} + var(--l)); top: var(--top); display: flex; flex-direction: column; gap: ${u(8)}; }
#salon .sl-cur > div { display: flex; align-items: center; gap: ${u(10)}; height: ${u(66)}; padding: 0 ${u(18)} 0 ${u(8)}; border-radius: ${u(16)}; background: rgba(28,29,38,0.85); border: ${u(4)} solid #15151f; font-size: ${u(44)}; line-height: 1; }
#salon .sl-cur svg { width: ${u(54)}; height: ${u(54)}; }
#salon.nocur .sl-cur { display: none; }

#salon .sl-tabs { position: absolute; left: calc(${u(22)} + var(--l)); top: var(--tabs-top); display: flex; flex-direction: column; gap: ${t(TAB_GAP)}; }
#salon .sl-tab { position: relative; width: ${t(140)}; height: ${t(TAB_H)}; min-width: 44px; min-height: 44px; border-radius: ${t(14)}; border: ${t(5)} solid #15151f; display: flex; align-items: flex-end; justify-content: center; padding-bottom: ${t(6)};
  background-color: var(--c); ${STUDS('rgba(0,0,0,0.12)', 'rgba(255,255,255,0.16)', 26)} box-shadow: inset 0 0 0 ${t(4)} var(--li), inset 0 ${t(-7)} 0 rgba(0,0,0,0.15), 0 ${t(4)} 0 rgba(0,0,0,0.3);
  filter: brightness(0.72) saturate(0.7); transition: transform .1s, filter .1s; }
#salon .sl-tab:hover { filter: brightness(0.9) saturate(0.9); }
#salon .sl-tab.on { filter: none; transform: scale(1.07); z-index: 1; }
#salon .sl-tab svg { position: absolute; top: ${t(3)}; left: 50%; transform: translateX(-50%); width: ${t(74)}; height: ${t(74)}; filter: drop-shadow(0 ${t(3)} 0 rgba(0,0,0,0.3)); }
#salon .sl-tab .lbl { position: relative; font-size: ${t(28)}; line-height: 1; }

#salon .sl-cam { position: absolute; left: var(--cx); bottom: calc(${u(24)} + var(--bt)); transform: translateX(-50%); display: flex; gap: ${u(6)}; }
#salon .sl-cam button { width: ${u(92)}; height: ${u(CAM_H)}; min-width: 44px; min-height: 44px; border-radius: ${u(10)}; border: ${u(5)} solid #15151f; display: grid; place-items: center;
  box-shadow: inset 0 0 0 ${u(4)} var(--li), inset 0 ${u(-7)} 0 rgba(0,0,0,0.15), 0 ${u(4)} 0 rgba(0,0,0,0.3); background-color: var(--c); ${STUDS('rgba(0,0,0,0.1)', 'rgba(255,255,255,0.2)', 26)} transition: transform .1s; }
#salon .sl-cam button:active { transform: scale(0.92); }
#salon .sl-cam svg { width: 52%; height: 60%; }
#salon .sl-cam .arrow { --c: #2f8ff0; --li: #7fc4ff; }
#salon .sl-cam .zoom { --c: #e3e5eb; --li: #ffffff; }
#salon .sl-cam .view { --c: #ffc928; --li: #ffe27a; width: ${u(100)}; font-size: ${u(34)}; }
#salon.viewing .sl-cam .view { --c: #4bdc3a; --li: #8cff6e; }

#salon .sl-panel { position: absolute; right: calc(${u(22)} + var(--r)); top: var(--top); bottom: calc(${u(22)} + var(--bt)); width: ${u(PANEL_W)}; pointer-events: auto; }
#salon .sl-body { position: absolute; inset: 0; display: flex; flex-direction: column; padding: ${u(14)} ${u(20)} ${u(20)}; border-radius: ${u(26)}; background-color: #e3e5eb; border: ${u(6)} solid #24252e;
  ${STUDS('rgba(60,66,84,0.10)', 'rgba(255,255,255,0.7)', 44)} box-shadow: inset 0 0 0 ${u(5)} #f6f7fa, 0 ${u(10)} ${u(30)} rgba(0,0,0,0.35); }
#salon .sl-x { position: absolute; top: ${u(-28)}; right: ${u(-26)}; width: ${u(96)}; height: ${u(96)}; min-width: 44px; min-height: 44px; border-radius: ${u(14)}; border: ${u(5)} solid #24252e; z-index: 3;
  background: linear-gradient(#ff5a64, #e3212f); box-shadow: inset 0 0 0 ${u(4)} #ff8c94, 0 ${u(4)} 0 rgba(0,0,0,0.35); display: grid; place-items: center; transition: transform .1s; }
#salon .sl-x:hover { transform: scale(1.06); }
#salon .sl-x svg { width: 60%; height: 60%; }
#salon .sl-head { flex: none; display: flex; align-items: center; gap: ${u(10)}; height: ${u(100)}; padding-right: ${u(70)}; }
#salon .sl-head .ico svg { width: ${u(86)}; height: ${u(86)}; filter: drop-shadow(0 ${u(3)} 0 rgba(0,0,0,0.3)); }
#salon .sl-head h2 { flex: 1; min-width: 0; margin: 0; font-size: ${u(68)}; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: ${u(6)} 0; }
#salon .sl-head h2.long { font-size: ${u(54)}; }
#salon .sl-count { flex: none; display: flex; align-items: center; gap: ${u(6)}; height: ${u(70)}; padding: 0 ${u(18)} 0 ${u(8)}; border-radius: ${u(18)}; background: #3a3c4d; border: ${u(5)} solid #24252e; font-size: ${u(42)}; line-height: 1; box-shadow: inset 0 ${u(-5)} 0 rgba(0,0,0,0.25); }
#salon .sl-count svg { width: ${u(54)}; height: ${u(54)}; }
#salon .sl-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; margin: ${u(6)} 0 ${u(10)}; padding: ${u(8)} ${u(14)} ${u(8)} ${u(6)}; }
#salon .sl-scroll::-webkit-scrollbar { width: ${u(10)}; }
#salon .sl-scroll::-webkit-scrollbar-thumb { background: #b8bbc4; border-radius: ${u(6)}; }
#salon .sl-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: ${u(12)}; }

#salon .sl-card { position: relative; aspect-ratio: 126 / 146; border-radius: ${u(14)}; border: ${u(5)} solid #24252e; overflow: hidden; transition: transform .1s;
  background-color: var(--c); ${STUDS('var(--d)', 'var(--g)')} box-shadow: inset 0 0 0 ${u(4)} var(--li), inset 0 ${u(-8)} 0 rgba(0,0,0,0.12); }
#salon .sl-card:hover { transform: scale(1.04); }
#salon .sl-card:active { transform: scale(0.96); }
#salon .sl-card.sel { border-color: #ffd21a; box-shadow: inset 0 0 0 ${u(4)} #fff2a8, 0 0 0 ${u(4)} #24252e, 0 0 ${u(16)} #ffe27a; }
#salon .sl-card .nm { position: absolute; top: ${u(4)}; left: ${u(3)}; right: ${u(3)}; z-index: 2; text-align: center; font-size: ${u(26)}; line-height: 1.15; white-space: nowrap; overflow: hidden; }
#salon .sl-card .nm.s { font-size: ${u(20)}; }
#salon .sl-card .nm.xs { font-size: ${u(16)}; letter-spacing: -0.02em; }
#salon .sl-card .ico { position: absolute; left: 12%; right: 12%; top: 22%; bottom: 10%; display: grid; place-items: center; }
#salon .sl-card .ico svg { width: 100%; height: 100%; filter: drop-shadow(0 ${u(3)} 0 rgba(0,0,0,0.3)); }
#salon .sl-card.locked::before { content: ''; position: absolute; inset: 0; background: rgba(28,22,48,0.42); z-index: 1; }
#salon .sl-card.locked .ico { opacity: 0.5; }
#salon .sl-card .lock { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -54%); width: 50%; z-index: 2; }
#salon .sl-card .lock svg { width: 100%; height: auto; filter: drop-shadow(0 ${u(3)} 0 rgba(0,0,0,0.35)); }
#salon .sl-card .req { position: absolute; bottom: ${u(5)}; left: 0; right: 0; z-index: 2; display: flex; align-items: center; justify-content: center; gap: ${u(3)}; font-size: ${u(26)}; line-height: 1; white-space: nowrap; }
#salon .sl-card .req svg { width: ${u(30)}; height: ${u(30)}; flex: none; }
#salon .sl-card .req.buy { color: #8dff5c; }
#salon .sl-card .chk { position: absolute; top: ${u(30)}; left: ${u(4)}; width: ${u(42)}; height: ${u(42)}; z-index: 3; }
#salon .sl-card .chk svg { width: 100%; height: 100%; }
#salon.small .sl-card .nm { font-size: ${u(34)}; }
#salon.small .sl-card .nm.s { font-size: ${u(26)}; }
#salon.small .sl-card .nm.xs { font-size: ${u(20)}; }
#salon.small .sl-card .req { font-size: ${u(32)}; }

#salon .sl-detail { position: relative; flex: none; height: ${u(226)}; border-radius: ${u(22)}; border: ${u(5)} solid #24252e; padding: ${u(12)} ${u(24)};
  background-color: var(--c); ${STUDS('var(--d)', 'var(--g)', 40)} box-shadow: inset 0 0 0 ${u(5)} var(--li); }
#salon .sl-detail .nm { font-size: ${u(62)}; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 62%; }
#salon .sl-detail .rar { position: absolute; top: ${u(14)}; right: ${u(18)}; min-width: ${u(200)}; height: ${u(56)}; padding: 0 ${u(22)}; border-radius: ${u(28)}; border: ${u(5)} solid #24252e;
  background: var(--rc); box-shadow: inset 0 0 0 ${u(3)} var(--rl), inset 0 ${u(-5)} 0 rgba(0,0,0,0.15); display: grid; place-items: center; font-size: ${u(34)}; line-height: 1; }
#salon .sl-detail .sub { font-size: ${u(34)}; line-height: 1.1; color: #ffd21a; }
#salon .sl-detail .mult { position: absolute; left: ${u(22)}; bottom: ${u(18)}; display: flex; align-items: center; gap: ${u(6)}; font-size: ${u(58)}; line-height: 1; }
#salon .sl-detail .mult svg { width: ${u(74)}; height: ${u(74)}; filter: drop-shadow(0 ${u(3)} 0 rgba(0,0,0,0.3)); }
#salon .sl-detail .note { position: absolute; left: ${u(24)}; bottom: ${u(26)}; max-width: 36%; font-size: ${u(26)}; line-height: 1.15; color: #fff; }
#salon .sl-act { position: absolute; right: ${u(22)}; bottom: ${u(18)}; width: ${u(380)}; height: ${u(92)}; min-height: 44px; border-radius: ${u(10)}; border: ${u(5)} solid #24252e; display: flex; align-items: center; justify-content: center; gap: ${u(8)};
  font-size: ${u(52)}; line-height: 1; white-space: nowrap; background-color: var(--c); ${STUDS('var(--d)', 'var(--g)', 34)} box-shadow: inset 0 0 0 ${u(4)} var(--li), inset 0 ${u(-8)} 0 rgba(0,0,0,0.15); transition: transform .1s, filter .1s; }
#salon .sl-act:hover { filter: brightness(1.06); transform: scale(1.03); }
#salon .sl-act:active { transform: scale(0.96); }
#salon .sl-act svg { width: ${u(54)}; height: ${u(54)}; flex: none; }
#salon .sl-act.s { font-size: ${u(40)}; }
#salon .sl-act.red { --c: #e8243a; --li: #ff8c94; --d: rgba(110,0,20,0.18); --g: rgba(255,255,255,0.14); }
#salon .sl-act.grey { --c: #c9ccd4; --li: #eceef2; --d: rgba(60,66,84,0.12); --g: rgba(255,255,255,0.45); cursor: default; }
#salon .sl-act.green { --c: #4bdc3a; --li: #8cff6e; --d: rgba(0,60,0,0.16); --g: rgba(255,255,255,0.18); }
#salon .sl-act.gold { --c: #ffc928; --li: #ffe27a; --d: rgba(170,100,0,0.18); --g: rgba(255,240,170,0.5); }
#salon .sl-act.dim { filter: saturate(0.4) brightness(0.85); }

#salon .sl-slots { display: grid; grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr)) minmax(0, 1.15fr); gap: ${u(10)}; margin-bottom: ${u(14)}; }
#salon .sl-slot { position: relative; aspect-ratio: 150 / 176; border-radius: ${u(14)}; border: ${u(5)} solid #24252e; background-color: #eef0f4; ${STUDS('rgba(60,66,84,0.10)', 'rgba(255,255,255,0.7)')} box-shadow: inset 0 0 0 ${u(4)} #fff; }
#salon .sl-slot .ico { position: absolute; left: 16%; right: 16%; top: 8%; bottom: 32%; display: grid; place-items: center; }
#salon .sl-slot .ico svg { width: 100%; height: 100%; filter: drop-shadow(0 ${u(3)} 0 rgba(0,0,0,0.3)); }
#salon .sl-slot .ico.empty { opacity: 0.25; }
#salon .sl-slot .lbl { position: absolute; bottom: ${u(8)}; left: 0; right: 0; text-align: center; font-size: ${u(36)}; line-height: 1; }
#salon .sl-sum { display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: ${u(4)}; }
#salon .sl-sum .row { display: flex; align-items: center; gap: ${u(4)}; font-size: ${u(46)}; line-height: 1; }
#salon .sl-sum .row svg { width: ${u(50)}; height: ${u(50)}; }
#salon .sl-sum .mul { color: #b8ff2a; }
#salon .sl-best { position: relative; width: 100%; height: ${u(76)}; min-height: 44px; border-radius: ${u(10)}; border: ${u(5)} solid #24252e; font-size: ${u(44)};
  --c: #4bdc3a; --li: #8cff6e; --d: rgba(0,60,0,0.16); --g: rgba(255,255,255,0.18); background-color: var(--c); ${STUDS('var(--d)', 'var(--g)', 30)} box-shadow: inset 0 0 0 ${u(4)} var(--li), inset 0 ${u(-7)} 0 rgba(0,0,0,0.15); }
#salon .sl-best:active { transform: scale(0.95); }

#salon .sl-len { position: relative; margin: ${u(10)} ${u(6)}; padding: ${u(22)} ${u(18)} ${u(20)}; border-radius: ${u(22)}; border: ${u(5)} solid #24252e; text-align: center;
  background-color: #f2b6e0; background-image: radial-gradient(circle at 42% 58%, rgba(120,40,140,0.12) 27%, transparent 31%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35) 27%, transparent 31%), linear-gradient(#ffc6ea, #c9a2ff);
  background-size: ${u(40)} ${u(40)}, ${u(40)} ${u(40)}, 100% 100%; box-shadow: inset 0 0 0 ${u(5)} rgba(255,255,255,0.6); }
#salon .sl-len .tt { font-size: ${u(78)}; line-height: 1; color: #ffd21a; }
#salon .sl-len .up { font-size: ${u(32)}; line-height: 1.2; }
#salon .sl-len .row { display: flex; align-items: center; gap: ${u(14)}; margin-top: ${u(26)}; }
#salon .sl-len .end { flex: none; width: ${u(92)}; height: ${u(92)}; min-width: 44px; min-height: 44px; border-radius: ${u(12)}; border: ${u(4)} solid #24252e; background: #fff3fb; display: grid; place-items: center; box-shadow: inset 0 0 0 ${u(3)} #fff; }
#salon .sl-len .end svg { width: 70%; height: 70%; }
#salon .sl-len .end.lo svg { width: 42%; height: 42%; }
#salon .sl-len .track { position: relative; flex: 1; height: ${u(50)}; border-radius: ${u(25)}; border: ${u(5)} solid #24252e; background: #3a2a6a; pointer-events: auto; touch-action: none; cursor: pointer; }
#salon .sl-len .track::before { content: ''; position: absolute; inset: ${u(-30)} 0; } /* a taller hit area */
#salon .sl-len .grown { position: absolute; left: 0; top: 0; bottom: 0; border-radius: ${u(20)}; background: #6a4ab8; }
#salon .sl-len .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: ${u(20)}; background: linear-gradient(#ffe978, #ffb02a); box-shadow: inset 0 ${u(4)} 0 rgba(255,255,255,0.4); }
#salon .sl-len .knob { position: absolute; top: 50%; width: ${u(104)}; height: ${u(104)}; min-width: 44px; min-height: 44px; transform: translate(-50%, -50%); border-radius: 50%; background: #fff; border: ${u(7)} solid #ff3d8a; box-shadow: 0 ${u(4)} ${u(8)} rgba(0,0,0,0.3); display: grid; place-items: center; }
#salon .sl-len .knob svg { width: 62%; height: 62%; }
#salon .sl-len .marks { position: relative; height: ${u(76)}; margin: ${u(14)} ${u(106)} 0; }
#salon .sl-len .mk { position: absolute; top: 0; transform: translateX(-50%); font-size: ${u(28)}; line-height: 1; white-space: nowrap; }
#salon .sl-len .mk.r2 { top: ${u(36)}; }
#salon .sl-len .mk::before { content: ''; position: absolute; left: 50%; top: ${u(-14)}; width: ${u(8)}; height: ${u(8)}; margin-left: ${u(-4)}; border-radius: 50%; background: #fff; }
#salon .sl-len .mk.r2::before { top: ${u(-50)}; }
#salon .sl-len .hint { margin-top: ${u(10)}; font-size: ${u(34)}; line-height: 1; }

/* VIEW: only the camera bar stays, the player gets the whole screen. */
#salon.viewing :is(.sl-panel, .sl-tabs, .sl-title, .sl-cur) { display: none; }

/* Portrait: panel along the bottom, tabs in a row over it, camera bar over the tabs. */
#salon.portrait .sl-cur { display: none; }
#salon.portrait .sl-title { left: 50%; }
#salon.portrait .sl-panel { left: calc(${u(12)} + var(--l)); right: calc(${u(12)} + var(--r)); top: auto; bottom: calc(${u(12)} + var(--bt)); width: auto; height: var(--ph); }
#salon.portrait .sl-x { top: ${u(12)}; right: ${u(12)}; width: ${u(84)}; height: ${u(84)}; }
#salon.portrait .sl-head { padding-right: ${u(96)}; }
#salon.portrait .sl-tabs { flex-direction: row; justify-content: space-between; top: auto; left: calc(${u(20)} + var(--l)); right: calc(${u(20)} + var(--r)); bottom: calc(var(--ph) + ${u(30)} + var(--bt)); }
#salon.portrait .sl-tab { width: ${t(118)}; height: ${t(100)}; }
#salon.portrait .sl-tab svg { width: ${t(66)}; height: ${t(66)}; }
#salon.portrait .sl-tab .lbl { font-size: ${t(25)}; }
#salon.portrait .sl-cam { left: 50%; bottom: calc(var(--ph) + ${u(150)} + var(--bt)); }
#salon.portrait.viewing .sl-cam { bottom: calc(${u(30)} + var(--bt)); }
`

const el = (tag, cls, html = '') => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  e.innerHTML = html
  return e
}
// Inline custom properties for a rarity's card colours.
const rarityVars = (r) => {
  const c = RARITY[r] ?? RARITY.common
  return `--c:${c.card};--li:${c.light};--d:${c.dark};--g:${c.glow};--rc:${c.card};--rl:${c.light}`
}
const nameClass = (s) => (s.length > 11 ? 'xs' : s.length > 8 ? 's' : '')
const fmtMult = (m) => `x${+m.toFixed(2)}`

// Card-bottom badge for what an item still needs.
function reqBadge(req) {
  switch (req.type) {
    case 'price': return `<span class="req${game.affordable(req) ? ' buy' : ''} st">${TROPHY_ICON}${formatNumber(req.value)}</span>`
    case 'prestige': return `<span class="req st">${PRESTIGE_ICON}P${req.value}</span>`
    case 'rebirths': return `<span class="req st">${REBIRTH_ICON}${req.value}</span>`
    case 'days': return `<span class="req st">${FLAME_ICON}Day ${req.value}</span>`
    case 'owns': return `<span class="req st">${STAR_TAG_ICON}LIMITED</span>`
    default: return `<span class="req st">GONE</span>`
  }
}

// --- Item view models ----------------------------------------------------------
// { id, kind, name, label, icon, rarity, sub, mult, req, worn, removable }
function items(tab) {
  const s = game.state
  const hairColor = game.HAIR_STYLES[s.equipped]?.color
  switch (tab) {
    case 'styles':
      return Object.entries(CUTS).map(([id, c]) => ({ id, kind: 'cut', name: c.name, label: c.name, icon: cutIcon(c.icon), rarity: c.rarity, sub: 'Hairstyle', mult: null, req: game.cosmeticReq('cut', id), worn: s.cut === id, removable: id !== 'classic' }))
    case 'colors':
      return Object.entries(game.HAIR_STYLES)
        .sort((a, b) => a[1].bonus - b[1].bonus)
        .map(([id, st]) => ({ id, kind: 'color', name: st.name, label: `x${st.bonus}`, icon: colorIcon(st), rarity: rarityForBonus(st.bonus), sub: 'Hair Color', mult: st.bonus, req: game.styleReq(id), worn: s.equipped === id, removable: false }))
    case 'charms':
      return Object.entries(CHARMS).map(([id, c]) => ({ id, kind: 'charm', name: c.name, label: fmtMult(c.mult), icon: charmIcon(c), rarity: c.rarity, sub: `${SLOT_NAMES[c.slot]} Charm`, mult: c.mult, req: game.cosmeticReq('charm', id), worn: s.charms[c.slot] === id, removable: true }))
    case 'auras':
      return Object.entries(AURAS).map(([id, a]) => ({ id, kind: 'aura', name: a.name, label: a.name, icon: auraIcon(a, hairColor), rarity: a.rarity, sub: 'Aura', mult: null, req: game.cosmeticReq('aura', id), worn: s.aura === id, removable: id !== 'none' }))
    case 'trails':
      return Object.entries(TRAILS).map(([id, tr]) => ({ id, kind: 'trail', name: tr.name, label: id === 'none' ? tr.name : fmtMult(tr.mult), icon: trailIcon(tr, id === 'none'), rarity: tr.rarity, sub: 'Trail', mult: id === 'none' ? null : tr.mult, req: game.cosmeticReq('trail', id), worn: s.trail === id, removable: id !== 'none' }))
    default:
      return []
  }
}

// The detail box's button for an item: { cls, html, act } (act: 'wear' | 'off' | 'locked' | null).
// A Wins price shows "Buy" as soon as the player has that many Wins; buying spends them.
function action(it) {
  const r = it.req
  if (it.worn) return it.removable ? { cls: 'red', html: 'Take off', act: 'off' } : { cls: 'grey', html: 'Wearing!', act: null }
  if (!r) return { cls: 'green', html: 'Wear', act: 'wear' }
  switch (r.type) {
    case 'price': return game.affordable(r)
      ? { cls: 'gold', html: `Buy ${TROPHY_ICON}${formatNumber(r.value)}`, act: 'wear' }
      : { cls: 'grey s', html: `Need ${TROPHY_ICON}${formatNumber(r.value)}`, act: 'locked' }
    case 'prestige': return { cls: 'grey s', html: `Need ${PRESTIGE_ICON}P${r.value}`, act: 'locked' }
    case 'rebirths': return { cls: 'grey s', html: `Need ${REBIRTH_ICON}${r.value}`, act: 'locked' }
    case 'days': return { cls: 'grey s', html: `${FLAME_ICON}Day ${Math.min(game.state.days, r.value)}/${r.value}`, act: 'locked' }
    case 'owns': return { cls: 'grey s', html: 'Limited!', act: 'locked' }
    default: return { cls: 'grey', html: 'Expired', act: null }
  }
}
function lockedText(r) {
  switch (r.type) {
    case 'price': return `Need ${formatNumber(r.value)} Wins! (you have ${formatNumber(game.state.wins)})`
    case 'prestige': return `Reach Prestige ${r.value}! (Rebirth window)`
    case 'rebirths': return `Need ${r.value} Rebirth${r.value === 1 ? '' : 's'}!`
    case 'days': return `Play on ${r.value} different days! (${game.state.days}/${r.value})`
    case 'owns': return `Comes with the ${game.HAIR_STYLES[r.value]?.name ?? 'limited'} bundle!`
    default: return 'Locked!'
  }
}

// Length slider helpers: the knob sits at x (0..1 along the bar).
const markAt = (x) => LENGTH_MARKS.reduce((name, m) => (x + 0.004 >= m.x ? m.name : name), LENGTH_MARKS[0].name)
const grownMetres = () => {
  const hair = game.state.hair
  return game.hairLengthFor(hair) * HAIR.hangPerLength * METRES_PER_RIG + game.trailLengthFor(hair)
}

export function createSalonUi({ onClose, onTab, onOrbit, onZoom, toast, error }) {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const root = el('div', '')
  root.id = 'salon'
  root.innerHTML = `
    <div class="sl-title st">${HAIRSTYLE_ICON}<span>HAIR SALON</span></div>
    <div class="sl-cur"><div>${TROPHY_ICON}<span class="wins st">0</span></div><div>${REBIRTH_ICON}<span class="rebirths st">0</span></div></div>
    <div class="sl-tabs">${TABS.map((tb) => `<button class="sl-tab" data-tab="${tb.id}" style="--c:${tb.color};--li:${tb.light}">${tb.id === 'length' ? HAIRSTYLE_ICON : TAB_ICONS[tb.id]()}<span class="lbl st">${tb.name}</span></button>`).join('')}</div>
    <div class="sl-cam">
      <button class="arrow" data-cam="left" title="Turn left">${ARROW_LEFT}</button>
      <button class="zoom" data-cam="out" title="Zoom out">${MINUS_ICON}</button>
      <button class="view st" data-cam="view" title="Hide the menu">VIEW</button>
      <button class="zoom" data-cam="in" title="Zoom in">${PLUS_ICON}</button>
      <button class="arrow" data-cam="right" title="Turn right">${ARROW_RIGHT}</button>
    </div>
    <div class="sl-panel">
      <div class="sl-body">
        <div class="sl-head"><span class="ico"></span><h2 class="st"></h2><span class="sl-count">${BOOK_ICON}<span class="n st"></span></span></div>
        <div class="sl-scroll"><div class="sl-extra"></div><div class="sl-grid"></div></div>
        <div class="sl-detail"></div>
      </div>
      <button class="sl-x" title="Close">${BIG_X_ICON}</button>
    </div>`
  document.body.appendChild(root)
  const q = (sel) => root.querySelector(sel)
  const grid = q('.sl-grid')
  const extra = q('.sl-extra')
  const detail = q('.sl-detail')
  const scroll = q('.sl-scroll')

  let tab = 'styles'
  let viewing = false
  const picked = {} // tab -> picked item id
  const free = { x: 0, y: 0, w: 1, h: 1 } // screen rect left for the 3D view, px
  let lastItems = []

  // --- Layout ----------------------------------------------------------------
  const fit = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const portrait = h > w * 1.05
    const topBar = document.querySelector('#hud .hud-top')?.getBoundingClientRect().bottom || 70
    const k = portrait ? Math.min(w / PORTRAIT_W, h / PORTRAIT_H) : Math.min(w / REF_W, h / REF_H)
    const top = Math.max(96 * k, topBar + 8)
    root.classList.toggle('portrait', portrait)
    root.classList.toggle('small', k < SMALL_BELOW)
    root.style.setProperty('--k', `${k}px`)
    root.style.setProperty('--top', `${top}px`)
    const bottomInset = parseFloat(getComputedStyle(root).getPropertyValue('--bt')) || 0
    if (portrait) {
      const ph = Math.round(h * PORTRAIT_PANEL)
      root.style.setProperty('--ph', `${ph}px`)
      const tk = Math.min(k, (w - 40 * k) / (6 * 118 + 5 * 6))
      root.style.setProperty('--tk', `${tk}px`)
      root.classList.remove('nocur')
      const camTop = h - (ph + 150 * k + bottomInset + Math.max(CAM_H * k, 44))
      Object.assign(free, viewing ? { x: 0, y: topBar, w, h: h - topBar - Math.max(CAM_H * k, 44) - 30 * k } : { x: 0, y: top + 70 * k, w, h: Math.max(80, camTop - top - 70 * k) })
    } else {
      // Tabs under the counters when both fit, else the counters give way; tabs shrink as a last resort.
      const tabsNeed = 6 * TAB_H + 5 * TAB_GAP
      const room = h - 22 * k - bottomInset
      const withCur = top + COUNTERS_H * k + tabsNeed * k <= room
      root.classList.toggle('nocur', !withCur)
      const tabsTop = withCur ? top + COUNTERS_H * k : top
      root.style.setProperty('--tabs-top', `${tabsTop}px`)
      const tk = Math.min(k, (room - tabsTop) / tabsNeed)
      root.style.setProperty('--tk', `${tk}px`)
      const leftEdge = viewing ? 0 : 22 * k + Math.max(140 * tk, 44) + 12
      const rightEdge = viewing ? w : w - (22 + PANEL_W) * k - 8
      root.style.setProperty('--cx', `${(leftEdge + rightEdge) / 2}px`)
      const camH = Math.max(CAM_H * k, 44) + 24 * k
      const titleH = viewing ? 0 : 70 * k
      Object.assign(free, { x: leftEdge, y: top + titleH, w: Math.max(80, rightEdge - leftEdge), h: Math.max(80, h - top - titleH - camH - bottomInset) })
    }
  }
  window.addEventListener('resize', () => {
    if (!root.classList.contains('open')) return
    fit()
    render()
  })

  // --- Rendering ---------------------------------------------------------------
  const counters = () => {
    q('.sl-cur .wins').textContent = formatNumber(game.state.wins)
    q('.sl-cur .rebirths').textContent = formatNumber(game.state.rebirths)
  }

  const renderDetail = (it) => {
    if (!it) {
      detail.innerHTML = ''
      return
    }
    const a = action(it)
    detail.setAttribute('style', rarityVars(it.rarity))
    detail.innerHTML = `<div class="nm st">${it.name}</div><span class="rar st">${RARITY[it.rarity].name}</span><div class="sub st">${it.sub}</div>
      ${it.mult != null ? `<div class="mult st">${HAIR_ICON}${fmtMult(it.mult)}</div>` : ''}
      <button class="sl-act st ${a.cls}" data-act="${a.act ?? ''}">${a.html}</button>`
  }

  const renderCharmSlots = () => {
    const s = game.state
    const slots = game.charmSlots() // the bonus slot shows once the first prestige opens it
    const n = slots.filter((slot) => s.charms[slot]).length
    extra.innerHTML = `<div class="sl-slots" style="--n:${slots.length}">${slots.map((slot) => {
      const c = CHARMS[s.charms[slot]]
      return `<button class="sl-slot" data-slot="${slot}"><span class="ico${c ? '' : ' empty'}">${c ? charmIcon(c) : TAB_ICONS.charms()}</span><span class="lbl st">${SLOT_NAMES[slot]}</span></button>`
    }).join('')}
      <div class="sl-sum"><span class="row st">${TAB_ICONS.charms()}${n}/${slots.length}</span><span class="row mul st">${HAIR_ICON}${fmtMult(game.charmMultiplier())}</span><button class="sl-best st">Best!</button></div></div>`
  }

  // The Length tab's slider; built once per visit so a drag survives the state updates it causes.
  let lengthBuilt = false
  const buildLength = () => {
    extra.innerHTML = `<div class="sl-len"><div class="tt st"></div><div class="up st"></div>
      <div class="row"><button class="end lo" data-len="0">${HAIR_ICON}</button>
        <div class="track"><div class="grown"></div><div class="fill"></div><button class="knob">${HEART_ICON}</button></div>
        <button class="end hi" data-len="1">${HAIR_ICON}</button></div>
      <div class="marks">${LENGTH_MARKS.map((m, i) => `<span class="mk st${i % 2 ? ' r2' : ''}" style="left:${(m.x * 100).toFixed(1)}%">${m.name}</span>`).join('')}</div>
      <div class="hint st">Drag the heart!</div></div>`
    lengthBuilt = true
  }
  const updateLength = () => {
    const s = game.state
    const grownX = game.lengthXForHair(s.hair)
    const x = grownX * s.lengthPick
    const name = markAt(x)
    q('.sl-len .tt').textContent = name
    q('.sl-len .up').textContent = `up to ${Math.max(1, Math.round(grownMetres()))} m`
    q('.sl-len .grown').style.width = `${(grownX * 100).toFixed(2)}%`
    q('.sl-len .fill').style.width = `${(x * 100).toFixed(2)}%`
    q('.sl-len .knob').style.left = `${(x * 100).toFixed(2)}%`
    const longest = s.lengthPick >= 0.999
    detail.setAttribute('style', rarityVars('common'))
    detail.innerHTML = `<div class="nm st">${name}</div><span class="rar st">Common</span><div class="sub st">Hair Length</div>
      <div class="note st">Grow longer hair on the treadmills!</div>
      <button class="sl-act st ${longest ? 'grey s' : 'green s'}" data-act="${longest ? '' : 'grow'}">${longest ? 'Longest hair!' : 'Grow it back!'}</button>`
  }

  const render = () => {
    const tb = TABS.find((x) => x.id === tab)
    root.querySelectorAll('.sl-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab))
    q('.sl-head .ico').innerHTML = tab === 'length' ? HAIRSTYLE_ICON : TAB_ICONS[tab]()
    q('.sl-head h2').textContent = tb.title
    q('.sl-head h2').classList.toggle('long', tb.title.length > 10)
    counters()
    if (tab === 'length') {
      grid.innerHTML = ''
      q('.sl-count').style.visibility = 'hidden'
      if (!lengthBuilt) buildLength()
      updateLength()
      lastItems = []
      return
    }
    lengthBuilt = false
    q('.sl-count').style.visibility = ''
    lastItems = items(tab)
    if (!lastItems.some((it) => it.id === picked[tab])) {
      const worn = lastItems.find((it) => it.worn)
      picked[tab] = (worn ?? lastItems[0]).id
    }
    q('.sl-count .n').textContent = `${lastItems.filter((it) => !it.req).length}/${lastItems.length}`
    if (tab === 'charms') renderCharmSlots()
    else extra.innerHTML = ''
    grid.innerHTML = lastItems.map((it) => {
      // A price the player can already pay shows unlocked (no padlock), with the price still on it.
      const locked = !!it.req && !game.affordable(it.req)
      return `<button class="sl-card${locked ? ' locked' : ''}${it.id === picked[tab] ? ' sel' : ''}" data-id="${it.id}" style="${rarityVars(it.rarity)}">
        <span class="nm st ${nameClass(it.label)}">${it.label}</span><span class="ico">${it.icon}</span>
        ${locked ? `<span class="lock">${PADLOCK_ICON}</span>` : ''}${it.req ? reqBadge(it.req) : ''}
        ${it.worn ? `<span class="chk">${CHECK_ICON}</span>` : ''}</button>`
    }).join('')
    fitLabels()
    renderDetail(lastItems.find((it) => it.id === picked[tab]))
  }

  // Card labels and badges shrink to fit their card ("Mermaid Waves", "LIMITED" on a phone).
  const fitLabels = () => {
    for (const e of grid.querySelectorAll('.sl-card .nm, .sl-card .req')) {
      e.style.fontSize = ''
      if (e.scrollWidth > e.clientWidth + 1) e.style.fontSize = `${(parseFloat(getComputedStyle(e).fontSize) * e.clientWidth) / e.scrollWidth}px`
    }
  }

  // --- Actions -----------------------------------------------------------------
  const wear = (it) => {
    const ok = it.kind === 'color' ? game.equip(it.id) : game.wearCosmetic(it.kind, it.id)
    if (!ok && it.req) error(lockedText(it.req))
  }
  const perform = (act) => {
    if (act === 'grow') return game.setLengthPick(1)
    const it = lastItems.find((x) => x.id === picked[tab])
    if (!it) return
    if (act === 'wear') wear(it)
    else if (act === 'off') game.takeOffCosmetic(it.kind, it.id)
    else if (act === 'locked') error(lockedText(it.req))
  }

  // Length drag: pointer x along the track -> the shown fraction of the grown hair.
  let dragging = null
  const dragTo = (clientX) => {
    const track = q('.sl-len .track')
    if (!track) return
    const rect = track.getBoundingClientRect()
    const grownX = game.lengthXForHair(game.state.hair)
    const x = Math.min(grownX, Math.max(0, (clientX - rect.left) / rect.width))
    game.setLengthPick(grownX > 0 ? x / grownX : 1)
  }
  root.addEventListener('pointerdown', (e) => {
    if (tab !== 'length' || !e.target.closest('.sl-len .track')) return
    dragging = e.pointerId
    e.target.setPointerCapture?.(e.pointerId)
    dragTo(e.clientX)
    e.preventDefault()
  })
  root.addEventListener('pointermove', (e) => e.pointerId === dragging && dragTo(e.clientX))
  const endDrag = (e) => e.pointerId === dragging && (dragging = null)
  root.addEventListener('pointerup', endDrag)
  root.addEventListener('pointercancel', endDrag)

  root.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.sl-tab')
    if (tabBtn) {
      if (tabBtn.dataset.tab !== tab) {
        tab = tabBtn.dataset.tab
        scroll.scrollTop = 0
        render()
        onTab(tab)
      }
      return
    }
    const cam = e.target.closest('[data-cam]')?.dataset.cam
    if (cam === 'left' || cam === 'right') return onOrbit(cam === 'left' ? -1 : 1)
    if (cam === 'in' || cam === 'out') return onZoom(cam === 'in' ? -1 : 1)
    if (cam === 'view') {
      viewing = !viewing
      root.classList.toggle('viewing', viewing)
      fit()
      return
    }
    if (e.target.closest('.sl-x')) return onClose()
    const len = e.target.closest('[data-len]')?.dataset.len
    if (len != null) return game.setLengthPick(Number(len))
    const card = e.target.closest('.sl-card')
    if (card) {
      if (picked[tab] === card.dataset.id) {
        // A second tap on the picked card wears it (or takes it off).
        const a = action(lastItems.find((it) => it.id === card.dataset.id))
        if (a.act === 'wear' || a.act === 'off') perform(a.act)
        return
      }
      picked[tab] = card.dataset.id
      grid.querySelectorAll('.sl-card').forEach((c) => c.classList.toggle('sel', c === card))
      renderDetail(lastItems.find((it) => it.id === picked[tab]))
      return
    }
    const slot = e.target.closest('.sl-slot')?.dataset.slot
    if (slot) {
      const id = game.state.charms[slot]
      if (id) {
        picked.charms = id
        render()
      }
      return
    }
    if (e.target.closest('.sl-best')) {
      if (!game.wearBestCharms()) toast('Already wearing your best charms!', '#b6ff7a')
      return
    }
    const act = e.target.closest('.sl-act')?.dataset.act
    if (act) perform(act)
  })

  return {
    free,
    get tab() {
      return tab
    },
    get viewing() {
      return viewing
    },
    open(start = tab) {
      tab = start
      viewing = false
      root.classList.remove('viewing')
      root.classList.add('open')
      lengthBuilt = false
      scroll.scrollTop = 0
      fit()
      render()
    },
    close() {
      root.classList.remove('open')
      dragging = null
    },
    // Progression changed while open: redraw (the length slider updates in place).
    refresh() {
      if (!root.classList.contains('open')) return
      if (tab === 'length' && lengthBuilt) {
        counters()
        updateLength()
      } else render()
    },
  }
}
