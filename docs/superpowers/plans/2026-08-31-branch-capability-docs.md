# 各分支桌宠能力文档与 niulai/son-mode 底盘对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 niulai 的通用播放器能力合进 son-mode、从 niulai 去掉兄弟判官预装，并让每个功能分支的 README 只写清该分支主宠的全部能力与制作提示词。

**Architecture:** 播放器继续通用：新模块按 pet.json / watch 配置启用。用 `src/capability-gates.js` 判断托盘项可见性与任务通道（`mock` | `feishu`），禁止 `if (petId === '…')`。文档在各分支独立 worktree 中改 `README.md` 与 `docs/prompts/make-current-branch-pet.txt`。

**Tech Stack:** Git worktrees、Electron 播放器（`src/*-v3.js`）、Node 单测、Markdown。

**Spec:** `docs/superpowers/specs/2026-08-31-branch-capability-docs-design.md`

## Global Constraints

- 仓库：`https://github.com/devin2255/desktop-pet.git`
- 先代码后文档；son-mode / niulai 的 README 必须在合并完成、测试通过后写
- 不把 `pets/library/niulai/`、`pets/packages/niulai.petpack`、牛来专用脚本拷进 son-mode
- 不把兄弟判官资源留在 niulai 预装目录
- 不实现 macOS 安装包；提示词必须写明 macOS 未交付
- 播放器不写死角色名
- 改分支时使用 `.worktrees/<branch-slug>`，且该目录已被 `.gitignore` 忽略
- Git：每个 Task 末尾提交；不要 `git push`，除非用户当时明确要求
- 用户规则优先：不要 `--no-verify`、不要改 git config

### Shared Prompt（写入每分支 `docs/prompts/make-current-branch-pet.txt`）

将 `CHECKOUT_BRANCH` 换成该 Task 指定的分支名。全文如下：

```text
请根据我附上的照片，在本仓库制作完整桌面宠物，并交付可运行的客户安装包。

## 0. 先拉项目，未确认前禁止动手

1. 若当前工作区不是本仓库：git clone https://github.com/devin2255/desktop-pet.git 并进入仓库。
2. 若已在仓库：git fetch origin。
3. git checkout CHECKOUT_BRANCH
4. 阅读该分支 README.md 中「本分支桌宠」一节。那是能力模板，不是必须沿用的角色名或外形。
5. 用白话向用户复述：动作、气泡/台词、互动、托盘/右键、交付形态。
6. 对照清单逐项请用户确认：要 / 不要 / 改文案。确认用户上传的图片要做成哪些动作。
7. 确认操作系统：
   - Windows：本仓库当前可交付便携 EXE（node scripts/build-customer.js）。
   - macOS：本仓库没有 mac 构建，不能交付 .dmg 或 .app。若用户只要 macOS，停止并改方案。
   - 两个都要：先交 Windows；把 macOS 列为未交付。
8. 确认交付物：客户专属 Windows 便携 EXE + build-report.json；双击即出宠；不必装开发环境、不必手导 petpack；客户版默认隐藏导入、切换宠物、打开宠物库。
9. 以上全部得到用户明确答复之前，禁止生成动画、修改 pet.json、打包或构建 EXE。

## 1. 确认后再实现

遵循仓库根目录 AGENTS.md 与 desktop-pet-maker。不要在播放器里写死这只宠物的名字、性格或动画路径。身份、帧、文案、语音全部进入 .petpack / pet.json。

切帧前必须通过单元格安全门禁；失败就重生成，禁止只擦串帧碎片。互动帧连播 50 次不得缩放/平移。透明像素必须鼠标穿透。

## 2. 交付

验证 petpack 后执行：

python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/<id> pets/packages/<id>.petpack
node scripts/build-customer.js --pet pets/packages/<id>.petpack --name "<程序名称>" --delivery-id <id>

实际启动成品。交付 EXE、build-report.json 和验证结果。列出已验证项与未验证项（必须包括：未做代码签名；macOS 未交付）。不要只交付 .petpack。
```

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `src/capability-gates.js` | 托盘可见性与 `taskProvider`（新建于 son-mode，再拷到 niulai） |
| `src/im-*.js`、`src/dingtalk-uia.js`、`src/dingtalk-call-uia.ps1`、`src/market-watch.js`、`src/approach-target.js`、`src/pet-task.js` | 从 niulai 拷到 son-mode 的通用模块 |
| `src/watch-config.js`、`src/message-watcher.js`、`src/sequence-controller.js`、`src/main-v3.js`、`src/preload-v3.js`、`src/renderer-v3.js`、`src/index-v3.html`、`src/styles-v3.css`、`src/petpack-validator.js` | 合并时以 niulai 模块为准，默认宠物与飞书任务通道留在 son-mode |
| `src/interaction-controller.js` | niulai 接入 son-mode 的 `interactionRoleEnabled`（省略角色或 `enabled: false` 均关闭） |
| `scripts/test-capability-gates.js` | 门禁单测 |
| `scripts/test-im-*.js` 等 | 从 niulai 拷到 son-mode |
| `package.json`、`scripts/build-customer.js` | 把新模块列入 `node --check`、打包 files、客户 asar |
| `pets/library/brother-judge/**`、`pets/packages/brother-judge.petpack` | 仅从 **niulai** 删除 |
| 每分支 `README.md`、`docs/prompts/make-current-branch-pet.txt` | 主宠能力 + 制作入口 |

