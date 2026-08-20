# Task 2 Report: 标准动作绿幕条（idle/walk/sit/sleep/reaction）

**Date:** 2026-08-12  
**Branch:** `feature/brother-judge-bubble-copy`  
**Status:** DONE + FIX applied (walk/sleep regenerated 2026-08-12)  
**Commits:** none（`pets/work` 为 gitignored 二进制产出；未改 `pet.json` / library / `main-v3.js`）

## Inputs

- PRIMARY: `pets/work/brother-judge/source/refs/master-realistic.png`（USER-CONFIRMED）
- Face: `pets/work/brother-judge/source/refs/ref-face-closeup.png`
- Portrait: `pets/work/brother-judge/source/refs/ref-portrait.png`
- Identity: `pets/work/brother-judge/IDENTITY.md`
- Shared suffix: verbatim from `task-2-brief.md`（写实身份 + #00FF00 + 12% 侧边 gutter + 同尺度/同基线）

## Method

- 每条 `GenerateImage` 一次调用，`reference_image_paths` 均附 master + face-closeup + portrait。
- 帽翅按 brief：相对 master 偏短翅，生成时偏好 portrait 式更长白珠边帽翅。
- 失败策略：整条重生成，不局部擦除。
- 产出落盘：`pets/work/brother-judge/source/realistic/*-chroma.png`
- 原件归档：`pets/work/brother-judge/source/realistic/generated-originals/*-chroma-20260812-145942.png`

## Per-strip results

| Strip | Path | Frame intent | Visual check | Notes |
| --- | --- | --- | --- | --- |
| idle | `pets/work/brother-judge/source/realistic/idle-chroma.png` | 4（微呼吸/眨眼） | YES — pass | 站立四格；眨眼/微头动可见；长白珠边帽翅；绿幕平整；无明显串帧/断翅 |
| walk | `pets/work/brother-judge/source/realistic/walk-chroma.png` | 6（朝右走） | YES — pass | 六格朝右交替步态；尺度大体一致；帽翅在格内 |
| sit | `pets/work/brother-judge/source/realistic/sit-chroma.png` | 4（站→坐，末帧 hold） | YES — pass | 站→下蹲→近坐→坐定 hold；服装/脸一致 |
| sleep | `pets/work/brother-judge/source/realistic/sleep-chroma.png` | 4（已躺睡循环，无 Z） | YES — pass（1 次重生成后） | 首版为俯视且四帧几乎全同 → **整条重生成**；现为侧卧胎儿姿势，四格循环可用。帧间差异仍偏弱（呼吸幅度小） |
| reaction | `pets/work/brother-judge/source/realistic/reaction-chroma.png` | 4（判官笔吐槽，躯干锁定） | YES — pass | 举笔/前指/喊话/抱臂吐槽；躯干尺度大体锁定；无工装衬衫 |

## Cross-strip identity check

- 写实东亚男性、短黑发、细框眼镜、白背心、深色短裤、人字拖：五条一致。
- 无动漫大眼、无工装衬衫。
- 帽翅：普遍长于 master，带白珠边（符合 portrait 偏好）。
- 绿幕：实心亮绿；未见明显文字/地面重影底板。

## Concerns / follow-ups for Task 3

1. **sleep 帧间差异偏弱**：侧卧姿态正确，但四帧几乎静止；切帧后若循环“无呼吸感”，可再整条重生或在切帧阶段接受近静止 sleep。
2. **人字拖配色在条间略有漂移**（白带黑底 vs 黑带白底）——身份次要项，切帧时可忽略。
3. **reaction 末帧抱臂** 与前三帧手臂轮廓差较大；若互动连点出现“跳变感”，优先整条重生 reaction，勿擦碎片。
4. **sleep 首版俯视条已丢弃**（assets 被覆盖）；归档仅保留最终侧卧版。

## Out of scope (not touched)

- `pets/library/brother-judge/pet.json`
- library 动画帧目录
- `src/main-v3.js`
- 切帧 / 安全门禁 / petpack 打包（Task 3+）

## Ready for Task 3

五条 chroma 已落盘并通过目视联系感检查；可进入标准切帧与安全门禁。

---

## FIX (2026-08-12): walk 全同格 + sleep 过静

**Trigger:** 目视复核发现 `walk-chroma.png` 六格为同一走路姿势复制，不是 contact/down/passing/up/opposite contact/opposite passing；sleep 帧间几乎静止。

**Action:**
- 整条重做 `walk-chroma.png`、`sleep-chroma.png`（idle/sit/reaction 未动）。
- 单次整条 `GenerateImage` 仍会克隆格子 → 改为 **逐帧 GenerateImage**（仍附 master + face-closeup + portrait）+ Python 色键合成等宽横条，绿幕统一为纯 `#00FF00`。
- 新原件归档：
  - `pets/work/brother-judge/source/realistic/generated-originals/walk-chroma-20260812-152840.png`
  - `pets/work/brother-judge/source/realistic/generated-originals/sleep-chroma-20260812-152840.png`
  - `pets/work/brother-judge/source/realistic/generated-originals/fix-frames-20260812-152840/`（逐帧源）

**Test evidence（格间差异，非克隆）:**
- Walk 15 对 pairwise subject-MSE：**全部 > 10000**；最小对 = cell4–cell5 ≈ **10968**（克隆≈0）。
- Sleep 6 对 pairwise subject-MSE：**全部 > 5800**；最小对 = cell1–cell2 ≈ **5862**；cell3/cell4 姿态差更大（蜷紧 / 伸腿）。
- Walk 目视：至少可见下蹲格、收腿偏直立格、以及左右前脚主导跨步差异；已非六格贴图复制。
- Sleep 目视：同向侧卧；cell3 更蜷、cell4 腿更伸，呼吸感仍偏“姿态跳变”而非细微起伏。

**Concerns for Task 3:**
1. Walk 相位仍非教科书级完美循环（部分中跨步轮廓接近；下蹲格偏夸张）——若切帧后步态仍怪，可再整条重生，勿局部擦。
2. Sleep 1–2 差异弱于 3–4；循环可能偏跳变。
3. 帽翅白珠边在部分帧上偏弱/偏黑边。
4. 未改 `pet.json` / library / `main-v3.js`。
