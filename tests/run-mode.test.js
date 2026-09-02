'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const statePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-run-mode-')), 'task_state.json');
fs.writeFileSync(statePath, JSON.stringify({ run_mode: 'password' }) + '\n', 'utf8');
process.env.AGE_TASK_STATE = statePath;
delete process.env.AGE_RUN_MODE;
const updater = require('../anime_updater.js');

const anime = { title: 'Test Anime', site_id: 1 };
const common = {
  resolveFileName: () => ({ name: 'Test Anime_01.mp4' }),
  findEpisodeFile: () => null,
  getPlayUrl: async () => 'https://example.test/video.mp4',
  callIdm: () => { calls.push('idm'); return { status: 1, stderr: 'stop' }; },
  callAria2: () => { calls.push('aria2'); return { status: 1, stderr: 'stop' }; },
  callFfmpeg: () => { calls.push('ffmpeg'); return { status: 1, stderr: 'stop' }; },
  progress: () => {},
  lines: [1],
  minSize: 1,
};
let calls;

async function run(runMode) {
  calls = [];
  await assert.rejects(updater.downloadEpisode(anime, 1, fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-run-')), {
    ...common,
    engine: 'idm',
    ...(runMode === undefined ? {} : { runMode }),
  }));
  return calls;
}

(async () => {
  assert.deepEqual(await run(), ['idm', 'aria2', 'ffmpeg']);
  assert.deepEqual(await run('interactive'), ['idm', 'aria2', 'ffmpeg']);
  assert.deepEqual(await run('password'), ['aria2', 'ffmpeg']);
  console.log('PASS run mode defaults to interactive without task state and preserves explicit modes');
})().catch(error => {
  console.error('FAIL run mode behavior');
  console.error(error);
  process.exitCode = 1;
});
