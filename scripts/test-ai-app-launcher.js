'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  AI_APP_IDS,
  bestAppId,
  readLnkLocalPath,
  resolveLaunchApps
} = require('../src/ai-app-catalog');
const { nextInteractLine, normalizeInteractLines, gateInteract } = require('../src/interact-lines');
const { buildQwenTaskUrl, normalizeTaskText, taskAck } = require('../src/task-chat');
const { validateManifest } = require('../src/petpack-validator');

function buildLnk(target) {
  const pathBytes = Buffer.from(`${target}\0`, 'latin1');
  const header = Buffer.alloc(76);
  header.writeUInt32LE(76, 0);
  header.writeUInt32LE(0x2, 0x14);
  const volume = Buffer.alloc(16);
  volume.writeUInt32LE(16, 0);
  volume.writeUInt32LE(3, 4);
  volume.writeUInt32LE(16, 12);
  const volumeOffset = 0x1c;
  const localOffset = volumeOffset + volume.length;
  const suffixOffset = localOffset + pathBytes.length;
  const info = Buffer.alloc(suffixOffset + 1);
  info.writeUInt32LE(info.length, 0);
  info.writeUInt32LE(0x1c, 4);
  info.writeUInt32LE(1, 8);
  info.writeUInt32LE(volumeOffset, 12);
  info.writeUInt32LE(localOffset, 16);
  info.writeUInt32LE(suffixOffset, 24);
  volume.copy(info, volumeOffset);
  pathBytes.copy(info, localOffset);
  return Buffer.concat([header, info]);
}

assert.strictEqual(
  readLnkLocalPath(buildLnk('D:\\software\\QwenWorkCN\\Launcher.exe')),
  'D:\\software\\QwenWorkCN\\Launcher.exe'
);
assert.strictEqual(readLnkLocalPath(Buffer.alloc(10)), '');

const work = { name: '千问办公', target: 'D:\\software\\QwenWorkCN\\Launcher.exe' };
const chat = { name: '千问', target: 'E:\\software\\QianwenApp\\qianwen.exe' };
assert.strictEqual(bestAppId(work), 'qwen-work');
assert.strictEqual(bestAppId(chat), 'qwen');

const installed = new Set([work.target]);
const resolved = resolveLaunchApps(
  ['qwen-work', 'qwen', 'not-an-app', 'qwen-work', 'doubao'],
  [work, chat],
  (target) => installed.has(target)
);
assert.deepStrictEqual(resolved.map((item) => item.id), ['qwen-work', 'qwen', 'doubao']);
assert.strictEqual(resolved[0].kind, 'path');
assert.strictEqual(resolved[0].target, work.target);
assert.strictEqual(resolved[1].kind, 'url');
assert.strictEqual(resolved[2].kind, 'url');
assert.ok(resolved[2].target.startsWith('https://'));
assert.strictEqual(resolveLaunchApps('qwen-work', [], () => false).length, 0);

const lines = normalizeInteractLines({
  lines: ['别戳啦，再戳我记账了。', { message: '摸鱼被我看见了。', speech: '看见了。' }, '   ']
});
assert.strictEqual(lines.length, 2);
let cursor = 0;
const first = nextInteractLine(lines, cursor);
cursor = first.cursor;
const second = nextInteractLine(lines, cursor);
cursor = second.cursor;
const third = nextInteractLine(lines, cursor);
assert.strictEqual(first.line.message, '别戳啦，再戳我记账了。');
assert.strictEqual(second.line.speech, '看见了。');
assert.strictEqual(third.line.message, first.line.message);
assert.strictEqual(nextInteractLine([], 3).line, null);

const fixture = path.join(__dirname, '..', 'pets', 'packages', 'laopo.petpack');
const AdmZip = require('adm-zip');
const manifest = JSON.parse(new AdmZip(fixture).readAsText('pet.json'));
manifest.launchApps = ['qwen-work', 'doubao'];
manifest.interact = { lines: ['今天的桌面我看着。', '喊我回来就好。'] };
assert.doesNotThrow(() => validateManifest(manifest));
manifest.launchApps.push('cmd');
assert.throws(() => validateManifest(manifest), /launchApps/);
manifest.launchApps = ['qwen'];
manifest.interact.lines = [];
assert.throws(() => validateManifest(manifest), /interact\.lines/);
manifest.interact.lines = ['x'.repeat(81)];
assert.throws(() => validateManifest(manifest), /interact\.lines/);

const python = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'desktop-pet-maker', 'scripts', 'petpack_tool.py'),
  'utf8'
);
for (const id of AI_APP_IDS) assert.match(python, new RegExp(`"${id}"`));

const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main-v3.js'), 'utf8');
assert.match(main, /resolveLaunchApps/);
assert.match(main, /nextInteractLine/);
assert.match(main, /唤起 AI/);
assert.match(main, /交代任务/);
assert.match(main, /if \(result\?\.ok\) \{[\s\S]*?win\.close\(\)/);
assert.match(main, /shell: false/);
assert.match(main, /shell\.openPath/);
assert.strictEqual(normalizeTaskText('  整理\n会议  '), '整理 会议');
assert.strictEqual(normalizeTaskText('x'.repeat(240)).length, 200);
assert.strictEqual(normalizeTaskText(12), '');
const taskUrl = buildQwenTaskUrl('帮我列三条');
assert.ok(taskUrl.startsWith('https://www.qianwen.com/?q='));
assert.ok(taskUrl.includes(encodeURIComponent('帮我列三条')));
assert.strictEqual(buildQwenTaskUrl('   '), '');
const firstClick = gateInteract({ now: 1000, lockedUntil: 0, priorityUntil: 0 });
assert.strictEqual(firstClick.allow, true);
const repeatClick = gateInteract({ now: 1200, lockedUntil: firstClick.lockedUntil, priorityUntil: 0 });
assert.strictEqual(repeatClick.allow, false);
assert.strictEqual(repeatClick.reason, 'repeat');
const afterLock = gateInteract({ now: firstClick.lockedUntil, lockedUntil: firstClick.lockedUntil, priorityUntil: 5000 });
assert.strictEqual(afterLock.allow, false);
assert.strictEqual(afterLock.reason, 'priority');
assert.strictEqual(taskAck('改口语').message, '交给千问：改口语');
assert.strictEqual(taskAck('这是一段很长的任务，气泡里只念短的那句交给千问了').speech, '交给千问了。');

console.log('ai app launcher checks passed');
