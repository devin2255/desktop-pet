# 老婆桌面宠物设计（替换本分支演示基线）

日期：2026-08-01  
分支：`feat/laopo-pet`  
状态：已评审待实现

## 目标

在 `feat/laopo-pet` 上将演示基线从「牛斯克 / 老板桌宠」替换为「老婆」角色，交付客户可直接使用的 Windows 便携版 EXE「老婆桌面宠物」。宠物身份、动画、台词与女声音频全部由 `.petpack` 提供；播放器仅增加可选的通用启动问候字段以支持自定义文案。

## 决策摘要

| 项 | 决策 |
|---|---|
| 方案 | 本分支原地替换演示基线（方案 1） |
| 名字 | 老婆 |
| 程序名 | 老婆桌面宠物 |
| package id / delivery-id | `laopo` |
| 性格 | 俏皮、粘人、甜蜜 |
| 风格 | 柔和写实 2D 插画风 |
| 默认待机 | 直立站立 |
| 移动 | 直立散步（不再爬行） |
| 语音 | `speechGender: female`，关键台词优先女声预录 mp3 |
| 启动问候 | 「老公，我来啦~」 |
| 磕头 | 保留，重做成女性版，气泡「给老公磕头了」 |
| 老板包 | 本分支不再保留为演示基线；`main` 仍有老板历史 |

## 角色外观锚点

基于用户提供的全身照与近景照，所有动画帧保持同一身份：

- 长直黑发，头上架墨镜
- 米白/奶油色无袖长裙
- 黑色蕾丝/网纱短袖内搭
- 厚底黑色凉鞋
- 东方面孔、精致睫毛、浅笑表情

工作目录：`pets/work/laopo/`（参考图已置于 `source/refs/`）。

## 资源包与仓库基线切换

本分支演示位从 boss 切换到 laopo：

- 输出包：`pets/packages/laopo.petpack`（本分支移除演示位上的 `boss.petpack`，避免双基线）
- 解包库：`pets/library/laopo/`（本分支不再以 `pets/library/boss/` 作为演示库）
- `package.json`：`validate:demo`、内置资源、`build:boss` → `build:laopo`（指向 laopo 包与「老婆桌面宠物」）
- 文档：`README.md`、`AGENTS.md`、`ASSETS_LICENSE.md` 演示说明改为 laopo
- 回归：`scripts/test-boss-petpack.js` 改为 `scripts/test-laopo-petpack.js`，断言新菜单、台词、坐边动作与女声配置
- 安全/夹具测试里若硬编码 `boss.petpack` 路径，一并改到 `laopo.petpack`
- 客户构建：

```powershell
npm run build:customer -- --pet pets/packages/laopo.petpack --name "老婆桌面宠物" --delivery-id laopo
```

播放器核心逻辑不按角色名分支；行为差异只写在 petpack 配置里。

## 动画清单

### 标准动作

| 动作 | 要求 |
|---|---|
| `idle` | 直立待机微动（呼吸/发丝），≥4 帧 |
| `walk` | 向右直立散步，≥6 帧；播放器镜像实现向左 |
| `sit` | ≥4 帧 |
| `sleep` | ≥4 帧；`behavior.random` 禁止调度 |
| `reaction` | 俏皮反应，≥4 帧 |

### 窗口互动动作（能力保留，角色重绘）

`drag`、`climb`、`perch`、`hang`、`fall`、`impact`、`pat-butt`（recover）

坐边锚点仍需保证屁股贴紧上边框（沿用现有 perch anchor 校验思路，按新立绘微调）。

### 坐上边框随机动作

| 动作 | 说明 | 台词 |
|---|---|---|
| `perch-hair-flip` | 坐边俏皮撩头发 | 无 |
| `perch-blow-kiss` | 坐边飞吻 | 无 |
| `perch-look` | 左看右看 | 无 |

**移除：** `perch-cross-phone` 及「喂, 军儿吗?」相关帧、行为与文案。

### 右键菜单动作

