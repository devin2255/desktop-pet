# 兄弟判官桌宠「画饼雷达」实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在通用桌宠播放器中新增飞书"画饼雷达"监听能力（lark-cli 事件流 → 老板过滤 → 词库匹配 → 气泡+reaction+edge-tts 语音吐槽），并为"兄弟判官"宠物生成含窗口边缘交互动作的 petpack，最终交付自用便携 EXE。

**Architecture:** 主进程新增三个模块：`watch-rules.js`（纯函数过滤管线，可单测）、`watch-config.js`（双层配置加载合并）、`message-watcher.js`（lark-cli 事件流生命周期+触发）；`edge-voice.js` 用 edge-tts npm 包合成 MP3 到 userData/voice-cache，经新增 `voice-cache://` 协议播放。命中后调用既有 `sendState('reaction', ...)` 触发气泡/动作/语音，零新增 IPC 通道。

**Tech Stack:** Electron 43、Node ≥22、lark-cli v1.0.45.1（`~/.qwenworkcn/bin/lark-cli.cmd`）、edge-tts npm 包 v1.0.1、既有 petpack 工具链（Python + 图像处理脚本）。

## Global Constraints

- 遵循 `AGENTS.md`：新功能是通用播放器能力，不写死单只宠物；petpack 内容来自 `pet.json`。
- `pet.json` 的 `schemaVersion` 保持 1，`watch` 为可选字段，旧播放器忽略、旧包缺字段不报错。
- 飞书消息原文只在内存处理：不落盘、不打印、不外发；edge-tts 只发送吐槽文案。
- 老板名单、词库、语音缓存全部本地存储。
- 任何监听故障不得影响桌宠主功能（降级链：edge-tts → Web Speech → 仅气泡）。
- lark-cli 路径默认 `C:/Users/Thinkpad/.qwenworkcn/bin/lark-cli.cmd`（可在 boss-watch.json 覆盖）。
- 交付前必须：`npm run test:js` 全绿、`python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v` 通过、真实事件端到端验证。
- 语音缓存文件名必须为 `^[a-f0-9]{32}\.mp3$`（内容 hash），协议层白名单校验。
- 默认内置词库（fallback 用，petpack 未提供时）：画饼/吹牛两类，见 Task 2。

---

### Task 1: watch-rules.js — 过滤管线纯函数（TDD）

**Files:**
- Create: `src/watch-rules.js`
- Test: `scripts/test-watch-rules.js`
- Modify: `package.json`（`test:js` 链追加 `node scripts/test-watch-rules.js`）

**Interfaces:**
- Produces:
  - `createDedupeSet(maxSize = 5000)` → `{ has(id) → boolean, add(id) → void }`（内部 LRU，超限淘汰最旧）
  - `isBoss(senderId, bossIds)` → `boolean`（bossIds 为已解析 open_id 数组；空数组返回 false）
  - `matchKeyword(text, keywordMap)` → `category | null`（keywordMap 如 `{ '画饼': [...], '吹牛': [...] }`；`text.toLowerCase().includes(keyword.toLowerCase())` 命中即返回该类别，按对象键顺序取首个）
  - `inQuietHours(now, quietHours)` → `boolean`（quietHours 形如 `[['12:00','13:30']]`；跨午夜区间如 `['19:00','09:00']` 也支持；空数组返回 false；now 为 `Date`）
  - `pickLine(pool, rng = Math.random)` → `string`（pool 非空数组；rng 注入便于测试）
  - `DEFAULT_KEYWORDS` 常量：`{ '画饼': ['老板画的饼别吃，你啃不动！', '这饼画得真圆，可惜啃不动。'], '吹牛': ['你的老板吹了个牛逼！', '这牛吹得，我耳朵都疼了。'], }`

- [ ] **Step 1: 写失败测试** `scripts/test-watch-rules.js`

```js
'use strict';
const assert = require('assert');
const {
  createDedupeSet, isBoss, matchKeyword, inQuietHours, pickLine, DEFAULT_KEYWORDS
} = require('../src/watch-rules');

function testDedupe() {
  const s = createDedupeSet(2);
  assert.strictEqual(s.has('a'), false);
  s.add('a');
  assert.strictEqual(s.has('a'), true);
  s.add('b'); s.add('c'); // 超限淘汰 a
  assert.strictEqual(s.has('a'), false);
  assert.strictEqual(s.has('c'), true);
}

function testIsBoss() {
  assert.strictEqual(isBoss('ou_1', ['ou_1', 'ou_2']), true);
  assert.strictEqual(isBoss('ou_3', ['ou_1']), false);
  assert.strictEqual(isBoss('ou_3', []), false);
}

function testMatchKeyword() {
  const map = { '画饼': ['a'], '吹牛': ['b'] };
  assert.strictEqual(matchKeyword('年底给你画个大饼', map), '画饼');
  assert.strictEqual(matchKeyword('老板又开始吹牛了', map), '吹牛');
  assert.strictEqual(matchKeyword('今天天气不错', map), null);
  assert.strictEqual(matchKeyword('', map), null);
}

function testQuietHours() {
  assert.strictEqual(inQuietHours(new Date('2026-08-10T12:30:00+08:00'), [['12:00', '13:30']]), true);
  assert.strictEqual(inQuietHours(new Date('2026-08-10T14:00:00+08:00'), [['12:00', '13:30']]), false);
  assert.strictEqual(inQuietHours(new Date('2026-08-10T23:00:00+08:00'), [['19:00', '09:00']]), true);
  assert.strictEqual(inQuietHours(new Date('2026-08-10T08:00:00+08:00'), [['19:00', '09:00']]), true);
  assert.strictEqual(inQuietHours(new Date('2026-08-10T12:00:00+08:00'), []), false);
}

function testPickLine() {
  assert.strictEqual(pickLine(['x'], () => 0.5), 'x');
  assert.strictEqual(pickLine(['a', 'b'], () => 0.9), 'b');
}

function testDefaults() {
  assert.ok(Array.isArray(DEFAULT_KEYWORDS['画饼']) && DEFAULT_KEYWORDS['画饼'].length >= 1);
  assert.ok(Array.isArray(DEFAULT_KEYWORDS['吹牛']) && DEFAULT_KEYWORDS['吹牛'].length >= 1);
}

const tests = { testDedupe, testIsBoss, testMatchKeyword, testQuietHours, testPickLine, testDefaults };
let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`ok - ${name}`); } catch (e) { failed++; console.error(`FAIL - ${name}: ${e.message}`); }
}
if (failed) process.exit(1);
console.log('watch-rules: all tests passed');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node scripts/test-watch-rules.js`
Expected: `FAIL - ...`（Cannot find module '../src/watch-rules'）退出码 1

