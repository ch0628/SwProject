# Reward Weight 행동 전수조사 (2026-10-15)

## 최종 판정

**PARTIALLY_MATCHES_REWARD_INTENT**

`speed`, `facilityDamage`, `citizenRisk`, `citizenMisunderstanding`은 각각 의도한 핵심 metric과 행동을 분명하게 바꿨다. 반면 `goal`은 성공률과 행동에 거의 영향을 주지 않았다. 또한 유효한 네 항목도 대부분 `0→1`에서 변화가 집중되고 `1→2→3`은 빠르게 포화됐다. 따라서 “별을 높일수록 의도한 행동이 더 강해진다”는 설명은 항목에 따라 부분적으로만 맞는다.

## 1. 실제 Reward Weight schema

| 코드 이름 | UI 한국어 | 실제 의미 |
|---|---|---|
| `goal` | 임무 완수 | 성공은 보상, 모든 실패 terminal은 벌점 |
| `speed` | 빠르게 해결하기 | 성공 episode의 남은 시간과 각 행동/segment의 시간 비용 |
| `facilityDamage` | 시설 보호 | `FACILITY_DAMAGE`와 시설 손상 행동의 벌점 |
| `citizenRisk` | 시민 보호 | `CITIZEN_RISK`와 시민 통과 행동의 위험도 벌점 |
| `citizenMisunderstanding` | 시민을 정확히 판단하기 | `CITIZEN_MISUNDERSTANDING` 및 판단 행동의 벌점 |

UI의 0/1/2/3 버튼은 `RewardWeights` 객체에 숫자 그대로 저장되고 `TrainingRuntimeController`를 거쳐 `runActualMapTraining`에 전달된다. 표시 문구는 각각 `중요하지 않아요 / 조금 중요해요 / 중요해요 / 아주 중요해요`다.

실제 action enum:

- Obstacle: `DETOUR`, `CLEAR`, `PUSH`
- Citizen: `WIDE_DETOUR`, `SLOW_PASS`, `WAIT`, `FAST_PASS`
- Ambiguous person: `OBSERVE`, `BYPASS`, `TRACK`, `SUBDUE`
- Villain: `SUBDUE`, `FORCE_PASS`, `DISTRACT`, `BYPASS`, `RETREAT`
- Boss: `SUBDUE`, `DISTRACT`, `RETREAT`
- Route: actual map의 16개 `ACTUAL_ROUTE:*` action

## 2. Sweep 규모와 검증

- Weight combinations: **1,024** (`4^5`)
- Training seeds: **1~10**, 조합당 10 sessions
- Training: session당 **5 Rounds × 5 Robots = 25 episodes**
- Final evaluation seeds: **10001~10020**, final policy당 20 episodes
- Training episodes: **256,000**
- Evaluation episodes: **204,800**
- 총 headless episodes: **460,800**
- Phaser, browser, asset loading: 사용하지 않음

검증 결과:

- 1,024 tuple이 정확히 한 번씩 존재
- tuple/seed 재실행 결과 deterministic
- 모든 final policy가 동일 evaluation seed 목록 사용
- evaluation 전후 policy JSON이 매 episode 동일
- evaluation policy update: 0
- 각 tuple의 evaluation episodes: 200
- CSV 1,024행, tuple 중복 없음

Action opportunity는 각 기록된 decision마다 그 상태에서 실제 사용 가능했던 action에 1회씩 부여했다. Route는 `routeOptions`, Villain의 `BYPASS`, Obstacle의 `DETOUR` availability를 실제 production 조건대로 반영했다. JSON에는 tuple별 raw count, opportunity, selection rate가 모두 있다.

## 3. 항목별 0/1/2/3 marginal 평균

각 값은 나머지 네 항목의 256개 조합을 평균한 final evaluation 결과다.

### 임무 완수 (`goal`)

| 별 | 성공 | Disabled | Timeout | Misunderstanding | 평균 시간 |
|---:|---:|---:|---:|---:|---:|
| 0 | 36.74% | 31.16% | 8.64% | 23.46% | 429.95 |
| 1 | 37.20% | 31.82% | 8.29% | 22.69% | 430.41 |
| 2 | 37.50% | 31.72% | 8.23% | 22.55% | 431.25 |
| 3 | 37.48% | 31.89% | 8.19% | 22.44% | 431.11 |

