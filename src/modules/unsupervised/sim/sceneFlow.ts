// 비지도학습 장면 상태 머신 (PRD v1.0.0 Scene 1~8, 렌더링 의존 없는 순수 로직)
// - transition(state, event)는 새 상태를 돌려준다. 허용되지 않은 이벤트는 같은 상태 객체를 그대로 돌려준다.
// - 난수를 사용하지 않는다: 같은 이벤트 순서 → 같은 상태.
import {
  assertValidPair,
  clueMatch,
  clusterResidents,
  nearestClusterToClue,
  type ClueMatch,
  type ClueTarget,
  type ClusterResult,
  type FeatureKey,
  type FeaturePair,
  type ResidentId,
} from './clusteringEngine.ts';
import { DIALOGUE } from '../data/dialogue.ts';
import { INCIDENT_CLUE } from '../data/features.ts';
import { RESIDENTS, toClusterInput, type ResidentDefinition } from '../data/residents.ts';

export type FlowStep =
  | 'INCIDENT'          // Scene 1 사건 발생
  | 'EXPLAIN'           // Scene 2 비지도학습 설명
  | 'FEATURE_SELECT'    // Scene 3 분석 기준 선택
  | 'PATTERN_FIND'      // Scene 4 주민 자동 배치
  | 'CLUSTER_REVIEW'    // Scene 5 군집 형성 확인
  | 'FEATURE_FEEDBACK'  // Scene 5 단서와 비교할 수 없는 조합 → 흐릿함 피드백
  | 'CLUE_COMPARE'      // Scene 6 사건 단서와 비교
  | 'ORDINARY_RESULT'   // Scene 6 틀린 군집 → 평범한 주민
  | 'INVESTIGATE'       // Scene 7 수상한 군집 조사
  | 'COMPLETE';         // Scene 8 학습 및 마무리

export const FLOW_STEPS: readonly FlowStep[] = [
  'INCIDENT', 'EXPLAIN', 'FEATURE_SELECT', 'PATTERN_FIND', 'CLUSTER_REVIEW',
  'FEATURE_FEEDBACK', 'CLUE_COMPARE', 'ORDINARY_RESULT', 'INVESTIGATE', 'COMPLETE',
];

export const PRD_SCENE: Readonly<Record<FlowStep, number>> = Object.freeze({
  INCIDENT: 1, EXPLAIN: 2, FEATURE_SELECT: 3, PATTERN_FIND: 4, CLUSTER_REVIEW: 5,
  FEATURE_FEEDBACK: 5, CLUE_COMPARE: 6, ORDINARY_RESULT: 6, INVESTIGATE: 7, COMPLETE: 8,
});

export type FlowEvent =
  | { type: 'NEXT_LINE' }                                       // 다음 대사
  | { type: 'PROCEED' }                                         // 장면 버튼: 단서 확인 완료 / 분석 시작 / 군집 살펴보기 / 확인 / 완료
  | { type: 'SELECT_FEATURES'; features: readonly FeatureKey[] } // [특징 선택 완료]
  | { type: 'FIND_PATTERNS' }                                   // [패턴 찾기]
  | { type: 'INSPECT_CLUSTER'; clusterId: string }              // Scene 5 군집 클릭
  | { type: 'RESELECT_FEATURES' }                               // 흐릿함 피드백 후 특징 다시 고르기
  | { type: 'SELECT_CLUSTER'; clusterId: string }               // Scene 6 군집 선택
  | { type: 'INVESTIGATE' }                                     // [조사하기]
  | { type: 'RESELECT_CLUSTER' };                               // 평범한 주민 판명 후 다시 고르기

export type FlowState = Readonly<{
  step: FlowStep;
  lineIndex: number;
  selectedFeatures: FeaturePair | null;
  clusterResult: ClusterResult | null;
  /** 'MATCH'가 아니면 UI는 군집을 흐릿하게 보여준다 */
  clueMatch: ClueMatch | null;
  inspectedClusterId: string | null;
  selectedClusterId: string | null;
  /** 조사해서 평범한 주민으로 판명된 군집 (페널티 없음, 다시 고를 수 없음) */
  clearedClusterIds: readonly string[];
  /** Scene 7에서 정체를 드러내는 악당 (조사한 군집의 일부) */
  revealedVillainIds: readonly ResidentId[];
  featureAttempts: number;
  finished: boolean;
}>;

export type FlowContext = Readonly<{
  residents: readonly ResidentDefinition[];
  clue: ClueTarget;
  lineCount: (step: FlowStep) => number;
}>;

export const DEFAULT_FLOW_CONTEXT: FlowContext = Object.freeze({
  residents: RESIDENTS,
  clue: INCIDENT_CLUE,
  lineCount: (step: FlowStep) => DIALOGUE[step].length,
});

export function createInitialFlowState(): FlowState {
  return Object.freeze({
    step: 'INCIDENT',
    lineIndex: 0,
    selectedFeatures: null,
    clusterResult: null,
    clueMatch: null,
    inspectedClusterId: null,
    selectedClusterId: null,
    clearedClusterIds: Object.freeze([]),
    revealedVillainIds: Object.freeze([]),
    featureAttempts: 0,
    finished: false,
  });
}

