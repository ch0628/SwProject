import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ACTIONS,
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

const DIMENSIONS = ['speed', 'facilityDamage', 'citizenRisk', 'citizenMisunderstanding'] as const;
type Dimension = (typeof DIMENSIONS)[number];
type RewardStars = Record<Dimension, number>;
type MappingName = keyof typeof MAPPINGS;
const MAPPINGS = {
  A_LINEAR: [0, 1, 2, 3],
  B_PROGRESSIVE: [0, 1, 2.5, 5],
  C_STRONG: [0, 1, 3, 6],
} as const;
const GOAL_BASES = [2, 3, 4] as const;
const TERMINALS: TerminalReason[] = ['GOAL_REACHED', 'ROBOT_DISABLED', 'TIMEOUT', 'CITIZEN_MISUNDERSTANDING'];
const STATES = ['OBSTACLE', 'CITIZEN_NEARBY', 'AMBIGUOUS_PERSON', 'VILLAIN_ENCOUNTER', 'BOSS_ENCOUNTER'] as const;
const TRAINING_SEEDS = Array.from({ length: 10 }, (_, index) => index + 1);
const EVALUATION_SEEDS = Array.from({ length: 20 }, (_, index) => 10_001 + index);
const JSON_PATH = 'artifacts/reinforcement_reward_redesign_v2.json';
const CSV_PATH = 'artifacts/reinforcement_reward_redesign_v2.csv';

const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const environment = buildActualMapEnvironment(ACTUAL_MAP_FILES.map(readJson), readJson(ACTUAL_GRAPH_FILE));
const routeOptions = environment.contexts.flatMap(context => context.options);
const routeOptionById = new Map(routeOptions.map(option => [option.id, option]));
const zoneById = new Map(environment.zones.map(zone => [zone.id, zone]));
const routeActions = [...new Set([
  ...routeOptions.map(option => option.action),
  ...environment.f5Rooms.map(room => room.action),
])].sort();
const nonRouteActions = [...new Set(STATES.flatMap(state => [...ACTIONS[state]]))].sort();

const roundNumber = (value: number): number => Number(value.toFixed(6));
const rate = (numerator: number, denominator: number): number => denominator ? roundNumber(numerator / denominator) : 0;
const starKey = (stars: RewardStars): string => DIMENSIONS.map(dimension => stars[dimension]).join(',');
const mappedWeights = (stars: RewardStars, mappingName: MappingName, goalBase: number): RewardWeights => ({
  goal: goalBase,
  ...Object.fromEntries(DIMENSIONS.map(dimension => [dimension, MAPPINGS[mappingName][stars[dimension]]])),
}) as RewardWeights;
const validTuples = (): RewardStars[] => {
  const tuples: RewardStars[] = [];
  for (let speed = 0; speed <= 3; speed++) {
    for (let facilityDamage = 0; facilityDamage <= 3; facilityDamage++) {
      for (let citizenRisk = 0; citizenRisk <= 3; citizenRisk++) {
        for (let citizenMisunderstanding = 0; citizenMisunderstanding <= 3; citizenMisunderstanding++) {
          const stars = { speed, facilityDamage, citizenRisk, citizenMisunderstanding };
          if (Object.values(stars).reduce((sum, value) => sum + value, 0) === 8) tuples.push(stars);
        }
      }
    }
  }
  return tuples;
};
const directTuples = (): RewardStars[] => {
  const byKey = new Map<string, RewardStars>();
  for (const dimension of DIMENSIONS) {
    for (let level = 0; level <= 3; level++) {
      const stars = { speed: 1, facilityDamage: 1, citizenRisk: 1, citizenMisunderstanding: 1, [dimension]: level };
      byKey.set(starKey(stars), stars);
    }
  }
  return [...byKey.values()];
};

type Counter = { count: number; opportunities: number };
const counter = (): Counter => ({ count: 0, opportunities: 0 });
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

