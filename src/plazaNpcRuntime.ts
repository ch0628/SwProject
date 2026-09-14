import { canOccupy, footprint, overlaps, sweptFootprint, type Bounds } from './collision.ts';
import {
  appendBehaviorHistory, characterDefinition, createCharacterRuntimeState,
  type BehaviorPrimitive, type CharacterDefinition, type CharacterId, type CharacterRuntimeState,
  type PlazaIntent, type SemanticBehavior, type WorldZone,
} from './characterPool.ts';
import { mapObjects, mapWorld, type GrayboxMap } from './plazaPark.ts';
import {
  createDestinationResolver, findNavigationPath, loadNavigationV2,
  type DestinationResolver, type NavigationGraph, type NavigationPath,
} from './plazaNavigationV2.ts';
import {
  createPlazaLaneRuntime, lanePath, releaseStopReservation, reserveStopMovementPlan, stopNamesForIntent,
  type PlazaLaneRuntime,
} from './plazaLaneRuntime.ts';

export const DEFAULT_PROGRESS_WATCHDOG = Object.freeze({
  // Prototype initial values: tune only after runtime observation.
  observationWindowSeconds: 2,
  minimumDisplacement: 1,
});
export const DEFAULT_PLAZA_NPC_CONFIG = Object.freeze({
  walkSpeed: 96,
  runSpeed: 144,
  footprint: Object.freeze({ width: 26, height: 16 }),
  watchdog: DEFAULT_PROGRESS_WATCHDOG,
});

export type ProgressWatchdogConfig = Readonly<{ observationWindowSeconds: number; minimumDisplacement: number }>;
export type PlazaNpcConfig = Readonly<{
  walkSpeed: number;
  runSpeed: number;
  footprint: Readonly<{ width: number; height: number }>;
  watchdog: ProgressWatchdogConfig;
}>;
export type StallReport = Readonly<{ simulationTime: number; targetNode: string; displacement: number }>;
export type PlazaNpcRuntime = {
  definition: CharacterDefinition;
  character: CharacterRuntimeState;
  graph: NavigationGraph;
  resolver: DestinationResolver;
  active: boolean;
  visible: boolean;
  phase: 'MOVING' | 'BEHAVIOR' | 'REJOINING' | 'EXITED';
  simulationTime: number;
  position: { x: number; y: number };
  currentNode: string;
  targetNode: string;
  intents: readonly PlazaIntent[];
  intentIndex: number;
  path: NavigationPath;
  pathPointIndex: number;
  holdRemaining: number;
  laneRuntime?: PlazaLaneRuntime;
  rejoinPath?: NavigationPath;
  rejoinNode?: string;
  stopPoint?: string;
  deferredTravel: boolean;
  deferredPreviousNode?: string;
  deferredIntentIndex?: number;
  movementHistoryIntentIndex?: number;
  transitionReservation?: string;
  blockedByNpc?: string;
  stalledCandidate: boolean;
  stallReports: StallReport[];
  watchdogAnchor: { time: number; x: number; y: number };
  config: PlazaNpcConfig;
};

type IntentBehavior = Readonly<{
  primitive: BehaviorPrimitive;
  semantic: SemanticBehavior;
  holdSeconds: number;
  movement: 'WALK' | 'RUN';
}>;

