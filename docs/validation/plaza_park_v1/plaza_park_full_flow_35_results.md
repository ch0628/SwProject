# Plaza & Park 35 NPC Full Flow Validation Results — First Valid Run

## 1. 판정

```text
35 NPC Full Flow = FAIL
```

이번 Run은 Harness correctness 수정 후 수행한 **첫 유효 35 NPC Full Flow 측정**이다.

이전 35 NPC Run은 Spawn/Metric Harness 문제 때문에 탐색용 결과로만 남기며,
성능 수치를 이번 Run과 직접 비교하지 않는다.

---

## 2. Harness 유효성

Creator Self-check:

```text
NPC = 35

Route:
R1=4
R2=5
R3=4
R4=4
R5=2
R6=5
R7=6
R8=5

Species:
Rabbit=8
Cat=7
Fox=7
Dog=7
Tiger=6

Size:
Small=8
Medium=21
Large=6

Declared Area:
Park=11
CentralPlaza=10
Cafe=3
PublicFacility=3
MainRoute=5
EntryExit=3

Actual Spatial Area:
Park=11
CentralPlaza=10
Cafe=3
PublicFacility=3
MainRoute=5
EntryExit=3

Initial fixed collision = 0
Initial NPC overlap = 0
World bounds violation = 0
```

North Entry용 EntryExit NPC는 승인된:

```text
R2 / W01↔W05 / North Entry Connector
```

를 사용한다.

---

## 3. Harness correctness 확인

이번 측정 전에 다음을 수정/검증했다.

```text
actual area spawn
blocked episode count
narrow reservation queue
narrow traversal completion
W12 measurement baseline
actual door transition attribution
raw output overwrite
warm-up reset preservation
30/330 sec phase boundary
```

검증 결과:

```text
npm test = 33/33 PASS
npm run typecheck = PASS
npm run build = PASS
```

기존 Bundle Size Warning은 기존 WARN으로 유지한다.

Fix4 Movement / Collision / Map 관련 코드는 이번 correction 과정에서 변경하지 않았다.

---

## 4. Run 조건

```text
Warm-up = 30 sec
Measurement = 300 sec
Total = 330 sec

Simulation step = 1/60 sec
Browser FPS = NOT MEASURED
```

Collision Proxy:

```text
Rabbit → Small 18×12
Cat    → Medium 22×14
Fox    → Medium 22×14
Dog    → Medium 22×14
Tiger  → Large 26×16
```

---

## 5. Route 결과

| Route | Trips | Arrivals | Max Wait | Blocked Events |
|---|---:|---:|---:|---:|
| R1 | 2 | 7 | 300.000 sec | 899 |
| R2 | 1 | 6 | 1.950 sec | 890 |
| R3 | 2 | 4 | 300.000 sec | 54 |
| R4 | 0 | 1 | 6.967 sec | 9 |
| R5 | 0 | 1 | 298.483 sec | 2 |
| R6 | 25 | 46 | 0.333 sec | 1457 |
| R7 | 3 | 6 | 274.417 sec | 1048 |
| R8 | 25 | 46 | 0.333 sec | 227 |

중요:

- `blocked_events`는 `unblocked → blocked` measurement episode 시작 횟수다.
- 0.5초 미만 micro-block도 episode 수에는 포함될 수 있다.
- 따라서 `blocked_events` 자체를 Deadlock 수로 해석하지 않는다.
- Hard FAIL 판단은 지속 시간 / deadlock / unrecovered queue를 기준으로 한다.

---

## 6. Blocking / Recovery

```text
blocked_time_total = 3049.683 actor-sec
blocked_npc_count_peak = 8
blocked_npc_count_end = 7

max_continuous_blocked_time = 300.000 sec

severe_block_count = 7
deadlock_count = 7
ever_20sec_block_count = 7
unrecovered_20sec = 7

recoveries = 4
```

Hard Gate:

```text
deadlock_count must be 0        → FAIL
ever_20sec_block_count must be 0 → FAIL
unrecovered_20sec must be 0      → FAIL
```

---

## 7. W12 / Narrow

### W12

```text
w12_max_queue = 4
w12_owner_change_count = 2
w12_queue_recovery_count = 0

measurement end queue = 4
queue max wait = 300 sec
queue unrecovered_20sec = 4
```

판정:

```text
W12 Queue Recovery = FAIL
```

### Narrow

```text
Upper Narrow:
pass = 2
max queue = 0
end queue = 0
unrecovered_20sec = 0

Lower Narrow:
pass = 4
max queue = 0
end queue = 0
unrecovered_20sec = 0
```

Narrow reservation 자체에서는 장기 Queue 누적이 관찰되지 않았다.

---

## 8. Door Transition

```text
Cafe enter / exit = 1 / 1
Facility enter / exit = 0 / 0
```

Full Flow Gate의 반복 Transition 조건을 만족하지 못했다.

```text
Cafe repeated transition = FAIL
Facility repeated transition = FAIL
```

---

## 9. Physical Safety

```text
fixed_collision_violation = 0
npc_collision_violation = 0
world_bounds_violation = 0

collision_violation_total = 0
```

따라서 이번 FAIL은 Physical Collision 위반 때문이 아니다.

---

## 10. PASS Gate 결과

```text
npc_count                         PASS
actual_spatial_area_counts        PASS
measurement_complete              PASS

cafe_repeated_transitions         FAIL
facility_repeated_transitions     FAIL
queues_recovered                  FAIL
all_routes_have_trips             FAIL
collision_violation_total_zero    PASS
deadlock_count_zero               FAIL
ever_20sec_block_count_zero       FAIL
unrecovered_20sec_zero            FAIL
```

---

## 11. 최종 결론

```text
35 NPC Full Flow = FAIL
```

대표 근거:

```text
R4 trips = 0
R5 trips = 0

max block = 300 sec

deadlock = 7
ever 20sec+ = 7
unrecovered 20sec+ = 7

W12 end queue = 4
W12 max queue wait = 300 sec
W12 queue recovery = 0

Cafe = 1/1
Facility = 0/0

collision violation = 0
```

현재 결과만으로 Map / Route / Collision / Fix4를 즉시 수정하지 않는다.

기존 Hard Stop 정책에 따라 다음 단계는:

```text
30 NPC Full Flow / Warm-up30s / Measurement300s
```

1회다.

단, **30 NPC의 Route / Species / Area 배치는 아직 확정하지 않았다.**
임의로 줄이지 않고 별도 설계 → 사용자 승인 → 구현 순서로 진행한다.

---

## 12. Browser

```text
Browser full35 path = 구현 유지
5 min Browser FPS = NOT MEASURED
```

35 NPC Logic이 Hard FAIL했으므로,
이 시점에서 35 NPC Browser 5분 FPS 측정을 Critical Path로 강제하지 않는다.

---

## 13. Source

Canonical raw result:

```text
artifacts/plaza_full_flow_35_raw.json
```

Harness:

```text
src/plazaFullFlow.ts
tests/fullFlowHarness.test.ts
scripts/measure-plaza-full-flow-35.mjs
```
