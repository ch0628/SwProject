# Antigravity Task — Plaza/Park 35 NPC Full Flow Harness Implementation + Logic Run

## 0. 작업 목적

Plaza/Park의 **35 NPC Full Flow Harness**를 구현하고,
동일 Harness를 사용해 Node 기반 Logic Simulation을 실제로 실행하여 결과를 보고한다.

이번 작업의 핵심은:

```text
R1~R8 정식 Route
+ 35 NPC 확정 배치
+ Species / Collision Proxy 확정
+ Warm-up 30 sec
+ Measurement 300 sec
+ 기존 Fix4 Movement 그대로
```

이다.

중요:

> 이번 작업에서 35 NPC 결과가 FAIL하더라도
> Movement Fix5, Route 수정, Map 수정, 30 NPC fallback을 자동으로 진행하지 않는다.
> 결과를 그대로 보고하고 멈춘다.

문서 Source of Truth는 **결과 검토 후 사용자가 별도로 갱신할 예정**이다.
이번 Agent 작업에서는 narrative `.md` 문서를 임의로 수정하지 마라.

---

# 1. 반드시 먼저 읽기

Repository 기준으로 다음 파일을 먼저 읽어라.

```text
ai/RULES.md
ai/WORKFLOW.md
ai/CONTEXT_MAP.md

docs/session_handoff_current.md
docs/reference/plaza_park_full_flow_validation_spec.md
docs/validation/plaza_park_v1/plaza_park_candidate_route_validation_results.md
docs/map_plaza_park_spec.md
docs/graphics_character_asset_spec.md
docs/supervised_learning_area_rollout_plan.md

src/plazaTraffic.ts
src/PlazaParkScene.ts
src/main.tsx
src/config.ts
src/collision.ts
src/corridorCapacity.ts
src/plazaPark.ts

tests/candidateRoutes.test.ts
tests/plazaTraffic.test.ts

public/maps/plaza-park.tmj
```

관련 기존 측정 script가 있다면 같이 읽는다.

예:

```text
scripts/measure-plaza-fix4.mjs
```

실제 repository 구조가 다르면 존재하는 동일 목적 파일을 사용한다.

---

# 2. 현재 확정된 Route Source of Truth

다음 R1~R8은 모두 정식 승인 상태다.

```text
R1 = W01 → W05 → W12 → W14 → W20 → W21
R2 = W01 → W05 → W08 → W05 → W12 → W14 → W20 → W22
R3 = W05 → W12 → W13 → W16 → W20
R4 = W05 → W12 → W18 → W12 → W14
R5 = W09 → W11 → W12 → W14

R6 = W03 → W05 → W07
R7 = W13 → W14 → W15
R8 = W21 → W20 → W22
```

R6~R8 Dynamic Validation은 완료됐다.

```text
Single Small / Medium / Large = PASS
Bidirectional Large + Large = PASS
collisionViolation = 0
unrecovered_20sec = 0
```

`R6~R8`을 다시 Candidate로 취급하지 마라.

---

# 3. 35 NPC Route별 인원 — 승인 완료

정확히 다음 인원으로 구성한다.

```text
R1 = 4
R2 = 5
R3 = 4
R4 = 4
R5 = 2
R6 = 5
R7 = 6
R8 = 5

Total = 35
```

Movement Type 분류:

```text
Through Traffic:
R1 4 + R2 5 + R8 5 = 14

Local Activity:
R5 2 + R6 5 + R7 6 = 13

Destination Traffic:
R3 4 + R4 4 = 8

Total = 35
```

주의:

`R8`은 Main Route를 가로지르는 **Through Traffic**으로 집계한다.

---

# 4. Species 구성 / Collision Proxy — 승인 완료

Species 수:

```text
Rabbit = 8
Cat    = 7
Fox    = 7
Dog    = 7
Tiger  = 6

Total = 35
```

Full Flow Collision Proxy:

```text
Rabbit → Small  = 18×12
Cat    → Medium = 22×14
Fox    → Medium = 22×14
Dog    → Medium = 22×14
Tiger  → Large  = 26×16
```

