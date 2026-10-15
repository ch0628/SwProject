export const ACTIONS = {
  ROUTE_CHOICE: ['FAST_SHORTCUT', 'SAFE_CORRIDOR', 'NORMAL_STAIRS', 'ELEVATOR'],
  OBSTACLE: ['DETOUR', 'CLEAR', 'PUSH'],
  CITIZEN_NEARBY: ['WIDE_DETOUR', 'SLOW_PASS', 'WAIT', 'FAST_PASS'],
  AMBIGUOUS_PERSON: ['OBSERVE', 'BYPASS', 'TRACK', 'SUBDUE'],
  VILLAIN_ENCOUNTER: ['SUBDUE', 'FORCE_PASS', 'DISTRACT', 'BYPASS', 'RETREAT'],
  BOSS_ENCOUNTER: ['SUBDUE', 'RETREAT'],
} as const;

export type DecisionState = keyof typeof ACTIONS;
export type SimulationState = 'MOVING' | DecisionState;
export type Action = (typeof ACTIONS)[DecisionState][number] | `ACTUAL_ROUTE:${string}`;
export type TerminalReason = 'GOAL_REACHED' | 'MISUNDERSTANDING' | 'TIMEOUT' | 'ROBOT_DISABLED';
export type EventType = TerminalReason
  | 'CITIZEN_RISK'
  | 'FACILITY_DAMAGE'
  | 'BLOCKED'
  | 'MOBILITY_DAMAGE'
  | 'ROBOT_DAMAGE'
  | 'VILLAIN_NEUTRALIZED'
  | 'BOSS_DISTRACTED'
  | 'BOSS_NEUTRALIZED'
  | 'NO_BOSS'
  | 'SECURITY_LOCK_OPEN'
  | 'SYSTEM_RESTORED';

export const ACTION_TIME = { VERY_SMALL: 1, SMALL: 2, MEDIUM: 4, LARGE: 6 } as const;
export const ROUTE_TRAITS = { NONE: 0, LOW: 0.25, MEDIUM: 0.50, HIGH: 0.75 } as const;
export const ENCOUNTER_RATES = { LOW: 0.25, MEDIUM: 0.50, HIGH: 0.75, MANDATORY: 1 } as const;
export const PRODUCTION_ENCOUNTER_ENVIRONMENT_V1 = {
  villain1Subdue: 0.90,
  villain2Subdue: 0.80,
  bossSubdue: 0.80,
  bossDistractedSubdue: 0.95,
  villainDistract: 1.00,
} as const;

export type RewardWeights = {
  goal: number;
  speed: number;
  judgment: number;
  threat: number;
};

export const REWARD_STAR_FIELDS = ['speed', 'judgment', 'threat'] as const;
export type RewardStarField = (typeof REWARD_STAR_FIELDS)[number];
export type RewardStars = Record<RewardStarField, number>;
export const REWARD_STAR_TOTAL = 6;
export const REWARD_STAR_TO_WEIGHT = [0, 1, 2.5, 5] as const;
export const FIXED_GOAL_REWARD_WEIGHT = 3;
export const DEFAULT_REWARD_STARS: RewardStars = {
  speed: 2,
  judgment: 2,
  threat: 2,
};

export function assertRewardStars(stars: RewardStars): void {
  const keys = Object.keys(stars);
  if (keys.length !== REWARD_STAR_FIELDS.length || REWARD_STAR_FIELDS.some(field => !keys.includes(field))) {
    throw new Error('Reward stars must contain exactly three user-selectable fields');
  }
  if (REWARD_STAR_FIELDS.some(field => !Number.isInteger(stars[field]) || stars[field] < 0 || stars[field] > 3)) {
    throw new Error('Reward stars must be integers from 0 to 3');
  }
  if (REWARD_STAR_FIELDS.reduce((sum, field) => sum + stars[field], 0) !== REWARD_STAR_TOTAL) {
    throw new Error(`Reward stars must total exactly ${REWARD_STAR_TOTAL}`);
  }
}

export function rewardWeightsFromStars(stars: RewardStars): RewardWeights {
  assertRewardStars(stars);
  return {
    goal: FIXED_GOAL_REWARD_WEIGHT,
    speed: REWARD_STAR_TO_WEIGHT[stars.speed],
    judgment: REWARD_STAR_TO_WEIGHT[stars.judgment],
    threat: REWARD_STAR_TO_WEIGHT[stars.threat],
  };
}

