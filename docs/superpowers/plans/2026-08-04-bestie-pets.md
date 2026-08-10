# 闺蜜宠物（小美&小甜）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一体双人 petpack `xiaomei-xiaotian` 与客户便携 EXE「小美&小甜桌面宠物」，含闺蜜彩蛋与可暂停续播的「去放松」序列。

**Architecture:** 宠物差异全部进 `.petpack`。播放器只增加通用能力：`sequences` + 菜单 `sequence` 字段、序列引擎（含 `waitForClick`）、阶段多句气泡错开播放。一体双人画在同一套帧里，不引入双窗口。

**Tech Stack:** Electron（`src/*-v3.js`）、`desktop-pet-maker` 动画流水线、Node 回归测试、`npm run build:customer`。

**Spec:** `docs/superpowers/specs/2026-08-04-bestie-pets-design.md`

## Global Constraints

- 分支：`feature/bestie-pets-design`
- package id / delivery-id：`xiaomei-xiaotian`
- 程序名：`小美&小甜桌面宠物`；显示名：`小美&小甜`
- 左小美（温柔黏人，额头痣+月牙链）/ 右小甜（活泼外向，比耶）
- 画风偏真人；日常便服为常态；蕾丝/性感高光仅 selfie 与 relax
- 拖拽必须用 `drag`「拖着屁股走」
- relax 阶段 4 `waitForClick: true`；再点只推进，不分支结局
- 不在播放器里按角色名写死逻辑；不上传原图到无关服务
- 切帧失败必须重生成，禁止只擦串帧碎片继续
- **Git：** 用户规则优先——除非用户明确要求，否则跳过所有 `git commit` 步骤
- 每完成一个 Task，跑该 Task 列出的验证命令后再进入下一 Task

## File Structure

| Path | Responsibility |
|---|---|
| `src/sequence-controller.js` | 纯逻辑：启动/推进/等待点击/中断序列 |
| `src/main-v3.js` | 挂载序列；菜单 `sequence`；`pet:interact`/拖拽中断 |
| `src/renderer-v3.js` | `pet:state` 支持 `messages[]` 错开气泡 |
| `src/petpack-validator.js` | 校验 `sequences` 与菜单 `sequence` |
| `skills/desktop-pet-maker/scripts/petpack_tool.py` | 与 JS 校验对齐 |
| `skills/desktop-pet-maker/references/petpack-schema.md` | 文档化新字段 |
| `scripts/test-sequence-controller.js` | 序列引擎单测 |
| `scripts/test-bestie-petpack.js` | 资源包清单/菜单/序列断言 |
| `pets/work/xiaomei-xiaotian/` | 参考图、绿幕条、处理后帧 |
| `pets/library/xiaomei-xiaotian/` | 解包检查目录 |
| `pets/packages/xiaomei-xiaotian.petpack` | 交付资源包 |
| `package.json` | 测试脚本与可选 `build:bestie` |
| `dist/customers/xiaomei-xiaotian/` | EXE + `build-report.json` |

### Manifest 约定（后续 Task 共用）

`contextMenuActions` 每项二选一：

- 普通：`{ id, label, action, message?, speech?, duration? }`（现有）
- 序列：`{ id, label, sequence }` —— `sequence` 为 `manifest.sequences` 的 key；**不得**同时带 `action`

```json
"sequences": {
  "relax": {
    "stages": [
      { "action": "relax-makeup", "message": "先弄好看一点～", "duration": 2800 },
      { "action": "relax-dress", "message": "这样…会不会太亮眼", "duration": 2200 },
      { "action": "relax-run", "message": "走！去放松！", "duration": 2800 },
      {
        "action": "relax-models",
        "messages": ["我要这个", "我要这个"],
        "messageGapMs": 700,
        "waitForClick": true
      },
      { "action": "relax-hug", "duration": 2200 },
      {
        "action": "relax-shy",
        "messages": ["好害羞…", "嘿嘿…腹肌耶"],
        "messageGapMs": 800,
        "duration": 3600
      },
      { "action": "idle", "duration": 0 }
    ]
  }
}
```

