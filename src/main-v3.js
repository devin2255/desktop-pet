const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
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
const {
  AI_APP_BY_ID,
  collectShortcuts,
  defaultShortcutRoots,
  resolveLaunchApps
} = require('./ai-app-catalog');
const { nextInteractLine, normalizeInteractLines, gateInteract } = require('./interact-lines');
const { clampIntoWorkAreas } = require('./window-interactions');
const { buildQwenTaskUrl, normalizeTaskText, taskAck } = require('./task-chat');
const {
  pickCalendarMoment,
  nextCalendarMoment,
  resolveCalendarLine,
  formatCalendarTodayTitle,
  remapAnimationAction,
  expandContextMenuItems,
  isMomentOnDate,
  WEATHER_FX,
  CLICK_FX
} = require('./calendar-moments');
const {
  pickShichen,
  applyShichenWeights,
  resolveShichenLine,
  shichenWeight
} = require('./shichen');
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  net,
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
      stream: true,
      bypassCSP: true
    }
  }
]);

function petAssetLog(message, detail) {
  try {
    const line = `[${new Date().toISOString()}] ${message}${detail ? ` ${detail}` : ''}\n`;
    const logPath = path.join(app.getPath('userData'), 'pet-asset.log');
    fs.appendFileSync(logPath, line);
  } catch {
    // ignore logging failures
  }
}

const PET_SIZES = {
  small: { label: '小（推荐）', width: 170, height: 190 },
  medium: { label: '中', width: 220, height: 240 },
  large: { label: '大', width: 280, height: 300 },
  xlarge: { label: '超大', width: 400, height: 430 }
};
const EDGE_GAP = 14;

let petWindow;
let tray;
let libraryRoot;
let settingsPath;
let settings = { petId: '', sizeKey: 'small', roaming: true, calendarMomentByPet: {} };
let activeManifest;
let behaviorTimer;
let walkTimer;
let interaction;
let topmostGuard;
let quitting = false;
let mouseThrough = false;
let deliveryConfig;
let calendarCycleIndex = 0;
let calendarCycleMomentId = '';
let walkNarrationIndex = 0;
let walkNarrationMomentId = '';
let nextAutoBubbleAt = 0;
let calendarWindow;
let taskChatWindow;
let clickLineCursor = 0;
let clickLockedUntil = 0;
let priorityUntil = 0;
let lastUserActivityAt = Date.now();
let autoSleeping = false;
let autoSleepTimer;
let launchCache = { at: 0, petId: '', items: [] };

function bubbleDisplayMs(text) {
  const chars = [...String(text || '')].length;
  return Math.min(20000, Math.max(10000, 4000 + chars * 280));
}

const AUTO_BUBBLE_GAP_MS = 10000;

function isSpeechEnabled() {
  return activeManifest?.speechEnabled !== false;
}

function canShowAutoBubble() {
  return Date.now() >= nextAutoBubbleAt;
}

function noteBubble(text) {
  if (!text) return '';
  nextAutoBubbleAt = Date.now() + bubbleDisplayMs(text) + AUTO_BUBBLE_GAP_MS;
  return text;
}

function takeAutoBubble(text) {
  if (!text || !canShowAutoBubble()) return '';
  return noteBubble(text);
}

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
  const parts = safeRelative(relative);
  // Customer portable EXE loads the page from app.asar. Custom protocol + asar CSP is unreliable,
  // so serve library files directly from disk (webSecurity is disabled in delivery mode).
  if (deliveryConfig && libraryRoot) {
    const filePath = resolveInside(resolveInside(libraryRoot, id), parts.join('/'));
    return pathToFileURL(filePath).href;
  }
  return `pet-asset://${id}/${parts.map(encodeURIComponent).join('/')}`;
}

