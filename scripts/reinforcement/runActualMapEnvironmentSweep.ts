import fs from 'node:fs';
import {
  ACTUAL_GRAPH_FILE,
  ACTUAL_MAP_FILES,
  buildActualMapEnvironment,
} from '../../src/modules/reinforcement/sim/actualMapEnvironment.ts';
import {
  ACTUAL_ENVIRONMENT_PRODUCTION_V1,
  runActualMapProfile,
  type ActualEnvironmentParameters,
  type ActualEpisode,
  type ActualRun,
} from '../../src/modules/reinforcement/sim/actualMapSimulation.ts';
import { ACTIONS, type DecisionState, type ProfileName } from '../../src/modules/reinforcement/sim/learningEngine.ts';

const SETS = {
  SET_A: { villain1Subdue: 0.80, villain2Subdue: 0.60, bossSubdue: 0.60, bossDistractedSubdue: 0.85, villainDistract: 0.90 },
  SET_B: { villain1Subdue: 0.85, villain2Subdue: 0.70, bossSubdue: 0.70, bossDistractedSubdue: 0.90, villainDistract: 0.95 },
  SET_C: { villain1Subdue: 0.90, villain2Subdue: 0.75, bossSubdue: 0.75, bossDistractedSubdue: 0.95, villainDistract: 0.95 },
  SET_D: ACTUAL_ENVIRONMENT_PRODUCTION_V1,
} as const satisfies Record<string, ActualEnvironmentParameters>;

const SEEDS = [7, 42, 1234, 2025, 9001];
const PROFILES: ProfileName[] = ['SAFE', 'FAST'];
const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const environment = buildActualMapEnvironment(ACTUAL_MAP_FILES.map(readJson), readJson(ACTUAL_GRAPH_FILE));
const average = (values: number[]): number | null => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const rounded = (value: number | null): number | null => value === null ? null : Number(value.toFixed(6));
const countActions = (episodes: ActualEpisode[], state: DecisionState, action?: string): number => episodes.reduce(
  (sum, episode) => sum + episode.actionHistory.filter(item => item.state === state && (!action || item.action === action)).length,
  0,
);
const histogram = (values: number[]) => ({
  0: values.filter(value => value === 0).length,
  1: values.filter(value => value === 1).length,
  2: values.filter(value => value === 2).length,
  '3+': values.filter(value => value >= 3).length,
});

type TaggedRun = { set: keyof typeof SETS; profile: ProfileName; seed: number; run: ActualRun };
const runs: TaggedRun[] = [];
for (const [set, parameters] of Object.entries(SETS) as Array<[keyof typeof SETS, ActualEnvironmentParameters]>) {
  for (const profile of PROFILES) {
    for (const seed of SEEDS) runs.push({ set, profile, seed, run: runActualMapProfile(environment, profile, seed, 20, 5, parameters) });
  }
}

function terminalCounts(episodes: ActualEpisode[]) {
  return Object.fromEntries(['GOAL_REACHED', 'TIMEOUT', 'CITIZEN_MISUNDERSTANDING', 'ROBOT_DISABLED'].map(reason => [reason, episodes.filter(episode => episode.terminalReason === reason).length]));
}

function rawSummary(tagged: TaggedRun) {
  const episodes = tagged.run.rounds.flatMap(round => round.episodes);
  const successful = episodes.filter(episode => episode.goalReached);
  return {
    set: tagged.set,
    profile: tagged.profile,
    seed: tagged.seed,
    terminal: terminalCounts(episodes),
    successRate: rounded(successful.length / episodes.length),
    averageSimulationTime: rounded(average(episodes.map(episode => episode.elapsedTime))),
    successfulAverageTime: rounded(average(successful.map(episode => episode.elapsedTime))),
    successfulMedianTime: rounded(median(successful.map(episode => episode.elapsedTime))),
    facilityDamage: episodes.reduce((sum, episode) => sum + episode.facilityDamageCount, 0),
    citizenRisk: episodes.reduce((sum, episode) => sum + episode.citizenRiskCount, 0),
    f5Reached: episodes.filter(episode => episode.actual.reachedFloors.includes(5)).length,
    bossReached: episodes.filter(episode => episode.actual.bossActions > 0).length,
    bossNeutralized: episodes.filter(episode => episode.actual.bossNeutralized).length,
  };
}

