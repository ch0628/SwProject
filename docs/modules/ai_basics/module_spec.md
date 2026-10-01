# SWfestival — AI Basics Module Spec
## Module: 인공지능(AI) — AI가 무엇인지 이해하기

이 문서는 AI Basics 모듈의 현재 구현 설계 Source of Truth이다.
제품 수준의 교육 내용과 기본 스토리는 `product_prd.md`를 따르며, 실제 구현에 필요한 상호작용과 진행 규칙은 이 문서를 우선한다.

## 1. Identity

- Module ID: `ai-basics`
- Player-facing title: **AI의 비밀을 밝혀라!**
- 핵심 질문: **AI는 무엇일까?**
- 핵심 학습 목표: **기계와 AI의 차이를 학습자가 명확히 구분할 수 있도록 한다.**
- 상태: **IMPLEMENTING**
- 현재 milestone: 3층 맵과 전체 진행 흐름 코드 통합, 브라우저 전체 완주 검증 진행 중

## 2. Core Learning Loop

```text
문제 발생
→ 제어실 직접 탐색
→ 카드 발견 / 내용 확인
→ AI와 단순 기계의 특징 비교
→ Ari와 최종 퀴즈
→ AI 특징 카드 3장 직접 선택
→ 카드 삽입 장치 작동
→ 단계적 전원 복구
→ 짧은 개념 복기
```

## 3. Story

### 3.1 문제 상황

플레이어는 전력이 꺼져 어두운 제어실에 들어온다.
처음에는 Ari가 직접 보이지 않고 `???`라는 정체불명의 목소리가 플레이어를 안내한다.

플레이어는 3층 제어실을 이동하며 총 6장의 카드를 찾는다.
카드는 AI 특징 3장과 단순 기계 특징 3장으로 구성된다.

6장의 카드를 모두 획득한 뒤 최종 구역까지 이동하면 Ari가 처음 모습을 드러내고, 시작부터 말을 걸었던 `???`가 자신이었다는 사실을 밝힌다.

이후 Ari의 퀴즈를 통과하고 AI 특징 카드 3장을 올바르게 선택해 카드 삽입 장치에 넣으면 제어실이 2단계로 복구된다.

### 3.2 시작 대사

```text
???: 거기 누구야?
???: 여기는 지금 전원이 꺼져 있어.
???: 안쪽으로 가려면, 여기저기 흩어진 카드 6개를 모두 찾아봐.
???: 전부 찾았다면 길 끝까지 와. 내가 기다리고 있을게.
```

첫 카드 획득 후 필요 시:

```text
???: 좋아. 그런 카드가 앞으로 5개 더 있어.
```

6번째 카드 획득 후:

```text
???: 전부 찾았네. 그럼 계속 앞으로 와.
```

### 3.3 Ari Reveal

```text
???: 여기까지 잘 왔네!

Ari: 아까부터 너한테 말하고 있던 건 바로 나였어.
Ari: 나는 이 제어실을 지키는 아리야.
Ari: 카드 6개도 전부 찾았네.
Ari: 그럼 카드에서 본 내용을 정말 이해했는지 확인해볼까?
Ari: 세 문제를 풀면 돼!
```

`[도전하기]`를 누르면 하트 3개가 표시되고 최종 퀴즈를 시작한다.

## 4. Map / World Structure

### 4.1 기본 규격

- 최종 맵: **3층 side-view 제어실**
- 목표 world size: **1536×960 px**
- Tiled 기준: **48×30 tiles**
- Tile size: **32×32 px**
- 3개 층의 세로 간격: 약 **320 px**
- 초기 기준 floor baseline:
  - 3F: 약 `y=190`
  - 2F: 약 `y=510`
  - 1F: 약 `y=830`
- 실제 asset 통합 시 시각적 바닥선과 collision을 맞추기 위해 소폭 조정 가능하나, 3층 동선 구조 자체는 변경하지 않는다.

### 4.2 이동 동선

