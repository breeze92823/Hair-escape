# Hair Escape — Landmarks & Map

The game has five zones in a line running north from the Hub's START doorway:

| Zone | Area | Source |
|------|------|--------|
| **1. HUB (Lobby)** | x −26 … 26, z −34 … 50 (open-roofed lavender stud-brick hall, walls 13.5 high) | [src/lobby/](src/lobby/) |
| **2. LAVA RUN** | x −80 … 80, z −34 … −97 (voxel canyon: lava river, stone slabs, finish platform) | [src/lavaPath.js](src/lavaPath.js) |
| **3. ICE LAKE** | x −80 … 80, z −97 … −159 (sunken lake: ice floes, glaciers, crystal spikes, +3 Wins goal platform) | [src/zone3.js](src/zone3.js) |
| **4. DESERT CANYON** | x −160 … 160, z −157 … −312, 2x scale (quicksand basin, diamond gate, climbing pillars, red-lava pit, pink finish platform) | [src/zone4.js](src/zone4.js) |
| **5. PURPLE PALACE** | x −20 … 37, z −259.2 … −375 (pink walkway, lava strip and pink plateau to two crenellated thick-walled buildings and a tall tower; a ledged lava slit into a lava courtyard with a pedestal, a gold octagon window into a long lava chamber: pillar, big landing, +1 Win ring, stepped pedestals, banded towers and the final platform's +15 Wins pad) | [src/zone5.js](src/zone5.js) |

Coordinates are world units `(x, y, z)`; the ground is `y = 0`. **North is −Z**, east is +X. Tunables are in [src/config.js](src/config.js).

---

# Zone 1 — HUB (Lobby)

## Hub map (looking down −Z, north at top)

```
 x:  -26      -17  -9.5         0        9.5   17      26
      |        |    |           |         |    |       |
z=-34 ▓▓ [TOP WINS][TOP HAIR] [START] [REBIRTHS][PRESTIGE] ▓▓   ← north wall (START doorway → Zone 2: LAVA RUN)
z=-29.4                  (gold pad)
z=-24.5            🎁 gift (-7.6)                      ║ x1 treadmill (z -26)  💤 AFK guy on ledge (z -29.5…-18.5)
z=-28…20  ▒▒ bleachers (HAIR SHOP)   ░░ red carpet ░░  ║ x2 (-20.6) x3 (-15.2) x4 (-9.8) x6 (-4.4)
                                     ● SPAWN (0, 2)    ║
z=3.6…19.8                                              ║ x8 (3.6) x12 (9.0) x25 (14.4) x100 (19.8)
z=20…30  ◢ LIMITED corner (west)                        ▓ LUCKY SPIN tower (23, 26.5)
z=32.6                                                  ║ x500 treadmill
z=40…43   [comb][shampoo][group]  ⛃ EVENT arch   ✦ rebirth altar (11.5, 40.5)  [REBIRTH CHEST (6.2, 42)]
z=50      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ south wall (CHESTS) ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

## Hub landmarks

| # | Landmark | Position (x, y, z) | Notes |
|---|----------|--------------------|-------|
| 1 | **Spawn** | (0, 0.3, 2) | On the red carpet, facing the START portal (north) |
| 2 | **Red carpet** | x ±4.5, z −27 → 44 | Yellow borders; runs from the portal to just short of the chests |
| 3 | **START portal** | (0, 0, −34) | Gold doorway, 9 wide × 8.6 high. Open: walking out sets the "portal" quest flag and leads into Zone 2, LAVA RUN. Round gold pad at (0, 0, −29.4) |
| 4 | **Leaderboards** | z −33.5, x −17 / −9.5 / 9.5 / 17 | TOP WINS, TOP HAIR (left of portal); TOP REBIRTHS, TOP PRESTIGE (right) |
| 5 | **Gift** | (−7.6, 0, −24.5) | Claimable gift box |
| 6 | **Bleachers / HAIR SHOP** | x −26 → −10.5, z −28 → 20 | Three red tiers (h 0.55 / 1.1 / 1.65) displaying every hair style; press **E** to equip / buy |
| 7 | **Limited corner** | x −26 → −14.5, z 20 → 30.4, h 2.2 | White stage for limited-time styles (curly, tails, braids, princess) |
| 8 | **Treadmills** | x = 21, z −26 → 32.6 | Belts drag toward +X; running grows hair (see below) |
| 9 | **AFK guy** | x 23.6, z −29.5 → −18.5, y 4.9 | Sleeping on a ledge above the x1 treadmill |
| 10 | **Lucky Spin tower** | (23, 0, 26.5) | Striped 5×5 tower, 7.7 high; **E** to spin |
| 11 | **Rebirth altar** | (11.5, 0, 40.5) | Purple pedestal with a spinning halo; **E** to rebirth |
| 12 | **Chests** | z 41.5 → 43 | Rebirth Chest (6.2, 42), Group (−5.2, 43), Shampoo (−9, 41.5), Comb (−12.8, 43) |
| 13 | **EVENT arch** | (0, 0, ~49.4) | Blue/purple arch in the south wall; opens the EVENT panel |

### Treadmills (x = 21)

| Tier | z | Unlock |
|------|---|--------|
| x1 | −26 | FREE |
| x2 | −20.6 | 1 Rebirth |
| x3 | −15.2 | 2 Rebirths |
| x4 | −9.8 | 4 Rebirths |
| x6 | −4.4 | 6 Rebirths |
| x8 | 3.6 | 85,000 hair |
| x12 | 9.0 | 139,000 hair |
| x25 | 14.4 | 279,000 hair |
| x100 | 19.8 | 729,000 hair |
| x500 | 32.6 | 2,239,000 hair |

---

# Zone 2 — LAVA RUN

Entered by walking out through the START doorway. A lava river (y 0.08, cracked Voronoi texture) fills a voxel canyon between brown dirt cliffs topped with grass terraces and blocky trees. Four thick stone slabs (top y 1.6) cross it, separated by 3 m lava gaps, to the finish platform, which is also the entrance to Zone 3. A slate arch spans the canyon just short of the finish. Dropping into the lava respawns you at the Hub spawn.

## Lava Run map

```
 x:  -80      -32      -15   -4.5 0 4.5   15      32       80
       |        |        |      |  |  |    |       |        |
z=-34  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ [START doorway] ▓▓▓▓▓▓▓▓▓▓▓▓▓▓      ← Hub north wall
z=-34…-36.4               steps 0.55 / 1.1
z=-36.4…-50  plateau  terrace  🔥 [ SLAB 1 ] 🔥  terrace  plateau   (9 wide, ^^)
z=-53…-63    (y 8)    (y 6)    🔥 [ SLAB 2 ] 🔥   🌳🌳     (y 8)     (8.5 wide)
z=-66…-74                      🔥 [ SLAB 3 ] 🔥                     (8.5 wide)
z=-77…-84                      🔥 [ SLAB 4 ] 🔥                     (8 wide)
z=-85.5     ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒ ARCH (x ±46, peak y 16) ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒     "LAVA RUN" sign on top
z=-87…-97                      [ ▣+1  FINISH  ⊞x1 ]                 (12 wide) → Zone 3
```

## Lava Run landmarks

| # | Landmark | Position (x, y, z) | Notes |
|---|----------|--------------------|-------|
| L1 | **Zone sign "LAVA RUN"** | (0, ~18.4, −85.5) | Floating billboard above the arch: "LAVA RUN / Stay on the path!" |
| L2 | **Lava river** | x ±15, z −34 → −97, y 0.08 | Feet below y 0.18 anywhere in the canyon = respawn at the Hub spawn |
| L3 | **Stone slabs** | x 0, z −34 → −84, top y 1.6 | Four slabs with 3 m gaps; entry steps at the doorway |
| L4 | **Finish platform / Zone 3 entrance** | (0, 1.6, −92), 12×10 | Grass-capped stone posts on the lake-side corners |
| L5 | **+1 Win pad** | (−3, 1.6, −92), 3×3 | Yellow pad; stepping on it awards **+1 Win** once per run (no teleport, the run carries on into Zone 3). A gold trophy spins above it with a "🏆 +5 Wins" sign advertising the Zone 3 reward |
| L6 | **x1 Hair ladder** | (3.5, 1.6, −92) | Grey ladder on a grass base with an "x1 Hair" sign; decoration only |
| L7 | **Canyon cliffs / terraces** | \|x\| 15 → 32, top y 6 | Dirt cliffs with ledges, grass terraces with voxel trees and red blocks; dark plateau (y 8) beyond \|x\| 32 |
| L8 | **Arch bridge** | z −85.5, x ±46 | Dark cobblestone arch, feet on the plateau; decoration only (no collider) |

---

# Zone 3 — ICE LAKE

Continues north from the Lava Run finish platform. A long sunken lake (bright blue water, y 0.12) runs between sheer dark-blue walls topped with snow. Stepped ice terraces with tall tilted crystal spikes rise behind the walls, getting taller toward the north. Beyond them are grass terraces with blocky trees and grey voxel mountains in the distance. Hop the ice floes to the goal platform, which awards **+3 Wins** and doubles as the entrance to Zone 4.

## Ice Lake map

```
 x:  -80    -50   -40  -30 -22      0      22  30   40   50    80
       |     |     |    |   |       |       |   |    |    |     |
z=-97  ════════════════════ [Lava Run finish] ═════════════════════
z=-99…-109   grass  glacier shelf wall  ▢ ▢ floes ≈≈  wall shelf glacier  grass
z=-112…-118  🌳 (y7) ▲(y9) ▲(y6) (y3)   [■ rest block ■]  ≈≈≈≈        ▲    ▲   🌳
z=-117                                  "RECOMMENDED / LEVEL 16"
z=-120…-135                             ▢  ▢  ▢ floes ≈≈≈
z=-137.5…-143.5                         [■ rest block ■]
z=-147…-157                    [ 🪑 ▣+3  GOAL  ⊞x1.1 ]  ▮ ▮ tall ice columns → Zone 4
```

## Ice Lake landmarks

| # | Landmark | Position (x, y, z) | Notes |
|---|----------|--------------------|-------|
| Z1 | **Ice lake** | x ±22, z −97 → −162, y 0.12 | Feet below y 0.27 in the water = respawn on the entrance at (1, 1.6, −93) |
| Z2 | **Floe path** | z −99 → −143.5 | Five floes (top y 1.0) and two snow-capped rest blocks (top 1.8 at z −115, 2.0 at z −140.5); 2–3.5 m gaps. About 20 thin floes (top 0.35–0.6) are scattered off the path |
| Z3 | **Level sign** | (0, 3.8, −117) | Floating "RECOMMENDED / LEVEL 16" |
| Z4 | **Goal platform / Zone 4 entrance** | (0, 1.6, −152), 14×10 | Snow-white ice platform; low pillars on the lake-side corners, tall snow-capped ice columns (5 m) on the canyon-side corners |
| Z5 | **+3 Wins pad** | (−3.2, 1.6, −152), 3×3 | Yellow pad; awards **+3 Wins** (`ZONE3_WIN`) once per run, and the run carries on into Zone 4. A spinning trophy above advertises "🏆 +10 Wins" (Zone 4). An ice throne stands behind it at (−5.4, 1.6, −154.6) |
| Z5b | **x1.1 Hair treadmill** | (3.6, 1.6, −152) | Light-blue treadmill with a drifting striped belt and an "[x2 Boost] x1.1 Hair" sign; decoration only |
| Z6 | **Lake walls** | \|x\| 22 → 30, top y 3 | Sheer dark-blue cliffs, snow blocks along the top |
| Z7 | **Ice terraces & spikes** | shelf \|x\| 30 → 40 (y 6), glacier \|x\| 40 → 50 (y 9) | Light-blue stepped ice; crystal spikes from 5 m tall near the entrance to ~24 m at the north end |
| Z8 | **Grass terraces** | \|x\| 50 → 80, top y 7 | Dirt sides, grass top, blocky trees |
| Z10 | **Mountains** | x ±100 … 150, z −110 … −185 | Dark grey stepped voxel peaks, mostly to the east; decoration only |

---

# Zone 4 — DESERT CANYON

Continues north from the Ice Lake goal platform. **Built at 2x the scale of the other zones** (`S` in zone4.js), measured against the 1.8 m player in the reference shots, where the island pillar is ~7.5 player heights across. Cacti are 1.4x. Walkable heights and gaps are not scaled, so every jump stays within the player's ~1.28 m rise / ~6.8 m reach, and the climbing panels carry the extra height.

A basin of wavy orange quicksand runs between stepped terracotta sandstone terraces (dark strata bands, light overhanging lips, cacti, some with red flowers, and tall mesas). Hop the entry slab and the banded island pillar to the stone and the bridge through the **diamond gate**, where a bonus ring hangs. In the courtyard beyond, climb a **blue panel** up one of the two pillars (hold any move key against it), cross the **red-lava pit** on two blocks and step on the yellow pad on the **pink platform**, where Zone 5's walkway carries on north. Falling into the quicksand or the lava respawns you on the Ice Lake goal platform.

## Desert Canyon map

```
 x:  -48   -32   -20    -8 -5.2  0  5.2   8    14    20   32    48
       |     |     |     |    |   |   |    |    |     |    |     |
z=-157 ══════════════ [Ice Lake goal platform / entrance] ══════════════
z=-162.5    T1   [ENTRY SLAB]              ┌─────────────────┐   T1
z=-174      (y10)     [■ ISLAND ■]          │ RIGHT TERRACE    │ (pale column)
z=-185      ≈≈ quicksand ≈≈  [STONE]        └─────────────────┘
z=-191…-203 ▓▓▓ FIN (y24) ◆ ▓▓▓▓▓ ┃bridge ◯+1┃ ▓▓▓▓▓ ◆ FIN (y24) ▓▓▓
z=-207.6    WING     ≈≈   [st]          [st]   ≈≈     WING (y32)
z=-211…-217.4         ▮PILLAR▮(blue)   ▮PILLAR▮(blue)  (y 24.8)
z=-217.4…-259.2 🔥 red-lava pit (y 21)  [step] [step]  🔥
z=-242.4…-259.2          [ PINK PLATFORM ▣+10 ▣ ]  (y 26.3)   obelisk (36, -223)
z=-259.2…-375  → Zone 5: PURPLE PALACE (pink walkway, lava strip, pink plateau, palace)
```

## Desert Canyon landmarks

| # | Landmark | Position (x, y, z) | Notes |
|---|----------|--------------------|-------|
| D1 | **Quicksand basin** | x ±32, z −157 → −217.4, y 0.08 | Wavy orange sand; feet below y 0.18 = respawn on the Ice Lake goal at (1, 1.7, −148.5) |
| D2 | **Entry slab** | (−8, 1.6, −162.5), 10×7 | Under the floating "RECOMMENDED / LEVEL 46" sign |
| D3 | **Island pillar** | (−2, 2.4, −174), 10×10 | Dark-red foot, banded body, light cap; a cactus, a crate and a light slab on top |
| D4 | **Stone** | (0, 3, −185), 6×6 | Last hop before the gate |
| D5 | **Right terrace** | x 14 → 32, z −163 → −191, top 6.8 | Banded; pale column at (25, −179), cacti |
| D6 | **Diamond gate** | fins x ±5.2 → ±32, z −191 → −203, top 24 | Gold diamonds with teal centres at (±18, 13.6), red-and-white strips down the inner corners. Bridge through the gap (9.6 wide, top 3) |
| D7 | **Bonus ring** | (0, ~5.8, −197) | Gold ring (r 2.6) over the bridge; walking through it awards **+1 Win** (`ZONE4_BONUS`) once per run |
| D8 | **Climbing pillars** | (±8, −214.2), 6.4×6.4, top 24.8 | Dark-red base, blue climbing panel (4 wide) on the south face from y 3.5 to the top, with a yellow up arrow below and a red arrow near the top. Stones at (±8, 2.6, −207.6) to step off onto the panel. Climb speed `PHYSICS.climbSpeed` |
| D9 | **Red-lava pit** | x ±20, z −217.4 → −259.2, y 21 | Cracked red lava (the Lava Run texture). Two 10×8 blocks cross it: z −224.4 (top 25.3) and z −235.4 (top 25.8) |
| D10 | **Pink platform / win pad / Zone 5 entrance** | (0, 26.3, −250.8), 28×16.8 | Yellow pad at (−5, −251) awards **+10 Wins** (`ZONE4_WIN`) once per run, and the run carries on into Zone 5. Blue pad at (5, −251) is decoration |
| D11 | **Purple wing caps** | x ±22 → ±32, z −251.2 → −312 (east → −259.2), y 32 → 46 | Purple blocks with pink caps on top of the wings |
| D12 | **Wings & towers** | x ±20 → ±48, z −203 → −375 (the east wing, its tower and the east terraces stop at −259.2, leaving open sky past Zone 5's plateau), top 32 | Enclose the courtyard and pit. Sandstone towers at (−39, y 52–60) and (39, y 48); tall pale obelisk at (36, −223) to y 70 |
| D13 | **Sandstone terraces** | T1 |x| 32 → 48, T2 → 68, T3 → 100, T4 → 160 | Tops rise per band (z −157 / −183 / −209): T1 10 / 13 / 16, T2 18 / 22 / 26, T3 28 / 34 / 40, T4 22 / 24 / 26 |

---

# Zone 5 — PURPLE PALACE

Continues north from the Desert Canyon's pink finish platform (y 26.3). A pink walkway runs along the platform's east side, beside a 4 m strip of the red-lava pit that keeps flowing north. A tall dark-purple wall with hot-pink beams lines the walkway's west side, and a raised pink plateau with crystals lines the lava's east side. Past the plateau is open sky: Zone 4's east wing and terraces stop at the finish platform. A sand block at the walkway's edge is the step across the lava onto the plateau. The walkway ends at the palace: two crenellated, thick-walled (3 m) hollow buildings either side of a narrow lava slit (gold lines, magenta bands with yellow arrows pointing at it, a pink rim and a hot-pink stripe under the battlements), and a taller plain tower on the east. Inside, the slit is lined in magenta with a thin pink ledge along each wall and opens into an open-roofed lava courtyard: jump 6 m from a ledge onto the big pink pedestal in the middle, then 6 m across (level) through the gold octagon window in the north wall into the lava chamber behind it. There, hop ~5.7 m diagonally onto the small pillar, then 6 m west onto the big pink landing. From the landing, jump 4.5 m north through a gold **+1 Win** ring (`ZONE5_BONUS`, once per run) onto a pedestal, walk up the yellow block on it, hop ~3.9 m onto a higher pedestal, then 4 m east onto the **final platform**. Its yellow pad awards **+15 Wins** (`ZONE5_WIN`, once per run) and sends you back to the Hub after 1.8 s. This is the end of the run for now. All the jumps are within the ~6.8 m running-jump reach. Dropping into the lava, or off the plateau's open east side, respawns you at the start of the walkway (`ZONE5_SPAWN`, (9.25, 26.4, −261.2)).

## Purple Palace map

```
 x:  -20          4.5      14   18      27     34
       |            |        |    |       |      |
z=-259.2 ═══ [Desert Canyon pink platform] ═══════      (east wing ends here → open sky past x 34)
z=-259…-273  ▓ WEST WALL ▓ [ WALKWAY ]▣🔥[ PINK PLATEAU ◆ ]
             (y 36.3, pink beams)   sand step  (y 27.1, crystals)
z=-270                "RECOMMENDED / LEVEL 48"
z=-273…-289  ┏━ WEST BUILDING ━┓ ▭🔥▭ ┏ MID ┓ ▓EAST▓   battlements, y 44.3 (east tower y 50.3)
             ┃   (hollow)      ┃ slit ┃     ┃ ▓TOWER▓
             → magenta band →        ← band ←
z=-289…-309  ▓▓▓ │  🔥🔥  [ PEDESTAL ◆ ]  🔥🔥🔥  │▓▓▓   open-roofed lava courtyard, x 2 → 34
z=-309…-312  ▓▓▓▓▓▓▓▓▓ → ⬡ octagon window ⬡ ← ▓▓▓▓▓▓▓▓   north wall (violet)
z=-312…-321  ▓▓▓ │  🔥🔥🔥🔥🔥🔥  [PILLAR ◆] 🔥  │▓▓▓   lava chamber (magenta south face, arrows at the window)
z=-322…-336  ▓▓▓ │ [ ◆ BIG LANDING ]   🔥🔥🔥🔥🔥   │▓▓▓
z=-338          ◯+1 ring (9, 28.3)
z=-340…-346  ▓▓▓ ▣│ 🔥 [STEP 1 ▪] 🔥 ┌──────────┐ │▓▓▓   ▣ framed panel + ↑ arrow on the west wall
z=-346…-354  ▓▓▓ │▮🔥    [STEP 2] 🔥 │ ▣+15 ▣+30 │ │▓▓▓   ▮ banded towers (x 3 → 7)
z=-354…-366  ▓▓▓ │▮🔥 🔥 🔥 🔥 🔥 🔥 │ ⊞x1.4 ◆    │ │▓▓▓   FINAL PLATFORM (top 27.5)
z=-366…-372  ▓▓▓ │  🔥🔥🔥🔥🔥🔥🔥🔥 └──────────┘ │▓▓▓
z=-372…-375  ▓▓▓▓▓▓▓▓▓▓▓ back wall ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

## Purple Palace landmarks

| # | Landmark | Position (x, y, z) | Notes |
|---|----------|--------------------|-------|
| P1 | **Pink walkway** | x 4.5 → 14, z −259.2 → −273, top 26.3 | Flush with the Desert Canyon finish platform; two pale inlay stripes |
| P2 | **Lava strip** | x 14 → 18, z −259.2 → −273, y 21 | The pit's lava running on, in line with the slit; feet below y 21.15 = respawn at the walkway's start |
| P3 | **Sand step** | x 13.4 → 15.6, z −263.5 → −267, top 26.5 | Sand block at the walkway's edge, a small one stacked beside it; 2.4 m jump (0.6 m up) onto the plateau |
| P4 | **Pink plateau** | x 18 → 34, z −259.2 → −273, top 27.1 | Hot-pink crystal (25, −265, 3.5 m) and a pale one (22.6, −267.5). Open east edge: falling below y 19 = respawn |
| P5 | **West wall** | x −20 → 4.5, top 36.3 | Dark purple, pink cap; hot-pink beams jut over the walkway at y 34.7 (z −262 → −268) and y 32.3 (z −264 → −272) |
| P6 | **West & middle buildings** | west x −20 → 14, middle x 18 → 27, z −273 → −289, top 44.3 | Hollow shells, walls 3 m thick, floor inside at 26.3. Battlements (1.6 m merlons, pink caps) along the front and sides; pink rim and hot-pink stripe across the front. Magenta bands at y 31.8 with yellow arrows pointing at the slit; gold lines at x 5.2, 12.8, 19.4, 25.8 |
| P7 | **East tower** | x 27 → 34, z −273 → −289, top 50.3 | Plain, solid, pink cap. A wall as tall (x 34 → 37) carries on to z −330 as the courtyard's east wall |
| P8 | **Lava slit** | x 14 → 18, z −273 → −289 | Magenta-lined, dark-purple edges at the mouth. Pink ledges (1 m wide, top 26.3) along both walls: the west one at x 14 → 15 leads in off the walkway, the east one at x 17 → 18. Both end 6 m short of the pedestal |
| P9 | **Lava courtyard** | x 2 → 34, z −289 → −309, open roof | Lava floor (y 21); 10 m of lava west of the pedestal, 14 m east, 6 m south and north. South faces magenta, west wall dark purple with a hot-pink beam (y 32.3), east wall dark purple with a gold line and a magenta band whose arrow points north at the window |
| P11 | **Pedestal** | x 12 → 20, z −295 → −303, top 26.3 | 8 m square (~4.4 player heights). Purple body, yellow trim (0.3) under a pink top (0.8) with a pale inlay, yellow plate on its south face, hot-pink crystal (~2.4 m, ~1.3 player heights) near its east edge |
| P12 | **Octagon window** | (16, 26.3 → 31.3, −310.5), opening 4 × 5 | Gold octagon frame (0.9 thick, 4.2 deep) through the 3 m violet north wall; yellow arrows either side point at it. Pink sill at 26.3, level with the pedestal, a 6 m jump from it |
| P13 | **Lava chamber** | x 2 → 34, z −312 → −372, open roof | Lava floor with a brown rock rim along the walls. Window wall magenta on this side, yellow arrows either side of the window. East wall: dark recessed panels, two hot-pink beams, a pink-capped inner tier (y 36.3 → 38.3). Pink beams on the west and far walls |
| P14 | **Pillar** | x 22 → 27, z −316 → −321, top 26.3 | Small pedestal (same pink top / yellow trim / purple body) on a dark plinth; a crystal by its north-west corner. ~5.7 m diagonal hop from the window |
| P15 | **Big landing** | x 4 → 16, z −322 → −336, top 26.3 | Pink top, yellow trim, pale inlay border; tall hot-pink crystal and a pale one by its west edge. 6 m west of the pillar |
| P16 | **Bonus ring** | (9, 28.3, −338.2), r 1.5 | Gold ring on the jump north off the landing, "🏆 +1 Win" label; awards **+1 Win** (`ZONE5_BONUS`) once per run |
| P17 | **Step 1** | x 6 → 12, z −340.5 → −345.5, top 26.9 | Pedestal on a dark plinth, crystal; yellow block (x 10.2 → 11.6, z −343.3 → −344.7, top 27.5) is a walk-up step |
| P18 | **Step 2** | x 11 → 16, z −348.6 → −353.6, top 27.5 | Pedestal with a yellow plate, crystal; ~3.9 m north of the yellow block |
| P19 | **Final platform** | x 20 → 33, z −346.1 → −366.1, top 27.5 | 4 m east of step 2. Yellow pad (29, −352.1, 3.6 m) with a spinning trophy: **+15 Wins** (`ZONE5_WIN`), then home. Blue "+30 Wins" pad north of it is decoration. Decorative "[x2 Boost] x1.4 Hair" treadmill (25.5, −361.1) with a pink-and-yellow console; big crystal in the north-west corner |
| P20 | **Banded towers** | x 3 → 7, z −349 → −353 and −358 → −362, top 42.3 | Violet, gold corner lines, hot-pink bands every 3.5 m, flared pink cap with a crystal; solid (hair-cable targets) |
| P21 | **Framed panel** | west wall, (2, 33.3, −345.5) | Gold-framed purple panel with a yellow arrow pointing up at it; decoration. Crystals stand on the east wall's tier above the final platform |
| P10 | **Level sign** | (7.5, 29.5, −270) | Floating "RECOMMENDED / LEVEL 48" |

---

# Progression

1. Spawn → follow the floor chevrons to the **FREE x1 treadmill** and run to grow hair
2. Spend hair on the **hair shop** styles and the higher treadmill tiers
3. Walk out the **START** doorway and jump across the **lava slabs** to the **+1 Win** pad, hop the **ice floes** to the **+3 Wins** pad, then cross the **quicksand**, climb a **blue panel** and cross the **lava pit** to the pink platform for **+10 Wins** (plus **+1** for the gate ring), then walk on through the **Purple Palace** (ring **+1**) to its final platform for **+15 Wins**, which sends you home. Going back to the Hub resets the once-per-run pads
4. Open **chests**, claim the **gift**, use the **Lucky Spin**
5. **Rebirth** at the altar to raise the hair multiplier and unlock the rebirth-gated treadmills

> Wins come from the +1 Win pad at the end of the Lava Run, the +3 Wins pad at the end of the Ice Lake, the Desert Canyon gate ring (+1) and the pad on its pink platform (+10), and the Purple Palace chamber ring (+1) and its final pad (+15).
