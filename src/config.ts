export const TILE_SIZE = 32;
export const LOGICAL = { width: 960, height: 540 };
export const WORLD_SIZE = { width: 48 * TILE_SIZE, height: 32 * TILE_SIZE };
export const TIGER_HEIGHT = 80; // Approved Large Species reference.
// Source PNGs contain nearly transparent stray pixels outside the visible character.
export const ASSET_ALPHA_THRESHOLD = 10;
export const TIGER_FOOTPRINT = { width: 26, height: 16 };
// Navigation against solid architecture only; NPCs and props retain the small footprint.
// Measured from the foot anchor, independent of texture/frame size and debug render height.
export const ARCHITECTURE_CLEARANCE = {
  large: { halfWidth: 30, above: 56, below: 8 },
};
export const BENCH_SIZE = { width: 3 * TILE_SIZE, height: TILE_SIZE };
export const WALKWAY_WIDTH = { main: 5, normal: 3, narrow: 2 };
export const PUBLIC_ENTRANCE_WIDTH = 2;
export const NPC_DENSITY_OPTIONS = [12, 24, 35] as const;
export const ZOOM_OPTIONS = [1, 1.25] as const;
export const HEIGHT_OPTIONS = [72, 80, 88] as const;
export const SPEED = 180;
export const PANEL_WIDTH = 240;
export const DENSITY_AREA = { x: 800, y: 576, width: 640, height: 384 };
export const STATIONS = {
  plaza: { x: 640, y: 480 },
  doors: { x: 288, y: 440 },
  wall: { x: 158, y: 320 },
  testDoor: { x: 400, y: 440 },
  paths: { x: 880, y: 400 },
  narrow: { x: 1120, y: 400 },
  objects: { x: 608, y: 736 },
  density: { x: 1120, y: 780 },
};
