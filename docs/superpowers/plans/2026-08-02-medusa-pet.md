# 美杜莎桌面宠物 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `feat/medusa-pet` 上将演示基线替换为「美杜莎」角色，交付 `medusa.petpack` 与「美杜莎桌面宠物」便携版 EXE。

**Architecture:** 宠物差异全部落在 `.petpack`（3D 国漫质感动画、`pet.json` 行为/菜单/女声音频）。播放器已具备 `startupGreeting` 与 `speechAudio`，本分支不改播放器核心逻辑。流程：定妆主图 → 派生绿幕条 → 去背切帧 → 组装校验 → 切演示基线 → 客户 EXE 实机验证。老婆完整资料保留在 `feat/laopo-pet`。

**Tech Stack:** Electron 播放器（`src/*-v3.js`）、`desktop-pet-maker` 绿幕条→去背→切帧流水线、内置图像生成、Node 回归测试、`npm run build:customer`、`edge-tts` 生成女声 mp3。

**Spec:** `docs/superpowers/specs/2026-08-02-medusa-pet-design.md`

## Global Constraints

- 分支：`feat/medusa-pet`（已存在，继续使用，不要另开）
- package id / delivery-id：`medusa`
- 程序名：`美杜莎桌面宠物`；宠物名：`美杜莎`
- 性格：`高冷`、`傲娇`、`女王范`；`speechGender`: `female`；启动问候：`本女王来了。`
- 风格：贴近参考图的 3D 国漫质感；形态：人形双腿；禁止常驻蛇尾
- `behavior.random` 禁止调度 `sleep`；`heaven-python` 仅右键触发，不进 random 池
- 不在播放器里按角色名写死菜单；不上传参考图到无关服务
- 切帧失败必须重生成，禁止只擦串帧碎片继续
- 金冠/肩甲/特效须通过左右安全边距与连通块门禁；特效不得导致主体尺度漂移
- **Git：** 用户规则优先——除非用户明确要求，否则跳过所有 `git commit` 步骤
- 每完成一个 Task，跑该 Task 列出的验证命令后再进入下一 Task

## File Structure

| Path | Responsibility |
|---|---|
| `assets/references/medusa/` | 用户参考图（gitignore，已就位） |
| `pets/work/medusa/` | 定妆、绿幕条、透明条、处理后帧、音频源 |
| `pets/library/medusa/` | 解包检查目录（最终 pet 内容） |
| `pets/packages/medusa.petpack` | 演示/客户资源包 |
| `scripts/test-medusa-petpack.js` | 替换 `test-laopo-petpack.js` 在测试入口中的位置 |
| `scripts/test-petpack-security.js` | fixture 改为 `medusa.petpack` |
| `package.json` / `README.md` / `AGENTS.md` / `ASSETS_LICENSE.md` | 基线从 laopo → medusa |
| `.gitignore` | 发布例外改为 `medusa.petpack`；允许 `medusa.ico` / `medusa-tray.png` |
| `docs/prompts/make-medusa-pet.txt` | 可复现制作 prompt |
| `assets/generated/medusa.ico` / `medusa-tray.png` | 客户包图标 |
| `dist/customers/medusa/` | EXE + `build-report.json` |

**不修改（已具备）：** `src/startup-greeting.js`、`src/main-v3.js` 问候逻辑、`speechAudio` 播放路径。

---

### Task 1: 工作区、身份锁与可复现 Prompt

**Files:**
- Create: `pets/work/medusa/source/refs/`（复制参考图）
- Create: `pets/work/medusa/IDENTITY.md`
- Create: `docs/prompts/make-medusa-pet.txt`

**Interfaces:**
- Consumes: `assets/references/medusa/ref-0{1..4}-*.png`
- Produces: 固定 `<IDENTITY>` 文本，供后续全部图像 prompt 复用

- [ ] **Step 1: 创建工作目录并复制参考图**

```powershell
New-Item -ItemType Directory -Force -Path pets/work/medusa/source/refs,
  pets/work/medusa/source/standard,
  pets/work/medusa/source/interactions,
  pets/work/medusa/source/custom,
  pets/work/medusa/processed/frames,
  pets/work/medusa/audio | Out-Null
Copy-Item assets/references/medusa/* pets/work/medusa/source/refs/
```

