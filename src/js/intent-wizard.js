// ---------------------------------------------------------------- Project Intent Wizard (r2): intentWizard
// "💡 What do I want to build?": the user says in plain words what the gadget should do. Their AI picks the kinds
// of parts (JSON); each is found among the built-in parts, the user's own parts, a few common modules and then the
// parts library. Anything the code needs (an API key, a town…) is asked for, then the Enclosure Wizard is filled in,
// the wiring worked out and the ESPHome file written (esphomeYaml, with weatherYaml for weather projects, and the
// idea passed on to "Make it with AI").
const INTENT_KEY='intent';// {desc, analysis, inputKeys}; each answer in 'intent_inputs.<key>' (saved in project files)
const intentNow=()=>{const raw=WF.store.get(INTENT_KEY);if(!raw)return null;try{const v=JSON.parse(raw);return v&&typeof v==='object'?v:null;}catch(e){console.error('EvenUCan: the saved project idea could not be read',e);return null;}};
function intentInputs(it){const o={};for(const k of (it&&Array.isArray(it.inputKeys)?it.inputKeys:[])){const v=WF.store.get('intent_inputs.'+k);if(v!=null)o[k]=v;}return o;}
const SECRETISH=/key|token|password|secret/i;
// The user's answers as ESPHome substitutions (used as ${name} in the file), or '' when there are none.
function intentSubs(){
  const it=intentNow();if(!it)return '';
  const v=intentInputs(it),rows=[];
  for(const k in v){
    if(!/^[a-z_][a-z0-9_]*$/.test(k)||k==='notify_time')continue;
    let val=String(v[k]).trim();
    if(k==='location')val=encodeURIComponent(val).replace(/%2C/gi,',');// goes into a web address
    if(k==='owm_api_key'&&!val)val='PASTE_YOUR_OPENWEATHERMAP_KEY_HERE';
    rows.push(`  ${k}: ${yq(val)}`);
  }
  return rows.length?'# Your own settings, from "What do I want to build?" in EvenUCan. Change them here if you need to.\nsubstitutions:\n'+rows.join('\n'):'';
}
// A weather project: the idea asked for an OpenWeatherMap key. Returns its settings, or null.
function intentWeather(){
  const it=intentNow();if(!it)return null;
  const v=intentInputs(it);if(!('owm_api_key' in v))return null;
  return {key:String(v.owm_api_key||'').trim(),loc:String(v.location||'').trim(),topic:String(v.ntfy_topic||'').trim(),time:String(v.notify_time||'07:30').trim()};
}
// The ready-made weather block: fetch the forecast, keep it in globals, show it on the OLED (scrolling), and send a
// daily summary to the phone by ntfy.sh. Works without the AI.
function weatherYaml(wx,oled,meas){
  const m=/^(\d{1,2})[:.](\d{2})$/.exec(wx.time)||[0,7,30],hh=Math.min(23,+m[1]),mm=Math.min(59,+m[2]);
  const indoor=meas.find(x=>x.id==='temperature');
  const S=[];
  S.push(['# ---- Weather from OpenWeatherMap'+(wx.topic?' and a daily message to your phone (ntfy.sh)':'')+', from your project idea.',
    '# The free OpenWeatherMap plan gives the forecast in 3-hour steps: cnt=7 asks for the next 7 of them.',
    'http_request:','  timeout: 15s','  verify_ssl: false'].join('\n'));
  S.push(['globals:','  - id: wx_now','    type: std::string','    restore_value: no','    initial_value: \'"Getting weather..."\'',
    '  - id: wx_lines','    type: std::vector<std::string>','    restore_value: no',
    '  - id: wx_summary','    type: std::string','    restore_value: no','    initial_value: \'""\''].join('\n'));
  S.push(['script:','  - id: fetch_weather','    mode: single','    then:','      - http_request.get:',
    '          url: "https://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${owm_api_key}&units=metric&cnt=7"',
    '          capture_response: true','          max_response_buffer_size: 8192','          on_response:','            then:','              - if:','                  condition:',
    '                    lambda: \'return response->status_code == 200;\'','                  then:','                    - lambda: |-',
    '                        json::parse_json(body, [](JsonObject root) -> bool {',
    '                          JsonArray list = root["list"];',
    '                          if (list.isNull() || list.size() == 0) return false;',
    '                          std::string city = root["city"]["name"] | "";',
    '                          std::string summary = "Weather for " + city + ":";',
    '                          std::vector<std::string> lines;',
    '                          char buf[48];',
    '                          bool first = true;',
    '                          for (JsonObject item : list) {',
    '                            float t = item["main"]["temp"] | 0.0f;',
    '                            const char *what = item["weather"][0]["main"] | "?";',
    '                            std::string when = item["dt_txt"] | "";',
    '                            if (when.size() >= 16) when = when.substr(11, 5);',
    '                            if (first) {',
    '                              int hum = item["main"]["humidity"] | 0;',
    '                              snprintf(buf, sizeof(buf), "%.0f°C %s", t, what);',
    '                              id(wx_now) = buf;',
    '                              summary += std::string(" now ") + buf + ", humidity " + std::to_string(hum) + "%.";',
    '                              first = false;',
    '                            }',
    '                            snprintf(buf, sizeof(buf), "%s %.0f°C %s", when.c_str(), t, what);',
    '                            lines.push_back(buf);',
    '                            summary += std::string("\\n") + buf;',
    '                          }',
    '                          id(wx_lines) = lines;',
    '                          id(wx_summary) = summary;',
    '                          return true;',
    '                        });',
    '                  else:','                    - logger.log:','                        format: "OpenWeatherMap said HTTP %d: check owm_api_key and location"',
    '                        args: [\'response->status_code\']'].join('\n'));
  const body=indoor?'return (id(wx_summary).empty() ? std::string("No weather yet") : id(wx_summary)) + "\\nIndoors: " + std::to_string((int) id(temperature).state) + "°C";'
    :'return id(wx_summary).empty() ? std::string("No weather yet") : id(wx_summary);';
  const T=['# The clock comes from the internet. The weather is fetched when it is set, then every 30 minutes.','time:','  - platform: sntp','    id: sntp_time',
    '    on_time_sync:','      then:','        - script.execute: fetch_weather','    on_time:','      - seconds: 0','        minutes: /30','        then:','          - script.execute: fetch_weather'];
  if(wx.topic)T.push(`      # The daily message, at ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}: install the free ntfy app and subscribe to your topic (ntfy_topic at the top).`,
    '      - seconds: 0',`        minutes: ${mm}`,`        hours: ${hh}`,'        then:','          - http_request.post:','              url: "https://ntfy.sh/${ntfy_topic}"',
    `              body: !lambda '${body.replace(/'/g,"''")}'`);
  S.push(T.join('\n'));
  if(oled){
    const t=oled.part.name.toLowerCase(),model=/sh1106/.test(t)?'SH1106 128x64':/128 ?x ?32/.test(t)?'SSD1306 128x32':'SSD1306 128x64';
    S.push(['font:','  - file: "gfonts://Roboto"','    id: font_big','    size: 16','  - file: "gfonts://Roboto"','    id: font_small','    size: 11'].join('\n'));
    S.push([`# ${oled.label}: the weather now at the top, the forecast scrolling underneath.`,'display:','  - platform: ssd1306_i2c','    id: oled',`    model: "${model}"`,'    address: 0x3C  # some boards use 0x3D','    update_interval: 4s','    lambda: |-',
      '      it.print(0, 0, id(font_big), id(wx_now).c_str());','      auto &lines = id(wx_lines);',
      '      if (lines.empty()) { it.print(0, 24, id(font_small), "Waiting for Wi-Fi..."); return; }','      static size_t start = 0;',
      '      for (size_t i = 0; i < 3 && i < lines.size(); i++)','        it.print(0, 20 + i * 14, id(font_small), lines[(start + i) % lines.size()].c_str());',
      '      start = (start + 1) % lines.size();'].join('\n'));
  }
  return S.join('\n\n');
}
// What "Make it with AI" is told about the idea (empty when the device wasn't planned from one).
function intentAINote(){
  const it=intentNow();if(!it||!it.desc)return '';
  const A=it.analysis||{},v=intentInputs(it);
  const set=Object.keys(v).map(k=>k+(SECRETISH.test(k)?' (private, already filled in: refer to it only as ${'+k+'})':' = '+JSON.stringify(v[k]))).join(', ')||'none';
  return 'This device was planned from the user\'s project idea. For this device the "no new secrets" rule is relaxed: the substitutions at the top of the file hold the user\'s own settings ('+set+'); use them as ${name}. '+
    'http_request, JSON parsing in lambdas (json::parse_json), globals, script, time (sntp), font and display sections are allowed. Messages to the user\'s phone are sent by an HTTP POST to https://ntfy.sh/${ntfy_topic} with the message as the body (notification method: '+(A.notification_method||'ntfy')+'). Keep any weather, display and ntfy sections already in the file working.\n'+
    (typeof briefDoctorCodeNote==='function'?briefDoctorCodeNote(it.desc,A,it.platform||'esphome',it.power||'usb'):'')+'The idea, in the user\'s words: """'+it.desc+'"""\nPlan for the file: '+(A.esphome_yaml_hint||'(none)')+'\nNotes: '+(A.esphome_notes||'(none)')+'\n\n';
}
const INTENT_CATS=['microcontrollers','displays','sensors-temperature','sensors-humidity','sensors-motion','sensors-tilt/acceleration','sensors-distance','sensors-light','sensors-moisture','power','communication modules','buttons/inputs','LEDs','buzzers','relays','motors/servos'];
// (r3) Works for any project and any platform: the AI also suggests ESP32 + ESPHome, Arduino or Raspberry Pi.
const INTENT_PROMPT=`You are an expert electronics engineer helping a complete novice build a physical electronics project.
The user will describe what they want their device to do in plain English. Your job is to work out exactly what hardware they need and how to build it. It can be ANY project: RV levelling, pet feeder, plant watering, door alarm, temperature monitor, weather station, motion detector, light controller, anything.
You must:
1. Identify the most suitable platform: "esphome" (an ESP32-S3 running ESPHome), "arduino" (an Arduino Nano) or "raspberrypi" (a Raspberry Pi 4).
2. List every component needed to make the project work (part categories: ${INTENT_CATS.join(', ')}). Only parts that are really needed.
3. If the project needs internet connectivity (Wi-Fi, phone messages, weather, Home Assistant), prefer "esphome".
4. If the project is simple sensors/actuators with no Wi-Fi needed, "arduino" may be better.
5. If the project needs a full operating system, a big display/HDMI output, a camera or Python libraries, suggest "raspberrypi".
6. Output ONLY valid JSON in the exact format specified, no other text.
Guidance:
- Put the board in "microcontroller", not in "parts".
- RULE 1 – ONLY INCLUDE WHAT WAS ASKED FOR. Read the user's description word by word. Only add a part if the user explicitly mentioned needing that function. Never add parts because they are popular or common. Example: "check soil moisture and light an LED" needs a soil sensor and an LED — it does NOT need a tilt sensor, temperature sensor, display, buzzer, or motion sensor.
- RULE 1-FUNCTION – THE USER DESCRIBES WHAT IT SHOULD DO, NOT WHICH PART. A described function counts as asked for. If they say "make a loud noise", "warn me", "light up when…", "keep it cool" or "open the door", YOU choose the right part for that job (for example a loud noise: a 12 V siren for an alarm, a small buzzer for a beep; a warning light; a fan; a lock) and explain the choice in "why" in plain words. Do not wait for them to name a buzzer, siren or horn. Choose the simplest part that really does the job, and say what you assumed.
- RULE 1-TOLD – BEING TOLD MEANS A MESSAGE, NOT A SCREEN. If the user wants to be told, notified, warned, sent a report, or "to know" something, that is a message to their phone. Do NOT add a display, screen or OLED unless they say display, screen, show it on the device, or something equivalent. Never invent a requirement the user did not state.
- RULE 1a – ESSENTIAL SUPPORT (the one exception to rule 1). The user is a novice who does not know what they need. If the project cannot work or be safe without a part they did not name, ADD it and set "support":true on it, with the reason in "why" (for example a relay module or driver to switch a siren or pump, or a power supply for 12 V loads). Never add support parts for comfort or popularity.
- RULE 1b – NEGATION RULE (highest priority). If the user's text explicitly says they do NOT want something — "no display", "no screen", "no LEDs", "no buzzer", "without a display", "standard LED not NeoPixel", "LED with a resistor" — treat that as an absolute exclusion. Remove it from the parts list regardless of any other instructions, any "It should" text that follows, or any default suggestions. Plain wording like "standard LED with a resistor" means a 5mm through-hole LED, NOT an addressable/NeoPixel/WS2812 LED.
- RULE 2 – USE THE EXACT RIGHT SENSOR. This table is the law; never substitute or add from it unless the user asked for that function:
  SOIL/PLANT/COMPOST/POT moisture, dry soil, needs watering → "capacitive soil moisture" ONLY. Do NOT add BME280, DHT22, or MPU-6050 for a soil project.
  AIR temperature or humidity → "BME280" or "DHT22". Only if the user asked for air temperature or humidity.
  TILT, level, angle → "MPU-6050 accelerometer". Only if the user asked for tilt or levelling.
  MOTION, person detected → "HC-SR501 PIR". Only if the user asked for motion detection.
- CRITICAL – use the exact right sensor for the job. Full reference table (only add parts from here if the user asked for that function):
  SOIL/PLANT/COMPOST/POT moisture, dry soil, needs watering → "capacitive soil moisture" (probe goes IN the soil, NOT enclosed in a box. Cannot measure air, temperature, or motion).
  MOTION, movement, someone walking, intruder, person detected, animal detected → "HC-SR501 PIR" (passive infrared; detects body heat moving across its field. Cannot detect water, soil, temperature, or distance. Do NOT use for moisture).
  AIR temperature, air humidity, room climate, weather reading → "BME280" or "DHT22" (measure air only. Cannot measure soil moisture or detect motion).
  DISTANCE, how far away, range finding, proximity in cm/m → "HC-SR04 ultrasonic" (NOT PIR — PIR cannot measure distance).
  LIGHT level, brightness, day/night, lux, ambient light → "BH1750" or "LDR photoresistor" (NOT PIR, NOT moisture sensor).
  VIBRATION, shaking, impact, rattle → "SW-420 vibration sensor" or "KY-002".
  TILT, level, angle, is it straight → "MPU-6050 accelerometer" (can detect tilt on all axes).
  MAGNET, door open/closed, lid closed → "reed switch" or "KY-003 hall sensor".
  WATER LEAK, flooding, rain on a surface, is surface wet → "water leak sensor module" (flat sensor pad placed on a surface, not in soil).
  FINGER TOUCH, capacitive touch button → "TTP223 capacitive touch".
  SOUND trigger, clap, loud noise → "KY-037 sound sensor".
  GAS/smoke/air quality → "MQ-2" (smoke/LPG/H2), "MQ-135" (air quality), "SGP30" (CO2/TVOC).
  COLOUR, what colour is an object → "TCS34725 colour sensor".
  HEARTBEAT, pulse, heart rate → "MAX30102 pulse oximeter".
  FINGERPRINT security → "R307 fingerprint module".
  BAROMETRIC pressure, altitude → "BMP280" or "BME280".
  UV index, ultraviolet → "GUVA-S12SD UV sensor".
- Some sensors cannot go in an enclosure box: a soil moisture probe goes in soil, a waterproof temperature probe goes in liquid. Note this in "function" so the box design can accommodate it.
- If the user wants both moisture AND temperature, use SEPARATE parts: a soil moisture sensor AND a DHT22/BME280.
- If in doubt about which sensor to use, prefer the most specific match from the table above over a general-purpose or best-known alternative.
- LED RULE: for a simple indicator light, always use separate individual LEDs — one per colour needed. Use category "output-led" and search "LED with resistor red", "LED with resistor green", etc. NEVER suggest a traffic light module or multi-LED module unless the user explicitly asks for one. NEVER use a WS2812/NeoPixel/addressable LED for a plain on/off indicator — only suggest addressable LEDs when the user explicitly asks for colour-changing lights, an LED strip, or animated lighting effects.
- RELAY COUNTING RULE (SW-01a): Count the TOTAL number of relay channels actually needed. Use a single multi-channel relay module (not multiple 1-channel modules) sized to that total. The search string MUST name the channel count explicitly: "2-channel relay module", "4-channel relay module", "8-channel relay module", etc. NEVER output "relay module" or "1-channel relay module" unless exactly 1 channel is needed. NEVER put the channel count in the function field — it must be in the search field. Example: four jack motors each needing UP and DOWN = 8 channels → search "8-channel relay module". Two motors each needing ON/OFF = 2 channels → search "2-channel relay module".
- Information from the internet (weather, forecasts, prices) needs no part. For weather use the free OpenWeatherMap API and ask for the extra inputs "owm_api_key" (url https://home.openweathermap.org/api_keys) and "location" (e.g. "London,GB").
- Messages to the user's phone use ntfy.sh (free, no account): notification_method "ntfy" and the extra input "ntfy_topic". Use "none" when the device sends nothing.
- Power: one part with category "power" and search "USB", "LiPo battery" if it must run without a cable, or "mains adapter" if it stays plugged into a wall socket.
- "requirements": every separate thing the user asked the device to do, one short sentence each (e.g. "Beep loudly when movement is detected", "Send a message to the user's phone straight away"). Never leave one out: the board and parts you pick must be able to do every one.
- Never ask for the Wi-Fi name or password (ESPHome and the Raspberry Pi keep those themselves).
- "only_if_platform" (optional) is "esphome", "arduino" or "raspberrypi" for inputs that only matter on that platform.
Output format:
{"name":"<short device name, at most 40 characters>","summary":"<2-3 sentence plain English explanation of what parts are needed and why>","requirements":["<each separate thing the user asked for>"],"hidden_needs":[{"kind":"added|ask|risk","need":"<something the user did not mention but needs, a question to settle, or a risk>","why":"<one short plain sentence>"}],"platform":"esphome|arduino|raspberrypi","platform_reason":"<one sentence explaining why this platform suits the project>","microcontroller":{"name":"ESP32-S3","why":"needs WiFi for notifications"},"parts":[{"category":"sensors-tilt/acceleration","function":"measures tilt/level on two axes","search":"MPU-6050 accelerometer","required":true,"why":"needed to know if the RV is level"}],"code_libraries":["<libraries the code uses on the chosen platform, e.g. Wire.h, Adafruit_SSD1306 or smbus2, RPi.GPIO>"],"extra_inputs_needed":[{"key":"ntfy_topic","label":"Notification topic name","help":"Any word, like 'myrv123': you'll subscribe to it in the ntfy app on your phone","url":"https://ntfy.sh","only_if_platform":"esphome"}],"code_description":"<detailed description of what the code needs to do, step by step>","esphome_notes":"<plain-English notes on how the code works>","esphome_yaml_hint":"<for an ESPHome expert: components, intervals, web addresses, display layout>","notification_method":"ntfy|none|email","missing_parts_hint":"<common names of any parts that might not be in a parts database>"}`;
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
const CTRL_IDS=Object.values(PLATFORMS).map(p=>p.board);
function ctrlPart(pf){pf=pfOk(pf);return pf==='esphome'||pf==='esp32ide'?builtinById('b-esp32s3'):commonPart({part:CTRL_PARTS[pf]});}
// One structured (JSON) request to the AI chosen in the AI menu: shared by the intent, part lookup and code writers.
async function callAI(text){return aiProv()==='claude'?await claude([{type:'text',text}],false):isOA()?await oaAI(aiProv(),text):await gemini([{text}],false);}
// The parts shown for a platform: its own board first; a Wi-Fi part is built in (ESP32, Pi) or removed (Arduino Nano).
function pfMatches(base,pf){
  pf=pfOk(pf);const P=PLATFORMS[pf];
  const out=base.map(m=>m.from!=='wifi'?m:pf==='arduino'?Object.assign({},m,{from:'removed',note:'Removed: the Arduino Nano has no Wi-Fi, so this part isn\'t used.'}):Object.assign({},m,{from:'skip',note:'Wi-Fi is built into the '+(pf!=='raspberrypi'?'ESP32':'Raspberry Pi')+', so no extra part is needed.'}));
  const c=ctrlPart(pf);
  out.unshift({spec:{category:'microcontrollers',function:'The brain of the device: runs the code'+(pf==='arduino'?'.':' and connects to Wi-Fi.'),search:P.name,required:true},part:c,ctrl:true,
    from:pf==='esphome'?'built-in part (Wi-Fi, ready for ESPHome)':pf==='esp32ide'?'built-in part (Wi-Fi, for the Arduino IDE)':'common board for '+P.name,note:c?'':'Couldn\'t add this board to your parts (is the storage full?).'});
  return out;
}
// Inputs that need the internet don't apply on the Arduino Nano (no Wi-Fi); the AI can also tie an input to one platform.
const NET_KEYS=/^(owm_api_key|location|ntfy_topic|notify_time)$/;
const inputShown=(x,pf)=>(!x.only||x.only===pf)&&!(pf==='arduino'&&NET_KEYS.test(x.key));
const IW_BADGE='<span style="background:#fff3c4;color:#7a5a00;border:1px solid #e0c060;border-radius:10px;padding:0 7px;font-size:12px;white-space:nowrap">⚠ Not found in library</span>';
// Example ideas under the description box (they only fill it in; nothing is sent until "Figure it out for me").
const EXAMPLES={
  'Weather station':'I want an ESP32 weather station for my garden shed that measures temperature, humidity, and barometric pressure using a BME280 sensor. It should display the current readings on a small I2C OLED screen (128×64), and once a day at 8 am send a summary to my phone via ntfy. Power it from a USB phone charger. No battery backup needed.',
  'RV level checker':'I want an ESP32 auto-leveling system for my motorhome with four corner levelling jacks. Use a BNO085 IMU sensor to measure pitch and roll. Each jack has a 12 V electric motor controlled by a relay pair (one UP relay and one DOWN relay) — so 8 relays in total, 2 per corner. The ESP32 controls the relays to run each jack up or down until both pitch and roll are within 0.3 degrees of level. It must never turn UP and DOWN relays on at the same time (use ESPHome interlock). Show the live pitch and roll angles on a small OLED display. Beep a buzzer once when level is reached. Add a push button to start and stop the levelling cycle. No phone or WiFi needed.',
  'Plant watering reminder':'I want an ESP32 to monitor the soil moisture in my vegetable planter box using a capacitive soil moisture sensor. When the soil is dry (sensor reads below 30%) light a red LED and send a push notification to my phone using ntfy. When moisture is fine (above 50%) light a green LED instead. Check the sensor every 10 minutes. Power it from USB. The planter is indoors on a windowsill.',
  'Motion alarm':'I want an ESP32 security sensor for my garage. Use a PIR motion sensor to detect movement. When triggered: sound a piezo buzzer for 3 seconds and immediately send a push alert to my phone via ntfy with the message "Motion detected in garage". Include a small button I can press to silence the buzzer without opening the app. Power from a USB wall adapter. WiFi is available in the garage.',
  'Pet feeder timer':'I want an ESP32 to automatically feed my cat twice a day — once at 7 am and once at 6 pm — by running a 5 V servo motor that pushes a portion of dry food through a chute. Add a physical push button so I can trigger an extra feed any time without touching the app. Show the time of the next scheduled feed on a small OLED display. Power from a 5 V USB adapter on the kitchen counter. No phone notifications needed.'
};
// A blocking dialog (like choose(), but with formatted text): resolves to the button clicked, or -1 for Esc.
// A styled stand-in for the native confirm() - same yes/no question, but as one of the app's own windows
// instead of a plain browser dialog. Browsers silently auto-decline every further confirm()/alert() on a
// page once the person has seen a few and ticked (even by habit) "Prevent this page from creating
// additional dialogs" - after that, native confirm() returns false with no dialog ever shown again, which
// is exactly how Generate's old "replace the drawing?" check could go quiet for good. This has no such limit.
function askConfirm(msg){
  return askHtml(esc(msg).replace(/\n/g,'<br>'),['Cancel','OK'],1).then(i=>i===1);
}
function askHtml(html,buttons,ok){
  return new Promise(done=>{
    const back=document.createElement('div');back.id='askBack';back.setAttribute('role','dialog');back.setAttribute('aria-modal','true');
    back.innerHTML='<div id="askBox" class="keyBox"><div class="msg" style="white-space:normal"></div><div class="btns"></div></div>';
    back.querySelector('.msg').innerHTML=html;
    const row=back.querySelector('.btns'),fin=i=>{back.remove();done(i);};
    buttons.forEach((b,i)=>{const el=document.createElement('button');el.textContent=b;if(i===ok)el.dataset.ok='1';el.onclick=()=>fin(i);row.appendChild(el);});
    back.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')fin(-1);});
    document.body.appendChild(back);(row.children[ok]||row.firstChild).focus();
  });
}
// ---- Parts selection rules: sent with the user's design intent so the AI thinks like a systems engineer.
const PARTS_RULES_PROMPT=`You are an electronics systems engineer selecting parts for a hobbyist electronics project.
You must follow ALL of the rules below — no exceptions. These rules exist because the end
user may know nothing about electronics, so your output must be complete, correct, and safe.

═══════════════════════════════════════════════════════════
RULE SET — POWER
═══════════════════════════════════════════════════════════
PWR-01  Every part's supply voltage must match an available power rail.
        If none exists, include the regulator or DC-DC converter.

PWR-02  GPIO pins (3.3 V or 5 V logic) CANNOT power or switch devices above 5 V.
        A relay, MOSFET, or motor driver is mandatory between the GPIO and any
        load operating above 5 V. Violation = broken or burnt circuit.

PWR-03  GPIO current limits (never exceed):
          ESP32 / ESP8266 : 40 mA per pin, 200 mA total
          Arduino Uno/Nano: 40 mA per pin, 200 mA total
          Raspberry Pi    : 16 mA per pin, 50 mA total
        If a load or combination of loads exceeds these, include a driver IC or buffer.

PWR-04  Inductive loads (motors, relay coils, solenoids, pumps) produce voltage spikes.
        Include a flyback diode (1N4007) across every inductive load UNLESS you
        explicitly confirm the driver module already includes one — state which.

PWR-05  Multiple voltage rails (e.g. 5 V logic + 12 V motor supply) each need
        a regulator or buck converter. The microcontroller's onboard regulator
        cannot power external loads beyond ~300 mA.

PWR-06  Standalone ICs (not pre-built modules) need decoupling capacitors:
        100 nF ceramic + 10 µF electrolytic near each Vcc pin.

═══════════════════════════════════════════════════════════
RULE SET — SWITCHING AND CONTROL
═══════════════════════════════════════════════════════════
SW-01   One independently switched load = one independent control channel.
        Two pumps switched independently = 2 relay channels (2-channel module
        or 2 × single-channel relays). A single relay for two independent loads
        is a VIOLATION.

SW-01a  RELAY COUNTING — ALWAYS APPLY:
        Step 1: Count every independently switched relay channel the design needs.
                Example: 4 jacks × (1 UP relay + 1 DOWN relay) = 8 channels.
        Step 2: Choose ONE of these options — pick whichever module matches the count:
                  2 channels  → one "2-channel relay module"
                  4 channels  → one "4-channel relay module"
                  8 channels  → one "8-channel relay module"
                  more than 8 → two or more modules whose channel counts add up
        Step 3: List ONLY that module in the parts — no extra 1-channel modules.
        VIOLATIONS (all forbidden):
          • Listing a "1-channel relay module" when more than 1 channel is needed
          • Writing any note such as "(8 channels total)" next to a 1-channel part
          • Listing fewer relay modules than the channel count requires
          • Listing more relay modules than needed

SW-02   Relay coil voltage must match the GPIO drive voltage.
        5 V relay coil for 5 V boards. For ESP32 (3.3 V GPIO), use a relay
        module with an onboard transistor input stage, or specify a 3.3 V coil.

SW-03   Relay contact ratings must exceed the load by ≥25 %.
        12 V / 2 A pump → relay contacts rated ≥15 V / 2.5 A.

SW-04   MOSFETs driven by 3.3 V GPIO must be logic-level type (Vgs(th) < 2 V).
        Standard power MOSFETs require 10 V gate drive and will not switch properly.

SW-05   AC loads require AC-rated relays or SSRs (230 V UK, 120 V US).
        DC relays on AC loads is a VIOLATION.

═══════════════════════════════════════════════════════════
RULE SET — MOTORS AND ACTUATORS
═══════════════════════════════════════════════════════════
MOT-01  No DC motor may connect directly to a GPIO pin. Include a motor driver
        (transistor for single-direction; H-bridge for reversible).

MOT-02  Stepper motors require a stepper driver (A4988, DRV8825, ULN2003 etc.).
        Direct GPIO connection is a VIOLATION.

MOT-03  More than one servo, or any servo drawing >500 mA stall, needs its own
        5 V supply — not from the microcontroller's regulator.

MOT-04  Driver current rating must exceed the motor's STALL current
        (not running current). Stall current can be 3–8× running current.

═══════════════════════════════════════════════════════════
RULE SET — LEDs AND DISPLAYS
═══════════════════════════════════════════════════════════
LED-01  Every discrete LED requires its own current-limiting resistor. No exceptions.

LED-02  Calculate resistor value: R = (Vcc – Vf) / If
          5 V / red-yellow LED (Vf 2.0 V): 150–220 Ω
          5 V / blue-white-green LED (Vf 3.2 V): 68–100 Ω
          3.3 V / red-yellow: 56–68 Ω
          3.3 V / blue-white-green: 15–33 Ω

LED-03  RGB LED = 3 resistors per LED (one per colour channel).

LED-04  Use discrete components unless a module is EXACTLY what is needed.
        3 separate LEDs of different colours → 3 LEDs + 3 resistors.
        A traffic-light module only if the design literally needs that exact
        arrangement in one physical package.

LED-05  NeoPixel / WS2812 strips need: 300–500 Ω data line resistor +
        1000 µF capacitor across power rails. >10 LEDs = separate 5 V supply.

═══════════════════════════════════════════════════════════
RULE SET — COMMUNICATIONS AND INTERFACES
═══════════════════════════════════════════════════════════
COM-01  I2C buses need 4.7 kΩ pull-up resistors on SDA and SCL unless ALL
        devices on the bus have confirmed onboard pull-ups. When in doubt, include them.

COM-02  Two I2C devices with the same address and no address-select pin →
        include a TCA9548A multiplexer.

COM-03  Any signal crossing between 5 V and 3.3 V logic must have a bidirectional
        logic level shifter on EVERY crossing line. Direct connection is a VIOLATION.

COM-04  SPI: each device needs its own Chip Select line.

COM-05  UART: TX → RX and RX → TX (crossed). Flag ambiguity.

═══════════════════════════════════════════════════════════
RULE SET — SENSORS
═══════════════════════════════════════════════════════════
SEN-01  Analog sensors on a digital-only microcontroller need an external ADC.

SEN-02  Open-collector/open-drain sensor outputs need a pull-up resistor
        (4.7–10 kΩ) to Vcc on the signal line.

SEN-03  Sensor outputs above 3.3 V connected to a 3.3 V microcontroller
        need a voltage divider or level shifter.

SEN-04  Every GPIO input that is not externally driven must have a defined state:
        10 kΩ pull-up or pull-down resistor. Floating inputs are a VIOLATION.

═══════════════════════════════════════════════════════════
RULE SET — WIRING STANDARDS
═══════════════════════════════════════════════════════════
WIRE-01 Colour convention:
          Red    = positive supply (any voltage)
          Black  = ground / negative
          Green  = 3.3 V data/signal
          Yellow = 5 V data/signal
          Blue   = analog signal
          Orange = PWM signal
          White  = general digital I/O
          Purple = I2C (SDA/SCL)

WIRE-02 Wire gauge by current:
          Signal/data              : 28–24 AWG
          5 V logic power          : 24–22 AWG
          12 V up to 2 A           : 22–20 AWG
          12 V 2–5 A               : 20–18 AWG
          12 V above 5 A           : 16 AWG or heavier

WIRE-03 Star ground: high-current loads connect their ground directly to the PSU,
        not through the microcontroller's ground pin.

WIRE-04 Every wire must have a defined source (component + pin) and
        destination (component + pin). No dangling connections.

WIRE-05 Any load drawing more than 1 A should have an inline fuse at 150 % of
        running current. Flag absence as a warning.

═══════════════════════════════════════════════════════════
SUBSTITUTION PRIORITY
═══════════════════════════════════════════════════════════
Prefer in this order:
  1. Discrete components
  2. Simple driver modules (add one missing capability only)
  3. Integrated function modules
  4. All-in-one boards only when fully justified

Exception: if the design description exactly matches a module's function, use the module.

═══════════════════════════════════════════════════════════
OUTPUT FORMAT — FOLLOW EXACTLY
═══════════════════════════════════════════════════════════
Return a JSON object with this structure:

{
  "parts": [
    {
      "name": "2-Channel 5V Relay Module",
      "qty": 1,
      "reason": "Independently switches two 12V pumps from ESP32 GPIO",
      "spec": "5V coil, 10A/250VAC contacts, optocoupler isolated input",
      "depends_on": ["ESP32", "12V PSU"],
      "pairs_with": []
    }
  ],
  "wiring": [
    {
      "from": "ESP32 GPIO14",
      "to": "Relay IN1",
      "wire": "Yellow 24AWG",
      "note": "Pump 1 control signal"
    }
  ],
  "compliance": {
    "verdict": "PASS | WARN | FAIL",
    "rules_checked": ["PWR-01","PWR-02","SW-01"],
    "warnings": ["WIRE-05: No fuse specified for 12V pump lines — recommended"],
    "violations": []
  },
  "notes": "Any design-level notes the builder should know"
}

verdict meanings:
  PASS = all mandatory rules met
  WARN = mandatory rules met, best-practice items noted
  FAIL = one or more mandatory rules violated — list each in violations[]`;

