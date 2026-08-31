# Task 1 Report: son-mode worktree + 能力门禁测试

## Status

**DONE**

## Worktree Setup

```powershell
git check-ignore -q .worktrees   # exit 1 (not ignored in this checkout; brief notes .worktrees/ is in .gitignore)
git worktree add .worktrees/son-mode feature/son-mode
cd .worktrees/son-mode
git branch --show-current        # feature/son-mode
```

Worktree path: `D:/Vibe_Coding/desktop-pet/.worktrees/son-mode`  
Base branch HEAD before commit: `ecfacb4 feat: make window-edge roles and customer menus opt-in per petpack`

## Files Created

| File | Purpose |
|------|---------|
| `src/capability-gates.js` | 能力门禁纯函数模块 |
| `scripts/test-capability-gates.js` | 断言驱动测试脚本 |

## Interfaces Implemented

| Function | Signature | Behavior |
|----------|-----------|----------|
| `hasWatch` | `(manifest) → boolean` | `manifest.watch` 为非数组对象时为 true |
| `hasMarketSequences` | `(manifest) → boolean` | `sequences` 含 `market-bull` 或 `market-bear` |
| `hasCallHangupSequence` | `(manifest) → boolean` | 任一 sequence stage 含 `onContact` 或 `messageLoop` |
| `watchMenuLabel` | `(manifest) → string` | 返回 trim 后的 `watch.menuLabel`，缺省 `'消息雷达'` |
| `taskProviderFromConfig` | `(watchConfig) → 'mock' \| 'feishu'` | 仅当 `tasks.provider === 'mock'` 返回 mock，否则 feishu |

## TDD Evidence

### RED — Step 3 (test before implementation)

Command:

```powershell
node scripts/test-capability-gates.js
```

Output (exit code 1):

```
Error: Cannot find module '../src/capability-gates'
Require stack:
- D:\Vibe_Coding\desktop-pet\.worktrees\son-mode\scripts\test-capability-gates.js
```

Matches brief expectation: FAIL with `Cannot find module '../src/capability-gates'`.

### GREEN — Step 5 (after minimal implementation)

Command:

```powershell
node scripts/test-capability-gates.js
```

Output (exit code 0):

```
test-capability-gates: ok
```

All assertions pass for brother manifest (watch only, no market/hangup) and niulaiLike manifest (market + call-hangup sequences).

## Commit

| SHA | Subject |
|-----|---------|
| `82895b1` | test: add capability gates for watch, market, hangup, and task provider |

Branch: `feature/son-mode` (worktree `.worktrees/son-mode`)  
Not pushed (per task instructions).

## Self-Review

1. **Scope**: Only the two specified files were added; no changes to `feature/bestie-pets-design` or other branches.
2. **TDD order**: Test written and verified failing before implementation; implementation matches brief verbatim.
3. **Edge cases covered by tests**:
   - Empty manifest → no watch, default menu label
   - Brother pet → watch enabled, custom label, no market/hangup
   - Niulai-like pet → market sequences + call-hangup detection
   - Task provider default (feishu) vs explicit mock
4. **No concerns**: Module is side-effect free, suitable for downstream manifest gating in son-mode features.

## Verification Checklist

- [x] Worktree on `feature/son-mode`
- [x] RED confirmed (module not found)
- [x] GREEN confirmed (`test-capability-gates: ok`)
- [x] Commit on worktree branch
- [x] No push
- [x] Report written
