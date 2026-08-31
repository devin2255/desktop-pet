# 各分支桌宠能力文档、制作提示词与 niulai/son-mode 底盘对齐

日期：2026-08-31  
分支：跨分支工作；本 spec 先落在当前工作分支，实现时按分支分别提交。

## 目标

1. 每个功能分支的 `README.md` 只描述该分支**主交付的一只（或一对一体）桌宠**的全部能力：动作、气泡文案、互动、托盘/右键菜单、交付命令。
2. 每个分支提供一份可复制提示词 `docs/prompts/make-current-branch-pet.txt`。README 写明该文件路径。提示词要求模型：拉取本仓库、checkout 本分支、与用户确认能力与图片用途、确认操作系统，全部确认后再实现，并交付可运行安装包。
3. 将 `feature/niulai` 上较新的**通用播放器**能力合入 `feature/son-mode`；将 `feature/son-mode` 上「窗口边角色 / 客户菜单按 petpack 可选」合回 `feature/niulai`。
4. `feature/niulai` 只做牛来：移除兄弟判官资源与本分支交付身份。`feature/son-mode` 主宠仍是兄弟判官。

## 非目标

- 不给兄弟判官增加牛来的来电喊妈、踢挂断、头顶行情动画或默认开启这些托盘项。
- 本次不实现 macOS 构建或 `.dmg` / `.app` 安装包。
- 不把 niulai 的办公/行情/钉钉模块合入老婆、美杜莎、闺蜜等其他分支。
- 不把牛来 `pet.json`、来电/行情帧打进 son-mode。
- 播放器代码不写死角色名；能力由 petpack 配置启用。

## 主宠对照

每个分支 README 只写下表「主宠」一列。同分支里可运行的其他包最多在开发说明里提一句，不写完整能力。

| 分支 | 主宠 | id / delivery-id |
|------|------|------------------|
| `main` | 牛斯克 | `boss` |
| `feat/laopo-pet` | 老婆 | `laopo` |
| `feat/medusa-pet` | 美杜莎 | `medusa` |
| `feature/bestie-pets-design` | 闺蜜桌宠 | `guimi` |
| `feature/boss-watch` | 兄弟判官（文言 + 画饼雷达） | `brother-judge` |
| `feature/brother-judge-bubble-copy` | 兄弟判官（白话） | `brother-judge` |
| `feature/dog-and-cat` | 旺财与咪咪 | `dog-and-cat` |
| `feature/niulai` | 牛来 | `niulai` |
| `feature/son-mode` | 兄弟判官 | `brother-judge` |
| `son-pet-window-interactions` | 小狗 | `xiaogou` |

`feature/bestie-pets-design` 上的小美&小甜不是本分支 README 主宠。`feature/dog-and-cat` 即使尚未打出 petpack，README 仍按该分支目标宠写能力；若某项尚未落地，在该条标明「计划中 / 未交付」。

## README 结构

保留现有安装、测试、构建、`.petpack`、隐私与许可证说明。在靠前位置增加 **「本分支桌宠」**，固定小节：

1. 身份：id、显示名、程序名、性格、启动问候（若有）。
2. 动作 / 动画：标准五动作 + 本宠全部额外动作名与用途。
3. 气泡与台词：启动、左键、右键、漫游、坐窗、雷达/序列等，写实际文案。
4. 互动：拖动、漫游、窗口边（顶/侧/底）、坠落恢复、跪爬、鼠标穿透、尺寸档、置顶、开机启动；写明本宠关闭或未使用的角色。
5. 托盘与右键：宠物自定义项 + 播放器固定项；客户版隐藏项单独列出。
6. 交付：构建命令、输出路径、仅 Windows 便携 EXE、未签名。
7. 文档索引：
   - 制作提示词：`docs/prompts/make-current-branch-pet.txt`
   - 设计/计划：该宠对应的 `docs/superpowers/specs/` 与 `docs/superpowers/plans/`（有则列出，无则省略）

能力清单必须与该分支当时代码和 pet.json（或测试锁定的清单）一致。先合并代码的分支，等合并完成后再写 README。

## 提示词

路径（每分支一份，可覆盖旧的 `make-current-branch-pet.txt`）：`docs/prompts/make-current-branch-pet.txt`

提示词是给**新会话模型**的操作说明书，不是给最终用户的营销文案。必须包含：

1. 若工作区不是本仓库：clone `https://github.com/devin2255/desktop-pet.git`；若已在仓库则 `git fetch`。然后 `git checkout` 提示词所在分支。
2. 阅读该分支 `README.md`「本分支桌宠」，用白话向用户复述能力模板。说明：外形用用户上传图片；功能以用户勾选为准，不默认全做；不必沿用原角色名。
3. 对照清单逐项确认：要 / 不要 / 改文案。确认用户照片用于哪些动作。
4. 确认操作系统：
   - Windows：可交付 `npm run build:customer` 便携 EXE。
   - macOS：当前仓库没有 mac 构建，必须说明；用户只要 macOS 则停止并改方案，不得假装交付 `.dmg`/`.app`。
   - 两者都要：先交 Windows；macOS 列为未交付。
5. 确认交付物：客户专属可运行安装包（Windows 便携 EXE）+ `build-report.json`；双击即出宠；客户版默认隐藏导入、切换宠物、打开宠物库。
6. 全部确认前禁止生成动画、改 pet.json 或打包。
7. 确认后遵循仓库 `AGENTS.md` 与 `desktop-pet-maker`：切帧门禁、验证 petpack、封装 EXE、实际启动检查。
8. 交付时列出已验证与未验证项（含未代码签名、macOS）。

