import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const WIDTH = 80;
const HEIGHT = 45;
const TILE = 32;
const REQUIRED_LAYERS = [
  "Ground", "FloorDetail", "Walls", "WallTop", "StaticProps", "Collision",
  "NavigationNodes", "NavigationEdges", "EncounterZones", "FloorTransitions", "SpawnPoints", "Debug",
];
const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "../..");
const mapPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(root, "public/maps/reinforcement/floor_1_blockout.tmj");
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const duplicates = (values) => [...new Set(values.filter((value, index) => value && values.indexOf(value) !== index))];
const props = (item) => Object.fromEntries((item?.properties ?? []).map(({ name, value }) => [name, value]));

let map;
try {
  map = JSON.parse(readFileSync(mapPath, "utf8"));
} catch (error) {
  console.error(`FAIL: cannot parse ${mapPath}: ${error.message}`);
  process.exit(1);
}

const layers = new Map((map.layers ?? []).map((layer) => [layer.name, layer]));
const layerObjects = (name) => layers.get(name)?.objects ?? [];
const decodeLayer = (name) => {
  const layer = layers.get(name);
  if (!layer) return [];
  if (Array.isArray(layer.data)) return layer.data;
  try {
    const bytes = inflateSync(Buffer.from(layer.data, "base64"));
    const values = [];
    for (let offset = 0; offset < bytes.length; offset += 4) values.push(bytes.readUInt32LE(offset));
    return values;
  } catch (error) {
    failures.push(`${name} cannot be decoded: ${error.message}`);
    return [];
  }
};

check(map.orientation === "orthogonal", "orientation must be orthogonal");
check(map.width === WIDTH && map.height === HEIGHT, `map must be ${WIDTH}x${HEIGHT}`);
check(map.tilewidth === TILE && map.tileheight === TILE, `tiles must be ${TILE}x${TILE}`);
check(REQUIRED_LAYERS.every((name) => layers.has(name)), "one or more required layers are missing");
check(JSON.stringify((map.layers ?? []).map(({ name }) => name)) === JSON.stringify(REQUIRED_LAYERS), "layer order must match the Floor 1 contract");
for (const name of REQUIRED_LAYERS.slice(0, 5)) check(decodeLayer(name).length === WIDTH * HEIGHT, `${name} tile data must contain ${WIDTH * HEIGHT} cells`);

const tilesetRef = map.tilesets?.[0];
const tilesetPath = resolve(dirname(mapPath), tilesetRef?.source ?? "");
check(map.tilesets?.length === 1 && tilesetRef?.firstgid === 1, "map must reference exactly one external tileset at firstgid 1");
check(existsSync(tilesetPath), "external tileset is missing");
let tileset = {};
if (existsSync(tilesetPath)) {
  try {
    tileset = JSON.parse(readFileSync(tilesetPath, "utf8"));
  } catch (error) {
    failures.push(`tileset JSON parse failed: ${error.message}`);
  }
}
check(tileset.tilewidth === TILE && tileset.tileheight === TILE && tileset.tilecount === 8, "tileset dimensions/count are invalid");
const imagePath = resolve(dirname(tilesetPath), tileset.image ?? "");
check(existsSync(imagePath), "tileset PNG is missing");
if (existsSync(imagePath)) {
  const png = readFileSync(imagePath);
  check(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "tileset image is not a PNG");
  check(png.readUInt32BE(16) === 256 && png.readUInt32BE(20) === 32, "tileset PNG must be 256x32");
}

const allObjects = (map.layers ?? []).flatMap((layer) => layer.objects ?? []);
check(duplicates(allObjects.map(({ id }) => id)).length === 0, "duplicate Tiled object id");
const logicalIds = allObjects.flatMap((item) => {
  const values = props(item);
  return [values.collisionId, values.nodeId, values.edgeId, values.zoneId, values.transitionId, values.spawnId, values.debugId].filter(Boolean);
});
check(duplicates(logicalIds).length === 0, "duplicate logical object id");
check(map.nextobjectid > Math.max(...allObjects.map(({ id }) => id)), "nextobjectid must exceed every object id");

