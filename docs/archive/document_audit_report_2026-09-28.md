# SWfestival docs/ Document Audit Report

**Generated:** 2026-09-28
**Scope:** READ-ONLY Audit — 기존 파일 무수정, 이 파일만 신규 생성
**Auditor:** Antigravity IDE

---

## 1. Executive Summary

### 현재 핵심 문제

| # | 문제 | 영향 |
|---|---|---|
| 1 | **Source of Truth 불명확** | `session_handoff_current.md`와 `swfestival_project_state_current.md`가 현재 상태를 동시에 기술. 어느 것이 최신 기준인지 즉시 구분 불가. |
| 2 | **학습 모듈 문서가 최상위에 혼재** | `supervised_learning_rules.md`, `unsupervised_learning_rules.md`, `reinforcement_learning_rules.md`가 map spec, validation, handoff와 같은 depth에 나열됨. |
| 3 | **AI Basics 세션 handoff가 문서 체계에 통합되지 않음** | `swfestival_ai_basics_session_handoff.md`는 다음 모듈 handoff이지만 `session_handoff_current.md`는 Plaza/Park 기준으로 남아 있어 어느 것이 '현재' handoff인지 혼란. |
| 4 | **Raw JSON 4개가 docs/ 루트에 위치** | validation 결과 JSON이 spec·design·handoff 문서와 같은 depth에 있어 문서와 측정 데이터가 구분되지 않음. |
| 5 | **validation/plaza_park_v1 vs v2의 명칭** | `plaza_park_limited_validation_v2_results.md`의 'v2'는 Map v2가 아니라 iteration 이름인데, 혼동 가능. |

### 권장 정리 방향

1. `docs/project/` 로 project-level 공통 문서 이동
2. `docs/modules/machine_learning/supervised|unsupervised|reinforcement/` 구조 확립
3. `docs/modules/ai_basics/` 추가 (다음 구현 모듈)
4. `docs/shared/` 로 map spec, graphics spec 이동
5. Raw JSON 4개 → `docs/archive/raw_measurements/` 이동
6. `session_handoff_current.md` ARCHIVE 처리 (plaza/park 기준), AI Basics handoff를 현재 handoff로 명확화

---

## 2. Current Documentation Model

```
docs/
├── README.md
├── swfestival_project_state_current.md
├── swfestival_module_registry.md
├── swfestival_module_contract.md
├── swfestival_module_spec_template.md
├── swfestival_working_rules.md
├── session_handoff_current.md         ← plaza/park 기준 (2026-09-14)
├── swfestival_ai_basics_session_handoff.md  ← 다음 세션 handoff
│
├── supervised_learning_rules.md
├── unsupervised_learning_rules.md
├── reinforcement_learning_rules.md
├── supervised_learning_area_rollout_plan.md
├── supervised_character_pool.md
│
├── ml_prototype_technical_requirements.md
│
├── map_plaza_park_spec.md
├── map_shopping_district_spec.md
├── map_residential_spec.md
├── map_scale_validation_spec.md
├── plaza_park_navigation_v2_spec.md
├── graphics_character_asset_spec.md
├── plaza_park_environment_asset_spec.md
│
├── plaza_park_deadlock_fix3_120s.json     ← Raw JSON
├── plaza_park_deadlock_fix4_120s.json     ← Raw JSON
├── plaza_park_limited_fallback_120s.json  ← Raw JSON
├── plaza_park_limited_v2_120s.json        ← Raw JSON
│
├── validation/
│   ├── general/
│   │   ├── scale_validation_results.md
│   │   ├── corridor_capacity_results.md
│   │   └── map_coordinate_audit.md
│   ├── plaza_park_v1/   (Traffic v1 — FAIL 또는 PASS with WARN)
│   │   ├── plaza_park_graybox_results.md
│   │   ├── plaza_park_large_clearance_limited_npc_results.md
│   │   ├── plaza_park_limited_validation_v2_results.md
│   │   ├── plaza_park_deadlock_fix4_results.md
│   │   ├── plaza_park_candidate_route_validation_results.md
│   │   ├── plaza_park_full_flow_35_results.md
│   │   ├── plaza_park_full_flow_30_results.md
│   │   └── plaza_park_graphics_integration_report.md
│   └── plaza_park_v2/   (Navigation v2 — current)
│       ├── plaza_park_navigation_v2_validation_results.md
│       ├── plaza_park_supervised_concurrency_validation.md
│       ├── plaza_park_lane_runtime_validation.md
│       ├── plaza_park_junction_stop_reservation_validation.md
│       ├── plaza_park_cctv_manual_labeling_validation.md
│       └── plaza_park_round1_foundation_validation.md
│
├── reference/
│   ├── map_visual_reference.md
│   ├── plaza_park_environment_graphics_integration_spec.md
│   └── plaza_park_full_flow_validation_spec.md
│
└── archive/
    ├── README_APPLY.md
    ├── plaza_park_npc_traffic_known_issue.md
    └── plaza_park_environment_graphics_start.md
```

