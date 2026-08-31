'use strict';
const assert = require('assert');
const { createSequenceController } = require('../src/sequence-controller');

const calls = { states: [], pause: 0, schedule: [] };
let manifest = {
  animations: {
    idle: {}, a: {}, b: {}, c: {}
  },
  sequences: {
    demo: {
      stages: [
        { action: 'a', message: 'one', duration: 100 },
        { action: 'b', messages: ['x', 'y'], messageGapMs: 50, waitForClick: true },
        { action: 'c', duration: 100 },
        { action: 'idle', duration: 0 }
      ]
    }
  }
};

const seq = createSequenceController({
  getManifest: () => manifest,
  sendState: (action, message, speech, extras) => {
    calls.states.push({ action, message, speech, extras });
  },
  pauseBehavior: () => { calls.pause += 1; },
  scheduleBehavior: (ms) => { calls.schedule.push(ms); },
  now: () => calls.now || 0,
  setTimer: (fn, ms) => {
    calls.timer = { fn, ms };
    return 1;
  },
  clearTimer: () => { calls.timer = null; }
});

assert.strictEqual(seq.start('demo'), true);
assert.strictEqual(calls.pause, 1);
assert.strictEqual(calls.states[0].action, 'a');
assert.strictEqual(seq.isWaitingForClick(), false);

// 推进到 waitForClick 阶段
calls.timer.fn();
assert.strictEqual(calls.states.at(-1).action, 'b');
assert.deepStrictEqual(calls.states.at(-1).extras.messages, ['x', 'y']);
assert.strictEqual(seq.isWaitingForClick(), true);

// 等待点击时忽略自动 timer
assert.strictEqual(seq.continueFromClick(), true);
assert.strictEqual(calls.states.at(-1).action, 'c');
assert.strictEqual(seq.isWaitingForClick(), false);

calls.timer.fn(); // c 结束 -> idle
assert.strictEqual(calls.states.at(-1).action, 'idle');
assert.strictEqual(seq.isActive(), false);
assert.ok(calls.schedule.length >= 1);

// cancel 中断
assert.strictEqual(seq.start('demo'), true);
let cancelledCleanupCalls = 0;
seq.onceFinished(() => { cancelledCleanupCalls += 1; });
seq.cancel();
assert.strictEqual(seq.isActive(), false);
assert.strictEqual(calls.states.at(-1).action, 'idle');
assert.strictEqual(cancelledCleanupCalls, 1, 'cancel must run sequence cleanup callbacks');

// start 失败时不 schedule；main-v3 菜单路径须在 false 时 scheduleBehavior(900)
const scheduleBeforeInvalid = calls.schedule.length;
assert.strictEqual(seq.start('missing'), false);
assert.strictEqual(calls.schedule.length, scheduleBeforeInvalid);

function testApproachWaitsUntilArrivedOrTimeout() {
  const moves = [];
  const calls = { states: [], contact: undefined, timer: null };
  const seq2 = createSequenceController({
    getManifest: () => ({
      animations: { idle: {}, 'call-climb': {}, 'call-mom-kick': {} },
      sequences: {
        'boss-call': {
          contacts: {
            climb: { action: 'call-climb', anchor: { x: 0.08, y: 0.38 } },
            hangup: { action: 'call-mom-kick', anchor: { x: 0.72, y: 0.96 } }
          },
          stages: [
            { action: 'call-climb', approachTarget: 'incoming-call-edge', messages: ['妈妈！'], messageLoop: true, messageGapMs: 1200, timeoutMs: 4000, speechAudio: 'audio/call-mom.mp3', speechLoop: true, speechGender: 'male' },
            { action: 'call-mom-kick', approachTarget: 'incoming-call-reject', timeoutMs: 1200, speechGender: 'female' },
            { action: 'idle', duration: 0, restorePosition: true }
          ]
        }
      }
    }),
    sendState: (action, message, speech, extras) => { calls.states.push({ action, message, extras }); },
    pauseBehavior: () => {},
    scheduleBehavior: () => {},
    setTimer: (fn, ms) => { calls.timer = { fn, ms }; return 1; },
    clearTimer: () => { calls.timer = null; },
    getPetBounds: () => ({ x: 0, y: 0, width: 200, height: 100 }),
    movePetWindow: (x, y) => moves.push({ x, y }),
    getApproachRect: (name) => name === 'incoming-call-edge'
      ? { x: 1000, y: 100, width: 280, height: 160 }
      : { x: 1180, y: 220, width: 60, height: 30 },
    onContact: (stage) => { calls.contact = stage.action; }
  });
  const origin = { x: 10, y: 20 };
  assert.strictEqual(seq2.start('boss-call', { restoreFrom: origin }), true);
  origin.x = 999;
  assert.strictEqual(calls.states.at(-1).action, 'call-climb');
  assert.strictEqual(calls.states.at(-1).extras.messageLoop, true);
  assert.strictEqual(calls.states.at(-1).extras.speechLoop, true);
  assert.strictEqual(calls.states.at(-1).extras.speechGender, 'male');
  assert.strictEqual(calls.states.at(-1).extras.speechAudio, 'audio/call-mom.mp3');
  assert.ok(moves.length >= 1);
  assert.ok(calls.timer && typeof calls.timer.fn === 'function', 'advance timeout must be the last scheduled timer');
  assert.strictEqual(calls.timer.ms, 4000);
  // 未到达时 timeout 到期 -> 下一场；onContact 仍不触发（脚未重叠）
  calls.timer.fn();
  assert.strictEqual(calls.states.at(-1).action, 'call-mom-kick');
  assert.strictEqual(calls.states.at(-1).extras.speechGender, 'female');
  assert.strictEqual(calls.contact, undefined);
  calls.timer.fn();
  assert.strictEqual(calls.states.at(-1).action, 'idle');
  assert.ok(moves.some((move) => move.x === 10 && move.y === 20), 'restorePosition should use a copied restoreFrom point');
  assert.strictEqual(seq2.isActive(), false);
}

