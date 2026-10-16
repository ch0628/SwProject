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
  AMBIGUOUS_PERSON: '모호한 사람',
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
  NO_BOSS: '여기에는 보스가 없어요',
  F5_DOOR_OPEN: '검색할 방의 문이 열렸어요',
};

const ACTION_MESSAGES: Record<string, string> = {
  SUBDUE: '악당을 제압하려고 해요!',
  DISTRACT: '악당의 주의를 다른 곳으로 돌리고 있어요!',
  RETREAT: '잠깐 물러나 다시 생각하고 있어요.',
  OBSERVE: '이 사람이 누구인지 자세히 살펴보고 있어요.',
  BYPASS: '사람을 피해 조심해서 지나가고 있어요.',
  CLEAR: '앞을 막는 물건을 치우고 있어요.',
  PUSH: '물건을 밀어서 길을 만들고 있어요.',
  FORCE_PASS: '악당을 뚫고 지나가려고 해요.',
  WAIT: '안전해질 때까지 기다리고 있어요.',
  SLOW_PASS: '사람 곁을 천천히 지나가고 있어요.',
  FAST_PASS: '빠르게 지나가고 있어요.',
  WIDE_DETOUR: '안전하게 멀리 돌아가고 있어요.',
  DETOUR: '다른 길로 돌아가고 있어요.',
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
        : command.encounter === 'AMBIGUOUS_PERSON' ? '누구인지 알 수 없는 사람을 살펴보고 있어요!'
          : command.encounter === 'BOSS_ENCOUNTER' ? '보스를 만나고 있어요!'
            : '악당을 만나고 있어요!';
  }
  if (command.type === 'ACTION') {
    if (command.action === 'SUBDUE' && command.state === 'BOSS_ENCOUNTER') return '보스를 제압하려고 해요!';
    if (command.action === 'RETREAT') {
      if (command.floor === 5) return '다른 방을 확인하려고 돌아가고 있어요.';
      if (command.floor === 1 || command.floor === 3) return '다른 길을 찾아보고 있어요.';
    }
    return ACTION_MESSAGES[command.action] ?? `${trainingLabel(command.action)} 행동을 하고 있어요!`;
  }
  if (command.type === 'OUTCOME') return trainingLabel(command.outcome);
  if (command.type === 'STATE_CHANGE') return trainingLabel(command.change);
  if (command.type === 'LOCAL_RETREAT') return '잠시 물러난 뒤 다시 판단하고 있어요!';
  if (command.type === 'LOCAL_BYPASS') return '대상을 피해 안전하게 지나가고 있어요!';
  return command.reason === 'GOAL_REACHED' ? '임무를 성공했어요!' : terminalReasonSentence(command.reason);
};

export const trainingComparisonMessage = (firstSuccess: number, lastSuccess: number): string => {
  if (lastSuccess > firstSuccess) return '첫 관찰보다 마지막 관찰에서 임무를 성공한 로봇이 더 많아졌어!';
  if (lastSuccess === firstSuccess) return '성공한 로봇 수는 같지만, 여러 경험을 비교하며 행동 방식이 달라졌어.';
  return '모든 도전이 항상 성공하는 건 아니지만, 성공과 실패 경험을 통해 행동 방식이 달라졌어.';
};

const lastMeaningfulAction = (episode: ActualEpisode): ActionExperience | undefined => {
  for (let index = episode.actionHistory.length - 1; index >= 0; index--) {
    if (episode.actionHistory[index].state !== 'ROUTE_CHOICE') return episode.actionHistory[index];
  }
  return undefined;
};

const lastActionMatching = (episode: ActualEpisode, matches: (action: ActionExperience) => boolean): ActionExperience | undefined => {
  for (let index = episode.actionHistory.length - 1; index >= 0; index--) if (matches(episode.actionHistory[index])) return episode.actionHistory[index];
  return undefined;
};

