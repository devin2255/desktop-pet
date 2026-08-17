# 桌面宠物工作区约定

## 项目定位

这个工作区专门用于制作、维护和测试 Windows 独立桌面宠物。当前基线版本是 0.4.0：程序本体是通用播放器，宠物身份、图片、动画和性格参数全部由 `.petpack` 资源包提供。

## 当前架构

- 通用播放器入口：`src/main-v3.js`
- 安全桥接：`src/preload-v3.js`
- 宠物界面：`src/index-v3.html`、`src/styles-v3.css`、`src/renderer-v3.js`
- 标准资源包：`pets/packages/*.petpack`
- 解包检查目录：`pets/library/<pet-id>/`
- 当前标准演示宠物：`pets/packages/laopo.petpack`（老婆 / 老婆桌面宠物）
- Codex 自动发现入口：`.agents/skills/desktop-pet-maker/`
- 制作 Skill 源码：`skills/desktop-pet-maker/`
- 客户专属构建器：`scripts/build-customer.js`

## 必须遵守的设计原则

1. 不在播放器代码中写死某只宠物的名字、性格或动画路径；这些信息必须来自 `pet.json`。
2. `.petpack` 是 ZIP 格式但使用 `.petpack` 扩展名，包根目录必须包含 `pet.json`、预览图和动画帧。
3. 标准动作至少包含 `idle`、`walk`、`sit`、`sleep`、`reaction`。建议帧数分别不少于 4、6、4、4、4。
4. 导入时必须检查路径穿越、文件数、解压体积、清单字段、必需动作和帧文件，不能直接信任外部资源包。
5. 清单标准需要演进时，通过 `schemaVersion` 做兼容处理，不能无提示破坏旧资源包。
6. 新增功能应优先成为通用播放器能力或资源包配置，而不是为单只宠物做分支。
7. 保留用户原始照片，不覆盖、不上传到无关服务；生成素材与原图分目录保存。
8. 修改资源生成流程后，至少用两只外观不同的宠物做完整测试，包括透明背景、动作连续性、打包、导入、切换和实际运行。
9. 动画条切帧前必须通过源单元格安全门禁：左右保留空白安全区，任何贴边像素、相邻帧碎片、显著独立连通块或平直断尾都必须判失败并重新生成；禁止只擦掉串帧碎片后继续，因为缺失的尾巴或身体像素无法恢复。
10. 动画帧必须按不透明主体视觉体量统一尺度、按视觉重心和脚底基线对齐。互动动作连续重播 50 次不得出现身体放大、缩小或平移；静止点击不得触发窗口拖动。
11. Windows 透明窗口的透明像素区域必须鼠标穿透，只允许宠物可见像素附近接收点击；“看起来透明但遮挡后方内容”视为交付失败。

## 默认客户交付目标

当用户要求“制作桌面宠物”“把宠物照片做成桌宠”或表达同类意图时，默认目标不是只生成 `.petpack`，而是完成客户可以直接使用的 Windows 专属 EXE：

1. 使用 `desktop-pet-maker` 根据客户照片制作并验证 `.petpack`。
2. 使用 `npm run build:customer` 将该资源包封装成客户专属便携版 EXE。
3. 客户双击 EXE 后宠物必须直接出现，不要求客户安装开发环境或手动导入资源包。
4. 客户版默认只包含指定宠物，并隐藏导入、切换宠物和打开宠物库入口；除非用户明确要求保留管理功能。
5. 实际启动成品，检查独立用户数据目录、动画、透明背景、拖动、漫游、左右朝向、右键菜单、托盘和退出。
6. 最终优先交付专属 EXE 与 `build-report.json`，同时准确说明数字签名等尚未完成的发布项；不能只交付 `.petpack` 就宣称任务完成。

客户构建命令：

```powershell
npm run build:customer -- --pet pets/packages/<pet-id>.petpack --name "<宠物名>桌面宠物" --delivery-id <pet-id>
```

## “教程”触发规则

当用户输入“教程”，或者询问“怎么操作”“新会话要输入什么”“需要准备哪些图片”时，直接提供一份面向普通用户的制作教程，不开始生成、不讨论定价。回答必须包含以下内容：

### 需要准备的图片

