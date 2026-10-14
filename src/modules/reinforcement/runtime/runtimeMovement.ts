import { RUNTIME_CHARACTER_SCALE } from './runtimeVisualConfig.ts';
import {
  RUNTIME_CONTACT_FOOTPRINTS,
  type RuntimeFootprint,
  type RuntimePoint,
} from './runtimeCommands.ts';

export type RuntimeMovementKind = 'ROBOT' | 'OBSTACLE' | 'CITIZEN' | 'AMBIGUOUS' | 'VILLAIN' | 'GUARD' | 'BOSS';
export type RuntimeRect = { x: number; y: number; width: number; height: number };
export type RuntimeMovementBlocker = { id: string; point: RuntimePoint; footprint: RuntimeFootprint };
export type RuntimeRouteCursor = {
  edgeId?: string;
  segment: number;
  progress: number;
  worldPosition: RuntimePoint;
};

const scaled = (footprint: RuntimeFootprint, scale: number): RuntimeFootprint => ({
  width: footprint.width * scale,
  height: footprint.height * scale,
});

export const runtimeVisualFootprint = (kind: RuntimeMovementKind): RuntimeFootprint => {
  if (kind === 'ROBOT') return scaled(RUNTIME_CONTACT_FOOTPRINTS.ROBOT, RUNTIME_CHARACTER_SCALE.ROBOT);
  if (kind === 'OBSTACLE') return RUNTIME_CONTACT_FOOTPRINTS.OBSTACLE;
  if (kind === 'CITIZEN') return scaled(RUNTIME_CONTACT_FOOTPRINTS.CITIZEN_NEARBY, RUNTIME_CHARACTER_SCALE.CITIZEN);
  if (kind === 'AMBIGUOUS') return scaled(RUNTIME_CONTACT_FOOTPRINTS.AMBIGUOUS_PERSON, RUNTIME_CHARACTER_SCALE.AMBIGUOUS);
  if (kind === 'BOSS') return scaled(RUNTIME_CONTACT_FOOTPRINTS.BOSS_ENCOUNTER, RUNTIME_CHARACTER_SCALE.BOSS);
  return scaled(RUNTIME_CONTACT_FOOTPRINTS.VILLAIN_ENCOUNTER, RUNTIME_CHARACTER_SCALE.VILLAIN);
};

