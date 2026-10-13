// 비지도학습 군집 엔진 (렌더링 의존 없는 순수 로직)
// - 선택한 특징 2개만 좌표축으로 사용하는 거리 기반 응집형 계층 군집(single-linkage + 거리 임계값)
// - 난수를 사용하지 않는 결정적 알고리즘: 같은 입력 → 같은 결과 (입력 순서와도 무관)
// - 군집 계산은 특징값만 입력으로 받는다. 악당 여부는 절대 군집 계산에 들어가지 않는다.

export const FEATURE_KEYS = ['food', 'activeTime', 'belongings', 'footprint'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** 각 특징의 내부 연속값. 0 = 축의 왼쪽/아래 끝, 1 = 오른쪽/위 끝. */
export type FeatureVector = Readonly<Record<FeatureKey, number>>;

export type ResidentId = `R${string}`;

/** 군집 엔진이 받는 유일한 주민 정보. 악당 여부는 포함하지 않는다. */
export type ClusterInput = Readonly<{ id: ResidentId; features: FeatureVector }>;

export type FeaturePair = readonly [FeatureKey, FeatureKey];

export type ProjectedPoint = Readonly<{ id: ResidentId; x: number; y: number }>;

export type Cluster = Readonly<{
  id: string;
  memberIds: readonly ResidentId[];
  centroid: Readonly<{ x: number; y: number }>;
}>;

export type ClusterResult = Readonly<{
  pair: FeaturePair;
  points: readonly ProjectedPoint[];
  clusters: readonly Cluster[];
}>;

export type ClueTarget = Readonly<Partial<Record<FeatureKey, number>>>;
export type ClueMatch = 'MATCH' | 'PARTIAL' | 'NONE';

/** 선택 축 기준 정규화 거리(0~√2). 이 값 이하로 이어지는 주민끼리 같은 군집이 된다. */
export const CLUSTER_DISTANCE_THRESHOLD = 0.35;

/** 4개 특징 중 2개를 고르는 6가지 조합 (FEATURE_KEYS 순서 기준). */
export const ALL_FEATURE_PAIRS: readonly FeaturePair[] = FEATURE_KEYS.flatMap((first, index) =>
  FEATURE_KEYS.slice(index + 1).map((second) => [first, second] as const),
);

export function assertValidPair(pair: readonly FeatureKey[]): asserts pair is FeaturePair {
  if (pair.length !== 2) throw new Error(`특징은 정확히 2개를 선택해야 한다: ${pair.length}개`);
  if (pair[0] === pair[1]) throw new Error(`같은 특징을 두 번 선택할 수 없다: ${pair[0]}`);
  for (const key of pair) if (!FEATURE_KEYS.includes(key)) throw new Error(`알 수 없는 특징: ${key}`);
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function projectResidents(residents: readonly ClusterInput[], pair: FeaturePair): ProjectedPoint[] {
  assertValidPair(pair);
  return [...residents].sort(byId).map(({ id, features }) => Object.freeze({ id, x: features[pair[0]], y: features[pair[1]] }));
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clusterResidents(
  residents: readonly ClusterInput[],
  pair: FeaturePair,
  threshold = CLUSTER_DISTANCE_THRESHOLD,
): ClusterResult {
  const points = projectResidents(residents, pair);
  const parent = points.map((_, index) => index);
  const root = (index: number): number => (parent[index] === index ? index : (parent[index] = root(parent[index])));
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (distance(points[i], points[j]) <= threshold) parent[root(j)] = root(i);
    }
  }

  const groups = new Map<number, ProjectedPoint[]>();
  points.forEach((point, index) => {
    const key = root(index);
    groups.set(key, [...(groups.get(key) ?? []), point]);
  });

  // points가 id 순으로 정렬되어 있으므로 각 군집의 첫 구성원이 가장 작은 id다.
  const clusters = [...groups.values()]
    .sort((a, b) => byId(a[0], b[0]))
    .map((members, index): Cluster => Object.freeze({
      id: `C${index + 1}`,
      memberIds: Object.freeze(members.map((member) => member.id)),
      centroid: Object.freeze({
        x: members.reduce((sum, member) => sum + member.x, 0) / members.length,
        y: members.reduce((sum, member) => sum + member.y, 0) / members.length,
      }),
    }));

  return Object.freeze({ pair, points: Object.freeze(points), clusters: Object.freeze(clusters) });
}

/** 군집 분할의 정규형 문자열. 같은 분할이면 같은 문자열. */
export function partitionSignature(result: ClusterResult): string {
  return result.clusters.map((cluster) => cluster.memberIds.join(',')).sort().join('|');
}

/** 선택한 조합이 사건 단서와 비교 가능한지. MATCH가 아니면 UI는 "군집이 섞여 흐릿함" 피드백을 보여준다. */
export function clueMatch(pair: FeaturePair, clue: ClueTarget): ClueMatch {
  const clueKeys = Object.keys(clue) as FeatureKey[];
  const matched = clueKeys.filter((key) => pair.includes(key)).length;
  return matched === clueKeys.length ? 'MATCH' : matched > 0 ? 'PARTIAL' : 'NONE';
}

/** 단서와 가장 가까운 군집. 선택 조합이 단서 특징을 모두 포함하지 않으면 비교할 수 없으므로 null. */
export function nearestClusterToClue(result: ClusterResult, clue: ClueTarget): Cluster | null {
  if (clueMatch(result.pair, clue) !== 'MATCH') return null;
  const target = { x: clue[result.pair[0]]!, y: clue[result.pair[1]]! };
  let best: Cluster | null = null;
  for (const cluster of result.clusters) {
    if (!best || distance(cluster.centroid, target) < distance(best.centroid, target)) best = cluster;
  }
  return best;
}

/** Scene 5 군집 클릭 시 보여줄 공통 특징. 구성원의 단계가 모두 같으면 그 단계, 아니면 'MIXED'. */
export function summarizeCluster<Level extends string>(
  cluster: Cluster,
  residents: readonly ClusterInput[],
  levelOf: (key: FeatureKey, value: number) => Level,
): Record<FeatureKey, Level | 'MIXED'> {
  const members = residents.filter((resident) => cluster.memberIds.includes(resident.id));
  const summary = {} as Record<FeatureKey, Level | 'MIXED'>;
  for (const key of FEATURE_KEYS) {
    const levels = new Set(members.map((member) => levelOf(key, member.features[key])));
    summary[key] = levels.size === 1 ? [...levels][0] : 'MIXED';
  }
  return summary;
}

export type VillainSeparation = Readonly<{
  /** 악당이 가장 많이 들어간 군집 */
  clusterId: string;
  /** 그 군집에 들어간 악당 수 / 전체 악당 수 */
  recall: number;
  /** 그 군집에서 악당 비율 */
  purity: number;
}>;

/**
 * 평가 전용 함수 (테스트와 Scene 7 정체 공개에서 사용).
 * 군집 계산 이후 결과를 평가할 뿐, 군집 계산 자체에는 악당 정보를 쓰지 않는다.
 */
export function villainSeparation(result: ClusterResult, villainIds: ReadonlySet<ResidentId>): VillainSeparation {
  if (villainIds.size === 0) throw new Error('악당이 없는 데이터는 평가할 수 없다');
  const scored = result.clusters.map((cluster) => {
    const villains = cluster.memberIds.filter((id) => villainIds.has(id)).length;
    return { clusterId: cluster.id, villains, recall: villains / villainIds.size, purity: villains / cluster.memberIds.length };
  });
  scored.sort((a, b) => b.villains - a.villains || b.purity - a.purity);
  const { clusterId, recall, purity } = scored[0];
  return Object.freeze({ clusterId, recall, purity });
}
