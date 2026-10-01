# SWfestival — AI Basics Session Handoff

## 현재 상태

- **기능 구현 및 배포 완료.** 사용자가 최종 로컬 전체 플레이, Git push, Vercel 자동 배포와 배포본 확인을 완료했다.
- 이번 handoff는 구현 재개 지시가 아니라 유지 관리용 현황이다. 세부 동작과 자산은 `module_spec.md`, 실제 값은 코드/asset을 따른다.
- 배포 주소는 기존 프로젝트 문서에 기록된 `https://sw-project-sooty.vercel.app/`이다. 이번 문서 업데이트에서는 배포본을 다시 검증하지 않았다.

## 최종 진입 / 구조

| URL | 결과 |
|---|---|
| `/` | Hub (`assets/background/world_background.png`) |
| `/?mode=ai-basics` | AI Basics |
| `/?mode=supervised` | 기존 지도학습 |

Hub의 투명 hotspot은 이미지 회색 원 위에 놓인다. 왼쪽 위는 AI Basics, 오른쪽 아래는 지도학습이다. AI Basics 완료 panel의 `[첫 화면으로 돌아가기]`는 `/`로 이동한다.

- React (`AiBasicsApp.tsx`): 대화, 퀴즈, 카드 UI/HUD/선택, 오답 컷신, 장치, 하트, 결말.
- Phaser (`AiBasicsScene.ts`): Player/animation, 3층 world/사다리/CardPoint, Ari, 배경과 실제 카메라 zoom-out/zoom-in 복구 연출.
- `notes.ts`: 층당 2장, AI 3장/기계 3장. `challenge.ts`: 퀴즈 및 카드 선택 하트 판정.
- `src/main.tsx`: query parameter 진입과 Hub.

## 구현 완료 항목

- 1F 오른쪽 → 2F 왼쪽 → 3F 오른쪽으로 이동하는 제어실. 현재 `FLOOR_Y = [925, 648, 320]`. 6장 수집 후 3F Ari encounter.
- `←/→` 이동, 사다리 `↑/↓`, `Q` 획득. cat/female 정지/걷기/등반/방향별 줍기 animation; 멈추거나 Ari를 만나면 `IDLE_DOWN`.
- CardPoint floor line/sparkle/`Q` pulse, 앞면과 6칸 HUD, 획득 카드 재확인.
- `???` 공개 전 안내와 Ari 공개 후 하단 DOM 대화. 중앙 modal 퀴즈 3문제, 정답 happy/오답 sad, 분기별 9장 이미지 컷신과 오답 설명.
- 퀴즈/카드 선택 공유 하트 3개. 마지막 하트를 잃어도 오답 설명 또는 선택 판정 뒤 Ari 실패 대사를 마치고 전체 reset.
- 6개 앞면에서 AI 카드 3장 선택, 장치 empty/1/2/3/final, 카드 뒷면 삽입 연출.
- Phaser scene 실제 카메라 zoom-out → 배경 dark/Power Stage 1/Stage 2 → zoom-in, Ari 최종 대사와 Hub 복귀.

## 최종 asset 경로

- Hub: `assets/background/world_background.png`
- 제어실: `assets/background/background.png`, `background_power_stage_1.png`, `background_power_stage_2.png`
- Player base: `public/assets/characters/cat/base/female/cat_female_down.png`; runtime animation: `public/assets/characters/cat/animations/female/processed/`의 walk left/right, climb, pickup left/right 5개 sheet (`3072×682`, RGBA, 6 frames)
- Ari: `assets/ai/fairy.png`, `fairy_happy.png`, `fairy_sad.png`
- 카드: `assets/cards/card_front.png`, `card_back.png`
- 장치: `assets/card_insert_device/card_insert_device.png`, `card_insert_device_1.png`, `_2.png`, `_3.png`, `_final.png`
- 오답 컷신: `assets/wrong_answer_cut_scene/problem_1/` 2장, `problem_2/` 3장, `problem_3/type_1/` 2장, `type_2/` 2장

## 검증 / 유지 관리

- 사용자가 최종 로컬 전체 플레이와 배포본 확인 완료를 보고했다. 이 문서 작업에서는 코드/asset과 문서를 대조했고 browser gameplay를 다시 실행하지 않았다.
- 이전 handoff의 미구현 animation, 컷신, Power 배경, Hub, 퀴즈 및 부분 플레이 검증 TODO는 현 구현에 해당하지 않는다.
- 현재 코드에 영구 완료 상태 저장은 없다. 이 동작이 필요해지면 별도 기능 요청으로 다룬다.