function publicManifest(manifest) {
  const moment = pickCalendarMoment(manifest.calendarMoments, new Date(), calendarOverrideId(manifest));
  const remapActions = new Set(['idle', 'walk', 'sit', 'sleep', 'reaction']);
  const animations = {};
  for (const [action, config] of Object.entries(manifest.animations)) {
    const resolved = remapActions.has(action)
      ? remapAnimationAction(manifest.animations, action, moment)
      : action;
    const source = manifest.animations[resolved] || config;
    animations[action] = {
      frames: source.frames.map((frame) => petAssetUrl(manifest.id, frame)),
      durations: [...source.durations],
      loop: Boolean(source.loop),
      holdLastFrame: Boolean(source.holdLastFrame),
      scale: Number.isFinite(source.scale) ? source.scale : 1
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
      || manifest.speechGender === 'child'
      ? manifest.speechGender
      : '',
    speechEnabled: manifest.speechEnabled !== false,
    ...(typeof manifest.startupGreeting === 'string' && manifest.startupGreeting.trim()
      ? { startupGreeting: manifest.startupGreeting.trim() }
      : {}),
    ...(typeof manifest.recallLabel === 'string' && manifest.recallLabel.trim()
      ? { recallLabel: manifest.recallLabel.trim() }
      : {}),
    preview: petAssetUrl(manifest.id, manifest.preview),
    hasCalendarMoments: Array.isArray(manifest.calendarMoments) && manifest.calendarMoments.length > 0,
    bubbleStyle: manifest.bubbleStyle === 'letter' ? 'letter' : 'chat',
    clickFx: CLICK_FX.has(manifest.interact?.fx) ? manifest.interact.fx : 'hearts',
    sealGlyph: typeof manifest.interact?.fxGlyph === 'string' ? manifest.interact.fxGlyph.trim() : '',
    weatherEnabled: Boolean(manifest.behavior?.weather),
    weatherFx: WEATHER_FX.has(moment?.fx) ? moment.fx : '',
    ceremonyToday: Boolean(moment && isMomentOnDate(moment)),
    shichenId: pickShichen().id,
    animations,
    interactionActions: manifest.interactionActions || {},
    contextMenuActions: Array.isArray(manifest.contextMenuActions)
      ? manifest.contextMenuActions.map((item) => ({
        id: item.id,
        label: item.label.trim(),
        action: item.action,
        message: typeof item.message === 'string' ? item.message : '',
        speech: typeof item.speech === 'string' ? item.speech : '',
        speechAudio: typeof item.speechAudio === 'string' && item.speechAudio
          ? petAssetUrl(manifest.id, item.speechAudio)
          : '',
        duration: Number.isInteger(item.duration) ? item.duration : 3000
      }))
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
  if (!settings.calendarMomentByPet || typeof settings.calendarMomentByPet !== 'object') {
    settings.calendarMomentByPet = {};
  }
}

function calendarOverrideId(manifest = activeManifest) {
  const map = settings.calendarMomentByPet;
  if (!manifest || !map || typeof map !== 'object') return '';
  return typeof map[manifest.id] === 'string' ? map[manifest.id] : '';
}

function currentCalendarMoment(manifest = activeManifest) {
  return pickCalendarMoment(manifest?.calendarMoments, new Date(), calendarOverrideId(manifest));
}

function setCalendarOverride(momentId) {
  if (!activeManifest) return;
  if (!settings.calendarMomentByPet || typeof settings.calendarMomentByPet !== 'object') {
    settings.calendarMomentByPet = {};
  }
  if (momentId) settings.calendarMomentByPet[activeManifest.id] = momentId;
  else delete settings.calendarMomentByPet[activeManifest.id];
  calendarCycleIndex = 0;
  calendarCycleMomentId = momentId || '';
  saveSettings();
}

function calendarPayload() {
  const moments = Array.isArray(activeManifest?.calendarMoments) ? activeManifest.calendarMoments : [];
  const current = currentCalendarMoment();
  const today = pickCalendarMoment(moments, new Date());
  return {
    petName: activeManifest?.name || '',
    currentId: current?.id || '',
    todayId: today?.id || '',
    todayExact: Boolean(today && isMomentOnDate(today)),
    moments: moments.map((item) => ({
      id: item.id,
      name: item.name,
      monthDay: item.monthDay,
      greeting: item.greeting || '',
      origin: item.origin || '',
      verse: item.verse || '',
      know: item.know || '',
      poem: item.poem || '',
      almanac: item.almanac || '',
      flower: item.flower || '',
      ceremony: item.ceremony || ''
    }))
  };
}

function refreshCalendarWindow() {
  if (!calendarWindow || calendarWindow.isDestroyed()) return;
  calendarWindow.webContents.send('calendar:update', calendarPayload());
}

function openCalendarWindow() {
  if (!activeManifest?.calendarMoments?.length) return;
  if (calendarWindow && !calendarWindow.isDestroyed()) {
    refreshCalendarWindow();
    calendarWindow.show();
    calendarWindow.focus();
    return;
  }
  calendarWindow = new BrowserWindow({
    width: 440,
    height: 620,
    minWidth: 360,
    minHeight: 480,
    title: '节气历',
    autoHideMenuBar: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-calendar.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  calendarWindow.on('closed', () => {
    calendarWindow = undefined;
  });
  calendarWindow.loadFile(path.join(__dirname, 'calendar-v3.html'));
  calendarWindow.webContents.once('did-finish-load', () => refreshCalendarWindow());
}

function openTaskChat() {
  if (!activeManifest?.launchApps?.includes('qwen')) return;
  if (taskChatWindow && !taskChatWindow.isDestroyed()) {
    taskChatWindow.show();
    taskChatWindow.focus();
    return;
  }
  const petBounds = petWindow && !petWindow.isDestroyed()
    ? petWindow.getBounds()
    : screen.getPrimaryDisplay().workArea;
  const display = screen.getDisplayMatching(petBounds);
  const area = display.workArea;
  const width = 340;
  const height = 210;
  let x = Math.min(Math.max(area.x, petBounds.x), area.x + area.width - width);
  let y = petBounds.y - height - 12;
  if (y < area.y) y = Math.min(area.y + area.height - height, petBounds.y + petBounds.height + 12);
  taskChatWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(x),
    y: Math.round(y),
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    title: '交代任务',
    webPreferences: {
      preload: path.join(__dirname, 'preload-task-chat.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  taskChatWindow.setAlwaysOnTop(true, 'screen-saver');
  taskChatWindow.on('closed', () => {
    taskChatWindow = undefined;
  });
  taskChatWindow.once('ready-to-show', () => {
    if (!taskChatWindow || taskChatWindow.isDestroyed()) return;
    taskChatWindow.show();
    taskChatWindow.focus();
  });
  taskChatWindow.loadFile(path.join(__dirname, 'task-chat.html'));
}

function qwenExecutable() {
  const listed = currentLaunchTargets().find((item) => item.id === 'qwen' && item.kind === 'path' && item.target);
  if (listed?.target) return listed.target;
  const resolved = resolveLaunchApps(['qwen'], collectShortcuts(defaultShortcutRoots(), fs), (target) => {
    try {
      return Boolean(target) && fs.existsSync(target);
    } catch {
      return false;
    }
  });
  return resolved.find((item) => item.kind === 'path')?.target || '';
}

function handTaskToQwen(raw) {
  const text = normalizeTaskText(raw);
  const ack = taskAck(text);
  const url = buildQwenTaskUrl(text);
  if (!ack || !url.startsWith('https://www.qianwen.com/?q=')) return { ok: false, reason: 'empty' };
  const executable = qwenExecutable();
  if (executable) {
    try {
      const child = spawn(executable, [url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
        shell: false
      });
      child.once('error', () => {
        shell.openExternal(url).catch(() => {});
      });
      child.unref();
    } catch {
      shell.openExternal(url).catch(() => {});
    }
  } else {
    shell.openExternal(url).catch(() => {});
  }
  noteBubble(ack.message);
  pauseBehavior();
  priorityUntil = Date.now() + bubbleDisplayMs(ack.message);
  noteUserActivity();
  sendState('reaction', ack.message, ack.speech);
  scheduleBehavior(bubbleDisplayMs(ack.message) + AUTO_BUBBLE_GAP_MS);
  return { ok: true };
}

function reloadPublicPet() {
  if (!activeManifest || !petWindow || petWindow.isDestroyed()) return;
  petWindow.webContents.send('pet:load', publicManifest(activeManifest));
  tray?.setContextMenu(buildTrayMenu());
  refreshCalendarWindow();
}

function calendarSpeech(moment, text) {
  if (typeof moment?.speech === 'string' && moment.speech.trim()) return moment.speech.trim();
  return typeof text === 'string' && text && text.length <= 20 ? text : '';
}

function narrationSpeech(moment, text) {
  const full = typeof text === 'string' ? text.trim() : '';
  if (full) return full;
  return calendarSpeech(moment, text);
}

function calendarWalkNarration() {
  const moment = currentCalendarMoment();
  const lines = ['origin', 'verse']
    .map((field) => resolveCalendarLine(moment, field))
    .filter(Boolean);
  const text = lines.length
    ? (() => {
      if (moment?.id !== walkNarrationMomentId) {
        walkNarrationMomentId = moment.id || '';
        walkNarrationIndex = 0;
      }
      const next = lines[walkNarrationIndex % lines.length];
      walkNarrationIndex += 1;
      return next;
    })()
    : (resolveCalendarLine(moment, 'know') || resolveCalendarLine(moment, 'greeting'));
  return {
    message: text,
    speech: narrationSpeech(moment, text)
  };
}

function actionSpeech(moment, calendarText, explicitSpeech) {
  if (moment) return calendarSpeech(moment, calendarText);
  return typeof explicitSpeech === 'string' && explicitSpeech.trim() ? explicitSpeech.trim() : '';
}

function cycledCalendarText(moment) {
  if (!moment) return '';
  if (moment.id !== calendarCycleMomentId) {
    calendarCycleMomentId = moment.id || '';
    calendarCycleIndex = 0;
  }
  const text = resolveCalendarLine(moment, 'cycle', calendarCycleIndex);
  calendarCycleIndex += 1;
  return text;
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

function workAreas() {
  try {
    const areas = screen.getAllDisplays()
      .map((display) => display.workArea)
      .filter((area) => area && area.width > 0 && area.height > 0);
    if (areas.length) return areas;
  } catch {
    // Fall through to the nearest display.
  }
  return [getWorkAreaForBounds()];
}

function clampPosition(x, y, width = currentSize().width, height = currentSize().height) {
  return clampIntoWorkAreas({ x, y, width, height }, { left: 0, top: 0, right: 0, bottom: 0 }, workAreas());
}

function autoSleepDelay() {
  const value = activeManifest?.behavior?.autoSleepMs;
  return Number.isInteger(value) && value >= 10000 && value <= 3600000 ? value : 0;
}

function armAutoSleep() {
  if (autoSleepTimer) clearTimeout(autoSleepTimer);
  autoSleepTimer = undefined;
  const delay = autoSleepDelay();
  if (!delay || autoSleeping) return;
  const wait = Math.max(0, delay - (Date.now() - lastUserActivityAt));
  autoSleepTimer = setTimeout(tryAutoSleep, wait);
}

function tryAutoSleep() {
  autoSleepTimer = undefined;
  const delay = autoSleepDelay();
  if (!delay || autoSleeping) return;
  if (Date.now() - lastUserActivityAt < delay) {
    armAutoSleep();
    return;
  }
  if (!activeManifest?.animations?.sleep || (interaction && interaction.state() !== 'normal')) {
    autoSleepTimer = setTimeout(tryAutoSleep, 5000);
    return;
  }
  autoSleeping = true;
  pauseBehavior();
  const message = '我先眯一会儿。';
  noteBubble(message);
  sendState('sleep', message, message);
}

function noteUserActivity() {
  lastUserActivityAt = Date.now();
  autoSleeping = false;
  armAutoSleep();
}

function sendState(state, message = '', speech = '', logicalRole = state, options) {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (shouldRestoreWindowBounds(options)) restorePetWindowSize();
  let speechAudio = typeof options?.speechAudio === 'string' ? options.speechAudio : '';
  if (speechAudio && !speechAudio.startsWith('pet-asset:') && activeManifest) {
    speechAudio = petAssetUrl(activeManifest.id, speechAudio);
  }
  if (!isSpeechEnabled()) {
    speech = '';
    speechAudio = '';
  }
  petWindow.webContents.send('pet:state', {
    state,
    logicalRole,
    message,
    speech,
    speechAudio,
    fxBurst: Boolean(options?.fxBurst)
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

function roamingIdleDelay() {
  return 700 + Math.random() * 900;
}

function scheduleBehavior(delay = roamingIdleDelay()) {
  if (autoSleeping) return;
  if (interaction && interaction.state() !== 'normal') return;
  if (behaviorTimer) clearTimeout(behaviorTimer);
  behaviorTimer = setTimeout(runBehavior, delay);
}

function pickWalkTarget(bounds, workArea) {
  const minSpan = Math.max(240, Math.round(workArea.width * 0.22));
  const maxSpan = Math.max(minSpan, Math.min(Math.round(workArea.width * 0.52), 720));
  const span = minSpan + Math.random() * (maxSpan - minSpan);
  const prefer = Math.random() < 0.5 ? -1 : 1;
  const clampX = (x) => Math.max(workArea.x, Math.min(workArea.x + workArea.width - bounds.width, x));
  let target = clampX(bounds.x + prefer * span);
  if (Math.abs(target - bounds.x) < 180) target = clampX(bounds.x - prefer * span);
  return target;
}

function walkTo(targetX, behavior = {}) {
  if (!petWindow || petWindow.isDestroyed() || (interaction && interaction.state() !== 'normal')) return;
  stopWalk();
  restorePetWindowSize();
  const startBounds = petWindow.getBounds();
  const direction = targetX >= startBounds.x ? 'right' : 'left';
  const distance = Math.abs(targetX - startBounds.x);
  const minDuration = Math.max(2400, Number(behavior.minDuration) || 2400);
  const maxDuration = Math.max(minDuration, Number(behavior.maxDuration) || 7200);
  const duration = Math.max(minDuration, Math.min(maxDuration, Math.max(1400, distance * 11)));
  const startedAt = Date.now();
  const narration = activeManifest?.calendarMoments?.length && canShowAutoBubble()
    ? calendarWalkNarration()
    : { message: '', speech: '' };
  const message = takeAutoBubble(narration.message);
  sendState(`walk-${direction}`, message, narration.speech);
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
      scheduleBehavior(roamingIdleDelay());
    }
  }, 16);
}

function withShichenChoices(usable) {
  const shichen = pickShichen();
  let next = usable.slice();
  if (shichenWeight(shichen, 'sleep') > 0 && activeManifest.animations?.sleep
    && !next.some((item) => item.state === 'sleep')) {
    next.push({
      state: 'sleep',
      weight: 12,
      minDuration: 4200,
      maxDuration: 8200,
      calendarLine: 'bubble'
    });
  }
  return applyShichenWeights(next, shichen);
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
  const pool = activeManifest?.behavior?.shichen ? withShichenChoices(usable) : usable;
  const total = pool.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
  let cursor = Math.random() * total;
  for (const item of pool) {
    cursor -= Math.max(0, Number(item.weight) || 0);
    if (cursor <= 0) return item;
  }
  return pool[0];
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
    walkTo(pickWalkTarget(bounds, workArea), behavior);
    return;
  }
  const fallbackMessages = { sit: '我就在这里陪你。', reaction: '别走太远……', sleep: 'z Z' };
  const moment = currentCalendarMoment();
  let calendarText = behavior.calendarLine === 'cycle'
    ? cycledCalendarText(moment)
    : (behavior.calendarLine ? resolveCalendarLine(moment, behavior.calendarLine) : '');
  if (activeManifest.behavior?.shichen && canShowAutoBubble()) {
    const shichen = pickShichen();
    const shichenLine = resolveShichenLine(activeManifest.behavior.shichenLines, shichen);
    if (behavior.state === 'idle' && Math.random() < 0.4) calendarText = shichenLine;
    else if (behavior.state === 'sit' && shichenWeight(shichen, 'sit') >= 1.4 && Math.random() < 0.45) {
      calendarText = shichenLine;
    }
  }
  const message = calendarText
    || (typeof behavior.message === 'string' && behavior.message
      ? behavior.message
      : (fallbackMessages[behavior.state] || ''));
  const speech = behavior.calendarLine
    ? narrationSpeech(moment, calendarText)
    : (typeof behavior.speech === 'string' && behavior.speech
      ? behavior.speech
      : narrationSpeech(moment, calendarText));
  const shown = takeAutoBubble(message);
  const speechAudio = shown && typeof behavior.speechAudio === 'string' && behavior.speechAudio
    ? petAssetUrl(activeManifest.id, behavior.speechAudio)
    : '';
  sendState(behavior.state, shown, shown ? speech : '', behavior.state, { speechAudio });
  scheduleBehavior(Math.max(duration, shown ? bubbleDisplayMs(shown) + 400 : 0));
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
  const moment = currentCalendarMoment(activeManifest);
  const shichen = pickShichen();
  const tipName = deliveryConfig?.appName || `${activeManifest.name} · 桌宠播放器`;
  const parts = [tipName];
  if (moment?.name) parts.push(moment.name);
  if (activeManifest.behavior?.shichen) parts.push(`${shichen.name}时`);
  tray.setToolTip(parts.join(' · '));
}

function currentLaunchTargets() {
  const petId = activeManifest?.id || '';
  const now = Date.now();
  if (launchCache.petId === petId && now - launchCache.at < 15000) return launchCache.items;
  const shortcuts = collectShortcuts(defaultShortcutRoots(), fs);
  launchCache = {
    at: now,
    petId,
    items: resolveLaunchApps(activeManifest?.launchApps, shortcuts, (target) => {
      try {
        return Boolean(target) && fs.existsSync(target);
      } catch {
        return false;
      }
    })
  };
  return launchCache.items;
}

function launchAiApp(item) {
  if (!item) return;
  const fallback = AI_APP_BY_ID.get(item.id)?.url || '';
  if (item.kind === 'path' && item.target) {
    Promise.resolve(shell.openPath(item.target)).then((error) => {
      if (error && fallback) shell.openExternal(fallback).catch(() => {});
    }).catch(() => {
      if (fallback) shell.openExternal(fallback).catch(() => {});
    });
    return;
  }
  if (item.kind === 'url' && item.target) shell.openExternal(item.target).catch(() => {});
}

function switchPet(id) {
  const next = listPets().find((pet) => pet.id === id);
  if (!next) return false;
  clickLineCursor = 0;
  clickLockedUntil = 0;
  priorityUntil = 0;
  launchCache.at = 0;
  if (taskChatWindow && !taskChatWindow.isDestroyed()) taskChatWindow.close();
  activeManifest = next;
  settings.petId = next.id;
  saveSettings();
  updateTrayIcon();
  tray?.setContextMenu(buildTrayMenu());
  petWindow?.webContents.send('pet:load', publicManifest(next));
  noteUserActivity();
  const greeting = resolveStartupGreeting(next, { switching: true, momentId: calendarOverrideId(next) });
  noteBubble(greeting);
  sendState('reaction', greeting);
  scheduleBehavior(greeting ? bubbleDisplayMs(greeting) + AUTO_BUBBLE_GAP_MS : 3200);
  return true;
}

function showPet() {
  petWindow?.showInactive();
  topmostGuard?.ensure();
  noteUserActivity();
  if (interaction && interaction.state() !== 'normal') return;
  const greeting = resolveStartupGreeting(activeManifest, { momentId: calendarOverrideId() }) || '你回来啦！';
  noteBubble(greeting);
  sendState('reaction', greeting);
  scheduleBehavior(bubbleDisplayMs(greeting) + AUTO_BUBBLE_GAP_MS);
}

function runContextMenuAction(item) {
  noteUserActivity();
  if (!activeManifest || !item || !activeManifest.animations[item.action]
    || (interaction && interaction.state() !== 'normal')) return;
  pauseBehavior();
  let moment = currentCalendarMoment();
  if (item.calendarLine === 'next') {
    moment = nextCalendarMoment(activeManifest.calendarMoments, moment?.id);
    if (moment?.id) setCalendarOverride(moment.id);
    reloadPublicPet();
  } else if (item.calendarLine === 'select' && item.calendarMomentId) {
    const selected = (activeManifest.calendarMoments || []).find((entry) => entry.id === item.calendarMomentId);
    if (selected) {
      setCalendarOverride(selected.id);
      moment = selected;
      reloadPublicPet();
    }
  } else if (item.calendarLine === 'today') {
    setCalendarOverride('');
    moment = currentCalendarMoment();
    reloadPublicPet();
  }
  const calendarText = item.calendarLine
    ? resolveCalendarLine(
      moment,
      item.calendarLine === 'next' || item.calendarLine === 'select' || item.calendarLine === 'cycle'
        ? 'greeting'
        : item.calendarLine
    )
    : '';
  const message = calendarText || item.message || '';
  const speech = item.calendarLine
    ? narrationSpeech(moment, calendarText)
    : actionSpeech(moment, calendarText, item.speech);
  noteBubble(message);
  sendState(item.action, message, speech);
  const duration = Math.max(
    Number.isInteger(item.duration) ? item.duration : 3000,
    message ? bubbleDisplayMs(message) : 0
  );
  // Return to kneel/idle before random roaming so custom actions don't hard-cut mid-pose.
  if (behaviorTimer) clearTimeout(behaviorTimer);
  behaviorTimer = setTimeout(() => {
    behaviorTimer = undefined;
    if (!activeManifest || (interaction && interaction.state() !== 'normal')) return;
    sendState('idle');
    scheduleBehavior(message ? AUTO_BUBBLE_GAP_MS : 900);
  }, duration);
}

function buildTrayMenu() {
  const pets = listPets();
  const template = [];
  const customActions = Array.isArray(activeManifest?.contextMenuActions) ? activeManifest.contextMenuActions : [];
  if (customActions.length) {
    const moment = currentCalendarMoment();
    template.push(...expandContextMenuItems(customActions, activeManifest.calendarMoments, moment).map((item) => {
      if (Array.isArray(item.submenu) && item.submenu.length) {
        return {
          label: item.label,
          submenu: item.submenu.map((entry) => ({
            label: entry.label,
            type: 'radio',
            checked: Boolean(entry.checked),
            click: () => runContextMenuAction(entry)
          }))
        };
      }
      const todayTitle = item.calendarLine === 'today' ? formatCalendarTodayTitle(moment) : '';
      const label = todayTitle ? `${item.label} · ${todayTitle}` : item.label;
      return { label, click: () => runContextMenuAction(item) };
    }));
    template.push({ type: 'separator' });
  }
  const launches = currentLaunchTargets();
  if (launches.some((item) => item.id === 'qwen')) {
    template.push({ label: '交代任务', click: () => openTaskChat() });
  }
  if (launches.length === 1) {
    template.push({ label: `唤起${launches[0].label}`, click: () => launchAiApp(launches[0]) });
  } else if (launches.length > 1) {
    template.push({
      label: '唤起 AI',
      submenu: launches.map((item) => ({ label: item.label, click: () => launchAiApp(item) }))
    });
  }
  if (Array.isArray(activeManifest?.calendarMoments) && activeManifest.calendarMoments.length) {
    const moment = currentCalendarMoment();
    template.push({
      label: moment?.name ? `节气历 · ${moment.name}` : '节气历',
      click: () => openCalendarWindow()
    });
  }
  template.push({ label: activeManifest?.recallLabel || '叫宠物回来', click: showPet });
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
        if (item.checked) {
          const bounds = petWindow.getBounds();
          const workArea = getWorkAreaForBounds(bounds);
          walkTo(pickWalkTarget(bounds, workArea), { minDuration: 3600, maxDuration: 7200 });
        } else {
          sendState('idle');
        }
      }
    },
    {
      label: '始终置顶',
      type: 'checkbox',
      checked: topmostGuard?.isEnabled() ?? true,
      click: (item) => topmostGuard?.setEnabled(item.checked)
    },
    { label: '开机自动启动', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: 'separator' }, { label: '暂时藏起来', click: () => petWindow?.hide() },
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
  tray.on('click', () => petWindow?.isVisible() ? petWindow.hide() : showPet());
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
      // Delivery pages live in asar; local pet frames live in userData. Allow file:// assets.
      webSecurity: !deliveryConfig,
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
    getWorkAreas: workAreas,
    getManifest: () => activeManifest,
    getWalkNarration: () => {
      if (!activeManifest?.calendarMoments?.length || !canShowAutoBubble()) {
        return { message: '', speech: '' };
      }
      const narration = calendarWalkNarration();
      const message = takeAutoBubble(narration.message);
      return { message, speech: narration.speech };
    },
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
  if (process.env.DESKTOP_PET_DEBUG === '1') {
    petWindow.webContents.openDevTools({ mode: 'detach' });
    petWindow.webContents.on('console-message', (_e, level, message) => {
      console.log(`[renderer:${level}]`, message);
    });
    petWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error('[did-fail-load]', code, desc, url);
    });
  }
  petWindow.once('ready-to-show', () => {
    petWindow.showInactive();
    topmostGuard?.ensure();
    const greeting = resolveStartupGreeting(activeManifest, { momentId: calendarOverrideId() });
    noteBubble(greeting);
    sendState('reaction', greeting, '', 'reaction', { fxBurst: isMomentOnDate(currentCalendarMoment()) });
    noteUserActivity();
    scheduleBehavior(greeting ? bubbleDisplayMs(greeting) + AUTO_BUBBLE_GAP_MS : 3600);
  });
  petWindow.on('close', (event) => {
    if (!quitting) { event.preventDefault(); petWindow.hide(); }
  });
}

function trustedIpc(event) {
  return Boolean(petWindow && !petWindow.isDestroyed() && event.sender === petWindow.webContents && event.senderFrame === petWindow.webContents.mainFrame);
}

function trustedCalendarIpc(event) {
  return Boolean(
    calendarWindow
    && !calendarWindow.isDestroyed()
    && event.sender === calendarWindow.webContents
    && event.senderFrame === calendarWindow.webContents.mainFrame
  );
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
ipcMain.handle('calendar:get', (event) => {
  if (!trustedCalendarIpc(event)) throw new Error('拒绝来自非受信渲染页面的 IPC 请求');
  return calendarPayload();
});
ipcMain.handle('calendar:select', (event, momentId) => {
  if (!trustedCalendarIpc(event)) throw new Error('拒绝来自非受信渲染页面的 IPC 请求');
  if (typeof momentId !== 'string' || !momentId) return { ok: false };
  runContextMenuAction({
    action: 'reaction',
    calendarLine: 'select',
    calendarMomentId: momentId,
    duration: 3200
  });
  return { ok: true };
});
handleTrusted('pet:import', () => {
  if (deliveryConfig && !deliveryConfig.allowPetManagement) return null;
  return promptImportPetpack();
});
onTrusted('pet:drag-start', (pointer) => {
  if (!interaction || !validPointer(pointer)) return;
  noteUserActivity();
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
  const woke = autoSleeping;
  noteUserActivity();
  const gate = gateInteract({ now: Date.now(), lockedUntil: clickLockedUntil, priorityUntil });
  clickLockedUntil = gate.lockedUntil;
  if (!gate.allow && !woke) return;
  pauseBehavior();
  const interact = activeManifest?.interact;
  const moment = currentCalendarMoment();
  const calendarText = interact?.calendarLine === 'cycle'
    ? cycledCalendarText(moment)
    : (interact?.calendarLine ? resolveCalendarLine(moment, interact.calendarLine) : '');
  const rotated = interact?.calendarLine
    ? null
    : nextInteractLine(normalizeInteractLines(interact), clickLineCursor);
  if (rotated?.line) clickLineCursor = rotated.cursor;
  const message = calendarText
    || rotated?.line?.message
    || (typeof interact?.message === 'string' && interact.message)
    || '不要丢下我呀 ♥';
  const speech = interact?.calendarLine
    ? narrationSpeech(moment, calendarText)
    : (rotated?.line
      ? rotated.line.speech
      : ((typeof interact?.speech === 'string' && interact.speech)
        ? interact.speech
        : narrationSpeech(moment, calendarText)));
  sendState('reaction', message, speech);
  noteBubble(message);
  scheduleBehavior(bubbleDisplayMs(message) + AUTO_BUBBLE_GAP_MS);
});
ipcMain.handle('task-chat:submit', (event, text) => {
  if (!taskChatWindow || taskChatWindow.isDestroyed() || event.sender !== taskChatWindow.webContents) {
    return { ok: false };
  }
  const result = handTaskToQwen(text);
  if (result?.ok) {
    const win = taskChatWindow;
    setImmediate(() => {
      if (win && !win.isDestroyed()) win.close();
    });
  }
  return result;
});
ipcMain.on('task-chat:close', (event) => {
  if (taskChatWindow && !taskChatWindow.isDestroyed() && event.sender === taskChatWindow.webContents) {
    taskChatWindow.close();
  }
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
      try {
        petAssetLog('request', request.url);
        const url = new URL(request.url);
        const petId = url.hostname;
        if (!PET_ID_PATTERN.test(petId) || !activeManifest || petId !== activeManifest.id) {
          throw new Error(`拒绝访问非活动宠物资源: ${petId}`);
        }
        const relative = decodeURIComponent(url.pathname.slice(1));
        safeRelative(relative);
        if (!referencedFiles(activeManifest).has(relative)) throw new Error(`拒绝访问清单外资源: ${relative}`);
        const root = resolveInside(libraryRoot, petId);
        const filePath = resolveInside(root, relative);
        const response = await net.fetch(pathToFileURL(filePath).href);
        const headers = new Headers(response.headers);
        headers.set('access-control-allow-origin', '*');
        headers.set('cache-control', 'no-cache');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      } catch (error) {
        petAssetLog('error', `${request.url} :: ${error && error.message ? error.message : error}`);
        console.error('[pet-asset]', request.url, error);
        return new Response(`pet-asset error: ${error.message}`, {
          status: 404,
          headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }
        });
      }
    });
    ensureBundledPets();
    const pets = listPets();
    activeManifest = deliveryConfig
      ? pets.find((pet) => pet.id === deliveryConfig.petId)
      : pets.find((pet) => pet.id === settings.petId) || pets[0];
    if (!activeManifest) throw new Error('没有可用宠物，请导入 .petpack');
    clickLineCursor = 0;
    launchCache.at = 0;
    settings.petId = activeManifest.id;
    saveSettings();
    createWindow();
    createTray();
  }).catch((error) => {
    dialog.showErrorBox('桌宠播放器启动失败', error.stack || error.message);
    app.quit();
  });
}

app.on('before-quit', () => {
  quitting = true;
  interaction?.dispose();
  pauseBehavior();
});
