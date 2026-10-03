import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CAT_FEMALE_V01,
  CAT_FEMALE_WALK,
  catFemaleWalkAnimationKey,
  catFemaleWalkDirection,
  characterAssetPath,
  characterVisualTexture,
  characterVisualVariant,
  FACING_LIST,
} from '../src/characterManifest.ts';
import { characterDefinition } from '../src/characterPool.ts';

test('Character assets use canonical production paths', () => {
  assert.equal(characterAssetPath('fox', 'female', 'down'), '/assets/characters/fox/base/female/fox_female_down.png');
  assert.equal(characterAssetPath('cat', 'female', 'right'), '/assets/characters/cat/base/female/cat_female_right.png');
  assert.equal(characterAssetPath('tiger', 'male', 'up'), '/assets/characters/tiger/base/male/tiger_male_up.png');

  for (const direction of FACING_LIST) {
    assert.ok(existsSync(new URL(`../public${characterAssetPath('cat', 'female', direction)}`, import.meta.url)));
  }
});

test('Cat Female walk is default, four-directional, and isolated by species/gender', () => {
  assert.equal(catFemaleWalkDirection('cat', 'female', -1, 0), 'left');
  assert.equal(catFemaleWalkDirection('cat', 'female', 1, 0), 'right');
  assert.equal(catFemaleWalkDirection('cat', 'female', 0, -1), 'up');
  assert.equal(catFemaleWalkDirection('cat', 'female', 0, 1), 'down');
  assert.equal(catFemaleWalkDirection('cat', 'female', 1, -2), 'up');
  assert.equal(catFemaleWalkDirection('cat', 'female', -2, 1), 'left');
  assert.equal(catFemaleWalkDirection('cat', 'female', 0, 0), null);
  assert.equal(catFemaleWalkDirection('cat', 'male', 1, 0), null);
  assert.equal(catFemaleWalkDirection('fox', 'female', 1, 0), null);
  assert.equal(new Set(Object.values(CAT_FEMALE_WALK.keys)).size, 4);
  for (const direction of FACING_LIST) {
    const path = CAT_FEMALE_WALK.paths[direction];
    assert.equal(path, `/assets/characters/cat/animations/female/runtime/world/cat_female_walk_${direction}.png`);
    assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)));
  }
});

test('NPC27 alone uses Cat Female v01 static and walk visuals', () => {
  assert.equal(characterVisualVariant('NPC07'), null);
  assert.equal(characterVisualVariant('NPC17'), null);
  assert.equal(characterVisualVariant('NPC27'), 'v01');
  assert.equal(characterVisualTexture('NPC07', 'cat', 'female', 'down'), 'cat_female_down');
  assert.equal(characterVisualTexture('NPC17', 'cat', 'female', 'up'), 'cat_female_up');
  assert.equal(characterVisualTexture('NPC27', 'cat', 'female', 'down'), CAT_FEMALE_V01.base.keys.down);
  assert.equal(catFemaleWalkAnimationKey('NPC07', 'left'), CAT_FEMALE_WALK.keys.left);
  assert.equal(catFemaleWalkAnimationKey('NPC17', 'right'), CAT_FEMALE_WALK.keys.right);
  assert.equal(catFemaleWalkAnimationKey('NPC27', 'up'), CAT_FEMALE_V01.walk.keys.up);
  assert.deepEqual(
    (({ id, species, gender, verifiedLabel }) => ({ id, species, gender, verifiedLabel }))(characterDefinition('NPC27')!),
    { id: 'NPC27', species: 'cat', gender: 'female', verifiedLabel: 'CITIZEN' },
  );
  assert.equal(new Set([...Object.values(CAT_FEMALE_V01.base.keys), ...Object.values(CAT_FEMALE_V01.walk.keys)]).size, 8);
  for (const path of [...Object.values(CAT_FEMALE_V01.base.paths), ...Object.values(CAT_FEMALE_V01.walk.paths)]) {
    assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)));
  }
});

test('Only production mode routing remains in application query handling', () => {
  const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../src/PlazaParkScene.ts', import.meta.url), 'utf8');
  assert.match(main, /mode === 'ai-basics'/);
  assert.match(main, /mode === 'supervised'/);
  assert.equal((main.match(/URLSearchParams/g) ?? []).length, 1);
  assert.equal((scene.match(/URLSearchParams/g) ?? []).length, 0);
});
