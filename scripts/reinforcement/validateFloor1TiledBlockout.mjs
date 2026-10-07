import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const WIDTH = 80;
const HEIGHT = 45;
const TILE = 32;
const REQUIRED_LAYERS = [
  'Ground', 'FloorDetail', 'Walls', 'WallTop', 'StaticProps', 'Collision',
  'NavigationNodes', 'NavigationEdges', 'EncounterZones', 'FloorTransitions', 'SpawnPoints', 'Debug', 'ArchitecturalMass',
];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mapPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(root, 'public/maps/reinforcement/floor_1_blockout.tmj');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const props = item => Object.fromEntries((item?.properties ?? []).map(({ name, value }) => [name, value]));

let map;
try { map = JSON.parse(readFileSync(mapPath, 'utf8')); }
catch (error) { console.error(`FAIL: cannot parse ${mapPath}: ${error.message}`); process.exit(1); }

const layers = new Map(map.layers.map(layer => [layer.name, layer]));
const objects = name => layers.get(name)?.objects ?? [];
const decode = name => {
  const layer = layers.get(name);
  if (Array.isArray(layer?.data)) return layer.data;
  try {
    const bytes = inflateSync(Buffer.from(layer?.data ?? '', 'base64'));
    return Array.from({ length: bytes.length / 4 }, (_, index) => bytes.readUInt32LE(index * 4));
  } catch (error) {
    failures.push(`${name} cannot be decoded: ${error.message}`);
    return [];
  }
};

check(map.orientation === 'orthogonal', 'orientation must be orthogonal');
check(map.width === WIDTH && map.height === HEIGHT, `map must be ${WIDTH}x${HEIGHT}`);
check(map.tilewidth === TILE && map.tileheight === TILE, `tiles must be ${TILE}x${TILE}`);
check(JSON.stringify(map.layers.map(({ name }) => name)) === JSON.stringify(REQUIRED_LAYERS), 'layer order must match the current Floor 1 contract');
for (const name of REQUIRED_LAYERS.slice(0, 5)) check(decode(name).length === WIDTH * HEIGHT, `${name} tile data must contain ${WIDTH * HEIGHT} cells`);

const tilesetRef = map.tilesets?.[0];
const tilesetPath = resolve(dirname(mapPath), tilesetRef?.source ?? '');
check(map.tilesets?.length === 1 && tilesetRef?.firstgid === 1, 'map must reference exactly one external tileset at firstgid 1');
check(tilesetRef?.source === '../../assets/environment/reinforcement/floor1_room_shell_manual/floor1_room_shell_manual.tsj', 'map must use the manual room-shell tileset');
let tileset = {};
try { tileset = JSON.parse(readFileSync(tilesetPath, 'utf8')); }
catch (error) { failures.push(`tileset JSON parse failed: ${error.message}`); }
check(tileset.name === 'floor1_room_shell_manual' && tileset.tilecount === 15, 'manual tileset name/count is invalid');
const expectedSizes = new Map([
  ['F1_FLOOR_PUBLIC', [32, 32]], ['F1_FLOOR_SERVICE', [32, 32]],
  ['F1_BACK_WALL_PLAIN', [32, 64]], ['F1_BACK_WALL_VARIANT_A', [32, 64]], ['F1_BACK_WALL_VARIANT_B', [32, 64]],
  ['F1_SIDE_WALL_LEFT', [32, 32]], ['F1_SIDE_WALL_RIGHT', [32, 32]], ['F1_SIDE_END_TOP', [32, 32]], ['F1_SIDE_END_BOTTOM', [32, 32]],
  ['F1_BACK_CORNER_LEFT', [32, 64]], ['F1_BACK_CORNER_RIGHT', [32, 64]], ['F1_DOOR_H_CLOSED', [64, 64]], ['F1_DOOR_H_OPEN', [64, 64]],
  ['F1_WALL_CORNER_L', [32, 32]], ['F1_STAIR_SEAMLESS', [32, 32]],
]);
for (const tile of tileset.tiles ?? []) {
  const assetId = tile.class ?? tile.type;
  check(JSON.stringify([tile.imagewidth, tile.imageheight]) === JSON.stringify(expectedSizes.get(assetId)), `${assetId} dimensions are invalid`);
  const imagePath = resolve(dirname(tilesetPath), tile.image);
  check(existsSync(imagePath), `${tile.image} is missing`);
  if (existsSync(imagePath)) {
    const png = readFileSync(imagePath);
    check(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${tile.image} is not PNG`);
    check(png[25] === 6, `${tile.image} must be RGBA`);
  }
}
check((tileset.tiles ?? []).length === expectedSizes.size, 'manual tileset must contain exactly 15 tiles');

const allObjects = map.layers.flatMap(layer => layer.objects ?? []);
check(new Set(allObjects.map(({ id }) => id)).size === allObjects.length, 'duplicate Tiled object id');
check(!layers.has('CameraZones'), 'obsolete CameraZones layer must be removed');
check(objects('ArchitecturalMass').length === 8, 'ArchitecturalMass must contain 8 regions');

const spawns = objects('SpawnPoints');
check(spawns.length === 1 && props(spawns[0]).spawnId === 'F1_ROBOT_SPAWN', 'F1_ROBOT_SPAWN is invalid');
const transitions = objects('FloorTransitions');
check(transitions.length === 2, `expected two FloorTransitions, found ${transitions.length}`);
check(transitions.every(item => props(item).targetFloor === 2), 'both transitions must target Floor 2');

const collision = objects('Collision');
for (const name of ['WALL_45_1', 'WALL_45_2']) check(collision.some(item => item.name === name), `${name} is missing`);
const nodes = objects('NavigationNodes');
const nodeIds = new Set(nodes.map(item => props(item).nodeId));
const edges = objects('NavigationEdges');
check(nodes.length === 10 && edges.length === 10, 'navigation node/edge count changed');
for (const edge of edges) {
  const values = props(edge);
  check(nodeIds.has(values.from) && nodeIds.has(values.to), `${values.edgeId ?? edge.name} has an unknown endpoint`);
}
const split = nodes.find(item => item.name === 'F1_ENTRY_SPLIT');
check(split?.x === 1274 && split?.y === 1042, 'F1_ENTRY_SPLIT coordinate changed');
check(objects('EncounterZones').length === 4, 'EncounterZones count changed');

if (failures.length) {
  console.error(`FAIL floor_1_blockout (${failures.length})`);
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS floor_1_blockout');
  console.log(`map=${map.width}x${map.height} tileset=${tileset.name} assets=${tileset.tilecount}`);
  console.log(`objects=${allObjects.length} nodes=${nodes.length} edges=${edges.length} camera=character-centered`);
}
