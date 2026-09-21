### Task 2: 校验与能力门

**Files:**
- Modify: `src/capability-gates.js`, `src/petpack-validator.js`, `skills/desktop-pet-maker/scripts/petpack_tool.py`
- Test: `scripts/test-capability-gates.js`, `scripts/test-sequences-schema.js`, `skills/desktop-pet-maker/scripts/test_petpack_tool.py`

**Interfaces:**
- Consumes: `hasDuo`
- Produces: `hasDuoSlack(manifest)`；validator 接受合法 `duo.slack`、拒绝缺动作/缺 clips

- [ ] **Step 1: 失败测试**

`scripts/test-capability-gates.js`：

```js
const { hasDuoSlack } = require('../src/capability-gates');
assert.strictEqual(hasDuoSlack({}), false);
assert.strictEqual(hasDuoSlack({ duo: { members: [{}, {}] } }), false);
assert.strictEqual(hasDuoSlack({ duo: { members: [{}, {}], slack: { jumpAction: 'slack-jump' } } }), true);
assert.strictEqual(hasDuoSlack({ duo: { members: [{}, {}], slack: null } }), false);
```

`testRuntimeCapabilitiesAreManifestGated` 追加（实现 Task 3 前这条会失败，**本 task 只加 hasDuoSlack 断言；main 契约放到 Task 3**）。

`scripts/test-sequences-schema.js` 在现有 `duoManifest` helper 旁增加：

```js
() => validateManifest(duoManifest({ slack: { jumpAction: 'idle', carryAction: 'walk', clips: [] } }), '', false),
/clips/,
() => validateManifest(duoManifest({
  slack: { jumpAction: 'missing', carryAction: 'walk', clips: ['video/slack/01.webm'] }
}), '', false),
/jumpAction/,
```

合法夹具：`jumpAction`/`carryAction` 指向根级已有动画，`clips` 至少 1 个（validator 在 `validateManifest(manifest, '', false)` 时若 root 为空可能跳过文件存在检查——与 tent 一样：无 root 只查字段类型；`validateManifest(..., root, true)` 才查文件）。

看 `validateManifest` 对 tent 的文件检查模式：slack clips 在 `root` 非空且第三参 true 时 `fs.existsSync`。

Python `test_petpack_tool.py` 增加合法 slack 一条、`clips: []` 非法一条。

- [ ] **Step 2:** 跑对应测试，确认失败。

- [ ] **Step 3: 实现**

```js
function hasDuoSlack(manifest) {
  return hasDuo(manifest)
    && Boolean(manifest.duo.slack && typeof manifest.duo.slack === 'object' && !Array.isArray(manifest.duo.slack));
}
```

`petpack-validator.js` 在 `duo.tent` 块后：

- `slack` 必须是对象
- `jumpAction`/`carryAction` 非空且 `manifest.animations[name]`
- labels 1～24 若出现
- `clips` 必须是 1～8 长度的字符串数组，每项相对路径、以 `.mp4` 或 `.webm` 结尾（大小写不敏感）
- `checkFiles===true` 时每个 clip `resolveInside(root, clip)` 必须是文件
- `boardSecids` 若出现：1～8 个非空字符串

Python `petpack_tool.py` 对齐同样规则。

- [ ] **Step 4:** `node scripts/test-capability-gates.js`、`node scripts/test-sequences-schema.js`、相关 Python unittest 通过。跳过 commit。

---
