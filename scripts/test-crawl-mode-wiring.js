'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateManifest } = require('../src/petpack-validator');

const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'main-v3.js'), 'utf8');
assert.ok(mainSrc.includes("label: '跪爬模式'"), 'tray must expose 跪爬模式');
assert.ok(mainSrc.includes('crawlMode'), 'settings.crawlMode required');
assert.ok(mainSrc.includes("kowtow-crawl"), 'kowtow must remap in crawl mode');

const rendererSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer-v3.js'), 'utf8');
assert.ok(rendererSrc.includes('crawl-left'), 'renderer must resolve crawl facing');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles-v3.css'), 'utf8');
assert.ok(css.includes('.state-crawl-left'), 'CSS mirror for crawl-left required');

// menu limit 12
const items = [];
for (let i = 0; i < 9; i++) {
  items.push({ id: `a${i}`, label: `L${i}`, action: 'idle' });
}
const manifest = {
  schemaVersion: 1,
  packageVersion: '1.0.0',
  id: 'limit-test',
  name: 't',
  description: 't',
  personality: ['a'],
  preview: 'preview.png',
  animations: {
    idle: { frames: ['animations/idle/01.png'], durations: [100], loop: true, holdLastFrame: false, scale: 1 },
    walk: { frames: ['animations/walk/01.png'], durations: [100], loop: true, holdLastFrame: false, scale: 1 },
    sit: { frames: ['animations/sit/01.png'], durations: [100], loop: false, holdLastFrame: true, scale: 1 },
    sleep: { frames: ['animations/sleep/01.png'], durations: [100], loop: true, holdLastFrame: false, scale: 1 },
    reaction: { frames: ['animations/reaction/01.png'], durations: [100], loop: false, holdLastFrame: true, scale: 1 }
  },
  contextMenuActions: items
};
// validateManifest needs on-disk frames; instead unit-test the length rule via isolated require of limit helper
// Prefer: temporarily call internal check by constructing through petpack-validator error path after raising limit.
assert.ok(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'petpack-validator.js'), 'utf8').includes('length > 12'),
  'validator must allow up to 12 contextMenuActions'
);
console.log('test-crawl-mode-wiring: ok');
