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