**총 파일 수:** 41개 (MD 37 + JSON 4)

---

## 3. Inventory

| File | Type | Currentness | Decision |
|---|---|---|---|
| `README.md` | docs index | CURRENT | KEEP_CURRENT |
| `swfestival_project_state_current.md` | project state | CURRENT | KEEP_CURRENT |
| `swfestival_module_registry.md` | module rule | CURRENT | KEEP_CURRENT |
| `swfestival_module_contract.md` | design rule | CURRENT | KEEP_CURRENT |
| `swfestival_module_spec_template.md` | template | CURRENT | KEEP_CURRENT |
| `swfestival_working_rules.md` | design rule | CURRENT | KEEP_CURRENT |
| `swfestival_ai_basics_session_handoff.md` | handoff (next) | CURRENT | KEEP_CURRENT |
| `session_handoff_current.md` | handoff (plaza/park) | LEGACY | ARCHIVE |
| `supervised_learning_rules.md` | module rule | CURRENT | KEEP_CURRENT |
| `unsupervised_learning_rules.md` | module rule | CURRENT | KEEP_CURRENT |
| `reinforcement_learning_rules.md` | module rule | CURRENT | KEEP_CURRENT |
| `supervised_learning_area_rollout_plan.md` | plan | CURRENT (Phase C 진행중) | KEEP_CURRENT |
| `supervised_character_pool.md` | current spec | CURRENT | KEEP_CURRENT |
| `ml_prototype_technical_requirements.md` | current spec | CURRENT | KEEP_CURRENT |
| `map_plaza_park_spec.md` | current spec (frozen) | CURRENT | KEEP_CURRENT |
| `map_shopping_district_spec.md` | current spec (미구현) | CURRENT | KEEP_CURRENT |
| `map_residential_spec.md` | current spec (미구현) | CURRENT | KEEP_CURRENT |
| `map_scale_validation_spec.md` | design rule | CURRENT | KEEP_CURRENT |
| `plaza_park_navigation_v2_spec.md` | current spec (frozen) | CURRENT | KEEP_CURRENT |
| `graphics_character_asset_spec.md` | current spec | CURRENT | KEEP_CURRENT |
| `plaza_park_environment_asset_spec.md` | current spec | CURRENT | KEEP_CURRENT |
| `plaza_park_deadlock_fix3_120s.json` | raw experiment | EVIDENCE | ARCHIVE |
| `plaza_park_deadlock_fix4_120s.json` | raw experiment | EVIDENCE | ARCHIVE |
| `plaza_park_limited_fallback_120s.json` | raw experiment | EVIDENCE | ARCHIVE |
| `plaza_park_limited_v2_120s.json` | raw experiment | EVIDENCE | ARCHIVE |
| `validation/general/scale_validation_results.md` | validation result | EVIDENCE | KEEP_CURRENT |
| `validation/general/corridor_capacity_results.md` | validation result | EVIDENCE | KEEP_CURRENT |
| `validation/general/map_coordinate_audit.md` | validation result | EVIDENCE | KEEP_CURRENT |
| `validation/plaza_park_v1/plaza_park_graybox_results.md` | validation result | EVIDENCE (v1 역사) | ARCHIVE |
| `validation/plaza_park_v1/plaza_park_large_clearance_limited_npc_results.md` | validation result | EVIDENCE (Nav v2 근거) | KEEP_CURRENT |
| `validation/plaza_park_v1/plaza_park_limited_validation_v2_results.md` | validation result | EVIDENCE (Nav v2 근거) | KEEP_CURRENT |
| `validation/plaza_park_v1/plaza_park_deadlock_fix4_results.md` | validation result | EVIDENCE | KEEP_CURRENT |
| `validation/plaza_park_v1/plaza_park_candidate_route_validation_results.md` | validation result | EVIDENCE (v1 전용) | ARCHIVE |
| `validation/plaza_park_v1/plaza_park_full_flow_35_results.md` | validation result | EVIDENCE (Nav v2 핵심 근거) | KEEP_CURRENT |
| `validation/plaza_park_v1/plaza_park_full_flow_30_results.md` | validation result | EVIDENCE (보조) | ARCHIVE |
| `validation/plaza_park_v1/plaza_park_graphics_integration_report.md` | validation result | EVIDENCE (완료) | ARCHIVE |
| `validation/plaza_park_v2/plaza_park_navigation_v2_validation_results.md` | validation result | EVIDENCE | KEEP_CURRENT |
| `validation/plaza_park_v2/plaza_park_supervised_concurrency_validation.md` | validation result | EVIDENCE (두-way lane 근거) | KEEP_CURRENT |
| `validation/plaza_park_v2/plaza_park_lane_runtime_validation.md` | validation result | EVIDENCE (junction fix 근거) | KEEP_CURRENT |
| `validation/plaza_park_v2/plaza_park_junction_stop_reservation_validation.md` | validation result | CURRENT (최종 검증) | KEEP_CURRENT |
| `validation/plaza_park_v2/plaza_park_cctv_manual_labeling_validation.md` | validation result | EVIDENCE (2-camera baseline) | KEEP_CURRENT |
| `validation/plaza_park_v2/plaza_park_round1_foundation_validation.md` | validation result | CURRENT (최신) | KEEP_CURRENT |
| `reference/map_visual_reference.md` | reference | CURRENT | KEEP_CURRENT |
| `reference/plaza_park_environment_graphics_integration_spec.md` | reference | EVIDENCE (완료) | KEEP_CURRENT |
| `reference/plaza_park_full_flow_validation_spec.md` | reference | EVIDENCE | KEEP_CURRENT |
| `archive/README_APPLY.md` | archive | LEGACY | ARCHIVE |
| `archive/plaza_park_npc_traffic_known_issue.md` | archive | EVIDENCE | ARCHIVE |
| `archive/plaza_park_environment_graphics_start.md` | archive | LEGACY | ARCHIVE |

