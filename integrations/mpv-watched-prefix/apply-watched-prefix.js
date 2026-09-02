'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  applyTemplate,
  getEpisodeFileMatcher,
  matchFolderTemplate,
} = require('../../anime_updater.js');
const { acquireFolderRenameLock } = require('../../src/folder-rename-lock.js');
const { appendRotated } = require('../../src/logutil.js');

function emptyState() {
  return { v: 1, files: {}, sessions: {} };
}

function normalizeState(input) {
  const state = input && input.v === 1 ? JSON.parse(JSON.stringify(input)) : emptyState();
  if (!state.files || typeof state.files !== 'object') state.files = {};
  if (!state.sessions || typeof state.sessions !== 'object') state.sessions = {};
  return state;
}

function eventKey(event) {
  return [event.anime_key, event.relative_path, event.size, event.mtime].join('\u0000');
}

function validEvent(event) {
  return event && event.v === 1
    && Number.isInteger(event.seq) && event.seq > 0
    && typeof event.anime_key === 'string' && event.anime_key
    && typeof event.relative_path === 'string' && event.relative_path
    && Number.isFinite(event.size) && Number.isFinite(event.mtime)
    && Number.isFinite(event.duration) && event.duration > 0
    && Number.isFinite(event.eligible_delta) && event.eligible_delta >= 0
    && Number.isFinite(event.time_pos) && event.time_pos >= 0
    && Number.isInteger(event.episode) && event.episode >= 0;
}

function mergeEvents(inputState, sessionName, events) {
  const state = normalizeState(inputState);
  const session = state.sessions[sessionName] || { committed_seq: 0 };
  const qualified = [];
  for (const event of [...events].sort((a, b) => a.seq - b.seq)) {
    if (!validEvent(event) || event.seq <= session.committed_seq) continue;
    const key = eventKey(event);
    const file = state.files[key] || {
      anime_key: event.anime_key,
      relative_path: event.relative_path,
      size: event.size,
      mtime: event.mtime,
      eligible_seconds: 0,
      max_time_pos: 0,
    };
    file.eligible_seconds += event.eligible_delta;
    file.max_time_pos = Math.max(file.max_time_pos, event.time_pos);
    const eligibleThreshold = event.duration * 0.45;
    const positionThreshold = event.duration * 0.9;
    if (file.eligible_seconds >= eligibleThreshold && file.max_time_pos >= positionThreshold) {
      qualified.push({ anime_key: event.anime_key, episode: event.episode, seq: event.seq });
      file.eligible_seconds -= eligibleThreshold;
      file.max_time_pos = 0;
    }
    state.files[key] = file;
    session.committed_seq = event.seq;
  }
  state.sessions[sessionName] = session;
  return { state, qualified };
}

function directoriesForAnime(downloadRoot, animeKey, anime) {
  if (!anime || typeof anime.folder_name !== 'string') return [];
  if ((anime.folder_name.match(/\{watched\}/g) || []).length !== 1) return [];
  let entries;
  try { entries = fs.readdirSync(downloadRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()); } catch (_) { return []; }
  return entries.map(entry => ({
    name: entry.name,
    path: path.join(downloadRoot, entry.name),
    values: matchFolderTemplate(anime.folder_name, entry.name, animeKey),
  })).filter(item => item.values);
}

function applyQualifiedRenames(options) {
  const { downloadRoot, config, qualified } = options;
  const lastByAnime = new Map();
  for (const item of qualified || []) lastByAnime.set(item.anime_key, item);
  for (const item of lastByAnime.values()) {
    const anime = config && config.anime && config.anime[item.anime_key];
    const hits = directoriesForAnime(downloadRoot, item.anime_key, anime);
    if (hits.length !== 1) return { ok: false, error: `${item.anime_key}: 目录匹配数为${hits.length}` };
    const current = hits[0];
    const start = current.values.start ?? anime.downloaded_start ?? 0;
    const end = current.values.end ?? anime.downloaded_end ?? 0;
    if (item.episode < start || item.episode > end) return { ok: false, error: `${item.anime_key}: 集数${item.episode}超出${start}-${end}` };
    const targetName = applyTemplate(anime.folder_name, {
      name: item.anime_key,
      start,
      end,
      ep: end,
      watched: item.episode,
    });
    const targetPath = path.join(downloadRoot, targetName);
    if (current.path === targetPath) continue;
    if (fs.existsSync(targetPath)) return { ok: false, error: `${item.anime_key}: 目标文件夹已存在 ${targetName}` };
    try { fs.renameSync(current.path, targetPath); } catch (error) {
      return { ok: false, error: `${item.anime_key}: 改名失败 ${error.message}` };
    }
  }
  return { ok: true, error: null };
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function readJsonLines(file) {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).flatMap(line => {
      try { return [JSON.parse(line)]; } catch (_) { return []; }
    });
  } catch (_) { return []; }
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}

