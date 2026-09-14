import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canOccupy, footprint, overlaps } from '../src/collision.ts';
import { characterDefinition, type CharacterId } from '../src/characterPool.ts';
import { createPlazaLaneRuntime, isRoadLanePoint, lanePath, type PlazaLaneRuntime } from '../src/plazaLaneRuntime.ts';
import { createDestinationResolver, findNavigationPath, loadNavigationV2 } from '../src/plazaNavigationV2.ts';
import {
  createPlazaNpcRuntime, DEFAULT_PLAZA_NPC_CONFIG, stepPlazaNpcGroup, type PlazaNpcRuntime,
} from '../src/plazaNpcRuntime.ts';
import { mapObjects, mapWorld, type GrayboxMap } from '../src/plazaPark.ts';

const map: GrayboxMap = JSON.parse(readFileSync(new URL('../public/maps/plaza-park-v2.tmj', import.meta.url), 'utf8'));
const graph = loadNavigationV2(map);
const starts: Record<CharacterId, string> = {
  NPC01:'N02', NPC02:'N16', NPC03:'N06', NPC04:'N03', NPC05:'N07', NPC06:'N01', NPC07:'N08', NPC08:'N09', NPC09:'N03',
  NPC10:'N28', NPC11:'N14', NPC12:'N16', NPC13:'N04', NPC14:'N06', NPC15:'N05', NPC16:'N08', NPC17:'N11', NPC18:'N08',
  NPC19:'N24', NPC20:'N17', NPC21:'N28', NPC22:'N12', NPC23:'N10', NPC24:'N18', NPC25:'N17', NPC26:'N18', NPC27:'N24',
  NPC28:'N15', NPC29:'N18', NPC30:'N04', NPC31:'N17', NPC32:'N28', NPC33:'N05', NPC34:'N17', NPC35:'N28',
};

function actors(ids: readonly CharacterId[]) {
  const lanes = createPlazaLaneRuntime(map, graph);
  const resolver = createDestinationResolver(map, graph);
  return {
    lanes,
    resolver,
    npcs:ids.map(id => createPlazaNpcRuntime(characterDefinition(id)!, starts[id], graph, resolver, DEFAULT_PLAZA_NPC_CONFIG, lanes)),
  };
}

function assertNoNpcOverlap(npcs: readonly PlazaNpcRuntime[]) {
  const visible = npcs.filter(npc => npc.active && npc.visible);
  for (let left = 0; left < visible.length; left++) for (let right = left + 1; right < visible.length; right++) {
    assert.equal(overlaps(
      footprint(visible[left].position.x, visible[left].position.y, visible[left].config.footprint),
      footprint(visible[right].position.x, visible[right].position.y, visible[right].config.footprint),
    ), false, `${visible[left].definition.id}/${visible[right].definition.id} overlap`);
  }
}

function run(npcs: readonly PlazaNpcRuntime[], resolver: ReturnType<typeof createDestinationResolver>, seconds = 120) {
  const solids = mapObjects(map, 'Collision'), world = mapWorld(map);
  for (let frame = 0; frame < seconds / .05 && npcs.some(npc => npc.active); frame++) {
    stepPlazaNpcGroup(npcs, map, graph, resolver, .05);
    assertNoNpcOverlap(npcs);
    for (const npc of npcs.filter(candidate => candidate.active && candidate.visible)) {
      assert.equal(canOccupy(footprint(npc.position.x, npc.position.y, npc.config.footprint), solids, world), true, `${npc.definition.id} hit fixed collision`);
      if (npc.phase === 'BEHAVIOR' && npc.stopPoint) assert.equal(isRoadLanePoint(npc.laneRuntime!, npc.position), false, `${npc.definition.id} held on road`);
    }
  }
}

function forceRoute(npc: PlazaNpcRuntime, lanes: PlazaLaneRuntime, from: string, to: string) {
  const path = lanePath(lanes, findNavigationPath(graph, from, to), graph.nodes.get(from)!);
  npc.active = true;
  npc.visible = true;
  npc.phase = 'MOVING';
  npc.position = { ...path.points[0] };
  npc.currentNode = from;
  npc.targetNode = to;
  npc.intents = ['PLAZA_TRANSIT', 'EXIT'];
  npc.intentIndex = 0;
  npc.path = path;
  npc.pathPointIndex = 1;
  npc.stallReports.length = 0;
  npc.watchdogAnchor = { time:npc.simulationTime, ...npc.position };
}

function runUntilFirstRouteClears(npcs: readonly PlazaNpcRuntime[], resolver: ReturnType<typeof createDestinationResolver>, seconds: number) {
  for (let frame = 0; frame < seconds / .05 && npcs.some(npc => npc.intentIndex === 0); frame++) {
    stepPlazaNpcGroup(npcs, map, graph, resolver, .05);
    assertNoNpcOverlap(npcs);
  }
}

