### Task 4: 生成主形象 + 五标准动作绿幕条

**Files:**
- Create: `pets/work/laopo/source/standard/master-chroma.png`
- Create: `pets/work/laopo/source/standard/{idle,walk,sit,sleep,reaction}-chroma.png`

**Interfaces:**
- 遵循 `skills/desktop-pet-maker/references/image-prompts.md` 共享后缀
- IDENTITY 固定为 Task 3 文本
- walk：**直立向右散步**，不是爬行
- idle：**直立站立**微动

- [ ] **Step 1: 用参考图生成 master（站立全身）**

- [ ] **Step 2: 依次生成 idle(4) / walk(6) / sit(4) / sleep(4) / reaction(4) 绿幕条**

- [ ] **Step 3: 去背**

对每条使用项目既定 chroma 命令（与 boss/xiaogou 制作时相同的 `imagegen`/`chroma_key` 参数：`--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`）。

输出到 `pets/work/laopo/source/standard/*-transparent.png`。

- [ ] **Step 4: 跑切帧门禁（仅标准五动作）**

将五条 `*-transparent.png` 放进同一输入目录（文件名需为 `idle.png` / `walk.png` 等，或按脚本约定命名），然后：

```powershell
python skills/desktop-pet-maker/scripts/process_animation_strips.py `
  --input-dir pets/work/laopo/source/standard/transparent `
  --output-dir pets/work/laopo/processed/frames `
  --action idle:4 `
  --action walk:6 `
  --action sit:4 `
  --action sleep:4 `
  --action reaction:4
```

Expected: 全部通过；失败则**整条重生成**，禁止擦边继续。后续 Task 5–6 用同一 `--output-dir` 追加 `--action name:count`。

---

