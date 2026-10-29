'use strict';

const assert = require('assert');
const {
  selectTargetWindow, selectTopSeatWindow, selectDisplayTopWindow, classifyWindowEdge, visibleRect,
  clampByVisibleBounds, clampIntoWorkAreas, positionForAttachment, nextFallFrame,
  estimateThrowVelocity, canThrow, nextThrowFrame
} = require('../src/window-interactions');

const windows = [
  { id: 'pet', bounds: { x: 0, y: 0, width: 100, height: 100 } },
  { id: 'front', bounds: { x: 100, y: 100, width: 500, height: 400 } },
  { id: 'back', bounds: { x: 80, y: 80, width: 600, height: 500 } }
];
assert.strictEqual(selectTargetWindow({ x: 110, y: 110 }, windows, new Set(['pet'])).id, 'front');
assert.strictEqual(
  selectDisplayTopWindow(
    { x: 350, y: 0 },
    [{ id: 'maximized', bounds: { x: 0, y: 8, width: 800, height: 592 } }],
    { x: 0, y: 0, width: 800, height: 600 }
  ).id,
  'maximized'
);
assert.strictEqual(
  selectDisplayTopWindow(
    { x: 350, y: -40 },
    [{ id: 'maximized', bounds: { x: 0, y: 8, width: 800, height: 592 } }],
    { x: 0, y: 0, width: 800, height: 600 }
  ),
  null,
  'releasing well above the display remains a fall gesture'
);
assert.strictEqual(classifyWindowEdge({ x: 110, y: 110 }, windows[1].bounds, 32), 'top');
assert.strictEqual(classifyWindowEdge({ x: 350, y: 490 }, windows[1].bounds, 32), 'bottom');
assert.strictEqual(
  selectTopSeatWindow({ x: 350, y: 80 }, null, null, windows, new Set(['pet']), 32).window.id,
  'front',
  'a pointer just above the title bar selects that window top'
);
assert.strictEqual(
  selectTopSeatWindow(
    { x: 40, y: 400 },
    { x: 320, y: -20, width: 100, height: 120 },
    { left: 0, top: 0, right: 0, bottom: 0 },
    windows,
    new Set(['pet']),
    32
  ).window.id,
  'front',
  'feet resting on the top edge select that window'
);
assert.strictEqual(
  selectTopSeatWindow({ x: 350, y: 40 }, null, null, windows, new Set(['pet']), 32),
  null,
  'a pointer well above the title bar is not a sit gesture'
);
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
const flick = estimateThrowVelocity([
  { x: 0, y: 0, t: 0 },
  { x: 160, y: 0, t: 40 }
], 40);
assert.ok(canThrow(flick), 'a fast drag is a throw');
assert.ok(flick.x > 300);
assert.strictEqual(canThrow(estimateThrowVelocity([{ x: 0, y: 0, t: 0 }], 0)), false);
const areas = [
  { x: 0, y: 0, width: 800, height: 600 },
  { x: 1000, y: 0, width: 800, height: 600 }
];
assert.deepStrictEqual(
  clampIntoWorkAreas({ x: 820, y: 100, width: 100, height: 120 }, { left: 0, top: 0, right: 0, bottom: 0 }, areas),
  { x: 700, y: 100 },
  'a body in the gap between displays is pulled back onto the nearer screen'
);
const bounced = nextThrowFrame({
  x: 700, y: 100, vx: 2000, vy: 0, width: 100, height: 120,
  insets: { left: 0, top: 0, right: 0, bottom: 0 }, elapsedMs: 16
}, areas);
assert.ok(bounced.x <= 700, 'a throw does not come to rest in the gap');
assert.ok(bounced.vx < 0, 'hitting the screen edge reverses horizontal speed');
console.log('window interaction geometry checks passed');
