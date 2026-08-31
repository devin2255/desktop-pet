### Task 2: 把 niulai 通用模块与测试拷进 son-mode（测试先红再绿）

**Files:**
- Create (copy from `feature/niulai`, same paths): `src/im-bus.js`, `src/im-adapter-lark.js`, `src/im-adapter-dingtalk.js`, `src/im-match.js`, `src/dingtalk-uia.js`, `src/dingtalk-call-uia.ps1`, `src/market-watch.js`, `src/approach-target.js`, `src/pet-task.js`, `scripts/test-im-bus.js`, `scripts/test-im-adapter-dingtalk.js`, `scripts/test-im-match.js`, `scripts/test-dingtalk-uia.js`, `scripts/test-market-watch.js`, `scripts/test-approach-target.js`, `scripts/test-pet-task.js`
- Modify from niulai versions (checkout those paths only): `src/watch-config.js`, `src/message-watcher.js`, `src/sequence-controller.js`, `src/preload-v3.js`, `src/renderer-v3.js`, `src/index-v3.html`, `src/styles-v3.css`, `src/petpack-validator.js`, `skills/desktop-pet-maker/scripts/petpack_tool.py`, `skills/desktop-pet-maker/references/petpack-schema.md`
- Modify: `package.json`, `scripts/build-customer.js`, `src/main-v3.js`

**Interfaces:**
- Consumes: Task 1 的 `capability-gates` 导出
- Produces: son-mode 播放器可加载 IM/行情/趋近/mock 任务模块；托盘按门禁显示

- [ ] **Step 1: 从 niulai 检出通用文件（不要检出牛来资源）**

在 `.worktrees/son-mode`：

```powershell
git checkout feature/niulai -- `
  src/im-bus.js src/im-adapter-lark.js src/im-adapter-dingtalk.js src/im-match.js `
  src/dingtalk-uia.js src/dingtalk-call-uia.ps1 src/market-watch.js src/approach-target.js src/pet-task.js `
  src/watch-config.js src/message-watcher.js src/sequence-controller.js `
  src/preload-v3.js src/renderer-v3.js src/index-v3.html src/styles-v3.css src/petpack-validator.js `
  skills/desktop-pet-maker/scripts/petpack_tool.py `
  skills/desktop-pet-maker/references/petpack-schema.md `
  scripts/test-im-bus.js scripts/test-im-adapter-dingtalk.js scripts/test-im-match.js `
  scripts/test-dingtalk-uia.js scripts/test-market-watch.js scripts/test-approach-target.js `
  scripts/test-pet-task.js scripts/test-watch-config.js scripts/test-message-watcher.js `
  scripts/test-sequence-controller.js scripts/test-sequences-schema.js
```

禁止 checkout：`pets/library/niulai`、`pets/packages/niulai.petpack`、`docs/prompts/make-niulai-pet.txt`、`scripts/niulai_v2_pipeline.py`、`scripts/audit_brother_judge_matting.py`。

- [ ] **Step 2: 把新测试接入 package.json 的 `test:js`**

在 `test:js` 的 `node --check` 列表中追加（若尚未存在）：

`src/approach-target.js` `src/im-match.js` `src/im-bus.js` `src/im-adapter-lark.js` `src/im-adapter-dingtalk.js` `src/dingtalk-uia.js` `src/pet-task.js` `src/capability-gates.js`

在测试脚本列表中追加：

`node scripts/test-capability-gates.js` `node scripts/test-pet-task.js` `node scripts/test-approach-target.js` `node scripts/test-im-match.js` `node scripts/test-im-bus.js` `node scripts/test-im-adapter-dingtalk.js` `node scripts/test-dingtalk-uia.js`

若 niulai 的 `test:js` 还包含 `test-market-watch.js`，同样追加。

- [ ] **Step 3: 客户打包列入新文件**

Modify `scripts/build-customer.js` 的 files 数组，加入与 niulai 相同的：

`src/market-watch.js`、`src/approach-target.js`、`src/im-bus.js`、`src/im-adapter-lark.js`、`src/im-adapter-dingtalk.js`、`src/im-match.js`、`src/dingtalk-uia.js`、`src/dingtalk-call-uia.ps1`、`src/pet-task.js`、`src/capability-gates.js`

