'use strict';
const assert = require('assert');
const {
  parseEventLine, createMessageWatcher, isAtAllMessage, extractPolledMessage,
  dispatchBossMessage
} = require('../src/message-watcher');

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

function testLifecycleReconnect() {
  const { EventEmitter } = require('events');
  let spawnedCount = 0;
  let currentChild;
  const fakeSpawn = () => {
    spawnedCount++;
    currentChild = new EventEmitter();
    currentChild.stdout = new EventEmitter();
    currentChild.stderr = new EventEmitter();
    currentChild.kill = () => { try { currentChild.emit('exit'); } catch (_) {} };
    return currentChild;
  };
  const sent = [];
  const watcher = createMessageWatcher({
    rules: { ids: ['ou_1'], cooldownSec: 0, quietHours: [], keywords: { '画饼': ['a'] }, fallback: 'b', state: 'reaction' },
    voice: { synthesize: async () => null },
    sendState: (s, m, sp, o) => sent.push(m),
    spawnExec: fakeSpawn,
    onStatus: () => {},
    larkCliPath: 'fake-lark'
  });
  const origSetTimeout = setTimeout;
  let savedTimer = null;
  global.setTimeout = (fn, ms) => { savedTimer = { fn, ms }; return { fn, ms }; };
  try {
    watcher.start();
    assert.strictEqual(spawnedCount, 1, 'first spawn');
    assert.strictEqual(watcher.isRunning(), true);
    currentChild.stdout.emit('data', Buffer.from(JSON.stringify({ event_id: 'e1', sender_id: 'ou_1', content: '画饼' })));
    currentChild.emit('exit');
    assert.strictEqual(watcher.isRunning(), false, 'not running after exit before reconnect');
    assert.ok(savedTimer, 'reconnect timer scheduled');
    savedTimer.fn();
    assert.strictEqual(spawnedCount, 2, 'respawned after reconnect');
    assert.strictEqual(watcher.isRunning(), true, 'running again after reconnect');
    watcher.stop();
    assert.strictEqual(watcher.isRunning(), false, 'stopped');
  } finally {
    global.setTimeout = origSetTimeout;
  }
}

function testExtractFlattenedAtAll() {
  const msg = {
    sender_id: 'ou_c213c1a364e0818e671eb4823b4b9e2f',
    text: '@_all 好好干，将来上市我记着大家的功劳',
    message_id: 'om_flat',
    type: 'text'
  };
  const extracted = extractPolledMessage(msg);
  assert.ok(extracted, 'flattened lark-cli items without body must parse');
  assert.strictEqual(extracted.senderId, 'ou_c213c1a364e0818e671eb4823b4b9e2f');
  assert.strictEqual(extracted.content, '@_all 好好干，将来上市我记着大家的功劳');
  assert.strictEqual(extracted.messageId, 'om_flat');
  assert.strictEqual(isAtAllMessage(msg, extracted.content), true, '@_all in text must count as @所有人');
}

function testExtractWithoutBodyDoesNotThrow() {
  const msg = { sender_id: 'ou_1', text: '你好', id: 'om_nobody' };
  const extracted = extractPolledMessage(msg);
  assert.strictEqual(extracted.senderId, 'ou_1');
  assert.strictEqual(extracted.content, '你好');
  assert.strictEqual(extracted.messageId, 'om_nobody');
  assert.strictEqual(isAtAllMessage(msg, extracted.content), false);
}

function testExtractFeishuBodyJsonAtAll() {
  const msg = {
    sender: { id: 'ou_1' },
    body: { content: JSON.stringify({ text: '<at user_id="all">所有人</at> 好好干，将来上市我记着大家的功劳' }) },
    mentions: [{ id: 'all', name: '所有人' }],
    message_id: 'om_json'
  };
  const extracted = extractPolledMessage(msg);
  assert.ok(extracted.content.includes('将来上市我记着大家的功劳'));
  assert.strictEqual(isAtAllMessage(msg, extracted.content), true);
}

function testKeywordStateOverridesDefault() {
  const sent = [];
  const watcher = createMessageWatcher({
    rules: {
      ids: ['ou_1'], cooldownSec: 0, quietHours: [],
      keywords: {
        '画饼': [{ text: '这孙子在画饼，狗都不吃！', audio: 'audio/08-huabing-1.mp3' }],
        '吹牛': [{ text: '你老板吹了个牛逼！', audio: 'audio/11-chuiniu-1.mp3' }]
      },
      fallback: { text: '兜底', audio: 'audio/14-fallback.mp3' },
      state: 'reaction',
      keywordStates: { '吹牛': 'slipper' }
    },
    voice: { synthesize: async () => ({ url: 'voice-cache://should-not-use.mp3' }) },
    sendState: (state, message, speech, opts) => sent.push({ state, message, speech, opts })
  });
  return watcher.processLine(JSON.stringify({
    event_id: 'e-brag', sender_id: 'ou_1', content: '这事包在我身上，人脉搞得定'
  })).then(() => {
    assert.strictEqual(sent.length, 1, '吹牛句应触发');
    assert.strictEqual(sent[0].state, 'slipper');
    assert.strictEqual(sent[0].message, '你老板吹了个牛逼！');
    assert.strictEqual(sent[0].opts.speechAudio, 'audio/11-chuiniu-1.mp3');
  }).then(() => watcher.processLine(JSON.stringify({
    event_id: 'e-pie', sender_id: 'ou_1', content: '年底给你画饼'
  }))).then(() => {
    assert.strictEqual(sent.length, 2, '画饼句仍走默认动作');
    assert.strictEqual(sent[1].state, 'reaction');
  });
}

