# Reinforcement Training 결과 Audit (2026-10-15)

## 결론

최종 분류: **A. NORMAL_VARIANCE**

기본 UI 설정과 seed 42에서는 Round 4의 로봇 5대가 모두 `ROBOT_DISABLED`가 되는 현상이 headless simulation에서도 그대로 재현됐다. 그러나 동일 설정을 deterministic seed 1~20에서 반복한 결과 Round별 평균 성공률은 `23% → 25% → 29% → 33% → 32%`였다. 후반 Round의 체계적인 성공률 저하는 없었다.

seed 42의 Round 4 실패 5건은 모두 `SUBDUE`의 확률적 실패로 발생했다. 학습에 따라 `SUBDUE` 선택 확률이 높아져 실패 유형이 timeout에서 disabled 쪽으로 이동하는 경향은 있지만, 20-seed 평균 전체 성공률은 개선됐다. 따라서 관찰된 “후반이 더 나빠 보임”의 직접 원인은 5대뿐인 단일 Round의 큰 표본 변동이다.

## 재현 조건과 한계

- Reward dimension: `goal`, `speed`, `facilityDamage`, `citizenRisk`, `citizenMisunderstanding`
- 각 값의 허용 범위: 정수 0~3
- UI 기본값: `(3, 2, 2, 2, 2)`
- 단일 재현 seed: `42`
- 반복 비교 seed: `1..20`
- 각 실행: 5 Rounds × 5 Robots

현재 UI 선택값은 React 메모리에만 있고 local/session storage나 Training History 파일로 저장되지 않는다. 따라서 종료·새로고침 뒤에는 사용자의 과거 선택값을 복원할 수 없다. 이 audit은 live 선택값을 확인할 수 없는 상태에서 코드상 기본값 `(3,2,2,2,2)`와 기본 seed `42`를 현재 조건으로 사용했다. 다른 실제 선택값이었다면 아래 utility의 `--weights`와 `--seed`로 다시 실행해야 한다.

## seed 42 원시 결과

| Round | Robot 1 | Robot 2 | Robot 3 | Robot 4 | Robot 5 | Success | Disabled | Timeout | Misunderstanding | 평균 logical time | Damage | Risk |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | TIMEOUT, 892.386 | DISABLED, 726.582 | TIMEOUT, 892.386 | MISUNDERSTANDING, 354.140 | SUCCESS, 577.909 | 1/5 | 1 | 2 | 1 | 688.681 | 1 | 0 |
| 2 | DISABLED, 367.138 | SUCCESS, 687.976 | TIMEOUT, 892.386 | DISABLED, 763.343 | MISUNDERSTANDING, 606.497 | 1/5 | 2 | 1 | 1 | 663.468 | 0 | 5 |
| 3 | TIMEOUT, 892.386 | SUCCESS, 848.886 | SUCCESS, 885.263 | DISABLED, 590.736 | SUCCESS, 613.571 | 3/5 | 1 | 1 | 0 | 766.169 | 4 | 2 |
| 4 | DISABLED, 430.606 | DISABLED, 620.673 | DISABLED, 632.051 | DISABLED, 175.862 | DISABLED, 415.673 | 0/5 | 5 | 0 | 0 | 454.973 | 2 | 1 |
| 5 | DISABLED, 271.169 | SUCCESS, 817.028 | MISUNDERSTANDING, 466.726 | DISABLED, 466.673 | TIMEOUT, 892.386 | 1/5 | 2 | 1 | 1 | 582.797 | 0 | 3 |

Round 4의 terminal 위치와 원인:

- Robot 1: `F5_R1_GUARD_ZONE`, `SUBDUE`
- Robot 2: Boss room `R2`, `SUBDUE`
- Robot 3: `F5_R1_GUARD_ZONE`, `SUBDUE`
- Robot 4: `F3_RIGHT_GUARD_ZONE`, `SUBDUE`
- Robot 5: `F5_L2_GUARD_ZONE`, `SUBDUE`

