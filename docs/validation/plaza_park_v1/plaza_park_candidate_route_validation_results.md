# Plaza & Park R6~R8 Dynamic Route Validation Results

## 1. 목적

35 NPC Full Flow에서 기존 R1~R5에만 NPC를 집중시키지 않고
Park / Plaza / Main Route에 Local Traffic을 분산하기 위해
신규 Route R6~R8 후보의 동적 이동 안전성을 검증했다.

검증 대상:

```text
R6 = W03 → W05 → W07
R7 = W13 → W14 → W15
R8 = W21 → W20 → W22
```

이 Route들은 과거 승인 Route가 아니며,
이번 검증을 통과한 뒤 Full Flow Route Set에 정식 승격한다.

---

## 2. 변경 파일

```text
src/plazaTraffic.ts
src/PlazaParkScene.ts
tests/candidateRoutes.test.ts
```

### src/plazaTraffic.ts

추가:

```text
FULL_FLOW_ROUTE_CANDIDATES
TRAFFIC_ROUTE_PATHS
CandidateRouteId
AllRouteId
```

기존:

```text
SMOKE_ROUTES = R1~R5
createSmoke(map) = 10 NPC
```

는 유지했다.

`stepSmoke()`의 Movement Algorithm은 변경하지 않고,
Route path lookup만 `TRAFFIC_ROUTE_PATHS`로 일반화했다.

### src/PlazaParkScene.ts

Candidate Route type / path lookup에 필요한 컴파일 호환만 수정했다.

### tests/candidateRoutes.test.ts

신규:

```text
A. Candidate single-route baseline
B. Candidate bidirectional pair
```

---

## 3. Fix4 Regression 보존

확인된 사항:

```text
기존 Fix4 Movement semantics 변경 없음
createSmoke(map) NPC 수 = 10 유지
기존 regression tests = 19/19 PASS
typecheck = PASS
build = PASS
```

기존 Bundle Size Warning은 기존 WARN으로 유지한다.

---

## 4. Single-route Baseline

각 Route에 대해 Small / Medium / Large Physical Class를
각각 단독 실행했다.

### R6

| Size | trips | maxWait | collisionViolation | worldBoundsViolation |
|---|---:|---:|---:|---:|
| Small | 4 | 0.000 sec | 0 | 0 |
| Medium | 4 | 0.000 sec | 0 | 0 |
| Large | 4 | 0.000 sec | 0 | 0 |

### R7

| Size | trips | maxWait | collisionViolation | worldBoundsViolation |
|---|---:|---:|---:|---:|
| Small | 3 | 0.000 sec | 0 | 0 |
| Medium | 3 | 0.000 sec | 0 | 0 |
| Large | 3 | 0.000 sec | 0 | 0 |

### R8

| Size | trips | maxWait | collisionViolation | worldBoundsViolation |
|---|---:|---:|---:|---:|
| Small | 1 | 0.000 sec | 0 | 0 |
| Medium | 1 | 0.000 sec | 0 | 0 |
| Large | 1 | 0.000 sec | 0 | 0 |

모든 Route / Size 조합이:

```text
trip >= 1
collisionViolation = 0
worldBoundsViolation = 0
```

을 만족했다.

---

## 5. Bidirectional Pair

각 Route에서 Large + Large 양방향 2 NPC를 120초 실행했다.

| Route | Forward trips | Reverse trips | maxWait | unrecovered20 | collisionViolation |
|---|---:|---:|---:|---:|---:|
| R6 | 4 | 3 | 0.333 sec | 0 | 0 |
| R7 | 3 | 3 | 0.333 sec | 0 | 0 |
| R8 | 1 | 1 | 0.333 sec | 0 | 0 |

모든 Route에서:

```text
양방향 actor completion >= 1
collisionViolation = 0
unrecovered_20sec = 0
```

을 만족했다.

`maxWait = 0.333 sec`는 프로젝트의 Block 정의인 0.5초보다 짧으므로
별도 WARN으로 분류하지 않는다.

---

## 6. 최종 판정

```text
R6 = PASS
R7 = PASS
R8 = PASS
```

따라서 세 Route를 모두 **Full Flow Route Set에 정식 승인**한다.

최종 Route Source of Truth:

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

---

## 7. 다음 단계

```text
35 NPC Full Flow Harness 구현
```

Harness 구현 시:

- R1~R8 모두 사용 가능
- 기존 Fix4 Movement 유지
- 기존 `createSmoke(map) = 10 NPC` regression 유지
- Full Flow 전용 35 NPC creator / warm-up / measurement를 별도로 추가
- 35 NPC warm-up 30 sec
- measurement 5 min
- Node 측정과 별도로 Browser FPS / visual 확인

35 NPC Full Flow는 아직 실행하지 않았다.
