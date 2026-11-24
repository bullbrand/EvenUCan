// EvenUCan Enclosure Wizard - 13-code-esphome-yaml.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- ESPHome device file: a complete YAML for the controller, from the wiring plan and a few answers.
// Each part gets the ESPHome section that matches its pin roles; the purpose decides what it does.
const ESPH_KEY='esphome.form';
const ESPH_AI_KEY='esphome.ai';// persists the AI-written YAML across re-renders / page reloads
// A short fingerprint for a set of unknown parts: sorted "label:pin,pin" strings joined.
// If the fingerprint matches what was stored, the AI result is still valid.
const esphAiSig=unknown=>unknown.map(u=>u.label+':'+u.pins.map(p=>p.gpio).sort().join(',')).sort().join('|');
const ESPH_DEFAULT={name:'',purpose:'sensor',copies:false,ha:true,every:30,alarm:30,lowbat:3.5,button:'report',wake:'okay_nabu',status:true,
  ruleOn:false,ruleSrc:'',ruleOp:'above',ruleVal:30,ruleA:'red',ruleB:'green',desc:''};
const esphForm=()=>{try{return Object.assign({},ESPH_DEFAULT,JSON.parse(WF.store.get(ESPH_KEY)||'{}'));}catch(e){return {...ESPH_DEFAULT};}};
const ESPH_PURPOSES={sensor:'Sensor node (reports its readings)',voice:'Voice assistant (wake word, talks to Home Assistant)'};
const RULE_COLOURS={red:[100,0,0],green:[0,100,0],blue:[0,30,100],yellow:[100,80,0],white:[100,100,100],off:null};
const WAKE_WORDS={okay_nabu:'Okay Nabu',hey_jarvis:'Hey Jarvis',hey_mycroft:'Hey Mycroft',alexa:'Alexa'};
// Which ESPHome board a controller part is, or null if it can't run ESPHome.
const espBoard=function espBoard(part){
  const t=(part.name+' '+(part.notes||'')).toLowerCase(),mcu=part.mcu||(builtinById(part.id)||{}).mcu;
  // Seeed XIAO boards have their own ESPHome board names. Judged by the part's NAME only (the notes may mention other chips).
  // No status-light pin: the XIAO's own LED is a plain one on a different pin, not the RGB one the DevKitC-1 has.
  const nm=String(part.name||'').toLowerCase();
  if(/xiao/.test(nm)){
    if(/esp32-?s3/.test(nm))return {chip:'esp32',board:'seeed_xiao_esp32s3',s3:true};
    if(/esp32-?c3/.test(nm))return {chip:'esp32',board:'seeed_xiao_esp32c3'};
    if(/esp32-?c6/.test(nm))return {chip:'esp32',board:'seeed_xiao_esp32c6'};
  }
  if(mcu==='esp32s3'||/esp32-?s3/.test(t)){
    // Only include flash_size / psram when the variant name explicitly names them —
    // adding them for a generic board confuses novices (wrong for most boards they own).
    const flash=/n16/.test(t)?'16MB':/n4\b|n4r/.test(t)?'4MB':null;
    const psram=/r8|n16r8|n8r8/.test(t)?'octal':/r2\b|n8r2|n4r2/.test(t)?'quad':null;
    return {chip:'esp32',board:'esp32-s3-devkitc-1',flash,psram,s3:true,led:38};
  }
  if(/esp32-?c3/.test(t))return {chip:'esp32',board:'esp32-c3-devkitm-1'};
  if(/esp32/.test(t))return {chip:'esp32',board:'esp32dev'};
  if(/esp8266|nodemcu|wemos|d1 ?mini/.test(t))return {chip:'esp8266',board:/d1 ?mini|wemos/.test(t)?'d1_mini':'nodemcuv2'};
  return null;
};
const esphSlug=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,31)||'my-device';
const yq=s=>'"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
// What kind of thing a plain signal pin drives, guessed from the part's name.
const sigKind=function sigKind(inst,role){
  const t=(inst.part.name+' '+(inst.part.type||'')).toLowerCase();
  if(/dht ?11|dht ?2[12]|am230[12]|\bdht\b/.test(t))return 'dht';
  if(/ds18b20|dallas|one.?wire temp/.test(t))return 'ds18b20';
  if(/ws281|neopixel|sk6812|addressable/.test(t))return 'pixel';
  if(/mc-?38|reed|door.?sensor|contact.?switch|limit.?switch|flap/.test(t))return 'reed';
  if(/servo|sg90|mg90|mg99/.test(t))return 'servo';
  if(role==='ao'||/soil|moist|ldr|photoresistor|potentiometer/.test(t))return 'adc';
  if(/water (leak|level)|leak sensor|rain|mq-?\d|gas|smoke|air quality|flow sensor|yf-?s201/.test(t))return role==='ao'?'adc':'alert_in';
  if(/\bpir\b|hc-?sr50|am312|rcwl|motion/.test(t))return 'motion';
  if(/ttp22|touch/.test(t))return 'touch';
  if(/button|push|tact|key\b/.test(t))return 'button';
  if(/relay|l298|uln2003|mosfet/.test(t))return 'relay';
  if(/buzzer|beeper|siren/.test(t))return 'buzzer';
  if(/\bled\b|light/.test(t))return 'led';
  return null;
};
const esphomeYaml=function esphomeYaml(P,f){
  const brd=espBoard(P.ctrl.part);
  if(!brd)return {error:P.ctrl.label+' can\'t run ESPHome: ESPHome needs an ESP32 or ESP8266 board as the controller.'};
  const g=a=>{const c=a.c||a;if(c.g!==undefined)return (brd.chip==='esp8266'&&c.g===17)?'A0':'GPIO'+c.g;return /^\d+$/.test(c.n)?'GPIO'+c.n:c.n;};
  const by=role=>P.assigned.filter(a=>a.role===role),one=role=>by(role)[0];
  const mic=one('mic_sd'),amp=one('amp_din'),trigs=by('trig'),sda=one('sda'),scl=one('scl'),wx=intentWeather();
  const voice=f.purpose==='voice';
  if(voice&&brd.chip==='esp8266')return {error:P.ctrl.label+' cannot run a voice assistant (it needs an ESP32-S3). Choose another kind of project, or switch the board.'};
  if(voice&&!(mic&&amp))return {error:'A voice assistant needs an I2S microphone (such as the INMP441) and an I2S amplifier with a speaker (such as the MAX98357A) among your parts. Add them in the Enclosure Wizard, or choose Sensor node.'};
  const ha=voice||f.ha,name=(f.name||'').trim()||'My Device',slug=esphSlug(name),every=Math.max(1,Math.round(+f.every||30))+'s';
  const statusLed=f.status&&brd.led!==undefined&&!P.assigned.some(a=>a.c&&a.c.g===brd.led);
  const sigs=P.assigned.filter(a=>['sig','do','ao'].includes(a.role)).map(a=>({a,kind:sigKind(a.inst,a.role)}));
  const buttons=sigs.filter(s=>s.kind==='button'||s.kind==='touch'),leds=sigs.filter(s=>s.kind==='led'||s.kind==='pixel');
  const lightId=statusLed?'status_led':leds.length?'led_1':null;
  const L=[],sec=s=>L.push(s),warn=[];
  // parts this file can't write by itself: the AI writes them ("Make it with AI"), from their name, part-file details and pins
  const unknown=new Map(),unk=(inst,a,role)=>{if(!unknown.has(inst))unknown.set(inst,[]);unknown.get(inst).push({n:a.pin?a.pin.n:role,d:a.pin&&a.pin.d||'',role:a.role||role,gpio:g(a)});};
  sec(`# ESPHome device file for "${name}", written by EvenUCan.\n# Pins come from the EvenUCan wiring: wire the parts exactly as its wiring list says.\n# To flash it: "Send to ESPHome" in EvenUCan (or paste it into a new device in ESPHome Device Builder),\n# then plug the board in by USB and click Install.`);
  const subs=intentSubs();if(subs)sec(subs);// (r2) the user's own settings from "What do I want to build?"
  let eh=`esphome:\n  name: ${slug}\n  friendly_name: ${yq(name)}`;
  if(f.copies)eh+=`\n  name_add_mac_suffix: true`;// several boards from one file: each gets its own name (e.g. ${slug}-a1b2c3) so Home Assistant never sees duplicates
  if(voice)eh+=`\n  on_boot:\n    priority: -100\n    then:\n      - wait_until: api.connected\n      - micro_wake_word.start`;
  sec(eh);
  if(brd.chip==='esp32'){
    sec(`esp32:\n  board: ${brd.board}`+(brd.flash?`\n  flash_size: ${brd.flash}`:'')+`\n  framework:\n    type: esp-idf`);
    if(brd.psram)sec(`psram:\n  mode: ${brd.psram}\n  speed: 80MHz`);
  }else sec(`esp8266:\n  board: ${brd.board}`);
  sec(brd.board==='esp32-c3-devkitm-1'?'logger:\n  hardware_uart: USB_SERIAL_JTAG':'logger:');
  if(ha)sec('# Home Assistant finds this device by itself once it is on your Wi-Fi.\napi:');
  else sec('# Standalone: open http://'+slug+'.local in a web browser to see its readings.\nweb_server:\n  port: 80');
  sec('ota:\n  - platform: esphome');
  sec(`# Your Wi-Fi name and password come from ESPHome's secrets (the Secrets button in ESPHome Device Builder).\nwifi:\n  ssid: !secret wifi_ssid\n  password: !secret wifi_password\n  ap:\n    ssid: ${yq((name+' Fallback').slice(0,32))}`);
  sec('captive_portal:');
  // ---- audio
  if(voice){
    sec(`i2s_audio:\n  - id: i2s_mic\n    i2s_lrclk_pin: ${g(one('mic_ws'))}\n    i2s_bclk_pin: ${g(one('mic_sck'))}\n  - id: i2s_amp\n    i2s_lrclk_pin: ${g(one('amp_lrc'))}\n    i2s_bclk_pin: ${g(one('amp_bclk'))}`);
    sec(`microphone:\n  - platform: i2s_audio\n    id: mic\n    i2s_audio_id: i2s_mic\n    i2s_din_pin: ${g(mic)}\n    adc_type: external\n    channel: left\n    bits_per_sample: 32bit`);
    sec(`speaker:\n  - platform: i2s_audio\n    id: spk\n    i2s_audio_id: i2s_amp\n    i2s_dout_pin: ${g(amp)}\n    dac_type: external\n    channel: mono`);
    sec(`micro_wake_word:\n  microphone: mic\n  models:\n    - model: ${f.wake in WAKE_WORDS?f.wake:'okay_nabu'}\n  on_wake_word_detected:\n    - voice_assistant.start:\n        wake_word: !lambda return wake_word;`);
    let va=`voice_assistant:\n  microphone: mic\n  speaker: spk\n  noise_suppression_level: 2\n  auto_gain: 31dBFS\n  volume_multiplier: 2.0`;
    if(lightId)va+=`\n  on_listening:\n    - light.turn_on:\n        id: ${lightId}`+(lightId==='status_led'?`\n        red: 0.0\n        green: 0.3\n        blue: 1.0`:'')+`\n  on_tts_start:\n    - light.turn_on:\n        id: ${lightId}`+(lightId==='status_led'?`\n        red: 0.0\n        green: 1.0\n        blue: 0.3`:'');
    va+=`\n  on_end:`+(lightId?`\n    - light.turn_off: ${lightId}`:'')+`\n    - wait_until:\n        not:\n          voice_assistant.is_running:\n    - micro_wake_word.start`;
    sec(va);
  }else if(mic||amp)sec('# The microphone and amplifier are wired, but a sensor node doesn\'t use them.\n# Choose "Voice assistant" in EvenUCan to use them.');
  // ---- sensors
  const sensors=[],bins=[],meas=[];// meas: readings a rule can use {id,label,unit,scale}
  const tempHum=(k,tName,hName)=>{const s=k>1?'_'+k:'';meas.push({id:'temperature'+s,label:tName,unit:'°C'});if(hName)meas.push({id:'humidity'+s,label:hName,unit:'%'});
    return `    temperature:\n      id: temperature${s}\n      name: ${yq(tName)}`+(hName?`\n    humidity:\n      id: humidity${s}\n      name: ${yq(hName)}`:'');};
  let thN=0,adcN=0,servoN=0,reedCounterAdded=false;
  const servos=[],globalsSec=[],timeSec=[];
  const ideaTxt=((intentNow()||{}).desc||f.desc||'').toLowerCase();
  const isPassCounter=/how many|\bcount\b|times a day|end of the day|flap/.test(ideaTxt);
  trigs.forEach((t,k)=>{const e=P.assigned.find(a=>a.inst===t.inst&&a.role==='echo');if(!e)return;
    meas.push({id:'distance_'+(k+1),label:'Distance'+(trigs.length>1?' '+(k+1):''),unit:'cm',scale:0.01});
    sensors.push(`  - platform: ultrasonic\n    id: distance_${k+1}\n    name: ${yq('Distance'+(trigs.length>1?' '+(k+1):''))}\n    trigger_pin: ${g(t)}\n    echo_pin: ${g(e)}\n    update_interval: ${!voice&&+f.alarm>0?'1s':every}`);// an alarm needs quick readings
    if(!voice&&+f.alarm>0){
      let b=`  - platform: template\n    name: ${yq('Something close'+(trigs.length>1?' '+(k+1):''))}\n    device_class: occupancy\n    lambda: |-\n      return id(distance_${k+1}).state < ${(+f.alarm/100).toFixed(3)};`;
      if(lightId)b+=`\n    on_press:\n      - light.turn_on:\n          id: ${lightId}`+(lightId==='status_led'?`\n          red: 1.0\n          green: 0.0\n          blue: 0.0`:'')+`\n    on_release:\n      - light.turn_off: ${lightId}`;
      bins.push(b);
    }
  });
  if(P.batSense){
    meas.push({id:'battery_voltage',label:'Battery voltage',unit:'V'});
    sensors.push(`  - platform: adc\n    id: battery_voltage\n    name: "Battery voltage"\n    pin: ${g(P.batSense)}\n${brd.chip==='esp8266'?'':'\n    attenuation: 12db'}\n    update_interval: ${every}\n    filters:\n      - multiply: 2.0`);
    bins.push(`  - platform: template\n    name: "Battery low"\n    device_class: battery\n    lambda: |-\n      return id(battery_voltage).state < ${(+f.lowbat||3.5).toFixed(2)};`);
  }
  // ---- plain signal parts, by what they look like
  let pixelN=0,ledN=0;const lights=[],outputs=[],switches=[],oneWire=[],displays=[],fonts=[];
  // (wizard-r2) a planned idea that messages the phone: movement sends an ntfy.sh message at once, and sounds the buzzer
  const topic=wx?'':intentTopic(),planned=!!intentNow(),buzz=planned?sigs.find(x=>x.kind==='buzzer'):null;
  let ntfyUsed=false;
  // every switch and binary_sensor gets a stable id, so "Make it with AI" (and anyone editing the
  // file) can refer to it instead of declaring a second, duplicate component for hardware already
  // wired here. One shared registry: ESPHome ids must be unique across the whole file, not just
  // within one platform.
  const compIds=new Set(buzz?['buzzer_1']:[]),compId=nm=>{
    let s=String(nm||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,24)||'part';
    if(/^[0-9]/.test(s))s='c_'+s;// ESPHome ids must start with a letter, not a digit
    let id=s,n=2;
    while(compIds.has(id))id=s+'_'+(n++);
    compIds.add(id);return id;
  };
  for(const {a,kind} of sigs){
    const nm=a.inst.label,pin=g(a);
    if(kind==='dht'){
      const t=a.inst.part.name.toLowerCase(),model=/dht ?11/.test(t)?'DHT11':/dht ?21/.test(t)?'DHT21':/am2302/.test(t)?'AM2302':'DHT22',k=++thN,sfx=k>1?' '+k:'';
      warn.push(nm+': its data wire needs a 10 kΩ pull-up resistor to 3.3 V. Most small DHT modules have one built in; a bare 4-pin sensor doesn\'t.');
      sensors.push(`  - platform: dht\n    model: ${model}\n    pin: ${pin}\n`+tempHum(k,'Temperature'+sfx,'Humidity'+sfx)+`\n    update_interval: ${Math.max(2,Math.round(+f.every||30))}s`);
    }else if(kind==='ds18b20'){
      const k=++thN,s=k>1?'_'+k:'';meas.push({id:'temperature'+s,label:'Temperature'+(k>1?' '+k:''),unit:'°C'});
      oneWire.push(`  - platform: gpio\n    id: one_wire${s}\n    pin: ${pin}`);
      sensors.push(`  - platform: dallas_temp\n    one_wire_id: one_wire${s}\n    id: temperature${s}\n    name: ${yq('Temperature'+(k>1?' '+k:''))}\n    update_interval: ${every}`);
    }else if(kind==='reed'){
      let b=`  - platform: gpio\n    id: ${compId(nm)}\n    name: ${yq(nm)}\n    device_class: door\n    pin:\n      number: ${pin}\n      mode:\n        input: true\n        pullup: true\n    filters:\n      - delayed_on: 50ms\n      - delayed_off: 2s`;
      if(isPassCounter&&!reedCounterAdded){
        reedCounterAdded=true;
        globalsSec.push(`  - id: daily_pass_count\n    type: int\n    restore_value: yes\n    initial_value: '0'`);
        sensors.push(`  - platform: template\n    id: pass_count_sensor\n    name: "Daily Pass Count"\n    unit_of_measurement: "passes"\n    accuracy_decimals: 0\n    update_interval: 5s\n    lambda: |-\n      return id(daily_pass_count);`);
        b+=`\n    on_press:\n      - lambda: |-\n          id(daily_pass_count) += 1;\n      - component.update: pass_count_sensor`;
        if(topic){
          ntfyUsed=true;
          timeSec.push(`# Sends the daily pass count at the end of the day (21:00) and resets the counter at midnight.\ntime:\n  - platform: sntp\n    id: sntp_time\n    on_time:\n      - seconds: 0\n        minutes: 0\n        hours: 21\n        then:\n          - http_request.post:\n              url: "https://ntfy.sh/\${ntfy_topic}"\n              body: !lambda |-\n                return "Daily dog flap count today: " + std::to_string(id(daily_pass_count)) + " passes.";\n          - lambda: |-\n              id(daily_pass_count) = 0;\n          - component.update: pass_count_sensor`);
        }
      }else if(topic){
        ntfyUsed=true;
        b+=`\n    on_press:\n      - http_request.post:\n          url: "https://ntfy.sh/\${ntfy_topic}"\n          body: ${yq('Opened / triggered: '+nm)}`;
      }
      bins.push(b);
    }else if(kind==='servo'){
      const svId='servo_'+(++servoN),outId='pwm_servo_'+servoN;
      outputs.push(`  - platform: ${brd.chip==='esp8266'?'esp8266_pwm':'ledc'}\n    id: ${outId}\n    pin: ${pin}\n    frequency: 50 Hz`);
      servos.push(`  - id: ${svId}\n    output: ${outId}\n    auto_detach_time: 2s`);
    }else if(kind==='adc'){
      const k=++adcN,id=compId(nm+'_level');
      meas.push({id,label:nm,unit:'V'});
      sensors.push(`  - platform: adc\n    id: ${id}\n    name: ${yq(nm)}\n    pin: ${pin}\n${brd.chip==='esp8266'?'':'\n    attenuation: 12db'}\n    update_interval: ${every}`);
    }else if(kind==='alert_in'){
      let b=`  - platform: gpio\n    id: ${compId(nm+'_'+(a.pin?a.pin.n:'in'))}\n    name: ${yq(nm)}\n    pin:\n      number: ${pin}\n      mode:\n        input: true\n        pullup: true`;
      const acts=[];
      if(topic){ntfyUsed=true;acts.push('      - http_request.post:','          url: "https://ntfy.sh/${ntfy_topic}"',`          body: ${yq('Alert from '+nm)}`);}
      if(buzz)acts.push('      - switch.turn_on: buzzer_1','      - delay: 3s','      - switch.turn_off: buzzer_1');
      if(acts.length)b+='\n    on_press:\n'+acts.join('\n');
      bins.push(b);
    }else if(kind==='button'||kind==='touch'){
      let b=`  - platform: gpio\n    id: ${compId(nm)}\n    name: ${yq(nm)}\n    pin:\n      number: ${pin}`+(kind==='button'?`\n      mode:\n        input: true\n        pullup: true\n      inverted: true`:'');
      if(voice&&f.button==='talk')b+=`\n    on_press:\n      - voice_assistant.start:`;
      else if(f.button==='light'&&lightId)b+=`\n    on_press:\n      - light.toggle: ${lightId}`;
      bins.push(b);
    }else if(kind==='motion'){
      let b=`  - platform: gpio\n    id: ${compId(nm)}\n    name: ${yq(nm)}\n    device_class: motion\n    pin: ${pin}`;
      const acts=[];
      if(topic){ntfyUsed=true;acts.push('      # A message to your phone straight away (ntfy.sh: subscribe to ntfy_topic in the free ntfy app)','      - http_request.post:','          url: "https://ntfy.sh/${ntfy_topic}"',`          body: ${yq('Movement detected: '+nm)}`);}
      if(buzz)acts.push('      # Beep: the buzzer sounds for 5 seconds','      - switch.turn_on: buzzer_1','      - delay: 5s','      - switch.turn_off: buzzer_1');
      if(acts.length)b+='\n    on_press:\n'+acts.join('\n');
      bins.push(b);
    }
    else if(kind==='pixel'&&brd.chip==='esp8266'){unk(a.inst,a);}// addressable LEDs: left for the AI step on an ESP8266 (no RMT hardware)
    else if(kind==='pixel'){pixelN++;lights.push(`  - platform: esp32_rmt_led_strip\n    id: led_${++ledN}\n    name: ${yq(nm)}\n    pin: ${pin}\n    num_leds: 1  # change to the number of LEDs on the strip\n    rgb_order: GRB\n    chipset: ws2812`);}
    else if(kind==='led'){outputs.push(`  - platform: gpio\n    id: led_out_${ledN+1}\n    pin: ${pin}`);lights.push(`  - platform: binary\n    id: led_${++ledN}\n    name: ${yq(nm)}\n    output: led_out_${ledN}`);}
    else if(kind==='relay'||kind==='buzzer'){
      const pName=a.pin&&a.pin.n&&!/^(in|sig|i\/o|\+)$/i.test(a.pin.n)?' '+a.pin.n:'';
      switches.push(`  - platform: gpio\n    id: ${buzz&&buzz.a===a?'buzzer_1':compId(nm+pName)}\n    name: ${yq(nm+pName)}\n    pin: ${pin}`);
    }
    else unk(a.inst,a);
  }
  if(statusLed)lights.unshift(`  - platform: esp32_rmt_led_strip\n    id: status_led\n    name: "Status light"\n    pin: GPIO${brd.led}\n    num_leds: 1\n    rgb_order: GRB\n    chipset: ws2812`);
  if(sda&&scl){
    // well-known I2C sensors get their own section; anything else is left for the user to add
    const i2cParts=[...new Set(P.assigned.filter(a=>a.role==='sda').map(a=>a.inst))];let unknownI2C=0,n=0;
    var oled=null;// (r2) a weather project shows its forecast on an SSD1306-type OLED (see weatherYaml)
    for(const inst of i2cParts){
      const t=inst.part.name.toLowerCase(),nm=inst.label,sfx=i2cParts.length>1?' '+(++n):'';
      if(/bme280/.test(t))sensors.push(`  - platform: bme280_i2c\n`+tempHum(++thN,'Temperature'+sfx,'Humidity'+sfx)+`\n    pressure:\n      name: ${yq('Pressure'+sfx)}\n    address: 0x76  # some boards use 0x77\n    update_interval: ${every}`);
      else if(/bmp280/.test(t))sensors.push(`  - platform: bmp280_i2c\n`+tempHum(++thN,'Temperature'+sfx)+`\n    pressure:\n      name: ${yq('Pressure'+sfx)}\n    address: 0x76  # some boards use 0x77\n    update_interval: ${every}`);
      else if(/aht(10|20|2x|1x)?\b/.test(t))sensors.push(`  - platform: aht10\n    variant: ${/aht2/.test(t)?'AHT20':'AHT10'}\n`+tempHum(++thN,'Temperature'+sfx,'Humidity'+sfx)+`\n    update_interval: ${every}`);
      else if(/ssd1306|sh1106|\boled\b/.test(t)){if(wx&&!oled){oled=inst;}else{const model=/sh1106/i.test(t)?'SH1106 128x64':'SSD1306 128x64';fonts.push(`  - file: "gfonts://Roboto"\n    id: font_oled\n    size: 12`);displays.push(`  - platform: ssd1306_i2c\n    model: "${model}"\n    address: 0x3C  # try 0x3D if 0x3C doesn't work\n    update_interval: 1s\n    lambda: |-\n      it.print(0, 24, id(font_oled), "Ready");`);} }
      else if(/sht3/.test(t))sensors.push(`  - platform: sht3xd\n`+tempHum(++thN,'Temperature'+sfx,'Humidity'+sfx)+`\n    update_interval: ${every}`);
      else if(/mpu-?6050|gy-?521|mpu-?6500|gy-?6500/i.test(t)){sensors.push(`  - platform: mpu6050\n    address: 0x68\n    update_interval: 200ms\n    accel_x:\n      name: ${yq('Tilt X'+sfx)}\n    accel_y:\n      name: ${yq('Tilt Y'+sfx)}\n    accel_z:\n      name: ${yq('Tilt Z'+sfx)}`);}
      else if(/bh1750/i.test(t)){sensors.push(`  - platform: bh1750\n    name: ${yq('Light Level'+sfx)}\n    address: 0x23\n    update_interval: ${every}`);}
      else if(/ds3231/i.test(t)){timeSec.push(`time:\n  - platform: ds1307\n    id: rtc_time\n    address: 0x68`);}
      else if(/bno08[x5]|bno085|bno080/i.test(t)){const _sfxId=sfx.trim()?'_'+n:'';sensors.push(`  - platform: bno08x\n    model: BNO085\n    address: 0x4A  # or 0x4B if the ADDR pin is high\n    update_interval: 100ms\n    game_rotation_vector:\n      pitch:\n        id: imu_pitch${_sfxId}\n        name: ${yq('Pitch'+sfx)}\n      roll:\n        id: imu_roll${_sfxId}\n        name: ${yq('Roll'+sfx)}`);}
      else{unknownI2C++;unk(inst,sda,'sda');unk(inst,scl,'scl');}
    }
    sec(`# I2C bus. "scan" lists the address of every I2C part it finds in the log.\ni2c:\n  sda: ${g(sda)}\n  scl: ${g(scl)}\n  scan: true`);
  }
  if(globalsSec.length&&!wx)sec('globals:\n'+globalsSec.join('\n'));
  if(ntfyUsed)sec('# Sends the phone messages to ntfy.sh over your Wi-Fi.\nhttp_request:\n  timeout: 10s\n  verify_ssl: false');
  if(timeSec.length&&!wx)sec(timeSec.join('\n\n'));
  if(oneWire.length)sec('one_wire:\n'+oneWire.join('\n'));
  if(sensors.length)sec('sensor:\n'+sensors.join('\n'));
  if(bins.length)sec('binary_sensor:\n'+bins.join('\n'));
  if(outputs.length)sec('output:\n'+outputs.join('\n'));
  if(servos.length)sec('servo:\n'+servos.join('\n'));
  if(lights.length)sec('light:\n'+lights.join('\n'));
  if(switches.length)sec('switch:\n'+switches.join('\n'));
  if(fonts.length)sec('font:\n'+fonts.join('\n'));
  if(displays.length)sec('display:\n'+displays.join('\n'));
  // light rule: the light shows one colour while a reading is above (or below) a level, another otherwise
  const rm=meas.find(m=>m.id===f.ruleSrc)||meas[0];
  if(f.ruleOn&&rm&&lightId){
    const lvl=(+f.ruleVal||0)*(rm.scale||1),cmp=f.ruleOp==='below'?'<':'>',rgb=lightId==='status_led';
    const act=c=>c==='off'?`light.turn_off: ${lightId}`:rgb&&RULE_COLOURS[c]?`light.turn_on:\n                id: ${lightId}\n                red: ${RULE_COLOURS[c][0]}%\n                green: ${RULE_COLOURS[c][1]}%\n                blue: ${RULE_COLOURS[c][2]}%`:`light.turn_on: ${lightId}`;
    sec(`# Light rule: ${f.ruleA||'red'} while ${rm.label} is ${f.ruleOp==='below'?'below':'above'} ${+f.ruleVal||0} ${rm.unit}, otherwise ${f.ruleB||'green'}.\ninterval:\n  - interval: 2s\n    then:\n      - if:\n          condition:\n            lambda: |-\n              return id(${rm.id}).has_state() && id(${rm.id}).state ${cmp} ${+lvl.toFixed(4)};\n          then:\n            - ${act(f.ruleA||'red')}\n          else:\n            - ${act(f.ruleB||'green')}`);
  }
  if(wx){// (r2) weather from OpenWeatherMap, on the OLED, and a daily message by ntfy.sh
    sec(_int.weatherYaml(wx,typeof oled!=='undefined'?oled:null,meas));
    warn.push(wx.key?'Your OpenWeatherMap key is written into this file (substitutions, at the top): don\'t share the file publicly.':'Paste your OpenWeatherMap API key into owm_api_key at the top of the file (or answer "What do I want to build?" again): without it there is no weather.');
    if(typeof oled==='undefined'||!oled)warn.push('No SSD1306 OLED is wired, so the weather is fetched and sent but not shown on a screen.');
  }
  for(const a of P.assigned.filter(a=>a.role==='uart_tx'||a.role==='uart_rx'))unk(a.inst,a);
  const unk2=[...unknown].map(([inst,pins])=>({label:inst.label,name:inst.part.name,type:inst.part.type,info:inst.part.info||null,pins}));
  if(unk2.length)sec('# Still to add ("Make it with AI" in EvenUCan writes these):\n'+unk2.map(u=>'#   '+u.label+': '+u.pins.map(p=>p.n+' on '+p.gpio).join(', ')).join('\n'));
  if(!ha&&voice)warn.push('A voice assistant always needs Home Assistant.');
    let generatedYaml = L.join('\n\n') + '\n';
  if (typeof window !== 'undefined' && window.YamlDoctor && typeof window.YamlDoctor.diagnose === 'function') {
    try {
      const yd = window.YamlDoctor.diagnose(generatedYaml);
      if (yd && yd.fixedText && !yd.syntaxFailed) {
        generatedYaml = yd.fixedText;
      }
    } catch(e) { console.warn('YamlDoctor auto-repair skipped:', e); }
  }
  return {yaml:generatedYaml,slug,warn,board:brd.board,meas,lightId,rgb:lightId==='status_led',unknown:unk2,weather:!!wx};
};
const wiringCode=function wiringCode(ctrl,assigned,s3){
  const g=a=>s3?'GPIO'+a.c.g:a.c.n,num_=a=>a.c.g!==undefined?a.c.g:a.c.n;
  const by=(role)=>assigned.filter(a=>a.role===role);
  const one=role=>by(role)[0];
  let yml='# Pins for ESPHome, worked out by EvenUCan\n';
  const mic=one('mic_sd'),amp=one('amp_din');
  if(mic||amp){
    yml+='i2s_audio:\n';
    if(mic)yml+=`  - id: i2s_mic\n    i2s_lrclk_pin: ${g(one('mic_ws'))}\n    i2s_bclk_pin: ${g(one('mic_sck'))}\n`;
    if(amp)yml+=`  - id: i2s_amp\n    i2s_lrclk_pin: ${g(one('amp_lrc'))}\n    i2s_bclk_pin: ${g(one('amp_bclk'))}\n`;
    if(mic)yml+=`microphone:\n  - platform: i2s_audio\n    id: mic\n    i2s_audio_id: i2s_mic\n    i2s_din_pin: ${g(mic)}\n    adc_type: external\n    channel: left\n`;
    if(amp)yml+=`speaker:\n  - platform: i2s_audio\n    id: spk\n    i2s_audio_id: i2s_amp\n    i2s_dout_pin: ${g(amp)}\n    dac_type: external\n`;
  }
  const trigs=by('trig');
  if(trigs.length){yml+='sensor:\n';trigs.forEach((t,k)=>{const e=assigned.find(a=>a.inst===t.inst&&a.role==='echo');yml+=`  - platform: ultrasonic\n    name: "Distance${trigs.length>1?' '+(k+1):''}"\n    trigger_pin: ${g(t)}\n`+(e?`    echo_pin: ${g(e)}\n`:'');});}
  const sda=one('sda'),scl=one('scl');
  if(sda&&scl)yml+=`i2c:\n  sda: ${g(sda)}\n  scl: ${g(scl)}\n`;
  for(const a of assigned.filter(a=>['sig','uart_tx','uart_rx'].includes(a.role)))yml+=`# ${a.inst.label} ${a.pin?a.pin.n:''}: ${g(a)}\n`;
  let ino='// Pins for Arduino, worked out by EvenUCan\n';
  for(const a of assigned){const nm=inoName(a);if(!ino.includes('#define '+nm+' '))ino+=`#define ${nm} ${num_(a)}\n`;}
  return {esphome:yml,arduino:ino};
};
// The #define name for one wired pin: a short name from the part number ("HC-SR04 Ultrasonic..." → HC_SR04_TRIG), _2... for repeats.
const inoName=function inoName(a){
    const base=SIG_NAMES[a.role]||a.role.toUpperCase();
    const words=a.inst.label.split(/\s+/),num2=(a.inst.label.match(/#(\d+)$/)||[])[1];
    const who=(words.find(w=>/\d/.test(w)&&/[A-Za-z]/.test(w)&&!/^#/.test(w))||words.find(w=>/[A-Za-z]/.test(w))||words[0]).replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'').toUpperCase().slice(0,16)+(num2?'_'+num2:'');
    const nm=(['sig','uart_tx','uart_rx','trig','echo','sda','scl'].includes(a.role)?who+'_':'')+(a.role==='sig'&&a.pin?a.pin.n.replace(/[^A-Za-z0-9]+/g,'_').toUpperCase():base);
    // A C name cannot start with a digit or hold doubled/loose underscores ("LED 5 mm" + "+ (anode)" once gave 5__ANODE_, which does not compile)
    let ok=nm.replace(/[^A-Za-z0-9_]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
    if(!ok)ok='PIN';
    if(/^\d/.test(ok))ok='PIN_'+ok;
    return ok;
};