```text
3F  [왼쪽 사다리] ─────────────────────── [Ari + 카드 삽입 장치]
                         Card 5   Card 6

2F  [왼쪽 사다리] ───────────────────── [오른쪽 사다리]
          Card 4                         Card 3

1F  [START] ───────────────────────── [오른쪽 사다리]
             Card 1          Card 2
```

실제 플레이 방향:

```text
1F: START →→→→→ 오른쪽 사다리
                    ↑
2F: 오른쪽 도착 ←←←←← 왼쪽 사다리
                         ↑
3F: 왼쪽 도착 →→→→→ Ari / 최종 장치
```

### 4.3 카드 배치 원칙

- 총 6장
- **층당 정확히 2장**
- 1F: Card 1, Card 2
- 2F: 이동 방향 기준 Card 3, Card 4
- 3F: Card 5, Card 6
- 6번째 카드 획득 후 자동 전환하지 않는다.
- 플레이어가 직접 3F 오른쪽 최종 구역까지 이동한다.

### 4.4 Background / Visibility

- 맵은 전력이 약하거나 꺼진 듯한 어두운 제어실 분위기다.
- 어둠은 gameplay obstacle이 아니다.
- 플레이어, 바닥, 사다리, 카드 발견 지점은 충분히 읽혀야 한다.
- flashlight / 제한 시야 mechanic은 사용하지 않는다.
- 최종 3F 오른쪽에는 **비활성 카드 삽입 장치가 제어실 환경에 통합**되어 있다.
- dark / Power Stage 1 / Power Stage 2 background를 scene에 연결했다. 후자의 두 이미지는 기존 dark 이미지를 참조한 조명 편집본이다.

### 4.5 Future Obstacle Extensibility

현재 scope에서는 장애물을 추가하지 않는다.
다만 움직이거나 사라지는 object는 background에 박지 않고 별도 Phaser/Tiled object로 유지한다.

향후 필요 시 예:
- `W`: 낮은 상자 넘기
- `E`: 잔해 치우기

이 기능은 현재 구현 blocker가 아니며, 기본 3층 플레이를 먼저 검증한 뒤 필요할 때만 추가한다.

## 5. Controls

### 5.1 Floor Movement

- 평지에서는 `← / →`만 사용한다.
- `↑ / ↓`는 일반 이동에 사용하지 않는다.

### 5.2 Ladder

- 사다리 interaction zone 안에서만:
  - `↑`: 올라가기
  - `↓`: 내려가기
- 사다리를 타는 동안 horizontal input은 잠그거나 단순화할 수 있다.
- 1F↔2F 오른쪽 사다리 1개
- 2F↔3F 왼쪽 사다리 1개

### 5.3 Card Interaction

- `Q`: 카드 획득
- 카드 발견 지점 근처에 있을 때만 `Q` indicator를 표시한다.
- 별도 `Q 누르기` 텍스트는 사용하지 않는다.
- `Q` 주위에 원형 pulse animation을 적용한다.

### 5.4 Card UI Close

- `X` 버튼
- 카드 바깥 영역 클릭
- `Esc`

## 6. Camera

- logical viewport: 기존 프로젝트의 **960×540**
- 초기 camera zoom: **1.5**
- 체감 visible world: 약 **640×360**
- horizontal camera follow 적용
- 화면 중앙 약 **35~40%**를 deadzone으로 사용
- vertical camera는 현재 층에 맞춰 lock/center
- 사다리로 층을 이동할 때만 다음 floor로 vertical transition
- camera zoom 적용 후 캐릭터가 여전히 작게 느껴지는지 확인한 뒤 sprite scale 재평가

## 7. Card Discovery / Pickup

### 7.1 바닥 표시

횡스크롤 side-view 특성상 세로형 카드 면을 바닥에 직접 보여주지 않는다.

- 바닥에 짧고 얇은 밝은 선
- 작은 sparkle / 반짝임 effect
- 플레이어가 가까워지면 `Q` + pulse

별도의 pickup 카드 그림은 만들지 않는다.

### 7.2 획득

