# 旺财与咪咪 · Blender 免费制作规范

面向本仓库 `dog-and-cat` 双宠。只用 **Blender（免费）** + 本仓库脚本，不依赖付费 AI。

## 1. 目标

- 一只资源包里同时出现：柴犬「旺财」+ 橘猫「咪咪」
- 输出透明 PNG 帧 → 校验 → `.petpack` → 客户 EXE
- 风格：写实倾向即可（PBR 材质），不必上商业毛发插件

## 2. 目录约定（先跑脚手架）

在仓库根目录执行：

```powershell
python scripts/scaffold_blender_pet.py --pet-id dog-and-cat
```

会生成：

```text
pets/work/dog-and-cat-blender/
  blender/                 # 放 .blend 工程（本地，可不提交）
  renders/                 # Blender 渲染输出（按动作分子目录）
    idle/01.png ...
    walk/01.png ...
    sit/01.png ...
    sleep/01.png ...
    reaction/01.png ...
    drag/01.png ...
    climb/01.png ...
    perch/01.png ...
    hang/01.png ...
    fall/01.png ...
    impact/01.png ...
    recover/01.png ...
  preview.png              # 你从 idle 或 reaction 拷一张当预览
  NOTES.md                 # 检查清单
```

> `pets/work/` 默认被 gitignore，工程与渲染结果只保存在本地。

## 3. 动作与帧数（必须对齐）

| 动作 | 最少帧数 | 建议 | 循环 | 说明 |
|------|----------|------|------|------|
| idle | 4 | 4 | 是 | 轻微呼吸/眨眼 |
| walk | 6 | 6 | 是 | **朝右走**；向左由播放器镜像 |
| sit | 4 | 4 | 否 | 站→坐下，末帧可定格 |
| sleep | 4 | 4 | 是 | 已趴好后的微动 |
| reaction | 4 | 4 | 否 | 安静抬头/靠近，禁止夸张表情符号 |
| drag | 4 | 6 | 是 | 被拖起，四肢自然下垂 |
| climb | 4 | 6 | 是 | 侧边攀爬循环 |
| perch | 4 | 4 | 是 | 坐在上边框 |
| hang | 4 | 4 | 是 | 吊在下边框 |
| fall | 4 | 4 | 是 | 坠落姿势 |
| impact | 4 | 4 | 否 | 落地缓冲 |
| recover | 4 | 6 | 否 | 落地后站稳/抖一抖 |

文件名必须是：`01.png`、`02.png`…（两位数字，从 01 起）。

## 4. Blender 工程硬性规则

### 场景

- 单位：米；角色整体高度大约 **0.35–0.55 m**（桌宠显示小，比例统一即可）
- **正交相机**或固定透视，**所有动作共用同一台相机**
- 背景：**Transparent**（胶片透明），不要绿幕地板
- 灯光：一只主光 + 一只补光即可；各动作灯光锁定，避免明暗乱跳

### 角色

- 旺财、咪咪做成**同一集合**，永远一起出镜（方案 B）
- 两只角色之间左右位置固定：建议狗在左、猫在右
- 脚底对齐同一地面空物体 `Ground_Baseline`
- 尾巴必须完整自然收束，禁止被画幅裁切

### 命名（物体）

```text
Wangcai          # 狗网格
Mimi             # 猫网格
Rig_Wangcai      # 狗骨骼
Rig_Mimi         # 猫骨骼
Cam_Pet          # 唯一相机
Light_Key / Light_Fill
Ground_Baseline  # 空物体，脚底对齐参考
```

动作用 Action / NLA，名称与上表英文动作名一致：`idle`、`walk`…

### 渲染输出设置

- 引擎：Eevee（快）或 Cycles（更细，免费）
- 分辨率：**480 × 480**（与播放器画布一致，推荐直接渲染成这个尺寸）
- 色彩：Standard / Filmic 均可，但全动作保持一致
- 输出：PNG，RGBA，无压缩或中等压缩
- 输出路径示例：`//../renders/idle/`，文件名 `01.png` 起

每渲染完一个动作，目视检查：

1. 四角必须透明  
2. 主体不贴边（左右至少留约 4% 空白）  
3. 各帧主体大小肉眼一致，不突然放大缩小  
4. walk 朝右，脚底基线稳定  

## 5. 导入本仓库

渲染齐最少 5 个标准动作后：

```powershell
python scripts/import_blender_frames.py `
  --work-dir pets/work/dog-and-cat-blender `
  --pet-id dog-and-cat `
  --name "旺财与咪咪" `
  --personality "安静陪伴,亲近,默契"
```

脚本会：

1. 复制帧到 `pets/library/dog-and-cat/`
2. 生成 `pet.json`（含窗口互动与克制版右键文案）
3. 打印下一步校验命令

然后：

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/dog-and-cat
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/dog-and-cat pets/packages/dog-and-cat.petpack
node scripts/build-customer.js --pet pets/packages/dog-and-cat.petpack --name "桌面宠物" --delivery-id dog-and-cat
```

## 6. 建议制作顺序（降低返工）

1. 先出 **idle 4 帧** + preview，导入校验一次  
2. 再出 **walk 6 帧**（最难，先把基线钉死）  
3. sit / sleep / reaction  
4. 窗口互动：drag → perch → hang → climb → fall → impact → recover  

## 7. 明确不做（免费版）

- 不购买商业毛发/渲染插件  
- 不依赖付费 AI 视频  
- 不追求电影级毛发动力学；用法线/粗糙度做出“像真毛”即可  

## 8. 你现在可以立刻做的事

1. 安装 Blender：https://www.blender.org/download/  
2. 运行：`python scripts/scaffold_blender_pet.py --pet-id dog-and-cat`  
3. 新建工程保存到：`pets/work/dog-and-cat-blender/blender/dog-and-cat.blend`  
4. 按本页规则先渲染 `idle`  

做出 `idle/01.png`～`04.png` 后告诉我，我帮你跑第一次导入与校验。
