# Task 6 Report — niulai README + 提示词（牛来）

**Status:** PASS  
**Date:** 2026-08-31  
**Branch:** `feature/niulai`  
**Worktree:** `.worktrees/niulai`

## Summary

在 niulai 分支文档中写入「本分支桌宠」能力节（仅牛来）、Shared Prompt 制作入口，并更新 `docs/prompts/README.md` 对齐 confirm-first 流程。

## Changes

| File | Action |
|------|--------|
| `README.md` | 在版本号后插入「本分支桌宠」：身份、动作、气泡/台词（对照 `pets/library/niulai/pet.json`）、互动、托盘、交付命令 |
| `docs/prompts/make-current-branch-pet.txt` | 覆盖为 Global Shared Prompt，`CHECKOUT_BRANCH` → `feature/niulai` |
| `docs/prompts/README.md` | 声明主宠牛来、入口文件、macOS 未交付与确认前禁止动手；保留 `make-niulai-pet.txt` 为历史参考 |

## Verification

```powershell
Select-String -Path README.md -Pattern '本分支桌宠|牛来|兄弟判官|make-current-branch-pet'
Select-String -Path docs/prompts/make-current-branch-pet.txt -Pattern 'git clone|CHECKOUT_BRANCH|feature/niulai|macOS|禁止生成动画'
```

- README 含主宠节与提示词链接；无「兄弟判官」作主宠表述
- 提示词含 clone、`feature/niulai`、macOS 未交付、确认前禁止动手；无字面 `CHECKOUT_BRANCH`

## Commit

```
d9573fb34d7a64cba909a0afb4d2bc9e0a12ec17
docs: document niulai-only capabilities and confirm-first prompt
```

## Not done

- 未 `git push`（按 Task 约束）
- 未改播放器或 petpack 资源
