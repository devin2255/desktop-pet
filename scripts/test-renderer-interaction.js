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
    dataset: {},
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
const ticker = element();
const duoOverlay = element();
function videoElement() {
  const node = element();
  node.src = '';
  node.loop = false;
  node.muted = true;
  node.pause = () => {};
  node.play = () => Promise.resolve();
  node.removeAttribute = (name) => {
    if (name === 'src') node.src = '';
  };
  return node;
}
const duoSlackFeed = element();
const duoSlackVideo = videoElement();
duoSlackVideo.classList.add('duo-slack-video', 'is-current');
const duoSlackVideoNext = videoElement();
duoSlackVideoNext.classList.add('duo-slack-video', 'is-next');
const windowListeners = new Map();
const calls = {
  start: 0,
  move: 0,
  end: 0,
  endPointers: [],
  interact: 0,
  through: [],
  spoken: [],
  audio: [],
  insets: [],
  openMenu: 0,
  duoDown: [],
  duoMove: [],
  duoUp: [],
  duoCancel: 0,
  slackExit: 0
};
let loadCallback;
let stateCallback;
let overlayCallback;

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
    getElementById: (id) => ({
      pet,
      'pet-image': petImage,
      bubble,
      hearts,
      ticker,
      'duo-overlay': duoOverlay,
      'duo-slack-feed': duoSlackFeed,
      'duo-slack-video': duoSlackVideo,
      'duo-slack-video-next': duoSlackVideoNext
    }[id]),
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
      onMarket: () => {},
      onDuoOverlay: (callback) => { overlayCallback = callback; },
      getCurrentPet: () => ({ then: () => {} }),
      startDrag: () => { calls.start += 1; },
      drag: () => { calls.move += 1; },
      endDrag: (pointer) => { calls.end += 1; calls.endPointers.push(pointer); },
      interact: () => { calls.interact += 1; },
      setMouseThrough: (ignore) => calls.through.push(ignore),
      setVisibleInsets: (insets) => calls.insets.push(insets),
      openMenu: () => { calls.openMenu += 1; },
      duoPointerDown: (payload) => calls.duoDown.push(payload),
      duoPointerMove: (payload) => calls.duoMove.push(payload),
      duoPointerUp: (payload) => calls.duoUp.push(payload),
      duoPointerCancel: () => { calls.duoCancel += 1; },
      slackExit: () => { calls.slackExit += 1; }
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
    sit: { frames: ['sit-01.png', 'sit-02.png', 'sit-03.png', 'sit-04.png'], durations: [100, 100, 100, 1800], loop: false },
    reaction: { frames: ['reaction.png'], durations: [100], loop: false },
    'call-dad': { frames: ['call.png'], durations: [100], loop: false }
  },
  contextMenuActions: [
    { id: 'call-dad', label: '叫大爷', action: 'call-dad', speech: '大爷', speechAudio: 'audio/call-dad.mp3' }
  ]
};
loadCallback(manifest);

stateCallback({ state: 'reaction', message: '' });
assert.strictEqual(petImage.src, 'reaction.png');
overlayCallback({ active: true, progress: 1, phase: 'slack', slackStage: 'jump' });
assert.strictEqual(petImage.src, 'reaction.png', 'slack jump overlay must not replace the pet:state animation');
overlayCallback({ active: true, progress: 1, phase: 'slack', slackStage: 'carry', clips: [] });
assert.strictEqual(petImage.src, 'reaction.png', 'slack carry overlay must not replace the pet:state animation');
overlayCallback({ active: false, progress: 0, phase: 'slack' });

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
  pet.listeners.get(name)({
    button: 0,
    screenX: x,
    screenY: y,
    pointerId,
    preventDefault: () => {}
  });
}

function rightPointer(name, x, y, pointerId = 2) {
  pet.listeners.get(name)({
    button: 2,
    screenX: x,
    screenY: y,
    pointerId,
    preventDefault: () => {}
  });
}

