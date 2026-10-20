# Hair Escape

Browser 3D obby/simulator for the **Bloxity** portal. Players run on treadmills to grow hair (the currency), buy hair styles and treadmills, rebirth, and cross obstacle zones for Wins. Plain JavaScript (ES modules), **three.js 0.171** and **Vite 5**. No framework, no TypeScript, no tests, no linter.

## Mobile & responsive requirements

- The game must run smoothly on mobile. Keep frame rate and memory in mind for every change: limit draw calls, geometry and texture sizes, per-frame allocations and shadow cost, and cap the renderer pixel ratio.
- The game must be mobile friendly. Support touch input alongside keyboard/mouse (including the jump, hair cable and interact actions), and never rely on hover-only interactions.
- All UI (HUD, lobby panels, popups, toasts, chat) must be responsive across phone, tablet and desktop, in portrait and landscape. Use relative units, flex/grid and safe-area insets, and keep touch targets large enough to tap.
- Handle resize and orientation changes for the renderer, camera and UI.
- Check new features at mobile viewport sizes before calling them done.

## Commands

```bash
npm run dev         # Vite dev server
npm run build       # production build -> dist/
npm run build:dev   # dev-mode build (what the `dev` deploy channel ships)
npm run preview     # serve dist/
```

- `.env`: set `VITE_DEV_MODE=true` to skip the Bloxity SDK and avatar CDN, so you play on the fallback avatar. In dev runs (which never save), `VITE_DEV_HAIR` / `_LEVEL` / `_WINS` / `_REBIRTHS` / `_OWNED` / `_EQUIPPED` set the starting stats. See `.env.example`.
- Dev console hook (dev only): `__game.teleport(x, y, z)`, `__game.player`, `__game.game` (progression state), `__game.setHairLength(n)`.
- There is no test suite. To verify a change, run the dev server and play it.

## Deploy

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds and uploads `dist/` to Bloxity hosting on every push:
- `main` → `prod` channel (`npm run build`)
- `dev` → `dev` channel (`npm run build:dev`)

It needs `LEGION_GAME_ID` (var or secret) and `LEGION_DEPLOY_TOKEN` (secret). Pushing to `main` or `dev` deploys live, so commit and push only when asked.

## Architecture

The entry point is [src/main.js](src/main.js). It creates the renderer, scene and zones, connects progression to the HUD, and runs one `setAnimationLoop` frame:

```
cable.fire? → stepPlayer → treadmills → zones (lava/ice) → interaction prompt → lobby.update
→ avatar transform + animator → hair → cable → hairRope → camera → render
```

