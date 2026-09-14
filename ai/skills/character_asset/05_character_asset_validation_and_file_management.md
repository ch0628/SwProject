# Character Asset 검수 / PASS-WARN-FAIL / 파일 관리 기준

## 1. 목적

이 문서는 STEP 1~4의 캐릭터 Asset 제작 결과를 사용자가 직접 검수할 수 있도록 한다.

목표:
- 매번 AI에게 "잘 나왔는지" 묻지 않아도 됨
- Scale Validation 전에 문제를 빠르게 찾음
- 수정이 필요한 단계와 그대로 진행 가능한 단계를 구분
- 파일 구조를 일정하게 유지

---

# 2. 단계별 검수

## STEP 1 — Species Master Reference 1차 검수

확인:

- [ ] 4방향이 모두 존재하는가
- [ ] 같은 캐릭터로 보이는가
- [ ] Species가 한눈에 읽히는가
- [ ] 원하는 체형인가
- [ ] 기본 의상이 단순한가
- [ ] 과도하게 무섭거나 사실적이지 않은가
- [ ] 이후 의상/장비를 추가할 여지가 있는가

### PASS
- 전체 체형과 Species 방향이 원하는 수준
- 4방향 identity가 대체로 일치
- 수정은 디테일 수준

→ STEP 2로 이동

### WARN
- 방향별 체형 차이 약간 있음
- 옷/표정/무늬 일부 수정 필요
- top-down 느낌이 약함

→ STEP 2에서 보정

### FAIL
- 전혀 다른 체형
- 방향마다 다른 캐릭터
- 게임용이 아닌 일반 일러스트
- 지나치게 사실적/공격적
- Species 특징이 약함

→ STEP 1 다시 생성

---

## STEP 2 — Master Reference 보정 검수

확인:

- [ ] STEP 1 identity를 유지했는가
- [ ] 요청한 수정만 반영되었는가
- [ ] Down/Up/Left/Right Scale이 과도하게 다르지 않은가
- [ ] Left / Right가 서로 대응되는가
- [ ] top-down 2.5D 시점이 느껴지는가
- [ ] 작은 화면에서 실루엣이 읽히는가

### PASS
- Master Reference로 사용 가능
- 이후 Sheet 제작 기준으로 충분함

→ STEP 3로 이동

### WARN
- 일부 방향이 약간 더 크거나 작아 보임
- 세부 디테일이 약간 많음
- 캐릭터성은 유지됨

→ 게임 Scale 검증에서 판단 가능하면 진행

### FAIL
- 기존 identity가 사라짐
- 방향 간 체형 차이가 큼
- 특정 방향이 다른 시점
- 새 캐릭터처럼 변함

→ STEP 2 다시 수정

---

## STEP 3 — Game-ready Sheet 검수

확인:

- [ ] 순서가 Down / Left / Right / Up인가
- [ ] 동일한 크기의 4개 셀인가
- [ ] 전체 Width가 4로 정확히 나누어지는가
- [ ] 배경이 투명하거나 제거하기 쉬운가
- [ ] 격자/라벨/텍스트가 없는가
- [ ] 캐릭터가 셀 경계에 잘리지 않았는가
- [ ] 충분한 투명 여백이 있는가
- [ ] 방향별 Scale을 임의로 맞추지 않았는가

### PASS
- deterministic crop 바로 가능
- 여백 충분
- 캐릭터 identity 유지

→ STEP 4

### WARN
- 캐릭터가 셀 가장자리에 가까움
- Scale Validation에는 문제 없음
- 향후 Walk/Run에는 padding 부족 가능

→ STEP 4 진행 가능
→ Animation 제작 전 개선 검토

### FAIL
- 셀 폭이 제각각
- 텍스트/격자가 캐릭터와 겹침
- 캐릭터 일부 clipping
- 방향별 resize 발생
- 배경이 캐릭터와 섞여 제거 어려움

→ STEP 3 재생성

---

## STEP 4 — Crop 결과 검수

### 기술 검수

- [ ] 네 파일 Width 동일
- [ ] 네 파일 Height 동일
- [ ] PNG
- [ ] RGBA 또는 Alpha Channel 존재
- [ ] 원본 Pixel Size 유지
- [ ] 방향별 resize 없음
- [ ] trim 없음
- [ ] padding 변경 없음

### 시각 검수

- [ ] Down이 올바른 방향
- [ ] Left가 올바른 방향
- [ ] Right가 올바른 방향
- [ ] Up이 올바른 방향
- [ ] 발/귀/꼬리가 잘리지 않음
- [ ] 같은 캐릭터로 보임
- [ ] 방향별 상대 Scale 유지