const spawns = layerObjects("SpawnPoints");
check(spawns.length === 1, `expected one spawn, found ${spawns.length}`);
check(props(spawns[0])?.spawnId === "F1_ROBOT_SPAWN" && props(spawns[0])?.floor === 1, "F1_ROBOT_SPAWN is invalid");

const transitions = layerObjects("FloorTransitions");
check(transitions.length === 2, `expected exactly two FloorTransitions, found ${transitions.length}`);
const transitionById = new Map(transitions.map((item) => [props(item).transitionId, props(item)]));
check(transitionById.get("F1_LEFT_STAIR_TRANSITION")?.targetSpawn === "F2_LEFT_ARRIVAL", "left stair transition is invalid");
check(transitionById.get("F1_RIGHT_STAIR_TRANSITION")?.targetSpawn === "F2_RIGHT_ARRIVAL", "right stair transition is invalid");
check(transitions.every((item) => props(item).targetFloor === 2), "both transitions must target Floor 2");

const nodes = layerObjects("NavigationNodes");
const edges = layerObjects("NavigationEdges");
const nodeById = new Map(nodes.map((item) => [props(item).nodeId, item]));
const edgeById = new Map(edges.map((item) => [props(item).edgeId, item]));
for (const required of [
  "F1_START", "F1_ENTRY_SPLIT", "F1_LEFT_ROUTE_A", "F1_LEFT_ROUTE_B", "F1_LEFT_STAIR",
  "F1_RIGHT_ROUTE_A", "F1_RIGHT_ROUTE_B", "F1_RIGHT_ROUTE_C", "F1_RIGHT_ROUTE_D", "F1_RIGHT_STAIR",
]) check(nodeById.has(required), `missing navigation node ${required}`);
check(props(nodeById.get("F1_ENTRY_SPLIT"))?.type === "ROUTE_CHOICE", "F1_ENTRY_SPLIT must be ROUTE_CHOICE");
check(props(nodeById.get("F1_ENTRY_SPLIT"))?.routeContextId === "F1_ENTRY_SPLIT", "F1_ENTRY_SPLIT routeContextId is invalid");
check(nodes.every((item) => props(item).floor === 1 && props(item).nodeId && props(item).type), "every navigation node needs nodeId/floor/type");

const adjacency = new Map(nodes.map((item) => [props(item).nodeId, []]));
for (const edge of edges) {
  const values = props(edge);
  check(nodeById.has(values.from) && nodeById.has(values.to), `${values.edgeId ?? edge.name} has an unknown endpoint`);
  check(values.lengthTiles > 0, `${values.edgeId ?? edge.name} needs a positive lengthTiles`);
  adjacency.get(values.from)?.push({ node: values.to, distance: values.lengthTiles, route: values.route });
  if (values.bidirectional) adjacency.get(values.to)?.push({ node: values.from, distance: values.lengthTiles, route: values.route });
}
const hasPath = (from, to) => {
  const seen = new Set([from]);
  const pending = [from];
  while (pending.length) {
    const current = pending.shift();
    if (current === to) return true;
    for (const { node } of adjacency.get(current) ?? []) {
      if (!seen.has(node)) {
        seen.add(node);
        pending.push(node);
      }
    }
  }
  return false;
};
const neighbors = (nodeId) => new Set((adjacency.get(nodeId) ?? []).map(({ node }) => node));
const sameSet = (actual, expected) => actual.size === expected.size && [...expected].every((value) => actual.has(value));
check(edgeById.has("E_F1_START_LEFT_A"), "missing E_F1_START_LEFT_A");
check(edgeById.has("E_F1_START_RIGHT_A"), "missing E_F1_START_RIGHT_A");
check(!edgeById.has("E_F1_START_SPLIT"), "obsolete E_F1_START_SPLIT must be removed");
check(sameSet(neighbors("F1_START"), new Set(["F1_LEFT_ROUTE_A", "F1_RIGHT_ROUTE_A"])), "START must connect directly and only to LEFT_ROUTE_A and RIGHT_ROUTE_A");
check(sameSet(neighbors("F1_ENTRY_SPLIT"), new Set(["F1_LEFT_ROUTE_A", "F1_RIGHT_ROUTE_A"])), "ENTRY_SPLIT must connect directly and only to both Route A nodes");
for (const [from, to] of [
  ["F1_START", "F1_LEFT_ROUTE_A"],
  ["F1_START", "F1_RIGHT_ROUTE_A"],
  ["F1_LEFT_ROUTE_A", "F1_ENTRY_SPLIT"],
  ["F1_RIGHT_ROUTE_A", "F1_ENTRY_SPLIT"],
  ["F1_ENTRY_SPLIT", "F1_LEFT_ROUTE_A"],
  ["F1_ENTRY_SPLIT", "F1_RIGHT_ROUTE_A"],
]) check(hasPath(from, to), `${from} cannot reach ${to}`);
check(
  neighbors("F1_LEFT_ROUTE_A").has("F1_ENTRY_SPLIT") && neighbors("F1_ENTRY_SPLIT").has("F1_RIGHT_ROUTE_A"),
  "LEFT Route A cannot switch to RIGHT Route A through ENTRY_SPLIT",
);
check(
  neighbors("F1_RIGHT_ROUTE_A").has("F1_ENTRY_SPLIT") && neighbors("F1_ENTRY_SPLIT").has("F1_LEFT_ROUTE_A"),
  "RIGHT Route A cannot switch to LEFT Route A through ENTRY_SPLIT",
);
const crossEdges = edges.filter((edge) => {
  const { from = "", to = "" } = props(edge);
  return (from.includes("LEFT") && to.includes("RIGHT")) || (from.includes("RIGHT") && to.includes("LEFT"));
});
check(crossEdges.length === 0, "direct LEFT/RIGHT cross-edge is forbidden; switching must use ENTRY_SPLIT");

