import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = resolve(root, "public/assets/environment/reinforcement/floor1/floor1_isometric_module_sheet_v1.png");
const oldAtlasPath = resolve(root, "public/assets/environment/reinforcement/floor1/floor1_tileset.png");
const atlasPath = resolve(root, "public/assets/environment/reinforcement/floor1/floor1_art_modules_v1.png");
const oldTilesetPath = resolve(root, "public/maps/reinforcement/floor1_visual_tileset.tsj");
const tilesetPath = resolve(root, "public/maps/reinforcement/floor1_art_tileset_v1.tsj");
const blockoutPath = resolve(root, "public/maps/reinforcement/floor_1_blockout.tmj");
const mapPath = resolve(root, "public/maps/reinforcement/floor_1_artpass_v1.tmj");
const previewPath = resolve(root, "docs/modules/machine_learning/reinforcement/navigation/floor_1_artpass_v1_preview.png");
const TILE = 32;
const COLUMNS = 8;

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
function decodePng(path) {
  const png = readFileSync(path);
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`${path} is not PNG`);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24];
  const colorType = png[25];
  if (bitDepth !== 8 || ![2, 6].includes(colorType) || png[28] !== 0) throw new Error(`${path} must be non-interlaced 8-bit RGB/RGBA`);
  const channels = colorType === 6 ? 4 : 3;
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const packed = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const bytes = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const input = y * (stride + 1);
    const filter = packed[input];
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[input + 1 + x];
      const left = x >= channels ? bytes[y * stride + x - channels] : 0;
      const up = y ? bytes[(y - 1) * stride + x] : 0;
      const upperLeft = y && x >= channels ? bytes[(y - 1) * stride + x - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : filter === 4 ? paeth(left, up, upperLeft) : NaN;
      if (!Number.isFinite(predictor)) throw new Error(`${path} uses unsupported PNG filter ${filter}`);
      bytes[y * stride + x] = (raw + predictor) & 255;
    }
  }
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    pixels[i * 4] = bytes[i * channels];
    pixels[i * 4 + 1] = bytes[i * channels + 1];
    pixels[i * 4 + 2] = bytes[i * channels + 2];
    pixels[i * 4 + 3] = channels === 4 ? bytes[i * channels + 3] : 255;
  }
  return { width, height, pixels };
}
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
function encodePng({ width, height, pixels }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]);
}

const source = decodePng(sourcePath);
const atlas = decodePng(oldAtlasPath);
if (source.width !== 1536 || source.height !== 1024) throw new Error("approved module sheet must be 1536x1024");
if (atlas.width !== 256 || atlas.height !== 192) throw new Error("runtime atlas must be 256x192");

const transparentSource = { ...source, pixels: Buffer.from(source.pixels) };
for (let y = 0; y < source.height; y += 1) {
  const left = y * source.width * 4;
  const right = (y * source.width + source.width - 1) * 4;
  const background = [0, 1, 2].map((channel) => (source.pixels[left + channel] + source.pixels[right + channel]) / 2);
  for (let x = 0; x < source.width; x += 1) {
    const offset = (y * source.width + x) * 4;
    const distance = Math.hypot(...background.map((value, channel) => source.pixels[offset + channel] - value));
    transparentSource.pixels[offset + 3] = Math.max(0, Math.min(255, Math.round((distance - 7) * 14)));
  }
}