function runTuple(stars: RewardStars, mappingName: MappingName, goalBase: number) {
  const weights = mappedWeights(stars, mappingName, goalBase);
  const trainingSuccesses = [0, 0, 0, 0, 0];
  const terminalCounts = Object.fromEntries(TERMINALS.map(reason => [reason, 0])) as Record<TerminalReason, number>;
  const actions = Object.fromEntries(nonRouteActions.map(action => [action, counter()])) as Record<string, Counter>;
  const routes = Object.fromEntries(routeActions.map(action => [action, counter()])) as Record<string, Counter>;
  let elapsedTime = 0;
  let facilityDamage = 0;
  let citizenRisk = 0;
  let misunderstanding = 0;

  for (const trainingSeed of TRAINING_SEEDS) {
    const training = runActualMapTraining(environment, weights, trainingSeed, 5, 5);
    training.rounds.forEach((round, index) => {
      trainingSuccesses[index] += round.episodes.filter(episode => episode.goalReached).length;
      assert.equal(round.updateCount, 1, 'each training round must update exactly once');
    });
    const policySignature = JSON.stringify(training.finalPolicy);
    for (const evaluationSeed of EVALUATION_SEEDS) {
      const episode = runActualMapEvaluation(environment, training.finalPolicy, weights, evaluationSeed);
      terminalCounts[episode.terminalReason]++;
      elapsedTime += episode.elapsedTime;
      facilityDamage += episode.facilityDamageCount;
      citizenRisk += episode.citizenRiskCount;
      misunderstanding += Number(episode.citizenMisunderstanding);
      episode.actionHistory.forEach((experience, index) => {
        const available = actionAvailability(episode, index);
        const target = experience.state === 'ROUTE_CHOICE' ? routes : actions;
        increment(target, experience.action, 'count');
        for (const action of available) increment(target, action, 'opportunities');
      });
      assert.equal(JSON.stringify(training.finalPolicy), policySignature, 'evaluation mutated the final policy');
    }
  }
  const episodes = TRAINING_SEEDS.length * EVALUATION_SEEDS.length;
  const summarize = (values: Record<string, Counter>) => Object.fromEntries(Object.entries(values).map(([action, value]) => [action, {
    ...value,
    selectionRate: rate(value.count, value.opportunities),
  }]));
  return {
    key: `${mappingName}|g${goalBase}|${starKey(stars)}`,
    mapping: mappingName,
    goalBase,
    stars,
    internalWeights: weights,
    trainingRoundSuccessRates: trainingSuccesses.map(value => rate(value, TRAINING_SEEDS.length * 5)),
    evaluation: {
      episodes,
      successRate: rate(terminalCounts.GOAL_REACHED, episodes),
      robotDisabledRate: rate(terminalCounts.ROBOT_DISABLED, episodes),
      timeoutRate: rate(terminalCounts.TIMEOUT, episodes),
      misunderstandingRate: rate(terminalCounts.CITIZEN_MISUNDERSTANDING, episodes),
      averageLogicalTime: roundNumber(elapsedTime / episodes),
      facilityDamagePerEpisode: roundNumber(facilityDamage / episodes),
      citizenRiskPerEpisode: roundNumber(citizenRisk / episodes),
      citizenMisunderstandingRate: rate(misunderstanding, episodes),
      actions: summarize(actions),
      routes: summarize(routes),
      policyUpdates: 0,
    },
  };
}

type Row = ReturnType<typeof runTuple>;
const metrics = (row: Row): Record<string, number> => ({
  successRate: row.evaluation.successRate,
  robotDisabledRate: row.evaluation.robotDisabledRate,
  timeoutRate: row.evaluation.timeoutRate,
  misunderstandingRate: row.evaluation.misunderstandingRate,
  averageLogicalTime: row.evaluation.averageLogicalTime,
  facilityDamagePerEpisode: row.evaluation.facilityDamagePerEpisode,
  citizenRiskPerEpisode: row.evaluation.citizenRiskPerEpisode,
  ...Object.fromEntries(Object.entries(row.evaluation.actions).map(([action, value]) => [`action.${action}`, value.selectionRate])),
  ...Object.fromEntries(Object.entries(row.evaluation.routes).map(([action, value]) => [`route.${action}`, value.selectionRate])),
});
const meanMetrics = (rows: Row[]): Record<string, number> => {
  assert.ok(rows.length > 0);
  const vectors = rows.map(metrics);
  return Object.fromEntries(Object.keys(vectors[0]).map(metric => [
    metric,
    roundNumber(vectors.reduce((sum, vector) => sum + vector[metric], 0) / vectors.length),
  ]));
};
const subtract = (after: Record<string, number>, before: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.keys(after).map(metric => [metric, roundNumber(after[metric] - before[metric])]));