### PASS
- 네 Canvas Size 동일
- Alpha 정상
- clipping 없음
- 원본 Scale 유지

→ Phaser Scale Validation 진행

### WARN
- 셀 가장자리와 가까움
- 방향별 체감 Scale 약간 차이
- 디테일이 많은 편

→ Scale Validation에는 사용 가능
→ Animation 제작 전에 재검토

### FAIL
- 파일 크기가 다름
- Alpha 손실
- 방향 잘못 분리
- 캐릭터 일부 잘림
- resize / trim 발생
- 한 방향만 명백히 다른 크기

→ Crop 다시 수행

---

# 3. 공통 PASS / WARN / FAIL 정의

## PASS

다음 작업으로 넘어가도 되는 상태.

의미:
- 현재 단계 목적을 충족
- 사소한 미관 문제만 존재
- 후속 단계에 영향을 주지 않음

원칙:
> 완벽함이 아니라 "다음 단계로 넘어가도 재작업 위험이 낮은가"를 기준으로 판단한다.

---

## WARN

현재 단계에서는 사용 가능하지만 기록해야 하는 문제.

예:
- 여백 부족
- 방향별 체감 Scale 소폭 차이
- 세부 디테일 과다
- 작은 시각적 불일치

원칙:
> 지금 수정 비용보다 후속 Scale Validation에서 확인하는 편이 효율적이면 진행한다.

---

## FAIL

후속 작업 전에 반드시 수정해야 하는 상태.

예:
- 캐릭터 identity 불일치
- clipping
- Alpha 손실
- 잘못된 방향
- 임의 resize
- 파일 크기 불일치
- 게임용 시점이 아님

원칙:
> FAIL 상태에서는 Animation이나 다른 Species 양산을 시작하지 않는다.

---

# 4. Phaser Scale Validation 전 최종 체크

4방향 Asset을 게임에 넣기 전에:

- [ ] Species Master Reference 저장
- [ ] Game-ready Sheet 저장
- [ ] Down / Left / Right / Up 네 파일 저장
- [ ] 네 파일 크기 동일
- [ ] Alpha 존재
- [ ] 방향명 정상
- [ ] bottom-center를 기준으로 사용할 수 있음
- [ ] 캐릭터가 잘리지 않음

이 단계에서 PASS이면 실제 맵에서 Scale을 검증한다.

---

# 5. 권장 파일 관리 구조

```text
assets/
└─ characters/
   └─ [species]/
      ├─ reference/
      │  ├─ master_v1.png
      │  ├─ master_v2.png
      │  └─ game_ready_sheet.png
      │
      ├─ base/
      │  ├─ [species]_down.png
      │  ├─ [species]_left.png
      │  ├─ [species]_right.png
      │  └─ [species]_up.png
      │
      └─ animations/
         ├─ idle/
         ├─ walk/
         ├─ run/
         ├─ talk/
         ├─ interact/
         └─ reaction/
```

---

# 6. 파일명 규칙

## Species

영문 소문자 사용:

```text
tiger
rabbit
fox
cat
dog
```

## Reference

```text
master_v1.png
master_v2.png
game_ready_sheet.png
```

## Base Direction

```text
tiger_down.png
tiger_left.png
tiger_right.png
tiger_up.png
```

## Animation

향후 예:

```text
tiger_idle_down.png
tiger_idle_left.png

tiger_walk_down.png
tiger_walk_left.png
```

Sprite Sheet 형식 확정 후 파일명 규칙을 추가 조정할 수 있다.

---

# 7. Source 파일 보존 원칙

AI 생성 원본을 덮어쓰지 않는다.

예:

```text
reference/
├─ master_v1.png
├─ master_v2.png
└─ game_ready_sheet.png
```

수정본은 새 버전으로 저장한다.

금지:

```text
master.png
master_final.png
master_final2.png
진짜최종.png
```

---

# 8. 현재 프로젝트 공통 기준

- PC / Laptop Web
- Landscape
- Top-down 2.5D
- Pixel Art
- Tile Size: 32×32
- Direction: 4-way
- Anchor: Bottom Center
- Depth: 발 위치 Y 기준

General NPC Animation:
- Idle
- Walk
- Run
- Talk
- Interact
- Reaction

Optional Special Action:
- Manhole Enter / Exit
- Peek From Behind
- Whisper / Secret Talk
- Sneak Take Object
- Look Around → Run
- Carry Box / Bag

Scale Validation이 끝나기 전에는 Species별 최종 Sprite Frame Size를 확정하지 않는다.
