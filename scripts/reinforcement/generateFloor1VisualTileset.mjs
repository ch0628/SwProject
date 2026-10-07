import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const WIDTH = 80;
const HEIGHT = 45;
const TILE = 32;
const COLUMNS = 8;
const TILE_COUNT = 48;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "../..");
const mapPath = resolve(root, "public/maps/reinforcement/floor_1_blockout.tmj");
const tilesetPath = resolve(root, "public/maps/reinforcement/floor1_visual_tileset.tsj");
const moduleTilesetPath = resolve(root, "public/maps/reinforcement/floor1_visual_modules.tsj");
const imagePath = resolve(root, "public/assets/environment/reinforcement/floor1/floor1_tileset.png");
const moduleDir = dirname(imagePath);
const previewPath = resolve(root, "docs/modules/machine_learning/reinforcement/navigation/floor_1_visual_preview.png");
const contactSheetPath = resolve(root, "docs/modules/machine_learning/reinforcement/navigation/floor_1_visual_module_contact_sheet.png");

export const palette = {
  publicFloor: "#E9DCC8",
  publicHighlight: "#F4EBDD",
  serviceFloor: "#D8D4CC",
  wallFace: "#C9C6D2",
  wallSide: "#9B97A8",
  wallTop: "#DEE4EA",
  baseTrim: "#30333B",
  cyan: "#31CFE6",
  doorFrame: "#3E4650",
  doorPanel: "#7E8791",
  glass: "#78AEBB",
  shadow: "#2A2D34",
  floor: "#E9DCC8",
  floorAlt: "#F4EBDD",
  floorGrout: "#9B97A8",
  wallFaceAlt: "#9B97A8",
  wallShade: "#9B97A8",
  panelLine: "#7E8791",
  panelLight: "#DEE4EA",
  trim: "#30333B",
  glassLight: "#DEE4EA",
  warm: "#F4EBDD",
  warmDark: "#3E4650",
  locked: "#31CFE6",
  white: "#F4EBDD",
};

const property = (name, value) => ({
  name,
  type: typeof value === "boolean" ? "bool" : Number.isInteger(value) ? "int" : "string",
  value,
});
const properties = (values) => Object.entries(values).map(([name, value]) => property(name, value));
const gid = (tileId) => tileId + 1;
const at = (x, y) => y * WIDTH + x;
const inside = (x, y) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;

const sourceText = readFileSync(mapPath, "utf8");
const sourceMap = JSON.parse(sourceText);
const objectSnapshot = JSON.stringify(sourceMap.layers.filter((layer) => layer.type === "objectgroup"));
const layer = (name) => sourceMap.layers.find((candidate) => candidate.name === name);
const decode = (name) => {
  const current = layer(name);
  if (!current) throw new Error(`missing visual layer ${name}`);
  if (Array.isArray(current.data)) return current.data;
  const bytes = inflateSync(Buffer.from(current.data, "base64"));
  return Array.from({ length: bytes.length / 4 }, (_, index) => bytes.readUInt32LE(index * 4));
};
const encode = (values) => {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => bytes.writeUInt32LE(value, index * 4));
  return deflateSync(bytes, { level: 9 }).toString("base64");
};
const replaceLayerData = (text, name, data) => {
  const nameIndex = text.indexOf(`"name":"${name}"`);
  const dataKey = text.lastIndexOf('"data":"', nameIndex);
  if (nameIndex < 0 || dataKey < 0) throw new Error(`cannot locate serialized layer ${name}`);
  const valueStart = dataKey + 8;
  const valueEnd = text.indexOf('"', valueStart);
  return `${text.slice(0, valueStart)}${data}${text.slice(valueEnd)}`;
};

const oldGround = decode("Ground");
const oldWalls = decode("Walls");
const oldWallTop = decode("WallTop");
const walkable = oldGround.map(Boolean);
const wall = oldWalls.map(Boolean);
const ground = Array(WIDTH * HEIGHT).fill(0);
const detail = Array(WIDTH * HEIGHT).fill(0);
const walls = Array(WIDTH * HEIGHT).fill(0);
const wallTop = Array(WIDTH * HEIGHT).fill(0);
const propsLayer = Array(WIDTH * HEIGHT).fill(0);

for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    if (!walkable[at(x, y)]) continue;
    const lobby = (x >= 22 && x <= 57 && y >= 31) || (x >= 36 && x <= 43 && y >= 39);
    const base = lobby ? 0 : x < 28 ? 1 : x >= 52 ? 2 : 0;
    ground[at(x, y)] = gid((x * 3 + y * 5) % 19 === 0 ? 3 : base);
  }
}

