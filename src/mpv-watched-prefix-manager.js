'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

function sha256(value) {
  const buffer = Buffer.isBuffer(value) ? value : fs.readFileSync(value);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function atomicWrite(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, file);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function createManager(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.join(__dirname, '..'));
  const stateDir = path.resolve(options.stateDir || path.join(projectRoot, 'local', 'mpv-watched-prefix'));
  const sourceDir = path.resolve(options.sourceDir || path.join(projectRoot, 'integrations', 'mpv-watched-prefix'));
  function findNodePath() {
    if (options.nodePath) return path.resolve(options.nodePath);
    if (process.env.AGE_NODE) return path.resolve(process.env.AGE_NODE);
    if (path.basename(process.execPath).toLowerCase() === 'node.exe') return process.execPath;
    const found = spawnSync('where.exe', ['node.exe'], { encoding: 'utf8', windowsHide: true });
    const first = found.status === 0 ? (found.stdout || '').split(/\r?\n/).find(Boolean) : null;
    return first ? path.resolve(first.trim()) : process.execPath;
  }
  const nodePath = findNodePath();
  const installStateFile = path.join(stateDir, 'install-state.json');
  const transactionFile = path.join(stateDir, 'install-transaction.json');
  const enabledFile = path.join(stateDir, 'enabled.flag');
  const sourceScript = path.join(sourceDir, 'anivault-watched.lua');

  function targets(mpvRoot) {
    const root = path.resolve(mpvRoot);
    return {
      script: path.join(root, 'portable_config', 'scripts', 'anivault-watched.lua'),
      config: path.join(root, 'portable_config', 'script-opts', 'anivault-watched.conf'),
    };
  }

  function configText() {
    const clean = value => path.resolve(value).replace(/\\/g, '/');
    return [
      `project_root=${clean(projectRoot)}`,
      `node_path=${clean(nodePath)}`,
      `state_dir=${clean(stateDir)}`,
      '',
    ].join('\n');
  }

  function sourceHashes() {
    return { script: sha256(sourceScript), config: sha256(Buffer.from(configText(), 'utf8')) };
  }

  function recoverTransaction() {
    const transaction = readJson(transactionFile);
    if (!transaction) return { ok: true };
    try {
      for (const item of [...transaction.items].reverse()) {
        if (item.existed) {
          fs.mkdirSync(path.dirname(item.target), { recursive: true });
          fs.copyFileSync(item.backup, item.target);
        } else if (fs.existsSync(item.target)) {
          fs.unlinkSync(item.target);
        }
      }
      fs.unlinkSync(transactionFile);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: `上次操作恢复失败: ${error.message}` };
    }
  }

  function startTransaction(operation, targetFiles) {
    fs.mkdirSync(stateDir, { recursive: true });
    const id = `${Date.now()}-${process.pid}`;
    const backupDir = path.join(stateDir, 'backup', id);
    const items = targetFiles.map((target, index) => {
      const existed = fs.existsSync(target);
      const backup = path.join(backupDir, `${index}.bak`);
      if (existed) {
        fs.mkdirSync(backupDir, { recursive: true });
        fs.copyFileSync(target, backup);
      }
      return { target, existed, backup };
    });
    atomicWrite(transactionFile, JSON.stringify({ v: 1, operation, phase: 'prepared', items }, null, 2) + '\n');
    return { items };
  }

  function finishTransaction() {
    if (fs.existsSync(transactionFile)) fs.unlinkSync(transactionFile);
  }

  function markTransaction(phase) {
    const transaction = readJson(transactionFile);
    if (!transaction) throw new Error('安装事务日志丢失');
    transaction.phase = phase;
    atomicWrite(transactionFile, JSON.stringify(transaction, null, 2) + '\n');
  }

  function enabledValue() {
    try { return fs.readFileSync(enabledFile, 'utf8').trim() === 'yes'; } catch (_) { return false; }
  }

  async function getStatus(input = {}) {
    const recovered = recoverTransaction();
    const state = readJson(installStateFile);
    const requestedRoot = input.mpvRoot ? path.resolve(input.mpvRoot) : null;
    const mpvRoot = requestedRoot || (state && state.mpv_root ? path.resolve(state.mpv_root) : null);
    const targetMap = mpvRoot ? targets(mpvRoot) : { script: null, config: null };
    const base = { enabled: enabledValue(), mpvRoot, targets: targetMap, reason: null };
    if (!recovered.ok) return { ok: false, status: Object.assign(base, { state: 'external-change', reason: recovered.error }), error: recovered.error };
    if (!mpvRoot) return { ok: true, status: Object.assign(base, { state: 'not-installed' }), error: null };
    if (!fs.existsSync(path.join(mpvRoot, 'mpv.exe')) || !fs.existsSync(path.join(mpvRoot, 'portable_config'))) {
      return { ok: true, status: Object.assign(base, { state: 'path-error', reason: '所选目录缺少mpv.exe或portable_config' }), error: null };
    }
    if (!inside(mpvRoot, targetMap.script) || !inside(mpvRoot, targetMap.config)) {
      return { ok: true, status: Object.assign(base, { state: 'path-error', reason: '部署目标越出mpv目录' }), error: null };
    }
    const present = fs.existsSync(targetMap.script) && fs.existsSync(targetMap.config);
    if (!state) {
      return { ok: true, status: Object.assign(base, {
        state: present ? 'external-change' : 'not-installed',
        reason: present ? '目标文件已存在但没有番仓安装记录' : null,
      }), error: null };
    }
    if (path.resolve(state.mpv_root) !== mpvRoot || !present) {
      return { ok: true, status: Object.assign(base, { state: 'external-change', reason: '安装记录与部署文件不一致' }), error: null };
    }
    const deployed = { script: sha256(targetMap.script), config: sha256(targetMap.config) };
    if (!state.files || deployed.script !== state.files.script.sha256 || deployed.config !== state.files.config.sha256) {
      return { ok: true, status: Object.assign(base, { state: 'external-change', reason: '部署文件已被外部修改' }), error: null };
    }
    let source;
    try { source = sourceHashes(); } catch (error) {
      return { ok: true, status: Object.assign(base, { state: 'path-error', reason: `项目源码不可读: ${error.message}` }), error: null };
    }
    if (source.script !== deployed.script || source.config !== deployed.config) {
      return { ok: true, status: Object.assign(base, { state: 'update-available' }), error: null };
    }
    return { ok: true, status: Object.assign(base, { state: base.enabled ? 'enabled' : 'disabled' }), error: null };
  }

  async function install({ mpvRoot }) {
    if (typeof mpvRoot !== 'string' || !mpvRoot.trim()) {
      const status = { state: 'path-error', enabled: false, mpvRoot: null, targets: { script: null, config: null }, reason: '请先填写mpv根目录' };
      return { ok: false, status, error: status.reason };
    }
    const before = await getStatus({ mpvRoot });
    if (before.status.state !== 'not-installed') return { ok: false, status: before.status, error: `当前状态不能安装: ${before.status.state}` };
    const targetMap = targets(mpvRoot);
    try {
      const scriptData = fs.readFileSync(sourceScript);
      const configData = Buffer.from(configText(), 'utf8');
      startTransaction('install', [targetMap.script, targetMap.config, installStateFile, enabledFile]);
      atomicWrite(targetMap.script, scriptData);
      markTransaction('script-written');
      atomicWrite(targetMap.config, configData);
      markTransaction('config-written');
      const state = {
        v: 1,
        mpv_root: path.resolve(mpvRoot),
        files: {
          script: { relative_path: path.relative(path.resolve(mpvRoot), targetMap.script), sha256: sha256(scriptData) },
          config: { relative_path: path.relative(path.resolve(mpvRoot), targetMap.config), sha256: sha256(configData) },
        },
        installed_at: new Date().toISOString(),
      };
      atomicWrite(installStateFile, JSON.stringify(state, null, 2) + '\n');
      markTransaction('state-written');
      atomicWrite(enabledFile, 'no\n');
      markTransaction('enabled-written');
      finishTransaction();
      return getStatus({ mpvRoot });
    } catch (error) {
      const recovery = recoverTransaction();
      const status = (await getStatus({ mpvRoot })).status;
      return { ok: false, status, error: `安装失败: ${error.message}${recovery.ok ? '' : `；${recovery.error}`}` };
    }
  }

  async function setEnabled({ enabled }) {
    const before = await getStatus({});
    if (!['disabled', 'enabled', 'update-available'].includes(before.status.state)) {
      return { ok: false, status: before.status, error: `当前状态不能启停: ${before.status.state}` };
    }
    try {
      atomicWrite(enabledFile, enabled ? 'yes\n' : 'no\n');
      return getStatus({});
    } catch (error) {
      return { ok: false, status: (await getStatus({})).status, error: `启停失败: ${error.message}` };
    }
  }

  async function update() {
    const before = await getStatus({});
    if (before.status.state === 'external-change') return { ok: false, status: before.status, error: before.status.reason };
    if (before.status.state !== 'update-available') return { ok: false, status: before.status, error: `当前状态不能更新: ${before.status.state}` };
    const targetMap = before.status.targets;
    try {
      const scriptData = fs.readFileSync(sourceScript);
      const configData = Buffer.from(configText(), 'utf8');
      startTransaction('update', [targetMap.script, targetMap.config, installStateFile]);
      atomicWrite(targetMap.script, scriptData);
      markTransaction('script-written');
      atomicWrite(targetMap.config, configData);
      markTransaction('config-written');
      const state = readJson(installStateFile);
      state.files.script.sha256 = sha256(scriptData);
      state.files.config.sha256 = sha256(configData);
      state.installed_at = new Date().toISOString();
      atomicWrite(installStateFile, JSON.stringify(state, null, 2) + '\n');
      markTransaction('state-written');
      finishTransaction();
      return getStatus({});
    } catch (error) {
      const recovery = recoverTransaction();
      return { ok: false, status: (await getStatus({})).status, error: `更新失败: ${error.message}${recovery.ok ? '' : `；${recovery.error}`}` };
    }
  }

  async function uninstall() {
    const before = await getStatus({});
    if (before.status.state === 'external-change') return { ok: false, status: before.status, error: before.status.reason };
    if (!['disabled', 'enabled', 'update-available'].includes(before.status.state)) {
      return { ok: false, status: before.status, error: `当前状态不能卸载: ${before.status.state}` };
    }
    const targetMap = before.status.targets;
    try {
      startTransaction('uninstall', [targetMap.script, targetMap.config, installStateFile, enabledFile]);
      if (fs.existsSync(targetMap.script)) fs.unlinkSync(targetMap.script);
      markTransaction('script-removed');
      if (fs.existsSync(targetMap.config)) fs.unlinkSync(targetMap.config);
      markTransaction('config-removed');
      if (fs.existsSync(installStateFile)) fs.unlinkSync(installStateFile);
      markTransaction('state-removed');
      atomicWrite(enabledFile, 'no\n');
      markTransaction('enabled-written');
      finishTransaction();
      return getStatus({ mpvRoot: before.status.mpvRoot });
    } catch (error) {
      const recovery = recoverTransaction();
      return { ok: false, status: (await getStatus({})).status, error: `卸载失败: ${error.message}${recovery.ok ? '' : `；${recovery.error}`}` };
    }
  }

  return { getStatus, install, update, setEnabled, uninstall };
}

const defaultManager = createManager();
module.exports = Object.assign({ createManager }, defaultManager);
