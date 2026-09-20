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
