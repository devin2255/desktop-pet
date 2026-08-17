'use strict';

const MIN_SPEECH_HOLD_MS = 8000;
const TASK_WAIT_MS = 90000;

function speechHoldMs(text) {
  const len = String(text || '').length;
  const bubbleMs = Math.max(4000, Math.min(30000, len * 300));
  return Math.max(MIN_SPEECH_HOLD_MS, bubbleMs);
}

function createEventHold({
  pauseBehavior,
  resumeBehavior,
  pausePerchedIdle,
  now = Date.now,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
} = {}) {
  let until = 0;
  let timer = null;
  let generation = 0;

  function isHeld() {
    return now() < until;
  }

  function begin(durationMs) {
    if (typeof pauseBehavior === 'function') pauseBehavior();
    if (typeof pausePerchedIdle === 'function') pausePerchedIdle();
    const ms = Math.max(600, Number(durationMs) || 0);
    until = now() + ms;
    if (timer !== null) clearTimeoutFn(timer);
    const token = ++generation;
    timer = setTimeoutFn(() => {
      if (token !== generation) return;
      timer = null;
      until = 0;
      if (typeof resumeBehavior === 'function') resumeBehavior();
    }, ms);
    return ms;
  }

  function beginForSpeech(text) {
    return begin(speechHoldMs(text));
  }

  function beginTask() {
    return begin(TASK_WAIT_MS);
  }

  function dispose() {
    generation += 1;
    if (timer !== null) clearTimeoutFn(timer);
    timer = null;
    until = 0;
  }

  return {
    isHeld,
    begin,
    beginForSpeech,
    beginTask,
    durationForSpeech: speechHoldMs,
    dispose
  };
}

module.exports = { createEventHold, speechHoldMs, MIN_SPEECH_HOLD_MS, TASK_WAIT_MS };
