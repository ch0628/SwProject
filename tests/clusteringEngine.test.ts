import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ALL_FEATURE_PAIRS,
  FEATURE_KEYS,
  assertValidPair,
  clueMatch,
  clusterResidents,
  distance,
  nearestClusterToClue,
  partitionSignature,
  summarizeCluster,
  villainSeparation,
  type FeatureKey,
  type FeaturePair,
} from '../src/modules/unsupervised/sim/clusteringEngine.ts';
import { FEATURE_DEFINITIONS, INCIDENT_CLUE, featureLevel } from '../src/modules/unsupervised/data/features.ts';
import { RESIDENTS, toClusterInput, villainIds } from '../src/modules/unsupervised/data/residents.ts';

const inputs = RESIDENTS.map(toClusterInput);
const villains = villainIds(RESIDENTS);
const CORRECT_PAIR: FeaturePair = ['food', 'activeTime'];
const isCorrect = (pair: FeaturePair) => pair.includes('food') && pair.includes('activeTime');
const WRONG_PAIRS = ALL_FEATURE_PAIRS.filter((pair) => !isCorrect(pair));
const pairName = (pair: FeaturePair) => pair.join('+');

test('4개 특징에서 2개를 고르는 조합은 정확히 6가지다', () => {
  assert.equal(ALL_FEATURE_PAIRS.length, 6);
  assert.equal(new Set(ALL_FEATURE_PAIRS.map((pair) => [...pair].sort().join('+'))).size, 6);
  assert.equal(WRONG_PAIRS.length, 5);
});

test('주민 데이터: 12명, id 중복 없음, 특징값 0~1, 악당 3명', () => {
  assert.equal(RESIDENTS.length, 12);
  assert.equal(new Set(RESIDENTS.map((resident) => resident.id)).size, 12);
  for (const resident of RESIDENTS) {
    for (const key of FEATURE_KEYS) {
      const value = resident.features[key];
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `${resident.id}.${key}=${value}`);
    }
  }
  assert.equal(villains.size, 3);
});

test('6가지 조합 모두 군집 3~5개를 만들고, 모든 주민이 정확히 한 군집에 속한다', () => {
  for (const pair of ALL_FEATURE_PAIRS) {
    const result = clusterResidents(inputs, pair);
    assert.ok(result.clusters.length >= 3 && result.clusters.length <= 5, `${pairName(pair)}: ${result.clusters.length}개`);
    const members = result.clusters.flatMap((cluster) => cluster.memberIds);
    assert.equal(members.length, RESIDENTS.length, pairName(pair));
    assert.deepEqual(new Set(members), new Set(RESIDENTS.map((resident) => resident.id)), pairName(pair));
  }
});

test('어떤 특징을 기준으로 보느냐에 따라 군집 모양이 달라진다 (6가지 분할이 모두 다름)', () => {
  const signatures = ALL_FEATURE_PAIRS.map((pair) => partitionSignature(clusterResidents(inputs, pair)));
  assert.equal(new Set(signatures).size, 6);
});

test('정답 조합(먹는 음식 + 활동 시간): 악당 전원이 단서와 가장 가까운 군집 하나로 분리된다', () => {
  assert.equal(clueMatch(CORRECT_PAIR, INCIDENT_CLUE), 'MATCH');
  const result = clusterResidents(inputs, CORRECT_PAIR);
  const clueCluster = nearestClusterToClue(result, INCIDENT_CLUE);
  assert.ok(clueCluster);
  const separation = villainSeparation(result, villains);
  assert.equal(separation.clusterId, clueCluster.id);
  assert.equal(separation.recall, 1);
  // 결정 9 "군집 일부": 단서 군집에는 악당이 다수이지만 시민도 섞여 있다.
  assert.ok(separation.purity >= 0.5 && separation.purity < 1, `purity=${separation.purity}`);
  for (const cluster of result.clusters) {
    if (cluster.id !== clueCluster.id) assert.ok(cluster.memberIds.every((id) => !villains.has(id)), cluster.id);
  }
});

test('정답 조합: 단서와 가장 가까운 군집이 확실히 하나로 정해진다', () => {
  const result = clusterResidents(inputs, CORRECT_PAIR);
  const target = { x: INCIDENT_CLUE.food!, y: INCIDENT_CLUE.activeTime! };
  const distances = result.clusters.map((cluster) => distance(cluster.centroid, target)).sort((a, b) => a - b);
  assert.ok(distances[1] - distances[0] >= 0.3, `margin=${distances[1] - distances[0]}`);
});

