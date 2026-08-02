### Task 9: 打包 petpack 并写回归测试

**Files:**
- Create: `pets/packages/laopo.petpack`
- Create: `scripts/test-laopo-petpack.js`
- Delete or stop referencing: `pets/packages/boss.petpack`、`scripts/test-boss-petpack.js`（本分支演示位）
- Modify: `scripts/test-petpack-security.js` fixture → `laopo.petpack`
- Modify: `package.json` scripts / `build.files` / icon 路径

- [ ] **Step 1: 打包**

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/laopo pets/packages/laopo.petpack
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/laopo.petpack
```

- [ ] **Step 2: 写 `scripts/test-laopo-petpack.js`**

断言：
- `id === 'laopo'`, `name === '老婆'`, `speechGender === 'female'`
- `startupGreeting === '老公，我来啦~'`
- 菜单：`call-hubby` / `kowtow` / `talent-show` 文案与音频路径
- **不存在** `call-dad`、`self-slap`、`perch-cross-phone`
- perched 含 `perch-hair-flip`、`perch-blow-kiss`、`perch-look`
- random 含 `serve-tea`/`love-you`/`praise`/`encourage`，message/speech 正确，且无 `sleep`
- 必备动画列表含 walk（散步）、talent-show、甜蜜三动作

- [ ] **Step 3: 更新 `package.json`**

```json
"validate:demo": "python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/laopo.petpack",
"build:laopo": "node scripts/build-customer.js --pet pets/packages/laopo.petpack --name \"老婆桌面宠物\" --delivery-id laopo"
```

`test:js`：`test-boss-petpack.js` → `test-laopo-petpack.js`  
`build.files`：`boss.petpack` → `laopo.petpack`；tray/icon 改为 laopo 资源（Task 10 生成后填入）。  
删除或保留但不使用 `build:boss`（本分支改为 `build:laopo`）。

- [ ] **Step 4: 跑**

```powershell
node scripts/test-laopo-petpack.js
npm test
```

Expected: PASS（若 icon 尚未替换导致 build 配置悬空，先完成 Task 10 再跑完整 build）

---

