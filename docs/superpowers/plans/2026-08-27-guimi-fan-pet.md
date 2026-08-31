# 粉丝闺蜜桌宠（guimi）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一体双人 petpack `guimi` 与客户便携 EXE「闺蜜桌宠」，含闺蜜彩蛋、臭粑粑投喂、叫爸/下跪、跪爬模式与不停顿「去放松」剧情。

**Architecture:** 新建独立资源包 `guimi`，不覆盖 `xiaomei-xiaotian`。播放器从 `feature/son-mode` 接入通用跪爬模式（`crawlMode` + `animations.crawl` 才显示菜单），并放宽 `contextMenuActions` 上限到 12。宠物差异全部进 `pet.json` 与帧文件。

**Tech Stack:** Electron（`src/*-v3.js`）、`desktop-pet-maker` 动画流水线、Cursor `GenerateImage`（带参考图）、Node 回归测试、`npm run build:customer`。

**Spec:** `docs/superpowers/specs/2026-08-27-guimi-fan-pet-design.md`

## Global Constraints

- 分支：`feature/bestie-pets-design`
- package id / delivery-id：`guimi`；程序名 / 显示名：`闺蜜桌宠`
- 左闺蜜一（长发、JK 日常）/ 右闺蜜二（齐肩发、粉衣运动裤日常）；全动作禁止左右互换
- 台词不分角色；脸部真相源：闺蜜一 `bestie1-face.png`；闺蜜二 `bestie2-face-store.png` + `bestie2-face-red.png`（贴纸脸禁止入帧）
- 日常装固定散步穿搭；合影用 selfie 穿搭；去放松用 relax 穿搭
- 投喂物品主题只能是臭粑粑；relax 男模段 **无** `waitForClick`
- 跪爬菜单文案固定为「跪爬模式」
- 不在播放器里按角色名写死逻辑；不上传原图到无关服务
- 切帧失败必须重生成，禁止只擦串帧碎片继续
- **Git：** 用户规则优先——除非用户明确要求，否则跳过所有 `git commit` 步骤
- 每完成一个 Task，跑该 Task 列出的验证命令后再进入下一 Task

## File Structure

| Path | Responsibility |
|---|---|
| `src/roam-motion.js` | `nextRoamTarget`、`crawlIdleState`（若缺失则从 son-mode 引入） |
| `src/main-v3.js` | `settings.crawlMode`、散步改 crawl、跪爬菜单、kowtow→kowtow-crawl |
| `src/renderer-v3.js` | 识别 `crawl-left` / `crawl-right` |
| `src/styles-v3.css` | `.state-crawl-left` 镜像 |
| `src/petpack-validator.js` | `contextMenuActions` 上限 8→12 |
| `skills/desktop-pet-maker/scripts/petpack_tool.py` | 同上限 |
| `skills/desktop-pet-maker/references/petpack-schema.md` | 文档同步 |
| `scripts/test-roam-motion.js` | roam/crawl idle 单测 |
| `scripts/test-crawl-mode-menu.js` | 菜单上限与 crawl 存在性约定 |
| `scripts/test-guimi-petpack.js` | guimi 清单/菜单/序列断言 |
| `pets/work/guimi/` | 参考图、IDENTITY、绿幕条、处理后帧 |
| `pets/library/guimi/` | 解包库 |
| `pets/packages/guimi.petpack` | 交付资源包 |
| `package.json` | `test:guimi`、`build:guimi`、把 crawl 相关进 `test:js` |
| `dist/customers/guimi/` | EXE + `build-report.json` |

### Manifest 约定（后续 Task 共用）

