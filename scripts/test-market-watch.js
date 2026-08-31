'use strict';

// Unit tests for src/market-watch.js: sign-flip detection, cooldown,
// trading-hours gate. Run: node scripts/test-market-watch.js

const assert = require('assert');
const path = require('path');
const { createMarketWatcher, inTradingHours, signOf, normalizeConfig } = require('../src/market-watch');

let fakeNow = new Date(2026, 7, 17, 10, 0).getTime(); // 周一 10:00，交易时段内
function now() { return fakeNow; }

function makeWatcher(quotes, events) {
  let i = 0;
  return createMarketWatcher({
    getConfig: () => ({ enabled: true, pollMs: 2000, cooldownSec: 60 }),
    fetchQuote: async () => {
      const q = quotes[i];
      i = Math.min(i + 1, quotes.length - 1);
      return q;
    },
    onEvent: (kind, quote) => events.push({ kind, quote, at: fakeNow }),
    now,
    debugLogPath: path.join(__dirname, '..', 'tmp-market-test-debug.log')
  });
}

async function main() {
  // signOf: >0 is red (up), <=0 is green (down)
  assert.strictEqual(signOf(0.01), 'up');
  assert.strictEqual(signOf(0), 'down');
  assert.strictEqual(signOf(-0.17), 'down');

  // inTradingHours: Monday 10:00 yes, Saturday 10:00 no, weekday 12:00 no, 14:00 yes
  assert.strictEqual(inTradingHours(new Date(2026, 7, 17, 10, 0)), true); // 周一
  assert.strictEqual(inTradingHours(new Date(2026, 7, 22, 10, 0)), false); // 周六
  assert.strictEqual(inTradingHours(new Date(2026, 7, 17, 12, 0)), false); // 午休
  assert.strictEqual(inTradingHours(new Date(2026, 7, 17, 14, 30)), true);
  assert.strictEqual(inTradingHours(new Date(2026, 7, 17, 15, 30)), false);

  // normalizeConfig defaults
  const cfg = normalizeConfig(undefined);
  assert.deepStrictEqual(cfg, { enabled: false, simulated: false, secid: '1.000001', pollMs: 5000, cooldownSec: 60, tradingHoursOnly: true });

  // Scenario 1: green -> red fires bull; first sample only sets baseline.
  {
    const events = [];
    const w = makeWatcher([{ pct: -0.2 }, { pct: -0.1 }, { pct: 0.15 }, { pct: 0.3 }], events);
    w.start();
    await w.tick(); // baseline green
    assert.strictEqual(events.length, 0);
    await w.tick(); // still green
    assert.strictEqual(events.length, 0);
    await w.tick(); // flip to red -> bull
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].kind, 'bull');
    w.stop();
  }

  // Scenario 2: red -> green fires bear.
  {
    const events = [];
    const w = makeWatcher([{ pct: 0.3 }, { pct: 0.05 }, { pct: -0.4 }], events);
    w.start();
    await w.tick();
    await w.tick();
    await w.tick();
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].kind, 'bear');
    w.stop();
  }

  // Scenario 3: rapid flip-flop suppressed by 60s cooldown, later flip fires.
  {
    const events = [];
    const w = makeWatcher([{ pct: 0.3 }, { pct: -0.4 }, { pct: 0.5 }], events);
    w.start();
    await w.tick(); // baseline red
    fakeNow += 10_000;
    await w.tick(); // flip green -> bear at t+10s
    assert.strictEqual(events.length, 1);
    fakeNow += 10_000;
    await w.tick(); // flip red again but within cooldown -> suppressed
    assert.strictEqual(events.length, 1);
    fakeNow += 50_000; // total 70s since last trigger
    await w.tick(); // no sign change (still red) -> nothing
    assert.strictEqual(events.length, 1);
    w.stop();
  }

  // Scenario 4: network failure must not flip the baseline or throw.
  {
    const events = [];
    let fail = false;
    const w = createMarketWatcher({
      getConfig: () => ({ enabled: true, pollMs: 2000, cooldownSec: 60 }),
      fetchQuote: async () => {
        if (fail) throw new Error('network down');
        return { pct: 0.2 };
      },
      onEvent: (kind) => events.push(kind),
      now,
      debugLogPath: path.join(__dirname, '..', 'tmp-market-test-debug.log')
    });
    w.start();
    await w.tick(); // baseline red
    fail = true;
    await w.tick(); // error swallowed
    fail = false;
    await w.tick(); // still red, no event
    assert.strictEqual(events.length, 0);
    w.stop();
  }

  // Scenario 5: disabled config never polls.
  {
    const events = [];
    const w = createMarketWatcher({
      getConfig: () => ({ enabled: false }),
      fetchQuote: async () => { throw new Error('should not fetch'); },
      onEvent: (kind) => events.push(kind),
      now,
      debugLogPath: path.join(__dirname, '..', 'tmp-market-test-debug.log')
    });
    w.start();
    await w.tick();
    assert.strictEqual(events.length, 0);
    w.stop();
  }

  // Scenario 6: simulated mode alternates bull/bear with no trading-hours gate.
  // fakeNow starts Monday 10:00 but sim must also work outside hours, so we
  // jump to Saturday to prove the gate is bypassed.
  {
    const savedNow = fakeNow;
    fakeNow = new Date(2026, 7, 22, 10, 0).getTime(); // 周六
    const events = [];
    const w = createMarketWatcher({
      getConfig: () => ({ enabled: true, simulated: true, pollMs: 2000, cooldownSec: 60 }),
      fetchQuote: async () => { throw new Error('sim must not hit the network'); },
      onEvent: (kind) => events.push({ kind, at: fakeNow }),
      now,
      debugLogPath: path.join(__dirname, '..', 'tmp-market-test-debug.log')
    });
    w.start();
    await w.tick(); // arm first flip + baseline (green)
    assert.strictEqual(events.length, 0);
    fakeNow += 90_000; // beyond max sim delay (60s cooldown + 8~25s)
    await w.tick(); // flip green->red: bull
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].kind, 'bull');
    fakeNow += 90_000;
    await w.tick(); // flip red->green: bear
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[1].kind, 'bear');
    w.stop();
    fakeNow = savedNow;
  }

  // Scenario 7: switching real -> simulated re-baselines (no spurious event).
  {
    const events = [];
    let simulated = false;
    const w = createMarketWatcher({
      getConfig: () => ({ enabled: true, simulated, pollMs: 2000, cooldownSec: 60 }),
      fetchQuote: async () => ({ pct: 0.4 }), // real market red
      onEvent: (kind) => events.push(kind),
      now,
      debugLogPath: path.join(__dirname, '..', 'tmp-market-test-debug.log')
    });
    w.start();
    await w.tick(); // baseline red
    simulated = true;
    await w.tick(); // enter sim: re-baseline, sim starts green — no event yet
    assert.strictEqual(events.length, 0);
    fakeNow += 90_000;
    await w.tick(); // sim flips green->red: bull
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0], 'bull');
    w.stop();
  }

  console.log('test-market-watch: all 7 scenarios passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
