# SWfestival Navigation v2 Documentation Update

Updated: 2026-09-14

## 교체할 파일

```text
docs/session_handoff_current.md
docs/supervised_learning_area_rollout_plan.md
docs/archive/plaza_park_npc_traffic_known_issue.md
docs/reference/plaza_park_full_flow_validation_spec.md
```

## 새로 추가할 파일

```text
docs/plaza_park_navigation_v2_spec.md
```

## 이번 업데이트에서 확정된 핵심

```text
Plaza/Park v2 Map = Navigation 기준 topology freeze
Navigation_v2 Point Objects = 28
Navigation_v2 Unique Names = 28
Navigation_v2 Names = N01~N28, 누락/중복 없음
Node Identity / Structural Precheck = PASS
Navigation Graph = 33 bidirectional edges (TMJ 반영 완료)
South Exit = N24 / N25 / N26
Cafe Door = N17
Transit = N18
Facility Door = N28

현재 단계:
Navigation_Edges_v2 TMJ 반영 = PASS
Full Structural Graph Validation = PASS
Geometry / Collision Validation = PASS
Small / Medium / Large Physical Validation = PASS
Door Edge Validation = PASS

다음 단계:
35 NPC itinerary (아직 미구현)
```

기존 Traffic v1 결과는 삭제하지 않고 역사/실패 증거로 보존한다.
