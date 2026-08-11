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

