'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  syncSchedule, buildCreateArgs, buildDeleteArgs,
} = require('../src/schedule.js');

const TASK = 'AniVaultAutoRun';
const LAUNCHER = 'D:\\x\\scripts\\auto-run.vbs';

function fakeSchtasks(handler) {
  return (cmd, args, opts) => handler(cmd, args, opts);
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('有 HH:MM 时通过 wscript 创建无窗口任务', () => {
  const calls = [];
  const st = fakeSchtasks((cmd, args) => {
    calls.push(args);
    if (args[0] === '/query') return { status: 1, stdout: '', stderr: 'not found' };
    return { status: 0, stdout: 'ok', stderr: '' };
  });
  const r = syncSchedule({ time: '18:00', launcherPath: LAUNCHER, schtasks: st });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'created');
  const create = calls.find(a => a[0] === '/create');
  assert.ok(create);
  assert.ok(create.includes(TASK));
  assert.ok(create.some(a => a.includes(LAUNCHER)));
  assert.ok(create.includes('18:00'));
  assert.ok(create.includes('/f'));
  const taskCommand = create[create.indexOf('/tr') + 1];
  assert.equal(taskCommand, `wscript.exe //B //NoLogo "${LAUNCHER}"`);
});

test('任务已存在时改时间视为更新', () => {
  const calls = [];
  const st = fakeSchtasks((cmd, args) => {
    calls.push(args);
    if (args[0] === '/query') return { status: 0, stdout: 'exists', stderr: '' };
    return { status: 0, stdout: 'ok', stderr: '' };
  });
  const r = syncSchedule({ time: '20:00', launcherPath: LAUNCHER, schtasks: st });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'updated');
});

test('空时间删除任务', () => {
  const calls = [];
  const st = fakeSchtasks((cmd, args) => {
    calls.push(args);
    return { status: 0, stdout: 'deleted', stderr: '' };
  });
  const r = syncSchedule({ time: '', launcherPath: LAUNCHER, schtasks: st });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'deleted');
  const del = calls.find(a => a[0] === '/delete');
  assert.ok(del);
  assert.ok(del.includes(TASK));
  assert.ok(del.includes('/f'));
});

test('空白字符串按删除处理', () => {
  const calls = [];
  const st = fakeSchtasks((cmd, args) => {
    calls.push(args);
    return { status: 0, stdout: 'deleted', stderr: '' };
  });
  const r = syncSchedule({ time: '   ', launcherPath: LAUNCHER, schtasks: st });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'deleted');
  assert.ok(calls.some(a => a[0] === '/delete'));
});

test('创建失败返回 schtasks 输出与手动命令', () => {
  const st = fakeSchtasks((cmd, args) => {
    if (args[0] === '/query') return { status: 1, stdout: '', stderr: 'not found' };
    return { status: 1, stdout: '', stderr: 'ACCESS_DENIED' };
  });
  const r = syncSchedule({ time: '18:00', launcherPath: LAUNCHER, schtasks: st });
  assert.equal(r.ok, false);
  assert.ok(/ACCESS_DENIED/.test(r.output));
  assert.ok(r.command.startsWith('schtasks '));
  assert.ok(r.command.includes('/create'));
  assert.ok(r.command.includes(TASK));
});

test('buildCreateArgs 与 buildDeleteArgs 基础形状', () => {
  const c = buildCreateArgs('18:00', LAUNCHER);
  assert.deepEqual(c[0], '/create');
  assert.deepEqual(c[1], '/tn');
  assert.deepEqual(c[2], TASK);
  const d = buildDeleteArgs();
  assert.deepEqual(d[0], '/delete');
  assert.deepEqual(d[1], '/tn');
});

test('计划任务入口设置后台环境并隐藏等待子进程', () => {
  const launcher = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'auto-run.vbs'), 'utf8');
  assert.match(launcher, /ELECTRON_RUN_AS_NODE/);
  assert.match(launcher, /AGE_RUN_MODE/);
  assert.match(launcher, /AniVault\.exe/);
  assert.match(launcher, /AGE_CONTENT/);
  assert.match(launcher, /shell\.Run\(command, 0, True\)/i);
  assert.match(launcher, /WScript\.Quit exitCode/i);
});

test('Electron 保存配置时同步 VBS 启动器', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');
  assert.match(main, /path\.join\(appRoot\(\), 'scripts', 'auto-run\.vbs'\)/);
  assert.doesNotMatch(main, /launcherPath:.*auto-run\.cmd/);
});

test('Electron 调度 IPC 只暴露当前任务状态和同步入口', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.js'), 'utf8');
  assert.match(main, /ipcMain\.handle\('schedule:status'/);
  assert.doesNotMatch(main, /AGEAnimeUpdater|migrateLegacyTask|detectLegacyTask|schedule:migrate-legacy/);
  assert.doesNotMatch(preload, /schedule:migrate-legacy|scheduleMigrateLegacy/);
});

test('更新失败返回 schtasks 输出与手动命令', () => {
  const st = fakeSchtasks((cmd, args) => args[0] === '/query'
    ? { status: 0, stdout: 'exists', stderr: '' }
    : { status: 1, stdout: '', stderr: 'UPDATE_DENIED' });
  const r = syncSchedule({ time: '20:00', launcherPath: LAUNCHER, schtasks: st });
  assert.equal(r.ok, false);
  assert.equal(r.action, 'create-failed');
  assert.match(r.output, /UPDATE_DENIED/);
  assert.match(r.command, /AniVaultAutoRun/);
});

test('删除失败返回 schtasks 输出与手动命令', () => {
  const st = fakeSchtasks(() => ({ status: 1, stdout: '', stderr: 'DELETE_DENIED' }));
  const r = syncSchedule({ time: '', launcherPath: LAUNCHER, schtasks: st });
  assert.equal(r.ok, false);
  assert.equal(r.action, 'delete-failed');
  assert.match(r.output, /DELETE_DENIED/);
  assert.match(r.command, /AniVaultAutoRun/);
});

test('查询当前任务保留存在状态和输出', () => {
  const r = require('../src/schedule.js').queryTask(fakeSchtasks(() => ({ status: 0, stdout: 'ready', stderr: '' })));
  assert.deepEqual(r, { exists: true, output: 'ready' });
});

test('创建命令不包含旧任务名', () => {
  assert.doesNotMatch(buildCreateArgs('18:00', LAUNCHER).join(' '), /AGEAnimeUpdater/);
  assert.doesNotMatch(buildDeleteArgs().join(' '), /AGEAnimeUpdater/);
});

test('自动任务失败不改变当前任务名', () => {
  const r = syncSchedule({ time: '18:00', launcherPath: LAUNCHER, schtasks: fakeSchtasks(() => ({ status: 1, stdout: '', stderr: 'fail' })) });
  assert.match(r.command, /AniVaultAutoRun/);
  assert.doesNotMatch(r.command, /AGEAnimeUpdater/);
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
