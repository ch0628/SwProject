import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { axisAlignedBounds, properties, type TiledMapJson } from '../src/modules/reinforcement/debug/floor1Tiled.ts';
import { ACTUAL_GRAPH_FILE, ACTUAL_MAP_FILES, buildActualMapEnvironment } from '../src/modules/reinforcement/sim/actualMapEnvironment.ts';
import { runActualMapTraining } from '../src/modules/reinforcement/sim/actualMapSimulation.ts';
import { episodeSeed, rewardWeightsFromStars } from '../src/modules/reinforcement/sim/learningEngine.ts';
import { createRuntimeCommands, type RuntimeCommand, type RuntimePoint } from '../src/modules/reinforcement/runtime/runtimeCommands.ts';
import { planLocalMovement, runtimeVisualFootprint } from '../src/modules/reinforcement/runtime/runtimeMovement.ts';
import {
  applyRuntimePresentationCommand,
  createRuntimePresentation,
  entitiesForFloor,
  presentationMotionForCommand,
} from '../src/modules/reinforcement/runtime/runtimePresentation.ts';

const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const maps = ACTUAL_MAP_FILES.map(readJson) as TiledMapJson[];
const environment = buildActualMapEnvironment(maps, readJson(ACTUAL_GRAPH_FILE));
const training = runActualMapTraining(
  environment,
  rewardWeightsFromStars({ speed: 1, judgment: 3, threat: 2 }),
  42,
  20,
  5,
);

const spawnPoint = (floor: number, spawnId: string): RuntimePoint => {
  const objects = maps[floor - 1].layers.find(layer => layer.name === 'SpawnPoints')?.objects ?? [];
  const spawn = objects.find(object => properties(object).spawnId === spawnId) ?? objects[0];
  assert.ok(spawn, `F${floor} spawn ${spawnId} is missing`);
  return { x: spawn.x, y: spawn.y };
};

const activeWalls = (floor: number, openDoors: readonly string[], securityLockOpen: boolean) =>
  (maps[floor - 1].layers.find(layer => layer.name === 'Collision')?.objects ?? []).filter(object => {
    const values = properties(object);
    if (values.blocksRobot === false || object.width <= 0 || object.height <= 0) return false;
    if (values.dynamicLock === true) return !securityLockOpen;
    if (values.dynamicDoor === true) return !openDoors.includes(String(values.roomId));
    return true;
  }).map(axisAlignedBounds);

const auditCommands = (commands: RuntimeCommand[]) => {
  let floor = 1;
  let position = spawnPoint(1, 'F1_ROBOT_SPAWN');
  let presentation = createRuntimePresentation(commands, maps);
  for (const command of commands) {
    assert.equal(command.floor, floor, `MOVE ${command.commandId}: logical/runtime floor mismatch`);
    if (command.type === 'MOVE') {
      const map = maps[floor - 1];
      const blockers = entitiesForFloor(presentation, floor).filter(entity => entity.blocking).map(entity => ({
        id: entity.id,
        point: entity.position,
        footprint: runtimeVisualFootprint(entity.kind),
      }));
      const plan = planLocalMovement(command.points, position, {
        x: 0,
        y: 0,
        width: map.width * map.tilewidth,
        height: map.height * map.tileheight,
      }, activeWalls(floor, presentation.openDoors, presentation.securityLockOpen), blockers);
      assert.equal(plan.valid, true, `Runtime MOVE ${command.commandId} has no collision-free path`);
      position = command.points.at(-1)!;
    } else if (command.type === 'STATE_CHANGE') {
      const motion = presentationMotionForCommand(presentation, command);
      if (motion?.kind === 'PUSH' && motion.robotPushTo) position = motion.robotPushTo;
      presentation = applyRuntimePresentationCommand(presentation, command);
    } else if (command.type === 'FLOOR_TRANSITION') {
      floor = command.targetFloor;
      position = spawnPoint(floor, command.targetSpawn);
    } else if (command.type === 'TERMINAL' && command.reason === 'GOAL_REACHED') {
      assert.deepEqual(position, environment.edges.find(edge => edge.id === 'E_F5_CONTROL_GOAL')!.points.at(-1));
    }
  }
};

test('production observation checkpoints and the former MOVE 64 reroute case have no runtime path or floor divergence', () => {
  for (const roundNumber of [1, 4, 5, 10, 15, 20]) {
    const round = training.rounds[roundNumber - 1];
    for (const episode of round.episodes) {
      auditCommands(createRuntimeCommands(environment, episode, episodeSeed(42, roundNumber, episode.robot)));
    }
  }
});

test('Boss discovery keeps one room, recovery stays in-place, and retreat returns only to the same encounter staging', () => {
  for (const round of training.rounds) for (const episode of round.episodes) {
    const commands = createRuntimeCommands(environment, episode, episodeSeed(42, round.round, episode.robot));
    let bossRoom: string | undefined;
    let bossPosition: RuntimePoint | undefined;
    let bossNeutralized = false;
    let recovering = false;
    for (const command of commands) {
      if (command.type === 'STATE_CHANGE' && command.change === 'BOSS_FOUND') bossRoom = command.room;
      if (command.type === 'ENCOUNTER' && command.phase === 'START' && command.encounter === 'BOSS_ENCOUNTER') bossPosition = command.position;
      if (command.type === 'STATE_CHANGE' && command.change === 'BOSS_NEUTRALIZED') bossNeutralized = true;
      if (bossRoom && !bossNeutralized && command.type === 'STATE_CHANGE') {
        assert.notEqual(command.change, 'NO_BOSS');
        if (command.change === 'F5_DOOR_OPEN') assert.equal(command.room, bossRoom);
      }
      if (bossRoom && !bossNeutralized && command.type === 'ENCOUNTER' && command.phase === 'START') {
        assert.ok(command.encounter === 'BOSS_ENCOUNTER' || command.zoneId.endsWith(`${bossRoom}_GUARD_ZONE`));
      }
      if (bossRoom && bossPosition && !bossNeutralized && command.type === 'MOVE') assert.notDeepEqual(command.points.at(-1), bossPosition);
      if (command.type === 'OUTCOME' && command.state === 'BOSS_ENCOUNTER') recovering = command.outcome === 'SUBDUE_RECOVERY';
      else if (recovering && command.type === 'STATE_CHANGE' && command.change === 'ROBOT_RECOVERY') continue;
      else if (recovering && command.type === 'ACTION') recovering = false;
      else if (recovering) assert.notEqual(command.type, 'MOVE', 'Boss SUBDUE recovery must not move to Spawn/Search Hub');
    }
  }
});

test('F5 character encounters use same-x vertical staging and Boss retreat re-approaches that staging instead of its center', () => {
  for (const roundNumber of [1, 5, 10, 15, 20]) for (const episode of training.rounds[roundNumber - 1].episodes) {
    const commands = createRuntimeCommands(environment, episode, episodeSeed(42, roundNumber, episode.robot));
    for (const [index, command] of commands.entries()) {
      if (command.type !== 'ENCOUNTER' || command.phase !== 'START' || command.floor !== 5) continue;
      assert.equal(command.stagingFallback, false);
      assert.equal(command.stagingPosition.x, command.position.x, `${command.zoneId} must stage on the same x-axis`);
      if (command.encounter !== 'BOSS_ENCOUNTER') continue;
      const previous = commands.slice(0, index).findLast(candidate => candidate.type === 'MOVE');
      assert.ok(previous?.type === 'MOVE');
      assert.deepEqual(previous.points.at(-1), command.stagingPosition);
      assert.notDeepEqual(previous.points.at(-1), command.position);
    }
  }
});

