import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { axisAlignedBounds, properties } from '../src/modules/reinforcement/debug/floor1Tiled.ts';
import { episodeSeed } from '../src/modules/reinforcement/sim/learningEngine.ts';
import { ACTUAL_GRAPH_FILE, ACTUAL_MAP_FILES, buildActualMapEnvironment } from '../src/modules/reinforcement/sim/actualMapEnvironment.ts';
import { runActualMapProfile } from '../src/modules/reinforcement/sim/actualMapSimulation.ts';
import { FiveRobotRuntimeController } from '../src/modules/reinforcement/runtime/runtimeController.ts';
import {
  applyRuntimeCommand,
  createRuntimeCommands,
  directionForSegment,
  initialRuntimePlaybackState,
  orientedPath,
  RUNTIME_CONTACT_FOOTPRINTS,
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
} from '../src/modules/reinforcement/runtime/runtimePresentation.ts';

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

test('runtime adapter deterministically replays only headless-selected decisions', () => {
  assert.deepEqual(commands, createRuntimeCommands(environment, episode, seed));
  assert.deepEqual(commands.filter(command => command.type === 'ACTION').map(command => command.action), episode.actionHistory.filter(action => action.state !== 'ROUTE_CHOICE').map(action => action.action));
  assert.equal(commands.at(-1)?.type, 'TERMINAL');
  assert.equal(commands.at(-1)?.simulationTime, episode.elapsedTime);
});

test('runtime MOVE commands preserve actual Navigation Edge polylines', () => {
  const moves = commands.filter(command => command.type === 'MOVE');
  assert.ok(moves.length > 0);
  for (const move of moves) {
    const edgeSegments = move.edgeIds.flatMap(id => {
      const points = environment.edges.find(edge => edge.id === id)!.points;
      return points.slice(1).map((point, index) => [points[index], point] as const);
    });
    for (const point of move.points) assert.ok(edgeSegments.some(([from, to]) => pointOnSegment(point, from, to)), `${move.edgeIds.join(',')}: ${point.x},${point.y}`);
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
