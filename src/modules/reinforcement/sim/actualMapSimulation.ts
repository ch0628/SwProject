import {
  ACTIONS,
  ACTION_TIME,
  PROFILES,
  PRODUCTION_ENCOUNTER_ENVIRONMENT_V1,
  availableVillainActions,
  calculateActionCredit,
  calculateLocalReturn,
  calculateSegmentReturn,
  chooseAction,
  clonePolicy,
  consumeMobilityDamage,
  createEncounterDecider,
  createInitialPolicy,
  createSeededRandom,
  episodeSeed,
  epsilonForRound,
  evaluateEpisode,
  resolveAmbiguousPerson,
  resolveBossEncounter,
  resolveObstacle,
  resolveVillainEncounter,
  softmaxWithExploration,
  updatePolicy,
  type Action,
  type ActionExperience,
  type DecisionState,
  type EpisodeExperience,
  type EventRecord,
  type EventType,
  type Policy,
  type PreferenceChange,
  type ProfileName,
  type TerminalReason,
} from './learningEngine.ts';
import {
  F5_ROOMS,
  f5SearchContext,
  type ActualEncounterZone,
  type ActualMapEnvironment,
  type ActualRouteContext,
  type ActualRouteOption,
  type EncounterKind,
  type F5Room,
  type F5RoomPath,
} from './actualMapEnvironment.ts';

const roundNumber = (value: number): number => Number(value.toFixed(6));

export type ActualEnvironmentParameters = {
  villain1Subdue: number;
  villain2Subdue: number;
  bossSubdue: number;
  bossDistractedSubdue: number;
  villainDistract: number;
};

export const ACTUAL_ENVIRONMENT_PRODUCTION_V1: ActualEnvironmentParameters = PRODUCTION_ENCOUNTER_ENVIRONMENT_V1;

export type VillainDiagnostic = {
  zoneId: string;
  villainCount: 1 | 2;
  action: (typeof ACTIONS.VILLAIN_ENCOUNTER)[number];
  outcome: string;
};

export type ActualEpisodeMetrics = {
  reachedFloors: number[];
  routeChoices: string[];
  encounterTriggers: Record<EncounterKind, number>;
  villainDiagnostics: VillainDiagnostic[];
  obstacleActions: number;
  citizenActions: number;
  ambiguousActions: number;
  villainActions: number;
  bossActions: number;
  bossRoom: F5Room;
  searchedRooms: F5Room[];
  roomsSearchedBeforeBoss: number;
  guardNeutralizations: number;
  bossNeutralized: boolean;
  controlRoomReached: boolean;
  systemRestored: boolean;
  hiddenBossExposedToPolicy: false;
};

export type ActualEpisode = EpisodeExperience & { actual: ActualEpisodeMetrics };

export type ActualRound = {
  round: number;
  epsilon: number;
  snapshot: Policy;
  snapshotSignatures: string[];
  centralPolicyUnchangedDuringEpisodes: boolean;
  episodes: ActualEpisode[];
  changes: PreferenceChange[];
  policyAfter: Policy;
  updateCount: 1;
};

export type ActualRun = {
  profile: ProfileName;
  seed: number;
  rounds: ActualRound[];
  finalPolicy: Policy;
  summary: ReturnType<typeof summarizeActualRun>;
};

function actualInitialPolicy(environment: ActualMapEnvironment): Policy {
  const policy = createInitialPolicy();
  policy.ROUTE_CHOICE = Object.fromEntries([
    ...environment.contexts.flatMap(context => context.options.map(option => [option.action, 0] as const)),
    ...environment.f5Rooms.map(room => [room.action, 0] as const),
  ]);
  return policy;
}

