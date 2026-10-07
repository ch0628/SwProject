import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const TILE = 32;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const assetDir = resolve(root, "public/assets/environment/reinforcement/floor1_topdown_prototype");
const docsDir = resolve(root, "docs/modules/machine_learning/reinforcement/navigation");
const tilesetPath = resolve(root, "public/maps/reinforcement/floor1_topdown_prototype.tsj");
const blockoutPath = resolve(root, "public/maps/reinforcement/floor_1_blockout.tmj");
const beforeBlockout = createHash("sha256").update(readFileSync(blockoutPath)).digest("hex");

const palette = {
  publicFloor: "#E8E0D5",
  publicLight: "#F1EAE0",
  publicSeam: "#D1C7B9",
  serviceFloor: "#C8CCD0",
  serviceLight: "#D4D7D9",
  serviceSeam: "#ADB3B8",
  capLight: "#F1F3F2",
  capMid: "#D5D9D8",
  wallLight: "#E6DED3",
  wallMid: "#D8CEC1",
  wallShade: "#C5B8A8",
  cyan: "#58CAD5",
  cyanGlow: "#9FEAF0",
  charcoal: "#30363A",
  charcoalLight: "#4A5257",
  glass: "#657C88",
  glassLight: "#8EA8B2",
  shadow: "#151A1E",
  sheet: "#171C20",
};

const rgba = (hex, alpha = 255) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
};
const mix = (a, b, amount) => a.map((value, index) => Math.round(value + (b[index] - value) * amount));
const canvas = (width, height, color = null) => {
  const image = { width, height, pixels: Buffer.alloc(width * height * 4) };
  if (color) rect(image, 0, 0, width, height, color);
  return image;
};
function pixel(image, x, y, color) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const source = Array.isArray(color) ? color : rgba(color);
  const offset = (y * image.width + x) * 4;
  const alpha = source[3] / 255;
  for (let channel = 0; channel < 3; channel += 1) {
    image.pixels[offset + channel] = Math.round(source[channel] * alpha + image.pixels[offset + channel] * (1 - alpha));
  }
  image.pixels[offset + 3] = Math.round(source[3] + image.pixels[offset + 3] * (1 - alpha));
}
function rect(image, x, y, width, height, color, alpha = 255) {
  const value = rgba(color, alpha);
  for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) pixel(image, px, py, value);
}
function clearRect(image, x, y, width, height) {
  for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) {
    image.pixels.fill(0, (py * image.width + px) * 4, (py * image.width + px + 1) * 4);
  }
}
function gradient(image, x, y, width, height, top, bottom) {
  const from = rgba(top);
  const to = rgba(bottom);
  for (let py = 0; py < height; py += 1) {
    const value = mix(from, to, height === 1 ? 0 : py / (height - 1));
    for (let px = x; px < x + width; px += 1) pixel(image, px, y + py, value);
  }
}
function horizontalGradient(image, x, y, width, height, left, right) {
  const from = rgba(left);
  const to = rgba(right);
  for (let px = 0; px < width; px += 1) {
    const value = mix(from, to, width === 1 ? 0 : px / (width - 1));
    for (let py = y; py < y + height; py += 1) pixel(image, x + px, py, value);
  }
}
function roundedRect(image, x, y, width, height, radius, color) {
  const r = Math.min(radius, Math.floor(width / 2), Math.floor(height / 2));
  for (let py = 0; py < height; py += 1) for (let px = 0; px < width; px += 1) {
    const dx = px < r ? r - px - 0.5 : px >= width - r ? px - (width - r) + 0.5 : 0;
    const dy = py < r ? r - py - 0.5 : py >= height - r ? py - (height - r) + 0.5 : 0;
    if (dx * dx + dy * dy <= r * r) pixel(image, x + px, y + py, color);
  }
}
function blit(target, source, x, y, scale = 1) {
  for (let sy = 0; sy < source.height; sy += 1) for (let sx = 0; sx < source.width; sx += 1) {
    const offset = (sy * source.width + sx) * 4;
    const value = [...source.pixels.subarray(offset, offset + 4)];
    for (let dy = 0; dy < scale; dy += 1) for (let dx = 0; dx < scale; dx += 1) pixel(target, x + sx * scale + dx, y + sy * scale + dy, value);
  }
}
function copyColumn(target, targetX, source, sourceX) {
  for (let y = 0; y < Math.min(target.height, source.height); y += 1) {
    const offset = (y * source.width + sourceX) * 4;
    target.pixels.set(source.pixels.subarray(offset, offset + 4), (y * target.width + targetX) * 4);
  }
}
function copyRow(target, targetY, source, sourceY) {
  source.pixels.copy(target.pixels, targetY * target.width * 4, sourceY * source.width * 4, (sourceY + 1) * source.width * 4);
}