testApproachWaitsUntilArrivedOrTimeout();

function testHangupContactFiresWhenKickOverlaps() {
  const calls = { states: [], contact: undefined, timer: null };
  const seq3 = createSequenceController({
    getManifest: () => ({
      animations: { idle: {}, 'call-mom-kick': {} },
      sequences: {
        'boss-call': {
          contacts: {
            hangup: { action: 'call-mom-kick', anchor: { x: 0.72, y: 0.96 } }
          },
          stages: [
            { action: 'call-mom-kick', duration: 1000 },
            { action: 'idle', duration: 0 }
          ]
        }
      }
    }),
    sendState: (action) => { calls.states.push(action); },
    pauseBehavior: () => {},
    scheduleBehavior: () => {},
    setTimer: (fn, ms) => { calls.timer = { fn, ms }; return 1; },
    clearTimer: () => { calls.timer = null; },
    getPetBounds: () => ({ x: 10, y: 10, width: 200, height: 100 }),
    getApproachRect: (name) => name === 'incoming-call-reject'
      ? { x: 140, y: 90, width: 40, height: 20 }
      : null,
    onContact: (stage) => { calls.contact = stage.action; }
  });
  assert.strictEqual(seq3.start('boss-call'), true);
  assert.strictEqual(calls.states.at(-1), 'call-mom-kick');
  assert.strictEqual(calls.contact, 'call-mom-kick');
}

testHangupContactFiresWhenKickOverlaps();

function createTimerMap() {
  let nextId = 1;
  const timers = new Map();
  return {
    timers,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimer: (id) => { timers.delete(id); },
    fire(id) {
      const timer = timers.get(id);
      if (timer) {
        timers.delete(id);
        timer.fn();
      }
    },
    findByMs(ms) {
      for (const [id, timer] of timers) {
        if (timer.ms === ms) return id;
      }
      return null;
    }
  };
}

function testStartSessionOverridesApproachCallbacks() {
  const calls = { contact: undefined, rectNames: [] };
  const seq = createSequenceController({
    getManifest: () => ({
      animations: { idle: {}, 'call-mom-kick': {} },
      sequences: {
        'boss-call': {
          contacts: {
            hangup: { action: 'call-mom-kick', anchor: { x: 0.72, y: 0.96 } }
          },
          stages: [
            { action: 'call-mom-kick', duration: 1000 },
            { action: 'idle', duration: 0 }
          ]
        }
      }
    }),
    sendState: () => {},
    pauseBehavior: () => {},
    scheduleBehavior: () => {},
    setTimer: (fn, ms) => 1,
    clearTimer: () => {},
    getApproachRect: () => null,
    getPetBounds: () => ({ x: 10, y: 10, width: 200, height: 100 }),
    onContact: () => { calls.contact = 'constructor'; }
  });
  assert.strictEqual(seq.start('boss-call', {
    getApproachRect: (name) => {
      calls.rectNames.push(name);
      return name === 'incoming-call-reject'
        ? { x: 140, y: 90, width: 40, height: 20 }
        : null;
    },
    onContact: (stage) => { calls.contact = stage.action; }
  }), true);
  assert.strictEqual(calls.contact, 'call-mom-kick');
  assert.ok(calls.rectNames.includes('incoming-call-reject'));
}

