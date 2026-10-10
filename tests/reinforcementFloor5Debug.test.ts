import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import test from 'node:test';
import { properties, type TiledMapJson } from '../src/modules/reinforcement/debug/floor1Tiled.ts';
import { FLOOR5_DOORWAYS, FLOOR5_ROOMS, floor5ProbePoints, floor5RoomPathLengths, floor5TileDepth, missingFloor5PngMessage, missingFloor5TextureMessage, validateFloor5Map } from '../src/modules/reinforcement/debug/floor5Tiled.ts';

const map = JSON.parse(readFileSync('public/maps/reinforcement/floor_5_blockout.tmj', 'utf8')) as TiledMapJson;
const sceneSource = readFileSync('src/modules/reinforcement/debug/ReinforcementFloor5DebugScene.ts', 'utf8');

test('Floor 5 debug runtime contract matches the v3 Tiled map', () => {
  const result = validateFloor5Map(map);
  assert.deepEqual([result.spawn.x, result.spawn.y], [1280, 1200]);
  assert.equal(result.nodes.length, 15);
  assert.equal(result.edges.length, 21);
  assert.equal(result.encounters.length, 4);
  assert.equal(result.rooms.length, 4);
  assert.equal(result.ratio, 1);
  assert.equal(result.spread, 0);
  assert.deepEqual(properties(result.securityLock), { blocksRobot: true, dynamicLock: true, requiresState: 'BOSS_NEUTRALIZED' });
});

test('Floor 5 four search probes reach rooms with equalized actual polyline lengths', () => {
  const { edges } = validateFloor5Map(map);
  const lengths = floor5RoomPathLengths(edges);
  assert.deepEqual(lengths, { L1: 48.5, L2: 48.5, R1: 48.5, R2: 48.5 });
  for (const room of FLOOR5_ROOMS) assert.deepEqual(floor5ProbePoints(edges, room, 'SEARCH').at(-1), {
    L1: { x: 288, y: 640 }, L2: { x: 704, y: 224 }, R1: { x: 2272, y: 640 }, R2: { x: 1856, y: 224 },
  }[room]);
  const nodes = new Map(validateFloor5Map(map).nodes.map(node => [properties(node).nodeId, node]));
  assert.deepEqual([nodes.get('F5_LEFT_WING')?.y, nodes.get('F5_RIGHT_WING')?.y], [992, 992]);
  for (const edgeId of ['E_F5_LEFT_L1_GUARD', 'E_F5_RIGHT_R1_GUARD']) {
    const edge = edges.find(candidate => properties(candidate).edgeId === edgeId)!;
    assert.deepEqual((edge.polyline ?? []).slice(0, 2).map(point => edge.y + point.y), [992, 992]);
  }
});

test('Floor 5 door openings, wall collision, and route centerlines match the exact two-tile contract', () => {
  const result = validateFloor5Map(map);
  for (const room of FLOOR5_ROOMS) {
    const contract = FLOOR5_DOORWAYS[room];
    assert.deepEqual(
      { x: result.doors[room].x, y: result.doors[room].y, width: result.doors[room].width, height: result.doors[room].height },
      { x: contract.x, y: contract.y, width: 64, height: 32 },
    );
    for (const [side, bounds] of [['WEST', contract.west], ['EAST', contract.east]] as const) {
      const wall = result.collision.find(object => object.name === `F5_${room}_DOOR_WALL_${side}`)!;
      assert.deepEqual({ x: wall.x, y: wall.y, width: wall.width, height: wall.height }, bounds);
    }
    const roomEdge = result.edges.find(edge => properties(edge).edgeId === `E_F5_${room}_ROOM`)!;
    assert.ok((roomEdge.polyline ?? []).every(point => roomEdge.x + point.x === contract.centerX));
  }
});

test('Floor 5 runtime validator rejects a dynamic door with a missing room binding', () => {
  const broken = structuredClone(map);
  const collision = broken.layers.find(layer => layer.name === 'Collision')!;
  const l1 = collision.objects!.find(object => object.name === 'F5_L1_DOOR_BARRIER')!;
  l1.properties = l1.properties!.filter(property => property.name !== 'roomId');
  assert.throws(() => validateFloor5Map(broken), /Floor 5 debug: L1 dynamic door contract is invalid/);
});

test('Floor 5 state probes preserve NO_BOSS return and post-Boss Goal flow', () => {
  const { edges } = validateFloor5Map(map);
  for (const room of FLOOR5_ROOMS) {
    assert.deepEqual(floor5ProbePoints(edges, room, 'NO_BOSS').at(-1), { x: 1280, y: 1200 });
    assert.deepEqual(floor5ProbePoints(edges, room, 'POST_BOSS').at(-1), { x: 1280, y: 224 });
  }
  assert.match(sceneSource, /this\.securityLockCollider\.body!\.enable = !value/);
  assert.match(sceneSource, /this\.setBossNeutralized\(true\)/);
  assert.match(sceneSource, /this\.doorColliders\[room\]\.body!\.enable = !open/);
  assert.match(sceneSource, /this\.doorVisuals\[room\]\.setVisible\(!open\)/);
  assert.match(sceneSource, /this\.probeName === `SEARCH:\$\{this\.lastRoom\}`[\s\S]*?this\.setDoorOpen\(this\.lastRoom, true\)/);
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

test('Floor 5 manual tileset preserves the filename/Class/ASSET_IDS contract', () => {
  const tileset = JSON.parse(readFileSync('public/assets/environment/reinforcement/floor5_room_shell_manual/floor5_room_shell_manual.tsj', 'utf8'));
  assert.equal(tileset.name, 'floor5_room_shell_manual');
  assert.deepEqual(tileset.grid, { height: 32, orientation: 'orthogonal', width: 32 });
  const assetBlock = sceneSource.match(/const ASSET_IDS = \[([\s\S]*?)\] as const;/)?.[1] ?? '';
  const assetIds = new Set([...assetBlock.matchAll(/'([^']+)'/g)].map(match => match[1]));
  for (const tile of tileset.tiles) {
    const tileClass = tile.class ?? tile.type;
    assert.equal(basename(tile.image, extname(tile.image)), tileClass);
    assert.ok(assetIds.has(tileClass), `${tileClass} is missing from ASSET_IDS`);
    assert.ok(existsSync(join('public/assets/environment/reinforcement/floor5_room_shell_manual', tile.image)), `${tile.image} is missing`);
  }
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
