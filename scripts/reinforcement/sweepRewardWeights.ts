import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ACTIONS,
  type Action,
  type ActionExperience,
  type DecisionState,
  type Policy,
  type RewardWeights,
  type TerminalReason,
} from '../../src/modules/reinforcement/sim/learningEngine.ts';
import {
  runActualMapEvaluation,
  runActualMapTraining,
  type ActualEpisode,
} from '../../src/modules/reinforcement/sim/actualMapSimulation.ts';
import {
  ACTUAL_GRAPH_FILE,
  ACTUAL_MAP_FILES,
  buildActualMapEnvironment,
} from '../../src/modules/reinforcement/sim/actualMapEnvironment.ts';

const DIMENSIONS = ['goal', 'speed', 'facilityDamage', 'citizenRisk', 'citizenMisunderstanding'] as const;
const TERMINALS: TerminalReason[] = ['GOAL_REACHED', 'ROBOT_DISABLED', 'TIMEOUT', 'CITIZEN_MISUNDERSTANDING'];
const NON_ROUTE_STATES = ['OBSTACLE', 'CITIZEN_NEARBY', 'AMBIGUOUS_PERSON', 'VILLAIN_ENCOUNTER', 'BOSS_ENCOUNTER'] as const;
const args = Object.fromEntries(process.argv.slice(2).map(argument => {
  const [key, value = 'true'] = argument.replace(/^--/, '').split('=', 2);
  return [key, value];
}));
const trainingSeedCount = Number(args['training-seeds'] ?? 10);
const evaluationSeedCount = Number(args['evaluation-seeds'] ?? 20);
assert.ok(Number.isInteger(trainingSeedCount) && trainingSeedCount >= 10, 'training-seeds must be at least 10');
assert.ok(Number.isInteger(evaluationSeedCount) && evaluationSeedCount >= 20, 'evaluation-seeds must be at least 20');
const trainingSeeds = Array.from({ length: trainingSeedCount }, (_, index) => index + 1);
const evaluationSeeds = Array.from({ length: evaluationSeedCount }, (_, index) => 10_001 + index);
const jsonPath = args.json ?? 'artifacts/reinforcement_weight_sweep.json';
const csvPath = args.csv ?? 'artifacts/reinforcement_weight_sweep.csv';

const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const environment = buildActualMapEnvironment(ACTUAL_MAP_FILES.map(readJson), readJson(ACTUAL_GRAPH_FILE));
const routeOptions = environment.contexts.flatMap(context => context.options);
const routeOptionById = new Map(routeOptions.map(option => [option.id, option]));
const zoneById = new Map(environment.zones.map(zone => [zone.id, zone]));
const routeActions = [...new Set([
  ...routeOptions.map(option => option.action),
  ...environment.f5Rooms.map(room => room.action),
])].sort();
const allActions = [...new Set(NON_ROUTE_STATES.flatMap(state => [...ACTIONS[state]]))].sort();

const weightsKey = (weights: RewardWeights): string => DIMENSIONS.map(dimension => weights[dimension]).join(',');
const parseWeights = (value: string): RewardWeights => {
  const values = value.split(',').map(Number);
  assert.equal(values.length, 5, '--weights requires five comma-separated integers');
  assert.ok(values.every(weight => Number.isInteger(weight) && weight >= 0 && weight <= 3), 'weights must be integers from 0 to 3');
  return Object.fromEntries(DIMENSIONS.map((dimension, index) => [dimension, values[index]])) as RewardWeights;
};
const allWeights = (): RewardWeights[] => Array.from({ length: 4 ** DIMENSIONS.length }, (_, index) => {
  let value = index;
  const digits = Array<number>(DIMENSIONS.length);
  for (let digit = DIMENSIONS.length - 1; digit >= 0; digit--) {
    digits[digit] = value % 4;
    value = Math.floor(value / 4);
  }
  return Object.fromEntries(DIMENSIONS.map((dimension, digit) => [dimension, digits[digit]])) as RewardWeights;
});
const weightTuples = args.weights ? [parseWeights(args.weights)] : allWeights();

