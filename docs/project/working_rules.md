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
