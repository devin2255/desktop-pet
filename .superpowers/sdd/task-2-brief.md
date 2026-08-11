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

