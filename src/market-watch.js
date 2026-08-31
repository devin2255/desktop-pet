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

const QUOTE_FIELDS = 'f2,f3,f4,f6,f104,f105,f106,f12,f14';
const QUOTE_HOSTS = ['push2.eastmoney.com', 'push2delay.eastmoney.com'];
// Extra indices shown on the ticker besides the watched one, for a real
// "watching the board" feel (Shanghai / Shenzhen / ChiNext).
const EXTRA_SECIDS = ['0.399001', '0.399006'];

function fetchFromHost(host, secids) {
  return new Promise((resolve, reject) => {
    const url = `https://${host}/api/qt/ulist.np/get?secids=${encodeURIComponent(secids)}&fields=${QUOTE_FIELDS}`;
    const req = https.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const diff = parsed && parsed.data && Array.isArray(parsed.data.diff) ? parsed.data.diff : [];
          if (!diff.length) { reject(new Error('行情数据缺失')); return; }
          resolve(diff);
        } catch (err) { reject(err); }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (err) => reject(err));
  });
}

function toEntry(item) {
  const num = (v) => (typeof v === 'number' ? v / 100 : undefined);
  return {
    code: typeof item.f12 === 'string' ? item.f12 : '',
    name: typeof item.f14 === 'string' ? item.f14 : '',
    points: num(item.f2),
    pct: num(item.f3),
    change: num(item.f4),
    amount: typeof item.f6 === 'number' ? item.f6 : undefined,
    up: Number.isFinite(item.f104) ? item.f104 : undefined,
    down: Number.isFinite(item.f105) ? item.f105 : undefined,
    flat: Number.isFinite(item.f106) ? item.f106 : undefined
  };
}

async function defaultFetchQuote(secid) {
  const secids = [...new Set([secid, ...EXTRA_SECIDS])].join(',');
  let diff = null;
  let lastErr;
  for (const host of QUOTE_HOSTS) {
    try { diff = await fetchFromHost(host, secids); break; } catch (err) { lastErr = err; }
  }
  if (!diff) throw lastErr || new Error('行情数据缺失');
  const entries = diff.map(toEntry);
  const primary = entries.find((e) => e.pct !== undefined && secid.endsWith(e.code)) || entries.find((e) => e.pct !== undefined);
  if (!primary) throw new Error('行情数据缺失');
  return {
    ...primary,
    indices: entries.filter((e) => e.code !== primary.code && e.pct !== undefined)
      .map((e) => ({ name: e.name, pct: e.pct }))
  };
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
    simulated: src.simulated === true,
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
  onQuote,
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
  // Simulation state (market.simulated): alternate green<->red at random
  // intervals so both bull and bear sequences can be exercised any time,
  // outside trading hours included. Interval always exceeds the cooldown so
  // no synthetic flip is ever suppressed.
  let simSign = 'down'; // start green; the first flip fires a bull event
  let simNextFlipAt = null;
  let prevSimulated = false;

  function simFlipDelay(config) {
    return config.cooldownSec * 1000 + 8000 + Math.floor(Math.random() * 17000);
  }

  function simQuote() {
    const pct = (0.2 + Math.random() * 1.3) * (simSign === 'up' ? 1 : -1);
    const round2 = (v) => Math.round(v * 100) / 100;
    const base = 3900 + Math.round(Math.random() * 60);
    const up = simSign === 'up' ? 2600 + Math.round(Math.random() * 1500) : 900 + Math.round(Math.random() * 900);
    const down = simSign === 'up' ? 900 + Math.round(Math.random() * 900) : 2600 + Math.round(Math.random() * 1500);
    return {
      pct: round2(pct),
      points: base + round2(pct * 10),
      change: round2(pct * 10),
      amount: (6000 + Math.random() * 5000) * 1e8,
      up, down, flat: 90,
      name: '模拟盘',
      indices: [
        { name: '深证成指', pct: round2(pct * (0.6 + Math.random() * 0.9)) },
        { name: '创业板指', pct: round2(pct * (0.8 + Math.random() * 1.2)) }
      ]
    };
  }

  function simulatedTick(config) {
    const at = now();
    if (simNextFlipAt === null) {
      simNextFlipAt = at + simFlipDelay(config);
      dbg(`sim: armed first flip in ${Math.round((simNextFlipAt - at) / 1000)}s (start sign=${simSign})`);
      return simQuote();
    }
    if (at < simNextFlipAt) return simQuote();
    simSign = simSign === 'up' ? 'down' : 'up';
    simNextFlipAt = at + simFlipDelay(config);
    dbg(`sim: flipped to ${simSign}, next flip in ${Math.round((simNextFlipAt - at) / 1000)}s`);
    return simQuote();
  }

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
      let quote;
      if (config.simulated) {
        // Simulated mode: synthetic quotes, no trading-hours gate, no network.
        // Re-baseline when entering simulation so the mode switch itself
        // never fires an event.
        if (!prevSimulated) {
          lastSign = null;
          simNextFlipAt = null;
        }
        quote = simulatedTick(config);
      } else {
        prevSimulated = false;
        if (config.tradingHoursOnly && !inTradingHours(new Date(now()))) {
          // Outside trading hours keep the last known sign so the first flip
          // after the open can still trigger.
          dbg('tick: outside trading hours');
          return;
        }
        quote = await fetchQuote(config.secid);
      }
      prevSimulated = config.simulated;
      const sign = signOf(quote.pct);
      dbg(`tick: ${quote.name || config.secid} pct=${quote.pct} sign=${sign} lastSign=${lastSign}`);
      // Feed the live quote to the renderer ticker on every successful sample.
      try { onQuote && onQuote(quote, config); } catch (err) { dbg(`onQuote error: ${err?.message || err}`); }
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
    simNextFlipAt = null;
    prevSimulated = false;
  }

  return { start, stop, tick, inTradingHours, signOf, normalizeConfig };
}

module.exports = { createMarketWatcher, inTradingHours, signOf, normalizeConfig, defaultFetchQuote };
