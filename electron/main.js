'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateConfig } = require('../src/config/validator.js');
const { createRunner } = require('../src/runner.js');
const { readCsv, tailFile } = require('../src/csv.js');

const SMOKE_TIMEOUT_MS = 30 * 1000;
const RUN_LOG_CAP = 500;

let runner = null;
let runLog = [];
let lastExit = null;

function appRoot() {
  return app.getAppPath();
}

function configFile() {
  return path.join(appRoot(), 'content.json');
}

function progressFile() {
  return path.join(appRoot(), 'PROGRESS.md');
}

function blockedFile() {
  return path.join(appRoot(), 'BLOCKED.md');
}

function lockFile() {
  return path.join(appRoot(), 'local', 'run.lock');
}

function csvFile() {
  return path.join(appRoot(), 'local', '待下载清单.csv');
}

function updaterScript() {
  return path.join(appRoot(), 'anime_updater.js');
}

function downloadDir() {
  return process.env.AGE_DLOAD || 'D:\\idm下载';
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

function pushRunLog(line) {
  runLog.push(line);
  if (runLog.length > RUN_LOG_CAP) runLog.splice(0, runLog.length - RUN_LOG_CAP);
}

function getRunner() {
  if (!runner) {
    runner = createRunner({
      scriptPath: updaterScript(),
      lockPath: lockFile(),
      onStdout: line => pushRunLog(line),
      onStderr: line => pushRunLog(line),
      onExit: result => { lastExit = result; },
    });
  }
  return runner;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
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

function waitForNoRunning(r, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (!r.status().running) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error('运行器超时未退出'));
      }
    }, 50);
  });
}

async function runSelfTest() {
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

    const fake = path.join(tmpDir, 'fake-runner.js');
    fs.writeFileSync(fake, "console.log('FAKE_START');\nsetTimeout(() => { console.log('FAKE_DONE'); process.exit(0); }, 300);\n", 'utf8');
    const runLock = path.join(tmpDir, 'run.lock');
    const runLines = [];
    const fakeRunner = createRunner({ scriptPath: fake, lockPath: runLock, onStdout: l => runLines.push(l) });
    const started = fakeRunner.start();
    if (!started.ok) throw new Error('假脚本启动失败: ' + JSON.stringify(started));
    await waitForNoRunning(fakeRunner, 5000);
    if (!runLines.includes('FAKE_START') || !runLines.includes('FAKE_DONE')) {
      throw new Error('假脚本日志缺失: ' + JSON.stringify(runLines));
    }
    if (fs.existsSync(runLock)) throw new Error('假脚本退出后锁未清理');

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

  ipcMain.handle('run:start', (_e, mode) => {
    const cfg = readConfig(configFile());
    if (!cfg.ok) return { ok: false, error: cfg.error };
    const vr = validateConfig(cfg.data);
    if (!vr.ok) return { ok: false, errors: vr.errors };
    const args = mode === 'dry' ? ['--dry-run'] : [];
    const r = getRunner().start(args);
    if (r.ok) {
      pushRunLog('[面板] 已启动 ' + (mode === 'dry' ? 'dry-run' : '下载') + '，pid=' + r.pid);
    }
    return r;
  });

  ipcMain.handle('run:stop', () => getRunner().stop());
  ipcMain.handle('run:status', () => ({
    running: getRunner().status().running,
    pid: getRunner().status().pid,
    lastExit,
  }));
  ipcMain.handle('log:tail', (_e, n) => {
    const count = Math.min(Math.max(parseInt(n, 10) || 100, 1), 1000);
    let progress = [];
    let blockedTail = [];
    try {
      progress = tailFile(progressFile(), count);
    } catch (e) {
      progress = ['PROGRESS.md 不可读: ' + e.message];
    }
    try {
      blockedTail = tailFile(blockedFile(), count);
    } catch (e) {
      blockedTail = ['BLOCKED.md 不可读: ' + e.message];
    }
    return { progress, blocked: blockedTail, run: runLog.slice(-count) };
  });
  ipcMain.handle('csv:read', () => {
    try {
      return { ok: true, rows: readCsv(csvFile()), file: csvFile() };
    } catch (e) {
      return { ok: false, error: e.message, rows: [] };
    }
  });
  ipcMain.handle('env:info', () => ({
    script: updaterScript(),
    content: configFile(),
    progress: progressFile(),
    csv: csvFile(),
    lock: lockFile(),
    downloadDir: downloadDir(),
    node: process.execPath,
    electron: process.versions.electron,
    nodeVersion: process.versions.node,
  }));
  ipcMain.handle('shell:open-download-dir', async () => {
    const err = await shell.openPath(downloadDir());
    return { ok: !err, error: err || null };
  });
}

app.whenReady().then(() => {
  registerIpc();
  if (process.argv.includes('--smoke')) { runSmoke(); return; }
  if (process.argv.includes('--selftest')) { runSelfTest(); return; }
  createWindow();
});
