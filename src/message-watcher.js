'use strict';
const { createDedupeSet, isBoss, matchKeyword, inQuietHours } = require('./watch-rules');
const { execFile } = require('child_process');

const DEBUG_LOG = 'C:/Users/Thinkpad/.qwenworkcn/workspace/msr5talezbqs189b/watcher-debug.log';
const DEBUG_ON = process.env.PET_WATCH_DEBUG === '1';
function dbg(msg) {
  if (!DEBUG_ON) return;
  try { require('fs').appendFileSync(DEBUG_LOG, new Date().toISOString() + ' ' + msg + '\n'); } catch (_) {}
}

function parseEventLine(line) {
  if (typeof line !== 'string' || !line.trim()) return null;
  let raw;
  try { raw = JSON.parse(line); } catch (_) { return null; }
  if (!raw || typeof raw !== 'object') return null;
  const { event_id, sender_id, content } = raw;
  if (typeof event_id !== 'string' || !event_id) return null;
  if (typeof sender_id !== 'string' || !sender_id) return null;
  if (typeof content !== 'string' || !content) return null;
  return {
    event_id, sender_id,
    chat_id: typeof raw.chat_id === 'string' ? raw.chat_id : '',
    chat_type: typeof raw.chat_type === 'string' ? raw.chat_type : '',
    content: unwrapMessageText(content),
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : ''
  };
}

function unwrapMessageText(content) {
  if (typeof content !== 'string' || !content) return '';
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.text === 'string' && parsed.text) return parsed.text;
      if (parsed && typeof parsed.content === 'string' && parsed.content) return parsed.content;
    } catch (_) { /* keep original */ }
  }
  return content;
}

function isAtAllMention(mention) {
  if (!mention || typeof mention !== 'object') return false;
  const key = String(mention.key || mention.mention_key || '');
  const id = String(mention.id || mention.user_id || '');
  const name = String(mention.name || '');
  return key === '@_all' || key === 'all'
    || id === '@_all' || id === 'all'
    || name === '所有人' || name === 'Everyone' || name === 'All';
}

function isAtAllMessage(msg, content) {
  const mentions = [];
  if (msg && Array.isArray(msg.mentions)) mentions.push(...msg.mentions);
  if (msg && Array.isArray(msg.mention_list)) mentions.push(...msg.mention_list);
  if (mentions.some(isAtAllMention)) return true;
  const text = typeof content === 'string' ? content : '';
  return /@_all\b|<at\b[^>]*user_id\s*=\s*["']all["'][^>]*>|@所有人/.test(text);
}

function extractPolledMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;
  let senderId = '';
  if (msg.sender && typeof msg.sender === 'object') {
    senderId = typeof msg.sender.id === 'string' ? msg.sender.id : '';
  }
  if (!senderId && typeof msg.sender_id === 'string') senderId = msg.sender_id;
  const rawContent = (typeof msg.text === 'string' && msg.text)
    || (typeof msg.content === 'string' && msg.content)
    || (msg.body && typeof msg.body === 'object' && typeof msg.body.content === 'string' && msg.body.content)
    || '';
  const content = unwrapMessageText(rawContent);
  const messageId = (typeof msg.message_id === 'string' && msg.message_id)
    || (typeof msg.id === 'string' && msg.id)
    || '';
  if (!senderId || !content || !messageId) return null;
  return { senderId, content, messageId };
}

function resolveCoreExe(larkCliPath) {
  if (process.platform === 'win32' && larkCliPath && larkCliPath.endsWith('.cmd')) {
    try {
      const fs = require('fs');
      const path = require('path');
      const coreExe = path.join(path.dirname(larkCliPath), 'ext', 'lark-cli-core-windows-amd64.exe');
      if (fs.existsSync(coreExe)) return coreExe;
    } catch (_) {}
  }
  return larkCliPath;
}

const WINDOW_ROLE_STATES = new Set(['climb', 'perch', 'hang', 'drag', 'fall', 'impact', 'recover']);

function resolveNow(now) {
  if (typeof now === 'function') return Number(now());
  if (typeof now === 'number' && Number.isFinite(now)) return now;
  return Date.now();
}

function resolveKeywordState(rules, category) {
  const fallback = (typeof rules.state === 'string' && rules.state.trim())
    ? rules.state.trim()
    : 'reaction';
  const mapped = category && rules.keywordStates && rules.keywordStates[category];
  if (typeof mapped !== 'string' || !mapped.trim()) return fallback;
  const state = mapped.trim();
  if (WINDOW_ROLE_STATES.has(state)) return fallback;
  return state;
}

