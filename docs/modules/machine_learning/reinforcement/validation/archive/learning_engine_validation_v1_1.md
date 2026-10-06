# Learning Engine v1.1 Validation

## 변경 사항

- 직접 Encounter Action (`OBSTACLE`, `CITIZEN_NEARBY`, `AMBIGUOUS_PERSON`)의 credit을 `0.35 * episodeReturn + 0.65 * localReturn`으로 변경했다.
- `ROUTE_CHOICE`부터 다음 Route 선택 또는 Episode 종료까지를 Route Segment로 묶었다.
- Route credit을 `0.35 * episodeReturn + 0.65 * segmentReturn`으로 변경했다.
- Segment Return은 실제 Segment 시간, `FACILITY_DAMAGE`, `CITIZEN_RISK`, `CITIZEN_MISUNDERSTANDING`과 사용자 Weight로 계산한다.
- Round별 epsilon schedule `0.35 / 0.25 / 0.15 / 0.10`을 실제 20-Round 실행에 적용했다.
- learning rate 0.35, Preference clamp `[-2, 2]`, Reward Weight, damage/risk normalization은 변경하지 않았다.
- Action 이름, Profile, Seed에 따른 특별 규칙은 추가하지 않았다.

## Forced Scenario Test

Forced Scenario A~H가 모두 통과했다.

| Scenario | 핵심 결과 | 판정 |
| --- | --- | --- |
| A: SAFE PUSH + damage | localReturn < 0, actionCredit < 0 | PASS |
| B: SAFE FAST_PASS + risk | localReturn < 0, actionCredit < 0 | PASS |
| C: FAST PUSH + damage | FAST credit > SAFE credit | PASS |
| D: FAST FAST_PASS + risk | FAST credit > SAFE credit | PASS |
| E: Citizen SUBDUE | misunderstanding terminal, speedValue 0, SAFE credit ≤ -0.5 | PASS |
| F: Citizen TRACK threshold | misunderstanding terminal, speedValue 0, SAFE credit ≤ -0.5 | PASS |
| G: TIMEOUT | goalValue -1, speedValue 0 | PASS |
| H: risky Route Segment | 실제 risk/damage 반영, FAST routeCredit > SAFE | PASS |

`CITIZEN_RISK`와 `FACILITY_DAMAGE`는 계속 non-terminal이고, 시민 오해·목표 도달·TIMEOUT만 terminal이다.

## Credit Assignment v1 vs v1.1

```text
v1
actionCredit = 0.70 * episodeReturn + 0.30 * localReturn

v1.1 direct encounter
actionCredit = 0.35 * episodeReturn + 0.65 * localReturn

v1.1 route
routeCredit = 0.35 * episodeReturn + 0.65 * segmentReturn
```

v1에서는 성공 Episode의 global return이 직접 penalty를 만든 행동까지 양수로 끌어올렸다. v1.1 Forced Scenario에서는 SAFE의 damage `PUSH`와 risk `FAST_PASS`가 음수 credit을 받았다. 20-Round Aggregate에서도 SAFE `PUSH` Preference는 -0.165, `FAST_PASS`는 -0.216이었고 FAST에서는 둘 다 +2.000이었다.

## 3-Round Multi-Seed 결과

- 규모: 3 Profiles × 3 Seeds × 5 Robots × 3 Rounds = 135 Episodes
- Seeds: 7, 42, 1234
- SAFE final `P(PUSH) < FAST`: 3/3 Seeds
- SAFE final `P(FAST_PASS) < FAST`: 3/3 Seeds
- FAST 평균 시간 < SAFE: 3/3 Seeds
- SAFE 시민 위험 < FAST: 2/3 Seeds
- 시설 파괴는 3-Round 표본에서 세 Seed 모두 동률이었다.
- Preference 폭주, NaN, Infinity, Snapshot mutation, 100% Action 고정은 없었다.

3-Round Gate에는 구조적 중단 조건이 없어 20-Round로 진행했다.

## 20-Round Multi-Seed 결과

- 규모: 3 Profiles × 3 Seeds × 5 Robots × 20 Rounds = 900 Episodes
- Seeds: 7, 42, 1234
- Round 1~5 epsilon 0.35
- Round 6~10 epsilon 0.25
- Round 11~15 epsilon 0.15
- Round 16~20 epsilon 0.10

