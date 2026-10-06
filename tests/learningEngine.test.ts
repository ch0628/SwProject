import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ACTIONS,
  PROFILES,
  calculateActionCredit,
  calculateLocalReturn,
  calculateRouteAdvantages,
  calculateSegmentReturn,
  createInitialPolicy,
  createSeededRandom,
  epsilonForRound,
  evaluateEpisode,
  isTerminalEvent,
  normalizeReward,
  recenterRoutePreferences,
  runProfile,
  resolveAmbiguousPerson,
  softmaxWithExploration,
  chooseAction,
} from '../src/modules/reinforcement/sim/learningEngine.ts';

const successfulReward = (profile: keyof typeof PROFILES, kind: 'damage' | 'risk') => evaluateEpisode({
  goalReached: true,
  elapsedTime: 10,
  facilityDamageCount: Number(kind === 'damage'),
  citizenRiskCount: Number(kind === 'risk'),
  citizenMisunderstanding: false,
  terminalReason: 'GOAL_REACHED',
}, PROFILES[profile]);

test('softmax plus exploration produces finite non-negative probabilities summing to one', () => {
  const policy = createInitialPolicy();
  for (const [state, actions] of Object.entries(ACTIONS)) {
    const probabilities = softmaxWithExploration(policy[state as keyof typeof ACTIONS], actions, 0.35);
    assert.ok(Math.abs(Object.values(probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
    assert.ok(Object.values(probabilities).every((value) => value >= 0 && Number.isFinite(value)));
  }
});

test('unavailable actions are removed before normalization and cannot be selected', () => {
  const policy = createInitialPolicy();
  policy.OBSTACLE.PUSH = 2;
  const available = ['DETOUR', 'WAIT'] as const;
  const probabilities = softmaxWithExploration(policy.OBSTACLE, available, 0.35);
  assert.deepEqual(Object.keys(probabilities), available);
  const random = createSeededRandom(42);
  for (let index = 0; index < 100; index++) assert.ok(available.includes(chooseAction(policy, 'OBSTACLE', available, random) as typeof available[number]));
});

test('reward normalization is centered, monotonic, clamped, and finite', () => {
  const weights = PROFILES.SAFE;
  assert.equal(normalizeReward(0, weights), 50);
  assert.ok(normalizeReward(-2, weights) < 50);
  assert.ok(normalizeReward(2, weights) > 50);
  assert.equal(normalizeReward(-1e6, weights), 0);
  assert.equal(normalizeReward(1e6, weights), 100);
  assert.ok(Number.isFinite(normalizeReward(1, weights)));
  assert.throws(() => normalizeReward(Number.NaN, weights));
  assert.throws(() => normalizeReward(Number.POSITIVE_INFINITY, weights));
});

test('failed episodes receive no speed reward', () => {
  for (const terminalReason of ['CITIZEN_MISUNDERSTANDING', 'TIMEOUT'] as const) {
    const reward = evaluateEpisode({
      goalReached: false,
      elapsedTime: 1,
      facilityDamageCount: 0,
      citizenRiskCount: 0,
      citizenMisunderstanding: terminalReason === 'CITIZEN_MISUNDERSTANDING',
      terminalReason,
    }, PROFILES.FAST);
    assert.equal(reward.speedValue, 0);
  }
});

test('only the three specified events are terminal', () => {
  assert.equal(isTerminalEvent('CITIZEN_RISK'), false);
  assert.equal(isTerminalEvent('FACILITY_DAMAGE'), false);
  assert.equal(isTerminalEvent('CITIZEN_MISUNDERSTANDING'), true);
  assert.equal(isTerminalEvent('GOAL_REACHED'), true);
  assert.equal(isTerminalEvent('TIMEOUT'), true);
});

test('rounds use one shared immutable snapshot and update once after all five episodes', () => {
  const run = runProfile('SAFE', 42);
  for (const round of run.rounds) {
    assert.equal(round.episodes.length, 5);
    assert.equal(new Set(round.snapshotSignatures).size, 1);
    assert.equal(round.snapshotSignatures[0], JSON.stringify(round.snapshot));
    assert.equal(round.centralPolicyUnchangedDuringEpisodes, true);
    assert.equal(round.updateCount, 1);
  }
});

test('preferences remain clamped and all final probability tables are valid', () => {
  for (const profile of ['SAFE', 'FAST', 'BALANCED'] as const) {
    const run = runProfile(profile, 42);
    for (const preferences of Object.values(run.finalPolicy)) {
      assert.ok(Object.values(preferences).every((value) => value >= -2 && value <= 2));
    }
    for (const probabilities of Object.values(run.finalProbabilities)) {
      assert.ok(Math.abs(Object.values(probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
      assert.ok(Object.values(probabilities).every((value) => value >= 0 && Number.isFinite(value)));
    }
  }
});

test('same seed and profile reproduce the full run', () => {
  assert.deepEqual(runProfile('SAFE', 42), runProfile('SAFE', 42));
});

test('risk and damage events are followed by later actions or a valid terminal event', () => {
  const runs = [runProfile('SAFE', 42), runProfile('FAST', 42), runProfile('BALANCED', 42)];
  for (const episode of runs.flatMap((run) => run.rounds.flatMap((round) => round.episodes))) {
    for (const [index, event] of episode.eventHistory.entries()) {
      if (event.type === 'CITIZEN_RISK' || event.type === 'FACILITY_DAMAGE') {
        assert.ok(episode.eventHistory.slice(index + 1).some((later) => isTerminalEvent(later.type)));
      }
    }
    assert.ok(isTerminalEvent(episode.eventHistory.at(-1)!.type));
  }
});

test('reward profiles create meaningfully different learned preferences', () => {
  const safe = runProfile('SAFE', 42).finalPolicy;
  const fast = runProfile('FAST', 42).finalPolicy;
  assert.notDeepEqual(safe, fast);
  assert.ok(safe.OBSTACLE.PUSH < fast.OBSTACLE.PUSH);
  assert.ok(safe.CITIZEN_NEARBY.FAST_PASS < fast.CITIZEN_NEARBY.FAST_PASS);
});

test('forced scenarios A-D: direct penalty credit is negative for SAFE and higher for FAST', () => {
  const safePushLocal = calculateLocalReturn('OBSTACLE', 1, ['FACILITY_DAMAGE'], PROFILES.SAFE);
  const fastPushLocal = calculateLocalReturn('OBSTACLE', 1, ['FACILITY_DAMAGE'], PROFILES.FAST);
  const safePushCredit = calculateActionCredit(successfulReward('SAFE', 'damage').episodeReturn, safePushLocal);
  const fastPushCredit = calculateActionCredit(successfulReward('FAST', 'damage').episodeReturn, fastPushLocal);
  assert.ok(safePushLocal < 0);
  assert.ok(safePushCredit < 0);
  assert.ok(fastPushCredit > safePushCredit);

  const safePassLocal = calculateLocalReturn('CITIZEN_NEARBY', 0.5, ['CITIZEN_RISK'], PROFILES.SAFE);
  const fastPassLocal = calculateLocalReturn('CITIZEN_NEARBY', 0.5, ['CITIZEN_RISK'], PROFILES.FAST);
  const safePassCredit = calculateActionCredit(successfulReward('SAFE', 'risk').episodeReturn, safePassLocal);
  const fastPassCredit = calculateActionCredit(successfulReward('FAST', 'risk').episodeReturn, fastPassLocal);
  assert.ok(safePassLocal < 0);
  assert.ok(safePassCredit < 0);
  assert.ok(fastPassCredit > safePassCredit);
});

test('forced scenarios E-F: citizen SUBDUE and threshold TRACK terminate with strong negative SAFE credit', () => {
  for (const action of ['SUBDUE', 'TRACK'] as const) {
    const resolution = resolveAmbiguousPerson('CITIZEN', action);
    assert.deepEqual(resolution.events, ['CITIZEN_MISUNDERSTANDING']);
    assert.equal(isTerminalEvent(resolution.events[0]), true);
    const reward = evaluateEpisode({
      goalReached: false,
      elapsedTime: resolution.elapsedCost,
      facilityDamageCount: 0,
      citizenRiskCount: 0,
      citizenMisunderstanding: true,
      terminalReason: 'CITIZEN_MISUNDERSTANDING',
    }, PROFILES.SAFE);
    const local = calculateLocalReturn('AMBIGUOUS_PERSON', resolution.elapsedCost, resolution.events, PROFILES.SAFE);
    assert.equal(reward.speedValue, 0);
    assert.ok(calculateActionCredit(reward.episodeReturn, local) <= -0.5);
  }
});

test('forced scenario G: timeout is a failed episode with no speed reward', () => {
  const reward = evaluateEpisode({
    goalReached: false,
    elapsedTime: 32,
    facilityDamageCount: 0,
    citizenRiskCount: 0,
    citizenMisunderstanding: false,
    terminalReason: 'TIMEOUT',
  }, PROFILES.FAST);
  assert.equal(reward.goalValue, -1);
  assert.equal(reward.speedValue, 0);
  assert.equal(isTerminalEvent('TIMEOUT'), true);
});

test('forced scenario H: route segment uses actual events and FAST credit exceeds SAFE credit', () => {
  const events = ['CITIZEN_RISK', 'FACILITY_DAMAGE'] as const;
  const safeSegment = calculateSegmentReturn(10, events, PROFILES.SAFE);
  const fastSegment = calculateSegmentReturn(10, events, PROFILES.FAST);
  const episodeReturn = 0.5;
  assert.ok(safeSegment < calculateSegmentReturn(10, [], PROFILES.SAFE));
  assert.ok(calculateActionCredit(episodeReturn, fastSegment) > calculateActionCredit(episodeReturn, safeSegment));
});

test('route actions store segment results, raw credit, and v1.2 relative advantage', () => {
  const run = runProfile('SAFE', 42);
  const routeActions = run.rounds.flatMap((round) => round.episodes)
    .flatMap((episode) => episode.actionHistory.filter((action) => action.state === 'ROUTE_CHOICE'));
  assert.ok(routeActions.length > 0);
  for (const action of routeActions) {
    assert.ok(action.segmentElapsedCost! >= action.elapsedCost);
    assert.ok(Array.isArray(action.segmentEvents));
    assert.ok(action.segmentReturn! >= -1 && action.segmentReturn! <= 1);
    assert.ok(Number.isFinite(action.rawRouteCredit));
    assert.ok(Number.isFinite(action.routeAdvantage));
    assert.equal(action.actionCredit, action.routeAdvantage);
  }
});

test('forced route R1-R2: SAFE favors clean corridor while FAST values the same risky shortcut more', () => {
  const episodeReturn = 0.5;
  const safeShortcut = calculateActionCredit(
    episodeReturn,
    calculateSegmentReturn(6, ['CITIZEN_RISK', 'FACILITY_DAMAGE'], PROFILES.SAFE),
  );
  const safeCorridor = calculateActionCredit(episodeReturn, calculateSegmentReturn(11, [], PROFILES.SAFE));
  const fastShortcut = calculateActionCredit(
    episodeReturn,
    calculateSegmentReturn(6, ['CITIZEN_RISK', 'FACILITY_DAMAGE'], PROFILES.FAST),
  );
  const advantages = calculateRouteAdvantages([
    { context: 'F1', action: 'FAST_SHORTCUT', rawRouteCredit: safeShortcut },
    { context: 'F1', action: 'SAFE_CORRIDOR', rawRouteCredit: safeCorridor },
  ]);
  assert.ok(advantages[1].routeAdvantage > advantages[0].routeAdvantage);
  assert.ok(fastShortcut > safeShortcut);
});

test('forced route R3: advantages are zero-mean, common-offset invariant, and context-local', () => {
  const samples = [
    { context: 'F1', action: 'A', rawRouteCredit: 0.2 },
    { context: 'F1', action: 'B', rawRouteCredit: 0.6 },
    { context: 'F3', action: 'C', rawRouteCredit: 10.0 },
    { context: 'F3', action: 'D', rawRouteCredit: 12.0 },
  ];
  const base = calculateRouteAdvantages(samples);
  const shifted = calculateRouteAdvantages(samples.map((sample) => ({ ...sample, rawRouteCredit: sample.rawRouteCredit + 1 })));
  assert.ok(base.every((sample, index) => Math.abs(sample.routeAdvantage - shifted[index].routeAdvantage) < 1e-12));
  for (const context of ['F1', 'F3']) {
    const values = base.filter((sample) => sample.context === context).map((sample) => sample.routeAdvantage);
    assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) / values.length) < 1e-12);
  }
  assert.ok(base.every((sample, index) => Math.abs(sample.routeAdvantage - [-0.2, 0.2, -1, 1][index]) < 1e-12));
});

test('forced route R4: re-centering preserves softmax probabilities', () => {
  const preferences = { FAST_SHORTCUT: 0.8, SAFE_CORRIDOR: 0.5, NORMAL_STAIRS: 0.2, ELEVATOR: 0.1 };
  const before = softmaxWithExploration(preferences, ACTIONS.ROUTE_CHOICE, 0.35);
  const centered = recenterRoutePreferences(preferences, ACTIONS.ROUTE_CHOICE);
  const after = softmaxWithExploration(centered, ACTIONS.ROUTE_CHOICE, 0.35);
  assert.ok(Math.abs(Object.values(centered).reduce((sum, value) => sum + value, 0)) < 1e-12);
  for (const action of ACTIONS.ROUTE_CHOICE) assert.ok(Math.abs(before[action] - after[action]) < 1e-12);
});

test('forced route R5: 20 rounds do not jointly saturate all route preferences at +2', () => {
  for (const profile of ['SAFE', 'FAST', 'BALANCED'] as const) {
    const run = runProfile(profile, 42, 20);
    for (const round of run.rounds) {
      const routePreferences = Object.values(round.policyAfter.ROUTE_CHOICE);
      assert.ok(routePreferences.every(Number.isFinite));
      assert.equal(routePreferences.every((value) => value === 2), false);
    }
    const probabilities = run.finalProbabilities.ROUTE_CHOICE;
    assert.ok(Math.abs(Object.values(probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
    assert.ok(Object.values(probabilities).every((value) => value > 0));
  }
});

test('20-round schedule, preferences, probabilities, snapshots, and exploration remain valid', () => {
  assert.deepEqual([1, 5, 6, 10, 11, 15, 16, 20].map(epsilonForRound), [0.35, 0.35, 0.25, 0.25, 0.15, 0.15, 0.10, 0.10]);
  for (const profile of ['SAFE', 'FAST', 'BALANCED'] as const) {
    const run = runProfile(profile, 42, 20);
    for (const round of run.rounds) {
      assert.equal(round.centralPolicyUnchangedDuringEpisodes, true);
      assert.equal(new Set(round.snapshotSignatures).size, 1);
      for (const preferences of Object.values(round.policyAfter)) {
        assert.ok(Object.values(preferences).every((value) => value >= -2 && value <= 2 && Number.isFinite(value)));
      }
      for (const probabilities of Object.values(round.nextProbabilities)) {
        assert.ok(Math.abs(Object.values(probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
        assert.ok(Object.values(probabilities).every((value) => value > 0 && Number.isFinite(value)));
      }
    }
    assert.equal(run.rounds.at(-1)!.epsilon, 0.10);
    assert.ok(Object.values(run.finalProbabilities).flatMap(Object.values).every((value) => value > 0));
  }
});
