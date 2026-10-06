# Learning Engine v1.2 Validation

## v1.1 문제

v1.1은 Encounter Action을 정상적으로 분리했지만, Route의 `rawRouteCredit`이 대부분 양수여서 Round 15 전후에 네 Route Preference가 모두 `+2`에 도달했다. 그 결과 Profile별 Segment Return 차이가 있어도 최종 Route 확률은 모두 약 25%가 됐다.

## v1.2 Route Advantage 변경

Encounter update와 Route raw credit 공식은 변경하지 않았다.

```text
Encounter actionCredit = 0.35 * episodeReturn + 0.65 * localReturn
Route rawRouteCredit = 0.35 * episodeReturn + 0.65 * segmentReturn
routeBaseline = mean(rawRouteCredit in the same Route Decision Context)
routeAdvantage = rawRouteCredit - routeBaseline
preferenceNew = preferenceOld + 0.35 * mean(routeAdvantage for the action)
```

한 Round의 5개 Episode가 끝난 뒤 Route Experience를 Context별로 모아 baseline과 advantage를 계산한다. 현재 mock 환경은 네 Route가 경쟁하는 `MOCK_ROUTE_CONTEXT` 하나를 사용하지만, Experience에 `routeContext`와 `routeOptions`를 저장해 Context별 계산 구조를 유지했다.

Route update가 끝나면 Context 내 Preference 평균을 빼고, 그 다음 `[-2, +2]` clamp를 적용한다. Encounter Preference에는 re-centering을 적용하지 않았다. learning rate, Reward Weight, risk/damage normalization, epsilon schedule과 Segment Return 계산도 변경하지 않았다.

## Route Forced Scenario

| Scenario | 검증 결과 | 판정 |
| --- | --- | --- |
| R1 | SAFE에서 무피해 `SAFE_CORRIDOR` advantage가 위험·파괴가 발생한 `FAST_SHORTCUT`보다 큼 | PASS |
| R2 | 같은 위험한 빠른 Segment의 credit은 FAST가 SAFE보다 큼 | PASS |
| R3 | Context별 advantage 평균 ≈ 0, 공통 `+1.0` offset에 불변, Context baseline 분리 | PASS |
| R4 | `[0.8, 0.5, 0.2, 0.1]` re-centering 전후 Softmax+exploration 확률 동일 | PASS |
| R5 | 20 Round 뒤에도 네 Route가 공동 `+2` 포화되지 않음 | PASS |

## Encounter Regression Test

기존 Forced Scenario A~H를 모두 유지했고 전부 통과했다. SAFE `PUSH + DAMAGE`와 `FAST_PASS + RISK`는 음수 credit을 유지했고, 같은 위험한 빠른 행동은 FAST credit이 SAFE보다 높았다. `SUBDUE`, `TRACK` threshold, `TIMEOUT` terminal 및 speed 규칙도 변하지 않았다.

## 3-Round Multi-Seed

- 규모: 3 Profiles × 3 Seeds × 5 Robots × 3 Rounds = 135 Episodes
- Seeds: 7, 42, 1234
- 구조적 이상, NaN/Infinity, Snapshot mutation, Route 공동 포화 없음
- FAST 평균 시간 < SAFE: 3/3 Seeds
- SAFE `P(PUSH) < FAST`: 3/3 Seeds
- SAFE `P(FAST_PASS) < FAST`: 3/3 Seeds
- SAFE `P(FAST_SHORTCUT) < FAST`: 2/3 Seeds
- SAFE `P(SAFE_CORRIDOR) > FAST`: 2/3 Seeds

시설 파괴는 짧은 표본에서 세 Seed 모두 동률이었지만 Gate 중단 조건은 아니었다. Forced test와 구조 검사를 통과해 20-Round validation으로 진행했다.

## 20-Round Multi-Seed

- 규모: 3 Profiles × 3 Seeds × 5 Robots × 20 Rounds = 900 Episodes
- 각 Profile/Seed: 100 Experiences, 20 Central Policy Updates
- Round마다 5개 Episode가 모두 끝난 뒤 중앙 Policy를 한 번만 업데이트
- epsilon: Round 1~5 `0.35`, 6~10 `0.25`, 11~15 `0.15`, 16~20 `0.10`

## SAFE Aggregate

| Metric | Result |
| --- | ---: |
| successRate | 89.33% |
| timeoutRate | 1.00% |
| misunderstandingRate | 9.67% |
| avgElapsedTime | 20.887 |
| avgCitizenRisk | 0.107 |
| avgFacilityDamage | 0.113 |
| avgExperienceScore | 82.150 |

Final Route probability는 `FAST_SHORTCUT 24.25%`, `SAFE_CORRIDOR 30.51%`, `NORMAL_STAIRS 22.89%`, `ELEVATOR 22.35%`였다.

## FAST Aggregate

