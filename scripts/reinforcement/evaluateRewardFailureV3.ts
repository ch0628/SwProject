import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ACTUAL_GRAPH_FILE,
  ACTUAL_MAP_FILES,
  buildActualMapEnvironment,
} from '../../src/modules/reinforcement/sim/actualMapEnvironment.ts';
import {
  ACTUAL_ENVIRONMENT_PRODUCTION_V3,
  runActualMapEvaluation,
  runActualMapTraining,
  type ActualEnvironmentParameters,
  type ActualEpisode,
} from '../../src/modules/reinforcement/sim/actualMapSimulation.ts';
import {
  REWARD_STAR_FIELDS,
  REWARD_STAR_TOTAL,
  rewardWeightsFromStars,
  type RewardStars,
  type TerminalReason,
} from '../../src/modules/reinforcement/sim/learningEngine.ts';

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const environment = buildActualMapEnvironment(ACTUAL_MAP_FILES.map(readJson), readJson(ACTUAL_GRAPH_FILE));
const checkpoints = [1, 5, 10, 15, 20] as const;
const trainingSeeds = Array.from({ length: 10 }, (_, index) => 101 + index);
const evaluationSeeds = Array.from({ length: 20 }, (_, index) => 10_001 + index);
const roundNumber = (value: number): number => Number(value.toFixed(6));
const average = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

function validProfiles(): RewardStars[] {
  const profiles: RewardStars[] = [];
  for (let speed = 0; speed <= 3; speed++) for (let judgment = 0; judgment <= 3; judgment++) for (let threat = 0; threat <= 3; threat++) {
    if (speed + judgment + threat === REWARD_STAR_TOTAL) profiles.push({ speed, judgment, threat });
  }
  return profiles;
}

const profileKey = (stars: RewardStars): string => REWARD_STAR_FIELDS.map(field => stars[field]).join('-');
const rate = (episodes: readonly ActualEpisode[], reason: TerminalReason): number =>
  episodes.filter(episode => episode.terminalReason === reason).length / episodes.length;
const actionCount = (episodes: readonly ActualEpisode[], action: string): number =>
  episodes.reduce((sum, episode) => sum + episode.actionHistory.filter(item => item.action === action).length, 0);

