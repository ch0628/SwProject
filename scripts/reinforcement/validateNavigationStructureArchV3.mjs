import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  PNG_HEIGHT,
  PNG_WIDTH,
  floors,
  outputDir,
} from "./generateNavigationBlockoutV2.mjs";
import {
  WALL_THICKNESS,
  archPalette,
  architecturalShapes,
} from "./generateNavigationStructureArchV3.mjs";

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

function overlaps(a, b) {
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0
    && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0;
}

const expected = [];
for (const floor of floors) {
  const walkables = floor.shapes.filter(({ kind, walkable }) => kind === "rect" && walkable);
  const rooms = walkables.filter(({ semantic }) => ["room", "search_room", "control_room"].includes(semantic));
  const doors = walkables.filter(({ semantic }) => semantic === "door");
  const openings = walkables.filter(({ semantic }) => semantic === "door" || ["guard_vestibule", "choke"].includes(semantic));
  const stairs = walkables.filter(({ semantic }) => semantic === "stair");
  const architectural = architecturalShapes(floor);
  const landings = architectural.filter(({ semantic }) => semantic === "landing");
  const wallBands = architectural.filter(({ role }) => role === "solidWall");

  check(WALL_THICKNESS >= 16, `${floor.floor}F wall band is too thin`);
  check(wallBands.length >= walkables.length + 1, `${floor.floor}F is missing architectural wall bands`);
  check(rooms.every((room) => wallBands.some((wall) => wall.x === room.x - WALL_THICKNESS
    && wall.y === room.y - WALL_THICKNESS
    && wall.width === room.width + WALL_THICKNESS * 2
    && wall.height === room.height + WALL_THICKNESS * 2)), `${floor.floor}F has a room without a four-sided wall band`);
  check(!architectural.some(({ kind }) => kind === "circle"), `${floor.floor}F contains marker-like circles`);
  check(stairs.every((stair) => landings.some((landing) => overlaps(stair, landing))), `${floor.floor}F has a stair disconnected from its landing`);
  check(doors.every((door) => rooms.some((room) => overlaps(door, room))), `${floor.floor}F has a doorway not connected to a room`);
  check(doors.every((door) => walkables.some((shape) => shape !== door && !rooms.includes(shape) && overlaps(door, shape))), `${floor.floor}F has a doorway not connected to circulation`);
  check(rooms.every((room) => openings.some((opening) => overlaps(room, opening))), `${floor.floor}F has a room without an explicit opening`);

  const sourceRouteTags = floor.routes.flat();
  const architecturalFloorTags = architectural.filter(({ walkable }) => walkable).map(({ tag }) => tag);
  check(sourceRouteTags.every((tag) => architecturalFloorTags.includes(tag)), `${floor.floor}F v3 dropped v2 route geometry`);

  const stem = `floor_${floor.floor}_structure_arch_v3`;
  expected.push(`${stem}.svg`, `${stem}.png`);
  const svgPath = resolve(outputDir, `${stem}.svg`);
  const pngPath = resolve(outputDir, `${stem}.png`);
  check(existsSync(svgPath), `missing ${stem}.svg`);
  check(existsSync(pngPath), `missing ${stem}.png`);
  if (!existsSync(svgPath) || !existsSync(pngPath)) continue;

  const svg = readFileSync(svgPath, "utf8");
  check(!/<(?:text|title|desc|foreignObject|circle)\b|marker|arrow|legend|encounter|people|person|prop/i.test(svg), `${floor.floor}F SVG contains a forbidden annotation or marker`);
  for (const color of [archPalette.exterior, archPalette.solidWall, archPalette.floor, archPalette.roomFloor, archPalette.landing, archPalette.stair]) {
    check(svg.includes(`fill="${color}"`), `${floor.floor}F SVG is missing architectural color ${color}`);
  }
  check(svg.trimEnd().endsWith("</svg>"), `${floor.floor}F SVG is not closed`);

  const png = readFileSync(pngPath);
  check(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${floor.floor}F PNG signature is invalid`);
  check(png.readUInt32BE(16) === PNG_WIDTH && png.readUInt32BE(20) === PNG_HEIGHT, `${floor.floor}F PNG dimensions are wrong`);
  check(png[25] === 6, `${floor.floor}F PNG is not RGBA color type 6`);
}

const actual = readdirSync(outputDir).filter((filename) => /floor_\d_structure_arch_v3\.(svg|png)$/.test(filename));
check(actual.length === expected.length, `expected ${expected.length} v3 exports, found ${actual.length}`);
check(new Set(actual).size === actual.length, "duplicate v3 export names found");

if (failures.length) {
  console.error(`FAIL navigation structure arch v3 (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("PASS navigation structure arch v3");
  console.log(`floors=${floors.length} exports=${expected.length} png=${PNG_WIDTH}x${PNG_HEIGHT} RGBA wallBand=${WALL_THICKNESS}`);
  console.log("topology=v2-preserved walls=PASS rooms=PASS doorOpenings=PASS stairLandings=PASS forbiddenMarkers=PASS");
}
