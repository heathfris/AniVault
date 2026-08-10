const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('C:/Users/15269/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');

const WORK = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const IDM = 'F:\\IDM\\Internet Download Manager\\IDMan.exe';
const FETCH_TIMEOUT_MS = 30 * 1000;
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
function getBase() {
  return process.env.AGE_BASE || 'https://www.agedm.io';
}
const DLOAD = process.env.AGE_DLOAD || 'D:\\idm下载';
const CONTENT = process.env.AGE_CONTENT || path.join(WORK, 'content.json');
const CSV = getCsvPath();
const PROGRESS = process.env.AGE_PROGRESS || path.join(WORK, 'PROGRESS.md');
const BLOCKED = process.env.AGE_BLOCKED || path.join(WORK, 'BLOCKED.md');
const TASK_STATE = process.env.AGE_TASK_STATE || path.join(WORK, 'task_state.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MIN_SIZE = 100 * 1024 * 1024;
const STABLE_MS = 120 * 1000;
const ATTEMPT_TIMEOUT_MS = 45 * 60 * 1000;
const LINES = [1, 2, 3, 4, 5];
const MEDIA_RE = /(\.m3u8(\?|$)|\.mp4(\?|$)|video\/tos\/|douyinvod|ixigua\.com|bytecdn|mgtv\.com|bilivideo|ffzy-plays|\.ts\?)/i;
const BAD_RE = /\.(gif|png|jpe?g|css|js|svg|ico)(\?|$)/i;
const BAD_NAME_RE = /[\/\\:*?"<>|]/;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchText(url, referer, deps = {}) {
  const headers = { 'Connection': 'close', 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' };
  if (referer) headers.Referer = referer;
  const fetchImpl = deps.fetchImpl || fetch;
  const timeoutMs = deps.timeoutMs || FETCH_TIMEOUT_MS;
  const retries = deps.retries !== undefined ? deps.retries : 1;
  const retryDelayMs = deps.retryDelayMs || 3000;
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs);
    const controller = new AbortController();
    let timeoutReject;
    const timeoutPromise = new Promise((_, reject) => { timeoutReject = reject; });
    const timer = setTimeout(() => {
      controller.abort();
      timeoutReject(new Error(`请求超时（${timeoutMs}ms）: ${url}`));
    }, timeoutMs);
    try {
      const r = await Promise.race([
        fetchImpl(url, { headers, signal: controller.signal }),
        timeoutPromise,
      ]);
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
      return r.text();
    } catch (e) {
      if (e.name === 'AbortError' || /超时/.test(e.message || '')) {
        throw new Error(`请求超时（${timeoutMs}ms）: ${url}`);
      }
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

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
  fs.appendFileSync(PROGRESS, line + '\n', 'utf8');
}

function blocked(msg) {
  const line = `${now()} BLOCKED: ${msg}`;
  console.log(line);
  fs.appendFileSync(BLOCKED, line + '\n', 'utf8');
}

function parseFolderName(name) {
  const m = name.match(/^(\d+_)?(.+?)(\d+)-(\d+)$/);
  if (!m) return null;
  return { prefix: m[1] || '', title: m[2], start: parseInt(m[3], 10), end: parseInt(m[4], 10) };
}

function applyTemplate(tpl, vars) {
  if (typeof tpl !== 'string') return null;
  return tpl
    .replace(/\{name\}/g, String(vars.name))
    .replace(/\{start\}/g, String(vars.start))
    .replace(/\{end\}/g, String(vars.end))
    .replace(/\{ep\}/g, String(vars.ep).padStart(2, '0'));
}

function validName(name) {
  return typeof name === 'string' && name.length > 0 && !BAD_NAME_RE.test(name);
}

function resolveFolderName(anime, folderInfo, end) {
  const start = (anime.downloaded_start !== undefined && anime.downloaded_start !== null) ? anime.downloaded_start : 0;
  if (anime.folder_name) {
    const name = applyTemplate(anime.folder_name, { name: anime.title, start, end, ep: end });
    if (!validName(name)) return { name: null, error: `folder_name 模板生成非法文件夹名: ${name}` };
    return { name, error: null };
  }
  const prefix = (folderInfo && folderInfo.prefix) || '0_';
  return { name: `${prefix}${anime.title}${start}-${end}`, error: null };
}

function resolveFileName(anime, ep) {
  if (anime.file_name) {
    const name = applyTemplate(anime.file_name, { name: anime.title, start: anime.downloaded_start || 0, end: anime.downloaded_end || 0, ep });
    if (!validName(name)) return { name: null, error: `file_name 模板生成非法文件名: ${name}` };
    return { name, error: null };
  }
  return { name: `${anime.title} 第${String(ep).padStart(2, '0')}集 - 在线播放 - AGE动漫.mp4`, error: null };
}

async function searchSite(title) {
  const html = await fetchText(`${getBase()}/search?query=${encodeURIComponent(title)}`);
  const re = /<a href="http:\/\/www\.agedm\.io\/detail\/(\d+)"[^>]*>([^<]+)<\/a>/g;
  let m, first = null;
  while ((m = re.exec(html))) {
    const t = m[2].trim();
    if (!first) first = { id: parseInt(m[1], 10), title: t };
    if (t === title) return { id: parseInt(m[1], 10), title: t };
  }
  return first;
}

async function getHomeUpdateTimes() {
  const html = await fetchText(`${getBase()}/`);
  const map = {};
  const blocks = html.match(/<li[^>]*>[\s\S]*?<\/li>/g) || [];
  for (const b of blocks) {
    const a = b.match(/<a[^>]*>([^<]+)<\/a>/);
    const t = b.match(/class="title_sub[^"]*"[^>]*>\s*([\d:]+)/);
    if (a && t) map[a[1].trim()] = t[1];
  }
  return map;
}

async function getMaxEp(siteId, source) {
  const html = await fetchText(`${getBase()}/detail/${siteId}`);
  const re = new RegExp(`/play/${siteId}/${source}/(\\d+)`, 'g');
  let m, max = 0;
  while ((m = re.exec(html))) max = Math.max(max, parseInt(m[1], 10));
  return max;
}

async function getPlayUrl(siteId, ep, source) {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const context = await browser.newContext({ userAgent: UA });
    const page = await context.newPage();
    let mediaUrl = null;
    page.on('request', req => {
      const u = req.url();
      if (!mediaUrl && MEDIA_RE.test(u) && !BAD_RE.test(u)) mediaUrl = u;
    });
    const playUrl = `${getBase()}/play/${siteId}/${source}/${ep}`;
    await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try { await page.waitForResponse(r => r.url().includes('Api.php'), { timeout: 30000 }); } catch (e) { /* 播放器可能不走 Api.php */ }
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const jx = page.frames().find(f => f.url().includes('jx.wuzhoupai.com'));
      if (jx) {
        try {
          const v = await jx.evaluate(() => {
            const el = document.querySelector('video');
            if (el && el.currentSrc) return el.currentSrc;
            const ifr = document.querySelector('iframe#video');
            return ifr ? ifr.src : null;
          });
          if (v && /^https?:/i.test(v) && MEDIA_RE.test(v) && !BAD_RE.test(v)) return v;
          if (source === 2) {
            const html = await jx.evaluate(() => document.documentElement.outerHTML);
            const m = html.match(/var Vurl\s*=\s*'([^']+)'/);
            if (m && /^https?:/i.test(m[1])) return m[1];
          }
        } catch (e) { /* frame 未就绪 */ }
      }
      await sleep(2000);
    }
    return (mediaUrl && MEDIA_RE.test(mediaUrl) && !BAD_RE.test(mediaUrl)) ? mediaUrl : null;
  } finally {
    if (browser) await browser.close();
  }
}

