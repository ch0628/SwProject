# Reinforcement Learning — Learning Engine v1

> **Current algorithm revision:** `v1.2`

## Status

- **State:** `APPROVED_FOR_INTEGRATION`
- **Algorithm revision:** `v1.2`
- **Purpose:** 강화학습 모듈의 규칙 기반 Learning Engine 기술 명세
- **Scope:** State, Action Pool, Outcome/Event, Reward 평가, Action/Route Preference Update, Exploration, 5-Robot Round 통합
- **Non-goal:** 실제 PPO/Q-learning/신경망 학습 구현
- **Validation:** SAFE / FAST / BALANCED × Seeds `7, 42, 1234`에서 20 Round 검증을 완료했고, v1.2는 `PASS_CANDIDATE` 판정을 받았다.
- **Current meaning:** Mock/validation 환경의 Core Algorithm은 실제 Map과 연결하기 위한 Base Engine으로 사용한다.
- **Navigation status:** `navigation_design_v1.md = APPROVED_FOR_BLOCKOUT`
- **Integration extension:** `VILLAIN_ENCOUNTER / BOSS_ENCOUNTER / ROBOT_DISABLED / Villain Mission Bonus`를 실제 Map 통합 설계에 추가한다. 이 확장은 v1.2 Core Validation 결과에 소급해 검증 완료로 취급하지 않는다.
- **Remaining gate:** 실제 5층 Navigation Graph의 stable Route Decision Context와 연결한 Integration Validation이 필요하다.

---

## 1. 핵심 원칙

이 프로젝트의 Learning Engine은 실제 신경망을 브라우저에서 학습시키는 것이 아니라, 다음 인과관계를 실제 상태 변화로 재현한다.

```text
사용자 Reward / Penalty 중요도
→ 현재 State
→ State별 Action Pool
→ Action Preference + Exploration
→ Action 확률 선택
→ Environment Outcome / Event
→ Local Action 평가
→ Episode 평가
→ Round의 5개 Experience 통합
→ Action Preference Update
→ 다음 Round
```

반드시 지켜야 할 원칙:

- `목표 도달 / 시간 초과 / 시민 위험 / 시민 오해 / 시설물 파괴`는 Action이 아니라 Outcome / Event다.
- 결과 Event 자체를 확률로 직접 뽑지 않는다.
- Robot은 현재 State에서 가능한 Action을 선택하고, 그 행동과 환경 상태의 결과로 Event가 발생한다.
- 5대 Robot은 서로 다른 AI가 아니다.
- 한 Round 시작 시 5대 모두 **동일한 Central Policy Snapshot**을 사용한다.
- Round 도중 중앙 Policy를 갱신하지 않는다.
- 5대 Episode가 모두 끝난 뒤 경험을 통합해 중앙 Policy를 한 번 갱신한다.
- Exploration을 남겨 후반 Round에서도 선택 다양성이 완전히 사라지지 않게 한다.
- 플레이어 UI에는 내부 Reward 숫자나 Preference 실수를 직접 노출하지 않는다.

---

## 2. 사용자 Reward / Penalty 설정

플레이어는 다음 5개 평가 축의 중요도를 설정한다.

1. 목표 도달
2. 빠른 해결
3. 시설물 파괴
4. 시민 위험
5. 시민 오해

중요도 4단계는 내부적으로 다음 Weight 초안을 사용한다.

| 사용자 설정 | 내부 Weight |
|---|---:|
| 신경 안 씀 | 0 |
| 조금 중요 | 1 |
| 중요 | 2 |
| 매우 중요 | 3 |

예:

```ts
weights = {
  goal: 3,
  speed: 1,
  facilityDamage: 3,
  citizenRisk: 3,
  citizenMisunderstanding: 3,
}
```

`0 / 1 / 2 / 3`을 v1.2의 현재 기준 Weight로 사용한다. 실제 Map 통합 검증에서 환경 분포 때문에 문제가 드러나는 경우에만 별도 튜닝한다.

---

## 3. Learning State

### 3.1 MOVING

선택한 Route를 따라 실제로 이동하는 상태.

- 별도 Action 선택 없음
- 시간 경과
- 다음 Decision Node 또는 Encounter로 이동
- Main / Sub View에서는 가능한 한 계속 움직이는 화면으로 표현

