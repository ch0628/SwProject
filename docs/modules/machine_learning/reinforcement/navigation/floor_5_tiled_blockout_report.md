# Floor 5 Tiled Blockout Report

## Result

`PASS_FOR_FLOOR5_USER_PLAYTEST`

Floor 5 only was implemented from `floor_5_structure_arch_v3.png`, `navigation_graph_v1_f5_v3.json`, and `navigation_blockout_rebuild_report_f5_v3.md`. Floor 1–4 map, tileset, geometry, collision, navigation, encounter, transition, and debug files were not changed by this work.

## Map contract

- Orthogonal `80 × 45`, `32 × 32 px`, world `2560 × 1440 px`
- Tile layers: `Ground`, `FloorDetail`, `Walls`, `WallTop`, `StaticProps`
- Object layers: `Collision`, `NavigationNodes`, `NavigationEdges`, `EncounterZones`, `FloorTransitions`, `SpawnPoints`, `Debug`
- Spatial layout: south-center arrival/Search Hub, horizontal Search Spine, outer-lower L1/R1, inner-upper L2/R2, separate upper-center Hall/Lock/Control/Goal axis
- Floor transitions on Floor 5: none; the south stair is the arrival from `F4_CENTER_STAIR_TRANSITION`

## Navigation nodes

| Node | Runtime coordinate |
|---|---:|
| `F5_SEARCH_HUB` | `(1280, 1200)` |
| `F5_LEFT_WING` | `(704, 976)` |
| `F5_L1_GUARD` | `(304, 928)` |
| `F5_ROOM_L1` | `(304, 640)` |
| `F5_L2_GUARD` | `(704, 480)` |
| `F5_ROOM_L2` | `(704, 224)` |
| `F5_RIGHT_WING` | `(1856, 976)` |
| `F5_R1_GUARD` | `(2256, 928)` |
| `F5_ROOM_R1` | `(2256, 640)` |
| `F5_R2_GUARD` | `(1856, 480)` |
| `F5_ROOM_R2` | `(1856, 224)` |
| `F5_CENTRAL_HALL` | `(1280, 624)` |
| `F5_SECURITY_LOCK` | `(1280, 496)` |
| `F5_CONTROL_ROOM` | `(1280, 336)` |
| `F5_GOAL` | `(1280, 224)` |

## Navigation edges

The required 21 IDs are unchanged:

- Search approach: `E_F5_HUB_LEFT`, `E_F5_LEFT_L1_GUARD`, `E_F5_L1_ROOM`, `E_F5_LEFT_L2_GUARD`, `E_F5_L2_ROOM`, `E_F5_HUB_RIGHT`, `E_F5_RIGHT_R1_GUARD`, `E_F5_R1_ROOM`, `E_F5_RIGHT_R2_GUARD`, `E_F5_R2_ROOM`
- NO_BOSS return: `E_F5_L1_NO_BOSS_RETURN`, `E_F5_L2_NO_BOSS_RETURN`, `E_F5_R1_NO_BOSS_RETURN`, `E_F5_R2_NO_BOSS_RETURN`
- Post-Boss: `E_F5_L1_POST_BOSS`, `E_F5_L2_POST_BOSS`, `E_F5_R1_POST_BOSS`, `E_F5_R2_POST_BOSS`
- Control/Goal: `E_F5_HALL_LOCK`, `E_F5_LOCK_CONTROL`, `E_F5_CONTROL_GOAL`

All polylines follow walkable corridor centerlines. Search and unlocked control samples are collision-free at 4 px sampling with 12 px robot clearance.

## Equal-distance result

| Search path | Actual polyline length |
|---|---:|
| Hub → L1 | `48.000 tiles` (`1536 px`) |
| Hub → L2 | `48.500 tiles` (`1552 px`) |
| Hub → R1 | `48.000 tiles` (`1536 px`) |
| Hub → R2 | `48.500 tiles` (`1552 px`) |

