'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createImBus } = require('../src/im-bus');

function makeFakeAdapter(platform = 'dingtalk') {
  return {
    platform,
    start({ onMessage, onVoiceCall }) {
      this.emit = { onMessage, onVoiceCall };
    },
    stop() {
      this.stopped = true;
    }
  };
}

function baseRules(overrides = {}) {
  return {
    enabled: true,
    platforms: ['lark', 'dingtalk'],
    ids: ['ou_1'],
    names: ['张总'],
    quietHours: [],
    callHangup: { enabled: false, cooldownSec: 60 },
    ...overrides
  };
}

const bossPie = {
  platform: 'dingtalk',
  kind: 'message',
  eventId: 'e-pie',
  senderId: '',
  senderName: '张总',
  text: '年底给你画饼',
  chatType: 'p2p'
};

const bossCall = {
  platform: 'dingtalk',
  kind: 'voice-call',
  eventId: 'c-boss',
  senderId: '',
  senderName: '张总',
  text: '张总邀请你语音通话',
  chatType: 'unknown'
};

async function testBossMessageDispatches() {
  const dispatched = [];
  const adapter = makeFakeAdapter();
  const bus = createImBus({
    getRules: () => baseRules(),
    adapters: [adapter],
    dispatchMessage: (event, rules) => dispatched.push({ event, rules }),
    onVoiceCall: () => {}
  });
  await bus.start();
  adapter.emit.onMessage(bossPie);
  assert.strictEqual(dispatched.length, 1, '老板画饼应调用 dispatchMessage');
  assert.strictEqual(dispatched[0].event.eventId, 'e-pie');
}

async function testNonBossDoesNotDispatch() {
  const dispatched = [];
  const adapter = makeFakeAdapter();
  const bus = createImBus({
    getRules: () => baseRules(),
    adapters: [adapter],
    dispatchMessage: (event) => dispatched.push(event),
    onVoiceCall: () => {}
  });
  await bus.start();
  adapter.emit.onMessage({
    ...bossPie,
    eventId: 'e-other',
    senderName: '同事甲',
    text: '年底给你画饼'
  });
  assert.strictEqual(dispatched.length, 0, '非老板不调用 dispatchMessage');
}

async function testCallHangupDisabledSkipsVoiceCall() {
  const calls = [];
  const adapter = makeFakeAdapter();
  const bus = createImBus({
    getRules: () => baseRules({ callHangup: { enabled: false, cooldownSec: 60 } }),
    adapters: [adapter],
    dispatchMessage: () => {},
    onVoiceCall: (event) => calls.push(event)
  });
  await bus.start();
  adapter.emit.onVoiceCall(bossCall);
  assert.strictEqual(calls.length, 0, 'callHangup.enabled false 时不调用 onVoiceCall');
}

async function testCallHangupEnabledCallsOnVoiceCall() {
  const calls = [];
  const adapter = makeFakeAdapter();
  const bus = createImBus({
    getRules: () => baseRules({ callHangup: { enabled: true, cooldownSec: 60 } }),
    adapters: [adapter],
    dispatchMessage: () => {},
    onVoiceCall: (event) => calls.push(event)
  });
  await bus.start();
  adapter.emit.onVoiceCall(bossCall);
  assert.strictEqual(calls.length, 1, 'callHangup.enabled 且 matchBoss 时应调用 onVoiceCall');
}

async function testVoiceCallCooldownSkipsSecondCall() {
  const calls = [];
  const adapter = makeFakeAdapter();
  const bus = createImBus({
    getRules: () => baseRules({ callHangup: { enabled: true, cooldownSec: 60 } }),
    adapters: [adapter],
    dispatchMessage: () => {},
    onVoiceCall: (event) => calls.push(event)
  });
  await bus.start();
  adapter.emit.onVoiceCall(bossCall);
  adapter.emit.onVoiceCall(bossCall);
  assert.strictEqual(calls.length, 1, '冷却期内第二次相同来电不调用 onVoiceCall');
}

async function testVoiceCallCooldownKeysByPersonNotEventId() {
  const calls = [];
  const adapter = makeFakeAdapter();
  const bus = createImBus({
    getRules: () => baseRules({ callHangup: { enabled: true, cooldownSec: 60 } }),
    adapters: [adapter],
    dispatchMessage: () => {},
    onVoiceCall: (event) => calls.push(event)
  });
  await bus.start();
  adapter.emit.onVoiceCall({ ...bossCall, eventId: 'c-boss-1' });
  adapter.emit.onVoiceCall({ ...bossCall, eventId: 'c-boss-2' });
  assert.strictEqual(calls.length, 1, '同一张总不同 eventId 在冷却期内只触发一次');
}

