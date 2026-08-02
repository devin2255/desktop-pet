# 美杜莎侧边倚靠、交替走路与遇边掉头设计

日期：2026-08-02  
分支：`feat/medusa-pet`  
状态：待用户审阅完整文档  
前置：`docs/superpowers/specs/2026-08-02-medusa-pet-design.md`

## 目标

三项体验修复/增强（通用播放器优先，美杜莎补资源）：

1. **侧边倚靠**：拖到应用窗口左右边立刻倚靠停住，取消约 3 秒等待与自动爬到顶边。
2. **交替走路**：重生美杜莎 `walk`，呈现真正双腿交替迈步。
3. **遇边掉头**：漫游走到屏幕**工作区**左/右边缘时立刻转身，继续向反方向走（可持续来回踱步）。

## 决策摘要

| 项 | 决策 |
|---|---|
| 侧边行为 | 立刻 `lean` 贴边停住；不再 `climbHoldMs` 等待，不再爬顶 |
| 倚靠画面 | 新动画 `lean`（肩/背贴边），不用 climb 冒充 |
| 旧包无 `lean` | 侧边仍立刻贴边停住；动画回退 `climb` 或 `idle`，**仍不爬顶** |
| 走路资源 | 重生 6 帧右向交替步态；向左由播放器镜像 |
| 遇边掉头 | 工作区左右边界；walk 段内掉头不停成 idle |
| 非目标边缘 | 不因应用窗口左右边自动掉头（仅工作区）；顶/底互动不变 |

## 1. 播放器：侧边倚靠

### 行为

替换 `interaction-controller` 中侧边松手路径（现 `climbToTop`）：

- 命中窗口 `left` / `right` → `attach(..., role: 'lean', state: 'leaning')`
- 面向窗内（右边缘朝左，左边缘朝右）
- **删除**侧边路径上的 `await wait(climbHoldMs)` 与向顶边的 `animatePosition`
- 贴边轮询、拖离恢复 `normal` 与 perch/hang 同类

### 清单与校验

- `INTERACTION_ROLES` 增加 `lean`
- `pet.json` 可配置：

```json
"interactionActions": {
  "lean": { "action": "lean", "anchor": { "x": 0.15, "y": 0.55 } }
}
```

- renderer / controller 回退表为 `lean` 增加合理 fallback（如缺动画时用 `climb` 帧名或 `idle`）
- `climb` 角色可保留在清单中以兼容旧资源，但侧边入口不再调用爬顶逻辑

### 测试

更新 `scripts/test-interaction-controller.js`：

- 侧边松手 → 状态含 `lean-*`（或约定命名）
- `climbs.length === 0`（无爬顶行程）
- 不再依赖「hold 3s 后才 travel」的断言；删除或改写原 climb-hold 用例

## 2. 播放器：工作区遇边掉头

### 行为

漫游 `walk` 改为沿当前朝向持续移动（或等价的长段踱步），在工作区内：

- 触达右边界（`x + width >= workArea.right`）→ 朝向改为左，继续走
- 触达左边界（`x <= workArea.x`）→ 朝向改为右，继续走
- 掉头时切换 `walk-left` / `walk-right` 状态，**不**先切 idle
- 仍可由 `behavior.random` 权重在 walk 段结束后进入 sit/reaction 等；walk **段内**遇边只掉头

脚底仍贴工作区底边（沿用现有 y 计算）。

### 非目标

- 不检测任意应用窗口左右边作为漫游掉头条件
- 不改变顶边 perch / 底边 hang / 坠落

### 测试

新增或扩展主进程/漫游相关测试（若现有可测 harness；否则抽纯函数测「下一朝向/目标」）：

- 朝右走到右缘 → 下一朝向 left
- 朝左走到左缘 → 下一朝向 right

## 3. 美杜莎资源

| 动作 | 要求 |
|---|---|
| `lean` | ≥4 帧循环；肩/背贴不可见竖边；面向侧；金冠/白金礼服身份一致；左右安全边距 |
| `walk` | 重生 6 帧向右：接触→下压→路过→上提→对侧接触→对侧路过；**左右腿必须交替**出现在前方；禁止同腿始终领先的滑步感 |

流水线：定妆 master 参考 → per-frame/compose → chroma → `process_animation_strips` 并入现有画布/体量带 → 更新 `pets/library/medusa` → 重打包 `medusa.petpack` → 扩 `test-medusa-petpack.js`（断言存在 `lean`）→ `npm run build:medusa`。

`interactionActions` 增加 `lean`；可移除侧边对爬顶的依赖（`climb` 动画可暂留包内以免破坏引用，或一并保留供回退）。

## 制作与质量门禁

1. 重生 walk：目检 6 帧前腿左右交替；过切帧门禁  
2. 新 lean：过切帧门禁；侧靠可读  
3. `npm test`（含更新后的 interaction 测试）全绿  
4. 实机/CDP：侧边松手立即 lean 且不爬顶；漫游到工作区右缘后朝向变左并继续 walk  

## 非目标

- 不恢复侧边自动爬顶  
- 不为美杜莎在播放器写死角色名分支  
- 不改 `feat/laopo-pet` 资源内容（播放器通用变更会使旧包侧边也不再爬顶——这是预期产品行为）  
- 不做数字签名 / 商店上架  

## 风险

- 旧包用户失去「侧边爬顶」彩蛋：已用决策明确替换为倚靠；文档需说明  
- walk 重生若再次同腿领先，必须整条重生  
- 遇边掉头若与窗口互动状态机并发，须保证仅 `interaction.state() === 'normal'` 时漫游掉头  
- lean 锚点需按实帧微调，避免身子穿进窗口或离边过远  
