const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', { exportFile: payload => ipcRenderer.invoke('export-file', payload) });
