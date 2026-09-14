# Antigravity Task — R6/R7/R8 Dynamic Route Validation Only

## 목표

Plaza/Park 35 NPC Full Flow에 들어가기 전에 신규 Candidate Route 3개의 동적 이동 안전성을 검증한다.

```text
R6 = W03 → W05 → W07
R7 = W13 → W14 → W15
R8 = W21 → W20 → W22
```

이 세 Route는 과거 승인 Route가 아니다.
이번 작업에서 PASS하면 그때 Full Flow Route로 승격한다.

이번 작업은 **35 NPC Full Flow 구현 작업이 아니다.**
Route 후보 검증까지만 수행하고 멈춘다.

---

## 반드시 먼저 읽기

```text
ai/RULES.md
ai/WORKFLOW.md
ai/CONTEXT_MAP.md
docs/session_handoff_current.md
docs/reference/plaza_park_full_flow_validation_spec.md
docs/map_plaza_park_spec.md
src/plazaTraffic.ts
src/PlazaParkScene.ts
tests/plazaTraffic.test.ts
public/maps/plaza-park.tmj
```

현재 `src/plazaTraffic.ts`는 사용자가 적용하고 검증한 **Fix4**가 기준이다.

기존 Fix4 semantics를 다시 설계하거나 변경하지 마라.

---

## 현재 확정 사실

기존 Route:

```text
R1 = W01 → W05 → W12 → W14 → W20 → W21
R2 = W01 → W05 → W08 → W05 → W12 → W14 → W20 → W22
R3 = W05 → W12 → W13 → W16 → W20
R4 = W05 → W12 → W18 → W12 → W14
R5 = W09 → W11 → W12 → W14
```

기존 Limited Fix4:

```text
10 NPC / 120 sec
R1~R5 모두 completion
collisionViolation = 0
unrecovered_20sec = 0
PASS with WARN
```

Candidate Route의 TMJ Fixed Collision Segment 검사는 이미 수행했다.

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

## 구현 원칙

### 1. 기존 R1~R5 기본 Smoke를 절대 바꾸지 말 것

현재:

```text
createSmoke(map)
→ R1~R5
→ 양방향 각 1명
→ 총 10 NPC
```

이 동작은 그대로 유지해야 한다.

기존 `npm test`의 10 NPC regression 의미를 바꾸지 마라.

### 2. Candidate Route는 별도 registry로 추가

권장 구조:

```ts
SMOKE_ROUTES
// R1~R5만 유지

FULL_FLOW_ROUTE_CANDIDATES
// R6~R8

TRAFFIC_ROUTE_PATHS
// R1~R8 lookup용 결합 registry
```

정확한 이름은 프로젝트 스타일에 맞게 최소 변경 가능하다.

중요:
- `SMOKE_ROUTES`를 R1~R8로 단순 확장하여 `createSmoke(map)`가 16명을 만들게 하지 마라.
- 기존 10 NPC 테스트가 자동으로 16 NPC 테스트로 바뀌면 FAIL이다.
- 새 전역 Pathfinding 금지.
- 새 Waypoint 금지.

### 3. stepSmoke가 Candidate Route도 동일한 Fix4 Movement로 처리하게 할 것

Candidate를 위한 별도 Movement 알고리즘을 만들지 않는다.

Route path lookup만 R1~R8을 지원하도록 최소 일반화한다.

Fix4의 다음 의미는 유지:

```text
Route Segment 기준 side-step
양쪽 deterministic side-step
Yield bounded backoff
Narrow axis-aware reservation
W12 FIFO
W12 owner priority > local Yield
Physical swept-footprint collision
```

### 4. PlazaParkScene 변경은 필요한 TypeScript lookup 호환만

UI에 R6~R8 메뉴를 추가하지 않아도 된다.

이번 작업은 automated Dynamic Validation이 목적이다.

Scene 변경이 필요하다면
`SMOKE_ROUTES[n.route]`처럼 Candidate type 때문에 compile이 깨지는 lookup만
공용 route lookup helper로 교체한다.

UI/그래픽/레이아웃을 바꾸지 마라.

---

## 추가할 테스트

새 테스트 파일을 만들거나 기존 `tests/plazaTraffic.test.ts`에 최소 추가한다.

### A. Candidate single-route baseline

R6, R7, R8 각각에 대해:

```text
Small
Medium
Large
```

각 Physical Size로 단일 NPC를 실행한다.

조건:

```text
120 sec 이내
route trip >= 1
fixed collision violation = 0
world bounds violation = 0
```

실제로 측정한 결과를 console JSON으로 출력한다.

예:

```json
{"candidate":"R6","mode":"single","size":"Large","trips":2,"maxWait":0}
```

수치를 미리 하드코딩하지 마라.

### B. Candidate bidirectional pair

R6/R7/R8 각각에 대해 양방향 2 NPC를 120초 실행한다.

최소 한 번은 `Large + Large`로 검증하여 가장 큰 approved Physical class의 교행을 확인한다.

조건:

```text
각 방향 actor가 route completion >= 1
NPC-NPC physical overlap = 0
fixed collision violation = 0
unrecovered 20 sec = 0
```

측정 중 매 frame swept/actual physical safety를 확인한다.

console JSON 예:

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

결과값은 실제 실행값만 출력한다.

---

## 기존 Regression

반드시 기존 테스트를 그대로 유지한다.

특히 다음 기존 의미가 깨지면 안 된다.

```text
createSmoke(map).npcs.length = 10
R1~R5 single baseline
10 mixed NPC 120 sec physical safety
Door/Fence semantics
player block/resume
Corridor / Scale / Graybox tests
```

Candidate 검증을 통과시키기 위해 Fix4 Movement Parameter를 조정하지 마라.

Candidate가 FAIL하면 **FAIL을 그대로 보고**하고,
Route를 억지로 통과시키는 새 avoidance를 구현하지 마라.

---

## 금지

- Map 수정
- TMJ 수정
- W01~W22 수정
- Door Opening 수정
- Path Width 수정
- Collision 완화
- Fix5 traffic tuning
- 새로운 crowd solver
- Global Pathfinding
- Personal Spacing
- 35 NPC Harness 구현
- Full Flow 5분 실행
- Graphics 작업
- R6~R8을 테스트 전에 Final Route로 문서화

---

## 실행

수정 후 반드시:

```powershell
npm run typecheck
npm test
npm run build
```

실행한다.

---

## 최종 보고 형식

1. 변경 파일
2. 기존 Fix4 Movement semantics 변경 여부
3. `createSmoke(map)` NPC 수
4. R6 single Small/Medium/Large 결과
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
15. 각 Candidate별 PASS / WARN / FAIL

### 판정

Candidate PASS:

```text
single Small/Medium/Large 모두 trip >= 1
bidirectional 두 actor 모두 completion >= 1
collision violation = 0
unrecovered_20sec = 0
```

10~20초 미만의 회복 가능한 대기는 WARN으로 기록한다.

Candidate FAIL이면 이유만 기록하고 멈춘다.
새 Route나 새 Traffic Fix를 자동으로 만들지 않는다.

작업 완료 후 35 NPC Full Flow로 넘어가지 말고 사용자에게 결과를 보고하고 대기한다.
