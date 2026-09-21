# 兄弟桌宠 Duo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付通用播放器 `duo` 开合能力，以及 petpack `brother-duo` 与客户便携 EXE「兄弟桌宠 Duo」：合上双人同框，右键拖开展成左右半屏双窗，再拖回合上。

**Architecture:** 纯逻辑 `duo-controller` 管状态/手势/半屏钳位；主进程第二 `BrowserWindow` 只在 `open` 存在；渲染层用过渡层做 Duo 式磨砂翻开。根级 `animations` 是合上双人帧；`duo.members` 是两套单人帧。播放器不写死角色名。

**Tech Stack:** Electron（`src/*-v3.js`）、Node 断言测试、`desktop-pet-maker` 切帧流水线、`node scripts/build-customer.js`。

**Spec:** `docs/superpowers/specs/2026-09-11-brother-duo-design.md`

## Global Constraints

- 分支：`feature/son-mode`
- package id / delivery-id：`brother-duo`
- 程序名：`兄弟桌宠 Duo`；左 `judge` 兄弟判官 / 右 `floral` 花袄弟
- 合上单窗双人同框；展开双窗锁同一显示器工作区左右半屏
- 右键短按（位移 &lt; 12px）出菜单；水平拖 ≥ 48px 且 `|dx| > |dy|` 才开合
- 左键只拖窗口；开合中途隐藏/左键拖/退出必须弹回进入前状态
- 画饼雷达只绑定 `watch: true` 的成员（本包为 `judge`）
- 不在播放器里写死「判官」「花袄弟」；不把苹果手机画进帧；不上传原图到无关服务
- 切帧失败必须重生成，禁止只擦串帧碎片
- **Git：** 用户规则优先——除非用户明确要求，否则跳过所有 `git commit` 步骤
- 每完成一个 Task，跑该 Task 列出的验证命令后再进入下一 Task

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/duo-controller.js` | 手势分类、开合状态机、进度吸附、半屏钳位 |
| `scripts/test-duo-controller.js` | 上述纯逻辑单测 |
| `src/capability-gates.js` | `hasDuo(manifest)` |
| `src/petpack-validator.js` | 校验 `duo` 与成员动画路径不冲突 |
| `skills/desktop-pet-maker/scripts/petpack_tool.py` | Python 侧对齐 `duo` 校验 |
| `skills/desktop-pet-maker/references/petpack-schema.md` | 文档化 `duo` |
| `scripts/test-capability-gates.js` | `hasDuo` 断言 |
| `scripts/test-sequences-schema.js` | 或新建夹具：合法/非法 `duo` 清单 |
| `src/preload-v3.js` | `duoPointerDown/Move/Up` IPC |
| `src/renderer-v3.js` | 右键拖开合；拦截误出菜单 |
| `src/styles-v3.css` | 开合过渡层（磨砂、无渐变装饰禁令范围内用纯色+blur） |
| `src/main-v3.js` | 第二窗、托盘同步、雷达打到正确窗 |
| `src/index-v3.html` | 过渡层 DOM 节点 |
| `pets/work/brother-duo/` | 参考图、IDENTITY、绿幕条 |
| `pets/library/brother-duo/` | 解包库 |
| `pets/packages/brother-duo.petpack` | 交付包 |
| `scripts/test-brother-duo-petpack.js` | 清单/菜单/duo 字段断言 |
| `package.json` | `test:js` 接入；`build:brother-duo` |
| `dist/customers/brother-duo/` | EXE + `build-report.json` |

### 共用 API（后续 Task 必须用这些名字）

```js
// src/duo-controller.js
function classifyRightPointer(input)
// input: { dx, dy, menuSlopPx?: number, commitPx?: number }
// returns: { kind: 'menu' } | { kind: 'duo', direction: 'left'|'right' }

function unfoldTravelPx(workAreaWidth)
// returns integer in [160, 420] = clamp(round(width * 0.35), 160, 420)

function canUnfold(workArea, windowSize, gapPx = 24)
// true iff workArea.width >= windowSize.width * 2 + gapPx

function clampOpenBounds(side, bounds, workArea)
// side: 'left'|'right'; bounds/workArea: { x, y, width, height }
// returns bounds with x clamped to that half; y unchanged except keep inside workArea

