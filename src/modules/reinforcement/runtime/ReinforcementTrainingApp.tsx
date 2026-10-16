import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as Phaser from 'phaser';
import graph from '../../../../docs/modules/machine_learning/reinforcement/navigation/navigation_graph_v1_f5_v3.json';
import { LOGICAL } from '../../../config.ts';
import { AriDialogue } from '../../ai-basics/AriDialogue.tsx';
import {
  DEFAULT_REWARD_STARS,
  REWARD_STAR_TOTAL,
  type RewardStars,
  type TerminalReason,
} from '../sim/learningEngine.ts';
import type { ActualEpisode } from '../sim/actualMapSimulation.ts';
import { ACTUAL_MAP_FILES, buildActualMapEnvironment } from '../sim/actualMapEnvironment.ts';
import type { TiledMapJson } from '../debug/floor1Tiled.ts';
import { ReinforcementRuntimeScene } from './ReinforcementRuntimeScene.ts';
import { OBSERVATION_ROUNDS, TrainingRuntimeController, type HiddenRoundSummary, type RobotRuntime, type RoundHistory } from './runtimeController.ts';
import type { RuntimeCommand } from './runtimeCommands.ts';
import { failureReview, REWARD_LABELS, rewardAdvice, trainingComparisonMessage, trainingLabel, WEIGHT_LEVEL_LABELS } from './trainingLabels.ts';

type Phase = 'TUTORIAL' | 'SETTING' | 'PREPARING' | 'RUNTIME' | 'RESULT' | 'COMPLETE'
  | 'HEADLESS_LEARNING' | 'ACTUAL_PREPARING' | 'ACTUAL_RUNTIME' | 'ACTUAL_RESULT';
type RuntimeStatus = { floor: number; trace: string; simulationTime: number; command?: RuntimeCommand };
type TutorialTarget = 'start' | 'rewards' | 'runtime' | 'action' | 'results' | 'failure' | 'actual';
type HiddenStage = 'RUNNING' | 'COLLECTED' | 'UPDATED';
type HiddenProgress = { current: number; stage: HiddenStage; completed: number[]; rounds: HiddenRoundSummary[]; from: number; next: number; waiting: boolean };

const WEIGHT_FIELDS = (Object.keys(REWARD_LABELS) as Array<keyof RewardStars>).map(key => ({ key, label: REWARD_LABELS[key] }));
const COMPARED_ACTIONS = ['SUBDUE', 'DISTRACT', 'FORCE_PASS', 'PUSH', 'CLEAR', 'DETOUR'] as const;
const FAILURE_REASONS: Exclude<TerminalReason, 'GOAL_REACHED'>[] = ['ROBOT_DISABLED', 'TIMEOUT', 'MISUNDERSTANDING'];
const TUTORIAL_STEPS: Array<{ text: string; target: TutorialTarget }> = [
  { text: '이번에는 로봇을 직접 움직이는 게 아니야! 로봇이 어떤 행동을 중요하게 배울지 정해 줄 거야.', target: 'start' },
  { text: '별이 많을수록 로봇이 더 중요하게 생각해. 네 생각대로 보상과 벌점의 중요도를 골라 봐!', target: 'rewards' },
  { text: '로봇 5대가 같은 배운 방법으로 도전해. 큰 화면은 자세히 보는 로봇이고, 아래 화면을 누르면 바꿔 볼 수 있어.', target: 'runtime' },
  { text: '성공과 실패를 모두 경험으로 모아. 실패한 로봇의 마지막 장면도 다시 볼 수 있어.', target: 'results' },
  { text: '여러 번 학습하면 로봇이 고르는 행동이 달라져. 첫 관찰과 마지막 관찰을 비교해 보자!', target: 'action' },
  { text: '20번의 학습을 마친 로봇은 마지막에 배운 방법으로 실제 임무에 도전해!', target: 'actual' },
];

const robotNames = (episodes: ActualEpisode[]) => episodes.length ? episodes.map(episode => `로봇 ${episode.robot}`).join(', ') : '없어';
const successCount = (round: RoundHistory) => round.robotResults.filter(episode => episode.terminalReason === 'GOAL_REACHED').length;
const reasonCount = (round: RoundHistory, reason: TerminalReason) => round.robotResults.filter(episode => episode.terminalReason === reason).length;
const actionCount = (round: RoundHistory, action: string) => round.robotResults.reduce(
  (sum, episode) => sum + episode.actionHistory.filter(item => item.action === action).length,
  0,
);

