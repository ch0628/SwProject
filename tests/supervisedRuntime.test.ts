import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { footprint, overlaps } from '../src/collision.ts';
import {
  CHARACTER_POOL, appendBehaviorHistory, characterDefinition, createCharacterRuntimeState,
  type PlazaIntent,
} from '../src/characterPool.ts';
import { mapObjects, mapWorld, type GrayboxMap } from '../src/plazaPark.ts';
import {
  createDestinationResolver, findNavigationPath, loadNavigationV2,
} from '../src/plazaNavigationV2.ts';
import {
  createPlazaNpcRuntime, createSupervisedPlazaDemo, stepPlazaNpc, stepPlazaNpcGroup,
} from '../src/plazaNpcRuntime.ts';

const map: GrayboxMap = JSON.parse(readFileSync(new URL('../public/maps/plaza-park-v2.tmj', import.meta.url), 'utf8'));
const graph = loadNavigationV2(map);
const resolver = createDestinationResolver(map, graph);

test('35 Character Pool matches approved distributions and keeps definitions immutable', () => {
  assert.equal(CHARACTER_POOL.length, 35);
  assert.equal(new Set(CHARACTER_POOL.map(character => character.id)).size, 35);
  assert.deepEqual(Object.fromEntries(['rabbit','cat','dog','fox','tiger'].map(species => [species, CHARACTER_POOL.filter(character => character.species === species).length])), {
    rabbit: 7, cat: 7, dog: 7, fox: 7, tiger: 7,
  });
  assert.deepEqual(Object.fromEntries(['CITIZEN','VILLAIN'].map(label => [label, CHARACTER_POOL.filter(character => character.verifiedLabel === label).length])), {
    CITIZEN: 23, VILLAIN: 12,
  });
  assert.deepEqual(Object.fromEntries(['MANUAL_LABELING','HUMAN_AI_COMPARE','AI_ASSISTED_MONITORING'].map(phase => [phase, CHARACTER_POOL.filter(character => character.primaryPhase === phase).length])), {
    MANUAL_LABELING: 18, HUMAN_AI_COMPARE: 8, AI_ASSISTED_MONITORING: 9,
  });
  assert.ok(CHARACTER_POOL.every(character => Object.isFrozen(character) && Object.isFrozen(character.zoneSequence) && Object.isFrozen(character.behaviorStory) && Object.isFrozen(character.plazaIntents)));
});

test('runtime state is separate from immutable definition and history appends semantic state', () => {
  const definition = characterDefinition('NPC01')!;
  const runtime = createCharacterRuntimeState(definition);
  runtime.labels.userLabel = 'VILLAIN';
  runtime.training.usedForTraining = true;
  appendBehaviorHistory(runtime, 13 * 60 + 4, { primitive: 'WALK', semantic: 'WALKING' }, 'N04');
  assert.equal(definition.verifiedLabel, 'CITIZEN');
  assert.equal((definition as { userLabel?: unknown }).userLabel, undefined);
  assert.deepEqual(runtime.world.behaviorHistory[0], {
    simulationTime: 784, zone: 'PLAZA', behavior: { primitive: 'WALK', semantic: 'WALKING' }, location: 'N04',
  });
});

test('preexisting offscreen behavior stays in its previous zone before Plaza entry', () => {
  for (const id of ['NPC20','NPC31','NPC34'] as const) {
    const npc = createPlazaNpcRuntime(characterDefinition(id)!, 'N03', graph, resolver);
    const [previous, entered, runtime] = npc.character.world.behaviorHistory;
    assert.deepEqual({ zone: previous.zone, semantic: previous.behavior.semantic, location: previous.location }, {
      zone: 'SHOPPING', semantic: 'STEALING', location: 'OFFSCREEN',
    }, id);
    assert.deepEqual({ zone: entered.zone, primitive: entered.behavior.primitive, semantic: entered.behavior.semantic }, {
      zone: 'PLAZA', primitive: 'ENTER', semantic: 'ENTERING',
    }, id);
    assert.equal(runtime.zone, 'PLAZA', id);
    assert.notEqual(runtime.behavior.semantic, 'STEALING', id);
    assert.ok(!npc.character.world.behaviorHistory.some(entry => entry.zone === 'PLAZA' && entry.behavior.semantic === 'STEALING'), id);
  }
});

test('Navigation v2 loader reads 28 nodes, 33 edges and preserves polyline geometry', () => {
  assert.equal(graph.nodes.size, 28);
  assert.equal(graph.edges.length, 33);
  assert.ok(graph.edges.every(edge => edge.bidirectional));
  for (const edge of graph.edges) {
    assert.ok(graph.nodes.has(edge.from));
    assert.ok(graph.nodes.has(edge.to));
    assert.ok(Math.hypot(edge.points[0].x - graph.nodes.get(edge.from)!.x, edge.points[0].y - graph.nodes.get(edge.from)!.y) < 1e-4);
    assert.ok(Math.hypot(edge.points.at(-1)!.x - graph.nodes.get(edge.to)!.x, edge.points.at(-1)!.y - graph.nodes.get(edge.to)!.y) < 1e-4);
  }

  const controlled = structuredClone(map);
  const edge = mapObjects(controlled, 'Navigation_Edges_v2').find(candidate => candidate.name === 'E17')!;
  edge.polyline!.splice(1, 0, { x: 64, y: 192 });
  const controlledGraph = loadNavigationV2(controlled);
  assert.equal(controlledGraph.edges.find(candidate => candidate.name === 'E17')!.points.length, 3);
});

