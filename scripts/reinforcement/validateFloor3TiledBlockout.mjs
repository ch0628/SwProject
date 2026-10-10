import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const mapPath = resolve('public/maps/reinforcement/floor_3_blockout.tmj');
const manualTilesetPath = resolve('public/assets/environment/reinforcement/floor3_room_shell_manual/floor3_room_shell_manual.tsj');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const parse = path => {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { failures.push(`cannot parse ${path}: ${error.message}`); return {}; }
};
const map = parse(mapPath);
const manualTileset = parse(manualTilesetPath);
const WIDTH = 80;
const HEIGHT = 45;
const TILE = 32;
const REQUIRED_LAYERS = ['Ground', 'FloorDetail', 'Walls', 'WallTop', 'StaticProps', 'Collision', 'NavigationNodes', 'NavigationEdges', 'EncounterZones', 'FloorTransitions', 'SpawnPoints', 'Debug'];
const REQUIRED_NODES = ['F3_CENTER_ARRIVAL', 'F3_LEFT_MAINT_ZONE', 'F3_LEFT_GUARD', 'F3_LEFT_STAIR', 'F3_RIGHT_PERIMETER_ZONE', 'F3_RIGHT_GUARD', 'F3_RIGHT_STAIR'];
const REQUIRED_EDGES = ['E_F3_LEFT_A', 'E_F3_LEFT_B', 'E_F3_LEFT_C', 'E_F3_RIGHT_A', 'E_F3_RIGHT_B', 'E_F3_RIGHT_C'];
const ROUTES = {
  F3_LEFT_MAINTENANCE_ROUTE: ['F3_CENTER_ARRIVAL', 'F3_LEFT_MAINT_ZONE', 'F3_LEFT_GUARD', 'F3_LEFT_STAIR'],
  F3_RIGHT_PERIMETER_ROUTE: ['F3_CENTER_ARRIVAL', 'F3_RIGHT_PERIMETER_ZONE', 'F3_RIGHT_GUARD', 'F3_RIGHT_STAIR'],
};
const CLEAR_AREAS = {
  CENTER: { x: 1088, y: 1216, width: 384, height: 160 },
  LEFT: { x: 448, y: 96, width: 384, height: 352 },
  RIGHT: { x: 1984, y: 96, width: 384, height: 288 },
};

const props = object => Object.fromEntries((object?.properties ?? []).map(({ name, value }) => [name, value]));
const objects = name => map.layers?.find(layer => layer.name === name && layer.type === 'objectgroup')?.objects ?? [];
const overlaps = (left, right) => left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
const contains = (rectangle, x, y, margin = 0) => x >= rectangle.x - margin && x <= rectangle.x + rectangle.width + margin && y >= rectangle.y - margin && y <= rectangle.y + rectangle.height + margin;
const absolutePoints = edge => (edge.polyline ?? []).map(point => ({ x: edge.x + point.x, y: edge.y + point.y }));
const polylineLength = edge => {
  const points = absolutePoints(edge);
  return points.slice(1).reduce((total, point, index) => total + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
};
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
    const values = props(edge);
    adjacency.set(values.from, [...(adjacency.get(values.from) ?? []), values.to]);
    if (values.bidirectional) adjacency.set(values.to, [...(adjacency.get(values.to) ?? []), values.from]);
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
const decode = name => {
  const layer = map.layers?.find(candidate => candidate.name === name);
  try {
    const bytes = inflateSync(Buffer.from(layer.data, 'base64'));
    return Array.from({ length: bytes.length / 4 }, (_, index) => bytes.readUInt32LE(index * 4));
  } catch (error) {
    failures.push(`${name} tile data cannot be decoded: ${error.message}`);
    return [];
  }
};
const physicalReachable = (start, target, blocked) => {
  const step = 16;
  const key = (x, y) => `${x},${y}`;
  const queue = [[start.x, start.y]];
  const visited = new Set([key(start.x, start.y)]);
  while (queue.length) {
    const [x, y] = queue.shift();
    if (Math.abs(x - target.x) <= step && Math.abs(y - target.y) <= step) return true;
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const nx = x + dx;
      const ny = y + dy;
      const id = key(nx, ny);
      if (nx < 12 || ny < 12 || nx > WIDTH * TILE - 12 || ny > HEIGHT * TILE - 12 || visited.has(id) || blocked.some(rectangle => contains(rectangle, nx, ny, 12))) continue;
      visited.add(id);
      queue.push([nx, ny]);
    }
  }
  return false;
};

