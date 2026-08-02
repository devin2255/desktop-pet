### Task 11: 客户 EXE 构建与实机验收

**Files:**
- Output: `dist/customers/laopo/`（EXE + `build-report.json`）
- Create: `outputs/laopo-verification-report.json`（记录已验证/未验证项）

- [ ] **Step 1: 回归门槛**

```powershell
npm run test:regression
npm test
```

Expected: PASS；失败禁止打包。

- [ ] **Step 2: 构建**

```powershell
npm run build:laopo
```

或：

```powershell
npm run build:customer -- --pet pets/packages/laopo.petpack --name "老婆桌面宠物" --delivery-id laopo
```

- [ ] **Step 3: 实际启动 EXE，逐项勾选**

- 启动气泡「老公，我来啦~」
- 站立 idle、直立散步
- 右键：叫老公 / 磕头 / 上才艺（扭屁股）
- 漫游随机：老公喝茶、爱你老公、宝贝真棒、老公辛苦了（无固定顺序）
- 女声（预录或 TTS）
- 坐边：撩头发、飞吻、左看右看；无跷二郎腿打电话
- 透明穿透、拖动、朝向、托盘、退出、独立数据目录
- 静止连点 50 次无缩放/平移

- [ ] **Step 4: 写 verification report，交付路径告诉用户**

未完成项（如代码签名）必须标明未验证。

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|---|---|
| 替换本分支演示基线为 laopo | 9, 10 |
| 站立 idle + 散步 walk | 4, 8 |
| 移除跷二郎腿打电话；撩发+飞吻 | 6, 8 |
| 叫老公 / 磕头「给老公磕头了」/ 上才艺扭屁股 | 6, 7, 8 |
| 老公喝茶 + 三句甜蜜随机 | 6, 7, 8 |
| 女声 | 7, 8 |
| startupGreeting | 1, 8 |
| behavior speechAudio | 2, 8 |
| 窗口互动保留 | 5, 8 |
| 校验+EXE+实机 | 9, 11 |

## Self-Review Notes

- 无 TBD/TODO 占位；音频与动画文件名在 Task 6–8 已固定。
- `speech` 字段最长 20 字：所用中文台词均合规。
- `test-petpack-security` fixture 必须在 laopo 包存在后切换（Task 9），不要在 Task 1 就删 boss 包。
- 出图 Task 4–6 耗时最长；门禁失败只重生成失败条，勿跳过 `process_animation_strips`。
