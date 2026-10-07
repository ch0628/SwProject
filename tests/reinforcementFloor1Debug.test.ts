import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CAMERA_ZONE_IDS, cameraCenterForTarget, decompressTileLayers, embedTileset, properties, resolveCameraZone, validateFloor1Map, type TiledMapJson } from '../src/modules/reinforcement/debug/floor1Tiled.ts';

const map = JSON.parse(readFileSync('public/maps/reinforcement/floor_1_blockout.tmj', 'utf8')) as TiledMapJson;
const tileset = JSON.parse(readFileSync('public/maps/reinforcement/floor1_visual_tileset.tsj', 'utf8')) as Record<string, unknown>;
const artpassMap = JSON.parse(readFileSync('public/maps/reinforcement/floor_1_artpass_v1.tmj', 'utf8')) as TiledMapJson;
const artpassTileset = JSON.parse(readFileSync('public/maps/reinforcement/floor1_art_tileset_v1.tsj', 'utf8')) as Record<string, unknown>;
const moduleTileset = JSON.parse(readFileSync('public/maps/reinforcement/floor1_visual_modules.tsj', 'utf8')) as {
  tiles: { class: string; imagewidth: number; imageheight: number }[];
};

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
  assert.equal(map.tilesets[0].source, 'floor1_visual_tileset.tsj');
  assert.equal(embedded.tilesets[0].source, undefined);
  assert.equal(embedded.tilesets[0].name, 'floor1_visual_tileset');
  assert.equal(embedded.tilesets[0].firstgid, 1);
  assert.equal(embedded.tilesets[0].tilecount, 48);
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

test('deterministic visual tileset and gameplay object layers keep their contracts', () => {
  const visualTiles = tileset.tiles as { id: number; class: string }[];
  assert.equal(tileset.name, 'floor1_visual_tileset');
  assert.equal(visualTiles.length, 48);
  assert.equal(new Set(visualTiles.map(tile => tile.class)).size, 48);
  assert.deepEqual(
    map.layers.filter(layer => layer.type === 'objectgroup').map(layer => [layer.name, layer.objects?.length]),
    [['Collision', 153], ['NavigationNodes', 10], ['NavigationEdges', 10], ['EncounterZones', 4], ['FloorTransitions', 2], ['SpawnPoints', 1], ['Debug', 4], ['CameraZones', 8], ['ArchitecturalMass', 8]],
  );
});

test('Floor 1 module kit indexes every required asset at exact pixel dimensions', () => {
  const expected = new Map([
    ['F1_FLOOR_PUBLIC', [32, 32]], ['F1_FLOOR_SERVICE', [32, 32]],
    ['F1_WALL_H', [32, 72]], ['F1_WALL_V', [32, 72]],
    ['F1_WALL_CORNER_INNER', [32, 72]], ['F1_WALL_CORNER_OUTER', [32, 72]],
    ['F1_WALL_END_H', [32, 72]], ['F1_WALL_END_V', [32, 72]],
    ['F1_DOORWAY_OPEN', [64, 72]], ['F1_DOOR_STAFF_CLOSED', [64, 72]],
    ['F1_STAIR_STRAIGHT', [256, 224]], ['F1_RECEPTION_DESK', [256, 64]],
  ]);
  assert.equal(moduleTileset.tiles.length, expected.size);
  for (const tile of moduleTileset.tiles) assert.deepEqual([tile.imagewidth, tile.imageheight], expected.get(tile.class));
});

