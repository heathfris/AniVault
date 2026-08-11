'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fetchText, getBase, processAllAnime, resetBaseCache } = require('../anime_updater.js');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('fetchText 超时被拒绝', async () => {
  const started = Date.now();
  await assert.rejects(
    () => fetchText('https://example.test/', null, {
      fetchImpl: () => new Promise(() => {}),
      timeoutMs: 80,
    }),
    /超时|timeout/i,
  );
  assert.ok(Date.now() - started < 3000, '超时等待过久');
});

test('fetchText 网络错误被拒绝', async () => {
  await assert.rejects(
    () => fetchText('https://example.test/', null, {
      fetchImpl: async () => { throw new Error('ECONNRESET'); },
      timeoutMs: 2000,
    }),
    /ECONNRESET/,
  );
});

test('单番失败其余番继续且不抛出', async () => {
  const seen = [];
  const blocked = [];
  const result = await processAllAnime(
    { anime: { A: {}, B: {}, C: {} } },
    {
      getHomeTimes: async () => ({}),
      processOneAnime: async title => {
        seen.push(title);
        if (title === 'B') throw new Error('B 下载失败');
        return { changed: false };
      },
      blocked: msg => blocked.push(msg),
      progress: () => {},
      writeCsv: () => {},
      dryRun: true,
    },
  );
  assert.deepEqual(seen, ['A', 'B', 'C']);
  assert.equal(result.failed, 1);
  assert.equal(blocked.length, 1);
  assert.match(blocked[0], /B 下载失败/);
});

test('首页失败降级后继续处理番剧', async () => {
  const seen = [];
  const blocked = [];
  const result = await processAllAnime(
    { anime: { A: {} } },
    {
      getHomeTimes: async () => { throw new Error('首页超时'); },
      processOneAnime: async title => { seen.push(title); return { changed: false }; },
      blocked: msg => blocked.push(msg),
      progress: () => {},
      writeCsv: () => {},
      dryRun: true,
    },
  );
  assert.deepEqual(seen, ['A']);
  assert.equal(result.ok, true);
  assert.equal(blocked.length, 1);
  assert.match(blocked[0], /首页超时/);
});

test('fetchText 首次失败重试后成功', async () => {
  let calls = 0;
  const text = await fetchText('https://example.test/', null, {
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) throw new Error('fetch failed');
      return { ok: true, text: async () => 'ok' };
    },
    retries: 1,
    retryDelayMs: 5,
  });
  assert.equal(text, 'ok');
  assert.equal(calls, 2);
});

test('fetchText 两次失败后抛错', async () => {
  await assert.rejects(
    () => fetchText('https://example.test/', null, {
      fetchImpl: async () => { throw new Error('fetch failed'); },
      retries: 1,
      retryDelayMs: 5,
    }),
    /fetch failed/,
  );
});

test('fetchText retries=0 只请求一次', async () => {
  let calls = 0;
  await assert.rejects(
    () => fetchText('https://example.test/', null, {
      fetchImpl: async () => { calls += 1; throw new Error('fetch failed'); },
      retries: 0,
      retryDelayMs: 5,
    }),
    /fetch failed/,
  );
  assert.equal(calls, 1);
});

test('fetchText 超时不重试', async () => {
  let calls = 0;
  await assert.rejects(
    () => fetchText('https://example.test/', null, {
      fetchImpl: () => { calls += 1; return new Promise(() => {}); },
      timeoutMs: 60,
      retries: 1,
      retryDelayMs: 5,
    }),
    /超时|timeout/i,
  );
  assert.equal(calls, 1);
});

test('全失败且 0 行时不覆盖待下载清单', async () => {
  const csvCalls = [];
  const progressMsgs = [];
  const result = await processAllAnime(
    { anime: { A: {}, B: {} } },
    {
      getHomeTimes: async () => ({}),
      processOneAnime: async title => { throw new Error(title + ' 失败'); },
      blocked: () => {},
      progress: msg => progressMsgs.push(msg),
      writeCsv: rows => csvCalls.push(rows),
      dryRun: true,
    },
  );
  assert.equal(result.failed, 2);
  assert.equal(csvCalls.length, 0);
  assert.ok(progressMsgs.some(m => /保留上次待下载清单/.test(m)));
});

