'use strict';

const QWEN_TASK_ORIGIN = 'https://www.qianwen.com/';
const MAX_TASK_CHARS = 200;

function normalizeTaskText(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...cleaned].slice(0, MAX_TASK_CHARS).join('');
}

function buildQwenTaskUrl(value) {
  const text = normalizeTaskText(value);
  if (!text) return '';
  return `${QWEN_TASK_ORIGIN}?q=${encodeURIComponent(text)}`;
}

function taskAck(value) {
  const text = normalizeTaskText(value);
  if (!text) return null;
  const full = `交给千问：${text}`;
  const chars = [...full];
  const message = chars.length <= 80 ? full : `${chars.slice(0, 79).join('')}…`;
  const speech = [...message].length <= 20 ? message : '交给千问了。';
  return { message, speech };
}

module.exports = {
  QWEN_TASK_ORIGIN,
  MAX_TASK_CHARS,
  normalizeTaskText,
  buildQwenTaskUrl,
  taskAck
};
