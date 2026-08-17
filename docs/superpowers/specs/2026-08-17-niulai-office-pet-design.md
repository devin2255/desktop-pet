# 牛来办公桌宠设计

日期：2026-08-17  
分支：`feature/niulai`（从 `feature/son-mode` 拉出）  
状态：设计已在对话中逐节确认；**下一步是写实施计划，还没写代码、没画帧**

## 0. 回家怎么继续

到家后：

```powershell
git fetch origin
git checkout feature/niulai
git pull origin feature/niulai
```

新会话先读本文件全文，以及 [交接备忘](./2026-08-17-niulai-handoff.md)。然后用 **writing-plans** 根据本设计写出 `docs/superpowers/plans/2026-08-17-niulai-office-pet.md`。**计划未经确认前不要改播放器、不要画帧、不要打包 EXE。**

基线能力都在 `feature/son-mode` 上（窗口互动、跪爬、飞书画饼雷达、sequences）。本分支目前只有设计文档。

## 1. 目标

做一只可交付的 Windows 桌宠「牛来」：形象向电影《牛来》致敬（躺平、突然站起来、嘴碎），能力接到打工人的办公现场——听老板消息吐槽，并在老板打来钉钉语音时：牛来一边爬向来电窗口一边喊妈，妈妈出镜走到挂断键，用脚踩掉。

播放器只增加通用办公能力。名字、性格、词库、分镜、语音全部进 `.petpack`。不在 `src/` 写死「牛来」。

交付物：`pets/packages/niulai.petpack` + 自用便携 EXE「牛来桌面宠物」+ `build-report.json`。

## 2. 已确认决策

| 决策点 | 结论 |
|---|---|
| 产品定位 | 办公嘴替，不是院线朝圣玩具 |
| 形象 | 原创小黄牛；手搓 2D 气质，但必须过切帧/对齐/穿透门禁。不描电影 3D 截图 |
| 版权 | 非官方授权周边。角色可叫「牛来」，文案可用电影梗，不宣称片方合作 |
| 豹拉 | 一期只出现在台词里，不画第二只角色 |
| 妈妈 | 来电必须出境。单窗口：牛来先爬过去喊妈，再切成妈妈独行去踩挂断。不新开窗口 |
| 牛来来电动作 | 一边攀爬一边循环喊「妈妈！」。手贴来电窗口侧边，禁止原地站着干喊 |
| 拒接方式 | 妈妈走到钉钉语音弹窗，脚锚点对齐「挂断/拒绝」键后再真挂。不是后台静默点掉 |
| 办公 IM | 播放器做消息总线；飞书、钉钉都是适配器 |
| 消息雷达 | 词库四类：画饼、吹牛、加班、甩锅；@所有人未命中走 fallback |
| 来电 | 只做钉钉语音；只拒接老板；托盘可关；自用默认真挂 |
| 飞书来电 | 本期不做 |
| 客户版 | 消息雷达与来电拒接默认关闭（与现有 boss-watch 客户策略一致）；自用默认打开 |

## 3. 架构

原则：新能力进播放器且保持通用；宠物差异只在 petpack。

```
钉钉客户端窗口 / 钉钉消息事件源 / 飞书 lark-cli
        │
        ▼
  IM 适配器（lark | dingtalk）
        │  归一化事件
        ▼
  办公消息总线（主进程）
        │
        ├─ 文本消息 → watch-rules（老板过滤 + 词库 + 冷却 + 静默）
        │                 → sendState(动作, 文案, 语音)
        │
        └─ 钉钉语音来电 → 老板名单匹配
                          → 播放 sequences.boss-call
                          → 牛来攀爬到来电窗口侧边，循环喊「妈妈！」
                          → 妈妈走到挂断键，脚接触时 Invoke 拒接
                          → 失败则气泡「这次没挂上」
```

### 3.1 播放器（通用）

拆出现有飞书逻辑为适配器，不复制一套词库引擎。