`createSequenceController({ getManifest, sendState, pauseBehavior, scheduleBehavior, onEnded })` 对外 API：

- `start(sequenceId) -> boolean`
- `isActive() -> boolean`
- `isWaitingForClick() -> boolean`
- `continueFromClick() -> boolean` —— 仅 `waitForClick` 暂停时有效
- `cancel(reason?)` —— 回 `idle` 并 `scheduleBehavior`
- `dispose()`

---

### Task 1: 序列引擎（纯逻辑 + 测试）

**Files:**
- Create: `src/sequence-controller.js`
- Create: `scripts/test-sequence-controller.js`
- Modify: `package.json`（`test:js` 加入该测试；`node --check` 加入新文件）

**Interfaces:**
- Consumes: `getManifest() -> manifest | null`；`sendState(action, message?, speech?, extras?)`；`pauseBehavior()`；`scheduleBehavior(ms)`
- Produces: 上文 API；`extras.messages` / `extras.messageGapMs` 供渲染层错开气泡

- [ ] **Step 1: 写失败测试**

创建 `scripts/test-sequence-controller.js`：

```js
'use strict';
const assert = require('assert');
const { createSequenceController } = require('../src/sequence-controller');

const calls = { states: [], pause: 0, schedule: [] };
let manifest = {
  animations: {
    idle: {}, a: {}, b: {}, c: {}
  },
  sequences: {
    demo: {
      stages: [
        { action: 'a', message: 'one', duration: 100 },
        { action: 'b', messages: ['x', 'y'], messageGapMs: 50, waitForClick: true },
        { action: 'c', duration: 100 },
        { action: 'idle', duration: 0 }
      ]
    }
  }
};

const seq = createSequenceController({
  getManifest: () => manifest,
  sendState: (action, message, speech, extras) => {
    calls.states.push({ action, message, speech, extras });
  },
  pauseBehavior: () => { calls.pause += 1; },
  scheduleBehavior: (ms) => { calls.schedule.push(ms); },
  now: () => calls.now || 0,
  setTimer: (fn, ms) => {
    calls.timer = { fn, ms };
    return 1;
  },
  clearTimer: () => { calls.timer = null; }
});

assert.strictEqual(seq.start('demo'), true);
assert.strictEqual(calls.pause, 1);
assert.strictEqual(calls.states[0].action, 'a');
assert.strictEqual(seq.isWaitingForClick(), false);

// 推进到 waitForClick 阶段
calls.timer.fn();
assert.strictEqual(calls.states.at(-1).action, 'b');
assert.deepStrictEqual(calls.states.at(-1).extras.messages, ['x', 'y']);
assert.strictEqual(seq.isWaitingForClick(), true);

// 等待点击时忽略自动 timer
assert.strictEqual(seq.continueFromClick(), true);
assert.strictEqual(calls.states.at(-1).action, 'c');
assert.strictEqual(seq.isWaitingForClick(), false);

calls.timer.fn(); // c 结束 -> idle
assert.strictEqual(calls.states.at(-1).action, 'idle');
assert.strictEqual(seq.isActive(), false);
assert.ok(calls.schedule.length >= 1);

// cancel 中断
assert.strictEqual(seq.start('demo'), true);
seq.cancel();
assert.strictEqual(seq.isActive(), false);
assert.strictEqual(calls.states.at(-1).action, 'idle');

console.log('test-sequence-controller: ok');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/test-sequence-controller.js`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `src/sequence-controller.js`**

最小实现要点：

- `start`：校验 `sequences[id].stages` 非空；每阶段 `action` 必须在 `animations`；`pauseBehavior`；从 stage 0 播放
- 非 `waitForClick`：`setTimer` 在 `duration`（缺省 3000，`idle`+`duration:0` 立即结束）后 `advance`
- `waitForClick`：播状态后进入等待，不设完成 timer；`continueFromClick` 才 `advance`
- `cancel`/`dispose`：清 timer，`sendState('idle')`，`scheduleBehavior(900)`（dispose 可不再 schedule）
- 重复 `start`：先 cancel 再开
- `sendState(action, message, '', { messages, messageGapMs })`：有 `messages` 时 `message` 可为首句或空

