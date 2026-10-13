# Actual Map Environment Tuning v1

> 후속 상태: `SET_D`가 사용자 승인 후 Production Environment v1로 반영됐으며, 결과는 `actual_map_environment_confirmation_v1.md`에서 확인한다. 이 문서는 sweep 당시의 후보 비교 이력이다.

검증일: 2026-10-11  
방식: pure headless, `5 Robots × 20 Rounds × 5 Seeds(7, 42, 1234, 2025, 9001)`  
총량: 4 Sets × 2 Profiles × 500 Episodes = 4,000 Episodes / 800 central updates

## 결론

`RECOMMENDED_SET = SET_D`

SET_D는 성공을 100%로 만들지 않으면서 SAFE 41%, FAST 35%의 성공 표본과 충분한 F5/Boss 표본을 확보했다. SAFE/FAST 안전 행동 방향은 유지됐고, FAST successful-time 우위는 aggregate 및 5개 seed 중 4개에서 성립했다. production numeric Source of Truth에는 반영하지 않았으며 사용자 승인 전까지 후보값이다.

최종 판정: `READY_FOR_USER_TUNING_DECISION`

## 1. Canonical Graph Resolution

- canonical logical graph: `navigation/navigation_graph_v1_f5_v3.json`
- active 문서, validator, blockout generator 기본 경로를 해당 이름으로 동기화했다.
- graph logic/Node/Edge/Context 및 TMJ geometry는 변경하지 않았다.
- validator: 43 nodes, 49 edges, 6 vertical connections, 21 concrete route contexts PASS.
- actual adapter의 `contractIssues=[]`; 기존 filename `MAP_CONTRACT_ISSUE`는 제거됐다.

## 2. Fixed Core / Sweep Parameters

아래 값은 전 Set에서 고정했다.

- learning rate `0.35`
- episode/direct credit `0.35 / 0.65`
- preference clamp `[-2,+2]`
- exploration schedule, reward weights, route relative advantage/re-centering
- `timeLimit=892.386451`
- damage/risk normalization denominator `3`
- obstacle/citizen/ambiguous/TRACK 규칙

| Set | Villain x1 SUBDUE | Villain x2 SUBDUE | Boss base | Boss distracted | Villain DISTRACT |
|---|---:|---:|---:|---:|---:|
| SET_A | 0.80 | 0.60 | 0.60 | 0.85 | 0.90 |
| SET_B | 0.85 | 0.70 | 0.70 | 0.90 | 0.95 |
| SET_C | 0.90 | 0.75 | 0.75 | 0.95 | 0.95 |
| SET_D | 0.90 | 0.80 | 0.80 | 0.95 | 1.00 |

SET_A는 production baseline을 명시적으로 주입한 재실행이다. 기본값 생략 실행과 explicit SET_A 실행의 full result deep equality를 테스트했다.

## 3. Set Comparison

각 행은 500 Episodes다.

| Set | Profile | Goal | Disabled | Timeout | Misunderstanding | Avg time | Success avg | Success median | Damage | Risk | F5 reach | Boss found | Boss neutralized |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | SAFE | 17.0% | 366 | 24 | 25 | 381.997 | 553.771 | 509.558 | 103 | 65 | 261 | 133 | 91 |
| A | FAST | 9.4% | 400 | 18 | 35 | 330.064 | 594.162 | 576.160 | 220 | 163 | 185 | 80 | 52 |
| B | SAFE | 27.2% | 310 | 26 | 28 | 429.546 | 586.980 | 587.006 | 97 | 66 | 311 | 193 | 142 |
| B | FAST | 19.0% | 343 | 23 | 39 | 379.900 | 594.599 | 584.335 | 227 | 163 | 244 | 139 | 99 |
| C | SAFE | 37.0% | 258 | 31 | 26 | 460.232 | 591.279 | 587.583 | 101 | 66 | 331 | 246 | 191 |
| C | FAST | 32.0% | 280 | 23 | 37 | 428.890 | 586.631 | 579.518 | 221 | 170 | 297 | 213 | 165 |
| D | SAFE | 41.0% | 231 | 37 | 27 | 486.191 | 606.058 | 600.673 | 105 | 66 | 358 | 265 | 215 |
| D | FAST | 35.0% | 253 | 31 | 41 | 455.293 | 587.613 | 583.516 | 235 | 174 | 332 | 225 | 184 |