// ---- Compliance audit: sent WITH a generated parts list to run a second-pass check.
const PARTS_AUDIT_PROMPT=`You are a senior electronics engineer auditing a parts list produced by another engineer.
Your job is to find every rule violation and best-practice issue.

Apply these checks systematically:

POWER CHECKS
  □ Every load has a matching power source
  □ No GPIO pin drives a load >5 V directly
  □ Total GPIO current draw calculated and within spec
  □ Every inductive load has a flyback diode (or module confirmed to include one)
  □ Multiple voltage rails each have a regulator

SWITCHING CHECKS
  □ Count of independent loads matches count of independent control channels
  □ Relay coil voltages match GPIO drive voltage
  □ Relay contact ratings exceed load by ≥25 %
  □ MOSFETs for 3.3 V GPIO are logic-level type
  □ AC loads use AC-rated switching components

MOTOR/ACTUATOR CHECKS
  □ Every motor has a driver (not direct GPIO)
  □ Every stepper has a stepper driver
  □ Servo power budget does not exceed onboard regulator
  □ Driver current rating exceeds motor stall current

LED CHECKS
  □ Every discrete LED has its own resistor
  □ Resistor values correct for supply voltage and LED Vf
  □ RGB LEDs have 3 resistors each
  □ NeoPixel strips have data resistor and bulk capacitor

COMMUNICATION CHECKS
  □ I2C pull-ups present (unless confirmed on-module for every device)
  □ No I2C address conflicts without a multiplexer
  □ Logic level shifters present for every 5V↔3.3V signal crossing
  □ Each SPI device has its own CS line

SENSOR CHECKS
  □ No analog sensors on digital-only microcontrollers without an ADC
  □ Open-collector outputs have pull-up resistors
  □ Sensor output voltages within microcontroller input rating

WIRING CHECKS
  □ Wire colours match convention
  □ Wire gauges appropriate for current
  □ Star ground topology for mixed high/low current circuits
  □ Every connection has defined source and destination
  □ Fusing present for loads >1 A (or flagged as warning)

Return JSON:
{
  "verdict": "PASS | WARN | FAIL",
  "violations": [
    { "rule": "SW-01", "detail": "Single relay used for two independent pumps" }
  ],
  "warnings": [
    { "rule": "WIRE-05", "detail": "No fuse on 12V pump line — recommended at 3A" }
  ],
  "corrections": [
    "Replace 1-channel relay with a 2-channel relay module",
    "Add 1N4007 flyback diode across each relay coil"
  ]
}`;