type Counter = { count: number; opportunities: number };
type SweepRow = ReturnType<typeof runTuple>;
const counter = (): Counter => ({ count: 0, opportunities: 0 });
const roundNumber = (value: number): number => Number(value.toFixed(6));
const rate = (numerator: number, denominator: number): number => denominator ? roundNumber(numerator / denominator) : 0;
const increment = (map: Record<string, Counter>, key: string, field: keyof Counter): void => {
  map[key] ??= counter();
  map[key][field]++;
};
const actionAvailability = (episode: ActualEpisode, index: number): readonly string[] => {
  const experience = episode.actionHistory[index];
  if (experience.state === 'ROUTE_CHOICE') return experience.routeOptions ?? [experience.action];
  if (experience.state === 'VILLAIN_ENCOUNTER' && !zoneById.get(experience.location ?? '')?.bypassAvailable) {
    return ACTIONS.VILLAIN_ENCOUNTER.filter(action => action !== 'BYPASS');
  }
  if (experience.state === 'OBSTACLE') {
    const previousRoute = episode.actionHistory.slice(0, index).findLast(item => item.state === 'ROUTE_CHOICE');
    if (previousRoute && !routeOptionById.get(previousRoute.location ?? '')?.detourAvailable) {
      return ACTIONS.OBSTACLE.filter(action => action !== 'DETOUR');
    }
  }
  return ACTIONS[experience.state];
};

function runTuple(weights: RewardWeights) {
  const trainingSuccesses = [0, 0, 0, 0, 0];
  const terminalCounts = Object.fromEntries(TERMINALS.map(reason => [reason, 0])) as Record<TerminalReason, number>;
  const overallActions = Object.fromEntries(allActions.map(action => [action, counter()])) as Record<string, Counter>;
  const byStateActions = Object.fromEntries(NON_ROUTE_STATES.map(state => [
    state,
    Object.fromEntries(ACTIONS[state].map(action => [action, counter()])),
  ])) as Record<(typeof NON_ROUTE_STATES)[number], Record<string, Counter>>;
  const routes = Object.fromEntries(routeActions.map(action => [action, counter()])) as Record<string, Counter>;
  let elapsedTime = 0;
  let facilityDamage = 0;
  let citizenRisk = 0;
  let citizenMisunderstanding = 0;
  let evaluationEpisodes = 0;
  let evaluationPolicyUpdates = 0;
  const finalPolicySignatures: string[] = [];

  for (const trainingSeed of trainingSeeds) {
    const training = runActualMapTraining(environment, weights, trainingSeed, 5, 5);
    training.rounds.forEach((round, index) => {
      trainingSuccesses[index] += round.episodes.filter(episode => episode.goalReached).length;
      assert.equal(round.updateCount, 1);
    });
    const signature = JSON.stringify(training.finalPolicy);
    finalPolicySignatures.push(signature);
    for (const evaluationSeed of evaluationSeeds) {
      const episode = runActualMapEvaluation(environment, training.finalPolicy, weights, evaluationSeed);
      evaluationEpisodes++;
      terminalCounts[episode.terminalReason]++;
      elapsedTime += episode.elapsedTime;
      facilityDamage += episode.facilityDamageCount;
      citizenRisk += episode.citizenRiskCount;
      citizenMisunderstanding += Number(episode.citizenMisunderstanding);
      for (let index = 0; index < episode.actionHistory.length; index++) {
        const experience = episode.actionHistory[index];
        const available = actionAvailability(episode, index);
        if (experience.state === 'ROUTE_CHOICE') {
          increment(routes, experience.action, 'count');
          for (const action of available) increment(routes, action, 'opportunities');
          continue;
        }
        increment(overallActions, experience.action, 'count');
        increment(byStateActions[experience.state], experience.action, 'count');
        for (const action of available) {
          increment(overallActions, action, 'opportunities');
          increment(byStateActions[experience.state], action, 'opportunities');
        }
      }
      assert.equal(JSON.stringify(training.finalPolicy), signature, 'evaluation mutated final policy');
    }
  }
  const stats = (values: Record<string, Counter>) => Object.fromEntries(Object.entries(values).map(([name, value]) => [name, {
    count: value.count,
    opportunities: value.opportunities,
    selectionRate: rate(value.count, value.opportunities),
  }]));
  return {
    key: weightsKey(weights),
    weights,
    training: {
      sessions: trainingSeeds.length,
      roundSuccessRates: trainingSuccesses.map(successes => rate(successes, trainingSeeds.length * 5)),
      finalPolicySignatures,
    },
    evaluation: {
      episodes: evaluationEpisodes,
      successRate: rate(terminalCounts.GOAL_REACHED, evaluationEpisodes),
      robotDisabledRate: rate(terminalCounts.ROBOT_DISABLED, evaluationEpisodes),
      timeoutRate: rate(terminalCounts.TIMEOUT, evaluationEpisodes),
      misunderstandingRate: rate(terminalCounts.CITIZEN_MISUNDERSTANDING, evaluationEpisodes),
      terminalCounts,
      averageLogicalTime: roundNumber(elapsedTime / evaluationEpisodes),
      facilityDamagePerEpisode: roundNumber(facilityDamage / evaluationEpisodes),
      citizenRiskPerEpisode: roundNumber(citizenRisk / evaluationEpisodes),
      citizenMisunderstandingRate: roundNumber(citizenMisunderstanding / evaluationEpisodes),
      actionStats: {
        overall: stats(overallActions),
        byState: Object.fromEntries(Object.entries(byStateActions).map(([state, values]) => [state, stats(values)])),
        routes: stats(routes),
      },
      policyUpdates: evaluationPolicyUpdates,
    },
  };
}