各分支已有的专用提示词（如 `make-laopo-pet.txt`、`make-niulai-pet.txt`）可保留作历史参考；README 的「制作入口」指向 `make-current-branch-pet.txt`。

## 播放器合并（son-mode ← niulai 通用模块）

`feature/niulai` 从 `feature/son-mode` 拉出后增加了通用播放器能力。合入 son-mode 时只带播放器、测试、schema，不带 `pets/library/niulai/`、`pets/packages/niulai.petpack`、牛来专用脚本与牛来提示词。

合入后由 pet.json **有配置才启用**：

| 能力 | 启用条件 | 兄弟判官默认 |
|------|----------|--------------|
| IM 总线（飞书 + 钉钉） | 存在 `watch` 或 IM 配置 | 沿用现有画饼雷达词库，不改成牛来六类办公吐槽 |
| 钉钉来电 UIA 拒接 | 来电序列 + hangup 配置 | 关闭（无喊妈/踢挂断资源） |
| 行情条 + 牛熊飞 | `market-*` 序列 | 关闭 |
| 序列趋近 / 循环语音 / 接触帧 | 序列 stage 声明 | 仅当包声明了对应 stage |
| 当个事儿办 | 菜单未按包关闭 | 仍走飞书任务；niulai 仍走本地 mock。播放器保留两条路径，用现有交付配置或 watch/task 配置选择，禁止 `if (petId === '…')` |

相关源文件（以实现时 niulai 树为准，合并时按实际路径取用）：

- `src/im-bus.js`、`src/im-adapter-lark.js`、`src/im-adapter-dingtalk.js`、`src/im-match.js`
- `src/dingtalk-uia.js`、`src/dingtalk-call-uia.ps1`
- `src/market-watch.js`、`src/approach-target.js`
- `src/watch-config.js`、`src/message-watcher.js`、`src/pet-task.js`、`src/sequence-controller.js`
- `src/main-v3.js`、`src/preload-v3.js`、`src/renderer-v3.js`、`src/index-v3.html`、`src/styles-v3.css`
- `src/petpack-validator.js`、schema 与 `petpack_tool.py` 中与序列/watch 相关的校验
- 对应 `scripts/test-im-*.js`、`test-dingtalk-uia.js`、`test-market-watch.js`、`test-approach-target.js`、`test-pet-task.js` 及被改动的既有测试
- `package.json` / `scripts/build-customer.js` 中打包上述模块的条目

合并时保留 son-mode 独有提交 `ecfacb4`（窗口边角色与客户菜单按 petpack 可选）。解决 `src/main-v3.js` 等冲突时：通用模块用 niulai 侧；宠物默认包、托盘文案、当个事儿办默认路径用 son-mode / 兄弟判官侧。

## 反向合入（niulai ← son-mode opt-in）

将 `ecfacb4` 的行为合回 `feature/niulai`：`interactionActions` 可 `enabled: false` 跳过 climb/perch/hang；客户菜单按包可选。牛来 pet.json 按现有设计保留其启用的角色，不因为合入而误关。

## 从 niulai 移除兄弟判官

删除或停止跟踪：

- `pets/library/brother-judge/`（若该分支跟踪）
- 兄弟判官 `.petpack`（若存在）
- `scripts/audit_brother_judge_matting.py`
- `outputs/brother-judge-matting-audit.json`、`outputs/brother-judge-matting-audit.md`（若跟踪）
- 测试、文档、提示词中把兄弟判官当作本分支交付物的段落

保留雷达、跪爬、当个事儿办、IM、行情等通用播放器代码，供牛来 pet.json 使用。客户构建默认 `--pet pets/packages/niulai.petpack`，开箱不是兄弟判官。

导入外部 brother-judge 包仍应能被通用播放器加载（校验通过即可）；本分支不再预装、不再在 README 中作为主宠介绍。

## 执行顺序

使用 `.worktrees/` 隔离检出，不直接在用户当前正在查看的分支上混改。

1. 代码：niulai 通用模块 → son-mode；son-mode opt-in → niulai；niulai 删除兄弟判官。
2. 跑各自分支相关测试（至少 `npm run test:js` 中受影响项；能跑全量则全量）。
3. 按合并后的真实菜单与台词写各分支 README 与提示词。
4. 每分支单独提交；代码提交与文档提交分开。需要推送时按用户当时指示推送。

## 验收

- 打开任一上述分支的 README，「本分支桌宠」即可看懂该主宠全部能力，且与该分支代码/清单一致。
- README 写明提示词在 `docs/prompts/make-current-branch-pet.txt`。
- 该提示词包含：拉仓库、确认能力、确认图片功能、确认 Windows/macOS、确认完再实现、交付可运行安装包。
- `feature/son-mode` 可构建兄弟判官客户 EXE；无对应 pet.json 配置时钉钉拒接与行情条不出现。
- `feature/niulai` 工作区不再预装兄弟判官；可构建牛来客户 EXE。
- son-mode 不包含牛来外形与来电/行情默认资源。

## 风险

- `src/main-v3.js` 合并冲突多：按「模块取 niulai、默认宠物与任务通道取 son-mode」处理。
- 行情与拒接若误接到托盘默认项，会污染兄弟判官产品；必须用 petpack 存在性做 `visible`。
- 十个分支改 README 时不要互相覆盖工作区；必须 worktree 或一次只 checkout 一个分支。
