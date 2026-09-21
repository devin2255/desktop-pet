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
const { createMouseThroughGuard } = require('./mouse-through-guard');
const { resolveStartupGreeting } = require('./startup-greeting');
const { createSequenceController } = require('./sequence-controller');
const { dispatchBossMessage } = require('./message-watcher');
const { createImBus } = require('./im-bus');
const { createLarkAdapter } = require('./im-adapter-lark');
const { createDingtalkAdapter, resolveHangupAction } = require('./im-adapter-dingtalk');
const { createDingtalkUia } = require('./dingtalk-uia');
const { loadWatchConfig, ensureBossWatchDefaults, patchWatchFlags } = require('./watch-config');
const { createMarketWatcher } = require('./market-watch');
const { insetRect } = require('./approach-target');
const {
  hasWatch,
  hasMarketSequences,
  hasCallHangupSequence,
  hasDuo,
  hasDuoTent,
  hasDuoSlack,
  watchMenuLabel,
  taskProviderFromConfig
} = require('./capability-gates');
const {
  createDuoController,
  classifyRightPointer,
  canUnfold,
  clampToWorkArea,
  placeUnfoldedPair,
  memberWindowSize,
  unfoldTravelPx,
  foldMovingBounds,
  tentOpenProgress,
  tabletWindowSize,
  placeTabletWindow,
  presentationWindowSize,
  slackWindowSize,
  placeSlackWindow
} = require('./duo-controller');
const { createVoiceSynthesizer } = require('./edge-voice');
const { createEventHold } = require('./event-hold');
const { nextRoamTarget, crawlIdleState, roamStepBounds } = require('./roam-motion');
const { schedulePetTaskMock } = require('./pet-task');
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
  },
  {
    scheme: 'voice-cache',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
  }
]);

const PET_SIZES = {
  small: { label: '小（推荐）', width: 170, height: 190 },
  medium: { label: '中', width: 220, height: 240 },
  large: { label: '大', width: 280, height: 300 }
};
const EDGE_GAP = 14;
const TENT_EXTRA_HEIGHT = 56;
const SLACK_EXTRA_HEIGHT = 96;

let petWindow;
let tray;
let libraryRoot;
let settingsPath;
let settings = { petId: '', sizeKey: 'small', roaming: true, crawlMode: false };
let activeManifest;
let behaviorTimer;
let walkTimer;
let lastWalkFacing = 'right';
let lastPeerWalkFacing = 'left';
let peerWalkTimer;
let peerBehaviorTimer;
let interaction;
let topmostGuard;
let mouseThroughGuard;
let quitting = false;
let deliveryConfig;
let sequence;
let imBus;
let marketWatcher = null;
let watchConfig = null;
let watchConfigPath = '';
let restartOfficeBus = () => {};
let restartMarketWatcher = () => {};
let petTaskPollTimer = null;

// ── Duo (brother-duo) dual-window state ──────────────────────────────────
// `duo` is the pure fold/unfold state machine. `petWindow` doubles as the
// folded window and, when open, as the LEFT member window. `duoPeerWindow`
// only exists in the `open` state and hosts the RIGHT member with its own
// guards + interaction controller so click-through, topmost and window-edge
// interactions are per-window (never a shared/duplicated hack).
let duo = createDuoController({});
let duoPeerWindow = null;
let peerInteraction = null;
let peerTopmostGuard = null;
let peerMouseThroughGuard = null;
let peerMember = null;
let duoActiveWindow = null; // window currently receiving the gesture overlay
let duoTooNarrowNotified = false;
let duoSettleTimer;
let duoFoldAnimTimer;
let duoFoldFromSide = null;
let duoFoldMovingStart = null;
let duoFoldAnchorBounds = null;
let duoFoldVisual = 0;
let duoSlackTimer;

function makeDuoController() {
  const snap = activeManifest?.duo?.gesture?.snapProgress;
  return createDuoController({
    ...(Number.isFinite(snap) ? { snapProgress: snap } : {}),
    tentEnabled: hasDuoTent(activeManifest),
    slackEnabled: hasDuoSlack(activeManifest)
  });
}

function duoGesture() {
  const gesture = activeManifest?.duo?.gesture;
  return {
    menuSlopPx: Number.isFinite(gesture?.menuSlopPx) ? gesture.menuSlopPx : 12,
    commitPx: Number.isFinite(gesture?.commitPx) ? gesture.commitPx : 20,
    snapProgress: Number.isFinite(gesture?.snapProgress) ? gesture.snapProgress : 0.25
  };
}

function duoMembers() {
  return hasDuo(activeManifest) ? activeManifest.duo.members : [];
}

function duoMemberBySide(side) {
  return duoMembers().find((member) => member && member.side === side) || null;
}

function duoIsOpen() {
  return Boolean(duoPeerWindow && !duoPeerWindow.isDestroyed());
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
        if (Array.isArray(item.randomActions)) {
          return {
            ...base,
            randomActions: item.randomActions.map((choice) => {
              if (choice.sequence) {
                return { sequence: choice.sequence };
              }
              return {
                action: choice.action,
                message: typeof choice.message === 'string' ? choice.message : '',
                speech: typeof choice.speech === 'string' ? choice.speech : '',
                speechAudio: typeof choice.speechAudio === 'string' && choice.speechAudio
                  ? petAssetUrl(manifest.id, choice.speechAudio)
                  : '',
                duration: Number.isInteger(choice.duration) ? choice.duration : 3000
              };
            })
          };
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

// A member "view" reuses the active petpack id (so pet-asset URLs resolve) but
// swaps in the member's own animations / interaction actions / menu / behavior.
function memberView(member) {
  if (!member) return activeManifest;
  return {
    ...activeManifest,
    name: typeof member.name === 'string' && member.name ? member.name : activeManifest.name,
    animations: member.animations || {},
    interactionActions: member.interactionActions || {},
    contextMenuActions: Array.isArray(member.contextMenuActions) ? member.contextMenuActions : [],
    behavior: member.behavior || {},
    startupGreeting: undefined,
    startupGreetingAudio: undefined
  };
}

function publicMemberManifest(member) {
  return publicManifest(memberView(member));
}

// The manifest view backing petWindow: the LEFT member when Duo is open,
// otherwise the root (folded / non-duo) manifest.
function petWindowView() {
  if (duoIsOpen() && hasDuo(activeManifest)) {
    const leftMember = duoMemberBySide('left');
    if (leftMember) return memberView(leftMember);
  }
  return activeManifest;
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

function windowSize() {
  return presentationWindowSize(currentSize(), duo.mode(), {
    tentExtraHeight: TENT_EXTRA_HEIGHT,
    slackExtraHeight: SLACK_EXTRA_HEIGHT,
    peerOpen: duoIsOpen()
  });
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

function buildStatePayload(state, message, speech, logicalRole, options) {
  let speechAudio = typeof options?.speechAudio === 'string' ? options.speechAudio : '';
  // 带协议前缀（pet-asset:/voice-cache:/data:/file: 等）视为完整 URL，否则按资源包相对路径改写
  if (speechAudio && !/^[a-z][a-z0-9+.-]*:/i.test(speechAudio) && activeManifest) {
    speechAudio = petAssetUrl(activeManifest.id, speechAudio);
  }
  const messages = Array.isArray(options?.messages) ? options.messages : undefined;
  const messageGapMs = Number.isFinite(options?.messageGapMs) ? options.messageGapMs : undefined;
  return {
    state,
    logicalRole,
    message,
    speech,
    speechAudio,
    messages,
    messageGapMs,
    speechGender: options?.speechGender === 'male' || options?.speechGender === 'female' ? options.speechGender : undefined,
    messageLoop: options?.messageLoop === true,
    speechLoop: options?.speechLoop === true,
    startAtLast: options?.startAtLast === true
  };
}

function sendState(state, message = '', speech = '', logicalRole = state, options) {
  if (!petWindow || petWindow.isDestroyed()) return;
  // During sequence playback (e.g. boss-call mom walk) skip bounds restore:
  // its clamp would drag the pet window away from the approach target.
  if (shouldRestoreWindowBounds(options) && !sequence?.isActive?.() && duo.mode() !== 'folding') restorePetWindowSize();
  const tentHold = duo.mode() === 'tent' && state === tentAction();
  petWindow.webContents.send('pet:state', buildStatePayload(state, message, speech, logicalRole, {
    ...options,
    startAtLast: options?.startAtLast === true || tentHold
  }));
}

function sendPeerState(state, message = '', speech = '', logicalRole = state, options) {
  if (!duoPeerWindow || duoPeerWindow.isDestroyed()) return;
  if (shouldRestoreWindowBounds(options) && peerInteraction?.state?.() === 'normal' && duo.mode() !== 'folding') restorePeerWindowSize();
  duoPeerWindow.webContents.send('pet:state', buildStatePayload(state, message, speech, logicalRole, options));
}

function stopWalk() {
  if (walkTimer) clearInterval(walkTimer);
  walkTimer = undefined;
}

function stopPeerWalk() {
  if (peerWalkTimer) clearInterval(peerWalkTimer);
  peerWalkTimer = undefined;
}

function pauseBehavior() {
  stopWalk();
  if (behaviorTimer) clearTimeout(behaviorTimer);
  behaviorTimer = undefined;
}

function pausePeerBehavior() {
  stopPeerWalk();
  if (peerBehaviorTimer) clearTimeout(peerBehaviorTimer);
  peerBehaviorTimer = undefined;
}

function finishEventHold() {
  if (interaction && interaction.state() !== 'normal') {
    interaction.resumePerchedIdle?.();
    return;
  }
  scheduleBehavior(900);
}

const eventHold = createEventHold({
  pauseBehavior,
  resumeBehavior: finishEventHold,
  pausePerchedIdle: () => interaction?.suspendPerchedIdle?.()
});

function scheduleBehavior(delay = 4500 + Math.random() * 5500) {
  if (duo.mode() === 'tent' || duo.mode() === 'slack') return;
  if (eventHold.isHeld()) return;
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
  lastWalkFacing = direction;
  const distance = Math.abs(targetX - startBounds.x);
  const duration = Math.max(1400, Math.min(4200, distance * 9));
  const startedAt = Date.now();
  const moveAction = crawlEnabledFor('left') ? 'crawl' : 'walk';
  sendState(`${moveAction}-${direction}`);
  walkTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) return stopWalk();
    const progress = Math.min(1, (Date.now() - startedAt) / duration);
    const workArea = getWorkAreaForBounds(startBounds);
    petWindow.setBounds(roamStepBounds(startBounds, targetX, progress, windowSize(), workArea), false);
    if (progress >= 1) {
      stopWalk();
      sendState(idleState());
      scheduleBehavior(crawlEnabledFor('left') ? 700 + Math.random() * 900 : undefined);
    }
  }, 16);
}

function memberHasCrawl(member) {
  return Boolean(member?.animations?.crawl);
}

function crawlAvailable() {
  if (!duoIsOpen()) return Boolean(activeManifest?.animations?.crawl);
  return memberHasCrawl(duoMemberBySide('left')) || memberHasCrawl(duoMemberBySide('right'));
}

function crawlEnabledFor(side) {
  if (!settings.crawlMode) return false;
  if (!duoIsOpen()) return Boolean(activeManifest?.animations?.crawl);
  return memberHasCrawl(duoMemberBySide(side));
}

function idleState() {
  if (duo.mode() === 'tent') return tentAction();
  return crawlEnabledFor('left') ? crawlIdleState(lastWalkFacing) : 'idle';
}

function peerIdleState() {
  return crawlEnabledFor('right') ? crawlIdleState(lastPeerWalkFacing) : 'idle';
}

function chooseBehavior() {
  // Crawl mode: only crawl-walk, never stand/sit/sleep
  if (crawlEnabledFor('left')) {
    return { state: 'walk', weight: 100, minDuration: 2000, maxDuration: 5000 };
  }
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
  if (duo.mode() === 'tent' || duo.mode() === 'slack') return;
  if (eventHold.isHeld()) return;
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
    const { targetX, direction } = nextRoamTarget(bounds, workArea, Math.random, lastWalkFacing);
    lastWalkFacing = direction;
    walkTo(targetX);
    return;
  }
  const fallbackMessages = { sit: '上个毛的班，可以休息了！', reaction: '别走太远……', sleep: 'z Z' };
  const fallbackAudio = (activeManifest.behavior && activeManifest.behavior.fallbackAudio
    && typeof activeManifest.behavior.fallbackAudio === 'object')
    ? activeManifest.behavior.fallbackAudio
    : {};
  const message = typeof behavior.message === 'string' && behavior.message
    ? behavior.message
    : (fallbackMessages[behavior.state] || '');
  const speech = typeof behavior.speech === 'string' ? behavior.speech : '';
  const fallbackAu = typeof fallbackAudio[behavior.state] === 'string' ? fallbackAudio[behavior.state] : '';
  const speechAudio = typeof behavior.speechAudio === 'string' && behavior.speechAudio
    ? petAssetUrl(activeManifest.id, behavior.speechAudio)
    : (fallbackAu ? petAssetUrl(activeManifest.id, fallbackAu) : '');
  sendState(behavior.state, message, speech, behavior.state, { speechAudio });
  scheduleBehavior(duration);
}

