import { canOccupy, footprint, sweptFootprint } from './collision.ts';
import type { PlazaIntent } from './characterPool.ts';
import { mapObjects, mapWorld, type GrayboxMap, type MapObject } from './plazaPark.ts';
import { findNavigationPath, type NavigationEdge, type NavigationGraph, type NavigationPath, type NavigationPoint } from './plazaNavigationV2.ts';

export const LANE_FOOTPRINT = Object.freeze({ width: 26, height: 16 });
export const SINGLE_FILE_EDGE_NAMES = Object.freeze(['E25', 'E26'] as const);
const SINGLE_FILE = new Set<string>(SINGLE_FILE_EDGE_NAMES);
const CLEARANCE_SAMPLE = .5;
const LANE_GAP = 1;

export type StopPointGroup = 'BENCH' | 'GENERAL' | 'CAFE' | 'FACILITY' | 'MANHOLE';
export type NpcStopPoint = Readonly<NavigationPoint & { name: string; group: StopPointGroup }>;
type LaneEdge = Readonly<{ edge: NavigationEdge; forward: readonly NavigationPoint[]; reverse: readonly NavigationPoint[]; offsets: readonly Readonly<{ forward: number; reverse: number }>[] }>;
export type LaneCoordinationMetrics = {
  junctionTransitionStallCount: number;
  junctionTransitionConflictCount: number;
  stopReservationConflictCount: number;
  duplicateStopReservationCount: number;
  stopOccupancyConflictCount: number;
  deferredBehaviorCount: number;
  deferredBehaviorCompletedCount: number;
  connectorStallCount: number;
};
export type LaneCoordination = Readonly<{
  stopReservations: Map<string, string>;
  transitionReservations: Map<string, string>;
  metrics: LaneCoordinationMetrics;
}>;
export type PlazaLaneRuntime = Readonly<{
  map: GrayboxMap;
  graph: NavigationGraph;
  stops: ReadonlyMap<string, NpcStopPoint>;
  lanes: ReadonlyMap<string, LaneEdge>;
  coordination: LaneCoordination;
}>;
export type StopMovementPlan = Readonly<{
  stop: NpcStopPoint;
  approachNode: string;
  rejoinNode: string;
  approach: NavigationPath;
  rejoin: NavigationPath;
}>;
export type AuthoredPoint = Readonly<NavigationPoint & { name: string }>;
export type AuthoredPointMovementPlan = Readonly<{
  point: AuthoredPoint;
  approachNode: string;
  rejoinNode: string;
  approach: NavigationPath;
  rejoin: NavigationPath;
}>;

const distance = (a: NavigationPoint, b: NavigationPoint) => Math.hypot(b.x - a.x, b.y - a.y);
const samePoint = (a: NavigationPoint, b: NavigationPoint) => distance(a, b) < 1e-5;
const pathLength = (points: readonly NavigationPoint[]) => points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0);
const dedupe = (points: readonly NavigationPoint[]) => points.filter((point, index) => !index || !samePoint(point, points[index - 1]));
const densify = (points: readonly NavigationPoint[]) => dedupe(points.flatMap((from, index) => {
  if (index === points.length - 1) return [from];
  const to = points[index + 1], steps = Math.max(1, Math.ceil(distance(from, to)));
  return Array.from({ length:steps }, (_, step) => ({ x:from.x + (to.x - from.x) * step / steps, y:from.y + (to.y - from.y) * step / steps }));
}));
const stopGroup = (name: string): StopPointGroup => Number(name.slice(2)) <= 4 ? 'BENCH' : Number(name.slice(2)) <= 7 ? 'GENERAL' : name === 'SP8' ? 'CAFE' : name === 'SP9' ? 'FACILITY' : 'MANHOLE';