즉 presentation이 disabled처럼 보이게 만든 것이 아니라, 실제 episode terminal result 다섯 개가 모두 `ROBOT_DISABLED`였다.

## seed 42 주요 action count

| Round | SUBDUE | DISTRACT | FORCE_PASS | RETREAT | PUSH | CLEAR | DETOUR | TRACK |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 12 | 13 | 13 | 15 | 4 | 5 | 9 | 1 |
| 2 | 20 | 13 | 15 | 10 | 2 | 3 | 2 | 3 |
| 3 | 23 | 21 | 13 | 13 | 11 | 6 | 4 | 0 |
| 4 | 15 | 19 | 12 | 5 | 5 | 0 | 3 | 0 |
| 5 | 9 | 7 | 8 | 12 | 2 | 8 | 4 | 3 |

단순 count는 episode가 일찍 종료되면 함께 작아지므로 선택 성향과 완전히 같지는 않다. 20-seed 기준 episode당 평균에서는 `SUBDUE 2.76 → 3.18`, `RETREAT 2.20 → 1.28`, `DETOUR 0.81 → 0.48`로 변했다.

## 현재 설정의 20-seed 평균

각 Round는 100 episodes(20 seeds × 5 robots)다.

| Round | 성공률 | seed별 표준편차 | seed별 min~max | Disabled | Timeout | Misunderstanding | 평균 logical time | Damage/episode | Risk/episode |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 23% | 17.06%p | 0~60% | 44% | 22% | 11% | 573.373 | 0.24 | 0.16 |
| 2 | 25% | 17.75%p | 0~60% | 40% | 23% | 12% | 557.418 | 0.18 | 0.11 |
| 3 | 29% | 11.79%p | 0~40% | 38% | 19% | 14% | 538.883 | 0.23 | 0.15 |
| 4 | 33% | 15.84%p | 0~60% | 42% | 21% | 4% | 568.657 | 0.17 | 0.19 |
| 5 | 32% | 19.39%p | 0~80% | 49% | 11% | 8% | 504.133 | 0.34 | 0.06 |

Round 5 성공률은 Round 4보다 1%p 낮지만 표준편차 19.39%p에 비해 매우 작다. Round 1 대비 Round 5는 +9%p이고, timeout은 22%에서 11%로 줄었다. disabled는 44%에서 49%로 늘어 실패 유형의 trade-off가 있으나 전체 성공률 저하는 아니다.

## Reward profile 비교

모든 profile은 동일한 seed 1~20을 사용했다. 성공률은 Round 1→5 순서다.

| Profile | Weights `(goal,speed,damage,risk,misunderstanding)` | R1 | R2 | R3 | R4 | R5 | R1→R5 주요 변화 |
|---|---|---:|---:|---:|---:|---:|---|
| Current/default | 3,2,2,2,2 | 23% | 25% | 29% | 33% | 32% | time 573→504, risk 0.16→0.06, damage 0.24→0.34 |
| Balanced | 2,2,2,2,2 | 23% | 25% | 28% | 33% | 32% | time 573→508, risk 0.16→0.06 |
| All max | 3,3,3,3,3 | 23% | 25% | 28% | 33% | 32% | Balanced와 동일 |
| Goal focus | 3,0,0,0,0 | 23% | 19% | 23% | 20% | 19% | timeout 22%→37%, retreat 2.20→2.55 |
| Speed focus | 0,3,0,0,0 | 23% | 23% | 23% | 35% | 24% | time 573→496, disabled 44%→59%, SUBDUE 2.76→3.34 |
| Facility focus | 0,0,3,0,0 | 23% | 19% | 22% | 20% | 23% | damage 0.24→0.22, time 573→598 |
| Citizen risk focus | 0,0,0,3,0 | 23% | 19% | 23% | 17% | 20% | risk 0.16→0.03, time 573→608 |
| Misunderstanding focus | 0,0,0,0,3 | 23% | 19% | 26% | 18% | 21% | misunderstanding 11%→8%, time 573→598 |
| All zero | 0,0,0,0,0 | 23% | 19% | 24% | 18% | 20% | policy credit가 0이라 의미 있는 학습 없음 |

