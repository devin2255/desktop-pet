'use strict';

const SHICHEN = Object.freeze([
  { id: 'zi', name: '子' },
  { id: 'chou', name: '丑' },
  { id: 'yin', name: '寅' },
  { id: 'mao', name: '卯' },
  { id: 'chen', name: '辰' },
  { id: 'si', name: '巳' },
  { id: 'wu', name: '午' },
  { id: 'wei', name: '未' },
  { id: 'shen', name: '申' },
  { id: 'you', name: '酉' },
  { id: 'xu', name: '戌' },
  { id: 'hai', name: '亥' }
]);

const WEIGHTS = Object.freeze({
  zi: { walk: 0.22, idle: 0.9, sit: 1.5, reaction: 0.45, sleep: 2.4 },
  chou: { walk: 0.28, idle: 1, sit: 1.4, reaction: 0.5, sleep: 2 },
  yin: { walk: 0.7, idle: 1, sit: 1, reaction: 0.85, sleep: 0.2 },
  mao: { walk: 1.45, idle: 0.85, sit: 0.55, reaction: 1.05, sleep: 0 },
  chen: { walk: 1.3, idle: 0.9, sit: 0.7, reaction: 1, sleep: 0 },
  si: { walk: 1.15, idle: 1, sit: 0.8, reaction: 1, sleep: 0 },
  wu: { walk: 0.28, idle: 1.05, sit: 2.4, reaction: 0.7, sleep: 0.25 },
  wei: { walk: 0.7, idle: 1, sit: 1.35, reaction: 0.85, sleep: 0 },
  shen: { walk: 1, idle: 1, sit: 1, reaction: 1, sleep: 0 },
  you: { walk: 0.42, idle: 1.25, sit: 1.7, reaction: 0.7, sleep: 0.15 },
  xu: { walk: 0.35, idle: 1.2, sit: 1.45, reaction: 0.55, sleep: 0.55 },
  hai: { walk: 0.24, idle: 1, sit: 1.35, reaction: 0.45, sleep: 1.8 }
});

function asDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
}

function pickShichen(date = new Date()) {
  const index = Math.floor(((asDate(date).getHours() + 1) % 24) / 2);
  return SHICHEN[index] || SHICHEN[0];
}

function shichenWeight(shichen, state) {
  const table = WEIGHTS[shichen?.id] || WEIGHTS.shen;
  return Number.isFinite(table[state]) ? table[state] : 1;
}

function applyShichenWeights(choices, shichen) {
  if (!Array.isArray(choices)) return [];
  return choices.map((item) => {
    const factor = shichenWeight(shichen, item?.state);
    return { ...item, weight: Math.max(0.01, (Number(item.weight) || 0) * factor) };
  });
}

function resolveShichenLine(lines, shichen) {
  if (!shichen) return '';
  const custom = lines && typeof lines === 'object' && typeof lines[shichen.id] === 'string'
    ? lines[shichen.id].trim()
    : '';
  return custom || `${shichen.name}时。`;
}

module.exports = {
  SHICHEN,
  pickShichen,
  shichenWeight,
  applyShichenWeights,
  resolveShichenLine
};
