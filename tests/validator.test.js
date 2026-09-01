'use strict';

const assert = require('node:assert/strict');
const { validateConfig } = require('../src/config/validator.js');

const baseConfig = {
  fetch_time: '18:00',
  defaults: { max_download: 10, auto_repair: true, auto_close_idm: true },
  anime: {
    '测试番': {
      site_id: 123,
      update_time: '22:00',
      downloaded_start: 1,
      downloaded_end: 5,
      site_latest: 5,
      folder_name: '{name}_{end}',
      file_name: '{name}_{ep}.mp4',
    },
  },
};

function valid() {
  return JSON.parse(JSON.stringify(baseConfig));
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('合法配置通过', () => {
  const r = validateConfig(valid());
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, {});
});

test('fetch_time 小时非法被拒', () => {
  const c = valid();
  c.fetch_time = '25:00';
  const r = validateConfig(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors.fetch_time);
});

test('fetch_time 分钟非法被拒', () => {
  const c = valid();
  c.fetch_time = '18:60';
  assert.equal(validateConfig(c).ok, false);
});

test('max_download 负数被拒', () => {
  const c = valid();
  c.defaults.max_download = -1;
  assert.equal(validateConfig(c).ok, false);
});

test('max_download 非整数被拒', () => {
  const c = valid();
  c.defaults.max_download = 1.5;
  assert.equal(validateConfig(c).ok, false);
});

test('auto_repair 非布尔被拒', () => {
  const c = valid();
  c.defaults.auto_repair = 'yes';
  assert.equal(validateConfig(c).ok, false);
});

test('site_id 非正整数被拒', () => {
  const c = valid();
  c.anime['测试番'].site_id = 0;
  const r = validateConfig(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors['anime.测试番.site_id']);
});

test('downloaded_end 负数被拒', () => {
  const c = valid();
  c.anime['测试番'].downloaded_end = -1;
  assert.equal(validateConfig(c).ok, false);
});

test('folder_name 含斜杠被拒', () => {
  const c = valid();
  c.anime['测试番'].folder_name = '{name}/{ep}';
  const r = validateConfig(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors['anime.测试番.folder_name']);
});

test('file_name 含反斜杠被拒', () => {
  const c = valid();
  c.anime['测试番'].file_name = '{name}\\{ep}.mp4';
  assert.equal(validateConfig(c).ok, false);
});

test('未知占位符被拒', () => {
  const c = valid();
  c.anime['测试番'].file_name = '{name}_{foo}.mp4';
  const r = validateConfig(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors['anime.测试番.file_name']);
});

test('site_latest 非法被拒', () => {
  const c = valid();
  c.anime['测试番'].site_latest = 'abc';
  assert.equal(validateConfig(c).ok, false);
});

test('未知字段原样保留', () => {
  const c = valid();
  c.custom_root = { keep: true };
  c.anime['测试番'].custom_field = 'keep-me';
  const r = validateConfig(c);
  assert.equal(r.ok, true);
  assert.equal(c.custom_root.keep, true);
  assert.equal(c.anime['测试番'].custom_field, 'keep-me');
});

test('空的可选字段允许', () => {
  const c = valid();
  c.anime['测试番'].site_id = null;
  c.anime['测试番'].update_time = '';
  c.anime['测试番'].downloaded_start = undefined;
  const r = validateConfig(c);
  assert.equal(r.ok, true);
});

test('max_parallel 0 被拒', () => {
  const c = valid();
  c.defaults.max_parallel = 0;
  const r = validateConfig(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors['defaults.max_parallel']);
});

test('max_parallel 11 被拒', () => {
  const c = valid();
  c.defaults.max_parallel = 11;
  assert.equal(validateConfig(c).ok, false);
});

test('max_parallel 小数被拒', () => {
  const c = valid();
  c.defaults.max_parallel = 1.5;
  assert.equal(validateConfig(c).ok, false);
});

test('max_parallel 1 通过', () => {
  const c = valid();
  c.defaults.max_parallel = 1;
  assert.equal(validateConfig(c).ok, true);
});

test('max_parallel 10 通过', () => {
  const c = valid();
  c.defaults.max_parallel = 10;
  assert.equal(validateConfig(c).ok, true);
});

test('download_engine 非法值被拒', () => {
  const c = valid();
  c.defaults.download_engine = 'wget';
  const r = validateConfig(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors['defaults.download_engine']);
});

test('download_engine 三值通过', () => {
  for (const v of ['aria2', 'idm', 'ffmpeg']) {
    const c = valid();
    c.defaults.download_engine = v;
    assert.equal(validateConfig(c).ok, true);
  }
});

test('download_engine 缺省通过', () => {
  const c = valid();
  assert.equal(validateConfig(c).ok, true);
});

test('attempt_timeout_min 4 被拒', () => {
  const c = valid();
  c.defaults.attempt_timeout_min = 4;
  const r = validateConfig(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors['defaults.attempt_timeout_min']);
});

test('attempt_timeout_min 61 被拒', () => {
  const c = valid();
  c.defaults.attempt_timeout_min = 61;
  assert.equal(validateConfig(c).ok, false);
});

test('attempt_timeout_min 小数被拒', () => {
  const c = valid();
  c.defaults.attempt_timeout_min = 20.5;
  assert.equal(validateConfig(c).ok, false);
});

test('attempt_timeout_min 5 通过', () => {
  const c = valid();
  c.defaults.attempt_timeout_min = 5;
  assert.equal(validateConfig(c).ok, true);
});

test('attempt_timeout_min 20 通过', () => {
  const c = valid();
  c.defaults.attempt_timeout_min = 20;
  assert.equal(validateConfig(c).ok, true);
});

test('attempt_timeout_min 60 通过', () => {
  const c = valid();
  c.defaults.attempt_timeout_min = 60;
  assert.equal(validateConfig(c).ok, true);
});

test('enabled 非布尔被拒', () => {
  const c = valid();
  c.anime['测试番'].enabled = 'yes';
  const r = validateConfig(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors['anime.测试番.enabled']);
});

test('enabled true/false 通过', () => {
  for (const v of [true, false]) {
    const c = valid();
    c.anime['测试番'].enabled = v;
    assert.equal(validateConfig(c).ok, true);
  }
});

test('fetch_time 空值通过', () => {
  const c = valid();
  c.fetch_time = '';
  const r = validateConfig(c);
  assert.equal(r.ok, true);
});

test('skip_eps 正整数数组通过', () => {
  const c = valid();
  c.anime['测试番'].skip_eps = [1, 3];
  assert.equal(validateConfig(c).ok, true);
});

test('skip_eps 非法被拒', () => {
  for (const bad of ['1', [0], [-1], [1.5], 'x']) {
    const c = valid();
    c.anime['测试番'].skip_eps = bad;
    assert.equal(validateConfig(c).ok, false);
  }
});

test('base_url 非法被拒', () => {
  const c = valid();
  c.base_url = 'ftp://x';
  const r = validateConfig(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors.base_url);
});

test('base_url http(s) 与空通过', () => {
  for (const v of ['', null, undefined, 'https://www.agedm.io', 'http://mirror.example.com']) {
    const c = valid();
    c.base_url = v;
    assert.equal(validateConfig(c).ok, true);
  }
});

test('download_dir 只接受绝对 Windows 路径或留空', () => {
  let c = valid();
  c.download_dir = 'D:\\视频';
  assert.equal(validateConfig(c).ok, true);
  c.download_dir = 'relative\\视频';
  assert.ok(validateConfig(c).errors.download_dir);
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
