// EvenUCan AI helpers and Surgery - 05-missing-parts-ai.js
// One of the files in js/ai/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- Missing parts: the user's AI is asked (with their permission) for a part's typical size and pins, from its own knowledge.
const LOOKUP_PROMPT=`You are an electronics parts expert. From your own knowledge (you cannot browse the internet here), give the typical physical data of the hobby electronics module named below, as usually sold on a small breakout board.
Measure in millimetres from the bottom-left corner of the board seen from above. width_mm is along x, height_mm along y, depth_mm is the height of the tallest thing on top of the board.
Pin roles: "power" (put 3.3V or 5V in "voltage"), "ground", "i2c_sda", "i2c_scl", "signal" (a pin the code must use), "unused" (pins a beginner leaves unconnected, e.g. an MPU-6050's XDA, XCL, AD0 and INT).
port_cutouts are sockets the box needs an opening for (USB, jacks): "edge" is left, right, top or bottom, offset_mm is the centre of the opening along that edge.
If you are not sure, give your best typical values with "approximate": true. Never invent a part: if you don't know it at all, return {"unknown": true, "notes": "<why>"}.
Return ONLY a JSON object, e.g.:
{"name":"MPU-6050 GY-521 accelerometer and gyroscope","category":"sensor","width_mm":21.2,"height_mm":16.4,"depth_mm":3.3,"pins":[{"name":"VCC","x_mm":2.5,"y_mm":1.3,"role":"power"},{"name":"GND","x_mm":5.0,"y_mm":1.3,"role":"ground"},{"name":"SCL","x_mm":7.6,"y_mm":1.3,"role":"i2c_scl"},{"name":"SDA","x_mm":10.1,"y_mm":1.3,"role":"i2c_sda"},{"name":"XDA","x_mm":12.7,"y_mm":1.3,"role":"unused"},{"name":"XCL","x_mm":15.2,"y_mm":1.3,"role":"unused"},{"name":"AD0","x_mm":17.8,"y_mm":1.3,"role":"unused"},{"name":"INT","x_mm":20.3,"y_mm":1.3,"role":"unused"}],"mounting_holes":[{"x_mm":2.5,"y_mm":13.9,"diameter_mm":3},{"x_mm":18.7,"y_mm":13.9,"diameter_mm":3}],"port_cutouts":[],"voltage":"3.3-5V","protocol":"I2C","i2c_address":"0x68","approximate":true,"source":"AI training knowledge","notes":"<anything a beginner should check>"}`;
const ROLE_TXT={gnd:'ground','3v3':'3.3 V power','5v':'5 V power',vcc:'power (check its voltage)',vin:'power in',sda:'I2C data',scl:'I2C clock',sig:'signal',trig:'trigger',echo:'echo',nc:'not connected'};
const lookupToPart=function lookupToPart(d,q){
  const s=(v,n)=>String(v==null?'':v).slice(0,n||200),f=(v,lo,hi,df)=>{v=parseFloat(v);return isFinite(v)?Math.min(hi,Math.max(lo,v)):df;};
  const w=f(d.width_mm,1,300,20),dd=f(d.height_mm,1,300,20),h=f(d.depth_mm,0,100,4),r2=v=>+v.toFixed(2);
  const role=(r,n)=>{r=s(r).toLowerCase();n=s(n).toLowerCase();
    if(/ground/.test(r)||/^gnd/.test(n))return 'gnd';if(/sda/.test(r))return 'sda';if(/scl/.test(r))return 'scl';
    if(/power|vcc|vin/.test(r)){const v=s(d.voltage).trim().toLowerCase();return /^vin/.test(n)?'vin':/\b5 ?v\b/.test(n)?'5v':/3\.?3|3v3/.test(n)?'3v3':/^3\.3 ?v?$/.test(v)?'3v3':/^5 ?v?$/.test(v)?'5v':'vcc';}
    if(/unused|^nc$|none|not ?conn/.test(r))return 'nc';
    if(/trig/.test(n))return 'trig';if(/echo/.test(n))return 'echo';
    return 'sig';};
  const pins=(Array.isArray(d.pins)?d.pins:[]).filter(p=>p&&typeof p==='object').slice(0,40).map(p=>({n:s(p.name||'?',16),r:role(p.role,p.name),x:r2(f(p.x_mm,0,w,0)),y:r2(f(p.y_mm,0,dd,0)),...(p.voltage?{voltage:s(p.voltage,20)}:{}),...(p.side?{side:s(p.side,10)}:{})}));
  const features=(Array.isArray(d.mounting_holes)?d.mounting_holes:[]).filter(o=>o&&typeof o==='object').slice(0,8).map(o=>({t:'hole',x:r2(f(o.x_mm,0,w,2)),y:r2(f(o.y_mm,0,dd,2)),dia:r2(f(o.diameter_mm,1,6,3))}));
  const SIDE={left:'xmin',right:'xmax',bottom:'ymin',top:'ymax'};
  for(const o of (Array.isArray(d.port_cutouts)?d.port_cutouts:[]).filter(o=>o&&typeof o==='object').slice(0,6)){
    const side=SIDE[s(o.edge).toLowerCase()]||'xmin',len=/^x/.test(side)?dd:w,ph=f(o.height_mm,1,30,4);
    features.push({t:'port',kind:s(o.name||'Port',30),side,u:r2(f(o.offset_mm,0,len,len/2)),zc:r2(ph/2),pw:r2(f(o.width_mm,1,80,10)),ph:r2(ph)});
  }
  const cat=s(d.category)+' '+s(d.name),type=/display|screen|oled|lcd/i.test(cat)?'display':/sensor/i.test(cat)?'sensor':/micro|controller|dev ?board/i.test(cat)?'board':/switch/i.test(cat)?'switch':'other';
  const info=[d.voltage&&'Voltage: '+s(d.voltage,40),d.protocol&&'Protocol: '+s(d.protocol,40),d.i2c_address&&'I2C address: '+s(d.i2c_address,20)].filter(Boolean).join('. ');
  return tidyPartAi({id:newPartIdAi(),name:s(d.name||q,80),type,shape:'rect',w,d:dd,pcb:1.6,h,below:2.5,mount:'floor',pins,features,
    approximate:true,source:'AI lookup',acc:'approx',voltage:s(d.voltage,40),protocol:s(d.protocol,40),i2c_address:s(d.i2c_address,20),
    notes:'Looked up by AI from its own knowledge ("'+s(q,60)+'"), not measured: sizes and pin positions are approximate, so measure yours before printing.'+(info?' '+info+'.':'')+(d.notes?' '+s(d.notes,400):'')});
};
// ════════════════════════════════════════════════════════════════════════════
// PARTS DATABASE  — persistent JSON file (parts-database.json alongside app)
// Every part AI looks up or user adds is stored here with pinout + dimensions.
// Parts with unverified dimensions block enclosure generation until confirmed.
// ════════════════════════════════════════════════════════════════════════════

