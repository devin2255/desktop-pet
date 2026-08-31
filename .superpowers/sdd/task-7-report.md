# Task 7 Report — 其余分支 README + 制作提示词

## 执行方式

PowerShell 脚本 `scripts/apply-branch-pet-docs.ps1` 因 UTF-8/here-string 解析失败；改用 Node 脚本 `scripts/apply-branch-pet-docs.js`（支持 `--filter` 单分支重跑）。

## 提交结果

| 分支 | 主宠 | Commit |
|------|------|--------|
| `main` | boss | `38e52a1` |
| `feat/laopo-pet` | laopo | `e881df2` |
| `feat/medusa-pet` | medusa | `5efcf5e` |
| `feature/bestie-pets-design` | guimi | `e8ae423` |
| `feature/boss-watch` | brother-judge | `b0a3eaa` |
| `feature/brother-judge-bubble-copy` | brother-judge | `9d67d1d` |
| `feature/dog-and-cat` | dog-and-cat | `cf6351f` |
| `son-pet-window-interactions` | xiaogou | `b776fe2` |

每分支均新增/更新：

- `README.md` — 「本分支桌宠」能力节
- `docs/prompts/make-current-branch-pet.txt` — 确认优先的 Shared Prompt（含 clone、分支 checkout、macOS 未交付、动手前禁止生成）

## 特殊处理

- `son-pet-window-interactions` README 无「当前版本」锚点，脚本增加 fallback：在 `.petpack` 包介绍段后插入。
- `feature/dog-and-cat` 明确标注 petpack **计划中 / 未交付**，内置演示仍为 boss。

## 未推送

以上 commit 均在各 worktree / 当前 checkout，**未 push origin**。
