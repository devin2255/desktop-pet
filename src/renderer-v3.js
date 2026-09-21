const pet = document.getElementById('pet');
const petImage = document.getElementById('pet-image');
const bubble = document.getElementById('bubble');
const hearts = document.getElementById('hearts');
const ticker = document.getElementById('ticker');
const duoOverlay = document.getElementById('duo-overlay');
const duoClockTime = document.getElementById('duo-clock-time');
const duoClockHm = document.getElementById('duo-clock-hm');
const duoClockSec = document.getElementById('duo-clock-sec');
const duoClockDate = document.getElementById('duo-clock-date');
const duoIntroLeft = document.getElementById('duo-intro-left');
const duoIntroRight = document.getElementById('duo-intro-right');
const duoSlackBoard = document.getElementById('duo-slack-board');
const duoSlackQuotes = document.getElementById('duo-slack-quotes');
const duoSlackKline = document.getElementById('duo-slack-kline');
const duoSlackVideo = document.getElementById('duo-slack-video');
const duoSlackVideoNext = document.getElementById('duo-slack-video-next');
const duoSlackFeed = document.getElementById('duo-slack-feed');

let manifest;
let pointerDown;
let duoPointerDown;
let suppressNextContextMenu = false;
let bubbleTimer;
let bubbleStaggerTimers = [];
let animationTimer;
let animationToken = 0;
let pendingState = { state: 'idle', message: '', generation: 0 };
let stateGeneration = 0;
const DRAG_THRESHOLD_PX = 6;
const DUO_GESTURE_THRESHOLD_PX = 12;
const HIT_ALPHA_CUTOFF = 32;
const BUBBLE_GAP_PX = 2;
const FALLBACKS = {
  drag: 'walk', climb: 'walk', perch: 'sit', hang: 'sit',
  fall: 'reaction', impact: 'reaction', recover: 'reaction'
};
const hitCanvas = document.createElement('canvas');
const hitContext = hitCanvas.getContext('2d', { willReadFrequently: true });
let hitMaskReady = false;
let lastVisibleInsets;
let tentClockTimer;
let tentActive = false;
let slackActive = false;
let slackClipKey = '';
let slackClipIndex = 0;
let slackClips = [];
let slackSliding = false;
let slackSlideTimer;
let slackVideoCurrent = duoSlackVideo;
let slackVideoUpcoming = duoSlackVideoNext;
let lastMarketInfo;

function resolveLogicalRole(role) {
  return manifest.interactionActions?.[role]?.action || FALLBACKS[role] || role;
}

function facingSuffix(value) {
  if (typeof value !== 'string') return '';
  if (value.endsWith('-left')) return '-left';
  if (value.endsWith('-right')) return '-right';
  return '';
}

function baseActionName(value) {
  const suffix = facingSuffix(value);
  return suffix ? value.slice(0, -suffix.length) : value;
}

function resolveAction(state, logicalRole, options = {}) {
  const role = logicalRole || state;
  const action = resolveLogicalRole(baseActionName(role));
  let normalized = baseActionName(action);
  // Directional suffixed states (e.g. call-mom-walk-left) fall back to the
  // base animation; the -left part only drives CSS mirroring.
  if (normalized.endsWith('-left') && !manifest.animations[normalized]) {
    normalized = normalized.slice(0, -5);
  }
  if (normalized === 'walk-left' || normalized === 'walk-right') return 'walk';
  if (normalized === 'crawl-left' || normalized === 'crawl-right') return 'crawl';
  if (normalized === 'clingy' || normalized === 'shy') return 'reaction';
  if (manifest.animations[normalized]) return normalized;
  const stateBase = baseActionName(state);
  if (manifest.animations[stateBase]) return stateBase;
  return options.allowIdleFallback === false ? '' : 'idle';
}

function isFacingLeft() {
  return pet.classList.contains('state-walk-left')
    || pet.classList.contains('state-crawl-left')
    || pet.classList.contains('state-drag-left')
    || pet.classList.contains('state-climb-left');
}

function preloadFrames() {
  for (const animation of Object.values(manifest.animations)) {
    for (const frame of animation.frames) {
      const image = new Image();
      image.src = frame;
    }
  }
}

let playingAction = '';

function playAnimation(state, logicalRole, options = {}) {
  if (!manifest) return;
  const action = resolveAction(state, logicalRole);
  const animation = manifest.animations[action] || manifest.animations.idle;
  pet.style.setProperty('--action-scale', String(animation.scale || 1));
  if (action === playingAction && animation.loop && !options.startAtLast) return;
  playingAction = action;
  clearTimeout(animationTimer);
  animationToken += 1;
  const token = animationToken;
  let index = options.startAtLast === true && animation.frames.length
    ? animation.frames.length - 1
    : 0;
  function showNext() {
    if (token !== animationToken) return;
    petImage.src = animation.frames[index];
    petImage.classList.add('ready');
    const duration = animation.durations[index] || 250;
    if (index < animation.frames.length - 1) {
      index += 1;
      animationTimer = setTimeout(showNext, duration);
    } else if (animation.loop) {
      index = 0;
      animationTimer = setTimeout(showNext, duration);
    }
  }
  showNext();
}

