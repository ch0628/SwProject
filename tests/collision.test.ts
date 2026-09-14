import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canOccupy, footprint, navigationBounds, overlaps } from '../src/collision.ts';
import { ARCHITECTURE_CLEARANCE, BENCH_SIZE, TIGER_FOOTPRINT, TIGER_HEIGHT } from '../src/config.ts';
import { advancePatrol, type Patrol } from '../src/npcMotion.ts';
test('foot anchor, narrow door clearance, wall edges and world bounds', () => {
  const size = { width: 26, height: 16 };
  const world = { width: 200, height: 200 };
  const walls = [{ x: 0, y: 80, width: 84, height: 32 }, { x: 116, y: 80, width: 84, height: 32 }];
  assert.deepEqual(footprint(100, 100, size), { x: 87, y: 92, ...size });
  assert.equal(canOccupy(footprint(100, 100, size), walls, world), true);
  assert.equal(canOccupy(footprint(96, 100, size), walls, world), false);
  assert.equal(canOccupy(footprint(10, 100, size), [], world), false);
  assert.equal(overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 }), false);
});

test('Large clearance separates wall approach from footprint and preserves 64px passages', () => {
  const wall = { x: 0, y: 0, width: 100, height: 300 };
  assert.equal(overlaps(footprint(115, 100, TIGER_FOOTPRINT), wall), false);
  assert.equal(overlaps(navigationBounds(115, 100, ARCHITECTURE_CLEARANCE.large), wall), true);
  assert.equal(overlaps(navigationBounds(130, 100, ARCHITECTURE_CLEARANCE.large), wall), false);
  for (const width of [64, 96]) {
    const walls = [{ x: 0, y: 0, width: 100, height: 300 }, { x: 100 + width, y: 0, width: 100, height: 300 }];
    for (let y = 64; y <= 290; y += 2) assert.equal(walls.some((o) => overlaps(navigationBounds(100 + width / 2, y, ARCHITECTURE_CLEARANCE.large), o)), false);
  }
  const frontWalls = [{ x: 96, y: 352, width: 160, height: 32 }, { x: 320, y: 352, width: 64, height: 32 }];
  for (let y = 460; y >= 280; y -= 2) assert.equal(frontWalls.some((o) => overlaps(navigationBounds(288, y, ARCHITECTURE_CLEARANCE.large), o)), false);
  assert.equal(TIGER_HEIGHT, 80);
  assert.deepEqual(TIGER_FOOTPRINT, { width: 26, height: 16 });
  assert.deepEqual(BENCH_SIZE, { width: 96, height: 32 });
});

test('blocked NPC waits indefinitely and resumes one small step without teleporting', () => {
  const npc: Patrol = { id: 0, x: 100, y: 100, baseX: 100, baseY: 100, elapsed: 0 };
  const tiger = footprint(126, 100, TIGER_FOOTPRINT);
  const world = { width: 500, height: 500 };
  for (let i = 0; i < 1000; i++) assert.deepEqual(advancePatrol(npc, 16, TIGER_FOOTPRINT, [tiger], world), { x: 100, y: 100, elapsed: 0 });
  const next = advancePatrol(npc, 16, TIGER_FOOTPRINT, [], world);
  assert.equal(next.elapsed, 16);
  assert.ok(next.x > 100 && next.x < 101);
});

test('35 sequential patrols never overlap or cross each other through a full motion cycle', () => {
  const world = { width: 1536, height: 1024 };
  const npcs: Patrol[] = Array.from({ length: 35 }, (_, i) => ({ id: i + 1, x: 860 + (i % 7) * 84, y: 684 + Math.floor(i / 7) * 60, baseX: 860 + (i % 7) * 84, baseY: 684 + Math.floor(i / 7) * 60, elapsed: 0 }));
  for (let frame = 0; frame < 1200; frame++) {
    for (const npc of npcs) {
      const blockers = npcs.filter((other) => other !== npc).map((other) => footprint(other.x, other.y, TIGER_FOOTPRINT));
      Object.assign(npc, advancePatrol(npc, 50, TIGER_FOOTPRINT, blockers, world));
      assert.equal(blockers.some((other) => overlaps(footprint(npc.x, npc.y, TIGER_FOOTPRINT), other)), false);
    }
  }
});
