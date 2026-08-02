# 美杜莎上才艺换装舞 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `feat/medusa-pet` 的美杜莎包追加右键「上才艺」：≥12 帧边跳舞边换装（白金礼服→黑金战甲→七彩鳞纹礼服→回白金），并更新 petpack / 回归 / 客户 EXE。

**Architecture:** 播放器零改动。仅扩展 `.petpack`：新增 `animations.talent-show`、女声 `audio/talent-show.mp3`、`contextMenuActions` 一项。换装全部画进同一动画条。先改回归测试（TDD），再生成资产并打包。

**Tech Stack:** GenerateImage + chroma key + `process_animation_strips.py`、`petpack_tool.py`、`edge-tts`、Node 回归、`npm run build:medusa`。

**Spec:** `docs/superpowers/specs/2026-08-02-medusa-talent-show-design.md`

## Global Constraints

- 分支：`feat/medusa-pet`
- 菜单：`talent-show` / 标签「上才艺」/ 气泡「给本座看好了。」/ speech「看好了」/ `audio/talent-show.mp3`
- `duration >= 5000`；`frames.length >= 12`；`durations` 合计 ≥ 4000
- 造型顺序：白金礼服 → 黑金战甲 → 七彩鳞纹礼服 → 回白金；边跳边换，禁止站桩闪切
- 同一张脸/金冠/人形双腿；尺度/重心/脚底基线锁定
- 不进 `behavior.random`；日常 idle/walk 仍白金礼服
- 切帧失败整条重生，禁止只擦串帧碎片
- **Git：** 除非用户明确要求，资产目录 `pets/work/`、`pets/library/` 不提交；可提交 `medusa.petpack`、测试、docs、验证报告
- 每完成一个 Task，跑该 Task 验证命令后再进入下一 Task

## File Structure

| Path | Responsibility |
|---|---|
| `scripts/test-medusa-petpack.js` | 先改为要求 Medusa talent-show（删除“不得存在”断言） |
| `pets/work/medusa/source/custom/talent-show*` | 绿幕/透明条与单帧源 |
| `pets/work/medusa/processed/frames/talent-show/` | 规范化 12+ 帧 |
| `pets/work/medusa/audio/talent-show.mp3` | 女声「看好了」 |
| `pets/library/medusa/` | 组装更新（gitignore） |
| `pets/packages/medusa.petpack` | 重打包演示包 |
| `dist/customers/medusa/` | 重建 EXE |
| `outputs/medusa-talent-verification.json` | 验证摘要 |

---

### Task 1: 回归测试先红（TDD）

**Files:**
- Modify: `scripts/test-medusa-petpack.js`
- Test: `scripts/test-medusa-petpack.js`

**Interfaces:**
- Produces: 失败断言，要求存在 Medusa 版 `talent-show` 菜单与 ≥12 帧动画

- [ ] **Step 1: 改测试**

删除这些否定断言：

```js
assert.ok(!menu['talent-show'], 'laopo talent-show must not exist');
assert.ok(!manifest.animations['talent-show']);
```

在菜单段追加：

```js
assert.ok(menu['talent-show'], 'talent-show context action required');
assert.strictEqual(menu['talent-show'].label, '上才艺');
assert.strictEqual(menu['talent-show'].message, '给本座看好了。');
assert.strictEqual(menu['talent-show'].speech, '看好了');
assert.strictEqual(menu['talent-show'].speechAudio, 'audio/talent-show.mp3');
assert.ok(menu['talent-show'].duration >= 5000, 'talent-show menu duration should be longer');
const talent = manifest.animations['talent-show'];
assert.ok(talent, 'talent-show animation required');
assert.ok(talent.frames.length >= 12, 'talent-show needs a longer 12-frame dance');
assert.ok(talent.durations.reduce((sum, ms) => sum + ms, 0) >= 4000, 'talent-show animation should play longer');
assert.ok(!manifest.behavior.random.some((item) => item.state === 'talent-show'), 'talent-show must not be in random pool');
```

在动画存在性循环中加入 `'talent-show'`。

保留对 `call-hubby` / `kowtow` / `serve-tea` 的否定断言。

- [ ] **Step 2: 跑测试确认失败**

```powershell
node scripts/test-medusa-petpack.js
```

Expected: FAIL（当前 petpack 无 talent-show）

- [ ] **Step 3: Commit 测试**

```powershell
git add scripts/test-medusa-petpack.js
git commit -m "test: require Medusa talent-show costume dance in petpack"
```

---

### Task 2: 换装关键定妆 + 12 帧舞蹈条

**Files:**
- Create: `pets/work/medusa/source/custom/outfit-black-gold.png`（可选关键）
- Create: `pets/work/medusa/source/custom/outfit-rainbow-scale.png`（可选关键）
- Create: `pets/work/medusa/source/custom/talent-show-chroma.png` 或 per-frame `talent-show-01..12.png`
- Create: `pets/work/medusa/source/custom/transparent/talent-show.png`
- Create: `pets/work/medusa/processed/frames/talent-show/01.png` … `12.png`（可更多）

**Interfaces:**
- Consumes: `pets/work/medusa/source/standard/transparent/master.png`、`IDENTITY.md`
- Produces: 与现库同画布的 talent-show 规范化帧