function TutorialPreview({ step, onNext }: { step: number; onNext: () => void }) {
  const current = TUTORIAL_STEPS[step];
  const focus = (target: TutorialTarget) => current.target === target ? 'tutorial-highlight' : '';
  const view = step < 2 ? 'setting' : step === 2 ? 'runtime' : step < 5 ? 'results' : 'actual';
  return <main className="reinforcement-training tutorial-screen noto-font">
    <div className="tutorial-progress" aria-label={`튜토리얼 ${step + 1} / ${TUTORIAL_STEPS.length}`}>
      {TUTORIAL_STEPS.map((_, index) => <i className={index <= step ? 'is-done' : ''} key={index} />)}
    </div>
    <section className="tutorial-stage" aria-hidden="true">
      {view === 'setting' && <div className="tutorial-setting-mock">
        <h1>로봇은 무엇을 중요하게 배울까?</h1>
        <div className={`tutorial-reward-list ${focus('rewards')}`}>
          <span>빠르게 해결하기 <b>★★</b></span><span>정확하게 판단하기 <b>★★</b></span><span>위협 제거하기 <b>★★</b></span>
        </div>
        <button className={focus('start')} type="button">학습 시작</button>
      </div>}
      {view === 'runtime' && <div className="tutorial-runtime-mock">
        <div className={`tutorial-main-view ${focus('runtime')}`}><strong>로봇 1 큰 화면</strong><span>5층으로 이동 중</span></div>
        <div className="tutorial-sub-views">{[2, 3, 4, 5].map(robot => <span key={robot}>로봇 {robot}</span>)}</div>
        <div className={`tutorial-action-card ${focus('action')}`}><small>지금 하는 행동</small><strong>악당의 주의를 다른 곳으로 돌리고 있어요!</strong></div>
      </div>}
      {view === 'results' && <div className={`tutorial-result-mock ${focus('results') || focus('action')}`}>
        <h1>1번째 관찰이 끝났어!</h1>
        <div>{[1, 2, 3, 4, 5].map(robot => <span className={robot === 2 ? focus('failure') : ''} key={robot}>로봇 {robot}<b>{robot === 2 ? '마지막 장면 보기' : '임무 성공'}</b></span>)}</div>
      </div>}
      {view === 'actual' && <div className="tutorial-final-mock">
        <h1>훈련이 끝났어!</h1><p>성공과 실패를 통해 행동 방식이 달라졌어.</p>
        <button className={focus('actual')} type="button">실전에서 확인하기</button>
      </div>}
    </section>
    <AriDialogue text={current.text} expression={step === TUTORIAL_STEPS.length - 1 ? 'happy' : 'neutral'} onNext={onNext}
      nextLabel={step === TUTORIAL_STEPS.length - 1 ? '중요도 정하러 가기' : '다음'} />
  </main>;
}

function RuntimeView({ maps, robot, instanceKey, main, running, onReady, onSelect, onStatus, onError, runtimeIdentity }: {
  maps: TiledMapJson[]; robot: RobotRuntime; instanceKey: string; main: boolean; running: boolean;
  onReady: () => void; onSelect: () => void; onStatus: (status: RuntimeStatus) => void; onError: (message: string) => void;
  runtimeIdentity?: Record<string, unknown>;
}) {
  const resultTone = robot.terminalReason === 'GOAL_REACHED' ? 'is-success' : robot.terminal ? 'is-failure' : 'is-running';
  const mount = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const readyHandler = useRef(onReady);
  const statusHandler = useRef(onStatus);
  const errorHandler = useRef(onError);
  readyHandler.current = onReady;
  statusHandler.current = onStatus;
  errorHandler.current = onError;

  useEffect(() => {
    if (!mount.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: mount.current, width: LOGICAL.width, height: LOGICAL.height,
      backgroundColor: '#071018', pixelArt: true, roundPixels: true,
      audio: { noAudio: true },
      physics: { default: 'arcade', arcade: { debug: false } },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [new ReinforcementRuntimeScene({
        maps,
        commands: robot.commands,
        waitForStart: true,
        runtimeSyncDebug: new URLSearchParams(window.location.search).get('runtimeSyncDebug') === 'true',
        runtimeIdentity,
      })],
    });
    gameRef.current = game;
    game.events.on('reinforcement-runtime-ready', () => {
      game.events.emit('reinforcement-runtime-speed', { movement: 1, event: 1 });
      readyHandler.current();
    });
    game.events.on('reinforcement-runtime-status', (status: RuntimeStatus) => statusHandler.current(status));
    game.events.on('reinforcement-runtime-error', (message: string) => errorHandler.current(message));
    return () => { gameRef.current = null; game.destroy(true); };
  }, [maps, robot.commands, instanceKey]);

  useEffect(() => { if (running) gameRef.current?.events.emit('reinforcement-runtime-start'); }, [running]);

  return <button type="button"
    className={`training-runtime-card ${main ? 'is-main' : 'is-sub'} ${robot.terminal ? 'is-terminal' : ''} ${resultTone}`}
    aria-label={`로봇 ${robot.robot}${main ? ', 관찰 중' : ', 보조 화면'}`} aria-pressed={main}
    disabled={!running} onClick={main || !running ? undefined : onSelect}>
    <div className="training-runtime-canvas" ref={mount} />
    <div className="training-runtime-status"><strong>로봇 {robot.robot}</strong><span>{robot.floor}층</span><span className="runtime-state-badge">{trainingLabel(robot.terminalReason ?? robot.status)}</span></div>
  </button>;
}

