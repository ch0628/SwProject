# Plaza & Park Limited Validation v2 — 최종 Prototype FAIL

2026-09-13. 승인된 v2 최소 수정 후 10 NPC/120초를 측정했다.
실패 후 deterministic fallback을 **한 번만** 적용하고 동일 10 NPC/120초를 측정했다.
추가 Limited v3/v4, 새 회피 개선, 30/35 NPC Full Flow는 진행하지 않는다.

## 1. 기준과 변경 파일

현재 사용자 지시 및 ai/RULES.md, ai/WORKFLOW.md, ai/CONTEXT_MAP.md,
docs/session_handoff_current.md를 기준으로 기존 구현을 이어받았다.
Map 기준은 최신 docs/map_plaza_park_spec.md이다.
기존 `docs/validation/general/corridor_capacity_results.md`,
`docs/validation/plaza_park_v1/plaza_park_graybox_results.md`,
`docs/validation/plaza_park_v1/plaza_park_large_clearance_limited_npc_results.md`,
`docs/map_scale_validation_spec.md`,
`docs/validation/general/scale_validation_results.md`,
`docs/reference/plaza_park_full_flow_validation_spec.md`를 참조했다.
이전 결과는 덮어쓰지 않았다. 작업 폴더는 Git 저장소가 아니므로 파일 내용/시각으로 확인했다.

| 이번 수정/추가 파일 | 내용 |
|---|---|
| src/plazaPark.ts | Door 정렬 구간, physical Enter 검사, Fence와 Building 의미 분리 |
| src/plazaTraffic.ts | 지연 side-step, Narrow 방향 예약, W12 FIFO, fallback 우선권, 문 숨김/복귀, 120초 상한과 측정 |
| src/PlazaParkScene.ts | Tiger Door Enter/Exit, 새 clearance 의미 연결, inside actor 표시/충돌 제외, 측정 표시 |
| tests/plazaTraffic.test.ts | 이전 장시간 검사를120초로 제한; Door/Fence 새 의미 검사 추가 |
| scripts/measure-plaza-limited.mjs | 60Hz120초, 매 frame 물리 검사, 측정 JSON 저장(기존 결과 덮어쓰기 거절) |
| docs/plaza_park_limited_v2_120s.json | 첫 v2 자동 관측 원본 |
| docs/plaza_park_limited_fallback_120s.json | fallback 자동 관측 원본 |
| 이 문서 | 최종 결과 |

96×56/3072×1792, W01~W22, 모든 좌표/문 폭/Path Width/CCTV/Asset은 유지했다.
TMJ 수정 시각은 기존 2026-09-13 04:50:37이며 재생성하지 않았다.
SHA256: `71C8DDC9F8F76EACBF602C9C52D9A2AC3D2C57552B97AD8BBBF4CFD3EA75B5F5`.
Scale/Corridor Scene 및 기존 메뉴 유지 수정도 그대로 보존했다.

## 2. Door / Fence semantics

일반 Building은 Large L/R30, Up56, Down8을 유지한다.
Door Opening의 통과 축에 footprint가 정렬되고 기존 Approach/Trigger에 발이 닿으면,
그 건물에 한해 Large 여유 대신 physical-only 검사를 사용한다.
Trigger만 예외로 두면 Facility는 Trigger에 발이 닿기 전에 Large 여유로 막히므로,
기존 Approach와 Opening에 정렬된 좁은 접근 구간까지 같은 의미를 적용했다.
다른 벽을 무시하지 않으며 모든 physical solid는 항상 검사한다.

Enter는 footprint와 Trigger의 겹침 및 현재 발 위치에서 Opening 안의 threshold까지
swept footprint 통과 가능성을 검사한다. 실제 내부 위치로 걸어 들어가지 않는다.
Enter하면 현재 threshold 접촉 위치를 보존한 채2초 숨기고, 같은 위치가 비어 있을 때 Exit한다.
점유되면 숨김 상태로 기다린다. 새 Interior/좌표/Waypoint를 만들지 않았다.
Tiger는 방향 입력으로 Enter하고, 복귀 직후 자동 재진입을 막는 cooldown을 사용한다.
NPC는 R3의 W16, R4의 W18 도착 시 기존 W17/W19를 문 동작 목표로 잠깐 사용한 뒤 원래 Route를 이어간다.
R1~R5의 기본 Waypoint 배열은 변경하지 않았다.

