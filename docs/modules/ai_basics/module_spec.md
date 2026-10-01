# SWfestival — AI Basics Module Spec
## Module: 인공지능(AI) — AI가 무엇인지 이해하기

이 문서는 AI Basics 모듈의 최종 구현 명세다. 교육 목표와 제품 수준의 설명은 `docs/project/product_prd.md`를 함께 참고한다. 구현 값과 동작은 `src/modules/ai-basics/`, `src/main.tsx`, 실제 asset을 기준으로 한다.

## 1. Identity

- Module ID: `ai-basics`
- PRD 제목: **AI의 비밀을 밝혀라!** (현재 시작 UI에는 별도 제목 표시 없음)
- 완료 화면: **AI가 무엇인지 이해하기 완료!**
- 핵심 질문: **AI는 무엇일까?**
- 핵심 학습 목표: **AI와 단순 기계/규칙 기반 자동화의 차이를 직접 탐색하고 문제를 풀며 이해한다.**
- 상태: **기능 구현 및 배포 완료** (최종 로컬 전체 플레이, Git push, Vercel 배포본 확인은 사용자 확인)

## 2. Core Learning Loop

```text
제어실 정전 문제 → 직접 탐색/조작 → 카드 내용과 결과 확인
→ 3문제 퀴즈 → Ari 피드백 → AI 특징 카드 선택
→ 장치 작동/전원 복구 → 개념 복기 → 완료
```

AI는 데이터에서 특징과 패턴을 배우고 처음 보는 상황을 판단한다. 단순 기계는 정해진 설정과 입력에 따라 움직이며, 신호에 반응해도 뜻을 이해하거나 예시로부터 스스로 구별 기준을 배우지 않는다. 개념 설명보다 플레이 경험이 먼저 온다.

## 3. Story / Ari

전력이 꺼진 제어실에서 `???`가 카드 6장을 찾아 길 끝으로 오라고 안내한다. 첫 카드와 여섯 번째 카드에는 짧은 추가 안내가 있다. 여섯 장을 획득해 3F 오른쪽 Ari 구역에 도착하면 `???`가 Ari였음을 밝히고 퀴즈를 시작한다. 카드만 모두 모아서는 자동 전환하지 않는다.

대화는 React DOM의 하단 RPG형 panel이다. 화자, 초상, 대사, `[다음]` 버튼과 대화 위의 깜박이는 `[ SPACE ]` 힌트를 표시하며 버튼 또는 Space로 진행한다. 공개 전 화자는 `???`이고 Ari 초상 대신 `?` 표시를 쓴다. 공개 후 Ari 초상을 사용한다.

- 기본 Ari: `assets/ai/fairy.png`
- 정답 및 최종 대사: `assets/ai/fairy_happy.png`
- 오답 및 실패 대사: `assets/ai/fairy_sad.png`

## 4. Map / World Structure

- 3층 side-view 제어실. Phaser world `1536×960`, 논리 viewport `960×540`.
- 실제 `FLOOR_Y` (`AiBasicsScene.ts`): **1F 925, 2F 648, 3F 320**.
- 1F: 왼쪽 `x=288` 시작 → 오른쪽 사다리 `x=1420`.
- 2F: 오른쪽 도착 → 왼쪽 사다리 `x=100`.
- 3F: 왼쪽 도착 → 오른쪽 Ari `x=1320` 구역. 카드 6장 수집 후 `x>=1260`에서 encounter; 최종 장치 연출은 이후 React UI에 표시된다.
- 각 층 카드 2장, 총 6장. 현재 배경은 1F에 별도 불필요한 계단이 없고 3F Ari 구역이 복도와 연결된다.
- 바닥, 카드 marker, 근접 `Q`, 사다리 출구 및 reset 위치는 동일한 `FLOOR_Y` 기준을 사용한다. 별도 Tiled 파일 없이 코드의 층/사다리/카드 좌표로 진행한다.

기본 `assets/background/background.png`와 복구 이미지 두 장은 같은 장면 구조다. 어두운 분위기는 시야 제한 gameplay가 아니다. 카메라는 기본 zoom `1.5`, 수평 따라가기와 층별 세로 이동을 사용한다.

## 5. Controls / Player Animation

- 평지: `← / →`; 사다리 근처에서만 `↑ / ↓`; 카드 획득: `Q`.
- 정적 기본 모습: `public/assets/characters/cat/base/female/cat_female_down.png` (`assets/characters/cat/base/female/`에도 원본 보유).
- animation 원본: `assets/characters/cat/animations/female/`.
- runtime spritesheet: `public/assets/characters/cat/animations/female/processed/` (`assets/characters/cat/animations/female/processed/`에도 보유).