function resumeDuoBehaviors(leftDelay = 1200, rightDelay = 900) {
  scheduleBehavior(leftDelay);
  schedulePeerBehavior(rightDelay);
}

function schedulePeerBehavior(delay = 2800 + Math.random() * 4200) {
  if (!duoIsOpen() || !settings.roaming) return;
  if (peerInteraction && peerInteraction.state() !== 'normal') return;
  if (peerBehaviorTimer) clearTimeout(peerBehaviorTimer);
  peerBehaviorTimer = setTimeout(runPeerBehavior, delay);
}

function syncPeerWindow(options = {}) {
  if (!duoPeerWindow || duoPeerWindow.isDestroyed() || !peerMember) return;
  if (options.load !== false) {
    duoPeerWindow.webContents.send('pet:load', publicMemberManifest(peerMember));
  }
  sendPeerState(peerIdleState());
  peerMouseThroughGuard?.set(false);
  if (options.schedule !== false) schedulePeerBehavior(options.delay == null ? 700 : options.delay);
}

function walkPeerTo(targetX) {
  if (!duoPeerWindow || duoPeerWindow.isDestroyed() || (peerInteraction && peerInteraction.state() !== 'normal')) return;
  stopPeerWalk();
  restorePeerWindowSize();
  const startBounds = duoPeerWindow.getBounds();
  const direction = targetX >= startBounds.x ? 'right' : 'left';
  lastPeerWalkFacing = direction;
  const distance = Math.abs(targetX - startBounds.x);
  const duration = Math.max(1400, Math.min(4200, distance * 9));
  const startedAt = Date.now();
  const moveAction = crawlEnabledFor('right') ? 'crawl' : 'walk';
  sendPeerState(`${moveAction}-${direction}`);
  peerWalkTimer = setInterval(() => {
    if (!duoPeerWindow || duoPeerWindow.isDestroyed()) return stopPeerWalk();
    const progress = Math.min(1, (Date.now() - startedAt) / duration);
    const workArea = getWorkAreaForBounds(startBounds);
    duoPeerWindow.setBounds(roamStepBounds(startBounds, targetX, progress, windowSize(), workArea), false);
    if (progress >= 1) {
      stopPeerWalk();
      sendPeerState(peerIdleState());
      schedulePeerBehavior(crawlEnabledFor('right') ? 700 + Math.random() * 900 : undefined);
    }
  }, 16);
}

function choosePeerBehavior() {
  if (crawlEnabledFor('right')) {
    return { state: 'walk', weight: 100, minDuration: 2000, maxDuration: 5000 };
  }
  const member = duoMemberBySide('right');
  const choices = member?.behavior?.random;
  const filtered = Array.isArray(choices) ? choices.filter((item) => item?.state !== 'sleep') : [];
  const usable = filtered.length ? filtered : [
    { state: 'walk', weight: 50, minDuration: 1500, maxDuration: 4200 },
    { state: 'reaction', weight: 30, minDuration: 2200, maxDuration: 3400 },
    { state: 'sit', weight: 20, minDuration: 4200, maxDuration: 6200 }
  ];
  const total = usable.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
  let cursor = Math.random() * total;
  for (const item of usable) {
    cursor -= Math.max(0, Number(item.weight) || 0);
    if (cursor <= 0) return item;
  }
  return usable[0];
}

function runPeerBehavior() {
  if (!duoIsOpen() || !settings.roaming || !duoPeerWindow || duoPeerWindow.isDestroyed()) return;
  if (peerInteraction && peerInteraction.state() !== 'normal') return;
  const member = duoMemberBySide('right');
  const behavior = choosePeerBehavior();
  const duration = Math.max(600, Number(behavior.minDuration) + Math.random() * Math.max(0, Number(behavior.maxDuration) - Number(behavior.minDuration)));
  if (behavior.state === 'walk') {
    const bounds = duoPeerWindow.getBounds();
    const workArea = getWorkAreaForBounds(bounds);
    const { targetX, direction } = nextRoamTarget(bounds, workArea, Math.random, lastPeerWalkFacing);
    lastPeerWalkFacing = direction;
    walkPeerTo(targetX);
    return;
  }
  const action = behavior.state && member?.animations?.[behavior.state] ? behavior.state : 'reaction';
  sendPeerState(action, behavior.message || '', behavior.speech || '', action, { speechAudio: behavior.speechAudio || '' });
  schedulePeerBehavior(duration);
}

function setPetSize(nextKey) {
  if (!PET_SIZES[nextKey] || !petWindow || (interaction && interaction.state() !== 'normal')) return;
  settings.sizeKey = nextKey;
  saveSettings();
  restorePetWindowSize();
  if (duoIsOpen()) restorePeerWindowSize();
  tray?.setContextMenu(buildTrayMenu());
}

function restorePetWindowSize() {
  if (!petWindow || petWindow.isDestroyed() || (interaction && interaction.state() !== 'normal')) return;
  const expected = windowSize();
  const bounds = petWindow.getBounds();
  const workArea = getWorkAreaForBounds(bounds);
  petWindow.setBounds(clampToWorkArea({
    x: bounds.x + Math.round((bounds.width - expected.width) / 2),
    y: bounds.y + bounds.height - expected.height,
    width: expected.width,
    height: expected.height
  }, workArea), false);
}

function restorePeerWindowSize() {
  if (!duoPeerWindow || duoPeerWindow.isDestroyed() || (peerInteraction && peerInteraction.state() !== 'normal')) return;
  const expected = windowSize();
  const bounds = duoPeerWindow.getBounds();
  const workArea = getWorkAreaForBounds(bounds);
  duoPeerWindow.setBounds(clampToWorkArea({
    x: bounds.x + Math.round((bounds.width - expected.width) / 2),
    y: bounds.y + bounds.height - expected.height,
    width: expected.width,
    height: expected.height
  }, workArea), false);
}

function movePetKeepingSize(x, y) {
  if (!petWindow || petWindow.isDestroyed()) return;
  const size = windowSize();
  petWindow.setBounds({
    x: Math.round(x),
    y: Math.round(y),
    width: size.width,
    height: size.height
  }, false);
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
  // Tearing down any duo transition/second window before swapping identity so a
  // non-duo pet never inherits a stray peer window.
  cancelDuoTransition();
  if (duoIsOpen()) destroyDuoPeerWindow();
  activeManifest = next;
  duo = makeDuoController();
  settings.petId = next.id;
  saveSettings();
  if (watchConfigPath) {
    applyLoadedWatchConfig(loadWatchConfig({
      configPath: watchConfigPath,
      manifestWatch: next.watch,
      larkCliPath: undefined
    }));
    restartOfficeBus();
    restartMarketWatcher();
  }
  updateTrayIcon();
  tray?.setContextMenu(buildTrayMenu());
  petWindow?.webContents.send('pet:load', publicManifest(next));
  sendState('reaction', resolveStartupGreeting(next, { switching: true }), '', 'reaction', {
    speechAudio: typeof next.startupGreetingAudio === 'string' ? next.startupGreetingAudio : ''
  });
  scheduleBehavior(3200);
  return true;
}

