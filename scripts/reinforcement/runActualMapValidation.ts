import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ACTUAL_GRAPH_FILE,
  ACTUAL_MAP_FILES,
  buildActualMapEnvironment,
} from '../../src/modules/reinforcement/sim/actualMapEnvironment.ts';
import {
  ACTUAL_ENVIRONMENT_PRODUCTION_V1,
  runActualMapProfile,
  type ActualEpisode,
  type ActualRun,
} from '../../src/modules/reinforcement/sim/actualMapSimulation.ts';
import { ACTIONS, isTerminalEvent, softmaxWithExploration } from '../../src/modules/reinforcement/sim/learningEngine.ts';

const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const environment = buildActualMapEnvironment(ACTUAL_MAP_FILES.map(readJson), readJson(ACTUAL_GRAPH_FILE));
const seeds = [7, 42, 1234, 2025, 9001];
const runs = (['SAFE', 'FAST'] as const).flatMap(profile => seeds.map(seed => runActualMapProfile(environment, profile, seed, 20, 5)));
const rounded = (value: number | null): number | null => value === null ? null : Number(value.toFixed(6));
const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const sumRecords = (records: Array<Record<string, number>>): Record<string, number> => Object.fromEntries(
  [...new Set(records.flatMap(record => Object.keys(record)))].sort().map(key => [key, records.reduce((sum, record) => sum + (record[key] ?? 0), 0)]),
);
const averageRecords = (records: Array<Record<string, number>>): Record<string, number> => Object.fromEntries(
  Object.entries(sumRecords(records)).map(([key, value]) => [key, rounded(value / records.length)]),
);