check(map.orientation === 'orthogonal', 'orientation must be orthogonal');
check(map.width === WIDTH && map.height === HEIGHT, `map must be ${WIDTH}x${HEIGHT}`);
check(map.tilewidth === TILE && map.tileheight === TILE, `tiles must be ${TILE}x${TILE}`);
check(props(map).geometrySource === 'floor_3_structure_clean_v2.png', 'geometrySource must be floor_3_structure_clean_v2.png');
check(JSON.stringify((map.layers ?? []).map(({ name }) => name)) === JSON.stringify(REQUIRED_LAYERS), 'layer order must match the Floor 3 contract');
const tileData = Object.fromEntries(REQUIRED_LAYERS.slice(0, 5).map(name => [name, decode(name)]));
for (const name of REQUIRED_LAYERS.slice(0, 5)) check(tileData[name].length === WIDTH * HEIGHT, `${name} must contain ${WIDTH * HEIGHT} cells`);

check(manualTileset.name === 'floor3_room_shell_manual', 'manual tileset name must be floor3_room_shell_manual');
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
const manualReference = map.tilesets?.find(item => item.source?.includes('floor3_room_shell_manual'));
check(Boolean(manualReference), 'Floor 3 manual tileset reference is missing');
const usedGids = new Set(Object.values(tileData).flat().map(gid => gid & 0x1fffffff).filter(Boolean));
for (const gid of usedGids) {
  if (manualReference && gid >= manualReference.firstgid) check((manualTileset.tiles ?? []).some(tile => tile.id === gid - manualReference.firstgid), `TMJ gid ${gid} has no manual TSJ tile entry`);
}

const allObjects = (map.layers ?? []).flatMap(layer => layer.objects ?? []);
check(new Set(allObjects.map(({ id }) => id)).size === allObjects.length, 'duplicate Tiled object id');
const nodes = objects('NavigationNodes');
const nodeIds = nodes.map(item => props(item).nodeId);
check(nodes.length === 7 && REQUIRED_NODES.every(name => nodeIds.includes(name)), 'required seven NavigationNodes are invalid');
check(new Set(nodeIds).size === nodeIds.length, 'duplicate Navigation nodeId');
const nodeById = new Map(nodes.map(node => [props(node).nodeId, node]));
const anchors = {
  F3_CENTER_ARRIVAL: [1280, 1184], F3_LEFT_MAINT_ZONE: [864, 960], F3_LEFT_GUARD: [640, 512], F3_LEFT_STAIR: [640, 240],
  F3_RIGHT_PERIMETER_ZONE: [2176, 800], F3_RIGHT_GUARD: [2176, 480], F3_RIGHT_STAIR: [2176, 240],
};
for (const [name, [x, y]] of Object.entries(anchors)) {
  const node = nodeById.get(name);
  check(node?.x === x && node?.y === y, `${name} must remain at ${x},${y}`);
}

