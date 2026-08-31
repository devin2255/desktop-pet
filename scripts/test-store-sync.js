'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { REQUIRED_ACTIONS } = require('../src/petpack-validator');
const { composedPetId } = require('../src/store-ids');
const { syncStoreLibrary } = require('../src/store-sync');

function minimalPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

function addJson(zip, entryName, value) {
  zip.addFile(entryName, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'));
}

function buildBaseZip() {
  const zip = new AdmZip();
  addJson(zip, 'petpack.json', {
    packId: 'base-cat-v1',
    type: 'base',
    species: 'cat',
    contentVersion: 1
  });
  zip.addFile('preview.png', minimalPng());

  const animations = {};
  for (const [action, count] of Object.entries(REQUIRED_ACTIONS)) {
    const frames = [];
    for (let i = 1; i <= count; i++) {
      const rel = `animations/${action}/${String(i).padStart(2, '0')}.png`;
      frames.push(rel);
      zip.addFile(rel, minimalPng());
    }
    animations[action] = {
      frames,
      durations: frames.map(() => 100),
      loop: true
    };
  }

  addJson(zip, 'pet.json', {
    schemaVersion: 1,
    id: 'base-pet',
    name: '基础宠物',
    preview: 'preview.png',
    animations
  });
  return zip.toBuffer();
}

function buildActionZip() {
  const zip = new AdmZip();
  addJson(zip, 'petpack.json', {
    packId: 'act-cat-walk-v1',
    type: 'action',
    species: 'cat',
    contentVersion: 1
  });
  zip.addFile('preview.png', minimalPng());

  const frames = [];
  for (let i = 1; i <= REQUIRED_ACTIONS.walk; i++) {
    const rel = `animations/walk-act/${String(i).padStart(2, '0')}.png`;
    frames.push(rel);
    zip.addFile(rel, minimalPng());
  }

  addJson(zip, 'pet.json', {
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
  });
  return zip.toBuffer();
}

const packs = {
  'base-cat-v1': buildBaseZip(),
  'act-cat-walk-v1': buildActionZip()
};

const fakeFetch = async (url) => {
  const href = String(url);
  if (href.includes('/api/client/library')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          pets: [
            {
              petInstanceId: 'pet1',
              species: 'cat',
              displayName: '测试猫',
              base: {
                packId: 'base-cat-v1',
                contentVersion: 1
              },
              actions: [
                {
                  packId: 'act-cat-walk-v1',
                  contentVersion: 1
                }
              ]
            }
          ]
        }
      })
    };
  }

  if (href.includes('/api/client/packs/download')) {
    const packId = new URL(href).searchParams.get('packId');
    const buf = packs[packId];
    if (!buf) {
      return { ok: false, status: 404, json: async () => ({ ok: false, error: 'NOT_FOUND' }) };
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    };
  }

  return { ok: false, status: 404, json: async () => ({ ok: false, error: 'nope' }) };
};

(async () => {
  const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'store-sync-cache-'));
  const libraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'store-sync-library-'));

  try {
    const result = await syncStoreLibrary({
      baseUrl: 'http://localhost:3000',
      token: 'test-token',
      cacheRoot,
      libraryRoot,
      fetchImpl: fakeFetch
    });

    const expectedId = composedPetId('pet1');
    assert.strictEqual(result.pets.length, 1);
    assert.strictEqual(result.pets[0].composedId, expectedId);

    const outDir = path.join(libraryRoot, expectedId);
    assert.ok(fs.existsSync(outDir), 'composed directory should exist');

    const petJson = JSON.parse(fs.readFileSync(path.join(outDir, 'pet.json'), 'utf8'));
    assert.strictEqual(petJson.id, expectedId);
    assert.ok(
      petJson.animations.walk.frames.every((frame) => frame.includes('walk-act')),
      'walk frames should include walk-act'
    );

    console.log('test-store-sync: ok');
  } finally {
    fs.rmSync(cacheRoot, { recursive: true, force: true });
    fs.rmSync(libraryRoot, { recursive: true, force: true });
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
