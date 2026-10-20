import type { BehaviorHistoryEntry, SemanticBehavior } from './characterPool';

const SUSPICIOUS_BEHAVIORS = new Set<SemanticBehavior>([
  'STEALING', 'SNATCHING', 'THREATENING', 'MANHOLE_TAMPER',
]);

export type TrackingPeriod = 'PAST' | 'ROUND';
export type TrackingEntryKind = 'PAST_INCIDENT' | 'PAST_RECORD' | 'SUSPICIOUS' | 'ROUTINE';

export const trackingPeriod = (entry: BehaviorHistoryEntry): TrackingPeriod =>
  entry.simulationTime < 0 || entry.location === 'OFFSCREEN' ? 'PAST' : 'ROUND';

export const isSuspiciousTrackingBehavior = (behavior: SemanticBehavior) =>
  SUSPICIOUS_BEHAVIORS.has(behavior);

export function trackingEntryKind(entry: BehaviorHistoryEntry): TrackingEntryKind {
  const suspicious = isSuspiciousTrackingBehavior(entry.behavior.semantic);
  return trackingPeriod(entry) === 'PAST'
    ? suspicious ? 'PAST_INCIDENT' : 'PAST_RECORD'
    : suspicious ? 'SUSPICIOUS' : 'ROUTINE';
}