function clearBubbleTimers() {
  clearTimeout(bubbleTimer);
  bubbleTimer = undefined;
  for (const timerId of bubbleStaggerTimers) clearTimeout(timerId);
  bubbleStaggerTimers = [];
}

function showBubble(message, duration = 2200) {
  clearBubbleTimers();
  bubble.textContent = message;
  bubble.classList.add('visible');
  // Re-measure after text/layout so the bubble sits just above the visible head.
  if (lastVisibleInsets) positionBubble(lastVisibleInsets);
  requestAnimationFrame(() => {
    if (lastVisibleInsets) positionBubble(lastVisibleInsets);
  });
  bubbleTimer = setTimeout(() => bubble.classList.remove('visible'), duration);
}

function showStaggeredMessages(messages, gapMs = 700, bubbleMs = 2400) {
  const generation = pendingState.generation;
  const looping = pendingState.messageLoop === true;
  clearBubbleTimers();
  if (!messages.length) return;
  bubble.classList.add('visible');
  bubble.textContent = messages[0];
  if (lastVisibleInsets) positionBubble(lastVisibleInsets);
  requestAnimationFrame(() => {
    if (lastVisibleInsets) positionBubble(lastVisibleInsets);
  });
  for (let index = 1; index < messages.length; index += 1) {
    const timerId = setTimeout(() => {
      if (pendingState.generation !== generation) return;
      bubble.textContent = messages[index];
      if (lastVisibleInsets) positionBubble(lastVisibleInsets);
      requestAnimationFrame(() => {
        if (lastVisibleInsets) positionBubble(lastVisibleInsets);
      });
    }, index * gapMs);
    bubbleStaggerTimers.push(timerId);
  }
  if (looping) {
    const loopMs = Math.max(messages.length, 1) * gapMs;
    bubbleTimer = setTimeout(() => {
      if (pendingState.generation !== generation) return;
      showStaggeredMessages(messages, gapMs, bubbleMs);
    }, loopMs);
  } else {
    const totalMs = (messages.length - 1) * gapMs + bubbleMs;
    bubbleTimer = setTimeout(() => bubble.classList.remove('visible'), totalMs);
  }
}

const MALE_VOICE_RE = /kang|yunyang|yunxi|yunjian|yunfeng|dongni|male|男|kangkang/i;
const FEMALE_VOICE_RE = /huihui|yaoyao|xiaoxiao|xiaoyi|xiaohan|female|女|zira|jenny|aria/i;

function listSpeechVoices() {
  if (!window.speechSynthesis?.getVoices) return [];
  return window.speechSynthesis.getVoices() || [];
}

function pickSpeechVoice(preferredGender) {
  const voices = listSpeechVoices();
  if (!voices.length) return null;
  const zh = voices.filter((voice) => /^zh(-|$)/i.test(voice.lang) || /chinese|中文/i.test(voice.name));
  const pool = zh.length ? zh : voices;
  if (preferredGender === 'male') {
    return pool.find((voice) => MALE_VOICE_RE.test(voice.name))
      || pool.find((voice) => !FEMALE_VOICE_RE.test(voice.name))
      || pool[0];
  }
  if (preferredGender === 'female') {
    return pool.find((voice) => FEMALE_VOICE_RE.test(voice.name))
      || pool.find((voice) => !MALE_VOICE_RE.test(voice.name))
      || pool[0];
  }
  return pool.find((voice) => voice.default) || pool[0];
}

let activeAudio;

function stopSpeechAudio() {
  if (!activeAudio) return;
  activeAudio.pause();
  activeAudio.loop = false;
  activeAudio.src = '';
  activeAudio = undefined;
}

function resolveSpeechAudio(state) {
  const items = Array.isArray(manifest?.contextMenuActions) ? manifest.contextMenuActions : [];
  const match = items.find((item) => item && item.action === baseActionName(state) && item.speechAudio);
  return match?.speechAudio || '';
}

function playSpeechAudio(url) {
  if (!url) return false;
  stopSpeechAudio();
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  activeAudio = new Audio(url);
  if (pendingState.speechLoop) activeAudio.loop = true;
  activeAudio.play().catch(() => {});
  if (activeAudio.addEventListener) {
    activeAudio.addEventListener('ended', () => {
      if (activeAudio && !activeAudio.loop) activeAudio = undefined;
    });
    activeAudio.addEventListener('error', () => { activeAudio = undefined; });
  }
  return true;
}

