'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const rendererJs = fs.readFileSync(path.join(root, 'renderer', 'renderer.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'renderer', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

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

check('下载目录配置体现 AGE_DLOAD', () => {
  assert.ok(html.includes('id="download_dir"'), '缺少 download_dir 输入框');
  assert.ok(rendererJs.includes('downloadDirSource'), '缺少生效来源提示');
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

check('package 版本与 VERSION 一致', () => {
  assert.equal(pkg.version, version, 'package.json version 与 VERSION 不一致');
});

check('界面版本徽标与 VERSION 一致', () => {
  assert.ok(
    html.includes(`<span class="version-badge">v${version}</span>`),
    `界面版本徽标不是 v${version}`,
  );
});

check('pnpm test 覆盖全部测试入口', () => {
  assert.ok(pkg.scripts.test.includes('node tests/run-tests.js'), '缺少主流程测试');
  assert.ok(pkg.scripts.test.includes('node --test'), '缺少 Node test runner');
  assert.ok(pkg.scripts.test.includes('node tests/ui-check.js'), '缺少 UI 检查');
});

check('截图脚本包含 Viz 兼容参数', () => {
  assert.ok(pkg.scripts.screenshot.includes('--in-process-gpu'), '缺少 --in-process-gpu');
  assert.ok(
    pkg.scripts.screenshot.includes('--disable-features=CalculateNativeWinOcclusion'),
    '缺少 CalculateNativeWinOcclusion 兼容参数',
  );
  assert.ok(pkg.scripts.screenshot.includes('--user-data-dir=local/screenshot-profile'), '缺少独立截图 profile');
});

check('mpv观看同步卡片和五个操作入口存在', () => {
  assert.ok(html.includes('id="mpv-sync"'), '缺少mpv观看同步卡片');
  for (const id of ['mpv-sync-check', 'mpv-sync-install', 'mpv-sync-toggle', 'mpv-sync-update', 'mpv-sync-uninstall']) {
    assert.ok(html.includes(`id="${id}"`), `缺少${id}`);
  }
  for (const method of ['mpvSyncStatus', 'mpvSyncInstall', 'mpvSyncUpdate', 'mpvSyncSetEnabled', 'mpvSyncUninstall']) {
    assert.ok(rendererJs.includes(`window.anivault.${method}`), `renderer缺少${method}`);
  }
});

check('folder_name界面提示watched是单番启用开关', () => {
  assert.ok(rendererJs.includes('{watched}'), 'folder_name缺少{watched}提示');
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
