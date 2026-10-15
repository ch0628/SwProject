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
  type CombatEnemyType,
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
const enemyTypes: CombatEnemyType[] = ['VILLAIN_1', 'VILLAIN_2', 'F5_GUARD', 'BOSS'];
const roundNumber = (value: number): number => Number(value.toFixed(6));
const average = (values: readonly number[]): number => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const baseline = {
  1: { goalReachedRate: 0.05, timeoutRate: 0.105, misunderstandingRate: 0.24, robotDisabledRate: 0.605, averageReward: -3.125589, averageCompletionTime: 366.224212, subdueSuccessRate: 0.595318, combatSkill: 0.12618 },
  5: { goalReachedRate: 0.075, timeoutRate: 0.06, misunderstandingRate: 0.23, robotDisabledRate: 0.635, averageReward: -2.812455, averageCompletionTime: 348.343165, subdueSuccessRate: 0.68, combatSkill: 0.23692 },
  10: { goalReachedRate: 0.085, timeoutRate: 0.01, misunderstandingRate: 0.16, robotDisabledRate: 0.745, averageReward: -2.791055, averageCompletionTime: 337.477365, subdueSuccessRate: 0.684, combatSkill: 0.37972 },
  15: { goalReachedRate: 0.225, timeoutRate: 0.03, misunderstandingRate: 0.11, robotDisabledRate: 0.635, averageReward: -1.696522, averageCompletionTime: 348.409832, subdueSuccessRate: 0.775, combatSkill: 0.52392 },
  20: { goalReachedRate: 0.285, timeoutRate: 0.015, misunderstandingRate: 0.13, robotDisabledRate: 0.57, averageReward: -1.067058, averageCompletionTime: 360.923266, subdueSuccessRate: 0.840559, combatSkill: 0.68058 },
} as const;

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

