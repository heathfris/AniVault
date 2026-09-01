'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyTemplate,
  matchFolderTemplate,
  resolveFolderName,
} = require('../anime_updater.js');
const { validateConfig } = require('../src/config/validator.js');

function config(folderName, fileName = '{name}_{ep}.mp4') {
  return {
    fetch_time: '',
    defaults: { max_download: 0, auto_repair: true, auto_close_idm: true },
    anime: {
      '片名': {
        folder_name: folderName,
        file_name: fileName,
        downloaded_start: 1,
        downloaded_end: 14,
      },
    },
  };
}

test('folder_name允许且仅允许一个watched占位符', () => {
  assert.equal(validateConfig(config('{watched}_{name}{start}-{end}')).ok, true);
  const repeated = validateConfig(config('{watched}_{name}_{watched}'));
  assert.equal(repeated.ok, false);
  assert.ok(repeated.errors['anime.片名.folder_name']);
});

test('file_name拒绝watched占位符', () => {
  const result = validateConfig(config('{name}{start}-{end}', '{watched}_{name}_{ep}.mp4'));
  assert.equal(result.ok, false);
  assert.ok(result.errors['anime.片名.file_name']);
});

test('同一模板精确捕获目录变量并保留自定义文字', () => {
  const template = '{watched}_{name}{start}-{end} [1080P]';
  assert.deepEqual(
    matchFolderTemplate(template, '13_片名1-14 [1080P]', '片名'),
    { name: '片名', start: 1, end: 14, ep: 14, watched: 13 },
  );
  assert.equal(matchFolderTemplate(template, '13_片名1-14', '片名'), null);
});

test('模板生成支持watched且下载更新end时保留原watched', () => {
  assert.equal(
    applyTemplate('{watched}_{name}{start}-{end}', { watched: 13, name: '片名', start: 1, end: 15, ep: 15 }),
    '13_片名1-15',
  );
  const anime = { title: '片名', downloaded_start: 1, folder_name: '{watched}_{name}{start}-{end} [1080P]' };
  const current = { watched: 13, name: '13_片名1-14 [1080P]' };
  assert.deepEqual(resolveFolderName(anime, current, 15), { name: '13_片名1-15 [1080P]', error: null });
});
