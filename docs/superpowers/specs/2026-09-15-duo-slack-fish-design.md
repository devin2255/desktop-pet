# Duo 摸会儿鱼（Slack）设计

日期：2026-09-15  
分支：`feature/son-mode`  
状态：待实现  
前置：`docs/superpowers/specs/2026-09-11-brother-duo-design.md`、`docs/superpowers/specs/2026-09-14-duo-tent-standby-design.md`  
本规格只做合体单窗「摸鱼扛机」；不嵌抖音网站、不真展开成两窗、不加第三窗口。

## 目标

合上态右键「摸会儿鱼」：先出现展开后的双页边框，两兄弟各在一页里，再跳出来一人一边扛着同一台双折叠，做出很重很吃力的循环。左屏渲染比头上 ticker 更完整的大盘板（同一套真盘/模拟盘源）；右屏循环播放资源包自带的短视频片段（看起来在刷，不能真滑）。点手机或点兄弟收工，回到合体。

播放器只增加通用 `slack` 能力；文案、动作名、视频、是否启用全部来自 `pet.json` 的 `duo.slack`。没有该字段的包行为不变。不为某一只宠物写死角色名。

## 决策摘要

| 项 | 决策 |
|---|---|
| 形态 | 方案 A：始终一个窗口；壳是现有 `.duo-device` 全开；人不拆窗 |
| 进入 | 仅合上 `folded` 右键；帐篷 / 展开态不出现入口 |
| 离开 | 左键静止点击手机或兄弟 → `folded`；可选右键「收工了」备份 |
| 短视频 | 包内 clips 静音循环，不嵌 douyin.com，不登录 |
| 大盘 | 复用 `market-watch` 行情，左屏做完整板；头上 ticker 隐藏 |
| 人物 | 新画根级 `jump` + `carry` 双人条；屏内容不画进 PNG |
| 互动 | 左键拖走过阈值仍整窗搬走；摸鱼期不散步、不爬窗、不听画饼 |

## 状态机

在现有态上增加互斥稳态 `slack`：

| 状态 | 窗口 | 行为 |
|---|---|---|
| `folded` | 1 | 与现在相同 |
| `tent` | 1 | 与帐篷规格相同 |
| `slack` | 1（加宽加高，脚底不动） | 三拍出场后扛机；左屏大盘、右屏 clips；停漫游；停窗口边互动；停画饼语音；隐藏 ticker |
| `unfolding` / `open` / `folding` | 与现在相同 | 与现在相同 |

允许的转换：

- `folded` → `slack`（菜单 `duo-slack`）
- `slack` → `folded`（点手机/点人，或菜单 `duo-unslack`）
- `folded` ⇄ `tent` / `open` 保持现状
- 禁止：`open` → `slack`；`tent` → `slack`；`slack` → `open`（要展开须先收工合上）
- `slack` 下右键水平拖不当开合（与帐篷相同，避免误展开）

`slack` 内部仅渲染阶段，不是控制器子状态：

1. `intro`：全开边框，左右页各显示对应成员站立/待机静帧，屏上还没有大盘和视频  
2. `jump`：播根级 `duo.slack.jumpAction`，页内静帧收掉  
3. `carry`：播根级 `duo.slack.carryAction` 循环；左页大盘、右页 clips 开始

中断（托盘隐藏、切宠物、退出）：

- 当时是 `slack`：取消其它过渡后 **保持 `slack`**（稳态），再显示时从 `carry` 续（不必重放 intro/jump）
- 左键拖开始：不退出 `slack`，只搬家
- `unfolding` / `folding` 仍弹回进入前状态；进入前若是 `slack`，不允许开合，故不会发生

隐藏再显示：回到隐藏前的 `folded` / `tent` / `open` / `slack`。

## 菜单

合上态（`folded`）在已有项之外增加：

- `{ id: 'duo-slack', label }`，`label` 来自 `duo.slack.enterLabel`（兄弟包：「摸会儿鱼」）  
  无 `action`/`sequence` 动画义务；主进程识别 id 后切 `slack`。

`slack` 态短菜单（最多 8 项，本规格 1 项即可）：

- `{ id: 'duo-unslack', label }` ← `duo.slack.leaveLabel`（兄弟包：「收工了」）→ `folded`，播回 `idle`

