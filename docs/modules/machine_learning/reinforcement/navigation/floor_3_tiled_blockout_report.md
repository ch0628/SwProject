# Floor 3 Tiled Blockout Report

## 최종 상태

**PASS_FOR_FLOOR3_PLAYTEST**

Floor 3만 구현했다. Floor 3 최종 PNG, 시각 폴리시, Floor 4 gameplay는 만들지 않았다.

## 1. 확인한 기준 자료

- `navigation_design_v1.md`
- `navigation_graph_v1.json`
- `module_spec_v3.md`
- `session_handoff_v3.md`
- 현재 Floor 2 Tiled blockout, report, TMJ, Phaser debug/playtest 구현
- Floor 1 Tiled/Phaser 구현
- `floor_3_structure_clean_v2.png`

구현 관례는 최신 Floor 2의 layer/object property, collision, navigation, encounter, transition, manual asset loader, GID transform, large-tile anchor 방식을 우선 재사용했다.

## 2. 구조도 해석과 Map 규격

- orthogonal, `80 x 45`, tile `32 x 32 px`, world `2560 x 1440 px`
- SOUTH-CENTER의 YELLOW 영역을 단일 `F3_CENTER_ARRIVAL` 및 route decision area로 사용
- BLUE는 짧고 좁은 LEFT maintenance route
- ORANGE는 길고 넓은 RIGHT perimeter route
- GREEN은 진입 불가능한 sealed facility room
- PURPLE 4개는 collision이 아닌 OBSTACLE encounter 후보
- 검은 원은 villain으로 해석하지 않았고, villain은 각 북쪽 stair 앞에만 배치
- stair architecture는 SOUTH-CENTER arrival, NORTH-WEST, NORTH-EAST의 정확히 3개
- LEFT/RIGHT route는 CENTER에서만 분기하며 중간 cross-edge/shortcut은 없음

Layer 순서는 다음과 같이 고정했다.

1. `Ground`
2. `FloorDetail`
3. `Walls`
4. `WallTop`
5. `StaticProps`
6. `Collision`
7. `NavigationNodes`
8. `NavigationEdges`
9. `EncounterZones`
10. `FloorTransitions`
11. `SpawnPoints`
12. `Debug`

## 3. 생성 및 수정 파일

- `public/maps/reinforcement/floor_3_blockout.tmj`
- `public/assets/environment/reinforcement/floor3_room_shell_manual/floor3_room_shell_manual.tsj`
- `scripts/reinforcement/validateFloor3TiledBlockout.mjs`
- `src/modules/reinforcement/debug/floor3Tiled.ts`
- `src/modules/reinforcement/debug/ReinforcementFloor3DebugScene.ts`
- `src/modules/reinforcement/debug/ReinforcementFloor3DebugApp.tsx`
- `tests/reinforcementFloor3Debug.test.ts`
- `src/main.tsx`: `?mode=reinforcement-floor3-debug` 진입점만 추가
- 이 보고서

## 4. Arrival, Route, Navigation

`F3_CENTER_ARRIVAL`은 YELLOW 영역 중앙의 `(1280, 1184)`에 있고 `routeContextId = F3_STAIR_SPLIT`을 사용한다. 선택지는 LEFT/RIGHT 정확히 2개다.

| Node | 실제 Tiled 좌표 (px) |
|---|---:|
| `F3_CENTER_ARRIVAL` | `(1280, 1184)` |
| `F3_LEFT_MAINT_ZONE` | `(864, 960)` |
| `F3_LEFT_GUARD` | `(640, 512)` |
| `F3_LEFT_STAIR` | `(640, 240)` |
| `F3_RIGHT_PERIMETER_ZONE` | `(2176, 800)` |
| `F3_RIGHT_GUARD` | `(2176, 480)` |
| `F3_RIGHT_STAIR` | `(2176, 240)` |

LEFT flow:

`F3_CENTER_ARRIVAL -> F3_LEFT_MAINT_ZONE -> F3_LEFT_GUARD -> F3_LEFT_STAIR`

