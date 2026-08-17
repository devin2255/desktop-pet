# 牛来办公桌宠 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给通用播放器加上办公 IM 总线、序列趋近目标和钉钉语音来电拒接，并交付原创小黄牛 `.petpack` + 自用 EXE「牛来桌面宠物」。

**Architecture:** 飞书/钉钉都是适配器，归一化事件进 `im-bus`，词库引擎仍是 `watch-rules`。来电不进日常窗口状态机：`approach-target` 只平移宠物窗口，让手锚点贴来电窗侧边、脚锚点对齐挂断键；脚与按钮重叠后才 Invoke。人设、词库、分镜、语音全部进 `pets/library/niulai`。

**Tech Stack:** Electron 43、Node ≥22、既有 koffi / get-windows、UI Automation（钉钉来电，可注入假矩形）、既有 petpack 工具链、Windows 中文 TTS 降级。

---

## Global Constraints

- 设计原文：`docs/superpowers/specs/2026-08-17-niulai-office-pet-design.md`。本计划吸收已确认建议，不推翻锁定决策。
- 播放器不写死「牛来」。`src/` 里禁止宠物名、电影台词、钉钉专用状态机硬编码进 renderer。
- 老板名单只进本机 `userData/boss-watch.json`，不进仓库。
- 旧 `boss-watch.json` 无 `platforms` / `callHangup` 时：飞书行为与现在一致，拒接视为关。
- `keywordStates` 禁止映射到窗口逻辑角色 `climb` / `perch` / `hang` / `drag` / `fall` / `impact` / `recover`。加班用 `crawl` 只播动画。
- 来电攀爬走 `approach-target`，禁止 `interaction.transition('climb')`。
- 喊妈循环优先短 mp3；无录音则 TTS，间隔 ≥1200ms，不要 500ms 叠音。
- 画帧：同一画布、同一脚底基线；妈妈高出的部分只占画布上方；`call-mom-enter` 用合成，避免切帧脚本把双人当成碎块拒绝。
- 客户版：雷达关、拒接关、`bosses: []`，不得写入开发者 `ou_`。
- 交付说明写清：致敬人设，非官方周边。
- 未确认本计划前不要画帧。实施时先播放器通用与假窗口测试，再画帧，最后钉钉真机。
- 每次任务结束后：`npm run test:js` 相关子集必须绿。涉及动画时再跑 `python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v`。

## File map

| 路径 | 职责 |
|---|---|
| `src/approach-target.js` | 纯几何：锚点对齐屏幕矩形，得到宠物窗口左上角 |
| `src/im-match.js` | 老板匹配：飞书 `ou_`、钉钉显示名、来电标题 |
| `src/im-bus.js` | 启停适配器；消息进词库；来电进序列 |
| `src/im-adapter-lark.js` | 从现有 `message-watcher.js` 抽出飞书事件流 |
| `src/im-adapter-dingtalk.js` | 钉钉来电窗口/挂断键矩形 + Invoke；文本消息 spike 失败则空实现 |
| `src/watch-config.js` | `platforms`、`callHangup`；客户默认 |
| `src/sequence-controller.js` | `approachTarget` / `messageLoop` / `speechGender` / `speechAudio` / `restorePosition`；到达或超时才进下一场 |
| `src/petpack-validator.js` | 校验上述序列字段与 `contacts` |
| `src/main-v3.js` | 接线、托盘两项开关、来电会话、`sendState` 带 `speechGender`/`messageLoop` |
| `src/renderer-v3.js` | 阶段 `speechGender`；`messageLoop`；短音频可循环直到下一状态 |
| `src/message-watcher.js` | 改为被 lark 适配器调用，或薄封装 re-export，避免复制词库 |
| `skills/desktop-pet-maker/references/petpack-schema.md` | 文档同步 |
| `pets/library/niulai/**` | 资源包 |
| `scripts/test-approach-target.js` 等 | 单测 |
| `scripts/compose_call_enter.py` | 把牛来+妈妈合成入画帧 |

钉钉文本事件源：实施 Task 8 时先 spike。没有稳定、可本机运行的官方 Stream / 企业内部应用事件，则适配器 `startMessages()` 为空操作，托盘不假装钉钉消息已连通。飞书消息必须仍可用。禁止发明 `ding-cli`。

---

### Task 1: `approach-target` 几何（TDD）

**Files:**
- Create: `src/approach-target.js`
- Test: `scripts/test-approach-target.js`
- Modify: `package.json` 的 `test:js`，在 `test-sequence-controller.js` 前插入 `node scripts/test-approach-target.js`

- [ ] **Step 1: 写失败测试**

