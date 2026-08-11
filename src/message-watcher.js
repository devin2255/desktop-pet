'use strict';
const { createDedupeSet, isBoss, matchKeyword, inQuietHours, pickLine } = require('./watch-rules');
const { execFile } = require('child_process');

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
    content,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : ''
  };
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
    if (!ev) return;
    if (dedupe.has(ev.event_id)) return;
    dedupe.add(ev.event_id);
    if (!isBoss(ev.sender_id, rules.ids)) return;
    if (inQuietHours(new Date(), rules.quietHours)) return;
    const last = cooldown.get(ev.sender_id) || 0;
    if (Date.now() - last < rules.cooldownSec * 1000) return;
    const category = matchKeyword(ev.content, rules.keywords);
    const pool = category ? rules.keywords[category] : [rules.fallback];
    const text = pickLine(pool, rng);
    let audioUrl = '';
    try {
      const audio = await voice.synthesize(text);
      if (audio) audioUrl = audio.url;
    } catch (_) { audioUrl = ''; }
    sendState(rules.state, text, text, { speechAudio: audioUrl });
    cooldown.set(ev.sender_id, Date.now());
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
    const result = await runCli(['im', '+chat-list', '--as', 'bot', '--types', 'group']);
    if (!result || !result.ok || !result.data || !Array.isArray(result.data.chats)) return;
    groupChatIds = result.data.chats.map((c) => c.chat_id).filter(Boolean);
    if (groupChatIds.length) {
      onStatus && onStatus({ level: 'info', message: `画饼雷达监控 ${groupChatIds.length} 个群的@所有人消息。` });
    }
  }

  async function pollGroupMessages() {
    if (stopRequested || !running) return;
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
      if (!result || !result.ok || !result.data || !Array.isArray(result.data.items)) continue;

      for (const msg of result.data.items) {
        // Only process @all messages
        const mentions = msg.mentions || msg.mention_list || [];
        const isAtAll = mentions.some((m) => m && (m.key === '@_all' || m.id === '@_all' || m.name === '所有人'));
        if (!isAtAll) continue;

        const senderId = msg.sender && msg.sender.id ? msg.sender.id : (msg.sender_id || '');
        const content = typeof msg.body && msg.body.content === 'string'
          ? msg.body.content
          : (typeof msg.text === 'string' ? msg.text : '');
        const messageId = msg.message_id || msg.id || '';

        if (!senderId || !content || !messageId) continue;
        if (dedupe.has(messageId)) continue;
        dedupe.add(messageId);

        // Process like an event line
        const fakeEv = { event_id: messageId, sender_id: senderId, content, chat_id: chatId, chat_type: 'group', timestamp: String(msg.create_time || now) };
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
      }, 10000);
    });
  }

  function start() {
    if (stopRequested) return;
    if (running) return;
    if (!larkCliPath) { onStatus && onStatus({ level: 'warn', message: '未配置 lark-cli 路径，画饼雷达未启动。' }); return; }
    running = true;
    stopRequested = false;
    const spawn = spawnExec || require('child_process').spawn;
    let stderrBuf = '';
    try {
      child = spawn(coreExe, ['event', 'consume', 'im.message.receive_v1', '--as', 'bot'],
        { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      running = false;
      onStatus && onStatus({ level: 'error', message: '启动画饼雷达失败：' + (e.message || 'unknown') });
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
    // Start group message polling for @all messages
    startPolling();
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

module.exports = { parseEventLine, createMessageWatcher };
