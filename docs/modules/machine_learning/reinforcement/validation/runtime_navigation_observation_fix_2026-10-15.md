# Runtime Navigation + Observation Fix — 2026-10-15

## Scope

Reward, combat, damage, probability, learning-rate, exploration, and policy-update numeric values were not changed. This pass changed only Runtime command generation, collision filtering, playback failure behavior, F5 state tracing, checkpoint orchestration, and Phaser audio lifecycle configuration.

## MOVE evidence

`commandId` is episode-local. The original browser console lines did not include round/robot/episode identity, so an ID alone is not globally unique. The new debug trace includes all three identities plus logical nodes, runtime coordinates, collision intersections, door state, entity positions, and `WHY_NO_COLLISION_FREE_PATH`.

- MOVE 64 deterministic match: seed 42, profile 1/3/2, Round 4 Robot 4. A failed F3 left route was incorrectly completed with `FLOOR_TRANSITION → F4_LEFT_ARRIVAL`; the next same-context F3 right-route MOVE then ran from runtime `(304,1120)` against an expected source near `(1280,1184)`. First blocked sample was `(1312,1184)`. Cause: adapter floor/source divergence after a canonical same-floor reroute.
- MOVE 88 deterministic match: seed 42, profile 1/3/2, Round 4 Robot 5. After `BOSS_FOUND(L2)` and explicit `RETREAT_TO_SEARCH`, the return MOVE targeted Boss center `(704,224)` instead of staging `(704,307)`. The planner also treated the visible Boss sprite as a collider although `blocking=false`.
- MOVE 113 deterministic match: seed 42, profile 1/3/2, Round 4 Robot 3. Same defect for R1: Search Hub `(1280,1200)` to Boss center `(2272,640)` instead of staging `(2272,723)`, then rejected against the non-blocking Boss entity.
- MOVE 56: no unique deterministic binding is possible from the console ID alone. In the seed/profile audit, MOVE 56 names several unrelated floor/edge commands and none is a unique first failure. The two proven failure families above cover every reproduced invalid path. A future MOVE 56 failure will now emit the missing round/robot/episode and intersection data instead of being ambiguous.

## Root causes and fixes

1. `movementBlockers()` included every visible entity. It now includes only `entity.blocking === true`; Villain, Boss, neutralized Villain, Citizen, and Tiger sprites are not Runtime colliders. Active obstacles remain blockers. Closed F5 doors and the Security Lock remain dynamic wall colliders until their canonical state-change command.
2. Same-context `REROUTE` was rendered as route completion plus floor transition. It now deterministically returns along the attempted polyline and starts the alternative route on the same floor.
3. Boss `RETREAT_TO_SEARCH` returned to the Boss center. It now returns to the same Boss encounter staging point; no random reroll, teleport, outcome regeneration, or alternate room is introduced.
4. F5 L1/R1 guard staging stopped beside the guard because the graph turns immediately before the room. A short, collision-validated local staging spur now keeps the Robot on the same x-axis with a 64px visible-footprint gap, then rejoins the unchanged canonical edge.
5. Runtime path failure previously applied the episode's final logical terminal. A visual navigation error could therefore show `GOAL_REACHED` while the sprite remained at Search Hub/F5 Spawn. Runtime failure now stops playback and emits an error without fabricating terminal completion.
6. The no-progress watchdog no longer teleports to a micro-target. It fails with a trace; normal MOVE playback uses a prevalidated deterministic local plan.

## F5 invariants

- After `BOSS_FOUND`, no `NO_BOSS`, different-room guard encounter, or different-room door-open command is generated before Boss neutralization/terminal.
- Non-terminal Boss `SUBDUE_RECOVERY` produces `ROBOT_RECOVERY → next ACTION` in the same encounter with no MOVE.
- Only an actual `RETREAT_TO_SEARCH` outcome produces Hub movement, and it returns to the same Boss staging point.
- Trace state now includes `bossFound`, `bossRoomId`, `currentSearchRoom`, `currentEncounterId`, `bossNeutralized`, `securityLockOpen`, `systemRestored`, and `terminalReason`.

## Observation orchestration

- `actualRound`: 1..20
- `observationIndex`: 1..5
- `observationRound`: 1, 5, 10, 15, 20

The controller still computes all 20 rounds and preserves one policy/combat-skill update per round. Only checkpoint rounds create five `RobotRuntime` command streams and Phaser scenes. Hidden rounds 2–4, 6–9, 11–14, and 16–19 are headless only. The UI numerator uses `observationIndex`, so `7 / 5` cannot occur.

## AudioContext

The reinforcement Runtime does not use Phaser audio. Five Phaser games were repeatedly destroyed and recreated, allowing Phaser's audio manager to race a resume against a closed context. Runtime games now use `audio: { noAudio: true }`, so no AudioContext is created for this screen.

## Verification

- Deterministic navigation audit: checkpoint rounds 1/5/10/15/20 plus former Round 4 MOVE 64 case; invalid path 0, floor divergence 0, Goal logical/runtime endpoint parity PASS.
- Boss invalid search command 0.
- Non-terminal Boss recovery Spawn reset 0.
- F5 same-x staging and Boss-center avoidance PASS.
- `npm test`: 250/250 PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS (existing large-chunk warning only).

Browser smoke was intentionally not run in this pass.
