# Runtime State Synchronization Audit — 2026-10-15

최종 분류: **PASS_WITH_REMAINING_RUNTIME_RISK**

## 1. 실제 문제를 재현했는가

- Goal 위치처럼 진행한 뒤 TIMEOUT: 재현. Headless terminal은 `F5_SECURITY_LOCK/TIMEOUT`인데 기존 Runtime adapter가 `SYSTEM_RESTORED`와 Goal MOVE를 추가 생성했다.
- 무한 WALK: 정확한 과거 run은 재현하지 못했다. 과거 선택값/seed/trace가 저장되지 않는다. 다만 도달 불가능 target을 planner가 그대로 반환하고 Phaser가 좌표 도달만 기다리는 동일 stuck 조건은 deterministic unit case로 재현했다.
- F5 SUBDUE 후 Spawn 복귀: `(1,3,2)`, seed 42의 20 rounds에서는 재현되지 않았다. 생존 recovery 다음 canonical decision 전에는 MOVE가 없었다.

## 2. 사용된 profile / seed / round / robot

- 후보 profile: `speed=1, judgment=3, threat=2`
- Goal/TIMEOUT reproduction: training seed `1`, Round `13`, Robot `5`, episode seed `2504776171`
- 보고된 Round 15 후보 재실행: training seed `42`, Round `15`, Robot `4`, episode seed `1391397081`
- F5 생존 recovery 예: training seed `42`, Round `1`, Robot `3`, episode seed `267658970`

Production UI는 별 선택과 완료 run identity를 React memory에만 보관하므로 과거 실제 run profile/seed를 복원할 수 없었다. 따라서 사용자 기억의 `(1,3,2)`를 deterministic 후보로 사용했다.

## 3. First Divergence

**FIRST DIVERGENCE:** `runtimeCommands.createRuntimeCommands()`의 post-Boss 분기.

Headless 결과가 `bossNeutralized=true`, `systemRestored=false`, `terminalReason=TIMEOUT`, terminal location `F5_SECURITY_LOCK`인데도 adapter는 `bossNeutralized` 하나만 확인하여 Security Lock open, Control Room 이동, `SYSTEM_RESTORED`, `E_F5_CONTROL_GOAL` MOVE를 생성했다.

## 4. Root Cause

**ROOT CAUSE:** Runtime adapter가 canonical event/position commit 상태 대신 중간 flag인 `bossNeutralized`를 전체 Goal flow 완료 조건으로 사용했다. 이 때문에 terminal 이후의 presentation command가 만들어졌다.

추가 root cause:

- movement planner는 우회로가 없을 때 blocked target을 fallback으로 반환했다.
- Phaser movement는 Arcade velocity/collision과 별도 좌표 도달 조건을 함께 사용했고 no-progress 종료 조건이 없었다.
- terminal SUBDUE failure에도 임시 `ROBOT_RECOVERY` command가 생성됐다.
- temporary neutralized visual은 final disabled와 같은 latch를 사용해 정상/combat state로 돌아갈 수 없었다.

## 5. 무한 WALK의 실제 원인

과거 Round 15/Robot 4 identity는 복원되지 않았다. 재현 가능한 동일 조건의 최초 divergence는 `runtimeMovement.detourForSegment()`가 collision-free detour 부재 시 원래 blocked target을 반환한 지점이다. Scene은 WALK를 계속 재생하면서 Arcade collision 때문에 위치가 줄지 않아도 completion을 발생시키지 않았다.

수정 후 unreachable MOVE는 실행 전에 `valid=false`가 되고 `INVALID_MOVE_TARGET` trace를 남긴다. 유효한 Runtime MOVE는 prevalidated polyline을 직접 deterministic step으로 재생하며, 750ms no-progress invariant가 `STUCK_RECOVERY`를 기록하고 현재 valid micro-target으로 presentation만 재동기화한다. RNG, action, encounter, terminal은 다시 계산하지 않는다.

## 6. F5 Spawn 복귀의 실제 원인

생존한 F5 SUBDUE recovery에서 Spawn/Hub MOVE는 생성되지 않았다. 예시 command 순서는 `SUBDUE_RECOVERY → ROBOT_RECOVERY → 다음 ACTION`이고 encounter/zone id가 동일했다.

대신 두 결함을 확인했다.

- 누적 피해가 1인 terminal SUBDUE에도 `ROBOT_RECOVERY`가 생성됐다.
- temporary recovery의 `NEUTRALIZED` visual latch가 final disabled처럼 영구 고정됐다.

둘 다 수정했다. 정확한 과거 Spawn 복귀 자체는 재현되지 않아 남은 browser risk로 분류한다.

## 7. Goal 위치 TIMEOUT의 실제 원인

