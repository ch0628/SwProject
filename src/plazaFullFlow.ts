/**
 * Plaza/Park Full Flow 35 NPC Harness
 *
 * Implements §3–§14 of the Plaza/Park 35 NPC Full Flow task spec.
 * Movement core (Fix4) remains in plazaTraffic.ts unchanged.
 * This file: Full Flow preset / creator / warm-up / measurement / metric collector.
 */

import { canOccupy, footprint, overlaps, type Bounds } from './collision.ts';
import { mapObjects, mapWorld, enterDoor, type GrayboxMap } from './plazaPark.ts';
import {
  stepSmoke,
  SMOKE_SIZES,
  TRAFFIC_ROUTE_PATHS,
  type SmokeNpc,
  type SmokeRun,
  type AllRouteId,
} from './plazaTraffic.ts';

// ---------------------------------------------------------------------------
// Species / Size definitions (§4)
// ---------------------------------------------------------------------------

export type Species = 'Rabbit' | 'Cat' | 'Fox' | 'Dog' | 'Tiger';
export type FullFlowSize = 'Small' | 'Medium' | 'Large';
export type FullFlowArea =
  | 'Park'
  | 'CentralPlaza'
  | 'Cafe'
  | 'PublicFacility'
  | 'MainRoute'
  | 'EntryExit';

/** Full-flow collision proxy per species (§4). Max96 is NOT used here. */
export const SPECIES_PROXY: Record<Species, FullFlowSize> = {
  Rabbit: 'Small',
  Cat: 'Medium',
  Fox: 'Medium',
  Dog: 'Medium',
  Tiger: 'Large',
};

/** Species cycle for deterministic round-robin (§4). */
const SPECIES_CYCLE: Species[] = ['Rabbit', 'Cat', 'Fox', 'Dog', 'Tiger'];

/** Quota check: 8/7/7/7/6 = 35 */
const SPECIES_QUOTA: Record<Species, number> = { Rabbit: 8, Cat: 7, Fox: 7, Dog: 7, Tiger: 6 };

// ---------------------------------------------------------------------------
// 35 NPC layout descriptor (§5)
// route → { count, area, fromIndex (for spawn stagger) }
// ---------------------------------------------------------------------------

interface RouteLayout {
  route: AllRouteId;
  count: number;
  area: FullFlowArea;
  segments: number[];
  region: string;
}

/** R1~R8 confirmed allocation (§3 + §5).
 *  Each entry is a group of NPCs sharing one route AND one initial spawn area.
 *  Sum per route must equal ROUTE_COUNTS; sum per area must equal §5 distribution.
 *  Park=11, CentralPlaza=10, Cafe=3, PublicFacility=3, MainRoute=5, EntryExit=3
 */
const FULL_FLOW_LAYOUT: RouteLayout[] = [
  // ── Park (total=11): R6(5) + R5(2) + R1(2) + R2(2) ──
  { route: 'R6', count: 5, area: 'Park', segments: [0,1], region: 'Park' },
  { route: 'R5', count: 2, area: 'Park', segments: [0], region: 'Park' },
  { route: 'R1', count: 2, area: 'Park', segments: [1], region: 'Park' },
  { route: 'R2', count: 2, area: 'Park', segments: [1], region: 'Park' },
  // ── CentralPlaza (total=10): R7(6) + R1(1) + R2(1) + R3(1) + R4(1) ──
  { route: 'R7', count: 6, area: 'CentralPlaza', segments: [0,1], region: 'Central Plaza' },
  { route: 'R1', count: 1, area: 'CentralPlaza', segments: [2], region: 'Central Plaza' },
  { route: 'R2', count: 1, area: 'CentralPlaza', segments: [4], region: 'Central Plaza' },
  { route: 'R3', count: 1, area: 'CentralPlaza', segments: [1], region: 'Central Plaza' },
  { route: 'R4', count: 1, area: 'CentralPlaza', segments: [3], region: 'Central Plaza' },
  // ── Cafe (total=3): R3(3) ──
  { route: 'R3', count: 3, area: 'Cafe', segments: [2], region: 'Cafe Zone' },
  // ── PublicFacility (total=3): R4(3) ──
  { route: 'R4', count: 3, area: 'PublicFacility', segments: [1], region: 'Public Facility Zone' },
  // ── MainRoute (total=5): R8(5) ──
  { route: 'R8', count: 5, area: 'MainRoute', segments: [0,1], region: 'Main Route' },
  // ── EntryExit (total=3): R1(1) + R2(2) ──
  { route: 'R1', count: 1, area: 'EntryExit', segments: [4], region: 'West Exit' },
  // Approved North Entry spawn uses the existing connector rectangle.
  { route: 'R2', count: 1, area: 'EntryExit', segments: [0], region: 'North Entry Connector' },
  { route: 'R2', count: 1, area: 'EntryExit', segments: [6], region: 'East Exit' },
];

// Route-level summary: count must equal task §3 exactly.
const ROUTE_COUNTS: Record<AllRouteId, number> = {
  R1: 4, R2: 5, R3: 4, R4: 4, R5: 2, R6: 5, R7: 6, R8: 5,
};

