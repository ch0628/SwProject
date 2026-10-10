import { objectLayer, properties, TILE_LAYERS, type TiledMapJson, type TiledObject } from './floor1Tiled.ts';

export type Floor2SpawnSide = 'LEFT' | 'RIGHT';
export type Floor2RouteId = 'F2_DIRECT_OFFICE_ROUTE' | 'F2_OUTER_CORRIDOR_ROUTE' | 'F2_INNER_HALL_ROUTE' | 'F2_SERVICE_DETOUR_ROUTE';
const OBJECT_LAYERS = ['Collision', 'NavigationNodes', 'NavigationEdges', 'EncounterZones', 'FloorTransitions', 'SpawnPoints', 'Debug'] as const;

export function validateFloor2Map(map: TiledMapJson) {
  if (map.width !== 80 || map.height !== 45) throw new Error(`Floor 2 debug: expected map 80x45, got ${map.width}x${map.height}`);
  if (map.tilewidth !== 32 || map.tileheight !== 32) throw new Error(`Floor 2 debug: expected tiles 32x32, got ${map.tilewidth}x${map.tileheight}`);
  for (const name of TILE_LAYERS) {
    if (!map.layers.some(layer => layer.name === name && layer.type === 'tilelayer')) throw new Error(`Floor 2 debug: required tile layer "${name}" is missing`);
  }
  for (const name of OBJECT_LAYERS) objectLayer(map, name);

  const collision = objectLayer(map, 'Collision');
  if (collision.some(object => object.x < 1440 && object.x + object.width > 1088 && object.y < 256 && object.y + object.height > 64)) {
    throw new Error('Floor 2 debug: center stair area (1088,64)-(1440,256) must be collision-free');
  }
  const nodes = objectLayer(map, 'NavigationNodes');
  const edges = objectLayer(map, 'NavigationEdges');
  const encounters = objectLayer(map, 'EncounterZones');
  const transitions = objectLayer(map, 'FloorTransitions');
  const debug = objectLayer(map, 'Debug');
  const spawns = objectLayer(map, 'SpawnPoints');
  const leftSpawn = spawns.find(object => properties(object).spawnId === 'F2_LEFT_ARRIVAL');
  const rightSpawn = spawns.find(object => properties(object).spawnId === 'F2_RIGHT_ARRIVAL');
  if (!leftSpawn || !rightSpawn || spawns.length !== 2) throw new Error('Floor 2 debug: LEFT/RIGHT arrival spawns are invalid');
  if (nodes.length !== 8 || edges.length !== 9) throw new Error(`Floor 2 debug: expected 8 nodes/9 edges, got ${nodes.length}/${edges.length}`);
  if (!collision.some(object => object.name === 'F2_CENTRAL_BLOCKED_MASS')) throw new Error('Floor 2 debug: central blocked mass is missing');
  for (const name of ['F2_LEFT_ROOM_MASS', 'F2_RIGHT_ROOM_MASS', 'F2_LEFT_ROOM_DOOR_LOCKED', 'F2_RIGHT_ROOM_DOOR_LOCKED']) {
    if (!collision.some(object => object.name === name)) throw new Error(`Floor 2 debug: ${name} is missing`);
  }
  const guard = encounters.find(object => object.name === 'F2_CENTER_GUARD_ZONE');
  if (!guard || properties(guard).villainCount !== 2 || properties(guard).bypassAvailable !== false) throw new Error('Floor 2 debug: center guard contract is invalid');
  if (transitions.length !== 1 || properties(transitions[0]).targetSpawn !== 'F3_CENTER_ARRIVAL') throw new Error('Floor 2 debug: center stair transition is invalid');
  if (debug.filter(object => object.type === 'StairFootprint').length !== 3) throw new Error('Floor 2 debug: expected exactly three stair footprints');
  return { collision, nodes, edges, encounters, transitions, spawns: { LEFT: leftSpawn, RIGHT: rightSpawn } satisfies Record<Floor2SpawnSide, TiledObject> };
}

export function floor2RoutePoints(edges: TiledObject[], route: Floor2RouteId) {
  const remaining = edges.filter(edge => properties(edge).route === route);
  const first = remaining.find(edge => String(properties(edge).from).endsWith('_ARRIVAL'));
  if (!first || remaining.length !== 2) throw new Error(`Floor 2 debug: route ${route} must have two ordered edges`);
  const ordered: TiledObject[] = [];
  let current = properties(first).from;
  while (remaining.length) {
    const index = remaining.findIndex(edge => properties(edge).from === current);
    if (index < 0) throw new Error(`Floor 2 debug: route ${route} is disconnected at ${String(current)}`);
    const [edge] = remaining.splice(index, 1);
    ordered.push(edge);
    current = properties(edge).to;
  }
  return ordered.flatMap((edge, index) => (edge.polyline ?? []).slice(index ? 1 : 0).map(point => ({ x: edge.x + point.x, y: edge.y + point.y })));
}

export function spawnSideFromSearch(search: string): Floor2SpawnSide {
  return new URLSearchParams(search).get('spawn')?.toUpperCase() === 'RIGHT' ? 'RIGHT' : 'LEFT';
}