- [ ] **Step 1: 生成两套关键造型（黑金战甲、七彩鳞纹）**

用 master 作 reference；3D 国漫；金冠与脸不变。

- [ ] **Step 2: 生成 12 帧边跳边换装**

分段：1–3 白金起舞；4–6 换黑金战甲续舞；7–9 七彩鳞纹高潮；10–12 回白金收势。  
流水线：per-frame GenerateImage（3:4）→ compose ≥14% 绿沟 → `remove_chroma_key.py`（与既有参数一致）→ process：

```powershell
python skills/desktop-pet-maker/scripts/process_animation_strips.py `
  --input-dir pets/work/medusa/source/custom/transparent `
  --output-dir pets/work/medusa/processed/frames `
  --action talent-show:12
```

若需与全库共享度量，将 `talent-show.png` 并入含其它 transparent 条的 staging 后一次处理（以现有 medusa `_compose_strips` / Task 3–5 做法为准）。失败则整条重生。

- [ ] **Step 3: 目检**

换装可读；无站桩闪切；尺度无漂移；无绿边/大碎块。

- [ ] **Step 4: 不提交 `pets/work/`**

报告写入 `.superpowers/sdd/task-talent-2-report.md`（或沿用 sdd 编号）。

---

### Task 3: 女声音频「看好了」

**Files:**
- Create: `pets/work/medusa/audio/talent-show.mp3`

- [ ] **Step 1: 生成**

```powershell
edge-tts --voice zh-CN-XiaoxiaoNeural --text "看好了" --write-media pets/work/medusa/audio/talent-show.mp3
```

- [ ] **Step 2: 确认文件非空**

```powershell
(Get-Item pets/work/medusa/audio/talent-show.mp3).Length
```

Expected: > 0

---

### Task 4: 组装 library、打包、测绿、重建 EXE

**Files:**
- Modify: `pets/library/medusa/pet.json`
- Create: `pets/library/medusa/animations/talent-show/*.png`
- Create: `pets/library/medusa/audio/talent-show.mp3`
- Modify: `pets/packages/medusa.petpack`
- Create: `outputs/medusa-talent-verification.json`
- Possibly rebuild: `dist/customers/medusa/`

**Interfaces:**
- Consumes: Task 2 帧 + Task 3 音频
- Produces: 使 Task 1 测试 PASS 的 petpack + 客户 EXE

- [ ] **Step 1: 复制帧与音频到 library**

- [ ] **Step 2: 更新 `pet.json`**

在 `animations` 增加（帧路径按实盘数量；若 >12 则全写上）：

```json
"talent-show": {
  "frames": [
    "animations/talent-show/01.png",
    "animations/talent-show/02.png",
    "animations/talent-show/03.png",
    "animations/talent-show/04.png",
    "animations/talent-show/05.png",
    "animations/talent-show/06.png",
    "animations/talent-show/07.png",
    "animations/talent-show/08.png",
    "animations/talent-show/09.png",
    "animations/talent-show/10.png",
    "animations/talent-show/11.png",
    "animations/talent-show/12.png"
  ],
  "durations": [280, 280, 280, 300, 300, 300, 300, 300, 300, 280, 280, 700],
  "loop": false,
  "holdLastFrame": true,
  "scale": 1
}
```

在 `contextMenuActions` 追加：

```json
{
  "id": "talent-show",
  "label": "上才艺",
  "action": "talent-show",
  "message": "给本座看好了。",
  "speech": "看好了",
  "speechAudio": "audio/talent-show.mp3",
  "duration": 5200
}
```

确认 `behavior.random` 不含 `talent-show`。可把 `packageVersion`  bump 为 `0.1.1`。

- [ ] **Step 3: 校验与打包**

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/medusa
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/medusa pets/packages/medusa.petpack
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/medusa.petpack
node scripts/test-medusa-petpack.js
npm run validate:demo
```

Expected: 全部 PASS

- [ ] **Step 4: 发布门禁 + 客户包**

```powershell
node scripts/test-renderer-interaction.js
npm test
npm run build:medusa
```

- [ ] **Step 5: 启动验证**

至少确认：右键出现「上才艺」；触发后面板/动画切换；气泡「给本座看好了。」；尽量听女声。将已验证/未验证写入 `outputs/medusa-talent-verification.json`。

- [ ] **Step 6: Commit 可跟踪产物**

```powershell
git add pets/packages/medusa.petpack scripts/test-medusa-petpack.js outputs/medusa-talent-verification.json
git commit -m "feat: add Medusa talent-show costume-change dance"
```

（若 verification 被 ignore 则只提交 petpack + 测试。）

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|---|---|
| 菜单文案/语音/时长 | 1, 3, 4 |
| ≥12 帧边跳边换装顺序 | 2, 4 |
| 不进 random | 1, 4 |
| 尺度/门禁/重生 | 2 |
| 重打包 + 回归绿 | 4 |
| 重建 EXE | 4 |
| 不改播放器 | 全局 |

## Execution Notes

- 当前 `test-medusa-petpack.js` 仍否定 `talent-show`——Task 1 必须先改掉，否则永远绿不了。
- 增量帧并入现有 ~37k alpha 体量带；避免再次全库压到 20k。
- 老婆包不在本分支恢复；勿重新引入 `call-hubby`。
