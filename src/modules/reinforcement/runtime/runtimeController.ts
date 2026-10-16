import {
  DEFAULT_REWARD_STARS,
  episodeSeed,
  rewardWeightsFromStars,
  type Policy,
  type ProfileName,
  type RewardStars,
  type RewardWeights,
  type TerminalReason,
} from '../sim/learningEngine.ts';
import type { ActualMapEnvironment } from '../sim/actualMapEnvironment.ts';
import {
  runActualMapProfile,
  runActualMapEvaluation,
  runActualMapTraining,
  type ActualEpisode,
  type ActualRound,
  type ActualTrainingRun,
} from '../sim/actualMapSimulation.ts';
import { createRuntimeCommands, type RuntimeCommand } from './runtimeCommands.ts';
import { importantActionMessage } from './trainingLabels.ts';

export type RobotRuntime = {
  robot: number;
  episodeSeed: number;
  floor: number;
  cursor: number;
  terminal: boolean;
  terminalReason?: TerminalReason;
  status: string;
  action?: string;
  message: string;
  commands: RuntimeCommand[];
  trace: string[];
  episode: ActualEpisode;
};

export type RoundHistory = {
  roundIndex: number;
  policySnapshotBefore: Policy;
  robotResults: ActualEpisode[];
  policySnapshotAfter: Policy;
  combatSkillSnapshot: number;
  combatSkillAfter: number;
};

export type TrainingSession = {
  selectedRewardStars: RewardStars;
  resolvedRewardWeights: RewardWeights;
  rounds: RoundHistory[];
};

export type HiddenRoundSummary = { round: number; robotCount: number };

export const OBSERVATION_ROUNDS = [1, 5, 10, 15, 20] as const;

const createRobots = (environment: ActualMapEnvironment, round: ActualRound, seed: number): RobotRuntime[] =>
  round.episodes.map((episode, index) => ({
    robot: index + 1,
    episodeSeed: episodeSeed(seed, round.round, index + 1),
    floor: 1,
    cursor: 0,
    terminal: false,
    status: 'READY',
    message: '출발을 준비하고 있어요.',
    commands: createRuntimeCommands(environment, episode, episodeSeed(seed, round.round, index + 1)),
    trace: [],
    episode,
  }));

const commandStatus = (command: RuntimeCommand): string => {
  if (command.type === 'ACTION') return command.action;
  if (command.type === 'ENCOUNTER') return command.phase === 'START' ? command.encounter : 'MOVING';
  if (command.type === 'OUTCOME') return command.outcome;
  if (command.type === 'FLOOR_TRANSITION') return `FLOOR_TRANSITION → F${command.targetFloor}`;
  if (command.type === 'STATE_CHANGE') return command.change;
  if (command.type === 'TERMINAL') return command.reason;
  return 'MOVING';
};

export class FiveRobotRuntimeController {
  readonly snapshotSignature: string;
  readonly robots: RobotRuntime[];
  private committedUpdates = 0;

  constructor(environment: ActualMapEnvironment, profile: ProfileName, seed: number) {
    const round = runActualMapProfile(environment, profile, seed, 1, 5).rounds[0];
    this.snapshotSignature = JSON.stringify(round.snapshot);
    this.robots = createRobots(environment, round, seed);
  }

  advance(robotId: number): RuntimeCommand | undefined {
    const robot = this.robots.find(candidate => candidate.robot === robotId);
    if (!robot || robot.terminal) return undefined;
    const command = robot.commands[robot.cursor++];
    if (!command) return undefined;
    robot.floor = command.type === 'FLOOR_TRANSITION' ? command.targetFloor : command.floor;
    robot.status = commandStatus(command);
    robot.action = command.type === 'ACTION' ? command.action : robot.action;
    robot.message = importantActionMessage(command);
    robot.trace.push(command.type === 'ACTION' ? `ACTION:${command.action}` : command.type === 'OUTCOME' ? `OUTCOME:${command.outcome}` : command.type);
    if (command.type === 'TERMINAL') robot.terminal = true;
    if (this.roundComplete && this.committedUpdates === 0) this.committedUpdates = 1;
    return command;
  }

  get roundComplete() { return this.robots.every(robot => robot.terminal); }
  get policyUpdateCount() { return this.committedUpdates; }
}

export class TrainingRuntimeController {
  robots: RobotRuntime[] = [];
  mainRobot = 1;
  history: TrainingSession;
  private run: ActualTrainingRun;
  private observationOffset = 0;
  private committedRound = false;
  private committedUpdates = 0;
  private readonly environment: ActualMapEnvironment;
  private readonly seed: number;
  private readonly totalRounds = 20;
  private selectedRewardWeights: RewardWeights;

  constructor(
    environment: ActualMapEnvironment,
    selectedRewardStars: RewardStars = DEFAULT_REWARD_STARS,
    seed = 42,
  ) {
    this.environment = environment;
    this.seed = seed;
    this.selectedRewardWeights = rewardWeightsFromStars(selectedRewardStars);
    this.run = runActualMapTraining(environment, this.selectedRewardWeights, seed, this.totalRounds, 5);
    this.history = {
      selectedRewardStars: { ...selectedRewardStars },
      resolvedRewardWeights: { ...this.selectedRewardWeights },
      rounds: [],
    };
    this.startCurrentRound();
  }