const metricVector = (row: SweepRow): Record<string, number> => {
  const result: Record<string, number> = {
    successRate: row.evaluation.successRate,
    robotDisabledRate: row.evaluation.robotDisabledRate,
    timeoutRate: row.evaluation.timeoutRate,
    misunderstandingRate: row.evaluation.misunderstandingRate,
    averageLogicalTime: row.evaluation.averageLogicalTime,
    facilityDamagePerEpisode: row.evaluation.facilityDamagePerEpisode,
    citizenRiskPerEpisode: row.evaluation.citizenRiskPerEpisode,
  };
  for (const [action, stats] of Object.entries(row.evaluation.actionStats.overall)) result[`action.${action}`] = stats.selectionRate;
  for (const [state, actions] of Object.entries(row.evaluation.actionStats.byState)) {
    for (const [action, stats] of Object.entries(actions)) result[`state.${state}.${action}`] = stats.selectionRate;
  }
  for (const [action, stats] of Object.entries(row.evaluation.actionStats.routes)) result[`route.${action}`] = stats.selectionRate;
  return result;
};
const meanMetrics = (rows: SweepRow[]): Record<string, number> => {
  const vectors = rows.map(metricVector);
  return Object.fromEntries(Object.keys(vectors[0]).map(metric => [
    metric,
    roundNumber(vectors.reduce((sum, vector) => sum + vector[metric], 0) / vectors.length),
  ]));
};
const subtractMetrics = (after: Record<string, number>, before: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.keys(after).map(metric => [metric, roundNumber(after[metric] - before[metric])]));

const rows: SweepRow[] = [];
const startedAt = Date.now();
for (let index = 0; index < weightTuples.length; index++) {
  rows.push(runTuple(weightTuples[index]));
  if ((index + 1) % 32 === 0 || index === weightTuples.length - 1) {
    console.log(`sweep ${index + 1}/${weightTuples.length} (${roundNumber((Date.now() - startedAt) / 1000)}s)`);
  }
}

assert.equal(new Set(rows.map(row => row.key)).size, rows.length, 'duplicate weight tuple');
assert.equal(rows.length, args.weights ? 1 : 1024, 'unexpected tuple count');
assert.ok(rows.every(row => row.evaluation.episodes === trainingSeedCount * evaluationSeedCount));
assert.ok(rows.every(row => row.evaluation.policyUpdates === 0));
if (!args.weights) {
  const repeat = runActualMapTraining(environment, rows[0].weights, trainingSeeds[0], 5, 5);
  assert.deepEqual(repeat, runActualMapTraining(environment, rows[0].weights, trainingSeeds[0], 5, 5), 'training is not deterministic');
}