function showPet() {
  petWindow?.showInactive();
  topmostGuard?.ensure();
  if (duoIsOpen()) {
    duoPeerWindow.showInactive();
    peerTopmostGuard?.ensure();
  }
  if (duo.mode() === 'tent') {
    applyTentPresentation();
    return;
  }
  if (interaction && interaction.state() !== 'normal') return;
  sendState('reaction', '你回来啦！');
  scheduleBehavior(3000);
  if (duoIsOpen()) {
    sendPeerState('reaction', '整点儿活儿？');
    schedulePeerBehavior(2800);
  }
}

function hidePet() {
  sequence?.cancel();
  // Hiding mid-transition cancels the fold/unfold back to the pre-transition
  // state; an already-open pair simply hides both windows and re-shows open.
  cancelDuoTransition();
  petWindow?.hide();
  if (duoIsOpen()) duoPeerWindow.hide();
}

function pickRandomMenuChoice(item) {
  if (!Array.isArray(item?.randomActions) || item.randomActions.length === 0) return null;
  const index = Math.floor(Math.random() * item.randomActions.length);
  return item.randomActions[index] || null;
}

function runDirectMenuAction(choice) {
  if (!activeManifest || !choice || !activeManifest.animations[choice.action]) return;
  // State-aware kowtow: use crawl version when in crawl mode
  if (choice.action === 'kowtow' && crawlEnabledFor('left') && activeManifest.animations['kowtow-crawl']) {
    choice = { ...choice, action: 'kowtow-crawl' };
  }
  pauseBehavior();
  sendState(choice.action, choice.message || '', choice.speech || '', choice.action, {
    speechAudio: choice.speechAudio || ''
  });
  const duration = Number.isInteger(choice.duration) ? choice.duration : 3000;
  // Return to kneel/idle before random roaming so custom actions don't hard-cut mid-pose.
  if (behaviorTimer) clearTimeout(behaviorTimer);
  behaviorTimer = setTimeout(() => {
    behaviorTimer = undefined;
    if (!activeManifest || (interaction && interaction.state() !== 'normal')) return;
    sendState(idleState());
    scheduleBehavior(900);
  }, duration);
}

function runContextMenuAction(item) {
  if (item && item.id === 'duo-fold') { foldViaMenu('left'); return; }
  if (item && item.id === 'duo-unfold') { unfoldViaMenu(); return; }
  if (item && item.id === 'duo-tent') { tentViaMenu(); return; }
  if (item && item.id === 'duo-untent') { leaveTentViaMenu(); return; }
  if (item && item.id === 'duo-slack') { slackViaMenu(); return; }
  if (item && item.id === 'duo-unslack') { leaveSlackViaMenu(); return; }
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
  if (Array.isArray(item.randomActions)) {
    const choice = pickRandomMenuChoice(item);
    if (!choice) return;
    if (choice.sequence) {
      pauseBehavior();
      if (!sequence.start(choice.sequence)) {
        scheduleBehavior(900);
      }
      return;
    }
    runDirectMenuAction(choice);
    return;
  }
  runDirectMenuAction(item);
}

const petTaskDir = () => path.join(app.getPath('userData'), 'pet-tasks');

function triggerPetTask(taskType) {
  if (taskProviderFromConfig(watchConfig) === 'mock') {
    sendState('reaction', '好的，爸！', '好的，爸', 'reaction', {
      speechAudio: typeof activeManifest?.taskAcceptAudio === 'string' ? activeManifest.taskAcceptAudio : ''
    });
    schedulePetTaskMock({
      taskType,
      onResult: (summary) => {
        const text = String(summary).slice(0, 200);
        eventHold.beginForSpeech(text);
        sendState('reaction', text, text, 'reaction', {});
      }
    });
    return;
  }
  const dir = petTaskDir();
  fs.mkdirSync(dir, { recursive: true });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const taskFile = path.join(dir, `${id}.json`);
  const task = { id, type: taskType, status: 'pending', createdAt: new Date().toISOString() };
  fs.writeFileSync(taskFile, JSON.stringify(task, null, 2), 'utf8');
  eventHold.beginTask();
  sendState('reaction', '好的，爸！', '好的，爸', 'reaction', {
    speechAudio: typeof activeManifest?.taskAcceptAudio === 'string' ? activeManifest.taskAcceptAudio : ''
  });
  notifyQwenWork(taskType, taskFile);
  startPetTaskPolling();
}

function notifyQwenWork(taskType, taskFile) {
  const { execFile } = require('child_process');
  let exe = 'C:/Users/Thinkpad/.qwenworkcn/bin/lark-cli.cmd';
  if (process.platform === 'win32') {
    const coreExe = 'C:/Users/Thinkpad/.qwenworkcn/bin/ext/lark-cli-core-windows-amd64.exe';
    try { if (fs.existsSync(coreExe)) exe = coreExe; } catch (_) {}
  }
  const taskPrompts = {
    'summarize-chat': '总结群聊重点。对群里所有消息做总结，提炼核心内容，用一句话搞笑判官风格吐槽，不超过50字',
    'weekly-report': '写周报。用一句话搞笑总结这周群聊干了啥（或没干啥），不超过50字',
    'collect-gossip': '搜集群聊八卦。从群里消息中挖掘八卦和趣事，用一句话搞笑爆料，不超过50字'
  };
  const prompt = taskPrompts[taskType] || taskType;
  const message = `桌宠任务请求：${prompt}。请拉取飞书群 oc_55c490880d9fd2d16ffe1e86eeb81488 的最近30条消息（用 lark-cli api GET /open-apis/im/v1/messages --as user --params {"container_id_type":"chat","container_id":"oc_55c490880d9fd2d16ffe1e86eeb81488","page_size":30,"sort_type":"ByCreateTimeDesc"}），提炼后把结果 JSON 写入文件 ${taskFile}，格式为 {"status":"done","result":"总结内容"}。风格：判官吐槽，精炼幽默，50字以内。写完后桌宠自动弹气泡汇报。`;
  execFile(exe, ['im', '+messages-send', '--as', 'user',
    '--chat-id', 'oc_b808a8dca7f10072c3e76b66a18477c8',
    '--text', message],
  { timeout: 15000, windowsHide: true }, () => {});
}

function startPetTaskPolling() {
  if (petTaskPollTimer) return;
  petTaskPollTimer = setInterval(() => {
    const dir = petTaskDir();
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(dir, file);
      try {
        const task = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (task.status === 'done' && task.result) {
          const summary = String(task.result).slice(0, 200);
          eventHold.beginForSpeech(summary);
          sendState('reaction', summary, summary, 'reaction', {});
          fs.unlinkSync(filePath);
        }
      } catch (_) {}
    }
    const remaining = fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => file.endsWith('.json')) : [];
    if (!remaining.length) {
      clearInterval(petTaskPollTimer);
      petTaskPollTimer = null;
    }
  }, 3000);
}

function applyLoadedWatchConfig(next) {
  if (!watchConfig) {
    watchConfig = next;
    return;
  }
  for (const key of Object.keys(watchConfig)) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) delete watchConfig[key];
  }
  Object.assign(watchConfig, next);
}

function refreshTrayMenu() {
  tray?.setContextMenu(buildTrayMenu());
}

function persistWatchFlags(flags) {
  if (!watchConfigPath) return;
  patchWatchFlags(watchConfigPath, flags, { customer: deliveryConfig?.mode === 'customer' });
  applyLoadedWatchConfig(loadWatchConfig({
    configPath: watchConfigPath,
    manifestWatch: activeManifest?.watch,
    larkCliPath: undefined
  }));
  restartOfficeBus();
  restartMarketWatcher();
  refreshTrayMenu();
}

// Push the current market radar status + last quote to the renderer so the
// persistent ticker above the pet's head can show/hide and recolor live.
let lastMarketQuote = null;
function canRunOfficeBus() {
  if (duo.mode() === 'tent' || duo.mode() === 'slack') return false;
  return Boolean(watchConfig?.enabled && hasWatch(activeManifest));
}

function canPollCallHangup() {
  return Boolean(watchConfig?.callHangup?.enabled && hasCallHangupSequence(activeManifest));
}

function canWatchMarket() {
  if (duo.mode() === 'tent') return false;
  if (duo.mode() === 'slack') return true;
  return Boolean(watchConfig?.market?.enabled && hasMarketSequences(activeManifest));
}

function pushMarketStatus() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const market = watchConfig?.market;
  petWindow.webContents.send('pet:market', {
    enabled: canWatchMarket(),
    simulated: Boolean(market?.simulated) || lastMarketQuote?.name === '模拟盘',
    name: lastMarketQuote?.name || '',
    points: lastMarketQuote?.points,
    pct: lastMarketQuote?.pct,
    change: lastMarketQuote?.change,
    amount: lastMarketQuote?.amount,
    up: lastMarketQuote?.up,
    down: lastMarketQuote?.down,
    indices: Array.isArray(lastMarketQuote?.indices) ? lastMarketQuote.indices : [],
    klines: Array.isArray(lastMarketQuote?.klines) ? lastMarketQuote.klines : []
  });
}

