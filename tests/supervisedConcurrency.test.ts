import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SUPERVISED_CONCURRENCY_LEVELS, runSupervisedConcurrencyValidation } from '../src/plazaConcurrencyValidation.ts';
import type { GrayboxMap } from '../src/plazaPark.ts';

const map: GrayboxMap = JSON.parse(readFileSync(new URL('../public/maps/plaza-park-v2.tmj', import.meta.url), 'utf8'));

test('Navigation v2 supervised concurrency records deterministic 120s results for 5/8/10/12/15', () => {
  for (const level of SUPERVISED_CONCURRENCY_LEVELS) {
    const result = runSupervisedConcurrencyValidation(map, level);
    assert.equal(result.activeCount, level);
    assert.equal(result.spawnedCount, level);
    assert.equal(new Set(result.selectedCharacters).size, level);
    assert.equal(result.pathfindingFailureCount, 0);
    assert.equal(result.invalidDestinationCount, 0);
    assert.equal(result.runtimeExceptionCount, 0);
    assert.equal(result.behaviorHistoryConsistency, true);
    assert.equal(result.npcOverlapViolationCount, 0);
    assert.equal(result.fixedCollisionViolationCount, 0);
    assert.equal(result.roadHoldViolationCount, 0);
    assert.equal(result.duplicateStopReservationCount, 0);
    assert.equal(result.stopOccupancyConflictCount, 0);
    assert.equal(result.connectorStallCount, 0);
    assert.equal(result.remainingStopReservationCount, 0);
    assert.equal(result.deferredBehaviorCompletedCount, result.deferredBehaviorCount);
    assert.equal(result.stalledNpcDiagnostics.length, result.uniqueStalledNpcCount);
    console.log(JSON.stringify({ test:'supervised_concurrency_120s', ...result }));
  }
});
