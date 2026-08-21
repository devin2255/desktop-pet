const pet = document.getElementById('pet');
const petImage = document.getElementById('pet-image');
const bubble = document.getElementById('bubble');
const hearts = document.getElementById('hearts');
const ticker = document.getElementById('ticker');

let manifest;
let pointerDown;
let bubbleTimer;
let bubbleStaggerTimers = [];
let animationTimer;
let animationToken = 0;
let pendingState = { state: 'idle', message: '', generation: 0 };
let stateGeneration = 0;
const DRAG_THRESHOLD_PX = 6;
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

function resolveAction(state, logicalRole) {
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
  return manifest.animations[stateBase] ? stateBase : 'idle';
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

function playAnimation(state, logicalRole) {
  if (!manifest) return;
  const action = resolveAction(state, logicalRole);
  const animation = manifest.animations[action] || manifest.animations.idle;
  pet.style.setProperty('--action-scale', String(animation.scale || 1));
  if (action === playingAction && animation.loop) return;
  playingAction = action;
  clearTimeout(animationTimer);
  animationToken += 1;
  const token = animationToken;
  let index = 0;
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
    generation: stateGeneration
  };
  pet.className = `pet state-${state}${pointerDown ? ' dragging' : ''}`;
  if (!manifest) return;
  playAnimation(state, logicalRole);
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
  if (pointerDown) {
    window.petApi.setMouseThrough(false);
    return;
  }
  window.petApi.setMouseThrough(!visiblePixelAt(event.clientX, event.clientY));
}

petImage.addEventListener('load', refreshHitMask);
window.addEventListener('mousemove', updateMouseThrough);
window.addEventListener('mouseleave', () => {
  if (!pointerDown) window.petApi.setMouseThrough(true);
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

pet.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  pointerDown = { x: event.screenX, y: event.screenY, dragStarted: false };
  pet.setPointerCapture(event.pointerId);
});
pet.addEventListener('pointermove', (event) => {
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
  if (!pointerDown) return;
  const dragged = pointerDown.dragStarted;
  pointerDown = undefined;
  pet.releasePointerCapture(event.pointerId);
  pet.classList.remove('dragging');
  if (dragged) window.petApi.endDrag({ screenX: event.screenX, screenY: event.screenY });
  else { releaseHearts(); window.petApi.interact(); }
});
pet.addEventListener('pointercancel', (event) => {
  const dragged = pointerDown?.dragStarted;
  pointerDown = undefined;
  pet.classList.remove('dragging');
  if (dragged) window.petApi.endDrag({ screenX: event.screenX, screenY: event.screenY });
});
pet.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.petApi.openMenu();
});

window.petApi.onLoad(loadPet);
window.petApi.onState(({ state, message, speech, logicalRole, speechAudio, messages, messageGapMs, speechGender, messageLoop, speechLoop }) =>
  setState(state, message, speech, logicalRole, speechAudio || '', messages, messageGapMs, { speechGender, messageLoop, speechLoop }));
window.petApi.onMarket(updateTicker);
window.petApi.getCurrentPet().then(loadPet);

// Persistent market ticker above the head. Red = up, green = down.
function updateTicker(info) {
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
    ticker.textContent = info.simulated ? '模拟盘待命' : '大盘雷达待命';
    return;
  }
  const up = pct > 0;
  ticker.classList.toggle('up', up);
  ticker.classList.toggle('down', !up);
  const arrow = up ? '▲' : '▼';
  const sign = up ? '+' : '';
  const points = Number(info.points);
  const pts = Number.isFinite(points) ? ` ${points.toFixed(2)}` : '';
  const tag = info.simulated ? '模拟 ' : '';
  ticker.textContent = `${tag}${arrow}${pts} ${sign}${pct.toFixed(2)}%`;
}