- [ ] **Step 4: 跑测试确认通过**

Run: `node scripts/test-sequence-controller.js`  
Expected: `test-sequence-controller: ok`

- [ ] **Step 5: 更新 `package.json` 的 `test:js`**

在 `node --check` 列表加入 `src/sequence-controller.js`，在测试列表加入 `node scripts/test-sequence-controller.js`。

Run: `npm run test:js`  
Expected: 全绿（本 Task 相关项通过；其它既有失败先记录但不得引入新失败）

- [ ] **Step 6: Commit（仅当用户要求时）**

---

### Task 2: petpack 校验与 schema（sequences）

**Files:**
- Modify: `src/petpack-validator.js`
- Modify: `skills/desktop-pet-maker/scripts/petpack_tool.py`
- Modify: `skills/desktop-pet-maker/references/petpack-schema.md`
- Create or extend: `scripts/test-petpack-security.js`（或新建 `scripts/test-sequences-schema.js`）加入序列校验用例
- Modify: `package.json`（若新建测试文件则接入 `test:js`）

**Interfaces:**
- Consumes: Task 1 的 manifest 形状
- Produces: `validateManifest` 接受/拒绝 `sequences` 与菜单 `sequence`

规则（必须写进校验器）：

- `sequences` 可选；若存在须为 object，key 匹配 `^[a-z0-9][a-z0-9-]{1,31}$`，最多 8 条
- 每条 `stages`：数组长度 2..16
- 每 stage：`action` 必填且在 `animations`；可选 `message`≤80、`messages`（1..4 条字符串，每条≤80）、`messageGapMs`（0..5000）、`duration`（0..10000 整数；`waitForClick` 时可省略）、`waitForClick` boolean
- 同一 stage 不可同时只有空 `message` 又无 `messages` 的强制——允许无台词
- `contextMenuActions`：每项必须恰好有 `action` 或 `sequence` 之一；若 `sequence` 则必须存在于 `sequences`；有 `sequence` 时禁止 `duration`/`message`（台词在 stages 里）
- 引用到的 sequence stage `action` 必须通过 `validateAnimation`

- [ ] **Step 1: 写失败测试**

在 `scripts/test-sequences-schema.js`：

```js
'use strict';
const assert = require('assert');
const { validateManifest } = require('../src/petpack-validator');

function baseManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'demo-seq',
    name: 'Demo',
    personality: ['x'],
    preview: 'preview.png',
    animations: {
      idle: { frames: ['animations/idle/01.png'], durations: [100], loop: true, scale: 1 },
      walk: { frames: ['animations/walk/01.png'], durations: [100], loop: true, scale: 1 },
      sit: { frames: ['animations/sit/01.png'], durations: [100], loop: false, scale: 1 },
      sleep: { frames: ['animations/sleep/01.png'], durations: [100], loop: true, scale: 1 },
      reaction: { frames: ['animations/reaction/01.png'], durations: [100], loop: false, scale: 1 },
      'relax-a': { frames: ['animations/relax-a/01.png'], durations: [100], loop: false, scale: 1 },
      'relax-b': { frames: ['animations/relax-b/01.png'], durations: [100], loop: false, scale: 1 }
    },
    behavior: { random: [{ state: 'walk', weight: 1, minDuration: 1000, maxDuration: 2000 }] },
    sequences: {
      relax: {
        stages: [
          { action: 'relax-a', message: 'hi', duration: 1000 },
          { action: 'relax-b', messages: ['我要这个', '我要这个'], waitForClick: true },
          { action: 'idle', duration: 0 }
        ]
      }
    },
    contextMenuActions: [
      { id: 'relax', label: '去放松', sequence: 'relax' }
    ],
    ...overrides
  };
}

assert.doesNotThrow(() => validateManifest(baseManifest(), { requireFiles: false }));

assert.throws(() => validateManifest(baseManifest({
  contextMenuActions: [{ id: 'relax', label: '去放松', action: 'reaction', sequence: 'relax' }]
}), { requireFiles: false }));

assert.throws(() => validateManifest(baseManifest({
  contextMenuActions: [{ id: 'relax', label: '去放松', sequence: 'missing' }]
}), { requireFiles: false }));

console.log('test-sequences-schema: ok');
```