function PreparationScreen({ ready, total = 5, actual = false, error, onBack }: {
  ready: number; total?: number; actual?: boolean; error: string; onBack: () => void;
}) {
  return <section className="training-preparation" role="status" aria-live="polite"><div className="training-preparation-card">
    <span className="training-preparation-icon" aria-hidden="true">🤖</span>
    <h1>{error ? '로봇을 준비하지 못했어요' : actual ? '실전 임무를 준비하고 있어요!' : '로봇들이 다음 도전을 준비하고 있어요!'}</h1>
    <p>{error ? '잠시 후 다시 시작해 주세요.' : actual ? '훈련을 마친 로봇이 실제 임무를 준비하고 있어요.' : '5대의 로봇이 출발을 준비하고 있어요.'}</p>
    {!error && <div className="robot-ready-list" aria-label={`${ready} / ${total} 준비 완료`}>
      {Array.from({ length: total }, (_, index) => <span className={index < ready ? 'is-ready' : index === ready ? 'is-loading' : ''} key={index}>
        <i aria-hidden="true">{index < ready ? '✓' : index === ready ? '…' : '·'}</i>로봇 {index + 1}<b>{index < ready ? '준비 완료' : index === ready ? '준비 중' : '기다리는 중'}</b>
      </span>)}
    </div>}
    {!error && <strong>{ready} / {total} 준비 완료</strong>}
    {error && <button type="button" onClick={onBack}>설정으로 돌아가기</button>}
  </div></section>;
}

function TrainingProgress({ observationIndex, actualRound }: { observationIndex: number; actualRound: number }) {
  return <header className="training-header"><div className="observation-title"><span>현재 관찰</span><strong>{observationIndex}번째 관찰</strong><small>{actualRound}번째 학습 결과</small></div>
    <div className="checkpoint-progress" aria-label={`관찰 ${observationIndex} / ${OBSERVATION_ROUNDS.length}`}><span>학습 과정</span><ol>
      {OBSERVATION_ROUNDS.map((round, index) => <li className={index < observationIndex - 1 ? 'is-complete' : index === observationIndex - 1 ? 'is-current' : ''} key={round}><i /> <b>{round}</b></li>)}
    </ol></div></header>;
}

function RuntimeSidebar({ robot, completed, total }: { robot: RobotRuntime; completed: number; total: number }) {
  const state = robot.terminal ? trainingLabel(robot.terminalReason) : trainingLabel(robot.status);
  return <aside className="runtime-sidebar" aria-label={`로봇 ${robot.robot} 현재 상태`}>
    <div className="sidebar-heading"><span className="live-dot" aria-hidden="true" /><div><small>관찰 중</small><strong>로봇 {robot.robot}</strong></div></div>
    <section><small>현재 위치</small><strong>{robot.floor}층</strong></section>
    <section className="sidebar-action"><small>지금 하는 행동</small><strong>{robot.message}</strong></section>
    <section><small>현재 상태</small><strong>{state}</strong></section>
    <section><small>이번 관찰</small><strong>로봇 {completed} / {total} 도전 완료</strong></section>
  </aside>;
}

