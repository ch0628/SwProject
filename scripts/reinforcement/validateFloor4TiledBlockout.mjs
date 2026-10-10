import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const WIDTH = 80;
const HEIGHT = 45;
const TILE = 32;
const REQUIRED_LAYERS = [
  'Ground', 'FloorDetail', 'Walls', 'WallTop', 'StaticProps', 'Collision',
  'NavigationNodes', 'NavigationEdges', 'EncounterZones', 'FloorTransitions', 'SpawnPoints', 'Debug',
];
const REQUIRED_NODES = [
  'F4_LEFT_ARRIVAL', 'F4_LEFT_SECURITY_ZONE', 'F4_LEFT_PERIMETER_ZONE',
  'F4_RIGHT_ARRIVAL', 'F4_RIGHT_INNER_ZONE', 'F4_RIGHT_SERVICE_ZONE',
  'F4_CENTER_GUARD', 'F4_CENTER_STAIR',
];
const REQUIRED_EDGES = [
  'E_F4_LEFT_SECURITY_A', 'E_F4_LEFT_SECURITY_B', 'E_F4_LEFT_PERIMETER_A', 'E_F4_LEFT_PERIMETER_B',
  'E_F4_RIGHT_INNER_A', 'E_F4_RIGHT_INNER_B', 'E_F4_RIGHT_SERVICE_A', 'E_F4_RIGHT_SERVICE_B',
  'E_F4_GUARD_STAIR',
];
const ROUTES = {
  F4_SECURITY_HALL_ROUTE: ['F4_LEFT_ARRIVAL', 'F4_LEFT_SECURITY_ZONE', 'F4_CENTER_GUARD'],
  F4_PERIMETER_DETOUR_ROUTE: ['F4_LEFT_ARRIVAL', 'F4_LEFT_PERIMETER_ZONE', 'F4_CENTER_GUARD'],
  F4_INNER_SECURITY_ROUTE: ['F4_RIGHT_ARRIVAL', 'F4_RIGHT_INNER_ZONE', 'F4_CENTER_GUARD'],
  F4_SERVICE_ROUTE: ['F4_RIGHT_ARRIVAL', 'F4_RIGHT_SERVICE_ZONE', 'F4_CENTER_GUARD'],
};
const CLEAR_AREAS = {
  LEFT: { x: 96, y: 1056, width: 512, height: 128 },
  RIGHT: { x: 1952, y: 1056, width: 480, height: 128 },
  CENTER: { x: 1088, y: 64, width: 352, height: 272 },
};
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mapPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(root, 'public/maps/reinforcement/floor_4_blockout.tmj');
const manualTilesetPath = resolve(root, 'public/assets/environment/reinforcement/floor4_room_shell_manual/floor4_room_shell_manual.tsj');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const props = item => Object.fromEntries((item?.properties ?? []).map(({ name, value }) => [name, value]));

let map;
let manualTileset;
try { map = JSON.parse(readFileSync(mapPath, 'utf8')); }
catch (error) { console.error(`FAIL: cannot parse ${mapPath}: ${error.message}`); process.exit(1); }
try { manualTileset = JSON.parse(readFileSync(manualTilesetPath, 'utf8')); }
catch (error) { console.error(`FAIL: cannot parse ${manualTilesetPath}: ${error.message}`); process.exit(1); }