export function isDialogueDone(state: FlowState, context: FlowContext = DEFAULT_FLOW_CONTEXT): boolean {
  return state.lineIndex >= context.lineCount(state.step) - 1;
}

export function isBlurry(state: FlowState): boolean {
  return state.clueMatch !== null && state.clueMatch !== 'MATCH';
}

const update = (state: FlowState, patch: Partial<FlowState>): FlowState => Object.freeze({ ...state, ...patch });
const goTo = (state: FlowState, step: FlowStep, patch: Partial<FlowState> = {}): FlowState => update(state, { ...patch, step, lineIndex: 0 });
const hasCluster = (state: FlowState, clusterId: string) => state.clusterResult?.clusters.some((cluster) => cluster.id === clusterId) ?? false;

function validPair(features: readonly FeatureKey[]): FeaturePair | null {
  try {
    assertValidPair(features);
    return features;
  } catch {
    return null;
  }
}

export function transition(state: FlowState, event: FlowEvent, context: FlowContext = DEFAULT_FLOW_CONTEXT): FlowState {
  if (state.finished) return state;
  if (event.type === 'NEXT_LINE') return isDialogueDone(state, context) ? state : update(state, { lineIndex: state.lineIndex + 1 });
  // 대사가 끝나기 전에는 장면 조작을 받지 않는다.
  if (!isDialogueDone(state, context)) return state;

  switch (state.step) {
    case 'INCIDENT':
      return event.type === 'PROCEED' ? goTo(state, 'EXPLAIN') : state;
    case 'EXPLAIN':
      return event.type === 'PROCEED' ? goTo(state, 'FEATURE_SELECT') : state;
    case 'FEATURE_SELECT': {
      if (event.type !== 'SELECT_FEATURES') return state;
      const pair = validPair(event.features);
      if (!pair) return state;
      return goTo(state, 'PATTERN_FIND', { selectedFeatures: Object.freeze([...pair]) as FeaturePair, featureAttempts: state.featureAttempts + 1 });
    }
    case 'PATTERN_FIND':
      if (event.type === 'FIND_PATTERNS' && !state.clusterResult) {
        const clusterResult = clusterResidents(context.residents.map(toClusterInput), state.selectedFeatures!);
        return update(state, { clusterResult, clueMatch: clueMatch(clusterResult.pair, context.clue) });
      }
      return event.type === 'PROCEED' && state.clusterResult ? goTo(state, 'CLUSTER_REVIEW') : state;
    case 'CLUSTER_REVIEW':
      if (event.type === 'INSPECT_CLUSTER') return hasCluster(state, event.clusterId) ? update(state, { inspectedClusterId: event.clusterId }) : state;
      if (event.type !== 'PROCEED') return state;
      return goTo(state, state.clueMatch === 'MATCH' ? 'CLUE_COMPARE' : 'FEATURE_FEEDBACK', { inspectedClusterId: null });
    case 'FEATURE_FEEDBACK':
      return event.type === 'RESELECT_FEATURES'
        ? goTo(state, 'FEATURE_SELECT', { selectedFeatures: null, clusterResult: null, clueMatch: null, inspectedClusterId: null })
        : state;
    case 'CLUE_COMPARE':
      if (event.type === 'SELECT_CLUSTER') {
        return hasCluster(state, event.clusterId) && !state.clearedClusterIds.includes(event.clusterId)
          ? update(state, { selectedClusterId: event.clusterId })
          : state;
      }
      if (event.type !== 'INVESTIGATE' || !state.selectedClusterId) return state;
      return investigate(state, context);
    case 'ORDINARY_RESULT':
      return event.type === 'RESELECT_CLUSTER' ? goTo(state, 'CLUE_COMPARE', { selectedClusterId: null }) : state;
    case 'INVESTIGATE':
      return event.type === 'PROCEED' ? goTo(state, 'COMPLETE') : state;
    case 'COMPLETE':
      return event.type === 'PROCEED' ? update(state, { finished: true }) : state;
  }
}

function investigate(state: FlowState, context: FlowContext): FlowState {
  const result = state.clusterResult!;
  const suspect = nearestClusterToClue(result, context.clue);
  const selected = result.clusters.find((cluster) => cluster.id === state.selectedClusterId)!;
  if (selected.id !== suspect?.id) {
    return goTo(state, 'ORDINARY_RESULT', { clearedClusterIds: Object.freeze([...state.clearedClusterIds, selected.id]) });
  }
  const villains = new Set(context.residents.filter((resident) => resident.isVillain).map((resident) => resident.id));
  return goTo(state, 'INVESTIGATE', { revealedVillainIds: Object.freeze(selected.memberIds.filter((id) => villains.has(id))) });
}

export function currentLine(state: FlowState) {
  return DIALOGUE[state.step][state.lineIndex];
}