- [ ] **Step 3: 实现** `src/watch-rules.js`

```js
'use strict';

const DEFAULT_KEYWORDS = {
  '画饼': ['老板画的饼别吃，你啃不动！', '这饼画得真圆，可惜啃不动。'],
  '吹牛': ['你的老板吹了个牛逼！', '这牛吹得，我耳朵都疼了。']
};

function createDedupeSet(maxSize = 5000) {
  const seen = new Set();
  const queue = [];
  return {
    has(id) { return seen.has(id); },
    add(id) {
      if (seen.has(id)) return;
      seen.add(id);
      queue.push(id);
      while (queue.length > maxSize) seen.delete(queue.shift());
    }
  };
}

function isBoss(senderId, bossIds) {
  return Array.isArray(bossIds) && bossIds.length > 0
    && typeof senderId === 'string' && bossIds.includes(senderId);
}

function matchKeyword(text, keywordMap) {
  if (typeof text !== 'string' || !text) return null;
  const lower = text.toLowerCase();
  for (const [category, pool] of Object.entries(keywordMap || {})) {
    if (Array.isArray(pool) && lower.includes(category.toLowerCase())) return category;
  }
  return null;
}

function toMinutes(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return h * 60 + (m || 0);
}

function inQuietHours(now, quietHours) {
  if (!Array.isArray(quietHours) || quietHours.length === 0) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (const [start, end] of quietHours) {
    const s = toMinutes(start); const e = toMinutes(end);
    if (s === e) continue;
    if (s < e) { if (minutes >= s && minutes < e) return true; }
    else { if (minutes >= s || minutes < e) return true; } // 跨午夜
  }
  return false;
}

function pickLine(pool, rng = Math.random) {
  const arr = Array.isArray(pool) && pool.length ? pool : [''];
  return arr[Math.floor(rng() * arr.length)];
}

module.exports = { createDedupeSet, isBoss, matchKeyword, inQuietHours, pickLine, DEFAULT_KEYWORDS };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node scripts/test-watch-rules.js`
Expected: 全部 `ok - ...` + `watch-rules: all tests passed`

- [ ] **Step 5: 并入测试链 + 提交**

在 `package.json` 的 `test:js` 末尾追加 `&& node scripts/test-watch-rules.js`。

```bash
git add src/watch-rules.js scripts/test-watch-rules.js package.json
git commit -m "feat: add watch rules filtering pipeline"
```

---

### Task 2: watch-config.js — 双层配置加载合并

**Files:**
- Create: `src/watch-config.js`
- Test: `scripts/test-watch-config.js`

**Interfaces:**
- Consumes: `DEFAULT_KEYWORDS`（Task 1）
- Produces:
  - `DEFAULT_BOSS_CONFIG` 常量（enabled:false、cooldownSec:30、quietHours:[]、voice:{enabled:true, gender:'male', rate:'+0%', voice:'zh-CN-YunxiNeural'}）
  - `loadWatchConfig({ configPath, manifestWatch, larkCliPath })` → 规范化配置对象（见下），读取失败/字段非法回退默认值，绝不抛异常
  - `splitBosses(bosses)` → `{ ids: string[], names: string[] }`（以 `ou_` 开头的进 ids，其余进 names）
  - 返回配置结构：`{ enabled, larkCliPath, bosses, ids, names, cooldownSec, quietHours, voice, keywords, fallback, state }`
  - `keywords`：manifestWatch.keywords 合法则用，否则 `DEFAULT_KEYWORDS`；`fallback`：manifestWatch.fallback 字符串合法则用，否则 `'老板又开始整活儿了，装没看见。'`；`state`：manifestWatch.state 字符串合法则用，否则 `'reaction'`

- [ ] **Step 1: 写失败测试** `scripts/test-watch-config.js`

```js
'use strict';
const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { loadWatchConfig, splitBosses, DEFAULT_BOSS_CONFIG } = require('../src/watch-config');
const { DEFAULT_KEYWORDS } = require('../src/watch-rules');

function tmpJson(obj) {
  const p = path.join(os.tmpdir(), `boss-watch-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
}

function testDefaultsWhenMissing() {
  const cfg = loadWatchConfig({ configPath: path.join(os.tmpdir(), 'nope-xxx.json'), larkCliPath: 'lark' });
  assert.strictEqual(cfg.enabled, false);
  assert.strictEqual(cfg.cooldownSec, 30);
  assert.deepStrictEqual(cfg.quietHours, []);
  assert.strictEqual(cfg.state, 'reaction');
  assert.deepStrictEqual(cfg.keywords, DEFAULT_KEYWORDS);
  assert.strictEqual(cfg.voice.voice, 'zh-CN-YunxiNeural');
}

function testCorruptFileFallsBack() {
  const p = path.join(os.tmpdir(), 'boss-watch-bad.json');
  fs.writeFileSync(p, '{not json');
  const cfg = loadWatchConfig({ configPath: p, larkCliPath: 'lark' });
  assert.strictEqual(cfg.enabled, false); // 不抛异常
}