const layers = new Map((map.layers ?? []).map(layer => [layer.name, layer]));
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
const absolutePoints = edge => (edge.polyline ?? []).map(point => ({ x: edge.x + point.x, y: edge.y + point.y }));
const polylineLength = edge => absolutePoints(edge).slice(1).reduce((total, point, index) => {
  const previous = absolutePoints(edge)[index];
  return total + Math.hypot(point.x - previous.x, point.y - previous.y);
}, 0);
const contains = (rectangle, x, y, margin = 0) => x >= rectangle.x - margin && x < rectangle.x + rectangle.width + margin && y >= rectangle.y - margin && y < rectangle.y + rectangle.height + margin;
const overlaps = (left, right) => left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
const segmentHits = (rectangles, from, to, margin = 0) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4));
  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    if (rectangles.some(rectangle => contains(rectangle, from.x + (to.x - from.x) * ratio, from.y + (to.y - from.y) * ratio, margin))) return true;
  }
  return false;
};
const reachable = (start, target, edges) => {
  const adjacency = new Map();
  for (const edge of edges) {
    const { from, to, bidirectional } = props(edge);
    adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
    if (bidirectional) adjacency.set(to, [...(adjacency.get(to) ?? []), from]);
  }
  const queue = [start];
  const visited = new Set(queue);
  while (queue.length) {
    const node = queue.shift();
    if (node === target) return true;
    for (const next of adjacency.get(node) ?? []) if (!visited.has(next)) { visited.add(next); queue.push(next); }
  }
  return false;
};
const physicalReachable = (start, target, blocked, step = 8, margin = 12) => {
  const key = (x, y) => `${x},${y}`;
  const snap = value => Math.round(value / step) * step;
  const startPoint = { x: snap(start.x), y: snap(start.y) };
  const targetPoint = { x: snap(target.x), y: snap(target.y) };
  if (blocked.some(item => contains(item, startPoint.x, startPoint.y, margin)) || blocked.some(item => contains(item, targetPoint.x, targetPoint.y, margin))) return false;
  const queue = [startPoint];
  const visited = new Set([key(startPoint.x, startPoint.y)]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.x === targetPoint.x && current.y === targetPoint.y) return true;
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const next = { x: current.x + dx, y: current.y + dy };
      const id = key(next.x, next.y);
      if (next.x < margin || next.y < margin || next.x >= WIDTH * TILE - margin || next.y >= HEIGHT * TILE - margin || visited.has(id)) continue;
      if (blocked.some(item => contains(item, next.x, next.y, margin))) continue;
      visited.add(id);
      queue.push(next);
    }
  }
  return false;
};

check(map.orientation === 'orthogonal', 'orientation must be orthogonal');
check(map.width === WIDTH && map.height === HEIGHT, `map must be ${WIDTH}x${HEIGHT}`);
check(map.tilewidth === TILE && map.tileheight === TILE, `tiles must be ${TILE}x${TILE}`);
check(props(map).geometrySource === 'floor_4_structure_clean_v2.png', 'geometrySource must be floor_4_structure_clean_v2.png');
check(JSON.stringify((map.layers ?? []).map(({ name }) => name)) === JSON.stringify(REQUIRED_LAYERS), 'layer order must match the Floor 4 contract');
const tileData = Object.fromEntries(REQUIRED_LAYERS.slice(0, 5).map(name => [name, decode(name)]));
for (const name of REQUIRED_LAYERS.slice(0, 5)) check(tileData[name].length === WIDTH * HEIGHT, `${name} must contain ${WIDTH * HEIGHT} cells`);

check(manualTileset.name === 'floor4_room_shell_manual', 'manual tileset name must be floor4_room_shell_manual');
check(manualTileset.columns === 0, 'manual tileset must be a Collection of Images');
check(manualTileset.grid?.width === TILE && manualTileset.grid?.height === TILE, 'manual tileset logical grid must be 32x32');
check(Array.isArray(manualTileset.tiles), 'manual tileset tiles entry must be an array');
const manualClasses = new Set();
for (const tile of manualTileset.tiles ?? []) {
  const tileClass = tile.class ?? tile.type;
  check(Boolean(tileClass), `manual tile ${tile.id} has no Class`);
  check(!manualClasses.has(tileClass), `duplicate manual tile Class ${tileClass}`);
  manualClasses.add(tileClass);
  check(existsSync(resolve(dirname(manualTilesetPath), tile.image)), `manual tileset image is missing: ${tile.image}`);
  check(basename(tile.image, extname(tile.image)) === tileClass, `manual tile ${tile.id} filename stem must equal Class ${tileClass}`);
}
const manualReference = map.tilesets?.find(item => item.source?.includes('floor4_room_shell_manual'));
check(Boolean(manualReference), 'Floor 4 manual tileset reference is missing');
const usedGids = new Set(Object.values(tileData).flat().map(gid => gid & 0x1fffffff).filter(Boolean));
for (const gid of usedGids) {
  if (manualReference && gid >= manualReference.firstgid) check((manualTileset.tiles ?? []).some(tile => tile.id === gid - manualReference.firstgid), `TMJ gid ${gid} has no manual TSJ tile entry`);
}

