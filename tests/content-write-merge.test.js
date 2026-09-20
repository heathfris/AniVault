const test = require('node:test');
const assert = require('node:assert/strict');

test('updater写回只合并自己修改的字段并保留面板更新', () => {
  const { mergeUpdaterChanges } = require('../anime_updater.js');
  const before = {
    defaults: { max_parallel: 1 },
    anime: { A: { site_id: 1, downloaded_end: 2, skip_eps: [] } },
  };
  const updater = {
    defaults: { max_parallel: 1 },
    anime: { A: { site_id: 42, downloaded_end: 3, skip_eps: [] } },
  };
  const latestOnDisk = {
    defaults: { max_parallel: 5 },
    anime: { A: { site_id: 1, downloaded_end: 2, skip_eps: [4] } },
  };
  assert.deepEqual(mergeUpdaterChanges(latestOnDisk, updater, before), {
    defaults: { max_parallel: 5 },
    anime: { A: { site_id: 42, downloaded_end: 3, skip_eps: [4] } },
  });
});
