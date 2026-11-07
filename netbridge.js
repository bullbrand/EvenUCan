// EvenUCan desktop: internet requests made for the page by the main process.
// Web pages can't call some services directly (the browser's CORS rules block them), so the desktop app
// passes these few requests on. Plain Node (global fetch), so it can be tested without Electron.
// Rules: http(s) only, a time limit and a size limit on every request, and AI requests only to known AI hosts.
'use strict';

const AI_HOSTS = new Set(['integrate.api.nvidia.com', 'generativelanguage.googleapis.com', 'api.anthropic.com', 'api.deepseek.com', 'api.openai.com', 'api.groq.com', 'openrouter.ai']);
// Ollama: a model running on this same computer, not the internet - http (not https) on its default
// port only, so this never becomes an open door to some other local service.
const isOllama = (u) => u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.port === '11434';
const MB = 1024 * 1024;
const LIMITS = {
  ai: { ms: 180000, bytes: 8 * MB, body: 4 * MB },
  page: { ms: 20000, bytes: 6 * MB },
  image: { ms: 20000, bytes: 15 * MB },
  pdf: { ms: 45000, bytes: 40 * MB }
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 EvenUCan';

function checkUrl(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch (e) { throw new Error('That isn\'t a web address.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Only http and https addresses can be fetched.');
  return u;
}

// fetch with a time limit; reads the body but stops once it passes maxBytes
async function limitedFetch(url, opts, lim) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), lim.ms);
  try {
    const res = await fetch(url, { redirect: 'follow', ...opts, signal: ctl.signal });
    // a redirect may only land on http(s) too
    checkUrl(res.url || url);
    const len = Number(res.headers.get('content-length') || 0);
    if (len > lim.bytes) throw new Error('That file is too big to download here.');
    const chunks = [];
    let total = 0;
    if (res.body) {
      for await (const c of res.body) {
        total += c.length;
        if (total > lim.bytes) { ctl.abort(); throw new Error('That file is too big to download here.'); }
        chunks.push(Buffer.from(c));
      }
    }
    return { res, buf: Buffer.concat(chunks) };
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('The request took too long.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// POST a JSON body to an AI service with the user's key -> {status, text}
async function aiPost(url, key, body) {
  const u = checkUrl(url);
  const local = isOllama(u);
  if (!local && (u.protocol !== 'https:' || !AI_HOSTS.has(u.hostname))) throw new Error('That AI address isn\'t allowed.');
  const b = String(body == null ? '' : body);
  if (Buffer.byteLength(b) > LIMITS.ai.body) throw new Error('The request is too big.');
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const k = String(key || '').trim();
  if (!local && !k) return { status: 401, text: JSON.stringify({ detail: 'No key was given.' }) };
  if (local) { /* Ollama, on this computer: no key needed */ }
  else if (u.hostname === 'api.anthropic.com') { headers['x-api-key'] = k; headers['anthropic-version'] = '2023-06-01'; }
  else if (u.hostname === 'generativelanguage.googleapis.com') headers['x-goog-api-key'] = k;
  else headers.Authorization = 'Bearer ' + k;// NVIDIA: OpenAI-style "Bearer nvapi-..."
  const { res, buf } = await limitedFetch(u.href, { method: 'POST', headers, body: b }, LIMITS.ai);
  return { status: res.status, text: buf.toString('utf8') };
}

// a web page's HTML -> {html, url} (url = where it ended up after redirects)
async function fetchPage(url) {
  const u = checkUrl(url);
  const { res, buf } = await limitedFetch(u.href, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' } }, LIMITS.page);
  if (!res.ok) throw new Error('The page answered HTTP ' + res.status);
  return { html: buf.toString('utf8'), url: res.url || u.href };
}

// a picture -> {mime, b64}
async function fetchImage(url) {
  const u = checkUrl(url);
  const { res, buf } = await limitedFetch(u.href, { headers: { 'User-Agent': UA, Accept: 'image/*' } }, LIMITS.image);
  if (!res.ok) throw new Error('The picture answered HTTP ' + res.status);
  const mime = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!/^image\//.test(mime)) throw new Error('That address isn\'t a picture.');
  return { mime, b64: buf.toString('base64') };
}

// a PDF (e.g. a datasheet) -> {mime, b64}
async function fetchPdf(url) {
  const u = checkUrl(url);
  const { res, buf } = await limitedFetch(u.href, { headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*;q=0.5' } }, LIMITS.pdf);
  if (!res.ok) throw new Error('The PDF answered HTTP ' + res.status);
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('That address isn\'t a PDF.');
  return { mime: 'application/pdf', b64: buf.toString('base64') };
}

// Is Ollama running on this computer right now, and which models does it have? -> {running, models:[{name,vision}]}
async function ollamaStatus() {
  try {
    const { res, buf } = await limitedFetch('http://localhost:11434/api/tags', {}, { ms: 3000, bytes: 1 * MB });
    if (!res.ok) return { running: false, models: [] };
    const j = JSON.parse(buf.toString('utf8'));
    const models = (Array.isArray(j.models) ? j.models : []).map((m) => ({
      name: String(m.name || m.model || ''),
      vision: Array.isArray(m.capabilities) && m.capabilities.includes('vision')
    })).filter((m) => m.name);
    return { running: true, models };
  } catch (e) {
    return { running: false, models: [] };
  }
}

module.exports = { aiPost, fetchPage, fetchImage, fetchPdf, ollamaStatus, checkUrl, AI_HOSTS, LIMITS };
