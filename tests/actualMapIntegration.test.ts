import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  ACTUAL_GRAPH_FILE,
  ACTUAL_MAP_FILES,
  F5_ROOMS,
  buildActualMapEnvironment,
} from '../src/modules/reinforcement/sim/actualMapEnvironment.ts';
import {
  ACTUAL_ENVIRONMENT_PRODUCTION_V1,
  runActualMapProfile,
} from '../src/modules/reinforcement/sim/actualMapSimulation.ts';

const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const environment = buildActualMapEnvironment(ACTUAL_MAP_FILES.map(readJson), readJson(ACTUAL_GRAPH_FILE));

test('actual map adapter derives traversal data and time from all five TMJ files', () => {
  assert.deepEqual(environment.floorCounts, [
    { floor: 1, nodes: 10, edges: 10, encounters: 4, transitions: 2, spawns: 1 },
    { floor: 2, nodes: 8, edges: 9, encounters: 4, transitions: 1, spawns: 2 },
    { floor: 3, nodes: 7, edges: 6, encounters: 6, transitions: 2, spawns: 1 },
    { floor: 4, nodes: 8, edges: 9, encounters: 4, transitions: 1, spawns: 2 },
    { floor: 5, nodes: 15, edges: 21, encounters: 4, transitions: 0, spawns: 1 },
  ]);
  assert.equal(environment.contexts.length, 6);
  assert.deepEqual(environment.contexts.map(context => context.options.length), [2, 2, 2, 2, 2, 2]);
  assert.ok(environment.edges.every(edge => edge.pixelLength > 0 && edge.tileLength === edge.simulationTime));
  assert.ok(environment.transitions.every(transition => environment.spawns.some(spawn => spawn.floor === transition.targetFloor && spawn.id === transition.targetSpawn)));
  assert.ok(environment.longestSafeSuccessBaseline > 0);
  assert.equal(environment.timeLimit, environment.longestSafeSuccessBaseline * 1.25);
  assert.deepEqual(environment.contractIssues, []);
});

test('production SET_D is the default while sweep parameters remain injectable', () => {
  const implicit = runActualMapProfile(environment, 'SAFE', 42, 3, 5);
  const explicit = runActualMapProfile(environment, 'SAFE', 42, 3, 5, ACTUAL_ENVIRONMENT_PRODUCTION_V1);
  const legacySetA = runActualMapProfile(environment, 'SAFE', 42, 3, 5, {
    villain1Subdue: 0.80, villain2Subdue: 0.60, bossSubdue: 0.60,
    bossDistractedSubdue: 0.85, villainDistract: 0.90,
  });
  assert.deepEqual(ACTUAL_ENVIRONMENT_PRODUCTION_V1, {
    villain1Subdue: 0.90, villain2Subdue: 0.80, bossSubdue: 0.80,
    bossDistractedSubdue: 0.95, villainDistract: 1.00,
  });
  assert.deepEqual(implicit, explicit);
  assert.notDeepEqual(implicit.summary.terminalCounts, legacySetA.summary.terminalCounts);
});

test('F5 exposes only canonical remaining-room state and requires the post-Boss goal chain', () => {
  assert.deepEqual(environment.f5Rooms.map(room => room.room), F5_ROOMS);
  assert.equal(new Set(environment.f5Rooms.map(room => room.guardZoneId)).size, 4);
  assert.deepEqual(environment.f5PostBossEdgeIds, ['E_F5_HALL_LOCK', 'E_F5_LOCK_CONTROL', 'E_F5_CONTROL_GOAL']);
});

test('actual map batch learning is reproducible, batched once per round, and terminally complete', () => {
  const first = runActualMapProfile(environment, 'SAFE', 42, 20, 5);
  const replay = runActualMapProfile(environment, 'SAFE', 42, 20, 5);
  const different = runActualMapProfile(environment, 'SAFE', 43, 20, 5);
  assert.deepEqual(first, replay);
  assert.notDeepEqual(first.summary.terminalCounts, different.summary.terminalCounts);
  assert.equal(first.summary.episodes, 100);
  assert.equal(first.summary.updates, 20);
  assert.ok(first.rounds.every(round => round.updateCount === 1 && round.centralPolicyUnchangedDuringEpisodes));
  assert.ok(first.rounds.every(round => round.combatSkillUpdateCount === 1));
  assert.ok(first.rounds.every(round => new Set(round.snapshotSignatures).size === 1));
  const episodes = first.rounds.flatMap(round => round.episodes);
  assert.ok(episodes.every(episode => ['GOAL_REACHED', 'TIMEOUT', 'MISUNDERSTANDING', 'ROBOT_DISABLED'].includes(episode.terminalReason)));
  assert.ok(episodes.every(episode => episode.actual.hiddenBossExposedToPolicy === false));
  assert.ok(episodes.every(episode => new Set(episode.actual.searchedRooms).size === episode.actual.searchedRooms.length));
  assert.ok(episodes.every(episode => episode.actual.guardNeutralizations >= episode.actual.searchedRooms.length));
  assert.ok(episodes.filter(episode => episode.goalReached).every(episode => {
    const events = episode.eventHistory.map(event => event.type);
    return events.indexOf('BOSS_NEUTRALIZED') < events.indexOf('SECURITY_LOCK_OPEN')
      && events.indexOf('SECURITY_LOCK_OPEN') < events.indexOf('SYSTEM_RESTORED')
      && events.indexOf('SYSTEM_RESTORED') < events.indexOf('GOAL_REACHED');
  }));
});

test('v3 judgment and speed profiles learn measurably different outcomes on actual maps', () => {
  const safe = runActualMapProfile(environment, 'SAFE', 42, 20, 5).summary;
  const fast = runActualMapProfile(environment, 'FAST', 42, 20, 5).summary;
  assert.notDeepEqual(safe.terminalCounts, fast.terminalCounts);
  assert.notDeepEqual(safe.finalPreferences.routes, fast.finalPreferences.routes);
});
