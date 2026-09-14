import type { Gender, Species } from './characterManifest.ts';

export type CharacterId = `NPC${string}`;
export type CharacterLabel = 'CITIZEN' | 'VILLAIN';
export type LearningPhase = 'MANUAL_LABELING' | 'HUMAN_AI_COMPARE' | 'AI_ASSISTED_MONITORING';
export type Difficulty = 'EASY' | 'MEDIUM' | 'NORMAL' | 'AMBIGUOUS';
export type WorldZone = 'PLAZA' | 'SHOPPING' | 'RESIDENTIAL' | 'OFFSCREEN';
export type TrackingReview = 'NONE' | 'OPTIONAL' | 'REQUIRED';
export type AIConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type BehaviorPrimitive = 'WALK' | 'RUN' | 'IDLE' | 'REST' | 'INTERACT' | 'TALK' | 'SUSPICIOUS_ACTION' | 'ENTER' | 'EXIT';
export type SemanticBehavior =
  | 'ENTERING' | 'WALKING' | 'RESTING' | 'VISITING_FACILITY' | 'RETURNING_HOME' | 'VANDALIZING'
  | 'ESCAPING' | 'VISITING_CAFE' | 'THREATENING' | 'JOGGING' | 'TRANSITING'
  | 'TALKING' | 'SNATCHING' | 'CAFE_SERVICE' | 'REPAIRING' | 'MANHOLE_TAMPER'
  | 'STEALING' | 'EXERCISING' | 'RUNNING' | 'IDLING' | 'CARRYING_TOOLS'
  | 'WAITING' | 'LOOKING_AROUND' | 'DELIVERING' | 'COMMUTING';
export type PlazaIntent =
  | 'PARK_WALK' | 'BENCH_REST' | 'FACILITY_VISIT' | 'VANDALIZE' | 'ESCAPE'
  | 'CAFE_VISIT' | 'THREATEN' | 'JOG' | 'PLAZA_TRANSIT' | 'TALK' | 'SNATCH'
  | 'CAFE_SERVICE' | 'TRANSIT' | 'FACILITY_REPAIR' | 'MANHOLE_TAMPER' | 'THEFT'
  | 'EXERCISE' | 'WALK' | 'RUN' | 'IDLE' | 'CARRY_TOOLS' | 'REPAIR' | 'WAIT'
  | 'LOOK_AROUND' | 'DELIVERY' | 'COMMUTE' | 'EXIT';

export type PlannedAI = Readonly<{
  label: CharacterLabel;
  confidence: AIConfidence | null;
  outcome: 'CORRECT' | 'WRONG';
  compareCase?: 'USER_MAY_MISLABEL' | 'USER_CAN_CORRECT_FROM_HISTORY' | 'BOTH_MAY_BE_WRONG';
}>;

export type CharacterDefinition = Readonly<{
  id: CharacterId;
  species: Species;
  gender: Gender;
  verifiedLabel: CharacterLabel;
  primaryPhase: LearningPhase;
  difficulty: Difficulty;
  zoneSequence: readonly WorldZone[];
  behaviorStory: readonly SemanticBehavior[];
  plazaIntents: readonly PlazaIntent[];
  trackingReview: TrackingReview;
  plannedAI: PlannedAI | null;
}>;

export type BehaviorState = Readonly<{ primitive: BehaviorPrimitive; semantic: SemanticBehavior }>;
export type BehaviorHistoryEntry = Readonly<{
  simulationTime: number;
  zone: WorldZone;
  behavior: BehaviorState;
  location?: string;
}>;

export type CharacterRuntimeState = {
  identity: Readonly<{ id: CharacterId }>;
  world: {
    currentZone: WorldZone;
    currentBehavior: BehaviorState;
    behaviorHistory: BehaviorHistoryEntry[];
  };
  labels: { userLabel: CharacterLabel | null; aiLabel: CharacterLabel | null; aiConfidence: AIConfidence | null };
  training: { usedForTraining: boolean };
};

