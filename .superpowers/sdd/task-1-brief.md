### Task 1: watch-rules.js — 过滤管线纯函数（TDD）

**Files:**
- Create: `src/watch-rules.js`
- Test: `scripts/test-watch-rules.js`
- Modify: `package.json`（`test:js` 链追加 `node scripts/test-watch-rules.js`）

**Interfaces:**
- Produces:
  - `createDedupeSet(maxSize = 5000)` → `{ has(id) → boolean, add(id) → void }`（内部 LRU，超限淘汰最旧）
  - `isBoss(senderId, bossIds)` → `boolean`（bossIds 为已解析 open_id 数组；空数组返回 false）
  - `matchKeyword(text, keywordMap)` → `category | null`（keywordMap 如 `{ '画饼': [...], '吹牛': [...] }`；`text.toLowerCase().includes(keyword.toLowerCase())` 命中即返回该类别，按对象键顺序取首个）
  - `inQuietHours(now, quietHours)` → `boolean`（quietHours 形如 `[['12:00','13:30']]`；跨午夜区间如 `['19:00','09:00']` 也支持；空数组返回 false；now 为 `Date`）
  - `pickLine(pool, rng = Math.random)` → `string`（pool 非空数组；rng 注入便于测试）
  - `DEFAULT_KEYWORDS` 常量：`{ '画饼': ['老板画的饼别吃，你啃不动！', '这饼画得真圆，可惜啃不动。'], '吹牛': ['你的老板吹了个牛逼！', '这牛吹得，我耳朵都疼了。'], }`

- [ ] **Step 1: 写失败测试** `scripts/test-watch-rules.js`

```js
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
  assert.strictEqual(matchKeyword('年底给你画个大饼', map), '画饼');
  assert.strictEqual(matchKeyword('老板又开始吹牛了', map), '吹牛');
  assert.strictEqual(matchKeyword('今天天气不错', map), null);
  assert.strictEqual(matchKeyword('', map), null);
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node scripts/test-watch-rules.js`
Expected: `FAIL - ...`（Cannot find module '../src/watch-rules'）退出码 1

- [ ] **Step 3: 实现** `src/watch-rules.js`

```js
'use strict';

const DEFAULT_KEYWORDS = {
  '画饼': ['老板画的饼别吃，你啃不动！', '这饼画得真圆，可惜啃不动。'],
  '吹牛': ['你的老板吹了个牛逼！', '这牛吹得，我耳朵都疼了。']
};

function createDedupeSet(maxSize = 5000) {
  const seen = new Set();
  const queue = [];
  return {
    has(id) { return seen.has(id); },
    add(id) {
      if (seen.has(id)) return;
      seen.add(id);
      queue.push(id);
      while (queue.length > maxSize) seen.delete(queue.shift());
    }
  };
}

function isBoss(senderId, bossIds) {
  return Array.isArray(bossIds) && bossIds.length > 0
    && typeof senderId === 'string' && bossIds.includes(senderId);
}

function matchKeyword(text, keywordMap) {
  if (typeof text !== 'string' || !text) return null;
  const lower = text.toLowerCase();
  for (const [category, pool] of Object.entries(keywordMap || {})) {
    if (Array.isArray(pool) && lower.includes(category.toLowerCase())) return category;
  }
  return null;
}

function toMinutes(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return h * 60 + (m || 0);
}

function inQuietHours(now, quietHours) {
  if (!Array.isArray(quietHours) || quietHours.length === 0) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (const [start, end] of quietHours) {
    const s = toMinutes(start); const e = toMinutes(end);
    if (s === e) continue;
    if (s < e) { if (minutes >= s && minutes < e) return true; }
    else { if (minutes >= s || minutes < e) return true; } // 跨午夜
  }
  return false;
}

function pickLine(pool, rng = Math.random) {
  const arr = Array.isArray(pool) && pool.length ? pool : [''];
  return arr[Math.floor(rng() * arr.length)];
}

module.exports = { createDedupeSet, isBoss, matchKeyword, inQuietHours, pickLine, DEFAULT_KEYWORDS };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node scripts/test-watch-rules.js`
Expected: 全部 `ok - ...` + `watch-rules: all tests passed`

- [ ] **Step 5: 并入测试链 + 提交**

在 `package.json` 的 `test:js` 末尾追加 `&& node scripts/test-watch-rules.js`。

```bash
git add src/watch-rules.js scripts/test-watch-rules.js package.json
git commit -m "feat: add watch rules filtering pipeline"
```

---

