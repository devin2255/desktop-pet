'use strict';

/**
 * End-to-end test: boss-watch radar pipeline against real lark-cli event stream.
 *
 * Flow:
 *   0. Pre-check: verify user has im:message scope (needed to send as user).
 *   1. Load createMessageWatcher + brother-judge pet.json watch keywords.
 *   2. Build rules with the current user's open_id as the "boss".
 *   3. Start the watcher (real spawn of lark-cli-core event consume).
 *   4. Verify the event consumer connected (websocket + ready marker).
 *   5. Send a test message containing "画饼" to self via lark-cli im (--as user).
 *   6. Assert sendState fires with state='reaction', message from 画饼 pool,
 *      speechAudio starts with voice-cache://.
 *   7. Send a non-keyword message; assert sendState is NOT called again.
 *   8. Stop the watcher. Exit 0 on success, 2 on BLOCKED, 1 on FAIL.
 *
 * Voice: FAKE (no edge-tts network calls). speechAudio = voice-cache://fake-e2e.mp3.
 * LarkCli: uses lark-cli-core binary directly (bypasses .cmd/shell stdin issues on Windows).
 *
 * Exit codes:
 *   0 = ALL PASS
 *   1 = TEST FAIL (assertion failure)
 *   2 = BLOCKED (missing user scope — run auth first, then re-run)
 *   3 = SETUP ERROR (modules/petpack not found)
 *
 * Prerequisites:
 *   - lark-cli at C:/Users/Thinkpad/.qwenworkcn/bin/
 *   - Bot auth (automatic via app credentials for event consume)
 *   - User auth with scope im:message (to send test messages as user):
 *       lark-cli auth login --scope "im:message"
 *   - Event subscription im.message.receive_v1 enabled in feishu dev console
 *   - pets/library/brother-judge/pet.json with watch.keywords
 */

const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const LARK_CMD = 'C:/Users/Thinkpad/.qwenworkcn/bin/lark-cli.cmd';
const LARK_CORE = 'C:/Users/Thinkpad/.qwenworkcn/bin/ext/lark-cli-core-windows-amd64.exe';
const USER_OPEN_ID = 'ou_221a684c00848f0cd7f3e29d1061d908';

// Timeouts (ms)
const T_CONSUMER_READY = 10000;  // wait for event consumer to connect
const T_SEND_STATE = 15000;     // wait for sendState after sending keyword message
const T_NO_TRIGGER = 8000;      // wait to confirm no trigger on non-keyword message

let watcher = null;