// ---------------------------------------------------------------------------
// FullFlow NPC descriptor
// ---------------------------------------------------------------------------

export interface FullFlowNpc extends SmokeNpc {
  species: Species;
  ffArea: FullFlowArea;
  segmentStart: string;
  segmentEnd: string;
  spawnRegion: string;
  // Measurement-phase-only counters (reset at t=30)
  mTrips: number;
  mArrivals: number;
  mBlockedEvents: number;
  mLongestWait: number;
  mWait: number;            // current block duration (measurement phase)
  mRecoveries: number;
  mEnters: number;
  mExits: number;
  // Severe-block episode tracking (§11)
  severeReported: boolean;
  deadlockReported: boolean;
  // Narrow membership tracking (§11)
  inUpperNarrow: boolean;
  inLowerNarrow: boolean;
  narrowEntry?: Partial<Record<'Upper' | 'Lower', number>>;
  measurementBlocked?: boolean;
}

// ---------------------------------------------------------------------------
// Measurement state
// ---------------------------------------------------------------------------

export type FullFlowPhase = 'WARMUP' | 'MEASUREMENT' | 'COMPLETE';

export interface PerRouteMetric {
  route: AllRouteId;
  trips: number;
  arrivals: number;
  max_wait: number;
  blocked_events: number;
}

export interface FullFlowMetrics {
  npc_count: number;
  route_counts: Record<AllRouteId, number>;
  species_counts: Record<Species, number>;
  size_counts: Record<FullFlowSize, number>;

  warmup_seconds: number;
  measurement_seconds: number;

  completed_routes: number;
  waypoint_arrivals: number;
  per_route: PerRouteMetric[];

  blocked_time_total: number;        // actor-seconds blockedBy != ''
  max_continuous_blocked_time: number;
  blocked_npc_count_end: number;     // at measurement end: wait >= 0.5s
  blocked_npc_count_peak: number;

  severe_block_count: number;        // unique episodes >= 10s
  deadlock_count: number;            // unique episodes reaching 20s threshold
  ever_20sec_block_count: number;
  unrecovered_20sec: number;         // at end: wait >= 20s

  recoveries: number;

  fixed_collision_violation: number;
  npc_collision_violation: number;
  world_bounds_violation: number;
  collision_violation_total: number;

  cafe_enter_count: number;
  cafe_exit_count: number;
  facility_enter_count: number;
  facility_exit_count: number;

  upper_narrow_pass_count: number;
  lower_narrow_pass_count: number;
  upper_narrow_max_queue: number;
  lower_narrow_max_queue: number;

  w12_max_queue: number;
  w12_owner_change_count: number;
  w12_queue_recovery_count: number;
}

export interface FullFlowState {
  run: SmokeRun;
  initialAreas: { declared_area_counts: Record<FullFlowArea,number>; actual_spatial_area_counts: Record<FullFlowArea,number> };
  phase: FullFlowPhase;
  globalElapsed: number;
  measurementElapsed: number;
  metrics: FullFlowMetrics;
  // W12 owner tracking for change count
  _lastW12Owner: number | undefined;
  _lastW12QueueEmpty: boolean;
  queueWaits?: Record<string, Record<number, number>>;
  queueMaxWaits?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Spawn helpers
// ---------------------------------------------------------------------------

/** Build a deterministic species assignment across all 35 slots. */
function buildSpeciesAssignment(): Species[] {
  const result: Species[] = [];
  const used: Record<Species, number> = { Rabbit: 0, Cat: 0, Fox: 0, Dog: 0, Tiger: 0 };
  let cycleIdx = 0;
  for (let i = 0; i < 35; i++) {
    // advance cycle until we find a species with remaining quota
    let attempts = 0;
    while (used[SPECIES_CYCLE[cycleIdx % 5]] >= SPECIES_QUOTA[SPECIES_CYCLE[cycleIdx % 5]]) {
      cycleIdx++;
      attempts++;
      if (attempts > 10) throw new Error('Species quota exhausted');
    }
    const sp = SPECIES_CYCLE[cycleIdx % 5];
    result.push(sp);
    used[sp]++;
    cycleIdx++;
  }
  return result;
}

export function insideSpawnArea(point: { x: number; y: number }, rect: Bounds): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height;
}

/** Clip the existing waypoint segment to an approved TMJ rectangle. */
export function segmentAreaIntersection(a: {x:number;y:number}, b: {x:number;y:number}, rect: Bounds): [number,number] | undefined {
  let lo=0, hi=1;
  for (const axis of ['x','y'] as const) {
    const delta=b[axis]-a[axis], min=rect[axis], max=min+(axis==='x'?rect.width:rect.height);
    if (!delta) { if (a[axis]<min || a[axis]>=max) return; }
    else {
      const t1=(min-a[axis])/delta, t2=(max-a[axis])/delta;
      lo=Math.max(lo,Math.min(t1,t2)); hi=Math.min(hi,Math.max(t1,t2));
      if (lo>hi) return;
    }
  }
  return [lo,hi];
}

