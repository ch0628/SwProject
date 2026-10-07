import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "public/assets/environment/reinforcement/floor1_room_shell");

const colors = {
  ivory: "#E9E1D6",
  ivoryLight: "#F4EFE7",
  ivoryShade: "#DDD3C6",
  warmGray: "#C9C5C0",
  warmGrayLight: "#D9D6D1",
  warmGrayDark: "#A8A7A4",
  service: "#C8C6C2",
  serviceLight: "#D2D0CC",
  charcoal: "#30373B",
  charcoalLight: "#505A5F",
  cyan: "#61C9D4",
};

const rgba = hex => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
};
const canvas = (width, height, color) => {
  const image = { width, height, pixels: Buffer.alloc(width * height * 4) };
  if (color) rect(image, 0, 0, width, height, color);
  return image;
};
function pixel(image, x, y, color) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  image.pixels.set(ArrayBuffer.isView(color) || Array.isArray(color) ? color : rgba(color), (y * image.width + x) * 4);
}
function rect(image, x, y, width, height, color) {
  for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) pixel(image, px, py, color);
}
function clear(image, x, y, width, height) {
  for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) {
    image.pixels.fill(0, (py * image.width + px) * 4, (py * image.width + px + 1) * 4);
  }
}
function blit(target, source, x, y) {
  for (let sy = 0; sy < source.height; sy += 1) for (let sx = 0; sx < source.width; sx += 1) {
    const offset = (sy * source.width + sx) * 4;
    if (source.pixels[offset + 3]) pixel(target, x + sx, y + sy, source.pixels.subarray(offset, offset + 4));
  }
}

function floorPublic() {
  const image = canvas(32, 32, colors.ivory);
  rect(image, 1, 1, 14, 14, "#ECE5DB");
  rect(image, 17, 17, 14, 14, "#ECE5DB");
  rect(image, 17, 1, 14, 14, "#E6DDD1");
  rect(image, 1, 17, 14, 14, "#E6DDD1");
  for (const [x, y] of [[5, 7], [12, 23], [22, 9], [27, 26]]) pixel(image, x, y, colors.ivoryShade);
  return image;
}

function floorService() {
  const image = canvas(32, 32, colors.service);
  rect(image, 1, 1, 14, 14, colors.serviceLight);
  rect(image, 17, 17, 14, 14, colors.serviceLight);
  rect(image, 15, 2, 2, 28, "#C1BFBB");
  for (const [x, y] of [[6, 24], [10, 8], [23, 6], [27, 20]]) pixel(image, x, y, colors.warmGrayDark);
  return image;
}

function wallFace(variant = "plain") {
  const image = canvas(32, 64);
  rect(image, 0, 0, 32, 2, colors.ivoryLight);
  rect(image, 0, 2, 32, 4, colors.warmGrayLight);
  rect(image, 0, 6, 32, 25, colors.ivory);
  rect(image, 0, 31, 32, 4, colors.ivoryShade);
  rect(image, 0, 35, 32, 3, colors.warmGray);
  rect(image, 0, 38, 32, 5, colors.charcoal);
  rect(image, 0, 38, 32, 1, colors.charcoalLight);
  if (variant === "a") {
    rect(image, 10, 11, 12, 17, colors.ivoryShade);
    rect(image, 12, 12, 8, 15, colors.ivoryLight);
    rect(image, 13, 9, 6, 1, colors.cyan);
  }
  if (variant === "b") {
    rect(image, 8, 13, 3, 3, colors.warmGrayDark);
    rect(image, 21, 13, 3, 3, colors.warmGrayDark);
    rect(image, 15, 9, 2, 2, colors.cyan);
  }
  return image;
}

function sideBand(image, side, fromY = 0, toY = 32) {
  const x = side === "left" ? 0 : 22;
  if (side === "left") {
    rect(image, x, fromY, 2, toY - fromY, colors.charcoal);
    rect(image, x + 2, fromY, 5, toY - fromY, colors.warmGray);
    rect(image, x + 7, fromY, 3, toY - fromY, colors.ivoryLight);
  } else {
    rect(image, x, fromY, 3, toY - fromY, colors.ivoryLight);
    rect(image, x + 3, fromY, 5, toY - fromY, colors.warmGray);
    rect(image, x + 8, fromY, 2, toY - fromY, colors.charcoal);
  }
}

function sideWall(side) {
  const image = canvas(32, 32);
  sideBand(image, side);
  return image;
}

function corner(side) {
  const image = wallFace();
  clear(image, 0, 43, 32, 21);
  sideBand(image, side, 32, 64);
  return image;
}