function assertValidRun(run: ActualRun): void {
  assert.equal(run.rounds.length, 20);
  assert.equal(run.summary.episodes, 100);
  assert.equal(run.summary.updates, 20);
  for (const round of run.rounds) {
    assert.equal(round.episodes.length, 5);
    assert.equal(round.updateCount, 1);
    assert.equal(round.centralPolicyUnchangedDuringEpisodes, true);
    assert.equal(new Set(round.snapshotSignatures).size, 1);
    assert.equal(round.snapshotSignatures[0], JSON.stringify(round.snapshot));
    assert.ok(Object.values(round.policyAfter).flatMap(Object.values).every(value => Number.isFinite(value) && value >= -2 && value <= 2));
  }
  const episodes = run.rounds.flatMap(round => round.episodes);
  assert.ok(episodes.some(episode => episode.actual.reachedFloors.includes(5)));
  for (const episode of episodes) {
    assert.equal(episode.actual.hiddenBossExposedToPolicy, false);
    assert.equal(new Set(episode.actual.searchedRooms).size, episode.actual.searchedRooms.length);
    assert.ok(episode.actual.guardNeutralizations >= episode.actual.searchedRooms.length);
    assert.equal(episode.goalReached, episode.terminalReason === 'GOAL_REACHED');
    assert.ok(isTerminalEvent(episode.eventHistory.at(-1)!.type));
    assert.ok(episode.actionHistory.every(action => Number.isFinite(action.actionCredit)));
    if (episode.actual.bossActions > 0) assert.ok(episode.actual.searchedRooms.includes(episode.actual.bossRoom));
    if (episode.goalReached) {
      const events = episode.eventHistory.map(event => event.type);
      assert.ok(events.indexOf('BOSS_NEUTRALIZED') < events.indexOf('SECURITY_LOCK_OPEN'));
      assert.ok(events.indexOf('SECURITY_LOCK_OPEN') < events.indexOf('SYSTEM_RESTORED'));
      assert.ok(events.indexOf('SYSTEM_RESTORED') < events.indexOf('GOAL_REACHED'));
      assert.equal(episode.actual.controlRoomReached, true);
      assert.equal(episode.actual.systemRestored, true);
    }
  }
  const actionGroups = Object.entries(ACTIONS).filter(([state]) => state !== 'ROUTE_CHOICE');
  for (const [state, actions] of actionGroups) {
    const probabilities = softmaxWithExploration(run.finalPolicy[state as keyof typeof ACTIONS], actions, 0.10);
    assert.ok(Object.values(probabilities).every(value => Number.isFinite(value) && value >= 0));
    assert.ok(Math.abs(Object.values(probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  }
  for (const route of episodes.flatMap(episode => episode.actionHistory).filter(action => action.state === 'ROUTE_CHOICE')) {
    const probabilities = softmaxWithExploration(run.finalPolicy.ROUTE_CHOICE, route.routeOptions!, 0.10);
    assert.ok(Object.values(probabilities).every(value => Number.isFinite(value) && value >= 0));
    assert.ok(Math.abs(Object.values(probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  }
}

for (const run of runs) assertValidRun(run);
for (const profile of ['SAFE', 'FAST'] as const) {
  const original = runs.find(run => run.profile === profile && run.seed === seeds[0])!;
  assert.deepEqual(runActualMapProfile(environment, profile, seeds[0], 20, 5), original);
}

function failureSources(episodes: ActualEpisode[]): Record<string, number> {
  const sources = episodes.filter(episode => episode.terminalReason === 'ROBOT_DISABLED').map(episode => {
    const disabledAction = [...episode.actionHistory].reverse().find(action => action.immediateEvents.includes('ROBOT_DISABLED'))!;
    if (disabledAction.state === 'BOSS_ENCOUNTER') return 'BOSS';
    if (String(disabledAction.action).startsWith('SUBDUE')) {
      const location = [...episode.eventHistory].reverse().find(event => event.type === 'ROBOT_DISABLED')!.location;
      if (location.startsWith('F2_')) return 'F2_GUARD';
      if (location.startsWith('F3_')) return 'F3_GUARD';
      if (location.startsWith('F4_')) return 'F4_GUARD';
      if (location.startsWith('F5_')) return 'F5_ROOM_GUARD';
    }
    return 'OTHER';
  });
  return Object.fromEntries(['F2_GUARD', 'F3_GUARD', 'F4_GUARD', 'F5_ROOM_GUARD', 'BOSS', 'OTHER'].map(source => [source, sources.filter(value => value === source).length]));
}

console.log(JSON.stringify({
  type: 'ACTUAL_MAP_CONFIG',
  sources: { maps: ACTUAL_MAP_FILES, graph: ACTUAL_GRAPH_FILE },
  floorCounts: environment.floorCounts,
  contexts: environment.contexts.map(context => ({ id: context.id, routes: context.options.map(option => option.id) })),
  polylineTotals: Object.fromEntries(environment.floorCounts.map(({ floor }) => {
    const floorEdges = environment.edges.filter(edge => edge.floor === floor);
    return [floor, {
      pixels: rounded(floorEdges.reduce((sum, edge) => sum + edge.pixelLength, 0)),
      tiles: rounded(floorEdges.reduce((sum, edge) => sum + edge.tileLength, 0)),
      simulationTime: rounded(floorEdges.reduce((sum, edge) => sum + edge.simulationTime, 0)),
    }];
  })),
  longestSafeSuccessBaseline: rounded(environment.longestSafeSuccessBaseline),
  timeLimit: rounded(environment.timeLimit),
  productionEnvironment: ACTUAL_ENVIRONMENT_PRODUCTION_V1,
  seeds,
  profiles: ['SAFE', 'FAST'],
  robotsPerRound: 5,
  rounds: 20,
  contractIssues: environment.contractIssues,
  deterministicReplay: 'SAFE/7 and FAST/7 exact',
  structuralValidation: 'PASS',
}));

for (const run of runs) console.log(JSON.stringify({ type: 'ACTUAL_MAP_RUN', profile: run.profile, seed: run.seed, summary: run.summary }));

for (const profile of ['SAFE', 'FAST'] as const) {
  const selected = runs.filter(run => run.profile === profile);
  const summaries = selected.map(run => run.summary);
  const episodes = selected.flatMap(run => run.rounds.flatMap(round => round.episodes));
  const successful = episodes.filter(episode => episode.goalReached);
  const routeGroups = [
    ...environment.contexts.map(context => ({ context: context.id, actions: context.options.map(option => option.action) })),
    { context: 'F5_ROOM_SEARCH[L1,L2,R1,R2]', actions: environment.f5Rooms.map(room => room.action) },
  ];
  const sumCounts = (key: 'facilityDamageCount' | 'citizenRiskCount') => summaries.reduce((sum, summary) => sum + summary[key], 0);
  console.log(JSON.stringify({
    type: 'ACTUAL_MAP_AGGREGATE', profile,
    episodes: summaries.reduce((sum, summary) => sum + summary.episodes, 0),
    updates: summaries.reduce((sum, summary) => sum + summary.updates, 0),
    successRate: rounded(successful.length / episodes.length),
    averageSuccessTime: rounded(average(successful.map(episode => episode.elapsedTime))),
    medianSuccessTime: rounded(median(successful.map(episode => episode.elapsedTime))),
    averageElapsedTime: rounded(average(episodes.map(episode => episode.elapsedTime))),
    facilityDamageCount: sumCounts('facilityDamageCount'),
    citizenRiskCount: sumCounts('citizenRiskCount'),
    encounterTriggerCounts: sumRecords(summaries.map(summary => summary.encounterTriggerCounts)),
    routeChoiceCounts: sumRecords(summaries.map(summary => summary.routeChoiceCounts)),
    obstacleActionCounts: sumRecords(summaries.map(summary => summary.obstacleActionCounts)),
    citizenActionCounts: sumRecords(summaries.map(summary => summary.citizenActionCounts)),
    ambiguousActionCounts: sumRecords(summaries.map(summary => summary.ambiguousActionCounts)),
    villainActionCounts: sumRecords(summaries.map(summary => summary.villainActionCounts)),
    bossActionCounts: sumRecords(summaries.map(summary => summary.bossActionCounts)),
    bossRoomDistribution: sumRecords(summaries.map(summary => summary.bossRoomDistribution)),
    averageRoomsSearched: rounded(average(summaries.map(summary => summary.averageRoomsSearched))),
    averageRoomsSearchedToBoss: rounded(average(summaries.flatMap(summary => summary.averageRoomsSearchedToBoss === null ? [] : [summary.averageRoomsSearchedToBoss]))),
    averageRoomsSearchedBeforeBoss: rounded(average(summaries.map(summary => summary.averageRoomsSearchedBeforeBoss))),
    terminalCounts: Object.fromEntries(Object.keys(summaries[0].terminalCounts).map(reason => [reason, summaries.reduce((sum, summary) => sum + summary.terminalCounts[reason], 0)])),
    failureSources: failureSources(episodes),
    f5Funnel: {
      f5Reached: episodes.filter(episode => episode.actual.reachedFloors.includes(5)).length,
      bossFound: episodes.filter(episode => episode.actual.bossActions > 0).length,
      bossNeutralized: episodes.filter(episode => episode.actual.bossNeutralized).length,
      controlRoomReached: episodes.filter(episode => episode.actual.controlRoomReached).length,
      goalReached: successful.length,
    },
    meanFinalPreferences: {
      routes: averageRecords(summaries.map(summary => summary.finalPreferences.routes)),
      obstacle: averageRecords(summaries.map(summary => summary.finalPreferences.obstacle)),
      citizen: averageRecords(summaries.map(summary => summary.finalPreferences.citizen)),
      ambiguous: averageRecords(summaries.map(summary => summary.finalPreferences.ambiguous)),
      villain: averageRecords(summaries.map(summary => summary.finalPreferences.villain)),
      boss: averageRecords(summaries.map(summary => summary.finalPreferences.boss)),
    },
    meanFinalProbabilities: {
      routes: Object.fromEntries(routeGroups.map(group => [group.context, averageRecords(selected.map(run => softmaxWithExploration(run.finalPolicy.ROUTE_CHOICE, group.actions, 0.10)))])),
      obstacle: averageRecords(summaries.map(summary => summary.finalProbabilities.obstacle)),
      citizen: averageRecords(summaries.map(summary => summary.finalProbabilities.citizen)),
      ambiguous: averageRecords(summaries.map(summary => summary.finalProbabilities.ambiguous)),
      villain: averageRecords(summaries.map(summary => summary.finalProbabilities.villain)),
      boss: averageRecords(summaries.map(summary => summary.finalProbabilities.boss)),
    },
    clampHits: summaries.reduce((sum, summary) => sum + summary.clampHits, 0),
  }));
}
