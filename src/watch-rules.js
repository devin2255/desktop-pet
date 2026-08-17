'use strict';

const DEFAULT_KEYWORDS = {
  '画饼': ['这孙子在画饼，狗都不信！', '又开始画饼，真欠揍！', '真孙子，又在画饼！'],
  '吹牛': ['你老板吹了个牛逼！', '这孙子在吹牛逼！', '这孙子真能吹牛比！']
};

const DEFAULT_TRIGGERS = {
  '画饼': ['画饼', '画大饼', '上市', '期权', '股份', '股权', '分红', '年终', '加薪', '涨薪', '涨工资', '升职', '晋升', '奖金', '融资', '估值', '亏待', '功劳', '苦劳', '不会亏待', '做大做强'],
  '吹牛': ['吹牛', '吹个牛', '吹牛逼', '吹嘘', '说大话', '大话', '当年', '人脉', '搞得定', '包在我身上', '小意思', '轻而易举', '不在话下']
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

function matchKeyword(text, keywordMap, triggerMap) {
  if (typeof text !== 'string' || !text) return null;
  const lower = text.toLowerCase();
  const aliases = triggerMap && typeof triggerMap === 'object' ? triggerMap : DEFAULT_TRIGGERS;
  for (const [category, pool] of Object.entries(keywordMap || {})) {
    if (!Array.isArray(pool)) continue;
    const extra = Array.isArray(aliases[category]) ? aliases[category] : [];
    const words = [...new Set([category, ...extra].filter((w) => typeof w === 'string' && w))];
    if (words.some((word) => lower.includes(word.toLowerCase()))) return category;
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

module.exports = {
  createDedupeSet, isBoss, matchKeyword, inQuietHours, pickLine,
  DEFAULT_KEYWORDS, DEFAULT_TRIGGERS
};
