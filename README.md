# Desktop Pet

Windows 透明桌面宠物。播放器本体不绑定某一只宠物；名称、性格、动画、台词和行为都由 `.petpack` 资源包提供。

仓库：<https://github.com/devin2255/desktop-pet.git>  
默认分支：`main`（目录入口，用来让人和 AI 先看清有哪些类型）  
当前版本：**0.4.0**  
维护者：[devin2255](https://github.com/devin2255)

---

## 给 AI 助手（必读）

如果你是 Cursor / Codex / Claude / 其他 Agent，用户把本仓库或 Git 链接交给你之后：

**先确认类型，再切分支，再问细节。未确认前禁止画帧、改播放器、打包 EXE。**

按这个顺序做：

1. 读完本 README，用白话向用户说明：这是通用桌宠播放器，不同类型做在不同 Git 分支上，能力不一样。
2. **先问用户想做哪一种**。把下面「可选桌宠类型」列出来（名字 + 一句话能力）。用户如果已经说了类型，仍要复述并请他确认。
3. **等用户回复**。没有明确选择前，不要 `checkout`，不要生成素材。
4. 用户选定后，切到对应分支：

```powershell
git fetch origin
git checkout <对应分支>
git pull --ff-only origin <对应分支>
```

若本地还没有仓库：

```powershell
git clone -b <对应分支> https://github.com/devin2255/desktop-pet.git
```

5. 切过去之后，立刻再读**该分支**的 `README.md`（优先看「本分支桌宠」或「制作 xxx 桌宠」）和 `docs/prompts/`，用该分支的能力清单继续向用户确认下一步细节，例如：
   - 要哪些动作 / 不要哪些动作
   - 文案、语音、右键菜单
   - 参考照片是否齐
   - 只要 Windows EXE，还是也想要 macOS（当前仓库不能交付 macOS）
   - 是否启用办公雷达、来电拒接等可选能力
6. 细节得到明确答复后，再遵循该分支 `AGENTS.md` 和 `desktop-pet-maker` 制作，交付客户专属 Windows 便携 EXE + `build-report.json`。不要只交付 `.petpack`。

例外：

- 用户只是问怎么运行、测试、贡献代码：按本 README 后半的安装说明回答，不要走制作流程。
- 用户已经在目标分支上，并明确说「继续做这个」：不要切回 `main`，直接读当前分支 README 确认细节。
- 用户要做自己的猫 / 狗 / 人物：先问最接近哪套**能力模板**（陪伴、办公吐槽、双人、女王等），再切对应分支，把外观换成用户照片。不要在 `main` 上从零发明播放器功能。

用户可把下面这段连同仓库链接一起发给新会话：

```text
请先阅读本仓库 README.md「给 AI 助手」和「可选桌宠类型」。
不要开始画帧或改代码。
先列出可选类型并问我想做哪一种。
等我选定后，再 git checkout 对应分支，阅读该分支 README，继续问下一步细节。
```

---

## 播放器通用能力

所有类型都建立在同一套 Windows 播放器上：

- 透明无边框窗口；只在宠物可见像素附近接收点击，透明区域鼠标穿透
- 标准动作：待机、行走、坐下、睡觉、互动
- 拖动、自动漫游、左右朝向、窗口边互动、托盘、开机启动
- 安全导入 / 校验 / 切换 `.petpack`
- 封装客户专属 Windows 便携 EXE（客户双击即出宠，不必装开发环境）
- 动画安全检查：单元格边距、串帧、断尾、体量、重心、脚底基线

各分支会在这套能力之上叠加角色专属动作、台词、雷达或双人剧情。切到分支后以该分支 README 为准。

---

## 可选桌宠类型

选类型 = 选分支。确认前不要动手。

| 用户怎么说 | 分支 | 能力摘要 |
|---|---|---|
| 老板桌宠 / 牛斯克 / 跪着的西装男 | `main` | 跪姿待机、爬行移动、叫大爷、磕头、错了没、端茶送水、窗口顶边坐下与侧爬吊挂、坐边打电话，男声 |
| 老婆桌宠 / 女伴 / 叫老公 | `feat/laopo-pet` | 站立待机与散步、叫老公、磕头、上才艺、端茶、窗口坐边撩发 / 飞吻 / 左看右看，女声，启动「老公，我来啦~」 |
| 美杜莎 / 女王 | `feat/medusa-pet` | 直立女王踱步、冷笑、七彩吞天蟒、跪安、侧边倚靠（不爬墙）、坐边托腮撩发，女声，支持超大尺寸 |
| 闺蜜 / 小美小甜 / 双人女伴 | `feature/bestie-pets-design` | 一体双人同框、贴贴 / 合影 / 悄悄话、坐窗喝奶茶、侧边偷看、可中途点击续播的「去放松」剧情 |
| 兄弟判官 / 写实判官 | `feature/brother-judge-bubble-copy` | 照片级写实判官、磕头专帧、接地气吐槽气泡、画饼词库 |
| 儿子模式 / 叫爸 | `feature/son-mode` | 兄弟判官儿子口吻（「爸，我来了！」）、预录音、当个事儿办、飞书任务 |
| 画饼雷达 / 监听老板飞书 | `feature/boss-watch` | 飞书 IM 监听老板消息，命中画饼 / 吹牛等关键词就气泡 + 动作 + 语音吐槽；跪爬；当个事儿办 |
| 牛来 / 打工人 / 办公桌宠 | `feature/niulai` | 胆小躺平的小黄牛；来电喊妈并拒接；牛市 / 熊市飞行；头顶行情条；办公雷达六类吐槽；当个事儿办 |
| 狗和猫 / 旺财咪咪 / 双宠物 | `feature/dog-and-cat` | 同一画幅左狗右猫（柴犬 + 橘猫），走双宠制作流水线 |
| 自定义照片桌宠 | 选最接近的能力分支 | 用用户照片换外观；播放器能力复用该分支，不要在 `main` 从零做 |

切分支后继续读：

- `main` → 下文「制作老板桌宠」和 [docs/prompts/make-boss-pet.txt](docs/prompts/make-boss-pet.txt)
- 其它分支 → 该分支 `README.md`，以及 `docs/prompts/` 里对应提示词（牛来优先 `make-current-branch-pet.txt`）

---

## 环境要求

- Windows 10 或更高版本
- Node.js 24，最低支持 Node.js 22.12
- Python 3.11 或更高版本

## 安装与启动

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
npm start
```

也可以手动安装依赖：

```powershell
python -m pip install --requirement requirements-dev.txt
npm ci
npm start
```

## 测试

运行完整测试：

```powershell
npm test
```

运行重点回归测试：

```powershell
node scripts/test-renderer-interaction.js
python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v
```

项目会检查 JavaScript 入口、资源包安全、窗口互动、渲染器行为、动画处理和内置示例宠物包。

## 构建 Windows 便携版

构建通用播放器：

```powershell
npm run build
```

默认输出：

```text
dist/Desktop-Pet-0.4.0.exe
```

当前公开构建未进行 Windows 代码签名，SmartScreen 可能显示“未知发布者”。正式分发时应同时提供构建报告和 SHA-256 校验值。macOS 未交付。

## `.petpack` 资源包

`.petpack` 是使用专用扩展名的 ZIP 文件，包根目录至少包含：

```text
pet.json
preview.png
animations/
  idle/       # 建议不少于 4 帧
  walk/       # 建议不少于 6 帧
  sit/        # 建议不少于 4 帧
  sleep/      # 建议不少于 4 帧
  reaction/   # 建议不少于 4 帧
```

验证示例资源包（`main` 上是老板包；其它分支替换为该分支的 pack）：

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/boss.petpack
```

播放器将外部资源包视为不受信任输入。导入前会检查路径穿越、反斜杠路径、重复及大小写冲突、文件数量、解压体积、未引用文件、清单字段和 PNG 格式。格式细节见 [petpack-schema.md](skills/desktop-pet-maker/references/petpack-schema.md)。

## 制作专属桌面宠物

项目包含可由 Codex / Cursor Agent 自动发现的 `desktop-pet-maker` Skill：

- 自动发现入口：`.agents/skills/desktop-pet-maker/`
- Skill 源码：`skills/desktop-pet-maker/`

制作前必须先走本文开头的「给 AI 助手」流程：确认类型 → 切分支 → 再确认细节。不要在未选类型时直接生成。

### 用本项目制作老板桌宠（牛斯克）

`main` 的演示基线是老板桌宠。只有用户明确要做这一型之后，才按下面流程做：

1. 准备 1～8 张同一角色的清晰参考图（正脸、全身、侧脸更好）。
2. 打开本仓库，把照片和提示词一起发给 Agent。
3. 提示词文件：[docs/prompts/make-boss-pet.txt](docs/prompts/make-boss-pet.txt)（可整份复制）。
4. Agent 完成后应交付：
   - `pets/packages/boss.petpack`
   - `dist/customers/boss/老板桌面宠物-<version>.exe`
   - `dist/customers/boss/build-report.json`
5. 本地也可单独验证和封装：

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/boss.petpack
npm run build:boss
# 或：
npm run build:customer -- --pet pets/packages/boss.petpack --name "老板桌面宠物" --delivery-id boss
```

老板桌宠能力摘要：跪姿待机、爬行移动、叫大爷 / 磕头 / 错了没?、端茶送水、窗口顶边坐下与侧爬吊挂、坐边跷二郎腿打电话，以及男声台词。

输出位于 `dist/customers/<delivery-id>/`，包含便携版 EXE 和 `build-report.json`。客户版默认只包含指定宠物，并隐藏导入、切换宠物和打开宠物库入口；添加 `--allow-management` 可保留管理功能。

## 项目结构

```text
src/                              通用播放器与安全桥接
pets/packages/                    可发布的 .petpack 资源包
pets/library/                     本地解包检查目录（默认不提交）
docs/prompts/                     可复制制作提示词
skills/desktop-pet-maker/         宠物制作流程、脚本和格式文档
.agents/skills/desktop-pet-maker/ Codex 自动发现入口
scripts/build-customer.js         客户专属便携版构建器
```

## 隐私与安全

- 不要提交客户原始照片、客户宠物包、生成工作区、运行截图、密钥或构建产物
- 原始照片只应用于制作对应宠物，不应上传到无关服务
- 仅提交自己拥有或有权再分发的图片、动画和资源包
- 安全漏洞请按 [SECURITY.md](SECURITY.md) 私下报告
- 参与开发前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)

## 上游项目与许可证

Desktop Pet 基于 [redniu123/pet-player](https://github.com/redniu123/pet-player) 修改和扩展。感谢原作者及所有贡献者。

- 源代码采用 [MIT License](LICENSE)，并保留上游项目的原始版权声明
- `main` 演示资源为 `boss.petpack`（牛斯克 / 老板桌宠）及对应图标，见 [ASSETS_LICENSE.md](ASSETS_LICENSE.md)
- 当前项目维护者：devin2255

重新建立 Git 仓库不会改变上游许可证或素材署名义务。