function HiddenLearningScreen({ progress, onNext }: { progress: HiddenProgress; onNext: () => void }) {
  const stageText: Record<HiddenStage, string> = {
    RUNNING: `${progress.current}번째 학습에서 로봇 5대가 도전 중이에요.`,
    COLLECTED: `${progress.current}번째 학습에서 5대의 경험 수집을 완료했어요.`,
    UPDATED: `${progress.current}번째 학습의 행동 기준 업데이트를 완료했어요.`,
  };
  return <main className="reinforcement-training hidden-learning-screen noto-font"><section className="hidden-learning-card" role="status" aria-live="polite">
    <div className="learning-illustration" aria-hidden="true"><span>✓</span><span>✕</span><i>→</i><b>🤖</b></div>
    <p className="training-kicker">보이지 않는 학습 진행 중</p><h1>지금은 {progress.current}번째 학습을 진행하고 있어요.</h1>
    <p>{stageText[progress.stage]}</p>
    <ol className="hidden-round-list">
      <li className="is-complete"><b>{progress.from}번째</b><span>관찰 완료 ✓</span></li>
      {progress.rounds.map(round => {
        const completed = progress.completed.includes(round.round) || round.round < progress.current;
        const current = round.round === progress.current;
        const status = completed ? '학습 완료 ✓'
          : current && progress.stage === 'COLLECTED' ? `${round.robotCount}대의 경험 수집 완료`
            : current && progress.stage === 'UPDATED' ? '행동 기준 업데이트 완료'
              : current ? `${round.robotCount}대 도전 중` : '대기';
        return <li className={completed ? 'is-complete' : current ? 'is-current' : ''} key={round.round}><b>{round.round}번째</b><span>{status}</span></li>;
      })}
      <li className="is-next"><b>{progress.next}번째</b><span>다음 관찰</span></li>
    </ol>
    <AriDialogue inline text="지금 화면에는 보이지 않지만 로봇들은 계속 도전하고 있어! 5대가 한 번씩 도전한 결과를 모아서 다음 행동 기준을 다시 배우는 중이야." expression="happy"
      onNext={progress.waiting ? onNext : undefined} nextLabel="다음" />
  </section></main>;
}

function RoundResult({ controller, reviewRobot, onReview, onBack, onContinue }: {
  controller: TrainingRuntimeController; reviewRobot: number | null; onReview: (robot: number) => void;
  onBack: () => void; onContinue: () => void;
}) {
  const successes = controller.robots.map(robot => robot.episode).filter(episode => episode.terminalReason === 'GOAL_REACHED');
  const failures = controller.robots.map(robot => robot.episode).filter(episode => episode.terminalReason !== 'GOAL_REACHED');
  if (reviewRobot !== null) {
    const episode = controller.robots.find(robot => robot.robot === reviewRobot)!.episode;
    const review = failureReview(episode);
    const succeeded = episode.terminalReason === 'GOAL_REACHED';
    return <aside className="round-result round-result-review" aria-label={`로봇 ${reviewRobot} 마지막 장면 설명`}>
      <AriDialogue inline text={review.text} expression={succeeded ? 'happy' : 'disappointed'} />
      <h2>{review.title}</h2>
      <div className="failure-review-facts"><span><small>마지막 위치</small><strong>{review.floor}층</strong></span>
        {review.action && <span><small>마지막 행동</small><strong>{review.action}</strong></span>}
        <span><small>결과</small><strong>{review.result}</strong></span></div>
      <button className="review-back" type="button" onClick={onBack}>결과로 돌아가기</button>
    </aside>;
  }
  const successLine = successes.length ? `임무를 완수한 로봇은 ${robotNames(successes)}야.` : '이번에는 임무를 완수한 로봇이 없었어.';
  const failureLine = failures.length ? `아쉬웠던 로봇은 ${robotNames(failures)}야.` : '실패한 로봇은 없어!';
  return <section className="round-result round-result-summary"><div className="round-result-layout">
    <section className="round-result-explanation"><AriDialogue inline
      text={`${controller.observationIndex}번째 관찰이 끝났어! ${controller.actualRound}번째 학습에서 로봇 5대가 도전했어.\n${successLine}\n${failureLine}`}
      expression={failures.length ? 'neutral' : 'happy'} />
      <p className="learning-explanation">성공한 경험과 실패한 경험을 모두 모았어. AI는 이 경험으로 다음 행동 기준을 다시 배워!</p>
    </section>
    <aside className="round-result-robots"><h2>로봇별 결과</h2><div className="round-robot-results" aria-label="로봇별 학습 결과">{controller.robots.map(robot => {
      const succeeded = robot.episode.terminalReason === 'GOAL_REACHED';
      const content = <><strong>로봇 {robot.robot}</strong><span>{succeeded ? '✓ 임무 성공' : `✕ ${trainingLabel(robot.episode.terminalReason)}`}</span></>;
      return <button className={succeeded ? 'is-success' : 'is-failure'} type="button" key={robot.robot} onClick={() => onReview(robot.robot)}>{content}<small>마지막 장면 보기</small></button>;
    })}</div></aside>
    <button className="round-result-cta training-start" type="button" onClick={onContinue}>{controller.trainingComplete ? '최종 결과 보기' : '다음 학습 시작'}</button>
  </div></section>;
}