Fence는 physical-only이다. Bench/Tree/Lamp/NPC에도 Building용 clearance를 강제하지 않는다.
Sprite 크기80px/footprint26×16/bottom-center/feet-Y depth는 유지했다.

### [Observed Fact] Tiger

| 대상 | Physical / Enter | 브라우저 관찰 |
|---|---|---|
| Cafe | PASS | W16에서 Left, (684,1296)에서 Enter1/Exit0 INSIDE 확인. 이후 같은 위치 Enter1/Exit1 OUTSIDE |
| Facility | PASS | W06에서 Up, (2736,582)에서 Enter2/Exit1 INSIDE. 이후 Enter2/Exit2 OUTSIDE |
| W04 | PASS | (368,336) 점검 진입 후 Right로(383,336), 거절 없음 |
| W07 | PASS | (2320,368) 점검 진입 후 Right로(2323,368), 거절 없음 |

자동 입력50ms substep에서는 Cafe(684,1296), Facility(2736,579)에서 Enter 조건을 충족했다.
두 접근 매 step physical solid 침범0이며 Opening swept 검사도 통과했다.
고정 Waypoint W04/W07/W17/W18/W19의 새 semantics 점유 검사 PASS.
브라우저에서는 physical bounds/FPS/상태 표시를 확인했다. 별도 브라우저 collision episode logger는 없다.
Enter 성공은 최종 그림의 문틀/몸통 겹침까지 승인한다는 뜻이 아니다. 최종 Y-sort/Graphics는 이번 범위 밖이다.

## 3. 통행 정책과 fallback

### v2

- 기존 Corridor의0.35초 지연/32px/s right-hand side-step을 현재 edge 방향으로 회전해 사용했다.
- 기존48px/s 전진과 swept AABB를 유지하며 원래 edge에서48px 이내로만 짧게 벗어난다.
- Upper/Lower Narrow의 기존 Navigation 사각형에 방향 예약을 둔다. 선진입 방향은 점유자가 빠질 때까지 유지하고 반대 진입은 밖에서 기다린다. 빈 상태에서는 대기 순서 우선이다.
- W12 반경112px 진입 요청은 도착순, 같은 tick에서는 stable ID 순으로 처리한다. owner가128px 밖으로 나가면 다음 요청에 넘긴다.
- 예약 때문에 대기하는 NPC는 side-step으로 예약을 우회하지 않는다. 물리 충돌 검사는 모든 이동에 적용한다.

### v2 FAIL 후 적용한 fallback 1회

이 정책은 **Prototype deadlock 방지 목적의 deterministic traffic control**이며 사실적인 Crowd AI가 아니다.
64px 이내에서 반대 목표 방향의 낮은 ID를 발견하면 높은 ID가 대기한다.
우선 NPC가96px conflict 구간을 벗어나거나 inside가 되면 대기를 해제한다.
우선 NPC의 짧은 회피는 Corridor처럼 주된 수직축에 대해 한 축씩 움직인다.
동시에 회전한 두 축을 움직일 때 swept AABB가 상대 발의 모서리에 막히는 상황을 줄이려는 한 번의 fallback이다.
W12 FIFO와 Narrow 방향 예약은 유지한다. Random/Teleport/Collision 무시/통과-through는 없다.

## 4. 동일 조건

Small3(56px/18×12), Medium2(68px/22×14), Large3(80px/26×16), Max96 2(96px/26×16).
실제 다른 Species Asset을 사용하지 않았다. Max96는 검증용 후보다.
NPC는 이전처럼 physical-only이며 새 Tiger clearance를 모두 강제하는 실험이 아니다.
각 Route에 양쪽 출발2명, 같은 초기 edge stagger, 같은 Map, 동일48px/s이다.