test('A-1 E10 opposite-direction junction travel recovers without overlap', () => {
  const group = actors(['NPC06','NPC13']);
  forceRoute(group.npcs[0], group.lanes, 'N09', 'N11');
  forceRoute(group.npcs[1], group.lanes, 'N11', 'N09');
  for (const npc of group.npcs) {
    assert.deepEqual(npc.path.junctionTransitions?.map(transition => transition.node), ['N10']);
    const transition = npc.path.junctionTransitions![0];
    assert.ok(!npc.path.points.slice(transition.startIndex, transition.endIndex + 1)
      .some(point => Math.hypot(point.x - graph.nodes.get('N10')!.x, point.y - graph.nodes.get('N10')!.y) < 1e-5));
  }
  runUntilFirstRouteClears(group.npcs, group.resolver, 40);
  assert.ok(group.npcs.every(npc => npc.intentIndex > 0), 'opposite-direction actors did not clear N10');
  assert.ok(group.npcs.every(npc => npc.stallReports.length === 0), 'opposite-direction junction stall was reported');
});

test('A-2 four diagonal/turn routes clear the N10 junction without permanent center merge', () => {
  const group = actors(['NPC06','NPC13','NPC33','NPC20']);
  const routes = [['N09','N11'], ['N11','N09'], ['N05','N21'], ['N21','N05']] as const;
  group.npcs.forEach((npc, index) => forceRoute(npc, group.lanes, ...routes[index]));
  assert.ok(group.npcs.every(npc => npc.path.junctionTransitions?.some(transition => transition.node === 'N10')));
  runUntilFirstRouteClears(group.npcs, group.resolver, 60);
  assert.ok(group.npcs.every(npc => npc.intentIndex > 0), 'one or more turn actors never cleared the junction');
  assert.ok(group.npcs.every(npc => npc.stallReports.length === 0), 'junction transition stall was reported');
});

test('B-1 three simultaneous general holds reserve SP5/SP6/SP7 uniquely and complete', () => {
  const group = actors(['NPC05','NPC08','NPC23']);
  assert.deepEqual(group.npcs.map(npc => npc.stopPoint).sort(), ['SP5','SP6','SP7']);
  run(group.npcs, group.resolver);
  assert.ok(group.npcs.every(npc => !npc.active), 'general hold actor did not complete/rejoin');
});

test('B-2 a fourth general hold defers while moving, then reserves and completes', () => {
  const group = actors(['NPC05','NPC08','NPC23','NPC17']);
  const deferred = group.npcs.filter(npc => !npc.stopPoint);
  assert.equal(group.npcs.filter(npc => npc.stopPoint).length, 3);
  assert.equal(deferred.length, 1);
  const before = { ...deferred[0].position };
  for (let frame = 0; frame < 40; frame++) stepPlazaNpcGroup(group.npcs, map, graph, group.resolver, .05);
  assert.ok(Math.hypot(deferred[0].position.x - before.x, deferred[0].position.y - before.y) > 1, 'deferred actor waited on a road/connector');
  run(group.npcs, group.resolver, 118);
  assert.ok(group.npcs.every(npc => !npc.active), 'deferred general hold never eventually completed');
  assert.ok(group.lanes.coordination.metrics.deferredBehaviorCount >= 1);
  assert.ok(group.lanes.coordination.metrics.deferredBehaviorCompletedCount >= 1);
  assert.equal(group.lanes.coordination.metrics.duplicateStopReservationCount, 0);
  assert.equal(group.lanes.coordination.metrics.stopOccupancyConflictCount, 0);
});

test('B-3 two simultaneous SP10 requests serialize with one owner at a time', () => {
  const group = actors(['NPC11','NPC28']);
  assert.equal(group.npcs.filter(npc => npc.stopPoint === 'SP10').length, 1);
  assert.equal(group.npcs.filter(npc => !npc.stopPoint).length, 1);
  run(group.npcs, group.resolver);
  assert.ok(group.npcs.every(npc => !npc.active), 'serialized SP10 request did not finish');
  assert.equal(group.lanes.coordination.metrics.duplicateStopReservationCount, 0);
  assert.equal(group.lanes.coordination.metrics.stopOccupancyConflictCount, 0);
});

test('mixed 8-NPC junction/general/cafe/facility/manhole integration remains live and exclusive', () => {
  const group = actors(['NPC05','NPC08','NPC23','NPC17','NPC09','NPC35','NPC28','NPC06']);
  run(group.npcs, group.resolver);
  assert.ok(group.npcs.every(npc => !npc.active), 'mixed integration actor remained active');
  assert.ok(group.npcs.every(npc => npc.stallReports.length === 0), 'mixed integration produced a stall');
  assert.equal(group.lanes.coordination.stopReservations.size, 0);
  assert.equal(group.lanes.coordination.metrics.duplicateStopReservationCount, 0);
  assert.equal(group.lanes.coordination.metrics.stopOccupancyConflictCount, 0);
  assert.equal(group.lanes.coordination.metrics.connectorStallCount, 0);
});
