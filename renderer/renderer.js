'use strict';

const state = {
  config: null,
  running: false,
  pid: null,
  lastExit: null,
  logProgress: [],
  logPinned: true,
  episodes: [],
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

function createCard(title, item, expanded = false) {
  const card = document.createElement('div');
  card.className = 'anime-card' + (expanded ? ' open' : '');
  card.innerHTML = `
    <div class="card-head">
      <button class="arrow" title="展开/收起">&gt;</button>
      <input class="f-title" value="${escapeHtml(title)}" placeholder="输入名称">
      <label class="check enable-toggle">
        <input class="f-enabled" type="checkbox" ${item.enabled === false ? '' : 'checked'}>
        <span class="toggle-text">${item.enabled === false ? '关' : '开'}</span>
      </label>
      <button class="edit">编辑</button>
      <button class="del danger">删除</button>
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
      <label>skip_eps（逗号分隔，留空 = 无）
        <input class="f-skip_eps" value="${Array.isArray(item.skip_eps) ? escapeHtml(item.skip_eps.join(',')) : ''}">
      </label>
    </div>
    <div class="card-errors errors"></div>`;
  card.querySelector('.del').addEventListener('click', () => card.remove());
  const toggleOpen = () => card.classList.toggle('open');
  card.querySelector('.arrow').addEventListener('click', toggleOpen);
  card.querySelector('.edit').addEventListener('click', toggleOpen);
  const enableInput = card.querySelector('.f-enabled');
  enableInput.addEventListener('change', () => {
    const text = card.querySelector('.toggle-text');
    if (text) text.textContent = enableInput.checked ? '开' : '关';
  });
  return card;
}

function render() {
  $('fetch_time').value = state.config.fetch_time || '';
  $('base_url').value = state.config.base_url || '';
  $('max_download').value = state.config.defaults?.max_download ?? '';
  $('max_parallel').value = state.config.defaults?.max_parallel ?? 1;
  $('download_engine').value = state.config.defaults?.download_engine || 'aria2';
  $('attempt_timeout_min').value = state.config.defaults?.attempt_timeout_min ?? 20;
  $('auto_repair').checked = Boolean(state.config.defaults?.auto_repair);
  $('auto_close_idm').checked = Boolean(state.config.defaults?.auto_close_idm);
  $('anime-list').innerHTML = '';
  const entries = Object.entries(state.config.anime || {});
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '暂无追番，点击右上角添加番剧';
    $('anime-list').appendChild(empty);
  }
  for (const [title, item] of entries) {
    $('anime-list').appendChild(createCard(title, item || {}));
  }
  clearErrors();
}

function collectConfig() {
  const cfg = {
    fetch_time: $('fetch_time').value.trim(),
    base_url: $('base_url').value.trim(),
    defaults: {
      max_download: numberOrNull($('max_download').value),
      max_parallel: numberOrNull($('max_parallel').value),
      download_engine: $('download_engine').value,
      attempt_timeout_min: numberOrNull($('attempt_timeout_min').value),
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
    const skipRaw = card.querySelector('.f-skip_eps').value;
    const skipEps = skipRaw.split(/[,，\s]+/).map(s => parseInt(s, 10)).filter(n => Number.isInteger(n) && n > 0);
    const skipUniq = [...new Set(skipEps)].sort((a, b) => a - b);
    if (skipUniq.length) item.skip_eps = skipUniq;
    if (!card.querySelector('.f-enabled').checked) item.enabled = false;
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
    let msg = '已保存并回读一致';
    if (r.schedule) {
      if (r.schedule.ok) {
        const label = {
          created: '已创建定时任务',
          updated: '已更新定时任务',
          deleted: '定时任务已删除（自动运行关闭）',
        }[r.schedule.action] || '定时任务已同步';
        msg += '；' + label;
      } else {
        msg += '；定时任务同步失败: ' + (r.schedule.output || '').trim() + '；手动命令: ' + r.schedule.command;
      }
    }
    $('save-msg').textContent = msg;
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

function renderEpisodes() {
  const el = $('episode-status');
  if (!state.episodes || !state.episodes.length) {
    el.textContent = '';
    return;
  }
  const parts = state.episodes.map(e => {
    const label = e.status === 'done' ? '完成' : e.status === 'failed' ? '失败' : '下载中';
    return `${escapeHtml(e.title)} 第${e.ep}集：${label}`;
  });
  el.textContent = parts.join('　');
}

function renderLog() {
  const area = $('log-area');
  const pinned = state.logPinned;
  const html = [];
  for (const l of state.logProgress) html.push(escapeHtml(l));
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
    state.logProgress = log.progress || [];
    renderRun();
    renderEpisodes();
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
    const summary = (r.summaries && r.summaries[row.title]) || { downloaded: '?', total: 0 };
    for (const v of [row.title, String(row.ep), row.url, summary.downloaded + '/' + summary.total]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const tdOp = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.textContent = '删除';
    delBtn.addEventListener('click', () => deleteRow(row.title, row.ep));
    tdOp.appendChild(delBtn);
    tr.appendChild(tdOp);
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

async function deleteRow(title, ep) {
  const r = await window.anivault.readConfig();
  if (!r.ok) return;
  const info = r.data.anime && r.data.anime[title];
  if (!info) return;
  const skip = Array.isArray(info.skip_eps) ? info.skip_eps.filter(x => Number.isInteger(x) && x > 0) : [];
  if (!skip.includes(ep)) skip.push(ep);
  skip.sort((a, b) => a - b);
  info.skip_eps = skip;
  const s = await window.anivault.saveConfig(r.data);
  if (s.ok) {
    refreshCsv();
    load();
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
  $('anime-list').appendChild(createCard('', {}, true));
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