```text
카드 발견 지점 접근
→ sparkle 확인
→ Q indicator 표시
→ Q 입력
→ pickup interaction
→ 해당 카드 획득 처리
→ 처음으로 카드 앞면 UI 표시
```

현재 캐릭터 pickup animation asset은 아직 없으므로 실제 animation은 후속 polish 작업이다.
기능 구현은 animation 없이도 먼저 검증 가능하다.

## 8. Card Visual Rules

### 8.1 공통 규칙

6장의 카드 모두:

- 동일한 front frame
- 동일한 back design
- 동일한 크기
- 동일한 형태
- 동일한 기본 색상

AI 카드 / 기계 카드를 색상, 테두리, 아이콘, 라벨 등으로 미리 구별하지 않는다.

사용하지 않는 요소:
- `AI`
- `M`
- `Machine`
- 정답/오답 표시
- 유형별 색상 coding

카드 종류는 **오직 앞면의 제목과 본문 내용으로 판단**한다.

### 8.2 Card Front

```text
[중립 공통 심볼 영역]
[제목]
[본문]
```

- 실제 제목 / 본문은 React DOM text로 올린다.
- 이미지 자체에는 교육 텍스트를 baked-in 하지 않는다.

### 8.3 Card Back

- 6장 모두 동일한 뒷면을 사용한다.
- 회로/기하학 계열의 공통 특수 문양을 사용한다.
- AI/기계 유형을 유추할 수 있는 표시는 사용하지 않는다.
- 실제 카드 삽입 연출에서는 front가 아니라 **back이 보이도록 한다.**

### 8.4 Asset Status

제작 완료:
- card front common asset
- card back common asset
- card insertion device:
  - empty
  - 1 card inserted
  - 2 cards inserted
  - 3 cards inserted
  - final activated
- device 5-state canvas size 통일 완료
- dark control-room background
- Power Stage 1 / Power Stage 2 background (`assets/background/background_power_stage_1.png`, `background_power_stage_2.png`)
- dark background 3F 오른쪽 final zone에 inactive device 통합
- Ari PNG 기존 asset 보유

아직 필요한 주요 visual asset:
- player walk left/right animation
- player pickup animation
- 필요 시 ladder climb animation
- quiz wrong-answer cutscene/panel asset

## 9. Card Contents

### 9.1 AI 특징 카드 3장

1. **데이터를 학습해요**
   - AI는 사람이 하나하나 규칙을 알려주지 않아도, 많은 데이터를 보면서 필요한 정보를 배울 수 있어요.

2. **패턴을 찾아요**
   - AI는 여러 데이터를 살펴보면서 반복해서 나타나는 공통점이나 규칙을 찾아낼 수 있어요.

3. **스스로 판단해요**
   - 학습한 내용을 바탕으로 새로운 상황을 살펴보고, 알맞은 답이나 행동을 판단할 수 있어요.

### 9.2 단순 기계 특징 카드 3장

4. **같은 설정이면 같은 결과만 내요**
   - 기계는 미리 정해 둔 설정이나 입력이 같으면, 보통 늘 같은 방식으로 작동해요.

5. **뜻을 이해하지 않고 신호에 반응해요**
   - 기계는 들어온 신호나 명령에 반응할 수는 있지만, 말이나 상황의 뜻을 스스로 이해하는 것은 아니에요.

6. **스스로 구별 기준을 만들지 못해요**
   - 기계는 여러 예시를 보고 공통점을 찾아 스스로 기준을 배우는 것이 아니라, 정해진 방식대로만 작동해요.

기계 카드 문장은 최종 퀴즈의 답을 그대로 말하지 않고, 퀴즈 상황에서 AI와 기계를 구분할 수 있도록 유추 가능한 특징만 제공한다.

## 10. Card Storage HUD