## SAFE Aggregate

| Metric | Result |
| --- | ---: |
| successRate | 88.67% |
| timeoutRate | 1.00% |
| misunderstandingRate | 10.33% |
| avgElapsedTime | 20.805 |
| avgCitizenRisk | 0.107 |
| avgFacilityDamage | 0.127 |
| avgExperienceScore | 81.584 |

SAFE는 damage/risk를 직접 만든 행동을 억제했다. 최종 `PUSH` 확률은 6.77%, `FAST_PASS`는 5.79%였다.

## FAST Aggregate

| Metric | Result |
| --- | ---: |
| successRate | 84.67% |
| timeoutRate | 0.00% |
| misunderstandingRate | 15.33% |
| avgElapsedTime | 18.235 |
| avgCitizenRisk | 0.380 |
| avgFacilityDamage | 0.180 |
| avgExperienceScore | 72.124 |

FAST는 SAFE보다 2.570 time unit 빨랐다. 최종 `PUSH` 확률은 44.36%, `FAST_PASS`는 72.65%였다. 시민 오해 Weight 1의 penalty는 남아 있어 `TRACK` Preference는 -1.317이었지만, FAST의 성공률은 SAFE보다 4.0%p 낮았다.

## BALANCED Aggregate

| Metric | Result |
| --- | ---: |
| successRate | 87.33% |
| timeoutRate | 0.00% |
| misunderstandingRate | 12.67% |
| avgElapsedTime | 19.958 |
| avgCitizenRisk | 0.170 |
| avgFacilityDamage | 0.140 |
| avgExperienceScore | 76.922 |

시간, 시민 위험, 시설 파괴, 시민 오해율이 모두 SAFE와 FAST 사이에 위치했다.

## Seed별 결과

| Profile | Seed | Success | Timeout | Misunderstanding | Avg Time | Citizen Risk | Facility Damage | Score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| SAFE | 7 | 86% | 2% | 12% | 20.490 | 0.170 | 0.130 | 79.314 |
| SAFE | 42 | 90% | 0% | 10% | 20.380 | 0.080 | 0.150 | 82.496 |
| SAFE | 1234 | 90% | 1% | 9% | 21.545 | 0.070 | 0.100 | 82.940 |
| FAST | 7 | 82% | 0% | 18% | 18.315 | 0.390 | 0.160 | 69.754 |
| FAST | 42 | 82% | 0% | 18% | 17.470 | 0.450 | 0.170 | 70.148 |
| FAST | 1234 | 90% | 0% | 10% | 18.920 | 0.300 | 0.210 | 76.469 |
| BALANCED | 7 | 88% | 0% | 12% | 19.500 | 0.320 | 0.140 | 76.731 |
| BALANCED | 42 | 84% | 0% | 16% | 19.345 | 0.110 | 0.160 | 75.176 |
| BALANCED | 1234 | 90% | 0% | 10% | 21.030 | 0.080 | 0.120 | 78.861 |

## Round 1 / 5 / 10 / 15 / 20 Preference 변화

아래 값은 Seed 3개의 평균 Preference다.

### SAFE

| Round | Route range | DETOUR | PUSH | SQUEEZE | WIDE | SLOW | Citizen WAIT | FAST_PASS | OBSERVE | BYPASS | TRACK | SUBDUE |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0.215~0.281 | 0.071 | -0.015 | 0.216 | 0.142 | 0.122 | 0.117 | -0.087 | 0.090 | 0.043 | -0.015 | -0.021 |
| 5 | 0.954~1.263 | 0.435 | -0.046 | 0.969 | 0.647 | 0.620 | 0.763 | -0.208 | 0.500 | 0.326 | -0.277 | -0.045 |
| 10 | 1.879~2.000 | 1.068 | -0.149 | 1.672 | 1.229 | 1.310 | 1.373 | -0.287 | 0.879 | 1.111 | -0.362 | -0.131 |
| 15 | all 2.000 | 1.828 | -0.129 | 1.824 | 1.925 | 1.908 | 1.853 | -0.362 | 1.382 | 1.563 | -0.290 | 0.090 |
| 20 | all 2.000 | 2.000 | -0.165 | 2.000 | 1.942 | 2.000 | 2.000 | -0.216 | 1.908 | 2.000 | -0.341 | 0.168 |

