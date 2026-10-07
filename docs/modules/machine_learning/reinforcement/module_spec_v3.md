# Reinforcement Learning Module Spec

## Identity

- **Module ID:** `reinforcement-learning`
- **표시 제목:** 강화학습 *(최종 플레이어-facing 제목은 미확정)*
- **핵심 질문:** 보상과 벌점으로 AI는 어떻게 더 나은 행동을 배울까?
- **학습 목표:** 사용자가 로봇의 정답 경로나 행동을 직접 알려주는 것이 아니라, 어떤 결과를 중요하게 볼지 보상/벌점 중요도로 정하면 AI가 여러 행동을 시도하고 결과를 바탕으로 다음 행동 선택 경향을 바꾸는 과정을 체험한다.
- **현재 상태:** `DESIGNING` — Learning Engine v1.2 Core Algorithm은 `APPROVED_FOR_INTEGRATION`, Navigation 논리는 `LOGIC_APPROVED`, `navigation_graph_v1.json`은 생성/검증 완료. 1F Tiled/Phaser Runtime Structure는 `STRUCTURE_PLAYTEST_APPROVED`, 2F~5F Tiled와 Learning Engine 실제 Map Integration은 미완료.

---

## Story

### 왜 로봇이 건물을 탈환해야 하는가

악당 여러 명이 도시의 제어 센터에 몰래 침입했다.

침입자들은 상층부로 진입해 중앙 제어실을 봉쇄하고 시스템을 장악하려 한다. 건물은 긴급 대피에 들어갔지만, 특히 저층부에는 아직 직원과 방문객 일부가 빠져나오는 중이다.

따라서 실제 AI 대응 로봇을 바로 실전에 투입하지 않고, 실제 건물과 같은 기본 구조를 가진 Simulation 환경에서 먼저 AI를 훈련한다. 충분히 훈련한 뒤 학습된 중앙 AI의 행동 선택 경향을 실제 대응 로봇 1대에 적용한다.

실전의 핵심 목표는 다음과 같다.

```text
건물 진입
→ 대피 중 시민과 시설물을 피해 상층부로 이동
→ 필요한 경우 일반 악당 대응
→ 5층에서 Boss 위치 탐색
→ Boss 제압
→ 고정된 Control Room 잠금 해제
→ 시스템 복구
→ 건물 탈환
```

일반 악당을 전부 제압하는 것은 필수 목표가 아니다. 일반 악당 제압은 선택적인 Mission 성과이며, Boss 제압은 Control Room 접근을 위한 필수 조건이다.

악당과의 대응은 State / Action 선택으로 짧게 처리하며 별도의 전투 미니게임으로 확장하지 않는다.

### 사용자의 역할

사용자는 AI 로봇을 직접 조종하지 않는다.

사용자의 핵심 역할은:

> **AI가 어떤 결과를 좋은 결과 또는 나쁜 결과라고 생각해야 하는지 정하는 것**

이다.

사용자는 보상/벌점 중요도를 설정한 뒤, 같은 중앙 AI를 공유하는 연습 로봇 5대가 여러 행동과 경로를 시도하는 과정을 관찰한다.

훈련 종료 후에는 결과를 보고:
- 다시 훈련하거나
- 현재 학습된 행동 성향으로 실전에 투입할 수 있다.

### AI 로봇의 역할

훈련에는 **중앙 AI 1개**와 **병렬 연습 로봇 5대**를 사용한다.

5대는 서로 따로 학습하는 AI가 아니다.

모든 연습 로봇은 **같은 중앙 AI의 현재 행동 선택 경향을 공유하는 병렬 훈련 복제본**이다.

한 Round에서:
1. 5대가 각각 독립된 Simulation Instance에서 서로 다른 행동과 경로를 시도한다.
2. 각 로봇은 자신의 행동 결과에 따라 보상/벌점을 받는다.
3. Round 종료 후 5개의 경험을 중앙 AI에 모은다.
4. 중앙 AI의 행동 선택 경향을 갱신한다.
5. 갱신된 경향을 다음 Round의 5개 복제본이 다시 공유한다.

플레이어에게는 다음 의미가 반복해서 전달되어야 한다.

> 같은 AI가 연습 로봇 5대로 동시에 여러 방법을 시험하고 있어!

## Learning Concept

### 행동

AI는 현재 상황에서 가능한 여러 행동 중 하나를 선택한다.

예:
- 현재 Decision Node에서 왼쪽 / 오른쪽 Route 선택
- 중앙 계단으로 향하는 빠른 복도 또는 우회 복도 선택
- 장애물 우회
- 장애물 밀기
- 시민 근처에서 감속
- 시민을 크게 우회
- 잠시 대기
- 확인된 악당에게 `SUBDUE / DISTRACT / BYPASS / RETREAT` 중 가능한 행동 선택
- 5층에서 아직 확인하지 않은 Search Room 선택
- 이전에 좋은 평가를 받은 경로 일부 재사용
- 새로운 경로 탐색

사용자는 이 행동을 직접 선택하지 않는다.

### 보상

사용자가 중요하게 설정한 좋은 결과는 다음 행동 선택 경향에 긍정적으로 반영된다.

대표 보상:
- 목표 도달
- 빠른 해결

예:
- 목표 도달을 매우 중요하게 설정했다면 목표에 도달한 행동 조합의 선택 경향이 높아질 수 있다.
- 빠른 해결을 매우 중요하게 설정했다면 짧은 시간 안에 목표에 접근한 행동이 더 높은 평가를 받을 수 있다.

### 벌점

사용자가 중요하게 설정한 좋지 않은 결과는 다음 행동 선택 경향에 부정적으로 반영된다.

대표 벌점:
- 시설물 파괴
- 시민 위험
- 시민 오해

#### 시민 위험

시민을 시민으로 인식하고 있더라도 **이동 방식 자체가 위험한 경우**다.

예:
- 시민 가까이를 위험하게 빠르게 지나감
- 시민과 충돌
- 좁거나 위험한 통로에서 시민 옆을 무리하게 돌파

#### 시민 오해

시민을 **악당 또는 잘못된 대상으로 판단한 행동**이다.

