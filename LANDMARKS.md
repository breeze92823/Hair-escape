# Hair Escape — Landmarks & Map

The game has three zones in a line running north from the Hub's START doorway:

| Zone | Area | Source |
|------|------|--------|
| **1. HUB (Lobby)** | x −26 … 26, z −34 … 50 (open-roofed lavender stud-brick hall, walls 13.5 high) | [src/lobby/](src/lobby/) |
| **2. LAVA RUN** | x −80 … 80, z −34 … −97 (voxel canyon: lava river, stone slabs, finish platform) | [src/lavaPath.js](src/lavaPath.js) |
| **3. ICE LAKE** | x −80 … 80, z −97 … −176 (sunken lake: ice floes, glaciers, crystal spikes, gold ring, sandstone fortress) | [src/zone3.js](src/zone3.js) |

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

Entered by walking out through the START doorway. A lava river (y 0.08, cracked Voronoi texture) fills a voxel canyon between brown dirt cliffs topped with grass terraces and blocky trees. Four thick stone slabs (top y 1.6) cross it, separated by 3 m lava gaps, to the finish platform, which is also the entrance to Zone 3. A slate arch spans the canyon just short of the finish. Dropping into the lava respawns you at the Hub spawn. On entering, the camera tilts up to a raised view looking north (`LAVA_RUN` in config.js).

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

Continues north from the Lava Run finish platform. A long sunken lake (bright blue water, y 0.12) runs between sheer dark-blue walls topped with snow. Stepped ice terraces with tall tilted crystal spikes rise behind the walls, getting taller toward the north. Beyond them are grass terraces with blocky trees and grey voxel mountains in the distance. Hop the ice floes to the gold ring on the far platform, under a terracotta sandstone fortress that teases the next zone. On entering (at the finish platform) the camera rises to a high view looking north past the player (`ICE_LAKE` in config.js).

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
z=-147…-157                             [ ◯ GOAL + gold ring ]
z=-162…-176  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ SANDSTONE FORTRESS (x ±24, up to y 45) ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

## Ice Lake landmarks

| # | Landmark | Position (x, y, z) | Notes |
|---|----------|--------------------|-------|
| Z1 | **Ice lake** | x ±22, z −97 → −162, y 0.12 | Feet below y 0.27 in the water = respawn on the entrance at (1, 1.6, −93) |
| Z2 | **Floe path** | z −99 → −143.5 | Five floes (top y 1.0) and two snow-capped rest blocks (top 1.8 at z −115, 2.0 at z −140.5); 2–3.5 m gaps. About 20 thin floes (top 0.35–0.6) are scattered off the path |
| Z3 | **Level sign** | (0, 3.8, −117) | Floating "RECOMMENDED / LEVEL 16" |
| Z4 | **Goal platform** | (0, 1.6, −152), 14×10 | Ice platform with corner pillars |
| Z5 | **Gold ring** | (0, ~4.2, −153) | Upright ring over a round gold pad, flanked by two tall ice pillars. Reaching it awards **+5 Wins** (`ZONE3_WIN`), then returns you to the Hub spawn |
| Z6 | **Lake walls** | \|x\| 22 → 30, top y 3 | Sheer dark-blue cliffs, snow blocks along the top |
| Z7 | **Ice terraces & spikes** | shelf \|x\| 30 → 40 (y 6), glacier \|x\| 40 → 50 (y 9) | Light-blue stepped ice; crystal spikes from 5 m tall near the entrance to ~24 m at the north end |
| Z8 | **Grass terraces** | \|x\| 50 → 80, top y 7 | Dirt sides, grass top, blocky trees |
| Z9 | **Sandstone fortress** | front z −162, x ±24, to z −176 | Facade (only the base is solid): base wall (y 9), outer towers (y 20–23), side towers (y 30–34), central keep (y 37) with twin turrets and a starry purple gate (y 37–45). Purple windows, gold diamonds, cacti |
| Z10 | **Mountains** | x ±100 … 150, z −110 … −185 | Dark grey stepped voxel peaks, mostly to the east; decoration only |

---

# Progression

1. Spawn → follow the floor chevrons to the **FREE x1 treadmill** and run to grow hair
2. Spend hair on the **hair shop** styles and the higher treadmill tiers
3. Walk out the **START** doorway and jump across the **lava slabs** to the **+1 Win** pad, then hop the **ice floes** to the gold ring for **+5 Wins**
4. Open **chests**, claim the **gift**, use the **Lucky Spin**
5. **Rebirth** at the altar to raise the hair multiplier and unlock the rebirth-gated treadmills

> Wins come from the +1 Win pad at the end of the Lava Run and the gold ring at the end of the Ice Lake.