function createDuoController(options)
// options: { menuSlopPx?: 12, commitPx?: 48, snapProgress?: 0.5 }
// returns controller object below
```

`createDuoController` 实例：

- `mode()` → `'folded' | 'unfolding' | 'open' | 'folding'`
- `direction()` → `'left' | 'right' | null`（本次翻书朝向）
- `progress()` → `0..1`
- `beginUnfold(direction)` → `true` 若从 `folded` 进入 `unfolding`
- `beginFold(fromSide)` → `true` 若从 `open` 进入 `folding`；`fromSide` 为 `'left'|'right'`
- `updateDrag(dx)` → 当前 progress；`unfolding` 用 `|dx|/travel`，`folding` 仅当拖向中缝（左窗 dx&gt;0，右窗 dx&lt;0）才增加
- `setTravelPx(px)` → 本次手势满行程
- `release()` → `{ commit: boolean, mode }`；progress ≥ snapProgress 则 commit 到 `open` 或 `folded`，否则弹回
- `cancel()` → 立刻回到进入过渡前的 mode，progress 0
- `openSides()` → `null` 或 `{ left: memberId, right: memberId }` 由调用方在 commit 后自己记成员；控制器不存名字

---

### Task 1: duo-controller 纯逻辑

**Files:**
- Create: `src/duo-controller.js`
- Create: `scripts/test-duo-controller.js`
- Modify: `package.json`（`test:js` 增加 `--check src/duo-controller.js` 与 `node scripts/test-duo-controller.js`）

**Interfaces:**
- Consumes: 无
- Produces: 上文「共用 API」全部导出

- [ ] **Step 1: Write the failing test**

创建 `scripts/test-duo-controller.js`：

```js
'use strict';
const assert = require('assert');
const {
  classifyRightPointer,
  unfoldTravelPx,
  canUnfold,
  clampOpenBounds,
  createDuoController
} = require('../src/duo-controller');

assert.deepStrictEqual(classifyRightPointer({ dx: 0, dy: 0 }), { kind: 'menu' });
assert.deepStrictEqual(classifyRightPointer({ dx: 8, dy: 2 }), { kind: 'menu' });
assert.deepStrictEqual(
  classifyRightPointer({ dx: 60, dy: 10 }),
  { kind: 'duo', direction: 'right' }
);
assert.deepStrictEqual(
  classifyRightPointer({ dx: -60, dy: 8 }),
  { kind: 'duo', direction: 'left' }
);
assert.deepStrictEqual(classifyRightPointer({ dx: 20, dy: 80 }), { kind: 'menu' });

assert.strictEqual(unfoldTravelPx(1000), 350);
assert.strictEqual(unfoldTravelPx(200), 160);
assert.strictEqual(unfoldTravelPx(2000), 420);

const work = { x: 0, y: 0, width: 1000, height: 800 };
const size = { width: 180, height: 220 };
assert.strictEqual(canUnfold(work, size), true);
assert.strictEqual(canUnfold({ ...work, width: 300 }, size), false);

const left = clampOpenBounds('left', { x: 900, y: 100, width: 180, height: 220 }, work);
assert.ok(left.x + left.width <= 500);
const right = clampOpenBounds('right', { x: 0, y: 100, width: 180, height: 220 }, work);
assert.ok(right.x >= 500);

const duo = createDuoController({});
assert.strictEqual(duo.mode(), 'folded');
assert.strictEqual(duo.beginUnfold('right'), true);
assert.strictEqual(duo.mode(), 'unfolding');
duo.setTravelPx(200);
duo.updateDrag(40);
assert.ok(duo.progress() > 0 && duo.progress() < 0.5);
const snapBack = duo.release();
assert.strictEqual(snapBack.commit, false);
assert.strictEqual(duo.mode(), 'folded');

assert.strictEqual(duo.beginUnfold('left'), true);
duo.setTravelPx(200);
duo.updateDrag(-150);
const opened = duo.release();
assert.strictEqual(opened.commit, true);
assert.strictEqual(duo.mode(), 'open');

assert.strictEqual(duo.beginFold('left'), true);
duo.setTravelPx(200);
duo.updateDrag(40);
assert.strictEqual(duo.release().commit, false);
assert.strictEqual(duo.mode(), 'open');

assert.strictEqual(duo.beginFold('right'), true);
duo.setTravelPx(200);
duo.updateDrag(-150);
assert.strictEqual(duo.release().commit, true);
assert.strictEqual(duo.mode(), 'folded');

