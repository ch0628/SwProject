import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { REWARD_STAR_TOTAL } from '../src/modules/reinforcement/sim/learningEngine.ts';
import { ACTIONS } from '../src/modules/reinforcement/sim/learningEngine.ts';
import { OBSERVATION_ROUNDS } from '../src/modules/reinforcement/runtime/runtimeController.ts';
import {
  REWARD_LABELS,
  importantActionMessage,
  trainingComparisonMessage,
} from '../src/modules/reinforcement/runtime/trainingLabels.ts';

const app = fs.readFileSync('src/modules/reinforcement/runtime/ReinforcementTrainingApp.tsx', 'utf8');
const labels = fs.readFileSync('src/modules/reinforcement/runtime/trainingLabels.ts', 'utf8');
const scene = fs.readFileSync('src/modules/reinforcement/runtime/ReinforcementRuntimeScene.ts', 'utf8');

test('A/B/J: final reward UI has exactly the canonical three categories and six-star budget', () => {
  assert.deepEqual(REWARD_LABELS, {
    speed: '빠르게 해결하기',
    judgment: '정확하게 판단하기',
    threat: '위협 제거하기',
  });
  assert.equal(REWARD_STAR_TOTAL, 6);
  assert.match(app, /사용한 별/);
  assert.match(app, /별 6개를 모두 나누어 주세요/);
  assert.doesNotMatch(app + labels, /시민 보호|시설 보호|별 8개/);
});

test('C/D/E: checkpoint and observation UI is explicit and hidden learning has no Phaser runtime', () => {
  assert.deepEqual(OBSERVATION_ROUNDS, [1, 5, 10, 15, 20]);
  assert.match(app, /observationIndex}\ubc88\uc9f8 \uad00\ucc30/);
  assert.match(app, /\uad00\ucc30 \$\{observationIndex\} \/ \$\{OBSERVATION_ROUNDS\.length\}/);
  const hidden = app.slice(app.indexOf("phase === 'HEADLESS_LEARNING'"), app.indexOf("phase === 'COMPLETE'"));
  assert.match(hidden, /다음 관찰:/);
  assert.doesNotMatch(hidden, /RuntimeView|Phaser/);
});

test('F/I: Boss action contract has no retreat and current action text never exposes raw enums', () => {
  assert.deepEqual(ACTIONS.BOSS_ENCOUNTER, ['SUBDUE']);
  const actions = [
    ['SUBDUE', 'VILLAIN_ENCOUNTER'], ['DISTRACT', 'VILLAIN_ENCOUNTER'], ['RETREAT', 'VILLAIN_ENCOUNTER'],
    ['OBSERVE', 'AMBIGUOUS_PERSON'], ['BYPASS', 'AMBIGUOUS_PERSON'], ['CLEAR', 'OBSTACLE'], ['PUSH', 'OBSTACLE'],
  ] as const;
  for (const [action, state] of actions) {
    const message = importantActionMessage({ type: 'ACTION', floor: 2, simulationTime: 0, zoneId: 'test', state, action });
    assert.doesNotMatch(message, /\b[A-Z][A-Z_]+\b/);
  }
  assert.doesNotMatch(app, /보스.{0,20}물러|보스.{0,20}다른 길/);
});

test('G/H: evaluation stays update-free and final comparison is truthful for all orderings', () => {
  const controller = fs.readFileSync('src/modules/reinforcement/runtime/runtimeController.ts', 'utf8');
  const evaluation = controller.slice(controller.indexOf('observeEvaluation('), controller.indexOf('restart('));
  assert.doesNotMatch(evaluation, /commitRound|nextRound|runActualMapTraining|committedUpdates/);

  const improved = trainingComparisonMessage(1, 4);
  const equal = trainingComparisonMessage(3, 3);
  const lower = trainingComparisonMessage(4, 2);
  assert.match(improved, /더 많아졌어/);
  assert.doesNotMatch(equal + lower, /더 많아졌어|더 좋아졌어|반드시 좋아/);
  assert.match(equal + lower, /행동 방식이 달라졌어/);
});

test('presentation polish is visual-only and covers encounter, impact, recovery, floor and finale cues', () => {
  assert.match(scene, /animateEncounterFocus\(command\)/);
  assert.match(scene, /280/);
  assert.match(scene, /animateImpact\(encounter\.position\)/);
  assert.match(scene, /repetitions > 1/);
  assert.match(scene, /animateWorkParticles/);
  assert.match(scene, /다시 일어나고 있어요/);
  assert.match(scene, /fadeOut[\s\S]*renderFloor[\s\S]*fadeIn/);
  assert.match(scene, /보스를 찾았어/);
  assert.match(scene, /제어실로 가는 길이 열렸어요/);
  assert.match(scene, /제어 시스템 복구 완료/);
  assert.doesNotMatch(scene, /simulationTime\s*[+\-*/]?=/);
});
