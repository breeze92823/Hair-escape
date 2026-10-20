// Sound effects: one lazily made <audio> element per sound in SFX (config.js), restarted on each
// play, plus a delegated click / hover tick for every UI <button>. Playback is best effort: a
// blocked autoplay or missing file just stays silent. Volumes follow the sfx_volume setting.
import { SFX } from './config.js'
import { settings } from './bloxity.js'

const players = {}

export function playSfx(name) {
  const def = SFX[name]
  if (!def) return
  try {
    let a = players[name]
    if (!a) {
      a = players[name] = new Audio(`${import.meta.env.BASE_URL}audio/${def.file}`)
      a.preload = 'auto'
    }
    a.volume = def.volume * (settings.sfx_volume ?? 1)
    a.currentTime = 0
    a.play()?.catch(() => {})
  } catch {}
}

const canHover = () => matchMedia('(hover: hover)').matches // no hover tick on touch screens
// The touch Jump / Hair-cable pads are game controls, not UI: they stay silent.
const uiButton = (target) => {
  const b = target.closest?.('button')
  return b && !b.disabled && !b.closest('#touch') ? b : null
}

export function installClickSound() {
  let lastBtn = null
  document.addEventListener('mouseover', (e) => {
    const b = uiButton(e.target)
    if (b === lastBtn) return
    lastBtn = b
    if (b && canHover()) playSfx('hover')
  })
  document.addEventListener('click', (e) => uiButton(e.target) && playSfx('click'), true)
}
