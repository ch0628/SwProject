# Learning Engine v1 — 3-Round Validation

## 환경

- Runtime: 기존 Node.js + TypeScript 환경 (`node --experimental-strip-types`)
- UI / Phaser / Map: 사용하지 않음
- Profile당 실행량: 5 Robots × 3 Rounds = 15 Episodes
- Profile: `SAFE`, `FAST`, `BALANCED`
- Seed: `42` (Profile 간 동일)
- Episode 제한 시간: 32
- Round 1~3 epsilon: 0.35
- Learning rate: 0.35
- Preference clamp: `[-2, 2]`

## 구현한 Harness

Production gameplay와 분리된 deterministic simulation harness를 구현했다.

- `src/modules/reinforcement/sim/learningEngine.ts`: seeded PRNG, mock environment, reward, local return, action credit, policy snapshot, round update
- `scripts/reinforcement/runThreeRoundValidation.ts`: 3개 Profile 실행 및 console report
- `tests/learningEngine.test.ts`: 구조 및 수치 assertion

한 Episode는 두 개의 Route leg를 통과한다. Route action은 즉시 결과 Event를 만들지 않고 `MOVING` 시간과 Route Trait을 결정한다. 이후 `obstacleChance`, `citizenExposure`, `ambiguousPersonChance`, `narrowness`에 따라 Encounter가 발생한다. Event는 선택한 Encounter Action과 환경 상태의 결과로만 발생한다.

장애물 종류에 따라 `PUSH` 또는 `WAIT`를 unavailable로 제거하고 남은 Action만 다시 정규화한다. Round 시작 시 Central Policy를 복제한 Snapshot 하나를 Robot 5대가 공유하며, 5 Episode가 끝난 뒤 평균 Action Credit으로 Central Policy를 정확히 한 번 갱신한다.

## Reward Normalization

Profile별 가능한 양의 최대값과 음의 최대 크기를 별도로 사용했다.

```text
positiveMaximum = goalWeight + speedWeight
negativeMagnitude =
    goalWeight
  + facilityDamageWeight
  + citizenRiskWeight
  + citizenMisunderstandingWeight

rawReward >= 0:
  score = 50 + 50 * rawReward / positiveMaximum

rawReward < 0:
  score = 50 + 50 * rawReward / negativeMagnitude

score = clamp(score, 0, 100)
```

따라서 `rawReward = 0`이면 정확히 50이고, 양수는 50~100, 음수는 0~50이다. 입력 raw reward가 finite가 아니면 예외를 발생시키고 최종 score는 clamp한다.

## Local Reward 구현

Local Return은 해당 State에서 직접 관찰 가능한 결과의 가중 평균이다.

```text
timeOutcome = 1 - 2 * (elapsedCost - minCost) / (maxCost - minCost)

직접 관련 Event가 없으면 safetyOutcome = +1
직접 관련 Event가 발생하면 safetyOutcome = -1

localReturn =
  weightedMean(timeOutcome, state-relevant safetyOutcome)
```

- `ROUTE_CHOICE`: speed만 반영한다. Route가 Event를 직접 발생시키지 않기 때문이다.
- `OBSTACLE`: speed + facility damage 결과
- `CITIZEN_NEARBY`: speed + citizen risk 결과
- `AMBIGUOUS_PERSON`: speed + citizen misunderstanding 결과
- Weight가 0인 축은 Local Return에서도 제외한다.
- Local Return은 `[-1, 1]`로 clamp한다.

Action Credit은 명세대로 다음 식을 적용했다.

```text
episodeReturn = (experienceScore - 50) / 50
actionCredit = clamp(0.7 * episodeReturn + 0.3 * localReturn, -1, 1)
```

## Seed

기본 실행 Seed는 `42`다. 각 Robot은 `(seed, round, robot)`에서 파생한 독립 Seed를 사용한다. 같은 Seed, Profile, 초기 Policy, 환경 설정의 전체 실행 결과가 deep equality로 재현됨을 자동 검증했다.

## SAFE 결과

| Metric | Result |
| --- | ---: |
| Success rate | 100.0% |
| Timeout rate | 0.0% |
| Misunderstanding rate | 0.0% |
| Avg elapsed time | 19.133 |
| Avg citizen risk | 0.133 |
| Avg facility damage | 0.400 |
| Avg experience score | 85.859 |

SAFE는 FAST보다 위험 행동을 낮게 학습했다. 최종 `PUSH` 확률은 25.1%, `FAST_PASS`는 21.1%였다. `WIDE_DETOUR`는 25.9%, `WAIT`는 30.6%였다.

