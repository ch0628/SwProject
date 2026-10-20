import type { SemanticBehavior } from './characterPool.ts';
import type { RoundNpcPhase } from './plazaRound1.ts';

export const ACTION_BUBBLE_TEXTURES = Object.freeze({
  STEALING: 'action-icon-stealing',
  SNATCHING: 'action-icon-snatching',
  THREATENING: 'action-icon-threatening',
  MANHOLE_TAMPER: 'action-icon-manhole-tamper',
} satisfies Partial<Record<SemanticBehavior, string>>);

export type ActionBubbleCharacterBounds = { x: number; y: number; width: number; height: number };
export type ActionBubbleViewBounds = { left: number; right: number; top: number; bottom: number };
export type ActionBubblePlacement = { x: number; y: number; rotation: number };

export function actionBubbleTextureKey(phase: RoundNpcPhase, mainBehavior: SemanticBehavior): string | null {
  return phase === 'HOLDING' ? ACTION_BUBBLE_TEXTURES[mainBehavior as keyof typeof ACTION_BUBBLE_TEXTURES] ?? null : null;
}

export function actionBubblePlacement(
  actor: ActionBubbleCharacterBounds,
  characters: readonly ActionBubbleCharacterBounds[],
  view: ActionBubbleViewBounds,
  groupRadius: number,
  bubbleSize: number,
  gap = 8,
): ActionBubblePlacement {
  const group = characters.filter(character => Math.hypot(character.x - actor.x, character.y - actor.y) <= groupRadius);
  const nearby = group.length ? group : [actor];
  const groupTop = Math.min(...nearby.map(character => character.y - character.height));
  const groupLeft = Math.min(...nearby.map(character => character.x - character.width / 2));
  const groupRight = Math.max(...nearby.map(character => character.x + character.width / 2));
  const half = bubbleSize / 2;
  const padding = 6;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const rawAbove = {
    x: actor.x,
    y: groupTop - gap - half,
    rotation: 0,
  };
  const actorIntersectsView = actor.x + actor.width / 2 >= view.left
    && actor.x - actor.width / 2 <= view.right
    && actor.y >= view.top
    && actor.y - actor.height <= view.bottom;
  if (!actorIntersectsView) return rawAbove;

  const above = {
    ...rawAbove,
    x: clamp(actor.x, view.left + half + padding, view.right - half - padding),
  };
  if (above.y - half >= view.top + padding) return above;

  const sideY = clamp(actor.y - actor.height / 2, view.top + half + padding, view.bottom - half - padding);
  const rightX = groupRight + gap + half;
  if (rightX + half <= view.right - padding) return { x: rightX, y: sideY, rotation: Math.PI / 2 };

  const leftX = groupLeft - gap - half;
  if (leftX - half >= view.left + padding) return { x: leftX, y: sideY, rotation: -Math.PI / 2 };

  return { ...above, y: view.top + half + padding };
}
