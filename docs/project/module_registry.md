# SWfestival — Module Registry

이 문서는 전체 학습 모듈의 이름, route, 상태, 연결 관계를 관리하는 단일 기준 문서다.

> 실제 route 이름은 구현 시 현재 repository 구조를 확인한 뒤 확정한다. 아래 route는 제안값이다.

| ID | 표시 이름 | 학습 질문 | 제안 Route | 상태 | 다음 연결 |
|---|---|---|---|---|---|
| `ai-basics` | 인공지능 | AI는 무엇일까? | `/ai` | IMPLEMENTING | `machine-learning` |
| `machine-learning` | 머신러닝 | AI는 어떻게 배울까? | `/machine-learning` | PLANNED | 하위 모듈 |
| `supervised-learning` | 지도학습 | 정답이 있는 예시로 AI를 어떻게 가르칠까? | `/machine-learning/supervised` | PROTOTYPE COMPLETE | Hub / ML |
| `unsupervised-learning` | 비지도학습 | 정답 없이 비슷한 것끼리 어떻게 찾을까? | `/machine-learning/unsupervised` | PLANNED | Hub / ML |
| `reinforcement-learning` | 강화학습 | 보상과 벌점으로 어떻게 배울까? | `/machine-learning/reinforcement` | PLANNED | Hub / ML |
| `deep-learning` | 딥러닝 | 여러 층의 신경망은 어떻게 특징을 배울까? | `/deep-learning` | PLANNED | Hub |
| `nlp` | 자연어 처리 | AI는 글과 말을 어떻게 이해할까? | `/nlp` | PLANNED | Hub |
| `computer-vision` | 컴퓨터 비전 | AI는 이미지와 영상을 어떻게 이해할까? | `/computer-vision` | PLANNED | Hub |

## 상태 값

- `NEXT`
- `PLANNED`
- `DESIGNING`
- `IMPLEMENTING`
- `PROTOTYPE COMPLETE`
- `POLISH`

## AI Basics 현재 구현 마일스톤

`ai-basics`: **IMPLEMENTING**

완료:
- technical scaffold + browser 검증
- 최종 3층 side-view map structure 확정
- AI 3 + machine 3 card content 확정
- card front/back UX 확정
- Ari reveal / quiz / reset rule 확정
- post-quiz AI 카드 3장 선택 flow 확정
- card insertion device 5-state asset 완료
- dark control-room background 완료
- final upper-right zone inactive device 통합 완료
- 3층 scene / 카드 수집 / Ari / quiz / 선택 / device / 전원 복구 코드 통합
- Power Stage 1 / 2 배경 조명 편집본 연결
- 브라우저에서 3층 카드 6장 / Ari / 퀴즈 / 선택 경고와 정답 / 완료, 기본 지도학습과 dev 진입 확인

다음:
- 하트 0 reset, 장치 중간 state, Power Stage 각 화면, 포인터 닫기 브라우저 검증
- Power Stage 1 / 2 이미지 최종 아트 검토
- Hub connection / 완료 상태 기록

현재 개발 검증 entry:
- `?mode=ai-basics`

이는 최종 Hub route가 아니다.

## Hub UI 기본 규칙

```ts
type ModuleDefinition = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  status: ModuleStatus;
  prerequisiteIds?: string[];
};
```

프로토타입에서는 prerequisite를 강제로 잠글 필요는 없다.

우선:
- 클릭 → 해당 모듈
- 완료 표시
- 종료 → Hub 복귀
- 관련 다음 모듈 CTA

## 지도학습 모듈 연결 원칙

지도학습은 검증된 standalone gameplay를 유지한다.

Hub integration은:
1. Hub → 지도학습 진입
2. 종료 → Hub 복귀
3. 완료 상태 기록

만 추가한다.

기존 Round1 / Round2 / Final Scan 내부 로직은 Hub 때문에 다시 작성하지 않는다.
