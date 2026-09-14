export type Species = 'rabbit' | 'cat' | 'fox' | 'dog' | 'tiger';
export type Gender = 'male' | 'female';
export type Facing = 'down' | 'left' | 'right' | 'up';

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
