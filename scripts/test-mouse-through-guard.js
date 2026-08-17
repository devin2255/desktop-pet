#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createMouseThroughGuard } = require('../src/mouse-through-guard');

const calls = [];
let cursor = { x: 900, y: 700 };
const window = {
  isDestroyed: () => false,
  getBounds: () => ({ x: 100, y: 200, width: 160, height: 180 }),
  setIgnoreMouseEvents: (...args) => calls.push(args)
};
const scheduled = [];
const guard = createMouseThroughGuard({
  getWindow: () => window,
  getCursorPoint: () => cursor,
  schedule: (callback) => { scheduled.push(callback); return callback; },
  cancel: () => {}
});

guard.set(true);
assert.deepStrictEqual(calls.at(-1), [true, { forward: true }]);
assert.strictEqual(scheduled.length, 1, 'passthrough starts cursor recovery polling');

scheduled.shift()();
assert.strictEqual(guard.isIgnoring(), true, 'cursor outside keeps passthrough enabled');

cursor = { x: 180, y: 280 };
scheduled.shift()();
assert.strictEqual(guard.isIgnoring(), false, 'cursor entering the pet window restores hit testing');
assert.deepStrictEqual(calls.at(-1), [false, { forward: true }]);

guard.dispose();
console.log('mouse-through guard checks passed');
