'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function acquireFileLock(options = {}) {
  const lockPath = options.lockPath;
  if (typeof lockPath !== 'string' || !lockPath) return { ok: false, reason: 'invalid-path', release() {} };
  const token = crypto.randomUUID();
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  let fd;
  try {
    fd = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(fd, JSON.stringify({ v: 1, token, pid: process.pid, actor: options.actor || 'unknown', created_at_ms: Date.now() }), 'utf8');
    fs.closeSync(fd);
  } catch (error) {
    try { if (fd !== undefined) fs.closeSync(fd); } catch (_) {}
    if (error.code === 'EEXIST') return { ok: false, reason: 'busy', release() {} };
    return { ok: false, reason: 'lock-error', error: error.message, release() {} };
  }
  function release() {
    try {
      const current = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      if (current.token === token) fs.unlinkSync(lockPath);
    } catch (_) {
      // Never remove a lock whose ownership cannot be proved.
    }
  }
  return { ok: true, reason: null, release };
}

function withFileLock(lockPath, action, actor) {
  const lock = acquireFileLock({ lockPath, actor });
  if (!lock.ok) {
    const error = new Error(`文件写入锁不可用: ${lock.reason}`);
    error.code = 'EWRITELOCK';
    error.reason = lock.reason;
    throw error;
  }
  try {
    return action();
  } finally {
    lock.release();
  }
}

module.exports = { acquireFileLock, withFileLock };
