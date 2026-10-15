import type { RuntimeDirection } from './runtimeCommands.ts';

export type RuntimeRobotVisualState = 'NORMAL' | 'COMBAT' | 'WORK' | 'NEUTRALIZED';

export const runtimeRobotTexture = (state: RuntimeRobotVisualState, direction: RuntimeDirection) =>
  state === 'NORMAL' ? `runtime-robot-idle-${direction}` : `runtime-robot-${state.toLowerCase()}-${direction}`;

export const runtimeRobotEncounterState = (
  phase: 'START' | 'END',
  encounter: 'OBSTACLE' | 'CITIZEN_NEARBY' | 'AMBIGUOUS_PERSON' | 'VILLAIN_ENCOUNTER' | 'BOSS_ENCOUNTER',
): RuntimeRobotVisualState => phase === 'END'
  ? 'NORMAL'
  : encounter === 'VILLAIN_ENCOUNTER' || encounter === 'BOSS_ENCOUNTER'
    ? 'COMBAT'
    : encounter === 'CITIZEN_NEARBY' ? 'WORK' : 'NORMAL';

export const RUNTIME_CHARACTER_SCALE = {
  ROBOT: 0.85,
  CITIZEN: 1.2,
  AMBIGUOUS: 1.2,
  VILLAIN: 1.2,
  BOSS: 1.2,
} as const;

export const RUNTIME_BASE_DISPLAY_HEIGHT = {
  ROBOT: 72,
  CITIZEN: 74,
  AMBIGUOUS: 80,
  VILLAIN: 82,
  BOSS: 96,
} as const;

export const RUNTIME_ENVIRONMENT_VISUAL_CONFIG = {
  searchDoor: { width: 64, height: 64 },
  secureEntrance: { tileWidth: 32, tileHeight: 64 },
} as const;

export const runtimeSearchDoorTexture = (open: boolean) => open ? 'runtime-door-open' : 'runtime-door-closed';

export function planSecureEntrance(bounds: { x: number; y: number; width: number; height: number }) {
  const { tileWidth, tileHeight } = RUNTIME_ENVIRONMENT_VISUAL_CONFIG.secureEntrance;
  const tileCount = bounds.width / tileWidth;
  if (!Number.isInteger(tileCount) || tileCount < 2) throw new Error(`Secure entrance width ${bounds.width} must fit at least two ${tileWidth}px tiles`);
  return Array.from({ length: tileCount }, (_value, index) => ({
    texture: index === 0 ? 'runtime-secure-left' : index === tileCount - 1 ? 'runtime-secure-right' : 'runtime-secure-glass',
    x: bounds.x + tileWidth * (index + 0.5),
    y: bounds.y + bounds.height,
    width: tileWidth,
    height: tileHeight,
  }));
}

export const RUNTIME_VISUAL_CONFIG = {
  animationFps: 9,
  movementPixelsPerSecond: 420,
  pushDurationMs: 380,
  clearDurationMs: 320,
  forcePassDurationMs: 280,
  distractSideDurationMs: 220,
  distractFinalDurationMs: 260,
  subdueLunge: {
    distance: 16,
    forwardMs: 140,
    impactHoldMs: 80,
    returnMs: 160,
  },
  recoveryVisualMs: 1000,
  secureEntranceOpen: {
    unlockPauseMs: 550,
    openHoldMs: 400,
  },
  corePowerOn: {
    arrivalPauseMs: 500,
    poweringMs: 850,
    poweredHoldMs: 700,
  },
  robotDisplayHeight: RUNTIME_BASE_DISPLAY_HEIGHT.ROBOT * RUNTIME_CHARACTER_SCALE.ROBOT,
  robotFootprint: { width: 20, height: 12 },
  citizenDisplayHeight: RUNTIME_BASE_DISPLAY_HEIGHT.CITIZEN * RUNTIME_CHARACTER_SCALE.CITIZEN,
  ambiguousDisplayHeight: RUNTIME_BASE_DISPLAY_HEIGHT.AMBIGUOUS * RUNTIME_CHARACTER_SCALE.AMBIGUOUS,
  villainDisplayHeight: RUNTIME_BASE_DISPLAY_HEIGHT.VILLAIN * RUNTIME_CHARACTER_SCALE.VILLAIN,
  bossDisplayHeight: RUNTIME_BASE_DISPLAY_HEIGHT.BOSS * RUNTIME_CHARACTER_SCALE.BOSS,
} as const;
