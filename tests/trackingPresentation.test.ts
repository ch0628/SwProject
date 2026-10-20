import assert from 'node:assert/strict';
import test from 'node:test';
import type { BehaviorHistoryEntry } from '../src/characterPool.ts';
import { trackingEntryKind, trackingPeriod } from '../src/trackingPresentation.ts';

const entry = (simulationTime: number, semantic: BehaviorHistoryEntry['behavior']['semantic'], location?: string): BehaviorHistoryEntry => ({
  simulationTime,
  zone: 'PLAZA',
  behavior: { primitive: semantic === 'STEALING' ? 'SUSPICIOUS_ACTION' : 'INTERACT', semantic },
  ...(location ? { location } : {}),
});

test('tracking records use user-facing periods instead of raw simulation time', () => {
  assert.equal(trackingPeriod(entry(-1, 'STEALING', 'OFFSCREEN')), 'PAST');
  assert.equal(trackingPeriod(entry(.01, 'CARRYING_TOOLS', 'A_STATIC_01')), 'ROUND');
});

test('tracking badges distinguish past incidents, suspicious actions, and routine behavior', () => {
  assert.equal(trackingEntryKind(entry(-1, 'SNATCHING', 'OFFSCREEN')), 'PAST_INCIDENT');
  assert.equal(trackingEntryKind(entry(-1, 'RUNNING', 'OFFSCREEN')), 'PAST_RECORD');
  assert.equal(trackingEntryKind(entry(4, 'THREATENING')), 'SUSPICIOUS');
  assert.equal(trackingEntryKind(entry(0, 'CARRYING_TOOLS')), 'ROUTINE');
});
