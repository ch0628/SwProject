import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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
  'F2_LEFT_ARRIVAL', 'F2_LEFT_DIRECT_ZONE', 'F2_LEFT_OUTER_ZONE',
  'F2_RIGHT_ARRIVAL', 'F2_RIGHT_INNER_ZONE', 'F2_RIGHT_SERVICE_ZONE',
  'F2_CENTER_GUARD', 'F2_CENTER_STAIR',
];
const REQUIRED_EDGES = [
  'E_F2_LEFT_DIRECT_A', 'E_F2_LEFT_DIRECT_B', 'E_F2_LEFT_OUTER_A', 'E_F2_LEFT_OUTER_B',
  'E_F2_RIGHT_INNER_A', 'E_F2_RIGHT_INNER_B', 'E_F2_RIGHT_SERVICE_A', 'E_F2_RIGHT_SERVICE_B',
  'E_F2_GUARD_STAIR',
];
const ROUTES = {
  F2_DIRECT_OFFICE_ROUTE: ['F2_LEFT_ARRIVAL', 'F2_LEFT_DIRECT_ZONE', 'F2_CENTER_GUARD'],
  F2_OUTER_CORRIDOR_ROUTE: ['F2_LEFT_ARRIVAL', 'F2_LEFT_OUTER_ZONE', 'F2_CENTER_GUARD'],
  F2_INNER_HALL_ROUTE: ['F2_RIGHT_ARRIVAL', 'F2_RIGHT_INNER_ZONE', 'F2_CENTER_GUARD'],
  F2_SERVICE_DETOUR_ROUTE: ['F2_RIGHT_ARRIVAL', 'F2_RIGHT_SERVICE_ZONE', 'F2_CENTER_GUARD'],
};
const SOURCE_RECTS = {
  blueLeft: [112, 1055, 504, 1200], blueRight: [2056, 1055, 2448, 1200], blueCenter: [1104, 264, 1456, 336],
  redLeftH: [504, 1055, 1105, 1200], redLeftV: [960, 672, 1105, 1055],
  redRightH: [1455, 1055, 2056, 1200], redRightV: [1455, 672, 1600, 1055],
  orangeLeftH: [176, 336, 960, 481], orangeLeftV: [176, 481, 321, 1055],
  orangeRightH: [1600, 336, 2384, 481], orangeRightV: [2239, 481, 2384, 1055],
  greenLeft: [610, 1000, 671, 1055], greenRight: [1889, 1000, 1950, 1055], white: [960, 336, 1600, 672],
};
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mapPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(root, 'public/maps/reinforcement/floor_2_blockout.tmj');
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
const absolutePoints = edge => (edge.polyline ?? []).map(point => ({ x: edge.x + point.x, y: edge.y + point.y }));
const polylineLength = edge => absolutePoints(edge).slice(1).reduce((total, point, index) => {
  const previous = absolutePoints(edge)[index];
  return total + Math.hypot(point.x - previous.x, point.y - previous.y);
}, 0);
const contains = (rectangle, x, y, margin = 0) => x >= rectangle.x - margin && x < rectangle.x + rectangle.width + margin && y >= rectangle.y - margin && y < rectangle.y + rectangle.height + margin;
const overlaps = (left, right) => left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
const insideSource = ([x1, y1, x2, y2], x, y) => x >= x1 && x < x2 && y >= y1 && y < y2;
const sourceRoleAt = (x, y) => {
  if (['orangeLeftH', 'orangeLeftV', 'orangeRightH', 'orangeRightV'].some(name => insideSource(SOURCE_RECTS[name], x, y))) return 'orange';
  if (['redLeftH', 'redLeftV', 'redRightH', 'redRightV'].some(name => insideSource(SOURCE_RECTS[name], x, y))) return 'red';
  if (['greenLeft', 'greenRight'].some(name => insideSource(SOURCE_RECTS[name], x, y))) return 'green';
  if (['blueLeft', 'blueRight', 'blueCenter'].some(name => insideSource(SOURCE_RECTS[name], x, y))) return 'blue';
  if (insideSource(SOURCE_RECTS.white, x, y)) return 'white';
  return 'blocked';
};
const segmentHits = (rectangles, from, to, margin = 0) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4));
  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    const x = from.x + (to.x - from.x) * ratio;
    const y = from.y + (to.y - from.y) * ratio;
    if (rectangles.some(rectangle => contains(rectangle, x, y, margin))) return true;
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

