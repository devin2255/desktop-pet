'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { referencedFiles, safeRelative, validateManifest, validatePetpack } = require('../src/petpack-validator');

const fixture = path.join(__dirname, '..', 'pets', 'packages', 'laopo.petpack');
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

manifest.behavior = {
  random: [{
    state: 'sit',
    weight: 1,
    minDuration: 600,
    maxDuration: 1000,
    speechAudio: 'audio/roam.mp3'
  }]
};
assert.ok(referencedFiles(manifest).has('audio/roam.mp3'), 'behavior.random speechAudio must be referenced');
assert.doesNotThrow(() => validateManifest(manifest));
manifest.behavior.random[0].speechAudio = 'audio/roam.txt';
assert.throws(() => validateManifest(manifest), /speechAudio/);
manifest.behavior.random[0].speechAudio = 'audio/roam.mp3';
manifest.behavior.perched = [{
  state: 'sit',
  weight: 1,
  minDuration: 600,
  maxDuration: 1000,
  speechAudio: 'audio/perched.mp3'
}];
assert.ok(referencedFiles(manifest).has('audio/perched.mp3'), 'behavior.perched speechAudio must be referenced');
assert.doesNotThrow(() => validateManifest(manifest));

// --- watch field ---
// watch is optional and carries no asset paths: referencedFiles must not include it.
manifest.watch = {
  keywords: { '画饼': ['年底给你画饼了', '明年升职加薪'], '吹牛': ['老板又开始吹牛了'] },
  fallback: '先把手头活干完再说',
  state: 'reaction'
};
assert.doesNotThrow(() => validateManifest(manifest), 'a valid watch field must validate');
assert.ok(!referencedFiles(manifest).has('watch'), 'watch must not be treated as a referenced file');
assert.ok(!referencedFiles(manifest).has('manifest.watch'), 'watch contents must not leak into referencedFiles');

manifest.watch = {
  keywords: { '画饼': [{ text: '画饼了', audio: 'audio/huabing.mp3' }] },
  fallback: { text: '兜底', audio: 'audio/fallback.mp3' },
  state: 'reaction'
};
assert.doesNotThrow(() => validateManifest(manifest), 'watch {text, audio} entries must validate');
assert.ok(referencedFiles(manifest).has('audio/huabing.mp3'), 'watch.keywords audio must be referenced');
assert.ok(referencedFiles(manifest).has('audio/fallback.mp3'), 'watch.fallback audio must be referenced');

manifest.watch.archivedKeywords = { '画饼': [{ text: '旧画饼', audio: 'audio/old-huabing.mp3' }] };
assert.doesNotThrow(() => validateManifest(manifest), 'watch.archivedKeywords must validate');
assert.ok(referencedFiles(manifest).has('audio/old-huabing.mp3'), 'watch.archivedKeywords audio must stay referenced');
manifest.watch.archivedKeywords = { '画饼': [] };
assert.throws(() => validateManifest(manifest), /watch\.archivedKeywords/, 'watch.archivedKeywords empty array must fail');
manifest.watch.archivedKeywords = { '画饼': [{ text: '旧画饼', audio: 'audio/old-huabing.mp3' }] };

manifest.behavior.archivedPerched = [{
  state: 'sit',
  weight: 1,
  minDuration: 600,
  maxDuration: 1000,
  speechAudio: 'audio/old-mg.mp3'
}];
assert.doesNotThrow(() => validateManifest(manifest), 'behavior.archivedPerched must validate');
assert.ok(referencedFiles(manifest).has('audio/old-mg.mp3'), 'behavior.archivedPerched speechAudio must stay referenced');

manifest.watch.triggers = { '画饼': ['画饼', '上市'] };
assert.doesNotThrow(() => validateManifest(manifest), 'watch.triggers must validate');
manifest.watch.triggers = { '画饼': [] };
assert.throws(() => validateManifest(manifest), /watch\.triggers/, 'watch.triggers empty array must fail');
manifest.watch.triggers = { '画饼': ['画饼', '上市'] };

manifest.watch.keywordStates = { '吹牛': 'reaction' };
assert.doesNotThrow(() => validateManifest(manifest), 'watch.keywordStates must validate when animation exists');
manifest.watch.keywordStates = { '吹牛': 'missing-action' };
assert.throws(() => validateManifest(manifest), /watch\.keywordStates/, 'watch.keywordStates must reference an existing animation');
manifest.watch.keywordStates = { '吹牛': 'reaction' };
manifest.watch.keywordStates = 12;
assert.throws(() => validateManifest(manifest), /watch\.keywordStates 必须是对象/, 'watch.keywordStates must be an object');
manifest.watch.keywordStates = { '吹牛': 'reaction' };

manifest.startupGreetingAudio = 'audio/hello.mp3';
manifest.taskAcceptAudio = 'audio/task-ok.mp3';
manifest.behavior.fallbackAudio = { sit: 'audio/sit-fallback.mp3' };
assert.ok(referencedFiles(manifest).has('audio/hello.mp3'), 'startupGreetingAudio must be referenced');
assert.ok(referencedFiles(manifest).has('audio/task-ok.mp3'), 'taskAcceptAudio must be referenced');
assert.ok(referencedFiles(manifest).has('audio/sit-fallback.mp3'), 'behavior.fallbackAudio must be referenced');
assert.doesNotThrow(() => validateManifest(manifest), 'greeting/task/fallback audio fields must validate');
manifest.startupGreetingAudio = 'audio/hello.txt';
assert.throws(() => validateManifest(manifest), /startupGreetingAudio/, 'startupGreetingAudio must be an audio file');
manifest.startupGreetingAudio = 'audio/hello.mp3';

// invalid: watch.keywords value not an array
manifest.watch = { keywords: { '画饼': 'not-array' } };
assert.throws(() => validateManifest(manifest), /watch\.keywords\..*必须是非空数组/, 'watch.keywords value must be a non-empty array');

// invalid: watch.keywords empty array
manifest.watch = { keywords: { '画饼': [] } };
assert.throws(() => validateManifest(manifest), /watch\.keywords\..*必须是非空数组/, 'watch.keywords value must be non-empty');

// invalid: watch not an object
manifest.watch = 'not-an-object';
assert.throws(() => validateManifest(manifest), /watch 必须是对象/, 'watch must be an object');

// invalid: watch.fallback not a string or object
manifest.watch = { fallback: 42 };
assert.throws(() => validateManifest(manifest), /watch\.fallback 必须是字符串或/, 'watch.fallback must be a string or object');

// invalid: watch.state not a string
manifest.watch = { state: 99 };
assert.throws(() => validateManifest(manifest), /watch\.state 必须是字符串/, 'watch.state must be a string');

// backward compat: removing watch still validates
delete manifest.watch;
assert.doesNotThrow(() => validateManifest(manifest), 'manifest without watch must still validate');

const niulaiPack = path.join(__dirname, '..', 'pets', 'packages', 'niulai.petpack');
const niulai = validatePetpack(niulaiPack);
const niulaiAudio = [...referencedFiles(niulai.manifest)].filter((item) => /\.(mp3|wav|ogg)$/i.test(item));
assert.strictEqual(niulaiAudio.length, 2, 'niulai petpack must ship call sequence voice files');
assert.ok(niulaiAudio.includes('audio/call-mom.mp3'));
assert.ok(niulaiAudio.includes('audio/mom-niulai.mp3'));
assert.strictEqual(niulai.manifest.watch?.menuLabel, '办公雷达');
assert.ok(niulai.manifest.sequences?.['boss-call'], 'niulai must declare boss-call sequence');

console.log('petpack archive security checks passed');
