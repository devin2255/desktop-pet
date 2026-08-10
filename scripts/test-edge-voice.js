'use strict';
const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { createVoiceSynthesizer } = require('../src/edge-voice');

const fakeTts = async (text, _opts) => Buffer.from(`fake-mp3:${text}`);

function testCacheHit() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-test-'));
  const voice = createVoiceSynthesizer({ cacheDir: dir, loader: () => fakeTts });
  let count = 0;
  const wrapped = async (t, o) => { count++; return fakeTts(t, o); };
  const v2 = createVoiceSynthesizer({ cacheDir: dir, loader: () => wrapped });
  return v2.synthesize('你好').then((a) => v2.synthesize('你好').then((b) => {
    assert.strictEqual(a.url, b.url);
    assert.strictEqual(count, 1, '第二次应命中缓存');
    assert.ok(a.url.startsWith('voice-cache://'));
    assert.ok(fs.existsSync(path.join(dir, path.basename(a.url))));
  }));
}

function testNetworkFailureReturnsNull() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-test2-'));
  const voice = createVoiceSynthesizer({ cacheDir: dir, loader: () => { throw new Error('net down'); } });
  return voice.synthesize('你好').then((r) => {
    assert.strictEqual(r, null);
  });
}

Promise.all([testCacheHit(), testNetworkFailureReturnsNull()]).then(
  () => { console.log('edge-voice: all tests passed'); },
  (e) => { console.error('FAIL:', e.message); process.exit(1); }
);
