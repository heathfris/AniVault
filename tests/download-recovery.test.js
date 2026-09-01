const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const updater = require('../anime_updater.js');

test('文件被临时占用时重试改名', () => {
  let attempts = 0;
  let waits = 0;
  updater.renameWithRetrySync('a.part.mp4', 'a.mp4', {
    rename() {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error('busy'), { code: 'EPERM' });
    },
    wait() { waits += 1; },
    attempts: 3,
  });
  assert.equal(attempts, 3);
  assert.equal(waits, 2);
});

test('非临时占用错误不重试', () => {
  let attempts = 0;
  assert.throws(() => updater.renameWithRetrySync('a', 'b', {
    rename() {
      attempts += 1;
      throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    },
    wait() { throw new Error('不应等待'); },
  }), /missing/);
  assert.equal(attempts, 1);
});

test('恢复残留时选择时长完整的候选文件', () => {
  const candidates = [
    { path: 'line1.part.mp4', size: 500, duration: 421 },
    { path: 'line2.part.mp4', size: 300, duration: 1442 },
    { path: 'line4.part.mp4', size: 120, duration: 1423 },
  ];
  assert.equal(updater.chooseRecoverablePart(candidates, 1440, 100).path, 'line2.part.mp4');
  assert.equal(updater.chooseRecoverablePart([candidates[0]], 1440, 100), null);
});

test('从 ffmpeg 输出读取媒体时长', () => {
  const duration = updater.getMediaDurationSeconds('episode.mp4', () => ({
    stderr: 'Duration: 00:24:05.12, start: 0.000000, bitrate: 1234 kb/s',
  }));
  assert.equal(duration, 1445.12);
});

test('downloadEpisode 复用最长的完整临时文件且不再取址', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-recover-'));
  const previous = path.join(dir, '测试番 第01集.mp4');
  const shortPart = path.join(dir, '测试番 第02集.part.mp4');
  const fullPart = path.join(dir, '测试番 第02集_L2.part.mp4');
  for (const file of [previous, shortPart, fullPart]) {
    fs.writeFileSync(file, 'x');
    fs.truncateSync(file, 101 * 1024 * 1024);
  }
  try {
    const result = await updater.downloadEpisode({
      title: '测试番', site_id: 1, file_name: '{name} 第{ep}集.mp4',
    }, 2, dir, {
      getMediaDurationSeconds(file) {
        if (file === previous) return 1440;
        return file === fullPart ? 1442 : 421;
      },
      getPlayUrl() { throw new Error('不应重新取址'); },
    });
    assert.equal(result.recovered, true);
    assert.equal(fs.existsSync(path.join(dir, '测试番 第02集.mp4')), true);
    assert.equal(fs.existsSync(shortPart), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