- `E_F3_LEFT_A`, `E_F3_LEFT_B`, `E_F3_LEFT_C`
- BLUE corridor 굴곡을 따르는 짧고 좁은 maintenance 경로
- 실제 polyline 길이: `47.803 tiles` (`1529.689 px`)

RIGHT flow:

`F3_CENTER_ARRIVAL -> F3_RIGHT_PERIMETER_ZONE -> F3_RIGHT_GUARD -> F3_RIGHT_STAIR`

- `E_F3_RIGHT_A`, `E_F3_RIGHT_B`, `E_F3_RIGHT_C`
- ORANGE 외곽을 따르는 길고 넓은 perimeter 경로
- 실제 polyline 길이: `57.500 tiles` (`1840 px`)

RIGHT/LEFT 비율은 `1.203`으로 목표 `>= 1.20`을 만족한다. Edge는 4px 간격으로 sample했고 robot 반경을 포함한 12px margin에서도 collision/room/gray mass를 통과하지 않는다.

## 5. Collision, Encounter, Room

- Collision object는 19개이며 giant top rectangle 대신 architecture/route opening에 맞춰 분리했다.
- CENTER arrival, LEFT/RIGHT stair landing 및 transition approach는 collision-free다.
- validator와 회귀 테스트가 required-clear area의 1px overlap도 실패 처리한다.
- GREEN facility room 내부는 collision으로 막고 node, edge, objective, interaction을 두지 않았다. SOUTH frontage silhouette만 walkable하게 유지했다.

PURPLE obstacle 후보는 LEFT route의 walkable corridor 위에 4개 배치했다.

| Zone | 위치/크기 (px) |
|---|---:|
| `F3_LEFT_OBSTACLE_ZONE_A` | `(584, 632, 48, 48)` |
| `F3_LEFT_OBSTACLE_ZONE_B` | `(656, 728, 40, 48)` |
| `F3_LEFT_OBSTACLE_ZONE_C` | `(592, 936, 64, 64)` |
| `F3_LEFT_OBSTACLE_ZONE_D` | `(808, 920, 72, 64)` |

네 zone 모두 `encounterType = OBSTACLE`, `route = F3_LEFT_MAINTENANCE_ROUTE`, `facilityDamagePossible = true`이며 permanent collision이 아니다. RIGHT route에는 obstacle zone을 두지 않았다.

LEFT/RIGHT guard는 각 stair 앞의 mandatory approach에 정렬했다.

- `F3_LEFT_GUARD_ZONE`: `(576, 400, 128, 112)`
- `F3_RIGHT_GUARD_ZONE`: `(2112, 400, 144, 144)`
- 양쪽 모두 `VILLAIN_ENCOUNTER`, `villainCount = 2`, `bypassAvailable = false`
- actions: `SUBDUE`, `DISTRACT`, `RETREAT`
- 물리 grid BFS로 guard zone을 제외한 side/back 우회가 차단됨을 검증

## 6. Stair와 Transition

- SOUTH-CENTER stair는 F2에서 도착하는 architecture일 뿐 upward transition이 아니다.
- `F3_LEFT_STAIR_TRANSITION`: `targetFloor = 4`, `targetSpawn = F4_LEFT_ARRIVAL`
- `F3_RIGHT_STAIR_TRANSITION`: `targetFloor = 4`, `targetSpawn = F4_RIGHT_ARRIVAL`
- upward transition은 정확히 2개이며 elevator, boss, 추가 stair는 없다.

LEFT stair, RIGHT stair, CENTER arrival의 required-clear area는 모두 pixel 단위 collision 검사에 PASS했다.

## 7. Manual asset pipeline과 Debug renderer

`floor3_room_shell_manual/`과 `floor3_room_shell_manual.tsj`를 생성했다. TSJ는 `32 x 32` logical grid의 빈 Collection of Images이며 실제 F3 final PNG는 추가하지 않았다.

`ReinforcementFloor3DebugScene.ts`는 다음 수동 workflow를 사용한다.

`PNG -> TSJ Add Image -> Class = filename stem -> ASSET_IDS 등록 -> TMJ 직접 배치`

