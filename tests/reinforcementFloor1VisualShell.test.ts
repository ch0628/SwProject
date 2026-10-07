import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const readJson = async (path: string) => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));
const property = (source: { properties?: { name: string; value: unknown }[] }, name: string) => source.properties?.find(item => item.name === name)?.value;

test('Tiled room-shell prototype is separate, reproducible, and keeps the approved map fingerprint', async () => {
  const [map, tileset, approved] = await Promise.all([
    readJson('public/maps/reinforcement/floor_1_visual_shell_v1.tmj'),
    readJson('public/maps/reinforcement/floor1_visual_shell_v1.tsj'),
    readFile(new URL('public/maps/reinforcement/floor_1_blockout.tmj', ROOT)),
  ]);
  assert.deepEqual([map.width, map.height, map.tilewidth, map.tileheight, map.orientation], [16, 12, 32, 32, 'orthogonal']);
  assert.deepEqual(map.layers.slice(0, 5).map((layer: { name: string }) => layer.name), ['Ground', 'FloorDetail', 'Walls', 'WallTop', 'StaticProps']);
  assert.deepEqual(map.layers.slice(5, 11).map((layer: { name: string }) => layer.name), ['Collision', 'NavigationNodes', 'NavigationEdges', 'EncounterZones', 'FloorTransitions', 'SpawnPoints']);
  assert.equal(property(map, 'prototypeOnly'), true);
  assert.equal(property(map, 'authoringModel'), 'room-shell');
  assert.equal(property(map, 'sourceMapSha256'), createHash('sha256').update(approved).digest('hex'));
  assert.deepEqual([tileset.imagewidth, tileset.imageheight, tileset.tilewidth, tileset.tileheight], [256, 64, 32, 64]);
  assert.deepEqual(tileset.tiles.map((tile: { class: string }) => tile.class), ['FLOOR_PUBLIC', 'FLOOR_SERVICE', 'BACK_WALL', 'SIDE_LEFT', 'SIDE_RIGHT', 'SOUTH_TRIM', 'DOOR_LEFT', 'DOOR_RIGHT']);
  assert.equal(tileset.tiles.some((tile: { class: string }) => tile.class.includes('CORNER')), false);
});

test('room shell leaves one real door opening and uses thin side/south visual bands', async () => {
  const map = await readJson('public/maps/reinforcement/floor_1_visual_shell_v1.tmj');
  const layer = (name: string) => map.layers.find((candidate: { name: string }) => candidate.name === name);
  const collision = layer('Collision').objects;
  const north = collision.filter((object: { name: string }) => object.name.startsWith('SHELL_NORTH'));
  assert.deepEqual(north.map((object: { x: number; width: number }) => [object.x, object.x + object.width]), [[64, 230], [282, 448]]);
  assert.equal(north[1].x - (north[0].x + north[0].width), 52);
  const bounds = (name: string) => {
    const object = collision.find((candidate: { name: string }) => candidate.name === name);
    return [object.x, object.y, object.width, object.height];
  };
  assert.deepEqual(bounds('SHELL_LEFT'), [64, 160, 32, 160]);
  assert.deepEqual(bounds('SHELL_SOUTH'), [64, 320, 384, 32]);
  const wallTop = layer('WallTop').data;
  assert.deepEqual(wallTop.slice(4 * 16 + 2, 4 * 16 + 14), [3, 3, 3, 3, 3, 7, 8, 3, 3, 3, 3, 3]);
  assert.equal(layer('Walls').data[5 * 16 + 2], 4);
  assert.equal(layer('Walls').data[10 * 16 + 8], 6);
});
