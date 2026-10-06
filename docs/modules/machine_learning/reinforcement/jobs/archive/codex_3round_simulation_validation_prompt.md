# Codex Prompt — Reinforcement Learning Engine 3-Round Simulation Validation

## Task

강화학습 모듈의 **Learning Engine v1 초안**을 검증하기 위한 **독립적인 deterministic simulation harness**를 구현하고 실행해줘.

이 작업은 실제 게임 UI나 Phaser Scene을 구현하는 작업이 아니다.

목표는:

> 현재 설계한 Reward / Preference Update 규칙이 실제로 SAFE / FAST 보상 설정에 따라 서로 다른 행동 경향을 만들고, 계산식에 구조적인 문제가 없는지 3 Round 동안 빠르게 검증하는 것

이다.

---

## 먼저 읽을 문서

repository에서 다음 문서를 우선 읽어라.

1. `docs/modules/reinforcement/learning_engine_v1.md`
2. `docs/modules/reinforcement/module_spec.md`
3. `docs/modules/reinforcement/session_handoff.md`
4. `docs/shared/module_contract.md`

충돌할 경우 우선순위:

```text
현재 프롬프트
→ learning_engine_v1.md
→ module_spec.md
→ session_handoff.md
→ module_contract.md
```

---

## 중요한 작업 제한

이번 작업에서는 다음을 하지 마라.

- 기존 AI Basics 수정
- 기존 지도학습 FSM 수정
- Phaser UI 구현
- 실제 5층 Map 제작
- Tiled 작업
- Asset 추가
- 실제 gameplay route 추가
- 새로운 dependency 설치
- PPO / Q-learning / TensorFlow / PyTorch 도입
- UI를 위한 임의의 결과 하드코딩
- 20 Round 전체 게임 구현

기존 기능을 건드리지 않는 **독립 validation harness**로 구현한다.

가능하면 프로젝트의 기존 TypeScript 환경을 사용한다.

---

# 1. Validation Harness 위치

repository 구조를 먼저 확인하고, 기존 convention과 충돌하지 않는 위치를 선택한다.

권장 예시:

```text
scripts/reinforcement/
```

또는

```text
src/modules/reinforcement/sim/
```

단, 실제 production gameplay와 validation harness를 섞지 마라.

가능하면 다음처럼 분리한다.

```text
learningEngine.ts
runThreeRoundValidation.ts
learningEngine.test.ts
```

repository의 test convention이 있다면 그 convention을 따른다.

---

# 2. 구현해야 하는 State

최소 다음 State를 정의한다.

```text
MOVING
ROUTE_CHOICE
OBSTACLE
CITIZEN_NEARBY
AMBIGUOUS_PERSON
```

`MOVING`은 이번 console harness에서 실제 animation이 필요 없다.

---

# 3. Action Pool

## ROUTE_CHOICE

고정 Route ID 자체보다 Trait 기반 비교가 가능하도록 최소 mock route를 만든다.

예:

```text
FAST_SHORTCUT
SAFE_CORRIDOR
NORMAL_STAIRS
ELEVATOR
```

각 Route는 최소 다음 Trait을 가진다.

```text
timeCost
citizenExposure
obstacleChance
ambiguousPersonChance
```

이번 3-Round validation에서는 Map을 만들지 않는다.

작은 mock environment를 사용한다.

---

## OBSTACLE

```text
DETOUR
PUSH
SQUEEZE
WAIT
```

---

## CITIZEN_NEARBY

```text
WIDE_DETOUR
SLOW_PASS
WAIT
FAST_PASS
```

---

## AMBIGUOUS_PERSON

```text
OBSERVE
BYPASS
TRACK
SUBDUE
```

---

# 4. Episode 종료 / Event 규칙

Episode 종료:

```text
GOAL_REACHED
CITIZEN_MISUNDERSTANDING
TIMEOUT
```

Episode 계속:

```text
CITIZEN_RISK
FACILITY_DAMAGE
```

중요:

- 시민 위험이나 시설물 파괴가 발생했다고 Episode를 종료하면 안 된다.
- 목표 도달 / 시민 오해 / 시간 초과만 현재 v1 terminal condition으로 사용한다.
- 실패 Episode가 빨리 끝났다는 이유로 `빠른 해결` 보상을 주면 안 된다.

---

# 5. Reward Settings

4단계 Weight:

```text
신경 안 씀 = 0
조금 중요 = 1
중요 = 2
매우 중요 = 3
```

최소 두 Profile을 반드시 테스트한다.

## SAFE

```text
goal = 3
speed = 1
facilityDamage = 3
citizenRisk = 3
citizenMisunderstanding = 3
```

## FAST

```text
goal = 3
speed = 3
facilityDamage = 0
citizenRisk = 0
citizenMisunderstanding = 1
```

가능하면 추가:

## BALANCED

합리적인 중간 설정을 하나 정의하되, 결과를 만들기 위해 임의로 튜닝하지 마라.

---

# 6. Episode Reward