let _partsDb = null;          // loaded object from parts-database.json
let _partsDbDirty = false;    // unsaved changes

// --- Load / Save ---------------------------------------------------------

let _partsDbHandle = null;

const loadPartsDb=async function loadPartsDb() {
  if (_partsDb) return _partsDb;
  try {
    const raw = WFAi.store.get('partsDb');
    if (raw) _partsDb = JSON.parse(raw);
  } catch(e) { /* store read error */ }
  if (!_partsDb) {
    try {
      const r = await fetch('parts-database.json');
      if (r.ok) _partsDb = await r.json();
    } catch(e) { /* file doesn't exist / CORS on file:// */ }
  }
  if (!_partsDb || typeof _partsDb.parts !== 'object') {
    _partsDb = { _schema:'EvenUCan Parts Database v1.0', version:'1.0',
      created: new Date().toISOString().slice(0,10),
      last_updated: new Date().toISOString().slice(0,10), parts:{} };
  }
  return _partsDb;
};

const savePartsDb=async function savePartsDb() {
  if (!_partsDb) return false;
  _partsDb.last_updated = new Date().toISOString().slice(0,10);
  const json = JSON.stringify(_partsDb, null, 2);
  try {
    WFAi.store.set('partsDb', json);
    if (window.showSaveFilePicker) {
      try {
        if (!_partsDbHandle) {
          _partsDbHandle = await window.showSaveFilePicker({
            suggestedName: 'parts-database.json',
            types: [{ description: 'JSON Database (*.json)', accept: { 'application/json': ['.json'] } }]
          });
        }
        const w = await _partsDbHandle.createWritable();
        await w.write(json);
        await w.close();
        _partsDbDirty = false;
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false;
        console.warn('showSaveFilePicker for partsDb failed:', e);
      }
    }
    const blob = new Blob([json], { type: 'application/json' });
    {const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='parts-database.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
    _partsDbDirty = false;
    return true;
  } catch(e) { console.warn('savePartsDb:', e); return false; }
};

// --- Lookup & Store ------------------------------------------------------

const getPartFromDb=async function getPartFromDb(name) {
  const db = await loadPartsDb();
  if (!name) return null;
  const key = name.toLowerCase().trim();
  // exact id match
  if (db.parts[key]) return db.parts[key];
  // alias / name match (case-insensitive)
  for (const p of Object.values(db.parts)) {
    if ((p.name||'').toLowerCase() === key) return p;
    if (Array.isArray(p.aliases) && p.aliases.some(a => a.toLowerCase() === key)) return p;
  }
  return null;
};

const storePartInDb=function storePartInDb(partObj) {
  if (!_partsDb) return;
  const id = (partObj.id || partObj.name || 'part_' + Date.now())
    .toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 60);
  _partsDb.parts[id] = { ...partObj, id,
    stored_date: new Date().toISOString().slice(0,10) };
  _partsDbDirty = true;
  savePartsDb();
};

