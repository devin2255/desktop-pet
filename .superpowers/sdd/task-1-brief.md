### Task 1: 通用 `startupGreeting` 支持

**Files:**
- Modify: `src/main-v3.js`（`publicManifest` / `switchPet` / `ready-to-show`）
- Modify: `src/petpack-validator.js`
- Modify: `skills/desktop-pet-maker/scripts/petpack_tool.py`
- Modify: `skills/desktop-pet-maker/references/petpack-schema.md`
- Create: `scripts/test-startup-greeting.js`
- Modify: `package.json`（`test:js` 加入该测试）

**Interfaces:**
- Consumes: `manifest.startupGreeting?: string`
- Produces: `resolveStartupGreeting(manifest) -> string`（可内联；缺省时启动用 `我是${name}。`，切换用 `你好，我是${name}。`）

- [ ] **Step 1: 写失败测试**

创建 `scripts/test-startup-greeting.js`:

```js
'use strict';
const assert = require('assert');
const { validateManifest } = require('../src/petpack-validator');

function resolveStartupGreeting(manifest, { switching = false } = {}) {
  // 实现前先复制将要抽的逻辑到测试文件，或从 main 导出；优先在 main 旁抽小函数到
  // src/startup-greeting.js 以便测试。
  const { resolveStartupGreeting: resolve } = require('../src/startup-greeting');
  return resolve(manifest, { switching });
}

assert.strictEqual(
  resolveStartupGreeting({ name: '牛斯克' }),
  '我是牛斯克。'
);
assert.strictEqual(
  resolveStartupGreeting({ name: '牛斯克' }, { switching: true }),
  '你好，我是牛斯克。'
);
assert.strictEqual(
  resolveStartupGreeting({ name: '老婆', startupGreeting: '老公，我来啦~' }),
  '老公，我来啦~'
);
assert.strictEqual(
  resolveStartupGreeting({ name: '老婆', startupGreeting: '老公，我来啦~' }, { switching: true }),
  '老公，我来啦~'
);
assert.strictEqual(
  resolveStartupGreeting({ name: '老婆', startupGreeting: '   ' }),
  '我是老婆。'
);

const base = {
  schemaVersion: 1,
  id: 'demo',
  name: '演示',
  preview: 'preview.png',
  animations: {
    idle: { frames: ['a/1.png', 'a/2.png', 'a/3.png', 'a/4.png'], durations: [100, 100, 100, 100], loop: true },
    walk: { frames: ['b/1.png', 'b/2.png', 'b/3.png', 'b/4.png', 'b/5.png', 'b/6.png'], durations: [100, 100, 100, 100, 100, 100], loop: true },
    sit: { frames: ['c/1.png', 'c/2.png', 'c/3.png', 'c/4.png'], durations: [100, 100, 100, 100], loop: false },
    sleep: { frames: ['d/1.png', 'd/2.png', 'd/3.png', 'd/4.png'], durations: [100, 100, 100, 100], loop: true },
    reaction: { frames: ['e/1.png', 'e/2.png', 'e/3.png', 'e/4.png'], durations: [100, 100, 100, 100], loop: false }
  }
};
assert.doesNotThrow(() => validateManifest({ ...base, startupGreeting: '老公，我来啦~' }));
assert.throws(() => validateManifest({ ...base, startupGreeting: 'x'.repeat(81) }), /startupGreeting/);
console.log('startup greeting checks passed');
```

- [ ] **Step 2: 跑测试确认失败**

```powershell
node scripts/test-startup-greeting.js
```

Expected: FAIL（模块不存在或校验未实现）

- [ ] **Step 3: 实现最小代码**

Create `src/startup-greeting.js`:

```js
'use strict';

function resolveStartupGreeting(manifest, { switching = false } = {}) {
  const custom = typeof manifest?.startupGreeting === 'string' ? manifest.startupGreeting.trim() : '';
  if (custom) return custom;
  const name = typeof manifest?.name === 'string' && manifest.name.trim() ? manifest.name.trim() : '桌宠';
  return switching ? `你好，我是${name}。` : `我是${name}。`;
}

module.exports = { resolveStartupGreeting };
```

在 `src/petpack-validator.js` 的 `validateManifest` 中、`speechGender` 校验后加入：

```js
if (manifest.startupGreeting !== undefined) {
  if (typeof manifest.startupGreeting !== 'string' || manifest.startupGreeting.length > 80) {
    throw new Error('startupGreeting 必须是不超过 80 个字符的字符串');
  }
}
```

在 `src/main-v3.js` 顶部 require，并替换两处：

```js
const { resolveStartupGreeting } = require('./startup-greeting');
// switchPet:
sendState('reaction', resolveStartupGreeting(next, { switching: true }));
// ready-to-show:
sendState('reaction', resolveStartupGreeting(activeManifest));
```

`publicManifest` 可选透传 `startupGreeting`（字符串 trim 后非空才带上）。

Python `petpack_tool.py` 的 `validate_manifest_shape` 增加同样长度校验；`petpack-schema.md` 增加字段说明。

- [ ] **Step 4: 跑测试确认通过**

```powershell
node scripts/test-startup-greeting.js
```

Expected: `startup greeting checks passed`

- [ ] **Step 5: 更新 `package.json` 的 `test:js` 加入 `node scripts/test-startup-greeting.js`；将 `src/startup-greeting.js` 加入 `build.files`**

- [ ] **Step 6: Commit（若用户要求）**

```bash
git add src/startup-greeting.js src/main-v3.js src/petpack-validator.js skills/desktop-pet-maker/scripts/petpack_tool.py skills/desktop-pet-maker/references/petpack-schema.md scripts/test-startup-greeting.js package.json
git commit -m "feat: support optional startupGreeting in pet manifests"
```

---

