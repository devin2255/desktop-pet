### Task 9: 开发版手测 + 客户 EXE

**Files:**
- Modify: 必要时 `package.json` 增加 `build:bestie`
- Output: `dist/customers/xiaomei-xiaotian/`（或 build-customer 默认目录）

- [ ] **Step 1: 开发版启动**

```powershell
npm start
```

手测清单：

- [ ] 双人同框 idle/walk/坐/睡/点击 reaction
- [ ] 拖拽为拖着屁股走；松手恢复
- [ ] 菜单：贴贴/合影/悄悄话/加油鸭/睡觉
- [ ] 去放松：化妆→换装→跑→男模+两句「我要这个」暂停→再点→拥抱→娇羞→回日常
- [ ] 暂停时拖拽会中断回 idle
- [ ] 透明穿透；静止连点无缩放平移

- [ ] **Step 2: 回归门禁**

```powershell
npm run test:regression
node scripts/test-sequence-controller.js
node scripts/test-sequences-schema.js
node scripts/test-bestie-petpack.js
```

Expected: PASS

- [ ] **Step 3: 客户构建**

```powershell
npm run build:customer -- --pet pets/packages/xiaomei-xiaotian.petpack --name "小美&小甜桌面宠物" --delivery-id xiaomei-xiaotian
```

- [ ] **Step 4: 启动 EXE 复核**

独立 userData、无导入/切换入口、动画与去放松再点、托盘退出。

- [ ] **Step 5: 交付说明**

列出已验证 / 未验证（含数字签名未做）。更新规格状态为「已实现待交付」或在 build-report 旁写简短 `DELIVERY.md`（仅当需要时；默认用 build-report.json + 对话交付）。

- [ ] **Step 6: Commit（仅当用户要求时）**

---

