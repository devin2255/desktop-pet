# Task 5 报告：main-v3.js 集成 — 协议、sendState 修正、启动/停止

## 已实施的变更（按 brief 顺序）

1. **Step 1 — 注册 voice-cache 协议**：在 `protocol.registerSchemesAsPrivileged` 数组中追加 `voice-cache` 项，权限与 `pet-asset` 一致（`standard/secure/supportFetchAPI/corsEnabled/stream`）。
2. **Step 2 — 修正 sendState speechAudio 改写**：将 `!speechAudio.startsWith('pet-asset:')` 替换为 `!/^[a-z][a-z0-9+.-]*:/i.test(speechAudio)`，使任何带协议前缀的字符串（pet-asset/voice-cache/data/file）都视为完整 URL，不再被当作相对路径改写。
3. **Step 3 — 引入新模块 + 声明模块级变量**：在 `createSequenceController` require 之后追加 `message-watcher`/`watch-config`/`edge-voice` 三个 require；在 `let sequence;` 之后追加 `let messageWatcher;`。
4. **Step 4 — 注册 voice-cache 处理器**：紧跟 `protocol.handle('pet-asset', ...)` 之后注册 `voice-cache` 处理器。预先创建 `userData/voice-cache` 目录，使用 `hostname + 去掉前导斜杠的 pathname` 拼接提取文件名，再以正则 `^[a-f0-9]{32}\.mp3$` 白名单校验，通过后用 `resolveInside` 防穿越并读取文件，返回 `audio/mpeg`。
5. **Step 5 — 启动集成**：在 `createTray()` 之后调用 `loadWatchConfig`（configPath = `userData/boss-watch.json`，manifestWatch = `activeManifest?.watch`）。当 `watchConfig.enabled` 为真时创建 voice synthesizer（cacheDir = `userData/voice-cache`，voice/rate 取自 `watchConfig.voice`），构造 messageWatcher（sendState 包装为 `(state, message, speech, opts) => sendState(state, message, speech, state, opts || {})`），并 `start()`。
6. **Step 6 — 退出清理**：在 `before-quit` 中追加 `messageWatcher?.stop();`。
7. **Step 7 — 语法 + 回归**：`node --check src/main-v3.js` 通过；`npm run test:js` 全绿（含 watch-rules / watch-config / edge-voice / message-watcher）。
8. **Step 8 — 提交**：commit `999b690`。

## voice-cache URL 解析验证

实测 Node `new URL(...)` 结果：

| 输入 | hostname | pathname |
|---|---|---|
| `voice-cache://abc123.mp3` | `abc123.mp3` | `` |
| `voice-cache://abc123.mp3/` | `abc123.mp3` | `/` |

采用 brief 的 `hostname + pathname.replace(/^\//, '')` 拼接策略：对 `voice-cache://abc123.mp3` 得 `abc123.mp3 + '' = abc123.mp3`；对带尾斜杠者得 `abc123.mp3 + '' = abc123.mp3`；若极端情况 hostname 为空（如 `voice-cache:///abc.mp3`），pathname 为 `/abc.mp3`，拼接得 `abc.mp3`。所有路径提取后再以 `^[a-f0-9]{32}\.mp3$` 强校验，不匹配一律拒绝。

## sendState 正则验证

正则：`/^[a-z][a-z0-9+.-]*:/i`

| 输入 | 判定 | 行为 |
|---|---|---|
| `pet-asset://x/y` | FULL | 不改写 |
| `voice-cache://abc.mp3` | FULL | 不改写 |
| `data:audio/mpeg;base64,AAA` | FULL | 不改写 |
| `file:///C:/x` | FULL | 不改写 |
| `animations/foo.png` | RELATIVE | 改写为 pet-asset URL |
| `foo.mp3` | RELATIVE | 改写为 pet-asset URL |

所有现有 `sendState` 调用点（`runBehavior`/`runDirectMenuAction`/`publicManifest` 等）传入的 speechAudio 要么是相对路径（会被改写为 pet-asset URL，与旧行为一致），要么已经在 `publicManifest` 中改写为 pet-asset URL（FULL，不再二次改写）——行为保持兼容。

## 验证结果

- `node --check src/main-v3.js`：**SYNTAX OK**
- `npm run test:js`：**全绿**，输出 pristine（renderer interaction / petpack security / sequences schema / window interactions / window discovery / interaction controller / topmost guard / runtime CDP / laopo petpack / startup greeting / sequence controller / watch-rules / watch-config / edge-voice / message-watcher 全部通过）

## 变更文件

- `D:/Vibe_Coding/desktop-pet/src/main-v3.js`（+45 / -1）

## 自审发现

- **启动/停止配对**：`whenReady` 内根据 `watchConfig.enabled` 创建并 `start()`；`before-quit` 通过可选链 `messageWatcher?.stop()` 清理，未启用时为 undefined 也不会报错。✓
- **sendState 正则兼容性**：所有现有调用点传入相对路径或已带 `pet-asset:` 前缀；新 voice-cache URL 也带前缀——均按预期判定。✓
- **voice-cache 白名单**：`^[a-f0-9]{32}\.mp3$` 在提取后强校验；`resolveInside` 二次防穿越。✓
- **未破坏 pet-asset 处理器**：新处理器独立注册，未触碰原 pet-asset 逻辑。✓
- **潜在隐患**：Step 5 的 `larkCliPath` 默认值硬编码为 `C:/Users/Thinkpad/.qwenworkcn/bin/lark-cli.cmd`，这是本机开发路径；客户交付时若 `boss-watch.json` 未提供 `larkCliPath`，会回退到该路径。由于客户场景默认 `watchConfig.enabled=false`（`boss-watch.json` 不存在时 `loadWatchConfig` 返回 `enabled: false`），不会触发。仅开发调试场景受影响，与 brief 一致。

## 提交

- `999b690` — feat: integrate boss watch radar into player main process
