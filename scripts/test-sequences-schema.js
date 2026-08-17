'use strict';

const assert = require('assert');
const { validateManifest } = require('../src/petpack-validator');

function makeAnimation(action, frameCount, loop = false) {
  const frames = [];
  const durations = [];
  for (let i = 1; i <= frameCount; i += 1) {
    frames.push(`animations/${action}/${String(i).padStart(2, '0')}.png`);
    durations.push(100);
  }
  return { frames, durations, loop, scale: 1 };
}

function baseManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'demo-seq',
    name: 'Demo',
    personality: ['x'],
    preview: 'preview.png',
    animations: {
      idle: makeAnimation('idle', 4, true),
      walk: makeAnimation('walk', 6, true),
      sit: makeAnimation('sit', 4, false),
      sleep: makeAnimation('sleep', 4, true),
      reaction: makeAnimation('reaction', 4, false),
      'relax-a': makeAnimation('relax-a', 1, false),
      'relax-b': makeAnimation('relax-b', 1, false)
    },
    behavior: { random: [{ state: 'walk', weight: 1, minDuration: 1000, maxDuration: 2000 }] },
    sequences: {
      relax: {
        stages: [
          { action: 'relax-a', message: 'hi', duration: 1000 },
          { action: 'relax-b', messages: ['我要这个', '我要这个'], waitForClick: true },
          { action: 'idle', duration: 0 }
        ]
      }
    },
    contextMenuActions: [
      { id: 'relax', label: '去放松', sequence: 'relax' }
    ],
    ...overrides
  };
}

assert.doesNotThrow(() => validateManifest(baseManifest(), '', false));

assert.throws(
  () => validateManifest(baseManifest({
    contextMenuActions: [{ id: 'relax', label: '去放松', action: 'reaction', sequence: 'relax' }]
  }), '', false)
);

assert.throws(
  () => validateManifest(baseManifest({
    contextMenuActions: [{ id: 'relax', label: '去放松', sequence: 'missing' }]
  }), '', false)
);

assert.throws(
  () => validateManifest(baseManifest({
    contextMenuActions: [{ id: 'relax', label: '去放松', sequence: 'relax', message: 'nope' }]
  }), '', false)
);

assert.throws(
  () => validateManifest(baseManifest({
    contextMenuActions: [{ id: 'relax', label: '去放松', sequence: 'relax', duration: 1000 }]
  }), '', false)
);

for (const [field, value] of [
  ['speech', '不支持'],
  ['speechAudio', 'audio/not-supported.mp3']
]) {
  assert.throws(
    () => validateManifest(baseManifest({
      contextMenuActions: [{ id: 'relax', label: '去放松', sequence: 'relax', [field]: value }]
    }), '', false),
    undefined,
    `sequence context menu entries must reject ${field}`
  );
}

assert.throws(
  () => validateManifest(baseManifest({
    sequences: {
      relax: { stages: [{ action: 'relax-a', duration: 1000 }] }
    }
  }), '', false),
  /stages/
);

assert.throws(
  () => validateManifest(baseManifest({
    sequences: {
      relax: {
        stages: [
          { action: 'missing', duration: 1000 },
          { action: 'idle', duration: 0 }
        ]
      }
    }
  }), '', false)
);

assert.doesNotThrow(() => validateManifest(baseManifest({
  contextMenuActions: [{
    id: 'react',
    label: '互动',
    action: 'reaction',
    message: '你好',
    speech: '你好',
    speechAudio: 'audio/hello.mp3'
  }]
}), '', false));

assert.doesNotThrow(() => validateManifest(baseManifest({
  animations: {
    ...baseManifest().animations,
    'feed-a': makeAnimation('feed-a', 4, false),
    'feed-b': makeAnimation('feed-b', 4, false)
  },
  contextMenuActions: [{
    id: 'feed',
    label: '投喂',
    randomActions: [
      { action: 'feed-a', message: '礼物A', duration: 4000 },
      { action: 'feed-b', message: '礼物B', duration: 4500 }
    ]
  }]
}), '', false));

