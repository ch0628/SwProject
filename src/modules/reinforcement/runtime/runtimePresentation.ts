import { axisAlignedBounds, properties, type TiledMapJson } from '../debug/floor1Tiled.ts';
import type { F5Room } from '../sim/actualMapEnvironment.ts';
import {
  RUNTIME_CONTACT_FOOTPRINTS,
  RUNTIME_STAGING_GAP,
  type RuntimeCommand,
  type RuntimeFootprint,
  type RuntimePoint,
} from './runtimeCommands.ts';

export type RuntimeEntityKind = 'OBSTACLE' | 'CITIZEN' | 'AMBIGUOUS' | 'VILLAIN' | 'GUARD' | 'BOSS';
export type RuntimeEntityVisualState = 'NORMAL' | 'NEUTRALIZED' | 'CLEARED';

export type RuntimePresentedEntity = {
  id: string;
  zoneId: string;
  floor: number;
  kind: RuntimeEntityKind;
  position: RuntimePoint;
  originalPosition: RuntimePoint;
  clearedPosition: RuntimePoint;
  pushedPosition: RuntimePoint;
  pushIntermediate: RuntimePoint;
  forcePassPosition: RuntimePoint;
  routePosition: RuntimePoint;
  stagingPosition: RuntimePoint;
  contactPosition: RuntimePoint;
  approachPoints: RuntimePoint[];
  incomingDirection: RuntimePoint;
  visualState: RuntimeEntityVisualState;
  blocking: boolean;
  visible: boolean;
  variant?: 1 | 2 | 3 | 4;
};

export type RuntimePresentationState = {
  entities: Record<string, RuntimePresentedEntity>;
  openDoors: F5Room[];
  securityLockOpen: boolean;
};

export type RuntimePresentationMotion = {
  kind: 'PUSH' | 'CLEAR' | 'FORCE_PASS';
  entities: Array<{ id: string; from: RuntimePoint; via?: RuntimePoint; to: RuntimePoint }>;
  direction?: RuntimePoint;
  robotCoupled?: boolean;
  robotStaging?: RuntimePoint;
  robotContact?: RuntimePoint;
  robotPushTo?: RuntimePoint;
  robotApproach?: RuntimePoint[];
};

const RUNTIME_TILE_PATH_OVERRIDES: Readonly<Record<string, string>> = {
  '/assets/environment/reinforcement/floor2_room_shell_manual/F2_FLOOR_PART_Corner.png':
    '/assets/environment/reinforcement/floor2_room_shell_manual/F2_FLOOR_PART_CORNER.png',
};

export const resolveRuntimePublicPath = (relativePath: string, basePath: string) => {
  const normalized = relativePath.trim().replaceAll('\\', '/');
  const resolved = new URL(normalized, new URL(basePath, 'http://runtime.local')).pathname;
  return RUNTIME_TILE_PATH_OVERRIDES[resolved] ?? resolved;
};

const kindFor = (command: Extract<RuntimeCommand, { type: 'ENCOUNTER' }>): RuntimeEntityKind => {
  if (command.encounter === 'OBSTACLE') return 'OBSTACLE';
  if (command.encounter === 'CITIZEN_NEARBY') return 'CITIZEN';
  if (command.encounter === 'AMBIGUOUS_PERSON') return 'AMBIGUOUS';
  if (command.encounter === 'BOSS_ENCOUNTER') return 'BOSS';
  return command.floor === 5 ? 'GUARD' : 'VILLAIN';
};

const add = (point: RuntimePoint, direction: RuntimePoint, distance: number): RuntimePoint => ({
  x: point.x + direction.x * distance,
  y: point.y + direction.y * distance,
});
const normalFor = (direction: RuntimePoint) => ({ x: -direction.y, y: direction.x });
const projectedHalfExtent = (footprint: RuntimeFootprint, direction: RuntimePoint) =>
  Math.abs(direction.x) * footprint.width / 2 + Math.abs(direction.y) * footprint.height / 2;