  get actualRound() { return OBSERVATION_ROUNDS[this.observationOffset]; }
  get observationIndex() { return this.observationOffset + 1; }
  get observationRound() { return this.actualRound; }
  get roundIndex() { return this.observationIndex; }
  get roundComplete() { return this.robots.every(robot => robot.terminal); }
  get trainingComplete() { return this.observationIndex === OBSERVATION_ROUNDS.length && this.roundComplete; }
  get policyUpdateCount() { return this.committedUpdates; }
  get combatSkillUpdateCount() { return this.committedUpdates; }
  get currentRound() { return this.run.rounds[this.actualRound - 1]; }
  get hiddenRoundsBeforeNextObservation(): HiddenRoundSummary[] {
    const nextObservationRound = OBSERVATION_ROUNDS[this.observationOffset + 1];
    if (!nextObservationRound) return [];
    return this.run.rounds.slice(this.actualRound, nextObservationRound - 1)
      .map(round => ({ round: round.round, robotCount: round.episodes.length }));
  }

  selectMain(robotId: number) {
    if (!this.robots.some(robot => robot.robot === robotId)) throw new Error(`Robot ${robotId} is unavailable`);
    this.mainRobot = robotId;
  }

  observeCommand(robotId: number, command: RuntimeCommand) {
    const robot = this.robots.find(candidate => candidate.robot === robotId);
    if (!robot || robot.terminal) return;
    const commandIndex = robot.commands.indexOf(command);
    if (commandIndex >= robot.cursor) robot.cursor = commandIndex + 1;
    robot.floor = command.type === 'FLOOR_TRANSITION' ? command.targetFloor : command.floor;
    robot.status = commandStatus(command);
    if (command.type === 'ACTION') robot.action = command.action;
    robot.message = importantActionMessage(command);
    robot.trace.push(robot.status);
    if (command.type === 'TERMINAL') {
      robot.terminal = true;
      robot.terminalReason = command.reason;
    }
    if (this.roundComplete) this.commitRound();
  }

  advance(robotId: number): RuntimeCommand | undefined {
    const robot = this.robots.find(candidate => candidate.robot === robotId);
    if (!robot || robot.terminal) return undefined;
    const command = robot.commands[robot.cursor];
    if (!command) return undefined;
    this.observeCommand(robotId, command);
    return command;
  }

  nextRound(): boolean {
    if (!this.roundComplete || this.trainingComplete) return false;
    this.observationOffset++;
    this.startCurrentRound();
    return true;
  }

  createEvaluation(seed = this.seed + 10_000): RobotRuntime {
    if (!this.trainingComplete) throw new Error('Training must finish before evaluation');
    const episode = runActualMapEvaluation(
      this.environment,
      this.run.finalPolicy,
      this.selectedRewardWeights,
      seed,
      undefined,
      this.run.finalCombatSkill,
    );
    return {
      robot: 1,
      episodeSeed: seed,
      floor: 1,
      cursor: 0,
      terminal: false,
      status: 'READY',
      message: '실전 임무 출발을 준비하고 있어요.',
      commands: createRuntimeCommands(this.environment, episode, seed),
      trace: [],
      episode,
    };
  }

  observeEvaluation(robot: RobotRuntime, command: RuntimeCommand) {
    if (robot.terminal) return;
    const commandIndex = robot.commands.indexOf(command);
    if (commandIndex >= robot.cursor) robot.cursor = commandIndex + 1;
    robot.floor = command.type === 'FLOOR_TRANSITION' ? command.targetFloor : command.floor;
    robot.status = commandStatus(command);
    if (command.type === 'ACTION') robot.action = command.action;
    robot.message = importantActionMessage(command);
    robot.trace.push(robot.status);
    if (command.type === 'TERMINAL') {
      robot.terminal = true;
      robot.terminalReason = command.reason;
    }
  }

  restart(selectedRewardStars: RewardStars = this.history.selectedRewardStars) {
    this.selectedRewardWeights = rewardWeightsFromStars(selectedRewardStars);
    this.run = runActualMapTraining(this.environment, this.selectedRewardWeights, this.seed, this.totalRounds, 5);
    this.observationOffset = 0;
    this.committedUpdates = 0;
    this.history = {
      selectedRewardStars: { ...selectedRewardStars },
      resolvedRewardWeights: { ...this.selectedRewardWeights },
      rounds: [],
    };
    this.startCurrentRound();
  }

  private startCurrentRound() {
    this.robots = createRobots(this.environment, this.currentRound, this.seed);
    this.mainRobot = 1;
    this.committedRound = false;
  }

  private commitRound() {
    if (this.committedRound) return;
    const round = this.currentRound;
    this.committedRound = true;
    this.committedUpdates = round.round;
    for (const completed of this.run.rounds.slice(this.history.rounds.length, round.round)) this.history.rounds.push({
      roundIndex: completed.round,
      policySnapshotBefore: structuredClone(completed.snapshot),
      robotResults: structuredClone(completed.episodes),
      policySnapshotAfter: structuredClone(completed.policyAfter),
      combatSkillSnapshot: completed.combatSkillSnapshot,
      combatSkillAfter: completed.combatSkillAfter,
    });
  }
}

