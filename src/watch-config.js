'use strict';
const fs = require('fs');
const { DEFAULT_KEYWORDS } = require('./watch-rules');

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
  bosses: ['ou_221a684c00848f0cd7f3e29d1061d908'],
  cooldownSec: 30,
  quietHours: [],
  voice: { enabled: true, gender: 'male', rate: '+0%', voice: 'zh-CN-YunxiNeural' }
};

// Writes the self-use default boss-watch.json when the file is missing, so the
// portable EXE works out of the box on the developer's machine. Returns the
// config path for convenience. Existing files are never overwritten.
function ensureBossWatchDefaults(configPath) {
  if (!configPath) return configPath;
  try {
    if (fs.existsSync(configPath)) return configPath;
    const dir = require('path').dirname(configPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(SELF_USE_DEFAULT_CONFIG, null, 2) + '\n', 'utf8');
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

function asStrings(v) { return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []; }
function asStringArray(v) { return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []; }

function normalizeQuietHours(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((pair) => Array.isArray(pair) && pair.length === 2
    && typeof pair[0] === 'string' && typeof pair[1] === 'string' && /^\d{1,2}:\d{2}$/.test(pair[0]) && /^\d{1,2}:\d{2}$/.test(pair[1]));
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
        .filter(([k, v]) => typeof k === 'string' && k && Array.isArray(v) && v.some((x) => typeof x === 'string' && x))
        .map(([k, v]) => [k, asStrings(v)]))
    : {};
  const keywords = Object.keys(manifestKeywords).length ? manifestKeywords : DEFAULT_KEYWORDS;
  const fallback = typeof manifest.fallback === 'string' && manifest.fallback.trim()
    ? manifest.fallback.trim() : '老板又开始整活儿了，装没看见。';
  const state = typeof manifest.state === 'string' && manifest.state.trim()
    ? manifest.state.trim() : 'reaction';

  const { ids, names } = splitBosses(fileCfg.bosses);
  return {
    enabled: Boolean(fileCfg.enabled),
    larkCliPath: typeof larkCliPath === 'string' && larkCliPath ? larkCliPath : '',
    bosses: asStringArray(fileCfg.bosses),
    ids,
    names,
    cooldownSec: Number.isFinite(Number(fileCfg.cooldownSec)) ? Math.max(0, Number(fileCfg.cooldownSec)) : DEFAULT_BOSS_CONFIG.cooldownSec,
    quietHours: normalizeQuietHours(fileCfg.quietHours),
    voice,
    keywords,
    fallback,
    state
  };
}

module.exports = { loadWatchConfig, splitBosses, DEFAULT_BOSS_CONFIG, ensureBossWatchDefaults, SELF_USE_DEFAULT_CONFIG };