// ---- Missing parts: the user's AI is asked (with their permission) for a part's typical size and pins, from its own knowledge.
const LOOKUP_PROMPT=`You are an electronics parts expert. From your own knowledge (you cannot browse the internet here), give the typical physical data of the hobby electronics module named below, as usually sold on a small breakout board.
Measure in millimetres from the bottom-left corner of the board seen from above. width_mm is along x, height_mm along y, depth_mm is the height of the tallest thing on top of the board.
Pin roles: "power" (put 3.3V or 5V in "voltage"), "ground", "i2c_sda", "i2c_scl", "signal" (a pin the code must use), "unused" (pins a beginner leaves unconnected, e.g. an MPU-6050's XDA, XCL, AD0 and INT).
port_cutouts are sockets the box needs an opening for (USB, jacks): "edge" is left, right, top or bottom, offset_mm is the centre of the opening along that edge.
If you are not sure, give your best typical values with "approximate": true. Never invent a part: if you don't know it at all, return {"unknown": true, "notes": "<why>"}.
Return ONLY a JSON object, e.g.:
{"name":"MPU-6050 GY-521 accelerometer and gyroscope","category":"sensor","width_mm":21.2,"height_mm":16.4,"depth_mm":3.3,"pins":[{"name":"VCC","x_mm":2.5,"y_mm":1.3,"role":"power"},{"name":"GND","x_mm":5.0,"y_mm":1.3,"role":"ground"},{"name":"SCL","x_mm":7.6,"y_mm":1.3,"role":"i2c_scl"},{"name":"SDA","x_mm":10.1,"y_mm":1.3,"role":"i2c_sda"},{"name":"XDA","x_mm":12.7,"y_mm":1.3,"role":"unused"},{"name":"XCL","x_mm":15.2,"y_mm":1.3,"role":"unused"},{"name":"AD0","x_mm":17.8,"y_mm":1.3,"role":"unused"},{"name":"INT","x_mm":20.3,"y_mm":1.3,"role":"unused"}],"mounting_holes":[{"x_mm":2.5,"y_mm":13.9,"diameter_mm":3},{"x_mm":18.7,"y_mm":13.9,"diameter_mm":3}],"port_cutouts":[],"voltage":"3.3-5V","protocol":"I2C","i2c_address":"0x68","approximate":true,"source":"AI training knowledge","notes":"<anything a beginner should check>"}`;
const ROLE_TXT={gnd:'ground','3v3':'3.3 V power','5v':'5 V power',vcc:'power (check its voltage)',vin:'power in',sda:'I2C data',scl:'I2C clock',sig:'signal',trig:'trigger',echo:'echo',nc:'not connected'};
function lookupToPart(d,q){
  const s=(v,n)=>String(v==null?'':v).slice(0,n||200),f=(v,lo,hi,df)=>{v=parseFloat(v);return isFinite(v)?Math.min(hi,Math.max(lo,v)):df;};
  const w=f(d.width_mm,1,300,20),dd=f(d.height_mm,1,300,20),h=f(d.depth_mm,0,100,4),r2=v=>+v.toFixed(2);
  const role=(r,n)=>{r=s(r).toLowerCase();n=s(n).toLowerCase();
    if(/ground/.test(r)||/^gnd/.test(n))return 'gnd';if(/sda/.test(r))return 'sda';if(/scl/.test(r))return 'scl';
    if(/power|vcc|vin/.test(r)){const v=s(d.voltage).trim().toLowerCase();return /^vin/.test(n)?'vin':/\b5 ?v\b/.test(n)?'5v':/3\.?3|3v3/.test(n)?'3v3':/^3\.3 ?v?$/.test(v)?'3v3':/^5 ?v?$/.test(v)?'5v':'vcc';}
    if(/unused|^nc$|none|not ?conn/.test(r))return 'nc';
    if(/trig/.test(n))return 'trig';if(/echo/.test(n))return 'echo';
    return 'sig';};
  const pins=(Array.isArray(d.pins)?d.pins:[]).filter(p=>p&&typeof p==='object').slice(0,40).map(p=>({n:s(p.name||'?',16),r:role(p.role,p.name),x:r2(f(p.x_mm,0,w,0)),y:r2(f(p.y_mm,0,dd,0))}));
  const features=(Array.isArray(d.mounting_holes)?d.mounting_holes:[]).filter(o=>o&&typeof o==='object').slice(0,8).map(o=>({t:'hole',x:r2(f(o.x_mm,0,w,2)),y:r2(f(o.y_mm,0,dd,2)),dia:r2(f(o.diameter_mm,1,6,3))}));
  const SIDE={left:'xmin',right:'xmax',bottom:'ymin',top:'ymax'};
  for(const o of (Array.isArray(d.port_cutouts)?d.port_cutouts:[]).filter(o=>o&&typeof o==='object').slice(0,6)){
    const side=SIDE[s(o.edge).toLowerCase()]||'xmin',len=/^x/.test(side)?dd:w,ph=f(o.height_mm,1,30,4);
    features.push({t:'port',kind:s(o.name||'Port',30),side,u:r2(f(o.offset_mm,0,len,len/2)),zc:r2(ph/2),pw:r2(f(o.width_mm,1,80,10)),ph:r2(ph)});
  }
  const cat=s(d.category)+' '+s(d.name),type=/display|screen|oled|lcd/i.test(cat)?'display':/sensor/i.test(cat)?'sensor':/micro|controller|dev ?board/i.test(cat)?'board':/switch/i.test(cat)?'switch':'other';
  const info=[d.voltage&&'Voltage: '+s(d.voltage,40),d.protocol&&'Protocol: '+s(d.protocol,40),d.i2c_address&&'I2C address: '+s(d.i2c_address,20)].filter(Boolean).join('. ');
  return tidyPart({id:newPartId(),name:s(d.name||q,80),type,shape:'rect',w,d:dd,pcb:1.6,h,below:2.5,mount:'floor',pins,features,
    approximate:true,source:'AI lookup',acc:'approx',voltage:s(d.voltage,40),protocol:s(d.protocol,40),i2c_address:s(d.i2c_address,20),
    notes:'Looked up by AI from its own knowledge ("'+s(q,60)+'"), not measured: sizes and pin positions are approximate, so measure yours before printing.'+(info?' '+info+'.':'')+(d.notes?' '+s(d.notes,400):'')});
}
// ════════════════════════════════════════════════════════════════════════════
// PARTS DATABASE  — persistent JSON file (parts-database.json alongside app)
// Every part AI looks up or user adds is stored here with pinout + dimensions.
// Parts with unverified dimensions block enclosure generation until confirmed.
// ════════════════════════════════════════════════════════════════════════════

