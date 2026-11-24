// EvenUCan Enclosure Wizard - 19-code-ino-doctor.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- INO Doctor + compiling the user's own sketch (the Arduino/ESP32 equivalent of the YAML flow) ----
// Returns {P, pf, board, code, name} when the current project is an .ino one (Arduino Nano or ESP32 with the Arduino IDE), else null.
const inoCtx=function inoCtx() {
  try {
    let P = wr && wr.plan; if (!P || P.error) P = planWiring();
    if (!P || P.error) return null;
    const pf = pfOfPlan(P); if (!isIno(pf)) return null;
    let board = 'nanoatmega328';
    if (pf === 'esp32ide') { const eb = espBoard(P.ctrl.part); board = (eb && eb.board) || 'esp32-s3-devkitc-1'; }
    const c = pfCode && pfCode.pf === pf ? pfCode : null;
    return { P, pf, board, code: c ? c.code : '', name: esphSlug(esphForm().name || 'my-device').replace(/-/g, '_') };
  } catch (e) { return null; }
};
// Runs INO Doctor on the current sketch; applies the safe repairs to the stored code. Returns the diagnosis (or null).
const inoVet=function inoVet(ctx) {
  if (!window.InoDoctor || !ctx || !ctx.code) return null;
  const r = window.InoDoctor.diagnose(ctx.code, { pf: ctx.pf, board: ctx.board });
  if (r.changed && r.fixedText && pfCode && pfCode.pf === ctx.pf) { pfCode.code = r.fixedText; ctx.code = r.fixedText; }
  return r;
};
// After the AI writes a sketch: repair it, and add what the doctor noticed to the warnings under the code.
const inoAutoVet=function inoAutoVet() {
  const ctx = inoCtx(); if (!ctx) return;
  const r = inoVet(ctx); if (!r) return;
  pfCode.warn = (pfCode.warn || []).concat(r.flags.filter(f => f.level === 'warn').map(f => 'INO Doctor: ' + f.msg));
  if (r.fixes.length) pfCode.notes = ((pfCode.notes || '') + ' INO Doctor: ' + r.fixes.join(' ')).trim();
};
// The "Check my code" button.
const runInoDoctorUi=function runInoDoctorUi() {
  const ctx = inoCtx();
  const ta = $('wrPf'); if (!ta) return;
  let out = $('wrInoDoctorOut');
  if (!out) { out = document.createElement('div'); out.id = 'wrInoDoctorOut'; out.style.margin = '6px 0'; ta.insertAdjacentElement('afterend', out); }
  if (!ctx || !ctx.code) { out.innerHTML = '<div class="warn">There is no sketch to check yet.</div>'; return; }
  const r = inoVet(ctx);
  if (r.changed) ta.value = ctx.code;
  const li = (cls, t) => `<li class="${cls}"><span class="ic">${cls === 'warn' ? '!' : '✓'}</span><span style="color:var(--text)">${esc(t)}</span></li>`;
  const items = r.fixes.map(f => li('ok', 'Fixed: ' + f)).concat(r.flags.map(f => li(f.level === 'warn' ? 'warn' : 'ok', f.msg)));
  out.innerHTML = `<div class="ewNote"><b>🩺 ${esc(r.note)}</b> The compiler is the final check: use <b>Compile &amp; Upload in EvenUCan</b>.</div>` +
    (items.length ? `<ul style="list-style:none;padding:0;margin:6px 0">${items.join('')}</ul>` : '');
};
// Start button in the flasher window for an .ino project: vet, then compile (and upload) with PlatformIO.
const startSketchProcess=async function startSketchProcess(opts) {
  const doClean = !!(opts && opts.clean === true);
  showFlashRetry(false);
  const ctx = inoCtx();
  const startBtn = $('flashStartBtn'), testBtn = $('flashTestBtn');
  if ((startBtn && startBtn.disabled) || (testBtn && testBtn.disabled)) return;
  if (!ctx || !ctx.code.trim()) { WF.flash('No sketch to compile yet. Click "Make a starter" or write the code with AI first.'); return; }
  const act = $('flashActionSelect'), sel = $('flashPortSelect');
  const action = act ? act.value : 'run';
  const port = sel && sel.value && sel.value !== 'webserial' ? sel.value : null;
  if (action === 'run') { const blk = bwUploadBlock(port); if (blk) { updateFlashStatus('⛔', blk, 'error'); return; } }
  const c = $('flashConsole');
  if (c) c.textContent = `[${new Date().toLocaleTimeString()}] ${action === 'compile' ? 'COMPILE' : 'COMPILE + UPLOAD'} sketch "${ctx.name}" for ${ctx.pf === 'arduino' ? 'Arduino Nano' : ctx.board}\n`;
  // INO Doctor runs silently first: repairs what it can, blocks only on code that can never compile
  const r = inoVet(ctx);
  if (r) {
    r.fixes.forEach(f => logToFlashConsole('[INO Doctor] Fixed: ' + f));
    r.flags.forEach(f => logToFlashConsole('[INO Doctor] ' + (f.level === 'warn' ? 'Warning: ' : 'Note: ') + f.msg));
    if (r.syntaxFailed) {
      updateFlashStatus('❌', 'INO Doctor found a problem it couldn\'t fix: ' + ((r.flags.find(f => f.level === 'warn') || {}).msg || 'the sketch is not valid code') + ' Use "Write it again with AI".', 'error');
      return;
    }
  }
  setFlashBusy(true);
  updateFlashStatus('⏳', (action === 'compile' ? 'Compiling your sketch' : 'Compiling & uploading your sketch') + '… the first compile downloads the tools and can take several minutes.', 'running');
  try {
    const res = await fetch('/api/flash/sketch', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: ctx.pf, board: ctx.board, name: ctx.name, sketch: ctx.code, port, action, libs: hoLibs(ctx.code), clean: doClean }) });
    const data = await res.json();
    if (!res.ok || data.status !== 'started' || !data.id) throw new Error(data.message || ('Server returned ' + res.status));
    currentFlashJobId = data.id;
    watchFlashJob(action, startBtn, $('flashCancelBtn'));
  } catch (err) {
    flashProgRender(false);
    updateFlashStatus('❌', 'Could not start the sketch compile: ' + err.message, 'error');
    showFlashRetry(true);
    setFlashBusy(false);
  }
};