function cleanup() {
  try { watcher && watcher.stop(); } catch (_) {}
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Custom spawn for createMessageWatcher.
 * Uses lark-cli-core binary directly (no shell) to avoid Windows cmd.exe stdin issues.
 * The .cmd wrapper + shell:true causes stdin EOF on Windows in non-interactive contexts.
 */
function customSpawn(cmd, args, opts) {
  const exePath = cmd.includes('lark-cli.cmd') ? LARK_CORE : cmd;
  return spawn(exePath, args, {
    ...opts,
    shell: false,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

/**
 * Check if the current user has a specific scope.
 */
function hasScope(scopeName) {
  try {
    const out = execFileSync(LARK_CMD, ['auth', 'scopes'], {
      encoding: 'utf8', timeout: 10000, windowsHide: true
    });
    const j = JSON.parse(out);
    return j.userScopes && j.userScopes.some(s => s === scopeName || s.startsWith(scopeName));
  } catch (_) {
    return false;
  }
}

/**
 * Send a message to self (user open_id) via lark-cli im as user.
 * Returns { ok, data, error }.
 */
function sendMessageAsUser(text) {
  try {
    const out = execFileSync(LARK_CMD, [
      'im', '+messages-send',
      '--as', 'user',
      '--user-id', USER_OPEN_ID,
      '--text', text
    ], { encoding: 'utf8', timeout: 15000, windowsHide: true });
    return { ok: true, data: JSON.parse(out), error: null };
  } catch (e) {
    const stderr = e.stderr || e.message || String(e);
    return { ok: false, data: null, error: stderr };
  }
}

async function main() {
  // --- Load modules ---
  const { createMessageWatcher } = require('../src/message-watcher');

  // --- Load pet.json keywords ---
  const petJsonPath = path.join(ROOT, 'pets/library/brother-judge/pet.json');
  if (!fs.existsSync(petJsonPath)) {
    console.error('BLOCKED: brother-judge/pet.json not found at', petJsonPath);
    process.exit(3);
  }
  const petJson = JSON.parse(fs.readFileSync(petJsonPath, 'utf8'));
  const watch = petJson.watch;
  if (!watch || !watch.keywords) {
    console.error('BLOCKED: brother-judge/pet.json missing watch.keywords');
    process.exit(3);
  }
  console.log('[e2e] Loaded keywords:', Object.keys(watch.keywords));
  console.log('[e2e] Fallback:', watch.fallback);
  console.log('[e2e] State:', watch.state);

  // --- Pre-check: user scope ---
  console.log('[e2e] Checking user scopes...');
  const hasImMessage = hasScope('im:message');
  if (!hasImMessage) {
    console.error('');
    console.error('========================================');
    console.error('BLOCKED: Missing user scope "im:message"');
    console.error('========================================');
    console.error('');
    console.error('The event consumer (bot) works, but sending test messages');
    console.error('as user requires the "im:message" scope to be authorized.');
    console.error('');
    console.error('To fix: run the following command and complete browser auth:');
    console.error('  lark-cli auth login --scope "im:message"');
    console.error('');
    console.error('Then re-run: node scripts/test-boss-watch-e2e.js');
    process.exit(2);
  }
  console.log('[e2e] User has im:message scope. Proceeding.');

  // --- Build rules ---
  const rules = {
    ids: [USER_OPEN_ID],
    cooldownSec: 0,
    quietHours: [],
    keywords: watch.keywords,
    fallback: watch.fallback,
    state: watch.state || 'reaction'
  };

  // --- Fake sendState ---
  const stateCalls = [];
  const fakeSendState = (state, message, speech, opts) => {
    stateCalls.push({ state, message, speech, speechAudio: opts && opts.speechAudio });
    console.log(`[e2e] sendState called: state=${state} message="${message}" speechAudio="${(opts && opts.speechAudio) || ''}"`);
    return Promise.resolve();
  };

  // --- Fake voice (no edge-tts network) ---
  const fakeVoice = {
    synthesize: async () => ({ url: 'voice-cache://fake-e2e-test.mp3' }),
    dispose: () => {}
  };

  // --- Track event consumer readiness ---
  let consumerReady = false;

  // --- Create watcher ---
  watcher = createMessageWatcher({
    rules,
    voice: fakeVoice,
    sendState: fakeSendState,
    spawnExec: customSpawn,
    larkCliPath: LARK_CMD, // customSpawn replaces with LARK_CORE
    onStatus: (status) => {
      console.log(`[e2e][status] [${status.level}] ${status.message}`);
      if (status.message && (status.message.includes('ready') || status.message.includes('connected'))) {
        consumerReady = true;
      }
    },
    rng: () => 0 // deterministic: always picks first entry from pool
  });

  // --- Start watcher ---
  console.log('[e2e] Starting event consumer...');
  watcher.start();

  // Wait for the event consumer to connect
  console.log('[e2e] Waiting for event consumer to connect (up to 10s)...');
  const readyStart = Date.now();
  while (Date.now() - readyStart < T_CONSUMER_READY) {
    if (consumerReady) break;
    await sleep(300);
  }

  if (!watcher.isRunning()) {
    console.error('FAIL: Event consumer not running after 10s');
    cleanup();
    process.exit(1);
  }
  console.log('[e2e] Event consumer is running.' + (consumerReady ? ' (ready marker seen)' : ' (no ready marker, but running)'));

  // --- TEST 1: Send keyword message "画饼" ---
  console.log('\n[e2e] === TEST 1: Send keyword message containing "画饼" ===');
  const keywordMsg = '老板又来画饼了，说要年底分红';
  console.log(`[e2e] Sending: "${keywordMsg}"`);
  const sendResult1 = sendMessageAsUser(keywordMsg);
  if (!sendResult1.ok) {
    console.error('FAIL: Could not send keyword message as user');
    console.error('[e2e] Error:', sendResult1.error);
    cleanup();
    process.exit(1);
  }
  console.log('[e2e] Message sent:', sendResult1.data.data.message_id);

  // Wait for sendState to fire
  console.log('[e2e] Waiting for sendState to fire (up to 15s)...');
  const waitStart = Date.now();
  while (Date.now() - waitStart < T_SEND_STATE) {
    if (stateCalls.length > 0) break;
    await sleep(200);
  }

  // Assertions for TEST 1
  let test1Pass = true;
  if (stateCalls.length === 0) {
    console.error('FAIL: sendState was NOT called after keyword message');
    test1Pass = false;
  } else {
    const call = stateCalls[0];
    // Assert state
    if (call.state !== 'reaction') {
      console.error(`FAIL: state expected "reaction", got "${call.state}"`);
      test1Pass = false;
    } else {
      console.log('PASS: state === "reaction"');
    }
    // Assert message is a non-empty string
    if (typeof call.message !== 'string' || !call.message) {
      console.error('FAIL: message is not a non-empty string');
      test1Pass = false;
    } else {
      console.log(`PASS: message is string: "${call.message}"`);
    }
    // Assert message is from the 画饼 pool
    const pool = watch.keywords['画饼'];
    if (pool && pool.includes(call.message)) {
      console.log('PASS: message is from 画饼 keyword pool');
    } else {
      console.error(`FAIL: message "${call.message}" not in 画饼 pool: ${JSON.stringify(pool)}`);
      test1Pass = false;
    }
    // Assert speechAudio starts with voice-cache://
    if (call.speechAudio && call.speechAudio.startsWith('voice-cache://')) {
      console.log(`PASS: speechAudio = "${call.speechAudio}"`);
    } else {
      console.error(`FAIL: speechAudio expected voice-cache://..., got "${call.speechAudio}"`);
      test1Pass = false;
    }
  }

  // --- TEST 2: Send non-keyword message ---
  console.log('\n[e2e] === TEST 2: Send non-keyword message ===');
  const callsBefore = stateCalls.length;
  const nonKeywordMsg = '今天天气不错';
  console.log(`[e2e] Sending: "${nonKeywordMsg}"`);
  const sendResult2 = sendMessageAsUser(nonKeywordMsg);
  if (!sendResult2.ok) {
    console.error('[e2e] Failed to send non-keyword message:', sendResult2.error);
  } else {
    console.log('[e2e] Non-keyword message sent:', sendResult2.data.data.message_id);
  }

  // Wait to confirm sendState is NOT called again
  console.log('[e2e] Waiting 8s to confirm no additional sendState...');
  const waitStart2 = Date.now();
  while (Date.now() - waitStart2 < T_NO_TRIGGER) {
    if (stateCalls.length > callsBefore) break;
    await sleep(200);
  }

  let test2Pass = true;
  if (stateCalls.length > callsBefore) {
    console.error(`FAIL: sendState was called ${stateCalls.length - callsBefore} extra time(s) for non-keyword message`);
    test2Pass = false;
  } else {
    console.log('PASS: sendState NOT called for non-keyword message');
  }

  // --- Results ---
  console.log('\n========== RESULTS ==========');
  console.log(`Test 1 (keyword "画饼" triggers reaction):  ${test1Pass ? 'PASS' : 'FAIL'}`);
  console.log(`Test 2 (non-keyword does not trigger):      ${test2Pass ? 'PASS' : 'FAIL'}`);
  console.log(`Total sendState calls: ${stateCalls.length}`);

  cleanup();
  const exitCode = (test1Pass && test2Pass) ? 0 : 1;
  console.log(`\n${exitCode === 0 ? 'ALL TESTS PASSED' : 'TESTS FAILED'}`);
  process.exit(exitCode);
}

process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });
process.on('exit', () => { cleanup(); });

main().catch((err) => {
  console.error('E2E test crashed:', err);
  cleanup();
  process.exit(1);
});
