# Review Package Task 1
Base: 3efae57c7bb635d54ac7b9d30947c9ccc0e42524
Head: 0c654f055583f3df38070a87871822ace29f0877

## Commits
0c654f0 feat: support optional startupGreeting in pet manifests


## Stat
 package.json                                       |  3 +-
 scripts/test-startup-greeting.js                   | 46 ++++++++++++++++++++++
 .../desktop-pet-maker/references/petpack-schema.md |  1 +
 skills/desktop-pet-maker/scripts/petpack_tool.py   |  5 +++
 src/main-v3.js                                     |  8 +++-
 src/petpack-validator.js                           |  5 +++
 src/startup-greeting.js                            | 10 +++++
 7 files changed, 75 insertions(+), 3 deletions(-)


## Diff
```diff
diff --git a/package.json b/package.json
index 626e342..12d42e7 100644
--- a/package.json
+++ b/package.json
@@ -3,21 +3,21 @@
   "version": "0.4.0",
   "description": "閫氱敤 Windows 妗岄潰瀹犵墿鎾斁鍣紝鏀寔瀹夊叏瀵煎叆 .petpack 鍜岀敓鎴愬鎴蜂笓灞炰究鎼虹増銆?,
   "main": "src/main-v3.js",
   "author": "devin2255",
   "license": "MIT",
   "engines": {
     "node": ">=22.12.0"
   },
   "scripts": {
     "test": "npm run test:js && npm run test:python && npm run validate:demo",
-    "test:js": "node --check src/main-v3.js && node --check src/preload-v3.js && node --check src/renderer-v3.js && node --check src/petpack-validator.js && node --check src/window-discovery.js && node --check src/interaction-controller.js && node --check src/topmost-guard.js && node --check scripts/build-customer.js && node scripts/test-renderer-interaction.js && node scripts/test-petpack-security.js && node scripts/test-window-interactions.js && node scripts/test-window-discovery.js && node scripts/test-interaction-controller.js && node scripts/test-topmost-guard.js && node scripts/test-runtime-cdp-contract.js && node scripts/test-boss-petpack.js",
+    "test:js": "node --check src/main-v3.js && node --check src/preload-v3.js && node --check src/renderer-v3.js && node --check src/petpack-validator.js && node --check src/startup-greeting.js && node --check src/window-discovery.js && node --check src/interaction-controller.js && node --check src/topmost-guard.js && node --check scripts/build-customer.js && node scripts/test-renderer-interaction.js && node scripts/test-petpack-security.js && node scripts/test-window-interactions.js && node scripts/test-window-discovery.js && node scripts/test-interaction-controller.js && node scripts/test-topmost-guard.js && node scripts/test-runtime-cdp-contract.js && node scripts/test-boss-petpack.js && node scripts/test-startup-greeting.js",
     "test:python": "python -m unittest discover -s skills/desktop-pet-maker/scripts -p test_*.py -v",
     "test:regression": "node scripts/test-renderer-interaction.js && python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v",
     "validate:demo": "python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/boss.petpack",
     "start": "electron .",
     "pack": "electron-builder --dir --publish never",
     "build": "electron-builder --win portable --publish never",
     "build:customer": "node scripts/build-customer.js",
     "build:boss": "node scripts/build-customer.js --pet pets/packages/boss.petpack --name \"鑰佹澘妗岄潰瀹犵墿\" --delivery-id boss"
   },
   "devDependencies": {
@@ -38,20 +38,21 @@
     "portable": {
       "artifactName": "Desktop-Pet-${version}.${ext}"
     },
     "files": [
       "src/main-v3.js",
       "src/preload-v3.js",
       "src/index-v3.html",
       "src/styles-v3.css",
       "src/renderer-v3.js",
       "src/petpack-validator.js",
+      "src/startup-greeting.js",
       "src/window-interactions.js",
       "src/window-discovery.js",
       "src/interaction-controller.js",
       "src/topmost-guard.js",
       "assets/generated/boss-tray.png",
       "pets/packages/boss.petpack",
       "package.json"
     ]
   },
   "dependencies": {
diff --git a/scripts/test-startup-greeting.js b/scripts/test-startup-greeting.js
new file mode 100644
index 0000000..d9a1266
--- /dev/null
+++ b/scripts/test-startup-greeting.js
@@ -0,0 +1,46 @@
+'use strict';
+const assert = require('assert');
+const { validateManifest } = require('../src/petpack-validator');
+
+function resolveStartupGreeting(manifest, { switching = false } = {}) {
+  const { resolveStartupGreeting: resolve } = require('../src/startup-greeting');
+  return resolve(manifest, { switching });
+}
+
+assert.strictEqual(
+  resolveStartupGreeting({ name: '鐗涙柉鍏? }),
+  '鎴戞槸鐗涙柉鍏嬨€?
+);
+assert.strictEqual(
+  resolveStartupGreeting({ name: '鐗涙柉鍏? }, { switching: true }),
+  '浣犲ソ锛屾垜鏄墰鏂厠銆?
+);
+assert.strictEqual(
+  resolveStartupGreeting({ name: '鑰佸﹩', startupGreeting: '鑰佸叕锛屾垜鏉ュ暒~' }),
+  '鑰佸叕锛屾垜鏉ュ暒~'
+);
+assert.strictEqual(
+  resolveStartupGreeting({ name: '鑰佸﹩', startupGreeting: '鑰佸叕锛屾垜鏉ュ暒~' }, { switching: true }),
+  '鑰佸叕锛屾垜鏉ュ暒~'
+);
+assert.strictEqual(
+  resolveStartupGreeting({ name: '鑰佸﹩', startupGreeting: '   ' }),
+  '鎴戞槸鑰佸﹩銆?
+);
+
+const base = {
+  schemaVersion: 1,
+  id: 'demo',
+  name: '婕旂ず',
+  preview: 'preview.png',
+  animations: {
+    idle: { frames: ['a/1.png', 'a/2.png', 'a/3.png', 'a/4.png'], durations: [100, 100, 100, 100], loop: true },
+    walk: { frames: ['b/1.png', 'b/2.png', 'b/3.png', 'b/4.png', 'b/5.png', 'b/6.png'], durations: [100, 100, 100, 100, 100, 100], loop: true },
+    sit: { frames: ['c/1.png', 'c/2.png', 'c/3.png', 'c/4.png'], durations: [100, 100, 100, 100], loop: false },
+    sleep: { frames: ['d/1.png', 'd/2.png', 'd/3.png', 'd/4.png'], durations: [100, 100, 100, 100], loop: true },
+    reaction: { frames: ['e/1.png', 'e/2.png', 'e/3.png', 'e/4.png'], durations: [100, 100, 100, 100], loop: false }
+  }
+};
+assert.doesNotThrow(() => validateManifest({ ...base, startupGreeting: '鑰佸叕锛屾垜鏉ュ暒~' }));
+assert.throws(() => validateManifest({ ...base, startupGreeting: 'x'.repeat(81) }), /startupGreeting/);
+console.log('startup greeting checks passed');
diff --git a/skills/desktop-pet-maker/references/petpack-schema.md b/skills/desktop-pet-maker/references/petpack-schema.md
index 31b90aa..88ceeeb 100644
--- a/skills/desktop-pet-maker/references/petpack-schema.md
+++ b/skills/desktop-pet-maker/references/petpack-schema.md
@@ -13,20 +13,21 @@ animations/
   reaction/01.png ...
 ```
 
 Manifest fields:
 
 - `schemaVersion`: required integer `1`.
 - `packageVersion`: recommended package revision such as `1.0.0`; increment it when updating a built-in package.
 - `id`: required lowercase ASCII letters, numbers, and hyphens; 2鈥?8 characters.
 - `name`: required display name.
 - `personality`: array of short strings.
