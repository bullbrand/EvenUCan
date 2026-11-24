// EvenUCan Enclosure Wizard - 18-flash-and-firmware.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ==================== ESP32 FLASHER CLIENT CONTROLLER ====================
let currentFlashJobId = null;
let flashPollTimer = null;

const initFlashModal=function initFlashModal() {
  const m = $('flashModalBack');
  if (!m || m.dataset.inited) return;
  m.dataset.inited = '1';

  const closeBtn = $('flashModalClose');
  const doneBtn = $('flashModalDone');
  const refreshBtn = $('flashRefreshPorts');
  const wsBtn = $('flashWebSerialBtn');
  const drvBtn = $('flashInstallDriverBtn');
  const startBtn = $('flashStartBtn');
  const cancelBtn = $('flashCancelBtn');
  const clearConsoleBtn = $('flashClearConsole');

  if (closeBtn) closeBtn.onclick = closeFlashModal;
  if (doneBtn) doneBtn.onclick = closeFlashModal;
  if (refreshBtn) refreshBtn.onclick = refreshFlashPorts;
  if (wsBtn) wsBtn.onclick = pairWebSerialPort;
  if (drvBtn) drvBtn.onclick = installUsbDriver;
  if (startBtn) startBtn.onclick = startFlashingProcess;
  const testBtn = $('flashTestBtn');
  if (testBtn) testBtn.onclick = startCompilerTest;
  if (cancelBtn) cancelBtn.onclick = cancelFlashingProcess;
  if (clearConsoleBtn) clearConsoleBtn.onclick = () => { const c = $('flashConsole'); if (c) c.textContent = ''; };
  const copyConsoleBtn = $('flashCopyConsole');
  if (copyConsoleBtn) copyConsoleBtn.onclick = () => {
    const c = $('flashConsole');
    if (!c) return;
    navigator.clipboard.writeText(c.textContent).then(() => {
      copyConsoleBtn.textContent = 'Copied!';
      setTimeout(() => { copyConsoleBtn.textContent = 'Copy Output'; }, 1500);
    }).catch(() => {
      // fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = c.textContent;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyConsoleBtn.textContent = 'Copied!';
      setTimeout(() => { copyConsoleBtn.textContent = 'Copy Output'; }, 1500);
    });
  };

  m.addEventListener('click', (e) => {
    if (e.target === m) closeFlashModal();
  });
};

const pairWebSerialPort=async function pairWebSerialPort() {
  if (!('serial' in navigator)) {
    WF.flash('Web Serial is supported in Chrome, Edge, and Opera. On other browsers, use the USB COM Port list above.');
    return;
  }
  try {
    const port = await navigator.serial.requestPort();
    const info = port.getInfo ? port.getInfo() : {};
    const vid = info.usbVendorId ? '0x' + info.usbVendorId.toString(16).toUpperCase() : 'ESP32';
    const pid = info.usbProductId ? '0x' + info.usbProductId.toString(16).toUpperCase() : 'Device';
    updateFlashStatus('🔌', `Paired with USB Serial (${vid}:${pid}). Ready to flash!`, 'success');
    logToFlashConsole(`[WebSerial] Paired with device VID=${vid} PID=${pid}`);
    const sel = $('flashPortSelect');
    if (sel) {
      const opt = document.createElement('option');
      opt.value = 'webserial';
      opt.textContent = `🔌 WebSerial Device (${vid}:${pid})`;
      opt.selected = true;
      sel.insertBefore(opt, sel.firstChild);
    }
  } catch (err) {
    if (err.name !== 'NotFoundError') {
      WF.flash('WebSerial: ' + err.message);
    }
  }
};

const openFlashModal=async function openFlashModal() {
  initFlashModal();
  fwInit(); fwRefresh();
  const m = $('flashModalBack');
  if (!m) return;
  m.style.display = 'grid';
  await refreshFlashPorts();
  if (bwDetected && bwCompare(bwDetected) === 'mismatch') bwShowCard();
};

const closeFlashModal=function closeFlashModal() {
  const m = $('flashModalBack');
  if (!m) return;
  m.style.display = 'none';
};

const installUsbDriver=async function installUsbDriver() {
  updateFlashStatus('⏳', 'Launching Silicon Labs CP210x driver installer... If Windows prompts for permission, click YES.', 'running');
  logToFlashConsole('[Driver] Launching CP210x driver installer for Windows (pololu-cp2102-setup-x64.exe)...');
  try {
    const res = await fetch('/api/flash/install-driver', { method: 'POST' });
    const data = await res.json();
    if (data.status === 'launched') {
      WF.flash('Driver installer launched! Click YES on the Windows prompt, finish the install, then click Refresh Ports.', 8000);
      logToFlashConsole('[Driver] Installer window opened on your desktop. Complete the setup wizard, then click "Refresh Ports".');
    } else {
      WF.flash('Could not launch installer: ' + (data.message || data.status));
    }
  } catch (err) {
    WF.flash('Error launching driver installer: ' + err.message);
  }
};