```js
'use strict';
const assert = require('assert');
const {
  petPositionForAnchor,
  nearestVerticalEdge,
  insetRect,
  anchorsOverlap,
  mirrorAnchorX
} = require('../src/approach-target');

function testPetPositionForAnchor() {
  const pet = { width: 200, height: 100 };
  const target = { x: 500, y: 400 };
  const pos = petPositionForAnchor(pet, { x: 0.08, y: 0.38 }, target);
  assert.strictEqual(pos.x, 500 - Math.round(200 * 0.08));
  assert.strictEqual(pos.y, 400 - Math.round(100 * 0.38));
}

function testNearestVerticalEdge() {
  const call = { x: 1000, y: 100, width: 280, height: 160 };
  const pet = { x: 200, y: 400, width: 200, height: 100 };
  const edge = nearestVerticalEdge(pet, call);
  assert.strictEqual(edge.side, 'left');
  assert.strictEqual(edge.x, 1000);
  assert.ok(edge.y >= 100 && edge.y <= 260);
}

function testInsetReject() {
  const btn = { x: 1100, y: 200, width: 80, height: 40 };
  const inset = insetRect(btn, 0.25);
  assert.strictEqual(inset.width, 40);
  assert.strictEqual(inset.height, 20);
  assert.strictEqual(inset.x, 1120);
  assert.strictEqual(inset.y, 210);
}

function testOverlap() {
  assert.strictEqual(anchorsOverlap(
    { x: 10, y: 10, width: 200, height: 100 },
    { x: 0.72, y: 0.96 },
    { x: 140, y: 90, width: 40, height: 20 }
  ), true);
  assert.strictEqual(anchorsOverlap(
    { x: 0, y: 0, width: 200, height: 100 },
    { x: 0.1, y: 0.1 },
    { x: 500, y: 500, width: 40, height: 20 }
  ), false);
}

function testMirror() {
  assert.strictEqual(mirrorAnchorX({ x: 0.08, y: 0.38 }).x, 0.92);
  assert.strictEqual(mirrorAnchorX({ x: 0.08, y: 0.38 }).y, 0.38);
}

const tests = { testPetPositionForAnchor, testNearestVerticalEdge, testInsetReject, testOverlap, testMirror };
let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`ok - ${name}`); } catch (e) { failed += 1; console.error(`FAIL - ${name}: ${e.message}`); }
}
if (failed) process.exit(1);
console.log('approach-target: all tests passed');
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/test-approach-target.js`

Expected: `Cannot find module '../src/approach-target'`，退出码 1

- [ ] **Step 3: 实现** `src/approach-target.js`

```js
'use strict';

function petPositionForAnchor(petSize, anchor, targetPoint) {
  const ax = Number(anchor?.x);
  const ay = Number(anchor?.y);
  return {
    x: Math.round(targetPoint.x - petSize.width * ax),
    y: Math.round(targetPoint.y - petSize.height * ay)
  };
}

function nearestVerticalEdge(petBounds, windowBounds) {
  const petCx = petBounds.x + petBounds.width / 2;
  const left = windowBounds.x;
  const right = windowBounds.x + windowBounds.width;
  const useLeft = Math.abs(petCx - left) <= Math.abs(petCx - right);
  const y = Math.min(
    Math.max(petBounds.y + petBounds.height / 2, windowBounds.y),
    windowBounds.y + windowBounds.height
  );
  return useLeft
    ? { side: 'left', x: left, y }
    : { side: 'right', x: right, y };
}

function insetRect(rect, ratio) {
  const r = Math.min(0.49, Math.max(0, Number(ratio) || 0));
  const width = Math.round(rect.width * (1 - 2 * r));
  const height = Math.round(rect.height * (1 - 2 * r));
  return {
    x: Math.round(rect.x + rect.width * r),
    y: Math.round(rect.y + rect.height * r),
    width: Math.max(1, width),
    height: Math.max(1, height)
  };
}

function anchorScreenPoint(petBounds, anchor) {
  return {
    x: petBounds.x + petBounds.width * Number(anchor.x),
    y: petBounds.y + petBounds.height * Number(anchor.y)
  };
}

function anchorsOverlap(petBounds, anchor, targetRect) {
  const p = anchorScreenPoint(petBounds, anchor);
  return p.x >= targetRect.x && p.x <= targetRect.x + targetRect.width
    && p.y >= targetRect.y && p.y <= targetRect.y + targetRect.height;
}

function mirrorAnchorX(anchor, mirrored) {
  if (!mirrored) return { x: Number(anchor.x), y: Number(anchor.y) };
  return { x: 1 - Number(anchor.x), y: Number(anchor.y) };
}

module.exports = {
  petPositionForAnchor,
  nearestVerticalEdge,
  insetRect,
  anchorScreenPoint,
  anchorsOverlap,
  mirrorAnchorX
};
```

- [ ] **Step 4: 跑测试**

Run: `node scripts/test-approach-target.js`

Expected: `approach-target: all tests passed`

- [ ] **Step 5: 把脚本挂进 `package.json` 的 `test:js`，提交**

```bash
git add src/approach-target.js scripts/test-approach-target.js package.json
git commit -m "$(cat <<'EOF'
feat: add approach-target geometry for call-window alignment

EOF
)"
```

Windows 无 HEREDOC 时用：

```powershell
git add src/approach-target.js scripts/test-approach-target.js package.json
git commit -m "feat: add approach-target geometry for call-window alignment"
```

---

### Task 2: 老板匹配 + 配置扩展（TDD）

**Files:**
- Create: `src/im-match.js`
- Test: `scripts/test-im-match.js`
- Modify: `src/watch-config.js`、`scripts/test-watch-config.js`

- [ ] **Step 1: 写 `scripts/test-im-match.js`**

```js
'use strict';
const assert = require('assert');
const { matchBoss } = require('../src/im-match');

const rules = { ids: ['ou_1'], names: ['张总'] };

assert.strictEqual(matchBoss({ platform: 'lark', kind: 'message', senderId: 'ou_1' }, rules), true);
assert.strictEqual(matchBoss({ platform: 'lark', kind: 'message', senderId: 'ou_9' }, rules), false);
assert.strictEqual(matchBoss({ platform: 'dingtalk', kind: 'message', senderName: '张总' }, rules), true);
assert.strictEqual(matchBoss({ platform: 'dingtalk', kind: 'message', senderName: '张伟' }, rules), false);
assert.strictEqual(matchBoss({
  platform: 'dingtalk', kind: 'voice-call', senderName: '张总', text: '张总邀请你语音通话'
}, rules), true);
assert.strictEqual(matchBoss({
  platform: 'dingtalk', kind: 'voice-call', senderName: '同事甲', text: '同事甲邀请你语音通话'
}, rules), false);
console.log('im-match: ok');
```