// --- AI Verify Prompt ----------------------------------------------------
// Sent to the user's configured AI to research a part's pins AND physical size.
// The AI is asked to report confidence and flag anything it isn't sure about.

const PART_VERIFY_PROMPT = `You are an electronics engineer verifying a part for use in a 3D-printed enclosure design tool.

For the part named below, provide:
1. Exact pin labels as printed on the board/datasheet (not invented names)
2. Physical dimensions in mm (length × width × height above PCB)
3. Confidence level for the dimensions

Search your knowledge for datasheets, manufacturer specs, schematic drawings, and known pinout diagrams for this part.

DIMENSION STATUS must be one of:
  "datasheet"        — found in official datasheet or manufacturer spec sheet
  "manufacturer_web" — found on manufacturer or distributor website
  "community"        — found in a community resource (Fritzing, SparkFun, Adafruit, etc.)
  "estimated"        — estimated from similar parts; user should verify
  "unverified"       — could not find; user MUST measure the physical part

IMPORTANT RULES:
- Never invent pin names. Use only the labels that appear on the actual board silkscreen or in the datasheet.
- If you are not certain of a dimension, use "estimated" or "unverified" and say so in notes.
- If you do not recognise the part at all, return { "unknown": true, "notes": "reason" }
- Include every pin on the board, including power, ground, and 'do not connect' pins.
- mounting_holes: the x/y positions of any PCB mounting holes from bottom-left corner.
- port_cutouts: any connectors needing a hole in the enclosure wall (USB, audio jack, barrel jack etc).

Return ONLY a JSON object in this exact format:
{
  "name": "exact common name of the part",
  "aliases": ["other names this part is known by"],
  "category": "microcontroller|relay|sensor|led|resistor|capacitor|driver|display|power|connector|other",
  "description": "one sentence describing what this part does",
  "package": "physical form factor description",
  "electrical": {
    "voltage_supply": "e.g. 5V, 3.3V, 5V or 3.3V, 7-12V",
    "logic_voltage": 3.3,
    "current_max_ma": 500,
    "notes": "any electrical caveats a beginner must know"
  },
  "dimensions": {
    "length_mm": 51.0,
    "width_mm": 28.5,
    "height_mm": 11.5,
    "source": "datasheet|manufacturer_web|community|estimated|unverified",
    "notes": "e.g. height includes USB connector. If unverified: user must measure."
  },
  "pins": [
    { "label": "3V3", "type": "power", "voltage": 3.3, "x_mm": 0, "y_mm": 0, "notes": "3.3V output max 600mA" }
  ],
  "mounting_holes": [
    { "x_mm": 2.5, "y_mm": 2.5, "diameter_mm": 3 }
  ],
  "port_cutouts": [
    { "name": "Micro USB", "edge": "top", "offset_mm": 14.0, "width_mm": 10, "height_mm": 4 }
  ],
  "sources": ["URL or reference used"],
  "notes": "anything important a beginner must know about wiring or using this part",
  "approximate": false
}`;

// --- Verify a part via AI and store in DB --------------------------------

