'use strict';

const state = {
  config: null,
  running: false,
  pid: null,
  lastExit: null,
  logRun: [],
  logProgress: [],
  logBlocked: [],
  logPinned: true,
};

function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function numberOrNull(v) {
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

function strOrNull(v) {
  return v === '' ? null : v;
}

function createCard(title, item) {
  const card = document.createElement('div');
  card.className = 'anime-card';
  card.innerHTML = `
    <div class="card-head">
      <label>片名
        <input class="f-title" value="${escapeHtml(title)}">
      </label>
      <button class="del">删除</button>
    </div>
    <div class="fields">
      <label>site_id
        <input class="f-site_id" type="number" step="1" value="${item.site_id ?? ''}">
      </label>
      <label>update_time
        <input class="f-update_time" placeholder="HH:MM" value="${escapeHtml(item.update_time ?? '')}">
      </label>
      <label>downloaded_start
        <input class="f-downloaded_start" type="number" step="1" value="${item.downloaded_start ?? ''}">
      </label>
      <label>downloaded_end
        <input class="f-downloaded_end" type="number" step="1" value="${item.downloaded_end ?? ''}">
      </label>
      <label>site_latest
        <input class="f-site_latest" type="number" step="1" value="${item.site_latest ?? ''}">
      </label>
      <label>folder_name
        <input class="f-folder_name" value="${escapeHtml(item.folder_name ?? '')}">
      </label>
      <label>file_name
        <input class="f-file_name" value="${escapeHtml(item.file_name ?? '')}">
      </label>
    </div>
    <div class="card-errors errors"></div>`;
  card.querySelector('.del').addEventListener('click', () => card.remove());
  return card;
}

function render() {
  $('fetch_time').value = state.config.fetch_time || '';
  $('max_download').value = state.config.defaults?.max_download ?? '';
  $('max_parallel').value = state.config.defaults?.max_parallel ?? 1;
  $('auto_repair').checked = Boolean(state.config.defaults?.auto_repair);
  $('auto_close_idm').checked = Boolean(state.config.defaults?.auto_close_idm);
  $('anime-list').innerHTML = '';
  for (const [title, item] of Object.entries(state.config.anime || {})) {
    $('anime-list').appendChild(createCard(title, item || {}));
  }
  clearErrors();
}

function collectConfig() {
  const cfg = {
    fetch_time: $('fetch_time').value.trim(),
    defaults: {
      max_download: numberOrNull($('max_download').value),
      max_parallel: numberOrNull($('max_parallel').value),
      auto_repair: $('auto_repair').checked,
      auto_close_idm: $('auto_close_idm').checked,
    },
    anime: {},
  };
  for (const card of document.querySelectorAll('.anime-card')) {
    const title = card.querySelector('.f-title').value.trim();
    const raw = {
      site_id: numberOrNull(card.querySelector('.f-site_id').value),
      update_time: strOrNull(card.querySelector('.f-update_time').value),
      downloaded_start: numberOrNull(card.querySelector('.f-downloaded_start').value),
      downloaded_end: numberOrNull(card.querySelector('.f-downloaded_end').value),
      site_latest: numberOrNull(card.querySelector('.f-site_latest').value),
      folder_name: strOrNull(card.querySelector('.f-folder_name').value),
      file_name: strOrNull(card.querySelector('.f-file_name').value),
    };
    const item = {};
    for (const key of Object.keys(raw)) {
      const v = raw[key];
      if (v !== null && v !== '') item[key] = v;
    }
    cfg.anime[title] = item;
  }
  return cfg;
}

function clearErrors() {
  $('global-errors').innerHTML = '';
  for (const el of document.querySelectorAll('.card-errors')) el.innerHTML = '';
}

function renderErrors(errors) {
  clearErrors();
  for (const [key, msg] of Object.entries(errors || {})) {
    if (key === '_root' || key === 'anime' || key.startsWith('defaults') || key === 'fetch_time') {
      const div = document.createElement('div');
      div.textContent = key + ': ' + msg;
      $('global-errors').appendChild(div);
      continue;
    }
    if (key.startsWith('anime.')) {
      for (const card of document.querySelectorAll('.anime-card')) {
        const title = card.querySelector('.f-title').value.trim();
        const field = key.slice('anime.'.length + title.length + 1);
        if (key === 'anime.' + title + '.' + field && field) {
          const div = document.createElement('div');
          div.textContent = field + ': ' + msg;
          card.querySelector('.card-errors').appendChild(div);
        }
      }
    }
  }
}

async function load() {
  $('save-msg').textContent = '正在读取…';
  const r = await window.anivault.readConfig();
  if (!r.ok) {
    $('save-msg').textContent = r.error;
    $('status').textContent = '读取失败';
    return;
  }
  state.config = r.data;
  render();
  $('save-msg').textContent = '已载入 content.json';
  $('status').textContent = '已连接';
  loadEnv();
  refreshCsv();
}

async function save() {
  $('save-msg').textContent = '';
  const cfg = collectConfig();
  const r = await window.anivault.saveConfig(cfg);
  if (r.ok) {
    $('save-msg').textContent = '已保存，回读校验中…';
    const back = await window.anivault.readConfig();
    if (!back.ok) {
      $('save-msg').textContent = '已保存但回读失败: ' + back.error;
      return;
    }
    state.config = back.data;
    render();
    $('save-msg').textContent = '已保存并回读一致';
  } else if (r.errors) {
    renderErrors(r.errors);
    $('save-msg').textContent = '有校验错误，未写盘';
  } else {
    $('save-msg').textContent = r.error || '保存失败';
  }
}

function renderRun() {
  const el = $('run-status');
  if (state.running) {
    el.textContent = '运行中（pid ' + state.pid + '）';
    el.className = 'run-status running';
  } else if (state.lastExit && state.lastExit.code !== null && state.lastExit.code !== undefined) {
    el.textContent = '已退出 code=' + state.lastExit.code;
    el.className = 'run-status';
  } else if (state.lastExit && state.lastExit.signal) {
    el.textContent = '已停止 signal=' + state.lastExit.signal;
    el.className = 'run-status';
  } else {
    el.textContent = '空闲';
    el.className = 'run-status';
  }
  $('run-dry').disabled = state.running;
  $('run-full').disabled = state.running;
  $('stop-run').disabled = !state.running;
}

function renderLog() {
  const area = $('log-area');
  const pinned = state.logPinned;
  const html = [];
  for (const l of state.logRun) html.push(escapeHtml(l));
  if (state.logRun.length && state.logProgress.length) html.push('— PROGRESS 末尾 —');
  for (const l of state.logProgress) html.push(escapeHtml(l));
  if (state.logBlocked.length) {
    html.push('— BLOCKED 末尾 —');
    for (const l of state.logBlocked) html.push(escapeHtml(l));
  }
  area.textContent = html.length ? html.join('\n') : '暂无日志';
  if (pinned) area.scrollTop = area.scrollHeight;
}

async function poll() {
  try {
    const [st, log] = await Promise.all([
      window.anivault.runStatus(),
      window.anivault.logTail(200),
    ]);
    const wasRunning = state.running;
    state.running = st.running;
    state.pid = st.pid;
    state.lastExit = st.lastExit;
    state.logRun = log.run || [];
    state.logProgress = log.progress || [];
    state.logBlocked = log.blocked || [];
    renderRun();
    renderLog();
    if (wasRunning && !st.running) refreshCsv();
  } catch (e) {
    /* 轮询失败忽略 */
  }
}

async function refreshCsv() {
  const r = await window.anivault.csvRead();
  const tbody = $('csv-table').querySelector('tbody');
  tbody.innerHTML = '';
  if (!r.ok) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = '读取失败: ' + r.error;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  for (const row of r.rows) {
    const tr = document.createElement('tr');
    for (const v of [row.title, String(row.ep), row.url]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  if (!r.rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = '暂无待下载项';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

async function loadEnv() {
  const info = await window.anivault.envInfo();
  $('env-info').textContent = [
    '下载目录: ' + info.downloadDir,
    '脚本: ' + info.script,
    '配置: ' + info.content,
    '日志: ' + info.progress,
    '清单: ' + info.csv,
    '锁: ' + info.lock,
    '运行时: ' + info.node,
    'Electron: ' + info.electron + ' / Node: ' + info.nodeVersion,
  ].join('\n');
}

async function startRun(mode) {
  const r = await window.anivault.runStart(mode);
  if (!r.ok) {
    if (r.errors) {
      $('run-status').textContent = '配置校验未通过，未启动: ' + Object.values(r.errors).join('；');
    } else if (r.reason === 'locked') {
      $('run-status').textContent = '已有任务在运行（锁被占用），本次未启动';
    } else {
      $('run-status').textContent = r.error || '启动失败';
    }
  }
  poll();
}

$('add-anime').addEventListener('click', () => {
  $('anime-list').appendChild(createCard('', {}));
});
$('save').addEventListener('click', save);
$('reload').addEventListener('click', load);
$('run-dry').addEventListener('click', () => startRun('dry'));
$('run-full').addEventListener('click', () => startRun('full'));
$('stop-run').addEventListener('click', async () => {
  await window.anivault.runStop();
  poll();
});
$('open-download').addEventListener('click', () => window.anivault.openDownloadDir());
$('csv-refresh').addEventListener('click', refreshCsv);
$('log-area').addEventListener('scroll', () => {
  const area = $('log-area');
  state.logPinned = area.scrollTop + area.clientHeight >= area.scrollHeight - 4;
});

setInterval(poll, 1000);
load();
