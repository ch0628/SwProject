export const ACTIONS = {
  ROUTE_CHOICE: ['FAST_SHORTCUT', 'SAFE_CORRIDOR', 'NORMAL_STAIRS', 'ELEVATOR'],
  OBSTACLE: ['DETOUR', 'PUSH', 'SQUEEZE', 'WAIT'],
  CITIZEN_NEARBY: ['WIDE_DETOUR', 'SLOW_PASS', 'WAIT', 'FAST_PASS'],
  AMBIGUOUS_PERSON: ['OBSERVE', 'BYPASS', 'TRACK', 'SUBDUE'],
} as const;

export type DecisionState = keyof typeof ACTIONS;
export type SimulationState = 'MOVING' | DecisionState;
export type Action = (typeof ACTIONS)[DecisionState][number];
export type TerminalReason = 'GOAL_REACHED' | 'CITIZEN_MISUNDERSTANDING' | 'TIMEOUT';
export type EventType = TerminalReason | 'CITIZEN_RISK' | 'FACILITY_DAMAGE';

export type RewardWeights = {
  goal: number;
  speed: number;
  facilityDamage: number;
  citizenRisk: number;
  citizenMisunderstanding: number;
};

export const PROFILES = {
  SAFE: { goal: 3, speed: 1, facilityDamage: 3, citizenRisk: 3, citizenMisunderstanding: 3 },
  FAST: { goal: 3, speed: 3, facilityDamage: 0, citizenRisk: 0, citizenMisunderstanding: 1 },
  BALANCED: { goal: 3, speed: 2, facilityDamage: 2, citizenRisk: 2, citizenMisunderstanding: 2 },
} as const satisfies Record<string, RewardWeights>;

export type ProfileName = keyof typeof PROFILES;
export type Policy = Record<DecisionState, Record<string, number>>;

export type ActionExperience = {
  state: DecisionState;
  action: Action;
  elapsedCost: number;
  immediateEvents: EventType[];
  localOutcome: string;
  localReturn: number;
  segmentElapsedCost?: number;
  segmentEvents?: EventType[];
  segmentReturn?: number;
  routeContext?: string;
  routeOptions?: Action[];
  rawRouteCredit?: number;
  routeAdvantage?: number;
  actionCredit: number;
};

export type RouteCreditSample = {
  context: string;
  action: string;
  rawRouteCredit: number;
};

export type EventRecord = {
  type: EventType;
  elapsedTime: number;
  location: string;
  causedBy: Action | 'ENVIRONMENT';
};

export type RewardBreakdown = {
  goalValue: number;
  speedValue: number;
  damageValue: number;
  riskValue: number;
  misunderstandingValue: number;
  rawReward: number;
  experienceScore: number;
  episodeReturn: number;
};

export type EpisodeExperience = {
  robot: number;
  goalReached: boolean;
  elapsedTime: number;
  facilityDamageCount: number;
  citizenRiskCount: number;
  citizenMisunderstanding: boolean;
  terminalReason: TerminalReason;
  actionHistory: ActionExperience[];
  eventHistory: EventRecord[];
  reward: RewardBreakdown;
  snapshotSignature: string;
};

export type PreferenceChange = {
  state: DecisionState;
  action: string;
  before: number;
  after: number;
  averageCredit: number;
  samples: number;
};

export type RoundResult = {
  round: number;
  epsilon: number;
  snapshot: Policy;
  snapshotSignatures: string[];
  centralPolicyUnchangedDuringEpisodes: boolean;
  episodes: EpisodeExperience[];
  changes: PreferenceChange[];
  policyAfter: Policy;
  nextProbabilities: Record<DecisionState, Record<string, number>>;
  updateCount: number;
};

export type ProfileRun = {
  profile: ProfileName;
  seed: number;
  rounds: RoundResult[];
  finalPolicy: Policy;
  finalProbabilities: Record<DecisionState, Record<string, number>>;
  summary: {
    successRate: number;
    timeoutRate: number;
    misunderstandingRate: number;
    avgElapsedTime: number;
    avgCitizenRisk: number;
    avgFacilityDamage: number;
    avgExperienceScore: number;
  };
};

type Route = {
  timeCost: number;
  citizenExposure: number;
  obstacleChance: number;
  ambiguousPersonChance: number;
  narrowness: number;
};

