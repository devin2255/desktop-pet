'use strict';
const assert = require('assert');
const { createEventHold } = require('../src/event-hold');

function createClock() {
  let now = 0;
  const timeouts = [];
  let nextId = 1;
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = nextId++;
      timeouts.push({ id, fn, due: now + Math.max(0, Number(ms) || 0) });
      return id;
    },
    clearTimeout(id) {
      const index = timeouts.findIndex((item) => item.id === id);
      if (index >= 0) timeouts.splice(index, 1);
    },
    advance(ms) {
      now += ms;
      const due = timeouts.filter((item) => item.due <= now).sort((a, b) => a.due - b.due);
      for (const item of due) {
        const index = timeouts.indexOf(item);
        if (index >= 0) timeouts.splice(index, 1);
        item.fn();
      }
    }
  };
}

function testHoldBlocksUntilTimer() {
  const clock = createClock();
  const calls = { pause: 0, resume: 0, pausePerch: 0 };
  const hold = createEventHold({
    now: clock.now,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    pauseBehavior: () => { calls.pause += 1; },
    resumeBehavior: () => { calls.resume += 1; },
    pausePerchedIdle: () => { calls.pausePerch += 1; }
  });
  hold.begin(5000);
  assert.strictEqual(calls.pause, 1);
  assert.strictEqual(calls.pausePerch, 1);
  assert.strictEqual(hold.isHeld(), true);
  clock.advance(4999);
  assert.strictEqual(hold.isHeld(), true);
  assert.strictEqual(calls.resume, 0);
  clock.advance(1);
  assert.strictEqual(hold.isHeld(), false);
  assert.strictEqual(calls.resume, 1);
}

function testSpeechHoldCoversBubbleAndAudio() {
  const hold = createEventHold({
    now: () => 0,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
    pauseBehavior: () => {},
    resumeBehavior: () => {},
    pausePerchedIdle: () => {}
  });
  assert.ok(hold.durationForSpeech('爸') >= 8000, 'short lines still hold long enough for audio');
  assert.ok(hold.durationForSpeech('这孙子在画饼，狗都不吃！') >= 4000);
}

function testLaterEventExtendsHold() {
  const clock = createClock();
  const calls = { resume: 0 };
  const hold = createEventHold({
    now: clock.now,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    pauseBehavior: () => {},
    resumeBehavior: () => { calls.resume += 1; },
    pausePerchedIdle: () => {}
  });
  hold.begin(5000);
  clock.advance(2000);
  hold.begin(8000);
  clock.advance(5000);
  assert.strictEqual(hold.isHeld(), true, 'second event must keep the hold');
  assert.strictEqual(calls.resume, 0);
  clock.advance(3000);
  assert.strictEqual(hold.isHeld(), false);
  assert.strictEqual(calls.resume, 1);
}

function testTaskHoldWaitsForResult() {
  const clock = createClock();
  const calls = { resume: 0 };
  const hold = createEventHold({
    now: clock.now,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    pauseBehavior: () => {},
    resumeBehavior: () => { calls.resume += 1; },
    pausePerchedIdle: () => {}
  });
  hold.beginTask();
  assert.strictEqual(hold.isHeld(), true);
  clock.advance(10000);
  assert.strictEqual(hold.isHeld(), true, 'task wait must outlast random sit/reaction timers');
  hold.beginForSpeech('本周群里全是画饼');
  clock.advance(1000);
  assert.strictEqual(calls.resume, 0);
  clock.advance(hold.durationForSpeech('本周群里全是画饼'));
  assert.strictEqual(hold.isHeld(), false);
  assert.strictEqual(calls.resume, 1);
}

const tests = {
  testHoldBlocksUntilTimer,
  testSpeechHoldCoversBubbleAndAudio,
  testLaterEventExtendsHold,
  testTaskHoldWaitsForResult
};
let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL - ${name}: ${e.message}`); }
}
if (failed) process.exit(1);
console.log('event-hold: all tests passed');