test('pathfinding reaches doors and all south exits using valid endpoints', () => {
  for (const target of ['N17','N28','N24','N25','N26']) {
    const path = findNavigationPath(graph, 'N02', target);
    assert.equal(path.nodes[0], 'N02');
    assert.equal(path.nodes.at(-1), target);
    assert.deepEqual(path.points[0], { x: graph.nodes.get('N02')!.x, y: graph.nodes.get('N02')!.y });
    assert.ok(Math.hypot(path.points.at(-1)!.x - graph.nodes.get(target)!.x, path.points.at(-1)!.y - graph.nodes.get(target)!.y) < 1e-4);
    assert.ok(path.edges.every(name => graph.edges.some(edge => edge.name === name)));
  }
});

test('every Character Pool semantic intent resolves to an existing reachable destination', () => {
  const intents = new Set(CHARACTER_POOL.flatMap(character => character.plazaIntents)) as Set<PlazaIntent>;
  for (const intent of intents) {
    const destination = resolver.resolve(intent, 'N02');
    assert.ok(graph.nodes.has(destination), `${intent} -> ${destination}`);
    assert.equal(findNavigationPath(graph, 'N02', destination).nodes.at(-1), destination);
  }
  assert.equal(resolver.resolve('CAFE_VISIT', 'N02'), 'N17');
  assert.equal(resolver.resolve('FACILITY_VISIT', 'N02'), 'N28');
  assert.ok(['N24','N25','N26'].includes(resolver.resolve('EXIT', 'N02')));
});

test('single NPC completes spawn -> Cafe behavior -> south exit end to end', () => {
  const npc = createPlazaNpcRuntime(characterDefinition('NPC04')!, 'N03', graph, resolver);
  const solids = mapObjects(map, 'Collision');
  for (let i = 0; i < 12000 && npc.active; i++) stepPlazaNpc(npc, graph, resolver, .05, solids, mapWorld(map));
  assert.equal(npc.phase, 'EXITED');
  assert.equal(npc.character.world.currentZone, 'SHOPPING');
  assert.ok(npc.character.world.behaviorHistory.some(entry => entry.location === 'N17' && entry.behavior.primitive === 'ENTER'));
  const exits = npc.character.world.behaviorHistory.filter(entry => entry.behavior.primitive === 'EXIT');
  assert.equal(exits.length, 1);
  assert.equal(exits[0].zone, 'PLAZA');
  assert.equal(npc.stallReports.length, 0);
});

test('five different intents run concurrently without fixed or NPC overlap', () => {
  const demo = createSupervisedPlazaDemo(map);
  const solids = mapObjects(map, 'Collision');
  for (let frame = 0; frame < 12000 && demo.npcs.some(npc => npc.active); frame++) {
    stepPlazaNpcGroup(demo.npcs, map, demo.graph, demo.resolver, .05);
    const visible = demo.npcs.filter(npc => npc.active && npc.visible);
    for (const npc of visible) {
      const body = footprint(npc.position.x, npc.position.y, npc.config.footprint);
      assert.ok(!solids.some(solid => overlaps(body, solid)), `${npc.definition.id} fixed collision`);
      assert.ok(!visible.some(other => other !== npc && overlaps(body, footprint(other.position.x, other.position.y, other.config.footprint))), `${npc.definition.id} NPC overlap`);
    }
  }
  assert.ok(demo.npcs.every(npc => npc.phase === 'EXITED'), demo.npcs.map(npc => `${npc.definition.id}:${npc.phase}:${npc.targetNode}`).join(', '));
  assert.ok(demo.npcs.some(npc => npc.character.world.behaviorHistory.some(entry => entry.behavior.semantic === 'MANHOLE_TAMPER')));
  assert.ok(demo.npcs.every(npc => npc.character.world.behaviorHistory.length >= 4));
});

test('progress watchdog reports real displacement stall without teleporting', () => {
  const npc = createPlazaNpcRuntime(characterDefinition('NPC06')!, 'N01', graph, resolver);
  const start = { ...npc.position };
  const blocker = footprint(start.x, start.y, { width: 80, height: 80 });
  for (let i = 0; i < 50; i++) stepPlazaNpc(npc, graph, resolver, .05, [blocker], mapWorld(map));
  assert.deepEqual(npc.position, start);
  assert.equal(npc.stalledCandidate, true);
  assert.ok(npc.stallReports.length >= 1);
  assert.equal(npc.stallReports[0].displacement, 0);
});