---

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

### Task 4: 从 niulai 移除兄弟判官预装

**Files:**
- Delete (tracked): `pets/library/brother-judge/` 整树、`pets/packages/brother-judge.petpack`、`scripts/audit_brother_judge_matting.py`、`outputs/brother-judge-matting-audit.json`、`outputs/brother-judge-matting-audit.md`
- Modify: `docs/prompts/README.md`、`docs/prompts/make-current-branch-pet.txt`（本 Task 只改「不要把兄弟判官当本分支交付」的句子；完整提示词在 Task 6 覆盖）、任何把 brother-judge 当作默认交付的脚本注释

**Interfaces:**
- Consumes: Task 3 的 niulai 播放器
- Produces: niulai 工作区预装只剩牛来（外加 gitignore 允许的 laopo 演示包若仍跟踪）

- [ ] **Step 1: 确认跟踪列表**

```powershell
git ls-files "pets/library/brother-judge" "pets/packages/brother-judge.petpack" "scripts/audit_brother_judge_matting.py" "outputs/brother-judge-matting-audit.json" "outputs/brother-judge-matting-audit.md"
```

- [ ] **Step 2: 删除**

```powershell
git rm -r -- pets/library/brother-judge
git rm -- pets/packages/brother-judge.petpack
git rm -- scripts/audit_brother_judge_matting.py outputs/brother-judge-matting-audit.json outputs/brother-judge-matting-audit.md
```

若某路径未跟踪，跳过该条，不要 `git rm` 失败中断。

- [ ] **Step 3: 全文去掉「本分支交付兄弟判官」**

Search: `brother-judge`、`兄弟判官`  
保留：通用播放器仍能 *导入* 外部 brother-judge 包的说明（若有）。删除：把 brother-judge 当本分支主宠、handoff 里「先 checkout son-mode 做判官」且暗示 niulai 自带判官 的段落。

`docs/prompts/README.md` 改为：本分支主宠是牛来；制作入口是 `make-current-branch-pet.txt`（完整正文 Task 6 再写）。

- [ ] **Step 4: 确认预装包**

```powershell
git ls-files "pets/packages/*.petpack" "pets/library/*/pet.json"
```

Expected: 有 `niulai`；没有 `brother-judge`。`laopo.petpack` 若仍在 files 里可保留为播放器演示，README 不把它当主宠。

- [ ] **Step 5: 跑测试**

```powershell
npm run test:js
```

Expected: PASS。若有测试依赖 `pets/library/brother-judge`，改为跳过或改用 niulai 夹具，不要再加回兄弟判官资源。

- [ ] **Step 6: Commit**

```powershell
git commit -m "chore: remove preinstalled brother-judge from niulai branch"
```

---

### Task 5: son-mode README + 提示词（兄弟判官）

