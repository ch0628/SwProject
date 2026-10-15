import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { axisAlignedBounds, decompressTileLayers, properties } from '../src/modules/reinforcement/debug/floor1Tiled.ts';
import { episodeSeed, PROFILES, rewardWeightsFromStars } from '../src/modules/reinforcement/sim/learningEngine.ts';
import { ACTUAL_GRAPH_FILE, ACTUAL_MAP_FILES, buildActualMapEnvironment } from '../src/modules/reinforcement/sim/actualMapEnvironment.ts';
import { runActualMapProfile, runActualMapTraining } from '../src/modules/reinforcement/sim/actualMapSimulation.ts';
import { FiveRobotRuntimeController } from '../src/modules/reinforcement/runtime/runtimeController.ts';
import {
  applyRuntimeCommand,
  createRuntimeCommands,
  directionForSegment,
  initialRuntimePlaybackState,
  orientedPath,
  RUNTIME_CHARACTER_STAGING_GAP,
  RUNTIME_CONTACT_FOOTPRINTS,
  RUNTIME_SECURE_ENTRANCE_FOOTPRINT,
  RUNTIME_STAGING_GAP,
  stageEncounterOnPath,
  type RuntimePoint,
} from '../src/modules/reinforcement/runtime/runtimeCommands.ts';
import {
  applyRuntimePresentationCommand,
  createRuntimePresentation,
  entitiesForFloor,
  presentationMotionForCommand,
  resolveRuntimePublicPath,
  setRuntimeCoreState,
} from '../src/modules/reinforcement/runtime/runtimePresentation.ts';
import {
  forwardRejoinPolyline,
  movementPathIsClear,
  planDistractMovement,
  planLocalMovement,
  projectRouteProgress,
  runtimeVisualFootprint,
} from '../src/modules/reinforcement/runtime/runtimeMovement.ts';
import {
  RUNTIME_BASE_DISPLAY_HEIGHT,
  RUNTIME_CHARACTER_SCALE,
  RUNTIME_ENVIRONMENT_VISUAL_CONFIG,
  RUNTIME_VISUAL_CONFIG,
  planSecureEntrance,
  runtimeRobotEncounterState,
  runtimeRobotTexture,
  runtimeSearchDoorTexture,
} from '../src/modules/reinforcement/runtime/runtimeVisualConfig.ts';

const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const mapSources = ACTUAL_MAP_FILES.map(readJson);
const environment = buildActualMapEnvironment(mapSources, readJson(ACTUAL_GRAPH_FILE));
const run = runActualMapProfile(environment, 'FAST', 2, 1, 1);
const episode = run.rounds[0].episodes[0];
const seed = episodeSeed(2, 1, 1);
const commands = createRuntimeCommands(environment, episode, seed);
const presentation = createRuntimePresentation(commands, mapSources);

const pointOnSegment = (point: RuntimePoint, from: RuntimePoint, to: RuntimePoint) => {
  const cross = (point.x - from.x) * (to.y - from.y) - (point.y - from.y) * (to.x - from.x);
  const dot = (point.x - from.x) * (to.x - from.x) + (point.y - from.y) * (to.y - from.y);
  const lengthSquared = (to.x - from.x) ** 2 + (to.y - from.y) ** 2;
  return Math.abs(cross) < 0.001 && dot >= -0.001 && dot <= lengthSquared + 0.001;
};

const distanceOnPath = (points: readonly RuntimePoint[], target: RuntimePoint) => {
  let travelled = 0;
  let best = { distance: 0, error: Number.POSITIVE_INFINITY };
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared ? Math.max(0, Math.min(1, ((target.x - from.x) * dx + (target.y - from.y) * dy) / lengthSquared)) : 0;
    const projected = { x: from.x + dx * ratio, y: from.y + dy * ratio };
    const error = Math.hypot(projected.x - target.x, projected.y - target.y);
    if (error < best.error) best = { distance: travelled + Math.sqrt(lengthSquared) * ratio, error };
    travelled += Math.sqrt(lengthSquared);
  }
  return best.distance;
};

const footprintGap = (
  left: RuntimePoint,
  leftFootprint: { width: number; height: number },
  right: RuntimePoint,
  rightFootprint: { width: number; height: number },
) => Math.hypot(
  Math.max(0, Math.abs(left.x - right.x) - (leftFootprint.width + rightFootprint.width) / 2),
  Math.max(0, Math.abs(left.y - right.y) - (leftFootprint.height + rightFootprint.height) / 2),
);

test('runtime adapter deterministically replays only headless-selected decisions', () => {
  assert.deepEqual(commands, createRuntimeCommands(environment, episode, seed));
  assert.deepEqual(commands.filter(command => command.type === 'ACTION').map(command => command.action), episode.actionHistory.filter(action => action.state !== 'ROUTE_CHOICE').map(action => action.action));
  assert.equal(commands.at(-1)?.type, 'TERMINAL');
  assert.equal(commands.at(-1)?.simulationTime, episode.elapsedTime);
});