function contextMenu() {
  let prevented = 0;
  pet.listeners.get('contextmenu')({
    preventDefault: () => { prevented += 1; }
  });
  return prevented;
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

const interactBeforeSlack = calls.interact;
overlayCallback({ active: true, progress: 1, phase: 'slack', slackStage: 'intro' });
pointer('pointerdown', 100, 100);
pointer('pointerup', 100, 100);
assert.strictEqual(calls.slackExit, 1, 'stationary left click during slack should exit slack mode');
assert.strictEqual(calls.interact, interactBeforeSlack, 'slack exit click must not trigger the normal interaction');

pointer('pointerdown', 100, 100);
pointer('pointermove', 107, 100);
pointer('pointerup', 107, 100);
assert.strictEqual(calls.slackExit, 1, 'left drag during slack must not exit slack mode');
assert.strictEqual(calls.end, 2, 'left drag during slack should still use normal drag release');
overlayCallback({ active: false, progress: 0, phase: 'slack' });

rightPointer('pointerdown', 100, 100);
rightPointer('pointerup', 105, 100);
assert.strictEqual(contextMenu(), 1, 'short right press menu must suppress the browser default menu');
assert.strictEqual(calls.openMenu, 1, 'short right press should open the app menu');

rightPointer('pointerdown', 100, 100);
rightPointer('pointermove', 112, 100);
rightPointer('pointerup', 112, 100);
assert.strictEqual(contextMenu(), 1, '12px right press duo gesture should suppress the app menu');
assert.strictEqual(calls.openMenu, 1, 'duo gesture must not open the app menu');
assert.deepStrictEqual({ ...calls.duoMove.at(-1) }, {
  screenX: 112, screenY: 100, dx: 12, dy: 0
}, 'duo move payload should report finite displacement');

rightPointer('pointerdown', 100, 100);
rightPointer('pointerup', 112, 100);
assert.strictEqual(contextMenu(), 1, 'jump-to-12px right release should suppress the app menu');
assert.strictEqual(calls.openMenu, 1, 'final 12px displacement without move must not open the app menu');

const throughBeforeDuoLeave = calls.through.length;
rightPointer('pointerdown', 100, 100);
windowListeners.get('mouseleave')();
assert.strictEqual(
  calls.through.length,
  throughBeforeDuoLeave,
  'mouseleave during a duo gesture must not flip mouse-through on'
);
rightPointer('pointercancel', 100, 100);

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

stateCallback({ state: 'sit' });
assert.strictEqual(petImage.src, 'sit-01.png', 'normal sit still starts on the stand-up intro');
stateCallback({ state: 'idle' });
stateCallback({ state: 'sit', startAtLast: true });
assert.strictEqual(petImage.src, 'sit-04.png', 'tent hold pose must skip the stand-to-sit intro');

loadCallback({
  name: 'folded-duo',
  animations: {
    idle: { frames: ['idle.png'], durations: [100], loop: true, scale: 1 },
    crawl: { frames: ['folded-crawl.png'], durations: [100], loop: true, scale: 1 },
    'duo-kick': { frames: ['duo-kick.png'], durations: [100], loop: false, scale: 1 }
  }
});
stateCallback({ state: 'duo-kick' });
assert.strictEqual(petImage.src, 'duo-kick.png');
loadCallback({
  name: 'judge',
  animations: {
    idle: { frames: ['idle.png'], durations: [100], loop: true, scale: 1 },
    crawl: { frames: ['crawl.png'], durations: [100], loop: true, scale: 0.62 }
  }
});
assert.notStrictEqual(
  petImage.src,
  'idle.png',
  'unfold must not flash unscaled standing idle when the fold transition action is missing on the member'
);
assert.strictEqual(petImage.classList.contains('ready'), false, 'member load should hide the old transition frame');
stateCallback({ state: 'crawl-left' });
assert.strictEqual(pet.style.getPropertyValue('--action-scale'), '0.62');
assert.strictEqual(petImage.src, 'crawl.png');

overlayCallback({
  active: true,
  progress: 1,
  phase: 'slack',
  slackStage: 'carry',
  clips: ['clip-a.mp4', 'clip-b.mp4', 'clip-c.mp4']
});
assert.strictEqual(duoSlackFeed.hidden, false, 'carry should show the right-screen feed');
assert.strictEqual(duoSlackVideo.src, 'clip-a.mp4', 'feed should start on the first clip');
assert.strictEqual(duoSlackVideoNext.src, '', 'must not preload the next clip while the current clip is still playing');
assert.ok(!duoSlackVideo.listeners.has('timeupdate'), 'must not preload on timeupdate');
assert.ok(!duoSlackVideo.listeners.has('waiting'), 'must not skip a clip when Chromium fires waiting');
duoSlackVideo.listeners.get('ended')({ target: duoSlackVideo });
assert.strictEqual(duoSlackVideoNext.src, 'clip-b.mp4', 'next clip loads only after the current clip ends');
assert.ok(duoSlackFeed.classList.contains('is-sliding'), 'ended clip should slide up to the next video');
duoSlackFeed.listeners.get('transitionend')({
  propertyName: 'transform',
  target: duoSlackVideoNext
});
assert.ok(!duoSlackFeed.classList.contains('is-sliding'), 'slide should finish after the transform');
assert.ok(duoSlackVideoNext.classList.contains('is-current'), 'incoming clip should become current');
assert.ok(duoSlackVideo.classList.contains('is-next'), 'outgoing clip should wait below');
assert.strictEqual(duoSlackVideoNext.src, 'clip-b.mp4', 'current layer should keep playing the second clip');
assert.strictEqual(duoSlackVideo.src, '', 'outgoing layer should not load the third clip while the second is playing');
duoSlackVideoNext.listeners.get('ended')({ target: duoSlackVideoNext });
duoSlackFeed.listeners.get('transitionend')({
  propertyName: 'transform',
  target: duoSlackVideo
});
assert.strictEqual(duoSlackVideo.src, 'clip-c.mp4', 'third clip should become current');
assert.strictEqual(duoSlackVideoNext.src, '', 'wrap must wait until the third clip ends');
duoSlackVideo.listeners.get('ended')({ target: duoSlackVideo });
assert.strictEqual(duoSlackVideoNext.src, 'clip-a.mp4', 'feed should wrap back to the first clip');
overlayCallback({ active: false, progress: 0, phase: 'slack' });
assert.strictEqual(duoSlackFeed.hidden, true, 'leaving slack should hide the feed');
assert.strictEqual(duoSlackVideo.src, '', 'leaving slack should unload clips');

console.log('renderer interaction regression checks passed');