- [ ] **Step 2: 写 `pets/work/medusa/IDENTITY.md`**

```markdown
# Medusa identity lock

- Adult East-Asian woman, cold regal expression, vivid crimson lips, upswept eyeliner
- Long straight jet-black hair; ornate sharp golden flame/wing crown
- White sheer gown + ornate gold breastplate and shoulder armor
- Gold dangling earrings and delicate necklace
- Human legs (no permanent snake lower body)
- 3D Chinese donghua CGI look: polished metal, fine hair strands, porcelain skin
- Tall upright posture; aloof queen aura
```

- [ ] **Step 3: 写 `docs/prompts/make-medusa-pet.txt`**

内容需包含：名字美杜莎、性格高冷傲娇女王范、程序名美杜莎桌面宠物、delivery-id medusa、3D 国漫风、人形双腿、专属冷笑与七彩吞天蟒、启动问候「本女王来了。」、完整 EXE 交付要求（与 `AGENTS.md` 教程 Prompt 同级完整度）。

- [ ] **Step 4: 验证参考图就位**

```powershell
Get-ChildItem pets/work/medusa/source/refs | Measure-Object | Select-Object -ExpandProperty Count
```

Expected: `4`

---

### Task 2: 定妆主图（3D 国漫）

**Files:**
- Create: `pets/work/medusa/source/standard/master-chroma.png`
- Create: `pets/work/medusa/source/standard/transparent/master.png`（去背后）

**Interfaces:**
- Consumes: `IDENTITY.md` + `source/refs/*`
- Produces: 全身站立定妆图，作为全部动作条的参考主图

- [ ] **Step 1: 生成 master（站立全身三四分之一侧）**

Prompt 核心（附加共享后缀，见下）：

```text
Create one full-body three-quarter standing master of Queen Medusa as a polished 3D Chinese donghua CGI character.
Preserve: long black hair, sharp golden flame crown, white-and-gold regal gown with ornate gold armor, crimson lips, cold aloof expression, human legs, complete silhouette.
Pose upright and commanding, looking slightly toward camera. Center with generous padding.
```

共享风格后缀（**本角色全部条共用，替换默认 soft 2D**）：

```text
Preserve exactly the same character identity: <paste IDENTITY.md bullets>.
Use a polished 3D Chinese donghua CGI look (metallic gold, sheer white fabric, fine hair) with a clear silhouette at 150px display size.
Lay out exactly the requested frames in one horizontal row of equal cells, in temporal order.
Use one complete character per cell, identical scale, camera angle, center alignment, and ground baseline.
Treat every cell as a strict invisible containment box. Keep every visible pixel of crown spikes, armor tips, hair, skirt, and feet inside its own cell.
Reserve at least 12% of each cell width as untouched green gutter on both the left and right, plus generous green padding above and below. A slightly smaller figure is better than any crop or spill.
Keep the torso at the same visual size and screen position in every frame. Do not zoom, pan, recenter, or change camera distance between frames.
No character pixel may cross into a neighboring cell.
Use a perfectly flat solid #00ff00 chroma-key background with no separators.
No crop, text, labels, borders, grid lines, floor, shadows, props, extra characters, motion marks, watermark, or green on the character.
```

使用内置图像生成，并把 4 张参考图 +（后续条）master 作为 reference。

- [ ] **Step 2: 去背 master**

使用项目既定 chroma 参数：