test('TIMEOUT at an F5 route boundary emits no post-terminal MOVE and terminates once', () => {
  const timedOut = runActualMapTraining(environment, PROFILES.BALANCED, 42, 5, 5).rounds[0].episodes[0];
  assert.equal(timedOut.terminalReason, 'TIMEOUT');
  assert.ok(timedOut.actionHistory.slice(-2).every(action => action.action === 'RETREAT'));

  const replay = createRuntimeCommands(environment, timedOut, episodeSeed(42, 1, 1));
  assert.equal(replay.filter(command => command.type === 'TERMINAL').length, 1);
  assert.deepEqual(replay.at(-1), {
    type: 'TERMINAL',
    floor: 5,
    simulationTime: timedOut.elapsedTime,
    reason: 'TIMEOUT',
    commandId: replay.length,
  });
  const terminalIndex = replay.findIndex(command => command.type === 'TERMINAL');
  assert.equal(replay.slice(terminalIndex + 1).some(command => command.type === 'MOVE' || command.type === 'ENCOUNTER'), false);

  const sceneSource = fs.readFileSync('src/modules/reinforcement/runtime/ReinforcementRuntimeScene.ts', 'utf8');
  assert.match(sceneSource, /if \(this\.terminalEmitted\) return;[\s\S]*this\.move = undefined;[\s\S]*this\.game\.events\.emit\('reinforcement-runtime-terminal'/);
  assert.equal(sceneSource.match(/\.emit\('reinforcement-runtime-terminal'/g)?.length, 1);
});

test('near-boundary F5 timeout stops at the canonical security-lock state instead of visually reaching Goal', () => {
  const training = runActualMapTraining(environment, rewardWeightsFromStars({ speed: 1, judgment: 3, threat: 2 }), 1, 20, 5);
  const timedOut = training.rounds[12].episodes[4];
  assert.equal(episodeSeed(1, 13, 5), 2504776171);
  assert.equal(timedOut.terminalReason, 'TIMEOUT');
  assert.equal(timedOut.eventHistory.at(-1)?.location, 'F5_SECURITY_LOCK');
  assert.equal(timedOut.actual.systemRestored, false);

  const replay = createRuntimeCommands(environment, timedOut, 2504776171);
  assert.equal(replay.some(command => command.type === 'STATE_CHANGE' && command.change === 'SYSTEM_RESTORED'), false);
  assert.equal(replay.some(command => command.type === 'MOVE' && command.edgeIds.includes('E_F5_CONTROL_GOAL')), false);
  assert.equal(replay.at(-1)?.type, 'TERMINAL');
  assert.equal(replay.at(-1)?.type === 'TERMINAL' && replay.at(-1)?.reason, 'TIMEOUT');
});

test('runtime command ids and terminal boundary are single-assignment across a deterministic 20-round run', () => {
  const training = runActualMapTraining(environment, rewardWeightsFromStars({ speed: 1, judgment: 3, threat: 2 }), 42, 20, 5);
  for (const round of training.rounds) for (const result of round.episodes) {
    const replay = createRuntimeCommands(environment, result, episodeSeed(42, round.round, result.robot));
    assert.deepEqual(replay.map(command => command.commandId), replay.map((_command, index) => index + 1));
    assert.equal(replay.filter(command => command.type === 'TERMINAL').length, 1);
    assert.equal(replay.at(-1)?.type, 'TERMINAL');
    assert.equal(replay.at(-1)?.type === 'TERMINAL' && replay.at(-1)?.reason, result.terminalReason);

    const final = replay.reduce(applyRuntimeCommand, initialRuntimePlaybackState());
    assert.equal(final.terminal, result.terminalReason);
    assert.equal(final.floor, result.actual.reachedFloors.at(-1));
    assert.equal(final.bossNeutralized, result.actual.bossNeutralized);
    assert.equal(final.systemRestored, result.actual.systemRestored);
  }
});

test('alive F5 SUBDUE recovery keeps the same encounter and creates no spawn-return MOVE', () => {
  const training = runActualMapTraining(environment, rewardWeightsFromStars({ speed: 1, judgment: 3, threat: 2 }), 42, 20, 5);
  let recoveries = 0;
  for (const round of training.rounds) for (const result of round.episodes) {
    const replay = createRuntimeCommands(environment, result, episodeSeed(42, round.round, result.robot));
    replay.forEach((command, index) => {
      if (command.type !== 'STATE_CHANGE' || command.change !== 'ROBOT_RECOVERY' || command.floor !== 5) return;
      recoveries++;
      const next = replay.slice(index + 1).find(candidate => candidate.type === 'ACTION' || candidate.type === 'MOVE' || candidate.type === 'TERMINAL');
      assert.equal(next?.type, 'ACTION');
      assert.equal(next?.type === 'ACTION' && next.zoneId, command.location);
    });
  }
  assert.ok(recoveries > 0);
});

test('runtime MOVE commands preserve actual Navigation Edge polylines', () => {
  const moves = commands.filter(command => command.type === 'MOVE');
  assert.ok(moves.length > 0);
  for (const move of moves) {
    const edgeSegments = move.edgeIds.flatMap(id => {
      const points = environment.edges.find(edge => edge.id === id)!.points;
      return points.slice(1).map((point, index) => [points[index], point] as const);
    });
    const offEdge = move.points.filter(point => !edgeSegments.some(([from, to]) => pointOnSegment(point, from, to)));
    if (!move.localStaging) assert.deepEqual(offEdge, [], `${move.edgeIds.join(',')}: ${offEdge.map(point => `${point.x},${point.y}`).join(';')}`);
    else {
      assert.equal(offEdge.length, 1);
      assert.ok(offEdge[0] === move.points[0] || offEdge[0] === move.points.at(-1));
    }
  }
});

test('movement direction maps each segment to the matching robot animation', () => {
  assert.equal(directionForSegment({ x: 0, y: 0 }, { x: 10, y: 1 }), 'RIGHT');
  assert.equal(directionForSegment({ x: 10, y: 0 }, { x: 0, y: 1 }), 'LEFT');
  assert.equal(directionForSegment({ x: 0, y: 0 }, { x: 1, y: -10 }), 'UP');
  assert.equal(directionForSegment({ x: 0, y: 0 }, { x: 1, y: 10 }), 'DOWN');
});

test('encounters stop for action/outcome and keep neutralized/collider/gate state consistent', () => {
  const firstStart = commands.findIndex(command => command.type === 'ENCOUNTER' && command.phase === 'START');
  const firstAction = commands.findIndex((command, index) => index > firstStart && command.type === 'ACTION');
  const firstOutcome = commands.findIndex((command, index) => index > firstAction && command.type === 'OUTCOME');
  assert.ok(firstStart >= 0 && firstStart < firstAction && firstAction < firstOutcome);

  const finalState = commands.reduce(applyRuntimeCommand, initialRuntimePlaybackState());
  assert.ok(Object.values(finalState.obstacleBlocking).some(blocking => blocking === false));
  assert.ok(finalState.neutralizedVillains.length > 0);
  assert.ok(finalState.openDoors.includes(episode.actual.bossRoom));
  assert.equal(finalState.bossVisible, true);
  assert.equal(finalState.bossNeutralized, true);
  assert.equal(finalState.securityLockOpen, true);
  assert.equal(finalState.terminal, 'GOAL_REACHED');

  const terminalIndex = commands.findIndex(command => command.type === 'TERMINAL');
  const unchanged = commands.slice(terminalIndex + 1).reduce(applyRuntimeCommand, finalState);
  assert.deepEqual(unchanged, finalState);
});

test('Boss stays hidden until BOSS_FOUND and lock opens only after neutralization', () => {
  const found = commands.findIndex(command => command.type === 'STATE_CHANGE' && command.change === 'BOSS_FOUND');
  const neutralized = commands.findIndex(command => command.type === 'STATE_CHANGE' && command.change === 'BOSS_NEUTRALIZED');
  const lockOpen = commands.findIndex(command => command.type === 'STATE_CHANGE' && command.change === 'SECURITY_LOCK_OPEN');
  assert.ok(found >= 0 && found < neutralized && neutralized < lockOpen);
  assert.equal(commands.slice(0, found).some(command => command.type === 'STATE_CHANGE' && command.change === 'BOSS_FOUND'), false);
});

test('runtime tile 34 resolves from the F2 TSJ to the real public PNG', () => {
  const tilesetPath = resolveRuntimePublicPath(
    '../../assets/environment/reinforcement/floor2_room_shell_manual/floor2_room_shell_manual.tsj',
    '/maps/reinforcement/floor_2_blockout.tmj',
  );
  const imagePath = resolveRuntimePublicPath('F2_FLOOR_PART_Corner.png', tilesetPath);
  assert.equal(imagePath, '/assets/environment/reinforcement/floor2_room_shell_manual/F2_FLOOR_PART_CORNER.png');
  assert.equal(fs.existsSync(`public${imagePath}`), true);

  const uniqueImages: string[] = [];
  const seen = new Set<string>();
  for (const mapFile of ACTUAL_MAP_FILES) {
    const map = readJson(mapFile);
    for (const reference of map.tilesets) {
      const tilesetFile = path.resolve(path.dirname(mapFile), reference.source);
      for (const tile of readJson(tilesetFile).tiles ?? []) {
        const imageFile = path.resolve(path.dirname(tilesetFile), tile.image);
        const identity = imageFile.toLowerCase();
        if (!seen.has(identity)) {
          seen.add(identity);
          uniqueImages.push(imageFile);
        }
      }
    }
  }
  assert.match(uniqueImages[34].replaceAll('\\', '/'), /floor2_room_shell_manual\/F2_FLOOR_PART_Corner\.png$/);
  assert.equal(fs.existsSync(uniqueImages[34]), true);
  assert.equal(fs.readdirSync(path.dirname(uniqueImages[34])).includes('F2_FLOOR_PART_CORNER.png'), true);
});

test('presentation pre-spawns only selected encounter entities with stable unique identities', () => {
  const presentation = createRuntimePresentation(commands);
  const starts = commands.filter(command => command.type === 'ENCOUNTER' && command.phase === 'START');
  const entityZones = new Set(Object.values(presentation.entities).map(entity => entity.zoneId));
  assert.deepEqual(entityZones, new Set(starts.map(command => command.zoneId)));
  assert.equal(new Set(Object.keys(presentation.entities)).size, Object.keys(presentation.entities).length);
  assert.equal(Object.values(presentation.entities).filter(entity => entity.kind === 'BOSS').every(entity => !entity.visible), true);
  assert.equal(entitiesForFloor(presentation, 5).some(entity => entity.kind === 'GUARD'), true);
  assert.equal(entitiesForFloor(presentation, 5).some(entity => entity.kind === 'BOSS'), false);
});

test('all encounter footprints stage at least 32px apart on the incoming polyline', () => {
  const path = [{ x: 0, y: 0 }, { x: 240, y: 0 }];
  for (const kind of ['OBSTACLE', 'CITIZEN_NEARBY', 'AMBIGUOUS_PERSON', 'VILLAIN_ENCOUNTER', 'BOSS_ENCOUNTER'] as const) {
    const staging = stageEncounterOnPath(path, { x: 200, y: 0 }, RUNTIME_CONTACT_FOOTPRINTS[kind]);
    assert.ok(staging.gap + 0.001 >= RUNTIME_STAGING_GAP, `${kind}: ${staging.gap}`);
    assert.equal(staging.fallback, false);
    assert.equal(pointOnSegment(staging.stagingPosition, path[0], path[1]), true);
  }
});

test('all five training rounds stage Citizen, Tiger, Villain and Boss visuals with a 64px clear footprint gap', () => {
  const training = runActualMapTraining(environment, PROFILES.BALANCED, 42, 5, 5);
  let checked = 0;
  for (const round of training.rounds) {
    for (const episode of round.episodes) {
      const replay = createRuntimeCommands(environment, episode, episodeSeed(42, round.round, episode.robot));
      const state = createRuntimePresentation(replay, mapSources);
      for (const command of replay) {
        if (command.type !== 'ENCOUNTER' || command.phase !== 'START') continue;
        if (!['CITIZEN_NEARBY', 'AMBIGUOUS_PERSON', 'VILLAIN_ENCOUNTER', 'BOSS_ENCOUNTER'].includes(command.encounter)) continue;
        const entities = Object.values(state.entities).filter(entity => entity.zoneId === command.zoneId);
        assert.ok(entities.length > 0, command.zoneId);
        const nearestGap = Math.min(...entities.map(entity => footprintGap(
          command.stagingPosition,
          runtimeVisualFootprint('ROBOT'),
          entity.position,
          runtimeVisualFootprint(entity.kind),
        )));
        assert.ok(nearestGap + 0.001 >= RUNTIME_CHARACTER_STAGING_GAP, `${command.zoneId}: ${nearestGap}`);

        const robotFootprint = runtimeVisualFootprint('ROBOT');
        const bounds = {
          x: command.stagingPosition.x - robotFootprint.width / 2,
          y: command.stagingPosition.y - robotFootprint.height / 2,
          width: robotFootprint.width,
          height: robotFootprint.height,
        };
        const map = mapSources[command.floor - 1];
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= map.width * map.tilewidth && bounds.y + bounds.height <= map.height * map.tileheight, command.zoneId);
        const collisionObjects = map.layers.find((layer: { name: string }) => layer.name === 'Collision')?.objects ?? [];
        assert.equal(collisionObjects.filter((object: { width?: number; height?: number }) => (object.width ?? 0) > 0 && (object.height ?? 0) > 0).some(object => {
          const collision = axisAlignedBounds(object);
          return bounds.x < collision.x + collision.width && bounds.x + bounds.width > collision.x
            && bounds.y < collision.y + collision.height && bounds.y + bounds.height > collision.y;
        }), false, command.zoneId);
        checked++;
      }
    }
  }
  assert.ok(checked > 0);
});

test('active encounter staging footprints do not overlap permanent map collision', () => {
  for (const command of commands) {
    if (command.type !== 'ENCOUNTER' || command.phase !== 'START') continue;
    const collisionObjects = mapSources[command.floor - 1].layers.find((layer: { name: string }) => layer.name === 'Collision')?.objects ?? [];
    const robotBounds = {
      x: command.stagingPosition.x - RUNTIME_CONTACT_FOOTPRINTS.ROBOT.width / 2,
      y: command.stagingPosition.y - RUNTIME_CONTACT_FOOTPRINTS.ROBOT.height,
      width: RUNTIME_CONTACT_FOOTPRINTS.ROBOT.width,
      height: RUNTIME_CONTACT_FOOTPRINTS.ROBOT.height,
    };
    const overlaps = collisionObjects.some(object => {
      const values = properties(object);
      if (values.blocksRobot === false || values.dynamicDoor === true || values.dynamicLock === true) return false;
      const bounds = axisAlignedBounds(object);
      return robotBounds.x < bounds.x + bounds.width
        && robotBounds.x + robotBounds.width > bounds.x
        && robotBounds.y < bounds.y + bounds.height
        && robotBounds.y + robotBounds.height > bounds.y;
    });
    assert.equal(overlaps, false, command.zoneId);
  }
});

test('presentation state persists normal, cleared, neutralized, door and boss visuals across restore', () => {
  const initial = createRuntimePresentation(commands);
  const restored = commands.reduce(applyRuntimePresentationCommand, initial);
  const obstacle = Object.values(restored.entities).find(entity => entity.kind === 'OBSTACLE' && entity.visualState === 'CLEARED');
  assert.ok(obstacle);
  assert.equal(obstacle.blocking, false);
  assert.deepEqual(obstacle.position, obstacle.clearedPosition);
  assert.ok(Object.values(restored.entities).some(entity => (entity.kind === 'VILLAIN' || entity.kind === 'GUARD') && entity.visualState === 'NEUTRALIZED'));
  assert.ok(Object.values(restored.entities).some(entity => entity.kind === 'BOSS' && entity.visible && entity.visualState === 'NEUTRALIZED'));
  assert.ok(restored.openDoors.includes(episode.actual.bossRoom));
  assert.equal(restored.securityLockOpen, true);
  assert.deepEqual(entitiesForFloor(restored, 5), entitiesForFloor(restored, 5));
});

test('BLOCKED keeps the original obstacle collider state and clear outcomes move it off-path', () => {
  const start = commands.find(command => command.type === 'ENCOUNTER' && command.phase === 'START' && command.encounter === 'OBSTACLE');
  assert.ok(start);
  const base = createRuntimePresentation([start]);
  const blocked = applyRuntimePresentationCommand(base, { type: 'STATE_CHANGE', floor: start.floor, simulationTime: 0, change: 'OBSTACLE_BLOCKED', location: start.zoneId });
  const blockedEntity = Object.values(blocked.entities)[0];
  assert.equal(blockedEntity.blocking, true);
  assert.deepEqual(blockedEntity.position, blockedEntity.originalPosition);
  const cleared = applyRuntimePresentationCommand(blocked, { type: 'STATE_CHANGE', floor: start.floor, simulationTime: 0, change: 'OBSTACLE_CLEARED', location: start.zoneId });
  const clearedEntity = Object.values(cleared.entities)[0];
  assert.equal(clearedEntity.blocking, false);
  assert.notDeepEqual(clearedEntity.position, clearedEntity.originalPosition);
});

test('duplicate encounter commands do not duplicate presentation entities', () => {
  const start = commands.find(command => command.type === 'ENCOUNTER' && command.phase === 'START');
  assert.ok(start);
  const once = createRuntimePresentation([start]);
  const repeated = createRuntimePresentation([start, start]);
  assert.equal(Object.keys(repeated.entities).length, Object.keys(once.entities).length);
});

const contactGap = (left: RuntimePoint, right: RuntimePoint) => {
  const distance = Math.hypot(right.x - left.x, right.y - left.y);
  const direction = { x: (right.x - left.x) / distance, y: (right.y - left.y) / distance };
  const footprint = RUNTIME_CONTACT_FOOTPRINTS.VILLAIN_ENCOUNTER;
  return distance - Math.abs(direction.x) * footprint.width - Math.abs(direction.y) * footprint.height;
};

const footprintInsideMapAndCollisionFree = (floor: number, point: RuntimePoint, width: number, height: number) => {
  const map = mapSources[floor - 1];
  const bounds = { x: point.x - width / 2, y: point.y - height / 2, width, height };
  if (bounds.x < 0 || bounds.y < 0 || bounds.x + width > map.width * map.tilewidth || bounds.y + height > map.height * map.tileheight) return false;
  return !(map.layers.find((layer: { name: string }) => layer.name === 'Collision')?.objects ?? []).some((object: Parameters<typeof axisAlignedBounds>[0]) => {
    if (properties(object).blocksRobot === false) return false;
    const collision = axisAlignedBounds(object);
    return bounds.x < collision.x + collision.width && bounds.x + bounds.width > collision.x
      && bounds.y < collision.y + collision.height && bounds.y + bounds.height > collision.y;
  });
};

test('Floor 2 and 4 villain pairs share Y and keep about two tiles between centers', () => {
  for (const floor of [2, 4]) {
    const pair = Object.values(presentation.entities).filter(entity => entity.floor === floor && entity.kind === 'VILLAIN')
      .sort((left, right) => left.originalPosition.x - right.originalPosition.x);
    assert.equal(pair.length, 2);
    assert.equal(pair[0].originalPosition.y, pair[1].originalPosition.y);
    assert.ok(Math.abs(pair[1].originalPosition.x - pair[0].originalPosition.x - 64) < 0.001);
  }
});

test('every Floor 2 and 4 route stages the same guard pair before the actual stair node', () => {
  const routeTemplate = structuredClone(episode.actionHistory.find(action => action.state === 'ROUTE_CHOICE')!);
  const guardTemplate = structuredClone(episode.actionHistory.find(action => action.state === 'VILLAIN_ENCOUNTER')!);
  for (const floor of [2, 4]) {
    const anchors: RuntimePoint[] = [];
    const options = environment.contexts.filter(context => context.floor === floor).flatMap(context => context.options);
    for (const option of options) {
      const guard = option.encounterZoneIds.map(id => environment.zones.find(zone => zone.id === id)!)
        .find(zone => zone.kind === 'VILLAIN_ENCOUNTER')!;
      const syntheticEpisode = structuredClone(episode);
      syntheticEpisode.actionHistory = [
        { ...routeTemplate, action: option.action, location: option.id, routeContext: option.contextId, routeOptions: [option.action], elapsedCost: 1, immediateEvents: [], localOutcome: 'MOVING' },
        { ...guardTemplate, location: guard.id, elapsedCost: 1 },
      ];
      syntheticEpisode.elapsedTime = 2;
      syntheticEpisode.actual.reachedFloors = [floor];
      const replay = createRuntimeCommands(environment, syntheticEpisode, seed);
      const startIndex = replay.findIndex(command => command.type === 'ENCOUNTER' && command.phase === 'START');
      const start = replay[startIndex];
      assert.ok(start.type === 'ENCOUNTER' && start.phase === 'START');
      const path = orientedPath(environment, option.edgeIds, option.startNodeId).points;
      const stair = path.at(-1)!;
      assert.deepEqual(start.position, stair, option.id);
      assert.deepEqual(start.routePosition, stair, option.id);
      assert.ok(distanceOnPath(path, start.stagingPosition) < distanceOnPath(path, stair), option.id);
      assert.equal(replay[startIndex - 1]?.type, 'MOVE', option.id);
      assert.deepEqual(replay[startIndex - 1]?.type === 'MOVE' ? replay[startIndex - 1].points.at(-1) : undefined, start.stagingPosition, option.id);
      assert.ok(replay.findIndex(command => command.type === 'FLOOR_TRANSITION') > startIndex, option.id);
      const pair = Object.values(createRuntimePresentation(replay, mapSources).entities)
        .filter(entity => entity.zoneId === guard.id)
        .sort((left, right) => left.originalPosition.x - right.originalPosition.x);
      assert.equal(pair.length, 2, option.id);
      assert.equal(pair[0].originalPosition.y, pair[1].originalPosition.y, option.id);
      assert.equal(pair[1].originalPosition.x - pair[0].originalPosition.x, 64, option.id);
      anchors.push(start.position);
    }
    assert.equal(new Set(anchors.map(anchor => `${anchor.x},${anchor.y}`)).size, 1, `F${floor}`);
  }
});

test('two-stair villain pairs retain initial placement without footprint overlap', () => {
  const start = commands.find(command => command.type === 'ENCOUNTER' && command.phase === 'START' && command.floor === 3 && command.encounter === 'VILLAIN_ENCOUNTER');
  assert.ok(start);
  const pair = Object.values(presentation.entities).filter(entity => entity.zoneId === start.zoneId);
  assert.deepEqual(pair.map(entity => entity.originalPosition), [
    { x: start.position.x - 17, y: start.position.y },
    { x: start.position.x + 17, y: start.position.y },
  ]);
  assert.ok(contactGap(pair[0].originalPosition, pair[1].originalPosition) >= 0);
});

test('Floor 2 and 4 FORCE_PASS moves the pair diagonally by one tile and corrects only to a nearby valid lane-clear point', () => {
  for (const floor of [2, 4]) {
    const pair = Object.values(presentation.entities).filter(entity => entity.floor === floor && entity.kind === 'VILLAIN')
      .sort((left, right) => left.originalPosition.x - right.originalPosition.x);
    const state = applyRuntimePresentationCommand(presentation, { type: 'STATE_CHANGE', floor, simulationTime: 0, change: 'VILLAIN_FORCE_PASSED', location: pair[0].zoneId });
    const moved = Object.values(state.entities).filter(entity => entity.zoneId === pair[0].zoneId)
      .sort((left, right) => left.originalPosition.x - right.originalPosition.x);
    const incoming = pair[0].incomingDirection;
    const forward = Math.abs(incoming.x) >= Math.abs(incoming.y)
      ? { x: Math.sign(incoming.x), y: 0 }
      : { x: 0, y: Math.sign(incoming.y) };
    const passNormal = { x: -forward.y, y: forward.x };
    const desired = [
      { x: pair[0].originalPosition.x - passNormal.x * 32 + forward.x * 32, y: pair[0].originalPosition.y - passNormal.y * 32 + forward.y * 32 },
      { x: pair[1].originalPosition.x + passNormal.x * 32 - forward.x * 32, y: pair[1].originalPosition.y + passNormal.y * 32 - forward.y * 32 },
    ];
    const routeNormal = { x: -incoming.y, y: incoming.x };
    for (let index = 0; index < moved.length; index++) {
      const correction = { x: moved[index].position.x - desired[index].x, y: moved[index].position.y - desired[index].y };
      assert.ok(Math.hypot(correction.x, correction.y) <= 32 + 0.001);
      assert.ok(Math.abs(correction.x * routeNormal.y - correction.y * routeNormal.x) < 0.001);
      const laneDistance = Math.abs((moved[index].position.x - moved[index].routePosition.x) * routeNormal.x
        + (moved[index].position.y - moved[index].routePosition.y) * routeNormal.y);
      assert.ok(laneDistance >= 24 - 0.001);
      assert.equal(footprintInsideMapAndCollisionFree(floor, moved[index].position, 28, 18), true);
    }
  }
});

test('Floor 3 keeps the initial cluster and FORCE_PASS splits left down and right up by one tile', () => {
  const groups = Object.values(presentation.entities).filter(entity => entity.floor === 3 && entity.kind === 'VILLAIN')
    .reduce<Record<string, typeof presentation.entities[string][]>>((result, entity) => {
      (result[entity.zoneId] ??= []).push(entity);
      return result;
    }, {});
  for (const pair of Object.values(groups)) {
    pair.sort((left, right) => left.originalPosition.x - right.originalPosition.x);
    assert.equal(pair[0].originalPosition.y, pair[1].originalPosition.y);
    assert.equal(pair[1].originalPosition.x - pair[0].originalPosition.x, 34);
    const state = applyRuntimePresentationCommand(presentation, { type: 'STATE_CHANGE', floor: 3, simulationTime: 0, change: 'VILLAIN_FORCE_PASSED', location: pair[0].zoneId });
    const moved = Object.values(state.entities).filter(entity => entity.zoneId === pair[0].zoneId)
      .sort((left, right) => left.originalPosition.x - right.originalPosition.x);
    assert.equal(moved[0].position.y - pair[0].originalPosition.y, 32);
    assert.equal(moved[1].position.y - pair[1].originalPosition.y, -32);
    assert.ok(Math.abs(moved[0].position.x - pair[0].originalPosition.x) <= 32);
    assert.ok(Math.abs(moved[1].position.x - pair[1].originalPosition.x) <= 32);
    moved.forEach(entity => assert.equal(footprintInsideMapAndCollisionFree(3, entity.position, 28, 18), true));
  }
});

test('active obstacles block the active route at a valid in-bounds position', () => {
  for (const command of commands) {
    if (command.type !== 'ENCOUNTER' || command.phase !== 'START' || command.encounter !== 'OBSTACLE') continue;
    const obstacle = Object.values(presentation.entities).find(entity => entity.zoneId === command.zoneId)!;
    const normal = { x: -command.incomingDirection.y, y: command.incomingDirection.x };
    const routeDistance = Math.abs((obstacle.originalPosition.x - command.routePosition.x) * normal.x + (obstacle.originalPosition.y - command.routePosition.y) * normal.y);
    assert.ok(routeDistance < 34, command.zoneId);
    assert.equal(footprintInsideMapAndCollisionFree(command.floor, obstacle.originalPosition, 48, 24), true, command.zoneId);
  }
});

test('every obstacle encounter stops before the obstacle instead of passing and backtracking', () => {
  commands.forEach((command, index) => {
    if (command.type !== 'ENCOUNTER' || command.phase !== 'START' || command.encounter !== 'OBSTACLE') return;
    const previous = commands[index - 1];
    assert.equal(previous?.type, 'MOVE', command.zoneId);
    if (previous?.type === 'MOVE') assert.deepEqual(previous.points.at(-1), command.stagingPosition);
    const obstacle = Object.values(presentation.entities).find(entity => entity.zoneId === command.zoneId)!;
    const stageToObstacle = {
      x: obstacle.originalPosition.x - command.stagingPosition.x,
      y: obstacle.originalPosition.y - command.stagingPosition.y,
    };
    assert.ok(stageToObstacle.x * command.incomingDirection.x + stageToObstacle.y * command.incomingDirection.y > 0, command.zoneId);
    const stageToContact = {
      x: obstacle.contactPosition.x - command.stagingPosition.x,
      y: obstacle.contactPosition.y - command.stagingPosition.y,
    };
    assert.ok(stageToContact.x * command.incomingDirection.x + stageToContact.y * command.incomingDirection.y >= -0.001, command.zoneId);
  });
});

test('Floor 3 maps unchanged headless obstacle actions to monotonic route visuals without replay', () => {
  const option = environment.contexts.find(context => context.id === 'F3_STAIR_SPLIT')!.options
    .find(candidate => candidate.id === 'F3_LEFT_MAINTENANCE_ROUTE')!;
  const path = orientedPath(environment, option.edgeIds, option.startNodeId).points;
  const obstacleZones = option.encounterZoneIds.map(id => environment.zones.find(zone => zone.id === id)!)
    .filter(zone => zone.kind === 'OBSTACLE');
  const mapOrder = obstacleZones.map(zone => distanceOnPath(path, zone));
  assert.ok(mapOrder.some((distance, index) => index > 0 && distance < mapOrder[index - 1]));

  const routeTemplate = structuredClone(episode.actionHistory.find(action => action.state === 'ROUTE_CHOICE')!);
  const obstacleTemplate = structuredClone(episode.actionHistory.find(action => action.state === 'OBSTACLE')!);
  const selected = [
    { action: 'DETOUR', localOutcome: 'SAFE_PASS' },
    { action: 'CLEAR', localOutcome: 'OBSTACLE_CLEARED' },
    { action: 'PUSH', localOutcome: 'CLEAN_PASS' },
    { action: 'DETOUR', localOutcome: 'SAFE_PASS' },
  ] as const;
  const syntheticEpisode = structuredClone(episode);
  syntheticEpisode.actionHistory = [
    { ...routeTemplate, action: option.action, location: option.id, routeContext: option.contextId, routeOptions: [option.action], elapsedCost: 1, immediateEvents: [], localOutcome: 'MOVING' },
    ...obstacleZones.map((zone, index) => ({
      ...obstacleTemplate,
      action: selected[index].action,
      localOutcome: selected[index].localOutcome,
      location: zone.id,
      elapsedCost: 1,
      immediateEvents: [],
    })),
  ];
  syntheticEpisode.elapsedTime = 5;
  syntheticEpisode.actual.reachedFloors = [3];
  const replay = createRuntimeCommands(environment, syntheticEpisode, seed);
  assert.deepEqual(
    replay.filter(command => command.type === 'ACTION').map(command => command.action),
    selected.map(item => item.action),
  );

  const starts = replay.filter(command => command.type === 'ENCOUNTER' && command.phase === 'START' && command.encounter === 'OBSTACLE');
  const progress = starts.map(command => distanceOnPath(path, command.routePosition));
  assert.deepEqual(progress, [...progress].sort((left, right) => left - right));
  assert.equal(new Set(starts.map(command => command.zoneId)).size, starts.length);
  assert.deepEqual(
    new Set(Object.values(createRuntimePresentation(replay, mapSources).entities).filter(entity => entity.kind === 'OBSTACLE').map(entity => entity.zoneId)),
    new Set(starts.map(command => command.zoneId)),
  );
  for (const move of replay.filter(command => command.type === 'MOVE')) {
    const moveProgress = move.points.map(point => distanceOnPath(path, point));
    assert.deepEqual(moveProgress, [...moveProgress].sort((left, right) => left - right), move.edgeIds.join(','));
  }
});

test('PUSH uses incoming direction, couples robot and obstacle, and finishes safely off-route', () => {
  const push = commands.find(command => command.type === 'STATE_CHANGE' && command.change === 'OBSTACLE_PUSHED');
  assert.ok(push);
  const motion = presentationMotionForCommand(presentation, push);
  assert.equal(motion?.kind, 'PUSH');
  assert.equal(motion?.robotCoupled, true);
  assert.ok(motion?.robotStaging);
  assert.ok(motion?.robotContact);
  assert.ok(motion?.robotPushTo);
  const entity = motion!.entities[0];
  assert.ok(entity.via);
  const delta = { x: entity.via.x - entity.from.x, y: entity.via.y - entity.from.y };
  assert.ok(delta.x * motion!.direction!.x + delta.y * motion!.direction!.y >= 32 - 0.001);
  assert.ok(Math.abs(delta.x * motion!.direction!.y - delta.y * motion!.direction!.x) < 0.001);
  assert.notDeepEqual(entity.via, entity.from);
  assert.notDeepEqual(entity.to, entity.via);
  const obstacleFromRobot = { x: entity.from.x - motion!.robotContact!.x, y: entity.from.y - motion!.robotContact!.y };
  assert.ok(obstacleFromRobot.x * motion!.direction!.x + obstacleFromRobot.y * motion!.direction!.y > 0);
  assert.ok(Math.abs(obstacleFromRobot.x * motion!.direction!.y - obstacleFromRobot.y * motion!.direction!.x) < 0.001);
  const robotPush = { x: motion!.robotPushTo!.x - motion!.robotContact!.x, y: motion!.robotPushTo!.y - motion!.robotContact!.y };
  assert.ok(Math.abs(robotPush.x - delta.x) < 0.001 && Math.abs(robotPush.y - delta.y) < 0.001);
  assert.equal(footprintInsideMapAndCollisionFree(push.floor, entity.to, 48, 24), true);
  const finished = applyRuntimePresentationCommand(presentation, push);
  const obstacle = Object.values(finished.entities).find(candidate => candidate.zoneId === push.location)!;
  assert.equal(obstacle.blocking, false);
  assert.deepEqual(obstacle.position, entity.to);
});

test('CLEAR is continuous, persists the obstacle, and BLOCKED preserves its collider', () => {
  const clear = commands.find(command => command.type === 'STATE_CHANGE' && command.change === 'OBSTACLE_CLEARED');
  assert.ok(clear);
  const motion = presentationMotionForCommand(presentation, clear);
  assert.equal(motion?.kind, 'CLEAR');
  assert.notDeepEqual(motion!.entities[0].from, motion!.entities[0].to);
  assert.equal(footprintInsideMapAndCollisionFree(clear.floor, motion!.entities[0].to, 48, 24), true);
  const cleared = applyRuntimePresentationCommand(presentation, clear);
  assert.equal(Object.values(cleared.entities).find(entity => entity.zoneId === clear.location)?.blocking, false);
  for (const change of ['OBSTACLE_CLEARED', 'OBSTACLE_SHIFTED', 'OBSTACLE_BYPASSED'] as const) {
    const candidate = presentationMotionForCommand(presentation, { ...clear, change });
    assert.equal(candidate?.kind, 'CLEAR');
    assert.notDeepEqual(candidate!.entities[0].from, candidate!.entities[0].to);
  }
  const blocked = applyRuntimePresentationCommand(presentation, { ...clear, change: 'OBSTACLE_BLOCKED' });
  const blockedObstacle = Object.values(blocked.entities).find(entity => entity.zoneId === clear.location)!;
  assert.equal(blockedObstacle.blocking, true);
  assert.deepEqual(blockedObstacle.position, blockedObstacle.originalPosition);
});

test('forward rejoin keeps persistent route progress monotonic after PUSH or CLEAR displacement', () => {
  const route = [{ x: 0, y: 100 }, { x: 200, y: 100 }];
  let persistentProgress = 72;
  for (const current of [{ x: 72, y: 132 }, { x: 96, y: 68 }]) {
    const resumed = forwardRejoinPolyline(route, current, persistentProgress);
    const projected = resumed.points.map(point => projectRouteProgress(route, point, persistentProgress).progress);
    assert.ok(projected.every(progress => progress >= persistentProgress));
    assert.ok(resumed.routeProgress >= persistentProgress);
    persistentProgress = resumed.routeProgress;
  }
});

test('Citizen and Tiger local avoidance detours around visual footprints and rejoins forward', () => {
  const route = [{ x: 20, y: 100 }, { x: 220, y: 100 }];
  const bounds = { x: 0, y: 0, width: 240, height: 200 };
  for (const kind of ['CITIZEN', 'AMBIGUOUS'] as const) {
    const blockers = [{ id: kind, point: { x: 120, y: 100 }, footprint: runtimeVisualFootprint(kind) }];
    const planned = planLocalMovement(route, route[0], bounds, [], blockers);
    assert.ok(planned.points.length > route.length, kind);
    assert.equal(movementPathIsClear(planned.points, runtimeVisualFootprint('ROBOT'), bounds, [], blockers), true, kind);
    assert.deepEqual(planned.points.at(-1), route.at(-1), kind);
    const progress = planned.points.map(point => projectRouteProgress(route, point).progress);
    assert.ok(progress.every((value, index) => index === 0 || value + 0.001 >= progress[index - 1]), kind);
  }
});

test('local avoidance selects a collision-free side and never crosses a static wall', () => {
  const route = [{ x: 20, y: 100 }, { x: 220, y: 100 }];
  const bounds = { x: 0, y: 0, width: 240, height: 200 };
  const walls = [{ x: 70, y: 108, width: 100, height: 60 }];
  const blockers = [{ id: 'citizen', point: { x: 120, y: 100 }, footprint: runtimeVisualFootprint('CITIZEN') }];
  const planned = planLocalMovement(route, route[0], bounds, walls, blockers);
  assert.equal(movementPathIsClear(planned.points, runtimeVisualFootprint('ROBOT'), bounds, walls, blockers), true);
  assert.ok(planned.points.slice(1, -1).some(point => point.y < route[0].y));
});

test('movement planner rejects an unreachable wall target instead of returning a permanently blocked WALK', () => {
  const bounds = { x: 0, y: 0, width: 200, height: 120 };
  const wall = { x: 90, y: 0, width: 20, height: 120 };
  const plan = planLocalMovement(
    [{ x: 40, y: 60 }, { x: 160, y: 60 }],
    { x: 40, y: 60 },
    bounds,
    [wall],
    [],
  );
  assert.equal(plan.valid, false);
  assert.equal(movementPathIsClear(plan.points, runtimeVisualFootprint('ROBOT'), bounds, [wall]), true);
  assert.notDeepEqual(plan.points.at(-1), { x: 160, y: 60 });
});

test('DISTRACT PASS animates Robot and both Villains, opens the lane, and rejoins forward', () => {
  const option = environment.contexts.flatMap(context => context.options).find(candidate =>
    candidate.encounterZoneIds.some(id => {
      const candidateZone = environment.zones.find(zone => zone.id === id);
      return candidateZone?.kind === 'VILLAIN_ENCOUNTER' && candidateZone.villainCount === 2;
    }))!;
  const zone = option.encounterZoneIds.map(id => environment.zones.find(candidate => candidate.id === id)!)
    .find(candidate => candidate.kind === 'VILLAIN_ENCOUNTER' && candidate.villainCount === 2)!;
  const routeTemplate = structuredClone(episode.actionHistory.find(action => action.state === 'ROUTE_CHOICE')!);
  const villainTemplate = structuredClone(episode.actionHistory.find(action => action.state === 'VILLAIN_ENCOUNTER')!);
  const syntheticEpisode = structuredClone(episode);
  syntheticEpisode.actionHistory = [
    { ...routeTemplate, action: option.action, location: option.id, routeContext: option.contextId, routeOptions: [option.action], elapsedCost: 1, immediateEvents: [], localOutcome: 'MOVING' },
    { ...villainTemplate, action: 'DISTRACT', location: zone.id, elapsedCost: 1, immediateEvents: [], localOutcome: 'PASS' },
  ];
  syntheticEpisode.elapsedTime = 2;
  syntheticEpisode.actual.reachedFloors = [option.floor];
  const replay = createRuntimeCommands(environment, syntheticEpisode, seed);
  const distract = replay.find(command => command.type === 'STATE_CHANGE' && command.change === 'VILLAIN_DISTRACTED');
  assert.ok(distract);
  const initial = createRuntimePresentation(replay, mapSources);
  const motion = presentationMotionForCommand(initial, distract);
  assert.equal(motion?.kind, 'DISTRACT');
  assert.equal(motion?.entities.length, 2);
  assert.ok(motion?.entities.every(entity => entity.reactionLeft && entity.reactionRight));
  for (const entity of motion!.entities) {
    assert.ok(entity.reactionLeft!.x < entity.from.x);
    assert.ok(entity.reactionRight!.x > entity.from.x);
  }

  const map = mapSources[distract.floor - 1];
  const walls = map.layers.find(layer => layer.name === 'Collision')!.objects!
    .filter(object => properties(object).blocksRobot !== false && object.width > 0 && object.height > 0)
    .map(axisAlignedBounds);
  const bounds = { x: 0, y: 0, width: map.width * map.tilewidth, height: map.height * map.tileheight };
  const robotPlan = planDistractMovement(motion!.robotStaging!, bounds, walls);
  assert.deepEqual(robotPlan.points[0], motion!.robotStaging);
  assert.deepEqual(robotPlan.points.at(-1), motion!.robotStaging);
  assert.deepEqual(robotPlan.points.slice(1).map((point, index) => directionForSegment(robotPlan.points[index], point)), ['LEFT', 'RIGHT', 'LEFT']);
  assert.ok(robotPlan.distance > 0 && robotPlan.distance <= 24);
  assert.equal(movementPathIsClear(robotPlan.points, runtimeVisualFootprint('ROBOT'), bounds, walls), true);
  const duration = (robotPlan.points.length - 1) * RUNTIME_VISUAL_CONFIG.distractSideDurationMs
    + RUNTIME_VISUAL_CONFIG.distractFinalDurationMs;
  assert.ok(duration >= 800 && duration <= 1500);

  const next = applyRuntimePresentationCommand(initial, distract);
  const moved = Object.values(next.entities).filter(entity => entity.zoneId === zone.id);
  assert.equal(moved.length, 2);
  for (const entity of moved) {
    const distance = Math.hypot(entity.position.x - entity.originalPosition.x, entity.position.y - entity.originalPosition.y);
    assert.ok(distance >= 16 - 0.001 && distance <= 32 + 0.001);
    assert.equal(entity.visualState, 'NORMAL');
    assert.equal(entity.blocking, false);
  }
  const normal = { x: -moved[0].incomingDirection.y, y: moved[0].incomingDirection.x };
  const sides = moved.map(entity => Math.sign((entity.position.x - entity.routePosition.x) * normal.x
    + (entity.position.y - entity.routePosition.y) * normal.y));
  assert.deepEqual([...sides].sort(), [-1, 1]);
  const forward = forwardRejoinPolyline([{ x: 0, y: 100 }, { x: 200, y: 100 }], { x: 80, y: 100 }, 80);
  assert.ok(forward.routeProgress >= 80);
  assert.deepEqual(forward.points[0], { x: 80, y: 100 });
});

test('DISTRACT presentation is success-only, supports one Villain, and does not affect other actions', () => {
  const floor5Start = commands.find(command => command.type === 'ENCOUNTER'
    && command.phase === 'START' && command.encounter === 'VILLAIN_ENCOUNTER' && command.floor === 5)!;
  const stateChange = { type: 'STATE_CHANGE', floor: 5, simulationTime: 0, change: 'VILLAIN_DISTRACTED', location: floor5Start.zoneId } as const;
  const oneVillain = createRuntimePresentation([floor5Start], mapSources);
  const oneMotion = presentationMotionForCommand(oneVillain, stateChange);
  assert.equal(oneMotion?.kind, 'DISTRACT');
  assert.equal(oneMotion?.entities.length, 1);
  assert.notDeepEqual(oneMotion!.entities[0].to, oneMotion!.entities[0].from);
  const oneEntity = Object.values(applyRuntimePresentationCommand(oneVillain, stateChange).entities)[0];
  const oneDistance = Math.hypot(oneEntity.position.x - oneEntity.originalPosition.x, oneEntity.position.y - oneEntity.originalPosition.y);
  assert.ok(oneDistance >= 16 - 0.001 && oneDistance <= 32 + 0.001);
  const oneNormal = { x: -oneEntity.incomingDirection.y, y: oneEntity.incomingDirection.x };
  const perpendicular = Math.abs((oneEntity.position.x - oneEntity.routePosition.x) * oneNormal.x
    + (oneEntity.position.y - oneEntity.routePosition.y) * oneNormal.y);
  const villainFootprint = runtimeVisualFootprint('VILLAIN');
  const robotFootprint = runtimeVisualFootprint('ROBOT');
  const requiredLane = (Math.abs(oneNormal.x) * villainFootprint.width + Math.abs(oneNormal.y) * villainFootprint.height
    + Math.abs(oneNormal.x) * robotFootprint.width + Math.abs(oneNormal.y) * robotFootprint.height) / 2;
  assert.ok(perpendicular >= requiredLane);

  const nonDistractChanges = ['VILLAIN_NEUTRALIZED', 'VILLAIN_FORCE_PASSED'] as const;
  for (const change of nonDistractChanges) {
    assert.notEqual(presentationMotionForCommand(oneVillain, { ...stateChange, change })?.kind, 'DISTRACT');
  }

  const routeTemplate = structuredClone(episode.actionHistory.find(action => action.state === 'ROUTE_CHOICE')!);
  const villainTemplate = structuredClone(episode.actionHistory.find(action => action.state === 'VILLAIN_ENCOUNTER')!);
  const option = environment.contexts.flatMap(context => context.options).find(candidate =>
    candidate.encounterZoneIds.some(id => environment.zones.find(zone => zone.id === id)?.kind === 'VILLAIN_ENCOUNTER'))!;
  const zone = option.encounterZoneIds.map(id => environment.zones.find(candidate => candidate.id === id)!)
    .find(candidate => candidate.kind === 'VILLAIN_ENCOUNTER')!;
  for (const [action, localOutcome, immediateEvents] of [
    ['SUBDUE', 'PASS', []],
    ['SUBDUE', 'SUBDUE_RECOVERY', ['ROBOT_DAMAGE']],
    ['FORCE_PASS', 'PASS', []],
    ['RETREAT', 'RETREAT', []],
    ['DISTRACT', 'BLOCKED', []],
  ] as const) {
    const syntheticEpisode = structuredClone(episode);
    syntheticEpisode.actionHistory = [
      { ...routeTemplate, action: option.action, location: option.id, routeContext: option.contextId, routeOptions: [option.action], elapsedCost: 1, immediateEvents: [], localOutcome: 'MOVING' },
      { ...villainTemplate, action, location: zone.id, elapsedCost: 1, immediateEvents: [...immediateEvents], localOutcome },
    ];
    syntheticEpisode.elapsedTime = 2;
    syntheticEpisode.actual.reachedFloors = [option.floor];
    const replay = createRuntimeCommands(environment, syntheticEpisode, seed);
    assert.equal(replay.some(command => command.type === 'STATE_CHANGE' && command.change === 'VILLAIN_DISTRACTED'), false, action);
  }
});

test('DISTRACT Robot motion falls back to one safe side or no lateral motion in tight collision', () => {
  const center = { x: 100, y: 100 };
  const bounds = { x: 0, y: 0, width: 200, height: 200 };
  const leftWall = { x: 70, y: 80, width: 21, height: 40 };
  const oneSide = planDistractMovement(center, bounds, [leftWall]);
  assert.deepEqual(oneSide.points, [center, { x: 116, y: 100 }, center]);
  assert.equal(movementPathIsClear(oneSide.points, runtimeVisualFootprint('ROBOT'), bounds, [leftWall]), true);

  const rightWall = { x: 109, y: 80, width: 21, height: 40 };
  const blocked = planDistractMovement(center, bounds, [leftWall, rightWall]);
  assert.equal(blocked.distance, 0);
  assert.deepEqual(blocked.points, [center]);
});

test('successful Villain SUBDUE adds one collision-checked combat lunge without route progress', () => {
  const option = environment.contexts.flatMap(context => context.options).find(candidate =>
    candidate.encounterZoneIds.some(id => environment.zones.find(zone => zone.id === id)?.kind === 'VILLAIN_ENCOUNTER'))!;
  const zone = option.encounterZoneIds.map(id => environment.zones.find(candidate => candidate.id === id)!)
    .find(candidate => candidate.kind === 'VILLAIN_ENCOUNTER')!;
  const routeTemplate = structuredClone(episode.actionHistory.find(action => action.state === 'ROUTE_CHOICE')!);
  const villainTemplate = structuredClone(episode.actionHistory.find(action => action.state === 'VILLAIN_ENCOUNTER')!);
  const syntheticEpisode = structuredClone(episode);
  syntheticEpisode.actionHistory = [
    { ...routeTemplate, action: option.action, location: option.id, routeContext: option.contextId, routeOptions: [option.action], elapsedCost: 1, immediateEvents: [], localOutcome: 'MOVING' },
    { ...villainTemplate, action: 'SUBDUE', location: zone.id, elapsedCost: 1, immediateEvents: ['VILLAIN_NEUTRALIZED'], localOutcome: 'VILLAIN_NEUTRALIZED' },
  ];
  syntheticEpisode.elapsedTime = 2;
  syntheticEpisode.actual.reachedFloors = [option.floor];
  const replay = createRuntimeCommands(environment, syntheticEpisode, seed);
  assert.equal(replay.filter(command => command.type === 'STATE_CHANGE' && command.change === 'VILLAIN_NEUTRALIZED').length, 1);

  const failedEpisode = structuredClone(syntheticEpisode);
  failedEpisode.actionHistory[1] = { ...villainTemplate, action: 'SUBDUE', location: zone.id, elapsedCost: 6, immediateEvents: ['ROBOT_DAMAGE'], localOutcome: 'SUBDUE_RECOVERY' };
  const failedReplay = createRuntimeCommands(environment, failedEpisode, seed);
  assert.equal(failedReplay.some(command => command.type === 'STATE_CHANGE' && command.change === 'VILLAIN_NEUTRALIZED'), false);
  assert.equal(failedReplay.filter(command => command.type === 'STATE_CHANGE' && command.change === 'ROBOT_RECOVERY').length, 1);
  assert.equal(failedReplay.filter(command => command.type === 'TERMINAL').length, 1);
  const recovery = failedReplay.find(command => command.type === 'STATE_CHANGE' && command.change === 'ROBOT_RECOVERY')!;
  assert.ok(failedReplay.indexOf(recovery) < failedReplay.findIndex(command => command.type === 'TERMINAL'));
  assert.deepEqual(applyRuntimePresentationCommand(presentation, recovery), presentation);
  assert.ok(RUNTIME_VISUAL_CONFIG.recoveryVisualMs >= 800 && RUNTIME_VISUAL_CONFIG.recoveryVisualMs <= 1200);

  assert.deepEqual(RUNTIME_VISUAL_CONFIG.subdueLunge, { distance: 16, forwardMs: 140, impactHoldMs: 80, returnMs: 160 });
  const total = RUNTIME_VISUAL_CONFIG.subdueLunge.forwardMs + RUNTIME_VISUAL_CONFIG.subdueLunge.impactHoldMs + RUNTIME_VISUAL_CONFIG.subdueLunge.returnMs;
  assert.ok(total >= 300 && total <= 500);
  const sceneSource = fs.readFileSync('src/modules/reinforcement/runtime/ReinforcementRuntimeScene.ts', 'utf8');
  assert.match(sceneSource, /lastAction\?\.zoneId === command\.location[\s\S]*lastAction\.state === 'VILLAIN_ENCOUNTER'[\s\S]*lastAction\.action === 'SUBDUE'/);
  const lunge = sceneSource.slice(sceneSource.indexOf('private async animateSubdueLunge'), sceneSource.indexOf('private setRobotVisualState'));
  assert.match(lunge, /movementPathIsClear/);
  assert.match(lunge, /setRobotVisualState\('COMBAT'\)[\s\S]*forwardMs[\s\S]*impactHoldMs[\s\S]*returnMs/);
  assert.doesNotMatch(lunge, /routeCursor|projectRouteProgress/);
  const recoveryHandler = sceneSource.slice(sceneSource.indexOf("command.change === 'ROBOT_RECOVERY'"), sceneSource.indexOf("command.change === 'SYSTEM_RESTORED'"));
  assert.match(recoveryHandler, /runtime-robot-neutralized-DOWN/);
  assert.match(recoveryHandler, /recoveryVisualMs[\s\S]*setRobotVisualState\('COMBAT'\)[\s\S]*presentationBusy = false[\s\S]*nextCommandAt/);
});

test('runtime character scale ratios are centralized and neutralized characters keep the same display height', () => {
  assert.equal(RUNTIME_CHARACTER_SCALE.ROBOT, 0.85);
  assert.equal(RUNTIME_CHARACTER_SCALE.CITIZEN, 1.2);
  assert.equal(RUNTIME_CHARACTER_SCALE.AMBIGUOUS, 1.2);
  assert.equal(RUNTIME_CHARACTER_SCALE.VILLAIN, 1.2);
  assert.equal(RUNTIME_CHARACTER_SCALE.BOSS, 1.2);
  assert.equal(RUNTIME_VISUAL_CONFIG.robotDisplayHeight / RUNTIME_BASE_DISPLAY_HEIGHT.ROBOT, 0.85);
  assert.equal(RUNTIME_VISUAL_CONFIG.citizenDisplayHeight / RUNTIME_BASE_DISPLAY_HEIGHT.CITIZEN, 1.2);
  assert.equal(RUNTIME_VISUAL_CONFIG.ambiguousDisplayHeight / RUNTIME_BASE_DISPLAY_HEIGHT.AMBIGUOUS, 1.2);
  assert.equal(RUNTIME_VISUAL_CONFIG.villainDisplayHeight / RUNTIME_BASE_DISPLAY_HEIGHT.VILLAIN, 1.2);
  assert.equal(RUNTIME_VISUAL_CONFIG.bossDisplayHeight / RUNTIME_BASE_DISPLAY_HEIGHT.BOSS, 1.2);
});

test('Robot normal, combat, work and neutralized visuals map all directions without changing its transform contract', () => {
  const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const;
  for (const direction of directions) {
    assert.equal(runtimeRobotTexture('NORMAL', direction), `runtime-robot-idle-${direction}`);
    for (const state of ['COMBAT', 'WORK', 'NEUTRALIZED'] as const) {
      assert.equal(runtimeRobotTexture(state, direction), `runtime-robot-${state.toLowerCase()}-${direction}`);
      assert.equal(fs.existsSync(`assets/characters/robot/base/robot_${state.toLowerCase()}_${direction.toLowerCase()}.png`), true);
    }
  }
  assert.equal(runtimeRobotEncounterState('START', 'VILLAIN_ENCOUNTER'), 'COMBAT');
  assert.equal(runtimeRobotEncounterState('START', 'BOSS_ENCOUNTER'), 'COMBAT');
  assert.equal(runtimeRobotEncounterState('END', 'VILLAIN_ENCOUNTER'), 'NORMAL');
  assert.equal(runtimeRobotEncounterState('START', 'CITIZEN_NEARBY'), 'WORK');
  assert.equal(runtimeRobotEncounterState('END', 'CITIZEN_NEARBY'), 'NORMAL');

  const sceneSource = fs.readFileSync('src/modules/reinforcement/runtime/ReinforcementRuntimeScene.ts', 'utf8');
  assert.match(sceneSource, /command\.state === 'OBSTACLE'.*command\.action === 'PUSH'.*command\.action === 'CLEAR'/);
  assert.match(sceneSource, /command\.reason === 'ROBOT_DISABLED' \? 'NEUTRALIZED' : 'NORMAL'/);
  assert.match(sceneSource, /robotDisabled && state !== 'NEUTRALIZED'/);
  assert.match(sceneSource, /setTexture\(runtimeRobotTexture\(this\.robotVisualState, this\.lastDirection\)\)\.setOrigin\(0\.5, 1\)/);
  assert.match(sceneSource, /scaleSprite\(this\.robot, RUNTIME_VISUAL_CONFIG\.robotDisplayHeight\)/);
});

test('F5 doors use explicit closed/open assets at frame size and Secure entrance repeats native tiles across the TMJ span', () => {
  assert.equal(runtimeSearchDoorTexture(false), 'runtime-door-closed');
  assert.equal(runtimeSearchDoorTexture(true), 'runtime-door-open');
  assert.deepEqual(RUNTIME_ENVIRONMENT_VISUAL_CONFIG.searchDoor, { width: 64, height: 64 });

  const collision = mapSources[4].layers.find(layer => layer.name === 'Collision')!.objects!;
  const doors = collision.filter(object => properties(object).dynamicDoor === true);
  assert.equal(doors.length, 4);
  for (const door of doors) assert.deepEqual({ width: door.width, height: door.height }, { width: 64, height: 32 });

  const lock = collision.find(object => properties(object).dynamicLock === true)!;
  const tiles = planSecureEntrance(axisAlignedBounds(lock));
  assert.deepEqual(tiles.map(tile => tile.texture), [
    'runtime-secure-left',
    'runtime-secure-glass',
    'runtime-secure-glass',
    'runtime-secure-glass',
    'runtime-secure-glass',
    'runtime-secure-right',
  ]);
  assert.ok(tiles.every(tile => tile.width === 32 && tile.height === 64));
  assert.equal(tiles[0].x - tiles[0].width / 2, lock.x);
  assert.equal(tiles.at(-1)!.x + tiles.at(-1)!.width / 2, lock.x + lock.width);
  assert.ok(tiles.slice(1).every((tile, index) => tile.x - tile.width / 2 === tiles[index].x + tiles[index].width / 2));
  assert.equal(fs.existsSync('public/assets/environment/reinforcement/floor5_room_shell_manual/F2_SECURE_3.png'), true);
  assert.equal(fs.existsSync('public/assets/environment/reinforcement/floor5_room_shell_manual/F2_SECURE_4.png'), true);
  assert.deepEqual(RUNTIME_VISUAL_CONFIG.secureEntranceOpen, { unlockPauseMs: 550, openHoldMs: 400 });

  const sceneSource = fs.readFileSync('src/modules/reinforcement/runtime/ReinforcementRuntimeScene.ts', 'utf8');
  const gates = sceneSource.slice(sceneSource.indexOf('private createF5Gates'), sceneSource.indexOf('private execute'));
  assert.match(gates, /runtimeSearchDoorTexture\(false\)/);
  assert.match(gates, /runtimeSearchDoorTexture\(true\)/);
  assert.match(gates, /collider\.body!\.enable = false/);
  assert.doesNotMatch(gates, /RUNTIME_CHARACTER_SCALE|RUNTIME_VISUAL_CONFIG/);
  const opening = sceneSource.slice(sceneSource.indexOf('private showSecurityEntranceOpen'), sceneSource.indexOf('private async animateSubdueLunge'));
  assert.match(opening, /runtime-secure-left-open/);
  assert.match(opening, /runtime-secure-right-open/);
  assert.match(opening, /centers\) center\.setVisible\(false\)/);
  assert.match(opening, /unlockPauseMs[\s\S]*showSecurityEntranceOpen\(\)[\s\S]*openHoldMs/);
  const lockOpen = commands.findIndex(command => command.type === 'STATE_CHANGE' && command.change === 'SECURITY_LOCK_OPEN');
  const entranceMove = commands.findIndex((command, index) => index > lockOpen && command.type === 'MOVE' && command.edgeIds.includes('E_F5_LOCK_CONTROL'));
  assert.ok(lockOpen >= 0 && entranceMove > lockOpen);

  const robotFootprint = runtimeVisualFootprint('ROBOT');
  const moveBefore = (index: number) => commands.slice(0, index).findLast(command => command.type === 'MOVE' && command.points.length > 0);
  for (const [index, command] of commands.entries()) {
    if (command.type !== 'STATE_CHANGE' || command.change !== 'F5_DOOR_OPEN') continue;
    const door = collision.find(object => properties(object).roomId === command.room)!;
    const bounds = axisAlignedBounds(door);
    const previous = moveBefore(index);
    assert.ok(previous?.type === 'MOVE');
    assert.ok(footprintGap(previous.points.at(-1)!, robotFootprint, {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    }, { width: bounds.width, height: bounds.height }) + 0.001 >= RUNTIME_CHARACTER_STAGING_GAP);
  }

  const lockBounds = axisAlignedBounds(lock);
  const lockApproach = moveBefore(lockOpen);
  assert.ok(lockApproach?.type === 'MOVE');
  assert.ok(footprintGap(lockApproach.points.at(-1)!, robotFootprint, {
    x: lockBounds.x + lockBounds.width / 2,
    y: lockBounds.y + lockBounds.height / 2,
  }, RUNTIME_SECURE_ENTRANCE_FOOTPRINT) + 0.001 >= RUNTIME_CHARACTER_STAGING_GAP);
});

