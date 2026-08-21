'use strict';

// Market mood watcher: polls a stock index quote (EastMoney public API) during
// trading hours and emits 'bull' / 'bear' events the moment the index flips
// from green (<= 0) to red (> 0) or back. Events are driven entirely by
// player config + petpack sequences; nothing here knows any specific pet.

const https = require('https');

const DEFAULT_SECID = '1.000001'; // 上证指数

const DEBUG_ON = process.env.PET_MARKET_DEBUG === '1';

function createDebugWriter(logPath) {
  return (line) => {
    if (!DEBUG_ON) return;
    try { require('fs').appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`); } catch (_) {}
  };
}

function defaultFetchQuote(secid) {
  return new Promise((resolve, reject) => {
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${encodeURIComponent(secid)}&fields=f2,f3,f12,f13,f14`;
    const req = https.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const diff = parsed && parsed.data && Array.isArray(parsed.data.diff) ? parsed.data.diff : [];
          const first = diff.find((item) => item && typeof item.f3 === 'number');
          if (!first) { reject(new Error('行情数据缺失')); return; }
          resolve({ pct: first.f3 / 100, name: typeof first.f14 === 'string' ? first.f14 : '' });
        } catch (err) { reject(err); }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (err) => reject(err));
  });
}

function inTradingHours(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  return (minutes >= 9 * 60 + 25 && minutes < 11 * 60 + 30)
    || (minutes >= 13 * 60 && minutes < 15 * 60);
}

function normalizeConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const pollMs = Number(src.pollMs);
  const cooldownSec = Number(src.cooldownSec);
  return {
    enabled: src.enabled === true,
    secid: typeof src.secid === 'string' && src.secid.trim() ? src.secid.trim() : DEFAULT_SECID,
    pollMs: Number.isFinite(pollMs) && pollMs >= 2000 ? pollMs : 5000,
    cooldownSec: Number.isFinite(cooldownSec) && cooldownSec >= 0 ? cooldownSec : 60,
    tradingHoursOnly: src.tradingHoursOnly !== false
  };
}

function signOf(pct) {
  return pct > 0 ? 'up' : 'down';
}

function createMarketWatcher({
  getConfig,
  onEvent,
  onStatus,
  fetchQuote = defaultFetchQuote,
  now = () => Date.now(),
  debugLogPath = require('path').join(process.cwd(), 'market-watch-debug.log')
}) {
  const dbg = createDebugWriter(debugLogPath);
  let timer = null;
  let tickPending = false;
  let lastSign = null; // 'up' | 'down'; null until first successful sample
  let lastTriggerAt = 0;
  let mockFired = false;

  function emit(kind, quote) {
    const at = now();
    const config = normalizeConfig(getConfig && getConfig());
    if (at - lastTriggerAt < config.cooldownSec * 1000) {
      dbg(`emit ${kind} suppressed by cooldown (${Math.round((at - lastTriggerAt) / 1000)}s since last)`);
      return;
    }
    lastTriggerAt = at;
    dbg(`emit ${kind} pct=${quote?.pct} name=${quote?.name || ''}`);
    try { onEvent && onEvent(kind, quote); } catch (err) { dbg(`onEvent error: ${err?.message || err}`); }
  }

  async function tick() {
    if (tickPending || !timer) return;
    tickPending = true;
    try {
      const config = normalizeConfig(getConfig && getConfig());
      if (!config.enabled) return;
      if (config.tradingHoursOnly && !inTradingHours(new Date(now()))) {
        // Outside trading hours keep the last known sign so the first flip
        // after the open can still trigger.
        dbg('tick: outside trading hours');
        return;
      }
      const quote = await fetchQuote(config.secid);
      const sign = signOf(quote.pct);
      dbg(`tick: ${quote.name || config.secid} pct=${quote.pct} sign=${sign} lastSign=${lastSign}`);
      if (lastSign === null) {
        lastSign = sign;
        return;
      }
      if (sign !== lastSign) {
        const kind = sign === 'up' ? 'bull' : 'bear';
        lastSign = sign;
        emit(kind, quote);
      } else {
        lastSign = sign;
      }
    } catch (err) {
      dbg(`tick error: ${err?.message || err}`);
      // Transient network failures must not flip the baseline sign.
    } finally {
      tickPending = false;
    }
  }

  function start() {
    const config = normalizeConfig(getConfig && getConfig());
    dbg(`start enabled=${config.enabled} secid=${config.secid} pollMs=${config.pollMs} cooldownSec=${config.cooldownSec}`);
    if (timer) return;
    timer = setInterval(() => { tick().catch(() => {}); }, config.pollMs);
    if (timer.unref) timer.unref();
    // First sample immediately so the baseline sign settles fast.
    tick().catch(() => {});
    // Test hook: PET_MARKET_MOCK=bull|bear fires a synthetic flip once.
    const mock = process.env.PET_MARKET_MOCK;
    if (!mockFired && (mock === 'bull' || mock === 'bear')) {
      mockFired = true;
      setTimeout(() => { emit(mock, { pct: mock === 'bull' ? 0.5 : -0.5, name: 'mock' }); }, 1500);
      if (timer.unref) timer.unref();
    }
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    lastSign = null;
  }

  return { start, stop, tick, inTradingHours, signOf, normalizeConfig };
}

module.exports = { createMarketWatcher, inTradingHours, signOf, normalizeConfig, defaultFetchQuote };
