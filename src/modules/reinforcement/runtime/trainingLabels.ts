import type { ActionExperience, RewardStars, TerminalReason } from '../sim/learningEngine.ts';
import type { ActualEpisode } from '../sim/actualMapSimulation.ts';
import type { RuntimeCommand } from './runtimeCommands.ts';

const LABELS: Record<string, string> = {
  READY: '준비 중',
  MOVING: '이동 중',
  GOAL_REACHED: '임무 성공',
  MISUNDERSTANDING: '상황을 잘못 판단함',
  TIMEOUT: '시간 초과',
  ROBOT_DISABLED: '작동 불능',
  ROUTE_CHOICE: '이동 경로',
  OBSTACLE: '장애물',
  CITIZEN_NEARBY: '시민',
  AMBIGUOUS_PERSON: '호랑이',
  VILLAIN_ENCOUNTER: '악당',
  BOSS_ENCOUNTER: '보스',
  DETOUR: '돌아가기',
  CLEAR: '치우기',
  PUSH: '밀기',
  WIDE_DETOUR: '멀리 돌아가기',
  SLOW_PASS: '천천히 지나가기',
  WAIT: '기다리기',
  FAST_PASS: '빠르게 지나가기',
  OBSERVE: '자세히 살펴보기',
  BYPASS: '피해서 지나가기',
  TRACK: '계속 지켜보기',
  SUBDUE: '제압하기',
  FORCE_PASS: '강제로 돌파하기',
  DISTRACT: '주의 돌리기',
  RETREAT: '물러나기',
  FAST_SHORTCUT: '빠른 지름길',
  SAFE_CORRIDOR: '안전한 복도',
  NORMAL_STAIRS: '일반 계단',
  ELEVATOR: '엘리베이터',
  OBSTACLE_ACTIVE: '장애물 발견',
  OBSTACLE_CLEARED: '장애물을 치웠어요',
  OBSTACLE_PUSHED: '장애물을 밀었어요',
  OBSTACLE_SHIFTED: '장애물이 움직였어요',
  OBSTACLE_BYPASSED: '장애물을 돌아갔어요',
  OBSTACLE_BLOCKED: '장애물에 막혔어요',
  VILLAIN_NEUTRALIZED: '악당을 제압했어요',
  VILLAIN_FORCE_PASSED: '악당을 지나갔어요',
  VILLAIN_DISTRACTED: '악당의 주의를 돌렸어요',
  BOSS_FOUND: '보스를 발견했어요',
  BOSS_NEUTRALIZED: '보스를 제압했어요',
  SECURITY_LOCK_OPEN: '보안문이 열렸어요',
  SYSTEM_RESTORED: '제어실 전원을 복구했어요',
  FACILITY_DAMAGE: '시설이 손상되었어요',
  CITIZEN_RISK: '시민이 위험해졌어요',
  BLOCKED: '길이 막혔어요',
  MOBILITY_DAMAGE: '이동 장치가 손상되었어요',
  PASS: '지나갔어요',
  CLEAN_PASS: '안전하게 지나갔어요',
  SAFE_PASS: '안전하게 돌아갔어요',
  SAFE_BYPASS: '안전하게 피했어요',
  BOSS_DISTRACTED: '보스의 주의를 돌렸어요',
};

export const REWARD_LABELS = {
  speed: '빠르게 해결하기',
  judgment: '정확하게 판단하기',
  threat: '위협 제거하기',
} as const;

export const WEIGHT_LEVEL_LABELS = ['중요하지 않아요', '조금 중요해요', '중요해요', '아주 중요해요'] as const;

export const rewardAdvice = (weights: RewardStars): string => {
  const values = Object.values(weights);
  const highest = Math.max(...values);
  if (weights.speed === highest && weights.speed >= 2) return '빠르게 해결하는 걸 중요하게 생각했구나! 로봇이 더 빠른 방법을 찾으려고 할 수 있어.';
  if (weights.judgment === highest && weights.judgment >= 2) return '정확한 판단을 중요하게 생각했구나! 로봇이 바로 행동하기 전에 더 확인하려고 할 수 있어.';
  if (weights.threat === highest && weights.threat >= 2) return '위협 제거를 중요하게 생각했구나! 로봇이 악당을 실제로 제압하는 경험을 더 쌓을 수 있어.';
  return '좋아! 네가 고른 중요도를 보고 로봇이 어떤 행동을 할지 정해 볼 거야.';
};

export const trainingLabel = (value?: string): string => {
  if (!value) return '진행 중';
  if (value.startsWith('ACTUAL_ROUTE:')) return '다음 경로 고르기';
  if (value.startsWith('FLOOR_TRANSITION')) return '다음 층으로 이동 중';
  return LABELS[value] ?? '진행 중';
};

