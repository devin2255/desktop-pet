### Task 1: duo-controller slack 状态机与窗尺寸

**Files:**
- Modify: `src/duo-controller.js`
- Test: `scripts/test-duo-controller.js`

**Interfaces:**
- Consumes: 现有 `createDuoController`、`presentationWindowSize`、`clampToWorkArea`
- Produces: `beginSlack` / `leaveSlack` / `slackWindowSize` / `placeSlackWindow`；`presentationWindowSize` 识别 `'slack'`

- [ ] **Step 1: 写失败测试**

在 `scripts/test-duo-controller.js` 追加（`require` 增加 `slackWindowSize`、`placeSlackWindow`）：

```js
const slackOff = createDuoController({});
assert.strictEqual(slackOff.beginSlack(), false);

const slackDuo = createDuoController({ slackEnabled: true, tentEnabled: true });
assert.strictEqual(slackDuo.beginSlack(), true);
assert.strictEqual(slackDuo.mode(), 'slack');
assert.strictEqual(slackDuo.beginUnfold('right'), false, 'slack blocks gesture unfold');
assert.strictEqual(slackDuo.beginTent(), false, 'slack cannot tent');
assert.strictEqual(slackDuo.leaveSlack(), true);
assert.strictEqual(slackDuo.mode(), 'folded');

assert.strictEqual(slackDuo.beginTent(), true);
assert.strictEqual(slackDuo.beginSlack(), false, 'tent cannot slack');
slackDuo.leaveTent();

assert.strictEqual(createDuoController({ slackEnabled: true }).beginUnfold('right'), true);

const petSize = { width: 170, height: 190, label: '小（推荐）' };
const slackSize = slackWindowSize(petSize, 56);
assert.strictEqual(slackSize.height, 246);
assert.ok(slackSize.width >= 340);
assert.deepStrictEqual(
  presentationWindowSize(petSize, 'slack', { slackExtraHeight: 56 }),
  slackSize
);

const origin = { x: 100, y: 400, width: 170, height: 190 };
const placed = placeSlackWindow(origin, slackSize, { x: 0, y: 0, width: 1000, height: 800 });
assert.strictEqual(placed.y + placed.height, origin.y + origin.height, 'foot stays');
```

- [ ] **Step 2:** `node scripts/test-duo-controller.js` 必须失败（`slackWindowSize is not a function` 或 `beginSlack` 缺失）。

- [ ] **Step 3: 最小实现**

`createDuoController` 增加 `slackEnabled`。`beginSlack`：仅 `slackEnabled && mode==='folded'`。`leaveSlack`：仅 `mode==='slack'`。`beginTent` 增加 `mode !== 'slack'`（已是 folded-only，保持即可）。`beginUnfold`：`mode==='slack'` 时 false。

```js
function slackWindowSize(size, extraHeight = 56) {
  const foldedH = Math.max(108, Number(size?.height) || 0);
  const foldedW = Math.max(96, Number(size?.width) || 0);
  const extra = Math.max(0, Number(extraHeight) || 0);
  const height = foldedH + extra;
  const width = Math.max(foldedW * 2, Math.round(height * 4 / 3));
  return {
    width,
    height,
    ...(size && size.label ? { label: size.label } : {})
  };
}

function placeSlackWindow(origin, slackSize, workArea) {
  const width = Number(slackSize?.width) || 0;
  const height = Number(slackSize?.height) || 0;
  const footY = (Number(origin?.y) || 0) + (Number(origin?.height) || height);
  const originMid = (Number(origin?.x) || 0) + (Number(origin?.width) || 0) / 2;
  const x = originMid - width / 2;
  return clampToWorkArea({ x, y: footY - height, width, height }, workArea);
}
```

`presentationWindowSize`：在 tent 分支之后、open 分支之前：

```js
if (mode === 'slack') {
  return slackWindowSize(size, options.slackExtraHeight);
}
```

导出这两个函数。

- [ ] **Step 4:** `node scripts/test-duo-controller.js` 通过。跳过 commit。

---
