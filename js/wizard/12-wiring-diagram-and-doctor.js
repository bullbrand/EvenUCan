// EvenUCan Enclosure Wizard - 12-wiring-diagram-and-doctor.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- wiring diagram
// Works out what wire goes where for the parts in the Enclosure Wizard, from each part's pin roles, with
// safety rules for the controller (pins it must not use) and the power chain. Shows a diagram, a list
// to tick off while soldering, and matching ESPHome / Arduino pin settings.
const ROLES={gnd:'Ground (GND)','3v3':'3.3 V power in','5v':'5 V power',vin:'Power in (2.5–5.5 V)',vcc:'Power in (check its voltage)',
  'bat+':'Battery +','bat-':'Battery −','chg_b+':'Charger B+ (battery +)','chg_b-':'Charger B− (battery −)','chg_out+':'Charger OUT+ (load +)','chg_out-':'Charger OUT− (load −)',
  sw_com:'Switch middle (common)',sw_a:'Switch contact','spk+':'Speaker +','spk-':'Speaker −','amp_out+':'Amp output +','amp_out-':'Amp output −',
  mic_sck:'I2S mic clock (SCK)',mic_ws:'I2S mic word select (WS)',mic_sd:'I2S mic data out (SD)',mic_lr:'Mic channel select (L/R)',
  amp_bclk:'I2S amp bit clock (BCLK)',amp_lrc:'I2S amp word select (LRC)',amp_din:'I2S amp data in (DIN)',amp_gain:'Amp gain (leave open)',amp_sd:'Amp shutdown (leave open)',
  trig:'Trigger (to a GPIO)',echo:'Echo, 5 V output (to a GPIO via a divider)',sda:'I2C data (SDA)',scl:'I2C clock (SCL)',uart_tx:'Serial TX (its output)',uart_rx:'Serial RX (its input)',
  ao:'Analog out (to an ADC GPIO)',do:'Digital out (to a GPIO)',
  sig:'Signal (to any free GPIO)',gpio:'Controller GPIO',nc:'Not connected'};
// ESP32-S3: pins not to use (Espressif user guide; strapping pins from the ESP32-S3 datasheet)
const S3_AVOID={0:'BOOT strapping pin',3:'strapping pin',45:'strapping pin',46:'strapping pin',19:'USB D−',20:'USB D+',43:'USB-serial TX',44:'USB-serial RX',
  35:'used by the PSRAM on R8 modules',36:'used by the PSRAM on R8 modules',37:'used by the PSRAM on R8 modules',38:'RGB LED (board v1.1)',48:'RGB LED (board v1.0)',26:'flash',27:'flash',28:'flash',29:'flash',30:'flash',31:'flash',32:'flash'};
const S3_ORDER=[4,5,6,7,15,16,17,18,8,9,10,11,12,13,14,1,2,42,41,40,39,47,21];
// Classic ESP32 (WROOM-32) DevKit, safest pins first. NEVER planned: 6-11 (wired to the flash chip: the board would crash),
// 34-39 (input only: cannot drive anything), 0 and 12 (boot pins: a wrong level at power-up stops the board starting), 1 and 3 (USB-serial).
// 5, 15 and 2 are boot-sensitive too, so they come last.
const ESP32_ORDER=[4,16,17,18,19,21,22,23,25,26,27,32,33,13,14,5,15,2];
// ESP32-C3 Super Mini. NEVER planned: 2, 8 and 9 (boot-strapping pins; 8 is also the LED and 9 the BOOT button) and 20/21 (the serial
// pins used for programming). 5 is on ADC2, which stops working when Wi-Fi is on, so analog sensors use 4, 3, 1 and 0.
const ESP32C3_ORDER=[10,5,6,7,4,3,1,0];
// Wemos D1 Mini (ESP8266). NEVER planned: 0, 2 and 15 (D3, D4, D8 decide how the board starts: a relay or sensor holding the wrong level
// at power-up stops it booting), 1 and 3 (serial/programming), 6-11 (flash, not on the pins). 16 (D0) has no PWM or I2C, so it is last.
// The only analog input is A0 (GPIO17).
const ESP8266_ORDER=[4,5,14,12,13,16];
const pinsOf=p=>(p&&p.pins&&p.pins.length?p.pins:(builtinById(p&&p.id)||{}).pins)||[];
const SIG_ROLES=['mic_sck','mic_ws','mic_sd','amp_bclk','amp_lrc','amp_din','trig','echo','uart_tx','uart_rx','ao','do','sig'];
const SIG_NAMES={mic_sck:'MIC_SCK',mic_ws:'MIC_WS',mic_sd:'MIC_SD',amp_bclk:'AMP_BCLK',amp_lrc:'AMP_LRC',amp_din:'AMP_DIN',trig:'TRIG',echo:'ECHO',uart_tx:'RX_FROM',uart_rx:'TX_TO',ao:'AO',do:'DO',sig:'PIN'};

