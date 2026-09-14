/**
 * supervisedGameFlow.ts
 *
 * 8-state Supervised Learning Game State Machine
 * States: MANUAL_LABELING -> FIRST_TRAINING -> HUMAN_AI_COMPARE ->
 *         TRACKING_REVIEW -> RETRAINING -> AI_ASSISTED_MONITORING ->
 *         FINAL_SCAN -> COMPLETE
 *
 * Rules:
 *   - Game State != NPC movement state (separated per Section 31.2)
 *   - TRACKING_REVIEW is a reusable sub-state / overlay (Section 31.3)
 *   - All actualLabel reads go through RoundCharacterAssignment.actualLabel
 */

import type { CharacterId, CharacterLabel, BehaviorHistoryEntry } from './characterPool.ts';
import type { AIConfidence } from './characterPool.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SupervisedGameState =
  | 'MANUAL_LABELING'
  | 'FIRST_TRAINING'
  | 'HUMAN_AI_COMPARE'
  | 'TRACKING_REVIEW'
  | 'RETRAINING'
  | 'AI_ASSISTED_MONITORING'
  | 'FINAL_SCAN'
  | 'COMPLETE';

export type TrackingReviewContext = 'VERIFICATION' | 'COMPARE' | 'MONITORING';

export type GameFlowState = {
  phase: SupervisedGameState;
  round: 1 | 2;
  /** TRACKING_REVIEW: which NPC is being reviewed */
  trackingNpcId: CharacterId | null;
  /** context that opened tracking review */
  trackingContext: TrackingReviewContext | null;
  /** AI training progression */
  aiTraining: {
    totalVerifiedData: number;   // from Round 1 verification
    correctionData: number;      // from Round 2 AI-wrong corrections
    trainingStage: 'NONE' | 'FIRST' | 'RETRAINED';
  };
  /** Set of distinct CharacterIds verified during AI_ASSISTED_MONITORING */
  aiMonitorVerifiedIds: readonly CharacterId[];
  /** FINAL_SCAN animation complete */
  scanComplete: boolean;
};

export type CompareReveal = Readonly<{
  npcId: CharacterId;
  userLabel: CharacterLabel | null;
  aiLabel: CharacterLabel;
  aiConfidence: AIConfidence;
  actualLabel: CharacterLabel;  // only revealed post-verification
  aiCorrect: boolean;
  userCorrect: boolean | null;
}>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameFlow(): GameFlowState {
  return {
    phase: 'MANUAL_LABELING',
    round: 1,
    trackingNpcId: null,
    trackingContext: null,
    aiTraining: { totalVerifiedData: 0, correctionData: 0, trainingStage: 'NONE' },
    aiMonitorVerifiedIds: [],
    scanComplete: false,
  };
}

// ---------------------------------------------------------------------------
// Transition helpers (pure - callers mutate the state object)
// ---------------------------------------------------------------------------

export function canStartFirstTraining(flow: GameFlowState, verifiedCount: number): boolean {
  return flow.phase === 'MANUAL_LABELING' && verifiedCount >= 8;
}

export function startFirstTraining(flow: GameFlowState, totalVerified: number): void {
  if (flow.phase !== 'MANUAL_LABELING') return;
  flow.phase = 'FIRST_TRAINING';
  flow.aiTraining.totalVerifiedData = totalVerified;
  flow.aiTraining.trainingStage = 'FIRST';
}

export function completeFirstTraining(flow: GameFlowState): void {
  if (flow.phase !== 'FIRST_TRAINING') return;
  flow.phase = 'HUMAN_AI_COMPARE';
  flow.round = 2;
}

export function openTrackingReview(
  flow: GameFlowState,
  npcId: CharacterId,
  context: TrackingReviewContext,
): void {
  flow.trackingNpcId = npcId;
  flow.trackingContext = context;
  flow.phase = 'TRACKING_REVIEW';
}

export function closeTrackingReview(flow: GameFlowState, returnPhase: SupervisedGameState): void {
  flow.trackingNpcId = null;
  flow.trackingContext = null;
  flow.phase = returnPhase;
}

export type Round2TrainingStateObj = Readonly<{
  comparedCount: number;
  verifiedCount: number;
  aiWrongVerifiedCount: number;
  retrainingReady: boolean;
}>;

export function canStartRetraining(flow: GameFlowState, r2State: Round2TrainingStateObj | null): boolean {
  if (flow.phase !== 'HUMAN_AI_COMPARE' || !r2State) return false;
  return r2State.retrainingReady;
}

export function startRetraining(flow: GameFlowState, correctionCount: number): void {
  if (flow.phase !== 'HUMAN_AI_COMPARE') return;
  flow.phase = 'RETRAINING';
  flow.aiTraining.correctionData = correctionCount;
}

export function completeRetraining(flow: GameFlowState): void {
  if (flow.phase !== 'RETRAINING') return;
  flow.phase = 'AI_ASSISTED_MONITORING';
  flow.aiTraining.trainingStage = 'RETRAINED';
}

export function canStartFinalScan(flow: GameFlowState, aiMonitorVerifiedCount: number): boolean {
  return flow.phase === 'AI_ASSISTED_MONITORING' && aiMonitorVerifiedCount >= 3;
}

export function startFinalScan(flow: GameFlowState): void {
  if (flow.phase !== 'AI_ASSISTED_MONITORING') return;
  flow.phase = 'FINAL_SCAN';
  flow.scanComplete = false;
}

export function completeFinalScan(flow: GameFlowState): void {
  if (flow.phase !== 'FINAL_SCAN') return;
  flow.scanComplete = true;
  flow.phase = 'COMPLETE';
}