function sample(image, x, y) {
  const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const values = [0, 0, 0, 0];
  for (const [px, py, weight] of [[x0, y0, (1 - fx) * (1 - fy)], [x1, y0, fx * (1 - fy)], [x0, y1, (1 - fx) * fy], [x1, y1, fx * fy]]) {
    const offset = (py * image.width + px) * 4;
    const alpha = image.pixels[offset + 3] / 255;
    values[3] += alpha * weight;
    for (let channel = 0; channel < 3; channel += 1) values[channel] += image.pixels[offset + channel] * alpha * weight;
  }
  if (values[3]) for (let channel = 0; channel < 3; channel += 1) values[channel] /= values[3];
  return [Math.round(values[0]), Math.round(values[1]), Math.round(values[2]), Math.round(values[3] * 255)];
}
function crop(image, [left, top, right, bottom], width = TILE, height = TILE) {
  const output = { width, height, pixels: Buffer.alloc(width * height * 4) };
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const color = sample(image, left + (x + 0.5) / width * (right - left), top + (y + 0.5) / height * (bottom - top));
    output.pixels.set(color, (y * width + x) * 4);
  }
  return output;
}
function slice(image, left, top, width, height) {
  const output = { width, height, pixels: Buffer.alloc(width * height * 4) };
  for (let y = 0; y < height; y += 1) image.pixels.copy(output.pixels, y * width * 4, ((top + y) * image.width + left) * 4, ((top + y) * image.width + left + width) * 4);
  return output;
}
function seamless(image, horizontal, vertical) {
  if (horizontal) for (let y = 0; y < image.height; y += 1) for (let channel = 0; channel < 4; channel += 1) {
    const first = (y * image.width) * 4 + channel;
    const last = (y * image.width + image.width - 1) * 4 + channel;
    const value = Math.round((image.pixels[first] + image.pixels[last]) / 2);
    image.pixels[first] = value;
    image.pixels[last] = value;
  }
  if (vertical) for (let x = 0; x < image.width; x += 1) for (let channel = 0; channel < 4; channel += 1) {
    const first = x * 4 + channel;
    const last = ((image.height - 1) * image.width + x) * 4 + channel;
    const value = Math.round((image.pixels[first] + image.pixels[last]) / 2);
    image.pixels[first] = value;
    image.pixels[last] = value;
  }
  return image;
}
function floorTile(image, box) {
  const tile = crop(image, box);
  const average = [0, 1, 2].map((channel) => {
    let total = 0;
    for (let offset = channel; offset < tile.pixels.length; offset += 4) total += tile.pixels[offset];
    return Math.round(total / (tile.width * tile.height));
  });
  for (let offset = 0; offset < tile.pixels.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) tile.pixels[offset + channel] = Math.round(average[channel] * 0.72 + tile.pixels[offset + channel] * 0.28);
    tile.pixels[offset + 3] = 255;
  }
  const grout = average.map((value) => Math.round(value * 0.82));
  const highlight = average.map((value) => Math.min(255, Math.round(value * 1.05)));
  for (let i = 0; i < TILE; i += 1) for (const [x, y, color] of [[0, i, grout], [31, i, grout], [i, 0, grout], [i, 31, grout], [1, i, highlight], [i, 1, highlight]]) {
    tile.pixels.set([...color, 255], (y * TILE + x) * 4);
  }
  return tile;
}
function quad(image, [top, right, left, bottom]) {
  const output = { width: TILE, height: TILE, pixels: Buffer.alloc(TILE * TILE * 4) };
  for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) {
    const u = (x + 0.5) / TILE;
    const v = (y + 0.5) / TILE;
    const sx = (1 - v) * ((1 - u) * top[0] + u * right[0]) + v * ((1 - u) * left[0] + u * bottom[0]);
    const sy = (1 - v) * ((1 - u) * top[1] + u * right[1]) + v * ((1 - u) * left[1] + u * bottom[1]);
    output.pixels.set(sample(image, sx, sy), (y * TILE + x) * 4);
  }
  return output;
}
function paste(tile, id) {
  const ox = id % COLUMNS * TILE;
  const oy = Math.floor(id / COLUMNS) * TILE;
  for (let y = 0; y < TILE; y += 1) tile.pixels.copy(atlas.pixels, ((oy + y) * atlas.width + ox) * 4, y * TILE * 4, (y + 1) * TILE * 4);
}