중요:

```text
Rabbit / Cat / Fox / Dog
→ Full Flow validation proxy
→ 최종 Species-specific footprint가 아님

Tiger 26×16
→ 실제 확정 footprint
```

`Max96`은 35 NPC Species 구성에서 사용하지 않는다.

Species는 deterministic하게 분산한다.

권장:

```text
Rabbit → Cat → Fox → Dog → Tiger
```

순환 배치하되 최종 quota가 정확히:

```text
8 / 7 / 7 / 7 / 6
```

이 되도록 한다.

특정 Route에 Tiger 또는 Medium actor가 몰리지 않도록
deterministic round-robin으로 Route 전체에 분산한다.

---

# 5. 초기 Spawn 분포 목표 — 기존 승인값 유지

35 NPC 초기 Spawn은 다음 분포를 정확히 만족하도록 한다.

```text
Park                     = 11
Central Plaza            = 10
Cafe 주변                 = 3
Public Facility 주변      = 3
Main Route                = 5
Entry / Exit 이동중        = 3

Total                    = 35
```

Route별 인원과 모순 없이 다음 allocation을 사용해도 된다.

```text
Park:
R6 5 + R5 2 + R1 2 + R2 2 = 11

Central Plaza:
R7 6 + R1 1 + R2 1 + R3 1 + R4 1 = 10

Cafe 주변:
R3 3 = 3

Public Facility 주변:
R4 3 = 3

Main Route:
R8 5 = 5

Entry / Exit 이동중:
R1 1 + R2 2 = 3
```

이 allocation은 **초기 Spawn 위치 목적**이고,
Route 자체를 바꾸는 것이 아니다.

---

# 6. Spawn 구현 원칙

## 6.1 금지

다음은 금지한다.

```text
새 Waypoint
TMJ 수정
Map geometry 수정
Door width 수정
Collision 완화
임의 teleport 좌표 하드코딩
NPC끼리 겹친 Spawn
Collision object 내부 Spawn
World bounds 밖 Spawn
```

## 6.2 허용 방식

기존 Route segment / waypoint와
기존 Map Spec의 승인된 영역을 이용해 deterministic하게 Spawn한다.

권장 구조:

```ts
type FullFlowSpawnDescriptor = {
  route: AllRouteId;
  area: FullFlowArea;
  species: Species;
  size: FullFlowSize;
  // 기존 route의 어느 segment에서 시작할지 나타내는 정보
  fromIndex: number;
  toIndex: number;
  // 또는 equivalent deterministic seed
}
```

실제 spawn 위치는 해당 Route segment 위에서:

```text
approved physical footprint
+ fixed collision
+ existing NPC footprint
+ world bounds
```

를 검사하면서 deterministic offset search로 찾는다.

기존 `createSmoke()`처럼 `canOccupy()`를 사용한다.

32px 또는 64px deterministic increment는 허용한다.

단:

> 해당 area / route 조건을 만족하는 안전 Spawn을 찾지 못하면
> 다른 지역으로 조용히 재배치하지 말고 explicit error를 발생시켜라.

Spawn 완료 후 반드시 runtime assertion:

```text
NPC count = 35
Route counts 정확
Species counts 정확
Size proxy 정확
Area counts 정확
initial fixed collision = 0
initial NPC-NPC overlap = 0
world bounds violation = 0
```

을 수행한다.

---

# 7. 기존 Limited Smoke Regression은 그대로 유지

현재:

```text
SMOKE_ROUTES = R1~R5
createSmoke(map) = 10 NPC
stepSmoke default duration = 120 sec
```

의 의미를 깨뜨리면 안 된다.

특히 금지:

```text
SMOKE_ROUTES를 R1~R8로 바꿔 createSmoke()가 16명을 만드는 것
기존 120 sec를 330 sec로 단순 치환하는 것
기존 tests의 기대값을 Full Flow에 맞춰 수정하는 것
```

기존 Limited와 Full Flow를 분리한다.

---

# 8. 권장 파일 구조

