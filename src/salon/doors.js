// The Hair Salon doors: the transition into and out of the salon. Two pink salon doors
// slide shut over the screen, a HAIR SALON badge (scissors) pops onto the seam, the
// scene swaps behind them, then the badge shrinks away and the doors slide apart.
// The swap runs while they are shut, so the room's first build and its first render
// (shader compiles) hitch out of sight.
//
// A DOM overlay above the HUD, salon UI and touch controls, sized in vmin so it fits
// phones, tablets and desktops in either orientation. It swallows taps while it runs.
import { SALON } from '../config.js'
import { SCISSORS_ICON } from './icons.js'

const D = SALON.doors
const FRAMES_AFTER_SWAP = 2 // rendered frames of the new scene before the hold starts

const CSS = `
#salon-doors { position: fixed; inset: 0; z-index: 70; display: none; overflow: hidden; pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none;
  font-family: "Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif; font-weight: 700; --close: 0.42s; --open: 0.55s; --badge: min(40vmin, 320px); }
#salon-doors.run { display: block; }
#salon-doors * { box-sizing: border-box; }
#salon-doors .sd-door { position: absolute; top: 0; bottom: 0; width: 50.5%;
  background: repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1.6vmin, rgba(0,0,0,0.05) 1.6vmin 3.2vmin), linear-gradient(180deg, #e2479a, #a8237a 55%, #7c1760);
  transition: transform var(--open) cubic-bezier(0.55, 0, 0.35, 1) 0.12s; }
#salon-doors .sd-door.l { left: 0; transform: translateX(-104%); border-right: 1.4vmin solid #ffd21a; box-shadow: inset -0.5vmin 0 0 #f5a00c, 1vmin 0 3vmin rgba(0,0,0,0.45); }
#salon-doors .sd-door.r { right: 0; transform: translateX(104%); border-left: 1.4vmin solid #ffd21a; box-shadow: inset 0.5vmin 0 0 #f5a00c, -1vmin 0 3vmin rgba(0,0,0,0.45); }
#salon-doors.shut .sd-door { transform: none; transition: transform var(--close) cubic-bezier(0.3, 1.25, 0.6, 1); }
#salon-doors .sd-win { position: absolute; left: 50%; top: 9%; width: min(26vmin, 62%); aspect-ratio: 1; transform: translateX(-50%); border-radius: 50%;
  border: 1.4vmin solid #ffd21a; box-shadow: 0 0 0 0.6vmin #5a3200, inset 0 0 0 0.6vmin #f5a00c, inset 0 -2vmin 3vmin rgba(20,40,90,0.35);
  background: radial-gradient(circle at 34% 30%, rgba(255,255,255,0.85) 0 12%, transparent 13%), linear-gradient(160deg, #bff3ff, #5fc7f0 60%, #3a8fd8); }
#salon-doors .sd-panel { position: absolute; left: 13%; right: 13%; top: calc(9% + min(26vmin, 62%) + 6vmin); bottom: 7%; border-radius: 2vmin;
  border: 0.8vmin solid rgba(90,10,60,0.55); box-shadow: inset 0 0 0 0.7vmin rgba(255,170,215,0.35), 0 0.5vmin 0 rgba(255,255,255,0.15);
  background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.12)); }
#salon-doors .sd-handle { position: absolute; top: 42%; width: 2.4vmin; height: 16vmin; border-radius: 1.2vmin; background: linear-gradient(90deg, #f5a00c, #ffe86b 45%, #f5a00c);
  border: 0.5vmin solid #5a3200; box-shadow: 0 0.6vmin 0 rgba(0,0,0,0.3); }
#salon-doors .sd-door.l .sd-handle { right: 5%; }
#salon-doors .sd-door.r .sd-handle { left: 5%; }
#salon-doors .sd-badge { position: absolute; left: 50%; top: 50%; width: var(--badge); aspect-ratio: 1; border-radius: 50%; z-index: 1;
  transform: translate(-50%, -50%) scale(0) rotate(-20deg); transition: transform 0.16s ease-in;
  background: radial-gradient(circle at 50% 38%, #fff4fa, #ffc2e2 70%, #ff8cc8); border: calc(var(--badge) * 0.045) solid #15151f;
  box-shadow: inset 0 0 0 calc(var(--badge) * 0.035) #ffd21a, 0 calc(var(--badge) * 0.03) 0 rgba(0,0,0,0.35), 0 0 calc(var(--badge) * 0.2) rgba(255,120,200,0.6); }
#salon-doors.shut .sd-badge { transform: translate(-50%, -50%) scale(1) rotate(0deg); transition: transform 0.34s cubic-bezier(0.3, 1.6, 0.5, 1) calc(var(--close) * 0.8); }
#salon-doors .sd-badge svg { position: absolute; left: 50%; top: 10%; width: 56%; transform: translateX(-50%) rotate(-12deg); filter: drop-shadow(0 calc(var(--badge) * 0.012) 0 rgba(0,0,0,0.3)); }
#salon-doors .sd-sign { position: absolute; left: 50%; bottom: 8%; transform: translateX(-50%); padding: 0.1em 0.5em 0.15em; border-radius: 0.5em; white-space: nowrap;
  font-size: calc(var(--badge) * 0.13); line-height: 1; letter-spacing: 0.02em; color: #fff; -webkit-text-stroke: 0.14em #15151f; paint-order: stroke fill;
  background: linear-gradient(180deg, #ff5fb4, #c2307f); border: calc(var(--badge) * 0.022) solid #15151f; box-shadow: 0 calc(var(--badge) * 0.02) 0 rgba(0,0,0,0.35); }
`

export function createSalonDoors() {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const door = (side) => `<div class="sd-door ${side}"><i class="sd-win"></i><i class="sd-panel"></i><i class="sd-handle"></i></div>`
  const root = document.createElement('div')
  root.id = 'salon-doors'
  root.innerHTML = `${door('l')}${door('r')}<div class="sd-badge">${SCISSORS_ICON}<div class="sd-sign">HAIR SALON</div></div>`
  document.body.appendChild(root)

  let busy = false
  const wait = (s) => new Promise((done) => setTimeout(done, s * 1000))
  const frames = (n) => new Promise((done) => {
    const tick = () => (--n <= 0 ? done() : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  })

  // Shut the doors, run `swap` behind them, open them again. Ignored while already running.
  async function run(swap) {
    if (busy) return
    busy = true
    const k = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? D.reduced : 1
    root.style.setProperty('--close', `${D.close * k}s`)
    root.style.setProperty('--open', `${D.open * k}s`)
    root.classList.add('run')
    void root.offsetWidth // start the slide from the open pose
    root.classList.add('shut')
    try {
      await wait(D.close * k)
      swap()
      await frames(FRAMES_AFTER_SWAP)
      await wait(D.hold * k)
    } finally {
      root.classList.remove('shut')
      await wait(D.open * k + 0.15) // + the doors' opening delay
      root.classList.remove('run')
      busy = false
    }
  }

  return {
    run,
    get busy() {
      return busy
    },
  }
}
