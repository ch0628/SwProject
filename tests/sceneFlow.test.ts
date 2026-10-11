import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FLOW_STEPS,
  PRD_SCENE,
  createInitialFlowState,
  currentLine,
  isBlurry,
  isDialogueDone,
  transition,
  type FlowEvent,
  type FlowState,
  type FlowStep,
} from '../src/modules/unsupervised/sim/sceneFlow.ts';
import { nearestClusterToClue, partitionSignature, type FeatureKey } from '../src/modules/unsupervised/sim/clusteringEngine.ts';
import { DIALOGUE } from '../src/modules/unsupervised/data/dialogue.ts';
import { INCIDENT_CLUE } from '../src/modules/unsupervised/data/features.ts';

const CORRECT: readonly FeatureKey[] = ['food', 'activeTime'];

function finishDialogue(state: FlowState): FlowState {
  while (!isDialogueDone(state)) state = transition(state, { type: 'NEXT_LINE' });
  return state;
}

/** 대사를 모두 넘긴 뒤 이벤트를 적용한다. 이벤트가 무시되면 실패한다. */
function act(state: FlowState, event: FlowEvent): FlowState {
  const ready = finishDialogue(state);
  const next = transition(ready, event);
  assert.notEqual(next, ready, `${ready.step}에서 ${event.type}가 무시됨`);
  return next;
}

const suspectId = (state: FlowState) => nearestClusterToClue(state.clusterResult!, INCIDENT_CLUE)!.id;
const innocentId = (state: FlowState) => state.clusterResult!.clusters.find((cluster) => cluster.id !== suspectId(state))!.id;

function toClusterReview(features: readonly FeatureKey[], state = createInitialFlowState()): FlowState {
  if (state.step === 'INCIDENT') state = act(act(state, { type: 'PROCEED' }), { type: 'PROCEED' });
  state = act(state, { type: 'SELECT_FEATURES', features });
  state = act(state, { type: 'FIND_PATTERNS' });
  return act(state, { type: 'PROCEED' });
}

function playHappyPath() {
  const steps: FlowStep[] = [];
  let state = createInitialFlowState();
  const record = (next: FlowState) => { if (steps.at(-1) !== next.step) steps.push(next.step); state = next; };
  record(state);
  record(act(state, { type: 'PROCEED' }));
  record(act(state, { type: 'PROCEED' }));
  record(act(state, { type: 'SELECT_FEATURES', features: CORRECT }));
  record(act(state, { type: 'FIND_PATTERNS' }));
  record(act(state, { type: 'PROCEED' }));
  record(act(state, { type: 'INSPECT_CLUSTER', clusterId: state.clusterResult!.clusters[0].id }));
  record(act(state, { type: 'PROCEED' }));
  record(act(state, { type: 'SELECT_CLUSTER', clusterId: suspectId(state) }));
  record(act(state, { type: 'INVESTIGATE' }));
  record(act(state, { type: 'PROCEED' }));
  record(act(state, { type: 'PROCEED' }));
  return { state, steps };
}

