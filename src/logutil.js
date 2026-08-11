'use strict';

const fs = require('node:fs');

const ROTATE_LIMIT = 2000;
const TAIL_CHUNK = 64 * 1024;

function appendRotated(file, line, limit = ROTATE_LIMIT) {
  fs.appendFileSync(file, line + '\n', 'utf8');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return;
  }
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  if (lines.length <= limit) return;
  const keep = lines.slice(lines.length - (limit - 1));
  const stamp = new Date().toISOString();
  fs.writeFileSync(file, '# 日志已轮转（' + stamp + '）\n' + keep.join('\n') + '\n', 'utf8');
}

function tailFileFast(file, n = 200) {
  let size;
  try {
    size = fs.statSync(file).size;
  } catch (e) {
    return [];
  }
  if (size === 0) return [];
  const start = Math.max(0, size - TAIL_CHUNK);
  const fd = fs.openSync(file, 'r');
  let buf;
  try {
    buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
  } finally {
    fs.closeSync(fd);
  }
  let text = buf.toString('utf8');
  if (start > 0) {
    const idx = text.indexOf('\n');
    if (idx >= 0) text = text.slice(idx + 1);
  }
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.slice(-n);
}

module.exports = { appendRotated, tailFileFast, ROTATE_LIMIT };
