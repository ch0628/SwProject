export type Species = 'rabbit' | 'cat' | 'fox' | 'dog' | 'tiger';
export type Gender = 'male' | 'female';
export type Facing = 'down' | 'left' | 'right' | 'up';
export type CharacterAppearance = 'base' | 'v01' | 'v02' | 'v03';

export const CHARACTER_FRAME_COUNT = 6;
export const CHARACTER_FRAME_RATE = 9;
export const CHARACTER_RUNTIME_PIXEL_DENSITY = 2;

/** Final in-game heights used by every supervised-learning character. */
export const SPECIES_DISPLAY_HEIGHT: Readonly<Record<Species, number>> = Object.freeze({
  rabbit: 105,
  cat: 126,
  fox: 126,
  dog: 147,
  tiger: 168,
});

const SOURCE_FRAME_WIDTH = 512;
const SOURCE_FRAME_HEIGHT = 682;

export function characterAppearance(characterId: string): CharacterAppearance {
  const match = /^NPC(\d{2})$/.exec(characterId);
  const number = match ? Number(match[1]) : 0;
  if (number >= 1 && number <= 10) return 'base';
  if (number >= 11 && number <= 20) return 'v01';
  if (number >= 21 && number <= 30) return 'v02';
  if (number >= 31 && number <= 35) return 'v03';
  throw new RangeError(`Unknown supervised character id: ${characterId}`);
}

export function characterVisualVariant(characterId: string): Exclude<CharacterAppearance, 'base'> | null {
  const appearance = characterAppearance(characterId);
  return appearance === 'base' ? null : appearance;
}

export function characterRuntimeFrameSize(species: Species) {
  const frameHeight = SPECIES_DISPLAY_HEIGHT[species] * CHARACTER_RUNTIME_PIXEL_DENSITY;
  return Object.freeze({
    frameWidth: Math.round(SOURCE_FRAME_WIDTH * frameHeight / SOURCE_FRAME_HEIGHT),
    frameHeight,
  });
}

function directional<T>(factory: (facing: Facing) => T): Readonly<Record<Facing, T>> {
  return Object.freeze({
    down: factory('down'),
    left: factory('left'),
    right: factory('right'),
    up: factory('up'),
  });
}

export function characterVisualAsset(characterId: string, species: Species, gender: Gender) {
  const appearance = characterAppearance(characterId);
  const prefix = `${species}_${gender}${appearance === 'base' ? '' : `_${appearance}`}`;
  const root = `/assets/characters/world/${species}/${gender}/${appearance}`;
  const textureRoot = `world-${species}-${gender}-${appearance}`;
  return Object.freeze({
    appearance,
    ...characterRuntimeFrameSize(species),
    frameCount: CHARACTER_FRAME_COUNT,
    frameRate: CHARACTER_FRAME_RATE,
    base: Object.freeze({
      keys: directional(facing => `${textureRoot}-${facing}`),
      paths: directional(facing => `${root}/base/${prefix}_${facing}.png`),
    }),
    walk: Object.freeze({
      keys: directional(facing => `${textureRoot}-walk-${facing}`),
      paths: directional(facing => `${root}/walk/${prefix}_walk_${facing}.png`),
    }),
  });
}

export function characterVisualTexture(
  characterId: string, species: Species, gender: Gender, facing: Facing,
): string {
  return characterVisualAsset(characterId, species, gender).base.keys[facing];
}

export function characterWalkDirection(
  _species: Species, _gender: Gender, dx: number, dy: number,
): Facing | null {
  if (Math.abs(dx) <= .001 && Math.abs(dy) <= .001) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

export function characterWalkAnimationKey(
  characterId: string, species: Species, gender: Gender, direction: Facing,
): string {
  return characterVisualAsset(characterId, species, gender).walk.keys[direction];
}

/** Shared base textures retained for smoke/debug actors outside the supervised game. */
export function characterTexture(species: Species, gender: Gender, facing: Facing): string {
  return `${species}_${gender}_${facing}`;
}

export function characterAssetPath(species: Species, gender: Gender, facing: Facing): string {
  return `/assets/characters/${species}/base/${gender}/${species}_${gender}_${facing}.png`;
}

export const SPECIES_LIST: Species[] = ['rabbit', 'cat', 'fox', 'dog', 'tiger'];
export const GENDER_LIST: Gender[] = ['male', 'female'];
export const FACING_LIST: Facing[] = ['down', 'left', 'right', 'up'];

export const NPC_VISUAL_ASSIGNMENT: { species: Species, gender: Gender }[] = [
  { species: 'rabbit', gender: 'male' },
  { species: 'rabbit', gender: 'female' },
  { species: 'cat', gender: 'male' },
  { species: 'cat', gender: 'female' },
  { species: 'fox', gender: 'male' },
  { species: 'fox', gender: 'female' },
  { species: 'dog', gender: 'male' },
  { species: 'dog', gender: 'female' },
  { species: 'tiger', gender: 'male' },
  { species: 'tiger', gender: 'female' },
];