// ==================== YAML DOCTOR & WIRING DOCTOR EXTENSIONS ====================
// Pure client-side electrical engineering audits, YAML diagnosis & auto-repairs,
// and step-by-step multimeter build guides derived from the YAML-Doctor engine.

const evenucanWiringDoctor=function evenucanWiringDoctor(P) {
  if (!P || P.error) return [];
  const findings = [];
  const add = (severity, id, title, why, fix) => findings.push({ severity, id, title, why, fix });
  const insts = P.insts || [];

  // 1. Inductive Flyback / Snubber Diodes (Pumps, Solenoids, Motors, Coils)
  const inductiveWords = /pump|valve|solenoid|motor|coil/i;
  const inductiveInsts = insts.filter(i => inductiveWords.test(i.part.name || '') || inductiveWords.test(i.part.category || ''));
  const hasDiode = insts.some(i => /diode|1n4007|snubber/i.test(i.part.name || '') || /diode|1n4007/i.test(i.part.id || ''));

  for (const ind of inductiveInsts) {
    if (!hasDiode) {
      add('warning', 'flyback_' + ind.key,
        `Flyback protection diode (1N4007) missing on ${ind.label}`,
        `Inductive loads produce high-voltage reverse-EMF spikes when switched off that can destroy switching transistors, relay contacts, or crash the microcontroller.`,
        `Connect a 1N4007 diode directly across ${ind.label}'s power terminals, with the silver cathode stripe pointing toward the positive (+) voltage supply.`
      );
    }
  }

  // 2. Logic Level Translation (5V to 3.3V GPIO Protection)
  const isEsp = P.ctrl && /esp32|esp8266/i.test(P.ctrl.part.name || '');
  if (isEsp) {
    const ultrasonic = insts.find(i => /hc-?sr04|ultrasonic/i.test(i.part.name || ''));
    const hasResistors = insts.some(i => /resistor|divider/i.test(i.part.name || '') || /1k|2k|resistor/i.test(i.part.id || ''));
    if (ultrasonic && !hasResistors) {
      add('warning', 'level_shifter_echo',
        `3.3V logic level divider needed for ${ultrasonic.label} ECHO pin`,
        `The HC-SR04 ultrasonic module runs on 5V and outputs 5V logic on its ECHO pin, but ESP32 GPIO inputs are strictly rated for 3.3V maximum. Direct 5V exposure will degrade or permanently damage the pin.`,
        `Insert a resistor divider: place a 1 kΩ resistor in series from the ECHO pin to the ESP32 GPIO, and a 2 kΩ resistor from the GPIO to GND.`
      );
    }
  }

  // 3. Current Budget & Ampacity
  let estimatedPeakMa = 250; // ESP32 baseline with Wi-Fi active
  for (const i of insts) {
    const nm = (i.part.name || '').toLowerCase();
    if (/pump|motor/.test(nm)) estimatedPeakMa += 1200;
    else if (/solenoid|valve/.test(nm)) estimatedPeakMa += 450;
    else if (/relay/.test(nm)) estimatedPeakMa += 80;
    else if (/led|ws2812|neopixel/.test(nm)) estimatedPeakMa += 350;
    else estimatedPeakMa += 30;
  }
  if (estimatedPeakMa > 1500) {
    add('info', 'ampacity_check',
      `High current design (~${Math.round(estimatedPeakMa)} mA peak) – use adequate wire gauge`,
      `Thin DuPont ribbon wires (28 AWG) have high resistance and can suffer voltage drop or warm up under continuous pump or motor loads.`,
      `Use at least 0.5 mm² to 0.75 mm² (20–22 AWG) hookup wire for power and ground runs supplying the power supply, step-down module, and pumps.`
    );
  }

  // 4. Inline DC Fuse Recommendation
  const hasExtPower = (P.power && P.power !== 'usb') || insts.some(i => /12v|24v|supply|psu|adapter/i.test(i.part.name || ''));
  const hasFuse = insts.some(i => /fuse/i.test(i.part.name || '') || /fuse/i.test(i.part.id || ''));
  if (hasExtPower && !hasFuse) {
    add('info', 'inline_fuse',
      'Inline fuse recommended on main DC power feed',
      'If a pump stalls or a short circuit happens inside the enclosure, an unfused power supply can overheat wiring or damage the step-down converter.',
      'Fit a 2A or 3A fast-blow inline fuse on the positive (+) DC supply wire right where it enters the box from the power brick.'
    );
  }

  // 5. Common Ground Bus
  const gndNet = (P.nets || []).find(n => n.kind === 'gnd' || /ground/i.test(n.name));
  if (!gndNet || (gndNet.pins && gndNet.pins.length < 2 && insts.length > 1)) {
    add('error', 'common_ground',
      'Common ground rail required',
      'All components (controller, power supply, relays, and sensors) must share a common 0V ground reference, or signals will float and act erratically.',
      'Connect all GND terminals together into a single common ground bus or star point.'
    );
  }

  return findings;
};

