### Task 2: behavior 项支持 `speechAudio`

**Files:**
- Modify: `src/main-v3.js`（`sendState` / `runBehavior`）
- Modify: `src/renderer-v3.js`（`setState` / `onState`）
- Modify: `src/petpack-validator.js`（`referencedFiles` + `validateBehaviorList`）
- Modify: `skills/desktop-pet-maker/scripts/petpack_tool.py`
- Modify: `scripts/test-renderer-interaction.js`（或新建断言 behavior 音频路径解析的小测试）
- Modify: `src/interaction-controller.js`（perched 选择若已传 speech，同步支持 speechAudio 字段透传）

**Interfaces:**
- Consumes: `behavior.*.speechAudio?: string`（包内相对路径）
- Produces: `pet:state` payload 增加可选 `speechAudio`（已解析的 `pet-asset:` URL 或空串）

- [ ] **Step 1: 扩展校验失败用例**

在 `scripts/test-petpack-security.js` 或新建片段中：构造带 `behavior.random[].speechAudio` 的 manifest，确认 `referencedFiles` 包含该路径；非法扩展名抛错。

- [ ] **Step 2: 跑相关测试确认失败/缺口**

- [ ] **Step 3: 实现**

`referencedFiles` / Python `referenced_files`：遍历 `behavior.random` 与 `behavior.perched`，收集 `speechAudio`。

`validateBehaviorList` 增加与 contextMenu 相同的 `speechAudio` 扩展名校验。

`sendState`:

```js
function sendState(state, message = '', speech = '', logicalRole = state, options) {
  // ...
  const speechAudio = typeof options?.speechAudio === 'string' ? options.speechAudio : '';
  petWindow.webContents.send('pet:state', { state, logicalRole, message, speech, speechAudio });
}
```

`runBehavior` 中：

```js
const speech = typeof behavior.speech === 'string' ? behavior.speech : '';
const speechAudio = typeof behavior.speechAudio === 'string' && behavior.speechAudio
  ? petAssetUrl(activeManifest.id, behavior.speechAudio)
  : '';
sendState(behavior.state, message, speech, behavior.state, { speechAudio });
```

`renderer-v3.js`：

```js
function setState(state, message = '', speech = '', logicalRole, speechAudio = '') {
  // ...
  const audio = speechAudio || resolveSpeechAudio(state);
  if (speech || audio) speak(speech, audio);
}

window.petApi.onState(({ state, message, speech, logicalRole, speechAudio }) =>
  setState(state, message, speech, logicalRole, speechAudio || ''));
```

interaction-controller 的 perched `sendState` options 同样带上 `speechAudio`（若 choice 有该字段，由 main 包装层解析 URL——保持 controller 只传相对路径或已解析 URL 的一种，推荐 main 统一解析）。

- [ ] **Step 4: 跑测试**

```powershell
node scripts/test-renderer-interaction.js
node scripts/test-petpack-security.js
node scripts/test-interaction-controller.js
```

Expected: PASS

- [ ] **Step 5: Commit（若用户要求）**

---

