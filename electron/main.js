'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateConfig } = require('../src/config/validator.js');
const { createRunner } = require('../src/runner.js');
const { readCsv } = require('../src/csv.js');
const { tailFileFast } = require('../src/logutil.js');
const { syncSchedule, queryTask, TASK_NAME } = require('../src/schedule.js');
const { countEpisodeFiles, findFolder } = require('../anime_updater.js');
const { summarize } = require('../src/summary.js');
const { createManager: createMpvSyncManager } = require('../src/mpv-watched-prefix-manager.js');

const SMOKE_TIMEOUT_MS = 30 * 1000;
const RUN_LOG_CAP = 500;

let runner = null;
let runLog = [];
let lastExit = null;
let episodes = [];
let mainWindow = null;
let mpvSyncManager = null;

function appRoot() {
  return app.getAppPath();
}

function getMpvSyncManager() {
  if (!mpvSyncManager) mpvSyncManager = createMpvSyncManager({ projectRoot: appRoot() });
  return mpvSyncManager;
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
  if (process.env.AGE_DLOAD) return process.env.AGE_DLOAD;
  const cfg = readConfig(configFile());
  const configured = cfg.ok && typeof cfg.data.download_dir === 'string' ? cfg.data.download_dir.trim() : '';
  return configured || 'D:\\idm下载';
}

function downloadDirSource() {
  if (process.env.AGE_DLOAD) return 'AGE_DLOAD';
  const cfg = readConfig(configFile());
  return cfg.ok && typeof cfg.data.download_dir === 'string' && cfg.data.download_dir.trim()
    ? 'content.json' : '默认值';
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

function handleRunnerLine(line) {
  if (typeof line !== 'string' || !line.startsWith('EP_STATUS\t')) return;
  let data;
  try {
    data = JSON.parse(line.slice('EP_STATUS\t'.length));
  } catch (e) {
    return;
  }
  if (!data || typeof data.title !== 'string' || typeof data.ep !== 'number') return;
  const entry = { title: data.title, ep: data.ep, status: data.status, skipped: data.skipped === true };
  episodes = episodes.filter(e => !(e.title === entry.title && e.ep === entry.ep));
  episodes.push(entry);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('run:episode', entry);
  }
}