function speak(text, audioUrl = '') {
  if (audioUrl && playSpeechAudio(audioUrl)) return;
  if (!text || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  stopSpeechAudio();
  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.92;
  const stageGender = pendingState?.speechGender;
  const gender = stageGender === 'male' || stageGender === 'female'
    ? stageGender
    : (manifest?.speechGender === 'male' || manifest?.speechGender === 'female'
      ? manifest.speechGender
      : '');
  const voice = pickSpeechVoice(gender);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang || 'zh-CN';
  }
  // Keep male lines near natural pitch; only soften slightly when no male voice is available.
  utterance.pitch = gender === 'male' && voice && MALE_VOICE_RE.test(voice.name) ? 1 : gender === 'male' ? 0.75 : 1;
  const start = () => window.speechSynthesis.speak(utterance);
  if (voice || listSpeechVoices().length) {
    start();
    return;
  }
  // Chromium may expose voices asynchronously on first use.
  const retry = () => {
    const lateVoice = pickSpeechVoice(gender);
    if (lateVoice) {
      utterance.voice = lateVoice;
      utterance.lang = lateVoice.lang || 'zh-CN';
      if (gender === 'male' && MALE_VOICE_RE.test(lateVoice.name)) utterance.pitch = 1;
    }
    start();
  };
  window.speechSynthesis.addEventListener('voiceschanged', retry, { once: true });
  setTimeout(retry, 250);
}

function setState(state, message = '', speech = '', logicalRole, speechAudio = '', messages, messageGapMs, options = {}) {
  stateGeneration += 1;
  if (pendingState.speechLoop) stopSpeechAudio();
  pendingState = {
    state,
    message,
    speech,
    logicalRole,
    speechAudio,
    messages,
    messageGapMs,
    speechGender: options.speechGender,
    messageLoop: options.messageLoop === true,
    speechLoop: options.speechLoop === true,
    startAtLast: options.startAtLast === true,
    generation: stateGeneration
  };
  pet.className = `pet state-${state}${pointerDown ? ' dragging' : ''}`;
  if (!manifest) return;
  playAnimation(state, logicalRole, { startAtLast: options.startAtLast === true });
  // Estimate bubble duration by text length: ~300ms per char (matches TTS pace), clamp 4s-30s
  const textLen = (message || speech || '').length;
  const bubbleMs = state === 'sleep'
    ? 4200
    : baseActionName(state).startsWith('perch-')
      ? 4800
      : Math.max(4000, Math.min(30000, textLen * 300));
  let gapMs = Number.isFinite(messageGapMs) ? messageGapMs : 700;
  if (pendingState.messageLoop) gapMs = Math.max(1200, gapMs);
  if (Array.isArray(messages) && messages.length) {
    showStaggeredMessages(messages, gapMs, bubbleMs);
  } else if (message) {
    showBubble(message, bubbleMs);
  } else if (!speechAudio && !speech) {
    // Don't clear bubble while audio is playing — prevents behavior animations from interrupting TTS
    const audioPlaying = activeAudio && activeAudio.paused === false;
    if (!audioPlaying) {
      clearBubbleTimers();
      bubble.classList.remove('visible');
    }
  }
  const audio = speechAudio || resolveSpeechAudio(state);
  if (audio) {
    speak(speech, audio);
  } else if (speech) {
    speak(speech);
  } else if (pendingState.messageLoop && message) {
    speak(message);
  }
}

function loadPet(nextManifest) {
  manifest = nextManifest;
  playingAction = '';
  petImage.crossOrigin = 'anonymous';
  petImage.alt = `${manifest.name}桌面宠物`;
  petImage.classList.remove('ready');
  preloadFrames();
  // Unfold/fold swaps manifests while a transition action (e.g. duo-kick) is
  // still pending. That action often does not exist on the member pack; falling
  // back to standing idle would flash a full-size pose before crawl/idle arrives.
  const pendingAction = resolveAction(pendingState.state || 'idle', pendingState.logicalRole, {
    allowIdleFallback: false
  });
  if (!pendingAction) return;
  setState(
    pendingState.state || 'idle',
    pendingState.message || '',
    pendingState.speech || '',
    pendingState.logicalRole,
    pendingState.speechAudio || '',
    pendingState.messages,
    pendingState.messageGapMs,
    {
      speechGender: pendingState.speechGender,
      messageLoop: pendingState.messageLoop,
      speechLoop: pendingState.speechLoop
    }
  );
}

function scanVisibleInsets() {
  const { width, height } = hitCanvas;
  const data = hitContext.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < HIT_ALPHA_CUTOFF) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return null;
  const rect = petImage.getBoundingClientRect();
  const fit = Math.min(rect.width / width, rect.height / height);
  const contentWidth = width * fit;
  const contentHeight = height * fit;
  const contentLeft = rect.left + (rect.width - contentWidth) / 2;
  const contentTop = rect.bottom - contentHeight;
  const mirrored = isFacingLeft();
  const visibleMinX = mirrored ? width - 1 - maxX : minX;
  const visibleMaxX = mirrored ? width - 1 - minX : maxX;
  return {
    left: Math.round(contentLeft + visibleMinX * fit),
    top: Math.round(contentTop + minY * fit),
    right: Math.round(innerWidth - (contentLeft + (visibleMaxX + 1) * fit)),
    bottom: Math.round(innerHeight - (contentTop + (maxY + 1) * fit))
  };
}

function stabilizeVisibleInsets(insets) {
  if (!lastVisibleInsets) {
    lastVisibleInsets = insets;
    return insets;
  }
  const stabilized = {};
  for (const side of ['left', 'top', 'right', 'bottom']) {
    stabilized[side] = Math.abs(insets[side] - lastVisibleInsets[side]) < 4
      ? lastVisibleInsets[side]
      : insets[side];
  }
  lastVisibleInsets = stabilized;
  return stabilized;
}