```text
--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

输出：`pets/work/medusa/source/standard/transparent/master.png`

- [ ] **Step 3: 人工核对身份锚点**

核对：金冠、白金礼服、红唇冷颜、人形双腿、无绿边、无蛇尾常驻。不合格则重生 master，不得修像素凑合。

---

### Task 3: 标准五动作绿幕条

**Files:**
- Create: `pets/work/medusa/source/standard/{idle,walk,sit,sleep,reaction}-chroma.png`
- Create: `pets/work/medusa/source/standard/transparent/{idle,walk,sit,sleep,reaction}.png`
- Modify/Create: `pets/work/medusa/processed/frames/<action>/01.png...`

**Interfaces:**
- Consumes: master + IDENTITY
- Produces: 规范化标准五动作帧目录

- [ ] **Step 1: 依次生成五条 chroma**

| 动作 | 帧数 | 要点 |
|---|---|---|
| idle | 4 | 气场呼吸/发丝/裙摆微动，表情仍冷 |
| walk | 6 | 向右踱步，金冠不晃出安全区 |
| sit | 4 | 高冷端坐，末帧可 hold |
| sleep | 4 | 闭目歇息，仍是同一白金礼服 |
| reaction | 4 | 冷傲短反应；躯干尺度锁定（供 50 次连点） |

每条都必须带 Task 2 的 3D 国漫共享后缀，并以 master 为 reference。

- [ ] **Step 2: 去背到 `source/standard/transparent/`**

文件名必须为：`idle.png` `walk.png` `sit.png` `sleep.png` `reaction.png`

- [ ] **Step 3: 切帧门禁**

```powershell
python skills/desktop-pet-maker/scripts/process_animation_strips.py `
  --input-dir pets/work/medusa/source/standard/transparent `
  --output-dir pets/work/medusa/processed/frames `
  --action idle:4 `
  --action walk:6 `
  --action sit:4 `
  --action sleep:4 `
  --action reaction:4
```

Expected: 全部通过。失败则**整条重生成**，禁止擦边继续。

---

### Task 4: 窗口互动动作条

**Files:**
- Create: `pets/work/medusa/source/interactions/{drag,climb,perch,hang,fall,impact,pat-butt}-chroma.png`
- Create: 对应 transparent 条，并追加进同一 `processed/frames`

**Interfaces:**
- Consumes: master + 已规范化标准帧的尺度/基线
- Produces: 互动动作帧，与标准动作同一 canvas

帧数对齐现有 laopo/boss：`drag`/`climb` 6；`perch`/`hang`/`fall`/`impact` 4；`pat-butt` 6。

提示要点：
- `perch`：坐隐形上边框，**屁股贴边**，腿自然下垂，金冠不穿出上安全区过多导致贴边失败
- `hang`：双手抓顶边
- 白裙完整、左右 ≥12% 绿沟、无串帧

- [ ] **Step 1: 逐条生成 chroma 并去背**

把 transparent 文件放入将参与统一 process 的输入目录（可与 standard 合并拷贝到 staging，或按脚本支持的方式追加）。

- [ ] **Step 2: 纳入同一套 `process_animation_strips.py` 规范化**

```powershell
python skills/desktop-pet-maker/scripts/process_animation_strips.py `
  --input-dir pets/work/medusa/source/interactions/transparent `
  --output-dir pets/work/medusa/processed/frames `
  --action drag:6 `
  --action climb:6 `
  --action perch:4 `
  --action hang:4 `
  --action fall:4 `
  --action impact:4 `
  --action pat-butt:6
