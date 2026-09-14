# Codex Task — Plaza/Park 35 NPC Full Flow Harness Correctness Fix + Re-run

## 목적

현재 구현된 35 NPC Full Flow Harness의 **측정 정확성 문제만 수정**하고,
동일한 35 NPC 조건으로 Logic Simulation을 다시 실행한다.

이번 작업은 Movement 개선 작업이 아니다.

현재 첫 35 NPC Run은 다음 문제 때문에 **최종 FAIL로 확정하지 않는다**.

```text
1. area label과 실제 spawn 좌표가 일치하는지 검증되지 않음
2. blocked_events 측정값이 실제로 증가하지 않음
3. narrow max queue가 reservation queue가 아니라 zone 내부 NPC 수를 셈
4. narrow pass가 실제 통과 완료가 아니라 zone 진입 순간 count됨
5. warm-up 종료 시 W12 metric baseline이 제대로 seed되지 않을 수 있음
6. raw JSON이 기존 파일 존재 시 갱신되지 않음
7. warm-up reset test가 실제 보존해야 할 traffic state를 충분히 assert하지 않음
8. phase boundary test 일부가 stepFullFlow 내부 0.05s cap 때문에 의도한 시간을 실제로 진행하지 않음
```

이 문제를 수정한 뒤 **35 NPC / Warm-up 30s / Measurement 300s**를 다시 실행하고,
결과를 보고한 뒤 멈춘다.

---

# 1. 반드시 먼저 읽기

Repository 기준 다음 파일을 읽는다.

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
src/plazaFullFlow.ts
src/PlazaParkScene.ts
src/main.tsx
src/collision.ts
src/corridorCapacity.ts
src/plazaPark.ts

tests/plazaTraffic.test.ts
tests/candidateRoutes.test.ts
tests/fullFlowHarness.test.ts

scripts/measure-plaza-full-flow-35.mjs

public/maps/plaza-park.tmj
```

현재 working tree에서 위 파일의 최신 상태를 기준으로 작업한다.

---

# 2. 절대 변경하지 말 것

다음은 이미 승인된 Source of Truth다.

## Route

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

## Route별 NPC 수

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

## Species / Proxy

```text
Rabbit = 8 → Small 18×12
Cat    = 7 → Medium 22×14
Fox    = 7 → Medium 22×14
Dog    = 7 → Medium 22×14
Tiger  = 6 → Large 26×16
```

## 초기 Area count

```text
Park             = 11
CentralPlaza     = 10
Cafe             = 3
PublicFacility   = 3
MainRoute        = 5
EntryExit        = 3
```

## 시간

```text
Warm-up     = 30 sec
Measurement = 300 sec
Total       = 330 sec
```

## Movement Core

`src/plazaTraffic.ts`의 Fix4 semantics는 변경하지 않는다.

```text
side-step
yield
bounded backoff
narrow reservation
W12 FIFO
W12 owner priority
door semantics
physical collision semantics
```

금지:

```text
Fix5
movement parameter tuning
route 수정
waypoint 수정
TMJ 수정
map geometry 수정
collision 완화
30 NPC fallback
```

---

# 3. 핵심 수정 1 — Area Label이 아니라 실제 좌표로 Spawn 보장

현재 구현은 `ffArea`를 label로만 저장하고
실제 Spawn 좌표가 해당 Area에 속하는지 보장하지 않는다.

이를 수정한다.

## 3.1 승인된 Spawn Mapping

각 초기 Area에 대해 다음 **기존 Route segment**만 사용한다.

```text
Park
- R6 → W03↔W05 또는 W05↔W07
- R5 → W09↔W11
- R1 → W05↔W12 중 Park 영역에 포함되는 부분
- R2 → W05↔W08

CentralPlaza
- R7 → W13↔W14 또는 W14↔W15
- R1 → W12↔W14 중 Central Plaza 영역에 포함되는 부분
- R2 → W12↔W14 중 Central Plaza 영역에 포함되는 부분
- R3 → W12↔W13 중 Central Plaza 영역에 포함되는 부분
- R4 → W12↔W14 중 Central Plaza 영역에 포함되는 부분

Cafe
- R3 → W13↔W16 중 Cafe Zone에 포함되는 부분

PublicFacility
- R4 → W12↔W18 중 Public Facility Zone에 포함되는 부분

MainRoute
- R8 → W21↔W20 또는 W20↔W22