**Files:**
- Modify (son-mode worktree): `README.md`
- Create or overwrite: `docs/prompts/make-current-branch-pet.txt`
- Modify if exists: `docs/prompts/README.md`

**Interfaces:**
- Consumes: 合并后的真实菜单（Task 2）
- Produces: 只描述兄弟判官

- [ ] **Step 1: 在 README 靠前插入「本分支桌宠」**

标题下、安装说明前插入（以合并后 pet.json / 托盘为准，下列文案为 son-mode 兄弟判官锁定清单；若合并后菜单有出入，以代码为准改这一节，不要写牛来来电/行情为默认能力）：

```markdown
## 本分支桌宠

本分支主交付：**兄弟判官**（`brother-judge` / 兄弟判官桌面宠物）。播放器通用，外形与台词来自 petpack。

制作提示词（复制到新会话）：[docs/prompts/make-current-branch-pet.txt](docs/prompts/make-current-branch-pet.txt)

设计文档：[docs/superpowers/specs/2026-08-10-boss-watch-design.md](docs/superpowers/specs/2026-08-10-boss-watch-design.md)

### 身份

- id / delivery-id：`brother-judge`
- 性格：毒舌、护短、接地气
- 启动问候：「爸，我来了！」（`startupGreeting`，可带预录音）

### 动作

标准：idle、walk、sit、sleep、reaction  
窗口：drag、climb、perch、hang、fall、impact、recover  
其它：crawl、kowtow、kowtow-crawl（跪爬模式下右键磕头用）、以及包内其它特色帧（如 slipper / mg，仅当 pet.json 声明）

### 气泡与台词

- 启动：「爸，我来了！」
- 右键叫爸：「爸」
- 右键磕头：无气泡
- 右键睡会儿：「行, 我睡会儿」（以 pet.json 为准）
- 随机坐下 / 吐槽 / 睡觉：以 pet.json `behavior.random` 为准（例如「爸，我歇会！」「嗯？你同事又在舔领导？」）
- 坐窗：以 `behavior.perched` 为准
- 画饼雷达：以 `watch.keywords` 为准（例如「你老板又在画饼，别吃！」「你老板吹了个牛逼！」）
- 当个事儿办接任务：以 `taskAcceptAudio` / 接任务文案为准

### 互动

拖动、漫游、窗口顶坐/侧爬/底挂、屏顶坠落恢复、跪爬模式（有 crawl 才显示）、透明像素鼠标穿透、小/中/大、始终置顶、开机启动。  
钉钉拒接与头顶行情条是播放器通用能力，**本宠默认没有对应序列，托盘不显示**。

### 托盘与右键

宠物项：叫爸、磕头、睡会儿（以 `contextMenuActions` 为准）  
播放器项：当个事儿办（写周报 / 总结群聊信息重点 / 搜集群聊八卦；客户版可隐藏）、叫宠物回来、切换/导入/打开宠物库（客户版隐藏）、宠物大小、在桌面散步、跪爬模式、始终置顶、消息雷达/画饼雷达（有 `watch` 时）、开机自动启动、暂时藏起来、退出。

### 交付

Windows 便携 EXE，未签名。

```text
node scripts/build-customer.js --pet pets/packages/brother-judge.petpack --name "兄弟判官桌面宠物" --delivery-id brother-judge
```

macOS 安装包未交付。
```

- [ ] **Step 2: 写提示词**

Overwrite `docs/prompts/make-current-branch-pet.txt` 为 Global Constraints 中 Shared Prompt，将 `CHECKOUT_BRANCH` 换成 `feature/son-mode`。

若存在 `docs/prompts/README.md`，写明：入口是 `make-current-branch-pet.txt`；`make-laopo-pet.txt` 仅为历史参考。

- [ ] **Step 3: 核对**

```powershell
Select-String -Path README.md -Pattern '本分支桌宠|make-current-branch-pet|叫爸|画饼|macOS'
Select-String -Path docs/prompts/make-current-branch-pet.txt -Pattern 'git clone|CHECKOUT_BRANCH|feature/son-mode|macOS|禁止生成动画'
```

Expected: README 含主宠节与提示词路径；提示词含 clone、`feature/son-mode`、macOS 未交付、确认前禁止动手。提示词中不应再出现字面 `CHECKOUT_BRANCH`。

