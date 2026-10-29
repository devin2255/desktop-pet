const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('calendarApi', {
  get: () => ipcRenderer.invoke('calendar:get'),
  select: (momentId) => ipcRenderer.invoke('calendar:select', momentId),
  onUpdate: (callback) => ipcRenderer.on('calendar:update', (_event, payload) => callback(payload))
});
