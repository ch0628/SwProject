import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { axisAlignedBounds, properties } from '../src/modules/reinforcement/debug/floor1Tiled.ts';
import { ACTUAL_GRAPH_FILE, ACTUAL_MAP_FILES, buildActualMapEnvironment, type ActualRouteOption } from '../src/modules/reinforcement/sim/actualMapEnvironment.ts';
import { runActualMapTraining } from '../src/modules/reinforcement/sim/actualMapSimulation.ts';
import { ACTIONS, episodeSeed, rewardWeightsFromStars, type ActionExperience } from '../src/modules/reinforcement/sim/learningEngine.ts';
import {
  createRuntimeCommands,
  directionTowardTarget,
  orientedPath,
  type RuntimeCommand,
} from '../src/modules/reinforcement/runtime/runtimeCommands.ts';
import { createRuntimePresentation, entitiesForFloor } from '../src/modules/reinforcement/runtime/runtimePresentation.ts';
import { movementPathIsClear, planLocalBypass, planLocalRetreat, runtimeVisualFootprint } from '../src/modules/reinforcement/runtime/runtimeMovement.ts';
import { OBSERVATION_ROUNDS } from '../src/modules/reinforcement/runtime/runtimeController.ts';

const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const maps = ACTUAL_MAP_FILES.map(readJson);
const environment = buildActualMapEnvironment(maps, readJson(ACTUAL_GRAPH_FILE));
const weights = rewardWeightsFromStars({ speed: 1, judgment: 3, threat: 2 });
const baseline = runActualMapTraining(environment, weights, 71, 1, 1).rounds[0].episodes[0];

const routeAction = (option: ActualRouteOption, routeStartNode = option.startNodeId): ActionExperience => ({
  state: 'ROUTE_CHOICE', action: option.action, location: option.id, elapsedCost: 1,
  immediateEvents: [], localOutcome: 'MOVING', localReturn: 0, actionCredit: 0,
  routeContext: option.contextId, routeStartNode, routeOptions: [option.action],
});

const encounterAction = (
  location: string,
  action: string,
  localOutcome: string,
  immediateEvents: ActionExperience['immediateEvents'] = [],
  state: ActionExperience['state'] = 'VILLAIN_ENCOUNTER',
): ActionExperience => ({
  state, action: action as ActionExperience['action'], location, elapsedCost: 1,
  immediateEvents, localOutcome, localReturn: 0, actionCredit: 0,
});

const syntheticEpisode = (actionHistory: ActionExperience[], reachedFloors: number[] = [1]) => ({
  ...structuredClone(baseline),
  actionHistory,
  elapsedTime: actionHistory.reduce((sum, action) => sum + action.elapsedCost, 0),
  terminalReason: 'TIMEOUT' as const,
  goalReached: false,
  actual: { ...structuredClone(baseline.actual), reachedFloors },
});

const context = (id: string) => environment.contexts.find(candidate => candidate.id === id)!;
const villainZone = (option: ActualRouteOption) => option.encounterZoneIds
  .map(id => environment.zones.find(zone => zone.id === id)!)
  .find(zone => zone.kind === 'VILLAIN_ENCOUNTER')!;

test('A/B: F1 and F3 reroutes return to their decision node and take the alternate transition without Spawn reset', () => {
  for (const [contextId, decisionNode] of [['F1_ENTRY_SPLIT', 'F1_ENTRY_SPLIT'], ['F3_STAIR_SPLIT', 'F3_CENTER_ARRIVAL']] as const) {
    const [left, right] = context(contextId).options;
    const zoneId = contextId === 'F1_ENTRY_SPLIT' ? left.encounterZoneIds[0] : villainZone(left).id;
    const replay = createRuntimeCommands(environment, syntheticEpisode([
      routeAction(left),
      encounterAction(zoneId, 'RETREAT', 'RETREAT'),
      routeAction(right, right.decisionNodeId),
    ], [left.floor]), 101);
    const retreatOutcome = replay.findIndex(command => command.type === 'OUTCOME' && command.outcome === 'RETREAT');
    const retreatMoveIndex = replay.findIndex((command, index) => index > retreatOutcome && command.type === 'MOVE');
    const retreatMove = replay[retreatMoveIndex];
    const alternateMove = replay.slice(retreatMoveIndex + 1).find(command => command.type === 'MOVE');
    assert.ok(retreatMove.type === 'MOVE');
    assert.ok(alternateMove?.type === 'MOVE');
    const decisionPoint = orientedPath(environment, left.decisionEdgeIds, left.decisionNodeId).points[0];
    assert.deepEqual(retreatMove.points.at(-1), decisionPoint, contextId);
    assert.equal(retreatMove.logicalTargetNode, decisionNode, contextId);
    assert.deepEqual(alternateMove.points[0], decisionPoint, contextId);
    assert.equal(alternateMove.edgeIds[0], right.decisionEdgeIds[0], contextId);
    assert.notEqual(retreatMove.logicalTargetNode, 'F1_START', contextId);
  }
});