### FAST

| Round | Route range | DETOUR | PUSH | SQUEEZE | WIDE | SLOW | Citizen WAIT | FAST_PASS | OBSERVE | BYPASS | TRACK | SUBDUE |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0.116~0.224 | -0.051 | 0.228 | 0.210 | -0.101 | -0.033 | -0.076 | 0.247 | 0.043 | -0.003 | -0.065 | 0.096 |
| 5 | 0.551~0.955 | -0.311 | 0.786 | 1.052 | -0.497 | -0.182 | -0.287 | 1.037 | 0.160 | 0.324 | -0.856 | 0.202 |
| 10 | 1.410~1.973 | -0.706 | 1.595 | 1.934 | -0.852 | -0.087 | -0.471 | 2.000 | 0.404 | 0.579 | -1.280 | 0.538 |
| 15 | all 2.000 | -1.014 | 2.000 | 2.000 | -1.043 | 0.059 | -0.652 | 2.000 | 0.643 | 0.840 | -1.305 | 0.946 |
| 20 | all 2.000 | -1.167 | 2.000 | 2.000 | -1.092 | 0.179 | -0.779 | 2.000 | 0.886 | 1.642 | -1.317 | 1.384 |

BALANCED는 Round 20에 `SQUEEZE = 2.000`, `SLOW_PASS = 1.880`, `BYPASS = 1.840`, `TRACK = -0.898`이었고 나머지 Encounter Action은 SAFE와 FAST 사이의 값을 보였다. Route 4개는 BALANCED에서도 모두 2.000에 도달했다.

## Final Action Probability 비교

### ROUTE_CHOICE

| Action | SAFE | FAST | BALANCED |
| --- | ---: | ---: | ---: |
| FAST_SHORTCUT | 25.00% | 25.00% | 25.00% |
| SAFE_CORRIDOR | 25.00% | 25.00% | 25.00% |
| NORMAL_STAIRS | 25.00% | 25.00% | 25.00% |
| ELEVATOR | 25.00% | 25.00% | 25.00% |

### OBSTACLE

| Action | SAFE | FAST | BALANCED |
| --- | ---: | ---: | ---: |
| DETOUR | 39.05% | 4.35% | 16.67% |
| PUSH | 6.77% | 44.36% | 14.14% |
| SQUEEZE | 39.05% | 44.36% | 54.30% |
| WAIT | 15.13% | 6.93% | 14.90% |

### CITIZEN_NEARBY

| Action | SAFE | FAST | BALANCED |
| --- | ---: | ---: | ---: |
| WIDE_DETOUR | 30.33% | 5.81% | 16.15% |
| SLOW_PASS | 31.94% | 14.56% | 37.13% |
| WAIT | 31.94% | 6.98% | 24.88% |
| FAST_PASS | 5.79% | 72.65% | 21.84% |

### AMBIGUOUS_PERSON

| Action | SAFE | FAST | BALANCED |
| --- | ---: | ---: | ---: |
| OBSERVE | 40.05% | 20.38% | 30.35% |
| BYPASS | 43.51% | 41.30% | 48.24% |
| TRACK | 7.23% | 4.61% | 5.58% |
| SUBDUE | 9.21% | 33.71% | 15.82% |

## Route Segment 학습 결과

| Route | SAFE Segment Return | FAST Segment Return | BALANCED Segment Return |
| --- | ---: | ---: | ---: |
| FAST_SHORTCUT | 0.803 | 0.750 | 0.727 |
| SAFE_CORRIDOR | 0.887 | 0.516 | 0.793 |
| NORMAL_STAIRS | 0.840 | 0.624 | 0.757 |
| ELEVATOR | 0.837 | 0.638 | 0.759 |

Segment Return 자체는 결과를 구분했다. SAFE는 SAFE_CORRIDOR가 가장 높았고 FAST는 FAST_SHORTCUT이 가장 높았다. 그러나 모든 Route의 평균 credit이 계속 양수여서 Round 15에 네 Preference가 모두 +2 clamp에 도달했다. 이 때문에 유효한 Segment Return 차이가 최종 Policy Probability에 남지 않았다.

