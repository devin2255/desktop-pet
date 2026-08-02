'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const petpackPath = path.join(__dirname, '..', 'pets', 'packages', 'medusa.petpack');
assert.ok(fs.existsSync(petpackPath), 'medusa.petpack missing');

const zip = new AdmZip(petpackPath);
const manifest = JSON.parse(zip.readAsText('pet.json'));

assert.strictEqual(manifest.id, 'medusa');
assert.strictEqual(manifest.name, '美杜莎');
assert.strictEqual(manifest.speechGender, 'female');
assert.strictEqual(manifest.startupGreeting, '本女王来了。');
assert.ok(!manifest.behavior.random.some((item) => item.state === 'sleep'), 'behavior.random must not schedule sleep');
assert.ok(!manifest.behavior.random.some((item) => item.state === 'heaven-python'), 'heaven-python must not be in random pool');

const menu = Object.fromEntries(manifest.contextMenuActions.map((item) => [item.id, item]));
assert.ok(menu['cold-smile'], 'cold-smile required');
assert.strictEqual(menu['cold-smile'].message, '哼。');
assert.strictEqual(menu['cold-smile'].speechAudio, 'audio/cold-smile.mp3');
assert.ok(menu['heaven-python'], 'heaven-python required');
assert.strictEqual(menu['heaven-python'].message, '吞天。');
assert.strictEqual(menu['heaven-python'].speechAudio, 'audio/heaven-python.mp3');
assert.ok(menu['kneel-before-me'], 'kneel-before-me required');
assert.strictEqual(menu['kneel-before-me'].message, '跪下。');

assert.ok(!menu['call-hubby'], 'laopo call-hubby must not exist');
assert.ok(!menu.kowtow, 'laopo kowtow must not exist');
assert.ok(!menu['talent-show'], 'laopo talent-show must not exist');
assert.ok(!manifest.animations['call-hubby']);
assert.ok(!manifest.animations['talent-show']);
assert.ok(!manifest.animations['serve-tea']);

for (const action of ['perch-chin-rest', 'perch-hair-sweep', 'perch-look']) {
  assert.ok(manifest.animations[action], `missing ${action}`);
  assert.ok(manifest.behavior.perched.some((item) => item.state === action), `perched missing ${action}`);
}

const randomByState = Object.fromEntries(manifest.behavior.random.map((item) => [item.state, item]));
for (const [state, message, speech, speechAudio] of [
  ['inspect', '看你表现', '看你表现', 'audio/inspect.mp3'],
  ['command', '侍奉本座', '侍奉本座', 'audio/command.mp3'],
  ['smirk-line', '有趣', '有趣', 'audio/smirk-line.mp3'],
]) {
  const item = randomByState[state];
  assert.ok(item, `${state} should appear in roaming random behavior`);
  assert.strictEqual(item.message, message);
  assert.strictEqual(item.speech, speech);
  assert.strictEqual(item.speechAudio, speechAudio);
}

for (const action of [
  'idle', 'walk', 'sit', 'sleep', 'reaction',
  'climb', 'perch', 'hang', 'fall', 'impact', 'pat-butt',
  'cold-smile', 'heaven-python', 'kneel-before-me',
  'inspect', 'command', 'smirk-line',
]) {
  assert.ok(manifest.animations[action], `missing animation ${action}`);
  assert.ok(manifest.animations[action].frames.length >= 4, `${action} needs enough frames`);
}

console.log('medusa petpack regression checks passed');
