# Reinforcement Learning — Session Handoff

## 현재 상태

- **Module ID:** `reinforcement-learning`
- **전체 Module 상태:** `DESIGNING`
- **Learning Engine 상태:** `v1.2 / APPROVED_FOR_INTEGRATION`
- **Navigation Design 상태:** `v1 / APPROVED_FOR_BLOCKOUT`
- Core Learning Algorithm은 기존 multi-seed validation에서 `PASS_CANDIDATE`를 받았고 실제 Map Integration의 Base Engine으로 사용한다.
- 5층의 논리 Navigation, 계단 구조, 층별 역할, 일반 Villain 배치, 5F Boss Search / 고정 Control Room 구조를 `navigation_design_v1.md`에 확정했다.
- 실제 `navigation_graph_v1.json`, 1F~5F SVG Blockout, 실제 Map/Phaser gameplay 연결은 아직 생성하지 않았다.
- 최신 Map Integration Extension으로 `VILLAIN_ENCOUNTER / BOSS_ENCOUNTER / ROBOT_DISABLED / Villain Mission Bonus`를 추가했다. 이 부분은 실제 Map Integration Validation 전이다.
- **다음 핵심 작업은 Codex로 Navigation Graph + 1F~5F SVG Blockout을 생성하고 사람이 검토하는 것**이다.
- Source of Truth:
  1. `docs/modules/machine_learning/reinforcement/module_spec_v3.md`
  2. `docs/modules/machine_learning/reinforcement/learning_engine_v1.md`
  3. `docs/modules/machine_learning/reinforcement/navigation_design_v1.md`
  4. `docs/modules/machine_learning/reinforcement/session_handoff_v3.md`
- 이 문서는 다음 세션이 현재 결정 사항을 잃지 않고 바로 이어서 작업하기 위한 Handoff다.

## 현재까지 확정된 사항

### 1. 핵심 학습 목표

플레이 후 사용자가 이해해야 하는 핵심은:

> AI가 여러 행동을 시도하고, 받은 보상과 벌점을 이용해 다음 행동 선택을 바꾸며 더 나은 행동을 배운다.

사용자는:
- 로봇을 직접 조종하지 않는다.
- 정답 경로를 그리지 않는다.
- 어떤 행동을 하라고 직접 명령하지 않는다.

---

### 2. Story

- 악당 여러 명이 도시 제어 센터에 몰래 침입한다.
- 침입자들은 상층부 중앙 제어실을 봉쇄하고 시스템 장악을 시도한다.
- 건물은 긴급 대피 중이며 1층에는 시민이 가장 많이 남아 있다.
- 2층부터 시민은 급격히 줄고 상층부는 일반 악당 / 보안 구역 비중이 커진다.
- 실제 AI 대응 로봇을 바로 투입하지 않고 Simulation에서 먼저 훈련한다.
- 훈련 완료 후 중앙 AI의 행동 선택 경향을 실제 대응 로봇 1대에 적용한다.
- 5층에는 왼쪽 2개 + 오른쪽 2개 총 4개의 Search Room이 있다.
- Boss는 Episode마다 네 Search Room 중 하나에 seeded random으로 존재하고 Robot은 실제 위치를 모른다.
- Control Room은 5층 안쪽 중앙의 **고정 위치**다.
- Boss는 Control Room Security Lock의 접근 권한/키를 가지고 있으며 Boss를 제압해야 Control Room이 열린다.
- Boss 제압 후 Control Room에서 시스템을 복구하면 `GOAL_REACHED`다.
- 일반 악당을 전부 제압하는 것은 필수 목표가 아니다.
- 일반 악당 / Boss 대응을 별도 전투 미니게임으로 키우지 않는다.

### 3. 사용자 역할

사용자의 핵심 조작:

1. 보상/벌점 중요도 설정
2. 훈련 시작
3. 현재 보고 싶은 연습 로봇 선택
4. Mini View 이벤트 확인
5. 이벤트가 발생한 다른 로봇을 Main View로 전환
6. 필요 시 Overview 확인
7. Training Report 비교
8. 다시 훈련 / 실전 투입 선택