브라우저 성능 때문에 5개 화면의 완전한 실시간 Full Render가 어려울 경우, 실제 Simulation State / Action 결과에 맞춰 사전 제작 Animation / Sequence를 연결할 수 있다.

단, 미리 정해진 완성 영상이나 20개 고정 장면을 순서대로 재생하는 방식은 금지한다.

---

### 3.2 ROUTE_CHOICE

갈림길 또는 층 이동 지점에서 현재 위치에서 실제로 가능한 Route 중 하나를 선택한다.

Action Pool은 Map / Navigation Graph에 따라 동적으로 생성한다.

예:

- 빠른 지름길
- 안전한 우회 복도
- 일반 계단
- 비상계단

각 Route에는 Trait을 부여한다.

예:

```ts
traits = {
  timeCost,
  citizenExposure,
  obstacleChance,
  ambiguousPersonChance,
  narrowness,
}
```

원칙:

- Route 자체가 곧바로 `시민 위험`, `시설물 파괴`를 발생시키지 않는다.
- Route 선택 후 실제 이동 과정에서 Encounter State를 만난다.
- 중앙 AI는 특정 위치의 고유 Route ID 자체보다 Route의 **행동 특성 / Trait**을 학습하는 방향을 우선한다.

---

### 3.3 OBSTACLE

이동 경로에 장애물이 있는 상황.

| Action | 시간 비용 | 시설물 파괴 위험 | 설명 |
|---|---:|---:|---|
| `DETOUR` | 큼 | 없음 | 우회 |
| `PUSH` | 작음 | 높음 | 밀고 통과 |
| `SQUEEZE` | 매우 작음 | 낮음~중간 | 좁은 틈 통과 |
| `WAIT` | 중간 | 없음 | 이동 가능한 장애물이 비켜날 때까지 대기 |

모든 장애물에서 4개 Action이 항상 가능한 것은 아니다.

예:

```text
쓰러진 상자
→ DETOUR / PUSH / SQUEEZE

움직이는 운반 로봇
→ DETOUR / WAIT / SQUEEZE
```

`시설물 파괴`가 발생해도 Episode는 계속 진행한다.

---

### 3.4 CITIZEN_NEARBY

Robot이 대상을 시민으로 정상 인식한 상태에서 시민 근처를 어떻게 지나갈지 선택한다.

| Action | 시간 비용 | 시민 위험 | 설명 |
|---|---:|---:|---|
| `WIDE_DETOUR` | 큼 | 거의 없음 | 크게 우회 |
| `SLOW_PASS` | 중간 | 낮음 | 천천히 통과 |
| `WAIT` | 중간~큼 | 없음 | 시민이 지나갈 때까지 대기 |
| `FAST_PASS` | 작음 | 높음 | 빠르게 통과 |

예:

```text
CITIZEN_NEARBY
→ FAST_PASS
→ 시민 위험 Event 발생 가능
→ 계속 이동
```

`시민 위험`은 Episode 종료 Event가 아니다.

---

### 3.5 AMBIGUOUS_PERSON

Robot이 앞의 대상이 시민인지 악당인지 확신할 수 없는 상황.

Environment는 내부적으로 실제 정체를 가진다.

```ts
actualType = "CITIZEN" | "VILLAIN"
```

Action Pool:

| Action | 시간 비용 | 시민 오해 위험 | 설명 |
|---|---:|---:|---|
| `OBSERVE` | 중간 | 낮음 | 잠깐 관찰 후 판단 |
| `BYPASS` | 중간 | 매우 낮음 | 거리를 두고 지나감 |
| `TRACK` | 큼 | 있음 | 일정 시간 추적 |
| `SUBDUE` | 매우 작음 | 매우 높음 | 즉시 제압 |

시민을 대상으로:

```text
SUBDUE
→ 시민 오해
→ Episode 실패 종료
```

또는:

```text
TRACK
→ 일정 시간 이상 잘못된 대상으로 추적
→ 시민 오해
→ Episode 실패 종료
```

악당을 대상으로 `SUBDUE`가 항상 나쁜 Action이 되지는 않도록 설계한다.

악당과의 직접 전투 자체는 핵심 gameplay가 아니므로 짧게 처리한다.

---

### 3.6 VILLAIN_ENCOUNTER — Map Integration Extension