0→3 성공률 변화는 **+0.75%p**뿐이다. 주요 action rate 변화도 대부분 1%p 미만이다. `goal`은 현재 구조에서 실질적인 행동 조절력이 매우 약하다.

### 빠르게 해결하기 (`speed`)

| 별 | 성공 | Disabled | Timeout | Misunderstanding | 평균 시간 | Damage | Risk |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 18.77% | 30.11% | 33.24% | 17.88% | 565.29 | 0.202 | 0.140 |
| 1 | 44.05% | 34.37% | 0.08% | 21.50% | 390.65 | 0.256 | 0.270 |
| 2 | 43.47% | 31.48% | 0.02% | 25.03% | 384.09 | 0.278 | 0.330 |
| 3 | 42.64% | 30.62% | 0.02% | 26.73% | 382.70 | 0.298 | 0.345 |

시간과 timeout에는 매우 강하지만, 별이 높을수록 damage/risk/misunderstanding이 증가한다. 성공률은 0→1에서 크게 오르지만 1→3에서는 오히려 조금 감소한다.

### 시설 보호 (`facilityDamage`)

| 별 | 성공 | 평균 시간 | Damage/episode | PUSH | CLEAR | DETOUR |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 37.91% | 431.40 | 0.399 | 66.18% | 23.23% | 10.59% |
| 1 | 37.58% | 432.62 | 0.243 | 45.22% | 39.55% | 15.22% |
| 2 | 36.97% | 430.24 | 0.206 | 38.13% | 42.83% | 19.04% |
| 3 | 36.46% | 428.46 | 0.185 | 35.63% | 42.44% | 21.93% |

시설 피해는 0→3에서 **53.8% 감소**했다. PUSH가 30.55%p 줄고 CLEAR/DETOUR가 늘어 의도와 명확히 일치한다. 성공률은 1.45%p 낮아졌다.

### 시민 보호 (`citizenRisk`)

| 별 | 성공 | 평균 시간 | Risk/episode | FAST_PASS | WAIT | SLOW_PASS | WIDE_DETOUR |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 37.38% | 432.94 | 0.430 | 39.03% | 24.76% | 22.16% | 14.05% |
| 1 | 37.19% | 431.01 | 0.276 | 24.79% | 26.59% | 28.86% | 19.76% |
| 2 | 37.21% | 429.91 | 0.211 | 18.35% | 28.04% | 29.94% | 23.68% |
| 3 | 37.14% | 428.86 | 0.168 | 14.11% | 30.28% | 29.57% | 26.03% |

시민 위험은 0→3에서 **61.0% 감소**했다. FAST_PASS가 24.92%p 줄고 WAIT/WIDE_DETOUR가 증가했다. 성공률에는 거의 영향이 없었다.

### 시민을 정확히 판단하기 (`citizenMisunderstanding`)

| 별 | 성공 | Disabled | Timeout | Misunderstanding | 평균 시간 | SUBDUE | OBSERVE | TRACK | BYPASS |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 29.22% | 36.50% | 6.80% | 27.48% | 393.68 | 51.02% | 20.41% | 16.26% | 14.56% |
| 1 | 38.08% | 29.42% | 8.73% | 23.77% | 434.70 | 43.31% | 21.90% | 22.27% | 23.00% |
| 2 | 40.53% | 29.59% | 8.82% | 21.05% | 444.92 | 41.35% | 23.95% | 23.63% | 23.79% |
| 3 | 41.09% | 31.07% | 9.01% | 18.83% | 449.42 | 39.98% | 25.78% | 24.69% | 23.92% |

오판 terminal은 0→3에서 **8.65%p 감소**했다. 특히 Ambiguous state의 SUBDUE는 48.76%→25.61%, OBSERVE는 20.41%→25.78%, TRACK은 16.26%→24.69%로 변했다. 더 오래 판단하는 만큼 시간은 증가했다.

