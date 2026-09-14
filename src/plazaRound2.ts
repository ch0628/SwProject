/**
 * plazaRound2.ts
 *
 * Round 2 Scenario - Supervised Learning Game
 * Source of Truth: round2_assignment_v2.md (approved 2026-09-14)
 * Villain IDs: NPC06, NPC08, NPC15, NPC16, NPC26, NPC27, NPC31
 * Zone rotation: R1 A->R2 E, R1 B->R2 A, R1 C->R2 B, R1 D->R2 C, R1 E->R2 D
 *
 * FROZEN: plazaRound1.ts / plazaLaneRuntime.ts / plazaNavigationV2.ts / characterPool.ts
 */

import {
  appendBehaviorHistory, characterDefinition,
  type BehaviorPrimitive, type CharacterId, type CharacterLabel, type SemanticBehavior,
  type AIConfidence,
} from './characterPool.ts';
import { findNavigationPath } from './plazaNavigationV2.ts';
import {
  createPlazaLaneRuntime, lanePath, releaseStopReservation, reserveAuthoredPointMovementPlan,
  type AuthoredPoint,
} from './plazaLaneRuntime.ts';
import {
  loadNpcScenarioPoints,
  type RoundCameraId, type RoundCharacterAssignment, type RoundLifecycle,
  type RoundMovementRole, type RoundInitialState,
  type Round1Group, type RoundNpcRuntime,
} from './plazaRound1.ts';
import type { GrayboxMap } from './plazaPark.ts';
import type { CameraZone } from './cctvManualLabeling.ts';

// ---------------------------------------------------------------------------
// Round 2 AI Comparison Plan
// ---------------------------------------------------------------------------

export type Round2ComparisonEntry = Readonly<{
  characterId: CharacterId;
  aiLabel: CharacterLabel;
  aiConfidence: AIConfidence;
}>;

/**
 * Deterministic AI prediction for HUMAN_AI_COMPARE phase.
 * Source of Truth: round2_assignment_v2.md AI prediction table.
 * NOT derived from characterPool.ts legacy plannedAI.
 * NOT gameplay truth - actualLabel always from RoundCharacterAssignment.actualLabel.
 */
export const ROUND2_COMPARISON_PLAN: readonly Round2ComparisonEntry[] = Object.freeze([
  Object.freeze({ characterId: 'NPC08' as CharacterId, aiLabel: 'CITIZEN' as CharacterLabel, aiConfidence: 'LOW' as AIConfidence }),    // AI WRONG
  Object.freeze({ characterId: 'NPC10' as CharacterId, aiLabel: 'CITIZEN' as CharacterLabel, aiConfidence: 'HIGH' as AIConfidence }),   // AI CORRECT
  Object.freeze({ characterId: 'NPC18' as CharacterId, aiLabel: 'CITIZEN' as CharacterLabel, aiConfidence: 'HIGH' as AIConfidence }),   // AI CORRECT
  Object.freeze({ characterId: 'NPC20' as CharacterId, aiLabel: 'VILLAIN' as CharacterLabel, aiConfidence: 'LOW' as AIConfidence }),    // AI WRONG
  Object.freeze({ characterId: 'NPC23' as CharacterId, aiLabel: 'CITIZEN' as CharacterLabel, aiConfidence: 'MEDIUM' as AIConfidence }), // AI CORRECT
  Object.freeze({ characterId: 'NPC27' as CharacterId, aiLabel: 'CITIZEN' as CharacterLabel, aiConfidence: 'LOW' as AIConfidence }),    // AI WRONG
  Object.freeze({ characterId: 'NPC31' as CharacterId, aiLabel: 'VILLAIN' as CharacterLabel, aiConfidence: 'HIGH' as AIConfidence }),   // AI CORRECT
  Object.freeze({ characterId: 'NPC06' as CharacterId, aiLabel: 'VILLAIN' as CharacterLabel, aiConfidence: 'MEDIUM' as AIConfidence }), // AI CORRECT
]);

export const round2ComparisonFor = (id: CharacterId): Round2ComparisonEntry | undefined =>
  ROUND2_COMPARISON_PLAN.find(e => e.characterId === id);

