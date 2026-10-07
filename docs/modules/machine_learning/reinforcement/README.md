# Reinforcement Learning Module — File Guide

이 디렉터리는 SWfestival 강화학습 모듈의 **제품/게임 설계, Learning Engine, Navigation, Runtime Map, 세션 인수인계, 검증 기록**을 관리한다.

## 현재 상태 요약

- Module: `DESIGNING`
- Learning Engine v1.2: `APPROVED_FOR_INTEGRATION`
- Navigation Logic v1: `LOGIC_APPROVED`
- `navigation_graph_v1.json`: `GENERATED_AND_VALIDATED`
- Floor 1 Tiled/Phaser Runtime Structure: `STRUCTURE_PLAYTEST_APPROVED`
- Floor 2~5 Tiled: `NOT_IMPLEMENTED`
- `navigation_v2`: `REFERENCE_ONLY / SUPERSEDED_FOR_RUNTIME`
- 현재 다음 작업: **1F visual implementation → final visual playtest → 2F~5F Tiled 확장**

---

## 현재 Active 문서

### `module_spec_v3.md`
강화학습 모듈의 **제품/게임 설계 기준 문서**.

포함 내용:
- Story와 학습 목표
- 사용자 역할
- Training UI / Main·Sub View / Ari Tutorial
- Event / Episode / Round Result 규칙
- Learning Engine과 gameplay 연결 원칙
- Navigation / Assets 현재 구현 방식
- 아직 미확정인 게임/UI/Map 항목

강화학습 모듈 전체 기능을 확인할 때 우선 읽는다.

### `learning_engine_v1.md`
강화학습 모듈의 **Core Learning Algorithm 기술 명세**.

현재 revision은 `v1.2`, 상태는 `APPROVED_FOR_INTEGRATION`.

핵심:
- State / Action Pool
- Reward / 0~100 Experience Score
- Encounter Action Credit
- Route Segment / Relative Advantage
- Preference Update
- Softmax / Exploration
- 5-Robot Round Update
- v1.2 Validation 결과

### `navigation_design_v1.md`
강화학습 모듈의 **5층 Navigation 논리 설계 기준 문서**.

현재 상태는 `LOGIC_APPROVED`.

- 1F~5F 층별 역할 / 계단 / Route Trade-off
- Route Decision Context
- Villain / Boss / Search Room / Control Room 규칙
- `navigation_graph_v1.json`과 runtime Tiled의 역할 분리
- 1F Tiled 실제 구현 상태
- 현재 visual 제작 전략

### `session_handoff_v3.md`
다음 작업 세션이 **어디서부터 이어가야 하는지** 알려주는 현재 상태 인수인계 문서.

새 세션 시작 시 현재 진행률, 보호할 기능, 미확정 사항, 다음 작업 순서를 복구하는 용도다.

### `concept_rules.md`
초기/상세 아이디어와 개념 규칙을 보존하는 참고 문서.

현재 구현 판단에서는 최신 `module_spec_v3.md`, `navigation_design_v1.md`, `learning_engine_v1.md`, `session_handoff_v3.md`가 우선한다.

---

## `navigation/`

실제 Navigation Graph와 Floor runtime 구현/검증 기록을 둔다.

핵심:
- `navigation_graph_v1.json` — 논리 Node / Edge / Route Context graph
- `floor_1_tiled_blockout_report.md` — 1F Tiled geometry/collision/navigation 보고서
- `floor_1_phaser_playtest_report.md` — 1F Phaser debug 및 사용자 수동 playtest 보고서

1F actual runtime spatial Source of Truth:
`public/maps/reinforcement/floor_1_blockout.tmj`

주의:
- 수동 Tiled 수정 이후 `.tmj`가 Source of Truth다.
- 초기 generator로 현재 map을 다시 덮어쓰지 않는다.
- `WALL_45_1` Object ID `185`, `WALL_45_2` Object ID `186`을 보존한다.

---

## `navigation_v2/`

Scenario 구조 실험을 위해 만든 **architectural blockout reference/history**를 보관한다.

`navigation_blockout_rebuild_report_v2.md`의 현재 disposition:

`REFERENCE_ONLY / SUPERSEDED_FOR_RUNTIME`

즉:
- 삭제 대상은 아니다.
- 2F~5F 건축 zoning 참고에는 사용할 수 있다.
- 실제 runtime geometry/collider/navmesh Source of Truth로 사용하지 않는다.
- full-floor Scenario generation은 현재 production pipeline이 아니다.

---

## 현재 Map / Visual 제작 원칙

```text
navigation_design_v1.md
= 논리 Navigation

navigation_graph_v1.json
= Node / Edge / Route Context

Tiled
= runtime geometry / collision / transition / encounter zones

Deterministic 32px tileset
= floor / wall / corner / door / stair 등 structural art

Generative image tools
= 필요한 decorative / hero asset에 선택적으로 사용
```

전체 층 이미지를 생성형 모델이 다시 해석하게 해 runtime geometry를 결정하는 방식은 사용하지 않는다.

---

## `validation/`

Learning Engine 검증 결과를 보관한다.

### `validation/learning_engine_validation_v1_2.md`
현재 최신 Core 검증 결과.

- Route Relative Advantage
- Route Preference re-centering
- SAFE / FAST / BALANCED
- Multi-Seed 20-Round 검증
- Route saturation 제거
- Encounter regression 확인

최종 `PASS_CANDIDATE`; 현재 Engine을 실제 Map Integration의 Base로 사용하는 근거다.

### `validation/archive/`
이전 validation 이력 보관.

---

## `jobs/`

일회성 Codex 작업 지시문과 archive를 보관한다. 현재 실행 기준이 아니라 작업 이력 추적용이다.

---

## 문서 우선순위

설계 내용이 충돌할 경우:

```text
현재 사용자의 최신 지시
→ module_spec_v3.md
→ navigation_design_v1.md
→ learning_engine_v1.md
→ session_handoff_v3.md
→ validation/learning_engine_validation_v1_2.md
→ docs/project/module_contract.md
→ concept_rules.md / archive / navigation_v2 reference
```

---

## 현재 다음 작업

```text
1F Structure / Manual Playtest = APPROVED
→ 1F visual implementation
→ 1F final visual playtest
→ 2F~5F Tiled structure + Phaser manual playtest
→ Route Trait / Encounter parameter 확정
→ Learning Engine v1.2 실제 Map Integration Validation
→ Production Training UI / Gameplay 구현
```
