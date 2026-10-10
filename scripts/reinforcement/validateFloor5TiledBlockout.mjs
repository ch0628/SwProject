import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const WIDTH = 80;
const HEIGHT = 45;
const TILE = 32;
const REQUIRED_LAYERS = ['Ground', 'FloorDetail', 'Walls', 'WallTop', 'StaticProps', 'Collision', 'NavigationNodes', 'NavigationEdges', 'EncounterZones', 'FloorTransitions', 'SpawnPoints', 'Debug'];
const REQUIRED_NODES = ['F5_SEARCH_HUB', 'F5_LEFT_WING', 'F5_L1_GUARD', 'F5_ROOM_L1', 'F5_L2_GUARD', 'F5_ROOM_L2', 'F5_RIGHT_WING', 'F5_R1_GUARD', 'F5_ROOM_R1', 'F5_R2_GUARD', 'F5_ROOM_R2', 'F5_CENTRAL_HALL', 'F5_SECURITY_LOCK', 'F5_CONTROL_ROOM', 'F5_GOAL'];
const REQUIRED_EDGES = [
  'E_F5_HUB_LEFT', 'E_F5_LEFT_L1_GUARD', 'E_F5_L1_ROOM', 'E_F5_LEFT_L2_GUARD', 'E_F5_L2_ROOM', 'E_F5_HUB_RIGHT', 'E_F5_RIGHT_R1_GUARD', 'E_F5_R1_ROOM', 'E_F5_RIGHT_R2_GUARD', 'E_F5_R2_ROOM',
  'E_F5_L1_NO_BOSS_RETURN', 'E_F5_L2_NO_BOSS_RETURN', 'E_F5_R1_NO_BOSS_RETURN', 'E_F5_R2_NO_BOSS_RETURN', 'E_F5_L1_POST_BOSS', 'E_F5_L2_POST_BOSS', 'E_F5_R1_POST_BOSS', 'E_F5_R2_POST_BOSS',
  'E_F5_HALL_LOCK', 'E_F5_LOCK_CONTROL', 'E_F5_CONTROL_GOAL',
];
const ROOMS = ['L1', 'L2', 'R1', 'R2'];
const SEARCH_EDGES = {
  L1: ['E_F5_HUB_LEFT', 'E_F5_LEFT_L1_GUARD', 'E_F5_L1_ROOM'], L2: ['E_F5_HUB_LEFT', 'E_F5_LEFT_L2_GUARD', 'E_F5_L2_ROOM'],
  R1: ['E_F5_HUB_RIGHT', 'E_F5_RIGHT_R1_GUARD', 'E_F5_R1_ROOM'], R2: ['E_F5_HUB_RIGHT', 'E_F5_RIGHT_R2_GUARD', 'E_F5_R2_ROOM'],
};
const DOORWAYS = {
  L1: { x: 256, y: 832, width: 64, height: 32, centerX: 288, west: { x: 96, y: 832, width: 160, height: 32 }, east: { x: 320, y: 832, width: 160, height: 32 } },
  L2: { x: 672, y: 352, width: 64, height: 32, centerX: 704, west: { x: 512, y: 352, width: 160, height: 32 }, east: { x: 736, y: 352, width: 160, height: 32 } },
  R2: { x: 1824, y: 352, width: 64, height: 32, centerX: 1856, west: { x: 1664, y: 352, width: 160, height: 32 }, east: { x: 1888, y: 352, width: 160, height: 32 } },
  R1: { x: 2240, y: 832, width: 64, height: 32, centerX: 2272, west: { x: 2080, y: 832, width: 160, height: 32 }, east: { x: 2304, y: 832, width: 160, height: 32 } },
};
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const props = item => Object.fromEntries((item?.properties ?? []).map(({ name, value }) => [name, value]));
const mapPath = resolve('public/maps/reinforcement/floor_5_blockout.tmj');
const tilesetPath = resolve('public/assets/environment/reinforcement/floor5_room_shell_manual/floor5_room_shell_manual.tsj');
let map;
let tileset;
try { map = JSON.parse(readFileSync(mapPath, 'utf8')); } catch (error) { console.error(`FAIL: cannot parse ${mapPath}: ${error.message}`); process.exit(1); }
try { tileset = JSON.parse(readFileSync(tilesetPath, 'utf8')); } catch (error) { console.error(`FAIL: cannot parse ${tilesetPath}: ${error.message}`); process.exit(1); }
const floor4 = JSON.parse(readFileSync(resolve('public/maps/reinforcement/floor_4_blockout.tmj'), 'utf8'));

