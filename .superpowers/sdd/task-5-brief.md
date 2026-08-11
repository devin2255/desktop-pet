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

