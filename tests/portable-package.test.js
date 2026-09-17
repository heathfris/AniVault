'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getPortableManifest } = require('../scripts/package-portable.js');
const { getDataRoot } = require('../src/app-paths.js');

test('portable manifest includes runtime files but excludes local user data', () => {
  const manifest = getPortableManifest('D:\\release\\AniVault');

  assert.equal(manifest.launcher, 'AniVault.exe');
  assert.ok(manifest.files.includes('resources\\app\\tools\\aria2\\aria2c.exe'));
  assert.ok(manifest.files.includes('resources\\app\\tools\\ffmpeg\\ffmpeg.exe'));
  assert.ok(manifest.files.includes('resources\\app\\node_modules\\playwright-core'));
  assert.ok(!manifest.files.some(file => file.startsWith('local\\')));
  assert.ok(!manifest.files.includes('content.json'));
});

test('packaged app stores mutable data in userData', () => {
  assert.equal(getDataRoot({ isPackaged: true, getPath: () => 'C:\\Users\\demo\\AppData\\Roaming\\AniVault' }, 'D:\\app\\resources\\app'), 'C:\\Users\\demo\\AppData\\Roaming\\AniVault');
  assert.equal(getDataRoot({ isPackaged: false, getPath: () => 'ignored' }, 'D:\\app'), 'D:\\app');
});
