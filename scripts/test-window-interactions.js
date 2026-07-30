'use strict';

const assert = require('assert');
const {
  selectTargetWindow, classifyWindowEdge, visibleRect,
  clampByVisibleBounds, positionForAttachment, nextFallFrame
} = require('../src/window-interactions');

const windows = [
  { id: 'pet', bounds: { x: 0, y: 0, width: 100, height: 100 } },
  { id: 'front', bounds: { x: 100, y: 100, width: 500, height: 400 } },
  { id: 'back', bounds: { x: 80, y: 80, width: 600, height: 500 } }
];
assert.strictEqual(selectTargetWindow({ x: 110, y: 110 }, windows, new Set(['pet'])).id, 'front');
assert.strictEqual(classifyWindowEdge({ x: 110, y: 110 }, windows[1].bounds, 32), 'top');
assert.strictEqual(classifyWindowEdge({ x: 350, y: 490 }, windows[1].bounds, 32), 'bottom');
assert.strictEqual(classifyWindowEdge({ x: 105, y: 300 }, windows[1].bounds, 32), 'left');
assert.strictEqual(classifyWindowEdge({ x: 350, y: 300 }, windows[1].bounds, 32), null);
assert.strictEqual(
  classifyWindowEdge({ x: 101, y: 130 }, windows[1].bounds, 32),
  'left',
  'the nearest eligible edge wins instead of priority order'
);
assert.strictEqual(
  classifyWindowEdge({ x: 101, y: 101 }, windows[1].bounds, 32),
  'top',
  'priority order breaks an exact distance tie'
);
assert.deepStrictEqual(
  visibleRect({ x: -20, y: -60, width: 220, height: 240 }, { left: 10, top: 60, right: 10, bottom: 5 }),
  { x: -10, y: 0, width: 200, height: 175 }
);
assert.deepStrictEqual(
  clampByVisibleBounds(
    { x: 20, y: -100, width: 220, height: 240 },
    { left: 10, top: 60, right: 10, bottom: 5 },
    { x: 0, y: 0, width: 1920, height: 1080 }
  ),
  { x: 20, y: -60 }
);
assert.deepStrictEqual(
  positionForAttachment(
    { x: 100, y: 100, width: 500, height: 400 }, 'top',
    { x: 0.5, y: 0.7 }, { width: 220, height: 240 },
    { left: 10, top: 20, right: 10, bottom: 5 }, 250
  ),
  { x: 240, y: -70 }
);
assert.deepStrictEqual(nextFallFrame({ y: 0, velocity: 0 }, 100, 1000), {
  y: 9, velocity: 180, landed: false
});
assert.deepStrictEqual(nextFallFrame({ y: 990, velocity: 1000 }, 100, 1000), {
  y: 1000, velocity: 1180, landed: true
});
console.log('window interaction geometry checks passed');
