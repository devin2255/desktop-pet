### Task 3: 素材目录与制作 Prompt

**Files:**
- Create/Update: `pets/work/laopo/source/refs/ref-fullbody.png`、`ref-portrait.png`（从用户附图复制）
- Create: `docs/prompts/make-laopo-pet.txt`
- Create: `pets/work/laopo/IDENTITY.md`（稳定外观描述，供所有出图 prompt 复用）

- [ ] **Step 1: 复制参考图**

用户附图位于 Cursor assets；复制到：

```powershell
New-Item -ItemType Directory -Force -Path pets/work/laopo/source/refs | Out-Null
Copy-Item "<fullbody-asset>" pets/work/laopo/source/refs/ref-fullbody.png -Force
Copy-Item "<portrait-asset>" pets/work/laopo/source/refs/ref-portrait.png -Force
```

- [ ] **Step 2: 写 IDENTITY.md**

内容必须包含：年轻东亚女性；长直黑发；头上黑框墨镜；米白无袖长裙；黑色蕾丝短袖内搭；厚底凉鞋；俏皮甜蜜表情；柔和写实 2D；全身完整可见。

- [ ] **Step 3: 写 `docs/prompts/make-laopo-pet.txt`**

把已批准 spec 中的特殊要求写成可复现 prompt（对应老板的 `make-boss-pet.txt`）。

- [ ] **Step 4: 目视确认两张 refs 可读且为同一人**

---