const footprintFor = (kind: RuntimeEntityKind): RuntimeFootprint => kind === 'OBSTACLE'
  ? RUNTIME_CONTACT_FOOTPRINTS.OBSTACLE
  : kind === 'BOSS'
    ? RUNTIME_CONTACT_FOOTPRINTS.BOSS_ENCOUNTER
    : kind === 'CITIZEN'
      ? RUNTIME_CONTACT_FOOTPRINTS.CITIZEN_NEARBY
      : kind === 'AMBIGUOUS'
        ? RUNTIME_CONTACT_FOOTPRINTS.AMBIGUOUS_PERSON
        : RUNTIME_CONTACT_FOOTPRINTS.VILLAIN_ENCOUNTER;

const rectFor = (point: RuntimePoint, footprint: RuntimeFootprint) => ({
  x: point.x - footprint.width / 2,
  y: point.y - footprint.height / 2,
  width: footprint.width,
  height: footprint.height,
});
const overlaps = (left: ReturnType<typeof rectFor>, right: ReturnType<typeof rectFor>) =>
  left.x < right.x + right.width && left.x + left.width > right.x
  && left.y < right.y + right.height && left.y + left.height > right.y;

const collisionBounds = (map?: TiledMapJson) => (map?.layers.find(layer => layer.name === 'Collision')?.objects ?? [])
  .filter(object => {
    const values = properties(object);
    return values.blocksRobot !== false && object.width > 0 && object.height > 0;
  })
  .map(axisAlignedBounds);

const validPosition = (
  map: TiledMapJson | undefined,
  point: RuntimePoint,
  footprint: RuntimeFootprint,
  occupied: Array<{ point: RuntimePoint; footprint: RuntimeFootprint }> = [],
) => {
  if (!map) return true;
  const bounds = rectFor(point, footprint);
  const width = map.width * map.tilewidth;
  const height = map.height * map.tileheight;
  if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > width || bounds.y + bounds.height > height) return false;
  if (collisionBounds(map).some(collision => overlaps(bounds, collision))) return false;
  return !occupied.some(other => overlaps(bounds, rectFor(other.point, other.footprint)));
};

const validMotion = (
  map: TiledMapJson | undefined,
  points: readonly RuntimePoint[],
  footprint: RuntimeFootprint,
  occupied: Array<{ point: RuntimePoint; footprint: RuntimeFootprint }>,
) => points.slice(1).every((target, index) => {
  const from = points[index];
  const distance = Math.hypot(target.x - from.x, target.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / 8));
  return Array.from({ length: steps }, (_, step) => ({
    x: from.x + (target.x - from.x) * (step + 1) / steps,
    y: from.y + (target.y - from.y) * (step + 1) / steps,
  })).every(point => validPosition(map, point, footprint, occupied));
});

const routeOverlap = (point: RuntimePoint, route: RuntimePoint, direction: RuntimePoint, footprint: RuntimeFootprint) => {
  const normal = normalFor(direction);
  const perpendicular = Math.abs((point.x - route.x) * normal.x + (point.y - route.y) * normal.y);
  const entityHalf = Math.abs(normal.x) * footprint.width / 2 + Math.abs(normal.y) * footprint.height / 2;
  const robotHalf = Math.abs(normal.x) * RUNTIME_CONTACT_FOOTPRINTS.ROBOT.width / 2
    + Math.abs(normal.y) * RUNTIME_CONTACT_FOOTPRINTS.ROBOT.height / 2;
  return perpendicular < entityHalf + robotHalf;
};

const nearestValid = (
  map: TiledMapJson | undefined,
  candidates: readonly RuntimePoint[],
  footprint: RuntimeFootprint,
  occupied: Array<{ point: RuntimePoint; footprint: RuntimeFootprint }> = [],
) => candidates.find(point => validPosition(map, point, footprint, occupied)) ?? candidates[0];

const routeObstaclePosition = (map: TiledMapJson | undefined, command: Extract<RuntimeCommand, { type: 'ENCOUNTER' }>) => {
  const step = (map?.tilewidth ?? 32) / 4;
  const contactDistance = projectedHalfExtent(RUNTIME_CONTACT_FOOTPRINTS.OBSTACLE, command.incomingDirection)
    + projectedHalfExtent(RUNTIME_CONTACT_FOOTPRINTS.ROBOT, command.incomingDirection);
  return [contactDistance, contactDistance + step, contactDistance + step * 2, contactDistance + step * 3]
    .map(distance => add(command.routePosition, command.incomingDirection, distance)).find(point =>
    routeOverlap(point, command.routePosition, command.incomingDirection, RUNTIME_CONTACT_FOOTPRINTS.OBSTACLE)
    && validPosition(map, point, RUNTIME_CONTACT_FOOTPRINTS.OBSTACLE)) ?? command.routePosition;
};