| Area | Files | Role |
|---|---|---|
| Tunables | [src/config.js](src/config.js) | **Every** physics, camera, hair, grapple, animation, lighting and SDK-setting constant. Change numbers here, not inline. |
| Progression | [src/game/state.js](src/game/state.js) | One mutable `state` singleton holding hair, XP/level, wins, rebirths, owned styles, quests, chests, spin, gift and boost, plus the salon's worn cut, charms, aura, trail, length pick and days played. Hair styles and salon items with a `price` are bought by **spending Wins** (`equip` / `wearCosmetic`). They show as buyable once the player has that many. `rebirths` / `days` / `owns` are thresholds and are never spent. Spending Wins can re-lock teleport stages; that's intended. Salon items are worn with `wearCosmetic` / `takeOffCosmetic` / `wearBestCharms` / `setLengthPick`. Charm and trail multipliers feed `hairPerStep`. It also holds `HAIR_STYLES`, `QUESTS` and `CHESTS`. Saved to `localStorage` under `hair-escape-save-v1`. |
| Player | [src/player.js](src/player.js), [src/input.js](src/input.js), [src/touch.js](src/touch.js), [src/camera.js](src/camera.js) | Kinematic capsule singleton `player`, which is mutated in place. `inputState` is a shared mutable input bag, written by the keyboard/mouse (input.js) and by the touch controls (touch.js). Third-person orbit camera. |
| Collision | [src/colliders.js](src/colliders.js) | Yaw-rotated boxes from `addCollider(cx, cz, w, d, y1, rotY, y0)`. Box tops within `PHYSICS.stepUp` count as floor. Set `box.off = true` to disable a box. Also provides `raycast` and `segmentClear` for the camera and cable. |
| World | [src/world.js](src/world.js), [src/textures.js](src/textures.js) | Sky shader, ground and lights. All textures are painted procedurally on canvas, and there are no image assets. |
| Zone 1: Hub | [src/lobby/](src/lobby/) | `buildLobby(scene, addCollider, opts)` → `{ interactables, treadmills, portalHit, refresh(state, name), update(dt, t) }`. The submodules cover treadmills, the hair shop, leaderboards, the south wall, labels, canvas painting and shared builders. |
| Zone 2: Lava Run | [src/lavaPath.js](src/lavaPath.js) | Voxel canyon. Exports `kit`, `voxelTexture`, `lavaTexture` and `buildTree`, which Zones 3 and 4 reuse. |
| Zone 3: Ice Lake | [src/zone3.js](src/zone3.js) | Floes to the goal platform's win pad (`ZONE3_WIN`); the run carries on. |
| Zone 4: Desert Canyon | [src/zone4.js](src/zone4.js) | Quicksand basin, diamond gate (bonus ring), climbing pillars (`climbAt`, main.js lifts the player), red-lava pit, pink platform win pad (`ZONE4_WIN`); the run carries on. |
| Zone 5: Purple Palace | [src/zone5.js](src/zone5.js) | Pink walkway, lava strip and pink plateau to two crenellated thick-walled buildings and a tall tower; a ledged lava slit into a lava courtyard with a pedestal and a gold octagon window into a long lava chamber (pillar, big landing, +1 Win ring `ZONE5_BONUS`, stepped pedestals, banded towers) to the final platform, whose pad awards `ZONE5_WIN` and sends you home (the last stage for now). `WORLD_BOUNDS.minZ` in config.js must stay north of its back wall. Reuses `arrowTexture` / `decal` from zone4.js. |
| Avatar | [src/avatar/](src/avatar/) | `character.js` (bundled `public/avatars/player.glb`, with a procedural fallback), `loader.js` + `cdn.js` (Bloxity cosmetics), `rig.js` + `animator.js` (procedural pose animation), `hair.js` (head cap, hanging chain and floor trail rope). |
| Hair cable | [src/hairCable.js](src/hairCable.js) | Space shoots the hair tip; while it flies the camera follows it (`setCameraFocus` in camera.js) and the look input (right-drag, pointer-lock mouse, touch drag) steers it instead of the camera. It sticks to the first surface it hits and the player rides the flown path to the anchor; a miss reels back in once the full reach is used. States: `idle → flying → riding → idle`, plus `retracting`. Reach scales with hair length. |
| Speed rush | [src/speedFx.js](src/speedFx.js) | While zipping on the cable: radial streaks and a tinted vignette on one low-res canvas overlay (z-index 3, under the touch controls and HUD, no pointer events), plus FOV boost, camera shake and a player glow sprite. Tunables in `SPEED_FX`. |
| Hair Salon | [src/salon/](src/salon/), [src/game/cosmetics.js](src/game/cosmetics.js) | The HUD's Hair button opens it. It is a separate scene ([room.js](src/salon/room.js)), and `main.js`'s `avatarLayer` (character, hair rope, adornments, trail) moves into it while it is open, so the world isn't stepped or rendered then. The tabs are Styles (hair cuts), Colors (`HAIR_STYLES`), Charms, Auras, Trails and Length, and each tab has its own camera framing in `SALON.views`. [salonUi.js](src/salon/salonUi.js) draws the overlay, and its `free` rect is the screen area the camera centres and fits the player into (`setViewOffset`). The catalogs are in cosmetics.js. |
| Cosmetics on the avatar | [src/avatar/hair.js](src/avatar/hair.js), [adornments.js](src/avatar/adornments.js), [trail.js](src/avatar/trail.js) | A cut (`setHairCut`) shapes the rope (strands, braid twist, bubbles, waves) and adds head pieces. Charms (top/middle/tip) and aura rings ride the rope via `hairRope.sample()`. The run trail is a ribbon behind the player. The hair shows `visibleHair()` (the length cut by the slider), while the cable's reach uses the grown hair (`setGrownLength`). |
| HUD | [src/hud.js](src/hud.js) | DOM overlay with CSS-in-JS: quest pill, counters, buttons, panels, toasts, popups and chat. `createHud(callbacks)`. Laid out at 1918x993 and scaled by `--s` to fit the viewport. Touch phones get a compact layout (`#hud.compact`). |
| SDK | [src/bloxity.js](src/bloxity.js) | The only place that touches `window.Legion.SDK`: auth, avatar, proportions, settings, menu and loading events. |