// "Test Compiler": compile a tiny known-good Blink project for the selected board (YAML or .ino).
const startCompilerTest=async function startCompilerTest() {
  const startBtn = $('flashStartBtn'), testBtn = $('flashTestBtn');
  if ((startBtn && startBtn.disabled) || (testBtn && testBtn.disabled)) return;
  showFlashRetry(false);
  let pf = 'esphome', board = 'esp32-s3-devkitc-1';
  try {
    let P = wr && wr.plan; if (!P || P.error) P = planWiring();
    if (P && !P.error) {
      pf = pfOfPlan(P);
      if (pf !== 'arduino' && pf !== 'raspberrypi') { const eb = espBoard(P.ctrl.part); if (eb && eb.board) board = eb.board; }
    }
  } catch (e) { console.warn('Test compiler: could not read the selected board, using ESP32-S3 default', e); }
  if (pf === 'raspberrypi') {
    updateFlashStatus('ℹ️', 'Raspberry Pi code is Python, so there is nothing to compile. Pick an ESP32 or Arduino board to test the compiler.', 'error');
    return;
  }
  const what = pf === 'esphome' ? 'ESPHome Blink YAML' : 'Arduino Blink sketch (.ino)';
  // A board is attached when the port list has a real port (not just "No ports found"). With the action set to
  // "Compile & Flash over USB" the test goes all the way: compile, upload, board accepts it.
  const sel = $('flashPortSelect'), actSel = $('flashActionSelect');
  const hasBoard = !!(sel && Array.from(sel.options).some(o => o.value && o.value !== 'webserial'));
  let upload = hasBoard && (!actSel || actSel.value === 'run');
  // The test writes a plain Blink program to the board, erasing whatever is on it: never do that without asking first.
  if (upload) {
    const what = bwDetected && bwDetected.ok ? bwDesc(bwDetected) : 'the board on ' + (sel.value || 'the USB port');
    if (!confirm('This test sends a simple Blink program to your board (' + what + ').\n\nIt ERASES the program that is on the board now.\n\nOK = test the whole chain, including the board.\nCancel = only test the compiler and leave the board alone.')) upload = false;
  }
  const port = upload && sel.value && sel.value !== 'webserial' ? sel.value : (upload && bwDetected ? bwDetected.port : null);
  updateFlashStatus('⏳', `Compiler test: building the ${what} for ${pf === 'arduino' ? 'Arduino Nano' : board}${upload ? ' and uploading it to your board' : ''}… the first run downloads tools and can take several minutes.`, 'running');
  const c = $('flashConsole');
  if (c) c.textContent = `[${new Date().toLocaleTimeString()}] COMPILER TEST: ${what} (${pf === 'arduino' ? 'nanoatmega328' : board})
`;
  setFlashBusy(true);
  try {
    const res = await fetch('/api/flash/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: pf, board, port, action: upload ? 'run' : 'compile' }) });
    const data = await res.json();
    if (!res.ok || data.status !== 'started' || !data.id) throw new Error(data.message || ('Server returned ' + res.status));
    currentFlashJobId = data.id;
    watchFlashJob('test', startBtn, $('flashCancelBtn'), upload);
  } catch (err) {
    flashProgRender(false);
    updateFlashStatus('❌', 'Could not start the compiler test: ' + err.message, 'error');
    setFlashBusy(false);
  }
};

const startFlashingProcess=async function startFlashingProcess(opts) {
  const doClean = !!(opts && opts.clean === true);
  showFlashRetry(false);
  if (inoCtx()) return startSketchProcess(opts);   // Arduino / ESP32 .ino projects use the sketch compiler
  const ta = $('wrEsp');
  const sel = $('flashPortSelect');
  const act = $('flashActionSelect');
  if (!ta) return;
  let yaml = ta.value;
  if (!yaml || !yaml.trim()) {
    WF.flash('No ESPHome YAML code to flash. Please write or generate code first.');
    return;
  }
  // Auto-heal common ESPHome 2026 syntax requirements before compile
  if (yaml.includes('platform: esp32_rmt_led_strip') && !yaml.includes('chipset:')) {
    yaml = yaml.replace(/(platform:\s*esp32_rmt_led_strip[\s\S]*?rgb_order:\s*\w+)/g, '$1\n    chipset: ws2812');
    ta.value = yaml;
  }
  // YAML Doctor runs silently before every flash — fixes what it can, blocks only what it cannot
  if (window.YamlDoctor && typeof window.YamlDoctor.diagnose === 'function') {
    try {
      const yd = window.YamlDoctor.diagnose(ta.value);
      if (yd.fixedText && yd.changed) {
        // Silently apply all auto-repairs — user never needs to know
        ta.value = yd.fixedText;
        if (wr && wr.ai) wr.ai.yaml = yd.fixedText;
        yaml = yd.fixedText;
        // Only block on true syntax failure — pin warnings may be board-specific false positives
        const recheck = window.YamlDoctor.diagnose(yd.fixedText);
        if (recheck.syntaxFailed) {
          updateFlashStatus('\u274c', 'EvenUCan found a structural problem in the generated code it couldn\'t fix. Please use \"Ask AI\" to regenerate.', 'bad');
          return;
        }
      } else if (yd.syntaxFailed) {
        // True syntax failure — YAML is structurally broken
        updateFlashStatus('\u274c', 'EvenUCan found a structural problem in the generated code it couldn\'t fix. Please use \"Ask AI\" to regenerate.', 'bad');
        return;
      }
      // Pin/section warnings are logged but don't block — ESPHome is the real pin validator
      // else: clean YAML, proceed normally
    } catch(e) { console.warn('YAML Doctor pre-flash check failed:', e); }
  }
  const f = esphForm();
  const name = (f && f.name) || 'my_device';
  const port = sel && sel.value && sel.value !== 'webserial' ? sel.value : null;
  const action = act ? act.value : 'run';
  if (action === 'run') { const blk = bwUploadBlock(port); if (blk) { updateFlashStatus('⛔', blk, 'error'); return; } }

  const startBtn = $('flashStartBtn');
  const cancelBtn = $('flashCancelBtn');
  if (startBtn && startBtn.disabled) return; // a run is already in progress: ignore double clicks
  setFlashBusy(true);

  updateFlashStatus('⏳', action === 'compile' ? 'Compiling firmware binary… first compile can take 5–20 minutes. Speed depends entirely on your PC — fast PC, fast compile; slow PC, slow compile. It will finish!' : 'Compiling & flashing over USB… first compile can take 5–20 minutes. Speed depends entirely on your PC — fast PC, fast compile; slow PC, slow compile. It will finish!', 'running');
  const c = $('flashConsole');
  if (c) c.textContent = `[${new Date().toLocaleTimeString()}] Starting ${action.toUpperCase()} for "${name}"...\n`;

  try {
    const res = await fetch('/api/flash/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml, name, port, action, clean: doClean })
    });
    if (!res.ok) throw new Error('Server returned ' + res.status);
    const data = await res.json();
    if (data.status !== 'started' || !data.id) throw new Error('Could not start flashing process');
    currentFlashJobId = data.id;

    watchFlashJob(action, startBtn, cancelBtn);
  } catch (err) {
    flashProgRender(false);
    updateFlashStatus('❌', 'Failed to start flashing: ' + err.message, 'error');
    showFlashRetry(true);
    setFlashBusy(false);
  }
};

