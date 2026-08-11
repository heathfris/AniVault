'use strict';

const assert = require('node:assert/strict');
const { summarize } = require('../src/summary.js');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('total 取 site_latest', () => {
  const r = summarize({ site_latest: 8, downloaded_end: 5 }, 3);
  assert.deepEqual(r, { downloaded: 3, total: 8 });
});

test('site_latest 缺失时 total 取 downloaded_end', () => {
  const r = summarize({ downloaded_end: 5 }, 3);
  assert.deepEqual(r, { downloaded: 3, total: 5 });
});

test('文件夹不可读时 downloaded 为 ?', () => {
  const r = summarize({ site_latest: 8 }, -1);
  assert.deepEqual(r, { downloaded: '?', total: 8 });
});

test('都缺失时 total 为 0', () => {
  const r = summarize({}, 0);
  assert.deepEqual(r, { downloaded: 0, total: 0 });
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
