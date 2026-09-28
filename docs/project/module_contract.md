# SWfestival — Learning Module Contract

모든 학습 모듈이 공통적으로 따라야 할 최소 구조.

새 모듈을 만들 때마다 이 문서를 기준으로 한다.

## 1. Module Entry

모듈 진입 시 반드시 명확해야 한다.
- 왜 이 문제를 해결해야 하는가?
- 사용자는 무엇을 조작해야 하는가?
- 성공하려면 무엇을 해야 하는가?

가능하면 Ari 또는 해당 모듈 가이드가 2~4줄 내로 설명한다.

## 2. Learning Loop

기본 권장 구조:

```text
문제 발생
→ 바로 조작
→ 결과 확인
→ 실패/성공 피드백
→ 다시 시도 또는 다음 단계
→ 마지막에 개념 이름 설명
```

긴 선행 설명은 피한다.

## 3. Required Module Fields

각 모듈 설계 문서는 최소한 다음을 정의한다.

### Identity
- Module ID
- Player-facing title
- 핵심 질문
- 학습 개념

### Story
- 문제 상황
- 사용자의 역할
- 왜 조작해야 하는지

### Interaction
- 사용자가 실제로 클릭/드래그/선택/이동하는 것
- 즉각적인 feedback
- 실패 조건
- 재시도 방식

### Completion
- 완료 조건
- 완료 후 보여주는 결과
- 최종 교육 메시지

### Navigation
- Hub → Module
- Module → Hub
- Module → 다음 관련 Module

### Assets
- 필요한 이미지
- sprite
- font
- sound
- 기존 asset 재사용 여부

## 4. UX Rules
- 한 화면에서 사용자가 해야 할 핵심 행동은 가능하면 1개.
- 버튼 이름은 행동을 직접 표현한다.
- 내부 enum / debug key / state name을 Player UI에 노출하지 않는다.
- 초등학생이 읽는 문장은 짧게 쓴다.
- 색상만으로 상태를 구분하지 않고 symbol/text를 같이 사용한다.
- 스크롤을 반복해야 핵심 조작이 가능한 구조를 피한다.

## 5. Technical Isolation

새 모듈은 가능한 한 독립적으로 유지한다.

권장 개념 구조:

```text
src/
  hub/
  modules/
    ai-basics/
    supervised/
    unsupervised/
    reinforcement/
    deep-learning/
    nlp/
    computer-vision/
```

실제 repository를 확인한 뒤 현재 구조와 충돌하지 않는 선에서 적용한다.

중요:
- 공통 Hub는 navigation만 담당
- 모듈 내부 gameplay state는 각 모듈이 소유
- 다른 모듈 구현 때문에 지도학습 FSM을 수정하지 않는다

## 6. Completion State

프로토타입에서는 단순한 client-side 완료 상태면 충분하다.

예:

```ts
type ModuleProgress = {
  moduleId: string;
  completed: boolean;
};
```

필요하면 localStorage를 사용한다.

로그인/DB는 현재 프로토타입을 위해 새로 추가하지 않는다.

## 7. Review Gate

각 모듈 구현은 다음 순서로 진행한다.

```text
팀 문서 / 아이디어
→ Learning Objective 정리
→ Interaction 설계
→ 사용자 승인
→ 구현
→ Browser Smoke Test
→ Git Commit
→ 다음 모듈
```

한 번에 여러 모듈을 구현하지 않는다.
