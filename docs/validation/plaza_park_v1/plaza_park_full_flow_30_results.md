# Plaza & Park 30 NPC Full Flow Fallback Results

## 1. 판정

```text
30 NPC Full Flow Fallback = FAIL
```

이 Run은 35 NPC Harness를 그대로 재사용하고,
승인된 5개 actor만 제거한 deterministic subset으로 수행했다.

제거 ID:

```text
[2, 10, 16, 24, 28]
```

나머지 actor의:

```text
ID
x / y
route
species
size
ffArea
spawnRegion
segmentStart / segmentEnd
target
direction
```

은 35 NPC creator와 동일하게 유지했다.

---

## 2. 30 NPC 구성

### Route

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

### Species

```text
Rabbit = 7
Cat = 6
Fox = 6
Dog = 6
Tiger = 5
```

### Collision Proxy

```text
Small = 7
Medium = 18
Large = 5
```

### Area

```text
Park = 9
CentralPlaza = 9
Cafe = 2
PublicFacility = 3
MainRoute = 4
EntryExit = 3
```

---

## 3. Regression / Harness 검증

```text
typecheck = PASS
tests = 35 / 35 PASS
build = PASS
```

기존 35 NPC creator / tests / raw result / Fix4 관련 파일은 유지됐다.

30 NPC는 별도 re-spawn 없이
35 NPC initial state의 subset으로 생성됐다.

---

## 4. 30 NPC Run

```text
Warm-up = 30 sec
Measurement = 300 sec
Total = 330 sec
Phase = COMPLETE
```

### Route 결과

| Route | Trips | Arrivals | Max Wait |
|---|---:|---:|---:|
| R1 | 2 | 8 | 300.000 sec |
| R2 | 1 | 6 | 286.800 sec |
| R3 | 1 | 3 | 300.000 sec |
| R4 | 0 | 1 | 10.017 sec |
| R5 | 0 | 1 | 298.483 sec |
| R6 | 39 | 76 | 0.333 sec |
| R7 | 3 | 6 | 273.067 sec |
| R8 | 15 | 31 | 0.333 sec |

---

## 5. Blocking / Recovery

```text
deadlock_count = 5
ever_20sec_block_count = 5
unrecovered_20sec = 5

max_continuous_blocked_time = 300 sec
```

Hard Gate:

```text
deadlock_count must be 0         → FAIL
ever_20sec_block_count must be 0 → FAIL
unrecovered_20sec must be 0      → FAIL
```

---

## 6. Physical Safety

```text
collision_violation_total = 0
```

따라서 30 NPC FAIL 역시
Physical Collision 위반 때문이 아니다.

---

## 7. Door Transition

```text
Cafe enter / exit = 1 / 1
Facility enter / exit = 0 / 0
```

반복 Transition Gate를 만족하지 못했다.

---

## 8. Narrow / W12

### Upper Narrow

```text
max queue = 0
end queue = 0
pass = 2
```

### Lower Narrow

```text
max queue = 0
end queue = 0
pass = 5
```

### W12

```text
max queue = 5
end queue = 4
queue max wait = 300 sec
queue recovery = 0
```

W12 queue는 measurement 종료까지 회복되지 않았다.

---

## 9. 최종 결론

```text
30 NPC Full Flow Fallback = FAIL
```

대표 근거:

```text
R4 trips = 0
R5 trips = 0

deadlock = 5
ever 20sec+ = 5
unrecovered 20sec+ = 5

max block = 300 sec

W12 end queue = 4
W12 max wait = 300 sec
W12 recovery = 0

Cafe = 1/1
Facility = 0/0

collision violation = 0
```

35 NPC뿐 아니라 30 NPC에서도 동일한 종류의 장기 Blocking과
W12 미회복이 지속됐으므로,
현재 Prototype에서는 추가 Density Search를 진행하지 않는다.

---

## 10. Prototype Operating Density 결정

기존 검증 결과:

```text
10 active movers / 120 sec
→ PASS with WARN

30 active movers / 300 sec
→ FAIL

35 active movers / 300 sec
→ FAIL
```

따라서 현재 Prototype Operating Density는:

```text
10 active movers
```

로 고정한다.

이 값은:

```text
동시에 collision-aware movement를 수행하는 NPC 수
```

를 의미한다.

화면에 보이는 전체 Character 수를 10명으로 제한한다는 의미는 아니다.
추후 Graphics 단계에서 필요하면 교통 시스템에 참여하지 않는
정적 / 장식 NPC는 별도 검토할 수 있다.

---

## 11. Hard Stop

현재 Prototype에서는 다음을 진행하지 않는다.

```text
Fix5
25 NPC / 20 NPC / 15 NPC 추가 Density Search
다른 30 NPC 제거 조합 재시도
Route 수정
Map Geometry 수정
Collision 완화
W12 구조 재설계
```

현재 단계의 목적은 교통 시뮬레이터 최적화가 아니라
SWfestival 지도학습 Gameplay의 완성이다.

다음 단계:

```text
Plaza/Park Environment Graphics Integration
```