- 提供同一只宠物的 1～8 张清晰原始照片，不要混入其他动物。
- 最少应有一张光线良好、无遮挡、完整看清脸和身体的照片。
- 最好同时提供正脸、全身、左/右侧面；如果背部、尾巴或特殊花纹很重要，再补充对应角度。
- 避免严重模糊、滤镜过重、身体被裁掉、宠物太小、多人多宠遮挡的照片。
- 原始照片只用于制作该宠物；不得覆盖原图或上传到无关服务。

### 需要填写的信息

- 宠物名字。
- 性格关键词，例如胆小、粘人、活泼、贪吃。
- 希望显示的程序名称，例如“旺财桌面宠物”。
- 可选：像素风或柔和 2D 插画风、特殊动作、需要重点保留的毛色/花纹/眼睛/尾巴特征。

### 必须提供的可复制 Prompt

回答中必须给出下面这段可直接复制到新会话的 Prompt，并提醒用户先附上宠物照片再发送：

完整当前分支提示词以 `docs/prompts/make-current-branch-pet.txt` 为准。回答中必须完整给出该文件正文（可复制块），并提醒用户先附照片再发送。摘要如下，不得用只含 idle/walk/sit/sleep/reaction 的旧短提示词代替：

```text
请根据我附上的照片，使用 desktop-pet-maker 在本仓库制作完整的 Windows 桌面宠物。
不要修改播放器去写死这只宠物；身份、动画、文案、语音全部进 .petpack。

宠物名字：<填写>
性格：<填写>
程序名称：<例如：旺财桌面宠物>
delivery-id：<小写英文或拼音>
风格：<柔和写实 2D / 像素风；不填则默认>
称呼：<爸 / 老公 / 主人 等>
重点特征：<脸、毛色/发型、衣服、体型等>
语音：<有 mp3 则接到 speechAudio；否则用文案+系统中文语音>
特殊要求：<可不填>

必须做出与当前分支同等能力：标准五动作；窗口互动 drag/climb/perch/hang/fall/impact/recover（手贴墙、坐窗屁股贴边、不要把窗框画进图）；crawl 跪爬；右键至少 2 项；startupGreeting；behavior.random 与坐窗特色动作；pet.json.watch 画饼/吹牛词库，triggers 含上市/功劳/期权等；有录音则 referencedFiles 收齐。
切帧前检查安全边距、串帧、完整肢体；失败重画，禁止只擦碎片。连播 50 次不得缩放平移；透明像素必须鼠标穿透。
打包：python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/<id> pets/packages/<id>.petpack
封装（不要用 npm 转发参数）：node scripts/build-customer.js --pet pets/packages/<id>.petpack --name "<程序名称>" --delivery-id <id>
客户双击 EXE 后宠物必须直接出现。实际启动验证动画、穿透、拖动、攀爬、坐窗、吊挂、坠落、跪爬、漫游、右键、托盘、退出；有雷达则群发「@所有人 好好干，将来上市我记着大家的功劳」应触发画饼语音。交付 EXE、build-report.json 和验证结果，不要只交付 .petpack。
```

教程结尾应清楚说明整个流程：`附照片和信息 → 生成动作帧 → 透明背景与统一尺寸 → 验证 petpack → 一键封装 EXE → 实际启动检查 → 交付`。

## 常用命令

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
npm start
npm run build
npm run build:laopo
npm run build:customer -- --pet pets/packages/laopo.petpack --name "老婆桌面宠物" --delivery-id laopo
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/laopo.petpack
```

## 交付检查

- 对 JavaScript 入口执行语法检查，并实际启动开发版。
- 运行 `node scripts/test-renderer-interaction.js` 和 `python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v`；任何失败都禁止打包。
- 所有源动画条必须通过单元格安全边距、连通块、断尾检查；实际连续点击互动 50 次确认无视觉缩放/平移，并检查透明像素能点击穿透到后方应用。
- 验证每一个 `.petpack`，确认资源包能由通用播放器导入。
- 构建便携版 EXE，检查 ASAR 中包含播放器、依赖和内置资源包，并实际启动成品。
- 检查宠物缩放、拖动、漫游、左右朝向、右键菜单、托盘、开机启动设置和退出。
- 修改 Skill 时先更新项目内源码，并用当前 Codex 安装所带的 `skill-creator` 校验器验证。
- 发布时更新 `package.json` 版本，并在交付说明中准确列出已验证项和未验证项。
