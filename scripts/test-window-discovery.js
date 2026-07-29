'use strict';

const assert = require('assert');
const { createWindowDiscovery } = require('../src/window-discovery');

(async () => {
  const discovery = createWindowDiscovery({
    selfPid: 77,
    logger: { warn: () => {} },
    screen: { getDisplayMatching: () => ({ scaleFactor: 2 }) },
    loadOpenWindows: async () => async () => [
      { id: 1, owner: { processId: 77, name: 'son-pet' }, bounds: { x: 0, y: 0, width: 200, height: 200 } },
      { id: 2, owner: { processId: 88, name: 'notepad' }, bounds: { x: 200, y: 100, width: 800, height: 600 } },
      { id: 3, owner: { processId: 99, name: 'Shell_TrayWnd' }, bounds: { x: 0, y: 1000, width: 1920, height: 80 } }
    ]
  });
  assert.deepStrictEqual(await discovery.list(), [{
    id: '2', ownerPid: 88,
    bounds: { x: 100, y: 50, width: 400, height: 300 },
    visible: true, minimized: false
  }]);
  assert.strictEqual(discovery.available(), true);
  console.log('window discovery checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