### Diagnosis

| Set | Diagnosis | Reason |
|---|---|---|
| SET_A | `TOO_LETHAL`, `TIME_DIRECTION_UNSTABLE` | Disabled 73.2%/80.0%, FAST success time이 SAFE보다 느림 |
| SET_B | `TOO_LETHAL`, `TIME_DIRECTION_UNSTABLE` | 개선됐지만 FAST disabled 68.6%, success average 방향 불일치 |
| SET_C | `GOOD` | 성공/F5 표본 충분, aggregate FAST time 우위, seed 방향 3/5 |
| SET_D | `GOOD`, `RECOMMENDED_SET` | 실패가 충분히 남고, 최대 F5/Boss 표본, FAST time 방향 4/5 |

`TOO_EASY`와 `PROFILE_COLLAPSE`로 판정된 Set은 없다.

## 4. Baseline Failure Decomposition — SET_A

### Terminal outcome

| Profile | Goal | Timeout | Misunderstanding | Robot disabled |
|---|---:|---:|---:|---:|
| SAFE | 85 | 24 | 25 | 366 |
| FAST | 47 | 18 | 35 | 400 |

모든 `ROBOT_DISABLED`의 terminal action은 `SUBDUE`였다.

### Death source

| Source | SAFE | FAST | Total |
|---|---:|---:|---:|
| `F2_CENTER_GUARD_ZONE` | 94 | 123 | 217 |
| `F3_LEFT_GUARD_ZONE` | 31 | 44 | 75 |
| `F3_RIGHT_GUARD_ZONE` | 39 | 44 | 83 |
| `F4_CENTER_GUARD_ZONE` | 50 | 69 | 119 |
| `F5_L1_GUARD_ZONE` | 25 | 20 | 45 |
| `F5_L2_GUARD_ZONE` | 31 | 26 | 57 |
| `F5_R1_GUARD_ZONE` | 28 | 22 | 50 |
| `F5_R2_GUARD_ZONE` | 33 | 28 | 61 |
| Boss | 35 | 24 | 59 |

주요 단일 사망원은 F2 mandatory x2 center guard다. 전체적으로 x2 guard의 SUBDUE 실패가 SAFE 214, FAST 280으로 가장 큰 누적 원인이다.

## 5. Baseline Villain Diagnostic

`success/failure`은 SUBDUE와 DISTRACT, `pass/blocked/mobility`는 FORCE_PASS 결과다.

| Count/Profile | SUBDUE attempts (success/fail) | FORCE_PASS attempts (pass/blocked/mobility) | DISTRACT attempts (success/fail) | RETREAT |
|---|---:|---:|---:|---:|
| x1 SAFE | 516 (399/117) | 463 (310/94/59) | 437 (394/43) | 138 |
| x1 FAST | 369 (273/96) | 209 (147/40/22) | 170 (154/16) | 121 |
| x2 SAFE | 518 (304/214) | 437 (214/133/90) | 405 (367/38) | 141 |
| x2 FAST | 685 (405/280) | 305 (151/91/63) | 211 (190/21) | 129 |

FAST는 학습 후 x2 SUBDUE 쪽으로 더 강하게 기울며 baseline의 낮은 0.60 성공률과 결합해 조기 종료가 증가한다.

## 6. F5 Diagnostic / Survival Funnel

### SET_A detailed F5

| Profile | F5 reached | Avg searched rooms | Avg rooms before Boss | Room guard actions | Room guard disabled | Boss found | Boss SUBDUE | Boss DISTRACT | Boss disabled | Boss neutralized | Control room | Goal |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| SAFE | 261 | 0.798 | 1.301 | 1,554 | 117 | 133 | 126 | 61 | 35 | 91 | 85 | 85 |
| FAST | 185 | 0.546 | 1.313 | 869 | 96 | 80 | 76 | 31 | 24 | 52 | 48 | 47 |

### All-set funnel