const hasWall = (x, y) => inside(x, y) && wall[at(x, y)];
const hasGround = (x, y) => inside(x, y) && walkable[at(x, y)];
function wallTile(x, y) {
  const n = hasWall(x, y - 1);
  const e = hasWall(x + 1, y);
  const s = hasWall(x, y + 1);
  const w = hasWall(x - 1, y);
  const count = Number(n) + Number(e) + Number(s) + Number(w);
  if (count === 4) return 44;
  if (count === 3) return !n ? 18 : !e ? 19 : !s ? 20 : 21;
  if (e && w) return 4;
  if (n && s) return 5;
  if (e && s) return hasGround(x - 1, y - 1) ? 6 : 10;
  if (w && s) return hasGround(x + 1, y - 1) ? 7 : 11;
  if (w && n) return hasGround(x + 1, y + 1) ? 8 : 12;
  if (e && n) return hasGround(x - 1, y + 1) ? 9 : 13;
  if (e) return 14;
  if (w) return 15;
  if (s) return 16;
  if (n) return 17;
  return 44;
}
for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    if (wall[at(x, y)]) walls[at(x, y)] = gid(wallTile(x, y));
    if (oldWallTop[at(x, y)]) wallTop[at(x, y)] = gid(hasWall(x - 1, y) || hasWall(x + 1, y) ? 37 : 38);
  }
}

// Glazed lobby frontage stays on the exact existing blocking wall footprint.
for (const [x0, y0, x1, y1, tile] of [
  [32, 42, 35, 42, 27], [44, 42, 47, 42, 27],
  [35, 43, 35, 44, 28], [44, 43, 44, 44, 28],
]) for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) if (wall[at(x, y)]) walls[at(x, y)] = gid(tile);

// Existing stair footprint: 8x7 each. Transition rows are landings; geometry is unchanged.
for (const x0 of [8, 64]) {
  for (let y = 2; y <= 8; y += 1) for (let x = x0; x < x0 + 8; x += 1) detail[at(x, y)] = gid(y <= 3 ? 31 : 30);
  for (let y = 9; y <= 11; y += 1) for (let x = x0; x < x0 + 8; x += 1) detail[at(x, y)] = gid(41);
}
for (const [x0, y0, x1, y1] of [[28, 11, 38, 18], [28, 21, 38, 30], [41, 11, 51, 20], [41, 23, 51, 30]]) {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) detail[at(x, y)] = gid(39);
}
for (const x of [39, 40]) detail[at(x, 42)] = gid(29);

const paint = (x0, y0, x1, y1, tile) => {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) propsLayer[at(x, y)] = gid(tile);
};
paint(36, 34, 43, 35, 32);
paint(36, 34, 36, 35, 45);
paint(43, 34, 43, 35, 45);
paint(24, 36, 24, 38, 34);
paint(27, 40, 29, 40, 33);
paint(27, 40, 27, 40, 46);
paint(29, 40, 29, 40, 46);
paint(30, 39, 31, 39, 35);
paint(34, 30, 45, 30, 36);
for (const object of sourceMap.layers.find((candidate) => candidate.name === "Collision").objects) {
  if ((object.class ?? object.type) !== "LockedDoor") continue;
  const x0 = object.x / TILE;
  const y0 = object.y / TILE;
  paint(x0, y0, x0 + object.width / TILE - 1, y0 + object.height / TILE - 1, object.width >= object.height ? 25 : 26);
}