EntryExit
- R1 → W20↔W21 중 West Exit 측
- R2 → W01↔W05 중 North Entry 측
- R2 → W20↔W22 중 East Exit 측
```

중요:

- 새 좌표를 임의 하드코딩하지 않는다.
- 기존 waypoint pair + 승인된 area rectangle intersection을 이용한다.
- 실제 map spec / TMJ의 승인 Area rectangle을 source로 사용한다.
- area rectangle이 TMJ object로 존재하면 그 object를 우선 사용한다.
- 문서에만 있고 TMJ에 없다면 문서의 승인 rectangle을 코드 상수로 명시하되 출처 주석을 남긴다.
- 임의 추정 좌표 금지.

## 3.2 Spawn Search

각 descriptor는 최소 다음 정보를 가져야 한다.

```ts
route
area
segmentStart
segmentEnd
species
size
direction
```

Spawn position은 해당 segment와 area rectangle의 교차 부분 안에서 deterministic search한다.

조건:

```text
inside assigned area
on assigned approved route segment
fixed collision 없음
NPC-NPC overlap 없음
world bounds 내부
approved footprint 사용
```

32px step 또는 더 작은 deterministic step 사용 가능.

안전한 spawn을 찾지 못하면:

```text
throw
```

하고 조용히 다른 area로 옮기지 않는다.

---

# 4. Creator Self-check 강화

`createPlazaFullFlow35()` 직후 반드시 실제 좌표로 다음을 검증한다.

```text
NPC count = 35
route counts 정확
species counts 정확
size counts 정확

actual spatial area counts:
Park = 11
CentralPlaza = 10
Cafe = 3
PublicFacility = 3
MainRoute = 5
EntryExit = 3

각 NPC 좌표가 자신의 ffArea rectangle 안에 실제 포함됨

initial fixed collision = 0
initial NPC overlap = 0
world bounds violation = 0
```

`ffArea` label count만 세고 PASS시키면 안 된다.

Self-check output에도:

```text
declared area count
actual spatial area count
```

를 가능하면 구분해 출력한다.

둘은 반드시 일치해야 한다.

---

# 5. 핵심 수정 2 — blocked_events 실제 측정

현재 `mBlockedEvents`는 reset만 되고 실제로 증가하지 않는다.

measurement phase에서 실제 block episode가 시작될 때 1회 증가시킨다.

정의:

```text
block episode start
= 이전 measurement step에서 blockedBy == ''
  현재 measurement step에서 blockedBy != ''
```

또는 동일 의미의 정확한 state transition.

한 episode에서 frame마다 증가시키지 않는다.

Warm-up 종료 시 이미 blocked 상태라면:

```text
measurement boundary에서 새 episode로 시작하는지
```

를 명시적으로 정의한다.

이번 기준:

> t=30 시점에 이미 blockedBy != ''이면 Measurement에서는 하나의 active block episode가 시작된 것으로 보고 `mBlockedEvents += 1`.

이후 recovery 후 다시 block되면 새 episode로 +1.

---

# 6. 핵심 수정 3 — Narrow metric 의미 수정

현재 Narrow 관련 metric은 실제 reservation queue와 pass completion을 측정하지 않는다.

## 6.1 Max Queue

다음 실제 reservation state를 사용한다.

```ts
run.locks['Upper Narrow Path']?.queue.length
run.locks['Lower Narrow Path']?.queue.length
```

이를 measurement 동안 최대값으로 기록한다.

Zone 내부 actor count를 queue size로 사용하지 않는다.

## 6.2 Pass Count

pass count는 zone **진입**이 아니라
한 actor가 narrow zone에 들어갔다가 반대쪽/밖으로 정상적으로 빠져나온
완료된 traversal을 1회로 센다.

간단한 상태 machine 사용 가능:

```text
OUTSIDE
→ INSIDE
→ OUTSIDE
= 1 pass
```

단순히 같은 쪽으로 살짝 들어왔다가 돌아나오는 경우가 있으면
entry side / exit side를 비교하여 실제 반대측 exit일 때만 pass로 세는 것이 더 정확하다.

현재 Route 구조상 가능한 범위에서 최소 정확 구현을 선택한다.

중요:

- per-frame 중복 금지
- inside transition만으로 pass 증가 금지

---

# 7. 핵심 수정 4 — W12 Measurement Baseline Seed

Warm-up 종료 t=30 직후 measurement를 시작할 때:

```text
_lastW12Owner
_lastW12QueueEmpty
```

를 현재 실제 `run.merge` 상태로 seed한다.

즉 measurement 첫 frame에서
warm-up에서 이어진 owner/queue를 새 owner change나 queue recovery로 오인하지 않는다.

reset 함수 또는 phase transition 직후:

```ts
state._lastW12Owner = state.run.merge?.owner
state._lastW12QueueEmpty = (state.run.merge?.queue.length ?? 0) === 0
```

와 동일 의미로 처리한다.

---

# 8. 핵심 수정 5 — Raw Artifact 항상 최신 결과 저장

현재 script는 기존 파일이 있으면 skip한다.

재실험에서는 잘못된 이전 결과가 남을 수 있으므로 수정한다.

```text
artifacts/plaza_full_flow_35_raw.json
```

은 매 run마다 현재 결과로 덮어쓴다.

가능하면 이전 결과 보존이 필요하면:

```text
artifacts/history/...
```

같은 timestamped backup을 별도로 만들 수 있으나 필수 아님.

핵심은 canonical raw output이 항상 최신 run과 일치하는 것이다.

---

# 9. 핵심 수정 6 — Warm-up Reset Test 강화

현재 Test C는 실제 report보다 약하다.

t=30 reset 직전과 직후에 다음 state를 명시적으로 assert한다.

## 유지되어야 함

```text
x
y
target
direction
pause
inside
doorTarget
forwardWait
yieldTo
yieldBackoff

