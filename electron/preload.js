'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('anivault', {
  readConfig: () => ipcRenderer.invoke('config:read'),
  validateConfig: (cfg) => ipcRenderer.invoke('config:validate', cfg),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),
});
