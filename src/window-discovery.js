'use strict';

const SYSTEM_OWNERS = new Set(['explorer', 'shell_traywnd', 'progman', 'workerw']);

function createWindowDiscovery({
  loadOpenWindows = async () => (await import('get-windows')).openWindows,
  screen, selfPid = process.pid, logger = console
}) {
  let openWindows;
  let enabled = true;

  async function list() {
    if (!enabled) return [];

    try {
      openWindows ||= await loadOpenWindows();
      const records = await openWindows();
      return records.flatMap((item) => {
        const ownerPid = Number(item.owner?.processId);
        const ownerName = String(item.owner?.name || '').toLowerCase();
        const bounds = item.bounds;
        if (ownerPid === selfPid || SYSTEM_OWNERS.has(ownerName)
          || !bounds || bounds.width <= 0 || bounds.height <= 0) return [];

        const scaleFactor = screen.getDisplayMatching(bounds).scaleFactor || 1;
        return [{
          id: String(item.id),
          ownerPid,
          bounds: {
            x: Math.round(bounds.x / scaleFactor),
            y: Math.round(bounds.y / scaleFactor),
            width: Math.round(bounds.width / scaleFactor),
            height: Math.round(bounds.height / scaleFactor)
          },
          visible: true,
          minimized: false
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

module.exports = { createWindowDiscovery };
