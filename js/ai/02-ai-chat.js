// EvenUCan AI helpers and Surgery - 02-ai-chat.js
// One of the files in js/ai/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ==================== UNIVERSAL OFFLINE AI CHAT CONTROLLER ====================
let universalChatMsgs = [];
let universalChatBusy = false;

const openUniversalAiChat=function openUniversalAiChat(initialPrompt) {
  const win = $Ai('aiChatDrawer');
  const pill = $Ai('aiChatPill');
  if (!win) return;
  win.style.display = 'flex';
  if (pill) pill.style.display = 'none';
  if (!universalChatMsgs.length) {
    renderUniversalChatMessages();
  }
  const inp = $Ai('aiChatInput');
  if (inp) {
    if (initialPrompt) {
      inp.value = initialPrompt;
      sendUniversalAiChat();
    } else {
      setTimeout(() => inp.focus(), 60);
    }
  }
  scrollUniversalChat();
};

const closeUniversalAiChat=function closeUniversalAiChat() {
  const win = $Ai('aiChatDrawer');
  const pill = $Ai('aiChatPill');
  if (win) win.style.display = 'none';
  if (pill) pill.style.display = 'flex';
};

const toggleUniversalAiChat=function toggleUniversalAiChat() {
  const win = $Ai('aiChatDrawer');
  if (win && win.style.display === 'flex') {
    closeUniversalAiChat();
  } else {
    openUniversalAiChat();
  }
};

const clearUniversalAiChat=function clearUniversalAiChat() {
  if (confirm('Clear the chat conversation history?')) {
    universalChatMsgs = [];
    renderUniversalChatMessages();
  }
};

const scrollUniversalChat=function scrollUniversalChat() {
  const b = $Ai('aiChatMessages');
  if (b) b.scrollTop = b.scrollHeight;
};