注意：`validateManifest` 对标准动作帧数可能有更严要求——测试夹具帧数需满足当前校验器（若要求 idle≥4，把 frames 补到合规，或只测 `sequences` 分支时复用 `test-petpack-security.js` 里已有合法 base）。**以实现时校验器真实规则为准，夹具必须能通过「无 sequences 的合法包」再叠加 sequences。**

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/test-sequences-schema.js`  
Expected: FAIL（未知字段或 sequence 菜单被拒）

- [ ] **Step 3: 实现校验 + 更新 schema 文档与 Python 工具**

- [ ] **Step 4: 跑测试确认通过**

Run: `node scripts/test-sequences-schema.js`  
Expected: `test-sequences-schema: ok`

- [ ] **Step 5: Commit（仅当用户要求时）**

---

### Task 3: 主进程接入序列 + 渲染多句气泡

**Files:**
- Modify: `src/main-v3.js`
- Modify: `src/renderer-v3.js`
- Modify: `src/styles-v3.css`（若多句仍用单气泡错开则可能无需改；保持单气泡依次显示）
- Modify: `scripts/test-renderer-interaction.js`（覆盖 `messages` 错开）
- Modify: `package.json` `build.files` 加入 `src/sequence-controller.js`

**Interfaces:**
- Consumes: `createSequenceController`（Task 1）
- Produces: 菜单可启动序列；等待点击时 `pet:interact` 调用 `continueFromClick`；拖拽 start / 其它菜单 / hide 调用 `cancel`

- [ ] **Step 1: 扩展 `sendState` 载荷**

```js
function sendState(state, message = '', speech = '', extras = {}) {
  // ...
  petWindow.webContents.send('pet:state', {
    state,
    logicalRole,
    message,
    speech,
    speechAudio,
    messages: Array.isArray(extras.messages) ? extras.messages : undefined,
    messageGapMs: Number.isFinite(extras.messageGapMs) ? extras.messageGapMs : undefined
  });
}
```

序列控制器的 `sendState` 包装成把 `extras` 传下去。

- [ ] **Step 2: 渲染层依次显示 messages**

在 `renderer-v3.js` 的 `setState`：若 `payload.messages?.length`，按 `messageGapMs`（默认 700）依次更新气泡文本；打断时清掉 pending timeouts。

- [ ] **Step 3: main 生命周期**

- `app.whenReady` / 创建 window 后：`sequence = createSequenceController({...})`
- `runContextMenuAction`：若 `item.sequence`，`sequence.start(item.sequence)` 并 return；否则保持旧逻辑；启动前 `sequence.cancel()` 若已有活动序列
- `pet:interact`：若 `sequence.isWaitingForClick()` → `continueFromClick()`；若 `sequence.isActive()` → 忽略普通 reaction；否则旧 reaction 逻辑
- `pet:drag-start`：`sequence.cancel()`
- 托盘「暂时藏起来」/ `switchPet`：`sequence.cancel()`
- `interactionActions.drag` 仍映射 petpack 的 `drag` 动画（资源 Task 提供）

- [ ] **Step 4: 渲染/交互回归**

Run: `node scripts/test-renderer-interaction.js`  
Expected: PASS（含 messages 用例）

Run: `node --check src/main-v3.js && node --check src/renderer-v3.js && node --check src/sequence-controller.js`  
Expected: 无输出、exit 0

- [ ] **Step 5: Commit（仅当用户要求时）**

---

### Task 4: 工作区与参考图 / 身份检查表

**Files:**
- Create: `pets/work/xiaomei-xiaotian/source/refs/`（拷贝 `pets/work/bestie-reference.png`）
- Create: `pets/work/xiaomei-xiaotian/IDENTITY.md`（辨识点检查表，供生成时勾选）

- [ ] **Step 1: 建目录并复制参考图**

```powershell
New-Item -ItemType Directory -Force -Path pets/work/xiaomei-xiaotian/source/refs | Out-Null
Copy-Item pets/work/bestie-reference.png pets/work/xiaomei-xiaotian/source/refs/bestie-reference.png -Force
```

- [ ] **Step 2: 写 IDENTITY.md**

必须列出：左小美痣+月牙链；右小甜比耶气质；禁止左右互换；日常 vs 高光服装规则；男模仅 relax。

- [ ] **Step 3: Commit（仅当用户要求时）**

---

### Task 5: 生成标准五动作 + drag（日常便服）

**Files:**
- Create under `pets/work/xiaomei-xiaotian/`：各动作 `*-chroma.png` → 去背 → `process_animation_strips.py` 输出帧
- 最终帧进入 `pets/library/xiaomei-xiaotian/animations/{idle,walk,sit,sleep,reaction,drag}/`

**Interfaces:**
- Consumes: desktop-pet-maker 流程与 IDENTITY.md
- Produces: 合规透明帧；双人同框、左美右甜

帧数下限：idle4 / walk6 / sit4 / sleep4 / reaction4 / drag6

- [ ] **Step 1: 按 skill 生成绿幕条（偏真人、日常便服、双人）**

提示词必须锁：同一对角色、左小美右小甜、完整身体、安全边距、无文字道具。

- [ ] **Step 2: 去背 + `process_animation_strips.py`**

任一条失败 → 整条重生成，禁止只擦碎片。

- [ ] **Step 3: 人工目检 contact sheet**

检查：痣/项链/左右站位/无串帧/基线稳定。

- [ ] **Step 4: 将帧写入 library 目录结构**

- [ ] **Step 5: Commit（仅当用户要求时）**

---

### Task 6: 生成闺蜜彩蛋动画

**Files:**
- `pets/library/xiaomei-xiaotian/animations/{cuddle,selfie,whisper,cheer}/`
- selfie 使用蕾丝高光装；其余日常装

帧数：各 ≥4（cheer/cuddle/whisper/selfie）；与标准动作同一画布尺度

- [ ] **Step 1–3:** 同 Task 5 流水线（生成→门禁→入库）
- [ ] **Step 4: Commit（仅当用户要求时）**

---

### Task 7: 生成 relax 分镜动画

**Files:**
- `animations/relax-makeup/` ≥4
- `animations/relax-dress/` ≥4（性感风换装结果姿态）
- `animations/relax-run/` ≥6（并排跑）
- `animations/relax-models/` ≥4（两男模+两人；暂停持帧友好，`holdLastFrame: true`）
- `animations/relax-hug/` ≥4
- `animations/relax-shy/` ≥4（娇羞抚摸/埋胸，成人角色、桌宠可读、非露骨）

- [ ] **Step 1–3:** 同 Task 5 流水线；男模腹肌可读、左右对应「我要这个」
- [ ] **Step 4: Commit（仅当用户要求时）**

---

### Task 8: 编写 `pet.json`、打包并包级测试

**Files:**
- Create: `pets/library/xiaomei-xiaotian/pet.json`
- Create: `pets/library/xiaomei-xiaotian/preview.png`
- Create: `pets/packages/xiaomei-xiaotian.petpack`
- Create: `scripts/test-bestie-petpack.js`
- Modify: `package.json`（接入测试；可选 `"build:bestie"` script）

**Interfaces:**
- Consumes: Tasks 2–7 的字段与动画
- Produces: 可 validate 的 petpack

`pet.json` 关键字段：

- `id`: `xiaomei-xiaotian`
- `name`: `小美&小甜`
- `personality`: `["温柔黏人","活泼外向","闺蜜"]`
- `startupGreeting`: `我们是小美和小甜～今天也要一起加油鸭。`
- `speechGender`: `female`（若沿用语音字段）
- `behavior.random`：按规格权重 walk32/sit24/reaction16/sleep12/cuddle10/whisper6
- `interactionActions.drag.action`: `drag`
- `contextMenuActions`：贴贴/合个影/说悄悄话/加油鸭/去放松(sequence)/去睡觉
- `sequences.relax`：按 File Structure 约定

- [ ] **Step 1: 写 `scripts/test-bestie-petpack.js`**

断言：id/name/startupGreeting；菜单含 `relax` 且 `sequence==='relax'`；`sequences.relax.stages` 中恰有一阶段 `waitForClick`；该阶段 `messages` 为两句「我要这个」；存在 `drag` 动画；随机池不含 selfie/cheer/relax。

- [ ] **Step 2: 生成 preview、写 pet.json**

可用 `create_pet_manifest.py` 生成初稿再手改 sequences/菜单。

- [ ] **Step 3: validate + build**

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/xiaomei-xiaotian
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/xiaomei-xiaotian pets/packages/xiaomei-xiaotian.petpack
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/xiaomei-xiaotian.petpack
node scripts/test-bestie-petpack.js
```