---

## 4. Source of Truth Map

| Topic | Current SoT | Supporting | Legacy/Evidence | Conflict |
|---|---|---|---|---|
| **Project state** | `swfestival_project_state_current.md` | `swfestival_module_registry.md` | `session_handoff_current.md` | docs/README가 session_handoff를 "현재"로 링크 → UNKNOWN-1 |
| **Module architecture** | `swfestival_module_contract.md` + `swfestival_module_spec_template.md` | `swfestival_working_rules.md` | — | 없음 |
| **Supervised learning** | `supervised_learning_rules.md` | `supervised_character_pool.md`, `supervised_learning_area_rollout_plan.md` | — | 없음 |
| **Unsupervised learning** | `unsupervised_learning_rules.md` | — | — | 없음 |
| **Reinforcement learning** | `reinforcement_learning_rules.md` | — | — | 없음 |
| **Plaza/Park map** | `map_plaza_park_spec.md` + `public/maps/plaza-park-v2.tmj` | `plaza_park_navigation_v2_spec.md` | `validation/plaza_park_v1/*` | 없음 |
| **Navigation v2** | `plaza_park_navigation_v2_spec.md` + TMJ | `plaza_park_junction_stop_reservation_validation.md` | `plaza_park_v1/*` | 없음 |
| **Character assets** | `graphics_character_asset_spec.md` | `map_scale_validation_spec.md` | — | 없음 |
| **Technical requirements** | `ml_prototype_technical_requirements.md` | `map_scale_validation_spec.md`, `validation/general/*` | — | 없음 |
| **Validation (current)** | `plaza_park_round1_foundation_validation.md` | `plaza_park_junction_stop_reservation_validation.md` | `plaza_park_v1/*` | 없음 |
| **Session handoff** | `swfestival_ai_basics_session_handoff.md` (다음 세션 기준) | `swfestival_project_state_current.md` | `session_handoff_current.md` (plaza/park) | 명칭 충돌 → UNKNOWN-1 |

---

## 5. KEEP_CURRENT (이유 상세)

### 핵심 설계 문서 (project-level)
- `swfestival_project_state_current.md` — 전체 프로젝트 상태 SoT. `swfestival_ai_basics_session_handoff.md`에서 직접 참조.
- `swfestival_module_registry.md` — 전체 학습 모듈 ID·route·상태 단일 기준. 코드 구현 시 route 확정의 근거.
- `swfestival_module_contract.md`, `swfestival_module_spec_template.md`, `swfestival_working_rules.md` — 새 모듈 설계·작업 공통 기준.
- `swfestival_ai_basics_session_handoff.md` — 다음 세션(AI Basics) 작업 handoff. 다음 구현 시작점.

### 학습 모듈 규칙
- `supervised/unsupervised/reinforcement_learning_rules.md` — 각 모듈 gameplay·state 전체 규칙. 구현 기준.
- `supervised_learning_area_rollout_plan.md` — Phase A~G 진행 현황 및 다음 Phase C 기준.
- `supervised_character_pool.md` — 35 Character Pool SoT. identity/round 구조 포함.

### 기술 / Map / Graphics
- `ml_prototype_technical_requirements.md` — 기술 스택(React+Phaser4), 플랫폼, 성능, Map 기술 기준 전체.
- `map_plaza_park_spec.md` — Plaza/Park frozen SoT. 6개 이상 문서에서 참조.
- `map_shopping_district_spec.md`, `map_residential_spec.md` — 미구현 Map SoT.
- `map_scale_validation_spec.md`, `plaza_park_navigation_v2_spec.md` — 각각 Scale 기준, Nav v2 SoT.
- `graphics_character_asset_spec.md`, `plaza_park_environment_asset_spec.md` — Asset 제작 SoT.

