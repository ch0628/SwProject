# Reinforcement Learning — Floor 1 Tiled Blockout Report

## 1. 생성 파일

- `public/maps/reinforcement/floor_1_blockout.tmj`
- `public/maps/reinforcement/reinforcement_blockout_tileset.tsj`
- `public/assets/environment/reinforcement/blockout/reinforcement_blockout_tiles.png`
- `scripts/reinforcement/generateFloor1TiledBlockout.mjs`
- `scripts/reinforcement/validateFloor1TiledBlockout.mjs`
- `docs/modules/machine_learning/reinforcement/navigation/floor_1_tiled_blockout_report.md`

`floor_1_blockout.tmj`는 수동 Tiled 수정 이후 Source of Truth다. `generateFloor1TiledBlockout.mjs`는 초기 bootstrap 기록으로만 남기며 현재 맵에 다시 실행하지 않는다.

## 2. 읽은 문서와 설계 정합성

- `navigation_design_v1.md`
- `module_spec_v3.md`
- `learning_engine_v1.md`
- `session_handoff_v3.md`
- `navigation/navigation_graph_v1.json`
- `docs/project/module_contract.md`

현재 구현은 1F 중앙 입구의 `F1_ENTRY_SPLIT`, 짧고 시민 노출이 높은 LEFT Route, 길고 장애물/시설 위험이 높은 RIGHT Route, 좌우 직선 계단, 1F Villain 없음, Elevator 없음, 모듈 격리 원칙과 일치한다. Learning Engine 수치나 기존 AI Basics / supervised gameplay는 수정하지 않았다.

## 3. Repository / Tiled convention

기존 `public/maps/plaza-park-v2.tmj`의 Tiled JSON layer naming과 object-property 방식을 확인했다. 강화학습에는 기존 Tiled map/tileset convention이 없었으므로 독립 외부 tileset(`.tsj`)과 압축된 tile layer를 사용했다. 기존 강화학습의 Visual Background / Logic Navigation 분리 원칙은 tile layer / object layer 분리로 유지했다.

별도 production debug route는 추가하지 않았다. `floor_1_blockout.tmj`를 Tiled에서 열면 Collision, NavigationNodes, NavigationEdges, EncounterZones, FloorTransitions layer가 각기 다른 debug color로 표시되므로 해당 layer를 토글해 검토할 수 있다.

## 4. Map 규격과 Layer 구조

- Orientation: `orthogonal`
- Tile: `32 × 32 px`
- Map: `80 × 45 tiles`
- Pixel: `2560 × 1440 px`
- Layers: 12개

Tile layers:

1. `Ground`
2. `FloorDetail`
3. `Walls`
4. `WallTop`
5. `StaticProps`

Object layers:

6. `Collision`
7. `NavigationNodes`
8. `NavigationEdges`
9. `EncounterZones`
10. `FloorTransitions`
11. `SpawnPoints`
12. `Debug`

## 5. Main Lobby와 Central Core

Main Lobby는 `x=22..57, y=31..41`이며 중앙 Reception Desk, 남서 Waiting Area, 북측 Company Information Wall, 좌우 Route 입구, 남측 Entrance Vestibule로 구분된다. Reception Desk와 Waiting furniture는 모두 StaticProps 및 Collision으로 정의했다.

Central Core는 `x=28..51, y=10..30` 전체가 Robot collision이다. 내부에는 정확히 다음 네 공간만 표시한다.

- Meeting Room
- Reception Back Office
- Visitor / Security Office
- Staff Utility / Storage

Door object는 정확히 4개이며 모두 `lockedForRobot=true`다. Core 내부에는 walkable Ground tile과 Navigation Node가 없다.

### Manual Tiled Adjustments

사용자가 추가한 다음 Collision object를 보존했다.

- `WALL_45_1` — Object ID `185`, `x=480`, `y=864`, `416 × 32 px`
- `WALL_45_2` — Object ID `186`, `x=1664`, `y=928`, `198 × 32 px`

### Lobby Navigation Revision

기존 `E_F1_START_SPLIT`은 Reception 동쪽을 돌아 Desk 뒤편 Split으로 이동하도록 구성되어 있었다. 이를 제거하고 다음 구조로 수정했다.

```text
F1_START ── E_F1_START_LEFT_A ── F1_LEFT_ROUTE_A
         └─ E_F1_START_RIGHT_A ─ F1_RIGHT_ROUTE_A

F1_LEFT_ROUTE_A  ↔ F1_ENTRY_SPLIT ↔ F1_RIGHT_ROUTE_A
```

