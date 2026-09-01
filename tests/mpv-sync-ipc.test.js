'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('main和preload公开固定的五个mpv同步IPC', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'electron', 'preload.js'), 'utf8');
  for (const channel of ['status', 'install', 'update', 'set-enabled', 'uninstall']) {
    assert.ok(main.includes(`ipcMain.handle('mpv-sync:${channel}'`), `main缺少${channel}`);
    assert.ok(preload.includes(`ipcRenderer.invoke('mpv-sync:${channel}'`), `preload缺少${channel}`);
  }
});
