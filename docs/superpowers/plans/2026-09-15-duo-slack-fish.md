# Duo 摸会儿鱼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 合体右键「摸会儿鱼」：单窗全开边框 → 两人从页里跳出 → 扛着双折叠；左屏大盘板、右屏静音短视频循环；点击手机或兄弟收工。

**Architecture:** `duo-controller` 增加稳态 `slack`（与 `tent` 互斥）。主进程只认菜单 id / 点击收工，停漫游、边互动、画饼语音，行情仍推 renderer。渲染层复用 `.duo-device`（`--duo-open: 1`），三拍 `intro` → `jump` → `carry`。没有 `duo.slack` 的包行为不变。始终一个窗口。

**Tech Stack:** Electron 播放器（`src/*-v3.js`）、Node 断言测试、`petpack-validator` / `petpack_tool.py`、ffmpeg 短视频、`npm run build:brother-duo`。

**Spec:** `docs/superpowers/specs/2026-09-15-duo-slack-fish-design.md`

## Global Constraints

- 分支：`feature/son-mode`
- 播放器不写死「判官 / 花袄弟 / 兄弟 Duo / 摸会儿鱼」文案；label 来自 `duo.slack`
- 仅 `folded` → `slack`；禁止 `open`/`tent` 进入；`slack` 禁止手势开合
- 右屏不嵌 douyin.com；clips 静音循环
- 左屏用现有 `market-watch`；摸鱼期隐藏 `.ticker`，不听画饼
- 不画苹果标 / 灵动岛；屏内容不画进 PNG
- **Git：** 除非用户明确要求，否则跳过所有 `git commit`
- 数字签名不做

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/duo-controller.js` | `beginSlack` / `leaveSlack`；`slackWindowSize` / `placeSlackWindow`；`presentationWindowSize` 的 `slack` 分支 |
| `scripts/test-duo-controller.js` | 进出 slack、手势 unfold 失败、窗尺寸脚底不变 |
| `src/capability-gates.js` | `hasDuoSlack(manifest)` |
| `src/petpack-validator.js` | 可选 `duo.slack` + clips 文件 |
| `skills/desktop-pet-maker/scripts/petpack_tool.py` | Python 侧对齐 slack 校验 |
| `src/main-v3.js` | 菜单、三停、点击收工、overlay payload、slack 窗尺寸 |
| `src/preload-v3.js` | `slackExit` IPC |
| `src/renderer-v3.js` + CSS + HTML | intro 页内人、jump/carry、左屏板、右屏 video、点击收工 |
| `pets/work/brother-duo/_write_pet_json.js` | `duo.slack` + 菜单 |
| `pets/library/brother-duo/animations/slack-jump/`、`slack-carry/` | 新双人条 |
| `pets/library/brother-duo/video/slack/` | 静音 webm clips |
| `scripts/test-brother-duo-petpack.js` | 断言 slack 字段与菜单 id |
| `scripts/test-duo-renderer-contract.js` | overlay / video / board DOM 契约 |

### 共用 API

```js
createDuoController({ snapProgress?, tentEnabled?, slackEnabled? })
// slackEnabled 缺省 false：beginSlack() 恒为 false

controller.beginSlack() // folded → slack；tent/open 为 false
controller.leaveSlack() // slack → folded

function slackWindowSize(size, extraHeight = 56)
// height = folded.height + extraHeight
// width = max(folded.width * 2, round(height * 4 / 3))

function placeSlackWindow(origin, slackSize, workArea)
// 水平以 origin 中心对准，脚底 y+height 不变，再 clampToWorkArea