기존 `src/plazaTraffic.ts`에 Full Flow 전부를 밀어 넣지 않는 것을 권장한다.

예:

```text
src/plazaTraffic.ts
→ Fix4 movement core
→ R1~R8 path lookup
→ Limited Smoke 유지

src/plazaFullFlow.ts
→ Full Flow preset / creator
→ warm-up / measurement phase
→ Full Flow metric collector
→ resetMeasurement()
```

정확한 파일명은 프로젝트 스타일에 맞게 조정 가능하다.

핵심은:

```text
Movement Core
≠ Full Flow Scenario / Measurement Harness
```

를 분리하는 것이다.

---

# 9. stepSmoke Duration 일반화

현재 `stepSmoke()`는 120 sec에서 자동 정지한다.

Full Flow에서는:

```text
Warm-up 30 sec
+
Measurement 300 sec
=
Total Simulation 330 sec
```

가 필요하다.

최소 변경으로 `SmokeRun`에 optional duration을 추가해도 된다.

예:

```ts
type SmokeRun = {
  ...
  maxSeconds?: number;
}
```

그리고:

```ts
const maxSeconds = run.maxSeconds ?? 120;
```

형태로 기존 default 120 sec를 보존한다.

Limited:

```text
maxSeconds undefined
→ 120 sec
```

Full Flow:

```text
maxSeconds = 330
```

기존 `createSmoke()` 반환값에 330을 넣지 마라.

---

# 10. Warm-up / Measurement — 정확한 정책

## 10.1 Phase

```text
0 <= t < 30
→ WARMUP

30 <= t < 330
→ MEASUREMENT

t >= 330
→ COMPLETE
```

## 10.2 Warm-up 동안

실제 Fix4 Traffic을 그대로 실행한다.

```text
Movement
Yield
Side-step
Narrow Reservation
W12 FIFO
Door Enter / Exit
Collision
```

전부 정상 작동해야 한다.

가짜 warm-up이나 정지 상태는 금지한다.

## 10.3 t = 30 sec

NPC를 재Spawn하지 않는다.

### 반드시 유지

```text
x / y
target
direction
pause
doorTarget
inside

Narrow locks:
members
queue
direction

W12 merge:
owner
queue

yieldTo
yieldBackoff
forwardWait
기타 Movement Control State
```

### Measurement Counter만 초기화

```text
trips = 0
arrivals = 0
blockedEvents = 0
longestWait = 0
recoveries = 0
enters = 0
exits = 0

measurement current wait = 0
measurement blocked accumulator = 0
measurement collision accumulator = 0
door measurement counts = 0
narrow measurement counts = 0
W12 measurement counts = 0
```

현재 `SmokeNpc.wait`가 measurement block duration 역할을 하므로
t=30에서 `wait = 0`으로 reset해도 된다.

단:

```text
forwardWait
yieldTo
yieldBackoff
reservation / merge state
```

는 유지하여 Traffic behavior가 warm-up boundary에서 바뀌지 않게 한다.

`blockedBy`는 measurement event를 새로 셀 수 있도록 reset해도 된다.
`blockedBy`가 Movement permission에 사용되지 않는지 실제 코드를 확인한 뒤 처리한다.

## 10.4 Boundary 처리

30초를 frame delta가 넘어가는 경우
warm-up과 measurement를 한 frame에 섞지 않는다.

가능하면 boundary에서 dt를 split하여:

```text
... → exactly 30.000 sec
reset measurement
remaining dt → measurement
```

순서로 처리한다.

Node와 Browser가 동일한 semantics를 사용해야 한다.

---

# 11. Full Flow Metric Collector

Node와 Browser에서 동일한 Collector를 재사용한다.

최소 결과:

```text
npc_count
route_counts
species_counts
size_counts

warmup_seconds
measurement_seconds

completed_routes
waypoint_arrivals
per_route:
  trips
  arrivals
  max_wait
  blocked_events

blocked_time_total
max_continuous_blocked_time
blocked_npc_count_end
blocked_npc_count_peak

severe_block_count
unrecovered_20sec
deadlock_count

recoveries

collision_violation

cafe_enter_count
cafe_exit_count
facility_enter_count
facility_exit_count

upper_narrow_pass_count
lower_narrow_pass_count
upper_narrow_max_queue
lower_narrow_max_queue

w12_max_queue
w12_owner_change_count
w12_queue_recovery_count
```

## Metric 의미

### blocked_time_total

Measurement 동안:

```text
blockedBy != ''
```

인 NPC의 actor-seconds 누적값으로 기록한다.

이 값은 `Blocked >= 0.5s` 분류와 별개의
raw waiting-time accumulator라고 결과 JSON에 명시한다.

### blocked_npc_count

현재 프로젝트의 Block 기준:

```text
wait >= 0.5 sec
```

을 사용한다.

```text
blocked_npc_count_end
= measurement 종료 시점

blocked_npc_count_peak
= measurement 동안 최대 동시 Blocked NPC 수
```

### severe_block_count

각 Block episode가:

```text
wait >= 10 sec
```

를 최초로 넘을 때 1회 증가한다.

같은 episode에서 frame마다 중복 증가시키지 않는다.

### unrecovered_20sec / deadlock_count

Prototype Hard FAIL 판단을 위해
20초 threshold crossing을 놓치지 않는다.

권장:

```text
deadlock_count
= measurement 중 20 sec threshold에 도달한 unique block episode 수

unrecovered_20sec
= measurement 종료 시점에도 wait >= 20 sec인 NPC 수
```

추가로:

```text
ever_20sec_block_count
```

를 별도로 기록해도 된다.

PASS Gate에서는:

```text
deadlock_count = 0
ever_20sec_block_count = 0
collision_violation = 0
```

이어야 한다.

### Door count

현재 core에서:

```text
W16 → W17 = Cafe
W18 → W19 = Facility
```

의미를 이용한다.

enter/exit transition을 실제 state change로 측정한다.

Route 이름만 보고 count를 추정하지 않는다.

### Narrow

Upper / Lower Narrow 영역의 실제 physical membership transition을
추적하여 pass count를 측정한다.

### W12

실제 `run.merge.owner / queue` 상태를 관찰하여:

```text
max queue
owner changes
non-empty queue → empty queue recovery
```

를 측정한다.

---

# 12. Physical Collision Measurement

Full Flow Measurement 동안 매 simulation step에서:

```text
fixed collision
NPC-NPC physical overlap
world bounds
```

를 검사한다.

Sprite visual overlap은 여기서 collision violation으로 세지 않는다.

`collision_violation`은 physical footprint 기준이다.

같은 frame에서 A-B / B-A를 이중 계산하지 않도록
pair는 `i < j` 방식으로 센다.

결과에:

```text
fixed_collision_violation
npc_collision_violation
world_bounds_violation
collision_violation_total
```

을 가능하면 분리해서 출력한다.

PASS는 전부 0이어야 한다.

---

# 13. 35 NPC Full Flow Creator

명시적인 entry point를 만든다.

예:

```ts
createPlazaFullFlow35(map, external?)
```

반환 객체는 최소:

```text
35 NPC SmokeRun
phase state
measurement state
metric collector state
```

를 포함한다.

생성 직후 self-check를 실행한다.

잘못된 count / overlap / spawn이면
silent fallback 없이 throw한다.

---

# 14. Node Logic Measurement Script

35 NPC Full Flow를 자동 실행하는 script를 추가한다.

예:

```text
scripts/measure-plaza-full-flow-35.mjs
```

Repository 기존 script convention을 우선한다.

실행:

```text
Warm-up = 30 sec
Measurement = 300 sec
Simulation step = 1/60 sec
```

실제 wall-clock 330초를 기다릴 필요는 없다.
Node에서는 deterministic simulation time으로 빠르게 실행한다.

단:

> simulation semantics는 Browser와 동일한 Full Flow Harness를 사용해야 한다.

별도 간이 movement simulator를 만들면 안 된다.