Balanced와 All max가 같은 결과인 것은 현재 reward 계산이 절대 크기보다 weight 비율에 의해 결정되기 때문이다. 모든 축을 같은 배수로 키워도 normalized reward와 local weighted mean이 같아진다. 이는 이번 현상의 원인은 아니지만, UI 별점의 절대 단계가 별도 의미를 가져야 한다면 reward 설계 검토 대상이다.

## Policy snapshot 및 orchestration

검증 결과:

- 각 Round의 5 episodes는 동일한 `policySnapshotBefore` signature를 사용했다.
- episode 생성 중 central policy는 변하지 않았다.
- 각 Round의 headless update는 정확히 1회였다.
- Round N+1의 snapshot은 Round N의 `policySnapshotAfter`와 deep-equal이었다.
- 5 Rounds, 25 robot results, 5 committed updates만 Training History에 기록됐다.
- 중복 terminal observation은 두 번째 commit을 만들지 않았다.
- runtime controller의 history episodes/snapshots는 직접 실행한 headless run과 deep-equal이었다.

구조상 `TrainingRuntimeController` 생성 시 headless 5-round run 전체를 먼저 계산하고 UI는 그 결과를 재생한다. 계산 내부 순서는 `snapshot → 5 episodes → one update`로 정상이며, UI History commit은 다섯 terminal command가 관찰된 뒤에만 수행된다. 따라서 stale/reset/double-update 결과 오류는 없지만, wall-clock 관점에서 policy 계산 자체는 화면 재생보다 먼저 끝나 있다는 점은 설계 특성이다.

seed 42에서 villain `SUBDUE` 선택 확률은 Round 1의 20%에서 Round 4의 27%, Round 5의 30%로 증가했다. Boss `SUBDUE`는 33%→47%→51%로 증가했다. 반대로 villain `RETREAT`는 20%→12%→10%로 줄었다. Round 4에서는 이렇게 높아진 `SUBDUE` 성향과 다섯 episode의 실패 roll이 겹쳤다.

## UI aggregation 검증

- success 정의는 `terminalReason === 'GOAL_REACHED'`로 일관된다.
- Round 결과는 현재 controller의 정확히 5 robots를 집계한다.
- Final Result는 `history.rounds[0]`과 `history.rounds.at(-1)`을 사용한다.
- history round index는 1~5 순서이며 중복/혼입이 없었다.
- seed 42의 UI success count와 headless `goalReached` count는 전 Round에서 일치했다.

`UI_AGGREGATION_BUG` 증거는 발견되지 않았다.

## 수정 제안

이번 관찰 현상을 고치기 위한 production 수정이나 parameter tuning은 필요하지 않다. 다만 진단 가능성을 높이려면 별도 승인 후 다음만 검토할 수 있다.

1. 사용자가 선택한 weights와 seed를 session 결과와 함께 영속화해 동일 run을 정확히 재현한다.
2. UI에서 5대 단일 Round 비교가 통계적 추세처럼 읽히지 않도록, 내부 QA에서는 여러 seed aggregate를 병행한다.
3. 별점의 절대 크기에 의미를 기대한다면 uniform scaling이 현재 무효인 reward normalization 설계를 별도 검토한다.

## 재실행

```powershell
node --experimental-strip-types scripts/reinforcement/auditTraining.ts --weights=3,2,2,2,2 --seed=42 --seeds=20
```

JSON 저장:

```powershell
node --experimental-strip-types scripts/reinforcement/auditTraining.ts --weights=3,2,2,2,2 --seed=42 --seeds=20 --out=artifacts/reinforcement_training_audit.json
```

검증 당시 `npm run typecheck`와 전체 `npm test` 231개가 모두 통과했다.