function findSafeSpawn(
  map: GrayboxMap, segmentStart: string, segmentEnd: string, region: string,
  direction: 1 | -1, size: {width:number;height:number}, external: Bounds[], existing: FullFlowNpc[],
): {x:number;y:number} {
  const nodes=mapObjects(map,'Navigation');
  const a=nodes.find(n=>n.name===segmentStart), b=nodes.find(n=>n.name===segmentEnd);
  const rect=nodes.find(n=>n.name===region);
  if (!a || !b || !rect) throw new Error('Missing approved spawn waypoint/rectangle: '+region);
  const interval=segmentAreaIntersection(a,b,rect);
  if (!interval) throw new Error('No area intersection: '+segmentStart+' ↔ '+segmentEnd+' / '+region);
  const length=Math.hypot(b.x-a.x,b.y-a.y);
  const span=(interval[1]-interval[0])*length;
  const obstacles=[...mapObjects(map,'Collision'),...external,...existing.map(n=>footprint(n.x,n.y,SMOKE_SIZES[n.size]))];
  // <= 8px deterministic spacing, including both intersection endpoints.
  const steps=Math.max(1,Math.ceil(span/8));
  for (let i=0;i<=steps;i++) {
    const ratio=direction===1?i/steps:1-i/steps;
    const t=interval[0]+(interval[1]-interval[0])*ratio;
    const point={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    if (insideSpawnArea(point,rect) && canOccupy(footprint(point.x,point.y,size),obstacles,mapWorld(map))) return point;
  }
  throw new Error('No safe Full Flow spawn: '+segmentStart+' ↔ '+segmentEnd+' / '+region);
}

// ---------------------------------------------------------------------------
// createPlazaFullFlow35
// ---------------------------------------------------------------------------

/**
 * Create the 35 NPC Full Flow run.
 * Returns a FullFlowState with SmokeRun embedded.
 * Self-checks run immediately; throws on any violation (§13).
 */
export function createPlazaFullFlow35(map: GrayboxMap, external: Bounds[] = []): FullFlowState {
  const nodes = mapObjects(map, 'Navigation');
  const solids = mapObjects(map, 'Collision');
  const world = mapWorld(map);

  // Build species list (deterministic, quota-exact)
  const speciesList = buildSpeciesAssignment();

  const ffNpcs: FullFlowNpc[] = [];
  let globalSlot = 0;

  // Spawn in route-layout order to satisfy area distribution (§5)
  for (const layout of FULL_FLOW_LAYOUT) {
    const path = TRAFFIC_ROUTE_PATHS[layout.route] as readonly string[];

    for (let i = 0; i < layout.count; i++) {
      const species = speciesList[globalSlot];
      const proxySize = SPECIES_PROXY[species];
      const shape = SMOKE_SIZES[proxySize];

      // Alternate direction for spread
      const direction: 1 | -1 = globalSlot % 2 === 0 ? 1 : -1;
      const segmentIndex = layout.segments[i % layout.segments.length];
      const segmentStart = path[segmentIndex], segmentEnd = path[segmentIndex + 1];
      const targetIdx = direction === 1 ? segmentIndex + 1 : segmentIndex;

      const spawn = findSafeSpawn(
        map, segmentStart, segmentEnd, layout.region, direction, shape, external, ffNpcs,
      );

      const npc: FullFlowNpc = {
        id: globalSlot + 1,
        route: layout.route,
        size: proxySize,
        species,
        ffArea: layout.area,
        segmentStart, segmentEnd, spawnRegion: layout.region,
        x: spawn.x,
        y: spawn.y,
        target: targetIdx,
        direction,
        pause: 0,
        wait: 0,
        longestWait: 0,
        blockedEvents: 0,
        blockedBy: '',
        moving: false,
        arrivals: 0,
        trips: 0,
        forwardWait: 0,
        recoveries: 0,
        doorTarget: undefined,
        inside: undefined,
        enters: 0,
        exits: 0,
        yieldTo: undefined,
        yieldBackoff: 0,
        // Measurement-phase counters
        mTrips: 0,
        mArrivals: 0,
        mBlockedEvents: 0,
        mLongestWait: 0,
        mWait: 0,
        mRecoveries: 0,
        mEnters: 0,
        mExits: 0,
        severeReported: false,
        deadlockReported: false,
        inUpperNarrow: false,
        inLowerNarrow: false,
      };

      ffNpcs.push(npc);
      globalSlot++;
    }
  }

  // Build SmokeRun (maxSeconds = 330)
  const run: SmokeRun = {
    npcs: ffNpcs as SmokeNpc[],
    elapsed: 0,
    paused: false,
    policy: 'fallback',
    locks: {},
    merge: { queue: [] },
    maxSeconds: 330,
  };

  // ---------------------------------------------------------------------------
  // Self-check (§13, §6)
  // ---------------------------------------------------------------------------
  // 1. NPC count
  if (ffNpcs.length !== 35) throw new Error(`Self-check FAIL: NPC count = ${ffNpcs.length}, expected 35`);

  // 2. Route counts
  for (const [route, expected] of Object.entries(ROUTE_COUNTS) as [AllRouteId, number][]) {
    const actual = ffNpcs.filter(n => n.route === route).length;
    if (actual !== expected) throw new Error(`Self-check FAIL: route ${route} count = ${actual}, expected ${expected}`);
  }

  // 3. Species counts
  for (const [sp, expected] of Object.entries(SPECIES_QUOTA) as [Species, number][]) {
    const actual = ffNpcs.filter(n => n.species === sp).length;
    if (actual !== expected) throw new Error(`Self-check FAIL: species ${sp} count = ${actual}, expected ${expected}`);
  }

  // 4. Size proxy counts (Small=8, Medium=21, Large=6)
  const sizeCounts = { Small: 0, Medium: 0, Large: 0 };
  for (const n of ffNpcs) {
    if (n.size === 'Small' || n.size === 'Medium' || n.size === 'Large') sizeCounts[n.size]++;
  }
  if (sizeCounts.Small !== 8) throw new Error(`Self-check FAIL: Small count = ${sizeCounts.Small}, expected 8`);
  if (sizeCounts.Medium !== 21) throw new Error(`Self-check FAIL: Medium count = ${sizeCounts.Medium}, expected 21`);
  if (sizeCounts.Large !== 6) throw new Error(`Self-check FAIL: Large count = ${sizeCounts.Large}, expected 6`);

  // 5. Area counts: Park=11, CentralPlaza=10, Cafe=3, PublicFacility=3, MainRoute=5, EntryExit=3
  const expectedAreas: Record<FullFlowArea, number> = {
    Park: 11, CentralPlaza: 10, Cafe: 3, PublicFacility: 3, MainRoute: 5, EntryExit: 3,
  };
  for (const [area, expected] of Object.entries(expectedAreas) as [FullFlowArea, number][]) {
    const actual = ffNpcs.filter(n => n.ffArea === area).length;
    if (actual !== expected) throw new Error(`Self-check FAIL: area ${area} count = ${actual}, expected ${expected}`);
  }

  // Verify coordinates, not just labels. Zones overlap in the source map
  // (Facility is inside Park; exits are inside Main Route). Count each assigned
  // NPC once only after its actual rectangle membership is established.
  const declared_area_counts = {...expectedAreas};
  const actual_spatial_area_counts = Object.fromEntries(Object.keys(expectedAreas).map(a=>[a,0])) as Record<FullFlowArea,number>;
  for (const n of ffNpcs) {
    const rect=nodes.find(o=>o.name===n.spawnRegion)!;
    if (!insideSpawnArea(n,rect)) throw new Error('Self-check FAIL: spatial area for NPC '+n.id);
    actual_spatial_area_counts[n.ffArea]++;
    const a=nodes.find(o=>o.name===n.segmentStart)!, b=nodes.find(o=>o.name===n.segmentEnd)!;
    const dx=b.x-a.x,dy=b.y-a.y,projection=((n.x-a.x)*dx+(n.y-a.y)*dy)/(dx*dx+dy*dy);
    if (Math.abs((n.x-a.x)*dy-(n.y-a.y)*dx)>1e-6 || projection<0 || projection>1) throw new Error('Self-check FAIL: spawn segment for NPC '+n.id);
  }
  for (const [area,expected] of Object.entries(expectedAreas) as [FullFlowArea,number][]) {
    if (actual_spatial_area_counts[area]!==expected) throw new Error('Self-check FAIL: spatial count '+area);
  }

  // 6. Initial fixed collision = 0
  for (const n of ffNpcs) {
    const body = footprint(n.x, n.y, SMOKE_SIZES[n.size]);
    if (solids.some(o => overlaps(body, o))) {
      throw new Error(`Self-check FAIL: NPC ${n.id} spawned inside fixed collision object`);
    }
  }

  // 7. Initial NPC-NPC overlap = 0
  for (let i = 0; i < ffNpcs.length; i++) {
    for (let j = i + 1; j < ffNpcs.length; j++) {
      const a = footprint(ffNpcs[i].x, ffNpcs[i].y, SMOKE_SIZES[ffNpcs[i].size]);
      const b = footprint(ffNpcs[j].x, ffNpcs[j].y, SMOKE_SIZES[ffNpcs[j].size]);
      if (overlaps(a, b)) {
        throw new Error(`Self-check FAIL: NPC ${ffNpcs[i].id} and ${ffNpcs[j].id} overlap at spawn`);
      }
    }
  }

  // 8. World bounds = 0
  for (const n of ffNpcs) {
    const body = footprint(n.x, n.y, SMOKE_SIZES[n.size]);
    if (body.x < 0 || body.y < 0 || body.x + body.width > world.width || body.y + body.height > world.height) {
      throw new Error(`Self-check FAIL: NPC ${n.id} outside world bounds`);
    }
  }

  const metrics = makeEmptyMetrics(ffNpcs);

  return {
    run,
    initialAreas: { declared_area_counts, actual_spatial_area_counts },
    phase: 'WARMUP',
    globalElapsed: 0,
    measurementElapsed: 0,
    metrics,
    _lastW12Owner: undefined,
    _lastW12QueueEmpty: true,
  };
}

// ---------------------------------------------------------------------------
// Empty metrics constructor
// ---------------------------------------------------------------------------

/** Approved density subset: retain the original actors, coordinates and ID gaps. */
export function createPlazaFullFlow30(map: GrayboxMap, external: Bounds[] = []): FullFlowState {
  const state = createPlazaFullFlow35(map, external);
  const removeIds = new Set([2, 10, 16, 24, 28]);
  state.run.npcs = state.run.npcs.filter(n => !removeIds.has(n.id));
  const npcs = state.run.npcs as FullFlowNpc[];
  if (npcs.length !== 30) throw new Error('30 subset self-check: NPC count');
  state.metrics = makeEmptyMetrics(npcs);
  const expectedAreas = { Park: 9, CentralPlaza: 9, Cafe: 2, PublicFacility: 3, MainRoute: 4, EntryExit: 3 };
  const declared = { ...expectedAreas }, spatial = { ...expectedAreas };
  const nodes = mapObjects(map, 'Navigation');
  for (const area of Object.keys(expectedAreas) as FullFlowArea[]) {
    const assigned = npcs.filter(n => n.ffArea === area);
    declared[area] = assigned.length;
    spatial[area] = assigned.filter(n => {
      const rect = nodes.find(o => o.name === n.spawnRegion);
      return rect && insideSpawnArea(n, rect);
    }).length;
  }
  state.initialAreas = { declared_area_counts: declared, actual_spatial_area_counts: spatial };
  const check = (actual: Record<string, number>, expected: Record<string, number>) => {
    for (const [key, count] of Object.entries(expected)) {
      if (actual[key] !== count) throw new Error(`30 subset self-check: ${key} = ${actual[key]}, expected ${count}`);
    }
  };
  check(state.metrics.route_counts, { R1: 4, R2: 4, R3: 3, R4: 4, R5: 2, R6: 4, R7: 5, R8: 4 });
  check(state.metrics.species_counts, { Rabbit: 7, Cat: 6, Fox: 6, Dog: 6, Tiger: 5 });
  check(state.metrics.size_counts, { Small: 7, Medium: 18, Large: 5 });
  check(declared, expectedAreas);
  check(spatial, expectedAreas);
  return state;
}

function makeEmptyMetrics(ffNpcs: FullFlowNpc[]): FullFlowMetrics {
  const route_counts = {} as Record<AllRouteId, number>;
  for (const r of Object.keys(ROUTE_COUNTS) as AllRouteId[]) route_counts[r] = ffNpcs.filter(n => n.route === r).length;

  const species_counts = {} as Record<Species, number>;
  for (const sp of Object.keys(SPECIES_QUOTA) as Species[]) {
    species_counts[sp] = ffNpcs.filter(n => n.species === sp).length;
  }

  const sizeCounts: Record<FullFlowSize, number> = { Small: 0, Medium: 0, Large: 0 };
  for (const n of ffNpcs) {
    if (n.size === 'Small' || n.size === 'Medium' || n.size === 'Large') sizeCounts[n.size]++;
  }

  const per_route: PerRouteMetric[] = (Object.keys(ROUTE_COUNTS) as AllRouteId[]).map(r => ({
    route: r, trips: 0, arrivals: 0, max_wait: 0, blocked_events: 0,
  }));

  return {
    npc_count: ffNpcs.length,
    route_counts,
    species_counts,
    size_counts: sizeCounts,
    warmup_seconds: 30,
    measurement_seconds: 300,
    completed_routes: 0,
    waypoint_arrivals: 0,
    per_route,
    blocked_time_total: 0,
    max_continuous_blocked_time: 0,
    blocked_npc_count_end: 0,
    blocked_npc_count_peak: 0,
    severe_block_count: 0,
    deadlock_count: 0,
    ever_20sec_block_count: 0,
    unrecovered_20sec: 0,
    recoveries: 0,
    fixed_collision_violation: 0,
    npc_collision_violation: 0,
    world_bounds_violation: 0,
    collision_violation_total: 0,
    cafe_enter_count: 0,
    cafe_exit_count: 0,
    facility_enter_count: 0,
    facility_exit_count: 0,
    upper_narrow_pass_count: 0,
    lower_narrow_pass_count: 0,
    upper_narrow_max_queue: 0,
    lower_narrow_max_queue: 0,
    w12_max_queue: 0,
    w12_owner_change_count: 0,
    w12_queue_recovery_count: 0,
  };
}

// ---------------------------------------------------------------------------
// Warm-up reset (§10.3)
// ---------------------------------------------------------------------------

/**
 * Reset only measurement counters at t=30.
 * All movement/traffic state is preserved.
 */
export function resetFullFlowMeasurement(state: FullFlowState): void {
  const ffNpcs = state.run.npcs as FullFlowNpc[];
  state.metrics = makeEmptyMetrics(ffNpcs);
  state.measurementElapsed = 0;
  state.queueWaits = {};
  state.queueMaxWaits = {};
  state._lastW12Owner = state.run.merge?.owner;
  state._lastW12QueueEmpty = (state.run.merge?.queue.length ?? 0) === 0;
  state.metrics.w12_max_queue = state.run.merge?.queue.length ?? 0;
  state.metrics.upper_narrow_max_queue = state.run.locks?.['Upper Narrow Path']?.queue.length ?? 0;
  state.metrics.lower_narrow_max_queue = state.run.locks?.['Lower Narrow Path']?.queue.length ?? 0;
  for (const n of ffNpcs) {
    // Reset measurement-phase counters only
    n.mTrips = 0;
    n.mArrivals = 0;
    // An active block at t=30 starts one measurement episode, even before
    // the first measurement step. Never count it again while it persists.
    n.measurementBlocked = !!n.blockedBy;
    n.mBlockedEvents = Number(n.measurementBlocked);
    n.mLongestWait = 0;
    n.mWait = 0;
    n.mRecoveries = 0;
    n.mEnters = 0;
    n.mExits = 0;
    n.severeReported = false;
    n.deadlockReported = false;
    // Reset current-block wait for measurement (§10.3)
    // blockedBy is preserved for movement permission logic
    // wait is used as current block duration; reset for clean measurement window
    // BUT we must check if blockedBy is used for movement permission
    // In stepSmoke, blockedBy is only for stats (not movement gate) so safe to reset
    n.wait = 0;
    // longestWait is a lifetime stat; use mLongestWait for measurement
  }
}

// ---------------------------------------------------------------------------
// stepFullFlow: single step with phase management and metric collection
// ---------------------------------------------------------------------------

const WARMUP_END = 30;
const MEASURE_END = 330;

/** Snapshot each actual substep, after any warm-up reset. */
export function snapshotFullFlow(state: FullFlowState): SmokeNpc[] {
  return state.run.npcs.map(n => ({ ...n }));
}

// Opposite physical rectangle sides: left/right = -1/+1, top/bottom = -2/+2.
function outsideSide(body: Bounds, zone: Bounds): number | undefined {
  if (body.x + body.width <= zone.x) return -1;
  if (body.x >= zone.x + zone.width) return 1;
  if (body.y + body.height <= zone.y) return -2;
  if (body.y >= zone.y + zone.height) return 2;
}

/** Observer only; never changes Fix4 movement/traffic state.
 * Narrow entry sides are observed during warm-up too. Initial inside spawns
 * have unknown entry sides and do not count on their first exit. Known warm-up
 * entries count only when their opposite-side completion is measured.
 */
export function collectFullFlowMetrics(
  state: FullFlowState, map: GrayboxMap, dt: number, beforeStep: SmokeNpc[],
): void {
  const ffNpcs = state.run.npcs as FullFlowNpc[];
  const solids = mapObjects(map, 'Collision');
  const world = mapWorld(map);
  const navNodes = mapObjects(map, 'Navigation');
  for (const which of ['Upper', 'Lower'] as const) {
    const zone = navNodes.find(o => o.name === which + ' Narrow Path');
    if (!zone) continue;
    for (const [i, n] of ffNpcs.entries()) {
      const before = beforeStep[i];
      const priorBody = footprint(before.x, before.y, SMOKE_SIZES[n.size]);
      const body = footprint(n.x, n.y, SMOKE_SIZES[n.size]);
      const wasInside = !before.inside && overlaps(priorBody, zone);
      const nowInside = !n.inside && overlaps(body, zone);
      const entries = n.narrowEntry ??= {};
      if (!wasInside && nowInside) entries[which] = outsideSide(priorBody, zone);
      if (wasInside && !nowInside) {
        const entry = entries[which];
        const exit = n.inside ? undefined : outsideSide(body, zone);
        if (state.phase === 'MEASUREMENT' && entry !== undefined && exit === -entry) {
          if (which === 'Upper') state.metrics.upper_narrow_pass_count++;
          else state.metrics.lower_narrow_pass_count++;
        }
        delete entries[which];
      }
      if (which === 'Upper') n.inUpperNarrow = nowInside;
      else n.inLowerNarrow = nowInside;
    }
  }
  if (state.phase !== 'MEASUREMENT') return;
  const queues = {
    upper: state.run.locks?.['Upper Narrow Path']?.queue ?? [],
    lower: state.run.locks?.['Lower Narrow Path']?.queue ?? [],
    w12: state.run.merge?.queue ?? [],
  };
  for (const [name, ids] of Object.entries(queues)) {
    const waits = (state.queueWaits ??= {})[name] ??= {};
    for (const id of Object.keys(waits)) if (!ids.includes(Number(id))) delete waits[Number(id)];
    for (const id of ids) waits[id] = (waits[id] ?? 0) + dt;
    (state.queueMaxWaits ??= {})[name] = Math.max(state.queueMaxWaits[name] ?? 0, ...Object.values(waits));
  }
    // --- Collision measurement (§12) ---
    let fixedViol = 0, npcViol = 0, worldViol = 0;
    for (const n of ffNpcs) {
      if (n.inside) continue;
      const body = footprint(n.x, n.y, SMOKE_SIZES[n.size]);
      if (solids.some(o => overlaps(body, o))) fixedViol++;
      if (body.x < 0 || body.y < 0 || body.x + body.width > world.width || body.y + body.height > world.height) worldViol++;
    }
    for (let i = 0; i < ffNpcs.length; i++) {
      if (ffNpcs[i].inside) continue;
      for (let j = i + 1; j < ffNpcs.length; j++) {
        if (ffNpcs[j].inside) continue;
        if (overlaps(footprint(ffNpcs[i].x, ffNpcs[i].y, SMOKE_SIZES[ffNpcs[i].size]),
                     footprint(ffNpcs[j].x, ffNpcs[j].y, SMOKE_SIZES[ffNpcs[j].size]))) npcViol++;
      }
    }
    state.metrics.fixed_collision_violation += fixedViol;
    state.metrics.npc_collision_violation += npcViol;
    state.metrics.world_bounds_violation += worldViol;
    state.metrics.collision_violation_total += fixedViol + npcViol + worldViol;

    // --- Block metrics (§11) ---
    let blockedCount = 0;
    for (const n of ffNpcs) {
      const blocked = !!n.blockedBy && !n.inside;
      if (blocked && !n.measurementBlocked) n.mBlockedEvents++;
      n.measurementBlocked = blocked;
      if (blocked) {
        state.metrics.blocked_time_total += dt;
        n.mWait += dt;
        n.mLongestWait = Math.max(n.mLongestWait, n.mWait);
        if (n.mWait >= 0.5) blockedCount++;

        // Severe block: first frame crossing 10s
        if (!n.severeReported && n.mWait >= 10) {
          n.severeReported = true;
          state.metrics.severe_block_count++;
        }
        // Deadlock: first frame crossing 20s
        if (!n.deadlockReported && n.mWait >= 20) {
          n.deadlockReported = true;
          state.metrics.deadlock_count++;
          state.metrics.ever_20sec_block_count++;
        }
      } else {
        if (n.mWait >= 0.5) {
          n.mRecoveries++;
          state.metrics.recoveries++;
        }
        n.mWait = 0;
        // Reset episode flags so next block episode is fresh
        n.severeReported = false;
        n.deadlockReported = false;
      }
    }
    state.metrics.blocked_npc_count_peak = Math.max(state.metrics.blocked_npc_count_peak, blockedCount);
    state.metrics.max_continuous_blocked_time = Math.max(
      state.metrics.max_continuous_blocked_time,
      ...ffNpcs.map(n => n.mLongestWait),
    );

    // --- Trips & arrivals (§11) ---
    for (let i = 0; i < ffNpcs.length; i++) {
      const n = ffNpcs[i];
      const before = beforeStep[i];
      // Detect new trips
      if (n.trips > before.trips) n.mTrips += n.trips - before.trips;
      if (n.arrivals > before.arrivals) n.mArrivals += n.arrivals - before.arrivals;
    }


    // Actual door state/physical threshold, never route-based attribution.
    for (const [i, n] of ffNpcs.entries()) {
      const before = beforeStep[i];
      const enters = (n.enters ?? 0) - (before.enters ?? 0);
      const exits = (n.exits ?? 0) - (before.exits ?? 0);
      if (enters > 0) {
        if (before.doorTarget === 'W17') state.metrics.cafe_enter_count += enters;
        else if (before.doorTarget === 'W19') state.metrics.facility_enter_count += enters;
        else throw new Error('Unattributed door entry: NPC ' + n.id);
        n.mEnters += enters;
      }
      if (exits > 0) {
        // Fix4 exits at the same threshold, including boundary-spanning stays.
        const door = enterDoor(map, before.x, before.y, SMOKE_SIZES[n.size]);
        if (door === 'Cafe') state.metrics.cafe_exit_count += exits;
        else if (door === 'Facility') state.metrics.facility_exit_count += exits;
        else throw new Error('Unattributed door exit: NPC ' + n.id);
        n.mExits += exits;
      }
    }
    state.metrics.upper_narrow_max_queue = Math.max(state.metrics.upper_narrow_max_queue,
      state.run.locks?.['Upper Narrow Path']?.queue.length ?? 0);
    state.metrics.lower_narrow_max_queue = Math.max(state.metrics.lower_narrow_max_queue,
      state.run.locks?.['Lower Narrow Path']?.queue.length ?? 0);
    // --- W12 metrics (§11) ---
    const merge = state.run.merge ?? { queue: [] };
    const currentOwner = merge.owner;
    const currentQueueLen = merge.queue.length;
    state.metrics.w12_max_queue = Math.max(state.metrics.w12_max_queue, currentQueueLen);

    if (currentOwner !== state._lastW12Owner && currentOwner !== undefined) {
      state.metrics.w12_owner_change_count++;
    }
    const wasEmpty = state._lastW12QueueEmpty;
    const isNowEmpty = currentQueueLen === 0;
    if (!wasEmpty && isNowEmpty) state.metrics.w12_queue_recovery_count++;
    state._lastW12Owner = currentOwner;
    state._lastW12QueueEmpty = isNowEmpty;

  _finalizeMetrics(state, ffNpcs);
}

export function stepFullFlow(
  state: FullFlowState, map: GrayboxMap, seconds: number, external: Bounds[] = [],
): void {
  if (state.phase === 'COMPLETE' || state.run.paused) return;
  let remaining = Math.max(0, Math.min(seconds, 0.05));
  while (remaining > 1e-10 && state.phase !== 'COMPLETE') {
    const boundary = state.phase === 'WARMUP' ? WARMUP_END : MEASURE_END;
    const dt = Math.min(remaining, boundary - state.globalElapsed);
    const before = snapshotFullFlow(state);
    if (dt > 0) {
      stepSmoke(state.run, map, dt, external);
      collectFullFlowMetrics(state, map, dt, before);
      state.globalElapsed += dt;
      if (state.phase === 'MEASUREMENT') state.measurementElapsed += dt;
      remaining -= dt;
    }
    if (state.globalElapsed >= boundary - 1e-8) {
      state.globalElapsed = boundary;
      state.run.elapsed = boundary;
      if (state.phase === 'WARMUP') {
        resetFullFlowMeasurement(state);
        state.phase = 'MEASUREMENT';
      } else {
        state.measurementElapsed = MEASURE_END - WARMUP_END;
        state.phase = 'COMPLETE';
        _finalizeMetrics(state, state.run.npcs as FullFlowNpc[]);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Finalize metrics at COMPLETE
// ---------------------------------------------------------------------------

function _finalizeMetrics(state: FullFlowState, ffNpcs: FullFlowNpc[]): void {
  const m = state.metrics;

  // End-state blocked count
  m.blocked_npc_count_end = ffNpcs.filter(n => !n.inside && n.mWait >= 0.5).length;
  m.unrecovered_20sec = ffNpcs.filter(n => !n.inside && n.mWait >= 20).length;

  // Aggregate per-route
  for (const pr of m.per_route) {
    const ns = ffNpcs.filter(n => n.route === pr.route);
    pr.trips = ns.reduce((s, n) => s + n.mTrips, 0);
    pr.arrivals = ns.reduce((s, n) => s + n.mArrivals, 0);
    pr.max_wait = Math.max(0, ...ns.map(n => n.mLongestWait));
    pr.blocked_events = ns.reduce((s, n) => s + n.mBlockedEvents, 0);
  }

  m.completed_routes = m.per_route.reduce((s, r) => s + r.trips, 0);
  m.waypoint_arrivals = m.per_route.reduce((s, r) => s + r.arrivals, 0);

  m.recoveries = ffNpcs.reduce((s, n) => s + n.mRecoveries, 0);
}

// ---------------------------------------------------------------------------
// Export summary (for script output)
// ---------------------------------------------------------------------------

export function fullFlowSummary(state: FullFlowState): Record<string, unknown> {
  const m = state.metrics;
  const ffNpcs = state.run.npcs as FullFlowNpc[];

  // Finalize metrics (safe to call multiple times — just re-aggregates from mTrips/mArrivals)
  _finalizeMetrics(state, ffNpcs);

  const per_route: Record<string, unknown> = {};
  for (const pr of m.per_route) {
    per_route[pr.route] = { trips: pr.trips, arrivals: pr.arrivals, max_wait: Number(pr.max_wait.toFixed(3)), blocked_events: pr.blocked_events };
  }

  return {
    npc_count: m.npc_count,
    ...state.initialAreas,
    route_counts: m.route_counts,
    species_counts: m.species_counts,
    size_counts: m.size_counts,

    warmup_seconds: m.warmup_seconds,
    measurement_seconds: Number(state.measurementElapsed.toFixed(3)),

    completed_routes: m.completed_routes,
    waypoint_arrivals: m.waypoint_arrivals,
    per_route,

    blocked_time_total: Number(m.blocked_time_total.toFixed(3)),
    max_continuous_blocked_time: Number(m.max_continuous_blocked_time.toFixed(3)),
    blocked_npc_count_end: m.blocked_npc_count_end,
    blocked_npc_count_peak: m.blocked_npc_count_peak,

    severe_block_count: m.severe_block_count,
    deadlock_count: m.deadlock_count,
    ever_20sec_block_count: m.ever_20sec_block_count,
    unrecovered_20sec: m.unrecovered_20sec,

    recoveries: m.recoveries,

    fixed_collision_violation: m.fixed_collision_violation,
    npc_collision_violation: m.npc_collision_violation,
    world_bounds_violation: m.world_bounds_violation,
    collision_violation_total: m.collision_violation_total,

    cafe_enter_count: m.cafe_enter_count,
    cafe_exit_count: m.cafe_exit_count,
    facility_enter_count: m.facility_enter_count,
    facility_exit_count: m.facility_exit_count,

    upper_narrow_pass_count: m.upper_narrow_pass_count,
    lower_narrow_pass_count: m.lower_narrow_pass_count,
    upper_narrow_max_queue: m.upper_narrow_max_queue,
    lower_narrow_max_queue: m.lower_narrow_max_queue,

    w12_max_queue: m.w12_max_queue,
    w12_owner_change_count: m.w12_owner_change_count,
    w12_queue_recovery_count: m.w12_queue_recovery_count,

    phase: state.phase,
    global_elapsed: state.globalElapsed,
    queue_status: Object.fromEntries(['upper', 'lower', 'w12'].map(name => [name, {
      end: Object.keys(state.queueWaits?.[name] ?? {}).length,
      max_wait: Number((state.queueMaxWaits?.[name] ?? 0).toFixed(3)),
      unrecovered_20sec: Object.values(state.queueWaits?.[name] ?? {}).filter(t => t >= 20).length,
    }])),
    note_blocked_time_total: 'raw actor-seconds with blockedBy != empty (measurement phase)',
  };
}
