import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ACTUAL_GRAPH_FILE, ACTUAL_MAP_FILES, buildActualMapEnvironment } from '../src/modules/reinforcement/sim/actualMapEnvironment.ts';
import {
  FIXED_GOAL_REWARD_WEIGHT,
  REWARD_STAR_TO_WEIGHT,
  assertRewardStars,
  normalizeReward,
  rewardWeightsFromStars,
  type RewardStars,
} from '../src/modules/reinforcement/sim/learningEngine.ts';
import { OBSERVATION_ROUNDS, TrainingRuntimeController } from '../src/modules/reinforcement/runtime/runtimeController.ts';
import { failureReview, importantActionMessage, meaningfulEventMessage, rewardAdvice, terminalReasonSentence, trainingLabel } from '../src/modules/reinforcement/runtime/trainingLabels.ts';

const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const environment = buildActualMapEnvironment(ACTUAL_MAP_FILES.map(readJson), readJson(ACTUAL_GRAPH_FILE));
const weights: RewardStars = { speed: 2, judgment: 2, threat: 2 };

const finishRobot = (controller: TrainingRuntimeController, robotId: number) => {
  while (controller.advance(robotId));
};

test('training controller learns twenty rounds but presents only checkpoints 1/5/10/15/20', () => {
  const controller = new TrainingRuntimeController(environment, weights, 27);
  assert.equal(controller.roundIndex, 1);
  assert.equal(controller.actualRound, 1);
  assert.equal(controller.observationIndex, 1);
  assert.equal(controller.observationRound, 1);
  assert.equal(controller.robots.length, 5);
  assert.equal(new Set(controller.robots.map(robot => robot.episode.snapshotSignature)).size, 1);
  assert.ok(controller.robots.every(robot => robot.episode.snapshotSignature === JSON.stringify(controller.currentRound.snapshot)));
  assert.equal(new Set(controller.robots.map(robot => robot.commands)).size, 5);

  const robot3 = controller.robots[2];
  controller.advance(3);
  const progressBeforeSwitch = robot3.cursor;
  controller.selectMain(3);
  assert.equal(controller.mainRobot, 3);
  assert.equal(controller.robots[2], robot3);
  assert.equal(robot3.cursor, progressBeforeSwitch);
  controller.advance(2);
  assert.equal(controller.mainRobot, 3, 'events must not auto-select a different main Robot');

  finishRobot(controller, 1);
  assert.equal(controller.robots[0].terminal, true);
  assert.ok(controller.robots.slice(1).some(robot => !robot.terminal));
  assert.equal(controller.advance(1), undefined, 'terminal Robot must remain frozen');
  for (const robotId of [2, 3, 4]) finishRobot(controller, robotId);
  assert.equal(controller.robots.filter(robot => robot.terminal).length, 4);
  assert.equal(controller.policyUpdateCount, 0);
  finishRobot(controller, 5);
  assert.equal(controller.roundComplete, true);
  assert.equal(controller.policyUpdateCount, 1);
  assert.equal(controller.history.rounds.length, 1);
  assert.equal(controller.history.rounds[0].robotResults.length, 5);
  assert.deepEqual(controller.hiddenRoundsBeforeNextObservation, [
    { round: 2, robotCount: 5 }, { round: 3, robotCount: 5 }, { round: 4, robotCount: 5 },
  ]);
  controller.observeCommand(5, controller.robots[4].commands.at(-1)!);
  assert.equal(controller.policyUpdateCount, 1, 'duplicate terminal observation must not update twice');

  const firstRoundRobots = controller.robots;
  assert.equal(controller.nextRound(), true);
  assert.equal(controller.roundIndex, 2);
  assert.equal(controller.actualRound, 5);
  assert.deepEqual(controller.hiddenRoundsBeforeNextObservation.map(round => round.round), [6, 7, 8, 9]);
  assert.equal(controller.mainRobot, 1);
  assert.ok(controller.robots.every((robot, index) => robot !== firstRoundRobots[index] && robot.cursor === 0 && robot.floor === 1 && !robot.terminal));

  for (let observation = 2; observation <= OBSERVATION_ROUNDS.length; observation++) {
    const actualRound = OBSERVATION_ROUNDS[observation - 1];
    assert.equal(controller.observationIndex, observation);
    assert.equal(controller.actualRound, actualRound);
    assert.equal(controller.observationRound, actualRound);
    for (let robot = 1; robot <= 5; robot++) finishRobot(controller, robot);
    assert.equal(controller.policyUpdateCount, actualRound);
    assert.equal(controller.combatSkillUpdateCount, actualRound);
    assert.equal(controller.history.rounds.length, actualRound);
    if (observation < OBSERVATION_ROUNDS.length) assert.equal(controller.nextRound(), true);
  }
  assert.equal(controller.trainingComplete, true);
  assert.equal(controller.nextRound(), false, 'Round 21 must never be created');
  assert.equal(controller.roundIndex, 5);
  assert.equal(controller.actualRound, 20);
  assert.equal(controller.history.rounds.length, 20);
  assert.ok(controller.history.rounds.every(round => round.robotResults.length === 5));
  assert.equal(controller.history.rounds.flatMap(round => round.robotResults).length, 100);
  assert.deepEqual(controller.history.selectedRewardStars, weights);
  assert.deepEqual(controller.history.resolvedRewardWeights, {
    goal: 3, speed: 2.5, judgment: 2.5, threat: 2.5,
  });

  const evaluation = controller.createEvaluation(9_001);
  assert.equal(evaluation.episode.snapshotSignature, JSON.stringify(controller.history.rounds.at(-1)!.policySnapshotAfter));
  assert.equal(evaluation.commands.filter(command => command.type === 'TERMINAL').length, 1);
  for (const command of evaluation.commands) controller.observeEvaluation(evaluation, command);
  assert.equal(evaluation.terminal, true);
  assert.equal(controller.policyUpdateCount, 20, 'evaluation must not perform another policy update');

  const restartedWeights: RewardStars = { speed: 1, judgment: 2, threat: 3 };
  controller.restart(restartedWeights);
  assert.equal(controller.roundIndex, 1);
  assert.equal(controller.mainRobot, 1);
  assert.equal(controller.history.rounds.length, 0);
  assert.equal(controller.policyUpdateCount, 0);
  assert.ok(controller.robots.every(robot => robot.cursor === 0 && !robot.terminal));
  assert.deepEqual(controller.history.selectedRewardStars, restartedWeights);
});