| Set/Profile | Start | F2 pass | F3 pass | F4 pass / F5 | Boss found | Boss neutralized | Goal |
|---|---:|---:|---:|---:|---:|---:|---:|
| A SAFE | 500 | 392 | 322 | 261 | 133 | 91 | 85 |
| A FAST | 500 | 356 | 268 | 185 | 80 | 52 | 47 |
| B SAFE | 500 | 420 | 366 | 311 | 193 | 142 | 136 |
| B FAST | 500 | 395 | 320 | 244 | 139 | 99 | 95 |
| C SAFE | 500 | 431 | 377 | 331 | 246 | 191 | 185 |
| C FAST | 500 | 415 | 359 | 297 | 213 | 165 | 160 |
| D SAFE | 500 | 438 | 397 | 358 | 265 | 215 | 205 |
| D FAST | 500 | 428 | 387 | 332 | 225 | 184 | 175 |

SET_D는 profile별 225~265 Boss encounters를 제공해 Boss learning data가 충분하고, 여전히 59~65% Episode는 실패한다.

## 7. Round Progression

Action 열 순서: `PUSH/CLEAR/FAST_PASS/FORCE_PASS/SUBDUE/DISTRACT`. Route 열은 `F1 L/R ; F3 L/R ; F5 total`이다. 각 bucket은 5 seeds × 5 rounds × 5 robots = 125 Episodes다.

| Set/Profile | Rounds | Success | Disabled | Misunderstanding | Avg time | Actions | Route summary |
|---|---|---:|---:|---:|---:|---|---|
| A SAFE | 1-5 | 10.4% | 71.2% | 5.6% | 453.305 | 100/83/33/202/258/255 | 68/57;54/76;201 |
| A SAFE | 6-10 | 15.2% | 74.4% | 7.2% | 387.282 | 93/102/8/253/316/196 | 59/66;54/58;174 |
| A SAFE | 11-15 | 21.6% | 71.2% | 5.6% | 340.893 | 70/107/13/222/299/201 | 64/61;39/54;142 |
| A SAFE | 16-20 | 20.8% | 76.0% | 1.6% | 346.506 | 71/101/7/223/287/251 | 62/63;34/69;144 |
| A FAST | 1-5 | 7.2% | 76.0% | 4.8% | 449.531 | 127/77/36/200/268/226 | 68/57;55/73;204 |
| A FAST | 6-10 | 11.2% | 79.2% | 7.2% | 342.122 | 187/51/39/143/298/102 | 58/67;55/46;135 |
| A FAST | 11-15 | 9.6% | 81.6% | 8.8% | 270.293 | 216/38/56/90/289/51 | 60/65;50/34;86 |
| A FAST | 16-20 | 9.6% | 83.2% | 7.2% | 258.308 | 266/24/56/81/275/33 | 46/79;46/37;72 |
| B SAFE | 1-5 | 20.8% | 59.2% | 6.4% | 500.054 | 103/94/33/223/303/286 | 68/57;60/76;238 |
| B SAFE | 6-10 | 25.6% | 61.6% | 8.8% | 431.174 | 94/99/9/280/359/238 | 62/63;56/65;208 |
| B SAFE | 11-15 | 32.0% | 60.0% | 5.6% | 402.208 | 68/109/11/301/374/307 | 68/57;41/65;202 |
| B SAFE | 16-20 | 30.4% | 67.2% | 1.6% | 384.747 | 61/94/7/266/335/289 | 62/63;27/81;180 |
| B FAST | 1-5 | 17.6% | 61.6% | 5.6% | 509.088 | 128/83/36/235/316/266 | 68/57;57/77;259 |
| B FAST | 6-10 | 16.0% | 69.6% | 11.2% | 375.606 | 190/61/38/165/345/107 | 58/67;59/54;158 |
| B FAST | 11-15 | 17.6% | 75.2% | 7.2% | 308.673 | 228/41/57/123/338/63 | 60/65;54/40;122 |
| B FAST | 16-20 | 24.8% | 68.0% | 7.2% | 326.235 | 283/31/57/154/356/61 | 47/78;51/46;132 |
| C SAFE | 1-5 | 27.2% | 49.6% | 6.4% | 534.379 | 104/93/33/247/332/306 | 68/57;60/79;262 |
| C SAFE | 6-10 | 32.8% | 55.2% | 7.2% | 460.590 | 94/108/8/304/403/257 | 60/65;59/66;238 |
| C SAFE | 11-15 | 44.0% | 48.0% | 5.6% | 429.217 | 72/109/12/307/407/344 | 67/58;41/68;219 |
| C SAFE | 16-20 | 44.0% | 53.6% | 1.6% | 416.740 | 64/97/7/276/376/332 | 59/66;31/80;205 |
| C FAST | 1-5 | 26.4% | 53.6% | 5.6% | 539.208 | 130/88/36/253/345/279 | 68/57;59/77;280 |
| C FAST | 6-10 | 28.8% | 57.6% | 9.6% | 423.819 | 195/61/39/183/407/128 | 60/65;62/57;206 |
| C FAST | 11-15 | 29.6% | 61.6% | 8.8% | 362.438 | 225/43/66/142/406/95 | 65/60;56/45;171 |
| C FAST | 16-20 | 43.2% | 51.2% | 5.6% | 390.097 | 293/33/58/232/402/108 | 47/78;58/50;178 |
| D SAFE | 1-5 | 30.4% | 42.4% | 6.4% | 577.063 | 103/92/33/271/366/337 | 68/57;59/83;301 |
| D SAFE | 6-10 | 41.6% | 44.8% | 8.8% | 486.973 | 91/104/9/331/425/273 | 62/63;57/65;259 |
| D SAFE | 11-15 | 46.4% | 45.6% | 4.8% | 453.350 | 78/106/11/318/434/397 | 64/61;41/74;243 |
| D SAFE | 16-20 | 45.6% | 52.0% | 1.6% | 427.378 | 75/91/7/273/396/345 | 55/70;33/78;217 |
| D FAST | 1-5 | 29.6% | 44.8% | 5.6% | 585.887 | 133/91/36/283/390/310 | 68/57;62/79;323 |
| D FAST | 6-10 | 33.6% | 49.6% | 12.0% | 445.364 | 196/58/36/201/429/138 | 59/66;60/59;233 |
| D FAST | 11-15 | 34.4% | 57.6% | 8.0% | 401.467 | 233/43/68/194/453/110 | 64/61;60/52;205 |
| D FAST | 16-20 | 42.4% | 50.4% | 7.2% | 388.455 | 285/31/59/275/396/106 | 48/77;57/48;185 |