check(map.orientation === 'orthogonal', 'orientation must be orthogonal');
check(new Set((map.properties ?? []).map(item => item.name)).size === (map.properties ?? []).length, 'duplicate map property name');
check(props(map).geometrySource === 'floor_2_structure_clean_v2.png', 'geometrySource must be floor_2_structure_clean_v2.png');
check(map.width === WIDTH && map.height === HEIGHT, `map must be ${WIDTH}x${HEIGHT}`);
check(map.tilewidth === TILE && map.tileheight === TILE, `tiles must be ${TILE}x${TILE}`);
check(JSON.stringify(map.layers.map(({ name }) => name)) === JSON.stringify(REQUIRED_LAYERS), 'layer order must match the Floor 2 contract');
const tileData = Object.fromEntries(REQUIRED_LAYERS.slice(0, 5).map(name => [name, decode(name)]));
for (const name of REQUIRED_LAYERS.slice(0, 5)) check(tileData[name].length === WIDTH * HEIGHT, `${name} tile data must contain ${WIDTH * HEIGHT} cells`);
for (let cell = 0; cell < WIDTH * HEIGHT; cell += 1) {
  const x = (cell % WIDTH) * TILE + TILE / 2;
  const y = Math.floor(cell / WIDTH) * TILE + TILE / 2;
  const role = sourceRoleAt(x, y);
  if (insideSource([1088, 64, 1440, 256], x, y)) continue;
  check(role === 'blocked' ? tileData.Ground[cell] === 0 : tileData.Ground[cell] !== 0, `Ground walkability does not match source geometry at tile ${cell % WIDTH},${Math.floor(cell / WIDTH)}`);
  check(role === 'blocked' ? tileData.Walls[cell] !== 0 : tileData.Walls[cell] === 0, `Walls walkability does not match source geometry at tile ${cell % WIDTH},${Math.floor(cell / WIDTH)}`);
}
const expectedTilesets = [
  '../../assets/environment/reinforcement/floor1_room_shell_manual/floor1_room_shell_manual.tsj',
  '../../assets/environment/reinforcement/floor2_room_shell_manual/floor2_room_shell_manual.tsj',
];
check(map.tilesets?.[0]?.firstgid === 1 && map.tilesets[0]?.source === expectedTilesets[0], 'Floor 2 must retain the approved Floor 1 blockout tileset at firstgid 1');
check((map.tilesets?.length ?? 0) >= 1 && (map.tilesets?.length ?? 0) <= 2, 'Floor 2 may reference only the Floor 1 blockout and Floor 2 manual tilesets');
for (const tileset of map.tilesets ?? []) {
  check(expectedTilesets.includes(tileset.source), `unsupported Floor 2 tileset ${tileset.source ?? '(embedded)'}`);
  const tilesetPath = resolve(dirname(mapPath), tileset.source ?? '');
  check(existsSync(tilesetPath), `referenced tileset is missing: ${tileset.source ?? '(embedded)'}`);
  if (existsSync(tilesetPath)) {
    try {
      const definition = JSON.parse(readFileSync(tilesetPath, 'utf8'));
      for (const tile of definition.tiles ?? []) check(existsSync(resolve(dirname(tilesetPath), tile.image)), `tileset image is missing: ${tile.image}`);
    } catch (error) { failures.push(`cannot parse tileset ${tileset.source}: ${error.message}`); }
  }
}
check(new Set((map.tilesets ?? []).map(item => item.firstgid)).size === (map.tilesets?.length ?? 0), 'duplicate tileset firstgid');

