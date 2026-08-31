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
  watchMenuLabel,
  taskProviderFromConfig
} = require('./capability-gates');
const { createVoiceSynthesizer } = require('./edge-voice');
const { createEventHold } = require('./event-hold');
const { nextRoamTarget, crawlIdleState } = require('./roam-motion');
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

let petWindow;
let tray;
let libraryRoot;
let settingsPath;
let settings = { petId: '', sizeKey: 'small', roaming: true, crawlMode: false };
let activeManifest;
let behaviorTimer;
let walkTimer;
let lastWalkFacing = 'right';
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
let petTaskPollTimer = null;

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
  // During sequence playback (e.g. boss-call mom walk) skip bounds restore:
  // its clamp would drag the pet window away from the approach target.
  if (shouldRestoreWindowBounds(options) && !sequence?.isActive?.()) restorePetWindowSize();
  let speechAudio = typeof options?.speechAudio === 'string' ? options.speechAudio : '';
  // 带协议前缀（pet-asset:/voice-cache:/data:/file: 等）视为完整 URL，否则按资源包相对路径改写
  if (speechAudio && !/^[a-z][a-z0-9+.-]*:/i.test(speechAudio) && activeManifest) {
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
    messageGapMs,
    speechGender: options?.speechGender === 'male' || options?.speechGender === 'female' ? options.speechGender : undefined,
    messageLoop: options?.messageLoop === true,
    speechLoop: options?.speechLoop === true
  });
}

function setMouseThrough(ignore) {
  mouseThroughGuard?.set(ignore);
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
  const moveAction = settings.crawlMode && activeManifest?.animations?.crawl ? 'crawl' : 'walk';
  sendState(`${moveAction}-${direction}`);
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
      sendState(idleState());
      scheduleBehavior(settings.crawlMode ? 700 + Math.random() * 900 : undefined);
    }
  }, 16);
}

function idleState() {
  return (settings.crawlMode && activeManifest?.animations?.crawl)
    ? crawlIdleState(lastWalkFacing)
    : 'idle';
}

function chooseBehavior() {
  // Crawl mode: only crawl-walk, never stand/sit/sleep
  if (settings.crawlMode && activeManifest?.animations?.crawl) {
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

function movePetKeepingSize(x, y) {
  if (!petWindow || petWindow.isDestroyed()) return;
  const size = currentSize();
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
  activeManifest = next;
  settings.petId = next.id;
  saveSettings();
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
  if (interaction && interaction.state() !== 'normal') return;
  sendState('reaction', '你回来啦！');
  scheduleBehavior(3000);
}

function hidePet() {
  sequence?.cancel();
  petWindow?.hide();
}

function pickRandomMenuChoice(item) {
  if (!Array.isArray(item?.randomActions) || item.randomActions.length === 0) return null;
  const index = Math.floor(Math.random() * item.randomActions.length);
  return item.randomActions[index] || null;
}

function runDirectMenuAction(choice) {
  if (!activeManifest || !choice || !activeManifest.animations[choice.action]) return;
  // State-aware kowtow: use crawl version when in crawl mode
  if (choice.action === 'kowtow' && settings.crawlMode && activeManifest.animations['kowtow-crawl']) {
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
  if (taskProviderFromConfig(watchConfig) === 'mock') {
    schedulePetTaskMock({
      taskType,
      onResult: (summary) => {
        const text = String(summary).slice(0, 200);
        sendState('reaction', text, text, 'reaction', {});
      }
    });
    return;
  }
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
  refreshTrayMenu();
  pushMarketStatus();
}

// Push the current market radar status + last quote to the renderer so the
// persistent ticker above the pet's head can show/hide and recolor live.
let lastMarketQuote = null;
function pushMarketStatus() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const market = watchConfig?.market;
  petWindow.webContents.send('pet:market', {
    enabled: Boolean(market?.enabled),
    simulated: Boolean(market?.simulated),
    name: lastMarketQuote?.name || '',
    points: lastMarketQuote?.points,
    pct: lastMarketQuote?.pct,
    change: lastMarketQuote?.change,
    amount: lastMarketQuote?.amount,
    up: lastMarketQuote?.up,
    down: lastMarketQuote?.down,
    indices: Array.isArray(lastMarketQuote?.indices) ? lastMarketQuote.indices : []
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
        sendState(idleState());
        scheduleBehavior(1200);
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
        sendState(idleState());
        scheduleBehavior(600);
      },
      visible: Boolean(activeManifest?.animations?.crawl)
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
    getCurrentSize: currentSize,
    getManifest: () => activeManifest,
    isSuspended: () => sequence?.isActive?.() === true,
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
      sendState(state, message, speech, state, opts || {});
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
        getRules: () => watchConfig,
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
          if (!watchConfig.enabled) return;
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
      getConfig: () => watchConfig?.market,
      onEvent: handleMarketEvent,
      onStatus: (status) => { marketDbg(`status: ${JSON.stringify(status)}`); },
      onQuote: (quote) => { lastMarketQuote = quote; pushMarketStatus(); },
      debugLogPath: marketDbgLog
    });
    marketWatcher.start();
    pushMarketStatus();
    // ─────────────────────────────────────────────────────────────────────
  }).catch((error) => {
    dialog.showErrorBox('桌宠播放器启动失败', error.stack || error.message);
    app.quit();
  });
}

app.on('before-quit', () => {
  quitting = true;
  interaction?.dispose();
  sequence?.dispose();
  imBus?.stop();
  marketWatcher?.stop();
  if (petTaskPollTimer) { clearInterval(petTaskPollTimer); petTaskPollTimer = null; }
  pauseBehavior();
});
