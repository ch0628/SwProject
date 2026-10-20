import assert from 'node:assert/strict';
import test from 'node:test';
import { actionBubblePlacement, actionBubbleTextureKey } from '../src/npcActionBubble.ts';

test('only active suspicious main behaviors receive an action bubble', () => {
  assert.equal(actionBubbleTextureKey('HOLDING', 'STEALING'), 'action-icon-stealing');
  assert.equal(actionBubbleTextureKey('HOLDING', 'SNATCHING'), 'action-icon-snatching');
  assert.equal(actionBubbleTextureKey('HOLDING', 'THREATENING'), 'action-icon-threatening');
  assert.equal(actionBubbleTextureKey('HOLDING', 'MANHOLE_TAMPER'), 'action-icon-manhole-tamper');
  assert.equal(actionBubbleTextureKey('HOLDING', 'LOOKING_AROUND'), null);
  assert.equal(actionBubbleTextureKey('MOVING_TO_TARGET', 'STEALING'), null);
  assert.equal(actionBubbleTextureKey('REJOINING', 'SNATCHING'), null);
});

test('bubble clears its nearby group and moves beside it at the top edge', () => {
  const actor = { x: 100, y: 120, width: 40, height: 70 };
  const neighbor = { x: 130, y: 110, width: 42, height: 80 };
  const view = { left: 0, right: 300, top: 0, bottom: 220 };

  assert.deepEqual(actionBubblePlacement(actor, [actor, neighbor], { ...view, top: -100 }, 96, 56), {
    x: 100,
    y: -6,
    rotation: 0,
  });

  assert.deepEqual(actionBubblePlacement(actor, [actor, neighbor], { ...view, top: 20 }, 96, 56), {
    x: 187,
    y: 85,
    rotation: Math.PI / 2,
  });

  assert.deepEqual(actionBubblePlacement({ ...actor, x: 500 }, [actor, neighbor], view, 96, 56), {
    x: 500,
    y: 14,
    rotation: 0,
  });
});
