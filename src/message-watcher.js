'use strict';
const { createDedupeSet, isBoss, matchKeyword, inQuietHours, pickLine } = require('./watch-rules');

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

function createMessageWatcher({ rules, voice, sendState, spawnExec, onStatus, larkCliPath, rng }) {
  const dedupe = createDedupeSet();
  const cooldown = new Map();
  let child = null;
  let running = false;
  let stopRequested = false;
  let restartCount = 0;
  let restartWindowStart = 0;
  let restartTimer = null;

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

  function start() {
    if (stopRequested) return;
    if (running) return;
    if (!larkCliPath) { onStatus && onStatus({ level: 'warn', message: '未配置 lark-cli 路径，画饼雷达未启动。' }); return; }
    running = true;
    stopRequested = false;
    const spawn = spawnExec || require('child_process').spawn;
    let stderrBuf = '';
    try {
      child = spawn(larkCliPath, ['event', 'consume', 'im.message.receive_v1'], { shell: true, windowsHide: true });
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
    onStatus && onStatus({ level: 'info', message: '画饼雷达已连接。' });
  }

  function stop() {
    stopRequested = true;
    running = false;
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    if (child) { try { child.kill(); } catch (_) {} child = null; }
  }

  return { start, stop, processLine, isRunning: () => running };
}

module.exports = { parseEventLine, createMessageWatcher };