const allObjects = map.layers.flatMap(layer => layer.objects ?? []);
check(new Set(allObjects.map(({ id }) => id)).size === allObjects.length, 'duplicate Tiled object id');
const nodes = objects('NavigationNodes');
const nodeIds = nodes.map(item => props(item).nodeId);
check(nodes.length === REQUIRED_NODES.length, `expected ${REQUIRED_NODES.length} NavigationNodes, found ${nodes.length}`);
check(new Set(nodeIds).size === nodeIds.length, 'duplicate Navigation nodeId');
for (const name of REQUIRED_NODES) check(nodeIds.includes(name), `${name} is missing`);
const nodeById = new Map(nodes.map(node => [props(node).nodeId, node]));
const anchors = {
  F2_LEFT_ARRIVAL: [304, 1120], F2_LEFT_DIRECT_ZONE: [1040, 848], F2_LEFT_OUTER_ZONE: [640, 400],
  F2_RIGHT_ARRIVAL: [2256, 1120], F2_RIGHT_INNER_ZONE: [1520, 848], F2_RIGHT_SERVICE_ZONE: [1920, 400],
  F2_CENTER_GUARD: [1280, 560], F2_CENTER_STAIR: [1280, 304],
};
for (const [name, [x, y]] of Object.entries(anchors)) {
  const node = nodeById.get(name);
  check(node?.x === x && node?.y === y, `${name} must remain at the colored-source anchor ${x},${y}`);
}

const spawns = objects('SpawnPoints');
for (const [name, context] of [['F2_LEFT_ARRIVAL', 'F2_LEFT_APPROACH'], ['F2_RIGHT_ARRIVAL', 'F2_RIGHT_APPROACH']]) {
  const spawn = spawns.filter(item => props(item).spawnId === name);
  check(spawn.length === 1, `${name} spawn must exist exactly once`);
  check(props(spawn[0]).routeContextId === context, `${name} routeContextId must be ${context}`);
}
check(spawns.length === 2, `expected exactly two Floor 2 spawns, found ${spawns.length}`);

