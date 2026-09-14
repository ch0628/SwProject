# Plaza & Park NPC Flow Validation Specification — Current

Updated: 2026-09-14

## 1. 문서 역할 변경

이 문서는 이제 두 부분을 구분해서 다룬다.

```text
A. Historical Traffic v1 결과 보존
B. Navigation v2 Flow Validation 기준
```

기존 W01~W22 / R1~R8 결과를
Navigation v2의 성능 주장으로 재사용하지 않는다.

---

## 2. Historical v1 — 보존 결과

Limited Fix4:

```text
NPC = 10
Measurement = 120 sec

completed_routes = 11
waypoint_arrivals = 71

R1 trips = 2
R2 trips = 2
R3 trips = 3
R4 trips = 1
R5 trips = 3

collisionViolation = 0
unrecovered_20sec = 0
max_continuous_blocked_time ≈ 14.8 sec
```

당시 판정:

```text
PASS with WARN
```

Browser에서는 이후:

```text
약 4 NPC
약 30초 이상 실질적 정체
```

가 관찰됐다.

또한:

```text
35 NPC Full Flow = FAIL
30 NPC fallback = FAIL
```

따라서 기존 v1의:

```text
10 active movers
```

는 역사적 임시 운영값일 뿐,
Navigation v2의 capacity claim이 아니다.

---

## 3. Navigation v2 Validation 대상

Source Map:

```text
public/maps/plaza-park-v2.tmj
```

Node Layer:

```text
Navigation_v2
```

Nodes:

```text
Point Objects = 28
Unique Names = 28
N01~N28 존재
누락 / 중복 없음
Node identity / node structural precheck = PASS
```

Graph:

```text
33 bidirectional edges (TMJ 반영 완료)
Navigation_Edges_v2 Polyline Objects = 33
```

Graph 상세:

```text
docs/plaza_park_navigation_v2_spec.md
```

---

## 4. Validation 단계

Navigation v2는 아래 순서로 검증한다.

### Stage 1 — Structural Graph Validation

PASS 조건:

```text
N01~N28 이름 중복 없음
Node 누락 없음
Edge endpoint가 존재하는 Node를 참조
고립된 Node 없음
Graph가 의도한 주요 구역에서 연결됨
Door branch가 main graph와 연결됨
```

### Stage 2 — Edge Geometry Validation

각 Edge에 대해:

```text
Edge가 Solid Collision을 관통하지 않음
Fence를 관통하지 않음
건물 벽을 관통하지 않음
실제 walkable ground를 따름
의도하지 않은 Grass shortcut 없음
```

### Stage 3 — Footprint Traversability

검증 Proxy:

```text
Small  = 18×12
Medium = 22×14
Large  = 26×16
```

최소 요구:

```text
모든 일반 Transit Edge에서 Large physical footprint 통과 가능
Door branch는 해당 Door opening semantics에 맞게 별도 검사
```

Large visual clearance는 physical PASS와 분리해서 WARN으로 기록할 수 있다.

### Stage 4 — Route Connectivity

주요 흐름을 최소한 확인:

```text
North/West/East Entry
→ Plaza left/center/right
→ South exits

Cafe approach
Facility approach

South transit
```

특정 하나의 Node가 모든 route의 mandatory hub가 되지 않는지 확인한다.

### Stage 5 — 35 NPC Itinerary Validation

35 NPC 각각에:

```text
identity
start
destination sequence
exit
```

를 정의한다.

이 단계의 목표:

```text
"35개 NPC가 의미 있는 서로 다른 생활 동선을 가진다"
```

이다.

### Stage 6 — Active Concurrency Validation

별도 단계:

```text
동시에 몇 NPC를 active하게 유지할 것인가
spawn cadence
exit/despawn
re-entry
```

를 검증한다.

`35 itinerary = 35 simultaneous active`로 자동 해석하지 않는다.

---

## 5. Navigation v2 Node 역할

```text
N01 = NORTH_WEST_ENTRY_EXIT
N02 = NORTH_CENTER_ENTRY_EXIT
N03 = WEST_ENTRY_EXIT
N16 = EAST_ENTRY_EXIT

N24 = SOUTH_WEST_EXIT
N25 = SOUTH_CENTER_EXIT
N26 = SOUTH_EAST_EXIT

N23 = SOUTH_WEST_TRANSIT
N27 = SOUTH_EAST_TRANSIT

N17 = CAFE_DOOR
N18 = TRANSIT
N28 = FACILITY_DOOR
```

나머지:

