# 兄弟判官照片级写实全套重做 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用用户原片把兄弟判官全套动画改为照片级写实，新增磕头动画，打包并交付可双击运行的专属 EXE。

**Architecture:** 先用两张原片锁定身份并生成定妆主图（用户确认门禁），再以主图为锚点批量生成绿幕动画条；经 chroma 去背、`process_animation_strips.py` 安全切帧与归一化后写入 `pets/library/brother-judge/`，更新 `pet.json` 的 `kowtow`，重打包 `.petpack` 并用 `npm run build:customer` 交付。

**Tech Stack:** Cursor/Grok Imagine (`GenerateImage` / 参考图编辑)、PNG chroma-key、Pillow `process_animation_strips.py`、`petpack_tool.py`、Electron 客户构建 `scripts/build-customer.js`

## Global Constraints

- 脸：贴近 `ref-face-closeup.png`（银色细圆框眼镜、短发、浅胡茬、五官）
- 帽：贴近 `ref-portrait.png` 的黑色判官帽 + 白珠边长翅
- 服装：白背心 + 深色大裤衩 + 人字拖（不要实拍工装衬衫）
- 风格：照片级写实；禁止回到当前动漫脸
- 原片只读：保存在 `pets/work/brother-judge/source/refs/`，永不覆盖
- 新生成原文归档到 `pets/work/brother-judge/source/realistic/`，不覆盖 `raw/` 旧动漫条
- 切帧失败必须重生成条，禁止只擦越界碎片继续
- 文案 / watch 词库保持当前分支已改内容，不回退
- 交付默认包含专属 EXE，不只交付 `.petpack`

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `pets/work/brother-judge/source/refs/ref-face-closeup.png` | 脸部身份锚点（已存在） |
| `pets/work/brother-judge/source/refs/ref-portrait.png` | 戴帽表情/帽饰参考（已存在） |
| `pets/work/brother-judge/source/refs/master-realistic.png` | 用户确认后的定妆主图 |
| `pets/work/brother-judge/source/realistic/*-chroma.png` | 新写实绿幕条原文 |
| `pets/work/brother-judge/source/realistic/transparent/` | 去背后透明条 |
| `pets/work/brother-judge/source/realistic/processed/` | 切帧归一化输出 |
| `pets/work/brother-judge/IDENTITY.md` | 稳定身份描述（供所有 prompt 复用） |
| `pets/library/brother-judge/animations/**` | 播放器实际使用的帧 |
| `pets/library/brother-judge/pet.json` | 清单；新增 `kowtow`，磕头菜单改指向它 |
| `pets/packages/brother-judge.petpack` | 打包产物 |
| `delivery/brother-judge/` | 客户 EXE 与 `build-report.json` |

---

### Task 1: 身份卡 + 定妆主图（用户确认门禁）

**Files:**
- Create: `pets/work/brother-judge/IDENTITY.md`
- Create: `pets/work/brother-judge/source/refs/master-realistic.png`
- Create: `pets/work/brother-judge/source/realistic/generated-originals/master-realistic-*.png`（归档，不覆盖）

**Interfaces:**
- Consumes: `ref-face-closeup.png`, `ref-portrait.png`
- Produces: 已确认的 `master-realistic.png` + `IDENTITY.md` 文本（后续 Task 全部复用）

- [ ] **Step 1: 写 IDENTITY.md**

写入并保存：

```markdown
# 兄弟判官 IDENTITY

- 人物：年轻东亚男性，短黑发，浅胡茬，银色细圆框眼镜
- 脸：以 ref-face-closeup 为准；笑容/表情可参考 ref-portrait
- 帽：黑色判官官帽，两侧长弯帽翅，帽翅边缘白色珠饰
- 服：白色背心 + 深色宽松大裤衩 + 人字拖
- 道具：可选判官笔，不挡脸
- 风格：照片级写实，皮肤与布料纹理清晰，小尺寸仍可辨认是同一人
- 禁止：动漫大眼、工装衬衫、黑粗框方眼镜、文字、阴影底板、地面
```

