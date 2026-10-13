import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLANE_SPREAD_OPTIONS, spreadPoints, type PlanePoint } from '../src/modules/unsupervised/layout.ts';
import { ALL_FEATURE_PAIRS, clusterResidents, partitionSignature } from '../src/modules/unsupervised/sim/clusteringEngine.ts';
import { RESIDENTS, toClusterInput } from '../src/modules/unsupervised/data/residents.ts';

const OPTIONS = PLANE_SPREAD_OPTIONS;
const inputs = RESIDENTS.map(toClusterInput);
const scaled = (p: { x: number; y: number }) => ({ x: p.x * OPTIONS.aspect, y: p.y });

test('6가지 조합 모두: 표시 위치 사이 최소 거리를 확보하고, 원래 좌표에서 최대 이동량 이내로만 움직인다', () => {
  for (const pair of ALL_FEATURE_PAIRS) {
    const points = clusterResidents(inputs, pair).points;
    const layout = spreadPoints(points, OPTIONS);
    const placed = points.map((p) => scaled(layout.get(p.id)!));
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const distance = Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y);
        assert.ok(distance >= OPTIONS.minDistance * 0.9, `${pair.join('+')} ${points[i].id}-${points[j].id}: ${distance.toFixed(3)}`);
      }
    }
    for (const p of points) {
      const moved = Math.hypot(scaled(layout.get(p.id)!).x - scaled(p).x, layout.get(p.id)!.y - p.y);
      assert.ok(moved <= OPTIONS.maxShift + 1e-9, `${p.id}: ${moved}`);
      const { x, y } = layout.get(p.id)!;
      const m = OPTIONS.margin ?? 0;
      assert.ok(x >= -m && x <= 1 + m && y >= -m && y <= 1 + m);
    }
  }
});

test('표시 배치는 결정적이고, 입력 좌표와 군집 결과를 바꾸지 않는다', () => {
  const result = clusterResidents(inputs, ['food', 'activeTime']);
  const before = JSON.stringify(result.points);
  const a = spreadPoints(result.points, OPTIONS);
  const b = spreadPoints([...result.points].reverse(), OPTIONS);
  assert.deepEqual([...a.entries()].sort(), [...b.entries()].sort());
  assert.equal(JSON.stringify(result.points), before);
  assert.equal(partitionSignature(clusterResidents(inputs, ['food', 'activeTime'])), partitionSignature(result));
});

test('완전히 같은 위치의 점도 서로 다른 위치로 벌어진다', () => {
  const same: PlanePoint[] = [{ id: 'a', x: 0.5, y: 0.5 }, { id: 'b', x: 0.5, y: 0.5 }, { id: 'c', x: 0.5, y: 0.5 }];
  const layout = spreadPoints(same, OPTIONS);
  assert.equal(new Set([...layout.values()].map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)).size, 3);
});