다만 `PUSH` Preference 자체는 `0.000 → 0.306`으로 상승했다. 성공 Episode의 높은 Episode Return이 70% 반영되어, 시설물 파괴가 발생한 행동의 음수 Local Return을 상쇄했기 때문이다.

## FAST 결과

| Metric | Result |
| --- | ---: |
| Success rate | 93.3% |
| Timeout rate | 0.0% |
| Misunderstanding rate | 6.7% |
| Avg elapsed time | 18.367 |
| Avg citizen risk | 0.200 |
| Avg facility damage | 0.400 |
| Avg experience score | 79.531 |

FAST의 최종 `PUSH` 확률은 31.1%, `FAST_PASS`는 29.4%로 SAFE보다 각각 6.0%p, 8.3%p 높았다. `WIDE_DETOUR`는 22.1%, `WAIT`는 25.6%로 SAFE보다 낮았다. `TRACK`이 시민에게 사용된 실패 Episode는 speed reward를 받지 않았고 Preference가 `0.000 → -0.350`으로 내려갔다.

## BALANCED 결과

| Metric | Result |
| --- | ---: |
| Success rate | 93.3% |
| Timeout rate | 0.0% |
| Misunderstanding rate | 6.7% |
| Avg elapsed time | 18.600 |
| Avg citizen risk | 0.133 |
| Avg facility damage | 0.400 |
| Avg experience score | 80.072 |

주요 최종 확률은 SAFE와 FAST 사이에 위치했다: `PUSH` 27.4%, `FAST_PASS` 23.6%, `WIDE_DETOUR` 24.6%, `WAIT` 28.9%.

## Round별 Preference 변화

표의 값은 각 Round update가 끝난 뒤의 누적 Preference다. 해당 Round에서 선택되지 않은 Action은 이전 값을 유지한다.

| Profile / Round | PUSH | FAST_PASS | WIDE_DETOUR | CITIZEN WAIT | FAST_SHORTCUT |
| --- | ---: | ---: | ---: | ---: | ---: |
| SAFE R1 | 0.079 | 0.094 | 0.252 | 0.239 | 0.317 |
| SAFE R2 | 0.135 | 0.119 | 0.252 | 0.482 | 0.613 |
| SAFE R3 | 0.306 | 0.119 | 0.450 | 0.695 | 0.878 |
| FAST R1 | 0.235 | 0.275 | 0.048 | 0.108 | 0.285 |
| FAST R2 | 0.483 | 0.549 | 0.048 | 0.228 | 0.571 |
| FAST R3 | 0.743 | 0.549 | 0.113 | 0.345 | 0.766 |
| BALANCED R1 | 0.127 | 0.153 | 0.171 | 0.189 | 0.298 |
| BALANCED R2 | 0.249 | 0.260 | 0.171 | 0.384 | 0.582 |
| BALANCED R3 | 0.448 | 0.260 | 0.324 | 0.564 | 0.785 |

## 최종 Action Probability 비교

### ROUTE_CHOICE

| Action | SAFE | FAST | BALANCED |
| --- | ---: | ---: | ---: |
| FAST_SHORTCUT | 31.3% | 30.0% | 30.5% |
| SAFE_CORRIDOR | 20.2% | 19.9% | 19.6% |
| NORMAL_STAIRS | 22.2% | 22.9% | 22.9% |
| ELEVATOR | 26.3% | 27.2% | 27.0% |

### OBSTACLE

| Action | SAFE | FAST | BALANCED |
| --- | ---: | ---: | ---: |
| DETOUR | 20.8% | 19.4% | 20.7% |
| PUSH | 25.1% | 31.1% | 27.4% |
| SQUEEZE | 33.2% | 30.1% | 31.2% |
| WAIT | 20.8% | 19.4% | 20.7% |

### CITIZEN_NEARBY

| Action | SAFE | FAST | BALANCED |
| --- | ---: | ---: | ---: |
| WIDE_DETOUR | 25.9% | 22.1% | 24.6% |
| SLOW_PASS | 22.4% | 22.8% | 22.8% |
| WAIT | 30.6% | 25.6% | 28.9% |
| FAST_PASS | 21.1% | 29.4% | 23.6% |

### AMBIGUOUS_PERSON

| Action | SAFE | FAST | BALANCED |
| --- | ---: | ---: | ---: |
| OBSERVE | 25.0% | 25.8% | 26.3% |
| BYPASS | 25.2% | 22.8% | 22.5% |
| TRACK | 21.0% | 18.6% | 19.6% |
| SUBDUE | 28.8% | 32.8% | 31.6% |

