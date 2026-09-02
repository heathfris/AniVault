'use strict';

const { spawnSync } = require('node:child_process');

const TASK_NAME = 'AniVaultAutoRun';
const LEGACY_TASK_NAME = 'AGEAnimeUpdater';

function buildCreateArgs(time, launcherPath) {
  const taskCommand = `wscript.exe //B //NoLogo "${launcherPath}"`;
  return ['/create', '/tn', TASK_NAME, '/tr', taskCommand, '/sc', 'daily', '/st', time, '/f'];
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

function queryNamedTask(taskName, schtasks = spawnSync) {
  const r = runSchtasks(['/query', '/tn', taskName], schtasks);
  return { exists: r.status === 0, output: r.output };
}

function queryTask(schtasks = spawnSync) {
  return queryNamedTask(TASK_NAME, schtasks);
}

function detectLegacyTask(schtasks = spawnSync) {
  const result = queryNamedTask(LEGACY_TASK_NAME, schtasks);
  return { taskName: LEGACY_TASK_NAME, exists: result.exists, output: result.output };
}

function migrateLegacyTask({ time, launcherPath, schtasks = spawnSync } = {}) {
  const legacy = detectLegacyTask(schtasks);
  if (!legacy.exists) {
    return { ok: true, action: 'legacy-absent', legacyExists: false, legacyPreserved: false, output: legacy.output };
  }
  const normalized = typeof time === 'string' ? time.trim() : '';
  if (!normalized) {
    return { ok: false, action: 'invalid-time', legacyExists: true, legacyPreserved: true, output: '迁移需要 HH:MM 时间' };
  }
  const current = queryTask(schtasks);
  const args = buildCreateArgs(normalized, launcherPath);
  const created = runSchtasks(args, schtasks);
  if (created.status !== 0) {
    return {
      ok: false, action: 'create-failed', legacyExists: true, legacyPreserved: true,
      output: created.output, command: 'schtasks ' + args.join(' '), previous: current,
    };
  }
  const verified = queryTask(schtasks);
  if (!verified.exists) {
    return {
      ok: false, action: 'verify-failed', legacyExists: true, legacyPreserved: true,
      output: verified.output || '新任务查询失败', command: 'schtasks ' + args.join(' '), previous: current,
    };
  }
  return {
    ok: true, action: 'migrated', legacyExists: true, legacyPreserved: true,
    output: created.output + verified.output, command: 'schtasks ' + args.join(' '),
    previous: current,
  };
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

module.exports = {
  TASK_NAME, LEGACY_TASK_NAME, buildCreateArgs, buildDeleteArgs,
  queryTask, detectLegacyTask, migrateLegacyTask, syncSchedule,
};
