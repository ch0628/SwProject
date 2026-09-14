# Plaza/Park Junction + Stop Reservation Validation

## Scope

This pass fixes only the two lane-aware runtime defects confirmed by visual review:

1. Edge lanes were separated, but adjacent lane endpoints were joined by a direct chord near a junction. Sharp turns could place the head and tail of one traffic stream close enough for Large `26x16` footprints to block each other.
2. Stop selection had no shared ownership. Concurrent hold intents independently selected the same cheapest Stop Point, producing SP5 pile-up.

The TMJ, N01-N28, E01-E33 topology, Collision, lane offsets, SP coordinates, footprint, speed, watchdog, Traffic v1, and Full Flow v1 are unchanged.

## Runtime design

`lanePath` now creates a short cubic, arc-like transition from the directed incoming lane endpoint to the directed outgoing lane endpoint. Routing still uses the original logical node; movement does not pass through the node center. Every transition records its node, incoming/outgoing edges, directions, point range, and deterministic turn key.

The former N19 deadlock was a sharp E13-to-E16 turn. A following footprint could wait inside the swept corner and block the leading footprint on the outgoing leg. Sharp same-turn streams therefore reserve only their direction-specific transition key early and retain it through an outgoing safety margin. This is not a node-wide junction lock: different incoming/outgoing turn keys at the same logical node remain independent.

All Stop Points use one shared `stopReservations` owner map. Selection filters to reachable free candidates, then uses the existing deterministic route cost and name tie-break. SP5-SP7 therefore distribute across the three free general points. Ownership lasts through approach, hold, and physical lane rejoin; release occurs only after rejoin completes.

If every eligible Stop Point is busy, the intent remains pending. The NPC follows a deterministic adjacent non-door edge and retries at the next logical node. It does not hold on a road or at a connector entrance. The intent is neither dropped nor duplicated in behavior history.

## Targeted tests

| Test | Result | Evidence |
|---|---:|---|
| A-1 E10 opposite directions | PASS | Separate lanes, N10 transition, both clear, 0 overlap, 0 unrecovered stall |
| A-2 four N10 diagonal/turn combinations | PASS | Direction-specific transitions, no node-center merge, all destinations reached |
| B-1 three general holds | PASS | SP5/SP6/SP7 unique reservations, all behavior/rejoin/exit complete |
| B-2 four general holds | PASS | Three owners plus one moving defer; deferred behavior later completes |
| B-3 two SP10 requests | PASS | One owner at a time; second request defers and completes |
| Mixed eight-NPC integration | PASS | Junction/general/Cafe/Facility/Manhole mix; no stall, overlap, collision, road hold, or leaked reservation |

## 120-second deterministic concurrency rerun

Targeted and integration tests passed before this rerun. No level above 15 was executed.

| NPC | Status | Spawned / completed / exited / remaining | Reports / unique / recovered / unrecovered | Max no-progress | Junction stall / conflict | SP conflict / duplicate / occupancy | Deferred / completed | Connector stall |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 | PASS | 5 / 5 / 5 / 0 | 0 / 0 / 0 / 0 | 0.00s | 0 / 0 | 0 / 0 / 0 | 0 / 0 | 0 |
| 8 | PASS | 8 / 8 / 8 / 0 | 0 / 0 / 0 / 0 | 0.00s | 0 / 0 | 0 / 0 / 0 | 0 / 0 | 0 |
| 10 | PASS | 10 / 10 / 10 / 0 | 0 / 0 / 0 / 0 | 0.00s | 0 / 0 | 0 / 0 / 0 | 0 / 0 | 0 |
| 12 | PASS | 12 / 12 / 12 / 0 | 0 / 0 / 0 / 0 | 0.00s | 0 / 0 | 0 / 0 / 0 | 0 / 0 | 0 |
| 15 | PASS | 15 / 15 / 15 / 0 | 0 / 0 / 0 / 0 | 0.95s | 0 / 26 | 1 / 0 / 0 | 1 / 1 | 0 |

Every level also recorded zero NPC overlap, fixed Collision violation, pathfinding failure, invalid destination, runtime exception, road hold violation, behavior-history issue, and remaining Stop Point reservation.

The 15-NPC transition conflict count is 26 coordinated wait frames on a direction-specific turn. It produced no watchdog report and cleared in under one second. The single Stop reservation conflict is the expected fourth general request; its deferred behavior later completed.

## Comparison with the previous lane result

- 12 NPC: `FAIL`, 9 exited, 3 unrecovered at E10, 117.40s maximum no-progress -> `PASS`, 12 exited, 0 unrecovered, 0.00s maximum no-progress.
- 15 NPC: `FAIL`, 7 exited, 8 unrecovered around E10/E13/E16 -> `PASS`, 15 exited, 0 unrecovered, 0.95s maximum no-progress.
- Previously healthy 5/8/10 levels remain PASS.

## Diagnostics and visual review

Concurrency results now include junction transition stall/conflict counts, reservation conflict, duplicate reservation, occupancy conflict, deferred/completed counts, connector stall, leaked reservation count, and per-stalled-NPC diagnostics. A stalled diagnostic includes ID, intent, logical edge, transition state, target SP, reservation state, blocker NPC when identifiable, position, and current/maximum no-progress duration.

Browser debug review passed for 10, 12, and 15 NPC modes. The overlay shows cyan/pink directional lanes, orange current transition geometry, yellow free SPs, green owned SPs, explicit `SPx:OWNER/FREE` text, and live direction-specific transition ownership. The 15-NPC initial frame showed SP5/SP6/SP7 owned by NPC05/NPC08/NPC23 while NPC17 continued moving with the deferred IDLE intent.

## WARN and decision boundary

- Production build reports the pre-existing large-chunk size warning; build succeeds.
- The 26 transition conflict frames and one Stop reservation conflict at 15 are expected coordinated contention, not stalls or failures.
- No remaining functional FAIL is recorded through 15 NPC.
- This validation does not set the final active NPC count. Testing stopped at 15 and did not proceed to CCTV work.
