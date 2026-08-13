'use strict';
const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { loadWatchConfig, splitBosses, DEFAULT_BOSS_CONFIG } = require('../src/watch-config');
const { DEFAULT_KEYWORDS } = require('../src/watch-rules');

function tmpJson(obj) {
  const p = path.join(os.tmpdir(), `boss-watch-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
}

function testDefaultsWhenMissing() {
  const cfg = loadWatchConfig({ configPath: path.join(os.tmpdir(), 'nope-xxx.json'), larkCliPath: 'lark' });
  assert.strictEqual(cfg.enabled, false);
  assert.strictEqual(cfg.cooldownSec, 30);
  assert.deepStrictEqual(cfg.quietHours, []);
  assert.strictEqual(cfg.state, 'reaction');
  // Keywords are normalized to {text, audio} objects
  const expectedKeywords = {};
  for (const [k, v] of Object.entries(DEFAULT_KEYWORDS)) {
    expectedKeywords[k] = v.map((text) => ({ text, audio: '' }));
  }
  assert.deepStrictEqual(cfg.keywords, expectedKeywords);
  assert.deepStrictEqual(cfg.fallback, { text: '你老板又开始整活儿了，装没看见。', audio: '' });
  assert.strictEqual(cfg.voice.voice, 'zh-CN-YunxiNeural');
}

function testCorruptFileFallsBack() {
  const p = path.join(os.tmpdir(), 'boss-watch-bad.json');
  fs.writeFileSync(p, '{not json');
  const cfg = loadWatchConfig({ configPath: p, larkCliPath: 'lark' });
  assert.strictEqual(cfg.enabled, false); // 不抛异常
}

function testMergeManifest() {
  const p = tmpJson({ enabled: true, bosses: ['王总', 'ou_abc'] });
  const cfg = loadWatchConfig({
    configPath: p,
    larkCliPath: 'lark',
    manifestWatch: { keywords: { '画饼': ['专属文案'] }, fallback: '兜底', state: 'idle' }
  });
  assert.strictEqual(cfg.enabled, true);
  assert.deepStrictEqual(cfg.keywords, { '画饼': [{ text: '专属文案', audio: '' }] });
  assert.deepStrictEqual(cfg.fallback, { text: '兜底', audio: '' });
  assert.strictEqual(cfg.state, 'idle');
}

function testSplitBosses() {
  const { ids, names } = splitBosses(['王总', 'ou_123', 'ou_456', '李总']);
  assert.deepStrictEqual(ids, ['ou_123', 'ou_456']);
  assert.deepStrictEqual(names, ['王总', '李总']);
}

const tests = { testDefaultsWhenMissing, testCorruptFileFallsBack, testMergeManifest, testSplitBosses };
let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`ok - ${name}`); } catch (e) { failed++; console.error(`FAIL - ${name}: ${e.message}`); }
}
if (failed) process.exit(1);
console.log('watch-config: all tests passed');