- [ ] **Step 2: 实现 `src/im-match.js`**

```js
'use strict';
const { isBoss } = require('./watch-rules');

function matchBoss(event, rules) {
  const ids = Array.isArray(rules?.ids) ? rules.ids : [];
  const names = Array.isArray(rules?.names) ? rules.names : [];
  if (!event || typeof event !== 'object') return false;
  if (event.platform === 'lark' && event.kind !== 'voice-call') {
    return isBoss(event.senderId, ids);
  }
  const hay = `${event.senderName || ''} ${event.text || ''}`;
  return names.some((name) => {
    if (typeof name !== 'string' || name.trim().length < 2) return false;
    const n = name.trim();
    return event.senderName === n || hay.includes(n);
  });
}

module.exports = { matchBoss };
```

显示名最短 2 个字符，避免单字误伤。

- [ ] **Step 3: 扩展 `loadWatchConfig` 返回值**（旧文件缺字段时安全默认）

在 `src/watch-config.js` 的 `return { ... }` 增加：

```js
platforms: normalizePlatforms(fileCfg.platforms),
callHangup: normalizeCallHangup(fileCfg.callHangup)
```

新增函数：

```js
function normalizePlatforms(raw) {
  const allowed = new Set(['lark', 'dingtalk']);
  const list = Array.isArray(raw) ? raw.filter((x) => allowed.has(x)) : [];
  return list.length ? [...new Set(list)] : ['lark'];
}

function normalizeCallHangup(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const platforms = Array.isArray(src.platforms)
    ? src.platforms.filter((x) => x === 'dingtalk')
    : ['dingtalk'];
  return {
    enabled: src.enabled === true,
    platforms: platforms.length ? platforms : ['dingtalk'],
    cooldownSec: Number.isFinite(Number(src.cooldownSec)) ? Math.max(0, Number(src.cooldownSec)) : 60
  };
}
```

`ensureBossWatchDefaults(configPath, { customer } = {})`：文件已存在则不改。缺失时：

- 自用：在现有 `SELF_USE_DEFAULT_CONFIG` 上加 `"platforms": ["lark", "dingtalk"]` 和 `"callHangup": { "enabled": true, "platforms": ["dingtalk"], "cooldownSec": 60 }`。不要改现有 `bosses`。
- 客户：写入 `{ "enabled": false, "bosses": [], "platforms": ["lark", "dingtalk"], "cooldownSec": 30, "quietHours": [], "callHangup": { "enabled": false, "platforms": ["dingtalk"], "cooldownSec": 60 }, "voice": { "enabled": true, "gender": "male", "rate": "+0%", "voice": "zh-CN-YunxiNeural" } }`。禁止写入任何 `ou_`。

- [ ] **Step 4: 补 `scripts/test-watch-config.js`**

```js
function testCallHangupDefaultOff() {
  const cfg = loadWatchConfig({ configPath: path.join(os.tmpdir(), 'nope-xxx.json'), larkCliPath: 'lark' });
  assert.strictEqual(cfg.callHangup.enabled, false);
  assert.deepStrictEqual(cfg.platforms, ['lark']);
}

function testCallHangupFromFile() {
  const p = tmpJson({ enabled: true, bosses: ['张总'], platforms: ['lark', 'dingtalk'], callHangup: { enabled: true, cooldownSec: 90 } });
  const cfg = loadWatchConfig({ configPath: p, larkCliPath: 'lark' });
  assert.strictEqual(cfg.callHangup.enabled, true);
  assert.strictEqual(cfg.callHangup.cooldownSec, 90);
  assert.deepStrictEqual(cfg.platforms, ['lark', 'dingtalk']);
}
```

把这两个函数加入现有 `tests` 对象。

- [ ] **Step 5: 跑测并提交**

Run:

```
node scripts/test-im-match.js
node scripts/test-watch-config.js
```

Expected: 都 ok。

```powershell
git add src/im-match.js src/watch-config.js scripts/test-im-match.js scripts/test-watch-config.js package.json
git commit -m "feat: extend boss-watch config for platforms and call hangup"
```

---

### Task 3: 序列新字段 + `sendState` 选项（TDD）

**Files:**
- Modify: `src/sequence-controller.js`、`scripts/test-sequence-controller.js`
- Modify: `src/main-v3.js` 的 `sendState` / 序列接线
- Modify: `src/renderer-v3.js` 的 `onState` / `setState` / TTS
- Modify: `src/preload-v3.js` 若需要把新字段放进 `pet:state`（主进程 `webContents.send` 已能带任意字段，preload 若白名单则要加）

先读 `src/preload-v3.js`：若 `onState` 原样转发对象，不必改。若逐字段挑选，补 `speechGender`、`messageLoop`、`speechLoop`。

- [ ] **Step 1: 扩展序列测试**

把 `scripts/test-sequence-controller.js` 的 `sendState` 假实现改成记录完整 extras，并追加：

