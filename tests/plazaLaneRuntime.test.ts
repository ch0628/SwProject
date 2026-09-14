import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canOccupy, footprint } from '../src/collision.ts';
import { characterDefinition, type PlazaIntent } from '../src/characterPool.ts';
import {
  createPlazaLaneRuntime, isRoadLanePoint, lanePath, loadNpcStopPoints,
  SINGLE_FILE_EDGE_NAMES, stopMovementPlan, stopNamesForIntent, validateLaneRuntime,
} from '../src/plazaLaneRuntime.ts';
import { createDestinationResolver, findNavigationPath, loadNavigationV2 } from '../src/plazaNavigationV2.ts';
import { createPlazaNpcRuntime, DEFAULT_PLAZA_NPC_CONFIG, stepPlazaNpcGroup } from '../src/plazaNpcRuntime.ts';
import { mapObjects, mapWorld, type GrayboxMap } from '../src/plazaPark.ts';

const map: GrayboxMap = JSON.parse(readFileSync(new URL('../public/maps/plaza-park-v2.tmj', import.meta.url), 'utf8'));
const graph = loadNavigationV2(map);
const lanes = createPlazaLaneRuntime(map, graph);

test('user-authored SP1~SP10 are unique physical points with safe local connectors', () => {
  const stops = loadNpcStopPoints(map);
  assert.deepEqual([...stops.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric:true })), Array.from({ length:10 }, (_, index) => `SP${index + 1}`));
  assert.ok([...stops.values()].every(stop => canOccupy(footprint(stop.x, stop.y, DEFAULT_PLAZA_NPC_CONFIG.footprint), mapObjects(map, 'Collision'), mapWorld(map))));
  assert.deepEqual(validateLaneRuntime(lanes), {
    stopCount:10, laneCount:33, separatedLaneCount:31, singleFileEdges:['E25','E26'], connectorFailures:[],
  });
});

test('all non-door edges have separated deterministic lanes and junctions avoid node-center merge', () => {
  for (const lane of lanes.lanes.values()) {
    if ((SINGLE_FILE_EDGE_NAMES as readonly string[]).includes(lane.edge.name)) continue;
    assert.notDeepEqual(lane.forward, lane.reverse);
  }
  const logical = findNavigationPath(graph, 'N01', 'N12');
  const physical = lanePath(lanes, logical, graph.nodes.get('N01'));
  for (const nodeName of logical.nodes.slice(1, -1)) {
    const node = graph.nodes.get(nodeName)!;
    assert.ok(!physical.points.some(point => Math.hypot(point.x - node.x, point.y - node.y) < 1e-5), `${nodeName} center merge`);
  }
  assert.ok(physical.points.slice(1).every((point, index) => Math.hypot(point.x - physical.points[index].x, point.y - physical.points[index].y) <= 1.01), 'invalid lane jump');
});

test('semantic hold mapping uses the authored Stop Point groups', () => {
  const expected: [PlazaIntent, readonly string[]][] = [
    ['BENCH_REST',['SP1','SP2','SP3','SP4']], ['WAIT',['SP5','SP6','SP7']], ['TALK',['SP5','SP6','SP7']],
    ['CAFE_SERVICE',['SP8']], ['FACILITY_REPAIR',['SP9']], ['MANHOLE_TAMPER',['SP10']],
  ];
  for (const [intent, names] of expected) {
    assert.deepEqual(stopNamesForIntent(intent), names);
    assert.ok(names.includes(stopMovementPlan(lanes, intent, 'N02', graph.nodes.get('N02')!)!.stop.name));
  }
});

test('hold behaviors execute off-road at Stop Points and return to a lane', () => {
  const resolver = createDestinationResolver(map, graph);
  const cases = [
    ['NPC01','N02','BENCH_REST'], ['NPC09','N03','CAFE_SERVICE'], ['NPC23','N10','WAIT'],
    ['NPC28','N15','MANHOLE_TAMPER'], ['NPC35','N28','FACILITY_REPAIR'],
  ] as const;
  for (const [id, start, semanticIntent] of cases) {
    const npc = createPlazaNpcRuntime(characterDefinition(id)!, start, graph, resolver, DEFAULT_PLAZA_NPC_CONFIG, lanes);
    let sawHold = false, sawRejoin = false;
    for (let frame = 0; frame < 12000 && npc.active; frame++) {
      stepPlazaNpcGroup([npc], map, graph, resolver, .05);
      if (npc.phase === 'BEHAVIOR' && npc.intents[npc.intentIndex] === semanticIntent) {
        sawHold = true;
        assert.match(npc.stopPoint ?? '', /^SP(?:[1-9]|10)$/);
        assert.equal(isRoadLanePoint(lanes, npc.position), false);
        assert.ok(npc.character.world.behaviorHistory.some(entry => entry.location === npc.stopPoint && !['WALK','RUN'].includes(entry.behavior.primitive)));
      }
      if (sawHold && npc.phase === 'REJOINING') sawRejoin = true;
    }
    assert.ok(sawHold, `${id} did not hold at ${semanticIntent}`);
    assert.ok(sawRejoin, `${id} did not rejoin after ${semanticIntent}`);
  }
});