`package.json` 的 `build.files`（若有）同步。

- [ ] **Step 4: 先跑拷过来的测试，确认缺接线时的失败点**

Run: `node scripts/test-im-bus.js`  
Expected: 若模块已检出应 PASS。若 FAIL，记下缺失依赖后再继续，不要改测试语义。

- [ ] **Step 5: 接线 `src/main-v3.js`（保留 son-mode 飞书任务）**

保留 son-mode 已有的 `notifyQwenWork` / `triggerPetTask` 写任务文件逻辑。增加：

```javascript
const {
  hasWatch,
  hasMarketSequences,
  hasCallHangupSequence,
  watchMenuLabel,
  taskProviderFromConfig
} = require('./capability-gates');
const { schedulePetTaskMock } = require('./pet-task');
const { createMarketWatcher } = require('./market-watch');
```

`triggerPetTask` 在发送接任务气泡之后：

```javascript
if (taskProviderFromConfig(watchConfig) === 'mock') {
  schedulePetTaskMock({
    taskType,
    onResult: (summary) => {
      const text = String(summary).slice(0, 200);
      sendState('reaction', text, text, 'reaction', {});
    }
  });
  return;
}
notifyQwenWork(taskType, taskFile);
```

禁止 `if (activeManifest?.id === 'niulai')` 或 `if (petId === 'brother-judge')`。

托盘项（在 `buildTrayMenu` 里，放在「始终置顶」附近）：

- 消息雷达 checkbox：`label: watchMenuLabel(activeManifest)`，`visible: hasWatch(activeManifest)`
- 拒接老板钉钉语音：`visible: hasCallHangupSequence(activeManifest)`
- 真实大盘 / 模拟盘：从 niulai 拷逻辑，已有 `visible: hasMarketSequences(activeManifest)`（或等价的 `market-bull` / `market-bear` 判断）

从 niulai 拷行情 `pushMarketStatus`、`createMarketWatcher` 启动/停止，以及 IM bus 启动逻辑。`watch-config.js` 的 `SELF_USE_DEFAULT_CONFIG` **不要**把 `market.enabled` / `callHangup.enabled` 设成 true 作为 son-mode 默认；son-mode 默认保持现有画饼雷达行为。在 son-mode 的默认 config 中：

```javascript
tasks: { provider: 'feishu' },
callHangup: { enabled: false, platforms: ['dingtalk'], cooldownSec: 60 },
market: { enabled: false, secid: '1.000001', pollMs: 5000, cooldownSec: 60, tradingHoursOnly: true }
```

可保留 `platforms: ['lark', 'dingtalk']` 结构，但 dingtalk 默认 `enabled: false`。

把 niulai 的 renderer 行情条 HTML/CSS/preload `pet:market` 一并留下：没有行情事件时组件隐藏（renderer 已有 enabled 判断则保持）。

- [ ] **Step 6: 给兄弟判官 pet.json 加雷达菜单名（若该文件在 son-mode 跟踪）**

若 `pets/library/brother-judge/pet.json` 或解包清单可改：在 `watch` 对象增加 `"menuLabel": "画饼雷达"`。没有跟踪该文件则跳过，门禁会回退到「消息雷达」。

- [ ] **Step 7: 跑 son-mode 测试**

Run:

```powershell
node scripts/test-capability-gates.js
node scripts/test-pet-task.js
node scripts/test-approach-target.js
node scripts/test-im-bus.js
node scripts/test-interaction-controller.js
node scripts/test-sequence-controller.js
npm run test:js
```

Expected: 全部 PASS。`test:js` 若因无关旧测试失败，只修本次引入的断裂，不借机重构。

确认工作区没有 `pets/library/niulai`、没有 `pets/packages/niulai.petpack`。

- [ ] **Step 8: Commit**

```powershell
git add src scripts/test-*.js scripts/build-customer.js package.json skills/desktop-pet-maker
git commit -m "feat: merge generic IM, hangup, market, and sequence approach into son-mode"
```

---

