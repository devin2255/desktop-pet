const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  PET_ID_PATTERN,
  referencedFiles,
  resolveInside,
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
const { resolveStartupGreeting } = require('./startup-greeting');
const { createSequenceController } = require('./sequence-controller');
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
  Tray
} = require('electron');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pet-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

const PET_SIZES = {
  small: { label: '小（推荐）', width: 170, height: 190 },
  medium: { label: '中', width: 220, height: 240 },
  large: { label: '大', width: 280, height: 300 }
};
const EDGE_GAP = 14;

let petWindow;
let tray;
let libraryRoot;
let settingsPath;
let settings = { petId: '', sizeKey: 'small', roaming: true };
let activeManifest;
let behaviorTimer;
let walkTimer;
let interaction;
let topmostGuard;
let quitting = false;
let mouseThrough = false;
let deliveryConfig;
let sequence;

function readDeliveryConfig() {
  const deliveryRoot = path.join(__dirname, '..', 'delivery');
  const configPath = path.join(deliveryRoot, 'delivery.json');
  if (!fs.existsSync(configPath)) return null;
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config || config.schemaVersion !== 1 || config.mode !== 'customer') throw new Error('客户交付配置格式不受支持');
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(config.deliveryId || ''))) throw new Error('客户交付配置的 deliveryId 不合法');
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(String(config.petId || ''))) throw new Error('客户交付配置的 petId 不合法');
  if (typeof config.appName !== 'string' || !config.appName.trim()) throw new Error('客户交付配置缺少 appName');
  const petpackPath = resolveInside(deliveryRoot, config.petpack);
  if (!fs.statSync(petpackPath, { throwIfNoEntry: false })?.isFile()) throw new Error('客户交付配置指定的资源包不存在');
  return { ...config, appName: config.appName.trim(), allowPetManagement: config.allowPetManagement === true, __petpackPath: petpackPath };
}

