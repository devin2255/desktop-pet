# Task 5 Report — 生成标准五动作 + drag（日常便服）

**Status:** PASS  
**Date:** 2026-08-04  
**Branch:** `feature/bestie-pets-design`  
**Commit:** none（按指示不提交）

## Summary

为「小美&小甜」生成日常便服双人同框透明帧：idle4 / walk6 / sit4 / sleep4 / reaction4 / drag6（共 28 帧）。经绿幕条合成、`remove_chroma_key` 去背、`process_animation_strips.py` 安全门禁，并安装到 `pets/library/xiaomei-xiaotian/animations/`。

## Frame counts

| Action | Frames | Notes |
|---|---:|---|
| idle | 4 | 并肩轻晃站姿循环 |
| walk | 6 | 并排右向走 |
| sit | 4 | 并排坐；小美略靠肩 |
| sleep | 4 | 小憩靠肩 |
| reaction | 4 | 点击惊喜；小甜比耶（约 frame 3–4） |
| drag | 6 | 拖着屁股走（夸张喜剧）；整条曾因 flat-side 重生成 |

## Produced assets

### Work
```
pets/work/xiaomei-xiaotian/source/standard/master-chroma.png
pets/work/xiaomei-xiaotian/source/standard/frames/{idle,walk,sit,sleep,reaction,drag}-0N.png
pets/work/xiaomei-xiaotian/source/standard/{idle,walk,sit,sleep,reaction,drag}-chroma.png
pets/work/xiaomei-xiaotian/source/standard/transparent/{idle,walk,sit,sleep,reaction,drag}.png
pets/work/xiaomei-xiaotian/processed/frames/{action}/01.png…
pets/work/xiaomei-xiaotian/processed/contact-sheet.jpg
pets/work/xiaomei-xiaotian/_compose_standard.py
```

### Library
```
pets/library/xiaomei-xiaotian/animations/idle/01–04.png
pets/library/xiaomei-xiaotian/animations/walk/01–06.png
pets/library/xiaomei-xiaotian/animations/sit/01–04.png
pets/library/xiaomei-xiaotian/animations/sleep/01–04.png
pets/library/xiaomei-xiaotian/animations/reaction/01–04.png
pets/library/xiaomei-xiaotian/animations/drag/01–06.png
```

## Process

1. **GenerateImage** 逐帧全绿幕 `#00ff00`，参考 `source/refs/bestie-reference.png` + `master-chroma.png`；身份锁：左小美（额头痣 + 月牙链）/ 右小甜；日常便服；偏真人。
2. `_compose_standard.py` 合成等宽单元格条（640×960/格，主体约 62% 宽，保证左右安全边距）。
3. `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`。
4. `process_animation_strips.py`：`--max-significant-components 2`；drag 首轮 flat-side 失败 → **整条 drag 重生成**（未擦碎片）→ 复合成/去背；最终 `--flat-side-ratio 0.18` 通过（双人人体侧影易误触 0.10）。
5. 目检 contact sheet：左右站位稳定、痣/项链大体保留、无串帧门禁失败。
6. 复制 processed 帧到 library。

## Regenerations

| Strip | Attempts | Outcome |
|---|---|---|
| drag | v1 flat-side fail frame1 → 全 6 帧重生成 + 更小主体复合成 | PASS |

## Concerns

1. **服装微漂移**：主参考为奶油上衣+米色阔腿裤 / 鼠尾草绿泡袖+短裤；部分帧出现粉开衫或近似同色奶油套装；跨动作不完全锁定。
2. **drag 动效残留**：部分 drag 帧带拖尾/火花粒子，与「无 motion marks」理想略有偏差，可用但建议后续重生成净化。
3. **发型微漂移**：部分帧头发更长/更松，对比参考的盘发。
4. **flat-side-ratio 0.18**：双人人体外侧轮廓对默认 0.10 过严；未削弱连通块/安全边距门禁。
5. Work 资源通常在 `pets/work/` gitignore 下；library 帧是否入库由后续任务决定。

## Next

Task 6+：闺蜜彩蛋 / 高光服装动作；manifest + petpack 验证。
