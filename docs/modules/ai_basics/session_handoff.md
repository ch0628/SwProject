# SWfestival — Next Session Handoff
## Module: 인공지능(AI) — AI가 무엇인지 이해하기

## 1. 다음 세션 시작 시 사용자에게 받을 자료

필수:
- 팀원들과 협의한 **AI가 무엇인지 이해하기 파트 문서**

선택:
- 추가 reference image
- 팀원 피드백
- 반드시 유지하고 싶은 문구/스토리

현재 지도학습 구현은 이미 완료되었으므로
새 세션에서 지도학습 내부를 다시 분석하거나 재설계하지 않는다.

## 2. 다음 세션 첫 작업

첨부 문서를 먼저 읽고 아래 세 그룹으로 분리한다.

### A. 이미 확정된 사항
팀 합의로 확정되었으므로 이유 없이 변경하지 않는다.

### B. 개발을 위해 구체화해야 하는 사항
예:
- 실제 조작 방식
- 화면 구성
- 성공/실패 조건
- feedback
- progression
- Ari 안내
- 필요한 asset
- 완료 후 이동

### C. 미확정 사항
임의로 결정하지 않고 사용자와 상의한다.

## 3. AI Basics 모듈의 설계 목표

단순히:

> AI는 데이터를 분석해서 판단하는 기술입니다.

를 읽게 만드는 콘텐츠가 되어서는 안 된다.

사용자가 직접:

```text
일반 기계
vs
AI가 판단하는 시스템
```

의 차이를 체험하도록 설계한다.

팀 문서의 구체 내용을 우선하며,
문서가 허용하는 범위 내에서 interaction을 발전시킨다.

## 4. 다음 세션에서 반드시 결정할 것

1. 한 문장 Learning Objective
2. 플레이어가 맡는 역할
3. 문제 상황
4. 핵심 interaction
5. 성공 조건
6. 실패 / 오답 feedback
7. 재시도 방식
8. Ari가 언제 무엇을 설명하는지
9. 최종적으로 어떤 문장으로 "AI란 무엇인가"를 설명할지
10. Hub → AI Basics → Hub/ML 연결 방식

## 5. 지도학습과 연결

목표 사용자 흐름:

```text
Hub
↓
AI Basics
"AI는 입력을 보고 판단할 수 있다"
↓
Machine Learning
"그런데 AI는 어떻게 판단하는 법을 배울까?"
↓
Supervised Learning
"정답이 있는 예시를 알려주며 배우게 해보자"
```

AI Basics의 마지막은 지도학습을 직접 설명하기보다 다음 질문을 남기는 것이 좋다.

예:

> "그런데 AI는 처음부터 이런 판단을 할 수 있었을까?"

→ Machine Learning / 지도학습으로 자연스럽게 연결.

정확한 copy는 팀 문서를 읽은 뒤 확정한다.

## 6. Hub 연결 작업

AI Basics 구현과 함께 최소 Hub shell을 만든다.

Hub 역할:
- 원형 노드 표시
- 노드 클릭 → Module route
- 지도학습 기존 모듈로 이동
- AI Basics 모듈로 이동
- 완료 표시의 최소 구조

처음부터 모든 미완성 모듈을 구현하지 않는다.

미완성 node는:
- Coming Soon
- 준비 중

처리 가능.

## 7. 구현 전에 확인할 repository 항목

새 세션에서 코드 수정 전 실제 repository를 확인한다.
- 현재 `src/` 구조
- `main.tsx`
- routing 유무
- Ari overlay 재사용 가능 여부
- 기존 supervised entry 방식
- Vercel build 구조
- asset import 방식
- module completion state 유무

값을 추측해서 새 architecture를 만들지 않는다.

## 8. 권장 작업 순서

### STEP 1 — 문서 분석
팀 합의 문서 → 확정 / 구체화 / 미확정 분리

### STEP 2 — 게임 설계
AI Basics interaction flow 설계

### STEP 3 — 사용자 승인
코드 작성 전 사용자에게 설계를 보여준다.

### STEP 4 — Hub integration 설계
AI Basics와 기존 Supervised를 어떻게 연결할지 확정

### STEP 5 — 구현
한 번에 최소 범위로 구현

### STEP 6 — 검증
- AI Basics 처음부터 끝까지
- Hub → AI Basics
- Hub → Supervised
- AI Basics → 다음 연결
- 기존 Supervised regression 없음

### STEP 7 — Git
사용자 확인 후 commit/push

## 9. 현재 보호해야 할 완료 기능

지도학습 모듈 내부:
- CCTV 1~5
- Round1
- Tracking
- First Training
- Round2
- Retraining
- AI Assisted
- Final Scan
- City-Wide Result
- Final Ari
- Complete

Hub integration 때문에 위 로직을 수정하지 않는다.

## 10. 다음 세션 시작 프롬프트

```text
첨부한 AI가 무엇인지 이해하기 파트의 팀 합의 문서를 먼저 읽어줘.

현재 SWfestival 프로젝트에서는 지도학습 모듈 프로토타입이 이미 완료되어 있고,
이제 전체 AI 학습 Hub의 첫 모듈인
"인공지능(AI) — AI가 무엇인지 이해하기" 파트를 만들려고 한다.

먼저 코드를 작성하지 말고 문서에서:

1. 이미 확정된 내용
2. 실제 게임 개발을 위해 구체화해야 하는 내용
3. 아직 결정되지 않은 내용

을 분리해줘.

그 다음 초등학생이
설명을 읽기 전에 직접 조작과 결과를 통해
"일반 기계와 AI의 차이"를 이해할 수 있는 gameplay flow로 구체화하자.

중요:
- 기존 지도학습 gameplay 내부 로직은 건드리지 않는다.
- 중요한 설계는 검토 → 내 승인 → 구현 순서로 진행한다.
- 미확정 사항은 임의로 결정하지 않는다.
- 최종적으로 Hub에서 AI Basics와 기존 지도학습 모듈이 연결되어야 한다.

참고 문서:
- swfestival_project_state_current.md
- swfestival_module_registry.md
- swfestival_module_contract.md
- swfestival_ai_basics_session_handoff.md
- swfestival_working_rules.md
```
