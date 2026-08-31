### Task 1: 通用跪爬模式 + 菜单上限 12

**Files:**
- Create/Replace: `src/roam-motion.js`
- Create/Update: `scripts/test-roam-motion.js`
- Create: `scripts/test-crawl-mode-wiring.js`
- Modify: `src/main-v3.js`
- Modify: `src/renderer-v3.js`
- Modify: `src/styles-v3.css`
- Modify: `src/petpack-validator.js`（上限 8→12）
- Modify: `skills/desktop-pet-maker/scripts/petpack_tool.py`（上限 8→12）
- Modify: `skills/desktop-pet-maker/references/petpack-schema.md`
- Modify: `package.json`（`test:js` 纳入新测试与 `--check src/roam-motion.js`）

**Interfaces:**
- Consumes: `activeManifest.animations.crawl` 可选
- Produces:
  - `settings.crawlMode: boolean`（默认 `false`）
  - `crawlIdleState(facing: 'left'|'right') -> 'crawl-left'|'crawl-right'`
  - `nextRoamTarget(bounds, workArea, rng, lastDirection) -> { targetX, direction }`
  - 托盘项 `label: '跪爬模式'`，`visible: Boolean(activeManifest?.animations?.crawl)`
  - `contextMenuActions.length <= 12`

- [ ] **Step 1: 写/确认 `scripts/test-roam-motion.js` 失败或补齐**

```js
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
```

- [ ] **Step 2: 写 `scripts/test-crawl-mode-wiring.js`（纯函数/导出探测不够时，直接断言源码契约 + validator）**

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateManifest } = require('../src/petpack-validator');

const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'main-v3.js'), 'utf8');
assert.ok(mainSrc.includes("label: '跪爬模式'"), 'tray must expose 跪爬模式');
assert.ok(mainSrc.includes('crawlMode'), 'settings.crawlMode required');
assert.ok(mainSrc.includes("kowtow-crawl"), 'kowtow must remap in crawl mode');

const rendererSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer-v3.js'), 'utf8');
assert.ok(rendererSrc.includes('crawl-left'), 'renderer must resolve crawl facing');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles-v3.css'), 'utf8');
assert.ok(css.includes('.state-crawl-left'), 'CSS mirror for crawl-left required');

// menu limit 12
const items = [];
for (let i = 0; i < 9; i++) {
  items.push({ id: `a${i}`, label: `L${i}`, action: 'idle' });
}
const manifest = {
  schemaVersion: 1,
  packageVersion: '1.0.0',
  id: 'limit-test',
  name: 't',
  description: 't',
  personality: ['a'],
  preview: 'preview.png',
  animations: {
    idle: { frames: ['animations/idle/01.png'], durations: [100], loop: true, holdLastFrame: false, scale: 1 },
    walk: { frames: ['animations/walk/01.png'], durations: [100], loop: true, holdLastFrame: false, scale: 1 },
    sit: { frames: ['animations/sit/01.png'], durations: [100], loop: false, holdLastFrame: true, scale: 1 },
    sleep: { frames: ['animations/sleep/01.png'], durations: [100], loop: true, holdLastFrame: false, scale: 1 },
    reaction: { frames: ['animations/reaction/01.png'], durations: [100], loop: false, holdLastFrame: true, scale: 1 }
  },
  contextMenuActions: items
};
// validateManifest needs on-disk frames; instead unit-test the length rule via isolated require of limit helper
// Prefer: temporarily call internal check by constructing through petpack-validator error path after raising limit.
assert.ok(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'petpack-validator.js'), 'utf8').includes('length > 12'),
  'validator must allow up to 12 contextMenuActions'
);
console.log('test-crawl-mode-wiring: ok');
```

- [ ] **Step 3: 实现 `src/roam-motion.js`（与 son-mode 对齐）**

```js
'use strict';