function readManifest(root) {
  const manifestPath = path.join(root, 'pet.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  validateManifest(manifest, root, true);
  return { ...manifest, __root: root };
}

function petAssetUrl(id, relative) {
  return `pet-asset://${id}/${safeRelative(relative).map(encodeURIComponent).join('/')}`;
}

function publicManifest(manifest) {
  const animations = {};
  for (const [action, config] of Object.entries(manifest.animations)) {
    animations[action] = {
      frames: config.frames.map((frame) => petAssetUrl(manifest.id, frame)),
      durations: [...config.durations],
      loop: Boolean(config.loop),
      holdLastFrame: Boolean(config.holdLastFrame),
      scale: Number.isFinite(config.scale) ? config.scale : 1
    };
  }
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
    ...(typeof manifest.startupGreeting === 'string' && manifest.startupGreeting.trim()
      ? { startupGreeting: manifest.startupGreeting.trim() }
      : {}),
    preview: petAssetUrl(manifest.id, manifest.preview),
    animations,
    interactionActions: manifest.interactionActions || {},
    contextMenuActions: Array.isArray(manifest.contextMenuActions)
      ? manifest.contextMenuActions.map((item) => {
        const base = { id: item.id, label: item.label.trim() };
        if (item.sequence) {
          return { ...base, sequence: item.sequence };
        }
        return {
          ...base,
          action: item.action,
          message: typeof item.message === 'string' ? item.message : '',
          speech: typeof item.speech === 'string' ? item.speech : '',
          speechAudio: typeof item.speechAudio === 'string' && item.speechAudio
            ? petAssetUrl(manifest.id, item.speechAudio)
            : '',
          duration: Number.isInteger(item.duration) ? item.duration : 3000
        };
      })
      : []
  };
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

function loadSettings() {
  try {
    settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
  } catch {
    saveSettings();
  }
  if (!PET_SIZES[settings.sizeKey]) settings.sizeKey = 'small';
}

function listPets() {
  fs.mkdirSync(libraryRoot, { recursive: true });
  const pets = [];
  for (const entry of fs.readdirSync(libraryRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    try {
      pets.push(readManifest(path.join(libraryRoot, entry.name)));
    } catch (error) {
      console.warn(`Skipping invalid pet ${entry.name}:`, error.message);
    }
  }
  return pets.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function importPetpack(filePath, { replace = false } = {}) {
  const { zip, manifest } = validatePetpack(filePath);

  const target = path.join(libraryRoot, manifest.id);
  if (fs.existsSync(target) && !replace) return readManifest(target);
  const staging = path.join(libraryRoot, `.import-${manifest.id}-${Date.now()}`);
  fs.mkdirSync(staging, { recursive: true });
  try {
    zip.extractAllTo(staging, true);
    const imported = readManifest(staging);
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(staging, target);
    return { ...imported, __root: target };
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

async function promptImportPetpack() {
  const result = await dialog.showOpenDialog(petWindow, {
    title: '导入桌宠资源包',
    properties: ['openFile'],
    filters: [{ name: 'Desktop Pet Package', extensions: ['petpack'] }]
  });
  if (result.canceled || !result.filePaths[0]) return;
  try {
    const filePath = result.filePaths[0];
    const incoming = validatePetpack(filePath).manifest;
    let replace = false;
    if (fs.existsSync(path.join(libraryRoot, incoming.id))) {
      const confirmation = await dialog.showMessageBox(petWindow, {
        type: 'question',
        buttons: ['替换', '取消'],
        defaultId: 0,
        cancelId: 1,
        message: `宠物“${incoming.name || incoming.id}”已经存在，是否替换？`
      });
      if (confirmation.response !== 0) return;
      replace = true;
    }
    const imported = importPetpack(filePath, { replace });
    switchPet(imported.id);
    await dialog.showMessageBox(petWindow, { type: 'info', message: `已导入“${imported.name}”` });
  } catch (error) {
    await dialog.showMessageBox(petWindow, { type: 'error', message: '导入失败', detail: error.message });
  }
}

function bundledPetpackPaths() {
  if (deliveryConfig) return [deliveryConfig.__petpackPath];
  const packagesRoot = path.join(__dirname, '..', 'pets', 'packages');
  if (!fs.existsSync(packagesRoot)) return [];
  return fs.readdirSync(packagesRoot, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.petpack')).map((entry) => path.join(packagesRoot, entry.name));
}

function ensureBundledPets() {
  for (const packagePath of bundledPetpackPaths()) {
    const incoming = validatePetpack(packagePath).manifest;
    if (deliveryConfig && incoming.id !== deliveryConfig.petId) throw new Error('客户交付配置与内置宠物不匹配');
    const installedPath = path.join(libraryRoot, incoming.id);
    let replace = false;
    if (fs.existsSync(installedPath)) {
      try {
        const installed = readManifest(installedPath);
        replace = deliveryConfig ? settings.deliveryPackageSha256 !== deliveryConfig.packageSha256 : String(installed.packageVersion || '') !== String(incoming.packageVersion || '');
      } catch { replace = true; }
    }
    importPetpack(packagePath, { replace });
    if (deliveryConfig) settings.deliveryPackageSha256 = deliveryConfig.packageSha256;
  }
}

function currentSize() {
  return PET_SIZES[settings.sizeKey];
}

function getWorkAreaForBounds(bounds = petWindow?.getBounds()) {
  if (!bounds) return screen.getPrimaryDisplay().workArea;
  return screen.getDisplayNearestPoint({
    x: bounds.x + Math.round(bounds.width / 2),
    y: bounds.y + Math.round(bounds.height / 2)
  }).workArea;
}

function clampPosition(x, y, width = currentSize().width, height = currentSize().height) {
  const workArea = getWorkAreaForBounds();
  return {
    x: Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - width)),
    y: Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - height))
  };
}

function sendState(state, message = '', speech = '', logicalRole = state, options) {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (shouldRestoreWindowBounds(options)) restorePetWindowSize();
  let speechAudio = typeof options?.speechAudio === 'string' ? options.speechAudio : '';
  if (speechAudio && !speechAudio.startsWith('pet-asset:') && activeManifest) {
    speechAudio = petAssetUrl(activeManifest.id, speechAudio);
  }
  const messages = Array.isArray(options?.messages) ? options.messages : undefined;
  const messageGapMs = Number.isFinite(options?.messageGapMs) ? options.messageGapMs : undefined;
  petWindow.webContents.send('pet:state', {
    state,
    logicalRole,
    message,
    speech,
    speechAudio,
    messages,
    messageGapMs
  });
}

function setMouseThrough(ignore) {
  if (!petWindow || petWindow.isDestroyed() || mouseThrough === ignore) return;
  mouseThrough = ignore;
  petWindow.setIgnoreMouseEvents(ignore, { forward: true });
}

function stopWalk() {
  if (walkTimer) clearInterval(walkTimer);
  walkTimer = undefined;
}

function pauseBehavior() {
  stopWalk();
  if (behaviorTimer) clearTimeout(behaviorTimer);
  behaviorTimer = undefined;
}

function scheduleBehavior(delay = 4500 + Math.random() * 5500) {
  if (interaction && interaction.state() !== 'normal') return;
  if (behaviorTimer) clearTimeout(behaviorTimer);
  behaviorTimer = setTimeout(runBehavior, delay);
}

function walkTo(targetX) {
  if (!petWindow || petWindow.isDestroyed() || (interaction && interaction.state() !== 'normal')) return;
  stopWalk();
  restorePetWindowSize();
  const startBounds = petWindow.getBounds();
  const direction = targetX >= startBounds.x ? 'right' : 'left';
  const distance = Math.abs(targetX - startBounds.x);
  const duration = Math.max(1400, Math.min(4200, distance * 9));
  const startedAt = Date.now();
  sendState(`walk-${direction}`);
  walkTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) return stopWalk();
    const progress = Math.min(1, (Date.now() - startedAt) / duration);
    const x = Math.round(startBounds.x + (targetX - startBounds.x) * progress);
    const workArea = getWorkAreaForBounds();
    const expected = currentSize();
    petWindow.setBounds({
      x,
      y: workArea.y + workArea.height - expected.height + 6,
      width: expected.width,
      height: expected.height
    }, false);
    if (progress >= 1) {
      stopWalk();
      sendState('idle');
      scheduleBehavior();
    }
  }, 16);
}

