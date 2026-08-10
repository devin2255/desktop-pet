# Review Package — Task 1
Base: 072527f00cdf6884ebbb87b56ff6e547ebe15c67 (branch start; no task commits — working tree diff)
Head: WORKING_TREE

## Status
 M package.json
?? scripts/test-sequence-controller.js
?? src/sequence-controller.js

## Diff stat
 package.json | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

## Full diff
```diff
diff --git a/package.json b/package.json
index 7337ff6..681b86c 100644
--- a/package.json
+++ b/package.json
@@ -10,7 +10,7 @@
   },
   "scripts": {
     "test": "npm run test:js && npm run test:python && npm run validate:demo",
-    "test:js": "node --check src/main-v3.js && node --check src/preload-v3.js && node --check src/renderer-v3.js && node --check src/petpack-validator.js && node --check src/startup-greeting.js && node --check src/window-discovery.js && node --check src/interaction-controller.js && node --check src/topmost-guard.js && node --check scripts/build-customer.js && node scripts/test-renderer-interaction.js && node scripts/test-petpack-security.js && node scripts/test-window-interactions.js && node scripts/test-window-discovery.js && node scripts/test-interaction-controller.js && node scripts/test-topmost-guard.js && node scripts/test-runtime-cdp-contract.js && node scripts/test-laopo-petpack.js && node scripts/test-startup-greeting.js",
+    "test:js": "node --check src/main-v3.js && node --check src/preload-v3.js && node --check src/renderer-v3.js && node --check src/petpack-validator.js && node --check src/startup-greeting.js && node --check src/window-discovery.js && node --check src/interaction-controller.js && node --check src/topmost-guard.js && node --check src/sequence-controller.js && node --check scripts/build-customer.js && node scripts/test-renderer-interaction.js && node scripts/test-petpack-security.js && node scripts/test-window-interactions.js && node scripts/test-window-discovery.js && node scripts/test-interaction-controller.js && node scripts/test-topmost-guard.js && node scripts/test-runtime-cdp-contract.js && node scripts/test-laopo-petpack.js && node scripts/test-startup-greeting.js && node scripts/test-sequence-controller.js",
     "test:python": "python -m unittest discover -s skills/desktop-pet-maker/scripts -p test_*.py -v",
     "test:regression": "node scripts/test-renderer-interaction.js && python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v",
     "validate:demo": "python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/laopo.petpack",
```
## Untracked new files as diff
```diff
--- /dev/null
+++ b/src/sequence-controller.js
+'use strict';
+
+function createSequenceController(deps) {
+  const getManifest = deps.getManifest;
+  const sendState = deps.sendState;
+  const pauseBehavior = deps.pauseBehavior || (() => {});
+  const scheduleBehavior = deps.scheduleBehavior || (() => {});
+  const setTimerFn = deps.setTimer || ((fn, ms) => setTimeout(fn, ms));
+  const clearTimerFn = deps.clearTimer || clearTimeout;
+
+  let active = false;
+  let stageIndex = 0;
+  let stages = [];
+  let waitingForClick = false;
+  let timerId = null;
+
+  function clearCurrentTimer() {
+    if (timerId != null) {
+      clearTimerFn(timerId);
+      timerId = null;
+    }
+  }
+
+  function buildExtras(stage) {
+    const extras = {};
+    if (stage.messages) {
+      extras.messages = stage.messages;
+    }
+    if (stage.messageGapMs != null) {
+      extras.messageGapMs = stage.messageGapMs;
+    }
+    return Object.keys(extras).length > 0 ? extras : undefined;
+  }
+
+  function resolveDuration(stage) {
+    if (stage.duration != null) {
+      return stage.duration;
+    }
+    return 3000;
+  }
+
+  function finishSequence() {
+    clearCurrentTimer();
+    waitingForClick = false;
+    active = false;
+    stages = [];
+    stageIndex = 0;
+    scheduleBehavior(900);
+  }
+
+  function advance() {
+    if (!active) {
+      return;
+    }
+    stageIndex += 1;
+    if (stageIndex >= stages.length) {
+      finishSequence();
+      return;
+    }
+    playStage(stageIndex);
+  }
+
+  function playStage(index) {
+    const stage = stages[index];
+    if (!stage) {
+      finishSequence();
+      return;
+    }
+
+    const message = stage.message != null
+      ? stage.message
+      : (stage.messages && stage.messages[0]) || '';
+    const extras = buildExtras(stage);
+    sendState(stage.action, message, '', extras);
+
+    if (stage.waitForClick) {
+      waitingForClick = true;
+      return;
+    }
+
+    waitingForClick = false;
+    const duration = resolveDuration(stage);
+
+    if (stage.action === 'idle' && duration === 0) {
+      advance();
+      return;
+    }
+
+    timerId = setTimerFn(() => {
+      timerId = null;
+      advance();
+    }, duration);
+  }
+
+  function validateSequence(id) {
+    const manifest = getManifest();
+    if (!manifest?.sequences?.[id]) {
+      return false;
+    }
+    const { stages: seqStages } = manifest.sequences[id];
+    if (!Array.isArray(seqStages) || seqStages.length === 0) {
+      return false;
+    }
+    const animations = manifest.animations || {};
+    return seqStages.every((stage) => stage.action && animations[stage.action]);
+  }
+
+  function cancel(options = {}) {
+    const shouldSchedule = options.schedule !== false;
+    clearCurrentTimer();
+    waitingForClick = false;
+    active = false;
+    stages = [];
+    stageIndex = 0;
+    sendState('idle');
+    if (shouldSchedule) {
+      scheduleBehavior(900);
+    }
+  }
+
+  function start(id) {
+    if (!validateSequence(id)) {
+      return false;
+    }
+    if (active) {
+      cancel({ schedule: false });
+    }
+    pauseBehavior();
+    stages = getManifest().sequences[id].stages;
+    stageIndex = 0;
+    active = true;
+    waitingForClick = false;
+    playStage(0);
+    return true;
+  }
+
+  function continueFromClick() {
+    if (!active || !waitingForClick) {
+      return false;
+    }
+    waitingForClick = false;
+    advance();
+    return true;
+  }
+
+  function dispose() {
+    cancel({ schedule: false });
+  }
+
+  return {
+    start,
+    cancel,
+    dispose,
+    continueFromClick,
+    isWaitingForClick: () => waitingForClick,
+    isActive: () => active
+  };
+}
+
+module.exports = { createSequenceController };
+

--- /dev/null
+++ b/scripts/test-sequence-controller.js
+'use strict';
+const assert = require('assert');
+const { createSequenceController } = require('../src/sequence-controller');
+
+const calls = { states: [], pause: 0, schedule: [] };
+let manifest = {
+  animations: {
+    idle: {}, a: {}, b: {}, c: {}
+  },
+  sequences: {
+    demo: {
+      stages: [
+        { action: 'a', message: 'one', duration: 100 },
+        { action: 'b', messages: ['x', 'y'], messageGapMs: 50, waitForClick: true },
+        { action: 'c', duration: 100 },
+        { action: 'idle', duration: 0 }
+      ]
+    }
+  }
+};
+
+const seq = createSequenceController({
+  getManifest: () => manifest,
+  sendState: (action, message, speech, extras) => {
+    calls.states.push({ action, message, speech, extras });
+  },
+  pauseBehavior: () => { calls.pause += 1; },
+  scheduleBehavior: (ms) => { calls.schedule.push(ms); },
+  now: () => calls.now || 0,
+  setTimer: (fn, ms) => {
+    calls.timer = { fn, ms };
+    return 1;
+  },
+  clearTimer: () => { calls.timer = null; }
+});
+
+assert.strictEqual(seq.start('demo'), true);
+assert.strictEqual(calls.pause, 1);
+assert.strictEqual(calls.states[0].action, 'a');
+assert.strictEqual(seq.isWaitingForClick(), false);
+
+// 推进到 waitForClick 阶段
+calls.timer.fn();
+assert.strictEqual(calls.states.at(-1).action, 'b');
+assert.deepStrictEqual(calls.states.at(-1).extras.messages, ['x', 'y']);
+assert.strictEqual(seq.isWaitingForClick(), true);
+
+// 等待点击时忽略自动 timer
+assert.strictEqual(seq.continueFromClick(), true);
+assert.strictEqual(calls.states.at(-1).action, 'c');
+assert.strictEqual(seq.isWaitingForClick(), false);
+
+calls.timer.fn(); // c 结束 -> idle
+assert.strictEqual(calls.states.at(-1).action, 'idle');
+assert.strictEqual(seq.isActive(), false);
+assert.ok(calls.schedule.length >= 1);
+
+// cancel 中断
+assert.strictEqual(seq.start('demo'), true);
+seq.cancel();
+assert.strictEqual(seq.isActive(), false);
+assert.strictEqual(calls.states.at(-1).action, 'idle');
+
+console.log('test-sequence-controller: ok');
+
```
