'use strict';

const { matchBoss } = require('./im-match');
const { createDedupeSet } = require('./watch-rules');
const { insetRect, anchorsOverlap } = require('./approach-target');

async function defaultLocateIncomingCall() {
  return null;
}

async function defaultInvokeReject() {
  return false;
}

function eventIdFromLocated(located) {
  return `${located.title || ''}\n${located.displayName || ''}`;
}

function shouldInvokeReject({ petBounds, hangupAnchor, rejectBounds }) {
  if (!petBounds || !hangupAnchor || !rejectBounds) return false;
  // Full button rect: the 40px physical button is ~27 DIP; a 0.25 inset leaves a
  // 14x14 hit box that screen-edge clamping can miss even with the foot on the button.
  return anchorsOverlap(petBounds, hangupAnchor, rejectBounds);
}

function resolveHangupAction({ located, petBounds, hangup, stage }) {
  if (!located?.rejectBounds) {
    return { invoke: false, state: 'idle', message: '这次没挂上', logicalRole: 'idle' };
  }
  const action = stage?.action || 'idle';
  if (!petBounds || !hangup?.anchor) {
    return { invoke: false, state: action, message: '这次没挂上', logicalRole: action };
  }
  if (!shouldInvokeReject({
    petBounds,
    hangupAnchor: hangup.anchor,
    rejectBounds: located.rejectBounds
  })) {
    return { invoke: false, state: action, message: '这次没挂上', logicalRole: action };
  }
  return { invoke: true, rejectBounds: located.rejectBounds };
}

// ---------------------------------------------------------------------------
// Message radar: poll `dws chat message list` for boss single chats and group
// @所有人 messages. Mirrors the lark polling path (message-watcher) semantics:
// p2p boss messages always trigger; group messages only trigger on @所有人.
// ---------------------------------------------------------------------------