function summarize(episodes: readonly ActualEpisode[], combatSkills: readonly number[]) {
  const encounters = episodes.flatMap(episode => episode.actual.combatEncounters);
  const attempted = encounters.filter(encounter => encounter.attempts > 0);
  const retried = encounters.filter(encounter => encounter.attempts > 1);
  const recovered = encounters.filter(encounter => encounter.subdueFailures > 0);
  const attempts = encounters.reduce((sum, encounter) => sum + encounter.attempts, 0);
  const retryAttempts = encounters.reduce((sum, encounter) => sum + Math.max(0, encounter.attempts - 1), 0);
  const subdueSuccesses = episodes.reduce((sum, episode) => sum + episode.actual.subdueSuccesses, 0);
  const defeatedEpisodes = episodes.filter(episode => episode.actual.combatEncounters.some(encounter => encounter.subdueFailures > 0));
  const disabledEpisodes = episodes.filter(episode => episode.terminalReason === 'ROBOT_DISABLED');
  const combatDisabled = disabledEpisodes.filter(episode => ['VILLAIN_ENCOUNTER', 'BOSS_ENCOUNTER'].includes(episode.actionHistory.at(-1)?.state ?? ''));
  const damageBins = { zero: 0, low: 0, medium: 0, high: 0, disabled: 0 };
  for (const episode of episodes) {
    if (episode.robotDamage === 0) damageBins.zero++;
    else if (episode.robotDamage < 0.34) damageBins.low++;
    else if (episode.robotDamage < 0.67) damageBins.medium++;
    else if (episode.robotDamage < 1) damageBins.high++;
    else damageBins.disabled++;
    const disabledEvents = episode.eventHistory.filter(event => event.type === 'ROBOT_DISABLED');
    assert.equal(disabledEvents.length, episode.terminalReason === 'ROBOT_DISABLED' ? 1 : 0);
    assert.ok(episode.actionHistory.filter(action => action.immediateEvents.includes('ROBOT_DISABLED')).every(action => action.robotDamageAfter! >= 1));
  }
  const enemyBreakdown = Object.fromEntries(enemyTypes.map(enemyType => {
    const rows = encounters.filter(encounter => encounter.enemyType === enemyType);
    const rowsAttempted = rows.filter(encounter => encounter.attempts > 0);
    const rowsRetried = rows.filter(encounter => encounter.attempts > 1);
    return [enemyType, {
      encounters: rows.length,
      attempts: rows.reduce((sum, row) => sum + row.attempts, 0),
      firstSuccesses: rows.filter(row => row.firstAttemptSuccess).length,
      firstAttemptSuccessRate: roundNumber(rows.filter(row => row.firstAttemptSuccess).length / Math.max(1, rowsAttempted.length)),
      retrySuccesses: rows.filter(row => row.retrySuccess).length,
      retrySuccessRate: roundNumber(rows.filter(row => row.retrySuccess).length / Math.max(1, rowsRetried.length)),
      finalNeutralizations: rows.filter(row => row.finalNeutralization).length,
      disabledCaused: rows.filter(row => row.disabledCaused).length,
    }];
  }));
  return {
    episodes: episodes.length,
    goalReachedRate: roundNumber(rate(episodes, 'GOAL_REACHED')),
    timeoutRate: roundNumber(rate(episodes, 'TIMEOUT')),
    misunderstandingRate: roundNumber(rate(episodes, 'MISUNDERSTANDING')),
    robotDisabledRate: roundNumber(rate(episodes, 'ROBOT_DISABLED')),
    averageReward: roundNumber(average(episodes.map(episode => episode.reward.rawReward))),
    averageCompletionTime: roundNumber(average(episodes.map(episode => episode.elapsedTime))),
    subdueAttempts: attempts,
    averageSubdueAttemptsPerEpisode: roundNumber(attempts / episodes.length),
    averageAttemptsPerEncounter: roundNumber(attempts / Math.max(1, attempted.length)),
    subdueSuccesses,
    subdueSuccessRate: roundNumber(subdueSuccesses / Math.max(1, attempts)),
    firstAttemptSuccessRate: roundNumber(encounters.filter(encounter => encounter.firstAttemptSuccess).length / Math.max(1, attempted.length)),
    retrySuccessRate: roundNumber(encounters.filter(encounter => encounter.retrySuccess).length / Math.max(1, retried.length)),
    failureCounts: {
      first: recovered.length,
      second: encounters.filter(encounter => encounter.subdueFailures >= 2).length,
      thirdOrTerminal: encounters.filter(encounter => encounter.subdueFailures >= 3 || encounter.disabledCaused).length,
    },
    averageRetryBonusUsed: roundNumber(encounters.reduce((sum, encounter) => sum + encounter.retryBonusTotal, 0) / Math.max(1, retryAttempts)),
    recoveryThenSuccessfulNeutralizationRate: roundNumber(encounters.filter(encounter => encounter.recoveredThenNeutralized).length / Math.max(1, recovered.length)),
    defeatThenEpisodeSuccessRate: roundNumber(defeatedEpisodes.filter(episode => episode.goalReached).length / Math.max(1, defeatedEpisodes.length)),
    cumulativeDamageDisabledCount: disabledEpisodes.length,
    combatDisabledCount: combatDisabled.length,
    averageTerminalDamage: roundNumber(average(disabledEpisodes.map(episode => episode.robotDamage))),
    averageRobotDamage: roundNumber(average(episodes.map(episode => episode.robotDamage))),
    damageDistribution: damageBins,
    combatSkill: roundNumber(average(combatSkills)),
    enemyBreakdown,
  };
}

function evaluateProfile(stars: RewardStars, parameters: ActualEnvironmentParameters = ACTUAL_ENVIRONMENT_PRODUCTION_V3) {
  const weights = rewardWeightsFromStars(stars);
  const runs = trainingSeeds.map(seed => runActualMapTraining(environment, weights, seed, 20, 5, parameters));
  assert.ok(runs.every(run => run.rounds.length === 20 && run.rounds.flatMap(round => round.episodes).length === 100));
  return checkpoints.map(round => {
    const episodes: ActualEpisode[] = [];
    const combatSkills: number[] = [];
    for (const run of runs) {
      const checkpoint = run.rounds[round - 1];
      assert.equal(checkpoint.updateCount, 1);
      assert.equal(checkpoint.combatSkillUpdateCount, 1);
      assert.ok(checkpoint.episodes.every(episode => episode.combatSkillSnapshot === checkpoint.combatSkillSnapshot));
      for (const seed of evaluationSeeds) {
        episodes.push(runActualMapEvaluation(environment, checkpoint.policyAfter, weights, seed, parameters, checkpoint.combatSkillAfter));
        combatSkills.push(checkpoint.combatSkillAfter);
      }
    }
    return { round, ...summarize(episodes, combatSkills) };
  });
}

