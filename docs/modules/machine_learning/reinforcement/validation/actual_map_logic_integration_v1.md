# Actual Map Logic Integration v1 Validation

검증일: 2026-10-11  
실행: `5 Robots × 20 Rounds × 3 Seeds(7, 42, 1234)` / profile (`SAFE`, `FAST`)  
총량: profile별 300 episodes, 60 central updates; 전체 600 episodes, 120 updates

## 판정

`PASS_LOGIC_NEEDS_ENVIRONMENT_TUNING`

실제 TMJ 이동, encounter, 전이, F5 탐색/보스/복구 흐름, episode seed 재현성, 5-robot batch update는 모두 동작했다. SAFE/FAST의 손상·위험·행동 방향도 분리되었다. 다만 FAST의 성공률과 성공 episode 시간 개선이 seed 전반에서 안정적이지 않고 `ROBOT_DISABLED` 비율이 높으므로 Core 알고리즘 변경이 아닌 환경 수치 튜닝이 필요하다.

## Actual Map Input Summary

Spatial SoT는 `public/maps/reinforcement/floor_1_blockout.tmj` ~ `floor_5_blockout.tmj`, logical trait SoT는 `navigation/navigation_graph_v1_f5_v3.json`, numeric/action SoT는 `map_integration_v1.md`와 `learningEngine.ts`를 사용했다. Phaser/UI는 읽거나 실행하지 않는 pure headless adapter다.

| Floor | Nodes | Edges | Encounter zones | Transitions | Spawns |
|---:|---:|---:|---:|---:|---:|
| 1 | 10 | 10 | 4 | 2 | 1 |
| 2 | 8 | 9 | 4 | 1 | 2 |
| 3 | 7 | 6 | 6 | 2 | 1 |
| 4 | 8 | 9 | 4 | 1 | 2 |
| 5 | 15 | 21 | 4 | 0 | 1 |

## Route Context / State Key

| Context | Actual available route actions |
|---|---|
| `F1_ENTRY_SPLIT` | `LEFT_PUBLIC_ROUTE`, `RIGHT_SERVICE_ROUTE` |
| `F2_LEFT_APPROACH` | `F2_DIRECT_OFFICE_ROUTE`, `F2_OUTER_CORRIDOR_ROUTE` |
| `F2_RIGHT_APPROACH` | `F2_INNER_HALL_ROUTE`, `F2_SERVICE_DETOUR_ROUTE` |
| `F3_STAIR_SPLIT` | `F3_LEFT_MAINTENANCE_ROUTE`, `F3_RIGHT_PERIMETER_ROUTE` |
| `F4_LEFT_APPROACH` | `F4_SECURITY_HALL_ROUTE`, `F4_PERIMETER_DETOUR_ROUTE` |
| `F4_RIGHT_APPROACH` | `F4_INNER_SECURITY_ROUTE`, `F4_SERVICE_ROUTE` |
| F5 dynamic | `F5_ROOM_SEARCH[canonical remaining room set]`; initial `F5_ROOM_SEARCH[L1,L2,R1,R2]` |

F5 state에는 seeded Boss 위치를 넣지 않는다. 이미 탐색한 방은 후보에서 제거되며, room guard neutralization 전에는 room-entry edge를 소비하지 않는다. 성공 event 순서는 `BOSS_NEUTRALIZED → SECURITY_LOCK_OPEN → SYSTEM_RESTORED → GOAL_REACHED`다.

## Polyline Movement Time

각 TMJ polyline의 Euclidean pixel segment 합을 32로 나눴다. 본 모델에서는 `tile length = simulation movement time`이다.

| Floor | Pixel sum | Tile sum | Simulation time sum |
|---:|---:|---:|---:|
| 1 | 5,057.930101 | 158.060316 | 158.060316 |
| 2 | 6,969.729261 | 217.804039 | 217.804039 |
| 3 | 3,369.688820 | 105.302776 | 105.302776 |
| 4 | 6,969.729261 | 217.804039 | 217.804039 |
| 5 | 18,096.000000 | 565.500000 | 565.500000 |

- `longestSafeSuccessBaseline = 713.909160`
- `timeLimit = 713.909160 × 1.25 = 892.386451`
- F5 worst valid search는 no-Boss 3개 방 + 마지막 Boss 방 + security/control/goal chain을 포함한다.

## Aggregate Outcome

| Profile | Success | Goal | Timeout | Misunderstanding | Robot disabled | Avg success time | Avg elapsed | Facility damage | Citizen risk | Clamp hits |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| SAFE | 17.67% | 53 | 16 | 14 | 217 | 535.824896 | 383.445774 | 63 | 39 | 26 |
| FAST | 8.00% | 24 | 12 | 20 | 244 | 609.953678 | 326.137567 | 133 | 99 | 18 |

`Avg success time`은 세 seed별 성공 episode 평균의 평균이다. FAST의 전체 평균 elapsed가 짧은 것은 빠른 성공만을 뜻하지 않으며, 높은 조기 `ROBOT_DISABLED`도 포함한다.

### Seed stability

