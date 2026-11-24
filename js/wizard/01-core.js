// EvenUCan Enclosure Wizard - 01-core.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ================================================================ Enclosure Wizard + Parts Library
// Designs a printable box (base + lid) around electronic parts: a parts library (with photo measuring),
// an automatic layout that follows placement rules, and solid modelling with the embedded Manifold
// engine. Everything runs offline. © 2026 David John Waugh

const WF=window.WF || {};
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const num=(v,d)=>{const x=parseFloat(v);return isFinite(x)?x:d;};
const fx=v=>String(+(+v).toFixed(1));
const snap=v=>Math.round(v*2)/2;

// ---- platforms (r3). Each has its own controller board and its own code writer.
const PLATFORMS={
  esphome:{name:'ESP32 + ESPHome',icon:'📶',board:'b-esp32s3',code:'ESPHome YAML',
    about:'An ESP32-S3 with Wi-Fi built in. The code is an ESPHome settings file EvenUCan writes for you; you put it on the board from ESPHome Device Builder. Best when it talks to your phone, the internet or Home Assistant.'},
  esp32ide:{name:'ESP32 + Arduino IDE',icon:'📡',board:'b-esp32s3',code:'Arduino sketch (.ino)',
    about:'The same ESP32-S3 with Wi-Fi built in, but programmed with the free Arduino IDE. Your AI writes a sketch that can send messages to your phone. A one-time step adds the ESP32 boards to the Arduino IDE.',
    tool:{check:'arduino',name:'the Arduino IDE',url:'https://www.arduino.cc/en/software',why:'to upload the sketch to the board'}},
  arduino:{name:'Arduino',icon:'🔌',board:'p-cm-nano',code:'Arduino sketch (.ino)',
    about:'An Arduino Nano: simple, sturdy and cheap, with no Wi-Fi. Your AI writes a sketch you upload with the free Arduino IDE. Best for sensors, lights and beeps that work on their own.',
    tool:{check:'arduino',name:'the Arduino IDE',url:'https://www.arduino.cc/en/software',why:'to upload the sketch to the board'}},
  raspberrypi:{name:'Raspberry Pi',icon:'🍓',board:'p-cm-rpi4',code:'Python program (.py)',
    about:'A Raspberry Pi 4: a small computer running Linux. Your AI writes a Python program. It can do almost anything, but the box is bigger and it needs a good 5 V 3 A USB-C supply.',
    tool:{check:'vscode',name:'VS Code',url:'https://code.visualstudio.com/download',why:'to copy the file onto the Pi and run it there over Remote-SSH (or use any other editor/SFTP tool you already have)'}}
};
const pfOk=p=>PLATFORMS[p]?p:'esphome';
const pfNorm=s=>{s=String(s||'').toLowerCase();return /rasp|\bpi\b|python/.test(s)?'raspberrypi':/arduino|nano|uno|mega|atmega/.test(s)?'arduino':'esphome';};
// Arduino Nano (ATmega328P): D2–D13 and A0–A3 for signals, A4/A5 (pins 18/19) are the I2C bus, so they come last.
const NANO_POS=(()=>{const o={},a=['D13','3V3','AREF','A0','A1','A2','A3','A4','A5','A6','A7','5V','RST','GND','VIN'],b=['D12','D11','D10','D9','D8','D7','D6','D5','D4','D3','D2','GND2','RST2','RX0','TX1'];
  a.forEach((n,i)=>o[n]=[+(4.4+i*2.54).toFixed(2),1.27]);b.forEach((n,i)=>o[n]=[+(4.4+i*2.54).toFixed(2),16.51]);return o;})();