const rgba = (hex, alpha = 255) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
};
const imageWidth = COLUMNS * TILE;
const imageHeight = Math.ceil(TILE_COUNT / COLUMNS) * TILE;
const pixels = Buffer.alloc(imageWidth * imageHeight * 4);
const rect = (tile, x, y, width, height, color, alpha = 255) => {
  const [r, g, b, a] = rgba(color, alpha);
  const ox = (tile % COLUMNS) * TILE;
  const oy = Math.floor(tile / COLUMNS) * TILE;
  for (let py = Math.max(0, y); py < Math.min(TILE, y + height); py += 1) {
    for (let px = Math.max(0, x); px < Math.min(TILE, x + width); px += 1) {
      const offset = ((oy + py) * imageWidth + ox + px) * 4;
      pixels.set([r, g, b, a], offset);
    }
  }
};
const floorTile = (tile, color, grout = palette.floorGrout) => {
  rect(tile, 0, 0, 32, 32, color);
  rect(tile, 0, 0, 32, 1, grout);
  rect(tile, 0, 0, 1, 32, grout);
  rect(tile, 15, 0, 1, 32, grout);
  rect(tile, 0, 15, 32, 1, grout);
  rect(tile, 16, 16, 15, 1, palette.white);
  rect(tile, 16, 16, 1, 15, palette.white);
};
const wallBase = (tile) => {
  rect(tile, 0, 0, 32, 32, palette.wallFace);
  rect(tile, 8, 8, 8, 18, palette.wallFaceAlt);
  rect(tile, 24, 8, 8, 18, palette.wallFaceAlt);
  rect(tile, 0, 0, 32, 5, palette.wallTop);
  rect(tile, 0, 0, 32, 1, palette.white);
  rect(tile, 0, 6, 32, 2, palette.cyan);
  for (const x of [8, 16, 24]) rect(tile, x, 8, 1, 18, palette.panelLine);
  for (const x of [9, 25]) rect(tile, x, 8, 1, 18, palette.panelLight);
  rect(tile, 0, 26, 32, 2, palette.wallShade);
  rect(tile, 0, 28, 32, 4, palette.trim);
};
const verticalWall = (tile) => {
  rect(tile, 0, 0, 32, 32, palette.wallFace);
  rect(tile, 8, 8, 18, 8, palette.wallFaceAlt);
  rect(tile, 8, 24, 18, 8, palette.wallFaceAlt);
  rect(tile, 0, 0, 5, 32, palette.wallTop);
  rect(tile, 0, 0, 1, 32, palette.white);
  rect(tile, 6, 0, 2, 32, palette.cyan);
  for (const y of [8, 16, 24]) rect(tile, 8, y, 18, 1, palette.panelLine);
  for (const y of [9, 25]) rect(tile, 8, y, 18, 1, palette.panelLight);
  rect(tile, 26, 0, 2, 32, palette.wallShade);
  rect(tile, 28, 0, 4, 32, palette.trim);
};
floorTile(0, palette.floor);
floorTile(1, palette.publicFloor);
floorTile(2, palette.serviceFloor, palette.panelLight);
floorTile(3, palette.floorAlt);
wallBase(4); rect(4, 15, 8, 2, 18, palette.wallShade);
verticalWall(5); rect(5, 8, 15, 18, 2, palette.wallShade);
for (const tile of [6, 7, 8, 9, 10, 11, 12, 13, 18, 19, 20, 21, 44]) {
  wallBase(tile);
  rect(tile, 6, 6, 2, 20, palette.cyan);
  if ([7, 8, 11, 12, 19, 21, 44].includes(tile)) rect(tile, 24, 6, 2, 20, palette.cyan);
  if (tile >= 10 && tile <= 13) rect(tile, 10, 10, 12, 12, palette.wallFaceAlt);
}
wallBase(14); rect(14, 0, 0, 4, 32, palette.trim);
wallBase(15); rect(15, 28, 0, 4, 32, palette.trim);
verticalWall(16); rect(16, 0, 0, 32, 4, palette.trim);
verticalWall(17); rect(17, 0, 28, 32, 4, palette.trim);
wallBase(22); rect(22, 9, 10, 14, 18, palette.glass);
verticalWall(23); rect(23, 10, 9, 18, 14, palette.glass);
rect(24, 3, 2, 26, 30, palette.warmDark); rect(24, 6, 5, 20, 24, palette.warm); rect(24, 22, 16, 2, 2, palette.trim);
wallBase(25); rect(25, 4, 9, 24, 19, palette.trim); rect(25, 7, 11, 18, 15, palette.wallShade); rect(25, 7, 11, 18, 2, palette.locked);
verticalWall(26); rect(26, 9, 4, 19, 24, palette.trim); rect(26, 11, 7, 15, 18, palette.wallShade); rect(26, 11, 7, 2, 18, palette.locked);
for (const tile of [27, 28]) {
  rect(tile, 0, 0, 32, 32, palette.glass, 185);
  rect(tile, 0, 0, 32, 4, palette.trim);
  rect(tile, 0, 4, 32, 2, palette.cyan);
  rect(tile, 5, 9, 3, 18, palette.glassLight, 210);
  rect(tile, 24, 9, 3, 18, palette.glassLight, 210);
}
rect(29, 0, 3, 32, 3, palette.trim); rect(29, 4, 6, 24, 22, palette.glass, 145); rect(29, 15, 6, 2, 22, palette.cyan); rect(29, 3, 28, 26, 2, palette.trim);
rect(30, 0, 0, 32, 32, palette.serviceFloor); for (let y = 3; y < 32; y += 5) { rect(30, 0, y, 32, 2, palette.wallShade); rect(30, 0, y, 32, 1, palette.white); }
floorTile(31, palette.floorAlt); rect(31, 0, 4, 32, 3, palette.cyan); rect(31, 0, 26, 32, 3, palette.trim);
rect(32, 0, 7, 32, 25, palette.warmDark); rect(32, 0, 4, 32, 8, palette.warm); rect(32, 2, 2, 28, 3, palette.white); rect(32, 5, 15, 22, 2, palette.cyan);
rect(33, 0, 8, 32, 24, palette.wallShade); rect(33, 2, 6, 28, 17, palette.glass); rect(33, 5, 9, 10, 3, palette.glassLight); rect(33, 17, 9, 10, 3, palette.glassLight);
rect(34, 8, 0, 24, 32, palette.wallShade); rect(34, 6, 2, 17, 28, palette.glass); rect(34, 9, 5, 3, 10, palette.glassLight); rect(34, 9, 17, 3, 10, palette.glassLight);
rect(35, 3, 10, 26, 16, palette.warmDark); rect(35, 5, 7, 22, 14, palette.warm); rect(35, 8, 21, 3, 9, palette.trim); rect(35, 21, 21, 3, 9, palette.trim);
wallBase(36); rect(36, 3, 9, 26, 14, palette.trim); rect(36, 5, 11, 22, 10, palette.glass); rect(36, 7, 13, 13, 2, palette.cyan); rect(36, 7, 17, 18, 2, palette.white);
rect(37, 0, 0, 32, 7, palette.wallTop); rect(37, 0, 6, 32, 2, palette.cyan);
rect(38, 0, 0, 7, 32, palette.wallTop); rect(38, 6, 0, 2, 32, palette.cyan);
rect(39, 0, 0, 32, 32, "#77848A"); rect(39, 2, 2, 28, 28, palette.wallShade); rect(39, 4, 4, 24, 2, palette.cyan);
rect(40, 0, 14, 32, 4, palette.trim); rect(40, 0, 15, 32, 2, palette.cyan);
rect(41, 0, 0, 32, 2, palette.cyan); rect(41, 8, 8, 16, 16, palette.glass, 70);
wallBase(42); rect(42, 4, 8, 24, 20, palette.trim); rect(42, 8, 8, 16, 3, palette.cyan);
verticalWall(43); rect(43, 8, 4, 20, 24, palette.trim); rect(43, 8, 8, 3, 16, palette.cyan);
rect(45, 0, 7, 32, 25, palette.warmDark); rect(45, 0, 4, 32, 8, palette.warm); rect(45, 2, 2, 28, 3, palette.white); rect(45, 0, 7, 4, 25, palette.trim); rect(45, 28, 7, 4, 25, palette.trim);
rect(46, 0, 8, 32, 24, palette.wallShade); rect(46, 2, 6, 28, 17, palette.glass); rect(46, 0, 8, 5, 24, palette.trim); rect(46, 27, 8, 5, 24, palette.trim);
wallBase(47); rect(47, 5, 10, 22, 12, palette.trim); rect(47, 7, 12, 18, 8, palette.glass); rect(47, 9, 14, 14, 2, palette.cyan);

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
function pngFromPixels(source, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    source.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
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

const makeCanvas = (width, height, color = null) => {
  const canvas = { width, height, pixels: Buffer.alloc(width * height * 4) };
  if (color) moduleRect(canvas, 0, 0, width, height, color);
  return canvas;
};
function moduleRect(canvas, x, y, width, height, color, alpha = 255) {
  const value = rgba(color, alpha);
  for (let py = Math.max(0, y); py < Math.min(canvas.height, y + height); py += 1) {
    for (let px = Math.max(0, x); px < Math.min(canvas.width, x + width); px += 1) {
      canvas.pixels.set(value, (py * canvas.width + px) * 4);
    }
  }
}
function clearRect(canvas, x, y, width, height) {
  for (let py = Math.max(0, y); py < Math.min(canvas.height, y + height); py += 1) {
    canvas.pixels.fill(0, (py * canvas.width + Math.max(0, x)) * 4, (py * canvas.width + Math.min(canvas.width, x + width)) * 4);
  }
}
function blit(target, source, targetX, targetY) {
  for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
    const sourceOffset = (y * source.width + x) * 4;
    const alpha = source.pixels[sourceOffset + 3] / 255;
    if (!alpha) continue;
    const px = targetX + x;
    const py = targetY + y;
    if (px < 0 || py < 0 || px >= target.width || py >= target.height) continue;
    const targetOffset = (py * target.width + px) * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      target.pixels[targetOffset + channel] = Math.round(
        source.pixels[sourceOffset + channel] * alpha + target.pixels[targetOffset + channel] * (1 - alpha),
      );
    }
    target.pixels[targetOffset + 3] = 255;
  }
}

