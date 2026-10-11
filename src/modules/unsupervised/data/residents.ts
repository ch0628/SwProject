// 비지도학습 주민 데이터 (12명)
// - species: PRD 스토리보드 기준 원래 동물. 신규 에셋이 생기면 sprite만 교체한다.
// - sprite: 1차 placeholder. 기존 5종(rabbit/cat/fox/dog/tiger) 스프라이트를 재사용한다.
// - features: 내부 연속값(0~1). 화면 라벨은 features.ts의 구간으로 만든다.
// - isVillain: Scene 7 정체 공개 전용. 군집 계산에는 toClusterInput()으로 제거한 값만 넘긴다.
// - AI 보안관(Scene 7)은 주민이 아니며, 1차는 기존 캐릭터를 재사용한다 (UI 단계에서 연결).
import type { Gender, Species as SpriteSpecies } from '../../../characterManifest.ts';
import type { ClusterInput, FeatureVector, ResidentId } from '../sim/clusteringEngine.ts';

export type ResidentSpecies = 'rabbit' | 'squirrel' | 'deer' | 'owl' | 'fox' | 'tiger' | 'dog' | 'cat' | 'raccoon' | 'wolf';

export type ResidentDefinition = Readonly<{
  id: ResidentId;
  species: ResidentSpecies;
  sprite: Readonly<{ species: SpriteSpecies; gender: Gender }>;
  features: FeatureVector;
  isVillain: boolean;
}>;

const r = (
  id: ResidentId, species: ResidentSpecies, sprite: [SpriteSpecies, Gender],
  food: number, activeTime: number, belongings: number, footprint: number, isVillain = false,
): ResidentDefinition => Object.freeze({
  id, species, sprite: Object.freeze({ species: sprite[0], gender: sprite[1] }),
  features: Object.freeze({ food, activeTime, belongings, footprint }), isVillain,
});

// 정답 조합(먹는 음식 + 활동 시간)에서 4개 군집이 된다.
//   초식·낮: R01~R03 / 초식·밤: R04~R05 / 육식·낮: R06~R08 / 육식·밤: R09~R12 (악당 3 + 시민 고양이 1)
// 악당 3명은 소지품과 발자국 값이 서로 달라, 다른 조합에서는 여러 군집으로 흩어진다.
export const RESIDENTS: readonly ResidentDefinition[] = Object.freeze([
  //  id     species     sprite                food  time  items foot
  r('R01', 'rabbit',   ['rabbit', 'female'],  0.05, 0.10, 0.15, 0.10),
  r('R02', 'squirrel', ['rabbit', 'male'],    0.12, 0.05, 0.80, 0.12),
  r('R03', 'rabbit',   ['rabbit', 'male'],    0.08, 0.15, 0.10, 0.88),
  r('R04', 'deer',     ['dog', 'male'],       0.10, 0.88, 0.12, 0.90),
  r('R05', 'owl',      ['cat', 'male'],       0.15, 0.92, 0.85, 0.15),
  r('R06', 'fox',      ['fox', 'female'],     0.90, 0.10, 0.12, 0.15),
  r('R07', 'tiger',    ['tiger', 'male'],     0.95, 0.08, 0.88, 0.90),
  r('R08', 'dog',      ['dog', 'female'],     0.82, 0.15, 0.15, 0.85),
  r('R09', 'cat',      ['cat', 'female'],     0.88, 0.90, 0.10, 0.12),
  r('R10', 'raccoon',  ['dog', 'male'],       0.85, 0.88, 0.85, 0.80, true),
  r('R11', 'wolf',     ['tiger', 'female'],   0.92, 0.95, 0.15, 0.90, true),
  r('R12', 'fox',      ['fox', 'male'],       0.95, 0.85, 0.20, 0.20, true),
]);

export const toClusterInput = ({ id, features }: ResidentDefinition): ClusterInput => Object.freeze({ id, features });

export const villainIds = (residents: readonly ResidentDefinition[]): ReadonlySet<ResidentId> =>
  new Set(residents.filter((resident) => resident.isVillain).map((resident) => resident.id));
