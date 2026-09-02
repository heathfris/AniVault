const test = require('node:test');
const assert = require('node:assert/strict');

test('download module exports engine and recovery operations', () => {
  const download = require('../src/download.js');
  for (const name of ['callIdm', 'getFfmpegTempPath', 'getMediaDurationSeconds', 'isDurationPlausible', 'chooseRecoverablePart', 'callFfmpeg', 'callAria2', 'waitForFile', 'engineChain', 'runPool']) {
    assert.equal(typeof download[name], 'function', name);
  }
});