---

### 4. 보상 / 벌점 중요도

중요도 단계:

```text
신경 안 씀
조금 중요
중요
매우 중요
```

현재 결과 항목:

- 목표 도달
- 빠른 해결
- 시설물 파괴
- 시민 위험
- 시민 오해

보상/벌점 설정 UI에서는 위 5개 항목을 각각 별도 중요도 항목으로 둔다.

내부 숫자 점수는 플레이어 UI에 직접 노출하지 않는다.

---

### 5. 시민 위험 / 시민 오해 구분

#### 시민 위험

시민을 시민으로 인식하고 있지만 이동 방식이 위험한 경우.

예:
- 시민 가까이를 위험하게 빠르게 지나감
- 시민과 충돌
- 위험한 통로에서 시민 옆을 무리하게 돌파

#### 시민 오해

시민을 잘못된 대상으로 판단한 경우.

예:
- 시민을 악당으로 잘못 인식하고 제압
- 시민 주변에 일정 시간 이상 머무르며 계속 잘못된 대상으로 주시/추적

정확한 시간 threshold는 아직 미확정이다.

판정 원칙:

```text
시민 근처를 위험하게 지나감
→ 시민 위험

시민 근처에서 계속 머무름
또는 시민을 잘못 제압
→ 시민 오해
```

---

### 6. 병렬 훈련 구조

- 중앙 AI 1개
- 같은 중앙 AI를 공유하는 연습 로봇 5대
- 5대는 서로 따로 성장하는 AI가 아니다.
- 각 로봇은 독립된 Simulation Instance에서 서로 다른 행동을 시도한다.
- 한 Round가 끝나면 5개의 경험을 중앙 AI에 합친다.
- 중앙 AI의 행동 선택 경향을 갱신한다.
- 갱신된 경향을 다음 Round의 5대가 다시 공유한다.

훈련 횟수:

```text
5 robots × 20 rounds = 100 experiences
```

병렬 구조의 목적은:
- 100회의 경험을 하나씩 순차적으로 보여줄 때 생기는 지루함을 줄이고
- 동시에 여러 시행착오가 일어나는 모습을 보여주며
- 같은 AI가 여러 경험을 빠르게 수집하는 느낌을 전달하는 것

이다.

---

### 7. 병렬 학습 오해 방지 방법

다음 5개를 **전부 적용**하기로 했다.

1. 중앙 AI 1개와 연습 로봇 5대의 연결을 UI에 항상 표시
2. `Round n / 20`을 명확히 표시
3. Round 종료 후 5개의 경험이 중앙 AI로 모이고 행동 경향이 바뀌는 장면 표시
4. “AI 5개”라고 표현하지 않고 “같은 AI의 연습 로봇 5대”라고 설명
5. Main View 1개 + Mini View 4개 구조 사용

---

### 8. Training View

현재 기본 구조:

```text
상단: Main Robot을 제외한 Sub View 4개
하단/중앙: Main View 1개
보조 영역: 필요할 경우 정보 패널 + 중앙 AI / Round 진행 정보
```

- Main View 1개와 Sub View 4개에서 각 Robot Simulation 진행 모습을 계속 보여준다.
- 가능하면 실시간으로 표시하되, 브라우저 성능상 어려우면 실제 Simulation State / Action에 맞는 사전 제작 Animation / Sequence를 연결한다.
- 고정된 완성 영상/장면을 순서대로 재생하는 방식은 사용하지 않는다.
- 오른쪽 상단 보조 패널은 필수가 아니다.
- 의미 있는 정보가 부족하면 상단 전체 폭을 Sub View 4개에 사용한다.
- 중앙 AI 영역에는 중앙 AI 이미지, `Round n / 20`, **훈련 진행도**를 표시한다.
- Gauge는 AI 능력 %가 아니라 Training Progress다.

---

### 9. Main View / Sub View 전환

