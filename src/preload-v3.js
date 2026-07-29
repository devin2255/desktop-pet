const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petApi', {
  getCurrentPet: () => ipcRenderer.invoke('pet:get-current'),
  importPet: () => ipcRenderer.invoke('pet:import'),
  onLoad: (callback) => ipcRenderer.on('pet:load', (_event, payload) => callback(payload)),
  onState: (callback) => ipcRenderer.on('pet:state', (_event, payload) => callback(payload)),
  startDrag: (position) => ipcRenderer.send('pet:drag-start', position),
  drag: (position) => ipcRenderer.send('pet:drag-move', position),
  endDrag: () => ipcRenderer.send('pet:drag-end'),
  interact: () => ipcRenderer.send('pet:interact'),
  setMouseThrough: (ignore) => ipcRenderer.send('pet:set-mouse-through', Boolean(ignore)),
  setVisibleInsets: (insets) => ipcRenderer.send('pet:visible-insets', insets),
  openMenu: () => ipcRenderer.send('pet:context-menu')
});
