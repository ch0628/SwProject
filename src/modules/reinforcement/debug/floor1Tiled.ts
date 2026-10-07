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
  visible?: boolean;
  opacity?: number;
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
export const OBJECT_LAYERS = ['Collision', 'NavigationNodes', 'NavigationEdges', 'EncounterZones', 'FloorTransitions', 'SpawnPoints', 'ArchitecturalMass'] as const;

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
  return { collision, nodes, edges, encounters, transitions, spawn: spawns[0], architecturalMass };
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
