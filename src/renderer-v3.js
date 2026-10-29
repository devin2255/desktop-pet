const pet = document.getElementById('pet');
const petImage = document.getElementById('pet-image');
const bubble = document.getElementById('bubble');
const bubbleText = document.getElementById('bubble-text') || bubble;
const bubbleSeal = document.getElementById('bubble-seal');
const hearts = document.getElementById('hearts');
const weather = document.getElementById('weather');

let manifest;
let pointerDown;
let bubbleTimer;
let animationTimer;
let animationToken = 0;
let pendingState = { state: 'idle', message: '' };
let weatherTimer;
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
  const normalized = baseActionName(action);
  if (normalized === 'walk-left' || normalized === 'walk-right') return 'walk';
  if (normalized === 'clingy' || normalized === 'shy') return 'reaction';
  if (manifest.animations[normalized]) return normalized;
  const stateBase = baseActionName(state);
  return manifest.animations[stateBase] ? stateBase : 'idle';
}

function isFacingLeft() {
  return pet.classList.contains('state-walk-left')
    || pet.classList.contains('state-drag-left')
    || pet.classList.contains('state-climb-left')
    || pet.classList.contains('state-fall-left');
}

function preloadFrames() {
  for (const animation of Object.values(manifest.animations)) {
    for (const frame of animation.frames) {
      const image = new Image();
      image.src = frame;
    }
  }
}

function playAnimation(state, logicalRole) {
  clearTimeout(animationTimer);
  animationToken += 1;
  if (!manifest) return;
  const token = animationToken;
  const animation = manifest.animations[resolveAction(state, logicalRole)] || manifest.animations.idle;
  pet.style.setProperty('--action-scale', String(animation.scale || 1));
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

function showBubble(message, duration = 2200) {
  clearTimeout(bubbleTimer);
  bubbleText.textContent = message;
  const letter = manifest?.bubbleStyle === 'letter';
  const short = [...String(message)].length <= 8;
  bubble.classList.toggle('letter', letter);
  bubble.classList.toggle('vertical', letter && short);
  if (bubbleSeal) {
    const glyph = typeof manifest?.sealGlyph === 'string' ? manifest.sealGlyph : '';
    bubbleSeal.textContent = glyph;
    bubbleSeal.hidden = !letter || !glyph;
  }
  bubble.classList.add('visible');
  // Re-measure after text/layout so the bubble sits just above the visible head.
  if (lastVisibleInsets) positionBubble(lastVisibleInsets);
  requestAnimationFrame(() => {
    if (lastVisibleInsets) positionBubble(lastVisibleInsets);
  });
  bubbleTimer = setTimeout(() => bubble.classList.remove('visible'), duration);
}

const MALE_VOICE_RE = /kang|yunyang|yunxi|yunjian|yunfeng|dongni|male|男|kangkang/i;
const FEMALE_VOICE_RE = /huihui|yaoyao|xiaoxiao|xiaoyi|xiaohan|female|女|zira|jenny|aria/i;
const CHILD_VOICE_RE = /xiaoxiao|xiaoyi|yunxia|yaoyao|huihui|xiaotong|xiaoqiu|child|童|女童/i;

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
  if (preferredGender === 'child') {
    return pool.find((voice) => CHILD_VOICE_RE.test(voice.name))
      || pool.find((voice) => FEMALE_VOICE_RE.test(voice.name))
      || pool.find((voice) => !MALE_VOICE_RE.test(voice.name))
      || pool[0];
  }
  return pool.find((voice) => voice.default) || pool[0];
}

let speechAudio;

function stopSpeechAudio() {
  if (!speechAudio) return;
  speechAudio.pause();
  speechAudio.src = '';
  speechAudio = undefined;
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
  speechAudio = new Audio(url);
  speechAudio.play().catch(() => {});
  return true;
}