대상이 악당임이 확실한 상황이다.

`AMBIGUOUS_PERSON`과 구분한다.

```text
AMBIGUOUS_PERSON
= 시민인지 악당인지 확신할 수 없음

VILLAIN_ENCOUNTER
= 대상이 악당임이 확인됨
```

기본 Action Pool:

| Action | 시간 경향 | 핵심 결과 |
|---|---:|---|
| `SUBDUE` | 매우 작음 | 성공 시 `VILLAIN_NEUTRALIZED`, 실패 시 `ROBOT_DISABLED` |
| `DISTRACT` | 중간 | 직접 제압하지 않고 통과를 시도 |
| `BYPASS` | 큼 | 실제 우회 공간이 있을 때만 사용 가능 |
| `RETREAT` | 큼 | 이전 Decision Node로 복귀 |

원칙:

- 모든 Encounter에서 네 Action을 전부 제공하지 않는다.
- 계단 입구를 악당이 직접 막는 상황에서는 기본적으로 `BYPASS`를 제공하지 않는다.
- Villain 수가 많을수록 `SUBDUE` 실패 위험이 높아야 한다.
- 현재 Map 설계의 계단 경비는 주로 Villain ×2, 5F Search Room Guard는 Villain ×1이다.
- 정확한 성공률 / timeCost는 Integration Validation에서 확정한다.
- 직접 전투를 별도 미니게임으로 확대하지 않는다.

`SUBDUE` 실패:

```text
SUBDUE
→ 실패
→ ROBOT_DISABLED
→ Episode 실패 종료
```

---

### 3.7 BOSS_ENCOUNTER — Map Integration Extension

5F Search Room에서 Boss를 발견했을 때 발생한다.

Boss는 일반 `VILLAIN_ENCOUNTER`와 분리한다.

현재 Navigation 설계:

```text
5F Search Room = L1 / L2 / R1 / R2
Boss 위치 = Episode마다 seeded random
Control Room = 5F 안쪽 중앙의 고정 위치
```

Boss 제압 성공:

```text
BOSS_NEUTRALIZED
→ Control Room Security Lock 해제
→ Control Room 진입
→ 시스템 복구
→ GOAL_REACHED
```

Boss 대응 실패는 `ROBOT_DISABLED`를 만들 수 있다.

Boss 전투를 별도 미니게임으로 확대하지 않는다.

정확한 Boss Action Pool / 성공률은 Blockout 이후 Integration 단계에서 확정한다.

---

## 4. Episode 종료 / 진행 Event

### Episode 종료

| Event | 결과 |
|---|---|
| `GOAL_REACHED` | 성공 종료 |
| `CITIZEN_MISUNDERSTANDING` | 실패 종료 |
| `TIMEOUT` | 실패 종료 |
| `ROBOT_DISABLED` | 실패 종료 |

`ROBOT_DISABLED`의 대표 원인은 `VILLAIN_ENCOUNTER / BOSS_ENCOUNTER`에서 위험한 대응이 실패하는 경우다.

### Episode 계속 진행

| Event | 결과 |
|---|---|
| `CITIZEN_RISK` | 벌점 / 기록 누적 후 계속 |
| `FACILITY_DAMAGE` | 벌점 / 기록 누적 후 계속 |
| `VILLAIN_NEUTRALIZED` | 일반 악당 제압 기록 후 계속 |
| `BOSS_NEUTRALIZED` | Control Room 잠금 해제 단계로 계속 |

### 막다른 길

`DEAD_END`는 MVP에서 즉시 Episode 종료로 두지 않는다.

```text
막다른 길 도달
→ 시간 손실
→ 이전 Decision Node로 복귀
→ ROUTE_CHOICE 재실행
```

### 작동 불능

기존에 제외했던 **누적 충돌로 인한 작동 불능** 종료 조건은 여전히 사용하지 않는다.

다만 최신 Map Integration Extension에서는 악당 대응 실패에 의한 `ROBOT_DISABLED`를 명시적인 Terminal Outcome으로 사용한다.

```text
VILLAIN_ENCOUNTER / BOSS_ENCOUNTER
→ 위험한 Action 실패
→ ROBOT_DISABLED
→ Episode 실패 종료
```

## 5. Episode 기록

