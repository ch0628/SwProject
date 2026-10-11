// 비지도학습 대사 (PRD v1.0.0 §2.2.3 본문 기준)
// source: PRD = 본문 그대로 / PRD_MODIFIED = 사용자 승인으로 문구 수정 / ADDED = PRD에 없어 결정 사항에 따라 추가
// PRD 원문(prd/ 폴더)은 수정하지 않는다. 수정 내역은 ai/tasks/claude_unsupervised_technical_design.md E2 참고.
import type { FlowStep } from '../sim/sceneFlow.ts';

export type Speaker = '아리' | 'AI 보안관';

export type DialogueLine = Readonly<{
  speaker: Speaker;
  text: string;
  /** 빨간색으로 강조할 핵심 단서 문구 */
  highlights?: readonly string[];
  source: 'PRD' | 'PRD_MODIFIED' | 'ADDED';
}>;

const line = (speaker: Speaker, text: string, source: DialogueLine['source'] = 'PRD', highlights?: readonly string[]): DialogueLine =>
  Object.freeze({ speaker, text, source, ...(highlights ? { highlights: Object.freeze([...highlights]) } : {}) });

export const DIALOGUE: Readonly<Record<FlowStep, readonly DialogueLine[]>> = Object.freeze({
  INCIDENT: [
    line('아리', '큰일이에요! 어젯밤 마을 창고에 누군가 몰래 들어왔어요.'),
    line('아리', '현장에는 고기를 먹은 흔적이 남아 있었고, 경비병은 수상한 그림자가 밤늦게 움직이는 모습을 목격했어요.', 'PRD', ['고기를 먹은 흔적', '밤늦게 움직이는 모습']),
    line('아리', '하지만 아직 누가 범인인지는 알 수 없어요!'),
  ],
  EXPLAIN: [
    line('아리', '누가 악당인지 미리 알려주는 정답표는 없어요.'),
    line('아리', '대신 AI는 주민들의 여러 특징을 살펴보고, 서로 비슷한 주민끼리 모을 수 있어요.'),
    line('아리', '어떤 특징을 살펴볼지 먼저 골라볼까요?'),
  ],
  FEATURE_SELECT: [
    line('아리', 'AI가 주민들을 비교할 특징 2개를 선택해 주세요.'),
  ],
  PATTERN_FIND: [
    line('아리', '주민의 특징을 확인한 뒤 [패턴 찾기]를 눌러보세요. AI가 선택한 특징을 보고 주민을 알맞은 위치로 이동시켜요. 비슷한 특징을 가진 주민들은 자연스럽게 가까운 곳에 모이게 돼요!', 'PRD_MODIFIED'),
  ],
  CLUSTER_REVIEW: [
    line('아리', '모든 주민의 분류가 끝났어요! 비슷한 특징을 가진 주민들이 서로 가까운 곳에 모였네요.'),
  ],
  FEATURE_FEEDBACK: [
    line('AI 보안관', '주민들이 비슷한 특징끼리 잘 모였어요. 그런데 이 특징들로 사건 단서와 비교할 수 있을까요?'),
  ],
  CLUE_COMPARE: [
    line('아리', '처음에 발견한 사건 단서를 기억하나요? 단서와 가장 비슷한 특징을 가진 무리를 찾아보세요. 어떤 무리가 범인일까요?'),
  ],
  ORDINARY_RESULT: [
    line('AI 보안관', '조사해 보니 이 무리는 평범한 주민들이었어요.', 'ADDED'),
    line('AI 보안관', '사건 단서와 다시 비교해서 다른 무리를 골라 볼까요?', 'ADDED'),
  ],
  INVESTIGATE: [
    line('AI 보안관', '사건 단서와 가장 비슷한 무리를 조사했더니, 수상한 무리를 찾았어요! 이 중에 범인이 있을 거예요', 'PRD_MODIFIED'),
    line('AI 보안관', 'AI는 누가 악당인지 알고 있었던 게 아니라, 비슷한 특징을 가진 주민들을 먼저 모아 준 거예요.'),
  ],
  COMPLETE: [
    line('아리', '방금 AI가 어떻게 주민들을 모았는지 기억하나요?'),
    line('아리', '누가 악당인지 정답을 미리 알려주지 않았는데도, AI는 주민들의 특징을 비교해서 비슷한 주민끼리 스스로 모았어요. 이처럼 정답 없이 데이터의 특징을 보고 비슷한 것끼리 묶는 방법을 \'비지도학습\'이라고 해요!'),
  ],
});
