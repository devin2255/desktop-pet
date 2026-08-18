# 牛来桌宠交接备忘

日期：2026-08-18  
分支：`feature/niulai`  
从：`feature/son-mode` @ `3f95941`

## 现在到哪了

设计：`docs/superpowers/specs/2026-08-17-niulai-office-pet-design.md`  
计划：`docs/superpowers/plans/2026-08-17-niulai-office-pet.md`（Task 1–10 已落地）

播放器通用能力、`pets/library/niulai` 帧、`pets/packages/niulai.petpack`、客户 EXE 都已做完并提交。HEAD 在打包提交附近；本机产物：

- EXE：`dist/customers/niulai/牛来桌面宠物-1.0.0.exe`（`dist/` 不进 git，公司需重打或从本机拷）
- 报告：`dist/customers/niulai/build-report.json`

客户首次 `boss-watch.json`：雷达关、拒接关、`bosses: []`，无开发者 `ou_`。代码签名未做。钉钉文本无本机官方 Stream，`startMessages` 为空。

## 公司拉取

```powershell
git fetch origin
git checkout feature/niulai
git pull origin feature/niulai
```

仓库：`https://github.com/devin2255/desktop-pet.git`

重打客户包（不要用 `npm run build:customer --` 传参）：

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/niulai.petpack
node scripts/build-customer.js --pet pets/packages/niulai.petpack --name "牛来桌面宠物" --delivery-id niulai
```

## 下一步（优化，不要重开脑暴）

1. 读设计和本备忘锁定决策，不要推翻。
2. 钉钉真机：给 `createDingtalkAdapter` 接真实 `locateIncomingCall` / `invokeReject`（现为返回 null 的骨架）。有测试号再验：老板来电爬窗喊妈 → 妈妈入画 → 脚踩挂断；非老板不演不挂；托盘关掉拒接后不演不挂。
3. 真机观感：idle 躺平循环、透明穿透、静止连点 50 次、拖动、日常爬窗手贴墙、坐窗「不敢跳」、跪爬、右键「演一出来电」。
4. 可选：录 `audio/call-mom.mp3`（「妈妈！」）和 `audio/mom-niulai.mp3`（「牛来？」）写回 `pet.json` 的 `speechAudio`。
5. 妈妈与牛来身高差已有，画风仍偏像同一角色；踢腿末帧已压在挂断锚点 `(0.72, 0.96)`，观感可再收。

## 已锁定、不要再问一遍的决策

- 办公嘴替，不是院线朝圣玩具。
- 播放器通用，人设/词库/分镜全部进 `.petpack`，不写死「牛来」。
- 飞书 + 钉钉都是消息适配器；**来电只做钉钉语音**。
- 只拒接老板名单；托盘可关；自用默认真挂；客户版默认关。
- 牛来一边爬向来电窗口一边循环喊「妈妈！」；手贴窗口侧边。
- 妈妈必须出境；走到挂断键用脚踩；看见脚接触才真挂。单窗口，不新开妈妈窗口。
- 词库四类：画饼、吹牛、加班、甩锅。加班 `keywordStates` → `crawl`，禁止映射到窗口角色。
- 加班触发用「今晚加班」整词，不用单字「今晚」。
- 原创手搓 2D 小黄牛，不描电影 3D。豹拉只出现在台词里。
- 老板 `open_id` 不进仓库，走本机 `userData/boss-watch.json`。
- 来电攀爬走 `approach-target`，禁止 `interaction.transition('climb')`。

## 对照代码

| 用途 | 路径 |
|---|---|
| 趋近来电窗 | `src/approach-target.js` |
| 老板匹配 | `src/im-match.js` |
| IM 总线 | `src/im-bus.js` |
| 飞书适配器 | `src/im-adapter-lark.js`（包装 `message-watcher.js`） |
| 钉钉来电 | `src/im-adapter-dingtalk.js`（locate 骨架仍返回 null） |
| 配置/托盘开关 | `src/watch-config.js`、`src/main-v3.js` |
| 分镜趋近/喊妈 | `src/sequence-controller.js` |
| 资源包 | `pets/library/niulai/pet.json`、`pets/packages/niulai.petpack` |
| 入画合成 | `scripts/compose_call_enter.py` |
| 交付约定 | 仓库根 `AGENTS.md` |

## 不要提交

- `.idea/`、`outputs/` 里的飞书二维码、群消息、本机 `boss-watch.json`
- `dist/*.exe`（已 gitignore）
- 未完成的 `.superpowers/sdd/` 兄弟判官任务稿（与牛来无关）
