### Task 4: 工作区与参考图 / 身份检查表

**Files:**
- Create: `pets/work/xiaomei-xiaotian/source/refs/`（拷贝 `pets/work/bestie-reference.png`）
- Create: `pets/work/xiaomei-xiaotian/IDENTITY.md`（辨识点检查表，供生成时勾选）

- [ ] **Step 1: 建目录并复制参考图**

```powershell
New-Item -ItemType Directory -Force -Path pets/work/xiaomei-xiaotian/source/refs | Out-Null
Copy-Item pets/work/bestie-reference.png pets/work/xiaomei-xiaotian/source/refs/bestie-reference.png -Force
```

- [ ] **Step 2: 写 IDENTITY.md**

必须列出：左小美痣+月牙链；右小甜比耶气质；禁止左右互换；日常 vs 高光服装规则；男模仅 relax。

- [ ] **Step 3: Commit（仅当用户要求时）**

---

