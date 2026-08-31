'use strict';
const assert = require('assert');
const {
  hasMarketSequences,
  hasCallHangupSequence,
  hasWatch,
  watchMenuLabel,
  taskProviderFromConfig
} = require('../src/capability-gates');

const brother = {
  watch: { keywords: {}, menuLabel: '画饼雷达' },
  sequences: {}
};
assert.strictEqual(hasWatch(brother), true);
assert.strictEqual(hasMarketSequences(brother), false);
assert.strictEqual(hasCallHangupSequence(brother), false);
assert.strictEqual(watchMenuLabel(brother), '画饼雷达');
assert.strictEqual(taskProviderFromConfig({}), 'feishu');
assert.strictEqual(taskProviderFromConfig({ tasks: { provider: 'mock' } }), 'mock');

const niulaiLike = {
  watch: { menuLabel: '办公雷达' },
  sequences: {
    'market-bull': { stages: [{ action: 'fly' }] },
    'boss-call': { stages: [{ action: 'call-shout', messageLoop: true }, { action: 'call-mom-kick', onContact: true }] }
  }
};
assert.strictEqual(hasMarketSequences(niulaiLike), true);
assert.strictEqual(hasCallHangupSequence(niulaiLike), true);
assert.strictEqual(watchMenuLabel({}), '消息雷达');
assert.strictEqual(hasWatch({}), false);

function testRuntimeCapabilitiesAreManifestGated() {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main-v3.js'), 'utf8');
  assert.match(src, /function canRunOfficeBus\(\) \{[\s\S]*hasWatch\(activeManifest\)/, 'office bus requires the active petpack watch capability');
  assert.match(src, /function canPollCallHangup\(\) \{[\s\S]*hasCallHangupSequence\(activeManifest\)/, 'call polling requires the active petpack hangup sequence');
  assert.match(src, /function canWatchMarket\(\) \{[\s\S]*hasMarketSequences\(activeManifest\)/, 'market watcher requires the active petpack market sequences');
  assert.match(src, /enabled: canWatchMarket\(\)/, 'market ticker visibility must use the combined market gate');
  assert.match(src, /callHangup: \{[\s\S]*enabled: canPollCallHangup\(\)/, 'DingTalk adapter receives a manifest-gated call polling configuration');
  assert.match(src, /applyLoadedWatchConfig\(loadWatchConfig\([\s\S]*manifestWatch: next\.watch/);
  assert.match(src, /restartOfficeBus\(\);\s+restartMarketWatcher\(\)/, 'pet switch reloads and restarts runtime capabilities');
  assert.match(src, /restartMarketWatcher = \(\) => \{[\s\S]*marketWatcher\?\.stop\(\);[\s\S]*marketWatcher\.start\(\)/, 'market restarts only through its manifest-aware gate');
}

testRuntimeCapabilitiesAreManifestGated();
console.log('test-capability-gates: ok');
