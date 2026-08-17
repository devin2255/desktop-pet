'use strict';
const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const {
  loadWatchConfig, splitBosses, DEFAULT_BOSS_CONFIG, ensureBossWatchDefaults, SELF_USE_DEFAULT_CONFIG
} = require('../src/watch-config');
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
  assert.ok(cfg.triggers['画饼'].includes('上市'));
}

function testKeywordStatesFromManifest() {
  const p = tmpJson({ enabled: true, bosses: ['ou_abc'] });
  const cfg = loadWatchConfig({
    configPath: p,
    larkCliPath: 'lark',
    manifestWatch: {
      keywords: { '画饼': ['画饼文案'], '吹牛': ['吹牛文案'] },
      state: 'reaction',
      keywordStates: { '吹牛': 'slipper' }
    }
  });
  assert.deepStrictEqual(cfg.keywordStates, { '吹牛': 'slipper' });
}

function testKeywordStatesDefaultEmpty() {
  const cfg = loadWatchConfig({ configPath: path.join(os.tmpdir(), 'nope-xxx.json'), larkCliPath: 'lark' });
  assert.deepStrictEqual(cfg.keywordStates, {});
}

function testManifestTriggersOverride() {
  const p = tmpJson({ enabled: true, bosses: ['ou_abc'] });
  const cfg = loadWatchConfig({
    configPath: p,
    larkCliPath: 'lark',
    manifestWatch: {
      keywords: { '画饼': ['专属文案'] },
      triggers: { '画饼': ['画饼'] }
    }
  });
  assert.deepStrictEqual(cfg.triggers['画饼'], ['画饼']);
}

function testSplitBosses() {
  const { ids, names } = splitBosses(['王总', 'ou_123', 'ou_456', '李总']);
  assert.deepStrictEqual(ids, ['ou_123', 'ou_456']);
  assert.deepStrictEqual(names, ['王总', '李总']);
}

function testCallHangupDefaultOff() {
  const cfg = loadWatchConfig({ configPath: path.join(os.tmpdir(), 'nope-xxx.json'), larkCliPath: 'lark' });
  assert.strictEqual(cfg.callHangup.enabled, false);
  assert.deepStrictEqual(cfg.platforms, ['lark']);
}

function testCallHangupFromFile() {
  const p = tmpJson({ enabled: true, bosses: ['张总'], platforms: ['lark', 'dingtalk'], callHangup: { enabled: true, cooldownSec: 90 } });
  const cfg = loadWatchConfig({ configPath: p, larkCliPath: 'lark' });
  assert.strictEqual(cfg.callHangup.enabled, true);
  assert.strictEqual(cfg.callHangup.cooldownSec, 90);
  assert.deepStrictEqual(cfg.platforms, ['lark', 'dingtalk']);
}

function testEnsureDefaultsCustomer() {
  const p = path.join(os.tmpdir(), `boss-watch-customer-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  try {
    ensureBossWatchDefaults(p, { customer: true });
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.strictEqual(raw.enabled, false);
    assert.deepStrictEqual(raw.bosses, []);
    assert.strictEqual(raw.callHangup.enabled, false);
    assert.ok(!JSON.stringify(raw).includes('ou_'));
  } finally {
    try { fs.unlinkSync(p); } catch (_) { /* ignore */ }
  }
}

function testEnsureDefaultsSelfUse() {
  const p = path.join(os.tmpdir(), `boss-watch-self-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  try {
    ensureBossWatchDefaults(p);
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.deepStrictEqual(raw.platforms, ['lark', 'dingtalk']);
    assert.strictEqual(raw.callHangup.enabled, true);
    assert.deepStrictEqual(raw.bosses, SELF_USE_DEFAULT_CONFIG.bosses);
  } finally {
    try { fs.unlinkSync(p); } catch (_) { /* ignore */ }
  }
}

function testEnsureDefaultsNoOverwrite() {
  const p = path.join(os.tmpdir(), `boss-watch-existing-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const original = { enabled: false, bosses: ['王总'], platforms: ['lark'] };
  try {
    fs.writeFileSync(p, JSON.stringify(original));
    ensureBossWatchDefaults(p, { customer: true });
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.deepStrictEqual(raw, original);
  } finally {
    try { fs.unlinkSync(p); } catch (_) { /* ignore */ }
  }
}

const tests = {
  testDefaultsWhenMissing, testCorruptFileFallsBack, testMergeManifest,
  testKeywordStatesFromManifest, testKeywordStatesDefaultEmpty,
  testManifestTriggersOverride, testSplitBosses,
  testCallHangupDefaultOff, testCallHangupFromFile,
  testEnsureDefaultsCustomer, testEnsureDefaultsSelfUse, testEnsureDefaultsNoOverwrite
};
let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`ok - ${name}`); } catch (e) { failed++; console.error(`FAIL - ${name}: ${e.message}`); }
}
if (failed) process.exit(1);
console.log('watch-config: all tests passed');