각 Robot Episode는 최소 다음 정보를 저장한다.

```ts
EpisodeExperience = {
  goalReached: boolean,
  elapsedTime: number,
  facilityDamageCount: number,
  citizenRiskCount: number,
  citizenMisunderstanding: boolean,
  villainsNeutralized: number,
  bossNeutralized: boolean,
  terminalReason:
    | "GOAL_REACHED"
    | "CITIZEN_MISUNDERSTANDING"
    | "TIMEOUT"
    | "ROBOT_DISABLED",
  actionHistory: ActionExperience[],
  eventHistory: EventRecord[],
}
```

`ActionExperience`에는 최소 다음 정보를 저장한다.

```ts
ActionExperience = {
  state,
  action,
  elapsedCost,
  immediateEvents,
  localOutcome,
}
```

Event History에는 최소:

- Event type
- 발생 시각
- 위치
- 원인이 된 Action

을 기록한다.

5F Boss Search를 구현할 때는 Episode 내부에 `searchedRooms`와 hidden `bossRoom`을 별도로 관리한다. `bossRoom`은 Environment 내부 정보이며 Policy가 직접 참조하면 안 된다.

## 6. Episode Reward v1

### 6.1 목표 도달

```text
goalValue =
  +1  목표 도달
  -1  시민 오해 / 시간 초과 / ROBOT_DISABLED
```

### 6.2 빠른 해결

빠른 해결 보상은 **목표 도달에 성공했을 때만** 적용한다.

```text
speedValue = 1 - elapsedTime / timeLimit
```

범위는 `0 ~ 1`로 clamp한다.

실패 Episode:

```text
speedValue = 0
```

이 규칙은 시민을 매우 빨리 잘못 제압한 경우가 `빠른 해결` 보상을 받는 문제를 막는다.

### 6.3 시설물 파괴

v1.2 현재 기준:

```text
damageValue = min(facilityDamageCount / 3, 1)
```

### 6.4 시민 위험

v1.2 현재 기준:

```text
riskValue = min(citizenRiskCount / 3, 1)
```

분모 `3`은 Map / Episode에서 실제 Event 빈도를 확인한 뒤 조정한다.

### 6.5 시민 오해

```text
misunderstandingValue =
  0  없음
  1  발생
```

### 6.6 Raw Reward

```text
rawReward =
    goalWeight * goalValue
  + speedWeight * speedValue
  - damageWeight * damageValue
  - riskWeight * riskValue
  - misunderstandingWeight * misunderstandingValue
```

---

## 7. 0~100 Experience Score

사용자가 제안한 `0~100` 점수 아이디어는 **Outcome 자체를 추첨하는 확률표**가 아니라 Episode Experience의 내부 평가 강도로 사용한다.

기준:

```text
0   = 매우 나쁜 경험
50  = 중립
100 = 매우 좋은 경험
```

표현 구간:

| Score | 내부 해석 |
|---:|---|
| 0~20 | 매우 나쁜 경험 |
| 21~40 | 나쁜 경험 |
| 41~60 | 중립 / 애매 |
| 61~80 | 좋은 경험 |
| 81~100 | 매우 좋은 경험 |

Raw Reward의 가능한 positive / negative 범위를 기준으로 각각 50~100, 0~50에 정규화한다.

정확한 normalization 함수는 validation harness에서 deterministic하게 구현하고 테스트한다.

플레이어 UI에는 이 숫자를 직접 표시하지 않는다.

### 7.1 Villain Mission Bonus — Integration Extension

일반 악당 제압은 플레이어 Reward Setting의 여섯 번째 축으로 추가하지 않는다.

대신 Mission 방향성을 아주 약하게 반영하기 위해 **성공 Episode에서만** Experience Score에 작은 bonus를 더할 수 있다.

현재 확정된 상한:

```text
GOAL_REACHED Episode
→ villainMissionBonus ∈ [0, 1]

실패 Episode
→ villainMissionBonus = 0
```

즉 최종 Experience Score에 미치는 영향은 Episode당 최대 `+1 / 100` 수준이다.

Boss는 별도 bonus를 주지 않는다. Boss 제압은 `GOAL_REACHED`를 달성하기 위한 필수 조건이므로 별도 보상을 더하면 Goal Reward와 중복될 수 있다.