SET_C/D는 양 profile 모두 후반 success가 증가한다. SET_A FAST는 PUSH/FAST_PASS 선호 강화와 함께 F5 표본이 줄고 success가 정체돼 환경 lethal bottleneck이 학습을 압도한다.

## 8. Behavioral Direction

| Set | SAFE damage/risk | FAST damage/risk | SAFE PUSH/FAST_PASS | FAST PUSH/FAST_PASS | Direction |
|---|---|---|---|---|---|
| A | 103 / 65 | 220 / 163 | 334 / 61 | 796 / 187 | PASS |
| B | 97 / 66 | 227 / 163 | 326 / 60 | 829 / 188 | PASS |
| C | 101 / 66 | 221 / 170 | 334 / 60 | 843 / 199 | PASS |
| D | 105 / 66 | 235 / 174 | 347 / 60 | 847 / 199 | PASS |

환경을 부드럽게 해도 SAFE/FAST profile은 collapse하지 않았다.

## 9. Successful-Time Direction

| Set | SAFE avg / median | FAST avg / median | FAST avg advantage | Seed-level FAST faster |
|---|---|---|---:|---:|
| A | 553.771 / 509.558 | 594.162 / 576.160 | -40.391 | 1/5 |
| B | 586.980 / 587.006 | 594.599 / 584.335 | -7.620 | 1/5 |
| C | 591.279 / 587.583 | 586.631 / 579.518 | +4.648 | 3/5 |
| D | 606.058 / 600.673 | 587.613 / 583.516 | +18.446 | 4/5 |

SET_D가 가장 안정적으로 의도한 시간 방향을 만든다. 5/5 완전 안정은 아니며 seed 1234에서 FAST가 약 1.47 time unit 느리다.

## 10. Normalization Distribution

각 셀은 episode count `0 / 1 / 2 / 3+`다.

| Set/Profile | Facility damage | Citizen risk |
|---|---|---|
| A SAFE | 405 / 87 / 8 / 0 | 442 / 51 / 7 / 0 |
| A FAST | 328 / 136 / 28 / 8 | 368 / 101 / 31 / 0 |
| B SAFE | 411 / 81 / 8 / 0 | 441 / 52 / 7 / 0 |
| B FAST | 321 / 143 / 27 / 9 | 368 / 101 / 31 / 0 |
| C SAFE | 409 / 82 / 8 / 1 | 441 / 52 / 7 / 0 |
| C FAST | 325 / 137 / 32 / 6 | 363 / 104 / 33 / 0 |
| D SAFE | 404 / 88 / 7 / 1 | 441 / 52 / 7 / 0 |
| D FAST | 319 / 140 / 31 / 10 | 360 / 106 / 34 / 0 |