const rows: Row[] = [];
const startedAt = Date.now();
for (const mappingName of Object.keys(MAPPINGS) as MappingName[]) {
  for (const stars of directTuples()) rows.push(runTuple(stars, mappingName, 3));
  for (const stars of validTuples()) rows.push(runTuple(stars, mappingName, 3));
  for (const goalBase of [2, 4]) {
    for (const stars of validTuples()) rows.push(runTuple(stars, mappingName, goalBase));
  }
  console.log(`completed ${mappingName} (${rows.length} total rows)`);
}

assert.equal(validTuples().length, 31, 'expected 31 exact-eight-star tuples');
assert.equal(new Set(rows.map(row => row.key)).size, rows.length, 'duplicate experiment row');
assert.ok(rows.every(row => row.evaluation.episodes === 200));
assert.ok(rows.every(row => row.evaluation.policyUpdates === 0));
const deterministicSample = runActualMapTraining(environment, rows[0].internalWeights, 1, 5, 5);
assert.deepEqual(deterministicSample, runActualMapTraining(environment, rows[0].internalWeights, 1, 5, 5));

const intendedMetric: Record<Dimension, string> = {
  speed: 'averageLogicalTime',
  facilityDamage: 'facilityDamagePerEpisode',
  citizenRisk: 'citizenRiskPerEpisode',
  citizenMisunderstanding: 'misunderstandingRate',
};
const analysis = Object.fromEntries((Object.keys(MAPPINGS) as MappingName[]).map(mappingName => {
  const direct = rows.filter(row => row.mapping === mappingName && row.goalBase === 3
    && Object.values(row.stars).reduce((sum, value) => sum + value, 0) <= 6);
  const constrained = rows.filter(row => row.mapping === mappingName && row.goalBase === 3
    && Object.values(row.stars).reduce((sum, value) => sum + value, 0) === 8);
  const directByLevel = Object.fromEntries(DIMENSIONS.map(dimension => [dimension, Object.fromEntries([0, 1, 2, 3].map(level => {
    const row = direct.find(candidate => candidate.stars[dimension] === level
      && DIMENSIONS.filter(value => value !== dimension).every(value => candidate.stars[value] === 1));
    assert.ok(row);
    return [level, metrics(row)];
  }))]));
  const directAdjacentEffects = Object.fromEntries(DIMENSIONS.map(dimension => [dimension, Object.fromEntries([0, 1, 2].map(level => [
    `${level}->${level + 1}`,
    subtract(directByLevel[dimension][level + 1], directByLevel[dimension][level]),
  ]))]));
  const constrainedByLevel = Object.fromEntries(DIMENSIONS.map(dimension => [dimension, Object.fromEntries([0, 1, 2, 3].map(level => [
    level,
    meanMetrics(constrained.filter(row => row.stars[dimension] === level)),
  ]))]));
  const matchedTransfers = Object.fromEntries(DIMENSIONS.map(dimension => [dimension, Object.fromEntries([0, 1, 2].map(level => {
    const effects: Record<string, number>[] = [];
    for (const before of constrained.filter(row => row.stars[dimension] === level)) {
      for (const donor of DIMENSIONS.filter(value => value !== dimension && before.stars[value] > 0)) {
        const afterStars = { ...before.stars, [dimension]: level + 1, [donor]: before.stars[donor] - 1 };
        const after = constrained.find(row => starKey(row.stars) === starKey(afterStars));
        assert.ok(after);
        effects.push(subtract(metrics(after), metrics(before)));
      }
    }
    return [`${level}->${level + 1}`, {
      comparisons: effects.length,
      averageDelta: Object.fromEntries(Object.keys(effects[0]).map(metric => [
        metric,
        roundNumber(effects.reduce((sum, effect) => sum + effect[metric], 0) / effects.length),
      ])),
    }];
  }))]));
  const separation = Object.fromEntries(DIMENSIONS.map(dimension => {
    const metric = intendedMetric[dimension];
    const values = directByLevel[dimension];
    return [dimension, {
      metric,
      values: [0, 1, 2, 3].map(level => values[level][metric]),
      adjacentDeltas: [0, 1, 2].map(level => roundNumber(values[level + 1][metric] - values[level][metric])),
      monotonicSteps: [0, 1, 2].filter(level => values[level + 1][metric] < values[level][metric]).length,
      endpointDelta: roundNumber(values[3][metric] - values[0][metric]),
    }];
  }));
  return [mappingName, {
    map: MAPPINGS[mappingName],
    directByLevel,
    directAdjacentEffects,
    constrainedByLevel,
    matchedTransfers,
    separation,
    constrainedOverall: meanMetrics(constrained),
  }];
}));