function messageCooldownKey(event) {
  return String(event.senderId || event.senderName || event.eventId || '');
}

async function dispatchBossMessage(event, ctx) {
  const { rules, voice, sendState, rng, cooldownMap } = ctx || {};
  if (!event || !rules || typeof sendState !== 'function') return;
  const map = cooldownMap || new Map();
  const key = messageCooldownKey(event);
  const now = resolveNow(ctx.now);
  const last = map.get(key) || 0;
  if (now - last < (rules.cooldownSec || 0) * 1000) { dbg('processLine: cooldown'); return; }
  map.set(key, now);
  const category = matchKeyword(event.text, rules.keywords, rules.triggers);
  dbg('processLine: TRIGGER category=' + category + ' content=' + (event.text || '').slice(0, 40));
  const pool = category ? rules.keywords[category] : [rules.fallback];
  const entry = pool[Math.floor((rng || Math.random)() * pool.length)];
  const text = entry.text || (typeof entry === 'string' ? entry : '');
  const preAudio = entry.audio || '';
  let audioUrl = '';
  if (preAudio) {
    audioUrl = preAudio;
  } else {
    try {
      const audio = await voice.synthesize(text);
      if (audio) audioUrl = audio.url;
    } catch (_) { audioUrl = ''; }
  }
  const state = resolveKeywordState(rules, category);
  dbg('processLine: sendState state=' + state + ' text=' + (text || '').slice(0, 30) + ' audio=' + (audioUrl ? 'yes' : 'no'));
  sendState(state, text, text, { speechAudio: audioUrl });
}

