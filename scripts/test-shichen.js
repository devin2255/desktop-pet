'use strict';

const assert = require('assert');
const {
  pickShichen,
  applyShichenWeights,
  resolveShichenLine,
  shichenWeight
} = require('../src/shichen');

assert.strictEqual(pickShichen(new Date(2026, 8, 10, 12, 0)).id, 'wu');
assert.strictEqual(pickShichen(new Date(2026, 8, 10, 0, 10)).id, 'zi');
assert.strictEqual(pickShichen(new Date(2026, 8, 10, 23, 10)).id, 'zi');
assert.strictEqual(pickShichen(new Date(2026, 8, 10, 18, 0)).id, 'you');
assert.ok(shichenWeight(pickShichen(new Date(2026, 8, 10, 12, 0)), 'sit') > 1);
assert.ok(shichenWeight(pickShichen(new Date(2026, 8, 10, 12, 0)), 'walk') < 1);
assert.ok(shichenWeight(pickShichen(new Date(2026, 8, 10, 0, 0)), 'sleep') > 1);

const weighted = applyShichenWeights(
  [{ state: 'walk', weight: 50 }, { state: 'sit', weight: 40 }],
  pickShichen(new Date(2026, 8, 10, 12, 0))
);
assert.ok(weighted[1].weight > weighted[0].weight, 'noon should prefer sitting over a long walk');
assert.strictEqual(
  resolveShichenLine({ wu: '午时。宜歇。' }, pickShichen(new Date(2026, 8, 10, 12, 0))),
  '午时。宜歇。'
);

console.log('shichen checks passed');
