import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { INTERACTION_RANGE, NOTES, nearbyNote } from '../src/modules/ai-basics/notes.ts';

test('six route cards are available only on their floor, in range, and before collection', () => {
  assert.equal(NOTES.length, 6);
  assert.deepEqual([0, 1, 2].map(floor => NOTES.filter(note => note.floor === floor).length), [2, 2, 2]);
  assert.equal(NOTES.filter(note => note.type === 'AI').length, 3);
  const collected = new Set<string>();
  for (const note of NOTES) {
    assert.equal(nearbyNote(note.x + INTERACTION_RANGE + 1, note.floor, collected), undefined);
    assert.notEqual(nearbyNote(note.x, (note.floor + 1) % 3, collected)?.id, note.id);
    assert.equal(nearbyNote(note.x, note.floor, collected)?.id, note.id);
    collected.add(note.id);
    assert.equal(nearbyNote(note.x, note.floor, collected), undefined);
  }
});