- 다른 Event가 발생해도 Main View를 강제로 바꾸지 않는다.
- Sub View의 화면 본체를 클릭하면 해당 Robot이 Main View가 된다.
- 기존 Main Robot은 Sub View로 이동한다.
- Sub View는 항상 Main Robot을 제외한 Robot 번호 오름차순으로 정렬한다.

```text
Main 1 → Sub [2, 3, 4, 5]
Main 2 → Sub [1, 3, 4, 5]
Main 4 → Sub [1, 2, 3, 5]
```

- Event Badge 클릭은 Main View 전환이 아니라 Event Detail / Micro Cutscene을 연다.

---

### 10. Event / Episode 규칙

현재 확정된 Episode 종료 Event:

- 목표 도달 → 성공 종료
- 시민 오해 → 실패 종료
- 시간 초과 → Timeout 종료
- `ROBOT_DISABLED` → 실패 종료

`ROBOT_DISABLED`의 대표 원인은 일반 악당 또는 Boss 대응에서 위험한 Action이 실패하는 경우다.

Episode를 끝내지 않는 진행 중 Event:

- 시민 위험 → 누적 후 계속 진행
- 시설물 파괴 → 누적 후 계속 진행
- `VILLAIN_NEUTRALIZED` → 일반 악당 제압 기록 후 계속 진행
- `BOSS_NEUTRALIZED` → Control Room 잠금 해제 단계로 계속 진행

한 Robot에서 한 Episode 동안 여러 Event가 발생할 수 있다.

진행 중 UI:

```text
Event 발생
→ 해당 Robot 화면에 약 1~2초 Toast
→ 필요한 Counter / Event History 저장
→ Terminal이 아니면 Simulation 계속
```

`대표 Event + +N` 방식은 사용하지 않는다.

Episode가 끝난 Robot만 마지막 장면에서 Freeze하고, 나머지 Robot은 계속 진행한다.

5대 모두 Episode 종료 시 Round가 종료된다.

### 11. Event Detail / Micro Cutscene

- 실제 Training에서 Event Badge를 클릭하면 해당 사건 Detail / Micro Cutscene을 볼 수 있다.
- 이때 전체 Simulation을 잠깐 Pause한다.
- 1~2컷 또는 약 2~3초의 짧은 연출을 사용한다.
- `[확인]` 후 Resume한다.
- UI Pause 시간은 Episode 제한 시간 / 빠른 해결 평가 시간에 포함하지 않는다.
- Full Episode Video Replay는 1차 구현 범위에서 제외한다.
- Event History에는 사건 타입, 시각, 위치, 원인 Action 등 최소 데이터만 저장한다.

종료 Robot을 클릭하면 Main View에서:
- 마지막 장면
- 최종 종료 결과
- 시민 위험 횟수
- 시설물 파괴 횟수
- 간단한 Event Timeline / Episode Summary

를 확인할 수 있다.

---

### 12. Ari Training UI Tutorial

첫 Training 진입에서 Ari가 spotlight / glow를 이용해 화면을 직접 설명한다.

순서:

1. 중앙 AI
   - `여기 있는 건 하나의 중앙 AI야!`
2. 연습 Robot 5대
   - `서로 다른 AI가 아니라 같은 AI가 여러 방법을 동시에 시험하는 연습 로봇들이야!`
   - 중앙 AI → 5대 연결 연출 권장
3. Main / Sub View
   - 큰 화면은 자세히 보기
   - 작은 화면 본체를 누르면 Main View 전환
4. Event 안내 및 직접 체험
   - 💥 시설물 파괴
   - ⚠ 시민 위험
   - ❌ 시민 오해
   - ✅ 목표 도달
   - ⏱ 시간 초과
   - `어떤 사건은 계속 움직이고, 어떤 사건은 이번 연습을 끝내기도 해!`
   - Tutorial 예시는 시설물 파괴 Event
   - 실제 Event Badge를 한 번 클릭하게 함
   - 기존 중앙 Cutscene / Modal 계열 UI를 재사용해 Event Detail / Micro Cutscene 표시
5. Round / 중앙 AI Update
   - `5대의 경험이 모이면 중앙 AI가 함께 배우고, 다음 Round에서는 행동이 조금 달라질 수 있어!`