const DEFAULT_DWS_PATH = 'C:/Users/Thinkpad/.qwenworkcn/bin/dws.cmd';
const AT_ALL_RE = /@所有人|@_all|<@all>|@all\b/i;
// System/media placeholders (call records, images, files...) are not real text;
// they would otherwise spam the fallback bubble on every boss voice call.
const SYSTEM_CONTENT_RE = /^\[(语音通话|图片|文件|视频|语音|链接|名片|红包|位置|合并转发|动画表情|截图)/;

function isSystemContent(content) {
  return typeof content === 'string' && SYSTEM_CONTENT_RE.test(content.trim());
}

function parseDwsJson(stdout) {
  if (typeof stdout !== 'string' || !stdout) return null;
  // dws may print warning lines before JSON; skip to the first '{'.
  const idx = stdout.indexOf('{');
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(stdout.slice(idx));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function formatDwsTime(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function extractDingtalkMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const content = typeof msg.content === 'string' ? msg.content : '';
  const senderId = typeof msg.senderOpenDingTalkId === 'string' ? msg.senderOpenDingTalkId : '';
  const senderName = typeof msg.sender === 'string' ? msg.sender : '';
  const messageId = typeof msg.openMessageId === 'string' ? msg.openMessageId : '';
  if (!messageId || !content) return null;
  return { content, senderId, senderName, messageId };
}

// dws.cmd is a host-managed shim that only works inside the QwenWork agent
// environment; the standalone CLI core lives in ext/ next to it. Resolve the
// core exe like the lark path does (message-watcher resolveCoreExe).
function resolveDwsCore(dwsPath) {
  if (process.platform !== 'win32') return null;
  try {
    const fs = require('fs');
    const path = require('path');
    const base = String(dwsPath || DEFAULT_DWS_PATH);
    const core = path.join(path.dirname(base), 'ext', 'dws-core-windows-amd64.exe');
    if (fs.existsSync(core)) return core;
  } catch (_) { /* fall back to shim */ }
  return null;
}

function createDefaultRunDws(dwsPath) {
  const { spawn } = require('child_process');
  const core = resolveDwsCore(dwsPath);
  if (core) {
    return (args) => new Promise((resolve) => {
      let child;
      try {
        child = spawn(core, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (_) {
        resolve(null);
        return;
      }
      let out = '';
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        try { child.kill(); } catch (_) { /* already gone */ }
        finish(null);
      }, 30000);
      child.stdout?.on('data', (chunk) => { out += chunk.toString(); });
      child.on('error', () => finish(out || null));
      child.on('close', () => finish(out || null));
    });
  }
  // Fallback: spawn the .cmd shim through cmd.exe (Node refuses to spawn .cmd
  // directly since CVE-2024-27980 hardening).
  const exe = String(dwsPath || DEFAULT_DWS_PATH).replace(/\//g, '\\');
  return (args) => new Promise((resolve) => {
    let child;
    try {
      const comspec = process.env.comspec || 'cmd.exe';
      child = spawn(comspec, ['/c', exe, ...args], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (_) {
      resolve(null);
      return;
    }
    let out = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch (_) { /* already gone */ }
      finish(null);
    }, 30000);
    child.stdout?.on('data', (chunk) => { out += chunk.toString(); });
    child.on('error', () => finish(out || null));
    child.on('close', () => finish(out || null));
  });
}

function createDingtalkAdapter({
  locateIncomingCall,
  invokeReject,
  pollMs = 1000,
  getMessagesConfig,
  runDws,
  onStatus
} = {}) {
  const locate = typeof locateIncomingCall === 'function'
    ? locateIncomingCall
    : defaultLocateIncomingCall;
  const invoke = typeof invokeReject === 'function' ? invokeReject : defaultInvokeReject;
  const intervalMs = Number(pollMs) > 0 ? Number(pollMs) : 1000;

  let timer = null;
  let lastEventId = null;
  let lastLocated = null;
  let rulesRef = null;
  let onVoiceCall = null;
  let polling = false;
  let scanning = false;

  // --- message radar state ---
  let msgTimer = null;
  let msgPolling = false;
  let msgDedupe = null;
  let lastMsgPollTime = 0;
  let msgOnMessage = null;
  let msgBossOpenIds = [];
  let msgGroups = [];
  let msgPollMs = 10000;
  let execDws = null;

  async function tick() {
    if (scanning) return;
    scanning = true;
    try {
      await tickInner();
    } finally {
      scanning = false;
    }
  }

  async function tickInner() {
    let located;
    try {
      located = await locate();
    } catch (_) {
      return;
    }
    if (!located) {
      lastEventId = null;
      lastLocated = null;
      return;
    }
    lastLocated = located;
    if (!rulesRef?.callHangup || rulesRef.callHangup.enabled !== true) return;
    const eventId = eventIdFromLocated(located);
    if (eventId === lastEventId) return;
    const event = {
      platform: 'dingtalk',
      kind: 'voice-call',
      eventId,
      senderId: '',
      senderName: located.displayName || '',
      text: located.title || '',
      chatType: 'unknown'
    };
    if (!matchBoss(event, rulesRef)) return;
    lastEventId = eventId;
    if (typeof onVoiceCall === 'function') onVoiceCall(event);
  }

  async function pollMessagesOnce() {
    const sinceMs = lastMsgPollTime - 5000;
    lastMsgPollTime = Date.now();
    const timeStr = formatDwsTime(sinceMs);
    const targets = [];
    for (const groupId of msgGroups) targets.push({ flag: '--group', id: groupId, chatType: 'group' });
    for (const openId of msgBossOpenIds) targets.push({ flag: '--open-dingtalk-id', id: openId, chatType: 'p2p' });
    for (const target of targets) {
      const stdout = await execDws([
        'chat', 'message', 'list',
        target.flag, target.id,
        '--time', timeStr,
        '--direction', 'newer',
        '--limit', '50',
        '--format', 'json'
      ]);
      const parsed = parseDwsJson(stdout);
      const messages = parsed?.result?.messages;
      if (!Array.isArray(messages)) continue;
      for (const msg of messages) {
        const extracted = extractDingtalkMessage(msg);
        if (!extracted) continue;
        if (msgDedupe.has(extracted.messageId)) continue;
        msgDedupe.add(extracted.messageId);
        if (isSystemContent(extracted.content)) continue;
        if (!extracted.senderId || !msgBossOpenIds.includes(extracted.senderId)) continue;
        if (target.chatType === 'group' && !AT_ALL_RE.test(extracted.content)) continue;
        if (typeof msgOnMessage === 'function') {
          msgOnMessage({
            platform: 'dingtalk',
            kind: 'message',
            eventId: extracted.messageId,
            senderId: extracted.senderId,
            senderName: extracted.senderName,
            text: extracted.content,
            chatType: target.chatType
          });
        }
      }
    }
  }

  async function messageTick() {
    if (msgPolling) return;
    msgPolling = true;
    try {
      await pollMessagesOnce();
    } catch (err) {
      onStatus && onStatus({
        level: 'error',
        message: '钉钉画饼雷达轮询异常：' + (err?.message || 'unknown')
      });
    } finally {
      msgPolling = false;
    }
  }

  function startMessages(onMessage) {
    stopMessages();
    const cfg = typeof getMessagesConfig === 'function' ? getMessagesConfig() : null;
    if (!cfg || cfg.enabled === false) return;
    msgBossOpenIds = Array.isArray(cfg.bossOpenIds) ? cfg.bossOpenIds.filter(Boolean) : [];
    msgGroups = Array.isArray(cfg.groups) ? cfg.groups.filter(Boolean) : [];
    if (!msgBossOpenIds.length && !msgGroups.length) return;
    execDws = typeof runDws === 'function' ? runDws : createDefaultRunDws(cfg.dwsPath);
    msgPollMs = Number(cfg.pollMs) >= 200 ? Number(cfg.pollMs) : 10000;
    msgOnMessage = typeof onMessage === 'function' ? onMessage : null;
    msgDedupe = createDedupeSet();
    lastMsgPollTime = Date.now();
    msgTimer = setInterval(() => { void messageTick(); }, msgPollMs);
    onStatus && onStatus({
      level: 'info',
      message: `钉钉画饼雷达监控 ${msgBossOpenIds.length} 个老板单聊、${msgGroups.length} 个群。`
    });
  }

  function stopMessages() {
    if (msgTimer) {
      clearInterval(msgTimer);
      msgTimer = null;
    }
    msgOnMessage = null;
  }

  async function start({ rules, onVoiceCall: cb, onMessage } = {}) {
    stop();
    rulesRef = rules || null;
    // The message radar runs independently of the voice-call hangup switch.
    if (rules?.enabled !== false && typeof onMessage === 'function') {
      startMessages(onMessage);
    }
    if (!rules?.callHangup || rules.callHangup.enabled !== true) return;
    onVoiceCall = cb;
    polling = true;
    try {
      await tick();
    } catch (_) { /* start must not throw */ }
    if (!polling) return;
    timer = setInterval(() => {
      void tick().catch(() => {});
    }, intervalMs);
  }

  function stop() {
    polling = false;
    stopMessages();
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    platform: 'dingtalk',
    start,
    stop,
    getLastLocated: () => lastLocated,
    invokeReject: (rejectBounds) => invoke(rejectBounds)
  };
}

module.exports = {
  createDingtalkAdapter,
  resolveHangupAction,
  shouldInvokeReject,
  parseDwsJson,
  extractDingtalkMessage,
  formatDwsTime,
  isSystemContent
};
