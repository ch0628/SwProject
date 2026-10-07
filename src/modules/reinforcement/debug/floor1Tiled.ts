export type TiledProperty = { name: string; value: unknown };
export type TiledObject = {
  id: number;
  name: string;
  type?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  polyline?: { x: number; y: number }[];
  properties?: TiledProperty[];
};
export type TiledLayer = {
  name: string;
  type: string;
  width?: number;
  height?: number;
  data?: string | number[];
  encoding?: string;
  compression?: string;
  objects?: TiledObject[];
};
export type TiledMapJson = {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: ({ firstgid: number; source?: string } & Record<string, unknown>)[];
};

export const TILE_LAYERS = ['Ground', 'FloorDetail', 'Walls', 'WallTop', 'StaticProps'] as const;
export const OBJECT_LAYERS = ['Collision', 'NavigationNodes', 'NavigationEdges', 'EncounterZones', 'FloorTransitions', 'SpawnPoints', 'CameraZones', 'ArchitecturalMass'] as const;
export const CAMERA_ZONE_IDS = [
  'F1_CAM_LOBBY',
  'F1_CAM_LEFT_HORIZONTAL',
  'F1_CAM_LEFT_VERTICAL',
  'F1_CAM_LEFT_STAIR',
  'F1_CAM_RIGHT_LOWER',
  'F1_CAM_RIGHT_MIDDLE',
  'F1_CAM_RIGHT_UPPER',
  'F1_CAM_RIGHT_STAIR',
] as const;

export function properties(object: TiledObject): Record<string, unknown> {
  return Object.fromEntries((object.properties ?? []).map(({ name, value }) => [name, value]));
}

export function objectLayer(map: TiledMapJson, name: string): TiledObject[] {
  const layer = map.layers.find(candidate => candidate.name === name && candidate.type === 'objectgroup');
  if (!layer) throw new Error(`Floor 1 debug: required object layer "${name}" is missing`);
  return layer.objects ?? [];
}

export function validateFloor1Map(map: TiledMapJson) {
  if (map.width !== 80 || map.height !== 45) throw new Error(`Floor 1 debug: expected map 80x45, got ${map.width}x${map.height}`);
  if (map.tilewidth !== 32 || map.tileheight !== 32) throw new Error(`Floor 1 debug: expected tiles 32x32, got ${map.tilewidth}x${map.tileheight}`);

  for (const name of TILE_LAYERS) {
    if (!map.layers.some(layer => layer.name === name && layer.type === 'tilelayer')) {
      throw new Error(`Floor 1 debug: required tile layer "${name}" is missing`);
    }
  }
  for (const name of OBJECT_LAYERS) objectLayer(map, name);

  const collision = objectLayer(map, 'Collision');
  const nodes = objectLayer(map, 'NavigationNodes');
  const edges = objectLayer(map, 'NavigationEdges');
  const encounters = objectLayer(map, 'EncounterZones');
  const transitions = objectLayer(map, 'FloorTransitions');
  const cameraZones = objectLayer(map, 'CameraZones');
  const architecturalMass = objectLayer(map, 'ArchitecturalMass');
  const spawns = objectLayer(map, 'SpawnPoints').filter(object => object.name === 'F1_ROBOT_SPAWN');
  if (spawns.length !== 1) throw new Error(`Floor 1 debug: expected exactly one F1_ROBOT_SPAWN, found ${spawns.length}`);
  if (transitions.length !== 2) throw new Error(`Floor 1 debug: expected exactly two FloorTransitions, found ${transitions.length}`);

  const split = nodes.find(object => object.name === 'F1_ENTRY_SPLIT');
  if (!split) throw new Error('Floor 1 debug: F1_ENTRY_SPLIT is missing');
  if (split.x !== 1274 || split.y !== 1042) throw new Error(`Floor 1 debug: F1_ENTRY_SPLIT must be (1274, 1042), got (${split.x}, ${split.y})`);
  for (const wall of ['WALL_45_1', 'WALL_45_2']) {
    if (!collision.some(object => object.name === wall)) throw new Error(`Floor 1 debug: ${wall} is missing`);
  }
  if (cameraZones.length !== CAMERA_ZONE_IDS.length) throw new Error(`Floor 1 debug: expected ${CAMERA_ZONE_IDS.length} CameraZones, found ${cameraZones.length}`);
  for (const cameraZoneId of CAMERA_ZONE_IDS) {
    const zone = cameraZones.find(object => properties(object).cameraZoneId === cameraZoneId);
    if (!zone || properties(zone).floor !== 1) throw new Error(`Floor 1 debug: invalid CameraZone ${cameraZoneId}`);
    if (!architecturalMass.some(object => properties(object).cameraZoneId === cameraZoneId)) throw new Error(`Floor 1 debug: missing ArchitecturalMass for ${cameraZoneId}`);
  }

  return { collision, nodes, edges, encounters, transitions, spawn: spawns[0], cameraZones, architecturalMass };
}