const behaviors: Record<PlazaIntent, IntentBehavior> = {
  PARK_WALK: { primitive:'IDLE', semantic:'WALKING', holdSeconds:.4, movement:'WALK' },
  BENCH_REST: { primitive:'REST', semantic:'RESTING', holdSeconds:1.5, movement:'WALK' },
  FACILITY_VISIT: { primitive:'ENTER', semantic:'VISITING_FACILITY', holdSeconds:1.2, movement:'WALK' },
  VANDALIZE: { primitive:'SUSPICIOUS_ACTION', semantic:'VANDALIZING', holdSeconds:1, movement:'WALK' },
  ESCAPE: { primitive:'EXIT', semantic:'ESCAPING', holdSeconds:0, movement:'RUN' },
  CAFE_VISIT: { primitive:'ENTER', semantic:'VISITING_CAFE', holdSeconds:1.2, movement:'WALK' },
  THREATEN: { primitive:'TALK', semantic:'THREATENING', holdSeconds:1, movement:'WALK' },
  JOG: { primitive:'IDLE', semantic:'JOGGING', holdSeconds:.25, movement:'RUN' },
  PLAZA_TRANSIT: { primitive:'IDLE', semantic:'TRANSITING', holdSeconds:.25, movement:'WALK' },
  TALK: { primitive:'TALK', semantic:'TALKING', holdSeconds:1, movement:'WALK' },
  SNATCH: { primitive:'SUSPICIOUS_ACTION', semantic:'SNATCHING', holdSeconds:.6, movement:'RUN' },
  CAFE_SERVICE: { primitive:'INTERACT', semantic:'CAFE_SERVICE', holdSeconds:1, movement:'WALK' },
  TRANSIT: { primitive:'IDLE', semantic:'TRANSITING', holdSeconds:.25, movement:'WALK' },
  FACILITY_REPAIR: { primitive:'INTERACT', semantic:'REPAIRING', holdSeconds:1.5, movement:'WALK' },
  MANHOLE_TAMPER: { primitive:'SUSPICIOUS_ACTION', semantic:'MANHOLE_TAMPER', holdSeconds:1, movement:'WALK' },
  THEFT: { primitive:'SUSPICIOUS_ACTION', semantic:'STEALING', holdSeconds:.7, movement:'RUN' },
  EXERCISE: { primitive:'INTERACT', semantic:'EXERCISING', holdSeconds:.8, movement:'RUN' },
  WALK: { primitive:'IDLE', semantic:'WALKING', holdSeconds:.25, movement:'WALK' },
  RUN: { primitive:'IDLE', semantic:'RUNNING', holdSeconds:.25, movement:'RUN' },
  IDLE: { primitive:'IDLE', semantic:'IDLING', holdSeconds:1, movement:'WALK' },
  CARRY_TOOLS: { primitive:'INTERACT', semantic:'CARRYING_TOOLS', holdSeconds:.6, movement:'WALK' },
  REPAIR: { primitive:'INTERACT', semantic:'REPAIRING', holdSeconds:1.5, movement:'WALK' },
  WAIT: { primitive:'IDLE', semantic:'WAITING', holdSeconds:1, movement:'WALK' },
  LOOK_AROUND: { primitive:'IDLE', semantic:'LOOKING_AROUND', holdSeconds:1, movement:'WALK' },
  DELIVERY: { primitive:'INTERACT', semantic:'DELIVERING', holdSeconds:.8, movement:'WALK' },
  COMMUTE: { primitive:'IDLE', semantic:'COMMUTING', holdSeconds:.25, movement:'WALK' },
  EXIT: { primitive:'EXIT', semantic:'COMMUTING', holdSeconds:0, movement:'WALK' },
};

const exitsPlaza = (intent: PlazaIntent) => intent === 'ESCAPE' || intent === 'EXIT';
const primitiveForSemantic = (semantic: SemanticBehavior): BehaviorPrimitive => {
  if (['RUNNING','JOGGING','ESCAPING'].includes(semantic)) return 'RUN';
  if (['STEALING','VANDALIZING','SNATCHING','MANHOLE_TAMPER'].includes(semantic)) return 'SUSPICIOUS_ACTION';
  if (['TALKING','THREATENING'].includes(semantic)) return 'TALK';
  if (semantic === 'RESTING') return 'REST';
  if (['CAFE_SERVICE','REPAIRING','CARRYING_TOOLS','DELIVERING','EXERCISING'].includes(semantic)) return 'INTERACT';
  return 'WALK';
};
const nextZone = (definition: CharacterDefinition): WorldZone => {
  const plaza = definition.zoneSequence.lastIndexOf('PLAZA');
  return definition.zoneSequence[plaza + 1] ?? 'OFFSCREEN';
};