- [ ] **Step 2: 生成定妆主图**

用图像生成工具，同时附上两张原片作参考。Prompt：

```text
Photorealistic full-body three-quarter standing desktop-pet master of the SAME young East Asian man from the reference face close-up.
Exact face match: short black hair, light stubble, thin silver round glasses, same eyes nose mouth.
Wear a traditional Chinese judge hat (black guanmao with long curved side wings edged in white beads) like the hat reference.
Outfit: white tank top, dark loose shorts, flip-flops. Optional judge brush in one hand, not covering face.
Solid flat #00FF00 background, generous padding, no text, no shadow floor, no border.
Photoreal skin and fabric detail, not anime, not cartoon.
```

保存生成原文到 `source/realistic/generated-originals/`，再复制工作文件到 `source/refs/master-realistic.png`。

- [ ] **Step 3: 人工门禁 — 停下来让用户确认主图**

向用户展示 `master-realistic.png`，明确询问是否认得出是本人、帽翅与服装是否正确。  
**未获用户确认前，禁止进入 Task 2。**

- [ ] **Step 4: 提交身份卡（主图若在 gitignore 的 work 目录则只提交 IDENTITY 若可跟踪；work 被 ignore 时本步可跳过 git）**

`pets/work/` 被 `.gitignore` 忽略。若无法提交主图，在进度说明中记录本地路径即可。可提交的文档若放到 `pets/library/brother-judge/DESIGN.md`，复制 IDENTITY 摘要过去：

```powershell
Copy-Item pets/work/brother-judge/IDENTITY.md pets/library/brother-judge/DESIGN.md -Force
git add pets/library/brother-judge/DESIGN.md
git commit -m "docs: lock brother-judge photoreal identity for redesign"
```

---

### Task 2: 标准动作绿幕条（idle/walk/sit/sleep/reaction）

**Files:**
- Create: `pets/work/brother-judge/source/realistic/{idle,walk,sit,sleep,reaction}-chroma.png`

**Interfaces:**
- Consumes: `master-realistic.png`, `IDENTITY.md`, `skills/desktop-pet-maker/references/image-prompts.md`
- Produces: 5 条写实绿幕条（帧数 4/6/4/4/4）

- [ ] **Step 1: 准备共享后缀**

每个 strip prompt 末尾必须带：

```text
Preserve exactly this identity: photoreal young East Asian man, short black hair, light stubble, thin silver round glasses, black judge hat with long white-beaded wings, white tank top, dark loose shorts, flip-flops.
Use photorealistic rendering (not anime). Same face as the master reference in every cell.
Lay out exactly the requested frames in one horizontal row of equal cells.
One complete person per cell, identical scale, camera, center, foot baseline.
Reserve at least 12% green gutter left and right in every cell; generous green padding top/bottom.
Solid flat #00FF00 background. No text, labels, borders, floor shadows, motion lines, or green on the person.
Hat wings and flip-flops must stay fully inside each cell (no flat cuts).
```

- [ ] **Step 2: 逐条生成（每条一次调用，附 master + 两张原片）**

| 文件 | 帧 | 动作要点 |
| --- | --- | --- |
| `idle-chroma.png` | 4 | 站立微呼吸/眨眼循环 |
| `walk-chroma.png` | 6 | 朝右走路循环 |
| `sit-chroma.png` | 4 | 站→坐下，末帧 hold |
| `sleep-chroma.png` | 4 | 已躺睡循环，无 Z 字 |
| `reaction-chroma.png` | 4 | 吐槽/挥判官笔，躯干尺度锁定防漂移 |

任一失败（脸漂、串帧、断帽翅）整条重生成，不局部擦除。

- [ ] **Step 3: 目视检查五条联系感**

打开每条 chroma，确认同一人、同一服装、绿幕平整。通过后进入 Task 3。

---