export const PROFILES = {
  SAFE: { goal: 3, speed: 1, judgment: 5, threat: 1 },
  FAST: { goal: 3, speed: 5, judgment: 1, threat: 0 },
  BALANCED: { goal: 3, speed: 2.5, judgment: 2.5, threat: 2.5 },
} as const satisfies Record<string, RewardWeights>;

export const FIXED_ROBOT_DAMAGE_COST = 0.8;
export const FIXED_ROBOT_DISABLED_PENALTY = 2.5;
export type FixedRewardCosts = { robotDamage: number; robotDisabled: number };
export const DEFAULT_FIXED_REWARD_COSTS: FixedRewardCosts = {
  robotDamage: FIXED_ROBOT_DAMAGE_COST,
  robotDisabled: FIXED_ROBOT_DISABLED_PENALTY,
};

export type ProfileName = keyof typeof PROFILES;
export type Policy = Record<DecisionState, Record<string, number>>;

export type ActionExperience = {
  state: DecisionState;
  action: Action;
  location?: string;
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
  robotDamageAfter?: number;
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
  judgmentValue: number;
  neutralizationValue: number;
  robotDamageCost: number;
  robotDisabledCost: number;
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
  successfulNeutralizations: number;
  robotDamage: number;
  combatExperience: number;
  combatSkillSnapshot: number;
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
  navigationPolyline: readonly { x: number; y: number }[];
  citizenExposure: number;
  obstacleChance: number;
  ambiguousPersonChance: number;
  narrowness: number;
};

const ROUTES: Record<string, Route> = {
  FAST_SHORTCUT: { navigationPolyline: [{ x: 0, y: 0 }, { x: 160, y: 0 }], citizenExposure: ROUTE_TRAITS.HIGH, obstacleChance: ROUTE_TRAITS.MEDIUM, ambiguousPersonChance: ROUTE_TRAITS.LOW, narrowness: ROUTE_TRAITS.HIGH },
  SAFE_CORRIDOR: { navigationPolyline: [{ x: 0, y: 0 }, { x: 352, y: 0 }], citizenExposure: ROUTE_TRAITS.LOW, obstacleChance: ROUTE_TRAITS.LOW, ambiguousPersonChance: ROUTE_TRAITS.NONE, narrowness: ROUTE_TRAITS.NONE },
  NORMAL_STAIRS: { navigationPolyline: [{ x: 0, y: 0 }, { x: 256, y: 0 }], citizenExposure: ROUTE_TRAITS.MEDIUM, obstacleChance: ROUTE_TRAITS.MEDIUM, ambiguousPersonChance: ROUTE_TRAITS.LOW, narrowness: ROUTE_TRAITS.MEDIUM },
  ELEVATOR: { navigationPolyline: [{ x: 0, y: 0 }, { x: 224, y: 0 }], citizenExposure: ROUTE_TRAITS.MEDIUM, obstacleChance: ROUTE_TRAITS.LOW, ambiguousPersonChance: ROUTE_TRAITS.MEDIUM, narrowness: ROUTE_TRAITS.LOW },
};

export const EPSILON = 0.35;
export const LEARNING_RATE = 0.35;

export function navigationPolylineTime(points: readonly { x: number; y: number }[], tileSize = 32): number {
  if (points.length < 2) throw new Error('navigation polyline requires at least two points');
  if (!Number.isFinite(tileSize) || tileSize <= 0) throw new Error('tileSize must be positive');
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + Math.hypot(point.x - previous.x, point.y - previous.y) / tileSize;
  }, 0);
}

export function timeLimitFromSafeBaselines(safeSuccessfulBaselines: readonly number[]): number {
  if (safeSuccessfulBaselines.length === 0 || safeSuccessfulBaselines.some(value => !Number.isFinite(value) || value < 0)) {
    throw new Error('safe successful baselines must contain finite non-negative values');
  }
  return Math.max(...safeSuccessfulBaselines) * 1.25;
}