duo.beginUnfold('right');
duo.cancel();
assert.strictEqual(duo.mode(), 'folded');
assert.strictEqual(duo.progress(), 0);

console.log('test-duo-controller: ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-duo-controller.js`

Expected: FAIL，`Cannot find module '../src/duo-controller'`

- [ ] **Step 3: Write minimal implementation**

实现 `src/duo-controller.js`：导出上述五个名字。`createDuoController` 内部保存 `mode`、`direction`、`progress`、`travelPx`、`fromSide`、`originMode`。`updateDrag` 在 `unfolding` 时 `progress = min(1, abs(dx)/travelPx)`；在 `folding` 时仅当左窗 `dx>0` 或右窗 `dx<0` 才增加，否则 progress 不升。`release`：`progress >= snapProgress`（默认 0.5）则 `unfolding→open` 或 `folding→folded` 且 `commit: true`，否则回到 `originMode`。

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node scripts/test-duo-controller.js`

Expected: `test-duo-controller: ok`

- [ ] **Step 5: Wire package.json**

在 `package.json` 的 `test:js` 字符串中、`src/capability-gates.js` 的 `--check` 旁加入 `--check src/duo-controller.js`，并在 `test-capability-gates.js` 之前加入 `node scripts/test-duo-controller.js`。

Run: `node --check src/duo-controller.js`

Expected: 无输出，退出码 0

- [ ] **Step 6: Commit（用户未要求则跳过）**

---

### Task 2: hasDuo 与 petpack 校验

**Files:**
- Modify: `src/capability-gates.js`
- Modify: `scripts/test-capability-gates.js`
- Modify: `src/petpack-validator.js`
- Modify: `scripts/test-sequences-schema.js`（追加 duo 用例，或同文件底部）
- Modify: `skills/desktop-pet-maker/scripts/petpack_tool.py`
- Modify: `skills/desktop-pet-maker/references/petpack-schema.md`
- Modify: `skills/desktop-pet-maker/scripts/test_petpack_tool.py`

**Interfaces:**
- Consumes: 无（校验读取 manifest.duo）
- Produces: `hasDuo(manifest) -> boolean`；`validateManifest` 在 `duo` 存在时强制 2 members、left+right、成员标准五动作、路径不与根级 `animations` 冲突

- [ ] **Step 1: Write the failing gate test**

在 `scripts/test-capability-gates.js` 增加：

```js
const { hasDuo } = require('../src/capability-gates');
assert.strictEqual(hasDuo({}), false);
assert.strictEqual(hasDuo({ duo: { members: [{}, {}] } }), true);
assert.strictEqual(hasDuo({ duo: null }), false);
```

并从 `src/main-v3.js` 源码断言（与现有 `testRuntimeCapabilitiesAreManifestGated` 同类）：本 Task 先只测 `hasDuo`；Task 4 再加 main 源码门。

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-capability-gates.js`

Expected: FAIL，`hasDuo is not a function` 或 destructure 失败

- [ ] **Step 3: Implement hasDuo**

```js
function hasDuo(manifest) {
  const duo = manifest && manifest.duo;
  return Boolean(duo && typeof duo === 'object' && !Array.isArray(duo) && Array.isArray(duo.members) && duo.members.length === 2);
}
```

导出 `hasDuo`。

- [ ] **Step 4: Failing validator tests**

在 `scripts/test-sequences-schema.js` 末尾用现有 `baseManifest()` 扩一份：

```js
function duoManifest() {
  const extra = {
    judgeIdle: makeAnimation('member-judge/idle', 4, true),
    floralIdle: makeAnimation('member-floral/idle', 4, true)
  };
  // 实际要用完整五动作；测试里为左右成员各写 idle/walk/sit/sleep/reaction
}
```

断言：

1. 合法 `duo`（两成员、side left/right、各自动画 key 为成员对象内路径如 `animations/judge/idle/01.png`）`validateManifest` 不抛
2. 只有 1 个 member → 抛
3. 两个都是 `left` → 抛
4. 成员动画路径与根级 `animations/idle/01.png` 相同 → 抛
5. 无 `duo` 的旧清单仍通过

成员动画不要写进根 `manifest.animations`。校验函数应递归校验 `duo.members[].animations` 使用与根级相同的 `validateAnimation` 规则（帧数下限 idle4/walk6/sit4/sleep4/reaction4）。

- [ ] **Step 5: Implement JS validator**

在 `validateManifest` 末尾、文件引用收集处：若 `manifest.duo !== undefined`：

- 必须是对象，含 `members` 长度 2
- 每个 member：`id` 匹配宠物 id 规则（小写字母数字连字符）、`side` 为 `left` 或 `right`、`name` 1–80 字、`watch` 若出现必须是 boolean、`animations` 对象含五标准动作
- `side` 集合必须是 `{left, right}`
- `id` 互异
- 可选 `gesture.menuSlopPx`（1–40 整数）、`commitPx`（20–200）、`snapProgress`（0.2–0.9 数字）
- `referencedFiles` 必须收录成员帧路径
- 根级与所有成员帧路径做 Set 去重，冲突抛「动画路径冲突」

- [ ] **Step 6: Python 对齐**

在 `petpack_tool.py` 的 manifest 校验增加同等规则（members==2、sides、五动作、路径冲突）。`test_petpack_tool.py` 增加一个合法 duo 夹具和一个缺 member 的失败夹具。

- [ ] **Step 7: Schema 文档**

在 `petpack-schema.md` 增加 `duo` 小节，字段与规格 `2026-09-11-brother-duo-design.md` 的 JSON 示例一致。

- [ ] **Step 8: Run tests**

Run:

```
node scripts/test-capability-gates.js
node scripts/test-sequences-schema.js
python -m unittest skills.desktop-pet-maker.scripts.test_petpack_tool -v
```

若 unittest 路径在仓库惯例是 `python -m unittest discover -s skills/desktop-pet-maker/scripts -p test_petpack_tool.py -v`，用 discover 这条。

Expected: 全部 PASS / ok

- [ ] **Step 9: Commit（未要求则跳过）**

---

### Task 3: preload + 渲染手势

**Files:**
- Modify: `src/preload-v3.js`
- Modify: `src/renderer-v3.js`
- Modify: `src/index-v3.html`
- Modify: `src/styles-v3.css`
- Modify: `scripts/test-renderer-interaction.js`（若该文件是静态扫描 renderer 源码；否则新建 `scripts/test-duo-renderer-contract.js` 扫描源码）

**Interfaces:**
- Consumes: `classifyRightPointer` 的语义（阈值由主进程 duo-controller 再判一次，渲染层只负责发 dx/dy）
- Produces: `petApi.duoPointerDown/Move/Up/Cancel`；`pet:duo-overlay` 状态 `{ active, progress, direction, phase }`

- [ ] **Step 1: Failing contract test**

新建 `scripts/test-duo-renderer-contract.js`：

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload-v3.js'), 'utf8');
const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer-v3.js'), 'utf8');
assert.match(preload, /duoPointerDown/);
assert.match(preload, /duoPointerMove/);
assert.match(preload, /duoPointerUp/);
assert.match(preload, /pet:duo-pointer-down/);
assert.match(renderer, /event\.button !== 2/);
assert.match(renderer, /preventDefault\(\)/);
assert.match(renderer, /duoPointerDown/);
assert.match(renderer, /openMenu/);
console.log('test-duo-renderer-contract: ok');
```

- [ ] **Step 2: Run to see fail**

Run: `node scripts/test-duo-renderer-contract.js`

Expected: FAIL，preload 无 `duoPointerDown`

- [ ] **Step 3: Preload**

```js
duoPointerDown: (payload) => ipcRenderer.send('pet:duo-pointer-down', payload),
duoPointerMove: (payload) => ipcRenderer.send('pet:duo-pointer-move', payload),
duoPointerUp: (payload) => ipcRenderer.send('pet:duo-pointer-up', payload),
duoPointerCancel: () => ipcRenderer.send('pet:duo-pointer-cancel'),
onDuoOverlay: (callback) => ipcRenderer.on('pet:duo-overlay', (_e, payload) => callback(payload))
```

payload：`{ screenX, screenY, dx, dy }`，数字必须有限。

- [ ] **Step 4: Renderer 右键拖**

在现有左键 `pointerdown` 旁增加 `button === 2` 分支：记录起点；`pointermove` 累计 dx/dy 并 `duoPointerMove`；`pointerup` 调 `duoPointerUp`。`contextmenu`：若本次右键已经 `duoStarted`（水平位移达到将由主进程判定的拖，渲染层用 12px 作为「可能开合」标记），则 `preventDefault` 且 **不要** `openMenu`；否则 `openMenu`。

`index-v3.html` 增加 `<div class="duo-overlay" hidden>`。`styles-v3.css`：`.duo-overlay` 绝对铺满宠物窗，`background: rgba(255,255,255,0.18)`，`backdrop-filter: blur(8px)`，`pointer-events: none`，`z-index: 8`。禁止 linear-gradient。`onDuoOverlay`：`active` 时去掉 hidden，用 `progress` 设置 `--duo-progress`；`active` false 时 hidden。

- [ ] **Step 5: Run contract + syntax**

Run:

```
node --check src/preload-v3.js
node --check src/renderer-v3.js
node scripts/test-duo-renderer-contract.js
node scripts/test-renderer-interaction.js
```

Expected: contract ok；renderer-interaction 原有断言仍过

把 `test-duo-renderer-contract.js` 和 `--check src/duo-controller.js` 一样接入 `test:js`。

- [ ] **Step 6: Commit（未要求则跳过）**

---

### Task 4: 主进程双窗与钳位

**Files:**
- Modify: `src/main-v3.js`
- Modify: `scripts/test-capability-gates.js`（main 源码门：`hasDuo` 用于创建第二窗）

**Interfaces:**
- Consumes: `createDuoController`、`hasDuo`、`canUnfold`、`clampOpenBounds`
- Produces: `open` 时存在 `duoWindows.left` 与 `duoWindows.right`（`folded` 时只有 `petWindow`，即 left 窗兼合上窗）；托盘 click 对两窗一起 show/hide

- [ ] **Step 1: Failing source gate**

在 `testRuntimeCapabilitiesAreManifestGated` 增加：

```js
assert.match(src, /hasDuo\(activeManifest\)/);
assert.match(src, /pet:duo-pointer-down/);
assert.match(src, /createDuoController/);
```

- [ ] **Step 2: Run fail then implement**

`main-v3.js`：

1. `const { createDuoController, classifyRightPointer, canUnfold, clampOpenBounds, unfoldTravelPx } = require('./duo-controller');`
2. `const { hasDuo, ... } = require('./capability-gates');` 已有则扩展 destructure
3. `let duo = createDuoController({}); let duoPeerWindow = null;`
4. IPC `pet:duo-pointer-down/move/up/cancel`：用 `classifyRightPointer`；`folded` 且 kind duo 且 `canUnfold(workArea, currentSize())` 否则 `sendState` 气泡「太挤了，展不开」；`beginUnfold(direction)`；`setTravelPx(unfoldTravelPx(workArea.width))`；move 时 `updateDrag(dx)` 并向当前窗 `webContents.send('pet:duo-overlay', { active: true, progress, direction, phase: duo.mode() })`；up 时 `release()`，commit unfold 则 `createDuoPeerWindow()`，失败则 `duo.cancel()` 并提示失败；commit fold 则销毁 peer、只留 `petWindow`
5. `createDuoPeerWindow`：克隆 `createWindow` 的 BrowserWindow 选项（透明、preload、sandbox），加载同一 `index-v3.html`；`mouseThroughGuard`/`topmostGuard`/`interaction` **每窗各一实例**，`getWindow` 指向该窗。peer 创建失败 return false。
6. 漫游与 `setBounds`：`open` 时对 left/right 分别 `clampOpenBounds`
7. `hidePet`/`showPet`：两窗一起
8. `petWindow` 在 folded 时播根级清单；open 时 left 窗 `pet:load` 成员 judge 的动画视图（把该 member 的 animations 当成该窗的 manifest.animations 浅拷贝），right 窗同理 floral
9. `watch` 命中：`open` 时 `sendState` 只发给 `watch: true` 的那一窗；`folded` 发给 `petWindow`
10. 菜单 `id === 'duo-fold'`：`beginFold` 满进度 travel 后 `release` 等价 commit（可 `updateDrag` 足够大的朝中缝 dx）
11. 开合期间 `pauseBehavior`；`cancel` 若 `pet:drag-start`、hide、app quit

合上窗位置：展开 commit 时把现有窗钳到左半作为 judge，peer 放在右半中线附近。

- [ ] **Step 3: Syntax and gates**

Run:

```
node --check src/main-v3.js
node scripts/test-capability-gates.js
node scripts/test-duo-controller.js
```

Expected: ok，退出码 0

- [ ] **Step 4: Commit（未要求则跳过）**

---

### Task 5: 工作区参考图与 IDENTITY

**Files:**
- Create: `pets/work/brother-duo/IDENTITY.md`
- Create: `pets/work/brother-duo/source/refs/floral-face.jpg`（从用户会话附件拷贝，不覆盖原图路径之外的用户文件）

**Interfaces:**
- Consumes: 规格外观锚点
- Produces: 生成帧时的检查表

- [ ] **Step 1: Copy reference**

PowerShell：

```powershell
New-Item -ItemType Directory -Force -Path pets/work/brother-duo/source/refs | Out-Null
Copy-Item -Force "C:\Users\Thinkpad\.cursor\projects\d-Vibe-Coding-desktop-pet\assets\c__Users_Thinkpad_AppData_Roaming_Cursor_User_workspaceStorage_9e0e3481dd7e77d56552c67a68cb1557_images______20251224103022_86_1-1c9fcc57-58cc-43df-80e5-3aea49028ec4.jpg" pets/work/brother-duo/source/refs/floral-face.jpg
```

- [ ] **Step 2: IDENTITY.md**

写入检查表：判官红背心圆框眼镜深蓝短裤人字拖；花袄弟短发细框眼镜、红底东北大花短袖、军绿宽松短裤、人字拖、不画耳塞；合上帧左判官右花袄弟禁止换边；透明背景。

- [ ] **Step 3: Verify files exist**

Run: `Test-Path pets/work/brother-duo/source/refs/floral-face.jpg; Test-Path pets/work/brother-duo/IDENTITY.md`

Expected: 两个 `True`

---

### Task 6: 合上双人动画

**Files:**
- Create: `pets/library/brother-duo/animations/{idle,walk,sit,sleep,reaction,drag}/`

**Interfaces:**
- Consumes: IDENTITY.md、desktop-pet-maker 切帧脚本
- Produces: 根级六套动作帧（双人同框）

- [ ] **Step 1: Generate chroma strips**

按 `skills/desktop-pet-maker/SKILL.md` 为 idle/walk/sit/sleep/reaction/drag 生成绿幕条。两人同框，站位左判官右花袄弟。画风与现有 `pets/library/brother-judge` 一致的写实桌宠比例。

- [ ] **Step 2: Process strips**

对每个动作跑 `process_animation_strips.py`，失败则重画整条，禁止只擦碎片。

- [ ] **Step 3: Safety test**

Run: `python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v`

Expected: 与仓库门禁一致 PASS（至少不因本 Task 新增失败）

帧数：idle≥4 walk≥6 sit≥4 sleep≥4 reaction≥4 drag≥4。

---

### Task 7: 展开单人动画

**Files:**
- Create: `pets/library/brother-duo/animations/judge/{idle,walk,sit,sleep,reaction,drag,climb,perch,hang,fall,impact,recover}/`
- Create: `pets/library/brother-duo/animations/floral/` 同上

**Interfaces:**
- Consumes: `pets/library/brother-judge/animations/` 可复制给 judge；floral 必须按 IDENTITY 新生成
- Produces: 两套完整单人动作

- [ ] **Step 1: Copy judge solos**

将 `brother-judge` 已有动作目录复制到 `brother-duo/animations/judge/`（idle/walk/sit/sleep/reaction 以及窗口七动作）。不要改像素。若缺某个窗口动作，再按 maker 技能补生成，不要用 walk 顶替后还声称有专用帧——`interactionActions` 可映射到已有动作。

- [ ] **Step 2: Generate floral solos**

花袄弟单独出镜：同一套标准五动作 + 窗口七动作（或映射到 sit/walk/reaction/idle，但至少五标准动作是专用帧）。

- [ ] **Step 3: Process and reject collisions**

路径必须是 `animations/judge/...` 与 `animations/floral/...`，不得写入 `animations/idle/`。

---

### Task 8: pet.json、preview、打包测试

**Files:**
- Create: `pets/library/brother-duo/pet.json`
- Create: `pets/library/brother-duo/preview.png`
- Create: `pets/packages/brother-duo.petpack`
- Create: `scripts/test-brother-duo-petpack.js`
- Modify: `package.json`（`test:js` 加该测试；`build:brother-duo` script）

**Interfaces:**
- Consumes: Task 2 校验规则、Task 6–7 帧
- Produces: 可 validate 的 petpack

- [ ] **Step 1: Write failing pack test**

`scripts/test-brother-duo-petpack.js` 断言：`id === 'brother-duo'`、`name === '兄弟桌宠 Duo'`、`startupGreeting === '爸，兄弟 Duo 来了！'`、`duo.members` 两侧 id/side、`judge.watch === true`、`floral.watch === false`、根级有 idle/walk/sit/sleep/reaction/drag、左右成员有五标准动作、合上菜单含叫爸/磕头/睡会儿、展开右菜单不含 watch、含 `duo-fold` 合上项、库与 petpack 的 pet.json 一致。

- [ ] **Step 2: Run fail**

Expected: library pet.json missing

- [ ] **Step 3: Write pet.json**

按规格填写 `duo`、根级 behavior.random（双人）、成员 behavior.random。判官菜单与台词从 `brother-judge` 迁过来（叫爸、磕头、睡会儿 + 雷达）。花袄弟菜单至少两项（例如「唠两句」reaction、「睡会儿」sleep）加 `duo-fold`。合上菜单另加可选 `duo-unfold` 满进度展开作保底。

preview：双人同框一帧。

- [ ] **Step 4: Build pack**

```
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/brother-duo
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/brother-duo pets/packages/brother-duo.petpack
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/brother-duo.petpack
node scripts/test-brother-duo-petpack.js
```

Expected: validate 通过；`test-brother-duo-petpack: ok`

---

### Task 9: 雷达打到左窗

**Files:**
- Modify: `src/main-v3.js`（若 Task 4 未完成绑定）

**Interfaces:**
- Consumes: `duo.members[].watch`
- Produces: 命中关键词时 folded→`petWindow`；open→仅 `watch: true` 窗

- [ ] **Step 1: Add a focused unit if watch dispatch can be extracted**

若 `sendState` 签名难以单测，用 `scripts/test-capability-gates.js` 扫描：

```js
assert.match(src, /members\.find\(\s*\(m\)\s*=>\s*m\.watch\s*===?\s*true/);
```

或等价的 `member.watch` 分支。实现必须真的按窗发送，不能只注释。

- [ ] **Step 2: Implement dispatch helper `targetWindowsForWatch()`**

folded: `[petWindow]`；open: 过滤 `duoPeerWindow` / `petWindow` 对应 watch 成员。

- [ ] **Step 3: Run**

`node --check src/main-v3.js` 与 `node scripts/test-capability-gates.js`

Expected: ok

---

### Task 10: 客户 EXE 与真机门禁

**Files:**
- Modify: `package.json` script `build:brother-duo`
- Output: `dist/customers/brother-duo/`

**Interfaces:**
- Consumes: `brother-duo.petpack`、播放器 duo 能力
- Produces: 便携 EXE + `build-report.json`

- [ ] **Step 1: Regression tests**

```
node scripts/test-duo-controller.js
node scripts/test-renderer-interaction.js
node scripts/test-brother-duo-petpack.js
python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v
```

Expected: 全部通过。任一失败禁止打包。

- [ ] **Step 2: Build**

```
node scripts/build-customer.js --pet pets/packages/brother-duo.petpack --name "兄弟桌宠 Duo" --delivery-id brother-duo
```

Expected: 写出 EXE 与 `build-report.json`；ASAR 含播放器与内置包。

- [ ] **Step 3: Manual launch checklist**

实际启动 EXE，勾选规格「质量门禁」：合上同框、短按右键菜单、右键拖开（过半打开、不过半回弹）、左右半屏钳位、朝中缝拖回、左雷达、右独立菜单、透明穿透、托盘显隐两窗、退出。未做代码签名、无 macOS 包，写入交付说明。

- [ ] **Step 4: Commit（未要求则跳过）**

---

## Self-Review

**Spec coverage:** 状态机→Task 1/4；手势阈值→Task 1/3；过渡层→Task 3；双窗钳位→Task 4；动画清单→Task 6–7；pet.json/duo→Task 2/8；雷达→Task 9；失败回退太挤/第二窗失败→Task 4；客户 EXE→Task 10。竖折/真双屏/合上爬窗/苹果手机入帧均未列入任务。

**Placeholders:** 无 TBD。成员动画路径以 `animations/judge/` 与 `animations/floral/` 为准。

**Types:** `classifyRightPointer` / `createDuoController` / `hasDuo` / IPC `pet:duo-pointer-*` 在后续 Task 中名称一致。