const floorModule = (base, highlight) => {
  const canvas = makeCanvas(32, 32, base);
  moduleRect(canvas, 15, 0, 1, 32, palette.wallSide);
  moduleRect(canvas, 0, 15, 32, 1, palette.wallSide);
  moduleRect(canvas, 16, 16, 14, 1, highlight);
  moduleRect(canvas, 16, 16, 1, 14, highlight);
  return canvas;
};
const horizontalWallModule = () => {
  const canvas = makeCanvas(32, 72);
  moduleRect(canvas, 0, 64, 32, 8, palette.shadow, 64);
  moduleRect(canvas, 0, 0, 32, 8, palette.wallTop);
  moduleRect(canvas, 0, 8, 32, 48, palette.wallFace);
  moduleRect(canvas, 0, 12, 32, 4, palette.cyan);
  moduleRect(canvas, 15, 16, 1, 40, palette.doorPanel);
  moduleRect(canvas, 16, 16, 1, 40, palette.wallTop);
  moduleRect(canvas, 0, 56, 32, 8, palette.baseTrim);
  return canvas;
};
const verticalWallModule = () => {
  const canvas = makeCanvas(32, 72);
  moduleRect(canvas, 4, 64, 28, 8, palette.shadow, 64);
  moduleRect(canvas, 0, 0, 24, 8, palette.wallTop);
  moduleRect(canvas, 24, 0, 8, 8, palette.wallSide);
  moduleRect(canvas, 0, 8, 24, 48, palette.wallFace);
  moduleRect(canvas, 24, 8, 8, 48, palette.wallSide);
  moduleRect(canvas, 0, 12, 24, 4, palette.cyan);
  moduleRect(canvas, 24, 12, 8, 4, palette.cyan);
  moduleRect(canvas, 0, 32, 24, 1, palette.doorPanel);
  moduleRect(canvas, 0, 56, 24, 8, palette.baseTrim);
  moduleRect(canvas, 24, 56, 8, 8, palette.doorFrame);
  return canvas;
};
const cornerModule = (inner) => {
  const canvas = horizontalWallModule();
  moduleRect(canvas, 24, 0, 8, 8, inner ? palette.wallSide : palette.wallTop);
  moduleRect(canvas, 24, 8, 8, 48, palette.wallSide);
  moduleRect(canvas, 24, 12, 8, 4, palette.cyan);
  moduleRect(canvas, 24, 56, 8, 8, palette.doorFrame);
  if (inner) moduleRect(canvas, 20, 16, 4, 40, palette.shadow, 96);
  else moduleRect(canvas, 28, 8, 4, 48, palette.wallTop);
  moduleRect(canvas, 31, 0, 1, 8, palette.wallTop);
  moduleRect(canvas, 31, 8, 1, 48, palette.wallFace);
  moduleRect(canvas, 31, 12, 1, 4, palette.cyan);
  moduleRect(canvas, 31, 32, 1, 1, palette.doorPanel);
  moduleRect(canvas, 31, 56, 1, 8, palette.baseTrim);
  clearRect(canvas, 31, 64, 1, 8);
  return canvas;
};
const endModule = (vertical) => {
  const canvas = vertical ? verticalWallModule() : horizontalWallModule();
  if (vertical) {
    moduleRect(canvas, 0, 0, 32, 8, palette.wallTop);
    moduleRect(canvas, 0, 8, 32, 48, palette.wallSide);
    moduleRect(canvas, 0, 12, 32, 4, palette.cyan);
    moduleRect(canvas, 0, 56, 32, 8, palette.doorFrame);
  } else {
    moduleRect(canvas, 24, 0, 8, 8, palette.wallSide);
    moduleRect(canvas, 24, 8, 8, 48, palette.wallSide);
    moduleRect(canvas, 24, 12, 8, 4, palette.cyan);
    moduleRect(canvas, 24, 56, 8, 8, palette.doorFrame);
  }
  return canvas;
};
const doorModule = (closed) => {
  const canvas = makeCanvas(64, 72);
  moduleRect(canvas, 0, 64, 64, 8, palette.shadow, 64);
  moduleRect(canvas, 0, 0, 64, 8, palette.wallTop);
  moduleRect(canvas, 0, 8, 64, 48, palette.wallFace);
  moduleRect(canvas, 0, 12, 8, 4, palette.cyan);
  moduleRect(canvas, 56, 12, 8, 4, palette.cyan);
  moduleRect(canvas, 0, 56, 64, 8, palette.baseTrim);
  moduleRect(canvas, 4, 8, 56, 48, palette.doorFrame);
  moduleRect(canvas, 8, 12, 48, 44, closed ? palette.doorPanel : palette.shadow, closed ? 255 : 210);
  if (closed) {
    moduleRect(canvas, 31, 12, 2, 44, palette.doorFrame);
    moduleRect(canvas, 49, 20, 4, 8, palette.cyan);
  } else {
    moduleRect(canvas, 8, 12, 4, 44, palette.wallSide);
    moduleRect(canvas, 52, 12, 4, 44, palette.wallSide);
  }
  return canvas;
};
const stairModule = () => {
  const canvas = makeCanvas(256, 224, palette.serviceFloor);
  moduleRect(canvas, 0, 0, 8, 224, palette.baseTrim);
  moduleRect(canvas, 248, 0, 8, 224, palette.baseTrim);
  moduleRect(canvas, 8, 0, 240, 8, palette.wallTop);
  moduleRect(canvas, 8, 8, 240, 4, palette.cyan);
  moduleRect(canvas, 8, 12, 240, 20, palette.publicHighlight);
  for (let y = 32; y < 192; y += 8) {
    moduleRect(canvas, 8, y, 240, 7, palette.wallTop);
    moduleRect(canvas, 8, y + 7, 240, 1, palette.wallSide);
  }
  moduleRect(canvas, 8, 192, 240, 32, palette.publicFloor);
  moduleRect(canvas, 8, 192, 240, 4, palette.cyan);
  return canvas;
};
const receptionModule = () => {
  const canvas = makeCanvas(256, 64);
  moduleRect(canvas, 6, 56, 250, 8, palette.shadow, 64);
  moduleRect(canvas, 0, 8, 256, 8, palette.wallTop);
  moduleRect(canvas, 0, 16, 256, 40, palette.wallFace);
  moduleRect(canvas, 0, 48, 256, 8, palette.baseTrim);
  moduleRect(canvas, 16, 24, 224, 20, palette.wallSide);
  moduleRect(canvas, 16, 28, 224, 4, palette.cyan);
  moduleRect(canvas, 0, 16, 8, 40, palette.doorFrame);
  moduleRect(canvas, 248, 16, 8, 40, palette.doorFrame);
  return canvas;
};

