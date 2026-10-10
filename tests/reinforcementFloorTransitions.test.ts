import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('Floor 1-5 cross-floor transition contracts match the TMJ maps', () => {
  const output = execFileSync(process.execPath, ['scripts/reinforcement/validateFloorTransitions.mjs'], {
    encoding: 'utf8',
  });

  assert.match(output, /^PASS_CROSS_FLOOR_TRANSITIONS$/m);
});