export const terminalReasonSentence = (reason: TerminalReason): string => ({
  GOAL_REACHED: '임무를 멋지게 완수했어!',
  MISUNDERSTANDING: '상황을 잘못 판단해서 임무를 계속할 수 없었어.',
  TIMEOUT: '시간 안에 임무를 끝내지 못했어.',
  ROBOT_DISABLED: '로봇이 작동 불능이 되었어.',
})[reason];

const objectForm = (word: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return `${word}${code >= 0 && code <= 11171 && code % 28 ? '을' : '를'}`;
};

export const meaningfulEventMessage = (robotId: number, command: RuntimeCommand): string | undefined => {
  const robot = `로봇 ${robotId}가`;
  if (command.type === 'ENCOUNTER' && command.phase === 'START') {
    const object = trainingLabel(command.encounter);
    return command.encounter === 'OBSTACLE'
      ? `${robot} 장애물을 발견했어요`
      : `${robot} ${objectForm(object)} 만났어요`;
  }
  if (command.type === 'STATE_CHANGE') {
    if (['NO_BOSS', 'F5_DOOR_OPEN'].includes(command.change)) return undefined;
    const label = LABELS[command.change];
    return label ? `${robot} ${label}` : undefined;
  }
  if (command.type === 'TERMINAL') {
    if (command.reason === 'GOAL_REACHED') return `${robot} 임무를 완료했어요`;
    if (command.reason === 'ROBOT_DISABLED') return `${robot} 작동 불능이 되었어요`;
    if (command.reason === 'TIMEOUT') return `${robot} 시간 안에 임무를 끝내지 못했어요`;
    return `${robot} 상황을 잘못 판단했어요`;
  }
  return undefined;
};

export const importantActionMessage = (command?: RuntimeCommand): string => {
  if (!command) return '출발을 준비하고 있어요.';
  if (command.type === 'MOVE') return `${command.floor}층에서 이동하고 있어요!`;
  if (command.type === 'FLOOR_TRANSITION') return `${command.targetFloor}층으로 이동하고 있어요!`;
  if (command.type === 'ENCOUNTER') {
    if (command.phase === 'END') return '다시 임무를 계속하고 있어요!';
    return command.encounter === 'OBSTACLE' ? '장애물을 발견했어요!'
      : command.encounter === 'CITIZEN_NEARBY' ? '시민을 확인하고 있어요!'
        : command.encounter === 'AMBIGUOUS_PERSON' ? '호랑이를 자세히 살펴보고 있어요!'
          : command.encounter === 'BOSS_ENCOUNTER' ? '보스를 만나고 있어요!'
            : '악당을 만나고 있어요!';
  }
  if (command.type === 'ACTION') return `${trainingLabel(command.action)} 행동을 하고 있어요!`;
  if (command.type === 'OUTCOME') return trainingLabel(command.outcome);
  if (command.type === 'STATE_CHANGE') return trainingLabel(command.change);
  if (command.type === 'LOCAL_RETREAT') return '잠시 물러난 뒤 다시 판단하고 있어요!';
  if (command.type === 'LOCAL_BYPASS') return '대상을 피해 안전하게 지나가고 있어요!';
  return command.reason === 'GOAL_REACHED' ? '임무를 성공했어요!' : terminalReasonSentence(command.reason);
};

const lastMeaningfulAction = (episode: ActualEpisode): ActionExperience | undefined => {
  for (let index = episode.actionHistory.length - 1; index >= 0; index--) {
    if (episode.actionHistory[index].state !== 'ROUTE_CHOICE') return episode.actionHistory[index];
  }
  return undefined;
};

export const failureReview = (episode: ActualEpisode) => {
  const action = lastMeaningfulAction(episode);
  const floor = episode.actual.reachedFloors.at(-1) ?? 1;
  const encounter = action ? trainingLabel(action.state) : undefined;
  const actionLabel = action ? trainingLabel(action.action) : undefined;
  const encounterText = action?.state === 'OBSTACLE'
    ? '장애물을 발견하고'
    : action ? `${objectForm(encounter!)} 만나` : undefined;
  const lead = action
    ? `로봇 ${episode.robot}은 ${floor}층에서 ${encounterText}\n${actionLabel} 행동을 골랐어.`
    : `로봇 ${episode.robot}은 ${floor}층에서 어려움을 겪었어.`;
  return {
    floor,
    action: actionLabel,
    result: trainingLabel(episode.terminalReason),
    text: `${lead}\n\n하지만 ${terminalReasonSentence(episode.terminalReason)}`,
  };
};
