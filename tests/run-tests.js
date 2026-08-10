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

async function testDownloadEpisodeUsesAnimeSiteId() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const calls = [];
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
      callIdm: () => {},
      runMode: 'interactive',
      waitForFile: async () => ({ ok: true, size: 100 * 1024 * 1024 }),
    });

    assert.equal(result.src, 1);
    assert.deepEqual(calls, [{ siteId: 12345, ep: 2, source: 1 }]);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testM3u8UsesFfmpegInsteadOfIdm() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const calls = [];
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    const result = await downloadEpisode(anime, 2, folder, {
      getPlayUrl: async () => 'https://example.test/playlist.m3u8',
      callIdm: (url, dir, filename) => {
        calls.push('idm');
        fs.writeFileSync(path.join(dir, filename), 'stub');
      },
      callFfmpeg: () => calls.push('ffmpeg'),
      runMode: 'interactive',
      waitForFile: async () => ({ ok: true, size: 100 * 1024 * 1024 }),
    });
    assert.equal(result.src, 1);
    assert.deepEqual(calls, ['ffmpeg']);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testFailedPrimaryFallsBackToSecondSource() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const sources = [];
    const calls = [];
    let waits = 0;
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    const result = await downloadEpisode(anime, 2, folder, {
      getPlayUrl: async (siteId, ep, source) => {
        sources.push(source);
        return `https://example.test/video-${source}.mp4`;
      },
      callIdm: (url, dir, filename) => {
        calls.push('idm');
        fs.writeFileSync(path.join(dir, filename), 'stub');
      },
      runMode: 'interactive',
      waitForFile: async () => {
        waits += 1;
        return waits === 1 ? { ok: false, size: 0 } : { ok: true, size: 100 * 1024 * 1024 };
      },
    });
    assert.equal(result.src, 2);
    assert.deepEqual(sources, [1, 2]);
    assert.deepEqual(calls, ['idm', 'idm']);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testPasswordModeMp4UsesFfmpeg() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const calls = [];
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    await downloadEpisode(anime, 2, folder, {
      getPlayUrl: async () => 'https://example.test/video.mp4',
      callIdm: () => calls.push('idm'),
      callFfmpeg: () => calls.push('ffmpeg'),
      runMode: 'password',
      waitForFile: async () => ({ ok: true, size: 100 * 1024 * 1024 }),
    });
    assert.deepEqual(calls, ['ffmpeg']);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function testFfmpegExitFailureFallsBackImmediately() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-test-'));
  try {
    const sources = [];
    let launches = 0;
    let waits = 0;
    const anime = { title: 'Test Anime', site_id: 12345, downloaded_end: 1 };
    const result = await downloadEpisode(anime, 2, folder, {
      getPlayUrl: async (siteId, ep, source) => {
        sources.push(source);
        return `https://example.test/source-${source}.m3u8`;
      },
      callFfmpeg: (url, dir, filename) => {
        launches += 1;
        if (launches === 1) return { status: 1, stderr: 'HTTP 403' };
        fs.writeFileSync(path.join(dir, filename), 'stub');
        return { status: 0 };
      },
      runMode: 'password',
      waitForFile: async () => {
        waits += 1;
        return { ok: true, size: 100 * 1024 * 1024 };
      },
    });
    assert.equal(result.src, 2);
    assert.deepEqual(sources, [1, 2]);
    assert.equal(waits, 1);
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
  .then(testDownloadEpisodeUsesAnimeSiteId)
  .then(() => console.log('PASS downloadEpisode uses anime.site_id'))
  .then(testM3u8UsesFfmpegInsteadOfIdm)
  .then(() => console.log('PASS M3U8 uses ffmpeg instead of IDM'))
  .then(testFailedPrimaryFallsBackToSecondSource)
  .then(() => console.log('PASS failed primary falls back to source 2'))
  .then(testPasswordModeMp4UsesFfmpeg)
  .then(() => console.log('PASS password mode MP4 uses ffmpeg'))
  .then(testFfmpegExitFailureFallsBackImmediately)
  .then(() => console.log('PASS ffmpeg exit failure falls back immediately'))
  .finally(() => fs.rmSync(logDir, { recursive: true, force: true }))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
