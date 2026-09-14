# SWfestival Documentation Index

## CURRENT PROJECT STATE

```text
Plaza/Park:
Map v2 + Navigation v2 + movement foundation COMPLETE
Round 1 persistent playable foundation COMPLETE
old 2-camera Manual Labeling technical baseline COMPLETE

Current design:
PLAZA_CAM_A~E + Round 1/2 each 35 NPC (28 Citizen / 7 Villain)

Next:
FIRST_TRAINING verification interaction and Round 2 transition design
```

현재 Map Source of Truth는 `public/maps/plaza-park-v2.tmj`다.
Map, N01~N28, E01~E33, SP1~SP10은 frozen이다.

## A. Current Source of Truth

현재 구현과 설계를 판단할 때 우선 읽는 문서다.

Plaza/Park playable prototype 작업의 필수 읽기 순서:

1. [지도학습 규칙](supervised_learning_rules.md)
2. [지도학습 지역 Rollout Plan](supervised_learning_area_rollout_plan.md)
3. [35 Character identity / Round truth](supervised_character_pool.md)
4. [Plaza/Park Map Specification](map_plaza_park_spec.md)
5. [현재 Session Handoff](session_handoff_current.md)

`validation/plaza_park_v2/plaza_park_cctv_manual_labeling_validation.md`는 old CCTV1/CCTV2의 **HISTORICAL VALIDATION — 2-camera manual-labeling baseline**이다. current `PLAZA_CAM_A~E` Source of Truth로 선택하지 않는다.

### Learning

- [지도학습 규칙](supervised_learning_rules.md)
- [비지도학습 규칙](unsupervised_learning_rules.md)
- [강화학습 규칙](reinforcement_learning_rules.md)

### Plan / Handoff

- [지도학습 지역 Rollout Plan](supervised_learning_area_rollout_plan.md)
- [현재 Session Handoff](session_handoff_current.md)

### Character

- [35 Character Pool](supervised_character_pool.md)

### Technical

- [ML Prototype 기술 요구사항](ml_prototype_technical_requirements.md)

### Maps

- [Plaza/Park Map Specification](map_plaza_park_spec.md)
- [Shopping District Map Specification](map_shopping_district_spec.md)
- [Residential Map Specification](map_residential_spec.md)
- [Map Scale Validation Specification](map_scale_validation_spec.md)
- [Plaza/Park Navigation v2 Specification](plaza_park_navigation_v2_spec.md)

### Graphics

- [Graphics & Character Asset Specification](graphics_character_asset_spec.md)
- [Plaza/Park Environment Asset Specification](plaza_park_environment_asset_spec.md)

## B. Current Plaza/Park Validation

다음 문서는 Navigation v2 개발 이력을 시간순으로 보존한다.

1. [Navigation v2 구조·물리 검증](validation/plaza_park_v2/plaza_park_navigation_v2_validation_results.md)
   - Navigation v2 topology의 초기 구조·geometry·physical validation 기록
2. [Single-centerline concurrency baseline](validation/plaza_park_v2/plaza_park_supervised_concurrency_validation.md)
   - historical intermediate state: 8 NPC 이상 FAIL
3. [Two-way lane first fix](validation/plaza_park_v2/plaza_park_lane_runtime_validation.md)
   - historical intermediate state: 5/8/10 PASS, 12/15 FAIL
4. [Final junction/reservation validation](validation/plaza_park_v2/plaza_park_junction_stop_reservation_validation.md)
   - current final validation: 5/8/10/12/15 PASS
5. [Historical 2-camera Manual Labeling baseline](validation/plaza_park_v2/plaza_park_cctv_manual_labeling_validation.md)
   - old CCTV1/CCTV2 runtime/interaction technical baseline; current 5-camera validation이 아님
6. [Current Round 1 foundation validation](validation/plaza_park_v2/plaza_park_round1_foundation_validation.md)
   - current `PLAZA_CAM_A~E`, 35-NPC persistent lifecycle, Scenario Point safety and recovery regression

이 문서들은 서로 다른 개발 단계의 증거다. 합치거나 이전 결과를 최신 결과로 덮어쓰지 않는다. Historical 2-camera 문서는 당시 조건 그대로 보존하고, current 결과는 Round 1 validation 문서에서 관리한다.

## C. Historical Plaza/Park v1

[`validation/plaza_park_v1/`](validation/plaza_park_v1/)에는 Traffic v1의 graybox,
clearance, Fix4, candidate route, 30/35 NPC 및 graphics integration 결과를 보존한다.

`plaza_park_limited_validation_v2_results.md`의 `v2`는 현재 Map v2가 아니라
과거 validation iteration 이름이다.

## D. General Validation

[`validation/general/`](validation/general/)에는 scale, corridor capacity와
map coordinate audit 결과를 보존한다.

## E. Reference

[`reference/`](reference/)에는 시각 참고자료와 완료된 integration/validation 절차 문서를 둔다.
이 문서들은 현재 Source of Truth를 보조하지만 대체하지 않는다.

## F. Archive

[`archive/`](archive/)에는 완료되거나 대체된 적용 안내, 작업 시작점과 resolved known issue를 보존한다.
완료된 AI task prompt는 [`../ai/tasks/archive/`](../ai/tasks/archive/)에 있다.

> Archive와 Historical Validation은 작성 당시의 조건과 결과를 보존한다.
> 현재 구현 상태 판단의 Source of Truth로 사용하지 않는다.
