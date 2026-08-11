# Task 2 Report: watch-config.js — 双层配置加载合并

## What I implemented

Created two new files and updated `package.json`:

- **`src/watch-config.js`** — config loader that merges the on-disk `userData/boss-watch.json` with a petpack manifest's `watch` field, falling back to safe defaults and never throwing. Exports:
  - `DEFAULT_BOSS_CONFIG` (enabled:false, cooldownSec:30, quietHours:[], voice:{enabled:true, gender:'male', rate:'+0%', voice:'zh-CN-YunxiNeural'}).
  - `loadWatchConfig({ configPath, manifestWatch, larkCliPath })` → normalized `{ enabled, larkCliPath, bosses, ids, names, cooldownSec, quietHours, voice, keywords, fallback, state }`. Read failures / illegal fields silently fall back to defaults.
  - `splitBosses(bosses)` → `{ ids, names }` (items prefixed `ou_` go to ids, the rest to names; non-strings / blanks skipped).
- **`scripts/test-watch-config.js`** — plain node test script covering defaults when file missing, corrupt-JSON fallback, manifest merge (keywords/fallback/state), and boss id/name splitting. Exits 1 on any failure, pristine output.
- **`package.json`** — appended ` && node scripts/test-watch-config.js` to the `test:js` chain after `node scripts/test-watch-rules.js`.

Consumes Task 1's `DEFAULT_KEYWORDS` via `require('./watch-rules')` as specified.

### Brief deviation (documented)

The brief's Step 3 code declared `function loadWatchConfig({ configPath, manifestWatch, larkCliPath })` and then, in the same function body, `const manifestWatch = manifestWatch && typeof manifestWatch === 'object' ? manifestWatch : {};`. Redeclaring a destructured parameter name with `const` in the same scope is a `SyntaxError: Identifier 'manifestWatch' has already been declared` — the module would not load. Per the task instruction "fix obvious typos, do not redesign," I renamed the inner normalized local to `manifest` and updated the four downstream reads (`manifest.keywords`, `manifest.fallback`, `manifest.state`, and the guard expression) to use that name. No behavioral change — the design is identical; only the shadowing binding name differs.

## TDD Evidence

### RED — Step 2 (before implementation)

Command:
```
node scripts/test-watch-config.js
```
Output (excerpt, exit 1):
```
Error: Cannot find module '../src/watch-config'
Require stack:
- D:\Vibe_Coding\desktop-pet\scripts\test-watch-config.js
    at Function._resolveFilename (node:internal/modules/cjs/loader:1401:15)
    ...
    at Object.<anonymous> (D:\Vibe_Coding\desktop-pet\scripts\test-watch-config.js:6:63)
  code: 'MODULE_NOT_FOUND'
Node.js v22.17.1
EXIT=1
```

### GREEN — Step 4 (after implementation)

Command:
```
node --check src/watch-config.js && node scripts/test-watch-config.js
```
Output (exit 0):
```
ok - testDefaultsWhenMissing
ok - testCorruptFileFallsBack
ok - testMergeManifest
ok - testSplitBosses
watch-config: all tests passed
```

## `npm run test:js` result

Full chain passes (exit 0). Tail of output:
```
watch-rules: all tests passed
ok - testDefaultsWhenMissing
ok - testCorruptFileFallsBack
ok - testMergeManifest
ok - testSplitBosses
watch-config: all tests passed
EXIT=0
```
All earlier tests in the chain (syntax checks, renderer interaction, petpack security, sequences schema, window interactions/discovery, interaction controller, topmost guard, runtime CDP contract, laopo petpack, startup greeting, sequence controller, watch-rules) also pass — output is pristine (only `ok -` / `... passed` lines, no stray warnings).

## Files changed

- `src/watch-config.js` (new, 81 lines)
- `scripts/test-watch-config.js` (new, 54 lines)
- `package.json` (one-line edit: appended ` && node scripts/test-watch-config.js` to `test:js`)

## Self-review findings

- **Completeness**: all three deliverables from the brief exist; `loadWatchConfig`, `splitBosses`, and `DEFAULT_BOSS_CONFIG` are exported; the four required test cases match the brief verbatim. ✅
- **TDD hygiene**: RED → GREEN evidenced with exact commands and output; the failure was the expected `MODULE_NOT_FOUND`, not a false positive. ✅
- **No swallowed errors**: the `catch (_) { fileCfg = {}; }` is intentional per the brief — the spec mandates "读取失败/字段非法回退默认值，绝不抛异常". The corrupt-JSON test (`testCorruptFileFallsBack`) explicitly asserts `enabled === false` rather than an exception, so the swallow is asserted behavior, not hidden failure. ✅
- **Edge cases covered by tests**: missing config path, corrupt JSON, manifest keyword/fallback/state merge, boss id/name splitting. The implementation additionally defends against: non-object file root, non-string/blank boss entries, non-finite cooldownSec, malformed quietHours entries, non-object manifestWatch, non-string manifest fields, blank/whitespace strings, and a non-string `larkCliPath`. ✅
- **YAGNI**: no speculative features added; `asStrings` / `asStringArray` are duplicated in the brief itself (kept verbatim) — not a real duplication risk worth "redesigning" away. ✅
- **Convention match**: `'use strict'`, CommonJS, no external deps, plain-node test script with `tests` object + exit 1 on failure — consistent with `src/startup-greeting.js` and the existing test scripts. ✅
- **Test hygiene**: tests write to `os.tmpdir()` and do not pollute the repo; output is limited to `ok -` / `FAIL -` / final summary lines. ✅

No concerns. The only deviation is the documented rename of the shadowed `manifestWatch` local, which is an obvious-typo fix explicitly sanctioned by the task instructions.

## Commits created

- `4aad19f` — feat: add watch config loader with petpack merge
