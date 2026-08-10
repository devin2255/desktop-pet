# Task 7 Report — 生成 relax 分镜动画

**Status:** PASS  
**Date:** 2026-08-04  
**Branch:** `feature/bestie-pets-design`  
**Commit:** none（按指示不提交）

## Summary

为「小美&小甜」生成去放松剧情透明帧：relax-makeup4 / relax-dress4 / relax-run6 / relax-models4 / relax-hug4 / relax-shy4（共 26 帧）。经绿幕条合成、`remove_chroma_key` 去背、`process_animation_strips.py` 安全门禁，并安装到 `pets/library/xiaomei-xiaotian/animations/`。未覆盖 Task 5/6 既有 library 动作目录。

## Frame counts

| Action | Frames | Outfit / Cast | Notes |
|---|---:|---|---|
| relax-makeup | 4 | 日常便服 · 双人 | 并肩补妆/梳头 |
| relax-dress | 4 | 蕾丝高光 · 双人 | 换装结果；小甜比耶 |
| relax-run | 6 | 蕾丝高光 · 双人 | 并排右向跑（简化无场景） |
| relax-models | 4 | 蕾丝 + 两男模 | 持帧友好；腹肌可读；男模靠近各侧 |
| relax-hug | 4 | 蕾丝 + 两男模 | 各抱一侧 |
| relax-shy | 4 | 蕾丝 + 两男模 | 娇羞贴胸/靠肩；非露骨 |

## Produced assets

### Work
```
pets/work/xiaomei-xiaotian/source/standard/frames/relax-*
pets/work/xiaomei-xiaotian/source/standard/relax-*-chroma.png
pets/work/xiaomei-xiaotian/source/transparent/relax-*.png
pets/work/xiaomei-xiaotian/processed/frames/{relax-makeup,relax-dress,relax-run,relax-models,relax-hug,relax-shy}/
pets/work/xiaomei-xiaotian/_compose_relax.py
```

### Library
```
pets/library/xiaomei-xiaotian/animations/relax-makeup/01–04.png
pets/library/xiaomei-xiaotian/animations/relax-dress/01–04.png
pets/library/xiaomei-xiaotian/animations/relax-run/01–06.png
pets/library/xiaomei-xiaotian/animations/relax-models/01–04.png
pets/library/xiaomei-xiaotian/animations/relax-hug/01–04.png
pets/library/xiaomei-xiaotian/animations/relax-shy/01–04.png
```
全部 480×480 RGBA。

## Process

1. **GenerateImage** 逐帧全绿幕 `#00ff00`；日常参考 `master-chroma.png`，高光参考 selfie / dress 帧；身份锁左小美（痣 + 月牙链）/ 右小甜。
2. `_compose_relax.py`：双人条主体 max 宽 62% 格宽；四人条 55%（更宽主体保证左右安全边距）→ `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`。
3. `process_animation_strips.py`：
   - 双人（makeup/dress/run）：`--max-significant-components 2 --flat-side-ratio 0.18`
   - 四人（models/hug/shy）：`--max-significant-components 4 --flat-side-ratio 0.18`
4. 复制六动作 processed 帧到 library（未改 idle/walk/…/cheer）。

**process exit:** 0  
**flat-side-ratio:** 0.18（与 Task 5/6 相同；双人/四人人体侧影对默认 0.10 过严）  
**max-significant-components:** 四人条选用 **4**（任务建议）；事后探针 models/hug/shy 在 `2` 下也因人物贴合可通过，仍以 4 作为正式选择并记录。

## Regenerations / safety softens

| Strip / Frame | Attempts | Outcome |
|---|---|---|
| relax-models-01 | v1 content-safety block → 改「开衫露腹肌」措辞 | PASS |
| relax-models-03 | v1 block（指向姿势）→ 弱化为侧身注视 | PASS |
| relax-shy-03 | v1 block（埋胸措辞）→ 改为靠肩娇羞 | PASS |

## Concerns

1. **男模造型微漂移**：models-02 偏赤膊短裤，其余多为开衫露腹肌；腹肌整体可读但款式不完全统一。
2. **四人站位**：部分帧为 M-W-W-M（男模在两侧外），部分为更交错拥抱；仍满足「各侧有男模可点名」，但左右严格对称略有差。
3. **辨识点**：部分帧痣位置/项链清晰度漂移（脸颊痣 vs 额头痣）；小美长裙 / 小甜短裙对比大体保留。
4. **flat-side-ratio 0.18**：未削弱连通块/安全边距门禁。
5. **contact-sheet**：本次 process 分两次写入，sheet 仅反映最后一批动作，未合并全库。
6. Work 资源通常在 `pets/work/` gitignore 下；library 帧是否入库由后续任务决定。

