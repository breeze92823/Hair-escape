// DOM HUD over the canvas, styled after the Roblox-sim look in the reference:
// the navy quest pill top-centre ("1/6 Walk onto
// the treadmill..."), and the bottom stack of the
// hair counter over the Level progress bar. Plus prompts, toasts, "+N" popups,
// a chat log and the event / help panels.
import { formatNumber } from './lobby/leaderboards.js'

const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; font-family: "Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif; font-weight: 700; color: #fff; user-select: none; z-index: 5; }
#hud * { box-sizing: border-box; }
#hud .stroke { -webkit-text-stroke: 0.18em #15152a; paint-order: stroke fill; }
#hud button { pointer-events: auto; font: inherit; cursor: pointer; border: 0; }

.hud-quest { position: absolute; top: calc(17.5vh - 34px); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 18px; padding: 8px 32px 8px 10px; width: clamp(340px, 44vw, 900px); border-radius: 40px;
  background: linear-gradient(#34355a, #1f2040); border: 4px solid #0d0e1c; box-shadow: inset 0 3px 0 rgba(255,255,255,0.12), 0 4px 10px rgba(0,0,0,0.35); transition: transform .25s; }
.hud-quest::before { content: ''; position: absolute; inset: 4px; border-radius: 36px; background-image: radial-gradient(rgba(255,255,255,0.06) 30%, transparent 32%); background-size: 22px 22px; pointer-events: none; }
.hud-quest.pop { transform: translateX(-50%) scale(1.06); }
.hud-quest .badge { flex: none; min-width: 74px; height: 52px; border-radius: 26px; display: grid; place-items: center; font-size: 30px; background: linear-gradient(#ffe46b, #ffb800); border: 3px solid #4a3000; box-shadow: inset 0 -4px 0 rgba(160,90,0,0.5); }
.hud-quest .text { flex: 1; text-align: center; font-size: clamp(14px, 1.62vw, 32px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hud-quest .hl { color: #ffd21a; }
.hud-quest .skip { position: absolute; top: -2px; left: 50%; transform: translateX(-50%); padding: 0 8px; font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.55); background: none; pointer-events: auto; }
.hud-quest .skip:hover { color: #fff; }
.hud-quest.done .skip { display: none; }
.hud-quest.done .badge { background: linear-gradient(#b6ff7a, #33d11c); border-color: #154a00; }

.hud-bottom { position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); width: clamp(320px, 43vw, 900px); display: flex; flex-direction: column; align-items: center; gap: 2px; }
.hud-hair { display: flex; align-items: center; gap: 6px; font-size: 34px; transition: transform .15s; }
.hud-hair.bump { transform: scale(1.22); }
.hud-hair svg { width: 46px; height: 46px; filter: drop-shadow(0 2px 0 rgba(0,0,0,0.35)); }
.hud-boost { font-size: 16px; color: #ffd21a; margin-left: 8px; }
.hud-level { position: relative; width: 100%; height: 64px; border-radius: 12px; border: 4px solid #12142a; background: #e9eef6; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
.hud-level::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(150,165,190,0.45) 28%, transparent 31%); background-size: 26px 26px; background-position: 6px 6px; }
.hud-level .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(#58d6ff, #1aa8f0); transition: width .25s ease-out; box-shadow: inset 0 4px 0 rgba(255,255,255,0.35); }
.hud-level .fill::after { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.3) 28%, transparent 31%); background-size: 26px 26px; background-position: 6px 6px; }
.hud-level .lv, .hud-level .xp { position: absolute; top: 50%; transform: translateY(-50%); font-size: 40px; }
.hud-level .lv { left: 16px; }
.hud-level .xp { right: 16px; }

.hud-prompt { position: absolute; bottom: 150px; left: 50%; transform: translateX(-50%); display: none; align-items: center; gap: 10px; padding: 8px 18px 8px 8px; border-radius: 14px; background: rgba(18,18,24,0.85); font-size: 20px; pointer-events: auto; cursor: pointer; }
.hud-prompt .key { width: 38px; height: 38px; border-radius: 8px; background: #fff; color: #15152a; display: grid; place-items: center; font-size: 22px; box-shadow: inset 0 -3px 0 #b8bccc; }
.hud-prompt.dim { cursor: default; }
.hud-prompt.dim .key { display: none; }
.hud-prompt.dim span { color: #ffb0b0; }

.hud-toasts { position: absolute; top: 220px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.hud-toast { font-size: clamp(24px, 3.2vw, 46px); animation: toast 2.6s ease-out forwards; white-space: nowrap; }
@keyframes toast { 0% { opacity: 0; transform: scale(0.4) } 10% { opacity: 1; transform: scale(1.12) } 18% { transform: scale(1) } 80% { opacity: 1 } 100% { opacity: 0; transform: translateY(-30px) } }

.hud-pop { position: absolute; font-size: 30px; color: #ffd21a; transform: translate(-50%, -50%); animation: pop 0.9s ease-out forwards; }
@keyframes pop { 0% { opacity: 0; transform: translate(-50%, -20%) scale(0.5) } 15% { opacity: 1; transform: translate(-50%, -50%) scale(1.15) } 100% { opacity: 0; transform: translate(-50%, -260%) scale(0.9) } }

.hud-chat { position: absolute; top: 84px; left: 18px; width: 340px; max-height: 220px; padding: 10px 12px; border-radius: 12px; background: rgba(18,18,24,0.6); font-size: 15px; font-weight: 500; display: none; flex-direction: column; gap: 4px; overflow: hidden; }
.hud-chat.open { display: flex; }
.hud-chat b { color: #ffd21a; }

.hud-panel { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(460px, 92vw); padding: 22px 24px 24px; border-radius: 22px; background: linear-gradient(#3a3b66, #24254a); border: 4px solid #0d0e1c; box-shadow: 0 10px 30px rgba(0,0,0,0.45); display: none; pointer-events: auto; text-align: center; }
.hud-panel.open { display: block; }
.hud-panel h2 { margin: 0 0 10px; font-size: 34px; }
.hud-panel p { margin: 8px 0; font-size: 18px; font-weight: 500; line-height: 1.35; }
.hud-panel .big { font-size: 22px; font-weight: 700; color: #ffd21a; }
.hud-panel .row { display: flex; gap: 10px; justify-content: center; margin-top: 16px; }
.hud-btn { padding: 12px 26px; border-radius: 14px; font-size: 22px; color: #fff; background: linear-gradient(#7dff5a, #22b91a); border: 3px solid #0f4a0a !important; box-shadow: inset 0 -4px 0 rgba(0,0,0,0.2); }
.hud-btn.grey { background: linear-gradient(#b8bccc, #7d8299); border-color: #2a2d3a !important; }
.hud-btn:disabled { filter: grayscale(1); opacity: 0.6; cursor: default; }
.hud-close { position: absolute; top: -14px; right: -14px; width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(#ff6b6b, #e02424); border: 3px solid #4a0a0a !important; color: #fff; font-size: 22px; }
.hud-panel table { width: 100%; font-size: 17px; font-weight: 500; border-collapse: collapse; }
.hud-panel td { padding: 4px 6px; text-align: left; }
.hud-panel td:first-child { color: #ffd21a; font-weight: 700; width: 40%; }

@media (max-width: 700px) {
  .hud-quest { top: 84px; padding: 6px 16px 6px 6px; gap: 10px; }
  .hud-quest .badge { min-width: 56px; height: 40px; font-size: 22px; }
  .hud-level { height: 48px; }
  .hud-level .lv, .hud-level .xp { font-size: 28px; }
  .hud-hair { font-size: 26px; }
}
`

// Golden swirl of hair (the HUD currency icon).
const HAIR_ICON = `<svg viewBox="0 0 48 48"><path d="M24 4c-9 0-15 7-14 15 1 6 6 8 6 14 0 5-4 7-4 10 3 0 9-3 10-9 1-5-3-8-3-13 0-4 3-7 7-7s7 3 6 7c-1 4-5 5-5 9 0 3 3 5 6 5-1-3-2-5 1-8 4-4 6-7 5-12-1-6-7-10-15-11z" fill="url(#hg)" stroke="#5a3200" stroke-width="2.4" stroke-linejoin="round"/><path d="M17 15c2-4 7-6 11-4" fill="none" stroke="#fff6c0" stroke-width="2.4" stroke-linecap="round"/><circle cx="35" cy="36" r="4" fill="#ff5fb4" stroke="#5a0a3a" stroke-width="2"/><defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe46b"/><stop offset="1" stop-color="#f59a0c"/></linearGradient></defs></svg>`

const el = (tag, cls, html = '') => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  e.innerHTML = html
  return e
}

export function createHud({ onMenu, onClaimBoost, onSkipQuest }) {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const root = el('div', '')
  root.id = 'hud'
  document.body.appendChild(root)

  const quest = el('div', 'hud-quest', `<button class="skip">Skip</button><div class="badge stroke">1/6</div><div class="text stroke"></div>`)
  root.appendChild(quest)

  const bottom = el('div', 'hud-bottom')
  const hair = el('div', 'hud-hair', `${HAIR_ICON}<span class="n stroke">0</span><span class="hud-boost stroke"></span>`)
  const level = el('div', 'hud-level', `<div class="fill"></div><span class="lv stroke">Level 1</span><span class="xp stroke">0/12</span>`)
  bottom.append(hair, level)
  root.appendChild(bottom)

  const prompt = el('div', 'hud-prompt', `<div class="key">E</div><span class="stroke"></span>`)
  root.appendChild(prompt)

  const toasts = el('div', 'hud-toasts')
  root.appendChild(toasts)

  const chat = el('div', 'hud-chat')
  root.appendChild(chat)

  // Event panel.
  const eventPanel = el('div', 'hud-panel', `
    <button class="hud-close">✕</button>
    <h2 class="stroke">👑 Hair Festival</h2>
    <p>The festival is on! Claim a <span class="big">2x Hair</span> boost for 5 minutes of treadmill time.</p>
    <p class="status"></p>
    <div class="row"><button class="hud-btn stroke claim">CLAIM 2x</button></div>`)
  root.appendChild(eventPanel)

  // Help / stats panel.
  const helpPanel = el('div', 'hud-panel', `
    <button class="hud-close">✕</button>
    <h2 class="stroke">How to play</h2>
    <table>
      <tr><td>Move</td><td>WASD / Arrows</td></tr>
      <tr><td>Jump</td><td>Space</td></tr>
      <tr><td>Look</td><td>Mouse (click to lock), wheel to zoom</td></tr>
      <tr><td>Interact</td><td>E</td></tr>
    </table>
    <p>Run on a <span class="big">treadmill</span> to grow hair. Hair opens the gates in the course behind <span class="big">START</span>. Escape to earn Wins and unlock new hair styles!</p>
    <table class="stats"></table>
    <div class="row"><button class="hud-btn grey stroke menu">Settings</button></div>`)
  root.appendChild(helpPanel)

  const panels = [eventPanel, helpPanel]
  const openPanel = (p) => {
    const was = p.classList.contains('open')
    panels.forEach((x) => x.classList.remove('open'))
    if (!was) p.classList.add('open')
    document.body.classList.toggle('win-open', !was)
    if (!was && document.pointerLockElement) document.exitPointerLock?.()
  }
  for (const p of panels) {
    p.querySelector('.hud-close').addEventListener('click', () => openPanel(p))
  }
  quest.querySelector('.skip').addEventListener('click', () => onSkipQuest?.())
  helpPanel.querySelector('.menu').addEventListener('click', () => onMenu?.())
  eventPanel.querySelector('.claim').addEventListener('click', () => onClaimBoost?.())

  let promptAction = null
  prompt.addEventListener('click', () => promptAction?.())

  // Cached last-shown values so the DOM only changes when something does.
  const last = {}
  const set = (key, value, fn) => {
    if (last[key] === value) return
    last[key] = value
    fn(value)
  }

  return {
    openEvent: () => openPanel(eventPanel),
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
        hair.classList.add('bump')
        setTimeout(() => hair.classList.remove('bump'), 140)
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
  }
}