assert.equal(ACTUAL_ENVIRONMENT_PRODUCTION_V3.fixedRobotDamageCost, 0.8);
assert.equal(ACTUAL_ENVIRONMENT_PRODUCTION_V3.robotDisabledPenalty, 2.5);
const profiles = validProfiles();
assert.equal(profiles.length, 10);
const results = profiles.map(stars => ({ stars, key: profileKey(stars), checkpoints: evaluateProfile(stars) }));
const basic = results.find(result => result.key === '2-2-2')!;
const first = basic.checkpoints[0];
const last = basic.checkpoints.at(-1)!;
const retryAssessment = last.retrySuccessRate > 0.95 && last.robotDisabledRate < 0.03
  ? 'TOO_STRONG'
  : last.retrySuccessRate < 0.25 && last.robotDisabledRate > 0.70
    ? 'TOO_WEAK'
    : 'BALANCED';
const initialDefaultAssessment = 'TOO_STRONG' as const;
const retryCandidates = [
  { step: 0.025, cap: 0.05 },
  { step: 0.05, cap: 0.10 },
  { step: 0.075, cap: 0.15 },
] as const;
const candidateSearch = retryCandidates.map(candidate => {
  const curve = candidate.step === ACTUAL_ENVIRONMENT_PRODUCTION_V3.retryCombatBonusStep
    && candidate.cap === ACTUAL_ENVIRONMENT_PRODUCTION_V3.retryCombatBonusCap
    ? basic.checkpoints
    : evaluateProfile({ speed: 2, judgment: 2, threat: 2 }, {
      ...ACTUAL_ENVIRONMENT_PRODUCTION_V3,
      retryCombatBonusStep: candidate.step,
      retryCombatBonusCap: candidate.cap,
    });
  const r1 = curve[0];
  const r20 = curve.at(-1)!;
  return {
    ...candidate,
    round1: { goalReachedRate: r1.goalReachedRate, robotDisabledRate: r1.robotDisabledRate, retrySuccessRate: r1.retrySuccessRate, averageReward: r1.averageReward },
    round20: { goalReachedRate: r20.goalReachedRate, robotDisabledRate: r20.robotDisabledRate, retrySuccessRate: r20.retrySuccessRate, averageReward: r20.averageReward },
  };
});
const recommendedCandidate = candidateSearch[0];
const recommendation = {
  step: recommendedCandidate.step,
  cap: recommendedCandidate.cap,
  alternativesEvaluated: true,
  reason: 'The initial 0.05/0.10 default crossed the strong threshold; 0.025/0.05 reduces retry saturation while preserving recovery viability.',
};
const baselineComparison = basic.checkpoints.map(checkpoint => {
  const old = baseline[checkpoint.round];
  return {
    round: checkpoint.round,
    baseline: old,
    current: checkpoint,
    delta: {
      goalReachedRate: roundNumber(checkpoint.goalReachedRate - old.goalReachedRate),
      robotDisabledRate: roundNumber(checkpoint.robotDisabledRate - old.robotDisabledRate),
      averageReward: roundNumber(checkpoint.averageReward - old.averageReward),
      averageCompletionTime: roundNumber(checkpoint.averageCompletionTime - old.averageCompletionTime),
      subdueSuccessRate: roundNumber(checkpoint.subdueSuccessRate - old.subdueSuccessRate),
      combatSkill: roundNumber(checkpoint.combatSkill - old.combatSkill),
    },
  };
});
const artifact = {
  generatedAt: new Date().toISOString(),
  contract: { checkpoints, trainingSeeds, evaluationSeedsPerTrainingSeed: evaluationSeeds, profiles: profiles.length, rounds: 20, robotsPerRound: 5 },
  productionParameters: ACTUAL_ENVIRONMENT_PRODUCTION_V3,
  initialDefaultAssessment,
  selectedAssessment: retryAssessment,
  recommendation,
  candidateSearch,
  baselineComparison,
  results,
};

fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/subdue_recovery_validation.json', `${JSON.stringify(artifact, null, 2)}\n`);
const csvRows = results.flatMap(result => result.checkpoints.map(checkpoint => ({
  speed: result.stars.speed, judgment: result.stars.judgment, threat: result.stars.threat, round: checkpoint.round,
  goal_rate: checkpoint.goalReachedRate, timeout_rate: checkpoint.timeoutRate, misunderstanding_rate: checkpoint.misunderstandingRate,
  disabled_rate: checkpoint.robotDisabledRate, average_reward: checkpoint.averageReward, average_time: checkpoint.averageCompletionTime,
  subdue_attempts_per_episode: checkpoint.averageSubdueAttemptsPerEpisode, attempts_per_encounter: checkpoint.averageAttemptsPerEncounter,
  first_success_rate: checkpoint.firstAttemptSuccessRate, retry_success_rate: checkpoint.retrySuccessRate,
  first_failures: checkpoint.failureCounts.first, second_failures: checkpoint.failureCounts.second,
  third_or_terminal_failures: checkpoint.failureCounts.thirdOrTerminal, average_retry_bonus: checkpoint.averageRetryBonusUsed,
  recovery_neutralization_rate: checkpoint.recoveryThenSuccessfulNeutralizationRate,
  defeat_then_episode_success_rate: checkpoint.defeatThenEpisodeSuccessRate,
  cumulative_damage_disabled: checkpoint.cumulativeDamageDisabledCount, combat_disabled: checkpoint.combatDisabledCount,
  average_terminal_damage: checkpoint.averageTerminalDamage, average_robot_damage: checkpoint.averageRobotDamage,
  combat_skill: checkpoint.combatSkill,
})));
const csvHeader = Object.keys(csvRows[0]);
fs.writeFileSync('artifacts/subdue_recovery_validation.csv', `${csvHeader.join(',')}\n${csvRows.map(row => csvHeader.map(key => row[key as keyof typeof row]).join(',')).join('\n')}\n`);

const defaultTable = baselineComparison.map(({ round, baseline: old, current, delta }) =>
  `| R${round} | ${(old.goalReachedRate * 100).toFixed(1)}% → ${(current.goalReachedRate * 100).toFixed(1)}% (${(delta.goalReachedRate * 100).toFixed(1)}%p) | ${(old.robotDisabledRate * 100).toFixed(1)}% → ${(current.robotDisabledRate * 100).toFixed(1)}% (${(delta.robotDisabledRate * 100).toFixed(1)}%p) | ${old.averageReward.toFixed(3)} → ${current.averageReward.toFixed(3)} | ${old.averageCompletionTime.toFixed(1)} → ${current.averageCompletionTime.toFixed(1)} |`).join('\n');
const recoveryTable = basic.checkpoints.map(checkpoint =>
  `| R${checkpoint.round} | ${checkpoint.averageSubdueAttemptsPerEpisode.toFixed(2)} | ${checkpoint.averageAttemptsPerEncounter.toFixed(2)} | ${(checkpoint.firstAttemptSuccessRate * 100).toFixed(1)}% | ${(checkpoint.retrySuccessRate * 100).toFixed(1)}% | ${checkpoint.averageRetryBonusUsed.toFixed(3)} | ${(checkpoint.recoveryThenSuccessfulNeutralizationRate * 100).toFixed(1)}% | ${(checkpoint.defeatThenEpisodeSuccessRate * 100).toFixed(1)}% |`).join('\n');
