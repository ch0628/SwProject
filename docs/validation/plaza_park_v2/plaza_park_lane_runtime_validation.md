# Plaza/Park Navigation v2 — Lane Runtime Validation

Updated: 2026-09-14  
Status: **5/8/10 PASS · 12/15 FAIL · final active count not decided**

## Cause and preserved baseline

The earlier 8/10/12/15 failures are the preserved **single-centerline traversal baseline**, not evidence that the authored Map lacks road capacity. Opposite directions shared the same E01~E33 centerline and became mutual blockers. The baseline remains unchanged in `docs/validation/plaza_park_v2/plaza_park_supervised_concurrency_validation.md`.

## Source data and Stop Point gate

`public/maps/plaza-park-v2.tmj` contains one `NPC_Stop_Points` layer with exactly ten unique Point Objects. No Stop Point has a `stopType` property and no Map object was changed.

| Stop | Position | Group | Nearest access edge | Large standing | Local connector |
|---|---:|---|---|---|---|
| SP1 | 881.33, 303.00 | Bench/rest | E03 | PASS | PASS |
| SP2 | 1808.50, 531.00 | Bench/rest | E05 | PASS | PASS |
| SP3 | 2383.09, 752.00 | Bench/rest | E07 | PASS | PASS |
| SP4 | 2577.67, 1141.00 | Bench/rest | E29 | PASS | PASS |
| SP5 | 1391.00, 976.00 | General | E10 | PASS | PASS |
| SP6 | 1680.00, 1135.00 | General | E22 | PASS | PASS |
| SP7 | 1393.00, 1268.00 | General | E15 | PASS | PASS |
| SP8 | 662.00, 1232.33 | Cafe external | E26 | PASS | PASS |
| SP9 | 2814.00, 577.00 | Facility external | E25 | PASS | PASS |
| SP10 | 2950.00, 646.00 | Manhole | E23 | PASS | PASS |

Every standing footprint and local connector was sampled against the unchanged 130 Collision objects and 3072×1792 world bounds using the Large 26×16 footprint. SP10 excludes the E25/E26 door branches when choosing access, so it remains an interaction pocket off main edge E23 rather than a transit shortcut.

## Lane geometry

Dijkstra still produces the same logical node/edge path. Runtime then converts each directed edge segment into a consistent right-side lane. Forward and reverse use different lateral geometry; selection is deterministic and never random.

Offsets are derived rather than configured constants:

1. Compute tangent and perpendicular normal for the actual TMJ segment.
2. Measure continuous Collision/world clearance on each side at 0.5px precision with a Large footprint.
3. Compute the AABB Minkowski separation `26×|normal.x| + 16×|normal.y| + 1px gap`.
4. Split that required separation across the two available sides. Asymmetric road clearance therefore produces asymmetric offsets.
5. Densify the selected movement geometry to at most 1px steps so the existing swept-AABB collision check does not create diagonal false blockers.

Observed canonical forward/reverse offsets in pixels:

```text
E01 1.50/29.22  E02 8.57/8.57  E03 8.59/8.59  E04 13.54/13.54
E05 8.53/8.53  E06 15.33/15.33 E07 8.62/8.62  E08 15.46/15.46
E09 13.50/13.50 E10 8.61/8.61 E11 8.53/8.53 E12 26.32/4.00
E13 15.31/15.31 E14 18.46/10.50 E15 8.53/8.53 E16 8.53/8.53
E17 4.50/26.20 E18 15.35/15.35 E19 3.50/27.24 E20 8.55/8.55
E21 8.55/8.55 E22 13.51/13.51 E23 13.50/13.50 E24 8.58/8.58
E25 0/0 E26 0/0 E27 13.50/13.50 E28 13.52/13.52
E29 13.50/13.50 E30 8.50/8.50 E31 8.58/8.58 E32 8.51/8.51 E33 8.53/8.53
```

E25 N08↔N28 and E26 N17↔N18 remain single-file door branches because two-way offset is not forced through a narrow building opening.

## Junction and Road Rule

Adjacent directed lane endpoints are connected with a short runtime-only transition. Internal routes do not pass through the logical Node center, do not create synthetic nodes, and are densified to prevent invalid jumps. N01~N28, E01~E33 and Dijkstra topology are unchanged.

