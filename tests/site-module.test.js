const test = require('node:test');
const assert = require('node:assert/strict');

test('site module exports AGE site operations', () => {
  const site = require('../src/site.js');
  for (const name of ['createBrowserPool', 'fetchText', 'searchSite', 'parseHomeUpdateTimes', 'getHomeUpdateTimes', 'getMaxEp', 'getPlayUrl']) {
    assert.equal(typeof site[name], 'function', name);
  }
});

test('searchSite匹配配置的base URL而不是固定域名', async () => {
  const site = require('../src/site.js');
  const result = await site.searchSite('番剧,特别篇', {
    baseUrl: 'https://mirror.example.test',
    fetchTextImpl: async url => {
      assert.equal(url, 'https://mirror.example.test/search?query=%E7%95%AA%E5%89%A7%2C%E7%89%B9%E5%88%AB%E7%AF%87');
      return '<a href="https://mirror.example.test/detail/42">番剧,特别篇</a>';
    },
  });
  assert.deepEqual(result, { id: 42, title: '番剧,特别篇' });
});
