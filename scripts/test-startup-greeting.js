'use strict';
const assert = require('assert');
const { validateManifest } = require('../src/petpack-validator');

function resolveStartupGreeting(manifest, { switching = false } = {}) {
  const { resolveStartupGreeting: resolve } = require('../src/startup-greeting');
  return resolve(manifest, { switching });
}

assert.strictEqual(
  resolveStartupGreeting({ name: '牛斯克' }),
  '我是牛斯克。'
);
assert.strictEqual(
  resolveStartupGreeting({ name: '牛斯克' }, { switching: true }),
  '你好，我是牛斯克。'
);
assert.strictEqual(
  resolveStartupGreeting({ name: '老婆', startupGreeting: '老公，我来啦~' }),
  '老公，我来啦~'
);
assert.strictEqual(
  resolveStartupGreeting({ name: '老婆', startupGreeting: '老公，我来啦~' }, { switching: true }),
  '老公，我来啦~'
);
assert.strictEqual(
  resolveStartupGreeting({ name: '老婆', startupGreeting: '   ' }),
  '我是老婆。'
);

const base = {
  schemaVersion: 1,
  id: 'demo',
  name: '演示',
  preview: 'preview.png',
  animations: {
    idle: { frames: ['a/1.png', 'a/2.png', 'a/3.png', 'a/4.png'], durations: [100, 100, 100, 100], loop: true },
    walk: { frames: ['b/1.png', 'b/2.png', 'b/3.png', 'b/4.png', 'b/5.png', 'b/6.png'], durations: [100, 100, 100, 100, 100, 100], loop: true },
    sit: { frames: ['c/1.png', 'c/2.png', 'c/3.png', 'c/4.png'], durations: [100, 100, 100, 100], loop: false },
    sleep: { frames: ['d/1.png', 'd/2.png', 'd/3.png', 'd/4.png'], durations: [100, 100, 100, 100], loop: true },
    reaction: { frames: ['e/1.png', 'e/2.png', 'e/3.png', 'e/4.png'], durations: [100, 100, 100, 100], loop: false }
  }
};
assert.doesNotThrow(() => validateManifest({ ...base, startupGreeting: '老公，我来啦~' }));
assert.throws(() => validateManifest({ ...base, startupGreeting: 'x'.repeat(81) }), /startupGreeting/);
console.log('startup greeting checks passed');
