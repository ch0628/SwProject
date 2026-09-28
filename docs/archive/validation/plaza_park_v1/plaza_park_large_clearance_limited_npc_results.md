# Plaza & Park Large Clearance + Limited NPC Validation

검증일: 2026-09-13. **최종 판정: FAIL.**
Large Tiger의 Cafe / Facility 접근 실패와 10 NPC 지속 교착을 확인했다.
테스트 코드의 PASS는 이 실패를 포함한 관측과 충돌 안전성 검사가 정상 수행됐다는 뜻이며, 맵/교통 실험의 PASS를 뜻하지 않는다.
30/35 NPC 새 맵 Full Flow로 진행하지 않았다. 좌표, Waypoint, Collision, Door Opening, 통로 표준, 회피 동작을 변경하지 않았다.

## 기준 및 이어받은 상태

읽은 기준: 현재 첨부 지시, ai/RULES.md, ai/WORKFLOW.md, ai/CONTEXT_MAP.md,
docs/session_handoff_current.md, docs/ml_prototype_technical_requirements.md,
docs/graphics_character_asset_spec.md, docs/map_scale_validation_spec.md,
docs/validation/general/scale_validation_results.md, docs/validation/general/corridor_capacity_results.md,
docs/map_plaza_park_spec.md, docs/validation/plaza_park_v1/plaza_park_graybox_results.md.
Map Source of Truth는 최신 map_plaza_park_spec.md이며, 과거 preflight는 기준으로 사용하지 않았다.

작업 디렉터리는 Git 저장소가 아니다(`git status`: not a git repository).
따라서 Git diff 대신 현재 파일 내용과 수정 시각, 이 작업의 편집/실행 로그를 확인했다.
기존 Graybox, 8개 Layer, W01~W22, 문/내부 충돌, 진입 버튼과 기존 14개 검사를 유지했다.
결과 문서가 아직 없어서 이 파일을 새로 작성했다. 기존 Graybox/Scale/Corridor 결과 문서는 보존했다.

## 변경 파일과 재사용

| 파일 | 이번 단계의 변경 |
|---|---|
| src/collision.ts | 기존 판정을 공유하는 canNavigate, sweptFootprint 추출 |
| src/ScaleValidationScene.ts | 기존 architecture 판정을 canNavigate 호출로 대체; 값/동작 유지 |
| src/npcMotion.ts | 같은 swept footprint 계산 재사용 |
| src/corridorCapacity.ts | 같은 swept footprint 계산 재사용; 기존 side-step 변경 없음 |
| src/plazaPark.ts | 기존 substep 이동에 선택적 Large architecture 검사 연결 |
| src/plazaTraffic.ts | 검증 전용 10 NPC 구성, 기존 Waypoint 경로, 대기/재개/반복/측정 |
| src/PlazaParkScene.ts | 기존 Tiger texture 사용, Tiger/Probe, 경로/발/clearance/blocked 표시 |
| src/main.tsx | NPC 경로 선택·일시정지·측정 표시; Scene 왕복 시 NPC 메뉴 선택 유지 |
| src/style.css | 기존 toolbar 줄바꿈 및 측정 패널 배치 |
| tests/plazaTraffic.test.ts | Large 관측, 단독 경로, 혼합 충돌 안전성, block/recovery 검사 4개 |
| 이 문서 | 측정 결과 및 한계 |

Map TMJ/SVG, generator, Source of Truth, Tiger PNG를 재생성/수정하지 않았다.
마지막 재개에서는 이미 진행 중이던 NPC 메뉴 유지 수정과 검증을 마무리했다.
테스트의 Player 차단 fixture는 두 발의 경계가 접하도록 간격 15→14px로 정정했다. 이동 엔진을 바꿔 검사를 통과시킨 것이 아니다.

Tiger는 Scale Scene에서 이미 로드하고 trim한 tiger-down/left/right/up texture를 사용한다.
Render 80px, bottom-center, depth=feet Y, footprint 26×16,
Large clearance 좌우30 / 위56 / 아래8px를 그대로 사용한다.
Building/Fence에만 Large clearance를 적용하고 Bench/Tree/NPC는 footprint 충돌을 유지한다.
Sprite 전체를 Physics Box로 사용하지 않는다. Probe 모드는 이전 physical-only 비교용이다.
충돌/clearance를 만족하지 않는 inspection jump 및 Probe→Tiger 전환은 거절하고 현재 위치를 보존한다.

