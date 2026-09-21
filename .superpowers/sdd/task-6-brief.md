### Task 6: 打包 EXE 与手测

**Files:**
- 交付：`dist/customers/brother-duo/兄弟桌宠 Duo-1.0.0.exe`、`build-report.json`

- [ ] 语法：`node --check` 改过的 js。
- [ ] `node scripts/test-duo-controller.js`；`node scripts/test-capability-gates.js`；`node scripts/test-renderer-interaction.js`；`node scripts/test-duo-renderer-contract.js`；`node scripts/test-brother-duo-petpack.js`。
- [ ] 结束占用中的「兄弟桌宠 Duo」，然后：

```powershell
$env:CUSTOMER_ELECTRON_DIST="D:\Vibe_Coding\desktop-pet\node_modules\electron\dist"
npm run build:brother-duo
```

- [ ] 启动 EXE 手测：
  - 合体右键有「摸会儿鱼」；帐篷/展开菜单没有
  - 出场：边框+页内人 → 跳出 → 扛机+左盘右视频（静音）
  - 点人/点手机回合体漫游；拖窗不误收工
  - 摸鱼期不散步、不爬窗；头上 ticker 消失；画饼关键词不说话
  - 「收工了」菜单也能退出
- [ ] 交付说明列出已验证 / 未验证（含无数字签名）。跳过 commit。

---