function startIntent(runtime: PlazaNpcRuntime, graph: NavigationGraph, resolver: DestinationResolver) {
  const intent = runtime.intents[runtime.intentIndex];
  if (!intent) throw new Error(`${runtime.definition.id} has no intent at index ${runtime.intentIndex}`);
  const stopNames = stopNamesForIntent(intent);
  const stop = runtime.laneRuntime && stopNames.length
    ? reserveStopMovementPlan(runtime.laneRuntime, intent, runtime.currentNode, runtime.position, runtime.definition.id)
    : undefined;
  if (runtime.laneRuntime && stopNames.length && !stop) {
    if (runtime.deferredIntentIndex !== runtime.intentIndex) {
      runtime.deferredIntentIndex = runtime.intentIndex;
      runtime.laneRuntime.coordination.metrics.stopReservationConflictCount++;
      runtime.laneRuntime.coordination.metrics.deferredBehaviorCount++;
    }
    const adjacent = graph.adjacency.get(runtime.currentNode) ?? [];
    const preferred = adjacent.filter(arc => !['E25','E26'].includes(arc.edge.name) && arc.to !== runtime.deferredPreviousNode);
    const choices = preferred.length ? preferred : adjacent.filter(arc => !['E25','E26'].includes(arc.edge.name));
    if (!choices.length) throw new Error(`No safe defer route from ${runtime.currentNode}`);
    const target = choices[Number(runtime.definition.id.slice(3)) % choices.length].to;
    const logical = findNavigationPath(graph, runtime.currentNode, target);
    runtime.targetNode = target;
    runtime.path = lanePath(runtime.laneRuntime, logical, runtime.position);
    runtime.rejoinPath = undefined;
    runtime.rejoinNode = undefined;
    runtime.stopPoint = undefined;
    runtime.deferredTravel = true;
    runtime.pathPointIndex = Math.min(1, runtime.path.points.length);
    runtime.phase = 'MOVING';
    runtime.visible = true;
    runtime.stalledCandidate = false;
    runtime.watchdogAnchor = { time:runtime.simulationTime, ...runtime.position };
    if (runtime.movementHistoryIntentIndex !== runtime.intentIndex) {
      runtime.movementHistoryIntentIndex = runtime.intentIndex;
      appendBehaviorHistory(runtime.character, runtime.simulationTime, {
        primitive:behaviors[intent].movement,
        semantic:behaviors[intent].semantic,
      }, runtime.currentNode);
    }
    return;
  }
  runtime.targetNode = stop?.approachNode ?? resolver.resolve(intent, runtime.currentNode);
  const logical = findNavigationPath(graph, runtime.currentNode, runtime.targetNode);
  runtime.path = stop?.approach ?? (runtime.laneRuntime ? lanePath(runtime.laneRuntime, logical, runtime.position) : logical);
  runtime.rejoinPath = stop?.rejoin;
  runtime.rejoinNode = stop?.rejoinNode;
  runtime.stopPoint = stop?.stop.name;
  runtime.deferredTravel = false;
  runtime.pathPointIndex = Math.min(1, runtime.path.points.length);
  runtime.phase = 'MOVING';
  runtime.visible = true;
  runtime.stalledCandidate = false;
  runtime.watchdogAnchor = { time: runtime.simulationTime, ...runtime.position };
  if (runtime.movementHistoryIntentIndex !== runtime.intentIndex) {
    runtime.movementHistoryIntentIndex = runtime.intentIndex;
    appendBehaviorHistory(runtime.character, runtime.simulationTime, {
      primitive:behaviors[intent].movement,
      semantic:behaviors[intent].semantic,
    }, runtime.currentNode);
  }
  if (runtime.path.points.length === 1) arrive(runtime);
}

function arrive(runtime: PlazaNpcRuntime) {
  if (runtime.deferredTravel) {
    const previous = runtime.currentNode;
    runtime.currentNode = runtime.targetNode;
    runtime.deferredPreviousNode = previous;
    runtime.deferredTravel = false;
    startIntent(runtime, runtime.graph, runtime.resolver);
    return;
  }
  if (runtime.phase === 'REJOINING') {
    runtime.currentNode = runtime.rejoinNode!;
    if (runtime.stopPoint && runtime.laneRuntime) {
      releaseStopReservation(runtime.laneRuntime, runtime.stopPoint, runtime.definition.id);
      if (runtime.deferredIntentIndex === runtime.intentIndex) runtime.laneRuntime.coordination.metrics.deferredBehaviorCompletedCount++;
    }
    runtime.rejoinPath = undefined;
    runtime.rejoinNode = undefined;
    runtime.stopPoint = undefined;
    runtime.deferredPreviousNode = undefined;
    runtime.deferredIntentIndex = undefined;
    runtime.intentIndex++;
    startIntent(runtime, runtime.graph, runtime.resolver);
    return;
  }
  const intent = runtime.intents[runtime.intentIndex];
  const behavior = behaviors[intent];
  runtime.currentNode = runtime.targetNode;
  const movementOnly = !stopNamesForIntent(intent).length && behavior.primitive !== 'ENTER' && !exitsPlaza(intent);
  if (movementOnly) {
    runtime.intentIndex++;
    startIntent(runtime, runtime.graph, runtime.resolver);
    return;
  }
  runtime.phase = 'BEHAVIOR';
  runtime.holdRemaining = behavior.holdSeconds;
  runtime.stalledCandidate = false;
  runtime.visible = behavior.primitive !== 'ENTER' && behavior.primitive !== 'EXIT';
  if (!exitsPlaza(intent)) appendBehaviorHistory(runtime.character, runtime.simulationTime, behavior, runtime.stopPoint ?? runtime.targetNode);
}

