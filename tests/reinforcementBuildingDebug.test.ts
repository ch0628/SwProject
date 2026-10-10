import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BuildingTransitionGate, resolveBuildingSpawn } from '../src/modules/reinforcement/debug/buildingTransitions.ts';
import { contains, properties, type TiledMapJson } from '../src/modules/reinforcement/debug/floor1Tiled.ts';

const maps = new Map(Array.from({ length: 5 }, (_, index) => {
  const floor = index + 1;
  return [floor, JSON.parse(readFileSync(`public/maps/reinforcement/floor_${floor}_blockout.tmj`, 'utf8')) as TiledMapJson];
}));
const objects = (floor: number, layer: string) => maps.get(floor)!.layers.find(candidate => candidate.name === layer)?.objects ?? [];
const contracts = [
  [1, 'F1_LEFT_STAIR', 2, 'F2_LEFT_ARRIVAL'],
  [1, 'F1_RIGHT_STAIR', 2, 'F2_RIGHT_ARRIVAL'],
  [2, 'F2_CENTER_STAIR', 3, 'F3_CENTER_ARRIVAL'],
  [3, 'F3_LEFT_STAIR', 4, 'F4_LEFT_ARRIVAL'],
  [3, 'F3_RIGHT_STAIR', 4, 'F4_RIGHT_ARRIVAL'],
  [4, 'F4_CENTER_STAIR', 5, 'F5_SEARCH_HUB'],
] as const;
const stairProgress = [
  [1, 'F1_LEFT_STAIR', 176, 64],
  [1, 'F1_RIGHT_STAIR', 176, 64],
  [2, 'F2_CENTER_STAIR', 336, 72],
  [3, 'F3_LEFT_STAIR', 448, 96],
  [3, 'F3_RIGHT_STAIR', 384, 96],
  [4, 'F4_CENTER_STAIR', 336, 72],
] as const;

for (const [sourceFloor, stairId, targetFloor, targetSpawn] of contracts) {
  test(`F${sourceFloor} ${stairId} transitions to F${targetFloor} ${targetSpawn}`, () => {
    const transition = objects(sourceFloor, 'FloorTransitions').find(object => properties(object).stairId === stairId)!;
    const gate = new BuildingTransitionGate();
    assert.equal(gate.consume(null), null);
    const destination = gate.consume(transition)!;
    assert.equal(destination.targetFloor, targetFloor);
    assert.equal(destination.targetSpawn, targetSpawn);
    const spawns = objects(targetFloor, 'SpawnPoints');
    assert.equal(properties(resolveBuildingSpawn(spawns, destination.sceneData, targetFloor, spawns[0])).spawnId, targetSpawn);
    assert.equal(gate.consume(transition), null);
  });
}

for (const [floor, stairId, entranceY, destinationY] of stairProgress) {
  test(`F${floor} ${stairId} activates only after 60% stair progress`, () => {
    const transition = objects(floor, 'FloorTransitions').find(object => properties(object).stairId === stairId)!;
    const x = transition.x + transition.width / 2;
    const beforeSixtyPercentY = entranceY - (entranceY - destinationY) * 0.59;
    const firstTriggerY = transition.y + transition.height;
    assert.equal(transition.height, 32);
    assert.equal(contains(transition, x, entranceY), false);
    assert.equal(contains(transition, x, beforeSixtyPercentY), false);
    assert.equal(contains(transition, x, transition.y + transition.height / 2), true);
    assert.ok((entranceY - firstTriggerY) / (entranceY - destinationY) >= 0.6);
  });
}

test('missing targetSpawn fails with a clear error', () => {
  const spawns = objects(2, 'SpawnPoints');
  assert.throws(() => resolveBuildingSpawn(spawns, { buildingMode: true, entrySpawnId: 'MISSING' }, 2, spawns[0]), /targetSpawn "MISSING" found 0 times/);
});

test('transition gate ignores initial overlap and requires leaving before one transition', () => {
  const transition = objects(1, 'FloorTransitions')[0];
  const gate = new BuildingTransitionGate();
  assert.equal(gate.consume(transition), null);
  assert.equal(gate.consume(null), null);
  assert.ok(gate.consume(transition));
  assert.equal(gate.consume(transition), null);
});