const formatUniversalChatText=function formatUniversalChatText(text) {
  if (!text) return '';
  const parts = [];
  const re = /```(?:([a-zA-Z0-9_-]+)\n)?([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', val: text.slice(last, m.index) });
    }
    parts.push({ type: 'code', lang: m[1] || 'code', val: m[2] });
    last = re.lastIndex;
  }
  if (last < text.length) {
    parts.push({ type: 'text', val: text.slice(last) });
  }

  return parts.map(p => {
    if (p.type === 'code') {
      const codeId = 'ucode_' + Math.random().toString(36).slice(2, 8);
      return `<div style="margin:8px 0;background:#090d16;border:1px solid #1e293b;border-radius:8px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 10px;background:#131c2e;font-size:11px;color:#94a3b8;font-family:monospace">
          <span>${escAi(p.lang.toUpperCase())}</span>
          <button data-copy-code="${codeId}" style="border:none;background:#2563eb;color:#fff;font-size:10px;padding:2px 8px;border-radius:4px;cursor:pointer">📋 Copy Code</button>
        </div>
        <textarea id="${codeId}" readonly style="width:100%;box-sizing:border-box;background:transparent;color:var(--line);font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.45;padding:8px 10px;border:none;resize:vertical;min-height:90px;outline:none">${escAi(p.val.trim())}</textarea>
      </div>`;
    }
    let s = escAi(p.val)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\*([^*]+)\*/g, '<i>$1</i>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.08);padding:1px 4px;border-radius:3px;font-family:monospace">$1</code>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
    return `<div>${s}</div>`;
  }).join('');
};

const renderUniversalChatMessages=function renderUniversalChatMessages() {
  const box = $Ai('aiChatMessages');
  if (!box) return;
  if (!universalChatMsgs.length) {
    box.innerHTML = `<div style="text-align:center;padding:20px 10px;color:var(--muted)">
      <div style="font-size:36px;margin-bottom:8px">🤖</div>
      <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:4px">EvenUCan Offline AI Specialist</div>
      <div style="font-size:12px;line-height:1.5;max-width:320px;margin:0 auto">I'm your embedded electronics, wiring, and code assistant. Ask me anything about microcontrollers, circuits, safety rules, ESPHome, or your current box design!</div>
    </div>`;
    return;
  }

  box.innerHTML = universalChatMsgs.map((m, i) => {
    const isUser = m.role === 'user';
    const bg = isUser ? '#2563eb' : 'var(--panel, #ffffff)';
    const color = isUser ? '#ffffff' : 'var(--text, #0f172a)';
    const border = isUser ? 'none' : '1px solid var(--line, #e2e8f0)';
    const align = isUser ? 'flex-end' : 'flex-start';
    const radius = isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px';
    const body = isUser ? `<div>${escAi(m.content).replace(/\n/g, '<br>')}</div>` : formatUniversalChatText(m.content);

    return `<div style="display:flex;flex-direction:column;align-items:${align};max-width:92%;${isUser?'margin-left:auto':'margin-right:auto'}">
      <div style="background:${bg};color:${color};border:${border};border-radius:${radius};padding:9px 13px;box-shadow:0 1px 4px rgba(0,0,0,0.06);word-break:break-word">
        ${body}
      </div>
      ${m.checked && m.checked.length ? `<div style="font-size:11px;color:var(--muted,var(--text-muted));margin-top:2px;max-width:100%">Checked: ${m.checked.map(c => escAi(c.file) + (c.section ? ' (' + escAi(c.section) + ')' : '')).join(', ')}</div>` : ''}
      <button type="button" class="aiCopyBtn" data-i="${i}" style="margin-top:3px;background:none;border:none;color:var(--muted,var(--text-muted));font-size:12px;cursor:pointer;padding:2px 4px">Copy text</button>
    </div>`;
  }).join('');
  if (!box.dataset.copyWired) {
    box.dataset.copyWired = '1';
    box.addEventListener('click', e => {
      const btn = e.target.closest && e.target.closest('.aiCopyBtn');
      if (btn) aiCopyChatText(Number(btn.dataset.i), btn);
    });
  }
};

// Turns the model's markdown into plain text: code fences and backticks lose their marks, bold and headings too.
function aiPlainText(md) {
  return String(md || '')
    .replace(/```[a-zA-Z0-9_+-]*\n?([\s\S]*?)```/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Copies one message as plain text. Falls back to a hidden textarea where the clipboard API is blocked.
const aiCopyChatText=async function aiCopyChatText(i, btn) {
  const m = universalChatMsgs[i];
  if (!m) return;
  const text = aiPlainText(m.content);
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch (e2) {}
  }
  if (btn) {
    const old = btn.textContent;
    btn.textContent = ok ? 'Copied' : 'Copy failed';
    setTimeout(() => { btn.textContent = old; }, 1500);
  }
};

const renderUniversalChatThinking=function renderUniversalChatThinking(isThinking) {
  const box = $Ai('aiChatMessages');
  const tEl = $Ai('aiChatThinking');
  if (!box) return;
  if (isThinking) {
    if (!tEl) {
      box.insertAdjacentHTML('beforeend', `<div id="aiChatThinking" style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:var(--panel,#fff);border:1px solid var(--line,var(--line));border-radius:14px 14px 14px 2px;width:fit-content;font-size:12px;color:var(--muted);box-shadow:0 1px 3px rgba(0,0,0,0.05)">
        <span class="wcSpin" style="display:inline-block">⚡</span> Thinking…
      </div>`);
    }
  } else {
    if (tEl) tEl.remove();
  }
};

const sendUniversalAiChat=async function sendUniversalAiChat() {
  const inp = $Ai('aiChatInput');
  if (!inp || universalChatBusy) return;
  const text = (inp.value || '').trim();
  if (!text) return;
  inp.value = '';
  inp.style.height = '44px';

  universalChatMsgs.push({ role: 'user', content: text });
  renderUniversalChatMessages();
  scrollUniversalChat();

  // Pin questions are answered from the app's own pin data, not the language model (see js/ai/10-pin-facts.js)
  try {
    const P0 = wrAi && wrAi.plan;
    const pinFact = typeof pinFactAnswer === 'function' ? pinFactAnswer(text, (P0 && P0.ctrl && P0.ctrl.label) || '') : null;
    if (pinFact) {
      universalChatMsgs.push({ role: 'assistant', content: pinFact });
      renderUniversalChatMessages();
      scrollUniversalChat();
      return;
    }
  } catch(e) {}

  universalChatBusy = true;
  const sendBtn = $Ai('aiChatSendBtn');
  if (sendBtn) sendBtn.disabled = true;
  renderUniversalChatThinking(true);
  scrollUniversalChat();

  let contextNote = '';
  try {
    const P = wrAi && wrAi.plan;
    const brd = (P && P.ctrl && P.ctrl.label) || 'ESP32';
    const parts = (P && P.insts && P.insts.map(i => i.label).join(', ')) || (wizAi && wizAi.items && wizAi.items.map(i => (partByIdAi(i.pid)||{}).name).filter(Boolean).join(', ')) || 'None specified yet';
    const wires = (P && P.assigned && P.assigned.map(a => `${a.inst.label} ${a.pin?a.pin.n:a.role} -> ${a.c.n}`).join(', ')) || 'None wired yet';
    contextNote = `\nActive project context:
- Board: ${brd}
- Parts: ${parts}
- Wires: ${wires}`;
  } catch(e) {}

  const sysPrompt = `You are the EvenUCan Embedded Electronics & Coding Specialist built directly into EvenUCan.
You run 100% offline on the user's computer via Local AI.
You are an expert hardware engineer, circuit designer, and firmware developer specializing in:
- Microcontrollers (ESP32, ESP32-S3, ESP8266, RP2040, Arduino Uno/Nano).
- Circuit wiring, safe GPIO selection, pull-up/pull-down resistors, debouncing switches, and flyback diodes on inductive loads.
- Writing compile-ready ESPHome YAML (with restore_mode: ALWAYS_OFF on actuators) and Arduino C++ (.ino) code.
- Designing 3D printed enclosures and physical clearances.
${typeof pinGuideForPrompt === 'function' ? pinGuideForPrompt() : ''}
${contextNote}
Answer the user directly, concisely, and accurately. When providing code, use fenced code blocks with language tags.`;

  const payloadMsgs = [
    { role: 'system', content: sysPrompt },
    ...universalChatMsgs.slice(-4)
  ];

  try {
    const body = JSON.stringify({
      model: WFAi.store.get('ollamaModel') || 'evenucan-expert:latest',
      messages: payloadMsgs,
      temperature: 0.1,
      max_tokens: 2048,
      stream: false
    });

    let res;
    if (/^https?:$/.test(location.protocol)) {
      try {
        res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        });
      } catch(e) {}
    }
    if (!res) throw new Error('the EvenUCan server did not answer');
    if (!res.ok) {
      let why = '';
      try { why = (await res.json()).error.message; } catch(e) {}
      throw new Error(why || ('AI returned HTTP ' + res.status));
    }
    const j = await res.json();
    const c = j.choices && j.choices[0];
    let replyText = String((c && c.message && c.message.content) || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    if (!replyText) replyText = '(No text returned)';

    universalChatMsgs.push({ role: 'assistant', content: replyText, checked: Array.isArray(j.reference_used) ? j.reference_used : [] });
  } catch(err) {
    universalChatMsgs.push({
      role: 'assistant',
      content: '⚠️ **Local AI Error:** ' + (err.message || err) + '\n\n*Check that a Local AI model is chosen in Local AI settings.*'
    });
  } finally {
    universalChatBusy = false;
    if (sendBtn) sendBtn.disabled = false;
    renderUniversalChatThinking(false);
    renderUniversalChatMessages();
    scrollUniversalChat();
  }
};

let pillWasDragged = false;

// Global event handlers for Universal AI Chat
document.addEventListener('click', e => {
  const el = e.target;
  if (!el) return;
  if (el.id === 'aiChatPill' || (el.closest && el.closest('#aiChatPill'))) {
    if (pillWasDragged) return;
    toggleUniversalAiChat();
    return;
  }
  if (el.id === 'aiChatClose' || el.id === 'aiChatHide' || (el.closest && el.closest('#aiChatHide'))) {
    closeUniversalAiChat();
    return;
  }
  if (el.id === 'aiChatClear') {
    clearUniversalAiChat();
    return;
  }
  if (el.id === 'aiChatSendBtn') {
    sendUniversalAiChat();
    return;
  }
  if (el.classList && el.classList.contains('aiChip') && el.dataset.prompt) {
    const inp = $Ai('aiChatInput');
    if (inp) inp.value = el.dataset.prompt;
    sendUniversalAiChat();
    return;
  }
  if (el.dataset.copyCode) {
    const ta = $Ai(el.dataset.copyCode);
    if (ta) {
      ta.select();
      navigator.clipboard.writeText(ta.value).then(() => WFAi.flash('Code copied to clipboard!'), () => {
        document.execCommand('copy');
        WFAi.flash('Code copied to clipboard!');
      });
    }
    return;
  }
});

document.addEventListener('keydown', e => {
  const t = e.target;
  if (t && (t.id === 'aiChatInput' || (t.closest && t.closest('#aiChatDrawer')))) {
    e.stopPropagation();
    if (t.id === 'aiChatInput') {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendUniversalAiChat();
      }
    } else if (e.key === 'Escape') {
      closeUniversalAiChat();
    }
  }
}, true);

['keyup', 'keypress'].forEach(ev => {
  document.addEventListener(ev, e => {
    const t = e.target;
    if (t && (t.id === 'aiChatInput' || (t.closest && t.closest('#aiChatDrawer')))) {
      e.stopPropagation();
    }
  }, true);
});

// Floating / edge-draggable AI chat pill
(function initAiChatPillDrag() {
  function setup() {
    const pill = $Ai('aiChatPill');
    if (!pill) return;
    const saved = localStorage.getItem('evenucan_ai_chat_top');
    if (saved) {
      const topNum = parseInt(saved, 10);
      if (!isNaN(topNum) && topNum >= 40 && topNum <= window.innerHeight - 60) {
        pill.style.top = topNum + 'px';
      }
    }
    let isDragging = false;
    let startY = 0;
    let startTop = 0;

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startY = clientY;
      const rect = pill.getBoundingClientRect();
      startTop = rect.top;
      isDragging = false;
      pillWasDragged = false;

      function onPointerMove(ev) {
        const curY = ev.touches ? ev.touches[0].clientY : ev.clientY;
        const dy = curY - startY;
        if (Math.abs(dy) > 4) {
          isDragging = true;
          pillWasDragged = true;
          pill.style.transition = 'none';
          const maxTop = window.innerHeight - pill.offsetHeight - 16;
          const clampTop = Math.max(50, Math.min(maxTop, startTop + dy));
          pill.style.top = clampTop + 'px';
        }
      }

      function onPointerUp() {
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('touchend', onPointerUp);
        pill.style.transition = '';
        if (isDragging) {
          const rect = pill.getBoundingClientRect();
          localStorage.setItem('evenucan_ai_chat_top', Math.round(rect.top));
          setTimeout(() => { pillWasDragged = false; }, 140);
        }
      }

      window.addEventListener('mousemove', onPointerMove, { passive: true });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('touchend', onPointerUp);
    }

    pill.addEventListener('mousedown', onPointerDown);
    pill.addEventListener('touchstart', onPointerDown, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

window.openUniversalAiChat = openUniversalAiChat;
window.closeUniversalAiChat = closeUniversalAiChat;
window.toggleUniversalAiChat = toggleUniversalAiChat;