```js
function testApproachWaitsUntilArrivedOrTimeout() {
  const moves = [];
  const seq2 = createSequenceController({
    getManifest: () => ({
      animations: { idle: {}, 'call-climb': {}, 'call-mom-kick': {} },
      sequences: {
        'boss-call': {
          contacts: {
            climb: { action: 'call-climb', anchor: { x: 0.08, y: 0.38 } },
            hangup: { action: 'call-mom-kick', anchor: { x: 0.72, y: 0.96 } }
          },
          stages: [
            { action: 'call-climb', approachTarget: 'incoming-call-edge', messages: ['妈妈！'], messageLoop: true, messageGapMs: 1200, timeoutMs: 4000, speechAudio: 'audio/call-mom.mp3', speechLoop: true, speechGender: 'male' },
            { action: 'call-mom-kick', approachTarget: 'incoming-call-reject', timeoutMs: 1200, speechGender: 'female' },
            { action: 'idle', duration: 0, restorePosition: true }
          ]
        }
      }
    }),
    sendState: (action, message, speech, extras) => { calls.states.push({ action, message, extras }); },
    pauseBehavior: () => {},
    scheduleBehavior: () => {},
    setTimer: (fn, ms) => { calls.timer = { fn, ms }; return 1; },
    clearTimer: () => { calls.timer = null; },
    getPetBounds: () => ({ x: 0, y: 0, width: 200, height: 100 }),
    movePetWindow: (x, y) => moves.push({ x, y }),
    getApproachRect: (name) => name === 'incoming-call-edge'
      ? { x: 1000, y: 100, width: 280, height: 160 }
      : { x: 1180, y: 220, width: 60, height: 30 },
    onContact: (stage) => { calls.contact = stage.action; }
  });
  const origin = { x: 10, y: 20 };
  assert.strictEqual(seq2.start('boss-call', { restoreFrom: origin }), true);
  assert.strictEqual(calls.states.at(-1).action, 'call-climb');
  assert.strictEqual(calls.states.at(-1).extras.messageLoop, true);
  assert.ok(moves.length >= 1);
  // 未到达时 timeout 到期 -> 下一场；onContact 仍不触发（脚未重叠）
  calls.timer.fn();
  assert.strictEqual(calls.states.at(-1).action, 'call-mom-kick');
}
```

现有 `demo` 用例必须继续全绿：`start('demo')` 不传 session 时行为与现在相同。

- [ ] **Step 2: 改 `playStage`**

`src/sequence-controller.js` 关键语义：

1. `buildExtras(stage)` 增加 `speechAudio`、`speechGender`、`messageLoop`、`speechLoop`。
2. `sendState(stage.action, message, '', extras)` 保持现有四参形状（main 已把第四参映射成 options）。
3. 若 `stage.approachTarget`：
   - 用 `getApproachRect(stage.approachTarget)`；没有矩形则不 `movePetWindow`，按 `timeoutMs || duration || 4000` 定时 `advance`。
   - 有矩形则：取 sequence.contacts 里对应锚点（edge 用 `climb`，reject 用 `hangup`）；`side === 'right'` 时 `mirrorAnchorX(anchor, true)`；`petPositionForAnchor` + `movePetWindow`。
   - 每 50ms 再读一次矩形（弹窗移动则跟踪），直到 `anchorsOverlap` 或超时。
   - 超时未重叠：`advance`，不要调用 `onContact`。
   - 重叠且本阶段是 hangup 动作：先 `advance` 到 kick 的播放，在 kick 阶段开始时若仍重叠再 `onContact(stage)`。为避免「分镜一开始就 Invoke」，`onContact` 只允许 `stage.action` 等于 `contacts.hangup.action`。
4. `stage.restorePosition === true`：本阶段 `sendState` 之后立刻 `movePetWindow(restoreFrom.x, restoreFrom.y)`（`start` 时记下）。`idle` + `duration: 0` 仍立即 `advance`。
5. `start(id, session)`：`session.restoreFrom` 缺省则 `getPetBounds()` 的 x/y。
6. `cancel`：若尚未 `onContact` 成功，不补调用 `onContact`。用户拖拽由 main 调 `sequence.cancel()`。

趋近循环用注入的 `setTimer`，不要直接 `setInterval`，方便测试。

- [ ] **Step 3: `sendState` 把新字段塞进 IPC**

`src/main-v3.js`：

```js
function sendState(state, message = '', speech = '', logicalRole = state, options) {
  // ...existing speechAudio rewrite...
  petWindow.webContents.send('pet:state', {
    state,
    logicalRole,
    message,
    speech,
    speechAudio,
    messages: Array.isArray(options?.messages) ? options.messages : undefined,
    messageGapMs: Number.isFinite(options?.messageGapMs) ? options.messageGapMs : undefined,
    speechGender: options?.speechGender === 'male' || options?.speechGender === 'female' ? options.speechGender : undefined,
    messageLoop: options?.messageLoop === true,
    speechLoop: options?.speechLoop === true
  });
}
```

序列接线保持：

```js
sendState: (action, message, speech, extras) => {
  sendState(action, message, speech, action, extras || {});
}
```

- [ ] **Step 4: renderer**

`setState` 增加 `speechGender`、`messageLoop`、`speechLoop`。

- TTS：`speak(text)` 使用 `pendingState.speechGender || manifest.speechGender`。
- `messageLoop === true` 且 `messages` 非空：在 `showStaggeredMessages` 结束后若 `pendingState` 仍是同一代（加 generation token），再从头循环，直到 `setState` 换代。`messageGapMs` 下限 1200。
- `speechLoop === true` 且有 `speechAudio`：`audio.loop = true`，下一 `setState` 必须 `audio.pause(); audio.loop = false`。
- 无 `speechAudio` 且 `messageLoop`：不要每 500ms 调一次 `speechSynthesis.speak`。只在该阶段开始时说第一声。

