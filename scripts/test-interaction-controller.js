#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  createInteractionController,
  shouldRestoreWindowBounds
} = require('../src/interaction-controller');

function createClock() {
  let nextId = 1;
  let currentTime = 0;
  const frames = new Map();
  const timeouts = new Map();
  const intervals = new Map();
  const scheduledTimeoutDelays = [];

  return {
    now: () => currentTime,
    scheduleFrame(callback) {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    },
    cancelFrame(id) {
      frames.delete(id);
    },
    setTimeout(callback, delay) {
      const id = nextId++;
      const normalizedDelay = Math.max(0, Number(delay) || 0);
      scheduledTimeoutDelays.push(normalizedDelay);
      timeouts.set(id, { callback, due: currentTime + normalizedDelay });
      return id;
    },
    clearTimeout(id) {
      timeouts.delete(id);
    },
    setInterval(callback, delay) {
      const id = nextId++;
      intervals.set(id, { callback, delay });
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    flushAnimationFrames(limit = 1000) {
      let count = 0;
      while (frames.size) {
        if (count++ >= limit) throw new Error('animation frame loop did not settle');
        const pending = [...frames.values()];
        frames.clear();
        currentTime += 16;
        for (const callback of pending) callback(currentTime);
      }
    },
    flushTimeouts(limit = 1000) {
      let count = 0;
      while (timeouts.size) {
        if (count++ >= limit) throw new Error('timeout loop did not settle');
        const [id, task] = [...timeouts.entries()].sort((left, right) => left[1].due - right[1].due)[0];
        timeouts.delete(id);
        currentTime = Math.max(currentTime, task.due);
        task.callback();
      }
    },
    async tickIntervals() {
      for (const task of [...intervals.values()]) await task.callback();
    },
    pending() {
      return { frames: frames.size, timeouts: timeouts.size, intervals: intervals.size };
    },
    intervalDelays() {
      return [...intervals.values()].map((task) => task.delay);
    },
    scheduledTimeoutDelays
  };
}

function createHarness({
  windows = [],
  rejectDiscovery = false,
  autoAnimate = true,
  simulateMainRestore = false,
  initialBounds = { x: 200, y: 150, width: 100, height: 120 }
} = {}) {
  const clock = createClock();
  const states = [];
  const stateSignals = [];
  const setBoundsCalls = [];
  let topmostEnsures = 0;
  const behavior = { paused: 0, resumed: 0, walkTimer: null, behaviorTimer: null };
  let windowBounds = { ...initialBounds };
  const discovery = {
    windows,
    calls: 0,
    async list() {
      this.calls += 1;
      if (rejectDiscovery) throw new Error('discovery unavailable');
      return this.windows;
    }
  };
  const display = {
    id: 'display-1',
    bounds: { x: 0, y: 0, width: 800, height: 600 },
    workArea: { x: 0, y: 40, width: 800, height: 520 }
  };
  const petWindow = {
    getBounds: () => ({ ...windowBounds }),
    setBounds(next) {
      windowBounds = { ...next };
      setBoundsCalls.push({ ...next });
    },
    isDestroyed: () => false
  };
  const manifest = {
    interactionActions: {
      climb: { action: 'climb-action', anchor: { x: 0.5, y: 0.5 } },
      perch: { action: 'perch-action', anchor: { x: 0.5, y: 0.7 } },
      hang: { action: 'hang-action', anchor: { x: 0.5, y: 0.1 } },
      impact: { action: 'impact-action' },
      recover: { action: 'recover-action' }
    },
    animations: {
      'climb-action': { durations: [120, 180] },
      'perch-action': { durations: [500] },
      'hang-action': { durations: [500] },
      'impact-action': { durations: [140, 160] },
      'recover-action': { durations: [200, 220] },
      reaction: { durations: [100] }
    }
  };
  const dependencies = {
    window: petWindow,
    discovery,
    screen: {
      getDisplayNearestPoint: () => display
    },
    getCurrentSize: () => ({ width: 100, height: 120 }),
    getManifest: () => manifest,
    sendState(state, options) {
      states.push(state);
      stateSignals.push(options);
      if (!simulateMainRestore || state !== 'normal' || !shouldRestoreWindowBounds(options)) return;
      const size = { width: 100, height: 120 };
      const workArea = display.workArea;
      windowBounds = {
        x: Math.max(workArea.x, Math.min(
          windowBounds.x,
          workArea.x + workArea.width - size.width
        )),
        y: Math.max(workArea.y, Math.min(
          windowBounds.y,
          workArea.y + workArea.height - size.height
        )),
        ...size
      };
    },
    pauseBehavior() {
      behavior.paused += 1;
      if (behavior.walkTimer) clock.clearInterval(behavior.walkTimer);
      if (behavior.behaviorTimer) clock.clearTimeout(behavior.behaviorTimer);
      behavior.walkTimer = null;
      behavior.behaviorTimer = null;
    },
    ensureOnTop: () => { topmostEnsures += 1; },
    resumeBehavior: () => { behavior.resumed += 1; },
    scheduleFrame: clock.scheduleFrame,
    cancelFrame: clock.cancelFrame,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    now: clock.now
  };
  const climbs = [];
  if (autoAnimate) {
    dependencies.animatePosition = async ({ from, to, duration, setPosition }) => {
      climbs.push({ from, to, duration });
      setPosition(to);
    };
  }
  const controller = createInteractionController(dependencies);
  return {
    behavior,
    clock,
    climbs,
    controller,
    dependencies,
    discovery,
    display,
    manifest,
    petWindow,
    setBoundsCalls,
    states,
    stateSignals,
    topmostEnsures: () => topmostEnsures,
    bounds: () => ({ ...windowBounds })
  };
}

async function dragAndEnd(harness, pointer) {
  harness.controller.startDrag({ x: 200, y: 150 });
  await harness.controller.endDrag(pointer);
}

async function run() {
  const target = { id: 'w1', bounds: { x: 100, y: 100, width: 500, height: 400 } };

  {
    assert.strictEqual(typeof shouldRestoreWindowBounds, 'function');
    assert.strictEqual(shouldRestoreWindowBounds(), true, 'legacy state sends retain size restoration');
    assert.strictEqual(
      shouldRestoreWindowBounds({ preserveBounds: true }),
      false,
      'controller-owned state sends preserve controller geometry'
    );
  }

  {
    const harness = createHarness({ windows: [target] });
    harness.controller.startDrag({ x: 200, y: 150 });
    assert.deepStrictEqual(harness.states, ['drag']);
    assert.strictEqual(harness.topmostEnsures(), 1, 'drag state reasserts topmost ordering');
    await harness.controller.endDrag({ x: 100, y: 250 });
    assert.deepStrictEqual(harness.states.slice(-2), ['climb', 'perch']);
    assert.strictEqual(harness.controller.state(), 'perched');
    assert.strictEqual(harness.climbs[0].duration, 300);
    assert.deepStrictEqual(harness.clock.intervalDelays(), [100]);
  }

  {
    const harness = createHarness({ windows: [target] });
    await dragAndEnd(harness, { x: 350, y: 100 });
    assert.strictEqual(harness.controller.state(), 'perched');
    assert.deepStrictEqual(harness.states.slice(-1), ['perch']);
  }

  {
    const harness = createHarness({ windows: [target] });
    await dragAndEnd(harness, { x: 350, y: 499 });
    assert.strictEqual(harness.controller.state(), 'hanging');
    assert.deepStrictEqual(harness.states.slice(-1), ['hang']);
  }

  {
    const harness = createHarness({ windows: [target] });
    await dragAndEnd(harness, { x: 350, y: 300 });
    assert.strictEqual(harness.controller.state(), 'normal');
    assert.deepStrictEqual(harness.states.slice(-1), ['normal']);
    assert.strictEqual(harness.clock.pending().intervals, 0);
  }

  {
    const harness = createHarness({ windows: [target] });
    harness.controller.updateVisibleInsets({ left: 10, top: 20, right: 10, bottom: 0 });
    harness.controller.startDrag({ x: 200, y: 150 });
    harness.controller.moveDrag({ x: 200, y: -100 });
    assert.strictEqual(harness.bounds().y, -20, 'dragging uses full display bounds and visible top');
    assert.strictEqual(harness.bounds().width, 100);
    assert.strictEqual(harness.bounds().height, 120);
  }

  for (const topInset of [20, 60, 100]) {
    const harness = createHarness({
      initialBounds: { x: 200, y: 150, width: 100, height: 120 }
    });
    harness.controller.updateVisibleInsets({ left: 0, top: topInset, right: 0, bottom: 0 });
    harness.controller.startDrag({ x: 200, y: 150 });
    harness.controller.moveDrag({ x: 200, y: 0 });
    assert.strictEqual(
      harness.bounds().y + topInset,
      harness.display.bounds.y,
      `top-band dragging snaps the visible top for inset ${topInset}`
    );
  }

  {
    const harness = createHarness({
      initialBounds: { x: 200, y: 150, width: 100, height: 120 }
    });
    harness.controller.updateVisibleInsets({ left: 0, top: 20, right: 0, bottom: 0 });
    harness.controller.startDrag({ x: 200, y: 150 });
    harness.controller.moveDrag({ x: 200, y: 0 });
    harness.controller.updateVisibleInsets({ left: 0, top: 60, right: 0, bottom: 0 });
    assert.strictEqual(
      harness.bounds().y + 60,
      harness.display.bounds.y,
      'a drag-frame inset change preserves the snapped visible top'
    );
  }

  {
    const harness = createHarness({
      initialBounds: { x: 200, y: 150, width: 100, height: 120 }
    });
    harness.controller.updateVisibleInsets({ left: 0, top: 60, right: 0, bottom: 0 });
    harness.controller.startDrag({ x: 200, y: 150 });
    harness.controller.moveDrag({ x: 200, y: 0 });
    await harness.controller.endDrag({ x: 200, y: 0 });
    assert.strictEqual(harness.controller.state(), 'falling', 'top-snapped release without a target falls');
    assert.deepStrictEqual(harness.states.slice(-1), ['fall']);
  }

  {
    const topWindow = { id: 'w-top-priority', bounds: { x: 100, y: 0, width: 500, height: 400 } };
    const harness = createHarness({
      windows: [topWindow],
      initialBounds: { x: 200, y: 150, width: 100, height: 120 }
    });
    harness.controller.updateVisibleInsets({ left: 0, top: 60, right: 0, bottom: 0 });
    harness.controller.startDrag({ x: 200, y: 150 });
    harness.controller.moveDrag({ x: 350, y: 0 });
    await harness.controller.endDrag({ x: 350, y: 0 });
    assert.strictEqual(harness.controller.state(), 'perched', 'window target wins over a top-snapped fall');
    assert.ok(!harness.states.includes('fall'));
  }

  {
    const maximizedWindow = {
      id: 'w-maximized',
      bounds: { x: 0, y: 8, width: 800, height: 592 }
    };
    const harness = createHarness({
      windows: [maximizedWindow],
      initialBounds: { x: 200, y: 150, width: 100, height: 120 }
    });
    harness.controller.updateVisibleInsets({ left: 0, top: 60, right: 0, bottom: 0 });
    harness.controller.startDrag({ x: 200, y: 150 });
    harness.controller.moveDrag({ x: 350, y: 0 });
    await harness.controller.endDrag({ x: 350, y: 0 });
    assert.strictEqual(
      harness.controller.state(),
      'perched',
      'a maximized window whose reported top starts inside the hidden resize border wins over screen-top fall'
    );
    assert.ok(!harness.states.includes('fall'));
  }

  {
    const harness = createHarness({
      initialBounds: { x: 200, y: 150, width: 100, height: 120 }
    });
    harness.controller.updateVisibleInsets({ left: 0, top: 60, right: 0, bottom: 0 });
    harness.controller.startDrag({ x: 200, y: 150 });
    harness.controller.moveDrag({ x: 200, y: 0 });
    harness.controller.moveDrag({ x: 200, y: 7 });
    await harness.controller.endDrag({ x: 200, y: 7 });
    assert.strictEqual(harness.controller.state(), 'normal', 'leaving the 6 DIP top band clears top snap');
    assert.ok(!harness.states.includes('fall'));
  }

  {
    const harness = createHarness({
      initialBounds: { x: 200, y: 150, width: 100, height: 120 }
    });
    harness.controller.updateVisibleInsets({ left: 0, top: 60, right: 0, bottom: 0 });
    harness.controller.startDrag({ x: 200, y: 250 });
    harness.controller.moveDrag({ x: 200, y: 0 });
    harness.controller.moveDrag({ x: 200, y: 7 });
    assert.strictEqual(
      harness.bounds().y + 60,
      harness.display.bounds.y,
      'visible bounds may remain clamped at the top after the pointer leaves the band'
    );
    await harness.controller.endDrag({ x: 200, y: 7 });
    assert.strictEqual(
      harness.controller.state(),
      'normal',
      'pointer position prevents a stale visible-top fallback from falling outside the band'
    );
    assert.ok(!harness.states.includes('fall'));
  }

  {
    const harness = createHarness({
      rejectDiscovery: true,
      initialBounds: { x: 200, y: 150, width: 100, height: 120 }
    });
    harness.controller.updateVisibleInsets({ left: 0, top: 60, right: 0, bottom: 0 });
    harness.controller.startDrag({ x: 200, y: 150 });
    harness.controller.moveDrag({ x: 200, y: 0 });
    await harness.controller.endDrag({ x: 200, y: 0 });
    assert.strictEqual(
      harness.controller.state(),
      'falling',
      'a top-snapped release still falls when target discovery is unavailable'
    );
    assert.deepStrictEqual(harness.states.slice(-1), ['fall']);
  }

  {
    const topWindow = { id: 'w-top', bounds: { x: 100, y: 0, width: 500, height: 400 } };
    const harness = createHarness({
      windows: [topWindow],
      initialBounds: { x: 300, y: -60, width: 100, height: 120 }
    });
    harness.controller.updateVisibleInsets({ left: 0, top: 60, right: 0, bottom: 0 });
    await dragAndEnd(harness, { x: 350, y: 0 });
    assert.strictEqual(harness.controller.state(), 'perched', 'window hit wins over screen-top fall');
    assert.ok(!harness.states.includes('fall'));
  }

  {
    const movingTarget = { id: 'w1', bounds: { ...target.bounds } };
    const harness = createHarness({ windows: [movingTarget] });
    await dragAndEnd(harness, { x: 350, y: 100 });
    const attached = harness.bounds();
    assert.strictEqual(harness.discovery.calls, 1, 'drag end discovers windows exactly once');
    harness.controller.updateVisibleInsets({ left: 5, top: 10, right: 5, bottom: 0 });
    assert.strictEqual(harness.discovery.calls, 1, 'frame inset updates reuse cached target bounds');
    assert.notDeepStrictEqual(harness.bounds(), attached, 'frame inset updates realign the attachment');
    const insetAdjusted = harness.bounds();
    movingTarget.bounds = { x: 170, y: 145, width: 500, height: 400 };
    await harness.clock.tickIntervals();
    assert.notDeepStrictEqual(harness.bounds(), insetAdjusted, 'attached pet follows target movement');
    assert.strictEqual(harness.discovery.calls, 2);
  }

  {
    const movingTarget = { id: 'w1', bounds: { ...target.bounds } };
    const harness = createHarness({ windows: [movingTarget] });
    await dragAndEnd(harness, { x: 350, y: 499 });
    movingTarget.minimized = true;
    await harness.clock.tickIntervals();
    assert.strictEqual(harness.controller.state(), 'falling');
    assert.deepStrictEqual(harness.states.slice(-1), ['fall']);
  }

  {
    const movingTarget = { id: 'w1', bounds: { ...target.bounds } };
    const harness = createHarness({ windows: [movingTarget] });
    await dragAndEnd(harness, { x: 350, y: 100 });
    harness.discovery.windows = [];
    await harness.clock.tickIntervals();
    assert.strictEqual(harness.controller.state(), 'falling');
  }

  {
    const harness = createHarness({ windows: [target] });
    harness.manifest.interactionActions.hang.anchor.y = 0;
    harness.controller.updateVisibleInsets({ left: 10, top: 20, right: 10, bottom: 0 });
    await dragAndEnd(harness, { x: 350, y: 499 });
    assert.strictEqual(
      harness.bounds().y + 20,
      target.bounds.y + target.bounds.height,
      'the topmost visible hang pixels (the hands) touch the window bottom edge'
    );
  }

  {
    const harness = createHarness({ windows: [target] });
    await dragAndEnd(harness, { x: 350, y: 100 });
    harness.controller.startDrag({ x: 350, y: 100 });
    assert.strictEqual(harness.controller.state(), 'dragging');
    assert.deepStrictEqual(harness.states.slice(-1), ['drag']);
    assert.strictEqual(harness.clock.pending().intervals, 0);
    assert.ok(!harness.states.includes('fall'));
  }

  {
    const firstTarget = { id: 'old-target', bounds: { ...target.bounds } };
    const secondTarget = {
      id: 'fresh-target',
      bounds: { x: 180, y: 80, width: 420, height: 360 }
    };
    const harness = createHarness({ windows: [firstTarget] });
    let resolveStalePoll;
    harness.discovery.list = async function list() {
      this.calls += 1;
      if (this.calls === 2) {
        return new Promise((resolve) => { resolveStalePoll = resolve; });
      }
      return this.windows;
    };
    await dragAndEnd(harness, { x: 350, y: 100 });
    const stalePoll = harness.clock.tickIntervals();
    await Promise.resolve();
    assert.ok(resolveStalePoll, 'the old attachment poll is in flight');

    harness.controller.startDrag({ x: 350, y: 100 });
    harness.discovery.windows = [secondTarget];
    await harness.controller.endDrag({ x: 390, y: 80 });
    const freshBounds = harness.bounds();
    const statesBeforeStaleResolution = [...harness.states];

    resolveStalePoll([]);
    await stalePoll;
    assert.strictEqual(harness.controller.state(), 'perched');
    assert.deepStrictEqual(harness.bounds(), freshBounds, 'stale poll cannot move the fresh attachment');
    assert.deepStrictEqual(
      harness.states,
      statesBeforeStaleResolution,
      'stale poll cannot transition the fresh attachment to fall'
    );
  }

  {
    const harness = createHarness({
      rejectDiscovery: true,
      initialBounds: { x: 450, y: -60, width: 100, height: 120 }
    });
    harness.controller.updateVisibleInsets({ left: 0, top: 60, right: 0, bottom: 0 });
    await dragAndEnd(harness, { x: 500, y: 0 });
    assert.strictEqual(harness.controller.state(), 'normal');
    assert.deepStrictEqual(harness.states.slice(-1), ['normal']);
  }

  {
    const harness = createHarness({
      simulateMainRestore: true,
      initialBounds: { x: 450, y: -60, width: 100, height: 120 }
    });
    harness.controller.updateVisibleInsets({ left: 0, top: 60, right: 0, bottom: 0 });
    harness.controller.startDrag({ x: 500, y: 0 });
    harness.discovery.windows = [];
    await harness.controller.endDrag({ x: 500, y: 0 });
    harness.clock.flushAnimationFrames();
    harness.clock.flushTimeouts();
    assert.deepStrictEqual(harness.states.slice(-4), ['fall', 'impact', 'recover', 'normal']);
    assert.deepStrictEqual(harness.bounds(), { x: 686, y: 446, width: 100, height: 120 });
    assert.ok(
      harness.stateSignals.slice(-4).every((options) => options?.preserveBounds === true),
      'all controller state transitions explicitly preserve controller-owned geometry'
    );
    assert.ok(harness.clock.scheduledTimeoutDelays.includes(300), 'impact uses manifest duration');
    assert.ok(harness.clock.scheduledTimeoutDelays.includes(420), 'recover uses manifest duration');
  }

  {
    const harness = createHarness({
      initialBounds: { x: 450, y: -53, width: 100, height: 120 }
    });
    harness.controller.updateVisibleInsets({ left: 0, top: 60, right: 0, bottom: 0 });
    await dragAndEnd(harness, { x: 500, y: 7 });
    assert.strictEqual(harness.controller.state(), 'normal', 'visible top beyond 6 DIP does not fall');
  }

  {
    const harness = createHarness({
      windows: [target],
      autoAnimate: false
    });
    const endPromise = (async () => {
      harness.controller.startDrag({ x: 200, y: 150 });
      return harness.controller.endDrag({ x: 100, y: 250 });
    })();
    await Promise.resolve();
    await Promise.resolve();
    assert.ok(harness.clock.pending().frames > 0, 'climb owns an animation frame');
    harness.behavior.walkTimer = harness.clock.setInterval(() => {}, 16);
    harness.behavior.behaviorTimer = harness.clock.setTimeout(() => {}, 5000);
    harness.controller.dispose();
    assert.deepStrictEqual(harness.clock.pending(), { frames: 0, timeouts: 0, intervals: 0 });
    void endPromise;
  }

  {
    const harness = createHarness();
    harness.controller.detachAndFall('cleanup-test');
    assert.ok(harness.clock.pending().frames > 0);
    harness.controller.dispose();
    assert.deepStrictEqual(harness.clock.pending(), { frames: 0, timeouts: 0, intervals: 0 });
  }

  {
    const harness = createHarness();
    assert.strictEqual(harness.controller.updateVisibleInsets({ left: 0, top: 0, right: 99, bottom: 119 }), true);
    assert.strictEqual(harness.controller.updateVisibleInsets({ left: -1, top: 0, right: 0, bottom: 0 }), false);
    assert.strictEqual(harness.controller.updateVisibleInsets({ left: 0, top: 120, right: 0, bottom: 0 }), false);
  }

  {
    const projectRoot = path.resolve(__dirname, '..');
    const main = fs.readFileSync(path.join(projectRoot, 'src', 'main-v3.js'), 'utf8');
    const preload = fs.readFileSync(path.join(projectRoot, 'src', 'preload-v3.js'), 'utf8');
    const builder = fs.readFileSync(path.join(projectRoot, 'scripts', 'build-customer.js'), 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    const manifestTemplate = JSON.parse(fs.readFileSync(
      path.join(projectRoot, 'skills', 'desktop-pet-maker', 'assets', 'manifest-template.json'),
      'utf8'
    ));
    const sonPetManifest = JSON.parse(fs.readFileSync(
      path.join(projectRoot, 'pets', 'library', 'son-pet', 'pet.json'),
      'utf8'
    ));
    assert.match(main, /require\('\.\/window-discovery'\)/);
    assert.match(main, /require\('\.\/interaction-controller'\)/);
    assert.match(main, /shouldRestoreWindowBounds\(options\)/);
    assert.match(
      main,
      /sendState:\s*\(state,\s*options\)\s*=>\s*sendState\(state,\s*'',\s*'',\s*state,\s*options\)/
    );
    assert.match(main, /interactionActions:\s*manifest\.interactionActions\s*\|\|\s*\{\}/);
    const fallbackMatch = main.match(
      /const usable = filteredChoices\.length\s*\?\s*filteredChoices\s*:\s*\[([\s\S]*?)\];/
    );
    assert.ok(fallbackMatch, 'player exposes a generic random-behavior fallback');
    assert.doesNotMatch(
      fallbackMatch[1],
      /state:\s*['"]sleep['"]/,
      'player fallback must never schedule sleep'
    );
    const chooseBehaviorSource = main.match(
      /function chooseBehavior\(\) \{[\s\S]*?\n\}/
    );
    assert.ok(chooseBehaviorSource, 'player exposes chooseBehavior for runtime policy testing');
    const runtimePolicy = {
      result: null,
      Math: Object.create(Math)
    };
    runtimePolicy.Math.random = () => 0;
    vm.runInNewContext(
      `const activeManifest = {
        behavior: {
          random: [
            { state: 'sleep', weight: 100, minDuration: 600, maxDuration: 1000 },
            { state: 'reaction', weight: 1, minDuration: 600, maxDuration: 1000 }
          ]
        }
      };
      ${chooseBehaviorSource[0]}
      result = chooseBehavior();`,
      runtimePolicy
    );
    assert.strictEqual(
      runtimePolicy.result.state,
      'reaction',
      'runtime must defensively filter legacy random sleep entries before selection'
    );
    assert.ok(
      manifestTemplate.behavior.random.every((item) => item.state !== 'sleep'),
      'new pet manifests must never randomly schedule sleep'
    );
    for (const channel of ['pet:drag-start', 'pet:drag-move', 'pet:drag-end', 'pet:visible-insets']) {
      assert.match(main, new RegExp(`onTrusted\\('${channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
    }
    assert.match(preload, /endDrag:\s*\(position\)\s*=>\s*ipcRenderer\.send\('pet:drag-end',\s*position\)/);
    for (const file of [
      'src/window-interactions.js',
      'src/window-discovery.js',
      'src/interaction-controller.js'
    ]) {
      assert.ok(packageJson.build.files.includes(file), `default package includes ${file}`);
      assert.ok(builder.includes(`'${file}'`), `customer package includes ${file}`);
    }
    assert.ok(packageJson.dependencies['get-windows'], 'window discovery remains a production dependency');
    assert.strictEqual(
      sonPetManifest.interactionActions.hang.anchor.y,
      0,
      'son-pet aligns its visible hand line directly to the window bottom edge'
    );
  }

  assert.ok(true, 'top, bottom, side, center, priority, polling, fall, and cleanup checks completed');
  console.log('interaction controller checks passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
