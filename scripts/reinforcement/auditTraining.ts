import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ACTIONS,
  DEFAULT_REWARD_STARS,
  rewardWeightsFromStars,
  softmaxWithExploration,
  type ActionExperience,
  type Policy,
  type RewardWeights,
  type TerminalReason,
} from '../../src/modules/reinforcement/sim/learningEngine.ts';
import {
  runActualMapTraining,
  type ActualEpisode,
  type ActualRound,
} from '../../src/modules/reinforcement/sim/actualMapSimulation.ts';
import {
  ACTUAL_GRAPH_FILE,
  ACTUAL_MAP_FILES,
  buildActualMapEnvironment,
} from '../../src/modules/reinforcement/sim/actualMapEnvironment.ts';
import { TrainingRuntimeController } from '../../src/modules/reinforcement/runtime/runtimeController.ts';

const DIMENSIONS = ['goal', 'speed', 'facilityDamage', 'citizenRisk', 'citizenMisunderstanding'] as const;
const TERMINALS: TerminalReason[] = ['GOAL_REACHED', 'ROBOT_DISABLED', 'TIMEOUT', 'CITIZEN_MISUNDERSTANDING'];
const args = Object.fromEntries(process.argv.slice(2).map(argument => {
  const [key, value = 'true'] = argument.replace(/^--/, '').split('=', 2);
  return [key, value];
}));

const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const environment = buildActualMapEnvironment(ACTUAL_MAP_FILES.map(readJson), readJson(ACTUAL_GRAPH_FILE));
const selectedWeights = (() => {
  if (!args.weights) return rewardWeightsFromStars(DEFAULT_REWARD_STARS);
  const values = args.weights.split(',').map(Number);
  assert.equal(values.length, DIMENSIONS.length, '--weights requires five comma-separated integers');
  assert.ok(values.every(value => Number.isInteger(value) && value >= 0 && value <= 3), 'weights must be integers from 0 to 3');
  return Object.fromEntries(DIMENSIONS.map((dimension, index) => [dimension, values[index]])) as RewardWeights;
})();
const selectedSeed = Number(args.seed ?? 42);
const seedCount = Number(args.seeds ?? 20);
assert.ok(Number.isInteger(selectedSeed), 'seed must be an integer');
assert.ok(Number.isInteger(seedCount) && seedCount >= 20, 'seeds must be an integer of at least 20');
const seeds = Array.from({ length: seedCount }, (_, index) => index + 1);

const roundNumber = (value: number): number => Number(value.toFixed(4));
const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
const countBy = (values: string[]): Record<string, number> => Object.fromEntries(
  [...new Set(values)].sort().map(value => [value, values.filter(candidate => candidate === value).length]),
);
const actionCounts = (episodes: ActualEpisode[]): Record<string, number> => countBy(
  episodes.flatMap(episode => episode.actionHistory.map(experience => experience.action)),
);
const terminalCounts = (episodes: ActualEpisode[]): Record<TerminalReason, number> => Object.fromEntries(
  TERMINALS.map(reason => [reason, episodes.filter(episode => episode.terminalReason === reason).length]),
) as Record<TerminalReason, number>;
const policyDelta = (before: Policy, after: Policy) => Object.entries(before).flatMap(([state, preferences]) =>
  Object.entries(preferences).map(([action, value]) => ({
    state,
    action,
    before: value,
    after: after[state as keyof Policy][action],
    delta: after[state as keyof Policy][action] - value,
  })),
).filter(change => change.delta !== 0);

const summarizeEpisode = (episode: ActualEpisode) => ({
  robot: episode.robot,
  terminalReason: episode.terminalReason,
  success: episode.terminalReason === 'GOAL_REACHED',
  elapsedTime: episode.elapsedTime,
  facilityDamage: episode.facilityDamageCount,
  citizenRisk: episode.citizenRiskCount,
  citizenMisunderstanding: episode.citizenMisunderstanding,
  terminalEvent: episode.eventHistory.findLast(event => event.type === episode.terminalReason),
  lastAction: episode.actionHistory.at(-1)?.action,
  actionCounts: countBy(episode.actionHistory.map(experience => experience.action)),
});