function testApproachPollTracksMovedWindow() {
  const clock = createTimerMap();
  const moves = [];
  let callRect = { x: 1000, y: 100, width: 280, height: 160 };
  const seq = createSequenceController({
    getManifest: () => ({
      animations: { idle: {}, 'call-climb': {}, 'call-mom-kick': {} },
      sequences: {
        'boss-call': {
          contacts: {
            climb: { action: 'call-climb', anchor: { x: 0.08, y: 0.38 } }
          },
          stages: [
            { action: 'call-climb', approachTarget: 'incoming-call-edge', timeoutMs: 4000 },
            { action: 'call-mom-kick', duration: 1000 }
          ]
        }
      }
    }),
    sendState: () => {},
    pauseBehavior: () => {},
    scheduleBehavior: () => {},
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    getPetBounds: () => ({ x: 0, y: 0, width: 200, height: 100 }),
    movePetWindow: (x, y) => moves.push({ x, y }),
    getApproachRect: (name) => name === 'incoming-call-edge' ? callRect : null
  });
  assert.strictEqual(seq.start('boss-call'), true);
  assert.ok(moves.length >= 1);
  const first = { ...moves.at(-1) };
  const pollId = clock.findByMs(50);
  const timeoutId = clock.findByMs(4000);
  assert.ok(pollId, 'start should schedule a 50ms poll');
  assert.ok(timeoutId, 'start should schedule a 4000ms timeout');
  callRect = { x: 1100, y: 120, width: 280, height: 160 };
  clock.fire(pollId);
  assert.ok(moves.length >= 2, 'poll should move again after the call window moves');
  assert.notDeepStrictEqual(moves.at(-1), first);

  const stalePoll = clock.timers.get(clock.findByMs(50));
  assert.ok(stalePoll, 'poll should reschedule after firing');
  clock.fire(timeoutId);
  const movesAfterAdvance = moves.length;
  stalePoll.fn();
  assert.strictEqual(moves.length, movesAfterAdvance, 'stale poll must not moveToward after the stage advanced');
}

testStartSessionOverridesApproachCallbacks();
testApproachPollTracksMovedWindow();

function testNonApproachStageHonorsTimeoutMs() {
  const calls = { states: [], timer: null };
  const seq = createSequenceController({
    getManifest: () => ({
      animations: { idle: {}, 'call-shout': {}, 'call-mom-approach': {} },
      sequences: {
        'boss-call': {
          stages: [
            { action: 'call-shout', timeoutMs: 5600, speechAudio: 'audio/call-mom.mp3' },
            { action: 'call-mom-approach', duration: 1500 }
          ]
        }
      }
    }),
    sendState: (action) => { calls.states.push(action); },
    pauseBehavior: () => {},
    scheduleBehavior: () => {},
    setTimer: (fn, ms) => { calls.timer = { fn, ms }; return 1; },
    clearTimer: () => { calls.timer = null; }
  });
  assert.strictEqual(seq.start('boss-call'), true);
  assert.strictEqual(calls.states.at(-1), 'call-shout');
  assert.strictEqual(calls.timer.ms, 5600, 'shout stage without approachTarget must still wait timeoutMs, not default 3000');
  calls.timer.fn();
  assert.strictEqual(calls.states.at(-1), 'call-mom-approach');
}

testNonApproachStageHonorsTimeoutMs();

function testFinishSendsIdleAfterDeactivating() {
  let seq;
  const events = [];
  seq = createSequenceController({
    getManifest: () => ({
      animations: { idle: {}, 'call-mom-kick': {} },
      sequences: {
        'boss-call': {
          stages: [
            { action: 'call-mom-kick', duration: 100 },
            { action: 'idle', duration: 0, restorePosition: true }
          ]
        }
      }
    }),
    sendState: (action) => events.push({ action, active: seq.isActive() }),
    pauseBehavior: () => {},
    scheduleBehavior: () => {},
    setTimer: (fn) => { events.timerFn = fn; return 1; },
    clearTimer: () => {},
    movePetWindow: () => {}
  });
  assert.strictEqual(seq.start('boss-call', { restoreFrom: { x: 10, y: 20 } }), true);
  events.timerFn();
  const last = events.at(-1);
  assert.strictEqual(last.action, 'idle');
  assert.strictEqual(last.active, false, 'idle after hangup must be sent once the sequence is inactive so the window size can restore');
}

testFinishSendsIdleAfterDeactivating();

console.log('test-sequence-controller: ok');