function travelClear(map: GrayboxMap, points: readonly NavigationPoint[]) {
  const solids = mapObjects(map, 'Collision'), world = mapWorld(map);
  for (let segment = 0; segment < points.length - 1; segment++) {
    const from = points[segment], to = points[segment + 1], steps = Math.max(1, Math.ceil(distance(from, to)));
    const samples = Array.from({ length:steps + 1 }, (_, step) => ({ x:from.x + (to.x - from.x) * step / steps, y:from.y + (to.y - from.y) * step / steps }));
    for (let step = 0; step <= steps; step++) {
      const point = samples[step], ahead = samples[Math.min(steps, step + 8)];
      if (!canOccupy(footprint(point.x, point.y, LANE_FOOTPRINT), solids, world) ||
          !canOccupy(sweptFootprint(point, ahead, LANE_FOOTPRINT), solids, world)) return false;
    }
  }
  return points.every(point => canOccupy(footprint(point.x, point.y, LANE_FOOTPRINT), solids, world));
}

function segmentNormal(from: NavigationPoint, to: NavigationPoint) {
  const length = distance(from, to);
  if (!length) throw new Error('Navigation lane contains a zero-length segment');
  return { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
}

function continuousClearance(map: GrayboxMap, from: NavigationPoint, to: NavigationPoint, sign: -1 | 1, limit: number) {
  const normal = segmentNormal(from, to);
  let clear = 0;
  for (let offset = CLEARANCE_SAMPLE; offset <= limit; offset += CLEARANCE_SAMPLE) {
    const points = [from, to].map(point => ({ x: point.x + normal.x * offset * sign, y: point.y + normal.y * offset * sign }));
    if (!travelClear(map, points)) break;
    clear = offset;
  }
  return clear;
}

function laneOffsets(map: GrayboxMap, from: NavigationPoint, to: NavigationPoint) {
  const normal = segmentNormal(from, to);
  // Minkowski support of two axis-aligned footprints along the lane normal.
  const separation = LANE_FOOTPRINT.width * Math.abs(normal.x) + LANE_FOOTPRINT.height * Math.abs(normal.y) + LANE_GAP;
  const positiveClearance = continuousClearance(map, from, to, 1, separation);
  const negativeClearance = continuousClearance(map, from, to, -1, separation);
  let forward = Math.min(separation / 2, positiveClearance);
  let reverse = separation - forward;
  if (reverse > negativeClearance) reverse = negativeClearance, forward = separation - reverse;
  if (forward > positiveClearance || reverse > negativeClearance) throw new Error(`No safe two-way Large lane at ${from.x},${from.y} -> ${to.x},${to.y}`);
  return Object.freeze({ forward, reverse });
}

function offsetSegment(from: NavigationPoint, to: NavigationPoint, offset: number) {
  const normal = segmentNormal(from, to);
  return [{ x: from.x + normal.x * offset, y: from.y + normal.y * offset }, { x: to.x + normal.x * offset, y: to.y + normal.y * offset }] as const;
}

function buildLaneEdge(map: GrayboxMap, edge: NavigationEdge): LaneEdge {
  const singleFile = SINGLE_FILE.has(edge.name);
  const offsets = edge.points.slice(1).map((to, index) => singleFile ? Object.freeze({ forward: 0, reverse: 0 }) : laneOffsets(map, edge.points[index], to));
  const forward = dedupe(edge.points.slice(1).flatMap((to, index) => offsetSegment(edge.points[index], to, offsets[index].forward)));
  const reverseCanonical = dedupe(edge.points.slice(1).flatMap((to, index) => offsetSegment(edge.points[index], to, -offsets[index].reverse)));
  const reverse = [...reverseCanonical].reverse();
  if (!travelClear(map, forward) || !travelClear(map, reverse)) throw new Error(`${edge.name} lane intersects Collision or world bounds`);
  return Object.freeze({ edge, forward:Object.freeze(forward), reverse:Object.freeze(reverse), offsets:Object.freeze(offsets) });
}

export function loadNpcStopPoints(map: GrayboxMap) {
  const objects = mapObjects(map, 'NPC_Stop_Points');
  const expected = Array.from({ length: 10 }, (_, index) => `SP${index + 1}`);
  if (objects.length !== 10 || new Set(objects.map(stop => stop.name)).size !== 10 ||
      expected.some(name => !objects.some(stop => stop.name === name))) throw new Error('NPC_Stop_Points must contain unique SP1~SP10');
  const stops = new Map<string, NpcStopPoint>();
  for (const object of objects) {
    if (!object.point || object.width !== 0 || object.height !== 0) throw new Error(`${object.name} must be a Point Object`);
    if (!travelClear(map, [object])) throw new Error(`${object.name} cannot hold a Large 26x16 footprint`);
    stops.set(object.name, Object.freeze({ name:object.name, x:object.x, y:object.y, group:stopGroup(object.name) }));
  }
  return stops;
}

export function createPlazaLaneRuntime(map: GrayboxMap, graph: NavigationGraph): PlazaLaneRuntime {
  const stops = loadNpcStopPoints(map);
  const lanes = new Map(graph.edges.map(edge => [edge.name, buildLaneEdge(map, edge)]));
  const metrics: LaneCoordinationMetrics = {
    junctionTransitionStallCount:0,
    junctionTransitionConflictCount:0,
    stopReservationConflictCount:0,
    duplicateStopReservationCount:0,
    stopOccupancyConflictCount:0,
    deferredBehaviorCount:0,
    deferredBehaviorCompletedCount:0,
    connectorStallCount:0,
  };
  return Object.freeze({
    map, graph, stops, lanes,
    coordination:Object.freeze({ stopReservations:new Map(), transitionReservations:new Map(), metrics }),
  });
}

function directedLane(runtime: PlazaLaneRuntime, edgeName: string, fromNode: string) {
  const lane = runtime.lanes.get(edgeName);
  if (!lane) throw new Error(`Missing lane for ${edgeName}`);
  if (fromNode === lane.edge.from) return lane.forward;
  if (fromNode === lane.edge.to) return lane.reverse;
  throw new Error(`${fromNode} is not an endpoint of ${edgeName}`);
}

export function lanePath(runtime: PlazaLaneRuntime, logical: NavigationPath, physicalStart?: NavigationPoint): NavigationPath {
  const pieces = logical.edges.map((edge, index) => directedLane(runtime, edge, logical.nodes[index]));
  const points: NavigationPoint[] = [];
  const junctionTransitions: NonNullable<NavigationPath['junctionTransitions']>[number][] = [];
  const append = (part: readonly NavigationPoint[]) => {
    const dense = densify(part);
    points.push(...dense.slice(points.length && dense.length && samePoint(points.at(-1)!, dense[0]) ? 1 : 0));
  };
  if (physicalStart) append([physicalStart, ...(pieces[0]?.slice(0, 1) ?? [])]);
  if (pieces[0]) append(pieces[0]);
  for (let index = 1; index < pieces.length; index++) {
    const incoming = pieces[index - 1], outgoing = pieces[index];
    const from = incoming.at(-1)!, to = outgoing[0];
    const incomingBefore = incoming.at(-2) ?? from, outgoingAfter = outgoing[1] ?? to;
    const chord = distance(from, to);
    const handle = Math.min(32, chord * .5);
    const incomingLength = Math.max(distance(incomingBefore, from), 1);
    const outgoingLength = Math.max(distance(to, outgoingAfter), 1);
    const turnDot = (from.x - incomingBefore.x) / incomingLength * (outgoingAfter.x - to.x) / outgoingLength +
      (from.y - incomingBefore.y) / incomingLength * (outgoingAfter.y - to.y) / outgoingLength;
    const sharpTurn = turnDot < -.25;
    const controlA = { x:from.x + (from.x - incomingBefore.x) / incomingLength * handle, y:from.y + (from.y - incomingBefore.y) / incomingLength * handle };
    const controlB = { x:to.x - (outgoingAfter.x - to.x) / outgoingLength * handle, y:to.y - (outgoingAfter.y - to.y) / outgoingLength * handle };
    const curve = Array.from({ length:17 }, (_, sample) => {
      const t = sample / 16, u = 1 - t;
      return {
        x:u * u * u * from.x + 3 * u * u * t * controlA.x + 3 * u * t * t * controlB.x + t * t * t * to.x,
        y:u * u * u * from.y + 3 * u * u * t * controlA.y + 3 * u * t * t * controlB.y + t * t * t * to.y,
      };
    });
    const transition = travelClear(runtime.map, curve) ? curve : [from, to];
    // Sharp turns reserve before the bend so a queued Large footprint cannot
    // sit inside the swept corner and block the current owner on its exit leg.
    const startIndex = Math.max(0, points.length - (sharpTurn ? 81 : 1));
    append(transition);
    const transitionEnd = Math.max(startIndex, points.length - 1);
    append(outgoing);
    junctionTransitions.push(Object.freeze({
      key:`${logical.edges[index - 1]}:${logical.nodes[index - 1]}>${logical.nodes[index]}>${logical.edges[index]}:${logical.nodes[index + 1]}`,
      node:logical.nodes[index], incomingEdge:logical.edges[index - 1], outgoingEdge:logical.edges[index],
      startIndex, endIndex:Math.min(points.length - 1, transitionEnd + (sharpTurn ? 80 : 0)),
    }));
  }
  if (!points.length) points.push(physicalStart ?? runtime.graph.nodes.get(logical.nodes[0])!);
  if (!travelClear(runtime.map, points)) throw new Error(`Lane junction transition is not traversable: ${logical.nodes.join(' -> ')}`);
  return Object.freeze({ ...logical, points:Object.freeze(points), distance:pathLength(points), junctionTransitions:Object.freeze(junctionTransitions) });
}

const HOLD_STOPS: Partial<Record<PlazaIntent, readonly string[]>> = Object.freeze({
  BENCH_REST:['SP1','SP2','SP3','SP4'],
  WAIT:['SP5','SP6','SP7'], TALK:['SP5','SP6','SP7'], IDLE:['SP5','SP6','SP7'], LOOK_AROUND:['SP5','SP6','SP7'],
  THREATEN:['SP5','SP6','SP7'], VANDALIZE:['SP5','SP6','SP7'], THEFT:['SP5','SP6','SP7'], SNATCH:['SP5','SP6','SP7'],
  EXERCISE:['SP5','SP6','SP7'], CARRY_TOOLS:['SP5','SP6','SP7'], DELIVERY:['SP5','SP6','SP7'],
  CAFE_SERVICE:['SP8'], FACILITY_REPAIR:['SP9'], REPAIR:['SP9'], MANHOLE_TAMPER:['SP10'],
});

export const stopNamesForIntent = (intent: PlazaIntent) => HOLD_STOPS[intent] ?? [];

function projection(point: NavigationPoint, from: NavigationPoint, to: NavigationPoint) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const ratio = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy)));
  return { point:{ x:from.x + dx * ratio, y:from.y + dy * ratio }, ratio };
}

