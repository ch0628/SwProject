import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CHARACTER_FRAME_COUNT,
  FACING_LIST,
  SPECIES_DISPLAY_HEIGHT,
  characterAppearance,
  characterAssetPath,
  characterRuntimeFrameSize,
  characterVisualAsset,
  characterVisualTexture,
  characterVisualVariant,
  characterWalkAnimationKey,
  characterWalkDirection,
} from '../src/characterManifest.ts';
import { CHARACTER_POOL, characterDefinition } from '../src/characterPool.ts';

function publicFile(path: string) {
  return new URL(`../public${path}`, import.meta.url);
}

function pngSize(path: string) {
  const data = readFileSync(publicFile(path));
  assert.equal(data.subarray(1, 4).toString(), 'PNG');
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

test('NPC number ranges select all 35 appearances exactly once', () => {
  assert.equal(CHARACTER_POOL.length, 35);
  assert.equal(characterAppearance('NPC01'), 'base');
  assert.equal(characterAppearance('NPC10'), 'base');
  assert.equal(characterAppearance('NPC11'), 'v01');
  assert.equal(characterAppearance('NPC20'), 'v01');
  assert.equal(characterAppearance('NPC21'), 'v02');
  assert.equal(characterAppearance('NPC30'), 'v02');
  assert.equal(characterAppearance('NPC31'), 'v03');
  assert.equal(characterAppearance('NPC35'), 'v03');
  assert.equal(characterVisualVariant('NPC01'), null);
  assert.equal(characterVisualVariant('NPC27'), 'v02');
  assert.throws(() => characterAppearance('NPC00'), /Unknown supervised character id/);

  const appearances = CHARACTER_POOL.map(definition =>
    `${definition.species}/${definition.gender}/${characterAppearance(definition.id)}`);
  assert.equal(new Set(appearances).size, 35);
});

test('NPC27 is Cat Female v02 for both idle and walk', () => {
  const definition = characterDefinition('NPC27')!;
  assert.deepEqual(
    (({ id, species, gender }) => ({ id, species, gender }))(definition),
    { id: 'NPC27', species: 'cat', gender: 'female' },
  );
  const visual = characterVisualAsset(definition.id, definition.species, definition.gender);
  assert.equal(visual.appearance, 'v02');
  assert.equal(visual.base.paths.down, '/assets/characters/world/cat/female/v02/base/cat_female_v02_down.png');
  assert.equal(visual.walk.paths.up, '/assets/characters/world/cat/female/v02/walk/cat_female_v02_walk_up.png');
  assert.equal(characterVisualTexture('NPC27', 'cat', 'female', 'left'), visual.base.keys.left);
  assert.equal(characterWalkAnimationKey('NPC27', 'cat', 'female', 'right'), visual.walk.keys.right);
});

test('all 35 idle and walking runtime assets exist with canonical dimensions', () => {
  for (const definition of CHARACTER_POOL) {
    const visual = characterVisualAsset(definition.id, definition.species, definition.gender);
    const expected = characterRuntimeFrameSize(definition.species);
    assert.equal(visual.frameCount, CHARACTER_FRAME_COUNT);
    for (const direction of FACING_LIST) {
      const idlePath = visual.base.paths[direction];
      const walkPath = visual.walk.paths[direction];
      assert.ok(existsSync(publicFile(idlePath)), `${definition.id} missing ${idlePath}`);
      assert.ok(existsSync(publicFile(walkPath)), `${definition.id} missing ${walkPath}`);
      assert.deepEqual(pngSize(idlePath), { width: expected.frameWidth, height: expected.frameHeight });
      assert.deepEqual(pngSize(walkPath), { width: expected.frameWidth * CHARACTER_FRAME_COUNT, height: expected.frameHeight });
    }
  }
});

test('walk direction applies to every species and gender', () => {
  for (const definition of CHARACTER_POOL) {
    assert.equal(characterWalkDirection(definition.species, definition.gender, -1, 0), 'left');
    assert.equal(characterWalkDirection(definition.species, definition.gender, 1, 0), 'right');
    assert.equal(characterWalkDirection(definition.species, definition.gender, 0, -1), 'up');
    assert.equal(characterWalkDirection(definition.species, definition.gender, 0, 1), 'down');
    assert.equal(characterWalkDirection(definition.species, definition.gender, 0, 0), null);
  }
});

test('species heights and shared non-supervised base paths stay stable', () => {
  assert.deepEqual(SPECIES_DISPLAY_HEIGHT, { rabbit: 105, cat: 126, fox: 126, dog: 147, tiger: 168 });
  assert.equal(characterAssetPath('fox', 'female', 'down'), '/assets/characters/fox/base/female/fox_female_down.png');
  assert.equal(characterAssetPath('cat', 'female', 'right'), '/assets/characters/cat/base/female/cat_female_right.png');
  assert.equal(characterAssetPath('tiger', 'male', 'up'), '/assets/characters/tiger/base/male/tiger_male_up.png');
});

test('Only production mode routing remains in application query handling', () => {
  const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../src/PlazaParkScene.ts', import.meta.url), 'utf8');
  assert.match(main, /mode === 'ai-basics'/);
  assert.match(main, /mode === 'supervised'/);
  assert.equal((main.match(/URLSearchParams/g) ?? []).length, 1);
  assert.equal((scene.match(/URLSearchParams/g) ?? []).length, 0);
});
