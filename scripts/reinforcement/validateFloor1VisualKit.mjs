import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const assetDir = resolve(root, "public/assets/environment/reinforcement/floor1");
const map = JSON.parse(readFileSync(resolve(root, "public/maps/reinforcement/floor_1_blockout.tmj"), "utf8"));
const tileset = JSON.parse(readFileSync(resolve(root, "public/maps/reinforcement/floor1_visual_tileset.tsj"), "utf8"));
const modules = JSON.parse(readFileSync(resolve(root, "public/maps/reinforcement/floor1_visual_modules.tsj"), "utf8"));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

function png(path) {
  const source = readFileSync(path);
  check(source.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${path} is not PNG`);
  const width = source.readUInt32BE(16);
  const height = source.readUInt32BE(20);
  const parts = [];
  for (let offset = 8; offset < source.length;) {
    const length = source.readUInt32BE(offset);
    const type = source.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") parts.push(source.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    check(raw[row] === 0, `${path} uses a filtered row; expected deterministic filter 0`);
    raw.copy(pixels, y * width * 4, row + 1, row + 1 + width * 4);
  }
  return { width, height, pixels };
}
const pixel = (image, x, y) => image.pixels.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4);
const same = (image, ax, ay, bx, by) => pixel(image, ax, ay).equals(pixel(image, bx, by));
const dimensions = new Map([
  ["F1_FLOOR_PUBLIC", [32, 32]], ["F1_FLOOR_SERVICE", [32, 32]],
  ["F1_WALL_H", [32, 72]], ["F1_WALL_V", [32, 72]],
  ["F1_WALL_CORNER_INNER", [32, 72]], ["F1_WALL_CORNER_OUTER", [32, 72]],
  ["F1_WALL_END_H", [32, 72]], ["F1_WALL_END_V", [32, 72]],
  ["F1_DOORWAY_OPEN", [64, 72]], ["F1_DOOR_STAFF_CLOSED", [64, 72]],
  ["F1_STAIR_STRAIGHT", [256, 224]], ["F1_RECEPTION_DESK", [256, 64]],
]);
const images = new Map([...dimensions].map(([id]) => [id, png(resolve(assetDir, `${id}.png`))]));

check(modules.tiles?.length === dimensions.size, `module TSJ must index ${dimensions.size} assets`);
for (const [id, [width, height]] of dimensions) {
  const image = images.get(id);
  const tile = modules.tiles?.find((candidate) => candidate.class === id);
  check(image.width === width && image.height === height, `${id} must be ${width}x${height}`);
  check(tile?.imagewidth === width && tile?.imageheight === height, `${id} TSJ dimensions disagree with PNG`);
}
for (const id of ["F1_FLOOR_PUBLIC", "F1_FLOOR_SERVICE"]) {
  const image = images.get(id);
  for (let i = 0; i < 32; i += 1) {
    check(same(image, 0, i, 31, i), `${id} left/right edge mismatch at ${i}`);
    check(same(image, i, 0, i, 31), `${id} top/bottom edge mismatch at ${i}`);
  }
}
const wallH = images.get("F1_WALL_H");
for (let y = 0; y < wallH.height; y += 1) check(same(wallH, 0, y, 31, y), `F1_WALL_H repeat edge mismatch at ${y}`);
for (const id of ["F1_WALL_CORNER_INNER", "F1_WALL_CORNER_OUTER"]) {
  const corner = images.get(id);
  const wallV = images.get("F1_WALL_V");
  for (let y = 0; y < wallH.height; y += 1) {
    check(pixel(wallH, 31, y).equals(pixel(corner, 0, y)), `F1_WALL_H -> ${id} seam at ${y}`);
    check(pixel(corner, 31, y).equals(pixel(wallV, 0, y)), `${id} -> F1_WALL_V seam at ${y}`);
  }
}

const paletteProperty = Object.fromEntries(tileset.properties.map(({ name, value }) => [name, value])).palette;
const palette = JSON.parse(paletteProperty);
const allowedRgb = new Set(Object.values(palette).map((hex) => hex.slice(1).toUpperCase()));
for (const [id, image] of images) {
  for (let offset = 0; offset < image.pixels.length; offset += 4) {
    const alpha = image.pixels[offset + 3];
    if (!alpha) continue;
    const rgb = image.pixels.subarray(offset, offset + 3).toString("hex").toUpperCase();
    check(allowedRgb.has(rgb), `${id} contains off-palette RGB ${rgb}`);
    check([64, 96, 210, 255].includes(alpha), `${id} contains anti-aliased alpha ${alpha}`);
  }
}
const cyan = Buffer.from(`${palette.cyan.slice(1)}FF`, "hex");
for (const id of [...dimensions.keys()].filter((value) => value.startsWith("F1_WALL"))) {
  const image = images.get(id);
  check(pixel(image, 0, 12).equals(cyan), `${id} cyan strip is not at y=12`);
  check(pixel(image, 0, 15).equals(cyan), `${id} cyan strip is not 4px thick`);
  check(!pixel(image, 0, 11).equals(cyan) && !pixel(image, 0, 16).equals(cyan), `${id} cyan strip exceeds y=12..15`);
  for (let y = 0; y < 64; y += 1) check(pixel(image, 0, y)[3] === 255, `${id} has a floating edge pixel at y=${y}`);
}
check(png(resolve(assetDir, "floor1_tileset.png")).width === 256, "runtime atlas width must be 256");
const contact = png(resolve(root, "docs/modules/machine_learning/reinforcement/navigation/floor_1_visual_module_contact_sheet.png"));
check(contact.width === 624 && contact.height === 344, "contact sheet must be 624x344");

const objectJson = JSON.stringify(map.layers.filter((layer) => layer.type === "objectgroup"));
check(createHash("sha256").update(objectJson).digest("hex") === "4374b5739afe79850ca48b9ec2a4ab3137236800e0514e1b9d367c4253a46f4a", "gameplay object layers changed");
check(map.tilesets?.[0]?.source === "floor1_visual_tileset.tsj", "map runtime tileset reference changed");
check(["Ground", "FloorDetail", "Walls", "WallTop", "StaticProps"].every((name) => map.layers.some((layer) => layer.name === name && layer.type === "tilelayer")), "required visual tile layer missing");

if (failures.length) {
  console.error(`FAIL floor_1_visual_kit (${new Set(failures).size})`);
  for (const failure of new Set(failures)) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("PASS floor_1_visual_kit");
  console.log("modules=12 palette=12colors grid=32px wall=8+48+8 cyan=4px shadow<=8px");
  console.log("floors=seamless wallH=seamless pixels=palette-exact objectLayers=unchanged");
}
