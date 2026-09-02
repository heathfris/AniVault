const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch (error) {
  // Keep compatibility with the original Codex runtime when running locally
  // before project dependencies have been installed.
  ({ chromium } = require('C:/Users/15269/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'));
}
const { appendRotated } = require('./src/logutil.js');
const folderOps = require('./src/folders.js');
const siteOps = require('./src/site.js');
const downloadOps = require('./src/download.js');

const WORK = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const IDM = 'F:\\IDM\\Internet Download Manager\\IDMan.exe';
function getCsvPath(workDir = WORK, env = process.env) {
  return env.AGE_CSV || path.join(workDir, 'local', '待下载清单.csv');
}
function getFfmpegPath() {
  const bundled = path.join(WORK, 'tools', 'ffmpeg', 'ffmpeg.exe');
  return process.env.AGE_FFMPEG || (fs.existsSync(bundled) ? bundled : 'ffmpeg.exe');
}
function getAria2Path() {
  const bundled = path.join(WORK, 'tools', 'aria2', 'aria2c.exe');
  return process.env.AGE_ARIA2 || (fs.existsSync(bundled) ? bundled : 'aria2c.exe');
}
const FFMPEG = getFfmpegPath();
const ARIA2 = getAria2Path();
const baseCache = new Map();
function getBase(file = CONTENT) {
  if (process.env.AGE_BASE) return process.env.AGE_BASE;
  if (baseCache.has(file)) return baseCache.get(file);
  let value = 'https://www.agedm.io';
  try {
    const content = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (content.base_url && /^https?:\/\//i.test(content.base_url)) value = content.base_url;
  } catch (e) {
    /* 读取失败用默认值 */
  }
  baseCache.set(file, value);
  return value;
}
function resetBaseCache() {
  baseCache.clear();
}
const DEFAULT_DLOAD = 'D:\\idm下载';
let DLOAD = process.env.AGE_DLOAD || DEFAULT_DLOAD;
const {
  parseFolderName,
  applyTemplate,
  matchFolderTemplate,
  validName,
  resolveFolderName,
  resolveFileName,
  renameFolder,
  renameWithRetrySync,
  getEpisodeFileMatcher,
  countEpisodeFiles,
  findEpisodeFile,
} = folderOps;

function findFolderByTitle(title) {
  return folderOps.findFolderByTitle(title, { downloadRoot: DLOAD });
}

function findFolder(anime) {
  return folderOps.findFolder(anime, { downloadRoot: DLOAD });
}

function safeRenameFolder(oldPath, newPath) {
  return folderOps.safeRenameFolder(oldPath, newPath, { lockPath: FOLDER_RENAME_LOCK });
}

function getDownloadDir(content) {
  const configured = content && typeof content.download_dir === 'string' ? content.download_dir.trim() : '';
  return process.env.AGE_DLOAD || configured || DEFAULT_DLOAD;
}
const CONTENT = process.env.AGE_CONTENT || path.join(WORK, 'content.json');
const CSV = getCsvPath();
const PROGRESS = process.env.AGE_PROGRESS || path.join(WORK, 'PROGRESS.md');
const BLOCKED = process.env.AGE_BLOCKED || path.join(WORK, 'BLOCKED.md');
const FOLDER_RENAME_LOCK = process.env.AGE_FOLDER_RENAME_LOCK || path.join(WORK, 'local', 'mpv-watched-prefix', 'folder-rename.lock');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MIN_SIZE = 100 * 1024 * 1024;
const STABLE_MS = 120 * 1000;
const ATTEMPT_TIMEOUT_MS = 45 * 60 * 1000;
const LINES = [1, 2, 3, 4, 5];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function createBrowserPool(createBrowser) { return siteOps.createBrowserPool(createBrowser, { chromium, edgePath: EDGE }); }

async function fetchText(url, referer, deps = {}) { return siteOps.fetchText(url, referer, deps); }

function formatLogTime(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function now() { return formatLogTime(new Date()); }

function progress(msg) {
  const line = `${now()} ${msg}`;
  console.log(line);
  appendRotated(PROGRESS, line);
}

function blocked(msg) {
  const line = `${now()} BLOCKED: ${msg}`;
  console.log(line);
  appendRotated(BLOCKED, line);
}

async function searchSite(title) {
  return siteOps.searchSite(title, { baseUrl: getBase(), fetchTextImpl: fetchText });
}

function parseHomeUpdateTimes(html) {
  return siteOps.parseHomeUpdateTimes(html);
}

async function getHomeUpdateTimes() {
  return siteOps.getHomeUpdateTimes({ baseUrl: getBase(), fetchTextImpl: fetchText });
}

async function getMaxEp(siteId, source) {
  return siteOps.getMaxEp(siteId, source, { baseUrl: getBase(), fetchTextImpl: fetchText });
}

async function getPlayUrl(siteId, ep, source, browserPool) {
  return siteOps.getPlayUrl(siteId, ep, source, browserPool, { baseUrl: getBase(), chromium, edgePath: EDGE });
}

function callIdm(url, folder, filename) { return downloadOps.callIdm(url, folder, filename, { idmPath: IDM, spawn }); }

function getFfmpegTempPath(output) { return downloadOps.getFfmpegTempPath(output); }
function getMediaDurationSeconds(file, run = spawnSync) { return downloadOps.getMediaDurationSeconds(file, run, FFMPEG); }
function isDurationPlausible(duration, referenceDuration) { return downloadOps.isDurationPlausible(duration, referenceDuration); }
function chooseRecoverablePart(candidates, referenceDuration, minSize = MIN_SIZE) { return downloadOps.chooseRecoverablePart(candidates, referenceDuration, minSize); }
function callFfmpeg(url, folder, filename, headers = {}) { return downloadOps.callFfmpeg(url, folder, filename, headers, { ffmpegPath: FFMPEG, timeoutMs: ATTEMPT_TIMEOUT_MS, renameWithRetrySync }); }
function callAria2(url, folder, filename, headers = {}) { return downloadOps.callAria2(url, folder, filename, headers, { aria2Path: ARIA2, timeoutMs: ATTEMPT_TIMEOUT_MS, renameWithRetrySync }); }
function waitForFile(filePath, minSize, stableMs, timeoutMs) { return downloadOps.waitForFile(filePath, minSize, stableMs, timeoutMs); }
function engineChain(selected, isM3u8, runMode) { return downloadOps.engineChain(selected, isM3u8, runMode); }
async function downloadEpisode(anime, ep, folderDir, deps = {}) {
  return downloadOps.downloadEpisode(anime, ep, folderDir, {
    resolveFileName, findEpisodeFile, renameWithRetrySync, getMediaDurationSeconds,
    isDurationPlausible, chooseRecoverablePart, getFfmpegTempPath, getPlayUrl, callAria2,
    callFfmpeg, callIdm, waitForFile, progress, getBase, userAgent: UA, lines: LINES,
    minSize: MIN_SIZE, stableMs: STABLE_MS, attemptTimeoutMs: deps.attemptTimeoutMs || ATTEMPT_TIMEOUT_MS,
    runMode: deps.runMode || process.env.AGE_RUN_MODE || 'interactive',
    ...deps,
  });
}
async function runPool(items, worker, poolSize) { return downloadOps.runPool(items, worker, poolSize); }


function planDownloadRange(maxEp, end, maxPerRun) {
  const target = (maxPerRun > 0) ? Math.min(maxEp, end + maxPerRun) : maxEp;
  const newEps = [];
  for (let ep = end + 1; ep <= target; ep++) newEps.push(ep);
  return { targetEp: target, newEps };
}

function findMissingEps(dir, anime, end) {
  const missing = [];
  for (let ep = 1; ep <= end; ep++) {
    if (!findEpisodeFile(dir, anime, ep)) missing.push(ep);
  }
  return missing;
}

function resolveDownloadedStart(fileCount, current) {
  if (!Number.isFinite(fileCount) || fileCount < 0) return current;
  return fileCount >= 1 ? 1 : 0;
}

function computeNewEnd(end, missing, results) {
  let highest = end;
  for (let i = 0; i < missing.length; i++) {
    if (results[i] && results[i].ok && missing[i] > highest) highest = missing[i];
  }
  return highest;
}

function filterRowsByResults(rows, title, missing, results, dryRun) {
  if (dryRun) return rows;
  for (let i = missing.length - 1; i >= 0; i--) {
    if (results[i] && results[i].ok) {
      const idx = rows.findIndex(r => r.title === title && r.ep === missing[i]);
      if (idx >= 0) rows.splice(idx, 1);
    }
  }
  return rows;
}

function withoutSkippedEps(missing, skipEps) {
  const skip = new Set(Array.isArray(skipEps) ? skipEps.filter(x => Number.isInteger(x) && x > 0) : []);
  return missing.filter(ep => !skip.has(ep));
}

function isIdmRunning() {
  const r = spawnSync('tasklist.exe', ['/FI', 'IMAGENAME eq IDMan.exe', '/NH'], { encoding: 'utf8', windowsHide: true });
  return r.status === 0 && /IDMan\.exe/i.test(r.stdout || '');
}

async function ensureIdmMinimized() {
  if (isIdmRunning()) return;
  const ps = `Start-Process -WindowStyle Minimized -FilePath '${IDM}'`;
  const child = spawn('powershell.exe', ['-NoProfile', '-Command', ps], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  await sleep(3000);
  progress('IDM 已最小化启动（后台）');
}

function idmHasActivity() {
  const tempRe = /\.l!$|\.part$|\.lpart$|\.lc!$/i;
  const now = Date.now();
  const walk = dir => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return false; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (walk(full)) return true;
      } else if (tempRe.test(e.name)) {
        return true;
      } else {
        try {
          if (now - fs.statSync(full).mtimeMs < 60000) return true;
        } catch (err) { /* 忽略 */ }
      }
    }
    return false;
  };
  try { return walk(DLOAD); } catch (e) { return false; }
}