## Tiger 위치별 결과

Physical 열은 **26×16 footprint 기준** 안전성과 통행을 뜻한다.
Large 열은 architecture 여유를 포함한 접근 가능성을 별도로 표시한다.
Visual은 아래에서 실제 관찰한 방향/위치에 한정한다. 점검 순간이동은 연속 주행으로 계산하지 않았다.

| 위치 | Physical | Large / Visual | 실제 근거 |
|---|---|---|---|
| Cafe Approach W16 | PASS | Approach PASS / Door FAIL | Tiger가 (720,1296)에서 Left 이동 후 (672,1296) 정지 |
| Cafe Door W17 | PASS: Probe는 opening 진입 후 내부 차단 | FAIL: Tiger 문턱 도달 불가 | W17 점검 이동 거절; 자동 Large 접근도 (672,1296) 정지 |
| Facility Approach / Door W18,W19 | PASS: Probe opening 진입·내부 차단 | FAIL: Large 접근/문 통과 | W06에서 Up 후 (2736,600) 정지; W18/W19 거절. 문 중앙 x2720 자동 접근도 y568에서 정지 |
| Park Main Walkway | PASS | PASS, 관찰 구간 | W03에서 오른쪽으로 (976,368)→(1177,368), 이후 Tree 방향 접근 |
| Upper Narrow W08 | PASS | PASS, 관찰 구간 | (1552,176)에서 왼쪽 (1468,176)까지 이동. 몸의 위쪽이 포장 밖 잔디 위에 보이나 solid 관통 관찰 없음 |
| Lower Narrow W09 | PASS | PASS, 관찰 구간 | (1552,528)→(1573,528), 오른쪽 texture 및 이동 확인 |
| Fence / W04,W07 | PASS: footprint로 앵커 점유 가능 | FAIL: Large 앵커 접근 조건 불충족 | 두 점검 이동 모두 거절, 자동 판정도 false. 주변 전체 우회 경로가 불가능하다는 뜻은 아님 |
| Park Bench C | PASS: 차단 | WARN: prop 여유 별도 없음 | W10에서 왼쪽 이동 후 x1325,y624 정지. 보라 clearance가 Bench에 겹치지만 footprint는 분리 |
| Tree T5 | PASS: 차단 | WARN: canopy/몸 겹침 검토 필요 | x1177에서 Up 후 y296 정지. canopy 배경과 몸이 겹쳐 보이며 최종 tree art 기준 판정은 미완료 |
| Manhole | PASS | PASS, 관찰 위치 | W11에서 오른쪽 (2318,592), Interaction Manhole. 비충돌 surface 위 이동 |
| Park→Plaza Connector | PASS | PASS, 관찰 구간 | W12 (1552,720)→(1552,825), Plaza tile25 진입 |
| Plaza edge Bench PB1 | PASS: 차단 | WARN: 몸이 Bench block 위에 그려짐 | W13에서 Up 후 (784,873) 정지. feet는 Bench 밖, 상체는 block과 겹침 |
| Plaza Open Core W14 | PASS | PASS, 관찰 구간 | W14에서 Down, (1552,1035) 확인 |
| Plaza→Main Route | PASS, 자동 기하 검사 | 관찰한 양 끝 PASS; 전 구간 시각 주행 미검증 | W14/W20 국소 이동. W14→W20는 2px 간격 Large bounds 검사 충족 |
| Main Route | PASS | PASS, 관찰 구간 | W20에서 Right, (1570,1680) 확인. 기존 6-tile 구조 유지 |
| North Entry | PASS | 국소 이동 PASS / 표시 WARN | (1520,80)→(1520,95). 시작점에서 상단 toolbar가 Sprite 일부를 가림 |
| West / East Exit | PASS, 점유·국소 이동·자동 연결 | 전체 출입 동선 시각 판정 미검증 | W21→(54,1680), W22→(3021,1680). 출구 전 구간 연속 수동 주행은 미실행 |