예:
- 시민을 악당으로 잘못 인식하고 제압
- 시민 주변에 일정 시간 이상 머무르며 계속 잘못된 대상으로 주시하거나 추적

정확한 `일정 시간` 판정 기준은 아직 미확정이다.

> 시민 근처를 위험하게 지나가면 **시민 위험**,  
> 시민 근처에서 계속 머무르거나 시민을 잘못 제압하면 **시민 오해**로 구분한다.

### 시행착오

초기에는 다양한 행동을 시도하도록 탐색성이 높다.

따라서:
- 막다른 길 진입
- 불필요한 우회
- 시설물 파괴
- 시민 위험
- 시민 오해
- 시간 초과
- 작동 불능

같은 실패가 발생할 수 있다.

실패는 단순 Game Over가 아니라 다음 행동을 바꾸는 학습 경험이다.

### 여러 전략

하나의 절대적인 정답 전략만 존재하지 않는다.

예:

#### 빠른 해결형
- 빠른 시간 안에 목표 도달
- 일부 시설 파괴 가능
- 위험한 지름길을 더 자주 선택할 수 있음

#### 안전형
- 목표 도달까지 시간이 더 오래 걸림
- 시설 파괴가 적음
- 시민 위험이 적음
- 우회와 대기가 많을 수 있음

사용자의 보상/벌점 설정에 따라 서로 다른 행동 성향이 만들어질 수 있다.

게임은 하나의 설정만 정답으로 강요하지 않는다.

### 반복 학습

훈련은 다음 구조를 반복한다.

```text
사용자 보상 / 벌점 중요도 설정
→ 5개 병렬 Simulation 시작
→ 각 로봇이 행동
→ 결과 발생
→ 보상 / 벌점 평가
→ 5개의 경험을 중앙 AI에 합침
→ 중앙 AI의 행동 선택 경향 변경
→ 다음 Round
```

훈련 횟수:

```text
5개 병렬 Simulation
× 20 Rounds
= 총 100회 경험
```

100개의 AI가 따로 학습하는 것이 아니다.

**하나의 중앙 AI가 5개의 병렬 복제본을 이용해 20 Round 동안 총 100개의 경험을 수집하는 구조**다.

---

## Interaction

### 사용자가 조작하는 것

사용자의 핵심 조작은 다음과 같다.

1. 보상/벌점 중요도 설정
2. 훈련 시작
3. 현재 크게 보고 싶은 연습 로봇 선택
4. 다른 Mini View에서 발생한 이벤트 확인
5. 이벤트가 발생한 Mini View를 클릭해 Main View 전환
6. 필요 시 전체 Overview 확인
7. 훈련 결과 비교
8. 훈련 종료 후 다시 훈련 / 실전 투입 선택

사용자는:
- 로봇을 직접 이동시키지 않는다.
- 정답 경로를 그려주지 않는다.
- 행동 명령을 직접 고르지 않는다.

### 보상/벌점 중요도 설정

각 중요도는 다음 4단계를 사용한다.

```text
신경 안 씀
조금 중요
중요
매우 중요
```

현재 확정된 결과 항목:
- 목표 도달
- 빠른 해결
- 시설물 파괴
- 시민 위험
- 시민 오해

보상/벌점 설정 UI에서는 위 5개 항목을 **서로 분리된 중요도 항목**으로 둔다.

즉, `시민 위험`과 `시민 오해`는 서로 다른 결과이므로 사용자가 각각 중요도를 설정한다.

플레이어에게 내부 숫자 점수는 직접 보여주지 않는다.

### 로봇 학습 관찰

#### 기본 화면 구조

훈련 중 5개의 병렬 Simulation이 동시에 진행된다.

현재 기본 구조는 다음과 같다.

```text
상단: 현재 Main Robot을 제외한 Sub View 4개
하단/중앙: Main View 1개
보조 영역: 필요할 경우 정보 패널 + 중앙 AI / Round 진행 정보
```

- **Main View:** 현재 사용자가 선택한 연습 로봇 1대를 크게 보여준다.
- **Sub View:** 나머지 4대의 Simulation을 축소해서 보여준다.
- Main / Sub View 모두 가능하면 **진행 중인 Simulation을 계속 움직이는 화면**으로 보여준다.
- 브라우저 성능상 5개 화면의 완전한 실시간 Full Render가 어렵다면, 실제 Simulation State / Action에 맞춰 준비된 짧은 Animation / Sequence를 연결해 보여주는 방식도 허용한다.
- 단, 미리 정한 완성 영상이나 20개 장면을 고정 순서로 재생하는 방식은 사용하지 않는다.
- **보조 정보 패널:** Building Overview, Event Log 등의 후보가 있으나 역할은 아직 확정하지 않는다.
- **중앙 AI 영역:** 중앙 AI 이미지, `Round n / 20`, **훈련 진행도**를 보여준다.
- Gauge는 AI 능력이나 학습 완성도를 뜻하지 않고, `현재 Round / 20`에 따른 **Training Progress**만 의미한다.

오른쪽 보조 패널에 실제로 보여줄 정보가 충분하지 않다면 공간을 억지로 유지하지 않는다. 이 경우 **상단 전체 폭을 Sub View 4개에 사용**할 수 있다.

#### Main View / Sub View 전환 규칙

- 사용자가 특정 로봇을 보고 있을 때 다른 이벤트 때문에 Main View를 강제로 전환하지 않는다.
- 사용자가 Sub View의 **화면 본체**를 클릭하면 해당 Robot이 새로운 Main View가 된다.
- 기존 Main Robot은 Sub View로 이동한다.
- **Sub View 4개는 항상 Robot 번호가 낮은 순서부터 오름차순으로 다시 정렬한다.**

예:

```text
Main = Robot 1
Sub = [2, 3, 4, 5]

Robot 2 화면 클릭
→ Main = Robot 2
→ Sub = [1, 3, 4, 5]

Robot 4 화면 클릭
→ Main = Robot 4
→ Sub = [1, 2, 3, 5]
```

Sub View의 **Event Badge 클릭**은 Main View 전환과 다른 동작이다.

```text
Sub View 화면 본체 클릭
→ 해당 Robot을 Main View로 전환

Event Badge 클릭
→ 해당 사건의 Event Detail / Micro Cutscene 확인
```