const verifyPartWithAI=async function verifyPartWithAI(partName) {
  if (!partName) return null;
  // Check DB cache first
  const cached = await getPartFromDb(partName);
  if (cached) return cached;
  if (!aiKeyAi()) { await askKeyAi(); if (!aiKeyAi()) return null; }
  WFAi.flash('Verifying "' + partName + '" with AI…', 10000);
  try {
    const { data: d } = await callAI(PART_VERIFY_PROMPT + '\n\nThe part to verify: "' + partName + '"');
    if (!d || typeof d !== 'object') throw new Error('no data returned');
    if (d.unknown) {
      WFAi.flash('AI doesn\'t recognise "' + partName + '" — add it manually in Parts Library.', 7000);
      return null;
    }
    // Build DB record
    const rec = {
      id: (d.name || partName).toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,60),
      name: d.name || partName,
      aliases: Array.isArray(d.aliases) ? d.aliases : [],
      category: d.category || 'other',
      description: d.description || '',
      package: d.package || '',
      electrical: d.electrical || {},
      dimensions: d.dimensions || { source: 'unverified', notes: 'Not found — user must measure.' },
      pins: Array.isArray(d.pins) ? d.pins : [],
      mounting_holes: Array.isArray(d.mounting_holes) ? d.mounting_holes : [],
      port_cutouts: Array.isArray(d.port_cutouts) ? d.port_cutouts : [],
      sources: Array.isArray(d.sources) ? d.sources : [],
      notes: d.notes || '',
      approximate: !!d.approximate,
      added_by: 'ai',
      verified: d.dimensions && d.dimensions.source !== 'unverified'
    };
    // Flag unverified dimensions clearly
    if (!rec.dimensions || rec.dimensions.source === 'unverified') {
      rec.dimension_status = 'UNVERIFIED';
      rec.dimension_warning = 'Dimensions could not be found. You MUST measure this part and enter its size in the Parts Library before the enclosure will be accurate.';
    } else if (rec.dimensions.source === 'estimated') {
      rec.dimension_status = 'ESTIMATED';
      rec.dimension_warning = 'Dimensions are estimated — measure your part and confirm in Parts Library for a perfect fit.';
    } else {
      rec.dimension_status = 'VERIFIED';
    }
    storePartInDb(rec);
    return rec;
  } catch(e) {
    WFAi.flash('Part verification failed: ' + (e.message || e), 6000);
    return null;
  }
};

// --- Dimension gate for enclosure generation ----------------------------
// Returns { ok:true } or { ok:false, unverified:['Part A','Part B'] }

const checkEnclosureDimensions=async function checkEnclosureDimensions(partNames) {
  const db = await loadPartsDb();
  const unverified = [], estimated = [];
  for (const name of (partNames || [])) {
    const p = await getPartFromDb(name);
    if (!p) { unverified.push(name + ' (not in database)'); continue; }
    if (p.dimension_status === 'UNVERIFIED') unverified.push(name);
    else if (p.dimension_status === 'ESTIMATED') estimated.push(name);
  }
  return { ok: unverified.length === 0, unverified, estimated };
};

// --- Parts Library Panel -----------------------------------------------
// Rendered as a side panel / modal; lets user browse, search, edit, add parts.

const renderPartsLibraryPanel=function renderPartsLibraryPanel() {
  const db = _partsDb;
  const parts = db ? Object.values(db.parts) : [];
  const cats = [...new Set(parts.map(p => p.category || 'other'))].sort();

  const statusBadge = s => {
    if (s === 'VERIFIED')   return '<span class="plBadgeOk">✓ Verified</span>';
    if (s === 'ESTIMATED')  return '<span class="plBadgeWarn">⚠ Estimated</span>';
    return '<span class="plBadgeFail">⚠ Unverified — measure!</span>';
  };

  const catOptions = cats.map(c => `<option value="${escAi(c)}">${escAi(c)}</option>`).join('');

  let rows = '';
  for (const p of parts.sort((a,b)=>(a.name||'').localeCompare(b.name||''))) {
    const dim = p.dimensions || {};
    const dimStr = dim.length_mm
      ? `${dim.length_mm}×${dim.width_mm}×${dim.height_mm} mm`
      : '—';
    rows += `<tr data-pid="${escAi(p.id)}" data-cat="${escAi(p.category||'')}" class="plRow">
      <td>${escAi(p.name||p.id)}</td>
      <td>${escAi(p.category||'')}</td>
      <td>${dimStr}</td>
      <td>${statusBadge(p.dimension_status)}</td>
      <td style="white-space:nowrap">
        <button class="sec plEdit" data-pid="${escAi(p.id)}">Edit</button>
        <button class="sec plDelete" data-pid="${escAi(p.id)}" title="Delete part" style="color:var(--danger,#c0392b);margin-left:4px">🗑</button>
      </td>
    </tr>`;
  }

  return `<div id="partsLibPanel" class="partsLibPanel">
    <div class="plHead">
      <b>Parts Library</b>
      <span class="ewNote">${parts.length} part${parts.length===1?'':'s'} stored</span>
      <button class="sec" id="plAddNew">+ Add part</button>
      <button class="ewClose" id="plClose">✕</button>
    </div>
    <div class="plSearch" style="display:flex;gap:6px;align-items:center">
      <input id="plSearchBox" type="search" placeholder="Search parts…" style="flex:1;padding:6px 8px">
      <select id="plCatFilter" style="padding:6px 8px">
        <option value="">All categories</option>
        ${catOptions}
      </select>
    </div>
    ${parts.length === 0
      ? '<div class="ewNote" style="padding:16px">No parts yet — search for parts in the design tool and they will appear here automatically.</div>'
      : `<div class="plTableWrap"><table class="plTable">
          <thead><tr><th>Name</th><th>Category</th><th>Dimensions</th><th>Status</th><th></th></tr></thead>
          <tbody id="plTableBody">${rows}</tbody>
        </table></div>`}
    <div id="plEditArea" style="display:none"></div>
  </div>`;
};

