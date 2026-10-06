import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

// WARNING: floor_1_blockout.tmj contains manual Tiled edits and is now the source of truth.
// Do not regenerate that map from this legacy bootstrap script.

const WIDTH = 80;
const HEIGHT = 45;
const TILE = 32;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "../..");
const mapDir = resolve(root, "public/maps/reinforcement");
const imageDir = resolve(root, "public/assets/environment/reinforcement/blockout");
const mapPath = resolve(mapDir, "floor_1_blockout.tmj");
const tilesetPath = resolve(mapDir, "reinforcement_blockout_tileset.tsj");
const imagePath = resolve(imageDir, "reinforcement_blockout_tiles.png");
const force = process.argv.includes("--force");

for (const path of [mapPath, tilesetPath, imagePath]) {
  if (!force && existsSync(path)) throw new Error(`refusing to overwrite ${path}; pass --force for an intentional rebuild`);
}
mkdirSync(mapDir, { recursive: true });
mkdirSync(imageDir, { recursive: true });

const index = (x, y) => y * WIDTH + x;
const grid = () => Array(WIDTH * HEIGHT).fill(0);
const fill = (data, x0, y0, x1, y1, value) => {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) data[index(x, y)] = value;
  }
};
const property = (name, value) => ({
  name,
  type: typeof value === "boolean" ? "bool" : Number.isInteger(value) ? "int" : typeof value === "number" ? "float" : "string",
  value,
});
const properties = (values) => Object.entries(values).map(([name, value]) => property(name, value));
const tileData = (data) => ({
  compression: "zlib",
  data: deflateSync(Buffer.from(Uint32Array.from(data).buffer)).toString("base64"),
  encoding: "base64",
});

const ground = grid();
for (const area of [
  [36, 42, 43, 44], // main entrance
  [36, 39, 43, 42], // vestibule
  [22, 31, 57, 41], // lobby
  [22, 30, 27, 32], // left entrance
  [9, 28, 27, 33],
  [9, 10, 14, 33],
  [8, 8, 15, 11],
  [8, 2, 15, 8],
  [52, 30, 57, 32], // right entrance
  [52, 31, 70, 36],
  [65, 21, 70, 36],
  [58, 19, 70, 24],
  [58, 9, 63, 24],
  [58, 8, 71, 13],
  [64, 8, 71, 11],
  [64, 2, 71, 8],
]) fill(ground, ...area, 1);

const floorDetail = grid();
fill(floorDetail, 8, 2, 15, 8, 6);
fill(floorDetail, 64, 2, 71, 8, 6);
fill(floorDetail, 8, 9, 15, 11, 2);
fill(floorDetail, 64, 9, 71, 11, 2);
for (const room of [
  [28, 11, 38, 18],
  [28, 21, 38, 30],
  [41, 11, 51, 20],
  [41, 23, 51, 30],
]) fill(floorDetail, ...room, 7);

const boundary = grid();
for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    if (ground[index(x, y)]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ground[index(x + dx, y + dy)])) {
      boundary[index(x, y)] = 3;
    }
  }
}
// Central core wall shell: four locked rooms, no cross-passage.
for (let x = 28; x <= 51; x += 1) {
  boundary[index(x, 10)] = 3;
  boundary[index(x, 30)] = 3;
}
for (let y = 10; y <= 30; y += 1) {
  boundary[index(28, y)] = 3;
  boundary[index(51, y)] = 3;
}
for (let y = 10; y <= 30; y += 1) boundary[index(39, y)] = 3;
for (let x = 28; x <= 51; x += 1) boundary[index(x, 20)] = 3;
for (let x = 41; x <= 51; x += 1) boundary[index(x, 22)] = 3;

const wallTop = grid();
for (let y = 0; y < HEIGHT - 1; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    if (boundary[index(x, y)] && ground[index(x, y + 1)]) wallTop[index(x, y)] = 4;
  }
}

const staticProps = grid();
fill(staticProps, 36, 34, 43, 35, 5); // reception desk
fill(staticProps, 24, 36, 24, 38, 5); // west sofa
fill(staticProps, 27, 40, 29, 40, 5); // south sofa
fill(staticProps, 30, 39, 31, 39, 5); // low table
fill(staticProps, 34, 30, 45, 30, 5); // company information wall
for (const [x0, y0, x1, y1] of [
  [28, 14, 28, 15],
  [33, 30, 34, 30],
  [51, 14, 51, 15],
  [51, 25, 51, 26],
]) fill(staticProps, x0, y0, x1, y1, 5);