test('Floor 1 art pass changes only visual tile data and its external tileset', () => {
  validateFloor1Map(artpassMap);
  assert.equal(artpassMap.tilesets[0].source, 'floor1_art_tileset_v1.tsj');
  assert.deepEqual(
    artpassMap.layers.filter(layer => layer.type === 'objectgroup'),
    map.layers.filter(layer => layer.type === 'objectgroup'),
  );
  assert.equal(artpassTileset.name, 'floor1_art_tileset_v1');
  assert.equal(artpassTileset.image, '../../assets/environment/reinforcement/floor1/floor1_art_modules_v1.png');
  const artProperties = Object.fromEntries((artpassTileset.properties as { name: string; value: unknown }[]).map(({ name, value }) => [name, value]));
  assert.equal(artProperties.artPassVersion, 'v1');
  assert.equal(artProperties.authoritativeSourceSha256, 'dd89cc398d661d5280ab6c3ce92db118b92a30aa5fb85ae1e405050194b0cc20');
  const atlas = readFileSync('public/assets/environment/reinforcement/floor1/floor1_art_modules_v1.png');
  assert.deepEqual([atlas.readUInt32BE(16), atlas.readUInt32BE(20)], [256, 192]);
});

test('camera zones constrain all eight architectural regions at 1.3 zoom', () => {
  const result = validateFloor1Map(map);
  const viewport = { width: 960, height: 540 };
  const halfVisible = { width: viewport.width / 1.3 / 2, height: viewport.height / 1.3 / 2 };
  const cases = [
    ['F1_CAM_LOBBY', 1264, 1296],
    ['F1_CAM_LEFT_HORIZONTAL', 368, 976],
    ['F1_CAM_LEFT_VERTICAL', 368, 600],
    ['F1_CAM_LEFT_STAIR', 368, 176],
    ['F1_CAM_RIGHT_LOWER', 2160, 1072],
    ['F1_CAM_RIGHT_MIDDLE', 2160, 700],
    ['F1_CAM_RIGHT_UPPER', 1936, 500],
    ['F1_CAM_RIGHT_STAIR', 2160, 176],
  ] as const;
  const epsilon = 1e-9;

  assert.deepEqual(result.cameraZones.map(zone => properties(zone).cameraZoneId), CAMERA_ZONE_IDS);
  for (const [cameraZoneId, robotX, robotY] of cases) {
    const zone = resolveCameraZone(result.cameraZones, null, robotX, robotY);
    assert.equal(properties(zone!).cameraZoneId, cameraZoneId);
    assert.ok(zone!.width >= halfVisible.width * 2, `${cameraZoneId}: narrower than viewport`);
    assert.ok(zone!.height >= halfVisible.height * 2, `${cameraZoneId}: shorter than viewport`);
    const center = cameraCenterForTarget(robotX, robotY, viewport.width, viewport.height, 1.3, zone!);
    assert.ok(center.x - halfVisible.width >= zone!.x - epsilon, `${cameraZoneId}: left edge escaped`);
    assert.ok(center.x + halfVisible.width <= zone!.x + zone!.width + epsilon, `${cameraZoneId}: right edge escaped`);
    assert.ok(center.y - halfVisible.height >= zone!.y - epsilon, `${cameraZoneId}: top edge escaped`);
    assert.ok(center.y + halfVisible.height <= zone!.y + zone!.height + epsilon, `${cameraZoneId}: bottom edge escaped`);
    const mass = result.architecturalMass.find(object => properties(object).cameraZoneId === cameraZoneId)!;
    assert.deepEqual([mass.x, mass.y, mass.width, mass.height], [zone!.x, zone!.y, zone!.width, zone!.height]);
  }

  const overlap = { x: 784, y: 1008 };
  const lobby = result.cameraZones.find(zone => zone.name === 'F1_CAM_LOBBY')!;
  const leftHorizontal = result.cameraZones.find(zone => zone.name === 'F1_CAM_LEFT_HORIZONTAL')!;
  assert.equal(resolveCameraZone(result.cameraZones, lobby, overlap.x, overlap.y), lobby);
  assert.equal(resolveCameraZone(result.cameraZones, leftHorizontal, overlap.x, overlap.y), leftHorizontal);

  const robot = { x: 368, y: 900 };
  const leftVertical = result.cameraZones.find(zone => zone.name === 'F1_CAM_LEFT_VERTICAL')!;
  const clampedCamera = cameraCenterForTarget(robot.x, robot.y, viewport.width, viewport.height, 1.3, leftVertical);
  assert.deepEqual(robot, { x: 368, y: 900 });
  assert.notEqual(clampedCamera.y, robot.y);
});
