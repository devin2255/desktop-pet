'use strict';
const { isBoss } = require('./watch-rules');

function matchBoss(event, rules) {
  const ids = Array.isArray(rules?.ids) ? rules.ids : [];
  const names = Array.isArray(rules?.names) ? rules.names : [];
  if (!event || typeof event !== 'object') return false;
  if (event.platform === 'lark' && event.kind !== 'voice-call') {
    return isBoss(event.senderId, ids);
  }
  const hay = `${event.senderName || ''} ${event.text || ''}`;
  return names.some((name) => {
    if (typeof name !== 'string' || name.trim().length < 2) return false;
    const n = name.trim();
    return event.senderName === n || hay.includes(n);
  });
}

module.exports = { matchBoss };