let objectId = 1;
const object = (name, className, x, y, width = 0, height = 0, values = {}, extra = {}) => ({
  id: objectId++,
  name,
  class: className,
  x,
  y,
  width,
  height,
  rotation: 0,
  visible: true,
  properties: properties(values),
  ...extra,
});
const pointObject = (name, className, tileX, tileY, values) =>
  object(name, className, tileX * TILE, tileY * TILE, 0, 0, values, { point: true });

const collisionObjects = [
  object("CENTRAL_CORE", "Collision", 28 * TILE, 10 * TILE, 24 * TILE, 21 * TILE, {
    collisionId: "CENTRAL_CORE",
    role: "CENTRAL_CORE",
    blocksRobot: true,
  }),
  object("RECEPTION_DESK", "Collision", 36 * TILE, 34 * TILE, 8 * TILE, 2 * TILE, {
    collisionId: "RECEPTION_DESK",
    role: "STATIC_PROP",
    visualHeightPx: 48,
    blocksRobot: true,
  }),
  object("WAITING_SOFA_WEST", "Collision", 24 * TILE, 36 * TILE, TILE, 3 * TILE, {
    collisionId: "WAITING_SOFA_WEST", role: "STATIC_PROP", blocksRobot: true,
  }),
  object("WAITING_SOFA_SOUTH", "Collision", 27 * TILE, 40 * TILE, 3 * TILE, TILE, {
    collisionId: "WAITING_SOFA_SOUTH", role: "STATIC_PROP", blocksRobot: true,
  }),
  object("WAITING_LOW_TABLE", "Collision", 30 * TILE, 39 * TILE, 2 * TILE, TILE, {
    collisionId: "WAITING_LOW_TABLE", role: "STATIC_PROP", blocksRobot: true,
  }),
];

const doors = [
  ["MEETING_ROOM_DOOR", 28, 14, 1, 2, "MEETING_ROOM"],
  ["BACK_OFFICE_DOOR", 33, 30, 2, 1, "RECEPTION_BACK_OFFICE"],
  ["SECURITY_OFFICE_DOOR", 51, 14, 1, 2, "VISITOR_SECURITY_OFFICE"],
  ["UTILITY_STORAGE_DOOR", 51, 25, 1, 2, "STAFF_UTILITY_STORAGE"],
];
for (const [name, x, y, width, height, roomId] of doors) {
  collisionObjects.push(object(name, "LockedDoor", x * TILE, y * TILE, width * TILE, height * TILE, {
    collisionId: name,
    roomId,
    lockedForRobot: true,
    blocksRobot: true,
  }));
}

// Coalesce non-walkable boundary tiles into horizontal collision runs.
for (let y = 0; y < HEIGHT; y += 1) {
  let x = 0;
  while (x < WIDTH) {
    while (x < WIDTH && !boundary[index(x, y)]) x += 1;
    const start = x;
    while (x < WIDTH && boundary[index(x, y)]) x += 1;
    if (start === x) continue;
    if (y >= 10 && y <= 30 && start < 52 && x > 28) continue; // central core is one explicit collider
    collisionObjects.push(object(`WALL_${y}_${start}`, "Collision", start * TILE, y * TILE, (x - start) * TILE, TILE, {
      collisionId: `WALL_${y}_${start}`,
      role: "WALL",
      blocksRobot: true,
    }));
  }
}

