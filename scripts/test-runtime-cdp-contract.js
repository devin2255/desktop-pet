const assert = require('assert');
const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, 'test-runtime-cdp.ps1'), 'utf8');

for (const required of [
  'interactionActions = $initial.manifest.interactionActions',
  'window.__petDebug?.visibleInsets || null',
  "getComputedStyle(document.getElementById('bubble')).top",
  '({width: innerWidth, height: innerHeight})',
  '[int]$SamplesPerRole = 50',
  'expectedFrameSources',
  'unexpectedResize',
  'unexpectedDisplacement',
  'unexpectedScale',
  'classOrTransformAccumulation'
]) {
  assert.ok(script.includes(required), `runtime CDP script is missing contract text: ${required}`);
}

assert.ok(
  script.includes("[IO.File]::WriteAllText") && script.includes("[Text.UTF8Encoding]::new($false)"),
  'runtime CDP report must support UTF-8 without BOM under Windows PowerShell 5.1'
);
assert.ok(
  script.includes('window.petApi.startDrag({ screenX: 0, screenY: 0 })'),
  'runtime CDP role sampling must enter a real interaction lock before driving renderer roles'
);

for (const role of ['drag', 'climb', 'perch', 'hang', 'fall', 'impact', 'recover']) {
  assert.ok(script.includes(`'${role}'`), `runtime CDP script does not sample role: ${role}`);
}

console.log('runtime CDP contract tests passed');