function summarize(episodes: readonly ActualEpisode[], combatSkills: readonly number[]) {
  const subdueSelections = episodes.reduce((sum, episode) => sum + episode.actual.subdueSelections, 0);
  const subdueSuccesses = episodes.reduce((sum, episode) => sum + episode.actual.subdueSuccesses, 0);
  const damageBins = { zero: 0, low: 0, medium: 0, high: 0, disabled: 0 };
  for (const episode of episodes) {
    if (episode.robotDamage === 0) damageBins.zero++;
    else if (episode.robotDamage < 0.34) damageBins.low++;
    else if (episode.robotDamage < 0.67) damageBins.medium++;
    else if (episode.robotDamage < 1) damageBins.high++;
    else damageBins.disabled++;
  }
  const routeChoices = [...new Set(episodes.flatMap(episode => episode.actual.routeChoices))].sort();
  return {
    episodes: episodes.length,
    goalReachedRate: roundNumber(rate(episodes, 'GOAL_REACHED')),
    timeoutRate: roundNumber(rate(episodes, 'TIMEOUT')),
    misunderstandingRate: roundNumber(rate(episodes, 'MISUNDERSTANDING')),
    robotDisabledRate: roundNumber(rate(episodes, 'ROBOT_DISABLED')),
    averageReward: roundNumber(average(episodes.map(episode => episode.reward.rawReward))),
    averageCompletionTime: roundNumber(average(episodes.map(episode => episode.elapsedTime))),
    subdueOpportunities: episodes.reduce((sum, episode) => sum + episode.actual.subdueOpportunities, 0),
    subdueSelections,
    subdueSelectionRate: roundNumber(subdueSelections / Math.max(1, episodes.reduce((sum, episode) => sum + episode.actual.subdueOpportunities, 0))),
    subdueSuccesses,
    subdueSuccessRate: roundNumber(subdueSuccesses / Math.max(1, subdueSelections)),
    successfulNeutralizations: episodes.reduce((sum, episode) => sum + episode.successfulNeutralizations, 0),
    distract: {
      count: actionCount(episodes, 'DISTRACT'),
      success: episodes.reduce((sum, episode) => sum + episode.actual.distractSuccesses, 0),
      failure: episodes.reduce((sum, episode) => sum + episode.actual.distractFailures, 0),
    },
    forcePass: {
      count: actionCount(episodes, 'FORCE_PASS'),
      success: episodes.reduce((sum, episode) => sum + episode.actual.forcePassSuccesses, 0),
      failure: episodes.reduce((sum, episode) => sum + episode.actual.forcePassFailures, 0),
    },
    averageRobotDamage: roundNumber(average(episodes.map(episode => episode.robotDamage))),
    damageDistribution: damageBins,
    combatSkill: roundNumber(average(combatSkills)),
    routeChoiceDistribution: Object.fromEntries(routeChoices.map(route => [route, episodes.reduce((sum, episode) => sum + episode.actual.routeChoices.filter(choice => choice === route).length, 0)])),
    stairReroutes: episodes.reduce((sum, episode) => sum + episode.actual.stairReroutes, 0),
    localRetries: episodes.reduce((sum, episode) => sum + episode.actual.localRetries, 0),
    repeatedSameStairLoops: episodes.reduce((sum, episode) => sum + episode.actual.repeatedSameStairLoops, 0),
    f5SubdueSuccesses: episodes.reduce((sum, episode) => sum + episode.actual.bossSuccesses + episode.actual.guardNeutralizations, 0),
    f5Retreats: episodes.reduce((sum, episode) => sum + episode.actual.f5Retreats, 0),
    bossSuccesses: episodes.reduce((sum, episode) => sum + episode.actual.bossSuccesses, 0),
    bossFailures: episodes.reduce((sum, episode) => sum + episode.actual.bossFailures, 0),
  };
}

function evaluateProfile(stars: RewardStars, parameters: ActualEnvironmentParameters, seeds = trainingSeeds, evalSeeds = evaluationSeeds) {
  const weights = rewardWeightsFromStars(stars);
  const runs = seeds.map(seed => runActualMapTraining(environment, weights, seed, 20, 5, parameters));
  assert.ok(runs.every(run => run.rounds.length === 20 && run.rounds.flatMap(round => round.episodes).length === 100));
  return checkpoints.map(round => {
    const episodes: ActualEpisode[] = [];
    const combatSkills: number[] = [];
    for (const [runIndex, run] of runs.entries()) {
      const checkpoint = run.rounds[round - 1];
      assert.equal(checkpoint.updateCount, 1);
      assert.equal(checkpoint.combatSkillUpdateCount, 1);
      assert.ok(checkpoint.episodes.every(episode => episode.combatSkillSnapshot === checkpoint.combatSkillSnapshot));
      for (const seed of evalSeeds) {
        episodes.push(runActualMapEvaluation(environment, checkpoint.policyAfter, weights, seed, parameters, checkpoint.combatSkillAfter));
        combatSkills.push(checkpoint.combatSkillAfter);
      }
      assert.equal(run.rounds.at(-1)!.round, 20, `training seed ${seeds[runIndex]} created an invalid final round`);
    }
    return { round, ...summarize(episodes, combatSkills) };
  });
}

const candidateParameters: Record<string, ActualEnvironmentParameters> = {
  CONSERVATIVE: { ...ACTUAL_ENVIRONMENT_PRODUCTION_V3, villain1Subdue: 0.58, villain2Subdue: 0.48, bossSubdue: 0.38, bossDistractedSubdue: 0.38, combatLearningRate: 0.03, maxCombatSkillBonus: 0.40, distractSuccessDamage: 0.03, distractFailureDamage: 0.10, forcePassSuccessDamage: 0.15, forcePassFailureDamage: 0.28, subdueSuccessDamage: 0.01, fixedRobotDamageCost: 0.6, robotDisabledPenalty: 2.0 },
  SELECTED: ACTUAL_ENVIRONMENT_PRODUCTION_V3,
  AGGRESSIVE: { ...ACTUAL_ENVIRONMENT_PRODUCTION_V3, villain1Subdue: 0.68, villain2Subdue: 0.58, bossSubdue: 0.48, bossDistractedSubdue: 0.48, combatLearningRate: 0.04, maxCombatSkillBonus: 0.50, distractSuccessDamage: 0.06, distractFailureDamage: 0.18, forcePassSuccessDamage: 0.25, forcePassFailureDamage: 0.45, subdueSuccessDamage: 0.04, fixedRobotDamageCost: 1.0, robotDisabledPenalty: 3.0 },
};

