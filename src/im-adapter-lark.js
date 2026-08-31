'use strict';
const { createMessageWatcher } = require('./message-watcher');

function createLarkAdapter({ voice, sendState, onStatus, larkCliPath, spawnExec, rng } = {}) {
  let watcher = null;
  return {
    platform: 'lark',
    start({ rules } = {}) {
      watcher?.stop?.();
      watcher = createMessageWatcher({
        rules, voice, sendState, onStatus, larkCliPath, spawnExec, rng
      });
      watcher.start();
    },
    stop() {
      watcher?.stop?.();
      watcher = null;
    }
  };
}

module.exports = { createLarkAdapter };