function stopOptions(runtime: PlazaLaneRuntime, stop: NpcStopPoint) {
  const options: { approachNode:string; rejoinNode:string; lane:readonly NavigationPoint[]; segment:number; branch:NavigationPoint; along:number }[] = [];
  const accessLane = [...runtime.lanes.values()].filter(lane => stop.name !== 'SP10' || !SINGLE_FILE.has(lane.edge.name)).map(lane => ({
    lane,
    distance:Math.min(...lane.edge.points.slice(1).map((to, index) => distance(stop, projection(stop, lane.edge.points[index], to).point))),
  })).sort((a, b) => a.distance - b.distance || a.lane.edge.name.localeCompare(b.lane.edge.name))[0]?.lane;
  if (!accessLane) return options;
  for (const lane of [accessLane]) {
    for (const [approachNode, points] of [[lane.edge.from, lane.forward], [lane.edge.to, lane.reverse]] as const) {
      for (let segment = 0; segment < points.length - 1; segment++) {
        const { point:branch, ratio } = projection(stop, points[segment], points[segment + 1]);
        if (!travelClear(runtime.map, [branch, stop])) continue;
        const along = pathLength(points.slice(0, segment + 1)) + distance(points[segment], branch);
        options.push({ approachNode, rejoinNode:approachNode === lane.edge.from ? lane.edge.to : lane.edge.from, lane:points, segment, branch, along });
      }
    }
  }
  return options;
}