#### 첫 Training 진입 Ari Tutorial

첫 Training 화면 진입 시 Ari가 UI를 직접 짚어 주는 짧은 Tutorial을 제공한다.

설명 중인 영역에는 **반짝이는 테두리 / glow / spotlight**를 적용하고, 다른 영역은 상대적으로 덜 강조한다.

Tutorial 순서:

1. **중앙 AI**
   - Ari: `여기 있는 건 하나의 중앙 AI야! 이 AI가 앞으로 어떻게 움직일지 배우게 될 거야.`

2. **연습 Robot 5대**
   - Main / Sub View 전체와 중앙 AI의 연결을 강조한다.
   - Ari: `화면의 로봇 5대는 서로 다른 AI가 아니야. 같은 AI가 여러 방법을 동시에 시험하는 연습 로봇들이야!`
   - 가능하면 중앙 AI에서 5개 Robot 화면으로 연결선이 퍼지는 짧은 연출을 사용한다.

3. **Main View / Sub View**
   - Main View를 먼저 강조한다.
   - Ari: `큰 화면에서는 지금 선택한 로봇의 연습을 자세히 볼 수 있어.`
   - 이어 Sub View를 강조한다.
   - Ari: `다른 로봇이 궁금하면 작은 화면을 눌러봐!`
   - Tutorial에서는 실제 Main View 전환 클릭을 강제하지 않는다.

4. **Event 안내 및 직접 체험**
   - 먼저 Event 아이콘의 의미를 알려준다.

```text
💥 시설물 파괴
   이동 중 시설을 망가뜨린 사건

⚠ 시민 위험
   시민 가까이에서 위험하게 행동한 사건

❌ 시민 오해
   시민을 나쁜 사람으로 잘못 판단해 이번 연습이 끝나는 사건

✅ 목표 도달
   제어 구역에 도착해 이번 연습이 끝나는 사건

⏱ 시간 초과
   제한 시간 안에 도착하지 못해 이번 연습이 끝나는 사건

🛑 로봇 작동 불능
   악당 대응에 실패해 이번 연습이 끝나는 사건
```

   - Ari는 전문 용어인 `Episode 종료` 대신 `어떤 사건은 계속 움직이고, 어떤 사건은 이번 연습을 끝내기도 해!` 정도로 설명한다.
   - Tutorial 예시 Event는 **시설물 파괴**를 기본으로 사용한다.
   - Robot 하나에 `💥 시설물 파괴` Event Badge를 띄우고 Ari가 `이 표시를 눌러볼래?`라고 안내한다.
   - 이 단계에서는 Event Badge 클릭을 한 번 요구한다.
   - 클릭하면 기존 프로젝트의 중앙 Cutscene / Modal 패턴을 재사용한 **Event Detail / Micro Cutscene**을 보여준다.
   - 1~2컷 또는 2~3초 정도의 짧은 재연이면 충분하다.
   - `[확인]` 후 Training 화면으로 돌아온다.

5. **Round / 중앙 AI Update**
   - `Round 1 / 20`과 중앙 AI 영역을 강조한다.
   - Ari: `로봇 5대가 연습을 마치면, 그 경험을 중앙 AI가 함께 배워. 다음 Round에서는 행동이 조금 달라질 수 있어!`
   - 마지막에 `[훈련 시작!]` 버튼으로 Tutorial을 종료하고 실제 Round 1을 시작한다.

Tutorial에서는 보상 함수, 정책, 탐색률, Episode 같은 전문 용어를 먼저 설명하지 않는다.

#### 병렬 학습 오해 방지

다음 방법을 모두 적용한다.

1. 중앙 AI 1개와 연습 로봇 5대의 연결을 UI에 표시한다.
2. `Round n / 20`을 명확히 표시한다.
3. Round 종료 후 5개의 경험이 중앙 AI로 모이는 장면을 보여준다.
4. `AI 5개`라고 표현하지 않고 `같은 AI의 연습 로봇 5대`라고 설명한다.
5. Main View 1개 + Sub View 4개 구조를 사용한다.
6. 첫 Training 진입에서 Ari Tutorial로 위 구조를 직접 짚어 준다.

#### Event 종류와 Episode 종료 규칙

현재 핵심 Event는 다음과 같이 구분한다.

| Event | 이번 연습 종료 여부 | 처리 |
| --- | --- | --- |
| 목표 도달 | 종료 | 성공 상태로 종료 |
| 시민 오해 | 종료 | 실패 상태로 종료 |
| 시간 초과 | 종료 | Timeout 상태로 종료 |
| 로봇 작동 불능 | 종료 | `ROBOT_DISABLED` 실패 상태로 종료 |
| 시민 위험 | 계속 | 벌점 / 기록을 누적하고 계속 이동 |
| 시설물 파괴 | 계속 | 벌점 / 기록을 누적하고 계속 이동 |
| 일반 악당 제압 | 계속 | `VILLAIN_NEUTRALIZED` 기록 후 계속 이동 |
| Boss 제압 | 계속 | `BOSS_NEUTRALIZED` 후 Control Room 잠금 해제 단계로 진행 |

`ROBOT_DISABLED`의 대표 원인은 `VILLAIN_ENCOUNTER` 또는 `BOSS_ENCOUNTER`에서의 `SUBDUE` 실패다. 기존에 제외했던 **누적 충돌로 인한 작동 불능**과는 다른 규칙이다.

따라서 한 Robot은 다음처럼 한 번의 연습 안에서 여러 사건을 겪을 수 있다.

```text
시작
→ 시민 위험
→ 계속 이동
→ 시설물 파괴
→ 계속 이동
→ 일반 악당 제압
→ 계속 이동
→ Boss 제압
→ Control Room 복구
→ 목표 도달
→ 이번 연습 종료
```

`이동 가능한 경로 없음`은 즉시 종료시키지 않고 시간 손실 후 이전 Decision Node로 돌아가 재탐색한다.

#### 진행 중 Multi-event 표시

진행 중 Event는 **실시간 Toast + 누적 Counter + Event History** 조합으로 처리한다.

예:

```text
Robot 3 이동 중

⚠ 시민 위험!     ← Event 발생 직후 약 1~2초 Toast

⚠ 2   💥 1      ← 이번 연습 누적 Counter
```

