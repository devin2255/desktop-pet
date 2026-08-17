'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createDingtalkAdapter, resolveHangupAction } = require('../src/im-adapter-dingtalk');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseRules(overrides = {}) {
  return {
    enabled: true,
    platforms: ['lark', 'dingtalk'],
    ids: [],
    names: ['张总'],
    quietHours: [],
    callHangup: { enabled: true, cooldownSec: 60 },
    ...overrides
  };
}

function bossLocated(overrides = {}) {
  return {
    windowBounds: { x: 1000, y: 100, width: 280, height: 160 },
    rejectBounds: { x: 1200, y: 200, width: 80, height: 40 },
    title: '张总邀请你语音通话',
    displayName: '张总',
    ...overrides
  };
}

async function withAdapter(opts, fn) {
  const adapter = createDingtalkAdapter(opts);
  try {
    await fn(adapter);
  } finally {
    adapter.stop();
  }
}

async function testColleagueDoesNotEmitVoiceCall() {
  const events = [];
  let invokes = 0;
  await withAdapter({
    locateIncomingCall: async () => ({
      windowBounds: { x: 0, y: 0, width: 280, height: 160 },
      rejectBounds: { x: 100, y: 100, width: 80, height: 40 },
      title: '同事甲邀请你语音通话',
      displayName: '同事甲'
    }),
    invokeReject: async () => {
      invokes += 1;
      return true;
    },
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: baseRules(),
      onVoiceCall: (event) => events.push(event)
    });
    await delay(50);
    assert.strictEqual(events.length, 0, '同事来电不应 emit voice-call');
    assert.strictEqual(invokes, 0, 'start 不得调用 invokeReject');
  });
}

async function testBossNameEmitsVoiceCall() {
  const events = [];
  await withAdapter({
    locateIncomingCall: async () => bossLocated(),
    invokeReject: async () => true,
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: baseRules(),
      onVoiceCall: (event) => events.push(event)
    });
    assert.strictEqual(events.length, 1, '名单含张总时应 emit voice-call');
    assert.strictEqual(events[0].platform, 'dingtalk');
    assert.strictEqual(events[0].kind, 'voice-call');
    assert.strictEqual(events[0].senderName, '张总');
    assert.strictEqual(events[0].text, '张总邀请你语音通话');
    assert.ok(events[0].eventId);
  });
}

async function testStartDoesNotInvokeReject() {
  let invokes = 0;
  await withAdapter({
    locateIncomingCall: async () => bossLocated(),
    invokeReject: async () => {
      invokes += 1;
      return true;
    },
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: baseRules(),
      onVoiceCall: () => {}
    });
    await delay(50);
    assert.strictEqual(invokes, 0, 'invokeReject 只能由序列 onContact 触发');
    assert.strictEqual(typeof adapter.invokeReject, 'function');
  });
}

async function testLocateThrowDoesNotCrashAndStopIsIdempotent() {
  await withAdapter({
    locateIncomingCall: async () => {
      throw new Error('ua boom');
    },
    invokeReject: async () => true,
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: baseRules(),
      onVoiceCall: () => {
        throw new Error('should not emit when locate throws');
      }
    });
    adapter.stop();
    adapter.stop();
  });
}

async function testDedupeUntilLocateReturnsNull() {
  const events = [];
  let located = bossLocated();
  await withAdapter({
    locateIncomingCall: async () => located,
    invokeReject: async () => true,
    pollMs: 25
  }, async (adapter) => {
    await adapter.start({
      rules: baseRules(),
      onVoiceCall: (event) => events.push(event)
    });
    await delay(70);
    assert.strictEqual(events.length, 1, '同一 title+displayName 不应每轮都 emit');
    located = null;
    await delay(70);
    located = bossLocated();
    await delay(70);
    assert.strictEqual(events.length, 2, 'locate 变 null 后同一来电应能再次 emit');
  });
}