function callIdm(url, folder, filename) {
  const child = spawn(IDM, ['/n', '/d', url, '/p', folder, '/f', filename], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  return { status: 0 };
}

function getFfmpegTempPath(output) {
  return /\.mp4$/i.test(output) ? output.replace(/\.mp4$/i, '.part.mp4') : output + '.part';
}

function callFfmpeg(url, folder, filename, headers = {}) {
  const headerText = Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\r\n');
  const output = path.join(folder, filename);
  const tempOutput = getFfmpegTempPath(output);
  try { fs.rmSync(tempOutput, { force: true }); } catch (e) { /* 临时文件不存在 */ }
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  if (headerText) args.push('-headers', `${headerText}\r\n`);
  args.push('-i', url, '-c', 'copy', tempOutput);
  const result = spawnSync(FFMPEG, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: ATTEMPT_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });
  const stderr = (result.stderr || result.error?.message || '').trim();
  if (result.status !== 0) return { status: result.status, stderr };
  try {
    fs.renameSync(tempOutput, output);
    return { status: 0, stderr };
  } catch (e) {
    return { status: 1, stderr: `完成文件改名失败: ${e.message}` };
  }
}

function callAria2(url, folder, filename, headers = {}, isM3u8 = false) {
  const headerText = Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\r\n');
  const output = path.join(folder, filename);
  const tempOutput = getFfmpegTempPath(output);
  try { fs.rmSync(tempOutput, { force: true }); } catch (e) { /* 临时文件不存在 */ }
  const args = ['-x', '16', '-s', '16', '-k', '1M', '-c', '--no-conf', '--auto-file-renaming=false'];
  if (isM3u8) args.push('--hls-segment-threads=16');
  if (headerText) {
    for (const line of headerText.split('\r\n')) args.push('--header', line);
  }
  args.push('--dir', folder, '--out', path.basename(tempOutput), url);
  const result = spawnSync(ARIA2, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: ATTEMPT_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });
  const stderr = (result.stderr || result.error?.message || '').trim();
  if (result.status !== 0) return { status: result.status, stderr };
  try {
    fs.renameSync(tempOutput, output);
    return { status: 0, stderr };
  } catch (e) {
    return { status: 1, stderr: `完成文件改名失败: ${e.message}` };
  }
}

