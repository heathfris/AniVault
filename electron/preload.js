'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('anivault', {
  readConfig: () => ipcRenderer.invoke('config:read'),
  validateConfig: (cfg) => ipcRenderer.invoke('config:validate', cfg),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),
  runStart: (mode) => ipcRenderer.invoke('run:start', mode),
  runStop: () => ipcRenderer.invoke('run:stop'),
  runStatus: () => ipcRenderer.invoke('run:status'),
  logTail: (n) => ipcRenderer.invoke('log:tail', n),
  csvRead: () => ipcRenderer.invoke('csv:read'),
  envInfo: () => ipcRenderer.invoke('env:info'),
  openDownloadDir: () => ipcRenderer.invoke('shell:open-download-dir'),
});