test('reward v3 fixes goal reward and validates the exact three-field six-star contract', () => {
  assert.equal(FIXED_GOAL_REWARD_WEIGHT, 3);
  assert.deepEqual(REWARD_STAR_TO_WEIGHT, [0, 1, 2.5, 5]);
  const stars: RewardStars = { speed: 0, judgment: 3, threat: 3 };
  assert.deepEqual(rewardWeightsFromStars(stars), {
    goal: 3, speed: 0, judgment: 5, threat: 5,
  });
  assert.throws(() => assertRewardStars({ ...stars, goal: 3 } as RewardStars), /exactly three/);
  assert.throws(() => assertRewardStars({ ...stars, speed: 4 }), /integers from 0 to 3/);
  assert.throws(() => assertRewardStars({ ...stars, speed: 1 }), /total exactly 6/);
  assert.throws(
    () => new TrainingRuntimeController(environment, { ...stars, speed: 1 }, 42),
    /total exactly 6/,
  );
  assert.ok(normalizeReward(3, rewardWeightsFromStars(stars)) > 50, 'normalization must preserve the fixed positive goal reward');
});

test('training Korean labels and failure review use real episode data without exposing enums', () => {
  assert.equal(trainingLabel('VILLAIN_ENCOUNTER'), '악당');
  assert.equal(trainingLabel('FORCE_PASS'), '강제로 돌파하기');
  assert.equal(trainingLabel('ROBOT_DISABLED'), '작동 불능');
  assert.equal(terminalReasonSentence('TIMEOUT'), '시간 안에 임무를 끝내지 못했어.');
  assert.equal(meaningfulEventMessage(3, { type: 'STATE_CHANGE', floor: 5, simulationTime: 1, change: 'NO_BOSS', location: 'x' }), undefined);
  assert.equal(meaningfulEventMessage(2, { type: 'TERMINAL', floor: 3, simulationTime: 1, reason: 'ROBOT_DISABLED' }), '로봇 2가 작동 불능이 되었어요');
  assert.equal(importantActionMessage({ type: 'ACTION', floor: 3, simulationTime: 1, state: 'VILLAIN_ENCOUNTER', action: 'DISTRACT', zoneId: 'x' }), '악당의 주의를 다른 곳으로 돌리고 있어요!');
  assert.match(rewardAdvice({ speed: 3, judgment: 2, threat: 1 }), /빠르게 해결/);
  assert.match(rewardAdvice({ speed: 1, judgment: 3, threat: 2 }), /정확한 판단/);
  assert.match(rewardAdvice({ speed: 1, judgment: 2, threat: 3 }), /위협 제거/);

  const controller = new TrainingRuntimeController(environment, weights, 31);
  const episode = controller.robots.find(robot => robot.episode.terminalReason !== 'GOAL_REACHED')?.episode ?? controller.robots[0].episode;
  const review = failureReview(episode);
  assert.equal(review.floor, episode.actual.reachedFloors.at(-1) ?? 1);
  assert.equal(review.result, trainingLabel(episode.terminalReason));
  assert.ok(review.text.includes(`로봇 ${episode.robot}`));
  assert.ok(!review.text.includes(episode.terminalReason));
});

