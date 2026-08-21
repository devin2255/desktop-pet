'use strict';
const fs = require('fs');
const { DEFAULT_KEYWORDS, DEFAULT_TRIGGERS } = require('./watch-rules');

const DEFAULT_BOSS_CONFIG = {
  enabled: false,
  cooldownSec: 30,
  quietHours: [],
  voice: { enabled: true, gender: 'male', rate: '+0%', voice: 'zh-CN-YunxiNeural' }
};

// Self-use default: the boss-watch radar ships enabled so the developer's own
// machine starts listening on first launch without manual config. Customer
// builds (separate delivery) would override with enabled:false.
const SELF_USE_DEFAULT_CONFIG = {
  enabled: true,
  larkCliPath: 'C:/Users/Thinkpad/.qwenworkcn/bin/lark-cli.cmd',
  bosses: ['ou_c213c1a364e0818e671eb4823b4b9e2f'],
  platforms: ['lark', 'dingtalk'],
  cooldownSec: 30,
  quietHours: [],
  callHangup: { enabled: true, platforms: ['dingtalk'], cooldownSec: 60 },
  dingtalk: {
    enabled: true,
    dwsPath: 'C:/Users/Thinkpad/.qwenworkcn/bin/dws.cmd',
    pollMs: 10000,
    bossOpenIds: [],
    groups: []
  },
  voice: { enabled: true, gender: 'male', rate: '+0%', voice: 'zh-CN-YunxiNeural' },
  market: { enabled: true, secid: '1.000001', pollMs: 5000, cooldownSec: 60, tradingHoursOnly: true }
};

const CUSTOMER_DEFAULT_CONFIG = {
  enabled: false,
  bosses: [],
  platforms: ['lark', 'dingtalk'],
  cooldownSec: 30,
  quietHours: [],
  callHangup: { enabled: false, platforms: ['dingtalk'], cooldownSec: 60 },
  dingtalk: {
    enabled: false,
    dwsPath: 'C:/Users/Thinkpad/.qwenworkcn/bin/dws.cmd',
    pollMs: 10000,
    bossOpenIds: [],
    groups: []
  },
  voice: { enabled: true, gender: 'male', rate: '+0%', voice: 'zh-CN-YunxiNeural' },
  market: { enabled: true, secid: '1.000001', pollMs: 5000, cooldownSec: 60, tradingHoursOnly: true }
};

const DEFAULT_DWS_PATH = 'C:/Users/Thinkpad/.qwenworkcn/bin/dws.cmd';

// market mood radar: watch an index quote and fire petpack sequences when the
// index flips between green (<=0) and red (>0).
function normalizeMarket(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const pollMs = Number(src.pollMs);
  const cooldownSec = Number(src.cooldownSec);
  return {
    enabled: src.enabled === true,
    secid: typeof src.secid === 'string' && src.secid.trim() ? src.secid.trim() : '1.000001',
    pollMs: Number.isFinite(pollMs) && pollMs >= 2000 ? pollMs : 5000,
    cooldownSec: Number.isFinite(cooldownSec) && cooldownSec >= 0 ? cooldownSec : 60,
    tradingHoursOnly: src.tradingHoursOnly !== false
  };
}

// dingtalk message radar: poll `dws chat message list` for boss single chats and
// group @所有人 messages. bossOpenIds are dingtalk openDingtalkId values.
function normalizeDingtalk(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const clean = (arr) => (Array.isArray(arr) ? arr
    .filter((x) => typeof x === 'string' && x.trim())
    .map((x) => x.trim()) : []);
  const pollMs = Number.isFinite(Number(src.pollMs)) && Number(src.pollMs) >= 2000
    ? Number(src.pollMs) : 10000;
  return {
    enabled: src.enabled !== false,
    dwsPath: typeof src.dwsPath === 'string' && src.dwsPath.trim() ? src.dwsPath.trim() : DEFAULT_DWS_PATH,
    pollMs,
    bossOpenIds: clean(src.bossOpenIds),
    groups: clean(src.groups)
  };
}

