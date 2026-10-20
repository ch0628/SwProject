import type { SemanticBehavior } from './characterPool.ts';
import type { RoundNpcPhase } from './plazaRound1.ts';

export const ACTION_BUBBLE_TEXTURES = Object.freeze({
  STEALING: 'action-icon-stealing',
  SNATCHING: 'action-icon-snatching',
  THREATENING: 'action-icon-threatening',
  MANHOLE_TAMPER: 'action-icon-manhole-tamper',
} satisfies Partial<Record<SemanticBehavior, string>>);

export function actionBubbleTextureKey(phase: RoundNpcPhase, mainBehavior: SemanticBehavior): string | null {
  return phase === 'HOLDING' ? ACTION_BUBBLE_TEXTURES[mainBehavior as keyof typeof ACTION_BUBBLE_TEXTURES] ?? null : null;
}
