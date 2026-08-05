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

console.log('test-sequence-controller: ok');