## 4. 별 하나를 올렸을 때의 평균 효과

다른 네 별을 고정해 짝지은 256개 비교의 평균이다.

| 항목 | 단계 | 핵심 metric 변화 | 대표 action 변화 |
|---|---|---|---|
| goal | 0→1 | 성공 +0.46%p | 유의한 공통 행동 변화 없음 |
| goal | 1→2 | 성공 +0.29%p | 유의한 공통 행동 변화 없음 |
| goal | 2→3 | 성공 -0.01%p | 유의한 공통 행동 변화 없음 |
| speed | 0→1 | 시간 -174.64, timeout -33.16%p, 성공 +25.28%p | SUBDUE +20.43%p, PUSH +17.39%p, DETOUR -15.03%p, RETREAT -17.95%p |
| speed | 1→2 | 시간 -6.56, 성공 -0.58%p | FAST_PASS +7.71%p, PUSH +4.50%p |
| speed | 2→3 | 시간 -1.39, 성공 -0.83%p | FAST_PASS +4.30%p, PUSH +3.14%p |
| facilityDamage | 0→1 | damage -0.156 | PUSH -20.96%p, CLEAR +16.32%p, DETOUR +4.64%p |
| facilityDamage | 1→2 | damage -0.038 | PUSH -7.09%p, CLEAR +3.28%p, DETOUR +3.81%p |
| facilityDamage | 2→3 | damage -0.021 | PUSH -2.50%p, DETOUR +2.89%p |
| citizenRisk | 0→1 | risk -0.154 | FAST_PASS -14.24%p, SLOW_PASS +6.70%p, WIDE_DETOUR +5.72%p |
| citizenRisk | 1→2 | risk -0.065 | FAST_PASS -6.45%p, WIDE_DETOUR +3.91%p |
| citizenRisk | 2→3 | risk -0.043 | FAST_PASS -4.23%p, WAIT +2.24%p |
| citizenMisunderstanding | 0→1 | 오판 -3.71%p, 성공 +8.86%p | SUBDUE -7.71%p, TRACK +6.01%p, BYPASS +8.44%p |
| citizenMisunderstanding | 1→2 | 오판 -2.72%p, 성공 +2.45%p | OBSERVE +2.05%p, DISTRACT +1.91%p |
| citizenMisunderstanding | 2→3 | 오판 -2.22%p, 성공 +0.56%p | OBSERVE +1.83%p, SUBDUE -1.37%p |

대부분 첫 별의 효과가 가장 크다. 현재 구현의 별 1→2→3은 선형적인 강도 증가가 아니다.

## 5. 행동 선택 변화 요약

| 높인 별 | 실제 0→3 행동 변화 |
|---|---|
| 임무 완수 | SUBDUE, DISTRACT, FORCE_PASS, RETREAT 등 거의 변화 없음 |
| 빠르게 해결 | SUBDUE +23.72%p, PUSH +25.03%p, FAST_PASS +22.42%p; DETOUR -21.12%p, OBSERVE -20.57%p, RETREAT -16.93%p |
| 시설 보호 | PUSH -30.55%p; CLEAR +19.21%p, DETOUR +11.34%p |
| 시민 보호 | FAST_PASS -24.92%p; WIDE_DETOUR +11.99%p, SLOW_PASS +7.42%p, WAIT +5.52%p |
| 정확히 판단 | 전체 SUBDUE -11.03%p, Ambiguous SUBDUE -23.15%p; BYPASS +9.35%p, TRACK +8.43%p, OBSERVE +5.37%p, DISTRACT +7.88%p |

`FORCE_PASS`는 어느 단일 별에서도 큰 공통 변화가 없었다. `BYPASS`는 location별 availability가 다른 실제 denominator로 계산했다.

## 6. 성공/실패 종류 변화

0→3 marginal 변화:

