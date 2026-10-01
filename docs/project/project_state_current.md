# SWfestival — Project State Current

## 1. 프로젝트 목표

초등학생이 여러 AI 개념을 **설명만 읽는 것이 아니라 직접 조작하고 결과를 경험하면서 이해하는 웹 게임**을 만든다.

상위 UX는 Blockly Games처럼 여러 학습 모듈이 하나의 허브 화면에 연결되는 구조를 목표로 한다.

예정 학습 모듈:

1. **인공지능(AI)** — AI가 무엇인지 이해하기
2. **머신러닝** — AI가 학습하는 방법
   - 지도학습
   - 비지도학습
   - 강화학습
3. **딥러닝**
4. **자연어 처리**
   - Attention
   - Transformer
5. **컴퓨터 비전**

## 2. 현재 완료 상태

### 지도학습 모듈
상태: **Prototype Complete / Deployed**

```text
Ari Start
→ Round 1
→ 정답 데이터 생성
→ First Training
→ Round 2
→ 오류 확인 / 수정
→ Retraining
→ AI Assisted
→ Final Scan
→ City-Wide Result
→ Ari 최종 설명
→ Complete
```

핵심 교육 메시지:

> 정답이 있는 예시를 알려주며 AI를 가르치는 방법을 지도학습이라고 한다.

배포:
`https://sw-project-sooty.vercel.app/`

기존 지도학습 내부 gameplay는 frozen 상태로 유지한다.

## 3. 현재 작업 — AI Basics

상태: **IMPLEMENTING**

최종 3층 side-view control-room과 dark / Power Stage 1 / Power Stage 2 배경을 `src/modules/ai-basics/`에 연결했다.
카드 수집부터 퀴즈, 선택, 장치, 복구, 완료 화면까지 코드로 통합했다. 브라우저 전체 완주 검증은 아직 진행 중이다.

개발 검증 entry:
- `?mode=ai-basics`

이는 아직 Hub route가 아니다.

### 3.1 핵심 Flow

```text
Dark 3층 제어실
→ ??? 안내
→ 1F 카드 2장
→ 2F 카드 2장
→ 3F 카드 2장
→ Ari reveal
→ 퀴즈 3개 / 하트 3개
→ 퀴즈 통과
→ 카드 앞면 6장 중 AI 특징 카드 3장 선택
→ device empty → 1 → 2 → 3 → final
→ Power Stage 1: 조명 ON
→ Power Stage 2: 시스템 ON
→ 최종 설명 / 완료
```

실패:
`하트 0 → 카드/HUD reset → 1F start → 수집부터 재시도`

### 3.2 Map / Movement

- 3층 side-view control room
- 목표 `1536×960`, 48×30 tiles, 32px tile
- 층당 카드 2장
- 1F: 왼쪽 시작 → 오른쪽 사다리
- 2F: 오른쪽 도착 → 왼쪽 사다리
- 3F: 왼쪽 도착 → 오른쪽 Ari / final device
- 평지 `← / →`
- ladder zone `↑ / ↓`
- card pickup `Q`
- card close `X` / outside / `Esc`

Camera:
- zoom 1.5
- horizontal deadzone 약 35~40%
- vertical floor lock
- ladder 이동 시 floor transition

### 3.3 Card Learning Structure

AI:
1. 데이터를 학습해요
2. 패턴을 찾아요
3. 스스로 판단해요

Machine:
4. 같은 설정이면 같은 결과만 내요
5. 뜻을 이해하지 않고 신호에 반응해요
6. 스스로 구별 기준을 만들지 못해요

Card visual:
- 6장 동일 front/back/frame/color/shape
- AI / machine 색/라벨 구분 없음
- world: floor line + sparkle
- `Q` 후 front 확인
- HUD 클릭으로 front 재확인
- final selection은 front
- actual insertion은 back

### 3.4 Quiz / Final Interaction

- PRD 퀴즈 3문제
- quiz에서만 hearts 3
- 오답 → heart -1 + 짧은 visual feedback
- 동일 문제 즉시 반복 없음
- hearts 0 → 전체 수집 reset

Quiz 성공 후:
- 6장 모두 선택 가능
- 사용자 스스로 AI 특징 3장을 고름
- 정답을 색/disabled로 미리 표시하지 않음

### 3.5 Power Restoration

1. **Stage 1**: room lighting ON, system 대부분 OFF
2. **Stage 2**: monitor / console / control system ON

### 3.6 제작 완료 Asset

- card front / back
- device empty / 1 / 2 / 3 / final
- device state canvas 통일
- dark 3-floor background
- Power Stage 1 / Power Stage 2 background 조명 편집본
- dark background final zone에 inactive device 통합
- Ari PNG

다음 visual asset:
- player walk left/right
- pickup
- 필요 시 ladder climb
- quiz wrong-answer panels

### 3.7 현재 검증

- 독립 Phaser AI Basics scene
- 6개 Q interaction
- React card/HUD
- `npm test` 73 PASS
- typecheck PASS
- build PASS
- browser-visible dark 배경 / 좌우 이동 / 평지 ↑·↓ 무시 / 3층 카드 6장 / 두 사다리 / Ari / 퀴즈 / 카드 선택 경고와 정답 / 완료 화면 확인
- default supervised / `?mode=dev` 진입 확인
- 하트 0 reset, 장치 중간 state와 Power Stage 각 화면, 포인터 닫기는 browser 검증 전

상세 Source of Truth는 `module_spec.md`.

### 3.8 다음 구현 작업

1. 하트 0 reset, 장치 5상태, Power Stage 각 화면, 카드 확대 미리보기와 포인터 닫기 browser 검증
2. 발견되는 blocker 수정
3. Power Stage 1 / 2 아트 정렬 검토
4. 캐릭터 애니메이션과 wrong-answer illustration이 준비되면 적용

## 4. 전체 허브 목표

```text
AI Learning Hub

[AI란?]
   ↓
[머신러닝]
   ├─ 지도학습
   ├─ 비지도학습
   └─ 강화학습

[딥러닝]
[자연어 처리]
[컴퓨터 비전]
```

Hub에서:
- 모듈 선택
- 완료 여부 확인
- 이전 모듈 복귀
- 다음 관련 모듈 이동

을 지원한다.

## 5. 핵심 원칙

### 교육
- **문제 발생 → 조작 → 결과 → 설명**
- 먼저 경험하고 이후 개념 이름을 연결
- Player UI에 불필요한 전문 용어 노출 금지

### 개발
- 지도학습 frozen gameplay 보호
- 모듈 단위 독립성 유지
- Hub / Navigation / Completion만 공통
- `검토 → 사용자 승인 → 구현`
- 확정된 AI Basics 설계는 이유 없이 다시 열지 않음

### 프로토타입 기준
> blocker FAIL만 즉시 수정. WARN은 기록 후 진행.