// ---------------------------------------------------------------------------
// Round 2 Assignment Table
// ---------------------------------------------------------------------------

type R2Row = Readonly<{
  characterId: CharacterId;
  actualLabel: CharacterLabel;
  homeObservationZone: RoundCameraId;
  lifecycle: RoundLifecycle;
  entry: RoundCharacterAssignment['entry'];
  target: string | null;
  mainBehavior: SemanticBehavior;
  exit: RoundCharacterAssignment['exit'];
  historyBehavior?: SemanticBehavior;
}>;

const row = (
  characterId: CharacterId, actualLabel: CharacterLabel, homeObservationZone: RoundCameraId,
  lifecycle: RoundLifecycle, entry: RoundCharacterAssignment['entry'], target: string | null,
  mainBehavior: SemanticBehavior, exit: RoundCharacterAssignment['exit'],
  historyBehavior?: SemanticBehavior,
): R2Row => Object.freeze({ characterId, actualLabel, homeObservationZone, lifecycle, entry, target, mainBehavior, exit, ...(historyBehavior ? { historyBehavior } : {}) });

export const ROUND2_ROWS: readonly R2Row[] = Object.freeze([
  // PLAZA_CAM_A (R1 CAM_B 출신: NPC08-14) -- 1 VILLAIN = NPC08
  row('NPC08','VILLAIN','PLAZA_CAM_A','ENTER_AND_STAY', 'N01','A_STAY_01',  'LOOKING_AROUND',null, 'STEALING'),
  row('NPC09','CITIZEN','PLAZA_CAM_A','STATIC_HOLD',    null, 'A_STATIC_01','RESTING',       null),
  row('NPC10','CITIZEN','PLAZA_CAM_A','ENTER_HOLD_EXIT','N01','SP1',        'CARRYING_TOOLS','N24'),
  row('NPC11','CITIZEN','PLAZA_CAM_A','STATIC_HOLD',    null, 'A_STATIC_02','WAITING',        null),
  row('NPC12','CITIZEN','PLAZA_CAM_A','ENTER_AND_STAY', 'N03','A_STAY_02',  'EXERCISING',    null),
  row('NPC13','CITIZEN','PLAZA_CAM_A','ENTER_HOLD_EXIT','N03','A_ACTION_01','DELIVERING',    'N24'),
  row('NPC14','CITIZEN','PLAZA_CAM_A','THROUGH_TRAFFIC','N01',null,         'WALKING',       'N24'),

  // PLAZA_CAM_B (R1 CAM_C 출신: NPC15-21) -- 2 VILLAIN = NPC15, NPC16
  row('NPC15','VILLAIN','PLAZA_CAM_B','ENTER_HOLD_EXIT','N02','SP5',        'THREATENING',   'N25','STEALING'),
  row('NPC16','VILLAIN','PLAZA_CAM_B','STATIC_HOLD',    null, 'B_STATIC_01','LOOKING_AROUND',null, 'THREATENING'),
  row('NPC17','CITIZEN','PLAZA_CAM_B','ENTER_AND_STAY', 'N02','B_STAY_01',  'WAITING',       null),
  row('NPC18','CITIZEN','PLAZA_CAM_B','STATIC_HOLD',    null, 'B_STATIC_02','CARRYING_TOOLS',null),
  row('NPC19','CITIZEN','PLAZA_CAM_B','ENTER_HOLD_EXIT','N02','SP6',        'RESTING',       'N25'),
  row('NPC20','CITIZEN','PLAZA_CAM_B','ENTER_AND_STAY', 'N02','B_STAY_02',  'DELIVERING',    null, 'RUNNING'),
  row('NPC21','CITIZEN','PLAZA_CAM_B','THROUGH_TRAFFIC','N02',null,         'COMMUTING',     'N25'),

  // PLAZA_CAM_C (R1 CAM_D 출신: NPC22-28) -- 2 VILLAIN = NPC26, NPC27
  row('NPC22','CITIZEN','PLAZA_CAM_C','STATIC_HOLD',    null, 'C_STATIC_01','RESTING',        null),
  row('NPC23','CITIZEN','PLAZA_CAM_C','STATIC_HOLD',    null, 'C_STATIC_02','IDLING',          null),
  row('NPC24','CITIZEN','PLAZA_CAM_C','ENTER_AND_STAY', 'N03','C_STAY_01',  'CAFE_SERVICE',   null),
  row('NPC25','CITIZEN','PLAZA_CAM_C','ENTER_AND_STAY', 'N03','C_STAY_02',  'WAITING',        null),
  row('NPC26','VILLAIN','PLAZA_CAM_C','ENTER_HOLD_EXIT','N03','C_ACTION_01','STEALING',       'N24','SNATCHING'),
  row('NPC27','VILLAIN','PLAZA_CAM_C','ENTER_HOLD_EXIT','N03','SP8',        'LOOKING_AROUND', 'N24','MANHOLE_TAMPER'),
  row('NPC28','CITIZEN','PLAZA_CAM_C','THROUGH_TRAFFIC','N03',null,         'TRANSITING',     'N24'),

  // PLAZA_CAM_D (R1 CAM_E 출신: NPC29-35) -- 1 VILLAIN = NPC31
  row('NPC29','CITIZEN','PLAZA_CAM_D','STATIC_HOLD',    null, 'D_STATIC_01','TALKING',        null),
  row('NPC30','CITIZEN','PLAZA_CAM_D','STATIC_HOLD',    null, 'D_STATIC_02','RESTING',        null),
  row('NPC31','VILLAIN','PLAZA_CAM_D','ENTER_AND_STAY', 'N16','D_STAY_01',  'LOOKING_AROUND', null, 'STEALING'),
  row('NPC32','CITIZEN','PLAZA_CAM_D','ENTER_HOLD_EXIT','N16','SP10',       'CARRYING_TOOLS', 'N26'),
  row('NPC33','CITIZEN','PLAZA_CAM_D','ENTER_AND_STAY', 'N16','D_STAY_02',  'REPAIRING',      null),
  row('NPC34','CITIZEN','PLAZA_CAM_D','ENTER_HOLD_EXIT','N16','SP9',        'DELIVERING',     'N26'),
  row('NPC35','CITIZEN','PLAZA_CAM_D','THROUGH_TRAFFIC','N16',null,         'WALKING',        'N26'),

  // PLAZA_CAM_E (R1 CAM_A 출신: NPC01-07) -- 1 VILLAIN = NPC06
  row('NPC01','CITIZEN','PLAZA_CAM_E','ENTER_AND_STAY', 'N02','E_STAY_01',  'TALKING',        null),
  row('NPC02','CITIZEN','PLAZA_CAM_E','ENTER_AND_STAY', 'N02','E_STAY_02',  'DELIVERING',     null),
  row('NPC03','CITIZEN','PLAZA_CAM_E','STATIC_HOLD',    null, 'E_STATIC_01','RESTING',         null),
  row('NPC04','CITIZEN','PLAZA_CAM_E','STATIC_HOLD',    null, 'E_STATIC_02','IDLING',           null),
  row('NPC05','CITIZEN','PLAZA_CAM_E','THROUGH_TRAFFIC','N02',null,         'COMMUTING',      'N25'),
  row('NPC06','VILLAIN','PLAZA_CAM_E','ENTER_HOLD_EXIT','N02','E_ACTION_01','SNATCHING',      'N25','STEALING'),
  row('NPC07','CITIZEN','PLAZA_CAM_E','ENTER_HOLD_EXIT','N02','SP2',        'RESTING',        'N25'),
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function primitiveFn(s: SemanticBehavior): BehaviorPrimitive {
  if (['RUNNING','ESCAPING'].includes(s)) return 'RUN';
  if (['STEALING','SNATCHING','MANHOLE_TAMPER','THREATENING'].includes(s)) return 'SUSPICIOUS_ACTION';
  if (s === 'TALKING') return 'TALK';
  if (s === 'RESTING') return 'REST';
  if (['CAFE_SERVICE','REPAIRING','CARRYING_TOOLS','DELIVERING','EXERCISING'].includes(s)) return 'INTERACT';
  return 'IDLE';
}

function cameraAt(cameras: readonly CameraZone[], x: number, y: number): RoundCameraId | null {
  return (cameras.find(z => x >= z.x && x < z.x + z.width && y >= z.y && y < z.y + z.height)?.name as RoundCameraId | undefined) ?? null;
}

function rowToAssignment(r2: R2Row): RoundCharacterAssignment {
  const lc = r2.lifecycle;
  const movementRole: RoundMovementRole =
    lc === 'STATIC_HOLD' ? 'STATIONARY' : lc === 'THROUGH_TRAFFIC' ? 'RECURRING_MOVER' : 'TEMPORARY_MOVER';
  const initialState: RoundInitialState = lc === 'STATIC_HOLD' ? 'STATIC_PRESENT' : 'OFFSCREEN_STAGGERED';
  const reEntryPolicy: 'NEVER' | 'SAME_IDENTITY' =
    (lc === 'STATIC_HOLD' || lc === 'ENTER_AND_STAY') ? 'NEVER' : 'SAME_IDENTITY';
  return Object.freeze({
    characterId: r2.characterId, actualLabel: r2.actualLabel,
    homeObservationZone: r2.homeObservationZone, lifecycle: lc,
    movementRole, initialState,
    entry: r2.entry, target: r2.target, mainBehavior: r2.mainBehavior, exit: r2.exit,
    reEntryPolicy, ...(r2.historyBehavior ? { historyBehavior: r2.historyBehavior } : {}),
  });
}

// ---------------------------------------------------------------------------
// Scenario Round Reset
// ---------------------------------------------------------------------------

/**
 * applyRound2ToGroup
 *
 * Applies Round 2 assignments to an existing Round1Group IN PLACE.
 * Does NOT reload map / recreate NavigationGraph / LaneRuntime.
 *
 * Resets (per Section 31.1):
 *   userLabel, aiLabel, verifiedLabel -> null
 *   behaviorHistory -> []
 *   stop/transition reservations -> cleared
 * Preserves: Map, NavigationGraph, LaneRuntime, Character visual definition
 */
export function applyRound2ToGroup(
  group: Round1Group,
  map: GrayboxMap,
  cameras: readonly CameraZone[],
): void {
  // 1. Clear all lane reservations
  group.laneRuntime.coordination.stopReservations.clear();
  group.laneRuntime.coordination.transitionReservations.clear();

  // 2. Reload scenario points (same 23 points, same TMJ)
  const scenarioPoints = loadNpcScenarioPoints(map);
  (group as any).scenarioPoints = scenarioPoints;

  // 3. Build assignment objects
  const newAssignments = ROUND2_ROWS.map(rowToAssignment);
  const movingNew = newAssignments.filter(a => a.initialState === 'OFFSCREEN_STAGGERED');

  // 4. Reset group state
  (group as any).elapsed = 0;
  (group as any).paused = false;
  (group as any).scenario = { roundId: 'ROUND_2', assignments: Object.freeze(newAssignments) };

  // 5. Reset each NPC
  for (const npc of group.npcs) {
    const a2 = newAssignments.find(a => a.characterId === npc.definition.id);
    if (!a2) throw new Error(`Round 2 missing assignment for ${npc.definition.id}`);

    // Patch assignment
    (npc as any).assignment = a2;

    // Reset labels and history
    npc.character.labels.userLabel = null;
    npc.character.labels.aiLabel = null;
    npc.character.labels.aiConfidence = null;
    npc.character.world.behaviorHistory = [];
    npc.character.training.usedForTraining = false;
    npc.verifiedLabel = null;
    npc.cycle = 0;
    npc.stallReports = [];
    npc.stalledCandidate = false;
    (npc as any).blockedByNpc = undefined;
    (npc as any).transitionReservation = undefined;
    (npc as any).pointPlan = undefined;
    (npc as any).rejoinPath = undefined;
    (npc as any).rejoinNode = undefined;
    (npc as any).stopPoint = undefined;

    if (a2.historyBehavior) {
      appendBehaviorHistory(npc.character, -1,
        { primitive: primitiveFn(a2.historyBehavior), semantic: a2.historyBehavior }, 'OFFSCREEN');
    }

    if (a2.initialState === 'STATIC_PRESENT') {
      const pt = scenarioPoints.get(a2.target!)!;
      npc.active = true; npc.visible = true;
      npc.phase = 'HOLDING'; npc.holdRemaining = Infinity;
      npc.position = { x: pt.x, y: pt.y };
      npc.currentNode = a2.entry ?? 'N01';
      npc.targetNode = a2.target!;
      npc.character.world.currentZone = 'PLAZA';
      npc.path = findNavigationPath(group.graph, npc.currentNode, npc.currentNode);
      npc.pathPointIndex = 1;
      npc.admissionAt = Infinity;
      npc.watchdogAnchor = { time: 0, x: pt.x, y: pt.y };
      npc.currentObservationZone = cameraAt(cameras, pt.x, pt.y);
      group.laneRuntime.coordination.stopReservations.set(a2.target!, a2.characterId);
      appendBehaviorHistory(npc.character, 0,
        { primitive: primitiveFn(a2.mainBehavior), semantic: a2.mainBehavior }, a2.target!);
    } else {
      const startName = a2.entry ?? 'N01';
      const startPt = group.graph.nodes.get(startName)!;
      npc.active = false; npc.visible = false;
      npc.phase = 'OFFSCREEN';
      npc.position = { x: startPt.x, y: startPt.y };
      npc.currentNode = startName; npc.targetNode = startName;
      npc.character.world.currentZone = 'OFFSCREEN';
      npc.path = findNavigationPath(group.graph, startName, startName);
      npc.pathPointIndex = 1;
      npc.currentObservationZone = null;
      npc.admissionAt = (movingNew.indexOf(a2) + 1) * group.config.admissionIntervalSeconds;
      npc.watchdogAnchor = { time: 0, x: startPt.x, y: startPt.y };
    }
  }

  // 6. Rebuild pointPlans
  const authored = [...scenarioPoints.values(), ...group.laneRuntime.stops.values()];
  const newPointPlans = new Map<CharacterId, any>();
  for (const a2 of newAssignments.filter(a => a.initialState === 'OFFSCREEN_STAGGERED' && a.target)) {
    const pt = (scenarioPoints.get(a2.target!) ?? group.laneRuntime.stops.get(a2.target!)) as AuthoredPoint;
    if (!pt) throw new Error(`Round 2 point not found: ${a2.target}`);
    const entry = group.graph.nodes.get(a2.entry!)!;
    const occupied = authored
      .filter(o => o.name !== pt.name)
      .map(o => Object.freeze({ x: o.x - 13, y: o.y - 8, width: 26, height: 16 }));
    const plan = reserveAuthoredPointMovementPlan(
      group.laneRuntime, pt, a2.entry!, entry, a2.characterId, occupied,
    );
    if (!plan) throw new Error(`Round 2: no safe connector for ${pt.name}`);
    newPointPlans.set(a2.characterId, plan);
    releaseStopReservation(group.laneRuntime, pt.name, a2.characterId);
  }
  (group as any).pointPlans = newPointPlans;
}

// ---------------------------------------------------------------------------
// Round 2 State Queries
// ---------------------------------------------------------------------------

export function round2TrainingState(group: Round1Group) {
  const targetIds = new Set(ROUND2_COMPARISON_PLAN.map(e => e.characterId));
  const targets = group.npcs.filter(npc => targetIds.has(npc.assignment.characterId));
  const compared = targets.filter(npc => npc.character.labels.aiLabel !== null);
  const verified = targets.filter(npc => npc.verifiedLabel !== null);
  const aiWrongVerified = verified.filter(npc => {
    const plan = ROUND2_COMPARISON_PLAN.find(e => e.characterId === npc.assignment.characterId);
    return plan && plan.aiLabel !== npc.assignment.actualLabel;
  });
  return Object.freeze({
    comparedCount: compared.length,
    verifiedCount: verified.length,
    aiWrongVerifiedCount: aiWrongVerified.length,
    retrainingReady: aiWrongVerified.length >= 3,
  });
}

