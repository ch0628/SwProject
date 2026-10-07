import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { inflateSync } from 'node:zlib';
import {
  cornerJoin, FLOOR1_VISUAL_ASSETS, horizontalJoins, ROOM_SHELL, ROOM_SHELL_DOOR_OPENING,
  roomShellBlocks, TILE_SIZE, verticalJoins, visualDepth, WALL_COORDINATE_CONTRACT,
} from '../src/modules/reinforcement/debug/floor1VisualPrototype.ts';

const ROOT = new URL('../', import.meta.url);
const pngSize = async (name: string) => {
  const source = await readFile(new URL(`public/assets/environment/reinforcement/floor1_topdown_prototype/${name}.png`, ROOT));
  return [source.readUInt32BE(16), source.readUInt32BE(20)];
};
const pngPixels = async (name: string) => {
  const source = await readFile(new URL(`public/assets/environment/reinforcement/floor1_topdown_prototype/${name}.png`, ROOT));
  const width = source.readUInt32BE(16), height = source.readUInt32BE(20), parts: Buffer[] = [];
  for (let offset = 8; offset < source.length;) {
    const length = source.readUInt32BE(offset), type = source.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') parts.push(source.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(parts)), pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) raw.copy(pixels, y * width * 4, y * (width * 4 + 1) + 1, y * (width * 4 + 1) + 1 + width * 4);
  return { width, height, pixels };
};
const alphaBounds = ({ width, height, pixels }: Awaited<ReturnType<typeof pngPixels>>) => {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (pixels[(y * width + x) * 4 + 3]) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return { left, top, right, bottom };
};

test('Floor 1 visual prototype keeps orientation-aware assets and baseline depth ordering', async () => {
  assert.deepEqual(FLOOR1_VISUAL_ASSETS.slice(2, 6), ['F1_WALL_H_BODY', 'F1_WALL_V_TOP', 'F1_WALL_V_BODY', 'F1_WALL_V_BOTTOM']);
  assert.deepEqual(await pngSize('F1_FLOOR_PUBLIC'), [64, 64]);
  assert.deepEqual(await pngSize('F1_WALL_H_BODY'), [32, 64]);
  assert.deepEqual(await pngSize('F1_WALL_V_TOP'), [32, 48]);
  assert.deepEqual(await pngSize('F1_WALL_V_BODY'), [32, 32]);
  assert.ok(visualDepth(143) < visualDepth(144));
  assert.ok(visualDepth(145) > visualDepth(144));
});

test('shared wall joins resolve to identical world coordinates', () => {
  assert.deepEqual(WALL_COORDINATE_CONTRACT.spriteOrigin, { x: 0, y: 1 });
  const corner = cornerJoin(ROOM_SHELL.left, ROOM_SHELL.northBaseline);
  const firstHorizontal = horizontalJoins(ROOM_SHELL.left + TILE_SIZE, ROOM_SHELL.northBaseline);
  const firstVertical = verticalJoins(ROOM_SHELL.left, ROOM_SHELL.northBaseline + TILE_SIZE);
  assert.deepEqual(corner, firstHorizontal.left);
  assert.deepEqual(corner, firstVertical.top);
  const door = horizontalJoins(ROOM_SHELL.doorX, ROOM_SHELL.northBaseline, ROOM_SHELL.doorWidth);
  assert.deepEqual(door.left, horizontalJoins(ROOM_SHELL.doorX - TILE_SIZE, ROOM_SHELL.northBaseline).right);
  assert.deepEqual(door.right, horizontalJoins(ROOM_SHELL.doorX + ROOM_SHELL.doorWidth, ROOM_SHELL.northBaseline).left);
});

test('wall PNG alpha bounds contain no transparent join-edge padding', async () => {
  assert.deepEqual(alphaBounds(await pngPixels('F1_WALL_H_BODY')), { left: 0, top: 0, right: 31, bottom: 42 });
  assert.deepEqual(alphaBounds(await pngPixels('F1_WALL_V_TOP')), { left: 0, top: 0, right: 31, bottom: 47 });
  for (const name of ['F1_WALL_V_BODY', 'F1_WALL_V_BOTTOM']) {
    assert.deepEqual(alphaBounds(await pngPixels(name)), { left: 0, top: 0, right: 31, bottom: 31 });
  }
  for (const name of ['F1_CORNER_INNER', 'F1_CORNER_OUTER']) {
    assert.deepEqual(alphaBounds(await pngPixels(name)), { left: 0, top: 0, right: 31, bottom: 63 });
  }
  assert.deepEqual(alphaBounds(await pngPixels('F1_DOOR_H')), { left: 0, top: 0, right: 63, bottom: 63 });
});

test('prototype room shell blocks closed boundaries and leaves only the door opening traversable', () => {
  assert.equal(roomShellBlocks(160, 128), true, 'closed horizontal wall');
  assert.equal(roomShellBlocks(80, 208), true, 'left vertical wall');
  assert.equal(roomShellBlocks(432, 208), true, 'right vertical wall');
  assert.equal(roomShellBlocks(256, 288), true, 'closed south wall');
  assert.equal(roomShellBlocks(ROOM_SHELL_DOOR_OPENING.x + ROOM_SHELL_DOOR_OPENING.width / 2, 128), false, 'north door opening');
  for (let x = ROOM_SHELL.left; x < ROOM_SHELL.right; x += 1) {
    const inDoor = x >= ROOM_SHELL_DOOR_OPENING.x && x < ROOM_SHELL_DOOR_OPENING.x + ROOM_SHELL_DOOR_OPENING.width;
    assert.equal(roomShellBlocks(x, ROOM_SHELL.northBaseline - TILE_SIZE / 2), !inDoor, `north boundary x=${x}`);
    assert.equal(roomShellBlocks(x, ROOM_SHELL.southBaseline - TILE_SIZE / 2), true, `south boundary x=${x}`);
  }
  for (let y = ROOM_SHELL.northBaseline; y < ROOM_SHELL.southBaseline - TILE_SIZE; y += 1) {
    assert.equal(roomShellBlocks(ROOM_SHELL.left + TILE_SIZE / 2, y), true, `left boundary y=${y}`);
    assert.equal(roomShellBlocks(ROOM_SHELL.right - TILE_SIZE / 2, y), true, `right boundary y=${y}`);
  }
});