test('部分成功时正常写待下载清单', async () => {
  const csvCalls = [];
  const result = await processAllAnime(
    { anime: { A: {}, B: {} } },
    {
      getHomeTimes: async () => ({}),
      processOneAnime: async (title, info, content, options) => {
        if (title === 'B') throw new Error('B 失败');
        options.rows.push({ title, ep: 1, url: 'https://example.test/1' });
        return { changed: false };
      },
      blocked: () => {},
      progress: () => {},
      writeCsv: rows => csvCalls.push(rows),
      dryRun: true,
    },
  );
  assert.equal(result.failed, 1);
  assert.equal(csvCalls.length, 1);
  assert.equal(csvCalls[0].length, 1);
});

test('fetchText 请求头含 Connection: close', async () => {
  let captured = null;
  await fetchText('https://example.test/', null, {
    fetchImpl: async (url, opts) => {
      captured = opts.headers;
      return { ok: true, text: async () => 'ok' };
    },
    retries: 0,
  });
  assert.equal(captured['Connection'], 'close');
});

test('getBase 默认 www.agedm.io', () => {
  delete process.env.AGE_BASE;
  assert.equal(getBase(), 'https://www.agedm.io');
});

test('getBase 支持 AGE_BASE 覆盖', () => {
  process.env.AGE_BASE = 'https://mirror.example.com';
  try {
    assert.equal(getBase(), 'https://mirror.example.com');
  } finally {
    delete process.env.AGE_BASE;
  }
});

test('getBase 读 content.base_url', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-base-'));
  const file = path.join(dir, 'content.json');
  fs.writeFileSync(file, JSON.stringify({ base_url: 'https://mirror.example.com' }), 'utf8');
  try {
    assert.equal(getBase(file), 'https://mirror.example.com');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('getBase AGE_BASE 优先于 content.base_url', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-base-'));
  const file = path.join(dir, 'content.json');
  fs.writeFileSync(file, JSON.stringify({ base_url: 'https://file.example.com' }), 'utf8');
  process.env.AGE_BASE = 'https://env.example.com';
  try {
    assert.equal(getBase(file), 'https://env.example.com');
  } finally {
    delete process.env.AGE_BASE;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('getBase 同路径缓存后改文件返回旧值', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-base-'));
  const file = path.join(dir, 'content.json');
  fs.writeFileSync(file, JSON.stringify({ base_url: 'https://one.example.com' }), 'utf8');
  try {
    assert.equal(getBase(file), 'https://one.example.com');
    fs.writeFileSync(file, JSON.stringify({ base_url: 'https://two.example.com' }), 'utf8');
    assert.equal(getBase(file), 'https://one.example.com');
  } finally {
    delete process.env.AGE_BASE;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('getBase resetBaseCache 后重新读取', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-base-'));
  const file = path.join(dir, 'content.json');
  fs.writeFileSync(file, JSON.stringify({ base_url: 'https://one.example.com' }), 'utf8');
  try {
    assert.equal(getBase(file), 'https://one.example.com');
    fs.writeFileSync(file, JSON.stringify({ base_url: 'https://two.example.com' }), 'utf8');
    resetBaseCache();
    assert.equal(getBase(file), 'https://two.example.com');
  } finally {
    delete process.env.AGE_BASE;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('getBase 不同文件路径各自缓存', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-base-'));
  const fileA = path.join(dir, 'a.json');
  const fileB = path.join(dir, 'b.json');
  fs.writeFileSync(fileA, JSON.stringify({ base_url: 'https://a.example.com' }), 'utf8');
  fs.writeFileSync(fileB, JSON.stringify({ base_url: 'https://b.example.com' }), 'utf8');
  try {
    assert.equal(getBase(fileA), 'https://a.example.com');
    assert.equal(getBase(fileB), 'https://b.example.com');
    assert.equal(getBase(fileA), 'https://a.example.com');
  } finally {
    delete process.env.AGE_BASE;
    fs.rmSync(dir, { recursive: true, force: true });
  }
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