test('Floor 5 Core keeps the authored placement and swaps only after the powered presentation state', async () => {
  const map = await decompressTileLayers(mapSources[4]);
  const manualReference = map.tilesets.find(reference => reference.source?.includes('floor5_room_shell_manual'))!;
  const tilesetPath = path.resolve(path.dirname(ACTUAL_MAP_FILES[4]), manualReference.source!);
  const tileset = readJson(tilesetPath);
  const off = tileset.tiles.find((tile: { type: string }) => tile.type === 'F5_CORE');
  const on = tileset.tiles.find((tile: { type: string }) => tile.type === 'F5_CORE_2');
  assert.equal(off.image, 'F5_CORE.png');
  assert.equal(on.image, 'F5_CORE_2.png');
  assert.equal(fs.existsSync(path.resolve(path.dirname(tilesetPath), off.image)), true);
  assert.equal(fs.existsSync(path.resolve(path.dirname(tilesetPath), on.image)), true);
  assert.deepEqual({ width: off.imagewidth, height: off.imageheight }, { width: 64, height: 64 });
  assert.deepEqual({ width: on.imagewidth, height: on.imageheight }, { width: 64, height: 64 });

  const offGid = manualReference.firstgid + off.id;
  const onGid = manualReference.firstgid + on.id;
  const placements = map.layers.flatMap(layer => {
    if (layer.type !== 'tilelayer' || !Array.isArray(layer.data)) return [];
    return layer.data.flatMap((rawGid, cell) => (rawGid & 0x0fffffff) === offGid ? [{
      layer: layer.name,
      x: (cell % map.width) * map.tilewidth + off.imagewidth / 2,
      y: Math.floor(cell / map.width) * map.tileheight + map.tileheight - off.imageheight / 2,
    }] : []);
  });
  assert.deepEqual(placements, [
    { layer: 'Ground', x: 1056, y: 128 },
    { layer: 'Ground', x: 1280, y: 128 },
    { layer: 'Ground', x: 1504, y: 128 },
  ]);
  assert.equal(map.layers.some(layer => layer.type === 'tilelayer' && Array.isArray(layer.data)
    && layer.data.some(rawGid => (rawGid & 0x0fffffff) === onGid)), false);

  const goal = map.layers.find(layer => layer.name === 'NavigationNodes')!.objects!
    .find(object => properties(object).nodeId === 'F5_GOAL')!;
  const selected = placements.reduce((nearest, candidate) =>
    Math.hypot(candidate.x - goal.x, candidate.y - goal.y) < Math.hypot(nearest.x - goal.x, nearest.y - goal.y)
      ? candidate : nearest);
  assert.deepEqual(selected, { layer: 'Ground', x: 1280, y: 128 });
});

