import { properties, TILE_LAYERS, type TiledMapJson, type TiledObject } from './floor1Tiled.ts';

export type Floor5RoomId = 'L1' | 'L2' | 'R1' | 'R2';
export type Floor5ProbeKind = 'SEARCH' | 'NO_BOSS' | 'POST_BOSS';

const TILE_LAYER_DEPTHS: Record<(typeof TILE_LAYERS)[number], number> = { Ground: 0, FloorDetail: 1, Walls: 2, WallTop: 3, StaticProps: 4 };
const OBJECT_LAYERS = ['Collision', 'NavigationNodes', 'NavigationEdges', 'EncounterZones', 'FloorTransitions', 'SpawnPoints', 'Debug'] as const;
export const FLOOR5_ROOMS = ['L1', 'L2', 'R1', 'R2'] as const;
export const FLOOR5_REQUIRED_NODES = [
  'F5_SEARCH_HUB', 'F5_LEFT_WING', 'F5_L1_GUARD', 'F5_ROOM_L1', 'F5_L2_GUARD', 'F5_ROOM_L2',
  'F5_RIGHT_WING', 'F5_R1_GUARD', 'F5_ROOM_R1', 'F5_R2_GUARD', 'F5_ROOM_R2',
  'F5_CENTRAL_HALL', 'F5_SECURITY_LOCK', 'F5_CONTROL_ROOM', 'F5_GOAL',
] as const;
export const FLOOR5_REQUIRED_EDGES = [
  'E_F5_HUB_LEFT', 'E_F5_LEFT_L1_GUARD', 'E_F5_L1_ROOM', 'E_F5_LEFT_L2_GUARD', 'E_F5_L2_ROOM',
  'E_F5_HUB_RIGHT', 'E_F5_RIGHT_R1_GUARD', 'E_F5_R1_ROOM', 'E_F5_RIGHT_R2_GUARD', 'E_F5_R2_ROOM',
  'E_F5_L1_NO_BOSS_RETURN', 'E_F5_L2_NO_BOSS_RETURN', 'E_F5_R1_NO_BOSS_RETURN', 'E_F5_R2_NO_BOSS_RETURN',
  'E_F5_L1_POST_BOSS', 'E_F5_L2_POST_BOSS', 'E_F5_R1_POST_BOSS', 'E_F5_R2_POST_BOSS',
  'E_F5_HALL_LOCK', 'E_F5_LOCK_CONTROL', 'E_F5_CONTROL_GOAL',
] as const;

const SEARCH_EDGE_IDS: Record<Floor5RoomId, readonly string[]> = {
  L1: ['E_F5_HUB_LEFT', 'E_F5_LEFT_L1_GUARD', 'E_F5_L1_ROOM'],
  L2: ['E_F5_HUB_LEFT', 'E_F5_LEFT_L2_GUARD', 'E_F5_L2_ROOM'],
  R1: ['E_F5_HUB_RIGHT', 'E_F5_RIGHT_R1_GUARD', 'E_F5_R1_ROOM'],
  R2: ['E_F5_HUB_RIGHT', 'E_F5_RIGHT_R2_GUARD', 'E_F5_R2_ROOM'],
};

const layerObjects = (map: TiledMapJson, name: string) => {
  const layer = map.layers.find(candidate => candidate.name === name && candidate.type === 'objectgroup');
  if (!layer) throw new Error(`Floor 5 debug: required object layer "${name}" is missing`);
  return layer.objects ?? [];
};

const absolutePoints = (edge: TiledObject) => (edge.polyline ?? []).map(point => ({ x: edge.x + point.x, y: edge.y + point.y }));
const pointKey = (point: { x: number; y: number }) => `${point.x},${point.y}`;
const combineEdges = (edges: TiledObject[], ids: readonly string[]) => ids.flatMap((id, index) => {
  const edge = edges.find(candidate => properties(candidate).edgeId === id);
  if (!edge) throw new Error(`Floor 5 debug: required edge "${id}" is missing`);
  return absolutePoints(edge).slice(index ? 1 : 0);
});
const polylineLength = (points: { x: number; y: number }[]) => points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);

export const floor5TileDepth = (layer: (typeof TILE_LAYERS)[number], manual: boolean) => TILE_LAYER_DEPTHS[layer] + (manual ? 6 : 0);
export const missingFloor5TextureMessage = (assetId: string) =>
  `Floor 5 debug: manual tile class "${assetId}" is used by TMJ but texture is not loaded. Add "${assetId}" to ASSET_IDS.`;
export const missingFloor5PngMessage = (assetId: string) =>
  `Floor 5 debug: "${assetId}" is listed in ASSET_IDS but its PNG failed to load from floor5_room_shell_manual/${assetId}.png.`;

