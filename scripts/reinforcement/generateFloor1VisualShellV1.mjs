import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const TILE = 32, WIDTH = 16, HEIGHT = 12;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const assetDir = resolve(root, 'public/assets/environment/reinforcement/floor1_visual_shell_v1');
const atlasPath = resolve(assetDir, 'floor1_visual_shell_v1.png');
const tilesetPath = resolve(root, 'public/maps/reinforcement/floor1_visual_shell_v1.tsj');
const mapPath = resolve(root, 'public/maps/reinforcement/floor_1_visual_shell_v1.tmj');
const sourcePath = resolve(root, 'public/maps/reinforcement/floor_1_blockout.tmj');
const sourceHash = createHash('sha256').update(readFileSync(sourcePath)).digest('hex');

const canvas = (width, height) => ({ width, height, pixels: Buffer.alloc(width * height * 4) });
const rgba = hex => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
};
function rect(image, x, y, width, height, color) {
  const value = rgba(color);
  for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) {
    image.pixels.set(value, (py * image.width + px) * 4);
  }
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
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function png(image) {
  const raw = Buffer.alloc((image.width * 4 + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) image.pixels.copy(raw, y * (image.width * 4 + 1) + 1, y * image.width * 4, (y + 1) * image.width * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0); header.writeUInt32BE(image.height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const atlas = canvas(TILE * 8, TILE * 2);
const tileX = id => id * TILE;
rect(atlas, tileX(0), 32, 32, 32, '#E8E0D5');
rect(atlas, tileX(1), 32, 32, 32, '#C8CCD0');
rect(atlas, tileX(2), 0, 32, 64, '#D8CEC1');
rect(atlas, tileX(2), 0, 32, 5, '#F1F3F2');
rect(atlas, tileX(2), 51, 32, 6, '#30363A');
rect(atlas, tileX(3) + 22, 0, 10, 64, '#C5B8A8');
rect(atlas, tileX(3) + 28, 0, 4, 64, '#30363A');
rect(atlas, tileX(4), 0, 10, 64, '#C5B8A8');
rect(atlas, tileX(4), 0, 4, 64, '#30363A');
rect(atlas, tileX(5), 54, 32, 10, '#4A5257');
rect(atlas, tileX(5), 54, 32, 2, '#D8CEC1');
rect(atlas, tileX(6), 0, 32, 9, '#30363A');
rect(atlas, tileX(6), 0, 6, 64, '#C5B8A8');
rect(atlas, tileX(7), 0, 32, 9, '#30363A');
rect(atlas, tileX(7) + 26, 0, 6, 64, '#C5B8A8');

const layer = () => Array(WIDTH * HEIGHT).fill(0);
const set = (data, x, y, gid) => { data[y * WIDTH + x] = gid; };
const ground = layer(), detail = layer(), walls = layer(), wallTop = layer(), props = layer();
for (let y = 5; y <= 9; y += 1) for (let x = 3; x <= 12; x += 1) set(ground, x, y, 1);
for (let y = 2; y <= 4; y += 1) for (let x = 7; x <= 8; x += 1) set(ground, x, y, 1);
for (let y = 2; y <= 3; y += 1) for (let x = 9; x <= 12; x += 1) set(ground, x, y, 1);
for (let y = 7; y <= 9; y += 1) for (let x = 10; x <= 12; x += 1) set(detail, x, y, 2);
for (let x = 2; x <= 13; x += 1) set(wallTop, x, 4, x === 7 ? 7 : x === 8 ? 8 : 3);
for (let x = 7; x <= 13; x += 1) set(wallTop, x, 1, 3);
for (let y = 5; y <= 9; y += 1) { set(walls, 2, y, 4); set(walls, 13, y, 5); }
for (let y = 2; y <= 3; y += 1) set(walls, 6, y, 4);
for (let y = 2; y <= 3; y += 1) set(walls, 13, y, 5);
for (let x = 2; x <= 13; x += 1) set(walls, x, 10, 6);

let id = 1;
const object = (name, x, y, width, height, properties = []) => ({ id: id++, name, type: '', x, y, width, height, rotation: 0, visible: true, properties });
const point = (name, x, y, properties = []) => ({ id: id++, name, type: '', x, y, width: 0, height: 0, point: true, rotation: 0, visible: true, properties });
const property = (name, type, value) => ({ name, type, value });
const collision = [
  object('SHELL_NORTH_LEFT', 64, 128, 166, 32, [property('blocksRobot', 'bool', true)]),
  object('SHELL_NORTH_RIGHT', 282, 128, 166, 32, [property('blocksRobot', 'bool', true)]),
  object('SHELL_LEFT', 64, 160, 32, 160, [property('blocksRobot', 'bool', true)]),
  object('SHELL_RIGHT', 416, 160, 32, 160, [property('blocksRobot', 'bool', true)]),
  object('SHELL_SOUTH', 64, 320, 384, 32, [property('blocksRobot', 'bool', true)]),
  object('CORRIDOR_NORTH', 224, 32, 224, 32, [property('blocksRobot', 'bool', true)]),
  object('CORRIDOR_LEFT', 192, 64, 32, 64, [property('blocksRobot', 'bool', true)]),
  object('CORRIDOR_RIGHT', 416, 64, 32, 64, [property('blocksRobot', 'bool', true)]),
];
const nodes = [
  point('SHELL_ROOM', 256, 240, [property('nodeId', 'string', 'SHELL_ROOM')]),
  point('SHELL_DOOR_IN', 256, 176, [property('nodeId', 'string', 'SHELL_DOOR_IN')]),
  point('SHELL_DOOR_OUT', 256, 112, [property('nodeId', 'string', 'SHELL_DOOR_OUT')]),
  point('SHELL_CORRIDOR_END', 384, 96, [property('nodeId', 'string', 'SHELL_CORRIDOR_END')]),
];
const edge = (name, points) => ({ id: id++, name, type: '', x: 0, y: 0, width: 0, height: 0, rotation: 0, visible: true, polyline: points, properties: [property('edgeId', 'string', name)] });
const map = {
  compressionlevel: -1, height: HEIGHT, width: WIDTH, infinite: false, orientation: 'orthogonal', renderorder: 'right-down',
  tileheight: TILE, tilewidth: TILE, type: 'map', version: '1.10', tiledversion: '1.12.2', nextlayerid: 13, nextobjectid: id + 8,
  properties: [
    property('prototypeOnly', 'bool', true), property('authoringModel', 'string', 'room-shell'),
    property('sourceMap', 'string', 'floor_1_blockout.tmj'), property('sourceMapSha256', 'string', sourceHash),
  ],
  tilesets: [{ firstgid: 1, source: 'floor1_visual_shell_v1.tsj' }],
  layers: [
    { id: 1, name: 'Ground', type: 'tilelayer', x: 0, y: 0, width: WIDTH, height: HEIGHT, opacity: 1, visible: true, data: ground },
    { id: 2, name: 'FloorDetail', type: 'tilelayer', x: 0, y: 0, width: WIDTH, height: HEIGHT, opacity: 1, visible: true, data: detail },
    { id: 3, name: 'Walls', type: 'tilelayer', x: 0, y: 0, width: WIDTH, height: HEIGHT, opacity: 1, visible: true, data: walls },
    { id: 4, name: 'WallTop', type: 'tilelayer', x: 0, y: 0, width: WIDTH, height: HEIGHT, opacity: 1, visible: true, data: wallTop },
    { id: 5, name: 'StaticProps', type: 'tilelayer', x: 0, y: 0, width: WIDTH, height: HEIGHT, opacity: 1, visible: true, data: props },
    { id: 6, name: 'Collision', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: collision },
    { id: 7, name: 'NavigationNodes', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: nodes },
    { id: 8, name: 'NavigationEdges', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: [
      edge('SHELL_E1', [{ x: 256, y: 240 }, { x: 256, y: 176 }]),
      edge('SHELL_E2', [{ x: 256, y: 176 }, { x: 256, y: 112 }]),
      edge('SHELL_E3', [{ x: 256, y: 112 }, { x: 384, y: 96 }]),
    ] },
    { id: 9, name: 'EncounterZones', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: [object('SHELL_TEST_ROOM', 96, 160, 320, 160, [property('prototypeOnly', 'bool', true)])] },
    { id: 10, name: 'FloorTransitions', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: [object('SHELL_TEST_EXIT', 384, 80, 32, 32, [property('prototypeOnly', 'bool', true)])] },
    { id: 11, name: 'SpawnPoints', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: [point('SHELL_TEST_SPAWN', 256, 240, [property('prototypeOnly', 'bool', true)])] },
    { id: 12, name: 'Debug', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: [
      object('ROOM_SHELL_BOUNDS', 64, 128, 384, 224), object('DOOR_OPENING', 230, 128, 52, 32),
    ] },
  ],
};
map.nextobjectid = id;

const tileset = {
  columns: 8, image: '../../assets/environment/reinforcement/floor1_visual_shell_v1/floor1_visual_shell_v1.png',
  imagewidth: 256, imageheight: 64, margin: 0, spacing: 0, name: 'floor1_visual_shell_v1', tilecount: 8,
  tilewidth: 32, tileheight: 64, type: 'tileset', version: '1.10', tiledversion: '1.12.2',
  properties: [property('prototypeOnly', 'bool', true), property('gameplayGridPx', 'int', 32), property('authoringModel', 'string', 'room-shell')],
  tiles: ['FLOOR_PUBLIC', 'FLOOR_SERVICE', 'BACK_WALL', 'SIDE_LEFT', 'SIDE_RIGHT', 'SOUTH_TRIM', 'DOOR_LEFT', 'DOOR_RIGHT']
    .map((name, tileId) => ({ id: tileId, class: name })),
};

assert.deepEqual(map.layers.slice(0, 5).map(layer => layer.name), ['Ground', 'FloorDetail', 'Walls', 'WallTop', 'StaticProps']);
assert.deepEqual(map.layers.slice(5, 11).map(layer => layer.name), ['Collision', 'NavigationNodes', 'NavigationEdges', 'EncounterZones', 'FloorTransitions', 'SpawnPoints']);
assert.equal(collision.some(item => item.x + item.width === 230), true);
assert.equal(collision.some(item => item.x === 282), true);

mkdirSync(assetDir, { recursive: true });
writeFileSync(atlasPath, png(atlas));
writeFileSync(tilesetPath, `${JSON.stringify(tileset, null, 2)}\n`);
writeFileSync(mapPath, `${JSON.stringify(map, null, 2)}\n`);
assert.equal(createHash('sha256').update(readFileSync(sourcePath)).digest('hex'), sourceHash, 'approved Floor 1 map changed');
console.log('PASS floor_1_visual_shell_v1');
console.log('map=16x12 grid=32 shell=back64px side10px south10px door52px');
console.log(`source_sha256=${sourceHash}`);
