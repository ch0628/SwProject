import { properties, TILE_LAYERS, type TiledMapJson, type TiledObject } from './floor1Tiled.ts';

export type Floor3RouteId = 'F3_LEFT_MAINTENANCE_ROUTE' | 'F3_RIGHT_PERIMETER_ROUTE';
export type Floor3StairSide = 'LEFT' | 'RIGHT';

const TILE_LAYER_DEPTHS: Record<(typeof TILE_LAYERS)[number], number> = { Ground: 0, FloorDetail: 1, Walls: 2, WallTop: 3, StaticProps: 4 };

// Final F3 manual art must render above the opaque blockout layers and color guide.
export const floor3TileDepth = (layer: (typeof TILE_LAYERS)[number], manual: boolean) => TILE_LAYER_DEPTHS[layer] + (manual ? 6 : 0);

const OBJECT_LAYERS = ['Collision', 'NavigationNodes', 'NavigationEdges', 'EncounterZones', 'FloorTransitions', 'SpawnPoints', 'Debug'] as const;
const REQUIRED_NODES = [
  'F3_CENTER_ARRIVAL', 'F3_LEFT_MAINT_ZONE', 'F3_LEFT_GUARD', 'F3_LEFT_STAIR',
  'F3_RIGHT_PERIMETER_ZONE', 'F3_RIGHT_GUARD', 'F3_RIGHT_STAIR',
] as const;

export const FLOOR3_CLEAR_AREAS = {
  CENTER: { x: 1088, y: 1216, width: 384, height: 160 },
  LEFT: { x: 448, y: 96, width: 384, height: 352 },
  RIGHT: { x: 1984, y: 96, width: 384, height: 288 },
} as const;

const layerObjects = (map: TiledMapJson, name: string) => {
  const layer = map.layers.find(candidate => candidate.name === name && candidate.type === 'objectgroup');
  if (!layer) throw new Error(`Floor 3 debug: required object layer "${name}" is missing`);
  return layer.objects ?? [];
};

const overlaps = (left: Pick<TiledObject, 'x' | 'y' | 'width' | 'height'>, right: Pick<TiledObject, 'x' | 'y' | 'width' | 'height'>) =>
  left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;

export function validateFloor3Map(map: TiledMapJson) {
  if (map.width !== 80 || map.height !== 45) throw new Error(`Floor 3 debug: expected map 80x45, got ${map.width}x${map.height}`);
  if (map.tilewidth !== 32 || map.tileheight !== 32) throw new Error(`Floor 3 debug: expected tiles 32x32, got ${map.tilewidth}x${map.tileheight}`);
  for (const name of TILE_LAYERS) {
    if (!map.layers.some(layer => layer.name === name && layer.type === 'tilelayer')) throw new Error(`Floor 3 debug: required tile layer "${name}" is missing`);
  }
  for (const name of OBJECT_LAYERS) layerObjects(map, name);

  const collision = layerObjects(map, 'Collision');
  for (const [name, area] of Object.entries(FLOOR3_CLEAR_AREAS)) {
    if (collision.some(object => overlaps(object, area))) throw new Error(`Floor 3 debug: ${name.toLowerCase()} stair area must be collision-free`);
  }
  const nodes = layerObjects(map, 'NavigationNodes');
  const nodeIds = nodes.map(node => properties(node).nodeId);
  if (nodes.length !== REQUIRED_NODES.length || REQUIRED_NODES.some(nodeId => !nodeIds.includes(nodeId))) {
    throw new Error('Floor 3 debug: required navigation nodes are invalid');
  }
  const edges = layerObjects(map, 'NavigationEdges');
  if (edges.length !== 6) throw new Error(`Floor 3 debug: expected 6 edges, got ${edges.length}`);
  const encounters = layerObjects(map, 'EncounterZones');
  const obstacles = encounters.filter(object => properties(object).encounterType === 'OBSTACLE');
  if (obstacles.length !== 4) throw new Error(`Floor 3 debug: expected 4 obstacle zones, got ${obstacles.length}`);
  for (const side of ['LEFT', 'RIGHT'] as const) {
    const guard = encounters.find(object => object.name === `F3_${side}_GUARD_ZONE`);
    if (!guard || properties(guard).villainCount !== 2 || properties(guard).bypassAvailable !== false) {
      throw new Error(`Floor 3 debug: ${side.toLowerCase()} guard contract is invalid`);
    }
  }
  const transitions = layerObjects(map, 'FloorTransitions');
  if (transitions.length !== 2) throw new Error(`Floor 3 debug: expected 2 transitions, got ${transitions.length}`);
  const spawn = layerObjects(map, 'SpawnPoints').find(object => properties(object).spawnId === 'F3_CENTER_ARRIVAL');
  if (!spawn || properties(spawn).routeContextId !== 'F3_STAIR_SPLIT') throw new Error('Floor 3 debug: center arrival spawn is invalid');
  const debug = layerObjects(map, 'Debug');
  if (debug.filter(object => object.type === 'StairFootprint').length !== 3) throw new Error('Floor 3 debug: expected exactly three stair footprints');
  if (!collision.some(object => object.name === 'F3_GREEN_FACILITY_ROOM' && properties(object).enterable === false)) {
    throw new Error('Floor 3 debug: sealed facility room collision is missing');
  }
  return { collision, nodes, edges, encounters, transitions, spawn };
}

export function floor3RoutePoints(edges: TiledObject[], route: Floor3RouteId) {
  const remaining = edges.filter(edge => properties(edge).route === route);
  const ordered: TiledObject[] = [];
  let current: unknown = 'F3_CENTER_ARRIVAL';
  while (remaining.length) {
    const index = remaining.findIndex(edge => properties(edge).from === current);
    if (index < 0) throw new Error(`Floor 3 debug: route ${route} is disconnected at ${String(current)}`);
    const [edge] = remaining.splice(index, 1);
    ordered.push(edge);
    current = properties(edge).to;
  }
  if (ordered.length !== 3) throw new Error(`Floor 3 debug: route ${route} must have three ordered edges`);
  return ordered.flatMap((edge, index) => (edge.polyline ?? []).slice(index ? 1 : 0).map(point => ({ x: edge.x + point.x, y: edge.y + point.y })));
}

export const missingFloor3TextureMessage = (assetId: string) =>
  `Floor 3 debug: manual tile class "${assetId}" is used by TMJ but texture is not loaded. Add "${assetId}" to ASSET_IDS.`;