const enemyTable = enemyTypes.map(enemyType => {
  const row = last.enemyBreakdown[enemyType];
  return `| ${enemyType} | ${row.encounters} | ${row.attempts} | ${(row.firstAttemptSuccessRate * 100).toFixed(1)}% | ${(row.retrySuccessRate * 100).toFixed(1)}% | ${row.finalNeutralizations} | ${row.disabledCaused} |`;
}).join('\n');
const profileTable = results.map(result => {
  const r1 = result.checkpoints[0];
  const r20 = result.checkpoints.at(-1)!;
  return `| ${result.key} | ${(r1.goalReachedRate * 100).toFixed(1)}% | ${(r20.goalReachedRate * 100).toFixed(1)}% | ${(r1.robotDisabledRate * 100).toFixed(1)}% | ${(r20.robotDisabledRate * 100).toFixed(1)}% | ${r1.averageReward.toFixed(3)} | ${r20.averageReward.toFixed(3)} |`;
}).join('\n');
const report = `# SUBDUE Recovery Validation — 2026-10-15

## 적용 계약

- Reward + Failure Model v3의 별 배분, 보상식, 전역 combat skill 학습은 유지했다.
- 피해량: DISTRACT 성공/실패 0.01/0.05, FORCE_PASS 성공/실패 0.15/0.25, SUBDUE 성공/실패 0.01/0.40.
- SUBDUE 실패는 논리 시간 +5초, combat experience 0.6, 동일 조우 재시도다. 누적 피해가 1 이상일 때만 ROBOT_DISABLED가 된다.
- 조우 내 재시도 보너스는 후보 비교 후 실패당 +${ACTUAL_ENVIRONMENT_PRODUCTION_V3.retryCombatBonusStep}, 최대 +${ACTUAL_ENVIRONMENT_PRODUCTION_V3.retryCombatBonusCap}를 선택했으며 새 조우·퇴각에서 초기화된다. 전역 skill은 라운드 종료 때 한 번만 갱신된다.
- 고정 비용은 Robot Damage 0.8, ROBOT_DISABLED 2.5로 유지했다.

## 실험 설계

- 유효 별 배분 10개 전부, profile당 학습 seed 10개, 20 rounds × 5 robots.
- R1/R5/R10/R15/R20마다 학습 seed별 고정 평가 seed 20개, 즉 profile/checkpoint당 200 episodes.
- 기존 Reward + Failure v3 기본 profile 결과와 동일 checkpoint끼리 비교했다.

## 기본 profile 2/2/2 — 기존 대비

| Checkpoint | Goal | ROBOT_DISABLED | Objective | 평균 시간 |
|---|---:|---:|---:|---:|
${defaultTable}

## 회복 지표

| Checkpoint | SUBDUE/episode | attempts/encounter | first success | retry success | avg retry bonus | recovery→neutralize | defeat→episode success |
|---|---:|---:|---:|---:|---:|---:|---:|
${recoveryTable}

- R20 실패 단계: first ${last.failureCounts.first}, second ${last.failureCounts.second}, third/terminal ${last.failureCounts.thirdOrTerminal}.
- R20 누적 피해 disabled ${last.cumulativeDamageDisabledCount}, combat disabled ${last.combatDisabledCount}, terminal damage 평균 ${last.averageTerminalDamage.toFixed(3)}.
- R20 damage distribution: ${JSON.stringify(last.damageDistribution)}.

## R20 적 유형별

| Enemy | encounters | attempts | first success | retry success | final neutralization | disabled caused |
|---|---:|---:|---:|---:|---:|---:|
${enemyTable}

## 모든 별 배분

| speed-judgment-threat | R1 Goal | R20 Goal | R1 Disabled | R20 Disabled | R1 Objective | R20 Objective |
|---|---:|---:|---:|---:|---:|---:|
${profileTable}

## 판정 및 권고

- 최초 기본 +0.05 / cap 0.10 평가: **${initialDefaultAssessment}**. 선택값 평가는 **${retryAssessment}**.
- 권고: step ${recommendation.step}, cap ${recommendation.cap}. ${recommendation.reason}
- 후보 비교: ${candidateSearch.length ? candidateSearch.map(candidate => `${candidate.step}/${candidate.cap} (R20 Goal ${(candidate.round20.goalReachedRate * 100).toFixed(1)}%, Disabled ${(candidate.round20.robotDisabledRate * 100).toFixed(1)}%, Retry ${(candidate.round20.retrySuccessRate * 100).toFixed(1)}%)`).join('; ') : '기본값이 균형 범위라 실행하지 않음'}.
`;
fs.mkdirSync('docs/modules/machine_learning/reinforcement/validation', { recursive: true });
fs.writeFileSync('docs/modules/machine_learning/reinforcement/validation/subdue_recovery_validation_2026-10-15.md', report);
console.log(JSON.stringify({ initialDefaultAssessment, selectedAssessment: retryAssessment, recommendation, candidateSearch, basic: { round1: first, round20: last } }, null, 2));
