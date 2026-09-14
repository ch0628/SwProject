import { footprint, overlaps } from './collision.ts';
import type { BehaviorHistoryEntry } from './characterPool.ts';
import { mapObjects, type GrayboxMap } from './plazaPark.ts';
import { createSupervisedPlazaGroup, stepPlazaNpcGroup, type PlazaNpcRuntime } from './plazaNpcRuntime.ts';
import { isRoadLanePoint, nearestLaneEdge } from './plazaLaneRuntime.ts';

export const SUPERVISED_CONCURRENCY_LEVELS = [5, 8, 10, 12, 15] as const;
export const SUPERVISED_CONCURRENCY_DURATION_SECONDS = 120;
const STEP_SECONDS = .05;
const UNRECOVERED_OBSERVATION_SECONDS = 20;

export type StalledNpcDiagnostic = Readonly<{
  id: string;
  phase: PlazaNpcRuntime['phase'];
  intent: string;
  targetNode: string;
  stopPoint: string | null;
  currentLogicalEdge: string;
  inJunctionTransition: boolean;
  reservationState: string;
  blockerNpc: string | null;
  position: Readonly<{ x: number; y: number }>;
  currentNoProgressSeconds: number;
  maxNoProgressSeconds: number;
  stallReportCount: number;
}>;

export type SupervisedConcurrencyResult = Readonly<{
  status: 'PASS' | 'WARN' | 'FAIL';
  activeCount: number;
  spawnedCount: number;
  peakActiveCount: number;
  exitedCount: number;
  completedItineraryCount: number;
  activeRemainingCount: number;
  stallReportCount: number;
  uniqueStalledNpcCount: number;
  recoveredStalledNpcCount: number;
  unrecoveredStalledNpcCount: number;
  maxContinuousNoProgressSeconds: number;
  npcOverlapViolationCount: number;
  fixedCollisionViolationCount: number;
  pathfindingFailureCount: number;
  invalidDestinationCount: number;
  runtimeExceptionCount: number;
  behaviorHistoryConsistency: boolean;
  behaviorHistoryIssueCount: number;
  roadHoldViolationCount: number;
  cafeVisitCompleted: number;
  facilityVisitCompleted: number;
  manholeInteractionCompleted: number;
  stopPointBehaviorCompleted: number;
  junctionTransitionStallCount: number;
  junctionTransitionConflictCount: number;
  stopReservationConflictCount: number;
  duplicateStopReservationCount: number;
  stopOccupancyConflictCount: number;
  deferredBehaviorCount: number;
  deferredBehaviorCompletedCount: number;
  connectorStallCount: number;
  remainingStopReservationCount: number;
  stalledNpcDiagnostics: readonly StalledNpcDiagnostic[];
  laneConflictLocations: Readonly<Record<string, readonly string[]>>;
  exitDistribution: Readonly<Record<string, number>>;
  entryFlowDistribution: Readonly<Record<string, number>>;
  selectedCharacters: readonly string[];
}>;

const countBy = (values: readonly string[]) => Object.freeze(values.reduce<Record<string, number>>((counts, value) => {
  counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}, {}));

function historyIssues(npc: PlazaNpcRuntime) {
  const history = npc.character.world.behaviorHistory;
  const issues: string[] = [];
  if (history.some((entry, index) => index > 0 && entry.simulationTime < history[index - 1].simulationTime)) issues.push('timestamp order');
  if (history.filter(entry => entry.zone === 'PLAZA' && entry.behavior.primitive === 'ENTER' && entry.behavior.semantic === 'ENTERING').length !== 1) issues.push('Plaza entry');
  const plazaIndex = npc.definition.zoneSequence.indexOf('PLAZA');
  for (let index = 0; index < plazaIndex; index++) {
    if (!history.some(entry => entry.zone === npc.definition.zoneSequence[index] && entry.behavior.semantic === npc.definition.behaviorStory[index] && entry.location === 'OFFSCREEN')) issues.push(`previous zone ${index}`);
  }
  const exits = history.filter(entry => entry.behavior.primitive === 'EXIT');
  if (exits.length !== Number(npc.phase === 'EXITED') || exits.some(entry => entry.zone !== 'PLAZA')) issues.push('exit event');
  return issues;
}

const completedAt = (history: readonly BehaviorHistoryEntry[], node: string) => history.some(entry => entry.location === node && entry.behavior.primitive !== 'WALK' && entry.behavior.primitive !== 'RUN');

