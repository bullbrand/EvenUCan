// EvenUCan AI helpers and Surgery - 08-part-database-search.js
// One of the files in js/ai/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- Part-database search helpers (Fritzing / Eagle / KiCad JSON files) ----
const _EW_DB={};
const _loadDb=async function _loadDb(key,url){
  if(key in _EW_DB)return _EW_DB[key];
  try{const r=await fetch(url);if(!r.ok)throw 0;const j=await r.json();return(_EW_DB[key]=j.parts||[]);}
  catch(e){return(_EW_DB[key]=null);}
};
const _dbScore=function _dbScore(entry,q){
  const words=q.toLowerCase().split(/\W+/).filter(w=>w.length>1);
  if(!words.length)return 0;
  const hay=[entry.title,(entry.info&&entry.info.title),(entry.info&&entry.info.description),(Array.isArray(entry.info&&entry.info.tags)?entry.info.tags.join(' '):''),(entry.info&&entry.info.family)].filter(Boolean).join(' ').toLowerCase();
  const full=words.join(' ');if(hay.includes(full))return 1000;
  return words.reduce((s,w)=>s+(hay.includes(w)?1:0),0);
};
const _dbClean=function _dbClean(t){return String(t||'').replace(/_h\d_|__h\d_/g,'').trim();};
const _dbPinRole=function _dbPinRole(n){
  const v=String(n||'').toLowerCase().trim();
  if(/^gnd$|^ground$|^vss$/.test(v))return 'ground';
  if(/^vcc$|^vdd$|^vin$|^v\+$|^5v$|^3\.?3v?$|^power$/.test(v))return 'power';
  if(/sda/.test(v))return 'i2c_sda';
  if(/scl/.test(v))return 'i2c_scl';
  if(/^nc$|^noc$|unused|not.?conn/.test(v))return 'unused';
  return 'signal';
};
const _dbToLookupData=function _dbToLookupData(entry,q){
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
};
const lookupPart=async function lookupPart(i){
  const m=iwAi.matches&&iwAi.matches[i];if(!m||m.part||m.looking||m.ctrl)return;
  const q=m.spec.search;
  if(!aiKeyAi()){await askKeyAi();if(!aiKeyAi())return WFAi.flash('Set up a key for your AI first.',5000);}
  const go=await askHtmlAi(`<div class="kHead"><b>🔍 Look up "${escAi(q)}"?</b></div><p class="u-m0-8">EvenUCan will search your parts library first, then its built-in databases (Fritzing, Eagle and KiCad), then ask its AI if nothing is found.</p>`+
    `<p class="ewNote" style="margin:0">If the AI is asked, one request goes to ${escAi(PROVIDERSAi[aiProvAi()].name)} with only the part's name and what it is for. No personal data is sent.</p>`,['Cancel','Search for it'],1);
  if(go!==1)return;
  m.looking=true;m.lookErr='';m.lookStage='Searching your parts…';renderIntentAi();
  let d=null,dbSrc='';
  // Stage 0: search the user's own custom parts library first
  {
    const qWords=q.toLowerCase().split(/\W+/).filter(w=>w.length>1);
    const minSc=Math.max(1,Math.ceil(qWords.length*0.6));
    let best=null,bestSc=0;
    for(const p of (customAi||[])){
      const hay=[p.name,p.category,p.protocol,p.voltage,(p.pins||[]).map(x=>x.n).join(' ')].filter(Boolean).join(' ').toLowerCase();
      const full=qWords.join(' ');
      let sc=hay.includes(full)?1000:qWords.reduce((s,w)=>s+(hay.includes(w)?1:0),0);
      if(sc>bestSc){bestSc=sc;best=p;}
    }
    if(best&&bestSc>=minSc){
      m.looking=false;m.lookStage='';m.part=partByIdAi(best.id);m.from='your library';m.note='';
      WFAi.flash('"'+best.name+'" is already in your parts library.',4000);
      renderIntentAi();return;
    }
  }
  // Parts databases disconnected — AI search used directly.
  if(!d){
    m.lookStage='Asking your AI…';renderIntentAi();
    try{
      ({data:d}=await callAI(LOOKUP_PROMPT+'\n\nThe part: "'+q+'"\nWhat it does in the project: '+m.spec.function));
      if(!d||typeof d!=='object')throw new Error('garbled: no part data');
      if(d.unknown){m.looking=false;m.lookStage='';m.lookErr='Your AI doesn\'t know this part'+(d.notes?': '+String(d.notes).slice(0,200):'.')+' Add it yourself with Parts Library….';renderIntentAi();return;}
      if(!(parseFloat(d.width_mm)>0)||!(parseFloat(d.height_mm)>0))throw new Error('garbled: no sizes');
    }catch(e){console.error('EvenUCan: part lookup failed for "'+q+'"',e);m.looking=false;m.lookStage='';m.lookErr=/garbled/.test(e.message||'')?'Sorry, the AI\'s answer couldn\'t be read. Try again, or add the part yourself.':'The AI couldn\'t be reached: '+(e.message||e);renderIntentAi();return;}
  }
  m.looking=false;m.lookStage='';if(iwAi.step==='result')renderIntentAi();
  const part=lookupToPart(d,q);
  if(dbSrc){part.source=dbSrc;part.notes='Pin positions and board size from '+dbSrc+'. Component height is estimated at '+part.h+' mm — check yours.'+(d.notes?'\n'+d.notes.slice(0,300):'');}
  const pinTxt=part.pins.length?part.pins.map(p=>escAi(p.n)+' <span class="ewNote">('+escAi(ROLE_TXT[p.r]||p.r)+')</span>').join(', '):'<span class="warn">none given: add them in Parts before wiring</span>';
  const ok=await askHtmlAi(`<div class="kHead"><b>🔍 ${escAi(part.name)}</b></div>`+
    (dbSrc?`<div class="u-mb-4 ewNote">Found in ${escAi(dbSrc)}</div>`:'')+
    `<div><b>Size:</b> ${part.w} × ${part.d} mm${dbSrc?', component height estimated':`, ${part.h} mm tall`}</div><div><b>Pins (${part.pins.length}):</b> ${pinTxt}</div>`+
    (part.protocol||part.i2c_address?`<div><b>Protocol:</b> ${escAi(part.protocol||'?')}${part.i2c_address?', I2C address '+escAi(part.i2c_address):''}</div>`:'')+
    (part.voltage?`<div><b>Voltage:</b> ${escAi(part.voltage)}</div>`:'')+`<div><b>Mounting holes:</b> ${part.features.filter(x=>x.t==='hole').length}, <b>openings for sockets:</b> ${part.features.filter(x=>x.t==='port').length}</div>`+
    (dbSrc?`<div class="u-mt-8 ewNote">Board dimensions and pin positions are from the library. Component height is estimated — check yours before printing.</div>`:`<div class="u-mt-8 warn">⚠️ Approximate: this comes from the AI's memory, not from a datasheet or a measurement. Check the size and the pin order against your own part before you print or wire.</div>`)+
    (d.notes?`<div class="u-mt-6 ewNote">${escAi(String(d.notes).slice(0,400))}</div>`:''),['Don\'t use this','Add to my library →'],1);
  if(ok!==1)return;
  customAi.push(part);if(!saveLibAi()){customAi.pop();m.lookErr='Couldn\'t save it to your parts library.';return renderIntentAi();}
  m.part=partByIdAi(part.id);m.from=dbSrc||'AI lookup';m.note='';
  (iwAi.missingAdded=iwAi.missingAdded||[]).push(cloneAi(part));
  WFAi.flash('Added "'+part.name+'" to your parts'+(dbSrc?' (from '+dbSrc+')':' (marked ⚠️ Approximate)'),5000);
  renderIntentAi();
};
// Another platform: only the board, the Wi-Fi parts and the questions change (the AI isn't asked again).
const iwKeepVals=function iwKeepVals(){iwAi.vals=iwAi.vals||{};for(const el of $Ai('iwBody').querySelectorAll('[data-iw]'))iwAi.vals[el.dataset.iw]=el.value;};
const intentSetPf=function intentSetPf(pf){
  pf=pfOkAi(pf);if(!iwAi.analysis||pf===iwAi.pf)return;
  iwAi.pf=pf;iwAi.override=pf!==pfOkAi(iwAi.analysis.platform);iwAi.matches=pfMatchesAi(iwAi.base,pf);renderIntentAi();
};
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
  if(builtinByIdAi(m.part.id))continue;
  if(/^p-cm-relay|^p-cm-pir$|^p-cm-led5mm$/.test(m.part.id))continue;// curated relays, HC-SR501 and 5 mm LED replace these in the list (the wizard search still uses them)
  const b=tidyPartAi(Object.assign(cloneAi(m.part),{notes:CM_NOTE,acc:'approx',builtin:true}));
  if(/^p-cm-relay/.test(b.id))b.type='relay';
  BUILTINAi.push(b);
}
const commonPart=function commonPart(m){
  const have=partByIdAi(m.part.id);if(have)return have;
  const c=tidyPartAi(Object.assign(cloneAi(m.part),{notes:CM_NOTE,acc:'approx'}));
  customAi.push(c);if(!saveLibAi()){customAi.pop();return null;}
  return partByIdAi(c.id);
};
// A parts-library part made into one of the user's own parts, without asking (the Parts Library's own import).
const importLibPart=async function importLibPart(src,id){
  const r=await src.load(id),title=String(r.data?r.data.title:'').slice(0,80);
  const have=title&&customAi.find(c=>c.name===title);if(have)return have;
  if(_intAi.edDirty)throw new Error('the Parts Library has a part with unsaved changes: save it first');
  _intAi.ed=tidyPartAi({id:newPartIdAi(),name:'New part',type:'board',shape:'rect',w:30,d:20,pcb:1.6,h:3,below:0,mount:'floor',features:[]});
  await (r.data?_intAi.applyFritzingData(r.data):_intAi.applyFritzing(r.fzp,r.svg,r.file));
  if(!_intAi.savePart())return null;
  return partByIdAi(_intAi.ed.id);
};
// Finds a part for each of the AI's part kinds. Returns [{spec, part|null, from, note}].
const intentMatch=async function intentMatch(specs){
  const out=[];let lib=null,libList=null,libTried=false;
  const own=()=>allPartsAi().map(p=>({title:p.name,family:(TYPESAi[p.type]||TYPESAi.other).name,tags:[p.type],desc:(p.notes||'').slice(0,300),ref:p}));
  // loose: drop words from the end until something matches, but keep at least ceil(original/2) words so
  // "capacitive" alone can't pull in a touchscreen display when the search was "capacitive soil moisture".
  const find=(list,q,loose)=>{const w=String(q||'').split(/[\s]+/).filter(Boolean),min=loose?Math.max(1,Math.ceil(w.length/2)):w.length;while(w.length){if(w.length>=min){const r=searchPartsAi(list,w.join(' '),'all');if(r.length)return r[0];}if(!loose||w.length<=min)break;w.pop();}return null;};
  for(const spec of specs){
    const txt=spec.category+' '+spec.search+' '+spec.function;
    if(/^power/i.test(spec.category)){
      const bat=/batter|lipo|18650|cordless|portable/i.test(spec.search+' '+spec.function),mains=!bat&&/mains|adapter|wall|plug/i.test(spec.search+' '+spec.function);
      out.push({spec,part:null,from:'power',power:bat?'battery':mains?'mains':'usb',note:bat?'Runs from a LiPo battery: the Enclosure Wizard adds the battery, a charger and an on/off switch.':mains?'Powered by a mains adapter (a plug-in USB charger): no extra part needed.':'Powered by a USB cable: no extra part needed.'});continue;
    }
    if(/^communication/i.test(spec.category)&&/wi-?fi|wireless|internet|esp/i.test(txt)){out.push({spec,part:null,from:'wifi',note:''});continue;}// (r3) built in or removed, by platform (pfMatches)
    let part=null,from='';
    if(/^(micro|controller|board)|esp32|esp8266|arduino|raspberry/i.test(spec.category+' '+spec.search))continue;// (r3) the board comes from the chosen platform
    if(!part){const r=find(own().filter(x=>!CTRL_IDSAi.includes(x.ref.id)),spec.search);if(r){part=r.ref;from=r.ref.builtin&&!customAi.some(c=>c.id===r.ref.id)?'built-in part':'your own parts';}}
    if(!part){/* part's own name first; its job text only if the name matched nothing ("sounds an alarm when motion is detected" must not pick the motion sensor) */const okMod=(m,t)=>m.re.test(t)&&!(m.not&&m.not.test(t));const m=COMMON_MODS.find(m=>okMod(m,spec.search))||COMMON_MODS.find(m=>(m.re.test(spec.search)||m.re.test(spec.function))&&!(m.not&&(m.not.test(spec.search)||m.not.test(spec.function))));if(m){part=commonPart(m);if(part)from='common module';}}
    // (r7) Parts library lookup removed — unknown parts stay unknown and are handled by AI via "Fix this part"
    out.push({spec,part,from,note:part?'':'Click 🔍 Look this up to ask your AI for its typical size and pins, or add it yourself later with Parts Library….'});
  }
  return out;
};
// Makes the AI's answer safe to use, and adds what a weather or messaging project always needs.
const tidyIntent=function tidyIntent(d,desc){
  const str=(v,n)=>String(v==null?'':v).slice(0,n||400);
  const A={name:str(d.name,30).trim(),summary:str(d.summary,1200),esphome_notes:str(d.esphome_notes,1500),esphome_yaml_hint:str(d.esphome_yaml_hint,2000),notification_method:str(d.notification_method||'ntfy',20)};
  // (r3) the platform the AI suggests (the user can pick another), what the code must do, and the libraries it needs
  A.platform=pfNormAi(d.platform);A.platform_reason=str(d.platform_reason,400);A.code_description=str(d.code_description,2500);A.missing_parts_hint=str(d.missing_parts_hint,300);
  A.microcontroller=d.microcontroller&&typeof d.microcontroller==='object'?{name:str(d.microcontroller.name,60),why:str(d.microcontroller.why,300)}:null;
  A.requirements=(Array.isArray(d.requirements)?d.requirements:[]).map(x=>str(x,200).trim()).filter(Boolean).slice(0,10);
  A.hidden_needs=(Array.isArray(d.hidden_needs)?d.hidden_needs:[]).filter(h=>h&&typeof h==='object'&&h.need).slice(0,6).map(h=>({kind:/^(ask|risk)$/.test(h.kind)?h.kind:'added',need:str(h.need,220),why:str(h.why,220)}));
  A.code_libraries=(Array.isArray(d.code_libraries)?d.code_libraries:[]).map(x=>str(x,60)).filter(Boolean).slice(0,12);
  if(!/^(ntfy|none|email)$/.test(A.notification_method))A.notification_method='ntfy';
  A.parts=(Array.isArray(d.parts)?d.parts:[]).filter(p=>p&&typeof p==='object').slice(0,12).map(p=>({category:str(p.category,40),function:str(p.function,300),search:str(p.search||p.function,60),required:p.required!==false,why:(p.support?'Added for you: ':'')+str(p.why,300),support:!!p.support}));
  // Sanity-filter: remove parts the AI hallucinated that the user never asked for.
  // Each rule: if the description does NOT mention any of the trigger words, remove parts matching the sensor pattern.
  const _d=desc.toLowerCase();
  const _notAsked=(triggers,partPattern)=>!triggers.some(w=>_d.includes(w))&&A.parts.some(p=>partPattern.test(p.search+' '+p.category));
  const _removeParts=pat=>{ A.parts=A.parts.filter(p=>!pat.test(p.search+' '+p.category)||/reed|magnet|hall.?sensor|contact switch|limit switch/i.test(p.search)); };// (Brief Doctor) a reed/magnet/limit switch is never a motion sensor, even when the AI files it under sensors-motion
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
    ins.push({key,label:str(x.label||key,120),help:str(x.help,300),url:/^https:\/\//.test(x.url||'')?str(x.url,200):'',only:PLATFORMSAi[x.only_if_platform]?x.only_if_platform:''});
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
};
// A saved ntfy topic is reused only if it is an EvenUCan topic made for this same device name;
// otherwise (an old name, or a different project) a fresh one is made, so topics never leak between projects.
const newTopic=A=>'evenucan-'+esphSlugAi(A.name||'device').slice(0,16)+'-'+Math.random().toString(36).slice(2,8);
const intentDefault=(k,A)=>{const v=WFAi.store.get('intent_inputs.'+k);
  if(k==='ntfy_topic'){const pre='evenucan-'+esphSlugAi(A.name||'device').slice(0,16)+'-';return (typeof v==='string'&&v.startsWith(pre))?v:newTopic(A);}
  if(v!=null&&v!=='')return v;
  return k==='notify_time'?'07:30':'';};
document.body.insertAdjacentHTML('beforeend',`<div id="iwBack" class="ewBack"><div class="ewWin" id="iwWin" role="dialog" aria-modal="true" aria-labelledby="iwTitle" style="width:min(780px,calc(100vw - 20px));height:auto;max-height:calc(100vh - 20px);user-select:text">
  <div class="ewHead"><h2 id="iwTitle">💡 What do I want to build?</h2><span class="ewNote" id="iwSub">Say what your gadget should do. Your AI picks the parts; EvenUCan sets up the box, the wiring and the code.</span>
    <button id="iwX" class="u-fs-18 x" title="Close (Esc)">✕</button></div>
  <div id="iwBody" style="padding:12px 16px;overflow:auto;font-size:13px;line-height:1.55"></div>
  <div class="ewFoot" id="iwFoot"></div>
</div></div>`);
const iwBack=$Ai('iwBack');
// (setup-r1) First-run setup wizard: printer bed size + AI key. Shows once then never again.
const setupDone=()=>WFAi.store.get('setup_done')==='1';
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
const suBack=$Ai('suBack');
let su={step:'su1',bedX:220,bedY:220,bedZ:250,bedSet:false};
// The board step only makes sense for the ESP32 family (Arduino / Raspberry Pi users skip it)
const suList=function suList(){const pf=WFAi.store.get('pref_pf')||'';return (pf==='arduino'||pf==='raspberrypi')?['su1','su2','su3','suP','su4']:['su1','su2','suB','su3','suP','su4'];};
const suAfter=s=>{const l=suList();return l[l.indexOf(s)+1]||'su4';};
const suBefore=s=>{const l=suList();return l[Math.max(0,l.indexOf(s)-1)];};
const suNo=(s,t)=>'Step '+(suList().indexOf(s)+1)+' of '+suList().length+' — '+t;
let suBTimer=null,suBKey='';
const suBState=()=>{const d=_intAi.bwDetected;return d?d.port+'|'+(d.ok?d.family:'x'):'none';};
const renderSetup=function renderSetup(){
  const b=$Ai('suBody'),f=$Ai('suFoot'),P=$Ai('suProg');
  clearInterval(suBTimer);suBTimer=null;
  if($Ai('suNever'))su.never=$Ai('suNever').checked;// keep the tick when the step changes
  if(su.step==='su1'){
    P.textContent=suNo('su1','Your 3D printer');
    b.innerHTML=
      '<div class="u-title-14">What 3D printer do you have?</div>'+
      '<div class="u-muted u-mb-10">This sets the build plate size so EvenUCan can warn you if your box is too big to print.</div>'+
      '<select id="suPreset" style="width:100%;font:inherit;padding:4px 6px;margin-bottom:10px">'+
        '<option value="">— Choose your printer —</option>'+
        SU_PRESETS.map(p=>'<option value="'+p.v+'"'+(su.bedSet&&su._preset===p.v?' selected':'')+'>'+escAi(p.label)+'</option>').join('')+
      '</select>'+
      '<div id="suManual" style="'+(su.bedSet?'':'display:none')+'">'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">'+
          '<label>Width (X)&nbsp;<input id="suBedX" type="number" min="10" max="2000" value="'+su.bedX+'" class="u-w68"> mm</label>'+
          '<label>Depth (Y)&nbsp;<input id="suBedY" type="number" min="10" max="2000" value="'+su.bedY+'" class="u-w68"> mm</label>'+
          '<label>Height (Z)&nbsp;<input id="suBedZ" type="number" min="10" max="2000" value="'+su.bedZ+'" class="u-w68"> mm</label>'+
        '</div>'+
      '</div>';
    f.innerHTML='<button id="suNext1" class="primary wcBig">Next →</button>'+
      '<button id="suSkip1" class="u-fs-12 u-muted wcBig wcPlain">Skip for now</button>';
    const pre=$Ai('suPreset');
    pre.addEventListener('change',()=>{
      const v=pre.value;if(!v)return;
      su._preset=v;su.bedSet=true;
      if(v==='custom'){$Ai('suManual').style.display='';return;}
      const[x,y,z]=v.split(',');su.bedX=+x;su.bedY=+y;su.bedZ=+z;
      $Ai('suManual').style.display='';
      $Ai('suBedX').value=x;$Ai('suBedY').value=y;$Ai('suBedZ').value=z;
    });
  }else if(su.step==='su2'){
    P.textContent=suNo('su2','Your board and software');
    const cur=WFAi.store.get('pref_pf')||'';
    b.innerHTML=
      '<div class="u-title-14">What will you program your gadgets with?</div>'+
      '<div class="u-muted u-mb-10">EvenUCan uses this to pick the right kind of code and the right board. Not sure? Leave it on "Not sure yet": you can change it for each project.</div>'+
      Object.entries(WC_PF).map(([k,p])=>'<label class="u-row u-my-7 u-fs-14"><input type="radio" name="suPf" value="'+k+'"'+(cur===k?' checked':'')+'> '+escAi(p.label)+(p.tip?' <span class="ewNote">← '+escAi(p.tip)+'</span>':'')+'</label>').join('');
    f.innerHTML='<button id="suBack2" class="wcBig wcPlain">← Back</button><button id="suNext2" class="primary wcBig">Next →</button>'+
      '<button id="suSkip2" class="u-fs-12 u-muted wcBig wcPlain">Skip for now</button>';
  }else if(su.step==='suB'){
    P.textContent=suNo('suB','Your board');
    const d=_intAi.bwDetected,BP=_intAi.BW_PART||{};suBKey=suBState();
    let body,primary;
    if(!d){
      body='<div class="u-title-14">Do you have your board yet?</div>'+
        '<div class="u-muted u-mb-10">Plug it into this computer with its USB cable now. EvenUCan will recognise it, so your project is built with the right pins and memory for <b>that</b> board.</div>'+
        '<div class="u-dashed-box">🔌 Looking for your board… <span class="u-muted">(this can take a few seconds after you plug it in)</span></div>'+
        '<div class="u-mt-8 ewNote">Nothing appears? Try a different USB cable (some only charge and carry no data) or a different USB port. No board yet? Just carry on: you can plug it in any time.</div>';
      primary='<button id="suNextB" class="primary wcBig">I have no board yet →</button>';
    }else if(d.ok&&BP[d.family]){
      body='<div class="u-title-14">✅ Found your board</div>'+
        '<div class="u-ok-box"><b>'+escAi(_intAi.bwDesc(d))+'</b><div class="u-muted u-mt-2">on '+escAi(d.port)+'</div></div>'+
        '<div class="u-mt-8">Shall EvenUCan build your projects for this board?</div>';
      primary='<button id="suUseB" class="primary wcBig">Yes, use this board →</button>';
    }else if(d.ok){
      body='<div class="u-title-14">🔌 Found a board EvenUCan cannot build for yet</div>'+
        '<div class="u-warn-box"><b>'+escAi(_intAi.bwName(d.family))+'</b> on '+escAi(d.port)+'</div>'+
        '<div class="u-mt-8">EvenUCan builds for the ESP32-S3, the classic ESP32, the ESP32-C3 and the ESP8266. Your projects will start from the ESP32-S3; you can change the board in any project.</div>';
      primary='<button id="suNextB" class="primary wcBig">Next →</button>';
    }else{
      body='<div class="u-title-14">🔌 A board is plugged in</div>'+
        '<div class="u-warn-box">'+escAi(d.usb_board?d.usb_board+' on '+d.port:d.port)+'<div class="u-muted u-mt-2">'+escAi(d.message||'It could not be identified.')+'</div></div>'+
        '<div class="u-mt-8">You can carry on: EvenUCan will check it again whenever you upload.</div>';
      primary='<button id="suNextB" class="primary wcBig">Next →</button>';
    }
    b.innerHTML=body;
    f.innerHTML='<button id="suBackB" class="wcBig wcPlain">← Back</button>'+primary;
    // watch for the board being plugged in (or pulled out) while this step is open
    suBTimer=setInterval(()=>{if(suBack.style.display!=='grid'||su.step!=='suB'){clearInterval(suBTimer);suBTimer=null;return;}if(suBState()!==suBKey)renderSetup();},800);
  }else if(su.step==='su3'){
    const has=!!aiKeyAi(),P2=PROVIDERSAi[aiProvAi()];
    P.textContent=suNo('su3','AI helper (optional)');
    b.innerHTML=
      '<div class="u-title-14">Set up an AI key</div>'+
      '<div class="u-muted u-mb-10">The AI plans the parts, box and code from your description. Free keys work great — no credit card needed. You can always change this later in <b>Tools → AI key</b>.</div>'+
      aiHelperBox(true)+
      (has?'<div style="color:var(--ok);margin-top:4px">✅ '+escAi(P2.name)+' key is set up — you\'re ready!</div>':'');
    f.innerHTML='<button id="suBack3" class="wcBig wcPlain">← Back</button>'+
      '<button id="suNext3" class="primary wcBig">Next →</button>'+
      '<button id="suSkip3" class="u-fs-12 u-muted wcBig wcPlain">Skip, no AI for me</button>';
  }else if(su.step==='suP'){
    if(WFAi.store.get('evenucan.projectsAsked')==='done'){su.step=suAfter('suP');return renderSetup();}   // already answered (the popup or an earlier run)
    P.textContent=suNo('suP','Your projects');
    b.innerHTML='<div class="u-title-14">Where should EvenUCan keep your projects?</div>'+
      '<div class="u-muted u-mb-10">Each project you save is kept as a file in this folder, so it is safe even if the browser data is cleared.</div>'+
      '<div id="suPDir" class="u-path-box">Looking for the folder…</div>';
    f.innerHTML='<button id="suBackP" class="wcBig wcPlain">← Back</button>'+
      '<button id="suChooseP" class="wcBig wcPlain">Choose a different folder…</button>'+
      '<button id="suUseP" class="primary wcBig">Use this folder →</button>';
    fetch('/api/projects').then(r=>r.json()).then(r=>{const el=$Ai('suPDir');if(el&&r&&r.dir)el.textContent=r.dir;else if(el)el.textContent='(the Projects folder needs the desktop app)';}).catch(()=>{});
  }else if(su.step==='su4'){
    P.textContent=suNo('su4','You are ready');
    b.innerHTML=
      '<div class="u-title-16">✅ You are ready</div>';
    f.innerHTML='<button id="suBack4" class="u-fs-12 u-muted wcBig wcPlain">← Back</button>'+
      '<button id="suDone" class="primary wcBig">Finish →</button>';
  }
  // on every step: leave the setup, and ask not to see it again
  f.insertAdjacentHTML('beforeend','<div style="flex-basis:100%;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:4px;font-size:12.5px"><label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="suNever"'+(su.never?' checked':'')+'> Don\'t show this setup again</label><button id="suSkipAll" class="linkBtn">Skip the setup</button></div>');
};
const suFinish=function suFinish(){WFAi.store.set('setup_done','1');suBack.style.display='none';clearInterval(suBTimer);suBTimer=null;};
suBack.addEventListener('click',e=>{
  const id=e.target.id;
  if(id==='suNext1'||id==='suSkip1'){
    if(id==='suNext1'&&su.bedSet){
      const x=+($Ai('suBedX')||{value:su.bedX}).value||su.bedX;
      const y=+($Ai('suBedY')||{value:su.bedY}).value||su.bedY;
      const z=+($Ai('suBedZ')||{value:su.bedZ}).value||su.bedZ;
      if(x>9&&y>9&&z>9&&window.WF&&window.WF.setBed)window.WF.setBed(x,y,z);
    }
    su.step='su2';renderSetup();
  }else if(id==='suNext2'||id==='suSkip2'){
    const r=document.querySelector('input[name="suPf"]:checked');
    if(id==='suNext2'&&r&&PLATFORMSAi[r.value]){WFAi.store.set('pref_pf',r.value);iwAi.w.pf=r.value;iwAi.noai.pf=r.value;}
    su.step=suAfter('su2');renderSetup();
  }else if(id==='suBack2'){su.step='su1';renderSetup();}
  else if(id==='suUseB'){
    const d=_intAi.bwDetected,pid=d&&d.ok&&(_intAi.BW_PART||{})[d.family];
    if(pid){WFAi.store.set('pref_board',pid);
      // a brand-new project already in memory still holds the built-in ESP32-S3: give it the board that is actually plugged in
      try{const w=_intAi.wiz;if(!WFAi.store.get(WIZ_KEYAi)&&w&&w.items&&w.items.length===1&&w.items[0].pid==='b-esp32s3'){w.items[0].pid=pid;_intAi.wiz=w;}}catch(e){/* the board is still remembered for the next project */}}
    su.step=suAfter('suB');renderSetup();}
  else if(id==='suNextB'){su.step=suAfter('suB');renderSetup();}
  else if(id==='suBackB'){su.step=suBefore('suB');renderSetup();}
  else if(id==='suNext3'||id==='suSkip3'){su.step=suAfter('su3');renderSetup();}
  else if(id==='suBack3'){su.step=suBefore('su3');renderSetup();}
  else if(id==='suBack4'){su.step=suBefore('su4');renderSetup();}
  else if(id==='suBackP'){su.step=suBefore('suP');renderSetup();}
  else if(id==='suUseP'){window.projAnswer().then(()=>{su.step=suAfter('suP');renderSetup();});}
  else if(id==='suChooseP'){window.projChoose().then(()=>{su.step=suAfter('suP');renderSetup();});}
  else if(id==='suDone'){suFinish();openStartupChoiceAi();}
  else if(id==='suSkipAll'){if($Ai('suNever')&&$Ai('suNever').checked)WFAi.store.set('setup_done','1');suBack.style.display='none';openStartupChoiceAi();}
  // AI key buttons reused from aiHelperBox — same IDs as welcome wizard
  else if(id==='wcAiGem')askKeyAi('gemini').then(renderSetup);
  
  else if(id==='wcAiGroq')askKeyAi('groq').then(renderSetup);
  else if(id==='wcAiOr')askKeyAi('openrouter').then(renderSetup);
  else if(id==='wcAiLocal')askKeyAi('localai').then(renderSetup);
  else if(id==='wcAiCl')askKeyAi('claude').then(renderSetup);
  else if(id==='wcAiOa')askKeyAi('openai').then(renderSetup);
  else if(id==='wcAiDs')askKeyAi('deepseek').then(renderSetup);
  else if(id==='wcAiGrok')askKeyAi('grok').then(renderSetup);
  else if(id==='wcAiTest')askKeyAi(aiProvAi()).then(renderSetup);
});
const openSetupAi=function openSetupAi(){
  if(setupDone())return false;
  su={step:'su1',bedX:220,bedY:220,bedZ:250,bedSet:false,_preset:'',never:false};
  $Ai('suFoot').innerHTML='';// forget a tick left from an earlier opening
  suBack.style.display='grid';
  renderSetup();
  return true;
};
// (startup-r1) Startup choice overlay: shown on 2nd+ run when there is a previous project to restore.
document.body.insertAdjacentHTML('beforeend','<div id="spBack" class="ewBack"><div class="ewWin" role="dialog" aria-modal="true" aria-labelledby="spTitle" style="width:min(480px,calc(100vw - 20px));height:auto">'+
  '<div class="ewHead"><h2 id="spTitle">👋 Welcome back</h2></div>'+
  '<div style="padding:12px 16px 0;font-size:13px;line-height:1.55">'+
  '<p style="margin:0 0 14px">Your last project is ready to carry on. Or start something new — the wizard will plan the parts, the box and the code from your description.</p>'+
  '<button id="spContinue" class="u-mb-8 wcBig primary">Continue my last project →</button>'+
  '<button id="spNew" class="wcBig wcPlain">Start a new project…</button>'+
  '</div><div style="height:14px"></div>'+
'</div></div>');
const spBack=$Ai('spBack');
const openStartupChoiceAi=function openStartupChoiceAi(){
  if(openSetupAi())return;// first ever open: show the setup wizard (printer + AI key) first
  // If saved project data exists, offer Continue / New (regardless of wcSeen which is unreliable)
  const hasSaved=!!(WFAi.store.get(WIZ_KEYAi)||WFAi.store.get(ESPH_KEYAi)||WFAi.store.get(ESPH_AI_KEYAi)||intentNowAi());
  // A project is already open (the last one loaded): open it straight away, no Continue / New question
  if(hasSaved){if(!WFAi.store.get('evenucan.currentProject'))spBack.style.display='grid';return;}
  // Nothing saved (true first run after setup, or after a New Project) → open the Welcome wizard
  openWelcomeAi(true);
};
const closeStartupChoice=function closeStartupChoice(){spBack.style.display='none';};
spBack.addEventListener('click',e=>{
  const id=e.target.id;
  if(id==='spContinue')closeStartupChoice();
  else if(id==='spNew'){
    closeStartupChoice();
    // Clear all project keys from storage now (hardcoded: ELEC_KEYS is in the outer IIFE)
    ['enclosure.wizard','esphome.form','parts','intent'].forEach(k=>WFAi.store.set(k,''));
    WFAi.store.set(ESPH_AI_KEYAi,'');
    WFAi.store.set('welcome_seen','');// allow welcome wizard to show again on next open
    try{Object.keys(localStorage).filter(k=>/^opensketch\.intent_inputs\./.test(k)).forEach(k=>localStorage.removeItem(k));}catch(e){}
    // Reset in-memory wizard state so stale checkboxes/text don't bleed into the next run
    iwAi.w={text:'',does:[],pf:'auto',noShow:false};iwAi.desc='';iwAi.step='ask';
    // Reset in-memory state before the wizard opens (storage is clear so readWiz returns DEFAULT_WIZ)
    wizAi=readWizAi();
    if(wrAi){wrAi.ai=null;wrAi.plan=null;}
    if(window.newProject)window.newProject();
  }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&spBack.style.display==='grid')closeStartupChoice();});
const IW_STEPS=['🩺 Parts Doctor: Picking the right parts for your idea…','🔍 Parts Doctor: Matching parts in the library…','⚡ Electric Doctor: Wiring every pin and power line…','🔬 Specialist: Verifying parts & wiring…'];
let iwAi={step:'ask',desc:'',prog:0,analysis:null,base:null,matches:null,pf:'esphome',override:false,missingAdded:[],vals:{},err:'',raw:'',busy:false,
  welcome:false,w:{text:'',does:[],pf:'auto',noShow:false},userPf:null,noai:{parts:[],pf:'esphome'},nokeyFrom:''};// (r4) welcome: opened by the Welcome window; w: its answers
const renderIntentAi=function renderIntentAi(){
  const b=$Ai('iwBody'),f=$Ai('iwFoot');
  updateStripAi();
  if(wcRender())return;// (r4) the Welcome steps
  if(iwAi.step==='ask'){
    const has=!!aiKeyAi();
    b.innerHTML=`<div class="iwDocStrip" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;padding:10px 12px;background:linear-gradient(135deg,#ecfdf5,#eff6ff);border:1px solid #86efac;border-radius:8px;font-size:12.5px"><div class="u-row-start"><span class="u-fs-18">🩺</span><div><b>1. Parts Doctor</b><br><span class="ewNote">Picks the exact parts for your idea</span></div></div><div class="u-row-start"><span class="u-fs-18">⚡</span><div><b>2. Electric Doctor</b><br><span class="ewNote">Wires every pin, relay &amp; power rail</span></div></div><div class="u-row-start"><span class="u-fs-18">🔬</span><div><b>3. Specialist</b><br><span class="ewNote">Verifies &amp; auto-fixes before you see it</span></div></div></div><label for="iwDesc" class="u-label-15">✨ I want to make a… (type in plain English, or click 🐕 Dog flap counter below):</label>
<textarea id="iwDesc" rows="7" class="u-full u-fs-14 u-lh-145 u-resize-v" placeholder="e.g. My RV keeps going unlevel overnight and I want an alert. Or: I want to know if someone opens the garden gate. Just describe the problem — no technical knowledge needed!">${escAi(iwAi.desc)}</textarea>
<div class="u-mt-6 u-wrap-6 ewRow"><span class="ewNote">Try an example:</span>${Object.keys(EXAMPLES).map(k=>`<button data-ex="${escAi(k)}" class="u-pill">${escAi(k)}</button>`).join('')}</div>
<div class="u-mt-6 ewNote">Your AI (${escAi(PROVIDERSAi[aiProvAi()].name)}) reads it and picks the right parts${has?'.':' — <span class="warn">it needs a free key first:</span> <button id="iwKey">'+escAi(_intAi.keyLabel())+'</button> or <button id="wcNoAi">Carry on without AI</button>'}</div>
${iwAi.err?`<div class="u-mt-8 bad">${escAi(iwAi.err)}</div>`:''}`;
    f.innerHTML='<button id="iwGo" class="primary">Next →</button><button id="iwCancel">Close</button>';
    setTimeout(()=>{const t=$Ai('iwDesc');if(t)t.focus();},0);
  }else if(iwAi.step==='clarify'){
    const cl=iwAi.clarify||{power:'usb',phone:true};
    const POW_CL=[['usb','🔌 USB / mains adaptor','plugged in all the time'],['battery','🔋 Battery inside the box','rechargeable — good for portable and outdoor projects'],['mains','🔌 Dedicated mains adaptor','always-on power supply in a wall socket']];
    b.innerHTML=`<div style="font-size:16px;font-weight:600;margin-bottom:10px">One quick thing before I start…</div>
<fieldset style="border:none;padding:0;margin:0 0 14px"><legend style="font-weight:600;margin-bottom:8px">How will it be powered?</legend>${POW_CL.map(([v,l,t])=>`<label style="display:flex;gap:8px;align-items:center;margin:8px 0;font-size:14px"><input type="radio" name="iwClPow" value="${v}"${cl.power===v?' checked':''}> <b>${l}</b> <span class="ewNote">${t}</span></label>`).join('')}</fieldset>
<label style="display:flex;gap:8px;align-items:flex-start;font-size:14px;cursor:pointer"><input type="checkbox" id="iwClPhone"${cl.phone?' checked':''}> <span><b>Send alerts to my phone</b> <span class="ewNote">— when something happens (a gate opening, a sensor triggering, a low battery). Uses ntfy, free.</span></span></label>
${iwAi.err?`<div class="u-mt-8 bad">${escAi(iwAi.err)}</div>`:''}`;
    f.innerHTML='<button id="iwClBack">← Back</button><button id="iwClGo" class="primary">Let\'s find the parts →</button>';
    setTimeout(()=>{const r=b.querySelector('input[name="iwClPow"]:checked');if(r&&iwBack.style.display==='grid')r.focus();},0);
  }else if(iwAi.step==='busy'){
    b.innerHTML='<div style="font-size:16px;font-weight:600;margin:4px 0 8px">🩺 The Surgery is preparing your build plan…</div><div style="margin:6px 0 10px" aria-live="polite">'+IW_STEPS.map((s,i)=>`<div class="${i<iwAi.prog?'ok':i===iwAi.prog?'':'ewNote'}" style="font-size:14px;margin:4px 0">${i<iwAi.prog?'✓':i===iwAi.prog?'<span class="wcSpin">⟳</span>':'·'} ${escAi(s)}</div>`).join('')+'</div><div class="ewNote">'+(aiKeyAi()?aiProvAi()==='localai'?'Local AI can take 1–5 minutes depending on your model and computer.':'Checking parts, pins and wiring…':'Using built-in Specialist doctors…')+' <span id="iwAiCd"></span></div>';
    f.innerHTML='<button id="iwCancel">Close</button>';
  }else if(iwAi.step==='error'){
    b.innerHTML=`<div class="bad" style="font-size:14px;margin-bottom:8px">${escAi(iwAi.err)}</div>`+(iwAi.raw?`<details><summary>What the AI sent back</summary><textarea readonly class="wrCode" style="height:180px">${escAi(iwAi.raw)}</textarea></details>`:'');
    f.innerHTML='<button id="iwRetry" class="primary">Try again</button><button id="iwEdit">Change my description</button><button id="iwCancel">Close</button>';
  }else if(iwAi.step!=='ready'){
    const A=iwAi.analysis,pf=pfOkAi(iwAi.pf),PF=PLATFORMSAi[pf],aiPf=pfOkAi(A.platform);
    const okFrom=m=>m.from==='power'||m.from==='skip'||m.from==='removed';
    const rows=iwAi.matches.map((m,k)=>m.from==='power'?'':`<li style="margin:5px 0">${m.part?'<span class="ok">✓</span> <b>'+escAi(m.part.name)+'</b>':m.from==='removed'?'<span class="ewNote">✗</span> <s>'+escAi(m.spec.search)+'</s>':okFrom(m)?'<span class="ok">✓</span> <b>'+escAi(m.spec.category==='power'?'Power':m.spec.search)+'</b>':'<span class="warn">!</span> <b>'+escAi(m.spec.search)+'</b> '+IW_BADGE} — ${escAi(m.spec.function)}`+(iwAi.edit&&!m.ctrl?` <button data-iwdel="${k}" class="linkBtn" title="Take this part out">✕ Remove</button>`:'')+
      (m.from&&m.part?` <span class="ewNote">(${escAi(m.from)})</span>`:'')+(m.part&&accOfAi(m.part)==='approx'&&m.from==='AI lookup'?' <span class="warn">⚠️ Approximate</span>':'')+
      (m.spec.why&&!m.ctrl?`<div class="ewNote">Why: ${escAi(m.spec.why)}</div>`:'')+(m.note?`<div class="${m.part||okFrom(m)?'ewNote':'warn'}">${escAi(m.note)}</div>`:'')+
      (!m.part&&!okFrom(m)&&!m.ctrl?`<div class="ewRow" style="margin:3px 0 0">${m.looking?`<span class="ewNote">⏳ ${escAi(m.lookStage||'Searching…')}</span>`:`<button data-look="${k}">🔍 Look this up</button>`}${m.lookErr?` <span class="bad">${escAi(m.lookErr)}</span>`:''}</div>`:'')+'</li>').join('');
    // Hardware gap warning: required parts the AI asked for that have no match in the library
    const gapParts=iwAi.matches.filter(m=>m.spec&&m.spec.required&&!m.part&&!m.ctrl&&m.from!=='power'&&m.from!=='skip'&&m.from!=='removed');
    const missingWarning=gapParts.length?`<div class="u-alert-box bad"><b>⚠️ Your project needs parts that aren't in your library yet</b><ul class="u-list-indent">`+gapParts.map(m=>`<li><b>${escAi(m.spec.search)}</b> — ${escAi(m.spec.function)}${m.spec.why?` <span class="ewNote">(${escAi(m.spec.why)})</span>`:''}</li>`).join('')+`</ul><div class="u-mt-4">Without ${gapParts.length===1?'it':'these'}, the device can't do everything you described. Click <b>🔍 Look this up</b> next to ${gapParts.length===1?'it':'each one'} above — your AI will find its dimensions and add it to your library automatically.</div></div>`:'';
    const drop=iwAi.dropped||[],noWifi=drop.includes('wifi');
    const shown=A.extra_inputs_needed.filter(x=>inputShown(x,pf)&&!(noWifi&&NET_KEYS.test(x.key))),hidden=A.extra_inputs_needed.filter(x=>!shown.includes(x));
    iwAi.vals=iwAi.vals||{};for(const x of shown)if(iwAi.vals[x.key]==null)iwAi.vals[x.key]=intentDefault(x.key,A);// made once, so the topic stays the same
    const ins=shown.map(x=>`<label class="u-my-8 ef"><b>${escAi(x.label)}</b><br><input type="text" data-iw="${escAi(x.key)}" value="${escAi(iwAi.vals[x.key])}" class="u-full"${SECRETISH.test(x.key)||x.key==='ntfy_topic'?' autocomplete="off" spellcheck="false"':''}>`+
      `<span class="ewNote">${escAi(x.help)}${x.url?` <a href="${escAi(x.url)}" target="_blank" rel="noopener">${escAi(x.url.replace(/^https:\/\//,''))}</a>`:''}</span></label>`).join('');
    const topic=shown.some(x=>x.key==='ntfy_topic')?String(iwAi.vals.ntfy_topic||'').trim():'';
    const net=!noWifi&&pf!=='arduino'&&netNeededAi(iwAi.desc,A);
    const wifiIn=net&&pf==='esp32ide'?`<div class="u-lh-14 efbox"><b>Your Wi-Fi</b> <span class="ewNote">(so it can send the messages)</span>
<label class="u-my-6 ef">Wi-Fi name<br><input id="iwSsid" value="${escAi(wifiMemAi.ssid)}" autocomplete="off" spellcheck="false" class="u-full"></label>
<label class="u-my-6 ef">Wi-Fi password<br><input id="iwPass" type="password" value="${escAi(wifiMemAi.pass)}" autocomplete="new-password" class="u-full"></label>
<div class="ewNote">Kept only in the code made on this computer: never sent to the AI or anywhere else, and not saved. Or leave them empty: the code then has clearly marked places (WIFI_SSID and WIFI_PASSWORD) to type them in.</div></div>`
      :net&&pf==='esphome'?'<div class="u-my-6 ewNote">Your Wi-Fi name and password go into ESPHome\'s <b>Secrets</b> later, not here.</div>':'';
    const issues=capIssuesAi(pf,iwAi.desc,A,iwAi.power,drop),blocked=issues.some(c=>c.block);
    const POW_OPTS=[['usb','🔌 USB cable','plugged into a computer or a USB charger'],['battery','🔋 Battery inside the box','EvenUCan adds a rechargeable battery, a charger and an on/off switch'],['mains','🔌 Mains adapter','a plug-in 5 V USB charger in a wall socket, for running all the time']];
    const pow=`<h4>How is it powered?</h4><div class="iwPow" role="radiogroup" aria-label="Power">`+POW_OPTS.map(([v,l,t])=>`<label><input type="radio" name="iwPow" value="${v}"${iwAi.power===v?' checked':''}> <b>${l}</b> <span class="ewNote">${t}</span></label>`).join('')+'</div>';
    const pfBtns=Object.entries(PLATFORMSAi).map(([k,p])=>`<button data-pf="${k}" aria-pressed="${k===pf}" class="${k===pf?'primary':''}" title="${escAi(p.about)}">${p.icon} ${escAi(p.name)}${k===aiPf?' · AI\'s pick':''}</button>`).join('');
    const why=pf===aiPf?(A.platform_reason?'<b>Why:</b> '+escAi(A.platform_reason)+' ':''):`<b>You chose ${escAi(PF.name)}</b> instead of the AI's suggestion (${escAi(PLATFORMSAi[aiPf].name)}${A.platform_reason?': '+escAi(A.platform_reason):''}). `;
    const removed=iwAi.matches.filter(m=>m.from==='removed').map(m=>m.spec.search);
    const gone=pf==='arduino'&&(removed.length||noWifi)?`<div class="u-my-4 warn">Without Wi-Fi on the ${escAi(PF.name)}: `+(removed.length?'removed '+escAi(removed.join(', '))+'. ':'')+(noWifi?'You chose to leave out messages to your phone and anything from the internet.':'')+'</div>':'';
    let editor='';
    if(iwAi.edit){
      editor=`<div class="efbox" id="iwEditor"><b>Change the parts</b><div class="ewNote">Take a part out with ✕ Remove, search for a part below, or pick a different board above.</div>
<div class="u-mt-6 ewRow"><input id="iwAddSearch" type="search" placeholder="Type what you're looking for — e.g. gyroscope, air quality, DHT22, screen…" class="u-grow" autocomplete="off"></div>
<div id="iwAddResults" style="max-height:230px;overflow-y:auto;border:1px solid var(--line);border-radius:5px;margin-top:6px"><div class="u-pad-6-8 ewNote">Type above to search your own parts and the full ready-made library.</div></div></div>`;
    }
    b.innerHTML=`<h4 style="margin-top:0">${escAi(A.name||'Your device')}</h4><p style="margin:4px 0 10px">${escAi(A.summary)}</p>`+capHtmlAi(issues)+briefDoctorHtml(briefDoctor(iwAi.desc,A,pf,iwAi.power),A)+`
<h4>Which board runs it?</h4><div class="ewRow" role="group" aria-label="Platform" style="flex-wrap:wrap">${pfBtns}</div><p class="u-my-4">${why}<span class="ewNote">${escAi(String(PF.about).replace(/ESP32-S3/g,pfFam()))}</span></p>${gone}
<h4 id="iwPartsHead">The parts I picked, and why</h4><ul style="list-style:none;padding:0;margin:0">${rows}</ul>${missingWarning}${editor}${pow}`+
      (A.code_description||A.esphome_notes?`<h4>How the code will work</h4><p class="ewNote" style="font-size:13px;margin:0">${escAi(A.code_description||A.esphome_notes)}</p>`:'')+
      (pf!=='esphome'&&A.code_libraries.length?`<p class="ewNote" style="margin:4px 0 0">Libraries the AI suggested: ${escAi(A.code_libraries.join(', '))}</p>`:'')+
      (ins?`<div class="u-lh-14 efbox"><b>A few things I need from you</b><div class="ewNote">They are kept on this computer and saved with your project file, and written into the device's code.</div>${ins}</div>`:'')+ntfyBoxAi(topic)+wifiIn;
    f.innerHTML=`<button id="iwRestart" class="linkBtn">Start again from the beginning</button><button id="iwAgain" aria-expanded="${!!iwAi.edit}">${iwAi.edit?'Done changing parts':'Change these parts'}</button><button id="iwApply" class="primary"${blocked?' disabled title="First choose how to fix the problem shown in red"':''}>Looks good. Next: Box →</button>`;
  }else if(iwAi.step==='ready'){
    const c=currentCodeAi(),it=intentNowAi()||{},box=WFAi.model.faces.length>0,pf=c?c.pf:null;
    const names=wizAi.items.map(i=>{const p=partByIdAi(i.pid);return (i.qty>1?i.qty+' × ':'')+(p?p.name:i.pid);});
    const ide=pf?openLabelAi(pf):'';
    b.innerHTML=`<div style="font-size:20px;font-weight:600;margin-bottom:4px">🎉 Your project is ready</div><p class="u-m0-8">Here is everything EvenUCan made for <b>${escAi((it.analysis&&it.analysis.name)||'your gadget')}</b>. Download what you need:</p>
<ul style="list-style:none;padding:0;margin:0;font-size:14px" id="rdList">
<li class="u-my-8">📦 <b>Parts</b> (${names.length}): ${escAi(names.join(', '))}. Powered by ${escAi(POW_NAMEAi[wizAi.power]||POW_NAMEAi.usb)}.<br><button id="rdParts">Download the parts list</button></li>
<li class="u-my-8">🏠 <b>Box</b>: ${box?'made, and in your drawing.<br><button id="rd3mf" class="primary">Download the box (3MF) for your 3D printer</button> <button id="rdStl">STL</button>':'not made (you skipped it).<br><button id="rdBox">Make the box now</button>'}</li>
<li class="u-my-8">🔌 <b>Wiring</b>: what wire goes where.<br><button id="rdWire">Download the wiring list</button></li>
<li class="u-my-8">💻 <b>Code</b>: ${c?escAi(c.name)+'<br><button id="rdCode">Download the code</button> <button id="rdIde" class="primary">'+escAi(ide)+'</button>':'not written yet.<br><button id="rdToCode">Write the code</button>'}</li></ul>`+
      ntfyBoxAi(_intAi.intentTopic())+'<div class="u-mt-8 ewNote">Save your project (💾 Save at the top) to keep all of this together.</div>';
    f.innerHTML='<button id="iwRestart" class="linkBtn">Start again from the beginning</button><button id="rdBack">← Back to the code</button><button id="rdClose" class="primary">Close</button>';
  }
};
const openIntentAi=function openIntentAi(){
  iwBack.style.display='grid';iwAi.welcome=false;
  if((iwAi.step==='error'||WC_STEPS.includes(iwAi.step))&&!iwAi.busy)iwAi.step='ask';
  if(!iwAi.desc){const it=intentNowAi();if(it&&it.desc)iwAi.desc=it.desc;}
  renderIntentAi();
};
const closeIntentAi=function closeIntentAi(){
  if(iwAi.welcome)WFAi.store.set('welcome_seen',iwAi.w.noShow?'1':'0');// (r4) "Don't show this when I open a new file"
  if(iwAi.step==='ready'){iwAi.step='result';gStepAi=null;}// (wizard-r2) the end of the guided path
  iwBack.style.display='none';updateStripAi();
};
const intentAnalyse=async function intentAnalyse(){
  const t=$Ai('iwDesc'),desc=(t?t.value:iwAi.desc).trim();
  iwAi.desc=desc;iwAi.err='';
  if(desc.length<8){iwAi.err='Tell me a little more about what it should do (a sentence or two is plenty).';return renderIntentAi();}
  if(iwAi.busy)return;
  iwAi.busy=true;iwAi.step='busy';iwAi.prog=0;renderIntentAi();if(aiKeyAi())_cdStartAi('iwAiCd',aiProvAi()==='localai'?300:60);
  try{
    const res=await runSurgery(desc,iwAi.clarify||null,stage=>{iwAi.prog=stage;renderIntentAi();});
    iwAi.analysis=res.analysis;
    iwAi.pf=res.pf;iwAi.override=false;iwAi.missingAdded=[];iwAi.vals={};iwAi.userPf=null;
    iwAi.base=res.base;iwAi.matches=res.matches;
    iwAi.power=res.power||'usb';iwAi.dropped=[];iwAi.edit=false;
    iwAi.surgeryReport=res.surgeryReport;
    iwAi.step='result';
    if(iwBack.style.display!=='grid')WFAi.flash('Your parts list is ready: click 💡 What do I want to build? to see it',8000);
  }catch(e){
    console.error('EvenUCan Surgery error:',e);
    iwAi.step='error';iwAi.err='Something went wrong while planning your gadget: '+(e&&e.message||e);iwAi.raw='';
  }finally{_cdStopAi();iwAi.busy=false;renderIntentAi();}
};
const intentApply=async function intentApply(){
  const A=iwAi.analysis,inputs={},pf=pfOkAi(iwAi.pf);
  if(capIssuesAi(pf,iwAi.desc,A,iwAi.power,iwAi.dropped).some(c=>c.block))return WFAi.flash('First choose how to fix the problem shown in red.',6000);
  for(const el of $Ai('iwBody').querySelectorAll('[data-iw]'))inputs[el.dataset.iw]=el.value.trim();
  // the phone topic is needed by the code even when it isn't shown (it was made for this project)
  if(!(iwAi.dropped||[]).includes('wifi')&&pf!=='arduino'&&A.extra_inputs_needed.some(x=>x.key==='ntfy_topic')&&!inputs.ntfy_topic)inputs.ntfy_topic=String((iwAi.vals||{}).ntfy_topic||intentDefault('ntfy_topic',A));
  if('owm_api_key' in inputs&&!inputs.owm_api_key&&!confirm('Without an OpenWeatherMap key the device can\'t get the weather. Carry on anyway? (You can add it later.)'))return;
  for(const k in inputs)WFAi.store.set('intent_inputs.'+k,inputs[k]);
  const prev=intentNowAi();
  WFAi.store.set(INTENT_KEYAi,JSON.stringify({desc:iwAi.desc,analysis:A,inputKeys:Object.keys(inputs),platform:pf,platformOverride:!!iwAi.override,missingAdded:iwAi.missingAdded||[],power:iwAi.power||'usb',dropped:iwAi.dropped||[]}));
  pfCodeAi=null;pfMsgAi='';
  iwAi.step='busy';iwAi.prog=2;renderIntentAi();
  await new Promise(r=>setTimeout(r,30));
  // the Enclosure Wizard: just these parts (one line per part, with how many)
  const items=[];
  for(const m of iwAi.matches){if(!m.part)continue;const ex=items.find(i=>i.pid===m.part.id);if(ex)ex.qty=Math.min(10,ex.qty+1);else items.push({pid:m.part.id,qty:1,mount:'auto',wall:'auto'});}
  wizAi.items=items;wizAi.power=iwAi.power||'usb';
  if(_intAi.wiz){_intAi.wiz.items=items;_intAi.wiz.power=wizAi.power;}
  saveWizAi();layAi=null;_intAi.lay=null;


  // the ESPHome answers: the device's name and the idea as its description (unless the user wrote their own)
  const f=esphFormAi();if(A.name)f.name=A.name;f.purpose='sensor';
  if(!f.desc||(prev&&f.desc===prev.desc))f.desc=iwAi.desc;
  WFAi.store.set(ESPH_KEYAi,JSON.stringify(f));
  if(wrAi)wrAi.ai=null;
  iwAi.prog=3;renderIntentAi();
  await new Promise(r=>setTimeout(r,30));
  const P=planWiringAi();let code=null;
  if(!P.error&&pf==='esphome'){try{code=esphomeYamlAi(P,esphFormAi());}catch(e){console.error('EvenUCan: could not write the ESPHome file for the project idea',e);}}
  // (wizard-r2) one path from here: the box first, with the guide saying what comes next
  iwAi.step='result';iwAi.edit=false;iwBack.style.display='none';_intAi.gStep='box';openWizardAi();

  const names=items.map(i=>{const p=partByIdAi(i.pid);return (i.qty>1?i.qty+' × ':'')+(p?p.name:i.pid);});
  const list=names.length>1?names.slice(0,-1).join(', ')+' and '+names[names.length-1]:names[0]||'no parts';
  const missing=iwAi.matches.filter(m=>!m.part&&m.from!=='power'&&m.from!=='skip'&&m.from!=='removed').map(m=>m.spec.search);
  const msg=$Ai('ewIntentMsg');
  msg.innerHTML=`<button class="x" id="ewIntentHide" title="Hide" style="float:right">✕</button><b>💡 I've set up your enclosure with ${escAi(list)}${iwAi.power==='battery'?', running from a battery':iwAi.power==='mains'?', powered by a mains adapter':''}.</b> `+
    (P.error?`<span class="bad">${escAi(P.error)}</span>`:code&&code.error?`<span class="bad">${escAi(code.error)}</span>`:pf!=='esphome'?'The wiring is worked out for the '+escAi(PLATFORMSAi[pf].name)+'; your AI writes the '+escAi(PLATFORMSAi[pf].code)+' when you look at the code.':`The wiring is worked out${code&&code.weather?' and the ESPHome file already fetches the weather'+(intentWeatherAi().topic?' and sends your daily message':''):''}.`)+
    (missing.length?` <span class="warn">Not found in the library: ${escAi(missing.join(', '))}.</span>`:'')+
    '';
  msg.style.display='block';
};
// The code: the ESPHome tab of the Wiring window. Opens the tab only; user must click to start AI.
const intentCodeAi=function intentCodeAi(){
  openWiringAi();
  const tabBtn = document.querySelector('#wrSide [data-wrtab="esphome"]');
  if (tabBtn) tabBtn.click();
  // Do NOT auto-start AI here — let the user click the button when ready.
  // (Previously pfGenerate() and esphWithAI() were called automatically here, but that
  //  caused AI to run before the user was ready and ignored any part errors shown on the page.)
};
