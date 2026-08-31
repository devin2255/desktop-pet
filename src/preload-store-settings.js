'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('storeSettings', {
  get: () => ipcRenderer.invoke('store-settings:get'),
  save: (payload) => ipcRenderer.invoke('store-settings:save', payload)
});