test('last-scene review explains only causal facts present in the episode trace', () => {
  const base = structuredClone(new TrainingRuntimeController(environment, weights, 31).robots[0].episode);
  base.terminalReason = 'ROBOT_DISABLED';
  base.goalReached = false;
  base.robotDamage = 1;
  base.actionHistory = [{
    state: 'BOSS_ENCOUNTER', action: 'SUBDUE', location: 'F5_BOSS_L1', elapsedCost: 6,
    immediateEvents: ['ROBOT_DISABLED'], localOutcome: 'SUBDUE_RECOVERY', localReturn: -1,
    actionCredit: -1, robotDamageAfter: 1,
  }];
  base.eventHistory = [{ type: 'ROBOT_DISABLED', elapsedTime: 10, location: 'F5_BOSS_L1', causedBy: 'SUBDUE' }];
  const disabled = failureReview(base);
  assert.match(disabled.text, /제압[\s\S]*공격에 실패[\s\S]*피해[\s\S]*작동 불능/);
  assert.doesNotMatch(disabled.text, /제어 시스템/);

  const timeout = structuredClone(base);
  timeout.terminalReason = 'TIMEOUT';
  timeout.robotDamage = 0;
  timeout.elapsedTime = 600;
  timeout.actionHistory[0].immediateEvents = [];
  timeout.eventHistory = [{ type: 'TIMEOUT', elapsedTime: 600, location: 'F5_SEARCH', causedBy: 'ENVIRONMENT' }];
  const timedOut = failureReview(timeout);
  assert.match(timedOut.text, /1번의 행동[\s\S]*600초[\s\S]*제한 시간/);
  assert.doesNotMatch(timedOut.text, /피해가 너무 많이/);

  const success = structuredClone(base);
  success.terminalReason = 'GOAL_REACHED';
  success.goalReached = true;
  success.robotDamage = 0;
  success.eventHistory = [
    { type: 'BOSS_NEUTRALIZED', elapsedTime: 10, location: 'L1', causedBy: 'SUBDUE' },
    { type: 'SYSTEM_RESTORED', elapsedTime: 20, location: 'F5_CONTROL_ROOM', causedBy: 'ENVIRONMENT' },
    { type: 'GOAL_REACHED', elapsedTime: 21, location: 'F5_GOAL', causedBy: 'ENVIRONMENT' },
  ];
  const completed = failureReview(success);
  assert.equal(completed.title, '어떻게 성공했을까?');
  assert.match(completed.text, /보스를 제압[\s\S]*시스템을 복구[\s\S]*임무를 성공/);
  assert.doesNotMatch(completed.text, /제어실로 가는 길을 열었/);
});

