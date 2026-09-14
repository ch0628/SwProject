# Plaza/Park v2 — Round 1 Foundation Validation (Current)

Date: 2026-09-14  
Scope: recovery/finalization of the current Round 1 foundation only

## 1. Source of Truth / Map Gate

- Map: `public/maps/plaza-park-v2.tmj`
- Navigation v2 topology, Collision/Fence, N01~N28, E01~E33 and SP1~SP10 were preserved.
- Camera Coverage objects are exactly `PLAZA_CAM_A` through `PLAZA_CAM_E` (5 rectangles).
- The latest authored Scenario Point positions were loaded from the TMJ. The A group is:

| Point | x | y |
|---|---:|---:|
| A_STATIC_01 | 439.833333333337 | 298.166666666667 |
| A_STATIC_02 | 729.333333333333 | 561.333333333333 |
| A_STAY_01 | 486.666666666667 | 274.666666666667 |
| A_STAY_02 | 528 | 558.666666666667 |
| A_ACTION_01 | 808 | 218.666666666667 |

- All 23 approved Scenario Points are unique Point Objects, accept the Large 26x16 footprint, are pairwise non-overlapping, and have collision-safe authored local connectors.
- Scenario Point ↔ existing SP overlap: 0. Fixed-collision overlap: 0. Navigation topology was not changed during recovery.

## 2. Implemented Round 1 foundation

- `src/plazaRound1.ts`: 35 persistent identity runtime and approved Round 1 assignments.
- `src/plazaLaneRuntime.ts`: authored Scenario Point movement plans using the existing lane/transition and reservation coordination.
- `src/cctvManualLabeling.ts`: five-camera loader and distinct manual/verified sample counters.
- `src/PlazaParkScene.ts`: Round 1 stepping, lifecycle rendering, camera fit, selection and label integration.
- `src/main.tsx`: current labeling/verification counters.

Assignment distribution is exactly 35 NPC, 28 Citizen / 7 Villain, 7 NPC per home observation zone, with lifecycle counts 10 STATIC, 10 ENTER_AND_STAY, 10 ENTER_HOLD_EXIT and 5 THROUGH_TRAFFIC.

## 3. Runtime and safety results

- Deterministic 600-second probe kept all 35 identities (no replacement population); 20 STATIC/STAY characters settled at authored points.
- HOLD_EXIT and THROUGH_TRAFFIC left the map and re-entered with the same identity.
- Peak road movers observed: 7 (runtime guardrail is 15).
- NPC overlap: 0. Fixed-collision overlap: 0. Road blocking/road-hold violation: 0 in the automated gates.
- Busy authored targets defer OFFSCREEN and retry without waiting on a road tile.
- `userLabel` remains mutable and separate from `verifiedLabel`; a label click alone does not create a verified training sample.

## 4. Recovery verification

| Check | Result |
|---|---|
| `npm test` | PASS — 67/67 |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| Existing 5/8/10/12/15 finite movement regression | PASS |
| Browser CCTV1~5 switch | PASS — headings A~E and nonzero visible counts observed |
| Browser character readability / top safe margin | PASS — CCTV5 screenshot readable; top characters visible |
| Browser selection clear after camera switch | PASS — current tab showed no selection after the sweep |
| Browser console warn/error | PASS — `[]` |
| Mutable Citizen/Villain label and persistence | PASS — retained from the preceding browser validation; no runtime edits occurred during recovery |

The browser check initially showed `수동 라벨 1/8`, `검증 표본 0/8`, `학습 준비 대기`. The recovery relabel test
changed NPC15 from Citizen to Villain and ended at `수동 라벨 2/8`, `검증 표본 0/8`, `학습 준비 대기`;
both states are expected without a verification interaction.

## 5. Known WARN / Known FAIL

- Known WARN: Vite reports the existing single JavaScript chunk is over 500 kB after minification.
- Known WARN: one exploratory 600-second 35-NPC probe recorded three transient watchdog/congestion diagnostics; it recovered without overlap, fixed collision, identity loss or a failed automated gate. This is not a claim of exhaustive all-permutation validation.
- Known WARN: the finite 15-NPC reference reports `maxContinuousNoProgressSeconds = 0.95` while remaining PASS; no unrecovered stall is reported.
- Known WARN: that same 15-NPC reference records 26 junction-transition conflict observations and one stop-reservation conflict/deferred behavior while resolving; the gate still reports PASS with zero overlap/fixed-collision violations.
- Known WARN: `trainingReady` remains false until eight distinct verified samples with label diversity exist. `userLabel` alone is intentionally insufficient; Tracking Review/verification UI is out of scope for this recovery.
- Known FAIL: none observed in the recovery checks.

Historical 2-camera evidence remains unchanged in `plaza_park_cctv_manual_labeling_validation.md`.

## 6. Explicit scope exclusions

`FIRST_TRAINING` cutscene, Round 2, `aiLabel`, `HUMAN_AI_COMPARE`, Tracking Review, RETRAINING, `AI_ASSISTED_MONITORING` and `FINAL_SCAN` were not implemented in this recovery.