| Profile / seed | Success | Avg success time | Damage | Risk |
|---|---:|---:|---:|---:|
| SAFE / 7 | 18% | 533.891385 | 25 | 12 |
| SAFE / 42 | 19% | 575.029298 | 22 | 14 |
| SAFE / 1234 | 16% | 498.554005 | 16 | 13 |
| FAST / 7 | 9% | 661.414844 | 42 | 31 |
| FAST / 42 | 5% | 608.230550 | 46 | 34 |
| FAST / 1234 | 10% | 560.215641 | 45 | 34 |

안전 비용 방향은 세 seed에서 안정적이지만 FAST 성공 시간 우위는 안정적이지 않다.

## Encounter Trigger / Action Counts

Trigger는 zone 판정이 실제 발생한 방문 수다. Action은 BLOCKED/TRACK/guard persistence 등의 재시도를 포함한다.

| Profile | Obstacle triggers | Citizen triggers | Ambiguous triggers | Villain triggers |
|---|---:|---:|---:|---:|
| SAFE | 598 | 239 | 130 | 1,192 |
| FAST | 657 | 220 | 126 | 1,014 |

| State | Action | SAFE | FAST |
|---|---|---:|---:|
| Obstacle | DETOUR / CLEAR / PUSH | 179 / 244 / 186 | 96 / 109 / 476 |
| Citizen | WIDE_DETOUR / SLOW_PASS / WAIT / FAST_PASS | 56 / 72 / 75 / 36 | 30 / 35 / 41 / 114 |
| Ambiguous | OBSERVE / BYPASS / TRACK / SUBDUE | 69 / 41 / 39 / 18 | 53 / 35 / 32 / 37 |
| Villain | SUBDUE / FORCE_PASS / DISTRACT / BYPASS / RETREAT | 624 / 565 / 518 / 0 / 162 | 633 / 300 / 236 / 0 / 147 |
| Boss | SUBDUE / DISTRACT / RETREAT | 82 / 40 / 25 | 41 / 21 / 21 |

Actual villain zones의 `bypassAvailable=false`이므로 BYPASS 선택은 0이다.

## Route Choice Counts

| Route | SAFE | FAST |
|---|---:|---:|
| `LEFT_PUBLIC_ROUTE` | 158 | 145 |
| `RIGHT_SERVICE_ROUTE` | 142 | 155 |
| `F2_DIRECT_OFFICE_ROUTE` | 85 | 70 |
| `F2_OUTER_CORRIDOR_ROUTE` | 89 | 93 |
| `F2_INNER_HALL_ROUTE` | 86 | 93 |
| `F2_SERVICE_DETOUR_ROUTE` | 77 | 81 |
| `F3_LEFT_MAINTENANCE_ROUTE` | 107 | 119 |
| `F3_RIGHT_PERIMETER_ROUTE` | 159 | 115 |
| `F4_SECURITY_HALL_ROUTE` | 41 | 48 |
| `F4_PERIMETER_DETOUR_ROUTE` | 39 | 44 |
| `F4_INNER_SECURITY_ROUTE` | 74 | 49 |
| `F4_SERVICE_ROUTE` | 58 | 36 |
| `F5_ROOM_L1 / L2 / R1 / R2` | 95 / 95 / 108 / 98 | 68 / 76 / 76 / 72 |

## F5 Search

| Profile | Boss L1/L2/R1/R2 | Avg searched rooms, all episodes | Avg rooms to Boss, Boss reached |
|---|---|---:|---:|
| SAFE | 66 / 73 / 93 / 68 | 0.806667 | 2.208949 |
| FAST | 66 / 73 / 93 / 68 | 0.513333 | 2.350427 |

동일 episode seed 집합이므로 profile 간 Boss room 분포는 동일하다. 반복 방 선택은 0건이며, 모든 room entry 전에 해당 guard neutralization이 확인됐다.

## Final Mean Preference / Probability

아래 값은 3개 seed의 round-20 최종값 평균이며 probability는 `epsilon=0.10`을 포함한다.

### Actual routes

| Context / route | SAFE pref | SAFE p | FAST pref | FAST p |
|---|---:|---:|---:|---:|
| F1 left public | 0.169181 | 0.573008 | -0.036531 | 0.483590 |
| F1 right service | -0.169181 | 0.426992 | 0.036531 | 0.516410 |
| F2 left direct office | 0.050954 | 0.522907 | -0.010416 | 0.495411 |
| F2 left outer corridor | -0.050954 | 0.477093 | 0.010416 | 0.504589 |
| F2 right inner hall | 0.279073 | 0.621465 | 0.045416 | 0.520418 |
| F2 right service detour | -0.279073 | 0.378535 | -0.045416 | 0.479582 |
| F3 left maintenance | -0.363351 | 0.344277 | -0.040524 | 0.481810 |
| F3 right perimeter | 0.363351 | 0.655723 | 0.040524 | 0.518190 |
| F4 left security hall | 0.078342 | 0.535080 | -0.007862 | 0.496460 |
| F4 left perimeter detour | -0.078342 | 0.464920 | 0.007862 | 0.503540 |
| F4 right inner security | 0.245321 | 0.606531 | -0.045347 | 0.479693 |
| F4 right service | -0.245321 | 0.393469 | 0.045347 | 0.520307 |
| F5 L1 | 0.031254 | 0.257712 | 0.014796 | 0.251353 |
| F5 L2 | -0.020719 | 0.245973 | -0.000737 | 0.247987 |
| F5 R1 | -0.018490 | 0.246480 | 0.037195 | 0.256939 |
| F5 R2 | -0.003698 | 0.249835 | -0.019481 | 0.243720 |

