const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskChat', {
  submit: (text) => ipcRenderer.invoke('task-chat:submit', text),
  close: () => ipcRenderer.send('task-chat:close')
});
