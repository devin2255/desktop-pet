'use strict';

const path = require('path');

// Pet packs may only name these ids. Targets are resolved on the machine;
// a pack cannot supply an executable path or a shell command.
const AI_APP_CATALOG = Object.freeze([
  {
    id: 'qwen-work',
    label: '千问工作助理',
    aliases: ['千问工作助理', '千问办公', 'QwenWork'],
    pathMarkers: ['qwenworkcn\\launcher.exe'],
    url: 'https://www.qianwen.com/'
  },
  {
    id: 'qwen',
    label: '千问',
    aliases: ['通义千问', '千问', 'Qianwen'],
    pathMarkers: ['qianwen.exe', 'tongyi.exe'],
    url: 'https://www.qianwen.com/'
  },
  {
    id: 'doubao',
    label: '豆包',
    aliases: ['豆包', 'Doubao'],
    pathMarkers: ['doubao.exe'],
    url: 'https://www.doubao.com/chat/'
  },
  {
    id: 'kimi',
    label: 'Kimi',
    aliases: ['Kimi', '月之暗面'],
    pathMarkers: ['kimi.exe'],
    url: 'https://kimi.moonshot.cn/'
  },
  {
    id: 'yuanbao',
    label: '腾讯元宝',
    aliases: ['腾讯元宝', '元宝', 'Yuanbao'],
    pathMarkers: ['yuanbao.exe'],
    url: 'https://yuanbao.tencent.com/'
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    aliases: ['ChatGPT'],
    pathMarkers: ['chatgpt.exe'],
    url: 'https://chatgpt.com/'
  },
  {
    id: 'gemini',
    label: 'Gemini',
    aliases: ['Gemini'],
    pathMarkers: ['gemini.exe'],
    url: 'https://gemini.google.com/app'
  },
  {
    id: 'wenxin',
    label: '文心一言',
    aliases: ['文心一言', '文心'],
    pathMarkers: ['wenxin.exe', 'yiyan.exe'],
    url: 'https://yiyan.baidu.com/'
  }
]);

const AI_APP_BY_ID = new Map(AI_APP_CATALOG.map((app) => [app.id, app]));
const AI_APP_IDS = new Set(AI_APP_BY_ID.keys());
const MAX_LAUNCH_APPS = 6;

function readLnkLocalPath(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 76) return '';
  const headerSize = buffer.readUInt32LE(0);
  if (headerSize < 76 || headerSize > buffer.length) return '';
  const flags = buffer.readUInt32LE(0x14);
  let offset = headerSize;
  if (flags & 0x1) {
    if (offset + 2 > buffer.length) return '';
    const idListSize = buffer.readUInt16LE(offset);
    offset += 2 + idListSize;
  }
  if (!(flags & 0x2) || offset + 28 > buffer.length) return '';
  const linkInfoSize = buffer.readUInt32LE(offset);
  const header = buffer.readUInt32LE(offset + 4);
  const infoFlags = buffer.readUInt32LE(offset + 8);
  if (linkInfoSize < header || offset + linkInfoSize > buffer.length) return '';
  if (header >= 0x24 && offset + 36 <= buffer.length) {
    const unicodeOffset = buffer.readUInt32LE(offset + 28);
    const start = offset + unicodeOffset;
    if (unicodeOffset >= header && start + 2 <= offset + linkInfoSize) {
      let end = start;
      while (end + 1 < offset + linkInfoSize && !(buffer[end] === 0 && buffer[end + 1] === 0)) end += 2;
      const text = buffer.toString('utf16le', start, end).replace(/\0/g, '').trim();
      if (text) return text;
    }
  }
  if (!(infoFlags & 0x1)) return '';
  const localOffset = buffer.readUInt32LE(offset + 16);
  const start = offset + localOffset;
  if (localOffset < 28 || start >= offset + linkInfoSize) return '';
  let end = start;
  while (end < offset + linkInfoSize && buffer[end] !== 0) end += 1;
  return buffer.toString('latin1', start, end).trim();
}

function defaultShortcutRoots(env = process.env) {
  const roots = [];
  if (env.APPDATA) roots.push(path.join(env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'));
  if (env.PROGRAMDATA) roots.push(path.join(env.PROGRAMDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'));
  if (env.USERPROFILE) roots.push(path.join(env.USERPROFILE, 'Desktop'));
  return roots;
}

function collectShortcuts(roots, fsApi) {
  const found = [];
  const seen = new Set();
  function walk(directory, depth) {
    if (depth > 4) return;
    let entries = [];
    try {
      entries = fsApi.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.lnk')) continue;
      let buffer;
      try {
        buffer = fsApi.readFileSync(full);
      } catch {
        continue;
      }
      const target = readLnkLocalPath(buffer);
      if (!target || seen.has(target.toLowerCase())) continue;
      seen.add(target.toLowerCase());
      found.push({
        name: path.basename(entry.name, path.extname(entry.name)),
        target
      });
    }
  }
  for (const root of roots || []) walk(root, 0);
  return found;
}

function scoreApp(app, shortcut) {
  const base = String(shortcut?.name || '').toLowerCase();
  const target = String(shortcut?.target || '').replace(/\//g, '\\').toLowerCase();
  let score = 0;
  for (const marker of app.pathMarkers) {
    const needle = marker.replace(/\//g, '\\').toLowerCase();
    if (needle && target.includes(needle)) score = Math.max(score, 1000 + needle.length);
  }
  for (const alias of app.aliases) {
    const needle = alias.toLowerCase();
    if (needle && base.includes(needle)) score = Math.max(score, needle.length);
  }
  return score;
}

function bestAppId(shortcut, catalog = AI_APP_CATALOG) {
  let best = '';
  let bestScore = 0;
  for (const app of catalog) {
    const score = scoreApp(app, shortcut);
    if (score > bestScore) {
      bestScore = score;
      best = app.id;
    }
  }
  return best;
}

function resolveLaunchApps(ids, shortcuts, exists) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const items = [];
  for (const id of ids) {
    if (typeof id !== 'string' || !AI_APP_BY_ID.has(id) || seen.has(id)) continue;
    seen.add(id);
    if (items.length >= MAX_LAUNCH_APPS) break;
    const app = AI_APP_BY_ID.get(id);
    const hit = (shortcuts || []).find((shortcut) => bestAppId(shortcut) === id && exists(shortcut.target));
    items.push(hit
      ? { id, label: app.label, kind: 'path', target: hit.target }
      : { id, label: app.label, kind: 'url', target: app.url });
  }
  return items;
}

module.exports = {
  AI_APP_CATALOG,
  AI_APP_BY_ID,
  AI_APP_IDS,
  MAX_LAUNCH_APPS,
  readLnkLocalPath,
  defaultShortcutRoots,
  collectShortcuts,
  bestAppId,
  resolveLaunchApps
};
