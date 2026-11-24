// EvenUCan Enclosure Wizard - 16-open-in-ide.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- (handoff-r1) "Open in ESPHome / Arduino IDE / Thonny": put the file where that program looks for it, open the
// program when that is possible, and keep a step-by-step guide on screen (in #wfGuide) until the board runs.
// A web page can't start programs (Arduino IDE 2 and Thonny have no web link that opens them), but with the user's
// OK Chrome and Edge can save straight into a folder (File System Access API); the folder is remembered (IndexedDB).
// ESPHome's dashboard lists every .yaml in its folder and runs as a web page on localhost:6052, so that opens in a tab.
const toolName=pf=>pf==='esphome'?'ESPHome':pf==='raspberrypi'?'Thonny':'Arduino IDE';
const openLabel=pf=>'Open in '+toolName(pf);
const ESPH_DASH='http://localhost:6052';
let ho=null;// the guide: {pf,name,base,text,how:'saved'|'download',where,dash,secrets,launched,copied,note,ticks,open}
const esphomeUp=function esphomeUp(){// the dashboard sends no CORS headers: any answer at all means it is running
  return new Promise(res=>{const ac=window.AbortController?new AbortController():null;
    const t=setTimeout(()=>{if(ac)ac.abort();res(false);},2500);
    fetch(ESPH_DASH+'/',{mode:'no-cors',cache:'no-store',signal:ac?ac.signal:undefined}).then(()=>{clearTimeout(t);res(true);},()=>{clearTimeout(t);res(false);});});
};
const HO_ALLOW='<p class="ewNote" style="margin:6px 0 0">Your browser then asks if EvenUCan may save files there: click <b>Edit files</b> (or <b>Allow</b>).</p>';
const HO_DIR={
  esphome:{key:'dir:esphome',ask:'<div class="kHead"><b>📶 Where is your ESPHome folder?</b></div><p style="margin:0 0 6px">So EvenUCan can put your device straight into ESPHome, pick the folder ESPHome keeps its devices in. You only do this once.</p><ul style="margin:0;padding-left:20px"><li>The <b>ESPHome Device Builder</b> app uses the <b>esphome</b> folder in your user folder (on Windows <code>C:\\Users\\<i>your name</i>\\esphome</code>, on a Mac or Linux <code>esphome</code> in your home folder).</li><li>Run ESPHome another way? Pick its config folder: the one with your other .yaml files.</li></ul>'+HO_ALLOW},
  arduino:{key:'dir:arduino',ask:'<div class="kHead"><b>🔌 Where is your Arduino sketchbook?</b></div><p style="margin:0 0 6px">So the sketch shows up in the Arduino IDE under <b>File → Sketchbook</b>, pick your sketchbook folder. You only do this once.</p><ul style="margin:0;padding-left:20px"><li>It is usually the <b>Arduino</b> folder inside <b>Documents</b>.</li><li>Not sure? In the Arduino IDE, <b>File → Preferences</b> shows it as "Sketchbook location".</li></ul>'+HO_ALLOW},
  raspberrypi:{key:'dir:pi',ask:'<div class="kHead"><b>🍓 Where should your Pi programs go?</b></div><p style="margin:0 0 6px">Pick a folder to keep them in: for example make a folder called <b>EvenUCan</b> inside <b>Documents</b>. You only do this once, and Thonny opens the program from there.</p>'+HO_ALLOW}
};
const hoKind=pf=>pf==='esphome'?'esphome':pf==='raspberrypi'?'raspberrypi':'arduino';
// The remembered folder (asking for permission again if the browser forgot it), or a new pick. null = just download.
const hoFolder=async function hoFolder(pf,fresh){
  if(!window.showDirectoryPicker)return null;
  const D=HO_DIR[hoKind(pf)];let h=null;
  if(!fresh){try{h=await idbGet(D.key);}catch(e){console.warn('EvenUCan: no remembered folder',e);}}
  if(h){
    try{let p=await h.queryPermission({mode:'readwrite'});if(p!=='granted')p=await h.requestPermission({mode:'readwrite'});if(p==='granted')return h;}
    catch(e){console.warn('EvenUCan: no permission for the remembered folder',e);}
  }
  if(await askHtml(D.ask,['Just download it','Choose the folder…'],1)!==1)return null;
  try{h=await window.showDirectoryPicker({id:'evenucan-'+hoKind(pf),mode:'readwrite',startIn:'documents'});}
  catch(e){if(e&&e.name==='AbortError')return null;console.warn('EvenUCan: folder picker failed',e);WF.flash('That folder can\'t be used ('+(e.message||e)+'), so it was downloaded instead.',7000);return null;}
  try{await idbSet(D.key,h);}catch(e){console.warn('EvenUCan: could not remember the folder',e);}
  return h;
};
// Write text to dir/path (path: ['sub', ..., 'file']). Asks before replacing a different file; false = the user said no.
const hoWrite=async function hoWrite(dir,path,text){
  let d=dir;for(const s of path.slice(0,-1))d=await d.getDirectoryHandle(s,{create:true});
  const fn=path[path.length-1];
  try{const old=await (await (await d.getFileHandle(fn)).getFile()).text();
    if(old!==text&&!await askConfirm('There is already a different file called "'+fn+'" in '+dir.name+'.\n\nReplace it with this one?'))return false;}
  catch(e){if(!e||e.name!=='NotFoundError')throw e;}
  const w=await (await d.getFileHandle(fn,{create:true})).createWritable();await w.write(text);await w.close();
  return true;
};
// Libraries for the Arduino IDE's Library Manager: the sketch's own LIBRARIES_NEEDED list, plus its #include lines.
const INC_LIB={'DHT.h':'DHT sensor library','DHT_U.h':'DHT sensor library','Adafruit_Sensor.h':'Adafruit Unified Sensor','Adafruit_SSD1306.h':'Adafruit SSD1306','Adafruit_GFX.h':'Adafruit GFX Library',
  'OneWire.h':'OneWire','DallasTemperature.h':'DallasTemperature','Adafruit_NeoPixel.h':'Adafruit NeoPixel','FastLED.h':'FastLED','Adafruit_BME280.h':'Adafruit BME280 Library','Adafruit_BMP280.h':'Adafruit BMP280 Library',
  'Adafruit_AHTX0.h':'Adafruit AHTX0','LiquidCrystal_I2C.h':'LiquidCrystal I2C','PubSubClient.h':'PubSubClient','ArduinoJson.h':'ArduinoJson','BH1750.h':'BH1750','U8g2lib.h':'U8g2','RTClib.h':'RTClib',
  'Adafruit_MPU6050.h':'Adafruit MPU6050','MFRC522.h':'MFRC522','IRremote.h':'IRremote','IRremote.hpp':'IRremote','HX711.h':'HX711 Arduino Library','NewPing.h':'NewPing','TM1637Display.h':'TM1637','Bounce2.h':'Bounce2','AccelStepper.h':'AccelStepper'};
