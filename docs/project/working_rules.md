# SWfestival — Working Rules

프로젝트 전반에서 ChatGPT / Codex / Antigravity 등에게 공통으로 적용할 작업 원칙.

## 1. 우선순위
1. 현재 사용자의 직접 지시
2. 현재 Module Spec
3. Project State
4. Module Registry
5. Module Contract
6. Working Rules

## 2. 구현 전 원칙

중요한 설계는:

```text
검토
→ 사용자 승인
→ 구현
```

순서로 진행한다.

사용자가 아직 구현을 요청하지 않았다면
임의로 코드를 작성하거나 파일을 수정하지 않는다.

## 3. 확정 / 미확정

이미 확정된 사항은 새 이유 없이 다시 논의하거나 변경하지 않는다.

미확정 사항은 모델이 임의로 확정하지 않는다.

## 4. Prototype Rule

> 프로토타입을 막는 FAIL만 즉시 수정한다.
> WARN은 기록하고 진행한다.

기능이 정상인데 완벽한 polish를 위해 전체 구조를 다시 만드는 것을 피한다.

## 5. Regression Rule

완성된 모듈을 새 모듈 때문에 다시 설계하지 않는다.

특히 지도학습 모듈은 Hub navigation 연결 외에는 기본적으로 frozen으로 취급한다.

## 6. Player UI

Player에게 다음을 노출하지 않는다.
- raw enum
- debug state
- internal phase name
- developer key
- technical implementation term

필요하면 사용자용 display copy로 변환한다.

## 7. Elementary UX
- 짧은 문장
- 한 번에 한 행동
- 큰 CTA
- 즉각적인 feedback
- 반복 스크롤 최소화
- 색상 + symbol 함께 사용
- 개념 설명은 체험 후

## 8. 작업 범위

한 작업에 성격이 다른 변경이 섞이면 분리한다.

예:
- Gameplay logic
- UI copy/polish
- Narrative/cutscene
- Deployment

각 단위:

```text
구현
→ Browser 확인
→ PASS
→ Git commit
→ 다음 작업
```

## 9. 보고 기준

"코드에 구현됨"은 PASS가 아니다.

실제 브라우저에서 사용자가 요구한 동작이 보여야 PASS다.

## 10. 외부 배포

현재 production:

`https://sw-project-sooty.vercel.app/`

Git main push 이후 Vercel production 결과도 확인한다.

특히:
- asset 404
- font
- viewport
- console error

를 smoke test한다.

## Documentation Creation Rules

새 작업에서 문서를 생성할 때 다음 원칙을 따른다.

### 1. 새 문서는 최소화한다

기존 Source of Truth에 포함할 수 있는 내용이면
새 파일을 만들지 않고 기존 문서를 갱신한다.

### 2. 모듈 문서 기본 구조

각 학습 모듈은 기본적으로 다음 구조를 사용한다.

modules/<module>/
├─ module_spec.md
├─ session_handoff.md
└─ validation/

- module_spec.md:
  현재 구현 규칙의 Source of Truth

- session_handoff.md:
  현재 진행 상태와 다음 작업

- validation/:
  실제 구현 검증 결과

필요성이 명확하지 않으면 추가 문서를 생성하지 않는다.

### 3. 파일 배치

프로젝트 전체 정책:
→ docs/project/

특정 학습 모듈:
→ docs/modules/<module>/

공통 기술 / Map / Graphics:
→ docs/shared/

검증:
→ docs/validation/ 또는 해당 module의 validation/

템플릿:
→ docs/templates/

과거 기록:
→ docs/archive/

### 4. 새 파일 생성 기준

다음 중 하나를 만족하는 경우에만 새 문서를 만든다.

- 기존 Source of Truth와 목적이 명확히 다름
- 내용이 충분히 커서 독립 관리가 필요함
- 별도의 validation/evidence로 보존해야 함
- 여러 문서에서 공통 참조할 독립 규격임

단순 결정 기록이나 작은 변경 때문에 새 문서를 만들지 않는다.

### 5. Current vs Archive

현재 기준 문서는 이름에 날짜나 v1/v2를 남발하지 않는다.

예:
module_spec.md
session_handoff.md

과거 기록으로 내려갈 때만 날짜나 버전을 붙인다.

예:
archive/session_handoff_2026-09-28.md

### 6. 작업 종료 시

세션 종료 전에:

1. module_spec 갱신
2. session_handoff 갱신
3. 필요한 validation 결과 갱신
4. module_registry 상태 갱신 필요 여부 확인
5. project_state_current 갱신 필요 여부 확인

을 검토한다.