## Next

Task 8+：manifest 挂 `relax` sequence（含 waitForClick / holdLastFrame）→ petpack 验证 → `build:customer`。

---

## Review fix (2026-08-04) — single-scene shy/hug

**Status:** PASS（process exit 0；未 git commit）

### Problem
审阅指出 `relax-shy` / 弱 `relax-hug` 呈「双情侣海报 + 中缝拼贴」，非四人同一连续场景。

### Regenerated
- **relax-shy** 整条 01–04（强制 M-W-W-M 紧凑同框；小美长蕾丝+额痣+月牙链；小甜短蕾丝；两名不同开衫男模腹肌；娇羞贴靠，非露骨）
- **relax-hug** 整条 01–04（同上单场景规则；各抱一侧、中间女孩贴近/可交臂）

### Pipeline
1. GenerateImage → `assets/xiaomei-xiaotian-relax-{shy,hug}-0N.png`
2. `_compose_relax_fix.py`（仅 shy/hug）：compose → `remove_chroma_key --force`
3. `process_animation_strips.py --action relax-hug:4 --action relax-shy:4 --max-significant-components 4 --flat-side-ratio 0.18` → **exit 0**
4. 安装到 `pets/library/xiaomei-xiaotian/animations/{relax-shy,relax-hug}/`（480×480 RGBA）
5. **未改** makeup / dress / run / models

### Sanity
库帧中段水平占用 `occ_transitions=0`（连续一体，非左右两坨断开的拼贴缝）。

### Concerns
1. 部分帧男模发型/外套色仍有微漂移（黑/炭灰开衫 vs 偶发西装外套）。
2. 额痣/月牙链在部分缩小帧上偏淡。
3. shy-01/04 曾触内容安全拦截，改用更温和措辞后通过；shy-02 多次重生成才消中缝。
4. 未重新跑全库 contact-sheet。

---

## Fix pass 2 (2026-08-04) — kill center seam on shy/hug

**Status:** PASS（process exit 0；未 git commit）

### Problem
复审仍判 `relax-shy` / `relax-hug` 为「双情侣海报 + 中缝黑空隙」，未达到 `relax-models/02` 的四人连续同框凝聚力。

### Regenerated
- **relax-hug** 01–04（参考 `relax-models/02` + bestie/master；强制 M-W-W-M 紧贴，中心女孩交臂/贴肩，非镜像双海报）
- **relax-shy** 01–04（同上；中心牵手/交臂填满中缝；娇羞靠肩，非露骨）
- 中途失败重试：hug-02 / shy-02 / shy-04 内容安全拦截后改温和措辞；shy-01 因贴底/平直侧边门禁多次重生成，最终脚底留绿幕边距通过

### Pipeline
1. GenerateImage（references: `pets/library/.../relax-models/02.png`、`source/refs/bestie-reference.png`、`master-chroma.png`）
2. `_compose_relax_fix.py`：绿幕 pad → compose（640×960 格，主体 ≤55%）→ `remove_chroma_key --force`
3. `process_animation_strips.py --action relax-hug:4 --action relax-shy:4 --max-significant-components 4 --flat-side-ratio 0.18` → **exit 0**
4. 安装 `pets/library/xiaomei-xiaotian/animations/{relax-hug,relax-shy}/`（480×480 RGBA）
5. **未改** makeup / dress / run / models

### Center-gap self-check（装库帧，x=220–260 / core x=235–245，躯干带）
| Frame | band | core | mid_center_gap | Result |
|---|---:|---:|---:|---|
| relax-models/02 (ref) | 1.0 | 1.0 | 0 | PASS |
| relax-hug/01–04 | 1.0 | 1.0 | 0 | PASS ×4 |
| relax-shy/01–04 | 1.0 | 1.0 | 0 | PASS ×4 |

**process exit:** 0  
**TARGET_ALL:** PASS

### Concerns
1. 部分帧仍偏「牵手连结」而非躯干大面积重叠；像素中缝已封死，但观感亲密程度帧间略有差。
2. 男模脸型/短裤 vs 长裤仍有微漂移；额痣/月牙链小尺寸偏淡。
3. compose 增加绿幕 pad 仅用于门禁边距，不擦主体。