6. `[훈련 시작!]` → 실제 Round 1

Tutorial에서는 정책, 탐색률, Episode 같은 전문 용어를 먼저 설명하지 않는다.

---

### 13. Round Result Overlay

5대 모두 종료되면 Training 화면을 Blur하고 같은 화면 위에 2단계 Overlay를 띄운다.

#### Step A — 이번 Round 결과

각 Robot 카드에 기본적으로:
- 최종 결과: 목표 도달 / 시민 오해 / 시간 초과 / 로봇 작동 불능
- 시민 위험 횟수
- 시설물 파괴 횟수

만 보여준다.

카드를 클릭하면 간단한 Episode Detail을 펼칠 수 있다.

내부 Reward 숫자는 플레이어에게 보여주지 않는다.

#### Step B — 중앙 AI Update

5개 Experience가 중앙 AI로 모이는 연출 후 Learning Engine이 계산한 Action Preference 변화를 보여준다.

예:

```text
우회해서 이동하기          ↑
장애물을 밀기              ↓
시민 근처에서 천천히 이동  ↑
```

↑ / ↓ 항목은 UI에서 하드코딩하지 않고 실제 Learning Engine 결과를 사용한다.

이후 `[Round n+1 시작]`으로 다음 Round를 시작한다.

---

### 14. Learning Engine — State / Action 구조

결과 Event를 직접 확률 추첨하지 않는다.

```text
사용자 Reward / Penalty 중요도
→ 현재 State
→ 현재 환경에서 가능한 Action Pool
→ Action Preference + Exploration
→ Action 확률 선택
→ Environment Outcome / Event
→ Experience 기록
→ Round의 5 Experience 통합
→ Action Preference Update
→ 다음 Round
```

#### Reward Evaluation Axis

사용자 설정은 기존 5개 독립 축을 유지한다.

- 목표 도달
- 빠른 해결
- 시설물 파괴
- 시민 위험
- 시민 오해

일반 악당 제압을 플레이어 설정 축으로 추가하지 않는다.

일반 악당 제압은 `GOAL_REACHED` Episode에서만 Experience Score 최대 +1 범위의 아주 작은 내부 Mission Bonus로 사용할 수 있다. 세부 배분식은 Integration Validation에서 확정한다.

Boss는 별도 추가 Reward를 주지 않는다.

#### Core v1.2 State

1. `MOVING`
2. `ROUTE_CHOICE`
3. `OBSTACLE`
4. `CITIZEN_NEARBY`
5. `AMBIGUOUS_PERSON`

#### Map Integration Extension State

6. `VILLAIN_ENCOUNTER`
   - 확인된 악당과 마주친 상황
   - 기본 Action 후보: `SUBDUE / DISTRACT / BYPASS / RETREAT`
   - 환경에 따라 unavailable Action 제거
   - `SUBDUE` 성공 → `VILLAIN_NEUTRALIZED`
   - `SUBDUE` 실패 → `ROBOT_DISABLED`
   - Villain ×2가 ×1보다 위험해야 함

7. `BOSS_ENCOUNTER`
   - 5F Search Room에서 Boss 발견 시 발생
   - 일반 Villain Encounter와 분리
   - 별도 전투 미니게임으로 확대하지 않음
   - 성공 → `BOSS_NEUTRALIZED` → Control Room Lock 해제
   - 실패 → `ROBOT_DISABLED` 가능

이 신규 State/Outcome은 v1.2 Core Validation에서 이미 검증됐다고 간주하지 않는다. 실제 Navigation Graph Integration Validation 대상이다.

#### Navigation Design v1

`navigation_design_v1.md`가 논리 Navigation Source of Truth다.

```text
1F
중앙 입구 → 좌/우 계단
시민 대피 중심

2F
좌/우 Arrival → 중앙 계단
중앙 계단 Villain ×2

3F
중앙 Arrival → 좌/우 계단
각 계단 Villain ×2

4F
좌/우 Arrival → 중앙 계단
중앙 계단 Villain ×2

5F
중앙 Search Hub
→ L1 / L2 / R1 / R2 Search Room
→ 각 방 앞 Villain ×1
→ Boss 위치 seeded random
→ Boss 제압
→ 고정 Control Room
→ GOAL_REACHED
```

