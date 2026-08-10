'use strict';

const state = { config: null };

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
      auto_repair: $('auto_repair').checked,
      auto_close_idm: $('auto_close_idm').checked,
    },
    anime: {},
  };
  for (const card of document.querySelectorAll('.anime-card')) {
    const title = card.querySelector('.f-title').value.trim();
    cfg.anime[title] = {
      site_id: numberOrNull(card.querySelector('.f-site_id').value),
      update_time: strOrNull(card.querySelector('.f-update_time').value),
      downloaded_start: numberOrNull(card.querySelector('.f-downloaded_start').value),
      downloaded_end: numberOrNull(card.querySelector('.f-downloaded_end').value),
      site_latest: numberOrNull(card.querySelector('.f-site_latest').value),
      folder_name: strOrNull(card.querySelector('.f-folder_name').value),
      file_name: strOrNull(card.querySelector('.f-file_name').value),
    };
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

$('add-anime').addEventListener('click', () => {
  $('anime-list').appendChild(createCard('', {}));
});
$('save').addEventListener('click', save);
$('reload').addEventListener('click', load);

load();