```json
{
  "id": "guimi",
  "name": "闺蜜桌宠",
  "startupGreeting": "我们是闺蜜桌宠～今天也要一起玩。",
  "personality": ["闺蜜", "活泼", "黏人"],
  "speechGender": "female",
  "sequences": {
    "relax": {
      "stages": [
        { "action": "relax-makeup", "message": "先弄好看一点～", "duration": 2800 },
        { "action": "relax-dress", "message": "这样…会不会太亮眼", "duration": 2200 },
        { "action": "relax-run", "message": "走！去放松！", "duration": 2800 },
        {
          "action": "relax-models",
          "messages": ["我要这个", "我要这个"],
          "messageGapMs": 700,
          "duration": 2200
        },
        { "action": "relax-hug", "duration": 2200 },
        {
          "action": "relax-shy",
          "messages": ["好害羞…", "嘿嘿…"],
          "messageGapMs": 800,
          "duration": 3600
        },
        { "action": "idle", "duration": 0 }
      ]
    },
    "selfie-banter": {
      "stages": [
        { "action": "selfie", "message": "我站后面！", "duration": 1200 },
        { "action": "selfie", "message": "不行，后面显脸小！", "duration": 1600 },
        { "action": "selfie", "message": "那一起往后挤～", "duration": 1800 },
        { "action": "idle", "duration": 0 }
      ]
    },
    "feed-poop-a": {
      "stages": [
        { "action": "feed-poop-throw", "message": "这是什么味儿…", "duration": 1800 },
        { "action": "feed-poop", "message": "臭粑粑！？", "duration": 3800 },
        { "action": "idle", "duration": 0 }
      ]
    },
    "feed-poop-b": {
      "stages": [
        { "action": "feed-poop-throw", "message": "诶你扔的什么！", "duration": 1800 },
        { "action": "feed-poop", "message": "好臭！拿开拿开！", "duration": 3800 },
        { "action": "idle", "duration": 0 }
      ]
    }
  },
  "contextMenuActions": [
    { "id": "cuddle", "label": "贴贴", "action": "cuddle", "message": "再靠近一点点", "duration": 3600 },
    { "id": "selfie", "label": "合个影", "sequence": "selfie-banter" },
    { "id": "whisper", "label": "说悄悄话", "action": "whisper", "message": "嘘——跟你说哦", "duration": 3200 },
    { "id": "cheer", "label": "加油鸭", "action": "cheer", "message": "加油鸭！", "duration": 3200 },
    { "id": "relax", "label": "去放松", "sequence": "relax" },
    { "id": "nap", "label": "去睡觉", "action": "sleep", "message": "眯一下…", "duration": 4500 },
    {
      "id": "feed",
      "label": "投喂",
      "randomActions": [
        { "sequence": "feed-poop-a" },
        { "sequence": "feed-poop-b" }
      ]
    },
    { "id": "call-dad", "label": "叫爸", "action": "call-dad", "message": "爸！", "duration": 2800 },
    { "id": "kowtow", "label": "下跪", "action": "kowtow", "message": "跪下了", "duration": 3600 }
  ]
}
```

`relax-models` 阶段**不得**含 `waitForClick: true`。

参考图（已就位，gitignore）：`pets/work/guimi/source/refs/`。

---

### Task 1: 通用跪爬模式 + 菜单上限 12

**Files:**
- Create/Replace: `src/roam-motion.js`
- Create/Update: `scripts/test-roam-motion.js`
- Create: `scripts/test-crawl-mode-wiring.js`
- Modify: `src/main-v3.js`
- Modify: `src/renderer-v3.js`
- Modify: `src/styles-v3.css`
- Modify: `src/petpack-validator.js`（上限 8→12）
- Modify: `skills/desktop-pet-maker/scripts/petpack_tool.py`（上限 8→12）
- Modify: `skills/desktop-pet-maker/references/petpack-schema.md`
- Modify: `package.json`（`test:js` 纳入新测试与 `--check src/roam-motion.js`）

**Interfaces:**
- Consumes: `activeManifest.animations.crawl` 可选
- Produces:
  - `settings.crawlMode: boolean`（默认 `false`）
  - `crawlIdleState(facing: 'left'|'right') -> 'crawl-left'|'crawl-right'`
  - `nextRoamTarget(bounds, workArea, rng, lastDirection) -> { targetX, direction }`
  - 托盘项 `label: '跪爬模式'`，`visible: Boolean(activeManifest?.animations?.crawl)`
  - `contextMenuActions.length <= 12`

- [ ] **Step 1: 写/确认 `scripts/test-roam-motion.js` 失败或补齐**