test('C/D: F2 and F4 RETREAT is one collision-free tile out-and-back inside the same encounter', () => {
  for (const floor of [2, 4]) {
    const option = environment.contexts.find(candidate => candidate.floor === floor)!.options[0];
    const zone = villainZone(option);
    const replay = createRuntimeCommands(environment, syntheticEpisode([
      routeAction(option),
      encounterAction(zone.id, 'RETREAT', 'RETREAT'),
      encounterAction(zone.id, 'SUBDUE', 'VILLAIN_NEUTRALIZED', ['VILLAIN_NEUTRALIZED']),
    ], [floor]), 102 + floor);
    const localIndex = replay.findIndex(command => command.type === 'LOCAL_RETREAT');
    assert.ok(localIndex > 0, `F${floor}`);
    const local = replay[localIndex];
    assert.ok(local.type === 'LOCAL_RETREAT');
    assert.equal(local.distance, 32);
    assert.equal(replay.filter(command => command.type === 'ENCOUNTER' && command.phase === 'START' && command.zoneId === zone.id).length, 1);
    assert.equal(replay.slice(localIndex + 1).find(command => command.type === 'ACTION')?.type, 'ACTION');
    assert.equal(replay.slice(localIndex + 1).find(command => command.type === 'ACTION' || command.type === 'MOVE')?.type, 'ACTION');
    const map = maps[floor - 1];
    const walls = (map.layers.find(layer => layer.name === 'Collision')?.objects ?? [])
      .filter(object => properties(object).blocksRobot !== false && object.width > 0 && object.height > 0)
      .map(axisAlignedBounds);
    const plan = planLocalRetreat(local.stagingPosition, local.incomingDirection, local.distance,
      { x: 0, y: 0, width: map.width * map.tilewidth, height: map.height * map.tileheight }, walls);
    assert.equal(plan.valid, true, `F${floor}`);
    assert.deepEqual(plan.points.at(-1), local.stagingPosition, `F${floor}`);
  }
});

test('E/F: only an explicit F5 Guard RETREAT returns to Search Hub; alive SUBDUE recovery stays at the Guard', () => {
  const room = environment.f5Rooms[0];
  const guard = environment.zones.find(zone => zone.id === room.guardZoneId)!;
  const route = encounterAction(room.room, room.action, 'APPROACH_ROOM_GUARD', [], 'ROUTE_CHOICE');
  route.routeContext = 'F5_ROOM_SEARCH[L1,L2,R1,R2]';
  route.routeOptions = [room.action];
  const retreatReplay = createRuntimeCommands(environment, syntheticEpisode([
    route,
    encounterAction(guard.id, 'RETREAT', 'RETREAT'),
  ], [5]), 200);
  const retreatMove = retreatReplay.findLast(command => command.type === 'MOVE');
  assert.ok(retreatMove?.type === 'MOVE');
  assert.equal(retreatMove.logicalTargetNode, 'F5_SEARCH_HUB');

  const recoveryReplay = createRuntimeCommands(environment, syntheticEpisode([
    route,
    encounterAction(guard.id, 'SUBDUE', 'SUBDUE_RECOVERY', ['ROBOT_DAMAGE']),
    encounterAction(guard.id, 'SUBDUE', 'VILLAIN_NEUTRALIZED', ['VILLAIN_NEUTRALIZED']),
  ], [5]), 201);
  const recoveryIndex = recoveryReplay.findIndex(command => command.type === 'STATE_CHANGE' && command.change === 'ROBOT_RECOVERY');
  assert.ok(recoveryIndex > 0);
  const next = recoveryReplay.slice(recoveryIndex + 1).find(command => command.type === 'ACTION' || command.type === 'MOVE');
  assert.equal(next?.type, 'ACTION');
  assert.equal(next?.type === 'ACTION' && next.zoneId, guard.id);
});