Expected: 全部 valid / ok

- [ ] **Step 4: Commit（仅当用户要求时）**

---

### Task 9: 开发版手测 + 客户 EXE

**Files:**
- Modify: 必要时 `package.json` 增加 `build:bestie`
- Output: `dist/customers/xiaomei-xiaotian/`（或 build-customer 默认目录）

- [ ] **Step 1: 开发版启动**

```powershell
npm start
```

手测清单：

- [ ] 双人同框 idle/walk/坐/睡/点击 reaction
- [ ] 拖拽为拖着屁股走；松手恢复
- [ ] 菜单：贴贴/合影/悄悄话/加油鸭/睡觉
- [ ] 去放松：化妆→换装→跑→男模+两句「我要这个」暂停→再点→拥抱→娇羞→回日常
- [ ] 暂停时拖拽会中断回 idle
- [ ] 透明穿透；静止连点无缩放平移

- [ ] **Step 2: 回归门禁**

```powershell
npm run test:regression
node scripts/test-sequence-controller.js
node scripts/test-sequences-schema.js
node scripts/test-bestie-petpack.js
```

Expected: PASS

- [ ] **Step 3: 客户构建**

```powershell
npm run build:customer -- --pet pets/packages/xiaomei-xiaotian.petpack --name "小美&小甜桌面宠物" --delivery-id xiaomei-xiaotian
```

