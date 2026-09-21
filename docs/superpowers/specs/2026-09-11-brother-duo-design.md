# 兄弟桌宠 Duo 设计

日期：2026-09-11  
分支：`feature/son-mode`  
状态：已确认；实现计划见 `docs/superpowers/plans/2026-09-11-brother-duo.md`

## 目标

把当前一体单人「兄弟判官」升级为可开合的双人桌宠 **兄弟桌宠 Duo**：合上时两人同框一起行动（对应折叠机关上 / 外屏）；展开后拆成两个窗口，分别锁在同一块显示器工作区的左半与右半，各自互动（对应内屏两页）。开合手势为右键按住拖动，过渡观感对齐 iPhone Duo（主体钉在空间里、画框打开、中间磨砂），不把苹果手机画进帧里。

交付客户可直接使用的 Windows 便携版 EXE「兄弟桌宠 Duo」。播放器只增加通用 `duo` 能力；身份、外形、台词、菜单全部进 `.petpack`。

参考：闺蜜宠「小美&小甜」是单窗口、两人永远同框（见 `docs/superpowers/specs/2026-08-04-bestie-pets-design.md`）。本规格做的是闺蜜规格里明确砍掉的「合上同框 / 打开分头漫游」，外加折叠手势。

## 决策摘要

| 项 | 决策 |
|---|---|
| 呈现 | 方案 1：合上单窗双人同框；展开双窗，各锁半屏 |
| 屏幕 | 一块显示器左右劈开；不用真双屏 |
| 打开 | 右键按住不松，水平拖；方向 = 翻书朝向 |
| 合上 | 展开后朝对方 / 中缝右键拖回，动画倒放；菜单保留「合上」 |
| 短按右键 | 仍出菜单，不与拖开打架 |
| 左页 | 兄弟判官（红背心、深蓝短裤、人字拖、圆框眼镜） |
| 右页 | 花袄弟（东北大花袄短袖、军绿大裤衩、人字拖；脸按用户照片） |
| 程序名 | 兄弟桌宠 Duo |
| package id / delivery-id | `brother-duo` |
| 画饼雷达 | 仅左边判官；展开时只打左窗 |
| 开合动画 | 过渡层跟手，不手绘整本翻书 |
| 合上态窗口互动 | 不做爬窗 / 坐窗 / 吊挂 / 坠落 |

## 角色外观锚点

合上同框时左右站位稳定：左判官、右花袄弟，禁止帧间换边。展开后各窗只画自己。

### 兄弟判官（左，`id: judge`）

- 沿用现有 `brother-judge` 身份：红背心、深蓝短裤、人字拖、圆框眼镜
- 性格：毒舌、护短、接地气
- 菜单：叫爸、磕头、睡会儿
- 画饼雷达：沿用现有 `watch` 词库与文案

### 花袄弟（右，`id: floral`）

- 参考照片：短发、细框眼镜、东方面孔（实现时拷入 `pets/work/brother-duo/source/refs/`，不覆盖用户原图）
- 服装固定：东北大花（红底大花）短袖、军绿色宽松短裤、人字拖
- 不画入耳塞
- 性格：更贫、更闹
- 无画饼雷达；自有菜单与随机句（例如展开后「展开了兄弟！」、价格梗「有的 Duo 要一万六，有的 Duo 天天陪你」）

工作名「花袄弟」可在实现前改 `name` 字段，不改 `id: floral`。

## 状态机

四个互斥状态。配置与角色名不进播放器分支。

| 状态 | 窗口 | 行为 |
|---|---|---|
| `folded` | 1 个小窗 | 双人同框；一起走、一起被左键拖走 |
| `unfolding` | 1 个小窗 + 过渡层 | 停漫游；进度跟右手拖；松手过半则完成到 `open`，否则弹回 `folded` |
| `open` | 2 个小窗 | 判官钳在工作区左半，花袄弟钳在右半；各自动画、菜单、窗口互动 |
| `folding` | 2 窗 + 过渡层 | 进度跟朝中缝的右拖；过半并回单窗 `folded`，否则弹回 `open` |