locks:
- members
- queue
- direction

merge:
- owner
- queue
```

단, boundary remainder step 때문에 x/y 등이 실제로 소폭 이동할 수 있다면
**정확히 t=30.000 boundary 직전/직후 reset 함수 호출 순간을 테스트할 수 있게**
reset helper를 export하거나 테스트 가능한 pure helper로 분리한다.

권장:

```ts
resetFullFlowMeasurement(...)
```

또는 equivalent.

reset 함수 자체만 호출했을 때는 Movement state가 byte-for-byte 동일해야 한다.

## reset되어야 함

```text
mTrips
mArrivals
mBlockedEvents
mLongestWait
mWait
mRecoveries
mEnters
mExits
severeReported
deadlockReported
wait
```

그리고 W12 metric baseline은 현재 state로 seed되어야 한다.

---

# 10. 핵심 수정 7 — Phase Boundary Test 실제 시간 검증

현재 `stepFullFlow(state, ..., 0.1)` 호출도 내부에서 0.05로 cap되므로
329.9초 test가 실제로는 절반 정도밖에 진행되지 않을 수 있다.

테스트를 실제 elapsed 기준으로 작성한다.

예:

```ts
while (state.globalElapsed < 29.99 - EPS) stepFullFlow(..., 0.05)
```

또는 helper:

```ts
advanceTo(state, targetSeconds)
```

를 만들어 실제 `state.globalElapsed`를 확인한다.

반드시 검증:

```text
globalElapsed < 30 → WARMUP
globalElapsed == 30 → MEASUREMENT
globalElapsed < 330 → MEASUREMENT
globalElapsed == 330 → COMPLETE
```

floating-point epsilon 사용.

단순히 `MEASUREMENT or COMPLETE`처럼 느슨하게 PASS시키지 않는다.

---

# 11. Door Metric도 정확성 확인

현재 door metric은 route 기반 heuristic을 사용한다.

```text
R3/path.includes(W16) → Cafe
R4/path.includes(W18) → Facility
```

가능하면 실제 door transition 원인을 기록하는 것이 더 정확하다.

Movement core를 바꾸지 않는 범위에서:

- `doorTarget === W17`이면 Cafe
- `doorTarget === W19`이면 Facility

등 실제 transition 직전 상태를 snapshot하여 측정한다.

Route만 보고 추정하지 않는다.

단, Fix4 semantics는 변경하지 않는다.

---

# 12. First 35 NPC Run 결과 취급

이전 결과:

```text
R1=0
R2=0
R3=0
R4=1
R5=15
R6=0
R7=41
R8=1

deadlock_count=2
unrecovered_20sec=1
max_wait=207.333
```

은 **Harness-invalid exploratory result**로 취급한다.

이를 기준으로 Movement 수정하지 않는다.

이번 correction 후 재실행 결과가 첫 유효 Full Flow 결과다.

---

# 13. Browser Full Flow Mode

기존 `full35` browser mode는 유지한다.

이번 task에서 Browser 5분 실제 측정은 필수 아님.

다만 Harness 수정으로 인해 Browser mode가 깨지지 않도록 compile/runtime path를 유지한다.

Browser FPS는 실제 측정하지 않았다면:

```text
NOT MEASURED
```

로 보고한다.

---

# 14. Test 추가/수정

최소 다음을 검증한다.

## A. Creator spatial area self-check

실제 좌표 기준:

```text
Park 11
CentralPlaza 10
Cafe 3
PublicFacility 3
MainRoute 5
EntryExit 3
```

모두 PASS.

## B. Blocked event episodes

인위적으로 또는 짧은 deterministic scenario로:

```text
unblocked → blocked = +1
blocked 유지 = 증가 없음
recover → blocked = +1
```

검증.

## C. Narrow queue

실제 `run.locks[].queue.length`에서 metric이 오르는지 검증.

## D. Narrow pass

entry만으로 pass count가 증가하지 않고
traversal 완료 후 증가하는지 검증.

## E. W12 baseline

warm-up 종료 시 existing owner/queue가
measurement 첫 frame에서 false owner-change/recovery로 count되지 않는지 검증.

## F. Warm-up state preservation

reset helper 단독 테스트.

## G. Phase boundaries

실제 elapsed로 엄격 검증.

## H. Raw artifact

measurement script 실행 후
파일 내용이 stdout result와 동일한 run 결과인지 확인 가능한 구조로 한다.

---

# 15. 기존 Regression 유지

반드시 유지:

```text
createSmoke(map).npcs.length = 10
default duration = 120
R1~R5 Limited semantics 유지

