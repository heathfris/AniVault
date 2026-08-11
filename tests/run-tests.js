'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-logs-'));
process.env.AGE_PROGRESS = path.join(logDir, 'PROGRESS.md');
process.env.AGE_BLOCKED = path.join(logDir, 'BLOCKED.md');

const {
  downloadEpisode,
  formatLogTime,
  getCsvPath,
  getFfmpegPath,
  getFfmpegTempPath,
  getEpisodeFileMatcher,
  computeNewEnd,
  filterRowsByResults,
  processOneAnime,
  resolveDownloadedStart,
  withoutSkippedEps,
  runPool,
  writeCsv,
} = require('../anime_updater.js');

function testDefaultCsvPathUsesLocalFolder() {
  const workDir = path.join('D:', 'project', 'AGE动画_GET');
  assert.equal(
    getCsvPath(workDir, {}),
    path.join(workDir, 'local', '待下载清单.csv'),
  );
  assert.equal(
    getCsvPath(workDir, { AGE_CSV: 'E:\\custom\\list.csv' }),
    'E:\\custom\\list.csv',
  );
}

function testWriteCsvCreatesParentDirectory() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-csv-'));
  try {
    const csvPath = path.join(root, 'local', '待下载清单.csv');
    writeCsv([{ title: 'Test Anime', ep: 2, url: 'https://example.test/play/2' }], csvPath);
    assert.equal(fs.existsSync(csvPath), true);
    const text = fs.readFileSync(csvPath, 'utf8');
    assert.match(text, /Test Anime,2,https:\/\/example\.test\/play\/2/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function testLogTimeUsesShanghaiTimezone() {
  const utc = new Date('2026-08-09T13:04:08Z');
  assert.equal(formatLogTime(utc), '2026-08-09 21:04:08');
}

function testBundledFfmpegIsPreferred() {
  const expected = path.join(path.dirname(__dirname), 'tools', 'ffmpeg', 'ffmpeg.exe');
  assert.equal(getFfmpegPath(), expected);
}

function testPartialFfmpegOutputIsNotAnEpisode() {
  const finalPath = path.join('D:', 'downloads', 'Test Anime 第02集.mp4');
  assert.equal(getFfmpegTempPath(finalPath), path.join('D:', 'downloads', 'Test Anime 第02集.part.mp4'));
  const matcher = getEpisodeFileMatcher({ title: 'Test Anime' });
  assert.equal(matcher('Test Anime 第02集.part.mp4'), null);
}

function testResolveStartAtLeastOne() {
  assert.equal(resolveDownloadedStart(3, 0), 1);
}

function testResolveStartZero() {
  assert.equal(resolveDownloadedStart(0, 5), 0);
}

function testResolveStartUnknownKeeps() {
  assert.equal(resolveDownloadedStart(-1, 7), 7);
}

function testComputeNewEndPartialSuccess() {
  const end = computeNewEnd(0, [1, 2, 3, 4], [
    { ok: false },
    { ok: false },
    { ok: true },
    { ok: true },
  ]);
  assert.equal(end, 4);
}

function testComputeNewEndAllFailKeeps() {
  const end = computeNewEnd(0, [1, 2], [
    { ok: false },
    { ok: false },
  ]);
  assert.equal(end, 0);
}

function testComputeNewEndAllSuccess() {
  const end = computeNewEnd(0, [1, 2, 3], [
    { ok: true },
    { ok: true },
    { ok: true },
  ]);
  assert.equal(end, 3);
}

function testComputeNewEndNeverBackwards() {
  const end = computeNewEnd(5, [3, 4], [
    { ok: true },
    { ok: true },
  ]);
  assert.equal(end, 5);
}

function testFilterRowsPartialKeepsFailed() {
  const rows = [
    { title: 'T', ep: 1, url: 'u1' },
    { title: 'T', ep: 2, url: 'u2' },
    { title: 'T', ep: 3, url: 'u3' },
    { title: 'T', ep: 4, url: 'u4' },
  ];
  filterRowsByResults(rows, 'T', [1, 2, 3, 4], [
    { ok: false },
    { ok: false },
    { ok: true },
    { ok: true },
  ], false);
  assert.deepEqual(rows.map(r => r.ep), [1, 2]);
}

function testFilterRowsAllSuccessEmpty() {
  const rows = [
    { title: 'T', ep: 1, url: 'u1' },
    { title: 'T', ep: 2, url: 'u2' },
  ];
  filterRowsByResults(rows, 'T', [1, 2], [{ ok: true }, { ok: true }], false);
  assert.equal(rows.length, 0);
}

function testFilterRowsDryRunKeepsAll() {
  const rows = [
    { title: 'T', ep: 1, url: 'u1' },
    { title: 'T', ep: 2, url: 'u2' },
    { title: 'T', ep: 3, url: 'u3' },
    { title: 'T', ep: 4, url: 'u4' },
  ];
  filterRowsByResults(rows, 'T', [1, 2, 3, 4], [
    { ok: true },
    { ok: true },
    { ok: false },
    { ok: false },
  ], true);
  assert.equal(rows.length, 4);
}

function testFilterRowsAllFailKeepsAll() {
  const rows = [
    { title: 'T', ep: 1, url: 'u1' },
    { title: 'T', ep: 2, url: 'u2' },
  ];
  filterRowsByResults(rows, 'T', [1, 2], [{ ok: false }, { ok: false }], false);
  assert.equal(rows.length, 2);
}

async function testDisabledAnimeSkipsMaxEp() {
  const spy = [];
  const r = await processOneAnime('Test Anime', { site_id: 12345, enabled: false }, { defaults: {}, anime: {} }, {
    dryRun: true,
    rows: [],
    deps: { getMaxEp: async () => { spy.push('maxEp'); return 0; } },
  });
  assert.deepEqual(spy, []);
  assert.equal(r.changed, false);
}

async function testEnabledDefaultStillQueriesMaxEp() {
  const spy = [];
  await processOneAnime('Test Anime', { site_id: 12345 }, { defaults: {}, anime: {} }, {
    dryRun: true,
    rows: [],
    deps: { getMaxEp: async () => { spy.push('maxEp'); return 0; } },
  });
  assert.deepEqual(spy, ['maxEp']);
}

function testWithoutSkippedEps() {
  assert.deepEqual(withoutSkippedEps([1, 2, 3, 4], [2, 4]), [1, 3]);
  assert.deepEqual(withoutSkippedEps([1, 2], []), [1, 2]);
  assert.deepEqual(withoutSkippedEps([1, 2], [9]), [1, 2]);
}

async function testSkipEpsNotInRows() {
  const rows = [];
  await processOneAnime('Test Anime', { site_id: 12345, downloaded_end: 0, skip_eps: [1] }, { defaults: {}, anime: {} }, {
    dryRun: true,
    rows,
    deps: { getMaxEp: async () => 3 },
  });
  assert.deepEqual(rows.map(r => r.ep), [2, 3]);
}

async function testDownloadEpisodePassesAttemptTimeout() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    let capturedTimeout = null;
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    await downloadEpisode(anime, 2, folder, {
      getPlayUrl: async () => 'https://example.test/video.mp4',
      callAria2: (url, dir, filename) => {
        fs.writeFileSync(path.join(dir, filename), 'stub');
        return { status: 0 };
      },
      attemptTimeoutMs: 12345,
      waitForFile: async (filePath, minSize, stableMs, timeoutMs) => {
        capturedTimeout = timeoutMs;
        return { ok: true, size: 100 * 1024 * 1024 };
      },
    });
    assert.equal(capturedTimeout, 12345);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testDownloadEpisodeDefaultTimeoutFallback() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    let capturedTimeout = null;
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    await downloadEpisode(anime, 2, folder, {
      getPlayUrl: async () => 'https://example.test/video.mp4',
      callAria2: (url, dir, filename) => {
        fs.writeFileSync(path.join(dir, filename), 'stub');
        return { status: 0 };
      },
      waitForFile: async (filePath, minSize, stableMs, timeoutMs) => {
        capturedTimeout = timeoutMs;
        return { ok: true, size: 100 * 1024 * 1024 };
      },
    });
    assert.equal(capturedTimeout, 45 * 60 * 1000);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testDownloadEpisodeUsesAnimeSiteId() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const calls = [];
    const idmCalls = [];
    const ffmpegCalls = [];
    const anime = {
      title: 'Test Anime',
      site_id: 12345,
      downloaded_start: 1,
      downloaded_end: 1,
      file_name: '{name}_{ep}.mp4',
    };

    const result = await downloadEpisode(anime, 2, folder, {
      getPlayUrl: async (siteId, ep, source) => {
        calls.push({ siteId, ep, source });
        return 'https://example.test/video.mp4';
      },
      callAria2: (url, dir, filename) => {
        fs.writeFileSync(path.join(dir, filename), 'stub');
        return { status: 0 };
      },
      callIdm: () => idmCalls.push('idm'),
      callFfmpeg: () => ffmpegCalls.push('ffmpeg'),
      runMode: 'interactive',
      waitForFile: async () => ({ ok: true, size: 100 * 1024 * 1024 }),
    });

    assert.equal(result.src, 1);
    assert.deepEqual(calls, [{ siteId: 12345, ep: 2, source: 1 }]);
    assert.deepEqual(idmCalls, []);
    assert.deepEqual(ffmpegCalls, []);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testM3u8UsesAria2WithHls() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const calls = [];
    let ffmpeg = 0;
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    const result = await downloadEpisode(anime, 2, folder, {
      getPlayUrl: async () => 'https://example.test/playlist.m3u8',
      callAria2: (url, dir, filename, headers, isM3u8) => {
        calls.push({ url, isM3u8 });
        fs.writeFileSync(path.join(dir, filename), 'stub');
        return { status: 0 };
      },
      callFfmpeg: () => { ffmpeg += 1; },
      runMode: 'interactive',
      waitForFile: async () => ({ ok: true, size: 100 * 1024 * 1024 }),
    });
    assert.equal(result.src, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].isM3u8, true);
    assert.equal(ffmpeg, 0);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testAria2FailureFallsBackToFfmpeg() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const order = [];
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    const result = await downloadEpisode(anime, 2, folder, {
      getPlayUrl: async () => 'https://example.test/video.mp4',
      callAria2: () => {
        order.push('aria2');
        return { status: 1, stderr: 'HTTP 403' };
      },
      callFfmpeg: (url, dir, filename) => {
        order.push('ffmpeg');
        fs.writeFileSync(path.join(dir, filename), 'stub');
        return { status: 0 };
      },
      runMode: 'interactive',
      waitForFile: async () => ({ ok: true, size: 100 * 1024 * 1024 }),
    });
    assert.equal(result.src, 1);
    assert.deepEqual(order, ['aria2', 'ffmpeg']);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testPasswordAndInteractiveMp4BothUseAria2() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    for (const runMode of ['interactive', 'password']) {
      const order = [];
      const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
      const result = await downloadEpisode(anime, 2, folder, {
        getPlayUrl: async () => 'https://example.test/video.mp4',
        callAria2: (url, dir, filename) => {
          order.push('aria2');
          fs.writeFileSync(path.join(dir, filename), 'stub');
          return { status: 0 };
        },
        callFfmpeg: () => order.push('ffmpeg'),
        runMode,
        waitForFile: async () => ({ ok: true, size: 100 * 1024 * 1024 }),
      });
      assert.equal(result.src, 1);
      assert.deepEqual(order, ['aria2']);
    }
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testAria2AndFfmpegFailureFallsToNextSource() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const sources = [];
    const launches = [];
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    const result = await downloadEpisode(anime, 2, folder, {
      getPlayUrl: async (siteId, ep, source) => {
        sources.push(source);
        return `https://example.test/source-${source}.mp4`;
      },
      callAria2: (url, dir, filename) => {
        launches.push('aria2');
        if (sources.length === 2) {
          fs.writeFileSync(path.join(dir, filename), 'stub');
          return { status: 0 };
        }
        return { status: 1, stderr: 'fail' };
      },
      callFfmpeg: (url, dir, filename) => {
        launches.push('ffmpeg');
        if (sources.length === 1) return { status: 1, stderr: 'fail' };
        fs.writeFileSync(path.join(dir, filename), 'stub');
        return { status: 0 };
      },
      runMode: 'interactive',
      waitForFile: async () => ({ ok: true, size: 100 * 1024 * 1024 }),
    });
    assert.equal(result.src, 2);
    assert.deepEqual(sources, [1, 2]);
    assert.deepEqual(launches, ['aria2', 'ffmpeg', 'aria2']);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testPoolParallelTwoOverlap() {
  const active = { n: 0, max: 0 };
  const worker = async ep => {
    active.n += 1;
    active.max = Math.max(active.max, active.n);
    await new Promise(r => setTimeout(r, 120));
    active.n -= 1;
    return ep;
  };
  const results = await runPool([1, 2], worker, 2);
  assert.equal(active.max, 2);
  assert.deepEqual(results, [1, 2]);
}

async function testPoolSequentialOne() {
  const active = { n: 0, max: 0 };
  const worker = async ep => {
    active.n += 1;
    active.max = Math.max(active.max, active.n);
    await new Promise(r => setTimeout(r, 60));
    active.n -= 1;
    return ep;
  };
  const results = await runPool([1, 2, 3], worker, 1);
  assert.equal(active.max, 1);
  assert.deepEqual(results, [1, 2, 3]);
}

async function testMp4EngineIdmCallsIdmFirst() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const order = [];
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    const result = await downloadEpisode(anime, 2, folder, {
      engine: 'idm',
      runMode: 'interactive',
      getPlayUrl: async () => 'https://example.test/video.mp4',
      callIdm: (url, dir, filename) => {
        order.push('idm');
        fs.writeFileSync(path.join(dir, filename), 'stub');
      },
      callAria2: () => { order.push('aria2'); return { status: 1, stderr: 'x' }; },
      callFfmpeg: () => { order.push('ffmpeg'); return { status: 1, stderr: 'x' }; },
      waitForFile: async () => ({ ok: true, size: 100 * 1024 * 1024 }),
    });
    assert.equal(result.src, 1);
    assert.equal(result.engine, 'idm');
    assert.deepEqual(order, ['idm']);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testMp4EngineFfmpegFirst() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const order = [];
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    const result = await downloadEpisode(anime, 2, folder, {
      engine: 'ffmpeg',
      runMode: 'interactive',
      getPlayUrl: async () => 'https://example.test/video.mp4',
      callFfmpeg: (url, dir, filename) => {
        order.push('ffmpeg');
        fs.writeFileSync(path.join(dir, filename), 'stub');
        return { status: 0 };
      },
      callAria2: () => { order.push('aria2'); return { status: 1, stderr: 'x' }; },
      callIdm: () => order.push('idm'),
      waitForFile: async () => ({ ok: true, size: 100 * 1024 * 1024 }),
    });
    assert.deepEqual(order, ['ffmpeg']);
    assert.equal(result.engine, 'ffmpeg');
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testM3u8NeverUsesIdm() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const order = [];
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    const result = await downloadEpisode(anime, 2, folder, {
      engine: 'idm',
      runMode: 'interactive',
      getPlayUrl: async () => 'https://example.test/playlist.m3u8',
      callIdm: () => order.push('idm'),
      callFfmpeg: (url, dir, filename) => {
        order.push('ffmpeg');
        fs.writeFileSync(path.join(dir, filename), 'stub');
        return { status: 0 };
      },
      callAria2: () => { order.push('aria2'); return { status: 1, stderr: 'x' }; },
      waitForFile: async () => ({ ok: true, size: 100 * 1024 * 1024 }),
    });
    assert.deepEqual(order, ['aria2', 'ffmpeg']);
    assert.equal(result.engine, 'ffmpeg');
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testEngineFallbackChain() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const order = [];
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    const result = await downloadEpisode(anime, 2, folder, {
      engine: 'idm',
      runMode: 'interactive',
      getPlayUrl: async () => 'https://example.test/video.mp4',
      callIdm: () => { order.push('idm'); return { status: 1, stderr: 'idm-fail' }; },
      callAria2: () => { order.push('aria2'); return { status: 1, stderr: 'aria2-fail' }; },
      callFfmpeg: (url, dir, filename) => {
        order.push('ffmpeg');
        fs.writeFileSync(path.join(dir, filename), 'stub');
        return { status: 0 };
      },
      waitForFile: async () => ({ ok: true, size: 100 * 1024 * 1024 }),
    });
    assert.deepEqual(order, ['idm', 'aria2', 'ffmpeg']);
    assert.equal(result.engine, 'ffmpeg');
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testNonInteractiveIdmFallsBackToAria2() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const order = [];
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    const result = await downloadEpisode(anime, 2, folder, {
      engine: 'idm',
      runMode: 'password',
      getPlayUrl: async () => 'https://example.test/video.mp4',
      callIdm: () => order.push('idm'),
      callAria2: (url, dir, filename) => {
        order.push('aria2');
        fs.writeFileSync(path.join(dir, filename), 'stub');
        return { status: 0 };
      },
      callFfmpeg: () => order.push('ffmpeg'),
      waitForFile: async () => ({ ok: true, size: 100 * 1024 * 1024 }),
    });
    assert.deepEqual(order, ['aria2']);
    assert.equal(result.engine, 'aria2');
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

Promise.resolve()
  .then(testDefaultCsvPathUsesLocalFolder)
  .then(() => console.log('PASS default CSV path uses local folder'))
  .then(testWriteCsvCreatesParentDirectory)
  .then(() => console.log('PASS CSV writer creates parent directory'))
  .then(testLogTimeUsesShanghaiTimezone)
  .then(() => console.log('PASS log time uses Asia/Shanghai timezone'))
  .then(testBundledFfmpegIsPreferred)
  .then(() => console.log('PASS bundled ffmpeg path is preferred'))
  .then(testPartialFfmpegOutputIsNotAnEpisode)
  .then(() => console.log('PASS partial ffmpeg output is not an episode'))
  .then(testResolveStartAtLeastOne)
  .then(() => console.log('PASS downloaded_start ≥1 → 1'))
  .then(testResolveStartZero)
  .then(() => console.log('PASS downloaded_start =0 → 0'))
  .then(testResolveStartUnknownKeeps)
  .then(() => console.log('PASS downloaded_start -1 保持原值'))
  .then(testComputeNewEndPartialSuccess)
  .then(() => console.log('PASS 部分成功 end 推进到最高成功集'))
  .then(testComputeNewEndAllFailKeeps)
  .then(() => console.log('PASS 全部失败 end 不变'))
  .then(testComputeNewEndAllSuccess)
  .then(() => console.log('PASS 全部成功 end 取最高集'))
  .then(testComputeNewEndNeverBackwards)
  .then(() => console.log('PASS end 不倒退'))
  .then(testFilterRowsPartialKeepsFailed)
  .then(() => console.log('PASS 部分成功 rows 只剩失败集'))
  .then(testFilterRowsAllSuccessEmpty)
  .then(() => console.log('PASS 全部成功 rows 为空'))
  .then(testFilterRowsDryRunKeepsAll)
  .then(() => console.log('PASS dry-run rows 保留全部计划'))
  .then(testFilterRowsAllFailKeepsAll)
  .then(() => console.log('PASS 全部失败 rows 保留'))
  .then(testDisabledAnimeSkipsMaxEp)
  .then(() => console.log('PASS enabled=false 不调用 getMaxEp'))
  .then(testEnabledDefaultStillQueriesMaxEp)
  .then(() => console.log('PASS 缺省 enabled 视为启用'))
  .then(testWithoutSkippedEps)
  .then(() => console.log('PASS withoutSkippedEps 过滤'))
  .then(testSkipEpsNotInRows)
  .then(() => console.log('PASS skip_eps 中的集不出现在 rows'))
  .then(testDownloadEpisodePassesAttemptTimeout)
  .then(() => console.log('PASS attemptTimeoutMs 传给 waitForFile'))
  .then(testDownloadEpisodeDefaultTimeoutFallback)
  .then(() => console.log('PASS 未传 attemptTimeoutMs 用默认 45 分钟兜底'))
  .then(testDownloadEpisodeUsesAnimeSiteId)
  .then(() => console.log('PASS downloadEpisode uses anime.site_id'))
  .then(testM3u8UsesAria2WithHls)
  .then(() => console.log('PASS M3U8 uses aria2 with HLS'))
  .then(testAria2FailureFallsBackToFfmpeg)
  .then(() => console.log('PASS aria2 failure falls back to ffmpeg'))
  .then(testPasswordAndInteractiveMp4BothUseAria2)
  .then(() => console.log('PASS password and interactive MP4 both use aria2'))
  .then(testAria2AndFfmpegFailureFallsToNextSource)
  .then(() => console.log('PASS aria2 and ffmpeg failure falls to next source'))
  .then(testPoolParallelTwoOverlap)
  .then(() => console.log('PASS pool max_parallel=2 overlaps'))
  .then(testPoolSequentialOne)
  .then(() => console.log('PASS pool max_parallel=1 sequential'))
  .then(testMp4EngineIdmCallsIdmFirst)
  .then(() => console.log('PASS MP4 选 idm 先调 IDM'))
  .then(testMp4EngineFfmpegFirst)
  .then(() => console.log('PASS MP4 选 ffmpeg 先调 ffmpeg'))
  .then(testM3u8NeverUsesIdm)
  .then(() => console.log('PASS M3U8 永不走 IDM'))
  .then(testEngineFallbackChain)
  .then(() => console.log('PASS 引擎按链兜底'))
  .then(testNonInteractiveIdmFallsBackToAria2)
  .then(() => console.log('PASS 非交互模式选 idm 回退 aria2'))
  .finally(() => fs.rmSync(logDir, { recursive: true, force: true }))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
