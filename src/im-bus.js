'use strict';
const { inQuietHours } = require('./watch-rules');
const { matchBoss } = require('./im-match');

function createImBus({ getRules, adapters, dispatchMessage, onVoiceCall, logger }) {
  let started = false;
  const callCooldown = new Map();
  const list = Array.isArray(adapters) ? adapters : [];

  function handleVoiceCall(event) {
    const rules = getRules();
    if (!rules.callHangup || rules.callHangup.enabled !== true) return;
    if (inQuietHours(new Date(), rules.quietHours)) return;
    if (!matchBoss(event, rules)) return;
    const cooldownSec = Number(rules.callHangup.cooldownSec) || 0;
    const key = `${event?.senderName || ''}\0${event?.senderId || ''}` || event?.eventId || '';
    const now = Date.now();
    const last = callCooldown.get(key) || 0;
    if (now - last < cooldownSec * 1000) return;
    callCooldown.set(key, now);
    if (typeof onVoiceCall === 'function') onVoiceCall(event);
  }

  function onMessage(event) {
    const rules = getRules();
    if (inQuietHours(new Date(), rules.quietHours)) return;
    if (!matchBoss(event, rules)) return;
    if (typeof dispatchMessage === 'function') dispatchMessage(event, rules);
  }

  async function start() {
    const rules = getRules();
    if (!rules.enabled) return;
    started = true;
    const platforms = Array.isArray(rules.platforms) ? rules.platforms : [];
    for (const adapter of list) {
      if (!platforms.includes(adapter.platform)) continue;
      try {
        await adapter.start({ rules, onMessage, onVoiceCall: handleVoiceCall });
      } catch (err) {
        logger?.warn?.(adapter.platform, err);
      }
    }
  }

  function stop() {
    list.forEach((adapter) => {
      try { adapter.stop?.(); } catch (_) { /* ignore adapter stop errors */ }
    });
    started = false;
  }

  return { start, stop, isStarted: () => started };
}

module.exports = { createImBus };
