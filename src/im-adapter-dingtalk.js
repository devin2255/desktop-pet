'use strict';

const { matchBoss } = require('./im-match');
const {
  insetRect,
  nearestVerticalEdge,
  anchorsOverlap,
  mirrorAnchorX
} = require('./approach-target');

async function defaultLocateIncomingCall() {
  return null;
}

async function defaultInvokeReject() {
  return false;
}

function eventIdFromLocated(located) {
  return `${located.title || ''}\n${located.displayName || ''}`;
}

function resolveHangupAction({ located, petBounds, hangup, stage }) {
  if (!located?.rejectBounds) {
    return { invoke: false, state: 'idle', message: '这次没挂上', logicalRole: 'idle' };
  }
  const action = stage?.action || 'idle';
  if (!located.windowBounds || !petBounds || !hangup?.anchor) {
    return { invoke: false, state: action, message: '这次没挂上', logicalRole: action };
  }
  const edge = nearestVerticalEdge(petBounds, located.windowBounds);
  const mirrored = edge.side === 'right';
  const rejectInset = insetRect(located.rejectBounds, 0.25);
  if (!anchorsOverlap(petBounds, mirrorAnchorX(hangup.anchor, mirrored), rejectInset)) {
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
  resolveHangupAction
};