export function createPlazaNpcRuntime(
  definition: CharacterDefinition,
  startNode: string,
  graph: NavigationGraph,
  resolver: DestinationResolver,
  config: PlazaNpcConfig = DEFAULT_PLAZA_NPC_CONFIG,
  laneRuntime?: PlazaLaneRuntime,
): PlazaNpcRuntime {
  const start = graph.nodes.get(startNode);
  if (!start) throw new Error(`Unknown Navigation_v2 spawn node: ${startNode}`);
  const intents = exitsPlaza(definition.plazaIntents.at(-1)!) ? definition.plazaIntents : Object.freeze([...definition.plazaIntents, 'EXIT' as const]);
  const runtime: PlazaNpcRuntime = {
    definition,
    character: createCharacterRuntimeState(definition, 'PLAZA'),
    graph,
    resolver,
    active: true,
    visible: true,
    phase: 'MOVING',
    simulationTime: 0,
    position: { x: start.x, y: start.y },
    currentNode: startNode,
    targetNode: startNode,
    intents,
    intentIndex: 0,
    path: findNavigationPath(graph, startNode, startNode),
    pathPointIndex: 1,
    holdRemaining: 0,
    laneRuntime,
    deferredTravel: false,
    stalledCandidate: false,
    stallReports: [],
    watchdogAnchor: { time: 0, x: start.x, y: start.y },
    config,
  };
  const plazaIndex = definition.zoneSequence.indexOf('PLAZA');
  for (let index = 0; index < plazaIndex; index++) {
    const semantic = definition.behaviorStory[index] ?? 'IDLING';
    runtime.character.world.currentZone = definition.zoneSequence[index];
    appendBehaviorHistory(runtime.character, index - plazaIndex, { primitive: primitiveForSemantic(semantic), semantic }, 'OFFSCREEN');
  }
  runtime.character.world.currentZone = 'PLAZA';
  appendBehaviorHistory(runtime.character, 0, { primitive: 'ENTER', semantic: 'ENTERING' }, startNode);
  startIntent(runtime, graph, resolver);
  return runtime;
}

function observeProgress(runtime: PlazaNpcRuntime) {
  if (runtime.phase !== 'MOVING' && runtime.phase !== 'REJOINING') return;
  const elapsed = runtime.simulationTime - runtime.watchdogAnchor.time;
  if (elapsed < runtime.config.watchdog.observationWindowSeconds) return;
  const displacement = Math.hypot(runtime.position.x - runtime.watchdogAnchor.x, runtime.position.y - runtime.watchdogAnchor.y);
  runtime.stalledCandidate = displacement < runtime.config.watchdog.minimumDisplacement;
  if (runtime.stalledCandidate) {
    runtime.stallReports.push(Object.freeze({ simulationTime: runtime.simulationTime, targetNode: runtime.targetNode, displacement }));
    if (runtime.laneRuntime) {
      const transition = runtime.path.junctionTransitions?.some(item => runtime.pathPointIndex >= item.startIndex && runtime.pathPointIndex <= item.endIndex);
      if (transition) runtime.laneRuntime.coordination.metrics.junctionTransitionStallCount++;
      if (runtime.stopPoint) runtime.laneRuntime.coordination.metrics.connectorStallCount++;
    }
  }
  runtime.watchdogAnchor = { time: runtime.simulationTime, ...runtime.position };
}

function releaseJunctionReservation(runtime: PlazaNpcRuntime) {
  if (!runtime.transitionReservation || !runtime.laneRuntime) return;
  if (runtime.laneRuntime.coordination.transitionReservations.get(runtime.transitionReservation) === runtime.definition.id) {
    runtime.laneRuntime.coordination.transitionReservations.delete(runtime.transitionReservation);
  }
  runtime.transitionReservation = undefined;
}