const cancelFlashingProcess=async function cancelFlashingProcess() {
  if (!currentFlashJobId) return;
  try {
    await fetch('/api/flash/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentFlashJobId })
    });
  } catch (err) {}
};

// Global click delegation for flasher modal
document.addEventListener('click', e => {
  const t = e.target;
  if (!t) return;
  if (t.id === 'flashModalClose' || (t.closest && t.closest('#flashModalClose')) || t.id === 'flashModalDone') {
    closeFlashModal();
    return;
  }
  if (t.id === 'flashRefreshPorts' || (t.closest && t.closest('#flashRefreshPorts'))) {
    refreshFlashPorts();
    return;
  }
  if (t.id === 'flashWebSerialBtn' || (t.closest && t.closest('#flashWebSerialBtn'))) {
    pairWebSerialPort();
    return;
  }
  if (t.id === 'flashInstallDriverBtn' || (t.closest && t.closest('#flashInstallDriverBtn'))) {
    installUsbDriver();
    return;
  }
  if (t.id === 'flashStartBtn' || (t.closest && t.closest('#flashStartBtn'))) {
    startFlashingProcess();
    return;
  }
  if (t.id === 'flashCancelBtn' || (t.closest && t.closest('#flashCancelBtn'))) {
    cancelFlashingProcess();
    return;
  }
  if (t.id === 'flashClearConsole' || (t.closest && t.closest('#flashClearConsole'))) {
    const c = $('flashConsole');
    if (c) c.textContent = '';
    return;
  }
  if (t.id === 'flashCopyConsole' || (t.closest && t.closest('#flashCopyConsole'))) {
    const c = $('flashConsole');
    const btn = $('flashCopyConsole');
    if (!c || !btn) return;
    navigator.clipboard.writeText(c.textContent).then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy Output'; }, 1500);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = c.textContent; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy Output'; }, 1500);
    });
    return;
  }
  if (t.id === 'flashModalBack') {
    closeFlashModal();
    return;
  }
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const m = $('flashModalBack');
    if (m && m.style.display === 'grid') {
      closeFlashModal();
    }
  }
});