function createMessageWatcher({ rules, voice, sendState, spawnExec, onStatus, larkCliPath, rng }) {
  const dedupe = createDedupeSet();
  const cooldown = new Map();
  let child = null;
  let running = false;
  let stopRequested = false;
  let restartCount = 0;
  let restartWindowStart = 0;
  let restartTimer = null;
  let pollTimer = null;
  let groupChatIds = [];
  let lastPollTime = Date.now();
  const coreExe = resolveCoreExe(larkCliPath);

  async function processLine(line) {
    const ev = parseEventLine(line);
    if (!ev) { dbg('processLine: parse null'); return; }
    if (dedupe.has(ev.event_id)) { dbg('processLine: dedupe skip ' + ev.event_id); return; }
    dedupe.add(ev.event_id);
    if (!isBoss(ev.sender_id, rules.ids)) { dbg('processLine: not boss sender=' + ev.sender_id + ' ids=' + JSON.stringify(rules.ids)); return; }
    if (inQuietHours(new Date(), rules.quietHours)) { dbg('processLine: quiet hours'); return; }
    const chatType = (ev.chat_type === 'p2p' || ev.chat_type === 'group') ? ev.chat_type : 'unknown';
    dbg('processLine: dispatch content=' + (ev.content || '').slice(0, 40));
    await dispatchBossMessage({
      platform: 'lark',
      kind: 'message',
      eventId: ev.event_id,
      senderId: ev.sender_id,
      senderName: '',
      text: ev.content,
      chatType
    }, { rules, voice, sendState, rng, now: Date.now, cooldownMap: cooldown });
  }

  function scheduleRestart() {
    if (stopRequested) return;
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    if (restartWindowStart === 0 || Date.now() - restartWindowStart >= 3600000) {
      restartCount = 0;
      restartWindowStart = Date.now();
    }
    if (restartCount >= 10) {
      running = false;
      onStatus && onStatus({ level: 'error', message: '画饼雷达事件流多次断开，已暂停。' });
      return;
    }
    const delay = Math.min(2000 * Math.pow(2, restartCount), 60000);
    restartCount += 1;
    restartTimer = setTimeout(start, delay);
  }

  function runCli(args) {
    return new Promise((resolve) => {
      execFile(coreExe, args, { timeout: 15000, windowsHide: true, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) { resolve(null); return; }
        try { resolve(JSON.parse(stdout)); } catch (_) { resolve(null); }
      });
    });
  }

  async function discoverGroupChats() {
    const seen = new Set();
    const ids = [];
    for (const identity of ['user', 'bot']) {
      const result = await runCli(['im', '+chat-list', '--as', identity, '--types', 'group']);
      if (!result || !result.ok || !result.data || !Array.isArray(result.data.chats)) continue;
      for (const chat of result.data.chats) {
        if (!chat || !chat.chat_id || seen.has(chat.chat_id)) continue;
        seen.add(chat.chat_id);
        ids.push(chat.chat_id);
      }
    }
    groupChatIds = ids;
    dbg('discoverGroupChats: found ' + groupChatIds.length + ' groups: ' + groupChatIds.join(','));
    if (groupChatIds.length) {
      onStatus && onStatus({ level: 'info', message: `画饼雷达监控 ${groupChatIds.length} 个群的@所有人消息。` });
    }
  }

  async function pollGroupMessages() {
    if (stopRequested) return;
    const now = Date.now();
    const startTime = new Date(lastPollTime - 5000).toISOString();
    lastPollTime = now;

    for (const chatId of groupChatIds) {
      const result = await runCli([
        'im', '+chat-messages-list', '--as', 'user',
        '--chat-id', chatId,
        '--start', startTime,
        '--sort', 'asc',
        '--page-size', '50'
      ]);
      if (!result || !result.ok || !result.data) { dbg('poll: no result for ' + chatId); continue; }
      const msgs = result.data.items || result.data.messages;
      if (!Array.isArray(msgs)) { dbg('poll: msgs not array'); continue; }
      dbg('poll: ' + chatId + ' got ' + msgs.length + ' msgs');

      for (const msg of msgs) {
        const extracted = extractPolledMessage(msg);
        if (!extracted) { dbg('poll: extract null'); continue; }
        const atAll = isAtAllMessage(msg, extracted.content);
        if (!atAll) { dbg('poll: not @all: ' + (extracted.content || '').slice(0, 30)); continue; }
        if (dedupe.has(extracted.messageId)) { dbg('poll: dedupe ' + extracted.messageId); continue; }
        dbg('poll: @all msg from ' + extracted.senderId + ': ' + (extracted.content || '').slice(0, 30));

        const fakeEv = {
          event_id: extracted.messageId,
          sender_id: extracted.senderId,
          content: extracted.content,
          chat_id: chatId,
          chat_type: 'group',
          timestamp: String((msg && msg.create_time) || now)
        };
        await processLine(JSON.stringify(fakeEv));
      }
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    lastPollTime = Date.now();
    discoverGroupChats().then(() => {
      if (stopRequested) return;
      pollTimer = setInterval(() => {
        pollGroupMessages().catch((err) => {
          onStatus && onStatus({ level: 'error', message: '画饼雷达群消息轮询异常：' + (err?.message || 'unknown') });
        });
      }, 3000);
    });
  }

  function start() {
    dbg('start() called larkCliPath=' + larkCliPath + ' coreExe=' + coreExe);
    if (stopRequested) return;
    if (running) return;
    if (!larkCliPath) { dbg('start: no larkCliPath'); onStatus && onStatus({ level: 'warn', message: '未配置 lark-cli 路径，画饼雷达未启动。' }); return; }
    running = true;
    stopRequested = false;
    dbg('start: spawning event consume + polling');
    const spawn = spawnExec || require('child_process').spawn;
    let stderrBuf = '';
    try {
      child = spawn(coreExe, ['event', 'consume', 'im.message.receive_v1', '--as', 'bot'],
        { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      running = false;
      onStatus && onStatus({ level: 'error', message: '启动画饼雷达失败：' + (e.message || 'unknown') });
      if (!pollTimer) startPolling();
      return;
    }
    child.stdout && child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) processLine(line).catch((err) => { onStatus && onStatus({ level: 'error', message: '画饼雷达处理异常：' + (err?.message || 'unknown') }); });
      }
    });
    child.stderr && child.stderr.on('data', (chunk) => {
      stderrBuf = (stderrBuf + chunk.toString()).slice(-500);
      onStatus && onStatus({ level: 'info', message: '画饼雷达: ' + stderrBuf.split('\n').pop().trim() });
    });
    child.on('error', (err) => {
      onStatus && onStatus({ level: 'error', message: '画饼雷达进程错误：' + (err.message || 'unknown') });
      scheduleRestart();
    });
    child.on('exit', () => {
      child = null;
      running = false;
      if (!stopRequested) scheduleRestart();
    });
    // Keep group polling even if the event stream later disconnects.
    if (!pollTimer) startPolling();
    onStatus && onStatus({ level: 'info', message: '画饼雷达已连接。' });
  }

  function stop() {
    stopRequested = true;
    running = false;
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (child) { try { child.stdin && child.stdin.end(); child.kill(); } catch (_) {} child = null; }
  }

  return { start, stop, processLine, isRunning: () => running };
}

module.exports = {
  parseEventLine, createMessageWatcher, isAtAllMessage, extractPolledMessage,
  dispatchBossMessage
};
