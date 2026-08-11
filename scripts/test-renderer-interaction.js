'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function classList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
    replace: (names) => {
      values.clear();
      names.forEach((name) => values.add(name));
    },
    toString: () => [...values].join(' ')
  };
}

function element() {
  const listeners = new Map();
  const properties = new Map();
  const classes = classList();
  const node = {
    listeners,
    classList: classes,
    style: {
      setProperty: (name, value) => properties.set(name, value),
      getPropertyValue: (name) => properties.get(name)
    },
    addEventListener: (name, callback) => listeners.set(name, callback),
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    appendChild: () => {},
    getBoundingClientRect: () => ({ left: 10, top: 10, right: 170, bottom: 170, width: 160, height: 160 })
  };
  Object.defineProperty(node, 'className', {
    get: () => classes.toString(),
    set: (value) => classes.replace(String(value).split(/\s+/).filter(Boolean))
  });
  return node;
}

const pet = element();
const petImage = element();
petImage.naturalWidth = 480;
petImage.naturalHeight = 480;
const bubble = element();
bubble.offsetHeight = 24;
const hearts = element();
const windowListeners = new Map();
const calls = { start: 0, move: 0, end: 0, endPointers: [], interact: 0, through: [], spoken: [], audio: [], insets: [] };
let loadCallback;
let stateCallback;

let alphaBounds = { left: 30, top: 60, right: 449, bottom: 479 };
const canvasContext = {
  clearRect: () => {},
  drawImage: () => {},
  getImageData: (x, y, width = 1, height = 1) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const sourceX = x + column;
        const sourceY = y + row;
        if (sourceX >= alphaBounds.left && sourceX <= alphaBounds.right
          && sourceY >= alphaBounds.top && sourceY <= alphaBounds.bottom) {
          data[(row * width + column) * 4 + 3] = 255;
        }
      }
    }
    return { data };
  }
};
const canvas = { width: 0, height: 0, getContext: () => canvasContext };

const rafCallbacks = [];
const timeoutQueue = [];
let timeoutId = 0;
const context = {
  console,
  Uint8ClampedArray,
  innerWidth: 180,
  innerHeight: 180,
  Image: function Image() {},
  Audio: function Audio(src) {
    calls.audio.push(src);
    this.src = src || '';
    this.pause = () => {};
    this.play = () => Promise.resolve();
    this.addEventListener = () => {};
  },
  setTimeout: (callback, delay = 0) => {
    const id = ++timeoutId;
    timeoutQueue.push({ id, callback, delay, remaining: delay });
    return id;
  },
  clearTimeout: (id) => {
    const index = timeoutQueue.findIndex((entry) => entry.id === id);
    if (index >= 0) timeoutQueue.splice(index, 1);
  },
  requestAnimationFrame: (callback) => {
    rafCallbacks.push(callback);
    return rafCallbacks.length;
  },
  document: {
    getElementById: (id) => ({ pet, 'pet-image': petImage, bubble, hearts }[id]),
    createElement: (name) => name === 'canvas' ? canvas : element()
  },
  window: {
    addEventListener: (name, callback) => windowListeners.set(name, callback),
    SpeechSynthesisUtterance: function SpeechSynthesisUtterance(text) { this.text = text; },
    speechSynthesis: {
      cancel: () => {},
      getVoices: () => [
        { name: 'Microsoft Huihui - Chinese (Simplified, PRC)', lang: 'zh-CN', default: true },
        { name: 'Microsoft Kangkang - Chinese (Simplified, PRC)', lang: 'zh-CN', default: false }
      ],
      addEventListener: () => {},
      speak: (utterance) => calls.spoken.push({
        text: utterance.text,
        voice: utterance.voice?.name || '',
        pitch: utterance.pitch
      })
    },
    petApi: {
      onLoad: (callback) => { loadCallback = callback; },
      onState: (callback) => { stateCallback = callback; },
      getCurrentPet: () => ({ then: () => {} }),
      startDrag: () => { calls.start += 1; },
      drag: () => { calls.move += 1; },
      endDrag: (pointer) => { calls.end += 1; calls.endPointers.push(pointer); },
      interact: () => { calls.interact += 1; },
      setMouseThrough: (ignore) => calls.through.push(ignore),
      setVisibleInsets: (insets) => calls.insets.push(insets),
      openMenu: () => {}
    }
  }
};

