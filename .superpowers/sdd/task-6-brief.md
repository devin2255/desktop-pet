### Task 6: petpack 工具链兼容 watch 字段

**Files:**
- Modify: `src/petpack-validator.js`
- Modify: `skills/desktop-pet-maker/scripts/create_pet_manifest.py`
- Test: `scripts/test-petpack-security.js`（既有，扩展用例）

**Changes:**

- [ ] **Step 1: petpack-validator 允许并校验 watch**

在 `validateManifest`（先 Grep 定位 `animations` 校验函数）中，于 schema 校验处追加：`watch` 为可选 object；若存在，校验 `watch.keywords` 为 object（值必须是非空字符串数组）、`watch.fallback` 为 string（可缺省）、`watch.state` 为 string（可缺省）。实现方式：在 manifest 顶层字段白名单中加入 `watch`（只校验类型，不参与资源引用检查——`referencedFiles` 不含 watch 内容）。若现有实现是"未知字段报错"（Grep 确认 `validateManifest` 是否枚举顶层字段），则显式放行 watch；否则仅加类型校验。

- [ ] **Step 2: create_pet_manifest.py 透传 watch**

`create_pet_manifest.py` 增加可选 `--watch <json-file>` 参数：读入 JSON 对象，写入 manifest 的 `watch` 字段；缺省不写。参照现有 `--personality` 等可选参数的实现风格（Grep 定位）。

- [ ] **Step 3: 扩展安全测试**

在 `scripts/test-petpack-security.js` 添加一个用例：构造含合法 `watch` 字段的 manifest → `validateManifest` 通过；构造 `watch: { keywords: { 画饼: 'not-array' } }` → 校验失败。运行确认通过。

- [ ] **Step 4: 回归 + 提交**

Run: `npm run test:js`
Expected: 全绿

```bash
git add src/petpack-validator.js skills/desktop-pet-maker/scripts/create_pet_manifest.py scripts/test-petpack-security.js
git commit -m "feat: allow watch field in petpack manifests"
```

---

