import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { TiledMapJson } from '../src/modules/reinforcement/debug/floor1Tiled.ts';
import { floor3RoutePoints, floor3TileDepth, missingFloor3TextureMessage, validateFloor3Map } from '../src/modules/reinforcement/debug/floor3Tiled.ts';

const map = JSON.parse(readFileSync('public/maps/reinforcement/floor_3_blockout.tmj', 'utf8')) as TiledMapJson;

test('Floor 3 debug runtime contract matches the Tiled map', () => {
  const result = validateFloor3Map(map);
  assert.deepEqual([result.spawn.x, result.spawn.y], [1280, 1184]);
  assert.equal(result.encounters.filter(object => object.name.includes('OBSTACLE')).length, 4);
  assert.deepEqual(result.transitions.map(object => object.name).sort(), ['F3_LEFT_STAIR_TRANSITION', 'F3_RIGHT_STAIR_TRANSITION']);
});

test('Floor 3 route probes end at their separate stairs', () => {
  const { edges } = validateFloor3Map(map);
  assert.deepEqual(floor3RoutePoints(edges, 'F3_LEFT_MAINTENANCE_ROUTE').at(-1), { x: 640, y: 240 });
  assert.deepEqual(floor3RoutePoints(edges, 'F3_RIGHT_PERIMETER_ROUTE').at(-1), { x: 2176, y: 240 });
});

test('Floor 3 validation rejects one-pixel stair collision overlap', () => {
  const layers = map.layers.map(layer => layer.name === 'Collision' ? { ...layer, objects: [...(layer.objects ?? []), { id: 999, name: 'BAD_STAIR_COLLISION', x: 447, y: 96, width: 2, height: 1 }] } : layer);
  assert.throws(() => validateFloor3Map({ ...map, layers }), /left stair area must be collision-free/);
});

test('Floor 3 missing manual texture message names ASSET_IDS', () => {
  assert.match(missingFloor3TextureMessage('F3_FLOOR_GREY'), /"F3_FLOOR_GREY".*ASSET_IDS/);
});

test('Floor 3 manual Ground tiles render above blockout placeholders', () => {
  assert.ok(floor3TileDepth('Ground', true) > floor3TileDepth('StaticProps', false));
  assert.ok(floor3TileDepth('Ground', true) > 5);
});