const layers = new Map((map.layers ?? []).map(layer => [layer.name, layer]));
const objects = name => layers.get(name)?.objects ?? [];
const absolutePoints = edge => (edge.polyline ?? []).map(point => ({ x: edge.x + point.x, y: edge.y + point.y }));
const length = points => points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
const edgeById = new Map(objects('NavigationEdges').map(edge => [props(edge).edgeId, edge]));
const routePoints = ids => ids.flatMap((id, index) => absolutePoints(edgeById.get(id)).slice(index ? 1 : 0));
const contains = (rectangle, x, y, margin = 0) => x >= rectangle.x - margin && x <= rectangle.x + rectangle.width + margin && y >= rectangle.y - margin && y <= rectangle.y + rectangle.height + margin;
const overlaps = (left, right) => left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
const sameBounds = (object, bounds) => object?.x === bounds.x && object?.y === bounds.y && object?.width === bounds.width && object?.height === bounds.height;
const segmentHits = (rectangles, from, to, margin = 0) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4));
  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    if (rectangles.some(rectangle => contains(rectangle, from.x + (to.x - from.x) * ratio, from.y + (to.y - from.y) * ratio, margin))) return true;
  }
  return false;
};
const physicalReachable = (start, target, blocked, step = 16, margin = 12) => {
  const snap = value => Math.round(value / step) * step;
  const startPoint = { x: snap(start.x), y: snap(start.y) };
  const targetPoint = { x: snap(target.x), y: snap(target.y) };
  const key = point => `${point.x},${point.y}`;
  if (blocked.some(item => contains(item, startPoint.x, startPoint.y, margin)) || blocked.some(item => contains(item, targetPoint.x, targetPoint.y, margin))) return false;
  const queue = [startPoint];
  const visited = new Set([key(startPoint)]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.x === targetPoint.x && current.y === targetPoint.y) return true;
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const next = { x: current.x + dx, y: current.y + dy };
      const id = key(next);
      if (next.x < margin || next.y < margin || next.x >= WIDTH * TILE - margin || next.y >= HEIGHT * TILE - margin || visited.has(id)) continue;
      if (blocked.some(item => contains(item, next.x, next.y, margin))) continue;
      visited.add(id);
      queue.push(next);
    }
  }
  return false;
};
const decode = layer => {
  if (Array.isArray(layer?.data)) return layer.data;
  try {
    const bytes = inflateSync(Buffer.from(layer?.data ?? '', 'base64'));
    return Array.from({ length: bytes.length / 4 }, (_, index) => bytes.readUInt32LE(index * 4));
  } catch (error) {
    failures.push(`${layer?.name ?? 'unknown layer'} cannot be decoded: ${error.message}`);
    return [];
  }
};

check(map.orientation === 'orthogonal', 'orientation must be orthogonal');
check(map.width === WIDTH && map.height === HEIGHT, 'map must be 80x45');
check(map.tilewidth === TILE && map.tileheight === TILE, 'tiles must be 32x32');
check(JSON.stringify((map.layers ?? []).map(({ name }) => name)) === JSON.stringify(REQUIRED_LAYERS), 'layer order must match the Floor 5 contract');
check(props(map).geometrySource === 'floor_5_structure_arch_v3.png', 'geometrySource must be floor_5_structure_arch_v3.png');
for (const name of REQUIRED_LAYERS.slice(0, 5)) check(decode(layers.get(name)).length === WIDTH * HEIGHT, `${name} must contain 3600 cells`);