async function closeIdmIfIdle(waitMs) {
  const start = Date.now();
  while (Date.now() - start < waitMs) {
    if (!idmHasActivity()) {
      const r = spawnSync('taskkill.exe', ['/IM', 'IDMan.exe'], { windowsHide: true });
      progress(`IDM 无活动下载，已请求关闭 (exit=${r.status})`);
      if (r.status !== 0) {
        const f = spawnSync('taskkill.exe', ['/F', '/IM', 'IDMan.exe'], { windowsHide: true });
        if (f.status === 0) progress('IDM 已强制关闭');
      }
      return;
    }
    await sleep(10000);
  }
  progress(`等待 ${Math.round(waitMs / 1000)} 秒后 IDM 仍有活动，跳过自动关闭`);
}

function writeCsv(rows, csvPath = CSV) {
  const lines = ['动漫,集数,播放页URL', ...rows.map(r => `${r.title},${r.ep},${r.url}`)];
  fs.mkdirSync(path.dirname(csvPath), { recursive: true });
  fs.writeFileSync(csvPath, '\uFEFF' + lines.join('\r\n'), 'utf8');
}

async function processOneAnime(title, info, content, options = {}) {
  const deps = options.deps || {};
  const dryRun = options.dryRun === true;
  const defaults = options.defaults || content.defaults || {};
  const homeTimes = options.homeTimes || {};
  const rows = options.rows || [];
  const processDownload = deps.downloadEpisode || downloadEpisode;
  const resolveMaxEp = deps.getMaxEp || getMaxEp;
  const maxPerRunRaw = parseInt(defaults.max_download, 10);
  const maxPerRun = Number.isFinite(maxPerRunRaw) && maxPerRunRaw > 0 ? maxPerRunRaw : 0;
  const autoRepair = defaults.auto_repair !== false;
  const maxParallelRaw = parseInt(defaults.max_parallel, 10);
  const maxParallel = Number.isFinite(maxParallelRaw) && maxParallelRaw >= 1 && maxParallelRaw <= 10 ? maxParallelRaw : 1;
  const engine = (defaults.download_engine === 'idm' || defaults.download_engine === 'ffmpeg') ? defaults.download_engine : 'aria2';
  const runMode = deps.runMode || process.env.AGE_RUN_MODE || 'interactive';
  const attemptTimeoutMinRaw = parseInt(defaults.attempt_timeout_min, 10);
  const attemptTimeoutMin = Number.isFinite(attemptTimeoutMinRaw) && attemptTimeoutMinRaw >= 5 && attemptTimeoutMinRaw <= 60 ? attemptTimeoutMinRaw : 20;
  const attemptTimeoutMs = attemptTimeoutMin * 60 * 1000;
  let changed = false;

  if (info.enabled === false) {
    progress(`${title}: 已停用，跳过`);
    return { changed: false };
  }

  if (!info.site_id) {
    const s = await searchSite(title);
    if (!s) { blocked(`搜索不到站内条目: ${title}`); return { changed: false }; }
    info.site_id = s.id;
    changed = true;
    progress(`${title}: 补 site_id=${s.id}`);
  }
  if (!info.update_time) {
    info.update_time = homeTimes[title] || null;
    changed = true;
    if (homeTimes[title]) progress(`${title}: 补 update_time=${homeTimes[title]}`);
    else progress(`${title}: 本周放送列表未匹配到更新时间，记为 null`);
  }
  const legacyFolder = findFolderByTitle(title);
  if (info.downloaded_start === undefined || info.downloaded_start === null) {
    info.downloaded_start = (legacyFolder && legacyFolder.start !== undefined) ? legacyFolder.start : 0;
    changed = true;
  }
  if (info.downloaded_end === undefined || info.downloaded_end === null) {
    info.downloaded_end = (legacyFolder && legacyFolder.end !== undefined) ? legacyFolder.end : 0;
    changed = true;
  }

  const anime = Object.assign({}, info, { title });
  if (!anime.site_id) return { changed };
  const start = (anime.downloaded_start !== undefined && anime.downloaded_start !== null) ? anime.downloaded_start : 0;
  const end = (anime.downloaded_end !== undefined && anime.downloaded_end !== null) ? anime.downloaded_end : 0;

  let folder = findFolder(anime);
  if (!folder) {
    const cur = resolveFolderName(anime, null, end);
    if (cur.error) { blocked(`${title}: ${cur.error}`); return { changed }; }
    if (dryRun) {
      progress(`dry-run: 将新建文件夹 ${cur.name}`);
      folder = { dir: path.join(DLOAD, cur.name), prefix: anime.folder_name ? '' : '0_', title, start, end, name: cur.name };
    } else {
      try {
        fs.mkdirSync(path.join(DLOAD, cur.name), { recursive: true });
        progress(`新建文件夹: ${cur.name}`);
      } catch (e) {
        blocked(`${title}: 无法创建文件夹 ${cur.name}: ${e.message}`);
        return { changed };
      }
      folder = { dir: path.join(DLOAD, cur.name), prefix: anime.folder_name ? '' : '0_', title, start, end, name: cur.name };
    }
  }

  if (!dryRun && anime.folder_name) {
    const cur = resolveFolderName(anime, folder, end);
    if (cur.error) { blocked(`${title}: ${cur.error}`); return { changed }; }
    if (cur.name !== folder.name) {
      const r = safeRenameFolder(folder.dir, path.join(DLOAD, cur.name));
      if (!r.ok) { blocked(`${title}: 文件夹迁移失败 ${r.error}`); return { changed }; }
      progress(`${title}: 文件夹迁移 ${folder.name} -> ${cur.name}`);
      folder = Object.assign({}, folder, { name: cur.name, dir: path.join(DLOAD, cur.name) });
    }
  }

  const fileCount = countEpisodeFiles(folder.dir, anime);
  const newStart = resolveDownloadedStart(fileCount, info.downloaded_start);
  if (newStart !== info.downloaded_start) {
    info.downloaded_start = newStart;
    changed = true;
    progress(`${title}: downloaded_start 修正为 ${newStart}`);
  }
  const repairEps = [];
  if (fileCount >= 0 && fileCount < end) {
    if (autoRepair) {
      repairEps.push(...findMissingEps(folder.dir, anime, end));
      progress(`${title}: 文件数 ${fileCount} < downloaded_end ${end}，自动补缺 ${repairEps.join(',')}`);
    } else {
      blocked(`${title}: 文件夹内集数文件数 ${fileCount} < downloaded_end ${end}，跳过`);
      return { changed };
    }
  }

  const maxEp = await resolveMaxEp(anime.site_id, 1);
  if (info.site_latest !== maxEp) { info.site_latest = maxEp; changed = true; }
  const range = planDownloadRange(maxEp, end, maxPerRun);
  const missingSet = new Set(repairEps);
  for (const ep of range.newEps) missingSet.add(ep);
  const unavailable = [...missingSet].filter(ep => ep > maxEp);
  for (const ep of unavailable) blocked(`${title}: 第${ep}集缺失但站内已无该集，无法补`);
  const missing = withoutSkippedEps([...missingSet].filter(ep => ep <= maxEp), info.skip_eps).sort((a, b) => a - b);
  if (missing.length === 0) {
    progress(`${title}: 无新集（downloaded_end=${end}，站内 ${maxEp}）`);
    return { changed };
  }
  for (const ep of missing) rows.push({ title, ep, url: `${getBase()}/play/${anime.site_id}/1/${ep}` });
  progress(`${title}: 站内最新 ${maxEp}，本次下载 ${missing.join(',')}（downloaded_end=${end}${maxPerRun > 0 ? `，单次上限 ${maxPerRun}` : ''}${maxParallel > 1 ? `，并发 ${maxParallel}` : ''}）`);
  if (dryRun) return { changed };

  if (engine === 'idm' && runMode === 'interactive') await ensureIdmMinimized();
  const results = await runPool(missing, async ep => {
    const emitStatus = status => console.log('EP_STATUS\t' + JSON.stringify(status));
    emitStatus({ title, ep, status: 'downloading' });
    try {
      const fname = resolveFileName(anime, ep);
      if (fname.error) throw new Error(fname.error);
      const r = await processDownload(anime, ep, folder.dir, { engine, runMode, attemptTimeoutMs, browserPool: deps.browserPool });
      progress(`${title} 第${ep}集: 完成${r.skipped ? '（已存在）' : `（线路${r.src}，${r.size} 字节）`}`);
      emitStatus({ title, ep, status: 'done', skipped: r.skipped === true });
      return { ok: true, r };
    } catch (e) {
      blocked(`${title} 第${ep}集: 下载失败 ${e.message}`);
      emitStatus({ title, ep, status: 'failed' });
      return { ok: false, error: e.message };
    }
  }, maxParallel);
  filterRowsByResults(rows, title, missing, results, dryRun);
  const failedCount = results.filter(x => !x || !x.ok).length;
  const idmUsed = results.some(x => x && x.ok && x.r && x.r.engine === 'idm');
  const newEnd = computeNewEnd(end, missing, results);
  if (newEnd > end) {
    info.downloaded_end = newEnd;
    changed = true;
    if (failedCount > 0) progress(`${title}: 部分成功，end ${end} -> ${newEnd}（${failedCount} 集失败留待补下）`);
    else progress(`${title}: 全部成功，end ${end} -> ${newEnd}`);
    const newRes = resolveFolderName(anime, folder, newEnd);
    if (newRes.error) {
      blocked(`${title}: ${newRes.error}`);
    } else if (newRes.name !== folder.name) {
      const r = safeRenameFolder(folder.dir, path.join(DLOAD, newRes.name));
      if (!r.ok) { blocked(`${title}: 文件夹改名失败 ${r.error}`); }
      else { progress(`${title}: 文件夹改名 ${folder.name} -> ${newRes.name}`); }
    }
  }
  return { changed, idmUsed };
}