// Mock-only fixture until actual navigation graph baselines replace it during Map Integration.
export const MOCK_TIME_LIMIT = timeLimitFromSafeBaselines([
  2 * navigationPolylineTime(ROUTES.SAFE_CORRIDOR.navigationPolyline)
    + 2 * ACTION_TIME.LARGE
    + 2 * ACTION_TIME.LARGE
    + 2 * ACTION_TIME.SMALL,
]);

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

export function episodeSeed(seed: number, round: number, robot: number): number {
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

export function normalizeReward(rawReward: number, weights: RewardWeights, fixedCosts = DEFAULT_FIXED_REWARD_COSTS): number {
  if (!Number.isFinite(rawReward)) throw new Error('rawReward must be finite');
  const positiveMaximum = weights.goal + weights.threat;
  const negativeMagnitude = weights.goal + weights.speed + weights.judgment
    + fixedCosts.robotDamage + fixedCosts.robotDisabled;
  const score = rawReward >= 0
    ? 50 + 50 * (positiveMaximum === 0 ? 0 : rawReward / positiveMaximum)
    : 50 + 50 * (negativeMagnitude === 0 ? 0 : rawReward / negativeMagnitude);
  return clamp(score, 0, 100);
}

export function evaluateEpisode(
  episode: Pick<EpisodeExperience, 'goalReached' | 'elapsedTime' | 'citizenMisunderstanding' | 'terminalReason'>
    & Partial<Pick<EpisodeExperience, 'successfulNeutralizations' | 'robotDamage'>>,
  weights: RewardWeights,
  timeLimit = MOCK_TIME_LIMIT,
  fixedCosts = DEFAULT_FIXED_REWARD_COSTS,
): RewardBreakdown {
  const goalValue = episode.terminalReason === 'GOAL_REACHED' ? 1 : 0;
  const speedValue = clamp(episode.elapsedTime / timeLimit, 0, 1);
  const judgmentValue = episode.citizenMisunderstanding ? 1 : 0;
  const neutralizationValue = clamp((episode.successfulNeutralizations ?? 0) / 5, 0, 1);
  const robotDamageCost = fixedCosts.robotDamage * clamp(episode.robotDamage ?? 0, 0, 1);
  const robotDisabledCost = episode.terminalReason === 'ROBOT_DISABLED' ? fixedCosts.robotDisabled : 0;
  const rawReward = weights.goal * goalValue
    - weights.speed * speedValue
    - weights.judgment * judgmentValue
    + weights.threat * neutralizationValue
    - robotDamageCost
    - robotDisabledCost;
  const experienceScore = normalizeReward(rawReward, weights, fixedCosts);
  return {
    goalValue,
    speedValue,
    judgmentValue,
    neutralizationValue,
    robotDamageCost,
    robotDisabledCost,
    rawReward,
    experienceScore,
    episodeReturn: (experienceScore - 50) / 50,
  };
}

export function isTerminalEvent(event: EventType): event is TerminalReason {
  return event === 'GOAL_REACHED' || event === 'MISUNDERSTANDING' || event === 'TIMEOUT' || event === 'ROBOT_DISABLED';
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
  robotDamageDelta = 0,
  action?: Action,
  fixedCosts = DEFAULT_FIXED_REWARD_COSTS,
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
    add(weights.speed, scaledOutcome(elapsedCost, ACTION_TIME.SMALL, ACTION_TIME.LARGE));
  }
  if (state === 'CITIZEN_NEARBY') {
    add(weights.speed, scaledOutcome(elapsedCost, 0.5, 5));
  }
  if (state === 'AMBIGUOUS_PERSON') {
    add(weights.speed, scaledOutcome(elapsedCost, ACTION_TIME.VERY_SMALL, ACTION_TIME.LARGE));
    add(weights.judgment, immediateEvents.includes('MISUNDERSTANDING') ? -1 : action === 'TRACK' ? 1 : action === 'OBSERVE' ? 0.5 : 0);
  }
  if (state === 'VILLAIN_ENCOUNTER' || state === 'BOSS_ENCOUNTER') {
    add(weights.threat, immediateEvents.includes('VILLAIN_NEUTRALIZED') || immediateEvents.includes('BOSS_NEUTRALIZED') ? 1 : -0.25);
  }
  if (robotDamageDelta > 0) add(fixedCosts.robotDamage, -robotDamageDelta);
  if (immediateEvents.includes('ROBOT_DISABLED')) add(fixedCosts.robotDisabled, -1);
  return denominator === 0 ? 0 : clamp(numerator / denominator, -1, 1);
}