### Encounter actions

| State / action | SAFE pref | SAFE p | FAST pref | FAST p |
|---|---:|---:|---:|---:|
| Obstacle DETOUR | 1.793774 | 0.307989 | -2.000000 | 0.048967 |
| Obstacle CLEAR | 2.000000 | 0.367821 | -1.327463 | 0.064131 |
| Obstacle PUSH | 1.850316 | 0.324190 | 2.000000 | 0.886902 |
| Citizen WIDE_DETOUR | 0.747140 | 0.192134 | -2.000000 | 0.048015 |
| Citizen SLOW_PASS | 1.117031 | 0.280202 | -1.752392 | 0.054416 |
| Citizen WAIT | 1.705231 | 0.462444 | -1.743198 | 0.056199 |
| Citizen FAST_PASS | -0.671689 | 0.065221 | 1.573914 | 0.841370 |
| Ambiguous OBSERVE | 2.000000 | 0.407343 | 0.833275 | 0.306576 |
| Ambiguous BYPASS | 1.690116 | 0.320875 | 0.660711 | 0.276377 |
| Ambiguous TRACK | 1.178389 | 0.200189 | 0.059368 | 0.151336 |
| Ambiguous SUBDUE | -0.109825 | 0.071593 | 0.658501 | 0.265712 |
| Villain SUBDUE | 2.000000 | 0.305384 | 2.000000 | 0.622892 |
| Villain FORCE_PASS | 2.000000 | 0.305384 | 0.682374 | 0.184607 |
| Villain DISTRACT | 2.000000 | 0.305384 | -0.726134 | 0.059866 |
| Villain RETREAT | -2.000000 | 0.025227 | -2.000000 | 0.031042 |
| Boss SUBDUE | 2.000000 | 0.522708 | 1.857882 | 0.744335 |
| Boss DISTRACT | 1.757518 | 0.419603 | 0.217057 | 0.171129 |
| Boss RETREAT | -1.006205 | 0.057689 | -0.791117 | 0.084536 |

Villain probability 표의 BYPASS는 canonical full-pool 참고값이며 actual selection 전에 제거된다. Actual count는 0이다.

## Stability / Tuning Interpretation

- SAFE는 FAST보다 시설 손상 52.6%, 시민 위험 60.6% 적다.
- FAST는 PUSH 476회, FAST_PASS 114회로 SAFE의 186회, 36회보다 공격적이다.
- 이 행동 방향은 의도와 일치한다.
- 반면 FAST 성공률은 8.0%로 SAFE 17.67%보다 낮고, seed 평균 성공 시간도 더 길다.
- 전체 terminal의 대부분이 `ROBOT_DISABLED`다. 특히 필수 guard/Boss SUBDUE 실패 누적이 성공률을 지배한다.
- preference clamp hit는 SAFE 26, FAST 18이다. 학습이 완전히 붕괴하지는 않았지만 여러 안전 행동이 동시에 +2에 닿아 분별력이 줄었다.
- 따라서 `subdue success`, mandatory guard 밀도/배치, action cost, timeLimit 영향은 다음 단계에서 environment tuning 후보로 다룬다. 이번 변경에서는 Core 학습률, reward weight, success probability를 조정하지 않았다.

## Reproducibility / Tests

- 같은 seed/profile의 full run deep equality: PASS
- 다른 seed의 terminal distribution 차이: PASS
- 5 robots same immutable snapshot: PASS
- round당 central update 1회: PASS
- 100 episodes / 20 updates per seed/profile: PASS
- F5 hidden Boss, no repeated searched room, guard gate, post-Boss event order: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS; 기존 large-chunk warning만 발생
- `tests/actualMapIntegration.test.ts`: 4/4 PASS
- full `npm test`: 164/165 PASS; 유일한 실패는 기존 `reinforcementFloor4Debug.test.ts`가 Floor 4 manual tileset을 빈 배열로 기대하지만 현재 map에 16 assets가 있는 기존 fixture 불일치다. Actual Map Integration과 무관하며 본 작업에서 map/visual을 수정하지 않았다.

## Canonical graph resolution

Floor 5 v3 contract와 일치하는 `navigation_graph_v1_f5_v3.json`을 canonical logical graph SoT로 확정하고 active 문서와 도구의 기본 경로를 동기화했다. Geometry나 TMJ를 수정하지 않았다.

최종 판정: `PASS_LOGIC_NEEDS_ENVIRONMENT_TUNING`