const refreshFlashPorts=async function refreshFlashPorts() {
  const sel = $('flashPortSelect');
  const drvBtn = $('flashInstallDriverBtn');
  if (!sel) return;
  sel.innerHTML = '<option value="">Scanning USB ports…</option>';
  try {
    const res = await fetch('/api/flash/ports');
    if (!res.ok) throw new Error('Server returned ' + res.status);
    const data = await res.json();
    sel.innerHTML = '';
    const ports = data.ports || [];
    if (!ports.length) {
      if (data.missing_driver) {
        sel.innerHTML = `<option value="">⚠️ ${data.missing_driver} (Driver Missing)</option>`;
        updateFlashStatus('⚠️', `Found plugged-in "${data.missing_driver}", but Windows is missing the USB driver. Click "Install CP210x Driver" to install it.`, 'error');
        if (drvBtn) drvBtn.style.display = 'inline-block';
        logToFlashConsole(`[Notice] Detected plugged-in USB hardware: ${data.missing_driver}. Windows does not have a Virtual COM Port driver installed yet.`);
      } else {
        sel.innerHTML = '<option value="">(No USB COM ports found)</option>';
        if (drvBtn) drvBtn.style.display = 'none';
        updateFlashStatus('⚪', 'Ready. Plug in your ESP32 with a data USB cable, select the COM port, and click Start Flashing.');
      }
    } else {
      if (drvBtn) drvBtn.style.display = 'none';
      sel.innerHTML = '<option value="">Auto-Detect Port</option>';
      for (const p of ports) {
        const opt = document.createElement('option');
        opt.value = p.port;
        opt.textContent = `${p.port}: ${p.desc || 'Serial Device'}`;
        sel.appendChild(opt);
      }
      updateFlashStatus('⚪', `Ready. Found ${ports.length} COM port(s). Selected: ${ports[0].port}. Click Start Flashing.`);
    }
  } catch (err) {
    sel.innerHTML = '<option value="">(Local server required for flashing)</option>';
    updateFlashStatus('⚪', 'Note: Open EvenUCan via start.bat (http://localhost:8080) so the local compiler can access your USB ports.');
  }
};

// After a build or flash: say plainly that the saved FIRMWARE is only the program for the board, and whether the PROJECT
// (box, parts, wiring, code) is saved. Someone who flashes and closes would otherwise lose the project.
const projectSaveNote=function projectSaveNote() {
  const banner = $('flashStatusBanner');
  if (!banner || !window.WF) return;
  let n = $('flashSaveNote');
  if (!n) { n = document.createElement('div'); n.id = 'flashSaveNote'; n.style.cssText = 'margin-top:8px;padding:9px 14px;border-radius:6px;font-size:13px;line-height:1.5;border:1px solid var(--line)'; banner.insertAdjacentElement('afterend', n); }
  if (WF.dirty) {
    n.style.borderColor = '#d97706'; n.style.background = 'rgba(217,119,6,0.1)';
    n.innerHTML = '<b>Your project is not saved yet.</b><br>The firmware kept below is only the program for the board. Your box, parts, wiring and code are in the project, and they are lost if you close EvenUCan without saving it.' +
      '<div style="margin-top:6px"><button id="flashSaveProject" class="primary" style="cursor:pointer">💾 Save project now (.3mf)</button></div>';
    const b = $('flashSaveProject');
    if (b) b.onclick = async () => { try { await WF.saveFile(); } catch (e) { console.warn('EvenUCan: save project failed', e); } setTimeout(projectSaveNote, 400); };
  } else {
    n.style.borderColor = '#16a34a'; n.style.background = 'rgba(22,163,74,0.1)';
    n.innerHTML = '✓ Your project is saved too (the box, parts, wiring and code), not just the firmware.';
  }
};

const updateFlashStatus=function updateFlashStatus(icon, text, bannerClass) {
  const iconEl = $('flashStatusIcon');
  const textEl = $('flashStatusText');
  const banner = $('flashStatusBanner');
  if (iconEl) iconEl.textContent = icon;
  if (textEl) textEl.textContent = text;
  if (banner) {
    banner.style.borderColor = bannerClass === 'success' ? '#16a34a' : (bannerClass === 'error' ? '#dc2626' : 'var(--line)');
    banner.style.backgroundColor = bannerClass === 'success' ? 'rgba(22,163,74,0.1)' : (bannerClass === 'error' ? 'rgba(220,38,38,0.1)' : 'var(--panel)');
  }
};

const logToFlashConsole=function logToFlashConsole(line) {
  const c = $('flashConsole');
  if (!c) return;
  c.textContent += line + '\n';
  c.scrollTop = c.scrollHeight;
};