const ai = (label: CharacterLabel, confidence: AIConfidence | null, outcome: 'CORRECT' | 'WRONG', compareCase?: PlannedAI['compareCase']): PlannedAI =>
  Object.freeze({ label, confidence, outcome, ...(compareCase ? { compareCase } : {}) });

const d = (
  id: CharacterId, species: Species, gender: Gender, verifiedLabel: CharacterLabel,
  primaryPhase: LearningPhase, difficulty: Difficulty, zoneSequence: WorldZone[],
  behaviorStory: SemanticBehavior[], plazaIntents: PlazaIntent[], trackingReview: TrackingReview,
  plannedAI: PlannedAI | null = null,
): CharacterDefinition => Object.freeze({
  id, species, gender, verifiedLabel, primaryPhase, difficulty,
  zoneSequence: Object.freeze(zoneSequence), behaviorStory: Object.freeze(behaviorStory),
  plazaIntents: Object.freeze(plazaIntents), trackingReview, plannedAI,
});

export const CHARACTER_POOL: readonly CharacterDefinition[] = Object.freeze([
  d('NPC01','rabbit','female','CITIZEN','MANUAL_LABELING','EASY',['PLAZA'],['WALKING','RESTING','WALKING'],['PARK_WALK','BENCH_REST'],'NONE'),
  d('NPC02','cat','male','CITIZEN','MANUAL_LABELING','EASY',['PLAZA','RESIDENTIAL'],['VISITING_FACILITY','RETURNING_HOME'],['FACILITY_VISIT'],'NONE'),
  d('NPC03','dog','female','VILLAIN','MANUAL_LABELING','EASY',['PLAZA'],['VANDALIZING','ESCAPING'],['VANDALIZE','ESCAPE'],'NONE'),
  d('NPC04','fox','male','CITIZEN','MANUAL_LABELING','EASY',['PLAZA','SHOPPING'],['VISITING_CAFE','RESTING','WALKING'],['CAFE_VISIT'],'NONE'),
  d('NPC05','tiger','female','VILLAIN','MANUAL_LABELING','EASY',['PLAZA','RESIDENTIAL'],['THREATENING','ESCAPING'],['THREATEN','ESCAPE'],'NONE'),
  d('NPC06','rabbit','male','CITIZEN','MANUAL_LABELING','EASY',['PLAZA','SHOPPING'],['JOGGING','TRANSITING'],['JOG','PLAZA_TRANSIT'],'NONE'),
  d('NPC07','cat','female','CITIZEN','MANUAL_LABELING','EASY',['PLAZA'],['TALKING','WALKING'],['TALK','PARK_WALK'],'NONE'),
  d('NPC08','dog','male','VILLAIN','MANUAL_LABELING','EASY',['PLAZA','SHOPPING'],['SNATCHING','ESCAPING'],['SNATCH','ESCAPE'],'NONE'),
  d('NPC09','fox','female','CITIZEN','MANUAL_LABELING','EASY',['PLAZA','SHOPPING'],['CAFE_SERVICE','TRANSITING'],['CAFE_SERVICE','TRANSIT'],'NONE'),
  d('NPC10','tiger','male','CITIZEN','MANUAL_LABELING','MEDIUM',['PLAZA'],['CARRYING_TOOLS','REPAIRING'],['FACILITY_REPAIR'],'OPTIONAL'),
  d('NPC11','rabbit','female','VILLAIN','MANUAL_LABELING','EASY',['PLAZA'],['MANHOLE_TAMPER','ESCAPING'],['MANHOLE_TAMPER','ESCAPE'],'NONE'),
  d('NPC12','cat','male','CITIZEN','MANUAL_LABELING','EASY',['PLAZA','RESIDENTIAL'],['VISITING_FACILITY','RETURNING_HOME'],['FACILITY_VISIT'],'NONE'),
  d('NPC13','dog','female','CITIZEN','MANUAL_LABELING','EASY',['PLAZA','SHOPPING'],['WALKING','TRANSITING'],['PARK_WALK','PLAZA_TRANSIT'],'NONE'),
  d('NPC14','fox','male','VILLAIN','MANUAL_LABELING','EASY',['PLAZA','SHOPPING'],['STEALING','ESCAPING'],['THEFT','ESCAPE'],'NONE'),
  d('NPC15','tiger','female','CITIZEN','MANUAL_LABELING','EASY',['PLAZA'],['EXERCISING','WALKING'],['EXERCISE','WALK'],'NONE'),
  d('NPC16','rabbit','male','CITIZEN','MANUAL_LABELING','MEDIUM',['PLAZA'],['RUNNING','VISITING_FACILITY'],['RUN','FACILITY_VISIT'],'REQUIRED'),
  d('NPC17','cat','female','VILLAIN','MANUAL_LABELING','MEDIUM',['PLAZA'],['IDLING','VANDALIZING','ESCAPING'],['IDLE','VANDALIZE','ESCAPE'],'REQUIRED'),
  d('NPC18','dog','male','CITIZEN','MANUAL_LABELING','MEDIUM',['PLAZA'],['CARRYING_TOOLS','REPAIRING'],['CARRY_TOOLS','REPAIR'],'REQUIRED'),
  d('NPC19','fox','female','CITIZEN','HUMAN_AI_COMPARE','AMBIGUOUS',['RESIDENTIAL','PLAZA'],['RUNNING','TRANSITING'],['RUN','PLAZA_TRANSIT'],'REQUIRED',ai('CITIZEN',null,'CORRECT','USER_MAY_MISLABEL')),
  d('NPC20','tiger','male','VILLAIN','HUMAN_AI_COMPARE','AMBIGUOUS',['SHOPPING','PLAZA'],['STEALING','WALKING'],['PLAZA_TRANSIT'],'REQUIRED',ai('VILLAIN',null,'CORRECT','USER_MAY_MISLABEL')),
  d('NPC21','rabbit','female','CITIZEN','HUMAN_AI_COMPARE','AMBIGUOUS',['PLAZA'],['CARRYING_TOOLS','REPAIRING'],['FACILITY_REPAIR'],'REQUIRED',ai('CITIZEN',null,'CORRECT','USER_MAY_MISLABEL')),
  d('NPC22','cat','male','VILLAIN','HUMAN_AI_COMPARE','AMBIGUOUS',['PLAZA'],['VANDALIZING','RESTING'],['BENCH_REST'],'REQUIRED',ai('CITIZEN',null,'WRONG','USER_CAN_CORRECT_FROM_HISTORY')),
  d('NPC23','dog','female','CITIZEN','HUMAN_AI_COMPARE','AMBIGUOUS',['PLAZA'],['LOOKING_AROUND','WAITING'],['WAIT','LOOK_AROUND'],'REQUIRED',ai('VILLAIN',null,'WRONG','USER_CAN_CORRECT_FROM_HISTORY')),
  d('NPC24','fox','male','CITIZEN','HUMAN_AI_COMPARE','AMBIGUOUS',['SHOPPING','PLAZA'],['DELIVERING','RUNNING'],['DELIVERY','RUN'],'REQUIRED',ai('VILLAIN',null,'WRONG','BOTH_MAY_BE_WRONG')),
  d('NPC25','tiger','female','VILLAIN','HUMAN_AI_COMPARE','AMBIGUOUS',['SHOPPING','PLAZA'],['THREATENING','VISITING_CAFE'],['CAFE_VISIT'],'REQUIRED',ai('VILLAIN',null,'CORRECT','USER_MAY_MISLABEL')),
  d('NPC26','rabbit','male','CITIZEN','HUMAN_AI_COMPARE','AMBIGUOUS',['PLAZA'],['DELIVERING','VISITING_FACILITY'],['DELIVERY','FACILITY_VISIT'],'REQUIRED',ai('CITIZEN',null,'CORRECT','USER_MAY_MISLABEL')),
  d('NPC27','cat','female','CITIZEN','AI_ASSISTED_MONITORING','NORMAL',['RESIDENTIAL','PLAZA'],['COMMUTING','WALKING'],['COMMUTE','WALK'],'NONE',ai('CITIZEN','HIGH','CORRECT')),
  d('NPC28','dog','male','VILLAIN','AI_ASSISTED_MONITORING','NORMAL',['PLAZA'],['MANHOLE_TAMPER'],['MANHOLE_TAMPER'],'OPTIONAL',ai('VILLAIN','HIGH','CORRECT')),
  d('NPC29','fox','female','CITIZEN','AI_ASSISTED_MONITORING','NORMAL',['PLAZA','SHOPPING'],['VISITING_CAFE','COMMUTING'],['CAFE_VISIT','COMMUTE'],'NONE',ai('CITIZEN','HIGH','CORRECT')),
  d('NPC30','tiger','male','CITIZEN','AI_ASSISTED_MONITORING','NORMAL',['PLAZA'],['EXERCISING','TRANSITING'],['EXERCISE','PLAZA_TRANSIT'],'NONE',ai('CITIZEN','HIGH','CORRECT')),
  d('NPC31','rabbit','female','VILLAIN','AI_ASSISTED_MONITORING','AMBIGUOUS',['SHOPPING','PLAZA'],['STEALING','WALKING'],['PLAZA_TRANSIT'],'REQUIRED',ai('CITIZEN','LOW','WRONG')),
  d('NPC32','cat','male','CITIZEN','AI_ASSISTED_MONITORING','NORMAL',['PLAZA'],['VISITING_FACILITY'],['FACILITY_VISIT'],'NONE',ai('CITIZEN','HIGH','CORRECT')),
  d('NPC33','dog','female','CITIZEN','AI_ASSISTED_MONITORING','NORMAL',['PLAZA','RESIDENTIAL'],['COMMUTING'],['COMMUTE','EXIT'],'NONE',ai('CITIZEN','MEDIUM','CORRECT')),
  d('NPC34','fox','male','VILLAIN','AI_ASSISTED_MONITORING','AMBIGUOUS',['SHOPPING','PLAZA'],['STEALING','TRANSITING'],['PLAZA_TRANSIT'],'REQUIRED',ai('VILLAIN','MEDIUM','CORRECT')),
  d('NPC35','tiger','female','CITIZEN','AI_ASSISTED_MONITORING','AMBIGUOUS',['PLAZA'],['REPAIRING'],['FACILITY_REPAIR'],'OPTIONAL',ai('CITIZEN','MEDIUM','CORRECT')),
]);

export const characterDefinition = (id: CharacterId) => CHARACTER_POOL.find(character => character.id === id);

export function createCharacterRuntimeState(definition: CharacterDefinition, initialZone: WorldZone = 'PLAZA'): CharacterRuntimeState {
  return {
    identity: Object.freeze({ id: definition.id }),
    world: { currentZone: initialZone, currentBehavior: Object.freeze({ primitive: 'IDLE', semantic: 'IDLING' }), behaviorHistory: [] },
    labels: { userLabel: null, aiLabel: null, aiConfidence: null },
    training: { usedForTraining: false },
  };
}

export function appendBehaviorHistory(state: CharacterRuntimeState, simulationTime: number, behavior: BehaviorState, location?: string) {
  state.world.currentBehavior = Object.freeze({ ...behavior });
  state.world.behaviorHistory.push(Object.freeze({ simulationTime, zone: state.world.currentZone, behavior: state.world.currentBehavior, ...(location ? { location } : {}) }));
}

export function characterStateView(definition: CharacterDefinition, runtime: CharacterRuntimeState) {
  return {
    ...runtime,
    labels: { ...runtime.labels, verifiedLabel: definition.verifiedLabel },
  };
}