check(tileset.name === 'floor5_room_shell_manual', 'manual tileset name is invalid');
check(tileset.columns === 0 && tileset.grid?.width === TILE && tileset.grid?.height === TILE, 'manual tileset must be a 32x32 Collection of Images');
const classes = new Set();
for (const tile of tileset.tiles ?? []) {
  const tileClass = tile.class ?? tile.type;
  check(Boolean(tileClass), `manual tile ${tile.id} has no Class`);
  check(!classes.has(tileClass), `duplicate manual tile Class ${tileClass}`);
  classes.add(tileClass);
  check(basename(tile.image, extname(tile.image)) === tileClass, `manual tile ${tile.id} filename stem must equal Class ${tileClass}`);
  check(existsSync(resolve(dirname(tilesetPath), tile.image)), `manual tileset image is missing: ${tile.image}`);
}
const manualReference = map.tilesets?.find(item => item.source?.includes('floor5_room_shell_manual'));
check(Boolean(manualReference), 'Floor 5 manual tileset reference is missing');
const usedGids = new Set(REQUIRED_LAYERS.slice(0, 5).flatMap(name => decode(layers.get(name))).map(gid => gid & 0x1fffffff).filter(Boolean));
for (const gid of usedGids) if (manualReference && gid >= manualReference.firstgid) {
  check((tileset.tiles ?? []).some(tile => tile.id === gid - manualReference.firstgid), `TMJ gid ${gid} has no manual TSJ tile entry`);
}

const nodes = objects('NavigationNodes');
const nodeIds = nodes.map(node => props(node).nodeId);
check(nodes.length === 15 && REQUIRED_NODES.every(id => nodeIds.includes(id)), 'required 15 NavigationNodes are invalid');
check(new Set(nodeIds).size === nodes.length, 'duplicate Navigation nodeId');
const nodeById = new Map(nodes.map(node => [props(node).nodeId, node]));
const edges = objects('NavigationEdges');
const edgeIds = edges.map(edge => props(edge).edgeId);
check(edges.length === 21 && REQUIRED_EDGES.every(id => edgeIds.includes(id)), 'required 21 NavigationEdges are invalid');
check(new Set(edgeIds).size === edges.length, 'duplicate Navigation edgeId');
for (const edge of edges) {
  const values = props(edge);
  const points = absolutePoints(edge);
  check(points[0]?.x === nodeById.get(values.from)?.x && points[0]?.y === nodeById.get(values.from)?.y, `${edge.name} does not begin at ${values.from}`);
  check(points.at(-1)?.x === nodeById.get(values.to)?.x && points.at(-1)?.y === nodeById.get(values.to)?.y, `${edge.name} does not end at ${values.to}`);
  check(Math.abs(length(points) / TILE - values.lengthTiles) < 0.001, `${edge.name} lengthTiles is stale`);
}

