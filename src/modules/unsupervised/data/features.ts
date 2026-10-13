// 비지도학습 특징 정의 (PRD v1.0.0 Scene 3)와 사건 단서 (Scene 1)
import type { ClueTarget, FeatureKey } from '../sim/clusteringEngine.ts';

export type FeatureLevel = Readonly<{ id: string; label: string; max: number }>;

export type FeatureDefinition = Readonly<{
  key: FeatureKey;
  label: string;
  /** 축의 0 쪽 라벨과 1 쪽 라벨 */
  axis: readonly [string, string];
  /** 내부 연속값 → 화면 라벨 구간. max 오름차순, 마지막 max는 1. */
  levels: readonly FeatureLevel[];
}>;

export const FEATURE_DEFINITIONS: Readonly<Record<FeatureKey, FeatureDefinition>> = Object.freeze({
  food: {
    key: 'food', label: '먹는 음식', axis: ['초식', '육식'],
    levels: [{ id: 'HERBIVORE', label: '초식', max: 1 / 3 }, { id: 'OMNIVORE', label: '잡식', max: 2 / 3 }, { id: 'CARNIVORE', label: '육식', max: 1 }],
  },
  activeTime: {
    key: 'activeTime', label: '활동 시간', axis: ['낮', '밤'],
    levels: [{ id: 'DAY', label: '낮', max: 0.5 }, { id: 'NIGHT', label: '밤', max: 1 }],
  },
  belongings: {
    key: 'belongings', label: '소지품', axis: ['생활용품', '수상한 도구'],
    levels: [{ id: 'DAILY', label: '생활용품', max: 0.5 }, { id: 'SUSPICIOUS', label: '수상한 도구', max: 1 }],
  },
  footprint: {
    key: 'footprint', label: '발자국 크기', axis: ['작음', '큼'],
    levels: [{ id: 'SMALL', label: '작음', max: 0.5 }, { id: 'LARGE', label: '큼', max: 1 }],
  },
});

export function featureLevel(key: FeatureKey, value: number): FeatureLevel {
  const levels = FEATURE_DEFINITIONS[key].levels;
  return levels.find((level) => value <= level.max) ?? levels[levels.length - 1];
}

/** Scene 1 단서: 고기를 먹은 흔적(육식 쪽), 밤늦게 움직이는 모습(밤 쪽) */
export const INCIDENT_CLUE: ClueTarget = Object.freeze({ food: 1, activeTime: 1 });