// ---- Friendly build progress: phase, %, elapsed time and a "still alive" heartbeat ----
const flashProg = { start: 0, lastLog: 0, phase: 0, pct: 0, label: '', step: 0, total: 0 };
const flashFmtTime=function flashFmtTime(ms) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
};
const flashProgReset=function flashProgReset() {
  Object.assign(flashProg, { start: Date.now(), lastLog: Date.now(), phase: 0, pct: 0, label: 'Getting started', step: 0, total: 0 });
};
const flashProgFeed=function flashProgFeed(line) {
  flashProg.lastLog = Date.now();
  const m = line.match(/\[(\d+)\/(\d+)\]/);
  if (m) { flashProg.step = +m[1]; flashProg.total = +m[2]; }
  const set = (ph, label, floor) => { if (ph >= flashProg.phase) { flashProg.phase = ph; flashProg.label = label; flashProg.pct = Math.max(flashProg.pct, floor); } };
  if (/Reading configuration/i.test(line)) set(1, 'Checking your settings', 3);
  else if (/Generating C\+\+/i.test(line)) set(2, 'Writing the program', 8);
  else if (/ESP-IDF|framework|Python environment|Downloading|Installing|CMake|-- /i.test(line)) set(3, 'Getting the tools ready (slow the first time)', 12);
  else if (/Compiling|Building|Linking/i.test(line) || m) set(4, 'Building your firmware', 20);
  else if (/Uploading|Writing at|esptool|Connecting|Chip is|Hard resetting/i.test(line)) set(5, 'Sending the program to your board', 90);
  if (flashProg.phase === 4 && flashProg.total > 0) {
    flashProg.pct = Math.max(flashProg.pct, 20 + Math.round(65 * flashProg.step / flashProg.total));
  }
  const up = line.match(/\((\d+)\s*%\)/);
  if (flashProg.phase === 5 && up) flashProg.pct = Math.max(flashProg.pct, 90 + Math.round(+up[1] / 10));
};
const flashProgEnsure=function flashProgEnsure() {
  if (!document.getElementById('flashProgStyle')) {
    const st = document.createElement('style');
    st.id = 'flashProgStyle';
    st.textContent = '#flashProg{margin:10px 0;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}' +
      '#flashProg .fp-bar{height:12px;border-radius:6px;background:rgba(127,127,127,.2);overflow:hidden;position:relative}' +
      '#flashProg .fp-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,#2563eb,#38bdf8);transition:width .8s ease;position:relative;overflow:hidden}' +
      '#flashProg .fp-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:fpShine 1.6s linear infinite}' +
      '@keyframes fpShine{from{transform:translateX(-100%)}to{transform:translateX(100%)}}' +
      '#flashProg .fp-row{display:flex;justify-content:space-between;gap:10px;margin-top:8px;font-size:13px;flex-wrap:wrap}' +
      '#flashProg .fp-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#16a34a;margin-right:6px;animation:fpPulse 1.2s ease-in-out infinite}' +
      '@keyframes fpPulse{0%,100%{opacity:.25}50%{opacity:1}}' +
      '#flashProg .fp-note{margin-top:6px;font-size:12px;opacity:.75}';
    document.head.appendChild(st);
  }
  let el = document.getElementById('flashProg');
  if (!el) {
    const banner = $('flashStatusBanner');
    if (!banner || !banner.parentNode) return null;
    el = document.createElement('div');
    el.id = 'flashProg';
    el.innerHTML = '<div class="fp-bar"><div class="fp-fill" style="width:3%"></div></div>' +
      '<div class="fp-row"><span><span class="fp-dot"></span><b class="fp-label"></b></span><span class="fp-pct"></span><span class="fp-time"></span></div>' +
      '<div class="fp-note"></div>';
    banner.parentNode.insertBefore(el, banner.nextSibling);
  }
  return el;
};
const flashProgRender=function flashProgRender(running) {
  const el = flashProgEnsure();
  if (!el) return;
  el.style.display = running ? 'block' : 'none';
  if (!running) return;
  const now = Date.now(), quiet = now - flashProg.lastLog;
  // creep forward slowly so the bar never looks frozen while a long step runs
  const shown = Math.min(flashProg.pct + Math.min(4, Math.floor((now - flashProg.start) / 30000)), 99);
  el.querySelector('.fp-fill').style.width = Math.max(shown, 3) + '%';
  el.querySelector('.fp-label').textContent = flashProg.label;
  el.querySelector('.fp-pct').textContent = shown + '%';
  el.querySelector('.fp-time').textContent = 'Time so far: ' + flashFmtTime(now - flashProg.start);
  el.querySelector('.fp-note').textContent = quiet > 20000
    ? 'Still working — this step is slow on some computers and goes quiet for a while. All is well, please sit tight and don’t close this window.'
    : 'All is well. The first build can take 5–20 minutes. You can leave this running.';
};

// mode 'boot': the board never switched into upload mode (the build is fine and is kept: no clean rebuild)
const showFlashRetry=function showFlashRetry(show, mode) {
  let b = $('flashRetryBtn');
  if (!b && show) {
    const banner = $('flashStatusBanner');
    if (!banner) return;
    b = document.createElement('button');
    b.id = 'flashRetryBtn';
    b.className = 'btn';
    b.style.cssText = 'margin-left:12px;';
    b.textContent = '🔧 Fix it & try again';
    b.addEventListener('click', () => startFlashingProcess(b.dataset.mode === 'boot' ? {} : { clean: true }));
    banner.appendChild(b);
  }
  if (b && show) { b.dataset.mode = mode || ''; b.textContent = mode === 'boot' ? '🔘 I am holding BOOT: try again' : '🔧 Fix it & try again'; }
  if (b) b.style.display = show ? 'inline-block' : 'none';
};