### Validation (현재 기준 및 핵심 근거)
- `validation/general/*` — Scale·Corridor·좌표 감사 결과. ml_requirements에서 참조.
- `plaza_park_large_clearance_limited_npc_results.md` — Large Species 실패 + 10 NPC 교착 확인 → Nav v2 필요성 근거.
- `plaza_park_limited_validation_v2_results.md` — Traffic v1 최종 FAIL 확인.
- `plaza_park_deadlock_fix4_results.md` — Fix4 PASS with WARN → Traffic v1 최선 결과.
- `plaza_park_full_flow_35_results.md` — 35 NPC Full Flow FAIL → Nav v2 전환 핵심 근거.
- `plaza_park_v2/*` (6개) — Nav v2 개발 이력 전체 및 현재 최종 검증.

### Reference
- `reference/map_visual_reference.md`, `plaza_park_environment_graphics_integration_spec.md`, `plaza_park_full_flow_validation_spec.md` — 맵 시각 원칙, Graphics 통합 절차, Historical+Nav v2 기준 보존.

---

## 6. MERGE

### MERGE 후보 1: session_handoff_current.md

```
Action: 고유 정보를 archive로 이동 후 원본 파일 archive 처리
Archive 이름: archive/session_handoff_plaza_park_2026-09-14.md

session_handoff_current.md만 갖는 고유 정보:
  - WARN 상세 수치 (15-NPC maxContinuousNoProgressSeconds 0.95s 등)
  - 2-camera CCTV1/2 MANUAL_LABELING 구현 상세
  - Round 1 runtime 원칙 상세

중복되는 정보 (다른 문서로 대체 가능):
  - 현재 프로젝트 상태 → swfestival_project_state_current.md
  - Map frozen 정보 → map_plaza_park_spec.md
  - validation 참조 → validation/plaza_park_v2/ 문서들

주의: ai/CONTEXT_MAP.md, root/README.md, ai/tasks/archive 5개 파일이 참조 중.
이동 시 해당 파일들의 참조 경로 업데이트 필수.
```

---

## 7. ARCHIVE (이유 상세)

| 파일 | Archive 이유 | 보존 가치 |
|---|---|---|
| `session_handoff_current.md` | Plaza/Park 완료 시점 handoff. `project_state_current.md`와 `ai_basics_session_handoff.md`가 현재 기능 대체. | WARN 수치, 2-camera 구현 상세 보유. |
| `plaza_park_deadlock_fix3_120s.json` | Fix3 측정값. `deadlock_fix4_results.md`에 핵심 수치 요약됨. | Fix3 vs Fix4 비교용 원본. |
| `plaza_park_deadlock_fix4_120s.json` | Fix4 측정값. `deadlock_fix4_results.md`에 요약됨. | 재현용 원본. scripts/measure-plaza-fix4.mjs 생성. |
| `plaza_park_limited_fallback_120s.json` | Limited v2 fallback 측정. `limited_validation_v2_results.md`에 요약. | Traffic v1 FAIL 재현 원본. |
| `plaza_park_limited_v2_120s.json` | Limited v2 policy 측정. `limited_validation_v2_results.md`에 요약. | Traffic v1 FAIL 재현 원본. |
| `plaza_park_v1/graybox_results.md` | Graybox 검증 완료 기록. 현재 v2 Map에 무관. | v1 Map Layer 구성 최초 검증 기록. |
| `plaza_park_v1/candidate_route_validation_results.md` | R6~R8 Traffic v1 route 검증. v1 전용. | Traffic v1 Route 구조 이해에 필요. |
| `plaza_park_v1/plaza_park_full_flow_30_results.md` | 30 NPC fallback FAIL. 35 FAIL의 보조 증거. | 35 NPC 결과와 함께 Nav v2 근거. |
| `plaza_park_v1/graphics_integration_report.md` | 완료된 Graphics Integration 보고서. | 완료 이력. Shopping/Residential 참고용. |
| `archive/README_APPLY.md` | Nav v2 documentation update 완료 절차. | 완료된 절차 기록. |
| `archive/plaza_park_npc_traffic_known_issue.md` | Traffic v1 실패 원인 분석. Nav v2 전환 배경. | 왜 Nav v2를 선택했는지 설명. |
| `archive/plaza_park_environment_graphics_start.md` | Graphics Integration 시작점. 완료됨. | 시작 조건, 절대 유지 항목 기록. |

---

## 8. DELETE_CANDIDATE

**없음.**

모든 파일을 실제 내용 독해 후 검토. 안전하게 DELETE할 수 있는 파일 없음.

- Raw JSON 4개: validation 문서에 수치 요약 있으나, route별 상세 원본 데이터는 별도 보유.
- plaza_park_full_flow_30_results.md: 35 FAIL의 보조 증거로 evidence 가치 보유.
- archive 파일: 역사적 판단 근거 보유.

---

## 9. UNKNOWN / User Decision Needed

### UNKNOWN-1: session_handoff_current.md의 "현재" 역할 충돌

