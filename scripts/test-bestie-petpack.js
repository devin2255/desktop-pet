'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { validateManifest, validatePetpack } = require('../src/petpack-validator');

const libraryDir = path.join(__dirname, '..', 'pets', 'library', 'xiaomei-xiaotian');
const petpackPath = path.join(__dirname, '..', 'pets', 'packages', 'xiaomei-xiaotian.petpack');

assert.ok(fs.existsSync(path.join(libraryDir, 'pet.json')), 'library pet.json missing');
assert.ok(fs.existsSync(petpackPath), 'xiaomei-xiaotian.petpack missing');

const libraryManifest = JSON.parse(fs.readFileSync(path.join(libraryDir, 'pet.json'), 'utf8'));
validateManifest(libraryManifest, libraryDir, true);

const zip = new AdmZip(petpackPath);
const packagedManifest = JSON.parse(zip.readAsText('pet.json'));
assert.deepStrictEqual(
  packagedManifest,
  libraryManifest,
  'packaged pet.json must exactly match the library source manifest'
);

const { manifest } = validatePetpack(petpackPath);

assert.strictEqual(manifest.id, 'xiaomei-xiaotian');
assert.strictEqual(manifest.name, '小美&小甜');
assert.strictEqual(manifest.startupGreeting, '我们是小美和小甜～今天也要一起加油鸭。');
assert.deepStrictEqual(manifest.personality, ['温柔黏人', '活泼外向', '闺蜜']);
assert.strictEqual(manifest.speechGender, 'female');

assert.ok(manifest.animations.drag, 'drag animation required');
assert.strictEqual(manifest.interactionActions?.drag?.action, 'drag');

const menu = Object.fromEntries(manifest.contextMenuActions.map((item) => [item.id, item]));
assert.ok(menu.relax, 'relax context action required');
assert.strictEqual(menu.relax.sequence, 'relax');
assert.ok(menu.relax.action === undefined, 'relax menu must use sequence XOR action');
assert.ok(menu.cuddle && menu.selfie && menu.whisper && menu.cheer && menu.nap, 'expected bestie menu items');

const selfieMenu = manifest.contextMenuActions.find((item) => item.id === 'selfie');
assert.strictEqual(selfieMenu.sequence, 'selfie-banter');
assert.ok(!Object.hasOwn(selfieMenu, 'action'));
assert.deepStrictEqual(manifest.sequences['selfie-banter'].stages, [
  { action: 'selfie', message: '我站后面！', duration: 1200 },
  { action: 'selfie', message: '不行，后面显脸小！', duration: 1600 },
  { action: 'selfie', message: '那一起往后挤～', duration: 1800 },
  { action: 'idle', duration: 0 }
]);

const stages = manifest.sequences?.relax?.stages;
assert.ok(Array.isArray(stages) && stages.length >= 2, 'sequences.relax.stages required');
const waitStages = stages.filter((stage) => stage.waitForClick === true);
assert.strictEqual(waitStages.length, 1, 'exactly one waitForClick stage required');
assert.deepStrictEqual(waitStages[0].messages, ['我要这个', '我要这个']);
assert.strictEqual(waitStages[0].action, 'relax-models');
assert.strictEqual(manifest.animations['relax-models']?.holdLastFrame, true);

const randomStates = new Set(manifest.behavior.random.map((item) => item.state));
for (const banned of ['selfie', 'cheer', 'relax']) {
  assert.ok(!randomStates.has(banned), `behavior.random must not include ${banned}`);
}

const weights = Object.fromEntries(manifest.behavior.random.map((item) => [item.state, item.weight]));
assert.strictEqual(weights.walk, 32);
assert.strictEqual(weights.sit, 24);
assert.strictEqual(weights.reaction, 16);
assert.strictEqual(weights.sleep, 12);
assert.strictEqual(weights.cuddle, 10);
assert.strictEqual(weights.whisper, 6);

for (const action of [
  'idle', 'walk', 'sit', 'sleep', 'reaction', 'drag', 'perch-milk-tea',
  'cuddle', 'selfie', 'whisper', 'cheer',
  'relax-makeup', 'relax-dress', 'relax-run', 'relax-models', 'relax-hug', 'relax-shy'
]) {
  assert.ok(manifest.animations[action], `missing animation ${action}`);
}

assert.strictEqual(manifest.interactionActions?.perch?.action, 'perch-milk-tea');
assert.ok(
  (manifest.behavior?.perched || []).some((item) => item.state === 'perch-milk-tea' && item.weight >= 50),
  'perched behavior should favor perch-milk-tea'
);
assert.strictEqual(manifest.animations['perch-milk-tea'].frames.length, 6);
assert.strictEqual(manifest.animations['perch-milk-tea'].loop, true);
assert.deepStrictEqual(
  manifest.animations['perch-milk-tea'].durations,
  [600, 650, 850, 650, 650, 600]
);
assert.strictEqual(manifest.animations['perch-milk-tea'].holdLastFrame, false);

assert.ok(manifest.animations['climb-peek'], 'climb-peek animation required');
assert.strictEqual(manifest.interactionActions?.climb?.action, 'climb-peek');
assert.strictEqual(manifest.animations['climb-peek'].frames.length, 6);
assert.strictEqual(manifest.animations['climb-peek'].holdLastFrame, true);

assert.strictEqual(packagedManifest.id, 'xiaomei-xiaotian');

console.log('test-bestie-petpack: ok');
