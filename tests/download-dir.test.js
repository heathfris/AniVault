const assert = require('assert');
const test = require('node:test');

const updater = require('../anime_updater.js');

test('download_dir 配置覆盖默认目录', () => {
  assert.equal(updater.getDownloadDir({ download_dir: 'D:\\视频' }), 'D:\\视频');
});

test('AGE_DLOAD 覆盖界面配置', () => {
  const previous = process.env.AGE_DLOAD;
  process.env.AGE_DLOAD = 'E:\\下载';
  try {
    assert.equal(updater.getDownloadDir({ download_dir: 'D:\\视频' }), 'E:\\下载');
  } finally {
    if (previous === undefined) delete process.env.AGE_DLOAD;
    else process.env.AGE_DLOAD = previous;
  }
});