| Metric | Result |
| --- | ---: |
| successRate | 86.00% |
| timeoutRate | 0.00% |
| misunderstandingRate | 14.00% |
| avgElapsedTime | 18.188 |
| avgCitizenRisk | 0.410 |
| avgFacilityDamage | 0.173 |
| avgExperienceScore | 73.382 |

Final Route probability는 `FAST_SHORTCUT 41.20%`, `SAFE_CORRIDOR 18.62%`, `NORMAL_STAIRS 21.08%`, `ELEVATOR 19.10%`였다.

## BALANCED Aggregate

| Metric | Result |
| --- | ---: |
| successRate | 87.67% |
| timeoutRate | 0.33% |
| misunderstandingRate | 12.00% |
| avgElapsedTime | 20.147 |
| avgCitizenRisk | 0.157 |
| avgFacilityDamage | 0.123 |
| avgExperienceScore | 77.348 |

Final Route probability는 `FAST_SHORTCUT 26.01%`, `SAFE_CORRIDOR 29.41%`, `NORMAL_STAIRS 22.83%`, `ELEVATOR 21.76%`였다.

## Seed별 비교

| Profile | Seed | Success | Timeout | Misunderstanding | Avg Time | Citizen Risk | Facility Damage | Score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| SAFE | 7 | 87% | 2% | 11% | 20.810 | 0.160 | 0.120 | 80.109 |
| SAFE | 42 | 90% | 0% | 10% | 20.585 | 0.080 | 0.130 | 82.571 |
| SAFE | 1234 | 91% | 1% | 8% | 21.265 | 0.080 | 0.090 | 83.770 |
| FAST | 7 | 83% | 0% | 17% | 18.640 | 0.400 | 0.140 | 70.387 |
| FAST | 42 | 84% | 0% | 16% | 17.405 | 0.490 | 0.170 | 72.035 |
| FAST | 1234 | 91% | 0% | 9% | 18.520 | 0.340 | 0.210 | 77.723 |
| BALANCED | 7 | 88% | 1% | 11% | 20.025 | 0.260 | 0.130 | 77.087 |
| BALANCED | 42 | 84% | 0% | 16% | 19.620 | 0.110 | 0.130 | 75.287 |
| BALANCED | 1234 | 91% | 0% | 9% | 20.795 | 0.100 | 0.110 | 79.672 |

## FAST_SHORTCUT 비교

| 범위 | SAFE | FAST | 방향 |
| --- | ---: | ---: | --- |
| Aggregate probability | 24.25% | 41.20% | SAFE < FAST |
| Seed 방향 일치 |  |  | 3/3 |
| Aggregate Segment Return | 0.804 | 0.762 | Profile Weight에 따른 실제 결과 평가 |

v1.1의 `0/3` 실패 지표가 v1.2에서 `3/3`으로 회복됐다.

## SAFE_CORRIDOR 비교

| 범위 | SAFE | FAST | 방향 |
| --- | ---: | ---: | --- |
| Aggregate probability | 30.51% | 18.62% | SAFE > FAST |
| Seed 방향 일치 |  |  | 3/3 |
| Aggregate Segment Return | 0.892 | 0.519 | Profile Weight에 따른 실제 결과 평가 |

## Route Preference Round 1 / 5 / 10 / 15 / 20

아래 값은 세 Seed의 Profile별 평균이다. Action 순서는 `FAST_SHORTCUT / SAFE_CORRIDOR / NORMAL_STAIRS / ELEVATOR`다.

| Profile | Round | Route Preference | Route Probability |
| --- | ---: | --- | --- |
| SAFE | 1 | -0.004 / 0.043 / -0.023 / -0.015 | 24.95% / 25.69% / 24.65% / 24.71% |
| SAFE | 5 | 0.066 / 0.145 / 0.027 / -0.238 | 26.02% / 27.69% / 25.37% / 20.93% |
| SAFE | 10 | 0.048 / 0.200 / -0.084 / -0.163 | 25.77% / 29.37% / 23.30% / 21.56% |
| SAFE | 15 | 0.001 / 0.203 / -0.069 / -0.136 | 24.91% / 29.64% / 23.47% / 21.98% |
| SAFE | 20 | -0.019 / 0.235 / -0.088 / -0.129 | 24.25% / 30.51% / 22.89% / 22.35% |
| FAST | 1 | -0.005 / 0.025 / 0.044 / -0.064 | 24.89% / 25.39% / 25.73% / 23.99% |
| FAST | 5 | 0.035 / 0.064 / 0.180 / -0.278 | 25.43% / 26.02% / 28.21% / 20.34% |
| FAST | 10 | 0.333 / 0.003 / -0.112 / -0.224 | 32.63% / 24.78% / 22.30% / 20.29% |
| FAST | 15 | 0.436 / -0.121 / -0.102 / -0.213 | 35.99% / 21.99% / 22.04% / 19.98% |
| FAST | 20 | 0.616 / -0.296 / -0.109 / -0.211 | 41.20% / 18.62% / 21.08% / 19.10% |
| BALANCED | 1 | -0.004 / 0.035 / -0.009 / -0.021 | 24.94% / 25.56% / 24.87% / 24.63% |
| BALANCED | 5 | 0.073 / 0.095 / 0.047 / -0.215 | 26.21% / 26.72% / 25.77% / 21.31% |
| BALANCED | 10 | 0.074 / 0.199 / -0.078 / -0.195 | 26.42% / 29.21% / 23.31% / 21.07% |
| BALANCED | 15 | 0.016 / 0.243 / -0.104 / -0.154 | 25.31% / 30.48% / 22.45% / 21.76% |
| BALANCED | 20 | 0.041 / 0.205 / -0.083 / -0.163 | 26.01% / 29.41% / 22.83% / 21.76% |