const summarizeRound = (round: ActualRound) => {
  const episodes = round.episodes;
  const deltas = policyDelta(round.snapshot, round.policyAfter);
  return {
    round: round.round,
    success: episodes.filter(episode => episode.terminalReason === 'GOAL_REACHED').length,
    terminals: terminalCounts(episodes),
    averageLogicalTime: roundNumber(average(episodes.map(episode => episode.elapsedTime))),
    facilityDamage: episodes.reduce((sum, episode) => sum + episode.facilityDamageCount, 0),
    citizenRisk: episodes.reduce((sum, episode) => sum + episode.citizenRiskCount, 0),
    citizenMisunderstanding: episodes.filter(episode => episode.citizenMisunderstanding).length,
    actions: actionCounts(episodes),
    robots: episodes.map(summarizeEpisode),
    policy: {
      sharedSnapshotCount: new Set(round.snapshotSignatures).size,
      allEpisodesUsedSnapshotBefore: round.snapshotSignatures.every(signature => signature === JSON.stringify(round.snapshot)),
      centralPolicyUnchangedDuringEpisodes: round.centralPolicyUnchangedDuringEpisodes,
      updateCount: round.updateCount,
      changedPreferences: deltas.length,
      maxAbsoluteDelta: roundNumber(Math.max(0, ...deltas.map(change => Math.abs(change.delta)))),
      largestChanges: deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8).map(change => ({
        ...change,
        before: roundNumber(change.before),
        after: roundNumber(change.after),
        delta: roundNumber(change.delta),
      })),
      decisionProbabilitiesBefore: Object.fromEntries(
        (['OBSTACLE', 'CITIZEN_NEARBY', 'AMBIGUOUS_PERSON', 'VILLAIN_ENCOUNTER', 'BOSS_ENCOUNTER'] as const).map(state => [
          state,
          Object.fromEntries(Object.entries(softmaxWithExploration(round.snapshot[state], ACTIONS[state], round.epsilon))
            .map(([action, probability]) => [action, roundNumber(probability)])),
        ]),
      ),
    },
  };
};

const verifyControllerAndHistory = () => {
  const controllerWeights = rewardWeightsFromStars(DEFAULT_REWARD_STARS);
  const direct = runActualMapTraining(environment, controllerWeights, selectedSeed, 5, 5);
  const controller = new TrainingRuntimeController(environment, DEFAULT_REWARD_STARS, selectedSeed);
  for (let roundIndex = 0; roundIndex < 5; roundIndex++) {
    for (let robot = 1; robot <= 5; robot++) while (controller.advance(robot));
    assert.equal(controller.policyUpdateCount, roundIndex + 1);
    assert.deepEqual(controller.history.rounds[roundIndex].robotResults, direct.rounds[roundIndex].episodes);
    assert.deepEqual(controller.history.rounds[roundIndex].policySnapshotBefore, direct.rounds[roundIndex].snapshot);
    assert.deepEqual(controller.history.rounds[roundIndex].policySnapshotAfter, direct.rounds[roundIndex].policyAfter);
    if (roundIndex < 4) assert.equal(controller.nextRound(), true);
  }
  assert.equal(controller.history.rounds.length, 5);
  assert.equal(controller.history.rounds.flatMap(round => round.robotResults).length, 25);
  for (let index = 0; index < 4; index++) {
    assert.deepEqual(direct.rounds[index + 1].snapshot, direct.rounds[index].policyAfter);
  }
  return {
    passed: true,
    historyRounds: controller.history.rounds.length,
    historyEpisodes: controller.history.rounds.flatMap(round => round.robotResults).length,
    policyUpdates: controller.policyUpdateCount,
    roundToRoundPolicyContinuity: true,
    uiSuccessDefinition: 'terminalReason === GOAL_REACHED',
    uiCountsMatchHistory: controller.history.rounds.every((historyRound, index) =>
      historyRound.robotResults.filter(episode => episode.terminalReason === 'GOAL_REACHED').length
        === direct.rounds[index].episodes.filter(episode => episode.goalReached).length),
  };
};

