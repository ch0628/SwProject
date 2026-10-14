import { ACTION_TIME, ENCOUNTER_RATES, navigationPolylineTime, timeLimitFromSafeBaselines } from './learningEngine.ts';
import { properties, type TiledMapJson, type TiledObject } from '../debug/floor1Tiled.ts';

export const ACTUAL_GRAPH_FILE = 'docs/modules/machine_learning/reinforcement/navigation/navigation_graph_v1_f5_v3.json';
export const ACTUAL_MAP_FILES = Array.from({ length: 5 }, (_, index) => `public/maps/reinforcement/floor_${index + 1}_blockout.tmj`);
export const F5_ROOMS = ['L1', 'L2', 'R1', 'R2'] as const;
export type F5Room = (typeof F5_ROOMS)[number];
export type TraitLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type EncounterKind = 'OBSTACLE' | 'CITIZEN_NEARBY' | 'AMBIGUOUS_PERSON' | 'VILLAIN_ENCOUNTER';

type GraphTraits = {
  citizenExposure: TraitLevel;
  obstacleRisk: TraitLevel;
  ambiguousExposure: TraitLevel;
  narrowness: TraitLevel;
};

type LogicalGraph = {
  floors: Array<{
    floor: number;
    edges: Array<{ visualRouteId: string; traits: GraphTraits }>;
  }>;
  bossSearch: {
    roomIds: F5Room[];
    locationPolicyVisibility: boolean;
    repeatSelectionAllowed: boolean;
    contextKey: { canonicalRoomOrder: F5Room[]; includesHiddenLocation: boolean };
  };
  goal: { completionFlow: string[] };
};

export type ActualEdge = {
  id: string;
  floor: number;
  from: string;
  to: string;
  routeId?: string;
  availability: string;
  pixelLength: number;
  tileLength: number;
  simulationTime: number;
  points: Array<{ x: number; y: number }>;
};

export type ActualEncounterZone = {
  id: string;
  floor: number;
  routeId?: string;
  kind: EncounterKind;
  mandatory: boolean;
  rate: number;
  villainCount?: 1 | 2;
  bypassAvailable: boolean;
  roomId?: F5Room;
  x: number;
  y: number;
};

export type ActualRouteOption = {
  id: string;
  action: `ACTUAL_ROUTE:${string}`;
  floor: number;
  contextId: string;
  startNodeId: string;
  endNodeId: string;
  edgeIds: string[];
  encounterZoneIds: string[];
  movementTime: number;
  transitionId: string;
  targetFloor: number;
  targetSpawn: string;
  detourAvailable: boolean;
};

export type ActualRouteContext = {
  id: string;
  floor: number;
  startNodeId: string;
  options: ActualRouteOption[];
};

export type F5RoomPath = {
  room: F5Room;
  action: `ACTUAL_ROUTE:F5_ROOM_${F5Room}`;
  approachEdgeIds: string[];
  movementTime: number;
  guardApproachTime: number;
  roomEntryTime: number;
  guardZoneId: string;
  noBossReturnEdgeId: string;
  postBossEdgeId: string;
};

export type ActualMapEnvironment = {
  floorCounts: Array<{ floor: number; nodes: number; edges: number; encounters: number; transitions: number; spawns: number }>;
  edges: ActualEdge[];
  zones: ActualEncounterZone[];
  contexts: ActualRouteContext[];
  transitions: Array<{ id: string; floor: number; stairId: string; targetFloor: number; targetSpawn: string }>;
  spawns: Array<{ id: string; floor: number; nodeId: string }>;
  f5Rooms: F5RoomPath[];
  f5PostBossEdgeIds: string[];
  longestSafeSuccessBaseline: number;
  timeLimit: number;
  contractIssues: string[];
};

const layerObjects = (map: TiledMapJson, name: string): TiledObject[] =>
  map.layers.find(layer => layer.name === name)?.objects ?? [];