function buildTrayMenu() {
  const pets = listPets();
  const template = [];
  const customActions = Array.isArray(activeManifest?.contextMenuActions) ? activeManifest.contextMenuActions : [];
  if (customActions.length) {
    template.push(...customActions.map((item) => ({ label: item.label, click: () => runContextMenuAction(item) })));
    template.push({ type: 'separator' });
  }
  const hasSlackMenu = customActions.some((item) => item.id === 'duo-slack');
  if (duo.mode() === 'folded' && hasDuoSlack(activeManifest) && !hasSlackMenu) {
    const slack = activeManifest?.duo?.slack || {};
    const enterLabel = typeof slack.enterLabel === 'string' && slack.enterLabel.trim()
      ? slack.enterLabel.trim()
      : '摸会儿鱼';
    template.push({ label: enterLabel, click: () => runContextMenuAction({ id: 'duo-slack' }) }, { type: 'separator' });
  }
  template.push({
    label: '当个事儿办',
    submenu: [
      { label: '写周报', click: () => triggerPetTask('weekly-report') },
      { label: '总结群聊信息重点', click: () => triggerPetTask('summarize-chat') },
      { label: '搜集群聊八卦', click: () => triggerPetTask('collect-gossip') }
    ]
  });
  template.push({ type: 'separator' });
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
        stopPeerWalk();
        sendState(idleState());
        if (duoIsOpen()) sendPeerState(peerIdleState());
        scheduleBehavior(1200);
        if (item.checked) schedulePeerBehavior(900);
      }
    },
    {
      label: '跪爬模式',
      type: 'checkbox',
      checked: settings.crawlMode,
      click: (item) => {
        settings.crawlMode = item.checked;
        saveSettings();
        if (interaction && interaction.state() !== 'normal') return;
        stopWalk();
        stopPeerWalk();
        sendState(idleState());
        if (duoIsOpen()) sendPeerState(peerIdleState());
        scheduleBehavior(600);
        schedulePeerBehavior(700);
      },
      visible: crawlAvailable()
    },
    {
      label: '始终置顶',
      type: 'checkbox',
      checked: topmostGuard?.isEnabled() ?? true,
      click: (item) => topmostGuard?.setEnabled(item.checked)
    },
    {
      label: watchMenuLabel(activeManifest),
      type: 'checkbox',
      checked: Boolean(watchConfig?.enabled),
      visible: hasWatch(activeManifest),
      click: (item) => persistWatchFlags({ enabled: item.checked })
    },
    {
      label: '拒接老板钉钉语音',
      type: 'checkbox',
      checked: Boolean(watchConfig?.callHangup?.enabled),
      visible: hasCallHangupSequence(activeManifest),
      click: (item) => persistWatchFlags({ callHangupEnabled: item.checked })
    },
    {
      label: '真实大盘（实时行情）',
      type: 'checkbox',
      checked: Boolean(watchConfig?.market?.enabled) && !watchConfig?.market?.simulated,
      visible: hasMarketSequences(activeManifest),
      click: (item) => {
        persistWatchFlags({ marketEnabled: item.checked, marketSimulated: false });
        if (item.checked) sendState('reaction', '真实大盘开启，翻红翻绿我第一个知道。');
      }
    },
    {
      label: '大盘模拟盘（随机涨跌测试）',
      type: 'checkbox',
      checked: Boolean(watchConfig?.market?.simulated),
      visible: hasMarketSequences(activeManifest),
      click: (item) => {
        persistWatchFlags({ marketEnabled: true, marketSimulated: item.checked });
        sendState('reaction', item.checked ? '模拟盘开启：随机翻红翻绿，坐稳了。' : '模拟盘关闭，回归真实行情。');
      }
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
        try { peerInteraction?.dispose?.(); } catch (_) {}
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
  mouseThroughGuard = createMouseThroughGuard({
    getWindow: () => petWindow,
    getCursorPoint: () => screen.getCursorScreenPoint()
  });
  topmostGuard.ensure();
  interaction = createInteractionController({
    window: petWindow,
    discovery: createWindowDiscovery({ screen }),
    screen,
    getCurrentSize: windowSize,
    // When Duo is open, petWindow hosts the LEFT member view, so its interaction
    // controller must resolve interactionActions/animations against that member.
    getManifest: () => petWindowView(),
    isSuspended: () => sequence?.isActive?.() === true || duo.mode() === 'tent' || duo.mode() === 'slack',
    sendState: (state, options) => {
      const role = options?.logicalRole || state;
      const mapped = mapSuspendedInteractionState(state, role);
      sendState(
        mapped.state,
        typeof options?.message === 'string' ? options.message : '',
        typeof options?.speech === 'string' ? options.speech : '',
        mapped.role,
        options
      );
    },
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
  petWindow.webContents.on('did-finish-load', () => pushMarketStatus());
  petWindow.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
    if (!isAlwaysOnTop && topmostGuard?.isEnabled()) setImmediate(() => topmostGuard?.ensure());
  });
  petWindow.loadFile(indexPath);
  petWindow.once('ready-to-show', () => {
    petWindow.showInactive();
    topmostGuard?.ensure();
    sendState('reaction', resolveStartupGreeting(activeManifest), '', 'reaction', {
      speechAudio: typeof activeManifest?.startupGreetingAudio === 'string' ? activeManifest.startupGreetingAudio : ''
    });
    scheduleBehavior(3600);
  });
  petWindow.on('close', (event) => {
    if (!quitting) { event.preventDefault(); hidePet(); }
  });
  petWindow.on('closed', () => mouseThroughGuard?.dispose());
}

// ── Duo second window ────────────────────────────────────────────────────
// Creates the RIGHT member window by cloning the exact transparent/preload/
// sandbox options of `petWindow`, each with its own topmost + click-through
// guards and its own interaction controller. Returns false on any failure so
// the caller can stay folded.
function createDuoPeerWindow() {
  if (duoIsOpen()) return true;
  try {
    const origin = petWindow.getBounds();
    const workArea = getWorkAreaForBounds(origin);
    const size = memberWindowSize(currentSize());
    const initial = placeUnfoldedPair(origin, size, workArea).right;
    duoPeerWindow = new BrowserWindow({
      width: size.width,
      height: size.height,
      x: initial.x,
      y: initial.y,
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
    peerTopmostGuard = createTopmostGuard({ getWindow: () => duoPeerWindow });
    peerMouseThroughGuard = createMouseThroughGuard({
      getWindow: () => duoPeerWindow,
      getCursorPoint: () => screen.getCursorScreenPoint()
    });
    peerTopmostGuard.ensure();
    peerInteraction = createInteractionController({
      window: duoPeerWindow,
      discovery: createWindowDiscovery({ screen }),
      screen,
      getCurrentSize: windowSize,
      getManifest: () => memberView(peerMember),
      isSuspended: () => false,
      sendState: (state, options) => sendPeerState(
        state,
        typeof options?.message === 'string' ? options.message : '',
        typeof options?.speech === 'string' ? options.speech : '',
        options?.logicalRole || state,
        options
      ),
      pauseBehavior: pausePeerBehavior,
      resumeBehavior: () => schedulePeerBehavior(2500),
      ensureOnTop: () => peerTopmostGuard?.ensure(),
      edgeGap: EDGE_GAP,
      bottomOffset: 6
    });
    const indexPath = path.join(__dirname, 'index-v3.html');
    const indexUrl = pathToFileURL(indexPath).toString();
    duoPeerWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    duoPeerWindow.webContents.on('will-navigate', (event, url) => { if (url !== indexUrl) event.preventDefault(); });
    duoPeerWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
    duoPeerWindow.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
      if (!isAlwaysOnTop && peerTopmostGuard?.isEnabled()) setImmediate(() => peerTopmostGuard?.ensure());
    });
    duoPeerWindow.webContents.on('did-finish-load', () => {
      syncPeerWindow({ delay: 700 });
      peerTopmostGuard?.ensure();
    });
    duoPeerWindow.loadFile(indexPath);
    duoPeerWindow.once('ready-to-show', () => {
      duoPeerWindow.showInactive();
      peerTopmostGuard?.ensure();
    });
    duoPeerWindow.on('closed', () => peerMouseThroughGuard?.dispose());
    return true;
  } catch (error) {
    console.warn(`Duo peer window failed to open: ${error.message}`);
    destroyDuoPeerWindow();
    return false;
  }
}

function destroyDuoPeerWindow() {
  pausePeerBehavior();
  try { peerInteraction?.dispose?.(); } catch (_) {}
  try { if (duoPeerWindow && !duoPeerWindow.isDestroyed()) duoPeerWindow.destroy(); } catch (_) {}
  duoPeerWindow = null;
  peerInteraction = null;
  peerTopmostGuard = null;
  peerMouseThroughGuard = null;
  peerMember = null;
}

// Commit an unfold: keep the pair at the current window, shrink to member size,
// and place the right brother just beside the left one.
function openDuoWindows() {
  if (!hasDuo(activeManifest)) return false;
  const leftMember = duoMemberBySide('left');
  const rightMember = duoMemberBySide('right');
  if (!leftMember || !rightMember) return false;
  peerMember = rightMember;
  if (!createDuoPeerWindow()) {
    peerMember = null;
    return false;
  }
  const origin = petWindow.getBounds();
  const workArea = getWorkAreaForBounds(origin);
  const size = memberWindowSize(currentSize());
  const placed = placeUnfoldedPair(origin, size, workArea);
  petWindow.setBounds(placed.left, false);
  petWindow.webContents.send('pet:load', publicMemberManifest(leftMember));
  duoPeerWindow.setBounds(placed.right, false);
  sendState(idleState());
  syncPeerWindow({ load: false, delay: 900 });
  try { duoPeerWindow.showInactive(); } catch (_) {}
  tray?.setContextMenu(buildTrayMenu());
  resumeDuoBehaviors(1200, 900);
  return true;
}

function duoTransitionAction(kind) {
  const key = kind === 'fold' ? 'foldAction' : 'unfoldAction';
  const name = activeManifest?.duo?.[key];
  if (typeof name !== 'string' || !name.trim()) return '';
  return activeManifest?.animations?.[name] ? name : '';
}