const offRouteCandidates = (origin: RuntimePoint, direction: RuntimePoint) => {
  const normal = normalFor(direction);
  return [48, 64, 80, 96, 112, 128].flatMap(distance => [add(origin, normal, distance), add(origin, normal, -distance)]);
};

const placementForVillainPair = (
  command: Extract<RuntimeCommand, { type: 'ENCOUNTER' }>,
  map?: TiledMapJson,
) => {
  const stairs = map?.layers.find(layer => layer.name === 'FloorTransitions')?.objects?.length ?? 2;
  const footprint = RUNTIME_CONTACT_FOOTPRINTS.VILLAIN_ENCOUNTER;
  if (stairs <= 1) {
    const halfSeparation = 32;
    const centers = [command.routePosition, command.position];
    const adjustments = [0, -16, 16, -32, 32];
    for (const center of centers) {
      for (const y of adjustments) {
        for (const x of adjustments) {
          const pair = [
            { x: center.x + x - halfSeparation, y: center.y + y },
            { x: center.x + x + halfSeparation, y: center.y + y },
          ];
          if (pair.every((point, index) => validPosition(map, point, footprint, pair.slice(0, index).map(previous => ({ point: previous, footprint }))))) return pair;
        }
      }
    }
  }
  return [-17, 17].map(offset => ({ x: command.position.x + offset, y: command.position.y }));
};

