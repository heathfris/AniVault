'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function defaultLockPath(workDir) {
  return path.join(workDir, 'local', 'run.lock');
}

function readLock(lockPath) {
  try {
    const raw = fs.readFileSync(lockPath, 'utf8').trim();
    const pid = parseInt(raw, 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch (e) {
    return null;
  }
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

function writeLock(lockPath, pid) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, String(pid), 'utf8');
}

function releaseLock(lockPath, pid) {
  if (readLock(lockPath) !== pid) return;
  try {
    fs.rmSync(lockPath, { force: true });
  } catch (e) {
    /* 忽略 */
  }
}

function spawnSpec(scriptPath, args = [], extraEnv = {}) {
  return {
    command: process.execPath,
    args: [scriptPath, ...args],
    options: {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...extraEnv },
      windowsHide: true,
    },
  };
}

function attachLines(stream, cb) {
  if (!stream || typeof cb !== 'function') return;
  stream.setEncoding('utf8');
  let buf = '';
  stream.on('data', chunk => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (line) cb(line);
    }
  });
  stream.on('end', () => {
    const tail = buf.replace(/\r$/, '');
    if (tail) cb(tail);
  });
}

function createRunner({ scriptPath, lockPath = defaultLockPath(process.cwd()), onStdout, onStderr, onExit, extraEnv = {} } = {}) {
  let child = null;

  function start(args = []) {
    if (child) return { ok: false, reason: 'running' };
    const lockedPid = readLock(lockPath);
    if (lockedPid !== null && pidAlive(lockedPid)) {
      return { ok: false, reason: 'locked', pid: lockedPid };
    }
    const spec = spawnSpec(scriptPath, args, extraEnv);
    child = spawn(spec.command, spec.args, spec.options);
    writeLock(lockPath, child.pid);
    attachLines(child.stdout, onStdout);
    attachLines(child.stderr, onStderr);
    child.on('error', err => {
      releaseLock(lockPath, child.pid);
      child = null;
      if (onExit) onExit({ error: err.message, code: null, signal: null });
    });
    child.on('exit', (code, signal) => {
      releaseLock(lockPath, child.pid);
      child = null;
      if (onExit) onExit({ code, signal, error: null });
    });
    return { ok: true, pid: child.pid };
  }

  function stop() {
    if (!child) return { ok: false, reason: 'not-running' };
    try {
      child.kill();
    } catch (e) {
      /* 已退出 */
    }
    return { ok: true };
  }

  function status() {
    return { running: child !== null, pid: child ? child.pid : null };
  }

  return { start, stop, status };
}

module.exports = {
  createRunner,
  spawnSpec,
  readLock,
  writeLock,
  releaseLock,
  pidAlive,
  defaultLockPath,
  attachLines,
};