function floorSlab(base, light, seam) {
  const size = TILE * 2;
  const image = canvas(size, size);
  const baseRgb = rgba(base);
  const lightRgb = rgba(light);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const wave = (
      Math.cos((Math.PI * 2 * x) / 63)
      + Math.cos((Math.PI * 2 * y) / 63)
      + Math.cos((Math.PI * 2 * (x + y)) / 63)
    ) * 0.018 + 0.07;
    pixel(image, x, y, mix(baseRgb, lightRgb, wave));
  }
  rect(image, 0, 0, size, 1, seam, 42);
  rect(image, 0, size - 1, size, 1, seam, 42);
  rect(image, 0, 0, 1, size, seam, 42);
  rect(image, size - 1, 0, 1, size, seam, 42);
  return image;
}

function horizontalWall(width = TILE) {
  const image = canvas(width, 64);
  gradient(image, 0, 0, width, 6, palette.capLight, palette.capMid);
  rect(image, 0, 1, width, 1, palette.capLight);
  gradient(image, 0, 6, width, 24, palette.wallLight, palette.wallShade);
  rect(image, 0, 7, width, 1, palette.capLight, 72);
  gradient(image, 0, 29, width, 3, palette.wallMid, palette.wallShade);
  gradient(image, 0, 32, width, 6, palette.charcoalLight, palette.charcoal);
  for (let y = 0; y < 5; y += 1) rect(image, 0, 38 + y, width, 1, palette.shadow, 48 - y * 8);
  return image;
}

function verticalBody(height = TILE) {
  const image = canvas(TILE, height);
  horizontalGradient(image, 0, 0, 5, height, palette.charcoal, palette.charcoalLight);
  horizontalGradient(image, 5, 0, 22, height, palette.wallShade, palette.wallLight);
  rect(image, 6, 0, 1, height, palette.capLight, 72);
  rect(image, 26, 0, 1, height, palette.wallMid);
  horizontalGradient(image, 27, 0, 5, height, palette.charcoalLight, palette.charcoal);
  return image;
}

function verticalTop() {
  const body = verticalBody();
  const image = canvas(TILE, 48);
  roundedRect(image, 0, 0, TILE, 48, 5, palette.wallMid);
  roundedRect(image, 4, 3, 24, 45, 4, palette.wallLight);
  gradient(image, 4, 3, 24, 7, palette.capLight, palette.capMid);
  rect(image, 0, 9, 5, 39, palette.charcoal);
  rect(image, 27, 9, 5, 39, palette.charcoal);
  copyRow(image, 47, body, 0);
  return image;
}

function verticalBottom() {
  const image = verticalBody();
  gradient(image, 5, 23, 22, 7, palette.wallLight, palette.wallShade);
  rect(image, 5, 30, 22, 2, palette.charcoalLight);
  rect(image, 24, 24, 2, 3, palette.cyan);
  return image;
}

function innerCorner() {
  const horizontal = horizontalWall();
  const vertical = verticalBody();
  const image = canvas(TILE, 64);
  blit(image, horizontal, 0, 0);
  for (let y = 32; y < 64; y += 1) {
    const source = (y - 32) * vertical.width * 4;
    vertical.pixels.copy(image.pixels, y * image.width * 4, source, source + vertical.width * 4);
  }
  roundedRect(image, 3, 27, 29, 16, 5, palette.wallMid);
  roundedRect(image, 5, 29, 27, 12, 5, palette.wallLight);
  rect(image, 0, 27, 21, 5, palette.wallMid);
  rect(image, 27, 36, 5, 7, palette.charcoal);
  copyColumn(image, 0, horizontal, 31);
  copyRow(image, 63, vertical, 0);
  return image;
}