export function floor5ProbePoints(edges: TiledObject[], room: Floor5RoomId, kind: Floor5ProbeKind) {
  if (kind === 'SEARCH') return combineEdges(edges, SEARCH_EDGE_IDS[room]);
  if (kind === 'NO_BOSS') return combineEdges(edges, [`E_F5_${room}_NO_BOSS_RETURN`]);
  return combineEdges(edges, [`E_F5_${room}_POST_BOSS`, 'E_F5_HALL_LOCK', 'E_F5_LOCK_CONTROL', 'E_F5_CONTROL_GOAL']);
}

export function floor5RoomPathLengths(edges: TiledObject[]) {
  return Object.fromEntries(FLOOR5_ROOMS.map(room => [room, polylineLength(floor5ProbePoints(edges, room, 'SEARCH')) / 32])) as Record<Floor5RoomId, number>;
}

export function validateFloor5Map(map: TiledMapJson) {
  if (map.width !== 80 || map.height !== 45) throw new Error(`Floor 5 debug: expected map 80x45, got ${map.width}x${map.height}`);
  if (map.tilewidth !== 32 || map.tileheight !== 32) throw new Error(`Floor 5 debug: expected tiles 32x32, got ${map.tilewidth}x${map.tileheight}`);
  for (const name of TILE_LAYERS) if (!map.layers.some(layer => layer.name === name && layer.type === 'tilelayer')) throw new Error(`Floor 5 debug: required tile layer "${name}" is missing`);
  for (const name of OBJECT_LAYERS) layerObjects(map, name);

  const nodes = layerObjects(map, 'NavigationNodes');
  const nodeIds = nodes.map(node => properties(node).nodeId);
  if (nodes.length !== FLOOR5_REQUIRED_NODES.length || new Set(nodeIds).size !== nodes.length || FLOOR5_REQUIRED_NODES.some(id => !nodeIds.includes(id))) {
    throw new Error('Floor 5 debug: required 15 navigation nodes are invalid');
  }
  const nodeById = new Map(nodes.map(node => [properties(node).nodeId, node]));
  const edges = layerObjects(map, 'NavigationEdges');
  const edgeIds = edges.map(edge => properties(edge).edgeId);
  if (edges.length !== FLOOR5_REQUIRED_EDGES.length || new Set(edgeIds).size !== edges.length || FLOOR5_REQUIRED_EDGES.some(id => !edgeIds.includes(id))) {
    throw new Error('Floor 5 debug: required 21 navigation edges are invalid');
  }
  for (const edge of edges) {
    const values = properties(edge);
    const points = absolutePoints(edge);
    const from = nodeById.get(values.from);
    const to = nodeById.get(values.to);
    if (!from || !to || pointKey(points[0]) !== pointKey(from) || pointKey(points.at(-1)!) !== pointKey(to)) throw new Error(`Floor 5 debug: edge ${edge.name} endpoints are invalid`);
  }

  const encounters = layerObjects(map, 'EncounterZones');
  if (encounters.length !== 4 || FLOOR5_ROOMS.some(room => {
    const guard = encounters.find(item => properties(item).roomId === room);
    const values = guard ? properties(guard) : {};
    return !guard || values.encounterType !== 'VILLAIN_ENCOUNTER' || values.villainCount !== 1 || values.bypassAvailable !== false;
  })) throw new Error('Floor 5 debug: four room guard encounters are invalid');

  const debug = layerObjects(map, 'Debug');
  const rooms = debug.filter(object => object.type === 'SearchRoom');
  if (rooms.length !== 4 || FLOOR5_ROOMS.some(room => !rooms.some(object => properties(object).roomId === room && properties(object).walkable === true))) {
    throw new Error('Floor 5 debug: four walkable Search Room regions are invalid');
  }
  const spawns = layerObjects(map, 'SpawnPoints');
  const spawn = spawns.find(object => properties(object).spawnId === 'F5_SEARCH_HUB');
  if (!spawn || spawns.length !== 1) throw new Error('Floor 5 debug: F5_SEARCH_HUB spawn is invalid');
  if (layerObjects(map, 'FloorTransitions').length !== 0) throw new Error('Floor 5 debug: Floor 5 must not add an upward transition');

  const collision = layerObjects(map, 'Collision');
  const securityLock = collision.find(object => object.name === 'F5_SECURITY_LOCK_BARRIER');
  const lockValues = securityLock ? properties(securityLock) : {};
  if (!securityLock || lockValues.dynamicLock !== true || lockValues.requiresState !== 'BOSS_NEUTRALIZED') throw new Error('Floor 5 debug: Security Lock barrier contract is invalid');
  const lengths = floor5RoomPathLengths(edges);
  const values = Object.values(lengths);
  const ratio = Math.max(...values) / Math.min(...values);
  const spread = Math.max(...values) - Math.min(...values);
  if (ratio > 1.05 && spread > 2) throw new Error(`Floor 5 debug: room path distance bias exceeds policy (ratio=${ratio.toFixed(4)}, spread=${spread.toFixed(3)})`);

  return { collision, securityLock, nodes, edges, encounters, rooms, spawn, lengths, ratio, spread };
}
