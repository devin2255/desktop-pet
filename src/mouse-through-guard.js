'use strict';

function pointInside(bounds, point) {
  return point.x >= bounds.x && point.x < bounds.x + bounds.width
    && point.y >= bounds.y && point.y < bounds.y + bounds.height;
}

function createMouseThroughGuard({
  getWindow,
  getCursorPoint,
  schedule = (callback) => setTimeout(callback, 80),
  cancel = clearTimeout
} = {}) {
  if (typeof getWindow !== 'function' || typeof getCursorPoint !== 'function') {
    throw new TypeError('mouse-through guard requires window and cursor providers');
  }

  let ignoring = false;
  let recoveryTimer;
  let disposed = false;

  function usableWindow() {
    const window = getWindow();
    return window && !window.isDestroyed?.() ? window : null;
  }

  function stopRecovery() {
    if (recoveryTimer !== undefined) cancel(recoveryTimer);
    recoveryTimer = undefined;
  }

  function pollCursor() {
    recoveryTimer = undefined;
    if (disposed || !ignoring) return;
    const window = usableWindow();
    if (!window) return;
    if (pointInside(window.getBounds(), getCursorPoint())) {
      set(false);
      return;
    }
    recoveryTimer = schedule(pollCursor);
  }

  function set(ignore) {
    ignore = Boolean(ignore);
    if (disposed || ignoring === ignore) return false;
    const window = usableWindow();
    if (!window) return false;
    ignoring = ignore;
    window.setIgnoreMouseEvents(ignore, { forward: true });
    stopRecovery();
    if (ignore) recoveryTimer = schedule(pollCursor);
    return true;
  }

  function dispose() {
    disposed = true;
    stopRecovery();
  }

  return { set, isIgnoring: () => ignoring, dispose };
}

module.exports = { createMouseThroughGuard, pointInside };
