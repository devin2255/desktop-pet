'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const libraryManifestPath = path.join(__dirname, '..', 'pets', 'library', 'brother-duo', 'pet.json');
const petpackPath = path.join(__dirname, '..', 'pets', 'packages', 'brother-duo.petpack');

assert.ok(fs.existsSync(libraryManifestPath), 'library pet.json missing');
const library = JSON.parse(fs.readFileSync(libraryManifestPath, 'utf8'));

assert.strictEqual(library.id, 'brother-duo');
assert.strictEqual(library.name, '兄弟桌宠 Duo');
assert.strictEqual(library.startupGreeting, '爸，兄弟 Duo 来了！');

assert.ok(library.duo && Array.isArray(library.duo.members) && library.duo.members.length === 2);
const bySide = Object.fromEntries(library.duo.members.map((member) => [member.side, member]));
assert.strictEqual(bySide.left.id, 'judge');
assert.strictEqual(bySide.right.id, 'floral');
assert.strictEqual(bySide.left.watch, true);
assert.strictEqual(bySide.right.watch, false);

for (const action of ['idle', 'walk', 'sit', 'sleep', 'reaction', 'drag']) {
  assert.ok(library.animations[action], `root missing ${action}`);
  assert.ok(bySide.left.animations[action], `judge missing ${action}`);
  assert.ok(bySide.right.animations[action], `floral missing ${action}`);
}
assert.ok(library.animations.crawl, 'folded duo missing crawl');
assert.strictEqual(library.animations.crawl.frames.length, 6);
assert.ok(bySide.left.animations.crawl, 'judge missing crawl');
assert.ok(bySide.right.animations.crawl, 'floral missing crawl');
assert.strictEqual(bySide.right.animations.crawl.frames.length, 6);
assert.strictEqual(library.animations.crawl.scale, 1, 'folded crawl stays full size');
assert.strictEqual(bySide.left.animations.crawl.scale, 0.62, 'judge crawl must match folded per-person size');
assert.strictEqual(bySide.right.animations.crawl.scale, 0.62, 'floral crawl must match folded per-person size');

const windowRoles = ['climb', 'perch', 'hang', 'fall', 'impact', 'recover'];
for (const action of windowRoles) {
  assert.ok(library.animations[action], `folded duo missing ${action}`);
  assert.ok(bySide.left.animations[action], `judge missing ${action}`);
  assert.ok(bySide.right.animations[action], `floral missing ${action}`);
}
for (const role of windowRoles) {
  assert.strictEqual(library.interactionActions?.[role]?.action, role, `folded missing ${role} interaction`);
  assert.strictEqual(bySide.left.interactionActions?.[role]?.action, role, `judge missing ${role} interaction`);
  assert.strictEqual(bySide.right.interactionActions?.[role]?.action, role, `floral missing ${role} interaction`);
}

const foldedMenu = Object.fromEntries((library.contextMenuActions || []).map((item) => [item.label, item]));
assert.ok(foldedMenu['叫爸'], 'folded menu missing 叫爸');
assert.ok(foldedMenu['磕头'], 'folded menu missing 磕头');
assert.ok(foldedMenu['睡会儿'], 'folded menu missing 睡会儿');
assert.ok(foldedMenu['支起来'] && foldedMenu['支起来'].id === 'duo-tent', 'folded menu missing 支起来');
assert.ok(foldedMenu['摸会儿鱼'] && foldedMenu['摸会儿鱼'].id === 'duo-slack', 'folded menu missing 摸会儿鱼');
assert.strictEqual(
  (library.contextMenuActions || []).filter((item) => item.id === 'duo-slack').length,
  1,
  'folded menu should list 摸会儿鱼 once'
);
assert.ok(library.duo.tent && library.duo.tent.action === 'sit', 'duo.tent must use root sit');
assert.strictEqual(library.duo.tent.enterLabel, '支起来');
assert.strictEqual(library.duo.tent.leaveLabel, '收起来');
assert.ok(library.duo.slack, 'duo.slack missing');
assert.strictEqual(library.duo.slack.jumpAction, 'slack-jump');
assert.strictEqual(library.duo.slack.carryAction, 'slack-carry');
assert.strictEqual(library.animations['slack-jump']?.scale, 1, 'slack-jump stays CSS scale 1 so sitters can sit at the sides');
assert.strictEqual(library.animations['slack-carry']?.scale, 1, 'slack-carry stays CSS scale 1 so sitters can sit at the sides');
assert.strictEqual(library.animations['slack-jump']?.loop, false, 'slack-jump must not loop');
assert.strictEqual(library.animations['slack-jump']?.frames.length, 4, 'slack-jump needs 4 frames');
assert.strictEqual(library.animations['slack-carry']?.loop, true, 'slack-carry must loop');
assert.strictEqual(library.animations['slack-carry']?.frames.length, 4, 'slack-carry needs 4 frames');
assert.deepStrictEqual(library.duo.slack.clips, [
  'video/slack/feishu-20260915.mp4',
  'video/slack/sweet-outfit-720p.mp4',
  'video/slack/feishu-20260803.mp4'
], 'duo.slack should cycle three muted clips');
for (const clip of library.duo.slack.clips) {
  assert.match(clip, /^video\/slack\/.+\.(mp4|webm)$/, `unexpected slack clip path ${clip}`);
  const clipPath = path.join(__dirname, '..', 'pets', 'library', 'brother-duo', clip);
  assert.ok(fs.existsSync(clipPath), `missing slack clip ${clip}`);
  const bytes = fs.statSync(clipPath).size;
  assert.ok(bytes > 20_000, `slack clip too small ${clip}`);
  assert.ok(bytes < 6_000_000, `slack clip too heavy for Chromium (${clip}: ${bytes} bytes)`);
}

const floralMenu = bySide.right.contextMenuActions || [];
assert.ok(!floralMenu.some((item) => item.id === 'watch' || /雷达|watch/i.test(item.label || '')), 'floral menu must not include watch');
assert.ok(floralMenu.some((item) => item.id === 'duo-fold' && item.label === '合上'), 'floral menu missing duo-fold');

const { spawnSync } = require('child_process');
const spread = spawnSync('python', [path.join(__dirname, 'test-slack-sitter-spread.py')], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8'
});
assert.strictEqual(spread.status, 0, spread.stderr || spread.stdout || 'slack sitter spread check failed');

assert.ok(fs.existsSync(petpackPath), 'brother-duo.petpack missing');
const zip = new AdmZip(petpackPath);
const packed = JSON.parse(zip.readAsText('pet.json'));
assert.deepStrictEqual(packed, library, 'library and petpack pet.json must match');

console.log('test-brother-duo-petpack: ok');