Elevator는 사용하지 않는다.

#### Episode 종료 / 계속 규칙

종료:
- `GOAL_REACHED`
- `CITIZEN_MISUNDERSTANDING`
- `TIMEOUT`
- `ROBOT_DISABLED`

계속:
- `CITIZEN_RISK`
- `FACILITY_DAMAGE`
- `VILLAIN_NEUTRALIZED`
- `BOSS_NEUTRALIZED` 후 Control Room 단계

막다른 길은 시간 손실 후 이전 Decision Node로 복귀해 재탐색한다.

기존에 제외했던 **누적 충돌 작동 불능**은 여전히 사용하지 않는다.

#### Round Policy Snapshot 규칙

- 5대 Robot은 같은 중앙 AI의 Policy Snapshot을 공유한다.
- Round 시작 시 Snapshot을 고정한다.
- 5대는 같은 확률 분포에서 독립적으로 Action을 추첨한다.
- Round 도중 한 Robot의 결과 때문에 다른 Robot의 Policy가 즉시 변하지 않는다.
- 5대 Episode가 모두 끝난 후 Experience를 합쳐 중앙 Policy를 한 번 Update한다.
- 새 Policy는 다음 Round부터 사용한다.

#### Learning Engine v1.2 — 검증 완료 상태

Core Learning Engine은 다음 값으로 `APPROVED_FOR_INTEGRATION` 상태다.

```text
Weight
0 / 1 / 2 / 3

Encounter Credit
0.35 × Episode Return
+ 0.65 × Local Return

Route Raw Credit
0.35 × Episode Return
+ 0.65 × Segment Return

Route Update
Context별 Raw Credit 평균 baseline
→ Relative Advantage
→ Context별 Preference re-centering

Learning Rate
0.35

Preference Clamp
[-2, +2]

Probability
Softmax + Exploration

Exploration
Round 1~5   0.35
Round 6~10  0.25
Round 11~15 0.15
Round 16~20 0.10
```

v1.2에서 SAFE/FAST 주요 행동 및 Route 방향과 Route saturation 수정이 multi-seed validation을 통과했다.

다음 Learning Engine 검증은 실제 Map에 연결한 **Integration Validation**이다.

### 15. 여러 전략 허용

하나의 정답 보상 설정만 존재하지 않는다.

예:

#### 빠른 해결형
- 빠르게 목표 도달
- 일부 시설 파괴 가능

#### 안전형
- 더 오래 걸림
- 시설 파괴 적음
- 시민 위험 적음

보상/벌점 중요도에 따라 다른 행동 성향이 나와야 한다.

---

### 16. Failure / Retry

한 Episode의 실패는 전체 게임의 즉시 Game Over가 아니다.

현재 확정 종료 조건:
- 목표 도달 → 성공 종료
- 시민 오해 → 실패 종료
- 시간 초과 → Timeout 종료
- `ROBOT_DISABLED` → 실패 종료

진행 중 계속되는 사건:
- 시민 위험
- 시설물 파괴
- 일반 악당 제압
- Boss 제압 후 Control Room 단계

실패/위험 Event도 모두 학습 데이터로 사용한다.

막다른 길은 시간 손실 후 이전 Decision Node로 되돌아가 `ROUTE_CHOICE`를 다시 수행한다.

누적 충돌로 인한 작동 불능은 MVP 종료 조건에서 제외하지만, 악당 대응 실패로 인한 `ROBOT_DISABLED`는 사용한다.

20 Round 종료 후 사용자는 중요도를 바꿔 다시 훈련할 수 있다.

### 17. 훈련 종료 후

20 Round 완료 후 Training Report 표시.

사용자 선택:

#### 다시 훈련
- 중요도 변경
- 새로운 20 Round 시작
- 이전 결과와 비교

