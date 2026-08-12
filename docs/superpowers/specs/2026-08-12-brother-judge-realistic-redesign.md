# 兄弟判官：照片级写实全套动画重做设计

日期：2026-08-12  
状态：待用户审阅规格  
分支：`feature/brother-judge-bubble-copy`（实施时可继续本分支或另开资产分支）

## 1. 背景与目标

当前 `brother-judge` 动画偏动漫风，与用户实拍人脸差距大；右键「磕头」尚无专用动画，暂用 `reaction` 顶替。

目标：

1. 全套动画改为**照片级写实**，脸部贴近用户原片细节（五官、笑容、发型、眼镜）。
2. 服装保持接地气判官设定：**白背心 + 深色大裤衩 + 人字拖 + 判官帽**（不以实拍工装衬衫为准）。
3. 新增专用 `kowtow`（磕头）动画，并接到右键菜单。
4. 验证后更新 `.petpack`，并按仓库约定构建客户专属便携 EXE。

## 2. 已确认决策

| 决策点 | 结论 |
| --- | --- |
| 服装 | 脸按实拍；衣服仍用白背心 / 大裤衩 / 人字拖 / 判官帽 |
| 范围 | 全套重做 + 新增磕头专帧 |
| 风格 | 照片级写实（皮肤、眼镜反光、布料纹理尽量贴近原片） |
| 流程 | 方案 A：先定妆主图，用户确认后再衍生全套动画条 |
| 文案 | 保留当前气泡 / 菜单 / 画饼雷达词库，不回退旧判官文言 |

## 3. 参考原片（只读，不覆盖）

| 文件 | 用途 |
| --- | --- |
| `pets/work/brother-judge/source/refs/ref-face-closeup.png` | **主身份锚点**：脸型、五官、短发、浅胡茬、银色细圆框眼镜 |
| `pets/work/brother-judge/source/refs/ref-portrait.png` | **表情与帽饰参考**：戴判官帽时的笑容、帽翅与白珠边结构 |

说明：两张图眼镜款式不完全一致。定妆与全套动画统一采用特写图的**银色细圆框眼镜**作为稳定身份特征；判官帽造型以戴帽照为准。

## 4. 定妆主图

- 产出：`pets/work/brother-judge/source/refs/master-realistic.png`（以及生成原文归档到 `generated-originals/`，不覆盖原片）。
- 内容：全身站姿、朝右或正面偏右、绿幕或纯色底、无文字无投影无边框。
- 身份锁定：特写脸 + 圆框眼镜 + 判官帽（珠边长翅）+ 白背心 + 深色大裤衩 + 人字拖；可持判官笔作为性格道具（不挡脸）。
- **硬门禁**：主图未经用户确认，不得批量生成动画条。

## 5. 动画范围与帧数

| 动作 | 帧数 | 备注 |
| --- | --- | --- |
| idle / sit / sleep / reaction | 4 | 标准动作 |
| walk | 6 | 朝右；左转由播放器镜像 |
| drag / climb / recover / crawl | 6 | 窗口互动 / 跪爬 |
| perch / hang / fall / impact | 4 | 窗口互动 |
| **kowtow** | **6** | **新增**；鞠躬磕头，帽翅随头动，无气泡无语音 |

切帧与归一化走现有 `process_animation_strips.py` 门禁：安全边距、无串帧、无断肢/断帽翅、统一画布、视觉体量与脚底基线；互动连点 50 次无缩放/平移。

旧动漫素材保留在 `pets/work/brother-judge/raw/`（或归档子目录），新写实条写入新的 `source/realistic/` 工作流目录，避免覆盖不可恢复的生成原文。

## 6. 配置变更

更新 `pets/library/brother-judge/pet.json`：

- `animations.kowtow`：6 帧，非循环，`holdLastFrame: true`
- `contextMenuActions` 中「磕头」：`action: "kowtow"`，不含 `message` / `speech`
- 其余文案与 `watch` 词库保持现状

播放器无需为磕头新增硬编码；只要 petpack 提供动画即可。

## 7. 交付物

1. 更新后的 `pets/library/brother-judge/` 帧与清单  
2. `pets/packages/brother-judge.petpack`（validate 通过）  
3. `npm run build:customer -- --pet pets/packages/brother-judge.petpack --name "兄弟判官桌面宠物" --delivery-id brother-judge`  
4. 实际启动抽查：启动问候、随机行为气泡、叫爸、磕头、睡会儿、漫游、爬行、窗口互动抽样、画饼雷达词库仍可用（监听本身不因本次资产改版而改逻辑）  
5. `build-report.json` 与已验证 / 未验证清单

## 8. 风险与降级

- 照片级写实在桌宠小尺寸下可能显“真人缩小版”，且跨条易漂脸。
- 缓解：主图锁定 → 每条 strip 强制附带主图 + 两张原片 → 联系表人工对照。
- 若单条反复不过关：该条可降到「柔和写实」，但眼镜、脸型、笑容必须仍能认出是同一人；不得回到当前动漫脸。

## 9. 非目标

- 不改播放器通用架构与画饼雷达协议  
- 不把服装改成实拍工装衬衫  
- 不上传原片到无关第三方服务；原图与生成图分目录保存  