export function stepPlazaNpc(
  runtime: PlazaNpcRuntime,
  graph: NavigationGraph,
  resolver: DestinationResolver,
  deltaSeconds: number,
  blockers: readonly Bounds[],
  world: { width: number; height: number },
) {
  if (!runtime.active || deltaSeconds <= 0) return;
  const delta = Math.min(deltaSeconds, .05);
  runtime.simulationTime += delta;

  if (runtime.phase === 'BEHAVIOR') {
    runtime.holdRemaining = Math.max(0, runtime.holdRemaining - delta);
    if (runtime.holdRemaining > 0) return;
    const completedIntent = runtime.intents[runtime.intentIndex];
    if (exitsPlaza(completedIntent)) {
      appendBehaviorHistory(runtime.character, runtime.simulationTime, behaviors[completedIntent], runtime.currentNode);
      runtime.active = false;
      runtime.visible = false;
      runtime.phase = 'EXITED';
      runtime.character.world.currentZone = nextZone(runtime.definition);
      return;
    }
    if (runtime.rejoinPath) {
      runtime.phase = 'REJOINING';
      runtime.path = runtime.rejoinPath;
      runtime.pathPointIndex = Math.min(1, runtime.path.points.length);
      runtime.targetNode = runtime.rejoinNode!;
      runtime.watchdogAnchor = { time:runtime.simulationTime, ...runtime.position };
    } else {
      runtime.intentIndex++;
      startIntent(runtime, graph, resolver);
    }
  }

  if (runtime.phase !== 'MOVING' && runtime.phase !== 'REJOINING') return;
  let remaining = (behaviors[runtime.intents[runtime.intentIndex]].movement === 'RUN' ? runtime.config.runSpeed : runtime.config.walkSpeed) * delta;
  while (remaining > 0 && runtime.pathPointIndex < runtime.path.points.length) {
    if (runtime.transitionReservation) {
      const held = runtime.path.junctionTransitions?.find(item => item.key === runtime.transitionReservation);
      if (!held || runtime.pathPointIndex > held.endIndex) releaseJunctionReservation(runtime);
    }
    const transition = runtime.path.junctionTransitions?.find(item => runtime.pathPointIndex >= item.startIndex && runtime.pathPointIndex <= item.endIndex);
    if (transition && runtime.laneRuntime && runtime.transitionReservation !== transition.key) {
      const owner = runtime.laneRuntime.coordination.transitionReservations.get(transition.key);
      if (owner && owner !== runtime.definition.id) {
        runtime.laneRuntime.coordination.metrics.junctionTransitionConflictCount++;
        runtime.watchdogAnchor = { time:runtime.simulationTime, ...runtime.position };
        break;
      }
      runtime.laneRuntime.coordination.transitionReservations.set(transition.key, runtime.definition.id);
      runtime.transitionReservation = transition.key;
    }
    const target = runtime.path.points[runtime.pathPointIndex];
    const dx = target.x - runtime.position.x;
    const dy = target.y - runtime.position.y;
    const segment = Math.hypot(dx, dy);
    const step = Math.min(remaining, segment);
    const next = segment <= step ? target : { x: runtime.position.x + dx / segment * step, y: runtime.position.y + dy / segment * step };
    if (!canOccupy(sweptFootprint(runtime.position, next, runtime.config.footprint), [...blockers], world)) {
      if (runtime.laneRuntime && runtime.path.junctionTransitions?.some(item => runtime.pathPointIndex >= item.startIndex && runtime.pathPointIndex <= item.endIndex)) {
        runtime.laneRuntime.coordination.metrics.junctionTransitionConflictCount++;
      }
      break;
    }
    runtime.position = { ...next };
    remaining -= step;
    if (segment <= step) runtime.pathPointIndex++;
  }
  if (runtime.pathPointIndex >= runtime.path.points.length) {
    releaseJunctionReservation(runtime);
    arrive(runtime);
  }
  observeProgress(runtime);
}

