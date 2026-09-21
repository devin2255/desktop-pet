'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload-v3.js'), 'utf8');
const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer-v3.js'), 'utf8');

assert.match(preload, /duoPointerDown/);
assert.match(preload, /duoPointerMove/);
assert.match(preload, /duoPointerUp/);
assert.match(preload, /slackExit/);
assert.match(preload, /pet:duo-pointer-down/);
assert.match(preload, /pet:slack-exit/);
assert.match(renderer, /event\.button !== 2/);
assert.match(renderer, /preventDefault\(\)/);
assert.match(renderer, /duoPointerDown/);
assert.match(renderer, /openMenu/);
assert.match(renderer, /--duo-open/);
assert.match(renderer, /--duo-frost/);
assert.match(renderer, /dataset\.side/);
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index-v3.html'), 'utf8');
assert.match(html, /duo-device/);
assert.match(html, /duo-device-hinge/);
assert.match(html, /duo-device-home/);
assert.match(html, /duo-clock/);
assert.match(html, /duo-clock-time/);
assert.match(html, /duo-clock-sec/);
assert.match(html, /duo-clock-date[\s\S]*duo-clock-time/s);
assert.match(html, /duo-slack-board/);
assert.match(html, /duo-slack-quotes/);
assert.match(html, /duo-slack-kline/);
assert.match(html, /duo-slack-feed/);
assert.match(html, /duo-slack-video/);
assert.match(html, /duo-slack-video-next/);
assert.match(html, /duo-intro-left/);
assert.match(html, /duo-intro-right/);
assert.doesNotMatch(html, /douyin\.com/);
assert.doesNotMatch(html, /duo-device-leaf-right">\s*<div class="duo-clock"/);
const styles = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles-v3.css'), 'utf8');
assert.doesNotMatch(styles, /linear-gradient/);
assert.match(styles, /\[data-phase="unfolding"\]\[data-direction="right"\] \.duo-device-leaf-right/);
assert.match(styles, /\[data-phase="unfolding"\]\[data-direction="left"\] \.duo-device-leaf-left/);
assert.match(styles, /\[data-phase="folding"\] \.duo-device-bezel/);
assert.match(styles, /\[data-phase="folding"\] \.duo-device-home/);
assert.match(styles, /\[data-phase="unfolding"\] \.duo-device-bezel/);
assert.match(styles, /\[data-phase="unfolding"\] \.duo-device-home/);
assert.match(styles, /aspect-ratio: 4 \/ 3/);
assert.match(styles, /\[data-phase="tent"\]/);
assert.match(styles, /\[data-phase="tent"\] \.duo-clock/);
assert.match(styles, /\[data-phase="tent"\] \.duo-device-pill/);
assert.match(styles, /\[data-phase="slack"\]/);
assert.match(styles, /--palm-from-bottom/);
assert.match(styles, /\[data-phase="slack"\][\s\S]{0,360}width:\s*88%/);
assert.match(styles, /\[data-phase="slack"\][\s\S]{0,520}aspect-ratio:\s*4\s*\/\s*3/);
assert.doesNotMatch(styles, /\[data-phase="slack"\][\s\S]{0,900}aspect-ratio:\s*3\s*\/\s*4/);
assert.match(styles, /\[data-phase="slack"\][\s\S]{0,720}\.duo-device-leaf[\s\S]{0,200}height:\s*100%/);
assert.match(styles, /\[data-phase="slack"\][\s\S]{0,480}\.duo-device-bezel[\s\S]{0,80}border-width:\s*4px/);
assert.match(styles, /\[data-phase="slack"\][\s\S]{0,900}\.duo-device-home[\s\S]{0,80}display:\s*block/);
assert.match(styles, /\[data-phase="slack"\][\s\S]{0,1100}\.duo-device-island[\s\S]{0,80}display:\s*block/);
assert.match(html, /duo-device-island/);
assert.doesNotMatch(styles, /\[data-phase="slack"\][\s\S]{0,360}max-height:\s*calc\(100% - 96px\)/);
assert.match(styles, /duo-slack-board\[hidden\][\s\S]{0,80}display:\s*none/);
assert.match(styles, /duo-slack-board:not\(\[hidden\]\)[\s\S]{0,80}display:\s*flex/);
assert.match(styles, /data-slack-stage="jump"[\s\S]{0,280}background:\s*transparent/);
assert.match(styles, /\[data-slack-stage="jump"\][\s\S]{0,520}\.duo-device-screen[\s\S]{0,80}background:\s*transparent/);
assert.match(styles, /\[data-slack-stage="jump"\][\s\S]{0,640}\.duo-slack-board[\s\S]{0,240}display:\s*none/);
assert.match(styles, /\[data-slack-stage="jump"\][\s\S]{0,800}\.duo-slack-feed[\s\S]{0,200}display:\s*none/);
assert.match(styles, /container-type:\s*size/);
assert.match(styles, /--sprite/);
assert.doesNotMatch(styles, /data-slack-stage="carry"[\s\S]{0,900}\.duo-device-bezel[\s\S]{0,200}display:\s*none/);
assert.match(styles, /\[data-phase="slack"\] \.duo-device-leaf-left[\s\S]{0,120}transform:\s*none/);
assert.doesNotMatch(styles, /data-slack-stage="carry"[\s\S]{0,280}left:\s*2[0-4]%/);
assert.doesNotMatch(renderer, /等老板转身/);
assert.match(styles, /--duo-open:\s*1/);
assert.match(styles, /transform-origin: 100% 50%/);
assert.match(styles, /transform-origin: 0 50%/);
assert.match(renderer, /formatTentClock/);
assert.match(renderer, /getSeconds\(\)/);
assert.match(renderer, /hoursMinutes/);
assert.match(renderer, /phase === 'tent'/);
assert.match(renderer, /startAtLast/);
assert.match(renderer, /drawSlackKline/);
assert.match(renderer, /slackStage/);
assert.match(renderer, /slackExit/);
assert.match(renderer, /preloadUpcomingIfNeeded/);
assert.match(renderer, /beginSlackSlide/);
assert.match(renderer, /upcomingSlackIndex/);
assert.match(renderer, /preloadUpcomingIfNeeded\(\)/);
assert.doesNotMatch(renderer, /duration - time <= 1\.25/);
assert.doesNotMatch(renderer, /duration - time <= 0\.12/);
assert.doesNotMatch(renderer, /onSlackWaiting/);
assert.doesNotMatch(renderer, /addEventListener\('waiting'/);
assert.doesNotMatch(renderer, /slackStallTimer/);
assert.doesNotMatch(renderer, /clearSlackStallWatch/);
assert.match(styles, /translateY\(-100%\)/);
assert.match(styles, /is-sliding/);

let exposedApi;
const sent = [];
vm.runInNewContext(preload, {
  require: (name) => {
    if (name === 'electron') {
      return {
        contextBridge: {
          exposeInMainWorld: (name, api) => {
            assert.strictEqual(name, 'petApi');
            exposedApi = api;
          }
        },
        ipcRenderer: {
          invoke: () => {},
          on: () => {},
          send: (...args) => sent.push(args)
        }
      };
    }
    return require(name);
  }
}, { filename: path.join(__dirname, '..', 'src', 'preload-v3.js') });

function assertGuardedDuoPointer(method, channel) {
  const beforeInvalid = sent.length;
  for (const payload of [
    null,
    undefined,
    {},
    { screenX: 1, screenY: 2, dx: 0 },
    { screenX: 1, screenY: 2, dx: 0, dy: Infinity },
    { screenX: 1, screenY: 2, dx: NaN, dy: 0 },
    { screenX: '1', screenY: 2, dx: 0, dy: 0 }
  ]) {
    exposedApi[method](payload);
  }
  assert.strictEqual(sent.length, beforeInvalid, `${method} must ignore invalid payloads`);

  const payload = { screenX: 1, screenY: 2, dx: 3, dy: 4 };
  exposedApi[method](payload);
  assert.deepStrictEqual(sent.at(-1), [channel, payload], `${method} must send valid finite payload`);
}

assertGuardedDuoPointer('duoPointerDown', 'pet:duo-pointer-down');
assertGuardedDuoPointer('duoPointerMove', 'pet:duo-pointer-move');
assertGuardedDuoPointer('duoPointerUp', 'pet:duo-pointer-up');
exposedApi.duoPointerCancel({ screenX: Infinity });
assert.deepStrictEqual(sent.at(-1), ['pet:duo-pointer-cancel'], 'duoPointerCancel keeps no payload');

console.log('test-duo-renderer-contract: ok');
