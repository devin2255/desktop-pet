# 千问桌面宠物：粉丝复现

这份文档给粉丝自己做 Windows 桌面宠物用。模型要从源码拉取、按功能制作、再在本机打包。不要下载别人已经打好的 EXE。

分享前先把分支 `feat/qwen-blogger-pet` 推到 `https://github.com/devin2255/desktop-pet.git`。仓库不提交 `pets/library`，除 laopo 以外的 `.petpack` 也不提交，所以粉丝必须用下面的参考图重新生成角色。

参考图只使用这一张：

https://github.com/lXiaoSel1/AI-Buddy/blob/main/docs/screenshots/art/pet-qwen.webp

## 操作步骤

1. 准备一台 Windows 10 或更高版本的电脑，安装 Git、Node.js 22.12 以上（建议 24）和 Python 3.11 以上。
2. 打开 Cursor、Codex 或其他能改这个仓库代码的 Agent。不要只丢给不能拉代码、不能打包的聊天窗口。
3. 把下面「可复制提示词」整段复制进去发送。参考图地址和分支名已经写在提示词里，不用再另找千问图片。
4. 等模型做完这些事：
   - 克隆 `https://github.com/devin2255/desktop-pet.git`
   - 检出并更新 `feat/qwen-blogger-pet`
   - 运行 `scripts/setup.ps1`
   - 用参考图生成千问的动作和 `pets/packages/qwen.petpack`
   - 核对播放器功能，缺的补进通用播放器
   - 执行 `npm run build:customer`，打出客户版 EXE
   - 实际启动成品并逐项检查
5. 完成后应能在本机看到：
   - `pets/packages/qwen.petpack`
   - `dist/customers/qwen/千问桌面宠物-<版本>.exe`
   - `dist/customers/qwen/build-report.json`
6. 双击刚打出来的 EXE。千问应直接出现，不用再装 Node 或 Python，也不用手动导入资源包。
7. 自己看一遍：透明背景能点穿、慢拖停住、甩动才会抛出、窗口上边框坐下、右键只能唤起千问、交代任务会交给千问、放着一会儿会睡。数据目录是 `%APPDATA%\Desktop Pet Deliveries\qwen`。
8. 这个 EXE 可以没有数字签名。Windows SmartScreen 提示未知发布者是当前构建的正常情况，看 `build-report.json` 即可。

如果 electron-builder 下载 Electron 失败，让模型把 `CUSTOMER_ELECTRON_DIST` 指到本机 `node_modules\electron\dist` 后重新打包。不要改去下载别人的桌宠程序。

## 可复制提示词