function outerCorner() {
  const horizontal = horizontalWall();
  const vertical = verticalBody();
  const image = canvas(TILE, 64);
  blit(image, horizontal, 0, 0);
  for (let y = 32; y < 64; y += 1) {
    const source = (y - 32) * vertical.width * 4;
    vertical.pixels.copy(image.pixels, y * image.width * 4, source, source + vertical.width * 4);
  }
  roundedRect(image, 0, 25, 32, 18, 5, palette.capMid);
  roundedRect(image, 3, 28, 29, 13, 5, palette.wallLight);
  rect(image, 0, 25, 26, 7, palette.capLight);
  rect(image, 27, 35, 5, 8, palette.charcoal);
  copyColumn(image, 0, horizontal, 31);
  copyRow(image, 63, vertical, 0);
  return image;
}

function door() {
  const image = horizontalWall(64);
  roundedRect(image, 12, 7, 40, 34, 4, palette.charcoal);
  gradient(image, 17, 11, 30, 18, palette.glassLight, palette.glass);
  rect(image, 17, 12, 30, 1, palette.capLight, 96);
  clearRect(image, 18, 29, 28, 35);
  gradient(image, 12, 29, 6, 35, palette.wallMid, palette.wallShade);
  gradient(image, 46, 29, 6, 35, palette.wallLight, palette.wallMid);
  rect(image, 47, 10, 4, 2, palette.cyan);
  return image;
}

