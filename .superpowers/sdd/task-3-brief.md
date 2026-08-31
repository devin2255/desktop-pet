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

