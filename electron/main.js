'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateConfig } = require('../src/config/validator.js');

const SMOKE_TIMEOUT_MS = 30 * 1000;

function configFile() {
  return path.join(app.getAppPath(), 'content.json');
}

function readConfig(file) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) {
    return { ok: false, error: '读取或解析 content.json 失败: ' + e.message };
  }
}

function atomicWriteJson(file, data) {
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch (_) { /* 忽略 */ }
    throw e;
  }
}

function fileHash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    title: '番仓 AniVault',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  return win;
}

function runSmoke() {
  let done = false;
  const timer = setTimeout(() => finish(false, '30 秒超时'), SMOKE_TIMEOUT_MS);
  function finish(ok, msg) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (ok) {
      console.log('SMOKE_OK');
      app.exit(0);
    } else {
      console.error('SMOKE_FAIL', msg);
      app.exit(1);
    }
  }
  const win = createWindow();
  win.webContents.once('did-finish-load', () => finish(true, ''));
  win.webContents.once('did-fail-load', (_e, code, desc) => finish(false, '加载失败 code=' + code + ' ' + desc));
}

function runSelfTest() {
  let tmpDir = null;
  try {
    const real = configFile();
    if (!fs.existsSync(real)) throw new Error('content.json 不存在: ' + real);
    const hashBefore = fileHash(real);
    const original = readConfig(real);
    if (!original.ok) throw new Error(original.error);
    const originalValue = JSON.parse(JSON.stringify(original.data));
    if (originalValue.defaults.max_download === 7) throw new Error('测试前提冲突：原 max_download 恰好为 7');

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-selftest-'));
    const tmp = path.join(tmpDir, 'content.json');
    fs.copyFileSync(real, tmp);

    const changed = JSON.parse(JSON.stringify(originalValue));
    changed.defaults.max_download = 7;
    const vr = validateConfig(changed);
    if (!vr.ok) throw new Error('校验失败: ' + JSON.stringify(vr.errors));
    atomicWriteJson(tmp, changed);

    const back = readConfig(tmp);
    if (!back.ok || back.data.defaults.max_download !== 7) throw new Error('回读不等于 7');

    fs.writeFileSync(tmp, JSON.stringify(originalValue, null, 2) + '\n', 'utf8');
    const restored = readConfig(tmp);
    if (!restored.ok || restored.data.defaults.max_download !== originalValue.defaults.max_download) {
      throw new Error('恢复失败');
    }

    if (fileHash(real) !== hashBefore) throw new Error('真实 content.json 被改动');
    console.log('SELFTEST_OK');
    app.exit(0);
  } catch (e) {
    console.error('SELFTEST_FAIL', e.message || e);
    app.exit(1);
  } finally {
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { /* 忽略 */ }
    }
  }
}

function registerIpc() {
  ipcMain.handle('config:read', () => readConfig(configFile()));
  ipcMain.handle('config:validate', (_e, cfg) => validateConfig(cfg));
  ipcMain.handle('config:save', (_e, cfg) => {
    const vr = validateConfig(cfg);
    if (!vr.ok) return { ok: false, errors: vr.errors };
    try {
      atomicWriteJson(configFile(), cfg);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: '写入失败: ' + e.message };
    }
  });
}

app.whenReady().then(() => {
  registerIpc();
  if (process.argv.includes('--smoke')) { runSmoke(); return; }
  if (process.argv.includes('--selftest')) { runSelfTest(); return; }
  createWindow();
});
