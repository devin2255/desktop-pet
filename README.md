# Desktop Pet

Desktop Pet 是一个面向 Windows 的透明桌面宠物播放器，由 [devin2255](https://github.com/devin2255) 维护。播放器本体不绑定某一只宠物；宠物名称、性格、动画、行为参数和资源路径均由可移植的 `.petpack` 资源包提供。

当前版本：**0.4.0**。

## 本分支桌宠

本分支主交付：**美杜莎**（`medusa` / 美杜莎桌面宠物）。

制作提示词：[docs/prompts/make-current-branch-pet.txt](docs/prompts/make-current-branch-pet.txt)

设计文档：[docs/superpowers/specs/2026-08-02-medusa-pet-design.md](docs/superpowers/specs/2026-08-02-medusa-pet-design.md)

### 身份

- id：`medusa`；性格：高冷、傲娇、女王范
- 启动问候：「本女王来了。」

### 动作

标准五动作 + drag、lean、climb、perch、hang、fall、impact、pat-butt、perch-chin-rest、perch-hair-sweep、perch-look、cold-smile、heaven-python、kneel-before-me、talent-show、inspect、command、smirk-line

### 气泡与台词

- 冷笑「哼。」；吞天蟒「吞天。」；跪安「跪下。」；上才艺「给本座看好了。」
- 漫游：「看你表现」「侍奉本座」「有趣」

### 互动

侧边立刻 lean（不爬顶）、遇边掉头、尺寸含超大、窗口边、透明穿透。

### 托盘与右键

冷笑 / 七彩吞天蟒 / 跪安 / 上才艺 + 播放器固定项（含超大尺寸）。

### 交付

`npm run build:medusa`。Windows 便携 EXE，未签名。macOS 未交付。


## 主要功能

- 透明无边框窗口，仅在宠物可见像素附近接收点击，透明区域允许鼠标穿透
- 支持待机、行走、坐下、睡觉和互动动画
- 支持拖动、自动漫游、左右朝向、窗口互动、托盘菜单和开机启动
- 安全导入、校验和切换 `.petpack` 宠物资源包
- 将指定宠物包封装为客户专属 Windows 便携版 EXE
- 检查动画安全边距、相邻帧串帧、断尾、视觉体量、重心和脚底基线

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

当前公开构建未进行 Windows 代码签名，SmartScreen 可能显示“未知发布者”。正式分发时应同时提供构建报告和 SHA-256 校验值。

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

验证示例资源包：

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/medusa.petpack
```

播放器将外部资源包视为不受信任输入。导入前会检查路径穿越、反斜杠路径、重复及大小写冲突、文件数量、解压体积、未引用文件、清单字段和 PNG 格式。格式细节见 [petpack-schema.md](skills/desktop-pet-maker/references/petpack-schema.md)。

## 制作专属桌面宠物

项目包含可由 Codex / Cursor Agent 自动发现的 `desktop-pet-maker` Skill：

- 自动发现入口：`.agents/skills/desktop-pet-maker/`
- Skill 源码：`skills/desktop-pet-maker/`

在编辑器中打开本项目并附上同一只宠物的清晰照片后，可以要求它生成动作帧、处理透明背景、统一体量与基线、验证资源包并构建客户专属 EXE。

### 用本项目制作美杜莎桌宠（medusa）

当前演示基线是美杜莎女王桌宠。若要在新会话中重做或继续迭代，按下面流程即可：

1. 准备 1～8 张同一角色的清晰参考图（正脸、全身、侧脸更好）。
2. 打开本仓库，把照片和提示词一起发给 Agent。
3. 提示词文件：[docs/prompts/make-medusa-pet.txt](docs/prompts/make-medusa-pet.txt)（可整份复制）。
4. Agent 完成后应交付：
   - `pets/packages/medusa.petpack`
   - `dist/customers/medusa/美杜莎桌面宠物-<version>.exe`
   - `dist/customers/medusa/build-report.json`
5. 本地也可单独验证和封装：

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/medusa.petpack
npm run build:medusa
# 或：
npm run build:customer -- --pet pets/packages/medusa.petpack --name "美杜莎桌面宠物" --delivery-id medusa
```

美杜莎桌宠能力摘要：直立待机与踱步、冷笑 / 七彩吞天蟒 / 跪安、漫游台词（看你表现 / 侍奉本座 / 有趣）、窗口顶边坐下与侧爬吊挂、坐边托腮 / 撩发 / 左看右看，以及女声音频台词。

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
- 当前演示资源为 `medusa.petpack`（美杜莎 / 美杜莎桌面宠物）及对应图标，见 [ASSETS_LICENSE.md](ASSETS_LICENSE.md)
- 当前项目维护者：devin2255

重新建立 Git 仓库不会改变上游许可证或素材署名义务。