```
상황:
  - session_handoff_current.md (2026-09-14): Plaza/Park 기준 handoff
  - swfestival_ai_basics_session_handoff.md: 다음 세션(AI Basics) handoff
  - docs/README.md L31, L44: session_handoff_current.md를 "현재 Session Handoff"로 링크

문제:
  - swfestival_project_state_current.md의 "다음 작업"은 AI Basics 모듈
  - 두 파일 중 어느 것이 현재 handoff인지 명확하지 않음

판단 필요:
  A. session_handoff_current.md를 archive로 이동하고
     docs/README.md의 "현재 Session Handoff" 링크를
     swfestival_ai_basics_session_handoff.md로 변경
  B. session_handoff_current.md를 유지하되 파일명을
     session_handoff_plaza_park.md로 변경하여 역할 명확화
```

### UNKNOWN-2: docs/README.md의 "CURRENT PROJECT STATE" 불일치

```
상황:
  - docs/README.md 내 "CURRENT PROJECT STATE":
    "FIRST_TRAINING verification interaction and Round 2 transition design"을 next로 제시
  - swfestival_project_state_current.md 섹션 3:
    "인공지능(AI) — AI가 무엇인지 이해하기"를 다음 작업으로 제시

판단 필요:
  docs/README.md 상단 현재 상태 섹션을
  swfestival_project_state_current.md 기준으로 업데이트할지
```

### UNKNOWN-3: plaza_park_limited_validation_v2_results.md의 'v2' 명칭

```
상황:
  - 파일명의 v2는 Map v2가 아니라 validation iteration v2
  - 문서 내부에 명시되어 있으나 파일명 단독으로 오해 가능

판단 필요:
  archive 이동 시 파일명 변경 여부
  (현재 단계에서는 rename 금지 — Migration 시 결정)
```

---

## 10. Duplicate / Conflict Map

### 중복 쌍 1: project state 이중화

| A | B | 판정 |
|---|---|---|
| `session_handoff_current.md` | `swfestival_project_state_current.md` | A는 ARCHIVE (WARN 수치 등 고유 정보 보존), B는 KEEP. |

### 중복 쌍 2: CharacterDefinition 구조 (의도적 중복)

| A | B | 판정 |
|---|---|---|
| `supervised_learning_rules.md` Section 26 | `supervised_character_pool.md` Section 8 | 동일 구조가 양 문서에 정의됨. 각 문서의 맥락에서 독자 참조 가능해야 하므로 MERGE 불필요. |

### 중복 쌍 3: Map 크기 중복 (의도적 중복)

| A | B | 판정 |
|---|---|---|
| `ml_prototype_technical_requirements.md` Section 6 | `supervised_learning_rules.md` Section 5.2 | 의도적 중복. 각 문서 독자 참조 가능. MERGE 불필요. |

### 충돌 1: "다음 작업" 불일치

```
docs/README.md → "FIRST_TRAINING verification interaction and Round 2 transition design"
swfestival_project_state_current.md → "인공지능(AI) — AI가 무엇인지 이해하기"
→ UNKNOWN-2 참조
```

---

## 11. Raw JSON / Validation Evidence Map

| Raw JSON | 생성 스크립트 | 대응 보고서 | 고유 정보 | Decision |
|---|---|---|---|---|
| `plaza_park_deadlock_fix3_120s.json` | `scripts/measure-plaza-fix3.mjs` | `plaza_park_deadlock_fix4_results.md` | route별 trips/arrivals/maxBlock | ARCHIVE → `archive/raw_measurements/` |
| `plaza_park_deadlock_fix4_120s.json` | `scripts/measure-plaza-fix4.mjs` | `plaza_park_deadlock_fix4_results.md` | Fix4 최종 수치 원본 | ARCHIVE → `archive/raw_measurements/` |
| `plaza_park_limited_fallback_120s.json` | `scripts/measure-plaza-limited.mjs` | `plaza_park_limited_validation_v2_results.md` | unrecovered_20sec: 7 등 | ARCHIVE → `archive/raw_measurements/` |
| `plaza_park_limited_v2_120s.json` | `scripts/measure-plaza-limited.mjs` | `plaza_park_limited_validation_v2_results.md` | completed_routes: 1 등 | ARCHIVE → `archive/raw_measurements/` |

**scripts 경로 주의:**
- `scripts/measure-plaza-fix3.mjs` L7: output을 `docs/plaza_park_deadlock_fix3_120s.json`으로 하드코딩
- `scripts/measure-plaza-fix4.mjs` L7: output을 `docs/plaza_park_deadlock_fix4_120s.json`으로 하드코딩
- `scripts/measure-plaza-limited.mjs` L7: `docs/plaza_park_limited_{policy}_120s.json` 패턴

JSON archive 이동 시 스크립트 output 경로 업데이트 또는 스크립트를 archive와 함께 보존할지 결정 필요.

**코드(src/, tests/) → docs 직접 참조: 없음.** src/ 및 tests/는 docs/ 경로를 직접 참조하지 않음.

