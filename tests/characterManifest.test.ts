import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { CAT_FEMALE_WALK, CAT_FEMALE_WALK_DOWN_V2, catFemaleWalkAnimationKey, catFemaleWalkDirection, characterAssetPath } from '../src/characterManifest.ts';

test('Character runtime profiles are opt-in and complete', () => {
  assert.equal(characterAssetPath('fox', 'female', 'down'), '/assets/characters/fox/base/female/fox_female_down.png');
  assert.equal(characterAssetPath('fox', 'female', 'down', 'invalid'), '/assets/characters/fox/base/female/fox_female_down.png');
  assert.equal(characterAssetPath('fox', 'female', 'down', '1'), '/assets/characters/runtime-test/world/fox/female/fox_female_down.png');
  assert.equal(characterAssetPath('fox', 'female', 'down', '2'), '/assets/characters/runtime-test/world/fox/female/2x/fox_female_down.png');
  assert.equal(characterAssetPath('fox', 'female', 'down', '4'), '/assets/characters/runtime-test/world/fox/female/4x/fox_female_down.png');
  assert.equal(characterAssetPath('fox', 'female', 'left', '4n'), '/assets/characters/runtime-test/world/fox/female/4x/fox_female_left.png');
  assert.equal(characterAssetPath('fox', 'female', 'right', '6n'), '/assets/characters/runtime-test/world/fox/female/6x-nearest/fox_female_right.png');
  assert.equal(characterAssetPath('fox', 'female', 'up', '4l'), '/assets/characters/runtime-test/world/fox/female/4x-lanczos/fox_female_up.png');
  assert.equal(characterAssetPath('fox', 'female', 'down', '4lp'), '/assets/characters/runtime-test/world/fox/female/4x-lanczos-premultiplied/fox_female_down.png');
  assert.equal(characterAssetPath('fox', 'female', 'left', '4lps'), '/assets/characters/runtime-test/world/fox/female/4x-lanczos-premultiplied-sharp/fox_female_left.png');
  assert.equal(characterAssetPath('fox', 'female', 'right', '6l'), '/assets/characters/runtime-test/world/fox/female/6x-lanczos/fox_female_right.png');
  assert.equal(characterAssetPath('fox', 'male', 'down', '4lps'), '/assets/characters/fox/base/male/fox_male_down.png');
  assert.equal(characterAssetPath('rabbit', 'female', 'up', '4lp'), '/assets/characters/rabbit/base/female/rabbit_female_up.png');
  assert.equal(characterAssetPath('cat', 'female', 'down', 'cat-female-4lp'), '/assets/characters/runtime-test/world/cat/female/4lp/cat_female_down.png');
  assert.equal(characterAssetPath('tiger', 'female', 'left', 'tiger-female-4lp'), '/assets/characters/runtime-test/world/tiger/female/4lp/tiger_female_left.png');
  assert.equal(characterAssetPath('cat', 'female', 'right', 'cat-tiger-4lp'), '/assets/characters/runtime-test/world/cat/female/4lp/cat_female_right.png');
  assert.equal(characterAssetPath('tiger', 'female', 'up', 'cat-tiger-4lp'), '/assets/characters/runtime-test/world/tiger/female/4lp/tiger_female_up.png');
  assert.equal(characterAssetPath('cat', 'male', 'down', 'cat-tiger-4lp'), '/assets/characters/cat/base/male/cat_male_down.png');
  assert.equal(characterAssetPath('fox', 'female', 'down', 'cat-tiger-4lp'), '/assets/characters/fox/base/female/fox_female_down.png');
  assert.equal(characterAssetPath('rabbit', 'female', 'up', 'rabbit-female-4lp'), '/assets/characters/rabbit/base/female/rabbit_female_up.png');

  for (const profile of ['2x', '4x', '6x-nearest', '4x-lanczos', '4x-lanczos-premultiplied', '4x-lanczos-premultiplied-sharp', '6x-lanczos']) for (const direction of ['down', 'left', 'right', 'up']) {
    assert.ok(existsSync(new URL(`../public/assets/characters/runtime-test/world/fox/female/${profile}/fox_female_${direction}.png`, import.meta.url)));
  }
  for (const species of ['cat', 'tiger']) for (const direction of ['down', 'left', 'right', 'up']) {
    assert.ok(existsSync(new URL(`../public/assets/characters/runtime-test/world/${species}/female/4lp/${species}_female_${direction}.png`, import.meta.url)));
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
  assert.equal(catFemaleWalkAnimationKey('down'), CAT_FEMALE_WALK.keys.down);
  assert.equal(catFemaleWalkAnimationKey('down', true), CAT_FEMALE_WALK_DOWN_V2.key);
  assert.equal(catFemaleWalkAnimationKey('left', true), CAT_FEMALE_WALK.keys.left);
  assert.notEqual(CAT_FEMALE_WALK_DOWN_V2.key, CAT_FEMALE_WALK.keys.down);
  assert.ok(existsSync(new URL(`../public${CAT_FEMALE_WALK_DOWN_V2.path}`, import.meta.url)));
  assert.equal(new Set(Object.values(CAT_FEMALE_WALK.keys)).size, 4);
  for (const path of Object.values(CAT_FEMALE_WALK.paths)) {
    assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)));
  }
});
