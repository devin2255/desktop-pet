'use strict';
const assert = require('assert');
const { matchBoss } = require('../src/im-match');

const rules = { ids: ['ou_1'], names: ['张总'] };

assert.strictEqual(matchBoss({ platform: 'lark', kind: 'message', senderId: 'ou_1' }, rules), true);
assert.strictEqual(matchBoss({ platform: 'lark', kind: 'message', senderId: 'ou_9' }, rules), false);
assert.strictEqual(matchBoss({ platform: 'dingtalk', kind: 'message', senderName: '张总' }, rules), true);
assert.strictEqual(matchBoss({ platform: 'dingtalk', kind: 'message', senderName: '张伟' }, rules), false);
assert.strictEqual(matchBoss({
  platform: 'dingtalk', kind: 'voice-call', senderName: '张总', text: '张总邀请你语音通话'
}, rules), true);
assert.strictEqual(matchBoss({
  platform: 'dingtalk', kind: 'voice-call', senderName: '同事甲', text: '同事甲邀请你语音通话'
}, rules), false);
console.log('im-match: ok');
