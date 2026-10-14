import type { ActionExperience, DecisionState, EventType, TerminalReason } from '../sim/learningEngine.ts';
import type {
  ActualEdge,
  ActualEncounterZone,
  ActualMapEnvironment,
  F5Room,
} from '../sim/actualMapEnvironment.ts';
import type { ActualEpisode } from '../sim/actualMapSimulation.ts';

export type RuntimePoint = { x: number; y: number };
export type RuntimeFootprint = { width: number; height: number };
export type RuntimeDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type RuntimeStateChange =
  | 'OBSTACLE_ACTIVE'
  | 'OBSTACLE_CLEARED'
  | 'OBSTACLE_PUSHED'
  | 'OBSTACLE_SHIFTED'
  | 'OBSTACLE_BYPASSED'
  | 'OBSTACLE_BLOCKED'
  | 'VILLAIN_NEUTRALIZED'
  | 'VILLAIN_FORCE_PASSED'
  | 'F5_DOOR_OPEN'
  | 'NO_BOSS'
  | 'BOSS_FOUND'
  | 'BOSS_NEUTRALIZED'
  | 'SECURITY_LOCK_OPEN'
  | 'SYSTEM_RESTORED';

type RuntimeBase = { floor: number; simulationTime: number };

export type RuntimeCommand =
  | (RuntimeBase & { type: 'MOVE'; edgeIds: string[]; points: RuntimePoint[] })
  | (RuntimeBase & {
      type: 'ENCOUNTER';
      phase: 'START' | 'END';
      zoneId: string;
      encounter: Exclude<DecisionState, 'ROUTE_CHOICE'>;
      position: RuntimePoint;
      routePosition: RuntimePoint;
      incomingDirection: RuntimePoint;
      stagingPosition: RuntimePoint;
      contactPosition: RuntimePoint;
      approachPoints: RuntimePoint[];
      clearedPosition: RuntimePoint;
      stagingGap: number;
      stagingFallback: boolean;
      villainCount?: 1 | 2;
      villainVariant?: 1 | 2 | 3 | 4;
    })
  | (RuntimeBase & { type: 'ACTION'; zoneId: string; state: Exclude<DecisionState, 'ROUTE_CHOICE'>; action: string })
  | (RuntimeBase & { type: 'OUTCOME'; zoneId: string; state: Exclude<DecisionState, 'ROUTE_CHOICE'>; outcome: string; events: EventType[] })
  | (RuntimeBase & { type: 'FLOOR_TRANSITION'; transitionId: string; targetFloor: number; targetSpawn: string })
  | (RuntimeBase & { type: 'STATE_CHANGE'; change: RuntimeStateChange; location: string; position?: RuntimePoint; room?: F5Room; villainVariant?: 1 | 2 | 3 | 4 })
  | (RuntimeBase & { type: 'TERMINAL'; reason: TerminalReason });

export const directionForSegment = (from: RuntimePoint, to: RuntimePoint): RuntimeDirection => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'RIGHT' : 'LEFT';
  return dy >= 0 ? 'DOWN' : 'UP';
};

const samePoint = (left: RuntimePoint, right: RuntimePoint) => left.x === right.x && left.y === right.y;

export const RUNTIME_STAGING_GAP = 32;
export const RUNTIME_CONTACT_FOOTPRINTS = {
  ROBOT: { width: 20, height: 12 },
  OBSTACLE: { width: 48, height: 24 },
  CITIZEN_NEARBY: { width: 24, height: 16 },
  AMBIGUOUS_PERSON: { width: 26, height: 18 },
  VILLAIN_ENCOUNTER: { width: 28, height: 18 },
  BOSS_ENCOUNTER: { width: 34, height: 22 },
} as const satisfies Record<'ROBOT' | Exclude<DecisionState, 'ROUTE_CHOICE'>, RuntimeFootprint>;

