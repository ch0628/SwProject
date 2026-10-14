import { episodeSeed, type ProfileName } from '../sim/learningEngine.ts';
import type { ActualMapEnvironment } from '../sim/actualMapEnvironment.ts';
import { runActualMapProfile } from '../sim/actualMapSimulation.ts';
import { createRuntimeCommands, type RuntimeCommand } from './runtimeCommands.ts';

export type RobotRuntime = {
  robot: number;
  episodeSeed: number;
  floor: number;
  cursor: number;
  terminal: boolean;
  commands: RuntimeCommand[];
  trace: string[];
};

export class FiveRobotRuntimeController {
  readonly snapshotSignature: string;
  readonly robots: RobotRuntime[];
  private committedUpdates = 0;

  constructor(environment: ActualMapEnvironment, profile: ProfileName, seed: number) {
    const round = runActualMapProfile(environment, profile, seed, 1, 5).rounds[0];
    this.snapshotSignature = JSON.stringify(round.snapshot);
    this.robots = round.episodes.map((episode, index) => ({
      robot: index + 1,
      episodeSeed: episodeSeed(seed, 1, index + 1),
      floor: 1,
      cursor: 0,
      terminal: false,
      commands: createRuntimeCommands(environment, episode, episodeSeed(seed, 1, index + 1)),
      trace: [],
    }));
  }

  advance(robotId: number): RuntimeCommand | undefined {
    const robot = this.robots.find(candidate => candidate.robot === robotId);
    if (!robot || robot.terminal) return undefined;
    const command = robot.commands[robot.cursor++];
    if (!command) return undefined;
    robot.floor = command.type === 'FLOOR_TRANSITION' ? command.targetFloor : command.floor;
    robot.trace.push(command.type === 'ACTION' ? `ACTION:${command.action}` : command.type === 'OUTCOME' ? `OUTCOME:${command.outcome}` : command.type);
    if (command.type === 'TERMINAL') robot.terminal = true;
    if (this.roundComplete && this.committedUpdates === 0) this.committedUpdates = 1;
    return command;
  }

  get roundComplete() { return this.robots.every(robot => robot.terminal); }
  get policyUpdateCount() { return this.committedUpdates; }
}

