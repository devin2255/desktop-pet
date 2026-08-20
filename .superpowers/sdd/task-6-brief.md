### Task 6: 客户 EXE 构建与实机抽查

**Files:**
- Create/Update: `delivery/brother-judge/`（或 build-customer 默认输出目录）
- Create/Update: `build-report.json`

**Interfaces:**
- Consumes: 校验通过的 `pets/packages/brother-judge.petpack`
- Produces: 可双击 EXE + 验证记录

- [ ] **Step 1: 构建**

```powershell
npm run build:customer -- --pet pets/packages/brother-judge.petpack --name "兄弟判官桌面宠物" --delivery-id brother-judge
```

Expected: 生成便携 EXE 与报告。

- [ ] **Step 2: 实机启动抽查清单**

- [ ] 双击 EXE 宠物直接出现（独立 userData）
- [ ] idle/walk/sit/sleep/reaction 为写实脸，可认出原片本人
- [ ] 右键「叫爸」气泡「爸」；「磕头」无文案但播 kowtow；「睡会儿」正常
- [ ] 透明像素鼠标穿透；静止连点无放大平移
- [ ] 漫游、左右朝向、跪爬模式、托盘退出

- [ ] **Step 3: 写验证结果并提交报告**

在 `build-report.json` 或交付说明中列出已验证 / 未验证项（含数字签名等未完成项）。

```powershell
git add delivery/brother-judge build-report.json 2>$null
git commit -m "build: brother-judge photoreal customer delivery"
```

---

## Spec coverage self-review

| Spec 要求 | Task |
| --- | --- |
| 照片级写实 + 脸按特写 + 帽按戴帽照 | Task 1–3 |
| 服装白背心大裤衩人字拖 | Task 1 IDENTITY + 所有 prompt |
| 方案 A 主图门禁 | Task 1 Step 3 |
| 全套动作重做 | Task 2–3 |
| 新增 kowtow 并接线菜单 | Task 4 |
| 安全切帧 / 归一化 / 不擦碎片 | Task 5 |
| 保留文案与 watch | Task 4 不改文案字段 |
| petpack + 客户 EXE 交付 | Task 5–6 |
| 原片不覆盖、分目录 | Global + Task 1/5 路径 |

## Placeholder scan

无 TBD/TODO；命令与 JSON 均为完整内容。
