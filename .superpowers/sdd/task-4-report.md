# Task 4 Report — 工作区与参考图 / 身份检查表

**Status:** Complete  
**Date:** 2026-08-04  
**Branch:** `feature/bestie-pets-design`  
**Commit:** none (per instructions)

## Summary

Set up the `xiaomei-xiaotian` work directory for dual-character pet generation: copied the user reference selfie into `source/refs/` and authored `IDENTITY.md` as a generation-time checklist locking left/right identity, outfit rules, and male-model scope.

## Steps Completed

### Step 1: 建目录并复制参考图

```powershell
New-Item -ItemType Directory -Force -Path pets/work/xiaomei-xiaotian/source/refs | Out-Null
Copy-Item pets/work/bestie-reference.png pets/work/xiaomei-xiaotian/source/refs/bestie-reference.png -Force
```

- Source: `pets/work/bestie-reference.png` — exists
- Destination: `pets/work/xiaomei-xiaotian/source/refs/bestie-reference.png` — exists
- Byte size matches source (verified)

### Step 2: 写 IDENTITY.md

Created `pets/work/xiaomei-xiaotian/IDENTITY.md` with:

| Requirement | Covered |
|---|---|
| 左小美：痣 + 月牙链，温柔黏人 | ✓ 辨识锚点 + 气质 |
| 右小甜：比耶气质，活泼外向 | ✓ 辨识锚点 + 气质 |
| 禁止左右互换 | ✓ 全局 + 站位章节 |
| 日常便服 vs 蕾丝/性感高光 | ✓ 分角色表格 + 切换摘要 |
| 男模仅 relax | ✓ 独立章节 + 服装摘要 |

Additional sections: 全局每帧检查项、站位与互动、`drag`/`walk` 备注、可复制 Prompt 锚点。

### Step 3: Commit

Skipped — user explicitly requested no commits.

## Files Created

| Path | Purpose |
|---|---|
| `pets/work/xiaomei-xiaotian/source/refs/bestie-reference.png` | User selfie reference for generation |
| `pets/work/xiaomei-xiaotian/IDENTITY.md` | Identity checklist for prompts & QA |

## Verification

| Check | Result |
|---|---|
| `pets/work/bestie-reference.png` exists | PASS |
| `pets/work/xiaomei-xiaotian/source/refs/bestie-reference.png` exists | PASS |
| Copied file size equals source | PASS |
| `pets/work/xiaomei-xiaotian/IDENTITY.md` exists | PASS |
| IDENTITY lists all five required rules | PASS |

## Concerns / Notes

1. `pets/work/` assets are typically **gitignored** — these files live in the work tree only unless force-added; do not commit private reference photos without user intent.
2. Reference is a single dual selfie; Task 5 generation must enforce left/right from IDENTITY, not infer from photo crop alone.
3. No chroma strips or processed frames yet — this task is setup-only; Task 5 consumes `IDENTITY.md` + refs.

## Next

Task 5: generate standard five actions + `drag` (daily casual, dual-frame) using desktop-pet-maker flow and this IDENTITY checklist.
