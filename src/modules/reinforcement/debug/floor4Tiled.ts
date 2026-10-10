import { properties, TILE_LAYERS, type TiledMapJson, type TiledObject } from './floor1Tiled.ts';

export type Floor4SpawnSide = 'LEFT' | 'RIGHT';
export type Floor4RouteId = 'F4_SECURITY_HALL_ROUTE' | 'F4_PERIMETER_DETOUR_ROUTE' | 'F4_INNER_SECURITY_ROUTE' | 'F4_SERVICE_ROUTE';

const TILE_LAYER_DEPTHS: Record<(typeof TILE_LAYERS)[number], number> = { Ground: 0, FloorDetail: 1, Walls: 2, WallTop: 3, StaticProps: 4 };
const OBJECT_LAYERS = ['Collision', 'NavigationNodes', 'NavigationEdges', 'EncounterZones', 'FloorTransitions', 'SpawnPoints', 'Debug'] as const;
const REQUIRED_NODES = [
  'F4_LEFT_ARRIVAL', 'F4_LEFT_SECURITY_ZONE', 'F4_LEFT_PERIMETER_ZONE',
  'F4_RIGHT_ARRIVAL', 'F4_RIGHT_INNER_ZONE', 'F4_RIGHT_SERVICE_ZONE',
  'F4_CENTER_GUARD', 'F4_CENTER_STAIR',
] as const;

export const FLOOR4_CLEAR_AREAS = {
  LEFT: { x: 96, y: 1056, width: 512, height: 128 },
  RIGHT: { x: 1952, y: 1056, width: 480, height: 128 },
  CENTER: { x: 1088, y: 64, width: 352, height: 272 },
} as const;

export const floor4TileDepth = (layer: (typeof TILE_LAYERS)[number], manual: boolean) => TILE_LAYER_DEPTHS[layer] + (manual ? 6 : 0);

const layerObjects = (map: TiledMapJson, name: string) => {
  const layer = map.layers.find(candidate => candidate.name === name && candidate.type === 'objectgroup');
  if (!layer) throw new Error(`Floor 4 debug: required object layer "${name}" is missing`);
  return layer.objects ?? [];
};

const overlaps = (left: Pick<TiledObject, 'x' | 'y' | 'width' | 'height'>, right: Pick<TiledObject, 'x' | 'y' | 'width' | 'height'>) =>
  left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;

export function validateFloor4Map(map: TiledMapJson) {
  if (map.width !== 80 || map.height !== 45) throw new Error(`Floor 4 debug: expected map 80x45, got ${map.width}x${map.height}`);
  if (map.tilewidth !== 32 || map.tileheight !== 32) throw new Error(`Floor 4 debug: expected tiles 32x32, got ${map.tilewidth}x${map.tileheight}`);
  for (const name of TILE_LAYERS) {
    if (!map.layers.some(layer => layer.name === name && layer.type === 'tilelayer')) throw new Error(`Floor 4 debug: required tile layer "${name}" is missing`);
  }
  for (const name of OBJECT_LAYERS) layerObjects(map, name);

  const collision = layerObjects(map, 'Collision');
  for (const [name, area] of Object.entries(FLOOR4_CLEAR_AREAS)) {
    if (collision.some(object => overlaps(object, area))) throw new Error(`Floor 4 debug: ${name.toLowerCase()} stair area must be collision-free`);
  }
  const nodes = layerObjects(map, 'NavigationNodes');
  const nodeIds = nodes.map(node => properties(node).nodeId);
  if (nodes.length !== REQUIRED_NODES.length || REQUIRED_NODES.some(nodeId => !nodeIds.includes(nodeId))) throw new Error('Floor 4 debug: required navigation nodes are invalid');
  const edges = layerObjects(map, 'NavigationEdges');
  if (edges.length !== 9) throw new Error(`Floor 4 debug: expected 9 edges, got ${edges.length}`);
  const encounters = layerObjects(map, 'EncounterZones');
  const guard = encounters.find(object => object.name === 'F4_CENTER_GUARD_ZONE');
  if (!guard || properties(guard).villainCount !== 2 || properties(guard).bypassAvailable !== false) throw new Error('Floor 4 debug: center guard contract is invalid');
  const transitions = layerObjects(map, 'FloorTransitions');
  if (transitions.length !== 1 || properties(transitions[0]).targetFloor !== 5 || properties(transitions[0]).targetSpawn !== 'F5_SEARCH_HUB') {
    throw new Error('Floor 4 debug: center stair transition is invalid');
  }
  const spawns = layerObjects(map, 'SpawnPoints');
  const leftSpawn = spawns.find(object => properties(object).spawnId === 'F4_LEFT_ARRIVAL');
  const rightSpawn = spawns.find(object => properties(object).spawnId === 'F4_RIGHT_ARRIVAL');
  if (!leftSpawn || !rightSpawn || spawns.length !== 2) throw new Error('Floor 4 debug: LEFT/RIGHT arrival spawns are invalid');
  if (!collision.some(object => object.name === 'F4_LEFT_ROOM_MASS') || !collision.some(object => object.name === 'F4_RIGHT_ROOM_MASS')) {
    throw new Error('Floor 4 debug: sealed security room collision is missing');
  }
  if (layerObjects(map, 'Debug').filter(object => object.type === 'StairFootprint').length !== 3) throw new Error('Floor 4 debug: expected exactly three stair footprints');
  return { collision, nodes, edges, encounters, transitions, spawns: { LEFT: leftSpawn, RIGHT: rightSpawn } satisfies Record<Floor4SpawnSide, TiledObject> };
}

export function floor4RoutePoints(edges: TiledObject[], route: Floor4RouteId) {
  const remaining = edges.filter(edge => properties(edge).route === route);
  const first = remaining.find(edge => String(properties(edge).from).endsWith('_ARRIVAL'));
  if (!first || remaining.length !== 2) throw new Error(`Floor 4 debug: route ${route} must have two ordered edges`);
  const ordered: TiledObject[] = [];
  let current = properties(first).from;
  while (remaining.length) {
    const index = remaining.findIndex(edge => properties(edge).from === current);
    if (index < 0) throw new Error(`Floor 4 debug: route ${route} is disconnected at ${String(current)}`);
    const [edge] = remaining.splice(index, 1);
    ordered.push(edge);
    current = properties(edge).to;
  }
  return ordered.flatMap((edge, index) => (edge.polyline ?? []).slice(index ? 1 : 0).map(point => ({ x: edge.x + point.x, y: edge.y + point.y })));
}

export function spawnSideFromSearch(search: string): Floor4SpawnSide {
  return new URLSearchParams(search).get('spawn')?.toUpperCase() === 'RIGHT' ? 'RIGHT' : 'LEFT';
}

export const missingFloor4TextureMessage = (assetId: string) =>
  `Floor 4 debug: manual tile class "${assetId}" is used by TMJ but texture is not loaded. Add "${assetId}" to ASSET_IDS.`;

export const missingFloor4PngMessage = (assetId: string) =>
  `Floor 4 debug: "${assetId}" is listed in ASSET_IDS but its PNG failed to load from floor4_room_shell_manual/${assetId}.png.`;