const nodes = [
  pointObject("F1_START", "NavigationNode", 39.5, 40.5, { nodeId: "F1_START", floor: 1, type: "START" }),
  pointObject("F1_ENTRY_SPLIT", "NavigationNode", 39.5, 32.5, {
    nodeId: "F1_ENTRY_SPLIT", floor: 1, type: "ROUTE_CHOICE", routeContextId: "F1_ENTRY_SPLIT",
  }),
  pointObject("F1_LEFT_ROUTE_A", "NavigationNode", 24.5, 31.5, {
    nodeId: "F1_LEFT_ROUTE_A", floor: 1, type: "ROUTE", routeContextId: "F1_ENTRY_SPLIT",
  }),
  pointObject("F1_LEFT_ROUTE_B", "NavigationNode", 11.5, 30.5, {
    nodeId: "F1_LEFT_ROUTE_B", floor: 1, type: "ROUTE", routeContextId: "F1_ENTRY_SPLIT",
  }),
  pointObject("F1_LEFT_STAIR", "NavigationNode", 11.5, 5.5, {
    nodeId: "F1_LEFT_STAIR", floor: 1, type: "STAIR_UP", routeContextId: "F1_ENTRY_SPLIT",
  }),
  pointObject("F1_RIGHT_ROUTE_A", "NavigationNode", 55.5, 33.5, {
    nodeId: "F1_RIGHT_ROUTE_A", floor: 1, type: "ROUTE", routeContextId: "F1_ENTRY_SPLIT",
  }),
  pointObject("F1_RIGHT_ROUTE_B", "NavigationNode", 67.5, 33.5, {
    nodeId: "F1_RIGHT_ROUTE_B", floor: 1, type: "ROUTE", routeContextId: "F1_ENTRY_SPLIT",
  }),
  pointObject("F1_RIGHT_ROUTE_C", "NavigationNode", 67.5, 21.5, {
    nodeId: "F1_RIGHT_ROUTE_C", floor: 1, type: "ROUTE", routeContextId: "F1_ENTRY_SPLIT",
  }),
  pointObject("F1_RIGHT_ROUTE_D", "NavigationNode", 60.5, 21.5, {
    nodeId: "F1_RIGHT_ROUTE_D", floor: 1, type: "ROUTE", routeContextId: "F1_ENTRY_SPLIT",
  }),
  pointObject("F1_RIGHT_STAIR", "NavigationNode", 67.5, 5.5, {
    nodeId: "F1_RIGHT_STAIR", floor: 1, type: "STAIR_UP", routeContextId: "F1_ENTRY_SPLIT",
  }),
];

const nodePosition = new Map(nodes.map((node) => [node.name, [node.x, node.y]]));
const edgeObject = (edgeId, from, to, route, tilePoints) => {
  const [originX, originY] = nodePosition.get(from);
  const absolute = [[originX / TILE, originY / TILE], ...tilePoints, nodePosition.get(to).map((value) => value / TILE)];
  const compact = absolute.filter((point, i) => i === 0 || point[0] !== absolute[i - 1][0] || point[1] !== absolute[i - 1][1]);
  const lengthTiles = compact.slice(1).reduce((sum, point, i) => {
    const previous = compact[i];
    return sum + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
  }, 0);
  return object(edgeId, "NavigationEdge", originX, originY, 0, 0, {
    edgeId, from, to, floor: 1, route, bidirectional: true, lengthTiles,
  }, {
    polyline: compact.map(([x, y]) => ({ x: x * TILE - originX, y: y * TILE - originY })),
  });
};

const edges = [
  edgeObject("E_F1_START_SPLIT", "F1_START", "F1_ENTRY_SPLIT", "COMMON", [[44.5, 40.5], [44.5, 32.5]]),
  edgeObject("E_F1_SPLIT_LEFT_A", "F1_ENTRY_SPLIT", "F1_LEFT_ROUTE_A", "LEFT_PUBLIC_ROUTE", [[27.5, 32.5], [27.5, 31.5]]),
  edgeObject("E_F1_LEFT_A_B", "F1_LEFT_ROUTE_A", "F1_LEFT_ROUTE_B", "LEFT_PUBLIC_ROUTE", []),
  edgeObject("E_F1_LEFT_B_STAIR", "F1_LEFT_ROUTE_B", "F1_LEFT_STAIR", "LEFT_PUBLIC_ROUTE", []),
  edgeObject("E_F1_SPLIT_RIGHT_A", "F1_ENTRY_SPLIT", "F1_RIGHT_ROUTE_A", "RIGHT_SERVICE_ROUTE", [[52.5, 32.5]]),
  edgeObject("E_F1_RIGHT_A_B", "F1_RIGHT_ROUTE_A", "F1_RIGHT_ROUTE_B", "RIGHT_SERVICE_ROUTE", []),
  edgeObject("E_F1_RIGHT_B_C", "F1_RIGHT_ROUTE_B", "F1_RIGHT_ROUTE_C", "RIGHT_SERVICE_ROUTE", []),
  edgeObject("E_F1_RIGHT_C_D", "F1_RIGHT_ROUTE_C", "F1_RIGHT_ROUTE_D", "RIGHT_SERVICE_ROUTE", []),
  edgeObject("E_F1_RIGHT_D_STAIR", "F1_RIGHT_ROUTE_D", "F1_RIGHT_STAIR", "RIGHT_SERVICE_ROUTE", [[60.5, 10.5], [67.5, 10.5]]),
];