function positionBubble(insets) {
  const height = bubble.offsetHeight || 22;
  // Keep the bubble bottom a few pixels above the visible subject top.
  const top = Math.max(0, Math.round(insets.top - height - BUBBLE_GAP_PX));
  bubble.style.setProperty('--bubble-top', `${top}px`);
}

function refreshHitMask() {
  hitMaskReady = false;
  if (!hitContext || !petImage.naturalWidth || !petImage.naturalHeight) return;
  hitCanvas.width = petImage.naturalWidth;
  hitCanvas.height = petImage.naturalHeight;
  try {
    hitContext.clearRect(0, 0, hitCanvas.width, hitCanvas.height);
    hitContext.drawImage(petImage, 0, 0);
    const insets = scanVisibleInsets();
    hitMaskReady = true;
    const visibleInsets = insets ? stabilizeVisibleInsets(insets) : lastVisibleInsets;
    if (!visibleInsets) return;
    window.petApi.setVisibleInsets(visibleInsets);
    positionBubble(visibleInsets);
  } catch {
    hitMaskReady = false;
  }
}

function visiblePixelAt(clientX, clientY) {
  if ((tentActive || slackActive) && duoOverlay && !duoOverlay.hidden) {
    const device = duoOverlay.querySelector('.duo-device');
    if (device) {
      const box = device.getBoundingClientRect();
      if (clientX >= box.left && clientX < box.right && clientY >= box.top && clientY < box.bottom) {
        return true;
      }
    }
  }
  const rect = petImage.getBoundingClientRect();
  if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) return false;
  if (!hitMaskReady) return true;
  const fit = Math.min(rect.width / hitCanvas.width, rect.height / hitCanvas.height);
  const contentWidth = hitCanvas.width * fit;
  const contentHeight = hitCanvas.height * fit;
  const contentLeft = rect.left + (rect.width - contentWidth) / 2;
  const contentTop = rect.bottom - contentHeight;
  if (clientX < contentLeft || clientX >= contentLeft + contentWidth || clientY < contentTop || clientY >= rect.bottom) return false;
  let sourceX = Math.floor((clientX - contentLeft) / fit);
  const sourceY = Math.floor((clientY - contentTop) / fit);
  if (isFacingLeft()) sourceX = hitCanvas.width - 1 - sourceX;
  const radius = 7;
  const x = Math.max(0, sourceX - radius);
  const y = Math.max(0, sourceY - radius);
  const width = Math.min(hitCanvas.width - x, radius * 2 + 1);
  const height = Math.min(hitCanvas.height - y, radius * 2 + 1);
  const pixels = hitContext.getImageData(x, y, width, height).data;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] >= HIT_ALPHA_CUTOFF) return true;
  }
  return false;
}

function updateMouseThrough(event) {
  if (pointerDown || duoPointerDown) {
    window.petApi.setMouseThrough(false);
    return;
  }
  window.petApi.setMouseThrough(!visiblePixelAt(event.clientX, event.clientY));
}

petImage.addEventListener('load', refreshHitMask);
window.addEventListener('mousemove', updateMouseThrough);
window.addEventListener('mouseleave', () => {
  if (!pointerDown && !duoPointerDown) window.petApi.setMouseThrough(true);
});

function releaseHearts() {
  for (let index = 0; index < 3; index += 1) {
    const heart = document.createElement('span');
    heart.className = 'heart';
    heart.textContent = '♥';
    heart.style.setProperty('--drift', `${(index - 1) * 22 + Math.round(Math.random() * 10 - 5)}px`);
    heart.style.animationDelay = `${index * 80}ms`;
    hearts.appendChild(heart);
    heart.addEventListener('animationend', () => heart.remove(), { once: true });
  }
}

function duoPayload(start, event) {
  const screenX = Number(event.screenX);
  const screenY = Number(event.screenY);
  const dx = screenX - start.x;
  const dy = screenY - start.y;
  if (![screenX, screenY, dx, dy].every(Number.isFinite)) return null;
  return { screenX, screenY, dx, dy };
}

