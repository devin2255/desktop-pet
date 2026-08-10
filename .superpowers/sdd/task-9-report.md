# Task 9 Report — 开发版手测 + 客户 EXE

**Status:** PASS（自动化项已验证；视觉手测项待人工）  
**Date:** 2026-08-04  
**Delivery id:** `xiaomei-xiaotian`  
**Commit:** none（按指示不提交；仅修了客户构建 `files` 列表）

## Summary

回归门禁全部通过；客户便携版 EXE 已构建并短暂实机启动。修复 `scripts/build-customer.js` 漏打 `src/sequence-controller.js`（否则客户包运行时无法 `require` 序列引擎）。`delivery.json` 中 `allowPetManagement: false`，导入/切换/宠物库入口已隐藏。

## Artifacts

| 产物 | 路径 |
|---|---|
| 客户 EXE | `dist/customers/xiaomei-xiaotian/小美&小甜桌面宠物-1.0.0.exe` |
| 构建报告 | `dist/customers/xiaomei-xiaotian/build-report.json` |
| 构建脚本修复 | `scripts/build-customer.js`（加入 `src/sequence-controller.js`） |

### build-report.json（要点）

- `appName`: 小美&小甜桌面宠物  
- `version`: 1.0.0  
- `petpackSha256`: `593a62a884959601afe6b14b210ab2311cc8713abc690dd6a9f23b376c4803f7`  
- `executableSha256`: `7568ab75091b57dd7ad0759085e1f53e75368a63427ae0c6d1df3d8c4f49308f`  
- `signExecutable`: false（未做数字签名）

## Step 2 — 回归门禁

```text
npm run test:regression          → PASS
node scripts/test-sequence-controller.js → ok
node scripts/test-sequences-schema.js    → ok
node scripts/test-bestie-petpack.js      → ok
```

## Step 1 — 开发版（npm start）

- 命令：`npm start`（Electron userData：`%APPDATA%\desktop-pet`）
- 已确认 `player-settings.json` 的 `petId` = `xiaomei-xiaotian`
- 库内已解包 `pets/xiaomei-xiaotian`，16 套动画，`sequences.relax` 存在
- 菜单动作标签可读：贴贴 / 合个影 / 说悄悄话 / 加油鸭 / 去放松 / 去睡觉
- 进程可启动；**未做**完整 GUI 手测（见未验证）

如何手动加载 bestie：开发版会 `ensureBundledPets()` 导入 `pets/packages/*.petpack`；右键托盘「切换宠物」选「小美&小甜」，或写入 `%APPDATA%\desktop-pet\player-settings.json` 的 `petId` 后重启。

## Step 3–4 — 客户 EXE

- 构建：`npm run build:bestie`（第二次因 Electron CDN 超时失败；第三次设 `CUSTOMER_ELECTRON_DIST=node_modules/electron/dist` 成功）
- ASAR 含：`src/sequence-controller.js`、`delivery/delivery.json`、`delivery/pet.petpack`
- `allowPetManagement: false`
- 实机启动：便携进程树存活；独立 userData  
  `%APPDATA%\Desktop Pet Deliveries\xiaomei-xiaotian\`  
  含 `player-settings.json`（petId / deliveryPackageSha256）与解包宠物目录

## Verified checklist

- [x] 回归门禁（renderer interaction + strip safety）
- [x] sequence controller / sequences schema / bestie petpack 测试
- [x] 客户 EXE 产物 + build-report.json
- [x] EXE 可启动、独立 userData、内置 pet 解包
- [x] ASAR 含 sequence-controller + delivery 配置
- [x] 客户模式隐藏导入 / 切换宠物 / 打开宠物库（配置 + 主进程逻辑）
- [x] 开发版可加载 xiaomei-xiaotian（settings + 库目录）
- [x] 构建脚本补齐 sequence-controller 打包

## Unverified（需人工 GUI）

- [ ] 双人同框 idle/walk/坐/睡/点击 reaction 观感
- [ ] 拖拽「拖着屁股走」与松手恢复
- [ ] 菜单：贴贴/合影/悄悄话/加油鸭/睡觉 实际播放
- [ ] 去放松全流程（化妆→换装→跑→男模+「我要这个」暂停→再点→拥抱→娇羞→回日常）
- [ ] 暂停时拖拽中断回 idle
- [ ] 透明像素鼠标穿透
- [ ] 静止连点 50 次无缩放/平移
- [ ] 托盘退出交互细节
- [ ] 数字签名（未做；`signExecutable: false`）

## Concerns

1. 客户构建依赖网络拉 Electron；离线/超时需设 `CUSTOMER_ELECTRON_DIST`。
2. 首次成功构建曾漏打 `sequence-controller.js`；已修复并重建。若只用旧 EXE 会运行失败。
3. 控制台对中文 EXE 文件名可能乱码；路径以 UTF-8 `build-report.json` 为准。
4. 完整手测清单仍需人工在桌面完成后再标「已交付」。

## Commit

- **No commit.**

## Final branch review fix (2026-08-04)

- **Issue:** 菜单启动序列时，若先 `cancel({ schedule: false })` + `pauseBehavior()`，随后 `sequence.start` 返回 `false`，日常漫游不会恢复。
- **Fix:** `runContextMenuAction` 在 `start` 为 `false` 时调用 `scheduleBehavior(900)`；成功路径不变。
- **Tests:** `node scripts/test-sequence-controller.js`、`node --check src/main-v3.js`。