### Task 3: 窗口互动 + 跪爬绿幕条

**Files:**
- Create: `pets/work/brother-judge/source/realistic/{drag,climb,perch,hang,fall,impact,recover,crawl}-chroma.png`

**Interfaces:**
- Consumes: 已确认 master + Task 2 已通过的标准条作风格锚
- Produces: 8 条互动绿幕条（帧数 6/6/4/4/4/4/6/6）

- [ ] **Step 1: 按同一共享后缀与身份生成**

| 文件 | 帧 | 动作要点 |
| --- | --- | --- |
| `drag-chroma.png` | 6 | 被拖拽/悬空挣扎循环 |
| `climb-chroma.png` | 6 | 侧边攀爬循环 |
| `perch-chroma.png` | 4 | 坐在上边框 |
| `hang-chroma.png` | 4 | 下边框吊挂 |
| `fall-chroma.png` | 4 | 坠落循环 |
| `impact-chroma.png` | 4 | 落地冲击 |
| `recover-chroma.png` | 6 | 落地后爬起恢复 |
| `crawl-chroma.png` | 6 | 跪爬朝右循环 |

- [ ] **Step 2: 目视检查**

帽翅、人字拖、脸在极端姿势下仍可辨认；失败整条重做。

---

### Task 4: 磕头条 + pet.json 接线

**Files:**
- Create: `pets/work/brother-judge/source/realistic/kowtow-chroma.png`
- Modify: `pets/library/brother-judge/pet.json`（`animations.kowtow` + 菜单 action）

**Interfaces:**
- Consumes: master；参考 laopo `kowtow` 帧时序（起身→俯身→磕头→起）
- Produces: `kowtow` 6 帧绿幕条；清单字段可被播放器加载

- [ ] **Step 1: 生成 kowtow-chroma.png（6 帧）**

```text
Create exactly six photoreal frames of the same judge character performing a Chinese kowtow bow:
stand, bend, kneel-forward, forehead-near-ground hold, rise, return upright.
Keep hat wings fully visible and deform naturally with head motion.
No speech bubble, no text. Same identity and #00FF00 strip rules as other actions.
```

- [ ] **Step 2: 更新 pet.json 动画与菜单**

在 `animations` 中新增（与现有风格一致）：

```json
"kowtow": {
  "frames": [
    "animations/kowtow/01.png",
    "animations/kowtow/02.png",
    "animations/kowtow/03.png",
    "animations/kowtow/04.png",
    "animations/kowtow/05.png",
    "animations/kowtow/06.png"
  ],
  "durations": [180, 180, 220, 500, 220, 900],
  "loop": false,
  "holdLastFrame": true,
  "scale": 1
}
```

将 contextMenu 磕头改为：

```json
{
  "id": "kowtow",
  "label": "磕头",
  "action": "kowtow",
  "duration": 3600
}
```

（无 `message`、无 `speech`。）