**Map and coordinates:** see [LANDMARKS.md](LANDMARKS.md). Units are metres, the ground is `y = 0`, **north is −Z**, east is +X. The zones run north in a line from the Hub's START doorway (`z = −34`). Keep LANDMARKS.md in sync when you move or add landmarks.

## Contracts and patterns

- **Zones** are built as `buildX(scene, addCollider)` and return `{ contains(p), update(dt, time, p) → 'fell' | 'finish' | null, reset() }`. [src/main.js](src/main.js) `updateZones` handles respawns and wins. To add a zone, follow this shape, reuse `kit`/`voxelTexture` from lavaPath.js, and add a teleport stage in `createHud({ stages })` and `currentStage`.
- **Interactables** are `{ position, radius, prompt() → [text, enabled], action() }` in `lobby.interactables`. The nearest one in range drives the prompt, and **E** runs it.
- **Progression changes** must go through the exported functions in state.js (`addHair`, `addWin`, `buy`, `equip`, `rebirth`, `setFlag`, …). Each of them calls the internal `changed()`, which advances quests, notifies `onChange` listeners (HUD, lobby, hair visuals) and schedules a save. Use `emit` / `onEvent` for one-off celebrations (toasts). Never mutate `state` from outside without calling one of these.
- **When you add a save field**, give it a default in `fresh()`. `load()` merges saved data over `fresh()`. Nested objects such as `flags` and `chests` are merged explicitly, so extend that merge if you add a new nested object.
- **The SDK is optional.** Nothing in bloxity.js or avatar/loader.js may throw outward. A blocked SDK or CDN must leave the game fully playable. Guard every SDK call and log with `console.warn('[module] …')`.
- **Avatar loads race.** `loadAvatar` uses a `generation` counter because the SDK fires change events twice (optimistic, then confirmed). Keep handlers idempotent.
- **Input** is edge-triggered. Flags like `jump`, `grapple` and `interact` are cleared by the system that consumes them. Controls: WASD/arrows to move, Shift to jump, Space for the hair cable (right-drag / mouse / touch drag steers its tip while it flies), E to interact, right-drag/pointer lock to look, the wheel to zoom, Esc for the portal menu.
- **Touch** (touch.js) turns on for touch-first devices, or at the first touch, by adding `touch-ui` to `<html>`. It provides a floating move stick (left part of the screen), drag to look, pinch to zoom, and Jump / Hair-cable buttons. The tappable HUD prompt is the interact button. input.js ignores `pointerType === 'touch'`. Keep both input paths writing the same `inputState` fields, and size touch targets at ≥44 CSS px.
- **Animation poses** are authored in CHARACTER space (+X swings a limb backward) in `ANIM` (config.js). The bone names are in `rig.js` `BONE_NAMES`.
- **Hot paths are allocation-free:** reuse `Vector3`s and scratch objects in per-frame code (colliders, cable, hair, camera). Clamp `dt` (already done in main.js).
- **Assets:** keep everything procedural (canvas textures, primitives). The only binary asset is `public/avatars/player.glb`. Load it via `import.meta.env.BASE_URL`.

## Code style

- No semicolons, single quotes, 2-space indent, trailing commas, long lines are fine. Use named exports only.
- Import from `'three'` by name. Import addons from `three/examples/jsm/...`.
- Each module starts with a block comment explaining *what it is and why*. Comments explain intent and units (`// m/s`, `// rad`, `// 1/s`), not mechanics.
- Use the shared `clamp` from config.js. UI and world text use the **Fredoka** font (`FONT` in lobby/paint.js). Wait for `onFontReady` before painting canvas text.
- Write numbers with units and keep tunables named in config.js or as top-of-module constants. Don't add unexplained magic numbers.