const rendererPath = path.join(__dirname, '..', 'src', 'renderer-v3.js');
vm.runInNewContext(fs.readFileSync(rendererPath, 'utf8'), context, { filename: rendererPath });

const manifest = {
  name: '测试宠物',
  speechGender: 'male',
  animations: {
    idle: { frames: ['idle.png'], durations: [100], loop: true },
    walk: { frames: ['walk.png'], durations: [100], loop: true },
    sit: { frames: ['sit.png'], durations: [100], loop: true },
    reaction: { frames: ['reaction.png'], durations: [100], loop: false },
    'call-dad': { frames: ['call.png'], durations: [100], loop: false }
  },
  contextMenuActions: [
    { id: 'call-dad', label: '叫大爷', action: 'call-dad', speech: '大爷', speechAudio: 'audio/call-dad.mp3' }
  ]
};
loadCallback(manifest);

function runTimers(ms) {
  let elapsed = 0;
  while (elapsed < ms && timeoutQueue.length) {
    const nextDelay = Math.min(...timeoutQueue.map((entry) => entry.remaining));
    const step = Math.min(nextDelay, ms - elapsed);
    elapsed += step;
    for (const entry of timeoutQueue) entry.remaining -= step;
    const due = timeoutQueue.filter((entry) => entry.remaining <= 0);
    timeoutQueue.splice(0, timeoutQueue.length, ...timeoutQueue.filter((entry) => entry.remaining > 0));
    for (const entry of due) entry.callback();
  }
}

function pointer(name, x, y, pointerId = 1) {
  pet.listeners.get(name)({ button: 0, screenX: x, screenY: y, pointerId });
}

for (let index = 0; index < 50; index += 1) {
  pointer('pointerdown', 100, 100);
  pointer('pointerup', 100, 100);
}
assert.strictEqual(calls.start, 0, 'plain clicks must never start a drag');
assert.strictEqual(calls.move, 0, 'plain clicks must never move the window');
assert.strictEqual(calls.end, 0, 'plain clicks must never end a nonexistent drag');
assert.strictEqual(calls.interact, 50, 'all stationary clicks should remain interactions');

pointer('pointerdown', 100, 100);
pointer('pointermove', 104, 103);
pointer('pointerup', 104, 103);
assert.strictEqual(calls.start, 0, 'sub-threshold pointer jitter must not start a drag');

pointer('pointerdown', 100, 100);
pointer('pointermove', 107, 100);
pointer('pointerup', 107, 100);
assert.strictEqual(calls.start, 1, 'movement past the dead zone should start one drag');
assert.strictEqual(calls.move, 1);
assert.strictEqual(calls.end, 1);
assert.deepStrictEqual({ ...calls.endPointers[0] }, { screenX: 107, screenY: 100 });

for (let index = 0; index < 50; index += 1) stateCallback({ state: 'reaction', message: '' });
assert.strictEqual(pet.style.getPropertyValue('--action-scale'), '1', 'repeated reactions must set an absolute scale');
assert.strictEqual(pet.className, 'pet state-reaction', 'repeated reactions must replace state classes, not accumulate them');

stateCallback({ state: 'reaction', message: '爸！', speech: '爸' });
assert.deepStrictEqual(calls.spoken, [{
  text: '爸',
  voice: 'Microsoft Kangkang - Chinese (Simplified, PRC)',
  pitch: 1
}], 'configured speech should use a male zh-CN voice when speechGender is male');

stateCallback({ state: 'call-dad', message: '大爷!', speech: '大爷' });
assert.deepStrictEqual(calls.audio, ['audio/call-dad.mp3'], 'bundled speechAudio should play instead of system TTS');