---

## 12. Proposed Final Directory Tree

```
docs/
│
├── README.md                          ← 전체 docs index (재작성 필요)
│
├── project/                           ← 프로젝트 공통 문서
│   ├── project_state_current.md       ← (from swfestival_project_state_current.md)
│   ├── module_registry.md             ← (from swfestival_module_registry.md)
│   ├── module_contract.md             ← (from swfestival_module_contract.md)
│   ├── module_spec_template.md        ← (from swfestival_module_spec_template.md)
│   └── working_rules.md              ← (from swfestival_working_rules.md)
│
├── modules/
│   ├── ai_basics/
│   │   └── ai_basics_session_handoff.md
│   │       [향후: ai_basics_spec.md 추가]
│   │
│   └── machine_learning/              ← 지도/비지도/강화 상위 (반드시 ML 하위)
│       ├── supervised/
│       │   ├── supervised_learning_rules.md
│       │   ├── supervised_learning_area_rollout_plan.md
│       │   └── supervised_character_pool.md
│       ├── unsupervised/
│       │   └── unsupervised_learning_rules.md
│       └── reinforcement/
│           └── reinforcement_learning_rules.md
│
├── shared/
│   ├── technical/
│   │   └── ml_prototype_technical_requirements.md
│   ├── maps/
│   │   ├── map_plaza_park_spec.md
│   │   ├── map_shopping_district_spec.md
│   │   ├── map_residential_spec.md
│   │   ├── map_scale_validation_spec.md
│   │   └── plaza_park_navigation_v2_spec.md
│   └── graphics/
│       ├── graphics_character_asset_spec.md
│       └── plaza_park_environment_asset_spec.md
│
├── validation/                        ← 구조 유지
│   ├── general/
│   │   ├── scale_validation_results.md
│   │   ├── corridor_capacity_results.md
│   │   └── map_coordinate_audit.md
│   ├── plaza_park_v1/              ← Traffic v1 핵심 근거 보존
│   │   ├── plaza_park_large_clearance_limited_npc_results.md
│   │   ├── plaza_park_limited_validation_v2_results.md
│   │   ├── plaza_park_deadlock_fix4_results.md
│   │   └── plaza_park_full_flow_35_results.md
│   └── plaza_park_v2/              ← Navigation v2 current
│       ├── plaza_park_navigation_v2_validation_results.md
│       ├── plaza_park_supervised_concurrency_validation.md
│       ├── plaza_park_lane_runtime_validation.md
│       ├── plaza_park_junction_stop_reservation_validation.md
│       ├── plaza_park_cctv_manual_labeling_validation.md
│       └── plaza_park_round1_foundation_validation.md
│
├── reference/                         ← 구조 유지
│   ├── map_visual_reference.md
│   ├── plaza_park_environment_graphics_integration_spec.md
│   └── plaza_park_full_flow_validation_spec.md
│
└── archive/
    ├── session_handoff_plaza_park_2026-09-14.md  ← (from session_handoff_current.md)
    ├── README_APPLY.md
    ├── plaza_park_npc_traffic_known_issue.md
    ├── plaza_park_environment_graphics_start.md
    ├── raw_measurements/
    │   ├── plaza_park_deadlock_fix3_120s.json
    │   ├── plaza_park_deadlock_fix4_120s.json
    │   ├── plaza_park_limited_fallback_120s.json
    │   └── plaza_park_limited_v2_120s.json
    └── validation_evidence/           ← (선택 이동)
        ├── plaza_park_graybox_results.md
        ├── plaza_park_candidate_route_validation_results.md
        ├── plaza_park_full_flow_30_results.md
        └── plaza_park_graphics_integration_report.md
```

> **중요:** `supervised/`, `unsupervised/`, `reinforcement/`는 반드시 `machine_learning/` 하위 모듈로 배치.
> 세 모듈이 docs 최상위에 독립 디렉터리로 나오면 안 됨.

---

## 13. Path / Reference Migration Map

### 고위험 참조 (이동 시 반드시 업데이트)