async function testHangupDisabledDoesNotPoll() {
  let locates = 0;
  await withAdapter({
    locateIncomingCall: async () => {
      locates += 1;
      return bossLocated();
    },
    invokeReject: async () => true,
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: baseRules({ callHangup: { enabled: false, cooldownSec: 60 } }),
      onVoiceCall: () => {
        throw new Error('callHangup.enabled false 时不应 emit');
      }
    });
    await delay(50);
    assert.strictEqual(locates, 0, '!callHangup.enabled 时不应轮询');
  });
}

async function testDefaultLocateIsNullAndStartDoesNotCrash() {
  const events = [];
  await withAdapter({}, async (adapter) => {
    await adapter.start({
      rules: baseRules(),
      onVoiceCall: (event) => events.push(event)
    });
    assert.strictEqual(adapter.getLastLocated(), null);
    assert.strictEqual(events.length, 0);
  });
}

async function testGetLastLocatedTracksCurrentCall() {
  await withAdapter({
    locateIncomingCall: async () => bossLocated(),
    invokeReject: async () => true,
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: baseRules(),
      onVoiceCall: () => {}
    });
    const located = adapter.getLastLocated();
    assert.ok(located);
    assert.strictEqual(located.displayName, '张总');
    assert.deepStrictEqual(located.windowBounds, { x: 1000, y: 100, width: 280, height: 160 });
  });
}

function testResolveHangupSkipsInvokeWhenRejectBoundsMissing() {
  let invokes = 0;
  const decision = resolveHangupAction({
    located: { windowBounds: { x: 1000, y: 100, width: 280, height: 160 }, rejectBounds: null, title: 'x', displayName: '张总' },
    petBounds: { x: 10, y: 10, width: 200, height: 100 },
    hangup: { action: 'call-mom-kick', anchor: { x: 0.72, y: 0.96 } },
    stage: { action: 'call-mom-kick' }
  });
  assert.strictEqual(decision.invoke, false);
  assert.strictEqual(decision.message, '这次没挂上');
  assert.strictEqual(decision.state, 'idle');
  assert.strictEqual(invokes, 0);
}

function testResolveHangupSkipsInvokeWhenAnchorsMiss() {
  const decision = resolveHangupAction({
    located: bossLocated(),
    petBounds: { x: 0, y: 0, width: 200, height: 100 },
    hangup: { action: 'call-mom-kick', anchor: { x: 0.72, y: 0.96 } },
    stage: { action: 'call-mom-kick' }
  });
  assert.strictEqual(decision.invoke, false);
  assert.strictEqual(decision.message, '这次没挂上');
  assert.strictEqual(decision.state, 'call-mom-kick');
}

function testPackWhitelistIncludesDingtalkAdapter() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const builder = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-customer.js'), 'utf8');
  const file = 'src/im-adapter-dingtalk.js';
  assert.ok(packageJson.build.files.includes(file), `default package includes ${file}`);
  assert.ok(builder.includes(`'${file}'`), `customer package includes ${file}`);
}

const tasks = [
  testColleagueDoesNotEmitVoiceCall,
  testBossNameEmitsVoiceCall,
  testStartDoesNotInvokeReject,
  testLocateThrowDoesNotCrashAndStopIsIdempotent,
  testDedupeUntilLocateReturnsNull,
  testHangupDisabledDoesNotPoll,
  testDefaultLocateIsNullAndStartDoesNotCrash,
  testGetLastLocatedTracksCurrentCall,
  testResolveHangupSkipsInvokeWhenRejectBoundsMissing,
  testResolveHangupSkipsInvokeWhenAnchorsMiss,
  testPackWhitelistIncludesDingtalkAdapter
];

Promise.all(tasks.map((t) => t())).then(
  () => { console.log('im-adapter-dingtalk: all tests passed'); },
  (e) => { console.error('FAIL:', e.message); process.exit(1); }
);