function testMergeManifest() {
  const p = tmpJson({ enabled: true, bosses: ['王总', 'ou_abc'] });
  const cfg = loadWatchConfig({
    configPath: p,
    larkCliPath: 'lark',
    manifestWatch: { keywords: { '画饼': ['专属文案'] }, fallback: '兜底', state: 'idle' }
  });
  assert.strictEqual(cfg.enabled, true);
  assert.deepStrictEqual(cfg.keywords, { '画饼': ['专属文案'] });
  assert.strictEqual(cfg.fallback, '兜底');
  assert.strictEqual(cfg.state, 'idle');
}

function testSplitBosses() {
  const { ids, names } = splitBosses(['王总', 'ou_123', 'ou_456', '李总']);
  assert.deepStrictEqual(ids, ['ou_123', 'ou_456']);
  assert.deepStrictEqual(names, ['王总', '李总']);
}

const tests = { testDefaultsWhenMissing, testCorruptFileFallsBack, testMergeManifest, testSplitBosses };
let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`ok - ${name}`); } catch (e) { failed++; console.error(`FAIL - ${name}: ${e.message}`); }
}
if (failed) process.exit(1);
console.log('watch-config: all tests passed');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node scripts/test-watch-config.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现** `src/watch-config.js`

```js
'use strict';
const fs = require('fs');
const { DEFAULT_KEYWORDS } = require('./watch-rules');

const DEFAULT_BOSS_CONFIG = {
  enabled: false,
  cooldownSec: 30,
  quietHours: [],
  voice: { enabled: true, gender: 'male', rate: '+0%', voice: 'zh-CN-YunxiNeural' }
};

function splitBosses(bosses) {
  const ids = [];
  const names = [];
  for (const item of Array.isArray(bosses) ? bosses : []) {
    if (typeof item !== 'string' || !item.trim()) continue;
    if (item.startsWith('ou_')) ids.push(item);
    else names.push(item);
  }
  return { ids, names };
}

function asStrings(v) { return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []; }
function asStringArray(v) { return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []; }

function normalizeQuietHours(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((pair) => Array.isArray(pair) && pair.length === 2
    && typeof pair[0] === 'string' && typeof pair[1] === 'string' && /^\d{1,2}:\d{2}$/.test(pair[0]) && /^\d{1,2}:\d{2}$/.test(pair[1]));
}

function loadWatchConfig({ configPath, manifestWatch, larkCliPath }) {
  let fileCfg = {};
  try {
    if (configPath && fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (raw && typeof raw === 'object') fileCfg = raw;
    }
  } catch (_) { fileCfg = {}; }

  const voiceBase = (fileCfg.voice && typeof fileCfg.voice === 'object') ? fileCfg.voice : {};
  const voice = {
    enabled: voiceBase.enabled === undefined ? DEFAULT_BOSS_CONFIG.voice.enabled : Boolean(voiceBase.enabled),
    gender: voiceBase.gender === 'female' ? 'female' : 'male',
    rate: typeof voiceBase.rate === 'string' ? voiceBase.rate : DEFAULT_BOSS_CONFIG.voice.rate,
    voice: typeof voiceBase.voice === 'string' && voiceBase.voice ? voiceBase.voice : DEFAULT_BOSS_CONFIG.voice.voice
  };

  const manifestWatch = manifestWatch && typeof manifestWatch === 'object' ? manifestWatch : {};
  const manifestKeywords = manifestWatch.keywords && typeof manifestWatch.keywords === 'object'
    ? Object.fromEntries(Object.entries(manifestWatch.keywords)
        .filter(([k, v]) => typeof k === 'string' && k && Array.isArray(v) && v.some((x) => typeof x === 'string' && x))
        .map(([k, v]) => [k, asStrings(v)]))
    : {};
  const keywords = Object.keys(manifestKeywords).length ? manifestKeywords : DEFAULT_KEYWORDS;
  const fallback = typeof manifestWatch.fallback === 'string' && manifestWatch.fallback.trim()
    ? manifestWatch.fallback.trim() : '老板又开始整活儿了，装没看见。';
  const state = typeof manifestWatch.state === 'string' && manifestWatch.state.trim()
    ? manifestWatch.state.trim() : 'reaction';

  const { ids, names } = splitBosses(fileCfg.bosses);
  return {
    enabled: Boolean(fileCfg.enabled),
    larkCliPath: typeof larkCliPath === 'string' && larkCliPath ? larkCliPath : '',
    bosses: asStringArray(fileCfg.bosses),
    ids,
    names,
    cooldownSec: Number.isFinite(Number(fileCfg.cooldownSec)) ? Math.max(0, Number(fileCfg.cooldownSec)) : DEFAULT_BOSS_CONFIG.cooldownSec,
    quietHours: normalizeQuietHours(fileCfg.quietHours),
    voice,
    keywords,
    fallback,
    state
  };
}

module.exports = { loadWatchConfig, splitBosses, DEFAULT_BOSS_CONFIG };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node scripts/test-watch-config.js`
Expected: 全部 ok + `watch-config: all tests passed`

- [ ] **Step 5: 并入 test:js + 提交**

```bash
git add src/watch-config.js scripts/test-watch-config.js package.json
git commit -m "feat: add watch config loader with petpack merge"
```

---

### Task 3: edge-voice.js — edge-tts 语音合成

**Files:**
- Create: `src/edge-voice.js`
- Test: `scripts/test-edge-voice.js`
- Modify: `package.json`（`dependencies` 增加 `edge-tts: ^1.0.1`）