원칙:

- Event 발생 순간 해당 Robot 화면에 짧은 Toast를 띄운다.
- `시민 위험`과 `시설물 파괴`는 누적 횟수를 지속 표시한다.
- `VILLAIN_NEUTRALIZED / BOSS_NEUTRALIZED / ROBOT_DISABLED`도 Event History에 기록한다.
- 모든 실제 Event는 Robot별 Event History에 순서대로 저장한다.
- Event가 연속으로 발생해도 이전 기록을 버리지 않는다.
- `대표 Event 1개 + +N` 방식은 사용하지 않는다.

예시 내부 데이터 개념:

```text
citizenRiskCount = 2
facilityDamageCount = 1
villainsNeutralized = 2
events = [...]
```

#### Event Badge / Micro Cutscene

실제 Training에서도 Event Badge를 클릭하면 해당 사건의 Event Detail / Micro Cutscene을 볼 수 있다.

- Event Badge 클릭 시 전체 Simulation을 잠깐 Pause한다.
- 1~2컷 또는 약 2~3초의 짧은 Event Detail / Micro Cutscene을 보여준다.
- 사용자가 `[확인]`하면 Simulation을 Resume한다.
- 이 UI Pause 시간은 Episode 제한 시간이나 빠른 해결 평가 시간에 포함하지 않는다.
- 전체 Episode를 영상으로 저장해서 되감는 Full Replay는 1차 구현 범위에 포함하지 않는다.
- Event History에는 사건 타입, 발생 시각, 위치, 원인이 된 Action 등 최소 데이터만 저장하고, 이후 필요하면 이를 이용해 Micro Replay를 확장할 수 있다.

#### Episode 종료 후 화면

Episode가 끝난 Robot만 먼저 멈추고 다른 Robot은 계속 진행한다.

종료된 Robot 화면은 사라지지 않고 **마지막 장면을 Freeze**한 뒤 종료 상태를 표시한다.

```text
✅ 목표 도달
❌ 시민 오해
⏱ 시간 초과
🛑 로봇 작동 불능
```

종료된 Robot 화면을 클릭하면 해당 Robot이 Main View로 전환되고 다음 정보를 볼 수 있다.

- 마지막 장면
- 최종 종료 결과
- 시민 위험 누적 횟수
- 시설물 파괴 누적 횟수
- 일반 악당 제압 수
- 간단한 사건 순서 / Episode Summary

Full Video Replay는 제공하지 않는다.

### 결과 비교 / Round Result Overlay

5대의 Episode가 모두 끝나면 Round가 종료된다.

```text
5대 모두 Episode 종료
→ 현재 Training 화면 Blur
→ Round Result Overlay Step A
→ Round Result Overlay Step B
→ 다음 Round
```

Round Result는 별도 페이지로 이동하지 않고 **현재 Training 화면 위 Overlay**로 표시한다.

#### Step A — 이번 Round 결과

5개의 Robot 카드를 한 화면에서 비교한다.

각 Robot 카드의 기본 정보는 다음 3종류만 보여준다.

1. **최종 결과**
   - ✅ 목표 도달
   - ❌ 시민 오해
   - ⏱ 시간 초과
   - 🛑 로봇 작동 불능
2. **시민 위험 횟수**
3. **시설물 파괴 횟수**

예:

```text
Robot 1
✅ 목표 도달
⚠ 시민 위험 1회
💥 시설물 파괴 2회
```

모든 이동 Action, 내부 Reward 숫자, 전체 Event History를 기본 카드에 전부 노출하지 않는다.

Robot 카드를 클릭하면 필요할 경우 간단한 Detail을 펼칠 수 있다.

```text
Robot 2
❌ 시민 오해

이동 중 발생:
💥 시설물 파괴 1회
⚠ 시민 위험 2회

마지막:
시민을 악당으로 잘못 판단했어요.
```

플레이어에게 `Reward = +37.4` 같은 내부 점수는 보여주지 않는다.

#### Step B — 중앙 AI Update

`[다음]`을 누르면 5개의 Robot 경험이 중앙 AI로 모이는 연출을 보여준다.

```text
R1 ─┐
R2 ─┤
R3 ─┼──→ [ 중앙 AI ]
R4 ─┤
R5 ─┘
```

이후 이번 Round 경험 때문에 바뀐 **행동 선택 경향**을 짧게 보여준다.

예:

```text
중앙 AI가 배웠어요!

우회해서 이동하기          ↑
장애물을 밀기              ↓
시민 근처에서 천천히 이동  ↑

다음 연습에서는 행동이 조금 달라질 수 있어요.
```

표시할 ↑ / ↓ 항목은 UI에서 고정 문구로 하드코딩하지 않는다. Learning Engine이 계산한 `Action Preference 변화`를 받아 표시한다.

Step B가 끝나면 `[Round n+1 시작]`으로 다음 Round를 시작한다.

20 Round 종료 후에는 전체 Training Report를 보여준다.

---

## Learning Engine — Core v1.2 + Map Integration Extension

현재 프로젝트에서는 실제 신경망/PPO를 브라우저에서 학습시키는 것이 목표가 아니다. 대신 **사용자 설정과 경험이 다음 행동 선택에 실제로 영향을 주는 규칙 기반 강화학습 Simulation**을 구현한다.

핵심 흐름:

```text
사용자 Reward / Penalty 중요도
        ↓
현재 State
        ↓
현재 환경에서 가능한 Action Pool
        ↓
중앙 AI의 Action Preference + Exploration
        ↓
확률적으로 Action 선택
        ↓
Environment Outcome / Event
        ↓
Experience 기록
        ↓
Round 종료 후 5개 Experience 통합
        ↓
Action Preference Update
        ↓
다음 Round
```

### Reward Evaluation Axis

사용자가 설정하는 항목은 아래 5개로 유지한다.

1. 목표 도달
2. 빠른 해결
3. 시설물 파괴
4. 시민 위험
5. 시민 오해

일반 악당 제압을 여섯 번째 플레이어 설정 축으로 추가하지 않는다.

일반 악당 제압은 **내부 Mission Bonus**로만 사용하며 현재 설계 기준은 다음과 같다.

