### Task 4: 从 niulai 移除兄弟判官预装

**Files:**
- Delete (tracked): `pets/library/brother-judge/` 整树、`pets/packages/brother-judge.petpack`、`scripts/audit_brother_judge_matting.py`、`outputs/brother-judge-matting-audit.json`、`outputs/brother-judge-matting-audit.md`
- Modify: `docs/prompts/README.md`、`docs/prompts/make-current-branch-pet.txt`（本 Task 只改「不要把兄弟判官当本分支交付」的句子；完整提示词在 Task 6 覆盖）、任何把 brother-judge 当作默认交付的脚本注释

**Interfaces:**
- Consumes: Task 3 的 niulai 播放器
- Produces: niulai 工作区预装只剩牛来（外加 gitignore 允许的 laopo 演示包若仍跟踪）

- [ ] **Step 1: 确认跟踪列表**

```powershell
git ls-files "pets/library/brother-judge" "pets/packages/brother-judge.petpack" "scripts/audit_brother_judge_matting.py" "outputs/brother-judge-matting-audit.json" "outputs/brother-judge-matting-audit.md"
```

- [ ] **Step 2: 删除**

```powershell
git rm -r -- pets/library/brother-judge
git rm -- pets/packages/brother-judge.petpack
git rm -- scripts/audit_brother_judge_matting.py outputs/brother-judge-matting-audit.json outputs/brother-judge-matting-audit.md
```

若某路径未跟踪，跳过该条，不要 `git rm` 失败中断。

- [ ] **Step 3: 全文去掉「本分支交付兄弟判官」**

Search: `brother-judge`、`兄弟判官`  
保留：通用播放器仍能 *导入* 外部 brother-judge 包的说明（若有）。删除：把 brother-judge 当本分支主宠、handoff 里「先 checkout son-mode 做判官」且暗示 niulai 自带判官 的段落。

`docs/prompts/README.md` 改为：本分支主宠是牛来；制作入口是 `make-current-branch-pet.txt`（完整正文 Task 6 再写）。

- [ ] **Step 4: 确认预装包**

```powershell
git ls-files "pets/packages/*.petpack" "pets/library/*/pet.json"
```

Expected: 有 `niulai`；没有 `brother-judge`。`laopo.petpack` 若仍在 files 里可保留为播放器演示，README 不把它当主宠。

- [ ] **Step 5: 跑测试**

```powershell
npm run test:js
```

Expected: PASS。若有测试依赖 `pets/library/brother-judge`，改为跳过或改用 niulai 夹具，不要再加回兄弟判官资源。

- [ ] **Step 6: Commit**

```powershell
git commit -m "chore: remove preinstalled brother-judge from niulai branch"
```

---

