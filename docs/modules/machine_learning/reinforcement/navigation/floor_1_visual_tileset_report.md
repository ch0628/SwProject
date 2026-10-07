# Reinforcement Floor 1 — Deterministic Visual Tileset Report

`READY_FOR_FLOOR1_VISUAL_REVIEW`

## Scope

The approved 80×45 Floor 1 Tiled map remains the geometry source of truth. The deterministic generator writes pixels directly with integer rectangles and exports PNGs without scaling, filtering, anti-aliasing, perspective transforms, or generative image APIs.

Generator: `scripts/reinforcement/generateFloor1VisualTileset.mjs`

Validator: `scripts/reinforcement/validateFloor1VisualKit.mjs`

The old `generateFloor1TiledBlockout.mjs` geometry generator was not run.

## Created assets

| Module TSJ ID | Asset ID | PNG size | Gameplay footprint |
| ---: | --- | ---: | ---: |
| 0 | `F1_FLOOR_PUBLIC` | 32×32 | 32×32 |
| 1 | `F1_FLOOR_SERVICE` | 32×32 | 32×32 |
| 2 | `F1_WALL_H` | 32×72 | 32×32 |
| 3 | `F1_WALL_V` | 32×72 | 32×32 |
| 4 | `F1_WALL_CORNER_INNER` | 32×72 | 32×32 |
| 5 | `F1_WALL_CORNER_OUTER` | 32×72 | 32×32 |
| 6 | `F1_WALL_END_H` | 32×72 | 32×32 |
| 7 | `F1_WALL_END_V` | 32×72 | 32×32 |
| 8 | `F1_DOORWAY_OPEN` | 64×72 | 64×32 |
| 9 | `F1_DOOR_STAFF_CLOSED` | 64×72 | 64×32 |
| 10 | `F1_STAIR_STRAIGHT` | 256×224 | 256×224 (8×7 tiles) |
| 11 | `F1_RECEPTION_DESK` | 256×64 | 256×64 (8×2 tiles) |

All named PNGs are under `public/assets/environment/reinforcement/floor1/`.

Additional outputs:

- `floor1_tileset.png`: 256×192 runtime atlas, 8 columns × 6 rows, 48 tiles at 32×32.
- `floor1_visual_tileset.tsj`: runtime atlas mapping used by the TMJ.
- `floor1_visual_modules.tsj`: exact image-collection mapping for the 12 canonical modules, including image size, footprint, grid, wall metrics, and contact-sheet coordinates.
- `floor_1_visual_module_contact_sheet.png`: 624×344 automated module sheet with 2×2 floor repeats, H-wall repeats, both H→corner→V joins, doors, stairs, and reception.
- `floor_1_visual_preview.png`: 2560×1440 full Floor 1 visual-layer render.

## Exact palette

| Role | HEX / RGBA |
| --- | --- |
| Public floor base | `#E9DCC8` / `rgba(233, 220, 200, 1)` |
| Public floor highlight | `#F4EBDD` / `rgba(244, 235, 221, 1)` |
| Service floor | `#D8D4CC` / `rgba(216, 212, 204, 1)` |
| Wall face | `#C9C6D2` / `rgba(201, 198, 210, 1)` |
| Wall side/depth | `#9B97A8` / `rgba(155, 151, 168, 1)` |
| Wall top cap | `#DEE4EA` / `rgba(222, 228, 234, 1)` |
| Wall base trim | `#30333B` / `rgba(48, 51, 59, 1)` |
| Technology accent | `#31CFE6` / `rgba(49, 207, 230, 1)` |
| Door frame | `#3E4650` / `rgba(62, 70, 80, 1)` |
| Door panel | `#7E8791` / `rgba(126, 135, 145, 1)` |
| Glass | `#78AEBB` / runtime `rgba(120, 174, 187, 0.725)` |
| Contact shadow | `#2A2D34` / `rgba(42, 45, 52, 0.251)` |

Inner-corner contact shading uses the same shadow RGB at alpha 0.376. No unrelated RGB values occur in the canonical module PNGs.

## Wall and connection rules