test('G-J: Boss is SUBDUE-only and Boss recovery never emits NO_BOSS_RETURN, room reselection, or Spawn recovery', () => {
  assert.deepEqual(ACTIONS.BOSS_ENCOUNTER, ['SUBDUE']);
  const training = runActualMapTraining(environment, weights, 42, 20, 5);
  let bossRecoveries = 0;
  for (const round of training.rounds) for (const episode of round.episodes) {
    assert.ok(episode.actionHistory.filter(action => action.state === 'BOSS_ENCOUNTER').every(action => action.action === 'SUBDUE'));
    const commands = createRuntimeCommands(environment, episode, episodeSeed(42, round.round, episode.robot));
    const found = commands.findIndex(command => command.type === 'STATE_CHANGE' && command.change === 'BOSS_FOUND');
    if (found < 0) continue;
    const bossNeutralized = commands.findIndex((command, index) => index > found && command.type === 'STATE_CHANGE' && command.change === 'BOSS_NEUTRALIZED');
    const activeBoss = commands.slice(found + 1, bossNeutralized < 0 ? undefined : bossNeutralized);
    assert.equal(activeBoss.some(command => command.type === 'STATE_CHANGE' && command.change === 'NO_BOSS'), false);
    assert.equal(activeBoss.some(command => command.type === 'MOVE' && command.edgeIds.some(id => id.includes('NO_BOSS'))), false);
    for (const [index, command] of activeBoss.entries()) {
      if (command.type !== 'STATE_CHANGE' || command.change !== 'ROBOT_RECOVERY') continue;
      bossRecoveries++;
      const next = activeBoss.slice(index + 1).find(candidate => candidate.type === 'ACTION' || candidate.type === 'MOVE' || candidate.type === 'TERMINAL');
      assert.ok(next?.type === 'ACTION' || next?.type === 'TERMINAL');
      if (next?.type === 'ACTION') assert.equal(next.state, 'BOSS_ENCOUNTER');
    }
  }
  assert.ok(bossRecoveries > 0);
});

