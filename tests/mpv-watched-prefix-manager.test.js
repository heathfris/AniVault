'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createManager } = require('../src/mpv-watched-prefix-manager.js');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'anivault-manager-'));
  const projectRoot = path.join(root, 'project');
  const sourceDir = path.join(projectRoot, 'integrations', 'mpv-watched-prefix');
  const stateDir = path.join(projectRoot, 'local', 'mpv-watched-prefix');
  const mpvRoot = path.join(root, 'mpv');
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(path.join(mpvRoot, 'portable_config'), { recursive: true });
  fs.writeFileSync(path.join(mpvRoot, 'mpv.exe'), 'stub');
  fs.writeFileSync(path.join(sourceDir, 'anivault-watched.lua'), '-- v1\n');
  return {
    root,
    projectRoot,
    sourceDir,
    stateDir,
    mpvRoot,
    manager: createManager({ projectRoot, stateDir, sourceDir, nodePath: process.execPath }),
  };
}

test('安装到临时mpv目录且默认停用', async () => {
  const f = fixture();
  try {
    assert.equal((await f.manager.getStatus({ mpvRoot: f.mpvRoot })).status.state, 'not-installed');
    const installed = await f.manager.install({ mpvRoot: f.mpvRoot });
    assert.equal(installed.ok, true);
    assert.equal(installed.status.state, 'disabled');
    assert.equal(fs.readFileSync(path.join(f.stateDir, 'enabled.flag'), 'utf8'), 'no\n');
    assert.equal(fs.existsSync(installed.status.targets.script), true);
    assert.equal(fs.existsSync(installed.status.targets.config), true);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('启停只改enabled.flag且不改变部署文件哈希', async () => {
  const f = fixture();
  try {
    const installed = await f.manager.install({ mpvRoot: f.mpvRoot });
    const before = fs.readFileSync(installed.status.targets.script);
    const enabled = await f.manager.setEnabled({ enabled: true });
    assert.equal(enabled.status.state, 'enabled');
    assert.deepEqual(fs.readFileSync(installed.status.targets.script), before);
    const disabled = await f.manager.setEnabled({ enabled: false });
    assert.equal(disabled.status.state, 'disabled');
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('项目源码变化后显示需要更新并可安全更新', async () => {
  const f = fixture();
  try {
    await f.manager.install({ mpvRoot: f.mpvRoot });
    fs.writeFileSync(path.join(f.sourceDir, 'anivault-watched.lua'), '-- v2\n');
    assert.equal((await f.manager.getStatus({})).status.state, 'update-available');
    const updated = await f.manager.update();
    assert.equal(updated.ok, true);
    assert.equal(updated.status.state, 'disabled');
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('部署文件被外部修改后拒绝更新和卸载', async () => {
  const f = fixture();
  try {
    const installed = await f.manager.install({ mpvRoot: f.mpvRoot });
    fs.writeFileSync(installed.status.targets.script, '-- user edit\n');
    assert.equal((await f.manager.getStatus({})).status.state, 'external-change');
    assert.equal((await f.manager.update()).ok, false);
    assert.equal((await f.manager.uninstall()).ok, false);
    assert.equal(fs.existsSync(installed.status.targets.script), true);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('卸载仅删除受管部署副本并保留累计状态', async () => {
  const f = fixture();
  try {
    const installed = await f.manager.install({ mpvRoot: f.mpvRoot });
    fs.writeFileSync(path.join(f.stateDir, 'state.json'), '{}');
    const result = await f.manager.uninstall();
    assert.equal(result.ok, true);
    assert.equal(result.status.state, 'not-installed');
    assert.equal(fs.existsSync(installed.status.targets.script), false);
    assert.equal(fs.existsSync(path.join(f.stateDir, 'state.json')), true);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});