#### 실전 투입
- 현재 중앙 AI의 행동 선택 경향을 실제 대응 로봇 1대에 적용

실전 종료 후 Operation Report를 보여주고 강화학습 개념을 설명한다.

---

### 18. 기존 AI Basics 제어실 배경

기존 AI Basics에서 사용한 제어실 배경은 강화학습에서도 재사용 가능하다.

재사용 후보:
- 건물 점거 Cutscene
- Simulation Setup
- 실전 투입 전/후 연출
- 건물 Visual Style Reference

하지만 강화학습의 실제 경로/이동 로직에는 구조화된 공간 데이터가 별도로 필요하다.

현재 우선 구조:
- **Visual Background + Logic Navigation Graph 분리**
- `navigation_design_v1.md` → `navigation_graph_v1.json` + 1F~5F SVG Blockout
- Blockout 승인 후 층별 Pixel-art Background 제작

Tiled는 실제 제작 과정에서 필요성이 확인될 경우 추가하며 현재 필수 조건은 아니다.

---

## 아직 미확정인 사항

1. 플레이어-facing 최종 제목
2. 강화학습 module route
3. `navigation_graph_v1.json`의 실제 Node / Edge / 좌표
4. 1F~5F SVG Blockout의 최종 공간 배치
5. Tiled 사용 여부
6. Route Trait 실제 numeric representation
7. Action / Route 실제 `timeCost`
8. Route별 Encounter 최종 발생 조건 / Environment Randomness 세기
9. Episode 제한 시간
10. 시민 오해 `TRACK 일정 시간` 기준
11. `VILLAIN_ENCOUNTER`의 `SUBDUE / DISTRACT` 실제 성공률
12. Villain ×1 / ×2 위험도 차이의 정확한 값
13. `BOSS_ENCOUNTER` 최종 Action Pool / 성공률
14. Villain Mission Bonus 세부 배분식
15. 실제 Map에서 damage / risk Event 빈도와 normalization 적합성
16. 실제 Map 기반 `5 Robots × 20 Rounds` Integration Validation
17. Encounter Preference 상한 도달이 실제 gameplay 다양성에 미치는 영향
18. 이벤트별 정확한 색상 / 아이콘 / Toast 시간
19. Main / Sub View 실제 렌더링 구현 방식
20. 오른쪽 상단 보조 패널 필요 여부와 역할
21. 상단 전체 Sub View 레이아웃 최종 비율
22. 중앙 AI / Ari 최종 Asset
23. Event Detail / Micro Cutscene 재사용/추가 Asset
24. Round Result Overlay 최종 시각 디자인
25. Training Report 최종 지표
26. 실제 작전의 세부 Animation
27. 효과음 목록 및 Asset 경로
28. 완료 후 다음 모듈 연결 방식

## 보호해야 할 기존 기능

### 프로젝트 공통

- Hub는 Navigation만 담당한다.
- 강화학습 gameplay state는 강화학습 모듈 내부에서 소유한다.
- 강화학습 구현 때문에 기존 지도학습 FSM을 수정하지 않는다.
- 기존 AI Basics와 지도학습 동작을 깨지 않는다.
- PC / 노트북 웹 브라우저 우선 원칙을 유지한다.
- 기존 React + TypeScript + Vite / Phaser 4 구조를 유지한다.
- 모바일 지원을 새 요구사항으로 추가하지 않는다.
- 로그인 / DB / 서버를 강화학습 때문에 새로 추가하지 않는다.

### 강화학습 모듈 핵심

