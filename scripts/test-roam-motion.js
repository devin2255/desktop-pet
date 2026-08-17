'use strict';
const assert = require('assert');
const { nextRoamTarget, crawlIdleState } = require('../src/roam-motion');

const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
const width = 170;

function testTurnsAroundAtLeftEdge() {
  const { targetX, direction } = nextRoamTarget({ x: 0, width }, workArea, () => 0, 'left');
  assert.strictEqual(direction, 'right');
  assert.ok(targetX > 80, 'must walk inward from the left edge');
}

function testTurnsAroundAtRightEdge() {
  const x = 1920 - width;
  const { targetX, direction } = nextRoamTarget({ x, width }, workArea, () => 0, 'right');
  assert.strictEqual(direction, 'left');
  assert.ok(targetX < x - 80, 'must walk inward from the right edge');
}

function testMidScreenCanContinue() {
  const { direction } = nextRoamTarget({ x: 800, width }, workArea, () => 0.1, 'right');
  assert.strictEqual(direction, 'right');
}

function testCrawlIdleKeepsFacing() {
  assert.strictEqual(crawlIdleState('left'), 'crawl-left');
  assert.strictEqual(crawlIdleState('right'), 'crawl-right');
  assert.strictEqual(crawlIdleState(''), 'crawl-right');
}

const tests = {
  testTurnsAroundAtLeftEdge,
  testTurnsAroundAtRightEdge,
  testMidScreenCanContinue,
  testCrawlIdleKeepsFacing
};
let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL - ${name}: ${e.message}`); }
}
if (failed) process.exit(1);
console.log('roam-motion: all tests passed');
