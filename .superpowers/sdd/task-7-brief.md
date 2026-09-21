### Task 7: 展开单人动画

**Files:**
- Create: `pets/library/brother-duo/animations/judge/{idle,walk,sit,sleep,reaction,drag,climb,perch,hang,fall,impact,recover}/`
- Create: `pets/library/brother-duo/animations/floral/` 同上

**Interfaces:**
- Consumes: `pets/library/brother-judge/animations/` 可复制给 judge；floral 必须按 IDENTITY 新生成
- Produces: 两套完整单人动作

- [ ] **Step 1: Copy judge solos**

将 `brother-judge` 已有动作目录复制到 `brother-duo/animations/judge/`（idle/walk/sit/sleep/reaction 以及窗口七动作）。不要改像素。若缺某个窗口动作，再按 maker 技能补生成，不要用 walk 顶替后还声称有专用帧——`interactionActions` 可映射到已有动作。

- [ ] **Step 2: Generate floral solos**

花袄弟单独出镜：同一套标准五动作 + 窗口七动作（或映射到 sit/walk/reaction/idle，但至少五标准动作是专用帧）。

- [ ] **Step 3: Process and reject collisions**

路径必须是 `animations/judge/...` 与 `animations/floral/...`，不得写入 `animations/idle/`。

---