- 사용자가 로봇을 직접 조종하지 않는다.
- 사용자가 정답 경로를 직접 알려주지 않는다.
- 사용자 설정이 실제 결과 평가와 다음 행동 선택에 영향을 줘야 한다.
- 미리 정한 장면을 순서대로 재생하는 가짜 학습 구조로 만들지 않는다.
- 5대는 하나의 중앙 AI를 공유한다.
- 한 Round의 5개 경험을 다음 Round에 실제 반영한다.
- 특정 로봇을 보는 중 다른 이벤트로 Main View를 강제 전환하지 않는다.
- 실패도 학습 데이터다.
- 하나의 정답 설정을 강요하지 않는다.
- 전문 용어 설명보다 먼저 조작과 결과를 경험하게 한다.
- 이벤트는 색상만으로 구분하지 않는다.
- `GOAL_REACHED / CITIZEN_MISUNDERSTANDING / TIMEOUT / ROBOT_DISABLED`는 Episode를 종료한다.
- 시민 위험 / 시설물 파괴는 Episode 중간 Event로 누적하고 계속 진행한다.
- 일반 Villain 제압은 필수 성공 조건이 아니다.
- Boss 제압은 Control Room 탈환의 필수 조건이다.
- 일반 Villain/Boss 대응을 별도 전투 미니게임으로 확장하지 않는다.
- 플레이어 보상/벌점 중요도는 기존 5개 평가 축을 유지한다.
- 일반 Villain Mission Bonus는 플레이어 설정에 추가하지 않고 성공 Episode에서 최대 +1 Experience Score로 제한한다.
- Boss에는 별도 추가 Reward를 주지 않는다.
- Core State 5개에 Map Integration Extension `VILLAIN_ENCOUNTER / BOSS_ENCOUNTER`를 추가한다.
- 누적 충돌 작동 불능은 사용하지 않지만 악당 대응 실패의 `ROBOT_DISABLED`는 terminal로 사용한다.
- 결과 Event를 직접 확률 추첨하지 않고 State에서 Action을 확률 선택한 뒤 Outcome이 발생하게 한다.
- 한 Round의 5대 Robot은 같은 Policy Snapshot으로 시작하고 Round 도중 Policy를 변경하지 않는다.
- Elevator는 Navigation에서 사용하지 않는다.
- 1F 중앙 입구 → 좌/우 계단, 2F 중앙 계단, 3F 좌/우 계단, 4F 중앙 계단 구조를 보호한다.
- 5F 네 Search Room과 Episode별 seeded-random Boss 위치, 고정 중앙 Control Room 구조를 보호한다.
- `navigation_design_v1.md`를 Navigation 논리 Source of Truth로 사용한다.
- Round Result의 행동 경향 변화는 Learning Engine 계산 결과를 사용한다.
- Core Learning Engine v1.2를 실제 Map Integration의 Base Engine으로 사용한다.
- Encounter Credit은 `0.35 Episode + 0.65 Local`, Route는 `0.35 Episode + 0.65 Segment` 후 Context별 Relative Advantage를 사용한다.
- 한 Route Decision Context의 Preference는 Update 후 평균 0으로 re-center한다.
- 실제 Map의 각 Route Decision Node는 stable Route Context key를 가져야 한다.
- Integration 검증 전까지 `learningRate = 0.35`, clamp `[-2,+2]`, Exploration Schedule을 임의로 다시 튜닝하지 않는다.

## 다음 작업 순서

### 1. Codex Navigation Blockout 생성 — 현재 다음 작업

`navigation_design_v1.md`는 `APPROVED_FOR_BLOCKOUT` 상태다.

Codex가 먼저 다음 산출물을 만든다.

```text
navigation_graph_v1.json
floor_1_blockout.svg
floor_2_blockout.svg
floor_3_blockout.svg
floor_4_blockout.svg
floor_5_blockout.svg
```

Blockout은 최종 Art가 아니다. 다음을 검토하기 위한 논리 / 시각 초안이다.

- Node 위치
- Edge 연결
- Route 분기 / 합류
- 층간 계단 연결 일치
- Encounter 배치 공간
- 5F 네 Search Room + 고정 Control Room 구조
- 2.5D 한 층 단위 화면 가독성

### 2. Path Enumeration / Graph Sanity Validation

Codex 또는 별도 script로 실제 Graph를 검사한다.

확인:

- START → GOAL 유효 Complete Path 수
- 목표 `20~25+` 충족 여부
- trivial one-side path 존재 여부
- unreachable Node / accidental dead end
- dominated Route
- 층간 Stair 연결 일치
- 5F Search Room 재방문 방지 가능 여부
- stable Route Decision Context key 유일성 / 일관성

