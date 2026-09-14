import type { BehaviorState, CharacterDefinition, CharacterId, CharacterLabel, CharacterRuntimeState, WorldZone } from './characterPool.ts';
import { mapObjects, type GrayboxMap } from './plazaPark.ts';

export type CameraZone = Readonly<{ name: string; x: number; y: number; width: number; height: number }>;
export type ManualCharacterView = Readonly<{
  id: CharacterId;
  currentZone: WorldZone;
  currentBehavior: BehaviorState;
  userLabel: CharacterLabel | null;
}>;
export type ManualLabelingState = Readonly<{
  cctvs: readonly string[];
  selectedCctv: string | null;
  visibleCharacterIds: readonly CharacterId[];
  selectedCharacter: ManualCharacterView | null;
  manualLabeledDistinctCount: number;
  verifiedTrainingSampleCount: number;
  trainingReady: boolean;
}>;
export type ObservablePlazaNpc = Readonly<{
  definition: CharacterDefinition;
  character: CharacterRuntimeState;
  active: boolean;
  visible: boolean;
  position: Readonly<{ x:number; y:number }>;
}>;

export function loadCameraZones(map: GrayboxMap): readonly CameraZone[] {
  const zones = mapObjects(map, 'Camera_Zone').filter(object => object.type === 'Coverage');
  const expected = ['PLAZA_CAM_A','PLAZA_CAM_B','PLAZA_CAM_C','PLAZA_CAM_D','PLAZA_CAM_E'];
  if (zones.length !== expected.length || new Set(zones.map(zone => zone.name)).size !== expected.length || expected.some(name => !zones.some(zone => zone.name === name))) {
    throw new Error(`Camera_Zone must contain exactly PLAZA_CAM_A~E Coverage rectangles; found ${zones.map(zone=>zone.name).join(', ')}`);
  }
  for (const zone of zones) {
    if (!zone.name || ![zone.x, zone.y, zone.width, zone.height].every(Number.isFinite) || zone.width <= 0 || zone.height <= 0) {
      throw new Error(`Invalid Camera_Zone Coverage rectangle: ${zone.name || '(unnamed)'}`);
    }
  }
  return Object.freeze(expected.map(name => {
    const { x, y, width, height } = zones.find(zone => zone.name === name)!;
    return Object.freeze({ name, x, y, width, height });
  }));
}

export const isInsideCameraZone = (position: Readonly<{ x: number; y: number }>, zone: CameraZone) =>
  position.x >= zone.x && position.x < zone.x + zone.width && position.y >= zone.y && position.y < zone.y + zone.height;

export const visibleCharactersForZone = (npcs: readonly ObservablePlazaNpc[], zone: CameraZone) =>
  npcs.filter(npc => npc.active && npc.visible && isInsideCameraZone(npc.position, zone));

export function setUserLabel(runtime: CharacterRuntimeState, label: CharacterLabel) {
  runtime.labels.userLabel = label;
}

export const manualCharacterView = (npc: ObservablePlazaNpc): ManualCharacterView => Object.freeze({
  id: npc.character.identity.id,
  currentZone: npc.character.world.currentZone,
  currentBehavior: npc.character.world.currentBehavior,
  userLabel: npc.character.labels.userLabel,
});
