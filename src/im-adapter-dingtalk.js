'use strict';

const { matchBoss } = require('./im-match');
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
  return anchorsOverlap(petBounds, hangupAnchor, insetRect(rejectBounds, 0.25));
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

function createDingtalkAdapter({
  locateIncomingCall,
  invokeReject,
  pollMs = 1000
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

  async function tick() {
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

  async function start({ rules, onVoiceCall: cb } = {}) {
    stop();
    if (!rules?.callHangup || rules.callHangup.enabled !== true) return;
    rulesRef = rules;
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
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Spike: no locally runnable official Stream / 企业内部应用 event source
  // (SDK needs enterprise AppKey/AppSecret; not a desktop-client consumer).
  // Do not call from start(); voice-call polling stays independent.
  function startMessages() {}

  return {
    platform: 'dingtalk',
    start,
    stop,
    startMessages,
    getLastLocated: () => lastLocated,
    invokeReject: (rejectBounds) => invoke(rejectBounds)
  };
}

module.exports = {
  createDingtalkAdapter,
  resolveHangupAction,
  shouldInvokeReject
};
