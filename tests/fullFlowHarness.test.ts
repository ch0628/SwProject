/**
 * Full Flow Harness Tests
 *
 * A. Creator self-check (NPC=35, route/species/size/area counts, initial collision)
 * B. Limited Smoke regression (createSmoke = 10 NPC, 120s default)
 * C. Warm-up reset state preservation (t=30 transition)
 * D. Phase duration (WARMUP/MEASUREMENT/COMPLETE boundaries)
 * E. Short Full Flow Smoke (a few seconds of actual stepSmoke run)
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { footprint, overlaps, canOccupy } from '../src/collision.ts';
import { mapObjects, mapWorld, type GrayboxMap } from '../src/plazaPark.ts';
import { createSmoke, stepSmoke, SMOKE_ROUTES, TRAFFIC_ROUTE_PATHS } from '../src/plazaTraffic.ts';
import {
  createPlazaFullFlow35,
  createPlazaFullFlow30,
  stepFullFlow,
  fullFlowSummary,
  SPECIES_PROXY,
  resetFullFlowMeasurement, snapshotFullFlow, collectFullFlowMetrics,
  insideSpawnArea, segmentAreaIntersection,
  type FullFlowNpc,
  type Species,
  type FullFlowSize,
} from '../src/plazaFullFlow.ts';

const map: GrayboxMap = JSON.parse(
  readFileSync(new URL('../public/maps/plaza-park.tmj', import.meta.url), 'utf8'),
);
const solids = mapObjects(map, 'Collision');
const world = mapWorld(map);

test('30 subset preserves every retained actor field and original ID gaps', () => {
  const removed = [2, 10, 16, 24, 28];
  const original = createPlazaFullFlow35(map);
  const subset = createPlazaFullFlow30(map);
  assert.deepEqual(subset.run.npcs, original.run.npcs.filter(n => !removed.includes(n.id)));
  assert.deepEqual(original.run.npcs.filter(n => !subset.run.npcs.some(o => o.id === n.id)).map(n => n.id), removed);
  assert.equal(original.run.npcs.length, 35);
  assert.deepEqual(subset.run, { ...original.run, npcs: subset.run.npcs });
});

test('30 subset exact counts and spatial membership survive measurement reset', () => {
  const state = createPlazaFullFlow30(map);
  const routes = { R1: 4, R2: 4, R3: 3, R4: 4, R5: 2, R6: 4, R7: 5, R8: 4 };
  const species = { Rabbit: 7, Cat: 6, Fox: 6, Dog: 6, Tiger: 5 };
  const sizes = { Small: 7, Medium: 18, Large: 5 };
  const areas = { Park: 9, CentralPlaza: 9, Cafe: 2, PublicFacility: 3, MainRoute: 4, EntryExit: 3 };
  const npcs = state.run.npcs as FullFlowNpc[];
  for (const [field, expected] of [['route', routes], ['species', species], ['size', sizes], ['ffArea', areas]] as const) {
    for (const [key, count] of Object.entries(expected)) assert.equal(npcs.filter(n => n[field] === key).length, count);
  }
  for (const n of npcs) assert.ok(insideSpawnArea(n, mapObjects(map, 'Navigation').find(o => o.name === n.spawnRegion)!));
  const checkSummary = () => {
    const summary = fullFlowSummary(state);
    assert.equal(summary.npc_count, 30);
    assert.deepEqual(summary.route_counts, routes);
    assert.deepEqual(summary.species_counts, species);
    assert.deepEqual(summary.size_counts, sizes);
    assert.deepEqual(summary.declared_area_counts, areas);
    assert.deepEqual(summary.actual_spatial_area_counts, areas);
  };
  checkSummary();
  resetFullFlowMeasurement(state);
  checkSummary();
});

test('EntryExit uses the three approved regions; North uses the existing connector', () => {
  const nodes = mapObjects(map, 'Navigation');
  const a = nodes.find(o => o.name === 'W01')!;
  const b = nodes.find(o => o.name === 'W05')!;
  const rect = nodes.find(o => o.name === 'North Entry')!;
  assert.equal(segmentAreaIntersection(a, b, rect), undefined);
  const connector = nodes.find(o => o.name === 'North Entry Connector')!;
  assert.ok(segmentAreaIntersection(a, b, connector));
  const entries = (createPlazaFullFlow35(map).run.npcs as FullFlowNpc[]).filter(n => n.ffArea === 'EntryExit');
  assert.deepEqual(entries.map(n => [n.route, n.segmentStart, n.segmentEnd, n.spawnRegion]), [
    ['R1', 'W20', 'W21', 'West Exit'],
    ['R2', 'W01', 'W05', 'North Entry Connector'],
    ['R2', 'W20', 'W22', 'East Exit'],
  ]);
  for (const n of entries) assert.ok(insideSpawnArea(n, nodes.find(o => o.name === n.spawnRegion)!));
  // A blocked approved region must still throw, never relocate to another area.
  assert.throws(() => createPlazaFullFlow35(map, [connector]), /No safe Full Flow spawn/);
});

// ---------------------------------------------------------------------------
// Test A: Creator self-check
// ---------------------------------------------------------------------------

test('Full Flow creator self-check: 35 NPC, exact route/species/size counts, no initial collision', () => {
  const state = createPlazaFullFlow35(map);
  const ffNpcs = state.run.npcs as FullFlowNpc[];

  // NPC count
  assert.equal(ffNpcs.length, 35, 'npc_count must be 35');

  // Route counts: R1=4, R2=5, R3=4, R4=4, R5=2, R6=5, R7=6, R8=5
  const expectedRouteCounts: Record<string, number> = {
    R1: 4, R2: 5, R3: 4, R4: 4, R5: 2, R6: 5, R7: 6, R8: 5,
  };
  for (const [route, expected] of Object.entries(expectedRouteCounts)) {
    const actual = ffNpcs.filter(n => n.route === route).length;
    assert.equal(actual, expected, `route ${route} count: expected ${expected}, got ${actual}`);
  }

  // Species counts: Rabbit=8, Cat=7, Fox=7, Dog=7, Tiger=6
  const expectedSpecies: Record<Species, number> = { Rabbit: 8, Cat: 7, Fox: 7, Dog: 7, Tiger: 6 };
  for (const [sp, expected] of Object.entries(expectedSpecies) as [Species, number][]) {
    const actual = ffNpcs.filter(n => n.species === sp).length;
    assert.equal(actual, expected, `species ${sp}: expected ${expected}, got ${actual}`);
  }

  // Proxy size counts: Small(Rabbit)=8, Medium(Cat+Fox+Dog)=21, Large(Tiger)=6
  const sizeCounts: Record<FullFlowSize, number> = { Small: 0, Medium: 0, Large: 0 };
  for (const n of ffNpcs) {
    if (n.size === 'Small' || n.size === 'Medium' || n.size === 'Large') sizeCounts[n.size]++;
  }
  assert.equal(sizeCounts.Small, 8, `Small proxy count: expected 8, got ${sizeCounts.Small}`);
  assert.equal(sizeCounts.Medium, 21, `Medium proxy count: expected 21, got ${sizeCounts.Medium}`);
  assert.equal(sizeCounts.Large, 6, `Large proxy count: expected 6, got ${sizeCounts.Large}`);

  // Verify species→size mapping is correct
  for (const n of ffNpcs) {
    assert.equal(n.size, SPECIES_PROXY[n.species], `NPC ${n.id} species ${n.species} should map to ${SPECIES_PROXY[n.species]}`);
  }

  // Initial fixed collision = 0
  for (const n of ffNpcs) {
    const body = footprint(n.x, n.y, { width: n.size === 'Small' ? 18 : n.size === 'Medium' ? 22 : 26, height: n.size === 'Small' ? 12 : n.size === 'Medium' ? 14 : 16 });
    assert.ok(!solids.some(o => overlaps(body, o)), `NPC ${n.id} spawned inside fixed collision`);
  }

  // Initial NPC-NPC overlap = 0
  for (let i = 0; i < ffNpcs.length; i++) {
    for (let j = i + 1; j < ffNpcs.length; j++) {
      const ai = ffNpcs[i], aj = ffNpcs[j];
      const si = { width: ai.size === 'Small' ? 18 : ai.size === 'Medium' ? 22 : 26, height: ai.size === 'Small' ? 12 : ai.size === 'Medium' ? 14 : 16 };
      const sj = { width: aj.size === 'Small' ? 18 : aj.size === 'Medium' ? 22 : 26, height: aj.size === 'Small' ? 12 : aj.size === 'Medium' ? 14 : 16 };
      const fa = footprint(ai.x, ai.y, si);
      const fb = footprint(aj.x, aj.y, sj);
      assert.ok(!overlaps(fa, fb), `NPC ${ai.id} and ${aj.id} overlap at spawn`);
    }
  }

  // World bounds violation = 0
  for (const n of ffNpcs) {
    const si = { width: n.size === 'Small' ? 18 : n.size === 'Medium' ? 22 : 26, height: n.size === 'Small' ? 12 : n.size === 'Medium' ? 14 : 16 };
    const body = footprint(n.x, n.y, si);
    assert.ok(body.x >= 0 && body.y >= 0 && body.x + body.width <= world.width && body.y + body.height <= world.height,
      `NPC ${n.id} outside world bounds`);
  }

  // Total = 35
  const expectedAreas = { Park: 11, CentralPlaza: 10, Cafe: 3, PublicFacility: 3, MainRoute: 5, EntryExit: 3 };
  const spatialCounts = { Park: 0, CentralPlaza: 0, Cafe: 0, PublicFacility: 0, MainRoute: 0, EntryExit: 0 };
  const nodes = mapObjects(map, 'Navigation');
  for (const n of ffNpcs) {
    const rect = nodes.find(o => o.name === n.spawnRegion)!;
    assert.ok(insideSpawnArea(n, rect), `NPC ${n.id} must actually be inside ${n.spawnRegion}`);
    spatialCounts[n.ffArea]++;
    const a = nodes.find(o => o.name === n.segmentStart)!;
    const b = nodes.find(o => o.name === n.segmentEnd)!;
    assert.ok(Math.abs((n.x-a.x)*(b.y-a.y)-(n.y-a.y)*(b.x-a.x)) < 1e-6);
    const path = TRAFFIC_ROUTE_PATHS[n.route] as readonly string[];
    assert.equal(path[n.target], n.direction === 1 ? n.segmentEnd : n.segmentStart);
    assert.equal(path[n.target-n.direction], n.direction === 1 ? n.segmentStart : n.segmentEnd);
  }
  assert.deepEqual(spatialCounts, expectedAreas);
  assert.deepEqual(state.initialAreas.actual_spatial_area_counts, spatialCounts);
  assert.deepEqual(state.initialAreas.declared_area_counts, expectedAreas);
  const total = Object.values(expectedRouteCounts).reduce((a, b) => a + b, 0);
  assert.equal(total, 35, 'total route count sum must be 35');

  console.log(JSON.stringify({
    test: 'A_creator_self_check',
    npc_count: ffNpcs.length,
    route_counts: expectedRouteCounts,
    species_counts: expectedSpecies,
    size_counts: sizeCounts,
    declared_area_counts: state.initialAreas.declared_area_counts,
    actual_spatial_area_counts: spatialCounts,
    initial_fixed_collision: 0,
    initial_npc_overlap: 0,
    world_bounds_violation: 0,
  }));
});

// ---------------------------------------------------------------------------
// Test B: Limited Smoke regression
// ---------------------------------------------------------------------------

test('Limited Smoke regression: createSmoke 10 NPC, default 120s, R1~R5 semantics', () => {
  const run = createSmoke(map);

  // NPC count must remain 10
  assert.equal(run.npcs.length, 10, 'createSmoke() must produce 10 NPCs (R1~R5 x 2 directions)');

  // default maxSeconds is undefined → behaves as 120
  assert.equal(run.maxSeconds, undefined, 'createSmoke() must not set maxSeconds (defaults to 120 internally)');

  // Only R1~R5 routes
  const routes = new Set(run.npcs.map(n => n.route));
  for (const r of routes) {
    assert.ok(['R1', 'R2', 'R3', 'R4', 'R5'].includes(r), `createSmoke should only have R1~R5, got ${r}`);
  }

  // Run to completion and verify elapsed = 120
  for (let i = 0; i < 7200; i++) stepSmoke(run, map, 1 / 60);
  assert.ok(run.paused, 'run must be paused after 120s');
  assert.ok(Math.abs(run.elapsed - 120) < 0.01, `elapsed should be ~120, got ${run.elapsed}`);

  console.log(JSON.stringify({
    test: 'B_limited_regression',
    npc_count: run.npcs.length,
    default_duration: 120,
    routes: [...routes],
    elapsed: run.elapsed,
    paused: run.paused,
  }));
});

// ---------------------------------------------------------------------------
// Test C: Warm-up reset state preservation
// ---------------------------------------------------------------------------

function advanceTo(state: ReturnType<typeof createPlazaFullFlow35>, target: number) {
  while (state.globalElapsed < target - 1e-8) {
    const previous = state.globalElapsed;
    stepFullFlow(state, map, Math.min(0.05, target - previous));
    assert.ok(state.globalElapsed > previous, 'simulation must advance');
  }
  assert.ok(Math.abs(state.globalElapsed - target) < 1e-8);
}

test('Warm-up reset helper preserves every movement field, locks and merge exactly', () => {
  const state = createPlazaFullFlow35(map);
  advanceTo(state, 29.99);
  const npcs = state.run.npcs as FullFlowNpc[];
  const counters = ['mTrips','mArrivals','mBlockedEvents','mLongestWait','mWait','mRecoveries','mEnters','mExits','wait'] as const;
  for (const n of npcs) {
    for (const key of counters) n[key] = 99;
    n.severeReported = n.deadlockReported = true;
  }
  // Nonempty fixtures ensure preservation assertions cannot pass vacuously.
  Object.assign(npcs[0], { inside: 1.2, doorTarget: 'W17', pause: 0.3,
    forwardWait: 2, yieldTo: 7, yieldBackoff: 16, blockedBy: '' });
  npcs[1].blockedBy = 'W12 FIFO';
  state.run.locks = { 'Upper Narrow Path': { members: [2], queue: [3,4], direction: -1 },
    'Lower Narrow Path': { members: [5], queue: [6], direction: 1 } };
  state.run.merge = { owner: 2, queue: [3,4] };
  const movement = () => npcs.map(n => {
    const { mTrips,mArrivals,mBlockedEvents,mLongestWait,mWait,mRecoveries,mEnters,mExits,
      severeReported,deadlockReported,wait,measurementBlocked,...preserved } = n;
    return preserved;
  });
  const before = structuredClone(movement());
  const traffic = structuredClone({ locks: state.run.locks, merge: state.run.merge });
  resetFullFlowMeasurement(state);
  assert.deepEqual(movement(), before);
  assert.deepEqual({ locks: state.run.locks, merge: state.run.merge }, traffic);
  for (const n of npcs) {
    for (const key of counters) assert.equal(n[key], key === 'mBlockedEvents' ? Number(!!n.blockedBy) : 0, key);
    assert.equal(n.severeReported, false);
    assert.equal(n.deadlockReported, false);
  }
  assert.equal(state._lastW12Owner, 2);
  assert.equal(state._lastW12QueueEmpty, false);
});

test('Phase boundaries use actual elapsed: 29.99 / 30 / 329.99 / 330', () => {
  const s = createPlazaFullFlow35(map);
  for (const [time, phase] of [[29.99,'WARMUP'],[30,'MEASUREMENT'],[329.99,'MEASUREMENT'],[330,'COMPLETE']] as const) {
    advanceTo(s,time);
    assert.equal(s.phase,phase);
    assert.ok(Math.abs(s.run.elapsed-time)<1e-8);
    assert.ok(Math.abs(s.measurementElapsed-Math.max(0,time-30))<1e-8);
  }
  const before = structuredClone(s);
  stepFullFlow(s,map,0.05);
  assert.deepEqual(s,before,'COMPLETE is immutable');
});

test('Measurement block episodes count starts once, including an active boundary block', () => {
  const s = createPlazaFullFlow35(map);
  s.run.npcs = s.run.npcs.slice(0,1);
  const n = s.run.npcs[0] as FullFlowNpc;
  resetFullFlowMeasurement(s); s.phase = 'MEASUREMENT';
  const sample = (cause: string) => {
    const before = snapshotFullFlow(s); n.blockedBy = cause;
    collectFullFlowMetrics(s,map,0.05,before);
  };
  sample('NPC 2'); assert.equal(n.mBlockedEvents,1);
  sample('NPC 3'); assert.equal(n.mBlockedEvents,1);
  sample(''); sample('NPC 2'); assert.equal(n.mBlockedEvents,2);
  resetFullFlowMeasurement(s); assert.equal(n.mBlockedEvents,1);
  sample('NPC 2'); assert.equal(n.mBlockedEvents,1);
  sample(''); sample('NPC 2'); assert.equal(n.mBlockedEvents,2);
});

test('Narrow queue metrics use reservation queue lengths, not zone population', () => {
  const s = createPlazaFullFlow35(map); s.phase = 'MEASUREMENT';
  s.run.locks = { 'Upper Narrow Path': { members: [], queue: [1,2,3,4,5,6], direction: 1 },
    'Lower Narrow Path': { members: [], queue: [7,8,9], direction: -1 } };
  collectFullFlowMetrics(s,map,0.05,snapshotFullFlow(s));
  assert.equal(s.metrics.upper_narrow_max_queue,6);
  assert.equal(s.metrics.lower_narrow_max_queue,3);
  s.run.locks = {};
  collectFullFlowMetrics(s,map,0.05,snapshotFullFlow(s));
  assert.equal(s.metrics.upper_narrow_max_queue,6);
  assert.equal(s.metrics.lower_narrow_max_queue,3);
});

test('Narrow pass requires opposite-side exit; entry, same-side exit and duplicate frames do not count', () => {
  for (const which of ['Upper','Lower'] as const) {
    const s = createPlazaFullFlow35(map); s.run.npcs = s.run.npcs.slice(0,1);
    s.phase = 'MEASUREMENT';
    const n = s.run.npcs[0];
    const zone = mapObjects(map,'Navigation').find(o => o.name === which+' Narrow Path')!;
    const metric = which === 'Upper' ? 'upper_narrow_pass_count' : 'lower_narrow_pass_count';
    n.x = zone.x-20; n.y = zone.y+zone.height/2;
    const move = (x: number) => { const before=snapshotFullFlow(s);n.x=x;collectFullFlowMetrics(s,map,0.05,before); };
    move(zone.x+20); assert.equal(s.metrics[metric],0);
    move(zone.x-20); assert.equal(s.metrics[metric],0);
    move(zone.x+20); move(zone.x+zone.width+20); assert.equal(s.metrics[metric],1);
    move(n.x); assert.equal(s.metrics[metric],1);
    // A known warm-up entry survives reset, but no warm-up pass is counted.
    s.phase='WARMUP'; move(zone.x+zone.width-20);
    resetFullFlowMeasurement(s); s.phase='MEASUREMENT'; move(zone.x-20);
    assert.equal(s.metrics[metric],1);
  }
});

test('W12 baseline ignores existing owner/queue; counts later real changes and recoveries', () => {
  const s=createPlazaFullFlow35(map);
  s.run.merge={owner:2,queue:[3,4]};
  resetFullFlowMeasurement(s);s.phase='MEASUREMENT';
  collectFullFlowMetrics(s,map,0.05,snapshotFullFlow(s));
  assert.equal(s.metrics.w12_owner_change_count,0);
  assert.equal(s.metrics.w12_queue_recovery_count,0);
  s.run.merge={owner:3,queue:[]};
  collectFullFlowMetrics(s,map,0.05,snapshotFullFlow(s));
  assert.equal(s.metrics.w12_owner_change_count,1);
  assert.equal(s.metrics.w12_queue_recovery_count,1);
  collectFullFlowMetrics(s,map,0.05,snapshotFullFlow(s));
  assert.equal(s.metrics.w12_queue_recovery_count,1);
});

test('Door metrics follow actual doorTarget/threshold even when route labels differ', () => {
  for (const [target, door, prefix] of [['W17','Cafe','cafe'],['W19','Facility','facility']] as const) {
    const s=createPlazaFullFlow35(map);s.run.npcs=s.run.npcs.slice(0,1);
    const n=s.run.npcs[0] as FullFlowNpc;
    const point=mapObjects(map,'Navigation').find(o=>o.name===target)!;
    Object.assign(n,{x:point.x,y:point.y,route:'R6',doorTarget:target});
    resetFullFlowMeasurement(s);s.phase='MEASUREMENT';
    stepFullFlow(s,map,0.05);
    assert.equal(s.metrics[prefix+'_enter_count'],1,door);
    assert.equal(n.mEnters,1);
    n.inside=0.01;
    stepFullFlow(s,map,0.05);
    assert.equal(s.metrics[prefix+'_exit_count'],1,door);
    assert.equal(n.mExits,1);
  }
});

test('Paused full35 preserves elapsed and measurement state', () => {
  const s=createPlazaFullFlow35(map);s.run.paused=true;
  const before=structuredClone(s);stepFullFlow(s,map,0.05);assert.deepEqual(s,before);
});

// ---------------------------------------------------------------------------
// Test E: Short Full Flow Smoke (actual stepSmoke execution for a few seconds)
// ---------------------------------------------------------------------------

test('Short Full Flow Smoke: 35 NPC, multiple routes, warm-up boundary, metric collector', () => {
  const state = createPlazaFullFlow35(map);
  const ffNpcs = state.run.npcs as FullFlowNpc[];
  const fps = 60;

  // Run for 35 seconds (crosses warm-up boundary at 30s, enters measurement)
  const steps = 35 * fps;
  for (let i = 0; i < steps; i++) {
    stepFullFlow(state, map, 1 / fps);
    if (state.phase === 'COMPLETE') break;
  }

  assert.equal(state.phase, 'MEASUREMENT', 'after 35s should be in MEASUREMENT');
  assert.ok(state.globalElapsed >= 34.9, `globalElapsed should be >= 34.9, got ${state.globalElapsed}`);
  assert.ok(state.measurementElapsed >= 4.5, `measurementElapsed should be >= 4.5s after 35s run`);

  // Per-frame physical safety during measurement phase (check final state)
  let fixedViol = 0, npcViol = 0;
  for (const n of ffNpcs) {
    if (n.inside) continue;
    const si = { width: n.size === 'Small' ? 18 : n.size === 'Medium' ? 22 : 26, height: n.size === 'Small' ? 12 : n.size === 'Medium' ? 14 : 16 };
    const body = footprint(n.x, n.y, si);
    if (solids.some(o => overlaps(body, o))) fixedViol++;
  }
  for (let i = 0; i < ffNpcs.length; i++) {
    if (ffNpcs[i].inside) continue;
    for (let j = i + 1; j < ffNpcs.length; j++) {
      if (ffNpcs[j].inside) continue;
      const si = { width: ffNpcs[i].size === 'Small' ? 18 : ffNpcs[i].size === 'Medium' ? 22 : 26, height: ffNpcs[i].size === 'Small' ? 12 : ffNpcs[i].size === 'Medium' ? 14 : 16 };
      const sj = { width: ffNpcs[j].size === 'Small' ? 18 : ffNpcs[j].size === 'Medium' ? 22 : 26, height: ffNpcs[j].size === 'Small' ? 12 : ffNpcs[j].size === 'Medium' ? 14 : 16 };
      if (overlaps(footprint(ffNpcs[i].x, ffNpcs[i].y, si), footprint(ffNpcs[j].x, ffNpcs[j].y, sj))) npcViol++;
    }
  }

  assert.equal(fixedViol, 0, 'no fixed collision violations after 35s run');
  assert.equal(npcViol, 0, 'no NPC-NPC overlap after 35s run');

  // At least some NPCs should have moved
  const totalArrivals = ffNpcs.reduce((s, n) => s + n.arrivals, 0);
  assert.ok(totalArrivals > 0, `some waypoint arrivals expected after 35s, got ${totalArrivals}`);

  const summary = fullFlowSummary(state);
  console.log(JSON.stringify({
    test: 'E_short_smoke',
    phase: state.phase,
    globalElapsed: Number(state.globalElapsed.toFixed(2)),
    measurementElapsed: Number(state.measurementElapsed.toFixed(2)),
    totalArrivals,
    fixedViol,
    npcViol,
    collision_violation_total: state.metrics.collision_violation_total,
  }));
});