export function createRuntimePresentation(
  commands: readonly RuntimeCommand[],
  maps: readonly TiledMapJson[] = [],
): RuntimePresentationState {
  const entities: Record<string, RuntimePresentedEntity> = {};
  for (const command of commands) {
    if (command.type !== 'ENCOUNTER' || command.phase !== 'START') continue;
    const count = command.encounter === 'VILLAIN_ENCOUNTER' ? command.villainCount ?? 1 : 1;
    const map = maps[command.floor - 1];
    const kind = kindFor(command);
    const pairPositions = kind !== 'BOSS' && count === 2 ? placementForVillainPair(command, map) : undefined;
    for (let index = 0; index < count; index++) {
      const id = `${command.floor}:${command.zoneId}:${index}`;
      if (entities[id]) continue;
      const offset = (index * 2 - (count - 1)) * 17;
      const position = kind === 'OBSTACLE'
        ? routeObstaclePosition(map, command)
        : pairPositions?.[index] ?? { x: command.position.x + offset, y: command.position.y };
      const contactDistance = projectedHalfExtent(footprintFor(kind), command.incomingDirection)
        + projectedHalfExtent(RUNTIME_CONTACT_FOOTPRINTS.ROBOT, command.incomingDirection);
      const contactPosition = add(position, command.incomingDirection, -contactDistance);
      const approachPoints = kind === 'OBSTACLE'
        ? [...command.approachPoints, command.routePosition, contactPosition]
          .filter((point, pointIndex, points) => pointIndex === 0 || point.x !== points[pointIndex - 1].x || point.y !== points[pointIndex - 1].y)
        : command.approachPoints;
      entities[id] = {
        id,
        zoneId: command.zoneId,
        floor: command.floor,
        kind,
        position,
        originalPosition: position,
        clearedPosition: command.clearedPosition,
        pushedPosition: command.clearedPosition,
        pushIntermediate: position,
        forcePassPosition: position,
        routePosition: command.routePosition,
        stagingPosition: kind === 'OBSTACLE'
          ? approachPoints[0] ?? add(contactPosition, command.incomingDirection, -RUNTIME_STAGING_GAP)
          : command.stagingPosition,
        contactPosition,
        approachPoints,
        incomingDirection: command.incomingDirection,
        visualState: 'NORMAL',
        blocking: command.encounter === 'OBSTACLE',
        visible: command.encounter !== 'BOSS_ENCOUNTER',
        variant: command.villainVariant,
      };
    }
  }

  const all = Object.values(entities);
  for (const entity of all.filter(candidate => candidate.kind === 'OBSTACLE')) {
    const map = maps[entity.floor - 1];
    const footprint = footprintFor(entity.kind);
    const occupied = all.filter(other => other.id !== entity.id && other.blocking)
      .map(other => ({ point: other.originalPosition, footprint: footprintFor(other.kind) }));
    const clearCandidates = offRouteCandidates(entity.originalPosition, entity.incomingDirection)
      .filter(point => !routeOverlap(point, entity.originalPosition, entity.incomingDirection, footprint));
    entity.clearedPosition = nearestValid(map, clearCandidates, footprint, occupied);

    const pushDistance = map?.tilewidth ?? 32;
    const pushSteps = Math.max(map?.width ?? 8, map?.height ?? 8);
    const pushPlan = Array.from({ length: pushSteps }, (_, index) => add(entity.originalPosition, entity.incomingDirection, pushDistance * (index + 1)))
      .filter(intermediate => validMotion(map, [entity.originalPosition, intermediate], footprint, occupied))
      .map(intermediate => ({
        intermediate,
        final: offRouteCandidates(intermediate, entity.incomingDirection)
          .filter(point => !routeOverlap(point, entity.originalPosition, entity.incomingDirection, footprint))
          .find(point => validMotion(map, [intermediate, point], footprint, occupied)),
      }))
      .find(plan => plan.final);
    entity.pushIntermediate = pushPlan?.intermediate ?? entity.originalPosition;
    entity.pushedPosition = pushPlan?.final ?? entity.clearedPosition;
  }

  const villainGroups = new Map<string, RuntimePresentedEntity[]>();
  for (const entity of all.filter(candidate => candidate.kind === 'VILLAIN' || candidate.kind === 'GUARD')) {
    const group = villainGroups.get(entity.zoneId) ?? [];
    group.push(entity);
    villainGroups.set(entity.zoneId, group);
  }
  for (const group of villainGroups.values()) {
    group.sort((left, right) => left.originalPosition.x - right.originalPosition.x);
    const first = group[0];
    const map = maps[first.floor - 1];
    const footprint = footprintFor(first.kind);
    const stairs = map?.layers.find(layer => layer.name === 'FloorTransitions')?.objects?.length ?? 2;
    const normal = normalFor(first.incomingDirection);
    const occupied = all.filter(entity => !group.includes(entity))
      .map(entity => ({ point: entity.originalPosition, footprint: footprintFor(entity.kind) }));
    const pairCandidates: RuntimePoint[][] = [];
    if (group.length === 2 && stairs <= 1) {
      const forward = Math.abs(first.incomingDirection.x) >= Math.abs(first.incomingDirection.y)
        ? { x: Math.sign(first.incomingDirection.x), y: 0 }
        : { x: 0, y: Math.sign(first.incomingDirection.y) };
      const passNormal = normalFor(forward);
      const desired = [
        add(add(group[0].originalPosition, passNormal, -32), forward, 32),
        add(add(group[1].originalPosition, passNormal, 32), forward, -32),
      ];
      const sides = desired.map(point => Math.sign((point.x - first.routePosition.x) * normal.x + (point.y - first.routePosition.y) * normal.y) || 1);
      for (const correction of [0, 8, 16, 24, 32]) pairCandidates.push(desired.map((point, index) => add(point, normal, correction * sides[index])));
    } else if (group.length === 2 && first.floor === 3) {
      for (const correction of [0, 8, 16, 24, 32]) pairCandidates.push([
        { x: group[0].originalPosition.x - correction, y: group[0].originalPosition.y + 32 },
        { x: group[1].originalPosition.x + correction, y: group[1].originalPosition.y - 32 },
      ]);
    } else {
      for (const side of [1, -1]) pairCandidates.push(group.map(entity => add(entity.originalPosition, normal, 48 * side)));
    }
    const candidates = pairCandidates.find(points => points.every((point, index) =>
      !routeOverlap(point, group[index].routePosition, group[index].incomingDirection, footprint)
      && validPosition(map, point, footprint, [...occupied, ...points.filter((_other, otherIndex) => otherIndex !== index).map(other => ({ point: other, footprint }))])));
    if (candidates) {
      group.forEach((entity, index) => {
        entity.forcePassPosition = candidates[index];
        entity.clearedPosition = candidates[index];
      });
    }
  }
  return { entities, openDoors: [], securityLockOpen: false };
}

