const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-edge-path-logs-'));
process.env.AGE_PROGRESS = path.join(logDir, 'PROGRESS.md');
process.env.AGE_BLOCKED = path.join(logDir, 'BLOCKED.md');

const updater = require('../anime_updater.js');
const win32 = path.win32;

test('Edge 与 IDM 默认路径必须是绝对路径', () => {
  const edge = updater.getEdgePath({});
  const idm = updater.getIdmPath({});
  assert.ok(win32.isAbsolute(edge), `Edge 默认值应为绝对路径，实际 ${edge}`);
  assert.ok(win32.isAbsolute(idm), `IDM 默认值应为绝对路径，实际 ${idm}`);
  assert.match(edge, /msedge\.exe$/i);
  assert.match(idm, /IDMan\.exe$/i);
});

test('AGE_EDGE 与 AGE_IDM 覆盖默认路径', () => {
  assert.equal(updater.getEdgePath({ AGE_EDGE: 'D:\\custom\\msedge.exe' }), 'D:\\custom\\msedge.exe');
  assert.equal(updater.getIdmPath({ AGE_IDM: 'D:\\custom\\IDMan.exe' }), 'D:\\custom\\IDMan.exe');
});

test('取址抛异常时把真实原因写入进度日志', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-edge-path-'));
  const logs = [];
  try {
    await assert.rejects(updater.downloadEpisode({ title: '测试番', site_id: 1 }, 1, dir, {
      lines: [1],
      sleep: async () => {},
      getPlayUrl() { throw new Error("Failed to launch chromium because executable doesn't exist at msedge.exe"); },
      progress(msg) { logs.push(msg); },
    }));
    const failed = logs.find(msg => msg.includes('取址失败'));
    assert.ok(failed, '应打印取址失败');
    assert.match(failed, /executable doesn't exist at msedge\.exe/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
