// EvenUCan AI helpers and Surgery - 03-intent-wizard.js
// One of the files in js/ai/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- Project Intent Wizard (r2): intentWizard
// "💡 What do I want to build?": the user says in plain words what the gadget should do. Their AI picks the kinds
// of parts (JSON); each is found among the built-in parts, the user's own parts, a few common modules and then the
// parts library. Anything the code needs (an API key, a town…) is asked for, then the Enclosure Wizard is filled in,
// the wiring worked out and the ESPHome file written (esphomeYaml, with weatherYaml for weather projects, and the
// idea passed on to "Make it with AI").
const INTENT_KEYAi='intent';// {desc, analysis, inputKeys}; each answer in 'intent_inputs.<key>' (saved in project files)
const intentNowAi=()=>{const raw=WFAi.store.get(INTENT_KEYAi);if(!raw)return null;try{const v=JSON.parse(raw);return v&&typeof v==='object'?v:null;}catch(e){console.error('EvenUCan: the saved project idea could not be read',e);return null;}};
const intentInputsAi=function intentInputsAi(it){const o={};for(const k of (it&&Array.isArray(it.inputKeys)?it.inputKeys:[])){const v=WFAi.store.get('intent_inputs.'+k);if(v!=null)o[k]=v;}return o;};
const SECRETISH=/key|token|password|secret/i;
// The user's answers as ESPHome substitutions (used as ${name} in the file), or '' when there are none.
const intentSubsAi=function intentSubsAi(){
  const it=intentNowAi();if(!it)return '';
  const v=intentInputsAi(it),rows=[];
  for(const k in v){
    if(!/^[a-z_][a-z0-9_]*$/.test(k)||k==='notify_time')continue;
    let val=String(v[k]).trim();
    if(k==='location')val=encodeURIComponent(val).replace(/%2C/gi,',');// goes into a web address
    if(k==='owm_api_key'&&!val)val='PASTE_YOUR_OPENWEATHERMAP_KEY_HERE';
    rows.push(`  ${k}: ${yqAi(val)}`);
  }
  return rows.length?'# Your own settings, from "What do I want to build?" in EvenUCan. Change them here if you need to.\nsubstitutions:\n'+rows.join('\n'):'';
};
// A weather project: the idea asked for an OpenWeatherMap key. Returns its settings, or null.
const intentWeatherAi=function intentWeatherAi(){
  const it=intentNowAi();if(!it)return null;
  const v=intentInputsAi(it);if(!('owm_api_key' in v))return null;
  return {key:String(v.owm_api_key||'').trim(),loc:String(v.location||'').trim(),topic:String(v.ntfy_topic||'').trim(),time:String(v.notify_time||'07:30').trim()};
};
// The ready-made weather block: fetch the forecast, keep it in globals, show it on the OLED (scrolling), and send a
// daily summary to the phone by ntfy.sh. Works without the AI.
const weatherYaml=function weatherYaml(wx,oled,meas){
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
};
// What "Make it with AI" is told about the idea (empty when the device wasn't planned from one).
const intentAINoteAi=function intentAINoteAi(){
  const it=intentNowAi();if(!it||!it.desc)return '';
  const A=it.analysis||{},v=intentInputsAi(it);
  const set=Object.keys(v).map(k=>k+(SECRETISH.test(k)?' (private, already filled in: refer to it only as ${'+k+'})':' = '+JSON.stringify(v[k]))).join(', ')||'none';
  return 'This device was planned from the user\'s project idea. For this device the "no new secrets" rule is relaxed: the substitutions at the top of the file hold the user\'s own settings ('+set+'); use them as ${name}. '+
    'http_request, JSON parsing in lambdas (json::parse_json), globals, script, time (sntp), font and display sections are allowed. Messages to the user\'s phone are sent by an HTTP POST to https://ntfy.sh/${ntfy_topic} with the message as the body (notification method: '+(A.notification_method||'ntfy')+'). Keep any weather, display and ntfy sections already in the file working.\n'+
    (typeof briefDoctorCodeNote==='function'?briefDoctorCodeNote(it.desc,A,it.platform||'esphome',it.power||'usb'):'')+'The idea, in the user\'s words: """'+it.desc+'"""\nPlan for the file: '+(A.esphome_yaml_hint||'(none)')+'\nNotes: '+(A.esphome_notes||'(none)')+'\n\n';
};
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
- RULE 1-TOLD – NATURAL SPEECH ("SEE" / "CHECK" / "WATCH" = KNOW, NOT A SCREEN). In everyday English, when a user says "see how many times", "see if", "see when", "see whether", "check", "watch", "keep an eye on", "find out", "be told", "notified", "warned", "sent a report", or "to know" something, that means knowing via their phone message or alert — NOT a physical screen! Do NOT add a display, screen, OLED or LCD unless they explicitly say "screen", "display", "OLED", "LCD", "readout", or "show it on the box/device". Never invent a screen the user did not ask for.
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
const callAI=async function callAI(text){return aiProvAi()==='claude'?await claudeAi([{type:'text',text}],false):isOAAi()?await oaAIAi(aiProvAi(),text):await geminiAi([{text}],false);};
window.callAI=callAI;window.aiProv=aiProvAi;window.aiKey=aiKeyAi;window.aiRead=aiReadAi;window.gemini=geminiAi;window.claude=claudeAi;window.oaAI=oaAIAi;window.isOA=isOAAi;window.PROVIDERS=PROVIDERSAi;window.OA=OAAi;window.getVisionFailoverList=getVisionFailoverListAi;
// The parts shown for a platform: its own board first; a Wi-Fi part is built in (ESP32, Pi) or removed (Arduino Nano).
// Inputs that need the internet don't apply on the Arduino Nano (no Wi-Fi); the AI can also tie an input to one platform.
const NET_KEYS=/^(owm_api_key|location|ntfy_topic|notify_time)$/;
const inputShown=(x,pf)=>(!x.only||x.only===pf)&&!(pf==='arduino'&&NET_KEYS.test(x.key));
const IW_BADGE='<span style="background:#fff3c4;color:#7a5a00;border:1px solid #e0c060;border-radius:10px;padding:0 7px;font-size:12px;white-space:nowrap">⚠ Not found in library</span>';
// Example ideas under the description box (they only fill it in; nothing is sent until "Figure it out for me").
const EXAMPLES={
  '🐕 Dog flap counter':'i want a way to see how many times my dog goes through his backdoor dog flap ina day it can send me a message at the end of the day with a count',
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
const askConfirmAi=function askConfirmAi(msg){
  return askHtmlAi(escAi(msg).replace(/\n/g,'<br>'),['Cancel','OK'],1).then(i=>i===1);
};
const askHtmlAi=function askHtmlAi(html,buttons,ok){
  return new Promise(done=>{
    const back=document.createElement('div');back.id='askBack';back.setAttribute('role','dialog');back.setAttribute('aria-modal','true');
    back.innerHTML='<div id="askBox" class="keyBox"><div class="msg" style="white-space:normal"></div><div class="btns"></div></div>';
    back.querySelector('.msg').innerHTML=html;
    const row=back.querySelector('.btns'),fin=i=>{back.remove();done(i);};
    buttons.forEach((b,i)=>{const el=document.createElement('button');el.textContent=b;if(i===ok)el.dataset.ok='1';el.onclick=()=>fin(i);row.appendChild(el);});
    back.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')fin(-1);});
    document.body.appendChild(back);(row.children[ok]||row.firstChild).focus();
  });
};
