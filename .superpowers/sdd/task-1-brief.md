### Task 1: son-mode worktree + 能力门禁测试（先红）

**Files:**
- Create (on `feature/son-mode` worktree): `src/capability-gates.js`, `scripts/test-capability-gates.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `hasMarketSequences(manifest) → boolean`
  - `hasCallHangupSequence(manifest) → boolean`
  - `hasWatch(manifest) → boolean`
  - `watchMenuLabel(manifest) → string`
  - `taskProviderFromConfig(watchConfig) → 'mock' | 'feishu'`

- [ ] **Step 1: 建 worktree**

```powershell
git check-ignore -q .worktrees
git worktree add .worktrees/son-mode feature/son-mode
cd .worktrees/son-mode
```

Expected: 目录存在且 `git branch --show-current` 为 `feature/son-mode`。

- [ ] **Step 2: 写失败测试**

Create `scripts/test-capability-gates.js`:

```javascript
'use strict';
const assert = require('assert');
const {
  hasMarketSequences,
  hasCallHangupSequence,
  hasWatch,
  watchMenuLabel,
  taskProviderFromConfig
} = require('../src/capability-gates');

const brother = {
  watch: { keywords: {}, menuLabel: '画饼雷达' },
  sequences: {}
};
assert.strictEqual(hasWatch(brother), true);
assert.strictEqual(hasMarketSequences(brother), false);
assert.strictEqual(hasCallHangupSequence(brother), false);
assert.strictEqual(watchMenuLabel(brother), '画饼雷达');
assert.strictEqual(taskProviderFromConfig({}), 'feishu');
assert.strictEqual(taskProviderFromConfig({ tasks: { provider: 'mock' } }), 'mock');

const niulaiLike = {
  watch: { menuLabel: '办公雷达' },
  sequences: {
    'market-bull': { stages: [{ action: 'fly' }] },
    'boss-call': { stages: [{ action: 'call-shout', messageLoop: true }, { action: 'call-mom-kick', onContact: true }] }
  }
};
assert.strictEqual(hasMarketSequences(niulaiLike), true);
assert.strictEqual(hasCallHangupSequence(niulaiLike), true);
assert.strictEqual(watchMenuLabel({}), '消息雷达');
assert.strictEqual(hasWatch({}), false);
console.log('test-capability-gates: ok');
```

- [ ] **Step 3: 跑测试确认失败**

Run: `node scripts/test-capability-gates.js`  
Expected: FAIL，`Cannot find module '../src/capability-gates'`

- [ ] **Step 4: 最小实现**

Create `src/capability-gates.js`:

```javascript
'use strict';

function hasWatch(manifest) {
  return Boolean(manifest && manifest.watch && typeof manifest.watch === 'object' && !Array.isArray(manifest.watch));
}

function hasMarketSequences(manifest) {
  const sequences = manifest && manifest.sequences;
  return Boolean(sequences && (sequences['market-bull'] || sequences['market-bear']));
}

function hasCallHangupSequence(manifest) {
  const sequences = manifest && manifest.sequences && typeof manifest.sequences === 'object'
    ? Object.values(manifest.sequences)
    : [];
  return sequences.some((seq) => Array.isArray(seq && seq.stages)
    && seq.stages.some((stage) => stage && (stage.onContact || stage.messageLoop)));
}

function watchMenuLabel(manifest) {
  const label = manifest && manifest.watch && typeof manifest.watch.menuLabel === 'string'
    ? manifest.watch.menuLabel.trim()
    : '';
  return label || '消息雷达';
}

function taskProviderFromConfig(watchConfig) {
  return watchConfig && watchConfig.tasks && watchConfig.tasks.provider === 'mock' ? 'mock' : 'feishu';
}

module.exports = {
  hasWatch,
  hasMarketSequences,
  hasCallHangupSequence,
  watchMenuLabel,
  taskProviderFromConfig
};
```

- [ ] **Step 5: 再跑测试确认通过**

Run: `node scripts/test-capability-gates.js`  
Expected: 打印 `test-capability-gates: ok`

- [ ] **Step 6: Commit**

```powershell
git add src/capability-gates.js scripts/test-capability-gates.js
git commit -m "test: add capability gates for watch, market, hangup, and task provider"
```

---

