import fs from 'node:fs';
import { ACTUAL_GRAPH_FILE, ACTUAL_MAP_FILES, buildActualMapEnvironment } from '../../src/modules/reinforcement/sim/actualMapEnvironment.ts';
import {
  ACTUAL_ENVIRONMENT_PRODUCTION_V3,
  runActualMapEvaluation,
  runActualMapTraining,
} from '../../src/modules/reinforcement/sim/actualMapSimulation.ts';
import { rewardWeightsFromStars, type TerminalReason } from '../../src/modules/reinforcement/sim/learningEngine.ts';
import { createRuntimeCommands } from '../../src/modules/reinforcement/runtime/runtimeCommands.ts';
import { OBSERVATION_ROUNDS } from '../../src/modules/reinforcement/runtime/runtimeController.ts';

const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const environment = buildActualMapEnvironment(ACTUAL_MAP_FILES.map(readJson), readJson(ACTUAL_GRAPH_FILE));
const rewardStars = { speed: 1, judgment: 3, threat: 2 } as const;
const rewardWeights = rewardWeightsFromStars(rewardStars);
const trainingSeed = 42;
const evaluationEpisodes = 500;
const training = runActualMapTraining(environment, rewardWeights, trainingSeed, 20, 5, ACTUAL_ENVIRONMENT_PRODUCTION_V3);
const terminalReasons: TerminalReason[] = ['GOAL_REACHED', 'TIMEOUT', 'ROBOT_DISABLED', 'MISUNDERSTANDING'];

const checkpoints = OBSERVATION_ROUNDS.map(roundNumber => {
  const round = training.rounds[roundNumber - 1];
  const episodes = Array.from({ length: evaluationEpisodes }, (_, index) => runActualMapEvaluation(
    environment,
    round.policyAfter,
    rewardWeights,
    100_000 + roundNumber * 1_000 + index,
    ACTUAL_ENVIRONMENT_PRODUCTION_V3,
    round.combatSkillAfter,
  ));
  const terminalCounts = Object.fromEntries(terminalReasons.map(reason => [
    reason,
    episodes.filter(episode => episode.terminalReason === reason).length,
  ]));
  const subdueSelections = episodes.reduce((sum, episode) => sum + episode.actual.subdueSelections, 0);
  const subdueSuccesses = episodes.reduce((sum, episode) => sum + episode.actual.subdueSuccesses, 0);
  return {
    round: roundNumber,
    evaluationEpisodes,
    terminalCounts,
    goalRate: terminalCounts.GOAL_REACHED / evaluationEpisodes,
    averageSimulationTime: episodes.reduce((sum, episode) => sum + episode.elapsedTime, 0) / evaluationEpisodes,
    averageRobotDamage: episodes.reduce((sum, episode) => sum + episode.robotDamage, 0) / evaluationEpisodes,
    combatSkillSnapshot: round.combatSkillAfter,
    subdueSuccessRate: subdueSelections ? subdueSuccesses / subdueSelections : 0,
    bossReachRate: episodes.filter(episode => episode.actual.bossActions > 0).length / evaluationEpisodes,
    bossNeutralizationRate: episodes.filter(episode => episode.actual.bossNeutralized).length / evaluationEpisodes,
    bossRetreatSelections: episodes.reduce((sum, episode) => sum + episode.actionHistory.filter(action => action.state === 'BOSS_ENCOUNTER' && action.action === 'RETREAT').length, 0),
    bossNoBossReturnUsage: episodes.reduce((sum, episode, episodeIndex) => {
      const commands = createRuntimeCommands(environment, episode, 100_000 + roundNumber * 1_000 + episodeIndex);
      const bossFound = commands.findIndex(command => command.type === 'STATE_CHANGE' && command.change === 'BOSS_FOUND');
      if (bossFound < 0) return sum;
      return sum + commands.slice(bossFound + 1).filter(command => command.type === 'MOVE'
        && command.edgeIds.some(edgeId => environment.f5Rooms.some(room => room.noBossReturnEdgeId === edgeId))).length;
    }, 0),
  };
});

const output = {
  generatedAt: '2026-10-16',
  purpose: 'Topology-aware retreat and encounter presentation learning audit; no tuning performed',
  training: {
    seed: trainingSeed,
    rounds: 20,
    robotsPerRound: 5,
    rewardStars,
    rewardWeights,
    environment: 'ACTUAL_ENVIRONMENT_PRODUCTION_V3',
  },
  evaluation: {
    episodesPerCheckpoint: evaluationEpisodes,
    exploration: 0,
    seedFormula: '100000 + checkpointRound * 1000 + evaluationIndex',
    checkpoints,
  },
};

fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/topology_retreat_encounter_presentation_audit.json', `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