const moduleEntries = [
  ["F1_FLOOR_PUBLIC", floorModule(palette.publicFloor, palette.publicHighlight), 32, 32],
  ["F1_FLOOR_SERVICE", floorModule(palette.serviceFloor, palette.wallTop), 32, 32],
  ["F1_WALL_H", horizontalWallModule(), 32, 32],
  ["F1_WALL_V", verticalWallModule(), 32, 32],
  ["F1_WALL_CORNER_INNER", cornerModule(true), 32, 32],
  ["F1_WALL_CORNER_OUTER", cornerModule(false), 32, 32],
  ["F1_WALL_END_H", endModule(false), 32, 32],
  ["F1_WALL_END_V", endModule(true), 32, 32],
  ["F1_DOORWAY_OPEN", doorModule(false), 64, 32],
  ["F1_DOOR_STAFF_CLOSED", doorModule(true), 64, 32],
  ["F1_STAIR_STRAIGHT", stairModule(), 256, 224],
  ["F1_RECEPTION_DESK", receptionModule(), 256, 64],
];
const contactPlacements = [
  ["F1_FLOOR_PUBLIC", 16, 16], ["F1_FLOOR_SERVICE", 96, 16],
  ["F1_WALL_H", 176, 8], ["F1_WALL_V", 224, 8],
  ["F1_WALL_CORNER_INNER", 272, 8], ["F1_WALL_CORNER_OUTER", 320, 8],
  ["F1_WALL_END_H", 368, 8], ["F1_WALL_END_V", 416, 8],
  ["F1_DOORWAY_OPEN", 464, 8], ["F1_DOOR_STAFF_CLOSED", 544, 8],
  ["F1_STAIR_STRAIGHT", 16, 104], ["F1_RECEPTION_DESK", 304, 104],
];
const moduleById = new Map(moduleEntries.map(([id, canvas]) => [id, canvas]));
function contactSheetPng() {
  const canvas = makeCanvas(624, 344, palette.baseTrim);
  for (const [id, x, y] of contactPlacements) {
    const source = moduleById.get(id);
    if (id === "F1_FLOOR_PUBLIC" || id === "F1_FLOOR_SERVICE") {
      for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) blit(canvas, source, x + dx * 32, y + dy * 32);
    } else blit(canvas, source, x, y);
  }
  for (let i = 0; i < 3; i += 1) blit(canvas, moduleById.get("F1_WALL_H"), 304 + i * 32, 184);
  blit(canvas, moduleById.get("F1_WALL_H"), 304, 264);
  blit(canvas, moduleById.get("F1_WALL_CORNER_INNER"), 336, 264);
  blit(canvas, moduleById.get("F1_WALL_V"), 368, 264);
  blit(canvas, moduleById.get("F1_WALL_H"), 432, 264);
  blit(canvas, moduleById.get("F1_WALL_CORNER_OUTER"), 464, 264);
  blit(canvas, moduleById.get("F1_WALL_V"), 496, 264);
  return pngFromPixels(canvas.pixels, canvas.width, canvas.height);
}