const allObjects = (map.layers ?? []).flatMap(layer => layer.objects ?? []);
check(new Set(allObjects.map(({ id }) => id)).size === allObjects.length, 'duplicate Tiled object id');
const nodes = objects('NavigationNodes');
const nodeIds = nodes.map(item => props(item).nodeId);
check(nodes.length === REQUIRED_NODES.length && REQUIRED_NODES.every(name => nodeIds.includes(name)), 'required eight NavigationNodes are invalid');
check(new Set(nodeIds).size === nodeIds.length, 'duplicate Navigation nodeId');
const nodeById = new Map(nodes.map(node => [props(node).nodeId, node]));
const anchors = {
  F4_LEFT_ARRIVAL: [304, 1120], F4_LEFT_SECURITY_ZONE: [1040, 848], F4_LEFT_PERIMETER_ZONE: [640, 400],
  F4_RIGHT_ARRIVAL: [2256, 1120], F4_RIGHT_INNER_ZONE: [1520, 848], F4_RIGHT_SERVICE_ZONE: [1920, 400],
  F4_CENTER_GUARD: [1280, 560], F4_CENTER_STAIR: [1280, 304],
};
for (const [name, [x, y]] of Object.entries(anchors)) {
  const node = nodeById.get(name);
  check(node?.x === x && node?.y === y, `${name} must remain at ${x},${y}`);
}

const spawns = objects('SpawnPoints');
for (const [name, context] of [['F4_LEFT_ARRIVAL', 'F4_LEFT_APPROACH'], ['F4_RIGHT_ARRIVAL', 'F4_RIGHT_APPROACH']]) {
  const matches = spawns.filter(item => props(item).spawnId === name);
  check(matches.length === 1 && props(matches[0]).routeContextId === context, `${name} spawn/context is invalid`);
}
check(spawns.length === 2, `expected exactly two Floor 4 spawns, found ${spawns.length}`);

const edges = objects('NavigationEdges');
const edgeIds = edges.map(item => props(item).edgeId);
check(edges.length === REQUIRED_EDGES.length && REQUIRED_EDGES.every(name => edgeIds.includes(name)), 'required nine NavigationEdges are invalid');
check(new Set(edgeIds).size === edgeIds.length, 'duplicate Navigation edgeId');
for (const edge of edges) {
  const values = props(edge);
  const points = absolutePoints(edge);
  check(nodeById.has(values.from) && nodeById.has(values.to), `${edge.name} has an unknown endpoint`);
  check(points[0]?.x === nodeById.get(values.from)?.x && points[0]?.y === nodeById.get(values.from)?.y, `${edge.name} does not begin at ${values.from}`);
  check(points.at(-1)?.x === nodeById.get(values.to)?.x && points.at(-1)?.y === nodeById.get(values.to)?.y, `${edge.name} does not end at ${values.to}`);
  check(Math.abs(polylineLength(edge) / TILE - values.lengthTiles) < 0.001, `${edge.name} lengthTiles is stale`);
}
const optionRoutes = arrival => new Set(edges.filter(edge => props(edge).from === arrival).map(edge => props(edge).route));
check(JSON.stringify([...optionRoutes('F4_LEFT_ARRIVAL')].sort()) === JSON.stringify(['F4_PERIMETER_DETOUR_ROUTE', 'F4_SECURITY_HALL_ROUTE']), 'LEFT route options must be exactly SECURITY and PERIMETER');
check(JSON.stringify([...optionRoutes('F4_RIGHT_ARRIVAL')].sort()) === JSON.stringify(['F4_INNER_SECURITY_ROUTE', 'F4_SERVICE_ROUTE']), 'RIGHT route options must be exactly INNER and SERVICE');
for (const [route, sequence] of Object.entries(ROUTES)) {
  const routeEdges = edges.filter(edge => props(edge).route === route);
  check(routeEdges.length === 2, `${route} must contain exactly two edges`);
  check(reachable(sequence[0], sequence[2], routeEdges), `${route} is not reachable through ${sequence[1]}`);
  check(routeEdges.some(edge => [props(edge).from, props(edge).to].includes(sequence[1])), `${route} skips ${sequence[1]}`);
}
const leftNodes = new Set(['F4_LEFT_ARRIVAL', 'F4_LEFT_SECURITY_ZONE', 'F4_LEFT_PERIMETER_ZONE']);
const rightNodes = new Set(['F4_RIGHT_ARRIVAL', 'F4_RIGHT_INNER_ZONE', 'F4_RIGHT_SERVICE_ZONE']);
check(!edges.some(edge => (leftNodes.has(props(edge).from) && rightNodes.has(props(edge).to)) || (rightNodes.has(props(edge).from) && leftNodes.has(props(edge).to))), 'LEFT/RIGHT direct cross-edge exists before F4_CENTER_GUARD');
const withoutGuard = edges.filter(edge => ![props(edge).from, props(edge).to].includes('F4_CENTER_GUARD'));
for (const arrival of ['F4_LEFT_ARRIVAL', 'F4_RIGHT_ARRIVAL']) check(!reachable(arrival, 'F4_CENTER_STAIR', withoutGuard), `${arrival} can reach CENTER STAIR without CENTER GUARD`);
check(reachable('F4_CENTER_GUARD', 'F4_CENTER_STAIR', edges), 'CENTER GUARD cannot reach CENTER STAIR');