test('Core power-on state and timing hold the terminal command until the visual queue completes', () => {
  const restoredIndex = commands.findIndex(command => command.type === 'STATE_CHANGE' && command.change === 'SYSTEM_RESTORED');
  const terminalIndex = commands.findIndex(command => command.type === 'TERMINAL');
  assert.ok(restoredIndex >= 0 && terminalIndex > restoredIndex);

  const initial = createRuntimePresentation(commands, mapSources);
  assert.equal(initial.coreState, 'CORE_OFF');
  const beforeRestore = commands.slice(0, restoredIndex).reduce(applyRuntimePresentationCommand, initial);
  assert.equal(beforeRestore.coreState, 'CORE_OFF');
  const powering = setRuntimeCoreState(beforeRestore, 'CORE_POWERING');
  assert.equal(powering.coreState, 'CORE_POWERING');
  const powered = applyRuntimePresentationCommand(powering, commands[restoredIndex]);
  assert.equal(powered.coreState, 'CORE_ON');
  assert.equal(createRuntimePresentation(commands, mapSources).coreState, 'CORE_OFF');

  assert.deepEqual(RUNTIME_VISUAL_CONFIG.corePowerOn, {
    arrivalPauseMs: 500,
    poweringMs: 850,
    poweredHoldMs: 700,
  });
  assert.ok(RUNTIME_VISUAL_CONFIG.corePowerOn.poweringMs >= 700 && RUNTIME_VISUAL_CONFIG.corePowerOn.poweringMs <= 1000);
  assert.ok(RUNTIME_VISUAL_CONFIG.corePowerOn.poweredHoldMs >= 700);

  const sceneSource = fs.readFileSync('src/modules/reinforcement/runtime/ReinforcementRuntimeScene.ts', 'utf8');
  const powerOn = sceneSource.slice(sceneSource.indexOf('private async animateCorePowerOn'), sceneSource.indexOf('private async animatePresentation'));
  assert.match(powerOn, /arrivalPauseMs[\s\S]*CORE_POWERING[\s\S]*poweringMs[\s\S]*showPoweredCore\(true\)[\s\S]*poweredHoldMs/);
  assert.match(sceneSource, /this\.paused \|\| this\.terminal \|\| this\.presentationBusy/);
  assert.match(sceneSource, /animateCorePowerOn\(command\)[\s\S]*presentationBusy = false[\s\S]*nextCommandAt = this\.time\.now/);
});

