'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const folders = require('../src/folders.js');

test('folders module exposes the existing folder responsibilities', () => {
  const names = [
    'parseFolderName',
    'applyTemplate',
    'matchFolderTemplate',
    'validName',
    'resolveFolderName',
    'resolveFileName',
    'renameFolder',
    'renameWithRetrySync',
    'getEpisodeFileMatcher',
    'findFolderByTitle',
    'findFolder',
    'countEpisodeFiles',
    'findEpisodeFile',
    'safeRenameFolder',
  ];
  for (const name of names) assert.equal(typeof folders[name], 'function', name);
});