W01~W22는 **physical-only 22/22** 점유 가능하며 North Entry 연결성 기존 검사도 통과했다.
Large 점유 가능은 **17/22**이며 W04,W07,W17,W18,W19가 불충족이다.
Large의 전체 22개 연결성이 통과했다고 해석하면 안 된다.

### Cafe / Facility: [Observed Fact]

- Cafe는 위에 기록한 좌표에서 반복 입력에도 더 전진하지 않았다. 건물 왼쪽 block으로 몸 전체가 들어가는 현상은 이 접근 방향에서 관찰하지 않았다.
- Facility는 문 앞에서 멈췄으며 위쪽 머리 일부가 회색 건물/문 근처에 겹쳐 보였다. 접근 자체가 실패하므로 종합 FAIL이다.
- 기존 Probe 문 통과 검사와 Large 문 접근 실패 검사가 동시에 재현된다.
- 문/충돌 좌표는 수정하지 않았다.

### Cafe / Facility: [Interpretation]

- 64px 폭만으로 접근을 보장하지 않는다. 발 중심 기준 비대칭 60×64 clearance와 문 깊이/문틀/앵커 위치가 함께 영향을 준다.
- Facility는 기존 1-tile 깊이 opening과 위56px 여유 때문에 중앙 정렬에서도 충분히 들어가지 못하는 것으로 해석된다.
- Cafe의 해당 y에서 clearance 윗부분과 위 문틀이 충돌한다. 문 전체가 어떤 정렬에서도 절대 접근 불가능하다는 증명은 아니다.
- 위56px는 80px Sprite 전체를 포함하지 않으므로 머리/Foreground 겹침을 완전히 제거하는 조건도 아니다.

## 10 NPC 구성 및 이동 범위

검증 전용 Placeholder만 사용한다. 실제 다른 Species/Animation을 추가하지 않았다.

| Size | 수 | Visual H / W | Physical footprint |
|---|---:|---|---|
| Small | 3 | 56 / 32px | 18×12 |
| Medium | 2 | 68 / 42px | 22×14 |
| Large | 3 | 80 / 56px | 26×16 |
| Max96 | 2 | 96 / 64px | 26×16 |

Max96는 크기 관찰 후보일 뿐 확정 Species 규격이 아니다.
**NPC smoke는 physical-only이며 Tiger의 Large architecture clearance 실험과 별개다.**
CORRIDOR 크기/속도48px/s/끝점 대기0.6s와 공유 swept footprint를 사용한다.
기존 waypoint 사이 직선으로 이동하고 끝에서 역방향 반복한다. grass는 기존대로 걸을 수 있다.
각 경로에 서로 반대 방향 2명. 시작 edge 위에서만 충돌 없는 위치로 stagger한다.
매 tick 정적 구조물, 다른 NPC, Player, world를 검사하고 막히면 위치/목표를 보존한다.
공간이 생기면 작은 다음 step으로 재개한다. Side-step, spacing, pathfinding은 없다.

| Route | 기존 Waypoint 순서 | 단독 NPC 600초: trips / arrivals | 혼합 300초: trips / arrivals | 혼합 최장 대기(60Hz) |
|---|---|---:|---:|---:|
| R1 | W01→W05→W12→W14→W20→W21 | 9 / 45 | 0 / 2 | 294.77s |
| R2 | W01→W05→W08→W05→W12→W14→W20→W22 | 8 / 59 | 0 / 3 | 294.77s |
| R3 | W05→W12→W13→W16→W20 | 11 / 47 | 0 / 2 | 293.10s |
| R4 | W05→W12→W18→W12→W14 | 9 / 38 | 0 / 0 | 294.17s |
| R5 | W09→W11→W12→W14 | 15 / 47 | 0 / 2 | 282.42s |