function buildStopMovementPlan(runtime: PlazaLaneRuntime, intent: PlazaIntent, fromNode: string, physicalStart: NavigationPoint, allowedNames?: ReadonlySet<string>): StopMovementPlan | undefined {
  const names = stopNamesForIntent(intent).filter(name => !allowedNames || allowedNames.has(name));
  if (!names.length) return;
  const candidates = names.flatMap(name => {
    const stop = runtime.stops.get(name)!;
    return stopOptions(runtime, stop).map(option => {
      const logical = findNavigationPath(runtime.graph, fromNode, option.approachNode);
      return { stop, option, logical, cost:logical.distance + option.along };
    });
  }).sort((a, b) => a.cost - b.cost || a.stop.name.localeCompare(b.stop.name, undefined, { numeric:true }) || a.option.approachNode.localeCompare(b.option.approachNode));
  const chosen = candidates[0];
  if (!chosen) throw new Error(`No safe local connector for ${intent}`);
  const toApproach = lanePath(runtime, chosen.logical, physicalStart).points;
  const branchLane = [...chosen.option.lane.slice(0, chosen.option.segment + 1), chosen.option.branch];
  const approachPoints = densify([...toApproach, ...branchLane, chosen.stop]);
  const rejoinPoints = densify([chosen.stop, chosen.option.branch, ...chosen.option.lane.slice(chosen.option.segment + 1)]);
  if (!travelClear(runtime.map, approachPoints) || !travelClear(runtime.map, rejoinPoints)) throw new Error(`${chosen.stop.name} local connector traversal failed`);
  return Object.freeze({
    stop:chosen.stop,
    approachNode:chosen.option.approachNode,
    rejoinNode:chosen.option.rejoinNode,
    approach:Object.freeze({ ...chosen.logical, points:Object.freeze(approachPoints), distance:pathLength(approachPoints) }),
    rejoin:Object.freeze({ nodes:Object.freeze([chosen.option.approachNode, chosen.option.rejoinNode]), edges:Object.freeze([]), points:Object.freeze(rejoinPoints), distance:pathLength(rejoinPoints) }),
  });
}

