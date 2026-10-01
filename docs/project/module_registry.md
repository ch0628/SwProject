# SWfestival — Module Registry

이 문서는 현재 학습 모듈의 이름, 진입 route, 상태를 관리한다. 구현된 route는 `src/main.tsx` 기준이다. 미구현 모듈의 경로는 확정하지 않는다.

| ID | 표시 이름 | 학습 질문 | 진입 | 상태 |
|---|---|---|---|---|
| Hub | 첫 화면 | 모듈 선택 | `/` | COMPLETE |
| `ai-basics` | AI가 무엇인지 이해하기 | AI는 무엇일까? | `/?mode=ai-basics` | COMPLETE / DEPLOYED |
| `supervised-learning` | 지도학습 | 정답이 있는 예시로 AI를 어떻게 가르칠까? | `/?mode=supervised` | PROTOTYPE COMPLETE / DEPLOYED |
| `machine-learning` | 머신러닝 | AI는 어떻게 배울까? | 미구현 | PLANNED |
| `unsupervised-learning` | 비지도학습 | 정답 없이 비슷한 것끼리 어떻게 찾을까? | 미구현 | PLANNED |
| `reinforcement-learning` | 강화학습 | 보상과 벌점으로 어떻게 배울까? | 미구현 | PLANNED |
| `deep-learning` | 딥러닝 | 여러 층의 신경망은 어떻게 특징을 배울까? | 미구현 | PLANNED |
| `nlp` | 자연어 처리 | AI는 글과 말을 어떻게 이해할까? | 미구현 | PLANNED |
| `computer-vision` | 컴퓨터 비전 | AI는 이미지와 영상을 어떻게 이해할까? | 미구현 | PLANNED |

## 현재 연결

- Hub: `assets/background/world_background.png`의 회색 원 위에 투명 hotspot 두 개. 왼쪽 위 → AI Basics, 오른쪽 아래 → 지도학습.
- AI Basics: 3층 카드 6장 탐색, Ari 공개, 퀴즈 3개와 오답 컷신/공유 하트, AI 카드 3장 선택, 장치와 전원 복구, 완료 panel까지 구현. `[첫 화면으로 돌아가기]` → `/`.
- 지도학습: 기존 standalone gameplay가 `/?mode=supervised`에서 열린다.

사용자 확인으로 AI Basics 최종 로컬 플레이, Git push, Vercel 배포와 배포본 확인이 완료됐다. 자세한 동작은 `docs/modules/ai_basics/module_spec.md`를 따른다. 현재 AI Basics에 영구 완료 상태 저장은 없다.
