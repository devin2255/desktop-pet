# Desktop Pet Player 0.4.0

一个面向 Windows 的通用透明桌面宠物播放器。播放器不绑定某只宠物；宠物名称、性格、动画、行为和资源路径全部来自可移植的 `.petpack` 包。

## 本分支桌宠

本分支主交付：**小狗**（`xiaogou` / 小狗桌面宠物）。本分支重点是窗口边互动状态机，宠物本身只有标准五动作。

制作提示词：[docs/prompts/make-current-branch-pet.txt](docs/prompts/make-current-branch-pet.txt)

设计文档：[docs/superpowers/specs/2026-07-29-window-edge-interactions-design.md](docs/superpowers/specs/2026-07-29-window-edge-interactions-design.md)

### 身份

- id：`xiaogou`；显示名：小狗；性格：胆小、粘人

### 动作

仅 idle、walk、sit、sleep、reaction。窗口互动缺专用帧时 fallback 到 walk/sit/reaction。

### 气泡与台词

无固定 pet.json 台词；左键触发 reaction。

### 互动

窗口发现、拖到顶/侧/底、屏顶坠落、置顶守卫、透明穿透。无自定义右键菜单项。

### 托盘与右键

仅播放器固定项：叫宠物回来、切换/导入/宠物库、大小、散步、置顶、开机、藏起来、退出。

### 交付

```text
node scripts/build-customer.js --pet pets/packages/xiaogou.petpack --name "小狗桌面宠物" --delivery-id xiaogou
```

Windows 便携 EXE，未签名。macOS 未交付。


## 功能

- 透明无边框窗口，可见像素附近接收点击，透明区域鼠标穿透
- 待机、行走、坐下、睡觉和互动动画
- 拖动、自动漫游、左右朝向、托盘、右键菜单和开机启动
- 导入、校验和切换 `.petpack`
- 把一个宠物包封装成客户专属 Windows 便携版 EXE
- 动画安全边距、串帧、断尾、体量、重心和基线自动检查

## 直接使用

从 GitHub Releases 下载 `Desktop-Pet-Player-0.4.0.exe` 后双击运行。首次启动会安装仓库内置的示例宠物包。

当前公开构建未进行 Windows 代码签名，Windows SmartScreen 可能显示未知发布者。请核对 Release 同时提供的 `build-report.json` 中的 SHA-256。

## 开发环境

- Windows 10 或更高版本
- Node.js 24；最低支持 22.12
- Python 3.11 或更高版本

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
npm start
```

也可以手动执行 `python -m pip install --requirement requirements-dev.txt`、`npm ci` 和 `npm test`。

构建通用便携版：

```powershell
npm run build
```

输出位于 `dist/Desktop-Pet-Player-0.4.0.exe`。

## `.petpack` 格式

`.petpack` 是使用专用扩展名的 ZIP 文件，包根目录包含：

```text
pet.json
preview.png
animations/
  idle/       # 4 frames
  walk/       # 6 frames
  sit/        # 4 frames
  sleep/      # 4 frames
  reaction/   # 4 frames
```

验证资源包：

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/xiaogou.petpack
```

播放器把资源包视为不受信任输入，会在解压前检查路径穿越、反斜杠路径、重复及大小写冲突、文件数量、解压体积、额外未引用文件、清单字段和 PNG 格式。

格式细节见 `skills/desktop-pet-maker/references/petpack-schema.md`。

## 在 Codex 中制作新宠物

项目内的 `.agents/skills/desktop-pet-maker` 是 Codex 自动发现入口，实际流程与脚本位于 `skills/desktop-pet-maker`。朋友 clone 仓库后，在 Codex 中打开仓库、附上同一只宠物的 1～8 张照片，然后可直接发送：

```text
请根据我附上的宠物照片，使用 desktop-pet-maker 制作完整的 Windows 桌面宠物。

宠物名字：旺财
性格：活泼、粘人
程序名称：旺财桌面宠物
风格：柔和 2D 插画风
重点特征：保留额头白斑、棕色耳朵和卷尾

请生成并验证 .petpack，再构建客户专属便携版 EXE，实际启动检查后交付 EXE、build-report.json 和验证结果。
```

Codex 会按以下标准流程工作：

```text
原始照片 → 动作条生成 → 去除背景 → 统一画布/体量/重心/基线
        → 安全门禁 → pet.json → petpack 验证与打包 → 客户专属 EXE
```

原始照片和制作工作目录默认被 Git 忽略。请勿把客户照片、客户包或运行截图提交到公共仓库。

## 客户专属 EXE

```powershell
npm run build:customer -- --pet pets/packages/xiaogou.petpack --name "小狗桌面宠物" --delivery-id xiaogou
```

输出位于 `dist/customers/<delivery-id>/`，包含便携版 EXE 和 `build-report.json`。客户版默认只包含指定宠物，并隐藏导入、切换和宠物库入口；传入 `--allow-management` 可保留管理功能。

## 安全与贡献

- 漏洞报告：参见 `SECURITY.md`
- 贡献流程：参见 `CONTRIBUTING.md`
- 版本变化：参见 `CHANGELOG.md`
- 源代码采用 [MIT License](LICENSE)
- `xiaogou.petpack`、程序图标和托盘图采用 [CC BY 4.0](ASSETS_LICENSE.md)，署名 redniu123

请只提交你有权再分发的图片和宠物包。
