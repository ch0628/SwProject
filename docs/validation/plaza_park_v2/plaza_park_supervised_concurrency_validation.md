# Plaza/Park Navigation v2 — Supervised Active Concurrency Validation

Updated: 2026-09-14  
Status: **5 PASS / 8, 10, 12, 15 FAIL — FINAL ACTIVE COUNT NOT DECIDED**

## 1. Environment

- Map: `public/maps/plaza-park-v2.tmj`
- Runtime: `src/plazaNpcRuntime.ts`
- Validator: `src/plazaConcurrencyValidation.ts`
- Command: `node --experimental-strip-types scripts/validate-plaza-supervised-concurrency.mjs`
- Duration: 120 simulation seconds per independent run
- Fixed step: 0.05 seconds
- Physical footprint: 26×16 for every validation NPC
- Existing speed unchanged: WALK 96px/s, RUN 144px/s
- Existing watchdog unchanged: 2 seconds / minimum 1px displacement
- Headless results do not estimate browser FPS.

Each level uses the first N rows of one deterministic table. IDs are unique. The first five rows are the existing supervised smoke baseline. To validate active in-progress density without overlapping multiple actors on the four entry points, later actors start at distinct graph nodes; `entryFlow` records the route family they represent.

## 2. Character Selection

| Order | ID | Start | Entry flow | Plaza intents |
|---:|---|---|---|---|
| 1 | NPC06 | N01 | N01 | JOG → PLAZA_TRANSIT → EXIT |
| 2 | NPC04 | N03 | N03 | CAFE_VISIT → EXIT |
| 3 | NPC02 | N16 | N16 | FACILITY_VISIT → EXIT |
| 4 | NPC33 | N05 | N02 | COMMUTE → EXIT |
| 5 | NPC28 | N15 | N16 | MANHOLE_TAMPER → EXIT |
| 6 | NPC01 | N02 | N02 | PARK_WALK → BENCH_REST → EXIT |
| 7 | NPC05 | N07 | N16 | THREATEN → ESCAPE |
| 8 | NPC22 | N12 | N03 | BENCH_REST → EXIT |
| 9 | NPC13 | N04 | N01 | PARK_WALK → PLAZA_TRANSIT → EXIT |
| 10 | NPC16 | N08 | N16 | RUN → FACILITY_VISIT → EXIT |
| 11 | NPC08 | N09 | N01 | SNATCH → ESCAPE |
| 12 | NPC23 | N10 | N02 | WAIT → LOOK_AROUND → EXIT |
| 13 | NPC29 | N18 | N03 | CAFE_VISIT → COMMUTE → EXIT |
| 14 | NPC35 | N28 | N16 | FACILITY_REPAIR → EXIT |
| 15 | NPC17 | N11 | N01 | IDLE → VANDALIZE → ESCAPE |

## 3. Results

| Active | Result | Spawned | Exited / completed | Watchdog reports | Unique stalled | Recovered | Unrecovered | Max no-progress | Fixed collision | NPC overlap | History |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 5 | PASS | 5 | 5 | 0 | 0 | 0 | 0 | 0.00s | 0 | 0 | PASS |
| 8 | FAIL | 8 | 5 | 160 | 3 | 0 | 3 | 112.95s | 0 | 0 | PASS |
| 10 | FAIL | 10 | 6 | 214 | 4 | 0 | 4 | 114.80s | 0 | 0 | PASS |
| 12 | FAIL | 12 | 7 | 269 | 5 | 0 | 5 | 118.55s | 0 | 0 | PASS |
| 15 | FAIL | 15 | 7 | 436 | 8 | 0 | 8 | 118.55s | 0 | 0 | PASS |

All levels had:

```text
pathfinding failure = 0
invalid destination = 0
runtime exception = 0
behaviorHistory issue = 0
```

Watchdog report count is the number of repeated 2-second observations, not the number of unique stall episodes.

## 4. Stall Analysis

| Active | Unrecovered NPCs | Observed cause |
|---:|---|---|
| 5 | — | No stall report |
| 8 | NPC04, NPC06, NPC22 | Opposing movement on the N04↔N09 axis; no actor can obtain physical clearance |
| 10 | NPC04, NPC06, NPC13, NPC22 | Same opposing flow, with an additional forward mover queued |
| 12 | NPC04, NPC06, NPC08, NPC13, NPC22 | The blocked chain extends toward N09↔N12 |
| 15 | NPC02, NPC04, NPC06, NPC08, NPC13, NPC16, NPC22, NPC35 | Previous chain plus opposing Facility flow on N08↔N15 |

Temporary watchdog stalls that later recovered: **0**.  
Unrecovered stalls are actors still active after 120 seconds with at least 20 continuous seconds of no movement. No teleport, collision bypass, footprint reduction, speed change, or watchdog relaxation was applied.

## 5. Exit Distribution

Only completed itineraries are counted.

| Active | N24 | N25 | N26 |
|---:|---:|---:|---:|
| 5 | 2 | 1 | 2 |
| 8 | 0 | 3 | 2 |
| 10 | 0 | 3 | 3 |
| 12 | 0 | 4 | 3 |
| 15 | 1 | 4 | 2 |

Entry-flow distributions were:

```text
5  : N01=1, N02=1, N03=1, N16=2
8  : N01=1, N02=2, N03=2, N16=3
10 : N01=2, N02=2, N03=2, N16=4
12 : N01=3, N02=3, N03=2, N16=4
15 : N01=4, N02=3, N03=3, N16=5
```

## 6. Door Completion

| Active | Cafe completed | Facility completed |
|---:|---:|---:|
| 5 | 1 | 1 |
| 8 | 0 | 1 |
| 10 | 0 | 2 |
| 12 | 0 | 2 |
| 15 | 1 | 1 |

Lower completion at failed levels is a consequence of unrecovered upstream stalls, not a pathfinding or destination-resolution error.

## 7. Browser Visual Smoke

Open the app with `?map=v2`, enter **Plaza & Park**, then select one of:

- `v2 Supervised · 5 NPC`
- `v2 Supervised · 10 NPC`
- `v2 Supervised · 15 NPC`

The validation mode moves the inspection actor to W21 so it does not block N02 entry flow. Debug labels show ID/current intent, green footprints show active actors, and red footprints show watchdog stalled candidates.

Direct browser smoke on 2026-09-14 confirmed all three selectors and live status output. The 5-NPC mode started with `Active 5 / Stalled candidates 0`; after 24 real-time seconds the 10-NPC mode showed `Active 4 / Exited 6 / Stalled candidates 4`, and the 15-NPC mode showed `Active 8 / Exited 7 / Stalled candidates 8`. Browser warning/error console output was empty. These short visual observations agree with the deterministic headless runs but do not replace their independent 120-s simulation measurements.

## 8. Verdict and Known Limitations

- 5 active NPC: PASS for this deterministic scenario.
- 8/10/12/15 active NPC: FAIL due to unrecovered opposing-flow stalls.
- This experiment does **not** establish the final active NPC count.
- The scenario is one deterministic mixed-intent sample per level, not a full permutation sweep.
- Later actors use distinct in-progress graph starts; this is an active-density test, not a simultaneous same-entry spawn-load test.
- Browser visual modes are for human inspection; headless results do not claim rendering FPS.
- The watchdog threshold remains a prototype initial value.
- No movement fix was implemented as part of this validation.