function previewPng() {
  const width = WIDTH * TILE;
  const height = HEIGHT * TILE;
  const preview = Buffer.alloc(width * height * 4);
  const background = rgba("#172027");
  for (let offset = 0; offset < preview.length; offset += 4) preview.set(background, offset);
  for (const data of [ground, detail, walls, propsLayer, wallTop]) {
    for (let cell = 0; cell < data.length; cell += 1) {
      if (!data[cell]) continue;
      const tile = data[cell] - 1;
      const sourceX = (tile % COLUMNS) * TILE;
      const sourceY = Math.floor(tile / COLUMNS) * TILE;
      const targetX = (cell % WIDTH) * TILE;
      const targetY = Math.floor(cell / WIDTH) * TILE;
      for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) {
        const sourceOffset = ((sourceY + y) * imageWidth + sourceX + x) * 4;
        const alpha = pixels[sourceOffset + 3] / 255;
        if (!alpha) continue;
        const targetOffset = ((targetY + y) * width + targetX + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          preview[targetOffset + channel] = Math.round(pixels[sourceOffset + channel] * alpha + preview[targetOffset + channel] * (1 - alpha));
        }
        preview[targetOffset + 3] = 255;
      }
    }
  }
  return pngFromPixels(preview, width, height);
}

const names = [
  "LobbyFloor", "PublicCorridorFloor", "ServiceCorridorFloor", "FloorVariation",
  "WallHorizontal", "WallVertical", "OuterCornerNW", "OuterCornerNE", "OuterCornerSE", "OuterCornerSW",
  "InnerCornerNW", "InnerCornerNE", "InnerCornerSE", "InnerCornerSW", "HorizontalCapW", "HorizontalCapE",
  "VerticalCapN", "VerticalCapS", "TJunctionN", "TJunctionE", "TJunctionS", "TJunctionW",
  "DoorwayWallHorizontal", "DoorwayWallVertical", "OfficeDoor", "LockedDoorHorizontal", "LockedDoorVertical",
  "GlassWallHorizontal", "GlassWallVertical", "GlassEntranceDoor", "StairTread", "StairLanding",
  "ReceptionDesk", "WaitingSofaHorizontal", "WaitingSofaVertical", "LowTable", "CompanyDisplay",
  "WallTopHorizontal", "WallTopVertical", "LockedRoomFloor", "ServiceAccent", "LobbyAccent",
  "DoorFrameHorizontal", "DoorFrameVertical", "WallCross", "ReceptionDeskEnd", "WaitingSofaEnd", "TechPanel",
];
const tiles = names.map((name, id) => {
  const values = { module: name };
  if (id <= 3) values.walkable = true;
  if ([30, 31, 40, 41].includes(id)) values.walkable = true;
  if ([30, 31].includes(id)) values.stair = true;
  if (id >= 4 && id <= 29 || id >= 32 && id <= 39 || id >= 42) values.visualSolid = true;
  return { id, class: name, properties: properties(values) };
});
const tileset = {
  columns: COLUMNS,
  image: "../../assets/environment/reinforcement/floor1/floor1_tileset.png",
  imagewidth: imageWidth,
  imageheight: imageHeight,
  margin: 0,
  spacing: 0,
  name: "floor1_visual_tileset",
  tilecount: TILE_COUNT,
  tilewidth: TILE,
  tileheight: TILE,
  type: "tileset",
  version: "1.10",
  tiledversion: "1.12.2",
  properties: properties({
    artDirection: "clean-near-future-corporate",
    deterministic: true,
    moduleTileset: "floor1_visual_modules.tsj",
    palette: JSON.stringify(palette),
  }),
  tiles,
};
const moduleTileset = {
  columns: 0,
  grid: { height: TILE, orientation: "orthogonal", width: TILE },
  margin: 0,
  name: "floor1_visual_modules",
  spacing: 0,
  tilecount: moduleEntries.length,
  tileheight: 224,
  tilewidth: 256,
  type: "tileset",
  version: "1.10",
  tiledversion: "1.12.2",
  properties: properties({
    artDirection: "clean-near-future-corporate",
    deterministic: true,
    gameplayGridPx: TILE,
    palette: JSON.stringify(palette),
  }),
  tiles: moduleEntries.map(([id, canvas, footprintWidth, footprintHeight], index) => {
    const placement = contactPlacements.find(([candidate]) => candidate === id);
    const values = {
      assetId: id,
      footprintWidth,
      footprintHeight,
      gridAligned: true,
      contactSheetX: placement[1],
      contactSheetY: placement[2],
    };
    if (id.startsWith("F1_WALL") || id.startsWith("F1_DOOR")) {
      Object.assign(values, { wallHeightPx: 64, topCapPx: 8, facePx: 48, baseTrimPx: 8, cyanStripPx: 4 });
    }
    return {
      id: index,
      class: id,
      image: `../../assets/environment/reinforcement/floor1/${id}.png`,
      imageheight: canvas.height,
      imagewidth: canvas.width,
      properties: properties(values),
    };
  }),
};

