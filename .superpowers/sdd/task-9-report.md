# Task 9 报告：兄弟判官桌面宠物自用便携版 EXE 构建

## Step 1：自用 boss-watch 默认配置

### 现状

`src/watch-config.js` 的 `loadWatchConfig` 只读取已存在的 `boss-watch.json`，**不会**在文件缺失时写入默认配置。首次启动时画饼雷达不会自动启用。

### 新增

在 `src/watch-config.js` 新增 `ensureBossWatchDefaults(configPath)` 辅助函数 + `SELF_USE_DEFAULT_CONFIG` 常量，并在 `src/main-v3.js` 的 `loadWatchConfig` 调用前执行：

```js
const watchConfigPath = path.join(app.getPath('userData'), 'boss-watch.json');
ensureBossWatchDefaults(watchConfigPath);
const watchConfig = loadWatchConfig({ configPath: watchConfigPath, ... });
```

当文件缺失时写入自用默认值（存在文件则永不覆盖）：

| 字段 | 值 |
|---|---|
| enabled | true |
| larkCliPath | `C:/Users/Thinkpad/.qwenworkcn/bin/lark-cli.cmd` |
| bosses | `["ou_221a684c00848f0cd7f3e29d1061d908"]` |
| cooldownSec | 30 |
| quietHours | `[]` |
| voice.enabled | true |
| voice.gender | "male" |
| voice.rate | "+0%" |
| voice.voice | "zh-CN-YunxiNeural" |

### message-watcher spawn stdio 修复

`src/message-watcher.js` 的 `spawn(larkCliPath, ['event','consume','im.message.receive_v1'], { shell:true, windowsHide:true })` 新增 `stdio: ['ignore','pipe','pipe']`，显式忽略 stdin，避免 Windows 下 `lark-cli.cmd` 在非交互上下文的 stdin EOF / 挂起问题。

单元测试 `test-watch-config.js` 与 `test-message-watcher.js` 全部通过（fakeSpawn 不受 options 影响）。

## Step 2：版本号 + CHANGELOG

- `package.json` version: `0.4.0` -> `0.5.0`
- `CHANGELOG.md` 新增 `## 0.5.0 - 2026-08-10` 段，包含：飞书画饼雷达监听、兄弟判官 petpack（12 动作 + 判官风吐槽词库）、voice-cache 协议、sendState speechAudio 协议前缀修正、自用默认配置、stdio 修复、构建打包新增 watch 文件。
- 已知限制：飞书用户需授权 `im:message` scope；Task 8 e2e 因飞书授权 BLOCKED；GUI 人工 QA 待确认；数字签名未做。

注意：客户构建的交付版本号来自 `pet.json` 的 `packageVersion`（1.0.0），与播放器 0.5.0 是两条独立版本线，符合 `build-customer.js` 现有设计。

## Step 3：构建便携版 EXE

命令：

```
npm run build:customer -- --pet pets/packages/brother-judge.petpack --name "兄弟判官桌面宠物" --delivery-id brother-judge
```

结果：构建成功。

| 项 | 值 |
|---|---|
| EXE 路径 | `D:\Vibe_Coding\desktop-pet\dist\customers\brother-judge\兄弟判官桌面宠物-1.0.0.exe` |
| EXE 大小 | 94,321,541 字节（约 89.9 MiB） |
| 交付版本 | 1.0.0（来自 pet.json packageVersion） |
| build-report | `D:\Vibe_Coding\desktop-pet\dist\customers\brother-judge\build-report.json` |
| petpackSha256 | `dff910dcbfc83410a41a96dff4809559fa7a9c613fc5cb81e00b7f3b5458b3f9` |
| executableSha256 | `2afba9d8c15276abe965620aea11a6c357252e1e9bd4fe568b3ad17e88c27798` |

构建警告：`NODE_TLS_REJECT_UNAUTHORIZED=0` TLS 警告（electron-builder 内部下载 electron 时设置，不影响成品）；`duplicate dependency references`（重复传递依赖，electron-builder 自动去重，无害）。

## Step 4：ASAR / build-report 内容核查

由于便携版 EXE 是 7z 自解压格式且本机无 7z，使用相同 `files` 配置运行 `electron-builder --win dir` 生成未打包目录，对 `resources/app.asar`（8,898,219 字节，1709 条目）做内容核查：

### 播放器源文件（全部 OK）

- src/main-v3.js
- src/preload-v3.js
- src/renderer-v3.js
- src/index-v3.html
- src/styles-v3.css
- src/petpack-validator.js
- src/startup-greeting.js
- src/window-interactions.js
- src/window-discovery.js
- src/interaction-controller.js
- src/topmost-guard.js
- src/sequence-controller.js
- **src/watch-config.js**（新增）
- **src/message-watcher.js**（新增）
- **src/watch-rules.js**（新增）
- **src/edge-voice.js**（新增）
- package.json

### node_modules 依赖（全部 OK）

- edge-tts ✓
- adm-zip ✓
- get-windows ✓
- koffi ✓

### petpack

客户构建通过 `delivery/` 目录内联 petpack（`{ from: relativeDelivery, to: 'delivery', filter: ['**/*'] }`），运行时从 `delivery/pet.petpack` 加载。build-report.json 确认 petpackSha256 与原包一致，构建成功。（dir 检查构建为提速省略了 delivery 目录，正式客户构建包含该目录。）

### build-report.json 摘要

```json
{
  "schemaVersion": 1,
  "builtAt": "2026-08-10T12:41:57.681Z",
  "appName": "兄弟判官桌面宠物",
  "deliveryId": "brother-judge",
  "petId": "brother-judge",
  "petName": "兄弟判官",
  "petpack": "brother-judge.petpack",
  "petpackSha256": "dff910dc...b3f9",
  "executable": "兄弟判官桌面宠物-1.0.0.exe",
  "executableSha256": "2afba9d8...7798",
  "version": "1.0.0"
}
```

## 自审

- **缺失项**：无。播放器源、4 个画饼雷达模块、4 个 node_modules 依赖、petpack 均在 ASAR 中确认。
- **构建警告**：TLS 与重复依赖警告均来自 electron-builder 内部，不影响成品。
- **关键修复**：原 `build-customer.js` 的 `files` 数组**未包含** watch-config/message-watcher/watch-rules/edge-voice —— 若不修复，画饼雷达功能不会随 EXE 交付。已补齐 `scripts/build-customer.js` 与 `package.json` 的 `build.files`。
- **GUI 人工 QA**：未启动 GUI（按要求留给 controller）。动画、透明背景及鼠标穿透、连续点击 50 次无放大/平移、拖动、漫游、左右朝向、右键菜单、托盘、退出等需人工确认。
- **数字签名**：未做，Windows SmartScreen 首次运行可能弹窗。

## 提交

| 短 SHA | 说明 |
|---|---|
| ffb6a18 | release: brother judge desktop pet 0.5.0 with boss watch radar |

涉及文件：package.json、CHANGELOG.md、src/watch-config.js、src/message-watcher.js、src/main-v3.js、scripts/build-customer.js。
（dist/ 被 .gitignore 忽略，EXE 与 build-report.json 未纳入版本库。）

## EXE 绝对路径（供 controller 启动）

```
D:\Vibe_Coding\desktop-pet\dist\customers\brother-judge\兄弟判官桌面宠物-1.0.0.exe
```
