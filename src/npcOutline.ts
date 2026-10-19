import type { CharacterLabel } from './characterPool.ts';

export const NPC_OUTLINE_COLORS = Object.freeze({
  citizen: 0x26c6da,
  villain: 0xef5350,
  pending: 0xffd600,
  disagreement: 0xffa726,
  review: 0xab47bc,
});

export type NpcOutlineStyle = Readonly<{ color: number; pulse: boolean }>;

type NpcOutlineState = Readonly<{
  round: 1 | 2;
  monitoring: boolean;
  comparisonTarget: boolean;
  monitoringTarget: boolean;
  userLabel: CharacterLabel | null;
  aiLabel: CharacterLabel | null;
  verifiedLabel: CharacterLabel | null;
}>;

const labelStyle = (label: CharacterLabel | null): NpcOutlineStyle | null => label ? {
  color: label === 'VILLAIN' ? NPC_OUTLINE_COLORS.villain : NPC_OUTLINE_COLORS.citizen,
  pulse: false,
} : null;

export function npcOutlineStyle(state: NpcOutlineState): NpcOutlineStyle | null {
  if (state.round === 1) return labelStyle(state.userLabel);

  if (state.monitoring) {
    if (state.monitoringTarget && state.verifiedLabel === null) {
      return { color: NPC_OUTLINE_COLORS.review, pulse: true };
    }
    return labelStyle(state.verifiedLabel ?? state.aiLabel);
  }

  if (!state.comparisonTarget) return null;
  if (state.aiLabel === null) {
    return state.userLabel ? labelStyle(state.userLabel) : { color: NPC_OUTLINE_COLORS.pending, pulse: false };
  }
  if (state.userLabel !== null && state.userLabel !== state.aiLabel) {
    return { color: NPC_OUTLINE_COLORS.disagreement, pulse: false };
  }
  return labelStyle(state.userLabel ?? state.aiLabel);
}