const reachable = new Set(["F1_START"]);
const queue = ["F1_START"];
while (queue.length) {
  for (const { node } of adjacency.get(queue.shift()) ?? []) {
    if (!reachable.has(node)) {
      reachable.add(node);
      queue.push(node);
    }
  }
}
check(reachable.size === nodes.length, `unreachable navigation nodes: ${nodes.map((item) => props(item).nodeId).filter((id) => !reachable.has(id)).join(", ")}`);
check(reachable.has("F1_LEFT_STAIR"), "START cannot reach LEFT STAIR");
check(reachable.has("F1_RIGHT_STAIR"), "START cannot reach RIGHT STAIR");

function shortestGraphDistance(start, target, route) {
  const distances = new Map([[start, 0]]);
  const pending = new Set(adjacency.keys());
  while (pending.size) {
    const current = [...pending].reduce((best, candidate) =>
      (distances.get(candidate) ?? Infinity) < (distances.get(best) ?? Infinity) ? candidate : best,
    );
    pending.delete(current);
    if (current === target) return distances.get(current);
    for (const edge of adjacency.get(current) ?? []) {
      if (edge.route !== route) continue;
      const next = (distances.get(current) ?? Infinity) + edge.distance;
      if (next < (distances.get(edge.node) ?? Infinity)) distances.set(edge.node, next);
    }
  }
  return Infinity;
}
const leftGraphTiles = shortestGraphDistance("F1_ENTRY_SPLIT", "F1_LEFT_STAIR", "LEFT_PUBLIC_ROUTE");
const rightGraphTiles = shortestGraphDistance("F1_ENTRY_SPLIT", "F1_RIGHT_STAIR", "RIGHT_SERVICE_ROUTE");
check(Number.isFinite(leftGraphTiles) && Number.isFinite(rightGraphTiles), "both route-specific navigation paths must exist");
check(rightGraphTiles > leftGraphTiles, `RIGHT navigation length (${rightGraphTiles}) must exceed LEFT (${leftGraphTiles})`);

