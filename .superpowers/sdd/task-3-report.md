# Task 3 Report: 窗口互动 + 跪爬绿幕条

**Date:** 2026-08-12  
**Branch:** `feature/brother-judge-bubble-copy`  
**Status:** DONE  
**Commits:** none（未改 `pet.json` / library / `main-v3.js`；未提交）

## Inputs

- PRIMARY: `pets/work/brother-judge/source/refs/master-realistic.png`（USER-CONFIRMED）
- Face: `pets/work/brother-judge/source/refs/ref-face-closeup.png`
- Portrait: `pets/work/brother-judge/source/refs/ref-portrait.png`
- Identity: `pets/work/brother-judge/IDENTITY.md`
- Style anchor: Task 2 已通过标准条 + Task 2 FIX 流程（逐帧生成，禁止整条一次出多格）

## Method (Task 2 lesson applied)

1. **每帧单独** `GenerateImage`（共 40 帧），`reference_image_paths` = master + face-closeup + portrait。
2. Python 色键合成等宽横条：cell `400×500`，侧边约 12% gutter，脚底基线对齐，背景强制纯 `#00FF00`。
3. **格间 pairwise MSE** 校验：任一近克隆对（≈0）则重生该帧；本批全部 `min_mse >> 0`。
4. 产出：`pets/work/brother-judge/source/realistic/{drag,climb,perch,hang,fall,impact,recover,crawl}-chroma.png`
5. 原件归档：
   - 逐帧：`.../generated-originals/task3-frames-20260812-153510/`
   - 条带：`.../generated-originals/{name}-chroma-20260812-153510.png`
   - MSE JSON：`.../generated-originals/task3-mse-20260812-153510.json`

## Per-strip results

| Strip | Path | Frames | Visual check | MSE / differ-check |
| --- | --- | --- | --- | --- |
| drag | `pets/work/brother-judge/source/realistic/drag-chroma.png` | 6 | YES — 悬空挣扎循环；抬臂/踢腿/蜷身/张肢相位可辨；帽翅在格内 | min_mse≈**3585**（pair 1–6）；全对 > 3500；非克隆 |
| climb | `pets/work/brother-judge/source/realistic/climb-chroma.png` | 6 | YES — 侧边攀爬循环；手脚交替上提；无窗框线 | min_mse≈**2069**（pair 4–5）；全对 > 2000 |
| perch | `pets/work/brother-judge/source/realistic/perch-chroma.png` | 4 | YES — 坐姿上边框感；倚靠/眨眼/hold 可辨 | min_mse≈**3289**（pair 3–4）；全对 > 3200 |
| hang | `pets/work/brother-judge/source/realistic/hang-chroma.png` | 4 | YES — 双手上举吊挂；左右摆动与回中 | min_mse≈**2339**（pair 1–4）；全对 > 2300 |
| fall | `pets/work/brother-judge/source/realistic/fall-chroma.png` | 4 | YES — 坠落循环；张臂/举手/翻滚/回正 | min_mse≈**2469**（pair 1–4）；全对 > 2400 |
| impact | `pets/work/brother-judge/source/realistic/impact-chroma.png` | 4 | YES — 落地冲击；深蹲撑地→反弹→跪稳 | min_mse≈**4492**（pair 1–4）；全对 > 4400 |
| recover | `pets/work/brother-judge/source/realistic/recover-chroma.png` | 6 | YES — 坐地→四点→半跪→深蹲→站起 | min_mse≈**3000**（pair 5–6）；全对 > 3000 |
| crawl | `pets/work/brother-judge/source/realistic/crawl-chroma.png` | 6 | YES — 跪爬朝右；手脚交替推进；非克隆 | min_mse≈**1791**（pair 2–4）；全对 > 1700（仍远高于克隆≈0） |

## Cross-strip identity check

- 写实东亚男性、短黑发、细银圆框眼镜、白背心、深色短裤、人字拖：八条一致。
- 黑判官帽 + 长白珠边帽翅：普遍可见且在格内。
- 无动漫大眼、无工装衬衫、无文字/地面阴影底板/运动线。
- 绿幕：合成后实心 `#00FF00`。

## Concerns / follow-ups

1. **perch**：合成后更像“地面坐姿”而非明显“双腿悬垂在上边框外”；若切帧后窗边坐感弱，可整条重生并强调悬空腿。
2. **climb / crawl**：部分帧偏正面而非纯侧面；循环可读，但侧边攀爬/朝右跪爬的剪影纯度一般。
3. **crawl min_mse 最低（≈1791）**：仍非克隆，但姿态相位不如 walk 教科书级；切帧后若跪爬“跳步”，整条重生勿擦碎片。
4. **人字拖配色** 条间仍有白带/黑带漂移（同 Task 2）。
5. **帽翅白珠边** 部分帧偏弱/偏细黑翅。

## Out of scope (not touched)

- `pets/library/brother-judge/pet.json`
- library 动画帧目录
- `src/main-v3.js`
- 切帧 / 安全门禁 / petpack / EXE（后续任务）

## Ready for next task

八条互动/跪爬 chroma 已落盘，逐帧差异校验通过，可进入切帧与 `interactionActions` 接线。