let _partsDb = null;          // loaded object from parts-database.json
let _partsDbDirty = false;    // unsaved changes

// --- Load / Save ---------------------------------------------------------

async function loadPartsDb() {
  if (_partsDb) return _partsDb;
  // Desktop app: use wfNative file I/O; browser/PWA: fetch relative path
  try {
    if (window.wfNative && window.wfNative.readFile) {
      const raw = await window.wfNative.readFile('parts-database.json');
      _partsDb = JSON.parse(raw);
    } else {
      const r = await fetch('parts-database.json');
      if (r.ok) _partsDb = await r.json();
    }
  } catch(e) { /* file doesn't exist yet — that's fine */ }
  if (!_partsDb || typeof _partsDb.parts !== 'object') {
    _partsDb = { _schema:'EvenUCan Parts Database v1.0', version:'1.0',
      created: new Date().toISOString().slice(0,10),
      last_updated: new Date().toISOString().slice(0,10), parts:{} };
  }
  return _partsDb;
}

async function savePartsDb() {
  if (!_partsDb) return false;
  _partsDb.last_updated = new Date().toISOString().slice(0,10);
  const json = JSON.stringify(_partsDb, null, 2);
  try {
    if (window.wfNative && window.wfNative.writeFile) {
      await window.wfNative.writeFile('parts-database.json', json);
    } else if (window.showSaveFilePicker) {
      // PWA fallback: download the file
      const a = document.createElement('a');
      a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
      a.download = 'parts-database.json'; a.click();
    } else { return false; }
    _partsDbDirty = false; return true;
  } catch(e) { console.warn('savePartsDb:', e); return false; }
}