const ground = decodeLayer("Ground");
const detail = decodeLayer("FloorDetail");
const collision = layerObjects("Collision");
const objectKind = (item) => item.class ?? item.type;
const tileCenterBlocked = (x, y) => collision.some((item) => {
  if (props(item).blocksRobot === false || !item.width || !item.height) return false;
  const centerX = (x + 0.5) * TILE;
  const centerY = (y + 0.5) * TILE;
  return centerX >= item.x && centerX < item.x + item.width && centerY >= item.y && centerY < item.y + item.height;
});
const walkable = (x, y) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT && ground[y * WIDTH + x] === 1 && !tileCenterBlocked(x, y);
const tileForObject = (item) => [Math.floor(item.x / TILE), Math.floor(item.y / TILE)];
function shortestWalk(start, target) {
  const key = ([x, y]) => `${x},${y}`;
  const seen = new Set([key(start)]);
  const pending = [[...start, 0]];
  while (pending.length) {
    const [x, y, distance] = pending.shift();
    if (x === target[0] && y === target[1]) return distance;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [x + dx, y + dy];
      if (walkable(...next) && !seen.has(key(next))) {
        seen.add(key(next));
        pending.push([...next, distance + 1]);
      }
    }
  }
  return Infinity;
}
const spawnTile = tileForObject(spawns[0]);
const splitTile = tileForObject(nodeById.get("F1_ENTRY_SPLIT"));
const leftStairTile = tileForObject(nodeById.get("F1_LEFT_STAIR"));
const rightStairTile = tileForObject(nodeById.get("F1_RIGHT_STAIR"));
for (const [label, tile] of [["spawn", spawnTile], ["split", splitTile], ["left stair", leftStairTile], ["right stair", rightStairTile]]) {
  check(walkable(...tile), `${label} must be on a walkable, collision-free tile`);
}
const leftWalkTiles = shortestWalk(splitTile, leftStairTile);
const rightWalkTiles = shortestWalk(splitTile, rightStairTile);
check(Number.isFinite(shortestWalk(spawnTile, leftStairTile)), "spawn has no valid walkable path to LEFT Stair");
check(Number.isFinite(shortestWalk(spawnTile, rightStairTile)), "spawn has no valid walkable path to RIGHT Stair");
check(rightWalkTiles > leftWalkTiles, `RIGHT walk distance (${rightWalkTiles}) must exceed LEFT (${leftWalkTiles})`);

const core = collision.find((item) => props(item).role === "CENTRAL_CORE");
check(core?.x === 28 * TILE && core?.y === 10 * TILE && core?.width === 24 * TILE && core?.height === 21 * TILE, "Central Core collision must cover x=28..51, y=10..30");
let coreGroundTiles = 0;
for (let y = 10; y <= 30; y += 1) for (let x = 28; x <= 51; x += 1) coreGroundTiles += ground[y * WIDTH + x] === 1 ? 1 : 0;
check(coreGroundTiles === 0, `Central Core contains ${coreGroundTiles} walkable Ground tiles`);
const doors = collision.filter((item) => objectKind(item) === "LockedDoor");
check(doors.length === 4, `Central Core must contain exactly four locked doors, found ${doors.length}`);
check(doors.every((item) => props(item).lockedForRobot === true && props(item).blocksRobot === true), "all Central Core doors must be locked for the Robot");
const manualWalls = ["WALL_45_1", "WALL_45_2"].map((name) => collision.find((item) => item.name === name));
check(manualWalls.every(Boolean), "user-authored WALL_45_1 and WALL_45_2 must be preserved");
const expectedManualWalls = {
  WALL_45_1: [480, 864, 416, 32],
  WALL_45_2: [1664, 928, 198, 32],
};
for (const wall of manualWalls.filter(Boolean)) {
  check(
    JSON.stringify([wall.x, wall.y, wall.width, wall.height]) === JSON.stringify(expectedManualWalls[wall.name]),
    `${wall.name} geometry changed from the user-authored Tiled adjustment`,
  );
}

const reception = collision.find((item) => item.name === "RECEPTION_DESK");
const split = nodeById.get("F1_ENTRY_SPLIT");
check(Boolean(reception), "Reception Desk collision is missing");
check(
  split?.x === 1274 && split?.y === 1042,
  "F1_ENTRY_SPLIT must be at the approved Tiled coordinate (1274, 1042)",
);

const stairCount = (x0, x1) => {
  let count = 0;
  for (let y = 2; y <= 8; y += 1) for (let x = x0; x <= x1; x += 1) count += detail[y * WIDTH + x] === 6 ? 1 : 0;
  return count;
};
check(stairCount(8, 15) === 56, "LEFT Stair tile footprint must be 8x7");
check(stairCount(64, 71) === 56, "RIGHT Stair tile footprint must be 8x7");

