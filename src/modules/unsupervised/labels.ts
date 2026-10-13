// 화면 표시용 라벨 (UI 문자열만, 진행 로직 없음)
import type { FlowStep } from './sim/sceneFlow';
import type { ResidentSpecies } from './data/residents';

export const SPECIES_NAME: Readonly<Record<ResidentSpecies, string>> = Object.freeze({
  rabbit: '토끼', squirrel: '다람쥐', deer: '사슴', owl: '부엉이', fox: '여우',
  tiger: '호랑이', dog: '강아지', cat: '고양이', raccoon: '너구리', wolf: '늑대',
});

/** PRD 스토리보드 이미지의 장면 제목 */
export const SCENE_TITLE: Readonly<Record<FlowStep, string>> = Object.freeze({
  TITLE: '수상한 무리를 찾아라!',
  INCIDENT: '사건 발생',
  EXPLAIN: '비지도학습 설명',
  FEATURE_SELECT: '분석 기준 선택',
  PATTERN_FIND: '주민 분류',
  CLUSTER_REVIEW: '군집 형성 확인',
  FEATURE_FEEDBACK: '군집 형성 확인',
  CLUE_COMPARE: '사건 단서와 비교',
  ORDINARY_RESULT: '사건 단서와 비교',
  INVESTIGATE: '수상한 군집 조사',
  COMPLETE: '학습 및 마무리',
});

export const clusterName = (index: number) => `무리 ${index + 1}`;
