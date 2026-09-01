'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const STALE_AFTER_MS = 10 * 60 * 1000;

function defaultIsProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && error.code === 'ESRCH') return false;
    return null;
  }
}

function acquireFolderRenameLock(options) {
  const lockPath = options && options.lockPath;
  if (!lockPath) return { ok: false, reason: 'invalid-path', release() {} };
  const nowMs = options.nowMs ?? Date.now();
  const isProcessAlive = options.isProcessAlive || defaultIsProcessAlive;
  const token = crypto.randomBytes(12).toString('hex');
  const payload = {
    v: 1,
    pid: process.pid,
    process_start_ms: Math.round(Date.now() - process.uptime() * 1000),
    created_at_ms: nowMs,
    actor: options.actor || 'unknown',
    token,
  };

  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  function create() {
    let fd;
    try {
      fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(fd, JSON.stringify(payload), 'utf8');
      fs.closeSync(fd);
      fd = null;
      return true;
    } catch (error) {
      if (fd !== undefined && fd !== null) try { fs.closeSync(fd); } catch (_) { /* ignore */ }
      if (error && error.code === 'EEXIST') return false;
      throw error;
    }
  }

  function release() {
    try {
      const current = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      if (current.token === token) fs.unlinkSync(lockPath);
    } catch (_) { /* Never remove a lock whose ownership cannot be proved. */ }
  }

  try {
    if (create()) return { ok: true, reason: null, release };
    let current;
    try {
      current = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    } catch (_) {
      return { ok: false, reason: 'unknown-lock', release() {} };
    }
    if (!current || current.v !== 1 || !Number.isInteger(current.pid) || !Number.isFinite(current.created_at_ms)) {
      return { ok: false, reason: 'unknown-lock', release() {} };
    }
    const alive = isProcessAlive(current.pid);
    if (alive !== false) return { ok: false, reason: alive === true ? 'busy' : 'unknown-lock', release() {} };
    if (nowMs - current.created_at_ms < STALE_AFTER_MS) return { ok: false, reason: 'busy', release() {} };
    const stalePath = `${lockPath}.stale-${new Date(nowMs).toISOString().replace(/[:.]/g, '-')}`;
    try { fs.renameSync(lockPath, stalePath); } catch (_) {
      return { ok: false, reason: 'unknown-lock', release() {} };
    }
    if (!create()) return { ok: false, reason: 'busy', stalePath, release() {} };
    return { ok: true, reason: null, stalePath, release };
  } catch (error) {
    return { ok: false, reason: 'lock-error', error: error.message, release() {} };
  }
}

module.exports = { acquireFolderRenameLock, STALE_AFTER_MS };