| Route | 기본 Waypoint 순서 |
|---|---|
| R1 | W01 W05 W12 W14 W20 W21 |
| R2 | W01 W05 W08 W05 W12 W14 W20 W22 |
| R3 | W05 W12 W13 W16 W20 |
| R4 | W05 W12 W18 W12 W14 |
| R5 | W09 W11 W12 W14 |

trips는 반대쪽 경로 끝 도착 횟수이며 왕복 한 쌍이 아니다.
arrivals는 중간 Waypoint 도착도 포함한다. Door 동작용 W17/W19는 일반 Route arrivals에 더하지 않는다.
각 측정은60Hz120초이며 runtime도120초에서 자동 일시정지한다. 300초로 연장하지 않았다.
최종 단위 검사는 같은 fallback 구현의 재검증이며 새 정책 iteration이 아니다.

## 5. [Observed Fact] 자동120초 결과

| Metric | v2 첫 run | fallback 최종 run |
|---|---:|---:|
| active_npc(측정 끝 visible) | 10 | 10 |
| completed_routes | 1 | 5 |
| waypoint_arrivals | 22 | 29 |
| blocked_npc_count >=0.5s | 9 | 7 |
| max_continuous_blocked_time | 114.3333s | 115.2833s |
| severe_block_count 현재 >=10s | 9 | 7 |
| 20sec+ 현재 unrecovered | 9 | 7 |
| 물리 collision violation | 0 | 0 |
| 0.5s+ 정지 후 이동 재개 횟수 | 5 | 12 |

Blocked는 목표가 있으나 실제 이동이 없는 연속 시간이다. 끝점 pause/inside는 의도된 대기로 제외한다.
side-step 등 실제 이동에 성공하면 연속 Block은 끊긴다. forwardWait는 side-step 시점 계산용으로 별도 유지한다.
Max는 run 전체 최고 연속 시간, severe/20s+ count는 측정 끝 현재 상태다.
따라서 count는 독립 deadlock 사건의 누적 개수가 아니라 미회복 NPC 수다.
실시간 UI Waiting은 endpoint pause 등을 포함하므로 blocked_npc_count와 다를 수 있다.
collision violation은 매 frame world/solid/NPC footprint를 검사한 위반 관측 수이며 두 run 모두0이다.

| Route | v2 trips / arrivals / max block | fallback trips / arrivals / max block |
|---|---|---|
| R1 | 0 / 3 / 114.33s | 0 / 0 / 113.18s |
| R2 | 0 / 5 / 114.28s | 0 / 1 / 115.28s |
| R3 | 0 / 3 / 87.37s | 0 / 6 / 50.68s |
| R4 | 1 / 9 / 42.93s | 1 / 9 / 21.00s |
| R5 | 0 / 2 / 102.03s | 4 / 13 / 20.08s |

fallback 끝의 차단:
- W05/W08: #1은NPC3에 막힘, #3은ID1 양보 중. #6/#8도ID1 양보 누적.
- W20/Main Route: #2는NPC4에 막힘, #4는ID2 양보 중. #5도ID4 양보 누적.
- W11/W12 R5는 일부 장기 대기 후 이동 재개했지만 최장20.08초로 목표10초 미만을 충족하지 못했다.
- W12 FIFO owner/queue는 두 자동 run 종료 시 비어 있었다. R4는 이 merge를 지나 완주했다. 전체 merge의 모든 조합 무교착을 보장하지 않는다.
- Upper Narrow의 R2는 다른 위치의 교착 때문에 전체 Route를 완료하지 못했다. Upper 통과 Gate를 PASS로 판정하지 않는다.
- Lower Narrow는 R5 및 다른 Route가 사용했고 fallback 종료 시ID9가 예약 점유 중이었다. 예약의 전방향/FIFO 공정성 전수 검사는 하지 않았다.
- Door: v2 NPC Enter/Exit 합계4/4, fallback5/5. Cafe와 Facility 모두 상태 전환 발생. 대량 문 대기열은 미검증이다.

단독120초 baseline은 R1~R5 trips=1/1/2/1/3, arrivals=8/9/9/6/10, 최장 Block0이다.
이는 각각 Small1명만 남긴 자동 검사이며10명 혼합 PASS의 근거가 아니다.

