# Reinforcement Learning Module — File Guide

이 디렉터리는 SWfestival 강화학습 모듈의 **설계, Learning Engine, 세션 인수인계, 검증 기록**을 관리한다.

## 현재 Active 문서

### `module_spec_v3.md`
강화학습 모듈의 **제품/게임 설계 기준 문서**.

포함 내용:
- Story와 학습 목표
- 사용자 역할
- Training UI
- Main/Sub View
- Ari Tutorial
- Event / Episode 규칙
- Round Result
- Learning Engine과 gameplay 연결 원칙
- 아직 미확정인 게임/UI/Map 항목

강화학습 모듈의 전체 기능을 확인할 때 가장 먼저 보는 문서다.

---

### `learning_engine_v1.md`
강화학습 모듈의 **Core Learning Algorithm 기술 명세**.

현재 알고리즘 revision은 `v1.2`이며 상태는 `APPROVED_FOR_INTEGRATION`.

포함 내용:
- State / Action Pool
- Reward 계산
- 0~100 Experience Score
- Encounter Action Credit
- Route Segment / Relative Advantage
- Preference Update
- Softmax / Exploration
- 5-Robot Round Update
- v1.2 Validation 결과
- 실제 Map Integration 시 확인할 항목

게임 UI보다 Learning Engine 계산 구조를 확인할 때 사용한다.

---

### `session_handoff_v3.md`
다음 작업 세션이 **어디서부터 이어가야 하는지** 알려주는 인수인계 문서.

포함 내용:
- 현재까지 확정된 사항
- 보호해야 할 기존 기능
- 현재 미확정 사항
- 다음 작업 순서
- 다음 세션에서 읽을 문서
- 현재 시작점

새 세션을 시작할 때 빠르게 현재 상태를 복구하는 용도다.

---

### `concept_rules.md`
강화학습 모듈의 초기/상세 아이디어와 개념 규칙을 보존하는 참고 문서.

현재 구현 판단에서는 최신 `module_spec_v3.md`, `learning_engine_v1.md`, `session_handoff_v3.md`가 우선한다.

---

### `navigation_design_v1.,d`
강화학습 모듈의 **5층 제어 센터 Navigation / Map 논리 설계 기준 문서**.

현재 상태는 `APPROVED_FOR_BLOCKOUT`.

포함 내용:
- 1F~5F 층별 역할과 기본 Layout
- 층간 계단 연결 구조
- Node / Edge / Route Decision Context 정의
- 층별 Route Trade-off
- 시민 / 장애물 / Ambiguous Person 배치 방향
- `VILLAIN_ENCOUNTER`
- `ROBOT_DISABLED`
- `BOSS_ENCOUNTER`
- 5F의 4개 Boss Search Room
- Episode별 Boss 위치 seeded random
- 고정된 중앙 Control Room
- 일반 악당 Mission Bonus 원칙
- Blockout 생성 요구사항

이 문서를 기준으로 다음 단계에서:

`navigation_graph_v1.json`

과

`floor_1_blockout.svg` ~ `floor_5_blockout.svg`

를 생성한다.

실제 x/y 좌표, 최종 Pixel Art, Encounter 확률과 Action 성공률은 이 문서가 아니라 Blockout / Integration 단계에서 확정한다.

---

## `validation/`

Learning Engine 검증 결과를 보관한다.

### `validation/learning_engine_validation_v1_2.md`
현재 **최신 검증 결과**.

v1.2에서:
- Route Relative Advantage
- Route Preference re-centering
- SAFE / FAST / BALANCED
- Multi-Seed 20-Round 검증
- Route saturation 제거
- Encounter regression 확인

을 수행했고 최종적으로 `PASS_CANDIDATE` 판정을 받았다.

현재 Engine을 실제 Map Integration의 Base로 사용하는 근거 문서다.

### `validation/archive/`
이전 검증 이력을 보관하는 폴더.

권장 보관 파일:
- `learning_engine_validation_3round.md`
- `learning_engine_validation_v1_1.md`

이 문서들은 현재 기준이 아니라, **왜 v1.1과 v1.2 수정이 필요했는지 추적하기 위한 History**다.

---

## `jobs/`

일회성 Codex 작업 지시문을 보관한다.

### `jobs/archive/codex_3round_simulation_validation_prompt.md`
초기 3-Round validation을 위해 사용했던 Codex 프롬프트.

현재 실행 지침으로 사용하는 문서가 아니라 과거 작업 기록이다.

---

## 문서 우선순위

설계 내용이 충돌할 경우:

```text
현재 사용자의 최신 지시
→ module_spec_v3.md
→ learning_engine_v1.md
→ session_handoff_v3.md
→ validation/learning_engine_validation_v1_2.md
→ module_contract.md
→ concept_rules.md / archive 문서
```

## 현재 다음 작업

```text
5층 Map / Navigation 설계
→ Decision Node별 stable Route Context 정의
→ Route Trait / Encounter 배치
→ Learning Engine v1.2 연결
→ 실제 Map에서 5 Robots × 20 Rounds Integration Validation
→ Gameplay 구현
```
