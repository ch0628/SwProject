import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const contracts = [
  [1, 'F1_LEFT_STAIR', 2, 'F2_LEFT_ARRIVAL'],
  [1, 'F1_RIGHT_STAIR', 2, 'F2_RIGHT_ARRIVAL'],
  [2, 'F2_CENTER_STAIR', 3, 'F3_CENTER_ARRIVAL'],
  [3, 'F3_LEFT_STAIR', 4, 'F4_LEFT_ARRIVAL'],
  [3, 'F3_RIGHT_STAIR', 4, 'F4_RIGHT_ARRIVAL'],
  [4, 'F4_CENTER_STAIR', 5, 'F5_SEARCH_HUB'],
];
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const properties = object => Object.fromEntries((object?.properties ?? []).map(({ name, value }) => [name, value]));
const maps = new Map();

for (let floor = 1; floor <= 5; floor += 1) {
  const path = resolve(root, `public/maps/reinforcement/floor_${floor}_blockout.tmj`);
  try {
    maps.set(floor, JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    console.error(`FAIL: cannot parse ${path}: ${error.message}`);
    process.exit(1);
  }
}

const objects = (floor, layerName) => maps.get(floor).layers?.find(layer => layer.name === layerName)?.objects ?? [];
const transitions = [...maps.keys()].flatMap(floor =>
  objects(floor, 'FloorTransitions').map(object => ({ floor, object, values: properties(object) })),
);
const duplicates = values => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

check(transitions.length === contracts.length, `expected ${contracts.length} transitions, found ${transitions.length}`);
for (const field of ['name', 'transitionId', 'stairId']) {
  const values = transitions.map(({ object, values: props }) => field === 'name' ? object.name : props[field]);
  for (const value of duplicates(values)) check(false, `duplicate transition ${field}: ${value}`);
}

for (const [sourceFloor, stairId, targetFloor, targetSpawn] of contracts) {
  const transitionId = `${stairId}_TRANSITION`;
  const matches = transitions.filter(({ floor, values }) => floor === sourceFloor && values.stairId === stairId);
  check(matches.length === 1, `${transitionId}: expected exactly one transition object, found ${matches.length}`);
  const transition = matches[0];
  if (!transition) continue;

  const { object, values } = transition;
  check(object.name === transitionId, `${transitionId}: object name is ${object.name}`);
  check((object.class ?? object.type) === 'FloorTransition', `${transitionId}: object type is not FloorTransition`);
  check(values.transitionId === transitionId, `${transitionId}: transitionId is ${values.transitionId}`);
  check(values.targetFloor === targetFloor, `${transitionId}: targetFloor is ${values.targetFloor}, expected ${targetFloor}`);
  check(values.targetSpawn === targetSpawn, `${transitionId}: targetSpawn is ${values.targetSpawn}, expected ${targetSpawn}`);

  const sourceNodes = objects(sourceFloor, 'NavigationNodes').filter(node => properties(node).nodeId === stairId);
  check(sourceNodes.length === 1, `${transitionId}: source node ${stairId} found ${sourceNodes.length} times`);
  const targetSpawns = objects(targetFloor, 'SpawnPoints').filter(spawn => properties(spawn).spawnId === targetSpawn);
  const targetNodes = objects(targetFloor, 'NavigationNodes').filter(node => properties(node).nodeId === targetSpawn);
  check(targetSpawns.length === 1, `${transitionId}: target SpawnPoint ${targetSpawn} found ${targetSpawns.length} times`);
  check(targetNodes.length <= 1, `${transitionId}: target node ${targetSpawn} found ${targetNodes.length} times`);
}

const expectedIds = new Set(contracts.map(([, stairId]) => `${stairId}_TRANSITION`));
for (const { floor, object, values } of transitions) {
  check(expectedIds.has(values.transitionId), `orphan transition on Floor ${floor}: ${values.transitionId ?? object.name}`);
}
for (const [, , targetFloor, targetSpawn] of contracts) {
  const references = transitions.filter(({ values }) => values.targetFloor === targetFloor && values.targetSpawn === targetSpawn);
  check(references.length === 1, `target ${targetSpawn} is referenced ${references.length} times`);
}

if (failures.length) {
  console.error(`FAIL cross-floor transitions (${failures.length})`);
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS_CROSS_FLOOR_TRANSITIONS');
  for (const [sourceFloor, stairId, targetFloor, targetSpawn] of contracts) {
    console.log(`PASS F${sourceFloor} ${stairId} -> F${targetFloor} ${targetSpawn}`);
  }
  console.log('targetFloor mismatch: none');
  console.log('targetSpawn mismatch: none');
  console.log('missing spawn: none');
  console.log('duplicate transition: none');
  console.log('orphan transition: none');
}