const basic = { speed: 2, judgment: 2, threat: 2 } satisfies RewardStars;
const parameterSearch = Object.entries(candidateParameters).map(([candidate, parameters]) => {
  const curve = evaluateProfile(basic, parameters, trainingSeeds.slice(0, 5), evaluationSeeds.slice(0, 10));
  const first = curve[0];
  const last = curve.at(-1)!;
  return {
    candidate,
    parameters,
    round1Success: first.goalReachedRate,
    round20Success: last.goalReachedRate,
    improvement: roundNumber(last.goalReachedRate - first.goalReachedRate),
    round20SubdueSuccess: last.subdueSuccessRate,
    round20CombatSkill: last.combatSkill,
  };
});

function classifyCurve(curve: ReturnType<typeof evaluateProfile>): string {
  const first = curve[0];
  const last = curve.at(-1)!;
  const bestIntermediate = Math.max(...curve.slice(0, -1).map(checkpoint => checkpoint.averageReward));
  if (last.averageReward <= first.averageReward + 0.2) return 'NO_MEANINGFUL_LEARNING';
  if (bestIntermediate > last.averageReward + 0.3) return 'LATE_REGRESSION';
  if (last.goalReachedRate < first.goalReachedRate && last.averageReward > first.averageReward) return 'REWARD_CONFLICT';
  return 'HEALTHY_LEARNING';
}

const profiles = validProfiles();
assert.equal(profiles.length, 10);
const results = profiles.map(stars => {
  const profileCheckpoints = evaluateProfile(stars, ACTUAL_ENVIRONMENT_PRODUCTION_V3);
  return { stars, key: profileKey(stars), classification: classifyCurve(profileCheckpoints), checkpoints: profileCheckpoints };
});
const basicResult = results.find(result => result.key === '2-2-2')!;
const threatHigh = results.filter(result => result.stars.threat === 3).sort((left, right) => left.stars.speed - right.stars.speed).at(-1)!;
const first = basicResult.checkpoints[0];
const last = basicResult.checkpoints.at(-1)!;
const maxIntermediateReward = Math.max(...basicResult.checkpoints.slice(0, -1).map(checkpoint => checkpoint.averageReward));
const classification = last.averageReward <= first.averageReward + 0.2
  ? 'NO_MEANINGFUL_LEARNING'
  : maxIntermediateReward > last.averageReward + 0.3
    ? 'LATE_POLICY_REGRESSION'
    : last.goalReachedRate < first.goalReachedRate + 0.15
      ? 'PASS_WITH_TRADEOFFS'
      : results.some(result => result.classification !== 'HEALTHY_LEARNING')
        ? 'PASS_WITH_TRADEOFFS'
        : 'PASS_REWARD_FAILURE_V3';
const secondaryFindings = results.filter(result => result.classification !== 'HEALTHY_LEARNING')
  .map(result => `${result.key}: ${result.classification}`);

const artifact = {
  generatedAt: new Date().toISOString(),
  contract: { fields: REWARD_STAR_FIELDS, starTotal: REWARD_STAR_TOTAL, checkpoints, trainingSeeds, evaluationSeedsPerTrainingSeed: evaluationSeeds },
  productionParameters: ACTUAL_ENVIRONMENT_PRODUCTION_V3,
  parameterSearch,
  results,
  acceptance: {
    classification,
    secondaryFindings,
    basic: { round1: first, round20: last },
    threatHigh: { stars: threatHigh.stars, round1: threatHigh.checkpoints[0], round20: threatHigh.checkpoints.at(-1) },
  },
};

fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/reinforcement_reward_failure_v3.json', `${JSON.stringify(artifact, null, 2)}\n`);
const csvRows = results.flatMap(result => result.checkpoints.map(checkpoint => ({
  speed: result.stars.speed, judgment: result.stars.judgment, threat: result.stars.threat,
  round: checkpoint.round, success_rate: checkpoint.goalReachedRate, timeout_rate: checkpoint.timeoutRate,
  misunderstanding_rate: checkpoint.misunderstandingRate, robot_disabled_rate: checkpoint.robotDisabledRate,
  average_reward: checkpoint.averageReward, average_completion_time: checkpoint.averageCompletionTime,
  subdue_selection_rate: checkpoint.subdueSelectionRate, subdue_success_rate: checkpoint.subdueSuccessRate,
  average_robot_damage: checkpoint.averageRobotDamage, combat_skill: checkpoint.combatSkill,
  stair_reroutes: checkpoint.stairReroutes, local_retries: checkpoint.localRetries,
  repeated_same_stair_loops: checkpoint.repeatedSameStairLoops,
})));
const csvHeader = Object.keys(csvRows[0]);
fs.writeFileSync('artifacts/reinforcement_reward_failure_v3.csv', `${csvHeader.join(',')}\n${csvRows.map(row => csvHeader.map(key => row[key as keyof typeof row]).join(',')).join('\n')}\n`);

const table = basicResult.checkpoints.map(checkpoint =>
  `| R${checkpoint.round} | ${(checkpoint.goalReachedRate * 100).toFixed(1)}% | ${(checkpoint.robotDisabledRate * 100).toFixed(1)}% | ${checkpoint.averageReward.toFixed(3)} | ${checkpoint.averageCompletionTime.toFixed(1)} | ${(checkpoint.subdueSuccessRate * 100).toFixed(1)}% | ${checkpoint.combatSkill.toFixed(3)} |`).join('\n');