window.openFlashModal = openFlashModal;
window.closeFlashModal = closeFlashModal;
window.initFlashModal = initFlashModal;

Object.assign(_int, {
  allParts, partById, builtinById, newPartId, tidyPart, saveLib,
  aiKey, aiProv, askKey, aiRead, claude, gemini, oaAI, PROVIDERS, OA, isOA, getVisionFailoverList,
  readWiz, saveWiz, ewBack, plBack, openWizard, closeWizard,
  openLibrary, closeLibrary, updateStrip, ewProjRender,
  wrBack, openWiring, closeWiring, openWiringGated, planWiring,
  PLATFORMS, pfOk, pfNorm, CTRL_PARTS, CTRL_IDS, ctrlPart, pfMatches,
  esphomeYaml, esphForm, esphSlug, downloadBox, TYPES, BUILTIN
});

$('wrSide').addEventListener('click',e=>{
  const el=e.target;
  if(el.dataset.done!==undefined){wr.done[el.dataset.done]=el.checked;return;}
  if(el.dataset.netfocus!==undefined){const k=+el.dataset.netfocus;wrSetFocus(wr.focus&&wr.focus.type==='net'&&wr.focus.k===k?null:{type:'net',k});return;}
  const lk=el.closest&&el.closest('[data-link]');
  if(lk){const [k,j]=lk.dataset.link.split('-').map(Number);wrSetFocus({type:'link',k,j});return;}
  if(el.dataset.wrtab){if(el.dataset.wrtab==='esphome'&&!hasParts())WF.flash(NEED_PARTS,5000);wr.tab=el.dataset.wrtab;renderWiringSide();return;}
  if(el.dataset.copy){const ta=$(el.dataset.copy);ta.select();navigator.clipboard.writeText(ta.value).then(()=>WF.flash('Copied'),()=>{document.execCommand('copy');WF.flash('Copied');});return;}
  if(el.id==='wrToWiz'){closeWiring();openWizard();}
  if(el.classList&&el.classList.contains('wrFixPins')){closeWiring();openLibrary(el.dataset.partid);return;}
  if(el.id==='wrAi'||el.id==='wrAiFix'){esphWithAI();return;}
  if(el.id==='wrPfGen'){pfGenerate();return;}
  if(el.id==='wrPfStarter'){makeStarter();return;}
  if(el.id==='wrPfIde'){openInIde();return;}
  if(el.id==='wrPfFlash'){openFlashModal();return;}
  if(el.id==='wrPfDoctor'){runInoDoctorUi();return;}
  if(el.dataset.capfix){capFixLater(el.dataset.capfix);return;}
  if(el.id==='wrPfSave'){if(pfCode){const ext=isIno(pfCode.pf)?'.ino':'.py',n=esphSlug(esphForm().name).replace(/-/g,'_')+ext;WF.download(n,pfCode.code,'text/plain');WF.flash('Saved '+n);}return;}
  if(el.id==='wrKey'){askKey();return;}
  if(el.id==='wrFlashEsp'){openFlashModal();return;}
  if(el.id==='wrYamlDoctor'){runYamlDoctorUi();return;}
  if(el.id==='wrAiUndo'){e.preventDefault();wr.ai=null;wr.aiMsg='';renderWiringSide();return;}
  if(el.id==='wrcSend'){chatSend();return;}
  if(el.id==='wrcKey'){askKey();return;}
  if(el.id==='wrcClear'){if(confirm('Clear this chat?')){wr.chat={msgs:[],busy:false};renderWiringSide();}return;}
  if(el.dataset.chatUse!==undefined){
    const ta=el.parentElement.previousElementSibling;if(!ta||!ta.classList.contains('chatCode'))return;
    wr.ai={yaml:ta.value,notes:'Written from the Ask AI chat.',ok:null};wr.aiMsg='';
    wr.tab='esphome';renderWiringSide();WF.flash('Put into the ESPHome file below. Check it, then click Open in ESPHome.',6000);
    return;
  }
  if(el.id==='wrEspReset'){WF.store.set('esphome.edit','');renderWiringSide();WF.flash('Back to the EvenUCan file.',4000);return;}
  if(el.id==='wrEspSave'){const r=esphomeYaml(wr.plan,esphForm());if(r.yaml){if(window.wfNative&&window.wfNative.saveAppFile){window.wfNative.saveAppFile(r.slug+'.yaml',esphCurrent(r)).then(res=>WF.flash(res.ok?'Saved to '+res.file:'Could not save: '+res.err,7000));}else{WF.downloadBlob(r.slug+'.yaml',new Blob([esphCurrent(r)],{type:'text/yaml'}));WF.flash('Saved '+r.slug+'.yaml');}}}
  if(el.id==='wrSaveProject'){WF.saveFile&&WF.saveFile();return;}
  if(el.id==='btnEditTopic'){
    const cur=intentTopic()||'';
    const next=prompt('Enter your preferred name for phone messages (letters, numbers, hyphens):\ne.g. dog-flap-482 or my-dog-flap',cur);
    if(next&&next.trim()&&next.trim()!==cur){
      const slug=next.toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'');
      if(slug.length>=3){
        WF.store.set('intent_inputs.ntfy_topic',slug);
        const it=intentNow();if(it&&it.inputs)it.inputs.ntfy_topic=slug;
        if(wr&&wr.ai)wr.ai=null;
        renderWiringSide();
        WF.flash('Updated phone topic to: '+slug);
      }
    }
    return;
  }
  if(el.id==='wrEspCheck'){
    const r=esphomeYaml(wr.plan,esphForm()),out=$('wrEspOut');if(!r.yaml)return;
    el.disabled=true;out.innerHTML='<div class="ewNote">Checking with ESPHome… (the first check can take a minute)</div>';
    window.wfNative.esphomeCheck(esphCurrent(r),r.slug).then(res=>{
      el.disabled=false;
      if(!res.found)return out.innerHTML='<div class="warn">ESPHome isn\'t installed on this computer, so it can\'t be checked here. Use Validate in ESPHome Device Builder instead.</div>';
      const lines=res.out.split(/\r?\n/).filter(l=>/ERROR|Failed config|^\s*\[|is a required option|not valid|Invalid|Unable|Couldn't/i.test(l)).slice(0,14).join('\n');
      out.innerHTML=res.ok?'<div class="ok" style="margin:6px 0">✓ ESPHome says the configuration is valid.</div>'
        :'<div class="bad" style="margin:6px 0">✗ ESPHome found a problem:</div><textarea readonly class="wrCode" style="height:120px">'+esc(lines||res.out.slice(-1500))+'</textarea>';
    },er=>{el.disabled=false;out.innerHTML='<div class="bad">Could not run ESPHome: '+esc(er.message||String(er))+'</div>';});
  }
});
$('wrSide').addEventListener('input',e=>{
  const el=e.target;if(!el.dataset.ef||el.type==='radio'||el.type==='checkbox'||el.tagName==='SELECT')return;
  esphSet(el);const r=esphomeYaml(wr.plan,esphForm()),ta=$('wrEsp');if(ta&&r.yaml)ta.value=r.yaml;
});
$('wrSide').addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='wrProv'||el.id==='wrcProv'){WF.store.set('aiProvider',el.value);renderWiringSide();if(!aiKey())WF.flash('Click "'+keyLabel()+'" to add the key for this AI',5000);return;}
  if(!el.dataset.ef)return;
  esphSet(el);if(el.type==='radio'||el.type==='checkbox'||el.tagName==='SELECT')renderWiringSide();
});
$('wrSide').addEventListener('keydown',e=>{
  if(e.target.id==='wrcIn'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();chatSend();}
});
$('wrSide').addEventListener('mouseover',e=>{if(wr.focus)return;const r=e.target.closest('.wrNet');const k=r?+r.dataset.net:-1;if(k!==wr.hi){wr.hi=k;drawWiring();}});
$('wrSide').addEventListener('mouseleave',()=>{if(wr.hi!==-1){wr.hi=-1;drawWiring();}});
// picture: drag a board to move it, drag the background to move about, wheel or pinch to zoom,
// click a part or a wire to see just that one, click the background to show everything again
const wrCv=$('wrCanvas');let wrDrag=null;const wrPts=new Map();
const wrMM=e=>{const r=wrCv.getBoundingClientRect();return [(e.clientX-r.left-wr.view.ox)/wr.view.s,(e.clientY-r.top-wr.view.oy)/wr.view.s];};
const wrPartAt=(x,y)=>[...wr.plan.insts].reverse().find(i=>{const p=wr.pos[i.key];return p&&x>=p[0]&&x<=p[0]+i.part.w&&y>=p[1]-6&&y<=p[1]+i.part.d;});
const wrWireAt=function wrWireAt(sx,sy){
  let best=null;
  for(const h of wr.hit||[])for(let q=1;q<h.pts.length;q++){
    const [ax,ay]=h.pts[q-1],[bx,by]=h.pts[q],dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((sx-ax)*dx+(sy-ay)*dy)/L));
    const d=Math.hypot(ax+t*dx-sx,ay+t*dy-sy);if(d<8&&(!best||d<best.d))best={k:h.k,j:h.j,d};
  }
  return best;
};
wrCv.addEventListener('pointerdown',e=>{
  if(!wr||wr.plan.error||!wr.view)return;
  wrPts.set(e.pointerId,[e.clientX,e.clientY]);wrCv.setPointerCapture(e.pointerId);
  if(wrPts.size===2){// pinch
    const [a,b]=[...wrPts.values()];wrDrag={pinch:true,d:Math.hypot(a[0]-b[0],a[1]-b[1]),auto:wrDrag&&wrDrag.auto};return;
  }
  if(e.button!==0)return;
  const [x,y]=wrMM(e),i=wrPartAt(x,y),auto=!wr.userView;
  wr.userView=wr.userView||{...wr.view};// hold the view still while dragging
  wrDrag={i,x,y,cx:e.clientX,cy:e.clientY,p:i?[...wr.pos[i.key]]:null,v:{...wr.userView},moved:false,auto};
});
wrCv.addEventListener('pointermove',e=>{
  if(wrPts.has(e.pointerId))wrPts.set(e.pointerId,[e.clientX,e.clientY]);
  if(!wrDrag){if(wr&&wr.view&&!wr.plan.error){const [x,y]=wrMM(e),r=wrCv.getBoundingClientRect();wrCv.style.cursor=wrPartAt(x,y)?'move':wrWireAt(e.clientX-r.left,e.clientY-r.top)?'pointer':'grab';}return;}
  if(wrDrag.pinch){
    if(wrPts.size<2)return;const [a,b]=[...wrPts.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),r=wrCv.getBoundingClientRect();
    if(wrDrag.d>0)wrZoom(d/wrDrag.d,(a[0]+b[0])/2-r.left,(a[1]+b[1])/2-r.top);wrDrag.d=d;return;
  }
  const mx=e.clientX-wrDrag.cx,my=e.clientY-wrDrag.cy;
  if(!wrDrag.moved&&Math.hypot(mx,my)<4)return;
  wrDrag.moved=true;
  if(wrDrag.i){const v=wrDrag.v;wr.pos[wrDrag.i.key]=[wrDrag.p[0]+mx/v.s,wrDrag.p[1]+my/v.s];}
  else{wr.userView={s:wrDrag.v.s,ox:wrDrag.v.ox+mx,oy:wrDrag.v.oy+my};wrCv.style.cursor='grabbing';}
  drawWiring();
});
const wrUp=e=>{
  wrPts.delete(e.pointerId);
  if(!wrDrag)return;const d=wrDrag;
  if(d.pinch){if(wrPts.size===0)wrDrag=null;return;}
  wrDrag=null;
  if(d.i&&d.moved){if(d.auto)wr.userView=null;linkNets();renderWiringSide();drawWiring();return;}
  if(d.moved)return;// a pan: keep the new view
  if(d.auto)wr.userView=null;
  if(e.type==='pointercancel')return;
  const r=wrCv.getBoundingClientRect(),w=wrWireAt(e.clientX-r.left,e.clientY-r.top);
  if(d.i&&!(w&&w.d<3))wrSetFocus(wr.focus&&wr.focus.type==='inst'&&wr.focus.key===d.i.key?null:{type:'inst',key:d.i.key});
  else if(w)wrSetFocus({type:'link',k:w.k,j:w.j});
  else if(d.i)wrSetFocus(wr.focus&&wr.focus.type==='inst'&&wr.focus.key===d.i.key?null:{type:'inst',key:d.i.key});
  else if(wr.focus)wrSetFocus(null);
  else drawWiring();
};
wrCv.addEventListener('pointerup',wrUp);wrCv.addEventListener('pointercancel',wrUp);
wrCv.addEventListener('wheel',e=>{if(!wr||wr.plan.error||!wr.view)return;e.preventDefault();const r=wrCv.getBoundingClientRect();wrZoom(Math.exp(-e.deltaY*(e.ctrlKey?0.01:0.0015)),e.clientX-r.left,e.clientY-r.top);},{passive:false});
wrCv.addEventListener('keydown',e=>{
  if(!wr||wr.plan.error)return;
  if(e.key==='ArrowRight'&&wr.step>=0){e.preventDefault();wrGoStep(wr.step+1);}
  else if(e.key==='ArrowLeft'&&wr.step>=0){e.preventDefault();wrGoStep(wr.step-1);}
  else if(e.key==='+'||e.key==='='){wrZoom(1.25);}else if(e.key==='-'){wrZoom(0.8);}
});
$('wrTools').addEventListener('click',e=>{
  const id=e.target.id;if(!wr||wr.plan.error)return;
  if(id==='wrFit'){wr.userView=null;drawWiring();}
  else if(id==='wrZin')wrZoom(1.25);else if(id==='wrZout')wrZoom(0.8);
  else if(id==='wrStep')wrGoStep(0);
  else if(id==='wrNext')wrGoStep(wr.step+1);else if(id==='wrPrev')wrGoStep(wr.step-1);
  else if(id==='wrShowAll')wrSetFocus(null);
  if(id)wrCv.focus();
});
new ResizeObserver(()=>{if(wrBack.style.display==='grid')drawWiring();}).observe(wrCv.parentElement);

// The ESPHome text box is editable: every change is kept (in this browser) and used by Save, Check and Flash.
document.addEventListener('input',function(e){
  if(e.target&&e.target.id==='wrEsp'){try{WF.store.set('esphome.edit',e.target.value);}catch(err){console.warn('EvenUCan: could not keep the ESPHome edit',err);}}
});
