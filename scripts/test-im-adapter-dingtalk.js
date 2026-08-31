'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { insetRect, petPositionForAnchor, nearestVerticalEdge } = require('../src/approach-target');
const { createDingtalkAdapter, resolveHangupAction, shouldInvokeReject } = require('../src/im-adapter-dingtalk');
const { parseDwsJson, extractDingtalkMessage, formatDwsTime } = require('../src/im-adapter-dingtalk');
const { isSystemContent } = require('../src/im-adapter-dingtalk');

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

function petPlacedByHangupApproach(rejectBounds, hangupAnchor, petSize) {
  const inset = insetRect(rejectBounds, 0.25);
  const target = { x: inset.x + inset.width / 2, y: inset.y + inset.height / 2 };
  const pos = petPositionForAnchor(petSize, hangupAnchor, target);
  return { x: pos.x, y: pos.y, width: petSize.width, height: petSize.height };
}

function testShouldInvokeRejectWhenFootOnInsetButton() {
  const rejectBounds = { x: 140, y: 90, width: 80, height: 40 };
  const hangupAnchor = { x: 0.72, y: 0.96 };
  const petBounds = petPlacedByHangupApproach(rejectBounds, hangupAnchor, { width: 200, height: 100 });
  assert.strictEqual(shouldInvokeReject({ petBounds, hangupAnchor, rejectBounds }), true);
}

function testShouldInvokeRejectWhenPetOnRightOfCallWindow() {
  const windowBounds = { x: 1000, y: 100, width: 280, height: 160 };
  const rejectBounds = { x: 1180, y: 200, width: 80, height: 40 };
  const hangupAnchor = { x: 0.72, y: 0.96 };
  const petBounds = petPlacedByHangupApproach(rejectBounds, hangupAnchor, { width: 200, height: 100 });
  const edge = nearestVerticalEdge(petBounds, windowBounds);
  assert.strictEqual(edge.side, 'right', 'failure mode: pet nearer the call window right edge');
  assert.strictEqual(
    shouldInvokeReject({ petBounds, hangupAnchor, rejectBounds }),
    true,
    'unmirrored foot on inset reject button must invoke'
  );
  const decision = resolveHangupAction({
    located: { windowBounds, rejectBounds, title: 'x', displayName: '张总' },
    petBounds,
    hangup: { action: 'call-mom-kick', anchor: hangupAnchor },
    stage: { action: 'call-mom-kick' }
  });
  assert.strictEqual(decision.invoke, true);
}

function testShouldInvokeRejectWhenFarAway() {
  assert.strictEqual(shouldInvokeReject({
    petBounds: { x: 0, y: 0, width: 200, height: 100 },
    hangupAnchor: { x: 0.72, y: 0.96 },
    rejectBounds: { x: 1180, y: 200, width: 80, height: 40 }
  }), false);
}

function testPackWhitelistIncludesDingtalkAdapter() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const builder = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-customer.js'), 'utf8');
  const file = 'src/im-adapter-dingtalk.js';
  assert.ok(packageJson.build.files.includes(file), `default package includes ${file}`);
  assert.ok(builder.includes(`'${file}'`), `customer package includes ${file}`);
}

// ---------------------------------------------------------------------------
// Message radar (dws chat message list polling)
// ---------------------------------------------------------------------------

function dtMessage(overrides = {}) {
  return {
    content: '好好干，将来上市我记着大家的功劳 @所有人',
    createTime: '2026-08-19 16:42:19',
    openConversationId: 'gid1',
    openMessageId: 'msg-1',
    sender: '张总',
    senderOpenDingTalkId: 'boss01',
    ...overrides
  };
}

function dwsOutput(messages) {
  return JSON.stringify({ success: true, result: { hasMore: false, messages, nextCursor: 0 } });
}

function msgRadarRules() {
  // callHangup disabled isolates the message radar from voice-call polling.
  return baseRules({ callHangup: { enabled: false, cooldownSec: 60 } });
}

async function testMessageRadarGroupAtAllEmits() {
  const events = [];
  const calls = [];
  await withAdapter({
    locateIncomingCall: async () => null,
    invokeReject: async () => true,
    getMessagesConfig: () => ({ enabled: true, pollMs: 200, bossOpenIds: ['boss01'], groups: ['gid1'] }),
    runDws: async (args) => {
      calls.push(args);
      return dwsOutput([dtMessage()]);
    },
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: msgRadarRules(),
      onMessage: (event) => events.push(event)
    });
    await delay(450);
    assert.strictEqual(events.length, 1, '群 @所有人 老板消息应 emit');
    assert.strictEqual(events[0].platform, 'dingtalk');
    assert.strictEqual(events[0].kind, 'message');
    assert.strictEqual(events[0].senderId, 'boss01');
    assert.strictEqual(events[0].senderName, '张总');
    assert.strictEqual(events[0].chatType, 'group');
    assert.ok(events[0].text.includes('上市'));
    const firstCall = calls.find((c) => c.includes('--group'));
    assert.ok(firstCall, '应通过 --group 拉群消息');
    assert.ok(firstCall.includes('gid1'));
    assert.ok(firstCall.includes('--direction'));
    assert.ok(firstCall.includes('newer'));
    assert.ok(firstCall.includes('--time'));
  });
}