async function testNonBossVoiceCallSkipped() {
  const calls = [];
  const adapter = makeFakeAdapter();
  const bus = createImBus({
    getRules: () => baseRules({ callHangup: { enabled: true, cooldownSec: 60 } }),
    adapters: [adapter],
    dispatchMessage: () => {},
    onVoiceCall: (event) => calls.push(event)
  });
  await bus.start();
  adapter.emit.onVoiceCall({
    ...bossCall,
    eventId: 'c-other',
    senderName: '同事甲',
    text: '同事甲邀请你语音通话'
  });
  assert.strictEqual(calls.length, 0, '非老板来电不调用 onVoiceCall');
}

function testPackWhitelistIncludesImModules() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const builder = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-customer.js'), 'utf8');
  for (const file of [
    'src/im-bus.js',
    'src/im-adapter-lark.js',
    'src/im-match.js',
    'src/approach-target.js'
  ]) {
    assert.ok(packageJson.build.files.includes(file), `default package includes ${file}`);
    assert.ok(builder.includes(`'${file}'`), `customer package includes ${file}`);
  }
}

async function testQuietHoursSkipVoiceCall() {
  const calls = [];
  const adapter = makeFakeAdapter();
  const bus = createImBus({
    getRules: () => baseRules({
      quietHours: [['00:00', '24:00']],
      callHangup: { enabled: true, cooldownSec: 60 }
    }),
    adapters: [adapter],
    dispatchMessage: () => {},
    onVoiceCall: (event) => calls.push(event)
  });
  await bus.start();
  adapter.emit.onVoiceCall(bossCall);
  assert.strictEqual(calls.length, 0, '静默时段不调用 onVoiceCall');
}

async function testPlatformsSkipAdapter() {
  const adapter = makeFakeAdapter('dingtalk');
  const bus = createImBus({
    getRules: () => baseRules({ platforms: ['lark'] }),
    adapters: [adapter],
    dispatchMessage: () => {},
    onVoiceCall: () => {}
  });
  await bus.start();
  assert.strictEqual(adapter.emit, undefined, 'platforms 不含 dingtalk 时不应 start 该适配器');
  assert.strictEqual(bus.isStarted(), true);
}

async function testEnabledFalseDoesNotStart() {
  const adapter = makeFakeAdapter();
  const bus = createImBus({
    getRules: () => baseRules({ enabled: false }),
    adapters: [adapter],
    dispatchMessage: () => {},
    onVoiceCall: () => {}
  });
  await bus.start();
  assert.strictEqual(bus.isStarted(), false, 'rules.enabled false 时 isStarted 保持 false');
  assert.strictEqual(adapter.emit, undefined, 'rules.enabled false 时不应 start 适配器');
}

async function testAdapterStartErrorIsSwallowed() {
  const warnings = [];
  const adapter = {
    platform: 'dingtalk',
    async start() { throw new Error('boom'); },
    stop() {}
  };
  const bus = createImBus({
    getRules: () => baseRules(),
    adapters: [adapter],
    dispatchMessage: () => {},
    onVoiceCall: () => {},
    logger: { warn: (platform, err) => warnings.push({ platform, err }) }
  });
  await bus.start();
  assert.strictEqual(bus.isStarted(), true);
  assert.strictEqual(warnings.length, 1);
  assert.strictEqual(warnings[0].platform, 'dingtalk');
}

const tasks = [
  testBossMessageDispatches,
  testNonBossDoesNotDispatch,
  testCallHangupDisabledSkipsVoiceCall,
  testCallHangupEnabledCallsOnVoiceCall,
  testVoiceCallCooldownSkipsSecondCall,
  testVoiceCallCooldownKeysByPersonNotEventId,
  testNonBossVoiceCallSkipped,
  testQuietHoursSkipVoiceCall,
  testPlatformsSkipAdapter,
  testEnabledFalseDoesNotStart,
  testAdapterStartErrorIsSwallowed,
  testPackWhitelistIncludesImModules
];

Promise.all(tasks.map((t) => t())).then(
  () => { console.log('im-bus: all tests passed'); },
  (e) => { console.error('FAIL:', e.message); process.exit(1); }
);