const collision = objects('Collision').filter(item => props(item).blocksRobot !== false);
for (const [name, area] of Object.entries(CLEAR_AREAS)) check(!collision.some(item => overlaps(item, area)), `${name} stair required-clear area overlaps Collision`);
const roomMasses = ['F4_LEFT_ROOM_MASS', 'F4_RIGHT_ROOM_MASS'].map(name => collision.find(item => item.name === name));
check(roomMasses.every(room => room && props(room).enterable === false), 'both restricted room masses must be non-enterable');
const lockedDoors = ['F4_LEFT_ROOM_DOOR_LOCKED', 'F4_RIGHT_ROOM_DOOR_LOCKED'].map(name => collision.find(item => item.name === name));
check(lockedDoors.every(door => door && props(door).doorFacing === 'SOUTH' && props(door).enterable === false && props(door).locked === true), 'room doors must be locked, non-enterable, and SOUTH-facing');
for (const node of nodes) check(!roomMasses.some(room => room && contains(room, node.x, node.y)), `${node.name} is inside a restricted room`);
for (const edge of edges) {
  const points = absolutePoints(edge);
  for (let index = 1; index < points.length; index += 1) {
    check(!segmentHits(collision, points[index - 1], points[index], 12), `${edge.name} lacks clearance for the 24px debug robot`);
    check(!segmentHits(roomMasses.filter(Boolean), points[index - 1], points[index]), `${edge.name} enters a restricted room`);
  }
}
check(segmentHits(lockedDoors.filter(Boolean), { x: 640, y: 1040 }, { x: 640, y: 900 }), 'LEFT frontage does not reject room entry');
check(segmentHits(lockedDoors.filter(Boolean), { x: 1920, y: 1040 }, { x: 1920, y: 900 }), 'RIGHT frontage does not reject room entry');

const encounters = objects('EncounterZones');
const findEncounter = name => encounters.find(item => item.name === name);
const leftAmbiguous = findEncounter('F4_LEFT_SECURITY_AMBIGUOUS_ZONE');
const rightAmbiguous = findEncounter('F4_RIGHT_INNER_AMBIGUOUS_ZONE');
const serviceObstacle = findEncounter('F4_RIGHT_SERVICE_OBSTACLE_ZONE');
const guardZone = findEncounter('F4_CENTER_GUARD_ZONE');
check(props(leftAmbiguous).encounterType === 'AMBIGUOUS_PERSON' && props(leftAmbiguous).route === 'F4_SECURITY_HALL_ROUTE', 'LEFT SECURITY ambiguous candidate is invalid');
check(!encounters.some(item => props(item).route === 'F4_PERIMETER_DETOUR_ROUTE' && props(item).mandatory === true), 'LEFT PERIMETER contains a mandatory encounter');
check(props(rightAmbiguous).encounterType === 'AMBIGUOUS_PERSON' && props(rightAmbiguous).route === 'F4_INNER_SECURITY_ROUTE', 'RIGHT INNER ambiguous candidate is invalid');
check(props(serviceObstacle).encounterType === 'OBSTACLE' && props(serviceObstacle).route === 'F4_SERVICE_ROUTE' && props(serviceObstacle).facilityDamagePossible === true, 'RIGHT SERVICE obstacle candidate is invalid');
check(props(guardZone).encounterType === 'VILLAIN_ENCOUNTER' && props(guardZone).villainCount === 2 && props(guardZone).bypassAvailable === false, 'CENTER GUARD contract is invalid');
check(props(guardZone).actions === 'SUBDUE,DISTRACT,RETREAT', 'CENTER GUARD actions are invalid');
for (const encounter of encounters) check(!collision.some(item => overlaps(item, encounter)), `${encounter.name} overlaps permanent Collision`);