trips는 경로의 반대 끝에 도착한 횟수이며 왕복 1쌍이 아니다. arrivals는 중간 waypoint 도착도 포함한다.
단독 baseline은 각 경로의 첫 NPC(Small) 1명씩만 남겨 자동 검사한 결과다. 10명 혼합 성공으로 해석하지 않는다.
혼합은 30/60Hz 각300초 검사했으며 두 조건 모두 완주0, arrivals9, persistent deadlock이었다.
NPC 없는 경로를 Tiger Large bounds로 2px 간격 검사한 별도 결과는 R1/R2/R3/R5 불충족 지점 없음,
R4의 W12↔W18 불충족이다. R3는 W16 Approach까지만 포함하며 Cafe Door 통과를 보장하지 않는다.

## Block / Deadlock: [Observed Fact]

최종 60Hz 자동 300초 상태:

| Metric | 측정 |
|---|---:|
| Active NPC | 10 |
| Completed routes (trips) | 0 |
| Waypoint arrivals | 9 |
| Blocked >=0.5s | 10 |
| Long Block >=3s | 10 |
| Severe Block >=10s | 10 |
| 20s 이상 자연 회복 없는 NPC | 10 |
| Max continuous blocked time | 294.7667s |
| Solid / NPC physical overlap violation | 0 / 0 |

각 NPC의 현재 연속 대기는 ID 순서로
294.77, 249.27, 294.77, 249.83, 293.10, 258.25, 294.15, 294.17, 282.42, 282.42초다.
별도 deadlock episode counter는 구현하지 않았다. 위 10은 교착 영향을 받은 **NPC 수**이며 독립 교착 사건 10개를 뜻하지 않는다.
UI의 Waiting은 정지/끝점 대기/일시정지를 포함하므로 위 threshold별 수와 일반적으로 같지 않다.
이번 최종 상태에서는 전원 실제 blockedBy가 존재했다.

주요 차단 관계:
- W05/W08 사이 #1↔#3.
- W12 근처 #7↔#8, 뒤에서 #5/#6/#4/#2 누적.
- W11/W12 방향에서 #9↔#10.

브라우저 실측 첫 run은 24.5초: Moving3/Waiting7,
47.7초에서 일시정지 확인 후 재개, 61.9초: Moving0/Waiting10이었다.
61.9초에 route별 arrivals=2/3/2/0/2, trips는 모두0,
최장 대기=56.7/56.7/55.0/56.1/44.4초, event합계=12였다.
W10에 둔 Player는 주요 차단 원인에 포함되지 않았고 목록은 모두 NPC 상호 차단이었다.
시각 관찰에서 W12에 Placeholder 몸통이 겹쳤지만 노란/빨간 footprint 사각형은 분리돼 있었다.

NPC 메뉴 수정 후 두 번째 브라우저 run도 **242.1초**까지 관찰했다.
227.0초 RUNNING 상태에서 Moving0/Waiting10, 총 arrivals9/trips0을 확인했고,
242.1초에 관측 보존을 위해 수동 일시정지했다.
일시정지 시 R1~R5 최장 대기는236.8/236.8/235.2/236.2/224.5초였다.
이 run에서도 blocker는 모두 다른 NPC였고 자연 회복이 없었다. 안정 FPS61, 최종 console error/warn 로그는 빈 배열이었다.
두 run의 event 분배는 프레임 타이밍에 따라 조금 달랐으나 최종 arrivals/완주/교착 관계는 같았다.

별도 Player blocking 자동 검사는 10초 동안 목표/위치를 보존하고,
Player blocker 제거 후 다음 1/60초에 1px 미만 이동하며 재개했다. 순간이동/catch-up 없음.
이 검사는 **제거 가능한 blocker에 대한 recovery PASS**이며 NPC 상호 교착의 자연 회복 PASS가 아니다.

### [Interpretation]

직선 목표와 대기만 사용하는 규칙에서는 맞은편 NPC가 비켜주지 않으면 양쪽 모두 같은 목표를 계속 유지한다.
W12로 모이는 edge와 일부 공유 edge의 반대 방향 이동이 교착 및 후속 queue를 만든 것으로 보인다.
여유 폭을 스스로 이용하는 정책이 없으므로 이 결과로 3-tile/4-tile 표준의 우열을 결정할 수 없다.
Footprint만 분리하면 높이56~96px 몸통의 시각 겹침은 남는다.

## 브라우저 / 회귀 / 자동 검사

