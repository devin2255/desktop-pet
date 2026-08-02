# 侧边倚靠、交替走路与遇边掉头 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 侧边立刻倚靠停住（取消 3s 爬顶）；美杜莎 walk 重生为双腿交替；漫游遇工作区左右边立刻掉头继续走。

**Architecture:** 播放器通用：`lean` 互动角色 + 漫游边界掉头；美杜莎补 `lean`/`walk` 资源并重打包。先改测试（TDD），再改 controller/main，再生成资源。

**Tech Stack:** Electron `src/interaction-controller.js` / `src/main-v3.js`、validator、Node 测试、desktop-pet-maker 切帧流水线。

**Spec:** `docs/superpowers/specs/2026-08-02-medusa-lean-walk-roam-design.md`

## Global Constraints

- 分支：`feat/medusa-pet`
- 侧边：立刻 lean，无 climbHold 等待，无爬顶
- 旧包无 lean：仍立刻贴边停住，动画回退 climb/idle，不爬顶
- walk：6 帧右向，左右腿交替；向左镜像
- 遇边掉头：仅屏幕工作区左右；walk 段内掉头不 idle
- 不写死美杜莎角色名
- **Git：** pets/work、pets/library 不提交；可提交 src/tests/petpack/docs
- 每 Task 跑列明验证后再继续

## File Structure

| Path | Responsibility |
|---|---|
| `src/petpack-validator.js` | `lean` in INTERACTION_ROLES |
| `skills/.../petpack_tool.py` | 对齐 lean 角色 |
| `src/interaction-controller.js` | 侧边 → lean stay |
| `src/renderer-v3.js` | lean fallback |
| `src/main-v3.js` | 工作区遇边掉头漫游 |
| `scripts/test-interaction-controller.js` | 侧边不爬顶 |
| `scripts/test-roam-edge-turn.js`（新建）或扩现有 | 掉头纯逻辑 |
| `pets/work/medusa/...` | lean + walk 重生 |
| `pets/packages/medusa.petpack` | 重打包 |
| `scripts/test-medusa-petpack.js` | 断言 lean |

---

### Task 1: Validator + interaction 测试先红/先改

**Files:**
- Modify: `src/petpack-validator.js`
- Modify: `skills/desktop-pet-maker/scripts/petpack_tool.py`（若有 INTERACTION_ROLES 镜像）
- Modify: `scripts/test-interaction-controller.js`
- Create or modify: roam edge-turn unit test

- [ ] **Step 1: 允许 `lean` 角色**

`INTERACTION_ROLES` 增加 `'lean'`。Python 侧同步。

- [ ] **Step 2: 改 interaction 测试期望**

侧边松手：
- 进入 lean/贴边状态（按实现命名，如 `lean-right`）
- `climbs.length === 0`
- 改写原 `climbHoldMs=3000` 后爬顶用例 → 断言**不会**在 hold 后产生 climb travel

- [ ] **Step 3: 写掉头纯函数测试（可先抽到小模块）**

建议抽 `src/roam-edge.js`：

```js
function nextRoamFacing(facing, x, width, workArea) {
  if (facing === 'right' && x + width >= workArea.x + workArea.width) return 'left';
  if (facing === 'left' && x <= workArea.x) return 'right';
  return facing;
}
```

测试：右缘→left；左缘→right；中间不变。

- [ ] **Step 4: 跑测试**

```powershell
node scripts/test-interaction-controller.js
node scripts/test-roam-edge-turn.js
```

interaction 在实现前应红（若已先改断言）；edge-turn 在抽模块后绿。

- [ ] **Step 5: Commit 测试 + validator 增量（可与 Task 2 同交或先交测试）**

---

### Task 2: 实现 lean 侧边停住

**Files:**
- Modify: `src/interaction-controller.js`
- Modify: `src/renderer-v3.js`
- Modify: `src/main-v3.js`（若需传入 lean 配置）

- [ ] **Step 1: 实现 `leanOnSide`（替换侧边 `climbToTop` 调用）**

```js
function leanOnSide(target, pointer, edge, token) {
  const sideOffset = pointer.y - target.bounds.y;
  const clingFacing = edge === 'right' ? 'left' : 'right';
  attach(target, edge, sideOffset, 'lean', 'leaning', { facing: clingFacing });
}
```

`actionFor('lean')`：manifest 有则用；否则回退 `'climb'` 或 `'idle'`。  
锚点：manifest `interactionActions.lean.anchor`，缺省侧边合理默认。

- [ ] **Step 2: renderer FALLBACKS 增加 `lean: 'idle'`（或 climb）**

- [ ] **Step 3: 跑 interaction 测试至绿**

```powershell
node scripts/test-interaction-controller.js
```

- [ ] **Step 4: Commit**

```powershell
git add src/interaction-controller.js src/renderer-v3.js src/petpack-validator.js skills/desktop-pet-maker/scripts/petpack_tool.py scripts/test-interaction-controller.js
git commit -m "feat: lean on window side edges instead of climbing"
```

---

### Task 3: 实现工作区遇边掉头漫游

**Files:**
- Create: `src/roam-edge.js`（若 Task 1 未建则此处建）
- Modify: `src/main-v3.js`（`walkTo` / 漫游循环）
- Modify: `package.json` `test:js` 加入新测试（若新建）

- [ ] **Step 1: 漫游 walk 沿朝向移动**

在 walk 定时器中每帧/每 tick：
- 按 facing 增减 x
- 用 `nextRoamFacing` 检测边界；若朝向改变则 `sendState('walk-' + facing)` 并继续
- walk 段可用 `minDuration/maxDuration` 控制多久后结束并 `scheduleBehavior`；段内遇边不 idle

- [ ] **Step 2: 测试绿 + 手动心智检查**

```powershell
node scripts/test-roam-edge-turn.js
node --check src/main-v3.js
```

- [ ] **Step 3: Commit**

```powershell
git add src/roam-edge.js src/main-v3.js scripts/test-roam-edge-turn.js package.json
git commit -m "feat: turn around at work-area edges while roaming"
```

---

### Task 4: 重生 walk + 新 lean 资源并打包

**Files:**
- `pets/work/medusa/...` walk/lean strips
- `pets/library/medusa/`
- `pets/packages/medusa.petpack`
- `scripts/test-medusa-petpack.js`

- [ ] **Step 1: 重生 walk 6 帧（强制交替腿）** 过门禁

- [ ] **Step 2: 生成 lean ≥4 帧** 过门禁

- [ ] **Step 3: 更新 pet.json**

```json
"lean": { "frames": [...], "durations": [...], "loop": true, "scale": 1 },
"interactionActions": {
  "lean": { "action": "lean", "anchor": { "x": 0.15, "y": 0.55 } }
}
```

保留其他 interactionActions；bump `packageVersion`（如 0.1.2）。

- [ ] **Step 4: validate / build / test-medusa-petpack（断言 lean）/ npm test**

- [ ] **Step 5: `npm run build:medusa`**

- [ ] **Step 6: Commit petpack + tests**

```powershell
git commit -m "feat: Medusa lean frames and alternating walk cycle"
```

---

## Spec Coverage

| Spec | Task |
|---|---|
| lean 角色 + 侧边不爬顶 | 1–2 |
| 旧包回退不爬顶 | 2 |
| 工作区遇边掉头 | 1, 3 |
| walk 交替 / lean 资源 | 4 |
| 回归 + EXE | 4 |