| 模块 | 职责 |
|---|---|
| `src/im-bus.js`（新） | 启停适配器、把归一化事件交给规则 |
| `src/im-adapter-lark.js` | 现有 `message-watcher` 的飞书事件流，改造成适配器 |
| `src/im-adapter-dingtalk.js` | 钉钉：文本消息；来电窗口/挂断键矩形；Invoke 拒接 |
| `src/watch-rules.js` | 保持纯函数；类别随 `pet.json.watch.keywords` 扩展，不写死「画饼/吹牛」 |
| `src/watch-config.js` | 增加平台、来电开关；旧 `boss-watch.json` 仍能加载 |
| `src/sequence-controller.js` | 阶段可选 `speechAudio` / `speechGender` / `approachTarget` |
| `src/approach-target.js`（新） | 通用：把宠物窗口移到屏幕矩形，使配置锚点（手/脚）对齐目标 |

归一化消息事件：

```json
{
  "platform": "lark" | "dingtalk",
  "kind": "message" | "voice-call",
  "eventId": "string",
  "senderId": "string",
  "senderName": "string",
  "text": "string",
  "chatType": "p2p" | "group" | "unknown"
}
```

`kind: "voice-call"` 时 `text` 可空。未列入老板名单的来电：不演、不挂。

### 3.2 钉钉适配器（两条能力）

**文本消息。** 优先官方 Stream / 企业内部应用事件。若实施时没有稳定、可本机运行的事件源，计划里单列 spike，禁止假装已有 `ding-cli`。飞书消息在钉钉 spike 未完成时仍可用。

**语音来电拒接。** 不依赖开放平台，也不在后台偷偷点掉。流程：

1. UI Automation 找到钉钉来电窗口，标题/内容匹配老板显示名。
2. 取出窗口侧边矩形（给牛来手部攀爬）和「挂断/拒绝」按钮矩形（给妈妈脚）。
3. 牛来阶段：`approach-target` 把手锚点对齐窗口侧边，同时循环喊妈。
4. 妈妈阶段：窗口改以脚锚点对齐挂断键；脚接触帧才 Invoke。弹窗位移则跟踪，直到踢出或超时。

约束：

- 对不上老板名单：不走、不挂。宁可漏挂，不可错挂同事、家人、客户。
- 找不到窗口或按钮：仍可把分镜演完（妈妈在原处抬脚空踩），气泡「这次没挂上」，托盘可看失败原因（不写聊天正文）。右键试演同样：无弹窗则只演戏、不移动、不挂。
- 不截图、不把来电人姓名写入日志文件；调试默认关闭。
- 冷却：同一老板 `callHangup.cooldownSec`（默认 60）内不重复挂、不重复演。
- 静默时段：与消息雷达共用 `quietHours`；静默期内不挂不演。
- 真挂只发生在脚接触之后。禁止分镜一开始就 Invoke。

钉钉客户端改版导致选择器失效时，视为适配器失败，不阻塞桌宠其它功能。

### 3.3 资源包（牛来）

| 路径 | 用途 |
|---|---|
| `pets/library/niulai/` | 解包工作目录 |
| `pets/packages/niulai.petpack` | 校验后的包 |
| `id` / `delivery-id` | `niulai` |
| 程序名 | 牛来桌面宠物 |

播放器不出现「牛来」字符串硬编码。`sequences.boss-call` 缺失时：若来电拒接开启，仍可在识别到挂断键后由妈妈默认走路+踢腿动作拒接；没有妈妈动画则不演戏、也不静默挂（避免「看不见谁挂的」）。

## 4. 人设与办公情绪

称呼用户：打工人（`pet.json` 可改）。性格：胆小、躺平、嘴碎、被点到突然燃。

| 类别 | 触发（写入 `watch.triggers`） | 动作 | 口吻示例 |
|---|---|---|---|
| 画饼 | 上市、期权、功劳、不会亏待、融资、年终、分红、升职、加薪 | `reaction` | 「这饼我梦里见过。醒来还是饼。」 |
| 吹牛 | 人脉、搞得定、包在我身上、小意思、当年 | `reaction`（`keywordStates.吹牛` 可指专属动作） | 「你这牛，还不如我豹拉哥。」 |
| 加班 | 今晚、周末来一趟、线上对齐、EOD、加班 | `crawl`（只播跪爬动画，不进入窗口攀爬状态机） | 「又迁徙是吧。筐还越走越小。」 |
| 甩锅 | 你看一下、协同一下、同步一下、帮忙看下、背锅 | `reaction`（不要用窗口逻辑角色 `hang`） | 「狼来了？先把我推出去是吧。」 |
| fallback | 老板发言未命中词 | `reaction` | 「云雀又来报信了。我躺着听。」 |

