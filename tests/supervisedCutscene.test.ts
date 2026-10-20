import assert from 'node:assert/strict';
import test from 'node:test';
import type { SemanticBehavior } from '../src/characterPool.ts';
import { ROUND1_SCENARIO } from '../src/plazaRound1.ts';
import { ROUND2_ROWS } from '../src/plazaRound2.ts';
import { resolveSupervisedCutscene, type SupervisedCutsceneRequest } from '../src/supervisedCutscene.ts';

const CUTSCENE_BEHAVIORS = new Set<SemanticBehavior>(['STEALING', 'SNATCHING', 'THREATENING', 'MANHOLE_TAMPER']);

test('every suspicious Round 1 and Round 2 event has a cutscene asset', () => {
  const requests: SupervisedCutsceneRequest[] = [];
  for (const assignment of [...ROUND1_SCENARIO.assignments, ...ROUND2_ROWS]) {
    if (CUTSCENE_BEHAVIORS.has(assignment.mainBehavior)) {
      requests.push({ npcId: assignment.characterId, behavior: assignment.mainBehavior, moment: 'CURRENT' });
    }
    if (assignment.historyBehavior && CUTSCENE_BEHAVIORS.has(assignment.historyBehavior)) {
      requests.push({ npcId: assignment.characterId, behavior: assignment.historyBehavior, moment: 'HISTORY' });
    }
  }

  for (const request of requests) {
    const cutscene = resolveSupervisedCutscene(request);
    assert.ok(cutscene, `${request.npcId} ${request.moment} ${request.behavior}`);
    assert.match(cutscene.imageUrl, /_cut\.png$/);
  }
});

test('normal behavior records do not open an unrelated cutscene', () => {
  assert.equal(resolveSupervisedCutscene({ npcId: 'NPC01', behavior: 'LOOKING_AROUND', moment: 'CURRENT' }), null);
});
