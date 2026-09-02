'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const runEventChannels = new Set(['run:started', 'run:episode', 'run:log', 'run:finished']);
const runEventWrappers = new Map();

function runEventsOn(channel, listener) {
  if (!runEventChannels.has(channel) || typeof listener !== 'function') return;
  const wrapper = (_event, payload) => listener(payload);
  if (!runEventWrappers.has(channel)) runEventWrappers.set(channel, new Map());
  runEventWrappers.get(channel).set(listener, wrapper);
  ipcRenderer.on(channel, wrapper);
}

function runEventsOff(channel, listener) {
  const wrapper = runEventWrappers.get(channel)?.get(listener);
  if (!wrapper) return;
  ipcRenderer.removeListener(channel, wrapper);
  runEventWrappers.get(channel).delete(listener);
}

contextBridge.exposeInMainWorld('anivault', {
  readConfig: () => ipcRenderer.invoke('config:read'),
  validateConfig: (cfg) => ipcRenderer.invoke('config:validate', cfg),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),
  runStart: (mode) => ipcRenderer.invoke('run:start', mode),
  runStop: () => ipcRenderer.invoke('run:stop'),
  runStatus: () => ipcRenderer.invoke('run:status'),
  logTail: (n) => ipcRenderer.invoke('log:tail', n),
  runEventsOn,
  runEventsOff,
  csvRead: () => ipcRenderer.invoke('csv:read'),
  csvSkip: (payload) => ipcRenderer.invoke('csv:skip', payload),
  csvRemove: (payload) => ipcRenderer.invoke('csv:remove', payload),
  envInfo: () => ipcRenderer.invoke('env:info'),
  openDownloadDir: () => ipcRenderer.invoke('shell:open-download-dir'),
  mpvSyncStatus: (mpvRoot) => ipcRenderer.invoke('mpv-sync:status', mpvRoot),
  mpvSyncInstall: (mpvRoot) => ipcRenderer.invoke('mpv-sync:install', mpvRoot),
  mpvSyncUpdate: () => ipcRenderer.invoke('mpv-sync:update'),
  mpvSyncSetEnabled: (enabled) => ipcRenderer.invoke('mpv-sync:set-enabled', enabled),
  mpvSyncUninstall: () => ipcRenderer.invoke('mpv-sync:uninstall'),
});
