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
// dingtalk message radar: senderId is a dingtalk openDingtalkId matched against
// watch-config dingtalk.bossOpenIds
const dtRules = { ids: ['ou_1'], names: ['张总'], dingtalk: { bossOpenIds: ['dtd_1'] } };
assert.strictEqual(matchBoss({ platform: 'dingtalk', kind: 'message', senderId: 'dtd_1' }, dtRules), true);
assert.strictEqual(matchBoss({ platform: 'dingtalk', kind: 'message', senderId: 'dtd_9' }, dtRules), false);
// missing dingtalk config falls back to name matching (no crash, no false positive)
assert.strictEqual(matchBoss({ platform: 'dingtalk', kind: 'message', senderId: 'dtd_9', senderName: '张总' }, dtRules), true);
assert.strictEqual(matchBoss({ platform: 'dingtalk', kind: 'message', senderId: 'dtd_9' }, dtRules), false);
console.log('im-match: ok');
