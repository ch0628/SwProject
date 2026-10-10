import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { properties, type TiledMapJson } from '../src/modules/reinforcement/debug/floor1Tiled.ts';
import { FLOOR4_CLEAR_AREAS, floor4RoutePoints, floor4TileDepth, missingFloor4PngMessage, missingFloor4TextureMessage, spawnSideFromSearch, validateFloor4Map } from '../src/modules/reinforcement/debug/floor4Tiled.ts';

const map = JSON.parse(readFileSync('public/maps/reinforcement/floor_4_blockout.tmj', 'utf8')) as TiledMapJson;
const sceneSource = readFileSync('src/modules/reinforcement/debug/ReinforcementFloor4DebugScene.ts', 'utf8');

test('Floor 4 debug runtime contract matches the Tiled map', () => {
  const result = validateFloor4Map(map);
  assert.deepEqual([result.spawns.LEFT.x, result.spawns.LEFT.y], [304, 1120]);
  assert.deepEqual([result.spawns.RIGHT.x, result.spawns.RIGHT.y], [2256, 1120]);
  assert.equal(properties(result.transitions[0]).targetSpawn, 'F5_SEARCH_HUB');
  assert.deepEqual(properties(result.encounters.find(object => object.name === 'F4_CENTER_GUARD_ZONE')!), {
    actions: 'SUBDUE,DISTRACT,RETREAT', bypassAvailable: false, encounterType: 'VILLAIN_ENCOUNTER', floor: 4,
    mandatory: true, route: 'F4_CENTER_STAIR_PASS', villainCount: 2, zoneId: 'F4_CENTER_GUARD_ZONE',
  });
});

test('Floor 4 route probes preserve four separate routes to the center guard', () => {
  const { edges } = validateFloor4Map(map);
  for (const route of ['F4_SECURITY_HALL_ROUTE', 'F4_PERIMETER_DETOUR_ROUTE', 'F4_INNER_SECURITY_ROUTE', 'F4_SERVICE_ROUTE'] as const) {
    assert.deepEqual(floor4RoutePoints(edges, route).at(-1), { x: 1280, y: 560 });
  }
});

test('Floor 4 debug spawn query defaults left and accepts right case-insensitively', () => {
  assert.equal(spawnSideFromSearch('?mode=reinforcement-floor4-debug'), 'LEFT');
  assert.equal(spawnSideFromSearch('?mode=reinforcement-floor4-debug&spawn=right'), 'RIGHT');
});

test('Floor 4 validation rejects one-pixel overlap in every stair clear area', () => {
  for (const [side, area] of Object.entries(FLOOR4_CLEAR_AREAS)) {
    const layers = map.layers.map(layer => layer.name === 'Collision' ? {
      ...layer,
      objects: [...(layer.objects ?? []), { id: 999, name: 'BAD_STAIR_COLLISION', x: area.x, y: area.y, width: 1, height: 1 }],
    } : layer);
    assert.throws(() => validateFloor4Map({ ...map, layers }), new RegExp(`${side.toLowerCase()} stair area must be collision-free`));
  }
});

test('Floor 4 manual Ground tiles render above blockout placeholders', () => {
  assert.ok(floor4TileDepth('Ground', true) > floor4TileDepth('StaticProps', false));
  assert.ok(floor4TileDepth('Ground', true) > 5);
});

test('Floor 4 manual renderer retains transforms, bottom anchor, and explicit diagnostics', () => {
  assert.match(sceneSource, /Phaser\.Tilemaps\.Parsers\.Tiled\.ParseGID\(rawGid\)/);
  assert.match(sceneSource, /setRotation\(gid\.rotation\)\.setFlipX\(gid\.flipped\)/);
  assert.match(sceneSource, /cellY \+ map\.tileheight - tile\.imageheight \/ 2/);
  assert.match(missingFloor4TextureMessage('F4_FLOOR_SECURITY'), /"F4_FLOOR_SECURITY".*ASSET_IDS/);
  assert.match(missingFloor4PngMessage('F4_FLOOR_SECURITY'), /ASSET_IDS.*floor4_room_shell_manual\/F4_FLOOR_SECURITY\.png/);
});

test('Floor 4 has no persistent route-semantic rectangle overlay', () => {
  assert.equal([...sceneSource.matchAll(/this\.add\.rectangle/g)].length, 2);
  assert.match(sceneSource, /navigationOverlay = .*\.setVisible\(false\)/);
  assert.match(sceneSource, /encounterOverlay = [\s\S]*?\.setVisible\(false\)/);
  assert.match(sceneSource, /collisionOverlay = .*\.setVisible\(false\)/);
});

test('Floor 4 manual tileset starts empty with the filename/Class contract', () => {
  const tileset = JSON.parse(readFileSync('public/assets/environment/reinforcement/floor4_room_shell_manual/floor4_room_shell_manual.tsj', 'utf8'));
  assert.equal(tileset.name, 'floor4_room_shell_manual');
  assert.deepEqual(tileset.grid, { height: 32, orientation: 'orthogonal', width: 32 });
  assert.deepEqual(tileset.tiles, []);
  assert.match(sceneSource, /const ASSET_IDS = \[\s*\/\/ Add each F4 PNG filename stem/);
});
