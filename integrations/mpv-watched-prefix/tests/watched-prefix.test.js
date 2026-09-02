'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  mergeEvents,
  applyQualifiedRenames,
  runSession,
} = require('../apply-watched-prefix.js');

function event(seq, episode, eligible, position, duration = 100) {
  return {
    v: 1,
    seq,
    anime_key: '片名',
    relative_path: `片名_${episode}.mp4`,
    episode,
    size: 123,
    mtime: 456,
    duration,
    eligible_delta: eligible,
    time_pos: position,
  };
}

test('45%有效时长和90%播放位置都达标才产生结果', () => {
  for (const [eligible, position, qualified] of [[44, 89, false], [45, 89, false], [44, 90, false], [45, 90, true]]) {
    const result = mergeEvents({}, 'session-a.jsonl', [event(1, 8, eligible, position)]);
    assert.equal(result.qualified.length === 1, qualified, `${eligible}/${position}`);
  }
});

test('相同session和seq重复读取不重复累计', () => {
  const first = mergeEvents({}, 'session-a.jsonl', [event(1, 8, 45, 50)]);
  const second = mergeEvents(first.state, 'session-a.jsonl', [event(1, 8, 45, 50)]);
  const entry = Object.values(second.state.files)[0];
  assert.equal(entry.eligible_seconds, 45);
  assert.equal(second.qualified.length, 0);
});

test('先看完8再看完3时最后结果为3', () => {
  const result = mergeEvents({}, 'session-a.jsonl', [event(1, 8, 90, 90), event(2, 3, 90, 90)]);
  assert.deepEqual(result.qualified.map(x => x.episode), [8, 3]);
});

test('只替换watched并在目标冲突时拒绝覆盖', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-watch-'));
  try {
    const oldName = '13_片名1-14 [1080P]';
    fs.mkdirSync(path.join(root, oldName));
    const config = { anime: { '片名': { folder_name: '{watched}_{name}{start}-{end} [1080P]', downloaded_start: 1, downloaded_end: 14 } } };
    const ok = applyQualifiedRenames({ downloadRoot: root, config, qualified: [{ anime_key: '片名', episode: 3 }] });
    assert.equal(ok.ok, true);
    assert.equal(fs.existsSync(path.join(root, '3_片名1-14 [1080P]')), true);

    fs.mkdirSync(path.join(root, '8_片名1-14 [1080P]'));
    const blocked = applyQualifiedRenames({ downloadRoot: root, config, qualified: [{ anime_key: '片名', episode: 8 }] });
    assert.equal(blocked.ok, false);
    assert.equal(fs.existsSync(path.join(root, '3_片名1-14 [1080P]')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('正常关闭时会合并此前崩溃会话留下的未提交事件', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-recover-'));
  try {
    const stateDir = path.join(root, 'state');
    const downloadRoot = path.join(root, 'downloads');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.mkdirSync(path.join(downloadRoot, '0_片名1-14'), { recursive: true });
    const contentFile = path.join(root, 'content.json');
    fs.writeFileSync(contentFile, JSON.stringify({ anime: { '片名': { folder_name: '{watched}_{name}{start}-{end}', file_name: '{name}_{ep}.mp4', downloaded_start: 1, downloaded_end: 14 } } }));
    fs.writeFileSync(path.join(stateDir, 'session-crashed.jsonl'), JSON.stringify(event(1, 8, 45, 50)) + '\n');
    const current = path.join(stateDir, 'session-current.jsonl');
    fs.writeFileSync(current, JSON.stringify(event(1, 8, 45, 90)) + '\n');
    const result = runSession({ stateDir, sessionFile: current, contentFile, downloadRoot });
    assert.equal(result.ok, true);
    assert.equal(fs.existsSync(path.join(downloadRoot, '8_片名1-14')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