const assets = new Map([
  ["F1_FLOOR_PUBLIC", floorSlab(palette.publicFloor, palette.publicLight, palette.publicSeam)],
  ["F1_FLOOR_SERVICE", floorSlab(palette.serviceFloor, palette.serviceLight, palette.serviceSeam)],
  ["F1_WALL_H_BODY", horizontalWall()],
  ["F1_WALL_V_TOP", verticalTop()],
  ["F1_WALL_V_BODY", verticalBody()],
  ["F1_WALL_V_BOTTOM", verticalBottom()],
  ["F1_CORNER_INNER", innerCorner()],
  ["F1_CORNER_OUTER", outerCorner()],
  ["F1_DOOR_H", door()],
]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function png(image) {
  const raw = Buffer.alloc((image.width * 4 + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) {
    const row = y * (image.width * 4 + 1);
    raw[row] = 0;
    image.pixels.copy(raw, row + 1, y * image.width * 4, (y + 1) * image.width * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function prototypePreview() {
  const image = canvas(384, 320, palette.sheet);
  for (let y = 0; y < 4; y += 1) for (let x = 0; x < 5; x += 1) {
    blit(image, assets.get(x > 3 && y > 1 ? "F1_FLOOR_SERVICE" : "F1_FLOOR_PUBLIC"), 32 + x * 64, 32 + y * 64);
  }
  for (let x = 64; x < 288; x += TILE) blit(image, assets.get("F1_WALL_H_BODY"), x, 32);
  blit(image, assets.get("F1_DOOR_H"), 160, 32);
  blit(image, assets.get("F1_CORNER_INNER"), 64, 32);
  blit(image, assets.get("F1_WALL_V_TOP"), 64, 80);
  blit(image, assets.get("F1_WALL_V_BODY"), 64, 128);
  blit(image, assets.get("F1_WALL_V_BODY"), 64, 160);
  blit(image, assets.get("F1_WALL_V_BOTTOM"), 64, 192);
  blit(image, assets.get("F1_CORNER_OUTER"), 288, 160);
  return image;
}

function contactSheet() {
  const image = canvas(1504, 416, palette.sheet);
  const values = [...assets.values()];
  let x = 24;
  for (const asset of values) {
    blit(image, asset, x, 24 + (64 - asset.height));
    x += asset.width + 24;
  }
  x = 24;
  for (const asset of values) {
    blit(image, asset, x, 128 + (256 - asset.height * 4), 4);
    x += asset.width * 4 + 24;
  }
  return image;
}

const samePixel = (image, ax, ay, bx, by) => {
  const a = (ay * image.width + ax) * 4;
  const b = (by * image.width + bx) * 4;
  return image.pixels.subarray(a, a + 4).equals(image.pixels.subarray(b, b + 4));
};
const equalBetween = (a, ax, ay, b, bx, by) => {
  const aOffset = (ay * a.width + ax) * 4;
  const bOffset = (by * b.width + bx) * 4;
  return a.pixels.subarray(aOffset, aOffset + 4).equals(b.pixels.subarray(bOffset, bOffset + 4));
};
const alpha = (image, x, y) => image.pixels[(y * image.width + x) * 4 + 3];
const alphaBounds = image => {
  let left = image.width, top = image.height, right = -1, bottom = -1;
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) if (alpha(image, x, y)) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return {
    left, top, right, bottom,
    padding: { left, top, right: image.width - 1 - right, bottom: image.height - 1 - bottom },
  };
};
assert.deepEqual([...assets.keys()], ["F1_FLOOR_PUBLIC", "F1_FLOOR_SERVICE", "F1_WALL_H_BODY", "F1_WALL_V_TOP", "F1_WALL_V_BODY", "F1_WALL_V_BOTTOM", "F1_CORNER_INNER", "F1_CORNER_OUTER", "F1_DOOR_H"]);
for (const name of ["F1_FLOOR_PUBLIC", "F1_FLOOR_SERVICE"]) {
  const image = assets.get(name);
  assert.deepEqual([image.width, image.height], [64, 64]);
  for (let i = 0; i < TILE * 2; i += 1) {
    assert(samePixel(image, 0, i, 63, i), `${name} left/right seam ${i}`);
    assert(samePixel(image, i, 0, i, 63), `${name} top/bottom seam ${i}`);
  }
}
for (const name of ["F1_WALL_H_BODY", "F1_CORNER_INNER", "F1_CORNER_OUTER"]) assert.deepEqual([assets.get(name).width, assets.get(name).height], [32, 64]);
assert.deepEqual([assets.get("F1_WALL_V_TOP").width, assets.get("F1_WALL_V_TOP").height], [32, 48]);
for (const name of ["F1_WALL_V_BODY", "F1_WALL_V_BOTTOM"]) assert.deepEqual([assets.get(name).width, assets.get(name).height], [32, 32]);
assert.deepEqual([assets.get("F1_DOOR_H").width, assets.get("F1_DOOR_H").height], [64, 64]);
for (let y = 32; y < 64; y += 1) for (let x = 18; x < 46; x += 1) assert.equal(assets.get("F1_DOOR_H").pixels[(y * 64 + x) * 4 + 3], 0, `F1_DOOR_H opening must stay transparent at ${x},${y}`);
for (let y = 0; y < 64; y += 1) assert(samePixel(assets.get("F1_WALL_H_BODY"), 0, y, 31, y), `F1_WALL_H_BODY repeat seam ${y}`);
for (let y = 0; y < 64; y += 1) {
  assert(equalBetween(assets.get("F1_WALL_H_BODY"), 0, y, assets.get("F1_DOOR_H"), 0, y), `F1_DOOR_H left join ${y}`);
  assert(equalBetween(assets.get("F1_WALL_H_BODY"), 31, y, assets.get("F1_DOOR_H"), 63, y), `F1_DOOR_H right join ${y}`);
}
for (const name of ["F1_CORNER_INNER", "F1_CORNER_OUTER"]) {
  const corner = assets.get(name);
  for (let y = 0; y < 64; y += 1) if (alpha(assets.get("F1_WALL_H_BODY"), 31, y)) {
    assert(equalBetween(assets.get("F1_WALL_H_BODY"), 31, y, corner, 0, y), `${name} horizontal visible seam ${y}`);
  }
  for (let x = 0; x < 32; x += 1) assert(equalBetween(corner, x, 63, assets.get("F1_WALL_V_BODY"), x, 0), `${name} vertical seam ${x}`);
}
for (let x = 0; x < TILE; x += 1) {
  assert(equalBetween(assets.get("F1_WALL_V_TOP"), x, 47, assets.get("F1_WALL_V_BODY"), x, 0), `F1_WALL_V_TOP -> BODY seam ${x}`);
  assert(equalBetween(assets.get("F1_WALL_V_BODY"), x, 31, assets.get("F1_WALL_V_BODY"), x, 0), `F1_WALL_V_BODY repeat seam ${x}`);
  assert(equalBetween(assets.get("F1_WALL_V_BODY"), x, 31, assets.get("F1_WALL_V_BOTTOM"), x, 0), `F1_WALL_V_BODY -> BOTTOM seam ${x}`);
}
const auditedAssets = ["F1_WALL_H_BODY", "F1_WALL_V_TOP", "F1_WALL_V_BODY", "F1_WALL_V_BOTTOM", "F1_CORNER_INNER", "F1_CORNER_OUTER", "F1_DOOR_H"];
const boundsAudit = Object.fromEntries(auditedAssets.map(name => [name, alphaBounds(assets.get(name))]));
for (const name of auditedAssets) {
  assert.equal(boundsAudit[name].padding.left, 0, `${name} has left transparent join padding`);
  assert.equal(boundsAudit[name].padding.right, 0, `${name} has right transparent join padding`);
}
assert.deepEqual(boundsAudit.F1_WALL_H_BODY.padding, { left: 0, top: 0, right: 0, bottom: 21 });
for (const name of auditedAssets.filter(name => name !== "F1_WALL_H_BODY")) assert.equal(boundsAudit[name].padding.bottom, 0, `${name} has bottom join padding`);
const cyan = rgba(palette.cyan);
const cyanPixels = (image) => {
  let count = 0;
  for (let offset = 0; offset < image.pixels.length; offset += 4) if (image.pixels.subarray(offset, offset + 4).equals(Buffer.from(cyan))) count += 1;
  return count;
};
assert.equal(cyanPixels(assets.get("F1_WALL_H_BODY")), 0, "F1_WALL_H_BODY cyan must not repeat every tile");
assert.equal(cyanPixels(assets.get("F1_WALL_V_BODY")), 0, "F1_WALL_V_BODY cyan must not repeat every tile");
assert(cyanPixels(assets.get("F1_WALL_V_BOTTOM")) <= 6, "F1_WALL_V_BOTTOM cyan must stay punctuation-sized");

mkdirSync(assetDir, { recursive: true });
mkdirSync(docsDir, { recursive: true });
for (const legacy of ["F1_WALL_H.png", "F1_WALL_V.png"]) rmSync(resolve(assetDir, legacy), { force: true });
for (const [name, image] of assets) writeFileSync(resolve(assetDir, `${name}.png`), png(image));
writeFileSync(resolve(docsDir, "floor_1_topdown_prototype_preview.png"), png(prototypePreview()));
writeFileSync(resolve(docsDir, "floor_1_topdown_prototype_contact_sheet.png"), png(contactSheet()));

const footprints = { F1_FLOOR_PUBLIC: [64, 64], F1_FLOOR_SERVICE: [64, 64], F1_DOOR_H: [64, 32] };
const tileset = {
  columns: 0,
  grid: { height: TILE, orientation: "orthogonal", width: TILE },
  name: "floor1_topdown_prototype",
  tilecount: assets.size,
  tileheight: 64,
  tilewidth: 64,
  tiledversion: "1.12.2",
  type: "tileset",
  version: "1.10",
  properties: [
    { name: "camera", type: "string", value: "orthographic-3/4-top-down" },
    { name: "gameplayGridPx", type: "int", value: TILE },
    { name: "prototypeOnly", type: "bool", value: true },
    { name: "spriteOrigin", type: "string", value: "bottom-left (0,1)" },
    { name: "depthBaseline", type: "string", value: "footprint-south-edge" },
  ],
  tiles: [...assets].map(([name, image], id) => {
    const [footprintWidth, footprintHeight] = footprints[name] ?? [32, 32];
    return {
      id,
      class: name,
      image: `../../assets/environment/reinforcement/floor1_topdown_prototype/${name}.png`,
      imageheight: image.height,
      imagewidth: image.width,
      properties: [
        { name: "assetId", type: "string", value: name },
        { name: "footprintWidth", type: "int", value: footprintWidth },
        { name: "footprintHeight", type: "int", value: footprintHeight },
        { name: "northOverhangPx", type: "int", value: name.startsWith("F1_FLOOR") || name.startsWith("F1_WALL_V") ? Math.max(0, image.height - footprintHeight) : 32 },
      ],
    };
  }),
};
writeFileSync(tilesetPath, `${JSON.stringify(tileset, null, 2)}\n`);

const afterBlockout = createHash("sha256").update(readFileSync(blockoutPath)).digest("hex");
assert.equal(afterBlockout, beforeBlockout, "floor_1_blockout.tmj changed");
console.log("PASS floor1_topdown_prototype");
console.log("assets=9 floorSlabs=64x64 wallH=32x64 wallV=top/body/bottom door=64x64 grid=32px");
console.log("floor_seams=64px wall_h_repeat=exact wall_v_body=continuous blockout=unchanged");
console.log(`alpha_bounds=${JSON.stringify(boundsAudit)}`);
