'use strict';
const assert = require('assert');
const {
  petPositionForAnchor,
  nearestVerticalEdge,
  insetRect,
  anchorsOverlap,
  mirrorAnchorX
} = require('../src/approach-target');

function testPetPositionForAnchor() {
  const pet = { width: 200, height: 100 };
  const target = { x: 500, y: 400 };
  const pos = petPositionForAnchor(pet, { x: 0.08, y: 0.38 }, target);
  assert.strictEqual(pos.x, 500 - Math.round(200 * 0.08));
  assert.strictEqual(pos.y, 400 - Math.round(100 * 0.38));
}

function testNearestVerticalEdge() {
  const call = { x: 1000, y: 100, width: 280, height: 160 };
  const pet = { x: 200, y: 400, width: 200, height: 100 };
  const edge = nearestVerticalEdge(pet, call);
  assert.strictEqual(edge.side, 'left');
  assert.strictEqual(edge.x, 1000);
  assert.ok(edge.y >= 100 && edge.y <= 260);
}

function testInsetReject() {
  const btn = { x: 1100, y: 200, width: 80, height: 40 };
  const inset = insetRect(btn, 0.25);
  assert.strictEqual(inset.width, 40);
  assert.strictEqual(inset.height, 20);
  assert.strictEqual(inset.x, 1120);
  assert.strictEqual(inset.y, 210);
}

function testOverlap() {
  assert.strictEqual(anchorsOverlap(
    { x: 10, y: 10, width: 200, height: 100 },
    { x: 0.72, y: 0.96 },
    { x: 140, y: 90, width: 40, height: 20 }
  ), true);
  assert.strictEqual(anchorsOverlap(
    { x: 0, y: 0, width: 200, height: 100 },
    { x: 0.1, y: 0.1 },
    { x: 500, y: 500, width: 40, height: 20 }
  ), false);
}

function testMirror() {
  assert.strictEqual(mirrorAnchorX({ x: 0.08, y: 0.38 }).x, 0.92);
  assert.strictEqual(mirrorAnchorX({ x: 0.08, y: 0.38 }).y, 0.38);
}

const tests = { testPetPositionForAnchor, testNearestVerticalEdge, testInsetReject, testOverlap, testMirror };
let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`ok - ${name}`); } catch (e) { failed += 1; console.error(`FAIL - ${name}: ${e.message}`); }
}
if (failed) process.exit(1);
console.log('approach-target: all tests passed');