不含「展开」「支起来」、不含画饼雷达开关。展开态 / 帐篷态菜单不含「摸会儿鱼」。

右键位移规则：短按出菜单；`slack` 下水平拖不当开合，松手出菜单。

## 视觉与窗口

- 复用 `.duo-overlay` / `.duo-device`，`--duo-open` 固定为 **1**（全开双页，不是帐篷半开）
- 设备平放在两人之间，不绕底边立起；不另开 BrowserWindow
- 禁止苹果 Logo、灵动岛、官方壁纸或「Hello, hello」
- 扛机时人物可以叠在边框上，**不得**挡住左右屏内容区（屏区 `pointer-events` 可点，用于收工）
- `intro` 左右页分别铺对应成员 `idle` 的第一帧（主进程从 `duo.members` 取 URL 发给 overlay，合上窗不必切成员清单）；主精灵隐藏
- `jump` / `carry` 用根级双人 PNG；两块屏是 DOM，不画进帧

窗尺寸：比合上更宽更高，以放下双页壳 + 框外两人。脚底与合上对齐，加宽向两侧、加高只往上。建议：

- 高度 = 合上高度 + 固定超额（与帐篷类似量级，足以露出壳顶）
- 宽度 = `round(高度 * 4 / 3)` 与 `合上宽度 * 2` 取较大，并夹在工作区内

`presentationWindowSize` 在 `mode === 'slack'` 时返回该尺寸（不要误用平板 `tabletWindowSize`）。

左键：位移小于拖动阈值 → 视为点击，收工；超过阈值 → 整窗拖走，松手停在原地，不弹回屏幕底。透明像素仍鼠标穿透。

## 左屏大盘

摸鱼是「看着盘摸鱼」，不是帐篷那种纯钟。

- 走现有 `market-watch`（真盘东财、模拟盘同一套开关）
- 主进程继续轮询；渲染把行情画进左页，而不是头上 `.ticker`
- `slack` 期间 `.ticker` 隐藏；离开后按原逻辑恢复
- 板面至少：
  - 主指数：名称、最新价、涨跌点、涨跌幅、红涨绿跌
  - 下方 3～6 行：现有附属指数 + `duo.slack.boardSecids`（可选）里能解析到的标的
- 无有效数字：显示「大盘待命」或「模拟盘待命」，不要空白
- 画饼语音：`slack` 内完全不听（与帐篷相同：不匹配关键词、不说话、不播雷达音频）；**行情数字仍更新**

## 右屏短视频

- 不嵌第三方站点，不登录
- `duo.slack.clips`：资源包内相对路径数组，1～8 个；`mp4` 或 `webm`
- 静音循环：播完自动下一条，全部播完从头开始
- 不能滑、不能点进视频；点右屏 = 收工
- 某个文件坏了：跳过；全部无法播放：右屏静帧 + 文案「没片了」，仍可点收工
- 禁止带抖音/TikTok 水印、Logo 或未授权成片；兄弟包自行准备「摸鱼刷短视频」观感的短素材

## `pet.json`

`schemaVersion` 仍为 `1`。`duo.slack` 可选：

```json
{
  "slack": {
    "enterLabel": "摸会儿鱼",
    "leaveLabel": "收工了",
    "jumpAction": "slack-jump",
    "carryAction": "slack-carry",
    "clips": [
      "video/slack/01.webm",
      "video/slack/02.webm",
      "video/slack/03.webm"
    ],
    "boardSecids": ["1.000001", "0.399001", "0.399006"]
  }
}
```

校验：

- 有 `duo` 才允许 `duo.slack`
- `duo.slack` 若出现必须是对象
- `jumpAction` / `carryAction` 必须是非空字符串且指向**根级**动画
- `enterLabel` / `leaveLabel`：1～24 字；缺省「摸会儿鱼」/「收工了」
- 左右页 intro 静帧固定取 `duo.members` 里 `side=left/right` 的 `animations.idle.frames[0]`，不另配 introAction
- `clips`：1～8 个相对路径，文件必须存在于包内，扩展名为 `.mp4` 或 `.webm`
- `boardSecids` 可选；若出现为 1～8 个非空字符串
- 无 `duo.slack`：不出现「摸会儿鱼」，控制器没有 `slack` 态