function duoActionDuration(name) {
  const frames = activeManifest?.animations?.[name];
  if (!frames || !Array.isArray(frames.durations)) return 0;
  return frames.durations.reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function playDuoTransition(kind) {
  const action = duoTransitionAction(kind);
  if (!action) return 0;
  sendState(action);
  return Math.max(700, Math.min(1800, duoActionDuration(action) || 1000));
}

function playOpenDuoReactions() {
  if (duoMemberBySide('left')?.animations?.reaction) sendState('reaction');
  if (duoMemberBySide('right')?.animations?.reaction) sendPeerState('reaction');
}

function clearDuoSettle() {
  if (duoSettleTimer) {
    clearTimeout(duoSettleTimer);
    duoSettleTimer = undefined;
  }
}

function settleDuoThen(ms, next) {
  clearDuoSettle();
  duoSettleTimer = setTimeout(() => {
    duoSettleTimer = undefined;
    next();
  }, Math.max(0, Number(ms) || 0));
}

// Commit a fold: destroy the peer and return petWindow to the folded (root
// two-person) manifest.
function closeDuoWindows() {
  const stayAt = duoFoldAnchorBounds;
  destroyDuoPeerWindow();
  if (petWindow && !petWindow.isDestroyed()) {
    const origin = stayAt || petWindow.getBounds();
    const folded = currentSize();
    const workArea = getWorkAreaForBounds(origin);
    petWindow.setBounds(clampToWorkArea({
      x: origin.x + Math.round((origin.width - folded.width) / 2),
      y: origin.y + origin.height - folded.height,
      width: folded.width,
      height: folded.height
    }, workArea), false);
    const foldAction = duoTransitionAction('fold');
    if (foldAction) sendState(foldAction);
    petWindow.webContents.send('pet:load', publicManifest(activeManifest));
    tray?.setContextMenu(buildTrayMenu());
    clearDuoFoldLayout();
    scheduleBehavior(foldAction ? Math.max(1600, duoActionDuration(foldAction) + 400) : 1200);
    return;
  }
  clearDuoFoldLayout();
  tray?.setContextMenu(buildTrayMenu());
  scheduleBehavior(1200);
}

function sendDuoOverlay(win, active, overrides) {
  if (!win || win.isDestroyed()) return;
  const progress = Number.isFinite(overrides?.progress) ? overrides.progress : duo.progress();
  win.webContents.send('pet:duo-overlay', {
    active,
    progress,
    direction: overrides?.direction || duo.direction(),
    phase: overrides?.phase || duo.mode(),
    side: overrides?.side,
    slackStage: overrides?.slackStage,
    introLeft: overrides?.introLeft,
    introRight: overrides?.introRight,
    clips: overrides?.clips,
    board: overrides?.board
  });
}

function sendDuoOverlays(active, overrides) {
  sendDuoOverlay(petWindow, active, { ...overrides, side: 'left' });
  sendDuoOverlay(duoPeerWindow, active, { ...overrides, side: 'right' });
}

function applyUnfoldTabletFrame(direction, origin = petWindow?.getBounds()) {
  if (!petWindow || petWindow.isDestroyed() || !origin) return;
  const workArea = getWorkAreaForBounds(origin);
  petWindow.setBounds(
    placeTabletWindow(origin, tabletWindowSize(currentSize()), workArea, direction === 'left' ? 'left' : 'right'),
    false
  );
}

function tentAction() {
  const action = activeManifest?.duo?.tent?.action;
  if (typeof action === 'string' && activeManifest?.animations?.[action]) return action;
  return 'idle';
}

function mapSuspendedInteractionState(state, role) {
  const mode = duo.mode();
  const token = String(state || '');
  const roleName = String(role || '');
  const idleReturn = token === 'normal' || roleName === 'normal';
  const dragPose = token === 'drag' || roleName === 'drag'
    || token.startsWith('drag-') || roleName.startsWith('drag-');
  if (mode === 'tent' && idleReturn) {
    const action = tentAction();
    return { state: action, role: action };
  }
  if (mode === 'slack' && (idleReturn || dragPose)) {
    const action = slackAction('carryAction', 'idle') || 'idle';
    return { state: action, role: action };
  }
  return { state, role };
}

function tentOverlayProgress() {
  return tentOpenProgress(activeManifest?.duo?.tent?.openProgress);
}

function applyTentPresentation() {
  if (!petWindow || petWindow.isDestroyed() || duo.mode() !== 'tent') return;
  restorePetWindowSize();
  sendDuoOverlay(petWindow, true, { progress: tentOverlayProgress(), phase: 'tent' });
  sendState(tentAction());
  pushMarketStatus();
  restartOfficeBus();
  tray?.setContextMenu(buildTrayMenu());
}

function tentViaMenu() {
  if (!hasDuoTent(activeManifest) || duo.mode() !== 'folded') return;
  pauseBehavior();
  pausePeerBehavior();
  if (!duo.beginTent()) return;
  applyTentPresentation();
}

function leaveTentViaMenu() {
  if (duo.mode() !== 'tent' || !duo.leaveTent()) return;
  sendDuoOverlay(petWindow, false);
  restorePetWindowSize();
  sendState(idleState());
  pushMarketStatus();
  restartOfficeBus();
  scheduleBehavior(900);
  tray?.setContextMenu(buildTrayMenu());
}

function clearSlackTimer() {
  if (duoSlackTimer) {
    clearTimeout(duoSlackTimer);
    duoSlackTimer = undefined;
  }
}

function slackConfig() {
  return activeManifest?.duo?.slack || {};
}

function slackAction(key, fallback = '') {
  const action = slackConfig()[key];
  if (typeof action === 'string' && activeManifest?.animations?.[action]) return action;
  return fallback && activeManifest?.animations?.[fallback] ? fallback : '';
}

function slackIntroFrame(side) {
  const member = duoMemberBySide(side);
  const frame = member?.animations?.idle?.frames?.[0];
  return typeof frame === 'string' ? petAssetUrl(activeManifest.id, frame) : '';
}

function slackClips() {
  const clips = slackConfig().clips;
  return Array.isArray(clips)
    ? clips.filter((clip) => typeof clip === 'string' && clip).map((clip) => petAssetUrl(activeManifest.id, clip))
    : [];
}

function applySlackPresentation(slackStage) {
  if (!petWindow || petWindow.isDestroyed() || duo.mode() !== 'slack') return;
  const origin = petWindow.getBounds();
  const size = slackWindowSize(currentSize(), SLACK_EXTRA_HEIGHT);
  const workArea = getWorkAreaForBounds(origin);
  petWindow.setBounds(placeSlackWindow(origin, size, workArea), false);
  sendDuoOverlay(petWindow, true, {
    progress: 1,
    phase: 'slack',
    slackStage,
    introLeft: slackIntroFrame('left'),
    introRight: slackIntroFrame('right'),
    clips: slackClips(),
    board: null
  });
  pushMarketStatus();
  restartMarketWatcher();
  restartOfficeBus();
  tray?.setContextMenu(buildTrayMenu());
}

function slackViaMenu() {
  if (!hasDuoSlack(activeManifest) || duo.mode() !== 'folded') return;
  pauseBehavior();
  pausePeerBehavior();
  if (!duo.beginSlack()) return;
  clearSlackTimer();
  applySlackPresentation('intro');
  duoSlackTimer = setTimeout(() => {
    duoSlackTimer = undefined;
    if (duo.mode() !== 'slack') return;
    applySlackPresentation('jump');
    const jumpAction = slackAction('jumpAction');
    if (jumpAction) sendState(jumpAction);
    const jumpMs = jumpAction ? Math.max(500, Math.min(1800, duoActionDuration(jumpAction) || 900)) : 0;
    duoSlackTimer = setTimeout(() => {
      duoSlackTimer = undefined;
      if (duo.mode() !== 'slack') return;
      applySlackPresentation('carry');
      sendState(slackAction('carryAction', 'idle') || 'idle');
    }, jumpMs);
  }, 700);
}

function leaveSlackViaMenu() {
  if (duo.mode() !== 'slack' || !duo.leaveSlack()) return;
  clearSlackTimer();
  sendDuoOverlay(petWindow, false);
  restorePetWindowSize();
  sendState('idle');
  scheduleBehavior(1200);
  pushMarketStatus();
  restartOfficeBus();
  tray?.setContextMenu(buildTrayMenu());
}

function buildSlackMenu() {
  const slack = slackConfig();
  const leaveLabel = typeof slack.leaveLabel === 'string' && slack.leaveLabel.trim()
    ? slack.leaveLabel.trim()
    : '收工了';
  return Menu.buildFromTemplate([
    { label: leaveLabel, click: () => leaveSlackViaMenu() },
    { type: 'separator' },
    { label: '暂时藏起来', click: hidePet },
    {
      label: `退出${deliveryConfig?.appName || '桌宠播放器'}`,
      click: () => {
        quitting = true;
        interaction?.dispose();
        try { peerInteraction?.dispose?.(); } catch (_) {}
        app.quit();
      }
    }
  ]);
}

function buildTentMenu() {
  const tent = activeManifest?.duo?.tent || {};
  const leaveLabel = typeof tent.leaveLabel === 'string' && tent.leaveLabel.trim()
    ? tent.leaveLabel.trim()
    : '收起来';
  const rest = (activeManifest?.contextMenuActions || []).find((item) => item.id === 'rest');
  const template = [
    { label: leaveLabel, click: () => leaveTentViaMenu() },
    { label: '展开', click: () => unfoldViaMenu() }
  ];
  if (rest && rest.label) {
    template.push({ label: rest.label, click: () => runDirectMenuAction(rest) });
  }
  template.push(
    { type: 'separator' },
    { label: '暂时藏起来', click: hidePet },
    {
      label: `退出${deliveryConfig?.appName || '桌宠播放器'}`,
      click: () => {
        quitting = true;
        interaction?.dispose();
        try { peerInteraction?.dispose?.(); } catch (_) {}
        app.quit();
      }
    }
  );
  return Menu.buildFromTemplate(template);
}

function foldWindows() {
  const moving = duoFoldFromSide === 'right' ? duoPeerWindow : petWindow;
  const staying = duoFoldFromSide === 'right' ? petWindow : duoPeerWindow;
  return { moving, staying };
}

function sendFoldMovingOverlay(active, progress) {
  const { moving, staying } = foldWindows();
  sendDuoOverlay(staying, false);
  sendDuoOverlay(moving, active, {
    progress,
    phase: 'folding',
    side: duoFoldFromSide
  });
}

function clearDuoFoldLayout() {
  if (duoFoldAnimTimer) {
    clearTimeout(duoFoldAnimTimer);
    duoFoldAnimTimer = undefined;
  }
  duoFoldFromSide = null;
  duoFoldMovingStart = null;
  duoFoldAnchorBounds = null;
  duoFoldVisual = 0;
}

function beginDuoFoldLayout(fromSide) {
  duoFoldFromSide = fromSide === 'right' ? 'right' : 'left';
  const { moving, staying } = foldWindows();
  if (!moving || moving.isDestroyed() || !staying || staying.isDestroyed()) return;
  duoFoldMovingStart = { ...moving.getBounds() };
  duoFoldAnchorBounds = { ...staying.getBounds() };
  try { moving.moveTop(); } catch (_) {}
  applyDuoFoldLayout(0);
  sendFoldMovingOverlay(true, 0);
}

function applyDuoFoldLayout(progress) {
  if (!duoFoldMovingStart || !duoFoldAnchorBounds) return;
  const { moving, staying } = foldWindows();
  if (moving && !moving.isDestroyed()) {
    moving.setBounds(foldMovingBounds(progress, duoFoldMovingStart, duoFoldAnchorBounds), false);
  }
  if (staying && !staying.isDestroyed()) {
    staying.setBounds(duoFoldAnchorBounds, false);
  }
  duoFoldVisual = progress;
}

function restoreOpenDuoWindows() {
  const { moving, staying } = foldWindows();
  if (moving && !moving.isDestroyed() && duoFoldMovingStart) {
    moving.setBounds(duoFoldMovingStart, false);
  }
  if (staying && !staying.isDestroyed() && duoFoldAnchorBounds) {
    staying.setBounds(duoFoldAnchorBounds, false);
  }
}

function animateDuoFoldThen(done) {
  const from = duoFoldVisual;
  if (from >= 1) {
    done();
    return;
  }
  const started = Date.now();
  const duration = 420;
  function step() {
    const t = Math.min(1, from + (1 - from) * ((Date.now() - started) / duration));
    applyDuoFoldLayout(t);
    sendFoldMovingOverlay(true, t);
    if (t < 1) {
      duoFoldAnimTimer = setTimeout(step, 16);
      return;
    }
    duoFoldAnimTimer = undefined;
    done();
  }
  step();
}

function cancelDuoTransition() {
  clearDuoSettle();
  const mode = duo.mode();
  if (mode === 'unfolding' || mode === 'folding') {
    duo.cancel();
    if (mode === 'folding') restoreOpenDuoWindows();
    sendDuoOverlays(false);
    if (duoActiveWindow) sendDuoOverlay(duoActiveWindow, false);
    if (duo.mode() === 'tent') applyTentPresentation();
    else if (duo.mode() === 'folded') restorePetWindowSize();
  }
  clearDuoFoldLayout();
  duoActiveWindow = null;
  duoTooNarrowNotified = false;
}

// Drive a full-progress fold from a menu item (`id === 'duo-fold'`).
function foldViaMenu(side) {
  if (duo.mode() !== 'open') return;
  if (!duo.beginFold(side)) return;
  pauseBehavior();
  pausePeerBehavior();
  playOpenDuoReactions();
  const win = side === 'right' ? duoPeerWindow : petWindow;
  const anchor = win && !win.isDestroyed() ? win : petWindow;
  const workArea = getWorkAreaForBounds(anchor.getBounds());
  duo.setTravelPx(unfoldTravelPx(workArea.width));
  duo.updateDrag(side === 'left' ? workArea.width : -workArea.width);
  beginDuoFoldLayout(side);
  animateDuoFoldThen(() => {
    if (duo.release().commit) closeDuoWindows();
    sendDuoOverlays(false);
    clearDuoFoldLayout();
  });
}

// Drive a full-progress unfold from a menu item (`id === 'duo-unfold'`), used
// as a fallback when the drag gesture is awkward.
function unfoldViaMenu() {
  if ((duo.mode() !== 'folded' && duo.mode() !== 'tent') || !hasDuo(activeManifest)) return;
  const workArea = getWorkAreaForBounds(petWindow.getBounds());
  if (!canUnfold(workArea, memberWindowSize(currentSize()))) {
    sendState('reaction', '太挤了，展不开');
    return;
  }
  const fromTent = duo.mode() === 'tent';
  if (!duo.beginUnfold('right', fromTent ? { fromMenu: true } : undefined)) return;
  applyUnfoldTabletFrame('right');
  pauseBehavior();
  pausePeerBehavior();
  const waitMs = playDuoTransition('unfold');
  duo.setTravelPx(unfoldTravelPx(workArea.width));
  duo.updateDrag(workArea.width);
  sendDuoOverlay(petWindow, true, { progress: 1, phase: 'unfolding' });
  if (duo.progress() >= duoGesture().snapProgress) {
    settleDuoThen(waitMs, () => {
      if (openDuoWindows()) duo.release();
      else {
        duo.cancel();
        if (duo.mode() === 'tent') applyTentPresentation();
        else {
          restorePetWindowSize();
          sendState('reaction', '展不开，再试一次');
        }
        scheduleBehavior(1500);
      }
      if (duo.mode() !== 'tent') sendDuoOverlay(petWindow, false);
    });
  } else {
    duo.cancel();
    if (duo.mode() === 'tent') applyTentPresentation();
    else {
      restorePetWindowSize();
      sendDuoOverlay(petWindow, false);
    }
    scheduleBehavior(1200);
  }
}

// Which window(s) should receive a watch (画饼雷达) hit: folded → petWindow;
// open → only the member flagged `watch: true`.
function targetWatchWindow() {
  if (duoIsOpen() && hasDuo(activeManifest)) {
    const watchMember = duoMembers().find((m) => m.watch === true);
    if (watchMember && watchMember.side === 'right') return duoPeerWindow;
  }
  return petWindow;
}

function dispatchWatchState(state, message, speech, options) {
  if (duo.mode() === 'tent' || duo.mode() === 'slack') return;
  const win = targetWatchWindow();
  if (win === duoPeerWindow) sendPeerState(state, message, speech, state, options || {});
  else sendState(state, message, speech, state, options || {});
}

// Per-member right-click menu (open state): member's own actions, plus watch
// toggle for the watch member, hide and quit. `id === 'duo-fold'` intercepts.
function buildMemberMenu(member, side) {
  const template = [];
  const actions = Array.isArray(member?.contextMenuActions) ? member.contextMenuActions : [];
  if (actions.length) {
    template.push(...actions.map((item) => ({ label: item.label, click: () => runMemberMenuAction(member, side, item) })));
    template.push({ type: 'separator' });
  }
  if (member?.watch === true && hasWatch(activeManifest)) {
    template.push({
      label: watchMenuLabel(activeManifest),
      type: 'checkbox',
      checked: Boolean(watchConfig?.enabled),
      click: (item) => persistWatchFlags({ enabled: item.checked })
    }, { type: 'separator' });
  }
  template.push({ label: '暂时藏起来', click: hidePet });
  template.push({
    label: `退出${deliveryConfig?.appName || '桌宠播放器'}`,
    click: () => {
      quitting = true;
      interaction?.dispose();
      try { peerInteraction?.dispose?.(); } catch (_) {}
      app.quit();
    }
  });
  return Menu.buildFromTemplate(template);
}

function runMemberMenuAction(member, side, item) {
  if (!item) return;
  if (item.id === 'duo-fold') { foldViaMenu(side); return; }
  let choice = item;
  if (Array.isArray(item.randomActions) && item.randomActions.length) {
    choice = item.randomActions[Math.floor(Math.random() * item.randomActions.length)];
  }
  if (!choice || !choice.action || !member?.animations?.[choice.action]) return;
  if (side === 'right') pausePeerBehavior();
  else pauseBehavior();
  const emit = side === 'right' ? sendPeerState : sendState;
  emit(choice.action, choice.message || '', choice.speech || '', choice.action, { speechAudio: choice.speechAudio || '' });
  if (side === 'right') schedulePeerBehavior(2800);
  else scheduleBehavior(2800);
}

function windowForSender(event) {
  if (petWindow && !petWindow.isDestroyed()
    && event.sender === petWindow.webContents && event.senderFrame === petWindow.webContents.mainFrame) {
    return petWindow;
  }
  if (duoPeerWindow && !duoPeerWindow.isDestroyed()
    && event.sender === duoPeerWindow.webContents && event.senderFrame === duoPeerWindow.webContents.mainFrame) {
    return duoPeerWindow;
  }
  return null;
}

function interactionForWindow(win) {
  return win === duoPeerWindow ? peerInteraction : interaction;
}

function setMouseThroughFor(win, ignore) {
  if (win === duoPeerWindow) peerMouseThroughGuard?.set(ignore);
  else mouseThroughGuard?.set(ignore);
}

function trustedIpc(event) {
  return windowForSender(event) !== null;
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

// Window-aware variants: pass the resolved source window (petWindow or the duo
// peer) so per-window interaction controllers and guards can be targeted.
function handleTrustedWin(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    const win = windowForSender(event);
    if (!win) throw new Error('拒绝来自非受信渲染页面的 IPC 请求');
    return listener(win, ...args);
  });
}

