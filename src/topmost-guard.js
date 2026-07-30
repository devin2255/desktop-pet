'use strict';

function createTopmostGuard({ getWindow, initiallyEnabled = true } = {}) {
  if (typeof getWindow !== 'function') {
    throw new TypeError('topmost guard requires getWindow');
  }

  let enabled = Boolean(initiallyEnabled);

  function usableWindow() {
    const window = getWindow();
    return window && !window.isDestroyed?.() ? window : null;
  }

  function ensure() {
    if (!enabled) return false;
    const window = usableWindow();
    if (!window) return false;
    window.setAlwaysOnTop(true, 'screen-saver');
    window.moveTop?.();
    return true;
  }

  function setEnabled(next) {
    enabled = Boolean(next);
    const window = usableWindow();
    if (!window) return false;
    if (!enabled) {
      window.setAlwaysOnTop(false);
      return true;
    }
    return ensure();
  }

  return {
    ensure,
    setEnabled,
    isEnabled: () => enabled
  };
}

module.exports = { createTopmostGuard };