assert.throws(
  () => validateManifest(baseManifest({
    contextMenuActions: [{
      id: 'feed',
      label: '投喂',
      action: 'reaction',
      randomActions: [{ action: 'reaction' }, { action: 'idle' }]
    }]
  }), '', false)
);

assert.throws(
  () => validateManifest(baseManifest({
    contextMenuActions: [{
      id: 'feed',
      label: '投喂',
      randomActions: [{ action: 'reaction' }]
    }]
  }), '', false),
  /2 到 6/
);

assert.doesNotThrow(() => validateManifest(baseManifest({
  contextMenuActions: [{
    id: 'feed',
    label: '投喂',
    randomActions: [
      { sequence: 'relax' },
      { action: 'reaction', message: '礼物', duration: 3000 }
    ]
  }]
}), '', false));

assert.throws(
  () => validateManifest(baseManifest({
    contextMenuActions: [{
      id: 'feed',
      label: '投喂',
      randomActions: [
        { sequence: 'relax', message: 'nope' },
        { action: 'reaction' }
      ]
    }]
  }), '', false)
);

function bossCallManifest(overrides = {}) {
  return baseManifest({
    animations: {
      ...baseManifest().animations,
      'call-climb': makeAnimation('call-climb', 6, false),
      'call-mom-kick': makeAnimation('call-mom-kick', 4, false)
    },
    sequences: {
      'boss-call': {
        contacts: {
          climb: { action: 'call-climb', anchor: { x: 0.08, y: 0.38 } },
          hangup: { action: 'call-mom-kick', anchor: { x: 0.72, y: 0.96 } }
        },
        stages: [
          {
            action: 'call-climb',
            approachTarget: 'incoming-call-edge',
            messages: ['妈妈！'],
            messageLoop: true,
            messageGapMs: 1200,
            timeoutMs: 4000,
            speechAudio: 'audio/call-mom.mp3',
            speechLoop: true,
            speechGender: 'male'
          },
          {
            action: 'call-mom-kick',
            approachTarget: 'incoming-call-reject',
            timeoutMs: 1200,
            speechGender: 'female'
          },
          { action: 'idle', duration: 0, restorePosition: true }
        ]
      }
    },
    contextMenuActions: [
      { id: 'boss-call', label: '演一出来电', sequence: 'boss-call' }
    ],
    ...overrides
  });
}

assert.doesNotThrow(() => validateManifest(bossCallManifest(), '', false));

assert.throws(
  () => validateManifest(bossCallManifest({
    sequences: {
      'boss-call': {
        ...bossCallManifest().sequences['boss-call'],
        stages: [
          { action: 'call-climb', approachTarget: 'window-top', timeoutMs: 4000 },
          { action: 'call-mom-kick', timeoutMs: 1200 },
          { action: 'idle', duration: 0 }
        ]
      }
    }
  }), '', false)
);

assert.throws(
  () => validateManifest(bossCallManifest({
    sequences: {
      'boss-call': {
        ...bossCallManifest().sequences['boss-call'],
        stages: [
          {
            action: 'call-climb',
            approachTarget: 'incoming-call-edge',
            speechGender: 'kid',
            timeoutMs: 4000
          },
          { action: 'call-mom-kick', timeoutMs: 1200 },
          { action: 'idle', duration: 0 }
        ]
      }
    }
  }), '', false)
);

assert.throws(
  () => validateManifest(bossCallManifest({
    sequences: {
      'boss-call': {
        ...bossCallManifest().sequences['boss-call'],
        contacts: {
          climb: { action: 'call-climb', anchor: { x: 0.08, y: 0.38 } },
          hangup: { action: 'missing-kick', anchor: { x: 0.72, y: 0.96 } }
        }
      }
    }
  }), '', false)
);

console.log('test-sequences-schema: ok');
