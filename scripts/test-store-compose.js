'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  REQUIRED_ACTIONS,
  validateManifest
} = require('../src/petpack-validator');
const { composePetTo } = require('../src/store-compose');

function minimalPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

function writeRelFile(root, relative, data) {
  const dest = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, data);
}

function buildBaseDir(root) {
  fs.mkdirSync(root, { recursive: true });
  writeRelFile(root, 'preview.png', minimalPng());

  const animations = {};
  for (const [action, count] of Object.entries(REQUIRED_ACTIONS)) {
    const frames = [];
    for (let i = 1; i <= count; i++) {
      const rel = `animations/${action}/${String(i).padStart(2, '0')}.png`;
      frames.push(rel);
      writeRelFile(root, rel, minimalPng());
    }
    animations[action] = {
      frames,
      durations: frames.map(() => 100),
      loop: true
    };
  }

  const manifest = {
    schemaVersion: 1,
    id: 'base-pet',
    name: '基础宠物',
    preview: 'preview.png',
    animations
  };
  validateManifest(manifest);
  fs.writeFileSync(path.join(root, 'pet.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function buildWalkActionDir(root) {
  fs.mkdirSync(root, { recursive: true });
  writeRelFile(root, 'preview.png', minimalPng());

  const frames = [];
  for (let i = 1; i <= REQUIRED_ACTIONS.walk; i++) {
    const rel = `animations/walk-act/${String(i).padStart(2, '0')}.png`;
    frames.push(rel);
    writeRelFile(root, rel, minimalPng());
  }

  const manifest = {
    schemaVersion: 1,
    id: 'walk-action',
    name: '走路动作包',
    preview: 'preview.png',
    animations: {
      walk: {
        frames,
        durations: frames.map(() => 130),
        loop: true
      }
    }
  };
  fs.writeFileSync(path.join(root, 'pet.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-compose-base-'));
const actionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-compose-action-'));
const outDir = path.join(os.tmpdir(), `store-compose-out-${process.pid}`);

try {
  buildBaseDir(baseDir);
  buildWalkActionDir(actionDir);

  const { manifest } = composePetTo({
    baseDir,
    actionDirs: [actionDir],
    composedId: 'store-test01',
    displayName: '测试猫',
    outDir
  });

  const written = JSON.parse(fs.readFileSync(path.join(outDir, 'pet.json'), 'utf8'));
  assert.strictEqual(written.id, 'store-test01');
  assert.strictEqual(written.name, '测试猫');
  assert.strictEqual(manifest.id, 'store-test01');
  assert.strictEqual(manifest.name, '测试猫');
  assert.ok(
    written.animations.walk.frames.every((frame) => frame.includes('walk-act')),
    'walk frames should come from action pack paths'
  );
  assert.strictEqual(written.animations.walk.frames.length, REQUIRED_ACTIONS.walk);
  assert.doesNotThrow(() => validateManifest(written));
  assert.doesNotThrow(() => validateManifest(manifest));

  console.log('test-store-compose: ok');
} finally {
  fs.rmSync(baseDir, { recursive: true, force: true });
  fs.rmSync(actionDir, { recursive: true, force: true });
  fs.rmSync(outDir, { recursive: true, force: true });
}