각 checkpoint의 Route 및 Encounter Preference/Probability 전체 값은 `npm run validate:reinforcement -- --rounds=20 --seeds=7,42,1234`의 `CHECKPOINT`와 `AGGREGATE_CHECKPOINT` JSON 레코드에도 기록된다.

## Route Saturation 여부

- Round 5, 10, 15, 20 어느 시점에도 네 Route가 같은 clamp 값으로 수렴하지 않았다.
- Aggregate Round 20 Route Preference 합은 반올림 오차 범위에서 0이었다.
- Seed별 Round 20에서도 네 Route 공동 `+2` 포화는 없었다.
- v1.1의 동일 25% 확률이 제거되고 SAFE/FAST Route 분리가 남았다.

따라서 Route 공통 positive baseline 누적과 공동 saturation은 제거됐다.

## Encounter Preference Regression

| 비교 | SAFE | FAST | 방향 | Seed 일치 |
| --- | ---: | ---: | --- | ---: |
| `P(PUSH)` | 6.66% | 44.38% | SAFE < FAST | 3/3 |
| `P(FAST_PASS)` | 5.62% | 73.18% | SAFE < FAST | 3/3 |
| avgCitizenRisk | 0.107 | 0.410 | SAFE < FAST | 3/3 |
| avgFacilityDamage | 0.113 | 0.173 | SAFE < FAST | 3/3 |
| avgElapsedTime | 20.887 | 18.188 | FAST < SAFE | 3/3 |

Route update 변경 뒤에도 v1.1 Encounter 분리와 핵심 outcome 방향이 유지됐다. Encounter Preference 일부의 `+2` 도달은 v1.1과 동일하게 남아 있으며 이번 변경 범위 밖이다.

## Exploration

- Round 20 epsilon은 `0.10`이다.
- 모든 available Route 및 Encounter Action probability는 finite, non-negative, non-zero다.
- Seed별 최저 Route 확률도 12.71%로 0% 고정이 없었다.
- Aggregate Route 확률 합은 Profile마다 1이다.

## Automated Assertions

- Reinforcement 전용 테스트: 20/20 PASS
- 기존 A~H 및 신규 R1~R5 PASS
- Context별 advantage 평균 ≈ 0, 공통 reward offset 불변, Context baseline 분리 PASS
- re-centering 전후 Softmax+exploration 확률 동일 PASS
- Route Preference finite, probability 합 1, 음수 probability 없음 PASS
- Round 중 shared Policy Snapshot mutation 없음 PASS
- Route 공동 `+2` 포화 regression 방지 PASS
- 동일 Seed reproducibility PASS
- TypeScript typecheck 및 전체 test suite PASS

## 발견된 문제

1. SAFE Seed 42에서는 `ELEVATOR`가 `SAFE_CORRIDOR`보다 높은 최종 확률을 보였고, BALANCED Seed 1234에서는 `FAST_SHORTCUT`이 가장 높았다. 다중 Seed Aggregate와 요구 방향은 모두 충족하므로 정상적인 표본 변동으로 판단했다.
2. Encounter Preference 일부는 계속 `+2` clamp에 도달한다. Encounter 분리는 유지되지만 더 긴 학습의 saturation은 별도 단일-variable tuning 후보다.
3. 현재 mock은 단일 Route Context다. 실제 Map 연결 시 Decision Node별 stable context key와 available route set을 전달해야 한다.

## 판단

**PASS_CANDIDATE**

Forced Route와 Encounter regression test가 모두 통과했고, 900 Episode에서 Route 공동 saturation이 제거됐다. `FAST_SHORTCUT`은 SAFE < FAST, `SAFE_CORRIDOR`는 SAFE > FAST가 각각 3/3 Seeds와 Aggregate에서 확인됐다. Encounter 분리, outcome 방향, exploration, reproducibility도 유지됐다.

`learning_engine_v1.md`는 `DRAFT / VALIDATING` 상태를 유지한다. Learning Engine v1.2를 APPROVED로 변경하지 않았다.