function enrichEvents(rawEvents, config, downloadRoot) {
  const animeEntries = Object.entries((config && config.anime) || {});
  return rawEvents.flatMap(event => {
    if (validEvent(event)) return [event];
    if (!event || typeof event.path !== 'string') return [];
    const parentName = path.basename(path.dirname(event.path));
    const matches = animeEntries.flatMap(([animeKey, anime]) => {
      const values = matchFolderTemplate(anime.folder_name, parentName, animeKey);
      return values && (anime.folder_name.match(/\{watched\}/g) || []).length === 1
        ? [{ animeKey, anime, values }]
        : [];
    });
    if (matches.length !== 1) return [];
    const match = matches[0];
    const episode = getEpisodeFileMatcher(Object.assign({ title: match.animeKey }, match.anime))(path.basename(event.path));
    if (!Number.isInteger(episode)) return [];
    return [Object.assign({}, event, {
      anime_key: match.animeKey,
      relative_path: path.relative(path.join(downloadRoot, parentName), event.path),
      episode,
    })];
  });
}

function runSession(options) {
  const stateDir = options.stateDir;
  const sessionFile = options.sessionFile;
  const contentFile = options.contentFile;
  const downloadRoot = options.downloadRoot;
  const logFile = path.join(stateDir, 'watched-prefix.log');
  const stateFile = path.join(stateDir, 'state.json');
  const config = readJson(contentFile, null);
  if (!config) return { ok: false, error: 'content.json不可读' };
  let sessionFiles = [];
  try {
    sessionFiles = fs.readdirSync(stateDir)
      .filter(name => /^session-.*\.jsonl$/i.test(name))
      .map(name => path.join(stateDir, name));
  } catch (_) { /* stateDir existence is checked by the lock path creation below */ }
  if (!sessionFiles.includes(sessionFile)) sessionFiles.push(sessionFile);
  const queued = sessionFiles.flatMap(file => {
    let fileTime = 0;
    try { fileTime = fs.statSync(file).mtimeMs; } catch (_) { /* unreadable sessions add no events */ }
    return enrichEvents(readJsonLines(file), config, downloadRoot).map(event => ({
      event,
      sessionName: path.basename(file),
      time: Date.parse(event.at || '') || fileTime,
    }));
  }).sort((a, b) => a.time - b.time || a.event.seq - b.event.seq || a.sessionName.localeCompare(b.sessionName));
  let workingState = readJson(stateFile, emptyState());
  const qualified = [];
  for (const item of queued) {
    const mergedOne = mergeEvents(workingState, item.sessionName, [item.event]);
    workingState = mergedOne.state;
    qualified.push(...mergedOne.qualified);
  }
  const merged = { state: workingState, qualified };
  const lock = acquireFolderRenameLock({ lockPath: path.join(stateDir, 'folder-rename.lock'), actor: 'mpv-watched-prefix' });
  if (!lock.ok) return { ok: false, error: `改名锁不可用: ${lock.reason}` };
  try {
    const result = applyQualifiedRenames({ downloadRoot, config, qualified: merged.qualified });
    if (!result.ok) {
      appendRotated(logFile, `${new Date().toISOString()} BLOCKED ${result.error}`);
      return result;
    }
    atomicWriteJson(stateFile, merged.state);
    appendRotated(logFile, `${new Date().toISOString()} OK session=${path.basename(sessionFile)} qualified=${merged.qualified.length}`);
    return { ok: true, qualified: merged.qualified };
  } finally {
    lock.release();
  }
}

async function waitForPid(pid, timeoutMs = 60000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    let alive = true;
    try { process.kill(pid, 0); } catch (error) { alive = error && error.code !== 'ESRCH'; }
    if (!alive) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

async function main(argv) {
  const args = Object.fromEntries(argv.slice(2).map(value => {
    const index = value.indexOf('=');
    return index < 0 ? [value, true] : [value.slice(0, index), value.slice(index + 1)];
  }));
  const pid = Number(args['--pid']);
  if (Number.isInteger(pid) && !(await waitForPid(pid))) throw new Error('等待mpv退出超时');
  const projectRoot = path.resolve(args['--project-root'] || path.join(__dirname, '..', '..'));
  const stateDir = path.resolve(args['--state-dir'] || path.join(projectRoot, 'local', 'mpv-watched-prefix'));
  const sessionFile = path.resolve(args['--session']);
  const result = runSession({
    stateDir,
    sessionFile,
    contentFile: path.join(projectRoot, 'content.json'),
    downloadRoot: args['--download-root'] || process.env.AGE_DLOAD || 'D:\\idm下载',
  });
  if (!result.ok) throw new Error(result.error);
}

if (require.main === module) {
  main(process.argv).catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  applyQualifiedRenames,
  enrichEvents,
  mergeEvents,
  readJsonLines,
  runSession,
  waitForPid,
};