function onTrustedWin(channel, listener) {
  ipcMain.on(channel, (event, ...args) => {
    const win = windowForSender(event);
    if (win) listener(win, ...args);
  });
}

function validPointer(pointer) {
  return pointer && Number.isFinite(pointer.screenX) && Number.isFinite(pointer.screenY) && Math.abs(pointer.screenX) < 1000000 && Math.abs(pointer.screenY) < 1000000;
}

function validVisibleInsets(insets) {
  const size = windowSize();
  return insets && ['left', 'top', 'right', 'bottom'].every((side) => {
    const limit = side === 'left' || side === 'right' ? size.width : size.height;
    return Number.isFinite(insets[side]) && insets[side] >= 0 && insets[side] < limit;
  });
}

handleTrustedWin('pet:get-current', (win) => {
  if (duoIsOpen() && hasDuo(activeManifest)) {
    return publicMemberManifest(win === duoPeerWindow ? duoMemberBySide('right') : duoMemberBySide('left'));
  }
  return publicManifest(activeManifest);
});
handleTrusted('pet:import', () => {
  if (deliveryConfig && !deliveryConfig.allowPetManagement) return null;
  return promptImportPetpack();
});
onTrustedWin('pet:drag-start', (win, pointer) => {
  const inter = interactionForWindow(win);
  if (!inter || !validPointer(pointer)) return;
  // Left-drag on any window aborts an in-progress fold/unfold back to prior state.
  cancelDuoTransition();
  if (win === petWindow && sequence?.isActive()) sequence.cancel({ schedule: false });
  setMouseThroughFor(win, false);
  inter.startDrag(pointer);
});
onTrustedWin('pet:drag-move', (win, pointer) => {
  const inter = interactionForWindow(win);
  if (!inter || !validPointer(pointer)) return;
  inter.moveDrag(pointer);
});
onTrustedWin('pet:drag-end', (win, pointer) => {
  const inter = interactionForWindow(win);
  if (!inter || !validPointer(pointer)) return;
  void inter.endDrag(pointer).catch((error) => {
    console.warn(`Window interaction ended unexpectedly: ${error.message}`);
  });
});
onTrustedWin('pet:visible-insets', (win, insets) => {
  const inter = interactionForWindow(win);
  if (inter && validVisibleInsets(insets)) inter.updateVisibleInsets(insets);
});
onTrustedWin('pet:set-mouse-through', (win, ignore) => {
  const inter = interactionForWindow(win);
  if (!inter || inter.state() !== 'dragging') setMouseThroughFor(win, Boolean(ignore));
});
onTrustedWin('pet:interact', (win) => {
  const inter = interactionForWindow(win);
  if (inter && inter.state() !== 'normal') return;
  if (duo.mode() === 'tent' || duo.mode() === 'slack') return;
  if (win === duoPeerWindow) {
    pausePeerBehavior();
    sendPeerState('reaction', '整点儿活儿？');
    schedulePeerBehavior(2800);
    return;
  }
  if (sequence?.isWaitingForClick()) {
    sequence.continueFromClick();
    return;
  }
  if (sequence?.isActive()) return;
  pauseBehavior();
  sendState('reaction', '不要丢下我呀 ♥');
  scheduleBehavior(3400);
});
onTrustedWin('pet:duo-pointer-down', (win) => {
  if (!hasDuo(activeManifest)) return;
  duoActiveWindow = win;
  duoTooNarrowNotified = false;
});
onTrustedWin('pet:duo-pointer-move', (win, payload) => {
  if (!hasDuo(activeManifest) || !payload) return;
  const gesture = duoGesture();
  const cls = classifyRightPointer({ dx: payload.dx, dy: payload.dy, menuSlopPx: gesture.menuSlopPx, commitPx: gesture.commitPx });
  const mode = duo.mode();
  if (mode === 'slack') return;
  if (mode === 'folded') {
    if (cls.kind !== 'duo') return;
    const workArea = getWorkAreaForBounds(win.getBounds());
    if (!canUnfold(workArea, memberWindowSize(currentSize()))) {
      if (!duoTooNarrowNotified) {
        duoTooNarrowNotified = true;
        sendState('reaction', '太挤了，展不开');
      }
      return;
    }
    if (!duo.beginUnfold(cls.direction)) return;
    duoActiveWindow = win;
    applyUnfoldTabletFrame(cls.direction, win.getBounds());
    pauseBehavior();
    pausePeerBehavior();
    playDuoTransition('unfold');
    duo.setTravelPx(unfoldTravelPx(workArea.width));
    duo.updateDrag(payload.dx);
    sendDuoOverlay(win, true);
  } else if (mode === 'unfolding') {
    duo.updateDrag(payload.dx);
    sendDuoOverlay(duoActiveWindow || win, true);
  } else if (mode === 'open') {
    if (cls.kind !== 'duo') return;
    const side = win === duoPeerWindow ? 'right' : 'left';
    const towardCenter = (side === 'left' && payload.dx > 0) || (side === 'right' && payload.dx < 0);
    if (!towardCenter) return;
    if (!duo.beginFold(side)) return;
    duoActiveWindow = win;
    pauseBehavior();
    pausePeerBehavior();
    playOpenDuoReactions();
    const workArea = getWorkAreaForBounds(win.getBounds());
    duo.setTravelPx(unfoldTravelPx(workArea.width));
    duo.updateDrag(payload.dx);
    beginDuoFoldLayout(side);
  } else if (mode === 'folding') {
    duo.updateDrag(payload.dx);
    applyDuoFoldLayout(duo.progress());
    sendFoldMovingOverlay(true, duo.progress());
  }
});
onTrustedWin('pet:duo-pointer-up', (win) => {
  if (!hasDuo(activeManifest)) return;
  duoTooNarrowNotified = false;
  const mode = duo.mode();
  if (mode === 'slack') {
    duoActiveWindow = null;
    return;
  }
  const overlayWin = duoActiveWindow || win;
  if (mode === 'unfolding') {
    const willCommit = duo.progress() >= duoGesture().snapProgress;
    if (willCommit) {
      sendDuoOverlay(overlayWin, true, { progress: 1, phase: 'unfolding' });
      settleDuoThen(duoTransitionAction('unfold') ? Math.max(700, Math.min(1400, duoActionDuration(duoTransitionAction('unfold')))) : 400, () => {
        if (openDuoWindows()) {
          duo.release();
        } else {
          duo.cancel();
          restorePetWindowSize();
          sendState('reaction', '展不开，再试一次');
          scheduleBehavior(1500);
        }
        sendDuoOverlay(overlayWin, false);
        duoActiveWindow = null;
      });
      return;
    }
    duo.release();
    sendDuoOverlay(overlayWin, false);
    restorePetWindowSize();
    scheduleBehavior(1500);
  } else if (mode === 'folding') {
    if (duo.progress() >= duoGesture().snapProgress) {
      animateDuoFoldThen(() => {
        if (duo.release().commit) closeDuoWindows();
        sendDuoOverlays(false);
        sendDuoOverlay(overlayWin, false);
        clearDuoFoldLayout();
        duoActiveWindow = null;
      });
      return;
    }
    duo.release();
    restoreOpenDuoWindows();
    sendDuoOverlays(false);
    sendDuoOverlay(overlayWin, false);
    clearDuoFoldLayout();
    resumeDuoBehaviors(1500, 1200);
  }
  duoActiveWindow = null;
});
onTrustedWin('pet:duo-pointer-cancel', () => {
  cancelDuoTransition();
});
onTrustedWin('pet:context-menu', (win) => {
  if (!win || win.isDestroyed()) return;
  setMouseThroughFor(win, false);
  // Open state: each window shows its own member menu. Right = RIGHT member,
  // left window = LEFT member. Folded (or non-duo) keeps the full tray menu.
  let menu;
  if (duo.mode() === 'slack' && hasDuoSlack(activeManifest)) {
    menu = buildSlackMenu();
  } else if (duo.mode() === 'tent' && hasDuoTent(activeManifest)) {
    menu = buildTentMenu();
  } else if (duoIsOpen() && hasDuo(activeManifest)) {
    menu = win === duoPeerWindow
      ? buildMemberMenu(duoMemberBySide('right'), 'right')
      : buildMemberMenu(duoMemberBySide('left'), 'left');
  } else {
    menu = buildTrayMenu();
  }
  menu.popup({
    window: win,
    callback: () => {
      if (win === duoPeerWindow) restorePeerWindowSize();
      else restorePetWindowSize();
      setMouseThroughFor(win, false);
    }
  });
});

