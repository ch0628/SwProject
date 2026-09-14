# Plaza/Park Navigation v2 Specification

Updated: 2026-09-14

## 1. 목적

Plaza/Park v2 Map에서 사용할
새 Navigation Graph의 Source of Truth를 정의한다.

이 문서는 기존:

```text
W01~W22
R1~R8
Traffic v1
```

을 수정하기 위한 문서가 아니다.

문서상 설계 구조:

```text
N01~N28
+
Graph Edge
+
NPC-specific Itinerary
```

단, 실제 구현 상태는 항상 `public/maps/plaza-park-v2.tmj`를 우선한다.
2026-09-14 현재 Map에는 `Navigation_v2` Point Object가 28개 있고,
고유 이름도 28개이며 `N01~N28`이 각각 한 번씩 존재한다.

를 정의한다.

---

## 2. Map / Layer Source of Truth

Map:

```text
public/maps/plaza-park-v2.tmj
```

Node Layer:

```text
Navigation_v2
```

Edge Layer:

```text
Navigation_Edges_v2
```

기존:

```text
Navigation
```

Layer와 W01~W22는 역사/비교 목적으로 유지할 수 있으나,
Navigation v2의 Source of Truth로 사용하지 않는다.

---

## 3. Node 기본 규칙

Node 형태:

```text
Tiled Point Object
width = 0
height = 0
```

Node 이름:

```text
현재 Map object 수 = 28
현재 고유 이름 수 = 28
현재 이름 범위 = N01~N28
누락 = 없음
중복 = 없음
```

확정 identity:

```text
id 219 = N18 @ (863, 1312)
id 235 = N17 @ (624, 1312)
```

정확한 좌표는 이 문서에 복제하지 않는다.

이유:

```text
Node coordinate Source of Truth
= plaza-park-v2.tmj
```

문서에는 의미/연결만 기록한다.

---

## 4. Node 역할

### 4.1 Entry / Exit

```text
N01 = NORTH_WEST_ENTRY_EXIT
N02 = NORTH_CENTER_ENTRY_EXIT
N03 = WEST_ENTRY_EXIT
N16 = EAST_ENTRY_EXIT
```

### 4.2 South Exit

```text
N24 = SOUTH_WEST_EXIT
N25 = SOUTH_CENTER_EXIT
N26 = SOUTH_EAST_EXIT
```

South Exit를 세 곳으로 나누는 이유:

```text
South road 양 끝으로 불필요한 이동을 강제하지 않음
Cafe / Center / East 흐름 분산
endpoint 병목 감소
```

### 4.3 South Transit

```text
N23 = SOUTH_WEST_TRANSIT
N27 = SOUTH_EAST_TRANSIT
```

이 둘은 Exit가 아니라
South road를 실제로 따라 이동해야 하는 NPC의 transit node다.

### 4.4 Door Branch

```text
N17 = CAFE_DOOR
N28 = FACILITY_DOOR
```

Door branch는 일반 transit path가 아니다.

```text
Cafe:
N18 ↔ N17

Facility:
N08 ↔ N28
```

건물 방문 itinerary에서만 적극 사용한다.

### 4.5 나머지

```text
N18 = TRANSIT
N04~N15, N19~N22
```

기본 역할:

```text
TRANSIT / JUNCTION
```

향후 Gameplay 필요 시
일부 Node에 POI semantic을 추가할 수 있다.

---

## 5. Edge 정책

기본:

```text
Bidirectional
```

Edge의 의미:

```text
두 Node 사이를
중간 waypoint 없이
직접 traversal해도 되는 walkable connection
```

금지:

```text
Grass shortcut
Fence 관통
Building 관통
Collision 관통
시각적으로 가깝다는 이유만으로 연결
```

---

## 6. 승인 설계안 — 33 Edges

아래 승인 Edge는 현재 TMJ의 `Navigation_Edges_v2` 레이어에 반영됐다.

### North / Upper

```text
E01  N01 ↔ N04
E02  N03 ↔ N04
E03  N04 ↔ N05
E04  N02 ↔ N05
E05  N05 ↔ N06
E06  N06 ↔ N07
E07  N07 ↔ N08
```

### Upper → Plaza

```text
E08  N04 ↔ N09
E09  N05 ↔ N10
E10  N09 ↔ N10
E11  N10 ↔ N11
```

### Plaza Left

```text
E12  N09 ↔ N12
E13  N12 ↔ N19
E14  N19 ↔ N20
E15  N20 ↔ N21
E16  N18 ↔ N19
```

### Plaza Right

```text
E17  N11 ↔ N14
E18  N13 ↔ N14
E19  N14 ↔ N22
E20  N22 ↔ N21
E21  N13 ↔ N15
```

### Plaza Center

```text
E22  N10 ↔ N21
```

### East / Facility

```text
E23  N08 ↔ N15
E24  N15 ↔ N16
E25  N08 ↔ N28
```

### Cafe

```text
E26  N17 ↔ N18
```

### South Connections

```text
E27  N18 ↔ N24
E28  N21 ↔ N25
E29  N15 ↔ N26
```

### South Road

```text
E30  N23 ↔ N24
E31  N24 ↔ N25
E32  N25 ↔ N26
E33  N26 ↔ N27
```

Total:

```text
33 bidirectional edges
```

---

## 7. Graph 구조 의도

기존 v1의 핵심 문제 중 하나:

```text
여러 Route
→ 공통 merge
→ queue
→ yield
→ long stall
```

Navigation v2에서는 다음을 의도한다.

```text
Multiple Entry
↓
Left / Center / Right distributed paths
↓
Multiple South Exit
```

