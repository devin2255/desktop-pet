# Task 5 报告：son-mode README + 提示词（兄弟判官）

**Status:** DONE  
**Branch:** feature/son-mode  
**Commit:** `1017f76c73dc652a0cc1e44e211315cdbbe076b0`  
**Worktree:** `.worktrees/son-mode`

## 实现

1. **README.md** — 在版本号后插入「本分支桌宠」一节，描述兄弟判官身份、动作、台词、互动、托盘与交付；托盘文案对照 `src/main-v3.js` 与 `scripts/test-capability-gates.js`（画饼雷达 `menuLabel`；拒接钉钉 / 行情条因无对应序列默认不显示）。
2. **docs/prompts/make-current-branch-pet.txt** — 覆盖为计划 Shared Prompt，`CHECKOUT_BRANCH` 已替换为 `feature/son-mode`，含确认优先流程与 macOS 未交付说明。
3. **docs/prompts/README.md** — 声明 `make-current-branch-pet.txt` 为唯一入口；`make-laopo-pet.txt` 为历史参考。

## 核对

```powershell
Select-String -Path README.md -Pattern '本分支桌宠|make-current-branch-pet|叫爸|画饼|macOS'  # PASS
Select-String -Path docs/prompts/make-current-branch-pet.txt -Pattern 'git clone|feature/son-mode|macOS|禁止生成动画'  # PASS
# 提示词中无字面 CHECKOUT_BRANCH
```

## 备注

- `brother-judge` 的 `pet.json` 未纳入 git 跟踪；菜单标签以合并后播放器代码与 capability-gates 测试夹具为准。
- 未 push（按任务要求）。