정확한 `villainsNeutralized → bonus` 배분식은 실제 Map에서 Encounter 수 분포를 확인한 뒤 Integration Validation에서 확정한다.

Integration Validation에서는 최소 다음을 비교한다.

```text
villainMissionBonus disabled
vs
villainMissionBonus max +1
```

Mission Bonus가 악당이 많은 Route를 의도 이상으로 선호하게 만들지 않는지 확인한다.

---

## 8. Local Action Reward

Episode 전체 Score만으로 Episode 안의 모든 행동에 같은 credit을 주면 너무 거칠다.

따라서 각 Action이 직접 만든 결과를 Local Reward로 별도 평가한다.

예:

```text
OBSTACLE → PUSH

Local Reward:
+ 빠른 이동 기여
- 시설물 파괴가 발생했다면 시설물 파괴 Weight
```

```text
CITIZEN_NEARBY → FAST_PASS

Local Reward:
+ 시간 절약
- 시민 위험이 발생했다면 시민 위험 Weight
```

```text
AMBIGUOUS_PERSON → SUBDUE

시민이었다면:
- 시민 오해 Weight
- Episode 즉시 종료
```

Local Reward는 내부적으로 `-1 ~ +1` 범위로 정규화한다.

정확한 State별 Local Reward 식은 validation 결과를 바탕으로 조정한다.

---

## 9. Action / Route Credit v1.2

Episode Score는 다음과 같이 `-1 ~ +1`로 변환한다.

```text
episodeReturn = (experienceScore - 50) / 50
```

### 9.1 Encounter Action Credit

`OBSTACLE / CITIZEN_NEARBY / AMBIGUOUS_PERSON`에 더해 Integration Extension의 `VILLAIN_ENCOUNTER / BOSS_ENCOUNTER`에서 직접 선택한 Action도 해당 Action의 직접 결과를 더 강하게 반영한다.

```text
actionCredit =
  0.35 * episodeReturn
+ 0.65 * localReturn
```

`localReturn`은 `[-1, +1]` 범위에서 해당 Action이 직접 만든 시간 이득/손실, 시설물 파괴, 시민 위험, 시민 오해, `VILLAIN_NEUTRALIZED / ROBOT_DISABLED` 같은 직접 Outcome을 평가한다. 일반 Villain Mission Bonus는 매우 작은 Episode-level 보조 신호로 제한하고, 위험한 `SUBDUE`의 Local Credit을 과도하게 양수로 만들지 않도록 Integration Validation에서 확인한다.

이 구조는 v1.1 이후 validation에서 다음 문제를 해결했다.

- SAFE에서 `PUSH + FACILITY_DAMAGE`가 음수 Credit을 받음
- SAFE에서 `FAST_PASS + CITIZEN_RISK`가 음수 Credit을 받음
- 같은 빠르고 위험한 행동도 FAST Profile이 SAFE보다 높은 Credit을 받을 수 있음
- 시민 대상 `SUBDUE / TRACK`의 시민 오해는 terminal이며 실패 Episode의 `speedValue = 0`

### 9.2 Route Segment Credit

Route는 선택 즉시 Event를 만드는 것이 아니므로, Route 선택부터 **다음 `ROUTE_CHOICE` 또는 Episode 종료까지**를 하나의 Segment로 평가한다.

```text
rawRouteCredit =
  0.35 * episodeReturn
+ 0.65 * segmentReturn
```

`segmentReturn`은 해당 Segment의 실제 결과를 반영한다.

- Segment elapsed time
- `CITIZEN_RISK`
- `FACILITY_DAMAGE`
- `CITIZEN_MISUNDERSTANDING`
- 사용자 Reward / Penalty Weight

Route 이름 자체에 보상값을 하드코딩하지 않는다.

### 9.3 Route Relative Advantage

v1.1에서는 대부분의 Route가 양의 `rawRouteCredit`을 계속 받아 모든 Route Preference가 `+2`로 포화되는 문제가 있었다.

v1.2에서는 동일한 **Route Decision Context** 안에서 비교 가능한 Route Experience의 평균을 baseline으로 사용한다.

```text
routeBaseline =
  mean(rawRouteCredit in the same Route Decision Context)

routeAdvantage =
  rawRouteCredit - routeBaseline
```