Road/lane geometry is movement-only. PARK_WALK, WALK, RUN, COMMUTE, TRANSIT, ESCAPE and JOG proceed without an intent hold on the road. Hold intents branch to a Stop Point, record the real semantic behavior there, reverse the safe local connector, rejoin the same directed lane and then continue. NPC traffic may still stop movement temporarily.

| Intent | Stop Point |
|---|---|
| BENCH_REST / REST | nearest deterministic SP1~SP4 |
| WAIT / TALK / IDLE / LOOK_AROUND and plaza-side suspicious/interact holds | nearest deterministic SP5~SP7 |
| CAFE_SERVICE external interaction | SP8 |
| FACILITY_REPAIR / REPAIR external work | SP9 |
| MANHOLE_TAMPER | SP10 via E23 |

CAFE_VISIT still uses N17 CAFE_DOOR and FACILITY_VISIT still uses N28 FACILITY_DOOR. SP8/SP9 do not replace door entry.

## 120-second deterministic concurrency results

| Active | Result | Spawned | Completed/exited | Remaining | Reports | Unique | Recovered | Unrecovered | Max no-progress | Cafe | Facility | Manhole | SP behaviors |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 | PASS | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0.00s | 1 | 1 | 1 | 1 |
| 8 | PASS | 8 | 8 | 0 | 0 | 0 | 0 | 0 | 0.00s | 1 | 1 | 1 | 4 |
| 10 | PASS | 10 | 10 | 0 | 0 | 0 | 0 | 0 | 0.00s | 1 | 2 | 1 | 4 |
| 12 | FAIL | 12 | 9 | 3 | 161 | 3 | 0 | 3 | 117.40s | 1 | 2 | 1 | 4 |
| 15 | FAIL | 15 | 7 | 8 | 413 | 8 | 0 | 8 | 117.40s | 1 | 3 | 1 | 5 |

All levels recorded zero NPC overlap, fixed collision, pathfinding failure, invalid destination, runtime exception, behaviorHistory issue and road-hold violation. Exit distributions were:

```text
5  : N24=2 N25=1 N26=2
8  : N24=2 N25=4 N26=2
10 : N24=3 N25=4 N26=3
12 : N24=3 N25=3 N26=3
15 : N24=0 N25=3 N26=4
```

Remaining lane conflict observations: 12 = E10 (NPC05/NPC08/NPC23); 15 = E10, E13 and E16. No automatic fix was applied after these FAIL results.

## Before / After

| Active | Single-centerline baseline | Lane-aware result |
|---:|---|---|
| 5 | PASS, unrecovered 0 | PASS, unrecovered 0 |
| 8 | FAIL, 3, max 112.95s | PASS, 0, max 0.00s |
| 10 | FAIL, 4, max 114.80s | PASS, 0, max 0.00s |
| 12 | FAIL, 5, max 118.55s | FAIL, 3, max 117.40s |
| 15 | FAIL, 8, max 118.55s | FAIL, 8, max 117.40s |

The lane runtime removes the original E08 head-on centerline failure through 10 active NPCs. It does not prove general Map capacity or establish the final active count.

## Browser validation

The existing 5/10/15 supervised selectors now draw cyan/pink direction lanes and yellow Stop Points in debug mode. Direct browser overview confirmed separated lane rendering, Stop Point markers, 56–60 FPS during the short observation, no visible clipping/overlap, and an empty warning/error console. At roughly 12 real-time seconds, 10 showed zero stalled candidates; 15 showed three, consistent with the headless FAIL rather than being hidden by the visual mode.

## WARN, FAIL and limitations

- WARN: offsets are validated against the current TMJ and Large AABB footprint; a future Map edit requires rerunning the validator.
- WARN: the deterministic selection is a comparable active-density sample, not a full route permutation or simultaneous same-entry load test.
- FAIL: 12 and 15 do not complete within 120 simulation seconds; observed conflicts remain on E10 and, at 15, E13/E16.
- No movement auto-fix, threshold relaxation, teleport, random sidestep, RVO/ORCA, graph change or Map edit was used after validation.
- Final active NPC count remains undecided.