**Interfaces:**
- Consumes: 无（独立）
- Produces:
  - `createVoiceSynthesizer({ cacheDir, voice = 'zh-CN-YunxiNeural', rate = '+0%' })` → `{ synthesize(text) → Promise<{ url: string } | null>, dispose() }`
  - synthesize：`sha256(text + voice + rate)` 前 32 位作文件名；缓存文件存在直接返回 `{ url: 'voice-cache://<hash>.mp3' }`；否则 `require('edge-tts').tts(text, { voice, rate })` 得 Buffer，写 `cacheDir/<hash>.mp3`；任何异常返回 `null`（绝不抛）；合成并发用模块内互斥队列（同进程串行，防风暴）
  - 测试不联网：注入 `loader` 选项 `createVoiceSynthesizer({ ..., loader: () => fakeTts })`，fakeTts 返回 Buffer

- [ ] **Step 1: 安装依赖**

Run: `npm install --save edge-tts@^1.0.1`
Expected: `added 1 package`，`package.json` dependencies 出现 `"edge-tts": "^1.0.1"`

- [ ] **Step 2: 写失败测试** `scripts/test-edge-voice.js`

```js
'use strict';
const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { createVoiceSynthesizer } = require('../src/edge-voice');

const fakeTts = async (text, _opts) => Buffer.from(`fake-mp3:${text}`);

function testCacheHit() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-test-'));
  const voice = createVoiceSynthesizer({ cacheDir: dir, loader: () => fakeTts });
  let count = 0;
  const wrapped = async (t, o) => { count++; return fakeTts(t, o); };
  const v2 = createVoiceSynthesizer({ cacheDir: dir, loader: () => wrapped });
  return v2.synthesize('你好').then((a) => v2.synthesize('你好').then((b) => {
    assert.strictEqual(a.url, b.url);
    assert.strictEqual(count, 1, '第二次应命中缓存');
    assert.ok(a.url.startsWith('voice-cache://'));
    assert.ok(fs.existsSync(path.join(dir, path.basename(a.url))));
  }));
}

function testNetworkFailureReturnsNull() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-test2-'));
  const voice = createVoiceSynthesizer({ cacheDir: dir, loader: () => { throw new Error('net down'); } });
  return voice.synthesize('你好').then((r) => {
    assert.strictEqual(r, null);
  });
}

Promise.all([testCacheHit(), testNetworkFailureReturnsNull()]).then(
  () => { console.log('edge-voice: all tests passed'); },
  (e) => { console.error('FAIL:', e.message); process.exit(1); }
);
```

- [ ] **Step 3: 运行测试确认失败**

Run: `node scripts/test-edge-voice.js`
Expected: FAIL（模块不存在）

- [ ] **Step 4: 实现** `src/edge-voice.js`

```js
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function createVoiceSynthesizer({ cacheDir, voice = 'zh-CN-YunxiNeural', rate = '+0%', loader }) {
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  let chain = Promise.resolve();
  const loadTts = loader || (() => require('edge-tts').tts);

  function synthesize(text) {
    const key = crypto.createHash('sha256').update(String(text)).update(voice).update(rate).digest('hex').slice(0, 32);
    const filePath = path.join(cacheDir, `${key}.mp3`);
    if (fs.existsSync(filePath)) return Promise.resolve({ url: `voice-cache://${key}.mp3` });
    const task = chain.then(async () => {
      try {
        const tts = await loadTts();
        const buffer = await tts(text, { voice, rate });
        fs.writeFileSync(filePath, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
        return { url: `voice-cache://${key}.mp3` };
      } catch (_) {
        return null;
      }
    });
    chain = task.catch(() => {});
    return task;
  }

  return { synthesize, dispose() { chain = Promise.resolve(); } };
}

module.exports = { createVoiceSynthesizer };
```

- [ ] **Step 5: 运行测试确认通过**

Run: `node scripts/test-edge-voice.js`
Expected: `edge-voice: all tests passed`

- [ ] **Step 6: 并入 test:js + 提交**

```bash
git add src/edge-voice.js scripts/test-edge-voice.js package.json package-lock.json
git commit -m "feat: add edge-tts voice synthesizer with cache"
```

---

### Task 4: message-watcher.js — 事件流生命周期 + 触发管线

**Files:**
- Create: `src/message-watcher.js`
- Test: `scripts/test-message-watcher.js`
- Modify: `package.json`（test:js 追加）

**Interfaces:**
- Consumes: `createDedupeSet, isBoss, matchKeyword, inQuietHours, pickLine`（Task 1）、`loadWatchConfig` 的配置结构（Task 2）、`createVoiceSynthesizer`（Task 3）
- Produces:
  - `parseEventLine(line)` → `{ event_id, sender_id, chat_id, chat_type, content, timestamp } | null`（trim 后 JSON.parse；缺 event_id/sender_id/content 或非字符串返回 null；content 非字符串跳过）
  - `createMessageWatcher({ rules, voice, sendState, spawnExec, onStatus, larkCliPath })` → `{ start(), stop(), isRunning() }`
    - start：`spawnExec(larkCliPath, ['event', 'consume', 'im.message.receive_v1'], { shell: true, windowsHide: true })`（spawnExec 默认 `require('child_process').spawn`，可注入 mock）；stdout 按行处理 `processLine`；stderr 累计最后 500 字符给 onStatus；exit 后指数退避重启（间隔 `min(2000 * 2^n, 60000)`，每小时最多 10 次，超限停止并 onStatus 通知）
    - `processLine(line)`（导出供测试）：parseEventLine → 空返回；dedupe.has → 跳过；!isBoss(sender_id, rules.ids) → 跳过（注意：姓名待解析，见 Task 5 的 resolve 流程）；quietHours → 跳过；冷却（sender_id → lastTriggerAt，`cooldownSec` 内跳过）→ 通过则 matchKeyword(content, rules.keywords) 得 category → `pickLine(pool, rng)`（category 命中用 keywords[category]，否则 rules.fallback）→ `voice.synthesize(line)` 得 `{url}|null` → `sendState(rules.state, text, text, { speechAudio: url || '' })` → 记录冷却时间
  - `rng` 选项可注入（测试文案选择）

- [ ] **Step 1: 写失败测试** `scripts/test-message-watcher.js`

```js
'use strict';
const assert = require('assert');
const { parseEventLine, createMessageWatcher } = require('../src/message-watcher');

