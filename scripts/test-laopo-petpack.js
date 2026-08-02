'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const petpackPath = path.join(__dirname, '..', 'pets', 'packages', 'laopo.petpack');
assert.ok(fs.existsSync(petpackPath), 'laopo.petpack missing');

const zip = new AdmZip(petpackPath);
const manifest = JSON.parse(zip.readAsText('pet.json'));

assert.strictEqual(manifest.id, 'laopo');
assert.strictEqual(manifest.name, '老婆');
assert.strictEqual(manifest.speechGender, 'female', 'laopo speech must prefer a female voice');
assert.strictEqual(manifest.startupGreeting, '老公，我来啦~');
assert.ok(!manifest.behavior.random.some((item) => item.state === 'sleep'), 'behavior.random must not schedule sleep');

const menu = Object.fromEntries(manifest.contextMenuActions.map((item) => [item.id, item]));
assert.ok(menu['call-hubby'], 'call-hubby context action required');
assert.strictEqual(menu['call-hubby'].message, '老公!');
assert.strictEqual(menu['call-hubby'].speech, '老公');
assert.strictEqual(menu['call-hubby'].speechAudio, 'audio/call-hubby.mp3');
assert.ok(menu.kowtow, 'kowtow context action required');
assert.strictEqual(menu.kowtow.message, '给老公磕头了');
assert.ok(menu['talent-show'], 'talent-show context action required');
assert.strictEqual(menu['talent-show'].message, '上才艺!');
assert.strictEqual(menu['talent-show'].speech, '上才艺');
assert.strictEqual(menu['talent-show'].speechAudio, 'audio/talent-show.mp3');
assert.ok(menu['talent-show'].duration >= 5000, 'talent-show menu duration should be longer');
const talent = manifest.animations['talent-show'];
assert.ok(talent.frames.length >= 12, 'talent-show needs a longer 12-frame dance');
assert.ok(talent.durations.reduce((sum, ms) => sum + ms, 0) >= 4000, 'talent-show animation should play longer');

assert.ok(!menu['call-dad'], 'call-dad must not exist on laopo');
assert.ok(!menu['self-slap'], 'self-slap must not exist on laopo');
assert.ok(!manifest.animations['call-dad'], 'call-dad animation must not exist');
assert.ok(!manifest.animations['self-slap'], 'self-slap animation must not exist');
assert.ok(!manifest.animations['perch-cross-phone'], 'perch-cross-phone must not exist');

assert.ok(Array.isArray(manifest.behavior.perched) && manifest.behavior.perched.length >= 2, 'perched idle actions required');
for (const action of ['perch-hair-flip', 'perch-blow-kiss', 'perch-look']) {
  assert.ok(manifest.animations[action], `missing perched idle animation ${action}`);
  assert.ok(manifest.behavior.perched.some((item) => item.state === action), `perched behavior missing ${action}`);
}

const randomByState = Object.fromEntries(manifest.behavior.random.map((item) => [item.state, item]));
for (const [state, message, speech, speechAudio] of [
  ['serve-tea', '老公喝茶', '老公喝茶', 'audio/serve-tea.mp3'],
  ['love-you', '爱你老公', '爱你老公', 'audio/love-you.mp3'],
  ['praise', '宝贝真棒', '宝贝真棒', 'audio/praise.mp3'],
  ['encourage', '老公辛苦了', '老公辛苦了', 'audio/encourage.mp3'],
]) {
  const item = randomByState[state];
  assert.ok(item, `${state} should appear in roaming random behavior`);
  assert.strictEqual(item.message, message, `${state} roaming message`);
  assert.strictEqual(item.speech, speech, `${state} roaming speech`);
  assert.strictEqual(item.speechAudio, speechAudio, `${state} roaming speechAudio`);
}

for (const action of [
  'idle', 'walk', 'sit', 'sleep', 'reaction',
  'climb', 'perch', 'hang', 'fall', 'impact', 'pat-butt',
  'call-hubby', 'kowtow', 'talent-show', 'serve-tea',
  'love-you', 'praise', 'encourage',
]) {
  assert.ok(manifest.animations[action], `missing animation ${action}`);
  assert.ok(manifest.animations[action].frames.length >= 4, `${action} needs enough frames`);
}

console.log('laopo petpack regression checks passed');