function failureSources(episodes: ActualEpisode[]) {
  const records = episodes.filter(episode => episode.terminalReason === 'ROBOT_DISABLED').map(episode => {
    const event = [...episode.eventHistory].reverse().find(candidate => candidate.type === 'ROBOT_DISABLED')!;
    const lastAction = [...episode.actionHistory].reverse().find(action => action.immediateEvents.includes('ROBOT_DISABLED'))!;
    return { source: lastAction.state === 'BOSS_ENCOUNTER' ? 'BOSS' : event.location, action: String(lastAction.action) };
  });
  return {
    bySource: Object.fromEntries([...new Set(records.map(record => record.source))].sort().map(source => [source, records.filter(record => record.source === source).length])),
    byTerminalAction: Object.fromEntries([...new Set(records.map(record => record.action))].sort().map(action => [action, records.filter(record => record.action === action).length])),
  };
}

function villainDiagnostic(episodes: ActualEpisode[]) {
  const diagnostic = {} as Record<string, Record<string, Record<string, number>>>;
  for (const count of [1, 2] as const) {
    const entries = episodes.flatMap(episode => episode.actual.villainDiagnostics).filter(item => item.villainCount === count);
    diagnostic[`x${count}`] = {};
    for (const action of ACTIONS.VILLAIN_ENCOUNTER) {
      const selected = entries.filter(entry => entry.action === action);
      if (!selected.length && action === 'BYPASS') continue;
      diagnostic[`x${count}`][action] = {
        attempts: selected.length,
        ...Object.fromEntries([...new Set(selected.map(entry => entry.outcome))].sort().map(outcome => [outcome, selected.filter(entry => entry.outcome === outcome).length])),
      };
    }
  }
  return diagnostic;
}

function routeChoices(episodes: ActualEpisode[]) {
  const routes = episodes.flatMap(episode => episode.actual.routeChoices);
  return Object.fromEntries([...new Set(routes)].sort().map(route => [route, routes.filter(candidate => candidate === route).length]));
}

function saturation(selectedRuns: TaggedRun[]) {
  let actionClampHits = 0;
  let routeClampHits = 0;
  for (const { run } of selectedRuns) {
    routeClampHits += Object.values(run.finalPolicy.ROUTE_CHOICE).filter(value => Math.abs(value) === 2).length;
    actionClampHits += (Object.keys(run.finalPolicy) as DecisionState[]).filter(state => state !== 'ROUTE_CHOICE')
      .reduce((sum, state) => sum + Object.values(run.finalPolicy[state]).filter(value => Math.abs(value) === 2).length, 0);
  }
  return { actionClampHits, routeClampHits };
}

function aggregate(selectedRuns: TaggedRun[]) {
  const episodes = selectedRuns.flatMap(({ run }) => run.rounds.flatMap(round => round.episodes));
  const successful = episodes.filter(episode => episode.goalReached);
  const bossReached = episodes.filter(episode => episode.actual.bossActions > 0);
  const roomGuardDiagnostics = episodes.flatMap(episode => episode.actual.villainDiagnostics).filter(item => item.zoneId.startsWith('F5_'));
  return {
    episodes: episodes.length,
    terminal: terminalCounts(episodes),
    successRate: rounded(successful.length / episodes.length),
    averageSimulationTime: rounded(average(episodes.map(episode => episode.elapsedTime))),
    successfulAverageTime: rounded(average(successful.map(episode => episode.elapsedTime))),
    successfulMedianTime: rounded(median(successful.map(episode => episode.elapsedTime))),
    facilityDamage: episodes.reduce((sum, episode) => sum + episode.facilityDamageCount, 0),
    citizenRisk: episodes.reduce((sum, episode) => sum + episode.citizenRiskCount, 0),
    actionCounts: {
      SUBDUE: countActions(episodes, 'VILLAIN_ENCOUNTER', 'SUBDUE') + countActions(episodes, 'BOSS_ENCOUNTER', 'SUBDUE'),
      FORCE_PASS: countActions(episodes, 'VILLAIN_ENCOUNTER', 'FORCE_PASS'),
      DISTRACT: countActions(episodes, 'VILLAIN_ENCOUNTER', 'DISTRACT') + countActions(episodes, 'BOSS_ENCOUNTER', 'DISTRACT'),
      PUSH: countActions(episodes, 'OBSTACLE', 'PUSH'),
      CLEAR: countActions(episodes, 'OBSTACLE', 'CLEAR'),
      FAST_PASS: countActions(episodes, 'CITIZEN_NEARBY', 'FAST_PASS'),
    },
    routes: routeChoices(episodes),
    failureSources: failureSources(episodes),
    villain: villainDiagnostic(episodes),
    f5: {
      reached: episodes.filter(episode => episode.actual.reachedFloors.includes(5)).length,
      averageSearchedRooms: rounded(average(episodes.map(episode => episode.actual.searchedRooms.length))),
      averageRoomsBeforeBoss: rounded(average(bossReached.map(episode => episode.actual.roomsSearchedBeforeBoss))),
      roomGuardEncounters: roomGuardDiagnostics.length,
      roomGuardRobotDisabled: episodes.filter(episode => episode.terminalReason === 'ROBOT_DISABLED'
        && episode.actionHistory.at(-1)?.state === 'VILLAIN_ENCOUNTER'
        && [...episode.actual.villainDiagnostics].at(-1)?.zoneId.startsWith('F5_')).length,
      bossEncounters: bossReached.length,
      bossSubdueAttempts: countActions(episodes, 'BOSS_ENCOUNTER', 'SUBDUE'),
      bossDistractUsage: countActions(episodes, 'BOSS_ENCOUNTER', 'DISTRACT'),
      bossRobotDisabled: episodes.filter(episode => episode.terminalReason === 'ROBOT_DISABLED' && episode.actionHistory.at(-1)?.state === 'BOSS_ENCOUNTER').length,
      bossNeutralized: episodes.filter(episode => episode.actual.bossNeutralized).length,
      controlRoomReached: episodes.filter(episode => episode.actual.controlRoomReached).length,
      goalReached: successful.length,
    },
    funnel: {
      started: episodes.length,
      floor2Reached: episodes.filter(episode => episode.actual.reachedFloors.includes(2)).length,
      floor2Passed: episodes.filter(episode => episode.actual.reachedFloors.includes(3)).length,
      floor3Passed: episodes.filter(episode => episode.actual.reachedFloors.includes(4)).length,
      floor4PassedF5Reached: episodes.filter(episode => episode.actual.reachedFloors.includes(5)).length,
      bossFound: bossReached.length,
      bossNeutralized: episodes.filter(episode => episode.actual.bossNeutralized).length,
      goalReached: successful.length,
    },
    normalization: {
      facilityDamage: histogram(episodes.map(episode => episode.facilityDamageCount)),
      citizenRisk: histogram(episodes.map(episode => episode.citizenRiskCount)),
    },
    saturation: saturation(selectedRuns),
  };
}