export const failureReview = (episode: ActualEpisode) => {
  const terminalAction = lastActionMatching(episode, action => action.immediateEvents.includes(episode.terminalReason))
    ?? lastMeaningfulAction(episode);
  const action = terminalAction;
  const floor = episode.actual.reachedFloors.at(-1) ?? 1;
  const actionLabel = action ? trainingLabel(action.action) : undefined;
  const events = new Set(episode.eventHistory.map(event => event.type));
  let title = '왜 어려웠을까?';
  let sentences: string[];

  if (episode.terminalReason === 'GOAL_REACHED') {
    title = '어떻게 성공했을까?';
    const progress: string[] = [];
    if (events.has('BOSS_NEUTRALIZED')) progress.push('보스를 제압했고');
    if (events.has('SECURITY_LOCK_OPEN')) progress.push('제어실로 가는 길을 열었고');
    if (events.has('SYSTEM_RESTORED')) progress.push('시스템을 복구했어');
    sentences = progress.length
      ? [`로봇 ${episode.robot}은 ${progress.join(', ')}.`, '최종 목표에 도착해 임무를 성공했어.']
      : [`로봇 ${episode.robot}은 실제 기록에 남은 목표를 모두 완료했어.`, '최종 목표에 도착해 임무를 성공했어.'];
  } else if (episode.terminalReason === 'TIMEOUT') {
    const actionCount = episode.actionHistory.filter(item => item.state !== 'ROUTE_CHOICE').length;
    sentences = [
      actionCount > 0
        ? `로봇 ${episode.robot}은 이동과 ${actionCount}번의 행동을 거치며 시간이 계속 쌓였어.`
        : `로봇 ${episode.robot}이 임무를 진행하는 동안 시간이 계속 쌓였어.`,
      `${episode.elapsedTime}초에 제한 시간이 끝나 최종 목표까지 도착하지 못했어.`,
    ];
  } else if (episode.terminalReason === 'MISUNDERSTANDING') {
    const mistake = lastActionMatching(episode, item => item.immediateEvents.includes('MISUNDERSTANDING')) ?? action;
    const subject = mistake?.state === 'CITIZEN_NEARBY' ? '시민을 위험한 사람으로'
      : mistake?.state === 'AMBIGUOUS_PERSON' ? '누구인지 확실하지 않은 사람을 잘못'
        : '상황을 잘못';
    const choice = mistake ? `${trainingLabel(mistake.action)}를 골랐어.` : '하면 안 되는 행동을 골랐어.';
    sentences = [`로봇 ${episode.robot}은 ${subject} 판단해 ${choice}`, '잘못된 판단 때문에 임무를 계속할 수 없었어.'];
  } else {
    const damageAction = lastActionMatching(episode, item => item.immediateEvents.includes('ROBOT_DISABLED') || (item.robotDamageAfter ?? 0) >= 1) ?? action;
    if (damageAction?.action === 'SUBDUE' && damageAction.localOutcome === 'SUBDUE_RECOVERY') {
      sentences = [`로봇 ${episode.robot}은 악당을 제압하려고 했지만 공격에 실패하면서 피해를 입었어.`, '피해가 너무 많이 쌓여 결국 작동 불능이 되었어.'];
    } else if (damageAction?.action === 'FORCE_PASS') {
      sentences = [`로봇 ${episode.robot}은 강제로 돌파하려고 했지만 그 과정에서 피해를 입었어.`, '누적된 피해 때문에 결국 작동 불능이 되었어.'];
    } else {
      sentences = [damageAction ? `로봇 ${episode.robot}은 ${trainingLabel(damageAction.action)}를 시도하는 과정에서 피해를 입었어.` : `로봇 ${episode.robot}은 임무 중 피해가 쌓였어.`, '누적된 피해가 한계에 달해 작동 불능이 되었어.'];
    }
  }
  return {
    title,
    floor,
    action: actionLabel,
    result: trainingLabel(episode.terminalReason),
    text: sentences.join('\n'),
  };
};