같은 Route Action의 Advantage가 여러 개라면 평균을 사용해 Preference를 갱신한다.

실제 Map에서는 서로 다른 Decision Node의 Route를 하나의 baseline에 섞지 않는다. 각 Decision Node에는 stable Route Context key가 필요하다.

---

## 10. Action Preference

각 State의 Action Preference는 초기값 `0`으로 시작한다.

예:

```text
OBSTACLE
DETOUR   0
PUSH     0
SQUEEZE  0
WAIT     0
```

한 Round가 끝나면 해당 Action을 실제 선택한 Experience들의 Action Credit 평균을 사용한다.

```text
preferenceNew =
  preferenceOld
  + learningRate * averageActionCredit
```

v1 초안:

```text
learningRate = 0.35
```

Preference 폭주 방지:

```text
preference ∈ [-2, +2]
```

Encounter Action은 위 범위를 그대로 사용한다.

Route Preference는 Context별 Update 후 공통 offset을 제거하기 위해 평균을 0으로 re-center한다.

```text
meanPreference =
  mean(route preferences in the same context)

routePreference =
  routePreference - meanPreference
```

그 후 `[-2, +2]`로 clamp한다.

이 re-centering은 Softmax 상대 확률을 바꾸지 않으면서 모든 Route Preference가 같은 방향으로 떠오르는 현상을 막는다.

현재 `learningRate = 0.35`, Preference clamp `[-2, +2]`를 v1.2 Base Engine 값으로 유지한다.

---

## 11. Preference → 선택 확률

각 State에서 현재 가능한 Action의 Preference를 Softmax로 변환한다.

```text
policyProbability = softmax(availableActionPreferences)
```

현재 State에서 불가능한 Action은 Pool에서 제거하고 남은 Action끼리 다시 정규화한다.

최종 선택 확률에는 Exploration을 섞는다.

```text
finalProbability(action)
=
(1 - epsilon) * policyProbability(action)
+
epsilon * uniformProbability(action)
```

---

## 12. Exploration Schedule v1

20 Round 기준 1차안:

| Round | epsilon |
|---:|---:|
| 1~5 | 0.35 |
| 6~10 | 0.25 |
| 11~15 | 0.15 |
| 16~20 | 0.10 |

목적:

- 초반에는 다양한 행동 시도
- 후반에는 높은 평가를 받은 행동을 더 자주 선택
- 마지막 Round까지 완전한 결정론적 선택은 방지

이 Schedule은 v1.2 multi-seed validation에서 사용되었고, 실제 Map Integration Validation에서도 우선 동일하게 유지한다.

---

## 13. 5-Robot Round 통합

### Round 시작

```text
Central Policy
→ Policy Snapshot
→ Robot 1
→ Robot 2
→ Robot 3
→ Robot 4
→ Robot 5
```

5대 모두 같은 Snapshot을 사용한다.

### Round 진행

- 각 Robot은 독립적인 random draw로 Action을 선택
- 서로 다른 Simulation Instance에서 진행
- Round 도중 중앙 Preference 변경 금지

### Round 종료

5개 Episode가 모두 끝난 뒤:

1. 모든 Action Experience를 State / Action별로 모은다.
2. 같은 Action을 여러 Robot이 사용했다면 Action Credit 평균을 구한다.
3. Action별 Preference를 한 번만 업데이트한다.
4. 다음 Round에서 새 Policy Snapshot을 5대가 공유한다.

많이 등장한 Action이 단순히 등장 횟수만큼 과도하게 업데이트되지 않도록 **평균 Credit**을 기본으로 한다.

---

## 14. Environment Randomness

다양성의 주원인은:

1. Action probability
2. Exploration
3. 5대의 독립 random draw

로 둔다.

Environment Randomness는 작게 유지한다.

이유:

- 같은 Reward 설정에서 결과가 지나치게 랜덤하면 학습 효과가 보이지 않는다.
- 사용자가 설정을 바꿨을 때 행동 경향이 변했다는 인과관계를 알아보기 어려워진다.

3-Round validation에서는 가능한 한 **동일 Seed 기반 비교**를 사용한다.

---

## 15. UI와의 연결

Round Result Overlay Step B는 Learning Engine이 실제로 계산한 Preference 변화량을 사용한다.

예:

