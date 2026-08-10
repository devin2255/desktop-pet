### Task 8: 编写 `pet.json`、打包并包级测试

**Files:**
- Create: `pets/library/xiaomei-xiaotian/pet.json`
- Create: `pets/library/xiaomei-xiaotian/preview.png`
- Create: `pets/packages/xiaomei-xiaotian.petpack`
- Create: `scripts/test-bestie-petpack.js`
- Modify: `package.json`（接入测试；可选 `"build:bestie"` script）

**Interfaces:**
- Consumes: Tasks 2–7 的字段与动画
- Produces: 可 validate 的 petpack

`pet.json` 关键字段：

- `id`: `xiaomei-xiaotian`
- `name`: `小美&小甜`
- `personality`: `["温柔黏人","活泼外向","闺蜜"]`
- `startupGreeting`: `我们是小美和小甜～今天也要一起加油鸭。`
- `speechGender`: `female`（若沿用语音字段）
- `behavior.random`：按规格权重 walk32/sit24/reaction16/sleep12/cuddle10/whisper6
- `interactionActions.drag.action`: `drag`
- `contextMenuActions`：贴贴/合个影/说悄悄话/加油鸭/去放松(sequence)/去睡觉
- `sequences.relax`：按 File Structure 约定

- [ ] **Step 1: 写 `scripts/test-bestie-petpack.js`**

断言：id/name/startupGreeting；菜单含 `relax` 且 `sequence==='relax'`；`sequences.relax.stages` 中恰有一阶段 `waitForClick`；该阶段 `messages` 为两句「我要这个」；存在 `drag` 动画；随机池不含 selfie/cheer/relax。

- [ ] **Step 2: 生成 preview、写 pet.json**

可用 `create_pet_manifest.py` 生成初稿再手改 sequences/菜单。

- [ ] **Step 3: validate + build**

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/xiaomei-xiaotian
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/xiaomei-xiaotian pets/packages/xiaomei-xiaotian.petpack
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/xiaomei-xiaotian.petpack
node scripts/test-bestie-petpack.js
```

Expected: 全部 valid / ok

- [ ] **Step 4: Commit（仅当用户要求时）**

---