Headless의 terminal은 Security Lock에서 이미 TIMEOUT이었지만 Runtime adapter가 Goal까지 계속 명령을 만든 것이 직접 원인이다. Adapter는 이제 canonical event history와 `controlRoomReached/systemRestored/terminalReason`을 단계별 gate로 사용한다.

Simulation도 atomic order를 명시했다: Control Room position commit → timeout check, System Restore commit → timeout check, final Goal MOVE completion → `GOAL_REACHED` single assignment. 이미 terminal이면 다음 단계는 시작하지 않는다.

## 8. 수정한 시스템 계층 및 파일

- Headless terminal ordering: `src/modules/reinforcement/sim/actualMapSimulation.ts`
- Runtime adapter / command ID / playback parity state: `src/modules/reinforcement/runtime/runtimeCommands.ts`
- MOVE validation: `src/modules/reinforcement/runtime/runtimeMovement.ts`
- Phaser command lifecycle / progress invariant / visual recovery: `src/modules/reinforcement/runtime/ReinforcementRuntimeScene.ts`
- Debug flag 및 identity 전달: `src/modules/reinforcement/runtime/ReinforcementTrainingApp.tsx`
- Deterministic integration tests: `tests/reinforcementRuntime.test.ts`
- Reproduction artifact: `artifacts/runtime_state_sync_reproduction.json`

## 9. 추가한 Runtime invariant

- 모든 production-generated command에 episode-local sequential `commandId`
- debug-only `CREATED/STARTED/COMPLETED/CANCELLED`
- duplicate completion detection
- terminal exactly once and final command
- terminal SUBDUE에는 temporary recovery 금지
- unreachable/blocked MOVE 실행 금지
- MOVING 750ms no-progress detection
- final disabled와 temporary recovery visual latch 분리
- terminal 이후 Runtime playback state mutation 금지

Debug 활성화: `?runtimeSyncDebug=true`. 기본 production console에는 trace를 출력하지 않는다.

## 10. Headless ↔ Runtime parity 결과

`(1,3,2)`, training seed 42, 20 rounds × 5 robots = 100 episodes에서 다음 100/100 일치:

- terminalReason
- final floor
- boss neutralized
- system restored

100 episodes의 Runtime command stream은 terminal 1개, terminal-last, sequential commandId를 모두 만족했다. 생성된 static MOVE path의 collision invalid count는 0이었다. Damage, simulationTime, encounter outcome은 Runtime이 재계산하지 않고 canonical episode 값을 사용한다.

## 11. 동일 reproduction seed before / after

Episode seed `2504776171`:

- Before: Headless `TIMEOUT@F5_SECURITY_LOCK`, adapter `SYSTEM_RESTORED=true`, Goal MOVE 생성.
- After: Headless `TIMEOUT@F5_SECURITY_LOCK`, adapter `SYSTEM_RESTORED` 없음, Goal MOVE 없음, terminal `TIMEOUT` 1회.

Episode seed `1391397081` (Round 15/Robot 4 후보): before/after 모두 canonical `GOAL_REACHED`, simulation time `429.807124`, damage `0.44`, boss room `R1`; historical infinite WALK는 재현되지 않았다.

## 12. 20-Round Browser smoke test 결과

**미완료.** Vite production source는 로컬에서 정상 기동했지만 제공된 Codex In-app Browser는 `127.0.0.1:5174`에 `ERR_CONNECTION_TIMED_OUT`을 반환했고 Chrome automation surface는 제공되지 않았다. 따라서 실제 Phaser canvas에서 checkpoint 1/5/10/15/20을 관찰했다는 주장은 하지 않는다.

대신 동일 production controller의 20 rounds × 5 robots command stream과 terminal completion을 자동 검증했다.

## 13. tests / typecheck / build 결과

- `npm test`: **247/247 PASS**
- `npm run typecheck`: **PASS**
- `npm run build`: **PASS**
- Vite는 기존 large chunk warning을 출력했으나 build error는 없었다.

## 14. Reward / Combat numeric tuning 여부

임의 tuning 없음. Reward v3, star mapping, fixed Goal, combat probability, damage, SUBDUE recovery cost/time, retryCombatBonus, learningRate, exploration schedule 값을 변경하지 않았다.

## 15. 아직 남은 Runtime risk

- 정확한 과거 Round 15/Robot 4 run identity가 저장되지 않아 동일 historical WALK를 재현하지 못했다.
- F5 Spawn 복귀는 deterministic command audit에서 재현되지 않았다.
- 실제 Browser 20-round visual smoke가 automation network 제한으로 미완료다.
- 750ms recovery는 prevalidated micro-target에만 적용하지만 실제 Phaser frame/collider 환경의 trace 확인이 한 번 더 필요하다.

최종 분류: **PASS_WITH_REMAINING_RUNTIME_RISK**
