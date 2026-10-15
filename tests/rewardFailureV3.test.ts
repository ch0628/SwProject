import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  ACTIONS,
  DEFAULT_REWARD_STARS,
  FIXED_GOAL_REWARD_WEIGHT,
  REWARD_STAR_FIELDS,
  REWARD_STAR_TO_WEIGHT,
  REWARD_STAR_TOTAL,
  assertRewardStars,
  createInitialPolicy,
  resolveBossEncounter,
  resolveVillainEncounter,
  rewardWeightsFromStars,
  type RewardStars,
} from '../src/modules/reinforcement/sim/learningEngine.ts';
import {
  ACTUAL_GRAPH_FILE,
  ACTUAL_MAP_FILES,
  buildActualMapEnvironment,
} from '../src/modules/reinforcement/sim/actualMapEnvironment.ts';
import {
  ACTUAL_ENVIRONMENT_PRODUCTION_V3,
  runActualMapEvaluation,
  runActualMapTraining,
} from '../src/modules/reinforcement/sim/actualMapSimulation.ts';

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const environment = buildActualMapEnvironment(ACTUAL_MAP_FILES.map(readJson), readJson(ACTUAL_GRAPH_FILE));
const balanced = rewardWeightsFromStars(DEFAULT_REWARD_STARS);

test('Reward v3 has exactly three six-star fields, ten valid combinations, fixed goal, and the v2 mapping', () => {
  assert.deepEqual(REWARD_STAR_FIELDS, ['speed', 'judgment', 'threat']);
  assert.equal(REWARD_STAR_TOTAL, 6);
  assert.deepEqual(DEFAULT_REWARD_STARS, { speed: 2, judgment: 2, threat: 2 });
  assert.deepEqual(REWARD_STAR_TO_WEIGHT, [0, 1, 2.5, 5]);
  assert.equal(FIXED_GOAL_REWARD_WEIGHT, 3);
  assert.deepEqual(rewardWeightsFromStars(DEFAULT_REWARD_STARS), { goal: 3, speed: 2.5, judgment: 2.5, threat: 2.5 });
  const valid: RewardStars[] = [];
  for (let speed = 0; speed <= 3; speed++) for (let judgment = 0; judgment <= 3; judgment++) for (let threat = 0; threat <= 3; threat++) {
    const stars = { speed, judgment, threat };
    if (speed + judgment + threat === 6) valid.push(stars);
  }
  assert.equal(valid.length, 10);
  assert.ok(valid.every(stars => (assertRewardStars(stars), true)));
  assert.throws(() => assertRewardStars({ ...DEFAULT_REWARD_STARS, speed: 4 }), /0 to 3/);
  assert.throws(() => assertRewardStars({ ...DEFAULT_REWARD_STARS, speed: 1 }), /exactly 6/);
  assert.throws(() => assertRewardStars({ ...DEFAULT_REWARD_STARS, facilityDamage: 0 } as RewardStars), /exactly three/);
});

test('combat skill raises SUBDUE probability, Boss stays harder, and failed combat still teaches', () => {
  const common = { combatSkillBonus: 0.45, subdueSuccessByCount: { 1: 0.62, 2: 0.52 } as const };
  assert.equal(resolveVillainEncounter(1, 'SUBDUE', 0.70, { ...common, combatSkill: 0 }).neutralized, false);
  assert.equal(resolveVillainEncounter(1, 'SUBDUE', 0.70, { ...common, combatSkill: 0.5 }).neutralized, true);
  assert.equal(resolveVillainEncounter(2, 'SUBDUE', 0.60, { ...common, combatSkill: 0 }).neutralized, false);
  const failed = resolveVillainEncounter(1, 'SUBDUE', 0.99, { ...common, combatSkill: 0 });
  assert.equal(failed.combatExperience, 0.6);
  assert.equal(failed.robotDamageDelta, 0.4);
  const boss = resolveBossEncounter('SUBDUE', 0.66, false, { baseSubdueSuccess: 0.42, combatSkill: 0.5, combatSkillBonus: 0.45 });
  const villain = resolveVillainEncounter(1, 'SUBDUE', 0.60, { ...common, combatSkill: 0.5 });
  assert.equal(villain.neutralized, true);
  assert.equal(boss.neutralized, false);
});