```text
TRANSIT / JUNCTION / 필요 시 POI
```

---

## 6. 승인 Edge 설계안

아래 33개 연결은 현재 TMJ의 `Navigation_Edges_v2`에 반영됐고
Structural / Geometry / Collision / Physical / Door Edge Validation을 통과했다.

```text
N01 ↔ N04
N03 ↔ N04
N04 ↔ N05
N02 ↔ N05
N05 ↔ N06
N06 ↔ N07
N07 ↔ N08

N04 ↔ N09
N05 ↔ N10
N09 ↔ N10
N10 ↔ N11

N09 ↔ N12
N12 ↔ N19
N19 ↔ N20
N20 ↔ N21
N18 ↔ N19

N11 ↔ N14
N13 ↔ N14
N14 ↔ N22
N22 ↔ N21
N13 ↔ N15

N10 ↔ N21

N08 ↔ N15
N15 ↔ N16
N08 ↔ N28

N17 ↔ N18

N18 ↔ N24
N21 ↔ N25
N15 ↔ N26

N23 ↔ N24
N24 ↔ N25
N25 ↔ N26
N26 ↔ N27
```

총:

```text
33 bidirectional edges
```

---

## 7. South Exit 정책

기존처럼 모든 South-exit NPC를 도로 양 끝으로 보낼 필요가 없다.

확정:

```text
N24 = South-West Exit
N25 = South-Center Exit
N26 = South-East Exit
```

`N23`, `N27`은 일반 south-road transit이다.

효과:

```text
불필요한 횡이동 감소
양 끝 endpoint 병목 감소
Cafe / Center / East 흐름을 각각 가까운 Exit로 분산
```

예:

```text
Cafe side:
N18 → N24 → EXIT

Center:
N21 → N25 → EXIT

East / Facility:
N15 → N26 → EXIT
```

---

## 8. Door Branch 정책

```text
N18 ↔ N17(CAFE_DOOR)
N08 ↔ N28(FACILITY_DOOR)
```

Door node는 일반 transit hub가 아니다.

일반 NPC는 branch에 진입하지 않아도 된다.

건물 방문 itinerary에서만 Door branch를 사용한다.

---

## 9. Progress Validation

기존 v1에서 다음 blind spot이 있었다.

```text
화면:
장시간 실질적 정지

telemetry:
Moving
Blocked = 0
20s+ = 0
```

Navigation v2 Flow Validation에는
실제 displacement 기반 progress detector를 추가하는 것을 목표로 한다.

개념:

```text
target이 남아 있음
+
최근 N초 위치 변화량이 매우 작음
→ stalled candidate
```

정확한 threshold는 구현/측정 후 확정한다.

---

## 10. PASS / WARN / FAIL 원칙

Graph Structural / Edge 단계:

PASS:

```text
고립 Node 없음
잘못된 Edge endpoint 없음
Solid 관통 없음
Large physical footprint traversal 가능
Door branch 연결 정상
```

WARN:

```text
Large visual clearance가 일부 좁음
시각적으로 가까운 교행
minor route preference imbalance
```

FAIL:

```text
Edge가 Collision/Fence/Building을 관통
Node가 실제 walkable 영역 밖
Door branch 접근 불가
필수 구역 disconnected
mandatory single choke 구조가 재생성
```

35 NPC 단계의 SLO / stall threshold는
Edge validation 후 별도 확정한다.

---

## 11. 현재 Gate

현재 완료:

```text
Map v2 topology          ✅
Navigation_v2 objects 28 ✅
Unique node names 28     ✅ N01~N28
Node structural precheck ✅ PASS
Graph design             ✅ 문서 설계안
33 Edge implementation   ✅ PASS / TMJ 반영
```

현재:

```text
Navigation_Edges_v2 layer = 있음
Edge implementation = PASS
Full Structural Graph Validation = PASS
Geometry / Collision Validation = PASS
Small / Medium / Large Physical Validation = PASS
Door Edge Validation = PASS
```

다음 Gate:

```text
35 NPC Itinerary Design
→ Active Concurrency Validation
```

현재 한 줄 상태:

```text
Historical v1 Full Flow 결과는 실패/경고 기록으로 보존한다.

Navigation v2 Map에는 Point Object 28개와 고유 이름 28개가 있고,
N01~N28이 각각 한 번씩 존재하여 Node structural precheck는 PASS다.
33 Edge는 TMJ에 구현됐으며
Full Structural / Geometry / Collision / Physical / Door Edge Validation은 PASS다.
35 NPC itinerary는 아직 구현하지 않았다.
```
