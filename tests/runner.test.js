'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRunner, spawnSpec } = require('../src/runner.js');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-runner-'));
}

function fakeScript(dir) {
  const p = path.join(dir, 'fake.js');
  fs.writeFileSync(
    p,
    "console.log('FAKE_START');\nsetTimeout(() => { console.log('FAKE_DONE'); process.exit(0); }, 2000);\n",
    'utf8',
  );
  return p;
}

function waitFor(fn, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (fn()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error('等待超时'));
      }
    }, 50);
  });
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('spawnSpec 使用 ELECTRON_RUN_AS_NODE=1', () => {
  const spec = spawnSpec('C:\\x\\script.js', ['--dry-run']);
  assert.equal(spec.command, process.execPath);
  assert.deepEqual(spec.args, ['C:\\x\\script.js', '--dry-run']);
  assert.equal(spec.options.env.ELECTRON_RUN_AS_NODE, '1');
});

test('spawnSpec 支持 extraEnv 合并', () => {
  const spec = spawnSpec('C:\\x\\script.js', ['--dry-run'], { AGE_RUN_MODE: 'interactive' });
  assert.equal(spec.options.env.AGE_RUN_MODE, 'interactive');
  assert.equal(spec.options.env.ELECTRON_RUN_AS_NODE, '1');
});

test('启动成功且锁写入子进程 pid', async () => {
  const dir = tmpDir();
  const lock = path.join(dir, 'run.lock');
  const r = createRunner({ scriptPath: fakeScript(dir), lockPath: lock });
  const st = r.start();
  assert.equal(st.ok, true);
  assert.equal(parseInt(fs.readFileSync(lock, 'utf8'), 10), r.status().pid);
  await waitFor(() => !r.status().running);
  assert.equal(fs.existsSync(lock), false);
});

test('stdout 逐行回调', async () => {
  const dir = tmpDir();
  const lock = path.join(dir, 'run.lock');
  const lines = [];
  const r = createRunner({ scriptPath: fakeScript(dir), lockPath: lock, onStdout: l => lines.push(l) });
  assert.equal(r.start().ok, true);
  await waitFor(() => !r.status().running);
  assert.deepEqual(lines, ['FAKE_START', 'FAKE_DONE']);
});

test('退出回调收到 code=0 且锁清理', async () => {
  const dir = tmpDir();
  const lock = path.join(dir, 'run.lock');
  let exitResult = null;
  const r = createRunner({ scriptPath: fakeScript(dir), lockPath: lock, onExit: x => { exitResult = x; } });
  assert.equal(r.start().ok, true);
  await waitFor(() => !r.status().running);
  assert.equal(exitResult.code, 0);
  assert.equal(fs.existsSync(lock), false);
});

test('运行中禁止再次启动', async () => {
  const dir = tmpDir();
  const lock = path.join(dir, 'run.lock');
  const r = createRunner({ scriptPath: fakeScript(dir), lockPath: lock });
  assert.equal(r.start().ok, true);
  const second = r.start();
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'running');
  assert.equal(r.stop().ok, true);
  await waitFor(() => !r.status().running);
  assert.equal(fs.existsSync(lock), false);
});

test('活锁存在时第二次启动被拒', () => {
  const dir = tmpDir();
  const lock = path.join(dir, 'run.lock');
  fs.writeFileSync(lock, String(process.pid), 'utf8');
  const r = createRunner({ scriptPath: fakeScript(dir), lockPath: lock });
  const st = r.start();
  assert.equal(st.ok, false);
  assert.equal(st.reason, 'locked');
  assert.equal(parseInt(fs.readFileSync(lock, 'utf8'), 10), process.pid);
  fs.rmSync(lock, { force: true });
});

test('僵尸锁自动清理', async () => {
  const dir = tmpDir();
  const lock = path.join(dir, 'run.lock');
  fs.writeFileSync(lock, '99999999', 'utf8');
  const r = createRunner({ scriptPath: fakeScript(dir), lockPath: lock });
  assert.equal(r.start().ok, true);
  assert.equal(parseInt(fs.readFileSync(lock, 'utf8'), 10), r.status().pid);
  await waitFor(() => !r.status().running);
  assert.equal(fs.existsSync(lock), false);
});

test('stop 终止子进程并清锁', async () => {
  const dir = tmpDir();
  const lock = path.join(dir, 'run.lock');
  const r = createRunner({ scriptPath: fakeScript(dir), lockPath: lock });
  const startTime = Date.now();
  assert.equal(r.start().ok, true);
  await waitFor(() => r.status().running);
  assert.equal(r.stop().ok, true);
  await waitFor(() => !r.status().running, 4000);
  assert.ok(Date.now() - startTime < 1900, '子进程未被及时终止');
  assert.equal(fs.existsSync(lock), false);
});

let passed = 0;
Promise.resolve()
  .then(async () => {
    for (const t of tests) {
      try {
        await t.fn();
        passed += 1;
        console.log('PASS ' + t.name);
      } catch (e) {
        console.error('FAIL ' + t.name);
        console.error(e);
      }
    }
    const failed = tests.length - passed;
    console.log(passed + ' PASS, ' + failed + ' FAIL, skipped=0');
    if (failed > 0) process.exitCode = 1;
  });
