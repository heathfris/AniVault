const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

function callIdm(url, folder, filename, deps = {}) {
  const child = (deps.spawn || spawn)(deps.idmPath || 'IDMan.exe', ['/n', '/d', url, '/p', folder, '/f', filename], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  return { status: 0 };
}
function getFfmpegTempPath(output) { return /\.mp4$/i.test(output) ? output.replace(/\.mp4$/i, '.part.mp4') : output + '.part'; }
function getMediaDurationSeconds(file, run = spawnSync, ffmpegPath = 'ffmpeg.exe') {
  const result = run(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8', windowsHide: true, timeout: 30 * 1000, maxBuffer: 1024 * 1024 });
  const match = String(result.stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : 0;
}
function isDurationPlausible(duration, referenceDuration) { return duration > 0 && (!referenceDuration || duration >= referenceDuration * 0.8); }
function chooseRecoverablePart(candidates, referenceDuration, minSize = 100 * 1024 * 1024) {
  const valid = candidates.filter(item => item.size >= minSize && isDurationPlausible(item.duration, referenceDuration));
  valid.sort((a, b) => b.duration - a.duration);
  return valid[0] || null;
}
function callFfmpeg(url, folder, filename, headers = {}, deps = {}) {
  const headerText = Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\r\n');
  const output = path.join(folder, filename); const tempOutput = getFfmpegTempPath(output);
  try { fs.rmSync(tempOutput, { force: true }); } catch (e) {}
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  if (headerText) args.push('-headers', `${headerText}\r\n`);
  args.push('-i', url, '-c', 'copy', tempOutput);
  const result = (deps.spawnSync || spawnSync)(deps.ffmpegPath || 'ffmpeg.exe', args, { encoding: 'utf8', windowsHide: true, timeout: deps.timeoutMs || 45 * 60 * 1000, maxBuffer: 1024 * 1024 });
  const stderr = (result.stderr || result.error?.message || '').trim();
  if (result.status !== 0) return { status: result.status, stderr };
  try { (deps.renameWithRetrySync || ((a, b) => fs.renameSync(a, b)))(tempOutput, output); return { status: 0, stderr }; }
  catch (e) { return { status: 1, stderr: `完成文件改名失败: ${e.message}` }; }
}
function callAria2(url, folder, filename, headers = {}, deps = {}) {
  const headerText = Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\r\n');
  const output = path.join(folder, filename); const tempOutput = getFfmpegTempPath(output);
  try { fs.rmSync(tempOutput, { force: true }); } catch (e) {}
  const args = ['-x', '16', '-s', '16', '-k', '1M', '-c', '--no-conf', '--auto-file-renaming=false'];
  if (headerText) args.push('--header', headerText);
  args.push('-d', folder, '-o', path.basename(tempOutput), url);
  const result = (deps.spawnSync || spawnSync)(deps.aria2Path || 'aria2c.exe', args, { encoding: 'utf8', windowsHide: true, timeout: deps.timeoutMs || 45 * 60 * 1000, maxBuffer: 1024 * 1024 });
  const stderr = (result.stderr || result.error?.message || '').trim();
  if (result.status !== 0) return { status: result.status, stderr };
  try { (deps.renameWithRetrySync || ((a, b) => fs.renameSync(a, b)))(tempOutput, output); return { status: 0, stderr }; }
  catch (e) { return { status: 1, stderr: `完成文件改名失败: ${e.message}` }; }
}
async function waitForFile(filePath, minSize, stableMs, timeoutMs) {
  const start = Date.now(); let lastSize = -1; let stableSince = 0;
  while (Date.now() - start < timeoutMs) { try { const size = fs.statSync(filePath).size; if (size >= minSize) { if (lastSize >= 0 && size === lastSize) { if (Date.now() - stableSince >= stableMs) return { ok: true, size }; } else { stableSince = Date.now(); } } else { stableSince = Date.now(); } lastSize = size; } catch (e) { lastSize = 0; stableSince = Date.now(); } await new Promise(r => setTimeout(r, 10000)); }
  let size = 0; try { size = fs.statSync(filePath).size; } catch (e) {} return { ok: false, size };
}
function engineChain(selected, isM3u8, runMode) { let chain = isM3u8 ? ['ffmpeg'] : selected === 'idm' ? ['idm', 'aria2', 'ffmpeg'] : selected === 'ffmpeg' ? ['ffmpeg', 'aria2', 'idm'] : ['aria2', 'ffmpeg']; return runMode !== 'interactive' ? chain.filter(e => e !== 'idm') : chain; }
async function runPool(items, worker, poolSize) { const size = Math.max(1, Math.min(parseInt(poolSize, 10) || 1, items.length || 1)); const results = new Array(items.length); let next = 0; async function runWorker() { while (next < items.length) { const index = next++; results[index] = await worker(items[index], index); } } await Promise.all(Array.from({ length: size }, runWorker)); return results; }

async function downloadEpisode(anime, ep, folderDir, deps = {}) {
  const fsImpl = deps.fs || fs;
  const resolveFileName = deps.resolveFileName || (() => ({ name: `${anime.title}_${String(ep).padStart(2, '0')}.mp4` }));
  const findEpisodeFile = deps.findEpisodeFile || (() => null);
  const renameCompleted = deps.renameWithRetrySync || ((a, b) => fsImpl.renameSync(a, b));
  const durationOf = deps.getMediaDurationSeconds || (file => getMediaDurationSeconds(file, deps.spawnSync || spawnSync, deps.ffmpegPath));
  const plausible = deps.isDurationPlausible || isDurationPlausible;
  const recover = deps.chooseRecoverablePart || chooseRecoverablePart;
  const tempPath = deps.getFfmpegTempPath || getFfmpegTempPath;
  const resolvePlayUrl = deps.getPlayUrl || (async () => null);
  const startAria2 = deps.callAria2 || ((url, dir, name, headers) => callAria2(url, dir, name, headers, deps));
  const startFfmpeg = deps.callFfmpeg || ((url, dir, name, headers) => callFfmpeg(url, dir, name, headers, deps));
  const startIdm = deps.callIdm || ((url, dir, name) => callIdm(url, dir, name, deps));
  const waitForDownload = deps.waitForFile || waitForFile;
  const progress = deps.progress || (() => {});
  const sleepFn = deps.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const lines = deps.lines || [1, 2, 3, 4, 5];
  const minSize = deps.minSize || 100 * 1024 * 1024;
  const stableMs = deps.stableMs || 120 * 1000;
  const attemptTimeoutMs = deps.attemptTimeoutMs || 45 * 60 * 1000;
  const engine = deps.engine || 'aria2';
  const runMode = deps.runMode || 'interactive';
  const getBase = deps.getBase || (() => 'https://www.agedm.io');
  const userAgent = deps.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const fname = resolveFileName(anime, ep);
  if (fname.error) throw new Error(fname.error);
  const filename = fname.name; const finalPath = path.join(folderDir, filename);
  const previous = ep > 1 ? findEpisodeFile(folderDir, anime, ep - 1) : null;
  const referenceDuration = previous ? durationOf(previous) : 0;
  const existing = findEpisodeFile(folderDir, anime, ep);
  if (existing) { try { if (fsImpl.statSync(existing).size >= minSize && (!referenceDuration || plausible(durationOf(existing), referenceDuration))) return { src: 0, skipped: true }; } catch (e) {} }
  if (!existing) {
    const candidates = [];
    for (const src of lines) { const attemptName = src === 1 ? filename : filename.replace(/\.mp4$/, `_L${src}.mp4`); const partPath = tempPath(path.join(folderDir, attemptName)); try { const stat = fsImpl.statSync(partPath); candidates.push({ path: partPath, size: stat.size, duration: durationOf(partPath) }); } catch (e) {} }
    const recovered = recover(candidates, referenceDuration, minSize);
    if (recovered) { renameCompleted(recovered.path, finalPath); progress(`  ${filename}: 复用完整临时文件，避免重复下载`); return { src: 0, skipped: true, recovered: true, size: recovered.size }; }
  }
  let lastErr = null;
  for (const src of lines) {
    const isPrimary = src === 1; const attemptName = isPrimary ? filename : filename.replace(/\.mp4$/, `_L${src}.mp4`); const attemptPath = path.join(folderDir, attemptName);
    try { const st = fsImpl.statSync(attemptPath); if (st.size < minSize) fsImpl.renameSync(attemptPath, attemptPath + '.failed'); } catch (e) {}
    let url = null;
    try { url = await resolvePlayUrl(anime.site_id, ep, src, deps.browserPool); if (!url && src === 1) { progress('  线路1 取址失败，5秒后重试一次'); await sleepFn(5000); url = await resolvePlayUrl(anime.site_id, ep, src, deps.browserPool); } } catch (e) { lastErr = e; }
    if (!url) { lastErr = new Error(`线路${src}取址失败`); progress(`  ${filename} 线路${src}: 取址失败`); continue; }
    const isM3u8 = /\.m3u8(?:[?#]|$)/i.test(url); const headers = { Referer: `${getBase()}/play/${anime.site_id}/${src}/${ep}`, 'User-Agent': userAgent };
    let engineOk = false; let res = null; let okEngineName = null;
    for (const engineName of engineChain(engine, isM3u8, runMode)) {
      const launch = engineName === 'aria2' ? startAria2 : engineName === 'ffmpeg' ? startFfmpeg : startIdm;
      progress(`  ${filename} 线路${src}: 交给 ${engineName} ${isM3u8 ? '(M3U8)' : '(MP4)'} ${url.slice(0, 100)}...`);
      const engineResult = launch(url, folderDir, attemptName, headers, isM3u8);
      if (engineResult && engineResult.status !== undefined && engineResult.status !== 0) { const detail = engineResult.stderr ? `: ${engineResult.stderr.slice(0, 300)}` : ''; lastErr = new Error(`线路${src} ${engineName} 失败 exit=${engineResult.status}${detail}`); progress(`  ${filename} 线路${src}: ${engineName} 失败 exit=${engineResult.status}${detail}`); try { fsImpl.renameSync(attemptPath, attemptPath + '.failed'); } catch (e) {} continue; }
      res = await waitForDownload(attemptPath, minSize, stableMs, attemptTimeoutMs); const durationOk = res.ok && (!referenceDuration || plausible(durationOf(attemptPath), referenceDuration));
      if (durationOk) { engineOk = true; okEngineName = engineName; break; }
      const detail = res.ok ? '时长明显不足' : `size=${res.size}`; lastErr = new Error(`线路${src} ${engineName} 文件未完成 ${detail}`); progress(`  ${filename} 线路${src}: ${engineName} 未完成 ${detail}`); try { fsImpl.renameSync(attemptPath, attemptPath + '.failed'); } catch (e) {}
    }
    if (engineOk) { if (!isPrimary) renameCompleted(attemptPath, finalPath); return { src, skipped: false, size: res.size, engine: okEngineName }; }
  }
  throw lastErr || new Error('全部线路失败');
}

module.exports = { callIdm, getFfmpegTempPath, getMediaDurationSeconds, isDurationPlausible, chooseRecoverablePart, callFfmpeg, callAria2, waitForFile, engineChain, downloadEpisode, runPool };