function chooseBehavior() {
  const choices = activeManifest?.behavior?.random;
  const filteredChoices = Array.isArray(choices)
    ? choices.filter((item) => item?.state !== 'sleep')
    : [];
  const usable = filteredChoices.length ? filteredChoices : [
    { state: 'walk', weight: 50, minDuration: 1500, maxDuration: 4200 },
    { state: 'sit', weight: 28, minDuration: 4200, maxDuration: 6200 },
    { state: 'reaction', weight: 22, minDuration: 2200, maxDuration: 3400 }
  ];
  const total = usable.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
  let cursor = Math.random() * total;
  for (const item of usable) {
    cursor -= Math.max(0, Number(item.weight) || 0);
    if (cursor <= 0) return item;
  }
  return usable[0];
}

function runBehavior() {
  if (interaction && interaction.state() !== 'normal') return;
  if (!settings.roaming || !activeManifest || !petWindow || petWindow.isDestroyed()) {
    scheduleBehavior();
    return;
  }
  const behavior = chooseBehavior();
  const duration = Math.max(600, Number(behavior.minDuration) + Math.random() * Math.max(0, Number(behavior.maxDuration) - Number(behavior.minDuration)));
  if (behavior.state === 'walk') {
    const bounds = petWindow.getBounds();
    const workArea = getWorkAreaForBounds(bounds);
    const delta = Math.round((Math.random() * 2 - 1) * Math.min(300, workArea.width * 0.22));
    walkTo(Math.max(workArea.x, Math.min(workArea.x + workArea.width - bounds.width, bounds.x + delta)));
    return;
  }
  const fallbackMessages = { sit: '我就在这里陪你。', reaction: '别走太远……', sleep: 'z Z' };
  const message = typeof behavior.message === 'string' && behavior.message
    ? behavior.message
    : (fallbackMessages[behavior.state] || '');
  const speech = typeof behavior.speech === 'string' ? behavior.speech : '';
  const speechAudio = typeof behavior.speechAudio === 'string' && behavior.speechAudio
    ? petAssetUrl(activeManifest.id, behavior.speechAudio)
    : '';
  sendState(behavior.state, message, speech, behavior.state, { speechAudio });
  scheduleBehavior(duration);
}

