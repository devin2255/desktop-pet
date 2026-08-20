### Task 5: 去背、切帧、入库、打包

**Files:**
- Create: `pets/work/brother-judge/source/realistic/transparent/*.png`
- Create: `pets/work/brother-judge/source/realistic/processed/<action>/*.png`
- Replace: `pets/library/brother-judge/animations/**`
- Replace: `pets/library/brother-judge/preview.png`（用 idle/01）
- Replace: `pets/packages/brother-judge.petpack`

**Interfaces:**
- Consumes: 全部 `*-chroma.png`
- Produces: 通过安全门禁的库内帧 + 校验通过的 petpack

- [ ] **Step 1: chroma 去背**

对 `source/realistic/` 下每条 `*-chroma.png` 使用项目既定参数：

```text
--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

输出到 `source/realistic/transparent/<action>.png`（工具名以本机已安装的 `imagegen`/既有 chroma helper 为准；与 laopo/boss 历史制作命令一致）。

- [ ] **Step 2: 安全切帧**

```powershell
python skills/desktop-pet-maker/scripts/process_animation_strips.py `
  --input-dir pets/work/brother-judge/source/realistic/transparent `
  --output-dir pets/work/brother-judge/source/realistic/processed `
  --action idle:4 --action walk:6 --action sit:4 --action sleep:4 --action reaction:4 `
  --action drag:6 --action climb:6 --action perch:4 --action hang:4 --action fall:4 `
  --action impact:4 --action recover:6 --action crawl:6 --action kowtow:6
```

Expected: 全部 action 通过；任一条失败则回到对应 Task 重生成该条，禁止擦碎片放行。

- [ ] **Step 3: 复制入库并更新 preview**

```powershell
$actions = 'idle','walk','sit','sleep','reaction','drag','climb','perch','hang','fall','impact','recover','crawl','kowtow'
foreach ($a in $actions) {
  New-Item -ItemType Directory -Force -Path "pets/library/brother-judge/animations/$a" | Out-Null
  Copy-Item "pets/work/brother-judge/source/realistic/processed/$a/*" "pets/library/brother-judge/animations/$a/" -Force
}
Copy-Item "pets/library/brother-judge/animations/idle/01.png" "pets/library/brother-judge/preview.png" -Force
```

- [ ] **Step 4: 校验与打包**

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/brother-judge
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/brother-judge pets/packages/brother-judge.petpack
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/brother-judge.petpack
python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v
node scripts/test-renderer-interaction.js
```

Expected: 全部通过。

- [ ] **Step 5: Commit**

```powershell
git add pets/library/brother-judge pets/packages/brother-judge.petpack
git commit -m "feat: photoreal brother-judge frames with kowtow"
```

---
