import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  PNG_HEIGHT,
  PNG_WIDTH,
  floors,
  outputDir,
} from "./generateNavigationBlockoutV2.mjs";

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const duplicates = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

function overlaps(a, b) {
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0
    && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0;
}

const expectedStairCounts = [2, 3, 3, 3, 1];
const expectedRouteCounts = [2, 4, 2, 4, 5];

for (const floor of floors) {
  const tagged = floor.shapes.filter(({ tag }) => tag);
  const tagMap = new Map(tagged.map((shape) => [shape.tag, shape]));
  const walkables = tagged.filter(({ walkable }) => walkable);

  check(duplicates(tagged.map(({ tag }) => tag)).length === 0, `${floor.floor}F has duplicate geometry tags`);
  check(floor.stairs.length === expectedStairCounts[floor.floor - 1], `${floor.floor}F stair count is wrong`);
  check(floor.routes.length === expectedRouteCounts[floor.floor - 1], `${floor.floor}F route count is wrong`);
  for (const stairTag of floor.stairs) check(tagMap.get(stairTag)?.semantic === "stair", `${floor.floor}F missing stair ${stairTag}`);

  for (const route of floor.routes) {
    for (const tag of route) check(tagMap.has(tag), `${floor.floor}F route references missing geometry ${tag}`);
    for (let index = 1; index < route.length; index += 1) {
      const previous = tagMap.get(route[index - 1]);
      const current = tagMap.get(route[index]);
      check(previous && current && overlaps(previous, current), `${floor.floor}F route breaks between ${route[index - 1]} and ${route[index]}`);
    }
  }

  const adjacency = new Map(walkables.map(({ tag }) => [tag, []]));
  for (let left = 0; left < walkables.length; left += 1) {
    for (let right = left + 1; right < walkables.length; right += 1) {
      if (!overlaps(walkables[left], walkables[right])) continue;
      adjacency.get(walkables[left].tag).push(walkables[right].tag);
      adjacency.get(walkables[right].tag).push(walkables[left].tag);
    }
  }
  const reached = new Set([walkables[0]?.tag]);
  const queue = [...reached];
  while (queue.length) {
    for (const next of adjacency.get(queue.shift()) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  const disconnected = walkables.map(({ tag }) => tag).filter((tag) => !reached.has(tag));
  check(disconnected.length === 0, `${floor.floor}F disconnected walkable geometry: ${disconnected.join(", ")}`);

  for (const shape of floor.shapes) {
    if (shape.kind === "rect") {
      check(shape.x >= 0 && shape.y >= 0 && shape.x + shape.width <= BASE_WIDTH && shape.y + shape.height <= BASE_HEIGHT, `${floor.floor}F rectangle exceeds canvas`);
    }
  }
}

check(floors[1].routes.every((route) => route.includes("f2_convergence")), "2F approaches must share the center convergence zone");
check(floors[3].routes.every((route) => route.includes("f4_convergence")), "4F approaches must share the security convergence zone");
check(floors[4].searchRooms.length === 4, "5F must contain four Search Rooms");
check(floors[4].controlRooms.length === 1, "5F must contain one fixed Control Room");
check(floors[4].routes.slice(0, 4).every((route) => route.includes("f5_search_hub")), "5F Search Room routes must pass through the Search Hub");

const positionRules = [
  ["f1_left_stair", (shape) => shape.x < 500 && shape.y < 220],
  ["f1_right_stair", (shape) => shape.x > 1100 && shape.y < 220],
  ["f2_left_arrival", (shape) => shape.x < 400 && shape.y > 650],
  ["f2_right_arrival", (shape) => shape.x > 1200 && shape.y > 650],
  ["f2_center_stair", (shape) => shape.x > 600 && shape.x < 800 && shape.y < 180],
  ["f3_center_arrival", (shape) => shape.x > 600 && shape.x < 800 && shape.y > 700],
  ["f3_left_stair", (shape) => shape.x < 500 && shape.y < 220],
  ["f3_right_stair", (shape) => shape.x > 1100 && shape.y < 220],
  ["f4_left_arrival", (shape) => shape.x < 400 && shape.y > 650],
  ["f4_right_arrival", (shape) => shape.x > 1200 && shape.y > 650],
  ["f4_center_stair", (shape) => shape.x > 600 && shape.x < 800 && shape.y < 180],
  ["f5_center_arrival", (shape) => shape.x > 600 && shape.x < 800 && shape.y > 700],
];
const allTagged = new Map(floors.flatMap((floor) => floor.shapes.filter(({ tag }) => tag).map((shape) => [shape.tag, shape])));
for (const [tag, rule] of positionRules) check(rule(allTagged.get(tag)), `stair location rule failed for ${tag}`);

const expectedExports = [];
for (let floor = 1; floor <= 5; floor += 1) {
  expectedExports.push(`floor_${floor}_blockout_spatial_v2.svg`, `floor_${floor}_blockout_spatial_v2.png`);
  expectedExports.push(`floor_${floor}_structure_clean_v2.svg`, `floor_${floor}_structure_clean_v2.png`);
}
for (const filename of expectedExports) check(existsSync(resolve(outputDir, filename)), `missing export ${filename}`);
const actualExports = readdirSync(outputDir).filter((filename) => /floor_\d_.*_v2\.(svg|png)$/.test(filename));
check(duplicates(actualExports).length === 0, "duplicate v2 export names found");
check(actualExports.length === expectedExports.length, `expected ${expectedExports.length} exports, found ${actualExports.length}`);

for (let floor = 1; floor <= 5; floor += 1) {
  const spatialSvg = readFileSync(resolve(outputDir, `floor_${floor}_blockout_spatial_v2.svg`), "utf8");
  const cleanSvg = readFileSync(resolve(outputDir, `floor_${floor}_structure_clean_v2.svg`), "utf8");
  for (const [kind, svg] of [["spatial", spatialSvg], ["clean", cleanSvg]]) {
    check(!/<(?:text|title|desc|foreignObject)\b|marker|arrow|legend|data-node|data-edge/i.test(svg), `${floor}F ${kind} SVG contains forbidden annotation`);
    check(svg.includes('fill="#20262d"'), `${floor}F ${kind} SVG is missing the dark exterior`);
    check(svg.includes(kind === "clean" ? 'fill="#939ba2"' : 'fill="#9099a1"'), `${floor}F ${kind} SVG is missing the medium wall mass`);
    check(svg.trimEnd().endsWith("</svg>"), `${floor}F ${kind} SVG is not closed`);
  }
  const spatialPrimitiveCount = (spatialSvg.match(/<(?:rect|line|circle)\b/g) ?? []).length;
  const cleanPrimitiveCount = (cleanSvg.match(/<(?:rect|line|circle)\b/g) ?? []).length;
  check(spatialPrimitiveCount === cleanPrimitiveCount, `${floor}F spatial/clean geometry diverged`);

  for (const stem of [`floor_${floor}_blockout_spatial_v2`, `floor_${floor}_structure_clean_v2`]) {
    const png = readFileSync(resolve(outputDir, `${stem}.png`));
    check(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${stem}.png has an invalid signature`);
    check(png.readUInt32BE(16) === PNG_WIDTH && png.readUInt32BE(20) === PNG_HEIGHT, `${stem}.png dimensions are wrong`);
    check(png[25] === 6, `${stem}.png is not RGBA color type 6`);
  }
}

if (failures.length) {
  console.error(`FAIL navigation blockout v2 (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("PASS navigation blockout v2");
  console.log(`floors=${floors.length} exports=${expectedExports.length} png=${PNG_WIDTH}x${PNG_HEIGHT} RGBA`);
  console.log(`stairs=${floors.map((floor) => floor.stairs.length).join("/")} routes=${floors.map((floor) => floor.routes.length).join("/")}`);
  console.log("walkableContinuity=PASS routeConvergence=PASS searchRooms=4 controlRooms=1");
}