```text
在 Windows 上从源码复现「千问桌面宠物」。自己克隆仓库、核对并补齐播放器功能、根据指定参考图生成宠物，再在本机打包。不要下载、不要索取、也不要把别人已经打好的 EXE 当作结果。

一、拉项目

git clone https://github.com/devin2255/desktop-pet.git
cd desktop-pet
git checkout feat/qwen-blogger-pet
git pull

环境：Windows 10 或更高，Node.js 22.12 以上（建议 24），Python 3.11 以上。然后执行：

powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1

播放器入口是 src/main-v3.js。宠物名字、图片、台词、行为全部来自 pet.json。不要把「千问」写死进播放器，别的宠物不能因此变成千问。唤起外部软件只能使用播放器里的白名单 id，资源包不能传入任意 exe 路径或命令。

这个分支应已经包含下面第三节的播放器行为。逐项核对；缺哪一项，就补进通用播放器，并沿用仓库已有测试。不要另写一个只给千问用的程序。

仓库不包含这只宠物的图片。pets/library 以及除 laopo 以外的 petpack 都不在 Git 里，必须从下面的参考图重新生成。

二、参考图和宠物

参考图只用这一张，不要上网另找千问图，也不要换成别的角色：

https://github.com/lXiaoSel1/AI-Buddy/blob/main/docs/screenshots/art/pet-qwen.webp

下载原图用：

https://raw.githubusercontent.com/lXiaoSel1/AI-Buddy/main/docs/screenshots/art/pet-qwen.webp

把原图保存到 pets/sources/qwen/original/，不要覆盖用户的其他照片。使用仓库里的 desktop-pet-maker（skills/desktop-pet-maker）制作。

宠物名字：千问
性格：温柔、俏皮、会吐槽
程序名称：千问桌面宠物
delivery-id：qwen
风格：柔和 2D 动漫。外形、服装、道具以这张参考图为准，所有帧必须是同一个人。

动作至少包含 idle、walk、sit、sleep、reaction，建议帧数不少于 4、6、4、4、4。透明背景，按不透明主体统一尺度，按视觉重心和脚底基线对齐。切帧前检查单元格安全边距、相邻帧串帧、断尾和互动帧的尺度漂移。任何一项失败都整条重做，禁止擦掉越界碎片后继续用。

pet.json 至少包含：

- id 为 qwen，packageVersion 自定，例如 1.0.0
- personality：温柔、俏皮、会吐槽
- speechGender 为 female，speechEnabled 为 true
- startupGreeting：我是千问，桌面我看着。
- recallLabel：喊她回来
- behavior.topPatrol 为 false
- behavior.autoSleepMs 为 300000
- launchApps 只有 ["qwen"]
- interactionActions.perch 使用 sit，anchor 为 { "x": 0.5, "y": 0.88 }
- 右键一项 id 为 nap，标签「睡一会儿」，动作 sleep，气泡和语音都是「那我先眯一会儿。」，持续 8000 毫秒
- interact.lines 使用这些句子，点击时轮播，特效 hearts：
  别戳啦，再戳我记账了。
  摸鱼被我看见了。
  窗口边风好，我坐这儿。
  一行代码都不用写。
  倒杯水我就住下了。
  你摸鱼，我看着呢。
  想睡会儿？右键就行。
  拖到哪儿我就在哪儿。
  手机里也养得下。
  今天的桌面我看着。
  又在发呆？我记下了。
  喊我回来就好。
  右键交代任务就行。
  这个家越来越热闹。
  戳一下可以，别连戳。
  我在窗口上晃晃腿。
  手残党也能养我。
  想养同款就抄作业。
  藏起来我也在。
  开机我自己就来。

漫游权重保持走路为主，坐下时可以说「我在这儿坐一会儿。」，互动时可以说「摸鱼被我看见了。」。坐在窗口上边框时只播 sit，不沿边巡逻。

生成后执行：

python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/qwen.petpack

三、桌宠要有这些功能

窗口与点击

- 无边框透明窗口。只有宠物可见像素附近能点到，透明区域必须穿透到后面的软件。
- 左键点一下轮播 interact.lines，并播女声。连续点击有 650 毫秒间隔，避免连戳刷屏。
- 睡觉时点一下要先醒来，并且仍然说一句台词。

拖动、停留、抛掷

- 慢慢拖、松开，就停在松手的位置，不要弹回屏幕角落，也不要自动掉到任务栏。
- 只有甩动才抛出。速度用松手前约 120 毫秒的位移估算；最后一次采样距松手已超过 150 毫秒，或采样间隔短于 8 毫秒，视为没有甩动。合速度达到每秒 300 像素才抛，上限约每秒 3600 像素。
- 抛出后受重力下落，碰到屏幕工作区边缘会反弹，落定后停在落地处。重力约每秒 1400 像素，水平反弹保留约 0.65，垂直约 0.62。接近地面且速度已经很小就落地。
- 先判断是不是甩动，再判断窗口边缘。慢速放到窗口上边框才坐下；下边框不坐下。
- 多显示器时，抛掷和落点限制在各屏工作区内，不要飞进任务栏或屏幕之间的空隙。

窗口上边框

- 慢速拖到其他窗口的上边框，她坐下，使用 sit，锚点 y 为 0.88，看起来坐在边框上。
- behavior.topPatrol 为 false，坐下后不要沿上边框来回走。
- 这只宠物不要做侧边攀爬和下边框倒挂。

自动睡觉

- behavior.autoSleepMs 为 300000。约 5 分钟没有任何点击、拖动、右键或唤回，就自动睡觉。
- 点击、拖动、右键、喊她回来都会醒来，并重新计时。只是随机漫游不算把她叫醒。

右键和交代任务

- 右键至少有：交代任务、唤起千问、睡一会儿、喊她回来，以及播放器原有的托盘和退出。
- 「唤起千问」只启动本机已安装的千问客户端。按 qianwen.exe 或 tongyi.exe 识别，找不到就打开 https://www.qianwen.com/ 。不要启动千问办公。
- 「交代任务」在宠物附近打开无边框输入框。提交后把文字交给千问：拼成 https://www.qianwen.com/?q= 加上编码后的文字，用千问客户端打开；没装客户端就用系统浏览器打开。文字先去掉控制字符，最长 200 字。
- 提交成功后气泡显示「交给千问：」加上原文；太长就截断，语音过长时只说「交给千问了。」
- 提交成功、点关闭、按 Esc、点输入框外面，输入框都要关掉。
- 这只宠物的唤起名单只有 qwen。不要在右键里放豆包、Kimi、元宝或其他 AI。

客户版程序

- 双击 EXE 后千问直接出现。用户不用装 Node、Python，也不用手动导入 petpack。
- 客户版只带这一只宠物，隐藏导入、切换宠物和打开宠物库。
- 数据目录独立：%APPDATA%\Desktop Pet Deliveries\qwen
- 保留开机启动、托盘、退出、左右朝向、桌面漫游和启动问候。
- 当前构建可以不签名。要在交付说明里写明未签名，SmartScreen 可能提示未知发布者。

不要做弹弓轨迹、专用抛掷图、视线跟随、手套光标、token 监控、多角色切换或 Galgame。手机端不在这次范围内。

四、打包

打包前先跑：

node scripts/test-renderer-interaction.js
python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v

任一失败就先修，再打包。然后执行：

npm run build:customer -- --pet pets/packages/qwen.petpack --name "千问桌面宠物" --delivery-id qwen

如果 electron-builder 下载 Electron 超时，不要改去下载别人的桌宠 EXE。把环境变量 CUSTOMER_ELECTRON_DIST 指到本机 node_modules\electron\dist，再执行上面的打包命令。

成品应出现在 dist/customers/qwen/，旁边有 build-report.json。

五、必须实际打开检查

启动刚打出来的 EXE，确认：

- 动画是参考图里的那个人，背景透明，透明处能点到后面的窗口
- 静止连续点击不会把身体放大、缩小或平移
- 慢拖停在原地，甩动才会抛出、反弹并落地
- 慢放到窗口上边框会坐下，下边框不会坐下
- 右键只有千问可唤起，交代任务会打开千问或浏览器，提交后输入框自己关闭
- 放着约 5 分钟会睡，一碰就醒
- 托盘、退出、左右朝向、漫游都可用
- 数据写在 Desktop Pet Deliveries\qwen，不和别的宠物混用

把 EXE 路径、build-report.json 和上面各项的实测结果交给我。只生成 .petpack，或者只复制一个现成 EXE，都算没做完。
```