| 항목 | Success | Disabled | Timeout | Misunderstanding |
|---|---:|---:|---:|---:|
| goal | +0.75%p | +0.72%p | -0.45%p | -1.02%p |
| speed | +23.87%p | +0.50%p | -33.22%p | +8.85%p |
| facilityDamage | -1.45%p | +1.29%p | +0.30%p | -0.14%p |
| citizenRisk | -0.23%p | +0.08%p | -0.24%p | +0.39%p |
| citizenMisunderstanding | +11.87%p | -5.44%p | +2.21%p | -8.65%p |

Speed는 timeout을 거의 제거하지만 오판을 늘린다. 시설·시민 보호는 성공률을 거의 유지하면서 각자의 보호 metric을 개선한다. 정확한 판단은 오판과 disabled를 줄여 성공률도 높였다.

## 7. Route 선택 경향

Route preference도 변했지만 모든 route를 단일한 “빠른 길/안전한 길” 축으로 설명할 수는 없었다. policy는 authored movement time뿐 아니라 같은 segment의 encounter와 action 결과까지 학습한다.

강한 0→3 변화:

- speed: `F4_SERVICE_ROUTE` +30%p, `F4_INNER_SECURITY_ROUTE` -30%p
- speed: `F2_DIRECT_OFFICE_ROUTE` +10%p, `F2_OUTER_CORRIDOR_ROUTE` -10%p
- facilityDamage: `LEFT_PUBLIC_ROUTE` +11%p, `RIGHT_SERVICE_ROUTE` -11%p
- citizenRisk: `RIGHT_SERVICE_ROUTE` +6%p, `LEFT_PUBLIC_ROUTE` -6%p
- citizenMisunderstanding: `F5_ROOM_R2` +7%p, `F5_ROOM_R1` -4%p
- goal: 가장 큰 route 변화도 약 2%p

F5 네 방의 authored movement time은 동일하므로, 방 선택 변화는 이동 거리보다는 학습된 encounter/segment credit 차이다.

## 8. 강한 interaction

가장 큰 interaction은 `speed × citizenMisunderstanding`이었다. 다른 세 항목을 평균하고 두 별을 0/3으로 비교했다.

| speed | misunderstanding | 성공 | Disabled | Timeout | 오판 | 시간 | SUBDUE | TRACK |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 0 | 19.16% | 29.01% | 27.06% | 24.77% | 513.84 | 27.79% | 21.66% |
| 0 | 3 | 18.39% | 30.24% | 35.77% | 15.60% | 584.04 | 26.85% | 20.75% |
| 3 | 0 | 32.04% | 39.29% | 0.05% | 28.63% | 353.04 | 58.38% | 14.87% |
| 3 | 3 | 50.22% | 26.89% | 0% | 22.89% | 404.59 | 47.21% | 25.10% |

둘을 함께 높였을 때 success difference-in-differences는 **+18.95%p**였다. Speed만 높인 공격성에서 정확한 판단 weight가 SUBDUE를 줄이고 TRACK을 늘리며 disabled를 완화했다.

다음 interaction들은 상대적으로 작았다.

- `speed × facilityDamage`: damage interaction -0.096, PUSH interaction -15.81%p
- `facilityDamage × citizenMisunderstanding`: damage interaction -0.098
- `speed × citizenRisk`: success interaction -2.70%p, FAST_PASS interaction -4.52%p
- goal이 포함된 interaction은 success 기준 대부분 ±1.5%p 이내

## 9. 데이터 기반 행동 archetype

16개 결과/행동 feature를 표준화하고 deterministic 5-cluster로 묶었다. 이름은 centroid의 실제 특징을 요약한 것이며 새로운 학습 모델은 아니다.

| 유형 | 조합 수 | 대표 tuple | 성공 | 시간 | 특징 |
|---|---:|---|---:|---:|---|
| 저속·타임아웃형 | 256 | `(2,0,2,2,3)` | 18.77% | 565.29 | speed=0 전체; timeout 33.24%, DETOUR/OBSERVE/RETREAT 많음 |
| 고속·공격/오판형 | 192 | `(2,2,1,2,0)` | 32.57% | 353.63 | misunderstanding=0; SUBDUE 58.76%, 오판 28.38% |
| 고속·시설희생형 | 146 | `(2,1,0,1,1)` | 47.97% | 398.93 | facilityDamage≈0; PUSH 74.84%, damage 0.472 |
| 보호·정확판단형 | 137 | `(2,1,2,1,2)` | 47.35% | 403.40 | damage 0.208, risk 0.253, 오판 18.63% |
| 고속 균형형 | 293 | `(0,3,2,1,2)` | 46.33% | 392.14 | timeout 거의 0, PUSH/CLEAR 혼합, risk 0.361 |