function testListingPhraseTriggersHuabingAudio() {
  const sent = [];
  const watcher = createMessageWatcher({
    rules: {
      ids: ['ou_1'], cooldownSec: 0, quietHours: [],
      keywords: { '画饼': [{ text: '这孙子在画饼，狗都不吃！', audio: 'audio/08-huabing-1.mp3' }] },
      fallback: { text: '兜底', audio: 'audio/14-fallback.mp3' },
      state: 'reaction'
    },
    voice: { synthesize: async () => ({ url: 'voice-cache://should-not-use.mp3' }) },
    sendState: (state, message, speech, opts) => sent.push({ state, message, speech, opts })
  });
  return watcher.processLine(JSON.stringify({
    event_id: 'e-ipo', sender_id: 'ou_1',
    content: '@_all 好好干，将来上市我记着大家的功劳'
  })).then(() => {
    assert.strictEqual(sent.length, 1, '上市画饼句应触发');
    assert.strictEqual(sent[0].message, '这孙子在画饼，狗都不吃！');
    assert.strictEqual(sent[0].opts.speechAudio, 'audio/08-huabing-1.mp3');
  });
}

function testWindowRoleKeywordStateFallsBack() {
  const sent = [];
  const watcher = createMessageWatcher({
    rules: {
      ids: ['ou_1'], cooldownSec: 0, quietHours: [],
      keywords: { '加班': ['去加班'] },
      fallback: '兜底',
      state: 'reaction',
      keywordStates: { '加班': 'climb' }
    },
    voice: { synthesize: async () => null },
    sendState: (state, message, speech, opts) => sent.push({ state, message, speech, opts })
  });
  return watcher.processLine(JSON.stringify({
    event_id: 'e-ot-climb', sender_id: 'ou_1', content: '今晚加班'
  })).then(() => {
    assert.strictEqual(sent.length, 1, '加班句应触发');
    assert.strictEqual(sent[0].state, 'reaction', 'climb 是窗口角色，必须回退到 rules.state');
  });
}

function testCrawlKeywordStateAllowed() {
  const sent = [];
  const watcher = createMessageWatcher({
    rules: {
      ids: ['ou_1'], cooldownSec: 0, quietHours: [],
      keywords: { '加班': ['去加班'] },
      fallback: '兜底',
      state: 'reaction',
      keywordStates: { '加班': 'crawl' }
    },
    voice: { synthesize: async () => null },
    sendState: (state, message, speech, opts) => sent.push({ state, message, speech, opts })
  });
  return watcher.processLine(JSON.stringify({
    event_id: 'e-ot-crawl', sender_id: 'ou_1', content: '今晚加班'
  })).then(() => {
    assert.strictEqual(sent.length, 1, '加班句应触发');
    assert.strictEqual(sent[0].state, 'crawl', 'crawl 允许作为 keywordStates');
  });
}

function testDispatchBossMessageInjectedNow() {
  const sent = [];
  const cooldownMap = new Map();
  const ctx = {
    rules: {
      ids: ['ou_1'], cooldownSec: 30, quietHours: [],
      keywords: { '画饼': ['文案A'] }, fallback: '兜底', state: 'reaction'
    },
    voice: { synthesize: async () => null },
    sendState: (state, message) => sent.push({ state, message }),
    rng: () => 0,
    now: 1_000_000,
    cooldownMap
  };
  const event = {
    platform: 'lark', kind: 'message', eventId: 'e-now',
    senderId: 'ou_1', senderName: '', text: '画饼', chatType: 'p2p'
  };
  return dispatchBossMessage(event, ctx).then(() => {
    assert.strictEqual(sent.length, 1);
    ctx.now = 1_000_000 + 10_000;
    return dispatchBossMessage(event, ctx);
  }).then(() => {
    assert.strictEqual(sent.length, 1, '注入 now 后冷却期内不重复');
    ctx.now = 1_000_000 + 31_000;
    return dispatchBossMessage(event, ctx);
  }).then(() => {
    assert.strictEqual(sent.length, 2, '冷却结束后可再次触发');
  });
}

const tasks = [
  testParseValid, testParseInvalid, testPipelineTriggers, testNonBossSkipped,
  testFallbackAndVoiceNull, testDedupe, testLifecycleReconnect,
  testExtractFlattenedAtAll, testExtractWithoutBodyDoesNotThrow,
  testExtractFeishuBodyJsonAtAll, testListingPhraseTriggersHuabingAudio,
  testKeywordStateOverridesDefault,
  testWindowRoleKeywordStateFallsBack, testCrawlKeywordStateAllowed,
  testDispatchBossMessageInjectedNow
];
Promise.all(tasks.map((t) => t())).then(
  () => { console.log('message-watcher: all tests passed'); },
  (e) => { console.error('FAIL:', e.message); process.exit(1); }
);