pet.addEventListener('pointerdown', (event) => {
  if (event.button !== 2 && event.button !== 0) return;
  if (event.button === 2) {
    const screenX = Number(event.screenX);
    const screenY = Number(event.screenY);
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;
    event.preventDefault();
    duoPointerDown = { x: screenX, y: screenY, duoStarted: false };
    suppressNextContextMenu = false;
    pet.setPointerCapture(event.pointerId);
    window.petApi.duoPointerDown({ screenX, screenY, dx: 0, dy: 0 });
    return;
  }
  pointerDown = { x: event.screenX, y: event.screenY, dragStarted: false };
  pet.setPointerCapture(event.pointerId);
});
pet.addEventListener('pointermove', (event) => {
  if (duoPointerDown) {
    const payload = duoPayload(duoPointerDown, event);
    if (!payload) return;
    if (!duoPointerDown.duoStarted && Math.hypot(payload.dx, payload.dy) >= DUO_GESTURE_THRESHOLD_PX) {
      duoPointerDown.duoStarted = true;
    }
    window.petApi.duoPointerMove(payload);
    return;
  }
  if (!pointerDown) return;
  const distance = Math.hypot(event.screenX - pointerDown.x, event.screenY - pointerDown.y);
  if (!pointerDown.dragStarted && distance < DRAG_THRESHOLD_PX) return;
  if (!pointerDown.dragStarted) {
    pointerDown.dragStarted = true;
    pet.classList.add('dragging');
    window.petApi.startDrag({ screenX: pointerDown.x, screenY: pointerDown.y });
  }
  window.petApi.drag({ screenX: event.screenX, screenY: event.screenY });
});
pet.addEventListener('pointerup', (event) => {
  if (duoPointerDown) {
    const payload = duoPayload(duoPointerDown, event);
    if (payload && Math.hypot(payload.dx, payload.dy) >= DUO_GESTURE_THRESHOLD_PX) {
      duoPointerDown.duoStarted = true;
    }
    suppressNextContextMenu = duoPointerDown.duoStarted;
    duoPointerDown = undefined;
    pet.releasePointerCapture(event.pointerId);
    if (payload) window.petApi.duoPointerUp(payload);
    return;
  }
  if (!pointerDown) return;
  const dragged = pointerDown.dragStarted;
  pointerDown = undefined;
  pet.releasePointerCapture(event.pointerId);
  pet.classList.remove('dragging');
  if (dragged) window.petApi.endDrag({ screenX: event.screenX, screenY: event.screenY });
  else if (slackActive) {
    event.preventDefault();
    window.petApi.slackExit();
  } else { releaseHearts(); window.petApi.interact(); }
});
pet.addEventListener('pointercancel', (event) => {
  if (duoPointerDown) {
    suppressNextContextMenu = duoPointerDown.duoStarted;
    duoPointerDown = undefined;
    pet.releasePointerCapture(event.pointerId);
    window.petApi.duoPointerCancel();
    return;
  }
  const dragged = pointerDown?.dragStarted;
  pointerDown = undefined;
  pet.classList.remove('dragging');
  if (dragged) window.petApi.endDrag({ screenX: event.screenX, screenY: event.screenY });
});
pet.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (suppressNextContextMenu || duoPointerDown?.duoStarted) {
    suppressNextContextMenu = false;
    return;
  }
  window.petApi.openMenu();
});

window.petApi.onLoad(loadPet);
window.petApi.onState(({ state, message, speech, logicalRole, speechAudio, messages, messageGapMs, speechGender, messageLoop, speechLoop, startAtLast }) =>
  setState(state, message, speech, logicalRole, speechAudio || '', messages, messageGapMs, { speechGender, messageLoop, speechLoop, startAtLast }));
window.petApi.onMarket(updateTicker);
function formatTentClock(now) {
  const date = now instanceof Date ? now : new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return {
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    hoursMinutes: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    seconds: pad(date.getSeconds()),
    date: `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`
  };
}

function syncTentClock() {
  if (!duoClockDate) return;
  const parts = formatTentClock(new Date());
  if (duoClockHm) duoClockHm.textContent = parts.hoursMinutes;
  if (duoClockSec) duoClockSec.textContent = parts.seconds;
  if (!duoClockHm && duoClockTime) duoClockTime.textContent = parts.time;
  duoClockDate.textContent = parts.date;
}

function stopTentClock() {
  if (tentClockTimer) clearTimeout(tentClockTimer);
  tentClockTimer = undefined;
}

function startTentClock() {
  stopTentClock();
  syncTentClock();
  const delay = 1000 - (Date.now() % 1000);
  tentClockTimer = setTimeout(function tickTentClock() {
    syncTentClock();
    tentClockTimer = setTimeout(tickTentClock, 1000);
  }, delay);
}

function hideTicker() {
  if (!ticker) return;
  ticker.textContent = '';
  ticker.classList.remove('visible', 'up', 'down');
  pet.classList.remove('has-ticker');
}

function setHidden(node, hidden) {
  if (node) node.hidden = hidden;
}

function resetSlackMedia() {
  slackClipKey = '';
  slackClipIndex = 0;
  slackClips = [];
  slackSliding = false;
  if (slackSlideTimer) {
    clearTimeout(slackSlideTimer);
    slackSlideTimer = undefined;
  }
  duoSlackFeed?.classList.remove('is-sliding');
  if (duoSlackVideo) {
    duoSlackVideo.classList.add('is-current');
    duoSlackVideo.classList.remove('is-next');
    duoSlackVideo.style.transition = '';
  }
  if (duoSlackVideoNext) {
    duoSlackVideoNext.classList.add('is-next');
    duoSlackVideoNext.classList.remove('is-current');
    duoSlackVideoNext.style.transition = '';
  }
  slackVideoCurrent = duoSlackVideo;
  slackVideoUpcoming = duoSlackVideoNext;
  for (const node of [duoSlackVideo, duoSlackVideoNext]) {
    if (!node) continue;
    node.pause?.();
    node.removeAttribute?.('src');
    node.src = '';
    node.loop = false;
  }
}