| 상태 | runtime 파일 |
|---|---|
| `IDLE_DOWN` | `public/assets/characters/cat/base/female/cat_female_down.png` |
| `WALK_LEFT` | `public/assets/characters/cat/animations/female/processed/cat_female_walk_left.png` |
| `WALK_RIGHT` | `public/assets/characters/cat/animations/female/processed/cat_female_walk_right.png` |
| `CLIMB` | `public/assets/characters/cat/animations/female/processed/cat_female_climb.png` |
| `PICKUP_LEFT` | `public/assets/characters/cat/animations/female/processed/cat_female_pickup_left.png` |
| `PICKUP_RIGHT` | `public/assets/characters/cat/animations/female/processed/cat_female_pickup_right.png` |

처리된 5개 sheet는 각각 **3072×682 RGBA 투명 배경**, `512×682` frame 6개다. `scripts/process-cat-female-animations.py`의 결정적 전처리 결과다. 걷기/등반/줍기 후 움직이지 않으면 항상 `IDLE_DOWN`을 사용한다. Ari encounter에서는 이동 입력을 잠그고 `IDLE_DOWN`을 유지한다.

## 6. Card Discovery / Storage

세로로 선 카드 대신 각 CardPoint에 짧은 floor line과 sparkle을 표시한다. 가까워지면 pulse `Q`가 나타난다. `Q`를 누르면 방향별 pickup animation 완료 후 카드가 획득되고 React 카드 앞면이 열린다. `X`, 바깥 클릭, `Esc`, `Space`로 닫는다.

상단 HUD는 6개 슬롯을 유지한다. 획득한 카드는 공통 뒷면으로 표시하고, HUD 클릭으로 같은 앞면을 다시 확인한다. 카드 앞면 제목/본문은 이미지에 박지 않고 React DOM text로 표시한다. 카드 종류를 색이나 라벨로 먼저 알려주지 않는다.

실제 카드 제목 (`notes.ts`; 각 층 2장):

| 층 | 카드 | 종류 |
|---|---|---|
| 1F | 데이터를 학습해요 / 같은 설정이면 같은 결과만 내요 | AI / 기계 |
| 2F | 패턴을 찾아요 / 뜻을 이해하지 않고 신호에 반응해요 | AI / 기계 |
| 3F | 스스로 구별하지 못해요 / 스스로 판단해요 | 기계 / AI |

마지막 기계 카드의 실제 UI 제목은 `스스로 구별하지 못해요`다. 본문은 예시에서 공통점을 찾아 스스로 기준을 배우지 못한다는 뜻을 설명한다. 공통 자산은 `assets/cards/card_front.png`, `assets/cards/card_back.png`.

## 7. Final Quiz / Feedback / Cutscene

Ari 공개가 끝나면 하트 **3개**로 중앙 modal 퀴즈 3문제를 시작한다.

1. 버튼을 누르면 정해진 시간 동안 작동한 뒤 자동으로 꺼지는 전등이 AI인가? `O / X` → **X**.
2. 강아지·고양이 사진의 반복되는 특징을 학습하고 처음 보는 사진을 판단한 사례가 AI인가? `O / X` → **O**.
3. 버튼을 누른 층으로 이동하는 엘리베이터 / 정해진 시간에 작동하는 로봇청소기 / 말을 듣고 질문 내용을 파악해 답하는 스피커 중 AI는? → **3번 스피커**.

문항의 화면 문구와 선택지 전체는 `AiBasicsApp.tsx`의 `QUIZ` 배열을 따른다. 정답에는 Ari happy, 오답에는 Ari sad 초상을 사용한다.

오답 흐름: **하트 -1 → Ari sad의 첫 피드백 → 해당 이미지 컷신 → Ari 오답 설명 → 남은 하트 판정**. 컷신은 `[다음]` 또는 Space로 진행한다. 하트가 남으면 다음 문제로, 0이면 설명을 모두 본 다음 실패 대화로 간다. 같은 문제를 즉시 반복하지 않는다.

오답 컷신 자산은 총 **9장**:

- 1번 전등: `assets/wrong_answer_cut_scene/problem_1/problem1_cut_scene_1.png`, `assets/wrong_answer_cut_scene/problem_1/problem1_cut_scene_2.png`
- 2번 사진: `assets/wrong_answer_cut_scene/problem_2/problem2_cut_scene_1.png`, `assets/wrong_answer_cut_scene/problem_2/problem2_cut_scene_2.png`, `assets/wrong_answer_cut_scene/problem_2/problem2_cut_scene_3.png`
- 3번 엘리베이터: `assets/wrong_answer_cut_scene/problem_3/type_1/problem3-1_cut_scene_1.png`, `assets/wrong_answer_cut_scene/problem_3/type_1/problem3-1_cut_scene_2.png`
- 3번 예약 청소기: `assets/wrong_answer_cut_scene/problem_3/type_2/problem3-2_cut_scene_1.png`, `assets/wrong_answer_cut_scene/problem_3/type_2/problem3-2_cut_scene_2.png`

## 8. Shared Hearts / Failure

