import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { decompressTileLayers, properties, validateFloor1Map, type TiledMapJson } from '../src/modules/reinforcement/debug/floor1Tiled.ts';

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

test('manual room-shell tileset contains the normalized assets', () => {
  const expected = new Map([
    ['F1_FLOOR_PUBLIC', [32, 32]], ['F1_FLOOR_SERVICE', [32, 32]],
    ['F1_BACK_WALL_PLAIN', [32, 64]], ['F1_BACK_WALL_VARIANT_A', [32, 64]], ['F1_BACK_WALL_VARIANT_B', [32, 64]],
    ['F1_SIDE_WALL_LEFT', [32, 32]], ['F1_SIDE_WALL_RIGHT', [32, 32]],
    ['F1_SIDE_END_TOP', [32, 32]], ['F1_SIDE_END_BOTTOM', [32, 32]],
    ['F1_BACK_CORNER_LEFT', [32, 64]], ['F1_BACK_CORNER_RIGHT', [32, 64]],
    ['F1_DOOR_H_CLOSED', [64, 64]], ['F1_DOOR_H_OPEN', [64, 64]],
    ['F1_WALL_CORNER_L', [32, 32]], ['F1_STAIR_SEAMLESS', [32, 32]],
  ]);
  assert.equal(tileset.name, 'floor1_room_shell_manual');
  assert.equal(tileset.tilecount, expected.size);
  for (const tile of tileset.tiles) assert.deepEqual([tile.imagewidth, tile.imageheight], expected.get(tile.class ?? tile.type));
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
  assert.deepEqual(
    map.layers.filter(layer => layer.type === 'objectgroup').map(layer => [layer.name, layer.objects?.length]),
    [['Collision', 153], ['NavigationNodes', 10], ['NavigationEdges', 10], ['EncounterZones', 4], ['FloorTransitions', 2], ['SpawnPoints', 1], ['Debug', 4], ['ArchitecturalMass', 8]],
  );
});
