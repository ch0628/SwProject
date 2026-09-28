# Antigravity Task ??R6/R7/R8 Dynamic Route Validation Only

## 목표

Plaza/Park 35 NPC Full Flow???�어가�??�에 ?�규 Candidate Route 3개의 ?�적 ?�동 ?�전?�을 검증한??

```text
R6 = W03 ??W05 ??W07
R7 = W13 ??W14 ??W15
R8 = W21 ??W20 ??W22
```

????Route??과거 ?�인 Route가 ?�니??
?�번 ?�업?�서 PASS?�면 그때 Full Flow Route�??�격?�다.

?�번 ?�업?� **35 NPC Full Flow 구현 ?�업???�니??**
Route ?�보 검증까지�??�행?�고 멈춘??

---

## 반드??먼�? ?�기

```text
ai/RULES.md
ai/WORKFLOW.md
ai/CONTEXT_MAP.md
docs/archive/session_handoff_plaza_park_2026-09-14.md
docs/reference/plaza_park_full_flow_validation_spec.md
docs/shared/maps/map_plaza_park_spec.md
src/plazaTraffic.ts
src/PlazaParkScene.ts
tests/plazaTraffic.test.ts
public/maps/plaza-park.tmj
```

?�재 `src/plazaTraffic.ts`???�용?��? ?�용?�고 검증한 **Fix4**가 기�??�다.

기존 Fix4 semantics�??�시 ?�계?�거??변경하지 마라.

---

## ?�재 ?�정 ?�실

기존 Route:

```text
R1 = W01 ??W05 ??W12 ??W14 ??W20 ??W21
R2 = W01 ??W05 ??W08 ??W05 ??W12 ??W14 ??W20 ??W22
R3 = W05 ??W12 ??W13 ??W16 ??W20
R4 = W05 ??W12 ??W18 ??W12 ??W14
R5 = W09 ??W11 ??W12 ??W14
```

기존 Limited Fix4:

```text
10 NPC / 120 sec
R1~R5 모두 completion
collisionViolation = 0
unrecovered_20sec = 0
PASS with WARN
```

Candidate Route??TMJ Fixed Collision Segment 검?�는 ?��? ?�행?�다.

```text
W03-W05 PASS
W05-W07 PASS
W13-W14 PASS
W14-W15 PASS
W21-W20 PASS
W20-W22 PASS
```

Physical Size Class:

```text
Small  = 18×12
Medium = 22×14
Large  = 26×16
```

---

## 구현 ?�칙

### 1. 기존 R1~R5 기본 Smoke�??��? 바꾸지 �?�?
?�재:

```text
createSmoke(map)
??R1~R5
???�방??�?1�???�?10 NPC
```

???�작?� 그�?�??��??�야 ?�다.

기존 `npm test`??10 NPC regression ?��?�?바꾸지 마라.

### 2. Candidate Route??별도 registry�?추�?

권장 구조:

```ts
SMOKE_ROUTES
// R1~R5�??��?

FULL_FLOW_ROUTE_CANDIDATES
// R6~R8

TRAFFIC_ROUTE_PATHS
// R1~R8 lookup??결합 registry
```

?�확???�름?� ?�로?�트 ?��??�에 맞게 최소 변�?가?�하??

중요:
- `SMOKE_ROUTES`�?R1~R8�??�순 ?�장?�여 `createSmoke(map)`가 16명을 만들�??��? 마라.
- 기존 10 NPC ?�스?��? ?�동?�로 16 NPC ?�스?�로 바뀌면 FAIL?�다.
- ???�역 Pathfinding 금�?.
- ??Waypoint 금�?.

### 3. stepSmoke가 Candidate Route???�일??Fix4 Movement�?처리?�게 ??�?
Candidate�??�한 별도 Movement ?�고리즘??만들지 ?�는??

Route path lookup�?R1~R8??지?�하?�록 최소 ?�반?�한??

Fix4???�음 ?��????��?:

```text
Route Segment 기�? side-step
?�쪽 deterministic side-step
Yield bounded backoff
Narrow axis-aware reservation
W12 FIFO
W12 owner priority > local Yield
Physical swept-footprint collision
```

