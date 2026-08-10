'use strict';

const assert = require('node:assert/strict');
const { fetchText, processAllAnime } = require('../anime_updater.js');

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
