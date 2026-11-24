// EvenUCan Enclosure Wizard - 10-secrets.js
// API keys and Wi-Fi details live in secrets.json in the EvenUCan data folder, kept by the local server
// (secrets_store.py). They are loaded once when the page starts, and changed through the Keys and Wi-Fi screen.
// The server only answers this computer, so keys are never sent to another device.
'use strict';

window.SECRET_CACHE = {};
window.SECRETS_OK = false;

// One synchronous request to the local server (fast, on this computer). Returns {ok, ...} or {ok:false, message}.
window.secretCall = function secretCall(obj) {
  try {
    const x = new XMLHttpRequest();
    x.open('POST', '/api/secrets', false);
    x.setRequestHeader('Content-Type', 'application/json');
    x.send(JSON.stringify(obj));
    const r = JSON.parse(x.responseText || '{}');
    if (r && r.ok) return r;
    return { ok: false, message: (r && r.message) || 'Could not save. Check that EvenUCan is running.' };
  } catch (e) {
    return { ok: false, message: 'EvenUCan could not reach its own server, so nothing was saved. Start EvenUCan again.' };
  }
};

// Load all saved secrets now (before any screen is drawn). If the server is not there, the cache stays empty.
(function loadSecretsNow() {
  const r = window.secretCall({ action: 'full' });
  if (r.ok) { window.SECRET_CACHE = r.values || {}; window.SECRETS_OK = true; }
})();

window.saveSecret = function saveSecret(name, value) {
  const r = window.secretCall({ action: 'set', name: name, value: value });
  if (r.ok) window.SECRET_CACHE[name] = String(value).trim();
  return r;
};

window.removeSecret = function removeSecret(name) {
  const r = window.secretCall({ action: 'remove', name: name });
  if (r.ok) delete window.SECRET_CACHE[name];
  return r;
};

// One-time move: keys that an earlier version kept in browser storage go into secrets.json, then leave the browser.
(function moveBrowserKeysToSecrets() {
  if (!window.SECRETS_OK) return;
  const names = ['geminiKey', 'groqKey', 'openrouterKey', 'claudeKey', 'openaiKey', 'grokKey', 'deepseekKey'];
  for (const n of names) {
    try {
      const v = localStorage.getItem('opensketch.' + n) || localStorage.getItem('EvenUCan_' + n) || localStorage.getItem(n);
      if (!v) continue;
      if (!window.SECRET_CACHE[n]) {
        const r = window.secretCall({ action: 'set', name: n, value: v });
        if (!r.ok) continue;            // keep the browser copy if the save failed
        window.SECRET_CACHE[n] = v;
      }
      localStorage.removeItem('opensketch.' + n);
      localStorage.removeItem('EvenUCan_' + n);
      localStorage.removeItem(n);
    } catch (e) { /* storage blocked: nothing to move */ }
  }
})();

// ---- Keys and Wi-Fi screen (Tools menu) ----
const SECRET_LABELS = {
  geminiKey: 'Google Gemini (free)', groqKey: 'Groq (free)', openrouterKey: 'OpenRouter (free)',
  claudeKey: 'Claude (paid per use)', openaiKey: 'ChatGPT / OpenAI (paid per use)', grokKey: 'Grok / xAI (paid per use)',
  deepseekKey: 'DeepSeek (paid per use)',
  wifi_ssid: 'Wi-Fi name', wifi_password: 'Wi-Fi password'
};

window.openKeysScreen = function openKeysScreen() {
  const old = document.getElementById('keysScreen');
  if (old) old.remove();
  const wrap = document.createElement('div');
  wrap.id = 'keysScreen';
  wrap.style.cssText = 'position:fixed;inset:0;background:#0007;z-index:10050;display:flex;align-items:center;justify-content:center;padding:16px';
  wrap.innerHTML = '<div style="background:var(--panel,#fff);color:var(--text,#111);border-radius:10px;max-width:540px;width:100%;max-height:90vh;overflow:auto;padding:18px;font-size:14px;box-shadow:0 8px 28px #0006">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:16px">🔑 Keys and Wi-Fi</b><button data-kact="close" style="cursor:pointer">✕ Close</button></div>' +
    '<p style="font-size:12px;opacity:.8;margin:8px 0">Saved in a file on this computer only. Your project does not contain them and they are not sent to anyone except the AI or board they are for. Shown masked once saved.</p>' +
    '<div id="keysRows"></div>' +
    '<p style="font-size:12px;opacity:.7;margin-top:10px">The Wi-Fi details are used when a board is programmed. Changing them does not change a board that is already set up.</p>' +
    '</div>';
  document.body.appendChild(wrap);
  keysRender();
  wrap.addEventListener('click', keysClick);
};

