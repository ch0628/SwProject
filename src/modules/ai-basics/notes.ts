export type Note = Readonly<{
  id: string;
  title: string;
  body: string;
  type: 'AI' | 'MACHINE';
  floor: 0 | 1 | 2;
  x: number;
}>;

// Order follows the route: 1F right, 2F left, 3F right.
export const NOTES: readonly Note[] = [
  { id: 'ai-learn-data', title: '데이터를 학습해요', body: 'AI는 사람이 하나하나 규칙을 알려주지 않아도, 많은 데이터를 보면서 필요한 정보를 배울 수 있어요.', type: 'AI', floor: 0, x: 360 },
  { id: 'machine-same-input', title: '같은 설정이면 같은 결과만 내요', body: '기계는 미리 정해 둔 설정이나 입력이 같으면, 보통 늘 같은 방식으로 작동해요.', type: 'MACHINE', floor: 0, x: 1030 },
  { id: 'ai-pattern', title: '패턴을 찾아요', body: 'AI는 여러 데이터를 살펴보면서 반복해서 나타나는 공통점이나 규칙을 찾아낼 수 있어요.', type: 'AI', floor: 1, x: 1100 },
  { id: 'machine-signal', title: '뜻을 이해하지 않고 신호에 반응해요', body: '기계는 들어온 신호나 명령에 반응할 수는 있지만, 말이나 상황의 뜻을 스스로 이해하는 것은 아니에요.', type: 'MACHINE', floor: 1, x: 520 },
  { id: 'machine-no-learning', title: '스스로 구별하지 못해요', body: '기계는 여러 예시를 보고 공통점을 찾아 스스로 기준을 배우는 것이 아니라, 정해진 방식대로만 작동해요.', type: 'MACHINE', floor: 2, x: 490 },
  { id: 'ai-judge', title: '스스로 판단해요', body: '학습한 내용을 바탕으로 새로운 상황을 살펴보고, 알맞은 답이나 행동을 판단할 수 있어요.', type: 'AI', floor: 2, x: 980 },
];

export const INTERACTION_RANGE = 70;

export function nearbyNote(x: number, floor: number, collected: ReadonlySet<string>): Note | undefined {
  return NOTES.find(note => note.floor === floor && !collected.has(note.id) && Math.abs(x - note.x) <= INTERACTION_RANGE);
}
