'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { validateManifest, validatePetpack } = require('../src/petpack-validator');

const libraryDir = path.join(__dirname, '..', 'pets', 'library', 'guimi');
const petpackPath = path.join(__dirname, '..', 'pets', 'packages', 'guimi.petpack');
assert.ok(fs.existsSync(path.join(libraryDir, 'pet.json')));
assert.ok(fs.existsSync(petpackPath));

const libraryManifest = JSON.parse(fs.readFileSync(path.join(libraryDir, 'pet.json'), 'utf8'));
validateManifest(libraryManifest, libraryDir, true);
const zip = new AdmZip(petpackPath);
assert.deepStrictEqual(JSON.parse(zip.readAsText('pet.json')), libraryManifest);
const { manifest } = validatePetpack(petpackPath);

assert.strictEqual(manifest.id, 'guimi');
assert.strictEqual(manifest.name, '闺蜜桌宠');
assert.strictEqual(manifest.startupGreeting, '我们是闺蜜桌宠～今天也要一起玩。');
assert.ok(manifest.animations.crawl, 'crawl required for 跪爬模式');
assert.ok(manifest.animations['call-dad']);
assert.ok(manifest.animations.kowtow);
assert.ok(manifest.animations['kowtow-crawl']);
assert.ok(manifest.animations.drag);
assert.ok(manifest.animations.perch, 'perch required for top-edge sit');
assert.ok(manifest.animations.hang, 'hang required for bottom-edge cling');
assert.strictEqual(manifest.interactionActions?.climb?.enabled, false, 'side climb disabled');
assert.strictEqual(manifest.interactionActions?.perch?.action, 'perch');
assert.strictEqual(manifest.interactionActions?.hang?.action, 'hang');

const menu = Object.fromEntries(manifest.contextMenuActions.map((i) => [i.id, i]));
assert.ok(menu['call-dad'] && menu.kowtow && menu.feed && menu.relax && menu.selfie);
assert.strictEqual(menu['call-dad'].message, '爸！');
assert.strictEqual(menu.kowtow.message, '跪下了');
assert.ok(Array.isArray(menu.feed.randomActions) && menu.feed.randomActions.length >= 2);
assert.ok(menu.feed.randomActions.every((x) => String(x.sequence).startsWith('feed-poop')));
assert.strictEqual(menu.relax.sequence, 'relax');
const waitStages = (manifest.sequences.relax.stages || []).filter((s) => s.waitForClick === true);
assert.strictEqual(waitStages.length, 0, 'relax must not pause for click');
assert.ok(manifest.contextMenuActions.length <= 12);
console.log('test-guimi-petpack: ok');
