/**
 * R6/R7/R8 Candidate Route Dynamic Validation
 *
 * Tests A and B only — no Full Flow, no new Movement algorithm.
 * Uses the same Fix4 stepSmoke() semantics as existing regression tests.
 *
 * Forbidden by task spec:
 *   - 35 NPC Harness
 *   - Map/Waypoint modification
 *   - New avoidance / pathfinding
 *   - Suppressing FAIL results
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { footprint, overlaps, canOccupy } from '../src/collision.ts';
import { mapObjects, mapWorld, canStand, type GrayboxMap } from '../src/plazaPark.ts';
import {
  FULL_FLOW_ROUTE_CANDIDATES,
  TRAFFIC_ROUTE_PATHS,
  SMOKE_SIZES,
  type CandidateRouteId,
  type SmokeNpc,
  type SmokeRun,
  stepSmoke,
  smokeMetrics,
} from '../src/plazaTraffic.ts';

const map: GrayboxMap = JSON.parse(
  readFileSync(new URL('../public/maps/plaza-park.tmj', import.meta.url), 'utf8'),
);
const solids = mapObjects(map, 'Collision');
const world = mapWorld(map);
const navNodes = mapObjects(map, 'Navigation');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal SmokeRun with NPCs on a candidate route.
 *  Mirrors the spawn strategy in createSmoke(): stagger along first edge,
 *  skip positions that overlap solids or existing NPCs. */
function buildCandidateRun(
  route: CandidateRouteId,
  sizes: Array<keyof typeof SMOKE_SIZES>,
  directions: Array<1 | -1>,
): SmokeRun {
  const path = TRAFFIC_ROUTE_PATHS[route] as readonly string[];
  const npcs: SmokeNpc[] = [];

  for (let i = 0; i < sizes.length; i++) {
    const dir = directions[i];
    const startIdx = dir === 1 ? 0 : path.length - 1;
    const targetIdx = startIdx + dir;

    const aName = path[startIdx];
    const bName = path[targetIdx];
    const a = navNodes.find((n) => n.name === aName)!;
    const b = navNodes.find((n) => n.name === bName)!;
    const shape = SMOKE_SIZES[sizes[i]];
    const length = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));

    let spawn: { x: number; y: number } | undefined;
    for (let offset = 0; offset < Math.min(length, 512); offset += 32) {
      const x = a.x + (b.x - a.x) * (offset / length);
      const y = a.y + (b.y - a.y) * (offset / length);
      const fp = footprint(x, y, shape);
      // Use canOccupy (world origin is 0,0) — same check as createSmoke().
      const clear =
        canOccupy(fp, [...solids, ...npcs.map((n) => footprint(n.x, n.y, SMOKE_SIZES[n.size]))], world);
      if (clear) { spawn = { x, y }; break; }
    }
    if (!spawn) throw new Error(`No safe spawn for ${route} direction ${dir} size ${sizes[i]}`);

    npcs.push({
      id: i + 1,
      route,
      size: sizes[i],
      x: spawn.x,
      y: spawn.y,
      target: targetIdx,
      direction: dir,
      pause: 0,
      wait: 0,
      longestWait: 0,
      blockedEvents: 0,
      blockedBy: '',
      moving: false,
      arrivals: 0,
      trips: 0,
    });
  }

  return { npcs, elapsed: 0, paused: false, policy: 'fallback', locks: {}, merge: { queue: [] } };
}

/** Per-frame physical safety check: fixed collision + NPC-NPC overlap. */
function checkFrame(run: SmokeRun, violations: { fixed: number; npcNpc: number }): void {
  for (const n of run.npcs) {
    if (n.inside) continue;
    const f = footprint(n.x, n.y, SMOKE_SIZES[n.size]);
    if (solids.some((o) => overlaps(f, o))) violations.fixed++;
    for (const o of run.npcs) {
      if (o !== n && !o.inside && overlaps(f, footprint(o.x, o.y, SMOKE_SIZES[o.size])))
        violations.npcNpc++;
    }
  }
}

const CANDIDATE_ROUTES = Object.keys(FULL_FLOW_ROUTE_CANDIDATES) as CandidateRouteId[];
const SIZES = ['Small', 'Medium', 'Large'] as const;

// ---------------------------------------------------------------------------
// Test A: Candidate single-route baseline (Small / Medium / Large)
// ---------------------------------------------------------------------------
test('Candidate single-route baseline: R6/R7/R8 each size 120s', () => {
  for (const route of CANDIDATE_ROUTES) {
    for (const size of SIZES) {
      const run = buildCandidateRun(route, [size], [1]);
      const violations = { fixed: 0, npcNpc: 0 };
      const fps = 60;
      for (let i = 0; i < 120 * fps; i++) {
        stepSmoke(run, map, 1 / fps);
        checkFrame(run, violations);
        if (run.paused) break;
      }
      const n = run.npcs[0];
      console.log(JSON.stringify({
        candidate: route,
        mode: 'single',
        size,
        trips: n.trips,
        maxWait: Number(n.longestWait.toFixed(3)),
        collisionViolation: violations.fixed,
        worldBoundsViolation: canStand(n.x, n.y, solids, world) ? 0 : 1,
      }));
      assert.equal(violations.fixed, 0, `${route} ${size}: fixed collision violation`);
      assert.ok(canStand(n.x, n.y, solids, world), `${route} ${size}: world bounds violation`);
      assert.ok(n.trips >= 1, `${route} ${size}: must complete at least 1 trip`);
    }
  }
});

// ---------------------------------------------------------------------------
// Test B: Candidate bidirectional pair (Large + Large)
// ---------------------------------------------------------------------------
test('Candidate bidirectional pair: R6/R7/R8 Large+Large 120s', () => {
  for (const route of CANDIDATE_ROUTES) {
    const run = buildCandidateRun(route, ['Large', 'Large'], [1, -1]);
    const violations = { fixed: 0, npcNpc: 0 };
    const fps = 60;
    for (let i = 0; i < 120 * fps; i++) {
      stepSmoke(run, map, 1 / fps);
      checkFrame(run, violations);
      if (run.paused) break;
    }
    const metrics = smokeMetrics(run);
    console.log(JSON.stringify({
      candidate: route,
      mode: 'bidirectional',
      trips: run.npcs.map((n) => ({ id: n.id, trips: n.trips })),
      maxWait: Number(metrics.max_continuous_blocked_time.toFixed(3)),
      unrecovered20: metrics.unrecovered_20sec,
      collisionViolation: violations.fixed + violations.npcNpc,
    }));
    assert.equal(violations.fixed + violations.npcNpc, 0, `${route} bidir: physical collision violation`);
    assert.equal(metrics.unrecovered_20sec, 0, `${route} bidir: unrecovered 20s block`);
    for (const n of run.npcs) {
      assert.ok(
        n.trips >= 1,
        `${route} bidir: NPC ${n.id} dir=${n.direction > 0 ? 'fwd' : 'rev'} must complete >= 1 trip`,
      );
    }
  }
});
