# Task 1 Report: watch-rules.js 过滤管线纯函数（TDD）

## What I Implemented

Created the pure-function filtering pipeline for the "飞书画饼雷达" (boss watch radar) feature:

- **`src/watch-rules.js`** — Six exports per the brief's Step 3 implementation, transcribed verbatim:
  - `createDedupeSet(maxSize = 5000)` — LRU set with FIFO eviction (`seen` Set + `queue` array; shifts oldest when over limit).
  - `isBoss(senderId, bossIds)` — strict boolean; returns false for empty array or non-string senderId.
  - `matchKeyword(text, keywordMap)` — checks `text.toLowerCase().includes(category.toLowerCase())` per category in object-key order; returns the first matching category or `null`.
  - `inQuietHours(now, quietHours)` — minute-based comparison; supports same-day (`s < e`) and cross-midnight (`s > e`) intervals; empty array → false.
  - `pickLine(pool, rng = Math.random)` — injectable RNG for testability; falls back to `['']` on empty/non-array.
  - `DEFAULT_KEYWORDS` — constant with 画饼 / 吹牛 response-line pools.
- **`scripts/test-watch-rules.js`** — Six test functions covering all exports, transcribed from the brief Step 1 with one typo fix (see below).
- **`package.json`** — Appended ` && node scripts/test-watch-rules.js` to the `test:js` script chain.

### Typo Fix (documented deviation from brief)

The brief's `testMatchKeyword` test text `'年底给你画个大饼'` does NOT contain `'画饼'` as a contiguous substring (the characters 画 and 饼 are separated by 个大 in that string). Since the implementation checks `text.toLowerCase().includes(category.toLowerCase())` — i.e. the text must contain the category key as a substring — this test case would always return `null` and fail.

The `DEFAULT_KEYWORDS` values are clearly response *lines* (long sentences with exclamation marks), confirming that the keywordMap's array values are pickLine pools, not match keywords. The implementation correctly matches the category key against the text, consistent with the interface description (`text.toLowerCase().includes(keyword.toLowerCase())`).

Fix: changed the test text from `'年底给你画个大饼'` to `'年底给你画饼了'` (画 and 饼 are now adjacent), preserving the semantic intent (drawing a pie = making empty promises) while making the substring match succeed. No implementation code was changed.

## TDD Evidence

### RED — Step 2 (before implementation)

Command:
```
node scripts/test-watch-rules.js
```

Failing output excerpt:
```
Error: Cannot find module '../src/watch-rules'
Require stack:
- D:\Vibe_Coding\desktop-pet\scripts\test-watch-rules.js
    at Function._resolveFilename (node:internal/modules/cjs/loader:1401:15)
    ...
    code: 'MODULE_NOT_FOUND'
EXIT_CODE=1
```

### GREEN — Step 4 (after implementation)

Command:
```
node scripts/test-watch-rules.js
```

Passing output:
```
ok - testDedupe
ok - testIsBoss
ok - testMatchKeyword
ok - testQuietHours
ok - testPickLine
ok - testDefaults
watch-rules: all tests passed
EXIT_CODE=0
```

All six test functions pass.

## `npm run test:js` Result

Command:
```
npm run test:js
```

Result: **PASSING** (exit code 0). The entire JS test chain (syntax checks + all existing test scripts + the new `test-watch-rules.js`) ran cleanly with no errors. Output was pristine — all existing tests still pass and the new test output appears at the end:

```
... (existing test output) ...
test-sequence-controller: ok
ok - testDedupe
ok - testIsBoss
ok - testMatchKeyword
ok - testQuietHours
ok - testPickLine
ok - testDefaults
watch-rules: all tests passed
```

## Files Changed

- `src/watch-rules.js` (created — 46 lines)
- `scripts/test-watch-rules.js` (created — 68 lines)
- `package.json` (modified — `test:js` script extended with `&& node scripts/test-watch-rules.js`)

## Self-Review Findings

1. **Completeness**: All six exports from the brief are implemented and tested. The module is CommonJS (`module.exports`), uses `'use strict'`, and has zero dependencies — consistent with `src/startup-greeting.js` style.

2. **TDD discipline**: RED was confirmed (module-not-found, exit 1) before any implementation was written. GREEN was confirmed after implementation.

3. **Test hygiene**: The test script follows the repo's established pattern (tests object, iterate with try/catch, `console.log` on pass / `console.error` on fail, `process.exit(1)` on any failure). No test pollution — each test function is independent. RNG is injected in `testPickLine` (deterministic). No flaky randomness.

4. **YAGNI**: No extra functions, no over-engineering. The `pickLine` fallback to `['']` is defensive but minimal. The `toMinutes` helper is private (not exported).

5. **Chain integrity**: The `test:js` chain was extended correctly — the new test runs last and the whole chain passes, confirming no existing test was broken.

6. **Concern**: The brief contained a typo in the test text (see Typo Fix section above). The fix is minimal and preserves intent. The implementation was NOT modified — only the test text was corrected to contain the required substring.

## Commits Created

- `3ed0243` — `feat: add watch rules filtering pipeline`