- [ ] **Step 4: Commit**

```powershell
git add README.md docs/prompts/make-current-branch-pet.txt docs/prompts/README.md
git commit -m "docs: document brother-judge capabilities and confirm-first prompt on son-mode"
```

---

### Task 6: niulai README + 提示词（牛来）

**Files:**
- Modify (niulai worktree): `README.md`, `docs/prompts/make-current-branch-pet.txt`, `docs/prompts/README.md`

**Interfaces:**
- Consumes: Task 4 之后只剩牛来预装
- Produces: 只描述牛来

- [ ] **Step 1: 插入「本分支桌宠」**

```markdown
## 本分支桌宠

本分支主交付：**牛来**（`niulai` / 牛来桌面宠物）。致敬电影《牛来》，非官方周边。

制作提示词：[docs/prompts/make-current-branch-pet.txt](docs/prompts/make-current-branch-pet.txt)

设计文档：[docs/superpowers/specs/2026-08-17-niulai-office-pet-design.md](docs/superpowers/specs/2026-08-17-niulai-office-pet-design.md)

### 身份

- id：`niulai`　性格：胆小、躺平、嘴碎、被点到突然燃
- 启动问候：「打工人，牛来了。」

### 动作

标准：idle、walk、sit、sleep、reaction、crawl  
窗口：drag、climb、perch、hang、fall、impact、recover  
来电：call-shout、call-mom-approach、call-mom-walk、call-mom-kick  
行情：fly、bear-fly  
序列：boss-call、market-bull、market-bear

### 气泡与台词

- 右键：站起来「我来了。」；睡会儿做梦「眼前一黑。做梦去。」；演一出来电（播 boss-call）
- 随机 / 坐窗：以 pet.json 为准（例如「先趴着。筐还没到。」「不敢跳。溪还没过。」）
- 来电序列：喊「妈妈！」→「牛来？」→ 走向拒接并踢挂断
- 牛市 / 熊市序列：以 pet.json stages 文案为准
- 办公雷达六类（画饼/吹牛/加班/甩锅/开会/PUA）及 fallback：以 `watch.keywords` 为准
- 当个事儿办：本分支默认本地 mock 回复，文案在 `src/pet-task.js` 的 MOCK_RESULTS

### 互动

拖动、漫游、窗口边、跪爬、钉钉来电趋近拒接、办公 IM 雷达、头顶行情条（真实行情/模拟盘）、透明穿透、置顶、开机启动。

### 托盘与右键

宠物项：站起来、睡会儿做梦、演一出来电  
播放器项：当个事儿办三项、叫宠物回来、管理入口（客户版隐藏）、大小、散步、跪爬、置顶、办公雷达、拒接老板钉钉语音、真实大盘、模拟盘、开机启动、藏起来、退出。

### 交付

```text
node scripts/build-customer.js --pet pets/packages/niulai.petpack --name "牛来桌面宠物" --delivery-id niulai
```

Windows 便携 EXE，未签名。macOS 未交付。客户版默认关闭雷达/拒接监听。
```

- [ ] **Step 2: 提示词**

Shared Prompt，`CHECKOUT_BRANCH` → `feature/niulai`。`docs/prompts/README.md` 声明主宠是牛来，入口是该文件；可保留 `make-niulai-pet.txt` 作历史参考。

- [ ] **Step 3: 确认没有把兄弟判官当主宠**

```powershell
Select-String -Path README.md -Pattern '本分支桌宠|牛来|兄弟判官|make-current-branch-pet'
```

Expected: 主宠节只介绍牛来。

- [ ] **Step 4: Commit**

```powershell
git add README.md docs/prompts
git commit -m "docs: document niulai-only capabilities and confirm-first prompt"
```

---

### Task 7: 其余分支 README + 提示词

每个子步骤在独立 worktree 中完成：`git worktree add .worktrees/<slug> <branch>`，改完提交，不要回到已改过的 son-mode/niulai worktree 里混提交。

每个分支都要：

