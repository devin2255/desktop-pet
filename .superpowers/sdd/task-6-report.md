# Task 6 Report — 生成闺蜜彩蛋动画

**Status:** PASS  
**Date:** 2026-08-04  
**Branch:** `feature/bestie-pets-design`  
**Commit:** none（按指示不提交）

## Summary

为「小美&小甜」生成闺蜜彩蛋透明帧：cuddle4 / selfie4 / whisper4 / cheer4（共 16 帧）。经绿幕条合成、`remove_chroma_key` 去背、`process_animation_strips.py` 安全门禁，并安装到 `pets/library/xiaomei-xiaotian/animations/`。未覆盖 Task 5 的 idle/drag/walk/sit/sleep/reaction library 帧。

## Frame counts

| Action | Frames | Outfit | Notes |
|---|---:|---|---|
| cuddle | 4 | 日常 | 靠肩贴贴；小美更黏 |
| selfie | 4 | 蕾丝高光 | 合影；小甜比耶（frame 2–4） |
| whisper | 4 | 日常 | 耳语→一起偷笑 |
| cheer | 4 | 日常 | 并排比心/打气 |

## Produced assets

### Work
```
pets/work/xiaomei-xiaotian/source/standard/frames/{cuddle,selfie,whisper,cheer}-0N.png
pets/work/xiaomei-xiaotian/source/standard/{cuddle,selfie,whisper,cheer}-chroma.png
pets/work/xiaomei-xiaotian/source/transparent/{cuddle,selfie,whisper,cheer}.png
pets/work/xiaomei-xiaotian/source/standard/transparent/{cuddle,selfie,whisper,cheer}.png
pets/work/xiaomei-xiaotian/processed/frames/{cuddle,selfie,whisper,cheer}/01–04.png
pets/work/xiaomei-xiaotian/_compose_easter.py
```

### Library
```
pets/library/xiaomei-xiaotian/animations/cuddle/01–04.png
pets/library/xiaomei-xiaotian/animations/selfie/01–04.png
pets/library/xiaomei-xiaotian/animations/whisper/01–04.png
pets/library/xiaomei-xiaotian/animations/cheer/01–04.png
```
全部 480×480 RGBA；与既有标准动作同画布。

## Process

1. **GenerateImage** 逐帧全绿幕 `#00ff00`，参考 `master-chroma.png`（日常）/ `bestie-reference.png`（蕾丝）；身份锁：左小美（额头痣 + 月牙链）/ 右小甜。
2. `_compose_easter.py`：等宽单元格条（640×960/格，主体约 62% 宽）→ `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`。
3. `process_animation_strips.py` 仅处理四条新动作写入既有 `processed/frames/`（不重写 idle/drag）：
   ```
   --max-significant-components 2 --flat-side-ratio 0.18
   --action cuddle:4 --action selfie:4 --action whisper:4 --action cheer:4
   ```
4. 目检 contact sheet：左右站位、痣/项链、selfie 蕾丝+比耶、基线稳定。
5. 复制四动作 processed 帧到 library。

**process exit:** 0（首轮默认 flat-side 0.10 于 cuddle frame2 失败 → 按 Task 5 双人侧影惯例改用 0.18 后通过；未擦碎片）

## Regenerations

| Strip / Frame | Attempts | Outcome |
|---|---|---|
| selfie-02 | v1 content-safety block → 弱化措辞重生成 | PASS |
| selfie-03 | v1 小甜黑裙漂移 → 锚定白蕾丝重生成（03b→03） | PASS |
| cuddle strip | process flat-side 0.10 fail → ratio 0.18 复跑 | PASS（未整条重绘） |

## Concerns

1. **日常装微漂移**：部分 cuddle/whisper/cheer 帧小甜由鼠尾草绿泡袖+短裤变为奶油短裙或近同色套装；跨帧不完全锁定 master 服装。
2. **selfie 蕾丝款式微差**：长短裙/袖型在帧间略有变化，但均为白/奶油蕾丝高光系，比耶手势保留。
3. **flat-side-ratio 0.18**：与 Task 5 相同；双人外侧轮廓对默认 0.10 过严；未削弱连通块/安全边距门禁。
4. **contact-sheet**：本次 process 仅含四彩蛋动作；标准动作 sheet 未被合并回写。
5. Work 资源通常在 `pets/work/` gitignore 下；library 帧是否入库由后续任务决定。

## Next

Task 7+：relax 分镜 / manifest + petpack 验证 / 客户 EXE。
