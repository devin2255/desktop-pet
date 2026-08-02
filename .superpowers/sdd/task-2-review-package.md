# Review Package Task 2
Base: 0c654f055583f3df38070a87871822ace29f0877
Head: 95d2f5991432e044aaaa9e03272b4fa88ea7d5c0

## Commits
95d2f59 feat: support optional speechAudio on behavior items

## Stat
 scripts/test-interaction-controller.js           | 10 ++++++++-
 scripts/test-petpack-security.js                 | 26 +++++++++++++++++++++++-
 scripts/test-renderer-interaction.js             | 12 +++++++++++
 skills/desktop-pet-maker/scripts/petpack_tool.py | 13 ++++++++++++
 src/interaction-controller.js                    |  3 ++-
 src/main-v3.js                                   | 11 ++++++++--
 src/petpack-validator.js                         | 13 ++++++++++++
 src/renderer-v3.js                               | 13 +++++++-----
 8 files changed, 91 insertions(+), 10 deletions(-)

## Diff
```diff
diff --git a/scripts/test-interaction-controller.js b/scripts/test-interaction-controller.js
index a4476bf..231cf20 100644
--- a/scripts/test-interaction-controller.js
+++ b/scripts/test-interaction-controller.js
@@ -273,33 +273,41 @@ async function run() {
     harness.controller.moveDrag({ x: 120, y: 150 });
     assert.ok(harness.states.includes('drag-right'), 'dragging left faces right (butt-drag trail)');
     harness.controller.moveDrag({ x: 260, y: 150 });
     assert.strictEqual(harness.states.at(-1), 'drag-left', 'dragging right faces left (butt-drag trail)');
   }
 
   {
     const harness = createHarness({ windows: [target] });
     harness.manifest.behavior = {
       perched: [
-        { state: 'perch-swing', weight: 1, minDuration: 800, maxDuration: 800, message: '鍠? 鍐涘効鍚?' }
+        {
+          state: 'perch-swing',
+          weight: 1,
+          minDuration: 800,
+          maxDuration: 800,
+          message: '鍠? 鍐涘効鍚?',
+          speechAudio: 'audio/perch-swing.mp3'
+        }
       ]
     };
     harness.manifest.animations['perch-swing'] = { durations: [200, 200] };
     harness.manifest.animations['perch-action'] = { durations: [500] };
     await dragAndEnd(harness, { x: 350, y: 100 });
     assert.strictEqual(harness.controller.state(), 'perched');
     assert.ok(harness.clock.scheduledTimeoutDelays.includes(900), 'perched idle starts after a short settle');
     // Perched idle reschedules forever; only run settle + one action + return-to-perch.
     harness.clock.runTimeouts(3);
     assert.ok(harness.states.includes('perch-swing'), 'perched idle can play configured sitting actions');
     const perchedSignal = harness.stateSignals.find((item) => item?.logicalRole === 'perch-swing');
     assert.strictEqual(perchedSignal?.message, '鍠? 鍐涘効鍚?', 'perched idle can show a dialogue bubble');
+    assert.strictEqual(perchedSignal?.speechAudio, 'audio/perch-swing.mp3', 'perched idle forwards speechAudio');
     assert.strictEqual(harness.controller.state(), 'perched', 'perched idle must not detach from the window');
     harness.controller.dispose();
   }
 
   {
     const harness = createHarness({ windows: [target] });
     await dragAndEnd(harness, { x: 350, y: 100 });
     assert.strictEqual(harness.controller.state(), 'perched');
     assert.deepStrictEqual(harness.states.slice(-1), ['perch']);
   }
diff --git a/scripts/test-petpack-security.js b/scripts/test-petpack-security.js
index d015de2..033fd1f 100644
--- a/scripts/test-petpack-security.js
+++ b/scripts/test-petpack-security.js
@@ -1,18 +1,18 @@
 'use strict';
 
 const assert = require('assert');
 const fs = require('fs');
 const os = require('os');
 const path = require('path');
 const AdmZip = require('adm-zip');
-const { safeRelative, validateManifest, validatePetpack } = require('../src/petpack-validator');
+const { referencedFiles, safeRelative, validateManifest, validatePetpack } = require('../src/petpack-validator');
 
 const fixture = path.join(__dirname, '..', 'pets', 'packages', 'boss.petpack');
 assert.doesNotThrow(() => validatePetpack(fixture), 'reviewed demo package must validate');
 
 function assertRejected(name, mutate, expected) {
   const output = path.join(os.tmpdir(), `desktop-pet-${process.pid}-${name}.petpack`);
   const zip = new AdmZip(fixture);
   mutate(zip);
   zip.writeZip(output);
   try { assert.throws(() => validatePetpack(output), expected); }
@@ -64,11 +64,35 @@ delete manifest.animations.climb;
 manifest.interactionActions.drag.action = 'walk';
 
 manifest.behavior = {
   random: [{ state: 'sleep', weight: 1, minDuration: 600, maxDuration: 1000 }]
 };
 assert.doesNotThrow(
   () => validateManifest(manifest),
   'schema-v1 validators must continue accepting legacy random sleep entries'
 );
 
+manifest.behavior = {
+  random: [{
+    state: 'sit',
+    weight: 1,
+    minDuration: 600,
+    maxDuration: 1000,
+    speechAudio: 'audio/roam.mp3'
+  }]
+};
+assert.ok(referencedFiles(manifest).has('audio/roam.mp3'), 'behavior.random speechAudio must be referenced');
+assert.doesNotThrow(() => validateManifest(manifest));
+manifest.behavior.random[0].speechAudio = 'audio/roam.txt';
+assert.throws(() => validateManifest(manifest), /speechAudio/);
+manifest.behavior.random[0].speechAudio = 'audio/roam.mp3';
+manifest.behavior.perched = [{
+  state: 'sit',
+  weight: 1,
+  minDuration: 600,
+  maxDuration: 1000,
+  speechAudio: 'audio/perched.mp3'
+}];
+assert.ok(referencedFiles(manifest).has('audio/perched.mp3'), 'behavior.perched speechAudio must be referenced');
+assert.doesNotThrow(() => validateManifest(manifest));
+
 console.log('petpack archive security checks passed');
diff --git a/scripts/test-renderer-interaction.js b/scripts/test-renderer-interaction.js
index fe6acba..575cee2 100644
--- a/scripts/test-renderer-interaction.js
+++ b/scripts/test-renderer-interaction.js
@@ -182,20 +182,32 @@ assert.strictEqual(pet.className, 'pet state-reaction', 'repeated reactions must
 stateCallback({ state: 'reaction', message: '鐖革紒', speech: '鐖? });
 assert.deepStrictEqual(calls.spoken, [{
   text: '鐖?,
   voice: 'Microsoft Kangkang - Chinese (Simplified, PRC)',
   pitch: 1
 }], 'configured speech should use a male zh-CN voice when speechGender is male');
 
 stateCallback({ state: 'call-dad', message: '澶х埛!', speech: '澶х埛' });
 assert.deepStrictEqual(calls.audio, ['audio/call-dad.mp3'], 'bundled speechAudio should play instead of system TTS');
 
+stateCallback({
+  state: 'reaction',
+  message: '鑰佸叕鍠濊尪',
+  speech: '鑰佸叕鍠濊尪',
+  speechAudio: 'pet-asset://demo/audio/serve-tea.mp3'
+});
+assert.deepStrictEqual(
+  calls.audio.slice(-1),
+  ['pet-asset://demo/audio/serve-tea.mp3'],
+  'behavior speechAudio from pet:state should play instead of system TTS'
+);
+
 petImage.listeners.get('load')();
 assert.deepStrictEqual({ ...calls.insets.at(-1) }, {
   left: 20, top: 30, right: 20, bottom: 10
 });
 assert.strictEqual(
   bubble.style.getPropertyValue('--bubble-top'),
   '4px',
   'bubble sits 2px above the visible head when space allows (30 - 24 - 2)'
 );
 
diff --git a/skills/desktop-pet-maker/scripts/petpack_tool.py b/skills/desktop-pet-maker/scripts/petpack_tool.py
index a2f5600..c0c64e0 100644
--- a/skills/desktop-pet-maker/scripts/petpack_tool.py
+++ b/skills/desktop-pet-maker/scripts/petpack_tool.py
@@ -40,20 +40,26 @@ AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg"}
 
 def referenced_files(manifest: dict) -> set[str]:
     referenced = {"pet.json", safe_relative(str(manifest.get("preview", ""))).as_posix()}
     for config in manifest.get("animations", {}).values():
         if isinstance(config, dict):
             for frame in config.get("frames", []):
                 referenced.add(safe_relative(str(frame)).as_posix())
     for item in manifest.get("contextMenuActions") or []:
         if isinstance(item, dict) and item.get("speechAudio"):
             referenced.add(safe_relative(str(item["speechAudio"])).as_posix())
+    behavior_root = manifest.get("behavior")
+    if isinstance(behavior_root, dict):
+        for key in ("random", "perched"):
+            for item in behavior_root.get(key) or []:
+                if isinstance(item, dict) and item.get("speechAudio"):
+                    referenced.add(safe_relative(str(item["speechAudio"])).as_posix())
     return referenced
 
 
 def validate_manifest_shape(manifest: dict) -> list[str]:
     if manifest.get("schemaVersion") != 1:
         raise ValueError("schemaVersion must be 1")
     if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,47}", str(manifest.get("id", ""))):
         raise ValueError("invalid pet id")
     name = manifest.get("name")
     if not isinstance(name, str) or not name.strip() or len(name) > 80:
@@ -203,20 +209,27 @@ def validate_manifest_shape(manifest: dict) -> list[str]:
                 or isinstance(maximum, bool)
                 or minimum < 600
                 or maximum > 60000
                 or maximum < minimum
             ):
                 raise ValueError(f"{label} duration is invalid")
             if "message" in item and (not isinstance(item["message"], str) or len(item["message"]) > 80):
                 raise ValueError(f"{label} message must be a string up to 80 characters")
             if "speech" in item and (not isinstance(item["speech"], str) or len(item["speech"]) > 20):
                 raise ValueError(f"{label} speech must be a string up to 20 characters")
+            if "speechAudio" in item:
+                audio = item["speechAudio"]
+                if not isinstance(audio, str) or not audio.strip():
+                    raise ValueError(f"{label} speechAudio must be a non-empty path")
+                audio_path = safe_relative(audio)
+                if audio_path.suffix.lower() not in AUDIO_EXTENSIONS:
+                    raise ValueError(f"{label} speechAudio must be mp3/wav/ogg")
 
     behavior_root = manifest.get("behavior", {})
     if isinstance(behavior_root, dict):
         if behavior_root.get("random") is not None:
             validate_behavior_list(behavior_root.get("random"), "behavior.random")
         if behavior_root.get("perched") is not None:
             validate_behavior_list(behavior_root.get("perched"), "behavior.perched")
     return frame_paths
 
 
diff --git a/src/interaction-controller.js b/src/interaction-controller.js
index 3bcab3c..9bff1cd 100644
--- a/src/interaction-controller.js
+++ b/src/interaction-controller.js
@@ -218,21 +218,22 @@ function createInteractionController(dependencies) {
       if (disposed || generation !== token || currentState !== 'perched') return;
       const choice = pickWeighted(choices);
       if (!choice) return;
       const playMs = Math.max(
         600,
         Number(choice.minDuration) + Math.random() * Math.max(0, Number(choice.maxDuration) - Number(choice.minDuration))
       );
       // Keep controller state as perched for attachment; only swap the visible action.
       emitRole(choice.state, {
         message: typeof choice.message === 'string' ? choice.message : '',
-        speech: typeof choice.speech === 'string' ? choice.speech : ''
+        speech: typeof choice.speech === 'string' ? choice.speech : '',
+        speechAudio: typeof choice.speechAudio === 'string' ? choice.speechAudio : ''
       });
       perchedIdleTimer = setTimeoutFn(() => {
         perchedIdleTimer = undefined;
         if (disposed || generation !== token || currentState !== 'perched') return;
         emitRole('perch');
         schedulePerchedIdle();
       }, playMs);
     }, wait);
   }
 
diff --git a/src/main-v3.js b/src/main-v3.js
index 33b421b..47faad0 100644
--- a/src/main-v3.js
+++ b/src/main-v3.js
@@ -248,21 +248,25 @@ function clampPosition(x, y, width = currentSize().width, height = currentSize()
   const workArea = getWorkAreaForBounds();
   return {
     x: Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - width)),
     y: Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - height))
   };
 }
 
 function sendState(state, message = '', speech = '', logicalRole = state, options) {
   if (!petWindow || petWindow.isDestroyed()) return;
   if (shouldRestoreWindowBounds(options)) restorePetWindowSize();
-  petWindow.webContents.send('pet:state', { state, logicalRole, message, speech });
+  let speechAudio = typeof options?.speechAudio === 'string' ? options.speechAudio : '';
+  if (speechAudio && !speechAudio.startsWith('pet-asset:') && activeManifest) {
+    speechAudio = petAssetUrl(activeManifest.id, speechAudio);
+  }
+  petWindow.webContents.send('pet:state', { state, logicalRole, message, speech, speechAudio });
 }
 
 function setMouseThrough(ignore) {
   if (!petWindow || petWindow.isDestroyed() || mouseThrough === ignore) return;
   mouseThrough = ignore;
   petWindow.setIgnoreMouseEvents(ignore, { forward: true });
 }
 
 function stopWalk() {
   if (walkTimer) clearInterval(walkTimer);
@@ -343,21 +347,24 @@ function runBehavior() {
     const workArea = getWorkAreaForBounds(bounds);
     const delta = Math.round((Math.random() * 2 - 1) * Math.min(300, workArea.width * 0.22));
     walkTo(Math.max(workArea.x, Math.min(workArea.x + workArea.width - bounds.width, bounds.x + delta)));
     return;
   }
   const fallbackMessages = { sit: '鎴戝氨鍦ㄨ繖閲岄櫔浣犮€?, reaction: '鍒蛋澶繙鈥︹€?, sleep: 'z Z' };
   const message = typeof behavior.message === 'string' && behavior.message
     ? behavior.message
     : (fallbackMessages[behavior.state] || '');
   const speech = typeof behavior.speech === 'string' ? behavior.speech : '';
-  sendState(behavior.state, message, speech);
+  const speechAudio = typeof behavior.speechAudio === 'string' && behavior.speechAudio
+    ? petAssetUrl(activeManifest.id, behavior.speechAudio)
+    : '';
+  sendState(behavior.state, message, speech, behavior.state, { speechAudio });
   scheduleBehavior(duration);
 }
 
 function setPetSize(nextKey) {
   if (!PET_SIZES[nextKey] || !petWindow || (interaction && interaction.state() !== 'normal')) return;
   const old = petWindow.getBounds();
   settings.sizeKey = nextKey;
   saveSettings();
   const next = currentSize();
   const position = clampPosition(old.x + Math.round((old.width - next.width) / 2), old.y + old.height - next.height, next.width, next.height);
diff --git a/src/petpack-validator.js b/src/petpack-validator.js
index 782d8df..ebd238b 100644
--- a/src/petpack-validator.js
+++ b/src/petpack-validator.js
@@ -42,20 +42,26 @@ function resolveInside(root, relative) {
 const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg']);
 
 function referencedFiles(manifest) {
   const referenced = new Set(['pet.json', manifest.preview]);
   for (const animation of Object.values(manifest.animations || {})) {
     for (const frame of animation.frames || []) referenced.add(frame);
   }
   for (const item of manifest.contextMenuActions || []) {
     if (item && typeof item.speechAudio === 'string' && item.speechAudio) referenced.add(item.speechAudio);
   }
+  for (const list of [manifest.behavior?.random, manifest.behavior?.perched]) {
+    if (!Array.isArray(list)) continue;
+    for (const item of list) {
+      if (item && typeof item.speechAudio === 'string' && item.speechAudio) referenced.add(item.speechAudio);
+    }
+  }
   return referenced;
 }
 
 function validateManifest(manifest, root = '', requireFiles = false) {
   if (!manifest || manifest.schemaVersion !== 1) throw new Error('鍙敮鎸?schemaVersion 1');
   if (!PET_ID_PATTERN.test(String(manifest.id || ''))) throw new Error('瀹犵墿 id 涓嶅悎娉?);
   if (typeof manifest.name !== 'string' || !manifest.name.trim() || manifest.name.length > 80) {
     throw new Error('瀹犵墿鍚嶇О闀垮害蹇呴』涓?1 鍒?80 涓瓧绗?);
   }
   if (manifest.description !== undefined && (typeof manifest.description !== 'string' || manifest.description.length > 500)) {
@@ -177,20 +183,27 @@ function validateManifest(manifest, root = '', requireFiles = false) {
       if (!Number.isFinite(item.weight) || item.weight <= 0 || item.weight > 10000) throw new Error(`${label} weight 涓嶅悎娉昤);
       if (!Number.isFinite(item.minDuration) || !Number.isFinite(item.maxDuration) || item.minDuration < 600 || item.maxDuration > 60000 || item.maxDuration < item.minDuration) {
         throw new Error(`${label} duration 涓嶅悎娉昤);
       }
       if (item.message !== undefined && (typeof item.message !== 'string' || item.message.length > 80)) {
         throw new Error(`${label} message 涓嶈兘瓒呰繃 80 涓瓧绗);
       }
       if (item.speech !== undefined && (typeof item.speech !== 'string' || item.speech.length > 20)) {
         throw new Error(`${label} speech 涓嶈兘瓒呰繃 20 涓瓧绗);
       }
+      if (item.speechAudio !== undefined) {
+        if (typeof item.speechAudio !== 'string' || !item.speechAudio) throw new Error(`${label} speechAudio 璺緞涓嶅悎娉昤);
+        safeRelative(item.speechAudio);
+        if (!AUDIO_EXTENSIONS.has(path.posix.extname(item.speechAudio).toLowerCase())) {
+          throw new Error(`${label} speechAudio 鍙敮鎸?mp3/wav/ogg`);
+        }
+      }
     }
   }
 
   if (manifest.behavior?.random !== undefined) {
     validateBehaviorList(manifest.behavior.random, 'behavior.random');
   }
   if (manifest.behavior?.perched !== undefined) {
     validateBehaviorList(manifest.behavior.perched, 'behavior.perched');
   }
 
