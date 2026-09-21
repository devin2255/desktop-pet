# Duo 帐篷待机 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给带 `duo.tent` 的资源包增加单窗半开帐篷待机：合上右键「支起来」，外屏显示带秒时钟，帐篷内不听画饼、不散步、不爬窗。

**Architecture:** `duo-controller` 增加稳态 `tent`；主进程只识别菜单 id、停三件（漫游/边互动/雷达）；渲染层把现有 `.duo-overlay` 停在约 0.48 并画钟。没有 `duo.tent` 的包行为不变。始终一个窗口，不创建第二窗。

**Tech Stack:** Electron 播放器（`src/*-v3.js`）、Node 断言测试、`petpack-validator` / `petpack_tool.py`、`npm run build:brother-duo`。

**Spec:** `docs/superpowers/specs/2026-09-14-duo-tent-standby-design.md`

## Global Constraints

- 分支：`feature/son-mode`
- 播放器不写死「判官 / 花袄弟 / 兄弟 Duo」
- 进入只走菜单 `duo-tent`；禁止拖到一半进帐篷；禁止 `open` → `tent`
- 时钟 `HH:mm:ss` + 中文日期，每秒刷新；不叠行情
- 帐篷内 `canRunOfficeBus()` 为 false；ticker 隐藏
- 人物用根级 `sit`（缺则 `idle`），不新画角色，不画苹果标
- **Git：** 除非用户明确要求，否则跳过所有 `git commit`
- 数字签名不做

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/duo-controller.js` | `beginTent` / `leaveTent`；`beginUnfold` 从 tent 仅 `fromMenu`；`tentWindowBounds` / `tentOpenProgress` |
| `scripts/test-duo-controller.js` | 进出 tent、手势 unfold 失败、菜单 unfold 成功、cancel 弹回 tent |
| `src/capability-gates.js` | `hasDuoTent(manifest)` |
| `src/petpack-validator.js` | 可选 `duo.tent` |
| `skills/desktop-pet-maker/scripts/petpack_tool.py` | Python 侧对齐 tent 校验 |
| `src/main-v3.js` | 菜单分发、三停、隐藏保持 tent、overlay `phase:'tent'` |
| `src/renderer-v3.js` + CSS + HTML | 半开壳、外屏钟、隐藏 ticker、帐篷壳可点 |
| `pets/work/brother-duo/_write_pet_json.js` | 写入 `duo.tent` 与合上「支起来」 |
| `scripts/test-brother-duo-petpack.js` | 断言 tent 字段与菜单 id |

### 共用 API

```js
createDuoController({ snapProgress?, tentEnabled? })
// tentEnabled 缺省 false：beginTent() 恒为 false

controller.beginTent() // folded → tent
controller.leaveTent() // tent → folded
controller.beginUnfold(direction, { fromMenu?: boolean })
// folded：始终允许；tent：仅 fromMenu === true；其它态 false