- 실제 Tiger 4방향 texture, 80px 크기, 발 anchor, feet depth 코드와 방향별 렌더를 확인했다.
- Follow/Overview, CCTV1/2와 overlap, waypoint marker, route/footprint/blocked overlay를 확인했다.
- 새 NPC 메뉴의 Scene 왕복 초기화 오류를 작은 React state 수정으로 해결했고, 복귀 후 `10 NPC · all routes`가 유지됨을 확인했다.
- 기존 Waypoint jump 메뉴는 복귀 시 W01로 표시될 수 있다. 이는 현재 위치 표시가 아니라 inspection 명령 선택이며 실제 위치는 좌측 Pixel 값이다. 이번 NPC 메뉴 수정 범위 밖의 기존 표시 한계다.
- Scale: READY, W 이동 (640,480)→(640,450), 80/26×16 유지. NPC12/24/35 선택, Zoom1/1.25, Gameplay75/25와 Full World, NPC12 클릭 선택 확인. 기존 4개 이동/clearance/NPC 안전성 검사 유지.
- Corridor: C 브라우저19.5초, trips8, 최장대기1.4초, events66, 무전진0초, FPS60. A~D 기존120초 자동 관측 유지. A의 기존 교착 판정도 보존한다.
- Plaza Graybox: 기존 5개 검사(96×56/3072×1792,8layers,객체·문·collision,CCTV overlap,22anchors North 연결) 유지. 기존 physical Probe 문 통과 검사도 PASS.
- `npm run typecheck`: PASS. `npm run build`: PASS(42 modules). 기존 >500kB bundle 경고는 WARN으로 유지했다. 새 오류로 분류하지 않았다.
- `npm test`: 기존14 + 신규4 = 18 PASS. 신규 검사는 실패 관찰값을 숨기지 않고 기록하며 physical 불변식을 검증한다.
- lint 미설정. 실행하지 않았다.
- 브라우저 관측 중 console error/warn 없음, Tiled map/placeholder palette/Tiger PNG 로딩 오류 없음.
- 관측 FPS는 안정 실행 시60~61. UI 수정 후/브라우저 표시 전에는 일시1~4FPS도 관측했고 이후60~61로 회복했다. 환경 전환 영향 가능성은 있으나 원인을 확정하지 않는다. 장시간/저사양 성능 보장은 아니다.

## 최종 판정 및 승인 전 정지

| 항목 | 판정 |
|---|---|
| 코드 자동 검사와 기존 physical Graybox 기준 | PASS |
| Tiger Large Cafe/Facility / W04,W07,W17~W19 접근 | FAIL |
| Bench/Tree/Foreground 및 W12 몸통 겹침 | WARN |
| 각 Route 단독 physical 반복 | PASS, 자동 baseline 한정 |
| 10 NPC 혼합 반복 및 자연 회복 | FAIL |
| 30/35 Full Flow 준비 상태 | FAIL, 진행하지 않음 |

다음 수정의 후보만 제시한다. 구현/Source of Truth 변경은 하지 않았다.

1. Door/Approach에서 현재 비대칭 clearance를 어떻게 적용할지 결정한다. doorway 전용 통과 조건을 둘지, 승인된 좌표/문 깊이/앵커를 개정할지 비교가 필요하다. 무조건 footprint 확대나 Sprite 전체 collision 전환은 대안으로 적용하지 않았다.
2. Facility 경로가 Large에 맞지 않는 문제를 먼저 다룬다. 물리-only NPC 성공과 Large 통행 가능성을 같은 기준으로 취급하지 않는다.
3. 공유 edge/교차점에서 누가 기다리고 누가 먼저 통과할지 최소 정책을 승인받는다. Side-step/spacing/새 waypoint 필요성은 후보이며 이번에는 구현하지 않았다.
4. 위 결정 후 동일10 NPC/동일경로로 재검증한다. 지속 교착과 접근 실패가 해결된 다음에 별도 승인을 받아 Full Flow 단계 여부를 결정한다.

최종 art, 실제 species 규격 확정, 시민/악당/CCTV gameplay, ML 상태는 모두 범위 밖이다.
