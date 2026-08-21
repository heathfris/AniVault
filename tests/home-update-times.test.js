'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { parseHomeUpdateTimes } = require('../anime_updater.js');

test('首页更新时间只接受严格 HH:MM，拒绝年份', () => {
  const html = [
    '<li><a>正常番剧</a><span class="title_sub">22:30</span></li>',
    '<li><a>年份误判番剧</a><span class="title_sub">2026</span></li>',
  ].join('');

  assert.deepEqual(parseHomeUpdateTimes(html), { 正常番剧: '22:30' });
});
