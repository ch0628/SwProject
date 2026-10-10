import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { properties, type TiledMapJson } from '../src/modules/reinforcement/debug/floor1Tiled.ts';
import { FLOOR5_ROOMS, floor5ProbePoints, floor5RoomPathLengths, floor5TileDepth, missingFloor5PngMessage, missingFloor5TextureMessage, validateFloor5Map } from '../src/modules/reinforcement/debug/floor5Tiled.ts';

const map = JSON.parse(readFileSync('public/maps/reinforcement/floor_5_blockout.tmj', 'utf8')) as TiledMapJson;
const sceneSource = readFileSync('src/modules/reinforcement/debug/ReinforcementFloor5DebugScene.ts', 'utf8');

test('Floor 5 debug runtime contract matches the v3 Tiled map', () => {
  const result = validateFloor5Map(map);
  assert.deepEqual([result.spawn.x, result.spawn.y], [1280, 1200]);
  assert.equal(result.nodes.length, 15);
  assert.equal(result.edges.length, 21);
  assert.equal(result.encounters.length, 4);
  assert.equal(result.rooms.length, 4);
  assert.equal(result.ratio.toFixed(4), '1.0104');
  assert.equal(result.spread, 0.5);
  assert.deepEqual(properties(result.securityLock), { blocksRobot: true, dynamicLock: true, requiresState: 'BOSS_NEUTRALIZED' });
});

test('Floor 5 four search probes reach rooms with equalized actual polyline lengths', () => {
  const { edges } = validateFloor5Map(map);
  const lengths = floor5RoomPathLengths(edges);
  assert.deepEqual(lengths, { L1: 48, L2: 48.5, R1: 48, R2: 48.5 });
  for (const room of FLOOR5_ROOMS) assert.deepEqual(floor5ProbePoints(edges, room, 'SEARCH').at(-1), {
    L1: { x: 304, y: 640 }, L2: { x: 704, y: 224 }, R1: { x: 2256, y: 640 }, R2: { x: 1856, y: 224 },
  }[room]);
});

test('Floor 5 state probes preserve NO_BOSS return and post-Boss Goal flow', () => {
  const { edges } = validateFloor5Map(map);
  for (const room of FLOOR5_ROOMS) {
    assert.deepEqual(floor5ProbePoints(edges, room, 'NO_BOSS').at(-1), { x: 1280, y: 1200 });
    assert.deepEqual(floor5ProbePoints(edges, room, 'POST_BOSS').at(-1), { x: 1280, y: 224 });
  }
  assert.match(sceneSource, /this\.securityLockCollider\.body!\.enable = !value/);
  assert.match(sceneSource, /this\.setBossNeutralized\(true\)/);
});

test('Floor 5 keeps four Villain ×1 guards and hidden seeded Boss policy', () => {
  const result = validateFloor5Map(map);
  for (const room of FLOOR5_ROOMS) {
    const values = properties(result.encounters.find(encounter => properties(encounter).roomId === room)!);
    assert.equal(values.villainCount, 1);
    assert.equal(values.bypassAvailable, false);
    assert.equal(values.encounterType, 'VILLAIN_ENCOUNTER');
  }
  const values = properties(map as never);
  assert.equal(values.locationSelection, 'SEEDED_RANDOM_PER_EPISODE');
  assert.equal(values.locationPolicyVisibility, false);
  assert.equal(values.repeatSelectionAllowed, false);
  assert.equal(values.contextKeyIncludesHiddenLocation, false);
});

test('Floor 5 manual Ground tiles render above every blockout placeholder', () => {
  assert.ok(floor5TileDepth('Ground', true) > floor5TileDepth('StaticProps', false));
  assert.equal(floor5TileDepth('Ground', true), 6);
});

test('Floor 5 renderer retains Tiled transforms, large-tile bottom anchor, and diagnostics', () => {
  assert.match(sceneSource, /Phaser\.Tilemaps\.Parsers\.Tiled\.ParseGID\(rawGid\)/);
  assert.match(sceneSource, /setRotation\(gid\.rotation\)\.setFlipX\(gid\.flipped\)/);
  assert.match(sceneSource, /cellY \+ map\.tileheight - tile\.imageheight \/ 2/);
  assert.match(missingFloor5TextureMessage('F5_FLOOR'), /"F5_FLOOR".*ASSET_IDS/);
  assert.match(missingFloor5PngMessage('F5_FLOOR'), /ASSET_IDS.*floor5_room_shell_manual\/F5_FLOOR\.png/);
});

test('Floor 5 debug has no persistent semantic route or Boss overlay', () => {
  assert.match(sceneSource, /navigationOverlay = .*\.setVisible\(false\)/);
  assert.match(sceneSource, /encounterOverlay = [\s\S]*?\.setVisible\(false\)/);
  assert.match(sceneSource, /collisionOverlay = .*\.setVisible\(false\)/);
  assert.doesNotMatch(sceneSource, /bossRoom|bossLocation/);
});

test('Floor 5 manual tileset starts empty with the filename/Class/ASSET_IDS contract', () => {
  const tileset = JSON.parse(readFileSync('public/assets/environment/reinforcement/floor5_room_shell_manual/floor5_room_shell_manual.tsj', 'utf8'));
  assert.equal(tileset.name, 'floor5_room_shell_manual');
  assert.deepEqual(tileset.grid, { height: 32, orientation: 'orthogonal', width: 32 });
  assert.deepEqual(tileset.tiles, []);
  assert.match(sceneSource, /const ASSET_IDS = \[\s*\/\/ Add each F5 PNG filename stem/);
});

test('Floor 5 manual tile data cannot mutate Collision or Navigation objects', () => {
  const ground = map.layers.find(layer => layer.name === 'Ground')!;
  const manualGroundData = Array(80 * 45).fill(0);
  manualGroundData[0] = 100;
  const changed = { ...map, layers: map.layers.map(layer => layer === ground ? { ...layer, data: manualGroundData } : layer) };
  const original = validateFloor5Map(map);
  const afterManualGroundEdit = validateFloor5Map(changed);
  assert.deepEqual(afterManualGroundEdit.collision, original.collision);
  assert.deepEqual(afterManualGroundEdit.nodes, original.nodes);
  assert.deepEqual(afterManualGroundEdit.edges, original.edges);
});