최종 JSON을 stdout에 출력한다.

가능하면 raw result도:

```text
artifacts/plaza_full_flow_35_raw.json
```

같은 non-Source-of-Truth 위치에 저장한다.

Repository에 기존 validation output convention이 있다면 그것을 따른다.

Narrative Markdown Result 문서는 만들지 마라.

---

# 15. Browser Full Flow Mode

실제 Phaser Browser에서도 같은 35 NPC Scenario를 실행할 수 있어야 한다.

기존 10 NPC Smoke UI는 유지한다.

최소 추가:

```text
Full Flow 35 Start
Full Flow Stop / Reset
```

또는 기존 selector convention에 맞는:

```text
full35
```

mode 하나.

기존 R1~R5 smoke menu를 삭제하거나 바꾸지 마라.

## Browser Report

최소 표시:

```text
NPC 35
Phase: WARMUP / MEASUREMENT / COMPLETE
Global elapsed
Measurement elapsed

Completed Routes
Collision
20s+ Block / Deadlock
Max Wait
Door counts
Narrow queue
W12 queue

FPS current
FPS avg during measurement
FPS min during measurement
```

FPS는 **Measurement 300 sec 동안만** 집계한다.
Warm-up FPS를 measurement average에 섞지 않는다.

Node 결과에는 FPS를 쓰지 마라.

Node-only 결과로 FPS PASS를 주장하지 마라.

---

# 16. PlazaParkScene 현재 호환 문제도 함께 처리

현재 Scene은 Candidate path lookup은 지원하지만
표시 로직 일부가 R1~R5에 묶여 있을 수 있다.

실제 코드를 확인하여 최소 수정한다.

예:

```text
Object.keys(SMOKE_ROUTES)
5개 route color array
/120s 고정 표시
```

Full Flow mode에서만 R1~R8 / 330 sec / phase가
정상적으로 표시되도록 한다.

Limited Smoke 화면 의미는 그대로 유지한다.

---

# 17. Test 추가

새 테스트를 추가한다.

예:

```text
tests/fullFlowHarness.test.ts
```

최소 검증:

## A. Creator self-check

```text
NPC = 35
route counts = 4/5/4/4/2/5/6/5
species = 8/7/7/7/6
proxy size counts 정확
area counts = 11/10/3/3/5/3
initial fixed collision = 0
initial NPC overlap = 0
world bounds violation = 0
```

## B. Limited Regression

```text
createSmoke(map).npcs.length = 10
default duration = 120 sec
R1~R5 기존 semantics 유지
```

기존 테스트도 그대로 통과해야 한다.

## C. Warm-up reset state preservation

t=30 reset 전/후:

유지 확인:

```text
x/y
target
direction
pause
inside
doorTarget
forwardWait
yieldTo
yieldBackoff
locks
merge
```

reset 확인:

```text
trips
arrivals
blockedEvents
longestWait
recoveries
enters
exits
measurement wait
measurement accumulators
```

## D. Phase duration

```text
29.99 → WARMUP
30.00 → MEASUREMENT
329.99 → MEASUREMENT
330.00 → COMPLETE
```

floating point 때문에 exact literal 비교가 취약하면
epsilon-based check를 사용한다.

## E. Short Full Flow Smoke

전체 330초를 unit test에 강제하여 test suite를 불필요하게 느리게 만들지 않아도 된다.

대신 Harness가:

```text
multiple routes
35 NPC
warm-up boundary
measurement collector
```

를 몇 초 동안 실제 `stepSmoke()`로 실행하는 short smoke test를 추가한다.

실제 330초 run은 Node measurement script에서 수행한다.

---

# 18. 실제 35 NPC Logic Run

구현 완료 후 반드시 실제 script를 실행한다.

결과를 숨기거나 FAIL을 수정하려 하지 마라.

판정 기준:

## PASS

```text
npc_count = 35

R1~R8 모두 measurement trips > 0

collision_violation_total = 0

deadlock_count = 0
ever_20sec_block_count = 0
unrecovered_20sec = 0

Cafe enter / exit 반복 발생
Facility enter / exit 반복 발생

Upper / Lower Narrow에서
20 sec+ unrecovered 교착 없음

W12 queue가 영구 누적되지 않음
```

