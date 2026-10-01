# SWfestival — Project State Current

## 1. 프로젝트 목표

초등학생이 여러 AI 개념을 **설명만 읽는 것이 아니라 직접 조작하고 결과를 경험하면서 이해하는 웹 게임**을 만든다. Hub에서 학습 모듈을 선택하는 구조다.

예정 학습 영역은 인공지능(AI), 머신러닝(지도/비지도/강화학습), 딥러닝, 자연어 처리, 컴퓨터 비전이다. 현재 구현된 진입점은 AI Basics와 지도학습이다.

## 2. 현재 Hub / Routing

`src/main.tsx`가 query parameter로 화면을 선택한다.

| URL | 화면 | 현재 상태 |
|---|---|---|
| `/` | Hub | 구현 완료 |
| `/?mode=ai-basics` | AI가 무엇인지 이해하기 | 기능 구현/배포 완료 |
| `/?mode=supervised` | 지도학습 | Prototype Complete / Deployed |

Hub 배경은 `assets/background/world_background.png`. 이미지 회색 원 위의 투명 버튼 두 개 중 왼쪽 위는 AI Basics, 오른쪽 아래는 지도학습이다. AI Basics 완료 화면의 `[첫 화면으로 돌아가기]`는 `/`로 이동한다. 지도학습 gameplay 내부는 기존 흐름을 유지한다.

## 3. AI Basics — 기능 구현 및 배포 완료

핵심 목표는 **AI와 단순 기계/규칙 기반 자동화의 차이를 직접 탐색하고 문제를 풀면서 이해하는 것**이다. 경험 순서는 문제 발생 → 탐색/조작 → 결과 → 퀴즈 → 피드백 → 성공이다.

```text
??? 안내 → 3층 제어실에서 카드 6장 수집 → Ari 공개
→ 중앙 modal 퀴즈 3개 → AI 카드 3장 선택
→ 장치 empty/1/2/3/final → 실제 카메라 전체 map zoom-out
→ 배경 Power Stage 1/2 → 카메라 복귀 → Ari 최종 대사 → 완료 → Hub
```

- 1F 오른쪽 → 2F 왼쪽 → 3F 오른쪽 동선. 실제 층 바닥 Y는 **925 / 648 / 320**. 층마다 카드 2장이다.
- cat/female Player의 정지/걷기/등반/줍기 animation, `Q` 카드 획득, 앞면 확인과 상단 6칸 HUD를 사용한다.
- Ari 공개 전 `???` 대화, 공개 후 초상, 정답 happy/오답 sad 표현을 사용한다.
- 퀴즈 오답은 분기별 9장 컷신과 Ari 해설로 이어진다. 퀴즈와 카드 선택은 하트 3개를 공유한다. 0개가 되면 Ari 실패 대화를 마친 뒤 카드/HUD/장치/카메라까지 초기화한다.
- 카드 선택은 AI 카드 3장이 정답이다. 3장 미만 warning은 하트 차감이 없고, 틀린 3장 조합은 하트 한 개 차감 후 재선택한다.
- 전원 복구는 별도 overlay 이미지가 아닌 Phaser scene의 카메라 줌아웃/줌인과 `background.png` → `background_power_stage_1.png` → `background_power_stage_2.png` 교체다.

자세한 구현 명세와 asset 경로는 `docs/modules/ai_basics/module_spec.md`, 현재 인수인계는 `docs/modules/ai_basics/session_handoff.md`에 있다.

## 4. 지도학습 모듈

상태: **Prototype Complete / Deployed**.

```text
Ari Start → Round 1 → 정답 데이터 생성 → First Training
→ Round 2 → 오류 확인/수정 → Retraining → AI Assisted
→ Final Scan → City-Wide Result → Ari 최종 설명 → Complete
```

핵심 메시지는 “정답이 있는 예시를 알려주며 AI를 가르치는 방법을 지도학습이라고 한다”이다. Hub 오른쪽 아래 hotspot이 `/?mode=supervised`로 진입시킨다.

## 5. 검증 / 배포 상태

- 사용자 확인: AI Basics 최종 로컬 전체 플레이, Git push, Vercel 자동 배포와 배포본 확인 완료.
- 기존 프로젝트 문서에 기록된 URL: `https://sw-project-sooty.vercel.app/`. 이번 문서 업데이트에서 배포본을 다시 실행하지 않았다.
- 코드/asset 대조 결과, Hub, 3층 탐색, 카드, Ari, 퀴즈/컷신/공유 하트, 선택, 장치, 전원 복구, 완료 복귀가 연결되어 있다.
- 현재 코드에는 AI Basics의 영구 완료 상태 저장이 없다. 추가 기능이 필요해질 때 별도 판단한다.

## 6. 핵심 원칙

- 교육: 먼저 문제를 경험하고 조작한 뒤 결과와 개념을 연결한다.
- 개발: 모듈 단위 독립성을 유지하고, 지도학습 gameplay 흐름을 보호한다.
