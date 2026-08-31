'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  clientPointFromScreen,
  createMouseThroughSampler
} = require('../src/mouse-through');

assert.deepStrictEqual(
  clientPointFromScreen({ x: 120, y: 80 }, { x: 100, y: 50, width: 180, height: 180 }),
  { x: 20, y: 30, inWindow: true }
);
assert.strictEqual(
  clientPointFromScreen({ x: 10, y: 80 }, { x: 100, y: 50, width: 180, height: 180 }).inWindow,
  false,
  'cursor outside the pet window must not be treated as a hit sample'
);

{
  const samples = [];
  const sampler = createMouseThroughSampler({
    getWindow: () => ({
      isDestroyed: () => false,
      getContentBounds: () => ({ x: 100, y: 200, width: 180, height: 180 })
    }),
    getCursor: () => ({ x: 150, y: 260 }),
    sendSample: (point) => samples.push(point),
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });
  sampler.tick();
  assert.deepStrictEqual(samples, [{ x: 50, y: 60 }], 'cursor over the pet window must sample even without mousemove');
}

{
  const samples = [];
  const sampler = createMouseThroughSampler({
    getWindow: () => ({
      isDestroyed: () => false,
      getContentBounds: () => ({ x: 100, y: 200, width: 180, height: 180 })
    }),
    getCursor: () => ({ x: 10, y: 10 }),
    sendSample: (point) => samples.push(point),
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });
  sampler.tick();
  assert.deepStrictEqual(samples, [], 'cursor outside the pet window must not sample');
}

{
  const projectRoot = path.resolve(__dirname, '..');
  const main = fs.readFileSync(path.join(projectRoot, 'src', 'main-v3.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(projectRoot, 'src', 'renderer-v3.js'), 'utf8');
  const preload = fs.readFileSync(path.join(projectRoot, 'src', 'preload-v3.js'), 'utf8');
  const builder = fs.readFileSync(path.join(projectRoot, 'scripts', 'build-customer.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.match(main, /createMouseThroughSampler/);
  assert.match(main, /pet:cursor-hit-sample/);
  assert.match(main, /options\.force === true/);
  assert.match(main, /setAlwaysOnTop\(true, 'screen-saver'\)/);
  assert.match(preload, /onCursorHitSample/);
  assert.match(renderer, /onCursorHitSample/);
  assert.match(renderer, /force:\s*true/);
  assert.ok(packageJson.build.files.includes('src/mouse-through.js'));
  assert.ok(builder.includes("'src/mouse-through.js'"));
}

console.log('mouse-through: all tests passed');