분리는 주로 `speed=0`, `misunderstanding=0`, `facilityDamage=0` 경계에서 강하게 나타났다. `goal`은 cluster 구분에 거의 기여하지 않았다.

## 10. 대표 별점 조합

Tuple 순서: `(goal, speed, facilityDamage, citizenRisk, citizenMisunderstanding)`.

| 조합 | 성공 | 시간 | Damage | Risk | 주요 특징 |
|---|---:|---:|---:|---:|---|
| `(0,0,0,0,0)` | 15.0% | 508.68 | 0.250 | 0.200 | 초기 균등 policy 유지, timeout 30% |
| `(1,1,1,1,1)` | 49.0% | 399.19 | 0.215 | 0.280 | `(2,2,2,2,2)`, `(3,3,3,3,3)`과 완전히 동일 |
| `(2,2,2,2,2)` | 49.0% | 399.19 | 0.215 | 0.280 | uniform scaling 불변 |
| `(3,3,3,3,3)` | 49.0% | 399.19 | 0.215 | 0.280 | uniform scaling 불변 |
| goal만 3 | 20.0% | 511.98 | 0.280 | 0.285 | all-zero 대비 개선 작음 |
| speed만 3 | 32.0% | 348.74 | 0.275 | 0.440 | SUBDUE 59.20%, PUSH 69.09%, timeout 0, 오판 29% |
| facility만 3 | 15.5% | 523.63 | 0.130 | 0.250 | PUSH 28.35%, DETOUR 34.25%, timeout 32% |
| risk만 3 | 20.0% | 497.64 | 0.300 | 0.085 | FAST_PASS 10.89%, timeout 27.5% |
| misunderstanding만 3 | 16.5% | 593.27 | 0.255 | 0.225 | 오판 15%, timeout 39% |
| 최고 성공 `(2,2,1,0,2)` | 52.5% | 416.71 | 0.335 | 0.425 | 빠르고 정확하지만 시설/시민 risk trade-off |
| 최저 성공 `(0,0,3,1,2)` | 14.5% | 579.05 | 0.155 | 0.105 | 보호적이지만 timeout 36% |
| 최단 시간 `(0,1,1,1,0)` | 30.5% | 341.01 | 0.160 | 0.225 | SUBDUE 60.54%, disabled 40%, 오판 29.5% |
| 시설 피해 최소 `(0,0,1,0,0)` | 15.5% | 523.63 | 0.130 | 0.250 | 낮은 PUSH, 높은 DETOUR |
| 시민 위험 최소 `(1,0,0,2,0)` | 21.0% | 495.75 | 0.330 | 0.075 | FAST_PASS 9.09% |
| 오판 최소 `(1,0,3,0,2)` | 18.5% | 576.41 | 0.145 | 0.260 | 오판 13.5%, timeout 35% |
| 보호 composite 최소 `(1,0,3,1,1)` | 18.5% | 578.23 | 0.160 | 0.100 | 오판 14%; 성공/시간을 희생 |

보호 composite는 damage/risk/misunderstanding을 각각 min-max 정규화해 동일 비중으로 평균한 진단용 값이다. production reward나 새로운 “최고 설정”이 아니다.

## 11. 사용자가 이 별점을 높이면 실제로 어떻게 달라지는가