function testParseValid() {
  const ev = parseEventLine(JSON.stringify({
    event_id: 'ev1', sender_id: 'ou_1', chat_id: 'oc_1', chat_type: 'p2p',
    content: '年底画饼', timestamp: '123'
  }));
  assert.strictEqual(ev.event_id, 'ev1');
  assert.strictEqual(ev.sender_id, 'ou_1');
  assert.strictEqual(ev.content, '年底画饼');
}

function testParseInvalid() {
  assert.strictEqual(parseEventLine('not json'), null);
  assert.strictEqual(parseEventLine(''), null);
  assert.strictEqual(parseEventLine(JSON.stringify({ event_id: 'x' })), null); // 缺 content
  assert.strictEqual(parseEventLine(JSON.stringify({ event_id: 'x', content: { a: 1 }, sender_id: 'ou_1' })), null); // 非文本
}

function testPipelineTriggers() {
  const sent = [];
  const rules = {
    ids: ['ou_1'], cooldownSec: 30, quietHours: [],
    keywords: { '画饼': ['文案A'] }, fallback: '兜底', state: 'reaction'
  };
  const watcher = createMessageWatcher({
    rules,
    voice: { synthesize: async () => ({ url: 'voice-cache://abc.mp3' }) },
    sendState: (state, message, speech, opts) => sent.push({ state, message, speech, opts }),
    rng: () => 0
  });
  return watcher.processLine(JSON.stringify({ event_id: 'e1', sender_id: 'ou_1', content: '给你画个饼' }))
    .then(() => {
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].state, 'reaction');
      assert.strictEqual(sent[0].message, '文案A');
      assert.strictEqual(sent[0].opts.speechAudio, 'voice-cache://abc.mp3');
      return watcher.processLine(JSON.stringify({ event_id: 'e2', sender_id: 'ou_1', content: '再画饼' }));
    })
    .then(() => assert.strictEqual(sent.length, 1, '冷却期内不重复触发'));
}

function testNonBossSkipped() {
  const sent = [];
  const watcher = createMessageWatcher({
    rules: { ids: ['ou_1'], cooldownSec: 0, quietHours: [], keywords: { '画饼': ['a'] }, fallback: 'b', state: 'reaction' },
    voice: { synthesize: async () => null },
    sendState: (s, m, sp, o) => sent.push({ s, m, sp, o })
  });
  return watcher.processLine(JSON.stringify({ event_id: 'e3', sender_id: 'ou_999', content: '画饼' }))
    .then(() => assert.strictEqual(sent.length, 0));
}

function testFallbackAndVoiceNull() {
  const sent = [];
  const watcher = createMessageWatcher({
    rules: { ids: ['ou_1'], cooldownSec: 0, quietHours: [], keywords: {}, fallback: '兜底话', state: 'reaction' },
    voice: { synthesize: async () => null },
    sendState: (s, m, sp, o) => sent.push({ s, m, sp, o })
  });
  return watcher.processLine(JSON.stringify({ event_id: 'e4', sender_id: 'ou_1', content: '随便聊聊' }))
    .then(() => {
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].m, '兜底话');
      assert.strictEqual(sent[0].o.speechAudio, '');
    });
}

function testDedupe() {
  const sent = [];
  const watcher = createMessageWatcher({
    rules: { ids: ['ou_1'], cooldownSec: 0, quietHours: [], keywords: { '画饼': ['a'] }, fallback: 'b', state: 'reaction' },
    voice: { synthesize: async () => null },
    sendState: (s, m, sp, o) => sent.push(m)
  });
  const line = JSON.stringify({ event_id: 'e-same', sender_id: 'ou_1', content: '画饼' });
  return watcher.processLine(line).then(() => watcher.processLine(line))
    .then(() => assert.strictEqual(sent.length, 1, '同 event_id 去重'));
}

const tasks = [testParseValid, testParseInvalid, testPipelineTriggers, testNonBossSkipped, testFallbackAndVoiceNull, testDedupe];
Promise.all(tasks.map((t) => t())).then(
  () => { console.log('message-watcher: all tests passed'); },
  (e) => { console.error('FAIL:', e.message); process.exit(1); }
);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node scripts/test-message-watcher.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现** `src/message-watcher.js`