1. 在 `README.md` 靠前加「本分支桌宠」（只写下表主宠；能力按该分支 **当时** pet.json / 规格 / 测试锁定，下列为撰写底稿，发现与代码不符时改 README 而不是改底稿来迁就过期记忆）。
2. 写入 Shared Prompt，替换 `CHECKOUT_BRANCH`。
3. 用 Select-String 确认提示词含 clone、该分支名、macOS、确认前禁止动手。
4. 单独 commit：`docs: document <pet> capabilities and confirm-first prompt on <branch>`

#### `main` — 牛斯克 `boss`

- 动作：idle（跪姿）、walk（跪爬）、sit、sleep、reaction、drag、climb、perch、perch-cross-phone、perch-look、hang、fall、impact、pat-butt、call-dad、kowtow、self-slap、serve-tea
- 台词：叫大爷「大爷!」；磕头「给您磕头了」；错了没?「我真该死」；漫游「大爷喝茶!」；坐窗「喂, 军儿吗?」
- 菜单：叫大爷 / 磕头 / 错了没? + 播放器固定项（无跪爬开关、无画饼雷达）
- 交付：`npm run build:boss` 或 `node scripts/build-customer.js --pet pets/packages/boss.petpack --name "老板桌面宠物" --delivery-id boss`
- 提示词分支名：`main`
- 规格：`docs/prompts/make-boss-pet.txt` 可作历史参考；入口改为 `make-current-branch-pet.txt`

#### `feat/laopo-pet` — 老婆 `laopo`

- 动作：idle、walk、sit、sleep、reaction、drag、climb、perch、hang、fall、impact、pat-butt、perch-hair-flip、perch-blow-kiss、perch-look、call-hubby、kowtow、talent-show、serve-tea、love-you、praise、encourage
- 台词：启动「老公，我来啦~」；叫老公「老公!」；磕头「给老公磕头了」；上才艺「上才艺!」；漫游「老公喝茶」「爱你老公」「宝贝真棒」「老公辛苦了」
- 菜单：叫老公 / 磕头 / 上才艺
- 交付：`npm run build:laopo`
- 提示词分支名：`feat/laopo-pet`
- 规格：`docs/superpowers/specs/2026-08-01-laopo-pet-design.md`

#### `feat/medusa-pet` — 美杜莎 `medusa`

- 动作：idle、walk、sit、sleep、reaction、drag、lean、climb（资源可在，侧边入口为 lean）、perch、hang、fall、impact、pat-butt、perch-chin-rest、perch-hair-sweep、perch-look、cold-smile、heaven-python、kneel-before-me、talent-show、inspect、command、smirk-line
- 台词：启动「本女王来了。」；冷笑「哼。」；吞天蟒「吞天。」；跪安「跪下。」；上才艺「给本座看好了。」；漫游「看你表现」「侍奉本座」「有趣」
- 互动增量：侧边立刻 lean、遇边掉头、尺寸含超大
- 菜单：冷笑 / 七彩吞天蟒 / 跪安 / 上才艺
- 交付：`npm run build:medusa`
- 提示词分支名：`feat/medusa-pet`
- 规格：`docs/superpowers/specs/2026-08-02-medusa-pet-design.md`

#### `feature/bestie-pets-design` — 闺蜜桌宠 `guimi`

- 只写闺蜜，不写小美&小甜完整清单
- 动作：标准五动作、drag、cuddle、whisper、cheer、selfie、crawl、call-dad、kowtow、kowtow-crawl、perch、hang、feed-poop-throw/feed-poop、relax 分镜；climb.enabled false
- 台词：启动「我们是闺蜜桌宠～今天也要一起玩。」；合影三句；投喂臭粑粑两套；去放松无 waitForClick
- 菜单：贴贴 / 合个影 / 说悄悄话 / 加油鸭 / 去放松 / 去睡觉 / 投喂 / 叫爸 / 下跪 + 跪爬模式
- 交付：`npm run build:guimi`
- 提示词分支名：`feature/bestie-pets-design`
- 规格：`docs/superpowers/specs/2026-08-27-guimi-fan-pet-design.md`

#### `feature/boss-watch` — 兄弟判官（文言）