// Watches a compile/flash/test job on the server and mirrors its log + status into the modal.
const watchFlashJob=function watchFlashJob(action, startBtn, cancelBtn, testUpload) {
  flashProgReset();
  flashProgRender(true);
  if (flashPollTimer) clearInterval(flashPollTimer);
  let lastLogCount = 0;
  let buildStep = 0, buildTotal = 0, bootFail = false;
  const spinFrames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let spinIdx = 0;
  const baseMsg = action === 'test' ? (testUpload ? 'Compiler test: compiling Blink and uploading to your board' : 'Compiler test: compiling Blink') : action === 'compile' ? 'Compiling firmware binary' : 'Compiling & flashing over USB';
  flashPollTimer = setInterval(async () => {
    try {
      const sRes = await fetch('/api/flash/status?id=' + currentFlashJobId + '&since=' + lastLogCount);
      if (!sRes.ok) return;
      const job = await sRes.json();
      const logs = job.logs || [];
      // Server returns only lines after `since` (absolute index) plus the new absolute total
      for (let i = 0; i < logs.length; i++) {
        logToFlashConsole(logs[i]);
        flashProgFeed(logs[i]);
        if (/Wrong boot mode|Failed to connect to ESP|No serial data received|Timed out waiting for packet header/i.test(logs[i])) bootFail = true;
        const m = logs[i].match(/\[(\d+)\/(\d+)\]/);
        if (m) { buildStep = parseInt(m[1]); buildTotal = parseInt(m[2]); }
      }
      if (typeof job.total === 'number') lastLogCount = job.total;
      flashProgRender(job.status === 'running');
      if (job.status === 'running') {
        spinIdx = (spinIdx + 1) % spinFrames.length;
        const spin = spinFrames[spinIdx];
        const prog = buildTotal > 0 ? ` — step ${buildStep} of ${buildTotal}` : '';
        updateFlashStatus(spin, baseMsg + prog + '…', 'running');
      }
      if (job.status === 'success') {
        clearInterval(flashPollTimer);
        flashPollTimer = null;
        updateFlashStatus('✅', action === 'test' ? (testUpload ? 'COMPILER TEST PASSED: Blink compiled, was uploaded to your board and the board accepted it. The whole chain works, from compiler to board.' : 'COMPILER TEST PASSED: Blink compiled all the way to the end. Your compiler is working. (Nothing was uploaded: your board was left untouched.)') : action === 'compile' ? 'Compilation finished successfully! Binary is verified.' : 'SUCCESS: ESP32 flashed successfully! Your device is now running.', 'success');
        setFlashBusy(false);
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (typeof fwRefresh === 'function') fwRefresh();
        if (action !== 'test') { const lib = $('fwLibrary'); if (lib) lib.open = true; }   // a saved copy now exists: show it (to flash a second board)
        WF.flash(action === 'test' ? '✅ Compiler test passed.' : '✅ Flash successful! Your ESP32 is running.', 5000);
        if (action !== 'test') projectSaveNote();
      } else if (job.status === 'error' || job.status === 'cancelled') {
        clearInterval(flashPollTimer);
        flashPollTimer = null;
        updateFlashStatus('❌', job.status === 'cancelled' ? 'Stopped.' : bootFail ? 'Your code built fine, but the board did not switch into upload mode. HOLD the BOOT button on the board (some boards call it IO0), then press the button on the right and keep holding until you see "Writing" in the log.' : action === 'test' ? 'COMPILER TEST FAILED. See the terminal output below (use Copy Output to share it).' : 'Something went wrong. Press "Fix it & try again" and EvenUCan will tidy up and retry.', 'error');
        if (action !== 'test' || bootFail) showFlashRetry(true, bootFail ? 'boot' : '');
        setFlashBusy(false);
        if (cancelBtn) cancelBtn.style.display = 'none';
      }
    } catch (err) {
      console.warn('Poll error:', err);
    }
  }, 800);
};

// Start / test buttons are disabled together while any job runs.
const setFlashBusy=function setFlashBusy(busy) {
  window.__flashBusy = !!busy;
  ['flashStartBtn', 'flashTestBtn'].forEach(id => { const b = $(id); if (b) b.disabled = busy; });
  if (typeof fwRender === 'function') fwRender();   // the saved-firmware buttons follow the same busy state
  const cancelBtn = $('flashCancelBtn');
  if (cancelBtn) cancelBtn.style.display = busy ? 'inline-block' : 'none';
};

// ---- Board watcher: notices a board being plugged in (on any page), identifies it, and compares it with the project ----
// It only polls the cheap port list; the chip check (which reboots the board) runs once per newly plugged-in port,
// and never while a compile/upload is running.
const bwRetries = {};   // port -> quiet retries used (a board just plugged in is often not ready for the first attempt)
let bwKnown = new Set(), bwDetected = null, bwTimer = null, bwBusy = false, bwHideT = null, bwLastKey = '', bwBusyPort = null;
window.__flashBusy = window.__flashBusy || false;

