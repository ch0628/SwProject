# Supervised Learning Area Rollout Plan — Current

Updated: 2026-09-14

## 1. 목적

지도학습 구역 3개를 어떤 순서로 구현하고 검증할지 정의한다.

대상 지역:

```text
1. Plaza / Park
2. Shopping District
3. Residential
```

현재 원칙:

> Plaza/Park를 기준 Vertical Slice로 먼저 완성하되,
> 실제 Map redesign 과정에서 필요한 **Plaza/Park local Navigation v2**는
> CCTV 구현 전에 먼저 확정하고 검증한다.

---

## 2. Plaza/Park를 먼저 끝내는 이유

Plaza/Park에서 다음 공통 Pipeline을 먼저 만든다.

```text
Map Geometry
Environment Placement
Collision
Door / Threshold
Character Rendering
Navigation Graph
NPC Itinerary / Flow
Progress Detection
CCTV Coverage
CCTV Interaction
```

이 Pipeline을 기준으로 Shopping / Residential을 확장한다.

---

## 3. Phase A — Plaza/Park Map / Visual / Navigation Foundation

현재까지:

```text
Scale Validation                         ✅
Corridor Validation                      ✅
Historical Graybox                       ✅
Environment Graphics Integration         ✅ PASS with WARN
Character Visual Runtime Integration     ✅

Plaza/Park v2 Map Redesign               ✅
Cafe / Facility / Manhole 위치           ✅
Tree / Bench / Lamp / Fence 배치          ✅ 정리
Manhole Interaction Sync                 ✅

Navigation_v2 Point Objects              ✅ 28개
Navigation_v2 Unique Names               ✅ 28개 / N01~N28
Node Identity / Structural Precheck      ✅ PASS
Node Roles                               ✅ N17 Cafe / N18 transit / N28 Facility
Navigation Graph v2 Design               ✅ 33-edge 문서 설계안
Navigation_v2 Edge TMJ 반영              ✅ PASS / E01~E33
Full Structural Graph Validation         ✅ PASS
Geometry / Collision Validation          ✅ PASS
Small / Medium / Large Physical          ✅ PASS
Door Edge Validation                     ✅ PASS
```

현재 `plaza-park-v2.tmj`가 Plaza/Park Navigation v2의 기준 Map이다.

---

## 4. Phase B — Plaza/Park NPC Navigation v2 ✅ COMPLETE

Node identity, Navigation_Edges_v2와 movement/navigation runtime 검증을 완료했다.

```text
Graph Structural / Edge Collision Validation       ✅
Small / Medium / Large Traversability              ✅
35 Character Pool + semantic intent/runtime        ✅
Dijkstra logical routing                           ✅
Spawn / Exit policy                                ✅
Direction-aware two-way lane                       ✅
Junction continuity                                ✅
Stop Point reservation/defer                       ✅
Progress watchdog                                  ✅ 2s / 1px
Deterministic active concurrency                    ✅ 5/8/10/12/15 PASS
```

중요:

```text
35개 NPC에게 itinerary를 정의하는 것
≠
35마리를 동시에 active하게 유지하는 것
```

15 active NPC는 검증된 reference일 뿐 최종 gameplay active 수가 아니다.
최종 동시 active 수는 CCTV gameplay와 UX 단계에서 별도 결정한다.

Historical v1 결과:

```text
10 NPC Limited = PASS with WARN
35 NPC Full Flow = FAIL
30 NPC fallback = FAIL
Browser long-stall = KNOWN ISSUE
```

은 Navigation v2 설계의 경고 근거로 보존한다.

---

## 5. Phase C — Plaza/Park Full Supervised Playable Prototype — CURRENT

현재 Phase C는 `plaza-park-v2.tmj` 한 Map과 local prototype observation zone `PLAZA_CAM_A~E`를 사용해 전체 지도학습 flow를 완성하는 단계다.

```text
PLAZA_CAM_A~E
→ Round 1 Scenario: 35 NPC / 28 Citizen / 7 Villain
→ MANUAL_LABELING: 약 8 distinct Characters
→ FIRST_TRAINING
→ Scenario Round Reset
→ Round 2 Scenario: 35 NPC / 28 Citizen / 7 Villain
→ HUMAN_AI_COMPARE
→ RETRAINING
→ AI_ASSISTED_MONITORING
→ FINAL_SCAN
→ COMPLETE
```