+- `startupGreeting`: optional custom greeting shown when the pet first appears or when switching to this pet. If omitted or blank after trimming, the player uses `鎴戞槸${name}銆俙 on startup and `浣犲ソ锛屾垜鏄?{name}銆俙 when switching. Maximum 80 characters.
 - `preview`: required relative PNG path.
 - `normalizationMetric`: optional scale-validation mode. New packages use `alpha-area-v1` to compare opaque visual mass; packages that omit it retain legacy `bbox-span-v1` validation for schema-v1 compatibility.
 - `animations`: required object keyed by action.
 - `behavior.random`: weighted state definitions used by the player.
 - `interactionActions`: optional object that maps window-interaction roles to animation actions.
 
 Each animation contains:
 
 - `frames`: ordered relative PNG paths.
 - `durations`: milliseconds, same length as `frames`.
diff --git a/skills/desktop-pet-maker/scripts/petpack_tool.py b/skills/desktop-pet-maker/scripts/petpack_tool.py
index 9cf2a64..a2f5600 100644
--- a/skills/desktop-pet-maker/scripts/petpack_tool.py
+++ b/skills/desktop-pet-maker/scripts/petpack_tool.py
@@ -64,20 +64,25 @@ def validate_manifest_shape(manifest: dict) -> list[str]:
     personality = manifest.get("personality")
     if personality is not None and (
         not isinstance(personality, list)
         or len(personality) > 12
         or any(not isinstance(item, str) or not item.strip() or len(item) > 32 for item in personality)
     ):
         raise ValueError("personality must contain at most 12 non-empty short strings")
     speech_gender = manifest.get("speechGender")
     if speech_gender is not None and speech_gender not in {"male", "female"}:
         raise ValueError("speechGender must be male or female")
