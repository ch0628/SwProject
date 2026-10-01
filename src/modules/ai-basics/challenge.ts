export const AI_CARD_IDS = ['ai-learn-data', 'ai-pattern', 'ai-judge'] as const;

export function quizResult(hearts: number, correct: boolean) {
  const remaining = hearts - Number(!correct);
  return { hearts: remaining, failed: remaining === 0 };
}

export function cardResult(hearts: number, selected: readonly string[]) {
  if (selected.length !== 3) return { hearts, outcome: 'incomplete' as const };
  if (AI_CARD_IDS.every(id => selected.includes(id))) return { hearts, outcome: 'correct' as const };
  const remaining = hearts - 1;
  return { hearts: remaining, outcome: remaining === 0 ? 'failed' as const : 'retry' as const };
}
