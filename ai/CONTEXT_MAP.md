# SWfestival Context Map

목적: AI가 매 작업마다 전체 문서를 읽지 않고 현재 작업에 필요한 Source of Truth만 선택하도록 한다.

## 공통 시작점

모든 작업에서 우선 확인:

- `ai/RULES.md`
- `ai/WORKFLOW.md`
- `docs/README.md`

현재 상태 복구와 지도학습 작업에서는 추가로 다음을 우선 읽는다.

- `docs/modules/machine_learning/supervised/supervised_learning_rules.md`
- `docs/modules/machine_learning/supervised/archive/supervised_learning_area_rollout_plan.md`
- `docs/modules/machine_learning/supervised/supervised_character_pool.md`
- `docs/shared/maps/map_plaza_park_spec.md`
- `docs/archive/session_handoff_plaza_park_2026-09-14.md`

사용자가 직접 지정한 문서가 있다면 그 문서를 우선한다.
확정된 사항은 이유 없이 다시 논의하거나 변경하지 않는다.
미확정 사항은 검토 → 사용자 승인 → 구현 순서로 진행한다.

## 문서 상태 구분

```text
docs/ root                         = Current Source of Truth
docs/reference/                    = 보조 참고자료
docs/validation/general/           = 일반 역사적 검증
docs/validation/plaza_park_v1/     = Traffic v1 역사적 검증
docs/validation/plaza_park_v2/     = Navigation v2 개발 단계별 검증
docs/archive/                      = 완료·대체 문서
ai/tasks/archive/                  = 완료된 작업 prompt
```

Archive와 historical validation은 작성 당시의 상태를 보존한다.
현재 구현 상태 판단의 Source of Truth로 선택하지 않는다.
특히 `docs/validation/plaza_park_v2/plaza_park_cctv_manual_labeling_validation.md`는 old CCTV1/CCTV2의 2-camera baseline이며 current `PLAZA_CAM_A~E` profile이 아니다.

## Scale / Graphics / Character 작업

기본 읽기:

- `docs/shared/technical/ml_prototype_technical_requirements.md`
- `docs/shared/graphics/graphics_character_asset_spec.md`

Character 이미지 생성·정리 작업이면 추가:

- `ai/skills/character_asset/01_species_master_reference_prompt.md`
- `ai/skills/character_asset/02_master_reference_refinement_prompt.md`
- `ai/skills/character_asset/03_game_ready_sheet_prompt.md`
- `ai/skills/character_asset/04_directional_crop_prompt.md`
- `ai/skills/character_asset/05_character_asset_validation_and_file_management.md`

Scale 검증 작업이면 추가:

- `docs/shared/maps/map_scale_validation_spec.md`
- `docs/validation/general/scale_validation_results.md`
- 필요 시 `docs/validation/general/corridor_capacity_results.md`

## Map / Level 작업

기본 읽기:

- `docs/shared/technical/ml_prototype_technical_requirements.md`
- `docs/shared/graphics/graphics_character_asset_spec.md`
- `docs/reference/map_visual_reference.md`
- `docs/shared/maps/map_scale_validation_spec.md`

대상 Map에 따라 해당 Spec만 추가한다.

- Plaza/Park: `docs/shared/maps/map_plaza_park_spec.md`
- Shopping District: `docs/shared/maps/map_shopping_district_spec.md`
- Residential: `docs/shared/maps/map_residential_spec.md`

Plaza/Park Navigation 작업이면 추가:

- `docs/shared/maps/plaza_park_navigation_v2_spec.md`
- 현재 validation: `docs/validation/plaza_park_v2/`

Map 작업이 CCTV, Tracking 또는 행동 규칙과 연결되면
`docs/modules/machine_learning/supervised/supervised_learning_rules.md`를 추가한다.

## 지도학습 구현

읽기:

- `docs/archive/session_handoff_plaza_park_2026-09-14.md`
- `docs/modules/machine_learning/supervised/supervised_learning_rules.md`
- `docs/modules/machine_learning/supervised/archive/supervised_learning_area_rollout_plan.md`
- `docs/modules/machine_learning/supervised/supervised_character_pool.md`
- `docs/shared/maps/map_plaza_park_spec.md`
- `docs/shared/technical/ml_prototype_technical_requirements.md`

Target full-game architecture의 global ID는 `CCTV1/CCTV2 = Plaza/Park`, `CCTV3/CCTV4 = Shopping`, `CCTV5 = Residential`이다. Current playable prototype은 이 namespace를 사용하지 않고 `PLAZA_CAM_A~E`를 사용한다.

현재 next step은 35-NPC Round 1/Round 2 Scenario Assignment audit/design이다. Round 1/2는 각각 28 Citizen / 7 Villain이고, Round 1 manual-label target은 약 8 distinct Characters다.
Traffic density 추가 탐색이나 Navigation topology 변경을 기본 next step으로 선택하지 않는다.

## 비지도학습 구현

읽기:

- `docs/shared/technical/ml_prototype_technical_requirements.md`
- `docs/shared/graphics/graphics_character_asset_spec.md`
- `docs/modules/machine_learning/unsupervised/concept_rules.md`

지도학습 Character/Map asset을 재사용할 때 필요한 관련 문서만 추가한다.

## 강화학습 구현

읽기:

- `docs/shared/technical/ml_prototype_technical_requirements.md`
- `docs/shared/graphics/graphics_character_asset_spec.md`
- `docs/modules/machine_learning/reinforcement/concept_rules.md`

강화학습용 건물·Route Graph 문서가 실제로 생성된 뒤 해당 문서를 추가한다.

## 공통 Architecture 변경

읽기:

- `README.md`
- `docs/README.md`
- `docs/shared/technical/ml_prototype_technical_requirements.md`
- 관련 학습 규칙, 구현 및 검증 문서

현재 프로젝트에 존재하지 않는 문서명을 전제로 작업하지 않는다.

## Decision 기록

현재 별도 `docs/DECISION_LOG.md`를 Source of Truth로 사용하지 않는다.

향후 도입한다면 중요한 설계 변경, 기존 확정사항의 변경 이유와 대안 비교만 기록하고,
세부 규격은 각 전용 Spec에 유지한다.