const bwFamilyOfBoardId=function bwFamilyOfBoardId(id) {
  id = String(id || '').toLowerCase();
  if (/d1_mini|nodemcu|esp8266/.test(id)) return 'ESP8266';
  if (/s3/.test(id)) return 'ESP32-S3'; if (/c3/.test(id)) return 'ESP32-C3'; if (/c6/.test(id)) return 'ESP32-C6';
  if (/s2/.test(id)) return 'ESP32-S2'; if (/esp32/.test(id)) return 'ESP32';
  return '';
};
const bwName = fam => fam === 'ESP32' ? 'ESP32 (classic)' : fam === 'ESP8266' ? 'ESP8266 (NodeMCU / D1 Mini type)' : fam;
const bwWho = d => d.ok ? bwDesc(d) : (d.usb_board || 'not an ESP32 board');
// What the current project is built for, or null when there is no project yet.
const bwExpected=function bwExpected() {
  try {
    const P = wr && wr.plan; if (!P || P.error || !P.ctrl || !P.ctrl.part) return null;
    const pf = pfOfPlan(P);
    if (pf === 'arduino') return { kind: 'avr', label: 'Arduino Nano' };
    if (pf === 'raspberrypi') return null;
    const eb = espBoard(P.ctrl.part), fam = eb ? bwFamilyOfBoardId(eb.board) : '';
    return fam ? { kind: 'esp', family: fam, label: bwName(fam) } : null;
  } catch (e) { return null; }
};
// Boards EvenUCan has full pin data for, by chip family (the part to switch the project to)
const BW_PART = { 'ESP32-S3': 'b-esp32s3', 'ESP32': 'p-esp32-devkit38', 'ESP32-C3': 'p-esp32c3-supermini', 'ESP8266': 'p-d1mini' };
const bwDesc=function bwDesc(d) {
  const bits = [bwName(d.family)];
  if (d.flash_mb) bits.push(d.flash_mb + ' MB flash');
  if (d.family !== 'ESP8266' && d.psram_mb !== null && d.psram_mb !== undefined) bits.push(d.psram_mb ? d.psram_mb + ' MB PSRAM' : 'no PSRAM');
  bits.push(d.wifi ? (d.bluetooth ? 'Wi-Fi + Bluetooth' : 'Wi-Fi') : 'no Wi-Fi');
  return bits.join(', ');
};
// 'match' | 'mismatch' | 'none' (no project yet) | 'unknown' (board could not be read)
const bwCompare=function bwCompare(d) {
  const e = bwExpected(); if (!e || !d) return 'none';
  if (!d.ok) {
    if (e.kind === 'avr') return d.arch === 'avr328' ? 'match' : (d.arch ? 'mismatch' : 'unknown');   // Uno R3 and Nano share the ATmega328P
    return d.reason === 'unsupported' ? 'mismatch' : 'unknown';
  }
  if (e.kind === 'avr') return 'mismatch';
  return d.family === e.family ? 'match' : 'mismatch';
};
// Plain-English reason to stop an upload, or '' when it is fine to go ahead.
const bwUploadBlock=function bwUploadBlock(port) {
  const d = bwDetected; if (!d || (port && d.port !== port)) return '';
  if (bwCompare(d) !== 'mismatch') return '';
  const e = bwExpected();
  return 'The board plugged in is ' + (d.ok ? bwDesc(d) : (d.usb_board ? 'an ' + d.usb_board : 'not an ESP32')) + ', but your project is built for ' + e.label +
    '. Their pins and memory differ, so the code would not work. Plug in the ' + e.label + ', or switch your project to the board you have.';
};
const bwHideCard=function bwHideCard() { const c = $('boardDetectCard'); if (c) c.style.display = 'none'; clearTimeout(bwHideT); };
const bwKey=function bwKey() { const e = bwExpected(); return bwDetected ? bwDetected.port + '|' + (bwDetected.ok ? bwDetected.family : 'x') + '|' + (e ? e.label : '') : ''; };
// The project may be created or changed AFTER the board was plugged in: judge again whenever either changes
const bwRecheck=function bwRecheck() {
  if (!bwDetected || bwKey() === bwLastKey) return;
  const c = bwCompare(bwDetected);
  if (c === 'match' || c === 'mismatch') bwShowCard(); else bwLastKey = bwKey();
};
const bwShowCard=function bwShowCard() {
  const d = bwDetected; if (!d) return;
  bwLastKey = bwKey();
  { const su = $('suBack'); if (su && su.style.display === 'grid') return; }   // the first-run setup shows the board itself
  let c = $('boardDetectCard');
  if (!c) {
    c = document.createElement('div'); c.id = 'boardDetectCard';
    c.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:64px;width:min(440px,calc(100vw - 32px));z-index:10010;padding:14px 16px;border-radius:10px;font-size:13px;line-height:1.45;box-shadow:0 8px 28px #0006;background:var(--panel,#fff);color:var(--text,#111);border:2px solid var(--line,#ccc)';
    c.addEventListener('click', bwClick); document.body.appendChild(c);
  }
  const cmp = bwCompare(d), e = bwExpected();
  let html, color = '#2563eb', auto = 0;
  const btn = (k, t, cls) => `<button data-bw="${k}" class="${cls || 'sec'}" style="margin:6px 6px 0 0;cursor:pointer">${t}</button>`;
  if (!d.ok && cmp !== 'mismatch') {
    html = `<b>🔌 ${d.usb_board ? esc(d.usb_board) + ' detected' : 'A board is plugged in'} on ${esc(d.port)}</b><div style="margin-top:4px">${esc(d.message || 'It could not be checked.')}</div>` + btn('close', 'OK');
    color = '#d97706';
  } else if (cmp === 'match') {
    html = `<b>✅ Board detected: ${esc(bwWho(d))}</b><div style="margin-top:4px">It matches your project (${esc(e.label)}). Good to go.</div>`; color = '#16a34a'; auto = 3000;
  } else if (cmp === 'mismatch') {
    const have = bwWho(d);
    const canSwitch = d.ok && !!BW_PART[d.family];
    html = `<b>⚠️ Board detected: ${esc(have)}</b><div style="margin-top:4px">Your project is built for <b>${esc(e.label)}</b>. Pins and memory are different, so code for one will not work on the other. Uploading is paused so nothing gets mixed up. If you switch, EvenUCan lists any wires you will need to move.</div>` +
      (d.ok && !canSwitch ? `<div style="margin-top:4px;opacity:.8">EvenUCan can't build projects for the ${esc(bwName(d.family))} yet.</div>` : '') +
      (canSwitch ? btn('switch', 'Switch my project to this board', 'primary') : '') + btn('keep', "Keep my project, I'll plug in the correct board");
    color = '#dc2626'; auto = 3000;
  } else {
    // no project open yet: remember this board so new projects start from it (what the message below promises)
    try { if (d.ok && BW_PART[d.family] && PREF_BOARDS.includes(BW_PART[d.family])) WF.store.set('pref_board', BW_PART[d.family]); } catch (err) { /* only a convenience */ }
    html = `<b>🔌 Board detected: ${esc(bwDesc(d))}</b><div style="margin-top:4px">EvenUCan will use this to match pins and memory when you build your project.</div>` + btn('close', 'OK'); auto = 3000;
  }
  c.style.borderColor = color; c.innerHTML = html; c.style.display = 'block';
  clearTimeout(bwHideT); if (auto) bwHideT = setTimeout(bwHideCard, auto);
};
const bwClick=function bwClick(e) {
  const k = e.target && e.target.dataset && e.target.dataset.bw; if (!k) return;
  if (k === 'switch') {
    const d = bwDetected, ex = bwExpected();
    if (d && d.ok && BW_PART[d.family]) {
      let pf = 'esphome'; try { const P = wr && wr.plan; if (P && !P.error && pfOfPlan(P) === 'esp32ide') pf = 'esp32ide'; } catch (err) { /* keep ESPHome */ }
      bwHideCard(); try { switchBoard(pf, BW_PART[d.family]); } catch (err) { WF.flash('Could not switch the project: ' + err.message, 6000); }
    }
    return;
  }
  bwHideCard();
  if (k === 'keep') { const ex = bwExpected(); WF.flash('Keeping your project. Plug in the ' + (ex ? ex.label : 'correct board') + ' when you are ready; uploading stays paused until then.', 7000); }
};
const bwTick=async function bwTick() {
  if (bwBusy || window.__flashBusy) return;
  try { bwRecheck(); } catch (e) { /* never let the watcher break the page */ }
  bwBusy = true;
  try {
    const r = await fetch('/api/flash/ports?quick=1', { cache: 'no-store' });
    if (!r.ok) return;
    const ports = ((await r.json()).ports || []).map(p => p.port);
    for (const k of [...bwKnown]) if (!ports.includes(k)) { bwKnown.delete(k); delete bwRetries[k]; if (bwDetected && bwDetected.port === k) { bwDetected = null; bwHideCard(); if (typeof fwRender === 'function') fwRender(); } }
    for (const p of ports) {
      if (bwKnown.has(p) || window.__flashBusy) continue;
      bwKnown.add(p);
      const d = await (await fetch('/api/flash/identify?port=' + encodeURIComponent(p), { cache: 'no-store' })).json();
      // Not ready yet (driver still starting, or the board is mid-reboot): try again quietly up to twice before showing a message
      if ((d.reason === 'no_response' || d.reason === 'busy') && (bwRetries[p] = (bwRetries[p] || 0) + 1) <= 2) { bwKnown.delete(p); await new Promise(r => setTimeout(r, 3000)); continue; }
      if (d.reason === 'busy') {   // another program (e.g. Arduino IDE) holds the port: say so once, then look again later
        bwKnown.delete(p);
        if (bwBusyPort !== p) { bwBusyPort = p; bwDetected = Object.assign({ port: p }, d, { ok: false }); bwShowCard(); }
        continue;
      }
      if (bwBusyPort === p) bwBusyPort = null;
      bwDetected = Object.assign({ port: p }, d); bwShowCard(); if (typeof fwRender === 'function') fwRender();
    }
  } catch (e) { /* no local server (page opened as a file): nothing to watch */ }
  finally { bwBusy = false; }
};
// Look often while waiting for a board to be plugged in, rarely once one is known, hardly at all when the tab is hidden.
// (Unplugging is still noticed within 8 s, and then the quick 3 s looking resumes for the replacement.)
const bwDelay=function bwDelay() { return document.hidden ? 15000 : (bwKnown.size ? 8000 : 3000); };
const bwStart=function bwStart() {
  if (bwTimer) return;
  const loop = async () => { try { await bwTick(); } finally { bwTimer = setTimeout(loop, bwDelay()); } };
  bwTimer = 1; loop();
};
document.addEventListener('visibilitychange', () => { if (!document.hidden && bwTimer && bwTimer !== 1) { clearTimeout(bwTimer); bwTimer = null; bwStart(); } });
setTimeout(bwStart, 1500);

