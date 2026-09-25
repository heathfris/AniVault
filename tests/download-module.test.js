const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');

test('download module exports engine and recovery operations', () => {
  const download = require('../src/download.js');
  for (const name of ['callIdm', 'getFfmpegTempPath', 'getMediaDurationSeconds', 'isDurationPlausible', 'chooseRecoverablePart', 'callFfmpeg', 'callAria2', 'waitForFile', 'engineChain', 'downloadEpisode', 'runPool']) {
    assert.equal(typeof download[name], 'function', name);
  }
});

test('callFfmpeg asynchronously waits for the child process and renames its output', async () => {
  const { callFfmpeg } = require('../src/download.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-download-'));
  const output = path.join(root, 'episode.mp4');
  const spawn = (_command, args) => {
    const child = new EventEmitter();
    setImmediate(() => {
      fs.writeFileSync(args[args.length - 1], 'downloaded');
      child.emit('close', 0);
    });
    return child;
  };

  try {
    const pending = callFfmpeg('https://example.test/video', root, 'episode.mp4', {}, {
      spawn,
      ffmpegPath: 'fake-ffmpeg.exe',
    });
    assert.equal(typeof pending?.then, 'function');
    assert.deepEqual(await pending, { status: 0, stderr: '' });
    assert.equal(fs.readFileSync(output, 'utf8'), 'downloaded');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('线路临时文件保留自定义视频扩展名', () => {
  const { getFfmpegTempPath } = require('../src/download.js');
  assert.equal(getFfmpegTempPath('episode.mkv'), 'episode.part.mkv');
});

test('同一集下载成功后清理该集失败残留并保留其他集残留', async () => {
  const { downloadEpisode } = require('../src/download.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-failed-cleanup-'));
  const name = '测试番 第01集.mp4';
  const primaryFailed = path.join(root, `${name}.failed`);
  const fallbackFailed = path.join(root, '测试番 第01集_L2.mp4.failed');
  const otherEpisodeFailed = path.join(root, '测试番 第02集.mp4.failed');
  fs.writeFileSync(primaryFailed, 'partial');
  fs.writeFileSync(fallbackFailed, 'partial');
  fs.writeFileSync(otherEpisodeFailed, 'partial');

  try {
    await downloadEpisode({ title: '测试番', site_id: 1 }, 1, root, {
      resolveFileName: () => ({ name }),
      findEpisodeFile: () => null,
      getPlayUrl: async () => 'https://example.test/video.mp4',
      callAria2: async (_url, dir, filename) => {
        fs.writeFileSync(path.join(dir, filename), 'complete');
        return { status: 0 };
      },
      waitForFile: async () => ({ ok: true, size: 8 }),
      getMediaDurationSeconds: () => 1200,
      minSize: 1,
      stableMs: 0,
      lines: [1, 2],
      progress: () => {},
    });

    assert.equal(fs.existsSync(path.join(root, name)), true);
    assert.equal(fs.existsSync(primaryFailed), false);
    assert.equal(fs.existsSync(fallbackFailed), false);
    assert.equal(fs.existsSync(otherEpisodeFailed), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('下载未成功时保留失败残留', async () => {
  const { downloadEpisode } = require('../src/download.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-failed-retain-'));
  const name = '测试番 第01集.mp4';
  const failed = path.join(root, `${name}.failed`);
  fs.writeFileSync(path.join(root, name), 'partial');

  try {
    await assert.rejects(downloadEpisode({ title: '测试番', site_id: 1 }, 1, root, {
      resolveFileName: () => ({ name }),
      findEpisodeFile: () => null,
      getPlayUrl: async () => null,
      minSize: 20,
      lines: [1],
      sleep: async () => {},
      progress: () => {},
    }));
    assert.equal(fs.existsSync(failed), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