const nanoPin=(key,n,r,g)=>{const q={n,r,x:NANO_POS[key][0],y:NANO_POS[key][1]};if(g!==undefined)q.g=g;return q;};
const NANO_PINS=[...[2,3,4,5,6,7,8,9,10,11,12,13].map(d=>nanoPin('D'+d,'D'+d,'gpio',d)),...[0,1,2,3].map(k=>nanoPin('A'+k,'A'+k,'gpio',14+k)),
  nanoPin('A4','A4 (SDA)','gpio',18),nanoPin('A5','A5 (SCL)','gpio',19),nanoPin('5V','5V','5v'),nanoPin('3V3','3V3','3v3'),nanoPin('GND','GND','gnd'),nanoPin('GND2','GND','gnd'),
  nanoPin('VIN','VIN','vin'),nanoPin('AREF','AREF','nc'),nanoPin('RST','RST','nc'),nanoPin('RST2','RST','nc'),nanoPin('A6','A6 (analog only)','nc'),nanoPin('A7','A7 (analog only)','nc'),nanoPin('RX0','RX0','nc'),nanoPin('TX1','TX1','nc')];
// Raspberry Pi 40-pin header (BCM numbers). Odd pins on the inner row, even on the edge row; I2C (2/3) last.
const PI_HDR=['3V3','5V','2','5V','3','GND','4','14','GND','15','17','18','27','GND','22','23','3V3','24','10','GND','9','25','11','8','GND','7','0','1','5','GND','6','12','13','GND','19','16','26','20','GND','21'];
const PI_PINS=(()=>{
  const at=k=>({x:+(8.37+Math.floor(k/2)*2.54).toFixed(2),y:k%2?53.77:51.23});
  const all=PI_HDR.map((n,k)=>{const p=at(k);
    if(/^\d+$/.test(n)){const g=+n;return g===14?{n:'TX (GPIO14)',r:'nc',g,...p}:g===15?{n:'RX (GPIO15)',r:'nc',g,...p}:g<2?{n:'ID_'+(g?'SC':'SD')+' (GPIO'+g+')',r:'nc',...p}:{n:'GPIO'+g+(g===2?' (SDA)':g===3?' (SCL)':''),r:'gpio',g,...p};}
    return {n,r:n==='3V3'?'3v3':n==='5V'?'5v':'gnd',...p};});
  const order=[17,27,22,23,24,25,5,6,12,13,16,19,20,21,26,18,4,7,8,9,10,11,2,3];
  return [...order.map(g=>all.find(p=>p.r==='gpio'&&p.g===g)),...all.filter(p=>p.r!=='gpio')];
})();
const CTRL_PARTS={
  arduino:{id:'p-cm-nano',name:'Arduino Nano (ATmega328P)',type:'board',w:43.18,d:17.78,pcb:1.6,h:4,below:8.5,mount:'floor',mcu:'atmega328p',i2c:[18,19],pins:NANO_PINS,
    features:[{t:'port',kind:'Mini-USB',side:'xmin',u:8.89,zc:2,pw:9,ph:5},{t:'header',x:21.6,y:1.27,fw:38.1,fd:2.54,dir:'down'},{t:'header',x:21.6,y:16.51,fw:38.1,fd:2.54,dir:'down'}]},
  raspberrypi:{id:'p-cm-rpi4',name:'Raspberry Pi 4 Model B',type:'board',w:85,d:56,pcb:1.4,h:16,below:2.5,mount:'floor',mcu:'bcm2711',i2c:[2,3],pins:PI_PINS,
    features:[{t:'hole',x:3.5,y:3.5,dia:2.7},{t:'hole',x:61.5,y:3.5,dia:2.7},{t:'hole',x:3.5,y:52.5,dia:2.7},{t:'hole',x:61.5,y:52.5,dia:2.7},
      {t:'port',kind:'USB-C power',side:'ymin',u:11.2,zc:2,pw:10,ph:4.5},{t:'port',kind:'2× micro-HDMI',side:'ymin',u:32.8,zc:2,pw:22,ph:4.5},
      {t:'port',kind:'USB + Ethernet',side:'xmax',u:28,zc:8,pw:54,ph:16},{t:'header',x:32.5,y:52.5,fw:51,fd:5.1,dir:'up'}]}
};
// The board the user said they own (first-run step); a new project starts from it instead of the built-in ESP32-S3
const PREF_BOARDS=['b-esp32s3','p-esp32-devkit38','p-esp32c3-supermini','p-d1mini'];
const prefBoard=function prefBoard(){
  // a board that is plugged in right now wins; otherwise the one remembered from before
  try{const d=bwDetected,p=d&&d.ok&&BW_PART[d.family];if(p&&PREF_BOARDS.includes(p))return p;}catch(e){/* detection not started yet */}
  try{const b=WF.store.get('pref_board');return PREF_BOARDS.includes(b)?b:'';}catch(e){return '';}
};
// short family name of the board a new project starts from ("ESP32", "ESP32-S3"...), for sentences
const prefBoardFamily=function prefBoardFamily(){const f={'b-esp32s3':'ESP32-S3','p-esp32-devkit38':'ESP32','p-esp32c3-supermini':'ESP32-C3','p-d1mini':'ESP8266'};return f[prefBoard()]||'ESP32-S3';};
const CTRL_IDS=[...Object.values(PLATFORMS).map(p=>p.board),'p-esp32-devkit38','p-esp32c3-supermini','p-d1mini'];
const ctrlPart=function ctrlPart(pf,partId){pf=pfOk(pf);return pf==='esphome'||pf==='esp32ide'?(typeof builtinById==='function'?builtinById(partId||prefBoard()||'b-esp32s3'):null):(typeof commonPart==='function'?commonPart({part:CTRL_PARTS[pf]}):(_int.commonPart?_int.commonPart({part:CTRL_PARTS[pf]}):null));};
const pfMatches=function pfMatches(base,pf){
  pf=pfOk(pf);const P=PLATFORMS[pf];
  const out=base.map(m=>m.from!=='wifi'?m:pf==='arduino'?Object.assign({},m,{from:'removed',note:'Removed: the Arduino Nano has no Wi-Fi, so this part isn\'t used.'}):Object.assign({},m,{from:'skip',note:'Wi-Fi is built into the '+(pf!=='raspberrypi'?'ESP32':'Raspberry Pi')+', so no extra part is needed.'}));
  const c=ctrlPart(pf);
  out.unshift({spec:{category:'microcontrollers',function:'The brain of the device: runs the code'+(pf==='arduino'?'.':' and connects to Wi-Fi.'),search:P.name,required:true},part:c,ctrl:true,
    from:pf==='esphome'?'built-in part (Wi-Fi, ready for ESPHome)':pf==='esp32ide'?'built-in part (Wi-Fi, for the Arduino IDE)':'common board for '+P.name,note:c?'':'Couldn\'t add this board to your parts (is the storage full?).'});
  return out;
};