- [ ] **Step 5: 跑测并提交**

Run:

```
node scripts/test-sequence-controller.js
node --check src/sequence-controller.js
node --check src/main-v3.js
node --check src/renderer-v3.js
```

```powershell
git add src/sequence-controller.js src/main-v3.js src/renderer-v3.js src/preload-v3.js scripts/test-sequence-controller.js
git commit -m "feat: sequence approachTarget, messageLoop, and per-stage voice"
```

---

### Task 4: petpack 校验与 schema 文档

**Files:**
- Modify: `src/petpack-validator.js`、`scripts/test-sequences-schema.js`
- Modify: `skills/desktop-pet-maker/references/petpack-schema.md`

允许的 `approachTarget`：`incoming-call-edge`、`incoming-call-reject`。

阶段可选字段：

| 字段 | 约束 |
|---|---|
| `speechAudio` | 字符串，走现有 referencedFiles |
| `speechGender` | `male` \| `female` |
| `messageLoop` | boolean |
| `speechLoop` | boolean |
| `approachTarget` | 上述枚举 |
| `timeoutMs` | 整数 0–10000 |
| `restorePosition` | boolean |

序列可选 `contacts.climb` / `contacts.hangup`：形状与 `interactionActions` 单项相同（`action` + `anchor` 0..1）。`action` 必须存在于 `animations`。

`messageGapMs` 上限保持 5000。牛来包用 1200。

- [ ] **Step 1: 在 `scripts/test-sequences-schema.js` 增加合法 boss-call 样例与非法枚举**

合法：`approachTarget: 'incoming-call-edge'`、`messageLoop: true`、`contacts` 锚点。

非法：`approachTarget: 'window-top'` 必须 throw。

- [ ] **Step 2: 实现校验，更新 schema 文档表格**

- [ ] **Step 3: 跑 `node scripts/test-sequences-schema.js` 并提交**

```powershell
git add src/petpack-validator.js scripts/test-sequences-schema.js skills/desktop-pet-maker/references/petpack-schema.md
git commit -m "feat: validate call-sequence stage fields in petpack schema"
```

---

### Task 5: IM 总线 + 飞书适配器拆分

**Files:**
- Create: `src/im-bus.js`、`src/im-adapter-lark.js`
- Modify: `src/message-watcher.js`（抽出 `handleBossMessage`，供总线调用）
- Modify: `src/main-v3.js` 启动路径
- Test: `scripts/test-im-bus.js`；更新 `scripts/test-message-watcher.js` 若导出变化

归一化事件：

```js
{
  platform: 'lark' | 'dingtalk',
  kind: 'message' | 'voice-call',
  eventId: 'string',
  senderId: 'string',
  senderName: 'string',
  text: 'string',
  chatType: 'p2p' | 'group' | 'unknown'
}
```

- [ ] **Step 1: 把 `message-watcher.js` 的 `processLine` 匹配/冷却/词库/`sendState` 抽成 `dispatchBossMessage(event, ctx)`**

`ctx = { rules, voice, sendState, rng, now, cooldownMap }`。

`keywordStates` 映射后的 `state` 若属于窗口角色集合，强制回退 `rules.state`（默认 `reaction`）。窗口角色：`climb, perch, hang, drag, fall, impact, recover`。`crawl` 允许。

飞书 watcher 继续 `isBoss(sender_id, rules.ids)`；总线在交给 dispatch 前用 `matchBoss`。为少动飞书路径：lark 适配器仍可直接调现有 `processLine`。总线只对已经归一化、且 `matchBoss` 为 true 的事件调用 dispatch。

- [ ] **Step 2: `createImBus`**

```js
function createImBus({ getRules, adapters, dispatchMessage, onVoiceCall, logger }) {
  let started = false;
  async function start() {
    const rules = getRules();
    if (!rules.enabled) return;
    started = true;
    for (const adapter of adapters) {
      if (!rules.platforms.includes(adapter.platform)) continue;
      try { await adapter.start({ rules, onMessage, onVoiceCall }); }
      catch (err) { logger?.warn?.(adapter.platform, err); }
    }
  }
  function onMessage(event) {
    const rules = getRules();
    if (inQuietHours(new Date(), rules.quietHours)) return;
    if (!matchBoss(event, rules)) return;
    dispatchMessage(event, rules);
  }
  function stop() { adapters.forEach((a) => a.stop?.()); started = false; }
  return { start, stop, isStarted: () => started };
}
```

来电不在 `onMessage` 里处理。`adapter` 调 `onVoiceCall(event)`；总线里：`!rules.callHangup.enabled` 则 return；静默时段 return；`matchBoss` false 则 return；来电冷却用 `callHangup.cooldownSec`；通过则 `onVoiceCall`（由 main 提供，启动序列）。

- [ ] **Step 3: lark 适配器** 包装现有 `createMessageWatcher`。`platform: 'lark'`。不要复制词库。

- [ ] **Step 4: main 用 im-bus 替换「仅 createMessageWatcher」**。lark 未启用时桌宠照常。

- [ ] **Step 5: 测试**

`scripts/test-im-bus.js`：假适配器推一条老板画饼 → dispatch 被调用；非老板不调用；`callHangup.enabled false` 时 voice-call 不启动序列。

跑 `node scripts/test-message-watcher.js` 与 `node scripts/test-im-bus.js`。