test('damage ordering follows the recovery contract', () => {
  const parameters = ACTUAL_ENVIRONMENT_PRODUCTION_V3;
  const distractPass = resolveVillainEncounter(1, 'DISTRACT', 0, parameters);
  const distractFail = resolveVillainEncounter(1, 'DISTRACT', 1, parameters);
  const forcePass = resolveVillainEncounter(1, 'FORCE_PASS', 0, parameters);
  const forceFail = resolveVillainEncounter(1, 'FORCE_PASS', 0.8, parameters);
  assert.ok(distractPass.robotDamageDelta! < distractFail.robotDamageDelta!);
  assert.ok(distractFail.robotDamageDelta! < forcePass.robotDamageDelta!);
  assert.ok(forcePass.robotDamageDelta! < forceFail.robotDamageDelta!);
  assert.deepEqual([
    distractPass.robotDamageDelta, distractFail.robotDamageDelta,
    forcePass.robotDamageDelta, forceFail.robotDamageDelta,
    resolveVillainEncounter(1, 'SUBDUE', 0, parameters).robotDamageDelta,
    resolveVillainEncounter(1, 'SUBDUE', 1, parameters).robotDamageDelta,
  ], [0.01, 0.05, 0.15, 0.25, 0.01, 0.4]);
});

test('twenty rounds use five shared policy/combat snapshots and update each exactly once', () => {
  const run = runActualMapTraining(environment, balanced, 42, 20, 5);
  assert.equal(run.rounds.length, 20);
  assert.equal(run.rounds.flatMap(round => round.episodes).length, 100);
  for (const [index, round] of run.rounds.entries()) {
    assert.equal(round.episodes.length, 5);
    assert.equal(new Set(round.snapshotSignatures).size, 1);
    assert.ok(round.episodes.every(episode => episode.combatSkillSnapshot === round.combatSkillSnapshot));
    assert.equal(round.updateCount, 1);
    assert.equal(round.combatSkillUpdateCount, 1);
    assert.ok(round.combatSkillSnapshot >= 0 && round.combatSkillAfter <= 1);
    if (index < 19) {
      assert.deepEqual(round.policyAfter, run.rounds[index + 1].snapshot);
      assert.equal(round.combatSkillAfter, run.rounds[index + 1].combatSkillSnapshot);
    }
  }
  assert.equal(run.rounds.at(-1)!.round, 20);
});

test('episode damage is monotonic, survives reroutes/retries, and new episodes start at zero', () => {
  const run = runActualMapTraining(environment, balanced, 7, 20, 5);
  for (const episode of run.rounds.flatMap(round => round.episodes)) {
    let damage = 0;
    for (const action of episode.actionHistory) {
      assert.ok(action.robotDamageAfter! >= damage);
      damage = action.robotDamageAfter!;
    }
    assert.equal(damage, episode.robotDamage);
    if (episode.robotDamage >= 1) assert.equal(episode.terminalReason, 'ROBOT_DISABLED');
  }
  assert.ok(run.rounds.flatMap(round => round.episodes).some(episode => episode.actual.stairReroutes > 0));
  assert.ok(run.rounds.flatMap(round => round.episodes).some(episode => episode.actual.localRetries > 0));
  assert.ok(run.rounds.flatMap(round => round.episodes).every(episode => episode.actual.repeatedSameStairLoops === 0));
});

test('F5 Guard allows SUBDUE/RETREAT, Boss is SUBDUE-only, and progression remains neutralization-gated', () => {
  assert.deepEqual(ACTIONS.BOSS_ENCOUNTER, ['SUBDUE']);
  const episodes = runActualMapTraining(environment, balanced, 9, 20, 5).rounds.flatMap(round => round.episodes);
  const f5Actions = episodes.flatMap(episode => episode.actionHistory.filter(action =>
    action.state === 'BOSS_ENCOUNTER' || (action.state === 'VILLAIN_ENCOUNTER' && String(action.location).startsWith('F5_'))));
  assert.ok(f5Actions.length > 0);
  assert.ok(f5Actions.every(action => action.action === 'SUBDUE' || action.action === 'RETREAT'));
  assert.ok(f5Actions.filter(action => action.state === 'BOSS_ENCOUNTER').every(action => action.action === 'SUBDUE'));
  assert.ok(episodes.filter(episode => episode.goalReached).every(episode => {
    const events = episode.eventHistory.map(event => event.type);
    return events.indexOf('BOSS_NEUTRALIZED') < events.indexOf('SECURITY_LOCK_OPEN')
      && events.indexOf('SECURITY_LOCK_OPEN') < events.indexOf('SYSTEM_RESTORED')
      && events.indexOf('SYSTEM_RESTORED') < events.indexOf('GOAL_REACHED');
  }));
});

test('checkpoint evaluation performs no policy, skill, or history mutation', () => {
  const run = runActualMapTraining(environment, balanced, 11, 20, 5);
  const checkpoint = run.rounds[9];
  const policyBefore = structuredClone(checkpoint.policyAfter);
  const roundsBefore = structuredClone(run.rounds);
  runActualMapEvaluation(environment, checkpoint.policyAfter, balanced, 20_001, ACTUAL_ENVIRONMENT_PRODUCTION_V3, checkpoint.combatSkillAfter);
  assert.deepEqual(checkpoint.policyAfter, policyBefore);
  assert.deepEqual(run.rounds, roundsBefore);
});