- Max/min ratio: `1.0104`
- Absolute spread: `0.500 tile` (`16 px`)
- Policy: PASS (`ratio <= 1.05`, `spread <= 2 tiles`)

## Rooms, guards, and Boss Search

| Guard | Center | Zone | Villains | Bypass |
|---|---:|---:|---:|---|
| L1 | `(304, 928)` | `(192, 896, 224, 64)` | 1 | false |
| L2 | `(704, 480)` | `(608, 448, 192, 64)` | 1 | false |
| R1 | `(2256, 928)` | `(2144, 896, 224, 64)` | 1 | false |
| R2 | `(1856, 480)` | `(1760, 448, 192, 64)` | 1 | false |

- Hub → Wing → Guard → Room physical reachability: PASS for all four rooms
- Guard treated as blocked choke: no alternative physical route to its room, so bypass is BLOCKED
- Room interiors and door openings are walkable; room walls remain Collision
- Boss candidates: exactly `L1,L2,R1,R2`
- Selection: `SEEDED_RANDOM_PER_EPISODE`; location visibility false
- Searched state: `EPISODE_LOCAL_SET`; repeat selection false
- Route context contains remaining candidates only; hidden Boss location is excluded
- The four dark room squares are non-semantic architectural references, never fixed Boss markers

## State-gated control flow

- Four `NO_BOSS_RETURN` edges return their searched room to `F5_SEARCH_HUB`
- `F5_SECURITY_LOCK_BARRIER` is physical Collision with `dynamicLock=true` and `requiresState=BOSS_NEUTRALIZED`
- Pre-Boss manual/Search Hub → Control Room: BLOCKED
- Debug POST_BOSS probe disables only the dynamic barrier and follows Boss Room → Central Hall → Security Lock → Control Room → Goal: PASS
- `E_F5_HALL_LOCK` and `E_F5_LOCK_CONTROL` require `BOSS_NEUTRALIZED`
- `E_F5_CONTROL_GOAL` requires `SYSTEM_RESTORED`
- `F5_GOAL` is an in-room final goal, not a stair or Floor 6 transition

## Manual visual pipeline

- Created empty Collection-of-Images tileset `floor5_room_shell_manual.tsj`
- Logical grid `32 × 32`; no final Floor 5 PNG was generated
- Contract: PNG filename stem = TSJ Class = explicit `ASSET_IDS` entry
- `ASSET_IDS` remains intentionally empty until the user adds assets
- Missing Class vs missing PNG diagnostics are separate
- Manual Ground tiles render at depth 6, above every blockout placeholder layer (maximum depth 4)
- Runtime has no permanent semantic room/route/Boss color rectangles; Collision, Navigation, and Encounter overlays are opt-in
- Tiled GID rotation/flip and large image bottom alignment reuse the Floor 3/4 renderer behavior

## Automated validation

- `node scripts/reinforcement/validateFloor5TiledBlockout.mjs`: PASS
- `node --experimental-strip-types --test tests/reinforcementFloor5Debug.test.ts`: PASS (9/9)
- `npm run typecheck`: PASS
- `npm test`: Floor 5 tests PASS; suite remains at the pre-existing Floor 4 TSJ test failure because that test expects an empty TSJ while the user has already added 16 Floor 4 assets
- `npm run build`: `ENVIRONMENT_BLOCKED` by `EPERM realpath src/main.tsx`; the elevated retry was not approved
- `git diff --check`: PASS

## User playtest

URL: `http://127.0.0.1:5173/?mode=reinforcement-floor5-debug`

- Arrow keys: manual movement
- `C` / `N` / `E`: Collision / Navigation / Encounter overlay
- `1` / `2` / `3` / `4`: L1 / L2 / R1 / R2 search probe
- `B`: selected room NO_BOSS return probe
- `P`: selected room POST_BOSS → Control → Goal probe
- `R` or `X`: reset to Search Hub and close Security Lock

`BROWSER_PLAYTEST = USER_MANUAL_PENDING`