### 4. PlazaParkScene 변경�? ?�요??TypeScript lookup ?�환�?
UI??R6~R8 메뉴�?추�??��? ?�아???�다.

?�번 ?�업?� automated Dynamic Validation??목적?�다.

Scene 변경이 ?�요?�다�?`SMOKE_ROUTES[n.route]`처럼 Candidate type ?�문??compile??깨�???lookup�?공용 route lookup helper�?교체?�다.

UI/그래???�이?�웃??바꾸지 마라.

---

## 추�????�스??
???�스???�일??만들거나 기존 `tests/plazaTraffic.test.ts`??최소 추�??�다.

### A. Candidate single-route baseline

R6, R7, R8 각각???�??

```text
Small
Medium
Large
```

�?Physical Size�??�일 NPC�??�행?�다.

조건:

```text
120 sec ?�내
route trip >= 1
fixed collision violation = 0
world bounds violation = 0
```

?�제�?측정??결과�?console JSON?�로 출력?�다.

??

```json
{"candidate":"R6","mode":"single","size":"Large","trips":2,"maxWait":0}
```

?�치�?미리 ?�드코딩?��? 마라.

### B. Candidate bidirectional pair

R6/R7/R8 각각???�???�방??2 NPC�?120�??�행?�다.

최소 ??번�? `Large + Large`�?검증하??가????approved Physical class??교행???�인?�다.

조건:

```text
�?방향 actor가 route completion >= 1
NPC-NPC physical overlap = 0
fixed collision violation = 0
unrecovered 20 sec = 0
```

측정 �?�?frame swept/actual physical safety�??�인?�다.

console JSON ??

```json
{
  "candidate":"R6",
  "mode":"bidirectional",
  "trips":[...],
  "maxWait":...,
  "unrecovered20":...,
  "collisionViolation":0
}
```

결과값�? ?�제 ?�행값만 출력?�다.

---

## 기존 Regression

반드??기존 ?�스?��? 그�?�??��??�다.

?�히 ?�음 기존 ?��?가 깨�?�????�다.

```text
createSmoke(map).npcs.length = 10
R1~R5 single baseline
10 mixed NPC 120 sec physical safety
Door/Fence semantics
player block/resume
Corridor / Scale / Graybox tests
```

Candidate 검증을 ?�과?�키�??�해 Fix4 Movement Parameter�?조정?��? 마라.

Candidate가 FAIL?�면 **FAIL??그�?�?보고**?�고,
Route�??��?�??�과?�키????avoidance�?구현?��? 마라.

---

## 금�?

- Map ?�정
- TMJ ?�정
- W01~W22 ?�정
- Door Opening ?�정
- Path Width ?�정
- Collision ?�화
- Fix5 traffic tuning
- ?�로??crowd solver
- Global Pathfinding
- Personal Spacing
- 35 NPC Harness 구현
- Full Flow 5�??�행
- Graphics ?�업
- R6~R8???�스???�에 Final Route�?문서??
---

## ?�행

?�정 ??반드??

```powershell
npm run typecheck
npm test
npm run build
```

?�행?�다.

---

## 최종 보고 ?�식

1. 변�??�일
2. 기존 Fix4 Movement semantics 변�??��?
3. `createSmoke(map)` NPC ??4. R6 single Small/Medium/Large 결과
5. R7 single Small/Medium/Large 결과
6. R8 single Small/Medium/Large 결과
7. R6 bidirectional 결과
8. R7 bidirectional 결과
9. R8 bidirectional 결과
10. collision violation
11. 20 sec+ unrecovered block
12. 기존 tests 결과
13. typecheck
14. build
15. �?Candidate�?PASS / WARN / FAIL

### ?�정

Candidate PASS:

```text
single Small/Medium/Large 모두 trip >= 1
bidirectional ??actor 모두 completion >= 1
collision violation = 0
unrecovered_20sec = 0
```

10~20�?미만???�복 가?�한 ?�기는 WARN?�로 기록?�다.

Candidate FAIL?�면 ?�유�?기록?�고 멈춘??
??Route????Traffic Fix�??�동?�로 만들지 ?�는??

?�업 ?�료 ??35 NPC Full Flow�??�어가지 말고 ?�용?�에�?결과�?보고?�고 ?�기한??