function setPetSize(nextKey) {
  if (!PET_SIZES[nextKey] || !petWindow || (interaction && interaction.state() !== 'normal')) return;
  const old = petWindow.getBounds();
  settings.sizeKey = nextKey;
  saveSettings();
  const next = currentSize();
  const position = clampPosition(old.x + Math.round((old.width - next.width) / 2), old.y + old.height - next.height, next.width, next.height);
  petWindow.setBounds({ x: position.x, y: position.y, width: next.width, height: next.height }, true);
  tray?.setContextMenu(buildTrayMenu());
}

function restorePetWindowSize() {
  if (!petWindow || petWindow.isDestroyed() || (interaction && interaction.state() !== 'normal')) return;
  const expected = currentSize();
  const bounds = petWindow.getBounds();
  const position = clampPosition(
    bounds.x + Math.round((bounds.width - expected.width) / 2),
    bounds.y + bounds.height - expected.height,
    expected.width,
    expected.height
  );
  petWindow.setBounds({ x: position.x, y: position.y, width: expected.width, height: expected.height }, false);
}

function updateTrayIcon() {
  if (!tray || !activeManifest) return;
  const icon = nativeImage.createFromPath(resolveInside(activeManifest.__root, activeManifest.preview));
  if (!icon.isEmpty()) tray.setImage(icon.resize({ width: 32, height: 32 }));
  tray.setToolTip(deliveryConfig?.appName || `${activeManifest.name} · 桌宠播放器`);
}

function switchPet(id) {
  const next = listPets().find((pet) => pet.id === id);
  if (!next) return false;
  sequence?.cancel();
  activeManifest = next;
  settings.petId = next.id;
  saveSettings();
  updateTrayIcon();
  tray?.setContextMenu(buildTrayMenu());
  petWindow?.webContents.send('pet:load', publicManifest(next));
  sendState('reaction', resolveStartupGreeting(next, { switching: true }));
  scheduleBehavior(3200);
  return true;
}

function showPet() {
  petWindow?.showInactive();
  topmostGuard?.ensure();
  if (interaction && interaction.state() !== 'normal') return;
  sendState('reaction', '你回来啦！');
  scheduleBehavior(3000);
}

function hidePet() {
  sequence?.cancel();
  petWindow?.hide();
}

function runContextMenuAction(item) {
  if (!activeManifest || !item || (interaction && interaction.state() !== 'normal')) return;
  if (sequence?.isActive()) {
    sequence.cancel({ schedule: false });
  }
  if (item.sequence) {
    pauseBehavior();
    if (!sequence.start(item.sequence)) {
      scheduleBehavior(900);
    }
    return;
  }
  if (!activeManifest.animations[item.action]) return;
  pauseBehavior();
  sendState(item.action, item.message || '', item.speech || '');
  const duration = Number.isInteger(item.duration) ? item.duration : 3000;
  // Return to kneel/idle before random roaming so custom actions don't hard-cut mid-pose.
  if (behaviorTimer) clearTimeout(behaviorTimer);
  behaviorTimer = setTimeout(() => {
    behaviorTimer = undefined;
    if (!activeManifest || (interaction && interaction.state() !== 'normal')) return;
    sendState('idle');
    scheduleBehavior(900);
  }, duration);
}