function normalizePlatforms(raw) {
  const allowed = new Set(['lark', 'dingtalk']);
  const list = Array.isArray(raw) ? raw.filter((x) => allowed.has(x)) : [];
  return list.length ? [...new Set(list)] : ['lark'];
}

function normalizeCallHangup(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const platforms = Array.isArray(src.platforms)
    ? src.platforms.filter((x) => x === 'dingtalk')
    : ['dingtalk'];
  return {
    enabled: src.enabled === true,
    platforms: platforms.length ? platforms : ['dingtalk'],
    cooldownSec: Number.isFinite(Number(src.cooldownSec)) ? Math.max(0, Number(src.cooldownSec)) : 60
  };
}

// Writes the self-use default boss-watch.json when the file is missing, so the
// portable EXE works out of the box on the developer's machine. Returns the
// config path for convenience. Existing files are never overwritten.
function ensureBossWatchDefaults(configPath, { customer } = {}) {
  if (!configPath) return configPath;
  try {
    if (fs.existsSync(configPath)) return configPath;
    const dir = require('path').dirname(configPath);
    fs.mkdirSync(dir, { recursive: true });
    const payload = customer === true ? CUSTOMER_DEFAULT_CONFIG : SELF_USE_DEFAULT_CONFIG;
    fs.writeFileSync(configPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  } catch (_) { /* best-effort; loadWatchConfig falls back to safe defaults */ }
  return configPath;
}

function splitBosses(bosses) {
  const ids = [];
  const names = [];
  for (const item of Array.isArray(bosses) ? bosses : []) {
    if (typeof item !== 'string' || !item.trim()) continue;
    if (item.startsWith('ou_')) ids.push(item);
    else names.push(item);
  }
  return { ids, names };
}

// Normalize keyword pool entries: accept strings or {text, audio} objects
function normalizePool(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => {
      if (typeof x === 'string' && x.trim()) return { text: x.trim(), audio: '' };
      if (x && typeof x === 'object' && typeof x.text === 'string' && x.text.trim())
        return { text: x.text.trim(), audio: typeof x.audio === 'string' ? x.audio.trim() : '' };
      return null;
    })
    .filter(Boolean);
}

function normalizeFallback(v, defaultText) {
  if (typeof v === 'string' && v.trim()) return { text: v.trim(), audio: '' };
  if (v && typeof v === 'object' && typeof v.text === 'string' && v.text.trim())
    return { text: v.text.trim(), audio: typeof v.audio === 'string' ? v.audio.trim() : '' };
  return { text: defaultText, audio: '' };
}

function normalizeQuietHours(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((pair) => Array.isArray(pair) && pair.length === 2
    && typeof pair[0] === 'string' && typeof pair[1] === 'string' && /^\d{1,2}:\d{2}$/.test(pair[0]) && /^\d{1,2}:\d{2}$/.test(pair[1]));
}

function normalizeTriggers(raw, categories) {
  const out = {};
  for (const category of categories) {
    const fromManifest = raw && Array.isArray(raw[category])
      ? raw[category].filter((w) => typeof w === 'string' && w.trim()).map((w) => w.trim())
      : [];
    const fallback = Array.isArray(DEFAULT_TRIGGERS[category]) ? DEFAULT_TRIGGERS[category] : [category];
    out[category] = fromManifest.length ? fromManifest : fallback.slice();
  }
  return out;
}

function normalizeKeywordStates(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key === 'string' && key.trim() && typeof value === 'string' && value.trim()) {
      out[key.trim()] = value.trim();
    }
  }
  return out;
}

