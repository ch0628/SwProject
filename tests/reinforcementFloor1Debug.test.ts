import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { axisAlignedBounds, decompressTileLayers, properties, validateFloor1Map, type TiledMapJson } from '../src/modules/reinforcement/debug/floor1Tiled.ts';

const map = JSON.parse(readFileSync('public/maps/reinforcement/floor_1_blockout.tmj', 'utf8')) as TiledMapJson;
const tileset = JSON.parse(readFileSync('public/assets/environment/reinforcement/floor1_room_shell_manual/floor1_room_shell_manual.tsj', 'utf8')) as {
  name: string;
  tilecount: number;
  tiles: { id: number; class?: string; type?: string; imagewidth: number; imageheight: number }[];
};

test('Floor 1 debug runtime contract matches the current Tiled map', () => {
  const result = validateFloor1Map(map);
  assert.deepEqual([result.spawn.x, result.spawn.y], [1264, 1296]);
  assert.equal(result.transitions.length, 2);
  assert.deepEqual(result.transitions.map(object => properties(object).targetSpawn), ['F2_LEFT_ARRIVAL', 'F2_RIGHT_ARRIVAL']);
  assert.ok(result.collision.some(object => object.name === 'WALL_45_1'));
  assert.ok(result.collision.some(object => object.name === 'WALL_45_2'));
  assert.equal(result.architecturalMass.length, 8);
});

test('manual room-shell tileset contains valid normalized assets', () => {
  assert.equal(tileset.name, 'floor1_room_shell_manual');
  assert.equal(tileset.tilecount, tileset.tiles.length);
  assert.equal(new Set(tileset.tiles.map(tile => tile.id)).size, tileset.tiles.length);
  assert.equal(new Set(tileset.tiles.map(tile => tile.class ?? tile.type)).size, tileset.tiles.length);
  for (const tile of tileset.tiles) {
    assert.ok(tile.class ?? tile.type);
    assert.equal(tile.imagewidth % 32, 0);
    assert.equal(tile.imageheight % 32, 0);
  }
});

test('rotated Tiled rectangles use their displayed collision bounds', () => {
  const collision = validateFloor1Map(map).collision;
  assert.deepEqual(axisAlignedBounds(collision.find(object => object.name === 'WAITING_SOFA_WEST_1')!), { x: 802, y: 1184, width: 64, height: 32 });
  assert.deepEqual(axisAlignedBounds(collision.find(object => object.name === 'WAITING_SOFA_WEST_2')!), { x: 802, y: 1152, width: 64, height: 32 });
});

test('zlib/base64 tile layers expand to gid arrays', async () => {
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

test('only active gameplay object layers remain', () => {
  const layers = map.layers.filter(layer => layer.type === 'objectgroup');
  assert.deepEqual(layers.map(layer => layer.name), ['Collision', 'NavigationNodes', 'NavigationEdges', 'EncounterZones', 'FloorTransitions', 'SpawnPoints', 'Debug', 'ArchitecturalMass']);
  assert.ok((layers.find(layer => layer.name === 'Collision')?.objects?.length ?? 0) > 0);
});
