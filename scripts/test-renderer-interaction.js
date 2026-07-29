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
    contains: (name) => values.has(name)
  };
}

function element() {
  const listeners = new Map();
  const properties = new Map();
  return {
    listeners,
    classList: classList(),
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
}

const pet = element();
const petImage = element();
petImage.naturalWidth = 480;
petImage.naturalHeight = 480;
const bubble = element();
const hearts = element();
const windowListeners = new Map();
const calls = { start: 0, move: 0, end: 0, interact: 0, through: [], spoken: [] };
let loadCallback;
let stateCallback;

const canvasContext = {
  clearRect: () => {},
  drawImage: () => {},
  getImageData: (_x, _y, width = 1, height = 1) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let index = 3; index < data.length; index += 4) data[index] = 255;
    return { data };
  }
};
const canvas = { width: 0, height: 0, getContext: () => canvasContext };

const context = {
  console,
  Uint8ClampedArray,
  Image: function Image() {},
  setTimeout: () => 1,
  clearTimeout: () => {},
  document: {
    getElementById: (id) => ({ pet, 'pet-image': petImage, bubble, hearts }[id]),
    createElement: (name) => name === 'canvas' ? canvas : element()
  },
  window: {
    addEventListener: (name, callback) => windowListeners.set(name, callback),
    SpeechSynthesisUtterance: function SpeechSynthesisUtterance(text) { this.text = text; },
    speechSynthesis: {
      cancel: () => {},
      speak: (utterance) => calls.spoken.push(utterance.text)
    },
    petApi: {
      onLoad: (callback) => { loadCallback = callback; },
      onState: (callback) => { stateCallback = callback; },
      getCurrentPet: () => ({ then: () => {} }),
      startDrag: () => { calls.start += 1; },
      drag: () => { calls.move += 1; },
      endDrag: () => { calls.end += 1; },
      interact: () => { calls.interact += 1; },
      setMouseThrough: (ignore) => calls.through.push(ignore),
      openMenu: () => {}
    }
  }
};

const rendererPath = path.join(__dirname, '..', 'src', 'renderer-v3.js');
vm.runInNewContext(fs.readFileSync(rendererPath, 'utf8'), context, { filename: rendererPath });

const manifest = {
  name: '测试宠物',
  animations: {
    idle: { frames: ['idle.png'], durations: [100], loop: true },
    reaction: { frames: ['reaction.png'], durations: [100], loop: false }
  }
};
loadCallback(manifest);

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

for (let index = 0; index < 50; index += 1) stateCallback({ state: 'reaction', message: '' });
assert.strictEqual(pet.style.getPropertyValue('--action-scale'), '1', 'repeated reactions must set an absolute scale');
assert.strictEqual(pet.className, 'pet state-reaction', 'repeated reactions must replace state classes, not accumulate them');

stateCallback({ state: 'reaction', message: '爸！', speech: '爸' });
assert.deepStrictEqual(calls.spoken, ['爸'], 'configured speech should be spoken once');

petImage.listeners.get('load')();
windowListeners.get('mousemove')({ clientX: 1, clientY: 1 });
windowListeners.get('mousemove')({ clientX: 80, clientY: 80 });
assert.deepStrictEqual(calls.through.slice(-2), [true, false], 'transparent pixels should pass clicks through, visible pixels should not');

console.log('renderer interaction regression checks passed');
