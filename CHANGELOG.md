# Changelog

All notable changes to this project are documented here.

## 0.5.0 - 2026-08-10

### 新功能

- 飞书画饼雷达监听：通过 `lark-cli event consume` 事件流监听老板消息，按 open_id 过滤、词库匹配、edge-tts 语音播报吐槽，支持冷却、静默时段和断线指数退避重连。
- 兄弟判官桌面宠物 petpack：12 个动作（idle / walk / sit / sleep / reaction / drag / climb / perch / hang / fall / impact / recover）+ 判官风吐槽词库。
- voice-cache 协议：edge-tts 合成结果缓存到 userData/voice-cache，sendState 通过 `speechAudio` 字段传递 `voice-cache://` 协议 URL。
- sendState `speechAudio` 协议前缀修正：渲染端按协议前缀正确解析缓存音频，避免把整个 URL 当作文件路径。

### 变更

- 播放器主进程在首次启动时写入自用默认 `boss-watch.json`（enabled:true、开发机 lark-cli 路径、老板 open_id），开箱即用。
- `message-watcher` 的 spawn 显式设置 `stdio: ['ignore', 'pipe', 'pipe']`，避免 Windows 下 lark-cli.cmd 的 stdin EOF 问题。
- `build:customer` 与 `build` 配置新增打包 `watch-config.js`、`message-watcher.js`、`watch-rules.js`、`edge-voice.js`，确保画饼雷达随 EXE 交付。

### 已知限制

- 飞书用户需授权 `im:message` scope，lark-cli 才能消费事件流；Task 8 的 e2e 因飞书用户授权未完成而 BLOCKED。
- GUI 人工 QA（动画、透明背景及透明像素鼠标穿透、连续点击 50 次无放大/平移、拖动、漫游、左右朝向、右键菜单、托盘、退出）待人工确认。
- 便携版 EXE 未做数字签名，Windows SmartScreen 首次运行可能弹窗。

## 0.4.0 - 2026-07-28

- Upgrade the runtime from Electron 31 to Electron 43.
- Enable renderer process sandboxing and restrict navigation, new windows, and IPC senders.
- Add a shared JavaScript `.petpack` validator with archive, path, manifest, and PNG limits.
- Harden the Python validator before extraction and reject extra or conflicting files.
- Add malicious-package regression tests, CI, Dependabot, and draft release automation.
- Separate public source files from private photos, customer workspaces, and build artifacts.