분모 3 saturation은 facility damage에서 최대 2%, citizen risk에서 0%다. 현재 normalization denominator가 너무 빨리 포화된다는 증거는 없다.

## 11. Preference Saturation

5개 seed의 final policy에서 `±2`인 preference entry 수다.

| Set | SAFE action / route | FAST action / route |
|---|---:|---:|
| A | 44 / 0 | 29 / 0 |
| B | 49 / 0 | 32 / 0 |
| C | 53 / 0 | 38 / 0 |
| D | 56 / 0 | 37 / 0 |

Route preference clamp는 모든 Set에서 0이다. Action clamp는 존재하지만 PUSH/FAST_PASS 대 WAIT/CLEAR의 profile 분리가 유지되며 단일 action collapse는 관찰되지 않았다.

## 12. Seed-level Raw Results

Terminal 열은 `Goal/Timeout/Misunderstanding/Disabled`; Time은 successful `average/median`; Funnel은 `F5/Boss/Boss neutralized`다.

| Set/Profile | Seed | Terminal | Time | Damage/Risk | Funnel |
|---|---:|---|---|---|---|
| A SAFE | 7 | 18/3/5/74 | 533.891/494.951 | 25/12 | 48/29/18 |
| A SAFE | 42 | 19/6/4/71 | 575.029/595.343 | 22/14 | 56/29/21 |
| A SAFE | 1234 | 16/7/5/72 | 498.554/439.637 | 16/13 | 57/28/19 |
| A SAFE | 2025 | 16/3/6/75 | 608.104/620.922 | 27/11 | 54/23/16 |
| A SAFE | 9001 | 16/5/5/74 | 551.777/548.931 | 13/15 | 46/24/17 |
| A FAST | 7 | 9/1/7/83 | 661.415/675.976 | 42/31 | 36/13/9 |
| A FAST | 42 | 5/7/6/82 | 608.231/611.571 | 46/34 | 36/12/7 |
| A FAST | 1234 | 10/4/7/79 | 560.216/485.962 | 45/34 | 36/18/11 |
| A FAST | 2025 | 13/2/5/80 | 595.777/591.331 | 54/25 | 44/18/13 |
| A FAST | 9001 | 10/4/10/76 | 558.449/554.898 | 33/39 | 33/19/12 |
| B SAFE | 7 | 27/5/5/63 | 603.786/635.641 | 25/12 | 59/42/28 |
| B SAFE | 42 | 23/7/4/66 | 595.681/599.510 | 21/14 | 63/35/25 |
| B SAFE | 1234 | 28/6/7/59 | 558.317/540.646 | 16/13 | 67/39/30 |
| B SAFE | 2025 | 33/2/7/58 | 594.566/606.798 | 22/10 | 63/40/34 |
| B SAFE | 9001 | 25/6/5/64 | 582.913/580.366 | 13/17 | 59/37/25 |
| B FAST | 7 | 16/3/6/75 | 612.577/633.864 | 42/31 | 45/27/16 |
| B FAST | 42 | 12/7/7/74 | 611.765/637.622 | 48/32 | 44/20/14 |
| B FAST | 1234 | 21/5/7/67 | 572.061/570.736 | 49/33 | 50/30/22 |
| B FAST | 2025 | 29/3/8/60 | 609.609/615.746 | 56/30 | 58/32/29 |
| B FAST | 9001 | 17/5/11/67 | 567.799/576.160 | 32/37 | 47/30/18 |
| C SAFE | 7 | 34/5/5/56 | 580.378/589.919 | 25/12 | 66/49/34 |
| C SAFE | 42 | 35/7/4/54 | 596.306/603.429 | 23/14 | 66/45/37 |
| C SAFE | 1234 | 39/9/7/45 | 552.516/540.368 | 19/13 | 68/54/42 |
| C SAFE | 2025 | 45/3/6/46 | 623.948/659.993 | 22/10 | 67/52/45 |
| C SAFE | 9001 | 32/7/4/57 | 598.668/594.746 | 12/17 | 64/46/33 |
| C FAST | 7 | 28/2/7/63 | 560.630/522.491 | 42/33 | 55/38/28 |
| C FAST | 42 | 27/6/6/61 | 627.672/646.496 | 51/31 | 58/34/28 |
| C FAST | 1234 | 35/6/9/50 | 580.548/579.366 | 38/39 | 61/47/37 |
| C FAST | 2025 | 36/4/9/51 | 584.198/588.500 | 54/26 | 63/44/37 |
| C FAST | 9001 | 34/5/6/55 | 584.290/582.475 | 36/41 | 60/50/35 |
| D SAFE | 7 | 40/7/5/48 | 593.040/599.440 | 26/12 | 75/55/43 |
| D SAFE | 42 | 38/6/4/52 | 611.939/624.927 | 27/14 | 69/50/39 |
| D SAFE | 1234 | 43/12/6/39 | 577.830/581.366 | 17/13 | 73/57/46 |
| D SAFE | 2025 | 46/5/7/42 | 615.364/617.033 | 24/11 | 73/55/48 |
| D SAFE | 9001 | 38/7/5/50 | 634.559/606.876 | 11/16 | 68/48/39 |
| D FAST | 7 | 41/3/6/50 | 591.611/576.429 | 48/30 | 70/47/42 |
| D FAST | 42 | 29/7/6/58 | 604.263/577.909 | 49/30 | 67/38/31 |
| D FAST | 1234 | 35/9/9/47 | 579.302/579.366 | 51/38 | 65/44/38 |
| D FAST | 2025 | 38/4/8/50 | 572.766/588.909 | 53/33 | 69/48/39 |
| D FAST | 9001 | 32/8/12/48 | 594.120/590.410 | 34/43 | 61/48/34 |

