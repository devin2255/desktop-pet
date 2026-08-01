'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const petpackPath = path.join(__dirname, '..', 'pets', 'packages', 'boss.petpack');
assert.ok(fs.existsSync(petpackPath), 'boss.petpack missing');

const zip = new AdmZip(petpackPath);
const manifest = JSON.parse(zip.readAsText('pet.json'));

assert.strictEqual(manifest.id, 'boss');
assert.strictEqual(manifest.name, '牛斯克', 'startup greeting uses pet name');
assert.strictEqual(manifest.speechGender, 'male', 'boss speech must prefer a male voice');
assert.ok(!manifest.behavior.random.some((item) => item.state === 'sleep'), 'behavior.random must not schedule sleep');

const menu = Object.fromEntries(manifest.contextMenuActions.map((item) => [item.id, item]));
assert.ok(menu['call-dad'], 'call-dad context action required');
assert.strictEqual(menu['call-dad'].message, '大爷!');
assert.strictEqual(menu['call-dad'].speech, '大爷');
assert.strictEqual(menu['call-dad'].speechAudio, 'audio/call-dad.mp3');
assert.ok(menu.kowtow, 'kowtow context action required');
assert.strictEqual(menu.kowtow.message, '给您磕头了');
assert.ok(menu['self-slap'], 'self-slap context action required');
assert.strictEqual(menu['self-slap'].label, '错了没?');
assert.strictEqual(menu['self-slap'].message, '我真该死');
assert.strictEqual(menu['self-slap'].speech, '我真该死');
assert.strictEqual(menu['self-slap'].speechAudio, 'audio/self-slap.mp3');

const roles = manifest.interactionActions;
assert.strictEqual(roles.drag.action, 'drag');
assert.ok(manifest.animations.drag, 'drag butt-scrape animation required');
assert.strictEqual(roles.recover.action, 'pat-butt');
assert.ok(roles.hang.anchor.y <= 0.12, 'hang anchor must keep hands near the top edge');
assert.ok(roles.perch.anchor.y >= 0.48 && roles.perch.anchor.y <= 0.56, 'perch butt contact should align with the top edge');

assert.ok(!manifest.animations['perch-swing'], 'perch-swing should be removed');
assert.ok(!manifest.animations['perch-nose'], 'perch-nose should be removed');
assert.ok(!manifest.animations['perch-cross'], 'perch-cross should be merged away');
assert.ok(!manifest.animations['perch-shoe-phone'], 'perch-shoe-phone should be merged away');
assert.ok(Array.isArray(manifest.behavior.perched) && manifest.behavior.perched.length >= 2, 'perched idle actions required');
for (const action of ['perch-cross-phone', 'perch-look']) {
  assert.ok(manifest.animations[action], `missing perched idle animation ${action}`);
}
const crossPhone = manifest.animations['perch-cross-phone'];
assert.ok(crossPhone.durations.reduce((sum, ms) => sum + ms, 0) >= 3000, 'cross-phone action should play slowly enough to read');
const crossPhoneBehavior = manifest.behavior.perched.find((item) => item.state === 'perch-cross-phone');
assert.strictEqual(crossPhoneBehavior?.message, '喂, 军儿吗?', 'cross-phone perched action needs dialogue text');

for (const action of ['idle', 'walk', 'sit', 'sleep', 'reaction', 'climb', 'perch', 'hang', 'fall', 'impact', 'pat-butt', 'call-dad', 'kowtow', 'self-slap', 'serve-tea']) {
  assert.ok(manifest.animations[action], `missing animation ${action}`);
  assert.ok(manifest.animations[action].frames.length >= 4, `${action} needs enough frames`);
}
const serveTea = manifest.behavior.random.find((item) => item.state === 'serve-tea');
assert.ok(serveTea, 'serve-tea should appear in roaming random behavior');
assert.strictEqual(serveTea.message, '大爷喝茶!', 'serve-tea roaming action needs dialogue text');

console.log('boss petpack regression checks passed');