export function calculateSegmentReturn(
  elapsedCost: number,
  events: readonly EventType[],
  weights: RewardWeights,
  fixedCosts = DEFAULT_FIXED_REWARD_COSTS,
): number {
  let numerator = 0;
  let denominator = 0;
  const add = (weight: number, outcome: number): void => {
    if (weight > 0) {
      numerator += weight * outcome;
      denominator += weight;
    }
  };
  add(weights.speed, scaledOutcome(elapsedCost, 40, 100));
  add(weights.judgment, events.includes('MISUNDERSTANDING') ? -1 : 1);
  add(weights.threat, events.includes('VILLAIN_NEUTRALIZED') || events.includes('BOSS_NEUTRALIZED') ? 1 : 0);
  add(fixedCosts.robotDisabled, events.includes('ROBOT_DISABLED') ? -1 : 1);
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

export type EncounterResolution = {
  elapsedCost: number;
  events: EventType[];
  localOutcome: string;
  passed: boolean;
  retry: boolean;
  neutralized: boolean;
  mobilityDamaged: boolean;
  robotDamageDelta?: number;
  combatExperience?: number;
};

export type VillainResolutionOptions = {
  bypassAvailable?: boolean;
  bypassTimeCost?: number;
  retreatTimeCost?: number;
  subdueSuccessByCount?: Readonly<Record<1 | 2, number>>;
  distractPassSuccess?: number;
  combatSkill?: number;
  combatSkillBonus?: number;
  distractSuccessDamage?: number;
  distractFailureDamage?: number;
  forcePassSuccessDamage?: number;
  forcePassFailureDamage?: number;
  subdueSuccessDamage?: number;
};

export type BossResolutionOptions = {
  baseSubdueSuccess?: number;
  distractedSubdueSuccess?: number;
  combatSkill?: number;
  combatSkillBonus?: number;
  subdueSuccessDamage?: number;
};

const validProbability = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1`);
  return value;
};

export function createEncounterDecider(seed: number) {
  const random = createSeededRandom(seed);
  const cache = new Map<string, boolean>();
  return (zoneId: string, rate: keyof typeof ENCOUNTER_RATES | number): boolean => {
    if (!zoneId) throw new Error('zoneId is required');
    const probability = typeof rate === 'number' ? rate : ENCOUNTER_RATES[rate];
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error('encounter probability must be between 0 and 1');
    if (!cache.has(zoneId)) cache.set(zoneId, probability === 1 || random() < probability);
    return cache.get(zoneId)!;
  };
}

export function resolveObstacle(
  action: (typeof ACTIONS.OBSTACLE)[number],
  roll = 0,
  detourAvailable = true,
): EncounterResolution {
  if (action === 'DETOUR' && !detourAvailable) throw new Error('DETOUR is unavailable without an alternate route');
  if (action === 'DETOUR') return { elapsedCost: ACTION_TIME.LARGE, events: [], localOutcome: 'SAFE_PASS', passed: true, retry: false, neutralized: false, mobilityDamaged: false };
  if (action === 'CLEAR') return { elapsedCost: ACTION_TIME.MEDIUM, events: [], localOutcome: 'OBSTACLE_CLEARED', passed: true, retry: false, neutralized: false, mobilityDamaged: false };
  if (roll < 0.70) return { elapsedCost: ACTION_TIME.SMALL, events: [], localOutcome: 'CLEAN_PASS', passed: true, retry: false, neutralized: false, mobilityDamaged: false };
  if (roll < 0.95) return { elapsedCost: ACTION_TIME.SMALL, events: ['FACILITY_DAMAGE'], localOutcome: 'FACILITY_DAMAGE', passed: true, retry: false, neutralized: false, mobilityDamaged: false };
  return { elapsedCost: ACTION_TIME.SMALL + ACTION_TIME.SMALL, events: ['BLOCKED'], localOutcome: 'BLOCKED', passed: false, retry: true, neutralized: false, mobilityDamaged: false };
}

export function availableVillainActions(bypassAvailable: boolean): readonly (typeof ACTIONS.VILLAIN_ENCOUNTER)[number][] {
  return bypassAvailable ? ACTIONS.VILLAIN_ENCOUNTER : ACTIONS.VILLAIN_ENCOUNTER.filter(action => action !== 'BYPASS');
}

export function resolveVillainEncounter(
  villainCount: 1 | 2,
  action: (typeof ACTIONS.VILLAIN_ENCOUNTER)[number],
  roll = 0,
  options: VillainResolutionOptions = {},
): EncounterResolution {
  if (!availableVillainActions(options.bypassAvailable ?? false).includes(action)) throw new Error(`${action} is unavailable`);
  if (action === 'SUBDUE') {
    const baseProbability = options.subdueSuccessByCount?.[villainCount]
      ?? (villainCount === 1 ? PRODUCTION_ENCOUNTER_ENVIRONMENT_V1.villain1Subdue : PRODUCTION_ENCOUNTER_ENVIRONMENT_V1.villain2Subdue);
    const successThreshold = clamp(validProbability(baseProbability, 'villain SUBDUE success') + (options.combatSkill ?? 0) * (options.combatSkillBonus ?? 0), 0, 1);
    const success = roll < successThreshold;
    return success
      ? { elapsedCost: ACTION_TIME.VERY_SMALL, events: ['VILLAIN_NEUTRALIZED'], localOutcome: 'VILLAIN_NEUTRALIZED', passed: true, retry: false, neutralized: true, mobilityDamaged: false, robotDamageDelta: options.subdueSuccessDamage ?? 0, combatExperience: 1 }
      : { elapsedCost: ACTION_TIME.VERY_SMALL, events: ['ROBOT_DISABLED'], localOutcome: 'ROBOT_DISABLED', passed: false, retry: false, neutralized: false, mobilityDamaged: false, robotDamageDelta: 1, combatExperience: 0.6 };
  }
  if (action === 'FORCE_PASS') {
    const passThreshold = villainCount === 1 ? 0.70 : 0.50;
    const blockedThreshold = villainCount === 1 ? 0.90 : 0.80;
    if (roll < passThreshold) return { elapsedCost: ACTION_TIME.SMALL, events: [], localOutcome: 'PASS', passed: true, retry: false, neutralized: false, mobilityDamaged: false, robotDamageDelta: options.forcePassSuccessDamage ?? 0.25 };
    if (roll < blockedThreshold) return { elapsedCost: ACTION_TIME.SMALL + 3, events: ['BLOCKED'], localOutcome: 'BLOCKED', passed: false, retry: true, neutralized: false, mobilityDamaged: false, robotDamageDelta: options.forcePassFailureDamage ?? 0.4 };
    return { elapsedCost: ACTION_TIME.SMALL, events: ['MOBILITY_DAMAGE'], localOutcome: 'MOBILITY_DAMAGE', passed: true, retry: false, neutralized: false, mobilityDamaged: true, robotDamageDelta: options.forcePassFailureDamage ?? 0.4 };
  }
  if (action === 'DISTRACT') {
    const passed = roll < validProbability(options.distractPassSuccess ?? PRODUCTION_ENCOUNTER_ENVIRONMENT_V1.villainDistract, 'villain DISTRACT success');
    return { elapsedCost: ACTION_TIME.MEDIUM, events: passed ? [] : ['BLOCKED'], localOutcome: passed ? 'PASS' : 'BLOCKED', passed, retry: !passed, neutralized: false, mobilityDamaged: false, robotDamageDelta: passed ? (options.distractSuccessDamage ?? 0.05) : (options.distractFailureDamage ?? 0.15) };
  }
  if (action === 'BYPASS') return { elapsedCost: options.bypassTimeCost ?? ACTION_TIME.LARGE, events: [], localOutcome: 'SAFE_BYPASS', passed: true, retry: false, neutralized: false, mobilityDamaged: false };
  return { elapsedCost: options.retreatTimeCost ?? 0, events: [], localOutcome: 'RETREAT', passed: false, retry: false, neutralized: false, mobilityDamaged: false };
}

export function consumeMobilityDamage(baseMovementTime: number, mobilityDamaged: boolean) {
  return { elapsedCost: baseMovementTime * (mobilityDamaged ? 1.35 : 1), mobilityDamaged: false };
}

export function resolveBossEncounter(
  action: (typeof ACTIONS.BOSS_ENCOUNTER)[number],
  roll = 0,
  distracted = false,
  retreatTimeCost = 0,
  options: BossResolutionOptions = {},
): EncounterResolution {
  if (action === 'SUBDUE') {
    const baseProbability = distracted
      ? validProbability(options.distractedSubdueSuccess ?? PRODUCTION_ENCOUNTER_ENVIRONMENT_V1.bossDistractedSubdue, 'distracted Boss SUBDUE success')
      : validProbability(options.baseSubdueSuccess ?? PRODUCTION_ENCOUNTER_ENVIRONMENT_V1.bossSubdue, 'Boss SUBDUE success');
    const successThreshold = clamp(baseProbability + (options.combatSkill ?? 0) * (options.combatSkillBonus ?? 0), 0, 1);
    const success = roll < successThreshold;
    return success
      ? { elapsedCost: ACTION_TIME.VERY_SMALL, events: ['BOSS_NEUTRALIZED'], localOutcome: 'BOSS_NEUTRALIZED', passed: true, retry: false, neutralized: true, mobilityDamaged: false, robotDamageDelta: options.subdueSuccessDamage ?? 0, combatExperience: 1 }
      : { elapsedCost: ACTION_TIME.VERY_SMALL, events: ['ROBOT_DISABLED'], localOutcome: 'ROBOT_DISABLED', passed: false, retry: false, neutralized: false, mobilityDamaged: false, robotDamageDelta: 1, combatExperience: 0.6 };
  }
  return { elapsedCost: retreatTimeCost, events: [], localOutcome: 'RETREAT_TO_SEARCH', passed: false, retry: false, neutralized: false, mobilityDamaged: false };
}

export function resolveAmbiguousPerson(
  actualType: 'CITIZEN' | 'VILLAIN',
  action: (typeof ACTIONS.AMBIGUOUS_PERSON)[number],
  cumulativeTrackTime = 0,
): { elapsedCost: number; events: EventType[]; localOutcome: string; cumulativeTrackTime: number } {
  const costs: Record<string, number> = { OBSERVE: ACTION_TIME.SMALL, BYPASS: ACTION_TIME.SMALL, TRACK: 3, SUBDUE: ACTION_TIME.VERY_SMALL };
  const elapsedCost = costs[action] ?? 0;
  const nextTrackTime = cumulativeTrackTime + (action === 'TRACK' ? elapsedCost : 0);
  const misunderstanding = actualType === 'CITIZEN' && action === 'SUBDUE';
  return {
    elapsedCost,
    events: misunderstanding ? ['MISUNDERSTANDING'] : [],
    localOutcome: misunderstanding ? 'MISIDENTIFIED_CITIZEN' : action === 'TRACK' && nextTrackTime >= 6 ? `CONFIRMED_${actualType}` : `${actualType}_${action}`,
    cumulativeTrackTime: nextTrackTime,
  };
}

function simulateEpisode(
  robot: number,
  policySnapshot: Policy,
  weights: RewardWeights,
  seed: number,
  epsilon: number,
  timeLimit: number,
): EpisodeExperience {
  const random = createSeededRandom(seed);
  const encounterOccurs = createEncounterDecider(seed ^ 0xa5a5a5a5);
  let elapsedTime = 0;
  let facilityDamageCount = 0;
  let citizenRiskCount = 0;
  let citizenMisunderstanding = false;
  let successfulNeutralizations = 0;
  let terminalReason: TerminalReason | undefined;
  const actionHistory: ActionExperience[] = [];
  const eventHistory: EventRecord[] = [];
  const snapshotSignature = JSON.stringify(policySnapshot);

  const recordEvent = (type: EventType, location: string, causedBy: Action | 'ENVIRONMENT'): void => {
    eventHistory.push({ type, elapsedTime: roundNumber(elapsedTime), location, causedBy });
    if (type === 'FACILITY_DAMAGE') facilityDamageCount++;
    if (type === 'CITIZEN_RISK') citizenRiskCount++;
    if (type === 'MISUNDERSTANDING') {
      citizenMisunderstanding = true;
      terminalReason = type;
    }
    if (type === 'ROBOT_DISABLED') terminalReason = type;
  };

  const finishIfTimedOut = (location: string): boolean => {
    if (!terminalReason && elapsedTime >= timeLimit) {
      elapsedTime = timeLimit;
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
      localReturn: state === 'ROUTE_CHOICE' ? 0 : calculateLocalReturn(state, elapsedCost, immediateEvents, weights, 0, action),
      actionCredit: 0,
    });
  };

  for (let leg = 1; leg <= 2 && !terminalReason; leg++) {
    const routeAction = chooseAction(policySnapshot, 'ROUTE_CHOICE', ACTIONS.ROUTE_CHOICE, random, epsilon);
    const route = ROUTES[routeAction];
    recordAction('ROUTE_CHOICE', routeAction, navigationPolylineTime(route.navigationPolyline), [], 'MOVING');
    const routeExperience = actionHistory.at(-1)!;
    routeExperience.routeContext = 'MOCK_ROUTE_CONTEXT';
    routeExperience.routeOptions = [...ACTIONS.ROUTE_CHOICE];
    if (finishIfTimedOut(`LEG_${leg}`)) break;

    if (encounterOccurs(`LEG_${leg}_OBSTACLE`, route.obstacleChance)) {
      let retry: boolean;
      do {
        const action = chooseAction(policySnapshot, 'OBSTACLE', ACTIONS.OBSTACLE, random, epsilon) as (typeof ACTIONS.OBSTACLE)[number];
        const resolution = resolveObstacle(action, random());
        recordAction('OBSTACLE', action, resolution.elapsedCost, resolution.events, resolution.localOutcome);
        retry = resolution.retry;
        if (finishIfTimedOut(`LEG_${leg}_OBSTACLE`)) break;
      } while (retry);
      if (terminalReason) break;
    }

    if (encounterOccurs(`LEG_${leg}_CITIZEN`, route.citizenExposure) && !terminalReason) {
      const action = chooseAction(policySnapshot, 'CITIZEN_NEARBY', ACTIONS.CITIZEN_NEARBY, random, epsilon);
      const costs: Record<string, number> = { WIDE_DETOUR: ACTION_TIME.LARGE, SLOW_PASS: ACTION_TIME.MEDIUM, WAIT: ACTION_TIME.MEDIUM, FAST_PASS: ACTION_TIME.VERY_SMALL };
      const riskChances: Record<string, number> = { WIDE_DETOUR: 0.02, SLOW_PASS: 0.10, WAIT: 0, FAST_PASS: 0.80 };
      const cost = costs[action] ?? 0;
      const riskChance = riskChances[action] ?? 0;
      const risk = random() < riskChance;
      recordAction('CITIZEN_NEARBY', action, cost, risk ? ['CITIZEN_RISK'] : [], risk ? 'RISKED_CITIZEN' : 'PASSED_SAFELY');
      if (finishIfTimedOut(`LEG_${leg}_CITIZEN`)) break;
    }

    if (encounterOccurs(`LEG_${leg}_AMBIGUOUS`, route.ambiguousPersonChance) && !terminalReason) {
      const actualType = random() < 0.60 ? 'CITIZEN' : 'VILLAIN';
      const action = chooseAction(policySnapshot, 'AMBIGUOUS_PERSON', ACTIONS.AMBIGUOUS_PERSON, random, epsilon) as (typeof ACTIONS.AMBIGUOUS_PERSON)[number];
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
    successfulNeutralizations,
    robotDamage: 0,
    combatExperience: 0,
    combatSkillSnapshot: 0,
    terminalReason,
    actionHistory,
    eventHistory,
    snapshotSignature,
  };
  const reward = evaluateEpisode(baseEpisode, weights, timeLimit);
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

export function runProfile(profile: ProfileName, seed = 42, roundCount = 3, robotsPerRound = 5, timeLimit = MOCK_TIME_LIMIT): ProfileRun {
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
      episodeSeed(seed, round, index + 1),
      epsilon,
      timeLimit,
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
      misunderstandingRate: average((episode) => Number(episode.terminalReason === 'MISUNDERSTANDING')),
      avgElapsedTime: average((episode) => episode.elapsedTime),
      avgCitizenRisk: average((episode) => episode.citizenRiskCount),
      avgFacilityDamage: average((episode) => episode.facilityDamageCount),
      avgExperienceScore: average((episode) => episode.reward.experienceScore),
    },
  };
}