const spawn = objects('SpawnPoints');
check(spawn.length === 1 && props(spawn[0]).spawnId === 'F3_CENTER_ARRIVAL', 'F3_CENTER_ARRIVAL spawn must exist exactly once');
check(props(spawn[0]).routeContextId === 'F3_STAIR_SPLIT', 'center spawn routeContextId must be F3_STAIR_SPLIT');
const edges = objects('NavigationEdges');
const edgeIds = edges.map(item => props(item).edgeId);
check(edges.length === 6 && REQUIRED_EDGES.every(name => edgeIds.includes(name)), 'required six NavigationEdges are invalid');
check(new Set(edgeIds).size === edgeIds.length, 'duplicate Navigation edgeId');
for (const edge of edges) {
  const values = props(edge);
  const points = absolutePoints(edge);
  check(nodeById.has(values.from) && nodeById.has(values.to), `${edge.name} has an unknown endpoint`);
  check(points[0]?.x === nodeById.get(values.from)?.x && points[0]?.y === nodeById.get(values.from)?.y, `${edge.name} does not begin at ${values.from}`);
  check(points.at(-1)?.x === nodeById.get(values.to)?.x && points.at(-1)?.y === nodeById.get(values.to)?.y, `${edge.name} does not end at ${values.to}`);
  check(Math.abs(polylineLength(edge) / TILE - values.lengthTiles) < 0.01, `${edge.name} lengthTiles is stale`);
}
const options = new Set(edges.filter(edge => props(edge).from === 'F3_CENTER_ARRIVAL').map(edge => props(edge).route));
check(JSON.stringify([...options].sort()) === JSON.stringify(Object.keys(ROUTES).sort()), 'CENTER route options must be exactly LEFT and RIGHT');
for (const [route, sequence] of Object.entries(ROUTES)) {
  const routeEdges = edges.filter(edge => props(edge).route === route);
  check(routeEdges.length === 3, `${route} must contain exactly three edges`);
  check(reachable(sequence[0], sequence.at(-1), routeEdges), `${route} is not reachable`);
  for (const node of sequence.slice(1, -1)) check(routeEdges.some(edge => [props(edge).from, props(edge).to].includes(node)), `${route} skips ${node}`);
}
const leftNodes = new Set(ROUTES.F3_LEFT_MAINTENANCE_ROUTE.slice(1));
const rightNodes = new Set(ROUTES.F3_RIGHT_PERIMETER_ROUTE.slice(1));
check(!edges.some(edge => (leftNodes.has(props(edge).from) && rightNodes.has(props(edge).to)) || (rightNodes.has(props(edge).from) && leftNodes.has(props(edge).to))), 'LEFT/RIGHT direct cross-edge exists');
for (const side of ['LEFT', 'RIGHT']) {
  const withoutGuard = edges.filter(edge => ![props(edge).from, props(edge).to].includes(`F3_${side}_GUARD`));
  check(!reachable('F3_CENTER_ARRIVAL', `F3_${side}_STAIR`, withoutGuard), `${side} stair is graph-reachable without its guard`);
}

const collision = objects('Collision').filter(item => props(item).blocksRobot !== false);
for (const [name, area] of Object.entries(CLEAR_AREAS)) check(!collision.some(item => overlaps(item, area)), `${name} stair required-clear area overlaps Collision`);
const room = collision.find(item => item.name === 'F3_GREEN_FACILITY_ROOM');
check(room && room.x === 1632 && room.y === 800 && room.width === 384 && room.height === 288, 'GREEN facility room collision bounds are invalid');
check(props(room).enterable === false && props(room).locked === true, 'GREEN facility room must be locked and non-enterable');
for (const node of nodes) check(!room || !contains(room, node.x, node.y), `${node.name} is inside GREEN facility room`);
for (const edge of edges) {
  const points = absolutePoints(edge);
  for (let index = 1; index < points.length; index += 1) {
    check(!segmentHits(collision, points[index - 1], points[index], 12), `${edge.name} lacks clearance for the 24px debug robot`);
    check(!room || !segmentHits([room], points[index - 1], points[index]), `${edge.name} enters GREEN facility room`);
  }
}
check(segmentHits(collision, nodeById.get('F3_LEFT_MAINT_ZONE'), nodeById.get('F3_RIGHT_PERIMETER_ZONE')), 'GRAY architecture does not reject a direct mid-route crossover');
check(room && segmentHits([room], { x: 1824, y: 1120 }, { x: 1824, y: 960 }), 'GREEN room frontage does not reject room entry');

