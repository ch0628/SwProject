import assert from 'node:assert/strict';
import test from 'node:test';
import { NPC_OUTLINE_COLORS, npcOutlineStyle } from '../src/npcOutline.ts';

const base = {
  round: 2 as const,
  monitoring: false,
  comparisonTarget: true,
  monitoringTarget: false,
  userLabel: null,
  aiLabel: null,
  verifiedLabel: null,
};

test('Round 1 outline follows the human label', () => {
  assert.equal(npcOutlineStyle({ ...base, round: 1, comparisonTarget: false }), null);
  assert.deepEqual(npcOutlineStyle({ ...base, round: 1, comparisonTarget: false, userLabel: 'CITIZEN' }), { color: NPC_OUTLINE_COLORS.citizen, pulse: false });
  assert.deepEqual(npcOutlineStyle({ ...base, round: 1, comparisonTarget: false, userLabel: 'VILLAIN' }), { color: NPC_OUTLINE_COLORS.villain, pulse: false });
});

test('Round 2 comparison distinguishes pending, agreement, and disagreement', () => {
  assert.deepEqual(npcOutlineStyle(base), { color: NPC_OUTLINE_COLORS.pending, pulse: false });
  assert.deepEqual(npcOutlineStyle({ ...base, userLabel: 'VILLAIN', aiLabel: 'VILLAIN' }), { color: NPC_OUTLINE_COLORS.villain, pulse: false });
  assert.deepEqual(npcOutlineStyle({ ...base, userLabel: 'CITIZEN', aiLabel: 'CITIZEN' }), { color: NPC_OUTLINE_COLORS.citizen, pulse: false });
  assert.deepEqual(npcOutlineStyle({ ...base, userLabel: 'CITIZEN', aiLabel: 'VILLAIN' }), { color: NPC_OUTLINE_COLORS.disagreement, pulse: false });
  assert.equal(npcOutlineStyle({ ...base, comparisonTarget: false }), null);
});

test('Round 2 monitoring pulses review targets and colors completed predictions', () => {
  assert.deepEqual(npcOutlineStyle({ ...base, monitoring: true, monitoringTarget: true, aiLabel: 'VILLAIN' }), { color: NPC_OUTLINE_COLORS.review, pulse: true });
  assert.deepEqual(npcOutlineStyle({ ...base, monitoring: true, monitoringTarget: true, aiLabel: 'VILLAIN', verifiedLabel: 'VILLAIN' }), { color: NPC_OUTLINE_COLORS.villain, pulse: false });
  assert.deepEqual(npcOutlineStyle({ ...base, monitoring: true, comparisonTarget: false, aiLabel: 'CITIZEN' }), { color: NPC_OUTLINE_COLORS.citizen, pulse: false });
});
