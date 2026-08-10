'use strict';

const DEFAULT_KEYWORDS = {
  '画饼': ['老板画的饼别吃，你啃不动！', '这饼画得真圆，可惜啃不动。'],
  '吹牛': ['你的老板吹了个牛逼！', '这牛吹得，我耳朵都疼了。']
};

function createDedupeSet(maxSize = 5000) {
  const seen = new Set();
  const queue = [];
  return {
    has(id) { return seen.has(id); },
    add(id) {
      if (seen.has(id)) return;
      seen.add(id);
      queue.push(id);
      while (queue.length > maxSize) seen.delete(queue.shift());
    }
  };
}

function isBoss(senderId, bossIds) {
  return Array.isArray(bossIds) && bossIds.length > 0
    && typeof senderId === 'string' && bossIds.includes(senderId);
}

function matchKeyword(text, keywordMap) {
  if (typeof text !== 'string' || !text) return null;
  const lower = text.toLowerCase();
  for (const [category, pool] of Object.entries(keywordMap || {})) {
    if (Array.isArray(pool) && lower.includes(category.toLowerCase())) return category;
  }
  return null;
}

function toMinutes(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return h * 60 + (m || 0);
}

function inQuietHours(now, quietHours) {
  if (!Array.isArray(quietHours) || quietHours.length === 0) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (const [start, end] of quietHours) {
    const s = toMinutes(start); const e = toMinutes(end);
    if (s === e) continue;
    if (s < e) { if (minutes >= s && minutes < e) return true; }
    else { if (minutes >= s || minutes < e) return true; } // 跨午夜
  }
  return false;
}

function pickLine(pool, rng = Math.random) {
  const arr = Array.isArray(pool) && pool.length ? pool : [''];
  return arr[Math.floor(rng() * arr.length)];
}

module.exports = { createDedupeSet, isBoss, matchKeyword, inQuietHours, pickLine, DEFAULT_KEYWORDS };