const rooms = objects('Debug').filter(object => object.type === 'SearchRoom');
check(rooms.length === 4 && ROOMS.every(room => rooms.some(item => props(item).roomId === room && props(item).walkable === true)), 'four walkable Search Room regions are required');
const encounters = objects('EncounterZones');
check(encounters.length === 4, 'exactly four room guard encounters are required');
for (const room of ROOMS) {
  const guard = encounters.find(item => props(item).roomId === room);
  check(guard && props(guard).encounterType === 'VILLAIN_ENCOUNTER' && props(guard).villainCount === 1 && props(guard).bypassAvailable === false, `${room} guard contract is invalid`);
}
const collision = objects('Collision');
const lock = collision.find(item => item.name === 'F5_SECURITY_LOCK_BARRIER');
const dynamicDoors = collision.filter(item => props(item).dynamicDoor === true);
const permanentCollision = collision.filter(item => item !== lock && props(item).dynamicDoor !== true);
check(lock && props(lock).dynamicLock === true && props(lock).requiresState === 'BOSS_NEUTRALIZED', 'Security Lock dynamic barrier is invalid');
check(dynamicDoors.length === 4, 'exactly four dynamic Search Room doors are required');
for (const room of ROOMS) {
  const contract = DOORWAYS[room];
  const door = dynamicDoors.find(item => item.name === `F5_${room}_DOOR_BARRIER`);
  const doorValues = props(door);
  check(sameBounds(door, contract) && doorValues.blocksRobot === true && doorValues.roomId === room && doorValues.doorId === `F5_${room}_DOOR` &&
    doorValues.guardNodeId === `F5_${room}_GUARD` && doorValues.requiresState === 'VILLAIN_NEUTRALIZED', `${room} dynamic door contract is invalid`);
  for (const [side, bounds] of [['WEST', contract.west], ['EAST', contract.east]]) {
    const wall = collision.find(item => item.name === `F5_${room}_DOOR_WALL_${side}`);
    const wallValues = props(wall);
    check(sameBounds(wall, bounds) && wallValues.blocksRobot === true && wallValues.roomId === room && wallValues.doorSide === side, `${room} ${side} doorway wall is invalid`);
  }
  const route = routePoints(SEARCH_EDGES[room]);
  const centered = route.slice(1).some((point, index) => point.x === contract.centerX && route[index].x === contract.centerX &&
    Math.min(point.y, route[index].y) <= contract.y && Math.max(point.y, route[index].y) >= contract.y + contract.height);
  check(centered, `${room} route does not cross the exact doorway centerline`);
}
for (const node of nodes) check(!collision.some(item => contains(item, node.x, node.y, 12)), `${node.name} is inside Collision`);
for (const room of rooms) check(!permanentCollision.some(item => contains(item, nodeById.get(`F5_ROOM_${props(room).roomId}`).x, nodeById.get(`F5_ROOM_${props(room).roomId}`).y, 12)), `${room.name} interior is blocked`);
for (const edge of edges) {
  const points = absolutePoints(edge);
  for (let index = 1; index < points.length; index += 1) check(!segmentHits(permanentCollision, points[index - 1], points[index], 12), `${edge.name} centerline hits permanent Collision`);
}

const lengths = {};
for (const room of ROOMS) {
  const points = routePoints(SEARCH_EDGES[room]);
  lengths[room] = length(points) / TILE;
  for (let index = 1; index < points.length; index += 1) check(!segmentHits(permanentCollision, points[index - 1], points[index], 12), `Hub→${room} centerline hits Collision`);
  const roomNode = nodeById.get(`F5_ROOM_${room}`);
  check(physicalReachable(nodeById.get('F5_SEARCH_HUB'), roomNode, permanentCollision), `Hub→${room} is not physically reachable`);
  const roomDoor = dynamicDoors.find(item => props(item).roomId === room);
  check(roomDoor && !physicalReachable(nodeById.get('F5_SEARCH_HUB'), roomNode, [...permanentCollision, roomDoor]), `Hub→${room} passes through a closed door`);
  const guard = encounters.find(item => props(item).roomId === room);
  check(!physicalReachable(nodeById.get('F5_SEARCH_HUB'), roomNode, [...permanentCollision, guard]), `${room} guard has a physical bypass`);
}
const min = Math.min(...Object.values(lengths));
const max = Math.max(...Object.values(lengths));
const ratio = max / min;
const spread = max - min;
check(ratio <= 1.05 || spread <= 2, `room path distance bias exceeds policy: ratio=${ratio.toFixed(4)} spread=${spread.toFixed(3)}`);