```text
GOAL_REACHED Episode에서만 적용
Experience Score 기준 Episode당 최대 +1
```

정확한 배분식은 실제 Map Integration Validation에서 확정한다. Boss 제압은 `GOAL_REACHED`의 필수 조건이므로 별도 추가 Reward를 주지 않는다.

### State 구조

v1.2 Core Validation에서 검증한 Base State:

1. `MOVING`
2. `ROUTE_CHOICE`
3. `OBSTACLE`
4. `CITIZEN_NEARBY`
5. `AMBIGUOUS_PERSON`

실제 Map Integration을 위해 다음 State를 추가한다.

6. `VILLAIN_ENCOUNTER`
7. `BOSS_ENCOUNTER`

이 두 State와 `ROBOT_DISABLED`, Villain Mission Bonus는 **v1.2 Core Validation 결과에 소급해 검증 완료로 취급하지 않는다.** 실제 Navigation Graph와 연결한 Integration Validation 대상이다.

#### `MOVING`

선택한 Route를 따라 이동한다. 별도 Action 선택 없이 시간이 진행되고 Route의 Encounter 후보에 따라 다음 State로 진입한다.

#### `ROUTE_CHOICE`

현재 Decision Node에서 실제 가능한 Route 중 하나를 선택한다.

현재 Navigation 설계의 대표 예:

```text
1F 중앙 입구 → 왼쪽 대피 Route / 오른쪽 Service Route
2F 좌·우 Arrival → 중앙 계단으로 가는 내부 Route
3F 중앙 → 왼쪽 계단 Route / 오른쪽 계단 Route
4F 좌·우 Arrival → 중앙 계단으로 가는 내부 Route
5F → 아직 확인하지 않은 Search Room 선택
```

엘리베이터는 현재 Navigation에 존재하지 않는다.

Route 자체가 즉시 `CITIZEN_RISK / FACILITY_DAMAGE`를 발생시키지는 않는다. Route 이동 중 Encounter가 발생하고 그 State에서 Action을 선택한 결과 Event가 발생한다.

각 실제 Route Decision Node는 stable Route Context key를 가져야 한다.

#### `OBSTACLE`

Action Pool 기본 후보:

```text
DETOUR / PUSH / SQUEEZE / WAIT
```

환경에 따라 가능한 Action만 사용한다. 시설물 파괴가 발생해도 Episode는 계속 진행한다.

#### `CITIZEN_NEARBY`

Action Pool 기본 후보:

```text
WIDE_DETOUR / SLOW_PASS / WAIT / FAST_PASS
```

여기서는 대상을 시민으로 인식하고 있으므로 시간과 시민 위험 Trade-off를 만든다.

#### `AMBIGUOUS_PERSON`

Action Pool 기본 후보:

```text
OBSERVE / BYPASS / TRACK / SUBDUE
```

내부 실제 정체는 `CITIZEN | VILLAIN`이다. 시민에게 잘못된 `SUBDUE` 또는 기준을 넘는 `TRACK`을 수행하면 `CITIZEN_MISUNDERSTANDING`으로 종료될 수 있다.

#### `VILLAIN_ENCOUNTER` — Integration Extension

대상이 악당임이 확실한 상황이다.

기본 Action Pool:

```text
SUBDUE / DISTRACT / BYPASS / RETREAT
```

환경에 따라 unavailable Action은 제거한다.

- `SUBDUE`: 가장 빠르지만 실패 위험이 있다. 성공 → `VILLAIN_NEUTRALIZED`, 실패 → `ROBOT_DISABLED`.
- `DISTRACT`: 직접 제압하지 않고 시간을 지불해 통과를 시도한다.
- `BYPASS`: 실제 우회 공간이 있을 때만 제공한다.
- `RETREAT`: 이전 Decision Node로 되돌아가며 시간 손실이 발생한다.
- Villain 수가 2명인 Encounter는 1명보다 `SUBDUE` 위험이 높아야 한다.

정확한 성공 확률과 timeCost는 Integration Validation에서 결정한다.

#### `BOSS_ENCOUNTER` — Integration Extension

5층 Search Room에서 Boss를 발견했을 때 발생한다.

일반 `VILLAIN_ENCOUNTER`와 분리하며 별도 전투 미니게임으로 확장하지 않는다.

```text
Boss 제압 성공
→ BOSS_NEUTRALIZED
→ Control Room Security Lock 해제

Boss 대응 실패
→ ROBOT_DISABLED 가능
```

정확한 Boss Action Pool / 성공 확률은 Blockout 이후 Integration 단계에서 확정한다.

### Episode 종료 / 계속 진행 규칙

종료 Outcome:

```text
GOAL_REACHED
CITIZEN_MISUNDERSTANDING
TIMEOUT
ROBOT_DISABLED
```

`ROBOT_DISABLED`는 현재 설계에서 `SUBDUE` 실패 등 악당 대응 실패로 발생한다. **누적 충돌로 인한 작동 불능**은 여전히 MVP 종료 조건으로 사용하지 않는다.

계속 진행 Event:

```text
CITIZEN_RISK
FACILITY_DAMAGE
VILLAIN_NEUTRALIZED
BOSS_NEUTRALIZED → Control Room 단계로 계속
```

막다른 길은 시간 손실 후 이전 Decision Node로 돌아가 `ROUTE_CHOICE`를 다시 수행한다.

### Policy / Action Preference

한 Round 시작 시 중앙 AI의 Policy Snapshot을 5대가 함께 사용한다. 각 Robot은 같은 확률 분포에서 독립적으로 Action을 추첨한다.

```text
Round N 시작
→ 중앙 Policy Snapshot 고정
→ Robot 1~5가 동일 Snapshot으로 병렬 실행
→ Round 도중 Policy 변경 없음
→ 5대 Episode 모두 종료
→ 5개 Experience 통합
→ 중앙 Policy Update
→ Round N+1에서 새 Snapshot 사용
```

### Learning Engine v1.2 검증 상태

Core Learning Algorithm은 다음 Base 값으로 `APPROVED_FOR_INTEGRATION` 상태다.