`max wait < 10 sec`는 목표이지 Hard FAIL이 아니다.

## WARN

```text
3~10 sec Block 후 회복
10~20 sec Block 후 회복
순간 Queue
Body visual overlap
```

단:

```text
20 sec+ block
```

은 이번 Full Flow에서는 FAIL로 본다.

---

# 19. 35 NPC FAIL 시 행동

다음은 자동으로 하지 마라.

```text
Movement tuning
Fix5
Route 수정
NPC count 30으로 감소
Map 수정
Collision 완화
Spawn area 변경
```

FAIL result를 그대로 저장하고 보고한다.

30 NPC fallback은
사용자와 별도 배치를 확정한 뒤 다음 작업에서 수행한다.

---

# 20. 실행 명령

반드시 실행:

```powershell
npm run typecheck
npm test
npm run build
```

그 다음 35 NPC Node Logic Run script 실행.

예:

```powershell
node scripts/measure-plaza-full-flow-35.mjs
```

실제 package/script 구조에 맞게 명령을 사용한다.

---

# 21. 최종 보고 형식

아래 순서 그대로 보고한다.

## 1. 변경 파일

각 파일별 변경 목적.

## 2. 기존 Fix4 semantics

```text
변경 없음 / 변경 있음
```

변경 있다면 즉시 명시.

## 3. 기존 Limited Regression

```text
createSmoke NPC count
default duration
기존 tests
```

## 4. Full Flow Creator Self-check

```text
NPC count
route counts
species counts
size counts
area counts
initial collision
```

## 5. Warm-up Reset

```text
Traffic state preserved 여부
Measurement counter reset 여부
```

## 6. 35 NPC Node Logic Run

전체 JSON 또는 충분한 핵심 필드:

```text
warmup_seconds
measurement_seconds

completed_routes
waypoint_arrivals

R1~R8 trips
R1~R8 max wait

blocked_time_total
max_continuous_blocked_time
blocked_npc_count_peak

severe_block_count
deadlock_count
ever_20sec_block_count
unrecovered_20sec

recoveries

collision_violation_total

Cafe enter / exit
Facility enter / exit

Upper Narrow pass / max queue
Lower Narrow pass / max queue

W12 max queue / owner change / queue recovery
```

## 7. Browser Full Flow Mode

```text
구현 여부
직접 5분 Browser 측정을 실제 수행했는지 여부
```

실제 실행하지 않았다면:

```text
NOT MEASURED
```

라고 명확히 쓴다.

FPS를 추정하지 마라.

## 8. typecheck

PASS / FAIL

## 9. tests

기존 tests와 신규 tests를 구분해서 결과 작성.

## 10. build

PASS / FAIL

기존 Bundle Size Warning은 별도 WARN.

## 11. 최종 Logic 판정

```text
PASS
PASS with WARN
FAIL
```

근거를 숫자로 제시한다.

## 12. 중단

결과 보고 후 멈춘다.

다음 작업:

```text
Graphics Integration
30 NPC fallback
Movement Fix
문서 갱신
```

중 어떤 것도 자동으로 시작하지 마라.

---

# 22. 금지사항 요약

```text
Map 수정 금지
TMJ 수정 금지
Waypoint 수정 금지
Door Width 수정 금지
Collision 완화 금지

Fix4 Movement 재작성 금지
Fix5 자동 시작 금지
새 pathfinding 금지
본격 personal spacing 금지

기존 createSmoke 10 NPC 의미 변경 금지
기존 120 sec regression 변경 금지

30 NPC fallback 자동 실행 금지

Narrative Source-of-Truth 문서 자동 갱신 금지
Graphics 작업 금지
CCTV 구현 금지
Shopping / Residential 작업 금지
```

이 작업은 **35 NPC Full Flow Harness 구현 + Node Logic Measurement 결과 보고**까지만 한다.
