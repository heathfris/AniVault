'use strict';

const { spawnSync } = require('node:child_process');

const TASK_NAME = 'AniVaultAutoRun';

function buildCreateArgs(time, launcherPath) {
  return ['/create', '/tn', TASK_NAME, '/tr', `"${launcherPath}"`, '/sc', 'daily', '/st', time, '/f'];
}

function buildDeleteArgs() {
  return ['/delete', '/tn', TASK_NAME, '/f'];
}

function runSchtasks(args, schtasks = spawnSync) {
  const r = schtasks('schtasks.exe', args, { encoding: 'utf8', windowsHide: true });
  return {
    status: r && r.status !== undefined ? r.status : 1,
    output: ((r && r.stdout) || '') + ((r && r.stderr) || ''),
  };
}

function queryTask(schtasks = spawnSync) {
  const r = runSchtasks(['/query', '/tn', TASK_NAME], schtasks);
  return { exists: r.status === 0, output: r.output };
}

function syncSchedule({ time, launcherPath, schtasks = spawnSync }) {
  const normalized = typeof time === 'string' ? time.trim() : '';
  if (!normalized) {
    const r = runSchtasks(buildDeleteArgs(), schtasks);
    return {
      ok: r.status === 0,
      action: r.status === 0 ? 'deleted' : 'delete-failed',
      output: r.output,
      command: 'schtasks ' + buildDeleteArgs().join(' '),
    };
  }
  const existed = queryTask(schtasks).exists;
  const args = buildCreateArgs(normalized, launcherPath);
  const r = runSchtasks(args, schtasks);
  return {
    ok: r.status === 0,
    action: r.status === 0 ? (existed ? 'updated' : 'created') : 'create-failed',
    output: r.output,
    command: 'schtasks ' + args.join(' '),
  };
}

module.exports = { TASK_NAME, buildCreateArgs, buildDeleteArgs, queryTask, syncSchedule };