async function testMessageRadarGroupNonAtAllIgnored() {
  const events = [];
  await withAdapter({
    locateIncomingCall: async () => null,
    invokeReject: async () => true,
    getMessagesConfig: () => ({ enabled: true, pollMs: 200, bossOpenIds: ['boss01'], groups: ['gid1'] }),
    runDws: async () => dwsOutput([dtMessage({ content: '今天天气不错', openMessageId: 'msg-2' })]),
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: msgRadarRules(),
      onMessage: (event) => events.push(event)
    });
    await delay(450);
    assert.strictEqual(events.length, 0, '群消息不带 @所有人 不应 emit');
  });
}

async function testMessageRadarP2PEmitsWithoutAtAll() {
  const events = [];
  const calls = [];
  await withAdapter({
    locateIncomingCall: async () => null,
    invokeReject: async () => true,
    getMessagesConfig: () => ({ enabled: true, pollMs: 200, bossOpenIds: ['boss01'], groups: [] }),
    runDws: async (args) => {
      calls.push(args);
      return dwsOutput([dtMessage({ content: '来我办公室一下', openMessageId: 'msg-3' })]);
    },
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: msgRadarRules(),
      onMessage: (event) => events.push(event)
    });
    await delay(450);
    assert.strictEqual(events.length, 1, '老板单聊消息无需 @所有人 应 emit');
    assert.strictEqual(events[0].chatType, 'p2p');
    const p2pCall = calls.find((c) => c.includes('--open-dingtalk-id'));
    assert.ok(p2pCall, '应通过 --open-dingtalk-id 拉老板单聊');
    assert.ok(p2pCall.includes('boss01'));
  });
}

async function testMessageRadarNonBossIgnored() {
  const events = [];
  await withAdapter({
    locateIncomingCall: async () => null,
    invokeReject: async () => true,
    getMessagesConfig: () => ({ enabled: true, pollMs: 200, bossOpenIds: ['boss01'], groups: ['gid1'] }),
    runDws: async () => dwsOutput([
      dtMessage({ sender: '同事甲', senderOpenDingTalkId: 'colleague01', openMessageId: 'msg-4', content: '@所有人 开会' })
    ]),
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: msgRadarRules(),
      onMessage: (event) => events.push(event)
    });
    await delay(450);
    assert.strictEqual(events.length, 0, '非老板发送的消息不应 emit');
  });
}

async function testMessageRadarDedupesAcrossPolls() {
  const events = [];
  await withAdapter({
    locateIncomingCall: async () => null,
    invokeReject: async () => true,
    getMessagesConfig: () => ({ enabled: true, pollMs: 200, bossOpenIds: ['boss01'], groups: ['gid1'] }),
    runDws: async () => dwsOutput([dtMessage()]),
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: msgRadarRules(),
      onMessage: (event) => events.push(event)
    });
    await delay(650);
    assert.strictEqual(events.length, 1, '同一 openMessageId 跨轮询只 emit 一次');
  });
}

async function testMessageRadarDisabledConfigDoesNotPoll() {
  let dwsCalls = 0;
  await withAdapter({
    locateIncomingCall: async () => null,
    invokeReject: async () => true,
    getMessagesConfig: () => ({ enabled: false, pollMs: 200, bossOpenIds: ['boss01'], groups: ['gid1'] }),
    runDws: async () => {
      dwsCalls += 1;
      return dwsOutput([]);
    },
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: msgRadarRules(),
      onMessage: () => { throw new Error('disabled config 不应 emit'); }
    });
    await delay(450);
    assert.strictEqual(dwsCalls, 0, 'dingtalk.enabled=false 不应调用 dws');
  });
}

async function testMessageRadarEmptyListsDoesNotPoll() {
  let dwsCalls = 0;
  await withAdapter({
    locateIncomingCall: async () => null,
    invokeReject: async () => true,
    getMessagesConfig: () => ({ enabled: true, pollMs: 200, bossOpenIds: [], groups: [] }),
    runDws: async () => {
      dwsCalls += 1;
      return dwsOutput([]);
    },
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: msgRadarRules(),
      onMessage: () => { throw new Error('empty lists 不应 emit'); }
    });
    await delay(450);
    assert.strictEqual(dwsCalls, 0, 'bossOpenIds 与 groups 均为空不应轮询');
  });
}