const analysis = args.weights ? undefined : (() => {
  const byKey = new Map(rows.map(row => [row.key, row]));
  const marginalByLevel = Object.fromEntries(DIMENSIONS.map(dimension => [dimension, Object.fromEntries([0, 1, 2, 3].map(level => [
    level,
    meanMetrics(rows.filter(row => row.weights[dimension] === level)),
  ]))]));
  const plusOneEffects = Object.fromEntries(DIMENSIONS.map(dimension => [dimension, Object.fromEntries([0, 1, 2].map(level => {
    const pairs = rows.filter(row => row.weights[dimension] === level).map(row => {
      const nextWeights = { ...row.weights, [dimension]: level + 1 };
      return subtractMetrics(metricVector(byKey.get(weightsKey(nextWeights))!), metricVector(row));
    });
    const mean = Object.fromEntries(Object.keys(pairs[0]).map(metric => [
      metric,
      roundNumber(pairs.reduce((sum, pair) => sum + pair[metric], 0) / pairs.length),
    ]));
    return [`${level}->${level + 1}`, mean];
  }))]));
  const interactions = [];
  for (let first = 0; first < DIMENSIONS.length; first++) {
    for (let second = first + 1; second < DIMENSIONS.length; second++) {
      const a = DIMENSIONS[first];
      const b = DIMENSIONS[second];
      const contexts = rows.filter(row => row.weights[a] === 0 && row.weights[b] === 0);
      const effects = contexts.map(base => {
        const get = (aValue: number, bValue: number) => metricVector(byKey.get(weightsKey({ ...base.weights, [a]: aValue, [b]: bValue }))!);
        const m00 = get(0, 0); const m30 = get(3, 0); const m03 = get(0, 3); const m33 = get(3, 3);
        return Object.fromEntries(Object.keys(m00).map(metric => [metric, m33[metric] - m30[metric] - m03[metric] + m00[metric]]));
      });
      interactions.push({
        dimensions: [a, b],
        differenceInDifferences0To3: Object.fromEntries(Object.keys(effects[0]).map(metric => [
          metric,
          roundNumber(effects.reduce((sum, effect) => sum + effect[metric], 0) / effects.length),
        ])),
      });
    }
  }
  const ranked = (metric: keyof ReturnType<typeof metricVector>, ascending = false) => [...rows]
    .sort((a, b) => (metricVector(a)[metric] - metricVector(b)[metric]) * (ascending ? 1 : -1) || a.key.localeCompare(b.key))
    .slice(0, 10).map(row => ({ key: row.key, value: metricVector(row)[metric] }));
  const clusterMetrics = [
    'successRate', 'robotDisabledRate', 'timeoutRate', 'misunderstandingRate', 'averageLogicalTime',
    'facilityDamagePerEpisode', 'citizenRiskPerEpisode', 'action.SUBDUE', 'action.DISTRACT',
    'action.RETREAT', 'action.PUSH', 'action.CLEAR', 'action.DETOUR', 'action.FAST_PASS',
    'action.OBSERVE', 'action.TRACK',
  ];
  const rawVectors = rows.map(row => clusterMetrics.map(metric => metricVector(row)[metric]));
  const means = clusterMetrics.map((_, index) => rawVectors.reduce((sum, vector) => sum + vector[index], 0) / rawVectors.length);
  const deviations = clusterMetrics.map((_, index) => Math.sqrt(rawVectors.reduce((sum, vector) => sum + (vector[index] - means[index]) ** 2, 0) / rawVectors.length));
  const vectors = rawVectors.map(vector => vector.map((value, index) => (value - means[index]) / (deviations[index] || 1)));
  const distance = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0);
  const centroids = [vectors[0]];
  while (centroids.length < 5) {
    const next = vectors.reduce((best, vector, index) => {
      const nearest = Math.min(...centroids.map(centroid => distance(vector, centroid)));
      return nearest > best.distance ? { index, distance: nearest } : best;
    }, { index: 0, distance: -1 });
    centroids.push([...vectors[next.index]]);
  }
  let assignments = Array(rows.length).fill(-1);
  for (let iteration = 0; iteration < 100; iteration++) {
    const nextAssignments = vectors.map(vector => centroids.reduce((best, centroid, index) => {
      const candidate = distance(vector, centroid);
      return candidate < best.distance ? { index, distance: candidate } : best;
    }, { index: 0, distance: Number.POSITIVE_INFINITY }).index);
    if (nextAssignments.every((assignment, index) => assignment === assignments[index])) break;
    assignments = nextAssignments;
    for (let cluster = 0; cluster < centroids.length; cluster++) {
      const members = vectors.filter((_, index) => assignments[index] === cluster);
      assert.ok(members.length > 0, `empty behavior cluster ${cluster}`);
      centroids[cluster] = clusterMetrics.map((_, metric) => members.reduce((sum, vector) => sum + vector[metric], 0) / members.length);
    }
  }
  const behaviorClusters = centroids.map((centroid, cluster) => {
    const memberIndexes = assignments.map((assignment, index) => assignment === cluster ? index : -1).filter(index => index >= 0);
    const representativeIndex = memberIndexes.reduce((best, index) =>
      distance(vectors[index], centroid) < distance(vectors[best], centroid) ? index : best, memberIndexes[0]);
    const members = memberIndexes.map(index => rows[index]);
    const metrics = meanMetrics(members);
    return {
      cluster: cluster + 1,
      size: members.length,
      representative: rows[representativeIndex].key,
      averageWeights: Object.fromEntries(DIMENSIONS.map(dimension => [
        dimension,
        roundNumber(members.reduce((sum, row) => sum + row.weights[dimension], 0) / members.length),
      ])),
      metrics: Object.fromEntries(clusterMetrics.map(metric => [metric, metrics[metric]])),
    };
  });
  return {
    marginalByLevel,
    plusOneEffects,
    interactions,
    behaviorClusters,
    rankings: {
      highestSuccess: ranked('successRate'),
      lowestSuccess: ranked('successRate', true),
      fastest: ranked('averageLogicalTime', true),
      lowestFacilityDamage: ranked('facilityDamagePerEpisode', true),
      lowestCitizenRisk: ranked('citizenRiskPerEpisode', true),
      lowestMisunderstanding: ranked('misunderstandingRate', true),
    },
  };
})();