export type RuntimeStaging = {
  stagingPosition: RuntimePoint;
  routePosition: RuntimePoint;
  incomingDirection: RuntimePoint;
  contactPosition: RuntimePoint;
  approachPoints: RuntimePoint[];
  clearedPosition: RuntimePoint;
  stagingDistance: number;
  gap: number;
  fallback: boolean;
};

export function orientedPath(environment: ActualMapEnvironment, edgeIds: readonly string[], startNodeId: string) {
  const points: RuntimePoint[] = [];
  let node = startNodeId;
  for (const edgeId of edgeIds) {
    const edge = environment.edges.find(candidate => candidate.id === edgeId);
    if (!edge) throw new Error(`Runtime adapter: edge ${edgeId} is missing`);
    const forward = edge.from === node;
    if (!forward && edge.to !== node) throw new Error(`Runtime adapter: edge ${edgeId} is disconnected from ${node}`);
    const edgePoints = forward ? edge.points : [...edge.points].reverse();
    for (const point of edgePoints) if (!points.length || !samePoint(points.at(-1)!, point)) points.push(point);
    node = forward ? edge.to : edge.from;
  }
  return { points, endNodeId: node };
}

const pathMetrics = (points: readonly RuntimePoint[]) => {
  const cumulative = [0];
  for (let index = 1; index < points.length; index++) cumulative.push(cumulative[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  return cumulative;
};

const pointAt = (points: readonly RuntimePoint[], cumulative: readonly number[], distance: number): RuntimePoint => {
  if (distance <= 0) return { ...points[0] };
  const total = cumulative.at(-1)!;
  if (distance >= total) return { ...points.at(-1)! };
  const index = cumulative.findIndex(value => value >= distance);
  const from = points[index - 1];
  const to = points[index];
  const ratio = (distance - cumulative[index - 1]) / (cumulative[index] - cumulative[index - 1]);
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
};

const projectDistance = (points: readonly RuntimePoint[], target: RuntimePoint): number => {
  const cumulative = pathMetrics(points);
  let best = { distance: 0, error: Number.POSITIVE_INFINITY };
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared ? Math.max(0, Math.min(1, ((target.x - from.x) * dx + (target.y - from.y) * dy) / lengthSquared)) : 0;
    const projected = { x: from.x + dx * ratio, y: from.y + dy * ratio };
    const error = Math.hypot(projected.x - target.x, projected.y - target.y);
    if (error < best.error) best = { distance: cumulative[index - 1] + Math.sqrt(lengthSquared) * ratio, error };
  }
  return best.distance;
};

const projectedHalfExtent = (footprint: RuntimeFootprint, tangent: RuntimePoint) =>
  Math.abs(tangent.x) * footprint.width / 2 + Math.abs(tangent.y) * footprint.height / 2;

const slicePath = (points: readonly RuntimePoint[], fromDistance: number, toDistance: number): RuntimePoint[] => {
  if (points.length < 2 || toDistance <= fromDistance) return [];
  const cumulative = pathMetrics(points);
  const result = [pointAt(points, cumulative, fromDistance)];
  for (let index = 1; index < points.length - 1; index++) {
    if (cumulative[index] > fromDistance && cumulative[index] < toDistance) result.push({ ...points[index] });
  }
  const end = pointAt(points, cumulative, toDistance);
  if (!samePoint(result.at(-1)!, end)) result.push(end);
  return result;
};

export function stageEncounterOnPath(
  points: readonly RuntimePoint[],
  encounterPosition: RuntimePoint,
  entityFootprint: RuntimeFootprint,
  minimumGap = RUNTIME_STAGING_GAP,
): RuntimeStaging {
  if (points.length < 2) throw new Error('Runtime staging requires a polyline with at least two points');
  const cumulative = pathMetrics(points);
  const encounterDistance = projectDistance(points, encounterPosition);
  let segment = 1;
  while (segment < cumulative.length - 1 && cumulative[segment] < encounterDistance) segment++;
  const from = points[Math.max(0, segment - 1)];
  const to = points[segment];
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const tangent = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const requiredDistance = minimumGap
    + projectedHalfExtent(RUNTIME_CONTACT_FOOTPRINTS.ROBOT, tangent)
    + projectedHalfExtent(entityFootprint, tangent);
  const stagingDistance = Math.max(0, encounterDistance - requiredDistance);
  const contactDistance = Math.max(stagingDistance, encounterDistance - requiredDistance + minimumGap);
  const centerDistance = encounterDistance - stagingDistance;
  const gap = centerDistance
    - projectedHalfExtent(RUNTIME_CONTACT_FOOTPRINTS.ROBOT, tangent)
    - projectedHalfExtent(entityFootprint, tangent);
  const normal = { x: -tangent.y, y: tangent.x };
  const clearance = projectedHalfExtent(entityFootprint, normal)
    + projectedHalfExtent(RUNTIME_CONTACT_FOOTPRINTS.ROBOT, normal)
    + minimumGap;
  return {
    stagingPosition: pointAt(points, cumulative, stagingDistance),
    routePosition: pointAt(points, cumulative, encounterDistance),
    incomingDirection: tangent,
    contactPosition: pointAt(points, cumulative, contactDistance),
    approachPoints: slicePath(points, stagingDistance, contactDistance),
    clearedPosition: { x: encounterPosition.x + normal.x * clearance, y: encounterPosition.y + normal.y * clearance },
    stagingDistance,
    gap,
    fallback: gap + 0.001 < minimumGap,
  };
}

const variantFor = (seed: number, zoneId: string): 1 | 2 | 3 | 4 => {
  let hash = seed >>> 0;
  for (const character of zoneId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return ((hash % 4) + 1) as 1 | 2 | 3 | 4;
};

const isTerminal = (events: readonly EventType[]) => events.some(event => event === 'GOAL_REACHED' || event === 'ROBOT_DISABLED' || event === 'TIMEOUT' || event === 'CITIZEN_MISUNDERSTANDING');

const zoneState = (zone: ActualEncounterZone): Exclude<DecisionState, 'ROUTE_CHOICE'> => zone.kind;

function actionCommands(
  floor: number,
  zone: ActualEncounterZone,
  actions: readonly ActionExperience[],
  actionEndTimes: ReadonlyMap<ActionExperience, number>,
  seed: number,
  staging: RuntimeStaging,
): RuntimeCommand[] {
  const variant = zone.kind === 'VILLAIN_ENCOUNTER' ? variantFor(seed, zone.id) : undefined;
  const base = {
    floor,
    position: { x: zone.x, y: zone.y },
    routePosition: staging.routePosition,
    incomingDirection: staging.incomingDirection,
    zoneId: zone.id,
    encounter: zoneState(zone),
    stagingPosition: staging.stagingPosition,
    contactPosition: staging.contactPosition,
    approachPoints: staging.approachPoints,
    clearedPosition: staging.clearedPosition,
    stagingGap: staging.gap,
    stagingFallback: staging.fallback,
    villainCount: zone.villainCount,
    villainVariant: variant,
  } as const;
  const commands: RuntimeCommand[] = [{ type: 'ENCOUNTER', phase: 'START', simulationTime: actionEndTimes.get(actions[0]) ?? 0, ...base }];
  if (zone.kind === 'OBSTACLE') commands.push({ type: 'STATE_CHANGE', floor, simulationTime: actionEndTimes.get(actions[0]) ?? 0, change: 'OBSTACLE_ACTIVE', location: zone.id, position: base.position });
  for (const action of actions) {
    const simulationTime = actionEndTimes.get(action) ?? 0;
    const state = action.state as Exclude<DecisionState, 'ROUTE_CHOICE'>;
    commands.push({ type: 'ACTION', floor, simulationTime, zoneId: zone.id, state, action: action.action });
    commands.push({ type: 'OUTCOME', floor, simulationTime, zoneId: zone.id, state, outcome: action.localOutcome, events: [...action.immediateEvents] });
    if (action.localOutcome === 'OBSTACLE_CLEARED') commands.push({ type: 'STATE_CHANGE', floor, simulationTime, change: 'OBSTACLE_CLEARED', location: zone.id, position: base.position });
    if (action.action === 'PUSH' && (action.localOutcome === 'CLEAN_PASS' || action.localOutcome === 'FACILITY_DAMAGE')) commands.push({ type: 'STATE_CHANGE', floor, simulationTime, change: 'OBSTACLE_PUSHED', location: zone.id, position: base.position });
    if (action.localOutcome === 'SAFE_PASS' && zone.kind === 'OBSTACLE') commands.push({ type: 'STATE_CHANGE', floor, simulationTime, change: 'OBSTACLE_BYPASSED', location: zone.id, position: base.position });
    if (action.localOutcome === 'BLOCKED' && zone.kind === 'OBSTACLE') commands.push({ type: 'STATE_CHANGE', floor, simulationTime, change: 'OBSTACLE_BLOCKED', location: zone.id, position: base.position });
    if (action.immediateEvents.includes('VILLAIN_NEUTRALIZED')) commands.push({ type: 'STATE_CHANGE', floor, simulationTime, change: 'VILLAIN_NEUTRALIZED', location: zone.id, position: base.position, villainVariant: variant });
    if (zone.kind === 'VILLAIN_ENCOUNTER' && action.action === 'FORCE_PASS' && (action.localOutcome === 'PASS' || action.localOutcome === 'MOBILITY_DAMAGE')) commands.push({ type: 'STATE_CHANGE', floor, simulationTime, change: 'VILLAIN_FORCE_PASSED', location: zone.id, position: base.position, villainVariant: variant });
  }
  if (!actions.some(action => isTerminal(action.immediateEvents))) commands.push({ type: 'ENCOUNTER', phase: 'END', simulationTime: actionEndTimes.get(actions.at(-1)!) ?? 0, ...base });
  return commands;
}

const moveCommand = (floor: number, edgeIds: string[], points: RuntimePoint[], simulationTime: number): RuntimeCommand[] =>
  points.length > 1 ? [{ type: 'MOVE', floor, edgeIds, points, simulationTime }] : [];

const pathBetween = (points: readonly RuntimePoint[], fromDistance: number, toDistance: number) =>
  toDistance >= fromDistance ? slicePath(points, fromDistance, toDistance) : [...slicePath(points, toDistance, fromDistance)].reverse();

const edgeCommand = (environment: ActualMapEnvironment, floor: number, edgeId: string, simulationTime: number): RuntimeCommand[] => {
  const edge = environment.edges.find(candidate => candidate.id === edgeId)!;
  return moveCommand(floor, [edgeId], edge.points, simulationTime);
};

export function createRuntimeCommands(environment: ActualMapEnvironment, episode: ActualEpisode, seed: number): RuntimeCommand[] {
  const commands: RuntimeCommand[] = [];
  let elapsed = 0;
  const actionEndTimes = new Map<ActionExperience, number>();
  for (const action of episode.actionHistory) {
    elapsed += action.elapsedCost;
    actionEndTimes.set(action, Math.min(elapsed, episode.elapsedTime));
  }

  for (let index = 0; index < episode.actionHistory.length;) {
    const route = episode.actionHistory[index];
    if (route.state !== 'ROUTE_CHOICE') {
      index++;
      continue;
    }
    let next = index + 1;
    while (next < episode.actionHistory.length && episode.actionHistory[next].state !== 'ROUTE_CHOICE') next++;
    const followups = episode.actionHistory.slice(index + 1, next);
    const routeTime = actionEndTimes.get(route) ?? 0;

    if (route.action.startsWith('ACTUAL_ROUTE:F5_ROOM_')) {
      const room = route.action.slice(-2) as F5Room;
      const roomPath = environment.f5Rooms.find(candidate => candidate.room === room)!;
      const guard = environment.zones.find(candidate => candidate.id === roomPath.guardZoneId)!;
      const approach = orientedPath(environment, roomPath.approachEdgeIds, 'F5_SEARCH_HUB').points;
      const guardStaging = stageEncounterOnPath(approach, guard, RUNTIME_CONTACT_FOOTPRINTS.VILLAIN_ENCOUNTER);
      commands.push(...moveCommand(5, roomPath.approachEdgeIds, slicePath(approach, 0, guardStaging.stagingDistance), routeTime));
      const guardActions = followups.filter(action => action.state === 'VILLAIN_ENCOUNTER' && action.location === guard.id);
      if (guardActions.length) commands.push(...actionCommands(5, guard, guardActions, actionEndTimes, seed, guardStaging));
      if (guardActions.some(action => isTerminal(action.immediateEvents))) break;
      const guardNeutralized = guardActions.some(action => action.immediateEvents.includes('VILLAIN_NEUTRALIZED'));
      const guardRetreated = guardActions.at(-1)?.localOutcome === 'RETREAT';
      if (guardRetreated && !guardNeutralized) {
        commands.push(...moveCommand(5, roomPath.approachEdgeIds, [...slicePath(approach, 0, guardStaging.stagingDistance)].reverse(), actionEndTimes.get(guardActions.at(-1)!) ?? routeTime));
        index = next;
        continue;
      }
      if (guardNeutralized) commands.push({ type: 'STATE_CHANGE', floor: 5, simulationTime: actionEndTimes.get(guardActions.at(-1)!) ?? routeTime, change: 'F5_DOOR_OPEN', location: guard.id, room, position: { x: guard.x, y: guard.y } });

      if (room !== episode.actual.bossRoom) {
        commands.push(...moveCommand(5, roomPath.approachEdgeIds, slicePath(approach, guardStaging.stagingDistance, pathMetrics(approach).at(-1)!), routeTime));
        commands.push({ type: 'STATE_CHANGE', floor: 5, simulationTime: routeTime, change: 'NO_BOSS', location: room, room, position: approach.at(-1) });
        commands.push(...edgeCommand(environment, 5, roomPath.noBossReturnEdgeId, routeTime));
      } else {
        const roomPosition = approach.at(-1)!;
        const bossStaging = stageEncounterOnPath(approach, roomPosition, RUNTIME_CONTACT_FOOTPRINTS.BOSS_ENCOUNTER);
        commands.push(...moveCommand(5, roomPath.approachEdgeIds, slicePath(approach, guardStaging.stagingDistance, bossStaging.stagingDistance), routeTime));
        commands.push({ type: 'STATE_CHANGE', floor: 5, simulationTime: routeTime, change: 'BOSS_FOUND', location: room, room, position: roomPosition });
        const bossActions = followups.filter(action => action.state === 'BOSS_ENCOUNTER');
        if (bossActions.length) {
          const bossZone: ActualEncounterZone = { id: `F5_BOSS_${room}`, floor: 5, kind: 'VILLAIN_ENCOUNTER', mandatory: true, rate: 1, villainCount: 1, bypassAvailable: false, roomId: room, ...roomPosition };
          const bossBase = {
            floor: 5,
            zoneId: bossZone.id,
            encounter: 'BOSS_ENCOUNTER' as const,
            position: roomPosition,
            routePosition: bossStaging.routePosition,
            incomingDirection: bossStaging.incomingDirection,
            stagingPosition: bossStaging.stagingPosition,
            contactPosition: bossStaging.contactPosition,
            approachPoints: bossStaging.approachPoints,
            clearedPosition: bossStaging.clearedPosition,
            stagingGap: bossStaging.gap,
            stagingFallback: bossStaging.fallback,
          };
          commands.push({ type: 'ENCOUNTER', phase: 'START', simulationTime: actionEndTimes.get(bossActions[0]) ?? routeTime, ...bossBase });
          for (const action of bossActions) {
            const actionTime = actionEndTimes.get(action) ?? routeTime;
            commands.push({ type: 'ACTION', floor: 5, simulationTime: actionTime, zoneId: bossZone.id, state: 'BOSS_ENCOUNTER', action: action.action });
            commands.push({ type: 'OUTCOME', floor: 5, simulationTime: actionTime, zoneId: bossZone.id, state: 'BOSS_ENCOUNTER', outcome: action.localOutcome, events: [...action.immediateEvents] });
            if (isTerminal(action.immediateEvents)) break;
            if (action.localOutcome === 'RETREAT_TO_SEARCH') {
              commands.push(...edgeCommand(environment, 5, roomPath.noBossReturnEdgeId, actionTime));
              commands.push(...moveCommand(5, roomPath.approachEdgeIds, approach, actionTime));
            }
            if (action.immediateEvents.includes('BOSS_NEUTRALIZED')) commands.push({ type: 'STATE_CHANGE', floor: 5, simulationTime: actionTime, change: 'BOSS_NEUTRALIZED', location: room, room, position: roomPosition });
          }
          if (!bossActions.some(action => isTerminal(action.immediateEvents))) commands.push({ type: 'ENCOUNTER', phase: 'END', simulationTime: actionEndTimes.get(bossActions.at(-1)!) ?? routeTime, ...bossBase });
        }
        if (episode.actual.bossNeutralized) {
          const bossTime = actionEndTimes.get(followups.at(-1)!) ?? routeTime;
          commands.push(...moveCommand(5, roomPath.approachEdgeIds, slicePath(approach, bossStaging.stagingDistance, pathMetrics(approach).at(-1)!), bossTime));
          commands.push(...edgeCommand(environment, 5, roomPath.postBossEdgeId, bossTime));
          commands.push(...edgeCommand(environment, 5, 'E_F5_HALL_LOCK', bossTime));
          commands.push({ type: 'STATE_CHANGE', floor: 5, simulationTime: bossTime, change: 'SECURITY_LOCK_OPEN', location: 'F5_SECURITY_LOCK' });
          commands.push(...edgeCommand(environment, 5, 'E_F5_LOCK_CONTROL', bossTime));
          commands.push({ type: 'STATE_CHANGE', floor: 5, simulationTime: bossTime, change: 'SYSTEM_RESTORED', location: 'F5_CONTROL_ROOM' });
          commands.push(...edgeCommand(environment, 5, 'E_F5_CONTROL_GOAL', bossTime));
        }
      }
      index = next;
      continue;
    }

    const option = environment.contexts.flatMap(context => context.options).find(candidate => candidate.action === route.action && candidate.contextId === route.routeContext);
    if (!option) throw new Error(`Runtime adapter: route ${route.action} in ${String(route.routeContext)} is missing`);
    const path = orientedPath(environment, option.edgeIds, option.startNodeId).points;
    const zoneActions = new Map<string, ActionExperience[]>();
    for (const action of followups) {
      if (!action.location) continue;
      const list = zoneActions.get(action.location) ?? [];
      list.push(action);
      zoneActions.set(action.location, list);
    }
    const actionStops = [...zoneActions.entries()].map(([zoneId, actions]) => ({ zone: environment.zones.find(candidate => candidate.id === zoneId)!, actions }))
      .filter(stop => stop.zone);
    const floor3Obstacles = option.floor === 3
      ? actionStops.filter(stop => stop.zone.kind === 'OBSTACLE').map(stop => stop.zone)
        .sort((left, right) => projectDistance(path, left) - projectDistance(path, right))
      : [];
    let floor3ObstacleIndex = 0;
    const stops = actionStops.map(stop => {
      const visualZone = option.floor === 3 && stop.zone.kind === 'OBSTACLE'
        ? floor3Obstacles[floor3ObstacleIndex++]
        : stop.zone;
      const zone = (option.floor === 2 || option.floor === 4)
        && visualZone.kind === 'VILLAIN_ENCOUNTER' && visualZone.villainCount === 2
        ? { ...visualZone, ...path.at(-1)! }
        : visualZone;
      const encounter = zoneState(zone);
      const staging = stageEncounterOnPath(path, zone, RUNTIME_CONTACT_FOOTPRINTS[encounter]);
      return { ...stop, zone, distance: projectDistance(path, zone), staging };
    });
    let travelled = 0;
    let stopped = false;
    for (const stop of stops) {
      commands.push(...moveCommand(option.floor, option.edgeIds, pathBetween(path, travelled, stop.staging.stagingDistance), routeTime));
      travelled = stop.staging.stagingDistance;
      commands.push(...actionCommands(option.floor, stop.zone, stop.actions, actionEndTimes, seed, stop.staging));
      if (stop.actions.some(action => isTerminal(action.immediateEvents))) {
        stopped = true;
        break;
      }
      if (stop.actions.at(-1)?.localOutcome === 'RETREAT') {
        commands.push(...moveCommand(option.floor, option.edgeIds, [...slicePath(path, 0, travelled)].reverse(), actionEndTimes.get(stop.actions.at(-1)!) ?? routeTime));
        stopped = true;
        break;
      }
    }
    if (!stopped) {
      commands.push(...moveCommand(option.floor, option.edgeIds, slicePath(path, travelled, pathMetrics(path).at(-1)!), routeTime));
      commands.push({ type: 'FLOOR_TRANSITION', floor: option.floor, simulationTime: routeTime, transitionId: option.transitionId, targetFloor: option.targetFloor, targetSpawn: option.targetSpawn });
    }
    index = next;
  }

  commands.push({ type: 'TERMINAL', floor: episode.actual.reachedFloors.at(-1) ?? 1, simulationTime: episode.elapsedTime, reason: episode.terminalReason });
  return commands;
}

export type RuntimePlaybackState = {
  terminal?: TerminalReason;
  obstacleBlocking: Record<string, boolean>;
  neutralizedVillains: string[];
  openDoors: F5Room[];
  bossVisible: boolean;
  bossNeutralized: boolean;
  securityLockOpen: boolean;
};

export const initialRuntimePlaybackState = (): RuntimePlaybackState => ({
  obstacleBlocking: {}, neutralizedVillains: [], openDoors: [], bossVisible: false, bossNeutralized: false, securityLockOpen: false,
});

export function applyRuntimeCommand(state: RuntimePlaybackState, command: RuntimeCommand): RuntimePlaybackState {
  if (state.terminal) return state;
  const next: RuntimePlaybackState = { ...state, obstacleBlocking: { ...state.obstacleBlocking }, neutralizedVillains: [...state.neutralizedVillains], openDoors: [...state.openDoors] };
  if (command.type === 'TERMINAL') next.terminal = command.reason;
  if (command.type !== 'STATE_CHANGE') return next;
  if (command.change === 'OBSTACLE_ACTIVE' || command.change === 'OBSTACLE_BLOCKED') next.obstacleBlocking[command.location] = true;
  if (command.change === 'OBSTACLE_CLEARED' || command.change === 'OBSTACLE_PUSHED' || command.change === 'OBSTACLE_SHIFTED' || command.change === 'OBSTACLE_BYPASSED') next.obstacleBlocking[command.location] = false;
  if (command.change === 'VILLAIN_NEUTRALIZED' && !next.neutralizedVillains.includes(command.location)) next.neutralizedVillains.push(command.location);
  if (command.change === 'F5_DOOR_OPEN' && command.room && !next.openDoors.includes(command.room)) next.openDoors.push(command.room);
  if (command.change === 'BOSS_FOUND') next.bossVisible = true;
  if (command.change === 'BOSS_NEUTRALIZED') next.bossNeutralized = true;
  if (command.change === 'SECURITY_LOCK_OPEN') next.securityLockOpen = true;
  return next;
}