let output = sourceText;
for (const [name, values] of Object.entries({ Ground: ground, FloorDetail: detail, Walls: walls, WallTop: wallTop, StaticProps: propsLayer })) {
  output = replaceLayerData(output, name, encode(values));
}
const oldSource = sourceMap.tilesets?.[0]?.source;
if (!oldSource) throw new Error("Floor 1 map must use one external tileset");
output = output.replace(`"source":"${oldSource}"`, '"source":"floor1_visual_tileset.tsj"');
const outputMap = JSON.parse(output);
if (JSON.stringify(outputMap.layers.filter((candidate) => candidate.type === "objectgroup")) !== objectSnapshot) {
  throw new Error("refusing to write: gameplay Object Layers changed");
}

mkdirSync(dirname(imagePath), { recursive: true });
const samePixel = (canvas, ax, ay, bx, by) => {
  const a = (ay * canvas.width + ax) * 4;
  const b = (by * canvas.width + bx) * 4;
  return canvas.pixels.subarray(a, a + 4).equals(canvas.pixels.subarray(b, b + 4));
};
for (const id of ["F1_FLOOR_PUBLIC", "F1_FLOOR_SERVICE"]) {
  const canvas = moduleById.get(id);
  for (let i = 0; i < TILE; i += 1) {
    if (!samePixel(canvas, 0, i, TILE - 1, i) || !samePixel(canvas, i, 0, i, TILE - 1)) {
      throw new Error(`${id} is not seamless`);
    }
  }
}
const horizontal = moduleById.get("F1_WALL_H");
for (let y = 0; y < horizontal.height; y += 1) {
  if (!samePixel(horizontal, 0, y, horizontal.width - 1, y)) throw new Error("F1_WALL_H is not horizontally seamless");
}
for (const [id, canvas] of moduleById) writeFileSync(resolve(moduleDir, `${id}.png`), pngFromPixels(canvas.pixels, canvas.width, canvas.height));
writeFileSync(imagePath, pngFromPixels(pixels, imageWidth, imageHeight));
writeFileSync(previewPath, previewPng());
writeFileSync(contactSheetPath, contactSheetPng());
writeFileSync(tilesetPath, `${JSON.stringify(tileset, null, 2)}\n`);
writeFileSync(moduleTilesetPath, `${JSON.stringify(moduleTileset, null, 2)}\n`);
writeFileSync(mapPath, output);
console.log(`Generated Floor 1 visual tileset: ${TILE_COUNT} tiles, ${imageWidth}x${imageHeight}px.`);
console.log(`Generated ${moduleEntries.length} named modules and 624x344 contact sheet.`);
console.log("Updated only five visual layer payloads and the external tileset reference; Object Layers unchanged.");