- 획득한 카드는 **화면 상단 중앙**에 최대 6개까지 계속 표시한다.
- 별도 inventory button / 펼침 목록 / inventory screen은 사용하지 않는다.
- 모든 카드가 같은 디자인이므로 AI/기계를 색으로 구분하지 않는다.
- 공통 card-back thumbnail 또는 중립 카드 slot 형태를 사용한다.
- 필요하면 슬롯 번호는 UI text로 보조할 수 있다.
- 획득한 HUD 카드를 클릭하면 해당 카드의 **앞면 UI를 다시 연다.**
- 카드 앞면 재확인은 최초 `Q` 획득 시와 동일한 UI를 사용한다.

## 11. Final Quiz / Hearts

퀴즈는 `product_prd.md`의 3문제를 사용한다.

- 탐색 중에는 하트를 표시하지 않는다.
- `[도전하기]` 이후 하트 3개 표시
- 각 문제는 한 번 판정
- 오답 시:
  - 하트 `-1`
  - 왜 틀렸는지 짧은 feedback
  - 같은 문제를 즉시 반복하지 않음
- 오답 feedback은 **2~3개의 짧은 visual panel/cutscene + Ari 짧은 설명** 방향
- 세부 컷 구성과 graphic은 아직 구현 전 최종 확정 대상
- 하트가 0이 되면:
  - 카드 6장 획득 상태 초기화
  - HUD 초기화
  - 플레이어를 1F 시작 위치로 복귀
  - 카드 수집부터 다시 시작

## 12. Post-Quiz Card Selection

퀴즈를 통과하면 바로 전원이 복구되지 않는다.

Ari의 안내 후 플레이어는 획득한 6장의 **앞면**을 다시 보고, 카드 삽입 장치에 넣을 AI 특징 카드 3장을 선택한다.

- 6장 모두 선택 가능
- AI / 기계 카드를 UI에서 미리 비활성화하지 않는다.
- 사용자가 **내용을 읽고 직접 3장을 판단**해야 한다.
- 동시에 최대 3장 선택
- 3장 미만 선택한 상태에서 `[넣기]` → warning
- 3장을 골랐지만 조합이 틀린 경우 → 장치 단계로 진행하지 않고 다시 선택
- 올바른 AI 카드 3장을 선택했을 때만 삽입 sequence로 진행

## 13. Card Insertion Device Sequence

카드 선택은 **앞면**, 실제 기계 장치에 들어가는 연출은 **뒷면**을 사용한다.

```text
Device Empty
→ Card Back 1장 삽입
→ Card Back 2장 삽입
→ Card Back 3장 삽입
→ Final Activated Device
```

- 모든 device state는 같은 canvas / 같은 구도 / 같은 scale
- 카드 슬롯 3개와 중앙 core가 단계적으로 활성화
- final state에서 core와 회로가 강하게 활성화되어 전원 복구 직전을 보여준다.

## 14. Power Restoration

장치 최종 활성화 후 제어실은 **2단계**로 복구한다.

### Stage 1 — Lighting Restore
- 기본 실내 조명 / 복도 조명 ON
- 바닥, 사다리, 벽 구조가 더 밝고 또렷
- 모니터와 주요 제어 시스템은 아직 대부분 OFF

### Stage 2 — System Restore
- 기존 조명 유지
- 모니터 / 제어 패널 / 콘솔 / 장비 indicator 활성화
- 최종 3F control zone도 완전히 활성화

두 background는 dark background와 **동일한 맵 구조 / 구도 / 사다리 / 장치 위치**를 유지해야 한다.

## 15. Completion

Power Stage 2 완료 후:

1. Ari가 AI와 단순한 기계의 핵심 차이를 짧게 복기
2. AI Basics 완료 상태 기록
3. Hub / 다음 관련 모듈로 이동 가능한 CTA 제공

최종 교육 메시지와 Hub CTA의 정확한 문구/동작은 아직 확정하지 않는다.

## 16. Current Gameplay Flow