```js
'use strict';
const assert = require('assert');
const { nextRoamTarget, crawlIdleState } = require('../src/roam-motion');

assert.strictEqual(crawlIdleState('left'), 'crawl-left');
assert.strictEqual(crawlIdleState('right'), 'crawl-right');
assert.strictEqual(crawlIdleState(''), 'crawl-right');

const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
const width = 160;
{
  const { targetX, direction } = nextRoamTarget({ x: 0, width }, workArea, () => 0, 'left');
  assert.strictEqual(direction, 'right');
  assert.ok(targetX > 0);
}
{
  const x = workArea.x + workArea.width - width;
  const { direction } = nextRoamTarget({ x, width }, workArea, () => 0, 'right');
  assert.strictEqual(direction, 'left');
}
console.log('roam-motion: all tests passed');
```

- [ ] **Step 2: 写 `scripts/test-crawl-mode-wiring.js`（纯函数/导出探测不够时，直接断言源码契约 + validator）**

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateManifest } = require('../src/petpack-validator');

const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'main-v3.js'), 'utf8');
assert.ok(mainSrc.includes("label: '跪爬模式'"), 'tray must expose 跪爬模式');
assert.ok(mainSrc.includes('crawlMode'), 'settings.crawlMode required');
assert.ok(mainSrc.includes("kowtow-crawl"), 'kowtow must remap in crawl mode');

const rendererSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer-v3.js'), 'utf8');
assert.ok(rendererSrc.includes('crawl-left'), 'renderer must resolve crawl facing');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles-v3.css'), 'utf8');
assert.ok(css.includes('.state-crawl-left'), 'CSS mirror for crawl-left required');

// menu limit 12
const items = [];
for (let i = 0; i < 9; i++) {
  items.push({ id: `a${i}`, label: `L${i}`, action: 'idle' });
}
const manifest = {
  schemaVersion: 1,
  packageVersion: '1.0.0',
  id: 'limit-test',
  name: 't',
  description: 't',
  personality: ['a'],
  preview: 'preview.png',
  animations: {
    idle: { frames: ['animations/idle/01.png'], durations: [100], loop: true, holdLastFrame: false, scale: 1 },
    walk: { frames: ['animations/walk/01.png'], durations: [100], loop: true, holdLastFrame: false, scale: 1 },
    sit: { frames: ['animations/sit/01.png'], durations: [100], loop: false, holdLastFrame: true, scale: 1 },
    sleep: { frames: ['animations/sleep/01.png'], durations: [100], loop: true, holdLastFrame: false, scale: 1 },
    reaction: { frames: ['animations/reaction/01.png'], durations: [100], loop: false, holdLastFrame: true, scale: 1 }
  },
  contextMenuActions: items
};
// validateManifest needs on-disk frames; instead unit-test the length rule via isolated require of limit helper
// Prefer: temporarily call internal check by constructing through petpack-validator error path after raising limit.
assert.ok(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'petpack-validator.js'), 'utf8').includes('length > 12'),
  'validator must allow up to 12 contextMenuActions'
);
console.log('test-crawl-mode-wiring: ok');
```

- [ ] **Step 3: 实现 `src/roam-motion.js`（与 son-mode 对齐）**

```js
'use strict';

function nextRoamTarget({ x, width }, workArea, rng = Math.random, lastDirection) {
  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - width;
  if (!(maxX > minX)) return { targetX: minX, direction: 'right' };

  const span = Math.max(80, Math.min(320, workArea.width * 0.22));
  const edgeMargin = Math.max(48, Math.round(span * 0.4));
  const nearLeft = x <= minX + edgeMargin;
  const nearRight = x >= maxX - edgeMargin;

  let direction;
  if (nearLeft && !nearRight) direction = 'right';
  else if (nearRight && !nearLeft) direction = 'left';
  else if (lastDirection === 'left' || lastDirection === 'right') {
    direction = rng() < 0.7 ? lastDirection : (lastDirection === 'left' ? 'right' : 'left');
  } else {
    direction = rng() < 0.5 ? 'left' : 'right';
  }

  const travel = Math.max(140, Math.round(span * (0.6 + rng() * 0.4)));
  let targetX = direction === 'right'
    ? Math.min(maxX, x + travel)
    : Math.max(minX, x - travel);

  if (Math.abs(targetX - x) < 48) {
    direction = direction === 'right' ? 'left' : 'right';
    targetX = direction === 'right'
      ? Math.min(maxX, x + travel)
      : Math.max(minX, x - travel);
  }

  return { targetX, direction };
}