- F3 final `ASSET_IDS` 초기값은 비어 있으며 F1/F2 alias를 만들지 않았다.
- 구조 판독용 blockout placeholder asset은 final manual pipeline과 별도 목록으로 격리했다.
- TSJ/TMJ에 사용된 manual class가 `ASSET_IDS`에서 빠지면 class명과 조치가 포함된 명시적 오류를 낸다.
- Tiled GID flip/rotation을 `ParseGID` 결과의 rotation/flip으로 Phaser sprite에 적용한다.
- `32x64`, `64x64` 같은 large Collection-of-Images tile은 Floor 2와 같은 bottom-aligned anchor 계산을 사용한다.

## 8. 검증 결과

`node scripts/reinforcement/validateFloor3TiledBlockout.mjs`:

```text
PASS floor_3_blockout
map=80x45 tile=32x32 objects=46
nodes=7 edges=6 collision=19 stairs=3
left=47.803 right=57.500 tiles ratio=1.203
obstacles=4 guards=2 transitions=2 manualTiles=0
reachability=PASS guardBypass=BLOCKED greenRoom=BLOCKED stairClearance=PASS
```

추가 자동 검증:

- `npm run typecheck`: PASS
- `npm test -- --test-name-pattern="Floor 3"`: PASS, 전체 118 tests 포함
- `npm run build`: PASS
- `git diff --check`: PASS

실제 이동성 검증:

- CENTER -> LEFT MAINT -> LEFT GUARD -> LEFT STAIR: PASS
- CENTER -> RIGHT PERIMETER -> RIGHT GUARD -> RIGHT STAIR: PASS
- LEFT GUARD -> LEFT STAIR: PASS
- RIGHT GUARD -> RIGHT STAIR: PASS
- BLUE/ORANGE 중간 direct cross-edge: 없음
- GREEN room 및 gray architecture 관통: BLOCKED
- LEFT/RIGHT guard 우회: BLOCKED

Phaser debug playtest는 실제 검증 URL `http://127.0.0.1:5174/?mode=reinforcement-floor3-debug`에서 수행했다.

- 화면 렌더 및 CENTER spawn: PASS
- `F3_LEFT_MAINTENANCE_ROUTE`: PASS
- `F3_RIGHT_PERIMETER_ROUTE`: PASS
- `F3_LEFT_GUARD_STAIR_PASS`: PASS
- `F3_RIGHT_GUARD_STAIR_PASS`: PASS
- `F3_GREEN_ROOM_BLOCK_PROBE`: PASS, facility-room collision에 차단
- Collision/Navigation/Encounter overlay toggle: PASS
- 브라우저 console warning/error: 0건

## 9. Floor 1 / Floor 2 보호 확인

작업 시작 시 기록한 SHA-256과 종료 시 값을 비교했으며 다음 보호 대상은 작업 전후 동일하다.

- Floor 1 TMJ: `32C3879276DE33003BDCA2B044B39A9CDBBA6EC2064C1E2254D417546F07163D`
- Floor 2 TMJ: `18DABD0F91E45C7170BA142FE29E9BE270C4959F49EA849E5D5015A50B1B30F8`
- Floor 1 Debug Scene: `ED4F878EAD8FBDA24FF3C80A90799F83A6828D063E2A9B66AAED9D49722BCA2B`
- Floor 2 Debug Scene: `54228A9284629CEE2218A88403E5ACA2071D2E0705C7AC5C2DBA30FE9E1F942F`

작업 시작 전에 이미 존재하던 Floor 1/Floor 2 working-tree 변경은 보존했으며 이번 Floor 3 작업에서 다시 생성하거나 수정하지 않았다.

## 10. 최종 판단

구조도 silhouette, 정확히 두 route, 7 nodes/6 edges, 실제 길이 차이, 4 obstacle zones, sealed GREEN room, 두 mandatory villain guard, 두 F4 transition, collision 및 stair clearance, manual asset pipeline, Phaser 이동성 검증을 모두 만족한다.

**PASS_FOR_FLOOR3_PLAYTEST**
