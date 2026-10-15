# Topology-Aware Retreat + Encounter Presentation Contract Fix

검증 실행일: 2026-10-16 (Asia/Seoul)  
요청된 보고서 경로/파일명은 2026-10-15 기준을 유지했다.

## 결론

`PASS_TOPOLOGY_INTERACTION_CONTRACT`

현재 TMJ의 Navigation Node/Edge만으로 요구된 의미를 표현할 수 있었다. TMJ geometry, reward weights, star mapping, fixed GOAL reward, Combat Skill update, SUBDUE probability, robot damage, retryCombatBonus, learningRate, exploration schedule, timeout limit은 변경하지 않았다.

## 기존 문제와 root cause

- F1 route option은 첫 진입용 `F1_START` edge만 보유했다. route failure를 runtime에서 단순 역재생하면 `F1_ENTRY_SPLIT`을 지나 Spawn까지 돌아갔다.
- Boss action pool에 `RETREAT`이 포함되어 있었고 Boss retreat 비용/화면 이동에 `NO_BOSS_RETURN` edge가 재사용됐다.
- F2/F4의 RETREAT은 논리적으로 local retry였지만 이를 보여 주는 local motion command가 없었다.
- encounter facing이 마지막 이동 방향을 유지했다.
- SUBDUE lunge가 neutralization state change에 연결되어 성공 시에만 보였고 Boss 2회 motion 계약이 없었다.
- Citizen/Ambiguous encounter 종료 뒤 canonical route를 바로 계속해 사람 sprite 관통처럼 보일 수 있었다.
- visible checkpoint 사이 headless round 진행 상태 문구가 없었다.

## Map topology 분석과 Spawn 의미

- F1: 첫 진입은 `F1_START` edge를 사용하고, reroute는 기존 `F1_ENTRY_SPLIT`에서 시작하는 `E_F1_SPLIT_*` edge를 사용한다.
- F2/F4: 각 접근 route가 하나의 Center Guard/Center Stair transition으로 수렴하므로 다른 arrival로 돌아갈 topology 의미가 없다.
- F3: `F3_CENTER_ARRIVAL`이 arrival이면서 `F3_STAIR_SPLIT`의 canonical decision node다.
- F5: Guard approach는 `F5_SEARCH_HUB`에서 시작한다. `NO_BOSS_RETURN`은 room 확인 결과 Boss가 없는 경우에만 사용한다.
- SpawnPoint는 새 floor 첫 진입에만 사용한다. combat recovery, local retry, reroute에 사용하지 않는다.

## Floor별 RETREAT semantics

- F1: 실패 transition을 `failedTransitions`에 기록하고 현재 위치에서 `F1_ENTRY_SPLIT`으로 돌아간 뒤 아직 실패하지 않은 alternate route를 사용한다. reroute simulation cost도 decision node 기준 edge length를 사용한다.
- F2: Guard staging에서 진행 반대 방향으로 정확히 32px 후퇴하고 잠시 멈춘 뒤 같은 staging으로 복귀한다. 같은 encounter에서 다음 action을 수행한다.
- F3: 현재 route에서 `F3_CENTER_ARRIVAL`로 돌아간 뒤 alternate stair route를 사용한다.
- F4: F2와 같은 32px local retreat 후 같은 Center Guard encounter를 계속한다.
- F5 Guard: policy가 실제 `RETREAT`을 선택한 경우에만 room guard approach를 역방향으로 따라 `F5_SEARCH_HUB`으로 돌아간다. 살아 있는 SUBDUE failure는 같은 Guard에서 recovery 후 재시도한다.
- F5 Boss: action pool은 `['SUBDUE']`뿐이다. recovery 뒤 같은 Boss encounter에서 SUBDUE를 반복한다.

## F5 NO_BOSS_RETURN / Boss invariant

- `NO_BOSS_RETURN` edge는 Guard neutralized → room entry → 실제 `NO_BOSS` 판정 뒤에만 생성된다.
- `BOSS_FOUND` 이후 Boss neutralized 전까지 Boss RETREAT, 다른 room 선택, Search Hub 복귀, Spawn recovery, NO_BOSS, NO_BOSS_RETURN, Guard 재생성이 없다.
- Boss neutralized 이후에만 Security Lock → Control Room → SYSTEM_RESTORED → GOAL 흐름을 진행한다.
- 2,500 checkpoint evaluation episode에서 Boss RETREAT selection 0, Boss 발견 뒤 NO_BOSS_RETURN 사용 0을 확인했다.