const encounterZones = [
  object("F1_CITIZEN_ZONE_A", "EncounterZone", 15 * TILE, 28 * TILE, 8 * TILE, 6 * TILE, {
    zoneId: "F1_CITIZEN_ZONE_A", encounterType: "CITIZEN_NEARBY", floor: 1, route: "LEFT_PUBLIC_ROUTE",
  }),
  object("F1_CITIZEN_ZONE_B", "EncounterZone", 9 * TILE, 16 * TILE, 6 * TILE, 8 * TILE, {
    zoneId: "F1_CITIZEN_ZONE_B", encounterType: "CITIZEN_NEARBY", floor: 1, route: "LEFT_PUBLIC_ROUTE",
  }),
  object("F1_OBSTACLE_ZONE_A", "EncounterZone", 58 * TILE, 31 * TILE, 11 * TILE, 6 * TILE, {
    zoneId: "F1_OBSTACLE_ZONE_A", encounterType: "OBSTACLE", facilityDamagePossible: true, floor: 1, route: "RIGHT_SERVICE_ROUTE",
  }),
  object("F1_OBSTACLE_ZONE_B", "EncounterZone", 58 * TILE, 19 * TILE, 6 * TILE, 6 * TILE, {
    zoneId: "F1_OBSTACLE_ZONE_B", encounterType: "OBSTACLE", facilityDamagePossible: true, floor: 1, route: "RIGHT_SERVICE_ROUTE",
  }),
];

const transitions = [
  object("F1_LEFT_STAIR_TRANSITION", "FloorTransition", 8 * TILE, 2 * TILE, 8 * TILE, 2 * TILE, {
    transitionId: "F1_LEFT_STAIR_TRANSITION", floor: 1, stairId: "F1_LEFT_STAIR", targetFloor: 2, targetSpawn: "F2_LEFT_ARRIVAL",
  }),
  object("F1_RIGHT_STAIR_TRANSITION", "FloorTransition", 64 * TILE, 2 * TILE, 8 * TILE, 2 * TILE, {
    transitionId: "F1_RIGHT_STAIR_TRANSITION", floor: 1, stairId: "F1_RIGHT_STAIR", targetFloor: 2, targetSpawn: "F2_RIGHT_ARRIVAL",
  }),
];

const spawnPoints = [
  pointObject("F1_ROBOT_SPAWN", "SpawnPoint", 39.5, 40.5, { spawnId: "F1_ROBOT_SPAWN", floor: 1 }),
];
const debugObjects = [
  object("MAIN_LOBBY", "DebugArea", 22 * TILE, 31 * TILE, 36 * TILE, 11 * TILE, { debugId: "MAIN_LOBBY", label: "Main Lobby" }),
  object("CENTRAL_CORE_BOUNDS", "DebugArea", 28 * TILE, 10 * TILE, 24 * TILE, 21 * TILE, { debugId: "CENTRAL_CORE_BOUNDS", label: "Central Core / blocked" }),
  object("LEFT_ROUTE_LABEL", "DebugLabel", 9 * TILE, 27 * TILE, 0, 0, { debugId: "LEFT_ROUTE_LABEL" }, {
    text: { text: "LEFT PUBLIC ROUTE", color: "#155724", pixelsize: 22, wrap: true },
  }),
  object("RIGHT_ROUTE_LABEL", "DebugLabel", 58 * TILE, 18 * TILE, 0, 0, { debugId: "RIGHT_ROUTE_LABEL" }, {
    text: { text: "RIGHT SERVICE ROUTE", color: "#7a4a00", pixelsize: 22, wrap: true },
  }),
];

const tileLayer = (id, name, data) => ({
  id, name, type: "tilelayer", x: 0, y: 0, width: WIDTH, height: HEIGHT,
  opacity: 1, visible: true, ...tileData(data),
});
const objectLayer = (id, name, objects, color) => ({
  id, name, type: "objectgroup", draworder: "topdown", opacity: 1, visible: true, color, objects,
});

