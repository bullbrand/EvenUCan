// EvenUCan Enclosure Wizard - 17-code-starter-and-ask-ai.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

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
const starterSketch=function starterSketch(P,pf){
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
};
const makeStarter=function makeStarter(){
  const P=wr&&wr.plan;if(!P||P.error)return;
  const pf=pfOfPlan(P);if(pf==='esphome')return;
  pfCode={pf,sig:planSig(P),code:starterSketch(P,pf),notes:'A starter '+(pf==='raspberrypi'?'program':'sketch')+' made by EvenUCan without AI: the pins match your wiring, and setup() and loop() have a note for each part. Add your own code where it says TODO.',warn:[],bad:[],starter:true};
  pfMsg='';renderWiringSide();drawGuide();
};
const generateArduinoCode=async function generateArduinoCode(){return platformCodeAI('arduino');};
const generatePiCode=async function generatePiCode(){return platformCodeAI('raspberrypi');};
const pfGenerate=async function pfGenerate(){
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
  pfBusy=true;pfMsg='';renderWiringSide();_cdStart('pfAiCd',aiProv()==='localai'?300:60);
  try{const r=await platformCodeAI(pf);pfCode=Object.assign(r,{pf,sig:planSig(P)});inoAutoVet();}
  catch(e){console.error('EvenUCan: could not write the '+PLATFORMS[pf].code,e);
    const isTimeout=e&&(e.name==='AbortError'||/abort|timed? ?out/i.test(e.message||''));
    pfMsg=e.refuse?'Your AI says it can\'t do everything you asked with these parts: '+e.refuse+' Change the board or parts above, then try again.':/garbled/.test(e.message||'')?'Sorry, the AI\'s reply couldn\'t be read: click Write the code with AI again.':isTimeout?'The AI didn\'t reply within 60 seconds.'+_otherAiHint()+' Check your internet connection or try again.':'The AI couldn\'t be reached: '+(e.message||e)+' Check the key and the internet connection.';}
  finally{_cdStop();pfBusy=false;if(wrBack.style.display==='grid'&&wr.plan===P)renderWiringSide();drawGuide();}
};
// The Code tab for a board that doesn't run ESPHome.
const platformCodePanel=function platformCodePanel(pf){
  const P=wr.plan,PF=PLATFORMS[pf],canAI=!!aiKey(),ext=isIno(pf)?'.ino':'.py';
  if((!pfCode||pfCode.pf!==pf)&&!pfBusy&&P&&!P.error){
    try{
      pfCode={pf,sig:planSig(P),code:starterSketch(P,pf),notes:'Starter '+(pf==='raspberrypi'?'program':'sketch')+' ready with all your pins wired up! Click "✨ Write full code with AI" above if you want your AI helper to write the complete project behaviour automatically.',warn:[],bad:[],starter:true};
      setTimeout(()=>{if(typeof drawGuide==='function')drawGuide();},0);
    }catch(e){}
  }
  const c=pfCode&&pfCode.pf===pf?pfCode:null;
  const issues=planIssues(P),blocked=issues.some(x=>x.block);
  let h=`<h4>${esc(PF.code)} for ${esc(P.ctrl.label)}</h4>`+capHtml(issues)+`<div class="ewNote" style="margin-bottom:6px">We've pre-filled a ready-to-compile <b>starter ${isIno(pf)?'sketch':'program'}</b> with your exact pins below! Want the AI to write the full behaviour from your description? Click <b>✨ Write full code with AI</b>.</div>`;
  const aiCtl=`<div class="ewRow"><label>AI <select id="wrProv">${Object.entries(PROVIDERS).map(([k,v])=>`<option value="${k}"${aiProv()===k?' selected':''}>${esc(v.name)}${aiKey(k)?' ✓':''}</option>`).join('')}</select></label><button id="wrKey">${keyLabel()}</button></div>
<div class="ewRow" style="flex-wrap:wrap"><button id="wrPfGen"${canAI?' class="primary"':''}${pfBusy||!canAI||blocked?' disabled':''}>${pfBusy?'Writing... please wait':c&&!c.starter?'✨ Write it again with AI':'✨ Write full code with AI'}</button><button id="wrPfStarter" class="sec"${pfBusy||blocked?' disabled':''}>Reset to starter ${isIno(pf)?'sketch':'program'} (no AI)</button></div>${canAI?'':'<div class="ewNote">Want AI to write the full logic? Click <b>'+esc(keyLabel())+'</b> above to connect a free AI key, or use the starter code below right away!</div>'}`;
  if(pfBusy)h+=`<div class="ewNote">Asking your AI (${esc(PROVIDERS[aiProv()].name)})… <span id="pfAiCd"></span> this usually takes 10–60 seconds.</div>`;
  if(pfMsg)h+=`<div class="bad" style="margin:6px 0">${esc(pfMsg)}</div>`;
  if(c){
    if(c.sig!==planSig(P))h+='<div class="warn" style="margin:6px 0">The wiring has changed since this was written, so some pins may be wrong: click <b>Write it again</b>.</div>';
    if(c.bad&&c.bad.length)h+=`<div class="capBox" role="alert"><b>⛔ ${c.bad.map(esc).join(' ')}</b><div>Click <b>Write it again</b>, or change the board or parts.</div></div>`;
    h+=`<div class="actGrid"><div class="actGrp"><b>Put it on the board</b><button id="wrPfFlash" class="actBtn hwBtn" title="Check, compile and upload this sketch right here in EvenUCan">⚡ Compile &amp; Upload in EvenUCan</button><button id="wrPfIde" class="primary actBtn">${openLabel(pf)}</button></div><div class="actGrp"><b>Check</b><button class="actBtn" id="wrPfDoctor" title="Check this sketch for common mistakes">🩺 Check my code</button></div><div class="actGrp"><b>Keep</b><button class="actBtn" data-copy="wrPf">Copy code</button><button class="actBtn" id="wrPfSave">Download as ${ext}</button><button class="actBtn" id="wrSaveProject" title="Save the complete project as a 3MF — idea, parts, box, wiring and code all in one file you can reload or share">💾 Save project…</button></div></div><textarea readonly class="wrCode" id="wrPf" style="height:240px;margin-top:6px">${esc(c.code)}</textarea>`+
      (c.notes?`<div class="ewNote" style="margin:4px 0">${esc(c.notes)}</div>`:'')+(c.warn.length?`<ul style="list-style:none;padding:0;margin:6px 0">${c.warn.map(w=>`<li class="warn"><span class="ic">!</span><span style="color:var(--text)">${esc(w)}</span></li>`).join('')}</ul>`:'')+
      ntfyBox(intentTopic());
  }else if(!pfBusy)h+='<div class="ewNote" style="margin-top:6px">Nothing is sent to the AI until you click the button.</div>';
  h+=`<details class="efdetails" style="margin:8px 0;border:1px solid var(--line);border-radius:6px;padding:6px 10px;background:var(--bg2)"${pfBusy||pfMsg||!c?' open':''}><summary style="font-weight:600;cursor:pointer">✨ Write the full code with AI (optional)</summary>${aiCtl}</details>`;
  if(c)h+=`<div class="ewNote" style="margin-top:8px">Click <b>${openLabel(pf)}</b>: EvenUCan saves the ${isIno(pf)?'sketch':'program'} where ${esc(toolName(pf))} finds it and stays on screen with each step until it ${isIno(pf)?'is on your board':'runs on your Pi'}.</div>`;
  h+=toolLinkHtml(pf);
  return h;
};
const esphSet=function esphSet(el){
  const k=el.dataset.ef,f=esphForm();
  f[k]=el.type==='checkbox'?el.checked:el.type==='radio'?el.value==='1':el.type==='number'?+el.value:el.value;
  WF.store.set(ESPH_KEY,JSON.stringify(f));
  if(wr.ai){wr.ai=null;wr.aiMsg='<div class="ewNote">You changed the answers, so this is the plain file again: click <b>Write it with AI</b> to add your description.</div>';}
};
// The file shown, copied, saved and checked: the AI's version when there is one, else the plain one.
const esphCurrent=r=>WF.store.get('esphome.edit')||wr.ai&&wr.ai.yaml||r.yaml;
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
const esphWithAI=async function esphWithAI(){
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
      say(`<div class="ewNote">${tries?'Fixing what ESPHome found (try '+(tries+1)+' of 3)…':'Asking your AI ('+esc(PROVIDERS[aiProv()].name)+')… <span id="wrAiCd"></span> '+(aiProv()==='localai'?'Local AI can take 1–5 minutes depending on your model and computer.':'This usually takes 10–40 seconds.')}</div>`);
      if(!tries)_cdStart('wrAiCd',aiProv()==='localai'?300:60);
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
};
// ---- Ask AI: a focused chat about THIS build only - not a general chatbot. It can discuss the wiring,
// name the kind of part that might be missing (it can't search the real parts library or the web: for
// that use "Look up online" or "Browse parts"), and help write or change the ESPHome file.
const CHAT_SCOPE=`You are the EvenUCan Embedded Electronics & Coding Specialist built directly into EvenUCan. You help the user with electronics projects, circuit wiring, 3D enclosures, ESPHome YAML, and Arduino (.ino) code. You are an expert in microcontrollers (ESP32, ESP8266, RP2040, Arduino), sensors, actuators, and circuit safety (flyback diodes, resistor dividers, star grounds). When providing code, put complete code in fenced blocks. Keep replies friendly, concise, and technically accurate.`;
// What the AI is told about the project each turn: the parts in the box, the pins already wired, and
// whether an ESPHome file already exists for it (so it extends that one instead of inventing wiring).
const chatProjectNote=function chatProjectNote(){
  const P=wr.plan;
  let t='Parts in this build: '+(P.insts.map(i=>i.label).join(', ')||'none yet')+'.\n';
  if(P.noPinParts&&P.noPinParts.length)t+='Parts with NO pin data yet (not in the wiring diagram): '+(P.noPinParts.map(p=>p.label).join(', '))+'. The user needs to add pin data for these in the Parts Library before they can be wired. Suggest they click the "Fix: add pins →" button next to the warning, or go to Parts and use "Look up online".\n';
  const sig=P.assigned.filter(a=>['sig','uart_tx','uart_rx','trig','echo','sda','scl'].includes(a.role)&&a.pin);
  if(sig.length)t+='Signal pins wired so far: '+sig.map(a=>a.inst.label+' on '+a.pin.n).join(', ')+'.\n';
  const ta=$('wrEsp');
  if(ta&&ta.value&&/esphome:/.test(ta.value))t+='There is already a working ESPHome file for this device (see the "ESPHome device" tab). If asked to change or extend it, base your answer on this exact file and return the whole corrected file:\n'+ta.value.slice(0,6000)+'\n';
  return t;
};
// One plain-text, multi-turn request to whichever AI is selected. msgs: [{role:'user'|'assistant',text}].
// Unlike claude()/gemini() (which force a strict JSON reply for the structured features) this
// returns the AI's own words, for a real back-and-forth conversation.
const chatAsk=async function chatAsk(msgs){
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
};
// One assistant reply shown as text plus any whole ```yaml fenced files as code blocks with a
// "Use this code" button (so help writing ESPHome code can go straight into the ESPHome tab).
const chatBubble=function chatBubble(m,i){
  if(m.role==='user')return `<div class="chatMsg me">${esc(m.text)}</div>`;
  const parts=[],re=/```(?:ya?ml|esphome)?\n([\s\S]*?)```/g;let last=0,mm;
  while((mm=re.exec(m.text))){
    if(mm.index>last)parts.push({t:'text',v:m.text.slice(last,mm.index)});
    parts.push({t:'code',v:mm[1]});last=re.lastIndex;
  }
  if(last<m.text.length)parts.push({t:'text',v:m.text.slice(last)});
  const body=parts.map(p=>p.t==='text'?esc(p.v):`<textarea readonly class="wrCode chatCode" style="height:160px">${esc(p.v)}</textarea><div class="ewRow"><button data-chat-use="1">Use this ESPHome code</button></div>`).join('');
  return `<div class="chatMsg ai${m.err?' err':''}">${body}</div>`;
};
const chatPanel=function chatPanel(){
  const canAI=!!aiKey(),busy=wr.chat.busy;
  let h=`<h4>Ask AI</h4><div class="ewNote" style="margin-bottom:6px">Talk through what you're trying to build: it can suggest what kind of part might help and write or change the ESPHome file. It won't chat about anything else, and it can't search the web or browse the parts library (use <b>Look up online</b> or <b>Browse parts</b> for that).</div>
<div class="ewRow"><label>AI <select id="wrcProv">${Object.entries(PROVIDERS).map(([k,v])=>`<option value="${k}"${aiProv()===k?' selected':''}>${esc(v.name)}${aiKey(k)?' ✓':''}</option>`).join('')}</select></label><button id="wrcKey">${keyLabel()}</button>${wr.chat.msgs.length?'<button id="wrcClear">Clear chat</button>':''}</div>`;
  h+=`<div class="chatLog" id="wrcLog">`+(wr.chat.msgs.length?wr.chat.msgs.map(chatBubble).join(''):'<div class="ewNote">e.g. "I want to water a plant from a tank and turn on a light when the soil is dry" — describe it below.</div>')+(busy?'<div class="chatMsg ai"><i>Thinking…</i></div>':'')+`</div>
<div class="chatBar"><textarea id="wrcIn" placeholder="Describe what you're trying to build, or ask it to change the ESPHome file…"${busy?' disabled':''}></textarea><button id="wrcSend"${busy||!canAI?' disabled':''}>Send</button></div>`+
  (canAI?'':'<div class="ewNote">Needs a key for this AI: click <b>'+esc(keyLabel())+'</b> above.</div>');
  return h;
};
const scrollChat=function scrollChat(){const l=$('wrcLog');if(l)l.scrollTop=l.scrollHeight;};
const chatSend=async function chatSend(){
  const ta=$('wrcIn'),text=(ta.value||'').trim();if(!text||wr.chat.busy)return;
  if(!aiKey())return WF.flash('Set up a key for this AI first: click "'+keyLabel()+'" above.',6000);
  wr.chat.msgs.push({role:'user',text});ta.value='';wr.chat.busy=true;renderWiringSide();scrollChat();
  try{const reply=await chatAsk(wr.chat.msgs);wr.chat.msgs.push({role:'assistant',text:reply});}
  catch(e){wr.chat.msgs.push({role:'assistant',text:(e&&e.message)||String(e),err:true});}
  wr.chat.busy=false;renderWiringSide();scrollChat();
};
const wiringText=function wiringText(){
  const P=wr.plan;if(P.error)return P.error;
  let t='EvenUCan wiring list\n\n';
  P.nets.forEach(n=>{t+=n.name+'\n';for(const [ia,ib] of n.links){const a=n.pins[ia],b=n.pins[ib];t+=`  [ ] ${a.inst.label} ${a.pin.n}  ->  ${b.inst.label} ${b.pin.n}\n`;}});
  if(P.warn.length)t+='\nWarnings\n'+P.warn.map(w=>'  ! '+w).join('\n')+'\n';
  if(P.info.length)t+='\nNotes\n'+P.info.map(w=>'  - '+w).join('\n')+'\n';
  t+='\nESPHome\n'+P.code.esphome+'\nArduino\n'+P.code.arduino;
  return t;
};