async function processAllAnime(content, deps = {}) {
  DLOAD = getDownloadDir(content);
  const browserPool = createBrowserPool(deps.createBrowser);
  const dryRun = deps.dryRun === true;
  const rows = [];
  let changed = false;
  let failed = 0;
  let idmUsed = false;
  let homeTimes = {};
  const reportBlocked = deps.blocked || blocked;
  const reportProgress = deps.progress || progress;
  const reportCsv = deps.writeCsv || writeCsv;
  try {
    try {
      homeTimes = deps.getHomeTimes ? await deps.getHomeTimes() : await getHomeUpdateTimes();
    } catch (e) {
      reportBlocked('首页更新列表获取失败: ' + e.message);
    }
    const processOne = deps.processOneAnime || processOneAnime;
    for (const [title, info] of Object.entries(content.anime || {})) {
      try {
        const r = await processOne(title, info, content, {
          dryRun,
          defaults: content.defaults || {},
          homeTimes,
          rows,
          deps: Object.assign({}, deps, { browserPool }),
        });
        if (r && r.changed) changed = true;
        if (r && r.idmUsed) idmUsed = true;
      } catch (e) {
        failed += 1;
        reportBlocked(`${title}: ${e.message}`);
      }
    }
    if (changed) fs.writeFileSync(CONTENT, JSON.stringify(content, null, 2) + '\n', 'utf8');
    if (rows.length > 0 || failed === 0) {
      reportCsv(rows);
      reportProgress(`待下载清单已写: ${CSV}（${rows.length} 行）`);
    } else {
      reportProgress('查询失败且本运行无待下载行，保留上次待下载清单');
    }
    if (!dryRun && (content.defaults || {}).auto_close_idm === true && idmUsed) {
      await closeIdmIfIdle(60000);
    }
    return { ok: true, changed, failed, idmUsed, rows };
  } finally {
    await browserPool.close();
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!fs.existsSync(PROGRESS)) fs.writeFileSync(PROGRESS, '# PROGRESS\n\n无\n', 'utf8');
  if (!fs.existsSync(BLOCKED)) fs.writeFileSync(BLOCKED, '# BLOCKED\n\n无\n', 'utf8');
  progress(`启动 ${dryRun ? '(dry-run)' : '(实跑)'}`);

  let content;
  try {
    content = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  } catch (e) {
    blocked('content.json 无法解析: ' + e.message);
    process.exitCode = 1;
    return;
  }

  await processAllAnime(content, { dryRun });
}

module.exports = { searchSite, parseHomeUpdateTimes, parseFolderName, applyTemplate, matchFolderTemplate, validName, resolveFolderName, resolveFileName, renameFolder, safeRenameFolder, renameWithRetrySync, getMediaDurationSeconds, isDurationPlausible, chooseRecoverablePart, getEpisodeFileMatcher, countEpisodeFiles, findEpisodeFile, planDownloadRange, findMissingEps, resolveDownloadedStart, computeNewEnd, filterRowsByResults, withoutSkippedEps, getBase, resetBaseCache, getDownloadDir, engineChain, getCsvPath, getFfmpegPath, getAria2Path, getFfmpegTempPath, formatLogTime, isIdmRunning, ensureIdmMinimized, idmHasActivity, closeIdmIfIdle, blocked, progress, getMaxEp, getPlayUrl, callIdm, callFfmpeg, callAria2, fetchText, runPool, processOneAnime, processAllAnime, waitForFile, downloadEpisode, findFolder, findFolderByTitle, writeCsv };

if (require.main === module) {
  main().catch(e => {
    console.error('FATAL', e);
    process.exitCode = 1;
  });
}