function sideEnd(position) {
  const image = canvas(32, 32);
  if (position === "top") {
    sideBand(image, "left", 7, 32);
    rect(image, 0, 5, 12, 3, colors.charcoalLight);
    rect(image, 1, 3, 10, 3, colors.ivoryLight);
    rect(image, 3, 2, 6, 1, colors.cyan);
  } else {
    sideBand(image, "left", 0, 27);
    rect(image, 0, 26, 12, 3, colors.ivoryShade);
    rect(image, 0, 29, 12, 3, colors.charcoal);
  }
  return image;
}

function doorFrame(closed) {
  const image = canvas(64, 64);
  blit(image, wallFace(), 0, 0);
  blit(image, wallFace(), 32, 0);
  rect(image, 14, 16, 36, 3, colors.charcoal);
  rect(image, 16, 19, 32, 4, colors.warmGray);
  rect(image, 17, 22, 30, 2, colors.ivoryLight);
  clear(image, 18, 24, 28, 40);
  rect(image, 14, 22, 2, 42, colors.charcoal);
  rect(image, 16, 22, 2, 42, colors.warmGrayLight);
  rect(image, 46, 22, 2, 42, colors.warmGrayLight);
  rect(image, 48, 22, 2, 42, colors.charcoal);
  rect(image, 47, 26, 2, 2, colors.cyan);
  if (closed) {
    rect(image, 18, 24, 28, 40, colors.charcoal);
    rect(image, 20, 26, 24, 38, colors.warmGray);
    rect(image, 21, 27, 10, 36, colors.ivory);
    rect(image, 33, 27, 10, 36, colors.ivory);
    rect(image, 31, 27, 2, 37, colors.charcoalLight);
    rect(image, 23, 30, 6, 1, colors.ivoryLight);
    rect(image, 35, 30, 6, 1, colors.ivoryLight);
  }
  return image;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function png(image) {
  const raw = Buffer.alloc((image.width * 4 + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) image.pixels.copy(raw, y * (image.width * 4 + 1) + 1, y * image.width * 4, (y + 1) * image.width * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const assets = new Map([
  ["F1_FLOOR_PUBLIC", floorPublic()],
  ["F1_FLOOR_SERVICE", floorService()],
  ["F1_BACK_WALL_PLAIN", wallFace()],
  ["F1_BACK_WALL_VARIANT_A", wallFace("a")],
  ["F1_BACK_WALL_VARIANT_B", wallFace("b")],
  ["F1_SIDE_WALL_LEFT", sideWall("left")],
  ["F1_SIDE_WALL_RIGHT", sideWall("right")],
  ["F1_BACK_CORNER_LEFT", corner("left")],
  ["F1_BACK_CORNER_RIGHT", corner("right")],
  ["F1_SIDE_END_TOP", sideEnd("top")],
  ["F1_SIDE_END_BOTTOM", sideEnd("bottom")],
  ["F1_DOOR_H_FRAME", doorFrame(false)],
  ["F1_DOOR_H_CLOSED", doorFrame(true)],
]);

const alpha = (image, x, y) => image.pixels[(y * image.width + x) * 4 + 3];
const colorAt = (image, x, y) => image.pixels.subarray((y * image.width + x) * 4, (y * image.width + x + 1) * 4);
for (const [name, image] of assets) {
  const expected = name.startsWith("F1_BACK_") ? [32, 64] : name.startsWith("F1_DOOR_") ? [64, 64] : [32, 32];
  assert.deepEqual([image.width, image.height], expected, `${name} size`);
}
for (let y = 0; y < 32; y += 1) {
  assert.equal(alpha(assets.get("F1_SIDE_WALL_LEFT"), 9, y), 255);
  assert.equal(alpha(assets.get("F1_SIDE_WALL_LEFT"), 10, y), 0);
  assert.equal(alpha(assets.get("F1_SIDE_WALL_RIGHT"), 21, y), 0);
  assert.equal(alpha(assets.get("F1_SIDE_WALL_RIGHT"), 22, y), 255);
}
for (let y = 24; y < 64; y += 1) for (let x = 18; x < 46; x += 1) assert.equal(alpha(assets.get("F1_DOOR_H_FRAME"), x, y), 0, "door frame opening");
assert.equal(alpha(assets.get("F1_DOOR_H_CLOSED"), 31, 63), 255, "closed door leaf");
assert(colorAt(assets.get("F1_DOOR_H_FRAME"), 0, 10).equals(colorAt(assets.get("F1_BACK_WALL_PLAIN"), 0, 10)), "door joins back wall palette");

mkdirSync(outputDir, { recursive: true });
for (const [name, image] of assets) writeFileSync(resolve(outputDir, `${name}.png`), png(image));
console.log(`PASS floor1 room-shell assets (${assets.size})`);
