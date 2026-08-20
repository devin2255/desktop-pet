'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT_FILE = 'dingtalk-call-uia.ps1';

function defaultLoadScript() {
  return fs.readFileSync(path.join(__dirname, SCRIPT_FILE), 'utf8');
}

function normalizeRect(value) {
  if (!value || typeof value !== 'object') return null;
  const rect = {
    x: Number(value.x),
    y: Number(value.y),
    width: Number(value.width),
    height: Number(value.height)
  };
  if (!['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key]))) return null;
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}

function extractJson(stdout) {
  const text = String(stdout || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function runPowershellFile(scriptPath, env, timeoutMs) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        {
          env: { ...process.env, ...env },
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true
        }
      );
    } catch (error) {
      reject(error);
      return;
    }
    let stdout = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch (_) {}
      reject(new Error('dingtalk-uia-timeout'));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', () => {});
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`dingtalk-uia-exit-${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function createDingtalkUia({
  platform = process.platform,
  loadScript = defaultLoadScript,
  runScriptFile = null, // injectable for tests: (scriptPath, env, timeoutMs) => Promise<string>
  rectToDip = null, // optional (rect) => rect; converts physical px to Electron DIP
  timeoutMs = 8000,
  tmpDir = os.tmpdir(),
  debugLogPath = '' // writable log path; defaults to repo-relative (dev only)
} = {}) {
  let scriptPath = null;
  let scriptBroken = false;

  function ensureScriptFile() {
    if (platform !== 'win32' || scriptBroken) return null;
    if (scriptPath && fs.existsSync(scriptPath)) return scriptPath;
    try {
      const source = loadScript();
      const target = path.join(tmpDir, SCRIPT_FILE);
      fs.writeFileSync(target, source, 'utf8');
      scriptPath = target;
      return scriptPath;
    } catch (_) {
      scriptBroken = true;
      return null;
    }
  }

  async function runMode(mode, extraEnv = {}) {
    if (platform !== 'win32') return null;
    const file = ensureScriptFile();
    if (!file) return null;
    const env = { DINGTALK_UIA_MODE: mode, ...extraEnv };
    const runner = typeof runScriptFile === 'function' ? runScriptFile : runPowershellFile;
    try {
      const stdout = await runner(file, env, timeoutMs);
      return extractJson(stdout);
    } catch (_) {
      return null;
    }
  }

  function debugLog(line) {
    if (process.env.PET_DINGTALK_DEBUG !== '1') return;
    try {
      const target = debugLogPath || path.join(__dirname, '..', 'dingtalk-uia-debug.log');
      fs.appendFileSync(target, `${new Date().toISOString()} ${line}\n`);
    } catch (_) { /* best effort */ }
  }

  function applyDip(rect) {
    if (!rect) return null;
    if (typeof rectToDip !== 'function') return rect;
    try {
      const converted = rectToDip(rect);
      const ok = normalizeRect(converted);
      debugLog(`applyDip raw=${JSON.stringify(rect)} converted=${JSON.stringify(ok)}`);
      return ok || rect;
    } catch (error) {
      debugLog(`applyDip threw: ${error.message}`);
      return rect;
    }
  }

  async function locateIncomingCall() {
    const data = await runMode('locate');
    if (!data || data.found !== true) return null;
    debugLog(`locate raw=${JSON.stringify({ windowBounds: data.windowBounds, rejectBounds: data.rejectBounds, displayName: data.displayName })}`);
    const windowBounds = applyDip(normalizeRect(data.windowBounds));
    if (!windowBounds) return null;
    return {
      title: String(data.title || ''),
      displayName: String(data.displayName || ''),
      windowBounds,
      rejectBounds: applyDip(normalizeRect(data.rejectBounds)),
      hwnd: Number.isFinite(Number(data.hwnd)) ? Number(data.hwnd) : 0,
      raw: data
    };
  }

  async function invokeReject() {
    const data = await runMode('invoke');
    return Boolean(data && data.ok === true);
  }

  return { locateIncomingCall, invokeReject };
}

module.exports = { createDingtalkUia, extractJson, normalizeRect };
