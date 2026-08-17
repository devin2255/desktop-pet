'use strict';
const assert = require('assert');
const {
  createDedupeSet, isBoss, matchKeyword, inQuietHours, pickLine, DEFAULT_KEYWORDS
} = require('../src/watch-rules');

function testDedupe() {
  const s = createDedupeSet(2);
  assert.strictEqual(s.has('a'), false);
  s.add('a');
  assert.strictEqual(s.has('a'), true);
  s.add('b'); s.add('c'); // 超限淘汰 a
  assert.strictEqual(s.has('a'), false);
  assert.strictEqual(s.has('c'), true);
}

function testIsBoss() {
  assert.strictEqual(isBoss('ou_1', ['ou_1', 'ou_2']), true);
  assert.strictEqual(isBoss('ou_3', ['ou_1']), false);
  assert.strictEqual(isBoss('ou_3', []), false);
}

function testMatchKeyword() {
  const map = { '画饼': ['a'], '吹牛': ['b'] };
  assert.strictEqual(matchKeyword('年底给你画饼了', map), '画饼');
  assert.strictEqual(matchKeyword('老板又开始吹牛了', map), '吹牛');
  assert.strictEqual(matchKeyword('今天天气不错', map), null);
  assert.strictEqual(matchKeyword('', map), null);
  assert.strictEqual(
    matchKeyword('@_all 好好干，将来上市我记着大家的功劳', map),
    '画饼',
    '上市/记功劳属于画饼，不能只匹配「画饼」二字'
  );
  assert.strictEqual(matchKeyword('@_all 好好干，不会亏待大家的', map), '画饼');
  assert.strictEqual(
    matchKeyword('上市加油', map, { '画饼': ['画饼'], '吹牛': ['吹牛'] }),
    null,
    'petpack 收窄 triggers 时不应再用默认别名'
  );
}

function testQuietHours() {
  assert.strictEqual(inQuietHours(new Date('2026-08-10T12:30:00+08:00'), [['12:00', '13:30']]), true);
  assert.strictEqual(inQuietHours(new Date('2026-08-10T14:00:00+08:00'), [['12:00', '13:30']]), false);
  assert.strictEqual(inQuietHours(new Date('2026-08-10T23:00:00+08:00'), [['19:00', '09:00']]), true);
  assert.strictEqual(inQuietHours(new Date('2026-08-10T08:00:00+08:00'), [['19:00', '09:00']]), true);
  assert.strictEqual(inQuietHours(new Date('2026-08-10T12:00:00+08:00'), []), false);
}

function testPickLine() {
  assert.strictEqual(pickLine(['x'], () => 0.5), 'x');
  assert.strictEqual(pickLine(['a', 'b'], () => 0.9), 'b');
}

function testDefaults() {
  assert.ok(Array.isArray(DEFAULT_KEYWORDS['画饼']) && DEFAULT_KEYWORDS['画饼'].length >= 1);
  assert.ok(Array.isArray(DEFAULT_KEYWORDS['吹牛']) && DEFAULT_KEYWORDS['吹牛'].length >= 1);
}

const tests = { testDedupe, testIsBoss, testMatchKeyword, testQuietHours, testPickLine, testDefaults };
let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`ok - ${name}`); } catch (e) { failed++; console.error(`FAIL - ${name}: ${e.message}`); }
}
if (failed) process.exit(1);
console.log('watch-rules: all tests passed');