export function stopMovementPlan(runtime: PlazaLaneRuntime, intent: PlazaIntent, fromNode: string, physicalStart: NavigationPoint): StopMovementPlan | undefined {
  return buildStopMovementPlan(runtime, intent, fromNode, physicalStart);
}

export function reserveStopMovementPlan(
  runtime: PlazaLaneRuntime, intent: PlazaIntent, fromNode: string, physicalStart: NavigationPoint, owner: string,
): StopMovementPlan | undefined {
  const available = new Set(stopNamesForIntent(intent).filter(name => {
    const current = runtime.coordination.stopReservations.get(name);
    return current === undefined || current === owner;
  }));
  const plan = buildStopMovementPlan(runtime, intent, fromNode, physicalStart, available);
  if (!plan) return;
  const current = runtime.coordination.stopReservations.get(plan.stop.name);
  if (current && current !== owner) {
    runtime.coordination.metrics.duplicateStopReservationCount++;
    return;
  }
  runtime.coordination.stopReservations.set(plan.stop.name, owner);
  return plan;
}

export function releaseStopReservation(runtime: PlazaLaneRuntime, stopName: string, owner: string) {
  if (runtime.coordination.stopReservations.get(stopName) === owner) runtime.coordination.stopReservations.delete(stopName);
}

