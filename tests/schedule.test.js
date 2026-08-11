'use strict';

const assert = require('node:assert/strict');
const { syncSchedule, buildCreateArgs, buildDeleteArgs } = require('../src/schedule.js');

const TASK = 'AniVaultAutoRun';
const LAUNCHER = 'D:\\x\\scripts\\auto-run.cmd';

function fakeSchtasks(handler) {
  return (cmd, args, opts) => handler(cmd, args, opts);
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('有 HH:MM 时创建任务且命令含 auto-run.cmd 全路径', () => {
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