function nextRoamTarget({ x, width }, workArea, rng = Math.random, lastDirection) {
  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - width;
  if (!(maxX > minX)) return { targetX: minX, direction: 'right' };

  const span = Math.max(80, Math.min(320, workArea.width * 0.22));
  const edgeMargin = Math.max(48, Math.round(span * 0.4));
  const nearLeft = x <= minX + edgeMargin;
  const nearRight = x >= maxX - edgeMargin;

  let direction;
  if (nearLeft && !nearRight) direction = 'right';
  else if (nearRight && !nearLeft) direction = 'left';
  else if (lastDirection === 'left' || lastDirection === 'right') {
    direction = rng() < 0.7 ? lastDirection : (lastDirection === 'left' ? 'right' : 'left');
  } else {
    direction = rng() < 0.5 ? 'left' : 'right';
  }

  const travel = Math.max(140, Math.round(span * (0.6 + rng() * 0.4)));
  let targetX = direction === 'right'
    ? Math.min(maxX, x + travel)
    : Math.max(minX, x - travel);

  if (Math.abs(targetX - x) < 48) {
    direction = direction === 'right' ? 'left' : 'right';
    targetX = direction === 'right'
      ? Math.min(maxX, x + travel)
      : Math.max(minX, x - travel);
  }

  return { targetX, direction };
}

function crawlIdleState(facing) {
  return facing === 'left' ? 'crawl-left' : 'crawl-right';
}

module.exports = { nextRoamTarget, crawlIdleState };
```

- [ ] **Step 4: 改 `src/main-v3.js`**

关键改动点：

1. `const { nextRoamTarget, crawlIdleState } = require('./roam-motion');`
2. `let settings = { petId: '', sizeKey: 'small', roaming: true, crawlMode: false };`
3. 增加 `let lastWalkFacing = 'right';`
4. `walkTo`：

```js
const moveAction = settings.crawlMode && activeManifest?.animations?.crawl ? 'crawl' : 'walk';
sendState(`${moveAction}-${direction}`);
// on complete:
sendState(idleState());
scheduleBehavior(settings.crawlMode ? 700 + Math.random() * 900 : undefined);
```

5. 

```js
function idleState() {
  return (settings.crawlMode && activeManifest?.animations?.crawl)
    ? crawlIdleState(lastWalkFacing)
    : 'idle';
}
```

6. `chooseBehavior` 开头：

```js
if (settings.crawlMode && activeManifest?.animations?.crawl) {
  return { state: 'walk', weight: 100, minDuration: 2000, maxDuration: 5000 };
}
```

7. `runBehavior` 走路分支改用 `nextRoamTarget`，并 `lastWalkFacing = direction`
8. `runDirectMenuAction`：若 `choice.action === 'kowtow' && settings.crawlMode && activeManifest.animations['kowtow-crawl']`，改 `action` 为 `kowtow-crawl`；结束后 `sendState(idleState())`
9. `buildTrayMenu` 在「在桌面散步」后插入「跪爬模式」checkbox（文案精确为 `跪爬模式`）
10. 散步开关回调里 `sendState(idleState())` 替代裸 `idle`

参考实现：`git show feature/son-mode:src/main-v3.js` 中同名片段。

- [ ] **Step 5: 改 renderer / CSS**

`src/renderer-v3.js` 的 `resolveAction`：

```js
if (normalized === 'crawl-left' || normalized === 'crawl-right') return 'crawl';
```

`isFacingLeft`：

```js
|| pet.classList.contains('state-crawl-left')
```

`src/styles-v3.css` 在既有 left-facing 列表加入：

```css
.state-crawl-left .pet-image,
```

- [ ] **Step 6: 上限 12**

`src/petpack-validator.js`：

```js
if (!Array.isArray(manifest.contextMenuActions) || manifest.contextMenuActions.length > 12) {
  throw new Error('contextMenuActions 必须是最多 12 项的数组');
}
```

`petpack_tool.py` 同步改为 at most 12；`petpack-schema.md` 写明 12。

- [ ] **Step 7: 跑测试**

Run:

```powershell
node scripts/test-roam-motion.js
node scripts/test-crawl-mode-wiring.js
node --check src/main-v3.js
node --check src/renderer-v3.js
node --check src/roam-motion.js
npm run test:js
```

Expected: 全部 PASS / exit 0。

- [ ] **Step 8: Commit（仅当用户要求时）**

---