export function reserveAuthoredPointMovementPlan(
  runtime: PlazaLaneRuntime,
  point: AuthoredPoint,
  fromNode: string,
  physicalStart: NavigationPoint,
  owner: string,
  occupied: readonly Readonly<{ x:number; y:number; width:number; height:number }>[] = [],
): AuthoredPointMovementPlan | undefined {
  const current = runtime.coordination.stopReservations.get(point.name);
  if (current !== undefined && current !== owner) return;
  const solids = mapObjects(runtime.map, 'Collision'), world = mapWorld(runtime.map);
  const clear = (points: readonly NavigationPoint[]) => travelClear(runtime.map, points) && points.slice(1).every((to, index) =>
    canOccupy(sweptFootprint(points[index], to, LANE_FOOTPRINT), [...occupied], world));
  const options: { lane:LaneEdge; approachNode:string; rejoinNode:string; points:readonly NavigationPoint[]; segment:number; branch:NavigationPoint; logical:NavigationPath; connector:number; cost:number }[] = [];
  for (const lane of runtime.lanes.values()) for (const [approachNode, rejoinNode, points] of
    [[lane.edge.from, lane.edge.to, lane.forward], [lane.edge.to, lane.edge.from, lane.reverse]] as const) {
    for (let segment = 0; segment < points.length - 1; segment++) {
      const { point:branch } = projection(point, points[segment], points[segment + 1]);
      if (!canOccupy(sweptFootprint(branch, point, LANE_FOOTPRINT), solids, world) || !clear([branch, point])) continue;
      const logical = findNavigationPath(runtime.graph, fromNode, approachNode);
      const along = pathLength(points.slice(0, segment + 1)) + distance(points[segment], branch);
      options.push({ lane, approachNode, rejoinNode, points, segment, branch, logical, connector:distance(branch, point), cost:logical.distance + along });
    }
  }
  options.sort((a, b) => a.connector - b.connector || a.cost - b.cost || a.lane.edge.name.localeCompare(b.lane.edge.name));
  for (const chosen of options) {
    const physicalApproach = lanePath(runtime, chosen.logical, physicalStart);
    const approachPoints = densify([...physicalApproach.points, ...chosen.points.slice(0, chosen.segment + 1), chosen.branch, point]);
    const rejoinPoints = densify([point, chosen.branch, ...chosen.points.slice(chosen.segment + 1)]);
    if (!clear(approachPoints) || !clear(rejoinPoints)) continue;
    const joinIndex=Math.max(0,physicalApproach.points.length-1);
    const junctionTransitions=Object.freeze([...(physicalApproach.junctionTransitions??[]),Object.freeze({
      key:`ROUND_POINT:${chosen.approachNode}:${point.name}`,node:chosen.approachNode,
      incomingEdge:chosen.logical.edges.at(-1)??chosen.lane.edge.name,outgoingEdge:chosen.lane.edge.name,
      startIndex:Math.max(0,joinIndex-64),endIndex:Math.min(approachPoints.length-1,joinIndex+64),
    })]);
    runtime.coordination.stopReservations.set(point.name, owner);
    return Object.freeze({
      point,
      approachNode:chosen.approachNode,
      rejoinNode:chosen.rejoinNode,
      approach:Object.freeze({ ...chosen.logical, points:Object.freeze(approachPoints), distance:pathLength(approachPoints), junctionTransitions }),
      rejoin:Object.freeze({ nodes:Object.freeze([chosen.approachNode, chosen.rejoinNode]), edges:Object.freeze([]), points:Object.freeze(rejoinPoints), distance:pathLength(rejoinPoints) }),
    });
  }
}

export function isRoadLanePoint(runtime: PlazaLaneRuntime, point: NavigationPoint, tolerance = 1) {
  return [...runtime.lanes.values()].some(lane => [...lane.forward, ...lane.reverse].some(candidate => distance(candidate, point) <= tolerance));
}

export function nearestLaneEdge(runtime: PlazaLaneRuntime, point: NavigationPoint) {
  let best = { edge:'NONE', distance:Infinity };
  for (const lane of runtime.lanes.values()) for (const points of [lane.forward, lane.reverse]) {
    for (let index = 0; index < points.length - 1; index++) {
      const candidate = projection(point, points[index], points[index + 1]).point;
      const candidateDistance = distance(point, candidate);
      if (candidateDistance < best.distance) best = { edge:lane.edge.name, distance:candidateDistance };
    }
  }
  return best.edge;
}

export function validateLaneRuntime(runtime: PlazaLaneRuntime) {
  const connectorFailures: string[] = [];
  for (const intent of Object.keys(HOLD_STOPS) as PlazaIntent[]) {
    try { stopMovementPlan(runtime, intent, 'N02', runtime.graph.nodes.get('N02')!); } catch { connectorFailures.push(intent); }
  }
  return Object.freeze({
    stopCount:runtime.stops.size,
    laneCount:runtime.lanes.size,
    separatedLaneCount:[...runtime.lanes.values()].filter(lane => !SINGLE_FILE.has(lane.edge.name) && lane.forward.some((point,index) => !samePoint(point,lane.reverse.at(-(index + 1))!))).length,
    singleFileEdges:Object.freeze([...SINGLE_FILE_EDGE_NAMES]),
    connectorFailures:Object.freeze(connectorFailures),
  });
}