test('training production entry renders checkpoint Korean Ari result, review and final result UI without replacing debug entry', () => {
  const app = fs.readFileSync('src/modules/reinforcement/runtime/ReinforcementTrainingApp.tsx', 'utf8');
  const main = fs.readFileSync('src/main.tsx', 'utf8');
  const labels = fs.readFileSync('src/modules/reinforcement/runtime/trainingLabels.ts', 'utf8');
  const ari = fs.readFileSync('src/modules/ai-basics/AriDialogue.tsx', 'utf8');
  for (const label of ['빠르게 해결하기', '정확하게 판단하기', '위협 제거하기']) assert.match(labels, new RegExp(label));
  assert.doesNotMatch(labels, /goal: '임무 완수'/);
  assert.match(app, /별 6개를 모두 나누어 주세요/);
  assert.match(app, /disabled=\{!validStarBudget\}/);
  assert.match(app, /\[0, 1, 2, 3\]/);
  assert.match(app, /training-runtime-card/);
  assert.doesNotMatch(app, /training-event-feed|학습 중 일어난 일/);
  assert.match(app, /movement: 1, event: 1/);
  assert.doesNotMatch(app, /movement: (?:1\.5|4|8), event: (?:1\.5|4|8)/);
  assert.match(app, /waitForStart: true/);
  assert.match(app, /reinforcement-runtime-start/);
  assert.match(app, /readyRobots\.length === 5/);
  assert.match(app, /로봇들이 다음 도전을 준비하고 있어요/);
  assert.match(app, /5대의 로봇이 출발을 준비하고 있어요/);
  assert.match(app, /\{ready\} \/ \{total\} 준비 완료/);
  assert.match(app, /disabled=\{!running\}/);
  assert.match(app, /AriDialogue/);
  assert.match(app, /TUTORIAL_STEPS/);
  assert.match(app, /tutorial-highlight/);
  assert.match(app, /rewardAdvice\(weights\)/);
  assert.match(app, /지금 하는 행동/);
  assert.match(ari, /ai-dialogue-panel/);
  assert.match(app, /마지막 장면 보기/);
  assert.match(app, /결과로 돌아가기/);
  assert.match(app, /다음 학습 시작/);
  assert.match(app, /최종 결과 보기/);
  assert.match(app, /20번의 학습 중 5개 관찰 지점/);
  assert.match(app, /다시 학습하기/);
  assert.match(app, /배운 방법으로 실전 도전/);
  assert.match(app, /ACTUAL_PREPARING/);
  assert.match(app, /createEvaluation/);
  assert.match(app, /메인으로 돌아가기/);
  assert.doesNotMatch(app, /setTimeout|COMPRESSED|TRAINING_OBSERVATION|20 Rounds|100 Episodes/);
  assert.match(main, /mode === 'reinforcement-training' \? <ReinforcementTrainingApp \/>/);
  assert.match(main, /mode === 'reinforcement-runtime-debug' \? <ReinforcementRuntimeDebugApp \/>/);

  const scene = fs.readFileSync('src/modules/reinforcement/runtime/ReinforcementRuntimeScene.ts', 'utf8');
  assert.match(scene, /movementPlaybackSpeed/);
  assert.match(scene, /eventPlaybackSpeed/);
  assert.match(scene, /movementPixelsPerSecond \* this\.movementPlaybackSpeed/);
  assert.match(scene, /this\.started = !options\.waitForStart/);
  assert.match(scene, /if \(!this\.started \|\| this\.paused/);
  assert.doesNotMatch(scene.slice(scene.indexOf('private setPlaybackSpeed'), scene.indexOf('private emitStatus')), /simulationTime/);
});