const goalSensitivity = Object.fromEntries((Object.keys(MAPPINGS) as MappingName[]).map(mappingName => [
  mappingName,
  Object.fromEntries(GOAL_BASES.map(goalBase => {
    const selected = rows.filter(row => row.mapping === mappingName && row.goalBase === goalBase
      && Object.values(row.stars).reduce((sum, value) => sum + value, 0) === 8);
    return [goalBase, meanMetrics(selected)];
  })),
]));

const report = {
  metadata: {
    generatedAt: new Date().toISOString(),
    dimensions: DIMENSIONS,
    allocationRule: 'exactly 8 total stars; each dimension is an integer from 0 to 3',
    validTupleCount: validTuples().length,
    mappings: MAPPINGS,
    goalBases: GOAL_BASES,
    trainingSeeds: TRAINING_SEEDS,
    evaluationSeeds: EVALUATION_SEEDS,
    trainingRounds: 5,
    robotsPerRound: 5,
    evaluationEpisodesPerPolicy: EVALUATION_SEEDS.length,
    rows: rows.length,
    totalHeadlessEpisodes: rows.length * TRAINING_SEEDS.length * (25 + EVALUATION_SEEDS.length) + 50,
    elapsedSeconds: roundNumber((Date.now() - startedAt) / 1000),
  },
  verification: {
    validTupleCount: validTuples().length,
    deterministicReplay: true,
    sameEvaluationSeedsForEveryPolicy: true,
    evaluationDidNotMutatePolicy: true,
    evaluationPolicyUpdates: 0,
  },
  analysis,
  goalSensitivity,
  rows,
};

const csvColumns = [
  'mapping', 'goal_base', ...DIMENSIONS.map(dimension => `${dimension}_stars`),
  ...DIMENSIONS.map(dimension => `${dimension}_weight`),
  ...[1, 2, 3, 4, 5].map(round => `training_round_${round}_success_rate`),
  'evaluation_success_rate', 'robot_disabled_rate', 'timeout_rate', 'misunderstanding_rate',
  'average_logical_time', 'facility_damage_per_episode', 'citizen_risk_per_episode',
  ...nonRouteActions.map(action => `${action}_selection_rate`),
  ...routeActions.map(action => `${action}_selection_rate`),
];
const csvRows = rows.map(row => {
  const values: Record<string, string | number> = {
    mapping: row.mapping,
    goal_base: row.goalBase,
    evaluation_success_rate: row.evaluation.successRate,
    robot_disabled_rate: row.evaluation.robotDisabledRate,
    timeout_rate: row.evaluation.timeoutRate,
    misunderstanding_rate: row.evaluation.misunderstandingRate,
    average_logical_time: row.evaluation.averageLogicalTime,
    facility_damage_per_episode: row.evaluation.facilityDamagePerEpisode,
    citizen_risk_per_episode: row.evaluation.citizenRiskPerEpisode,
  };
  for (const dimension of DIMENSIONS) {
    values[`${dimension}_stars`] = row.stars[dimension];
    values[`${dimension}_weight`] = row.internalWeights[dimension];
  }
  row.trainingRoundSuccessRates.forEach((value, index) => { values[`training_round_${index + 1}_success_rate`] = value; });
  for (const action of nonRouteActions) values[`${action}_selection_rate`] = row.evaluation.actions[action].selectionRate;
  for (const action of routeActions) values[`${action}_selection_rate`] = row.evaluation.routes[action].selectionRate;
  return csvColumns.map(column => String(values[column] ?? '')).join(',');
});

fs.writeFileSync(JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(CSV_PATH, `${csvColumns.join(',')}\n${csvRows.join('\n')}\n`);
console.log(`wrote ${JSON_PATH}`);
console.log(`wrote ${CSV_PATH}`);
