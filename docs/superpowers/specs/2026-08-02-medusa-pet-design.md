# 美杜莎桌面宠物设计（本分支演示基线）

日期：2026-08-02  
分支：`feat/medusa-pet`  
状态：待用户审阅完整文档

## 目标

在 `feat/medusa-pet` 上制作「美杜莎」桌宠，交付客户可直接使用的 Windows 便携版 EXE「美杜莎桌面宠物」。宠物身份、动画、台词与女声音频全部由 `.petpack` 提供；播放器通用能力保持不变，不为该角色写死分支。

老婆完整资料已保存在 `feat/laopo-pet`（提交 `072527f`）。本分支从该提交分出，功能面沿用现有通用播放器，仅切换演示基线与资源包。

## 决策摘要

| 项 | 决策 |
|---|---|
| 方案 | 标准 petpack 流水线 + 末尾切演示基线；生成阶段先定妆再派生（吸收定妆方案优点） |
| 名字 | 美杜莎 |
| 程序名 | 美杜莎桌面宠物 |
| package id / delivery-id | `medusa` |
| 性格 | 高冷、傲娇、女王范 |
| 风格 | 贴近参考图的 3D 国漫质感 |
| 形态 | 人形双腿（与参考图一致） |
| 默认待机 | 直立站立，气场微动 |
| 移动 | 直立散步（播放器镜像实现向左） |
| 语音 | `speechGender: female`，关键台词优先女声预录 mp3 |
| 启动问候 | 「本女王来了。」 |
| 专属动作 | `cold-smile`（冷笑）+ `heaven-python`（七彩吞天蟒短特效） |
| 老婆包 | 本分支不再作为演示基线；完整保留在 `feat/laopo-pet` |

## 角色外观锚点

基于用户提供的四张参考图，所有动画帧保持同一身份：

- 长直黑发，金质火焰/翼状高冠
- 白金礼服：白纱/白裙 + 金色胸甲与肩甲
- 冷艳五官、红唇、眼尾上扬妆
- 金色耳饰与项链；气质高冷、肩背挺直
- 人形双腿；不出现完整蛇尾常驻形态
- 「七彩吞天蟒」仅作短特效（蛇影/彩光一闪），不改变本体比例与脚底基线

参考图本地路径（gitignore，不进仓库）：`assets/references/medusa/`  
工作目录：`pets/work/medusa/`（定妆与源帧置于 `source/`）。

## 资源包与仓库基线切换

本分支演示位从 laopo 切换到 medusa：

- 输出包：`pets/packages/medusa.petpack`
- 解包库：`pets/library/medusa/`
- `package.json`：`validate:demo`、内置资源、`build:laopo` → `build:medusa`（指向 medusa 包与「美杜莎桌面宠物」）；`test:js` 中的 laopo 回归改为 medusa 回归
- `.gitignore`：发布例外从 `laopo.petpack` 改为 `medusa.petpack`
- 图标/托盘：生成 `assets/generated/medusa.ico` 与 `medusa-tray.png`，并更新 electron-builder 配置引用
- 文档：`README.md`、`AGENTS.md` 等演示说明改为 medusa
- 回归：新增 `scripts/test-medusa-petpack.js`，替换原 `test-laopo-petpack.js` 在测试入口中的位置
- 客户构建：

```powershell
npm run build:customer -- --pet pets/packages/medusa.petpack --name "美杜莎桌面宠物" --delivery-id medusa
```

播放器核心逻辑不按角色名分支；行为差异只写在 petpack 配置里。

## 动画清单

### 标准动作

| 动作 | 要求 |
|---|---|
| `idle` | 直立女王待机（呼吸/发丝/裙摆微动），≥4 帧 |
| `walk` | 向右直立踱步，≥6 帧；播放器镜像实现向左 |
| `sit` | 高冷端坐，≥4 帧 |
| `sleep` | ≥4 帧；`behavior.random` 禁止调度 |
| `reaction` | 被点击时冷傲短反应，≥4 帧 |

### 窗口互动动作（能力保留，角色重绘）

`drag`、`climb`、`perch`、`hang`、`fall`、`impact`、`pat-butt`（recover）

坐边锚点仍需保证屁股贴紧上边框（沿用现有 perch anchor 校验思路，按新立绘微调）。

### 坐上边框随机动作

| 动作 | 说明 | 台词 |
|---|---|---|
| `perch-chin-rest` | 坐边托腮俯视 | 无 |
| `perch-hair-sweep` | 坐边慢扫长发 | 无 |
| `perch-look` | 冷眼左右扫视 | 无 |

**移除老婆专属坐边：** `perch-hair-flip`、`perch-blow-kiss`（本包不包含）。