window.WFEnclosure = window.WFEnclosure || {};
const _int = window.WFEnclosure._internal = {
  WF, $, esc, clone, num, fx, snap,
  PLATFORMS, pfOk, pfNorm, CTRL_PARTS, CTRL_IDS, ctrlPart, pfMatches,
  get custom() { return custom; },
  set custom(v) { custom = v; },
  get wiz() { return wiz; },
  set wiz(v) { wiz = v; },
  get wr() { return wr; },
  set wr(v) { wr = v; },
  get lay() { return lay; },
  set lay(v) { lay = v; },
  get iwBack() { return $('iwBack'); },
  get typeOf() { return typeOf; },
  get ideName() { return typeof ideName !== 'undefined' ? ideName : null; },
  get gStep() { return typeof gStep !== 'undefined' ? gStep : null; },
  set gStep(v) { if (typeof gStep !== 'undefined') gStep = v; },
  get pfCode() { return typeof pfCode !== 'undefined' ? pfCode : null; },
  set pfCode(v) { if (typeof pfCode !== 'undefined') pfCode = v; },
  get pfMsg() { return typeof pfMsg !== 'undefined' ? pfMsg : ''; },
  set pfMsg(v) { if (typeof pfMsg !== 'undefined') pfMsg = v; },
  get partsSrc() { return typeof partsSrc !== 'undefined' ? partsSrc : null; },
  set partsSrc(v) { if (typeof partsSrc !== 'undefined') partsSrc = v; },
  get ed() { return typeof ed !== 'undefined' ? ed : null; },
  set ed(v) { if (typeof ed !== 'undefined') ed = v; },
  get edDirty() { return typeof edDirty !== 'undefined' ? edDirty : false; },
  set edDirty(v) { if (typeof edDirty !== 'undefined') edDirty = v; },
  get edMode() { return typeof edMode !== 'undefined' ? edMode : 'select'; },
  set edMode(v) { if (typeof edMode !== 'undefined') edMode = v; },
  get clicks() { return typeof clicks !== 'undefined' ? clicks : []; },
  set clicks(v) { if (typeof clicks !== 'undefined') clicks = v; },
  get rawImg() { return typeof rawImg !== 'undefined' ? rawImg : null; },
  set rawImg(v) { if (typeof rawImg !== 'undefined') rawImg = v; },
  get plBig() { return typeof plBig !== 'undefined' ? plBig : false; },
  set plBig(v) { if (typeof plBig !== 'undefined') plBig = v; }
};