- [ ] **Step 4: 启动 EXE 复核**

独立 userData、无导入/切换入口、动画与去放松再点、托盘退出。

- [ ] **Step 5: 交付说明**

列出已验证 / 未验证（含数字签名未做）。更新规格状态为「已实现待交付」或在 build-report 旁写简短 `DELIVERY.md`（仅当需要时；默认用 build-report.json + 对话交付）。

- [ ] **Step 6: Commit（仅当用户要求时）**

---

## Spec Coverage Checklist

| 规格项 | Task |
|---|---|
| 一体双人单窗口 | 5–8（资源）+ 无双窗口代码 |
| 标准五动作 | 5 |
| cuddle/selfie/whisper/cheer | 6 |
| drag 拖着屁股走 | 5 + interactionActions |
| relax 7 阶段 + waitForClick | 1–3, 7–8 |
| 两句「我要这个」错开 | 1 extras + 3 renderer + 8 manifest |
| 再点不分支 | 1 continueFromClick + 8 |
| 中断回 idle | 1 cancel + 3 接入 |
| 行为权重与菜单 | 8 |
| startupGreeting | 8 |
| 校验/schema | 2 |
| 客户 EXE | 9 |
| 质量门禁 | 5–7 处理脚本 + 9 regression |
| 不做双窗口/3D/签名 | 全局约束 |

## Self-Review Notes

- 无 TBD；菜单 `action`/`sequence` 互斥已写清
- 双气泡采用单气泡错开，满足「错开讨论」且免改复杂 UI
- `contextMenuActions` 上限 8，本包 6 项，合规
- 标准动作帧数夹具在 Task 2 测试中必须满足现有 validator（实现时对齐，不降低门禁）