现有 `matchKeyword` 已按 `keywords` 的 key 遍历，四类词库无需改匹配算法。`keywordStates`：加班 → `crawl`，甩锅与画饼默认 → `reaction`。`sendState` 的第四参目前会被飞书 watcher 传成 options 对象，实施时要改成显式 `logicalRole` + options，避免和窗口 `hang`/`climb` 角色撞车。

## 5. 外形与动画

原创小黄牛：无角或短角、体色黄褐、比例略笨拙。风格是「母子手搓 2D」，不是电影低精度 3D，也不是精致国漫。

日常动作只有牛来一只。妈妈是成年母黄牛：角更细短、比牛来高一圈、同一画风，**仅来电分镜入画**。单窗口、固定画布，不为双人放大窗口。

- 喊妈：牛来用攀爬动作移动，**一边爬一边喊「妈妈！」**；手贴来电窗口侧边，规则同日常 climb 手贴墙。
- 入画：到达窗口附近后妈妈从身侧进入；随后切成只有妈妈。
- 挂断：妈妈走到挂断键，脚踩在按钮上，不能悬空点。
- 日常把窗口爬上去时不循环喊妈，以免拖窗口鬼哭狼嚎。来电分镜必须喊。

| 动作 | 帧 | 办公/电影对应 |
|---|---|---|
| idle | 4 | 趴着躺平，偶有耳朵动 |
| walk | 6 | 笨拙小跑（朝右，向左镜像） |
| sit | 4 | 坐下，略心虚 |
| sleep | 4 | 眼前一黑，做梦 |
| reaction | 4 | 突然要站起来 |
| crawl | 6 | 还不会走，加班跪爬 |
| drag | 6 | 被拎走，四肢离地 |
| climb | 6 | 手贴墙往上，像跳溪 |
| perch | 4 | 坐窗沿，左右腿交替晃，不敢跳 |
| hang | 4 | 抓住下沿，甩锅/求救 |
| fall | 4 | 眼前一黑往下掉 |
| impact | 4 | 摔坐 |
| recover | 6 | 拍土站直：「我来了。」 |
| call-climb | 6 | 仅牛来，攀爬+张嘴喊妈；手在攀爬侧 |
| call-mom-enter | 4 | 妈妈从身侧入画，牛来站位不变 |
| call-mom-walk | 6 | 仅妈妈，走向来电弹窗（朝右，向左镜像） |
| call-mom-kick | 4 | 仅妈妈，抬脚踩/踢挂断键；脚在画面底部接触点 |

右键至少两项：`站起来`（reaction）、`睡会儿做梦`（sleep）。可选菜单走 `sequences.boss-call` 方便无来电时试演。`behavior.random` 含 walk/sit/reaction/sleep，坐下和吐槽带气泡。`behavior.perched` 至少一条「不敢跳」类台词，用 `idleMinMs`/`idleMaxMs` 拉开间隔。

启动问候：`打工人，牛来了。`

## 6. 来电分镜 `sequences.boss-call`

日常 `idle` 不得出现妈妈。**牛来一边爬一边喊妈**；**走到挂断键、用脚踩掉的是妈妈**。

```json
"callClimbContact": {
  "action": "call-climb",
  "anchor": { "x": 0.08, "y": 0.38 }
},
"callHangupContact": {
  "action": "call-mom-kick",
  "anchor": { "x": 0.72, "y": 0.96 }
}
```

手锚点随左右翻转向量镜像（与窗口 climb 相同）：爬左边窗口时手贴左，爬右边贴右。

分镜阶段：

1. `call-climb`，`approachTarget: "incoming-call-edge"`。攀爬到来电窗口最近侧边，手贴边。`messages: ["妈妈！"]`，`messageLoop: true`，`messageGapMs: 500`，牛来语音可循环或只播前两声。直到到达或超时（默认 4s）。  
2. `call-mom-enter` +「牛来？」妈妈语音，约 0.8–1.2s。在窗口旁入画。  
3. `call-mom-walk`，`approachTarget: "incoming-call-reject"`。切成仅妈妈，脚锚点移向挂断键。  
4. `call-mom-kick`。脚接触帧 Invoke。约 0.8–1.2s。  
5. `idle`，`restorePosition: true`，`duration: 0`。回到序列开始前的位置躺平。

序列 stage 增加可选字段（通用，写入 petpack-schema / validator）：

