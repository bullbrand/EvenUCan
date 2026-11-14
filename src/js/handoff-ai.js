// ---- (wizard-r2) Requirements: what the idea asks for is checked against the board and the power, and the code
// writer must meet every one (or refuse with a reason) - nothing is silently dropped any more.
const isIno=pf=>pf==='arduino'||pf==='esp32ide';
const POW_NAME={usb:'a USB cable',battery:'a battery inside the box',mains:'a mains adapter (a plug-in 5 V USB charger)'};
const NO_NET=/\b(i )?(don'?t|do not|no|without)( need| want)?( any| a)?( the)? ?(wi-?fi|internet|wireless)\b[^.]*/gi;
const NET_RE=/\b(my |your |the )?phone\b|send (me )?(a |an )?(message|text|notification|alert)|message (me|my)|text me|notif(y|ication)|\bsms\b|e-?mail|internet|online|weather|forecast|ntfy|home assistant|wi-?fi/i;
const PHONE_RE=/\bphone\b|message|notif|text me|\bsms\b|ntfy|e-?mail/i;
let wifiMem={ssid:'',pass:''};// typed in the Parts step; only ever written into the code made on this computer
function intentReqs(it){
  it=it||intentNow()||{};const A=it.analysis||{},drop=it.dropped||[];
  let r=(A.requirements||[]).slice();
  if(!r.length&&it.desc)r=[String(it.desc)];
  if(drop.includes('wifi'))r=r.filter(x=>!NET_RE.test(String(x).replace(NO_NET,'')));
  if(intentTopic(it)&&!r.some(x=>PHONE_RE.test(x)))r.push('Send a message to the user\'s phone through ntfy.sh');
  return r;
}
function intentTopic(it){
  it=it||intentNow();if(!it||(it.dropped||[]).includes('wifi'))return '';
  const v=intentInputs(it);return String(v.ntfy_topic||'').trim();
}
const netNeeded=(desc,A)=>{A=A||{};const txt=(String(desc||'')+' '+(A.requirements||[]).join(' ')).replace(NO_NET,'');return NET_RE.test(txt)||(A.extra_inputs_needed||[]).some(x=>/^(owm_api_key|ntfy_topic)$/.test(x.key));};
function copyText(t){navigator.clipboard.writeText(t).then(()=>WF.flash('Copied'),()=>WF.flash('Couldn\'t copy: select it and press Ctrl+C.',5000));}
// What the idea needs that the chosen board or power can't give. block: must be fixed (or dropped) before going on.
function capIssues(pf,desc,A,power,dropped){
  A=A||{};dropped=dropped||[];const out=[];
  const txt=(String(desc||'')+' '+(A.requirements||[]).join(' ')).replace(NO_NET,'');
  const net=netNeeded(desc,A);
  if(pf==='arduino'&&net&&!dropped.includes('wifi')){
    const what=PHONE_RE.test(txt)?'send a message to your phone':/weather|forecast/i.test(txt)?'get the weather from the internet':'use the internet';
    out.push({k:'wifi',block:true,msg:`Your idea says it should ${what}. An Arduino Nano can't connect to Wi-Fi, so it can't do that.`,
      fixes:[['esp32ide','Switch to an ESP32 and keep using the Arduino IDE (recommended)'],['esphome','Switch to an ESP32 with ESPHome'],['drop-wifi','Keep the Arduino Nano and leave that out']]});
  }
  const batWanted=/\bbatter(y|ies)\b|cordless|portable|no (power )?(cable|wires?|plug)|without (a )?(cable|plug|wires?)/i.test(String(desc||''));
  if(batWanted&&power!=='battery'&&!dropped.includes('battery'))
    out.push({k:'battery',block:true,msg:'Your idea says it should run on a battery, but the power is set to '+POW_NAME[power]+'.',fixes:[['pow-battery','Use a battery'],['drop-battery','Keep '+POW_NAME[power]]]});
  if(power==='battery'&&pf==='raspberrypi')
    out.push({k:'pi-battery',block:false,msg:'A Raspberry Pi uses a lot of power: a small battery runs it for only a few hours.',fixes:[['pow-mains','Use a mains adapter instead'],['esphome','Switch to an ESP32']]});
  else if(power==='battery'&&net&&pf!=='arduino'&&!dropped.includes('wifi'))
    out.push({k:'wifi-battery',block:false,msg:/deep.?sleep|sleeps? between|light.?sleep/i.test([A.summary,A.esphome_notes,A.code_description,A.esphome_yaml_hint].join(' '))?'This device sleeps between events, which is the right way to run on a battery. Each time it wakes and joins Wi-Fi it uses power, so on a 1000 mAh battery expect weeks, not months, and less on busy days. Use a mains adapter if you never want to charge it.':'Wi-Fi uses a lot of power: on the 1000 mAh battery an ESP32 lasts about a day before it needs charging. For weeks of running, use a mains adapter.',fixes:[['pow-mains','Use a mains adapter instead']]});
  return out;
}
const capHtml=list=>list.map(c=>`<div class="capBox${c.block?'':' soft'}" role="alert"><b>${c.block?'⛔ ':'⚠️ '}${esc(c.msg)}</b>${c.block?'<div class="ewNote">Pick one to carry on:</div>':''}<div>`+
  c.fixes.map(([act,label],i)=>`<button data-capfix="${act}"${c.block&&!i?' class="primary"':''}>${esc(label)}</button>`).join('')+'</div></div>').join('');
// The ntfy.sh topic, big, with a copy button and how to get the messages on the phone.
function ntfyBox(topic){
  if(!topic)return '';
  return `<div class="ntfyBox"><b>📱 Messages to your phone</b><div>Your private topic name:</div><span class="topic">${esc(topic)}</span><button data-copytext="${esc(topic)}">Copy topic</button>
<ol style="margin:4px 0 0;padding-left:20px"><li>Install the free <b>ntfy</b> app on your phone (App Store or Google Play).</li><li>Open it, tap <b>+</b> (Subscribe to topic) and paste this exact name. Leave the server as ntfy.sh.</li><li>Done: when your gadget sends a message, it pops up on your phone.</li></ol>
<div class="ewNote">No account is needed. Anyone who knows the topic name can read the messages, so keep it to yourself.</div></div>`;
}
// The code there is now: {pf, name, text}, or null before it is written.
function currentCode(){
  let P=wr&&wr.plan;if(!P||P.error){P=planWiring();if(P.error)return null;}
  const pf=pfOfPlan(P),nm=esphSlug(esphForm().name||'my-device');
  if(pf==='esphome'){const r=esphomeYaml(P,esphForm());if(!r.yaml)return null;return {pf,name:nm+'.yaml',text:(wr&&wr.ai&&wr.ai.yaml)||r.yaml};}
  if(!pfCode||pfCode.pf!==pf)return null;
  return {pf,name:nm.replace(/-/g,'_')+(pf==='raspberrypi'?'.py':'.ino'),text:pfCode.code};
}
// ---- (handoff-r1) "Open in ESPHome / Arduino IDE / Thonny": put the file where that program looks for it, open the
// program when that is possible, and keep a step-by-step guide on screen (in #wfGuide) until the board runs.
// A web page can't start programs (Arduino IDE 2 and Thonny have no web link that opens them), but with the user's
// OK Chrome and Edge can save straight into a folder (File System Access API); the folder is remembered (IndexedDB).
// ESPHome's dashboard lists every .yaml in its folder and runs as a web page on localhost:6052, so that opens in a tab.
// The desktop app does all of it itself (window.wfNative: esphomeSend, openInIde, chooseFolder).
const toolName=pf=>pf==='esphome'?'ESPHome':pf==='raspberrypi'?'Thonny':'Arduino IDE';
const openLabel=pf=>'Open in '+toolName(pf);
const ESPH_DASH='http://localhost:6052';
let ho=null;// the guide: {pf,name,base,text,how:'saved'|'download',where,dash,secrets,launched,copied,note,ticks,open}
function esphomeUp(){// the dashboard sends no CORS headers: any answer at all means it is running
  return new Promise(res=>{const ac=window.AbortController?new AbortController():null;
    const t=setTimeout(()=>{if(ac)ac.abort();res(false);},2500);
    fetch(ESPH_DASH+'/',{mode:'no-cors',cache:'no-store',signal:ac?ac.signal:undefined}).then(()=>{clearTimeout(t);res(true);},()=>{clearTimeout(t);res(false);});});
}
const HO_ALLOW='<p class="ewNote" style="margin:6px 0 0">Your browser then asks if EvenUCan may save files there: click <b>Edit files</b> (or <b>Allow</b>).</p>';
const HO_DIR={
  esphome:{key:'dir:esphome',ask:'<div class="kHead"><b>📶 Where is your ESPHome folder?</b></div><p style="margin:0 0 6px">So EvenUCan can put your device straight into ESPHome, pick the folder ESPHome keeps its devices in. You only do this once.</p><ul style="margin:0;padding-left:20px"><li>The <b>ESPHome Device Builder</b> app uses the <b>esphome</b> folder in your user folder (on Windows <code>C:\\Users\\<i>your name</i>\\esphome</code>, on a Mac or Linux <code>esphome</code> in your home folder).</li><li>Run ESPHome another way? Pick its config folder: the one with your other .yaml files.</li></ul>'+HO_ALLOW},
  arduino:{key:'dir:arduino',ask:'<div class="kHead"><b>🔌 Where is your Arduino sketchbook?</b></div><p style="margin:0 0 6px">So the sketch shows up in the Arduino IDE under <b>File → Sketchbook</b>, pick your sketchbook folder. You only do this once.</p><ul style="margin:0;padding-left:20px"><li>It is usually the <b>Arduino</b> folder inside <b>Documents</b>.</li><li>Not sure? In the Arduino IDE, <b>File → Preferences</b> shows it as "Sketchbook location".</li></ul>'+HO_ALLOW},
  raspberrypi:{key:'dir:pi',ask:'<div class="kHead"><b>🍓 Where should your Pi programs go?</b></div><p style="margin:0 0 6px">Pick a folder to keep them in: for example make a folder called <b>EvenUCan</b> inside <b>Documents</b>. You only do this once, and Thonny opens the program from there.</p>'+HO_ALLOW}
};
const hoKind=pf=>pf==='esphome'?'esphome':pf==='raspberrypi'?'raspberrypi':'arduino';
// The remembered folder (asking for permission again if the browser forgot it), or a new pick. null = just download.
async function hoFolder(pf,fresh){
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
}
// Write text to dir/path (path: ['sub', ..., 'file']). Asks before replacing a different file; false = the user said no.
async function hoWrite(dir,path,text){
  let d=dir;for(const s of path.slice(0,-1))d=await d.getDirectoryHandle(s,{create:true});
  const fn=path[path.length-1];
  try{const old=await (await (await d.getFileHandle(fn)).getFile()).text();
    if(old!==text&&!await askConfirm('There is already a different file called "'+fn+'" in '+dir.name+'.\n\nReplace it with this one?'))return false;}
  catch(e){if(!e||e.name!=='NotFoundError')throw e;}
  const w=await (await d.getFileHandle(fn,{create:true})).createWritable();await w.write(text);await w.close();
  return true;
}
// Libraries for the Arduino IDE's Library Manager: the sketch's own LIBRARIES_NEEDED list, plus its #include lines.
const INC_LIB={'DHT.h':'DHT sensor library','DHT_U.h':'DHT sensor library','Adafruit_Sensor.h':'Adafruit Unified Sensor','Adafruit_SSD1306.h':'Adafruit SSD1306','Adafruit_GFX.h':'Adafruit GFX Library',
  'OneWire.h':'OneWire','DallasTemperature.h':'DallasTemperature','Adafruit_NeoPixel.h':'Adafruit NeoPixel','FastLED.h':'FastLED','Adafruit_BME280.h':'Adafruit BME280 Library','Adafruit_BMP280.h':'Adafruit BMP280 Library',
  'Adafruit_AHTX0.h':'Adafruit AHTX0','LiquidCrystal_I2C.h':'LiquidCrystal I2C','PubSubClient.h':'PubSubClient','ArduinoJson.h':'ArduinoJson','BH1750.h':'BH1750','U8g2lib.h':'U8g2','RTClib.h':'RTClib',
  'Adafruit_MPU6050.h':'Adafruit MPU6050','MFRC522.h':'MFRC522','IRremote.h':'IRremote','IRremote.hpp':'IRremote','HX711.h':'HX711 Arduino Library','NewPing.h':'NewPing','TM1637Display.h':'TM1637','Bounce2.h':'Bounce2','AccelStepper.h':'AccelStepper'};
const INC_BUILTIN=/^(Arduino|Wire|SPI|WiFi|WiFiClient|WiFiClientSecure|WiFiMulti|HTTPClient|WebServer|ESPmDNS|EEPROM|Preferences|SoftwareSerial|Servo|time|math|stdlib|string|FS|SPIFFS|LittleFS|SD|Update|esp_\w+|driver\/\w+|avr\/\w+|util\/\w+)\.h$/;
function hoLibs(code){
  const out=[],add=n=>{n=String(n).replace(/^[\s\-*•·]+|[\s.]+$/g,'');if(n&&n.length<50&&!/none|built-?in|^only\b/i.test(n)&&!out.includes(n))out.push(n);};
  const lines=String(code).split(/\r?\n/),i=lines.findIndex(l=>/LIBRARIES_NEEDED:/.test(l));
  if(i>=0){
    add(lines[i].split('LIBRARIES_NEEDED:')[1]||'');
    for(let k=i+1;k<lines.length&&k<i+15;k++){const m=lines[k].match(/^\s*(?:\/\/|\*)\s*(.*)$/);if(!m||!m[1].trim()||/[.:]$/.test(m[1].trim())||m[1].trim().split(/\s+/).length>6)break;add(m[1]);}
  }
  for(const m of String(code).matchAll(/^\s*#include\s*[<"]([^>"]+)[>"]/gm)){const h=m[1].trim();if(INC_BUILTIN.test(h))continue;if(INC_LIB[h]){if(!out.includes(INC_LIB[h]))add(INC_LIB[h]);}else if(!out.some(x=>x.replace(/\s+/g,'').toLowerCase().includes(h.replace(/\.h(pp)?$/,'').replace(/_/g,'').toLowerCase())))add('(the library for '+h+')');}
  return out;
}
const hoPips=code=>[...new Set([...String(code).matchAll(/#\s*(?:sudo\s+)?pip3?\s+install\s+([A-Za-z0-9_.\-\[\]]+)/g)].map(m=>m[1]))];
const hoA=(href,txt)=>`<a href="${href}" target="_blank" rel="noopener">${txt}</a>`;
const HO_USB='<li>No port to pick, or nothing happens when you plug it in? Try a different USB cable: many cheap cables only charge and carry no data.</li><li>Still nothing? The board may need a USB driver. Look at the small chip next to the USB socket: <b>CH340</b> needs the '+hoA('https://www.wch-ic.com/downloads/CH341SER_EXE.html','CH340 driver')+', <b>CP2102</b> / <b>CP210x</b> needs the '+hoA('https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers','CP210x driver')+'. Install it, then unplug the board and plug it in again.</li>';
const HO_AIFIX='<li>Red error lines? Select them, copy them (Ctrl+C), open <b>🔌 Wiring → Ask AI</b> in EvenUCan, paste them and ask it to fix the code. Then click <b>'+'Open in …</b> again.</li>';
// The steps, each [what to do, help if it didn't work], for the program the code is for.
function hoSteps(g){
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
}
function drawHandoff(el){
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
    `<div class="gBtns"><button id="hoDone" class="primary">✅ It's on my board!</button></div><div class="gBtns hoSmall"><button id="hoCopy">Copy code</button><button id="hoSave">Download again</button>`+
    (g.pf==='esphome'?`<a class="hoBtn" href="${ESPH_DASH}" target="_blank" rel="noopener">Open ESPHome</a>`:'')+
    (window.showDirectoryPicker||(window.wfNative&&window.wfNative.chooseFolder)?'<button id="hoFolder">Choose a different folder</button>':'')+
    '<button id="hoBack">← Back to the code</button><button id="gRestart" class="linkBtn">Start again from the beginning</button></div>';
  el.className='ho';el.style.display='block';
}
// The main button everywhere. fresh: pick the folder again ("Choose a different folder").
async function openInIde(fresh){
  const c=currentCode();if(!c){WF.flash('Write the code first.',5000);return false;}
  const pf=c.pf,N=window.wfNative||{};
  if(pf==='esphome'&&wr&&wr.ai&&wr.ai.ok===false&&!await askConfirm('ESPHome found a problem in the AI\'s file.\nOpen it in ESPHome anyway?'))return false;
  const base=c.name.replace(/\.(ya?ml|ino|py)$/i,'');
  const g={pf,name:c.name,base,text:c.text,how:'',where:'',dash:null,secrets:null,launched:'',copied:false,note:'',ticks:{},open:{}};
  try{
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
}
// After the parts step: change the board everywhere (parts, saved idea, wiring) in one click.
function switchBoard(pf){
  pf=pfOk(pf);const it=intentNow();
  if(it){it.platform=pf;WF.store.set(INTENT_KEY,JSON.stringify(it));}
  const c=ctrlPart(pf);if(!c)return WF.flash('Couldn\'t add that board to your parts.',6000);
  wiz.items=wiz.items.filter(i=>!CTRL_IDS.includes(i.pid));wiz.items.unshift({pid:c.id,qty:1,mount:'auto',wall:'auto'});
  saveWiz();lay=null;pfCode=null;pfMsg='';if(wr)wr.ai=null;WF.store.set(ESPH_AI_KEY,'');
  if(iw.analysis){iw.pf=pf;iw.matches=pfMatches(iw.base,pf);}
  if(wrBack.style.display==='grid')openWiring();
  WF.flash('Switched to '+PLATFORMS[pf].name+'.',4000);updateStrip();
}
// A one-click fix chosen after the parts step (the Code tab).
function capFixLater(act){
  const it=intentNow();
  if(PLATFORMS[act])return switchBoard(act);
  if(/^drop-/.test(act)&&it){it.dropped=[...new Set([...(it.dropped||[]),act.slice(5)])];WF.store.set(INTENT_KEY,JSON.stringify(it));}
  else if(/^pow-/.test(act)){wiz.power=act.slice(4);if(it){it.power=wiz.power;WF.store.set(INTENT_KEY,JSON.stringify(it));}saveWiz();lay=null;pfCode=null;if(wrBack.style.display==='grid')openWiring();return;}
  if(wrBack.style.display==='grid')renderWiringSide();
}
const planIssues=P=>{const it=intentNow();if(!it)return [];return capIssues(pfOfPlan(P),it.desc,it.analysis,P.power,it.dropped);};
// Both writers send the same facts: the idea, every requirement, the board, the power, the parts, the connections and the pins.
async function platformCodeAI(pf){
  const P=wr.plan,it=intentNow()||{},A=it.analysis||{},f=esphForm();
  const desc=(f.desc||'').trim()||String(it.desc||'').trim();
  const insts=[...new Set([P.ctrl,...P.nets.flatMap(n=>n.pins.map(p=>p.inst))])];
  const parts=insts.map(i=>'- '+i.label+(i.label!==i.part.name?' ('+i.part.name+')':'')+(i.part.protocol?', '+i.part.protocol:'')+(i.part.i2c_address?', I2C address '+i.part.i2c_address:'')).join('\n');
  const nets=P.nets.map(n=>'- '+n.name+': '+n.pins.map(p=>p.inst.label+' '+p.pin.n).join(', ')).join('\n');
  const num=pf==='raspberrypi'?'BCM GPIO ':pf==='esp32ide'?'GPIO ':'Arduino pin ';
  const pins=P.assigned.map(a=>'- '+a.inst.label+' '+(a.pin?a.pin.n:a.role.toUpperCase())+' ('+a.role+') -> '+P.ctrl.label+' '+a.c.n+(a.c.g!==undefined?' = '+num+a.c.g:'')+(a.shared?' (shared I2C bus)':'')).join('\n');
  // the user's answers: secrets (and the Wi-Fi name/password) stay out of the request - the code gets placeholders, filled in here afterwards
  const topic=intentTopic(it),wifi=pf!=='arduino'&&pf!=='raspberrypi'&&(topic||NET_RE.test(desc.replace(NO_NET,'')));
  const sets=(it.inputKeys||[]).filter(k=>k!=='ntfy_topic').map(k=>{const v=WF.store.get('intent_inputs.'+k)||'';return '- '+k+': '+(SECRETISH.test(k)?'"PUT_YOUR_'+k.toUpperCase()+'_HERE" (the user fills it in)':JSON.stringify(v));});
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
}
// ---- A starter program made without AI: the includes, the pins from the wiring, and setup()/loop() with a note
// for each part saying what to add. It compiles as it is but doesn't "do" the project: that part is up to you.
const STARTER_LIBS=[
  [/ssd1306|oled/i,'Adafruit_SSD1306.h','Adafruit SSD1306 (and Adafruit GFX)','the little OLED screen'],
  [/sh1106/i,'Adafruit_SH110X.h','Adafruit SH110X','the OLED screen'],
  [/mpu-?6050|mpu-?9250|gy-?521/i,'Adafruit_MPU6050.h','Adafruit MPU6050','the tilt / motion sensor'],
  [/bme280/i,'Adafruit_BME280.h','Adafruit BME280','the temperature / pressure / humidity sensor'],
  [/bmp280/i,'Adafruit_BMP280.h','Adafruit BMP280','the pressure sensor'],
  [/aht[12]0/i,'Adafruit_AHTX0.h','Adafruit AHTX0','the temperature / humidity sensor'],
  [/sht3/i,'Adafruit_SHT31.h','Adafruit SHT31','the temperature / humidity sensor'],
  [/bh1750/i,'BH1750.h','BH1750','the light sensor'],
  [/ina219/i,'Adafruit_INA219.h','Adafruit INA219','the current sensor'],
  [/ds3231|rtc/i,'RTClib.h','RTClib','the clock module'],
  [/vl53l0x/i,'Adafruit_VL53L0X.h','Adafruit VL53L0X','the distance sensor'],
  [/lcd.*i2c|i2c.*lcd|1602|2004/i,'LiquidCrystal_I2C.h','LiquidCrystal I2C','the LCD screen'],
  [/dht ?11|dht ?2[12]|am230[12]|\bdht\b/i,'DHT.h','DHT sensor library','the temperature / humidity sensor'],
  [/ds18b20|dallas/i,'DallasTemperature.h','DallasTemperature (and OneWire)','the temperature probe'],
  [/ws281|neopixel|sk6812/i,'Adafruit_NeoPixel.h','Adafruit NeoPixel','the coloured lights'],
  [/servo|sg90|mg90/i,'ESP32Servo.h','ESP32Servo (on an Arduino: Servo)','the servo']
];
function starterSketch(P,pf){
  const A=(intentNow()||{}).analysis||{},name=esphForm().name||A.name||'My project',py=pf==='raspberrypi';
  const parts=P.insts.filter(i=>i!==P.ctrl&&i.pins.length);
  const libsFor=i=>STARTER_LIBS.filter(l=>l[0].test(i.part.name+' '+(i.part.notes||'').slice(0,200)));
  const pinsOf_=i=>P.assigned.filter(a=>a.inst===i);
  const gpio=a=>a.c.g!==undefined?a.c.g:a.c.n;
  const what=i=>{const k=sigKind(i),pins=pinsOf_(i);
    if(pins.some(a=>a.role==='sda'))return 'I2C';
    if(k==='button'||k==='touch'||k==='motion')return 'in';
    if(k==='buzzer'||k==='led'||k==='relay')return 'out';
    if(pins.some(a=>a.role==='trig'))return 'sonar';
    return k||'other';};
  const ideas={in:'read it with digitalRead() - HIGH or LOW',out:'switch it on and off with digitalWrite(pin, HIGH) / digitalWrite(pin, LOW)',
    sonar:'send a 10 µs pulse on TRIG, then time the pulse on ECHO with pulseIn()',I2C:'start it with its library in setup(), then read or write it in loop()',
    dht:'read it with its library (dht.readTemperature())',ds18b20:'read it with its library',pixel:'set colours with its library',other:'see its datasheet or the library example'};
  if(py){
    let t=`# ${name} - starter program made by EvenUCan (no AI)\n# Board: ${P.ctrl.label}. The pins below match your wiring diagram.\n# This is only a starting point: add your own code where it says TODO.\n\nimport time\nfrom gpiozero import DigitalOutputDevice, Button\n\n`;
    for(const a of P.assigned)if(!['sda','scl'].includes(a.role)||!a.shared)t+=`${inoName(a)} = ${String(gpio(a)).replace(/\D/g,'')||gpio(a)}  # ${a.inst.label} ${a.pin?a.pin.n:a.role.toUpperCase()}\n`;
    t+='\n';
    for(const i of parts)t+=`# ${i.label}: ${what(i)==='I2C'?'on the I2C pins (SDA = GPIO2, SCL = GPIO3); turn on I2C in the Raspberry Pi settings':ideas[what(i)]}\n`;
    t+='\nprint("Hello from your Raspberry Pi")\nwhile True:\n    # TODO: what your gadget does over and over\n    time.sleep(1)\n';
    return t;
  }
  const esp=pf==='esp32ide',i2c=P.assigned.find(a=>a.role==='sda'),scl=P.assigned.find(a=>a.role==='scl');
  const libs=[...new Map(parts.flatMap(libsFor).map(l=>[l[1],l])).values()];
  let t=`// ${name} - starter sketch made by EvenUCan (no AI)\n// Board: ${P.ctrl.label}\n// The pins below match your wiring diagram. This sketch compiles and runs, but it is only a\n// starting point: add your own code where it says TODO. Open the Serial Monitor at 115200 baud to see messages.\n\n#include <Arduino.h>\n`;
  if(i2c)t+='#include <Wire.h>\n';
  if(libs.length){t+='// Libraries for your parts - install them in the Arduino IDE (Tools > Manage Libraries...),\n// then remove the // in front of each line:\n';for(const l of libs)t+=`// #include <${l[1]}>   // "${l[2]}" for ${l[3]}\n`;}
  t+='\n'+P.code.arduino.replace(/^\/\/.*\n/,'// Pins (from the wiring diagram)\n');
  t+='\nvoid setup() {\n  Serial.begin(115200);\n  Serial.println("Hello from '+name.replace(/["\\]/g,'')+'");\n';
  if(i2c&&scl)t+=esp?`  Wire.begin(${inoName(i2c)}, ${inoName(scl)});  // the I2C bus: SDA, SCL\n`:'  Wire.begin();  // the I2C bus (A4 = SDA, A5 = SCL)\n';
  for(const i of parts){
    const w=what(i),pins=pinsOf_(i);
    t+=`\n  // ${i.label}: ${ideas[w]}\n`;
    for(const a of pins){
      if(['sda','scl'].includes(a.role))continue;
      const n=inoName(a);
      if(w==='in')t+=`  pinMode(${n}, INPUT_PULLUP);\n`;
      else if(w==='out'||a.role==='trig')t+=`  pinMode(${n}, OUTPUT);\n  digitalWrite(${n}, LOW);\n`;
      else if(a.role==='echo')t+=`  pinMode(${n}, INPUT);\n`;
      else if(/^(sig|uart_tx|uart_rx)$/.test(a.role))t+=`  // ${n} is wired to ${a.pin?a.pin.n:a.role} on this part\n`;
    }
    if(w==='I2C')t+=`  // TODO: start ${i.label} here (see the example that comes with its library)\n`;
  }
  t+='}\n\nvoid loop() {\n  // TODO: what your gadget does over and over. Some ideas for your parts:\n';
  for(const i of parts){
    const w=what(i),pins=pinsOf_(i).filter(a=>!['sda','scl'].includes(a.role)),n=pins[0]&&inoName(pins[0]);
    if(w==='out'&&n)t+=`  // ${i.label}:\n  //   digitalWrite(${n}, HIGH); delay(200); digitalWrite(${n}, LOW);\n`;
    else if(w==='in'&&n)t+=`  // ${i.label}:\n  //   if (digitalRead(${n}) == LOW) Serial.println("${i.label.replace(/["\\]/g,'')} pressed");\n`;
    else t+=`  // ${i.label}: ${ideas[w]}\n`;
  }
  t+='  delay(1000);\n}\n';
  return t;
}
function makeStarter(){
  const P=wr&&wr.plan;if(!P||P.error)return;
  const pf=pfOfPlan(P);if(pf==='esphome')return;
  pfCode={pf,sig:planSig(P),code:starterSketch(P,pf),notes:'A starter '+(pf==='raspberrypi'?'program':'sketch')+' made by EvenUCan without AI: the pins match your wiring, and setup() and loop() have a note for each part. Add your own code where it says TODO.',warn:[],bad:[],starter:true};
  pfMsg='';renderWiringSide();drawGuide();
}
async function generateArduinoCode(){return platformCodeAI('arduino');}
async function generatePiCode(){return platformCodeAI('raspberrypi');}
async function pfGenerate(){
  const P=wr&&wr.plan;if(!P||P.error||pfBusy)return;
  const pf=pfOfPlan(P);if(pf==='esphome')return;
  if(planIssues(P).some(c=>c.block)){renderWiringSide();return WF.flash('First choose how to fix the problem shown in red.',6000);}// (wizard-r2) checked again before the code
  if(!aiKey()){await askKey();if(!aiKey())return WF.flash('No AI key set up, so nothing was sent. Click "'+keyLabel()+'" to set one up, or click "Make a starter (no AI)".',7000);}
  // (bug-8) Block code generation if any parts still have no pin data.
  const _pfMissingPins=(P.warn||[]).filter(w=>w.includes('has no pin data yet'));
  if(_pfMissingPins.length){
    const _pfMissingNames=_pfMissingPins.map(w=>w.replace(/ has no pin data yet[\s\S]*$/,'')).join(', ');
    return WF.flash(_pfMissingNames+' '+(_pfMissingPins.length===1?'has':'have')+' no pin data yet — go to Parts and use "Look up online" to fill in the pins before writing code.',9000);
  }
  pfBusy=true;pfMsg='';renderWiringSide();_cdStart('pfAiCd',aiProv()==='ollama'?300:60);
  try{const r=await platformCodeAI(pf);pfCode=Object.assign(r,{pf,sig:planSig(P)});}
  catch(e){console.error('EvenUCan: could not write the '+PLATFORMS[pf].code,e);
    const isTimeout=e&&(e.name==='AbortError'||/abort|timed? ?out/i.test(e.message||''));
    pfMsg=e.refuse?'Your AI says it can\'t do everything you asked with these parts: '+e.refuse+' Change the board or parts above, then try again.':/garbled/.test(e.message||'')?'Sorry, the AI\'s reply couldn\'t be read: click Write the code with AI again.':isTimeout?'The AI didn\'t reply within 60 seconds.'+_otherAiHint()+' Check your internet connection or try again.':'The AI couldn\'t be reached: '+(e.message||e)+' Check the key and the internet connection.';}
  finally{_cdStop();pfBusy=false;if(wrBack.style.display==='grid'&&wr.plan===P)renderWiringSide();drawGuide();}
}
// The Code tab for a board that doesn't run ESPHome.
function platformCodePanel(pf){
  const P=wr.plan,PF=PLATFORMS[pf],c=pfCode&&pfCode.pf===pf?pfCode:null,canAI=!!aiKey(),ext=isIno(pf)?'.ino':'.py';
  const issues=planIssues(P),blocked=issues.some(x=>x.block);
  let h=`<h4>${esc(PF.code)} for ${esc(P.ctrl.label)}</h4>`+capHtml(issues)+`<div class="ewNote" style="margin-bottom:6px">Two ways to get the ${isIno(pf)?'sketch':'program'}: your AI writes the whole thing from your idea and this wiring (needs a key and the internet), or EvenUCan makes a <b>starter</b> without AI, with the pins filled in and a note for each part, for you to finish. EvenUCan can't test the code: ${isIno(pf)?'click ✓ Verify in the Arduino IDE before you upload it':'run it on the Pi and read any error it prints'}.</div>
<div class="ewRow"><label>AI <select id="wrProv">${Object.entries(PROVIDERS).map(([k,v])=>`<option value="${k}"${aiProv()===k?' selected':''}>${esc(v.name)}${aiKey(k)?' ✓':''}</option>`).join('')}</select></label><button id="wrKey">${keyLabel()}</button></div>
<div class="ewRow" style="flex-wrap:wrap"><button id="wrPfGen"${canAI?' class="primary"':''}${pfBusy||!canAI||blocked?' disabled':''}>${pfBusy?'Writing... please wait':c&&!c.starter?'Write it again with AI':'Write the code with AI'}</button><button id="wrPfStarter"${canAI?' class="sec"':' class="primary"'}${pfBusy||blocked?' disabled':''}>${c&&c.starter?'Make the starter again':'Make a starter '+(isIno(pf)?'sketch':'program')+' (no AI)'}</button></div>${canAI?'':'<div class="ewNote">Writing it with AI needs a key: click <b>'+esc(keyLabel())+'</b> above. Or make a starter without AI.</div>'}`;
  if(pfBusy)h+=`<div class="ewNote">Asking your AI (${esc(PROVIDERS[aiProv()].name)})… <span id="pfAiCd"></span> this usually takes 10–60 seconds.</div>`;
  if(pfMsg)h+=`<div class="bad" style="margin:6px 0">${esc(pfMsg)}</div>`;
  if(c){
    if(c.sig!==planSig(P))h+='<div class="warn" style="margin:6px 0">The wiring has changed since this was written, so some pins may be wrong: click <b>Write it again</b>.</div>';
    if(c.bad&&c.bad.length)h+=`<div class="capBox" role="alert"><b>⛔ ${c.bad.map(esc).join(' ')}</b><div>Click <b>Write it again</b>, or change the board or parts.</div></div>`;
    h+=`<textarea readonly class="wrCode" id="wrPf" style="height:240px;margin-top:6px">${esc(c.code)}</textarea><div class="ewRow" style="flex-wrap:wrap"><button id="wrPfIde" class="primary hoMain">${openLabel(pf)}</button><button class="sec" data-copy="wrPf">Copy code</button><button class="sec" id="wrPfSave">Download as ${ext}</button></div>`+
      (c.notes?`<div class="ewNote" style="margin:4px 0">${esc(c.notes)}</div>`:'')+(c.warn.length?`<ul style="list-style:none;padding:0;margin:6px 0">${c.warn.map(w=>`<li class="warn"><span class="ic">!</span><span style="color:var(--text)">${esc(w)}</span></li>`).join('')}</ul>`:'')+
      ntfyBox(intentTopic());
  }else if(!pfBusy)h+='<div class="ewNote" style="margin-top:6px">Nothing is sent to the AI until you click the button.</div>';
  if(c)h+=`<div class="ewNote" style="margin-top:8px">Click <b>${openLabel(pf)}</b>: EvenUCan saves the ${isIno(pf)?'sketch':'program'} where ${esc(toolName(pf))} finds it${window.wfNative?', opens it there,':''} and stays on screen with each step until it ${isIno(pf)?'is on your board':'runs on your Pi'}.</div>`;
  h+=toolLinkHtml(pf);
  return h;
}
function esphSet(el){
  const k=el.dataset.ef,f=esphForm();
  f[k]=el.type==='checkbox'?el.checked:el.type==='radio'?el.value==='1':el.type==='number'?+el.value:el.value;
  WF.store.set(ESPH_KEY,JSON.stringify(f));
  if(wr.ai){wr.ai=null;wr.aiMsg='<div class="ewNote">You changed the answers, so this is the plain file again: click <b>Write it with AI</b> to add your description.</div>';}
}
// The file shown, copied, saved and checked: the AI's version when there is one, else the plain one.
const esphCurrent=r=>wr.ai&&wr.ai.yaml||r.yaml;
// ---- "What should it do?": the user's AI adds the behaviour to the plain file; ESPHome on this computer checks
// the result, and any errors go back to the AI to fix (up to 3 tries).
let esphAiBusy=false;
const ESPH_AI_PROMPT=`You write ESPHome device configuration (ESPHome version 2026.8). You are given a working, already validated ESPHome YAML file for a device, and the user's description of what the device should do.
Change the file so the device does what the user describes. Rules:
- Keep every existing section, pin, id, board, framework, psram, wifi, api, ota, logger and captive_portal setting exactly as it is. Do not change pins or invent new wiring: only the parts already in the file exist.
- Add behaviour with ESPHome's built-in automations (on_value, on_press, interval, if/then/else, lambda conditions, light.turn_on, switch.turn_on, delay, script). No external_components, no custom C++ files, no new secrets.
- RGB colours in light.turn_on actions use floats 0.0–1.0 (red: 1.0, green: 0.0, blue: 0.0). The brightness: field accepts a percentage (brightness: 100%) but red/green/blue NEVER use % — always floats. RGB colours inside C++ lambda blocks also use floats: id(led).turn_on().set_rgb(1.0, 0.0, 0.0).perform().
- ESPHome substitutions (\${varname}) expand in YAML but NOT inside C++ lambda string literals at runtime. In a lambda, use the numeric value directly (e.g. float threshold = 60.0;) or read a global variable — never atof("\${varname}") inside a lambda string.
- Every switch, sensor and binary_sensor already in the file has its own id: use that id in your automations. NEVER declare a second switch/sensor/binary_sensor for hardware that already has one in the file (e.g. if a relay or buzzer is already declared with an id, turn that id on/off - don't add a new one on a different, unwired pin). This applies just as much to a part you yourself add under "Every part listed as not in the file yet" below: once you've declared its sensor/binary_sensor, your own automations must read that same id, not a separate pin you make up to match it.
- If you use http_request.post or http_request.get anywhere in your automations, you MUST also add a top-level http_request:\n  timeout: 10s\n  verify_ssl: false section (ESPHome fails to compile without it). Inside http_request.post, the key for HTTP headers is "headers:" NOT "request_headers:" — using request_headers: causes a validation error.
- Do NOT add a "chipset:" key to esp32_rmt_led_strip sections. It is not a valid option and causes a validation error.
- The ESPHome sensor clamp filter uses min_value: and max_value: — NEVER min: or max: (those cause a validation error).
- Do NOT call http_request inside a C++ lambda block (e.g. id(http_request).post(...) inside a lambda: will not compile). Use YAML actions instead — http_request.post: or http_request.get: — outside the lambda, in the automation's then: block.
- ESPHome has NO ntfy: component and NO ntfy.send: action. They do not exist and will not compile. NEVER write "ntfy:" as a top-level section, and NEVER write "ntfy.send:" as an action. To send a phone notification to ntfy.sh, use http_request.post: with url "https://ntfy.sh/\${ntfy_topic}" and the message as the body. Example: "- http_request.post:\\n    url: \\"https://ntfy.sh/\${ntfy_topic}\\"\\n    body: \\"Your plant needs watering!\\"". The throttle: key does not exist in ESPHome http_request or anywhere else — never use it.
- If you use a named light effect — whether in a YAML automation (effect: "Pulse") or in a C++ lambda (.set_effect("Pulse")) — you MUST also define that effect in the light's effects: block. Without the effects: block entry the effect name is unknown and ESPHome will fail to compile. Example: add an effects: block under the light with - pulse: for a pulse effect.
- Every part listed as not in the file yet must get its own working section (sensor, binary_sensor, output, light, switch, uart, display… as the module needs), with a clear friendly name.
- When a multi-LED module (such as a traffic light with red, green and yellow LEDs) appears more than once in the parts list, give each LED a unique name — e.g. "Red LED", "Green LED", "Yellow LED" for the first module, "Red LED 2", "Green LED 2", "Yellow LED 2" for the second. NEVER give two lights the same name: duplicate names cause Home Assistant errors.
- NEVER add a second esphome: block. The file already has one at the top. If you need to add on_boot: behaviour, merge it into the existing esphome: block at the top of the file — do not create a new esphome: section anywhere else in the file.
- NEVER invent or add hardware that is not in the parts list provided. Only generate code for the exact components listed. If the user description implies a sensor or device that is not in the parts list, ignore that requirement — do not add code for it, do not add a placeholder. Only use what is listed.
- NEVER add an internet weather service (OpenWeatherMap, weather API, http_request to any weather URL) unless the user EXPLICITLY asks for a "weather forecast" or "internet weather". If the device has a physical temperature, humidity or pressure sensor, that sensor IS the weather station — use its readings directly. "Current weather where I am" or "temperature and humidity" means READ THE SENSOR, not fetch from the internet. An internet weather API fetches forecasts for a city from a remote server; that is completely different from a local sensor, requires an API key the user may not have, and should NEVER be added unless the user asks for it by name.
- When the parts list contains multiple instances of the same component (e.g. three push buttons, two relay modules), generate a SEPARATE entity for EACH one with a unique id and a descriptive name based on the user description. NEVER merge multiple physical parts into one entity, and NEVER replace physical buttons with a software select or dropdown. If the user added 3 buttons and the description says weak/normal/strong, generate 3 binary_sensor entries named "Weak Button", "Normal Button", "Strong Button".
- NEVER use !component_name syntax as a negation in conditions. ESPHome does not support this. To negate a condition use the not: wrapper.
- You MUST make the device do EVERY requirement in the user's description. Never silently leave one out or replace it with a comment. If one truly cannot be done with these parts, return {"refuse":true,"reason":"<one plain-English sentence: which requirement, and why>"} instead of a file.
- RELAY COUNTING RULE — ALWAYS APPLY: Count the relay switch entries you write in the YAML. Each one MUST have its own unique GPIO pin — NEVER assign two relay switches to the same GPIO pin, not even as a placeholder or stub. The number of relay channel entries in the YAML must exactly match the number of relay channels in the parts list: if you write 8 relay switch entries, the parts list must include 8 channels worth of hardware (e.g. one 8-channel relay module, or two 4-channel relay modules). Declaring 8 switches while only listing 1 single-channel relay module is a VIOLATION. Never add a comment such as "assign real pins later" or "wire each relay to its own GPIO before use" — every relay switch entry must have a real, unique GPIO pin right now.
- BNO08x IMU RULE — ALWAYS APPLY: If the base file already contains a bno08x sensor section (platform: bno08x), do NOT modify it, do NOT add a second sensor entry for it, and do NOT change its platform, model, or sub-sensors. Read pitch and roll in lambda code using id(imu_pitch).state and id(imu_roll).state (or whatever ids are defined in the file). The correct ESPHome platform for this sensor is bno08x with a game_rotation_vector sub-sensor — NEVER use platform: bno085, platform: i2c_device, or any other platform name. If you must reference pitch/roll in a condition, use the sensor ids, not raw I2C reads.
- MULTI-AXIS LEVELLING RULE — ALWAYS APPLY: When controlling actuators (relays/motors) to level a platform in BOTH pitch AND roll, NEVER write two separate automation blocks (interval, on_value, script, etc.) that each contain their own all-off else branch — the second block will immediately undo the first block's corrections, so the platform will never reach level. ALWAYS use a SINGLE interval block with ONE lambda that handles both axes together using this logic: (1) if fabsf(pitch) < dead_band AND fabsf(roll) < dead_band → turn ALL actuators off, signal level reached; (2) ELSE compare fabsf(pitch) vs fabsf(roll) — pick whichever axis has the larger error; (3) in the chosen axis branch → activate only the needed actuator(s) for that axis AND turn off ALL actuators for the other axis entirely; (4) use ESPHome interlock so UP and DOWN relays on the same axis can never fire together. This one-axis-at-a-time approach is mandatory — it prevents the platform fighting itself, is safe with relay interlocks, and will converge to level.
- DUPLICATE interval: KEY RULE — ALWAYS APPLY: ESPHome allows only ONE top-level interval: section per YAML file. If you need multiple timed tasks, put ALL of them as separate list items (each starting with -) inside a single interval: section. NEVER write two separate interval: top-level sections — ESPHome silently drops the second one and those tasks will never run. If the base file already has an interval: section, merge your new tasks into it.
Return ONLY a JSON object: {"yaml": "<the complete new file>", "notes": "<one to three short plain-English sentences on what you added, or what you couldn't do>"}.`;
async function esphWithAI(){
  const f=esphForm(),it=intentNow(),desc=(f.desc||'').trim()||(it&&it.desc||'').trim(),P=wr.plan;
  let base;try{base=esphomeYaml(P,f);}catch(e){WF.flash('Could not build the base file — make sure your board is set and parts have pins assigned. ('+e.message+')',7000);return;}
  if(!base.yaml){WF.flash(base.error||'Could not build the base file — make sure your board is set and parts have pins assigned.',7000);return;}
  if(!desc&&!base.unknown.length)return WF.flash('Every part is already in the file. Describe what the device should do in the box, then click Make it with AI.',6000);
  if(!aiKey())return WF.flash('Set up a key for this AI first: click "'+keyLabel()+'" next to the AI menu.',6000);
  const check=window.wfNative&&window.wfNative.esphomeCheck,say=h=>{wr.aiMsg=h;const o=$('wrAiOut');if(o)o.innerHTML=h;};
  // (bug-8) Block code generation if any KNOWN parts still have no pin data — writing code with missing pins produces broken output.
  // Unknown parts (in base.unknown) are exempt — the AI is being asked to research and wire them up right now.
  const _unknownLabels=new Set((base.unknown||[]).map(u=>u.label));
  const _missingPins=(P.warn||[]).filter(w=>w.includes('has no pin data yet')&&!_unknownLabels.has(w.replace(/ has no pin data yet[\s\S]*$/,'')));
  if(_missingPins.length){
    const _missingNames=_missingPins.map(w=>w.replace(/ has no pin data yet[\s\S]*$/,'')).join(', ');
    WF.flash('⚠️ '+_missingNames+' — no pin data yet. Go to Parts → Look up online first.',8000);
    say('<div class="bad">⚠️ <b>'+esc(_missingNames)+'</b> '+(_missingPins.length===1?'has':'have')+' no pin data yet, so the AI can\'t wire '+(_missingPins.length===1?'it':'them')+' up. Go to <b>Parts</b>, click <b>Look up online</b> next to each one to fill in the pins, then come back and click Write it with AI again.</div>');
    return;
  }
  esphAiBusy=true;wr.ai=null;renderWiringSide();
  let yaml=base.yaml,notes='',ok=null,errs='',tries=0;
  try{
    for(;tries<3;tries++){
      say(`<div class="ewNote">${tries?'Fixing what ESPHome found (try '+(tries+1)+' of 3)…':'Asking your AI ('+esc(PROVIDERS[aiProv()].name)+')… <span id="wrAiCd"></span> '+(aiProv()==='ollama'?'Local AI can take 1–5 minutes depending on your model and computer.':'This usually takes 10–40 seconds.')}</div>`);
      if(!tries)_cdStart('wrAiCd',aiProv()==='ollama'?300:60);
      const _batPowered=wiz.power==='battery'||P.insts.some(i=>i.part&&i.part.type==='battery');
      const _batNote=_batPowered?`\nBATTERY POWER — IMPORTANT RULES:\n1. Use ESP32 deep_sleep aggressively to extend battery life. The ideal pattern: sleep → wake on event or timer → check/act/send message → sleep again. Example for a gate sensor: sleep until reed switch wakes (gpio wakeup) → wake → send "gate opened" to ntfy → sleep until reed switch releases → wake → send "gate closed" → sleep.\n2. If a battery_low binary sensor exists in the file, add an automation: when battery_low turns ON, POST a phone notification to the ntfy topic (use the \${ntfy_topic} substitution if it exists) with message "Battery low — please recharge soon".\n3. Never use continuous loops or long polling delays when the device is battery powered. Prefer event-driven gpio wakeup over timer_wakeup where possible.\n4. In your notes to the user, always include a plain-English sentence explaining the battery setup — something like: "I've set this up in battery-save mode so it will last as long as possible — it sleeps between readings and wakes only when needed. When the battery gets low it will send a message to your phone asking you to charge it. If you can run a cable, mains power is always simpler and more reliable."\n`:'';
      const text=ESPH_AI_PROMPT+_batNote+`\n\nThe parts in this device: ${P.insts.map(i=>i.label).join(', ')}.\nReadings (sensor ids): ${base.meas.map(m=>m.id+' = '+m.label+' in '+(m.unit==='cm'?'metres':m.unit)).join(', ')||'none'}.\nLight id: ${base.lightId||'none'}${base.rgb?' (an RGB light)':base.lightId?' (on/off only)':''}.\n\n`+(base.unknown.length?`Parts not in the file yet: write the ESPHome components for each of these, using exactly the GPIO pins given (they are already wired that way). Work out what each module is from its name, part-file details and pin names, then remove the "# Still to add" comment:\n${JSON.stringify(base.unknown,null,1)}\n\n`:'')+`What the user wants the device to do:\n"""${desc||'(nothing extra: just make every part work and report its readings)'}"""\n\n`+intentAINote()+
        (tries?`Your last file failed ESPHome's check with these errors. Fix them and send the whole corrected file:\n${errs}\n\nYour last file:\n${yaml}`:`The current file:\n${yaml}`);
      const {data}=aiProv()==='claude'?await claude([{type:'text',text}],false):isOA()?await oaAI(aiProv(),text):await gemini([{text}],false);
      if(data&&data.refuse)throw softErr('Your AI says it can\'t do everything you asked: '+String(data.reason||'no reason given').slice(0,300));
      if(!data||typeof data.yaml!=='string'||!/esphome:/.test(data.yaml))throw softErr('The AI didn\'t send back a whole ESPHome file. Try again, or describe it more simply.');
      yaml=data.yaml.replace(/\r/g,'').replace(/\n# Still to add[^\n]*\n(#[^\n]*\n)*/g,'\n');if(!yaml.endsWith('\n'))yaml+='\n';notes=String(data.notes||'').slice(0,600);
      if(!check){ok=null;break;}
      say('<div class="ewNote">Checking the AI\'s file with ESPHome…</div>');
      const c=await window.wfNative.esphomeCheck(yaml,base.slug);
      if(!c.found){ok=null;break;}
      if(c.ok){ok=true;break;}
      ok=false;errs=c.out.split(/\r?\n/).filter(l=>/ERROR|Failed config|is a required|not valid|Invalid|Unable|Couldn't|\[[a-z_.]+\]/i.test(l)&&!/ignore_|log_level/.test(l)).slice(0,25).join('\n')||c.out.slice(-2500);
    }
    wr.ai={yaml,notes,ok};
    // Persist the AI result so re-opening the Code screen (or re-running with the same parts)
    // restores the green banner instead of showing "needs the AI" again.
    if(ok!==false&&base.unknown.length)WF.store.set(ESPH_AI_KEY,JSON.stringify({yaml,notes,ok,sig:esphAiSig(base.unknown)}));
    // (bug-9) When the AI wrote code for previously-unknown parts, save a note on each part in
    // the custom library so the user knows ESPHome code has been generated for it, and so the
    // green "AI has written the code" banner stays informative on future visits.
    let savedPartNames=[];
    if(ok!==false&&base.unknown.length){
      const dateStr=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
      for(const u of base.unknown){
        // Find the part in the full parts list by matching the name used in the unknown entry.
        const pid=wr.plan.insts.find(i=>i.label===u.label)?.part?.id;
        if(!pid)continue;
        const existing=custom.find(c=>c.id===pid);
        const base_=existing||(allParts().find(p=>p.id===pid));
        if(!base_)continue;
        const updated=Object.assign({},base_,{
          espYamlNote:`ESPHome code written by AI on ${dateStr}`,
          notes:(base_.notes||'').replace(/\nESPHome code written by AI.*$/,'').trim()+'\nESPHome code written by AI on '+dateStr
        });
        delete updated.builtin;
        const idx=custom.findIndex(c=>c.id===pid);
        if(idx>=0)custom[idx]=updated;else custom.push(updated);
        savedPartNames.push(u.label);
      }
      if(savedPartNames.length)saveLib();
    }
    const savedMsg=savedPartNames.length?`<div class="ewNote">✓ Saved to your parts library: ${savedPartNames.map(n=>esc(n)).join(', ')} — EvenUCan now knows ESPHome code was generated for ${savedPartNames.length===1?'this part':'these parts'}.</div>`:'';
    say(ok===false?`<div class="bad">✗ After 3 tries ESPHome still finds a problem in the AI's file. It is shown below so you can see it, but don't flash it: try describing it more simply, or use the Light rule.</div>`:
      `<div class="${ok?'ok':'warn'}" style="margin:4px 0">${ok?'✓ Written by your AI and checked by ESPHome'+(tries?' (fixed after '+tries+' tr'+(tries>1?'ies':'y')+')':''):'Written by your AI. ESPHome isn\'t on this computer, so click Validate in ESPHome Device Builder before installing.'}</div>`+
      savedMsg+(notes?`<div class="ewNote"><b>AI's notes:</b> ${esc(notes)}</div>`:'')+'<div class="ewNote">Read it through before you install it: an AI can misunderstand. <a href="#" id="wrAiUndo">Back to the plain file</a></div>');
  }catch(e){
    const isTimeout=e&&(e.name==='AbortError'||/abort|timed? ?out/i.test(e.message||''));
    say('<div class="bad">'+(isTimeout?'The AI didn\'t reply within 60 seconds.'+esc(_otherAiHint())+' Check your internet connection or try again.':esc(e.message||String(e)))+'</div>');
  }finally{_cdStop();}
  esphAiBusy=false;
  const msg=wr.aiMsg;renderWiringSide();wr.aiMsg=msg;const o=$('wrAiOut');if(o)o.innerHTML=msg;
}
// ---- Ask AI: a focused chat about THIS build only - not a general chatbot. It can discuss the wiring,
// name the kind of part that might be missing (it can't search the real parts library or the web: for
// that use "Look up online" or "Browse parts"), and help write or change the ESPHome file.
const CHAT_SCOPE=`You are built into EvenUCan, a program that designs 3D-printed boxes for electronics projects and writes their ESPHome code. Only help with THIS project: its wiring, what kind of part might still be needed (name the kind, e.g. "a DHT22 temperature/humidity sensor" or "a reed switch" - you cannot search the real parts library or the web, so never claim to have found a specific product), and the ESPHome YAML file. If asked something unrelated to this project, say in one short sentence that you're set up to help with this build only, and don't answer it. When you give ESPHome code, put the WHOLE corrected file in one \`\`\`yaml fenced code block so it can be used directly, not just the changed lines. Keep replies short and practical, like a helpful colleague, not an encyclopedia.`;
// What the AI is told about the project each turn: the parts in the box, the pins already wired, and
// whether an ESPHome file already exists for it (so it extends that one instead of inventing wiring).
function chatProjectNote(){
  const P=wr.plan;
  let t='Parts in this build: '+(P.insts.map(i=>i.label).join(', ')||'none yet')+'.\n';
  if(P.noPinParts&&P.noPinParts.length)t+='Parts with NO pin data yet (not in the wiring diagram): '+(P.noPinParts.map(p=>p.label).join(', '))+'. The user needs to add pin data for these in the Parts Library before they can be wired. Suggest they click the "Fix: add pins →" button next to the warning, or go to Parts and use "Look up online".\n';
  const sig=P.assigned.filter(a=>['sig','uart_tx','uart_rx','trig','echo','sda','scl'].includes(a.role)&&a.pin);
  if(sig.length)t+='Signal pins wired so far: '+sig.map(a=>a.inst.label+' on '+a.pin.n).join(', ')+'.\n';
  const ta=$('wrEsp');
  if(ta&&ta.value&&/esphome:/.test(ta.value))t+='There is already a working ESPHome file for this device (see the "ESPHome device" tab). If asked to change or extend it, base your answer on this exact file and return the whole corrected file:\n'+ta.value.slice(0,6000)+'\n';
  return t;
}
// One plain-text, multi-turn request to whichever AI is selected. msgs: [{role:'user'|'assistant',text}].
// Unlike claude()/gemini()/nvidia() (which force a strict JSON reply for the structured features) this
// returns the AI's own words, for a real back-and-forth conversation.
async function chatAsk(msgs){
  const prov=aiProv(),key=aiKey(),sys=CHAT_SCOPE+'\n\n'+chatProjectNote();
  if(prov==='claude'){
    const SDK=window.AnthropicSDK;if(!SDK)throw new Error('The Claude add-on is missing from this copy of the app.');
    const client=new SDK({apiKey:key,dangerouslyAllowBrowser:true,maxRetries:2});
    let m;
    try{m=await client.messages.create({model:'claude-opus-5-5',max_tokens:2000,system:sys,messages:msgs.map(x=>({role:x.role,content:x.text}))});}
    catch(e){
      if(e instanceof SDK.AuthenticationError||e instanceof SDK.PermissionDeniedError)throw new Error('Anthropic didn\'t accept the Claude key. Click "Change Claude key…" and paste it again.');
      if(e instanceof SDK.RateLimitError)throw new Error('Claude is getting too many requests right now. Wait a minute and try again.');
      if(e instanceof SDK.APIConnectionError)throw new Error('Couldn\'t reach Anthropic. Check the internet connection and try again.');
      throw new Error((e&&e.message)||String(e));
    }
    return m.content.filter(b=>b.type==='text').map(b=>b.text).join('').trim()||'(no reply)';
  }
  if(OA[prov]){
    const A=OA[prov],content=[{role:'system',content:sys},...msgs.map(x=>({role:x.role,content:x.text}))];
    let last='',busy=0;
    for(const mdl of oaOrder(prov)){
      const {status,j,msg}=await oaChat(prov,key,mdl,content,1500);
      if(status===401||status===403)throw new Error(A.name+' didn\'t accept the key. Click "Change '+A.name+' key…" and paste it again.');
      if(status===429||status>=500){busy++;last=msg;continue;}
      if(oaSkip(status,msg)){last=msg;continue;}
      if(status!==200)throw new Error(A.name+' said: '+(msg||'HTTP '+status));
      const c=j.choices&&j.choices[0];return String((c&&c.message&&c.message.content)||'').replace(/<think>[\s\S]*?<\/think>/g,'').trim()||'(no reply)';
    }
    throw new Error(busy?A.name+' is busy right now, or the free limit ('+A.limit+') was reached. Wait a minute (or until tomorrow for a daily limit), or switch AI.':'None of '+A.name+'\'s free models answered'+(last?' ('+last+')':'')+'. Wait a minute, or switch AI.');
  }
  // Gemini: plain-text multi-turn (no JSON mode, so it can talk freely)
  const order=[WF.store.get('geminiModel'),...AI_MODELS].filter((m,i,a)=>m&&a.indexOf(m)===i);
  const contents=msgs.map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.text}]}));
  let last='';
  for(const m of order){
    let r;
    try{r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents,generationConfig:{temperature:0.3}})});}
    catch(e){throw new Error('Couldn\'t reach Google. Check the internet connection and try again.');}
    const j=await r.json().catch(()=>({})),msg=(j.error&&j.error.message)||r.statusText||'';
    if(r.status===401||r.status===403||/API key/i.test(msg))throw new Error('Google didn\'t accept the AI key. Click "Change Gemini key…" and paste it again.');
    if(r.status===429)throw new Error('The free AI limit has been reached for now. Wait a minute and try again.');
    if(r.status===500||r.status===503||r.status===404){last=msg;continue;}
    if(!r.ok){last=msg;continue;}
    const cand=j.candidates&&j.candidates[0];
    return ((cand&&cand.content&&cand.content.parts)||[]).map(p=>p.text||'').join('').trim()||'(no reply)';
  }
  throw new Error('Google\'s free AI is busy right now'+(last?' ('+last+')':'')+'. Try again in a minute, or switch AI.');
}
// One assistant reply shown as text plus any whole ```yaml fenced files as code blocks with a
// "Use this code" button (so help writing ESPHome code can go straight into the ESPHome tab).
function chatBubble(m,i){
  if(m.role==='user')return `<div class="chatMsg me">${esc(m.text)}</div>`;
  const parts=[],re=/```(?:ya?ml|esphome)?\n([\s\S]*?)```/g;let last=0,mm;
  while((mm=re.exec(m.text))){
    if(mm.index>last)parts.push({t:'text',v:m.text.slice(last,mm.index)});
    parts.push({t:'code',v:mm[1]});last=re.lastIndex;
  }
  if(last<m.text.length)parts.push({t:'text',v:m.text.slice(last)});
  const body=parts.map(p=>p.t==='text'?esc(p.v):`<textarea readonly class="wrCode chatCode" style="height:160px">${esc(p.v)}</textarea><div class="ewRow"><button data-chat-use="1">Use this ESPHome code</button></div>`).join('');
  return `<div class="chatMsg ai${m.err?' err':''}">${body}</div>`;
}
function chatPanel(){
  const canAI=!!aiKey(),busy=wr.chat.busy;
  let h=`<h4>Ask AI</h4><div class="ewNote" style="margin-bottom:6px">Talk through what you're trying to build: it can suggest what kind of part might help and write or change the ESPHome file. It won't chat about anything else, and it can't search the web or browse the parts library (use <b>Look up online</b> or <b>Browse parts</b> for that).</div>
<div class="ewRow"><label>AI <select id="wrcProv">${Object.entries(PROVIDERS).map(([k,v])=>`<option value="${k}"${aiProv()===k?' selected':''}>${esc(v.name)}${aiKey(k)?' ✓':''}</option>`).join('')}</select></label><button id="wrcKey">${keyLabel()}</button>${wr.chat.msgs.length?'<button id="wrcClear">Clear chat</button>':''}</div>`;
  h+=`<div class="chatLog" id="wrcLog">`+(wr.chat.msgs.length?wr.chat.msgs.map(chatBubble).join(''):'<div class="ewNote">e.g. "I want to water a plant from a tank and turn on a light when the soil is dry" — describe it below.</div>')+(busy?'<div class="chatMsg ai"><i>Thinking…</i></div>':'')+`</div>
<div class="chatBar"><textarea id="wrcIn" placeholder="Describe what you're trying to build, or ask it to change the ESPHome file…"${busy?' disabled':''}></textarea><button id="wrcSend"${busy||!canAI?' disabled':''}>Send</button></div>`+
  (canAI?'':'<div class="ewNote">Needs a key for this AI: click <b>'+esc(keyLabel())+'</b> above.</div>');
  return h;
}
function scrollChat(){const l=$('wrcLog');if(l)l.scrollTop=l.scrollHeight;}
async function chatSend(){
  const ta=$('wrcIn'),text=(ta.value||'').trim();if(!text||wr.chat.busy)return;
  if(!aiKey())return WF.flash('Set up a key for this AI first: click "'+keyLabel()+'" above.',6000);
  wr.chat.msgs.push({role:'user',text});ta.value='';wr.chat.busy=true;renderWiringSide();scrollChat();
  try{const reply=await chatAsk(wr.chat.msgs);wr.chat.msgs.push({role:'assistant',text:reply});}
  catch(e){wr.chat.msgs.push({role:'assistant',text:(e&&e.message)||String(e),err:true});}
  wr.chat.busy=false;renderWiringSide();scrollChat();
}
function wiringText(){
  const P=wr.plan;if(P.error)return P.error;
  let t='EvenUCan wiring list\n\n';
  P.nets.forEach(n=>{t+=n.name+'\n';for(const [ia,ib] of n.links){const a=n.pins[ia],b=n.pins[ib];t+=`  [ ] ${a.inst.label} ${a.pin.n}  ->  ${b.inst.label} ${b.pin.n}\n`;}});
  if(P.warn.length)t+='\nWarnings\n'+P.warn.map(w=>'  ! '+w).join('\n')+'\n';
  if(P.info.length)t+='\nNotes\n'+P.info.map(w=>'  - '+w).join('\n')+'\n';
  t+='\nESPHome\n'+P.code.esphome+'\nArduino\n'+P.code.arduino;
  return t;
}
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
  if(el.dataset.capfix){capFixLater(el.dataset.capfix);return;}
  if(el.id==='wrPfSave'){if(pfCode){const ext=isIno(pfCode.pf)?'.ino':'.py',n=esphSlug(esphForm().name).replace(/-/g,'_')+ext;WF.download(n,pfCode.code,'text/plain');WF.flash('Saved '+n);}return;}
  if(el.id==='wrKey'){askKey();return;}
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
  if(el.id==='wrEspSave'){const r=esphomeYaml(wr.plan,esphForm());if(r.yaml){WF.downloadBlob(r.slug+'.yaml',new Blob([esphCurrent(r)],{type:'text/yaml'}));WF.flash('Saved '+r.slug+'.yaml');}}
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
function wrWireAt(sx,sy){
  let best=null;
  for(const h of wr.hit||[])for(let q=1;q<h.pts.length;q++){
    const [ax,ay]=h.pts[q-1],[bx,by]=h.pts[q],dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((sx-ax)*dx+(sy-ay)*dy)/L));
    const d=Math.hypot(ax+t*dx-sx,ay+t*dy-sy);if(d<8&&(!best||d<best.d))best={k:h.k,j:h.j,d};
  }
  return best;
}
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