```

若脚本要求与标准条同一次运行共享度量，则把全部 transparent 放到同一 `--input-dir` 后一次跑完（以 `process_animation_strips.py --help` / 既有 laopo 制作为准）。

- [ ] **Step 3: 失败则重生成该条**

---

### Task 5: 坐边 / 菜单 / 漫游 / 专属动作

**Files（绿幕条 → 透明条 → 帧目录）:**
- `perch-chin-rest`（6 帧）：坐边托腮俯视
- `perch-hair-sweep`（6 帧）：坐边慢扫长发
- `perch-look`（6 帧）：冷眼左右扫视
- `cold-smile`（4–6 帧）：冷笑
- `heaven-python`（6 帧）：七彩吞天蟒短特效
- `kneel-before-me`（6 帧）：抬手示意跪安
- `inspect`（4 帧）：巡视
- `command`（4 帧）：抬手吩咐
- `smirk-line`（4 帧）：短冷笑 pose

**`heaven-python` 硬约束：**
- 蛇影/彩光为短特效，可环绕但不遮挡到看不清主体
- 主体躯干尺度、重心、脚底基线与 idle 锁定
- 不得引入显著独立连通块导致切帧失败；若失败，缩小特效体积后重生整条
- 不进入 `behavior.random`

**最终包中不得出现：**
- `call-hubby`、`kowtow`、`talent-show`、`serve-tea`、`love-you`、`praise`、`encourage`、`perch-hair-flip`、`perch-blow-kiss`

- [ ] **Step 1: 生成上述全部 chroma 条并去背**

- [ ] **Step 2: 全部送入同一套 process 规范化**

- [ ] **Step 3: 检查 contact sheet**

核对：身份一致、无绿边、无尺度漂移、金冠完整、特效条重播无放大/平移感。

---

### Task 6: 女声音频

**Files:**
- Create: `pets/work/medusa/audio/*.mp3`
- 最终复制到 `pets/library/medusa/audio/`

| 文件 | 文本 |
|---|---|
| `cold-smile.mp3` | 哼 |
| `heaven-python.mp3` | 吞天 |
| `kneel-before-me.mp3` | 跪下 |
| `inspect.mp3` | 看你表现 |
| `command.mp3` | 侍奉本座 |
| `smirk-line.mp3` | 有趣 |

- [ ] **Step 1: 用女声 TTS 生成**

```powershell
pip install edge-tts
edge-tts --voice zh-CN-XiaoxiaoNeural --text "哼" --write-media pets/work/medusa/audio/cold-smile.mp3
edge-tts --voice zh-CN-XiaoxiaoNeural --text "吞天" --write-media pets/work/medusa/audio/heaven-python.mp3
edge-tts --voice zh-CN-XiaoxiaoNeural --text "跪下" --write-media pets/work/medusa/audio/kneel-before-me.mp3
edge-tts --voice zh-CN-XiaoxiaoNeural --text "看你表现" --write-media pets/work/medusa/audio/inspect.mp3
edge-tts --voice zh-CN-XiaoxiaoNeural --text "侍奉本座" --write-media pets/work/medusa/audio/command.mp3
edge-tts --voice zh-CN-XiaoxiaoNeural --text "有趣" --write-media pets/work/medusa/audio/smirk-line.mp3
```

- [ ] **Step 2: 试听确认是女声且无过长静音**

---

### Task 7: 组装 `pets/library/medusa` 与 `pet.json`

**Files:**
- Create: `pets/library/medusa/**`
- Create: `pets/library/medusa/pet.json`
- Create: `pets/library/medusa/preview.png`（从 master/idle 生成）

**Interfaces:**
- Consumes: `processed/frames/**`、`audio/*.mp3`
- Produces: 可被 `petpack_tool.py validate` 通过的完整宠物目录

- [ ] **Step 1: 复制规范化帧到 `animations/<action>/01.png...`**

- [ ] **Step 2: 复制音频到 `audio/*.mp3`**

- [ ] **Step 3: 写 `pet.json`**

```json
{
  "schemaVersion": 1,
  "packageVersion": "0.1.0",
  "id": "medusa",
  "name": "美杜莎",
  "description": "高冷傲娇的美杜莎女王桌宠：直立待机与踱步，会冷笑、显威七彩吞天蟒、令你跪安。",
  "personality": ["高冷", "傲娇", "女王范"],
  "speechGender": "female",
  "startupGreeting": "本女王来了。",
  "defaultSize": "small",
  "preview": "preview.png",
  "normalizationMetric": "alpha-area-v1",
  "animations": {
    "idle": { "frames": ["animations/idle/01.png", "animations/idle/02.png", "animations/idle/03.png", "animations/idle/04.png"], "durations": [420, 300, 260, 420], "loop": true, "scale": 1 },
    "walk": { "frames": ["animations/walk/01.png", "animations/walk/02.png", "animations/walk/03.png", "animations/walk/04.png", "animations/walk/05.png", "animations/walk/06.png"], "durations": [140, 140, 140, 140, 140, 140], "loop": true, "scale": 1 },
    "sit": { "frames": ["animations/sit/01.png", "animations/sit/02.png", "animations/sit/03.png", "animations/sit/04.png"], "durations": [220, 220, 260, 2000], "loop": false, "holdLastFrame": true, "scale": 1 },
    "sleep": { "frames": ["animations/sleep/01.png", "animations/sleep/02.png", "animations/sleep/03.png", "animations/sleep/04.png"], "durations": [650, 650, 420, 650], "loop": true, "scale": 1 },
    "reaction": { "frames": ["animations/reaction/01.png", "animations/reaction/02.png", "animations/reaction/03.png", "animations/reaction/04.png"], "durations": [160, 180, 220, 1500], "loop": false, "holdLastFrame": true, "scale": 1 },
    "drag": { "frames": ["animations/drag/01.png", "animations/drag/02.png", "animations/drag/03.png", "animations/drag/04.png", "animations/drag/05.png", "animations/drag/06.png"], "durations": [120, 120, 120, 120, 120, 120], "loop": true, "scale": 1 },
    "climb": { "frames": ["animations/climb/01.png", "animations/climb/02.png", "animations/climb/03.png", "animations/climb/04.png", "animations/climb/05.png", "animations/climb/06.png"], "durations": [140, 140, 140, 140, 140, 140], "loop": true, "scale": 1 },
    "perch": { "frames": ["animations/perch/01.png", "animations/perch/02.png", "animations/perch/03.png", "animations/perch/04.png"], "durations": [220, 220, 220, 1800], "loop": true, "scale": 1 },
    "perch-chin-rest": { "frames": ["animations/perch-chin-rest/01.png", "animations/perch-chin-rest/02.png", "animations/perch-chin-rest/03.png", "animations/perch-chin-rest/04.png", "animations/perch-chin-rest/05.png", "animations/perch-chin-rest/06.png"], "durations": [200, 220, 240, 260, 280, 600], "loop": false, "holdLastFrame": true, "scale": 1 },
    "perch-hair-sweep": { "frames": ["animations/perch-hair-sweep/01.png", "animations/perch-hair-sweep/02.png", "animations/perch-hair-sweep/03.png", "animations/perch-hair-sweep/04.png", "animations/perch-hair-sweep/05.png", "animations/perch-hair-sweep/06.png"], "durations": [200, 220, 240, 260, 280, 600], "loop": false, "holdLastFrame": true, "scale": 1 },
    "perch-look": { "frames": ["animations/perch-look/01.png", "animations/perch-look/02.png", "animations/perch-look/03.png", "animations/perch-look/04.png", "animations/perch-look/05.png", "animations/perch-look/06.png"], "durations": [200, 220, 200, 220, 200, 400], "loop": false, "holdLastFrame": true, "scale": 1 },
    "hang": { "frames": ["animations/hang/01.png", "animations/hang/02.png", "animations/hang/03.png", "animations/hang/04.png"], "durations": [220, 220, 220, 1800], "loop": true, "scale": 1 },
    "fall": { "frames": ["animations/fall/01.png", "animations/fall/02.png", "animations/fall/03.png", "animations/fall/04.png"], "durations": [120, 120, 120, 120], "loop": true, "scale": 1 },
    "impact": { "frames": ["animations/impact/01.png", "animations/impact/02.png", "animations/impact/03.png", "animations/impact/04.png"], "durations": [140, 160, 180, 900], "loop": false, "holdLastFrame": true, "scale": 1 },
    "pat-butt": { "frames": ["animations/pat-butt/01.png", "animations/pat-butt/02.png", "animations/pat-butt/03.png", "animations/pat-butt/04.png", "animations/pat-butt/05.png", "animations/pat-butt/06.png"], "durations": [140, 140, 160, 160, 160, 700], "loop": false, "holdLastFrame": true, "scale": 1 },
    "cold-smile": { "frames": ["animations/cold-smile/01.png", "animations/cold-smile/02.png", "animations/cold-smile/03.png", "animations/cold-smile/04.png", "animations/cold-smile/05.png", "animations/cold-smile/06.png"], "durations": [180, 200, 220, 260, 400, 700], "loop": false, "holdLastFrame": true, "scale": 1 },
    "heaven-python": { "frames": ["animations/heaven-python/01.png", "animations/heaven-python/02.png", "animations/heaven-python/03.png", "animations/heaven-python/04.png", "animations/heaven-python/05.png", "animations/heaven-python/06.png"], "durations": [120, 140, 160, 180, 200, 500], "loop": false, "holdLastFrame": true, "scale": 1 },
    "kneel-before-me": { "frames": ["animations/kneel-before-me/01.png", "animations/kneel-before-me/02.png", "animations/kneel-before-me/03.png", "animations/kneel-before-me/04.png", "animations/kneel-before-me/05.png", "animations/kneel-before-me/06.png"], "durations": [180, 200, 220, 260, 400, 800], "loop": false, "holdLastFrame": true, "scale": 1 },
    "inspect": { "frames": ["animations/inspect/01.png", "animations/inspect/02.png", "animations/inspect/03.png", "animations/inspect/04.png"], "durations": [200, 240, 400, 800], "loop": false, "holdLastFrame": true, "scale": 1 },
    "command": { "frames": ["animations/command/01.png", "animations/command/02.png", "animations/command/03.png", "animations/command/04.png"], "durations": [200, 240, 400, 800], "loop": false, "holdLastFrame": true, "scale": 1 },
    "smirk-line": { "frames": ["animations/smirk-line/01.png", "animations/smirk-line/02.png", "animations/smirk-line/03.png", "animations/smirk-line/04.png"], "durations": [200, 240, 400, 800], "loop": false, "holdLastFrame": true, "scale": 1 }
  },
  "behavior": {
    "random": [
      { "state": "walk", "weight": 34, "minDuration": 1500, "maxDuration": 4200 },
      { "state": "inspect", "weight": 16, "minDuration": 2200, "maxDuration": 3400, "message": "看你表现", "speech": "看你表现", "speechAudio": "audio/inspect.mp3" },
      { "state": "command", "weight": 14, "minDuration": 2200, "maxDuration": 3400, "message": "侍奉本座", "speech": "侍奉本座", "speechAudio": "audio/command.mp3" },
      { "state": "smirk-line", "weight": 12, "minDuration": 2200, "maxDuration": 3400, "message": "有趣", "speech": "有趣", "speechAudio": "audio/smirk-line.mp3" },
      { "state": "sit", "weight": 12, "minDuration": 4200, "maxDuration": 6200 },
      { "state": "reaction", "weight": 6, "minDuration": 2200, "maxDuration": 3400 },
      { "state": "cold-smile", "weight": 6, "minDuration": 2200, "maxDuration": 3400, "message": "哼。", "speech": "哼", "speechAudio": "audio/cold-smile.mp3" }
    ],
    "perched": [
      { "state": "perch-chin-rest", "weight": 40, "minDuration": 2800, "maxDuration": 4200 },
      { "state": "perch-hair-sweep", "weight": 40, "minDuration": 2800, "maxDuration": 4200 },
      { "state": "perch-look", "weight": 20, "minDuration": 2000, "maxDuration": 3600 }
    ]
  },
  "interactionActions": {
    "drag": { "action": "drag" },
    "climb": { "action": "climb", "anchor": { "x": 0.84, "y": 0.55 } },
    "perch": { "action": "perch", "anchor": { "x": 0.5, "y": 0.52 } },
    "hang": { "action": "hang", "anchor": { "x": 0.5, "y": 0.05 } },
    "fall": { "action": "fall" },
    "impact": { "action": "impact" },
    "recover": { "action": "pat-butt" }
  },
  "contextMenuActions": [
    {
      "id": "cold-smile",
      "label": "冷笑",
      "action": "cold-smile",
      "message": "哼。",
      "speech": "哼",
      "speechAudio": "audio/cold-smile.mp3",
      "duration": 3000
    },
    {
      "id": "heaven-python",
      "label": "七彩吞天蟒",
      "action": "heaven-python",
      "message": "吞天。",
      "speech": "吞天",
      "speechAudio": "audio/heaven-python.mp3",
      "duration": 3600
    },
    {
      "id": "kneel-before-me",
      "label": "跪安",
      "action": "kneel-before-me",
      "message": "跪下。",
      "speech": "跪下",
      "speechAudio": "audio/kneel-before-me.mp3",
      "duration": 3200
    }
  ]
}
```

`perch` 锚点可按实帧微调，但必须通过坐边贴边观感检查。

- [ ] **Step 4: 校验目录**

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/medusa
```

Expected: PASS

---

### Task 8: 打包 petpack、回归测试与基线切换

**Files:**
- Create: `pets/packages/medusa.petpack`
- Create: `scripts/test-medusa-petpack.js`
- Modify: `scripts/test-petpack-security.js` fixture → `medusa.petpack`
- Modify: `package.json`（scripts / build.files / icon）
- Modify: `.gitignore`（packages 例外与 generated 例外）
- Modify: `README.md`、`AGENTS.md`、`ASSETS_LICENSE.md` 演示说明
- 本分支演示位不再要求 `laopo.petpack` 存在于 `pets/packages/`（可保留本地文件，但 gitignore/build 不再指向它）

- [ ] **Step 1: 打包并校验**

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/medusa pets/packages/medusa.petpack
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/medusa.petpack
```

Expected: PASS

- [ ] **Step 2: 写 `scripts/test-medusa-petpack.js`**

```js
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const petpackPath = path.join(__dirname, '..', 'pets', 'packages', 'medusa.petpack');
assert.ok(fs.existsSync(petpackPath), 'medusa.petpack missing');

const zip = new AdmZip(petpackPath);
const manifest = JSON.parse(zip.readAsText('pet.json'));

assert.strictEqual(manifest.id, 'medusa');
assert.strictEqual(manifest.name, '美杜莎');
assert.strictEqual(manifest.speechGender, 'female');
assert.strictEqual(manifest.startupGreeting, '本女王来了。');
assert.ok(!manifest.behavior.random.some((item) => item.state === 'sleep'), 'behavior.random must not schedule sleep');
assert.ok(!manifest.behavior.random.some((item) => item.state === 'heaven-python'), 'heaven-python must not be in random pool');

const menu = Object.fromEntries(manifest.contextMenuActions.map((item) => [item.id, item]));
assert.ok(menu['cold-smile'], 'cold-smile required');
assert.strictEqual(menu['cold-smile'].message, '哼。');
assert.strictEqual(menu['cold-smile'].speechAudio, 'audio/cold-smile.mp3');
assert.ok(menu['heaven-python'], 'heaven-python required');
assert.strictEqual(menu['heaven-python'].message, '吞天。');
assert.strictEqual(menu['heaven-python'].speechAudio, 'audio/heaven-python.mp3');
assert.ok(menu['kneel-before-me'], 'kneel-before-me required');
assert.strictEqual(menu['kneel-before-me'].message, '跪下。');

assert.ok(!menu['call-hubby'], 'laopo call-hubby must not exist');
assert.ok(!menu.kowtow, 'laopo kowtow must not exist');
assert.ok(!menu['talent-show'], 'laopo talent-show must not exist');
assert.ok(!manifest.animations['call-hubby']);
assert.ok(!manifest.animations['talent-show']);
assert.ok(!manifest.animations['serve-tea']);

for (const action of ['perch-chin-rest', 'perch-hair-sweep', 'perch-look']) {
  assert.ok(manifest.animations[action], `missing ${action}`);
  assert.ok(manifest.behavior.perched.some((item) => item.state === action), `perched missing ${action}`);
}

const randomByState = Object.fromEntries(manifest.behavior.random.map((item) => [item.state, item]));
for (const [state, message, speech, speechAudio] of [
  ['inspect', '看你表现', '看你表现', 'audio/inspect.mp3'],
  ['command', '侍奉本座', '侍奉本座', 'audio/command.mp3'],
  ['smirk-line', '有趣', '有趣', 'audio/smirk-line.mp3'],
]) {
  const item = randomByState[state];
  assert.ok(item, `${state} should appear in roaming random behavior`);
  assert.strictEqual(item.message, message);
  assert.strictEqual(item.speech, speech);
  assert.strictEqual(item.speechAudio, speechAudio);
}

for (const action of [
  'idle', 'walk', 'sit', 'sleep', 'reaction',
  'climb', 'perch', 'hang', 'fall', 'impact', 'pat-butt',
  'cold-smile', 'heaven-python', 'kneel-before-me',
  'inspect', 'command', 'smirk-line',
]) {
  assert.ok(manifest.animations[action], `missing animation ${action}`);
  assert.ok(manifest.animations[action].frames.length >= 4, `${action} needs enough frames`);
}

console.log('medusa petpack regression checks passed');
```

- [ ] **Step 3: 更新 `package.json`**

将下列片段替换为 medusa 版本：

```json
"test:js": "... node scripts/test-medusa-petpack.js && node scripts/test-startup-greeting.js",
"validate:demo": "python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/medusa.petpack",
"build:medusa": "node scripts/build-customer.js --pet pets/packages/medusa.petpack --name \"美杜莎桌面宠物\" --delivery-id medusa"
```

删除或停用本分支的 `build:laopo`。  
`build.win.icon` → `assets/generated/medusa.ico`  
`build.files` 中 tray/petpack → `medusa-tray.png` / `medusa.petpack`

- [ ] **Step 4: 更新 `.gitignore`**

```gitignore
/pets/packages/*
!/pets/packages/medusa.petpack

/assets/generated/*
!/assets/generated/medusa.ico
!/assets/generated/medusa-tray.png
```

- [ ] **Step 5: 更新 `scripts/test-petpack-security.js` fixture 路径为 `medusa.petpack`**

- [ ] **Step 6: 更新 README / AGENTS / ASSETS_LICENSE 演示基线描述为美杜莎**

- [ ] **Step 7: 跑回归**

```powershell
node scripts/test-medusa-petpack.js
node scripts/test-petpack-security.js
npm run validate:demo
```

Expected: 全部 PASS

---

### Task 9: 图标与托盘图

**Files:**
- Create: `assets/generated/medusa.ico`
- Create: `assets/generated/medusa-tray.png`

- [ ] **Step 1: 从 preview/master 生成托盘 PNG（建议 32–64px 清晰金冠剪影）与 ICO**

可用 ImageMagick / Pillow；若环境已有 laopo 图标生成脚本则复用同一流程，仅改输入输出路径。

- [ ] **Step 2: 确认 `package.json` 已指向新图标**

```powershell
Test-Path assets/generated/medusa.ico
Test-Path assets/generated/medusa-tray.png
```

Expected: 均为 `True`

---

### Task 10: 客户 EXE 构建与实机验证

**Files:**
- Create: `dist/customers/medusa/**`（由 build 脚本输出）
- Create: `outputs/medusa-verification-report.json`（记录验证结果）

- [ ] **Step 1: 发布前门禁**

```powershell
node scripts/test-renderer-interaction.js
python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v
npm test
```

Expected: 全部 PASS。任一失败禁止打包。

- [ ] **Step 2: 构建客户包**

```powershell
npm run build:customer -- --pet pets/packages/medusa.petpack --name "美杜莎桌面宠物" --delivery-id medusa
```

或：

```powershell
npm run build:medusa
```

Expected: 产出 EXE 与 `build-report.json`。

- [ ] **Step 3: 实际启动 EXE 并验证清单**

| 项 | 期望 |
|---|---|
| 启动问候 | 「本女王来了。」 |
| 待机/散步 | 直立，身份稳定 |
| 右键 | 冷笑 / 七彩吞天蟒 / 跪安 |
| 漫游台词 | 看你表现 / 侍奉本座 / 有趣 |
| 坐边 | 托腮 / 扫发 / 扫视，屁股贴边 |
| 女声 | 关键台词为女声 |
| 透明穿透 | 透明像素可点到后方应用 |
| 连点 50 次 | 无放大/平移；静止点击不拖窗 |
| 吞天蟒 | 短特效后恢复，无尺度跳动 |
| 托盘/退出/独立数据目录 | 正常 |

- [ ] **Step 4: 写验证报告**

将已验证/未验证项写入 `outputs/medusa-verification-report.json`，并向用户交付：EXE 路径、`build-report.json`、验证摘要。明确未做：数字签名、商店上架。

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|---|---|
| 名字/程序名/id/性格/3D 国漫/人形 | 1–2 |
| 定妆再派生 | 2–3 |
| 标准五动作 + sleep 不进 random | 3, 7–8 |
| 窗口互动保留重绘 | 4, 7 |
| 坐边三动作 | 5, 7–8 |
| 冷笑 + 吞天蟒 + 跪安 | 5–8 |
| 漫游三台词与权重 | 7–8 |
| 女声与 startupGreeting | 6–8 |
| 基线切换 gitignore/package/docs | 8–9 |
| 客户 EXE 与实机验收 | 10 |
| 非目标：不改播放器角色分支、无常驻蛇尾 | 全局约束 + Task 2/5 |

## Execution Notes

- 图像生成是最长路径；3D 国漫风预期多轮重生，尤其金冠与 `heaven-python`。
- 切基线必须在 petpack 校验通过后做，避免半替换导致 `npm test` 红灯。
- 老婆资料回退路径：`git checkout feat/laopo-pet`（含 `072527f` 及后续）。