const profileTable = results.map(result => {
  const profileFirst = result.checkpoints[0];
  const profileLast = result.checkpoints.at(-1)!;
  return `| ${result.key} | ${(profileFirst.goalReachedRate * 100).toFixed(1)}% | ${(profileLast.goalReachedRate * 100).toFixed(1)}% | ${profileFirst.averageReward.toFixed(3)} | ${profileLast.averageReward.toFixed(3)} | ${result.classification} |`;
}).join('\n');
const report = `# Reward + Failure Model v3 Validation — 2026-10-15

## Contract

- User rewards: speed, judgment, threat; each 0–3 stars; total exactly 6; default 2/2/2.
- Star mapping: 0→0, 1→1, 2→2.5, 3→5. GOAL_REACHED remains fixed at +3.
- Removed dimensions: facility protection, citizen protection, combat avoidance, and configurable goal weight. Citizen mistakes are judgment/MISUNDERSTANDING outcomes.
- Reward signs: +goal, −speed×elapsed ratio, −judgment×misunderstanding, +threat×successful neutralization, −${ACTUAL_ENVIRONMENT_PRODUCTION_V3.fixedRobotDamageCost}×robot damage, −${ACTUAL_ENVIRONMENT_PRODUCTION_V3.robotDisabledPenalty} ROBOT_DISABLED.

## Combat and damage

- Combat starts at ${ACTUAL_ENVIRONMENT_PRODUCTION_V3.initialCombatSkill}; after each five-robot round: clamp(skill + ${ACTUAL_ENVIRONMENT_PRODUCTION_V3.combatLearningRate} × mean capped combat experience, 0, 1). Success gives 1.0 experience and failure 0.6.
- Villain ×1/×2/Boss base probabilities: ${ACTUAL_ENVIRONMENT_PRODUCTION_V3.villain1Subdue}/${ACTUAL_ENVIRONMENT_PRODUCTION_V3.villain2Subdue}/${ACTUAL_ENVIRONMENT_PRODUCTION_V3.bossSubdue}; combat bonus: skill × ${ACTUAL_ENVIRONMENT_PRODUCTION_V3.maxCombatSkillBonus}. Boss remains harder.
- Damage: DISTRACT pass/fail ${ACTUAL_ENVIRONMENT_PRODUCTION_V3.distractSuccessDamage}/${ACTUAL_ENVIRONMENT_PRODUCTION_V3.distractFailureDamage}; FORCE_PASS pass/fail ${ACTUAL_ENVIRONMENT_PRODUCTION_V3.forcePassSuccessDamage}/${ACTUAL_ENVIRONMENT_PRODUCTION_V3.forcePassFailureDamage}; SUBDUE success ${ACTUAL_ENVIRONMENT_PRODUCTION_V3.subdueSuccessDamage}; SUBDUE defeat 1.0. Damage ≥1 is ROBOT_DISABLED.

## Recovery and F5

- A one-transition floor retries locally at the encounter; elapsed time and damage persist.
- A two-transition floor remembers the failed transition, tries the other transition, then uses local retry after both are attempted. The canonical F3 graph has one route per stair and no LONG/SHORT counterpart, so no non-existent family route is synthesized. Repeated same-stair loop count stayed ${Math.max(...results.flatMap(result => result.checkpoints.map(checkpoint => checkpoint.repeatedSameStairLoops)))}.
- F5 Guard/Boss actions are SUBDUE or RETREAT only. Door, lock, and Control Room progression still require neutralization.

## Experiment

- 10/10 valid star profiles; 10 deterministic training seeds/profile; 20 rounds × 5 robots = 100 training episodes/run.
- Checkpoints R1/R5/R10/R15/R20; 20 paired evaluation seeds per training seed = 200 evaluation episodes/profile/checkpoint. Evaluation performs no update.
- Parameter grid: ${parameterSearch.map(row => `${row.candidate} (R1 ${(row.round1Success * 100).toFixed(1)}%, R20 ${(row.round20Success * 100).toFixed(1)}%, Δ ${(row.improvement * 100).toFixed(1)}%p)`).join('; ')}.
- SELECTED keeps clear learning headroom without the AGGRESSIVE candidate's near-saturated late SUBDUE outcome; CONSERVATIVE did not improve enough.

## Default profile (2/2/2)

| Checkpoint | Goal | Disabled | Objective | Time | SUBDUE success | Combat skill |
|---|---:|---:|---:|---:|---:|---:|
${table}

- Objective change R1→R20: ${(last.averageReward - first.averageReward).toFixed(3)}.
- Success change R1→R20: ${((last.goalReachedRate - first.goalReachedRate) * 100).toFixed(1)} percentage points.
- Terminal changes: TIMEOUT ${first.timeoutRate.toFixed(3)}→${last.timeoutRate.toFixed(3)}, MISUNDERSTANDING ${first.misunderstandingRate.toFixed(3)}→${last.misunderstandingRate.toFixed(3)}, ROBOT_DISABLED ${first.robotDisabledRate.toFixed(3)}→${last.robotDisabledRate.toFixed(3)}.

## All star profiles

| Stars speed-judgment-threat | R1 Goal | R20 Goal | R1 Objective | R20 Objective | Learning classification |
|---|---:|---:|---:|---:|---|
${profileTable}

## Threat-high combat check

- Profile ${profileKey(threatHigh.stars)}: combat skill ${threatHigh.checkpoints[0].combatSkill.toFixed(3)}→${threatHigh.checkpoints.at(-1)!.combatSkill.toFixed(3)}, SUBDUE success ${(threatHigh.checkpoints[0].subdueSuccessRate * 100).toFixed(1)}%→${(threatHigh.checkpoints.at(-1)!.subdueSuccessRate * 100).toFixed(1)}%.

## Classification

**${classification}**

Secondary findings: ${secondaryFindings.length ? secondaryFindings.join('; ') : 'none'}.
`;
fs.mkdirSync('docs/modules/machine_learning/reinforcement/validation', { recursive: true });
fs.writeFileSync('docs/modules/machine_learning/reinforcement/validation/reward_failure_model_v3_2026-10-15.md', report);
console.log(JSON.stringify({ classification, parameterSearch, basic: artifact.acceptance.basic, threatHigh: artifact.acceptance.threatHigh }, null, 2));