다음 초안을 구현한다.

```text
goalValue =
  +1 if GOAL_REACHED
  -1 if CITIZEN_MISUNDERSTANDING or TIMEOUT
```

성공 Episode에서만:

```text
speedValue = clamp(1 - elapsedTime / timeLimit, 0, 1)
```

실패 Episode:

```text
speedValue = 0
```

시설물 파괴:

```text
damageValue = min(facilityDamageCount / 3, 1)
```

시민 위험:

```text
riskValue = min(citizenRiskCount / 3, 1)
```

시민 오해:

```text
misunderstandingValue =
  1 if citizenMisunderstanding
  0 otherwise
```

Raw Reward:

```text
rawReward =
    goalWeight * goalValue
  + speedWeight * speedValue
  - facilityDamageWeight * damageValue
  - citizenRiskWeight * riskValue
  - citizenMisunderstandingWeight * misunderstandingValue
```

---

# 7. 0~100 Experience Score

중립을 50으로 둔다.

```text
0   = 매우 나쁨
50  = 중립
100 = 매우 좋음
```

Raw Reward가 가질 수 있는 현재 Profile의 positive / negative 최대 범위를 계산해서 deterministic normalization 함수를 만들어라.

요구사항:

- monotonic해야 한다.
- rawReward = 0이면 score = 50이어야 한다.
- positive reward는 50~100
- negative reward는 0~50
- 반드시 0~100 clamp
- NaN / Infinity 금지

정규화 함수가 어떤 식인지 코드와 결과 출력에서 명확히 보여라.

---

# 8. Local Action Reward

Episode 전체 Score만 모든 행동에 똑같이 주지 마라.

각 Action의 직접 결과를 기반으로 `localReturn ∈ [-1, 1]`을 계산한다.

최소 다음 인과관계를 구현해야 한다.

### OBSTACLE

- `PUSH`
  - 시간 절약 가능
  - FACILITY_DAMAGE가 발생하면 해당 Weight에 따라 불리
- `DETOUR`
  - 느림
  - 시설물 파괴 회피

### CITIZEN_NEARBY

- `FAST_PASS`
  - 시간 절약
  - CITIZEN_RISK 발생 가능
- `SLOW_PASS / WIDE_DETOUR`
  - 더 느림
  - 시민 위험 감소

### AMBIGUOUS_PERSON

- 시민에게 `SUBDUE`
  - CITIZEN_MISUNDERSTANDING
  - Episode 종료
- `OBSERVE`
  - 시간 비용
  - 오해 가능성 감소

정확한 Local Reward 세부식은 단순하게 시작해도 되지만, 코드에 근거를 주석으로 남기고 validation 결과를 왜곡하기 위한 임의 tuning은 하지 마라.

---

# 9. Action Credit

```text
episodeReturn = (experienceScore - 50) / 50
```

```text
actionCredit =
  0.7 * episodeReturn
+ 0.3 * localReturn
```

범위는 필요 시 `[-1, 1]`로 clamp한다.

---

# 10. Preference Update

초기 Preference:

```text
all actions = 0
```

Update:

```text
preferenceNew =
  preferenceOld
  + 0.35 * averageActionCredit
```

Clamp:

```text
[-2, +2]
```

중요:

- Round 도중 preference를 변경하지 마라.
- Round 시작 시 Snapshot을 만들고 5 Robot이 동일 Snapshot을 사용한다.
- 5 Robot Episode가 모두 종료된 뒤 State / Action별 Credit 평균으로 한 번만 Update한다.
- 단순 합계가 아니라 **평균 Credit**을 사용한다.

---

# 11. Action Probability

Preference를 Softmax로 변환한다.

그 후 Exploration:

```text
finalProbability =
  (1 - epsilon) * softmaxProbability
  + epsilon * uniformProbability
```

3 Round 테스트에서는 Round 1~3이므로:

```text
epsilon = 0.35
```

을 사용한다.

각 State의 available Action probability 합은 오차 범위 내에서 반드시 `1.0`이어야 한다.

---

# 12. Randomness / Seed

deterministic seeded PRNG를 사용한다.

최소 Seed:

```text
42
```

가능하면 추가로:

```text
7
1234
```

를 옵션으로 돌릴 수 있게 만들어라.

SAFE와 FAST 비교 시 동일 Seed를 사용한다.

환경 randomness는 작게 유지한다.

Profile 비교의 차이가 reward 설정보다 random environment 때문에 생기지 않도록 한다.

---

# 13. Mock Episode 구조

실제 5층 Map은 만들지 않는다.

그러나 한 Episode가 최소 다음 State들을 여러 번 경험할 수 있도록 작은 mock flow를 만든다.

예:

```text
START
→ ROUTE_CHOICE
→ MOVING
→ CITIZEN_NEARBY or OBSTACLE
→ MOVING
→ AMBIGUOUS_PERSON or ROUTE_CHOICE
→ MOVING
→ GOAL_REACHED / TIMEOUT / CITIZEN_MISUNDERSTANDING
```

