import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { properties, type TiledMapJson } from '../src/modules/reinforcement/debug/floor1Tiled.ts';
import { floor2RoutePoints, spawnSideFromSearch, validateFloor2Map } from '../src/modules/reinforcement/debug/floor2Tiled.ts';

const map = JSON.parse(readFileSync('public/maps/reinforcement/floor_2_blockout.tmj', 'utf8')) as TiledMapJson;

test('Floor 2 debug runtime contract matches the Tiled map', () => {
  const result = validateFloor2Map(map);
  assert.deepEqual([result.spawns.LEFT.x, result.spawns.LEFT.y], [304, 1120]);
  assert.deepEqual([result.spawns.RIGHT.x, result.spawns.RIGHT.y], [2256, 1120]);
  assert.equal(properties(result.transitions[0]).targetSpawn, 'F3_CENTER_ARRIVAL');
  assert.equal(result.encounters.find(object => object.name === 'F2_CENTER_GUARD_ZONE')?.name, 'F2_CENTER_GUARD_ZONE');
});

test('Floor 2 route probes follow each preserved route to the center guard', () => {
  const { edges } = validateFloor2Map(map);
  for (const route of ['F2_DIRECT_OFFICE_ROUTE', 'F2_OUTER_CORRIDOR_ROUTE', 'F2_INNER_HALL_ROUTE', 'F2_SERVICE_DETOUR_ROUTE'] as const) {
    const points = floor2RoutePoints(edges, route);
    assert.deepEqual(points.at(-1), { x: 1280, y: 560 });
  }
});

test('Floor 2 debug spawn query defaults left and accepts right case-insensitively', () => {
  assert.equal(spawnSideFromSearch('?mode=reinforcement-floor2-debug'), 'LEFT');
  assert.equal(spawnSideFromSearch('?mode=reinforcement-floor2-debug&spawn=right'), 'RIGHT');
});

test('Floor 2 validation fails clearly when a required layer is missing', () => {
  assert.throws(() => validateFloor2Map({ ...map, layers: map.layers.filter(layer => layer.name !== 'Collision') }), /required object layer "Collision" is missing/);
});

test('Floor 2 center stair footprint rejects collision objects', () => {
  const layers = map.layers.map(layer => layer.name === 'Collision' ? { ...layer, objects: [...(layer.objects ?? []), { id: 999, name: 'BAD_STAIR_COLLISION', x: 1088, y: 64, width: 352, height: 192 }] } : layer);
  assert.throws(() => validateFloor2Map({ ...map, layers }), /center stair area.*must be collision-free/);
});
