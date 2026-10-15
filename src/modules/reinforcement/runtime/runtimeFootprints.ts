import { RUNTIME_CHARACTER_SCALE } from './runtimeVisualConfig.ts';

export type RuntimeFootprint = { width: number; height: number };
export type RuntimeMovementKind = 'ROBOT' | 'OBSTACLE' | 'CITIZEN' | 'AMBIGUOUS' | 'VILLAIN' | 'GUARD' | 'BOSS';

export const RUNTIME_CONTACT_FOOTPRINTS = {
  ROBOT: { width: 20, height: 12 },
  OBSTACLE: { width: 48, height: 24 },
  CITIZEN_NEARBY: { width: 24, height: 16 },
  AMBIGUOUS_PERSON: { width: 26, height: 18 },
  VILLAIN_ENCOUNTER: { width: 28, height: 18 },
  BOSS_ENCOUNTER: { width: 34, height: 22 },
} as const satisfies Record<'ROBOT' | 'OBSTACLE' | 'CITIZEN_NEARBY' | 'AMBIGUOUS_PERSON' | 'VILLAIN_ENCOUNTER' | 'BOSS_ENCOUNTER', RuntimeFootprint>;

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
