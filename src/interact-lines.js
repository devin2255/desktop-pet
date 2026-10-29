'use strict';

function normalizeInteractLines(interact) {
  if (!interact || !Array.isArray(interact.lines)) return [];
  return interact.lines.map((line) => {
    if (typeof line === 'string') {
      return { message: line, speech: line.length <= 20 ? line : '' };
    }
    const message = typeof line?.message === 'string' ? line.message : '';
    const speech = typeof line?.speech === 'string' ? line.speech : '';
    return { message, speech };
  }).filter((line) => line.message.trim());
}

function nextInteractLine(lines, cursor) {
  if (!Array.isArray(lines) || !lines.length) return { cursor: 0, line: null };
  const index = ((Number(cursor) || 0) % lines.length + lines.length) % lines.length;
  return { cursor: index + 1, line: lines[index] };
}

const CLICK_LOCK_MS = 650;

function gateInteract({ now, lockedUntil = 0, priorityUntil = 0 } = {}) {
  const time = Number(now) || 0;
  if (time < priorityUntil) {
    return { allow: false, reason: 'priority', lockedUntil, priorityUntil };
  }
  if (time < lockedUntil) {
    return { allow: false, reason: 'repeat', lockedUntil, priorityUntil };
  }
  return { allow: true, reason: 'ok', lockedUntil: time + CLICK_LOCK_MS, priorityUntil };
}

module.exports = { normalizeInteractLines, nextInteractLine, gateInteract, CLICK_LOCK_MS };