test('정상 경로: Scene 1~8을 순서대로 지나 완료되고, 조사한 군집의 일부만 악당으로 공개된다', () => {
  const { state, steps } = playHappyPath();
  assert.deepEqual(steps, ['INCIDENT', 'EXPLAIN', 'FEATURE_SELECT', 'PATTERN_FIND', 'CLUSTER_REVIEW', 'CLUE_COMPARE', 'INVESTIGATE', 'COMPLETE']);
  assert.deepEqual(steps.map((step) => PRD_SCENE[step]), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(state.finished, true);
  assert.equal(state.featureAttempts, 1);
  assert.equal(isBlurry(state), false);
  assert.deepEqual(state.revealedVillainIds, ['R10', 'R11', 'R12']);
  const investigated = state.clusterResult!.clusters.find((cluster) => cluster.id === state.selectedClusterId)!;
  assert.ok(investigated.memberIds.includes('R09'), '시민 R09가 같은 군집에 있어야 함 (군집 일부만 악당)');
  assert.ok(!state.revealedVillainIds.includes('R09'));
});

for (const [kind, features] of [['PARTIAL', ['food', 'belongings']], ['NONE', ['belongings', 'footprint']]] as const) {
  test(`잘못된 조합(${kind}): 흐릿함 피드백 후 특징을 다시 골라 정상 진행한다`, () => {
    let state = toClusterReview(features);
    assert.equal(state.clueMatch, kind);
    assert.equal(isBlurry(state), true);
    state = act(state, { type: 'PROCEED' });
    assert.equal(state.step, 'FEATURE_FEEDBACK');
    assert.equal(currentLine(state).speaker, 'AI 보안관');
    state = act(state, { type: 'RESELECT_FEATURES' });
    assert.equal(state.step, 'FEATURE_SELECT');
    assert.equal(state.selectedFeatures, null);
    assert.equal(state.clusterResult, null);
    assert.equal(isBlurry(state), false);
    state = toClusterReview(CORRECT, state);
    assert.equal(state.featureAttempts, 2);
    assert.equal(act(state, { type: 'PROCEED' }).step, 'CLUE_COMPARE');
  });
}

test('틀린 군집: 평범한 주민으로 판명되고 페널티 없이 다시 골라 정답 군집으로 진행한다', () => {
  let state = act(toClusterReview(CORRECT), { type: 'PROCEED' });
  const wrong = innocentId(state);
  state = act(state, { type: 'SELECT_CLUSTER', clusterId: wrong });
  state = act(state, { type: 'INVESTIGATE' });
  assert.equal(state.step, 'ORDINARY_RESULT');
  assert.deepEqual(state.clearedClusterIds, [wrong]);
  assert.deepEqual(state.revealedVillainIds, []);
  state = act(state, { type: 'RESELECT_CLUSTER' });
  assert.equal(state.step, 'CLUE_COMPARE');
  assert.equal(state.selectedClusterId, null);
  // 이미 평범한 주민으로 판명된 군집은 다시 고를 수 없다.
  assert.equal(transition(state, { type: 'SELECT_CLUSTER', clusterId: wrong }), state);
  state = act(state, { type: 'SELECT_CLUSTER', clusterId: suspectId(state) });
  state = act(state, { type: 'INVESTIGATE' });
  assert.equal(state.step, 'INVESTIGATE');
  assert.equal(state.featureAttempts, 1);
  assert.deepEqual(state.revealedVillainIds, ['R10', 'R11', 'R12']);
});

test('허용되지 않은 이벤트는 무시된다 (같은 상태 객체를 돌려줌)', () => {
  const initial = createInitialFlowState();
  assert.equal(transition(initial, { type: 'PROCEED' }), initial, '대사 중 장면 버튼');
  const intro = finishDialogue(initial);
  assert.equal(transition(intro, { type: 'NEXT_LINE' }), intro, '마지막 대사 뒤 다음 대사');
  assert.equal(transition(intro, { type: 'SELECT_FEATURES', features: CORRECT }), intro, 'Scene 1에서 특징 선택');
  assert.equal(transition(intro, { type: 'INVESTIGATE' }), intro, 'Scene 1에서 조사');

  const select = finishDialogue(act(act(initial, { type: 'PROCEED' }), { type: 'PROCEED' }));
  for (const features of [[], ['food'], ['food', 'food'], ['food', 'activeTime', 'footprint'], ['food', 'height']]) {
    assert.equal(transition(select, { type: 'SELECT_FEATURES', features: features as FeatureKey[] }), select, JSON.stringify(features));
  }
  assert.equal(transition(select, { type: 'PROCEED' }), select, '특징 선택 없이 진행');

  const pattern = finishDialogue(act(select, { type: 'SELECT_FEATURES', features: CORRECT }));
  assert.equal(transition(pattern, { type: 'PROCEED' }), pattern, '패턴 찾기 전 진행');
  const found = act(pattern, { type: 'FIND_PATTERNS' });
  assert.equal(transition(found, { type: 'FIND_PATTERNS' }), found, '패턴 찾기 두 번');

  const review = finishDialogue(act(found, { type: 'PROCEED' }));
  assert.equal(transition(review, { type: 'INSPECT_CLUSTER', clusterId: 'C99' }), review, '없는 군집 클릭');
  assert.equal(transition(review, { type: 'RESELECT_FEATURES' }), review, '정답 조합에서 특징 재선택');

  const compare = finishDialogue(act(review, { type: 'PROCEED' }));
  assert.equal(transition(compare, { type: 'INVESTIGATE' }), compare, '군집 선택 없이 조사');
  assert.equal(transition(compare, { type: 'SELECT_CLUSTER', clusterId: 'C99' }), compare, '없는 군집 선택');
  assert.equal(transition(compare, { type: 'RESELECT_CLUSTER' }), compare, '판명 전 군집 재선택');

  const { state: done } = playHappyPath();
  for (const event of [{ type: 'PROCEED' }, { type: 'NEXT_LINE' }, { type: 'RESELECT_FEATURES' }] as const) {
    assert.equal(transition(done, event), done, `완료 후 ${event.type}`);
  }
});

test('결정성: 같은 이벤트 순서는 같은 결과, 특징 선택 순서를 바꿔도 같은 군집', () => {
  assert.deepEqual(playHappyPath(), playHappyPath());
  const a = toClusterReview(['food', 'activeTime']);
  const b = toClusterReview(['activeTime', 'food']);
  assert.equal(partitionSignature(a.clusterResult!), partitionSignature(b.clusterResult!));
  assert.equal(a.clueMatch, b.clueMatch);
});

test('대사 데이터: 모든 단계에 대사가 있고 승인된 수정 2건이 반영되어 있다', () => {
  for (const step of FLOW_STEPS) assert.ok(DIALOGUE[step].length > 0, step);
  const allText = FLOW_STEPS.flatMap((step) => DIALOGUE[step].map((line) => line.text)).join('\n');
  assert.ok(DIALOGUE.PATTERN_FIND[0].text.includes('[패턴 찾기]'));
  assert.ok(!allText.includes('[분류 시작]'));
  assert.ok(DIALOGUE.INVESTIGATE[0].text.includes('수상한 무리를 찾았어요! 이 중에 범인이 있을 거예요'));
  assert.ok(!allText.includes('악당 무리'));
  assert.deepEqual(DIALOGUE.INCIDENT[1].highlights, ['고기를 먹은 흔적', '밤늦게 움직이는 모습']);
  for (const step of ['FEATURE_FEEDBACK', 'ORDINARY_RESULT', 'INVESTIGATE'] as const) {
    assert.ok(DIALOGUE[step].every((line) => line.speaker === 'AI 보안관'), step);
  }
});
