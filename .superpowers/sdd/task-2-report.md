# Task 2 Report: 工作区 IDENTITY 检查表

**Branch:** `feature/bestie-pets-design`  
**Status:** DONE  
**Date:** 2026-08-27

## Summary

Verified all 9 reference PNGs under `pets/work/guimi/source/refs/` and created `pets/work/guimi/IDENTITY.md` with the full identity checklist required by the brief and design spec. No animation frames generated; no git commit.

## Step 1: 参考图确认

Command:

```powershell
Get-ChildItem pets/work/guimi/source/refs | Select-Object Name
```

**Result:** 9/9 expected files present.

| File | Size (bytes) |
|------|----------------|
| `bestie1-face.png` | 88,731 |
| `bestie1-walk-outfit.png` | 115,559 |
| `bestie1-selfie-outfit.png` | 112,708 |
| `bestie1-relax-outfit.png` | 109,274 |
| `bestie2-face-store.png` | 166,101 |
| `bestie2-face-red.png` | 101,929 |
| `bestie2-walk-outfit.png` | 121,120 |
| `bestie2-selfie-outfit.png` | 149,034 |
| `bestie2-relax-outfit.png` | 318,268 |

All names match the brief expected list exactly.

## Step 2: IDENTITY.md

**Created:** `pets/work/guimi/IDENTITY.md`

Required checklist items (from brief) — all included:

| Requirement | Section in IDENTITY.md |
|-------------|------------------------|
| 左闺蜜一 / 右闺蜜二，禁止互换 | 「站位（全动作硬性约束）」 |
| 脸源与「禁止贴纸脸」 | 「脸部真相源（禁止贴纸脸）」 |
| 三套服装对照表（日常 / 合影 / 去放松） | 「三套服装对照表」 |
| 分角色不分名字：台词用「我们」口吻 | 「台词与角色命名」 |
| 男模仅出现在 relax | 「去放松（relax）特殊约束」 |

Additional content aligned with `2026-08-27-guimi-fan-pet-design.md`:

- package id `guimi`、程序名「闺蜜桌宠」
- 参考图目录与 9 文件清单表
- 成帧前自检摘要（站位、脸源、服装、台词、男模、画布/穿透）

## Step 3: Commit

Skipped per global constraints and user task instruction (no commit).

## Verification

```powershell
Get-ChildItem pets/work/guimi/source/refs | Select-Object Name   # 9 PNGs, names match brief
Test-Path pets/work/guimi/IDENTITY.md                             # True
```

## Out of Scope (confirmed not done)

- Animation frame generation
- `guimi.petpack` build
- Player code changes
- Git commit

## Concerns

None blocking. Reference assets and identity checklist are ready for downstream animation/petpack tasks.
