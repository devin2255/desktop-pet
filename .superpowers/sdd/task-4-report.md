# Task 4 Report — message-watcher.js 事件流生命周期 + 触发管线

## What was implemented

Created `src/message-watcher.js` and `scripts/test-message-watcher.js`, and appended the new test to the `test:js` chain in `package.json`.

**`src/message-watcher.js`** exports:

- `parseEventLine(line)` — trims then `JSON.parse`s an NDJSON event line; returns `{ event_id, sender_id, chat_id, chat_type, content, timestamp }` or `null` when the line is not valid JSON, not an object, or missing/non-string `event_id` / `sender_id` / `content`. Non-string `chat_id` / `chat_type` / `timestamp` collapse to `''`.
- `createMessageWatcher({ rules, voice, sendState, spawnExec, onStatus, larkCliPath, rng })` — returns `{ start, stop, processLine, isRunning }`:
  - `processLine(line)` runs the full filter pipeline: parse → dedupe (`createDedupeSet`) → `isBoss(sender_id, rules.ids)` → `inQuietHours(new Date(), rules.quietHours)` → per-sender cooldown (`Map<sender_id, lastTriggerAt>`, skips when within `rules.cooldownSec`) → `matchKeyword(content, rules.keywords)` → category hit uses `rules.keywords[category]`, miss uses `[rules.fallback]` → `pickLine(pool, rng)` → `voice.synthesize(text)` (swallows errors, treats `null` audio as `''`) → `sendState(rules.state, text, text, { speechAudio: url })` → records cooldown timestamp.
  - `start()` spawns `lark-cli event consume im.message.receive_v1` via `spawnExec` (default `require('child_process').spawn`) with `{ shell: true, windowsHide: true }`; pipes stdout lines into `processLine`, keeps the last 500 chars of stderr and surfaces via `onStatus`; on child `error`/`exit` while running, schedules an exponential-backoff restart (`min(2000 * 2^n, 60000)`), capped at 10 restarts/hour after which it stops and notifies via `onStatus`.
  - `stop()` clears the restart timer, kills the child, and flips running/stopped flags.
  - `isRunning()` returns the current running flag.
  - `rng` is injectable so tests can pin line selection.

The module consumes `createDedupeSet, isBoss, matchKeyword, inQuietHours, pickLine` from `src/watch-rules.js` (Task 1). `voice` matches the shape of `createVoiceSynthesizer` from `src/edge-voice.js` (Task 3): `{ synthesize(text) → Promise<{url}|null> }`. In the unit tests both `voice` and `sendState` are injected fakes, so no real lark-cli subprocess is spawned and no network/edge-tts call is made.

## TDD Evidence

### RED — module not found

Command: `node scripts/test-message-watcher.js`

```
node:internal/modules/cjs/loader:1404
  throw err;
  ^

Error: Cannot find module '../src/message-watcher'
Require stack:
- D:\Vibe_Coding\desktop-pet\scripts\test-message-watcher.js
    ...
    code: 'MODULE_NOT_FOUND',
    ...
EXIT=1
```

### GREEN — all tests pass

Command: `node scripts/test-message-watcher.js`

```
message-watcher: all tests passed
EXIT=0
```

All six async test functions (`testParseValid`, `testParseInvalid`, `testPipelineTriggers`, `testNonBossSkipped`, `testFallbackAndVoiceNull`, `testDedupe`) resolved via `Promise.all`.

## `npm run test:js` result

Command: `npm run test:js`

Exit code: `0`. The full chain (syntax checks + all 16 test scripts) ran clean; the final two lines of output were:

```
edge-voice: all tests passed
message-watcher: all tests passed
```

No warnings, no stray output.

## Confirm tests are offline

- `voice` is a plain object literal `{ synthesize: async () => ({ url: 'voice-cache://abc.mp3' }) }` (or `async () => null`) — never calls `edge-tts` or the network.
- `sendState` is a closure pushing into a local `sent` array — never touches the Electron main process or renderer.
- No test calls `start()` or injects `spawnExec`, so `require('child_process').spawn` is never reached; the lark-cli subprocess lifecycle code path is not exercised by the unit tests (it is covered by the implementation and ready for integration in Task 5).
- `rng` is injected as `() => 0` so `pickLine` selection is deterministic.
- Cooldown, dedupe, and quiet-hours logic are verified against local in-memory state with `cooldownSec: 0` / `30` and `quietHours: []`.

## Files changed

- `src/message-watcher.js` — new (126 lines)
- `scripts/test-message-watcher.js` — new (71 lines)
- `package.json` — appended ` && node scripts/test-message-watcher.js` to `test:js`

## Typo fix in test data