拖拽方向只决定翻书朝向（左翻 / 右翻）。打开后的分栏永远是左 `judge`、右 `floral`。分界为当前窗所在显示器工作区的水平中线：`mid = workArea.x + workArea.width / 2`。

托盘一个图标：显示 / 隐藏两个窗一起动。宠物大小（小/中/大）两窗相同。

## 手势

左键只负责移动窗口，不触发开合。

### 与菜单拆分

1. 右键按下，到松开时位移 **小于 12px** → 弹出该窗的 `contextMenuActions`（合上用双人菜单；展开后点谁出谁的菜单）。
2. 按下后 **水平位移 ≥ 48px** 且 `|dx| > |dy|` → 禁止系统右键菜单，进入开合，进度 `progress = clamp(|dx| / 展开满行程, 0, 1)`。展开满行程取工作区宽度的 35%，下限 160px、上限 420px。
3. 几乎只上下拖、或斜向且 `|dx| ≤ |dy|` → 不当开合；松开仍给菜单。

### 合上 → 展开

- `dx > 0`：书往右翻；`dx < 0`：往左翻。
- 松手时 `progress ≥ 0.5`：播完剩余过渡，创建第二窗，进入 `open`。
- 松手时 `progress < 0.5`：弹回 `folded`。

### 展开 → 合上

- 左窗：朝右（中缝）拖；右窗：朝左拖。反向拖不触发合上。
- 过半合上，不过半弹回 `open`。
- 任一窗的右键菜单含 `id: duo-fold`、`label: 合上`，直接走满进度合上。

### 中断

`unfolding` / `folding` 期间若发生：托盘隐藏、开始左键拖窗、切换宠物、退出 → 取消本次开合，弹回进入过渡前的状态。不允许停在半开。

## 动画清单

开合过渡由渲染层合成（磨砂、钉住双人主体、画框随进度打开），**不**要求手绘每一度翻页。角色 PNG 只覆盖下表。

### 合上（根级 `animations`）

双人同框。标准五动作 + `drag`。帧数下限与仓库惯例相同：idle 4、walk 6、sit 4、sleep 4、reaction 4；`drag` ≥ 4。

合上态不配置 `interactionActions` 的 climb / perch / hang / fall / impact / recover；左键拖用 `drag`。

### 展开（`duo.members[].animations`）

每个成员各自：idle / walk / sit / sleep / reaction，以及 drag / climb / perch / hang / fall / impact / recover。锚点规则与现有 `interactionActions` 相同。

### 启动问候

`startupGreeting`：`爸，兄弟 Duo 来了！`  
合上态说话用双人窗；展开态各说各的气泡，不共用一个气泡。

## `pet.json` 约定

`schemaVersion` 仍为 `1`。新增可选对象 `duo`。无 `duo` 的包行为与现在完全一致。

根级字段：

- `id`: `brother-duo`
- `name`: `兄弟桌宠 Duo`
- `animations`: 合上双人同框
- `contextMenuActions`: 合上态菜单（至少含叫爸、磕头、睡会儿；可含「展开」作手势失败时的保底，对应直接满进度展开）
- `watch`: 画饼雷达规则；运行时只绑定 `duo.members` 里 `watch: true` 的成员
- `behavior.random`: 合上态随机池（双人动作）

`duo` 对象：

```json
{
  "foldAxis": "horizontal",
  "gesture": {
    "menuSlopPx": 12,
    "commitPx": 48,
    "snapProgress": 0.5
  },
  "members": [
    {
      "id": "judge",
      "side": "left",
      "name": "兄弟判官",
      "watch": true,
      "animations": {},
      "interactionActions": {},
      "contextMenuActions": [],
      "behavior": { "random": [] }
    },
    {
      "id": "floral",
      "side": "right",
      "name": "花袄弟",
      "watch": false,
      "animations": {},
      "interactionActions": {},
      "contextMenuActions": [],
      "behavior": { "random": [] }
    }
  ]
}
```

校验硬规则：

- `members` 恰好 2 个，`side` 分别为 `left` 与 `right`，`id` 互异
- 每个成员具备标准五动作；展开态窗口七角色射必须能落到该成员动画上（显式 `interactionActions` 或播放器默认映射）
- 根级动画不得与成员动画抢同一相对路径
- 缺任一成员单人帧 → 校验失败，禁止打包