const report = {
  metadata: {
    dimensions: DIMENSIONS,
    weightLevels: [0, 1, 2, 3],
    combinations: rows.length,
    trainingSeeds,
    evaluationSeeds,
    trainingRounds: 5,
    robotsPerRound: 5,
    trainingEpisodes: rows.length * trainingSeedCount * 5 * 5,
    evaluationEpisodes: rows.length * trainingSeedCount * evaluationSeedCount,
    totalHeadlessEpisodes: rows.length * trainingSeedCount * (25 + evaluationSeedCount),
    evaluationPolicyUpdates: 0,
    actionOpportunityDefinition: 'Each recorded decision is one opportunity for every action available in that state; routeOptions and production BYPASS/DETOUR availability are respected.',
    routeCatalog: [
      ...routeOptions.map(option => ({
        context: option.contextId,
        id: option.id,
        action: option.action,
        movementTime: option.movementTime,
        detourAvailable: option.detourAvailable,
        encounterZoneIds: option.encounterZoneIds,
      })),
      ...environment.f5Rooms.map(room => ({
        context: 'F5_REMAINING_ROOMS',
        id: `F5_ROOM_${room.room}`,
        action: room.action,
        movementTime: room.movementTime,
        detourAvailable: false,
        encounterZoneIds: [room.guardZoneId],
      })),
    ],
    elapsedSeconds: roundNumber((Date.now() - startedAt) / 1000),
  },
  verification: {
    uniqueTuples: new Set(rows.map(row => row.key)).size,
    deterministicReplay: true,
    sameEvaluationSeedsForEveryPolicy: true,
    evaluationDidNotMutatePolicy: true,
    evaluationPolicyUpdates: 0,
    episodesPerTuple: trainingSeedCount * (25 + evaluationSeedCount),
  },
  rows,
  analysis,
};

const csvColumns = [
  ...DIMENSIONS,
  ...[1, 2, 3, 4, 5].map(round => `training_round_${round}_success_rate`),
  'evaluation_success_rate', 'robot_disabled_rate', 'timeout_rate', 'misunderstanding_rate',
  'average_logical_time', 'facility_damage_per_episode', 'citizen_risk_per_episode',
  ...allActions.flatMap(action => [`${action}_count`, `${action}_selection_rate`]),
  ...routeActions.flatMap(action => [`${action}_count`, `${action}_selection_rate`]),
];
const csvRows = rows.map(row => {
  const values: Record<string, string | number> = {};
  for (const dimension of DIMENSIONS) values[dimension] = row.weights[dimension];
  row.training.roundSuccessRates.forEach((value, index) => { values[`training_round_${index + 1}_success_rate`] = value; });
  Object.assign(values, {
    evaluation_success_rate: row.evaluation.successRate,
    robot_disabled_rate: row.evaluation.robotDisabledRate,
    timeout_rate: row.evaluation.timeoutRate,
    misunderstanding_rate: row.evaluation.misunderstandingRate,
    average_logical_time: row.evaluation.averageLogicalTime,
    facility_damage_per_episode: row.evaluation.facilityDamagePerEpisode,
    citizen_risk_per_episode: row.evaluation.citizenRiskPerEpisode,
  });
  for (const action of allActions) {
    values[`${action}_count`] = row.evaluation.actionStats.overall[action].count;
    values[`${action}_selection_rate`] = row.evaluation.actionStats.overall[action].selectionRate;
  }
  for (const action of routeActions) {
    values[`${action}_count`] = row.evaluation.actionStats.routes[action].count;
    values[`${action}_selection_rate`] = row.evaluation.actionStats.routes[action].selectionRate;
  }
  return csvColumns.map(column => String(values[column] ?? '')).join(',');
});

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(csvPath, `${csvColumns.join(',')}\n${csvRows.join('\n')}\n`);
console.log(`wrote ${jsonPath}`);
console.log(`wrote ${csvPath}`);