const renderPartEditForm=function renderPartEditForm(partId) {
  const p = _partsDb && _partsDb.parts[partId];
  if (!p) return '';
  const dim = p.dimensions || {};
  return `<div class="plEditForm">
    <b>Edit: ${escAi(p.name||partId)}</b>
    <div class="ewNote" style="margin:4px 0 10px">${p.dimension_status==='UNVERIFIED'
      ? '<span style="color:var(--warn)">⚠ Dimensions unverified — measure the physical part and enter below.</span>'
      : p.dimension_status==='ESTIMATED'
        ? '<span style="color:var(--warn)">⚠ Dimensions estimated — confirm with physical measurement.</span>'
        : '<span style="color:var(--ok)">✓ Dimensions verified.</span>'}</div>
    <label>Name <input id="plEName" value="${escAi(p.name||'')}"></label>
    <label>Category <input id="plECat" value="${escAi(p.category||'')}"></label>
    <div class="plDimRow">
      <label>Length (mm) <input id="plELen" type="number" step="0.1" value="${dim.length_mm||''}"></label>
      <label>Width (mm)  <input id="plEWid" type="number" step="0.1" value="${dim.width_mm||''}"></label>
      <label>Height (mm) <input id="plEHt"  type="number" step="0.1" value="${dim.height_mm||''}"></label>
    </div>
    <label>Notes <textarea id="plENotes" rows="2">${escAi(p.notes||p.dimension_warning||'')}</textarea></label>
    <div class="ewRow">
      <button class="primary" id="plESave" data-pid="${escAi(partId)}">Save & Confirm dimensions</button>
      <button class="sec" id="plECancel">Cancel</button>
    </div>
  </div>`;
};