const encounters = objects('EncounterZones');
const obstacles = encounters.filter(item => props(item).encounterType === 'OBSTACLE');
check(obstacles.length === 4, `expected four LEFT obstacle zones, found ${obstacles.length}`);
for (const obstacle of obstacles) {
  const values = props(obstacle);
  check(values.route === 'F3_LEFT_MAINTENANCE_ROUTE' && values.facilityDamagePossible === true, `${obstacle.name} obstacle properties are invalid`);
  check(!collision.some(item => overlaps(item, obstacle)), `${obstacle.name} overlaps permanent Collision`);
}
check(!encounters.some(item => props(item).route === 'F3_RIGHT_PERIMETER_ROUTE' && props(item).encounterType === 'OBSTACLE'), 'RIGHT route contains an obstacle zone');
check(!encounters.some(item => contains(item, 1280, 1184)), 'CENTER arrival contains an encounter');
for (const side of ['LEFT', 'RIGHT']) {
  const guard = encounters.find(item => item.name === `F3_${side}_GUARD_ZONE`);
  const values = props(guard);
  check(values.encounterType === 'VILLAIN_ENCOUNTER' && values.villainCount === 2 && values.bypassAvailable === false, `${side} guard contract is invalid`);
  check(values.actions === 'SUBDUE,DISTRACT,RETREAT', `${side} guard actions are invalid`);
  const blockedByGuard = guard ? [...collision, guard] : collision;
  check(!physicalReachable(nodeById.get('F3_CENTER_ARRIVAL'), nodeById.get(`F3_${side}_STAIR`), blockedByGuard), `${side} stair has a physical guard bypass`);
}
check(!encounters.some(item => room && overlaps(item, room)), 'an encounter overlaps GREEN facility room');

const transitions = objects('FloorTransitions');
check(transitions.length === 2, `expected two upward transitions, found ${transitions.length}`);
for (const side of ['LEFT', 'RIGHT']) {
  const transition = transitions.find(item => item.name === `F3_${side}_STAIR_TRANSITION`);
  check(transition && props(transition).targetFloor === 4 && props(transition).targetSpawn === `F4_${side}_ARRIVAL`, `${side} transition target is invalid`);
  check(transition && !collision.some(item => overlaps(item, transition)), `${side} transition overlaps Collision`);
}
const stairFootprints = objects('Debug').filter(item => item.type === 'StairFootprint');
check(stairFootprints.length === 3, `expected exactly three stair architectures, found ${stairFootprints.length}`);
const serialized = JSON.stringify(map).toUpperCase();
check(!serialized.includes('ELEVATOR'), 'Floor 3 must not contain an elevator');
check(!serialized.includes('BOSS_ENCOUNTER') && !serialized.includes('BOSS_ROOM'), 'Floor 3 must not contain a boss');

const length = route => edges.filter(edge => props(edge).route === route).reduce((total, edge) => total + polylineLength(edge), 0);
const leftLength = length('F3_LEFT_MAINTENANCE_ROUTE');
const rightLength = length('F3_RIGHT_PERIMETER_ROUTE');
const ratio = rightLength / leftLength;
check(leftLength < rightLength, 'LEFT navigation length must be shorter than RIGHT');
check(ratio >= 1.2, `RIGHT/LEFT navigation ratio must be >= 1.20, got ${ratio.toFixed(3)}`);
check(physicalReachable(nodeById.get('F3_CENTER_ARRIVAL'), nodeById.get('F3_LEFT_STAIR'), collision), 'CENTER cannot physically reach LEFT stair');
check(physicalReachable(nodeById.get('F3_CENTER_ARRIVAL'), nodeById.get('F3_RIGHT_STAIR'), collision), 'CENTER cannot physically reach RIGHT stair');
check(physicalReachable(nodeById.get('F3_LEFT_GUARD'), nodeById.get('F3_LEFT_STAIR'), collision), 'LEFT guard cannot physically reach LEFT stair');
check(physicalReachable(nodeById.get('F3_RIGHT_GUARD'), nodeById.get('F3_RIGHT_STAIR'), collision), 'RIGHT guard cannot physically reach RIGHT stair');

if (failures.length) {
  console.error(`FAIL floor_3_blockout (${new Set(failures).size})`);
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS floor_3_blockout');
  console.log(`map=${map.width}x${map.height} tile=${map.tilewidth}x${map.tileheight} objects=${allObjects.length}`);
  console.log(`nodes=${nodes.length} edges=${edges.length} collision=${collision.length} stairs=${stairFootprints.length}`);
  console.log(`left=${(leftLength / TILE).toFixed(3)} right=${(rightLength / TILE).toFixed(3)} tiles ratio=${ratio.toFixed(3)}`);
  console.log(`obstacles=${obstacles.length} guards=2 transitions=2 manualTiles=${(manualTileset.tiles ?? []).length}`);
  console.log('reachability=PASS guardBypass=BLOCKED greenRoom=BLOCKED stairClearance=PASS');
}