## Exploration / Convergence 분석

- Round 20 epsilon은 0.10으로 유지됐다.
- 모든 available Action probability는 0보다 컸다.
- 최저 Aggregate probability는 FAST `DETOUR` 4.35%, 최고는 FAST `FAST_PASS` 72.65%였다.
- 100% 고정은 없었고 exploration은 작동했다.
- Encounter Action은 Profile별로 의미 있게 분리됐다.
- Route Preference는 Round 15에 전부 clamp되어 너무 빠르게 동일 수렴했다.
- 여러 Encounter Preference도 +2에 도달해 장기 실행에서는 clamp saturation이 관찰됐다.

## Profile Separation

| 비교 | Aggregate 방향 | 일치 Seed |
| --- | --- | ---: |
| SAFE citizen risk < FAST | 0.107 < 0.380 | 3/3 |
| SAFE facility damage < FAST | 0.127 < 0.180 | 3/3 |
| FAST elapsed time < SAFE | 18.235 < 20.805 | 3/3 |
| SAFE P(PUSH) < FAST | 6.77% < 44.36% | 3/3 |
| SAFE P(FAST_PASS) < FAST | 5.79% < 72.65% | 3/3 |
| SAFE P(FAST_SHORTCUT) < FAST | 25.00% = 25.00% | 0/3 |

핵심 5개 필수 방향은 Aggregate와 3개 Seed에서 모두 일치했다. Route 방향만 saturation 때문에 소실됐다.

## Automated Assertions

- 기존 assertion을 유지하고 Forced Scenario와 20-Round 검증을 추가했다.
- Reinforcement 전용 테스트: 16/16 PASS
- 검증 항목: probability 합, finite/non-negative, unavailable Action 제거, reward normalization, 실패 speed 0, terminal 규칙, shared immutable snapshot, Round당 update 1회, Preference clamp, 재현성, direct penalty credit, Profile credit 차이, Route Segment credit, epsilon schedule, Round 20 non-zero exploration.

## 발견된 문제

1. Route Preference 4개가 세 Profile·세 Seed에서 모두 +2에 도달해 최종 Route 확률이 25%로 같아졌다.
2. Segment Return은 Profile별 차이를 만들지만, 양수 credit의 누적과 clamp 때문에 그 순위가 장기 Policy에 보존되지 않는다.
3. 일부 Encounter Preference도 +2에 도달했다. 현재 확률은 구분되지만 더 긴 실행에서는 saturation이 추가 정보를 지울 수 있다.
4. FAST의 `FAST_PASS` 확률은 72.65%로 강한 지배 행동이 됐다. 0%/100% 고정은 아니지만 다음 tuning에서 의도 수준인지 검토해야 한다.

## 추가 튜닝 후보

- Route Segment Return을 행동 간 상대 기준으로 centered하거나, Route update에서 공통 양의 baseline을 제거한다.
- Preference decay 또는 advantage-style update가 clamp saturation을 줄이는지 별도 단일-variable validation으로 확인한다.
- Route 수정 후 Encounter Action 분리가 유지되는지 동일 Seeds로 재검증한다.
- learning rate, clamp, exploration은 이번 실행에서 동시에 변경하지 않았다. 다음 실험에서도 한 변수군씩 검증한다.

## 최종 판단

**NEEDS_TUNING**

Credit 부호, terminal 처리, Snapshot, reproducibility, exploration과 SAFE/FAST Encounter Profile Separation은 정상이다. 핵심 5개 SAFE/FAST 방향도 3/3 Seeds에서 모두 확인됐다. 그러나 Route 학습이 Round 15에 완전히 saturation되어 Profile별 Route Probability가 소실됐으므로 `PASS_CANDIDATE`로 올리기에는 이르다.

`learning_engine_v1.md`는 계속 `DRAFT / VALIDATING` 상태다. v1.1 Credit Assignment가 승인되면 해당 문서의 Action Credit과 Route Credit 절을 업데이트해야 한다. `module_spec_v3.md`와 `session_handoff_v3.md`는 수정하지 않았다.