export function presentationMotionForCommand(
  state: RuntimePresentationState,
  command: RuntimeCommand,
): RuntimePresentationMotion | undefined {
  if (command.type !== 'STATE_CHANGE') return undefined;
  const matching = Object.values(state.entities).filter(entity => entity.zoneId === command.location);
  if (command.change === 'OBSTACLE_PUSHED') {
    const entity = matching[0];
    const via = entity?.pushIntermediate;
    return {
      kind: 'PUSH',
      direction: entity?.incomingDirection,
      robotCoupled: true,
      robotStaging: entity?.stagingPosition,
      robotContact: entity?.contactPosition,
      robotApproach: entity?.approachPoints,
      robotPushTo: entity && via ? {
        x: entity.contactPosition.x + via.x - entity.position.x,
        y: entity.contactPosition.y + via.y - entity.position.y,
      } : undefined,
      entities: matching.map(candidate => ({ id: candidate.id, from: candidate.position, via: candidate.pushIntermediate, to: candidate.pushedPosition })),
    };
  }
  if (command.change === 'OBSTACLE_CLEARED' || command.change === 'OBSTACLE_SHIFTED' || command.change === 'OBSTACLE_BYPASSED') return {
    kind: 'CLEAR',
    entities: matching.map(entity => ({ id: entity.id, from: entity.position, to: entity.clearedPosition })),
  };
  if (command.change === 'VILLAIN_FORCE_PASSED') return {
    kind: 'FORCE_PASS',
    entities: matching.map(entity => ({ id: entity.id, from: entity.position, to: entity.forcePassPosition })),
  };
  return undefined;
}

export function applyRuntimePresentationCommand(
  state: RuntimePresentationState,
  command: RuntimeCommand,
): RuntimePresentationState {
  if (command.type !== 'STATE_CHANGE') return state;
  const entities = Object.fromEntries(Object.entries(state.entities).map(([id, entity]) => [id, { ...entity }]));
  const next: RuntimePresentationState = {
    entities,
    openDoors: [...state.openDoors],
    securityLockOpen: state.securityLockOpen,
  };
  const matching = Object.values(entities).filter(entity => entity.zoneId === command.location);

  if (command.change === 'OBSTACLE_ACTIVE' || command.change === 'OBSTACLE_BLOCKED') {
    for (const entity of matching) {
      entity.position = entity.originalPosition;
      entity.blocking = true;
      entity.visualState = 'NORMAL';
    }
  }
  if (command.change === 'OBSTACLE_CLEARED' || command.change === 'OBSTACLE_SHIFTED' || command.change === 'OBSTACLE_BYPASSED') {
    for (const entity of matching) {
      entity.position = entity.clearedPosition;
      entity.blocking = false;
      entity.visualState = 'CLEARED';
    }
  }
  if (command.change === 'OBSTACLE_PUSHED') {
    for (const entity of matching) {
      entity.position = entity.pushedPosition;
      entity.blocking = false;
      entity.visualState = 'CLEARED';
    }
  }
  if (command.change === 'VILLAIN_FORCE_PASSED') {
    for (const entity of matching) entity.position = entity.forcePassPosition;
  }
  if (command.change === 'VILLAIN_NEUTRALIZED') {
    for (const entity of matching) {
      entity.position = entity.clearedPosition;
      entity.visualState = 'NEUTRALIZED';
      entity.blocking = false;
    }
  }
  if (command.change === 'BOSS_FOUND') {
    for (const entity of Object.values(entities).filter(entity => entity.kind === 'BOSS')) entity.visible = true;
  }
  if (command.change === 'BOSS_NEUTRALIZED') {
    for (const entity of Object.values(entities).filter(entity => entity.kind === 'BOSS')) {
      entity.visible = true;
      entity.position = entity.clearedPosition;
      entity.visualState = 'NEUTRALIZED';
    }
  }
  if (command.change === 'F5_DOOR_OPEN' && command.room && !next.openDoors.includes(command.room)) next.openDoors.push(command.room);
  if (command.change === 'SECURITY_LOCK_OPEN') next.securityLockOpen = true;
  return next;
}

export const entitiesForFloor = (state: RuntimePresentationState, floor: number) =>
  Object.values(state.entities).filter(entity => entity.floor === floor && entity.visible);
