# 兄弟判官桌宠：飞书"画饼雷达"监听功能设计

日期：2026-08-10
状态：已批准（用户确认设计后进入实施）
分支：feature/boss-watch

## 1. 背景与目标

制作"兄弟判官"桌面宠物（基于用户真实宠物照片，判官主题吐槽性格）。除标准动作分支（idle/walk/sit/sleep/reaction 等）外，新增核心能力：桌宠通过飞书 IM 实时监听老板消息，当消息命中"画饼 / 吹牛"类关键词时，桌宠弹出气泡、播放 reaction 动作并语音吐槽（如"老板画的饼别吃，你啃不动！"）。

目标形态：自用便携 EXE。客户版默认关闭监听功能。

## 2. 已确认的决策

| 决策点 | 结论 |
| --- | --- |
| 宠物形象 | 用户真实宠物照片（desktop-pet-maker 照片流程） |
| 监测方式 | 飞书 IM 接入，复用本机 lark-cli（`~/.qwenworkcn/bin/lark-cli.cmd`，v1.0.45.1，应用凭证存 keychain） |
| 监听范围 | 全局会话扫描 + 老板名单过滤（名单可配置） |
| 老板识别 | 姓名或 open_id，open_id 精确匹配，姓名经 lark-cli 通讯录解析 |
| 语音 | edge-tts 在线合成（npm 包，主进程合成 MP3） |
| 触发规则 | 内置词库 + 分类吐槽文案，随 petpack 走，可配置 |

## 3. 架构

遵循项目原则 6（新功能优先成为通用播放器能力或资源包配置）。

### 3.1 新增模块

- `src/message-watcher.js`（主进程）：监听生命周期管理。spawn `lark-cli event consume im.message.receive_v1` 收 NDJSON 行流；解析消息；跑过滤管线；命中后调用现有 `sendState('reaction', 文案, 文案, { speechAudio })` 触发气泡 + reaction + 语音；处理断线重连与启动检测。
- `src/watch-rules.js`（纯函数）：过滤管线，可单测：
  1. 事件去重（event_id 集合，LRU 上限 5000）
  2. 老板过滤（sender_id 匹配 open_id 名单，或姓名→open_id 解析后匹配）
  3. 关键词分类（词库命中 → 返回类别）
  4. 冷却与静默时段检查（同老板 cooldownSec 内不重复触发；quietHours 内静默）
  5. 文案选择（该类别文案池随机选一句；无命中类别用 fallback）
- `src/watch-config.js`（主进程）：加载/校验 `userData/boss-watch.json` 与 petpack 内 `pet.json.watch` 字段，合并出运行时规则；提供配置热重载入口（右键菜单"重载画饼雷达配置"预留，本期可不实现 UI）。

### 3.2 复用现有能力（不重复造轮子）

- 气泡：renderer 现有 `showBubble`（`sendState` 的 message 字段）。
- reaction 动作：`sendState('reaction', ...)` 触发 petpack 的 reaction 动画。
- 语音播放：`speechAudio`（MP3 文件）与 `speech`（Web Speech 系统语音）两条现成通道。
- 不新增 IPC 通道：message-watcher 直接调用主进程内已有的 `sendState`。

### 3.3 数据流

```
lark-cli event consume im.message.receive_v1
  → NDJSON 行流（sender_id / chat_id / chat_type / content / event_id / timestamp）
  → watch-rules 过滤管线
  → 命中：edge-tts 合成 MP3 → userData/voice-cache/
  → sendState('reaction', 吐槽文案, 吐槽文案, { speechAudio })
  → 渲染进程：气泡 + reaction 动画 + 语音
```

消息内容只在本地内存处理，不落盘、不打印（调试日志默认关闭，开启也只记录命中类别）。

## 4. 配置结构

### 4.1 pet.json 新增可选字段 `watch`（随宠物走，schemaVersion 保持 1）