const singleDoorHorizontal = crop(transparentSource, [32, 618, 385, 970], 64, 32);
const singleDoorVertical = crop(transparentSource, [32, 618, 385, 970], 32, 64);
const doubleDoor = crop(transparentSource, [420, 618, 782, 973], 64, 32);
const modules = {
  publicFloor: floorTile(source, [145, 112, 266, 228]),
  serviceFloor: floorTile(source, [540, 135, 630, 215]),
  wallH: seamless(crop(transparentSource, [950, 34, 990, 296]), true, false),
  wallV: seamless(crop(transparentSource, [1238, 126, 1465, 176]), false, true),
  inner: crop(transparentSource, [30, 330, 380, 594]),
  outer: crop(transparentSource, [445, 330, 765, 606]),
  endLeft: crop(transparentSource, [810, 328, 1125, 622]),
  endRight: crop(transparentSource, [1205, 328, 1500, 622]),
  singleDoorLeft: slice(singleDoorHorizontal, 0, 0, 32, 32),
  singleDoorRight: slice(singleDoorHorizontal, 32, 0, 32, 32),
  singleDoorTop: slice(singleDoorVertical, 0, 0, 32, 32),
  singleDoorBottom: slice(singleDoorVertical, 0, 32, 32, 32),
  doubleDoorLeft: slice(doubleDoor, 0, 0, 32, 32),
  doubleDoorRight: slice(doubleDoor, 32, 0, 32, 32),
  glass: crop(transparentSource, [800, 610, 1142, 978]),
  reception: crop(transparentSource, [1260, 660, 1460, 956]),
  receptionEnd: crop(transparentSource, [1165, 640, 1315, 965]),
  wallTopH: seamless(crop(transparentSource, [950, 26, 990, 92]), true, false),
  wallTopV: seamless(crop(transparentSource, [1238, 126, 1465, 176]), false, true),
};
for (const id of [0, 1, 3, 41]) paste(modules.publicFloor, id);
for (const id of [2, 39, 40]) paste(modules.serviceFloor, id);
for (const id of [4]) paste(modules.wallH, id);
for (const id of [5]) paste(modules.wallV, id);
for (const id of [6, 7, 8, 9, 18, 19, 20, 21, 44]) paste(modules.outer, id);
for (const id of [10, 11, 12, 13]) paste(modules.inner, id);
paste(modules.endLeft, 14);
paste(modules.endRight, 15);
for (const id of [16]) paste(modules.endLeft, id);
for (const id of [17]) paste(modules.endRight, id);
for (const id of [22, 25, 42]) paste(modules.singleDoorLeft, id);
paste(modules.singleDoorRight, 23);
for (const id of [24, 26]) paste(modules.singleDoorTop, id);
paste(modules.singleDoorBottom, 43);
for (const id of [27, 28]) paste(modules.glass, id);
paste(modules.doubleDoorLeft, 29);
paste(modules.doubleDoorRight, 47);
paste(modules.reception, 32);
paste(modules.receptionEnd, 45);
paste(modules.wallTopH, 37);
paste(modules.wallTopV, 38);

const oldTileset = JSON.parse(readFileSync(oldTilesetPath, "utf8"));
const sourceHash = createHash("sha256").update(readFileSync(sourcePath)).digest("hex");
const properties = Object.fromEntries((oldTileset.properties ?? []).map((item) => [item.name, item]));
properties.artPassVersion = { name: "artPassVersion", type: "string", value: "v1" };
properties.authoritativeSourceSha256 = { name: "authoritativeSourceSha256", type: "string", value: sourceHash };
const tileset = {
  ...oldTileset,
  image: "../../assets/environment/reinforcement/floor1/floor1_art_modules_v1.png",
  name: "floor1_art_tileset_v1",
  properties: Object.values(properties),
};

