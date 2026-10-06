import {
  ACTIONS,
  type DecisionState,
  type ProfileName,
  type ProfileRun,
  runProfile,
} from '../../src/modules/reinforcement/sim/learningEngine.ts';

const argument = (name: string): string | undefined =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=')[1];
const rounds = Number(argument('rounds') ?? 3);
const seeds = (argument('seeds') ?? argument('seed') ?? '42').split(',').map(Number);
if (!Number.isInteger(rounds) || rounds < 1) throw new Error('rounds must be a positive integer');
if (seeds.some((seed) => !Number.isInteger(seed))) throw new Error('seeds must be comma-separated integers');

const profiles: ProfileName[] = ['SAFE', 'FAST', 'BALANCED'];
const runs = profiles.flatMap((profile) => seeds.map((seed) => runProfile(profile, seed, rounds)));
const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
const rounded = (value: number): number => Number(value.toFixed(6));

function routeSegmentReturns(run: ProfileRun): Record<string, number> {
  return Object.fromEntries(ACTIONS.ROUTE_CHOICE.map((route) => {
    const values = run.rounds.flatMap((round) => round.episodes).flatMap((episode) => episode.actionHistory)
      .filter((action) => action.state === 'ROUTE_CHOICE' && action.action === route)
      .map((action) => action.segmentReturn!);
    return [route, values.length === 0 ? 0 : rounded(average(values))];
  }));
}

function compactTable(table: Record<DecisionState, Record<string, number>>): Record<DecisionState, Record<string, number>> {
  return Object.fromEntries((Object.keys(ACTIONS) as DecisionState[]).map((state) => [
    state,
    Object.fromEntries(Object.entries(table[state]).map(([action, value]) => [action, rounded(value)])),
  ])) as Record<DecisionState, Record<string, number>>;
}

console.log(JSON.stringify({ type: 'CONFIG', rounds, robotsPerRound: 5, seeds, profiles }));
for (const run of runs) {
  console.log(JSON.stringify({
    type: 'RUN',
    profile: run.profile,
    seed: run.seed,
    episodes: rounds * 5,
    summary: Object.fromEntries(Object.entries(run.summary).map(([key, value]) => [key, rounded(value)])),
    finalPolicy: compactTable(run.finalPolicy),
    finalProbabilities: compactTable(run.finalProbabilities),
    routeSegmentReturns: routeSegmentReturns(run),
  }));
  const checkpoints = [...new Set([1, rounds, 5, 10, 15, 20].filter((round) => round <= rounds))].sort((a, b) => a - b);
  for (const checkpoint of checkpoints) {
    const result = run.rounds[checkpoint - 1];
    console.log(JSON.stringify({
      type: 'CHECKPOINT',
      profile: run.profile,
      seed: run.seed,
      round: checkpoint,
      epsilon: result.epsilon,
      policy: compactTable(result.policyAfter),
      probabilities: compactTable(result.nextProbabilities),
    }));
  }
}

for (const profile of profiles) {
  const profileRuns = runs.filter((run) => run.profile === profile);
  const metric = (key: keyof ProfileRun['summary']): number => rounded(average(profileRuns.map((run) => run.summary[key])));
  const actionAverage = (state: DecisionState, action: string, source: 'finalPolicy' | 'finalProbabilities'): number =>
    rounded(average(profileRuns.map((run) => run[source][state][action])));
  console.log(JSON.stringify({
    type: 'AGGREGATE',
    profile,
    summary: {
      successRate: metric('successRate'),
      timeoutRate: metric('timeoutRate'),
      misunderstandingRate: metric('misunderstandingRate'),
      avgElapsedTime: metric('avgElapsedTime'),
      avgCitizenRisk: metric('avgCitizenRisk'),
      avgFacilityDamage: metric('avgFacilityDamage'),
      avgExperienceScore: metric('avgExperienceScore'),
    },
    finalProbabilities: Object.fromEntries((Object.keys(ACTIONS) as DecisionState[]).map((state) => [
      state,
      Object.fromEntries(ACTIONS[state].map((action) => [action, actionAverage(state, action, 'finalProbabilities')])),
    ])),
    finalPreferences: Object.fromEntries((Object.keys(ACTIONS) as DecisionState[]).map((state) => [
      state,
      Object.fromEntries(ACTIONS[state].map((action) => [action, actionAverage(state, action, 'finalPolicy')])),
    ])),
    routeSegmentReturns: Object.fromEntries(ACTIONS.ROUTE_CHOICE.map((route) => [
      route,
      rounded(average(profileRuns.map((run) => routeSegmentReturns(run)[route]))),
    ])),
  }));
  const checkpoints = [...new Set([1, rounds, 5, 10, 15, 20].filter((round) => round <= rounds))].sort((a, b) => a - b);
  for (const checkpoint of checkpoints) {
    const averagedTable = (source: 'policyAfter' | 'nextProbabilities') => Object.fromEntries(
      (Object.keys(ACTIONS) as DecisionState[]).map((state) => [
        state,
        Object.fromEntries(ACTIONS[state].map((action) => [
          action,
          rounded(average(profileRuns.map((run) => run.rounds[checkpoint - 1][source][state][action]))),
        ])),
      ]),
    );
    console.log(JSON.stringify({
      type: 'AGGREGATE_CHECKPOINT',
      profile,
      round: checkpoint,
      epsilon: profileRuns[0].rounds[checkpoint - 1].epsilon,
      policy: averagedTable('policyAfter'),
      probabilities: averagedTable('nextProbabilities'),
    }));
  }
}

const directionCount = (predicate: (safe: ProfileRun, fast: ProfileRun) => boolean): number => seeds.filter((seed) => {
  const safe = runs.find((run) => run.seed === seed && run.profile === 'SAFE')!;
  const fast = runs.find((run) => run.seed === seed && run.profile === 'FAST')!;
  return predicate(safe, fast);
}).length;

console.log(JSON.stringify({
  type: 'DIRECTION_COUNTS',
  totalSeeds: seeds.length,
  safeLowerCitizenRisk: directionCount((safe, fast) => safe.summary.avgCitizenRisk < fast.summary.avgCitizenRisk),
  safeLowerFacilityDamage: directionCount((safe, fast) => safe.summary.avgFacilityDamage < fast.summary.avgFacilityDamage),
  fastLowerElapsedTime: directionCount((safe, fast) => fast.summary.avgElapsedTime < safe.summary.avgElapsedTime),
  safeLowerPushProbability: directionCount((safe, fast) => safe.finalProbabilities.OBSTACLE.PUSH < fast.finalProbabilities.OBSTACLE.PUSH),
  safeLowerFastPassProbability: directionCount((safe, fast) => safe.finalProbabilities.CITIZEN_NEARBY.FAST_PASS < fast.finalProbabilities.CITIZEN_NEARBY.FAST_PASS),
  safeLowerFastShortcutProbability: directionCount((safe, fast) => safe.finalProbabilities.ROUTE_CHOICE.FAST_SHORTCUT < fast.finalProbabilities.ROUTE_CHOICE.FAST_SHORTCUT),
  safeHigherSafeCorridorProbability: directionCount((safe, fast) => safe.finalProbabilities.ROUTE_CHOICE.SAFE_CORRIDOR > fast.finalProbabilities.ROUTE_CHOICE.SAFE_CORRIDOR),
}));