- [ ] **Step 3: 语法/结构自检**

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('pets/library/brother-judge/pet.json','utf8')); console.log('ok')"
```

Expected: `ok`

---

### Task 5: 去背、切帧、入库、打包

**Files:**
- Create: `pets/work/brother-judge/source/realistic/transparent/*.png`
- Create: `pets/work/brother-judge/source/realistic/processed/<action>/*.png`
- Replace: `pets/library/brother-judge/animations/**`
- Replace: `pets/library/brother-judge/preview.png`（用 idle/01）
- Replace: `pets/packages/brother-judge.petpack`

**Interfaces:**
- Consumes: 全部 `*-chroma.png`
- Produces: 通过安全门禁的库内帧 + 校验通过的 petpack

- [ ] **Step 1: chroma 去背**

对 `source/realistic/` 下每条 `*-chroma.png` 使用项目既定参数：

```text
--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

输出到 `source/realistic/transparent/<action>.png`（工具名以本机已安装的 `imagegen`/既有 chroma helper 为准；与 laopo/boss 历史制作命令一致）。

- [ ] **Step 2: 安全切帧**

```powershell
python skills/desktop-pet-maker/scripts/process_animation_strips.py `
  --input-dir pets/work/brother-judge/source/realistic/transparent `
  --output-dir pets/work/brother-judge/source/realistic/processed `
  --action idle:4 --action walk:6 --action sit:4 --action sleep:4 --action reaction:4 `
  --action drag:6 --action climb:6 --action perch:4 --action hang:4 --action fall:4 `
  --action impact:4 --action recover:6 --action crawl:6 --action kowtow:6
```

Expected: 全部 action 通过；任一条失败则回到对应 Task 重生成该条，禁止擦碎片放行。

- [ ] **Step 3: 复制入库并更新 preview**

```powershell
$actions = 'idle','walk','sit','sleep','reaction','drag','climb','perch','hang','fall','impact','recover','crawl','kowtow'
foreach ($a in $actions) {
  New-Item -ItemType Directory -Force -Path "pets/library/brother-judge/animations/$a" | Out-Null
  Copy-Item "pets/work/brother-judge/source/realistic/processed/$a/*" "pets/library/brother-judge/animations/$a/" -Force
}
Copy-Item "pets/library/brother-judge/animations/idle/01.png" "pets/library/brother-judge/preview.png" -Force
```

- [ ] **Step 4: 校验与打包**

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/brother-judge
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/brother-judge pets/packages/brother-judge.petpack
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/brother-judge.petpack
python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v
node scripts/test-renderer-interaction.js
```

Expected: 全部通过。

- [ ] **Step 5: Commit**

```powershell
git add pets/library/brother-judge pets/packages/brother-judge.petpack
git commit -m "feat: photoreal brother-judge frames with kowtow"
```

---

### Task 6: 客户 EXE 构建与实机抽查

**Files:**
- Create/Update: `delivery/brother-judge/`（或 build-customer 默认输出目录）
- Create/Update: `build-report.json`

**Interfaces:**
- Consumes: 校验通过的 `pets/packages/brother-judge.petpack`
- Produces: 可双击 EXE + 验证记录

- [ ] **Step 1: 构建**

```powershell
npm run build:customer -- --pet pets/packages/brother-judge.petpack --name "兄弟判官桌面宠物" --delivery-id brother-judge
```

Expected: 生成便携 EXE 与报告。

- [ ] **Step 2: 实机启动抽查清单**

- [ ] 双击 EXE 宠物直接出现（独立 userData）
- [ ] idle/walk/sit/sleep/reaction 为写实脸，可认出原片本人
- [ ] 右键「叫爸」气泡「爸」；「磕头」无文案但播 kowtow；「睡会儿」正常
- [ ] 透明像素鼠标穿透；静止连点无放大平移
- [ ] 漫游、左右朝向、跪爬模式、托盘退出

- [ ] **Step 3: 写验证结果并提交报告**

在 `build-report.json` 或交付说明中列出已验证 / 未验证项（含数字签名等未完成项）。

```powershell
git add delivery/brother-judge build-report.json 2>$null
git commit -m "build: brother-judge photoreal customer delivery"
```

---

## Spec coverage self-review

| Spec 要求 | Task |
| --- | --- |
| 照片级写实 + 脸按特写 + 帽按戴帽照 | Task 1–3 |
| 服装白背心大裤衩人字拖 | Task 1 IDENTITY + 所有 prompt |
| 方案 A 主图门禁 | Task 1 Step 3 |
| 全套动作重做 | Task 2–3 |
| 新增 kowtow 并接线菜单 | Task 4 |
| 安全切帧 / 归一化 / 不擦碎片 | Task 5 |
| 保留文案与 watch | Task 4 不改文案字段 |
| petpack + 客户 EXE 交付 | Task 5–6 |
| 原片不覆盖、分目录 | Global + Task 1/5 路径 |

## Placeholder scan

无 TBD/TODO；命令与 JSON 均为完整内容。
