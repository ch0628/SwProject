# Reinforcement Learning — Floor 1 Phaser Playtest Report

## 상태

`STRUCTURE_PLAYTEST_APPROVED`

자동 검증과 브라우저 smoke 이후 사용자가 직접 debug route에서 수동 playtest를 완료했다. LEFT/RIGHT 완주, Lobby route switching, collision, Encounter Zone, Stair Transition, camera follow/world bounds를 실제 조작으로 확인했다.

## 1. 생성/수정 파일

- `src/main.tsx`
- `src/modules/reinforcement/debug/ReinforcementFloor1DebugApp.tsx`
- `src/modules/reinforcement/debug/ReinforcementFloor1DebugScene.ts`
- `src/modules/reinforcement/debug/floor1Tiled.ts`
- `tests/reinforcementFloor1Debug.test.ts`
- `docs/modules/machine_learning/reinforcement/navigation/floor_1_phaser_playtest_report.md`

`public/maps/reinforcement/floor_1_blockout.tmj`와 외부 TSJ, tile PNG는 수정하지 않았다. generator도 실행하지 않았다.

## 2. Debug route

```text
/?mode=reinforcement-floor1-debug
```

기존 `/`, `/?mode=ai-basics`, `/?mode=supervised` 분기를 유지하고 독립 query mode만 추가했다.

## 3. Tiled map loading 방식

Phaser loader로 다음 세 파일을 실제 로드한다.

- `/maps/reinforcement/floor_1_blockout.tmj`
- `/maps/reinforcement/reinforcement_blockout_tileset.tsj`
- `/assets/environment/reinforcement/blockout/reinforcement_blockout_tiles.png`

현재 설치된 Phaser 4.2.1 parser는 external TSJ와 zlib/base64 tile layer를 직접 처리하지 않는다. 원본 파일을 바꾸지 않고 브라우저 native `DecompressionStream`으로 tile GID 배열을 풀고, TSJ를 runtime 복사본에만 임베드한 뒤 Phaser Tilemap cache에 등록한다.

Runtime assertion은 80×45, tile 32×32, 필수 tile/object layer, spawn 1개, transition 2개, `F1_ENTRY_SPLIT=(1274,1042)`, `WALL_45_1`, `WALL_45_2`를 검사한다. 실패하면 debug status와 console에 명확한 error를 남긴다.

## 4. Tile rendering / draw order

```text
Ground
FloorDetail
Walls
StaticProps
Debug Robot
WallTop
Debug Overlay
```

브라우저 smoke에서 canvas 1개, `Floor 1 debug ready`, console warning/error 0개를 확인했다.

## 5. Collision loading 방식

`Collision` object layer의 모든 rectangle을 Arcade Physics static body로 변환한다. `blocksRobot=false`만 제외하며 Central Core, Locked Door, Reception Desk, Waiting furniture, 일반 wall, `WALL_45_1`, `WALL_45_2`가 같은 경로로 처리된다.

Collision overlay는 반투명 red rectangle이며 `C`로 토글한다. Central Core, Reception Desk, 두 수동 wall은 label도 표시한다.

## 6. Robot physics body / camera

- Graphics로 생성한 24×24 px debug robot texture
- Arcade Physics 24×24 body
- 속도 180 px/s
- 8방향 이동 및 diagonal normalization
- world bounds collision
- camera bounds 2560×1440
- zoom 1.0, 즉시 follow
- 사용자 요청: 약 1.3× 가까운 camera zoom 적용 예정 (`PENDING`)
- `SpawnPoints/F1_ROBOT_SPAWN` 좌표 사용

## 7. Controls

- Arrow Keys: 이동
- `C`: Collision overlay ON/OFF
- `N`: Navigation overlay ON/OFF
- `E`: Encounter overlay ON/OFF
- `R`: spawn 위치 reset

WASD는 추가하지 않았다.

## 8. Navigation overlay