function patchWatchFlags(configPath, flags = {}, { customer } = {}) {
  if (!configPath) return false;
  if (!fs.existsSync(configPath)) ensureBossWatchDefaults(configPath, { customer });
  let raw;
  try {
    if (!fs.existsSync(configPath)) return false;
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    raw = parsed;
  } catch (_) {
    return false;
  }
  if (typeof flags.enabled === 'boolean') raw.enabled = flags.enabled;
  if (typeof flags.callHangupEnabled === 'boolean') {
    const prev = raw.callHangup && typeof raw.callHangup === 'object' && !Array.isArray(raw.callHangup)
      ? raw.callHangup
      : {};
    raw.callHangup = { ...prev, enabled: flags.callHangupEnabled };
  }
  try {
    const dir = require('path').dirname(configPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  } catch (_) { /* best-effort */ }
  return configPath;
}

function loadWatchConfig({ configPath, manifestWatch, larkCliPath }) {
  let fileCfg = {};
  try {
    if (configPath && fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (raw && typeof raw === 'object') fileCfg = raw;
    }
  } catch (_) { fileCfg = {}; }

  const voiceBase = (fileCfg.voice && typeof fileCfg.voice === 'object') ? fileCfg.voice : {};
  const voice = {
    enabled: voiceBase.enabled === undefined ? DEFAULT_BOSS_CONFIG.voice.enabled : Boolean(voiceBase.enabled),
    gender: voiceBase.gender === 'female' ? 'female' : 'male',
    rate: typeof voiceBase.rate === 'string' ? voiceBase.rate : DEFAULT_BOSS_CONFIG.voice.rate,
    voice: typeof voiceBase.voice === 'string' && voiceBase.voice ? voiceBase.voice : DEFAULT_BOSS_CONFIG.voice.voice
  };

  const manifest = manifestWatch && typeof manifestWatch === 'object' ? manifestWatch : {};
  const manifestKeywords = manifest.keywords && typeof manifest.keywords === 'object'
    ? Object.fromEntries(Object.entries(manifest.keywords)
        .filter(([k, v]) => typeof k === 'string' && k && Array.isArray(v) && v.length > 0)
        .map(([k, v]) => [k, normalizePool(v)]))
    : {};
  const keywords = Object.keys(manifestKeywords).length
    ? manifestKeywords
    : Object.fromEntries(Object.entries(DEFAULT_KEYWORDS).map(([k, v]) => [k, normalizePool(v)]));
  const fallback = normalizeFallback(manifest.fallback, '你老板又开始整活儿了，装没看见。');
  const state = typeof manifest.state === 'string' && manifest.state.trim()
    ? manifest.state.trim() : 'reaction';
  const triggers = normalizeTriggers(manifest.triggers, Object.keys(keywords));
  const keywordStates = normalizeKeywordStates(manifest.keywordStates);

  const { ids, names } = splitBosses(fileCfg.bosses);
  return {
    enabled: Boolean(fileCfg.enabled),
    larkCliPath: typeof larkCliPath === 'string' && larkCliPath ? larkCliPath : (typeof fileCfg.larkCliPath === 'string' && fileCfg.larkCliPath ? fileCfg.larkCliPath : ''),
    bosses: Array.isArray(fileCfg.bosses) ? fileCfg.bosses.filter((x) => typeof x === 'string' && x.trim()) : [],
    ids,
    names,
    cooldownSec: Number.isFinite(Number(fileCfg.cooldownSec)) ? Math.max(0, Number(fileCfg.cooldownSec)) : DEFAULT_BOSS_CONFIG.cooldownSec,
    quietHours: normalizeQuietHours(fileCfg.quietHours),
    voice,
    keywords,
    triggers,
    fallback,
    state,
    keywordStates,
    platforms: normalizePlatforms(fileCfg.platforms),
    callHangup: normalizeCallHangup(fileCfg.callHangup),
    dingtalk: normalizeDingtalk(fileCfg.dingtalk),
    market: normalizeMarket(fileCfg.market)
  };
}

module.exports = {
  loadWatchConfig, splitBosses, DEFAULT_BOSS_CONFIG, ensureBossWatchDefaults, patchWatchFlags,
  SELF_USE_DEFAULT_CONFIG, CUSTOMER_DEFAULT_CONFIG, normalizePlatforms, normalizeCallHangup,
  normalizeDingtalk, normalizeMarket
};