async function testMessageRadarBadOutputDoesNotCrash() {
  const events = [];
  await withAdapter({
    locateIncomingCall: async () => null,
    invokeReject: async () => true,
    getMessagesConfig: () => ({ enabled: true, pollMs: 200, bossOpenIds: ['boss01'], groups: ['gid1'] }),
    runDws: async () => 'some warning line\n{broken json',
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: msgRadarRules(),
      onMessage: (event) => events.push(event)
    });
    await delay(450);
    assert.strictEqual(events.length, 0, '坏输出不应崩溃也不应 emit');
    assert.strictEqual(adapter.getLastLocated(), null);
  });
}

function testParseDwsJsonSkipsWarnings() {
  assert.deepStrictEqual(parseDwsJson('warn line\n{"ok":1}'), { ok: 1 });
  assert.strictEqual(parseDwsJson('no json here'), null);
  assert.strictEqual(parseDwsJson('{"broken'), null);
  assert.strictEqual(parseDwsJson(''), null);
}

function testExtractDingtalkMessage() {
  const extracted = extractDingtalkMessage(dtMessage());
  assert.strictEqual(extracted.messageId, 'msg-1');
  assert.strictEqual(extracted.senderId, 'boss01');
  assert.strictEqual(extracted.senderName, '张总');
  assert.ok(extracted.content.includes('@所有人'));
  assert.strictEqual(extractDingtalkMessage({ content: 'x' }), null, '缺 openMessageId 应返回 null');
  assert.strictEqual(extractDingtalkMessage(null), null);
}

function testFormatDwsTime() {
  const d = new Date(2026, 7, 19, 9, 5, 3);
  assert.strictEqual(formatDwsTime(d.getTime()), '2026-08-19 09:05:03');
}

async function testMessageRadarSystemMessagesIgnored() {
  const events = [];
  await withAdapter({
    locateIncomingCall: async () => null,
    invokeReject: async () => true,
    getMessagesConfig: () => ({ enabled: true, pollMs: 200, bossOpenIds: ['boss01'], groups: [] }),
    runDws: async () => dwsOutput([
      dtMessage({ content: '[语音通话] 已拒绝', openMessageId: 'sys-1' }),
      dtMessage({ content: '[图片]', openMessageId: 'sys-2' }),
      dtMessage({ content: '[文件] 周报.xlsx', openMessageId: 'sys-3' }),
      dtMessage({ content: '项目要上市了', openMessageId: 'txt-1' })
    ]),
    pollMs: 20
  }, async (adapter) => {
    await adapter.start({
      rules: msgRadarRules(),
      onMessage: (event) => events.push(event)
    });
    await delay(450);
    assert.strictEqual(events.length, 1, '系统/媒体占位消息应被过滤，真实文本保留');
    assert.ok(events[0].text.includes('上市'));
  });
}

function testIsSystemContent() {
  assert.strictEqual(isSystemContent('[语音通话] 已拒绝'), true);
  assert.strictEqual(isSystemContent(' [图片]'), true);
  assert.strictEqual(isSystemContent('[文件] 周报.xlsx'), true);
  assert.strictEqual(isSystemContent('大家好好干，将来上市'), false);
  assert.strictEqual(isSystemContent('[语音通话] 已拒绝，今天开会'), true, '前缀匹配即可');
  assert.strictEqual(isSystemContent('关于[语音通话]的说明'), false, '正文中间出现不算系统消息');
  assert.strictEqual(isSystemContent(''), false);
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
  testShouldInvokeRejectWhenFootOnInsetButton,
  testShouldInvokeRejectWhenPetOnRightOfCallWindow,
  testShouldInvokeRejectWhenFarAway,
  testPackWhitelistIncludesDingtalkAdapter,
  testMessageRadarGroupAtAllEmits,
  testMessageRadarGroupNonAtAllIgnored,
  testMessageRadarP2PEmitsWithoutAtAll,
  testMessageRadarNonBossIgnored,
  testMessageRadarDedupesAcrossPolls,
  testMessageRadarDisabledConfigDoesNotPoll,
  testMessageRadarEmptyListsDoesNotPoll,
  testMessageRadarBadOutputDoesNotCrash,
  testParseDwsJsonSkipsWarnings,
  testExtractDingtalkMessage,
  testFormatDwsTime,
  testMessageRadarSystemMessagesIgnored,
  testIsSystemContent
];

Promise.all(tasks.map((t) => t())).then(
  () => { console.log('im-adapter-dingtalk: all tests passed'); },
  (e) => { console.error('FAIL:', e.message); process.exit(1); }
);
