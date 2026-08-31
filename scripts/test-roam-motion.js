'use strict';
const assert = require('assert');
const { nextRoamTarget, crawlIdleState } = require('../src/roam-motion');

assert.strictEqual(crawlIdleState('left'), 'crawl-left');
assert.strictEqual(crawlIdleState('right'), 'crawl-right');
assert.strictEqual(crawlIdleState(''), 'crawl-right');

const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
const width = 160;
{
  const { targetX, direction } = nextRoamTarget({ x: 0, width }, workArea, () => 0, 'left');
  assert.strictEqual(direction, 'right');
  assert.ok(targetX > 0);
}
{
  const x = workArea.x + workArea.width - width;
  const { direction } = nextRoamTarget({ x, width }, workArea, () => 0, 'right');
  assert.strictEqual(direction, 'left');
}
console.log('roam-motion: all tests passed');
