const test = require('node:test');
const assert = require('node:assert/strict');

test('site module exports AGE site operations', () => {
  const site = require('../src/site.js');
  for (const name of ['createBrowserPool', 'fetchText', 'searchSite', 'parseHomeUpdateTimes', 'getHomeUpdateTimes', 'getMaxEp', 'getPlayUrl']) {
    assert.equal(typeof site[name], 'function', name);
  }
});