| id | 菜单标签 | 动作 | 气泡 | 语音 / 音频 |
|---|---|---|---|---|
| `call-hubby` | 叫老公 | 招手/呼唤 | 老公! | speech「老公」，`audio/call-hubby.mp3` |
| `kowtow` | 磕头 | 女性版磕头 | 给老公磕头了 | 仅气泡（不强制预录音频） |
| `talent-show` | 上才艺 | 扭屁股舞蹈 | 上才艺! | speech「上才艺」，`audio/talent-show.mp3` |

**移除：** `call-dad`（叫大爷）、`self-slap`（错了没?/我真该死）及男声音频。

### 漫游间隙互动

| 动作 | 气泡 / 语音 | 说明 |
|---|---|---|
| `serve-tea` | 老公喝茶 | 端茶送水，保留较高权重 |
| `love-you` | 爱你老公 | 散步间隙随机 |
| `praise` | 宝贝真棒 | 散步间隙随机 |
| `encourage` | 老公辛苦了 | 散步间隙随机 |

三者与端茶、walk、sit、reaction 一起加权随机，**无固定顺序**。

## 行为权重（初始建议，实现可微调）

### `behavior.random`

| state | weight | message |
|---|---|---|
| `walk` | 32 | — |
| `serve-tea` | 22 | 老公喝茶 |
| `love-you` | 10 | 爱你老公 |
| `praise` | 10 | 宝贝真棒 |
| `encourage` | 10 | 老公辛苦了 |
| `sit` | 10 | — |
| `reaction` | 6 | — |

不包含 `sleep`。

### `behavior.perched`

| state | weight |
|---|---|
| `perch-hair-flip` | 40 |
| `perch-blow-kiss` | 40 |
| `perch-look` | 20 |

## 语音与启动问候

1. `speechGender` 设为 `female`。
2. 关键台词优先预录女声 mp3；缺失时回退系统女声 TTS。
3. 删除本包对男声音频的引用。

### 通用播放器小改动

当前主进程启动问候写死为「我是{名字}。」（见 `src/main-v3.js`）。增加可选清单字段：

- `startupGreeting`（string，可选）

行为：

- 若清单提供非空 `startupGreeting`，启动与切换宠物时使用该文案；
- 否则保持现有「我是{名字}。」/「你好，我是{名字}。」兼容旧包。

老婆包设置：

```json
"startupGreeting": "老公，我来啦~"
```

## 制作与质量门禁

遵循 `desktop-pet-maker` 与仓库 `AGENTS.md`：

1. 用参考图生成绿幕动画条 → 去背 → `process_animation_strips.py`（安全边距/串帧/断肢门禁，失败必须重生成）。
2. 统一画布、不透明主体尺度、视觉重心与脚底基线。
3. `petpack_tool.py validate` + 打包 `laopo.petpack`。
4. 跑 `node scripts/test-renderer-interaction.js`、动画条测试、以及新的 laopo petpack 回归测试。
5. `npm run build:customer` 生成 EXE，实际启动验证：
   - 站立待机、散步、坐边撩发/飞吻、叫老公、磕头、上才艺扭屁股
   - 漫游随机「老公喝茶 / 爱你老公 / 宝贝真棒 / 老公辛苦了」
   - 女声、透明背景与透明像素鼠标穿透
   - 静止连续点击 50 次无放大/平移
   - 拖动、朝向、右键菜单、托盘、退出、独立用户数据目录

## 非目标

- 不在本分支同时维护老板演示包为第二基线
- 不为老婆角色在播放器里写死名字或菜单分支
- 不做数字签名 / 应用商店上架
- 不上传用户原始照片到无关服务；原图与生成素材分目录保存

## 风险与注意

- 长裙散步/扭屁股需特别检查裙摆串帧与脚底基线稳定。
- 坐边撩发、飞吻需验证 perch 锚点，避免「悬空坐」或窗框穿模。
- 自定义 `startupGreeting` 必须保持可选，避免破坏旧 petpack。
- 本分支替换基线后，依赖 `boss.petpack` 路径的脚本/文档必须一并更新，避免半替换状态。