function crawlIdleState(facing) {
  return facing === 'left' ? 'crawl-left' : 'crawl-right';
}

module.exports = { nextRoamTarget, crawlIdleState };
```

- [ ] **Step 4: 改 `src/main-v3.js`**

关键改动点：

1. `const { nextRoamTarget, crawlIdleState } = require('./roam-motion');`
2. `let settings = { petId: '', sizeKey: 'small', roaming: true, crawlMode: false };`
3. 增加 `let lastWalkFacing = 'right';`
4. `walkTo`：

```js
const moveAction = settings.crawlMode && activeManifest?.animations?.crawl ? 'crawl' : 'walk';
sendState(`${moveAction}-${direction}`);
// on complete:
sendState(idleState());
scheduleBehavior(settings.crawlMode ? 700 + Math.random() * 900 : undefined);
```

5. 

```js
function idleState() {
  return (settings.crawlMode && activeManifest?.animations?.crawl)
    ? crawlIdleState(lastWalkFacing)
    : 'idle';
}
```

6. `chooseBehavior` 开头：

```js
if (settings.crawlMode && activeManifest?.animations?.crawl) {
  return { state: 'walk', weight: 100, minDuration: 2000, maxDuration: 5000 };
}
```

7. `runBehavior` 走路分支改用 `nextRoamTarget`，并 `lastWalkFacing = direction`
8. `runDirectMenuAction`：若 `choice.action === 'kowtow' && settings.crawlMode && activeManifest.animations['kowtow-crawl']`，改 `action` 为 `kowtow-crawl`；结束后 `sendState(idleState())`
9. `buildTrayMenu` 在「在桌面散步」后插入「跪爬模式」checkbox（文案精确为 `跪爬模式`）
10. 散步开关回调里 `sendState(idleState())` 替代裸 `idle`

参考实现：`git show feature/son-mode:src/main-v3.js` 中同名片段。

- [ ] **Step 5: 改 renderer / CSS**

`src/renderer-v3.js` 的 `resolveAction`：

```js
if (normalized === 'crawl-left' || normalized === 'crawl-right') return 'crawl';
```

`isFacingLeft`：

```js
|| pet.classList.contains('state-crawl-left')
```

`src/styles-v3.css` 在既有 left-facing 列表加入：

```css
.state-crawl-left .pet-image,
```

- [ ] **Step 6: 上限 12**

`src/petpack-validator.js`：

```js
if (!Array.isArray(manifest.contextMenuActions) || manifest.contextMenuActions.length > 12) {
  throw new Error('contextMenuActions 必须是最多 12 项的数组');
}
```

`petpack_tool.py` 同步改为 at most 12；`petpack-schema.md` 写明 12。

- [ ] **Step 7: 跑测试**

Run:

```powershell
node scripts/test-roam-motion.js
node scripts/test-crawl-mode-wiring.js
node --check src/main-v3.js
node --check src/renderer-v3.js
node --check src/roam-motion.js
npm run test:js
```

Expected: 全部 PASS / exit 0。

- [ ] **Step 8: Commit（仅当用户要求时）**

---

### Task 2: 工作区 IDENTITY 检查表

**Files:**
- Create: `pets/work/guimi/IDENTITY.md`
- Verify: `pets/work/guimi/source/refs/*.png`（已存在 9 张）

- [ ] **Step 1: 确认参考图**

Run:

```powershell
Get-ChildItem pets/work/guimi/source/refs | Select-Object Name
```

Expected: 含 `bestie1-face.png`、`bestie1-walk-outfit.png`、`bestie1-selfie-outfit.png`、`bestie1-relax-outfit.png`、`bestie2-face-store.png`、`bestie2-face-red.png`、`bestie2-walk-outfit.png`、`bestie2-selfie-outfit.png`、`bestie2-relax-outfit.png`。

- [ ] **Step 2: 写 IDENTITY.md**

必须包含：

- 左闺蜜一 / 右闺蜜二，禁止互换
- 脸源与「禁止贴纸脸」
- 三套服装对照表（日常 / 合影 / 去放松）
- 分角色不分名字：台词用「我们」口吻
- 男模仅出现在 relax

- [ ] **Step 3: Commit（仅当用户要求时）**

---

### Task 3: 生成日常五动作 + drag（散步装）

**Files:**
- Create under `pets/work/guimi/`：`idle-chroma.png` `walk-chroma.png` `sit-chroma.png` `sleep-chroma.png` `reaction-chroma.png` `drag-chroma.png`
- Output frames → `pets/library/guimi/animations/{idle,walk,sit,sleep,reaction,drag}/`

**Interfaces:**
- Consumes: refs + IDENTITY；Cursor `GenerateImage`（`reference_image_paths` 指向脸与日常穿搭）
- Produces: 各动作合规透明帧；双人同框；日常装

帧数：idle≥4 / walk≥6 / sit≥4 / sleep≥4 / reaction≥4 / drag≥6

- [ ] **Step 1: 按 `skills/desktop-pet-maker/references/image-prompts.md` 生成绿幕横条**

每条提示词硬性锁：

- 左：长直黑发 + 藏青水手服（白领浅蓝条、白大蝴蝶结）
- 右：齐肩黑发 + 亮粉长袖 + 藏青白边运动裤
- 偏真人、完整双人身体、脚底同一基线、左右 ≥12% 绿边、纯 `#00ff00` 背景
- 无文字、无贴纸脸、无道具（drag 除外可夸张被拖）

参考图至少：`bestie1-face.png`、`bestie1-walk-outfit.png`、`bestie2-face-store.png`、`bestie2-walk-outfit.png`。

- [ ] **Step 2: 去背**

对每条 chroma 使用项目既有 imagegen/去背流程（与 desktop-pet-maker skill 一致）：`--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`。

- [ ] **Step 3: 切帧规范化**

```powershell
python skills/desktop-pet-maker/scripts/process_animation_strips.py --help
# 按 skill 对该目录五/六条透明条执行；任一条安全门禁失败 → 整条重生成
```

- [ ] **Step 4: 目检 contact sheet**

检查：左右身份、脸不是贴纸、无串帧、无断肢、基线稳定、体量一致。

- [ ] **Step 5: Commit（仅当用户要求时）**

---

### Task 4: crawl / call-dad / kowtow / kowtow-crawl（日常装）

**Files:**
- Create: `pets/library/guimi/animations/crawl/`（≥6）
- Create: `pets/library/guimi/animations/call-dad/`（≥4）
- Create: `pets/library/guimi/animations/kowtow/`（≥4）
- Create: `pets/library/guimi/animations/kowtow-crawl/`（≥4）

- [ ] **Step 1: 生成 `crawl` 绿幕条**

两人并排四肢着地往右爬，日常装，完整四肢与头，安全边距。

- [ ] **Step 2: 生成 `call-dad`（招手喊爸）、`kowtow`（站姿下跪磕头）、`kowtow-crawl`（爬姿磕头）**

同一对身份、日常装。

- [ ] **Step 3: 去背 + `process_animation_strips.py`；失败则重生成**

- [ ] **Step 4: 目检**

尤其 crawl 循环重播无闪现/缩放；kowtow 与 kowtow-crawl 脚底/膝底基线自洽。

- [ ] **Step 5: Commit（仅当用户要求时）**

---

### Task 5: 闺蜜彩蛋 + 合影变装

**Files:**
- Create: `pets/library/guimi/animations/{cuddle,whisper,cheer,selfie}/`

- [ ] **Step 1: 生成 cuddle / whisper / cheer（日常装）**

- [ ] **Step 2: 生成 selfie（合影装）**

参考：`bestie1-selfie-outfit.png`、`bestie2-selfie-outfit.png` + 两张脸图。  
画面：粉白猫耳女仆风（左）+ 藏青 T/牛仔裤/棕包（右），可轻比耶。

- [ ] **Step 3: 去背、切帧、目检**

- [ ] **Step 4: Commit（仅当用户要求时）**

---

### Task 6: 投喂臭粑粑序列帧

**Files:**
- Create: `pets/library/guimi/animations/feed-poop-throw/`
- Create: `pets/library/guimi/animations/feed-poop/`

- [ ] **Step 1: 生成 throw（臭粑粑飞入）与 reaction（两人嫌弃捂鼻）绿幕条**

道具只允许卡通臭粑粑，禁止真实恶心特写；日常装。

- [ ] **Step 2: 去背、切帧、目检**

- [ ] **Step 3: Commit（仅当用户要求时）**

---

### Task 7: 去放松分镜（无 waitForClick）

**Files:**
- Create: `pets/library/guimi/animations/{relax-makeup,relax-dress,relax-run,relax-models,relax-hug,relax-shy}/`

- [ ] **Step 1: makeup（可仍偏日常或补妆过渡）**

- [ ] **Step 2: dress / 后续阶段使用去放松穿搭**

参考：`bestie1-relax-outfit.png`、`bestie2-relax-outfit.png`。  
左：藏青白边女仆装；右：蓝红拼色外套+牛仔裤。

- [ ] **Step 3: models（两位男模就位，双人仍可辨认）→ hug → shy**

- [ ] **Step 4: 去背、切帧、目检；确认无左右互换**

- [ ] **Step 5: Commit（仅当用户要求时）**

---

### Task 8: 窗口边缘映射帧（可复用/轻量专用）

**Files:**
- Ensure `interactionActions` 可用动画：`climb-peek` 或回退 `walk`；`perch-milk-tea` 或回退 `sit`；`fall-air` / `fall-butt` / `fall-cry-up` 或回退现有 reaction/sit

若工期紧：`interactionActions` 先映射到已有日常帧（与现有小美包策略一致），但必须在 `pet.json` 显式写出映射；有余力再补专用条。

- [ ] **Step 1: 决定首版映射表并写入后续 manifest Task**

最小可交付映射：

```json
"interactionActions": {
  "drag": { "action": "drag" },
  "climb": { "action": "walk", "anchor": { "x": 0.5, "y": 0.5 } },
  "perch": { "action": "sit", "anchor": { "x": 0.5, "y": 0.55 } },
  "hang": { "action": "sit", "anchor": { "x": 0.5, "y": 0.08 } },
  "fall": { "action": "reaction" },
  "impact": { "action": "sit" },
  "recover": { "action": "reaction" }
}
```

- [ ] **Step 2: 若生成了专用 perch/climb/fall，替换映射并补帧**

- [ ] **Step 3: Commit（仅当用户要求时）**

---

### Task 9: `pet.json` + 打包 + `test-guimi-petpack`

**Files:**
- Create: `pets/library/guimi/pet.json`
- Create: `pets/library/guimi/preview.png`（从 idle 或 master 导出）
- Create: `scripts/test-guimi-petpack.js`
- Create: `pets/packages/guimi.petpack`
- Modify: `package.json`（`test:guimi`、`build:guimi`）

- [ ] **Step 1: 写失败测试 `scripts/test-guimi-petpack.js`**

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { validateManifest, validatePetpack } = require('../src/petpack-validator');

const libraryDir = path.join(__dirname, '..', 'pets', 'library', 'guimi');
const petpackPath = path.join(__dirname, '..', 'pets', 'packages', 'guimi.petpack');
assert.ok(fs.existsSync(path.join(libraryDir, 'pet.json')));
assert.ok(fs.existsSync(petpackPath));

const libraryManifest = JSON.parse(fs.readFileSync(path.join(libraryDir, 'pet.json'), 'utf8'));
validateManifest(libraryManifest, libraryDir, true);
const zip = new AdmZip(petpackPath);
assert.deepStrictEqual(JSON.parse(zip.readAsText('pet.json')), libraryManifest);
const { manifest } = validatePetpack(petpackPath);

assert.strictEqual(manifest.id, 'guimi');
assert.strictEqual(manifest.name, '闺蜜桌宠');
assert.strictEqual(manifest.startupGreeting, '我们是闺蜜桌宠～今天也要一起玩。');
assert.ok(manifest.animations.crawl, 'crawl required for 跪爬模式');
assert.ok(manifest.animations['call-dad']);
assert.ok(manifest.animations.kowtow);
assert.ok(manifest.animations['kowtow-crawl']);
assert.ok(manifest.animations.drag);

const menu = Object.fromEntries(manifest.contextMenuActions.map((i) => [i.id, i]));
assert.ok(menu['call-dad'] && menu.kowtow && menu.feed && menu.relax && menu.selfie);
assert.strictEqual(menu['call-dad'].message, '爸！');
assert.strictEqual(menu.kowtow.message, '跪下了');
assert.ok(Array.isArray(menu.feed.randomActions) && menu.feed.randomActions.length >= 2);
assert.ok(menu.feed.randomActions.every((x) => String(x.sequence).startsWith('feed-poop')));
assert.strictEqual(menu.relax.sequence, 'relax');
const waitStages = (manifest.sequences.relax.stages || []).filter((s) => s.waitForClick === true);
assert.strictEqual(waitStages.length, 0, 'relax must not pause for click');
assert.ok(manifest.contextMenuActions.length <= 12);
console.log('test-guimi-petpack: ok');
```

- [ ] **Step 2: 用 `create_pet_manifest.py` 或手写完整 `pet.json`**

填入上文 Manifest 约定 + `behavior.random`（规格权重）+ 全部 `animations` 帧路径 + `interactionActions`。

- [ ] **Step 3: 构建 petpack**

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/guimi
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/guimi pets/packages/guimi.petpack
```

- [ ] **Step 4: 跑测试**

```powershell
node scripts/test-guimi-petpack.js
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/guimi.petpack
```

Expected: `test-guimi-petpack: ok`；validator valid。

- [ ] **Step 5: `package.json` 增加**

```json
"test:guimi": "node scripts/test-guimi-petpack.js",
"build:guimi": "node scripts/build-customer.js --pet pets/packages/guimi.petpack --name \"闺蜜桌宠\" --delivery-id guimi"
```

- [ ] **Step 6: Commit（仅当用户要求时）**

---

### Task 10: 客户 EXE + 实机验收

**Files:**
- Output: `dist/customers/guimi/`（EXE + `build-report.json`）

- [ ] **Step 1: 回归门禁**

```powershell
node scripts/test-renderer-interaction.js
python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v
npm run test:guimi
```

任一项失败禁止打包。

- [ ] **Step 2: 构建**

```powershell
npm run build:customer -- --pet pets/packages/guimi.petpack --name "闺蜜桌宠" --delivery-id guimi
```

- [ ] **Step 3: 实际启动 EXE，逐项勾选**

- [ ] 双击即出双人，独立 userData
- [ ] 日常 idle/walk/sit/sleep/reaction；透明像素鼠标穿透
- [ ] 静止连点 50 次无放大/平移
- [ ] 贴贴 / 合影变装 / 悄悄话 / 加油 / 睡觉
- [ ] 投喂 → 臭粑粑台词与动画
- [ ] 叫爸「爸！」；下跪「跪下了」
- [ ] 勾选「跪爬模式」+「在桌面散步」→ 爬姿移动与爬姿待机；关闭后恢复直立
- [ ] 跪爬模式下「下跪」走 `kowtow-crawl`
- [ ] 去放松全程自动播放，男模后不停顿
- [ ] 拖拽、托盘、隐藏、退出

- [ ] **Step 4: 交付说明**

列出已验证 / 未验证（含数字签名未做）。

- [ ] **Step 5: Commit（仅当用户要求时）**

---

## Spec coverage self-check

| Spec 要求 | Task |
|---|---|
| 独立 `guimi` 包与 EXE | 9–10 |
| 左一右二、三套衣服 | 2–7 |
| 日常五动作 + drag | 3 |
| 跪爬模式通用播放器 | 1, 4 |
| 叫爸 / 下跪 / kowtow-crawl | 4, 9 |
| 彩蛋 + 合影变装 | 5, 9 |
| 投喂臭粑粑 | 6, 9 |
| relax 无 waitForClick | 7, 9 |
| 菜单 ≤12 | 1, 9 |
| 质量门禁与实机 | 3–7 目检, 10 |

## Placeholder scan

无 TBD/TODO；命令与关键代码块已写明。