```powershell
git add src/im-bus.js src/im-adapter-lark.js src/message-watcher.js src/main-v3.js scripts/test-im-bus.js scripts/test-message-watcher.js
git commit -m "feat: split lark watcher into IM bus adapters"
```

---

### Task 6: 钉钉来电适配器（假窗口夹具，禁止静默挂）

**Files:**
- Create: `src/im-adapter-dingtalk.js`
- Test: `scripts/test-im-adapter-dingtalk.js`

适配器构造注入：

```js
createDingtalkAdapter({
  locateIncomingCall, // async () => { windowBounds, rejectBounds, title, displayName } | null
  invokeReject,       // async (rejectBounds) => boolean
  pollMs: 1000
})
```

真机实现可后补；本任务测试全部注入。

- [ ] **Step 1: 测试用例**

1. `locateIncomingCall` 返回同事 → 不 emit voice-call。
2. 返回「张总」且名单含张总 → emit `{ platform:'dingtalk', kind:'voice-call', senderName:'张总', text: title }`。
3. `invokeReject` 默认不被 start 调用（真挂只发生在序列 onContact）。
4. locate 抛错 → start 不炸，`stop` 可重复。

- [ ] **Step 2: 实现轮询**

`start({ rules, onVoiceCall })`：若 `!rules.callHangup.enabled` 直接 return。setInterval：locate → matchBoss → `onVoiceCall`。同一通来电用 `title+displayName` 做 eventId 去重，直到 locate 变 null 清去重。

`stop` 清 timer。

导出 `invokeReject` 给 main 的 `onContact` 用，不要在适配器内部因「看到弹窗」就点。

挂断键矩形交给序列前先 `insetRect(rejectBounds, 0.25)`。

- [ ] **Step 3: 真机 locate 骨架**（可先返回 null）

用 UI Automation / koffi 枚举钉钉进程窗口。标题或子树文本匹配「语音」「通话」「邀请」。找不到按钮则 `rejectBounds: null`。选择器失效视为适配器失败：桌宠其它功能继续。

本任务即使 locate 恒为 null，假注入测试也必须绿。

- [ ] **Step 4: main 的来电会话**

```js
onVoiceCall: (event) => {
  if (sequence.isActive()) return;
  if (!activeManifest?.sequences?.['boss-call']) return; // 不演戏、不静默挂
  const restoreFrom = petWindow.getBounds();
  const started = sequence.start('boss-call', {
    restoreFrom,
    getApproachRect: (name) => {
      const located = lastLocatedCall; // 适配器缓存的最新一次
      if (!located) return null;
      if (name === 'incoming-call-edge') return located.windowBounds;
      if (name === 'incoming-call-reject') {
        if (!located.rejectBounds) return null;
        return insetRect(located.rejectBounds, 0.25);
      }
      return null;
    },
    onContact: async (stage) => {
      const located = lastLocatedCall;
      if (!located?.rejectBounds) {
        sendState('idle', '这次没挂上', '', 'idle', {});
        return;
      }
      const pet = petWindow.getBounds();
      const hangup = activeManifest.sequences['boss-call'].contacts.hangup;
      const mirrored = /* 与趋近同一 side */;
      if (!anchorsOverlap(pet, mirrorAnchorX(hangup.anchor, mirrored), insetRect(located.rejectBounds, 0.25))) {
        sendState(stage.action, '这次没挂上', '', stage.action, {});
        return;
      }
      const ok = await dingtalk.invokeReject(located.rejectBounds);
      if (!ok) sendState(stage.action, '这次没挂上', '', stage.action, {});
    }
  });
  if (!started) return;
}
```

找不到窗口：分镜仍可 `start`；`getApproachRect` 返回 null → 原地演戏（右键试演同此）。禁止 Invoke。

用户拖拽：`petWindow` 的 `will-move` / 现有 drag 路径里若 `sequence.isActive()` 则 `sequence.cancel()`。

日志：不写来电人姓名、不截图。失败原因只进托盘气泡短句「这次没挂上」。

- [ ] **Step 5: 托盘**

在「始终置顶」附近加：

- `办公雷达` checkbox ← `watchConfig.enabled`，写入 `boss-watch.json` 后重启总线
- `拒接老板钉钉语音` checkbox ← `callHangup.enabled`

客户构建 `deliveryConfig.mode === 'customer'` 时两项默认写入 false（Task 2 的 ensure 已处理）。托盘仍显示，便于自用同一代码。

跑 `node scripts/test-im-adapter-dingtalk.js` 与 `npm run test:js`。

```powershell
git add src/im-adapter-dingtalk.js src/im-bus.js src/main-v3.js scripts/test-im-adapter-dingtalk.js
git commit -m "feat: add DingTalk incoming-call adapter with contact-frame hangup"
```

---

### Task 7: 钉钉文本消息 spike（可空实现）

**Files:** `src/im-adapter-dingtalk.js`、本计划文件末尾「未验证」清单

- [ ] **Step 1:** 查找是否存在可本机跑的钉钉官方 Stream / 企业内部应用事件，且不必把聊天正文落盘。

- [ ] **Step 2:** 若无：`startMessages` 为空函数；托盘或首次气泡不要写「钉钉消息雷达已连接」。飞书继续工作。

- [ ] **Step 3:** 若有：归一化成 `kind: 'message'`，复用 `dispatchBossMessage`。正文只留内存。

不要为 spike 提交假装连通的 UI。有实现再补测试。

```powershell
git add src/im-adapter-dingtalk.js
git commit -m "feat: document DingTalk message source spike (no fake CLI)"
```

若完全无代码变化，跳过空提交。

