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
    down: '/assets/characters/runtime-test/world/cat/female/animation/walk/4lp/cat_female_walk_down.png',
    left: '/assets/characters/runtime-test/world/cat/female/animation/walk/4lp/cat_female_walk_left.png',
    right: '/assets/characters/runtime-test/world/cat/female/animation/walk/4lp/cat_female_walk_right.png',
    up: '/assets/characters/runtime-test/world/cat/female/animation/walk/4lp/cat_female_walk_up.png',
  }),
});

export const CAT_FEMALE_WALK_DOWN_V2 = Object.freeze({
  key: 'world-cat-female-walk-down-4lp-v2',
  path: '/assets/characters/runtime-test/world/cat/female/animation/walk/4lp-v2/cat_female_walk_down_2.png',
});

export function catFemaleWalkAnimationKey(direction: Facing, downV2 = false): string {
  return direction === 'down' && downV2 ? CAT_FEMALE_WALK_DOWN_V2.key : CAT_FEMALE_WALK.keys[direction];
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

export function characterAssetPath(species: Species, gender: Gender, facing: Facing, runtimeTest: string | null = null): string {
  const profile: Record<string, string> = {
    '1': '', '2': '/2x', '4': '/4x', '4n': '/4x', '6n': '/6x-nearest', '4l': '/4x-lanczos',
    '4lp': '/4x-lanczos-premultiplied', '4lps': '/4x-lanczos-premultiplied-sharp', '6l': '/6x-lanczos',
  };
  const crossValidation = gender === 'female' && (species === 'cat' || species === 'tiger') && (
    runtimeTest === `${species}-female-4lp` ||
    runtimeTest === 'cat-tiger-4lp'
  );
  const suffix = runtimeTest === null ? undefined : profile[runtimeTest];
  const folder = crossValidation
    ? `/assets/characters/runtime-test/world/${species}/female/4lp`
    : suffix !== undefined && species === 'fox' && gender === 'female'
    ? `/assets/characters/runtime-test/world/fox/female${suffix}`
    : `/assets/characters/${species}/base/${gender}`;
  return `${folder}/${species}_${gender}_${facing}.png`;
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