const iw = new Proxy({}, {
  get(_, k) { return _int.iw ? _int.iw[k] : undefined; },
  set(_, k, v) { if (_int.iw) _int.iw[k] = v; return true; }
});
const renderIntent = (...args) => _int.renderIntent && _int.renderIntent(...args);
const closeIntent = (...args) => _int.closeIntent && _int.closeIntent(...args);

// Global Window proxies for menu and cross-script calls
window.openCookbook = function(...args) {
  if (_int.openCookbook) return _int.openCookbook(...args);
  const b = $('bCookbook'); if (b) return b.click();
};
window.openUniversalAiChat = function(...args) {
  if (_int.openUniversalAiChat) return _int.openUniversalAiChat(...args);
};
window.openIntent = function(...args) {
  if (_int.openIntent) return _int.openIntent(...args);
  const b = $('ewIntent'); if (b) return b.click();
};
window.openWelcome = function(...args) {
  if (_int.openWelcome) return _int.openWelcome(...args);
  const b = $('bBuild'); if (b) return b.click();
};
window.openWizard = function(...args) { if (typeof openWizard !== 'undefined') return openWizard(...args); };
window.openLibrary = function(...args) { if (typeof openLibrary !== 'undefined') return openLibrary(...args); };
window.openWiring = function(...args) { if (typeof openWiring !== 'undefined') return openWiring(...args); };
window.openCodeGated = function(...args) { if (typeof openCodeGated !== 'undefined') return openCodeGated(...args); };
window.askKey = function(...args) { if (typeof askKey !== 'undefined') return askKey(...args); };
window.ewProjSave = function(...args) { if (typeof ewProjSave !== 'undefined') return ewProjSave(...args); };
window.exportBackup = function(...args) { if (_int.exportBackup) return _int.exportBackup(...args); };
window.importBackup = function(...args) { if (_int.importBackup) return _int.importBackup(...args); };
window.theSurgery = function(...args) { if (_int.theSurgery) return _int.theSurgery(...args); };
window.briefDoctor = function(...args) { if (_int.briefDoctor) return _int.briefDoctor(...args); };

const intentNow = () => (_int.intentNow ? _int.intentNow() : null);
const INTENT_KEY = 'intent';
// (bridge) editor functions the other files need
_int.renderEditor = (...a) => renderEditor(...a);
_int.setBig = (...a) => setBig(...a);   // the saved idea; the same key ai-and-surgery.js uses (it is private to that file, so it is repeated here)
const intentSubs = () => (_int.intentSubs ? _int.intentSubs() : '');
const intentInputs = (it) => (_int.intentInputs ? _int.intentInputs(it) : {});
const intentAINote = () => (_int.intentAINote ? _int.intentAINote() : '');
const intentWeather = () => (_int.intentWeather ? _int.intentWeather() : null);
const openIntent = (...args) => _int.openIntent && _int.openIntent(...args);
const openWelcome = (...args) => _int.openWelcome && _int.openWelcome(...args);
const openStartupChoice = (...args) => _int.openStartupChoice && _int.openStartupChoice(...args);
const openSetup = (...args) => _int.openSetup && _int.openSetup(...args);
const askHtml = (...args) => _int.askHtml && _int.askHtml(...args);
const askConfirm = (...args) => _int.askConfirm && _int.askConfirm(...args);
const intentCode = (...args) => _int.intentCode && _int.intentCode(...args);
