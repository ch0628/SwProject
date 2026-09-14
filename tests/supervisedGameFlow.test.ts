import test from 'node:test';
import assert from 'node:assert';
import { 
  createGameFlow, canStartFirstTraining, startFirstTraining, completeFirstTraining,
  canStartRetraining, startRetraining, completeRetraining,
  canStartFinalScan, startFinalScan, completeFinalScan
} from '../src/supervisedGameFlow.ts';
import { applyRound2ToGroup, round2TrainingState, ROUND2_COMPARISON_PLAN, ROUND2_ROWS } from '../src/plazaRound2.ts';
import { createRound1Group, verifyRoundTrainingSample } from '../src/plazaRound1.ts';
import { DEFAULT_ROUND1_CONFIG } from '../src/plazaRound1.ts';

test('Supervised Game Flow state machine and Round 2 training states', async (t) => {
  await t.test('Initial state', () => {
    const flow = createGameFlow();
    assert.strictEqual(flow.phase, 'MANUAL_LABELING');
    assert.strictEqual(flow.round, 1);
  });

  await t.test('Retraining gate strict conditions', () => {
    const flow = createGameFlow();
    flow.phase = 'HUMAN_AI_COMPARE';
    
    // Create a mock round2 state that is NOT ready
    const notReady = { comparedCount: 7, verifiedCount: 8, aiWrongVerifiedCount: 3, retrainingReady: false };
    assert.strictEqual(canStartRetraining(flow, notReady), false, 'Should not start retraining if not ready');
    
    const ready = { comparedCount: 8, verifiedCount: 8, aiWrongVerifiedCount: 3, retrainingReady: true };
    assert.strictEqual(canStartRetraining(flow, ready), true, 'Should start retraining if strictly ready');
  });

  await t.test('AI Assisted Monitoring flow', () => {
    const flow = createGameFlow();
    flow.phase = 'AI_ASSISTED_MONITORING';
    
    assert.strictEqual(canStartFinalScan(flow, flow.aiMonitorVerifiedIds.length), false);
    flow.aiMonitorVerifiedIds = ['NPC01', 'NPC02', 'NPC03'];
    assert.strictEqual(canStartFinalScan(flow, flow.aiMonitorVerifiedIds.length), true);
    
    startFinalScan(flow);
    assert.strictEqual(flow.phase, 'FINAL_SCAN');
    
    completeFinalScan(flow);
    assert.strictEqual(flow.phase, 'COMPLETE');
    assert.strictEqual(flow.scanComplete, true);
  });

  await t.test('Round 2 Target Constraints', () => {
    // 1. 8 comparison targets must all be STATIC_HOLD
    const targets = ROUND2_COMPARISON_PLAN.map(p => p.characterId);
    for (const id of targets) {
      const row = ROUND2_ROWS.find(r => r.characterId === id);
      assert.ok(row, `Target ${id} must exist in ROUND2_ROWS`);
      assert.strictEqual(row.lifecycle, 'STATIC_HOLD', `Target ${id} must be STATIC_HOLD`);
    }

    // 2. Distribution must be exactly 10/10/10/5
    const lifecycleCount = ROUND2_ROWS.reduce((acc, row) => {
      acc[row.lifecycle] = (acc[row.lifecycle] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    assert.strictEqual(lifecycleCount['STATIC_HOLD'], 10);
    assert.strictEqual(lifecycleCount['ENTER_AND_STAY'], 10);
    assert.strictEqual(lifecycleCount['ENTER_HOLD_EXIT'], 10);
    assert.strictEqual(lifecycleCount['THROUGH_TRAFFIC'], 5);
  });
});
