# SUBDUE Recovery Validation — 2026-10-15

## 적용 계약

- Reward + Failure Model v3의 별 배분, 보상식, 전역 combat skill 학습은 유지했다.
- 피해량: DISTRACT 성공/실패 0.01/0.05, FORCE_PASS 성공/실패 0.15/0.25, SUBDUE 성공/실패 0.01/0.40.
- SUBDUE 실패는 논리 시간 +5초, combat experience 0.6, 동일 조우 재시도다. 누적 피해가 1 이상일 때만 ROBOT_DISABLED가 된다.
- 조우 내 재시도 보너스는 후보 비교 후 실패당 +0.025, 최대 +0.05를 선택했으며 새 조우·퇴각에서 초기화된다. 전역 skill은 라운드 종료 때 한 번만 갱신된다.
- 고정 비용은 Robot Damage 0.8, ROBOT_DISABLED 2.5로 유지했다.

## 실험 설계

- 유효 별 배분 10개 전부, profile당 학습 seed 10개, 20 rounds × 5 robots.
- R1/R5/R10/R15/R20마다 학습 seed별 고정 평가 seed 20개, 즉 profile/checkpoint당 200 episodes.
- 기존 Reward + Failure v3 기본 profile 결과와 동일 checkpoint끼리 비교했다.

## 기본 profile 2/2/2 — 기존 대비

| Checkpoint | Goal | ROBOT_DISABLED | Objective | 평균 시간 |
|---|---:|---:|---:|---:|
| R1 | 5.0% → 5.0% (0.0%p) | 60.5% → 36.0% (-24.5%p) | -3.126 → -2.595 | 366.2 → 576.9 |
| R5 | 7.5% → 10.5% (3.0%p) | 63.5% → 53.0% (-10.5%p) | -2.812 → -2.377 | 348.3 → 533.6 |
| R10 | 8.5% → 39.5% (31.0%p) | 74.5% → 38.5% (-36.0%p) | -2.791 → -0.392 | 337.5 → 532.1 |
| R15 | 22.5% → 72.0% (49.5%p) | 63.5% → 15.5% (-48.0%p) | -1.697 → 1.666 | 348.4 → 532.2 |
| R20 | 28.5% → 84.0% (55.5%p) | 57.0% → 5.0% (-52.0%p) | -1.067 → 2.673 | 360.9 → 483.9 |

## 회복 지표

| Checkpoint | SUBDUE/episode | attempts/encounter | first success | retry success | avg retry bonus | recovery→neutralize | defeat→episode success |
|---|---:|---:|---:|---:|---:|---:|---:|
| R1 | 2.81 | 1.16 | 64.0% | 73.4% | 0.025 | 33.3% | 1.6% |
| R5 | 3.96 | 1.18 | 63.6% | 69.6% | 0.027 | 32.0% | 6.8% |
| R10 | 5.44 | 1.18 | 73.5% | 92.9% | 0.028 | 53.5% | 36.0% |
| R15 | 6.36 | 1.16 | 79.7% | 97.1% | 0.026 | 74.7% | 74.3% |
| R20 | 6.13 | 1.11 | 88.7% | 92.2% | 0.027 | 86.3% | 89.0% |

- R20 실패 단계: first 124, second 9, third/terminal 10.
- R20 누적 피해 disabled 10, combat disabled 10, terminal damage 평균 1.000.
- R20 damage distribution: {"zero":21,"low":88,"medium":47,"high":34,"disabled":10}.

## R20 적 유형별

| Enemy | encounters | attempts | first success | retry success | final neutralization | disabled caused |
|---|---:|---:|---:|---:|---:|---:|
| VILLAIN_1 | 0 | 0 | 0.0% | 0.0% | 0 | 0 |
| VILLAIN_2 | 549 | 537 | 89.2% | 100.0% | 484 | 0 |
| F5_GUARD | 453 | 445 | 97.0% | 100.0% | 432 | 1 |
| BOSS | 181 | 244 | 67.2% | 84.5% | 168 | 9 |

## 모든 별 배분

| speed-judgment-threat | R1 Goal | R20 Goal | R1 Disabled | R20 Disabled | R1 Objective | R20 Objective |
|---|---:|---:|---:|---:|---:|---:|
| 0-3-3 | 5.0% | 91.5% | 36.0% | 5.0% | -0.394 | 7.029 |
| 1-2-3 | 5.0% | 89.5% | 36.0% | 6.5% | -0.684 | 6.039 |
| 1-3-2 | 5.0% | 96.0% | 35.5% | 3.0% | -2.157 | 4.217 |
| 2-1-3 | 5.0% | 77.0% | 36.0% | 1.5% | -1.313 | 4.456 |
| 2-2-2 | 5.0% | 84.0% | 36.0% | 5.0% | -2.595 | 2.673 |
| 2-3-1 | 6.0% | 91.0% | 35.0% | 5.0% | -3.658 | 1.560 |
| 3-0-3 | 5.0% | 65.5% | 36.5% | 9.5% | -2.668 | 2.828 |
| 3-1-2 | 5.0% | 63.0% | 36.0% | 11.0% | -3.835 | 0.621 |
| 3-2-1 | 5.0% | 72.5% | 36.0% | 4.5% | -4.718 | -0.608 |
| 3-3-0 | 10.0% | 22.0% | 36.0% | 11.0% | -5.330 | -4.717 |

## 판정 및 권고

- 최초 기본 +0.05 / cap 0.10 평가: **TOO_STRONG**. 선택값 평가는 **BALANCED**.
- 권고: step 0.025, cap 0.05. The initial 0.05/0.10 default crossed the strong threshold; 0.025/0.05 reduces retry saturation while preserving recovery viability.
- 후보 비교: 0.025/0.05 (R20 Goal 84.0%, Disabled 5.0%, Retry 92.2%); 0.05/0.1 (R20 Goal 90.0%, Disabled 0.5%, Retry 100.0%); 0.075/0.15 (R20 Goal 90.0%, Disabled 0.5%, Retry 100.0%).
