export const visualDepth = (southBaselineY: number) => southBaselineY;

export const TILE_SIZE = 32;
export const WALL_COORDINATE_CONTRACT = {
  tileSize: TILE_SIZE,
  footprintOrigin: 'top-left',
  spriteOrigin: { x: 0, y: 1 },
  baseline: 'footprint-south-edge',
  depthBaseline: 'footprint-south-edge',
} as const;

export type WallPoint = { x: number; y: number };
export const horizontalJoins = (x: number, baseline: number, width = TILE_SIZE) => ({
  left: { x, y: baseline }, right: { x: x + width, y: baseline },
});
export const verticalJoins = (x: number, baseline: number, height = TILE_SIZE) => ({
  top: { x: x + TILE_SIZE, y: baseline - height }, bottom: { x: x + TILE_SIZE, y: baseline },
});
export const cornerJoin = (x: number, baseline: number): WallPoint => ({ x: x + TILE_SIZE, y: baseline });

export const ROOM_SHELL = {
  left: 64,
  right: 448,
  northBaseline: 144,
  southBaseline: 304,
  doorX: 224,
  doorWidth: 64,
} as const;

export const ROOM_SHELL_DOOR_OPENING = {
  x: ROOM_SHELL.doorX + 18,
  y: ROOM_SHELL.northBaseline - TILE_SIZE,
  width: 28,
  height: TILE_SIZE,
} as const;

export const ROOM_SHELL_COLLIDERS = [
  { x: ROOM_SHELL.left, y: ROOM_SHELL.northBaseline - TILE_SIZE, width: ROOM_SHELL_DOOR_OPENING.x - ROOM_SHELL.left, height: TILE_SIZE },
  { x: ROOM_SHELL_DOOR_OPENING.x + ROOM_SHELL_DOOR_OPENING.width, y: ROOM_SHELL.northBaseline - TILE_SIZE, width: ROOM_SHELL.right - ROOM_SHELL_DOOR_OPENING.x - ROOM_SHELL_DOOR_OPENING.width, height: TILE_SIZE },
  { x: ROOM_SHELL.left, y: ROOM_SHELL.northBaseline, width: TILE_SIZE, height: ROOM_SHELL.southBaseline - ROOM_SHELL.northBaseline - TILE_SIZE },
  { x: ROOM_SHELL.right - TILE_SIZE, y: ROOM_SHELL.northBaseline, width: TILE_SIZE, height: ROOM_SHELL.southBaseline - ROOM_SHELL.northBaseline - TILE_SIZE },
  { x: ROOM_SHELL.left, y: ROOM_SHELL.southBaseline - TILE_SIZE, width: ROOM_SHELL.right - ROOM_SHELL.left, height: TILE_SIZE },
] as const;

export const roomShellBlocks = (x: number, y: number) => ROOM_SHELL_COLLIDERS.some(rectangle =>
  x >= rectangle.x && x < rectangle.x + rectangle.width && y >= rectangle.y && y < rectangle.y + rectangle.height,
);

export const FLOOR1_VISUAL_ASSETS = [
  'F1_FLOOR_PUBLIC',
  'F1_FLOOR_SERVICE',
  'F1_WALL_H_BODY',
  'F1_WALL_V_TOP',
  'F1_WALL_V_BODY',
  'F1_WALL_V_BOTTOM',
  'F1_CORNER_INNER',
  'F1_CORNER_OUTER',
  'F1_DOOR_H',
] as const;
