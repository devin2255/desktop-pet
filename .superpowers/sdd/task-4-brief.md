### Task 4: 渲染三拍 + 左屏板 + 右屏视频 + 点击收工

**Files:**
- Modify: `src/index-v3.html`, `src/styles-v3.css`, `src/renderer-v3.js`, `src/preload-v3.js`
- Test: `scripts/test-duo-renderer-contract.js`, `scripts/test-renderer-interaction.js`

**Interfaces:**
- Consumes: overlay payload、`pet:market`、`petApi.slackExit`
- Produces: 可见 intro/jump/carry；carry 时左板右视频；静止点击触发 slackExit

- [ ] **Step 1: 契约测试**

`test-duo-renderer-contract.js`：

```js
assert.match(html, /duo-slack-board/);
assert.match(html, /duo-slack-video/);
assert.match(html, /duo-intro-left/);
assert.match(html, /duo-intro-right/);
assert.match(renderer, /slackStage/);
assert.match(renderer, /slackExit/);
assert.match(styles, /\[data-phase="slack"\]/);
assert.match(styles, /--duo-open:\s*1/);
assert.doesNotMatch(html, /douyin\.com/);
```

`test-renderer-interaction.js`：在现有指针测试后，模拟 overlay `phase:'slack'` 时，静止 pointerdown/up 调用 `calls.slackExit`（给 fake `petApi.slackExit`）。拖过阈值不调用。

CSP：`index-v3.html` 的 `media-src` 保持 `pet-asset:`（已有则不动）。

- [ ] **Step 2:** 测试失败。

- [ ] **Step 3: 实现**

HTML `.duo-device-leaf-left` 内：`<img id="duo-intro-left" hidden>` + `<div id="duo-slack-board" hidden></div>`  
`.duo-device-leaf-right` 内：`<img id="duo-intro-right" hidden>` + `<video id="duo-slack-video" hidden muted playsinline loop></video>`（循环列表在 JS 里 ended 切 src，不要单文件 loop 除非 clips.length===1）。

CSS：`[data-phase="slack"]` 设 `--duo-open: 1`；隐藏钟与 pill；叶内 intro 图 `object-fit: contain`；board 小字红涨绿跌；video 铺满叶内容区；叶内容 `z-index` 高于人物叠边框的部分。

Renderer `applyDuoOverlay`：

- `phase==='slack'`：`tentActive=false` 但仍 `hideTicker()`（或 `slackActive` 标志，ticker 更新时若 slack 也隐藏）
- `intro`：显示 intro 图，藏 board/video，可藏主 `pet-image`（opacity 0）
- `jump`：藏 intro 图，显示主精灵（播 jump）
- `carry`：显示 board+video，主精灵 carry；`playSlackClips(clips)` 静音；`updateSlackBoard` 用最近一次 market info
- 现有 `updateTicker`：`if (tentActive || slackActive) { hideTicker(); return; }`

点击：`pointerup` 且未进入拖动且 `slackActive` → `preventDefault` 默认 interact，改 `petApi.slackExit()`。**拖动阈值逻辑与现有左键拖完全共用**，避免拖窗误收工。

- [ ] **Step 4:** renderer / contract 测试通过。跳过 commit。

---
