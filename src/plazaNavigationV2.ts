import type { PlazaIntent } from './characterPool.ts';
import { mapObjects, type GrayboxMap, type MapObject } from './plazaPark.ts';

export type NavigationPoint = Readonly<{ x: number; y: number }>;
export type NavigationNode = NavigationPoint & Readonly<{ name: string }>;
export type NavigationEdge = Readonly<{
  name: string;
  from: string;
  to: string;
  bidirectional: boolean;
  points: readonly NavigationPoint[];
  length: number;
}>;
type Arc = Readonly<{ to: string; edge: NavigationEdge; points: readonly NavigationPoint[] }>;
export type NavigationGraph = Readonly<{
  nodes: ReadonlyMap<string, NavigationNode>;
  edges: readonly NavigationEdge[];
  adjacency: ReadonlyMap<string, readonly Arc[]>;
}>;
export type NavigationPath = Readonly<{
  nodes: readonly string[];
  edges: readonly string[];
  points: readonly NavigationPoint[];
  distance: number;
  junctionTransitions?: readonly Readonly<{
    key: string;
    node: string;
    incomingEdge: string;
    outgoingEdge: string;
    startIndex: number;
    endIndex: number;
  }>[];
}>;

const EPSILON = 1e-4;
const distance = (a: NavigationPoint, b: NavigationPoint) => Math.hypot(b.x - a.x, b.y - a.y);
const property = (object: MapObject, name: string) => object.properties?.find(candidate => candidate.name === name)?.value;
const samePoint = (a: NavigationPoint, b: NavigationPoint) => distance(a, b) <= EPSILON;
const pathLength = (points: readonly NavigationPoint[]) => points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);

export function loadNavigationV2(map: GrayboxMap): NavigationGraph {
  const nodeObjects = mapObjects(map, 'Navigation_v2');
  const nodes = new Map<string, NavigationNode>();
  for (const object of nodeObjects) {
    if (!object.name || !object.point) throw new Error('Navigation_v2 must contain named point objects only');
    if (nodes.has(object.name)) throw new Error(`Duplicate Navigation_v2 node: ${object.name}`);
    nodes.set(object.name, Object.freeze({ name: object.name, x: object.x, y: object.y }));
  }

  const adjacency = new Map<string, Arc[]>([...nodes.keys()].map(name => [name, []]));
  const edgeNames = new Set<string>();
  const edges = mapObjects(map, 'Navigation_Edges_v2').map(object => {
    const from = property(object, 'from');
    const to = property(object, 'to');
    const bidirectional = property(object, 'bidirectional');
    if (!object.name || edgeNames.has(object.name)) throw new Error(`Duplicate or unnamed Navigation_Edges_v2 edge: ${object.name}`);
    if (typeof from !== 'string' || typeof to !== 'string' || typeof bidirectional !== 'boolean') throw new Error(`${object.name} has invalid edge properties`);
    const fromNode = nodes.get(from);
    const toNode = nodes.get(to);
    if (!fromNode || !toNode) throw new Error(`${object.name} references missing endpoint ${from} -> ${to}`);
    if (!object.polyline || object.polyline.length < 2) throw new Error(`${object.name} must contain a polyline`);
    const points = object.polyline.map(point => Object.freeze({ x: object.x + point.x, y: object.y + point.y }));
    if (!samePoint(points[0], fromNode) || !samePoint(points.at(-1)!, toNode)) throw new Error(`${object.name} polyline endpoints do not match ${from} -> ${to}`);
    edgeNames.add(object.name);
    return Object.freeze({ name: object.name, from, to, bidirectional, points: Object.freeze(points), length: pathLength(points) });
  });

  for (const edge of edges) {
    adjacency.get(edge.from)!.push(Object.freeze({ to: edge.to, edge, points: edge.points }));
    if (edge.bidirectional) adjacency.get(edge.to)!.push(Object.freeze({ to: edge.from, edge, points: Object.freeze([...edge.points].reverse()) }));
  }
  for (const arcs of adjacency.values()) arcs.sort((a, b) => a.edge.name.localeCompare(b.edge.name));
  return Object.freeze({ nodes, edges: Object.freeze(edges), adjacency });
}

