'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appendRotated, tailFileFast, ROTATE_LIMIT } = require('../src/logutil.js');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('appendRotated 超限后行数 ≤2000 且含轮转标记', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-log-'));
  try {
    const file = path.join(dir, 'PROGRESS.md');
    for (let i = 1; i <= 2100; i++) appendRotated(file, 'line ' + i);
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/).filter(l => l !== '');
    assert.ok(lines.length <= ROTATE_LIMIT, '行数超限: ' + lines.length);
    assert.ok(lines[0].includes('日志已轮转'), '缺少轮转标记');
    assert.ok(lines.some(l => l === 'line 2100'), '最新日志丢失');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('appendRotated 未超限不截断', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-log-'));
  try {
    const file = path.join(dir, 'PROGRESS.md');
    for (let i = 1; i <= 100; i++) appendRotated(file, 'line ' + i);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l !== '');
    assert.equal(lines.length, 100);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('tailFileFast 大文件只返回最后 N 行', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-tail-'));
  try {
    const file = path.join(dir, 'PROGRESS.md');
    const lines = [];
    for (let i = 1; i <= 5000; i++) lines.push('line ' + i);
    fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
    const tail = tailFileFast(file, 3);
    assert.deepEqual(tail, ['line 4998', 'line 4999', 'line 5000']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('tailFileFast 小文件返回全部并去掉结尾空行', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-tail-'));
  try {
    const file = path.join(dir, 'PROGRESS.md');
    fs.writeFileSync(file, 'a\nb\nc\n', 'utf8');
    assert.deepEqual(tailFileFast(file, 10), ['a', 'b', 'c']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('tailFileFast 空文件返回空数组', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-tail-'));
  try {
    const file = path.join(dir, 'PROGRESS.md');
    fs.writeFileSync(file, '', 'utf8');
    assert.deepEqual(tailFileFast(file, 10), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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