### 3. 사람 검토 후 Blockout 수정

SVG 5장을 직접 읽고 다음을 검토한다.

- 각 층의 목적이 시각적으로 전달되는가
- 좌/우 Route의 Trade-off가 실제 공간으로 납득되는가
- 시민 / 장애물 / Ambiguous / Villain Encounter 위치가 억지스럽지 않은가
- 5F Boss Search 동선이 지나치게 반복적이지 않은가

문제가 있으면 이 단계에서 `navigation_design_v1.md` 또는 Graph를 수정한다.

### 4. Route Trait / Environment Parameter 설계

Blockout 승인 후 실제 Graph의 Edge에:

- `timeCost`
- `citizenExposure`
- `obstacleChance`
- `ambiguousPersonChance`
- `narrowness`
- Encounter 위치 / 발생 조건

등을 구체화한다.

### 5. Learning Engine v1.2 Integration Validation

Navigation Graph를 Learning Engine과 연결한 뒤:

```text
5 Robots × 20 Rounds
= 100 Episode Experiences
= 20 Central Policy Updates
```

를 실제 Map 기준으로 실행한다.

추가 검증:

- `VILLAIN_ENCOUNTER`
- `BOSS_ENCOUNTER`
- `ROBOT_DISABLED`
- Boss Room seeded random
- hidden Boss 위치 누출 방지
- Villain Mission Bonus `0` vs `max +1`
- SAFE / FAST Trade-off 유지

### 6. 실제 Gameplay / Pixel-art Map 구현

Blockout과 Integration 결과가 통과한 뒤 최종 층별 Pixel-art Map과 Phaser gameplay를 연결한다.

### 7. Browser / Regression 검증

- Browser Smoke Test
- AI Basics 회귀 확인
- 지도학습 회귀 확인
- Typecheck / Build / Test
- 5개 병렬 Simulation UI 성능
- 20 Round 전체 gameplay
- Reward Profile별 행동 차이

## 다음 세션 시작 시 읽을 문서

우선순위:

1. `docs/modules/machine_learning/reinforcement/navigation_design_v1.md`
2. `docs/modules/machine_learning/reinforcement/module_spec_v3.md`
3. `docs/modules/machine_learning/reinforcement/learning_engine_v1.md`
4. `docs/modules/machine_learning/reinforcement/session_handoff_v3.md`
5. `docs/modules/machine_learning/reinforcement/validation/learning_engine_validation_v1_2.md`
6. `docs/project/module_contract.md`
7. `docs/modules/machine_learning/reinforcement/concept_rules.md`

과거 validation 문서는 History 용도로만 사용한다.

충돌할 경우:

```text
현재 사용자의 최신 지시
→ navigation_design_v1.md (Navigation / Map 논리)
→ module_spec_v3.md (Module 전체 설계)
→ learning_engine_v1.md (Engine 기술 규칙)
→ session_handoff_v3.md (현재 작업 상태)
→ learning_engine_validation_v1_2.md (Core v1.2 검증 기록)
→ module_contract.md
→ concept_rules.md / 과거 문서
```

## 다음 세션 시작점

Reward 수식이나 3-Round Simulation을 다시 처음부터 논의하지 않는다.

현재 기준:

```text
Learning Engine v1.2
= APPROVED_FOR_INTEGRATION

Navigation Design v1
= APPROVED_FOR_BLOCKOUT
```

먼저 다음 문서를 읽는다.

```text
navigation_design_v1.md
module_spec_v3.md
learning_engine_v1.md
session_handoff_v3.md
validation/learning_engine_validation_v1_2.md
```

그 다음 바로:

```text
Codex Blockout 생성
→ navigation_graph_v1.json
→ floor_1_blockout.svg ~ floor_5_blockout.svg
→ path enumeration / graph sanity check
→ 사람 검토
→ 수정 / Blockout 승인
→ Route Trait / Encounter 수치화
→ 실제 Map 100-Experience Integration Validation
```

순서로 진행한다.