onTrustedWin('pet:slack-exit', () => {
  leaveSlackViaMenu();
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
    const voiceCacheRoot = path.join(app.getPath('userData'), 'voice-cache');
    fs.mkdirSync(voiceCacheRoot, { recursive: true });
    protocol.handle('voice-cache', async (request) => {
      const parsed = new URL(request.url);
      // 标准 scheme 下 hash 可能落在 hostname 或 pathname，拼接兜底提取文件名
      const name = decodeURIComponent(`${parsed.hostname}${parsed.pathname.replace(/^\//, '')}`);
      if (!/^[a-f0-9]{32}\.mp3$/.test(name)) throw new Error('拒绝访问非语音缓存文件');
      const filePath = resolveInside(voiceCacheRoot, name);
      const data = await fs.promises.readFile(filePath);
      return new Response(data, {
        headers: { 'content-type': 'audio/mpeg', 'access-control-allow-origin': '*' }
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
    duo = makeDuoController();
    createWindow();
    sequence = createSequenceController({
      getManifest: () => activeManifest,
      sendState: (action, message, speech, extras) => {
        sendState(action, message, speech, action, extras || {});
      },
      pauseBehavior,
      scheduleBehavior,
      getPetBounds: () => petWindow.getBounds(),
      movePetWindow: movePetKeepingSize
    });
    createTray();
    watchConfigPath = path.join(app.getPath('userData'), 'boss-watch.json');
    ensureBossWatchDefaults(watchConfigPath, { customer: deliveryConfig?.mode === 'customer' });
    applyLoadedWatchConfig(loadWatchConfig({
      configPath: watchConfigPath,
      manifestWatch: activeManifest?.watch,
      larkCliPath: undefined // 由 boss-watch.json 提供；缺失时用默认路径兜底
    }));
    refreshTrayMenu();
    if (process.env.PET_WATCH_DEBUG === '1') { try { require('fs').appendFileSync('C:/Users/Thinkpad/.qwenworkcn/workspace/msr5talezbqs189b/watcher-debug.log', new Date().toISOString() + ' MAIN watchConfigPath=' + watchConfigPath + ' enabled=' + watchConfig.enabled + ' ids=' + JSON.stringify(watchConfig.ids) + ' larkCliPath=' + watchConfig.larkCliPath + '\n'); } catch (_) {} }
    if (watchConfig.names.length > 0) {
      sendState('reaction', '画饼雷达：老板名单中的姓名待解析，请使用 open_id 或扫码授权后自动解析。');
    }
    const watchSendState = (state, message, speech, opts) => {
      eventHold.beginForSpeech(message || speech);
      // 画饼雷达命中：折叠态发 petWindow；展开态只发 watch: true 的成员窗。
      dispatchWatchState(state, message, speech, opts);
    };
    const cooldownMap = new Map();
    let voice = watchConfig.enabled
      ? createVoiceSynthesizer({
        cacheDir: path.join(app.getPath('userData'), 'voice-cache'),
        voice: watchConfig.voice.voice,
        rate: watchConfig.voice.rate
      })
      : null;
    const dbgLogPath = path.join(app.getPath('userData'), 'dingtalk-uia-debug.log');
    const dbg = (line) => {
      if (process.env.PET_DINGTALK_DEBUG !== '1') return;
      try { require('fs').appendFileSync(dbgLogPath, `${new Date().toISOString()} ${line}\n`); } catch (_) {}
    };
    const dingtalkUia = createDingtalkUia({
      rectToDip: (rect) => screen.screenToDipRect(null, rect),
      debugLogPath: dbgLogPath
    });
    const dingtalk = createDingtalkAdapter({
      locateIncomingCall: () => dingtalkUia.locateIncomingCall(),
      invokeReject: () => dingtalkUia.invokeReject(),
      getMessagesConfig: () => watchConfig?.dingtalk,
      onStatus: (status) => {
        if (status.level === 'warn' || status.level === 'error') {
          sendState('reaction', status.message);
        }
      }
    });
    function handleDingtalkVoiceCall() {
      if (!canPollCallHangup()) return;
      if (sequence.isActive()) return;
      if (!activeManifest?.sequences?.['boss-call']) return;
      const dbg = (line) => {
        if (process.env.PET_DINGTALK_DEBUG !== '1') return;
        try { require('fs').appendFileSync(dbgLogPath, `${new Date().toISOString()} ${line}\n`); } catch (_) {}
      };
      dbg(`voice-call triggered located=${JSON.stringify(dingtalk.getLastLocated())} pet=${JSON.stringify(petWindow.getBounds())}`);
      // The DingTalk VoIP popup is itself a topmost window created AFTER our window;
      // re-assert our Z-order throughout the sequence so mom stays above the popup.
      const topmostTicker = setInterval(() => {
        try {
          if (!petWindow.isDestroyed()) topmostGuard?.ensure();
        } catch (_) {}
      }, 400);
      try {
        sequence.onceFinished?.(() => clearInterval(topmostTicker));
      } catch (_) { clearInterval(topmostTicker); }
      const restoreFrom = petWindow.getBounds();
      const walkStage = activeManifest.sequences['boss-call']?.stages?.find((s) => s.approachTarget === 'incoming-call-reject');
      const walkAction = walkStage?.action || 'call-mom-walk';
      let lastWalkFacing = '';
      const started = sequence.start('boss-call', {
        restoreFrom,
        getPetBounds: () => petWindow.getBounds(),
        movePetWindow: movePetKeepingSize,
        onWalkFacing: (dir) => {
          // Re-issue the walk state with a -left suffix so the renderer mirrors mom
          // while she strolls toward the hangup button; only on direction change.
          if (!dir || dir === lastWalkFacing) return;
          lastWalkFacing = dir;
          try {
            sendState(dir === 'left' ? `${walkAction}-left` : walkAction, '', '', walkAction, {});
          } catch (_) {}
        },
        getApproachRect: (name) => {
          const located = dingtalk.getLastLocated();
          if (!located) return null;
          if (name === 'incoming-call-edge') return located.windowBounds;
          if (name === 'incoming-call-reject') {
            if (!located.rejectBounds) return null;
            const b = located.rejectBounds;
            // Aim the foot at the middle-right of the hangup button so mom's body
            // leans further onto the call window and the kick reads as stepping
            // ON the button, not merely brushing its edge.
            const rect = {
              x: Math.round(b.x + b.width * 0.45),
              y: b.y,
              width: Math.max(4, Math.round(b.width * 0.4)),
              height: b.height
            };
            if (process.env.PET_DINGTALK_DEBUG === '1') {
              try { require('fs').appendFileSync(dbgLogPath, `${new Date().toISOString()} approach ${name} rect=${JSON.stringify(rect)} reject=${JSON.stringify(b)} pet=${JSON.stringify(petWindow.getBounds())}\n`); } catch (_) {}
            }
            return rect;
          }
          return null;
        },
        onContact: async (stage) => {
          const located = dingtalk.getLastLocated();
          const pet = petWindow.getBounds();
          const hangup = activeManifest.sequences['boss-call']?.contacts?.hangup;
          const decision = resolveHangupAction({ located, petBounds: pet, hangup, stage });
          if (process.env.PET_DINGTALK_DEBUG === '1') {
            try { require('fs').appendFileSync(dbgLogPath, `${new Date().toISOString()} onContact stage=${stage.action} decision=${JSON.stringify(decision)} located=${JSON.stringify(located)} pet=${JSON.stringify(pet)}\n`); } catch (_) {}
          }
          if (!decision.invoke) {
            sendState(decision.state, decision.message, '', decision.logicalRole, {});
            return;
          }
          const ok = await dingtalk.invokeReject(decision.rejectBounds);
          if (!ok) sendState(stage.action, '这次没挂上', '', stage.action, {});
        }
      });
      if (!started) return;
    }
    function createOfficeBus() {
      return createImBus({
        getRules: () => ({
          ...watchConfig,
          enabled: canRunOfficeBus(),
          callHangup: {
            ...watchConfig?.callHangup,
            enabled: canPollCallHangup()
          }
        }),
        adapters: [
          createLarkAdapter({
            voice,
            sendState: watchSendState,
            onStatus: (status) => {
              if (status.level === 'warn' || status.level === 'error') {
                sendState('reaction', status.message);
              }
            },
            larkCliPath: watchConfig.larkCliPath || 'C:/Users/Thinkpad/.qwenworkcn/bin/lark-cli.cmd'
          }),
          dingtalk
        ],
        dispatchMessage: (event, rules) => {
          if (!canRunOfficeBus()) return;
          dispatchBossMessage(event, {
            rules,
            voice,
            sendState: watchSendState,
            rng: Math.random,
            now: Date.now,
            cooldownMap
          });
        },
        onVoiceCall: handleDingtalkVoiceCall
      });
    }
    restartOfficeBus = () => {
      imBus?.stop();
      imBus = null;
      if (!canRunOfficeBus()) return;
      if (watchConfig.enabled && !voice) {
        voice = createVoiceSynthesizer({
          cacheDir: path.join(app.getPath('userData'), 'voice-cache'),
          voice: watchConfig.voice.voice,
          rate: watchConfig.voice.rate
        });
      }
      imBus = createOfficeBus();
      void imBus.start().catch(() => {});
    };
    restartOfficeBus();

    // ── Market mood radar ────────────────────────────────────────────────
    // Polls the index quote; the moment it flips green<->red the petpack
    // sequences `market-bull` / `market-bear` fly the pet onto the top of the
    // nearest window while shouting. All pet visuals/text come from the
    // resource package; the player only provides the trigger and flight.
    const marketDbgLog = path.join(app.getPath('userData'), 'market-watch.log');
    const marketDbg = (line) => {
      if (process.env.PET_MARKET_DEBUG !== '1') return;
      try { fs.appendFileSync(marketDbgLog, `${new Date().toISOString()} ${line}\n`); } catch (_) {}
    };
    let marketTargetTimer = null;
    let marketTargetRect = null;
    const marketDiscovery = createWindowDiscovery({ screen });
    async function refreshMarketTarget() {
      try {
        const windows = await marketDiscovery.list();
        const pet = petWindow.getBounds();
        const cx = pet.x + pet.width / 2;
        const cy = pet.y + pet.height / 2;
        let best = null;
        let bestDist = Infinity;
        for (const win of windows) {
          if (!win?.bounds || win.bounds.width < 220) continue;
          const tx = win.bounds.x + win.bounds.width / 2;
          const ty = win.bounds.y;
          const dist = Math.hypot(tx - cx, ty - cy);
          if (dist < bestDist) { bestDist = dist; best = win; }
        }
        marketTargetRect = best ? { ...best.bounds } : null;
        marketDbg(`refreshMarketTarget best=${marketTargetRect ? JSON.stringify(marketTargetRect) : 'none'}`);
      } catch (err) {
        marketDbg(`refreshMarketTarget error: ${err?.message || err}`);
      }
    }
    function handleMarketEvent(kind, quote) {
      marketDbg(`handleMarketEvent kind=${kind} pct=${quote?.pct} sequenceActive=${sequence.isActive()}`);
      if (duo.mode() === 'tent' || duo.mode() === 'slack') return;
      if (sequence.isActive()) return;
      const seqId = kind === 'bull' ? 'market-bull' : 'market-bear';
      const seqDef = activeManifest?.sequences?.[seqId];
      if (!seqDef) { marketDbg(`handleMarketEvent: manifest has no ${seqId}`); return; }
      const flyStage = (seqDef.stages || []).find((s) => s && s.approachTarget === 'nearest-window-top');
      const flyAction = flyStage?.action || 'fly';
      let lastFacing = '';
      const originBounds = petWindow.getBounds();
      if (marketTargetTimer) { clearInterval(marketTargetTimer); marketTargetTimer = null; }
      void refreshMarketTarget();
      marketTargetTimer = setInterval(() => { void refreshMarketTarget(); }, 1500);
      const started = sequence.start(seqId, {
        getPetBounds: () => petWindow.getBounds(),
        movePetWindow: movePetKeepingSize,
        getApproachRect: (name) => {
          if (name === 'nearest-window-top') return marketTargetRect;
          if (name === 'sequence-origin') return originBounds;
          return null;
        },
        onWalkFacing: (dir) => {
          if (!dir || dir === lastFacing) return;
          lastFacing = dir;
          try {
            sendState(dir === 'left' ? `${flyAction}-left` : flyAction, '', '', flyAction, {});
          } catch (err) { marketDbg(`onWalkFacing error: ${err?.message || err}`); }
        }
      });
      marketDbg(`handleMarketEvent: sequence.start(${seqId}) → ${started}`);
      if (!started) {
        if (marketTargetTimer) { clearInterval(marketTargetTimer); marketTargetTimer = null; }
        return;
      }
      sequence.onceFinished(() => {
        if (marketTargetTimer) { clearInterval(marketTargetTimer); marketTargetTimer = null; }
        marketDbg('market sequence finished');
      });
    }
    marketWatcher = createMarketWatcher({
      getConfig: () => {
        if (duo.mode() === 'slack') return { ...(watchConfig?.market || {}), enabled: true };
        return canWatchMarket() ? watchConfig?.market : { enabled: false };
      },
      onEvent: handleMarketEvent,
      onStatus: (status) => { marketDbg(`status: ${JSON.stringify(status)}`); },
      onQuote: (quote) => { lastMarketQuote = quote; pushMarketStatus(); },
      debugLogPath: marketDbgLog
    });
    restartMarketWatcher = () => {
      marketWatcher?.stop();
      if (canWatchMarket()) marketWatcher.start();
      pushMarketStatus();
    };
    restartMarketWatcher();
    // ─────────────────────────────────────────────────────────────────────
  }).catch((error) => {
    dialog.showErrorBox('桌宠播放器启动失败', error.stack || error.message);
    app.quit();
  });
}

app.on('before-quit', () => {
  quitting = true;
  cancelDuoTransition();
  clearSlackTimer();
  destroyDuoPeerWindow();
  interaction?.dispose();
  sequence?.dispose();
  imBus?.stop();
  marketWatcher?.stop();
  if (petTaskPollTimer) { clearInterval(petTaskPollTimer); petTaskPollTimer = null; }
  pauseBehavior();
});