| 높이는 항목 | 실제 관찰된 변화 |
|---|---|
| 임무 완수 | 성공률과 action 선택이 거의 달라지지 않는다. 현재 데이터로 “끝까지 목표를 더 추구한다”고 말하기 어렵다. |
| 빠르게 해결하기 | timeout과 시간이 크게 줄고 SUBDUE/PUSH/FAST_PASS가 늘어난다. 대신 damage, citizen risk, 오판이 증가한다. |
| 시설 보호 | PUSH를 줄이고 CLEAR/DETOUR를 늘려 실제 시설 피해를 크게 줄인다. 성공률 영향은 작다. |
| 시민 보호 | FAST_PASS를 줄이고 WAIT/SLOW_PASS/WIDE_DETOUR를 늘려 실제 citizen risk를 크게 줄인다. |
| 시민을 정확히 판단하기 | SUBDUE를 줄이고 OBSERVE/TRACK/BYPASS를 늘려 오판을 줄인다. 시간이 늘지만 평균 성공률도 높아진다. |

## 12. Ari가 데이터 근거로 말해도 되는 조언

| Dimension | 판정 | 안전하게 말할 수 있는 문장 |
|---|---|---|
| goal | **NOT_SUPPORTED** | 현재 데이터에서는 임무 완수 별을 높여도 성공 행동이 뚜렷하게 늘지 않았어. |
| speed | **SUPPORTED** | 빠르게 해결하기 별이 있으면 시간이 크게 줄고 더 빠르고 직접적인 행동을 고르는 경향이 있어. 대신 더 위험하거나 거친 결과가 늘 수 있어. |
| facilityDamage | **SUPPORTED** | 시설 보호 별이 많을수록 밀기보다 치우거나 돌아가는 행동이 늘고 실제 시설 피해가 줄었어. |
| citizenRisk | **SUPPORTED** | 시민 보호 별이 많을수록 빠르게 지나가기보다 기다리거나 멀리 돌아가서 시민 위험이 줄었어. |
| citizenMisunderstanding | **SUPPORTED** | 정확히 판단하기 별이 많을수록 바로 제압하기보다 살펴보고 지켜보는 행동이 늘어 오판이 줄었어. |

`speed`, `facilityDamage`, `citizenRisk`는 특히 0→1 효과가 크므로 “별이 하나라도 있으면”이라는 설명이 데이터에 더 가깝다. 별 1/2/3이 같은 간격으로 강해진다고 말하면 안 된다.

## 13. Reward 설계 평가

의도와 일치:

- speed → 더 빠른 행동, 낮은 time/timeout
- facilityDamage → 낮은 PUSH와 실제 damage
- citizenRisk → 낮은 FAST_PASS와 실제 risk
- citizenMisunderstanding → 낮은 SUBDUE/오판, 높은 관찰 행동
- 서로 충돌하는 항목 사이에 실제 trade-off와 interaction 존재

의도와 불일치하거나 약함:

- goal의 독립 효과가 거의 없음
- 별 1/2/3의 효과가 선형적이지 않고 대부분 첫 별에서 포화
- `(1,1,1,1,1)`, `(2,2,2,2,2)`, `(3,3,3,3,3)`이 완전히 동일함
- speed를 높이면 빠르지만 damage/risk/오판이 함께 증가함
- 일부 route 변화는 route의 authored movement time만으로 설명되지 않음

이는 tuning 요청이 아니라 측정 결과다. 수정이 필요하다면 별의 절대 크기가 실제로 다른 강도를 가져야 하는지와 goal credit이 action 간 차이를 만들도록 설계됐는지를 별도 검토해야 한다.

## 14. 산출물과 재실행

- Full JSON: `artifacts/reinforcement_weight_sweep.json`
- CSV: `artifacts/reinforcement_weight_sweep.csv`
- Script: `scripts/reinforcement/sweepRewardWeights.ts`

전체 sweep:

```powershell
node --experimental-strip-types scripts/reinforcement/sweepRewardWeights.ts --training-seeds=10 --evaluation-seeds=20
```

선택 tuple만:

```powershell
node --experimental-strip-types scripts/reinforcement/sweepRewardWeights.ts --weights=3,2,2,2,2 --training-seeds=10 --evaluation-seeds=20 --json=artifacts/selected.json --csv=artifacts/selected.csv
```

이번 작업은 Learning Engine, reward formula, learning rate, exploration, probabilities, action availability, map, UI, CSS, Ari, runtime presentation을 수정하지 않았다.