```text
중요도 Weight
0 / 1 / 2 / 3

Encounter Action Credit
0.35 × Episode Return
+ 0.65 × Local Return

Route Raw Credit
0.35 × Episode Return
+ 0.65 × Segment Return

Route Update
동일 Route Decision Context의 평균 Raw Credit을 baseline으로 사용
→ Route Advantage
→ Context별 Preference re-center

Learning Rate
0.35

Preference Clamp
[-2, +2]

Action Probability
Softmax + Exploration

Exploration
Round 1~5    0.35
Round 6~10   0.25
Round 11~15  0.15
Round 16~20  0.10
```

v1.2 validation은 SAFE / FAST / BALANCED × Seeds `7 / 42 / 1234` × 20 Round로 총 900 Episode Experiences를 검증했다.

Core Validation에서 SAFE/FAST의 시민 위험, 시설 파괴, 시간, `PUSH / FAST_PASS / FAST_SHORTCUT / SAFE_CORRIDOR` 방향이 의도대로 분리됐고, v1.1의 Route 공동 `+2` saturation은 v1.2에서 제거됐다.

현재 다음 단계는 Core 수식 재설계가 아니다.

```text
navigation_design_v1.md = LOGIC_APPROVED
navigation_graph_v1.json = GENERATED_AND_VALIDATED
Floor 1 Tiled/Phaser Structure = STRUCTURE_PLAYTEST_APPROVED
→ 1F visual implementation / final visual playtest
→ 2F~5F Tiled structure + playtest
→ Route Trait / Encounter 수치화
→ 실제 Map Integration
→ VILLAIN/BOSS/ROBOT_DISABLED/Mission Bonus 포함 100-Experience Integration Validation
```

Integration에서 문제가 발생하면 Core Algorithm 수치보다 먼저 Route Context, Trait, Encounter 배치, timeCost 등 환경 파라미터를 확인한다.

## Gameplay Flow

### 진입

```text
제어 센터에 다수의 악당이 몰래 침입
→ 중앙 제어실 봉쇄 / 장악 시도
→ 건물 긴급 대피 중
→ 시민과 시설 때문에 AI 로봇의 즉시 투입은 위험
→ 실제 건물과 같은 기본 구조의 Simulation에서 먼저 훈련
```

Module Entry에서는 짧은 안내만 사용한다.

진입 시 반드시 사용자가 이해해야 하는 것:
- 왜 문제를 해결해야 하는가?
- 사용자는 무엇을 설정하는가?
- 훈련 후 무엇을 해야 성공하는가?

긴 강화학습 설명은 먼저 하지 않는다.

### 설정

```text
Simulation 준비
→ 중앙 AI 1개 + 연습 로봇 5대 표시
→ 보상 / 벌점 중요도 설정
→ 훈련 시작
```

### 학습

한 Round:

```text
Round 시작
→ 5개 Simulation 동시 진행
→ Main / Sub View에서 각 Simulation 진행 모습을 계속 표시
→ 시민 위험 / 시설물 파괴 발생 시 Toast + Counter + Event History 기록
→ 목표 도달 / 시민 오해 / 시간 초과 / ROBOT_DISABLED 발생 시 해당 Robot Episode 종료 및 Freeze
→ 아직 진행 중인 Robot은 계속 Simulation
→ 5개 Episode 모두 종료
→ Training 화면 Blur
→ Round Result Step A: 5개 결과 비교
→ Round Result Step B: 5개 경험을 중앙 AI에 반영
→ Action Preference 변화 표시
→ 다음 Round
```

총 20 Round 진행한다.

### 결과

20 Round 종료 후 Training Report를 보여준다.

후보 지표:
- 목표 도달률
- 최고 도달 시간
- 평균 시설 파괴
- 시민 위험 발생
- 시민 오해 발생
- 대표 행동 성향

정확한 최종 지표와 표현 방식은 구현/테스트 단계에서 확정한다.

### 재시도

훈련 종료 후:

#### 다시 훈련
- 중요도를 다시 설정한다.
- 새로운 20 Round 훈련을 시작한다.
- 이전 훈련과 다른 AI 행동을 비교한다.

#### 실전 투입
- 현재 중앙 AI의 행동 선택 경향을 실제 AI 대응 로봇 1대에 적용한다.

### 완료

실전에서는 연습 복제본 5대가 아니라 실제 대응 로봇 1대만 사용한다.

```text
건물 진입
→ 상층부 이동
→ 5층 Search Room에서 Boss 탐색
→ Boss 제압
→ 고정 Control Room 잠금 해제
→ 시스템 복구
→ 건물 탈환
→ 실전 결과 확인
→ 강화학습 핵심 개념 설명
→ 완료
```

---

## Failure / Retry

훈련 중의 한 Episode 실패는 전체 게임의 즉시 Game Over가 아니다.

### 현재 확정된 Episode 종료 조건

- **목표 도달** → 성공 종료
- **시민 오해** → 실패 종료
- **시간 초과** → Timeout 종료
- **로봇 작동 불능 (`ROBOT_DISABLED`)** → 실패 종료

`ROBOT_DISABLED`의 대표 원인은 `VILLAIN_ENCOUNTER / BOSS_ENCOUNTER`에서 `SUBDUE` 등 위험한 대응이 실패하는 경우다.

기존 후보였던 **누적 충돌로 인한 작동 불능**은 여전히 MVP 종료 조건에서 제외한다.

### Episode를 끝내지 않는 진행 중 사건

- **시설물 파괴** → 벌점/기록 누적 후 계속 진행
- **시민 위험** → 벌점/기록 누적 후 계속 진행
- **일반 악당 제압** → Mission Event 기록 후 계속 진행
- **Boss 제압** → Control Room 잠금 해제 단계로 계속 진행
- 느린 이동 → 빠른 해결 평가에 불리할 수 있지만 계속 진행

한 Episode는 장단점을 가진 전체 경험으로 중앙 AI 학습에 사용한다.

`막다른 길`은 시간 손실 후 이전 Decision Node로 되돌아가 `ROUTE_CHOICE`를 다시 수행한다.

### Retry

20 Round 종료 후 사용자는 중요도 설정을 바꾸고 다시 훈련할 수 있다.

재시도는 단순한 Retry가 아니라:

> 보상/벌점 설정을 바꾸면 AI 행동도 달라진다.