| Old Path | New Path | 영향 파일 |
|---|---|---|
| `docs/session_handoff_current.md` | `docs/archive/session_handoff_plaza_park_2026-09-14.md` | `docs/README.md` (L31, L44), `README.md` (L111, L372), `ai/CONTEXT_MAP.md` (L19, L89), `ai/tasks/archive/*` 5개 |
| `docs/swfestival_project_state_current.md` | `docs/project/project_state_current.md` | `swfestival_ai_basics_session_handoff.md` |
| `docs/swfestival_module_registry.md` | `docs/project/module_registry.md` | `swfestival_ai_basics_session_handoff.md` |
| `docs/swfestival_module_contract.md` | `docs/project/module_contract.md` | `swfestival_ai_basics_session_handoff.md` |
| `docs/swfestival_working_rules.md` | `docs/project/working_rules.md` | `swfestival_ai_basics_session_handoff.md` |
| `docs/swfestival_ai_basics_session_handoff.md` | `docs/modules/ai_basics/ai_basics_session_handoff.md` | `docs/README.md` |
| `docs/supervised_learning_rules.md` | `docs/modules/machine_learning/supervised/supervised_learning_rules.md` | `docs/README.md` (L27, L37) |
| `docs/unsupervised_learning_rules.md` | `docs/modules/machine_learning/unsupervised/unsupervised_learning_rules.md` | `docs/README.md` (L38) |
| `docs/reinforcement_learning_rules.md` | `docs/modules/machine_learning/reinforcement/reinforcement_learning_rules.md` | `docs/README.md` (L39) |
| `docs/supervised_learning_area_rollout_plan.md` | `docs/modules/machine_learning/supervised/supervised_learning_area_rollout_plan.md` | `docs/README.md` (L28, L43) |
| `docs/supervised_character_pool.md` | `docs/modules/machine_learning/supervised/supervised_character_pool.md` | `docs/README.md` (L29, L48) |
| `docs/ml_prototype_technical_requirements.md` | `docs/shared/technical/ml_prototype_technical_requirements.md` | `docs/README.md` (L52), 내부 교차 참조 |
| `docs/map_plaza_park_spec.md` | `docs/shared/maps/map_plaza_park_spec.md` | `supervised_learning_rules.md`, `graphics_character_asset_spec.md`, `ml_requirements.md`, `validation/*` 다수 |
| `docs/map_shopping_district_spec.md` | `docs/shared/maps/map_shopping_district_spec.md` | `supervised_learning_rules.md`, `graphics_character_asset_spec.md` |
| `docs/map_residential_spec.md` | `docs/shared/maps/map_residential_spec.md` | `supervised_learning_rules.md`, `graphics_character_asset_spec.md` |
| `docs/map_scale_validation_spec.md` | `docs/shared/maps/map_scale_validation_spec.md` | `ml_requirements.md`, `scale_validation_results.md` |
| `docs/plaza_park_navigation_v2_spec.md` | `docs/shared/maps/plaza_park_navigation_v2_spec.md` | `validation/plaza_park_v2/nav_v2_validation_results.md`, `reference/full_flow_validation_spec.md` |
| `docs/graphics_character_asset_spec.md` | `docs/shared/graphics/graphics_character_asset_spec.md` | `docs/README.md` |
| `docs/plaza_park_environment_asset_spec.md` | `docs/shared/graphics/plaza_park_environment_asset_spec.md` | `docs/README.md` |
| `docs/*.json` (4개) | `docs/archive/raw_measurements/*.json` | `scripts/measure-plaza-*.mjs` (output 경로) |

**코드(src/, tests/) → docs 직접 참조: 없음.** 빌드/테스트에는 영향 없음.

---

## 14. README Index Proposal

정리 후 `docs/README.md` 역할:

```markdown
# SWfestival Documentation Index

## 현재 프로젝트 상태
→ project/project_state_current.md

## 전체 모듈 상태
→ project/module_registry.md

## 현재 작업 중인 모듈
→ modules/ai_basics/ai_basics_session_handoff.md

## 모듈별 상세 문서

### 머신러닝 > 지도학습
→ modules/machine_learning/supervised/supervised_learning_rules.md
→ modules/machine_learning/supervised/supervised_learning_area_rollout_plan.md
→ modules/machine_learning/supervised/supervised_character_pool.md

### 머신러닝 > 비지도학습
→ modules/machine_learning/unsupervised/unsupervised_learning_rules.md

### 머신러닝 > 강화학습
→ modules/machine_learning/reinforcement/reinforcement_learning_rules.md

## 공통 기술 / Map / Graphics
→ shared/technical/ml_prototype_technical_requirements.md
→ shared/maps/map_plaza_park_spec.md  (frozen)
→ shared/graphics/graphics_character_asset_spec.md

## 검증 결과
→ validation/plaza_park_v2/plaza_park_round1_foundation_validation.md (현재 기준)
→ validation/ (전체 이력)

## 참조
→ reference/map_visual_reference.md

## 아카이브
→ archive/ (과거 실험, 완료 기록, raw 측정 데이터)
```

---

## 15. Migration Plan

**전제:** 아래는 사용자 승인 후 실행하는 작업 순서다. 현재 단계에서는 실행하지 않는다.

