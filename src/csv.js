'use strict';

const fs = require('node:fs');

function parseCsv(text) {
  const rows = [];
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    if (parts.length < 3) continue;
    const ep = parseInt(parts[1], 10);
    if (!Number.isInteger(ep)) continue;
    rows.push({ title: parts[0].trim(), ep, url: parts[2].trim() });
  }
  return rows;
}

function readCsv(file) {
  return parseCsv(fs.readFileSync(file, 'utf8'));
}

function removeCsvRow(file, title, ep) {
  const text = fs.readFileSync(file, 'utf8');
  const bom = text.startsWith('\uFEFF') ? '\uFEFF' : '';
  const body = bom ? text.slice(1) : text;
  const newline = body.includes('\r\n') ? '\r\n' : '\n';
  const trailingNewline = /\r?\n$/.test(body);
  const lines = body.split(/\r?\n/);
  if (trailingNewline) lines.pop();
  if (lines[0] !== '动漫,集数,播放页URL') throw new Error('CSV格式错误：表头不合法');

  const matches = [];
  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    const parts = lines[i].split(',');
    const rowEp = Number.parseInt(parts[1], 10);
    if (parts.length < 3 || !Number.isInteger(rowEp)) throw new Error(`CSV格式错误：第${i + 1}行不合法`);
    if (parts[0].trim() === title && rowEp === ep) matches.push(i);
  }
  if (matches.length !== 1) throw new Error(`目标应恰好1行，实际${matches.length}行`);

  lines.splice(matches[0], 1);
  const next = bom + lines.join(newline) + (trailingNewline ? newline : '');
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, next, 'utf8');
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch {}
    throw e;
  }
}

function tailFile(file, n) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.slice(Math.max(0, lines.length - n));
}

module.exports = { parseCsv, readCsv, removeCsvRow, tailFile };
