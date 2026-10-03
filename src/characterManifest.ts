export type Species = 'rabbit' | 'cat' | 'fox' | 'dog' | 'tiger';
export type Gender = 'male' | 'female';
export type Facing = 'down' | 'left' | 'right' | 'up';

export const CAT_FEMALE_WALK = Object.freeze({
  frameWidth: 378,
  frameHeight: 504,
  frameCount: 6,
  frameRate: 9,
  keys: Object.freeze({
    down: 'world-cat-female-walk-down-4lp',
    left: 'world-cat-female-walk-left-4lp',
    right: 'world-cat-female-walk-right-4lp',
    up: 'world-cat-female-walk-up-4lp',
  }),
  paths: Object.freeze({
    down: '/assets/characters/cat/animations/female/runtime/world/cat_female_walk_down.png',
    left: '/assets/characters/cat/animations/female/runtime/world/cat_female_walk_left.png',
    right: '/assets/characters/cat/animations/female/runtime/world/cat_female_walk_right.png',
    up: '/assets/characters/cat/animations/female/runtime/world/cat_female_walk_up.png',
  }),
});

export const CAT_FEMALE_V01 = Object.freeze({
  id: 'v01',
  base: Object.freeze({
    keys: Object.freeze({
      down: 'world-cat-female-v01-down-4lp',
      left: 'world-cat-female-v01-left-4lp',
      right: 'world-cat-female-v01-right-4lp',
      up: 'world-cat-female-v01-up-4lp',
    }),
    paths: Object.freeze({
      down: '/assets/characters/world/cat/female/v01/base/cat_female_v01_down.png',
      left: '/assets/characters/world/cat/female/v01/base/cat_female_v01_left.png',
      right: '/assets/characters/world/cat/female/v01/base/cat_female_v01_right.png',
      up: '/assets/characters/world/cat/female/v01/base/cat_female_v01_up.png',
    }),
  }),
  walk: Object.freeze({
    keys: Object.freeze({
      down: 'world-cat-female-v01-walk-down-4lp',
      left: 'world-cat-female-v01-walk-left-4lp',
      right: 'world-cat-female-v01-walk-right-4lp',
      up: 'world-cat-female-v01-walk-up-4lp',
    }),
    paths: Object.freeze({
      down: '/assets/characters/world/cat/female/v01/walk/cat_female_v01_walk_down.png',
      left: '/assets/characters/world/cat/female/v01/walk/cat_female_v01_walk_left.png',
      right: '/assets/characters/world/cat/female/v01/walk/cat_female_v01_walk_right.png',
      up: '/assets/characters/world/cat/female/v01/walk/cat_female_v01_walk_up.png',
    }),
  }),
});

export function characterVisualVariant(characterId: string): 'v01' | null {
  return characterId === 'NPC27' ? 'v01' : null;
}

export function characterVisualTexture(
  characterId: string, species: Species, gender: Gender, facing: Facing,
): string {
  return characterVisualVariant(characterId) === 'v01' && species === 'cat' && gender === 'female'
    ? CAT_FEMALE_V01.base.keys[facing]
    : characterTexture(species, gender, facing);
}

export function catFemaleWalkAnimationKey(characterId: string, direction: Facing): string {
  return characterVisualVariant(characterId) === 'v01'
    ? CAT_FEMALE_V01.walk.keys[direction]
    : CAT_FEMALE_WALK.keys[direction];
}

export function catFemaleWalkDirection(
  species: Species, gender: Gender, dx: number, dy: number,
): Facing | null {
  if (species !== 'cat' || gender !== 'female' || Math.abs(dx) <= .001 && Math.abs(dy) <= .001) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

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
  { species: 'rabbit', gender: 'male' },   // NPC 1 (index 0)
  { species: 'rabbit', gender: 'female' }, // NPC 2
  { species: 'cat', gender: 'male' },      // NPC 3
  { species: 'cat', gender: 'female' },    // NPC 4
  { species: 'fox', gender: 'male' },      // NPC 5
  { species: 'fox', gender: 'female' },    // NPC 6
  { species: 'dog', gender: 'male' },      // NPC 7
  { species: 'dog', gender: 'female' },    // NPC 8
  { species: 'tiger', gender: 'male' },    // NPC 9
  { species: 'tiger', gender: 'female' }   // NPC 10
];
