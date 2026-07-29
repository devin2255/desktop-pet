'use strict';

const assert = require('assert');
const { createWindowDiscovery } = require('../src/window-discovery');

const dipScreen = {
  screenToDipRect: (_window, rect) => ({
    x: Math.round(rect.x / 2), y: Math.round(rect.y / 2),
    width: Math.round(rect.width / 2), height: Math.round(rect.height / 2)
  }),
  getDisplayMatching: () => ({ scaleFactor: 2 })
};

const metadataById = (entries) => (id) => entries.get(id) || null;

(async () => {
  const discovery = createWindowDiscovery({
    platform: 'win32',
    selfPid: 77,
    logger: { warn: () => {} },
    screen: dipScreen,
    getWindowMetadata: metadataById(new Map([
      [1, { id: 1, ownerPid: 77, visible: true, minimized: false, className: 'PetWindow' }],
      [2, { id: 2, ownerPid: 88, visible: true, minimized: false, className: 'Notepad' }],
      [3, { id: 3, ownerPid: 99, visible: true, minimized: false, className: 'Shell_TrayWnd' }]
    ])),
    loadOpenWindows: async () => async () => [
      { id: 1, owner: { processId: 77, name: 'son-pet' }, bounds: { x: 0, y: 0, width: 200, height: 200 } },
      { id: 2, owner: { processId: 88, name: 'notepad' }, bounds: { x: 200, y: 100, width: 800, height: 600 } },
      { id: 3, owner: { processId: 99, name: 'explorer' }, bounds: { x: 0, y: 1000, width: 1920, height: 80 } }
    ]
  });
  assert.deepStrictEqual(await discovery.list(), [{
    id: '2', ownerPid: 88,
    bounds: { x: 100, y: 50, width: 400, height: 300 },
    visible: true, minimized: false
  }]);
  assert.strictEqual(discovery.available(), true);

  let loaded = false;
  const nonWindows = createWindowDiscovery({
    platform: 'linux', screen: dipScreen,
    loadOpenWindows: async () => { loaded = true; return async () => []; }
  });
  assert.deepStrictEqual(await nonWindows.list(), []);
  assert.strictEqual(nonWindows.available(), false);
  assert.strictEqual(loaded, false);

  const stateFiltered = createWindowDiscovery({
    platform: 'win32', selfPid: 77, screen: dipScreen,
    getWindowMetadata: metadataById(new Map([
      [4, { id: 4, ownerPid: 88, visible: false, minimized: false, className: 'Notepad' }],
      [5, { id: 5, ownerPid: 88, visible: true, minimized: true, className: 'Notepad' }],
      [6, { id: 6, ownerPid: 88, visible: true, minimized: false, className: 'Shell_SecondaryTrayWnd' }],
      [7, { id: 7, ownerPid: 88, visible: true, minimized: false, className: 'Progman' }],
      [8, { id: 8, ownerPid: 88, visible: true, minimized: false, className: 'WorkerW' }]
    ])),
    loadOpenWindows: async () => async () => [4, 5, 6, 7, 8].map((id) => ({
      id, owner: { processId: 88, name: 'ordinary-app' },
      bounds: { x: 0, y: 0, width: 200, height: 200 }
    }))
  });
  assert.deepStrictEqual(await stateFiltered.list(), []);

  const invalidNumerics = createWindowDiscovery({
    platform: 'win32', screen: dipScreen,
    getWindowMetadata: () => ({ id: 9, ownerPid: 88, visible: true, minimized: false, className: 'Notepad' }),
    loadOpenWindows: async () => async () => [
      { id: Number.NaN, owner: { processId: 88 }, bounds: { x: 0, y: 0, width: 100, height: 100 } },
      { id: '9', owner: { processId: '88' }, bounds: { x: 0, y: 0, width: 100, height: 100 } },
      { id: 9, owner: { processId: Number.POSITIVE_INFINITY }, bounds: { x: 0, y: 0, width: 100, height: 100 } },
      { id: 9, owner: { processId: 88 }, bounds: { x: 0, y: 0, width: Number.NaN, height: 100 } }
    ]
  });
  assert.deepStrictEqual(await invalidNumerics.list(), []);

  const invalidMetadata = createWindowDiscovery({
    platform: 'win32', screen: dipScreen,
    getWindowMetadata: () => ({ id: 11, ownerPid: 88, visible: true, minimized: false, className: '' }),
    loadOpenWindows: async () => async () => [
      { id: 11, owner: { processId: 88 }, bounds: { x: 0, y: 0, width: 100, height: 100 } }
    ]
  });
  assert.deepStrictEqual(await invalidMetadata.list(), []);

  let matchedRect;
  const mixedDpi = createWindowDiscovery({
    platform: 'win32', screen: {
      screenToDipRect: (_window, rect) => {
        assert.deepStrictEqual(rect, { x: 2500, y: 200, width: 600, height: 400 });
        return { x: 1500, y: 100, width: 400, height: 300 };
      },
      getDisplayMatching: (rect) => {
        matchedRect = rect;
        return { scaleFactor: 1.5 };
      }
    },
    getWindowMetadata: () => ({ id: 10, ownerPid: 88, visible: true, minimized: false, className: 'Notepad' }),
    loadOpenWindows: async () => async () => [
      { id: 10, owner: { processId: 88 }, bounds: { x: 2500, y: 200, width: 600, height: 400 } }
    ]
  });
  assert.deepStrictEqual(await mixedDpi.list(), [{
    id: '10', ownerPid: 88,
    bounds: { x: 1500, y: 100, width: 400, height: 300 },
    visible: true, minimized: false
  }]);
  assert.deepStrictEqual(matchedRect, { x: 1500, y: 100, width: 400, height: 300 });

  console.log('window discovery checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