`NavigationNodes`를 pin과 `nodeId` label로, `NavigationEdges`를 polyline과 `edgeId` label로 렌더링한다. 실제 이동 constraint에는 사용하지 않는다. `F1_START`, 좌우 Route A, `F1_ENTRY_SPLIT`과 현재 edge 구조가 runtime map 좌표에서 표시된다.

## 9. Encounter Zone detection

`EncounterZones` rectangle, object name, `encounterType`, `route`를 표시한다. Robot 중심점이 zone 안에 들어오면 HUD의 Current Encounter가 갱신되고 벗어나면 `NONE`이 된다. 실제 Encounter gameplay는 구현하지 않았다.

## 10. Stair Transition detection

`FloorTransitions` 두 rectangle을 표시한다. 진입 시 HUD에 transition name, `targetFloor`, `targetSpawn`, 진입 count를 표시하며 실제 Scene 전환은 하지 않는다.

자동 검증으로 두 transition과 `F2_LEFT_ARRIVAL`/`F2_RIGHT_ARRIVAL` metadata를 확인했다. 실제 방향키 traversal trigger는 아래 수동 checklist 대상이다.

## 11. Debug HUD

다음을 canvas 좌상단에 표시한다.

- Floor / map 규격
- Position x/y
- Tile x/y
- Current Encounter
- Transition / trigger count
- Collision / Navigation / Encounter overlay 상태
- 이동/reset key

## 12. Automated validation 결과

- `validateFloor1TiledBlockout.mjs`: PASS
- `validateNavigationGraph.mjs`: PASS
- `npm test`: 107/107 PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS (기존 사용자 파일의 LF→CRLF warning만 출력)
- Browser smoke: route open PASS, canvas PASS, runtime status PASS, map/HUD render PASS, console warning/error 0

Repository에 Playwright/Cypress/Puppeteer infrastructure가 없으므로 새 dependency와 E2E test는 추가하지 않았다.

## 13. Manual playtest checklist

- [x] Spawn 위치 정상
- [x] Entrance → Lobby 이동 가능
- [x] Reception collision 정상
- [x] Waiting Area collision 정상
- [x] LEFT Route 완주 가능
- [x] LEFT Stair trigger 정상
- [x] RIGHT Route 완주 가능
- [x] RIGHT Stair trigger 정상
- [x] LEFT → ENTRY_SPLIT → RIGHT 이동 가능
- [x] RIGHT → ENTRY_SPLIT → LEFT 이동 가능
- [x] Central Core 관통 불가
- [x] Locked Door 관통 불가
- [x] WALL_45_1 collision 정상
- [x] WALL_45_2 collision 정상
- [x] Citizen Zone detection 정상
- [x] Obstacle Zone detection 정상
- [x] Camera follow 정상
- [x] Map 밖으로 이동 불가

## 14. 수동 Playtest 결과 / 발견된 문제

- Map 자체 문제는 자동 검증과 browser smoke에서 발견되지 않았다.
- Phaser 기본 Tiled parser의 external TSJ 및 zlib layer 제한은 runtime 변환으로 해결했다.
- 사용자가 실제로 LEFT/RIGHT Route, 양방향 Lobby switching, corridor/corner movement, Reception/Waiting/Core/Locked Door/수동 Wall collision, Encounter Zone, Stair Transition, camera follow/world bounds를 확인했다.
- 구조/충돌/이동 관련 blocker는 발견되지 않았다.
- 시각적 요청으로 camera를 현재보다 약 1.3× 가깝게 조정하는 작업만 남아 있다.

## 15. 다음 단계

1. Floor 1 구조는 `STRUCTURE_PLAYTEST_APPROVED`로 잠근다.
2. geometry / collision / navigation / encounter / transition을 변경하지 않고 1F visual implementation을 진행한다.
3. camera zoom을 현재 1.0에서 약 1.3으로 조정한다.
4. visual asset 적용 후 final visual playtest를 다시 수행한다.