`F1_ENTRY_SPLIT`의 현재 승인 좌표는 Tiled object 기준 `(1274, 1042)`다. `E_F1_SPLIT_LEFT_A`와 `E_F1_SPLIT_RIGHT_A`의 origin/endpoint도 이 좌표로 이동했다. Route switching은 `F1_ENTRY_SPLIT`에서만 허용하며 Route B 이후 좌우 direct cross-edge는 없다.

## 6. LEFT / RIGHT Route 길이

Navigation centerline 거리 (`F1_ENTRY_SPLIT` → Stair):

- LEFT: `53.39 tiles` (`약 1708 px`)
- RIGHT: `69.72 tiles` (`약 2231 px`)

실제 collision-aware 4방향 tile 이동 최단거리:

- LEFT: `55 tiles` (`1760 px`)
- RIGHT: `59 tiles` (`1888 px`)

두 측정 모두 RIGHT가 LEFT보다 길다. Lobby에서는 `F1_ENTRY_SPLIT`을 통한 Route A switching만 허용한다.

## 7. Encounter Zone

- `F1_CITIZEN_ZONE_A`: LEFT, `CITIZEN_NEARBY`
- `F1_CITIZEN_ZONE_B`: LEFT, `CITIZEN_NEARBY`
- `F1_OBSTACLE_ZONE_A`: RIGHT, `OBSTACLE`, `facilityDamagePossible=true`
- `F1_OBSTACLE_ZONE_B`: RIGHT, `OBSTACLE`, `facilityDamagePossible=true`

Citizen, cart, crate, temporary obstacle, Villain은 tile background에 bake하지 않았다.

## 8. Collision / Walkability

Collision에는 route boundary wall, Central Core, 4 locked doors, Reception Desk, Waiting Area furniture가 포함된다. Validator는 Ground와 Collision geometry를 함께 rasterize하여 다음을 확인한다.

- Spawn → LEFT Stair walkable path 존재
- Spawn → RIGHT Stair walkable path 존재
- Core 내부 walkable tile 0개
- Core collision이 `24 × 21 tiles` 전체를 차단
- Navigation centerline 표본이 모두 walkable/collision-free
- 모든 Navigation Edge를 4px 간격으로 검사했을 때 Collision 교차 없음
- START → LEFT A는 북서 대각선, START → RIGHT A는 북동 대각선
- 두 START edge 모두 Reception Desk의 SOUTH/front open space를 통과
- Locked Room 진입 불가

LEFT와 RIGHT 사이의 물리적 직접 횡단은 Central Core에 의해 차단된다. Lobby로 되돌아가는 동선은 존재하지만 Route 선택 이후 Navigation cross-edge는 없다.

## 9. Stair / Transition

- LEFT Stair: `x=8..15, y=2..8`, `8 × 7 tiles`, SOUTH → NORTH
- RIGHT Stair: `x=64..71, y=2..8`, `8 × 7 tiles`, SOUTH → NORTH
- `F1_LEFT_STAIR_TRANSITION` → `F2_LEFT_ARRIVAL`
- `F1_RIGHT_STAIR_TRANSITION` → `F2_RIGHT_ARRIVAL`

FloorTransition은 정확히 2개이며 Elevator와 추가 staircase는 없다.

## 10. Validation 결과

실행:

```powershell
node scripts/reinforcement/validateFloor1TiledBlockout.mjs
```

결과:

```text
PASS floor_1_blockout
map=80x45 tiles pixels=2560x1440
layers=12 objects=184 nodes=10 edges=10
transitions=2 citizenZones=2 obstacleFacilityZones=2
navigationLengthTiles left=53.39 right=69.72
walkDistanceTiles splitToLeft=55 splitToRight=59
walkDistancePixels splitToLeft=1760 splitToRight=1888
lobbySwitching=ENTRY_SPLIT_ONLY manualWalls=WALL_45_1:185,WALL_45_2:186
centralCoreShortcut=blocked lockedDoors=4 elevator=absent villain=absent
```

Validator 실패 시 non-zero exit code를 반환한다.

Navigation revision 회귀 검증:

- `validateNavigationGraph.mjs`: PASS
- `npm test`: 103/103 PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS

## 11. 남은 미확정 사항

- 최종 Pixel Art와 최종 runtime floor background
- Encounter probability와 Runtime entity spawn 규칙
- Action별 timeCost
- Phaser / Learning Engine integration
- 2F~5F Tiled map

## 최종 판단

`PASS_FOR_FLOOR1_NAVIGATION_REVISION`