function buildTrayMenu() {
  const pets = listPets();
  const template = [];
  const customActions = Array.isArray(activeManifest?.contextMenuActions) ? activeManifest.contextMenuActions : [];
  if (customActions.length) {
    template.push(...customActions.map((item) => ({ label: item.label, click: () => runContextMenuAction(item) })));
    template.push({ type: 'separator' });
  }
  template.push({ label: '叫宠物回来', click: showPet });
  if (!deliveryConfig || deliveryConfig.allowPetManagement) {
    template.push({ label: '切换宠物', submenu: pets.map((pet) => ({ label: pet.name, type: 'radio', checked: activeManifest?.id === pet.id, click: () => switchPet(pet.id) })) });
    template.push({ label: '导入 .petpack…', click: promptImportPetpack }, { label: '打开宠物库', click: () => shell.openPath(libraryRoot) }, { type: 'separator' });
  }
  template.push(
    { label: '宠物大小', submenu: Object.entries(PET_SIZES).map(([key, size]) => ({ label: size.label, type: 'radio', checked: settings.sizeKey === key, click: () => setPetSize(key) })) },
    {
      label: '在桌面散步',
      type: 'checkbox',
      checked: settings.roaming,
      click: (item) => {
        settings.roaming = item.checked;
        saveSettings();
        if (interaction && interaction.state() !== 'normal') return;
        stopWalk();
        sendState('idle');
        scheduleBehavior(1200);
      }
    },
    {
      label: '始终置顶',
      type: 'checkbox',
      checked: topmostGuard?.isEnabled() ?? true,
      click: (item) => topmostGuard?.setEnabled(item.checked)
    },
    { label: '开机自动启动', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: 'separator' }, {
      label: '暂时藏起来',
      click: hidePet
    },
    {
      label: `退出${deliveryConfig?.appName || '桌宠播放器'}`,
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
  tray.on('click', () => petWindow?.isVisible() ? hidePet() : showPet());
}

function createWindow() {
  const size = currentSize();
  const workArea = screen.getPrimaryDisplay().workArea;
  petWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    x: workArea.x + workArea.width - size.width - EDGE_GAP,
    y: workArea.y + workArea.height - size.height + 6,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-v3.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });
  topmostGuard = createTopmostGuard({ getWindow: () => petWindow });
  topmostGuard.ensure();
  interaction = createInteractionController({
    window: petWindow,
    discovery: createWindowDiscovery({ screen }),
    screen,
    getCurrentSize: currentSize,
    getManifest: () => activeManifest,
    sendState: (state, options) => sendState(
      state,
      typeof options?.message === 'string' ? options.message : '',
      typeof options?.speech === 'string' ? options.speech : '',
      options?.logicalRole || state,
      options
    ),
    pauseBehavior,
    resumeBehavior: () => scheduleBehavior(2500),
    ensureOnTop: () => topmostGuard?.ensure(),
    edgeGap: EDGE_GAP,
    bottomOffset: 6
  });
  const indexPath = path.join(__dirname, 'index-v3.html');
  const indexUrl = pathToFileURL(indexPath).toString();
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
    sendState('reaction', resolveStartupGreeting(activeManifest));
    scheduleBehavior(3600);
  });
  petWindow.on('close', (event) => {
    if (!quitting) { event.preventDefault(); hidePet(); }
  });
}

function trustedIpc(event) {
  return Boolean(petWindow && !petWindow.isDestroyed() && event.sender === petWindow.webContents && event.senderFrame === petWindow.webContents.mainFrame);
}

function handleTrusted(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!trustedIpc(event)) throw new Error('拒绝来自非受信渲染页面的 IPC 请求');
    return listener(...args);
  });
}

function onTrusted(channel, listener) {
  ipcMain.on(channel, (event, ...args) => { if (trustedIpc(event)) listener(...args); });
}

function validPointer(pointer) {
  return pointer && Number.isFinite(pointer.screenX) && Number.isFinite(pointer.screenY) && Math.abs(pointer.screenX) < 1000000 && Math.abs(pointer.screenY) < 1000000;
}

function validVisibleInsets(insets) {
  const size = currentSize();
  return insets && ['left', 'top', 'right', 'bottom'].every((side) => {
    const limit = side === 'left' || side === 'right' ? size.width : size.height;
    return Number.isFinite(insets[side]) && insets[side] >= 0 && insets[side] < limit;
  });
}