test('잘못된 조합 5가지: 단서와 비교할 수 없고, 악당이 여러 군집에 흩어져 시민과 섞인다', () => {
  for (const pair of WRONG_PAIRS) {
    const name = pairName(pair);
    assert.notEqual(clueMatch(pair, INCIDENT_CLUE), 'MATCH', name);
    const result = clusterResidents(inputs, pair);
    assert.equal(nearestClusterToClue(result, INCIDENT_CLUE), null, name);
    assert.ok(villainSeparation(result, villains).recall < 1, `${name}: 악당이 한 군집에 모임`);
    for (const cluster of result.clusters) {
      if (cluster.memberIds.some((id) => villains.has(id))) {
        assert.ok(cluster.memberIds.some((id) => !villains.has(id)), `${name} ${cluster.id}: 악당만 있는 군집`);
      }
    }
  }
});

test('clueMatch: 단서 특징을 하나만 포함하면 PARTIAL, 하나도 없으면 NONE', () => {
  assert.equal(clueMatch(['food', 'belongings'], INCIDENT_CLUE), 'PARTIAL');
  assert.equal(clueMatch(['activeTime', 'footprint'], INCIDENT_CLUE), 'PARTIAL');
  assert.equal(clueMatch(['belongings', 'footprint'], INCIDENT_CLUE), 'NONE');
});

test('결정성: 같은 입력은 같은 결과, 입력 순서와 축 순서를 바꿔도 같은 분할', () => {
  for (const pair of ALL_FEATURE_PAIRS) {
    const first = clusterResidents(inputs, pair);
    assert.deepEqual(clusterResidents(inputs, pair), first, pairName(pair));
    const shuffled = [...inputs].reverse();
    shuffled.push(shuffled.splice(3, 1)[0]);
    assert.deepEqual(clusterResidents(shuffled, pair), first, `${pairName(pair)} (입력 순서 변경)`);
    const swapped = [pair[1], pair[0]] as const;
    assert.equal(partitionSignature(clusterResidents(inputs, swapped)), partitionSignature(first), `${pairName(pair)} (축 교체)`);
  }
});

test('군집 계산은 악당 여부를 사용하지 않는다', () => {
  const flipped = RESIDENTS.map((resident) => ({ ...resident, isVillain: !resident.isVillain }));
  for (const pair of ALL_FEATURE_PAIRS) {
    assert.equal(
      partitionSignature(clusterResidents(flipped, pair)),
      partitionSignature(clusterResidents(inputs, pair)),
      pairName(pair),
    );
  }
});

test('특징은 서로 다른 2개만 선택할 수 있다', () => {
  assert.throws(() => assertValidPair(['food']));
  assert.throws(() => assertValidPair(['food', 'food']));
  assert.throws(() => assertValidPair(['food', 'activeTime', 'footprint']));
  assert.throws(() => assertValidPair(['food', 'height' as FeatureKey]));
  assert.doesNotThrow(() => assertValidPair(['belongings', 'footprint']));
});

test('군집 요약: 정답 조합의 단서 군집은 육식·밤으로 공통, 나머지 특징은 다양함', () => {
  const result = clusterResidents(inputs, CORRECT_PAIR);
  const clueCluster = nearestClusterToClue(result, INCIDENT_CLUE)!;
  const summary = summarizeCluster(clueCluster, inputs, (key, value) => featureLevel(key, value).id);
  assert.deepEqual(summary, { food: 'CARNIVORE', activeTime: 'NIGHT', belongings: 'MIXED', footprint: 'MIXED' });
});

test('특징 단계 라벨: 먹는 음식은 3단계, 나머지는 2단계', () => {
  assert.deepEqual(FEATURE_DEFINITIONS.food.levels.map((level) => level.label), ['초식', '잡식', '육식']);
  assert.equal(featureLevel('food', 0.5).label, '잡식');
  assert.equal(featureLevel('activeTime', 0.9).label, '밤');
  for (const key of FEATURE_KEYS) assert.equal(FEATURE_DEFINITIONS[key].levels.at(-1)!.max, 1);
});