function TrainingResult({ controller, onActual, onRestart, onHome }: {
  controller: TrainingRuntimeController; onActual: () => void; onRestart: () => void; onHome: () => void;
}) {
  const first = controller.history.rounds[0];
  const last = controller.history.rounds.at(-1)!;
  const firstSuccess = successCount(first);
  const lastSuccess = successCount(last);
  const changes = COMPARED_ACTIONS.map(action => ({ action, first: actionCount(first, action), last: actionCount(last, action) }))
    .filter(change => change.first + change.last > 0);
  const maxActionCount = Math.max(1, ...changes.flatMap(change => [change.first, change.last]));
  const ariText = trainingComparisonMessage(firstSuccess, lastSuccess);
  return <main className="reinforcement-training training-result-screen noto-font"><section className="training-result-card">
    <p className="training-kicker">학습 결과</p><h1>훈련이 끝났어!</h1>
    <p>20번의 학습 중 5개 관찰 지점에서 <strong>25대의 로봇</strong>을 직접 살펴봤어!</p>
    <div className="success-comparison"><div><small>처음</small><strong>성공 {firstSuccess} / 5</strong></div><b aria-hidden="true">→</b>
      <div><small>마지막</small><strong>성공 {lastSuccess} / 5</strong></div></div>
    <div className="training-result-details">
      <section><h2>실패는 어떻게 달라졌을까?</h2>{FAILURE_REASONS.map(reason => <p key={reason}><span>{trainingLabel(reason)}</span><strong>{reasonCount(first, reason)} → {reasonCount(last, reason)}</strong></p>)}</section>
      <section><h2>행동은 어떻게 달라졌을까?</h2>{changes.length ? changes.map(change => <div className="action-change" key={change.action}>
        <span>{trainingLabel(change.action)}</span><strong>{change.first} → {change.last}</strong>
        <i style={{ '--before': `${change.first / maxActionCount * 100}%`, '--after': `${change.last / maxActionCount * 100}%` } as CSSProperties} />
      </div>) : <p>비교할 행동이 아직 없어요.</p>}</section>
      <section className="chosen-weights"><h2>내가 중요하게 정한 것</h2>{WEIGHT_FIELDS.map(field => <p key={field.key}><span>{field.label}</span>
        <strong aria-label={`${controller.history.selectedRewardStars[field.key]}단계`}>{'★'.repeat(controller.history.selectedRewardStars[field.key]) || '–'}</strong></p>)}</section>
    </div>
    <AriDialogue inline text={ariText} expression="happy" />
    <div className="final-actions"><button className="training-start" type="button" onClick={onActual}>배운 방법으로 실전 도전!</button>
      <button type="button" onClick={onRestart}>다시 학습하기</button><button className="tertiary" type="button" onClick={onHome}>메인으로</button></div>
  </section></main>;
}

function ActualMissionResult({ robot, onRestart, onHome }: { robot: RobotRuntime; onRestart: () => void; onHome: () => void }) {
  const succeeded = robot.terminalReason === 'GOAL_REACHED';
  const reason = robot.terminalReason ? trainingLabel(robot.terminalReason) : '임무 종료';
  return <section className={`actual-result ${succeeded ? 'is-success' : 'is-failure'}`}><AriDialogue
    text={succeeded ? '임무 성공! 훈련에서 배운 방법으로 제어 시스템을 복구했어!'
      : `이번 임무는 여기까지였어.\n${reason}\n다시 학습해서 다른 방법을 배워볼 수 있어!`}
    expression={succeeded ? 'happy' : 'disappointed'}>
    <div className="actual-result-actions"><button type="button" onClick={onRestart}>다시 학습하기</button><button type="button" onClick={onHome}>메인으로 돌아가기</button></div>
  </AriDialogue></section>;
}