```json
"watch": {
  "state": "reaction",
  "keywords": {
    "画饼": ["老板画的饼别吃，你啃不动！", "这饼画得真圆，可惜啃不动。"],
    "吹牛": ["你的老板吹了个牛逼！", "这牛吹得，我耳朵都疼了。"]
  },
  "fallback": "老板又开始整活儿了，装没看见。"
}
```

兼容性：可选字段，旧播放器忽略未知字段；新播放器读旧包无该字段则监听启用时使用内置默认词库（不阻塞）。词库与文案必须在 petpack 校验中允许（validate 不因新增字段报错）。

### 4.2 userData/boss-watch.json（随机器走）

```json
{
  "enabled": true,
  "larkCliPath": "C:/Users/Thinkpad/.qwenworkcn/bin/lark-cli.cmd",
  "bosses": ["王总", "ou_221a684c00848f0cd7f3e29d1061d908"],
  "cooldownSec": 30,
  "quietHours": [["12:00", "13:30"], ["19:00", "09:00"]],
  "voice": { "enabled": true, "gender": "male", "rate": 1.0 }
}
```

- `bosses`：姓名或 open_id 混合列表；姓名在启动时经 `lark-cli contact` 解析为 open_id 缓存。
- `enabled` 默认 false；自用 EXE 内置为 true 并内嵌上述默认配置。
- 配置文件损坏时回退默认值并在托盘/日志提示，不崩溃。

## 5. 语音

- `msedge-tts` npm 包（纯 Node，无 Python 依赖），主进程合成 MP3。
- 音色：中文男声（`zh-CN-YunxiNeural`，判官气质），rate 可配。
- 合成文件存 `userData/voice-cache/`（按内容 hash 命名，命中重复文案不重复合成）。
- 降级链：edge-tts 失败 → `speech` 字段走 Web Speech 系统中文语音 → 仅气泡不发声。
- 网络失败静默降级，不打断桌宠主功能。

## 6. 隐私红线

1. 飞书消息原文只在内存处理：不写盘、不打印、不统计上报。
2. edge-tts 只发送宠物吐槽文案，绝不发送老板消息原文。
3. 老板名单、词库、语音缓存全部本地存储。
4. 调试日志（默认关闭）只记录命中类别与时间，不记录内容。

## 7. 容错

- 启动检测：lark-cli 不存在 / 未登录 → 气泡提示"画饼雷达未连接"，监听自动禁用，桌宠正常启动。
- 事件流断开：指数退避重连（上限 10 次/小时）。
- 去重：event_id 去重，防重复投递。
- 冷却：同老板 cooldownSec 内不重复触发（默认 30s），防刷屏。
- 消息类型：content 为可读文本才进入匹配；卡片等 JSON 消息跳过（本期不支持解析卡片）。

## 8. 测试

- 单元测试 `scripts/test-message-watcher.js`（node 测试，加入 `npm run test:js` 链条）：
  - 事件 NDJSON 解析（p2p / group / 文本消息）
  - 卡片等非文本消息安全跳过
  - 老板过滤：open_id 精确匹配、姓名解析后匹配、非老板不触发
  - 词库分类命中与 fallback
  - 文案选择随机性（注入固定随机源）
  - 去重与冷却（同 event_id / 同老板冷却期内不重复触发）
  - quietHours 静默
- 集成验证：以老板身份用 lark-cli 发一条含"画饼"的测试消息，端到端确认气泡 + reaction + 语音触发（人工确认 + 截图）。
- 回归：`npm test` 全绿（含动画条安全检查）后才可打包。

## 9. 交付

- 用户照片 → desktop-pet-maker 流程 → 兄弟判官 petpack（内置判官风词库）。
- `npm run build:customer` 构建自用便携 EXE，程序名"兄弟判官桌面宠物"。
- 交付：EXE、build-report.json、验证清单（含画饼雷达端到端验证项）。
- 客户版默认 `enabled: false`，需单独配置飞书。

## 10. 范围外（YAGNI）

- 卡片消息内容解析（本期跳过）。
- 配置热重载 UI（本期仅支持重启生效 / 预留入口）。
- 多应用（钉钉/企微）监听。
- 自定义吐槽模板变量（如引用老板昵称）。