고정된 결과 시퀀스를 그대로 재생하지 마라.

Action 선택과 mock environment 조건에 따라 실제 결과가 달라져야 한다.

---

# 14. 실행 규모

각 Profile마다:

```text
5 Robots
× 3 Rounds
= 15 Episodes
```

최소:

```text
SAFE 15 Episodes
FAST 15 Episodes
```

를 실행한다.

가능하면 BALANCED도 15 Episodes.

---

# 15. Console Output

사람이 비교하기 쉽게 다음을 출력한다.

## Run Header

```text
PROFILE: SAFE
SEED: 42
ROUNDS: 3
ROBOTS_PER_ROUND: 5
```

## Round별

```text
=== ROUND 1 ===
epsilon: 0.35
```

각 Robot:

```text
R1:
  terminal: GOAL_REACHED
  elapsedTime: ...
  citizenRisk: ...
  facilityDamage: ...
  misunderstanding: false
  experienceScore: ...
  actions:
    ROUTE_CHOICE -> ...
    OBSTACLE -> ...
    ...
```

Round 종료:

```text
Preference changes:
  OBSTACLE.PUSH: 0.000 -> -0.xxx
  OBSTACLE.DETOUR: 0.000 -> +0.xxx
  CITIZEN_NEARBY.FAST_PASS: ...
```

그리고 다음 Round의 Action Probability도 출력한다.

---

# 16. 최종 Summary

Profile별로 다음을 요약한다.

```text
successRate
timeoutRate
misunderstandingRate
avgElapsedTime
avgCitizenRisk
avgFacilityDamage
```

State별 final Action Preference / Probability도 표 형태로 출력한다.

특히 아래 Action들을 비교한다.

```text
OBSTACLE:
  DETOUR
  PUSH
  SQUEEZE
  WAIT

CITIZEN_NEARBY:
  WIDE_DETOUR
  SLOW_PASS
  WAIT
  FAST_PASS

AMBIGUOUS_PERSON:
  OBSERVE
  BYPASS
  TRACK
  SUBDUE
```

---

# 17. Automated Assertions

가능하면 test로 다음을 검증한다.

1. probability 합이 1
2. probability가 NaN / Infinity / 음수가 아님
3. Preference가 [-2, 2] 안에 있음
4. 실패 Episode의 speedValue = 0
5. Round 도중 Central Policy mutation 없음
6. 5대가 동일 Snapshot에서 시작
7. Round 종료 후에만 Update
8. CITIZEN_RISK / FACILITY_DAMAGE는 terminal 아님
9. CITIZEN_MISUNDERSTANDING / GOAL_REACHED / TIMEOUT은 terminal
10. 동일 seed + 동일 profile에서 실행 결과가 reproducible

---

# 18. Sanity Check 판단

3 Round만으로 최종 학습 성능을 판단하지 마라.

이번 검증의 목적은 방향 확인이다.

### SAFE에서 기대하는 방향

대체로:

```text
PUSH ↓
FAST_PASS ↓
DETOUR / SLOW_PASS / WIDE_DETOUR ↑ 가능
위험한 시민 대응 행동 ↓
```

### FAST에서 기대하는 방향

대체로:

```text
빠른 Route Trait ↑
PUSH ↑ 가능
FAST_PASS ↑ 가능
느린 DETOUR / WAIT ↓ 가능
```

중요:

- 이 값을 맞추기 위해 코드를 하드코딩하지 마라.
- Reward 식의 실제 결과로 자연스럽게 나타나는지 확인한다.
- 3 Round에서 모든 항목이 명확히 갈리지 않아도 실패가 아니다.
- 반대 방향으로 강하게 학습되거나 수치가 폭주하면 문제다.

---

# 19. 결과 분석 문서

실행 후 다음 문서를 생성해라.

권장:

```text
docs/modules/reinforcement/learning_engine_validation_3round.md
```

내용:

```text
환경
사용한 seed
구현한 normalization
SAFE 결과
FAST 결과
BALANCED 결과 (실행했다면)
State별 Preference 변화
발견한 문제
수정 제안
PASS / NEEDS_TUNING / FAIL 판단
20-Round validation 전에 바꿔야 할 항목
```

원시 console output 전체를 문서에 복붙하지 말고 핵심 결과를 정리한다.

---

# 20. 완료 전 검증

작업이 끝나면:

- 관련 test 실행
- TypeScript typecheck
- 기존 project test가 가벼운 범위에서 실행 가능하다면 regression 확인
- production gameplay 파일을 불필요하게 수정하지 않았는지 확인

최종 답변에는 다음만 간결하게 보고한다.

1. 생성/수정 파일
2. 실행 명령
3. SAFE / FAST 핵심 결과
4. assertion 통과 여부
5. 발견된 문제
6. `PASS / NEEDS_TUNING / FAIL`
7. 다음 권장 작업

**이번 작업에서 Learning Engine 수치를 최종 승인하거나 5층 Map 구현으로 넘어가지 마라.**