// ---- Saved firmware library: flash a previously compiled image to another board (one per room), save/rename/delete ----
let fwItems = [], fwUndoId = '';
const fwFlashedOnce = new Set();
const fwSetMsg=function fwSetMsg(html) { const m = $('fwMsg'); if (m) m.innerHTML = html || ''; };
const fwApi=async function fwApi(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
};
// How well a stored image suits the board that is plugged in right now: {ok, text}
const fwFit=function fwFit(it) {
  const d = bwDetected;
  if (!d) return { ok: true, text: '' };
  if (!d.ok) return { ok: true, text: '' };
  if (d.family !== it.chip) return { ok: false, text: '✗ Built for ' + bwName(it.chip) + ', but the board plugged in is ' + bwName(d.family) };
  if (it.flash_mb && d.flash_mb && it.flash_mb > d.flash_mb) return { ok: false, text: '✗ Needs ' + it.flash_mb + ' MB of memory; this board has ' + d.flash_mb + ' MB' };
  return { ok: true, text: '✓ Matches the board on ' + d.port };
};
const fwRender=function fwRender() {
  const box = $('fwList'); if (!box) return;
  const busyNote = window.__flashBusy && fwItems.length ? '<div style="font-size:12px;color:var(--warn);padding:4px 0">⏳ A build or upload is running. You can flash a saved copy when it has finished.</div>' : '';
  if (!fwItems.length) { box.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:6px 0">Nothing saved yet. Every successful compile is kept here automatically, or use "Browse for a file…".</div>'; return; }
  box.innerHTML = busyNote + fwItems.map(it => {
    const fit = fwFit(it), id = esc(it.id);
    const meta = [bwName(it.chip), it.flash_mb ? it.flash_mb + ' MB' : '', Math.round(it.size / 1024) + ' KB', (it.created || '').slice(0, 10)].filter(Boolean).join(' · ');
    return `<div class="fwRow" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:7px 0;border-top:1px solid var(--line)">
      <div style="flex:1;min-width:200px"><b>${esc(it.title || it.name)}</b><div style="font-size:11px;color:var(--muted)">${esc(meta)}</div>
        ${fit.text ? `<div style="font-size:11px;color:${fit.ok ? 'var(--ok)' : 'var(--danger)'}">${esc(fit.text)}</div>` : ''}</div>
      <button class="primary" data-fw="flash" data-id="${id}" style="cursor:pointer"${fit.ok && !window.__flashBusy ? '' : ' disabled'}${window.__flashBusy ? ' title="Wait until the current build or upload has finished"' : ''}>⚡ Flash to board</button>
      <button class="sec" data-fw="save" data-id="${id}" style="cursor:pointer" title="Already saved in the library. This puts an extra copy on your computer, to back up or share">⬇️ Download a copy</button>
      <button class="sec" data-fw="rename" data-id="${id}" style="cursor:pointer">✏️ Rename</button>
      <button class="sec" data-fw="delete" data-id="${id}" style="cursor:pointer;color:var(--danger)">🗑️ Delete</button></div>`;
  }).join('');
};
const fwRefresh=async function fwRefresh() {
  try { const r = await fetch('/api/firmware/list', { cache: 'no-store' }); const j = await r.json(); fwItems = j.items || []; const d = $('fwDirTxt'); if (d) d.textContent = j.dir ? 'Kept in this folder: ' + j.dir : ''; }
  catch (e) { fwItems = []; }
  fwRender();
};
const fwFlash=async function fwFlash(id) {
  if ((($('flashStartBtn') || {}).disabled)) return;
  const sel = $('flashPortSelect');
  const hasBoard = !!(sel && Array.from(sel.options).some(o => o.value && o.value !== 'webserial'));
  if (!hasBoard) { fwSetMsg('<span style="color:var(--danger)">Plug in a board with a data USB cable first, then try again.</span>'); return; }
  const port = sel.value && sel.value !== 'webserial' ? sel.value : (bwDetected ? bwDetected.port : null);
  if (!port) { fwSetMsg('<span style="color:var(--danger)">Pick the board\'s USB port first.</span>'); return; }
  fwSetMsg('');
  const it = fwItems.find(x => x.id === id) || {};
  if (it.platform === 'esphome' && it.unique_names === false && fwFlashedOnce.has(id) &&
      !confirm('You already put "' + (it.title || id) + '" on another board.\n\nThis firmware gives every board the SAME name, so Home Assistant will mix them up.\n\nTo fix it: tick "I\'m making more than one of these" in the ESPHome settings and compile again.\n\nFlash it anyway?')) return;
  const c = $('flashConsole');
  if (c) c.textContent = `[${new Date().toLocaleTimeString()}] FLASH SAVED FIRMWARE "${it.title || id}" to ${port}\n`;
  setFlashBusy(true);
  updateFlashStatus('⏳', 'Checking the board, then sending "' + (it.title || id) + '" to it…', 'running');
  try {
    const res = await fwApi('/api/firmware/flash', { id, port });
    if (res.status !== 'started' || !res.id) throw new Error(res.message || 'Could not start');
    currentFlashJobId = res.id;
    fwFlashedOnce.add(id);
    watchFlashJob('run', $('flashStartBtn'), $('flashCancelBtn'));
    fwSetMsg('When it finishes, plug in the next board and click <b>Flash to board</b> again. EvenUCan checks every board before writing to it.');
  } catch (err) {
    flashProgRender(false);
    updateFlashStatus('⛔', err.message, 'error');
    setFlashBusy(false);
  }
};
const fwBrowse=async function fwBrowse(file) {
  if (!file) return;
  fwSetMsg('Checking the file…');
  try {
    const r = await fetch('/api/firmware/import', { method: 'POST', headers: { 'X-Filename': encodeURIComponent(file.name), 'Content-Type': 'application/octet-stream' }, body: file });
    const res = await r.json();
    if (!res.ok) { fwSetMsg('<span style="color:var(--danger)">' + esc(res.message || 'That file cannot be used.') + '</span>'); return; }
    fwSetMsg('<span style="color:var(--ok)">Added "' + esc(res.firmware.title) + '" (' + esc(bwName(res.firmware.chip)) + '). It was checked inside, so the chip shown is the real one.</span>');
    fwRefresh();
  } catch (e) { fwSetMsg('<span style="color:var(--danger)">Could not read that file.</span>'); }
};
const fwClick=async function fwClick(e) {
  const b = e.target.closest && e.target.closest('[data-fw]'); if (!b) return;
  const k = b.dataset.fw, id = b.dataset.id, it = fwItems.find(x => x.id === id);
  if (k === 'flash') return fwFlash(id);
  if (k === 'save') { const a = document.createElement('a'); a.href = '/api/firmware/download?id=' + encodeURIComponent(id); a.download = id + '.bin'; document.body.appendChild(a); a.click(); a.remove(); return; }
  if (k === 'rename') {
    const t = prompt('Give this firmware a name you will recognise (for example "Kitchen sensor"):', it ? (it.title || it.name) : '');
    if (t === null) return;
    const res = await fwApi('/api/firmware/rename', { id, title: t });
    if (!res.ok) fwSetMsg('<span style="color:var(--danger)">' + esc(res.message || 'Could not rename.') + '</span>');
    return fwRefresh();
  }
  if (k === 'delete') {
    if (!confirm('Delete "' + (it ? (it.title || it.name) : id) + '"?\n\nYou can undo this straight afterwards.')) return;
    const res = await fwApi('/api/firmware/delete', { id });
    if (!res.ok) { fwSetMsg('<span style="color:var(--danger)">' + esc(res.message || 'Could not delete.') + '</span>'); return; }
    fwUndoId = id;
    fwSetMsg('Deleted. <button class="sec" data-fw="undo" style="cursor:pointer">↩ Undo</button>');
    return fwRefresh();
  }
  if (k === 'undo') {
    const res = await fwApi('/api/firmware/restore', { id: fwUndoId });
    fwSetMsg(res.ok ? 'Restored.' : '<span style="color:var(--danger)">' + esc(res.message || 'Could not restore.') + '</span>');
    fwUndoId = ''; return fwRefresh();
  }
};
const fwInit=function fwInit() {
  const panel = $('fwLibrary'); if (!panel || panel.dataset.inited) return;
  panel.dataset.inited = '1';
  panel.addEventListener('click', fwClick);
  const pick = $('fwFile'), btn = $('fwBrowseBtn'), ofb = $('fwOpenFolderBtn');
  if (ofb) ofb.onclick = async () => { try { const r = await fwApi('/api/firmware/open-folder', {}); if (r && r.ok === false) fwSetMsg('<span style="color:var(--danger)">' + esc(r.message || 'Could not open the folder.') + '</span>'); } catch (e) { fwSetMsg('<span style="color:var(--danger)">Could not open the folder.</span>'); } };
  if (btn && pick) { btn.onclick = () => pick.click(); pick.onchange = () => { fwBrowse(pick.files && pick.files[0]); pick.value = ''; }; }
};