```text
Dark 제어실 진입
→ ??? 시작 안내
→ 1F에서 ←/→ 탐색
→ sparkle card point 접근
→ Q + pulse
→ Q로 카드 획득
→ 해당 카드 앞면 최초 확인
→ X / 바깥 클릭 / Esc로 닫기
→ 상단 HUD에 카드 누적
→ HUD 클릭으로 언제든 앞면 재확인
→ 1F 카드 2장 수집
→ 오른쪽 사다리 ↑
→ 2F에서 오른쪽→왼쪽으로 이동하며 카드 2장 수집
→ 왼쪽 사다리 ↑
→ 3F에서 왼쪽→오른쪽으로 이동하며 카드 2장 수집
→ 6장 획득 후 계속 이동
→ 3F 오른쪽에서 Ari 등장 / ??? 정체 공개
→ [도전하기]
→ 퀴즈 3개 + 하트 3개
→ 실패(하트 0): 카드/HUD 초기화 + 1F 시작점 복귀
→ 퀴즈 통과
→ 카드 앞면 6장 중 AI 특징 카드 3장 선택
→ [넣기]
→ 정답 검사
→ Device Empty
→ 1장 삽입
→ 2장 삽입
→ 3장 삽입
→ Device Final Activated
→ Power Stage 1: 조명 ON
→ Power Stage 2: 시스템 ON
→ Ari 최종 설명
→ 완료
```

## 17. Tiled / Scene Data 권장 구조

```text
Background
Floor / Collision
Ladder
CardPoints
Ari
PlayerSpawn
FinalDevice
```

- background는 시각 환경
- collision / ladder / card point / spawn / final interaction은 별도 data
- 움직이거나 제거될 object를 background pixel에 고정하지 않는다.

## 18. 현재 구현 및 검증

- `?mode=ai-basics`는 독립 `AiBasicsScene` + React UI로 진입한다.
- 1536×960 visual background 위에 층 바닥선, 사다리 구역, 카드 지점, Ari endpoint를 별도 데이터로 둔다. Tiled 파일은 만들지 않았다.
- 1F→2F 오른쪽, 2F→3F 왼쪽 사다리, 좌우 이동, zoom 1.5, 수평 deadzone, 층별 세로 카메라 전환을 코드로 연결했다.
- 카드 6장 / HUD / 앞면 재확인 / 대사 / Ari reveal / 퀴즈 / 하트 reset / 카드 선택 / 장치 5상태 / 전원 2단계 / 완료 화면을 연결했다.
- 브라우저 직접 확인: dark 배경, 시작 대사, 플레이어, 좌우 이동, 평지 ↑/↓ 무시, 1F/2F/3F 카드 6장 Q 획득, 두 사다리 ↑, camera 층 전환, Esc 닫기, HUD 재열기, Ari reveal, 퀴즈 3문제, 오답 시 하트 감소와 3컷, 카드 선택 경고와 정답 분기, 장치 empty 시작, Ari 최종 설명, 완료 화면, 기본 지도학습 및 dev 진입.
- `npm test` 73 PASS, typecheck PASS, build PASS. 브라우저 미확인: 하트 0 전체 reset, 각 장치 중간 상태, Power Stage 1/2 각각의 표시 시간, 포인터 X/바깥 클릭.

## 19. 아직 미확정 / 후속 확정 사항

- 최종 교육 메시지 정확한 문구
- Hub / Machine Learning 연결 CTA 문구와 동작
- interaction range 최종 수치
- Q pulse의 최종 크기 / 속도 / 반복 주기
- 정확한 6개 CardPoint 좌표
- 미획득 HUD slot의 최종 표현
- quiz wrong-answer 2~3컷의 정확한 장면 구성
- card selection 화면의 최종 layout
- Power Stage 1 / Stage 2 이미지의 최종 아트 승인
- player walk / pickup / ladder animation 최종 asset
- card insertion 각 state의 전환 시간 / easing / sound
- 최종 sound / audio 여부

## 20. 현재 다음 작업

1. 하트 0 reset과 장치 1/2/3/final 및 Power Stage 1/2를 브라우저에서 각각 확인
2. 카드 선택 확대 미리보기와 포인터 X/바깥 클릭을 브라우저에서 확인
3. Power Stage 1 / 2 아트 정렬 검토
4. walk / pickup / climb 애니메이션 asset이 준비되면 연결