const noBoss = edges.filter(edge => props(edge).availability === 'NO_BOSS_RETURN');
check(noBoss.length === 4 && ROOMS.every(room => noBoss.some(edge => props(edge).edgeId === `E_F5_${room}_NO_BOSS_RETURN`)), 'four NO_BOSS return edges are required');
const postBoss = edges.filter(edge => String(props(edge).edgeId).endsWith('_POST_BOSS'));
check(postBoss.length === 4 && postBoss.every(edge => props(edge).availability === 'BOSS_NEUTRALIZED'), 'four POST_BOSS edges are invalid');
check(props(edgeById.get('E_F5_HALL_LOCK')).availability === 'BOSS_NEUTRALIZED' && props(edgeById.get('E_F5_LOCK_CONTROL')).availability === 'BOSS_NEUTRALIZED', 'Control approach must require BOSS_NEUTRALIZED');
check(props(edgeById.get('E_F5_CONTROL_GOAL')).availability === 'SYSTEM_RESTORED', 'Goal edge must require SYSTEM_RESTORED');
check(!physicalReachable(nodeById.get('F5_SEARCH_HUB'), nodeById.get('F5_CONTROL_ROOM'), collision), 'pre-Boss Control Room access is not blocked');
check(physicalReachable(nodeById.get('F5_SEARCH_HUB'), nodeById.get('F5_CONTROL_ROOM'), permanentCollision), 'post-Boss Control Room access is not reachable');
check(physicalReachable(nodeById.get('F5_CONTROL_ROOM'), nodeById.get('F5_GOAL'), permanentCollision), 'Control Room→Goal is not reachable');

const mapValues = props(map);
check(mapValues.bossCandidateRooms === 'L1,L2,R1,R2', 'Boss candidates must be exactly L1,L2,R1,R2');
check(mapValues.locationSelection === 'SEEDED_RANDOM_PER_EPISODE' && mapValues.locationPolicyVisibility === false, 'Boss random/hidden policy is invalid');
check(mapValues.searchedRoomState === 'EPISODE_LOCAL_SET' && mapValues.repeatSelectionAllowed === false && mapValues.contextKeyIncludesHiddenLocation === false, 'Boss Search episode/context policy is invalid');
check(!encounters.some(item => props(item).encounterType === 'BOSS_ENCOUNTER'), 'Boss Encounter must not be fixed in Tiled geometry');
check(objects('FloorTransitions').length === 0, 'Floor 5 must not contain an upward transition');
const spawn = objects('SpawnPoints');
check(spawn.length === 1 && props(spawn[0]).spawnId === 'F5_SEARCH_HUB' && props(spawn[0]).sourceTransition === 'F4_CENTER_STAIR_TRANSITION', 'F4→F5 arrival spawn is invalid');
const floor4Transition = floor4.layers?.find(layer => layer.name === 'FloorTransitions')?.objects?.find(object => object.name === 'F4_CENTER_STAIR_TRANSITION');
check(props(floor4Transition).targetFloor === 5 && props(floor4Transition).targetSpawn === 'F5_SEARCH_HUB', 'Floor 4 center stair does not target F5_SEARCH_HUB');
check(!JSON.stringify(map).toUpperCase().includes('ELEVATOR'), 'Floor 5 must not contain an elevator');

if (failures.length) {
  console.error(`FAIL floor_5_blockout (${new Set(failures).size})`);
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS floor_5_blockout');
  console.log(`map=80x45 tile=32x32 layers=12 nodes=${nodes.length} edges=${edges.length} collision=${collision.length} doors=${dynamicDoors.length}`);
  console.log(`distances=L1:${lengths.L1.toFixed(3)} L2:${lengths.L2.toFixed(3)} R1:${lengths.R1.toFixed(3)} R2:${lengths.R2.toFixed(3)} tiles ratio=${ratio.toFixed(4)} spread=${spread.toFixed(3)}`);
  console.log('rooms=PASS guards=4 guardBypass=BLOCKED bossPolicy=SEEDED_RANDOM_HIDDEN noBossReturns=4');
  console.log(`securityLock=PRE_BOSS_BLOCKED postBossControl=PASS goal=PASS manualTiles=${(tileset.tiles ?? []).length}`);
}
