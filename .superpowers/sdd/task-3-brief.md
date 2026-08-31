### Task 3: 把窗口边 opt-in 合回 niulai

**Files:**
- Create: `.worktrees/niulai` 指向 `feature/niulai`
- Copy: `src/capability-gates.js`、`scripts/test-capability-gates.js` 从 son-mode worktree
- Modify: `src/interaction-controller.js`, `scripts/test-interaction-controller.js`, `src/watch-config.js`, `src/main-v3.js`（任务通道默认 mock）

**Interfaces:**
- Consumes: son-mode `interactionRoleEnabled` 语义；Task 1 门禁
- Produces: niulai 可省略或 `enabled: false` 关闭 climb/perch/hang；`tasks.provider` 默认 `mock`

- [ ] **Step 1: worktree**

```powershell
git worktree add .worktrees/niulai feature/niulai
cd .worktrees/niulai
```

- [ ] **Step 2: 把 son-mode 里「省略 climb 则不侧爬」的测试拷进 niulai 的 `scripts/test-interaction-controller.js`**

在现有侧爬测试之后加入（与 son-mode `ecfacb4` 相同断言）：

```javascript
{
  const harness = createHarness({ windows: [target] });
  delete harness.dependencies.getManifest().interactionActions.climb;
  harness.controller.startDrag({ x: 200, y: 150 });
  const result = await harness.controller.endDrag({ x: 100, y: 250 });
  assert.strictEqual(result, true);
  assert.strictEqual(harness.controller.state(), 'normal', 'omitting climb disables side-window cling');
  assert.ok(!String(harness.states.at(-1) || '').startsWith('climb'), 'no climb state when role omitted');
}
```

若 niulai 尚无 `enabled: false` 测试，再加：

```javascript
{
  const harness = createHarness({ windows: [target] });
  harness.dependencies.getManifest().interactionActions.climb = { action: 'climb-action', enabled: false };
  harness.controller.startDrag({ x: 200, y: 150 });
  const result = await harness.controller.endDrag({ x: 100, y: 250 });
  assert.strictEqual(result, true);
  assert.strictEqual(harness.controller.state(), 'normal', 'enabled:false skips side attachment');
}
```

- [ ] **Step 3: 跑测试确认失败或仍为旧行为**

Run: `node scripts/test-interaction-controller.js`  
Expected: 省略 climb 的用例 FAIL（仍进入 climb），或 enabled:false 用例 FAIL。

- [ ] **Step 4: 实现 `interactionRoleEnabled`**

在 niulai `src/interaction-controller.js` 的 `endDrag` 吸附前加入：

```javascript
function interactionRoleEnabled(role) {
  const actions = getManifest()?.interactionActions;
  if (actions === undefined) return true;
  const config = actions[role];
  if (config === false || config === null || config === undefined) return false;
  if (typeof config === 'object' && config.enabled === false) return false;
  return true;
}
```

侧边/顶/底吸附与屏顶 perch 均加 `interactionRoleEnabled('climb'|'perch'|'hang')` 判断，逻辑与 son-mode 一致。

- [ ] **Step 5: 默认任务通道 mock；拷贝 capability-gates**

从 `.worktrees/son-mode` 复制 `src/capability-gates.js` 与 `scripts/test-capability-gates.js`。  
在 niulai `watch-config.js` 的 `SELF_USE_DEFAULT_CONFIG` 与 `CUSTOMER_DEFAULT_CONFIG` 增加 `tasks: { provider: 'mock' }`。  
`src/main-v3.js` 的 `triggerPetTask` 使用 `taskProviderFromConfig(watchConfig)`：`mock` 走 `schedulePetTaskMock`（保持现状），`feishu` 才走飞书（若该分支没有 notifyQwenWork 则仅 mock）。

托盘拒接/行情继续用 `hasCallHangupSequence` / `hasMarketSequences`，避免无序列的包露出菜单。

牛来 `pets/library/niulai/pet.json` 不要删除已有 climb/perch/hang；不要误关。可在 `watch` 增加 `"menuLabel": "办公雷达"`。

- [ ] **Step 6: 跑测试**

```powershell
node scripts/test-interaction-controller.js
node scripts/test-capability-gates.js
node scripts/test-pet-task.js
npm run test:js
```

Expected: PASS。

- [ ] **Step 7: Commit**

```powershell
git add src/interaction-controller.js src/capability-gates.js src/watch-config.js src/main-v3.js scripts
git commit -m "feat: opt-in window-edge roles and shared capability gates on niulai"
```

---