candidate R6~R8 tests 유지

Fix4 movement tests 유지
```

기존 test expectation을 correction에 맞춘다는 이유로 약화시키지 않는다.

---

# 16. 실행

수정 완료 후 반드시:

```powershell
npm run typecheck
npm test
npm run build
```

그 다음:

```powershell
node --experimental-strip-types scripts/measure-plaza-full-flow-35.mjs
```

를 실제 실행한다.

35 NPC run 결과가 FAIL이어도 수정하지 않는다.

---

# 17. 최종 PASS/FAIL Gate

유효 Harness로 재측정한 결과에서:

## PASS

```text
npc_count = 35

actual spatial area counts 정확

R1~R8 모두 measurement trips > 0

collision_violation_total = 0

deadlock_count = 0
ever_20sec_block_count = 0
unrecovered_20sec = 0

Cafe enter/exit 반복 발생
Facility enter/exit 반복 발생

Narrow queue가 영구 누적되지 않음
W12 queue가 영구 누적되지 않음
```

## WARN

```text
3~10 sec 회복 가능한 block
10~20 sec 회복 가능한 block
transient queue
visual body overlap
```

## FAIL

```text
20 sec+ block episode
deadlock
collision violation
route trips = 0
door repeated transition 불가
queue unrecovered
```

---

# 18. 35 NPC 재실행이 FAIL할 경우

절대 자동으로 하지 말 것:

```text
Fix5
Movement tuning
Route 수정
Spawn distribution 변경
NPC 30으로 감소
Map 수정
Collision 완화
Graphics
CCTV
문서 Source-of-Truth 갱신
```

그대로 결과 보고 후 멈춘다.

---

# 19. 변경 허용 범위

가능한 변경 파일:

```text
src/plazaFullFlow.ts
tests/fullFlowHarness.test.ts
scripts/measure-plaza-full-flow-35.mjs
```

필요한 경우에만:

```text
src/PlazaParkScene.ts
```

`src/plazaTraffic.ts`는 Fix4 Movement를 건드리지 않는 범위의
type/import compatibility 수정만 허용한다.

가능하면 수정하지 않는다.

---

# 20. 최종 보고 형식

## 1. 변경 파일

## 2. Harness correctness 수정 요약

다음 각각을 명시:

```text
actual area spawn
blocked_events
narrow queue
narrow pass
W12 baseline
door metrics
raw output overwrite
warm-up reset test
phase boundary test
```

## 3. 기존 Regression

```text
createSmoke NPC count
default duration
existing tests
```

## 4. Creator Self-check

반드시 **actual spatial** area count 포함:

```text
NPC
Route
Species
Size
Area
Collision
```

## 5. Tests

기존/신규 분리.

## 6. typecheck

## 7. build

## 8. Corrected 35 NPC Run

전체 핵심 JSON:

```text
R1~R8 trips
R1~R8 arrivals
R1~R8 max_wait
R1~R8 blocked_events

blocked_time_total
blocked_npc_count_peak
max_continuous_blocked_time

severe_block_count
deadlock_count
ever_20sec_block_count
unrecovered_20sec
recoveries

collision violations

Cafe enter/exit
Facility enter/exit

Upper Narrow pass/max queue
Lower Narrow pass/max queue

W12 max queue
W12 owner changes
W12 queue recoveries
```

## 9. 이전 run과 비교

이전 Harness-invalid run의 숫자를 새 결과와 단순 성능 비교하지 않는다.

대신:

```text
old run = invalid due to harness correctness issues
new run = first valid 35 NPC Full Flow measurement
```

라고 명시한다.

## 10. Browser

```text
full35 mode compile/runtime 유지 여부
5min FPS 실제 측정 여부
```

미측정이면 `NOT MEASURED`.

## 11. 최종 Logic 판정

```text
PASS
PASS with WARN
FAIL
```

숫자로 근거 제시.

## 12. 중단

보고 후 멈춘다.
다음 단계로 자동 진행하지 않는다.