const transitions = objects('FloorTransitions');
check(transitions.length === 1 && transitions[0].name === 'F4_CENTER_STAIR_TRANSITION', 'F4_CENTER_STAIR_TRANSITION must exist exactly once');
check(props(transitions[0]).targetFloor === 5 && props(transitions[0]).targetSpawn === 'F5_SEARCH_HUB', 'CENTER STAIR transition target is invalid');
check(transitions[0] && !collision.some(item => overlaps(item, transitions[0])), 'CENTER STAIR transition overlaps Collision');
const stairFootprints = objects('Debug').filter(item => item.type === 'StairFootprint');
check(stairFootprints.length === 3, `expected exactly three stair architectures, found ${stairFootprints.length}`);

const routeLength = route => edges.filter(edge => props(edge).route === route).reduce((total, edge) => total + polylineLength(edge), 0);
const lengths = Object.fromEntries(Object.keys(ROUTES).map(route => [route, routeLength(route)]));
const leftRatio = lengths.F4_PERIMETER_DETOUR_ROUTE / lengths.F4_SECURITY_HALL_ROUTE;
const rightRatio = lengths.F4_SERVICE_ROUTE / lengths.F4_INNER_SECURITY_ROUTE;
check(lengths.F4_SECURITY_HALL_ROUTE < lengths.F4_PERIMETER_DETOUR_ROUTE, 'LEFT SECURITY path must be shorter than PERIMETER');
check(lengths.F4_INNER_SECURITY_ROUTE < lengths.F4_SERVICE_ROUTE, 'RIGHT INNER path must be shorter than SERVICE');
check(leftRatio >= 1.2, `LEFT long/short ratio must be >= 1.20, got ${leftRatio.toFixed(3)}`);
check(rightRatio >= 1.2, `RIGHT long/short ratio must be >= 1.20, got ${rightRatio.toFixed(3)}`);

for (const [route, sequence] of Object.entries(ROUTES)) {
  check(physicalReachable(nodeById.get(sequence[0]), nodeById.get(sequence[2]), collision), `${route} has no physical walkable path`);
}
check(physicalReachable(nodeById.get('F4_CENTER_GUARD'), nodeById.get('F4_CENTER_STAIR'), collision), 'CENTER GUARD cannot physically reach CENTER STAIR');
for (const arrival of ['F4_LEFT_ARRIVAL', 'F4_RIGHT_ARRIVAL']) {
  check(!physicalReachable(nodeById.get(arrival), nodeById.get('F4_CENTER_STAIR'), [...collision, guardZone]), `${arrival} has a physical CENTER GUARD bypass`);
}

const serialized = JSON.stringify(map).toUpperCase();
check(!serialized.includes('ELEVATOR'), 'Floor 4 must not contain an elevator');
check(!serialized.includes('BOSS_ENCOUNTER') && !serialized.includes('BOSS_ROOM') && !serialized.includes('SEARCH_ROOM'), 'Floor 4 must not contain boss/search-room gameplay');

if (failures.length) {
  console.error(`FAIL floor_4_blockout (${new Set(failures).size})`);
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS floor_4_blockout');
  console.log(`map=${map.width}x${map.height} tile=${map.tilewidth}x${map.tileheight} objects=${allObjects.length}`);
  console.log(`nodes=${nodes.length} edges=${edges.length} collision=${collision.length} stairs=${stairFootprints.length}`);
  console.log(`security=${(lengths.F4_SECURITY_HALL_ROUTE / TILE).toFixed(3)} perimeter=${(lengths.F4_PERIMETER_DETOUR_ROUTE / TILE).toFixed(3)} tiles`);
  console.log(`inner=${(lengths.F4_INNER_SECURITY_ROUTE / TILE).toFixed(3)} service=${(lengths.F4_SERVICE_ROUTE / TILE).toFixed(3)} tiles`);
  console.log(`ratios=LEFT:${leftRatio.toFixed(3)} RIGHT:${rightRatio.toFixed(3)} encounters=${encounters.length} transition=F5_SEARCH_HUB`);
  console.log(`reachability=PASS guardBypass=BLOCKED rooms=BLOCKED stairClearance=PASS manualTiles=${(manualTileset.tiles ?? []).length}`);
}