+    startup_greeting = manifest.get("startupGreeting")
+    if startup_greeting is not None and (
+        not isinstance(startup_greeting, str) or len(startup_greeting) > 80
+    ):
+        raise ValueError("startupGreeting must be a string of at most 80 characters")
 
     preview = safe_relative(str(manifest.get("preview", "")))
     if preview.suffix.lower() != ".png":
         raise ValueError("preview must be a PNG")
     animations = manifest.get("animations")
     if not isinstance(animations, dict):
         raise ValueError("animations must be an object")
 
     frame_paths: list[str] = []
 
diff --git a/src/main-v3.js b/src/main-v3.js
index 7ca5a01..33b421b 100644
--- a/src/main-v3.js
+++ b/src/main-v3.js
@@ -8,20 +8,21 @@ const {
   safeRelative,
   validateManifest,
   validatePetpack
 } = require('./petpack-validator');
 const { createWindowDiscovery } = require('./window-discovery');
 const {
   createInteractionController,
   shouldRestoreWindowBounds
 } = require('./interaction-controller');
 const { createTopmostGuard } = require('./topmost-guard');
+const { resolveStartupGreeting } = require('./startup-greeting');
 const {
   app,
   BrowserWindow,
   dialog,
   ipcMain,
   Menu,
   nativeImage,
   protocol,
   screen,
   shell,
@@ -101,20 +102,23 @@ function publicManifest(manifest) {
   return {
     schemaVersion: 1,
     id: manifest.id,
     name: manifest.name,
     description: manifest.description || '',
     personality: Array.isArray(manifest.personality) ? manifest.personality : [],
     defaultSize: PET_SIZES[manifest.defaultSize] ? manifest.defaultSize : 'small',
     speechGender: manifest.speechGender === 'male' || manifest.speechGender === 'female'
       ? manifest.speechGender
       : '',
+    ...(typeof manifest.startupGreeting === 'string' && manifest.startupGreeting.trim()
+      ? { startupGreeting: manifest.startupGreeting.trim() }
+      : {}),
     preview: petAssetUrl(manifest.id, manifest.preview),
     animations,
     interactionActions: manifest.interactionActions || {},
     contextMenuActions: Array.isArray(manifest.contextMenuActions)
       ? manifest.contextMenuActions.map((item) => ({
         id: item.id,
         label: item.label.trim(),
         action: item.action,
         message: typeof item.message === 'string' ? item.message : '',
         speech: typeof item.speech === 'string' ? item.speech : '',
@@ -383,21 +387,21 @@ function updateTrayIcon() {
 
 function switchPet(id) {
   const next = listPets().find((pet) => pet.id === id);
   if (!next) return false;
   activeManifest = next;
   settings.petId = next.id;
   saveSettings();
   updateTrayIcon();
   tray?.setContextMenu(buildTrayMenu());
   petWindow?.webContents.send('pet:load', publicManifest(next));
-  sendState('reaction', `浣犲ソ锛屾垜鏄?{next.name}銆俙);
+  sendState('reaction', resolveStartupGreeting(next, { switching: true }));
   scheduleBehavior(3200);
   return true;
 }
 
 function showPet() {
   petWindow?.showInactive();
   topmostGuard?.ensure();
   if (interaction && interaction.state() !== 'normal') return;
   sendState('reaction', '浣犲洖鏉ュ暒锛?);
   scheduleBehavior(3000);
@@ -527,21 +531,21 @@ function createWindow() {
   petWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
   petWindow.webContents.on('will-navigate', (event, url) => { if (url !== indexUrl) event.preventDefault(); });
   petWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
   petWindow.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
     if (!isAlwaysOnTop && topmostGuard?.isEnabled()) setImmediate(() => topmostGuard?.ensure());
   });
   petWindow.loadFile(indexPath);
   petWindow.once('ready-to-show', () => {
     petWindow.showInactive();
     topmostGuard?.ensure();
-    sendState('reaction', `鎴戞槸${activeManifest.name}銆俙);
+    sendState('reaction', resolveStartupGreeting(activeManifest));
     scheduleBehavior(3600);
   });
   petWindow.on('close', (event) => {
     if (!quitting) { event.preventDefault(); petWindow.hide(); }
   });
 }
 
 function trustedIpc(event) {
   return Boolean(petWindow && !petWindow.isDestroyed() && event.sender === petWindow.webContents && event.senderFrame === petWindow.webContents.mainFrame);
 }
diff --git a/src/petpack-validator.js b/src/petpack-validator.js
index a223978..782d8df 100644
--- a/src/petpack-validator.js
+++ b/src/petpack-validator.js
@@ -64,20 +64,25 @@ function validateManifest(manifest, root = '', requireFiles = false) {
   if (manifest.personality !== undefined) {
     if (!Array.isArray(manifest.personality) || manifest.personality.length > 12 || manifest.personality.some((item) => typeof item !== 'string' || !item.trim() || item.length > 32)) {
       throw new Error('personality 蹇呴』鏄渶澶?12 涓潪绌虹煭瀛楃涓?);
     }
   }
   if (manifest.speechGender !== undefined
     && manifest.speechGender !== 'male'
     && manifest.speechGender !== 'female') {
     throw new Error('speechGender 鍙兘鏄?male 鎴?female');
   }
+  if (manifest.startupGreeting !== undefined) {
+    if (typeof manifest.startupGreeting !== 'string' || manifest.startupGreeting.length > 80) {
+      throw new Error('startupGreeting 蹇呴』鏄笉瓒呰繃 80 涓瓧绗︾殑瀛楃涓?);
+    }
+  }
   safeRelative(manifest.preview);
   if (path.posix.extname(manifest.preview).toLowerCase() !== '.png') throw new Error('preview 蹇呴』鏄?PNG');
   if (!manifest.animations || typeof manifest.animations !== 'object' || Array.isArray(manifest.animations)) {
     throw new Error('animations 缂哄け');
   }
 
   function validateAnimation(action, expected) {
     const animation = manifest.animations[action];
     if (!animation || typeof animation !== 'object' || Array.isArray(animation)) {
       throw new Error(`${action} 鍔ㄧ敾閰嶇疆涓嶅悎娉昤);
diff --git a/src/startup-greeting.js b/src/startup-greeting.js
new file mode 100644
index 0000000..dde5f91
--- /dev/null
+++ b/src/startup-greeting.js
@@ -0,0 +1,10 @@
+'use strict';
+
+function resolveStartupGreeting(manifest, { switching = false } = {}) {
+  const custom = typeof manifest?.startupGreeting === 'string' ? manifest.startupGreeting.trim() : '';
+  if (custom) return custom;
+  const name = typeof manifest?.name === 'string' && manifest.name.trim() ? manifest.name.trim() : '妗屽疇';
+  return switching ? `浣犲ソ锛屾垜鏄?{name}銆俙 : `鎴戞槸${name}銆俙;
+}
+
+module.exports = { resolveStartupGreeting };

```
