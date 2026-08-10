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

function tailFile(file, n) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.slice(Math.max(0, lines.length - n));
}

module.exports = { parseCsv, readCsv, tailFile };