const routeMetrics = (points: readonly RuntimePoint[]) => {
  const cumulative = [0];
  for (let index = 1; index < points.length; index++) {
    cumulative.push(cumulative[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  }
  return cumulative;
};

const pointAtProgress = (points: readonly RuntimePoint[], cumulative: readonly number[], progress: number): RuntimePoint => {
  if (progress <= 0) return { ...points[0] };
  if (progress >= cumulative.at(-1)!) return { ...points.at(-1)! };
  const segment = cumulative.findIndex(value => value >= progress);
  const from = points[segment - 1];
  const to = points[segment];
  const ratio = (progress - cumulative[segment - 1]) / (cumulative[segment] - cumulative[segment - 1]);
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
};

export const projectRouteProgress = (
  points: readonly RuntimePoint[],
  point: RuntimePoint,
  minimumProgress = 0,
) => {
  const cumulative = routeMetrics(points);
  let best = { segment: 1, progress: Math.min(minimumProgress, cumulative.at(-1) ?? 0), error: Number.POSITIVE_INFINITY };
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    const segmentLength = Math.sqrt(lengthSquared);
    const rawRatio = lengthSquared ? ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared : 0;
    const minimumRatio = segmentLength ? Math.max(0, (minimumProgress - cumulative[index - 1]) / segmentLength) : 0;
    const ratio = Math.max(minimumRatio, Math.min(1, rawRatio));
    if (ratio > 1) continue;
    const projected = { x: from.x + dx * ratio, y: from.y + dy * ratio };
    const error = Math.hypot(projected.x - point.x, projected.y - point.y);
    if (error < best.error) best = { segment: index, progress: cumulative[index - 1] + segmentLength * ratio, error };
  }
  return { ...best, total: cumulative.at(-1) ?? 0 };
};

export function forwardRejoinPolyline(
  points: readonly RuntimePoint[],
  current: RuntimePoint,
  minimumProgress = 0,
): { points: RuntimePoint[]; routeProgress: number; segment: number; total: number } {
  if (points.length < 2) return { points: [{ ...current }], routeProgress: 0, segment: 0, total: 0 };
  const cumulative = routeMetrics(points);
  const projection = projectRouteProgress(points, current, minimumProgress);
  const rejoinProgress = projection.error > 1
    ? Math.min(projection.total, projection.progress + Math.min(32, projection.total - projection.progress))
    : projection.progress;
  const rejoin = pointAtProgress(points, cumulative, rejoinProgress);
  const result = [{ ...current }];
  if (Math.hypot(rejoin.x - current.x, rejoin.y - current.y) > 1) result.push(rejoin);
  for (let index = 1; index < points.length; index++) {
    if (cumulative[index] <= rejoinProgress + 0.001) continue;
    const point = points[index];
    if (Math.hypot(point.x - result.at(-1)!.x, point.y - result.at(-1)!.y) > 0.001) result.push({ ...point });
  }
  return { points: result, routeProgress: rejoinProgress, segment: projection.segment, total: projection.total };
}

const rectAt = (point: RuntimePoint, footprint: RuntimeFootprint): RuntimeRect => ({
  x: point.x - footprint.width / 2,
  y: point.y - footprint.height / 2,
  width: footprint.width,
  height: footprint.height,
});

const overlaps = (left: RuntimeRect, right: RuntimeRect) => left.x < right.x + right.width
  && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;

const projectedHalfExtent = (footprint: RuntimeFootprint, direction: RuntimePoint) =>
  Math.abs(direction.x) * footprint.width / 2 + Math.abs(direction.y) * footprint.height / 2;

const pointIsClear = (
  point: RuntimePoint,
  footprint: RuntimeFootprint,
  bounds: RuntimeRect,
  walls: readonly RuntimeRect[],
  blockers: readonly RuntimeMovementBlocker[],
) => {
  const rect = rectAt(point, footprint);
  if (rect.x < bounds.x || rect.y < bounds.y || rect.x + rect.width > bounds.x + bounds.width || rect.y + rect.height > bounds.y + bounds.height) return false;
  return !walls.some(wall => overlaps(rect, wall)) && !blockers.some(blocker => overlaps(rect, rectAt(blocker.point, blocker.footprint)));
};

export const movementPathIsClear = (
  points: readonly RuntimePoint[],
  footprint: RuntimeFootprint,
  bounds: RuntimeRect,
  walls: readonly RuntimeRect[],
  blockers: readonly RuntimeMovementBlocker[] = [],
) => points.slice(1).every((target, index) => {
  const from = points[index];
  const length = Math.hypot(target.x - from.x, target.y - from.y);
  const steps = Math.max(1, Math.ceil(length / 4));
  return Array.from({ length: steps }, (_, step) => ({
    x: from.x + (target.x - from.x) * (step + 1) / steps,
    y: from.y + (target.y - from.y) * (step + 1) / steps,
  })).every(point => pointIsClear(point, footprint, bounds, walls, blockers));
});

export function planDistractMovement(
  center: RuntimePoint,
  bounds: RuntimeRect,
  walls: readonly RuntimeRect[],
  blockers: readonly RuntimeMovementBlocker[] = [],
) {
  const footprint = runtimeVisualFootprint('ROBOT');
  for (const distance of [16, 12, 8, 4]) {
    const points = [
      { ...center },
      { x: center.x - distance, y: center.y },
      { x: center.x + distance, y: center.y },
      { ...center },
    ];
    if (movementPathIsClear(points, footprint, bounds, walls, blockers)) return { center: { ...center }, distance, points };
  }
  for (const side of [-1, 1]) {
    for (const distance of [16, 12, 8, 4]) {
      const points = [{ ...center }, { x: center.x + distance * side, y: center.y }, { ...center }];
      if (movementPathIsClear(points, footprint, bounds, walls, blockers)) return { center: { ...center }, distance, points };
    }
  }
  return { center: { ...center }, distance: 0, points: [{ ...center }] };
}

const detourForSegment = (
  from: RuntimePoint,
  to: RuntimePoint,
  footprint: RuntimeFootprint,
  bounds: RuntimeRect,
  walls: readonly RuntimeRect[],
  blockers: readonly RuntimeMovementBlocker[],
) => {
  if (movementPathIsClear([from, to], footprint, bounds, walls, blockers)) return [to];
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < 1) return [to];
  const tangent = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const normal = { x: -tangent.y, y: tangent.x };
  const blocker = blockers.map(candidate => ({
    candidate,
    progress: Math.max(0, Math.min(length, (candidate.point.x - from.x) * tangent.x + (candidate.point.y - from.y) * tangent.y)),
  })).filter(({ candidate }) => !movementPathIsClear([from, to], footprint, bounds, [], [candidate]))
    .sort((left, right) => left.progress - right.progress)[0];
  if (!blocker) return [to];
  const candidates = [1, -1].flatMap(side => [8, 16, 24].map(extra => {
    const alongClearance = projectedHalfExtent(footprint, tangent)
      + projectedHalfExtent(blocker.candidate.footprint, tangent) + 8;
    const lateral = projectedHalfExtent(footprint, normal)
      + projectedHalfExtent(blocker.candidate.footprint, normal) + extra;
    const beforeProgress = Math.max(0, blocker.progress - alongClearance);
    const afterProgress = Math.min(length, blocker.progress + alongClearance);
    const before = { x: from.x + tangent.x * beforeProgress, y: from.y + tangent.y * beforeProgress };
    const after = { x: from.x + tangent.x * afterProgress, y: from.y + tangent.y * afterProgress };
    return [
      before,
      { x: before.x + normal.x * lateral * side, y: before.y + normal.y * lateral * side },
      { x: after.x + normal.x * lateral * side, y: after.y + normal.y * lateral * side },
      after,
      to,
    ].filter((point, index, points) => index === 0 || Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) > 0.001);
  })).filter(candidate => movementPathIsClear([from, ...candidate], footprint, bounds, walls, blockers));
  return candidates.sort((left, right) => {
    const distance = (points: RuntimePoint[]) => {
      const path = [from, ...points];
      return path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - path[index].x, point.y - path[index].y), 0);
    };
    return distance(left) - distance(right);
  })[0] ?? [to];
};

export function planLocalMovement(
  route: readonly RuntimePoint[],
  current: RuntimePoint,
  bounds: RuntimeRect,
  walls: readonly RuntimeRect[],
  blockers: readonly RuntimeMovementBlocker[],
  minimumProgress = 0,
) {
  const rejoin = forwardRejoinPolyline(route, current, minimumProgress);
  const footprint = runtimeVisualFootprint('ROBOT');
  const points = [rejoin.points[0]];
  for (const target of rejoin.points.slice(1)) points.push(...detourForSegment(points.at(-1)!, target, footprint, bounds, walls, blockers));
  return { ...rejoin, points };
}