function bucketSummary(selectedRuns: TaggedRun[], from: number, to: number) {
  const rounds = selectedRuns.flatMap(({ run }) => run.rounds.filter(round => round.round >= from && round.round <= to));
  const episodes = rounds.flatMap(round => round.episodes);
  return {
    bucket: `${from}-${to}`,
    successRate: rounded(episodes.filter(episode => episode.goalReached).length / episodes.length),
    robotDisabledRate: rounded(episodes.filter(episode => episode.terminalReason === 'ROBOT_DISABLED').length / episodes.length),
    misunderstandingRate: rounded(episodes.filter(episode => episode.terminalReason === 'CITIZEN_MISUNDERSTANDING').length / episodes.length),
    averageSimulationTime: rounded(average(episodes.map(episode => episode.elapsedTime))),
    actions: {
      PUSH: countActions(episodes, 'OBSTACLE', 'PUSH'), CLEAR: countActions(episodes, 'OBSTACLE', 'CLEAR'),
      FAST_PASS: countActions(episodes, 'CITIZEN_NEARBY', 'FAST_PASS'), FORCE_PASS: countActions(episodes, 'VILLAIN_ENCOUNTER', 'FORCE_PASS'),
      SUBDUE: countActions(episodes, 'VILLAIN_ENCOUNTER', 'SUBDUE') + countActions(episodes, 'BOSS_ENCOUNTER', 'SUBDUE'),
      DISTRACT: countActions(episodes, 'VILLAIN_ENCOUNTER', 'DISTRACT') + countActions(episodes, 'BOSS_ENCOUNTER', 'DISTRACT'),
    },
    routes: routeChoices(episodes),
  };
}

console.log(JSON.stringify({ type: 'SWEEP_CONFIG', graph: ACTUAL_GRAPH_FILE, contractIssues: environment.contractIssues, timeLimit: environment.timeLimit, seeds: SEEDS, sets: SETS, profiles: PROFILES, episodes: runs.length * 100 }));
for (const tagged of runs) console.log(JSON.stringify({ type: 'RAW', ...rawSummary(tagged) }));
for (const set of Object.keys(SETS) as Array<keyof typeof SETS>) {
  for (const profile of PROFILES) {
    const selected = runs.filter(run => run.set === set && run.profile === profile);
    console.log(JSON.stringify({ type: 'AGGREGATE', set, profile, ...aggregate(selected) }));
    for (const [from, to] of [[1, 5], [6, 10], [11, 15], [16, 20]]) {
      console.log(JSON.stringify({ type: 'ROUND_BUCKET', set, profile, ...bucketSummary(selected, from, to) }));
    }
  }
}
