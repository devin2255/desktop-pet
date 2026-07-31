'use strict';

const SYSTEM_WINDOW_CLASSES = new Set([
  'shell_traywnd', 'shell_secondarytraywnd', 'progman', 'workerw'
]);

function isValidWindowId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isValidPid(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isValidBounds(bounds) {
  return bounds && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bounds[key]))
    && bounds.width > 0 && bounds.height > 0;
}

function createWin32MetadataProvider({
  platform = process.platform,
  loadKoffi = () => require('koffi')
} = {}) {
  let api;

  function loadApi() {
    if (api) return api;
    const koffi = loadKoffi();
    const user32 = koffi.load('user32.dll');
    api = {
      koffi,
      isWindow: user32.func('int __stdcall IsWindow(uintptr_t hWnd)'),
      isWindowVisible: user32.func('int __stdcall IsWindowVisible(uintptr_t hWnd)'),
      isIconic: user32.func('int __stdcall IsIconic(uintptr_t hWnd)'),
      getClassName: user32.func('int __stdcall GetClassNameW(uintptr_t hWnd, _Out_ char16_t *lpClassName, int nMaxCount)'),
      getWindowThreadProcessId: user32.func('uint32_t __stdcall GetWindowThreadProcessId(uintptr_t hWnd, _Out_ uint32_t *lpdwProcessId)')
    };
    return api;
  }

  return (windowId) => {
    if (platform !== 'win32' || !isValidWindowId(windowId)) return null;
    const win32 = loadApi();
    if (!win32.isWindow(windowId)) return null;

    const processId = [0];
    if (!win32.getWindowThreadProcessId(windowId, processId) || !isValidPid(processId[0])) return null;

    const classBuffer = Buffer.alloc(512 * 2);
    const classLength = win32.getClassName(windowId, classBuffer, 512);
    if (!Number.isInteger(classLength) || classLength <= 0 || classLength >= 512) return null;

    return {
      id: windowId,
      ownerPid: processId[0],
      visible: Boolean(win32.isWindowVisible(windowId)),
      minimized: Boolean(win32.isIconic(windowId)),
      className: win32.koffi.decode(classBuffer, 'char16_t', classLength)
    };
  };
}

function createWindowDiscovery({
  loadOpenWindows = async () => (await import('get-windows')).openWindows,
  getWindowMetadata = createWin32MetadataProvider(),
  screen,
  selfPid = process.pid,
  platform = process.platform,
  logger = console
}) {
  let openWindows;
  let enabled = platform === 'win32';

  async function list() {
    if (!enabled) return [];

    try {
      openWindows ||= await loadOpenWindows();
      const records = await openWindows();
      return records.flatMap((item) => {
        const windowId = item?.id;
        const title = String(item?.title || '').trim();
        const listedPid = item?.owner?.processId;
        const nativeBounds = item?.bounds;
        if (!title || !isValidWindowId(windowId) || !isValidPid(listedPid)
          || !isValidBounds(nativeBounds)) return [];

        const metadata = getWindowMetadata(windowId);
        if (!metadata || metadata.id !== windowId || !isValidPid(metadata.ownerPid)
          || metadata.ownerPid !== listedPid || typeof metadata.visible !== 'boolean'
          || typeof metadata.minimized !== 'boolean' || !metadata.className) return [];

        const className = String(metadata.className || '').toLowerCase();
        if (metadata.ownerPid === selfPid || !metadata.visible || metadata.minimized
          || SYSTEM_WINDOW_CLASSES.has(className)) return [];

        const dipBounds = screen.screenToDipRect(null, nativeBounds);
        if (!isValidBounds(dipBounds)) return [];
        screen.getDisplayMatching(dipBounds);

        return [{
          id: String(windowId),
          ownerPid: metadata.ownerPid,
          bounds: {
            x: Math.round(dipBounds.x),
            y: Math.round(dipBounds.y),
            width: Math.round(dipBounds.width),
            height: Math.round(dipBounds.height)
          },
          visible: metadata.visible,
          minimized: metadata.minimized
        }];
      });
    } catch (error) {
      enabled = false;
      logger.warn(`Window discovery disabled: ${error.message}`);
      return [];
    }
  }

  return { list, available: () => enabled };
}

module.exports = { createWindowDiscovery, createWin32MetadataProvider };
