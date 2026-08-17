# 牛来桌宠交接备忘

日期：2026-08-17  
分支：`feature/niulai`  
从：`feature/son-mode` @ `3f95941`

## 现在到哪了

设计已确认，文档在 `docs/superpowers/specs/2026-08-17-niulai-office-pet-design.md`。

**还没做：** 实施计划、播放器改动、动画帧、`.petpack`、EXE。

## 回家拉取

```powershell
git fetch origin
git checkout feature/niulai
git pull origin feature/niulai
```

仓库：`https://github.com/devin2255/desktop-pet.git`

## 下一步（新会话按这个顺序）

1. 读完设计文档，不要重新开脑暴推翻已确认决策。
2. 调用 **writing-plans**，产出 `docs/superpowers/plans/2026-08-17-niulai-office-pet.md`。
3. 用户确认计划后，再实施。建议切分：
   - 播放器通用：IM 总线、飞书适配器拆分、钉钉适配器、`approach-target`、序列字段（`speechGender` / `messageLoop` / `approachTarget` / `restorePosition`）
   - 钉钉来电：定位窗口侧边 + 挂断键，脚接触才 Invoke
   - 资源包：`pets/library/niulai` 原创小黄牛 + 来电分镜（爬着喊妈 → 妈妈入画 → 独行 → 用脚挂断）
   - 校验、真机、客户构建（客户版雷达/拒接默认关）

未确认计划前不要画帧。

## 已锁定、不要再问一遍的决策

- 办公嘴替，不是院线朝圣玩具。
- 播放器通用，人设/词库/分镜全部进 `.petpack`，不写死「牛来」。
- 飞书 + 钉钉都是消息适配器；**来电只做钉钉语音**。
- 只拒接老板名单；托盘可关；自用默认真挂；客户版默认关。
- 牛来一边爬向来电窗口一边循环喊「妈妈！」；手贴窗口侧边。
- 妈妈必须出境；走到挂断键用脚踩；看见脚接触才真挂。单窗口，不新开妈妈窗口。
- 词库四类：画饼、吹牛、加班、甩锅。
- 原创手搓 2D 小黄牛，不描电影 3D。豹拉只出现在台词里。
- 老板 `open_id` 不进仓库，走本机 `userData/boss-watch.json`。

## 对照代码（基线已在本分支祖先里）

| 用途 | 路径 |
|---|---|
| 飞书雷达 | `src/message-watcher.js` `src/watch-rules.js` `src/watch-config.js` |
| 词库范例 | `pets/library/brother-judge/pet.json` 的 `watch` |
| 多段分镜 | `src/sequence-controller.js` |
| 窗口/锚点 | `src/window-discovery.js` `src/interaction-controller.js` |
| 交付约定 | 仓库根 `AGENTS.md` |
| 制作流程 | `skills/desktop-pet-maker/SKILL.md`、`docs/prompts/make-current-branch-pet.txt` |

## 不要提交

- `.idea/`、`outputs/` 里的飞书二维码、群消息、本机 `boss-watch.json`
- 未完成的 `.superpowers/sdd/` 兄弟判官任务稿（与牛来无关）
