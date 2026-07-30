'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { safeRelative, validateManifest, validatePetpack } = require('../src/petpack-validator');

const fixture = path.join(__dirname, '..', 'pets', 'packages', 'xiaogou.petpack');
assert.doesNotThrow(() => validatePetpack(fixture), 'reviewed demo package must validate');

function assertRejected(name, mutate, expected) {
  const output = path.join(os.tmpdir(), `desktop-pet-${process.pid}-${name}.petpack`);
  const zip = new AdmZip(fixture);
  mutate(zip);
  zip.writeZip(output);
  try { assert.throws(() => validatePetpack(output), expected); }
  finally { fs.rmSync(output, { force: true }); }
}

assertRejected('extra-file', (zip) => zip.addFile('private/notes.txt', Buffer.from('should not ship')), /未引用文件/);
assertRejected('case-collision', (zip) => zip.addFile('PET.JSON', Buffer.from('{}')), /重复或大小写冲突路径/);
assert.throws(() => safeRelative('private\\notes.txt'), /不安全的资源路径/);
assert.throws(() => safeRelative('../preview.png'), /不安全的资源路径/);
assertRejected('bad-preview', (zip) => {
  const manifest = JSON.parse(zip.readAsText('pet.json'));
  manifest.preview = 'preview.jpg';
  zip.updateFile('pet.json', Buffer.from(JSON.stringify(manifest)));
}, /preview 必须是 PNG/);

const interactionManifest = new AdmZip(fixture).getEntries()
  .find((entry) => entry.entryName === 'pet.json');
const manifest = JSON.parse(interactionManifest.getData().toString('utf8'));
manifest.interactionActions = {
  drag: { action: 'walk' },
  perch: { action: 'sit', anchor: { x: 0.5, y: 0.7 } }
};
assert.doesNotThrow(() => validateManifest(manifest));
manifest.interactionActions.perch.anchor.y = 1.1;
assert.throws(() => validateManifest(manifest), /anchor/);
manifest.interactionActions.perch.anchor.y = 0.7;
manifest.interactionActions.perch.action = 'missing';
assert.throws(() => validateManifest(manifest), /不存在/);
manifest.interactionActions.perch.action = 'sit';
manifest.interactionActions.unknown = { action: 'sit' };
assert.throws(() => validateManifest(manifest), /interactionActions/);
delete manifest.interactionActions.unknown;
manifest.interactionActions.perch.anchor = null;
assert.throws(() => validateManifest(manifest), /anchor/);
delete manifest.interactionActions.perch.anchor;
for (const inheritedAction of ['toString', 'constructor', '__proto__']) {
  manifest.interactionActions.drag.action = inheritedAction;
  assert.throws(() => validateManifest(manifest), /不存在/);
}
manifest.interactionActions.drag.action = 'climb';
manifest.animations.climb = {};
assert.throws(
  () => validateManifest(manifest),
  /climb/,
  'every interaction animation must receive full structural validation'
);
delete manifest.animations.climb;
manifest.interactionActions.drag.action = 'walk';

manifest.behavior = {
  random: [{ state: 'sleep', weight: 1, minDuration: 600, maxDuration: 1000 }]
};
assert.doesNotThrow(
  () => validateManifest(manifest),
  'schema-v1 validators must continue accepting legacy random sleep entries'
);

console.log('petpack archive security checks passed');