test('K/L: Citizen and Ambiguous nonterminal outcomes emit a three-segment collision-free local bypass with deterministic right fallback', () => {
  const floor1 = context('F1_ENTRY_SPLIT').options[0];
  const citizen = environment.zones.find(zone => zone.id === floor1.encounterZoneIds[0])!;
  const floor2 = environment.contexts.find(candidate => candidate.floor === 2)!.options[0];
  const ambiguous = floor2.encounterZoneIds.map(id => environment.zones.find(zone => zone.id === id)!).find(zone => zone.kind === 'AMBIGUOUS_PERSON')!;
  for (const [option, zone, action, outcome] of [[floor1, citizen, 'SLOW_PASS', 'PASSED_SAFELY'], [floor2, ambiguous, 'OBSERVE', 'CITIZEN_OBSERVE']] as const) {
    const replay = createRuntimeCommands(environment, syntheticEpisode([
      routeAction(option), encounterAction(zone.id, action, outcome, [], zone.kind),
    ], [option.floor]), 301);
    const bypass = replay.find(command => command.type === 'LOCAL_BYPASS');
    assert.ok(bypass?.type === 'LOCAL_BYPASS');
    const presentation = createRuntimePresentation(replay, maps);
    const target = Object.values(presentation.entities).find(entity => entity.zoneId === zone.id)!;
    const map = maps[option.floor - 1];
    const bounds = { x: 0, y: 0, width: map.width * map.tilewidth, height: map.height * map.tileheight };
    const walls = (map.layers.find(layer => layer.name === 'Collision')?.objects ?? [])
      .filter(object => properties(object).blocksRobot !== false && object.width > 0 && object.height > 0).map(axisAlignedBounds);
    const targetBlocker = { id: target.id, point: target.position, footprint: runtimeVisualFootprint(target.kind) };
    const blockers = [...entitiesForFloor(presentation, option.floor).filter(entity => entity.blocking)
      .map(entity => ({ id: entity.id, point: entity.position, footprint: runtimeVisualFootprint(entity.kind) })), targetBlocker];
    const plan = planLocalBypass(bypass.stagingPosition, target.position, bypass.incomingDirection, targetBlocker.footprint, 32, bounds, walls, blockers);
    assert.equal(plan.valid, true);
    assert.equal(plan.points.length, 4);
    assert.equal(movementPathIsClear(plan.points, runtimeVisualFootprint('ROBOT'), bounds, walls, blockers), true);
  }

  const target = { x: 100, y: 100 };
  const targetFootprint = runtimeVisualFootprint('CITIZEN');
  const blocker = [{ id: 'person', point: target, footprint: targetFootprint }];
  const right = planLocalBypass({ x: 50, y: 100 }, target, { x: 1, y: 0 }, targetFootprint, 32,
    { x: 0, y: 0, width: 200, height: 200 }, [{ x: 35, y: 55, width: 100, height: 25 }], blocker);
  assert.equal(right.side, 'RIGHT');
  const blocked = planLocalBypass({ x: 50, y: 100 }, target, { x: 1, y: 0 }, targetFootprint, 32,
    { x: 0, y: 0, width: 200, height: 200 }, [{ x: 35, y: 55, width: 100, height: 25 }, { x: 35, y: 120, width: 100, height: 25 }], blocker);
  assert.equal(blocked.valid, false);
  assert.equal(blocked.side, 'NONE');
});

test('M-O: facing uses Robot-to-target geometry and SUBDUE presentation is one repetition for Villain, two for Boss, before OUTCOME', () => {
  assert.equal(directionTowardTarget({ x: 10, y: 100 }, { x: 10, y: 20 }), 'UP');
  assert.equal(directionTowardTarget({ x: 10, y: 20 }, { x: 10, y: 100 }), 'DOWN');
  assert.equal(directionTowardTarget({ x: 100, y: 10 }, { x: 20, y: 10 }), 'LEFT');
  assert.equal(directionTowardTarget({ x: 20, y: 10 }, { x: 100, y: 10 }), 'RIGHT');
  const scene = fs.readFileSync('src/modules/reinforcement/runtime/ReinforcementRuntimeScene.ts', 'utf8');
  assert.match(scene, /faceEncounter\(command\.zoneId\)/);
  assert.match(scene, /command\.state === 'BOSS_ENCOUNTER' \? 2 : 1/);
  assert.match(scene, /for \(let repetition = 0; repetition < repetitions; repetition\+\+\)/);
  assert.doesNotMatch(scene.slice(scene.indexOf('private handleStateChange'), scene.indexOf('private tweenTo')), /animateSubdueAttempt/);
  const runtime = fs.readFileSync('src/modules/reinforcement/runtime/runtimeCommands.ts', 'utf8');
  assert.match(runtime, /type: 'ACTION'[\s\S]*type: 'OUTCOME'/);
});

test('P: hidden rounds show status only while Phaser runtimes remain limited to checkpoints 1/5/10/15/20', () => {
  assert.deepEqual(OBSERVATION_ROUNDS, [1, 5, 10, 15, 20]);
  const app = fs.readFileSync('src/modules/reinforcement/runtime/ReinforcementTrainingApp.tsx', 'utf8');
  assert.match(app, /HEADLESS_LEARNING/);
  assert.match(app, /다음 관찰을 위해 로봇들이 학습하고 있어요/);
  assert.match(app, /requestAnimationFrame\(\(\) => requestAnimationFrame/);
  assert.doesNotMatch(app, /setTimeout/);
});
