# Plaza & Park Deadlock Fix4 Results — Limited NPC Flow PASS with WARN

## 1. 목적

기존 Plaza/Park Limited NPC Flow의 구조적 교착을,
Map Geometry / Waypoint / Door Width / Collision 완화 없이
`src/plazaTraffic.ts`의 Traffic Policy만 수정하여 해소할 수 있는지 검증한다.

기존 역사 문서는 덮어쓰지 않는다.

- `docs/validation/plaza_park_v1/plaza_park_large_clearance_limited_npc_results.md`
- `docs/validation/plaza_park_v1/plaza_park_limited_validation_v2_results.md`

이 문서는 이후 Fix1~Fix4를 거쳐 얻은 **최종 Prototype Gate 결과**를 기록한다.

---

## 2. 변경 범위

최종 기준 Movement 구현:

```text
src/plazaTraffic.ts = Fix4
```

Map / Waypoint / Door Opening / Path Width / CCTV / Character Asset은 변경하지 않았다.

주요 수정 흐름:

```text
Fix1
- side-step 방향을 순간 dx/dy가 아니라 Route Segment 기준으로 계산하도록 수정

Fix2
- Yield를 매 frame 다시 계산
- Yield 중 NPC도 lane을 비우기 위한 side-step 가능

Fix3
- Narrow Path reservation을 해당 Narrow의 긴 축을 따라 이동하는 traffic에만 적용
- Narrow 영역을 단순 교차하는 connector traffic은 directional lock 대상에서 제외
- 오른쪽 side-step 실패 시 반대쪽도 deterministic하게 시도
- Yield 중 양쪽 side-step 실패 시 bounded backoff 허용

Fix4
- W12 merge owner의 우선권을 local Yield보다 높게 적용
- W12 owner가 queue의 다른 NPC에게 Yield하여 priority inversion이 생기지 않도록 수정
```

---

## 3. 최종 검증 조건

```text
NPC = 10
Policy = fallback
Measurement = 120 sec
Routes = R1~R5
Waypoint = 기존 W01~W22
Map Geometry = 동일
Collision = 기존 Physical Collision 유지
```

판정 핵심 Gate:

```text
R1~R5 각각 completion > 0
collisionViolation = 0
unrecovered_20sec = 0
```

10~20초 사이의 회복 가능한 장시간 Block은 WARN으로 기록한다.

---

## 4. [Observed Fact] 자동 검증

### 전체 Metric

| Metric | 결과 |
|---|---:|
| seconds | 120 |
| active_npc | 10 |
| completed_routes | 11 |
| waypoint_arrivals | 71 |
| blocked_npc_count | 1 |
| max_continuous_blocked_time | 14.8167 sec |
| severe_block_count | 1 |
| unrecovered_20sec | 0 |
| recoveries | 15 |
| collisionViolation | 0 |

### Route별

| Route | trips | arrivals | maxBlock |
|---|---:|---:|---:|
| R1 | 2 | 14 | 11.7167 sec |
| R2 | 2 | 20 | 4.9833 sec |
| R3 | 3 | 15 | 9.7333 sec |
| R4 | 1 | 9 | 14.8167 sec |
| R5 | 3 | 13 | 4.8000 sec |

모든 R1~R5에서 최소 1회 이상의 completion이 발생했다.

---

## 5. [Observed Fact] 종료 시점 상태

120초 종료 시점:

```text
unrecovered_20sec = 0
collisionViolation = 0
merge.queue = []
```

종료 시점에 1 NPC가 Block 상태였다.

```text
NPC #8
Route = R4
wait = 14.8167 sec
blockedBy = "L5"
```

`L5`의 정확한 의미나 원인은 이번 결과만으로 추가 해석하지 않는다.
20초 이상 미회복 Block에는 해당하지 않는다.

Upper Narrow 종료 상태:

```text
members = []
queue = []
```

Lower Narrow 종료 상태:

```text
members = [9, 10]
queue = []
direction = -1
```

이는 측정 종료 순간의 상태이며, 그 자체를 교착으로 해석하지 않는다.

---

## 6. [Observed Fact] 회귀 검사

Fix4 적용 후 확인된 항목:

```text
npm run typecheck = PASS
npm test = PASS
tests = 19 / 19
```

Mixed 10 NPC 테스트에서도 R1~R5 모두 completion이 발생했다.

Fix4 적용 후 `npm run build` 결과는 이 문서 작성 시점의 제공 로그에 포함되지 않았으므로
별도 PASS로 주장하지 않는다.
Full Flow 시작 전 한 번 확인한다.

기존 Bundle Size Warning은 기존 WARN으로 유지한다.

---

## 7. [Interpretation]

초기 실패는 Map Geometry 자체의 실패라기보다
NPC local avoidance / reservation / merge priority가 결합하면서 발생한 liveness 문제였다.

Fix1~Fix4를 통해 다음 문제가 순차적으로 제거되었다.

```text
- Route Segment와 무관하게 흔들리던 side-step 방향
- Yield 중 NPC가 lane을 비우지 못하는 상태
- Narrow 영역을 단순 교차하는 traffic까지 directional reservation에 포함되던 문제
- crowded merge에서 한쪽 side-step만 시도하던 제한
- W12 owner가 queue의 waiter에게 Yield하는 priority inversion
```

최종 측정에서는 모든 Route가 완주했고,
20초 이상 미회복 교착과 물리 관통이 관측되지 않았다.

---

## 8. 최종 판정

```text
Plaza/Park Limited NPC Flow
= PASS with WARN
```

PASS 근거:

```text
R1~R5 completion > 0
completed_routes = 11
collisionViolation = 0
unrecovered_20sec = 0
```

WARN:

```text
max continuous block = 14.8167 sec
일부 10~15초 수준의 회복 가능한 대기 존재
Physical Footprint 충돌과 별개로 Visual Body Overlap 가능성 남음
본격 Personal Spacing 미구현
```

이 WARN을 이유로 Fix5 이상의 Movement 튜닝을 계속하지 않는다.

---

## 9. 다음 단계

```text
35 NPC Full Flow
Warm-up = 30 sec
Measurement = 5 min
```

35 NPC가 PASS하면 Flow Validation을 종료하고 Graphics Integration으로 이동한다.

35 NPC가 FAIL하면:

```text
30 NPC
Warm-up = 30 sec
Measurement = 5 min
```

을 한 번만 수행한다.

30 NPC가 PASS하면 Prototype Operating Density를 30 NPC로 확정하고
35 NPC는 unsupported/WARN으로 기록한다.

추가적인 Limited v3/v4 또는 Movement 알고리즘 반복 튜닝은 진행하지 않는다.
