/**
 * Plaza/Park 35 NPC Full Flow Measurement Script
 *
 * Runs deterministic simulation (no real wall-clock 330s):
 *   Warm-up:     30 sec  @ 1/60 step
 *   Measurement: 300 sec @ 1/60 step
 *   Total:       330 sec = 19800 ticks
 *
 * Node semantics are identical to the Browser: same Full Flow Harness,
 * same stepSmoke() Fix4 movement core. No separate movement simulator.
 *
 * Outputs JSON to stdout.
 * Always writes the identical full result to artifacts/plaza_full_flow_35_raw.json.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createPlazaFullFlow35, stepFullFlow, fullFlowSummary } from '../src/plazaFullFlow.ts';
import assert from 'node:assert/strict';

const RAW_OUTPUT = 'artifacts/plaza_full_flow_35_raw.json';
const DT = 1 / 60;
const TOTAL_SECONDS = 330;
const TOTAL_TICKS = Math.ceil(TOTAL_SECONDS / DT); // 19800

function writeResult(result) {
  const output = JSON.stringify(result, null, 2) + '\n';
  mkdirSync('artifacts', { recursive: true });
  writeFileSync(RAW_OUTPUT, output);
  assert.equal(readFileSync(RAW_OUTPUT, 'utf8'), output);
  process.stdout.write(output);
  process.stderr.write('  Raw output overwritten and verified: ' + RAW_OUTPUT + '\n');
}

const map = JSON.parse(readFileSync('public/maps/plaza-park.tmj', 'utf8'));

process.stderr.write(`[measure-plaza-full-flow-35] Starting 35 NPC Full Flow simulation...\n`);
process.stderr.write(`  Ticks: ${TOTAL_TICKS} × ${DT.toFixed(4)}s = ${TOTAL_SECONDS}s\n`);

const startedAt = new Date().toISOString();
let state;
try {
  state = createPlazaFullFlow35(map);
} catch (error) {
  // A rejected spawn is not a movement measurement. Replace stale raw results
  // with the current failure, then stop without a fallback or geometry change.
  writeResult({ run_started_at: startedAt, harness_valid: false, phase: 'SPAWN_FAILED',
    verdict: 'FAIL', logic_verdict: 'NOT MEASURED', browser_fps: 'NOT MEASURED',
    error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
}
process.stderr.write(`  Creator self-check PASSED. NPC count: ${state.run.npcs.length}\n`);

let tick = 0;
const reportInterval = Math.floor(TOTAL_TICKS / 10);

for (tick = 0; tick < TOTAL_TICKS; tick++) {
  stepFullFlow(state, map, DT);
  if (state.phase === 'COMPLETE') break;
  if (tick > 0 && tick % reportInterval === 0) {
    const pct = ((tick / TOTAL_TICKS) * 100).toFixed(0);
    process.stderr.write(`  [${pct}%] tick=${tick} phase=${state.phase} t=${state.globalElapsed.toFixed(1)}s\n`);
  }
}

process.stderr.write(`  Simulation done. Final tick: ${tick}, phase: ${state.phase}\n`);
process.stderr.write(`  globalElapsed: ${state.globalElapsed.toFixed(3)}s, measurementElapsed: ${state.measurementElapsed.toFixed(3)}s\n`);

const summary = fullFlowSummary(state);

// PASS/FAIL evaluation
const PASS_GATES = {
  npc_count: summary.npc_count === 35,
  actual_spatial_area_counts: Object.entries({ Park: 11, CentralPlaza: 10, Cafe: 3, PublicFacility: 3, MainRoute: 5, EntryExit: 3 })
    .every(([area, expected]) => summary.actual_spatial_area_counts[area] === expected),
  measurement_complete: state.phase === 'COMPLETE' && state.measurementElapsed === 300,
  cafe_repeated_transitions: summary.cafe_enter_count > 1 && summary.cafe_exit_count > 1,
  facility_repeated_transitions: summary.facility_enter_count > 1 && summary.facility_exit_count > 1,
  queues_recovered: Object.values(summary.queue_status).every(q => q.unrecovered_20sec === 0),
  all_routes_have_trips: (() => {
    const pr = summary.per_route;
    return Object.values(pr).every(r => r.trips > 0);
  })(),
  collision_violation_total_zero: summary.collision_violation_total === 0,
  deadlock_count_zero: summary.deadlock_count === 0,
  ever_20sec_block_count_zero: summary.ever_20sec_block_count === 0,
  unrecovered_20sec_zero: summary.unrecovered_20sec === 0,
};

const allPass = Object.values(PASS_GATES).every(Boolean);
const verdict = allPass ? (summary.max_continuous_blocked_time >= 3 || summary.upper_narrow_max_queue > 0 || summary.lower_narrow_max_queue > 0 || summary.w12_max_queue > 0 ? 'PASS with WARN' : 'PASS') : 'FAIL';

const fullResult = {
  ...summary,
  harness_valid: true,
  run_started_at: startedAt,
  browser_fps: 'NOT MEASURED',
  verdict,
  pass_gates: PASS_GATES,
};

// Serialize once: canonical raw artifact and stdout are the identical run.
writeResult(fullResult);

process.stderr.write(`\n[measure-plaza-full-flow-35] Result: ${verdict}\n`);
if (!allPass) {
  for (const [gate, passed] of Object.entries(PASS_GATES)) {
    if (!passed) process.stderr.write(`  FAIL gate: ${gate}\n`);
  }
}