const summarizeProfile = (weights: RewardWeights) => {
  const runs = seeds.map(seed => runActualMapTraining(environment, weights, seed, 5, 5));
  const rounds = Array.from({ length: 5 }, (_, roundIndex) => {
    const seedSuccessRates = runs.map(run => run.rounds[roundIndex].episodes.filter(episode => episode.goalReached).length / 5);
    const episodes = runs.flatMap(run => run.rounds[roundIndex].episodes);
    const mean = average(seedSuccessRates);
    return {
      round: roundIndex + 1,
      successRate: roundNumber(mean),
      successStandardDeviation: roundNumber(Math.sqrt(average(seedSuccessRates.map(value => (value - mean) ** 2)))),
      successMin: Math.min(...seedSuccessRates),
      successMax: Math.max(...seedSuccessRates),
      allDisabledSeeds: runs.filter(run => run.rounds[roundIndex].episodes.every(episode => episode.terminalReason === 'ROBOT_DISABLED')).map(run => run.seed),
      terminals: terminalCounts(episodes),
      averageLogicalTime: roundNumber(average(episodes.map(episode => episode.elapsedTime))),
      facilityDamagePerEpisode: roundNumber(average(episodes.map(episode => episode.facilityDamageCount))),
      citizenRiskPerEpisode: roundNumber(average(episodes.map(episode => episode.citizenRiskCount))),
      citizenMisunderstandingRate: roundNumber(average(episodes.map(episode => Number(episode.citizenMisunderstanding)))),
      actionCountPerEpisode: Object.fromEntries(Object.entries(actionCounts(episodes)).map(([action, count]) => [action, roundNumber(count / episodes.length)])),
    };
  });
  return { weights, rounds };
};

const profiles: Record<string, RewardWeights> = {
  CURRENT: selectedWeights,
  BALANCED: { goal: 2, speed: 2, facilityDamage: 2, citizenRisk: 2, citizenMisunderstanding: 2 },
  ALL_MAX: { goal: 3, speed: 3, facilityDamage: 3, citizenRisk: 3, citizenMisunderstanding: 3 },
  FOCUS_GOAL: { goal: 3, speed: 0, facilityDamage: 0, citizenRisk: 0, citizenMisunderstanding: 0 },
  FOCUS_SPEED: { goal: 0, speed: 3, facilityDamage: 0, citizenRisk: 0, citizenMisunderstanding: 0 },
  FOCUS_FACILITY_DAMAGE: { goal: 0, speed: 0, facilityDamage: 3, citizenRisk: 0, citizenMisunderstanding: 0 },
  FOCUS_CITIZEN_RISK: { goal: 0, speed: 0, facilityDamage: 0, citizenRisk: 3, citizenMisunderstanding: 0 },
  FOCUS_CITIZEN_MISUNDERSTANDING: { goal: 0, speed: 0, facilityDamage: 0, citizenRisk: 0, citizenMisunderstanding: 3 },
  ALL_ZERO: { goal: 0, speed: 0, facilityDamage: 0, citizenRisk: 0, citizenMisunderstanding: 0 },
};

const selectedRun = runActualMapTraining(environment, selectedWeights, selectedSeed, 5, 5);
const productionActions = [...new Set(Object.values(ACTIONS).flat())];
for (const round of selectedRun.rounds) {
  assert.equal(round.episodes.length, 5);
  assert.ok(round.episodes.every(episode => episode.actionHistory.every((action: ActionExperience) =>
    action.state === 'ROUTE_CHOICE' || productionActions.includes(action.action as never))));
}

const report = {
  assumptions: {
    currentWeightsSource: args.weights ? 'CLI --weights' : 'UI default; the app does not persist in-memory selections',
    selectedWeights,
    selectedSeed,
    comparisonSeeds: seeds,
    rounds: 5,
    robotsPerRound: 5,
  },
  currentSeed: selectedRun.rounds.map(summarizeRound),
  orchestrationAndUiAggregation: verifyControllerAndHistory(),
  profiles: Object.fromEntries(Object.entries(profiles).map(([name, weights]) => [name, summarizeProfile(weights)])),
};

const output = JSON.stringify(report, null, 2);
if (args.out) {
  fs.writeFileSync(args.out, `${output}\n`);
  console.log(`Wrote ${args.out}`);
} else {
  console.log(output);
}
