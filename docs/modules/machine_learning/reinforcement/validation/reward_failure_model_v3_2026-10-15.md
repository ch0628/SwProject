# Reward + Failure Model v3 Validation — 2026-10-15

## Contract

- User rewards: speed, judgment, threat; each 0–3 stars; total exactly 6; default 2/2/2.
- Star mapping: 0→0, 1→1, 2→2.5, 3→5. GOAL_REACHED remains fixed at +3.
- Removed dimensions: facility protection, citizen protection, combat avoidance, and configurable goal weight. Citizen mistakes are judgment/MISUNDERSTANDING outcomes.
- Reward signs: +goal, −speed×elapsed ratio, −judgment×misunderstanding, +threat×successful neutralization, −0.8×robot damage, −2.5 ROBOT_DISABLED.

## Combat and damage

- Combat starts at 0.1; after each five-robot round: clamp(skill + 0.035 × mean capped combat experience, 0, 1). Success gives 1.0 experience and failure 0.6.
- Villain ×1/×2/Boss base probabilities: 0.62/0.52/0.42; combat bonus: skill × 0.45. Boss remains harder.
- Damage: DISTRACT pass/fail 0.04/0.12; FORCE_PASS pass/fail 0.18/0.32; SUBDUE success 0.02; SUBDUE defeat 1.0. Damage ≥1 is ROBOT_DISABLED.

## Recovery and F5

- A one-transition floor retries locally at the encounter; elapsed time and damage persist.
- A two-transition floor remembers the failed transition, tries the other transition, then uses local retry after both are attempted. The canonical F3 graph has one route per stair and no LONG/SHORT counterpart, so no non-existent family route is synthesized. Repeated same-stair loop count stayed 0.
- F5 Guard/Boss actions are SUBDUE or RETREAT only. Door, lock, and Control Room progression still require neutralization.

## Experiment

- 10/10 valid star profiles; 10 deterministic training seeds/profile; 20 rounds × 5 robots = 100 training episodes/run.
- Checkpoints R1/R5/R10/R15/R20; 20 paired evaluation seeds per training seed = 200 evaluation episodes/profile/checkpoint. Evaluation performs no update.
- Parameter grid: CONSERVATIVE (R1 0.0%, R20 2.0%, Δ 2.0%p); SELECTED (R1 0.0%, R20 20.0%, Δ 20.0%p); AGGRESSIVE (R1 0.0%, R20 68.0%, Δ 68.0%p).
- SELECTED keeps clear learning headroom without the AGGRESSIVE candidate's near-saturated late SUBDUE outcome; CONSERVATIVE did not improve enough.

## Default profile (2/2/2)

| Checkpoint | Goal | Disabled | Objective | Time | SUBDUE success | Combat skill |
|---|---:|---:|---:|---:|---:|---:|
| R1 | 5.0% | 60.5% | -3.126 | 366.2 | 59.5% | 0.126 |
| R5 | 7.5% | 63.5% | -2.812 | 348.3 | 68.0% | 0.237 |
| R10 | 8.5% | 74.5% | -2.791 | 337.5 | 68.4% | 0.380 |
| R15 | 22.5% | 63.5% | -1.697 | 348.4 | 77.5% | 0.524 |
| R20 | 28.5% | 57.0% | -1.067 | 360.9 | 84.1% | 0.681 |

- Objective change R1→R20: 2.059.
- Success change R1→R20: 23.5 percentage points.
- Terminal changes: TIMEOUT 0.105→0.015, MISUNDERSTANDING 0.240→0.130, ROBOT_DISABLED 0.605→0.570.

## All star profiles

| Stars speed-judgment-threat | R1 Goal | R20 Goal | R1 Objective | R20 Objective | Learning classification |
|---|---:|---:|---:|---:|---|
| 0-3-3 | 4.0% | 34.5% | -2.312 | 2.015 | HEALTHY_LEARNING |
| 1-2-3 | 4.0% | 32.0% | -2.167 | 1.374 | HEALTHY_LEARNING |
| 1-3-2 | 4.5% | 35.5% | -3.122 | 0.020 | HEALTHY_LEARNING |
| 2-1-3 | 4.5% | 25.5% | -2.363 | 0.406 | HEALTHY_LEARNING |
| 2-2-2 | 5.0% | 28.5% | -3.126 | -1.067 | HEALTHY_LEARNING |
| 2-3-1 | 5.0% | 42.0% | -3.983 | -1.387 | HEALTHY_LEARNING |
| 3-0-3 | 2.5% | 29.5% | -3.224 | 0.096 | HEALTHY_LEARNING |
| 3-1-2 | 4.5% | 28.0% | -3.720 | -1.642 | HEALTHY_LEARNING |
| 3-2-1 | 5.0% | 34.5% | -4.421 | -2.648 | HEALTHY_LEARNING |
| 3-3-0 | 5.0% | 5.5% | -5.238 | -5.217 | NO_MEANINGFUL_LEARNING |

## Threat-high combat check

- Profile 3-0-3: combat skill 0.126→0.654, SUBDUE success 53.1%→86.8%.

## Classification

**PASS_WITH_TRADEOFFS**

Secondary findings: 3-3-0: NO_MEANINGFUL_LEARNING.