function tentOpenProgress(value) // clamp 到 [0.35, 0.65]，缺省 0.48
function tentWindowBounds(foldedBounds, extraHeight = 40)
// 加高只往上：foot = y+height 不变
```

`hasDuoTent(manifest)`：`hasDuo` 且 `duo.tent` 为非数组对象。

---

### Task 1: duo-controller tent 状态机

**Files:**
- Modify: `src/duo-controller.js`
- Test: `scripts/test-duo-controller.js`

- [ ] **Step 1:** 在 `scripts/test-duo-controller.js` 追加：无 `tentEnabled` 时 `beginTent()` 为 false；有则 `folded→tent`；`leaveTent` 回 folded；tent 下 `beginUnfold('right')` 为 false；`beginUnfold('right', { fromMenu: true })` 为 true；从 tent unfold 后 `cancel()` 回到 tent；`open` 下 `beginTent()` 为 false；`tentOpenProgress(undefined)===0.48`；`tentWindowBounds` 脚底不变。
- [ ] **Step 2:** `node scripts/test-duo-controller.js` 必须失败。
- [ ] **Step 3:** 实现 `beginTent` / `leaveTent` / `tentEnabled` / `fromMenu` / helpers。
- [ ] **Step 4:** 测试通过。跳过 commit。

---

### Task 2: 校验与能力门

**Files:**
- Modify: `src/petpack-validator.js`, `src/capability-gates.js`, `skills/desktop-pet-maker/scripts/petpack_tool.py`
- Test: `scripts/test-sequences-schema.js`, `scripts/test-capability-gates.js`, `skills/desktop-pet-maker/scripts/test_petpack_tool.py`

校验规则：有 `duo` 才允许 `duo.tent`；`action` 若出现必须是根级动画；`enterLabel`/`leaveLabel` 1～24 字；`openProgress` 0.35～0.65。

- [ ] 合法 `tent: { action:'sit' }` 通过；`openProgress: 0.2` 抛错；`hasDuoTent` true/false。
- [ ] `python -m unittest skills.desktop-pet-maker.scripts.test_petpack_tool` 中增加 tent 合法/非法各一条。跳过 commit。

---

### Task 3: 主进程菜单与三停

**Files:**
- Modify: `src/main-v3.js`

- [ ] `makeDuoController` 传入 `tentEnabled: hasDuoTent(activeManifest)`。
- [ ] `runContextMenuAction` 识别 `duo-tent` / `duo-untent`。
- [ ] `tentViaMenu`：仅 `folded`；`pauseBehavior`；`beginTent`；`applyTentPresentation`（overlay `phase:'tent'`、progress=`tentOpenProgress`、播 `tent.action` 或 idle、`pushMarketStatus`、`restartOfficeBus`）；不 `scheduleBehavior`。
- [ ] `leaveTentViaMenu`：overlay 关掉、恢复窗尺寸、idle、`scheduleBehavior`、恢复雷达。
- [ ] `unfoldViaMenu` 允许 `tent`，`beginUnfold(..., { fromMenu: true })`，先恢复合上窗高。
- [ ] `canRunOfficeBus` / `canWatchMarket` 在 `duo.mode()==='tent'` 返回 false；`dispatchWatchState` tent 直接 return。
- [ ] `scheduleBehavior` / `runBehavior` tent 直接 return。
- [ ] `isSuspended` 含 `duo.mode()==='tent'`。
- [ ] `pet:context-menu` 在 tent 用短菜单：收起来、展开、藏起来、退出；无雷达开关。
- [ ] `pet:duo-pointer-move` 不处理 tent（不 beginUnfold）。
- [ ] `hidePet` 不把 tent 取消成 folded；`showPet` 若 tent 则重发 overlay、不播「你回来啦」、不散步。
- [ ] `cancelDuoTransition` 若弹回 tent 则 `applyTentPresentation`。
- [ ] `scripts/test-capability-gates.js` 断言 main 含 tent 静音与 `duo-tent`。跳过 commit。

---

### Task 4: 渲染半开壳 + 带秒钟

**Files:**
- Modify: `src/index-v3.html`, `src/styles-v3.css`, `src/renderer-v3.js`
- Test: `scripts/test-duo-renderer-contract.js`

- [ ] HTML：右页内加 `.duo-clock`（time + date）。
- [ ] CSS：`[data-phase="tent"]` 设备绕底边略立起；`--duo-open` 由 JS 设 0.48；右页不透明钟；左页半透明能看见人；禁止苹果标/渐变装饰。
- [ ] JS：`phase==='tent'` 时 overlay 保持显示；每秒写 `HH:mm:ss` 和 `M月D日 周X`；ticker 隐藏；`visiblePixelAt` 对 `.duo-device` 命中为 true。
- [ ] 合同测试匹配 `duo-clock`、`data-phase="tent"`、`getSeconds`。跳过 commit。

---

### Task 5: 兄弟 Duo 清单、打包、EXE

**Files:**
- Modify: `pets/work/brother-duo/_write_pet_json.js`, `scripts/test-brother-duo-petpack.js`
- Generate: `pets/library/brother-duo/pet.json`, `pets/packages/brother-duo.petpack`

```js
tent: { action: 'sit', enterLabel: '支起来', leaveLabel: '收起来', openProgress: 0.48 }
contextMenuActions 增加 { id: 'duo-tent', label: '支起来', action: 'sit', duration: 600 }
```

- [ ] 测试断言 `duo.tent.action==='sit'` 且菜单含 `duo-tent`。
- [ ] `node pets/work/brother-duo/_write_pet_json.js`
- [ ] `python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/brother-duo pets/packages/brother-duo.petpack`
- [ ] `npm run test:js` 相关子集通过。
- [ ] 先结束占用中的「兄弟桌宠 Duo」，再 `$env:CUSTOMER_ELECTRON_DIST="D:\Vibe_Coding\desktop-pet\node_modules\electron\dist"; npm run build:brother-duo`
- [ ] 启动 EXE 手测：支起来 / 跳秒 / 画饼静音 / 收起来 / 展开。跳过 commit。