하트는 퀴즈와 카드 선택이 공유하는 하나의 life system이다. 퀴즈 오답은 한 개 차감하고 남은 수를 그대로 선택 단계로 넘긴다. 2정답/1오답이면 2개, 1정답/2오답이면 1개, 3오답이면 0개로 실패한다.

선택 단계에서 3장 미만으로 `[넣기]`를 누르면 warning만 표시하고 하트는 그대로다. 정확히 3장이지만 틀린 조합이면 하트 한 개를 차감하고 선택을 비운 뒤, 하트가 남으면 재시도한다.

하트 0에서는 즉시 1F로 이동하지 않는다. Ari sad가 아래 세 대사를 끝낸 뒤 전체 reset한다.

```text
아쉽네... 하트가 모두 없어졌어.
다시 처음부터 길을 따라가면서
카드 내용을 하나씩 확인해 보자.
이번엔 분명 더 잘할 수 있을 거야!
```

Reset은 카드 6장/marker/HUD, 퀴즈, 선택, 장치 상태, 하트, Ari 노출, 배경과 카메라를 초기화하고 플레이어를 1F `x=288, y=925`로 돌린다. 이후 하트는 탐색 중 숨긴다.

## 9. Card Selection / Device

퀴즈 3개를 마치고 하트가 남으면 6개 카드 앞면을 모두 보여준다. 기계 카드도 선택 가능하며 최대 3장이다. 정답은 `ai-learn-data`, `ai-pattern`, `ai-judge` 세 카드다. 올바른 조합에서만 장치 sequence가 시작된다.

선택에서는 앞면, 삽입 연출에서는 뒷면 `assets/cards/card_back.png`을 사용한다.

```text
assets/card_insert_device/card_insert_device.png
→ assets/card_insert_device/card_insert_device_1.png
→ assets/card_insert_device/card_insert_device_2.png
→ assets/card_insert_device/card_insert_device_3.png
→ assets/card_insert_device/card_insert_device_final.png
```

## 10. Power Restoration / Ending

최종 장치가 켜지면 현재 gameplay 카메라의 zoom/scroll/bounds를 저장한다. Phaser 카메라를 부드럽게 줌아웃하고 이동시켜 실제 1F~3F scene 전체와 scene의 Player/Ari를 보여준다. 같은 scene의 배경 texture를 `assets/background/background.png` → `assets/background/background_power_stage_1.png` → `assets/background/background_power_stage_2.png` 순으로 바꾼다. 전체 복구 상태를 잠시 보여준 뒤 부드럽게 줌인하고 저장한 Player/Ari encounter 화면으로 돌아온다. Stage 2 배경은 유지된다. 별도 배경 overlay를 띄우는 방식이 아니다.

카메라 복귀 후 Ari happy의 실제 최종 대사:

```text
성공했어! 제어실의 전원이 모두 돌아왔어!
AI는 데이터를 보고 패턴을 배우고, 새로운 상황을 판단할 수 있어.
정해진 방식대로만 움직이는 기계와 어떤 점이 다른지 이제 알겠지?
```

이후 **AI가 무엇인지 이해하기 완료!** panel에서 `[첫 화면으로 돌아가기]`를 누르면 `/` Hub로 이동한다. 별도의 영구 완료 상태 저장은 `AiBasicsApp.tsx`에 없다.

## 11. Hub Integration / Technical Structure

`src/main.tsx`의 query parameter 분기:

| URL | 화면 |
|---|---|
| `/` | Hub |
| `/?mode=ai-basics` | AI Basics |
| `/?mode=supervised` | 기존 지도학습 |

Hub는 `assets/background/world_background.png`를 보여준다. 이미지의 회색 원 위에 투명한 percentage-positioned 버튼 두 개를 놓았다. 왼쪽 위 `AI가 무엇인지 이해하기`는 AI Basics, 오른쪽 아래 `지도학습`은 기존 지도학습으로 진입한다.

React는 Hub, 대화, 카드 앞면/HUD/선택, 퀴즈/컷신/피드백, 장치 연출, 완료 UI를 맡는다. Phaser `AiBasicsScene`은 Player/animation, world, 사다리, CardPoint, Ari sprite, 배경과 전원 복구 카메라를 맡는다. 진행과 하트 판정은 `AiBasicsApp.tsx` 및 `challenge.ts`, 카드 데이터는 `notes.ts`에 있다.

## 12. 검증 상태 / 남은 사항

- 사용자 확인: 최종 로컬 전체 플레이, Git push, Vercel 자동 배포와 배포본 확인 완료.
- 저장소 문서에 기록된 배포 주소: `https://sw-project-sooty.vercel.app/`. 이번 문서 작업에서는 배포본을 다시 열어 검증하지 않았다.
- 현재 코드/asset과 문서 대조 완료. 전체 browser gameplay는 이번 문서 작업에서 재실행하지 않았다.
- 유지 관리 시 볼 사항: 현재 코드에는 영구 완료 상태 저장이 없다. 추가 제작 또는 미완료 구현 TODO로 기록하지 않는다.