const generateBuildGuideHtml=function generateBuildGuideHtml(P, deviceName) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const insts = (P && P.insts) || [];
  const ctrl = P && P.ctrl;
  const nets = (P && P.nets) || [];
  const findings = (P && P.doctorFindings) || [];
  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Step-by-Step Build Guide – ${esc(deviceName)}</title>
<style>
:root { --bg: #f8fafc; --panel: #ffffff; --text: #0f172a; --muted: #64748b; --line: #e2e8f0; --accent: #2563eb; --accent-hover: #1d4ed8; --success: #16a34a; --warning: #d97706; --danger: #dc2626; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #0b0f17; --panel: #131b26; --text: #e2e8f0; --muted: #8b9bb4; --line: #222f3e; --accent: #3b82f6; --accent-hover: #60a5fa; --success: #22c55e; --warning: #f59e0b; --danger: #ef4444; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, Segoe UI, sans-serif; font-size: 15px; line-height: 1.5; padding: 24px 16px 80px; }
.container { max-width: 860px; margin: 0 auto; }
header { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
h1 { margin: 0 0 6px; font-size: 26px; }
.meta { color: var(--muted); font-size: 14px; margin-bottom: 16px; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
button { font: inherit; font-size: 14px; font-weight: 600; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel); color: var(--text); cursor: pointer; transition: all 0.15s; }
button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
button.primary:hover { background: var(--accent-hover); }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
h2 { margin: 0 0 14px; font-size: 20px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
.bom-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); }
.bom-item:last-child { border-bottom: none; }
input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent); }
.meter-card { background: color-mix(in srgb, var(--accent) 8%, var(--panel)); border: 1px solid var(--accent); border-radius: 8px; padding: 14px; margin: 12px 0; }
.meter-card b { color: var(--accent); display: block; margin-bottom: 4px; }
.if-not { color: var(--danger); font-size: 13px; margin-top: 6px; padding-left: 10px; border-left: 3px solid var(--danger); }
.wire-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-family: ui-monospace, Consolas, monospace; font-size: 14px; }
@media print {
  body { background: #fff !important; color: #000 !important; padding: 0 !important; }
  .card, header { box-shadow: none !important; border: 1px solid #ccc !important; break-inside: avoid; }
  .actions { display: none !important; }
}
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>📋 Step-by-Step Build Guide: ${esc(deviceName)}</h1>
    <div class="meta">Generated by EvenUCan • Controller: <b>${esc(ctrl ? ctrl.label : 'ESP32')}</b> • ${esc(dateStr)}</div>
    <div class="actions">
      <button class="primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
      <button onclick="saveChecklistState()">💾 Save Checklist</button>
      <button onclick="clearChecklistState()">↺ Reset Checkboxes</button>
    </div>
  </header>

  <div class="card">
    <h2>📦 1. Shopping List & Bill of Materials</h2>
    <p style="color:var(--muted);font-size:14px;margin-top:0">Confirm each part is present and matches physical dimensions before building.</p>
    ${insts.map((i, idx) => `
      <div class="bom-item">
        <input type="checkbox" id="bom_${idx}" data-k="bom_${idx}">
        <label for="bom_${idx}" style="cursor:pointer;flex:1"><b>${esc(i.label)}</b> ${i.part.w > 0 ? `(${i.part.w} × ${i.part.d} mm)` : ''}</label>
      </div>
    `).join('')}
  </div>

  <div class="card">
    <h2>⚡ 2. Milestone 1: Power & Buck Converter Calibration</h2>
    <p>Always calibrate your power supply <b>before</b> connecting sensitive microcontrollers or sensors.</p>
    <div class="meter-card">
      <b>🔬 Multimeter Checkpoint #1 (Power Supply & 5V Output)</b>
      <div>Connect your power supply to the step-down buck module. Set your multimeter to <b>DC Voltage (20V range)</b>. Place the black probe on GND and the red probe on the 5V output terminal.</div>
      <div style="font-weight:600;margin-top:6px;color:var(--success)">Target reading: 5.0 V (4.95 V – 5.10 V)</div>
      <div class="if-not"><b>If not:</b> Do NOT plug in your ESP32! If it reads higher (e.g. 12V), turn the brass potentiometer screw counter-clockwise until the meter reads exactly 5.0V.</div>
    </div>
  </div>

  <div class="card">
    <h2>💻 3. Milestone 2: Microcontroller Firmware Flash</h2>
    <p>Flash your ESPHome firmware over USB before soldering or mounting into the printed case.</p>
    <div class="bom-item">
      <input type="checkbox" id="chk_flash" data-k="chk_flash">
      <label for="chk_flash" style="cursor:pointer;flex:1"><b>Flash ESPHome Firmware:</b> Open your generated YAML in ESPHome and flash the device over USB.</label>
    </div>
    <div class="meter-card">
      <b>🔬 Checkpoint #2 (Wi-Fi & Status Ping)</b>
      <div>Disconnect USB. Power the ESP32 from your calibrated 5V rail (VIN and GND). Watch for the onboard status LED and confirm the device connects to your local Wi-Fi.</div>
      <div style="font-weight:600;margin-top:6px;color:var(--success)">Target: Device connects to Wi-Fi and responds on http://${esc(deviceName.toLowerCase().replace(/[^a-z0-9_-]/g,'-'))}.local</div>
      <div class="if-not"><b>If not:</b> Check Wi-Fi credentials in your secrets.yaml and verify 5V and GND polarity.</div>
    </div>
  </div>

  <div class="card">
    <h2>🔌 4. Milestone 3: Wiring Assembly</h2>
    <p>Complete each wire connection in sequence. Tick each item off as you complete the joint or screw terminal.</p>
    ${nets.map((n, k) => `
      <div style="margin-bottom:14px">
        <b style="font-size:15px;display:block;margin-bottom:4px;color:var(--accent)">Connection: ${esc(n.name)}</b>
        ${(n.links || []).map(([ia, ib], j) => {
          const a = n.pins && n.pins[ia], b = n.pins && n.pins[ib];
          const aLabel = (a && a.inst && a.inst.label) || 'Part';
          const aPin = (a && a.pin && a.pin.n) || 'Pin';
          const bLabel = (b && b.inst && b.inst.label) || 'Part';
          const bPin = (b && b.pin && b.pin.n) || 'Pin';
          const id = 'link_' + k + '_' + j;
          return `
            <div class="wire-row">
              <input type="checkbox" id="${id}" data-k="${id}">
              <label for="${id}" style="cursor:pointer;flex:1">
                ${esc(aLabel)} [<b>${esc(aPin)}</b>] → ${esc(bLabel)} [<b>${esc(bPin)}</b>]
              </label>
            </div>
          `;
        }).join('')}
      </div>
    `).join('')}
  </div>

  ${findings.length ? `
  <div class="card">
    <h2>🩺 5. Electrician Safety Advice</h2>
    ${findings.map(f => `
      <div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--line)">
        <b style="color:${f.severity==='error'?'var(--danger)':(f.severity==='warning'?'var(--warning)':'var(--accent)')}">[${f.severity.toUpperCase()}] ${esc(f.title)}</b>
        <div style="margin:4px 0">${esc(f.why)}</div>
        <div style="color:var(--success);font-weight:600">Action: ${esc(f.fix)}</div>
      </div>
    `).join('')}
  </div>` : ''}

</div>

<script>
const STORAGE_KEY = 'evenucan_guide_' + ${JSON.stringify(deviceName)};
function loadChecklistState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      const k = cb.dataset.k;
      if (k && state[k] !== undefined) cb.checked = state[k];
    });
  } catch(e){}
}
function saveChecklistState() {
  const state = {};
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    if (cb.dataset.k) state[cb.dataset.k] = cb.checked;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function clearChecklistState() {
  if (confirm('Reset all checkboxes on this guide?')) {
    localStorage.removeItem(STORAGE_KEY);
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  }
}
document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
  cb.addEventListener('change', saveChecklistState);
});
window.addEventListener('DOMContentLoaded', loadChecklistState);
loadChecklistState();
<\/script>
</body>
</html>`;
};

const openBuildGuide=function openBuildGuide() {
  if (!wr || !wr.plan || wr.plan.error) {
    WF.flash('Add parts and complete your wiring first to generate a build guide.');
    return;
  }
  const f = esphForm();
  const name = (f && f.name) || 'My Device';
  const html = generateBuildGuideHtml(wr.plan, name);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    // If pop-up blocked, fall back to direct download
    WF.downloadBlob('Build-Guide-' + esphSlug(name) + '.html', blob);
    WF.flash('Build guide downloaded (pop-up was blocked).');
  }
};

const runYamlDoctorUi=function runYamlDoctorUi() {
  const ta = $('wrEsp');
  const out = $('wrYamlDoctorOut');
  if (!ta) return;
  const rawYaml = ta.value || '';
  if (!rawYaml.trim()) {
    if (out) out.innerHTML = '<div class="warn">No YAML code to analyze.</div>';
    return;
  }
  if (typeof window === 'undefined' || !window.YamlDoctor || typeof window.YamlDoctor.diagnose !== 'function') {
    if (out) out.innerHTML = '<div class="warn">YAML Doctor engine is loading or not available.</div>';
    return;
  }

  const res = window.YamlDoctor.diagnose(rawYaml);
  if (res.fixedText && res.changed) {
    ta.value = res.fixedText;
    if (wr && wr.ai) wr.ai.yaml = res.fixedText;
    WF.flash('YAML Doctor applied ' + res.counts.fixed + ' safe auto-repairs to your code.', 4000);
  }

  if (!out) return;
  const { counts } = res;
  let bannerClass = 'ok', bannerTitle = 'All Checks Passed';
  if (res.syntaxFailed) { bannerClass = 'bad'; bannerTitle = 'Syntax Error in YAML'; }
  else if (counts.errors > 0) { bannerClass = 'bad'; bannerTitle = counts.errors + ' Problem' + (counts.errors > 1 ? 's' : '') + ' Found'; }
  else if (counts.warnings > 0) { bannerClass = 'warn'; bannerTitle = counts.warnings + ' Warning' + (counts.warnings > 1 ? 's' : '') + ' Worth Checking'; }
  else if (counts.fixed > 0) { bannerClass = 'ok'; bannerTitle = counts.fixed + ' Issue' + (counts.fixed > 1 ? 's' : '') + ' Repaired Safely'; }

  let h = `<div class="${bannerClass}" style="margin:8px 0;padding:10px 12px;border-radius:6px;font-size:13px;line-height:1.5">
    <b>🩺 YAML Doctor: ${bannerTitle}</b>
    <div style="font-size:12px;margin-top:2px">Repairs applied: <b>${counts.fixed}</b> • Errors: <b>${counts.errors}</b> • Warnings: <b>${counts.warnings}</b></div>
  </div>`;

  if (res.fixes && res.fixes.length > 0) {
    h += `<div style="margin:6px 0;font-size:12px;color:var(--text)"><b>Applied Auto-Repairs:</b>
      <ul style="margin:4px 0;padding-left:18px;color:#2e7d32">
        ${res.fixes.map(f => `<li>${esc(f.title)}</li>`).join('')}
      </ul></div>`;
  }

  if (res.flags && res.flags.length > 0) {
    h += `<div style="margin:6px 0;font-size:12px;color:var(--text)"><b>Detailed Findings:</b>
      ${res.flags.map(f => `
        <div style="margin:4px 0;padding:4px 6px;border-left:3px solid ${f.severity==='error'?'#d32f2f':(f.severity==='warning'?'#f57c00':'#1976d2')};background:rgba(0,0,0,0.03)">
          <b style="color:${f.severity==='error'?'#d32f2f':(f.severity==='warning'?'#e65100':'#1565c0')}">[${f.severity.toUpperCase()}] ${esc(f.title)}${f.line ? ' (Line ' + f.line + ')' : ''}</b>
          <div style="margin:2px 0">${esc(f.why)}</div>
          ${f.fix ? `<div style="color:#2e7d32;font-weight:600">Fix: ${esc(f.fix)}</div>` : ''}
        </div>
      `).join('')}
    </div>`;
  }

  out.innerHTML = h;
};

const planWiring=function planWiring(){
  const insts=instances().map((i,k)=>({key:'w'+k,part:i.part,pins:pinsOf(i.part)}));
  const same=i=>insts.filter(j=>j.part.id===i.part.id);
  for(const i of insts)i.label=i.part.name+(same(i).length>1?' #'+(same(i).indexOf(i)+1):'');
  const warn=[],info=[],noPinParts=[];
  if(!insts.length)return {error:'Add parts in the Enclosure Wizard first: the wiring is worked out for the parts in your box.'};
  const mcuOf=p=>p.mcu||(builtinById(p.id)||{}).mcu;// (an edited copy of a built-in board keeps its type)
  const ctrl=insts.find(i=>mcuOf(i.part))||insts.find(i=>i.pins.filter(p=>p.r==='gpio').length>=8);
  if(!ctrl)return {error:'There is no controller board (such as the ESP32-S3) with pin data among your parts, so there is nothing to wire the others to.'};
  const P=(inst,role)=>inst.pins.filter(p=>p.r===role).map(pin=>({inst,pin}));
  const first=(inst,role)=>P(inst,role)[0];
  const nets=[],net=(name,kind)=>{const n={name,kind,pins:[]};nets.push(n);return n;};
  const add=(n,...ps)=>{for(const p of ps)if(p)n.pins.push(p);};
  const s3=mcuOf(ctrl.part)==='esp32s3',classic=mcuOf(ctrl.part)==='esp32',c3=mcuOf(ctrl.part)==='esp32c3',e8266=mcuOf(ctrl.part)==='esp8266';
  // free controller pins, safest first
  const gp=ctrl.pins.filter(p=>p.r==='gpio');
  const pool=s3?S3_ORDER.map(g=>gp.find(p=>p.g===g)).filter(Boolean):classic?ESP32_ORDER.map(g=>gp.find(p=>p.g===g)).filter(Boolean):c3?ESP32C3_ORDER.map(g=>gp.find(p=>p.g===g)).filter(Boolean):e8266?ESP8266_ORDER.map(g=>gp.find(p=>p.g===g)).filter(Boolean):gp.filter(p=>!/^(TX|RX|D0|D1)\b/i.test(p.n));
  if(e8266)info.push('For safety EvenUCan never uses D3, D4 and D8 (they decide how the board starts up) or TX and RX (used for programming). That leaves D0, D1, D2, D5, D6 and D7 for your parts; analog sensors use A0, the only analog input.');
  if(c3)info.push('For safety EvenUCan never uses pins 2, 8 and 9 (boot pins; 8 is the LED, 9 the BOOT button) or 20 and 21 (serial/programming), so the board always starts and uploads normally.');
  if(classic)info.push('For safety EvenUCan never uses pins 6–11 (wired to the flash memory), 34–39 (input only), or 0, 1, 3 and 12 (boot and USB pins), so the board always starts and uploads normally.');
  const used=new Set(),take=pref=>{
    let p=pref!==undefined?pool.find(q=>q.g===pref&&!used.has(q)):null;
    if(!p)p=pool.find(q=>!used.has(q));
    if(p)used.add(p);return p;
  };
  const GND=net('GND','gnd'),V3=net('3.3 V','3v3'),V5=net('5 V','5v');
  add(GND,first(ctrl,'gnd'));add(V3,first(ctrl,'3v3'));
  // ---- power: USB only, or battery (+ charger, + switch)
  const bat=insts.find(i=>P(i,'bat+').length),chg=insts.find(i=>P(i,'chg_out+').length),sw=insts.find(i=>P(i,'sw_com').length);
  let rail5=V5;
  if(bat){
    const VB=net('Battery power (after the switch)','vbat');
    let src=first(bat,'bat+');
    if(chg){
      add(net('Battery +','vbat'),first(bat,'bat+'),first(chg,'chg_b+'));
      add(net('Battery −','gnd'),first(bat,'bat-'),first(chg,'chg_b-'));
      src=first(chg,'chg_out+');
      GND.pins.unshift(first(chg,'chg_out-'));
      info.push('Charge the battery through the charger\'s USB-C socket. The load ground goes to OUT−, never to B−, so the battery protection keeps working.');
    }else{
      add(GND,first(bat,'bat-'));
      warn.push('There is no charger module, so the battery has to be charged outside the box.');
    }
    if(sw){add(net((chg?'Charger OUT+':'Battery +')+' to switch','vbat'),src,first(sw,'sw_com'));add(VB,first(sw,'sw_a'));info.push('The on/off switch sits in the battery + line, between the '+(chg?'charger\'s OUT+':'battery')+' and everything else.');}
    else add(VB,src);
    const c5=first(ctrl,'5v');
    if(c5){add(VB,c5);warn.push(ctrl.label+' is fed from the battery (3.0–4.2 V) through its 5V pin. Its regulator needs about 3.6 V or more, so it may reset as the battery runs down: for reliable running put a small 5 V boost module between the switch and the 5V pin.');
      warn.push('Switch the battery off before plugging a USB cable into '+ctrl.label+' itself, so the two supplies don\'t fight.');}
    rail5=VB;
  }else add(V5,first(ctrl,'5v'));
  // (wizard-r2) say plainly how it is powered, first in the notes, so the wiring always matches the power choice
  const power=bat?'battery':wiz.power==='mains'?'mains':'usb';
  info.unshift(power==='battery'?'Powered by: the battery inside the box'+(chg?', charged through the charger\'s USB-C socket':'')+(sw?', with the on/off switch':'')+'.':
    power==='mains'?'Powered by: a mains adapter - a plug-in 5 V USB charger (1 A or more) - with its cable into '+ctrl.label+'\'s USB socket. No mains wiring goes inside the box: the plug does the conversion.':
    'Powered by: a USB cable into '+ctrl.label+'\'s USB socket, from a computer or any 5 V USB phone charger.');
  // ---- everything else
  const assigned=[];// {inst, role, ctrlPin}
  const i2c={};
  for(const i of insts){
    if(i===ctrl||i===bat||i===chg||i===sw)continue;
    if(!i.pins.length){warn.push(i.label+' has no pin data yet, so it isn\'t in the diagram. Add its pins in Parts (or use Import pins…).');noPinParts.push({label:i.label,id:i.part.id});continue;}
    const sonar=P(i,'trig').length&&P(i,'echo').length;
    for(const pin of i.pins){
      const pp={inst:i,pin};
      // an ultrasonic sensor's spare OUT / mode pin (e.g. the HY-SRF05) is left unconnected for normal trigger + echo use
      if(sonar&&pin.r==='sig'&&/^(out|mode)$/i.test(pin.n.trim())){info.push(i.label+': '+pin.n+' is a mode pin: leave it unconnected (trigger and echo are used instead).');continue;}
      switch(pin.r){
        case 'gnd':add(GND,pp);break;
        case '3v3':add(V3,pp);break;
        case 'vcc':add(V3,pp);warn.push(i.label+': pin '+pin.n+' is marked "check its voltage" and is wired to 3.3 V. If the module needs 5 V, change the pin to 5 V power in Parts.');break;
        case '5v':add(rail5,pp);if(bat)warn.push(i.label+' needs 5 V but only gets the battery\'s 3.0–4.2 V: add a 5 V boost module for it.');break;
        case 'vin':add(rail5,pp);break;
        case 'mic_lr':add(GND,pp);info.push(i.label+': L/R goes to GND, so it is the left channel.');break;
        case 'amp_out+':case 'amp_out-':{
          const spk=insts.find(s=>s!==i&&P(s,pin.r==='amp_out+'?'spk+':'spk-').length&&!s._amp);
          if(spk){add(net('Speaker '+(pin.r==='amp_out+'?'+':'−'),'spk'),pp,first(spk,pin.r==='amp_out+'?'spk+':'spk-'));if(pin.r==='amp_out-')spk._amp=i;}
          break;}
        case 'sda':case 'scl':{
          if(!i2c[pin.r]){const c=take((ctrl.part.i2c||(builtinById(ctrl.part.id)||{}).i2c||[8,9])[pin.r==='sda'?0:1]);// (r3) the board's own I2C pins (S3 8/9, Nano A4/A5, Pi GPIO2/3)
          if(!c){warn.push('No free controller pin left for I2C '+pin.r.toUpperCase()+'.');break;}i2c[pin.r]=net('I2C '+pin.r.toUpperCase()+' ('+c.n+')','sig');i2c[pin.r].ctrlPin=c;add(i2c[pin.r],{inst:ctrl,pin:c});assigned.push({inst:i,role:pin.r,c});}
          // (r2) every part on the bus is listed, not just the first, so the ESPHome file writes each I2C part
          else if(!assigned.some(a=>a.inst===i&&a.role===pin.r))assigned.push({inst:i,role:pin.r,c:i2c[pin.r].ctrlPin,shared:true});
          add(i2c[pin.r],pp);break;}
        default:
          if(!SIG_ROLES.includes(pin.r))break;
          {const adcPref=pin.r==='ao'&&(s3||classic||c3)?((s3?[1,2,4,5,6,7,8,9,10]:c3?[4,3,1,0]:[32,33]).find(g=>pool.some(q=>q.g===g&&!used.has(q)))):undefined;
           const c=(pin.r==='ao'&&e8266)?(()=>{const a0=ctrl.pins.find(q=>q.g===17&&!used.has(q));if(a0)used.add(a0);return a0;})():take(adcPref);if(!c){warn.push('No free controller pin left for '+i.label+' '+pin.n+'.');break;}
           add(net(i.label+' '+pin.n+' → '+c.n,'sig'),pp,{inst:ctrl,pin:c});assigned.push({inst:i,role:pin.r,c,pin});
           if(pin.r==='echo')warn.push(i.label+': ECHO is a 5 V signal but the '+ctrl.label+' pins take 3.3 V. Put a divider in that wire: 1 kΩ from ECHO to the GPIO, and 2 kΩ from the GPIO to GND.');
           if(pin.r==='ao')info.push(i.label+': AO is an analog output — wired to '+c.n+' (ADC).');}
      }
    }
    if(P(i,'amp_gain').length||P(i,'amp_sd').length)info.push(i.label+': GAIN and SD are left unconnected (9 dB gain, left and right mixed to mono).');
    if(P(i,'amp_out+').length)warn.push(i.label+': its speaker outputs are bridged. Never connect either speaker wire to GND.');
  }
  for(const s of insts)delete s._amp;
  // Connect companion loads/probes whose pins are 'nc' (pumps, valves, DC motors, load cells, rain plates) to their relay/driver/amplifier
  {
    const inNets=new Set(nets.flatMap(n=>n.pins.map(p=>p.inst.key)));
    const relays=insts.filter(r=>/relay|l298|uln2003|mosfet/i.test(r.part.name));
    const hx=insts.find(r=>/hx711/i.test(r.part.name));
    let relIdx=0;
    for(const i of insts){
      if(i===ctrl||i===bat||i===chg||i===sw||inNets.has(i.key)||!i.pins.length)continue;
      if(/load.?cell/i.test(i.part.name)&&hx){
        for(const p of i.pins){const m=hx.pins.find(hp=>p.n.startsWith(hp.n));if(m)add(net(i.label+' '+p.n+' → '+hx.label+' '+m.n,'sig'),{inst:i,pin:p},{inst:hx,pin:m});}
        continue;
      }
      const pPlus=i.pins[0],pMinus=i.pins[1];
      const rel=relays[0];
      if(rel&&pPlus){
        const noPins=rel.pins.filter(p=>/^no\d*$|^out\d*$/i.test(p.n));
        const rPin=noPins[relIdx%Math.max(1,noPins.length)]||rel.pins[0];
        relIdx++;
        add(net(rel.label+' '+(rPin?rPin.n:'NO')+' → '+i.label+' '+pPlus.n,'5v'),{inst:rel,pin:rPin},{inst:i,pin:pPlus});
        if(pMinus)add(GND,{inst:i,pin:pMinus});
        info.push(i.label+' is switched by '+rel.label+' ('+(rPin?rPin.n:'relay contact')+').');
      }else if(pPlus){
        add(rail5,{inst:i,pin:pPlus});
        if(pMinus)add(GND,{inst:i,pin:pMinus});
      }
    }
  }
  // battery level for the controller to read (ESPHome reports it): a pin that can measure voltage (ADC1)
  let batSense=null;
  if(bat&&s3){
    batSense=[1,2,4,5,6,7,8,9,10].map(g=>pool.find(q=>q.g===g&&!used.has(q))).find(Boolean)||null;
    if(batSense){used.add(batSense);info.push('Battery level: two 100 kΩ resistors in series from the battery + (after the switch) to GND, with the point between them to '+batSense.n+'. The controller reads half the battery voltage there.');}
  }
  if(s3)info.push('Pins kept free on the ESP32-S3: '+[0,3,45,46].map(g=>'GPIO'+g).join(', ')+' (start-up), 19/20 (USB), 43/44 (serial), 35–37 (PSRAM), 38/48 (RGB LED).');
  const live=nets.filter(n=>n.pins.length>=2);
    const doctorFindings = evenucanWiringDoctor({insts, ctrl, nets: live, s3, power, assigned});
  for (const f of doctorFindings) {
    if (f.severity === 'error') warn.push(`[Electrician Error] ${f.title}: ${f.fix}`);
    else if (f.severity === 'warning') warn.push(`[Electrician Warning] ${f.title}`);
    else info.push(`[Electrician Tip] ${f.title}`);
  }
  return {insts, ctrl, nets: live, warn, info, noPinParts, assigned, s3, bat: !!bat, batSense, power, doctorFindings, code: wiringCode(ctrl, assigned, s3)};
};