const normalizeRoute = (route: string): string => route.replace(/^F\d_/, '').replace('PUBLIC', 'EVAC');

function shortestPath(
  start: string,
  target: (nodeId: string) => boolean,
  edges: ActualEdge[],
  allowed: (edge: ActualEdge) => boolean,
): ActualEdge[] | undefined {
  const queue: Array<{ node: string; path: ActualEdge[]; cost: number }> = [{ node: start, path: [], cost: 0 }];
  const best = new Map([[start, 0]]);
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    if (target(current.node)) return current.path;
    for (const edge of edges.filter(edge => allowed(edge) && (edge.from === current.node || edge.to === current.node))) {
      const next = edge.from === current.node ? edge.to : edge.from;
      const cost = current.cost + edge.simulationTime;
      if (cost >= (best.get(next) ?? Number.POSITIVE_INFINITY)) continue;
      best.set(next, cost);
      queue.push({ node: next, path: [...current.path, edge], cost });
    }
  }
  return undefined;
}

function contextKey(remainingRooms: readonly F5Room[]): string {
  return `F5_ROOM_SEARCH[${F5_ROOMS.filter(room => remainingRooms.includes(room)).join(',')}]`;
}

export const f5SearchContext = contextKey;

export function buildActualMapEnvironment(maps: readonly TiledMapJson[], graph: LogicalGraph): ActualMapEnvironment {
  if (maps.length !== 5) throw new Error(`Actual map adapter requires 5 floors, received ${maps.length}`);
  const issues: string[] = [];
  const nodes = new Map<string, { floor: number; object: TiledObject; type: string; contextId?: string }>();
  const edges: ActualEdge[] = [];
  const transitions: ActualMapEnvironment['transitions'] = [];
  const spawns: ActualMapEnvironment['spawns'] = [];
  const rawZones: Array<{ object: TiledObject; values: Record<string, unknown> }> = [];
  const floorCounts: ActualMapEnvironment['floorCounts'] = [];

  for (const [index, map] of maps.entries()) {
    const floor = index + 1;
    if (map.tilewidth !== 32 || map.tileheight !== 32) throw new Error(`Floor ${floor}: actual map must use 32px tiles`);
    const nodeObjects = layerObjects(map, 'NavigationNodes');
    const edgeObjects = layerObjects(map, 'NavigationEdges');
    const zoneObjects = layerObjects(map, 'EncounterZones');
    const transitionObjects = layerObjects(map, 'FloorTransitions');
    const spawnObjects = layerObjects(map, 'SpawnPoints');
    floorCounts.push({ floor, nodes: nodeObjects.length, edges: edgeObjects.length, encounters: zoneObjects.length, transitions: transitionObjects.length, spawns: spawnObjects.length });

    for (const object of nodeObjects) {
      const values = properties(object);
      const id = String(values.nodeId ?? object.name);
      if (nodes.has(id)) throw new Error(`Duplicate NavigationNode id ${id}`);
      nodes.set(id, { floor, object, type: String(values.type ?? object.type ?? ''), contextId: values.routeContextId as string | undefined });
    }
    for (const object of edgeObjects) {
      const values = properties(object);
      const points = object.polyline;
      if (!points || points.length < 2) throw new Error(`${object.name}: navigation polyline is missing`);
      const tileLength = navigationPolylineTime(points, 32);
      if (!Number.isFinite(tileLength) || tileLength <= 0) throw new Error(`${object.name}: navigation time must be positive`);
      const metadataLength = Number(values.lengthTiles);
      if (Number.isFinite(metadataLength) && Math.abs(metadataLength - tileLength) > 0.01) issues.push(`MAP_CONTRACT_ISSUE: ${object.name} lengthTiles=${metadataLength} but polyline=${tileLength}`);
      edges.push({
        id: String(values.edgeId ?? object.name), floor, from: String(values.from), to: String(values.to),
        routeId: values.route as string | undefined, availability: String(values.availability ?? 'ALWAYS'),
        pixelLength: tileLength * 32, tileLength, simulationTime: tileLength,
        points: points.map(point => ({ x: object.x + point.x, y: object.y + point.y })),
      });
    }
    for (const object of transitionObjects) {
      const values = properties(object);
      transitions.push({ id: String(values.transitionId ?? object.name), floor, stairId: String(values.stairId), targetFloor: Number(values.targetFloor), targetSpawn: String(values.targetSpawn) });
    }
    for (const object of spawnObjects) {
      const values = properties(object);
      const node = [...nodes.entries()].find(([, candidate]) => candidate.floor === floor && candidate.object.x === object.x && candidate.object.y === object.y)?.[0];
      if (!node) throw new Error(`Floor ${floor}: spawn ${String(values.spawnId)} has no exact NavigationNode`);
      spawns.push({ id: String(values.spawnId), floor, nodeId: node });
    }
    rawZones.push(...zoneObjects.map(object => ({ object, values: properties(object) })));
  }

  if (new Set(edges.map(edge => edge.id)).size !== edges.length) throw new Error('Duplicate NavigationEdge id');
  for (const edge of edges) if (!nodes.has(edge.from) || !nodes.has(edge.to)) throw new Error(`${edge.id}: missing endpoint`);
  for (const transition of transitions) if (!spawns.some(spawn => spawn.floor === transition.targetFloor && spawn.id === transition.targetSpawn)) throw new Error(`${transition.id}: targetSpawn is missing`);

  const semanticRoutes = graph.floors.flatMap(floor => floor.edges.map(edge => ({ floor: floor.floor, route: edge.visualRouteId, traits: edge.traits })));
  const traitsFor = (floor: number, routeId?: string): GraphTraits | undefined => {
    if (!routeId) return undefined;
    return semanticRoutes.find(route => route.floor === floor && normalizeRoute(route.route) === normalizeRoute(routeId))?.traits;
  };
  const zones: ActualEncounterZone[] = rawZones.map(({ object, values }) => {
    const floor = Number(values.floor ?? (values.roomId ? 5 : 0));
    const routeId = values.route as string | undefined;
    const kind = String(values.encounterType ?? values.state) as EncounterKind;
    const traits = traitsFor(floor, routeId);
    const level = kind === 'OBSTACLE' ? traits?.obstacleRisk : kind === 'CITIZEN_NEARBY' ? traits?.citizenExposure : traits?.ambiguousExposure;
    const mandatory = values.mandatory === true || kind === 'VILLAIN_ENCOUNTER';
    const rate = mandatory ? ENCOUNTER_RATES.MANDATORY : level ? ENCOUNTER_RATES[level] : ENCOUNTER_RATES.LOW;
    if (!mandatory && !traits) issues.push(`MAP_CONTRACT_ISSUE: ${String(values.zoneId)} has no graph trait match; LOW fallback used`);
    return {
      id: String(values.zoneId), floor, routeId, kind, mandatory, rate,
      villainCount: values.villainCount as 1 | 2 | undefined,
      bypassAvailable: values.bypassAvailable === true,
      roomId: values.roomId as F5Room | undefined,
      x: object.x + object.width / 2,
      y: object.y + object.height / 2,
    };
  });

  const contexts: ActualRouteContext[] = [];
  const seenContextIds = new Set<string>();
  for (const [nodeId, node] of nodes) {
    if (node.floor === 5 || !node.contextId || seenContextIds.has(node.contextId) || (node.type !== 'ROUTE_CHOICE' && node.type !== 'DECISION')) continue;
    seenContextIds.add(node.contextId);
    const startNodeId = node.floor === 1 ? spawns.find(spawn => spawn.floor === 1)!.nodeId : nodeId;
    const floorEdges = edges.filter(edge => edge.floor === node.floor);
    const routeIds = [...new Set(floorEdges.filter(edge => edge.from === startNodeId || edge.to === startNodeId).map(edge => edge.routeId).filter(Boolean))] as string[];
    const floorTransitions = transitions.filter(transition => transition.floor === node.floor);
    const stairIds = new Set(floorTransitions.map(transition => transition.stairId));
    const options = routeIds.map(routeId => {
      let path = shortestPath(startNodeId, id => stairIds.has(id), floorEdges, edge => edge.routeId === routeId);
      if (!path) {
        const approach = shortestPath(startNodeId, id => nodes.get(id)?.type === 'ENCOUNTER', floorEdges, edge => edge.routeId === routeId);
        if (!approach) throw new Error(`${node.contextId}/${routeId}: no actual route to stair or guard`);
        const last = approach.at(-1)!;
        const guardId = nodes.get(last.to)?.type === 'ENCOUNTER' ? last.to : last.from;
        const exit = floorEdges.find(edge => (edge.from === guardId && stairIds.has(edge.to)) || (edge.to === guardId && stairIds.has(edge.from)));
        if (!exit) throw new Error(`${node.contextId}/${routeId}: guard has no stair edge`);
        path = [...approach, exit];
      }
      const endNodeId = [...path].reverse().map(edge => stairIds.has(edge.to) ? edge.to : stairIds.has(edge.from) ? edge.from : '').find(Boolean)!;
      const transition = floorTransitions.find(candidate => candidate.stairId === endNodeId);
      if (!transition) throw new Error(`${node.contextId}/${routeId}: transition is missing`);
      const routeSet = new Set(path.map(edge => edge.routeId).filter(Boolean));
      const encounterZoneIds = zones.filter(zone => zone.floor === node.floor && zone.routeId && routeSet.has(zone.routeId)).map(zone => zone.id);
      return {
        id: routeId, action: `ACTUAL_ROUTE:${routeId}` as const, floor: node.floor, contextId: node.contextId!, startNodeId,
        endNodeId, edgeIds: path.map(edge => edge.id), encounterZoneIds,
        movementTime: path.reduce((sum, edge) => sum + edge.simulationTime, 0),
        transitionId: transition.id, targetFloor: transition.targetFloor, targetSpawn: transition.targetSpawn,
        detourAvailable: routeIds.length > 1,
      };
    });
    contexts.push({ id: node.contextId, floor: node.floor, startNodeId, options });
  }
  if (new Set(contexts.map(context => context.id)).size !== contexts.length) throw new Error('Duplicate Route Context id');

  if (graph.bossSearch.roomIds.join(',') !== F5_ROOMS.join(',') || graph.bossSearch.locationPolicyVisibility || graph.bossSearch.repeatSelectionAllowed || graph.bossSearch.contextKey.includesHiddenLocation) {
    throw new Error('F5 Boss search graph contract is invalid');
  }
  const floor5Edges = edges.filter(edge => edge.floor === 5);
  const f5Rooms = F5_ROOMS.map(room => {
    const roomNode = `F5_ROOM_${room}`;
    const approach = shortestPath('F5_SEARCH_HUB', id => id === roomNode, floor5Edges, edge => edge.availability === 'ALWAYS');
    if (!approach) throw new Error(`F5 ${room}: approach path missing`);
    const guard = zones.find(zone => zone.floor === 5 && zone.roomId === room);
    const noBoss = floor5Edges.find(edge => edge.from === roomNode && edge.availability === 'NO_BOSS_RETURN');
    const postBoss = floor5Edges.find(edge => edge.from === roomNode && edge.availability === 'BOSS_NEUTRALIZED');
    if (!guard || !noBoss || !postBoss) throw new Error(`F5 ${room}: guard/return/post-Boss contract missing`);
    const roomEntry = approach.at(-1)!;
    if (roomEntry.to !== roomNode && roomEntry.from !== roomNode) throw new Error(`F5 ${room}: room-entry edge missing`);
    return {
      room, action: `ACTUAL_ROUTE:F5_ROOM_${room}` as const, approachEdgeIds: approach.map(edge => edge.id),
      movementTime: approach.reduce((sum, edge) => sum + edge.simulationTime, 0),
      guardApproachTime: approach.slice(0, -1).reduce((sum, edge) => sum + edge.simulationTime, 0),
      roomEntryTime: roomEntry.simulationTime,
      guardZoneId: guard.id,
      noBossReturnEdgeId: noBoss.id, postBossEdgeId: postBoss.id,
    };
  });
  const f5PostBossEdgeIds = ['E_F5_HALL_LOCK', 'E_F5_LOCK_CONTROL', 'E_F5_CONTROL_GOAL'];
  if (f5PostBossEdgeIds.some(id => !edges.some(edge => edge.id === id))) throw new Error('F5 post-Boss flow is incomplete');
  if (graph.goal.completionFlow.join(',') !== 'BOSS_NEUTRALIZED,SECURITY_LOCK_OPEN,SYSTEM_RESTORED,GOAL_REACHED') throw new Error('Goal completion flow is invalid');

  const safeZoneCost = (zone: ActualEncounterZone, option?: ActualRouteOption): number => {
    if (zone.kind === 'OBSTACLE') return option?.detourAvailable ? ACTION_TIME.LARGE : ACTION_TIME.MEDIUM;
    if (zone.kind === 'CITIZEN_NEARBY') return ACTION_TIME.LARGE;
    if (zone.kind === 'AMBIGUOUS_PERSON') return ACTION_TIME.SMALL;
    return ACTION_TIME.VERY_SMALL;
  };
  const optionSafeCost = (option: ActualRouteOption): number => option.movementTime
    + option.encounterZoneIds.reduce((sum, id) => sum + safeZoneCost(zones.find(zone => zone.id === id)!, option), 0);
  const contextById = new Map(contexts.map(context => [context.id, context]));
  const maxContext = (id: string): number => Math.max(...contextById.get(id)!.options.map(optionSafeCost));
  const floor1 = contextById.get('F1_ENTRY_SPLIT')!;
  const f1F2 = Math.max(...floor1.options.map(option => optionSafeCost(option) + maxContext(spawns.find(spawn => spawn.floor === 2 && spawn.id === option.targetSpawn)!.id === 'F2_LEFT_ARRIVAL' ? 'F2_LEFT_APPROACH' : 'F2_RIGHT_APPROACH')));
  const floor3 = contextById.get('F3_STAIR_SPLIT')!;
  const f3F4 = Math.max(...floor3.options.map(option => optionSafeCost(option) + maxContext(spawns.find(spawn => spawn.floor === 4 && spawn.id === option.targetSpawn)!.id === 'F4_LEFT_ARRIVAL' ? 'F4_LEFT_APPROACH' : 'F4_RIGHT_APPROACH')));
  const edgeTime = (id: string): number => edges.find(edge => edge.id === id)!.simulationTime;
  const noBossRoomCost = Math.max(...f5Rooms.map(room => room.movementTime + ACTION_TIME.VERY_SMALL + edgeTime(room.noBossReturnEdgeId)));
  const bossRoomCost = Math.max(...f5Rooms.map(room => room.movementTime + ACTION_TIME.VERY_SMALL + ACTION_TIME.MEDIUM + ACTION_TIME.VERY_SMALL + edgeTime(room.postBossEdgeId)))
    + f5PostBossEdgeIds.reduce((sum, id) => sum + edgeTime(id), 0) + ACTION_TIME.VERY_SMALL;
  const f5WorstSafe = 3 * noBossRoomCost + bossRoomCost;
  const longestSafeSuccessBaseline = f1F2 + f3F4 + f5WorstSafe;

  return {
    floorCounts, edges, zones, contexts, transitions, spawns, f5Rooms, f5PostBossEdgeIds,
    longestSafeSuccessBaseline, timeLimit: timeLimitFromSafeBaselines([longestSafeSuccessBaseline]), contractIssues: issues,
  };
}