## 13. Timeout Assessment

- SET_A: SAFE 4.8%, FAST 3.6%
- SET_B: SAFE 5.2%, FAST 4.6%
- SET_C: SAFE 6.2%, FAST 4.6%
- SET_D: SAFE 7.4%, FAST 6.2%

Timeout은 0도 아니고 지배적 실패 원인도 아니다. 부드러운 Set에서 더 많은 robot이 오래 생존하면서 소폭 증가했다. 첫 sweep 원칙에 따라 timeLimit은 변경하지 않았으며, 별도 조정이 당장 필요하다는 증거는 없다.

## 14. Recommendation / Rejected Reasons

### Recommended: SET_D

- SAFE/FAST success 41%/35%로 성공과 실패가 모두 충분하다.
- F5 reach 358/332, Boss found 265/225로 downstream 학습 표본이 가장 많다.
- SAFE damage/risk `105/66` < FAST `235/174`.
- FAST PUSH/FAST_PASS `847/199` > SAFE `347/60`.
- successful average/median 모두 FAST가 더 짧다.
- seed별 successful average 방향도 4/5로 가장 안정적이다.
- route clamp hit 0, normalization 조기 saturation 없음.

### Rejected for recommendation

- SET_A: mandatory guard deaths가 학습 진행을 압도한다.
- SET_B: 여전히 lethal하며 FAST successful average 방향이 역전되지 않는다.
- SET_C: 전반적으로 GOOD이나 time direction이 3/5로 SET_D보다 덜 안정적이다.

## 15. Change Boundary / Verification

- Core Learning Algorithm modified: **NO**
- production `map_integration_v1.md` numeric Source of Truth modified: **NO**
- production default encounter probabilities modified: **NO**
- 추가된 것은 optional environment parameter injection과 diagnostic collection뿐이다.
- map geometry, visual, TSJ, Phaser/UI 변경: **NO**

검증 결과:

- Actual Map + Learning Engine: 33/33 PASS
- Navigation graph validator: PASS
- Building/Floor/Cross-floor 묶음: 49/50 PASS
- 남은 1건은 기존 Floor 4 fixture가 현재 16개 manual assets를 빈 tileset으로 기대하는 사전 존재 불일치다.
- `npm run typecheck`: PASS
- `npm run build`: PASS; 기존 large-chunk warning만 존재

재실행 명령:

```text
npm run validate:actual-map-tuning
```

다음 권장 작업은 사용자 승인 후 SET_D를 production numeric SoT에 반영할지 결정하는 것이다. 승인 전에는 후보 상태를 유지한다.

최종 판정: `READY_FOR_USER_TUNING_DECISION`
