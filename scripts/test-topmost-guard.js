#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createTopmostGuard } = require('../src/topmost-guard');

function createWindow() {
  const calls = [];
  let destroyed = false;
  return {
    calls,
    destroy: () => { destroyed = true; },
    isDestroyed: () => destroyed,
    setAlwaysOnTop: (...args) => calls.push(['setAlwaysOnTop', ...args]),
    moveTop: () => calls.push(['moveTop'])
  };
}

{
  const window = createWindow();
  const guard = createTopmostGuard({ getWindow: () => window });
  assert.strictEqual(guard.isEnabled(), true);
  assert.strictEqual(guard.ensure(), true);
  assert.deepStrictEqual(window.calls, [
    ['setAlwaysOnTop', true, 'screen-saver'],
    ['moveTop']
  ]);

  window.calls.length = 0;
  guard.setEnabled(false);
  assert.strictEqual(guard.isEnabled(), false);
  assert.deepStrictEqual(window.calls, [['setAlwaysOnTop', false]]);
  assert.strictEqual(guard.ensure(), false);
  assert.deepStrictEqual(window.calls, [['setAlwaysOnTop', false]]);

  window.calls.length = 0;
  guard.setEnabled(true);
  assert.strictEqual(guard.isEnabled(), true);
  assert.deepStrictEqual(window.calls, [
    ['setAlwaysOnTop', true, 'screen-saver'],
    ['moveTop']
  ]);

  window.calls.length = 0;
  window.destroy();
  assert.strictEqual(guard.ensure(), false);
  assert.deepStrictEqual(window.calls, []);
}

{
  const projectRoot = path.resolve(__dirname, '..');
  const main = fs.readFileSync(path.join(projectRoot, 'src', 'main-v3.js'), 'utf8');
  const builder = fs.readFileSync(path.join(projectRoot, 'scripts', 'build-customer.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.match(main, /createTopmostGuard/);
  assert.match(main, /ensureOnTop:/);
  assert.match(main, /always-on-top-changed/);
  assert.ok(packageJson.build.files.includes('src/topmost-guard.js'));
  assert.ok(builder.includes("'src/topmost-guard.js'"));
}

console.log('topmost guard checks passed');
