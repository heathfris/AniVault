'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  syncSchedule, buildCreateArgs, buildDeleteArgs, migrateLegacyTask,
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
  assert.match(launcher, /shell\.Run\(command, 0, True\)/i);
  assert.match(launcher, /WScript\.Quit exitCode/i);
});

test('Electron 保存配置时同步 VBS 启动器', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');
  assert.match(main, /path\.join\(appRoot\(\), 'scripts', 'auto-run\.vbs'\)/);
  assert.doesNotMatch(main, /launcherPath:.*auto-run\.cmd/);
});

test('Electron 暴露旧任务迁移入口但不自动删除旧任务', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.js'), 'utf8');
  assert.match(main, /ipcMain\.handle\('schedule:migrate-legacy'/);
  assert.match(main, /migrateLegacyTask\(/);
  assert.match(preload, /ipcRenderer\.invoke\('schedule:migrate-legacy'/);
  assert.doesNotMatch(main, /migrateLegacyTask\([\s\S]*buildDeleteArgs/);
});

test('旧任务不存在时返回未迁移且不创建新任务', () => {
  const calls = [];
  const st = fakeSchtasks((cmd, args) => {
    calls.push(args);
    return { status: 1, stdout: '', stderr: 'not found' };
  });
  const r = migrateLegacyTask({ time: '18:00', launcherPath: LAUNCHER, schtasks: st });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'legacy-absent');
  assert.equal(calls.some(a => a[0] === '/create'), false);
});

test('旧任务存在时先创建并验证新任务且保留旧任务', () => {
  const calls = [];
  const st = fakeSchtasks((cmd, args) => {
    calls.push(args);
    if (args[0] === '/query' && args.includes('AGEAnimeUpdater')) return { status: 0, stdout: 'old', stderr: '' };
    if (args[0] === '/query') return { status: calls.filter(a => a[0] === '/query').length > 1 ? 0 : 1, stdout: 'new', stderr: '' };
    return { status: 0, stdout: 'created', stderr: '' };
  });
  const r = migrateLegacyTask({ time: '18:00', launcherPath: LAUNCHER, schtasks: st });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'migrated');
  assert.equal(r.legacyPreserved, true);
  assert.equal(calls[0][0], '/query');
  assert.equal(calls[1][0], '/query');
  assert.equal(calls[2][0], '/create');
  assert.equal(calls[3][0], '/query');
});

test('新任务创建失败时返回诊断并保留旧任务', () => {
  const st = fakeSchtasks((cmd, args) => {
    if (args[0] === '/query' && args.includes('AGEAnimeUpdater')) return { status: 0, stdout: 'old', stderr: '' };
    if (args[0] === '/query') return { status: 1, stdout: '', stderr: 'new missing' };
    return { status: 1, stdout: '', stderr: 'ACCESS_DENIED' };
  });
  const r = migrateLegacyTask({ time: '18:00', launcherPath: LAUNCHER, schtasks: st });
  assert.equal(r.ok, false);
  assert.equal(r.action, 'create-failed');
  assert.equal(r.legacyPreserved, true);
  assert.match(r.output, /ACCESS_DENIED/);
});

test('新任务创建后验证失败时返回诊断并保留旧任务', () => {
  const st = fakeSchtasks((cmd, args) => {
    if (args[0] === '/query' && args.includes('AGEAnimeUpdater')) return { status: 0, stdout: 'old', stderr: '' };
    if (args[0] === '/query') return { status: 1, stdout: '', stderr: 'not visible' };
    return { status: 0, stdout: 'created', stderr: '' };
  });
  const r = migrateLegacyTask({ time: '18:00', launcherPath: LAUNCHER, schtasks: st });
  assert.equal(r.ok, false);
  assert.equal(r.action, 'verify-failed');
  assert.equal(r.legacyPreserved, true);
});

test('重复迁移保持幂等并继续保留旧任务', () => {
  let newExists = false;
  const st = fakeSchtasks((cmd, args) => {
    if (args[0] === '/query' && args.includes('AGEAnimeUpdater')) return { status: 0, stdout: 'old', stderr: '' };
    if (args[0] === '/query') return { status: newExists ? 0 : 1, stdout: 'new', stderr: '' };
    newExists = true;
    return { status: 0, stdout: 'updated', stderr: '' };
  });
  const first = migrateLegacyTask({ time: '18:00', launcherPath: LAUNCHER, schtasks: st });
  const second = migrateLegacyTask({ time: '18:00', launcherPath: LAUNCHER, schtasks: st });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.action, 'migrated');
  assert.equal(second.legacyPreserved, true);
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
