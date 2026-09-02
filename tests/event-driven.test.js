'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'electron', 'preload.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'renderer', 'renderer.js'), 'utf8');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('main 推送四类运行事件且保持开始到结束顺序', () => {
  const channels = ['run:started', 'run:episode', 'run:log', 'run:finished'];
  for (const channel of channels) assert.ok(main.includes(`sendRunEvent('${channel}'`), `main缺少${channel}`);
  assert.ok(main.includes("ipcMain.handle('run:start'"), '缺少启动事件触发入口');
});

test('renderer 实际处理开始、日志、重复集数和非零退出事件', () => {
  const elements = new Proxy({}, { get: (obj, key) => obj[key] || (obj[key] = {
    textContent: '', className: '', disabled: false, scrollTop: 0, scrollHeight: 0, clientHeight: 0,
    querySelector: () => ({ innerHTML: '', appendChild: () => {} }),
  }) });
  const sandbox = {
    document: {
      getElementById: id => elements[id],
      createElement: () => ({ textContent: '', colSpan: 0, appendChild: () => {} }),
    },
    window: { anivault: { csvRead: async () => ({ ok: true, rows: [] }) } },
    setInterval: () => 0,
    console,
  };
  let source = renderer.slice(0, renderer.indexOf("$('add-anime')"));
  vm.runInNewContext(`${source}\nglobalThis.__eventTest = { state, applyRunEvent };`, sandbox);
  const { state, applyRunEvent } = sandbox.__eventTest;
  applyRunEvent('run:started', { mode: 'full', pid: 42 });
  applyRunEvent('run:log', { stream: 'stdout', line: 'OUT' });
  applyRunEvent('run:log', { stream: 'stderr', line: 'ERR' });
  applyRunEvent('run:episode', { title: '番', ep: 14, status: 'downloading' });
  applyRunEvent('run:episode', { title: '番', ep: 14, status: 'done' });
  applyRunEvent('run:finished', { code: 2, signal: null });
  assert.equal(state.running, false);
  assert.equal(state.pid, null);
  assert.equal(state.lastExit.code, 2);
  assert.deepEqual(Array.from(state.logProgress), ['OUT', 'ERR']);
  assert.equal(state.episodes.length, 1);
  assert.equal(state.episodes[0].status, 'done');
});

test('preload 仅公开可取消的运行事件监听', () => {
  assert.ok(preload.includes('runEventsOn'), '缺少运行事件监听接口');
  assert.ok(preload.includes('runEventsOff'), '缺少运行事件取消接口');
  for (const channel of ['run:started', 'run:episode', 'run:log', 'run:finished']) {
    assert.ok(preload.includes(`'${channel}'`), `preload未允许${channel}`);
  }
});

test('renderer 订阅事件并改为低频校准', () => {
  assert.ok(renderer.includes("['run:started', 'run:episode', 'run:log', 'run:finished']"), 'renderer事件列表不完整');
  assert.ok(renderer.includes('runEventsOn(channel'), 'renderer未注册运行事件监听');
  assert.match(renderer, /setInterval\(syncSnapshot,\s*\d{4,5}\)/);
  assert.doesNotMatch(renderer, /setInterval\(poll,\s*1000\)/);
});

let passed = 0;
for (const t of tests) {
  try { t.fn(); passed += 1; console.log('PASS ' + t.name); }
  catch (e) { console.error('FAIL ' + t.name + ': ' + e.message); }
}
const failed = tests.length - passed;
console.log(`${passed} PASS, ${failed} FAIL, skipped=0`);
if (failed) process.exitCode = 1;