```js
'use strict';
const { createDedupeSet, isBoss, matchKeyword, inQuietHours, pickLine } = require('./watch-rules');

function parseEventLine(line) {
  if (typeof line !== 'string' || !line.trim()) return null;
  let raw;
  try { raw = JSON.parse(line); } catch (_) { return null; }
  if (!raw || typeof raw !== 'object') return null;
  const { event_id, sender_id, content } = raw;
  if (typeof event_id !== 'string' || !event_id) return null;
  if (typeof sender_id !== 'string' || !sender_id) return null;
  if (typeof content !== 'string' || !content) return null;
  return {
    event_id, sender_id,
    chat_id: typeof raw.chat_id === 'string' ? raw.chat_id : '',
    chat_type: typeof raw.chat_type === 'string' ? raw.chat_type : '',
    content,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : ''
  };
}

function createMessageWatcher({ rules, voice, sendState, spawnExec, onStatus, larkCliPath, rng }) {
  const dedupe = createDedupeSet();
  const cooldown = new Map();
  let child = null;
  let running = false;
  let stopRequested = false;
  let restartCount = 0;
  let restartTimer = null;

  async function processLine(line) {
    const ev = parseEventLine(line);
    if (!ev) return;
    if (dedupe.has(ev.event_id)) return;
    dedupe.add(ev.event_id);
    if (!isBoss(ev.sender_id, rules.ids)) return;
    if (inQuietHours(new Date(), rules.quietHours)) return;
    const last = cooldown.get(ev.sender_id) || 0;
    if (Date.now() - last < rules.cooldownSec * 1000) return;
    const category = matchKeyword(ev.content, rules.keywords);
    const pool = category ? rules.keywords[category] : [rules.fallback];
    const text = pickLine(pool, rng);
    let audioUrl = '';
    try {
      const audio = await voice.synthesize(text);
      if (audio) audioUrl = audio.url;
    } catch (_) { audioUrl = ''; }
    sendState(rules.state, text, text, { speechAudio: audioUrl });
    cooldown.set(ev.sender_id, Date.now());
  }

  function scheduleRestart() {
    if (!running || stopRequested) return;
    if (restartCount >= 10) {
      running = false;
      onStatus && onStatus({ level: 'error', message: '画饼雷达事件流多次断开，已暂停。' });
      return;
    }
    const delay = Math.min(2000 * Math.pow(2, restartCount), 60000);
    restartCount += 1;
    restartTimer = setTimeout(start, delay);
  }

  function start() {
    if (running) return;
    if (!larkCliPath) { onStatus && onStatus({ level: 'warn', message: '未配置 lark-cli 路径，画饼雷达未启动。' }); return; }
    running = true;
    stopRequested = false;
    const spawn = spawnExec || require('child_process').spawn;
    let stderrBuf = '';
    try {
      child = spawn(larkCliPath, ['event', 'consume', 'im.message.receive_v1'], { shell: true, windowsHide: true });
    } catch (e) {
      running = false;
      onStatus && onStatus({ level: 'error', message: '启动画饼雷达失败：' + (e.message || 'unknown') });
      return;
    }
    child.stdout && child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) processLine(line).catch(() => {});
      }
    });
    child.stderr && child.stderr.on('data', (chunk) => {
      stderrBuf = (stderrBuf + chunk.toString()).slice(-500);
      onStatus && onStatus({ level: 'info', message: '画饼雷达: ' + stderrBuf.split('\n').pop().trim() });
    });
    child.on('error', (err) => {
      running = false;
      onStatus && onStatus({ level: 'error', message: '画饼雷达进程错误：' + (err.message || 'unknown') });
      scheduleRestart();
    });
    child.on('exit', () => {
      child = null;
      if (running) scheduleRestart();
    });
    onStatus && onStatus({ level: 'info', message: '画饼雷达已连接。' });
  }

  function stop() {
    stopRequested = true;
    running = false;
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    if (child) { try { child.kill(); } catch (_) {} child = null; }
  }

  return { start, stop, processLine, isRunning: () => running };
}

module.exports = { parseEventLine, createMessageWatcher };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node scripts/test-message-watcher.js`
Expected: `message-watcher: all tests passed`

- [ ] **Step 5: 并入 test:js + 提交**

```bash
git add src/message-watcher.js scripts/test-message-watcher.js package.json
git commit -m "feat: add lark message watcher lifecycle and trigger pipeline"
```

---

### Task 5: main-v3.js 集成 — 协议、sendState 修正、启动/停止

**Files:**
- Modify: `src/main-v3.js`

**Changes:**

- [ ] **Step 1: 注册 voice-cache 协议**

`protocol.registerSchemesAsPrivileged` 数组（33-44 行）追加：

```js
  {
    scheme: 'voice-cache',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
  }
```

- [ ] **Step 2: 修正 sendState 的 speechAudio 改写逻辑（281-287 行）**

把：

```js
  let speechAudio = typeof options?.speechAudio === 'string' ? options.speechAudio : '';
  if (speechAudio && !speechAudio.startsWith('pet-asset:') && activeManifest) {
    speechAudio = petAssetUrl(activeManifest.id, speechAudio);
  }
```

改为：

```js
  let speechAudio = typeof options?.speechAudio === 'string' ? options.speechAudio : '';
  // 带协议前缀（pet-asset:/voice-cache:/data:/file: 等）视为完整 URL，否则按资源包相对路径改写
  if (speechAudio && !/^[a-z][a-z0-9+.-]*:/i.test(speechAudio) && activeManifest) {
    speechAudio = petAssetUrl(activeManifest.id, speechAudio);
  }
```

- [ ] **Step 3: 文件顶部 require 新模块（19 行后）**

```js
const { createMessageWatcher, parseEventLine } = require('./message-watcher');
const { loadWatchConfig } = require('./watch-config');
const { createVoiceSynthesizer } = require('./edge-voice');
```

并声明模块级变量（66 行 `let sequence;` 后）：

```js
let messageWatcher;
```

- [ ] **Step 4: 在 `protocol.handle('pet-asset', ...)` 之后（752 行后）注册 voice-cache 处理器**

```js
    const voiceCacheRoot = path.join(app.getPath('userData'), 'voice-cache');
    fs.mkdirSync(voiceCacheRoot, { recursive: true });
    protocol.handle('voice-cache', async (request) => {
      const name = decodeURIComponent(new URL(request.url).hostname + new URL(request.url).pathname.replace(/^\//, ''));
      if (!/^[a-f0-9]{32}\.mp3$/.test(name)) throw new Error('拒绝访问非语音缓存文件');
      const filePath = resolveInside(voiceCacheRoot, name);
      const data = await fs.promises.readFile(filePath);
      return new Response(data, {
        headers: { 'content-type': 'audio/mpeg', 'access-control-allow-origin': '*' }
      });
    });
```

注意：`voice-cache://<hash>.mp3` 在标准 scheme 下 hostname 与 pathname 的拆分——实现时以实际 `new URL('voice-cache://abc.mp3')` 输出为准（hostname 可能为 `abc.mp3`、pathname 为空或 `/`），用上面拼接逻辑兜底；若解析异常，回退为仅取 hostname。提交前用 `node -e` 实际验证一次并固定写法。