stateCallback({
  state: 'reaction',
  message: '老公喝茶',
  speech: '老公喝茶',
  speechAudio: 'pet-asset://demo/audio/serve-tea.mp3'
});
assert.deepStrictEqual(
  calls.audio.slice(-1),
  ['pet-asset://demo/audio/serve-tea.mp3'],
  'behavior speechAudio from pet:state should play instead of system TTS'
);

petImage.listeners.get('load')();
assert.deepStrictEqual({ ...calls.insets.at(-1) }, {
  left: 20, top: 30, right: 20, bottom: 10
});
assert.strictEqual(
  bubble.style.getPropertyValue('--bubble-top'),
  '4px',
  'bubble sits 2px above the visible head when space allows (30 - 24 - 2)'
);

alphaBounds = { left: 30, top: 200, right: 449, bottom: 479 };
petImage.getBoundingClientRect = () => ({ left: 0, top: 0, right: 180, bottom: 180, width: 180, height: 180 });
petImage.listeners.get('load')();
assert.strictEqual(
  bubble.style.getPropertyValue('--bubble-top'),
  '49px',
  'bubble must hug a lower visible head instead of staying at the window top'
);
stateCallback({ state: 'call-dad', message: '大爷!' });
assert.strictEqual(
  bubble.style.getPropertyValue('--bubble-top'),
  '49px',
  'showing a bubble should keep the last head-relative position'
);
while (rafCallbacks.length) rafCallbacks.shift()();
assert.strictEqual(bubble.style.getPropertyValue('--bubble-top'), '49px');
stateCallback({ state: 'drag', logicalRole: 'drag', message: '' });
assert.strictEqual(petImage.src, 'walk.png', 'drag role falls back to walk');
for (let index = 0; index < 50; index += 1) {
  stateCallback({ state: 'perch', logicalRole: 'perch', message: '测试' });
}
assert.strictEqual(pet.style.getPropertyValue('--action-scale'), '1');

alphaBounds = { left: 30, top: 60, right: 419, bottom: 479 };
petImage.getBoundingClientRect = () => ({ left: 10, top: 10, right: 170, bottom: 170, width: 160, height: 160 });
stateCallback({ state: 'walk-left', message: '' });
petImage.listeners.get('load')();
assert.deepStrictEqual({ ...calls.insets.at(-1) }, {
  left: 30, top: 30, right: 20, bottom: 10
}, 'mirrored walk frames should mirror their visible alpha insets');

const reportCount = calls.insets.length;
alphaBounds = { left: 480, top: 480, right: 479, bottom: 479 };
petImage.listeners.get('load')();
assert.strictEqual(calls.insets.length, reportCount + 1, 'transparent transient frames retain the last valid inset report');
assert.deepStrictEqual({ ...calls.insets.at(-1) }, {
  left: 30, top: 30, right: 20, bottom: 10
});

alphaBounds = { left: 30, top: 60, right: 419, bottom: 479 };
windowListeners.get('mousemove')({ clientX: 1, clientY: 1 });
windowListeners.get('mousemove')({ clientX: 80, clientY: 80 });
assert.deepStrictEqual(calls.through.slice(-2), [true, false], 'transparent pixels should pass clicks through, visible pixels should not');

stateCallback({
  state: 'reaction',
  message: '',
  messages: ['第一句', '第二句'],
  messageGapMs: 50
});
assert.strictEqual(bubble.textContent, '第一句', 'staggered messages should show the first line immediately');
runTimers(49);
assert.strictEqual(bubble.textContent, '第一句', 'staggered messages should wait for the gap before switching');
runTimers(1);
assert.strictEqual(bubble.textContent, '第二句', 'staggered messages should advance to the next line after messageGapMs');

// Stop audio before testing empty state hides the bubble
runTimers(100);
stateCallback({ state: 'idle', message: '', speech: '', speechAudio: '' });
assert.strictEqual(bubble.classList.contains('visible'), false, 'empty state should hide the bubble and clear stagger timers');

console.log('renderer interaction regression checks passed');
