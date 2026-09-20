const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('共享文件锁以独占创建协调两个写入者', () => {
  const { acquireFileLock } = require('../src/file-lock.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-file-lock-'));
  const lockPath = path.join(root, 'content-write.lock');
  try {
    const first = acquireFileLock({ lockPath, actor: 'first' });
    assert.equal(first.ok, true);
    const second = acquireFileLock({ lockPath, actor: 'second' });
    assert.equal(second.ok, false);
    assert.equal(second.reason, 'busy');
    first.release();
    const third = acquireFileLock({ lockPath, actor: 'third' });
    assert.equal(third.ok, true);
    third.release();
    assert.equal(fs.existsSync(lockPath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