- [ ] **Step 5: 启动集成（whenReady 内 `createTray()` 之后，770 行后）**

```js
    const watchConfig = loadWatchConfig({
      configPath: path.join(app.getPath('userData'), 'boss-watch.json'),
      manifestWatch: activeManifest?.watch,
      larkCliPath: undefined // 由 boss-watch.json 提供；缺失时用默认路径兜底
    });
    if (watchConfig.enabled) {
      const voice = createVoiceSynthesizer({
        cacheDir: path.join(app.getPath('userData'), 'voice-cache'),
        voice: watchConfig.voice.voice,
        rate: watchConfig.voice.rate
      });
      messageWatcher = createMessageWatcher({
        rules: watchConfig,
        voice,
        sendState: (state, message, speech, opts) => {
          sendState(state, message, speech, state, opts || {});
        },
        larkCliPath: watchConfig.larkCliPath || 'C:/Users/Thinkpad/.qwenworkcn/bin/lark-cli.cmd'
      });
      messageWatcher.start();
    }
```

同时把 `activeManifest?.watch` 传给 publicManifest 不需要——renderer 不读 watch；仅主进程消费。若用户希望开发版也能开，确保 `boss-watch.json` 存在即 enabled——本机开发调试时手动在 userData 放该文件即可（userData 路径为 `%APPDATA%/desktop-pet` 或按 app name，实际以运行日志为准）。

- [ ] **Step 6: 退出清理（before-quit，780 行）**

```js
  messageWatcher?.stop();
```

- [ ] **Step 7: 语法检查 + 回归**

Run: `node --check src/main-v3.js && npm run test:js`
Expected: 全绿（含新增 test-watch-rules / test-watch-config / test-message-watcher）

- [ ] **Step 8: 提交**

```bash
git add src/main-v3.js
git commit -m "feat: integrate boss watch radar into player main process"
```

---

### Task 6: petpack 工具链兼容 watch 字段

**Files:**
- Modify: `src/petpack-validator.js`
- Modify: `skills/desktop-pet-maker/scripts/create_pet_manifest.py`
- Test: `scripts/test-petpack-security.js`（既有，扩展用例）

**Changes:**

- [ ] **Step 1: petpack-validator 允许并校验 watch**

在 `validateManifest`（先 Grep 定位 `animations` 校验函数）中，于 schema 校验处追加：`watch` 为可选 object；若存在，校验 `watch.keywords` 为 object（值必须是非空字符串数组）、`watch.fallback` 为 string（可缺省）、`watch.state` 为 string（可缺省）。实现方式：在 manifest 顶层字段白名单中加入 `watch`（只校验类型，不参与资源引用检查——`referencedFiles` 不含 watch 内容）。若现有实现是"未知字段报错"（Grep 确认 `validateManifest` 是否枚举顶层字段），则显式放行 watch；否则仅加类型校验。

- [ ] **Step 2: create_pet_manifest.py 透传 watch**

`create_pet_manifest.py` 增加可选 `--watch <json-file>` 参数：读入 JSON 对象，写入 manifest 的 `watch` 字段；缺省不写。参照现有 `--personality` 等可选参数的实现风格（Grep 定位）。

- [ ] **Step 3: 扩展安全测试**

在 `scripts/test-petpack-security.js` 添加一个用例：构造含合法 `watch` 字段的 manifest → `validateManifest` 通过；构造 `watch: { keywords: { 画饼: 'not-array' } }` → 校验失败。运行确认通过。

- [ ] **Step 4: 回归 + 提交**

Run: `npm run test:js`
Expected: 全绿

```bash
git add src/petpack-validator.js skills/desktop-pet-maker/scripts/create_pet_manifest.py scripts/test-petpack-security.js
git commit -m "feat: allow watch field in petpack manifests"
```

---

### Task 7: 资产线 — 兄弟判官动画条生成

**Files:**
- Create: `pets/library/brother-judge/`（定妆、绿幕条、透明条、联系表、pet.json、预览图）
- 产出：`pets/packages/brother-judge.petpack`

**Interfaces:**
- Consumes: `skills/desktop-pet-maker/SKILL.md` 全流程、`references/image-prompts.md`、`references/petpack-schema.md`
- Produces: 标准 petpack，含 `watch` 字段（词库判官风文案）、`speechGender: 'male'`

**Steps（按 desktop-pet-maker 流程执行，此处列关键门禁）：**

- [ ] **Step 1: 定妆总结**

基于两张参考图：年轻男性、短发、银色细框圆眼镜、脸型以图 2 为准；黑色判官官帽（两侧长弯帽翅、白色珠饰边缘，图 1）；服装为白背心 + 深色大裤衩 + 人字拖（接地气判官）；柔和 2D 游戏精灵风。写入 `pets/library/brother-judge/DESIGN.md`（含定妆描述与角色设定）。

- [ ] **Step 2: 生成绿幕动画条**

按 SKILL 第 4 步，用图像生成工具 + 参考图生成绿幕条：`idle`(4) / `walk`(6，朝右) / `sit`(4) / `sleep`(4) / `reaction`(4，判官笔挥动/摇头等) + 窗口边缘交互动作（对齐现有 petpack 的动作集）：`drag`(6) / `climb`(6) / `perch`(4) / `hang`(4) / `fall`(4) / `impact`(4) / `recover`(6)。所有帧保持同一角色、同一比例、完整尾/脚基线。

- [ ] **Step 3: 去背景 + 动画条处理**

按 SKILL 第 6-8 步：chroma 去背景（`--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`）→ `process_animation_strips.py`（必须通过单元格安全门禁：安全边距、连通块、断尾检查）→ 生成联系表人工检查（身份漂移、绿边、重复帧、比例/重心漂移）。

- [ ] **Step 4: 生成 pet.json（含 watch 词库）**

