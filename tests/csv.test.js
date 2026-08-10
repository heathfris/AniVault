'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseCsv, readCsv, tailFile } = require('../src/csv.js');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-csv-'));
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('parseCsv 去 BOM、跳表头、跳空行', () => {
  const text = '\uFEFF动漫,集数,播放页URL\r\n\r\n再见，拉拉,6,https://www.agedm.io/play/20260166/1/6\r\n';
  const rows = parseCsv(text);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { title: '再见，拉拉', ep: 6, url: 'https://www.agedm.io/play/20260166/1/6' });
});

test('readCsv 读取带 BOM 的真实文件', () => {
  const dir = tmpDir();
  const file = path.join(dir, '待下载清单.csv');
  fs.writeFileSync(file, '\uFEFF动漫,集数,播放页URL\n再见，拉拉,6,https://www.agedm.io/play/20260166/1/6\n', 'utf8');
  const rows = readCsv(file);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, '再见，拉拉');
  assert.equal(rows[0].ep, 6);
});

test('tailFile 返回最后 n 行', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'log.txt');
  fs.writeFileSync(file, 'a\nb\nc\nd\ne\n', 'utf8');
  assert.deepEqual(tailFile(file, 2), ['d', 'e']);
});

test('tailFile 行数不足返回全部并去掉结尾空行', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'log.txt');
  fs.writeFileSync(file, 'x\ny\n', 'utf8');
  assert.deepEqual(tailFile(file, 10), ['x', 'y']);
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
