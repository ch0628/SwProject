# Actual Map Environment Confirmation v1

## 판정

`PASS_ACTUAL_MAP_INTEGRATION_V1`

사용자가 승인한 `SET_D`를 Production Environment v1 기본값으로 적용한 뒤, sweep injection 없이 production default 호출 경로로 동일한 5개 seed를 재실행했다. actual-map 구조 invariant, SAFE/FAST 행동 방향, aggregate FAST successful-time 우위가 모두 유지됐다.

## 1. 승인 SET / Production 값

승인 SET: `SET_D`

| Environment outcome | Production v1 |
|---|---:|
| Villain ×1 SUBDUE success | 0.90 |
| Villain ×2 SUBDUE success | 0.80 |
| Boss base SUBDUE success | 0.80 |
| Boss after DISTRACT SUBDUE success | 0.95 |
| Villain DISTRACT pass success | 1.00 |

이 표는 confirmation 시점의 snapshot이다. 숫자의 canonical Source of Truth는 `../map_integration_v1.md`다. Sweep A/B/C/D는 `actual_map_environment_tuning_v1.md`에 validation history로 유지한다.

## 2. 실행 구성

- Canonical graph: `navigation/navigation_graph_v1_f5_v3.json`
- Seeds: `7, 42, 1234, 2025, 9001`
- Profiles: `SAFE`, `FAST`
- 각 profile/seed: `5 Robots × 20 Rounds = 100 Episodes`, `20 Policy Updates`
- Profile별: `500 Episodes`, `100 Policy Updates`
- 합계: `1,000 Episodes`, `200 Policy Updates`
- Environment 경로: `runActualMapProfile(...)`의 production default 사용; custom config 인자를 전달하지 않음
- Actual safe baseline: `713.909160`
- Actual timeLimit: `892.386451` (`baseline × 1.25`)

## 3. Aggregate 결과

| Profile | GOAL_REACHED | Success | Successful avg time | Successful median | All-episode avg time | Facility damage | Citizen risk |
|---|---:|---:|---:|---:|---:|---:|---:|
| SAFE | 205 / 500 | 41.0% | 606.058261 | 600.673396 | 486.191186 | 105 | 66 |
| FAST | 175 / 500 | 35.0% | 587.612682 | 583.516269 | 455.293131 | 235 | 174 |

성공 Episode 기준 aggregate에서 FAST가 SAFE보다 `18.445579` simulation-time unit 빠르다.

## 4. Seed별 successful simulationTime

| Seed | SAFE avg | FAST avg | FAST 우위 |
|---:|---:|---:|---|
| 7 | 593.039946 | 591.610915 | YES |
| 42 | 611.939001 | 604.263229 | YES |
| 1234 | 577.829842 | 579.302113 | NO |
| 2025 | 615.363637 | 572.766258 | YES |
| 9001 | 634.559294 | 594.120202 | YES |

방향은 `4/5` seed에서 유지돼 허용 기준을 만족한다. `TIME_DIRECTION_UNSTABLE`이 아니다.

## 5. Terminal distribution

| Profile | GOAL_REACHED | ROBOT_DISABLED | TIMEOUT | CITIZEN_MISUNDERSTANDING |
|---|---:|---:|---:|---:|
| SAFE | 205 (41.0%) | 231 (46.2%) | 37 (7.4%) | 27 (5.4%) |
| FAST | 175 (35.0%) | 253 (50.6%) | 31 (6.2%) | 41 (8.2%) |

### ROBOT_DISABLED source

| Profile | F2 guard | F3 guard | F4 guard | F5 room guard | Boss |
|---|---:|---:|---:|---:|---:|
| SAFE | 49 | 41 | 25 | 77 | 39 |
| FAST | 53 | 41 | 33 | 90 | 36 |

주요 잔존 실패는 일반/F5 room guard의 SUBDUE 실패다. Boss 실패도 남아 있어 실패 분포가 제거되지 않았다.

## 6. F5 funnel

| Profile | F5 reached | Boss found | Boss neutralized | Control Room reached | GOAL_REACHED |
|---|---:|---:|---:|---:|---:|
| SAFE | 358 | 265 | 215 | 205 | 205 |
| FAST | 332 | 225 | 184 | 176 | 175 |

두 profile 모두 F5/Boss 학습 표본이 충분히 생성됐다. FAST의 Control Room 176과 GOAL 175 차이 1건은 Control Room 도달 후 remaining timeLimit 안에 final goal chain을 완료하지 못한 Episode다.

## 7. Action / safety 방향

| Profile | SUBDUE | FORCE_PASS | DISTRACT | PUSH | CLEAR | FAST_PASS |
|---|---:|---:|---:|---:|---:|---:|
| SAFE | 1,621 | 1,193 | 1,352 | 347 | 393 | 60 |
| FAST | 1,668 | 953 | 664 | 847 | 223 | 199 |

- SAFE facility damage `105 < 235` FAST: PASS
- SAFE citizen risk `66 < 174` FAST: PASS
- FAST PUSH `847 > 347` SAFE: PASS
- FAST FAST_PASS `199 > 60` SAFE: PASS

## 8. Preference / probability / structure

- Final clamp hits: SAFE `56`, FAST `37`; route clamp hits `0`
- Preference는 전부 finite 및 `[-2,+2]` 범위
- 모든 observed action set의 probability는 finite, non-negative, sum `1`
- 각 run `100 Episodes / 20 Updates`
- 매 Round 5 Robots 동일 snapshot, mid-round central update 없음, Round 종료 후 update 정확히 1회
- F1→F5 reachable, Boss policy hidden, searched-room repeat 없음
- Room guard neutralize 후에만 room search 진행
- 성공 chain: `BOSS_NEUTRALIZED → SECURITY_LOCK_OPEN → SYSTEM_RESTORED → GOAL_REACHED`
- terminal reason과 마지막 terminal event 일치
- SAFE/7 및 FAST/7 full-run replay exact; 기존 integration test의 SAFE/42 replay도 exact

## 9. 이전 SET_D sweep 비교

Production-default confirmation은 이전 injected SET_D sweep과 다음 핵심 결과가 정확히 일치했다.

- SAFE: success `41.0%`, successful avg `606.058261`, damage `105`, risk `66`
- FAST: success `35.0%`, successful avg `587.612682`, damage `235`, risk `174`
- Seed별 successful-time 방향: FAST 우위 `4/5`
- Terminal distribution, F5 funnel, action counts, clamp hits도 동일

따라서 default config wiring, seed propagation, canonical graph path, injection/default precedence에 차이가 없다.

## 10. Regression / 보호 항목

- Protected Core Learning Algorithm 변경: `NO`
- Reward normalization 유지: `damage/risk count ÷ 3`, upper clamp `1`
- timeLimit 규칙 유지: `longestSafeSuccessBaseline × 1.25`
- Learning/actual-map tests: PASS
- Building transition / Floor 1,2,3,5 / cross-floor tests: PASS
- Floor 4 old empty-tileset fixture: `PRE_EXISTING` — 실제 tileset 16 assets와 불일치; asset/TMJ를 변경하지 않음
- TypeScript typecheck: PASS
- Production build: PASS
- Canonical navigation graph validator: PASS
- `git diff --check`: PASS (working-tree CRLF warning only)

## Final

`PASS_ACTUAL_MAP_INTEGRATION_V1`

Actual TMJ Adapter, Learning Engine 연결, Production Environment v1, 5 Robots × 20 Rounds actual-map confirmation이 완료됐다. 다음 단계는 Production Phaser Gameplay 구현이다.
