### Task 2: 工作区 IDENTITY 检查表

**Files:**
- Create: `pets/work/guimi/IDENTITY.md`
- Verify: `pets/work/guimi/source/refs/*.png`（已存在 9 张）

- [ ] **Step 1: 确认参考图**

Run:

```powershell
Get-ChildItem pets/work/guimi/source/refs | Select-Object Name
```

Expected: 含 `bestie1-face.png`、`bestie1-walk-outfit.png`、`bestie1-selfie-outfit.png`、`bestie1-relax-outfit.png`、`bestie2-face-store.png`、`bestie2-face-red.png`、`bestie2-walk-outfit.png`、`bestie2-selfie-outfit.png`、`bestie2-relax-outfit.png`。

- [ ] **Step 2: 写 IDENTITY.md**

必须包含：

- 左闺蜜一 / 右闺蜜二，禁止互换
- 脸源与「禁止贴纸脸」
- 三套服装对照表（日常 / 合影 / 去放松）
- 分角色不分名字：台词用「我们」口吻
- 男模仅出现在 relax

- [ ] **Step 3: Commit（仅当用户要求时）**

---