| 字段 | 含义 |
|---|---|
| `speechAudio` / `speechGender` | 该阶段语音 |
| `messageLoop` | `true` 时在阶段结束前循环 `messages`（一边爬一边喊依赖此字段；现有最多 4 条不够爬完全程） |
| `approachTarget` | `incoming-call-edge` 窗口侧边；`incoming-call-reject` 挂断键 |
| `restorePosition` | `true` 时本阶段结束后回到序列开始前的窗口位置 |

无预录音则 TTS：男声牛来、女声妈妈。右键试演：无来电弹窗则原地循环喊妈+空踩，不移动、不挂断。

## 7. 配置

`userData/boss-watch.json` 扩展（旧字段继续有效）：

```json
{
  "enabled": true,
  "platforms": ["lark", "dingtalk"],
  "bosses": ["ou_...", "张总"],
  "cooldownSec": 30,
  "quietHours": [["12:00", "13:00"], ["22:00", "08:00"]],
  "callHangup": {
    "enabled": true,
    "platforms": ["dingtalk"],
    "cooldownSec": 60
  }
}
```

托盘：

- 办公雷达：开/关（现有 enabled）
- 拒接老板钉钉语音：开/关（`callHangup.enabled`）
- 自用首次写入：雷达开、拒接开；客户构建写入：两者关

老板钉钉侧用显示名匹配（与现有姓名规则一致）；飞书继续 open_id。同一 `bosses` 数组里 `ou_` 走飞书，其余字符串走姓名/显示名。

## 8. 错误处理

| 情况 | 行为 |
|---|---|
| 钉钉未登录/无来电窗口 | 桌宠照常；来电能力静默 |
| 来电人不是老板 | 忽略 |
| 找不到窗口或按钮 | 妈妈可空踩；气泡「这次没挂上」；不 Invoke |
| 识别为老板但拒接失败 | 脚已踩上但 Invoke 失败 →「这次没挂上」 |
| petpack 无 `boss-call` | 不演戏、不静默挂 |
| 钉钉消息事件源不可用 | 飞书消息仍工作；托盘不假装钉钉已连通 |
| petpack 无 `watch` | 雷达用播放器内置默认词库（保持现状） |
| 序列播放中用户拖拽 | 中断序列；若脚还未接触则不挂；若已 Invoke 则不撤回 |

## 9. 测试

播放器：

- 适配器接口单测：归一化事件、老板匹配、冷却、静默
- 来电：假窗口夹具测侧边手贴合、挂断键脚对齐、攀爬阶段循环「妈妈！」、接触帧才 Invoke
- `approach-target`：先 edge 后 reject；目标移动时跟踪；超时未到达不挂
- 序列 `approachTarget` / `restorePosition` / `speechGender` 能跑通
- 旧 `boss-watch.json` 无 `callHangup`、无 `platforms` 时：飞书行为与现在一致，拒接视为关

宠物包：

- `petpack_tool validate`
- 四类词 + fallback + `keywordStates` 有测试夹具
- `sequences.boss-call`：爬着喊妈 → 入画 → 妈妈独行 → 踢挂断 → 回 idle；`call-climb` 手在侧边、`call-mom-kick` 脚在底部；`messageLoop` 合法
- 动画门禁与窗口互动回归（含 50 次连播、鼠标穿透）

钉钉真机：确认牛来爬向弹窗并循环喊妈、妈妈用脚挂断、电话断开。没有测试号则标记未验证。

## 10. 明确不做（本期）

- 飞书语音/视频拒接
- 后台静默点掉来电（必须看见妈妈用脚挂）
- 为妈妈单独开第二窗口
- 拒接非老板、系统电话、手机蜂窝来电
- 画豹拉、描电影正片建模；妈妈不得进入 idle/walk/坐窗等日常动作
- 为牛来分叉播放器主题/皮肤
- 修改老板 open_id 写死进仓库（仍走本机 `boss-watch.json`）

## 11. 风险

- 钉钉 UI 改版会使挂断键定位失效，必须可降级为空踩、不乱挂。
- 来电弹窗可能在屏幕边角或被遮挡；跟踪失败时不 Invoke。
- 真挂有误伤风险，所以默认只打老板名单，且托盘可关。
- 电影名用于程序名有商标/误导风险；交付说明写清「致敬人设，非官方」。
