'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { acquireFolderRenameLock } = require('./folder-rename-lock.js');

const BAD_NAME_RE = /[\/\\:*?"<>|]/;

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
    .replace(/\{ep\}/g, String(vars.ep).padStart(2, '0'))
    .replace(/\{watched\}/g, String(vars.watched ?? 0));
}

function matchFolderTemplate(tpl, folderName, title) {
  if (typeof tpl !== 'string' || typeof folderName !== 'string' || typeof title !== 'string') return null;
  const tokens = [];
  const marker = /\{(name|start|end|ep|watched)\}/g;
  const esc = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let pattern = '^';
  let cursor = 0;
  let match;
  while ((match = marker.exec(tpl))) {
    pattern += esc(tpl.slice(cursor, match.index));
    if (match[1] === 'name') pattern += esc(title);
    else {
      pattern += '(\\d+)';
      tokens.push(match[1]);
    }
    cursor = match.index + match[0].length;
  }
  pattern += esc(tpl.slice(cursor)) + '$';
  let values;
  try { values = folderName.match(new RegExp(pattern)); } catch (e) { return null; }
  if (!values) return null;
  const result = { name: title };
  tokens.forEach((token, index) => { result[token] = parseInt(values[index + 1], 10); });
  if (result.end !== undefined && result.ep === undefined) result.ep = result.end;
  return result;
}

function validName(name) {
  return typeof name === 'string' && name.length > 0 && !BAD_NAME_RE.test(name);
}

function resolveFolderName(anime, folderInfo, end) {
  const start = (anime.downloaded_start !== undefined && anime.downloaded_start !== null) ? anime.downloaded_start : 0;
  if (anime.folder_name) {
    const watched = folderInfo && Number.isInteger(folderInfo.watched) ? folderInfo.watched : 0;
    const name = applyTemplate(anime.folder_name, { name: anime.title, start, end, ep: end, watched });
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

function renameWithRetrySync(oldPath, newPath, options = {}) {
  const rename = options.rename || fs.renameSync;
  const wait = options.wait || (ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms));
  const attempts = options.attempts || 20;
  const delayMs = options.delayMs || 500;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      rename(oldPath, newPath);
      return;
    } catch (error) {
      if (!['EPERM', 'EBUSY'].includes(error.code) || attempt === attempts) throw error;
      wait(delayMs);
    }
  }
}

function renameFolder(oldPath, newPath) {
  fs.renameSync(oldPath, newPath);
}

function getDownloadRoot(options = {}) {
  return options.downloadRoot || process.env.AGE_DLOAD || 'D:\\idm下载';
}

function findFolderByTitle(title, options = {}) {
  const downloadRoot = getDownloadRoot(options);
  let dirs;
  try { dirs = fs.readdirSync(downloadRoot, { withFileTypes: true }).filter(d => d.isDirectory()); } catch (e) { return null; }
  for (const d of dirs) {
    const p = parseFolderName(d.name);
    if (p && p.title === title) return { dir: path.join(downloadRoot, d.name), prefix: p.prefix, title: p.title, start: p.start, end: p.end, name: d.name };
  }
  for (const d of dirs) {
    if (d.name === title) return { dir: path.join(downloadRoot, d.name), prefix: '', title, start: 0, end: 0, name: d.name };
  }
  return null;
}

function findFolder(anime, options = {}) {
  const downloadRoot = getDownloadRoot(options);
  if (anime.folder_name) {
    let dirs;
    try { dirs = fs.readdirSync(downloadRoot, { withFileTypes: true }).filter(d => d.isDirectory()); } catch (e) { dirs = []; }
    const hits = dirs.map(d => ({ dirent: d, values: matchFolderTemplate(anime.folder_name, d.name, anime.title) })).filter(x => x.values);
    if (hits.length > 1) throw new Error(`${anime.title}: folder_name 匹配到多个目录，拒绝猜测`);
    if (hits.length === 1) {
      const hit = hits[0];
      return Object.assign({
        dir: path.join(downloadRoot, hit.dirent.name),
        prefix: '',
        title: anime.title,
        name: hit.dirent.name,
      }, hit.values);
    }
    if ((anime.folder_name.match(/\{watched\}/g) || []).length === 1 && findFolderByTitle(anime.title, options)) {
      throw new Error(`${anime.title}: 检测到旧目录但新模板尚未匹配，请先dry-run核对并手动迁移`);
    }
    return null;
  }
  return findFolderByTitle(anime.title, options);
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

function safeRenameFolder(oldPath, newPath, options = {}) {
  if (oldPath === newPath) return { ok: true, error: null };
  const lockPath = options.lockPath || path.join(__dirname, '..', 'local', 'mpv-watched-prefix', 'folder-rename.lock');
  const lock = acquireFolderRenameLock({ lockPath, actor: 'anime-updater' });
  if (!lock.ok) return { ok: false, error: `文件夹改名锁不可用: ${lock.reason}` };
  try {
    if (!fs.existsSync(oldPath)) return { ok: false, error: `原文件夹不存在: ${path.basename(oldPath)}` };
    if (fs.existsSync(newPath)) return { ok: false, error: `目标文件夹已存在: ${path.basename(newPath)}` };
    renameFolder(oldPath, newPath);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.release();
  }
}

module.exports = {
  parseFolderName,
  applyTemplate,
  matchFolderTemplate,
  validName,
  resolveFolderName,
  resolveFileName,
  renameFolder,
  renameWithRetrySync,
  getEpisodeFileMatcher,
  findFolderByTitle,
  findFolder,
  countEpisodeFiles,
  findEpisodeFile,
  safeRenameFolder,
};