## Automated Assertions

전용 테스트 10개가 모두 통과했다.

1. 각 State의 probability 합은 1이다.
2. probability는 음수, NaN, Infinity가 아니다.
3. Preference는 `[-2, 2]`다.
4. 실패 Episode의 speed value는 0이다.
5. Round 도중 Central Policy mutation이 없다.
6. Robot 5대는 같은 Snapshot에서 시작한다.
7. Preference update는 Round당 한 번이다.
8. `CITIZEN_RISK`, `FACILITY_DAMAGE`는 non-terminal이고 이후 terminal Event까지 진행한다.
9. `CITIZEN_MISUNDERSTANDING`, `GOAL_REACHED`, `TIMEOUT`은 terminal이다.
10. 같은 Seed와 Profile은 전체 결과가 재현된다.
11. unavailable Action은 확률표와 선택 결과에서 제거된다.
12. Reward normalization은 centered, monotonic, finite, clamped다.
13. SAFE와 FAST의 Policy가 실제로 다르고, SAFE의 `PUSH` / `FAST_PASS` Preference가 FAST보다 낮다.

## 발견한 문제

1. `0.7 episode + 0.3 local`은 성공 Episode의 모든 Action에 강한 양의 credit을 준다. 그 결과 시설물 파괴를 중요하게 둔 SAFE에서도 damage가 발생한 `PUSH`가 절대값 기준으로 상승했다.
2. `DETOUR`와 OBSTACLE의 `WAIT`는 Seed 42의 15 Episode에서 선택되지 않아 Preference가 0으로 남았다. 3 Round 단일 Seed로 두 행동의 방향을 판단할 수 없다.
3. Route Trait 차이는 Profile 간 충분히 분리되지 않았다. `FAST_SHORTCUT` 최종 확률이 SAFE 31.3%, FAST 30.0%로 기대 방향과 반대였지만 차이는 작고 표본도 적다.
4. SAFE에서 `SUBDUE`는 시민이 아니라 악당에게만 선택되어 상승했다. 이는 환경 규칙상 잘못이 아니지만, 시민 대상 `SUBDUE`의 SAFE penalty 방향은 이번 표본으로 검증되지 않았다.
5. Seed 42에서는 TIMEOUT Episode가 발생하지 않았다. TIMEOUT의 terminal 분류와 실패 speed 0 규칙은 자동 검증했지만 실제 표본 결과 비교는 하지 못했다.

## 수치 튜닝 필요 항목

- Episode / Local credit 비율 `0.7 / 0.3`
- 성공 Episode 안에서 직접 penalty Event를 만든 Action에 대한 credit 배분 방식
- Route action에 이후 Encounter 결과를 연결하는 credit 방식
- 3 Episode normalization 분모를 유지할지 여부
- 3 Round에서도 Action coverage를 확보할 환경 구성 또는 multi-seed 기준

## 판단

**NEEDS_TUNING**

Terminal 처리, Reward 부호, normalization, snapshot, round aggregation, seeded reproducibility, softmax/exploration에는 구조적 실패가 없었다. SAFE와 FAST는 `PUSH`, `FAST_PASS`, `WIDE_DETOUR`, `WAIT`에서 의미 있는 상대 차이를 보였다. 다만 SAFE의 위험 행동도 성공 Episode의 global credit 때문에 절대 Preference가 상승했고 Route Trait 분리도 약해, 현재 수치를 그대로 20-Round 기준으로 승인하기에는 이르다.

## 20-Round Validation 전에 수정해야 할 사항

1. 성공 Episode의 global return이 직접 penalty를 만든 Action을 과도하게 끌어올리지 않도록 `0.7 / 0.3` 또는 direct-event credit을 재검토한다.
2. Route 선택과 그 Route에서 발생한 Encounter 결과 사이의 credit 연결 원칙을 명시한다.
3. Seed `7`, `42`, `1234`를 포함한 multi-seed에서 각 Action 최소 표본 수와 방향을 확인한다.
4. TIMEOUT, 시민 대상 `SUBDUE`, 시민 대상 `TRACK`, unavailable Action 변형을 강제로 재현하는 scenario test를 추가한다.
5. 위 수정 후에도 epsilon 0.35에서 확률이 조기 고정되지 않는지 다시 3-Round sanity check를 수행한다.

`learning_engine_v1.md`의 상태는 `DRAFT / VALIDATING`으로 유지했다. `module_spec_v3.md`와 `session_handoff_v3.md`는 수정하지 않았다.