用 `create_pet_manifest.py`（Task 6 已支持 `--watch`）生成，watch 词库（判官风）：

```json
{
  "keywords": {
    "画饼": ["老板画的饼别吃，你啃不动！", "这饼画得再圆，也就是个饼。", "本官判你：画饼无效，驳回！"],
    "吹牛": ["你的老板吹了个牛逼！", "这牛吹得，本官的判官笔都抖了。"]
  },
  "fallback": "老板又在整活儿了，本官先记他一笔。",
  "state": "reaction"
}
```

- [ ] **Step 5: 校验与打包**

Run:
```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/brother-judge
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/brother-judge pets/packages/brother-judge.petpack
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/brother-judge.petpack
```
Expected: 全部通过。

- [ ] **Step 6: 提交**

```bash
git add pets/library/brother-judge pets/packages/brother-judge.petpack
git commit -m "feat: add brother judge petpack with watch lines"
```

---

### Task 8: 端到端验证

**Files:**
- Create: `scripts/test-boss-watch-e2e.js`

**Interfaces:**
- Consumes: Task 4 的 `createMessageWatcher`、本机 lark-cli、真实飞书消息

**Steps:**

- [ ] **Step 1: 写端到端测试脚本**（发消息→断言触发；需要真实环境，人工跑）

`scripts/test-boss-watch-e2e.js` 核心流程：
1. 用 lark-cli 以用户身份（`--as user`）向自己的 p2p 会话发一条含"画饼"的测试消息；
2. 启动 message-watcher（rules.ids 含用户自己的 open_id `ou_221a684c00848f0cd7f3e29d1061d908`）；
3. 断言收到触发（sendState 回调被调用、文案来自画饼池、speechAudio 非空）；
4. 发送无关键词消息，断言不触发。

- [ ] **Step 2: 本机跑通真实链路**

Run: `node scripts/test-boss-watch-e2e.js`
Expected: 触发成功。若 lark-cli 事件总线需要 bot 身份/scope（`im:message.p2p_msg:readonly`），按 lark-shared skill 指引处理（可能需要应用后台开启事件订阅；记录遇到的配置项，写进交付说明）。

- [ ] **Step 3: 开发版人工验证**

启动 `npm start`，userData 放 `boss-watch.json`（enabled:true，bosses 含用户自己 open_id），让同事/小号发一条含"吹牛"的消息，确认：气泡文案、reaction 动作、语音三要素齐全；截图存档到 `docs/superpowers/verification/`。

- [ ] **Step 4: 完整回归**

Run: `npm test`
Expected: 全绿（js + python + petpack 校验）。`python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v` 必须通过（动画条门禁）。

- [ ] **Step 5: 提交**

```bash
git add scripts/test-boss-watch-e2e.js docs/superpowers/verification
git commit -m "test: boss watch radar end-to-end verification"
```

---

### Task 9: 构建交付自用便携 EXE

**Files:**
- Modify: `package.json`（版本号按 CHANGELOG 习惯升版，如 0.5.0）
- Create: `delivery/brother-judge/`（build-customer.js 输出目录）、`build-report.json`

**Steps:**

- [ ] **Step 1: 内置自用 boss-watch 默认配置**

构建前确认 userData 初始化逻辑会在首次运行时写入默认 `boss-watch.json`（Task 5 实现若未写默认文件，则在 build-customer 的注入内容或启动逻辑中补：enabled:true、larkCliPath 默认路径、bosses 预填用户 open_id 占位）。客户版交付时该配置为 enabled:false。

- [ ] **Step 2: 构建**

Run:
```powershell
npm run build:customer -- --pet pets/packages/brother-judge.petpack --name "兄弟判官桌面宠物" --delivery-id brother-judge
```
Expected: 生成便携 EXE + `build-report.json`；检查 ASAR 含播放器、依赖（含 edge-tts）、内置 petpack。

- [ ] **Step 3: 实际启动成品验证**

启动 EXE，逐项核对：宠物出现、动画分支（idle/walk/sit/sleep/reaction/drag/climb/perch/hang/fall/impact/recover）、透明背景与鼠标穿透、拖动、漫游、左右朝向、右键菜单、托盘、退出、独立用户数据目录、画饼雷达事件触发（真实消息）。截图存档。

- [ ] **Step 4: 交付清单**

交付：`dist/` 下便携 EXE、`build-report.json`、验证清单（已验证项/未验证项，含数字签名未做、飞书事件订阅配置项说明）。更新 CHANGELOG.md。

- [ ] **Step 5: 提交**

```bash
git add package.json CHANGELOG.md delivery build-report.json
git commit -m "release: brother judge desktop pet with boss watch radar"
```

---

## Self-Review 记录

- Spec 覆盖：§3 架构 → Task 1/2/4/5；§4 配置 → Task 2/6；§5 语音 → Task 3/5；§6 隐私 → Global Constraints + Task 5（协议白名单）；§7 容错 → Task 4（退避重连/去重/冷却/启动检测）；§8 测试 → Task 8；§9 交付 → Task 9；§10 范围外（卡片消息、热重载、多应用、模板变量）→ 未纳入，符合 YAGNI。
- 类型一致性：`createDedupeSet / isBoss / matchKeyword / inQuietHours / pickLine / DEFAULT_KEYWORDS`、`loadWatchConfig / splitBosses / DEFAULT_BOSS_CONFIG`、`createVoiceSynthesizer`、`parseEventLine / createMessageWatcher` 各任务签名一致。
- 已知风险：Task 5 Step 4 的 `voice-cache://` URL 解析（standard scheme 下 hostname/pathname 拆分）需实现时用 `node -e` 实测固定；Task 8 依赖 lark-cli 事件总线可用性与 scope（`im:message.p2p_msg:readonly`）——若应用侧事件订阅未开，按 lark-shared 指引补配，并记入交付说明。