## 6. [Interpretation]

첫 v2에서는 서로 반대인 목표점으로 복귀하려는 움직임과 보수적인 swept AABB가 결합해
짧은 회피 이후에도 모서리 접촉 상태가 풀리지 않는 것으로 보인다.
fallback은 일부 교행/R5 완주를 늘렸지만, 높은 ID를 세워 두는 것만으로 낮은 ID가 지나갈 공간을 보장하지 못했다.
낮은 ID가 다시 상대에게 물리적으로 막히면 양보 관계가 유지되는 교착이 남는다.
W12 자체의 우선권만으로 W05나 W20의 상호 차단을 해결할 수 없다.
이 결과는 현재 Movement System의 Prototype 한계다. 통로 폭 변경의 근거로 사용하지 않는다.

## 7. 자동 검사 / 브라우저 / 회귀

- typecheck PASS, build PASS(42 modules). 기존 >500kB bundle warning 유지, 새 오류로 분류하지 않음.
- tests19 PASS: 기존14개+이전 Limited4개 조정+Door/Fence semantics1개.
- 이전 Large 실패 재현 검사는 의도적으로 옛 Building+Fence 조건을 넣어 보존했다. 출력의 W04/W07=false는 새 runtime 정책의 결과가 아니다. 새 정책 검사는 별도로 PASS다.
- lint 미설정, 실행하지 않음.
- 이전 physical Graybox 구조/8Layer/22Waypoint North 연결/CCTV/문 collision 검사 PASS.
- Scale/Corridor 로직은 이번 작업에서 수정하지 않았고 기존 충돌/교통 테스트는 유지했다.
- 브라우저 Tiger texture/map/placeholder 로드, Cafe/Facility Enter와 Exit, W04/W07 이동을 확인했다.
- 브라우저 안정 관측60~61FPS, 관측 console error/warn 없음. 장시간 성능 검증은 아니다.
- NPC body/발 크기 및 art/Y-sort는 그대로다. physical overlap0이어도 시각 body overlap 가능성은 남으며 Visual WARN이다.

### 브라우저 최종120초 관측

동일 fallback/10 NPC, Player는 기존 W10에 둔 채120.0초 자동 PAUSED를 확인했다.
completed routes5, arrivals29, Blocked7, Severe7, 현재20s+6, Recoveries12, Active10.
Route별 trips=0/0/0/1/4, arrivals=0/1/6/9/13,
max block=113.2/115.3/50.6/19.7/20.5초였다.
최종 console error/warn 로그는 빈 배열이었다.

브라우저20s+6과 고정60Hz 자동 결과7은 별개 관측값이다.
브라우저는 가변 frame delta를 사용하며 R4의 최장 대기가19.7초로 threshold 아래였다.
정확한 frame별 event 수가 동일하다고 주장하지 않는다. 두 환경 모두 R1~R3 완주0과 장기 미회복으로 FAIL이다.
120초 PAUSED의 Moving0/Waiting10은 자동정지 상태 표시이며, 10명 모두 교착이라는 뜻은 아니다.

최종 Scale 브라우저 회귀: READY, W 입력으로(640,480)에서(640,462), up texture,80px/26×16, FPS60.9 확인.
최종 Corridor C 브라우저 회귀:47.9초, trips24, 최장대기1.6초, events151, 무전진0.3초, FPS61.
Plaza 복귀 시120초 자동 PAUSED, NPC all 선택, Tiger Enter2/Exit2가 유지됐다.

## 8. 최종 Gate / Hard Stop

Tiger Cafe/Facility Enter, W04/W07 접근: **PASS**.
v2 첫 혼합120초: **FAIL**.
fallback 최종 혼합120초: **FAIL**.
최종 Prototype Gate: **FAIL — R1~R5 전부 completion 조건과 무교착 조건 미충족**.

35 NPC 실사용 Flow Test로 진행 가능하다고 보고하지 않는다.
fallback 이후 추가 Movement 수정, Limited v3/v4, Full Flow를 시작하지 않았다.
추가 알고리즘 제안/구현으로 반복하지 않고 현재 결과와 한계를 남겨 종료한다.
