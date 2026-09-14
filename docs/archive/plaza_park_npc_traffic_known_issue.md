# Plaza/Park NPC Traffic Known Issue & Navigation v2 Resolution Path

Updated: 2026-09-14

## 1. Historical Traffic v1 상태

기존 Traffic v1은:

```text
W01~W22
R1~R8
Fix4 movement
```

기반이다.

Historical 결과:

```text
Limited 10 NPC / 120 sec = PASS with WARN
35 NPC Full Flow          = FAIL
30 NPC fallback           = FAIL
```

실제 Browser에서도:

```text
약 4 NPC가 합류 지점에서
약 30초 이상 실질적으로 정체
```

하는 현상이 관찰됐다.

당시 telemetry 예시:

```text
Moving = 10
Waiting = 0
Blocked = 0
Severe = 0
20s+ = 0
```

따라서 다음 두 문제가 존재한다.

```text
A. Graph / Route 구조의 합류 집중
B. Progress telemetry blind spot
```

---

## 2. 현재 결정

Traffic v1에 Fix5를 추가하지 않는다.

금지:

```text
W12 patch 추가
기존 R1~R8 예외 규칙 증가
25 / 20 / 15 density 반복 탐색
Collision 완화로 증상 숨기기
Render-only offset으로 정체 숨기기
```

상태:

```text
Traffic v1 = FROZEN / HISTORICAL
```

---

## 3. Navigation v2 해결 경로 — 현재 진행 중

기존 문서에서 Navigation v2는 "추후" 계획이었으나,
Plaza/Park v2 Map redesign이 진행되면서
**Plaza/Park local Navigation v2를 현재 단계에서 먼저 설계**하기로 결정했다.

현재:

```text
Map = public/maps/plaza-park-v2.tmj
Layer = Navigation_v2
Point Objects = 28
Unique Node Names = 28
Node Names = N01~N28, 누락/중복 없음
Node Identity / Structural Precheck = PASS
Graph Design = 33 bidirectional edges
Navigation_Edges_v2 = E01~E33 TMJ 반영 완료
Full Structural Graph Validation = PASS
Geometry / Collision Validation = PASS
Small / Medium / Large Physical Validation = PASS
Door Edge Validation = PASS
```

다음:

```text
35 NPC Itinerary = 다음 단계 / 아직 미구현
→ Active Concurrency Validation
```

---

## 4. Navigation v2 핵심 구조

### Entry / Exit 분산

```text
N01 = NORTH_WEST_ENTRY_EXIT
N02 = NORTH_CENTER_ENTRY_EXIT
N03 = WEST_ENTRY_EXIT
N16 = EAST_ENTRY_EXIT
```

South는 양 끝으로만 몰지 않는다.

```text
N24 = SOUTH_WEST_EXIT
N25 = SOUTH_CENTER_EXIT
N26 = SOUTH_EAST_EXIT
```

남쪽 도로 양 끝:

```text
N23
N27
```

은 일반 transit node로 유지한다.

이 결정의 목적:

```text
불필요한 South road 횡이동 감소
Exit traffic 분산
양 끝 endpoint 병목 감소
```

---

## 5. Door Branch

```text
N17 = CAFE_DOOR
N18 = TRANSIT
N28 = FACILITY_DOOR
```

일반 통행 NPC는 Door branch를 반드시 통과하지 않는다.

예:

```text
일반:
... → N18 → 다른 transit node

Cafe 방문 설계:
... → N18 → N17 → ENTER
```

Facility도 동일하다.

Door node를 central transit hub로 사용하지 않는다.

---

## 6. 승인된 Graph Edge 설계안

모든 Edge는 기본 양방향이다.
현재 Map의 `Navigation_Edges_v2` 레이어에
아래 승인 연결이 구현됐다.

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

Total:

```text
33 bidirectional edges
```

---

## 7. v2가 v1 문제를 피하는 방법

기존 문제:

```text
많은 Route
→ 공통 hub / merge
→ queue
→ yield interaction
→ long stall
```

v2 원칙:

```text
다중 Entry
다중 Exit
Left / Center / Right 축 분산
Door branch 분리
South exit 분산
```

따라서:

```text
"모든 NPC가 반드시 한 Node를 통과"
```

하는 구조를 만들지 않는다.

---

## 8. 아직 해결되지 않은 문제

Navigation v2 Graph 설계가 확정됐다고 해서
Traffic 문제가 해결됐다고 선언하지 않는다.

아직 검증 필요:

```text
Edge가 실제 Collision을 가로지르는가?
Large footprint로 통과 가능한가?
두 방향 교행에서 local avoidance가 필요한가?
특정 itinerary 조합이 다시 hub를 만드는가?
35개 NPC 중 몇 개를 동시에 active할 수 있는가?
```

또한 기존 telemetry blind spot도 해결 필요하다.

향후 Progress Watchdog:

```text
target 존재
AND
실제 target distance가 남아 있음
AND
N초 동안 displacement가 threshold 이하

→ STALLED
```

정확한 threshold는 별도 검증 후 확정한다.

---

## 9. 35 NPC 설계 원칙

다음 단계에서:

```text
35 NPC identity
35 NPC 목적지
35 NPC itinerary
```

를 설계한다.

하지만:

```text
35 NPC itinerary
≠ 35 simultaneous active movers
```

이다.

동시 active 수는:

```text
Graph 검증
→ Itinerary 검증
→ Browser progress validation
```

후 결정한다.

---

## 10. 현재 한 줄 상태

```text
Traffic v1의 장기 군집 문제는 Known Issue로 보존한다.

Plaza/Park v2 Map에는 Navigation_v2 Point Object 28개와 고유 이름 28개가 있고,
N01~N28이 각각 한 번씩 존재하여 Node structural precheck는 PASS다.
33-edge Navigation Graph v2는 TMJ에 반영됐으며
Full Structural / Geometry / Collision / Physical / Door Edge Validation은 PASS다.
35 NPC itinerary와 Active Concurrency Validation은 아직 진행하지 않았다.
```
