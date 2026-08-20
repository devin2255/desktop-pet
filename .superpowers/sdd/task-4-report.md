# Task 4 Report: 磕头条 + pet.json 接线

**Date:** 2026-08-12  
**Branch:** `feature/brother-judge-bubble-copy`  
**Status:** DONE  
**Commit:** `feat: wire brother-judge kowtow animation in pet.json`（仅 `pets/library/brother-judge/pet.json`；未提交 work/ chroma 二进制）

## Inputs

- PRIMARY: `pets/work/brother-judge/source/refs/master-realistic.png`
- Face: `pets/work/brother-judge/source/refs/ref-face-closeup.png`
- Portrait: `pets/work/brother-judge/source/refs/ref-portrait.png`
- Identity: `pets/work/brother-judge/IDENTITY.md`
- Method: Task 2/3 教训 — **禁止**单次 GenerateImage 出 6 格条；改为逐帧生成 + 色键合成

## Step 1: kowtow-chroma.png

**Sequence (L→R):** stand → bend → kneel-forward → forehead-near-ground hold → rise → return upright

| Item | Path |
| --- | --- |
| Strip | `pets/work/brother-judge/source/realistic/kowtow-chroma.png`（2400×500，6×400×500） |
| Per-frame archive | `.../generated-originals/task4-frames-20260812-163949/` |
| Strip archive | `.../generated-originals/kowtow-chroma-20260812-163949.png` |
| MSE JSON | `.../generated-originals/task4-mse-20260812-163949.json` |
| Compose script | `.../realistic/_compose_task4.py` |

**MSE (subject pairwise on cells):** min ≈ **8248**（pair 3–5）；max ≈ **24163**；全部 ≫ 0 → **非克隆**。

**Visual:** 身份与 master 一致（白背心/短裤/人字拖/细框眼镜/判官帽长翅）；帽翅各格可见；无气泡/文字；绿幕为合成后实心 `#00FF00`。

## Step 2: pet.json

1. 新增 `animations.kowtow`：6 帧路径、`durations [180,180,220,500,220,900]`、`loop false`、`holdLastFrame true`、`scale 1`
2. `contextMenuActions` 磕头改为 `action: "kowtow"`、`duration: 3600`（无 message / speech）
3. **保留**既有气泡文案与 watch 关键词（如「爸，我歇会！」；画饼/吹牛）
4. **未改** `src/main-v3.js`

## Step 3: Verify

```text
node -e "JSON.parse(...pet.json...); console.log('ok')" → ok
```

## Concerns / follow-ups

1. **f3 / f5 姿态接近**（同为跪姿抬头；MSE≈8248 仍非克隆）——切帧后若 rise 观感弱，可整条重做 f5，勿局部擦。
2. **朝向不一致**：f4 偏侧视左向，其余偏正面；切帧后磕头峰值可能略跳视。
3. **道具漂移**：f1 持判官笔、f6 空手——次要，可接受。
4. **library 帧目录**：`animations/kowtow/*.png` 尚未从 chroma 切帧落入 library（本 Task 仅接线清单 + work 绿幕条）；下一阶段需切帧/安全门禁后再打包。

## Out of scope (not touched)

- `src/main-v3.js`
- 其它 bubble / watch 文案
- 切帧 / petpack / EXE

## Ready for next

磕头条已落盘并通过格间 MSE；pet.json 已接线菜单 `action: kowtow`。可进入切帧与资源包更新。
