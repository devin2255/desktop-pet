# Task 8 Report: End-to-End Verification of Boss-Watch Radar Pipeline

## Step 1: Probe the Event Stream

### Commands Used

```bash
# Check available events
lark-cli event list
# Output: im.message.receive_v1  bot  0  Receive IM messages

# Check event schema
lark-cli event schema im.message.receive_v1 --json
# Output: scopes=["im:message.p2p_msg:readonly"], auth_types=["bot"],
#         required_console_events=["im.message.receive_v1"]

# Check current auth scopes
lark-cli auth scopes
# Output: 21 user scopes — all calendar+task, NO im:message scope

# Send test message as bot (works — bot has app credentials)
lark-cli im +messages-send --as bot --user-id ou_221a684c00848f0cd7f3e29d1061d908 --text "test"
# Output: {"ok":true,"data":{"chat_id":"oc_06bf17ae168c6bf3ae6e627182f5e15b",...}}

# Send test message as user (FAILS — missing scope)
lark-cli im +messages-send --as user --user-id ou_221a684c00848f0cd7f3e29d1061d908 --text "test"
# Error: missing required scope(s): im:message.send_as_user, im:message
# Hint: run `lark-cli auth login --scope "im:message.send_as_user im:message"`
```

### Event Stream Verification

**The event stream DOES work** when using the lark-cli-core binary directly.

Initial attempts to run `lark-cli.cmd event consume im.message.receive_v1` from both
bash and Node.js (`spawn` with `shell: true`) failed with:
```
[event] stdin closed — shutting down. consume treats stdin EOF as exit signal
(wired for AI subprocess callers).
Error: context canceled
```

Root cause: The `.cmd` wrapper invokes `cmd.exe`, which loses the stdin pipe when
spawned from a non-interactive context on Windows. The lark-cli binary detects stdin
EOF and shuts down immediately, canceling the context before the event bus can start.

**Fix**: Spawn `lark-cli-core-windows-amd64.exe` directly (bypassing the .cmd wrapper
and `shell: true`), with `stdio: ['pipe', 'pipe', 'pipe']`. This keeps stdin as a
proper pipe and the consumer runs correctly.

Successful probe (core binary, Node.js spawn, no shell):
```
[probe] starting event consumer with core binary directly (no shell)
[probe][STDERR] [event] consuming as cli_aaf3cfa69cb85cf8 (cli_aaf3cfa69cb85cf8)
[probe][STDERR] [event] local bus not found; checking remote connections...
[probe][STDERR] [event] remote connection check: online_instance_cnt=0
[probe][STDERR] [event] started bus daemon pid=9756 (auto-exits 30s after last consumer)
[probe][STDERR] [event] listening for events (key=im.message.receive_v1); will exit after 1 event(s) or 15s timeout
[probe][STDERR] [event] ready event_key=im.message.receive_v1
[probe][STDERR] [source] feishu-websocket: connected
[probe][STDERR] [event] exited — received 0 event(s) in 14s (reason: timeout)
```

The consumer connected via websocket and listened for the full timeout. **0 events
received** because the bot was the sender (bot->user), not the receiver. The
`im.message.receive_v1` event fires when the **bot receives** a message, which
requires a user to send a message **to the bot**.

### Auth Attempt

Attempted split-flow auth for `im:message` scope:
```bash
lark-cli auth login --scope "im:message" --no-wait --json
# Returns: device_code + verification_url
# URL: https://accounts.feishu.cn/oauth/v1/device/verify?flow_id=...&user_code=GKNL-HFMT
```

Generated QR code PNG and presented to user via `qwenwork_file_present_files`.
Started device-code polling (`lark-cli auth login --device-code <code>`), but the
user did not complete browser authorization within the polling window.

**Current user scopes (post-attempt)**: Still only calendar+task scopes. No `im:message`.

### Step 1 Conclusion

- **Event stream**: WORKS (consumer connects, websocket established, ready marker seen)
- **Bot auth**: WORKS (automatic via app credentials `cli_aaf3cfa69cb85cf8`)
- **User auth for sending**: BLOCKED — requires interactive `lark-cli auth login --scope "im:message"`

---

## E2E Script Design

**File**: `scripts/test-boss-watch-e2e.js`

### Design Decisions

| Component | Choice | Reason |
|-----------|--------|--------|
| Voice | FAKE (no edge-tts) | Avoids network dependency; `speechAudio = voice-cache://fake-e2e-test.mp3` |
| LarkCli path | `lark-cli-core-windows-amd64.exe` | Bypasses .cmd wrapper stdin issues |
| spawnExec | Custom (no `shell: true`) | Windows cmd.exe intermediary causes stdin EOF |
| `rng` | `() => 0` (deterministic) | Always picks first entry from keyword pool for predictable assertions |
| Cooldown | 0 sec | Allows immediate re-trigger for testing |
| Quiet hours | `[]` (empty) | No time restrictions |

### Flow

1. **Pre-check**: Verifies user has `im:message` scope via `lark-cli auth scopes`.
   If missing -> exit code 2 (BLOCKED) with instructions.
2. **Load keywords**: Reads `pets/library/brother-judge/pet.json` -> `watch.keywords`
   (categories: 画饼, 吹牛), `watch.fallback`, `watch.state`.
3. **Build rules**: `{ ids: [USER_OPEN_ID], cooldownSec: 0, quietHours: [], keywords,
   fallback, state: 'reaction' }`.