## Citizen / Ambiguous local bypass

nonterminal이고 target이 남은 채 route를 계속할 때 `LOCAL_BYPASS` command를 생성한다.

1. P0(staging)에서 진행 방향 기준 왼쪽으로 1 tile 이동한다.
2. 사람과 Robot footprint 및 8px safety gap을 넘는 거리까지 원래 진행 방향으로 이동한다.
3. 원래 route centerline의 P3로 복귀한다.
4. 다음 canonical MOVE가 현재 P3에서 forward rejoin을 계산한다.

각 segment는 map bounds, static wall, closed dynamic collision, blocking obstacle, bypass target footprint를 포함해 4px 간격으로 검증한다. 왼쪽이 불가능하면 mirrored right를 결정적으로 검증하고 `LOCAL_BYPASS_FALLBACK_RIGHT` trace를 남긴다. 양쪽이 모두 불가능하면 teleport하지 않고 runtime invariant error로 종료한다. terminal 또는 Ambiguous SUBDUE에는 bypass command를 만들지 않는다.

## Encounter facing과 staging

- 공통 `directionTowardTarget(robot, target)` helper가 Robot→target world vector로 UP/DOWN/LEFT/RIGHT를 계산한다.
- ENCOUNTER START와 실제 ACTION 직전에 다시 계산한다. Citizen, Ambiguous, Villain, F5 Guard, Boss, Obstacle에 공통 적용된다.
- F5 Guard/Boss는 기존 staging metadata를 재사용하며 same-x vertical staging과 visible footprint 기준 64px gap을 유지한다.

## Combat presentation

- 순서: `ACTION(SUBDUE)` → collision-checked combat animation → `OUTCOME` → success/failure state visual.
- Villain/F5 Guard: approach-impact-return 1회.
- Boss: approach-impact-return 2회.
- 모든 attempt에서 animation을 수행하며 outcome RNG를 runtime에서 다시 계산하지 않는다.
- 기존 neutralization state-change 전용 animation 호출을 제거해 성공 시 double animation을 막았다.
- alive failure는 animation 뒤 neutralized-down recovery visual을 보여 주고 같은 encounter action으로 돌아간다.

## Hidden-round status

표시 checkpoint는 실제 round 1/5/10/15/20으로 유지한다. 결과 화면에서 다음 checkpoint로 갈 때 `HEADLESS_LEARNING` phase에서 “다음 관찰을 위해 로봇들이 학습하고 있어요...”를 표시한다. 이 phase는 `RuntimeView`/Phaser를 만들지 않고, 다음 checkpoint 준비 뒤 `PREPARING`으로 전환한다.

## Learning checkpoint audit

브라우저 기본 seed 42, reward star profile `(speed=1, judgment=3, threat=2)`, production environment, exploration 0으로 checkpoint별 500 episode를 평가했다. 정책은 각 round의 `policyAfter`, Combat Skill은 같은 round의 `combatSkillAfter`를 사용했다. 수치 튜닝은 수행하지 않았다.

| Round | GOAL | TIMEOUT | ROBOT_DISABLED | MISUNDERSTANDING | Goal rate | Avg sim time | Avg damage | Combat Skill | SUBDUE success | Boss reach | Boss neutralized |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 85 | 100 | 268 | 47 | 17.0% | 586.86 | 0.7804 | 0.1322 | 59.1% | 33.2% | 19.2% |
| 5 | 183 | 47 | 237 | 33 | 36.6% | 548.41 | 0.7373 | 0.2722 | 67.4% | 48.2% | 38.8% |
| 10 | 287 | 8 | 178 | 27 | 57.4% | 516.29 | 0.6820 | 0.4472 | 74.0% | 67.4% | 58.2% |
| 15 | 375 | 3 | 102 | 20 | 75.0% | 529.85 | 0.5366 | 0.6222 | 82.7% | 84.8% | 75.8% |
| 20 | 459 | 0 | 24 | 17 | 91.8% | 533.08 | 0.3390 | 0.7972 | 90.5% | 95.2% | 92.2% |