---

### Task 8: 牛来 `pet.json`（先清单、后画帧）

**Files:**
- Create: `pets/library/niulai/pet.json`（动画路径先写上，帧文件下一任务才生成）
- 本任务不要 `petpack_tool validate` 到绿（缺 PNG 会失败）。可先把 JSON 放好。

锁定字段：

```json
{
  "schemaVersion": 1,
  "packageVersion": "1.0.0",
  "id": "niulai",
  "name": "牛来",
  "description": "办公嘴替小黄牛。致敬电影《牛来》人设，非官方周边。",
  "personality": ["胆小", "躺平", "嘴碎", "被点到突然燃"],
  "speechGender": "male",
  "startupGreeting": "打工人，牛来了。",
  "defaultSize": "small",
  "preview": "preview.png",
  "normalizationMetric": "alpha-area-v1",
  "callDisclaimer": "致敬电影人设，非官方授权周边。"
}
```

`callDisclaimer` 若不想扩 schema，改放到 `description` 即可，播放器不必解析。

动画 key（帧数按设计）：idle 4、walk 6、sit 4、sleep 4、reaction 4、crawl 6、drag 6、climb 6、perch 4、hang 4、fall 4、impact 4、recover 6、call-climb 6、call-mom-enter 4、call-mom-walk 6、call-mom-kick 4。

`interactionActions` 映射日常七角色到 `drag/climb/perch/hang/fall/impact/recover`，锚点手贴墙规则与现有宠物相同。不要把 `call-climb` 填进 `interactionActions.climb`。

`sequences.boss-call`：

```json
{
  "contacts": {
    "climb": { "action": "call-climb", "anchor": { "x": 0.08, "y": 0.38 } },
    "hangup": { "action": "call-mom-kick", "anchor": { "x": 0.72, "y": 0.96 } }
  },
  "stages": [
    {
      "action": "call-climb",
      "approachTarget": "incoming-call-edge",
      "messages": ["妈妈！"],
      "messageLoop": true,
      "messageGapMs": 1200,
      "timeoutMs": 4000,
      "speechAudio": "audio/call-mom.mp3",
      "speechLoop": true,
      "speechGender": "male"
    },
    {
      "action": "call-mom-enter",
      "message": "牛来？",
      "duration": 1000,
      "speechAudio": "audio/mom-niulai.mp3",
      "speechGender": "female"
    },
    {
      "action": "call-mom-walk",
      "approachTarget": "incoming-call-reject",
      "timeoutMs": 4000,
      "speechGender": "female"
    },
    {
      "action": "call-mom-kick",
      "duration": 1000,
      "speechGender": "female"
    },
    { "action": "idle", "duration": 0, "restorePosition": true }
  ]
}
```

无 mp3 时删 `speechAudio` / `speechLoop`，保留 `speechGender`。

词库：

```json
"watch": {
  "state": "reaction",
  "keywordStates": { "加班": "crawl" },
  "keywords": {
    "画饼": ["这饼我梦里见过。醒来还是饼。", "又画饼。我梦里那张还圆一点。"],
    "吹牛": ["你这牛，还不如我豹拉哥。", "这牛吹的，云雀都懒得记。"],
    "加班": ["又迁徙是吧。筐还越走越小。", "今晚再走一截，我还不会站。"],
    "甩锅": ["狼来了？先把我推出去是吧。", "这锅狗都不碰。"]
  },
  "triggers": {
    "画饼": ["画饼", "上市", "期权", "年终奖", "分红", "升职", "加薪", "亏待", "功劳", "融资", "不会亏待"],
    "吹牛": ["吹牛", "人脉", "搞得定", "包在我身上", "小意思", "当年"],
    "加班": ["今晚加班", "周末来一趟", "线上对齐", "EOD", "加班"],
    "甩锅": ["你看一下", "协同一下", "同步一下", "帮忙看下", "背锅"]
  },
  "fallback": { "text": "云雀又来报信了。我躺着听。" }
}
```

加班触发用「今晚加班」整词，不用单字「今晚」。

右键：`站起来` → reaction；`睡会儿做梦` → sleep；`演一出来电` → `sequence: "boss-call"`（无弹窗则原地喊妈+空踩）。

`behavior.random`：walk / sit / reaction / sleep，sit 与 reaction 带气泡。`behavior.perched`：一条「不敢跳。溪还没过。」，`idleMinMs` ≥ 25000。

`contextMenuActions` 不要豹拉出镜。

```powershell
git add pets/library/niulai/pet.json
git commit -m "feat: add niulai pet.json office-watch and boss-call sequence"
```

---

### Task 9: 画帧与切帧门禁

**Files:** `pets/library/niulai/animations/**`、`preview.png`、`scripts/compose_call_enter.py`

身份（所有条共用，禁止描电影 3D）：

```text
Original clumsy 2D yellow-brown calf mascot, short or no horns, soft hand-drawn game-sprite, slightly awkward proportions, not 3D, not cinematic, not polished guoman.
```

妈妈（仅 call-mom-walk / kick，以及合成入画用的单独条）：

```text
Adult yellow-brown cow in the exact same 2D hand-drawn style, thinner short horns, shoulders one head taller, not a different art style.
```

硬约束：

