'use strict';
const assert = require('assert');
const {
  MOCK_DELAY_MS,
  MOCK_RESULTS,
  schedulePetTaskMock
} = require('../src/pet-task');

assert.strictEqual(MOCK_DELAY_MS, 2000);
assert.deepStrictEqual(Object.keys(MOCK_RESULTS).sort(), [
  'collect-gossip',
  'summarize-chat',
  'weekly-report'
]);
for (const type of Object.keys(MOCK_RESULTS)) {
  assert.ok(String(MOCK_RESULTS[type]).length > 8, `${type} mock must be a real sentence`);
}
assert.notStrictEqual(MOCK_RESULTS['weekly-report'], MOCK_RESULTS['summarize-chat']);
assert.notStrictEqual(MOCK_RESULTS['summarize-chat'], MOCK_RESULTS['collect-gossip']);

function testScheduleFiresAfterDelayWithMock() {
  const timers = [];
  const results = [];
  schedulePetTaskMock({
    taskType: 'weekly-report',
    onResult: (text) => results.push(text),
    setTimer: (fn, ms) => {
      timers.push({ fn, ms });
      return 1;
    }
  });
  assert.strictEqual(results.length, 0, 'must not return mock immediately');
  assert.strictEqual(timers.length, 1);
  assert.strictEqual(timers[0].ms, 2000);
  timers[0].fn();
  assert.deepStrictEqual(results, [MOCK_RESULTS['weekly-report']]);
}

function testAllThreeTaskTypes() {
  for (const taskType of ['weekly-report', 'summarize-chat', 'collect-gossip']) {
    let result;
    schedulePetTaskMock({
      taskType,
      onResult: (text) => { result = text; },
      setTimer: (fn) => { fn(); return 1; }
    });
    assert.strictEqual(result, MOCK_RESULTS[taskType]);
  }
}

testScheduleFiresAfterDelayWithMock();
testAllThreeTaskTypes();

function testPackWhitelistIncludesPetTask() {
  const fs = require('fs');
  const path = require('path');
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const builder = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-customer.js'), 'utf8');
  const file = 'src/pet-task.js';
  assert.ok(packageJson.build.files.includes(file), `default package includes ${file}`);
  assert.ok(builder.includes(`'${file}'`), `customer package includes ${file}`);
}

testPackWhitelistIncludesPetTask();

function testMainDeclaresPetTaskPollTimerBeforeQuitCleanup() {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main-v3.js'), 'utf8');
  const declare = src.search(/\blet petTaskPollTimer\b/);
  const use = src.search(/\bif \(petTaskPollTimer\)/);
  assert.ok(declare >= 0, 'main must declare petTaskPollTimer so before-quit does not throw ReferenceError');
  assert.ok(use >= 0, 'before-quit must still clear petTaskPollTimer when it exists');
  assert.ok(declare < use, 'declaration must appear before the quit cleanup use');
}

testMainDeclaresPetTaskPollTimerBeforeQuitCleanup();
console.log('test-pet-task: ok');