### 右键菜单动作

| id | 菜单标签 | 动作 | 气泡 | 语音 / 音频 |
|---|---|---|---|---|
| `cold-smile` | 冷笑 | 专属短动作（嘴角微扬/侧目） | 哼。 | speech「哼」，优先 `audio/cold-smile.mp3` |
| `heaven-python` | 七彩吞天蟒 | 短特效：蛇影/彩光一闪后收回 | 吞天。 | speech「吞天」，优先 `audio/heaven-python.mp3` |
| `kneel-before-me` | 跪安 | 抬手示意臣服 | 跪下。 | speech「跪下」，优先 `audio/kneel-before-me.mp3` |

**移除老婆专属菜单：** `call-hubby`、`kowtow`、`talent-show` 及对应甜蜜文案/音频。

### 漫游间隙互动

| 动作 | 气泡 / 语音 | 说明 |
|---|---|---|
| `inspect` | 看你表现 | 女王巡视姿态 |
| `command` | 侍奉本座 | 抬手吩咐 |
| `smirk-line` | 有趣 | 短冷笑台词 |

三者与 walk、sit、reaction、cold-smile 一起加权随机，**无固定顺序**。  
**移除老婆甜蜜漫游：** `serve-tea`、`love-you`、`praise`、`encourage`。

## 行为权重（初始建议，实现可微调）

### `behavior.random`

| state | weight | message |
|---|---|---|
| `walk` | 34 | — |
| `inspect` | 16 | 看你表现 |
| `command` | 14 | 侍奉本座 |
| `smirk-line` | 12 | 有趣 |
| `sit` | 12 | — |
| `reaction` | 6 | — |
| `cold-smile` | 6 | 哼。 |

不包含 `sleep`。`heaven-python` 仅通过右键菜单触发，不进入 random 池（避免特效过频与尺度风险）。

### `behavior.perched`

| state | weight |
|---|---|
| `perch-chin-rest` | 40 |
| `perch-hair-sweep` | 40 |
| `perch-look` | 20 |

## 语音与启动问候

1. `speechGender` 设为 `female`。
2. 关键台词优先预录女声 mp3；缺失时回退系统女声 TTS。
3. 本包不引用男声音频或老婆甜蜜台词。

启动问候：

```json
"startupGreeting": "本女王来了。"
```

使用已有可选字段 `startupGreeting`；不为美杜莎再改播放器问候逻辑。

## 制作与质量门禁

遵循 `desktop-pet-maker` 与仓库 `AGENTS.md`：

1. 用参考图生成全身定妆主图并确认身份锚点。
2. 由定妆派生绿幕动画条 → 去背 → `process_animation_strips.py`（安全边距/串帧/断肢门禁，失败必须重生成，禁止只擦越界碎片）。
3. 统一画布、不透明主体尺度、视觉重心与脚底基线。
4. `petpack_tool.py validate` + 打包 `medusa.petpack`。
5. 跑 `node scripts/test-renderer-interaction.js`、动画条测试、以及 `scripts/test-medusa-petpack.js`。
6. `npm run build:customer` 生成 EXE，实际启动验证：
   - 站立待机、散步、坐边托腮/扫发/扫视
   - 冷笑、七彩吞天蟒、跪安
   - 漫游随机「看你表现 / 侍奉本座 / 有趣」
   - 女声、透明背景与透明像素鼠标穿透
   - 静止连续点击 50 次无放大/平移
   - 拖动、朝向、右键菜单、托盘、退出、独立用户数据目录

## 非目标

- 不在本分支同时维护老婆演示包为第二基线
- 不为美杜莎角色在播放器里写死名字或菜单分支
- 不做数字签名 / 应用商店上架
- 不上传用户参考图到无关服务；原图与生成素材分目录保存
- 不做常驻蛇尾形态
- 不做完整剧情/对话树系统

## 风险与注意

- 3D 国漫风帧间漂移高于柔和 2D，必须先定妆再派生，并接受多轮重生。
- 金冠与肩甲尖锐轮廓易贴边串帧；源单元格左右安全边距必须加严检查。
- 「七彩吞天蟒」特效易引入额外连通块或尺度跳动；特效须短、主体尺度锁定，连续重播不得放大/缩小/平移。
- 白裙与金甲反光在去背时易留边缘杂质；需检查绿幕残留与碎边。
- 本分支替换基线后，依赖 `laopo.petpack` 路径的脚本/文档/gitignore/图标必须一并更新，避免半替换状态。
- 版权与发布：角色灵感来自公开作品形象，本交付定位为个人/客户定制桌宠；不宣称官方授权，不上架应用商店。
