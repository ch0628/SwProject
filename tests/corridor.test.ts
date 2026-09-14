import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORRIDOR, CORRIDOR_CASES, CORRIDOR_SIZES, createCorridorRun, stepCorridor, corridorMetrics, corridorWalls, type CorridorCase } from '../src/corridorCapacity.ts';
import { footprint, navigationBounds, overlaps } from '../src/collision.ts';

for (const name of Object.keys(CORRIDOR_CASES) as CorridorCase[]) {
  test(`${name}: 120s capacity observation, no penetration at 20/30/60fps`, () => {
    for (const dt of [1 / 60, 1 / 30, 0.05]) {
      const run = createCorridorRun(name);
      for (let frame = 0; frame < 120 / dt; frame++) {
        const before = run.npcs.map((n) => ({ x: n.x, y: n.y }));
        stepCorridor(run, dt);
        for (const npc of run.npcs) {
          const size = CORRIDOR_SIZES[npc.size];
          assert.ok(npc.y >= CORRIDOR.top && npc.y <= CORRIDOR.bottom);
          assert.ok(Math.hypot(npc.x - before[npc.id - 1].x, npc.y - before[npc.id - 1].y) <= CORRIDOR.speed * dt + 1e-8);
          assert.ok(!corridorWalls(name).some((w) => overlaps(navigationBounds(npc.x, npc.y, size.clearance), w)));
          assert.ok(!run.npcs.some((other) => other !== npc && overlaps(footprint(npc.x, npc.y, size), footprint(other.x, other.y, CORRIDOR_SIZES[other.size]))));
        }
      }
      if (name !== 'A') {
        assert.ok(run.npcs.every((npc) => npc.trips >= 8), 'every NPC completes repeated journeys');
        assert.ok(run.longestWait < CORRIDOR.longWait, 'no prolonged queue with this fixture');
      }
      console.log(JSON.stringify({ test: name, fps: Math.round(1 / dt), ...corridorMetrics(run), longestWait: +run.longestWait.toFixed(2), blockedEvents: run.blockedEvents, noProgress: +run.noProgress.toFixed(2) }));
    }
  });
}
test('C/D change only width; restart returns identical deterministic conditions', () => {
  assert.deepEqual(createCorridorRun('C').npcs, createCorridorRun('D').npcs);
  const initial = createCorridorRun('C');
  stepCorridor(initial, 0);
  assert.deepEqual(initial, createCorridorRun('C'));
});
