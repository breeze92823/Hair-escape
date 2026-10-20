// "Log in with Bloxity" button: visible only while nobody is signed in, hidden once auth.user exists.
// Hidden until auth has settled (so it doesn't flash during loading) and in VITE_DEV_MODE (no SDK).
import { DEV_MODE } from './config.js'
import { sdk, subscribeAuth } from './bloxity.js'

const PORTAL_URL = 'https://bloxity.io'

function openLogin() {
  // Must run synchronously inside the click handler or browsers block the standalone popup.
  // showAuthPopup() picks the in-game modal (embedded) or the bloxity.io/auth popup (standalone);
  // the flow finishes by firing onUserChanged, so the returned promise is ignored.
  const auth = sdk()?.auth
  for (const name of ['showAuthPopup', 'showAuthModal', 'showAuthWindow']) {
    if (typeof auth?.[name] !== 'function') continue
    try {
      const result = auth[name]()
      if (result && typeof result.catch === 'function') result.catch(() => {})
      return
    } catch (err) {
      console.warn(`[login] auth.${name} failed`, err)
    }
  }
  window.open(PORTAL_URL, '_blank', 'noopener')
}

export function createLoginButton() {
  if (DEV_MODE) return
  const style = document.createElement('style')
  // Top centre: clear of the HUD's top-left counters, the touch sticks and the bottom prompt.
  style.textContent = `
#login-btn { position: fixed; top: calc(env(safe-area-inset-top) + 8px); left: 50%; transform: translateX(-50%); z-index: 50; min-height: 44px; padding: 8px 20px; border: 3px solid #1d2b53; border-radius: 12px; background: #ffd23f; color: #1d2b53; font: 600 clamp(15px, 2.4vmin, 20px) Fredoka, system-ui, sans-serif; white-space: nowrap; cursor: pointer; box-shadow: 0 4px 0 #1d2b53; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
#login-btn[hidden] { display: none; }`
  document.head.appendChild(style)
  const btn = document.createElement('button')
  btn.id = 'login-btn'
  btn.type = 'button'
  btn.textContent = 'Log in with Bloxity'
  btn.hidden = true
  btn.addEventListener('click', openLogin)
  document.body.appendChild(btn)
  subscribeAuth((s) => {
    btn.hidden = !s.ready || !!s.user
  })
}
