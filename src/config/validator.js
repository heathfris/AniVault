'use strict';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const INT_RE = /^-?\d+$/;
const ILLEGAL_NAME_RE = /[\/\\:*?"<>|]/;
const PLACEHOLDER_RE = /\{([a-zA-Z]+)\}/g;
const FILE_PLACEHOLDERS = new Set(['name', 'ep', 'start', 'end']);
const FOLDER_PLACEHOLDERS = new Set(['name', 'ep', 'start', 'end', 'watched']);

function empty(v) {
  return v === undefined || v === null || v === '';
}

function isInt(v) {
  if (typeof v === 'number') return Number.isInteger(v);
  return typeof v === 'string' && INT_RE.test(v.trim());
}

function isNonNegativeInt(v) {
  if (!isInt(v)) return false;
  return (typeof v === 'number' ? v : parseInt(v, 10)) >= 0;
}

function isPositiveInt(v) {
  if (!isInt(v)) return false;
  return (typeof v === 'number' ? v : parseInt(v, 10)) > 0;
}

function isIntInRange(v, min, max) {
  if (!isInt(v)) return false;
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return n >= min && n <= max;
}

function validateConfig(config) {
  const errors = {};
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    errors._root = '配置必须是对象';
    return { ok: false, errors };
  }

  if (!empty(config.fetch_time) && (typeof config.fetch_time !== 'string' || !TIME_RE.test(config.fetch_time.trim()))) {
    errors.fetch_time = '格式必须是 HH:MM（如 18:00）或留空';
  }

  if (!empty(config.base_url) && (typeof config.base_url !== 'string' || !/^https?:\/\//i.test(config.base_url.trim()))) {
    errors.base_url = '必须是 http(s) 开头的 URL 或留空';
  }

  if (!empty(config.download_dir)) {
    const value = typeof config.download_dir === 'string' ? config.download_dir.trim() : '';
    if (!value || !/^(?:[A-Za-z]:[\\/]|\\\\)/.test(value) || /[\0]/.test(value)) {
      errors.download_dir = '必须是绝对 Windows 路径（如 D:\\视频）或留空';
    }
  }

  const defaults = config.defaults;
  if (defaults !== undefined && defaults !== null) {
    if (typeof defaults !== 'object' || Array.isArray(defaults)) {
      errors.defaults = 'defaults 必须是对象';
    } else {
      if (!isNonNegativeInt(defaults.max_download)) errors['defaults.max_download'] = '必须是非负整数';
      if (!empty(defaults.max_parallel) && !isIntInRange(defaults.max_parallel, 1, 10)) errors['defaults.max_parallel'] = '必须是 1-10 的整数';
      if (!empty(defaults.download_engine) && !['aria2', 'idm', 'ffmpeg'].includes(defaults.download_engine)) errors['defaults.download_engine'] = '必须是 aria2/idm/ffmpeg 之一';
      if (!empty(defaults.attempt_timeout_min) && !isIntInRange(defaults.attempt_timeout_min, 5, 60)) errors['defaults.attempt_timeout_min'] = '必须是 5-60 的整数';
      if (typeof defaults.auto_repair !== 'boolean') errors['defaults.auto_repair'] = '必须是 true/false';
      if (typeof defaults.auto_close_idm !== 'boolean') errors['defaults.auto_close_idm'] = '必须是 true/false';
    }
  }

  const anime = config.anime;
  if (anime !== undefined && anime !== null) {
    if (typeof anime !== 'object' || Array.isArray(anime)) {
      errors.anime = 'anime 必须是对象';
    } else {
      for (const [title, item] of Object.entries(anime)) {
        const base = 'anime.' + title;
        if (!title || !String(title).trim()) {
          errors[base + '.title'] = '片名不能为空';
          continue;
        }
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors[base] = '条目必须是对象';
          continue;
        }
        if (item.enabled !== undefined && typeof item.enabled !== 'boolean') {
          errors[base + '.enabled'] = '必须是 true/false';
        }
        if (item.skip_eps !== undefined) {
          const okSkip = Array.isArray(item.skip_eps)
            && item.skip_eps.every(x => Number.isInteger(x) && x > 0);
          if (!okSkip) errors[base + '.skip_eps'] = '必须是正整数数组';
        }
        if (!empty(item.site_id) && !isPositiveInt(item.site_id)) {
          errors[base + '.site_id'] = '必须是正整数';
        }
        if (!empty(item.update_time) && (typeof item.update_time !== 'string' || !TIME_RE.test(item.update_time.trim()))) {
          errors[base + '.update_time'] = '格式必须是 HH:MM';
        }
        for (const f of ['downloaded_start', 'downloaded_end', 'site_latest']) {
          if (!empty(item[f]) && !isNonNegativeInt(item[f])) {
            errors[base + '.' + f] = '必须是非负整数';
          }
        }
        for (const f of ['folder_name', 'file_name']) {
          const v = item[f];
          if (empty(v)) continue;
          if (typeof v !== 'string') {
            errors[base + '.' + f] = '必须是字符串';
            continue;
          }
          if (ILLEGAL_NAME_RE.test(v)) {
            errors[base + '.' + f] = '不能包含 \\ / : * ? " < > |';
          }
          PLACEHOLDER_RE.lastIndex = 0;
          let m;
          let watchedCount = 0;
          const allowed = f === 'folder_name' ? FOLDER_PLACEHOLDERS : FILE_PLACEHOLDERS;
          while ((m = PLACEHOLDER_RE.exec(v))) {
            if (m[1] === 'watched') watchedCount += 1;
            if (!allowed.has(m[1])) {
              errors[base + '.' + f] = f === 'folder_name'
                ? '只允许 {name}{ep}{start}{end}{watched}'
                : '只允许 {name}{ep}{start}{end}';
            }
          }
          if (f === 'folder_name' && watchedCount > 1) {
            errors[base + '.' + f] = '{watched} 最多只能出现一次';
          }
        }
      }
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

module.exports = { validateConfig };
