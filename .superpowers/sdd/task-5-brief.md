### Task 5: 生成标准五动作 + drag（日常便服）

**Files:**
- Create under `pets/work/xiaomei-xiaotian/`：各动作 `*-chroma.png` → 去背 → `process_animation_strips.py` 输出帧
- 最终帧进入 `pets/library/xiaomei-xiaotian/animations/{idle,walk,sit,sleep,reaction,drag}/`

**Interfaces:**
- Consumes: desktop-pet-maker 流程与 IDENTITY.md
- Produces: 合规透明帧；双人同框、左美右甜

帧数下限：idle4 / walk6 / sit4 / sleep4 / reaction4 / drag6

- [ ] **Step 1: 按 skill 生成绿幕条（偏真人、日常便服、双人）**

提示词必须锁：同一对角色、左小美右小甜、完整身体、安全边距、无文字道具。

- [ ] **Step 2: 去背 + `process_animation_strips.py`**

任一条失败 → 整条重生成，禁止只擦碎片。

- [ ] **Step 3: 人工目检 contact sheet**

检查：痣/项链/左右站位/无串帧/基线稳定。

- [ ] **Step 4: 将帧写入 library 目录结构**

- [ ] **Step 5: Commit（仅当用户要求时）**

---