export function embedTileset(map: TiledMapJson, tileset: Record<string, unknown>): TiledMapJson {
  if (map.tilesets.length !== 1 || !map.tilesets[0].source) throw new Error('Floor 1 debug: expected one external tileset reference');
  return { ...map, tilesets: [{ ...tileset, firstgid: map.tilesets[0].firstgid }] };
}

export async function decompressTileLayers(map: TiledMapJson): Promise<TiledMapJson> {
  const layers = await Promise.all(map.layers.map(async layer => {
    if (layer.type !== 'tilelayer' || typeof layer.data !== 'string') return layer;
    if (layer.encoding !== 'base64' || layer.compression !== 'zlib') {
      throw new Error(`Floor 1 debug: unsupported tile encoding ${layer.encoding ?? 'none'}/${layer.compression ?? 'none'} in ${layer.name}`);
    }
    const compressed = Uint8Array.from(atob(layer.data), character => character.charCodeAt(0));
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const expected = (layer.width ?? map.width) * (layer.height ?? map.height) * 4;
    if (bytes.byteLength !== expected) throw new Error(`Floor 1 debug: ${layer.name} expanded to ${bytes.byteLength} bytes, expected ${expected}`);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const data = Array.from({ length: bytes.byteLength / 4 }, (_, index) => view.getUint32(index * 4, true));
    const { encoding: _encoding, compression: _compression, ...expanded } = layer;
    return { ...expanded, data };
  }));
  return { ...map, layers };
}

export function contains(object: TiledObject, x: number, y: number) {
  return x >= object.x && x <= object.x + object.width && y >= object.y && y <= object.y + object.height;
}

export function cameraCenterForTarget(targetX: number, targetY: number, viewportWidth: number, viewportHeight: number, zoom: number, bounds: Pick<TiledObject, 'x' | 'y' | 'width' | 'height'>) {
  const halfVisibleWidth = viewportWidth / zoom / 2;
  const halfVisibleHeight = viewportHeight / zoom / 2;
  const minX = bounds.x + halfVisibleWidth;
  const maxX = bounds.x + bounds.width - halfVisibleWidth;
  const minY = bounds.y + halfVisibleHeight;
  const maxY = bounds.y + bounds.height - halfVisibleHeight;
  return {
    x: minX <= maxX ? Math.min(Math.max(targetX, minX), maxX) : bounds.x + bounds.width / 2,
    y: minY <= maxY ? Math.min(Math.max(targetY, minY), maxY) : bounds.y + bounds.height / 2,
  };
}

export function resolveCameraZone(zones: TiledObject[], previous: TiledObject | null, x: number, y: number) {
  const candidates = zones.filter(zone => contains(zone, x, y));
  if (previous && candidates.includes(previous)) return previous;
  const choices = candidates.length ? candidates : zones;
  return choices.reduce<TiledObject | null>((nearest, zone) => {
    if (!nearest) return zone;
    const distance = (zone.x + zone.width / 2 - x) ** 2 + (zone.y + zone.height / 2 - y) ** 2;
    const nearestDistance = (nearest.x + nearest.width / 2 - x) ** 2 + (nearest.y + nearest.height / 2 - y) ** 2;
    return distance < nearestDistance ? zone : nearest;
  }, null);
}
