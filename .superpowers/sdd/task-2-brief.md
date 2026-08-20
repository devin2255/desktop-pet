### Task 2: 标准动作绿幕条（idle/walk/sit/sleep/reaction）

**Files:**
- Create: `pets/work/brother-judge/source/realistic/{idle,walk,sit,sleep,reaction}-chroma.png`

**Interfaces:**
- Consumes: `master-realistic.png`, `IDENTITY.md`, `skills/desktop-pet-maker/references/image-prompts.md`
- Produces: 5 条写实绿幕条（帧数 4/6/4/4/4）

- [ ] **Step 1: 准备共享后缀**

每个 strip prompt 末尾必须带：

```text
Preserve exactly this identity: photoreal young East Asian man, short black hair, light stubble, thin silver round glasses, black judge hat with long white-beaded wings, white tank top, dark loose shorts, flip-flops.
Use photorealistic rendering (not anime). Same face as the master reference in every cell.
Lay out exactly the requested frames in one horizontal row of equal cells.
One complete person per cell, identical scale, camera, center, foot baseline.
Reserve at least 12% green gutter left and right in every cell; generous green padding top/bottom.
Solid flat #00FF00 background. No text, labels, borders, floor shadows, motion lines, or green on the person.
Hat wings and flip-flops must stay fully inside each cell (no flat cuts).
```

- [ ] **Step 2: 逐条生成（每条一次调用，附 master + 两张原片）**

| 文件 | 帧 | 动作要点 |
| --- | --- | --- |
| `idle-chroma.png` | 4 | 站立微呼吸/眨眼循环 |
| `walk-chroma.png` | 6 | 朝右走路循环 |
| `sit-chroma.png` | 4 | 站→坐下，末帧 hold |
| `sleep-chroma.png` | 4 | 已躺睡循环，无 Z 字 |
| `reaction-chroma.png` | 4 | 吐槽/挥判官笔，躯干尺度锁定防漂移 |

任一失败（脸漂、串帧、断帽翅）整条重生成，不局部擦除。

- [ ] **Step 3: 目视检查五条联系感**

打开每条 chroma，确认同一人、同一服装、绿幕平整。通过后进入 Task 3。

---
