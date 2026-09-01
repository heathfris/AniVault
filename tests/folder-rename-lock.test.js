'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('共享锁原子获得并释放', () => {
  const { acquireFolderRenameLock } = require('../src/folder-rename-lock.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-lock-'));
  try {
    const lockPath = path.join(dir, 'folder-rename.lock');
    const lock = acquireFolderRenameLock({ lockPath, actor: 'test' });
    assert.equal(lock.ok, true);
    assert.equal(fs.existsSync(lockPath), true);
    lock.release();
    assert.equal(fs.existsSync(lockPath), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('活进程锁和损坏锁都拒绝抢占', () => {
  const { acquireFolderRenameLock } = require('../src/folder-rename-lock.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-lock-'));
  try {
    const lockPath = path.join(dir, 'folder-rename.lock');
    fs.writeFileSync(lockPath, JSON.stringify({ v: 1, pid: 77, created_at_ms: 1000 }), 'utf8');
    assert.equal(acquireFolderRenameLock({ lockPath, nowMs: 700000, isProcessAlive: () => true }).reason, 'busy');
    fs.writeFileSync(lockPath, '{broken', 'utf8');
    assert.equal(acquireFolderRenameLock({ lockPath, nowMs: 700000, isProcessAlive: () => false }).reason, 'unknown-lock');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('死进程锁满十分钟后保留stale证据并仅重试一次', () => {
  const { acquireFolderRenameLock } = require('../src/folder-rename-lock.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-lock-'));
  try {
    const lockPath = path.join(dir, 'folder-rename.lock');
    fs.writeFileSync(lockPath, JSON.stringify({ v: 1, pid: 77, created_at_ms: 1000 }), 'utf8');
    const result = acquireFolderRenameLock({ lockPath, actor: 'test', nowMs: 601001, isProcessAlive: () => false });
    assert.equal(result.ok, true);
    assert.ok(fs.readdirSync(dir).some(name => name.startsWith('folder-rename.lock.stale-')));
    result.release();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('死进程锁不足十分钟仍返回busy', () => {
  const { acquireFolderRenameLock } = require('../src/folder-rename-lock.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-lock-'));
  try {
    const lockPath = path.join(dir, 'folder-rename.lock');
    fs.writeFileSync(lockPath, JSON.stringify({ v: 1, pid: 77, created_at_ms: 1000 }), 'utf8');
    assert.equal(acquireFolderRenameLock({ lockPath, nowMs: 600999, isProcessAlive: () => false }).reason, 'busy');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
