const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

function callIdm(url, folder, filename, deps = {}) {
  const child = (deps.spawn || spawn)(deps.idmPath, ['/n', '/d', url, '/p', folder, '/f', filename], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  return { status: 0 };
}
function getFfmpegTempPath(output) { return /\.mp4$/i.test(output) ? output.replace(/\.mp4$/i, '.part.mp4') : output + '.part'; }
function getMediaDurationSeconds(file, run = spawnSync, ffmpegPath) {
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
  const result = (deps.spawnSync || spawnSync)(deps.ffmpegPath, args, { encoding: 'utf8', windowsHide: true, timeout: deps.timeoutMs || 45 * 60 * 1000, maxBuffer: 1024 * 1024 });
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
  const result = (deps.spawnSync || spawnSync)(deps.aria2Path, args, { encoding: 'utf8', windowsHide: true, timeout: deps.timeoutMs || 45 * 60 * 1000, maxBuffer: 1024 * 1024 });
  return { status: result.status, stderr: (result.stderr || result.error?.message || '').trim() };
}
async function waitForFile(filePath, minSize, stableMs, timeoutMs) {
  const start = Date.now(); let lastSize = -1; let stableSince = 0;
  while (Date.now() - start < timeoutMs) { try { const size = fs.statSync(filePath).size; if (size >= minSize) { if (size === lastSize) { if (!stableSince) stableSince = Date.now(); if (Date.now() - stableSince >= stableMs) return { ok: true, size }; } else { lastSize = size; stableSince = 0; } } } catch (e) {} await new Promise(r => setTimeout(r, 2000)); }
  let size = 0; try { size = fs.statSync(filePath).size; } catch (e) {} return { ok: false, size };
}
function engineChain(selected, isM3u8, runMode) { let chain = isM3u8 ? ['ffmpeg'] : selected === 'idm' ? ['idm', 'aria2', 'ffmpeg'] : selected === 'ffmpeg' ? ['ffmpeg', 'aria2', 'idm'] : ['aria2', 'ffmpeg']; return runMode !== 'interactive' ? chain.filter(e => e !== 'idm') : chain; }
async function runPool(items, worker, poolSize) { const size = Math.max(1, Math.min(parseInt(poolSize, 10) || 1, items.length || 1)); const results = new Array(items.length); let next = 0; async function runWorker() { while (next < items.length) { const index = next++; results[index] = await worker(items[index], index); } } await Promise.all(Array.from({ length: size }, runWorker)); return results; }
module.exports = { callIdm, getFfmpegTempPath, getMediaDurationSeconds, isDurationPlausible, chooseRecoverablePart, callFfmpeg, callAria2, waitForFile, engineChain, runPool };
