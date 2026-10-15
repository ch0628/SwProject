import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  ACTIONS,
  ACTION_TIME,
  DEFAULT_REWARD_STARS,
  resolveBossEncounter,
  resolveVillainEncounter,
  rewardWeightsFromStars,
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

test('SUBDUE defeat adds recovery cost, damage and experience without directly disabling Robot', () => {
  const villain = resolveVillainEncounter(1, 'SUBDUE', 1, ACTUAL_ENVIRONMENT_PRODUCTION_V3);
  const boss = resolveBossEncounter('SUBDUE', 1, false, {
    baseSubdueSuccess: ACTUAL_ENVIRONMENT_PRODUCTION_V3.bossSubdue,
    subdueFailureDamage: ACTUAL_ENVIRONMENT_PRODUCTION_V3.subdueFailureDamage,
  });
  for (const result of [villain, boss]) {
    assert.equal(result.elapsedCost, ACTION_TIME.VERY_SMALL + 5);
    assert.equal(result.robotDamageDelta, 0.4);
    assert.equal(result.combatExperience, 0.6);
    assert.equal(result.localOutcome, 'SUBDUE_RECOVERY');
    assert.equal(result.retry, true);
    assert.equal(result.subdueFailed, true);
    assert.deepEqual(result.events, []);
  }
});

test('local retry bonus changes Villain and Boss probability without changing global skill', () => {
  const villainOptions = { subdueSuccessByCount: { 1: 0.5, 2: 0.4 } as const, combatSkill: 0, combatSkillBonus: 0.45 };
  assert.equal(resolveVillainEncounter(1, 'SUBDUE', 0.54, villainOptions).neutralized, false);
  assert.equal(resolveVillainEncounter(1, 'SUBDUE', 0.54, { ...villainOptions, retryCombatBonus: 0.05 }).neutralized, true);
  const bossOptions = { baseSubdueSuccess: 0.4, combatSkill: 0, combatSkillBonus: 0.45 };
  assert.equal(resolveBossEncounter('SUBDUE', 0.44, false, bossOptions).neutralized, false);
  assert.equal(resolveBossEncounter('SUBDUE', 0.44, false, { ...bossOptions, retryCombatBonus: 0.05 }).neutralized, true);

  const run = runActualMapTraining(environment, balanced, 73, 3, 5);
  assert.ok(run.rounds.every(round => round.episodes.every(episode => episode.combatSkillSnapshot === round.combatSkillSnapshot)));
  assert.ok(run.rounds.every(round => round.combatSkillUpdateCount === 1));
});

test('alive SUBDUE defeats continue the same encounter and allow the full canonical follow-up pool', () => {
  const seedRun = runActualMapTraining(environment, balanced, 3, 1, 5);
  const policy = structuredClone(seedRun.finalPolicy);
  for (const action of ACTIONS.VILLAIN_ENCOUNTER) policy.VILLAIN_ENCOUNTER[action] = 0;
  const parameters = {
    ...ACTUAL_ENVIRONMENT_PRODUCTION_V3,
    villain1Subdue: 0.01,
    villain2Subdue: 0.01,
    bossSubdue: 0.01,
    bossDistractedSubdue: 0.01,
  };
  const episodes = Array.from({ length: 400 }, (_, index) =>
    runActualMapEvaluation(environment, policy, balanced, 30_000 + index, parameters, 0));
  const followups: string[] = [];
  const recoveredFloors = new Set<number>();
  for (const episode of episodes) {
    for (let index = 0; index < episode.actionHistory.length - 1; index++) {
      const action = episode.actionHistory[index];
      if (action.localOutcome !== 'SUBDUE_RECOVERY' || action.robotDamageAfter! >= 1) continue;
      const next = episode.actionHistory[index + 1];
      assert.equal(next.state, action.state);
      assert.equal(next.location, action.location);
      followups.push(next.action);
      const zone = environment.zones.find(candidate => candidate.id === action.location);
      if (zone) recoveredFloors.add(zone.floor);
    }
  }
  assert.ok(followups.length > 0);
  assert.ok(followups.some(action => action !== 'SUBDUE'));
  assert.ok(followups.every(action => [...ACTIONS.VILLAIN_ENCOUNTER, ...ACTIONS.BOSS_ENCOUNTER].includes(action as never)));
  assert.ok([2, 3, 4].every(floor => recoveredFloors.has(floor)), 'one-stair and two-stair Villains must both recover in place');
  for (const enemyType of ['VILLAIN_2', 'F5_GUARD', 'BOSS'] as const) {
    assert.ok(episodes.some(episode => episode.actual.combatEncounters.some(encounter => encounter.enemyType === enemyType && encounter.subdueFailures > 0)));
  }
});

test('ROBOT_DISABLED is emitted only at cumulative damage one and encounter diagnostics stay consistent', () => {
  const seedRun = runActualMapTraining(environment, balanced, 5, 1, 5);
  const policy = structuredClone(seedRun.finalPolicy);
  for (const action of ACTIONS.VILLAIN_ENCOUNTER) policy.VILLAIN_ENCOUNTER[action] = action === 'SUBDUE' ? 2 : -2;
  for (const action of ACTIONS.BOSS_ENCOUNTER) policy.BOSS_ENCOUNTER[action] = action === 'SUBDUE' ? 2 : -2;
  const parameters = {
    ...ACTUAL_ENVIRONMENT_PRODUCTION_V3,
    villain1Subdue: 0,
    villain2Subdue: 0,
    bossSubdue: 0,
    bossDistractedSubdue: 0,
  };
  const episodes = Array.from({ length: 120 }, (_, index) =>
    runActualMapEvaluation(environment, policy, balanced, 40_000 + index, parameters, 0));
  const disabled = episodes.filter(episode => episode.terminalReason === 'ROBOT_DISABLED');
  assert.ok(disabled.length > 0);
  for (const episode of episodes) {
    const disabledActions = episode.actionHistory.filter(action => action.immediateEvents.includes('ROBOT_DISABLED'));
    assert.ok(disabledActions.every(action => action.robotDamageAfter! >= 1));
    assert.equal(disabledActions.length, episode.terminalReason === 'ROBOT_DISABLED' ? 1 : 0);
    for (const encounter of episode.actual.combatEncounters) {
      const maximumBonusTotal = Array.from({ length: encounter.attempts }, (_, index) => Math.min(
        index * ACTUAL_ENVIRONMENT_PRODUCTION_V3.retryCombatBonusStep!,
        ACTUAL_ENVIRONMENT_PRODUCTION_V3.retryCombatBonusCap!,
      ))
        .reduce((sum, value) => sum + value, 0);
      assert.ok(encounter.retryBonusTotal <= maximumBonusTotal + 1e-9);
      if (encounter.recoveredThenNeutralized) assert.ok(encounter.subdueFailures > 0 && encounter.finalNeutralization);
      if (encounter.disabledCaused) assert.equal(episode.terminalReason, 'ROBOT_DISABLED');
    }
  }
});
