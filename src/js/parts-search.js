// ---- Part-database search helpers (Fritzing / Eagle / KiCad JSON files) ----
const _EW_DB={};
async function _loadDb(key,url){
  if(key in _EW_DB)return _EW_DB[key];
  try{const r=await fetch(url);if(!r.ok)throw 0;const j=await r.json();return(_EW_DB[key]=j.parts||[]);}
  catch(e){return(_EW_DB[key]=null);}
}
function _dbScore(entry,q){
  const words=q.toLowerCase().split(/\W+/).filter(w=>w.length>1);
  if(!words.length)return 0;
  const hay=[entry.title,(entry.info&&entry.info.title),(entry.info&&entry.info.description),(Array.isArray(entry.info&&entry.info.tags)?entry.info.tags.join(' '):''),(entry.info&&entry.info.family)].filter(Boolean).join(' ').toLowerCase();
  const full=words.join(' ');if(hay.includes(full))return 1000;
  return words.reduce((s,w)=>s+(hay.includes(w)?1:0),0);
}
function _dbClean(t){return String(t||'').replace(/_h\d_|__h\d_/g,'').trim();}
function _dbPinRole(n){
  const v=String(n||'').toLowerCase().trim();
  if(/^gnd$|^ground$|^vss$/.test(v))return 'ground';
  if(/^vcc$|^vdd$|^vin$|^v\+$|^5v$|^3\.?3v?$|^power$/.test(v))return 'power';
  if(/sda/.test(v))return 'i2c_sda';
  if(/scl/.test(v))return 'i2c_scl';
  if(/^nc$|^noc$|unused|not.?conn/.test(v))return 'unused';
  return 'signal';
}
function _dbToLookupData(entry,q){
  const g=entry.g||{},info=entry.info||{},conns=entry.conns||[];
  const cleanName=_dbClean(info.title||entry.title||q);
  const desc=String(info.description||'');
  const iface=String((info.props&&info.props.interface)||'').toLowerCase();
  const protocol=/i2c/.test(iface)?'I2C':/spi/.test(iface)?'SPI':/uart|serial/.test(iface)?'UART':/onewire|1-wire/.test(iface)?'1-Wire':'';
  const allText=(cleanName+' '+desc+(Array.isArray(info.tags)?info.tags.join(' '):'')).toLowerCase();
  const voltage=/\b3\.?3\s*v\b/.test(allText)?'3.3V':/\b5\s*v\b/.test(allText)?'5V':'';
  const pos=g.pos||{};
  const pins=conns.filter(c=>pos[c.svgId]).map(c=>({name:String(c.name||c.desc||'?').slice(0,16),x_mm:+(pos[c.svgId][0]).toFixed(2),y_mm:+(pos[c.svgId][1]).toFixed(2),role:_dbPinRole(c.name||'')}));
  const fld=String(entry.folder||'').toLowerCase();
  const src=fld.includes('eagle')?'Eagle library':fld.includes('kicad')?'KiCad library':'Fritzing parts library';
  return {name:cleanName,category:desc||cleanName,width_mm:g.w||20,height_mm:g.h||20,depth_mm:10,pins,mounting_holes:[],port_cutouts:[],protocol,voltage,approximate:false,source:src,notes:'Pin positions from '+src+(desc?'. '+desc.slice(0,200):'')};
}
async function lookupPart(i){
  const m=iw.matches&&iw.matches[i];if(!m||m.part||m.looking||m.ctrl)return;
  const q=m.spec.search;
  if(!aiKey()){await askKey();if(!aiKey())return WF.flash('Set up a key for your AI first.',5000);}
  const go=await askHtml(`<div class="kHead"><b>🔍 Look up "${esc(q)}"?</b></div><p style="margin:0 0 8px">EvenUCan will search your parts library first, then its built-in databases (Fritzing, Eagle and KiCad), then ask its AI if nothing is found.</p>`+
    `<p class="ewNote" style="margin:0">If the AI is asked, one request goes to ${esc(PROVIDERS[aiProv()].name)} with only the part's name and what it is for. No personal data is sent.</p>`,['Cancel','Search for it'],1);
  if(go!==1)return;
  m.looking=true;m.lookErr='';m.lookStage='Searching your parts…';renderIntent();
  let d=null,dbSrc='';
  // Stage 0: search the user's own custom parts library first
  {
    const qWords=q.toLowerCase().split(/\W+/).filter(w=>w.length>1);
    const minSc=Math.max(1,Math.ceil(qWords.length*0.6));
    let best=null,bestSc=0;
    for(const p of (custom||[])){
      const hay=[p.name,p.category,p.protocol,p.voltage,(p.pins||[]).map(x=>x.n).join(' ')].filter(Boolean).join(' ').toLowerCase();
      const full=qWords.join(' ');
      let sc=hay.includes(full)?1000:qWords.reduce((s,w)=>s+(hay.includes(w)?1:0),0);
      if(sc>bestSc){bestSc=sc;best=p;}
    }
    if(best&&bestSc>=minSc){
      m.looking=false;m.lookStage='';m.part=partById(best.id);m.from='your library';m.note='';
      WF.flash('"'+best.name+'" is already in your parts library.',4000);
      renderIntent();return;
    }
  }
  // Parts databases disconnected — AI search used directly.
  if(!d){
    m.lookStage='Asking your AI…';renderIntent();
    try{
      ({data:d}=await callAI(LOOKUP_PROMPT+'\n\nThe part: "'+q+'"\nWhat it does in the project: '+m.spec.function));
      if(!d||typeof d!=='object')throw new Error('garbled: no part data');
      if(d.unknown){m.looking=false;m.lookStage='';m.lookErr='Your AI doesn\'t know this part'+(d.notes?': '+String(d.notes).slice(0,200):'.')+' Add it yourself with Parts Library….';renderIntent();return;}
      if(!(parseFloat(d.width_mm)>0)||!(parseFloat(d.height_mm)>0))throw new Error('garbled: no sizes');
    }catch(e){console.error('EvenUCan: part lookup failed for "'+q+'"',e);m.looking=false;m.lookStage='';m.lookErr=/garbled/.test(e.message||'')?'Sorry, the AI\'s answer couldn\'t be read. Try again, or add the part yourself.':'The AI couldn\'t be reached: '+(e.message||e);renderIntent();return;}
  }
  m.looking=false;m.lookStage='';if(iw.step==='result')renderIntent();
  const part=lookupToPart(d,q);
  if(dbSrc){part.source=dbSrc;part.notes='Pin positions and board size from '+dbSrc+'. Component height is estimated at '+part.h+' mm — check yours.'+(d.notes?'\n'+d.notes.slice(0,300):'');}
  const pinTxt=part.pins.length?part.pins.map(p=>esc(p.n)+' <span class="ewNote">('+esc(ROLE_TXT[p.r]||p.r)+')</span>').join(', '):'<span class="warn">none given: add them in Parts before wiring</span>';
  const ok=await askHtml(`<div class="kHead"><b>🔍 ${esc(part.name)}</b></div>`+
    (dbSrc?`<div class="ewNote" style="margin-bottom:4px">Found in ${esc(dbSrc)}</div>`:'')+
    `<div><b>Size:</b> ${part.w} × ${part.d} mm${dbSrc?', component height estimated':`, ${part.h} mm tall`}</div><div><b>Pins (${part.pins.length}):</b> ${pinTxt}</div>`+
    (part.protocol||part.i2c_address?`<div><b>Protocol:</b> ${esc(part.protocol||'?')}${part.i2c_address?', I2C address '+esc(part.i2c_address):''}</div>`:'')+
    (part.voltage?`<div><b>Voltage:</b> ${esc(part.voltage)}</div>`:'')+`<div><b>Mounting holes:</b> ${part.features.filter(x=>x.t==='hole').length}, <b>openings for sockets:</b> ${part.features.filter(x=>x.t==='port').length}</div>`+
    (dbSrc?`<div class="ewNote" style="margin-top:8px">Board dimensions and pin positions are from the library. Component height is estimated — check yours before printing.</div>`:`<div class="warn" style="margin-top:8px">⚠️ Approximate: this comes from the AI's memory, not from a datasheet or a measurement. Check the size and the pin order against your own part before you print or wire.</div>`)+
    (d.notes?`<div class="ewNote" style="margin-top:6px">${esc(String(d.notes).slice(0,400))}</div>`:''),['Don\'t use this','Add to my library →'],1);
  if(ok!==1)return;
  custom.push(part);if(!saveLib()){custom.pop();m.lookErr='Couldn\'t save it to your parts library.';return renderIntent();}
  m.part=partById(part.id);m.from=dbSrc||'AI lookup';m.note='';
  (iw.missingAdded=iw.missingAdded||[]).push(clone(part));
  WF.flash('Added "'+part.name+'" to your parts'+(dbSrc?' (from '+dbSrc+')':' (marked ⚠️ Approximate)'),5000);
  renderIntent();
}
// Another platform: only the board, the Wi-Fi parts and the questions change (the AI isn't asked again).
function iwKeepVals(){iw.vals=iw.vals||{};for(const el of $('iwBody').querySelectorAll('[data-iw]'))iw.vals[el.dataset.iw]=el.value;}
function intentSetPf(pf){
  pf=pfOk(pf);if(!iw.analysis||pf===iw.pf)return;
  iw.pf=pf;iw.override=pf!==pfOk(iw.analysis.platform);iw.matches=pfMatches(iw.base,pf);renderIntent();
}
// Common modules beginners use, made into the user's own parts the first time they are picked (typical sizes:
// measure yours). Tried before the big parts library, whose pictures often bring many extra pins.
const cmPins=(names,y,x0)=>names.map(([n,r],i)=>({n,r,x:+(x0+i*2.54).toFixed(2),y}));
const CM_NOTE='A common module added by "What do I want to build?". Sizes are typical for this module: measure yours before printing.';
const COMMON_MODS=[
  {re:/ssd1306|sh1106|\boled\b|\b(small |tiny |mini )?(screen|display)\b/i,not:/tft|lcd|e-?paper|e-?ink|seg|matrix|colou?r/i,part:{id:'p-cm-ssd1306',name:'SSD1306 0.96" OLED display 128x64 (I2C)',type:'display',w:27.3,d:27.8,pcb:1.2,h:3.5,below:2.5,mount:'floor',
    pins:cmPins([['GND','gnd'],['VCC','3v3'],['SCL','scl'],['SDA','sda']],25.8,9.8),features:[{t:'window',x:13.65,y:12.9,fw:23,fd:13},{t:'hole',x:2,y:2,dia:2},{t:'hole',x:25.3,y:2,dia:2},{t:'hole',x:2,y:25.8,dia:2},{t:'hole',x:25.3,y:25.8,dia:2}]}},
  {re:/bme280|bmp280|temperature|humidity|pressure|weather sensor|climate/i,part:{id:'p-cm-bme280',name:'BME280 temperature, humidity and pressure sensor (I2C)',type:'sensor',w:11.5,d:15,pcb:1.6,h:2,below:2.5,mount:'floor',
    pins:cmPins([['VCC','3v3'],['GND','gnd'],['SCL','scl'],['SDA','sda']],13.6,1.9),features:[]}},
  {re:/\bpir\b|hc-?sr501|\bmotion\b|\bmovement\b/i,not:/water|leak|liquid|rain|flood/i,part:{id:'p-cm-pir',name:'HC-SR501 PIR motion sensor',type:'sensor',w:32.3,d:24.3,pcb:1.2,h:14,below:6,mount:'wall',
    pins:cmPins([['VCC','5v'],['OUT','sig'],['GND','gnd']],2,13.6),features:[{t:'opening',x:16.15,y:12.15,dia:23}]}},
  {re:/\bleds?\b|led with resistor|status light|indicator light|light up/i,not:/ws2812|neopixel|\brgb\b|addressable|colou?r|strip/i,part:{id:'p-cm-led5mm',name:'5 mm LED with resistor',type:'other',w:10,d:10,pcb:1.2,h:5,below:0,mount:'wall',
    pins:cmPins([['+','sig'],['-','gnd']],2,2.5),features:[{t:'opening',x:5,y:5,dia:5.5}]}},
  {re:/soil|plant.*moist|moist.*soil|capacitive.*moist|soil.*probe|moisture.*probe/i,not:/water leak|flood|rain|liquid level|\bleds?\b|indicator/i,part:{id:'p-cm-soilmoist',name:'Capacitive soil moisture sensor module',type:'sensor',w:22,d:35,pcb:1.6,h:3,below:3,mount:'outside',
    pins:cmPins([['VCC','3v3'],['GND','gnd'],['AOUT','sig']],1.5,2),features:[]}},
  {re:/water (leak|level)|leak sensor|liquid level|rain(drop)? sensor|flood sensor|moisture sensor module/i,part:{id:'p-cm-water',name:'Water leak / level sensor module',type:'sensor',w:40,d:16,pcb:1.2,h:1.2,below:2,mount:'floor',
    pins:cmPins([['S','sig'],['+','3v3'],['-','gnd']],2,3),features:[]}},
  {re:/bh1750|light sens|light level|\blux\b|brightness|ambient light|\bldr\b/i,part:{id:'p-cm-bh1750',name:'BH1750 light level sensor (I2C)',type:'sensor',w:18.5,d:13.9,pcb:1.6,h:2,below:2.5,mount:'floor',
    pins:cmPins([['VCC','3v3'],['GND','gnd'],['SCL','scl'],['SDA','sda'],['ADDR','nc']],1.5,4.2),features:[{t:'led',x:9.25,y:8,dia:3}]}},
  {re:/dht ?(11|22)|am2302/i,part:{id:'p-cm-dht22',name:'DHT22 temperature and humidity sensor module',type:'sensor',w:15.1,d:25,pcb:1.6,h:7.7,below:2.5,mount:'floor',
    pins:cmPins([['+','3v3'],['OUT','sig'],['-','gnd']],1.5,5),features:[]}},
  {re:/button|push|tactile|press/i,part:{id:'p-cm-button',name:'Push button 12 mm (tactile)',type:'other',w:12,d:12,pcb:0,h:7.3,below:0,mount:'floor',
    pins:[{n:'SIG',r:'sig',x:1,y:6},{n:'GND',r:'gnd',x:11,y:6}],features:[{t:'button',x:6,y:6}]}},
  {re:/ws2812|neopixel|\brgb\b|addressable|led strip|colou?r light/i,part:{id:'p-cm-ws2812',name:'WS2812 RGB LED module (NeoPixel)',type:'other',w:10,d:10,pcb:1.6,h:3,below:0,mount:'floor',
    pins:cmPins([['5V','5v'],['GND','gnd'],['DIN','sig']],1.5,2.5),features:[{t:'led',x:5,y:5,dia:5}]}},
  {re:/buzzer|beep|piezo|alarm sound/i,part:{id:'p-cm-buzzer',name:'Active buzzer module',type:'other',w:18.5,d:15,pcb:1.6,h:12,below:2.5,mount:'floor',
    pins:cmPins([['VCC','3v3'],['I/O','sig'],['GND','gnd']],1.5,6.7),features:[{t:'led',x:9.25,y:8.5,dia:4}]}},
  {re:/mpu-?6050|gy-?521|accelerometer|gyro|\btilt\b|\blevel (sensor|checker)\b/i,part:{id:'p-cm-mpu6050',name:'MPU6050 tilt and motion sensor (GY-521, I2C)',type:'sensor',w:21.2,d:16.4,pcb:1.6,h:3,below:2.5,mount:'floor',
    pins:cmPins([['VCC','3v3'],['GND','gnd'],['SCL','scl'],['SDA','sda'],['XDA','nc'],['XCL','nc'],['AD0','nc'],['INT','nc']],1.5,1.71),features:[{t:'hole',x:3,y:13.6,dia:3},{t:'hole',x:18.2,y:13.6,dia:3}]}},
  {re:/8.?channel.?relay|8.?relay.?module|relay.*\b8\b.*channel|\b8\b.*relay/i,part:{id:'p-cm-relay8',name:'8-channel 5 V relay module',type:'other',w:139,d:53,pcb:1.6,h:19,below:2.5,mount:'floor',
    pins:cmPins([['VCC','5v'],['GND','gnd'],['IN1','sig'],['IN2','sig'],['IN3','sig'],['IN4','sig'],['IN5','sig'],['IN6','sig'],['IN7','sig'],['IN8','sig']],13,2),features:[{t:'wire',side:'xmax',u:13,dia:6},{t:'hole',x:3,y:3,dia:3},{t:'hole',x:136,y:3,dia:3},{t:'hole',x:3,y:50,dia:3},{t:'hole',x:136,y:50,dia:3}]}},
  {re:/4.?channel.?relay|4.?relay.?module|relay.*\b4\b.*channel|\b4\b.*relay/i,part:{id:'p-cm-relay4',name:'4-channel 5 V relay module',type:'other',w:72,d:53,pcb:1.6,h:19,below:2.5,mount:'floor',
    pins:cmPins([['VCC','5v'],['GND','gnd'],['IN1','sig'],['IN2','sig'],['IN3','sig'],['IN4','sig']],13,2),features:[{t:'wire',side:'xmax',u:13,dia:6},{t:'hole',x:3,y:3,dia:3},{t:'hole',x:69,y:3,dia:3},{t:'hole',x:3,y:50,dia:3},{t:'hole',x:69,y:50,dia:3}]}},
  {re:/2.?channel.?relay|2.?relay.?module|relay.*\b2\b.*channel|\b2\b.*relay/i,part:{id:'p-cm-relay2',name:'2-channel 5 V relay module',type:'other',w:50,d:38,pcb:1.6,h:19,below:2.5,mount:'floor',
    pins:cmPins([['VCC','5v'],['GND','gnd'],['IN1','sig'],['IN2','sig']],13,2),features:[{t:'wire',side:'xmax',u:13,dia:6},{t:'hole',x:3,y:3,dia:3},{t:'hole',x:47,y:3,dia:3},{t:'hole',x:3,y:35,dia:3},{t:'hole',x:47,y:35,dia:3}]}},
  {re:/relay/i,part:{id:'p-cm-relay',name:'1-channel 5 V relay module',type:'other',w:50,d:26,pcb:1.6,h:19,below:2.5,mount:'floor',
    pins:cmPins([['VCC','5v'],['GND','gnd'],['IN','sig']],13,2),features:[{t:'wire',side:'xmax',u:13,dia:6},{t:'hole',x:3,y:3,dia:3},{t:'hole',x:47,y:3,dia:3},{t:'hole',x:3,y:23,dia:3},{t:'hole',x:47,y:23,dia:3}]}}
];
// Show these common modules in the Parts Library list too (they used to appear only after the wizard picked one).
// Each stays marked "Approximate" (typical sizes: measure yours); a copy you already saved keeps winning over this one.
for(const m of COMMON_MODS){
  if(builtinById(m.part.id))continue;
  if(/^p-cm-relay|^p-cm-pir$|^p-cm-led5mm$/.test(m.part.id))continue;// curated relays, HC-SR501 and 5 mm LED replace these in the list (the wizard search still uses them)
  const b=tidyPart(Object.assign(clone(m.part),{notes:CM_NOTE,acc:'approx',builtin:true}));
  if(/^p-cm-relay/.test(b.id))b.type='relay';
  BUILTIN.push(b);
}
function commonPart(m){
  const have=partById(m.part.id);if(have)return have;
  const c=tidyPart(Object.assign(clone(m.part),{notes:CM_NOTE,acc:'approx'}));
  custom.push(c);if(!saveLib()){custom.pop();return null;}
  return partById(c.id);
}
// A parts-library part made into one of the user's own parts, without asking (the Parts Library's own import).
async function importLibPart(src,id){
  const r=await src.load(id),title=String(r.data?r.data.title:'').slice(0,80);
  const have=title&&custom.find(c=>c.name===title);if(have)return have;
  if(edDirty)throw new Error('the Parts Library has a part with unsaved changes: save it first');
  ed=tidyPart({id:newPartId(),name:'New part',type:'board',shape:'rect',w:30,d:20,pcb:1.6,h:3,below:0,mount:'floor',features:[]});
  await (r.data?applyFritzingData(r.data):applyFritzing(r.fzp,r.svg,r.file));
  if(!savePart())return null;
  return partById(ed.id);
}
// Finds a part for each of the AI's part kinds. Returns [{spec, part|null, from, note}].
async function intentMatch(specs){
  const out=[];let lib=null,libList=null,libTried=false;
  const own=()=>allParts().map(p=>({title:p.name,family:(TYPES[p.type]||TYPES.other).name,tags:[p.type],desc:(p.notes||'').slice(0,300),ref:p}));
  // loose: drop words from the end until something matches, but keep at least ceil(original/2) words so
  // "capacitive" alone can't pull in a touchscreen display when the search was "capacitive soil moisture".
  const find=(list,q,loose)=>{const w=String(q||'').split(/[\s]+/).filter(Boolean),min=loose?Math.max(1,Math.ceil(w.length/2)):w.length;while(w.length){if(w.length>=min){const r=searchParts(list,w.join(' '),'all');if(r.length)return r[0];}if(!loose||w.length<=min)break;w.pop();}return null;};
  for(const spec of specs){
    const txt=spec.category+' '+spec.search+' '+spec.function;
    if(/^power/i.test(spec.category)){
      const bat=/batter|lipo|18650|cordless|portable/i.test(spec.search+' '+spec.function),mains=!bat&&/mains|adapter|wall|plug/i.test(spec.search+' '+spec.function);
      out.push({spec,part:null,from:'power',power:bat?'battery':mains?'mains':'usb',note:bat?'Runs from a LiPo battery: the Enclosure Wizard adds the battery, a charger and an on/off switch.':mains?'Powered by a mains adapter (a plug-in USB charger): no extra part needed.':'Powered by a USB cable: no extra part needed.'});continue;
    }
    if(/^communication/i.test(spec.category)&&/wi-?fi|wireless|internet|esp/i.test(txt)){out.push({spec,part:null,from:'wifi',note:''});continue;}// (r3) built in or removed, by platform (pfMatches)
    let part=null,from='';
    if(/^(micro|controller|board)|esp32|esp8266|arduino|raspberry/i.test(spec.category+' '+spec.search))continue;// (r3) the board comes from the chosen platform
    if(!part){const r=find(own().filter(x=>!CTRL_IDS.includes(x.ref.id)),spec.search);if(r){part=r.ref;from=r.ref.builtin&&!custom.some(c=>c.id===r.ref.id)?'built-in part':'your own parts';}}
    if(!part){const m=COMMON_MODS.find(m=>(m.re.test(spec.search)||m.re.test(spec.function))&&!(m.not&&(m.not.test(spec.search)||m.not.test(spec.function))));if(m){part=commonPart(m);if(part)from='common module';}}
    // (r7) Parts library lookup removed — unknown parts stay unknown and are handled by AI via "Fix this part"
    out.push({spec,part,from,note:part?'':'Click 🔍 Look this up to ask your AI for its typical size and pins, or add it yourself later with Parts Library….'});
  }
  return out;
}
// Makes the AI's answer safe to use, and adds what a weather or messaging project always needs.
function tidyIntent(d,desc){
  const str=(v,n)=>String(v==null?'':v).slice(0,n||400);
  const A={name:str(d.name,30).trim(),summary:str(d.summary,1200),esphome_notes:str(d.esphome_notes,1500),esphome_yaml_hint:str(d.esphome_yaml_hint,2000),notification_method:str(d.notification_method||'ntfy',20)};
  // (r3) the platform the AI suggests (the user can pick another), what the code must do, and the libraries it needs
  A.platform=pfNorm(d.platform);A.platform_reason=str(d.platform_reason,400);A.code_description=str(d.code_description,2500);A.missing_parts_hint=str(d.missing_parts_hint,300);
  A.microcontroller=d.microcontroller&&typeof d.microcontroller==='object'?{name:str(d.microcontroller.name,60),why:str(d.microcontroller.why,300)}:null;
  A.requirements=(Array.isArray(d.requirements)?d.requirements:[]).map(x=>str(x,200).trim()).filter(Boolean).slice(0,10);
  A.code_libraries=(Array.isArray(d.code_libraries)?d.code_libraries:[]).map(x=>str(x,60)).filter(Boolean).slice(0,12);
  if(!/^(ntfy|none|email)$/.test(A.notification_method))A.notification_method='ntfy';
  A.parts=(Array.isArray(d.parts)?d.parts:[]).filter(p=>p&&typeof p==='object').slice(0,12).map(p=>({category:str(p.category,40),function:str(p.function,300),search:str(p.search||p.function,60),required:p.required!==false,why:str(p.why,300)}));
  // Sanity-filter: remove parts the AI hallucinated that the user never asked for.
  // Each rule: if the description does NOT mention any of the trigger words, remove parts matching the sensor pattern.
  const _d=desc.toLowerCase();
  const _notAsked=(triggers,partPattern)=>!triggers.some(w=>_d.includes(w))&&A.parts.some(p=>partPattern.test(p.search+' '+p.category));
  const _removeParts=pat=>{ A.parts=A.parts.filter(p=>!pat.test(p.search+' '+p.category)); };
  if(_notAsked(['tilt','level','angle','balance','lean','gyro','accelero']          ,/mpu.?6050|accelero|tilt/i))      _removeParts(/mpu.?6050|accelero|tilt/i);
  if(_notAsked(['temperature','temp','hot','cold','heat','climate','weather','humid'],/bme280|bmp280|dht|temperature|humidity|sensors-temp|sensors-humid/i)&&/soil|plant|pot|moist|water/i.test(_d)) _removeParts(/bme280|bmp280|dht22|dht11|temperature|humidity|sensors-temp|sensors-humid/i);
  if(_notAsked(['light','bright','lux','dark','sun','day','night']                  ,/bh1750|ldr|photo|light.level|sensors-light/i))  _removeParts(/bh1750|ldr|photo.?resistor|light.level|sensors-light/i);
  if(_notAsked(['motion','movement','person','intruder','detect','pir']             ,/pir|hc.sr501|motion/i))           _removeParts(/pir|hc.sr501|motion/i);
  if(_notAsked(['distance','range','ultrasonic','how far','proximity']             ,/hc.sr04|ultrasonic|distance/i))   _removeParts(/hc.sr04|ultrasonic|distance/i);
  if(_notAsked(['display','screen','oled','lcd','show','read out']                 ,/ssd1306|sh1106|oled|lcd|display/i))_removeParts(/ssd1306|sh1106|i2c.*display|oled|lcd/i);
  if(_notAsked(['rgb','neopixel','led strip','addressable','colour light','color light','ws281','sk68'],/ws281|sk68|neopixel|addressable|rgb.strip|led.strip/i))_removeParts(/ws281|sk68|neopixel|addressable|rgb.strip|led.strip/i);
  const alias=k=>{k=str(k,40).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');return /owm|openweather|weather_api/.test(k)?'owm_api_key':/^(city|town|location|place|weather_location|city_name)$/.test(k)?'location':/ntfy/.test(k)?'ntfy_topic':k;};
  const ins=[];
  for(const x of Array.isArray(d.extra_inputs_needed)?d.extra_inputs_needed:[]){
    if(!x||typeof x!=='object')continue;const key=alias(x.key);
    if(!key||/wifi|ssid|wi_fi/.test(key)||ins.some(i=>i.key===key))continue;
    ins.push({key,label:str(x.label||key,120),help:str(x.help,300),url:/^https:\/\//.test(x.url||'')?str(x.url,200):'',only:PLATFORMS[x.only_if_platform]?x.only_if_platform:''});
  }
  const all=desc+' '+A.summary+' '+A.esphome_notes;
  const weather=/weather|forecast/i.test(desc)||ins.some(i=>i.key==='owm_api_key');
  const notify=/notif|message|text me|\bsms\b|e-?mail|alert|send me|tell me|ntfy|my phone/i.test(all)||ins.some(i=>i.key==='ntfy_topic');
  const need=(key,label,help,url)=>{if(!ins.some(i=>i.key===key))ins.push({key,label,help,url:url||''});};
  if(weather){
    need('owm_api_key','Your OpenWeatherMap API key','Free: sign up at openweathermap.org, then copy the key from "My API keys". A new key can take an hour to start working.','https://home.openweathermap.org/api_keys');
    need('location','Where should the weather be for?','A town and country code, e.g. London,GB. Change it here whenever you travel.');
  }
  if(notify){
    A.notification_method='ntfy';
    need('ntfy_topic','Your ntfy.sh topic name (for messages to your phone)','Install the free ntfy app, tap + and subscribe to this exact name. Anyone who knows the name can read the messages, so keep it unusual.','https://ntfy.sh');
    if(weather)need('notify_time','What time should it send the daily weather message?','24-hour time, e.g. 07:30.');
  }
  A.extra_inputs_needed=ins.slice(0,8);
  return A;
}
// A saved ntfy topic is reused only if it is an EvenUCan topic made for this same device name;
// otherwise (an old name, or a different project) a fresh one is made, so topics never leak between projects.
const newTopic=A=>'evenucan-'+esphSlug(A.name||'device').slice(0,16)+'-'+Math.random().toString(36).slice(2,8);
const intentDefault=(k,A)=>{const v=WF.store.get('intent_inputs.'+k);
  if(k==='ntfy_topic'){const pre='evenucan-'+esphSlug(A.name||'device').slice(0,16)+'-';return (typeof v==='string'&&v.startsWith(pre))?v:newTopic(A);}
  if(v!=null&&v!=='')return v;
  return k==='notify_time'?'07:30':'';};
document.body.insertAdjacentHTML('beforeend',`<div id="iwBack" class="ewBack"><div class="ewWin" id="iwWin" role="dialog" aria-modal="true" aria-labelledby="iwTitle" style="width:min(780px,calc(100vw - 20px));height:auto;max-height:calc(100vh - 20px);user-select:text">
  <div class="ewHead"><h2 id="iwTitle">💡 What do I want to build?</h2><span class="ewNote" id="iwSub">Say what your gadget should do. Your AI picks the parts; EvenUCan sets up the box, the wiring and the code.</span>
    <button id="iwX" class="x" title="Close (Esc)" style="font-size:18px">✕</button></div>
  <div id="iwBody" style="padding:12px 16px;overflow:auto;font-size:13px;line-height:1.55"></div>
  <div class="ewFoot" id="iwFoot"></div>
</div></div>`);
const iwBack=$('iwBack');
// (setup-r1) First-run setup wizard: printer bed size + AI key. Shows once then never again.
const setupDone=()=>WF.store.get('setup_done')==='1';
const SU_PRESETS=[
  {label:'Ender 3 / Ender 3 Pro / Neo',v:'220,220,250'},
  {label:'Bambu Lab X1 / P1 series',v:'256,256,256'},
  {label:'Bambu Lab A1 mini',v:'180,180,180'},
  {label:'Bambu Lab A1 (full size)',v:'256,256,256'},
  {label:'Prusa MK4 / MK3S',v:'250,210,220'},
  {label:'Prusa Mini / Mini+',v:'180,180,180'},
  {label:'Creality K1 / K1 Max',v:'220,220,250'},
  {label:'AnkerMake M5 / M5C',v:'235,235,250'},
  {label:'Voron 2.4 (300 mm)',v:'300,300,300'},
  {label:'Voron 0 / 0.2',v:'120,120,120'},
  {label:'Something else (enter size)',v:'custom'}
];
document.body.insertAdjacentHTML('beforeend',
  '<div id="suBack" class="ewBack"><div class="ewWin" role="dialog" aria-modal="true" aria-labelledby="suTitle" style="width:min(520px,calc(100vw - 20px));height:auto">'+
  '<div class="ewHead"><h2 id="suTitle">🎉 Welcome to EvenUCan</h2></div>'+
  '<div id="suProg" style="font-size:12px;color:var(--text2);padding:8px 16px 2px;font-weight:600"></div>'+
  '<div id="suBody" style="padding:8px 16px 0;font-size:13px;line-height:1.55"></div>'+
  '<div id="suFoot" style="padding:10px 16px 14px;display:flex;gap:8px;flex-wrap:wrap"></div>'+
  '</div></div>');
const suBack=$('suBack');
let su={step:'su1',bedX:220,bedY:220,bedZ:250,bedSet:false};
function renderSetup(){
  const b=$('suBody'),f=$('suFoot'),P=$('suProg');
  if($('suNever'))su.never=$('suNever').checked;// keep the tick when the step changes
  if(su.step==='su1'){
    P.textContent='Step 1 of 4 — Your 3D printer';
    b.innerHTML=
      '<div style="font-size:14px;font-weight:600;margin-bottom:6px">What 3D printer do you have?</div>'+
      '<div style="color:var(--text2);margin-bottom:10px">This sets the build plate size so EvenUCan can warn you if your box is too big to print.</div>'+
      '<select id="suPreset" style="width:100%;font:inherit;padding:4px 6px;margin-bottom:10px">'+
        '<option value="">— Choose your printer —</option>'+
        SU_PRESETS.map(p=>'<option value="'+p.v+'"'+(su.bedSet&&su._preset===p.v?' selected':'')+'>'+esc(p.label)+'</option>').join('')+
      '</select>'+
      '<div id="suManual" style="'+(su.bedSet?'':'display:none')+'">'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">'+
          '<label>Width (X)&nbsp;<input id="suBedX" type="number" min="10" max="2000" value="'+su.bedX+'" style="width:68px;font:inherit;padding:3px 5px"> mm</label>'+
          '<label>Depth (Y)&nbsp;<input id="suBedY" type="number" min="10" max="2000" value="'+su.bedY+'" style="width:68px;font:inherit;padding:3px 5px"> mm</label>'+
          '<label>Height (Z)&nbsp;<input id="suBedZ" type="number" min="10" max="2000" value="'+su.bedZ+'" style="width:68px;font:inherit;padding:3px 5px"> mm</label>'+
        '</div>'+
      '</div>';
    f.innerHTML='<button id="suNext1" class="primary wcBig">Next →</button>'+
      '<button id="suSkip1" class="wcBig wcPlain" style="font-size:12px;color:var(--text2)">Skip for now</button>';
    const pre=$('suPreset');
    pre.addEventListener('change',()=>{
      const v=pre.value;if(!v)return;
      su._preset=v;su.bedSet=true;
      if(v==='custom'){$('suManual').style.display='';return;}
      const[x,y,z]=v.split(',');su.bedX=+x;su.bedY=+y;su.bedZ=+z;
      $('suManual').style.display='';
      $('suBedX').value=x;$('suBedY').value=y;$('suBedZ').value=z;
    });
  }else if(su.step==='su2'){
    P.textContent='Step 2 of 4 — Your board and software';
    const cur=WF.store.get('pref_pf')||'';
    b.innerHTML=
      '<div style="font-size:14px;font-weight:600;margin-bottom:6px">What will you program your gadgets with?</div>'+
      '<div style="color:var(--text2);margin-bottom:10px">EvenUCan uses this to pick the right kind of code and the right board. Not sure? Leave it on "Not sure yet": you can change it for each project.</div>'+
      Object.entries(WC_PF).map(([k,p])=>'<label style="display:flex;gap:8px;align-items:center;margin:7px 0;font-size:14px"><input type="radio" name="suPf" value="'+k+'"'+(cur===k?' checked':'')+'> '+esc(p.label)+(p.tip?' <span class="ewNote">← '+esc(p.tip)+'</span>':'')+'</label>').join('');
    f.innerHTML='<button id="suBack2" class="wcBig wcPlain">← Back</button><button id="suNext2" class="primary wcBig">Next →</button>'+
      '<button id="suSkip2" class="wcBig wcPlain" style="font-size:12px;color:var(--text2)">Skip for now</button>';
  }else if(su.step==='su3'){
    const has=!!aiKey(),P2=PROVIDERS[aiProv()];
    P.textContent='Step 3 of 4 — AI helper (optional)';
    b.innerHTML=
      '<div style="font-size:14px;font-weight:600;margin-bottom:6px">Set up an AI key</div>'+
      '<div style="color:var(--text2);margin-bottom:10px">The AI plans the parts, box and code from your description. Free keys work great — no credit card needed. You can always change this later in <b>Tools → AI key</b>.</div>'+
      aiHelperBox(true)+
      (has?'<div style="color:var(--ok);margin-top:4px">✅ '+esc(P2.name)+' key is set up — you\'re ready!</div>':'');
    f.innerHTML='<button id="suBack3" class="wcBig wcPlain">← Back</button>'+
      '<button id="suNext3" class="primary wcBig">Next →</button>'+
      '<button id="suSkip3" class="wcBig wcPlain" style="font-size:12px;color:var(--text2)">Skip, no AI for me</button>';
  }else if(su.step==='su4'){
    P.textContent='Step 4 of 4 — You are ready';
    b.innerHTML=
      '<div style="font-size:16px;font-weight:600;margin-bottom:6px">🧭 Want me to show you around?</div>'+
      '<div style="color:var(--text2);margin-bottom:6px">I will build a small first project with you. The screen goes dim and I <b>ring the one button to click next</b>, all the way from the idea to sending the code to your board. It takes about five minutes and needs no AI.</div>'+
      '<div class="ewNote">You can run it again any time from <b>🧭 First project</b> at the top.</div>';
    f.innerHTML='<button id="suGuide" class="primary wcBig">Yes, guide me through my first project →</button>'+
      '<button id="suNoGuide" class="wcBig wcPlain">No thanks, I will look around myself</button>'+
      '<button id="suBack4" class="wcBig wcPlain" style="font-size:12px;color:var(--text2)">← Back</button>';
  }
  // on every step: leave the setup, and ask not to see it again
  f.insertAdjacentHTML('beforeend','<div style="flex-basis:100%;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:4px;font-size:12.5px"><label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="suNever"'+(su.never?' checked':'')+'> Don\'t show this setup again</label><button id="suSkipAll" class="linkBtn">Skip the setup</button></div>');
}
function suFinish(){WF.store.set('setup_done','1');suBack.style.display='none';}
suBack.addEventListener('click',e=>{
  const id=e.target.id;
  if(id==='suNext1'||id==='suSkip1'){
    if(id==='suNext1'&&su.bedSet){
      const x=+($('suBedX')||{value:su.bedX}).value||su.bedX;
      const y=+($('suBedY')||{value:su.bedY}).value||su.bedY;
      const z=+($('suBedZ')||{value:su.bedZ}).value||su.bedZ;
      if(x>9&&y>9&&z>9&&window.WF&&window.WF.setBed)window.WF.setBed(x,y,z);
    }
    su.step='su2';renderSetup();
  }else if(id==='suNext2'||id==='suSkip2'){
    const r=document.querySelector('input[name="suPf"]:checked');
    if(id==='suNext2'&&r&&PLATFORMS[r.value]){WF.store.set('pref_pf',r.value);iw.w.pf=r.value;iw.noai.pf=r.value;}
    su.step='su3';renderSetup();
  }else if(id==='suBack2'){su.step='su1';renderSetup();}
  else if(id==='suNext3'||id==='suSkip3'){su.step='su4';renderSetup();}
  else if(id==='suBack3'){su.step='su2';renderSetup();}
  else if(id==='suBack4'){su.step='su3';renderSetup();}
  else if(id==='suGuide'){suFinish();coachStart();}
  else if(id==='suNoGuide'){suFinish();openStartupChoice();}
  else if(id==='suSkipAll'){if($('suNever')&&$('suNever').checked)WF.store.set('setup_done','1');suBack.style.display='none';openStartupChoice();}
  // AI key buttons reused from aiHelperBox — same IDs as welcome wizard
  else if(id==='wcAiGem')askKey('gemini').then(renderSetup);
  else if(id==='wcAiNv')askKey('nvidia').then(renderSetup);
  else if(id==='wcAiGroq')askKey('groq').then(renderSetup);
  else if(id==='wcAiOr')askKey('openrouter').then(renderSetup);
  else if(id==='wcAiOllama')askKey('ollama').then(renderSetup);
  else if(id==='wcAiCl')askKey('claude').then(renderSetup);
  else if(id==='wcAiOa')askKey('openai').then(renderSetup);
  else if(id==='wcAiDs')askKey('deepseek').then(renderSetup);
  else if(id==='wcAiGrok')askKey('grok').then(renderSetup);
  else if(id==='wcAiTest')askKey(aiProv()).then(renderSetup);
});
function openSetup(){
  if(setupDone())return false;
  su={step:'su1',bedX:220,bedY:220,bedZ:250,bedSet:false,_preset:'',never:false};
  $('suFoot').innerHTML='';// forget a tick left from an earlier opening
  suBack.style.display='grid';
  renderSetup();
  return true;
}
// (startup-r1) Startup choice overlay: shown on 2nd+ run when there is a previous project to restore.
document.body.insertAdjacentHTML('beforeend','<div id="spBack" class="ewBack"><div class="ewWin" role="dialog" aria-modal="true" aria-labelledby="spTitle" style="width:min(480px,calc(100vw - 20px));height:auto">'+
  '<div class="ewHead"><h2 id="spTitle">👋 Welcome back</h2></div>'+
  '<div style="padding:12px 16px 0;font-size:13px;line-height:1.55">'+
  '<p style="margin:0 0 14px">Your last project is ready to carry on. Or start something new — the wizard will plan the parts, the box and the code from your description.</p>'+
  '<button id="spContinue" class="wcBig primary" style="margin-bottom:8px">Continue my last project →</button>'+
  '<button id="spNew" class="wcBig wcPlain">Start a new project…</button>'+
  '</div><div style="height:14px"></div>'+
'</div></div>');
const spBack=$('spBack');
function openStartupChoice(){
  if(openSetup())return;// first ever open: show the setup wizard (printer + AI key) first
  // If saved project data exists, offer Continue / New (regardless of wcSeen which is unreliable)
  const hasSaved=!!(WF.store.get(WIZ_KEY)||WF.store.get(ESPH_KEY)||WF.store.get(ESPH_AI_KEY)||intentNow());
  if(hasSaved){spBack.style.display='grid';return;}
  // Nothing saved (true first run after setup, or after a New Project) → open the Welcome wizard
  openWelcome(true);
}
function closeStartupChoice(){spBack.style.display='none';}
spBack.addEventListener('click',e=>{
  const id=e.target.id;
  if(id==='spContinue')closeStartupChoice();
  else if(id==='spNew'){
    closeStartupChoice();
    // Clear all project keys from storage now (hardcoded: ELEC_KEYS is in the outer IIFE)
    ['enclosure.wizard','esphome.form','parts','intent'].forEach(k=>WF.store.set(k,''));
    WF.store.set(ESPH_AI_KEY,'');
    WF.store.set('welcome_seen','');// allow welcome wizard to show again on next open
    try{Object.keys(localStorage).filter(k=>/^opensketch\.intent_inputs\./.test(k)).forEach(k=>localStorage.removeItem(k));}catch(e){}
    // Reset in-memory wizard state so stale checkboxes/text don't bleed into the next run
    iw.w={text:'',does:[],pf:'auto',noShow:false};iw.desc='';iw.step='ask';
    // Reset in-memory state before the wizard opens (storage is clear so readWiz returns DEFAULT_WIZ)
    wiz=readWiz();
    if(wr){wr.ai=null;wr.plan=null;}
    if(window.newProject)window.newProject();
  }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&spBack.style.display==='grid')closeStartupChoice();});
const IW_STEPS=['Thinking about your idea…','Finding matching parts…','Setting up the enclosure…','Generating code…'];
let iw={step:'ask',desc:'',prog:0,analysis:null,base:null,matches:null,pf:'esphome',override:false,missingAdded:[],vals:{},err:'',raw:'',busy:false,
  welcome:false,w:{text:'',does:[],pf:'auto',noShow:false},userPf:null,noai:{parts:[],pf:'esphome'},nokeyFrom:''};// (r4) welcome: opened by the Welcome window; w: its answers
function renderIntent(){
  const b=$('iwBody'),f=$('iwFoot');
  updateStrip();
  if(wcRender())return;// (r4) the Welcome steps
  if(iw.step==='ask'){
    const has=!!aiKey();
    b.innerHTML=`<label for="iwDesc" style="font-weight:600;display:block;margin-bottom:6px">What problem are you trying to solve?</label>
<textarea id="iwDesc" rows="7" style="width:100%;box-sizing:border-box;font-size:14px;line-height:1.45;resize:vertical" placeholder="e.g. My RV keeps going unlevel overnight and I want an alert. Or: I want to know if someone opens the garden gate. Just describe the problem — no technical knowledge needed!">${esc(iw.desc)}</textarea>
<div class="ewRow" style="margin-top:6px;flex-wrap:wrap;gap:6px"><span class="ewNote">Try an example:</span>${Object.keys(EXAMPLES).map(k=>`<button data-ex="${esc(k)}" style="border-radius:14px;padding:2px 10px">${esc(k)}</button>`).join('')}</div>
<div class="ewNote" style="margin-top:6px">Your AI (${esc(PROVIDERS[aiProv()].name)}) reads it and picks the right parts${has?'.':' — <span class="warn">it needs a free key first:</span> <button id="iwKey">'+esc(keyLabel())+'</button> or <button id="wcNoAi">Carry on without AI</button>'}</div>
${iw.err?`<div class="bad" style="margin-top:8px">${esc(iw.err)}</div>`:''}`;
    f.innerHTML='<button id="iwGo" class="primary">Next →</button><button id="iwCancel">Close</button>';
    setTimeout(()=>{const t=$('iwDesc');if(t)t.focus();},0);
  }else if(iw.step==='clarify'){
    const cl=iw.clarify||{power:'usb',phone:true};
    const POW_CL=[['usb','🔌 USB / mains adaptor','plugged in all the time'],['battery','🔋 Battery inside the box','rechargeable — good for portable and outdoor projects'],['mains','🔌 Dedicated mains adaptor','always-on power supply in a wall socket']];
    b.innerHTML=`<div style="font-size:16px;font-weight:600;margin-bottom:10px">One quick thing before I start…</div>
<fieldset style="border:none;padding:0;margin:0 0 14px"><legend style="font-weight:600;margin-bottom:8px">How will it be powered?</legend>${POW_CL.map(([v,l,t])=>`<label style="display:flex;gap:8px;align-items:center;margin:8px 0;font-size:14px"><input type="radio" name="iwClPow" value="${v}"${cl.power===v?' checked':''}> <b>${l}</b> <span class="ewNote">${t}</span></label>`).join('')}</fieldset>
<label style="display:flex;gap:8px;align-items:flex-start;font-size:14px;cursor:pointer"><input type="checkbox" id="iwClPhone"${cl.phone?' checked':''}> <span><b>Send alerts to my phone</b> <span class="ewNote">— when something happens (a gate opening, a sensor triggering, a low battery). Uses ntfy, free.</span></span></label>
${iw.err?`<div class="bad" style="margin-top:8px">${esc(iw.err)}</div>`:''}`;
    f.innerHTML='<button id="iwClBack">← Back</button><button id="iwClGo" class="primary">Let\'s find the parts →</button>';
    setTimeout(()=>{const r=b.querySelector('input[name="iwClPow"]:checked');if(r&&iwBack.style.display==='grid')r.focus();},0);
  }else if(iw.step==='busy'){
    b.innerHTML=(iw.welcome?'<div style="font-size:18px;font-weight:600;margin:4px 0 8px">🔮 Working out your gadget...</div>':'')+'<div style="margin:6px 0 10px" aria-live="polite">'+IW_STEPS.map((s,i)=>`<div class="${i<iw.prog?'ok':i===iw.prog?'':'ewNote'}" style="font-size:14px;margin:4px 0">${i<iw.prog?'✓':i===iw.prog?'<span class="wcSpin">⟳</span>':'·'} ${esc(s)}</div>`).join('')+'</div><div class="ewNote">'+(aiProv()==='ollama'?'Local AI can take 1–5 minutes depending on your model and computer.':'Asking an AI usually takes 10–40 seconds.')+' <span id="iwAiCd"></span></div>';
    f.innerHTML='<button id="iwCancel">Close</button>';
  }else if(iw.step==='error'){
    b.innerHTML=`<div class="bad" style="font-size:14px;margin-bottom:8px">${esc(iw.err)}</div>`+(iw.raw?`<details><summary>What the AI sent back</summary><textarea readonly class="wrCode" style="height:180px">${esc(iw.raw)}</textarea></details>`:'');
    f.innerHTML='<button id="iwRetry" class="primary">Try again</button><button id="iwEdit">Change my description</button><button id="iwCancel">Close</button>';
  }else if(iw.step!=='ready'){
    const A=iw.analysis,pf=pfOk(iw.pf),PF=PLATFORMS[pf],aiPf=pfOk(A.platform);
    const okFrom=m=>m.from==='power'||m.from==='skip'||m.from==='removed';
    const rows=iw.matches.map((m,k)=>m.from==='power'?'':`<li style="margin:5px 0">${m.part?'<span class="ok">✓</span> <b>'+esc(m.part.name)+'</b>':m.from==='removed'?'<span class="ewNote">✗</span> <s>'+esc(m.spec.search)+'</s>':okFrom(m)?'<span class="ok">✓</span> <b>'+esc(m.spec.category==='power'?'Power':m.spec.search)+'</b>':'<span class="warn">!</span> <b>'+esc(m.spec.search)+'</b> '+IW_BADGE} — ${esc(m.spec.function)}`+(iw.edit&&!m.ctrl?` <button data-iwdel="${k}" class="linkBtn" title="Take this part out">✕ Remove</button>`:'')+
      (m.from&&m.part?` <span class="ewNote">(${esc(m.from)})</span>`:'')+(m.part&&accOf(m.part)==='approx'&&m.from==='AI lookup'?' <span class="warn">⚠️ Approximate</span>':'')+
      (m.spec.why&&!m.ctrl?`<div class="ewNote">Why: ${esc(m.spec.why)}</div>`:'')+(m.note?`<div class="${m.part||okFrom(m)?'ewNote':'warn'}">${esc(m.note)}</div>`:'')+
      (!m.part&&!okFrom(m)&&!m.ctrl?`<div class="ewRow" style="margin:3px 0 0">${m.looking?`<span class="ewNote">⏳ ${esc(m.lookStage||'Searching…')}</span>`:`<button data-look="${k}">🔍 Look this up</button>`}${m.lookErr?` <span class="bad">${esc(m.lookErr)}</span>`:''}</div>`:'')+'</li>').join('');
    // Hardware gap warning: required parts the AI asked for that have no match in the library
    const gapParts=iw.matches.filter(m=>m.spec&&m.spec.required&&!m.part&&!m.ctrl&&m.from!=='power'&&m.from!=='skip'&&m.from!=='removed');
    const missingWarning=gapParts.length?`<div class="bad" style="margin:10px 0;padding:10px 12px;border-radius:6px;border-left:4px solid #c00"><b>⚠️ Your project needs parts that aren't in your library yet</b><ul style="margin:6px 0 4px;padding-left:18px">`+gapParts.map(m=>`<li><b>${esc(m.spec.search)}</b> — ${esc(m.spec.function)}${m.spec.why?` <span class="ewNote">(${esc(m.spec.why)})</span>`:''}</li>`).join('')+`</ul><div style="margin-top:4px">Without ${gapParts.length===1?'it':'these'}, the device can't do everything you described. Click <b>🔍 Look this up</b> next to ${gapParts.length===1?'it':'each one'} above — your AI will find its dimensions and add it to your library automatically.</div></div>`:'';
    const drop=iw.dropped||[],noWifi=drop.includes('wifi');
    const shown=A.extra_inputs_needed.filter(x=>inputShown(x,pf)&&!(noWifi&&NET_KEYS.test(x.key))),hidden=A.extra_inputs_needed.filter(x=>!shown.includes(x));
    iw.vals=iw.vals||{};for(const x of shown)if(iw.vals[x.key]==null)iw.vals[x.key]=intentDefault(x.key,A);// made once, so the topic stays the same
    const ins=shown.map(x=>`<label class="ef" style="margin:8px 0"><b>${esc(x.label)}</b><br><input type="text" data-iw="${esc(x.key)}" value="${esc(iw.vals[x.key])}" style="width:100%;box-sizing:border-box"${SECRETISH.test(x.key)||x.key==='ntfy_topic'?' autocomplete="off" spellcheck="false"':''}>`+
      `<span class="ewNote">${esc(x.help)}${x.url?` <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.url.replace(/^https:\/\//,''))}</a>`:''}</span></label>`).join('');
    const topic=shown.some(x=>x.key==='ntfy_topic')?String(iw.vals.ntfy_topic||'').trim():'';
    const net=!noWifi&&pf!=='arduino'&&netNeeded(iw.desc,A);
    const wifiIn=net&&pf==='esp32ide'?`<div class="efbox" style="line-height:1.4"><b>Your Wi-Fi</b> <span class="ewNote">(so it can send the messages)</span>
<label class="ef" style="margin:6px 0">Wi-Fi name<br><input id="iwSsid" value="${esc(wifiMem.ssid)}" autocomplete="off" spellcheck="false" style="width:100%;box-sizing:border-box"></label>
<label class="ef" style="margin:6px 0">Wi-Fi password<br><input id="iwPass" type="password" value="${esc(wifiMem.pass)}" autocomplete="new-password" style="width:100%;box-sizing:border-box"></label>
<div class="ewNote">Kept only in the code made on this computer: never sent to the AI or anywhere else, and not saved. Or leave them empty: the code then has clearly marked places (WIFI_SSID and WIFI_PASSWORD) to type them in.</div></div>`
      :net&&pf==='esphome'?'<div class="ewNote" style="margin:6px 0">Your Wi-Fi name and password go into ESPHome\'s <b>Secrets</b> later, not here.</div>':'';
    const issues=capIssues(pf,iw.desc,A,iw.power,drop),blocked=issues.some(c=>c.block);
    const POW_OPTS=[['usb','🔌 USB cable','plugged into a computer or a USB charger'],['battery','🔋 Battery inside the box','EvenUCan adds a rechargeable battery, a charger and an on/off switch'],['mains','🔌 Mains adapter','a plug-in 5 V USB charger in a wall socket, for running all the time']];
    const pow=`<h4>How is it powered?</h4><div class="iwPow" role="radiogroup" aria-label="Power">`+POW_OPTS.map(([v,l,t])=>`<label><input type="radio" name="iwPow" value="${v}"${iw.power===v?' checked':''}> <b>${l}</b> <span class="ewNote">${t}</span></label>`).join('')+'</div>';
    const pfBtns=Object.entries(PLATFORMS).map(([k,p])=>`<button data-pf="${k}" aria-pressed="${k===pf}" class="${k===pf?'primary':''}" title="${esc(p.about)}">${p.icon} ${esc(p.name)}${k===aiPf?' · AI\'s pick':''}</button>`).join('');
    const why=pf===aiPf?(A.platform_reason?'<b>Why:</b> '+esc(A.platform_reason)+' ':''):`<b>You chose ${esc(PF.name)}</b> instead of the AI's suggestion (${esc(PLATFORMS[aiPf].name)}${A.platform_reason?': '+esc(A.platform_reason):''}). `;
    const removed=iw.matches.filter(m=>m.from==='removed').map(m=>m.spec.search);
    const gone=pf==='arduino'&&(removed.length||noWifi)?`<div class="warn" style="margin:4px 0">Without Wi-Fi on the ${esc(PF.name)}: `+(removed.length?'removed '+esc(removed.join(', '))+'. ':'')+(noWifi?'You chose to leave out messages to your phone and anything from the internet.':'')+'</div>':'';
    let editor='';
    if(iw.edit){
      editor=`<div class="efbox" id="iwEditor"><b>Change the parts</b><div class="ewNote">Take a part out with ✕ Remove, search for a part below, or pick a different board above.</div>
<div class="ewRow" style="margin-top:6px"><input id="iwAddSearch" type="search" placeholder="Type what you're looking for — e.g. gyroscope, air quality, DHT22, screen…" style="flex:1;min-width:0" autocomplete="off"></div>
<div id="iwAddResults" style="max-height:230px;overflow-y:auto;border:1px solid var(--line);border-radius:5px;margin-top:6px"><div class="ewNote" style="padding:6px 8px">Type above to search your own parts and the full ready-made library.</div></div></div>`;
    }
    b.innerHTML=`<h4 style="margin-top:0">${esc(A.name||'Your device')}</h4><p style="margin:4px 0 10px">${esc(A.summary)}</p>`+capHtml(issues)+`
<h4>Which board runs it?</h4><div class="ewRow" role="group" aria-label="Platform" style="flex-wrap:wrap">${pfBtns}</div><p style="margin:4px 0">${why}<span class="ewNote">${esc(PF.about)}</span></p>${gone}
<h4 id="iwPartsHead">The parts I picked, and why</h4><ul style="list-style:none;padding:0;margin:0">${rows}</ul>${missingWarning}${editor}${pow}`+
      (A.code_description||A.esphome_notes?`<h4>How the code will work</h4><p class="ewNote" style="font-size:13px;margin:0">${esc(A.code_description||A.esphome_notes)}</p>`:'')+
      (pf!=='esphome'&&A.code_libraries.length?`<p class="ewNote" style="margin:4px 0 0">Libraries the AI suggested: ${esc(A.code_libraries.join(', '))}</p>`:'')+
      (ins?`<div class="efbox" style="line-height:1.4"><b>A few things I need from you</b><div class="ewNote">They are kept on this computer and saved with your project file, and written into the device's code.</div>${ins}</div>`:'')+ntfyBox(topic)+wifiIn;
    f.innerHTML=`<button id="iwRestart" class="linkBtn">Start again from the beginning</button><button id="iwAgain" aria-expanded="${!!iw.edit}">${iw.edit?'Done changing parts':'Change these parts'}</button><button id="iwApply" class="primary"${blocked?' disabled title="First choose how to fix the problem shown in red"':''}>Looks good. Next: Box →</button>`;
  }else if(iw.step==='ready'){
    const c=currentCode(),it=intentNow()||{},box=WF.model.faces.length>0,pf=c?c.pf:null;
    const names=wiz.items.map(i=>{const p=partById(i.pid);return (i.qty>1?i.qty+' × ':'')+(p?p.name:i.pid);});
    const ide=pf?openLabel(pf):'';
    b.innerHTML=`<div style="font-size:20px;font-weight:600;margin-bottom:4px">🎉 Your project is ready</div><p style="margin:0 0 8px">Here is everything EvenUCan made for <b>${esc((it.analysis&&it.analysis.name)||'your gadget')}</b>. Download what you need:</p>
<ul style="list-style:none;padding:0;margin:0;font-size:14px" id="rdList">
<li style="margin:8px 0">📦 <b>Parts</b> (${names.length}): ${esc(names.join(', '))}. Powered by ${esc(POW_NAME[wiz.power]||POW_NAME.usb)}.<br><button id="rdParts">Download the parts list</button></li>
<li style="margin:8px 0">🏠 <b>Box</b>: ${box?'made, and in your drawing.<br><button id="rd3mf" class="primary">Download the box (3MF) for your 3D printer</button> <button id="rdStl">STL</button>':'not made (you skipped it).<br><button id="rdBox">Make the box now</button>'}</li>
<li style="margin:8px 0">🔌 <b>Wiring</b>: what wire goes where.<br><button id="rdWire">Download the wiring list</button></li>
<li style="margin:8px 0">💻 <b>Code</b>: ${c?esc(c.name)+'<br><button id="rdCode">Download the code</button> <button id="rdIde" class="primary">'+esc(ide)+'</button>':'not written yet.<br><button id="rdToCode">Write the code</button>'}</li></ul>`+
      ntfyBox(intentTopic())+'<div class="ewNote" style="margin-top:8px">Save your project (💾 Save at the top) to keep all of this together.</div>';
    f.innerHTML='<button id="iwRestart" class="linkBtn">Start again from the beginning</button><button id="rdBack">← Back to the code</button><button id="rdClose" class="primary">Close</button>';
  }
}
function openIntent(){
  iwBack.style.display='grid';iw.welcome=false;
  if((iw.step==='error'||WC_STEPS.includes(iw.step))&&!iw.busy)iw.step='ask';
  if(!iw.desc){const it=intentNow();if(it&&it.desc)iw.desc=it.desc;}
  renderIntent();
}
function closeIntent(){
  if(iw.welcome)WF.store.set('welcome_seen',iw.w.noShow?'1':'0');// (r4) "Don't show this when I open a new file"
  if(iw.step==='ready'){iw.step='result';gStep=null;}// (wizard-r2) the end of the guided path
  iwBack.style.display='none';updateStrip();
}
async function intentAnalyse(){
  const t=$('iwDesc'),desc=(t?t.value:iw.desc).trim();
  iw.desc=desc;iw.err='';
  if(desc.length<8){iw.err='Tell me a little more about what it should do (a sentence or two is plenty).';return renderIntent();}
  if(!aiKey()){iw.nokeyFrom='ask';iw.welcome=true;iw.step='nokey';return renderIntent();}// (1.9.37) a choice, not a dead end
  if(iw.busy)return;
  iw.busy=true;iw.step='busy';iw.prog=0;renderIntent();_cdStart('iwAiCd',aiProv()==='ollama'?300:60);
  try{
    let data=null;
    try{
      const _cl=iw.clarify||null;
      const _clNote=_cl?`\nUSER PREFERENCES (answered before this step):\n- Power: ${_cl.power==='battery'?'battery-powered — MANDATORY: you MUST include deep_sleep in every ESPHome config for this build (use the deep_sleep: component with a suitable sleep_duration); always select low-power components; in your explanation tell the user in plain English that you have set it up in battery-save mode so it will last as long as possible, that it will send a phone message when the battery is low, and that mains power is always simpler and more reliable if a cable can be run':_cl.power==='mains'?'mains adaptor (always-on)':'USB or mains adaptor (plugged in)'}\n- Phone alerts: ${_cl.phone?'yes — include ntfy notification support':'not needed'}\nFactor these into your parts selection and explanation.\n`:'';
      const text=INTENT_PROMPT+_clNote+(window.ownedPartsNote?ownedPartsNote():'')+'\n\nWhat the beginner wants:\n"""'+desc+'"""';
      // (PNA fix) Start the AI fetch and library load together so the Ollama fetch begins
      // immediately within Chrome's Private Network Access user-activation window — no await
      // before this point that could expire it. ensureLibraryReady() runs in parallel.
      const [{data:_d}]=await Promise.all([callAI(text),ensureLibraryReady()]);data=_d;
      if(!data||typeof data!=='object'||!Array.isArray(data.parts)||!data.parts.length)throw Object.assign(new Error('no parts list'),{intentParse:true});
    }catch(e){
      console.error('EvenUCan: project idea AI call failed',e);
      const isTimeout=e&&(e.name==='AbortError'||/abort|timed? ?out/i.test(e.message||''));
      const parse=e&&(e.intentParse||/garbled|didn't give sizes|couldn't read sizes/.test(e.message||''));
      iw.step='error';iw.err=parse?'Sorry, I couldn\'t understand the response — try rephrasing your idea.':isTimeout?'The AI didn\'t reply within 60 seconds.'+_otherAiHint()+' Check your internet connection or try again.':'The AI couldn\'t be reached: '+(e&&e.message||e)+' Check the key and the internet connection, then try again.';
      iw.raw=parse?aiLastReply:'';return;
    }
    iw.analysis=tidyIntent(data,desc);iw.prog=1;_cdStop();renderIntent();
    iw.pf=iw.analysis.platform;iw.override=false;iw.missingAdded=[];iw.vals={};
    if(iw.userPf&&PLATFORMS[iw.userPf]){iw.pf=iw.userPf;iw.override=iw.pf!==iw.analysis.platform;}iw.userPf=null;// (r4) the board they said they have
    iw.base=await intentMatch(iw.analysis.parts);iw.matches=pfMatches(iw.base,iw.pf);
    iw.power=(iw.base.find(m=>m.from==='power')||{}).power||'usb';iw.dropped=[];iw.edit=false;
    iw.step='result';
    if(iwBack.style.display!=='grid')WF.flash('Your parts list is ready: click 💡 What do I want to build? to see it',8000);
  }catch(e){console.error('EvenUCan: could not match the parts for the project idea',e);iw.step='error';iw.err='Something went wrong while finding the parts: '+(e&&e.message||e);iw.raw='';}
  finally{_cdStop();iw.busy=false;renderIntent();}
}
async function intentApply(){
  const A=iw.analysis,inputs={},pf=pfOk(iw.pf);
  if(capIssues(pf,iw.desc,A,iw.power,iw.dropped).some(c=>c.block))return WF.flash('First choose how to fix the problem shown in red.',6000);
  for(const el of $('iwBody').querySelectorAll('[data-iw]'))inputs[el.dataset.iw]=el.value.trim();
  // the phone topic is needed by the code even when it isn't shown (it was made for this project)
  if(!(iw.dropped||[]).includes('wifi')&&pf!=='arduino'&&A.extra_inputs_needed.some(x=>x.key==='ntfy_topic')&&!inputs.ntfy_topic)inputs.ntfy_topic=String((iw.vals||{}).ntfy_topic||intentDefault('ntfy_topic',A));
  if('owm_api_key' in inputs&&!inputs.owm_api_key&&!confirm('Without an OpenWeatherMap key the device can\'t get the weather. Carry on anyway? (You can add it later.)'))return;
  for(const k in inputs)WF.store.set('intent_inputs.'+k,inputs[k]);
  const prev=intentNow();
  WF.store.set(INTENT_KEY,JSON.stringify({desc:iw.desc,analysis:A,inputKeys:Object.keys(inputs),platform:pf,platformOverride:!!iw.override,missingAdded:iw.missingAdded||[],power:iw.power||'usb',dropped:iw.dropped||[]}));
  pfCode=null;pfMsg='';
  iw.step='busy';iw.prog=2;renderIntent();
  await new Promise(r=>setTimeout(r,30));
  // the Enclosure Wizard: just these parts (one line per part, with how many)
  const items=[];
  for(const m of iw.matches){if(!m.part)continue;const ex=items.find(i=>i.pid===m.part.id);if(ex)ex.qty=Math.min(10,ex.qty+1);else items.push({pid:m.part.id,qty:1,mount:'auto',wall:'auto'});}
  wiz.items=items;wiz.power=iw.power||'usb';saveWiz();lay=null;
  // the ESPHome answers: the device's name and the idea as its description (unless the user wrote their own)
  const f=esphForm();if(A.name)f.name=A.name;f.purpose='sensor';
  if(!f.desc||(prev&&f.desc===prev.desc))f.desc=iw.desc;
  WF.store.set(ESPH_KEY,JSON.stringify(f));
  if(wr)wr.ai=null;
  iw.prog=3;renderIntent();
  await new Promise(r=>setTimeout(r,30));
  const P=planWiring();let code=null;
  if(!P.error&&pf==='esphome'){try{code=esphomeYaml(P,esphForm());}catch(e){console.error('EvenUCan: could not write the ESPHome file for the project idea',e);}}
  // (wizard-r2) one path from here: the box first, with the guide saying what comes next
  iw.step='result';iw.edit=false;iwBack.style.display='none';gStep='box';openWizard();
  const names=items.map(i=>{const p=partById(i.pid);return (i.qty>1?i.qty+' × ':'')+(p?p.name:i.pid);});
  const list=names.length>1?names.slice(0,-1).join(', ')+' and '+names[names.length-1]:names[0]||'no parts';
  const missing=iw.matches.filter(m=>!m.part&&m.from!=='power'&&m.from!=='skip'&&m.from!=='removed').map(m=>m.spec.search);
  const msg=$('ewIntentMsg');
  msg.innerHTML=`<button class="x" id="ewIntentHide" title="Hide" style="float:right">✕</button><b>💡 I've set up your enclosure with ${esc(list)}${iw.power==='battery'?', running from a battery':iw.power==='mains'?', powered by a mains adapter':''}.</b> `+
    (P.error?`<span class="bad">${esc(P.error)}</span>`:code&&code.error?`<span class="bad">${esc(code.error)}</span>`:pf!=='esphome'?'The wiring is worked out for the '+esc(PLATFORMS[pf].name)+'; your AI writes the '+esc(PLATFORMS[pf].code)+' when you look at the code.':`The wiring is worked out${code&&code.weather?' and the ESPHome file already fetches the weather'+(intentWeather().topic?' and sends your daily message':''):''}.`)+
    (missing.length?` <span class="warn">Not found in the library: ${esc(missing.join(', '))}.</span>`:'')+
    '';
  msg.style.display='block';
}
// The code: the ESPHome tab of the Wiring window. Opens the tab only; user must click to start AI.
function intentCode(){
  wr=Object.assign(wr||{},{tab:'esphome'});openWiring();
  // Do NOT auto-start AI here — let the user click the button when ready.
  // (Previously pfGenerate() and esphWithAI() were called automatically here, but that
  //  caused AI to run before the user was ready and ignored any part errors shown on the page.)
}
// ---- (r4) Welcome: greets a new drawing and walks a beginner through their idea in the same window
// (steps welcome, w1 idea, w2 what it does, w3 what they have; then the wizard's own busy / result steps).
const WC_DOES=[
  {k:'screen',label:'Display information on a small screen',say:'show information on a small screen'},
  {k:'sound',label:'Make a sound (beep, buzzer)',say:'make a sound (beep or buzzer)'},
  {k:'led',label:'Light up an LED',say:'light up an LED'},
  {k:'phone',label:'Send me a message on my phone',say:'send me a message on my phone'},
  {k:'control',label:'Control something (motor, pump, relay)',say:'control something (a motor, pump or relay)'},
  {k:'quiet',label:'Just work quietly in the background',say:'just work quietly in the background'}];
const WC_PF={
  esphome:{label:'An ESP32 board',tip:'recommended, handles Wi-Fi',say:'an ESP32 board'},
  arduino:{label:'An Arduino',tip:'great for simple projects',say:'an Arduino'},
  raspberrypi:{label:'A Raspberry Pi',tip:'for more complex projects',say:'a Raspberry Pi'},
  auto:{label:'I\'m not sure — suggest the best one for me',tip:'',say:''}};
// chip label → the example idea (EXAMPLES) and the Step 2 boxes it ticks
const WC_EX=[['🚐 RV level checker','RV level checker',['screen','sound']],['🌤 Weather station','Weather station',['screen','phone']],
  ['🌱 Plant watering','Plant watering reminder',['led','phone']],['🚨 Motion alarm','Motion alarm',['sound','phone']],['🐾 Pet feeder','Pet feeder timer',['control']]];
const WC_STEPS=['welcome','w1','w2','w3','w4'];
const WC_MORE=['noai','nokey'];// (1.9.37) carry on without AI; no key yet: choose
// (wizard-r1) Step 4: the free program each board needs on this computer. id is what wfNative.checkTool() is asked about.
const WC_TOOL={
  esphome:{id:'esphome',name:'ESPHome Device Builder',url:'https://esphome.io/install/',btn:'Get ESPHome Device Builder — it\'s free',why:'puts the settings file EvenUCan writes onto your ESP32 board',
    steps:['Go to esphome.io/install and download the Desktop App.','Run the installer.','Open ESPHome Device Builder — it will set itself up.']},
  arduino:{id:'arduino',name:'Arduino IDE',url:'https://www.arduino.cc/en/software',btn:'Download Arduino IDE 2',why:'sends the sketch your AI writes onto the Arduino board',
    steps:['Go to arduino.cc/en/software and click Download.','Run the installer.','Click Next until it\'s done.']},
  raspberrypi:{id:'pi',name:'Thonny',url:'https://thonny.org/',btn:'Download Thonny — it\'s free',why:'opens and runs the Python program your AI writes',
    steps:['Go to thonny.org and download.','Run the installer.','Open Thonny.']}};
// iw.tc = {pf, st:'checking'|'found'|'missing'|'web', path, have}. The desktop app looks on disk; a web page can only
// see ESPHome (its dashboard answers on localhost:6052 while it runs), so for Arduino/Pi it asks instead.
function wcCheckTool(force){
  const pf=iw.w.pf,T=WC_TOOL[pf];if(!T)return;
  if(iw.tc&&iw.tc.pf===pf&&(iw.tc.st==='checking'||!force))return;
  const tc=iw.tc={pf,st:'checking',path:'',have:false};
  const done=(found,path)=>{if(iw.tc!==tc)return;tc.st=found?'found':'missing';tc.path=path||'';if(iwBack.style.display==='grid'&&iw.step==='w4')renderIntent();};
  if(window.wfNative&&window.wfNative.checkTool){
    Promise.resolve().then(()=>window.wfNative.checkTool(T.id)).then(r=>done(!!(r&&r.found),r&&r.path),e=>{console.warn('EvenUCan: could not check for '+T.name,e);done(false);});
  }else if(pf==='esphome'){
    let ac=null,t=null,signal;
    if(window.AbortSignal&&AbortSignal.timeout)signal=AbortSignal.timeout(2000);else{ac=new AbortController();signal=ac.signal;t=setTimeout(()=>ac.abort(),2000);}
    // no-cors: the dashboard sends no CORS headers; any answer at all means it's running
    fetch('http://localhost:6052/',{mode:'no-cors',cache:'no-store',signal}).then(()=>done(true,'http://localhost:6052'),()=>done(false)).finally(()=>clearTimeout(t));
  }else tc.st='web';
}
const wcSeen=()=>WF.store.get('welcome_seen')==='1';
// Steps 2 and 3 only add to the idea: with nothing ticked the AI gets just the Step 1 words.
function wcDesc(){
  const w=iw.w,text=w.text.trim(),does=WC_DOES.filter(d=>w.does.includes(d.k)).map(d=>d.say);
  if(!does.length&&w.pf==='auto')return text;
  return 'I want to build: '+text.replace(/[.!\s]+$/,'')+'.'+(does.length?' It should: '+does.join('; ')+'.':'')+(w.pf!=='auto'?' I have / prefer: '+WC_PF[w.pf].say+'.':'');
}
// What's on screen now goes back into iw.w before the step changes.
function wcKeep(){
  const b=$('iwBody'),t=$('wcDesc');if(t)iw.w.text=t.value;
  if(b.querySelector('[data-wdo]'))iw.w.does=[...b.querySelectorAll('[data-wdo]:checked')].map(e=>e.dataset.wdo);
  const r=b.querySelector('input[name="wcPf"]:checked');if(r)iw.w.pf=r.value;
  const n=$('wcNoShow');if(n)iw.w.noShow=n.checked;
}
const wcProg=n=>`<div class="ewNote" style="margin-bottom:6px">Step ${n} of ${WC_STEPS.length-1}</div>`;
function wcRender(){
  const win=$('iwWin'),welcome=iw.welcome;
  $('iwTitle').textContent=welcome?'👋 Welcome to EvenUCan':'🤔 What problem would you like to solve?';
  $('iwSub').textContent=welcome?'From idea to object: tell me about your gadget and I\'ll plan the parts, the box and the code.':'Plain words are fine — tell me what\'s giving you grief and I\'ll sort out the parts, the box and the code.';
  win.style.width=welcome&&iw.step!=='result'?'min(620px,calc(100vw - 20px))':'min(780px,calc(100vw - 20px))';
  const f=$('iwFoot');f.style.display='';
  if(!WC_STEPS.includes(iw.step)&&!WC_MORE.includes(iw.step))return false;
  const b=$('iwBody'),w=iw.w;let focus=null;
  if(iw.step==='welcome'){
    b.innerHTML=`<div style="text-align:center;padding:6px 4px 2px"><div style="font-size:22px;font-weight:600;margin-bottom:4px">👋 Hello! Welcome to EvenUCan</div>
<div style="font-size:15px;margin-bottom:10px">What would you like to do today?</div></div>${aiHelperBox()}<div style="text-align:center;padding:2px 4px">
<button id="wcIdea" class="primary wcBig"><span style="font-size:18px">💡 I have an idea for a gadget</span><br><span style="font-weight:400">Tell the AI helper what it should do: it picks the parts and writes the code</span></button>
<button id="wcNoAi" class="wcBig wcPlain" style="margin-top:8px"><span style="font-size:15px">🧰 Carry on without AI</span><br><span class="ewNote">Start from a ready-made example, or tick the parts you have</span></button>
<button id="wcGuide" class="wcBig wcPlain" style="margin-top:8px"><span style="font-size:15px">🧭 New here? Build my first project with a guide</span><br><span class="ewNote">I ring each button to click, from the idea to your board</span></button>
<div class="wcOr"><span>or</span></div>
<button id="wcDraw" class="wcBig wcPlain"><span style="font-size:15px">✏️ I want to draw something myself</span><br><span class="ewNote">(close this and use the drawing canvas)</span></button>
<div style="margin-top:12px;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:color-mix(in srgb,#7048e8 5%,var(--bg2));text-align:left"><b>🍳 New: Open Cookbook</b> — tick the parts you own at home, set quantities, then press <b>💡 What can I build?</b> and the AI suggests up to 6 projects you can start today. Find it in the <b>Tools</b> menu or the <b>🍳 Cookbook</b> button in the top bar.</div>
<label style="display:inline-flex;gap:6px;align-items:center;margin-top:16px"><input type="checkbox" id="wcNoShow"${w.noShow?' checked':''}> Don't show this when I open a new file</label>
<div class="ewNote" style="margin-top:4px">You can always come back with <b>💡 Start a project</b> at the top right.</div></div>`;
    f.style.display='none';f.innerHTML='';focus='wcIdea';
  }else if(iw.step==='w1'){
    b.innerHTML=wcProg(1)+`<div style="font-size:16px;font-weight:600;margin-bottom:6px">Great! Tell me about your gadget.</div>
<label for="wcDesc" style="font-weight:600;display:block;margin-bottom:4px">What should it do?</label>
<textarea id="wcDesc" rows="6" style="width:100%;box-sizing:border-box;font-size:14px;line-height:1.45;resize:vertical" placeholder="e.g. I want to know when my RV is level and beep when it is. Or: a weather station that shows the forecast on a little screen. Just describe it in your own words — there are no wrong answers!">${esc(w.text)}</textarea>
<div class="ewRow" style="margin-top:6px;flex-wrap:wrap;gap:6px"><span class="ewNote">Try an example:</span>${WC_EX.map(([l],k)=>`<button data-wex="${k}" style="border-radius:14px;padding:2px 10px">${esc(l)}</button>`).join('')}</div>
${iw.err?`<div class="bad" style="margin-top:8px">${esc(iw.err)}</div>`:''}`+
      (aiKey()?'':`<div class="ewNote" style="margin-top:8px"><span class="warn">The AI helper (${esc(PROVIDERS[aiProv()].name)}) needs a free key before it can plan this:</span> <button id="iwKey">${esc(keyLabel())}</button> or <button id="wcNoAi">Carry on without AI</button></div>`);
    f.innerHTML='<button id="wcBack1">← Back</button><button id="wcNext1" class="primary">Next →</button>';focus='wcDesc';
  }else if(iw.step==='w2'){
    b.innerHTML=wcProg(2)+`<fieldset style="border:none;padding:0;margin:0"><legend style="font-size:16px;font-weight:600;margin-bottom:8px;padding:0">What should it show or do when it's working?</legend>`+
      WC_DOES.map(d=>`<label style="display:flex;gap:8px;align-items:center;margin:7px 0;font-size:14px"><input type="checkbox" data-wdo="${d.k}"${w.does.includes(d.k)?' checked':''}> ${esc(d.label)}</label>`).join('')+
      `</fieldset><div class="ewNote" style="margin-top:6px">Optional: tick what you want, or just click Next and I'll work it out.</div>`;
    f.innerHTML='<button id="wcBack2">← Back</button><button id="wcNext2" class="primary">Next →</button>';focus='[data-wdo]';
  }else if(iw.step==='w3'){
    b.innerHTML=wcProg(3)+`<fieldset style="border:none;padding:0;margin:0"><legend style="font-size:16px;font-weight:600;margin-bottom:4px;padding:0">What equipment do you have?</legend>
<div class="ewNote" style="margin-bottom:6px">Or leave it on "not sure" and I'll suggest what to buy.</div>`+
      Object.entries(WC_PF).map(([k,p])=>`<label style="display:flex;gap:8px;align-items:center;margin:7px 0;font-size:14px"><input type="radio" name="wcPf" value="${k}"${w.pf===k?' checked':''}> ${esc(p.label)}${p.tip?` <span class="ewNote">← ${esc(p.tip)}</span>`:''}</label>`).join('')+
      `</fieldset>${iw.err?`<div class="bad" style="margin-top:8px">${esc(iw.err)}</div>`:''}`;
    f.innerHTML='<button id="wcBack3">← Back</button><button id="wcGo" class="primary">Let\'s go! →</button>';focus='input[name="wcPf"]:checked';
  }else if(iw.step==='w4'){
    // (wizard-r1) Step 4: is the software for this board on the computer? Next only once it is (or ticked on the web); Skip always works.
    const pf=iw.w.pf,T=WC_TOOL[pf],P=PLATFORMS[pf];
    if(!T){iw.step='w3';return wcRender();}
    wcCheckTool(false);
    const tc=iw.tc,desk=!!(window.wfNative&&window.wfNative.checkTool);
    const guide=`<a class="wcBig primary" href="${esc(T.url)}" target="_blank" rel="noopener">⬇ ${esc(T.btn)}</a>
<div style="font-weight:600;margin-top:6px">How to install it:</div><ol style="margin:4px 0 0;padding-left:22px;font-size:14px">${T.steps.map(x=>`<li style="margin:3px 0">${esc(x)}</li>`).join('')}</ol>`;
    let h=wcProg(4)+`<div style="font-size:16px;font-weight:600;margin-bottom:4px">Have you got the software for it?</div>
<div class="ewNote" style="margin-bottom:8px">${P.icon} ${esc(P.name)} needs <b>${esc(T.name)}</b> (free): it ${esc(T.why)}.</div>`;
    if(tc.st==='checking')h+=`<div style="font-size:14px;margin:12px 0" aria-live="polite"><span class="wcSpin">⟳</span> Checking your computer...</div>`;
    else if(tc.st==='found')h+=`<div class="ok" style="font-size:15px;margin:12px 0" aria-live="polite">✓ ${esc(T.name)} is ${desk?'installed and ready. We\'ll send your code straight to it when you\'re done.':'running on this computer and ready.'}</div>`+(tc.path?`<div class="ewNote">Found: ${esc(tc.path)}</div>`:'');
    else if(tc.st==='missing')h+=`<div class="warn" style="font-size:15px;margin:12px 0 4px" aria-live="polite">✗ I couldn't find ${esc(T.name)} on this computer${desk?'':' (it isn\'t running right now)'}.</div>
<div style="font-size:14px">No problem — it's free and only takes a few minutes to install.</div>${guide}`+
      (desk?'':`<div class="ewNote" style="margin-top:6px">Already installed? Open ${esc(T.name)} first so I can see it, then check again.</div>`)+
      `<div class="ewRow" style="margin-top:10px"><button id="wcRecheck4">I've installed it — check again</button></div>`;
    else h+=`<div style="font-size:14px;margin:8px 0">A web page can't see what's installed on your computer, so I can't check for you. If you haven't got it yet:</div>${guide}
<label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:14px"><input type="checkbox" id="wcHave4"${tc.have?' checked':''}> I've got ${esc(T.name)}</label>`;
    if(iw.err)h+=`<div class="bad" style="margin-top:8px">${esc(iw.err)}</div>`;
    b.innerHTML=h;
    const can=tc.st==='found'||(tc.st==='web'&&tc.have);
    f.innerHTML=`<button id="wcBack4">← Back</button><button id="wcSkip4">Skip for now →</button><button id="wcNext4" class="primary"${can?'':' disabled title="Install it first (or skip for now)"'}>Next →</button>`;
    focus=tc.st==='missing'?'wcRecheck4':tc.st==='web'?'wcHave4':can?'wcNext4':'wcSkip4';
  }
  else if(iw.step==='noai'){
    const ticked=iw.noai.parts,pf=iw.noai.pf;
    b.innerHTML=`<div style="font-size:16px;font-weight:600;margin-bottom:2px">🧰 Carry on without AI</div>
<div class="ewNote" style="margin-bottom:8px">Nothing is sent anywhere. You choose the parts; EvenUCan still designs the box, works out the wiring and writes the ESPHome code. For an Arduino board you get a starter sketch with the pins filled in, for you to finish.</div>
<div style="font-weight:600;margin:6px 0 4px">Start from a ready-made example:</div>
<div style="display:flex;flex-wrap:wrap;gap:6px">${NOAI_EX.map((x,k)=>`<button data-noex="${k}" title="${esc(x.what)}" style="text-align:left">${esc(x.label)}<br><span class="ewNote">${esc(x.what)}</span></button>`).join('')}</div>
<div style="font-weight:600;margin:12px 0 4px">Or tick the parts you want (from the built-in library):</div>
<div style="columns:2;column-gap:14px">${noaiChoices().map(c=>`<label style="display:flex;gap:6px;align-items:flex-start;margin:3px 0;break-inside:avoid"><input type="checkbox" data-noai="${esc(c.v)}"${ticked.includes(c.v)?' checked':''}> <span>${esc(c.name)}</span></label>`).join('')}</div>
<div class="ewNote">Not here? Add it later in <b>Tools → Parts library</b>.</div>
<fieldset style="border:none;padding:0;margin:10px 0 0"><legend style="font-weight:600;padding:0;margin-bottom:4px">Which board?</legend>${Object.entries(PLATFORMS).map(([k,P])=>`<label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="radio" name="noaiPf" value="${k}"${pf===k?' checked':''}> ${P.icon} ${esc(P.name)} <span class="ewNote">(${esc(P.code)})</span></label>`).join('')}</fieldset>
${iw.err?`<div class="bad" style="margin-top:8px">${esc(iw.err)}</div>`:''}`;
    f.innerHTML='<button id="wcNoAiBack">← Back</button><button id="wcNoAiGo" class="primary">Next: check the parts →</button>';focus='[data-noex]';
  }else if(iw.step==='nokey'){
    b.innerHTML=`<div style="font-size:16px;font-weight:600;margin-bottom:6px">The AI helper needs a key first</div>
<div style="font-size:14px;margin-bottom:10px">To turn your idea into a parts list, EvenUCan asks a free online AI, and that needs a key (a kind of password from the AI company). Getting one takes about two minutes and costs nothing.</div>
${aiHelperBox(true)}
<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px"><button id="nkKey" class="primary wcBig"><span style="font-size:15px">🔑 Set up a free key now</span><br><span style="font-weight:400">then I'll carry on with your idea</span></button>
<button id="wcNoAi" class="wcBig wcPlain"><span style="font-size:15px">🧰 Carry on without AI</span><br><span class="ewNote">pick a ready-made example or tick the parts yourself</span></button></div>`;
    f.innerHTML='<button id="nkBack">← Back</button>';focus='nkKey';
  }
  setTimeout(()=>{const el=focus&&(focus[0]==='['||focus.includes(':')?b.querySelector(focus):$(focus));if(el&&iwBack.style.display==='grid')el.focus();},0);
  return true;
}
// (1.9.37) "About the AI helper": honest about what is sent where, which keys work, and whether one is set up.
function aiHelperBox(short){
  const desk=!!(window.wfNative&&window.wfNative.aiPost),has=!!aiKey(),P=PROVIDERS[aiProv()];
  return `<div class="aiHelp" style="border:1px solid #c9d7ea;background:#f4f8fd;border-radius:8px;padding:8px 10px;margin:4px 0 10px;font-size:13px;line-height:1.5">
<div style="font-weight:600;font-size:14px">🤖 About the AI helper</div>
${short?'':'<div>When you describe an idea, an AI turns it into a parts list and writes the Arduino sketch. EvenUCan has no AI of its own: use a free key, a paid key, or a model running on this computer with Ollama if you\'d rather stay fully offline.</div>'}
<div style="font-size:12px;color:var(--text2);margin:6px 0 2px;font-weight:600">Free keys (no credit card needed):</div>
<div class="ewRow" style="flex-wrap:wrap;gap:6px;margin:0 0 8px"><button id="wcAiGem">🆓 Google Gemini</button><button id="wcAiNv"${desk?'':' disabled title="NVIDIA only works in the EvenUCan desktop app"'}>🆓 NVIDIA${desk?'':' (desktop app only)'}</button><button id="wcAiGroq">🆓 Groq</button><button id="wcAiOr">🆓 OpenRouter</button><button id="wcAiOllama">🆓 Ollama (offline)</button></div>
<div style="font-size:12px;color:var(--text2);margin:2px 0 2px;font-weight:600">Paid keys (very cheap, most capable):</div>
<div class="ewRow" style="flex-wrap:wrap;gap:6px;margin:0 0 4px"><button id="wcAiCl">💳 Claude (Anthropic)</button><button id="wcAiOa">💳 ChatGPT (OpenAI)</button><button id="wcAiDs">💳 DeepSeek</button><button id="wcAiGrok">💳 Grok (xAI)</button></div>
<div class="ewNote">${desk?'':' NVIDIA keys need the EvenUCan desktop app, because NVIDIA doesn\'t accept requests from web pages.'} Paid keys cost a fraction of a cent per run — DeepSeek is the cheapest.</div>
<div style="margin-top:4px">${has?`<span class="ok">✓ Your ${esc(P.name)} key is set up.</span> <button id="wcAiTest">Test or change it...</button>`:'<span class="warn">No AI key is set up yet.</span> You can set one up now or later.'}</div>
<div class="ewNote" style="margin-top:4px">What you type about your idea is sent to that company (Google, NVIDIA, Groq, OpenRouter or Anthropic) to plan it - except Ollama, which runs on this computer and sends nothing anywhere. Free keys have limits (a number of requests a minute or a day; OpenRouter's free tier is only about 50 a day): if it says it's busy, wait a minute and try again. The drawing, box design, wiring and ESPHome code don't need the AI or the internet.</div></div>`;
}
// (1.9.37) Carry on without AI: ready-made examples (common modules and built-in parts, no look-up needed)
const NOAI_EX=[
  {label:'🚐 Level checker',what:'Screen, beeper and tilt sensor; Arduino IDE on an ESP32',pf:'esp32ide',name:'level-checker',parts:['cm:p-cm-ssd1306','cm:p-cm-buzzer','cm:p-cm-mpu6050'],desc:'A level checker: shows the tilt on a small screen and beeps when it is level.'},
  {label:'🌡 Room climate display',what:'Temperature, humidity and pressure on a small screen; ESPHome',pf:'esphome',name:'room-climate',parts:['cm:p-cm-bme280','cm:p-cm-ssd1306'],desc:'Shows the room temperature, humidity and pressure on a small screen and reports them to Home Assistant.'},
  {label:'🚶 Motion alarm',what:'Motion sensor, beeper and a coloured light; ESPHome',pf:'esphome',name:'motion-alarm',parts:['cm:p-cm-pir','cm:p-cm-buzzer','cm:p-cm-ws2812'],desc:'Beeps and lights up when someone walks past.'},
  {label:'💧 Leak alarm',what:'Water sensor and beeper; ESPHome',pf:'esphome',name:'leak-alarm',parts:['cm:p-cm-water','cm:p-cm-buzzer'],desc:'Beeps when the water sensor gets wet.'},
  {label:'💡 Light-controlled lamp',what:'Light sensor, coloured light and a button; Arduino Nano',pf:'arduino',name:'night-light',parts:['cm:p-cm-bh1750','cm:p-cm-ws2812','cm:p-cm-button'],desc:'A night light that turns on when it gets dark, with a button to switch it.'}
];
// the parts to tick: the common modules, then the built-in parts that aren't boards or power
function noaiChoices(){
  const out=COMMON_MODS.map(m=>({v:'cm:'+m.part.id,name:m.part.name}));
  for(const p of allParts())if(p.builtin&&!CTRL_IDS.includes(p.id)&&!p.mcu&&!/^p-cm-/.test(p.id)&&!['b-tp4056c','b-lipo1000','b-18650','b-ss12'].includes(p.id))out.push({v:'p:'+p.id,name:p.name});
  return out;
}
function noaiPart(v){
  if(v.startsWith('cm:')){const m=COMMON_MODS.find(m=>m.part.id===v.slice(3));return m?commonPart(m):null;}
  return partById(v.slice(2));
}
// Sets the wizard up exactly as if the AI had answered, from the parts chosen here (then: check the parts → box → wiring → code).
function noaiPlan(vals,pf,name,desc){
  const parts=vals.map(noaiPart).filter(Boolean);
  if(!parts.length){iw.err='Tick at least one part, or pick an example.';return renderIntent();}
  iw.desc=desc||('My gadget with: '+parts.map(p=>p.name).join(', ')+'.');
  iw.analysis=tidyIntent({name:name||'my-gadget',summary:'Parts picked without AI.',platform:pf,parts:[]},iw.desc);iw.analysis.noAI=true;
  iw.pf=pfOk(pf);iw.override=false;iw.missingAdded=[];iw.vals={};iw.userPf=null;
  iw.base=parts.map(part=>({spec:{category:'added',function:'picked by you',search:part.name,required:true},part,from:'your choice',note:''}));
  iw.matches=pfMatches(iw.base,iw.pf);iw.power='usb';iw.dropped=[];iw.edit=false;iw.err='';iw.step='result';
  renderIntent();
}
function noaiKeep(){
  const b=$('iwBody');if(!b.querySelector('[data-noai]'))return;
  iw.noai.parts=[...b.querySelectorAll('[data-noai]:checked')].map(e=>e.dataset.noai);
  const r=b.querySelector('input[name="noaiPf"]:checked');if(r)iw.noai.pf=r.value;
}
// auto: only on a fresh, empty drawing, and not if the user asked for it not to show again
function openWelcome(auto){
  if(auto&&(wcSeen()||!WF.docEmpty||[ewBack,plBack,wrBack,iwBack].some(x=>x.style.display==='grid')))return;
  if(iw.step==='result'&&!iw.busy)iw.w={text:'',does:[],pf:'auto',noShow:false};// a finished idea: start the next one afresh
  if(iw.step==='nokey'&&!iw.busy)iw.step='ask';
  iw.welcome=false;iw.w.noShow=wcSeen();iw.err='';
  if(!iw.busy)iw.step='ask';
  iwBack.style.display='grid';renderIntent();
}
async function wcGo(){
  wcKeep();iw.err='';
  if(!aiKey()){iw.nokeyFrom='wc';iw.step='nokey';return renderIntent();}// (1.9.37) a choice, not a dead end
  iw.desc=wcDesc();iw.userPf=iw.w.pf==='auto'?null:iw.w.pf;
  await intentAnalyse();
}
iwBack.addEventListener('click',e=>{
  const el=e.target.closest('button');if(!el||!iwBack.contains(el))return;
  const go=s=>{wcKeep();iw.err='';iw.step=s;renderIntent();};
  const run=()=>wcGo().catch(err=>{console.error('EvenUCan: the welcome idea could not be planned',err);iw.step='error';iw.err='Something went wrong: '+(err.message||err);renderIntent();});
  if(el.dataset.noex!==undefined){const x=NOAI_EX[+el.dataset.noex];if(x){iw.noai={parts:[...x.parts],pf:x.pf};noaiPlan(x.parts,x.pf,x.name,x.desc);}return;}
  if(el.dataset.wex!==undefined){const x=WC_EX[+el.dataset.wex];if(!x)return;wcKeep();iw.w.text=EXAMPLES[x[1]]||'';iw.w.does=[...x[2]];
    const t=$('wcDesc');if(t){t.value=iw.w.text;t.focus();}WF.flash('Filled in the example, and ticked what it does in Step 2',3500);return;}
  switch(el.id){
    case 'wcIdea':go('w1');break;
    case 'wcGuide':coachStart();break;
    case 'wcDraw':wcKeep();closeIntent();break;
    case 'wcNoAi':wcKeep();iw.welcome=true;iw.err='';iw.step='noai';renderIntent();break;
    case 'wcNoAiBack':noaiKeep();go('welcome');break;
    case 'wcNoAiGo':noaiKeep();iw.err='';noaiPlan(iw.noai.parts,iw.noai.pf,'','');break;
    case 'wcAiGem':askKey('gemini').then(renderIntent);break;
    case 'wcAiNv':askKey('nvidia').then(renderIntent);break;
    case 'wcAiGroq':askKey('groq').then(renderIntent);break;
    case 'wcAiOr':askKey('openrouter').then(renderIntent);break;
    case 'wcAiOllama':askKey('ollama').then(renderIntent);break;
    case 'wcAiCl':askKey('claude').then(renderIntent);break;
    case 'wcAiOa':askKey('openai').then(renderIntent);break;
    case 'wcAiDs':askKey('deepseek').then(renderIntent);break;
    case 'wcAiGrok':askKey('grok').then(renderIntent);break;
    case 'wcAiTest':askKey(aiProv()).then(renderIntent);break;
    case 'nkKey':askKey().then(()=>{if(!aiKey())return renderIntent();if(iw.nokeyFrom==='ask'){iw.welcome=false;iw.step='ask';intentAnalyse();}else run();});break;
    case 'nkBack':iw.err='';if(iw.nokeyFrom==='ask'){iw.welcome=false;iw.step='ask';renderIntent();}else go('w3');break;
    case 'wcBack1':go('welcome');break;
    case 'wcNext1':wcKeep();if(iw.w.text.trim().length<8){iw.err='Tell me a little about what it should do first (a sentence or two is plenty), or pick an example.';renderIntent();}else go('w2');break;
    case 'wcBack2':go('w1');break;
    case 'wcNext2':go('w3');break;
    case 'wcBack3':go('w2');break;
    case 'wcGo':wcKeep();if(WC_TOOL[iw.w.pf])go('w4');else run();break;// (wizard-r1) a chosen board: check its software first
    case 'wcBack4':go('w3');break;
    case 'wcSkip4':run();break;
    case 'wcNext4':if(!el.disabled)run();break;
    case 'wcRecheck4':iw.err='';wcCheckTool(true);renderIntent();break;
    case 'rdParts':WF.download(readySlug()+'-parts.txt',readyParts(),'text/plain');break;
    case 'rdStl':downloadBox('stl');break;
    case 'rd3mf':downloadBox('3mf');break;
    case 'rdBox':closeIntent();gStep='box';openWizard();break;
    case 'rdWire':WF.download(readySlug()+'-wiring.txt',readyWiring(),'text/plain');break;
    case 'rdCode':{const c=currentCode();if(c)WF.download(c.name,c.text,'text/plain');break;}
    case 'rdIde':openInIde();break;
    case 'rdToCode':case 'rdBack':iw.step='result';iwBack.style.display='none';guideGo('code');break;
    case 'rdClose':closeIntent();break;
  }
});
iwBack.addEventListener('change',e=>{if(e.target.id==='wcNoShow')iw.w.noShow=e.target.checked;
  else if(e.target.id==='wcHave4'){if(iw.tc)iw.tc.have=e.target.checked;const n=$('wcNext4');if(n){n.disabled=!e.target.checked;n.title=n.disabled?'Install it first (or skip for now)':'';}}});
// Keyboard: Tab stays inside the window, Ctrl+Enter in the idea box is Next (Esc closes, as for every window).
iwBack.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&e.target.id==='wcDesc'){e.preventDefault();$('wcNext1').click();return;}
  if(e.key!=='Tab')return;
  const els=[...iwBack.querySelectorAll('button,input,textarea,select,a[href]')].filter(x=>!x.disabled&&x.offsetParent!==null);
  if(!els.length)return;const a=els[0],z=els[els.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}
});
$('ewIntent').onclick=openIntent;
$('bBuild').onclick=()=>openWelcome(false);
$('bCookbook').onclick=()=>openCookbook();
$('bProjects').onclick=()=>{openIntent();setTimeout(()=>{const panel=$('ewProjPanel');if(panel){panel.style.display='block';ewProjRender();setTimeout(()=>{const inp=$('ewProjName');if(inp)inp.focus();},50);}},50);};
$('iwX').onclick=closeIntent;
$('iwFoot').addEventListener('click',e=>{
  const id=e.target.id;
  if(id==='iwGo'){const t=$('iwDesc');if(t)iw.desc=t.value.trim();if(iw.desc.length<8){iw.err='Tell me a little more (a sentence or two is plenty).';return renderIntent();}iw.err='';iw.step='clarify';renderIntent();}
  else if(id==='iwClBack'){iw.step='ask';iw.err='';renderIntent();}
  else if(id==='iwClGo'){const r=$('iwBody').querySelector('input[name="iwClPow"]:checked');const ph=$('iwClPhone');iw.clarify={power:r?r.value:'usb',phone:ph?ph.checked:true};intentAnalyse();}
  else if(id==='iwRetry')intentAnalyse();
  else if(id==='iwCancel')closeIntent();
  else if(id==='iwEdit'){iw.step=iw.analysis&&iw.analysis.noAI?'noai':iw.welcome?'w1':'ask';if(iw.step==='noai')iw.welcome=true;iw.err='';renderIntent();}
  else if(id==='iwAgain'){iwKeepVals();iw.edit=!iw.edit;renderIntent();if(iw.edit){const h=$('iwEditor');if(h)h.scrollIntoView({block:'nearest'});const sel=$('iwAddSearch');if(sel)sel.focus();}}// (wizard-r2) change the parts, not the idea
  else if(id==='iwRestart')guideRestart();
  else if(id==='iwApply')intentApply().catch(err=>{console.error('EvenUCan: could not set up the project idea',err);iw.step='error';iw.err='Could not set up the enclosure: '+(err.message||err);iw.raw='';renderIntent();});
});
let _iwLib=null,_iwLibSrc=null,_iwPick={},_iwSearchTimer=0;
async function iwLibList(){
  if(_iwLib&&_iwLib.length)return _iwLib;
  try{const src=await partsSource(false);if(src){_iwLibSrc=src;partsSrc=src;_iwLib=await src.list();}}catch(e){console.warn('EvenUCan: could not open the parts library for the parts search',e);}
  if(!_iwLib||!_iwLib.length){_iwLib=[];} // JSON databases disconnected; AI lookup used at search time
  return _iwLib||[];
}
function iwOwnList(){
  return COMMON_MODS.map((m,i)=>({v:'cm:'+i,title:m.part.name,family:'Common module',tags:[m.part.type],desc:''}))
    .concat(allParts().filter(p=>!CTRL_IDS.includes(p.id)).map(p=>({v:'p:'+p.id,title:p.name,family:p.builtin?'Built-in part':'Your parts',tags:[p.type],desc:String(p.notes||'').slice(0,300)})));
}
async function iwAddSearchRun(q){
  try{await iwLibList();}catch(e){console.warn('EvenUCan: the ready-made parts could not be listed',e);}
  const box=$('iwAddResults');if(!box)return;
  const now=$('iwAddSearch');if(!now||now.value.trim()!==q)return;
  const own=searchParts(iwOwnList(),q,'all').slice(0,40),ready=searchParts(_iwLib||[],q,'all').slice(0,60);
  const row=(v,t,sub)=>`<div class="iwAddRow" data-v="${esc(v)}" style="display:flex;align-items:center;gap:8px;padding:4px 10px;cursor:pointer;border-bottom:1px solid color-mix(in srgb,var(--line) 45%,transparent)"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${esc(t)}</b> <span class="ewNote">${esc(sub)}</span></span><span class="ewNote">click to add</span></div>`;
  let html='';
  if(own.length)html+='<div class="ewNote" style="padding:5px 10px 1px"><b>Your parts</b></div>'+own.map(h=>row(h.v,h.title,h.family)).join('');
  if(ready.length)html+='<div class="ewNote" style="padding:5px 10px 1px"><b>Ready-made parts library</b></div>'+ready.map(h=>row(h._pick?'__pick:'+h._pick:'libid:'+h.id,h.title,h._src||(h.family||''))).join('');
  // AI parts search (databases disconnected — AI used instead)
  html+='<div class="ewNote" style="padding:5px 10px 1px"><b>AI Parts Search</b></div>'+row('__ailookup:'+q,aiKey()?'🤖 Look up "'+q+'" with AI…':'🤖 AI parts search',aiKey()?'asks your AI for sizes and pins (approximate)':'set up an AI key first — click "AI helper key…" above');
  box.innerHTML=html;
}
async function iwAddPick(v){
  iwKeepVals();
  let part=null,from='your choice';
  try{
    if(v.startsWith('cm:'))part=commonPart(COMMON_MODS[+v.slice(3)]);
    else if(v.startsWith('p:'))part=partById(v.slice(2));
    else if(v.startsWith('libid:')){
      if(!_iwLibSrc){const src=await partsSource(false);if(src){_iwLibSrc=src;partsSrc=src;}}
      if(!_iwLibSrc)return WF.flash('The ready-made parts library isn\'t loaded. Open Parts → Browse parts… once, then try again.',7000);
      part=await importLibPart(_iwLibSrc,v.slice(6));if(part)from='parts library';
    }else if(v.startsWith('__pick:')){
      const raw=_iwPick[v.slice(7)];
      if(raw){part=lookupToPart(_dbToLookupData(raw,raw.title||''),raw.title||'');part.source=raw._src||'';
        part.notes='Pin positions and board size from '+(raw._src||'the parts library')+'. Component height is estimated at '+part.h+' mm — check yours.';
        custom.push(part);if(!saveLib()){custom.pop();part=null;}else from=raw._src||'parts library';}
    }else if(v.startsWith('__ailookup:')){
      const q=v.slice(11);
      if(!aiKey()){await askKey();if(!aiKey())return WF.flash('Set up an AI key first — click "AI helper key…" in the menu.',5000);}
      // Step 1: verify the part fully (pins + dimensions) and store in Parts Library
      WF.flash('Verifying "'+q+'" — checking pins and dimensions…',10000);
      const dbRec=await verifyPartWithAI(q);
      // Step 2: also get the layout data for the EvenUCan enclosure (LOOKUP_PROMPT gives x/y coords)
      WF.flash('Asking AI for layout data…',8000);
      const {data:d}=await callAI(LOOKUP_PROMPT+'\n\nThe part: "'+q+'"\nWhat it does: a hobby electronics module.');
      if(!d||typeof d!=='object')throw new Error('garbled: no part data');
      if(d.unknown)return WF.flash('The AI doesn\'t know this part: '+(d.notes||'try a more specific name.'),6000);
      if(!(parseFloat(d.width_mm)>0)||!(parseFloat(d.height_mm)>0))throw new Error('garbled: no sizes');
      // If we got better dimensions from the verify step, use those
      if(dbRec&&dbRec.dimensions&&dbRec.dimension_status!=='UNVERIFIED'){
        const dim=dbRec.dimensions;
        if(dim.length_mm>0){d.width_mm=dim.length_mm;d.height_mm=dim.width_mm;d.depth_mm=dim.height_mm;}
      }
      part=lookupToPart(d,q);
      // Carry dimension status into the part notes
      if(dbRec){
        if(dbRec.dimension_status==='UNVERIFIED'){
          part.notes=(part.notes||'')+'\n⚠ DIMENSIONS UNVERIFIED: measure this part and update it in Parts Library before printing an enclosure.';
          part.approximate=true;
        } else if(dbRec.dimension_status==='ESTIMATED'){
          part.notes=(part.notes||'')+'\n⚠ Dimensions estimated — confirm in Parts Library for a perfect fit.';
          part.approximate=true;
        }
      }
      custom.push(part);if(!saveLib()){custom.pop();return WF.flash('Couldn\'t save the part.',4000);}
      from='AI lookup';
      if(dbRec&&dbRec.dimension_status==='UNVERIFIED'){
        WF.flash('⚠ Added "'+part.name+'" — dimensions unknown. Measure it and update Parts Library.',8000);
      } else {
        WF.flash('Added "'+part.name+'" to your library'+(dbRec?' ('+dbRec.dimension_status.toLowerCase()+' dimensions)':' (approximate)'),5000);
      }
    }
  }catch(err){console.error('EvenUCan: could not add the chosen part',err);return WF.flash('Couldn\'t add that part: '+(err.message||err),7000);}
  if(!part)return WF.flash('Couldn\'t add that part.',5000);
  iw.base.push({spec:{category:'added',function:'added by you',search:part.name,required:true},part,from,note:''});
  iw.matches=pfMatches(iw.base,iw.pf);renderIntent();WF.flash('Added '+part.name,3000);
}
$('iwBody').addEventListener('click',e=>{
  const rowEl=e.target.closest('.iwAddRow');
  if(rowEl)return iwAddPick(rowEl.dataset.v||'');
  const el=e.target.closest('button');if(!el)return;
  if(el.id==='iwKey')askKey().then(renderIntent);
  else if(el.dataset.ex){iw.desc=EXAMPLES[el.dataset.ex]||'';const t=$('iwDesc');if(t){t.value=iw.desc;t.focus();}}
  else if(el.dataset.pf){iwKeepVals();intentSetPf(el.dataset.pf);}
  else if(el.dataset.look!==undefined){iwKeepVals();lookupPart(+el.dataset.look);}
  else if(el.dataset.capfix){iwKeepVals();const a=el.dataset.capfix;
    if(PLATFORMS[a])intentSetPf(a);
    else{if(/^drop-/.test(a))iw.dropped=[...new Set([...(iw.dropped||[]),a.slice(5)])];else if(/^pow-/.test(a))iw.power=a.slice(4);renderIntent();}}
  else if(el.dataset.iwdel!==undefined){iwKeepVals();const k=+el.dataset.iwdel;if(k>0&&iw.base[k-1]){iw.base.splice(k-1,1);iw.matches=pfMatches(iw.base,iw.pf);renderIntent();}}
});
$('iwBody').addEventListener('change',e=>{if(e.target.name==='iwPow'){iwKeepVals();iw.power=e.target.value;renderIntent();}});
$('iwBody').addEventListener('input',e=>{const t=e.target;
  if(t.id==='iwSsid')wifiMem.ssid=t.value;else if(t.id==='iwPass')wifiMem.pass=t.value;
  else if(t.id==='iwAddSearch'){clearTimeout(_iwSearchTimer);const q=t.value.trim();
    _iwSearchTimer=setTimeout(async()=>{const box=$('iwAddResults');if(!box)return;
      if(!q){box.innerHTML='<div class="ewNote" style="padding:6px 8px">Type above to search your own parts and the full ready-made library.</div>';return;}
      box.innerHTML='<div class="ewNote" style="padding:6px 8px">Searching…</div>';
      try{await iwAddSearchRun(q);}catch(err){console.error('EvenUCan: parts search failed',err);}
    },200);}
  else if(t.dataset.iw==='ntfy_topic'){iw.vals.ntfy_topic=t.value;const box=$('iwBody').querySelector('.ntfyBox');if(box){box.querySelector('.topic').textContent=t.value.trim();box.querySelector('[data-copytext]').dataset.copytext=t.value.trim();}}});
$('iwBody').addEventListener('keydown',e=>{if(e.target.id==='iwDesc'&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)){const desc=(e.target.value||'').trim();if(desc.length>=8){iw.desc=desc;iw.err='';iw.step='clarify';renderIntent();}else{iw.err='Tell me a little more (a sentence or two is plenty).';renderIntent();}}});
$('ewIntentMsg').addEventListener('click',e=>{if(e.target.id==='ewIntentHide')$('ewIntentMsg').style.display='none';else if(e.target.id==='ewIntentCode')intentCode();});