const edges = objects('NavigationEdges');
const edgeIds = edges.map(item => props(item).edgeId);
check(edges.length === REQUIRED_EDGES.length, `expected ${REQUIRED_EDGES.length} NavigationEdges, found ${edges.length}`);
check(new Set(edgeIds).size === edgeIds.length, 'duplicate Navigation edgeId');
for (const name of REQUIRED_EDGES) check(edgeIds.includes(name), `${name} is missing`);
for (const edge of edges) {
  const values = props(edge);
  check(nodeById.has(values.from) && nodeById.has(values.to), `${values.edgeId ?? edge.name} has an unknown endpoint`);
  const points = absolutePoints(edge);
  const from = nodeById.get(values.from);
  const to = nodeById.get(values.to);
  check(points[0]?.x === from?.x && points[0]?.y === from?.y, `${edge.name} does not begin at ${values.from}`);
  check(points.at(-1)?.x === to?.x && points.at(-1)?.y === to?.y, `${edge.name} does not end at ${values.to}`);
  check(Math.abs(polylineLength(edge) / TILE - values.lengthTiles) < 0.001, `${edge.name} lengthTiles is stale`);
}
const optionRoutes = arrival => new Set(edges.filter(edge => props(edge).from === arrival || (props(edge).bidirectional && props(edge).to === arrival)).map(edge => props(edge).route));
check(JSON.stringify([...optionRoutes('F2_LEFT_ARRIVAL')].sort()) === JSON.stringify(['F2_DIRECT_OFFICE_ROUTE', 'F2_OUTER_CORRIDOR_ROUTE']), 'LEFT route options must be exactly DIRECT and OUTER');
check(JSON.stringify([...optionRoutes('F2_RIGHT_ARRIVAL')].sort()) === JSON.stringify(['F2_INNER_HALL_ROUTE', 'F2_SERVICE_DETOUR_ROUTE']), 'RIGHT route options must be exactly INNER and SERVICE');
for (const [route, sequence] of Object.entries(ROUTES)) {
  const routeEdges = edges.filter(edge => props(edge).route === route);
  check(routeEdges.length === 2, `${route} must contain exactly two edges`);
  check(reachable(sequence[0], sequence[2], routeEdges), `${route} is not reachable through ${sequence[1]}`);
  check(routeEdges.some(edge => [props(edge).from, props(edge).to].includes(sequence[1])), `${route} does not use ${sequence[1]}`);
}
for (const arrival of ['F2_LEFT_ARRIVAL', 'F2_RIGHT_ARRIVAL']) check(reachable(arrival, 'F2_CENTER_GUARD', edges), `${arrival} cannot reach F2_CENTER_GUARD`);
const leftNodes = new Set(['F2_LEFT_ARRIVAL', 'F2_LEFT_DIRECT_ZONE', 'F2_LEFT_OUTER_ZONE']);
const rightNodes = new Set(['F2_RIGHT_ARRIVAL', 'F2_RIGHT_INNER_ZONE', 'F2_RIGHT_SERVICE_ZONE']);
check(!edges.some(edge => {
  const values = props(edge);
  return (leftNodes.has(values.from) && rightNodes.has(values.to)) || (rightNodes.has(values.from) && leftNodes.has(values.to));
}), 'LEFT/RIGHT direct cross-edge exists before F2_CENTER_GUARD');
check(edges.filter(edge => props(edge).to === 'F2_CENTER_STAIR' || props(edge).from === 'F2_CENTER_STAIR').length === 1, 'CENTER STAIR must have exactly one navigation edge');
const withoutGuard = edges.filter(edge => ![props(edge).from, props(edge).to].includes('F2_CENTER_GUARD'));
for (const arrival of ['F2_LEFT_ARRIVAL', 'F2_RIGHT_ARRIVAL']) check(!reachable(arrival, 'F2_CENTER_STAIR', withoutGuard), `${arrival} can reach CENTER STAIR without CENTER GUARD`);
check(reachable('F2_CENTER_GUARD', 'F2_CENTER_STAIR', edges), 'CENTER GUARD cannot reach CENTER STAIR');

const routeSamples = route => {
  const samples = new Set();
  for (const edge of edges.filter(item => props(item).route === route)) {
    const points = absolutePoints(edge);
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4));
      for (let step = 0; step <= steps; step += 1) samples.add(`${Math.round(from.x + (to.x - from.x) * step / steps)},${Math.round(from.y + (to.y - from.y) * step / steps)}`);
    }
  }
  return samples;
};
const allowedIntersections = {
  'F2_DIRECT_OFFICE_ROUTE:F2_OUTER_CORRIDOR_ROUTE': new Set(['304,1120', '1280,560']),
  'F2_INNER_HALL_ROUTE:F2_SERVICE_DETOUR_ROUTE': new Set(['2256,1120', '1280,560']),
};
for (const [index, leftRoute] of Object.keys(ROUTES).entries()) {
  for (const rightRoute of Object.keys(ROUTES).slice(index + 1)) {
    const intersections = [...routeSamples(leftRoute)].filter(point => routeSamples(rightRoute).has(point));
    const allowed = allowedIntersections[`${leftRoute}:${rightRoute}`] ?? new Set(['1280,560']);
    check(intersections.every(point => allowed.has(point)), `${leftRoute} and ${rightRoute} converge before the guard area`);
  }
}

