const DEFAULT_BASE = 'https://www.agedm.io';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 30 * 1000;
const UPDATE_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MEDIA_RE = /(\.m3u8(\?|$)|\.mp4(\?|$)|video\/tos\/|douyinvod|ixigua\.com|bytecdn|mgtv\.com|bilivideo|ffzy-plays|\.ts\?)/i;
const BAD_RE = /\.(gif|png|jpe?g|css|js|svg|ico)(\?|$)/i;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function createBrowserPool(createBrowser, deps = {}) {
  let promise = null;
  return {
    getBrowser() {
      if (!promise) {
        promise = Promise.resolve().then(() => (
          createBrowser
            ? createBrowser()
            : deps.chromium.launch({ executablePath: deps.edgePath, headless: true, args: ['--no-sandbox', '--disable-gpu'] })
        ));
      }
      return promise;
    },
    async close() {
      const pending = promise;
      promise = null;
      if (!pending) return;
      const browser = await pending.catch(() => null);
      if (browser && typeof browser.close === 'function') await browser.close().catch(() => {});
    },
  };
}

async function fetchText(url, referer, deps = {}) {
  const headers = { Connection: 'close', 'User-Agent': deps.userAgent || UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' };
  if (referer) headers.Referer = referer;
  const fetchImpl = deps.fetchImpl || fetch;
  const timeoutMs = deps.timeoutMs || FETCH_TIMEOUT_MS;
  const retries = deps.retries !== undefined ? deps.retries : 1;
  const retryDelayMs = deps.retryDelayMs || 3000;
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs);
    const controller = new AbortController();
    let timeoutReject;
    const timeoutPromise = new Promise((_, reject) => { timeoutReject = reject; });
    const timer = setTimeout(() => { controller.abort(); timeoutReject(new Error(`请求超时（${timeoutMs}ms）: ${url}`)); }, timeoutMs);
    try {
      const r = await Promise.race([fetchImpl(url, { headers, signal: controller.signal }), timeoutPromise]);
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
      return r.text();
    } catch (e) {
      if (e.name === 'AbortError' || /超时/.test(e.message || '')) throw new Error(`请求超时（${timeoutMs}ms）: ${url}`);
      lastError = e;
    } finally { clearTimeout(timer); }
  }
  throw lastError;
}

function baseOf(deps) { return (deps && deps.baseUrl) || DEFAULT_BASE; }
function fetcher(deps) { return deps && deps.fetchTextImpl ? deps.fetchTextImpl : fetchText; }

async function searchSite(title, deps = {}) {
  const html = await fetcher(deps)(`${baseOf(deps)}/search?query=${encodeURIComponent(title)}`, undefined, deps);
  const re = /<a href="http:\/\/www\.agedm\.io\/detail\/(\d+)"[^>]*>([^<]+)<\/a>/g;
  let m, first = null;
  while ((m = re.exec(html))) {
    const t = m[2].trim();
    if (!first) first = { id: parseInt(m[1], 10), title: t };
    if (t === title) return { id: parseInt(m[1], 10), title: t };
  }
  return first;
}

function parseHomeUpdateTimes(html) {
  const map = {};
  const blocks = html.match(/<li[^>]*>[\s\S]*?<\/li>/g) || [];
  for (const b of blocks) {
    const a = b.match(/<a[^>]*>([^<]+)<\/a>/);
    const t = b.match(/class="title_sub[^"]*"[^>]*>\s*([\d:]+)/);
    if (a && t && UPDATE_TIME_RE.test(t[1])) map[a[1].trim()] = t[1];
  }
  return map;
}

async function getHomeUpdateTimes(deps = {}) { return parseHomeUpdateTimes(await fetcher(deps)(`${baseOf(deps)}/`, undefined, deps)); }

async function getMaxEp(siteId, source, deps = {}) {
  const html = await fetcher(deps)(`${baseOf(deps)}/detail/${siteId}`, undefined, deps);
  const re = new RegExp(`/play/${siteId}/${source}/(\\d+)`, 'g');
  let m, max = 0;
  while ((m = re.exec(html))) max = Math.max(max, parseInt(m[1], 10));
  return max;
}

async function getPlayUrl(siteId, ep, source, browserPool, deps = {}) {
  let browser = null;
  let ownBrowser = false;
  if (browserPool) browser = await browserPool.getBrowser();
  else { browser = await deps.chromium.launch({ executablePath: deps.edgePath, headless: true, args: ['--no-sandbox', '--disable-gpu'] }); ownBrowser = true; }
  let context = null;
  try {
    context = await browser.newContext({ userAgent: deps.userAgent || UA });
    const page = await context.newPage();
    let mediaUrl = null;
    page.on('request', req => { const u = req.url(); if (!mediaUrl && MEDIA_RE.test(u) && !BAD_RE.test(u)) mediaUrl = u; });
    const playUrl = `${baseOf(deps)}/play/${siteId}/${source}/${ep}`;
    await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try { await page.waitForResponse(r => r.url().includes('Api.php'), { timeout: 30000 }); } catch (e) {}
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const jx = page.frames().find(f => f.url().includes('jx.wuzhoupai.com'));
      if (jx) {
        try {
          const v = await jx.evaluate(() => { const el = document.querySelector('video'); if (el && el.currentSrc) return el.currentSrc; const ifr = document.querySelector('iframe#video'); return ifr ? ifr.src : null; });
          if (v && /^https?:/i.test(v) && MEDIA_RE.test(v) && !BAD_RE.test(v)) return v;
          if (source === 2) { const html = await jx.evaluate(() => document.documentElement.outerHTML); const m = html.match(/var Vurl\s*=\s*'([^']+)'/); if (m && /^https?:/i.test(m[1])) return m[1]; }
        } catch (e) {}
      }
      await sleep(2000);
    }
    return (mediaUrl && MEDIA_RE.test(mediaUrl) && !BAD_RE.test(mediaUrl)) ? mediaUrl : null;
  } finally { if (context) await context.close().catch(() => {}); if (ownBrowser && browser) await browser.close().catch(() => {}); }
}

module.exports = { createBrowserPool, fetchText, searchSite, parseHomeUpdateTimes, getHomeUpdateTimes, getMaxEp, getPlayUrl };