- 动作：标准 + drag/climb/perch/hang/fall/impact/recover/crawl（无 kowtow 专帧则磕头用 reaction）
- 台词：启动「本官到了，有冤的报冤，有饼的退下！」；升堂/退堂/歇息文言；画饼雷达文言词库
- 菜单：升堂 / 退堂 / 歇息 + 当个事儿办 + 跪爬 + 画饼雷达
- 交付：`node scripts/build-customer.js --pet pets/packages/brother-judge.petpack --name "兄弟判官桌面宠物" --delivery-id brother-judge`
- 提示词分支名：`feature/boss-watch`
- 规格：`docs/superpowers/specs/2026-08-10-boss-watch-design.md`

#### `feature/brother-judge-bubble-copy` — 兄弟判官（白话）

- 与 boss-watch 播放器相同，文案改为叫爸/磕头/睡会儿及白话雷达词
- 有 kowtow 专帧
- 提示词分支名：`feature/brother-judge-bubble-copy`
- 规格：`docs/superpowers/specs/2026-08-12-brother-judge-realistic-redesign.md`

#### `feature/dog-and-cat` — 旺财与咪咪

- 目标宠：一体双人 `dog-and-cat`；若 petpack 尚未生成，每条能力后写「计划中 / 未交付」
- 计划动作：标准五动作 + 窗口七动作；切帧双主体
- 计划菜单：过来一下 / 趴一会儿 / 去睡觉
- 当前可运行演示若仍是牛斯克，在节末用一句话说明「开发播放器目前内置的是牛斯克，不是本分支目标宠」
- 提示词分支名：`feature/dog-and-cat`
- 文档：`docs/blender-free-dog-and-cat.md`

#### `son-pet-window-interactions` — 小狗 `xiaogou`

- 动作：仅标准五动作；窗口状态机有、缺帧则 fallback
- 无自定义右键；托盘仅播放器固定项
- 交付：`node scripts/build-customer.js --pet pets/packages/xiaogou.petpack --name "小狗桌面宠物" --delivery-id xiaogou`
- 提示词分支名：`son-pet-window-interactions`
- 规格：`docs/superpowers/specs/2026-07-29-window-edge-interactions-design.md`

- [ ] **Step 1: 按上表在 8 个 worktree 中改 README + 提示词并分别提交**

- [ ] **Step 2: 抽查每个分支**

```powershell
git worktree list
# 对每个 worktree：
Select-String -Path README.md -Pattern '本分支桌宠|make-current-branch-pet'
Select-String -Path docs/prompts/make-current-branch-pet.txt -Pattern 'git clone'
```

Expected: 每个列出的分支都有主宠节和提示词。

---

### Task 8: 交叉验收

- [ ] **Step 1: son-mode 无牛来资源**

在 `.worktrees/son-mode`：`git ls-files | Select-String niulai`  
Expected: 无 petpack / library / make-niulai-pet。

- [ ] **Step 2: niulai 无预装兄弟判官**

在 `.worktrees/niulai`：`git ls-files | Select-String brother-judge`  
Expected: 无 `pets/library/brother-judge`、无 `pets/packages/brother-judge.petpack`。

- [ ] **Step 3: 门禁**

用 Task 1 测试夹具：兄弟判官形态 `hasMarketSequences`/`hasCallHangupSequence` 为 false；牛来形态为 true。

- [ ] **Step 4: 测试套件**

`.worktrees/son-mode` 与 `.worktrees/niulai` 各跑 `npm run test:js`。Expected: PASS。

- [ ] **Step 5: 不要推送**

列出将要推送的分支给用户，等明确指令再 `git push`。

---

## Self-review

1. **Spec coverage:** 主宠对照 → Task 5–7；提示词流程 → Shared Prompt + Task 5–7；son-mode 合入 → Task 1–2；opt-in 回 niulai → Task 3；删除兄弟判官 → Task 4；验收 → Task 8。
2. **Placeholders:** 无 TBD。CHECKOUT_BRANCH 只出现在模板说明里，写入文件时必须替换。
3. **Types:** `taskProviderFromConfig` 只返回 `'mock' | 'feishu'`；托盘 visible 只用 `hasWatch` / `hasMarketSequences` / `hasCallHangupSequence`。
