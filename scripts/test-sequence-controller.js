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
seq.cancel();
assert.strictEqual(seq.isActive(), false);
assert.strictEqual(calls.states.at(-1).action, 'idle');

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
  assert.ok(moves.some((move) => move.x === origin.x && move.y === origin.y), 'restorePosition should move back to restoreFrom');
  assert.strictEqual(seq2.isActive(), false);
}

testApproachWaitsUntilArrivedOrTimeout();

console.log('test-sequence-controller: ok');
