'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', 'integrations', 'mpv-watched-prefix', 'anivault-watched.lua');

test('停用检查发生在注册任何mpv事件和计时器之前', () => {
  const lua = fs.readFileSync(source, 'utf8');
  const enabledCheck = lua.indexOf("enabled ~= 'yes'");
  assert.ok(enabledCheck >= 0);
  for (const token of ['mp.register_event', 'mp.add_periodic_timer']) {
    assert.ok(lua.indexOf(token) > enabledCheck, `${token}出现在停用检查之前`);
  }
});

test('Lua采样四个阻断属性并限制单次累计', () => {
  const lua = fs.readFileSync(source, 'utf8');
  for (const property of ['pause', 'core-idle', 'paused-for-cache', 'seeking']) assert.ok(lua.includes(property));
  assert.ok(lua.includes('math.min(delta, 2)'));
});

test('只有shutdown路径启动detached助手', () => {
  const lua = fs.readFileSync(source, 'utf8');
  assert.ok(lua.includes("mp.register_event('shutdown', on_shutdown)"));
  assert.ok(lua.includes('utils.subprocess_detached'));
  assert.ok(lua.includes('apply-watched-prefix.js'));
});
