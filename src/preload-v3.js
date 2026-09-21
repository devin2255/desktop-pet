const { contextBridge, ipcRenderer } = require('electron');

function isDuoPointerPayload(payload) {
  return payload && typeof payload === 'object'
    && Number.isFinite(payload.screenX)
    && Number.isFinite(payload.screenY)
    && Number.isFinite(payload.dx)
    && Number.isFinite(payload.dy);
}

contextBridge.exposeInMainWorld('petApi', {
  getCurrentPet: () => ipcRenderer.invoke('pet:get-current'),
  importPet: () => ipcRenderer.invoke('pet:import'),
  onLoad: (callback) => ipcRenderer.on('pet:load', (_event, payload) => callback(payload)),
  onState: (callback) => ipcRenderer.on('pet:state', (_event, payload) => callback(payload)),
  onMarket: (callback) => ipcRenderer.on('pet:market', (_event, payload) => callback(payload)),
  onDuoOverlay: (callback) => ipcRenderer.on('pet:duo-overlay', (_event, payload) => callback(payload)),
  startDrag: (position) => ipcRenderer.send('pet:drag-start', position),
  drag: (position) => ipcRenderer.send('pet:drag-move', position),
  endDrag: (position) => ipcRenderer.send('pet:drag-end', position),
  duoPointerDown: (payload) => {
    if (isDuoPointerPayload(payload)) ipcRenderer.send('pet:duo-pointer-down', payload);
  },
  duoPointerMove: (payload) => {
    if (isDuoPointerPayload(payload)) ipcRenderer.send('pet:duo-pointer-move', payload);
  },
  duoPointerUp: (payload) => {
    if (isDuoPointerPayload(payload)) ipcRenderer.send('pet:duo-pointer-up', payload);
  },
  duoPointerCancel: () => ipcRenderer.send('pet:duo-pointer-cancel'),
  interact: () => ipcRenderer.send('pet:interact'),
  setMouseThrough: (ignore) => ipcRenderer.send('pet:set-mouse-through', Boolean(ignore)),
  setVisibleInsets: (insets) => ipcRenderer.send('pet:visible-insets', insets),
  slackExit: () => ipcRenderer.send('pet:slack-exit'),
  openMenu: () => ipcRenderer.send('pet:context-menu')
});