```
Step 1. Git status 확인 — clean working tree 확인

Step 2. 새 directory 생성:
  docs/project/
  docs/modules/ai_basics/
  docs/modules/machine_learning/supervised/
  docs/modules/machine_learning/unsupervised/
  docs/modules/machine_learning/reinforcement/
  docs/shared/technical/
  docs/shared/maps/
  docs/shared/graphics/
  docs/archive/raw_measurements/
  docs/archive/validation_evidence/  (선택)

Step 3. KEEP_CURRENT 문서 이동 (git mv):
  swfestival_project_state_current.md → project/project_state_current.md
  swfestival_module_registry.md → project/module_registry.md
  swfestival_module_contract.md → project/module_contract.md
  swfestival_module_spec_template.md → project/module_spec_template.md
  swfestival_working_rules.md → project/working_rules.md
  swfestival_ai_basics_session_handoff.md → modules/ai_basics/ai_basics_session_handoff.md
  supervised_learning_rules.md → modules/machine_learning/supervised/
  unsupervised_learning_rules.md → modules/machine_learning/unsupervised/
  reinforcement_learning_rules.md → modules/machine_learning/reinforcement/
  supervised_learning_area_rollout_plan.md → modules/machine_learning/supervised/
  supervised_character_pool.md → modules/machine_learning/supervised/
  ml_prototype_technical_requirements.md → shared/technical/
  map_plaza_park_spec.md → shared/maps/
  map_shopping_district_spec.md → shared/maps/
  map_residential_spec.md → shared/maps/
  map_scale_validation_spec.md → shared/maps/
  plaza_park_navigation_v2_spec.md → shared/maps/
  graphics_character_asset_spec.md → shared/graphics/
  plaza_park_environment_asset_spec.md → shared/graphics/

Step 4. ARCHIVE 이동 (git mv):
  session_handoff_current.md → archive/session_handoff_plaza_park_2026-09-14.md
  plaza_park_deadlock_fix3_120s.json → archive/raw_measurements/
  plaza_park_deadlock_fix4_120s.json → archive/raw_measurements/
  plaza_park_limited_fallback_120s.json → archive/raw_measurements/
  plaza_park_limited_v2_120s.json → archive/raw_measurements/
  (선택) validation/plaza_park_v1/ 4개 → archive/validation_evidence/

Step 5. 내부 링크 / 참조 업데이트:
  docs/README.md 전체 링크 업데이트 (섹션 14 기준으로 재작성)
  root/README.md: session_handoff_current.md 참조 업데이트
  ai/CONTEXT_MAP.md: session_handoff_current.md 참조 업데이트
  supervised_learning_rules.md 내 docs/ 경로 업데이트
  graphics_character_asset_spec.md 내 docs/ 경로 업데이트
  ml_prototype_technical_requirements.md 내 docs/ 경로 업데이트
  swfestival_ai_basics_session_handoff.md 내 참조 업데이트
  validation/plaza_park_v2/*.md 내 docs/ 경로 업데이트

Step 6. scripts 경로 판단:
  scripts/measure-plaza-*.mjs output JSON 경로를
  archive/raw_measurements/로 업데이트 또는 스크립트 archive 이동

Step 7. docs/README.md 재작성:
  섹션 14 (README Index Proposal) 기준으로 재작성

Step 8. 잔재 확인:
  git grep -r "swfestival_project_state_current" docs/
  git grep -r "session_handoff_current" .
  git grep -r "docs/supervised_learning_rules" docs/
  (각 이동 경로에 대해 반복)

Step 9. UNKNOWN-2 해결:
  docs/README.md "CURRENT PROJECT STATE" 섹션을
  swfestival_project_state_current.md 기준으로 업데이트

Step 10. npm run typecheck && npm test 확인:
  src/는 docs/ 직접 참조 없으므로 코드 빌드 영향 없음
  validation 스크립트(scripts/)의 JSON output 경로만 확인 필요

Step 11. 브라우저 smoke test (선택):
  npm run dev → 기존 지도학습 기능 regression 없음 확인

Step 12. DELETE_CANDIDATE 재확인:
  archive 이동 후 모든 참조 정리됐는지 재검토

Step 13. 사용자 승인 후 Git commit:
  git add -A
  git commit -m "docs: restructure — project/, modules/machine_learning/, shared/, archive/"

Step 14. (선택) UNKNOWN-3 판단:
  archive/validation_evidence/plaza_park_limited_validation_v2_results.md
  rename 여부 결정

Step 15. 이 audit report 보존:
  migration 완료 후 docs/project/ 또는 archive/로 이동 가능
```

---

## 자체 검증 체크리스트

- [x] docs 파일 41개(MD 37 + JSON 4) 모두 Inventory에 포함
- [x] 파일명만 보고 판단한 항목 없음 — 전 파일 실제 내용 독해
- [x] DELETE_CANDIDATE에 불확실한 파일 없음 — 모두 ARCHIVE 또는 KEEP
- [x] 지도학습/비지도학습/강화학습이 `machine_learning/` 하위로 분류됨 (Section 12)
- [x] Raw JSON 4개를 무조건 삭제 대상으로 두지 않음 — ARCHIVE
- [x] current와 historical evidence를 구분함 (Section 4 SoT Map 참조)
- [x] Path reference 영향 조사됨 (Section 13 Migration Map)
- [x] 코드(src/, tests/)가 docs/를 직접 참조하지 않음 확인
- [x] scripts/ → docs/ JSON 경로 3개 하드코딩 식별됨 (Section 11)