旧播放器读到带 `duo` 的包：忽略 `duo`，只播根级双人同框（降级为闺蜜式一体双人）。

## 播放器架构

原则：通用能力，不为 `brother-duo` 写死分支。

| 模块 | 职责 |
|---|---|
| `src/duo-controller.js` | 纯逻辑：状态、进度、吸附、半屏钳位、手势判定；无 DOM / 无 Electron |
| `src/main-v3.js` | 第二 `BrowserWindow` 的创建/销毁；工作区中线；托盘显隐同步；把钳位后的 bounds 交给两窗 |
| `src/renderer-v3.js` / CSS | 开合过渡层（磨砂、主体钉住、随进度展开）；右键拖与 `contextmenu` 拦截 |
| `src/window-interactions.js` | 展开后每窗各一实例；合上态不跑 climb/perch/hang |
| `src/capability-gates.js` | `hasDuo(manifest)`；有 `duo` 才挂开合手势与「合上」菜单 |
| `src/petpack-validator.js` + Python 工具 | 与上文硬规则对齐 |
| `scripts/test-duo-controller.js` | 手势阈值、过半吸附、半屏钳位、中断回弹 |

数据流：右键拖 → 渲染进程算 dx/dy → 主进程 `duo-controller` 更新 progress → 回推过渡层；commit 后主进程拆/并窗并 `pet:load` 对应成员或双人清单。

## 失败回退

| 情况 | 行为 |
|---|---|
| 工作区宽度 &lt; 两窗宽度 + 24px | 保持 `folded`，气泡「太挤了，展不开」 |
| 第二窗创建失败 | 保持 `folded`，提示失败 |
| 过渡层异常 | 跳过动画，直接拆窗或并窗 |
| 开合中途隐藏 / 左键拖走 / 退出 | 取消，弹回进入前状态 |
| 资源包缺单人帧 | 导入/打包校验拒绝 |

## 质量门禁

- 合上双人帧与两套单人帧均过切帧安全门（边距、串帧、断尾/连通块）；失败重画，禁止只擦碎片
- 体量、重心、脚底基线各自统一；互动连播 50 次无缩放平移；静止点击不拖窗
- 透明像素鼠标穿透；展开后两窗都要穿透
- 右键短按必出菜单；右键拖开必不出现系统菜单
- 展开后左窗越不过中线，右窗同理
- 托盘隐藏后两窗都消失，再显示都回来，且仍是进入隐藏前的 `folded` 或 `open`
- 校验 petpack 后 `node scripts/build-customer.js --pet pets/packages/brother-duo.petpack --name "兄弟桌宠 Duo" --delivery-id brother-duo`，实际启动检查：合上同框、右键拖开/拖回、半程回弹、半屏钳位、左雷达、右菜单、穿透、托盘、退出

## 首版不做

- 真双显示器、竖向对折、三人以上
- 把苹果手机或官方 UI 画进动画帧
- 合上态爬窗 / 坐窗 / 吊挂 / 坠落
- 数字签名、macOS 安装包
- 为花袄弟单独做飞书雷达

## 建议实现顺序

1. `duo-controller` + 单测（手势、吸附、钳位、中断）
2. 主进程第二窗、中线钳位、托盘同步；先用夹具图验证拆/并
3. 渲染过渡层（跟手磨砂翻开 / 倒放）
4. 合上双人标准五动作 + drag
5. 两套单人标准五动作 + 窗口七动作
6. 菜单与雷达绑定左成员
7. 校验、打包、客户 EXE、真机走一遍门禁

## 风险

- 双窗 + 穿透 + 置顶是现有架构最大增量；第二窗必须复用同一套 preload / 点击穿透，不能复制一套临时逻辑
- 花袄弟只有一张自拍；全身大花袄短袖依赖生成一致性，必须固定眼镜、发型、花纹密度检查表
- 右键拖与系统 `contextmenu` 时序因平台而异，必须用「先拖后菜单」的集成测试锁住
- 开合过渡若做成全屏遮罩，会误伤穿透；过渡层只能盖在宠物窗或短时专用层上，松手 commit 后立即销毁