export function ReinforcementTrainingApp() {
  const [phase, setPhase] = useState<Phase>('TUTORIAL');
  const [tutorialStep, setTutorialStep] = useState(0);
  const [weights, setWeights] = useState<RewardStars>({ ...DEFAULT_REWARD_STARS });
  const [maps, setMaps] = useState<TiledMapJson[]>([]);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [reviewRobot, setReviewRobot] = useState<number | null>(null);
  const [readyRobots, setReadyRobots] = useState<number[]>([]);
  const [actualRobot, setActualRobot] = useState<RobotRuntime | null>(null);
  const [actualReady, setActualReady] = useState(false);
  const [hiddenProgress, setHiddenProgress] = useState<HiddenProgress | null>(null);
  const controllerRef = useRef<TrainingRuntimeController | null>(null);
  const hiddenSequenceRef = useRef(0);
  const hiddenAdvanceRef = useRef<(() => void) | null>(null);
  const initialSeed = Number(new URLSearchParams(window.location.search).get('seed')) || 42;
  const controller = controllerRef.current;
  const usedStars = WEIGHT_FIELDS.reduce((sum, field) => sum + weights[field.key], 0);
  const validStarBudget = usedStars === REWARD_STAR_TOTAL;

  const advanceHiddenLearning = () => {
    const advance = hiddenAdvanceRef.current;
    if (!advance) return;
    hiddenAdvanceRef.current = null;
    setHiddenProgress(current => current ? { ...current, waiting: false } : current);
    advance();
  };

  useEffect(() => {
    if (phase === 'PREPARING' && !error && readyRobots.length === 5) setPhase('RUNTIME');
    if (phase === 'ACTUAL_PREPARING' && !error && actualReady) setPhase('ACTUAL_RUNTIME');
  }, [actualReady, error, phase, readyRobots.length]);

  useEffect(() => {
    if (phase !== 'HEADLESS_LEARNING') return;
    const onSpace = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || !hiddenAdvanceRef.current) return;
      event.preventDefault();
      advanceHiddenLearning();
    };
    window.addEventListener('keydown', onSpace);
    return () => window.removeEventListener('keydown', onSpace);
  }, [phase]);

  const startTraining = async () => {
    if (phase !== 'SETTING') return;
    setPhase('PREPARING'); setReadyRobots([]); setError('');
    try {
      const loadedMaps = await Promise.all(ACTUAL_MAP_FILES.map(async path => {
        const response = await fetch(`/${path.replace(/^public\//, '')}`);
        if (!response.ok) throw new Error('학습 지도를 불러오지 못했어요.');
        return response.json() as Promise<TiledMapJson>;
      }));
      const environment = buildActualMapEnvironment(loadedMaps, graph as Parameters<typeof buildActualMapEnvironment>[1]);
      controllerRef.current = new TrainingRuntimeController(environment, weights, initialSeed);
      setMaps(loadedMaps); setVersion(value => value + 1);
    } catch (cause) { console.error(cause); setError('학습 준비 중 문제가 생겼어요.'); }
  };

  const observe = (robotId: number, status: RuntimeStatus) => {
    const active = controllerRef.current;
    if (!active || phase !== 'RUNTIME' || !status.command) return;
    active.observeCommand(robotId, status.command); setVersion(value => value + 1);
    if (active.roundComplete) setPhase('RESULT');
  };
  const selectMain = (robotId: number) => {
    const active = controllerRef.current;
    if (!active) return;
    active.selectMain(robotId); setVersion(value => value + 1);
  };
  const continueTraining = () => {
    const active = controllerRef.current;
    if (!active) return;
    if (active.trainingComplete) { setReviewRobot(null); setPhase('COMPLETE'); return; }
    setReviewRobot(null); setReadyRobots([]); setError(''); setPhase('HEADLESS_LEARNING');
    hiddenAdvanceRef.current = null;
    const rounds = active.hiddenRoundsBeforeNextObservation;
    const nextObservation = OBSERVATION_ROUNDS[active.observationIndex];
    const sequence = ++hiddenSequenceRef.current;
    if (!rounds.length || !nextObservation) {
      active.nextRound(); setVersion(value => value + 1); setPhase('PREPARING'); return;
    }
    const present = (roundIndex: number, stage: HiddenStage, completed: number[], waiting = false) => {
      setHiddenProgress({ current: rounds[roundIndex].round, stage, completed, rounds, from: active.actualRound, next: nextObservation, waiting });
    };
    const hold = (done: () => void) => {
      const startedAt = performance.now();
      const frame = (now: number) => {
        if (hiddenSequenceRef.current !== sequence || controllerRef.current !== active) return;
        if (now - startedAt < 3000) { requestAnimationFrame(frame); return; }
        done();
      };
      requestAnimationFrame(frame);
    };
    const finish = () => {
      active.nextRound(); setHiddenProgress(null); setVersion(value => value + 1); setPhase('PREPARING');
    };
    const waitForInput = (roundIndex: number, stage: HiddenStage, completed: number[], next: () => void) => {
      present(roundIndex, stage, completed, true);
      hiddenAdvanceRef.current = () => {
        if (hiddenSequenceRef.current !== sequence || controllerRef.current !== active) return;
        next();
      };
    };
    const showAutomaticRound = (roundIndex: number, completed: number[]) => {
      const round = rounds[roundIndex];
      if (!round) return;
      present(roundIndex, 'RUNNING', completed);
      hold(() => {
        present(roundIndex, 'COLLECTED', completed);
        hold(() => {
          if (roundIndex === rounds.length - 1) waitForInput(roundIndex, 'UPDATED', completed, finish);
          else {
            present(roundIndex, 'UPDATED', completed);
            hold(() => showAutomaticRound(roundIndex + 1, [...completed, round.round]));
          }
        });
      });
    };
    waitForInput(0, 'RUNNING', [], () => {
      present(0, 'COLLECTED', []);
      hold(() => waitForInput(0, 'UPDATED', [], () => {
        if (rounds.length === 1) finish();
        else showAutomaticRound(1, [rounds[0].round]);
      }));
    });
  };
  const startActualMission = () => {
    const active = controllerRef.current;
    if (!active) return;
    setActualRobot(active.createEvaluation()); setActualReady(false); setError(''); setPhase('ACTUAL_PREPARING');
  };
  const observeActual = (status: RuntimeStatus) => {
    const active = controllerRef.current;
    if (!active || !actualRobot || phase !== 'ACTUAL_RUNTIME' || !status.command) return;
    active.observeEvaluation(actualRobot, status.command); setVersion(value => value + 1);
    if (actualRobot.terminal) setPhase('ACTUAL_RESULT');
  };
  const restart = () => {
    hiddenSequenceRef.current++;
    hiddenAdvanceRef.current = null;
    controllerRef.current = null; setMaps([]); setError(''); setReviewRobot(null); setReadyRobots([]);
    setActualRobot(null); setActualReady(false); setHiddenProgress(null); setVersion(value => value + 1); setPhase('SETTING');
  };

  if (phase === 'TUTORIAL') return <TutorialPreview step={tutorialStep} onNext={() => {
    if (tutorialStep === TUTORIAL_STEPS.length - 1) setPhase('SETTING'); else setTutorialStep(value => value + 1);
  }} />;

  if (phase === 'SETTING') return <main className="reinforcement-training setting-screen noto-font"><div className="setting-layout">
    <section className="reward-setting" aria-label="보상 중요도 설정"><p className="training-kicker">학습 준비</p><h1>로봇이 중요하게 배울 것을 골라 봐!</h1>
      <p>별이 많을수록 로봇이 더 중요하게 생각해요.</p>
      <div className="weight-list">{WEIGHT_FIELDS.map(field => <fieldset className={`reward-card reward-${field.key}`} key={field.key}><span className="reward-icon" aria-hidden="true">{field.key === 'speed' ? '⏱' : field.key === 'judgment' ? '🔎' : '🛡'}</span><legend>{field.label}</legend>
        <p>{field.key === 'speed' ? '시간을 덜 쓰는 행동을 더 좋아해요.' : field.key === 'judgment' ? '서두르지 않고 정확히 살펴봐요.' : '악당을 막고 위험을 해결해요.'}</p><div className="weight-segments">
        {[0, 1, 2, 3].map(value => <button type="button" key={value} aria-label={`${field.label}: ${WEIGHT_LEVEL_LABELS[value]}`}
          aria-pressed={weights[field.key] === value} title={WEIGHT_LEVEL_LABELS[value]}
          disabled={usedStars - weights[field.key] + value > REWARD_STAR_TOTAL}
          onClick={() => setWeights(current => ({ ...current, [field.key]: value }))}>
          <span>{value === 0 ? '☆☆☆' : '★'.repeat(value) + '☆'.repeat(3 - value)}</span><small>{value}개</small></button>)}
      </div></fieldset>)}</div>
      <div className={`star-budget ${validStarBudget ? 'is-complete' : ''}`} aria-live="polite"><span>사용한 별</span><strong>{usedStars} / {REWARD_STAR_TOTAL}</strong><small>{validStarBudget ? '별을 모두 나눠 줬어요!' : '별 6개를 모두 나누어 주세요.'}</small></div>
      {error && <p className="training-error" role="alert">{error}</p>}
      <button type="button" className="training-start" disabled={!validStarBudget} onClick={() => void startTraining()}>로봇 학습 시작!</button>
    </section><AriDialogue inline text={rewardAdvice(weights)} expression="happy" />
  </div></main>;

  if (!controller) return <main className="reinforcement-training noto-font"><PreparationScreen ready={0} error={error} onBack={restart} /></main>;
  if (phase === 'HEADLESS_LEARNING' && hiddenProgress) return <HiddenLearningScreen progress={hiddenProgress} onNext={advanceHiddenLearning} />;
  if (phase === 'COMPLETE') return <TrainingResult controller={controller} onActual={startActualMission} onRestart={restart} onHome={() => window.location.assign('/')} />;

  if (actualRobot && ['ACTUAL_PREPARING', 'ACTUAL_RUNTIME', 'ACTUAL_RESULT'].includes(phase)) return <main className="reinforcement-training actual-mission-screen noto-font" data-version={version}>
    <header className="actual-mission-header"><div><span>배운 방법으로 도전</span><strong>실전 임무</strong></div><div><span>현재 위치</span><strong>{actualRobot.floor}층</strong></div>
      <div className="current-action"><span>지금 하는 행동</span><strong>{actualRobot.message}</strong></div></header>
    <section className="actual-runtime-view"><RuntimeView maps={maps} robot={actualRobot} instanceKey="actual-mission" main
      runtimeIdentity={{ trainingSeed: initialSeed, starProfile: weights, round: 'evaluation', robotIndex: 1, episodeId: `evaluation-${actualRobot.episodeSeed}` }}
      running={phase === 'ACTUAL_RUNTIME'} onReady={() => setActualReady(true)} onSelect={() => undefined}
      onStatus={observeActual} onError={() => setError('실전 임무 화면을 표시하는 중 문제가 생겼어요.')} /></section>
    {phase === 'ACTUAL_PREPARING' && <PreparationScreen ready={actualReady ? 1 : 0} total={1} actual error={error} onBack={restart} />}
    {phase === 'ACTUAL_RESULT' && <ActualMissionResult robot={actualRobot} onRestart={restart} onHome={() => window.location.assign('/')} />}
  </main>;

  const mainRobot = controller.robots.find(robot => robot.robot === controller.mainRobot)!;
  const completed = controller.robots.filter(robot => robot.terminal).length;
  return <main className={`reinforcement-training runtime-screen noto-font ${phase === 'RESULT' && reviewRobot !== null ? 'is-reviewing' : ''}`} data-version={version}>
    <TrainingProgress observationIndex={controller.observationIndex} actualRound={controller.actualRound} />
    <section className="runtime-workspace"><section className="training-runtime-grid" aria-label="로봇 5대의 학습 화면">{controller.robots.map(robot => <RuntimeView key={robot.robot}
      maps={maps} robot={robot} instanceKey={`round-${controller.actualRound}-robot-${robot.robot}`}
      runtimeIdentity={{ trainingSeed: initialSeed, starProfile: weights, actualRound: controller.actualRound, observationIndex: controller.observationIndex, observationRound: controller.observationRound, robotIndex: robot.robot, episodeId: `${controller.actualRound}-${robot.robot}-${robot.episodeSeed}` }}
      main={robot.robot === controller.mainRobot} running={phase === 'RUNTIME'}
      onReady={() => setReadyRobots(current => current.includes(robot.robot) ? current : [...current, robot.robot])}
      onSelect={() => selectMain(robot.robot)} onStatus={status => observe(robot.robot, status)}
      onError={() => setError('화면을 표시하는 중 문제가 생겼어요.')} />)}</section>
      <RuntimeSidebar robot={mainRobot} completed={completed} total={controller.robots.length} /></section>
    {error && <p className="runtime-error training-error" role="alert">{error}</p>}
    {phase === 'PREPARING' && <PreparationScreen ready={readyRobots.length} error={error} onBack={restart} />}
    {phase === 'RESULT' && <RoundResult controller={controller} reviewRobot={reviewRobot}
      onReview={robotId => { selectMain(robotId); setReviewRobot(robotId); }} onBack={() => setReviewRobot(null)} onContinue={continueTraining} />}
  </main>;
}
