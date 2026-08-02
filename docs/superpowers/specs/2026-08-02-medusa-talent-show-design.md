# 美杜莎「上才艺」边跳边换装设计

日期：2026-08-02  
分支：`feat/medusa-pet`  
状态：待用户审阅完整文档  
前置：`docs/superpowers/specs/2026-08-02-medusa-pet-design.md`（美杜莎基线已交付）

## 目标

在现有美杜莎桌宠上追加右键「上才艺」：一条长互动动画内**一边跳舞一边换装**，造型顺序为白金礼服 → 黑金战甲 → 七彩鳞纹礼服 → 回到白金。播放器核心不改；差异全部落在 `.petpack`。

## 决策摘要

| 项 | 决策 |
|---|---|
| 方案 | 单条 `talent-show` 长动画（≥12 帧）内完成边跳边换装 |
| 换装风格 | 明显不同造型（非同套微调） |
| 造型顺序 | 白金礼服 → 黑金战甲 → 七彩鳞纹礼服 → 回白金 |
| 菜单标签 | 上才艺 |
| 气泡 | 给本座看好了。 |
| 语音 | 「看好了」，女声预录 `audio/talent-show.mp3` |
| 触发 | 仅右键菜单；不进 `behavior.random` |
| 日常外观 | idle/walk 等仍固定白金礼服 |

## 菜单与时长

| id | 标签 | action | 气泡 | speech | speechAudio | duration |
|---|---|---|---|---|---|---|
| `talent-show` | 上才艺 | `talent-show` | 给本座看好了。 | 看好了 | `audio/talent-show.mp3` | ≥5000ms |

动画：`frames.length >= 12`，`durations` 合计 ≥4000ms（与现有 laopo 才艺回归强度对齐）。

既有菜单保留：`cold-smile`、`heaven-python`、`kneel-before-me`。

## 动画分段（建议 12 帧）

| 帧 | 造型 | 动作要点 |
|---|---|---|
| 1–3 | 白金礼服（默认身份） | 起舞，确立节奏 |
| 4–6 | 黑金战甲 | 舞步中完成换装，甲片/黑金对比清晰 |
| 7–9 | 七彩鳞纹礼服 | 高潮舞步，鳞纹/彩光可读 |
| 10–12 | 回到白金礼服 | 收势，末帧可 hold |

### 硬约束

- 全程同一张脸、金冠、人形双腿；只换服装，不换角色身份
- 躯干视觉尺度、alpha 重心、脚底基线与现有库帧锁定；连续重播不得放大/缩小/平移
- 换装必须叠在舞蹈动作中，禁止静止站桩闪切
- 源单元格左右安全边距、无串帧、无显著独立连通块；失败则**整条重生**，禁止只擦碎片
- 与现有 `processed/frames` 同画布规范（当前库约 480×480、alpha 体量带）

## 制作流程

1. 以现有 `master` / idle 为白金基准；另出黑金战甲、七彩鳞纹两套关键定妆（可单帧）辅助一致性
2. 按分段生成 ≥12 帧绿幕舞蹈条（优先 per-frame + compose 过门禁，沿用 Task 3 流水线）
3. 去背 → `process_animation_strips.py` 并入同一 `processed/frames` 度量
4. 复制到 `pets/library/medusa/animations/talent-show/`
5. `edge-tts` 女声生成 `talent-show.mp3`（文本「看好了」，`zh-CN-XiaoxiaoNeural`）
6. 更新 `pet.json`：`animations.talent-show` + `contextMenuActions` 追加项
7. `petpack_tool.py validate` → 重打包 `pets/packages/medusa.petpack`
8. 扩展 `scripts/test-medusa-petpack.js` 断言菜单文案、音频路径、帧数与时长
9. 重建客户 EXE（`npm run build:medusa`）并验证右键「上才艺」

## 回归断言（最低）

- 存在 `contextMenuActions` 项 `talent-show`，`label=上才艺`，`message=给本座看好了。`，`speech=看好了`，`speechAudio=audio/talent-show.mp3`
- `duration >= 5000`
- `animations['talent-show'].frames.length >= 12`
- `durations` 合计 ≥ 4000
- 仍无 laopo 专属：`call-hubby` 等
- 原有三菜单仍在

## 非目标

- 不修改播放器状态机或多动作串联 API
- 不做换装收藏 / 永久换装状态
- 不把 `talent-show` 放入漫游 random
- 不改动 `feat/laopo-pet` 老婆包
- 不做数字签名 / 商店上架

## 风险

- 三套造型跨帧身份漂移：每段必须以 master 脸/冠为硬参考
- 七彩鳞纹易引入额外连通块或尺度跳动：特效附着主体，忌大块游离光斑
- 黑金战甲轮廓尖锐易贴边串帧：安全边距加严
- 重归一化时勿再次把全库压到过小 alpha；优先只增量处理 talent-show 并入现有体量带
