'use strict';
const assert = require('assert');
const {
  hasMarketSequences,
  hasCallHangupSequence,
  hasWatch,
  hasDuo,
  hasDuoTent,
  hasDuoSlack,
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
assert.strictEqual(hasDuo({}), false);
assert.strictEqual(hasDuo({ duo: { members: [{}, {}] } }), true);
assert.strictEqual(hasDuo({ duo: null }), false);
assert.strictEqual(hasDuoTent({}), false);
assert.strictEqual(hasDuoTent({ duo: { members: [{}, {}] } }), false);
assert.strictEqual(hasDuoTent({ duo: { members: [{}, {}], tent: { action: 'sit' } } }), true);
assert.strictEqual(hasDuoTent({ duo: { members: [{}, {}], tent: null } }), false);
assert.strictEqual(hasDuoSlack({}), false);
assert.strictEqual(hasDuoSlack({ duo: { members: [{}, {}] } }), false);
assert.strictEqual(hasDuoSlack({ duo: { members: [{}, {}], slack: { jumpAction: 'slack-jump' } } }), true);
assert.strictEqual(hasDuoSlack({ duo: { members: [{}, {}], slack: null } }), false);

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
  assert.match(src, /hasDuo\(activeManifest\)/, 'duo windows/gestures are gated by the active petpack duo capability');
  assert.match(src, /hasDuoTent\(activeManifest\)/, 'tent standby is gated by duo.tent');
  assert.match(src, /hasDuoSlack\(activeManifest\)/, 'slack is gated by duo.slack');
  assert.match(src, /id === 'duo-tent'/, 'main process recognizes the tent menu id');
  assert.match(src, /id === 'duo-slack'/);
  assert.match(
    src,
    /function buildTrayMenu\(\) \{[\s\S]*customActions\.some\(\(item\) => item\.id === 'duo-slack'\)/,
    'folded slack menu must not inject 摸会儿鱼 twice when pet.json already lists it'
  );
  assert.match(src, /pet:slack-exit/);
  assert.match(src, /function canRunOfficeBus\(\) \{[\s\S]*duo\.mode\(\) === 'tent'/, 'tent mode silences the office bus');
  assert.match(src, /function canRunOfficeBus\(\) \{[\s\S]*mode\(\) === 'slack'/);
  assert.match(src, /slackEnabled:\s*hasDuoSlack/);
  assert.match(src, /presentationWindowSize\(currentSize\(\), duo\.mode\(\)/);
  assert.match(src, /slackExtraHeight:/);
  assert.match(src, /startAtLast/, 'tent pose snaps to the hold frame instead of replaying sit');
  assert.match(src, /pet:duo-pointer-down/, 'main process wires the duo pointer-down IPC channel');
  assert.match(src, /createDuoController/, 'main process owns a duo controller instance');
  assert.match(src, /\.find\(\s*\(m\)\s*=>\s*m\.watch\s*===?\s*true/, 'watch hits target the watch:true duo member');
  assert.match(src, /function targetWatchWindow\(/, 'watch dispatch uses a window helper');
}

testRuntimeCapabilitiesAreManifestGated();
console.log('test-capability-gates: ok');