diff --git a/src/renderer-v3.js b/src/renderer-v3.js
index 64a506d..b2b2aa4 100644
--- a/src/renderer-v3.js
+++ b/src/renderer-v3.js
@@ -179,47 +179,49 @@ function speak(text, audioUrl = '') {
       utterance.voice = lateVoice;
       utterance.lang = lateVoice.lang || 'zh-CN';
       if (gender === 'male' && MALE_VOICE_RE.test(lateVoice.name)) utterance.pitch = 1;
     }
     start();
   };
   window.speechSynthesis.addEventListener('voiceschanged', retry, { once: true });
   setTimeout(retry, 250);
 }
 
-function setState(state, message = '', speech = '', logicalRole) {
-  pendingState = { state, message, speech, logicalRole };
+function setState(state, message = '', speech = '', logicalRole, speechAudio = '') {
+  pendingState = { state, message, speech, logicalRole, speechAudio };
   pet.className = `pet state-${state}${pointerDown ? ' dragging' : ''}`;
   if (!manifest) return;
   playAnimation(state, logicalRole);
   if (message) {
     const bubbleMs = state === 'sleep'
       ? 4200
       : baseActionName(state).startsWith('perch-')
         ? 4800
         : 2400;
     showBubble(message, bubbleMs);
   }
-  if (speech || resolveSpeechAudio(state)) speak(speech, resolveSpeechAudio(state));
+  const audio = speechAudio || resolveSpeechAudio(state);
+  if (speech || audio) speak(speech, audio);
 }
 
 function loadPet(nextManifest) {
   manifest = nextManifest;
   petImage.crossOrigin = 'anonymous';
   petImage.alt = `${manifest.name}妗岄潰瀹犵墿`;
   petImage.classList.remove('ready');
   preloadFrames();
   setState(
     pendingState.state || 'idle',
     pendingState.message || '',
     pendingState.speech || '',
-    pendingState.logicalRole
+    pendingState.logicalRole,
+    pendingState.speechAudio || ''
   );
 }
 
 function scanVisibleInsets() {
   const { width, height } = hitCanvas;
   const data = hitContext.getImageData(0, 0, width, height).data;
   let minX = width;
   let minY = height;
   let maxX = -1;
   let maxY = -1;
@@ -372,12 +374,13 @@ pet.addEventListener('pointercancel', (event) => {
   pointerDown = undefined;
   pet.classList.remove('dragging');
   if (dragged) window.petApi.endDrag({ screenX: event.screenX, screenY: event.screenY });
 });
 pet.addEventListener('contextmenu', (event) => {
   event.preventDefault();
   window.petApi.openMenu();
 });
 
 window.petApi.onLoad(loadPet);
-window.petApi.onState(({ state, message, speech, logicalRole }) => setState(state, message, speech, logicalRole));
+window.petApi.onState(({ state, message, speech, logicalRole, speechAudio }) =>
+  setState(state, message, speech, logicalRole, speechAudio || ''));
 window.petApi.getCurrentPet().then(loadPet);

```
