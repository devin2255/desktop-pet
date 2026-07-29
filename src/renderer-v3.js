const pet = document.getElementById('pet');
const petImage = document.getElementById('pet-image');
const bubble = document.getElementById('bubble');
const hearts = document.getElementById('hearts');

let manifest;
let pointerDown;
let bubbleTimer;
let animationTimer;
let animationToken = 0;
let pendingState = { state: 'idle', message: '' };
const DRAG_THRESHOLD_PX = 6;
const HIT_ALPHA_CUTOFF = 32;
const hitCanvas = document.createElement('canvas');
const hitContext = hitCanvas.getContext('2d', { willReadFrequently: true });
let hitMaskReady = false;

function resolveAction(state) {
  if (state === 'walk-left' || state === 'walk-right') return 'walk';
  if (state === 'clingy' || state === 'shy') return 'reaction';
  return manifest.animations[state] ? state : 'idle';
}

function preloadFrames() {
  for (const animation of Object.values(manifest.animations)) {
    for (const frame of animation.frames) {
      const image = new Image();
      image.src = frame;
    }
  }
}

function playAnimation(state) {
  clearTimeout(animationTimer);
  animationToken += 1;
  if (!manifest) return;
  const token = animationToken;
  const animation = manifest.animations[resolveAction(state)] || manifest.animations.idle;
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
  bubble.textContent = message;
  bubble.classList.add('visible');
  bubbleTimer = setTimeout(() => bubble.classList.remove('visible'), duration);
}

function speak(text) {
  if (!text || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.88;
  utterance.pitch = 0.9;
  window.speechSynthesis.speak(utterance);
}

function setState(state, message = '', speech = '') {
  pendingState = { state, message, speech };
  pet.className = `pet state-${state}${pointerDown ? ' dragging' : ''}`;
  if (!manifest) return;
  playAnimation(state);
  if (message) showBubble(message, state === 'sleep' ? 4200 : 2400);
  if (speech) speak(speech);
}

function loadPet(nextManifest) {
  manifest = nextManifest;
  petImage.alt = `${manifest.name}桌面宠物`;
  petImage.classList.remove('ready');
  preloadFrames();
  setState(pendingState.state || 'idle', pendingState.message || '', pendingState.speech || '');
}

function refreshHitMask() {
  hitMaskReady = false;
  if (!hitContext || !petImage.naturalWidth || !petImage.naturalHeight) return;
  hitCanvas.width = petImage.naturalWidth;
  hitCanvas.height = petImage.naturalHeight;
  try {
    hitContext.clearRect(0, 0, hitCanvas.width, hitCanvas.height);
    hitContext.drawImage(petImage, 0, 0);
    hitContext.getImageData(0, 0, 1, 1);
    hitMaskReady = true;
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
  if (pet.classList.contains('state-walk-left')) sourceX = hitCanvas.width - 1 - sourceX;
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
  if (dragged) window.petApi.endDrag();
  else { releaseHearts(); window.petApi.interact(); }
});
pet.addEventListener('pointercancel', () => {
  const dragged = pointerDown?.dragStarted;
  pointerDown = undefined;
  pet.classList.remove('dragging');
  if (dragged) window.petApi.endDrag();
});
pet.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.petApi.openMenu();
});

window.petApi.onLoad(loadPet);
window.petApi.onState(({ state, message, speech }) => setState(state, message, speech));
window.petApi.getCurrentPet().then(loadPet);
