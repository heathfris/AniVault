'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseCsv, readCsv, removeCsvRow, tailFile } = require('../src/csv.js');

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

test('removeCsvRow 只删除唯一目标并保留BOM、表头和其他行', () => {
  const dir = tmpDir();
  const file = path.join(dir, '待下载清单.csv');
  const original = '\uFEFF动漫,集数,播放页URL\r\n番A,1,https://example.test/1\r\n番B,2,https://example.test/2\r\n';
  fs.writeFileSync(file, original, 'utf8');
  removeCsvRow(file, '番A', 1);
  assert.equal(
    fs.readFileSync(file, 'utf8'),
    '\uFEFF动漫,集数,播放页URL\r\n番B,2,https://example.test/2\r\n',
  );
});

test('removeCsvRow 后重新生成清单时该集可以再次出现', () => {
  const dir = tmpDir();
  const file = path.join(dir, '待下载清单.csv');
  const generated = '\uFEFF动漫,集数,播放页URL\r\n番A,1,https://example.test/1';
  fs.writeFileSync(file, generated, 'utf8');
  removeCsvRow(file, '番A', 1);
  fs.writeFileSync(file, generated, 'utf8');
  assert.deepEqual(readCsv(file), [{ title: '番A', ep: 1, url: 'https://example.test/1' }]);
});

for (const [name, text, title, ep, error] of [
  ['目标不存在', '\uFEFF动漫,集数,播放页URL\n番A,1,https://example.test/1', '番A', 2, /恰好1行/],
  ['目标不唯一', '\uFEFF动漫,集数,播放页URL\n番A,1,https://example.test/1\n番A,1,https://example.test/1b', '番A', 1, /恰好1行/],
  ['CSV损坏', '\uFEFF动漫,集数,播放页URL\n坏行', '番A', 1, /CSV格式/],
]) {
  test(`removeCsvRow ${name}时拒绝修改原文件`, () => {
    const dir = tmpDir();
    const file = path.join(dir, '待下载清单.csv');
    fs.writeFileSync(file, text, 'utf8');
    assert.throws(() => removeCsvRow(file, title, ep), error);
    assert.equal(fs.readFileSync(file, 'utf8'), text);
  });
}

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