const map = {
  compressionlevel: 9,
  width: WIDTH,
  height: HEIGHT,
  tilewidth: TILE,
  tileheight: TILE,
  infinite: false,
  orientation: "orthogonal",
  renderorder: "right-down",
  type: "map",
  version: "1.10",
  tiledversion: "1.11.2",
  nextlayerid: 13,
  nextobjectid: objectId,
  properties: properties({
    floor: 1,
    module: "reinforcement-learning",
    routeDecisionContext: "F1_ENTRY_SPLIT",
    status: "FLOOR1_TILED_BLOCKOUT",
  }),
  tilesets: [{ firstgid: 1, source: "reinforcement_blockout_tileset.tsj" }],
  layers: [
    tileLayer(1, "Ground", ground),
    tileLayer(2, "FloorDetail", floorDetail),
    tileLayer(3, "Walls", boundary),
    tileLayer(4, "WallTop", wallTop),
    tileLayer(5, "StaticProps", staticProps),
    objectLayer(6, "Collision", collisionObjects, "#ef4444"),
    objectLayer(7, "NavigationNodes", nodes, "#06b6d4"),
    objectLayer(8, "NavigationEdges", edges, "#f59e0b"),
    objectLayer(9, "EncounterZones", encounterZones, "#22c55e"),
    objectLayer(10, "FloorTransitions", transitions, "#3b82f6"),
    objectLayer(11, "SpawnPoints", spawnPoints, "#a855f7"),
    objectLayer(12, "Debug", debugObjects, "#f97316"),
  ],
};

const tileset = {
  columns: 8,
  image: "../../assets/environment/reinforcement/blockout/reinforcement_blockout_tiles.png",
  imagewidth: 256,
  imageheight: 32,
  margin: 0,
  spacing: 0,
  name: "reinforcement_blockout_tileset",
  tilecount: 8,
  tilewidth: TILE,
  tileheight: TILE,
  type: "tileset",
  version: "1.10",
  tiledversion: "1.11.2",
  tiles: [
    { id: 0, class: "Ground", properties: properties({ walkable: true }) },
    { id: 1, class: "FloorDetail", properties: properties({ walkable: true }) },
    { id: 2, class: "Wall", properties: properties({ blocksRobot: true }) },
    { id: 3, class: "WallTop", properties: properties({ blocksRobot: true }) },
    { id: 4, class: "StaticProp", properties: properties({ blocksRobot: true }) },
    { id: 5, class: "Stair", properties: properties({ walkable: true }) },
    { id: 6, class: "LockedRoom", properties: properties({ blocksRobot: true }) },
    { id: 7, class: "Debug", properties: properties({ gameplay: false }) },
  ],
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}
const rgb = (hex) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
};
function tilesetPng() {
  const width = 256;
  const height = 32;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = ["#d9dee2", "#c3cbd1", "#3d4348", "#596168", "#8a6f4d", "#5b91c9", "#858b90", "#d98ca5"];
  const setPixel = (x, y, color) => {
    const offset = (y * width + x) * 4;
    pixels.set(color, offset);
  };
  for (let tile = 0; tile < 8; tile += 1) {
    const base = rgb(colors[tile]);
    const light = base.map((value, i) => i === 3 ? value : Math.min(255, value + 24));
    const dark = base.map((value, i) => i === 3 ? value : Math.max(0, value - 24));
    for (let y = 0; y < TILE; y += 1) {
      for (let localX = 0; localX < TILE; localX += 1) {
        const border = localX === 0 || y === 0 || localX === 31 || y === 31;
        const stairLine = tile === 5 && y % 6 === 0;
        const hatch = tile === 6 && (localX + y) % 12 === 0;
        setPixel(tile * TILE + localX, y, border || stairLine ? dark : hatch ? light : base);
      }
    }
  }
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (width * 4 + 1);
    raw[rawOffset] = 0;
    pixels.copy(raw, rawOffset + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

writeFileSync(mapPath, `${JSON.stringify(map, null, 2)}\n`);
writeFileSync(tilesetPath, `${JSON.stringify(tileset, null, 2)}\n`);
writeFileSync(imagePath, tilesetPng());
console.log(`Generated Floor 1 Tiled blockout (${WIDTH}x${HEIGHT} tiles, ${WIDTH * TILE}x${HEIGHT * TILE}px).`);