export function findNavigationPath(graph: NavigationGraph, from: string, to: string): NavigationPath {
  if (!graph.nodes.has(from) || !graph.nodes.has(to)) throw new Error(`Unknown path endpoint: ${from} -> ${to}`);
  const remaining = new Set(graph.nodes.keys());
  const distances = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, { node: string; arc: Arc }>();
  while (remaining.size) {
    const current = [...remaining].reduce<string | undefined>((best, name) =>
      best === undefined || (distances.get(name) ?? Infinity) < (distances.get(best) ?? Infinity) ? name : best, undefined);
    if (current === undefined || (distances.get(current) ?? Infinity) === Infinity) break;
    remaining.delete(current);
    if (current === to) break;
    for (const arc of graph.adjacency.get(current) ?? []) {
      if (!remaining.has(arc.to)) continue;
      const candidate = distances.get(current)! + arc.edge.length;
      if (candidate < (distances.get(arc.to) ?? Infinity)) {
        distances.set(arc.to, candidate);
        previous.set(arc.to, { node: current, arc });
      }
    }
  }
  if (!distances.has(to)) throw new Error(`No Navigation_v2 path: ${from} -> ${to}`);

  const nodes = [to];
  const arcs: Arc[] = [];
  while (nodes[0] !== from) {
    const step = previous.get(nodes[0]);
    if (!step) throw new Error(`Broken Navigation_v2 path reconstruction: ${from} -> ${to}`);
    nodes.unshift(step.node);
    arcs.unshift(step.arc);
  }
  const points = arcs.length ? [arcs[0].points[0], ...arcs.flatMap(arc => arc.points.slice(1))] : [graph.nodes.get(from)!];
  return Object.freeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(arcs.map(arc => arc.edge.name)),
    points: Object.freeze(points),
    distance: distances.get(to)!,
  });
}

const fixedCandidates: Record<PlazaIntent, readonly string[]> = {
  PARK_WALK: ['N04','N05','N06','N07','N09','N10','N11','N12','N13','N14'],
  BENCH_REST: [],
  FACILITY_VISIT: ['N28'],
  VANDALIZE: [],
  ESCAPE: ['N24','N25','N26'],
  CAFE_VISIT: ['N17'],
  THREATEN: ['N09','N10','N11','N20','N21','N22'],
  JOG: ['N04','N05','N06','N07'],
  PLAZA_TRANSIT: ['N12','N20','N21','N22','N14','N15'],
  TALK: ['N09','N10','N11','N20','N21','N22'],
  SNATCH: ['N20','N21','N22'],
  CAFE_SERVICE: ['N17'],
  TRANSIT: ['N12','N20','N21','N22','N14','N15'],
  FACILITY_REPAIR: ['N28'],
  MANHOLE_TAMPER: [],
  THEFT: ['N20','N21','N22'],
  EXERCISE: ['N04','N05','N06','N07'],
  WALK: ['N09','N10','N11','N12','N13','N14'],
  RUN: ['N12','N20','N21','N22','N14','N15'],
  IDLE: ['N09','N10','N11','N20','N21','N22'],
  CARRY_TOOLS: ['N08'],
  REPAIR: ['N28'],
  WAIT: ['N09','N10','N11','N20','N21','N22'],
  LOOK_AROUND: ['N09','N10','N11','N20','N21','N22'],
  DELIVERY: ['N18','N21','N15'],
  COMMUTE: ['N12','N21','N15'],
  EXIT: ['N24','N25','N26'],
};

const nearestNode = (graph: NavigationGraph, object: MapObject) => [...graph.nodes.values()].reduce((best, node) =>
  distance(node, { x: object.x + object.width / 2, y: object.y + object.height / 2 }) < distance(best, { x: object.x + object.width / 2, y: object.y + object.height / 2 }) ? node : best).name;

export type DestinationResolver = ReturnType<typeof createDestinationResolver>;

export function createDestinationResolver(map: GrayboxMap, graph: NavigationGraph) {
  const interactions = mapObjects(map, 'Interaction');
  const benchNodes = [...new Set(interactions.filter(object => object.type === 'Bench').map(object => nearestNode(graph, object)))];
  const manhole = interactions.find(object => object.type === 'Manhole' || object.name === 'Manhole');
  const manholeNodes = manhole ? [nearestNode(graph, manhole)] : [];
  const candidates = (intent: PlazaIntent) => {
    if (intent === 'BENCH_REST') return benchNodes;
    if (intent === 'MANHOLE_TAMPER' || intent === 'VANDALIZE') return manholeNodes;
    return fixedCandidates[intent];
  };
  return Object.freeze({
    candidates,
    resolve(intent: PlazaIntent, from: string) {
      const available = candidates(intent).filter(name => graph.nodes.has(name));
      if (!available.length) throw new Error(`No Navigation_v2 destination for ${intent}`);
      return available
        .map(name => ({ name, distance: findNavigationPath(graph, from, name).distance }))
        .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name))[0].name;
    },
  });
}
