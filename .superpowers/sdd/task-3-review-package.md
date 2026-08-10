# Review Package — Task 3 (after fix)
## Diff stat
 package.json                         |  3 +-
 scripts/test-renderer-interaction.js | 41 +++++++++++++++++-
 src/main-v3.js                       | 83 ++++++++++++++++++++++++++++--------
 src/renderer-v3.js                   | 62 +++++++++++++++++++++------
 4 files changed, 157 insertions(+), 32 deletions(-)
## main-v3.js diff (focus hidePet)
```diff
diff --git a/src/main-v3.js b/src/main-v3.js
index 47faad0..7c3b83e 100644
--- a/src/main-v3.js
+++ b/src/main-v3.js
@@ -11,16 +11,17 @@ const {
 } = require('./petpack-validator');
 const { createWindowDiscovery } = require('./window-discovery');
 const {
   createInteractionController,
   shouldRestoreWindowBounds
 } = require('./interaction-controller');
 const { createTopmostGuard } = require('./topmost-guard');
 const { resolveStartupGreeting } = require('./startup-greeting');
+const { createSequenceController } = require('./sequence-controller');
 const {
   app,
   BrowserWindow,
   dialog,
   ipcMain,
   Menu,
   nativeImage,
   protocol,
@@ -57,16 +58,17 @@ let settings = { petId: '', sizeKey: 'small', roaming: true };
 let activeManifest;
 let behaviorTimer;
 let walkTimer;
 let interaction;
 let topmostGuard;
 let quitting = false;
 let mouseThrough = false;
 let deliveryConfig;
+let sequence;
 
 function readDeliveryConfig() {
   const deliveryRoot = path.join(__dirname, '..', 'delivery');
   const configPath = path.join(deliveryRoot, 'delivery.json');
   if (!fs.existsSync(configPath)) return null;
   const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
   if (!config || config.schemaVersion !== 1 || config.mode !== 'customer') throw new Error('瀹㈡埛浜や粯閰嶇疆鏍煎紡涓嶅彈鏀寔');
   if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(config.deliveryId || ''))) throw new Error('瀹㈡埛浜や粯閰嶇疆鐨?deliveryId 涓嶅悎娉?);
@@ -111,27 +113,32 @@ function publicManifest(manifest) {
       : '',
     ...(typeof manifest.startupGreeting === 'string' && manifest.startupGreeting.trim()
       ? { startupGreeting: manifest.startupGreeting.trim() }
       : {}),
     preview: petAssetUrl(manifest.id, manifest.preview),
     animations,
     interactionActions: manifest.interactionActions || {},
     contextMenuActions: Array.isArray(manifest.contextMenuActions)
-      ? manifest.contextMenuActions.map((item) => ({
-        id: item.id,
-        label: item.label.trim(),
-        action: item.action,
-        message: typeof item.message === 'string' ? item.message : '',
-        speech: typeof item.speech === 'string' ? item.speech : '',
-        speechAudio: typeof item.speechAudio === 'string' && item.speechAudio
-          ? petAssetUrl(manifest.id, item.speechAudio)
-          : '',
-        duration: Number.isInteger(item.duration) ? item.duration : 3000
-      }))
+      ? manifest.contextMenuActions.map((item) => {
+        const base = { id: item.id, label: item.label.trim() };
+        if (item.sequence) {
+          return { ...base, sequence: item.sequence };
+        }
+        return {
+          ...base,
+          action: item.action,
+          message: typeof item.message === 'string' ? item.message : '',
+          speech: typeof item.speech === 'string' ? item.speech : '',
+          speechAudio: typeof item.speechAudio === 'string' && item.speechAudio
+            ? petAssetUrl(manifest.id, item.speechAudio)
+            : '',
+          duration: Number.isInteger(item.duration) ? item.duration : 3000
+        };
+      })
       : []
   };
 }
 
 function saveSettings() {
   fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
   fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
 }
@@ -254,17 +261,27 @@ function clampPosition(x, y, width = currentSize().width, height = currentSize()
 
 function sendState(state, message = '', speech = '', logicalRole = state, options) {
   if (!petWindow || petWindow.isDestroyed()) return;
   if (shouldRestoreWindowBounds(options)) restorePetWindowSize();
   let speechAudio = typeof options?.speechAudio === 'string' ? options.speechAudio : '';
   if (speechAudio && !speechAudio.startsWith('pet-asset:') && activeManifest) {
     speechAudio = petAssetUrl(activeManifest.id, speechAudio);
   }
-  petWindow.webContents.send('pet:state', { state, logicalRole, message, speech, speechAudio });
+  const messages = Array.isArray(options?.messages) ? options.messages : undefined;
+  const messageGapMs = Number.isFinite(options?.messageGapMs) ? options.messageGapMs : undefined;
+  petWindow.webContents.send('pet:state', {
+    state,
+    logicalRole,
+    message,
+    speech,
+    speechAudio,
+    messages,
+    messageGapMs
+  });
 }
 
 function setMouseThrough(ignore) {
   if (!petWindow || petWindow.isDestroyed() || mouseThrough === ignore) return;
   mouseThrough = ignore;
   petWindow.setIgnoreMouseEvents(ignore, { forward: true });
 }
 
@@ -390,16 +407,17 @@ function updateTrayIcon() {
   const icon = nativeImage.createFromPath(resolveInside(activeManifest.__root, activeManifest.preview));
   if (!icon.isEmpty()) tray.setImage(icon.resize({ width: 32, height: 32 }));
   tray.setToolTip(deliveryConfig?.appName || `${activeManifest.name} 路 妗屽疇鎾斁鍣╜);
 }
 
 function switchPet(id) {
   const next = listPets().find((pet) => pet.id === id);
   if (!next) return false;
+  sequence?.cancel();
   activeManifest = next;
   settings.petId = next.id;
   saveSettings();
   updateTrayIcon();
   tray?.setContextMenu(buildTrayMenu());
   petWindow?.webContents.send('pet:load', publicManifest(next));
   sendState('reaction', resolveStartupGreeting(next, { switching: true }));
   scheduleBehavior(3200);
@@ -409,19 +427,32 @@ function switchPet(id) {
 function showPet() {
   petWindow?.showInactive();
   topmostGuard?.ensure();
   if (interaction && interaction.state() !== 'normal') return;
   sendState('reaction', '浣犲洖鏉ュ暒锛?);
   scheduleBehavior(3000);
 }
 
+function hidePet() {
+  sequence?.cancel();
+  petWindow?.hide();
+}
+
 function runContextMenuAction(item) {
-  if (!activeManifest || !item || !activeManifest.animations[item.action]
-    || (interaction && interaction.state() !== 'normal')) return;
+  if (!activeManifest || !item || (interaction && interaction.state() !== 'normal')) return;
+  if (sequence?.isActive()) {
+    sequence.cancel({ schedule: false });
+  }
+  if (item.sequence) {
+    pauseBehavior();
+    sequence.start(item.sequence);
+    return;
+  }
+  if (!activeManifest.animations[item.action]) return;
   pauseBehavior();
   sendState(item.action, item.message || '', item.speech || '');
   const duration = Number.isInteger(item.duration) ? item.duration : 3000;
   // Return to kneel/idle before random roaming so custom actions don't hard-cut mid-pose.
   if (behaviorTimer) clearTimeout(behaviorTimer);
   behaviorTimer = setTimeout(() => {
     behaviorTimer = undefined;
     if (!activeManifest || (interaction && interaction.state() !== 'normal')) return;
@@ -460,34 +491,37 @@ function buildTrayMenu() {
     },
     {
       label: '濮嬬粓缃《',
       type: 'checkbox',
       checked: topmostGuard?.isEnabled() ?? true,
       click: (item) => topmostGuard?.setEnabled(item.checked)
     },
     { label: '寮€鏈鸿嚜鍔ㄥ惎鍔?, type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
-    { type: 'separator' }, { label: '鏆傛椂钘忚捣鏉?, click: () => petWindow?.hide() },
+    { type: 'separator' }, {
+      label: '鏆傛椂钘忚捣鏉?,
+      click: hidePet
+    },
     {
       label: `閫€鍑?{deliveryConfig?.appName || '妗屽疇鎾斁鍣?}`,
       click: () => {
         quitting = true;
         interaction?.dispose();
         app.quit();
       }
     }
   );
   return Menu.buildFromTemplate(template);
 }
 
 function createTray() {
   const preview = resolveInside(activeManifest.__root, activeManifest.preview);
   tray = new Tray(nativeImage.createFromPath(preview).resize({ width: 32, height: 32 }));
   updateTrayIcon(); tray.setContextMenu(buildTrayMenu());
-  tray.on('click', () => petWindow?.isVisible() ? petWindow.hide() : showPet());
+  tray.on('click', () => petWindow?.isVisible() ? hidePet() : showPet());
 }
 
 function createWindow() {
   const size = currentSize();
   const workArea = screen.getPrimaryDisplay().workArea;
   petWindow = new BrowserWindow({
     width: size.width,
     height: size.height,
@@ -544,17 +578,17 @@ function createWindow() {
   petWindow.loadFile(indexPath);
   petWindow.once('ready-to-show', () => {
     petWindow.showInactive();
     topmostGuard?.ensure();
     sendState('reaction', resolveStartupGreeting(activeManifest));
     scheduleBehavior(3600);
   });
   petWindow.on('close', (event) => {
-    if (!quitting) { event.preventDefault(); petWindow.hide(); }
+    if (!quitting) { event.preventDefault(); hidePet(); }
   });
 }
 
 function trustedIpc(event) {
   return Boolean(petWindow && !petWindow.isDestroyed() && event.sender === petWindow.webContents && event.senderFrame === petWindow.webContents.mainFrame);
 }
 
 function handleTrusted(channel, listener) {
@@ -582,16 +616,17 @@ function validVisibleInsets(insets) {
 
 handleTrusted('pet:get-current', () => publicManifest(activeManifest));
 handleTrusted('pet:import', () => {
   if (deliveryConfig && !deliveryConfig.allowPetManagement) return null;
   return promptImportPetpack();
 });
 onTrusted('pet:drag-start', (pointer) => {
   if (!interaction || !validPointer(pointer)) return;
+  if (sequence?.isActive()) sequence.cancel({ schedule: false });
   setMouseThrough(false);
   interaction.startDrag(pointer);
 });
 onTrusted('pet:drag-move', (pointer) => {
   if (!interaction || !validPointer(pointer)) return;
   interaction.moveDrag(pointer);
 });
 onTrusted('pet:drag-end', (pointer) => {
@@ -603,16 +638,21 @@ onTrusted('pet:drag-end', (pointer) => {
 onTrusted('pet:visible-insets', (insets) => {
   if (interaction && validVisibleInsets(insets)) interaction.updateVisibleInsets(insets);
 });
 onTrusted('pet:set-mouse-through', (ignore) => {
   if (!interaction || interaction.state() !== 'dragging') setMouseThrough(Boolean(ignore));
 });
 onTrusted('pet:interact', () => {
   if (interaction && interaction.state() !== 'normal') return;
+  if (sequence?.isWaitingForClick()) {
+    sequence.continueFromClick();
+    return;
+  }
+  if (sequence?.isActive()) return;
   pauseBehavior();
   sendState('reaction', '涓嶈涓笅鎴戝憖 鈾?);
   scheduleBehavior(3400);
 });
 onTrusted('pet:context-menu', () => {
   if (!petWindow || petWindow.isDestroyed()) return;
   setMouseThrough(false);
   buildTrayMenu().popup({
@@ -668,20 +708,29 @@ if (!gotLock) {
     const pets = listPets();
     activeManifest = deliveryConfig
       ? pets.find((pet) => pet.id === deliveryConfig.petId)
       : pets.find((pet) => pet.id === settings.petId) || pets[0];
     if (!activeManifest) throw new Error('娌℃湁鍙敤瀹犵墿锛岃瀵煎叆 .petpack');
     settings.petId = activeManifest.id;
     saveSettings();
     createWindow();
+    sequence = createSequenceController({
+      getManifest: () => activeManifest,
+      sendState: (action, message, speech, extras) => {
+        sendState(action, message, speech, action, extras || {});
+      },
+      pauseBehavior,
+      scheduleBehavior
+    });
     createTray();
   }).catch((error) => {
     dialog.showErrorBox('妗屽疇鎾斁鍣ㄥ惎鍔ㄥけ璐?, error.stack || error.message);
     app.quit();
   });
 }
 
 app.on('before-quit', () => {
   quitting = true;
   interaction?.dispose();
+  sequence?.dispose();
   pauseBehavior();
 });
```
