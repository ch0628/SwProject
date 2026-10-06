import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { decompressTileLayers, embedTileset, properties, validateFloor1Map, type TiledMapJson } from '../src/modules/reinforcement/debug/floor1Tiled.ts';

const map = JSON.parse(readFileSync('public/maps/reinforcement/floor_1_blockout.tmj', 'utf8')) as TiledMapJson;
const tileset = JSON.parse(readFileSync('public/maps/reinforcement/reinforcement_blockout_tileset.tsj', 'utf8')) as Record<string, unknown>;

test('Floor 1 debug runtime contract matches the approved Tiled map', () => {
  const result = validateFloor1Map(map);
  assert.deepEqual([result.spawn.x, result.spawn.y], [1264, 1296]);
  assert.equal(result.transitions.length, 2);
  assert.deepEqual(result.transitions.map(object => properties(object).targetSpawn), ['F2_LEFT_ARRIVAL', 'F2_RIGHT_ARRIVAL']);
  assert.ok(result.collision.some(object => object.name === 'WALL_45_1'));
  assert.ok(result.collision.some(object => object.name === 'WALL_45_2'));
});

test('external TSJ is embedded only in the runtime copy', () => {
  const embedded = embedTileset(map, tileset);
  assert.equal(map.tilesets[0].source, 'reinforcement_blockout_tileset.tsj');
  assert.equal(embedded.tilesets[0].source, undefined);
  assert.equal(embedded.tilesets[0].name, 'reinforcement_blockout_tileset');
  assert.equal(embedded.tilesets[0].firstgid, 1);
});

test('zlib/base64 tile layers expand to Phaser-compatible gid arrays', async () => {
  const expanded = await decompressTileLayers(map);
  for (const layer of expanded.layers.filter(layer => layer.type === 'tilelayer')) {
    assert.equal(Array.isArray(layer.data), true);
    assert.equal(layer.data?.length, 80 * 45);
    assert.equal(layer.encoding, undefined);
    assert.equal(layer.compression, undefined);
  }
});

test('runtime validation fails clearly when a required layer is missing', () => {
  const broken = { ...map, layers: map.layers.filter(layer => layer.name !== 'Collision') };
  assert.throws(() => validateFloor1Map(broken), /required object layer "Collision" is missing/);
});