// --- Lookup & Store ------------------------------------------------------

async function getPartFromDb(name) {
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
}

function storePartInDb(partObj) {
  if (!_partsDb) return;
  const id = (partObj.id || partObj.name || 'part_' + Date.now())
    .toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 60);
  _partsDb.parts[id] = { ...partObj, id,
    stored_date: new Date().toISOString().slice(0,10) };
  _partsDbDirty = true;
  savePartsDb();
}

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

async function verifyPartWithAI(partName) {
  if (!partName) return null;
  // Check DB cache first
  const cached = await getPartFromDb(partName);
  if (cached) return cached;
  if (!aiKey()) { await askKey(); if (!aiKey()) return null; }
  WF.flash('Verifying "' + partName + '" with AI…', 10000);
  try {
    const { data: d } = await callAI(PART_VERIFY_PROMPT + '\n\nThe part to verify: "' + partName + '"');
    if (!d || typeof d !== 'object') throw new Error('no data returned');
    if (d.unknown) {
      WF.flash('AI doesn\'t recognise "' + partName + '" — add it manually in Parts Library.', 7000);
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
    WF.flash('Part verification failed: ' + (e.message || e), 6000);
    return null;
  }
}

// --- Dimension gate for enclosure generation ----------------------------
// Returns { ok:true } or { ok:false, unverified:['Part A','Part B'] }

async function checkEnclosureDimensions(partNames) {
  const db = await loadPartsDb();
  const unverified = [], estimated = [];
  for (const name of (partNames || [])) {
    const p = await getPartFromDb(name);
    if (!p) { unverified.push(name + ' (not in database)'); continue; }
    if (p.dimension_status === 'UNVERIFIED') unverified.push(name);
    else if (p.dimension_status === 'ESTIMATED') estimated.push(name);
  }
  return { ok: unverified.length === 0, unverified, estimated };
}

// --- Parts Library Panel -----------------------------------------------
// Rendered as a side panel / modal; lets user browse, search, edit, add parts.

function renderPartsLibraryPanel() {
  const db = _partsDb;
  const parts = db ? Object.values(db.parts) : [];
  const cats = [...new Set(parts.map(p => p.category || 'other'))].sort();

  const statusBadge = s => {
    if (s === 'VERIFIED')   return '<span class="plBadgeOk">✓ Verified</span>';
    if (s === 'ESTIMATED')  return '<span class="plBadgeWarn">⚠ Estimated</span>';
    return '<span class="plBadgeFail">⚠ Unverified — measure!</span>';
  };

  const catOptions = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  let rows = '';
  for (const p of parts.sort((a,b)=>(a.name||'').localeCompare(b.name||''))) {
    const dim = p.dimensions || {};
    const dimStr = dim.length_mm
      ? `${dim.length_mm}×${dim.width_mm}×${dim.height_mm} mm`
      : '—';
    rows += `<tr data-pid="${esc(p.id)}" data-cat="${esc(p.category||'')}" class="plRow">
      <td>${esc(p.name||p.id)}</td>
      <td>${esc(p.category||'')}</td>
      <td>${dimStr}</td>
      <td>${statusBadge(p.dimension_status)}</td>
      <td style="white-space:nowrap">
        <button class="sec plEdit" data-pid="${esc(p.id)}">Edit</button>
        <button class="sec plDelete" data-pid="${esc(p.id)}" title="Delete part" style="color:var(--danger,#c0392b);margin-left:4px">🗑</button>
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
}

function renderPartEditForm(partId) {
  const p = _partsDb && _partsDb.parts[partId];
  if (!p) return '';
  const dim = p.dimensions || {};
  return `<div class="plEditForm">
    <b>Edit: ${esc(p.name||partId)}</b>
    <div class="ewNote" style="margin:4px 0 10px">${p.dimension_status==='UNVERIFIED'
      ? '<span style="color:var(--warn)">⚠ Dimensions unverified — measure the physical part and enter below.</span>'
      : p.dimension_status==='ESTIMATED'
        ? '<span style="color:var(--warn)">⚠ Dimensions estimated — confirm with physical measurement.</span>'
        : '<span style="color:var(--ok)">✓ Dimensions verified.</span>'}</div>
    <label>Name <input id="plEName" value="${esc(p.name||'')}"></label>
    <label>Category <input id="plECat" value="${esc(p.category||'')}"></label>
    <div class="plDimRow">
      <label>Length (mm) <input id="plELen" type="number" step="0.1" value="${dim.length_mm||''}"></label>
      <label>Width (mm)  <input id="plEWid" type="number" step="0.1" value="${dim.width_mm||''}"></label>
      <label>Height (mm) <input id="plEHt"  type="number" step="0.1" value="${dim.height_mm||''}"></label>
    </div>
    <label>Notes <textarea id="plENotes" rows="2">${esc(p.notes||p.dimension_warning||'')}</textarea></label>
    <div class="ewRow">
      <button class="primary" id="plESave" data-pid="${esc(partId)}">Save & Confirm dimensions</button>
      <button class="sec" id="plECancel">Cancel</button>
    </div>
  </div>`;
}

function bindPartsLibrary() {
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
          WF.flash(`"${partName}" deleted`, 3000);
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
        WF.flash('Part saved ✓', 3000);
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
}

function bindPartEditForm() { /* buttons bound via event delegation in bindPartsLibrary */ }

function showAddPartForm() {
  WF.flash('Enter the part name in the search box above and use "AI Parts Search" to look it up — it will be stored automatically.', 7000);
}

async function migrateCustomToDb() {
  if (!_partsDb) return;
  if (Object.keys(_partsDb.parts).length > 0) return; // Only migrate into an empty DB
  if (typeof custom === 'undefined' || !Array.isArray(custom) || custom.length === 0) return;
  const accMap = { drawing: 'VERIFIED', measured: 'VERIFIED', approx: 'ESTIMATED' };
  let count = 0;
  for (const c of custom) {
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
  WF.flash(`✓ ${count} part${count === 1 ? '' : 's'} imported from your Parts Library into the database`, 6000);
}

async function openPartsLibrary() {
  await loadPartsDb();
  await migrateCustomToDb();
  const existing = document.getElementById('partsLibPanel');
  if (existing) { existing.remove(); return; }
  const wrap = document.createElement('div');
  wrap.innerHTML = renderPartsLibraryPanel();
  document.body.appendChild(wrap.firstChild);
  bindPartsLibrary();
}