```text
우회해서 이동하기          ↑
장애물을 밀기              ↓
시민 근처에서 천천히 이동  ↑
```

UI에서 고정 문구로 임의 생성하지 않는다.

내부 숫자:

- Reward
- Experience Score
- Preference
- Probability

는 플레이어에게 직접 노출하지 않는다.

---

## 16. Validation Result — v1.2

### 검증 규모

v1.2 최종 검증은 다음 구조로 수행했다.

```text
Profiles: SAFE / FAST / BALANCED
Seeds: 7 / 42 / 1234

각 Profile × Seed:
5 Robots × 20 Rounds
= 100 Episode Experiences
= 20 Central Policy Updates

전체 20-Round Validation:
3 Profiles × 3 Seeds × 100 Experiences
= 900 Episodes
```

추가로 3-Round Multi-Seed 135 Episodes와 Forced Scenario Test를 수행했다.

### Core 결과

| Profile | Success | Avg Time | Citizen Risk | Damage | Misunderstanding |
| --- | ---: | ---: | ---: | ---: | ---: |
| SAFE | 89.33% | 20.887 | 0.107 | 0.113 | - |
| FAST | 86.00% | 18.188 | 0.410 | 0.173 | - |
| BALANCED | 87.67% | 20.147 | 0.157 | 0.123 | - |

핵심 행동 확률:

```text
PUSH
SAFE  6.66%
FAST 44.38%

FAST_PASS
SAFE  5.62%
FAST 73.18%

FAST_SHORTCUT
SAFE 24.25%
FAST 41.20%

SAFE_CORRIDOR
SAFE 30.51%
FAST 18.62%
```

v1.2에서 다음 방향이 3/3 Seed에서 일치했다.

- SAFE 시민 위험 < FAST
- SAFE 시설물 파괴 < FAST
- FAST 평균 시간 < SAFE
- SAFE `PUSH` < FAST
- SAFE `FAST_PASS` < FAST
- SAFE `FAST_SHORTCUT` < FAST
- SAFE `SAFE_CORRIDOR` > FAST

### Route Saturation 수정 결과

v1.1에서 발생했던 모든 Route Preference의 공동 `+2` 포화는 v1.2의 Context별 Relative Advantage + re-centering으로 제거됐다.

Round 5 / 10 / 15 / 20과 모든 검증 Seed에서 동일 Route 확률로 되돌아가는 현상이 재발하지 않았다.

### Regression / Stability

- Forced Route Scenario R1~R5 PASS
- 기존 Encounter Scenario A~H PASS
- Reinforcement test `20/20` PASS
- 전체 project test `103/103` PASS
- TypeScript typecheck PASS
- `git diff --check` PASS
- Probability sum / finite value / Preference clamp / Snapshot 불변성 / Round 20 Exploration / reproducibility PASS

### 현재 판단

```text
Learning Engine v1.2
→ PASS_CANDIDATE
→ Core Algorithm을 Map Integration의 Base Engine으로 사용
→ 실제 Map 연결 후 Integration Validation 필요
```

일부 Encounter Preference가 `+2`에 도달하는 현상은 남아 있지만, 특정 Action 하나가 지속적으로 좋은 평가를 받아 clamp 상한에 도달하는 형태이며 v1.1의 Route 공동 포화와는 성격이 다르다. Exploration이 유지되므로 현재 Integration을 막는 문제로 보지 않고 실제 Map에서 행동 고착 여부를 관찰한다.

---

## 17. Integration Validation Gate

Core Algorithm을 다시 튜닝하기 전에 `navigation_design_v1.md`를 기준으로 Navigation Graph / Blockout을 만들고 실제 Map과 연결한다.

현재 Navigation 설계 상태:

```text
navigation_design_v1.md
= APPROVED_FOR_BLOCKOUT
```

Integration 단계에서 반드시 확인한다.

