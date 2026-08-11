# Task 3 Report: edge-voice.js — edge-tts 语音合成

## What I Implemented

- **`src/edge-voice.js`**: Module exporting `createVoiceSynthesizer({ cacheDir, voice = 'zh-CN-YunxiNeural', rate = '+0%', loader })`.
  - Hash key = `sha256(text + voice + rate)` first 32 hex chars → filename `<hash>.mp3`.
  - Cache hit (file exists) returns `Promise<{ url: 'voice-cache://<hash>.mp3' }>` immediately.
  - Cache miss: loads tts via `loader` (or default `require('edge-tts').tts`), writes Buffer to `cacheDir/<hash>.mp3`, returns `{ url }`.
  - Any exception inside synthesize returns `null` (never throws).
  - Module-level mutual-exclusion chain (`chain`) serializes synthesis calls per synthesizer instance to prevent thundering-herd on the edge-tts network endpoint.
  - `dispose()` resets the chain.
- **`scripts/test-edge-voice.js`**: Two async tests (`testCacheHit`, `testNetworkFailureReturnsNull`) using a `loader` injection so tests never hit the network.
- **`package.json`**: Added `"edge-tts": "^1.0.1"` to dependencies; appended `&& node scripts/test-edge-voice.js` to `test:js` after `test-watch-config.js`.
- **`package-lock.json`**: Updated by `npm install --save edge-tts@^1.0.1` (added 3 packages: edge-tts + transitive deps).

## TDD Evidence

### RED (Step 3)

Command: `node scripts/test-edge-voice.js`

```
node:internal/modules/cjs/loader:1404
  throw err;
  ^
Error: Cannot find module '../src/edge-voice'
Require stack:
- D:\Vibe_Coding\desktop-pet\scripts\test-edge-voice.js
    ...
    at Object.<anonymous> (D:\Vibe_Coding\desktop-pet\scripts\test-edge-voice.js:6:36)
    ...
  code: 'MODULE_NOT_FOUND',
EXIT=1
```

### GREEN (Step 5)

Command: `node scripts/test-edge-voice.js`

```
edge-voice: all tests passed
EXIT=0
```

Both async tests pass: `testCacheHit` (verifies 2nd call hits cache — loader wrapped counter stays at 1) and `testNetworkFailureReturnsNull` (loader throws → synthesize returns null).

## npm run test:js Result

Command: `npm run test:js`

Full chain (24 node steps including the new `test-edge-voice.js`) passed cleanly:

```
renderer interaction regression checks passed
petpack archive security checks passed
test-sequences-schema: ok
window interaction geometry checks passed
window discovery checks passed
interaction controller checks passed
topmost guard checks passed
runtime CDP contract tests passed
laopo petpack regression checks passed
startup greeting checks passed
test-sequence-controller: ok
ok - testDedupe
... (watch-rules all tests passed)
watch-rules: all tests passed
... (watch-config all tests passed)
watch-config: all tests passed
edge-voice: all tests passed
EXIT=0
```

Output is pristine — no stray logs, no warnings, no `console.error` from any test.

## Tests Did NOT Hit the Network (Confirmed)

Both tests inject a `loader` option into `createVoiceSynthesizer`:

- `testCacheHit`: `loader: () => fakeTts` (wraps with counter). First call uses fakeTts returning `Buffer.from('fake-mp3:你好')`; second call short-circuits via `fs.existsSync(filePath)` cache check before any loader is invoked. The wrapped counter asserts `count === 1` confirming the network was not hit twice.
- `testNetworkFailureReturnsNull`: `loader: () => { throw new Error('net down'); }` — the loader itself throws synchronously, simulating a network failure. The synthesize catch returns `null`. No HTTP/WS connection to edge-tts is attempted.

The default `loadTts = loader || (() => require('edge-tts').tts)` only requires `edge-tts` when no loader is injected — tests always inject, so the `edge-tts` package is never invoked at runtime during tests. (It is installed so `require` resolves at module-eval time only if `loader` is absent, which the tests don't trigger.)

## Files Changed

- `D:/Vibe_Coding/desktop-pet/src/edge-voice.js` (new, 29 lines)
- `D:/Vibe_Coding/desktop-pet/scripts/test-edge-voice.js` (new, 39 lines)
- `D:/Vibe_Coding/desktop-pet/package.json` (dependencies + test:js chain)
- `D:/Vibe_Coding/desktop-pet/package-lock.json` (npm install regeneration)

## Self-Review Findings

- **Completeness**: Implements the exact interface from the brief — `synthesize` returns `Promise<{url}|null>`, `dispose` resets chain, `loader` injection supported. Matches brief code character-for-character (modulo whitespace).
- **Never throws**: The try/catch inside the chain task swallows any error (loader throw, tts rejection, write failure) and returns `null`. Verified by `testNetworkFailureReturnsNull`.
- **Hash filename**: `sha256(text+voice+rate).slice(0,32)` produces 32 hex chars → `^[a-f0-9]{32}\.mp3$` matches. URL format `voice-cache://<hash>.mp3` matches test assertion `a.url.startsWith('voice-cache://')`.
- **Mutual exclusion**: `chain = task.catch(() => {})` keeps the chain alive even when a task returns null, so subsequent calls still serialize. Correct.
- **YAGNI**: No extra features — no rate-limit config, no TTL, no background prewarm. Brief specified the surface and nothing more was added.
- **Test hygiene**: Tests use `os.tmpdir()` + `mkdtempSync` for isolation (no cross-test contamination), inject `loader`, exit 1 on failure, log only the single success line on pass. Pristine output confirmed.
- **edge-tts version**: installed resolved version is within `^1.0.1` range; package.json declares `^1.0.1` as required.
- **No concerns** identified. Implementation is minimal, correct, and faithful to the brief.

## Commits

- `246aa6b` feat: add edge-tts voice synthesizer with cache