export function runSupervisedConcurrencyValidation(map: GrayboxMap, activeCount: number): SupervisedConcurrencyResult {
  let group: ReturnType<typeof createSupervisedPlazaGroup>;
  let pathfindingFailureCount = 0, invalidDestinationCount = 0, runtimeExceptionCount = 0;
  try {
    group = createSupervisedPlazaGroup(map, activeCount);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('destination')) invalidDestinationCount++;
    else if (message.includes('path') || message.includes('endpoint')) pathfindingFailureCount++;
    else runtimeExceptionCount++;
    return Object.freeze({
      status:'FAIL', activeCount, spawnedCount:0, peakActiveCount:0, exitedCount:0, completedItineraryCount:0, activeRemainingCount:0,
      stallReportCount:0, uniqueStalledNpcCount:0, recoveredStalledNpcCount:0, unrecoveredStalledNpcCount:0,
      maxContinuousNoProgressSeconds:0, npcOverlapViolationCount:0, fixedCollisionViolationCount:0,
      pathfindingFailureCount, invalidDestinationCount, runtimeExceptionCount,
      behaviorHistoryConsistency:false, behaviorHistoryIssueCount:1, roadHoldViolationCount:0, cafeVisitCompleted:0, facilityVisitCompleted:0,
      manholeInteractionCompleted:0, stopPointBehaviorCompleted:0,
      junctionTransitionStallCount:0, junctionTransitionConflictCount:0, stopReservationConflictCount:0,
      duplicateStopReservationCount:0, stopOccupancyConflictCount:0, deferredBehaviorCount:0,
      deferredBehaviorCompletedCount:0, connectorStallCount:0, remainingStopReservationCount:0,
      stalledNpcDiagnostics:Object.freeze([]), laneConflictLocations:Object.freeze({}),
      exitDistribution:Object.freeze({}), entryFlowDistribution:Object.freeze({}), selectedCharacters:Object.freeze([]),
    });
  }

  const noProgress = new Map(group.npcs.map(npc => [npc.definition.id, { current:0, max:0 }]));
  const recovered = new Set<string>();
  const solids = mapObjects(map, 'Collision');
  let npcOverlapViolationCount = 0, fixedCollisionViolationCount = 0, roadHoldViolationCount = 0, peakActiveCount = group.npcs.length;
  for (let elapsed = 0; elapsed < SUPERVISED_CONCURRENCY_DURATION_SECONDS; elapsed += STEP_SECONDS) {
    const before = group.npcs.map(npc => ({ active:npc.active, phase:npc.phase, stalled:npc.stalledCandidate, x:npc.position.x, y:npc.position.y }));
    try {
      stepPlazaNpcGroup(group.npcs, map, group.graph, group.resolver, STEP_SECONDS);
    } catch {
      runtimeExceptionCount++;
      break;
    }
    peakActiveCount = Math.max(peakActiveCount, group.npcs.filter(npc => npc.active).length);
    for (const [index, npc] of group.npcs.entries()) {
      const tracker = noProgress.get(npc.definition.id)!;
      const moved = Math.hypot(npc.position.x - before[index].x, npc.position.y - before[index].y);
      tracker.current = before[index].active && (before[index].phase === 'MOVING' || before[index].phase === 'REJOINING') && moved < 1e-6 ? tracker.current + STEP_SECONDS : 0;
      tracker.max = Math.max(tracker.max, tracker.current);
      if (before[index].stalled && (!npc.stalledCandidate || !npc.active)) recovered.add(npc.definition.id);
      if (!npc.active || !npc.visible) continue;
      if (npc.phase === 'BEHAVIOR' && isRoadLanePoint(group.laneRuntime, npc.position)) roadHoldViolationCount++;
      const body = footprint(npc.position.x, npc.position.y, npc.config.footprint);
      if (solids.some(solid => overlaps(body, solid))) fixedCollisionViolationCount++;
      for (const other of group.npcs.slice(index + 1).filter(candidate => candidate.active && candidate.visible)) {
        if (overlaps(body, footprint(other.position.x, other.position.y, other.config.footprint))) npcOverlapViolationCount++;
      }
    }
  }

  const exited = group.npcs.filter(npc => npc.phase === 'EXITED');
  const stalled = group.npcs.filter(npc => npc.stallReports.length);
  const unrecovered = group.npcs.filter(npc => npc.active && noProgress.get(npc.definition.id)!.current >= UNRECOVERED_OBSERVATION_SECONDS);
  const historyIssueCount = group.npcs.reduce((total, npc) => total + historyIssues(npc).length, 0);
  const coordination = group.laneRuntime.coordination;
  const hardFailure = fixedCollisionViolationCount || npcOverlapViolationCount || roadHoldViolationCount || runtimeExceptionCount || pathfindingFailureCount || invalidDestinationCount ||
    unrecovered.length || exited.length !== group.npcs.length || historyIssueCount || coordination.metrics.duplicateStopReservationCount ||
    coordination.metrics.stopOccupancyConflictCount || coordination.stopReservations.size;
  const status = hardFailure ? 'FAIL' : stalled.length ? 'WARN' : 'PASS';
  const stalledNpcDiagnostics = stalled.map(npc => {
    const tracker = noProgress.get(npc.definition.id)!;
    return Object.freeze({
      id:npc.definition.id,
      phase:npc.phase,
      intent:npc.intents[npc.intentIndex] ?? 'COMPLETE',
      targetNode:npc.targetNode,
      stopPoint:npc.stopPoint ?? null,
      currentLogicalEdge:nearestLaneEdge(group.laneRuntime, npc.position),
      inJunctionTransition:Boolean(npc.path.junctionTransitions?.some(item => npc.pathPointIndex >= item.startIndex && npc.pathPointIndex <= item.endIndex)),
      reservationState:npc.stopPoint
        ? `${npc.stopPoint}:${group.laneRuntime.coordination.stopReservations.get(npc.stopPoint) ?? 'FREE'}`
        : npc.deferredIntentIndex === npc.intentIndex ? 'DEFERRED' : 'NONE',
      blockerNpc:npc.blockedByNpc ?? null,
      position:Object.freeze({ x:Number(npc.position.x.toFixed(2)), y:Number(npc.position.y.toFixed(2)) }),
      currentNoProgressSeconds:Number(tracker.current.toFixed(2)),
      maxNoProgressSeconds:Number(tracker.max.toFixed(2)),
      stallReportCount:npc.stallReports.length,
    });
  });
  return Object.freeze({
    status,
    activeCount,
    spawnedCount:group.npcs.length,
    peakActiveCount,
    exitedCount:exited.length,
    completedItineraryCount:exited.length,
    activeRemainingCount:group.npcs.length - exited.length,
    stallReportCount:group.npcs.reduce((total, npc) => total + npc.stallReports.length, 0),
    uniqueStalledNpcCount:stalled.length,
    recoveredStalledNpcCount:stalled.filter(npc => recovered.has(npc.definition.id) || npc.phase === 'EXITED').length,
    unrecoveredStalledNpcCount:unrecovered.length,
    maxContinuousNoProgressSeconds:Number(Math.max(0, ...[...noProgress.values()].map(value => value.max)).toFixed(2)),
    npcOverlapViolationCount,
    fixedCollisionViolationCount,
    pathfindingFailureCount,
    invalidDestinationCount,
    runtimeExceptionCount,
    behaviorHistoryConsistency:historyIssueCount === 0,
    behaviorHistoryIssueCount:historyIssueCount,
    roadHoldViolationCount,
    cafeVisitCompleted:group.npcs.filter(npc => completedAt(npc.character.world.behaviorHistory, 'N17')).length,
    facilityVisitCompleted:group.npcs.filter(npc => completedAt(npc.character.world.behaviorHistory, 'N28')).length,
    manholeInteractionCompleted:group.npcs.filter(npc => npc.character.world.behaviorHistory.some(entry => entry.location === 'SP10' && entry.behavior.semantic === 'MANHOLE_TAMPER')).length,
    stopPointBehaviorCompleted:group.npcs.reduce((total, npc) => total + npc.character.world.behaviorHistory.filter(entry => /^SP(?:[1-9]|10)$/.test(entry.location ?? '') && !['WALK','RUN'].includes(entry.behavior.primitive)).length, 0),
    junctionTransitionStallCount:coordination.metrics.junctionTransitionStallCount,
    junctionTransitionConflictCount:coordination.metrics.junctionTransitionConflictCount,
    stopReservationConflictCount:coordination.metrics.stopReservationConflictCount,
    duplicateStopReservationCount:coordination.metrics.duplicateStopReservationCount,
    stopOccupancyConflictCount:coordination.metrics.stopOccupancyConflictCount,
    deferredBehaviorCount:coordination.metrics.deferredBehaviorCount,
    deferredBehaviorCompletedCount:coordination.metrics.deferredBehaviorCompletedCount,
    connectorStallCount:coordination.metrics.connectorStallCount,
    remainingStopReservationCount:coordination.stopReservations.size,
    stalledNpcDiagnostics:Object.freeze(stalledNpcDiagnostics),
    laneConflictLocations:Object.freeze(Object.fromEntries([...new Set(unrecovered.map(npc => nearestLaneEdge(group.laneRuntime, npc.position)))].map(edge => [edge, Object.freeze(unrecovered.filter(npc => nearestLaneEdge(group.laneRuntime, npc.position) === edge).map(npc => npc.definition.id))]))),
    exitDistribution:countBy(exited.map(npc => [...npc.character.world.behaviorHistory].reverse().find(entry => entry.behavior.primitive === 'EXIT')?.location ?? 'NONE')),
    entryFlowDistribution:countBy(group.scenarios.map(scenario => scenario.entryFlow)),
    selectedCharacters:Object.freeze(group.npcs.map(npc => npc.definition.id)),
  });
}