1. 각 Decision Node에 stable Route Context key가 존재하는가
2. 서로 비교할 수 없는 Route가 같은 baseline에 섞이지 않는가
3. 5F Boss Search에서 remaining-room set이 Context key에 안정적으로 반영되는가
4. hidden `bossRoom`이 Policy 입력으로 새지 않는가
5. 실제 Route Trait / timeCost / Encounter 배치가 Reward Profile별 차이를 유지하는가
6. `VILLAIN_ENCOUNTER`에서 `SUBDUE / DISTRACT / BYPASS / RETREAT`가 환경 조건에 따라 올바르게 제한되는가
7. Villain ×1 / ×2 차이가 위험도에 합리적으로 반영되는가
8. `SUBDUE` 실패의 `ROBOT_DISABLED`가 terminal로 정상 처리되는가
9. `BOSS_ENCOUNTER → BOSS_NEUTRALIZED → Control Room → GOAL_REACHED` 흐름이 정상 동작하는가
10. Villain Mission Bonus `0` vs `max +1` 비교에서 Route / Action Policy가 의미 있게 왜곡되지 않는가
11. 실제 Map에서도 `5 Robots × 20 Rounds = 100 Experiences / 20 Policy Updates`가 정상 동작하는가
12. SAFE / FAST Trade-off가 실제 Map에서도 유지되는가
13. Encounter Preference `+2` 포화가 실제 gameplay에서 과도한 행동 고착을 만들지 않는가
14. UI/Animation Pause가 Episode 시간 평가에 섞이지 않는가

Mock 환경에서 통과한 Core Algorithm을 먼저 고정하고, Integration에서 문제가 발생하면 우선 Map / Route Trait / Encounter / timeCost / 신규 Encounter 파라미터를 점검한다.

## 18. 실제 Map 통합 전 미확정 / 튜닝 항목

Core Algorithm의 기본 수치는 v1.2 Base Engine 값으로 고정한다.

실제 Map과 연결하면서 확정할 항목:

- `navigation_graph_v1.json`의 stable Route Decision Context key
- Route Trait의 실제 numeric representation
- Route별 실제 `timeCost`
- Route별 Encounter 배치 / 발생 조건 / Environment Randomness 세기
- Episode `timeLimit`
- `AMBIGUOUS_PERSON`의 `TRACK` 시민 오해 시간 threshold
- `VILLAIN_ENCOUNTER`의 `SUBDUE / DISTRACT` 성공률
- Villain ×1 / ×2가 `SUBDUE` 위험에 주는 정확한 영향
- `BOSS_ENCOUNTER`의 최종 Action Pool / 성공률
- Villain Mission Bonus의 세부 배분식 (`GOAL_REACHED`에서 최대 +1 원칙은 확정)
- 실제 Map에서 damage / risk Event 빈도가 현재 normalization과 맞는지
- Encounter Preference가 clamp 상한에 도달했을 때 실제 행동 다양성이 충분한지
- 실제 Map 기반 100-Experience Integration Validation 결과

Core Algorithm 수치인 Weight `0/1/2/3`, Encounter Credit `0.35/0.65`, Route Segment Credit `0.35/0.65`, `learningRate = 0.35`, clamp `[-2,+2]`, Exploration Schedule은 Integration 결과에서 명확한 문제가 발견되기 전까지 변경하지 않는다.

## 19. 승인 / 통합 절차

```text
DRAFT / VALIDATING
→ 3-Round Sanity Test
→ Credit Assignment v1.1
→ 20-Round Multi-Seed Validation
→ Route Advantage v1.2
→ 20-Round Multi-Seed Validation
→ PASS_CANDIDATE
→ APPROVED_FOR_INTEGRATION
→ navigation_design_v1.md 작성 / 검토
→ APPROVED_FOR_BLOCKOUT
→ navigation_graph_v1.json + 1F~5F SVG Blockout
→ Blockout 검토 / 수정
→ 실제 Map 연결
→ VILLAIN/BOSS/ROBOT_DISABLED/Mission Bonus 포함 100-Experience Integration Validation
→ Production Gameplay 적용
```

현재 단계:

```text
Core Learning Engine v1.2
= APPROVED_FOR_INTEGRATION

Navigation Design v1
= APPROVED_FOR_BLOCKOUT
```

v1.2 Core Validation은 신규 `VILLAIN_ENCOUNTER / BOSS_ENCOUNTER / ROBOT_DISABLED / Villain Mission Bonus`까지 검증했다는 뜻이 아니다. 이 항목들은 실제 Map Integration Validation에서 별도 검증해야 한다.

다음 작업은 Core Learning Engine 재설계가 아니라 **Navigation Graph / SVG Blockout 생성 및 검토**다.