Raw result: `artifacts/topology_retreat_encounter_presentation_audit.json`

## Regression tests

- A/B: F1/F3 decision-node retreat, alternate route, Spawn reset 없음.
- C/D: F2/F4 32px collision-free local retreat, 같은 encounter.
- E/F: F5 Guard explicit RETREAT만 Search Hub 이동; SUBDUE recovery는 같은 Guard.
- G-J: Boss SUBDUE-only, recovery same Boss, Boss-active 구간 NO_BOSS/NO_BOSS_RETURN/room reselection 없음.
- K/L: Citizen/Ambiguous 3-segment bypass, target footprint 비관통, deterministic right fallback, 양쪽 실패 explicit failure.
- M: Robot→target facing helper와 F5 vertical direction.
- N/O: Villain/Guard 1회, Boss 2회, ACTION-before-OUTCOME.
- P: Phaser checkpoint는 1/5/10/15/20만, hidden phase는 status-only.
- 20 rounds × 5 robots의 모든 command를 실제 dynamic presentation state와 함께 재생 계획해 invalid MOVE/local motion 0을 확인했다.
- terminal single assignment, terminal 뒤 MOVE 금지, commandId, duplicate completion, watchdog, logical/runtime parity, observationIndex/actualRound, no AudioContext 기존 테스트를 유지했다.

## 변경 파일

- `src/modules/reinforcement/sim/learningEngine.ts`
- `src/modules/reinforcement/sim/actualMapEnvironment.ts`
- `src/modules/reinforcement/sim/actualMapSimulation.ts`
- `src/modules/reinforcement/runtime/runtimeCommands.ts`
- `src/modules/reinforcement/runtime/runtimeMovement.ts`
- `src/modules/reinforcement/runtime/ReinforcementRuntimeScene.ts`
- `src/modules/reinforcement/runtime/ReinforcementTrainingApp.tsx`
- `src/modules/reinforcement/runtime/trainingLabels.ts`
- `scripts/reinforcement/evaluateTopologyInteractionContract.ts`
- `package.json`
- `tests/learningEngine.test.ts`
- `tests/reinforcementRuntime.test.ts`
- `tests/rewardFailureV3.test.ts`
- `tests/runtimeNavigationAudit.test.ts`
- `tests/subdueRecovery.test.ts`
- `tests/topologyRetreatPresentation.test.ts`
- `artifacts/topology_retreat_encounter_presentation_audit.json`

`src/modules/reinforcement/reinforce.zip`은 기존 untracked 사용자 파일로 판단해 수정/삭제하지 않았다.

## 자동 검증

- `npm test`: PASS, 257/257.
- `npm run typecheck`: PASS.
- `npm run build`: PASS. Vite의 기존 large-chunk warning만 있으며 build error는 없다.
- `npm run validate:topology-contract`: PASS, checkpoint당 500 episode.
- Browser smoke: 요청대로 강제하지 않았고 수행하지 않았다.

## 다음 manual browser checklist

1. F2/F4 Guard RETREAT이 1 tile 후퇴·짧은 정지·원위치 복귀 후 같은 Guard action으로 이어지는지 본다.
2. F5 L1/R1처럼 직전 이동이 수평이어도 Guard/Boss action 시 Robot이 target을 향하는지 본다.
3. Citizen/Ambiguous 통과가 왼쪽 우회 → 전진 → route 복귀로 보이고 sprite를 관통하지 않는지 본다.
4. 좁은 geometry에서 오른쪽 fallback trace가 `runtimeSyncDebug=true`에 기록되는지 본다.
5. Villain/Guard SUBDUE가 attempt마다 1회, Boss가 attempt마다 2회 approach-impact-return 하는지 본다.
6. Boss 실패 뒤 Search Hub/다른 room/Spawn으로 가지 않고 neutralized-down recovery 후 같은 Boss를 재시도하는지 본다.
7. checkpoint 결과 뒤 hidden-round 문구가 보이고 실제 관찰 화면은 round 1/5/10/15/20만 생성되는지 본다.
8. `runtimeSyncDebug=true`에서 invalid path, duplicate completion, post-terminal command가 없는지 확인한다.