4. **Start watcher**: `createMessageWatcher({ rules, voice, sendState, spawnExec,
   larkCliPath, onStatus, rng })` — spawns real lark-cli-core event consumer.
5. **Verify connection**: Waits up to 10s for ready marker or `isRunning()`.
6. **TEST 1 (keyword)**: Send "老板又来画饼了，说要年底分红" as user. Wait 15s for
   `sendState`. Assert: `state==='reaction'`, message from 画饼 pool,
   `speechAudio.startsWith('voice-cache://')`.
7. **TEST 2 (non-keyword)**: Send "今天天气不错" as user. Wait 8s. Assert `sendState`
   NOT called again.
8. **Cleanup**: Stop watcher, kill spawned child.

### Exit Codes

- `0` = ALL PASS
- `1` = TEST FAIL (assertion failure)
- `2` = BLOCKED (missing user scope — run auth first)
- `3` = SETUP ERROR (modules/petpack not found)

### Timeouts

| Timeout | Value | Purpose |
|---------|-------|---------|
| T_CONSUMER_READY | 10s | Wait for event consumer to connect |
| T_SEND_STATE | 15s | Wait for sendState after keyword message |
| T_NO_TRIGGER | 8s | Confirm no trigger on non-keyword message |

### Shutdown

`cleanup()` calls `watcher.stop()` which kills the spawned lark-cli child process.
Also registered on `SIGINT`, `SIGTERM`, and `exit` events.

---

## `node scripts/test-boss-watch-e2e.js` Output

```
[e2e] Loaded keywords: [ '画饼', '吹牛' ]
[e2e] Fallback: 老板又在整活儿了，本官先记他一笔。
[e2e] State: reaction
[e2e] Checking user scopes...

========================================
BLOCKED: Missing user scope "im:message"
========================================

The event consumer (bot) works, but sending test messages
as user requires the "im:message" scope to be authorized.

To fix: run the following command and complete browser auth:
  lark-cli auth login --scope "im:message"

Then re-run: node scripts/test-boss-watch-e2e.js
EXIT_CODE=2
```

**Status**: BLOCKED on user-level scope authorization (not a feishu config gap —
the app has the scope configured, the user just hasn't authorized it).

---

## BLOCKED: Feishu User Auth Gap

### The Problem

The feishu app `cli_aaf3cfa69cb85cf8` has the `im:message` scope configured at the
app level (it's a valid scope name). However, the **user** has not authorized this
scope via `lark-cli auth login`. The current user token only has 21 scopes, all
calendar and task related — no IM scopes.

### What's Needed

1. **User-level scope authorization** (interactive, one-time):
   ```bash
   lark-cli auth login --scope "im:message"
   ```
   This opens a browser verification URL. The user must open it and approve.
   Scopes accumulate across logins (incremental authorization).

2. **Event subscription** (already enabled): The event `im.message.receive_v1`
   appears in `lark-cli event list`, the schema is available, and the consumer
   connects via websocket successfully. The `required_console_events` field lists
   `im.message.receive_v1`, which is already configured.

3. **Bot scope** (already configured): The bot can send messages and consume events
   automatically via app credentials.

### Exact Error

From `lark-cli im +messages-send --as user`:
```
lark-cli error: missing required scope(s): im:message.send_as_user, im:message
(hint: run `lark-cli auth login --scope "im:message.send_as_user im:message"`
in the background. It blocks and outputs a verification URL — retrieve the URL
and open it in a browser to complete login.)
```

Note: `im:message.send_as_user` and `im:message` are separate scopes. The combined
`--scope "im:message.send_as_user im:message"` was rejected as "invalid or malformed
scopes" when used together. Using `--scope "im:message"` alone or `--domain im`
worked (returned a valid verification URL).

### Fix Steps for User

1. Run: `lark-cli auth login --scope "im:message"` (or `--domain im`)
2. Open the verification URL in a browser
3. Approve the authorization
4. Re-run: `node scripts/test-boss-watch-e2e.js` (or `npm run test:e2e`)

---

## Architecture Note: Windows stdin Issue

The `createMessageWatcher` in `src/message-watcher.js` spawns lark-cli with
`shell: true` and the `.cmd` path. On Windows, this causes stdin to be detected as
closed (EOF) when spawned from non-interactive contexts (CI, scripts, AI agents).

The e2e test works around this by providing a custom `spawnExec` that:
- Replaces the `.cmd` path with the `lark-cli-core-windows-amd64.exe` binary
- Sets `shell: false` to avoid the cmd.exe intermediary
- Uses `stdio: ['pipe', 'pipe', 'pipe']` for proper stdin pipe handling

**This is a known issue that may affect the production Electron app** when spawned
from automated contexts. In the interactive Electron app, stdin behavior may differ
because the parent process has a console. This should be investigated separately.

---

## Commits

| SHA | Subject |
|-----|---------|
| `74118ac` | test: boss watch radar end-to-end verification |

---

## Summary

- **Status**: BLOCKED (user-level `im:message` scope not authorized)
- **Event stream**: Verified working (consumer connects, websocket established)
- **Script**: Written and committed — ready to run once user completes auth
- **Auth QR code**: Generated and presented to user at `outputs/lark-auth-qrcode.png`
- **Next step**: User runs `lark-cli auth login --scope "im:message"`, then `npm run test:e2e`