function normalizeSlackClips(clips) {
  return Array.isArray(clips)
    ? clips.filter((clip) => typeof clip === 'string' && clip.trim())
    : [];
}

function upcomingSlackIndex() {
  if (!slackClips.length) return 0;
  return (slackClipIndex + 1) % slackClips.length;
}

function armSlackVideo(node, src, autoplay) {
  if (!node) return;
  node.muted = true;
  node.loop = slackClips.length === 1;
  if (src) {
    node.preload = 'auto';
    if (node.getAttribute?.('src') !== src && node.src !== src) node.src = src;
    if (autoplay) node.play?.().catch?.(() => {});
  } else {
    node.pause?.();
    node.preload = 'none';
    node.removeAttribute?.('src');
    node.src = '';
  }
}

function playCurrentSlackClip() {
  if (!slackVideoCurrent || !slackClips.length) return;
  armSlackVideo(slackVideoCurrent, slackClips[slackClipIndex], true);
  armSlackVideo(slackVideoUpcoming, '', false);
}

function currentSlackSrc(node) {
  return node?.getAttribute?.('src') || node?.src || '';
}

function preloadUpcomingIfNeeded() {
  if (!slackVideoUpcoming || slackClips.length < 2) return;
  const src = slackClips[upcomingSlackIndex()];
  if (!src || currentSlackSrc(slackVideoUpcoming) === src) return;
  armSlackVideo(slackVideoUpcoming, src, false);
}

function playSlackClips(clips) {
  const nextClips = normalizeSlackClips(clips);
  const key = nextClips.join('\n');
  if (!slackVideoCurrent || key === slackClipKey) return;
  slackClipKey = key;
  slackClipIndex = 0;
  slackClips = nextClips;
  slackSliding = false;
  duoSlackFeed?.classList.remove('is-sliding');
  if (!nextClips.length) {
    resetSlackMedia();
    return;
  }
  playCurrentSlackClip();
}

function finishSlackSlide() {
  if (!slackSliding) return;
  slackSliding = false;
  if (slackSlideTimer) {
    clearTimeout(slackSlideTimer);
    slackSlideTimer = undefined;
  }
  slackClipIndex = upcomingSlackIndex();
  for (const node of [slackVideoCurrent, slackVideoUpcoming]) {
    if (node?.style) node.style.transition = 'none';
  }
  duoSlackFeed?.classList.remove('is-sliding');
  if (slackVideoCurrent && slackVideoUpcoming) {
    slackVideoCurrent.classList.remove('is-current');
    slackVideoCurrent.classList.add('is-next');
    slackVideoUpcoming.classList.remove('is-next');
    slackVideoUpcoming.classList.add('is-current');
    const outgoing = slackVideoCurrent;
    slackVideoCurrent = slackVideoUpcoming;
    slackVideoUpcoming = outgoing;
  }
  void duoSlackFeed?.offsetHeight;
  for (const node of [slackVideoCurrent, slackVideoUpcoming]) {
    if (node?.style) node.style.transition = '';
  }
  slackVideoCurrent?.play?.().catch?.(() => {});
  armSlackVideo(slackVideoUpcoming, '', false);
}

function beginSlackSlide() {
  if (slackSliding || slackClips.length < 2) return;
  slackVideoCurrent?.pause?.();
  preloadUpcomingIfNeeded();
  const start = () => {
    if (slackSliding || slackClips.length < 2) return;
    slackSliding = true;
    slackVideoUpcoming?.play?.().catch?.(() => {});
    duoSlackFeed?.classList.add('is-sliding');
    if (slackSlideTimer) clearTimeout(slackSlideTimer);
    slackSlideTimer = setTimeout(finishSlackSlide, 560);
  };
  const hasSrc = Boolean(currentSlackSrc(slackVideoUpcoming));
  const ready = Number(slackVideoUpcoming?.readyState ?? (hasSrc ? 4 : 0));
  if (hasSrc && ready < 2) {
    slackVideoUpcoming.addEventListener?.('canplay', start, { once: true });
    if (slackSlideTimer) clearTimeout(slackSlideTimer);
    slackSlideTimer = setTimeout(start, 1600);
    return;
  }
  start();
}

function onSlackVideoEnded(event) {
  if (!slackClips.length || event?.target !== slackVideoCurrent) return;
  if (slackClips.length === 1) {
    slackVideoCurrent.currentTime = 0;
    slackVideoCurrent.play?.().catch?.(() => {});
    return;
  }
  beginSlackSlide();
}

function onSlackFeedTransitionEnd(event) {
  if (event?.propertyName !== 'transform' || !slackSliding) return;
  if (event.target !== slackVideoUpcoming && event.target !== slackVideoCurrent) return;
  finishSlackSlide();
}

duoSlackVideo?.addEventListener('ended', onSlackVideoEnded);
duoSlackVideoNext?.addEventListener('ended', onSlackVideoEnded);
duoSlackFeed?.addEventListener('transitionend', onSlackFeedTransitionEnd);

