'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDingtalkUia, extractJson, normalizeRect } = require('../src/dingtalk-uia');

function tmpScriptDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dingtalk-uia-test-'));
}

function foundPayload(overrides = {}) {
  return JSON.stringify({
    found: true,
    hwnd: 12345,
    title: '张总邀请你语音通话',
    displayName: '张总',
    windowBounds: { x: 2000, y: 200, width: 560, height: 320 },
    rejectBounds: { x: 2400, y: 400, width: 160, height: 80 },
    ...overrides
  });
}

async function testExtractJsonHandlesCleanAndNoisyOutput() {
  assert.deepStrictEqual(extractJson('{"found":false}'), { found: false });
  assert.deepStrictEqual(
    extractJson('WARNING: something\n{"found":true,"title":"x"}\n'),
    { found: true, title: 'x' }
  );
  assert.strictEqual(extractJson(''), null);
  assert.strictEqual(extractJson('not json at all'), null);
  assert.strictEqual(extractJson(null), null);
}

async function testNormalizeRectRejectsBadShapes() {
  assert.strictEqual(normalizeRect(null), null);
  assert.strictEqual(normalizeRect({ x: 0, y: 0, width: 0, height: 10 }), null);
  assert.strictEqual(normalizeRect({ x: 0, y: 0, width: 10, height: NaN }), null);
  assert.deepStrictEqual(
    normalizeRect({ x: '5', y: 6, width: '10', height: 12 }),
    { x: 5, y: 6, width: 10, height: 12 }
  );
}

async function testLocateParsesFoundAndConvertsToDip() {
  const dipCalls = [];
  const uia = createDingtalkUia({
    platform: 'win32',
    loadScript: () => '# fake',
    tmpDir: tmpScriptDir(),
    rectToDip: (rect) => {
      dipCalls.push(rect);
      return { x: rect.x / 2, y: rect.y / 2, width: rect.width / 2, height: rect.height / 2 };
    },
    runScriptFile: async (scriptPath, env) => {
      assert.strictEqual(env.DINGTALK_UIA_MODE, 'locate');
      return foundPayload();
    }
  });
  const located = await uia.locateIncomingCall();
  assert.ok(located, 'found:true 应返回 located 对象');
  assert.strictEqual(located.displayName, '张总');
  assert.strictEqual(located.title, '张总邀请你语音通话');
  assert.deepStrictEqual(located.windowBounds, { x: 1000, y: 100, width: 280, height: 160 });
  assert.deepStrictEqual(located.rejectBounds, { x: 1200, y: 200, width: 80, height: 40 });
  assert.strictEqual(located.hwnd, 12345);
  assert.strictEqual(dipCalls.length, 2, '窗口矩形与挂断键矩形都要转 DIP');
}

async function testLocateReturnsNullWhenNotFound() {
  const uia = createDingtalkUia({
    platform: 'win32',
    loadScript: () => '# fake',
    tmpDir: tmpScriptDir(),
    runScriptFile: async () => JSON.stringify({ found: false })
  });
  assert.strictEqual(await uia.locateIncomingCall(), null);
}

async function testLocateReturnsNullWhenPowerShellFails() {
  const uia = createDingtalkUia({
    platform: 'win32',
    loadScript: () => '# fake',
    tmpDir: tmpScriptDir(),
    runScriptFile: async () => { throw new Error('dingtalk-uia-timeout'); }
  });
  assert.strictEqual(await uia.locateIncomingCall(), null);
}

async function testLocateReturnsNullWhenWindowBoundsInvalid() {
  const uia = createDingtalkUia({
    platform: 'win32',
    loadScript: () => '# fake',
    tmpDir: tmpScriptDir(),
    runScriptFile: async () => foundPayload({ windowBounds: { x: 0, y: 0, width: 0, height: 0 } })
  });
  assert.strictEqual(await uia.locateIncomingCall(), null);
}

async function testLocateKeepsPhysicalRectsWithoutDipConverter() {
  const uia = createDingtalkUia({
    platform: 'win32',
    loadScript: () => '# fake',
    tmpDir: tmpScriptDir(),
    runScriptFile: async () => foundPayload()
  });
  const located = await uia.locateIncomingCall();
  assert.deepStrictEqual(located.windowBounds, { x: 2000, y: 200, width: 560, height: 320 });
  assert.deepStrictEqual(located.rejectBounds, { x: 2400, y: 400, width: 160, height: 80 });
}

async function testInvokeRejectReflectsOkFlag() {
  let next = JSON.stringify({ ok: true, method: 'invoke-pattern' });
  const uia = createDingtalkUia({
    platform: 'win32',
    loadScript: () => '# fake',
    tmpDir: tmpScriptDir(),
    runScriptFile: async (scriptPath, env) => {
      assert.strictEqual(env.DINGTALK_UIA_MODE, 'invoke');
      return next;
    }
  });
  assert.strictEqual(await uia.invokeReject(), true);
  next = JSON.stringify({ ok: false, reason: 'call-window-gone' });
  assert.strictEqual(await uia.invokeReject(), false);
  next = 'garbage';
  assert.strictEqual(await uia.invokeReject(), false);
}

async function testNonWindowsPlatformIsNoop() {
  let called = 0;
  const uia = createDingtalkUia({
    platform: 'linux',
    loadScript: () => '# fake',
    tmpDir: tmpScriptDir(),
    runScriptFile: async () => { called += 1; return foundPayload(); }
  });
  assert.strictEqual(await uia.locateIncomingCall(), null);
  assert.strictEqual(await uia.invokeReject(), false);
  assert.strictEqual(called, 0, '非 Windows 不应触发 PowerShell');
}

async function testPackWhitelistIncludesUiaBridge() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const builder = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-customer.js'), 'utf8');
  for (const file of ['src/dingtalk-uia.js', 'src/dingtalk-call-uia.ps1']) {
    assert.ok(packageJson.build.files.includes(file), `default package includes ${file}`);
    assert.ok(builder.includes(`'${file}'`), `customer package includes ${file}`);
  }
}

async function testShippedScriptExistsAndDeclaresModes() {
  const scriptPath = path.join(__dirname, '..', 'src', 'dingtalk-call-uia.ps1');
  const script = fs.readFileSync(scriptPath, 'utf8');
  for (const token of ["$env:DINGTALK_UIA_MODE", "'locate'", "'invoke'", "'dump'", 'ConvertTo-Json']) {
    assert.ok(script.includes(token), `PS script should reference ${token}`);
  }
}

const tasks = [
  testExtractJsonHandlesCleanAndNoisyOutput,
  testNormalizeRectRejectsBadShapes,
  testLocateParsesFoundAndConvertsToDip,
  testLocateReturnsNullWhenNotFound,
  testLocateReturnsNullWhenPowerShellFails,
  testLocateReturnsNullWhenWindowBoundsInvalid,
  testLocateKeepsPhysicalRectsWithoutDipConverter,
  testInvokeRejectReflectsOkFlag,
  testNonWindowsPlatformIsNoop,
  testPackWhitelistIncludesUiaBridge,
  testShippedScriptExistsAndDeclaresModes
];

(async () => {
  for (const task of tasks) {
    await task();
  }
  console.log('dingtalk-uia: all tests passed');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