- 全部动作同一画布像素尺寸，脚底基线锁定。妈妈更高 = 头顶占用已有上方安全区，禁止改 `scale`、禁止加大窗口。
- idle：趴着躺平，偶有耳朵动。sleep 可略缩小但仍同基线。
- reaction：从趴到突然两脚站直，锁躯干尺度，50 连播不抖。
- call-climb：只有牛来，攀爬+张嘴，手在条的攀爬侧（右侧条，播放器镜像左侧）。
- call-mom-walk / kick：只有妈妈；kick 的脚接触点在画布底部，对准 `anchor.y ≈ 0.96`。
- 日常条禁止出现妈妈。
- 按 `skills/desktop-pet-maker/SKILL.md` 出 chroma 条 → 去绿 → `process_animation_strips.py`。失败就重画，禁止擦碎块继续。
- **双人入画：** 不要直接生成双人条去过连通块检查。分别出「该站位的牛来 hold」和「妈妈从右外侧走进至重叠」两条，归一化后再跑 `scripts/compose_call_enter.py`，把妈妈贴到牛来身侧，输出 `animations/call-mom-enter/01.png`–`04.png`。合成后两头必须有像素重叠或紧贴，避免被后续检查当碎块。脚本入参为两套已切帧 PNG 和输出目录。

参考：`skills/desktop-pet-maker/references/image-prompts.md` 的共用 suffix（安全边距、#00ff00、不许画窗框）。

额外条 prompt 要点：

- call-climb 6：沿看不见的右侧竖边往上爬，嘴张开像喊，手贴边，不要窗框。
- call-mom-walk 6：妈妈朝右走，朝左由播放器镜像。
- call-mom-kick 4：抬右脚踩向画面底部偏右的看不见按钮，最后一帧脚在底边接触。

音频：若能录，`audio/call-mom.mp3`（「妈妈！」）、`audio/mom-niulai.mp3`（「牛来？」）。不能录就删 pet.json 对应字段。

- [ ] **Step 1:** 生成并处理标准五动作 + 窗口七动作 + crawl  
- [ ] **Step 2:** 生成 call-climb、妈妈 walk/kick、入画合成  
- [ ] **Step 3:** 出 `preview.png`（趴着的小黄牛，透明底）  
- [ ] **Step 4:**

```
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/niulai
python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v
```

Expected: validate 通过；python 门禁绿。

```powershell
git add pets/library/niulai scripts/compose_call_enter.py
git commit -m "feat: add niulai animation frames and call-mom enter composite"
```

---

### Task 10: 打包、客户默认、真机

**Files:** `pets/packages/niulai.petpack`、`scripts/build-customer.js`（若客户首次启动仍走自用 ensure，则改 `main-v3.js` 传入 `{ customer: deliveryConfig?.mode === 'customer' }`）

- [ ] **Step 1: 确认 `ensureBossWatchDefaults(watchConfigPath, { customer: deliveryConfig?.mode === 'customer' })`**

- [ ] **Step 2: 打包**

```
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/niulai pets/packages/niulai.petpack
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/niulai.petpack
```

- [ ] **Step 3: 开发版**

```
npm start
```

检查：启动问候、idle 躺平、reaction 站起来、透明穿透、静止连点 50 次、拖动、日常爬窗手贴墙、坐窗「不敢跳」、跪爬、右键「演一出来电」原地喊妈空踩、托盘雷达/拒接开关。

- [ ] **Step 4: 客户 EXE**

```
node scripts/build-customer.js --pet pets/packages/niulai.petpack --name "牛来桌面宠物" --delivery-id niulai
```

不要用 `npm run build:customer --`。双击 EXE：宠物直接出现；无导入/切换库；`boss-watch.json` 雷达与拒接为关且无开发者 open_id。关于或交付说明含「致敬电影人设，非官方」。未做代码签名如实写进 `build-report.json`。

- [ ] **Step 5: 钉钉真机（有测试号才做）**

老板来电：牛来爬向弹窗循环「妈妈！」→ 妈妈入画独行 → 脚踩挂断 → 电话断开 → 回到原位躺平。非老板来电不演不挂。关掉托盘拒接后不演不挂。

没有测试号：在 `build-report.json` 标「钉钉真机未验证」。假窗口单测仍必须绿。

```powershell
git add pets/packages/niulai.petpack src/main-v3.js scripts/build-customer.js
git commit -m "feat: package niulai petpack and customer delivery defaults"
```

不要提交 `.idea/`、`outputs/` 二维码、本机 `boss-watch.json`。

---

## Spec coverage

| 设计章节 | 任务 |
|---|---|
| 办公嘴替、通用播放器、不写死牛来 | 全局 + Task 8 |
| IM 总线、飞书适配器 | Task 5 |
| 钉钉来电、接触才挂、不静默点 | Task 6 |
| 钉钉文本 spike | Task 7 |
| approach-target、手/脚锚点 | Task 1、3 |
| 序列字段、一边爬一边喊 | Task 3、4、8 |
| 配置/托盘/客户默认关 | Task 2、6、10 |
| 四类词库、crawl 不进窗口状态机 | Task 5、8 |
| 妈妈出境、单窗口、豹拉只台词 | Task 8、9 |
| 错误表、冷却、静默、拖拽中断 | Task 3、6 |
| 动画门禁、50 连播、穿透 | Task 9、10 |
| 版权说明 | Task 8、10 |

## 实施时不要做

- 飞书来电、拒接非老板、后台静默挂、妈妈第二窗口、画豹拉、描电影 3D、把 `ou_` 写进仓库、为牛来分叉主题。
- 把「半导体 / 绊倒体 / 股民」做成触发词。
- 用 `npm run build:customer --` 传参。

## 未验证

钉钉文本没有稳定本机官方 Stream；`startMessages` 为空；飞书消息仍可用；未假装连通。