const INC_BUILTIN=/^(Arduino|Wire|SPI|WiFi|WiFiClient|WiFiClientSecure|WiFiMulti|HTTPClient|WebServer|ESPmDNS|EEPROM|Preferences|SoftwareSerial|Servo|time|math|stdlib|string|FS|SPIFFS|LittleFS|SD|Update|esp_\w+|driver\/\w+|avr\/\w+|util\/\w+)\.h$/;
const hoLibs=function hoLibs(code){
  const out=[],add=n=>{n=String(n).replace(/^[\s\-*•·]+|[\s.]+$/g,'');if(n&&n.length<50&&!/none|built-?in|^only\b/i.test(n)&&!out.includes(n))out.push(n);};
  const lines=String(code).split(/\r?\n/),i=lines.findIndex(l=>/LIBRARIES_NEEDED:/.test(l));
  if(i>=0){
    add(lines[i].split('LIBRARIES_NEEDED:')[1]||'');
    for(let k=i+1;k<lines.length&&k<i+15;k++){const m=lines[k].match(/^\s*(?:\/\/|\*)\s*(.*)$/);if(!m||!m[1].trim()||/[.:]$/.test(m[1].trim())||m[1].trim().split(/\s+/).length>6)break;add(m[1]);}
  }
  for(const m of String(code).matchAll(/^\s*#include\s*[<"]([^>"]+)[>"]/gm)){const h=m[1].trim();if(INC_BUILTIN.test(h))continue;if(INC_LIB[h]){if(!out.includes(INC_LIB[h]))add(INC_LIB[h]);}else if(!out.some(x=>x.replace(/\s+/g,'').toLowerCase().includes(h.replace(/\.h(pp)?$/,'').replace(/_/g,'').toLowerCase())))add('(the library for '+h+')');}
  return out;
};
const hoPips=code=>[...new Set([...String(code).matchAll(/#\s*(?:sudo\s+)?pip3?\s+install\s+([A-Za-z0-9_.\-\[\]]+)/g)].map(m=>m[1]))];
const hoA=(href,txt)=>`<a href="${href}" target="_blank" rel="noopener">${txt}</a>`;
const HO_USB='<li>No port to pick, or nothing happens when you plug it in? Try a different USB cable: many cheap cables only charge and carry no data.</li><li>Still nothing? The board may need a USB driver. Look at the small chip next to the USB socket: <b>CH340</b> needs the '+hoA('https://www.wch-ic.com/downloads/CH341SER_EXE.html','CH340 driver')+', <b>CP2102</b> / <b>CP210x</b> needs the '+hoA('https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers','CP210x driver')+'. Install it, then unplug the board and plug it in again.</li>';
const HO_AIFIX='<li>Red error lines? Select them, copy them (Ctrl+C), open <b>🔌 Wiring → Ask AI</b> in EvenUCan, paste them and ask it to fix the code. Then click <b>'+'Open in …</b> again.</li>';
// The steps, each [what to do, help if it didn't work], for the program the code is for.
const hoSteps=function hoSteps(g){
  const S=[],nm=esc(g.name),base=esc(g.base),where=esc(g.where||''),T=g.text||'',dl=g.how==='download';
  const pasteHelp='<li>Paste did nothing? Click <b>Copy code</b> at the bottom of this panel, then paste again (Ctrl+V, or ⌘V on a Mac).</li>';
  if(g.pf==='esphome'){
    const dev=esc(esphForm().name||g.base),open=hoA(ESPH_DASH,'Open ESPHome');
    S.push([g.dash==='opened'?'ESPHome is open in a new browser tab. (No tab? '+open+'.)':g.dash==='app'?'ESPHome Device Builder is starting: its window opens in a moment.':g.dash==='blocked'?'ESPHome is running: click '+open+'.':'Start <b>ESPHome Device Builder</b> (from the Start menu, or Applications on a Mac). When it is running, click '+open+'.',
      '<li>Not installed yet? Get it free from '+hoA('https://esphome.io/install/','esphome.io/install')+', open it once, then click '+open+'.</li><li>The page says it can\'t connect? ESPHome isn\'t running yet: start ESPHome Device Builder, wait a minute, then refresh the page (F5).</li>']);
    S.push([dl?'Add your device: click <b>+ New device</b>, then <b>Skip</b> the questions. On the new card click <b>Edit</b>, select everything (Ctrl+A), paste (the file is already copied) and click <b>Save</b>.':'Find the card called <b>'+dev+'</b> (the file <b>'+nm+'</b>): it is already in ESPHome.',
      dl?pasteHelp+'<li>The file is also in your Downloads folder as <b>'+nm+'</b>.</li>':'<li>Not there? Refresh the ESPHome page (F5).</li><li>Still not there? ESPHome is using a different folder from <b>'+where+'</b>. Click <b>Choose a different folder</b> at the bottom and pick the one ESPHome uses (it holds your other .yaml files and secrets.yaml).</li>']);
    if(/!secret\s+wifi/.test(T))S.push([g.secrets?'Your Wi-Fi name and password are already in ESPHome\'s <b>Secrets</b>.':'Give ESPHome your Wi-Fi: click <b>Secrets</b> (top right), add these two lines with your own Wi-Fi name and password, and click <b>Save</b>:<pre class="hoPre">wifi_ssid: "your Wi-Fi name"\nwifi_password: "your Wi-Fi password"</pre>',
      '<li>"Secret not defined"? The names must be exactly <code>wifi_ssid</code> and <code>wifi_password</code>.</li><li>ESP32 boards only join 2.4 GHz Wi-Fi, not 5 GHz-only networks.</li>']);
    S.push(['Plug the board into this computer with a USB cable. On the card click <b>Install</b>, then <b>Plug into this computer</b>, and pick the board\'s port.',
      HO_USB+'<li>No "Plug into this computer"? It needs Chrome or Edge: open ESPHome in one of those.</li><li>Stuck on "Connecting…"? Hold the <b>BOOT</b> button on the board until it starts writing.</li>']);
    S.push(['Wait while ESPHome builds it and writes it to the board. The first time takes 5–10 minutes. When it says <b>Done</b> (or the board\'s log starts scrolling), it is on your board.',
      HO_AIFIX.replace('Open in …','Open in ESPHome')+'<li>Installed, but the card says <b>Offline</b>? Check the Wi-Fi name and password in Secrets, then Install again.</li>']);
    return S;
  }
  if(isIno(g.pf)){
    const esp=g.pf==='esp32ide',libs=hoLibs(T);
    S.push([g.launched==='ide'?'The <b>Arduino IDE</b> is opening with your sketch.':g.launched==='default'?'Your sketch is opening in the program this computer uses for .ino files (normally the Arduino IDE).':'Open the <b>Arduino IDE</b>.',
      '<li>Not installed yet? Get it free from '+hoA('https://www.arduino.cc/en/software','arduino.cc/en/software')+', install it and open it once.</li>']);
    S.push([g.launched?'Your sketch <b>'+base+'</b> is open (it is saved in '+where+').':dl?'Click <b>File → Open…</b> and pick <b>'+nm+'</b> in your Downloads folder. If it offers to make a folder for it, click <b>OK</b>.':'Click <b>File → Sketchbook → '+base+'</b>.',
      dl?'<li>Or: <b>File → New Sketch</b>, select everything in it and paste: the code is already copied.</li>'+pasteHelp:g.launched?'<li>It didn\'t open? In the Arduino IDE click <b>File → Open…</b> and pick <b>'+nm+'</b> in '+where+'.</li>':'<li>Not in the Sketchbook list? Close the Arduino IDE and open it again.</li><li>Still not there? The Arduino IDE only lists the folder shown in <b>File → Preferences → Sketchbook location</b>. Click <b>Choose a different folder</b> at the bottom and pick that folder, or use <b>File → Open…</b> and open <b>'+where+'</b>.</li>']);
    if(esp)S.push(['<b>First time only, add the ESP32 boards:</b> <b>File → Preferences</b>, paste <code>https://espressif.github.io/arduino-esp32/package_esp32_index.json</code> into "Additional boards manager URLs" and click <b>OK</b>. Then <b>Tools → Board → Boards Manager</b>, search <b>esp32</b> and install <b>esp32 by Espressif Systems</b>.',
      '<li>"esp32" not found? Check the address was pasted exactly, click OK, and wait a moment for the list to download.</li>']);
    S.push(['Pick the board: <b>Tools → Board → '+(esp?'esp32 → ESP32S3 Dev Module':'Arduino AVR Boards → Arduino Nano')+'</b>. Plug it in by USB and pick it in <b>Tools → Port</b>.',
      HO_USB+(esp?'':'<li>Upload fails with "not in sync"? Many Nano copies need <b>Tools → Processor → ATmega328P (Old Bootloader)</b>.</li>')]);
    S.push([libs.length?'Install the libraries it uses: <b>Tools → Manage Libraries…</b>, search for each name and click <b>Install</b>:<ul class="hoLibs">'+libs.map(l=>'<li><b>'+esc(l)+'</b></li>').join('')+'</ul>':'No extra libraries are needed.',
      '<li>Upload says "No such file or directory" with a .h name? That library is missing: search for that name in the Library Manager.</li><li>Asked to install "dependencies"? Click <b>Install all</b>.</li>']);
    if(/WIFI_SSID/.test(T))S.push(['Near the top of the sketch, type your Wi-Fi name and password between the quotes after <b>WIFI_SSID</b> and <b>WIFI_PASSWORD</b> (if they aren\'t filled in already).',
      '<li>ESP32 boards only join 2.4 GHz Wi-Fi, not 5 GHz-only networks.</li><li>Keep the quotes: <code>"MyWiFi"</code>.</li>']);
    S.push(['Click <b>Upload</b> (the → arrow at the top) and wait for <b>Done uploading</b> at the bottom.',
      HO_AIFIX.replace('Open in …','Open in Arduino IDE')+'<li>"Port busy" or "access denied"? Close the Serial Monitor and any other program using the board.</li>'+(esp?'<li>Stuck on "Connecting…"? Hold the <b>BOOT</b> button on the board until it starts writing.</li>':'')]);
    return S;
  }
  const pips=hoPips(T);
  S.push([g.launched==='ide'?'<b>Thonny</b> is opening with your program.':g.launched==='default'?'Your program is opening in the program this computer uses for .py files.':'Open <b>Thonny</b>.',
    '<li>Not installed yet? Get it free from '+hoA('https://thonny.org/','thonny.org')+'. On a Raspberry Pi it is already there: <b>Menu → Programming → Thonny</b>.</li>']);
  S.push([g.launched?'Your program <b>'+nm+'</b> is open (it is saved in '+where+').':'Click <b>File → Open…</b> and pick <b>'+nm+'</b> '+(dl?'in your Downloads folder':'in '+where)+'.',
    dl?'<li>Or: <b>File → New</b> and paste: the code is already copied.</li>'+pasteHelp:'<li>Can\'t find it? It is in '+where+'.</li>']);
  S.push(['It must run on the Pi. Thonny on the Pi itself: nothing to do. Thonny on another computer: <b>Run → Configure interpreter…</b>, choose <b>Remote Python 3 (SSH)</b> and type your Pi\'s address, user name and password.',
    '<li>"No module named RPi"? It is running on this computer instead of the Pi: do this step.</li>']);
  if(pips.length)S.push(['On the Pi, install what it needs: <b>Tools → Manage packages…</b> in Thonny (or <code>pip install</code> on the Pi), for:<ul class="hoLibs">'+pips.map(l=>'<li><b>'+esc(l)+'</b></li>').join('')+'</ul>'+(/raspi-config/.test(T)?'Also do the <b>sudo raspi-config</b> step written at the top of the program (for example turn on I2C).':''),
    '<li>"externally-managed-environment"? On new Raspberry Pi OS use <code>sudo apt install python3-<i>name</i></code>, or tick "virtual environment" in Thonny.</li>']);
  S.push(['Click the green ▶ <b>Run</b> button. The red ■ <b>Stop</b> button stops it.',HO_AIFIX.replace('Open in …','Open in Thonny')]);
  return S;
};
const drawHandoff=function drawHandoff(el){
  const g=ho,steps=hoSteps(g),topic=intentTopic(),tn=toolName(g.pf);
  const strip=G_STEPS.map(([k,l],i)=>i<G_STEPS.length-1?`<span class="gd">${l} ✓</span>`:`<b>${l}</b>`).join(' → ');
  const head=g.how==='saved'?'✓ Saved <b>'+esc(g.name)+'</b>'+(g.where?' in <b>'+esc(g.where)+'</b>':'')+'.'
    :'⬇ Downloaded <b>'+esc(g.name)+'</b> to your Downloads folder'+(g.copied?' and copied the code':'')+'.'+(!window.showDirectoryPicker&&!window.wfNative?' <span class="ewNote">(This browser can\'t save into a folder for you; Chrome and Edge can.)</span>':'');
  el.innerHTML=`<div class="gStrip">${strip}</div><div style="font-size:15px;font-weight:600;margin:2px 0">Put it on your board with ${esc(tn)}</div><div>${head}</div>`+
    (g.note?`<div class="warn" style="margin:4px 0">${esc(g.note)}</div>`:'')+
    `<div class="ewNote" style="margin-top:4px">Do each step, tick it off, and open <b>Help, this didn't work</b> if you get stuck.</div><ol class="hoSteps">`+
    steps.map(([s,h],i)=>`<li class="${g.ticks[i]?'done':''}"><label><input type="checkbox" data-hotick="${i}"${g.ticks[i]?' checked':''}> <span>${s}</span></label>`+
      (h?`<details data-hohelp="${i}"${g.open[i]?' open':''}><summary>Help, this didn't work</summary><ul>${h}</ul></details>`:'')+'</li>').join('')+'</ol>'+
    (topic?`<div class="ntfyBox" style="margin:6px 0"><b>📱 Phone messages:</b> subscribe in the ntfy app to <span class="topic">${esc(topic)}</span><button data-copytext="${esc(topic)}">Copy topic</button><div class="ewNote">Install the free <b>ntfy</b> app, tap <b>+</b> and paste this name (server: ntfy.sh).</div></div>`:'')+
    `<div class="gBtns"><button id="hoDone" class="primary">✅ It's on my board!</button><button id="hoSaveProject" class="primary" style="font-weight:bold" title="Save the complete project as a 3MF — idea, parts, box, wiring and code all in one file">💾 Save project (.3mf)</button></div><div class="gBtns hoSmall"><button id="hoCopy">Copy code</button><button id="hoSave">Download again</button>`+
    (g.pf==='esphome'?`<a class="hoBtn" href="${ESPH_DASH}" target="_blank" rel="noopener">Open ESPHome</a>`:'')+
    (window.showDirectoryPicker||(window.wfNative&&window.wfNative.chooseFolder)?'<button id="hoFolder">Choose a different folder</button>':'')+
    '<button id="hoBack">← Back to the code</button><button id="gRestart" class="linkBtn">Start again from the beginning</button></div>';
  el.className='ho';el.style.display='block';
};
// The main button everywhere. fresh: pick the folder again ("Choose a different folder").
const openInIde=async function openInIde(fresh){
  const c=currentCode();if(!c){WF.flash('Write the code first.',5000);return false;}
  const pf=c.pf,N=window.wfNative||{};
  if(pf==='esphome'&&wr&&wr.ai&&wr.ai.ok===false&&!await askConfirm('ESPHome found a problem in the AI\'s file.\nOpen it in ESPHome anyway?'))return false;
  const base=c.name.replace(/\.(ya?ml|ino|py)$/i,'');
  const g={pf,name:c.name,base,text:c.text,how:'',where:'',dash:null,secrets:null,launched:'',copied:false,note:'',ticks:{},open:{}};
  try{
    // desktop app: it saves the file itself and starts the program (window.wfNative, see electron/native.js)
    if(fresh&&N.chooseFolder){const r=await N.chooseFolder(pf==='esphome'?'esphome':pf==='raspberrypi'?'pi':'arduino');if(!r||!r.ok)return false;}
    if(pf==='esphome'&&N.esphomeSend){
      let r=await N.esphomeSend(c.text,base,false);
      if(r&&r.exists){if(!await askConfirm('ESPHome already has a different device file called "'+base+'.yaml".\n\nReplace it with this one?'))return false;r=await N.esphomeSend(c.text,base,true);}
      if(r&&r.found&&r.ok!==false){g.how='saved';g.where=r.dir||'your ESPHome folder';g.secrets=!!r.secretsOk;g.dash=r.opened==='dashboard'||r.opened==='started'?'opened':r.opened==='app'?'app':'down';}
      if(r&&r.err)g.note=r.err;
    }else if(pf!=='esphome'&&N.openInIde){
      const r=await N.openInIde(pf==='raspberrypi'?'pi':'arduino',c.text,c.name);
      if(r&&r.ok){g.how='saved';g.where=r.dir||'';g.launched=r.launched||'';}
      if(r&&r.err)g.note=r.err;
    }else{
      const dir=await hoFolder(pf,fresh);
      if(dir){
        const path=isIno(pf)?[base,base+'.ino']:[c.name];
        if(!await hoWrite(dir,path,c.text)){WF.flash('Nothing was replaced. Change the device name to keep both.',6000);return false;}
        g.how='saved';g.where=dir.name+(isIno(pf)?' → '+base:'');
        if(pf==='esphome'){try{g.secrets=/wifi_ssid/.test(await (await (await dir.getFileHandle('secrets.yaml')).getFile()).text());}catch(e){g.secrets=false;}}
      }
    }
  }catch(e){console.error('EvenUCan: open in '+toolName(pf)+' failed',e);g.how='';g.note='Couldn\'t save it there ('+(e.message||e)+'), so it was downloaded instead.';}
  if(!g.how){
    try{await navigator.clipboard.writeText(c.text);g.copied=true;}catch(e){console.warn('EvenUCan: could not copy the code',e);}
    WF.download(c.name,c.text,'text/plain');g.how='download';
  }
  if(pf==='esphome'&&g.dash==null){
    g.dash=await esphomeUp()?'up':'down';
    if(g.dash==='up'){const w=window.open(ESPH_DASH,'_blank');if(w){try{w.opener=null;}catch(e){}g.dash='opened';}else g.dash='blocked';}
  }
  ho=g;closeWizard();closeWiring();
  if(iwBack.style.display==='grid'){iwBack.style.display='none';updateStrip();}
  gStep='ide';drawGuide();
  return true;
};
// After the parts step: change the board everywhere (parts, saved idea, wiring) in one click.
// which controller pin each part is wired to: {"Buzzer I/O":"GPIO5"} (empty if there is no usable plan)
const pinMapNow=function pinMapNow(){
  try{const P=planWiring();if(!P||P.error)return {};const m={};
    for(const a of (P.assigned||[]))m[a.inst.label+' '+(a.pin?a.pin.n:a.role)]=(a.c.g!==undefined?'GPIO'+a.c.g:a.c.n);
    return m;}catch(e){return {};}
};
// Parts already wired to the old board must be moved to the new pins: say exactly which ones, so nobody is left guessing.
const warnPinsMoved=async function warnPinsMoved(before,boardName){
  const after=pinMapNow(),moved=[];
  for(const k of Object.keys(after))if(before[k]&&before[k]!==after[k])moved.push('  • '+k+':  '+before[k]+'  →  '+after[k]);
  if(!moved.length)return;
  const i=await choose('Your project now uses the '+boardName+'. This board has different pins, so '+moved.length+' wire'+(moved.length>1?'s':'')+' must move.\n\nIf you have already connected these parts, re-wire them like this:\n\n'+moved.join('\n')+'\n\nThe Wiring window lists every connection for the new board. The code has been updated to match it.',['Show me the wiring','OK, I will check it']);
  if(i===0){try{openWiring();}catch(e){/* the Wiring window is always in the toolbar */}}
};
const switchBoard=function switchBoard(pf,partId){
  const before=pinMapNow();
  pf=pfOk(pf);const it=intentNow();
  if(it){it.platform=pf;WF.store.set(INTENT_KEY,JSON.stringify(it));}
  const c=ctrlPart(pf,partId);if(!c)return WF.flash('Couldn\'t add that board to your parts.',6000);
  wiz.items=wiz.items.filter(i=>!CTRL_IDS.includes(i.pid));wiz.items.unshift({pid:c.id,qty:1,mount:'auto',wall:'auto'});
  saveWiz();lay=null;pfCode=null;pfMsg='';if(wr)wr.ai=null;WF.store.set(ESPH_AI_KEY,'');
  if(iw.analysis){iw.pf=pf;iw.matches=pfMatches(iw.base,pf);}
  if(wrBack.style.display==='grid')openWiring();
  const bname=partId==='p-esp32-devkit38'?'ESP32 DevKit (classic)':partId==='p-esp32c3-supermini'?'ESP32-C3 Super Mini':partId==='p-d1mini'?'Wemos D1 Mini (ESP8266)':PLATFORMS[pf].name;
  WF.flash('Switched to '+bname+'.',4000);updateStrip();
  warnPinsMoved(before,bname);
};
// A one-click fix chosen after the parts step (the Code tab).
const capFixLater=function capFixLater(act){
  const it=intentNow();
  if(PLATFORMS[act])return switchBoard(act);
  if(/^drop-/.test(act)&&it){it.dropped=[...new Set([...(it.dropped||[]),act.slice(5)])];WF.store.set(INTENT_KEY,JSON.stringify(it));}
  else if(/^pow-/.test(act)){wiz.power=act.slice(4);if(it){it.power=wiz.power;WF.store.set(INTENT_KEY,JSON.stringify(it));}saveWiz();lay=null;pfCode=null;if(wrBack.style.display==='grid')openWiring();return;}
  if(wrBack.style.display==='grid')renderWiringSide();
};
const planIssues=P=>{const it=intentNow();if(!it)return [];return capIssues(pfOfPlan(P),it.desc,it.analysis,P.power,it.dropped);};
// Both writers send the same facts: the idea, every requirement, the board, the power, the parts, the connections and the pins.
const platformCodeAI=async function platformCodeAI(pf){
  const P=wr.plan,it=intentNow()||{},A=it.analysis||{},f=esphForm();
  const desc=(f.desc||'').trim()||String(it.desc||'').trim();
  const insts=[...new Set([P.ctrl,...P.nets.flatMap(n=>n.pins.map(p=>p.inst))])];
  const parts=insts.map(i=>'- '+i.label+(i.label!==i.part.name?' ('+i.part.name+')':'')+(i.part.protocol?', '+i.part.protocol:'')+(i.part.i2c_address?', I2C address '+i.part.i2c_address:'')).join('\n');
  const nets=P.nets.map(n=>'- '+n.name+': '+n.pins.map(p=>p.inst.label+' '+p.pin.n).join(', ')).join('\n');
  const num=pf==='raspberrypi'?'BCM GPIO ':pf==='esp32ide'?'GPIO ':'Arduino pin ';
  const pins=P.assigned.map(a=>'- '+a.inst.label+' '+(a.pin?a.pin.n:a.role.toUpperCase())+' ('+a.role+') -> '+P.ctrl.label+' '+a.c.n+(a.c.g!==undefined?' = '+num+a.c.g:'')+(a.shared?' (shared I2C bus)':'')).join('\n');
  // the user's answers: secrets (and the Wi-Fi name/password) stay out of the request - the code gets placeholders, filled in here afterwards
  const topic=intentTopic(it),wifi=pf!=='arduino'&&pf!=='raspberrypi'&&(topic||NET_RE.test(desc.replace(NO_NET,'')));
  const sets=(it.inputKeys||[]).filter(k=>k!=='ntfy_topic').map(k=>{const v=WF.store.get('intent_inputs.'+k)||'';return '- '+k+': '+(_int.SECRETISH.test(k)?'"PUT_YOUR_'+k.toUpperCase()+'_HERE" (the user fills it in)':JSON.stringify(v));});
  if(wifi)sets.unshift('- WIFI_SSID = "PUT_YOUR_WIFI_NAME_HERE" (placeholder: EvenUCan fills it in on the user\'s computer)','- WIFI_PASSWORD = "PUT_YOUR_WIFI_PASSWORD_HERE" (placeholder, as above)');
  if(topic)sets.push('- NTFY_TOPIC = "'+topic+'"');
  const reqs=intentReqs(it);
  const extra=(topic&&pf==='esp32ide'?'\nPhone messages: connect to Wi-Fi with WiFi.h and send each message as an HTTPS POST to "https://ntfy.sh/" + NTFY_TOPIC with HTTPClient (WiFiClientSecure with setInsecure() is fine), with the message text as the body. Put these four lines in ONE clearly marked settings block near the top, under a comment saying the user can edit them: const char* WIFI_SSID = "PUT_YOUR_WIFI_NAME_HERE"; const char* WIFI_PASSWORD = "PUT_YOUR_WIFI_PASSWORD_HERE"; const char* NTFY_TOPIC = "<the topic below>"; const char* NTFY_MESSAGE = "<the plain-English message the user asked for>";. Send NTFY_MESSAGE as the body; never write the message text inline in loop(). Reconnect if the Wi-Fi drops, and send at most one message every 30 seconds, but let the very first press after start-up send immediately (start the cooldown timer already expired).\n':'')+
    (topic&&pf==='raspberrypi'?'\nPhone messages: send each one with requests.post("https://ntfy.sh/" + NTFY_TOPIC, data=message.encode()), with NTFY_TOPIC and NTFY_MESSAGE as constants in the settings block at the top, and the first message allowed immediately after start-up.\n':'');
  const text=PF_CODE_PROMPT[pf]+'\n\nThe project, in the user\'s words:\n"""'+(desc||'(no description: make the parts work and show their readings)')+'"""\n'+
    '\nRequirements (the code MUST do every one of these):\n'+(reqs.length?reqs.map((r,i)=>(i+1)+'. '+r).join('\n'):'1. Make every part work.')+'\n'+extra+
    (A.code_description?'\nWhat the code needs to do:\n'+A.code_description+'\n':'')+(A.code_libraries&&A.code_libraries.length?'\nLibraries suggested earlier: '+A.code_libraries.join(', ')+'\n':'')+
    '\nPlatform: '+PLATFORMS[pf].name+(pf==='esp32ide'?' (programmed with the Arduino IDE and the "esp32 by Espressif" boards, board "ESP32S3 Dev Module"; pin numbers are GPIO numbers)':'')+
    '\nPower source: '+(POW_NAME[P.power]||POW_NAME.usb)+
    '\nController: '+P.ctrl.part.name+'\n\nParts:\n'+parts+'\n\nConnections (each line is one group of joined pins):\n'+nets+'\n\nPins the code uses:\n'+(pins||'- (none)')+(sets.length?'\n\nSettings:\n'+sets.join('\n'):'');
  const {data}=await callAI(text);
  if(data&&typeof data==='object'&&data.refuse)throw Object.assign(new Error('refused'),{refuse:String(data.reason||'').slice(0,400)||'(no reason given)'});
  if(!data||typeof data!=='object'||typeof data.code!=='string'||data.code.trim().length<20)throw new Error('garbled: no code in the reply');
  let code=data.code.replace(/\r\n?/g,'\n').trim()+'\n';const warn=[];
  if(isIno(pf)){
    if(!/LIBRARIES_NEEDED/.test(code))warn.push('The sketch has no LIBRARIES_NEEDED list at the top: check its #include lines to see what to install.');
    if(!/void\s+setup\s*\(/.test(code)||!/void\s+loop\s*\(/.test(code))warn.push('The sketch is missing setup() or loop(), so it won\'t compile: click Write it again.');
  }else{
    if(!/^#!/.test(code))code='#!/usr/bin/env python3\n'+code;
    if(!/finally\s*:/.test(code)||!/GPIO\.cleanup\s*\(/.test(code))warn.push('The program doesn\'t clean up the GPIO pins in a try/finally block: click Write it again, or stop it carefully.');
  }
  // the Wi-Fi name and password go in here, on this computer, never to the AI
  const q=v=>String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
  if(wifiMem.ssid)code=code.replace(/(WIFI_SSID\b[^"\n]*")[^"\n]*(")/,(m,a,b)=>a+q(wifiMem.ssid)+b);
  if(wifiMem.pass)code=code.replace(/(WIFI_PASSWORD\b[^"\n]*")[^"\n]*(")/,(m,a,b)=>a+q(wifiMem.pass)+b);
  // nothing asked for may be quietly left out
  const bad=[];
  if(topic&&!/ntfy\.sh/.test(code))bad.push('Your idea asks for a message to your phone, but this code doesn\'t send one.');
  if(/^\s*(\/\/|#).*\b(not possible|isn'?t possible|impossible|cannot be done|can'?t be done)\b/im.test(code))bad.push('The code says something you asked for isn\'t possible.');
  return {code,notes:String(data.notes||'').slice(0,800),warn,bad};
};
