import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cardResult, quizResult } from '../src/modules/ai-basics/challenge.ts';

test('quiz wrong answers spend one shared heart and zero stops the challenge', () => {
  assert.deepEqual(quizResult(3, true), { hearts: 3, failed: false });
  assert.deepEqual(quizResult(3, false), { hearts: 2, failed: false });
  assert.deepEqual(quizResult(2, false), { hearts: 1, failed: false });
  assert.deepEqual(quizResult(1, false), { hearts: 0, failed: true });
});

test('card attempts preserve quiz hearts, ignore incomplete choices, and spend on wrong triples', () => {
  assert.deepEqual(cardResult(2, ['ai-pattern', 'ai-judge']), { hearts: 2, outcome: 'incomplete' });
  assert.deepEqual(cardResult(2, ['ai-pattern', 'ai-judge', 'not-ai']), { hearts: 1, outcome: 'retry' });
  assert.deepEqual(cardResult(1, ['ai-pattern', 'ai-judge', 'not-ai']), { hearts: 0, outcome: 'failed' });
  assert.deepEqual(cardResult(1, ['ai-learn-data', 'ai-pattern', 'ai-judge']), { hearts: 1, outcome: 'correct' });
});
