'use strict';
const assert = require('assert');
const { parseEventLine, createMessageWatcher } = require('../src/message-watcher');

function testParseValid() {
  const ev = parseEventLine(JSON.stringify({
    event_id: 'ev1', sender_id: 'ou_1', chat_id: 'oc_1', chat_type: 'p2p',
    content: '年底画饼', timestamp: '123'
  }));
  assert.strictEqual(ev.event_id, 'ev1');
  assert.strictEqual(ev.sender_id, 'ou_1');
  assert.strictEqual(ev.content, '年底画饼');
}

function testParseInvalid() {
  assert.strictEqual(parseEventLine('not json'), null);
  assert.strictEqual(parseEventLine(''), null);
  assert.strictEqual(parseEventLine(JSON.stringify({ event_id: 'x' })), null); // 缺 content
  assert.strictEqual(parseEventLine(JSON.stringify({ event_id: 'x', content: { a: 1 }, sender_id: 'ou_1' })), null); // 非文本
}

function testPipelineTriggers() {
  const sent = [];
  const rules = {
    ids: ['ou_1'], cooldownSec: 30, quietHours: [],
    keywords: { '画饼': ['文案A'] }, fallback: '兜底', state: 'reaction'
  };
  const watcher = createMessageWatcher({
    rules,
    voice: { synthesize: async () => ({ url: 'voice-cache://abc.mp3' }) },
    sendState: (state, message, speech, opts) => sent.push({ state, message, speech, opts }),
    rng: () => 0
  });
  return watcher.processLine(JSON.stringify({ event_id: 'e1', sender_id: 'ou_1', content: '给你画饼' }))
    .then(() => {
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].state, 'reaction');
      assert.strictEqual(sent[0].message, '文案A');
      assert.strictEqual(sent[0].opts.speechAudio, 'voice-cache://abc.mp3');
      return watcher.processLine(JSON.stringify({ event_id: 'e2', sender_id: 'ou_1', content: '再画饼' }));
    })
    .then(() => assert.strictEqual(sent.length, 1, '冷却期内不重复触发'));
}

function testNonBossSkipped() {
  const sent = [];
  const watcher = createMessageWatcher({
    rules: { ids: ['ou_1'], cooldownSec: 0, quietHours: [], keywords: { '画饼': ['a'] }, fallback: 'b', state: 'reaction' },
    voice: { synthesize: async () => null },
    sendState: (s, m, sp, o) => sent.push({ s, m, sp, o })
  });
  return watcher.processLine(JSON.stringify({ event_id: 'e3', sender_id: 'ou_999', content: '画饼' }))
    .then(() => assert.strictEqual(sent.length, 0));
}

function testFallbackAndVoiceNull() {
  const sent = [];
  const watcher = createMessageWatcher({
    rules: { ids: ['ou_1'], cooldownSec: 0, quietHours: [], keywords: {}, fallback: '兜底话', state: 'reaction' },
    voice: { synthesize: async () => null },
    sendState: (s, m, sp, o) => sent.push({ s, m, sp, o })
  });
  return watcher.processLine(JSON.stringify({ event_id: 'e4', sender_id: 'ou_1', content: '随便聊聊' }))
    .then(() => {
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].m, '兜底话');
      assert.strictEqual(sent[0].o.speechAudio, '');
    });
}

function testDedupe() {
  const sent = [];
  const watcher = createMessageWatcher({
    rules: { ids: ['ou_1'], cooldownSec: 0, quietHours: [], keywords: { '画饼': ['a'] }, fallback: 'b', state: 'reaction' },
    voice: { synthesize: async () => null },
    sendState: (s, m, sp, o) => sent.push(m)
  });
  const line = JSON.stringify({ event_id: 'e-same', sender_id: 'ou_1', content: '画饼' });
  return watcher.processLine(line).then(() => watcher.processLine(line))
    .then(() => assert.strictEqual(sent.length, 1, '同 event_id 去重'));
}

const tasks = [testParseValid, testParseInvalid, testPipelineTriggers, testNonBossSkipped, testFallbackAndVoiceNull, testDedupe];
Promise.all(tasks.map((t) => t())).then(
  () => { console.log('message-watcher: all tests passed'); },
  (e) => { console.error('FAIL:', e.message); process.exit(1); }
);