const collision = objects('Collision').filter(item => props(item).blocksRobot !== false);
const centerStairClearance = { x: 1088, y: 64, width: 352, height: 192 };
check(!collision.some(item => overlaps(item, centerStairClearance)), 'center stair area (1088,64)-(1440,256) must be collision-free');
const central = collision.filter(item => item.name === 'F2_CENTRAL_BLOCKED_MASS');
check(central.length === 1, 'central blocked mass collision must exist exactly once');
const roomMasses = ['F2_LEFT_ROOM_MASS', 'F2_RIGHT_ROOM_MASS'].map(name => collision.find(item => item.name === name));
check(roomMasses.every(Boolean), 'both pink room masses must have collision');
const roomBounds = [[376, 536, 529, 464], [1655, 536, 529, 464]];
roomMasses.forEach((room, index) => check(room && [room.x, room.y, room.width, room.height].every((value, axis) => value === roomBounds[index][axis]), `${room?.name ?? `room ${index}`} does not match the pink source bounds`));
const lockedDoors = ['F2_LEFT_ROOM_DOOR_LOCKED', 'F2_RIGHT_ROOM_DOOR_LOCKED'].map(name => collision.find(item => item.name === name));
check(lockedDoors.every(door => door && props(door).doorFacing === 'SOUTH' && props(door).enterable === false && props(door).locked === true), 'room doors must be locked, non-enterable, and SOUTH-facing');
for (const edge of edges) {
  const points = absolutePoints(edge);
  for (let index = 1; index < points.length; index += 1) check(!segmentHits(collision, points[index - 1], points[index], 12), `${edge.name} lacks clearance for the 24px debug robot`);
}
for (const node of nodes) check(!roomMasses.some(room => room && contains(room, node.x, node.y)), `${node.name} is inside a pink room mass`);
for (const edge of edges) {
  const points = absolutePoints(edge);
  for (let index = 1; index < points.length; index += 1) check(!segmentHits(roomMasses.filter(Boolean), points[index - 1], points[index]), `${edge.name} enters a pink room mass`);
}
for (const encounter of objects('EncounterZones')) check(!roomMasses.some(room => room && overlaps(room, encounter)), `${encounter.name} overlaps a pink room mass`);
for (const [name, bounds] of [['LEFT', SOURCE_RECTS.greenLeft], ['RIGHT', SOURCE_RECTS.greenRight]]) {
  const greenNodes = nodes.filter(node => insideSource(bounds, node.x, node.y));
  check(greenNodes.length === 0, `${name} green door recess must not contain a navigation node`);
  const [x1, y1, x2, y2] = bounds;
  check(y2 - y1 <= TILE * 2 && x2 - x1 <= TILE * 2, `${name} green door recess exceeds two tiles`);
}
const illegalFrom = nodeById.get('F2_LEFT_DIRECT_ZONE');
const illegalTo = nodeById.get('F2_RIGHT_INNER_ZONE');
check(illegalFrom && illegalTo && segmentHits(central, illegalFrom, illegalTo), 'central blocked mass does not reject the illegal LEFT-to-RIGHT shortcut');

const routeLength = route => edges.filter(edge => props(edge).route === route).reduce((total, edge) => total + polylineLength(edge), 0);
const lengths = Object.fromEntries(Object.keys(ROUTES).map(route => [route, routeLength(route)]));
check(lengths.F2_DIRECT_OFFICE_ROUTE < lengths.F2_OUTER_CORRIDOR_ROUTE, 'DIRECT_OFFICE path must be shorter than OUTER_CORRIDOR');
check(lengths.F2_INNER_HALL_ROUTE < lengths.F2_SERVICE_DETOUR_ROUTE, 'INNER_HALL path must be shorter than SERVICE_DETOUR');
const leftRatio = lengths.F2_OUTER_CORRIDOR_ROUTE / lengths.F2_DIRECT_OFFICE_ROUTE;
const rightRatio = lengths.F2_SERVICE_DETOUR_ROUTE / lengths.F2_INNER_HALL_ROUTE;
check(leftRatio >= 1.2, `LEFT long/short ratio must be >= 1.20, got ${leftRatio.toFixed(3)}`);
check(rightRatio >= 1.2, `RIGHT long/short ratio must be >= 1.20, got ${rightRatio.toFixed(3)}`);
check(Math.abs(lengths.F2_DIRECT_OFFICE_ROUTE - lengths.F2_INNER_HALL_ROUTE) < 0.001 && Math.abs(lengths.F2_OUTER_CORRIDOR_ROUTE - lengths.F2_SERVICE_DETOUR_ROUTE) < 0.001, 'LEFT/RIGHT route lengths must be mirror-symmetric');
for (const [leftName, rightName] of [['F2_LEFT_ARRIVAL', 'F2_RIGHT_ARRIVAL'], ['F2_LEFT_DIRECT_ZONE', 'F2_RIGHT_INNER_ZONE'], ['F2_LEFT_OUTER_ZONE', 'F2_RIGHT_SERVICE_ZONE']]) {
  const left = nodeById.get(leftName);
  const right = nodeById.get(rightName);
  check(left && right && left.x + right.x === WIDTH * TILE && left.y === right.y, `${leftName}/${rightName} are not mirror-symmetric`);
}

