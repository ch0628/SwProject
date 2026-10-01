# SWfestival — AI Basics Session Handoff

## 현재 상태

- 상태: **IMPLEMENTING**. 전체 gameplay flow를 코드로 연결하고 브라우저에서 1회 완료까지 플레이했다. 일부 실패/전환 분기 검증은 남아 있다.
- 개발 진입: `?mode=ai-basics` (Hub route 아님).
- 기존 지도학습 gameplay 내부는 수정하지 않았다.
- 확정된 설계 기준: `module_spec.md`, 교육 문구와 퀴즈: `docs/project/product_prd.md`.

## 이번 구현

- `AiBasicsScene.ts`: 1536×960 3층 dark 제어실, 1F 오른쪽/2F 왼쪽 사다리, 좌우 이동, 방향별 cat/female 정지 sprite, 카드 지점 6개, Ari endpoint, zoom 1.5 및 층별 camera.
- `notes.ts`: AI 3장과 기계 3장의 확정 ID, 문구, 층, 좌표.
- `AiBasicsApp.tsx` / `aiBasics.css`: 시작/정체 공개 대사, 카드 front/HUD, 퀴즈 3문제와 하트, 오답 설명, 하트 0 reset, 3장 선택, device 5상태, 전원 2단계, Ari 최종 설명과 완료 화면.
- `assets/background/background_power_stage_1.png`, `background_power_stage_2.png`: dark 원본을 참조한 조명 편집본. 두 이미지는 원본과 같은 1614×975 canvas다.

## 검증 사실

- typecheck / build: PASS.
- `npm test`: 73 PASS. 최초 실행의 구형 좌표 테스트를 현재 층별 카드 모델에 맞게 수정한 후 전체 재실행했다.
- 브라우저: dark 배경, 시작 대사, 플레이어, 좌우 이동, 평지 ↑/↓ 무시, 카드 6장 Q 수집, 중복 Q 제거, 두 사다리 상승과 카메라 전환, Esc 닫기, HUD 재열기 확인.
- 브라우저: 6장 후 자동 퀴즈 금지, Ari endpoint reveal, 퀴즈 3문제, 오답 하트 감소와 3컷, 3장 미만/오조합 경고, 정답 조합 후 장치 empty 시작, Ari 최종 설명과 완료 화면 확인.
- 브라우저: 기본 지도학습 진입 및 `?mode=dev` 진입 확인, 콘솔 오류 없음.
- 브라우저 미확인: 하트 0 수집 reset, 장치 1/2/3/final 각각의 타이밍 화면, Power Stage 1/2 각각의 표시, 선택 확대 미리보기와 포인터 X/바깥 클릭. 코드는 연결되어 있어도 이 항목을 PASS로 보고하지 않는다.

## WARN / 미완료

- walk / pickup / climb animation 없음: 정지 sprite 이동으로 기능 구현.
- 오답 panel은 DOM/CSS 3컷 임시 연출이며 illustration 없음.
- Power Stage 1 / 2 이미지의 최종 아트 정렬과 가독성 검토 필요.
- Hub route, 완료 상태 저장, 다음 모듈 CTA는 아직 미구현.
- 브라우저 자동 입력 도구의 포인터 클릭이 반응하지 않아 X/바깥 클릭 및 선택 UI의 포인터 동작은 직접 확인하지 못했다. 키보드 Enter와 Esc는 동작했다.

## 다음 순서

1. 하트 0 reset, 장치 5상태와 Power Stage 화면을 실제 브라우저에서 각각 확인.
2. 선택 확대 미리보기와 포인터 X/바깥 클릭 확인.
3. Power 배경 두 장의 아트 정렬 검토.
4. 사용자 확인 후 별도 요청이 있을 때만 commit / push.
