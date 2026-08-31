'use strict';

function clientPointFromScreen(cursor, bounds) {
  const x = cursor.x - bounds.x;
  const y = cursor.y - bounds.y;
  return {
    x,
    y,
    inWindow: x >= 0 && y >= 0 && x < bounds.width && y < bounds.height
  };
}

function createMouseThroughSampler({
  getWindow,
  getCursor,
  sendSample,
  intervalMs = 50,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval
} = {}) {
  if (typeof getWindow !== 'function' || typeof getCursor !== 'function' || typeof sendSample !== 'function') {
    throw new TypeError('mouse-through sampler requires getWindow, getCursor, and sendSample');
  }

  let timer;

  function tick() {
    const window = getWindow();
    if (!window || window.isDestroyed?.()) return;
    const bounds = window.getContentBounds?.();
    if (!bounds) return;
    const point = clientPointFromScreen(getCursor(), bounds);
    if (point.inWindow) sendSample({ x: point.x, y: point.y });
  }

  function start() {
    if (timer !== undefined) return;
    timer = setIntervalFn(tick, intervalMs);
  }

  function stop() {
    if (timer === undefined) return;
    clearIntervalFn(timer);
    timer = undefined;
  }

  return { start, stop, tick };
}

module.exports = { clientPointFromScreen, createMouseThroughSampler };