function getRunner() {
  if (!runner) {
    runner = createRunner({
      scriptPath: updaterScript(),
      lockPath: lockFile(),
      extraEnv: { AGE_RUN_MODE: 'interactive' },
      onStdout: line => {
        pushRunLog(line);
        handleRunnerLine(line);
      },
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
  mainWindow = win;
  win.on('closed', () => { mainWindow = null; });
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

function runScreenshot(outputPath) {
  const win = createWindow();
  const fail = msg => {
    console.error('SCREENSHOT_FAIL', msg);
    app.exit(1);
  };
  const timer = setTimeout(() => fail('30 秒超时'), SMOKE_TIMEOUT_MS);
  win.webContents.once('did-finish-load', async () => {
    try {
      await new Promise(r => setTimeout(r, 1000));
      const image = await win.webContents.capturePage();
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, image.toPNG());
      clearTimeout(timer);
      console.log('SCREENSHOT_OK ' + outputPath);
      app.exit(0);
    } catch (e) {
      clearTimeout(timer);
      fail(e.message || String(e));
    }
  });
  win.webContents.once('did-fail-load', (_e, code, desc) => {
    clearTimeout(timer);
    fail('加载失败 code=' + code + ' ' + desc);
  });
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

    const fakeStatus = path.join(tmpDir, 'fake-ep-status.js');
    fs.writeFileSync(fakeStatus, "console.log('EP_STATUS\\t' + JSON.stringify({ title: 'Test Anime', ep: 2, status: 'downloading' }));\nconsole.log('EP_STATUS\\t' + JSON.stringify({ title: 'Test Anime', ep: 2, status: 'done', skipped: false }));\nsetTimeout(() => process.exit(0), 100);\n", 'utf8');
    episodes = [];
    const statusLock = path.join(tmpDir, 'run-status.lock');
    const statusRunner = createRunner({ scriptPath: fakeStatus, lockPath: statusLock, onStdout: line => handleRunnerLine(line) });
    const statusStarted = statusRunner.start();
    if (!statusStarted.ok) throw new Error('状态假脚本启动失败: ' + JSON.stringify(statusStarted));
    await waitForNoRunning(statusRunner, 5000);
    if (episodes.length !== 1 || episodes[0].status !== 'done' || episodes[0].ep !== 2) {
      throw new Error('EP_STATUS 未正确记录: ' + JSON.stringify(episodes));
    }

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
      const schedule = syncSchedule({
        time: cfg.fetch_time,
        launcherPath: path.join(appRoot(), 'scripts', 'auto-run.vbs'),
      });
      return { ok: true, schedule };
    } catch (e) {
      return { ok: false, error: '写入失败: ' + e.message };
    }
  });

  ipcMain.handle('schedule:status', () => {
    const q = queryTask();
    return { taskName: TASK_NAME, exists: q.exists, output: q.output };
  });

  ipcMain.handle('run:start', (_e, mode) => {
    const cfg = readConfig(configFile());
    if (!cfg.ok) return { ok: false, error: cfg.error };
    const vr = validateConfig(cfg.data);
    if (!vr.ok) return { ok: false, errors: vr.errors };
    const args = mode === 'dry' ? ['--dry-run'] : [];
    const r = getRunner().start(args);
    if (r.ok) {
      episodes = [];
      pushRunLog('[面板] 已启动 ' + (mode === 'dry' ? 'dry-run' : '下载') + '，pid=' + r.pid);
    }
    return r;
  });

  ipcMain.handle('run:stop', () => getRunner().stop());
  ipcMain.handle('run:status', () => ({
    running: getRunner().status().running,
    pid: getRunner().status().pid,
    lastExit,
    episodes,
  }));
  ipcMain.handle('log:tail', (_e, n) => {
    const count = Math.min(Math.max(parseInt(n, 10) || 100, 1), 1000);
    let progress = [];
    try {
      progress = tailFileFast(progressFile(), count);
    } catch (e) {
      progress = ['PROGRESS.md 不可读: ' + e.message];
    }
    return { progress };
  });
  ipcMain.handle('csv:read', () => {
    try {
      const rows = readCsv(csvFile());
      const cfg = readConfig(configFile());
      const animeMap = (cfg.ok && cfg.data.anime) || {};
      const summaries = {};
      for (const title of new Set(rows.map(r => r.title))) {
        const info = Object.assign({}, animeMap[title] || {}, { title });
        let folderCount = -1;
        try {
          const folder = findFolder(info);
          if (folder) folderCount = countEpisodeFiles(folder.dir, info);
        } catch (e) {
          folderCount = -1;
        }
        summaries[title] = summarize(info, folderCount);
      }
      return { ok: true, rows, summaries, file: csvFile() };
    } catch (e) {
      return { ok: false, error: e.message, rows: [], summaries: {} };
    }
  });
  ipcMain.handle('csv:delete', (_e, payload) => {
    const title = payload && payload.title;
    const ep = payload && payload.ep;
    if (typeof title !== 'string' || !Number.isInteger(ep) || ep <= 0) {
      return { ok: false, error: '参数不合法' };
    }
    const cfg = readConfig(configFile());
    if (!cfg.ok) return { ok: false, error: cfg.error };
    const info = cfg.data.anime && cfg.data.anime[title];
    if (!info) return { ok: false, error: '找不到该番剧: ' + title };
    const skip = Array.isArray(info.skip_eps)
      ? info.skip_eps.filter(x => Number.isInteger(x) && x > 0)
      : [];
    if (!skip.includes(ep)) skip.push(ep);
    skip.sort((a, b) => a - b);
    info.skip_eps = skip;
    try {
      atomicWriteJson(configFile(), cfg.data);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: '写入失败: ' + e.message };
    }
  });
  ipcMain.handle('env:info', () => ({
    script: updaterScript(),
    content: configFile(),
    progress: progressFile(),
    csv: csvFile(),
    lock: lockFile(),
    downloadDir: downloadDir(),
    downloadDirSource: downloadDirSource(),
    node: process.execPath,
    electron: process.versions.electron,
    nodeVersion: process.versions.node,
  }));
  ipcMain.handle('shell:open-download-dir', async () => {
    const err = await shell.openPath(downloadDir());
    return { ok: !err, error: err || null };
  });
  ipcMain.handle('mpv-sync:status', (_e, mpvRoot) => getMpvSyncManager().getStatus({ mpvRoot }));
  ipcMain.handle('mpv-sync:install', (_e, mpvRoot) => getMpvSyncManager().install({ mpvRoot }));
  ipcMain.handle('mpv-sync:update', () => getMpvSyncManager().update());
  ipcMain.handle('mpv-sync:set-enabled', (_e, enabled) => getMpvSyncManager().setEnabled({ enabled }));
  ipcMain.handle('mpv-sync:uninstall', () => getMpvSyncManager().uninstall());
}

app.whenReady().then(() => {
  registerIpc();
  const shotIdx = process.argv.indexOf('--screenshot');
  if (shotIdx >= 0) {
    const output = process.argv[shotIdx + 1];
    if (!output) {
      console.error('SCREENSHOT_FAIL', '缺少输出路径');
      app.exit(1);
      return;
    }
    runScreenshot(output);
    return;
  }
  if (process.argv.includes('--smoke')) { runSmoke(); return; }
  if (process.argv.includes('--selftest')) { runSelfTest(); return; }
  createWindow();
});
