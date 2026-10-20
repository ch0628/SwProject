import assert from 'node:assert/strict';
import test from 'node:test';
import { actionBubbleTextureKey } from '../src/npcActionBubble.ts';

test('only active suspicious main behaviors receive an action bubble', () => {
  assert.equal(actionBubbleTextureKey('HOLDING', 'STEALING'), 'action-icon-stealing');
  assert.equal(actionBubbleTextureKey('HOLDING', 'SNATCHING'), 'action-icon-snatching');
  assert.equal(actionBubbleTextureKey('HOLDING', 'THREATENING'), 'action-icon-threatening');
  assert.equal(actionBubbleTextureKey('HOLDING', 'MANHOLE_TAMPER'), 'action-icon-manhole-tamper');
  assert.equal(actionBubbleTextureKey('HOLDING', 'LOOKING_AROUND'), null);
  assert.equal(actionBubbleTextureKey('MOVING_TO_TARGET', 'STEALING'), null);
  assert.equal(actionBubbleTextureKey('REJOINING', 'SNATCHING'), null);
});