function simulateActualEpisode(
  robot: number,
  policy: Policy,
  profile: ProfileName,
  seed: number,
  epsilon: number,
  environment: ActualMapEnvironment,
  parameters: ActualEnvironmentParameters,
): ActualEpisode {
  const weights = PROFILES[profile];
  const random = createSeededRandom(seed);
  const encounterOccurs = createEncounterDecider(seed ^ 0xa5a5a5a5);
  const identityRandom = createSeededRandom(seed ^ 0x51ed270b);
  const identities = new Map<string, 'CITIZEN' | 'VILLAIN'>();
  const bossRoom = F5_ROOMS[Math.floor(createSeededRandom(seed ^ 0xb055b055)() * F5_ROOMS.length)];
  let elapsedTime = 0;
  let facilityDamageCount = 0;
  let citizenRiskCount = 0;
  let citizenMisunderstanding = false;
  let terminalReason: TerminalReason | undefined;
  let mobilityDamaged = false;
  const actionHistory: ActionExperience[] = [];
  const eventHistory: EventRecord[] = [];
  const handledZones = new Set<string>();
  const trackTime = new Map<string, number>();
  const snapshotSignature = JSON.stringify(policy);
  const actual: ActualEpisodeMetrics = {
    reachedFloors: [1], routeChoices: [], encounterTriggers: { OBSTACLE: 0, CITIZEN_NEARBY: 0, AMBIGUOUS_PERSON: 0, VILLAIN_ENCOUNTER: 0 }, villainDiagnostics: [], obstacleActions: 0, citizenActions: 0,
    ambiguousActions: 0, villainActions: 0, bossActions: 0, bossRoom,
    searchedRooms: [], roomsSearchedBeforeBoss: 0, guardNeutralizations: 0,
    bossNeutralized: false, controlRoomReached: false, systemRestored: false, hiddenBossExposedToPolicy: false,
  };

  const recordEvent = (type: EventType, location: string, causedBy: Action | 'ENVIRONMENT'): void => {
    eventHistory.push({ type, elapsedTime: roundNumber(elapsedTime), location, causedBy });
    if (type === 'FACILITY_DAMAGE') facilityDamageCount++;
    if (type === 'CITIZEN_RISK') citizenRiskCount++;
    if (type === 'CITIZEN_MISUNDERSTANDING') {
      citizenMisunderstanding = true;
      terminalReason = type;
    }
    if (type === 'ROBOT_DISABLED') terminalReason = type;
  };

  const finishIfTimedOut = (location: string): boolean => {
    if (!terminalReason && elapsedTime >= environment.timeLimit) {
      elapsedTime = environment.timeLimit;
      terminalReason = 'TIMEOUT';
      recordEvent('TIMEOUT', location, 'ENVIRONMENT');
    }
    return terminalReason === 'TIMEOUT';
  };

  const recordAction = (state: DecisionState, action: Action, elapsedCost: number, events: EventType[], outcome: string, location: string): ActionExperience => {
    elapsedTime += elapsedCost;
    for (const event of events) recordEvent(event, location, action);
    const experience: ActionExperience = {
      state, action, elapsedCost, immediateEvents: events, localOutcome: outcome,
      localReturn: state === 'ROUTE_CHOICE' ? 0 : calculateLocalReturn(state, elapsedCost, events, weights),
      actionCredit: 0,
    };
    actionHistory.push(experience);
    finishIfTimedOut(location);
    return experience;
  };

  const addEnvironmentalCost = (experience: ActionExperience, cost: number, location: string): void => {
    elapsedTime += cost;
    experience.elapsedCost += cost;
    finishIfTimedOut(location);
  };

  const actualType = (zoneId: string): 'CITIZEN' | 'VILLAIN' => {
    if (!identities.has(zoneId)) identities.set(zoneId, identityRandom() < 0.60 ? 'CITIZEN' : 'VILLAIN');
    return identities.get(zoneId)!;
  };

  const processZone = (zone: ActualEncounterZone, option: ActualRouteOption | F5RoomPath): 'PASS' | 'RETREAT' | 'TERMINAL' => {
    if (handledZones.has(zone.id) || !encounterOccurs(zone.id, zone.rate)) return 'PASS';
    actual.encounterTriggers[zone.kind]++;
    const detourAvailable = 'detourAvailable' in option && option.detourAvailable;
    if (zone.kind === 'OBSTACLE') {
      let retry = true;
      while (retry && !terminalReason) {
        const available = detourAvailable ? ACTIONS.OBSTACLE : ACTIONS.OBSTACLE.filter(action => action !== 'DETOUR');
        const action = chooseAction(policy, 'OBSTACLE', available, random, epsilon) as (typeof ACTIONS.OBSTACLE)[number];
        const resolution = resolveObstacle(action, random(), detourAvailable);
        recordAction('OBSTACLE', action, resolution.elapsedCost, resolution.events, resolution.localOutcome, zone.id);
        actual.obstacleActions++;
        retry = resolution.retry;
      }
      if (terminalReason) return 'TERMINAL';
      handledZones.add(zone.id);
      return 'PASS';
    }
    if (zone.kind === 'CITIZEN_NEARBY') {
      const action = chooseAction(policy, 'CITIZEN_NEARBY', ACTIONS.CITIZEN_NEARBY, random, epsilon);
      const costs: Record<string, number> = { WIDE_DETOUR: ACTION_TIME.LARGE, SLOW_PASS: ACTION_TIME.MEDIUM, WAIT: ACTION_TIME.MEDIUM, FAST_PASS: ACTION_TIME.VERY_SMALL };
      const risks: Record<string, number> = { WIDE_DETOUR: 0.02, SLOW_PASS: 0.10, WAIT: 0, FAST_PASS: 0.80 };
      const risk = random() < risks[action];
      recordAction('CITIZEN_NEARBY', action, costs[action], risk ? ['CITIZEN_RISK'] : [], risk ? 'RISKED_CITIZEN' : 'PASSED_SAFELY', zone.id);
      actual.citizenActions++;
      handledZones.add(zone.id);
      return terminalReason ? 'TERMINAL' : 'PASS';
    }
    if (zone.kind === 'AMBIGUOUS_PERSON') {
      let retry = true;
      while (retry && !terminalReason) {
        const action = chooseAction(policy, 'AMBIGUOUS_PERSON', ACTIONS.AMBIGUOUS_PERSON, random, epsilon) as (typeof ACTIONS.AMBIGUOUS_PERSON)[number];
        const resolution = resolveAmbiguousPerson(actualType(zone.id), action, trackTime.get(zone.id) ?? 0);
        trackTime.set(zone.id, resolution.cumulativeTrackTime);
        recordAction('AMBIGUOUS_PERSON', action, resolution.elapsedCost, resolution.events, resolution.localOutcome, zone.id);
        actual.ambiguousActions++;
        retry = action === 'TRACK' && !terminalReason;
      }
      if (!terminalReason) handledZones.add(zone.id);
      return terminalReason ? 'TERMINAL' : 'PASS';
    }

    const roomGuard = zone.floor === 5;
    while (!terminalReason) {
      const available = availableVillainActions(zone.bypassAvailable);
      const action = chooseAction(policy, 'VILLAIN_ENCOUNTER', available, random, epsilon) as (typeof ACTIONS.VILLAIN_ENCOUNTER)[number];
      const retreatTime = 'guardApproachTime' in option ? option.guardApproachTime : option.movementTime;
      const resolution = resolveVillainEncounter(zone.villainCount ?? 1, action, random(), {
        bypassAvailable: zone.bypassAvailable,
        bypassTimeCost: ACTION_TIME.LARGE,
        retreatTimeCost: retreatTime,
        subdueSuccessByCount: { 1: parameters.villain1Subdue, 2: parameters.villain2Subdue },
        distractPassSuccess: parameters.villainDistract,
      });
      actual.villainDiagnostics.push({ zoneId: zone.id, villainCount: zone.villainCount ?? 1, action, outcome: resolution.localOutcome });
      recordAction('VILLAIN_ENCOUNTER', action, resolution.elapsedCost, resolution.events, resolution.localOutcome, zone.id);
      actual.villainActions++;
      mobilityDamaged ||= resolution.mobilityDamaged;
      if (terminalReason) return 'TERMINAL';
      if (resolution.neutralized) {
        handledZones.add(zone.id);
        if (roomGuard) actual.guardNeutralizations++;
        return 'PASS';
      }
      if (action === 'RETREAT') return 'RETREAT';
      if (roomGuard) continue;
      if (resolution.passed) return 'PASS';
    }
    return 'TERMINAL';
  };

  const contextById = new Map(environment.contexts.map(context => [context.id, context]));
  let context: ActualRouteContext | undefined = contextById.get('F1_ENTRY_SPLIT');
  while (context && !terminalReason) {
    const actions = context.options.map(option => option.action);
    const action = chooseAction(policy, 'ROUTE_CHOICE', actions, random, epsilon) as ActualRouteOption['action'];
    const option = context.options.find(candidate => candidate.action === action)!;
    const movement = consumeMobilityDamage(option.movementTime, mobilityDamaged);
    mobilityDamaged = movement.mobilityDamaged;
    const routeExperience = recordAction('ROUTE_CHOICE', action, movement.elapsedCost, [], 'MOVING', option.id);
    routeExperience.routeContext = context.id;
    routeExperience.routeOptions = actions;
    actual.routeChoices.push(option.id);
    if (terminalReason) break;
    let outcome: 'PASS' | 'RETREAT' | 'TERMINAL' = 'PASS';
    for (const zoneId of option.encounterZoneIds) {
      outcome = processZone(environment.zones.find(zone => zone.id === zoneId)!, option);
      if (outcome !== 'PASS') break;
    }
    if (outcome === 'RETREAT') continue;
    if (outcome === 'TERMINAL') break;
    if (!actual.reachedFloors.includes(option.targetFloor)) actual.reachedFloors.push(option.targetFloor);
    if (option.targetFloor === 3) context = contextById.get('F3_STAIR_SPLIT');
    else if (option.targetFloor === 5) context = undefined;
    else {
      const spawn = environment.spawns.find(candidate => candidate.floor === option.targetFloor && candidate.id === option.targetSpawn)!;
      context = environment.contexts.find(candidate => candidate.floor === spawn.floor && candidate.startNodeId === spawn.nodeId);
    }
  }

  const searched = new Set<F5Room>();
  while (!terminalReason && searched.size < F5_ROOMS.length) {
    const remaining = F5_ROOMS.filter(room => !searched.has(room));
    const roomActions = environment.f5Rooms.filter(room => remaining.includes(room.room)).map(room => room.action);
    const action = chooseAction(policy, 'ROUTE_CHOICE', roomActions, random, epsilon) as F5RoomPath['action'];
    const roomPath = environment.f5Rooms.find(room => room.action === action)!;
    const movement = consumeMobilityDamage(roomPath.guardApproachTime, mobilityDamaged);
    mobilityDamaged = movement.mobilityDamaged;
    const routeExperience = recordAction('ROUTE_CHOICE', action, movement.elapsedCost, [], 'APPROACH_ROOM_GUARD', roomPath.room);
    routeExperience.routeContext = f5SearchContext(remaining);
    routeExperience.routeOptions = roomActions;
    actual.routeChoices.push(`F5_ROOM_${roomPath.room}`);
    if (terminalReason) break;
    const guard = environment.zones.find(zone => zone.id === roomPath.guardZoneId)!;
    const guardOutcome = processZone(guard, roomPath);
    if (guardOutcome === 'RETREAT') continue;
    if (guardOutcome === 'TERMINAL') break;
    const roomEntry = consumeMobilityDamage(roomPath.roomEntryTime, mobilityDamaged);
    mobilityDamaged = roomEntry.mobilityDamaged;
    addEnvironmentalCost(routeExperience, roomEntry.elapsedCost, roomPath.room);
    if (terminalReason) break;
    searched.add(roomPath.room);
    actual.searchedRooms.push(roomPath.room);
    if (roomPath.room !== bossRoom) {
      actual.roomsSearchedBeforeBoss++;
      recordEvent('NO_BOSS', roomPath.room, 'ENVIRONMENT');
      addEnvironmentalCost(routeExperience, environment.edges.find(edge => edge.id === roomPath.noBossReturnEdgeId)!.simulationTime, roomPath.room);
      continue;
    }

    let distracted = false;
    while (!terminalReason && !actual.bossNeutralized) {
      const bossAction = chooseAction(policy, 'BOSS_ENCOUNTER', ACTIONS.BOSS_ENCOUNTER, random, epsilon) as (typeof ACTIONS.BOSS_ENCOUNTER)[number];
      const retreatCost = environment.edges.find(edge => edge.id === roomPath.noBossReturnEdgeId)!.simulationTime + roomPath.movementTime;
      const resolution = resolveBossEncounter(bossAction, random(), distracted, retreatCost, {
        baseSubdueSuccess: parameters.bossSubdue,
        distractedSubdueSuccess: parameters.bossDistractedSubdue,
      });
      const bossExperience = recordAction('BOSS_ENCOUNTER', bossAction, resolution.elapsedCost, resolution.events, resolution.localOutcome, roomPath.room);
      actual.bossActions++;
      distracted ||= bossAction === 'DISTRACT';
      if (resolution.neutralized) {
        actual.bossNeutralized = true;
        const edgeTime = (id: string): number => environment.edges.find(edge => edge.id === id)!.simulationTime;
        addEnvironmentalCost(bossExperience, edgeTime(roomPath.postBossEdgeId) + edgeTime('E_F5_HALL_LOCK'), 'F5_SECURITY_LOCK');
        if (!terminalReason) recordEvent('SECURITY_LOCK_OPEN', 'F5_SECURITY_LOCK', 'ENVIRONMENT');
        if (!terminalReason) {
          addEnvironmentalCost(bossExperience, edgeTime('E_F5_LOCK_CONTROL'), 'F5_CONTROL_ROOM');
          if (!terminalReason) actual.controlRoomReached = true;
          addEnvironmentalCost(bossExperience, ACTION_TIME.VERY_SMALL, 'F5_CONTROL_ROOM');
          if (!terminalReason) {
            actual.systemRestored = true;
            recordEvent('SYSTEM_RESTORED', 'F5_CONTROL_ROOM', 'ENVIRONMENT');
            addEnvironmentalCost(bossExperience, edgeTime('E_F5_CONTROL_GOAL'), 'F5_GOAL');
          }
        }
      }
    }
    break;
  }

  if (!terminalReason && actual.bossNeutralized && actual.systemRestored) {
    terminalReason = 'GOAL_REACHED';
    recordEvent('GOAL_REACHED', 'F5_GOAL', 'ENVIRONMENT');
  }
  if (!terminalReason) {
    terminalReason = 'TIMEOUT';
    elapsedTime = environment.timeLimit;
    recordEvent('TIMEOUT', 'F5_SEARCH', 'ENVIRONMENT');
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
  const reward = evaluateEpisode(baseEpisode, weights, environment.timeLimit);
  for (let index = 0; index < actionHistory.length; index++) {
    const experience = actionHistory[index];
    if (experience.state === 'ROUTE_CHOICE') {
      const nextRoute = actionHistory.findIndex((candidate, candidateIndex) => candidateIndex > index && candidate.state === 'ROUTE_CHOICE');
      const segment = actionHistory.slice(index, nextRoute === -1 ? actionHistory.length : nextRoute);
      experience.segmentElapsedCost = segment.reduce((sum, candidate) => sum + candidate.elapsedCost, 0);
      experience.segmentEvents = segment.flatMap(candidate => candidate.immediateEvents);
      experience.segmentReturn = calculateSegmentReturn(experience.segmentElapsedCost, experience.segmentEvents, weights);
      experience.localReturn = experience.segmentReturn;
      experience.rawRouteCredit = calculateActionCredit(reward.episodeReturn, experience.segmentReturn);
    }
    experience.actionCredit = experience.rawRouteCredit ?? calculateActionCredit(reward.episodeReturn, experience.localReturn);
  }
  return { ...baseEpisode, reward, actual };
}

export function runActualMapProfile(
  environment: ActualMapEnvironment,
  profile: ProfileName,
  seed = 42,
  roundCount = 20,
  robotsPerRound = 5,
  parameters: ActualEnvironmentParameters = ACTUAL_ENVIRONMENT_PRODUCTION_V1,
): ActualRun {
  let centralPolicy = actualInitialPolicy(environment);
  const rounds: ActualRound[] = [];
  for (let round = 1; round <= roundCount; round++) {
    const epsilon = epsilonForRound(round);
    const snapshot = clonePolicy(centralPolicy);
    const centralBefore = JSON.stringify(centralPolicy);
    const episodes = Array.from({ length: robotsPerRound }, (_, index) => simulateActualEpisode(
      index + 1, snapshot, profile, episodeSeed(seed, round, index + 1), epsilon, environment, parameters,
    ));
    const centralPolicyUnchangedDuringEpisodes = JSON.stringify(centralPolicy) === centralBefore;
    const { policyAfter, changes } = (() => {
      const update = updatePolicy(centralPolicy, episodes);
      return { policyAfter: update.policy, changes: update.changes };
    })();
    centralPolicy = policyAfter;
    rounds.push({
      round, epsilon, snapshot, snapshotSignatures: episodes.map(episode => episode.snapshotSignature),
      centralPolicyUnchangedDuringEpisodes, episodes, changes, policyAfter: clonePolicy(policyAfter), updateCount: 1,
    });
  }
  const run = { profile, seed, rounds, finalPolicy: centralPolicy } as Omit<ActualRun, 'summary'>;
  return { ...run, summary: summarizeActualRun(run) };
}

export function summarizeActualRun(run: Pick<ActualRun, 'rounds' | 'finalPolicy'>) {
  const episodes = run.rounds.flatMap(round => round.episodes);
  const successful = episodes.filter(episode => episode.goalReached);
  const bossEncountered = episodes.filter(episode => episode.actual.bossActions > 0);
  const terminalCounts = Object.fromEntries(['GOAL_REACHED', 'TIMEOUT', 'CITIZEN_MISUNDERSTANDING', 'ROBOT_DISABLED'].map(reason => [reason, episodes.filter(episode => episode.terminalReason === reason).length]));
  const actionCount = (state: DecisionState, action: string): number => episodes.reduce((sum, episode) => sum + episode.actionHistory.filter(item => item.state === state && item.action === action).length, 0);
  const preferences = (state: DecisionState): Record<string, number> => ({ ...run.finalPolicy[state] });
  const clampHits = Object.values(run.finalPolicy).flatMap(Object.values).filter(value => Math.abs(value) === 2).length;
  return {
    episodes: episodes.length,
    updates: run.rounds.length,
    successRate: episodes.length ? successful.length / episodes.length : 0,
    terminalCounts,
    averageSuccessTime: successful.length ? successful.reduce((sum, episode) => sum + episode.elapsedTime, 0) / successful.length : null,
    averageElapsedTime: episodes.reduce((sum, episode) => sum + episode.elapsedTime, 0) / episodes.length,
    facilityDamageCount: episodes.reduce((sum, episode) => sum + episode.facilityDamageCount, 0),
    citizenRiskCount: episodes.reduce((sum, episode) => sum + episode.citizenRiskCount, 0),
    encounterTriggerCounts: Object.fromEntries(['OBSTACLE', 'CITIZEN_NEARBY', 'AMBIGUOUS_PERSON', 'VILLAIN_ENCOUNTER'].map(kind => [kind, episodes.reduce((sum, episode) => sum + episode.actual.encounterTriggers[kind as EncounterKind], 0)])),
    routeChoiceCounts: Object.fromEntries([...new Set(episodes.flatMap(episode => episode.actual.routeChoices))].sort().map(route => [route, episodes.reduce((sum, episode) => sum + episode.actual.routeChoices.filter(choice => choice === route).length, 0)])),
    obstacleActionCounts: Object.fromEntries(ACTIONS.OBSTACLE.map(action => [action, actionCount('OBSTACLE', action)])),
    citizenActionCounts: Object.fromEntries(ACTIONS.CITIZEN_NEARBY.map(action => [action, actionCount('CITIZEN_NEARBY', action)])),
    ambiguousActionCounts: Object.fromEntries(ACTIONS.AMBIGUOUS_PERSON.map(action => [action, actionCount('AMBIGUOUS_PERSON', action)])),
    villainActionCounts: Object.fromEntries(ACTIONS.VILLAIN_ENCOUNTER.map(action => [action, actionCount('VILLAIN_ENCOUNTER', action)])),
    bossActionCounts: Object.fromEntries(ACTIONS.BOSS_ENCOUNTER.map(action => [action, actionCount('BOSS_ENCOUNTER', action)])),
    bossRoomDistribution: Object.fromEntries(F5_ROOMS.map(room => [room, episodes.filter(episode => episode.actual.bossRoom === room).length])),
    averageRoomsSearched: episodes.reduce((sum, episode) => sum + episode.actual.searchedRooms.length, 0) / episodes.length,
    averageRoomsSearchedToBoss: bossEncountered.length ? bossEncountered.reduce((sum, episode) => sum + episode.actual.searchedRooms.length, 0) / bossEncountered.length : null,
    averageRoomsSearchedBeforeBoss: episodes.reduce((sum, episode) => sum + episode.actual.roomsSearchedBeforeBoss, 0) / episodes.length,
    finalPreferences: {
      routes: preferences('ROUTE_CHOICE'), obstacle: preferences('OBSTACLE'), citizen: preferences('CITIZEN_NEARBY'),
      ambiguous: preferences('AMBIGUOUS_PERSON'), villain: preferences('VILLAIN_ENCOUNTER'), boss: preferences('BOSS_ENCOUNTER'),
    },
    finalProbabilities: {
      obstacle: softmaxWithExploration(run.finalPolicy.OBSTACLE, ACTIONS.OBSTACLE, 0.10),
      citizen: softmaxWithExploration(run.finalPolicy.CITIZEN_NEARBY, ACTIONS.CITIZEN_NEARBY, 0.10),
      ambiguous: softmaxWithExploration(run.finalPolicy.AMBIGUOUS_PERSON, ACTIONS.AMBIGUOUS_PERSON, 0.10),
      villain: softmaxWithExploration(run.finalPolicy.VILLAIN_ENCOUNTER, ACTIONS.VILLAIN_ENCOUNTER, 0.10),
      boss: softmaxWithExploration(run.finalPolicy.BOSS_ENCOUNTER, ACTIONS.BOSS_ENCOUNTER, 0.10),
    },
    clampHits,
  };
}
