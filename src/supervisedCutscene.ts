import type { CharacterId, SemanticBehavior } from './characterPool';

export const SUPERVISED_CUTSCENE_REQUEST = 'supervised-cutscene-request';

export type SupervisedCutsceneMoment = 'CURRENT' | 'HISTORY';
export type SupervisedCutsceneRequest = Readonly<{
  npcId: CharacterId;
  behavior: SemanticBehavior;
  moment: SupervisedCutsceneMoment;
}>;
export type SupervisedCutscene = SupervisedCutsceneRequest & Readonly<{ imageUrl: string }>;

const CUTSCENE_IMAGES = Object.freeze({
  'NPC01:STEALING': new URL('../assets/characters/rabbit/cut_scene/rabbit_female_steal_cut.png', import.meta.url).href,
  'NPC06:SNATCHING': new URL('../assets/characters/rabbit/cut_scene/rabbit_male_snatch_cut.png', import.meta.url).href,
  'NPC06:STEALING': new URL('../assets/characters/rabbit/cut_scene/rabbit_male_steal_cut.png', import.meta.url).href,
  'NPC08:SNATCHING': new URL('../assets/characters/dog/cut_scene/dog_male_snatch_cut.png', import.meta.url).href,
  'NPC08:STEALING': new URL('../assets/characters/dog/cut_scene/dog_male_steal_cut.png', import.meta.url).href,
  'NPC10:THREATENING': new URL('../assets/characters/tiger/cut_scene/tiger_male_threaten_cut.png', import.meta.url).href,
  'NPC15:THREATENING': new URL('../assets/characters/tiger/cut_scene/tiger_female_v01_threaten_cut.png', import.meta.url).href,
  'NPC15:STEALING': new URL('../assets/characters/tiger/cut_scene/tiger_female_v01_steal_cut.png', import.meta.url).href,
  'NPC16:THREATENING': new URL('../assets/characters/rabbit/cut_scene/rabbit_male_v01_threaten_cut.png', import.meta.url).href,
  'NPC22:STEALING': new URL('../assets/characters/cat/cut_scene/cat_male_v02_steal_cut.png', import.meta.url).href,
  'NPC25:MANHOLE_TAMPER': new URL('../assets/characters/tiger/cut_scene/tiger_female_v02_manhole_tamper_cut.png', import.meta.url).href,
  'NPC26:STEALING': new URL('../assets/characters/rabbit/cut_scene/rabbit_male_v02_steal_cut.png', import.meta.url).href,
  'NPC26:SNATCHING': new URL('../assets/characters/rabbit/cut_scene/rabbit_male_v02_snatch_cut.png', import.meta.url).href,
  'NPC27:MANHOLE_TAMPER': new URL('../assets/characters/cat/cut_scene/cat_female_v02_manhole_tamper_cut.png', import.meta.url).href,
  'NPC31:STEALING': new URL('../assets/characters/rabbit/cut_scene/rabbit_female_v03_steal_cut.png', import.meta.url).href,
} satisfies Readonly<Record<string, string>>);

export function resolveSupervisedCutscene(request: SupervisedCutsceneRequest): SupervisedCutscene | null {
  const imageUrl = CUTSCENE_IMAGES[`${request.npcId}:${request.behavior}` as keyof typeof CUTSCENE_IMAGES];
  return imageUrl ? Object.freeze({ ...request, imageUrl }) : null;
}
