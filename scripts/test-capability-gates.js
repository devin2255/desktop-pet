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
console.log('test-capability-gates: ok');