const zones = layerObjects("EncounterZones");
const citizenZones = zones.filter((item) => props(item).encounterType === "CITIZEN_NEARBY");
const obstacleZones = zones.filter((item) => props(item).encounterType === "OBSTACLE" && props(item).facilityDamagePossible === true);
check(citizenZones.length >= 2, `need at least two Citizen zones, found ${citizenZones.length}`);
check(obstacleZones.length >= 2, `need at least two Obstacle/Facility zones, found ${obstacleZones.length}`);
check(zones.every((item) => props(item).floor === 1 && props(item).route), "every Encounter zone needs floor and route");

const serialized = JSON.stringify(map);
check(!/elevator/i.test(serialized), "Elevator is forbidden on Floor 1");
check(!/villain|boss/i.test(JSON.stringify(zones)), "Villain/Boss Encounter is forbidden on Floor 1");

const pointCollision = (x, y) => collision.find((item) =>
  props(item).blocksRobot !== false && item.width > 0 && item.height > 0
  && x > item.x && x < item.x + item.width && y > item.y && y < item.y + item.height,
);
const edgeDirection = (edgeId) => {
  const edge = edgeById.get(edgeId);
  const points = edge?.polyline ?? [];
  return points.length > 1
    ? { dx: points.at(-1).x - points[0].x, dy: points.at(-1).y - points[0].y }
    : { dx: 0, dy: 0 };
};
const startLeftDirection = edgeDirection("E_F1_START_LEFT_A");
const startRightDirection = edgeDirection("E_F1_START_RIGHT_A");
check(startLeftDirection.dx < 0 && startLeftDirection.dy < 0, "START → LEFT_ROUTE_A must run diagonally north-west");
check(startRightDirection.dx > 0 && startRightDirection.dy < 0, "START → RIGHT_ROUTE_A must run diagonally north-east");

// Sample every edge in pixel space: Ground-only checks are insufficient for partial-tile manual colliders.
for (const edge of edges) {
  const values = props(edge);
  const points = (edge.polyline ?? []).map((point) => [edge.x + point.x, edge.y + point.y]);
  const from = nodeById.get(values.from);
  const to = nodeById.get(values.to);
  check(points.length >= 2, `${values.edgeId} needs a polyline`);
  check(points[0]?.[0] === from?.x && points[0]?.[1] === from?.y, `${values.edgeId} does not start at ${values.from}`);
  check(points.at(-1)?.[0] === to?.x && points.at(-1)?.[1] === to?.y, `${values.edgeId} does not end at ${values.to}`);
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      const x = x0 + (x1 - x0) * ratio;
      const y = y0 + (y1 - y0) * ratio;
      const tileX = Math.floor(x / TILE);
      const tileY = Math.floor(y / TILE);
      check(walkable(tileX, tileY), `${values.edgeId} leaves walkable corridor at ${tileX},${tileY}`);
      const hit = pointCollision(x, y);
      check(!hit, `${values.edgeId} intersects Collision object ${hit?.name ?? hit?.id}`);
    }
  }
}

if (failures.length) {
  console.error(`FAIL floor_1_blockout (${failures.length})`);
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("PASS floor_1_blockout");
  console.log(`map=${map.width}x${map.height} tiles pixels=${map.width * map.tilewidth}x${map.height * map.tileheight}`);
  console.log(`layers=${map.layers.length} objects=${allObjects.length} nodes=${nodes.length} edges=${edges.length}`);
  console.log(`transitions=${transitions.length} citizenZones=${citizenZones.length} obstacleFacilityZones=${obstacleZones.length}`);
  console.log(`navigationLengthTiles left=${leftGraphTiles.toFixed(2)} right=${rightGraphTiles.toFixed(2)}`);
  console.log(`walkDistanceTiles splitToLeft=${leftWalkTiles} splitToRight=${rightWalkTiles}`);
  console.log(`walkDistancePixels splitToLeft=${leftWalkTiles * TILE} splitToRight=${rightWalkTiles * TILE}`);
  console.log(`lobbySwitching=ENTRY_SPLIT_ONLY manualWalls=${manualWalls.map((item) => `${item.name}:${item.id}`).join(",")}`);
  console.log("centralCoreShortcut=blocked lockedDoors=4 elevator=absent villain=absent");
}