test('visual planning does not mutate headless actions, outcomes, rewards, route length, or simulation time', () => {
  const before = structuredClone(episode);
  createRuntimePresentation(commands, mapSources);
  assert.deepEqual(episode, before);
  const replay = createRuntimeCommands(environment, episode, seed);
  assert.deepEqual(replay.filter(command => command.type === 'ACTION' || command.type === 'OUTCOME'), commands.filter(command => command.type === 'ACTION' || command.type === 'OUTCOME'));
  assert.deepEqual(replay.filter(command => command.type === 'MOVE').map(command => command.edgeIds), commands.filter(command => command.type === 'MOVE').map(command => command.edgeIds));
  assert.equal(replay.at(-1)?.simulationTime, episode.elapsedTime);
});

test('five-robot runtime shares one snapshot and commits one update only after all terminals', () => {
  const controller = new FiveRobotRuntimeController(environment, 'FAST', 2);
  assert.equal(controller.robots.length, 5);
  assert.ok(controller.robots.every(robot => robot.commands.length > 0));
  for (const robot of controller.robots.slice(0, 4)) while (controller.advance(robot.robot));
  assert.equal(controller.roundComplete, false);
  assert.equal(controller.policyUpdateCount, 0);
  while (controller.advance(5));
  assert.equal(controller.roundComplete, true);
  assert.equal(controller.policyUpdateCount, 1);
  assert.equal(controller.advance(1), undefined);
});