const blockoutText = readFileSync(blockoutPath, "utf8");
const blockout = JSON.parse(blockoutText);
const objectSnapshot = JSON.stringify(blockout.layers.filter((layer) => layer.type === "objectgroup"));
const decodeLayer = (name) => {
  const layer = blockout.layers.find((candidate) => candidate.name === name);
  const bytes = inflateSync(Buffer.from(layer.data, "base64"));
  return Array.from({ length: bytes.length / 4 }, (_, index) => bytes.readUInt32LE(index * 4));
};
const encodeLayer = (values) => {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => bytes.writeUInt32LE(value, index * 4));
  return deflateSync(bytes, { level: 9 }).toString("base64");
};
const replaceLayerData = (text, name, data) => {
  const nameIndex = text.indexOf(`"name":"${name}"`);
  const dataKey = text.lastIndexOf('"data":"', nameIndex);
  const start = dataKey + 8;
  const end = text.indexOf('"', start);
  if (nameIndex < 0 || dataKey < 0 || end < 0) throw new Error(`cannot locate ${name}`);
  return `${text.slice(0, start)}${data}${text.slice(end)}`;
};
const detail = decodeLayer("FloorDetail");
const staticProps = decodeLayer("StaticProps");
detail[42 * blockout.width + 39] = 30;
detail[42 * blockout.width + 40] = 48;
const collision = blockout.layers.find((layer) => layer.name === "Collision").objects;
for (const door of collision.filter((object) => (object.class ?? object.type) === "LockedDoor")) {
  const x = door.x / TILE;
  const y = door.y / TILE;
  if (door.width >= door.height) {
    staticProps[y * blockout.width + x] = 23;
    staticProps[y * blockout.width + x + 1] = 24;
  } else {
    staticProps[y * blockout.width + x] = 25;
    staticProps[(y + 1) * blockout.width + x] = 44;
  }
}
let artpassText = blockoutText.replace('"source":"floor1_visual_tileset.tsj"', '"source":"floor1_art_tileset_v1.tsj"');
artpassText = replaceLayerData(artpassText, "FloorDetail", encodeLayer(detail));
artpassText = replaceLayerData(artpassText, "StaticProps", encodeLayer(staticProps));
const artpass = JSON.parse(artpassText);
if (JSON.stringify(artpass.layers.filter((layer) => layer.type === "objectgroup")) !== objectSnapshot) throw new Error("refusing to write: gameplay objects changed");
if (artpassText === blockoutText) throw new Error("tileset reference was not replaced");

function preview() {
  const width = artpass.width * TILE;
  const height = artpass.height * TILE;
  const output = { width, height, pixels: Buffer.alloc(width * height * 4) };
  for (let offset = 0; offset < output.pixels.length; offset += 4) output.pixels.set([58, 59, 61, 255], offset);
  for (const layer of artpass.layers.filter((item) => item.type === "tilelayer")) {
    const bytes = inflateSync(Buffer.from(layer.data, "base64"));
    for (let cell = 0; cell < artpass.width * artpass.height; cell += 1) {
      const gid = bytes.readUInt32LE(cell * 4);
      if (!gid) continue;
      const id = gid - 1;
      const sx = id % COLUMNS * TILE;
      const sy = Math.floor(id / COLUMNS) * TILE;
      const tx = cell % artpass.width * TILE;
      const ty = Math.floor(cell / artpass.width) * TILE;
      for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) {
        const sourceOffset = ((sy + y) * atlas.width + sx + x) * 4;
        const targetOffset = ((ty + y) * width + tx + x) * 4;
        const alpha = atlas.pixels[sourceOffset + 3] / 255;
        for (let channel = 0; channel < 3; channel += 1) output.pixels[targetOffset + channel] = Math.round(atlas.pixels[sourceOffset + channel] * alpha + output.pixels[targetOffset + channel] * (1 - alpha));
      }
    }
  }
  return output;
}

writeFileSync(atlasPath, encodePng(atlas));
writeFileSync(tilesetPath, `${JSON.stringify(tileset, null, 2)}\n`);
writeFileSync(mapPath, artpassText);
writeFileSync(previewPath, encodePng(preview()));
console.log(`Generated Floor 1 art pass v1 from approved source ${sourceHash}.`);
console.log("Created 256x192 atlas, matching TSJ, non-destructive TMJ clone, and 2560x1440 preview.");