export function stepPlazaNpcGroup(
  runtimes: readonly PlazaNpcRuntime[], map: GrayboxMap, graph: NavigationGraph,
  resolver: DestinationResolver, deltaSeconds: number, externalBlockers: readonly Bounds[] = [],
) {
  const solids = mapObjects(map, 'Collision');
  const world = mapWorld(map);
  for (const runtime of runtimes) {
    const before = { ...runtime.position };
    const npcBlockers = runtimes
      .filter(other => other !== runtime && other.active && other.visible)
      .map(other => footprint(other.position.x, other.position.y, other.config.footprint));
    stepPlazaNpc(runtime, graph, resolver, deltaSeconds, [...solids, ...externalBlockers, ...npcBlockers], world);
    runtime.blockedByNpc = undefined;
    if (runtime.active && (runtime.phase === 'MOVING' || runtime.phase === 'REJOINING') &&
        Math.hypot(runtime.position.x - before.x, runtime.position.y - before.y) < 1e-6 && runtime.pathPointIndex < runtime.path.points.length) {
      const target = runtime.path.points[runtime.pathPointIndex];
      const dx = target.x - runtime.position.x, dy = target.y - runtime.position.y;
      const length = Math.max(Math.hypot(dx, dy), 1);
      const distance = Math.min(1, length);
      const next = { x:runtime.position.x + dx / length * distance, y:runtime.position.y + dy / length * distance };
      runtime.blockedByNpc = runtimes.find(other => other !== runtime && other.active && other.visible &&
        overlaps(sweptFootprint(runtime.position, next, runtime.config.footprint), footprint(other.position.x, other.position.y, other.config.footprint)))?.definition.id;
    }
  }
  const stopOccupants = new Map<string, PlazaNpcRuntime[]>();
  for (const runtime of runtimes.filter(candidate => candidate.active && candidate.visible && candidate.phase === 'BEHAVIOR' && candidate.stopPoint)) {
    const occupants = stopOccupants.get(runtime.stopPoint!) ?? [];
    occupants.push(runtime);
    stopOccupants.set(runtime.stopPoint!, occupants);
  }
  for (const occupants of stopOccupants.values()) if (occupants.length > 1) {
    occupants[0].laneRuntime!.coordination.metrics.stopOccupancyConflictCount++;
  }
}

export type SupervisedValidationScenario = Readonly<{
  id: CharacterId;
  startNode: string;
  entryFlow: 'N01' | 'N02' | 'N03' | 'N16';
}>;

export const SUPERVISED_VALIDATION_SCENARIOS: readonly SupervisedValidationScenario[] = Object.freeze([
  { id:'NPC06', startNode:'N01', entryFlow:'N01' }, // normal transit
  { id:'NPC04', startNode:'N03', entryFlow:'N03' }, // Cafe visit
  { id:'NPC02', startNode:'N16', entryFlow:'N16' }, // Facility visit
  { id:'NPC33', startNode:'N05', entryFlow:'N02' }, // south exit
  { id:'NPC28', startNode:'N15', entryFlow:'N16' }, // suspicious action
  { id:'NPC01', startNode:'N02', entryFlow:'N02' }, // Park + bench
  { id:'NPC05', startNode:'N07', entryFlow:'N16' }, // threaten + escape
  { id:'NPC22', startNode:'N12', entryFlow:'N03' }, // bench rest
  { id:'NPC13', startNode:'N04', entryFlow:'N01' }, // Park + transit
  { id:'NPC16', startNode:'N08', entryFlow:'N16' }, // run + Facility
  { id:'NPC08', startNode:'N09', entryFlow:'N01' }, // snatch + escape
  { id:'NPC23', startNode:'N10', entryFlow:'N02' }, // wait + look around
  { id:'NPC29', startNode:'N18', entryFlow:'N03' }, // Cafe + commute
  { id:'NPC35', startNode:'N28', entryFlow:'N16' }, // Facility repair
  { id:'NPC17', startNode:'N11', entryFlow:'N01' }, // idle + vandalize + escape
]);

export function createSupervisedPlazaGroup(map: GrayboxMap, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > SUPERVISED_VALIDATION_SCENARIOS.length) throw new Error(`Unsupported supervised NPC count: ${count}`);
  const graph = loadNavigationV2(map);
  const resolver = createDestinationResolver(map, graph);
  const laneRuntime = createPlazaLaneRuntime(map, graph);
  const scenarios = SUPERVISED_VALIDATION_SCENARIOS.slice(0, count);
  const npcs = scenarios.map(scenario => {
    const definition = characterDefinition(scenario.id);
    if (!definition) throw new Error(`Missing Character Pool definition: ${scenario.id}`);
    return createPlazaNpcRuntime(definition, scenario.startNode, graph, resolver, DEFAULT_PLAZA_NPC_CONFIG, laneRuntime);
  });
  return { graph, resolver, laneRuntime, npcs, scenarios };
}

export const createSupervisedPlazaDemo = (map: GrayboxMap) => createSupervisedPlazaGroup(map, 5);
