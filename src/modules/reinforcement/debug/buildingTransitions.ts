import { properties, type TiledObject } from './floor1Tiled.ts';

export type BuildingSceneData = {
  buildingMode?: boolean;
  entrySpawnId?: string;
  lastTransition?: string;
};

const SCENE_KEYS: Record<number, string> = {
  1: 'ReinforcementFloor1DebugScene',
  2: 'ReinforcementFloor2DebugScene',
  3: 'ReinforcementFloor3DebugScene',
  4: 'ReinforcementFloor4DebugScene',
  5: 'ReinforcementFloor5DebugScene',
};

export function resolveBuildingSpawn(spawns: TiledObject[], data: BuildingSceneData, floor: number, fallback: TiledObject) {
  if (!data.buildingMode || !data.entrySpawnId) return fallback;
  const matches = spawns.filter(spawn => properties(spawn).spawnId === data.entrySpawnId);
  if (matches.length !== 1) throw new Error(`Floor ${floor} building debug: targetSpawn "${data.entrySpawnId}" found ${matches.length} times`);
  return matches[0];
}

export function destinationForTransition(transition: TiledObject) {
  const values = properties(transition);
  const targetFloor = values.targetFloor;
  const targetSpawn = values.targetSpawn;
  if (typeof targetFloor !== 'number' || !SCENE_KEYS[targetFloor]) throw new Error(`${transition.name}: invalid targetFloor ${String(targetFloor)}`);
  if (typeof targetSpawn !== 'string' || !targetSpawn) throw new Error(`${transition.name}: invalid targetSpawn ${String(targetSpawn)}`);
  const lastTransition = `${String(values.stairId ?? transition.name)} → ${targetSpawn}`;
  return {
    targetFloor,
    targetSpawn,
    sceneKey: SCENE_KEYS[targetFloor],
    sceneData: { buildingMode: true, entrySpawnId: targetSpawn, lastTransition } satisfies BuildingSceneData,
  };
}

export class BuildingTransitionGate {
  private armed = false;

  reset() { this.armed = false; }

  consume(transition: TiledObject | null) {
    if (!transition) {
      this.armed = true;
      return null;
    }
    if (!this.armed) return null;
    this.armed = false;
    return destinationForTransition(transition);
  }
}