function drawSlackKline(klines) {
  if (!duoSlackKline) return;
  const ctx = duoSlackKline.getContext('2d');
  if (!ctx) return;
  const rect = duoSlackKline.getBoundingClientRect();
  const w = Math.max(72, Math.round(rect.width) || Number(duoSlackKline.width) || 240);
  const h = Math.max(48, Math.round(rect.height) || Number(duoSlackKline.height) || 160);
  const dpr = window.devicePixelRatio || 1;
  duoSlackKline.width = Math.round(w * dpr);
  duoSlackKline.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const bars = Array.isArray(klines)
    ? klines.filter((k) => Number.isFinite(Number(k?.high)) && Number.isFinite(Number(k?.low)))
    : [];
  if (bars.length < 2) return;
  let min = Number(bars[0].low);
  let max = Number(bars[0].high);
  for (const bar of bars) {
    min = Math.min(min, Number(bar.low));
    max = Math.max(max, Number(bar.high));
  }
  if (!(max > min)) max = min + 1;
  const pad = 3;
  const innerH = h - pad * 2;
  const slot = (w - pad * 2) / bars.length;
  const bodyW = Math.max(1, slot * 0.62);
  const yOf = (value) => pad + (max - Number(value)) / (max - min) * innerH;
  bars.forEach((bar, i) => {
    const x = pad + slot * i + slot / 2;
    const open = Number(bar.open);
    const close = Number(bar.close);
    const up = close >= open;
    ctx.strokeStyle = up ? '#ff756e' : '#64d889';
    ctx.fillStyle = up ? '#ff756e' : '#64d889';
    ctx.beginPath();
    ctx.moveTo(x, yOf(bar.high));
    ctx.lineTo(x, yOf(bar.low));
    ctx.stroke();
    const top = yOf(Math.max(open, close));
    const bot = yOf(Math.min(open, close));
    ctx.fillRect(x - bodyW / 2, top, bodyW, Math.max(1, bot - top));
  });
}

function updateSlackBoard(info = lastMarketInfo) {
  const host = duoSlackQuotes || duoSlackBoard;
  if (!host) return;
  host.textContent = '';
  if (!info || info.enabled !== true) {
    host.appendChild(el('main', '行情连接中'));
    drawSlackKline([]);
    return;
  }
  const pct = Number(info.pct);
  const directionClass = Number.isFinite(pct) ? (pct > 0 ? 'up' : 'down') : '';
  host.appendChild(el('main', shortName(info.name) || '大盘'));
  const points = Number(info.points);
  const headline = [
    Number.isFinite(points) ? points.toFixed(2) : '',
    Number.isFinite(pct) ? fmtPct(pct) : '--'
  ].filter(Boolean).join(' ');
  host.appendChild(el(directionClass, headline || '行情待命'));
  if (Array.isArray(info.indices) && info.indices.length) {
    const line = document.createElement('div');
    info.indices.slice(0, 2).forEach((idx, i) => {
      const n = Number(idx.pct);
      if (i > 0) line.appendChild(el('', '  '));
      line.appendChild(el(Number.isFinite(n) ? (n > 0 ? 'up' : 'down') : '', `${shortName(idx.name)} ${fmtPct(idx.pct)}`));
    });
    host.appendChild(line);
  }
  const upC = Number(info.up);
  const downC = Number(info.down);
  if (Number.isFinite(upC) && Number.isFinite(downC)) {
    const breadth = document.createElement('div');
    breadth.appendChild(el('up', `涨${upC}`));
    breadth.appendChild(el('', ' '));
    breadth.appendChild(el('down', `跌${downC}`));
    host.appendChild(breadth);
  }
  drawSlackKline(info.klines);
}

function applySlackStage(payload) {
  const stage = payload.slackStage === 'jump' || payload.slackStage === 'carry'
    ? payload.slackStage
    : 'intro';
  const intro = stage === 'intro';
  const carry = stage === 'carry';
  setHidden(duoIntroLeft, !intro);
  setHidden(duoIntroRight, !intro);
  setHidden(duoSlackBoard, !carry);
  setHidden(duoSlackFeed, !carry);
  petImage.style.opacity = intro ? '0' : '';
  if (intro) {
    if (duoIntroLeft && typeof payload.introLeft === 'string' && payload.introLeft) duoIntroLeft.src = payload.introLeft;
    if (duoIntroRight && typeof payload.introRight === 'string' && payload.introRight) duoIntroRight.src = payload.introRight;
    resetSlackMedia();
    return;
  }
  if (stage === 'jump') {
    resetSlackMedia();
    return;
  }
  updateSlackBoard();
  playSlackClips(payload.clips);
  requestAnimationFrame(() => {
    drawSlackKline(lastMarketInfo?.klines);
    requestAnimationFrame(() => drawSlackKline(lastMarketInfo?.klines));
  });
}

function resetSlackStage() {
  setHidden(duoIntroLeft, true);
  setHidden(duoIntroRight, true);
  setHidden(duoSlackBoard, true);
  setHidden(duoSlackFeed, true);
  petImage.style.opacity = '';
  resetSlackMedia();
}