兄弟 Duo 打开 `duo.slack`，并提供 jump / carry 条与至少 3 条静音短视频。

## 新动画条

根级双人同框，左右站位稳定（左判官、右花袄弟），脸和服装与现有包一致。

| 动作 | 建议帧数 | 内容 |
|---|---|---|
| `slack-jump` | ≥ 4，不循环 | 两人从各自那一页跳到框外；最后一帧已在框外、准备托机 |
| `slack-carry` | ≥ 4，循环 | 一人一边扛着双折叠，肩/手臂吃力、身体被压低、可有轻微晃动；**不要把屏上的字和视频画进图** |

切帧前走现有单元格安全边距、连通块、断尾检查；连播 50 次不得缩放平移。`carry` 可用 `scale` 与脚底 `transform-origin` 对齐合体体量。

## 播放器改动面

| 模块 | 职责 |
|---|---|
| `duo-controller.js` | `slack` 稳态；`beginSlack` / `leaveSlack`；`slack` 时禁止手势开合 |
| `duo-controller.js` `presentationWindowSize` | `slack` 返回加宽加高尺寸 |
| `main-v3.js` | 菜单 id；进摸鱼停漫游/边互动/画饼语音；点收工；不创建第二窗；行情仍推 renderer |
| `renderer-v3.js` + CSS + HTML | intro 页内静帧、jump/carry、左屏板、右屏 `<video>` 循环、点击收工、隐藏 ticker |
| `preload-v3.js` | 如需 `pet:slack-exit` 点击上报 |
| `market-watch` / `message-watcher` | `slack` 不推画饼命中；行情 payload 照常（可带 indices） |
| `capability-gates.js` | `hasDuoSlack` |
| `petpack-validator.js` | 校验可选 `duo.slack` 与 clips 文件 |
| CSP | `media-src` 允许 `pet-asset:` 视频 |
| 单测 | 进/出、点击收工、摸鱼不许手势开合、无字段包不出现该态、缺 clips 校验失败 |

不为 `brother-duo` 写死角色名。

## 失败回退

| 情况 | 行为 |
|---|---|
| 包无 `duo.slack` | 无入口，到不了 `slack` |
| jump 缺帧 | 跳过 intro 后的跳跃，直接 `carry` |
| carry 缺帧 | 退回 `idle` 站在壳两侧，壳和大盘/视频仍在，仍可点收工 |
| 行情失败 | 左屏待命文案 |
| 全部 clips 损坏 | 右屏「没片了」，可点收工 |
| 开合/帐篷中途点「摸会儿鱼」 | 忽略 |
| 工作区太窄放不下加宽窗 | 夹在工作区内缩放宽度，并气泡「太挤了，将就摸」；仍进入 `slack` |

## 质量门禁

- 合体右键能摸鱼；帐篷/展开菜单看不到该入口
- 出场顺序固定：边框+页内人 → 跳出 → 扛机+双屏内容
- 左屏有指数价和涨跌色；模拟盘时标明模拟；头上 ticker 在摸鱼期不可见
- 右屏静音轮播，无抖音站点、无登录
- 点手机或点人回到合体双人漫游；拖动整窗不误触发收工
- 摸鱼期发「上市/画饼」类群消息不得出声
- 摸鱼期不爬窗/坐窗/坠落，不自动散步
- 托盘隐藏/显示保持 `slack` 且在 `carry`
- 无 `duo.slack` 的包回归不破
- 语法检查 + `test-duo-controller` + validator + 兄弟 Duo petpack 测；打客户 EXE 手测三拍与点击收工

## 首版不做

- 嵌入 douyin.com / 其它短视频网站
- 右屏可滑动、可出声、可评论
- 展开成两窗或第三窗口扛机
- 从帐篷或展开态直接摸鱼
- 摸鱼中菜单展开、支帐篷
- 把大盘/视频烤进 PNG
- 数字签名

## 建议实现顺序

1. validator + `hasDuoSlack` + `duo-controller` 进出与窗尺寸 + 单测  
2. 主进程菜单、三停、点击收工、行情仍推送  
3. 渲染：全开壳、intro 页内人、jump/carry、左屏板、右屏静音 video  
4. 新画 jump/carry 条、准备 clips、写 `duo.slack`、打包、启动 EXE 手测