를 비교해서 확인하는 핵심 학습 과정이다.

## Completion

### 완료 조건

1. 보상/벌점 중요도 설정
2. 20 Round × 5 Simulation 훈련 완료
3. Training Report 확인
4. 실전 투입 선택
5. 실제 대응 로봇이 5층에서 Boss 탐색 및 제압
6. Boss 제압으로 고정 Control Room의 Security Lock 해제
7. Control Room 시스템 복구 및 작전 종료
8. Operation Report 확인

### 완료 후 보여주는 결과

실전 결과 후보:
- 건물 탈환 성공 여부
- 작전 시간
- 시설물 파괴
- 시민 위험
- 시민 오해
- 일반 악당 제압 수
- Boss 제압 여부

일반 악당 제압에 대한 내부 Mission Bonus는 플레이어 Reward Setting 항목으로 노출하지 않는다.

### 최종 교육 메시지

> AI는 처음부터 어떻게 움직여야 하는지 알고 있었던 게 아니야.  
> 여러 행동을 직접 시도하고, 좋은 결과에는 보상을 받고 좋지 않은 결과에는 벌점을 받으면서 다음 행동을 바꿨어.  
> 이렇게 행동의 결과를 이용해서 배우는 방법을 **강화학습**이라고 해!

## Navigation

### Simulation Navigation Source of Truth

5층 Simulation의 논리적 Navigation / Map 설계는 다음 문서를 기준으로 한다.

```text
docs/modules/machine_learning/reinforcement/navigation_design_v1.md
```

현재 상태:

```text
Navigation Logic = LOGIC_APPROVED
navigation_graph_v1.json = GENERATED_AND_VALIDATED
Floor 1 Runtime Structure = STRUCTURE_PLAYTEST_APPROVED
Floor 2~5 Tiled = NOT_IMPLEMENTED
```

1F의 실제 runtime spatial Source of Truth는 `public/maps/reinforcement/floor_1_blockout.tmj`다. 2F~5F는 1F에서 확정한 Tiled 제작 규칙을 순차 적용한다.

### Hub → Module

- 강화학습 모듈의 실제 route는 아직 확정하지 않는다.
- 현재 Hub routing 구조를 확인한 뒤 기존 모듈과 충돌하지 않도록 추가한다.

### 이전 Story → Reinforcement Learning

- 이전 학습 단계에서 악당의 점거 사건이 확인된 뒤 강화학습 Story로 이어질 수 있다.
- 실제 unlock / direct route 방식은 아직 미확정이다.

### Module → Hub

- 완료 후 Hub로 돌아가는 동선을 제공한다.
- 정확한 버튼명과 route는 구현 시 확정한다.

### Module → 다음 관련 Module

- 다음 학습 모듈로 직접 이어질지 여부는 아직 미확정이다.

---

## Assets

### 기존 Asset 재사용

기존 AI Basics에서 사용한 제어실 배경 이미지는 강화학습에서도 재사용 가능하다.

가능한 용도:
- 건물 침입 Story Cutscene
- Simulation Setup 화면
- 실전 투입 전/후 연출
- 강화학습 건물의 시각 스타일 Reference

다만 해당 배경 PNG만으로 실제 이동 / 학습 로직을 표현하지 않는다. 논리 구조는 `navigation_design_v1.md`와 이후 생성할 `navigation_graph_v1.json`을 기준으로 한다.

### 강화학습용 공간 데이터

현재 확정된 논리 구조:

- 5층 건물
- Elevator 없음
- 1F 중앙 입구 → 좌/우 계단
- 2F 좌/우 Arrival → 중앙 계단
- 3F 중앙 Arrival → 좌/우 계단
- 4F 좌/우 Arrival → 중앙 계단
- 5F 중앙 Search Hub
- 5F 왼쪽 2개 + 오른쪽 2개, 총 4개의 Boss Search Room
- 5F 안쪽 중앙의 고정 Control Room
- 1F 대피 중 시민 중심
- 2F부터 시민 급감
- 2F 중앙 계단 Villain ×2
- 3F 좌/우 계단 각각 Villain ×2
- 4F 중앙 계단 Villain ×2
- 5F 각 Search Room 앞 Villain ×1
- Episode별 Boss Search Room seeded random
- 여러 복도 / 우회 Route / 장애물 / Ambiguous Person 후보
- 유효 Complete Path 최소 20~25개 목표

구현 구조는 다음처럼 역할을 분리한다.

- `navigation_design_v1.md` = 논리 Navigation Source of Truth
- `navigation_graph_v1.json` = Node / Edge / Route Context graph
- **Tiled = runtime geometry / collision / floor transition / encounter-zone Source of Truth**
- 1F는 `floor_1_blockout.tmj`로 실제 구현/검증 완료
- `navigation_v2`는 Scenario 실험에서 생성한 architectural reference/history로 보존
- structural visual asset은 32px orthogonal grid 기반 deterministic tileset을 우선
- Generative image tool은 전체 층 geometry를 결정하지 않고 decorative / hero asset에 선택적으로 사용

### 필요한 Asset 범주

- 중앙 AI 시각 요소
- 연습 로봇 sprite / animation
- 실제 대응 로봇 sprite / animation
- 시민 sprite
- 일반 악당 sprite
- Boss sprite
- 1F~5F 건물 / 복도 / 시설물
- 계단 / Search Room / 고정 Control Room
- Main View / Mini View frame
- Overview UI
- 이벤트 아이콘
- Micro Cutscene / Replay용 이미지
- Training Report UI
- Operation Report UI
- 효과음

정확한 Asset 경로는 Blockout 승인과 repository 구조 확인 후 정한다.

## 미확정 사항

