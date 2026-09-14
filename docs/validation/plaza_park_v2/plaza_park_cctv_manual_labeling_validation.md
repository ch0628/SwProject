# Plaza/Park CCTV Manual Labeling Validation

Updated: 2026-09-14

## Scope

Plaza/Park v2의 기존 world simulation 위에 CCTV1/CCTV2 `MANUAL_LABELING` 첫 playable vertical slice만 연결했다.
Map, Navigation v2, E01~E33, SP1~SP10, lane, movement와 character animation은 변경하지 않았다.

## Camera_Zone source

`public/maps/plaza-park-v2.tmj`의 `Camera_Zone` Object Layer를 runtime에 직접 로드한다.

| Object | Type | Geometry | x | y | width | height |
|---|---|---|---:|---:|---:|---:|
| CCTV1 | Coverage | Rectangle | 0 | 0 | 1696 | 992 |
| CCTV2 | Coverage | Rectangle | 576 | 512 | 2496 | 1280 |
| Overlap | Overlap | Rectangle | 576 | 512 | 1120 | 480 |

Implementation은 Coverage object의 name/coordinates/dimensions를 TMJ에서 읽으며 좌표를 복제하지 않는다.

## Runtime behavior

- CCTV 전환은 한 world의 Phaser main camera만 stop-follow/fit/center한다.
- `visibleCharacters`는 active + runtime-visible NPC의 bottom-center feet position이 선택된 Coverage rectangle 안에 있는지로 매 frame 계산한다.
- 같은 predicate로 world click selection을 허용한다. zone 밖 NPC는 render/select 대상이 아니다.
- 선택 NPC가 zone을 나가거나 CCTV가 바뀌면 selection만 해제한다.
- label 버튼은 `CharacterRuntimeState.labels.userLabel`을 즉시 변경하며 lock/submit/undo 상태가 없다.
- green/red marker는 각각 현재 사용자 `CITIZEN`/`VILLAIN` 선택만 반영한다.
- UI-facing state는 `id`, `currentZone`, `currentBehavior`, `userLabel`만 전달한다.

## Automated validation

| Gate | Result |
|---|---:|
| Camera Zone load / exact geometry | PASS |
| feet-position enter/inside/exit visibility | PASS |
| visible-only selection predicate | PASS |
| `null → CITIZEN → VILLAIN → CITIZEN` | PASS |
| CCTV 이동 후 same runtime label persistence | PASS |
| UI model truth/AI field exclusion | PASS |
| Full test suite | PASS — 61/61 |
| Typecheck | PASS |
| Production build | PASS with existing chunk-size WARN |
| 5/8/10/12/15 concurrency regression | PASS |

## Browser validation

- CCTV1 load, moving NPCs and live visible count: PASS
- visible NPC world click and selection ring: PASS
- 시민 → 악당 → 시민 immediate mutable label flow: PASS
- selected NPC zone exit clears selection: PASS
- CCTV2 switch changes world camera without reloading the world: PASS
- previously labeled runtime/marker remains independent of definition truth: PASS
- console errors/warnings: 0

## Known WARN / FAIL

- WARN: production build retains the pre-existing Vite `>500 kB` chunk warning.
- WARN: existing direction-specific still images express facing; ordinary/suspicious semantics have no dedicated behavior animation.
- FAIL: none in this scope.
- Not implemented by scope: FIRST_TRAINING, Tracking Review, AI prediction/confidence, truth comparison, retraining and Final Scan.