const ROUTES: Record<string, Route> = {
  FAST_SHORTCUT: { timeCost: 5, citizenExposure: 0.75, obstacleChance: 0.55, ambiguousPersonChance: 0.25, narrowness: 0.65 },
  SAFE_CORRIDOR: { timeCost: 11, citizenExposure: 0.12, obstacleChance: 0.18, ambiguousPersonChance: 0.08, narrowness: 0.10 },
  NORMAL_STAIRS: { timeCost: 8, citizenExposure: 0.35, obstacleChance: 0.45, ambiguousPersonChance: 0.15, narrowness: 0.35 },
  ELEVATOR: { timeCost: 7, citizenExposure: 0.50, obstacleChance: 0.15, ambiguousPersonChance: 0.35, narrowness: 0.20 },
};

export const TIME_LIMIT = 32;
export const EPSILON = 0.35;
export const LEARNING_RATE = 0.35;

export function epsilonForRound(round: number): number {
  if (round <= 5) return 0.35;
  if (round <= 10) return 0.25;
  if (round <= 15) return 0.15;
  return 0.10;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const roundNumber = (value: number): number => Number(value.toFixed(6));

export function createInitialPolicy(): Policy {
  return Object.fromEntries(
    Object.entries(ACTIONS).map(([state, actions]) => [state, Object.fromEntries(actions.map((action) => [action, 0]))]),
  ) as Policy;
}

export function clonePolicy(policy: Policy): Policy {
  return Object.fromEntries(
    Object.entries(policy).map(([state, preferences]) => [state, { ...preferences }]),
  ) as Policy;
}

export function softmaxWithExploration(
  preferences: Record<string, number>,
  availableActions: readonly string[],
  epsilon = EPSILON,
): Record<string, number> {
  if (availableActions.length === 0) throw new Error('At least one action must be available');
  const maxPreference = Math.max(...availableActions.map((action) => preferences[action] ?? 0));
  const exponentials = availableActions.map((action) => Math.exp((preferences[action] ?? 0) - maxPreference));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  const uniform = 1 / availableActions.length;
  const probabilities = Object.fromEntries(
    availableActions.map((action, index) => [action, (1 - epsilon) * (exponentials[index] / total) + epsilon * uniform]),
  );
  const probabilitySum = Object.values(probabilities).reduce((sum, value) => sum + value, 0);
  const lastAction = availableActions.at(-1)!;
  probabilities[lastAction] += 1 - probabilitySum;
  return probabilities;
}

export function probabilityTable(policy: Policy, epsilon = EPSILON): Record<DecisionState, Record<string, number>> {
  return Object.fromEntries(
    (Object.keys(ACTIONS) as DecisionState[]).map((state) => [
      state,
      softmaxWithExploration(policy[state], ACTIONS[state], epsilon),
    ]),
  ) as Record<DecisionState, Record<string, number>>;
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function episodeSeed(seed: number, round: number, robot: number): number {
  return (seed ^ Math.imul(round, 0x9e3779b1) ^ Math.imul(robot, 0x85ebca6b)) >>> 0;
}

export function chooseAction(
  policy: Policy,
  state: DecisionState,
  availableActions: readonly string[],
  random: () => number,
  epsilon = EPSILON,
): Action {
  const probabilities = softmaxWithExploration(policy[state], availableActions, epsilon);
  let draw = random();
  for (const action of availableActions) {
    draw -= probabilities[action];
    if (draw <= 0) return action as Action;
  }
  return availableActions.at(-1)! as Action;
}

export function normalizeReward(rawReward: number, weights: RewardWeights): number {
  if (!Number.isFinite(rawReward)) throw new Error('rawReward must be finite');
  const positiveMaximum = weights.goal + weights.speed;
  const negativeMagnitude = weights.goal + weights.facilityDamage + weights.citizenRisk + weights.citizenMisunderstanding;
  const score = rawReward >= 0
    ? 50 + 50 * (positiveMaximum === 0 ? 0 : rawReward / positiveMaximum)
    : 50 + 50 * (negativeMagnitude === 0 ? 0 : rawReward / negativeMagnitude);
  return clamp(score, 0, 100);
}

export function evaluateEpisode(
  episode: Pick<EpisodeExperience, 'goalReached' | 'elapsedTime' | 'facilityDamageCount' | 'citizenRiskCount' | 'citizenMisunderstanding' | 'terminalReason'>,
  weights: RewardWeights,
  timeLimit = TIME_LIMIT,
): RewardBreakdown {
  const goalValue = episode.terminalReason === 'GOAL_REACHED' ? 1 : -1;
  const speedValue = episode.goalReached ? clamp(1 - episode.elapsedTime / timeLimit, 0, 1) : 0;
  const damageValue = Math.min(episode.facilityDamageCount / 3, 1);
  const riskValue = Math.min(episode.citizenRiskCount / 3, 1);
  const misunderstandingValue = episode.citizenMisunderstanding ? 1 : 0;
  const rawReward = weights.goal * goalValue
    + weights.speed * speedValue
    - weights.facilityDamage * damageValue
    - weights.citizenRisk * riskValue
    - weights.citizenMisunderstanding * misunderstandingValue;
  const experienceScore = normalizeReward(rawReward, weights);
  return {
    goalValue,
    speedValue,
    damageValue,
    riskValue,
    misunderstandingValue,
    rawReward,
    experienceScore,
    episodeReturn: (experienceScore - 50) / 50,
  };
}

export function isTerminalEvent(event: EventType): event is TerminalReason {
  return event === 'GOAL_REACHED' || event === 'CITIZEN_MISUNDERSTANDING' || event === 'TIMEOUT';
}

function scaledOutcome(cost: number, minimum: number, maximum: number): number {
  return maximum === minimum ? 0 : 1 - 2 * ((cost - minimum) / (maximum - minimum));
}

// Local return is the weighted mean of direct, normalized outcomes. A safe non-event is +1,
// an actual damage/risk/misunderstanding is -1, and time spans fastest (+1) to slowest (-1).
export function calculateLocalReturn(
  state: DecisionState,
  elapsedCost: number,
  immediateEvents: readonly EventType[],
  weights: RewardWeights,
): number {
  let numerator = 0;
  let denominator = 0;
  const add = (weight: number, outcome: number): void => {
    if (weight > 0) {
      numerator += weight * outcome;
      denominator += weight;
    }
  };
  if (state === 'ROUTE_CHOICE') add(weights.speed, scaledOutcome(elapsedCost, 5, 11));
  if (state === 'OBSTACLE') {
    add(weights.speed, scaledOutcome(elapsedCost, 0.5, 5));
    add(weights.facilityDamage, immediateEvents.includes('FACILITY_DAMAGE') ? -1 : 1);
  }
  if (state === 'CITIZEN_NEARBY') {
    add(weights.speed, scaledOutcome(elapsedCost, 0.5, 5));
    add(weights.citizenRisk, immediateEvents.includes('CITIZEN_RISK') ? -1 : 1);
  }
  if (state === 'AMBIGUOUS_PERSON') {
    add(weights.speed, scaledOutcome(elapsedCost, 0.5, 5));
    add(weights.citizenMisunderstanding, immediateEvents.includes('CITIZEN_MISUNDERSTANDING') ? -1 : 1);
  }
  return denominator === 0 ? 0 : clamp(numerator / denominator, -1, 1);
}

export function calculateSegmentReturn(
  elapsedCost: number,
  events: readonly EventType[],
  weights: RewardWeights,
): number {
  let numerator = 0;
  let denominator = 0;
  const add = (weight: number, outcome: number): void => {
    if (weight > 0) {
      numerator += weight * outcome;
      denominator += weight;
    }
  };
  add(weights.speed, scaledOutcome(elapsedCost, 5, 26));
  add(weights.facilityDamage, events.includes('FACILITY_DAMAGE') ? -1 : 1);
  add(weights.citizenRisk, events.includes('CITIZEN_RISK') ? -1 : 1);
  add(weights.citizenMisunderstanding, events.includes('CITIZEN_MISUNDERSTANDING') ? -1 : 1);
  return denominator === 0 ? 0 : clamp(numerator / denominator, -1, 1);
}

export function calculateActionCredit(episodeReturn: number, directReturn: number): number {
  return clamp(0.35 * episodeReturn + 0.65 * directReturn, -1, 1);
}

export function calculateRouteAdvantages<T extends RouteCreditSample>(samples: readonly T[]): Array<T & { routeAdvantage: number }> {
  const baselines = new Map<string, number>();
  for (const context of new Set(samples.map((sample) => sample.context))) {
    const comparable = samples.filter((sample) => sample.context === context);
    baselines.set(context, comparable.reduce((sum, sample) => sum + sample.rawRouteCredit, 0) / comparable.length);
  }
  return samples.map((sample) => ({
    ...sample,
    routeAdvantage: sample.rawRouteCredit - baselines.get(sample.context)!,
  }));
}

export function recenterRoutePreferences(
  preferences: Record<string, number>,
  actions: readonly string[],
): Record<string, number> {
  const mean = actions.reduce((sum, action) => sum + preferences[action], 0) / actions.length;
  return {
    ...preferences,
    ...Object.fromEntries(actions.map((action) => [action, clamp(preferences[action] - mean, -2, 2)])),
  };
}

export function resolveAmbiguousPerson(
  actualType: 'CITIZEN' | 'VILLAIN',
  action: Action,
): { elapsedCost: number; events: EventType[]; localOutcome: string } {
  const costs: Record<string, number> = { OBSERVE: 3, BYPASS: 2, TRACK: 5, SUBDUE: 0.5 };
  const elapsedCost = costs[action] ?? 0;
  const misunderstanding = actualType === 'CITIZEN' && (action === 'SUBDUE' || action === 'TRACK');
  return {
    elapsedCost,
    events: misunderstanding ? ['CITIZEN_MISUNDERSTANDING'] : [],
    localOutcome: misunderstanding ? 'MISIDENTIFIED_CITIZEN' : `${actualType}_${action}`,
  };
}

function simulateEpisode(
  robot: number,
  policySnapshot: Policy,
  weights: RewardWeights,
  random: () => number,
  epsilon: number,
): EpisodeExperience {
  let elapsedTime = 0;
  let facilityDamageCount = 0;
  let citizenRiskCount = 0;
  let citizenMisunderstanding = false;
  let terminalReason: TerminalReason | undefined;
  const actionHistory: ActionExperience[] = [];
  const eventHistory: EventRecord[] = [];
  const snapshotSignature = JSON.stringify(policySnapshot);

  const recordEvent = (type: EventType, location: string, causedBy: Action | 'ENVIRONMENT'): void => {
    eventHistory.push({ type, elapsedTime: roundNumber(elapsedTime), location, causedBy });
    if (type === 'FACILITY_DAMAGE') facilityDamageCount++;
    if (type === 'CITIZEN_RISK') citizenRiskCount++;
    if (type === 'CITIZEN_MISUNDERSTANDING') {
      citizenMisunderstanding = true;
      terminalReason = type;
    }
  };

  const finishIfTimedOut = (location: string): boolean => {
    if (!terminalReason && elapsedTime >= TIME_LIMIT) {
      elapsedTime = TIME_LIMIT;
      terminalReason = 'TIMEOUT';
      recordEvent('TIMEOUT', location, 'ENVIRONMENT');
    }
    return terminalReason === 'TIMEOUT';
  };

  const recordAction = (
    state: DecisionState,
    action: Action,
    elapsedCost: number,
    immediateEvents: EventType[],
    localOutcome: string,
  ): void => {
    elapsedTime += elapsedCost;
    for (const event of immediateEvents) recordEvent(event, `LEG_${Math.min(2, actionHistory.filter((item) => item.state === 'ROUTE_CHOICE').length)}`, action);
    actionHistory.push({
      state,
      action,
      elapsedCost,
      immediateEvents,
      localOutcome,
      localReturn: state === 'ROUTE_CHOICE' ? 0 : calculateLocalReturn(state, elapsedCost, immediateEvents, weights),
      actionCredit: 0,
    });
  };

  for (let leg = 1; leg <= 2 && !terminalReason; leg++) {
    const routeAction = chooseAction(policySnapshot, 'ROUTE_CHOICE', ACTIONS.ROUTE_CHOICE, random, epsilon);
    const route = ROUTES[routeAction];
    recordAction('ROUTE_CHOICE', routeAction, route.timeCost, [], 'MOVING');
    const routeExperience = actionHistory.at(-1)!;
    routeExperience.routeContext = 'MOCK_ROUTE_CONTEXT';
    routeExperience.routeOptions = [...ACTIONS.ROUTE_CHOICE];
    if (finishIfTimedOut(`LEG_${leg}`)) break;

    if (random() < route.obstacleChance) {
      const staticObstacle = random() < 0.55;
      const available = staticObstacle ? ['DETOUR', 'PUSH', 'SQUEEZE'] : ['DETOUR', 'SQUEEZE', 'WAIT'];
      const action = chooseAction(policySnapshot, 'OBSTACLE', available, random, epsilon);
      const costs: Record<string, number> = { DETOUR: 5, PUSH: 1, SQUEEZE: 0.5, WAIT: 4 };
      const cost = costs[action] ?? 0;
      const damage = action === 'PUSH' ? random() < 0.85 : action === 'SQUEEZE' && random() < route.narrowness * 0.45;
      recordAction('OBSTACLE', action, cost, damage ? ['FACILITY_DAMAGE'] : [], damage ? 'DAMAGED_FACILITY' : 'CLEARED_OBSTACLE');
      if (finishIfTimedOut(`LEG_${leg}_OBSTACLE`)) break;
    }

    if (random() < route.citizenExposure && !terminalReason) {
      const action = chooseAction(policySnapshot, 'CITIZEN_NEARBY', ACTIONS.CITIZEN_NEARBY, random, epsilon);
      const costs: Record<string, number> = { WIDE_DETOUR: 5, SLOW_PASS: 3, WAIT: 4, FAST_PASS: 0.5 };
      const riskChances: Record<string, number> = { WIDE_DETOUR: 0.02, SLOW_PASS: 0.10, WAIT: 0, FAST_PASS: 0.80 };
      const cost = costs[action] ?? 0;
      const riskChance = riskChances[action] ?? 0;
      const risk = random() < riskChance;
      recordAction('CITIZEN_NEARBY', action, cost, risk ? ['CITIZEN_RISK'] : [], risk ? 'RISKED_CITIZEN' : 'PASSED_SAFELY');
      if (finishIfTimedOut(`LEG_${leg}_CITIZEN`)) break;
    }

    if (random() < route.ambiguousPersonChance && !terminalReason) {
      const actualType = random() < 0.60 ? 'CITIZEN' : 'VILLAIN';
      const action = chooseAction(policySnapshot, 'AMBIGUOUS_PERSON', ACTIONS.AMBIGUOUS_PERSON, random, epsilon);
      const resolution = resolveAmbiguousPerson(actualType, action);
      recordAction(
        'AMBIGUOUS_PERSON',
        action,
        resolution.elapsedCost,
        resolution.events,
        resolution.localOutcome,
      );
      if (finishIfTimedOut(`LEG_${leg}_AMBIGUOUS`)) break;
    }
  }

  if (!terminalReason) {
    terminalReason = 'GOAL_REACHED';
    recordEvent('GOAL_REACHED', 'CONTROL_ROOM', 'ENVIRONMENT');
  }

  const baseEpisode = {
    robot,
    goalReached: terminalReason === 'GOAL_REACHED',
    elapsedTime: roundNumber(elapsedTime),
    facilityDamageCount,
    citizenRiskCount,
    citizenMisunderstanding,
    terminalReason,
    actionHistory,
    eventHistory,
    snapshotSignature,
  };
  const reward = evaluateEpisode(baseEpisode, weights);
  for (let index = 0; index < actionHistory.length; index++) {
    const action = actionHistory[index];
    if (action.state === 'ROUTE_CHOICE') {
      const nextRoute = actionHistory.findIndex((candidate, candidateIndex) =>
        candidateIndex > index && candidate.state === 'ROUTE_CHOICE');
      const segment = actionHistory.slice(index, nextRoute === -1 ? actionHistory.length : nextRoute);
      action.segmentElapsedCost = segment.reduce((sum, candidate) => sum + candidate.elapsedCost, 0);
      action.segmentEvents = segment.flatMap((candidate) => candidate.immediateEvents);
      action.segmentReturn = calculateSegmentReturn(action.segmentElapsedCost, action.segmentEvents, weights);
      action.localReturn = action.segmentReturn;
      action.rawRouteCredit = calculateActionCredit(reward.episodeReturn, action.segmentReturn);
    }
    action.actionCredit = action.rawRouteCredit ?? calculateActionCredit(reward.episodeReturn, action.localReturn);
  }
  return { ...baseEpisode, reward };
}

export function updatePolicy(policy: Policy, episodes: readonly EpisodeExperience[]): { policy: Policy; changes: PreferenceChange[] } {
  const next = clonePolicy(policy);
  const credits = new Map<string, number[]>();
  const routeExperiences: ActionExperience[] = [];
  for (const episode of episodes) {
    for (const experience of episode.actionHistory) {
      if (experience.state === 'ROUTE_CHOICE') {
        routeExperiences.push(experience);
        continue;
      }
      const key = `${experience.state}.${experience.action}`;
      const values = credits.get(key) ?? [];
      values.push(experience.actionCredit);
      credits.set(key, values);
    }
  }
  const changes: PreferenceChange[] = [];
  for (const [key, values] of credits) {
    const [state, action] = key.split('.') as [DecisionState, string];
    const before = policy[state][action];
    const averageCredit = values.reduce((sum, value) => sum + value, 0) / values.length;
    const after = clamp(before + LEARNING_RATE * averageCredit, -2, 2);
    next[state][action] = after;
    changes.push({ state, action, before, after, averageCredit, samples: values.length });
  }

  const routeSamples = routeExperiences.map((experience) => ({
    context: experience.routeContext ?? 'MOCK_ROUTE_CONTEXT',
    action: experience.action,
    rawRouteCredit: experience.rawRouteCredit ?? experience.actionCredit,
    experience,
  }));
  const routeAdvantages = calculateRouteAdvantages(routeSamples);
  for (const sample of routeAdvantages) {
    sample.experience.routeAdvantage = sample.routeAdvantage;
    sample.experience.actionCredit = sample.routeAdvantage;
  }
  for (const context of new Set(routeAdvantages.map((sample) => sample.context))) {
    const contextSamples = routeAdvantages.filter((sample) => sample.context === context);
    const actions = [...new Set(contextSamples.flatMap((sample) => sample.experience.routeOptions ?? [sample.experience.action]))];
    const before = Object.fromEntries(actions.map((action) => [action, policy.ROUTE_CHOICE[action]]));
    const averageAdvantages = Object.fromEntries(actions.map((action) => {
      const values = contextSamples.filter((sample) => sample.action === action).map((sample) => sample.routeAdvantage);
      return [action, values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length];
    }));
    for (const action of actions) next.ROUTE_CHOICE[action] += LEARNING_RATE * averageAdvantages[action];
    next.ROUTE_CHOICE = recenterRoutePreferences(next.ROUTE_CHOICE, actions);
    for (const action of actions) {
      changes.push({
        state: 'ROUTE_CHOICE',
        action,
        before: before[action],
        after: next.ROUTE_CHOICE[action],
        averageCredit: averageAdvantages[action],
        samples: contextSamples.filter((sample) => sample.action === action).length,
      });
    }
  }
  changes.sort((a, b) => a.state.localeCompare(b.state) || a.action.localeCompare(b.action));
  return { policy: next, changes };
}

export function runProfile(profile: ProfileName, seed = 42, roundCount = 3, robotsPerRound = 5): ProfileRun {
  const weights = PROFILES[profile];
  let centralPolicy = createInitialPolicy();
  const rounds: RoundResult[] = [];

  for (let round = 1; round <= roundCount; round++) {
    const epsilon = epsilonForRound(round);
    const snapshot = clonePolicy(centralPolicy);
    const centralBeforeEpisodes = JSON.stringify(centralPolicy);
    const episodes = Array.from({ length: robotsPerRound }, (_, index) => simulateEpisode(
      index + 1,
      snapshot,
      weights,
      createSeededRandom(episodeSeed(seed, round, index + 1)),
      epsilon,
    ));
    const centralPolicyUnchangedDuringEpisodes = JSON.stringify(centralPolicy) === centralBeforeEpisodes;
    const { policy: updatedPolicy, changes } = updatePolicy(centralPolicy, episodes);
    centralPolicy = updatedPolicy;
    rounds.push({
      round,
      epsilon,
      snapshot,
      snapshotSignatures: episodes.map((episode) => episode.snapshotSignature),
      centralPolicyUnchangedDuringEpisodes,
      episodes,
      changes,
      policyAfter: clonePolicy(centralPolicy),
      nextProbabilities: probabilityTable(centralPolicy, epsilonForRound(Math.min(round + 1, roundCount))),
      updateCount: 1,
    });
  }

  const episodes = rounds.flatMap((round) => round.episodes);
  const count = episodes.length;
  const average = (pick: (episode: EpisodeExperience) => number): number =>
    episodes.reduce((sum, episode) => sum + pick(episode), 0) / count;
  return {
    profile,
    seed,
    rounds,
    finalPolicy: centralPolicy,
    finalProbabilities: probabilityTable(centralPolicy, epsilonForRound(roundCount)),
    summary: {
      successRate: average((episode) => Number(episode.terminalReason === 'GOAL_REACHED')),
      timeoutRate: average((episode) => Number(episode.terminalReason === 'TIMEOUT')),
      misunderstandingRate: average((episode) => Number(episode.terminalReason === 'CITIZEN_MISUNDERSTANDING')),
      avgElapsedTime: average((episode) => episode.elapsedTime),
      avgCitizenRisk: average((episode) => episode.citizenRiskCount),
      avgFacilityDamage: average((episode) => episode.facilityDamageCount),
      avgExperienceScore: average((episode) => episode.reward.experienceScore),
    },
  };
}
