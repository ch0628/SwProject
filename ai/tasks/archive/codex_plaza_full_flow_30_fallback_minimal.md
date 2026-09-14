# Codex Task — Plaza/Park 30 NPC Fallback (Minimal Patch)

## 목적

이미 검증된 35 NPC Full Flow Harness를 그대로 재사용하여,
**35 NPC 구성에서 정확히 5명만 제거한 30 NPC fallback preset**을 추가하고
Warm-up 30s + Measurement 300s를 1회 실행한다.

이번 작업은 Density Reduction 검증이다.

Movement / Route / Spawn / Metric 의미를 다시 설계하지 않는다.

---

## 먼저 읽을 파일 — 최소 범위

```text
src/plazaFullFlow.ts
tests/fullFlowHarness.test.ts
scripts/measure-plaza-full-flow-35.mjs
src/plazaTraffic.ts
```

필요할 때만:

```text
src/PlazaParkScene.ts
src/main.tsx
```

다른 파일을 대규모로 읽거나 수정하지 마라.

---

# 1. 30 NPC 구성 — 승인 완료

35 NPC creator 결과에서 다음 ID만 제거한다.

```text
REMOVE = [2, 10, 16, 24, 28]
```

나머지 30 NPC는 그대로 유지한다.

절대 금지:

```text
ID renumber
re-spawn
spawn 위치 재계산
direction 변경
species 재배치
route 변경
target 변경
priority 변경
```

즉:

> 30 NPC = 동일한 35 NPC initial state에서 5 actor만 제거한 deterministic subset

이어야 한다.

---

# 2. 예상 30 NPC 분포

## Route

```text
R1 = 4
R2 = 4
R3 = 3
R4 = 4
R5 = 2
R6 = 4
R7 = 5
R8 = 4

Total = 30
```

## Species

```text
Rabbit = 7
Cat    = 6
Fox    = 6
Dog    = 6
Tiger  = 5
```

## Size Proxy

```text
Small  = 7
Medium = 18
Large  = 5
```

## Area

```text
Park           = 9
CentralPlaza   = 9
Cafe           = 2
PublicFacility = 3
MainRoute      = 4
EntryExit      = 3
```

## Movement Type

```text
Through     = 12   // R1 4 + R2 4 + R8 4
Local       = 11   // R5 2 + R6 4 + R7 5
Destination = 7    // R3 3 + R4 4
```

---

# 3. 구현 원칙

가능하면 35 creator를 그대로 호출한 뒤 subset만 만든다.

예:

```ts
createPlazaFullFlow30(map, external?)
```

내부 개념:

```ts
const state35 = createPlazaFullFlow35(map, external)
state35.run.npcs = state35.run.npcs.filter(n => !REMOVE_IDS.has(n.id))
```

단순히 배열만 자르면 metrics / initialAreas / expected counts가 35 기준으로 남을 수 있으므로,
30 preset의 summary/self-check가 정확한 count를 내도록 필요한 최소 처리만 한다.

중요:

- 유지된 NPC 객체의 id/x/y/route/species/size/ffArea/target/direction을 변경하지 않는다.
- 30명용 별도 spawn search를 돌리지 않는다.
- 35 NPC creator의 correctness를 약화시키지 않는다.

가능하면 30/35 공통 Harness 구조를 유지하되
대규모 refactor는 하지 않는다.

---

# 4. 30 NPC Self-check

생성 직후 다음을 assert한다.

```text
NPC = 30

Route = 4/4/3/4/2/4/5/4

Species = 7/6/6/6/5

Size = 7/18/5

Area =
Park 9
CentralPlaza 9
Cafe 2
PublicFacility 3
MainRoute 4
EntryExit 3
```

그리고 retained actor 각각에 대해
35 creator에서의 동일 ID와 비교하여:

```text
x
y
route
species
size
ffArea
spawnRegion
segmentStart
segmentEnd
target
direction
```

이 동일함을 테스트한다.

ID gap도 그대로 유지한다.

---

# 5. 35 NPC Regression 보호

반드시 그대로 유지:

```text
createPlazaFullFlow35() = 35 NPC
기존 35 self-check
기존 Harness tests
기존 35 raw logic result
```

30 preset 추가 때문에 35 결과 artifact를 덮어쓰지 않는다.

---

# 6. 30 NPC Measurement Script

추가:

```text
scripts/measure-plaza-full-flow-30.mjs
```

35 script를 최소 복제/공통화하여 사용한다.

조건:

```text
Warm-up = 30 sec
Measurement = 300 sec
Total = 330 sec
DT = 1/60
```

Canonical output:

```text
artifacts/plaza_full_flow_30_raw.json
```

35 raw 파일은 건드리지 않는다.

PASS Gate는 35와 동일한 의미를 사용한다.

```text
npc_count = 30
actual area counts 정확
R1~R8 모두 trips > 0
collision_violation_total = 0
deadlock_count = 0
ever_20sec_block_count = 0
unrecovered_20sec = 0
Cafe repeated transition
Facility repeated transition
queue unrecovered = 0
```

---

# 7. Tests — 최소 추가

`tests/fullFlowHarness.test.ts`에 최소 다음만 추가한다.

### A. 30 subset identity

```text
REMOVE = [2,10,16,24,28]
remaining IDs unchanged
30 NPC retained state = 35 creator same-ID state
```

### B. 30 exact counts

Route / Species / Size / Area counts 정확.

### C. 35 regression

기존 35 creator tests 그대로 PASS.

대규모 test rewrite 금지.

---

# 8. 절대 수정 금지

```text
Fix4 Movement
plazaTraffic movement semantics
Route R1~R8
Waypoint
TMJ / Map
Collision
Door
Spawn region definition
35 NPC allocation
Metrics semantics
Warm-up reset semantics
```

30 NPC가 FAIL해도:

```text
Fix5 금지
다른 NPC 제거 조합 재시도 금지
25 NPC 자동 fallback 금지
Route 변경 금지
Map 변경 금지
```

---

# 9. 실행

반드시:

```powershell
npm run typecheck
npm test
npm run build
node --experimental-strip-types scripts/measure-plaza-full-flow-30.mjs
```

를 실제 수행한다.

---

# 10. 최종 보고

다음만 간결하게 보고한다.

## 1. 변경 파일

## 2. 30 subset 검증

```text
Removed IDs
NPC count
Route counts
Species counts
Size counts
Area counts
retained state identical 여부
```

## 3. Regression

```text
35 creator/tests 유지 여부
typecheck
tests
build
```

## 4. 30 NPC Run

```text
R1~R8 trips
R1~R8 arrivals
R1~R8 max_wait

deadlock_count
ever_20sec_block_count
unrecovered_20sec
max_continuous_blocked_time

collision_violation_total

Cafe enter/exit
Facility enter/exit

Upper/Lower Narrow queue/pass
W12 max/end queue
W12 queue max wait
W12 queue recovery
```

## 5. 최종 판정

```text
PASS
PASS with WARN
FAIL
```

## 6. 중단

결과 보고 후 멈춘다.

문서 갱신 / Graphics / CCTV / Fix5 / 추가 fallback을 자동 시작하지 마라.