대표 축:

```text
Left:
upper
→ N09
→ N12 / N19 / N20
→ N24 또는 center connection

Center:
upper
→ N10
→ N21
→ N25

Right:
upper/east
→ N13 / N15
→ N26
```

특정 하나의 Node가 모든 itinerary의 mandatory hub가 되면 안 된다.

---

## 8. Door Branch

Cafe:

```text
main graph
→ N18
→ N17
→ Cafe Enter
```

Facility:

```text
main graph
→ N08
→ N28
→ Facility Enter
```

일반 transit NPC:

```text
Door Node를 통과할 필요 없음
```

---

## 9. Exit Routing 예

### Cafe side

```text
... → N18 → N24 → EXIT
```

### Center

```text
... → N21 → N25 → EXIT
```

### East / Facility side

```text
... → N15 → N26 → EXIT
```

### South road traverse

```text
N23 ↔ N24 ↔ N25 ↔ N26 ↔ N27
```

South road를 횡단할 이유가 있는 itinerary만 사용한다.

---

## 10. TMJ Edge 반영 방법

권장:

```text
Object Layer:
Navigation_Edges_v2
```

현재 Map 상태:

```text
Navigation_Edges_v2 layer = 있음
E01~E33 Polyline Object = 33개
from / to / bidirectional properties = 반영됨
```

E17은 별도 제어점 없이 `N11 ↔ N14`를 잇는 직선 Polyline이다.

각 Edge:

```text
Polyline Object
Name = E01 ... E33
```

권장 custom properties:

```text
from = Nxx
to = Nyy
bidirectional = true
```

단, 실제 구현 전에 현재 parser가 Polyline/custom property를 어떻게 읽을지 확인한다.

TMJ에 Edge를 넣기 위해
기존 `Navigation_v2` Point를 이동하지 않는다.

---

## 11. Edge Validation Gate

TMJ 반영 후 반드시 다음을 검증한다.

### Structural

```text
N01~N28 존재
E01~E33 존재
from / to Node 존재
Edge 중복 없음
고립 Node 없음
```

현재 사전 판정:

```text
Node identity / node structural precheck = PASS
- Point Object 28개
- Unique Node Name 28개
- N01~N28 존재
- 누락/중복 없음

Edge implementation = PASS (E01~E33, 33/33)
Full Structural Graph Validation = PASS
Geometry / Collision Validation = PASS
Small / Medium / Large Physical Validation = PASS
Door Edge Validation = PASS
```

### Geometry

```text
Collision 관통 없음
Fence 관통 없음
Building 관통 없음
walkable ground 이탈 없음
```

### Physical

```text
Small 18×12
Medium 22×14
Large 26×16
```

기준으로 traversal 가능 여부 확인.

### Door

```text
N17 Cafe branch 접근 가능
N28 Facility branch 접근 가능
```

---

## 12. 35 Character Pool과 runtime 연결

현재 구현:

```text
35 Character Pool
→ semantic intent / 목적지
→ Dijkstra logical graph path
→ direction-aware lane traversal
→ junction continuity
→ Stop Point reservation/defer
```

중요:

```text
35 itinerary
≠ 35 simultaneous active movers
```

5/8/10/12/15 active NPC deterministic validation은 PASS했다.
15는 검증 reference이며 최종 gameplay active 수는 별도로 결정한다.

---

## 13. 변경 관리

이 문서 확정 이후 다음 변경은 재검토 대상이다.

```text
Node 추가/삭제
Node 이동
Edge 추가/삭제
Road topology 변경
Fence/Collision이 Edge를 침범
Door 위치 변경
```

단순 cosmetic change는
walkability를 바꾸지 않으면 Graph 재설계를 요구하지 않는다.

---

## 14. 현재 상태

```text
Map v2                   ✅
Navigation_v2 object 28개 ✅
고유 Node 이름 28개       ✅ N01~N28
Node identity precheck   ✅ PASS
Node roles               ✅ N17 Cafe / N18 transit / N28 Facility
E01~E33 design           ✅ 문서 설계안

TMJ Edge layer/objects   ✅ PASS / 33개
Full structural validation ✅ PASS
Geometry / Collision     ✅ PASS
Small 18×12 traversal    ✅ PASS / 33/33
Medium 22×14 traversal   ✅ PASS / 33/33
Large 26×16 traversal    ✅ PASS / 33/33
Door edge validation     ✅ PASS
35 Character Pool        ✅ 구현 완료
Semantic/Dijkstra runtime ✅ 구현 완료
Direction-aware lane     ✅ 구현 완료
Junction continuity      ✅ 구현 완료
SP1~SP10 integration     ✅ FROZEN
Stop Point reservation   ✅ 구현 완료
Concurrency 5~15         ✅ PASS
```

현재 한 줄 상태:

```text
Plaza/Park Navigation_v2에는 Point Object 28개와 고유 Node 이름 28개가 있고,
N01~N28이 각각 한 번씩 존재하여 Node structural precheck는 PASS다.
승인된 E01~E33은 TMJ에 반영됐으며
Full Structural / Geometry / Collision / Small / Medium / Large / Door Validation은 PASS다.
Lane-aware runtime, junction continuity와 SP1~SP10 reservation/defer를 구현했고,
5/8/10/12/15 NPC deterministic concurrency는 모두 PASS했다.
old CCTV1/CCTV2 MANUAL_LABELING은 historical technical baseline으로 완료됐다.
Round 1 `PLAZA_CAM_A~E` Scenario runtime과 persistent lifecycle도 current validation에서 완료됐으며,
다음 단계는 `FIRST_TRAINING` verification interaction 설계다.
```