const bindPartsLibrary=function bindPartsLibrary() {
  const panel = document.getElementById('partsLibPanel');
  if (!panel) return;

  panel.addEventListener('click', e => {
    const t = e.target;
    if (t.id === 'plClose') { panel.remove(); return; }
    if (t.id === 'plAddNew') { showAddPartForm(); return; }
    if (t.classList.contains('plEdit')) {
      const ea = document.getElementById('plEditArea');
      if (ea) { ea.style.display = 'block'; ea.innerHTML = renderPartEditForm(t.dataset.pid); bindPartEditForm(); }
      return;
    }
    if (t.classList.contains('plDelete')) {
      const pid = t.dataset.pid;
      const partName = (_partsDb && _partsDb.parts[pid]?.name) || pid;
      if (confirm(`Delete "${partName}" from the parts database? This cannot be undone.`)) {
        if (_partsDb && _partsDb.parts[pid]) {
          delete _partsDb.parts[pid];
          _partsDbDirty = true;
          savePartsDb();
          WFAi.flash(`"${partName}" deleted`, 3000);
          const wrap = panel.parentNode;
          if (wrap) {
            const fresh = document.createElement('div');
            fresh.innerHTML = renderPartsLibraryPanel();
            wrap.replaceChild(fresh.firstChild, panel);
            bindPartsLibrary();
          }
        }
      }
      return;
    }
    if (t.id === 'plESave') {
      const pid = t.dataset.pid;
      const p = _partsDb && _partsDb.parts[pid];
      if (p) {
        p.name     = document.getElementById('plEName').value.trim() || p.name;
        p.category = document.getElementById('plECat').value.trim() || p.category;
        const l = parseFloat(document.getElementById('plELen').value);
        const w = parseFloat(document.getElementById('plEWid').value);
        const h = parseFloat(document.getElementById('plEHt').value);
        if (l > 0 && w > 0 && h > 0) {
          p.dimensions = { length_mm: l, width_mm: w, height_mm: h,
            source: 'user_measured', notes: 'Measured by user.' };
          p.dimension_status = 'VERIFIED';
          delete p.dimension_warning;
        }
        p.notes = document.getElementById('plENotes').value.trim() || p.notes;
        p.added_by = p.added_by || 'user';
        _partsDbDirty = true;
        savePartsDb();
        WFAi.flash('Part saved ✓', 3000);
        // Re-render panel
        const wrap = panel.parentNode;
        if (wrap) {
          const fresh = document.createElement('div');
          fresh.innerHTML = renderPartsLibraryPanel();
          wrap.replaceChild(fresh.firstChild, panel);
          bindPartsLibrary();
        }
      }
      return;
    }
    if (t.id === 'plECancel') {
      const ea = document.getElementById('plEditArea');
      if (ea) { ea.style.display = 'none'; ea.innerHTML = ''; }
      return;
    }
  });

  const applyFilter = () => {
    const q = (document.getElementById('plSearchBox')?.value || '').toLowerCase();
    const cat = document.getElementById('plCatFilter')?.value || '';
    document.querySelectorAll('#plTableBody .plRow').forEach(row => {
      const textMatch = !q || row.textContent.toLowerCase().includes(q);
      const catMatch = !cat || (row.dataset.cat || '') === cat;
      row.style.display = textMatch && catMatch ? '' : 'none';
    });
  };
  const search = document.getElementById('plSearchBox');
  if (search) search.addEventListener('input', applyFilter);
  const catFilter = document.getElementById('plCatFilter');
  if (catFilter) catFilter.addEventListener('change', applyFilter);
};

const bindPartEditForm=function bindPartEditForm() { /* buttons bound via event delegation in bindPartsLibrary */ };

const showAddPartForm=function showAddPartForm() {
  WFAi.flash('Enter the part name in the search box above and use "AI Parts Search" to look it up — it will be stored automatically.', 7000);
};

const migrateCustomToDb=async function migrateCustomToDb() {
  if (!_partsDb) return;
  if (Object.keys(_partsDb.parts).length > 0) return; // Only migrate into an empty DB
  if (typeof customAi === 'undefined' || !Array.isArray(customAi) || customAi.length === 0) return;
  const accMap = { drawing: 'VERIFIED', measured: 'VERIFIED', approx: 'ESTIMATED' };
  let count = 0;
  for (const c of customAi) {
    const id = (c.id || c.name || 'part_' + Date.now())
      .toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 60);
    if (_partsDb.parts[id]) continue;
    _partsDb.parts[id] = {
      id,
      name: c.name || id,
      aliases: [],
      category: c.type || 'other',
      description: c.notes || '',
      dimensions: {
        length_mm: c.w || null,
        width_mm: c.d || null,
        height_mm: c.h || null,
        source: c.source ? 'user_library' : 'unknown'
      },
      dimension_status: accMap[c.acc] || 'UNVERIFIED',
      pins: (c.pins || []).map(p => ({ label: p.n || '', type: 'io', x_mm: p.x || 0, y_mm: p.y || 0 })),
      mounting_holes: [],
      port_cutouts: [],
      sources: c.source ? [c.source] : [],
      notes: c.notes || '',
      added_by: 'migration',
      stored_date: new Date().toISOString().slice(0, 10)
    };
    count++;
  }
  if (count === 0) return;
  _partsDbDirty = true;
  await savePartsDb();
  WFAi.flash(`✓ ${count} part${count === 1 ? '' : 's'} imported from your Parts Library into the database`, 6000);
};

const openPartsLibrary=async function openPartsLibrary() {
  await loadPartsDb();
  await migrateCustomToDb();
  const existing = document.getElementById('partsLibPanel');
  if (existing) { existing.remove(); return; }
  const wrap = document.createElement('div');
  wrap.innerHTML = renderPartsLibraryPanel();
  document.body.appendChild(wrap.firstChild);
  bindPartsLibrary();
};