- Physical wall: 64 px = 8 px top cap + 48 px face + 8 px base trim.
- Sprite canvas: 72 px high; the final 8 px is a non-colliding floor-contact shadow toward lower-right.
- Cyan strip: exactly 4 px at sprite rows 12–15, consistent across H, V, inner corner, outer corner, and end caps.
- `F1_WALL_H` has identical left/right edge pixels and repeats without a gap.
- `F1_WALL_V` is drawn separately, not rotated from H; its 8 px darker side face establishes depth.
- Inner and outer corners preserve the H incoming edge and V outgoing edge pixel-for-pixel. Inner uses darker contact shading; outer keeps the convex top/side wrap.
- H and V end caps expose the same 8 px wall depth and terminate cap, face, cyan, and trim.
- Door modules are exactly 64 px wide. Cyan stops at the gunmetal frame; the open module has a recessed dark opening and no leaf; the staff module has a recessed split panel and small cyan access light.

## Multi-tile objects

- Straight stair: exactly 256×224. It rises north, has a 32 px top transition, 20 deterministic tread/riser bands, side trim, cyan transition lines, and a 32 px bottom landing. No second floor, turn, balcony, or mezzanine is shown.
- Reception: exactly 256×64. The visible body is 48 px high, with a light counter, recessed face, cyan line, dark lower trim, side depth, and an 8 px contact shadow inside the footprint.

## Tiled application

Only these visual tile payloads in `floor_1_blockout.tmj` were regenerated:

- `Ground`
- `FloorDetail`
- `Walls`
- `WallTop`
- `StaticProps`

The external reference remains `floor1_visual_tileset.tsj`. The runtime atlas keeps the existing Phaser-compatible 32×32 slice workflow; the companion image-collection TSJ indexes the full-height canonical wall/door modules and separate multi-tile objects.

Gameplay object layers are byte-for-byte unchanged from the approved map. Their serialized SHA-256 is `4374b5739afe79850ca48b9ec2a4ab3137236800e0514e1b9d367c4253a46f4a`:

- `Collision`: 153 objects
- `NavigationNodes`: 10
- `NavigationEdges`: 10
- `EncounterZones`: 4
- `FloorTransitions`: 2
- `SpawnPoints`: 1
- `Debug`: 4

`WALL_45_1` remains Object ID 185 at 480,864 with size 416×32. `WALL_45_2` remains Object ID 186. `F1_ENTRY_SPLIT` remains at 1274,1042. Stair, Central Core, route, and Reception collision geometry are unchanged.

## Validation results

1. Public floor repeat: PASS, opposite PNG edges match.
2. Service floor repeat: PASS, opposite PNG edges match.
3. H wall repeat: PASS, all 72 left/right edge pixels match.
4. V wall repeat: PASS, dedicated orthogonal module and applied preview contain no transparent structural gaps.
5. H + inner corner + V: PASS, both joins are pixel-equal.
6. H + outer corner + V: PASS, both joins are pixel-equal.
7. End-cap thickness: PASS, 8 px.
8. Open doorway width: PASS, 64 px.
9. Closed staff door width: PASS, 64 px.
10. Stair footprint: PASS, 256×224.
11. Reception footprint: PASS, 256×64.
12. Cyan world height: PASS, rows 12–15 on structural modules.
13. Floating wall pixels: PASS.
14. Wall height consistency: PASS, 64 px plus ≤8 px contact shadow.
15. Anti-aliasing blur: PASS, direct integer pixel writes and only declared alpha values.
16. Gameplay geometry: PASS, approved object-layer SHA-256 unchanged.

Commands run:

- `npm run validate:floor1-visual`: PASS
- `node scripts/reinforcement/validateFloor1TiledBlockout.mjs`: PASS
- `node scripts/reinforcement/validateNavigationGraph.mjs`: PASS
- `npm test`: PASS, 110/110
- `npm run typecheck`: PASS
- `npm run build`: PASS (existing Vite chunk-size warning only)
- `git diff --check`: PASS

`READY_FOR_FLOOR1_VISUAL_REVIEW`
