# SWfestival — Module Registry

이 문서는 전체 학습 모듈의 이름, route, 상태, 연결 관계를 관리하는 단일 기준 문서다.

> 실제 route 이름은 구현 시 현재 repository 구조를 확인한 뒤 확정한다. 아래 route는 제안값이다.

| ID | 표시 이름 | 학습 질문 | 제안 Route | 상태 | 다음 연결 |
|---|---|---|---|---|---|
| `ai-basics` | 인공지능 | AI는 무엇일까? | `/ai` | NEXT | `machine-learning` |
| `machine-learning` | 머신러닝 | AI는 어떻게 배울까? | `/machine-learning` | PLANNED | 하위 모듈 |
| `supervised-learning` | 지도학습 | 정답이 있는 예시로 AI를 어떻게 가르칠까? | `/machine-learning/supervised` | PROTOTYPE COMPLETE | Hub / ML |
| `unsupervised-learning` | 비지도학습 | 정답 없이 비슷한 것끼리 어떻게 찾을까? | `/machine-learning/unsupervised` | PLANNED | Hub / ML |
| `reinforcement-learning` | 강화학습 | 보상과 벌점으로 어떻게 배울까? | `/machine-learning/reinforcement` | PLANNED | Hub / ML |
| `deep-learning` | 딥러닝 | 여러 층의 신경망은 어떻게 특징을 배울까? | `/deep-learning` | PLANNED | Hub |
| `nlp` | 자연어 처리 | AI는 글과 말을 어떻게 이해할까? | `/nlp` | PLANNED | Hub |
| `computer-vision` | 컴퓨터 비전 | AI는 이미지와 영상을 어떻게 이해할까? | `/computer-vision` | PLANNED | Hub |

## 상태 값
- `NEXT` — 다음 구현 대상
- `PLANNED` — 기획 예정
- `DESIGNING` — 설계 중
- `IMPLEMENTING` — 구현 중
- `PROTOTYPE COMPLETE` — 플레이 가능한 프로토타입 완료
- `POLISH` — 시각/UX 보완 단계

## Hub UI 기본 규칙

각 노드는 최소한 다음 정보를 가진다.

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
- 클릭 → 해당 모듈 이동
- 완료한 모듈에는 완료 표시
- 모듈 종료 → Hub로 복귀 가능
- 관련 다음 모듈 CTA 제공

정도로 시작한다.

## 지도학습 모듈 연결 원칙

지도학습 모듈은 이미 검증된 standalone gameplay를 유지한다.

Hub integration에서 필요한 것은:
1. Hub에서 지도학습 route로 진입
2. 지도학습 종료 후 Hub 복귀
3. 완료 상태 기록

뿐이다.

기존 Round1 / Round2 / Final Scan 내부 로직을 Hub 때문에 다시 작성하지 않는다.