function speak(text, audioUrl = '') {
  if (manifest?.speechEnabled === false) {
    stopSpeechAudio();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    return;
  }
  if (audioUrl && playSpeechAudio(audioUrl)) return;
  if (!text || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  stopSpeechAudio();
  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.92;
  const gender = manifest?.speechGender === 'male' || manifest?.speechGender === 'female'
    || manifest?.speechGender === 'child'
    ? manifest.speechGender
    : '';
  const voice = pickSpeechVoice(gender);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang || 'zh-CN';
  }
  if (gender === 'child') {
    utterance.pitch = 1.42;
    utterance.rate = 1.04;
  } else if (gender === 'male' && voice && MALE_VOICE_RE.test(voice.name)) {
    utterance.pitch = 1;
  } else if (gender === 'male') {
    utterance.pitch = 0.75;
  } else {
    utterance.pitch = 1;
  }
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

function applyPetClass(state) {
  const seasonal = Boolean(manifest?.hasCalendarMoments);
  const walkFrames = manifest?.animations?.walk?.frames?.length || 0;
  const walkCycle = Boolean(manifest) && resolveAction(state) === 'walk' && walkFrames >= 4;
  pet.className = [
    'pet',
    `state-${state}`,
    seasonal ? 'seasonal' : '',
    manifest?.bubbleStyle === 'letter' ? 'letter-style' : '',
    manifest?.ceremonyToday ? 'ceremony' : '',
    walkCycle ? 'has-walk-cycle' : '',
    pointerDown ? 'dragging' : ''
  ].filter(Boolean).join(' ');
}

function setState(state, message = '', speech = '', logicalRole, speechAudio = '', fxBurst = false) {
  pendingState = { state, message, speech, logicalRole, speechAudio };
  applyPetClass(state);
  if (!manifest) return;
  playAnimation(state, logicalRole);
  if (message) {
    const chars = [...String(message)].length;
    const bubbleMs = Math.min(20000, Math.max(10000, 4000 + chars * 280));
    showBubble(message, bubbleMs);
  }
  if (fxBurst) spawnWeatherBurst(12);
  if (manifest.speechEnabled === false) {
    stopSpeechAudio();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  } else {
    const audio = speechAudio || resolveSpeechAudio(state);
    if (speech || audio) speak(speech, audio);
  }
}

function loadPet(nextManifest) {
  manifest = nextManifest;
  const firstFrame = Object.values(manifest.animations || {})[0]?.frames?.[0] || '';
  if (String(firstFrame).startsWith('pet-asset:')) petImage.crossOrigin = 'anonymous';
  else petImage.removeAttribute('crossorigin');
  petImage.alt = `${manifest.name}桌面宠物`;
  petImage.classList.remove('ready');
  preloadFrames();
  startWeather();
  setState(
    pendingState.state || 'idle',
    pendingState.message || '',
    pendingState.speech || '',
    pendingState.logicalRole,
    pendingState.speechAudio || ''
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

function spawnMark(kind, host, extras = {}) {
  if (!host || !kind) return;
  const node = document.createElement('span');
  node.className = extras.stamp ? 'mark mark-stamp' : `mark mark-${kind}`;
  if (extras.stamp) node.textContent = extras.glyph || '';
  else if (kind === 'heart') {
    node.className = 'heart';
    node.textContent = '♥';
  }
  node.style.setProperty('--x', `${extras.x ?? Math.round(12 + Math.random() * 76)}%`);
  node.style.setProperty('--y', `${extras.y ?? Math.round(4 + Math.random() * 28)}%`);
  node.style.setProperty('--drift', `${Math.round(Math.random() * 28 - 14)}px`);
  if (Number.isFinite(extras.delay)) node.style.animationDelay = `${extras.delay}ms`;
  host.appendChild(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
}

function weatherKind() {
  return manifest?.weatherFx || '';
}

function spawnWeatherBurst(count = 8) {
  const kind = weatherKind();
  if (!weather || !kind) return;
  for (let index = 0; index < count; index += 1) {
    spawnMark(kind, weather, { delay: index * 40 });
  }
}

function startWeather() {
  if (weatherTimer) clearInterval(weatherTimer);
  weatherTimer = undefined;
  if (!weather) return;
  weather.replaceChildren();
  if (!manifest?.weatherEnabled || !weatherKind()) return;
  const pulse = () => spawnWeatherBurst(manifest.ceremonyToday ? 3 : 1);
  pulse();
  weatherTimer = setInterval(pulse, manifest.ceremonyToday ? 700 : 1500);
}

function releaseHearts() {
  const mode = manifest?.clickFx || 'hearts';
  if (mode === 'hearts') {
    for (let index = 0; index < 3; index += 1) {
      spawnMark('heart', hearts, { delay: index * 80 });
    }
    return;
  }
  if ((mode === 'seal' || mode === 'seasonal') && manifest?.sealGlyph && hearts) {
    spawnMark('seal', hearts, { stamp: true, glyph: manifest.sealGlyph });
  }
  const kind = mode === 'qi' ? 'qi' : (weatherKind() || 'qi');
  for (let index = 0; index < 5; index += 1) {
    spawnMark(kind, hearts, { delay: index * 50, y: Math.round(28 + Math.random() * 24) });
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
window.petApi.onState(({ state, message, speech, logicalRole, speechAudio, fxBurst }) =>
  setState(state, message, speech, logicalRole, speechAudio || '', Boolean(fxBurst)));
window.petApi.getCurrentPet().then(loadPet);