presentationWindowSize(size, 'slack', { slackExtraHeight })
// 走 slackWindowSize，不要误用 tabletWindowSize
```

`hasDuoSlack(manifest)`：`hasDuo` 且 `duo.slack` 为非数组对象。

Overlay payload（主进程 → renderer `pet:duo-overlay`）在现有字段上增加：

```js
{
  visible: true,
  progress: 1,
  phase: 'slack',
  slackStage: 'intro' | 'jump' | 'carry',
  introLeft: 'pet-asset://.../judge/idle/01.png',
  introRight: 'pet-asset://.../floral/idle/01.png',
  clips: ['pet-asset://.../video/slack/01.webm', ...],
  board: null | { /* 与 pet:market 相同的行情对象 */ }
}
```

点击收工：renderer `petApi.slackExit()` → `ipcRenderer.send('pet:slack-exit')`。仅位移 < 拖动阈值时发送。

---

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

### Task 3: 主进程菜单、三停、点击收工、窗尺寸

**Files:**
- Modify: `src/main-v3.js`, `src/preload-v3.js`
- Test: `scripts/test-capability-gates.js`（main 源码契约）

**Interfaces:**
- Consumes: `hasDuoSlack`、`beginSlack`/`leaveSlack`、`slackWindowSize`/`placeSlackWindow`
- Produces: 菜单 `duo-slack` / `duo-unslack`；IPC `pet:slack-exit`；overlay `phase:'slack'`

- [ ] **Step 1: 契约测试失败**

在 `testRuntimeCapabilitiesAreManifestGated` 追加：

```js
assert.match(src, /hasDuoSlack\(activeManifest\)/, 'slack is gated by duo.slack');
assert.match(src, /id === 'duo-slack'/);
assert.match(src, /pet:slack-exit/);
assert.match(src, /function canRunOfficeBus\(\) \{[\s\S]*mode\(\) === 'slack'/);
assert.match(src, /slackEnabled:\s*hasDuoSlack/);
assert.match(src, /presentationWindowSize\(currentSize\(\), duo\.mode\(\)/);
assert.match(src, /slackExtraHeight:/);
```

`preload-v3.js`：`test-duo-renderer-contract.js` 增加 `assert.match(preload, /slackExit/)` 与 `pet:slack-exit`。

- [ ] **Step 2:** 跑测试失败。

- [ ] **Step 3: 实现要点（对照现有 tent）**

`makeDuoController`：`slackEnabled: hasDuoSlack(activeManifest)`。

`windowSize` 已走 `presentationWindowSize`；传入 `slackExtraHeight: TENT_EXTRA_HEIGHT`（56）。

`runContextMenuAction`：`duo-slack` → `slackViaMenu()`；`duo-unslack` → `leaveSlackViaMenu()`。

`slackViaMenu`：

1. `duo.mode()==='folded'` 且 `hasDuoSlack`，否则 return
2. `pauseBehavior()`；`beginSlack()`
3. `applySlackPresentation('intro')`：`placeSlackWindow(petWindow.getBounds(), windowSize(), workArea)` 后 `setBounds`；`sendDuoOverlay(petWindow, true, { progress: 1, phase: 'slack', slackStage: 'intro', introLeft, introRight, clips, board })`
4. `introLeft/Right`：`petAssetUrl(id, member.animations.idle.frames[0])`
5. 不 `scheduleBehavior`
6. 用 timeout 串阶段：intro 持续 ~700ms → overlay `slackStage:'jump'` + `sendState(jumpAction)` → jump 时长（`duoActionDuration`，夹 500–1800ms）→ overlay `slackStage:'carry'` + `sendState(carryAction)`（缺 carry 则 idle）
7. `pushMarketStatus()`；`restartOfficeBus()`（bus 在 slack 为 false）

`leaveSlackViaMenu` / `onTrustedWin('pet:slack-exit')`：

- 仅 `mode==='slack'`
- 清阶段 timer；`leaveSlack()`；关 overlay；`restorePetWindowSize()`；`sendState('idle')`；`scheduleBehavior(1200)`；恢复雷达

`canRunOfficeBus` / `dispatchWatchState`：`tent` **或** `slack` 直接静音。`canWatchMarket`：**不要**因 slack 关掉轮询（左屏要数）。`pushMarketStatus` 在 slack 时把同一 payload 再塞进 overlay `board`（可在 `applySlackPresentation` 读最后一次 market 缓存，或 renderer 同时听 `pet:market`）。

更简单：renderer 在 `phase==='slack' && slackStage==='carry'` 时用已有 `pet:market` 画左屏，主进程不必复制 board 进 overlay。计划采用这条，减少通道。Overlay 仍传 clips 与 intro URL。

`isSuspended`：含 `slack`。

`scheduleBehavior` / `runBehavior`：`slack` return。

`pet:context-menu`：`slack` 短菜单仅「收工了」、藏起来、退出；无雷达、无展开、无支起来。

`pet:duo-pointer-move`：不处理 `slack`（不 beginUnfold）。

折叠菜单构建：`hasDuoSlack` 时插入 `{ id:'duo-slack', label: slack.enterLabel || '摸会儿鱼' }`。

- [ ] **Step 4:** 契约测试通过。`node --check src/main-v3.js src/preload-v3.js`。跳过 commit。

---

### Task 4: 渲染三拍 + 左屏板 + 右屏视频 + 点击收工

**Files:**
- Modify: `src/index-v3.html`, `src/styles-v3.css`, `src/renderer-v3.js`, `src/preload-v3.js`
- Test: `scripts/test-duo-renderer-contract.js`, `scripts/test-renderer-interaction.js`

**Interfaces:**
- Consumes: overlay payload、`pet:market`、`petApi.slackExit`
- Produces: 可见 intro/jump/carry；carry 时左板右视频；静止点击触发 slackExit

- [ ] **Step 1: 契约测试**

`test-duo-renderer-contract.js`：

```js
assert.match(html, /duo-slack-board/);
assert.match(html, /duo-slack-video/);
assert.match(html, /duo-intro-left/);
assert.match(html, /duo-intro-right/);
assert.match(renderer, /slackStage/);
assert.match(renderer, /slackExit/);
assert.match(styles, /\[data-phase="slack"\]/);
assert.match(styles, /--duo-open:\s*1/);
assert.doesNotMatch(html, /douyin\.com/);
```

`test-renderer-interaction.js`：在现有指针测试后，模拟 overlay `phase:'slack'` 时，静止 pointerdown/up 调用 `calls.slackExit`（给 fake `petApi.slackExit`）。拖过阈值不调用。

CSP：`index-v3.html` 的 `media-src` 保持 `pet-asset:`（已有则不动）。

- [ ] **Step 2:** 测试失败。

- [ ] **Step 3: 实现**

HTML `.duo-device-leaf-left` 内：`<img id="duo-intro-left" hidden>` + `<div id="duo-slack-board" hidden></div>`  
`.duo-device-leaf-right` 内：`<img id="duo-intro-right" hidden>` + `<video id="duo-slack-video" hidden muted playsinline loop></video>`（循环列表在 JS 里 ended 切 src，不要单文件 loop 除非 clips.length===1）。

CSS：`[data-phase="slack"]` 设 `--duo-open: 1`；隐藏钟与 pill；叶内 intro 图 `object-fit: contain`；board 小字红涨绿跌；video 铺满叶内容区；叶内容 `z-index` 高于人物叠边框的部分。

Renderer `applyDuoOverlay`：

- `phase==='slack'`：`tentActive=false` 但仍 `hideTicker()`（或 `slackActive` 标志，ticker 更新时若 slack 也隐藏）
- `intro`：显示 intro 图，藏 board/video，可藏主 `pet-image`（opacity 0）
- `jump`：藏 intro 图，显示主精灵（播 jump）
- `carry`：显示 board+video，主精灵 carry；`playSlackClips(clips)` 静音；`updateSlackBoard` 用最近一次 market info
- 现有 `updateTicker`：`if (tentActive || slackActive) { hideTicker(); return; }`

点击：`pointerup` 且未进入拖动且 `slackActive` → `preventDefault` 默认 interact，改 `petApi.slackExit()`。**拖动阈值逻辑与现有左键拖完全共用**，避免拖窗误收工。

- [ ] **Step 4:** renderer / contract 测试通过。跳过 commit。

---

### Task 5: 兄弟 Duo 资源（动作条 + clips + pet.json）

**Files:**
- Create: `pets/library/brother-duo/animations/slack-jump/01.png`…、`slack-carry/01.png`…
- Create: `pets/library/brother-duo/video/slack/01.webm` 等至少 3 个
- Modify: `pets/work/brother-duo/_write_pet_json.js`
- Test: `scripts/test-brother-duo-petpack.js`

**Interfaces:**
- Consumes: Task 2 validator
- Produces: 可打包的 `duo.slack`

- [ ] **Step 1:** petpack 测试先断言 `duo.slack.jumpAction==='slack-jump'`、`carryAction==='slack-carry'`、`clips.length>=3`、合上菜单 `摸会儿鱼` id `duo-slack`。跑测试失败。

- [ ] **Step 2: 画条**

身份锁定：左红背心圆框眼镜深蓝短裤人字拖；右东北大花短袖军绿短裤人字拖。480×480 透明底，脚底对齐。禁止苹果标、禁止把 K 线/视频画面画进 PNG。

- `slack-jump` ≥4 帧，不循环：两人从「在框里」跳到「在框外两侧、手就位」
- `slack-carry` ≥4 帧，循环：扛机吃力、肩压低、可轻微晃

切帧走现有 `process_animation_strips` 安全门；失败重画，禁止只擦碎片。

- [ ] **Step 3: clips**

用 ffmpeg 做 **静音** 3～6 段 ≤4s 的 `webm`（vp8/vp9），内容为自制「竖屏信息流」抽象画面（色块卡片上滑），**不要**抖音水印、Logo、未授权成片。例如：

```powershell
ffmpeg -y -f lavfi -i "color=c=0x111111:s=360x640:d=3" -an -c:v libvpx -b:v 400k pets/library/brother-duo/video/slack/01.webm
```

再叠加文字/色条做出三条观感不同的循环（也可用几张 PNG `zoompan`）。放入 `video/slack/01.webm`…。

- [ ] **Step 4:** `_write_pet_json.js` 根级增加 jump/carry 动画；`duo.slack` 写入 labels、动作名、clips；`contextMenuActions` 增加 `{ id:'duo-slack', label:'摸会儿鱼' }`（id 须过 `SEQUENCE_ID_PATTERN`：现有 `duo-tent` 已证明 `duo-slack` 合法）。

```js
node pets/work/brother-duo/_write_pet_json.js
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/brother-duo pets/packages/brother-duo.petpack
node scripts/test-brother-duo-petpack.js
```

期望：`ok`。跳过 commit。

---

### Task 6: 打包 EXE 与手测

**Files:**
- 交付：`dist/customers/brother-duo/兄弟桌宠 Duo-1.0.0.exe`、`build-report.json`

- [ ] 语法：`node --check` 改过的 js。
- [ ] `node scripts/test-duo-controller.js`；`node scripts/test-capability-gates.js`；`node scripts/test-renderer-interaction.js`；`node scripts/test-duo-renderer-contract.js`；`node scripts/test-brother-duo-petpack.js`。
- [ ] 结束占用中的「兄弟桌宠 Duo」，然后：

```powershell
$env:CUSTOMER_ELECTRON_DIST="D:\Vibe_Coding\desktop-pet\node_modules\electron\dist"
npm run build:brother-duo
```

- [ ] 启动 EXE 手测：
  - 合体右键有「摸会儿鱼」；帐篷/展开菜单没有
  - 出场：边框+页内人 → 跳出 → 扛机+左盘右视频（静音）
  - 点人/点手机回合体漫游；拖窗不误收工
  - 摸鱼期不散步、不爬窗；头上 ticker 消失；画饼关键词不说话
  - 「收工了」菜单也能退出
- [ ] 交付说明列出已验证 / 未验证（含无数字签名）。跳过 commit。

---

## Spec coverage

| Spec 项 | Task |
|---|---|
| 稳态 slack、仅 folded 进入 | 1, 3 |
| 三拍 intro/jump/carry | 3, 4, 5 |
| 左屏大盘 / 藏 ticker / 不听画饼 | 3, 4 |
| 右屏静音 clips | 4, 5 |
| 点击收工 vs 拖窗 | 3, 4 |
| 窗加宽加高脚底不动 | 1, 3 |
| validator / hasDuoSlack | 2 |
| 无 slack 包不变 | 2 |
| 新条 + pet.json + EXE | 5, 6 |
| 不嵌抖音站、不画苹果标 | 4, 5 |

## 首版仍不做

嵌入 douyin.com、右屏可滑可出声、两窗/三窗扛机、从帐篷或展开摸鱼、数字签名。