handleTrusted('pet:get-current', () => publicManifest(activeManifest));
handleTrusted('pet:import', () => {
  if (deliveryConfig && !deliveryConfig.allowPetManagement) return null;
  return promptImportPetpack();
});
onTrusted('pet:drag-start', (pointer) => {
  if (!interaction || !validPointer(pointer)) return;
  if (sequence?.isActive()) sequence.cancel({ schedule: false });
  setMouseThrough(false);
  interaction.startDrag(pointer);
});
onTrusted('pet:drag-move', (pointer) => {
  if (!interaction || !validPointer(pointer)) return;
  interaction.moveDrag(pointer);
});
onTrusted('pet:drag-end', (pointer) => {
  if (!interaction || !validPointer(pointer)) return;
  void interaction.endDrag(pointer).catch((error) => {
    console.warn(`Window interaction ended unexpectedly: ${error.message}`);
  });
});
onTrusted('pet:visible-insets', (insets) => {
  if (interaction && validVisibleInsets(insets)) interaction.updateVisibleInsets(insets);
});
onTrusted('pet:set-mouse-through', (ignore) => {
  if (!interaction || interaction.state() !== 'dragging') setMouseThrough(Boolean(ignore));
});
onTrusted('pet:interact', () => {
  if (interaction && interaction.state() !== 'normal') return;
  if (sequence?.isWaitingForClick()) {
    sequence.continueFromClick();
    return;
  }
  if (sequence?.isActive()) return;
  pauseBehavior();
  sendState('reaction', '不要丢下我呀 ♥');
  scheduleBehavior(3400);
});
onTrusted('pet:context-menu', () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  setMouseThrough(false);
  buildTrayMenu().popup({
    window: petWindow,
    callback: () => {
      restorePetWindowSize();
      setMouseThrough(false);
    }
  });
});

deliveryConfig = readDeliveryConfig();
if (deliveryConfig) {
  app.setName(deliveryConfig.appName);
  app.setPath('userData', path.join(app.getPath('appData'), 'Desktop Pet Deliveries', deliveryConfig.deliveryId));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showPet);
  app.whenReady().then(() => {
    libraryRoot = path.join(app.getPath('userData'), 'pets');
    settingsPath = path.join(app.getPath('userData'), 'player-settings.json');
    fs.mkdirSync(libraryRoot, { recursive: true });
    loadSettings();
    protocol.handle('pet-asset', async (request) => {
      const url = new URL(request.url);
      const petId = url.hostname;
      if (!PET_ID_PATTERN.test(petId) || !activeManifest || petId !== activeManifest.id) {
        throw new Error('拒绝访问非活动宠物资源');
      }
      const relative = decodeURIComponent(url.pathname.slice(1));
      safeRelative(relative);
      if (!referencedFiles(activeManifest).has(relative)) throw new Error('拒绝访问清单外资源');
      const root = resolveInside(libraryRoot, petId);
      const filePath = resolveInside(root, relative);
      const data = await fs.promises.readFile(filePath);
      const extension = path.extname(filePath).toLowerCase();
      const contentType = extension === '.mp3' ? 'audio/mpeg'
        : extension === '.wav' ? 'audio/wav'
          : extension === '.ogg' ? 'audio/ogg'
            : 'image/png';
      return new Response(data, {
        headers: {
          'content-type': contentType,
          'access-control-allow-origin': '*'
        }
      });
    });
    ensureBundledPets();
    const pets = listPets();
    activeManifest = deliveryConfig
      ? pets.find((pet) => pet.id === deliveryConfig.petId)
      : pets.find((pet) => pet.id === settings.petId) || pets[0];
    if (!activeManifest) throw new Error('没有可用宠物，请导入 .petpack');
    settings.petId = activeManifest.id;
    saveSettings();
    createWindow();
    sequence = createSequenceController({
      getManifest: () => activeManifest,
      sendState: (action, message, speech, extras) => {
        sendState(action, message, speech, action, extras || {});
      },
      pauseBehavior,
      scheduleBehavior
    });
    createTray();
  }).catch((error) => {
    dialog.showErrorBox('桌宠播放器启动失败', error.stack || error.message);
    app.quit();
  });
}

app.on('before-quit', () => {
  quitting = true;
  interaction?.dispose();
  sequence?.dispose();
  pauseBehavior();
});