const guardZones = objects('EncounterZones').filter(item => item.name === 'F2_CENTER_GUARD_ZONE');
check(guardZones.length === 1, 'F2_CENTER_GUARD_ZONE must exist exactly once');
const guard = props(guardZones[0]);
check(guard.encounterType === 'VILLAIN_ENCOUNTER', 'CENTER GUARD encounterType must be VILLAIN_ENCOUNTER');
check(guard.villainCount === 2, 'CENTER GUARD villainCount must be 2');
check(guard.bypassAvailable === false, 'CENTER GUARD bypassAvailable must be false');
check(guard.actions === 'SUBDUE,DISTRACT,RETREAT', 'CENTER GUARD actions must be SUBDUE,DISTRACT,RETREAT');

const transitions = objects('FloorTransitions');
check(transitions.length === 1 && transitions[0].name === 'F2_CENTER_STAIR_TRANSITION', 'F2_CENTER_STAIR_TRANSITION must exist exactly once');
const transition = props(transitions[0]);
check(transition.targetFloor === 3, 'CENTER STAIR targetFloor must be 3');
check(transition.targetSpawn === 'F3_CENTER_ARRIVAL', 'CENTER STAIR targetSpawn must be F3_CENTER_ARRIVAL');
const stairFootprints = objects('Debug').filter(item => item.type === 'StairFootprint');
check(stairFootprints.length === 3, `Floor 2 must contain exactly three stairs, found ${stairFootprints.length}`);

const serialized = JSON.stringify(map).toUpperCase();
check(!serialized.includes('ELEVATOR'), 'Floor 2 must not contain an elevator');
check(!serialized.includes('BOSS_ENCOUNTER') && !serialized.includes('BOSS ROOM') && !serialized.includes('BOSS_ROOM'), 'Floor 2 must not contain a boss encounter or boss room');

if (failures.length) {
  console.error(`FAIL floor_2_blockout (${new Set(failures).size})`);
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS floor_2_blockout');
  console.log(`map=${map.width}x${map.height} tile=${map.tilewidth}x${map.tileheight} objects=${allObjects.length}`);
  console.log(`nodes=${nodes.length} edges=${edges.length} collision=${collision.length} stairs=${stairFootprints.length}`);
  console.log(`direct=${(lengths.F2_DIRECT_OFFICE_ROUTE / TILE).toFixed(3)} outer=${(lengths.F2_OUTER_CORRIDOR_ROUTE / TILE).toFixed(3)} tiles`);
  console.log(`inner=${(lengths.F2_INNER_HALL_ROUTE / TILE).toFixed(3)} service=${(lengths.F2_SERVICE_DETOUR_ROUTE / TILE).toFixed(3)} tiles`);
  console.log(`ratios=LEFT:${leftRatio.toFixed(3)} RIGHT:${rightRatio.toFixed(3)} source=floor_2_structure_clean_v2.png`);
  console.log('reachability=PASS convergence=F2_CENTER_GUARD transition=F3_CENTER_ARRIVAL');
}