function keysRender() {
  const box = document.getElementById('keysRows');
  if (!box) return;
  const r = window.secretCall({ action: 'list' });
  if (!r.ok) { box.innerHTML = '<p style="color:#dc2626">' + esc(r.message) + '</p>'; return; }
  box.innerHTML = Object.keys(SECRET_LABELS).map(k => {
    const it = r.items[k] || {};
    const isPw = k !== 'wifi_ssid';
    return '<div data-name="' + k + '" style="display:flex;gap:8px;align-items:center;padding:8px 0;border-top:1px solid #8884">' +
      '<div style="flex:1;min-width:0"><b>' + esc(SECRET_LABELS[k]) + '</b><div style="font-size:12px;opacity:.8" data-kval>' +
      (it.set ? '<code>' + esc(it.masked) + '</code>' : 'not set') + '</div></div>' +
      (it.set ? '<button data-kact="show" style="cursor:pointer">Show</button> ' : '') +
      '<button data-kact="replace" data-pw="' + (isPw ? 1 : 0) + '" style="cursor:pointer">' + (it.set ? 'Replace' : 'Add') + '</button>' +
      (it.set ? ' <button data-kact="remove" style="cursor:pointer">Remove</button>' : '') + '</div>';
  }).join('');
}

function keysClick(e) {
  const b = e.target.closest && e.target.closest('[data-kact]');
  const wrap = document.getElementById('keysScreen');
  if (!wrap) return;
  if (!b) { if (e.target === wrap) wrap.remove(); return; }
  const act = b.dataset.kact;
  if (act === 'close') { wrap.remove(); return; }
  const row = b.closest('[data-name]');
  if (!row) return;
  const name = row.dataset.name;
  if (act === 'remove') {
    if (!confirm('Remove this from EvenUCan? You can add it again later.')) return;
    const r = window.removeSecret(name);
    if (!r.ok) WF.flash(r.message, 6000); else WF.flash('Removed.', 3000);
    keysRender();
    return;
  }
  if (act === 'replace') {
    const pw = b.dataset.pw === '1';
    row.innerHTML = '<div style="flex:1;min-width:0"><b>' + esc(SECRET_LABELS[name]) + '</b></div>' +
      '<input data-kin type="' + (pw ? 'password' : 'text') + '" autocomplete="off" spellcheck="false" style="width:180px;padding:4px">' +
      ' <button data-kact="save" style="cursor:pointer">Save</button> <button data-kact="cancel" style="cursor:pointer">Cancel</button>';
    row.querySelector('[data-kin]').focus();
    return;
  }
  if (act === 'cancel') { keysRender(); return; }
  if (act === 'show') {
    const r = window.secretCall({ action: 'full' });
    if (!r.ok) { WF.flash(r.message, 6000); return; }
    const val = (r.values || {})[name] || '';
    row.querySelector('[data-kval]').innerHTML = '<code style="word-break:break-all">' + esc(val) + '</code>';
    b.textContent = 'Hide';
    b.dataset.kact = 'hide';
    clearTimeout(row._hideT);
    row._hideT = setTimeout(() => keysRender(), 30000);   // hides again by itself after 30 seconds
    return;
  }
  if (act === 'hide') { keysRender(); return; }
  if (act === 'save') {
    const v = (row.querySelector('[data-kin]').value || '').trim();
    const r = window.saveSecret(name, v);
    if (!r.ok) { WF.flash(r.message, 6000); return; }
    WF.flash('Saved.', 3000);
    keysRender();
  }
}
