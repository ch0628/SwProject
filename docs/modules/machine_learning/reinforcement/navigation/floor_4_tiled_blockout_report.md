# Floor 4 Tiled Blockout Report

## 최종 상태

**NEEDS_REVISION**

Floor 4 구현과 자동 검증은 통과했다. 다만 현재 실행 환경에서 로컬 브라우저가 Vite 서버에 연결되지 않았고, production build는 sandbox의 `realpath src/main.tsx` 권한 오류로 중단됐다. 따라서 실제 Phaser 화면 playtest와 production bundle 확인 전에는 `PASS_FOR_FLOOR4_PLAYTEST`로 판정하지 않는다.

## 읽은 기준 자료

- `navigation_design_v1.md`
- `navigation_graph_v1.json`
- `module_spec_v3.md`
- `session_handoff_v3.md`
- Floor 2 TMJ, report, `floor2Tiled.ts`, debug scene, validator, test
- 최신 Floor 3 TMJ, report, `floor3Tiled.ts`, debug scene/app, validator, test
- `floor_4_structure_clean_v2.png`

첨부 Floor 4 구조도와 Floor 2 구조도는 SHA-256이 동일했다. 구조도의 corridor silhouette를 동일한 32px quantization으로 옮기고 Floor 4 ID와 gameplay semantics만 사용했다.

## 생성/수정 파일

- `public/maps/reinforcement/floor_4_blockout.tmj`
- `public/assets/environment/reinforcement/floor4_room_shell_manual/floor4_room_shell_manual.tsj`
- `scripts/reinforcement/validateFloor4TiledBlockout.mjs`
- `src/modules/reinforcement/debug/floor4Tiled.ts`
- `src/modules/reinforcement/debug/ReinforcementFloor4DebugScene.ts`
- `src/modules/reinforcement/debug/ReinforcementFloor4DebugApp.tsx`
- `tests/reinforcementFloor4Debug.test.ts`
- `src/main.tsx`: `?mode=reinforcement-floor4-debug` 진입점만 추가
- 이 보고서

## Navigation

| Node | 실제 좌표 (px) |
|---|---:|
| `F4_LEFT_ARRIVAL` | `(304, 1120)` |
| `F4_LEFT_SECURITY_ZONE` | `(1040, 848)` |
| `F4_LEFT_PERIMETER_ZONE` | `(640, 400)` |
| `F4_RIGHT_ARRIVAL` | `(2256, 1120)` |
| `F4_RIGHT_INNER_ZONE` | `(1520, 848)` |
| `F4_RIGHT_SERVICE_ZONE` | `(1920, 400)` |
| `F4_CENTER_GUARD` | `(1280, 560)` |
| `F4_CENTER_STAIR` | `(1280, 304)` |

9개 Edge:

- `E_F4_LEFT_SECURITY_A/B`: LEFT ARRIVAL → SECURITY → CENTER GUARD
- `E_F4_LEFT_PERIMETER_A/B`: LEFT ARRIVAL → PERIMETER → CENTER GUARD
- `E_F4_RIGHT_INNER_A/B`: RIGHT ARRIVAL → INNER → CENTER GUARD
- `E_F4_RIGHT_SERVICE_A/B`: RIGHT ARRIVAL → SERVICE → CENTER GUARD
- `E_F4_GUARD_STAIR`: CENTER GUARD → CENTER STAIR

| Route | 길이 |
|---|---:|
| `F4_SECURITY_HALL_ROUTE` | `45.831 tiles` (`1466.590 px`) |
| `F4_PERIMETER_DETOUR_ROUTE` | `59.071 tiles` (`1890.274 px`) |
| `F4_INNER_SECURITY_ROUTE` | `45.831 tiles` (`1466.590 px`) |
| `F4_SERVICE_ROUTE` | `59.071 tiles` (`1890.274 px`) |

- LEFT LONG/SHORT ratio: `1.289`
- RIGHT LONG/SHORT ratio: `1.289`
- 4px polyline sampling과 24px robot clearance: PASS
- LEFT/RIGHT pre-convergence cross-edge: 없음

## Encounter / Room / Transition

| Zone | 위치/크기 (px) | 종류 |
|---|---:|---|
| `F4_LEFT_SECURITY_AMBIGUOUS_ZONE` | `(992, 768, 96, 192)` | `AMBIGUOUS_PERSON` |
| `F4_RIGHT_INNER_AMBIGUOUS_ZONE` | `(1472, 768, 96, 192)` | `AMBIGUOUS_PERSON` |
| `F4_RIGHT_SERVICE_OBSTACLE_ZONE` | `(1744, 352, 224, 96)` | `OBSTACLE`, `facilityDamagePossible=true` |
| `F4_CENTER_GUARD_ZONE` | `(960, 336, 640, 272)` | `VILLAIN_ENCOUNTER` |

- LEFT PERIMETER mandatory encounter: 없음
- MAGENTA room 2개: collision, `enterable=false`, node/edge/objective 없음
- GREEN frontage: walkable recess 유지, SOUTH locked-door collision으로 room 진입 차단
- CENTER guard: `villainCount=2`, `bypassAvailable=false`, actions `SUBDUE,DISTRACT,RETREAT`
- Collision-grid BFS guard bypass: LEFT/RIGHT 모두 BLOCKED
- `F4_CENTER_STAIR_TRANSITION`: 정확히 1개, `targetFloor=5`, `targetSpawn=F5_SEARCH_HUB`

## Stair clearance

- SOUTH-WEST LEFT: `(96, 1056, 512, 128)` — PASS
- SOUTH-EAST RIGHT: `(1952, 1056, 480, 128)` — PASS
- NORTH-CENTER: `(1088, 64, 352, 272)` — PASS
- 각 영역의 1px collision overlap 회귀 테스트: PASS

## Manual visual pipeline

- `floor4_room_shell_manual.tsj`: 생성 완료
- Collection of Images, logical grid `32x32`, 초기 tile/PNG `0개`
- `ASSET_IDS`: 빈 수동 목록으로 시작
- 계약: `PNG filename stem = TSJ Class = ASSET_IDS entry`
- PNG/TSJ/ASSET_IDS 누락 진단 분리: PASS
- Ground의 manual F4 tile depth가 blockout `StaticProps`보다 높음: PASS
- persistent RED/ORANGE/MAGENTA/GREEN/BLUE semantic overlay 없음: PASS
- Collision/Navigation/Encounter/Transition overlay는 기본 OFF: PASS
- Tiled `ParseGID` rotation/flip 적용: PASS
- large tile bottom-aligned anchor: PASS

## 검증 결과

- Floor 4 validator: PASS
- Floor 4 tests: `8/8` PASS
- 전체 tests: `127/127` PASS
- typecheck: PASS
- `git diff --check`: PASS (기존 Floor 3 파일의 LF→CRLF warning만 존재)
- build: BLOCKED — Vite가 sandbox에서 `src/main.tsx` realpath를 `EPERM`으로 거부; 외부 실행 승인은 거절됨
- Phaser browser playtest: BLOCKED — in-app browser에서 로컬 Vite URL timeout/host alias 실패
- Floor 1/2/3 보호 대상 SHA-256: 작업 전후 동일

Floor 4 final PNG, Floor 5 gameplay, Learning Engine/reward 변경은 만들지 않았다.

## 최종 판단

**NEEDS_REVISION** — 코드/geometry 자동 검증은 완료됐고, 남은 항목은 production build와 실제 Phaser 화면 playtest다.