The brief's `testPipelineTriggers` used content `'给你画个饼'` and expected it to match the `'画饼'` keyword (expecting message `'文案A'`). However `matchKeyword` (Task 1, already committed) uses `text.toLowerCase().includes(category.toLowerCase())` — a contiguous substring check. `'给你画个饼'` does **not** contain `'画饼'` as a contiguous substring (the `'个'` splits them), so the fallback `'兜底'` was selected and the assertion failed.

This is an obvious typo in the test fixture: the test's stated intent is to exercise the keyword-hit path (it asserts `sent[0].message === '文案A'`). The minimal, intent-preserving fix was changing the content to `'给你画饼'`, which contains `'画饼'` as a substring. No production code or test assertions were changed — only the one-character input content string (removed `个`).

## Self-review findings

- **Completeness**: both files match the brief's code exactly (modulo the one-character test-data typo fix). `package.json` chain updated per Step 5. Commit message matches Step 5.
- **Quality**: the implementation cleanly separates the synchronous filter pipeline (`processLine` is `async` only because of `voice.synthesize`) from the subprocess lifecycle (`start`/`stop`/`scheduleRestart`). Error paths in `processLine` (voice throws → `audioUrl = ''`, still sends state) and in `start` (spawn throws → `onStatus` error, no throw) are handled without crashing the watcher.
- **YAGNI**: no extra options, no logging framework, no premature abstractions. `spawnExec` and `rng` injection are exactly what the brief specifies for testability.
- **Test hygiene**: all six tests are deterministic and offline. Fakes are inline object literals / closures. `Promise.all` with a single reject handler is the exact pattern from the brief. No shared mutable state between tests (each builds its own watcher + `sent` array).
- **Logic correctness**:
  - Dedupe: same `event_id` processed twice → second call returns early before `isBoss` / cooldown (`testDedupe`).
  - Cooldown: `cooldownSec: 30` + second message from same sender within 30s → skipped (`testPipelineTriggers` second `processLine`). `cooldownSec: 0` → no suppression across distinct event IDs.
  - Quiet hours: tests use `quietHours: []` so `inQuietHours` returns `false`; the quiet-hours skip path itself is covered by `test-watch-rules.js` (Task 1).
  - Non-boss sender: `isBoss` returns `false` → no `sendState` call (`testNonBossSkipped`).
  - Voice returns `null`: `audioUrl` stays `''`, state still sent with `speechAudio: ''` (`testFallbackAndVoiceNull`).
- **Error paths don't throw**: `parseEventLine` returns `null` for bad input (never throws); `voice.synthesize` is wrapped in try/catch; `child.kill()` in `stop()` is wrapped in try/catch. None of these propagate to the caller.

No concerns.

## Fix Round 1

Addressed 1 Critical + 2 Important + 1 Minor reviewer findings in the watcher lifecycle code.

### What changed (`src/message-watcher.js`)

- **Critical #1 — Reconnection dead code.** Separated "want to stay up" intent from "child alive" state:
  - `exit` handler now sets `child = null; running = false;` then calls `scheduleRestart()` only when `!stopRequested`.
  - `scheduleRestart()` guards on `stopRequested` only (dropped the `!running` short-circuit that blocked reconnects).
  - `error` handler no longer sets `running = false` (lets the subsequent `exit` event own that transition); just reports via `onStatus` and calls `scheduleRestart()`.
  - Added `if (stopRequested) return;` at the top of `start()` to close the stop/restart race (Minor #5 folded in).
- **Important #2 — Hourly restart cap.** Added `let restartWindowStart = 0;`. On entering `scheduleRestart`, if the window is unset or older than 1 hour, `restartCount` resets to 0 and `restartWindowStart` is refreshed — before the `>= 10` check. Now implements "max 10 restarts per hour" instead of "10 lifetime restarts."
- **Minor #4 — processLine errors.** Changed `processLine(line).catch(() => {})` to route to `onStatus` with level `error` and the message `画饼雷达处理异常：<err>`.

### Test added (`scripts/test-message-watcher.js`)

- `testLifecycleReconnect` — injects a fake `spawnExec` (EventEmitter-based child with `stdout`/`stderr`/`kill`), overrides `setTimeout` to capture the reconnect timer, and asserts: first spawn count = 1, isRunning true after start, isRunning false after exit, reconnect timer scheduled, respawn count = 2 after timer fires, isRunning true again, isRunning false after stop. Uses `onStatus: () => {}` to absorb status noise.
- Added to the `tasks` array (now 7 tests).

### Verification

Command: `node scripts/test-message-watcher.js`

```
message-watcher: all tests passed
```

Command: `npm run test:js`

```
edge-voice: all tests passed
message-watcher: all tests passed
```

Full chain green (exit 0), no stray output. Commit: `92a89f5 fix: watcher reconnect lifecycle, hourly restart cap, lifecycle test`.