window.petApi.onDuoOverlay(({ active, progress, direction, phase, side, slackStage, introLeft, introRight, clips }) => {
  if (!duoOverlay) return;
  slackActive = active === true && phase === 'slack';
  tentActive = active === true && phase === 'tent';
  if (tentActive) startTentClock();
  else stopTentClock();
  if (active === true) {
    duoOverlay.hidden = false;
    const value = Number(progress);
    const raw = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
    const open = phase === 'slack' ? 1 : (phase === 'tent' ? raw : (phase === 'folding' ? 1 - raw : raw));
    duoOverlay.style.setProperty('--duo-progress', String(raw));
    duoOverlay.style.setProperty('--duo-open', String(open));
    const frost = phase === 'folding' || phase === 'unfolding' ? raw : 0;
    duoOverlay.style.setProperty('--duo-frost', String(frost));
    duoOverlay.dataset.direction = direction === 'left' || direction === 'right' ? direction : 'right';
    duoOverlay.dataset.phase = typeof phase === 'string' ? phase : '';
    duoOverlay.dataset.side = side === 'left' || side === 'right' ? side : '';
    duoOverlay.dataset.slackStage = slackActive
      ? (slackStage === 'jump' || slackStage === 'carry' ? slackStage : 'intro')
      : '';
    if (slackActive) applySlackStage({ slackStage, introLeft, introRight, clips });
    else resetSlackStage();
    if (tentActive || slackActive) hideTicker();
  } else {
    slackActive = false;
    resetSlackStage();
    duoOverlay.hidden = true;
    duoOverlay.style.setProperty('--duo-open', '0');
    duoOverlay.style.setProperty('--duo-frost', '0');
    duoOverlay.dataset.side = '';
    duoOverlay.dataset.phase = '';
    duoOverlay.dataset.slackStage = '';
  }
});
window.petApi.getCurrentPet().then(loadPet);

// Persistent market board above the head. Red = up, green = down.
// Shows the watched index with points/change, the other two major indices,
// turnover and advance/decline breadth so it reads like a real quote board.
function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '--';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function el(cls, text) {
  const node = document.createElement('span');
  if (cls) node.className = cls;
  node.textContent = text;
  return node;
}
function shortName(name) {
  if (!name) return '';
  return name.replace('上证指数', '上证').replace('深证成指', '深证').replace('创业板指', '创业板');
}
function updateTicker(info) {
  lastMarketInfo = info;
  if (slackActive) updateSlackBoard(info);
  if (tentActive || slackActive) {
    hideTicker();
    return;
  }
  ticker.textContent = '';
  if (!info || info.enabled !== true) {
    ticker.classList.remove('visible', 'up', 'down');
    pet.classList.remove('has-ticker');
    return;
  }
  pet.classList.add('has-ticker');
  ticker.classList.add('visible');
  const pct = Number(info.pct);
  if (!Number.isFinite(pct)) {
    ticker.classList.remove('up', 'down');
    ticker.appendChild(el('', info.simulated ? '模拟盘待命' : '大盘待命'));
    return;
  }
  const up = pct > 0;
  ticker.classList.toggle('up', up);
  ticker.classList.toggle('down', !up);

  // Line 1: watched index + points + change% + change amount.
  const main = document.createElement('div');
  main.className = 'tk-main';
  const arrow = up ? '▲' : '▼';
  const sign = up ? '+' : '';
  const points = Number(info.points);
  main.appendChild(el('', `${info.simulated ? '模拟 ' : ''}${shortName(info.name) || '大盘'} `));
  if (Number.isFinite(points)) main.appendChild(el('', `${points.toFixed(2)} `));
  main.appendChild(el('tk-arrow', `${arrow}${sign}${pct.toFixed(2)}%`));
  ticker.appendChild(main);

  // Line 2: the other two major indices, each colored by its own direction.
  if (Array.isArray(info.indices) && info.indices.length) {
    const sub = document.createElement('div');
    sub.className = 'tk-sub';
    info.indices.forEach((idx, i) => {
      const n = Number(idx.pct);
      const cls = Number.isFinite(n) ? (n > 0 ? 'u' : 'd') : '';
      if (i > 0) sub.appendChild(el('', '  '));
      sub.appendChild(el(cls, `${shortName(idx.name)} ${fmtPct(idx.pct)}`));
    });
    ticker.appendChild(sub);
  }

  // Line 3: turnover + advance/decline breadth.
  const amount = Number(info.amount);
  const upC = Number(info.up);
  const downC = Number(info.down);
  if (Number.isFinite(amount) || Number.isFinite(upC)) {
    const line = document.createElement('div');
    line.className = 'tk-sub';
    if (Number.isFinite(amount)) line.appendChild(el('', `成交 ${Math.round(amount / 1e8)}亿`));
    if (Number.isFinite(upC) && Number.isFinite(downC)) {
      if (Number.isFinite(amount)) line.appendChild(el('', '  '));
      line.appendChild(el('u', `涨${upC}`));
      line.appendChild(el('', ' '));
      line.appendChild(el('d', `跌${downC}`));
    }
    ticker.appendChild(line);
  }
}