35 Character Pool은 visual/identity pool이다. Round별 `actualLabel`, `homeObservationZone`, lifecycle, behavior/route는 `RoundCharacterAssignment`가 결정하며 동일 identity의 역할이 Round 사이에 바뀔 수 있다.

구현된 `CCTV1/CCTV2 MANUAL_LABELING` slice는 old 2-camera technical baseline으로 보존한다. current Phase C에는
`PLAZA_CAM_A~E` loader, Round 1 `RoundScenario`, 35 identity persistent lifecycle과 authored Scenario Point
binding이 추가로 구현·검증되어 있다. `FIRST_TRAINING` 이후 flow와 Round 2는 아직 구현되지 않았다.

---

## 6. Phase D — Shopping District

Plaza/Park에서 검증된 구조를 재사용한다.

```text
Shopping District Map / Graybox
→ Environment
→ Collision
→ Local Navigation Nodes / Graph
→ NPC Itinerary
→ CCTV3 / CCTV4
→ Area Validation
```

Plaza/Park의 정확한 Node ID나 Route를 복제하는 것이 아니라,
같은 **Graph + Itinerary 설계 원칙**을 재사용한다.

---

## 7. Phase E — Residential

```text
Residential Map / Graybox
→ Environment
→ Collision
→ Local Navigation Nodes / Graph
→ NPC Itinerary
→ CCTV5
→ Area Validation
```

---

## 8. Phase F — 3-Zone Navigation Integration

세 지역의 local graph가 준비된 뒤 진행한다.

```text
Plaza/Park Graph
+
Shopping Graph
+
Residential Graph
↓
Inter-zone Entry / Exit 연결
↓
3-Zone Navigation Topology
```

이 단계에서:

```text
Zone 연결부
Inter-zone route
Global itinerary
```

를 확정한다.

즉 기존 계획의 "Navigation v2는 세 맵 이후에만 시작"은 다음처럼 구분한다.

```text
Local Navigation v2
= 각 Area에서 먼저 설계 가능

3-Zone Global Navigation
= 세 Area topology가 준비된 뒤 통합
```

---

## 9. Phase G — Target Full-Game 3-Zone Supervised Learning Integration

지역:

```text
Plaza/Park
Shopping District
Residential
```

CCTV:

```text
CCTV1 / CCTV2 = Plaza/Park
CCTV3 / CCTV4 = Shopping District
CCTV5         = Residential
```

이 `CCTV1~5`는 향후 target global namespace다. current Phase C의 `PLAZA_CAM_A~E`와 같은 namespace나 1:1 의미로 해석하지 않는다.

통합 Gameplay 데이터:

```text
NPC id
roundId
actualLabel
homeObservationZone
currentObservationZone
currentBehavior
behaviorHistory
userLabel
aiLabel
verifiedLabel
aiConfidence
```

Navigation 내부 Node/Edge ID에 Gameplay를 강결합하지 않는다.

---

## 10. 현재 우선순위

```text
1. Round 1 final regression 및 current validation 문서 유지
2. `FIRST_TRAINING` verification interaction과 Round 1→Round 2 전이 설계
3. Round 2 Manual Labeling → Compare → Retraining → Final flow
4. Shopping District / Residential
5. Target 3-Zone Navigation / Supervised Gameplay Integration
```

---

## 11. 현재 한 줄 상태

```text
Plaza/Park Map v2와 N01~N28, E01~E33, SP1~SP10은 frozen이다.
35 Character Pool과 semantic/Dijkstra/lane/junction/Stop Point runtime을 구현했다.
5/8/10/12/15 NPC deterministic concurrency는 모두 PASS했다.
old CCTV1/CCTV2 MANUAL_LABELING technical baseline은 PASS했고 historical validation으로 보존한다.
current design은 PLAZA_CAM_A~E, Round 1/2 각 35 NPC·28:7, Round 1 manual target 약 8이다.
Round 1 foundation은 current runtime과 별도 validation 문서까지 마감되었다. 다음 작업은 verification interaction을 포함한 `FIRST_TRAINING` 전이 설계이며, Round 2 이후 flow는 scope 밖이다.
```