async function waitForFile(filePath, minSize, stableMs, timeoutMs) {
  const start = Date.now();
  let lastSize = -1, stableSince = Date.now();
  while (Date.now() - start < timeoutMs) {
    let size = 0;
    try { size = fs.statSync(filePath).size; } catch (e) { size = 0; }
    if (size >= minSize) {
      if (lastSize >= 0 && size === lastSize) {
        if (Date.now() - stableSince >= stableMs) return { ok: true, size };
      } else {
        stableSince = Date.now();
      }
    } else {
      stableSince = Date.now();
    }
    lastSize = size;
    await sleep(10000);
  }
  return { ok: false, size: lastSize };
}

function engineChain(selected, isM3u8, runMode) {
  if (isM3u8) return ['aria2', 'ffmpeg'];
  let chain;
  if (selected === 'idm') chain = ['idm', 'aria2', 'ffmpeg'];
  else if (selected === 'ffmpeg') chain = ['ffmpeg', 'aria2', 'idm'];
  else chain = ['aria2', 'ffmpeg'];
  if (runMode !== 'interactive') chain = chain.filter(e => e !== 'idm');
  return chain;
}

async function downloadEpisode(anime, ep, folderDir, deps = {}) {
  const resolvePlayUrl = deps.getPlayUrl || getPlayUrl;
  const startAria2 = deps.callAria2 || callAria2;
  const startFfmpeg = deps.callFfmpeg || callFfmpeg;
  const startIdm = deps.callIdm || callIdm;
  const waitForDownload = deps.waitForFile || waitForFile;
  const engine = deps.engine || 'aria2';
  const runMode = deps.runMode || process.env.AGE_RUN_MODE || (readTaskState() || {}).run_mode || 'interactive';
  const attemptTimeoutMs = deps.attemptTimeoutMs || ATTEMPT_TIMEOUT_MS;
  const fname = resolveFileName(anime, ep);
  if (fname.error) throw new Error(fname.error);
  const filename = fname.name;
  const finalPath = path.join(folderDir, filename);
  const existing = findEpisodeFile(folderDir, anime, ep);
  if (existing) {
    try {
      if (fs.statSync(existing).size >= MIN_SIZE) return { src: 0, skipped: true };
    } catch (e) { /* 文件消失则继续下载 */ }
  }
  let lastErr = null;
  for (const src of LINES) {
    const isPrimary = src === 1;
    const attemptName = isPrimary ? filename : filename.replace(/\.mp4$/, `_L${src}.mp4`);
    const attemptPath = path.join(folderDir, attemptName);
    try {
      const st = fs.statSync(attemptPath);
      if (st.size < MIN_SIZE) fs.renameSync(attemptPath, attemptPath + '.failed');
    } catch (e) { /* 无残留 */ }
    let url = null;
    try {
      url = await resolvePlayUrl(anime.site_id, ep, src);
      if (!url && src === 1) {
        progress(`  线路1 取址失败，5秒后重试一次`);
        await sleep(5000);
        url = await resolvePlayUrl(anime.site_id, ep, src);
      }
    } catch (e) {
      lastErr = e;
    }
    if (!url) {
      lastErr = new Error(`线路${src}取址失败`);
      progress(`  ${filename} 线路${src}: 取址失败`);
      continue;
    }
    const isM3u8 = /\.m3u8(?:[?#]|$)/i.test(url);
    const headers = {
      Referer: `${getBase()}/play/${anime.site_id}/${src}/${ep}`,
      'User-Agent': UA,
    };
    let engineOk = false;
    let res = null;
    let okEngineName = null;
    for (const engineName of engineChain(engine, isM3u8, runMode)) {
      const launch = engineName === 'aria2' ? startAria2 : engineName === 'ffmpeg' ? startFfmpeg : startIdm;
      progress(`  ${filename} 线路${src}: 交给 ${engineName} ${isM3u8 ? '(M3U8)' : '(MP4)'} ${url.slice(0, 100)}...`);
      const engineResult = launch(url, folderDir, attemptName, headers, isM3u8);
      if (engineResult && engineResult.status !== undefined && engineResult.status !== 0) {
        const detail = engineResult.stderr ? `: ${engineResult.stderr.slice(0, 300)}` : '';
        lastErr = new Error(`线路${src} ${engineName} 失败 exit=${engineResult.status}${detail}`);
        progress(`  ${filename} 线路${src}: ${engineName} 失败 exit=${engineResult.status}${detail}`);
        try { fs.renameSync(attemptPath, attemptPath + '.failed'); } catch (e) { /* 没有文件则忽略 */ }
        continue;
      }
      res = await waitForDownload(attemptPath, MIN_SIZE, STABLE_MS, attemptTimeoutMs);
      if (res.ok) {
        engineOk = true;
        okEngineName = engineName;
        break;
      }
      lastErr = new Error(`线路${src} ${engineName} 文件未完成 size=${res.size}`);
      progress(`  ${filename} 线路${src}: ${engineName} 未完成 size=${res.size}`);
      try { fs.renameSync(attemptPath, attemptPath + '.failed'); } catch (e) { /* 没有文件就不动 */ }
    }
    if (engineOk) {
      if (!isPrimary) fs.renameSync(attemptPath, finalPath);
      return { src, skipped: false, size: res.size, engine: okEngineName };
    }
  }
  throw lastErr || new Error('全部线路失败');
}

async function runPool(items, worker, poolSize) {
  const size = Math.max(1, Math.min(parseInt(poolSize, 10) || 1, items.length || 1));
  const results = new Array(items.length);
  let next = 0;
  async function runWorker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  const workers = [];
  for (let i = 0; i < size; i++) workers.push(runWorker());
  await Promise.all(workers);
  return results;
}

function renameFolder(oldPath, newPath) {
  const cmd = `Move-Item -LiteralPath '${oldPath}' -Destination '${newPath}'`;
  const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', cmd], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error('改名失败: ' + (r.stderr || r.stdout || ''));
}

function findFolderByTitle(title) {
  let dirs;
  try { dirs = fs.readdirSync(DLOAD, { withFileTypes: true }).filter(d => d.isDirectory()); } catch (e) { return null; }
  for (const d of dirs) {
    const p = parseFolderName(d.name);
    if (p && p.title === title) return { dir: path.join(DLOAD, d.name), prefix: p.prefix, title: p.title, start: p.start, end: p.end, name: d.name };
  }
  for (const d of dirs) {
    if (d.name === title) return { dir: path.join(DLOAD, d.name), prefix: '', title, start: 0, end: 0, name: d.name };
  }
  return null;
}

function findFolder(anime) {
  if (anime.folder_name) {
    const cur = resolveFolderName(anime, null, anime.downloaded_end || 0);
    if (cur.name) {
      let dirs;
      try { dirs = fs.readdirSync(DLOAD, { withFileTypes: true }).filter(d => d.isDirectory()); } catch (e) { dirs = []; }
      const hit = dirs.find(d => d.name === cur.name);
      if (hit) return { dir: path.join(DLOAD, hit.name), prefix: '', title: anime.title, start: anime.downloaded_start || 0, end: anime.downloaded_end || 0, name: hit.name };
    }
  }
  return findFolderByTitle(anime.title);
}

function getEpisodeFileMatcher(anime) {
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const S = '\u0000';
  const matchers = [];
  if (anime && anime.file_name) {
    try {
      const raw = anime.file_name
        .replace(/\{name\}/g, S + 'NAME' + S)
        .replace(/\{start\}/g, S + 'START' + S)
        .replace(/\{end\}/g, S + 'END' + S)
        .replace(/\{ep\}/g, S + 'EP' + S);
      const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = '^' + escaped
        .replace(new RegExp(S + 'NAME' + S, 'g'), esc(anime.title))
        .replace(new RegExp(S + 'START' + S, 'g'), '\\d+')
        .replace(new RegExp(S + 'END' + S, 'g'), '\\d+')
        .replace(new RegExp(S + 'EP' + S, 'g'), '(\\d+)') + '$';
      const rx = new RegExp(re, 'i');
      matchers.push(name => {
        const m = name.match(rx);
        return m ? parseInt(m[1], 10) : null;
      });
    } catch (e) { /* 非法模板由 resolveFileName 拦截 */ }
  }
  matchers.push(name => {
    if (/\.failed$/i.test(name) || /\.part\.mp4$/i.test(name) || /_L\d+\.mp4$/i.test(name)) return null;
    const m = name.match(/第(\d+)集/);
    return m ? parseInt(m[1], 10) : null;
  });
  return name => {
    for (const fn of matchers) {
      const ep = fn(name);
      if (ep !== null && ep !== undefined) return ep;
    }
    return null;
  };
}

function countEpisodeFiles(dir, anime) {
  try {
    const matcher = getEpisodeFileMatcher(anime || {});
    const eps = new Set();
    for (const n of fs.readdirSync(dir)) {
      const ep = matcher(n);
      if (ep !== null && ep !== undefined) eps.add(ep);
    }
    return eps.size;
  } catch (e) {
    return -1;
  }
}

function findEpisodeFile(dir, anime, ep) {
  try {
    const matcher = getEpisodeFileMatcher(anime);
    for (const n of fs.readdirSync(dir)) {
      if (matcher(n) === ep) return path.join(dir, n);
    }
  } catch (e) { /* 目录不可读返回 null */ }
  return null;
}

function safeRenameFolder(oldPath, newPath) {
  if (oldPath === newPath) return { ok: true, error: null };
  if (fs.existsSync(newPath)) return { ok: false, error: `目标文件夹已存在: ${path.basename(newPath)}` };
  try {
    renameFolder(oldPath, newPath);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

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

function installTask() {
  let content;
  try {
    content = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  } catch (e) {
    throw new Error('content.json 无法解析: ' + e.message);
  }
  const time = normalizeTime(content.fetch_time) || '18:00';
  const node = process.execPath;
  const script = path.join(WORK, 'anime_updater.js');
  const tr = `"${node}" "${script}"`;
  const args = ['/create', '/tn', 'AGEAnimeUpdater', '/tr', tr, '/sc', 'daily', '/st', time, '/f'];
  const user = process.env.AGE_TASK_USER;
  const pass = process.env.AGE_TASK_PASS;
  const state = readTaskState() || {};
  if (state.run_mode === 'password' && !(user && pass)) {
    blocked('计划任务处于密码模式，重装需要 AGE_TASK_USER/AGE_TASK_PASS，否则会降级为仅登录运行');
    return 1;
  }
  if (user && pass) args.push('/ru', user, '/rp', pass);
  const r = spawnSync('schtasks.exe', args, { encoding: 'utf8', windowsHide: true });
  if (r.status === 0) fs.writeFileSync(TASK_STATE, JSON.stringify({ fetch_time: time, run_mode: (user && pass) ? 'password' : 'interactive' }, null, 2) + '\n', 'utf8');
  progress(`计划任务安装: ${(r.stdout || r.stderr || '').trim()} (exit=${r.status})`);
  return r.status;
}

function normalizeTime(t) {
  if (!t) return null;
  const m = String(t).match(/(\d{1,2}:\d{2})(?::\d{2})?/);
  return m ? m[1] : null;
}

function readTaskState() {
  try {
    return JSON.parse(fs.readFileSync(TASK_STATE, 'utf8'));
  } catch (e) {
    return null;
  }
}

function syncTask(content) {
  const desired = normalizeTime((content && content.fetch_time) || '18:00') || '18:00';
  const q = spawnSync('schtasks.exe', ['/query', '/tn', 'AGEAnimeUpdater'], { encoding: 'utf8', windowsHide: true });
  const taskExists = q.status === 0;
  const state = readTaskState() || {};
  const runMode = state.run_mode || 'interactive';
  if (taskExists && state.fetch_time === desired) {
    progress(`计划任务时间无需变更（${desired}）`);
    return true;
  }
  const user = process.env.AGE_TASK_USER;
  const pass = process.env.AGE_TASK_PASS;
  if (runMode === 'password' && !(user && pass)) {
    blocked('计划任务为密码模式，自动改时间需提供 AGE_TASK_USER/AGE_TASK_PASS，或手动运行 --install-task');
    return false;
  }
  const node = process.execPath;
  const script = path.join(WORK, 'anime_updater.js');
  const tr = `"${node}" "${script}"`;
  const args = ['/create', '/tn', 'AGEAnimeUpdater', '/tr', tr, '/sc', 'daily', '/st', desired, '/f'];
  if (user && pass) args.push('/ru', user, '/rp', pass);
  const r = spawnSync('schtasks.exe', args, { encoding: 'utf8', windowsHide: true });
  const ok = r.status === 0;
  if (ok) fs.writeFileSync(TASK_STATE, JSON.stringify({ fetch_time: desired, run_mode: (user && pass) ? 'password' : 'interactive' }, null, 2) + '\n', 'utf8');
  progress(`计划任务时间同步: ${taskExists ? '重建为 ' + desired : '新建为 ' + desired} (exit=${r.status})`);
  return ok;
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
  const runMode = deps.runMode || process.env.AGE_RUN_MODE || (readTaskState() || {}).run_mode || 'interactive';
  const attemptTimeoutMinRaw = parseInt(defaults.attempt_timeout_min, 10);
  const attemptTimeoutMin = Number.isFinite(attemptTimeoutMinRaw) && attemptTimeoutMinRaw >= 5 && attemptTimeoutMinRaw <= 60 ? attemptTimeoutMinRaw : 20;
  const attemptTimeoutMs = attemptTimeoutMin * 60 * 1000;
  let changed = false;

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
  const missing = [...missingSet].filter(ep => ep <= maxEp).sort((a, b) => a - b);
  if (missing.length === 0) {
    progress(`${title}: 无新集（downloaded_end=${end}，站内 ${maxEp}）`);
    return { changed };
  }
  for (const ep of missing) rows.push({ title, ep, url: `${getBase()}/play/${anime.site_id}/1/${ep}` });
  progress(`${title}: 站内最新 ${maxEp}，本次下载 ${missing.join(',')}（downloaded_end=${end}${maxPerRun > 0 ? `，单次上限 ${maxPerRun}` : ''}${maxParallel > 1 ? `，并发 ${maxParallel}` : ''}）`);
  if (dryRun) return { changed };

  if (engine === 'idm' && runMode === 'interactive') await ensureIdmMinimized();
  const results = await runPool(missing, async ep => {
    try {
      const fname = resolveFileName(anime, ep);
      if (fname.error) throw new Error(fname.error);
      const r = await processDownload(anime, ep, folder.dir, { engine, runMode, attemptTimeoutMs });
      progress(`${title} 第${ep}集: 完成${r.skipped ? '（已存在）' : `（线路${r.src}，${r.size} 字节）`}`);
      return { ok: true, r };
    } catch (e) {
      blocked(`${title} 第${ep}集: 下载失败 ${e.message}`);
      return { ok: false, error: e.message };
    }
  }, maxParallel);
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
        deps,
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
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (process.argv.includes('--install-task')) {
    try {
      const st = installTask();
      process.exitCode = st === 0 ? 0 : 1;
    } catch (e) {
      console.error('FATAL', e);
      process.exitCode = 1;
    }
    return;
  }
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

  try {
    syncTask(content);
  } catch (e) {
    blocked('计划任务同步失败: ' + e.message);
  }

  await processAllAnime(content, { dryRun });
}

module.exports = { searchSite, parseFolderName, applyTemplate, validName, resolveFolderName, resolveFileName, renameFolder, safeRenameFolder, getEpisodeFileMatcher, countEpisodeFiles, findEpisodeFile, planDownloadRange, findMissingEps, resolveDownloadedStart, computeNewEnd, getBase, engineChain, getCsvPath, getFfmpegPath, getAria2Path, getFfmpegTempPath, formatLogTime, isIdmRunning, ensureIdmMinimized, idmHasActivity, closeIdmIfIdle, blocked, progress, getMaxEp, getPlayUrl, callIdm, callFfmpeg, callAria2, fetchText, runPool, processOneAnime, processAllAnime, waitForFile, downloadEpisode, findFolder, findFolderByTitle, normalizeTime, syncTask, readTaskState, writeCsv };

if (require.main === module) {
  main().catch(e => {
    console.error('FATAL', e);
    process.exitCode = 1;
  });
}
