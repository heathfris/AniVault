'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const rendererJs = fs.readFileSync(path.join(root, 'renderer', 'renderer.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'renderer', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');

const checks = [];
function check(name, fn) {
  checks.push({ name, fn });
}

check('renderer 中不再有“片名”文字标签', () => {
  assert.ok(!rendererJs.includes('片名'), 'renderer.js 仍包含“片名”');
  assert.ok(!html.includes('片名'), 'index.html 仍包含“片名”');
});

check('input/select 统一控件规则存在', () => {
  const start = styles.indexOf('input[type="text"],');
  assert.ok(start >= 0, '缺少统一选择器 input[type="text"],');
  const block = styles.slice(start, start + 800);
  assert.ok(block.includes('input[type="number"],'), '缺少 input[type="number"],');
  assert.ok(block.includes('select {'), '缺少 select {');
  assert.ok(block.includes('height: 30px'), '缺少 height: 30px');
  assert.ok(block.includes('border-radius: 6px'), '缺少 border-radius: 6px');
  assert.ok(block.includes('#BCCCD9'), '缺少边框色 #BCCCD9');
  assert.ok(block.includes('6px 10px'), '缺少内边距 6px 10px');
});

check('存在 ≤1000px 响应式 media query', () => {
  assert.ok(/@media\s*\(\s*max-width\s*:\s*1000px\s*\)/.test(styles), '缺少 max-width:1000px media query');
});

check('存在空状态文案', () => {
  assert.ok(rendererJs.includes('暂无追番，点击右上角添加番剧'), '缺少空状态文案');
});

check('.log 有固定高度', () => {
  const start = styles.indexOf('.log {');
  assert.ok(start >= 0, '缺少 .log 规则');
  const block = styles.slice(start, styles.indexOf('}', start));
  assert.ok(/height\s*:\s*320px/.test(block), '.log 缺少 height:320px');
});

check('hint 有独立浅灰样式', () => {
  const start = styles.indexOf('.hint {');
  assert.ok(start >= 0, '缺少 .hint 规则');
  const block = styles.slice(start, styles.indexOf('}', start));
  assert.ok(/#829AB1/.test(block), 'hint 缺少 #829AB1');
  assert.ok(/font-size\s*:\s*11px/.test(block), 'hint 缺少 11px');
});

check('删除按钮有危险色', () => {
  assert.ok(rendererJs.includes('class="del danger"'), '删除按钮缺少 danger 类');
  assert.ok(/#B3261E/.test(styles) || /--color-error/.test(styles), '缺少危险色 #B3261E');
});

check('条目 hover 浅底色', () => {
  const idx = styles.indexOf('.anime-card:hover');
  assert.ok(idx >= 0, '缺少 .anime-card:hover');
  const block = styles.slice(idx, styles.indexOf('}', idx));
  assert.ok(/#F0F4F8/.test(block) || /--color-hover/.test(block), 'hover 缺少浅底色 #F0F4F8');
});

check('存在「编辑」按钮', () => {
  assert.ok(rendererJs.includes('class="edit"'), '缺少 edit 按钮');
});

let passed = 0;
for (const c of checks) {
  try {
    c.fn();
    passed += 1;
    console.log('PASS ' + c.name);
  } catch (e) {
    console.error('FAIL ' + c.name + ': ' + e.message);
  }
}
const failed = checks.length - passed;
console.log(passed + ' PASS, ' + failed + ' FAIL, skipped=0');
if (failed > 0) process.exitCode = 1;