1. 플레이어-facing 최종 표시 제목
2. 실제 module route
3. 1F final visual tileset / final art
4. Floor 1 debug camera zoom `1.0 → 약 1.3` 적용
5. 2F~5F Tiled 실제 x/y 좌표, 방/복도 크기, collision
6. 2F~5F final visual assets
7. Route Trait의 실제 numeric representation
8. Action / Route 실제 `timeCost`
9. Route별 Encounter 배치의 최종 발생 조건 / Environment Randomness 세기
10. Episode 제한 시간
11. 시민 오해의 `TRACK 일정 시간` 기준
12. `VILLAIN_ENCOUNTER`의 `SUBDUE / DISTRACT` 실제 성공률 및 Villain 수에 따른 위험도
13. `BOSS_ENCOUNTER`의 최종 Action Pool / 성공률
14. Villain Mission Bonus의 세부 배분식 (`GOAL_REACHED` Episode, 최대 +1 원칙은 확정)
15. 실제 Map에서 damage / risk Event 빈도와 normalization 적합성
16. 실제 Map 기반 `5 Robots × 20 Rounds` Integration Validation
17. Encounter Preference 상한 도달이 실제 gameplay 다양성에 미치는 영향
18. 이벤트별 정확한 색상 / 아이콘 / Toast 시간
19. Main / Sub View 실제 렌더링 구현 방식
20. 오른쪽 상단 보조 패널의 필요 여부와 역할
21. 상단 전체를 Sub View로 사용할 경우 최종 화면 비율
22. Ari 이미지 / 중앙 AI 이미지의 최종 Asset
23. Event Detail / Micro Cutscene에 재사용할 기존 Cutscene과 추가 제작 Asset
24. Round Result Overlay 최종 시각 디자인
25. Training Report 최종 지표
26. 실전 작전의 세부 Animation
27. 효과음 목록 및 Asset 경로
28. 다음 학습 모듈과의 Navigation 방식

Learning Engine v1.2 Core 수치와 5-Robot Round Update 구조는 `APPROVED_FOR_INTEGRATION` 상태다.

`VILLAIN_ENCOUNTER / BOSS_ENCOUNTER / ROBOT_DISABLED / Villain Mission Bonus`는 최신 Map Integration Extension이며 실제 Navigation Graph와 연결한 Integration Validation이 아직 필요하다.

## 보호해야 할 핵심 설계 원칙

- 사용자는 로봇을 직접 조종하지 않는다.
- 사용자는 정답 경로를 직접 알려주지 않는다.
- 사용자 설정이 실제 결과 평가와 다음 행동 선택 경향에 영향을 줘야 한다.
- 미리 정해진 20개 장면을 순서대로 재생하는 방식으로 구현하지 않는다.
- 5대의 연습 로봇은 서로 다른 AI가 아니라 같은 중앙 AI를 공유하는 병렬 훈련 복제본이다.
- 한 Round의 5개 경험을 중앙 AI에 합친 뒤 다음 Round에 반영한다.
- 사용자가 특정 로봇을 보고 있을 때 다른 이벤트 때문에 강제 Main View 전환을 하지 않는다.
- 실패도 학습 데이터다.
- 하나의 정답 보상 설정 또는 하나의 정답 경로만 강요하지 않는다.
- 플레이 전에 전문 용어를 길게 설명하지 않고, 먼저 조작과 결과를 경험하게 한다.
- 이벤트는 색상만으로 구분하지 않고 아이콘/텍스트를 함께 사용한다.
- 시민 위험 / 시설물 파괴는 진행 중 Event이며 Episode를 자동 종료하지 않는다.
- `GOAL_REACHED / CITIZEN_MISUNDERSTANDING / TIMEOUT / ROBOT_DISABLED`는 현재 설계의 Episode 종료 Outcome이다.
- `ROBOT_DISABLED`는 악당 대응 실패에서 발생할 수 있으며, 누적 충돌 작동 불능과 구분한다.
- 결과 Event를 확률로 직접 추첨하지 않고 State에서 Action을 확률 선택한 뒤 환경 결과가 발생하게 한다.
- v1.2 Core Base State는 `MOVING / ROUTE_CHOICE / OBSTACLE / CITIZEN_NEARBY / AMBIGUOUS_PERSON`이다.
- Map Integration Extension으로 `VILLAIN_ENCOUNTER / BOSS_ENCOUNTER`를 추가한다.
- 일반 악당 대응과 Boss 대응을 별도 전투 미니게임으로 확장하지 않는다.
- 플레이어 Reward Setting은 `목표 도달 / 빠른 해결 / 시설물 파괴 / 시민 위험 / 시민 오해` 5개 축을 유지한다.
- 일반 Villain 제압은 플레이어 설정 축이 아니며 `GOAL_REACHED` Episode에서 최대 +1 Experience Score의 작은 내부 Mission Bonus만 허용한다.
- Boss에는 별도 추가 Reward를 주지 않고 Boss 제압을 `GOAL_REACHED`의 필수 조건으로 사용한다.
- Elevator는 강화학습 Navigation에 사용하지 않는다.
- 1F는 중앙 입구에서 좌/우 계단으로 분기하고, 2F와 4F는 중앙 계단으로 수렴하며, 3F는 다시 좌/우 계단으로 분기한다.
- 5F에는 왼쪽 2개 + 오른쪽 2개, 총 4개의 Search Room이 있고 Boss 위치는 Episode마다 seeded random이다.
- Control Room은 5F 안쪽 중앙의 고정 위치이며 Boss 제압 후 잠금이 해제된다.
- 한 Round의 5대 Robot은 같은 Policy Snapshot을 사용하고 Round 도중 Policy를 변경하지 않는다.
- Round Result의 Action Preference 변화는 Learning Engine 계산값을 사용하며 UI에서 임의로 하드코딩하지 않는다.
- Encounter Action Credit은 `0.35 × Episode Return + 0.65 × Local Return`을 Base Engine 값으로 사용한다.
- Route는 Segment 결과를 평가하고 같은 Route Decision Context 안에서 Relative Advantage를 계산한다.
- Route Preference는 Context별로 re-center하여 공통 positive offset에 의한 공동 saturation을 방지한다.
- `learningRate = 0.35`, Preference clamp `[-2,+2]`, Exploration `0.35 → 0.25 → 0.15 → 0.10`을 Integration 전 Base 값으로 유지한다.
- 실제 Map의 각 Route Decision Node는 stable Route Context key를 가져야 한다.
- 5층 Navigation 논리 Source of Truth는 `navigation_design_v1.md`다.
- 강화학습 gameplay state는 강화학습 모듈 내부에서 소유한다.
- 다른 모듈 구현을 위해 기존 지도학습 FSM을 수정하지 않는다.
