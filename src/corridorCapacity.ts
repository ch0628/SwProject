import { footprint, navigationBounds, overlaps, sweptFootprint, type Bounds } from './collision.ts';
import { ARCHITECTURE_CLEARANCE, TIGER_FOOTPRINT, TIGER_HEIGHT, TILE_SIZE } from './config.ts';

// Validation candidates only; these do not change any species or map standard.
export const CORRIDOR_SIZES = {
  Small: { visual: 56, visualWidth: 32, width: 18, height: 12, clearance: { halfWidth: 20, above: 40, below: 6 } },
  Medium: { visual: 68, visualWidth: 42, width: 22, height: 14, clearance: { halfWidth: 25, above: 48, below: 7 } },
  Large: { visual: TIGER_HEIGHT, visualWidth: 56, ...TIGER_FOOTPRINT, clearance: ARCHITECTURE_CLEARANCE.large },
};
export const CORRIDOR_CASES = {
  A: { tiles: 2, classes: ['Large', 'Large'], label: '2 tile Narrow' },
  B: { tiles: 3, classes: ['Large', 'Large'], label: '3 tile Large vs Large' },
  C: { tiles: 3, classes: ['Small', 'Medium', 'Large', 'Small', 'Medium', 'Large'], label: '3 tile Mixed' },
  D: { tiles: 4, classes: ['Small', 'Medium', 'Large', 'Small', 'Medium', 'Large'], label: '4 tile Mixed' },
} as const;
export type CorridorCase = keyof typeof CORRIDOR_CASES;
export const CORRIDOR = { centerX: 480, top: 144, bottom: 448, speed: 48, sideSpeed: 32, sideDelay: 0.35, turnaroundPause: 0.6, longWait: 10 };
export type TrafficNpc = { id: number; size: keyof typeof CORRIDOR_SIZES; x: number; y: number; direction: 1 | -1; pause: number; wait: number; blocked: boolean; moving: boolean; trips: number };
export type CorridorRun = { test: CorridorCase; npcs: TrafficNpc[]; elapsed: number; longestWait: number; blockedEvents: number; noProgress: number };

export function createCorridorRun(test: CorridorCase): CorridorRun {
  const classes = CORRIDOR_CASES[test].classes;
  const half = classes.length / 2;
  return { test, elapsed: 0, longestWait: 0, blockedEvents: 0, noProgress: 0, npcs: classes.map((size, i) => ({
    id: i + 1, size, x: CORRIDOR.centerX,
    y: i < half ? CORRIDOR.top + i * 28 : CORRIDOR.bottom - (i - half) * 28,
    direction: i < half ? 1 : -1, pause: 0, wait: 0, blocked: false, moving: false, trips: 0,
  })) };
}

export function corridorWalls(test: CorridorCase): Bounds[] {
  const half = CORRIDOR_CASES[test].tiles * TILE_SIZE / 2;
  return [{ x: 0, y: 0, width: CORRIDOR.centerX - half, height: 540 }, { x: CORRIDOR.centerX + half, y: 0, width: 960 - CORRIDOR.centerX - half, height: 540 }];
}

export function stepCorridor(run: CorridorRun, seconds: number) {
  const dt = Math.min(Math.max(seconds, 0), 0.05);
  if (!dt) return;
  run.elapsed += dt;
  let progress = false;
  const walls = corridorWalls(run.test);
  // ponytail: <=6 actors; sequential swept AABB checks suffice, no crowd solver.
  for (const npc of run.npcs) {
    npc.moving = false;
    if (npc.pause > 0) { npc.pause = Math.max(0, npc.pause - dt); continue; }
    const size = CORRIDOR_SIZES[npc.size];
    const move = (x: number, y: number) => {
      const sweep = sweptFootprint(npc,{x,y},size);
      if (walls.some((wall) => overlaps(navigationBounds(x, y, size.clearance), wall)) || run.npcs.some((other) => other !== npc && overlaps(sweep, footprint(other.x, other.y, CORRIDOR_SIZES[other.size])))) return false;
      npc.moving = x !== npc.x || y !== npc.y;
      npc.x = x; npc.y = y;
      return true;
    };
    const target = npc.direction === 1 ? CORRIDOR.bottom : CORRIDOR.top;
    const y = npc.y + npc.direction * Math.min(Math.abs(target - npc.y), CORRIDOR.speed * dt);
    if (move(npc.x, y)) {
      progress = true; npc.wait = 0; npc.blocked = false;
      if (npc.y === target) { npc.trips++; npc.direction = npc.direction === 1 ? -1 : 1; npc.pause = CORRIDOR.turnaroundPause; }
    } else {
      if (!npc.blocked) run.blockedEvents++;
      npc.blocked = true; npc.wait += dt;
      run.longestWait = Math.max(run.longestWait, npc.wait);
      // After waiting, a small right-hand side-step. Never teleport, retreat, or ignore collision.
      if (npc.wait >= CORRIDOR.sideDelay) {
        const half = CORRIDOR_CASES[run.test].tiles * TILE_SIZE / 2;
        const x = Math.max(CORRIDOR.centerX - half + size.clearance.halfWidth, Math.min(CORRIDOR.centerX + half - size.clearance.halfWidth, npc.x - npc.direction * CORRIDOR.sideSpeed * dt));
        move(x, npc.y);
      }
    }
  }
  run.noProgress = progress ? 0 : run.noProgress + dt;
}

export function corridorMetrics(run: CorridorRun) {
  const moving = run.npcs.filter((npc) => npc.moving).length;
  return { moving, waiting: run.npcs.length - moving, turning: run.npcs.filter((npc) => npc.pause > 0).length, trips: run.npcs.reduce((sum, npc) => sum + npc.trips, 0) };
}
