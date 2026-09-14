import { canOccupy, sweptFootprint, type Bounds } from './collision.ts';

export type Patrol = { x: number; y: number; baseX: number; baseY: number; elapsed: number; id: number };

// A blocked patrol freezes its own clock, so unblocking cannot cause a catch-up teleport.
export function advancePatrol(npc: Patrol, delta: number, size: { width: number; height: number }, blockers: Bounds[], world: { width: number; height: number }) {
  const elapsed = npc.elapsed + Math.min(delta, 50);
  const x = npc.baseX + (Math.sin(elapsed / 1500 + npc.id) - Math.sin(npc.id)) * 18;
  const y = npc.baseY + (Math.sin(elapsed / 1900 + npc.id * 2) - Math.sin(npc.id * 2)) * 6;
  // Sweep even the short step: a character cannot cross another footprint between frames.
  const swept = sweptFootprint(npc,{x,y},size);
  return canOccupy(swept, blockers, world) ? { x, y, elapsed } : { x: npc.x, y: npc.y, elapsed: npc.elapsed };
}
