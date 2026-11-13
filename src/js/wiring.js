// ---------------------------------------------------------------- wiring diagram
// Works out what wire goes where for the parts in the Enclosure Wizard, from each part's pin roles, with
// safety rules for the controller (pins it must not use) and the power chain. Shows a diagram, a list
// to tick off while soldering, and matching ESPHome / Arduino pin settings.
const ROLES={gnd:'Ground (GND)','3v3':'3.3 V power in','5v':'5 V power',vin:'Power in (2.5–5.5 V)',vcc:'Power in (check its voltage)',
  'bat+':'Battery +','bat-':'Battery −','chg_b+':'Charger B+ (battery +)','chg_b-':'Charger B− (battery −)','chg_out+':'Charger OUT+ (load +)','chg_out-':'Charger OUT− (load −)',
  sw_com:'Switch middle (common)',sw_a:'Switch contact','spk+':'Speaker +','spk-':'Speaker −','amp_out+':'Amp output +','amp_out-':'Amp output −',
  mic_sck:'I2S mic clock (SCK)',mic_ws:'I2S mic word select (WS)',mic_sd:'I2S mic data out (SD)',mic_lr:'Mic channel select (L/R)',
  amp_bclk:'I2S amp bit clock (BCLK)',amp_lrc:'I2S amp word select (LRC)',amp_din:'I2S amp data in (DIN)',amp_gain:'Amp gain (leave open)',amp_sd:'Amp shutdown (leave open)',
  trig:'Trigger (to a GPIO)',echo:'Echo, 5 V output (to a GPIO via a divider)',sda:'I2C data (SDA)',scl:'I2C clock (SCL)',uart_tx:'Serial TX (its output)',uart_rx:'Serial RX (its input)',
  ao:'Analog out (to an ADC GPIO)',do:'Digital out (to a GPIO)',
  sig:'Signal (to any free GPIO)',gpio:'Controller GPIO',nc:'Not connected'};
// ESP32-S3: pins not to use (Espressif user guide; strapping pins from the ESP32-S3 datasheet)
const S3_AVOID={0:'BOOT strapping pin',3:'strapping pin',45:'strapping pin',46:'strapping pin',19:'USB D−',20:'USB D+',43:'USB-serial TX',44:'USB-serial RX',
  35:'used by the PSRAM on R8 modules',36:'used by the PSRAM on R8 modules',37:'used by the PSRAM on R8 modules',38:'RGB LED (board v1.1)',48:'RGB LED (board v1.0)',26:'flash',27:'flash',28:'flash',29:'flash',30:'flash',31:'flash',32:'flash'};
const S3_ORDER=[4,5,6,7,15,16,17,18,8,9,10,11,12,13,14,1,2,42,41,40,39,47,21];
const pinsOf=p=>(p&&p.pins&&p.pins.length?p.pins:(builtinById(p&&p.id)||{}).pins)||[];
const SIG_ROLES=['mic_sck','mic_ws','mic_sd','amp_bclk','amp_lrc','amp_din','trig','echo','uart_tx','uart_rx','ao','do','sig'];
const SIG_NAMES={mic_sck:'MIC_SCK',mic_ws:'MIC_WS',mic_sd:'MIC_SD',amp_bclk:'AMP_BCLK',amp_lrc:'AMP_LRC',amp_din:'AMP_DIN',trig:'TRIG',echo:'ECHO',uart_tx:'RX_FROM',uart_rx:'TX_TO',ao:'AO',do:'DO',sig:'PIN'};
function planWiring(){
  const insts=instances().map((i,k)=>({key:'w'+k,part:i.part,pins:pinsOf(i.part)}));
  const same=i=>insts.filter(j=>j.part.id===i.part.id);
  for(const i of insts)i.label=i.part.name+(same(i).length>1?' #'+(same(i).indexOf(i)+1):'');
  const warn=[],info=[],noPinParts=[];
  if(!insts.length)return {error:'Add parts in the Enclosure Wizard first: the wiring is worked out for the parts in your box.'};
  const mcuOf=p=>p.mcu||(builtinById(p.id)||{}).mcu;// (an edited copy of a built-in board keeps its type)
  const ctrl=insts.find(i=>mcuOf(i.part))||insts.find(i=>i.pins.filter(p=>p.r==='gpio').length>=8);
  if(!ctrl)return {error:'There is no controller board (such as the ESP32-S3) with pin data among your parts, so there is nothing to wire the others to.'};
  const P=(inst,role)=>inst.pins.filter(p=>p.r===role).map(pin=>({inst,pin}));
  const first=(inst,role)=>P(inst,role)[0];
  const nets=[],net=(name,kind)=>{const n={name,kind,pins:[]};nets.push(n);return n;};
  const add=(n,...ps)=>{for(const p of ps)if(p)n.pins.push(p);};
  const s3=mcuOf(ctrl.part)==='esp32s3';
  // free controller pins, safest first
  const gp=ctrl.pins.filter(p=>p.r==='gpio');
  const pool=s3?S3_ORDER.map(g=>gp.find(p=>p.g===g)).filter(Boolean):gp.filter(p=>!/^(TX|RX|D0|D1)\b/i.test(p.n));
  const used=new Set(),take=pref=>{
    let p=pref!==undefined?pool.find(q=>q.g===pref&&!used.has(q)):null;
    if(!p)p=pool.find(q=>!used.has(q));
    if(p)used.add(p);return p;
  };
  const GND=net('GND','gnd'),V3=net('3.3 V','3v3'),V5=net('5 V','5v');
  add(GND,first(ctrl,'gnd'));add(V3,first(ctrl,'3v3'));
  // ---- power: USB only, or battery (+ charger, + switch)
  const bat=insts.find(i=>P(i,'bat+').length),chg=insts.find(i=>P(i,'chg_out+').length),sw=insts.find(i=>P(i,'sw_com').length);
  let rail5=V5;
  if(bat){
    const VB=net('Battery power (after the switch)','vbat');
    let src=first(bat,'bat+');
    if(chg){
      add(net('Battery +','vbat'),first(bat,'bat+'),first(chg,'chg_b+'));
      add(net('Battery −','gnd'),first(bat,'bat-'),first(chg,'chg_b-'));
      src=first(chg,'chg_out+');
      GND.pins.unshift(first(chg,'chg_out-'));
      info.push('Charge the battery through the charger\'s USB-C socket. The load ground goes to OUT−, never to B−, so the battery protection keeps working.');
    }else{
      add(GND,first(bat,'bat-'));
      warn.push('There is no charger module, so the battery has to be charged outside the box.');
    }
    if(sw){add(net((chg?'Charger OUT+':'Battery +')+' to switch','vbat'),src,first(sw,'sw_com'));add(VB,first(sw,'sw_a'));info.push('The on/off switch sits in the battery + line, between the '+(chg?'charger\'s OUT+':'battery')+' and everything else.');}
    else add(VB,src);
    const c5=first(ctrl,'5v');
    if(c5){add(VB,c5);warn.push(ctrl.label+' is fed from the battery (3.0–4.2 V) through its 5V pin. Its regulator needs about 3.6 V or more, so it may reset as the battery runs down: for reliable running put a small 5 V boost module between the switch and the 5V pin.');
      warn.push('Switch the battery off before plugging a USB cable into '+ctrl.label+' itself, so the two supplies don\'t fight.');}
    rail5=VB;
  }else add(V5,first(ctrl,'5v'));
  // (wizard-r2) say plainly how it is powered, first in the notes, so the wiring always matches the power choice
  const power=bat?'battery':wiz.power==='mains'?'mains':'usb';
  info.unshift(power==='battery'?'Powered by: the battery inside the box'+(chg?', charged through the charger\'s USB-C socket':'')+(sw?', with the on/off switch':'')+'.':
    power==='mains'?'Powered by: a mains adapter - a plug-in 5 V USB charger (1 A or more) - with its cable into '+ctrl.label+'\'s USB socket. No mains wiring goes inside the box: the plug does the conversion.':
    'Powered by: a USB cable into '+ctrl.label+'\'s USB socket, from a computer or any 5 V USB phone charger.');
  // ---- everything else
  const assigned=[];// {inst, role, ctrlPin}
  const i2c={};
  for(const i of insts){
    if(i===ctrl||i===bat||i===chg||i===sw)continue;
    if(!i.pins.length){warn.push(i.label+' has no pin data yet, so it isn\'t in the diagram. Add its pins in Parts (or use Import pins…).');noPinParts.push({label:i.label,id:i.part.id});continue;}
    const sonar=P(i,'trig').length&&P(i,'echo').length;
    for(const pin of i.pins){
      const pp={inst:i,pin};
      // an ultrasonic sensor's spare OUT / mode pin (e.g. the HY-SRF05) is left unconnected for normal trigger + echo use
      if(sonar&&pin.r==='sig'&&/^(out|mode)$/i.test(pin.n.trim())){info.push(i.label+': '+pin.n+' is a mode pin: leave it unconnected (trigger and echo are used instead).');continue;}
      switch(pin.r){
        case 'gnd':add(GND,pp);break;
        case '3v3':add(V3,pp);break;
        case 'vcc':add(V3,pp);warn.push(i.label+': pin '+pin.n+' is marked "check its voltage" and is wired to 3.3 V. If the module needs 5 V, change the pin to 5 V power in Parts.');break;
        case '5v':add(rail5,pp);if(bat)warn.push(i.label+' needs 5 V but only gets the battery\'s 3.0–4.2 V: add a 5 V boost module for it.');break;
        case 'vin':add(rail5,pp);break;
        case 'mic_lr':add(GND,pp);info.push(i.label+': L/R goes to GND, so it is the left channel.');break;
        case 'amp_out+':case 'amp_out-':{
          const spk=insts.find(s=>s!==i&&P(s,pin.r==='amp_out+'?'spk+':'spk-').length&&!s._amp);
          if(spk){add(net('Speaker '+(pin.r==='amp_out+'?'+':'−'),'spk'),pp,first(spk,pin.r==='amp_out+'?'spk+':'spk-'));if(pin.r==='amp_out-')spk._amp=i;}
          break;}
        case 'sda':case 'scl':{
          if(!i2c[pin.r]){const c=take((ctrl.part.i2c||[8,9])[pin.r==='sda'?0:1]);// (r3) the board's own I2C pins (S3 8/9, Nano A4/A5, Pi GPIO2/3)
          if(!c){warn.push('No free controller pin left for I2C '+pin.r.toUpperCase()+'.');break;}i2c[pin.r]=net('I2C '+pin.r.toUpperCase()+' ('+c.n+')','sig');i2c[pin.r].ctrlPin=c;add(i2c[pin.r],{inst:ctrl,pin:c});assigned.push({inst:i,role:pin.r,c});}
          // (r2) every part on the bus is listed, not just the first, so the ESPHome file writes each I2C part
          else if(!assigned.some(a=>a.inst===i&&a.role===pin.r))assigned.push({inst:i,role:pin.r,c:i2c[pin.r].ctrlPin,shared:true});
          add(i2c[pin.r],pp);break;}
        default:
          if(!SIG_ROLES.includes(pin.r))break;
          {const c=take();if(!c){warn.push('No free controller pin left for '+i.label+' '+pin.n+'.');break;}
           add(net(i.label+' '+pin.n+' → '+c.n,'sig'),pp,{inst:ctrl,pin:c});assigned.push({inst:i,role:pin.r,c,pin});
           if(pin.r==='echo')warn.push(i.label+': ECHO is a 5 V signal but the '+ctrl.label+' pins take 3.3 V. Put a divider in that wire: 1 kΩ from ECHO to the GPIO, and 2 kΩ from the GPIO to GND.');
           if(pin.r==='ao')info.push(i.label+': AO is an analog output — make sure the GPIO it is wired to supports ADC (avoid GPIO19, 20 on ESP32-S3).');}
      }
    }
    if(P(i,'amp_gain').length||P(i,'amp_sd').length)info.push(i.label+': GAIN and SD are left unconnected (9 dB gain, left and right mixed to mono).');
    if(P(i,'amp_out+').length)warn.push(i.label+': its speaker outputs are bridged. Never connect either speaker wire to GND.');
  }
  for(const s of insts)delete s._amp;
  // battery level for the controller to read (ESPHome reports it): a pin that can measure voltage (ADC1)
  let batSense=null;
  if(bat&&s3){
    batSense=[1,2,4,5,6,7,8,9,10].map(g=>pool.find(q=>q.g===g&&!used.has(q))).find(Boolean)||null;
    if(batSense){used.add(batSense);info.push('Battery level: two 100 kΩ resistors in series from the battery + (after the switch) to GND, with the point between them to '+batSense.n+'. The controller reads half the battery voltage there.');}
  }
  if(s3)info.push('Pins kept free on the ESP32-S3: '+[0,3,45,46].map(g=>'GPIO'+g).join(', ')+' (start-up), 19/20 (USB), 43/44 (serial), 35–37 (PSRAM), 38/48 (RGB LED).');
  const live=nets.filter(n=>n.pins.length>=2);
  return {insts,ctrl,nets:live,warn,info,noPinParts,assigned,s3,bat:!!bat,batSense,power,code:wiringCode(ctrl,assigned,s3)};
}

// ---- ESPHome device file: a complete YAML for the controller, from the wiring plan and a few answers.
// Each part gets the ESPHome section that matches its pin roles; the purpose decides what it does.
const ESPH_KEY='esphome.form';
const ESPH_AI_KEY='esphome.ai';// persists the AI-written YAML across re-renders / page reloads
// A short fingerprint for a set of unknown parts: sorted "label:pin,pin" strings joined.
// If the fingerprint matches what was stored, the AI result is still valid.
const esphAiSig=unknown=>unknown.map(u=>u.label+':'+u.pins.map(p=>p.gpio).sort().join(',')).sort().join('|');
const ESPH_DEFAULT={name:'',purpose:'sensor',ha:true,every:30,alarm:30,lowbat:3.5,button:'report',wake:'okay_nabu',status:true,
  ruleOn:false,ruleSrc:'',ruleOp:'above',ruleVal:30,ruleA:'red',ruleB:'green',desc:''};
const esphForm=()=>{try{return Object.assign({},ESPH_DEFAULT,JSON.parse(WF.store.get(ESPH_KEY)||'{}'));}catch(e){return {...ESPH_DEFAULT};}};
const ESPH_PURPOSES={sensor:'Sensor node (reports its readings)',voice:'Voice assistant (wake word, talks to Home Assistant)'};
const RULE_COLOURS={red:[100,0,0],green:[0,100,0],blue:[0,30,100],yellow:[100,80,0],white:[100,100,100],off:null};
const WAKE_WORDS={okay_nabu:'Okay Nabu',hey_jarvis:'Hey Jarvis',hey_mycroft:'Hey Mycroft',alexa:'Alexa'};
// Which ESPHome board a controller part is, or null if it can't run ESPHome.
function espBoard(part){
  const t=(part.name+' '+(part.notes||'')).toLowerCase(),mcu=part.mcu||(builtinById(part.id)||{}).mcu;
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
}
const esphSlug=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,31)||'my-device';
const yq=s=>'"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
// What kind of thing a plain signal pin drives, guessed from the part's name.
function sigKind(inst){
  const t=(inst.part.name+' '+(inst.part.type||'')).toLowerCase();
  if(/dht ?11|dht ?2[12]|am230[12]|\bdht\b/.test(t))return 'dht';
  if(/ds18b20|dallas|one.?wire temp/.test(t))return 'ds18b20';
  if(/ws281|neopixel|sk6812|addressable/.test(t))return 'pixel';
  if(/\bpir\b|hc-?sr50|am312|motion/.test(t))return 'motion';
  if(/ttp22|touch/.test(t))return 'touch';
  if(/button|push|tact|key\b/.test(t))return 'button';
  if(/relay/.test(t))return 'relay';
  if(/buzzer|beeper/.test(t))return 'buzzer';
  if(/\bled\b|light/.test(t))return 'led';
  return null;
}
function esphomeYaml(P,f){
  const brd=espBoard(P.ctrl.part);
  if(!brd)return {error:P.ctrl.label+' can\'t run ESPHome: ESPHome needs an ESP32 or ESP8266 board as the controller.'};
  const g=a=>{const c=a.c||a;if(c.g!==undefined)return 'GPIO'+c.g;return /^\d+$/.test(c.n)?'GPIO'+c.n:c.n;};
  const by=role=>P.assigned.filter(a=>a.role===role),one=role=>by(role)[0];
  const mic=one('mic_sd'),amp=one('amp_din'),trigs=by('trig'),sda=one('sda'),scl=one('scl'),wx=intentWeather();
  const voice=f.purpose==='voice';
  if(voice&&!(mic&&amp))return {error:'A voice assistant needs an I2S microphone (such as the INMP441) and an I2S amplifier with a speaker (such as the MAX98357A) among your parts. Add them in the Enclosure Wizard, or choose Sensor node.'};
  const ha=voice||f.ha,name=(f.name||'').trim()||'My Device',slug=esphSlug(name),every=Math.max(1,Math.round(+f.every||30))+'s';
  const statusLed=f.status&&brd.led!==undefined&&!P.assigned.some(a=>a.c&&a.c.g===brd.led);
  const sigs=P.assigned.filter(a=>a.role==='sig').map(a=>({a,kind:sigKind(a.inst)}));
  const buttons=sigs.filter(s=>s.kind==='button'||s.kind==='touch'),leds=sigs.filter(s=>s.kind==='led'||s.kind==='pixel');
  const lightId=statusLed?'status_led':leds.length?'led_1':null;
  const L=[],sec=s=>L.push(s),warn=[];
  // parts this file can't write by itself: the AI writes them ("Make it with AI"), from their name, part-file details and pins
  const unknown=new Map(),unk=(inst,a,role)=>{if(!unknown.has(inst))unknown.set(inst,[]);unknown.get(inst).push({n:a.pin?a.pin.n:role,d:a.pin&&a.pin.d||'',role:a.role||role,gpio:g(a)});};
  sec(`# ESPHome device file for "${name}", written by EvenUCan.\n# Pins come from the EvenUCan wiring: wire the parts exactly as its wiring list says.\n# To flash it: "Send to ESPHome" in EvenUCan (or paste it into a new device in ESPHome Device Builder),\n# then plug the board in by USB and click Install.`);
  const subs=intentSubs();if(subs)sec(subs);// (r2) the user's own settings from "What do I want to build?"
  let eh=`esphome:\n  name: ${slug}\n  friendly_name: ${yq(name)}`;
  if(voice)eh+=`\n  on_boot:\n    priority: -100\n    then:\n      - wait_until: api.connected\n      - micro_wake_word.start`;
  sec(eh);
  if(brd.chip==='esp32'){
    sec(`esp32:\n  board: ${brd.board}`+(brd.flash?`\n  flash_size: ${brd.flash}`:'')+`\n  framework:\n    type: esp-idf`);
    if(brd.psram)sec(`psram:\n  mode: ${brd.psram}\n  speed: 80MHz`);
  }else sec(`esp8266:\n  board: ${brd.board}`);
  sec('logger:');
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
  let thN=0;
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
    sensors.push(`  - platform: adc\n    id: battery_voltage\n    name: "Battery voltage"\n    pin: ${g(P.batSense)}\n    attenuation: 12db\n    update_interval: ${every}\n    filters:\n      - multiply: 2.0`);
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
    else if(kind==='pixel'){pixelN++;lights.push(`  - platform: esp32_rmt_led_strip\n    id: led_${++ledN}\n    name: ${yq(nm)}\n    pin: ${pin}\n    num_leds: 1  # change to the number of LEDs on the strip\n    rgb_order: GRB`);}
    else if(kind==='led'){outputs.push(`  - platform: gpio\n    id: led_out_${ledN+1}\n    pin: ${pin}`);lights.push(`  - platform: binary\n    id: led_${++ledN}\n    name: ${yq(nm)}\n    output: led_out_${ledN}`);}
    else if(kind==='relay'||kind==='buzzer')switches.push(`  - platform: gpio\n    id: ${buzz&&buzz.a===a?'buzzer_1':compId(nm)}\n    name: ${yq(nm)}\n    pin: ${pin}`);
    else unk(a.inst,a);
  }
  if(statusLed)lights.unshift(`  - platform: esp32_rmt_led_strip\n    id: status_led\n    name: "Status light"\n    pin: GPIO${brd.led}\n    num_leds: 1\n    rgb_order: GRB`);
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
      else if(/bno08[x5]|bno085|bno080/i.test(t)){const _sfxId=sfx.trim()?'_'+n:'';sensors.push(`  - platform: bno08x\n    model: BNO085\n    address: 0x4A  # or 0x4B if the ADDR pin is high\n    update_interval: 100ms\n    game_rotation_vector:\n      pitch:\n        id: imu_pitch${_sfxId}\n        name: ${yq('Pitch'+sfx)}\n      roll:\n        id: imu_roll${_sfxId}\n        name: ${yq('Roll'+sfx)}`);}
      else{unknownI2C++;unk(inst,sda,'sda');unk(inst,scl,'scl');}
    }
    sec(`# I2C bus. "scan" lists the address of every I2C part it finds in the log.\ni2c:\n  sda: ${g(sda)}\n  scl: ${g(scl)}\n  scan: true`);
  }
  if(ntfyUsed)sec('# Sends the phone messages to ntfy.sh over your Wi-Fi.\nhttp_request:\n  timeout: 10s\n  verify_ssl: false');
  if(oneWire.length)sec('one_wire:\n'+oneWire.join('\n'));
  if(sensors.length)sec('sensor:\n'+sensors.join('\n'));
  if(bins.length)sec('binary_sensor:\n'+bins.join('\n'));
  if(outputs.length)sec('output:\n'+outputs.join('\n'));
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
    sec(weatherYaml(wx,typeof oled!=='undefined'?oled:null,meas));
    warn.push(wx.key?'Your OpenWeatherMap key is written into this file (substitutions, at the top): don\'t share the file publicly.':'Paste your OpenWeatherMap API key into owm_api_key at the top of the file (or answer "What do I want to build?" again): without it there is no weather.');
    if(typeof oled==='undefined'||!oled)warn.push('No SSD1306 OLED is wired, so the weather is fetched and sent but not shown on a screen.');
  }
  for(const a of P.assigned.filter(a=>a.role==='uart_tx'||a.role==='uart_rx'))unk(a.inst,a);
  const unk2=[...unknown].map(([inst,pins])=>({label:inst.label,name:inst.part.name,type:inst.part.type,info:inst.part.info||null,pins}));
  if(unk2.length)sec('# Still to add ("Make it with AI" in EvenUCan writes these):\n'+unk2.map(u=>'#   '+u.label+': '+u.pins.map(p=>p.n+' on '+p.gpio).join(', ')).join('\n'));
  if(!ha&&voice)warn.push('A voice assistant always needs Home Assistant.');
  return {yaml:L.join('\n\n')+'\n',slug,warn,board:brd.board,meas,lightId,rgb:lightId==='status_led',unknown:unk2,weather:!!wx};
}
function wiringCode(ctrl,assigned,s3){
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
}
// The #define name for one wired pin: a short name from the part number ("HC-SR04 Ultrasonic..." → HC_SR04_TRIG), _2... for repeats.
function inoName(a){
    const base=SIG_NAMES[a.role]||a.role.toUpperCase();
    const words=a.inst.label.split(/\s+/),num2=(a.inst.label.match(/#(\d+)$/)||[])[1];
    const who=(words.find(w=>/\d/.test(w)&&!/^#/.test(w))||words[0]).replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'').toUpperCase().slice(0,16)+(num2?'_'+num2:'');
    const nm=(['sig','uart_tx','uart_rx','trig','echo','sda','scl'].includes(a.role)?who+'_':'')+(a.role==='sig'&&a.pin?a.pin.n.replace(/[^A-Za-z0-9]+/g,'_').toUpperCase():base);
    return nm;
}

// ---- the wiring window
// (1.9.37) The picture is made to be read: only the pins in use get a label, outside the board with a
// leader line, placed so no two labels overlap; wires coloured by job (red power, black ground, a colour
// of their own for each signal) with a key; zoom (wheel or pinch), drag the background to move about,
// Fit; click a wire, a part or a wiring-list row to see just that one, or go one wire at a time.
let wr=null;// {plan, pos:{key:[x,y]}, view, userView, focus, step, hi, tab, done, labelRects, partRects, hit}
const WIRE_COLOURS={gnd:'#111111','3v3':'#e53935','5v':'#b00020',vbat:'#d00000',spk:'#7a4f2a'};
const SIG_COLOURS=['#1f6fd6','#f2a900','#8e44ad','#16a085','#00acc1','#7cb342','#3949ab','#ff7f0e','#6d4c41','#ec407a'];
const WIRE_KEY={'3v3':'Power 3.3 V','5v':'Power 5 V (dashed)',vbat:'Battery +',gnd:'Ground',spk:'Speaker'};
const WR_FONT='"Segoe UI",system-ui,sans-serif',WR_MIN_S=3;// at least 3 pixels a millimetre, so small boards stay readable
document.body.insertAdjacentHTML('beforeend',`<div id="wrBack" class="ewBack"><div class="ewWin">
  <div class="ewHead"><h2>Wiring</h2><span class="ewNote">What wire goes where. Click a wire, a part or a line of the wiring list to see just that one. Scroll to zoom, drag the background to move about, drag a board to tidy it.</span>
    <button id="wrRedo" title="Work the wiring out again">Work it out again</button><button id="wrX" class="x" title="Close (Esc)" style="font-size:18px">✕</button></div>
  <div class="ewBody" style="grid-template-columns:minmax(0,1fr) 400px">
    <div class="ewMain"><div class="ewCanvasWrap"><canvas id="wrCanvas" tabindex="0"></canvas>
      <div id="wrTools"><button id="wrFit" title="Show the whole picture">Fit</button><button id="wrZin" title="Zoom in (or scroll the mouse wheel)">+</button><button id="wrZout" title="Zoom out">−</button><button id="wrStep" title="Show the wires one by one, in the same order as the wiring list">One wire at a time</button><span id="wrStepBox"><button id="wrPrev" title="The wire before (← key)">◀ Back</button><span id="wrStepN"></span><button id="wrNext" title="The next wire (→ key)">Next ▶</button></span><button id="wrShowAll" class="primary" title="Show every wire and label again">Show all</button></div>
    </div></div>
    <div class="ewSide" id="wrSide" style="border-right:none;border-left:1px solid var(--line)"></div>
  </div>
  <div class="ewFoot"><span class="ewNote" style="flex:1">Check every connection against the boards' own labels before you power up.</span>
    <button id="wrPng" title="Save the whole wiring picture, with every label, as a PNG file">Save picture</button><button id="wrTxt">Save wiring list</button><button id="wrClose">Close</button></div>
</div></div>`);
const wrBack=$('wrBack');
function openWiring(){
  ewBack.style.display='none';plBack.style.display='none';wrBack.style.display='grid';
  const plan=planWiring();
  wr={plan,pos:{},hi:-1,focus:null,step:-1,userView:null,done:{},tab:(wr&&wr.tab)||'list',chat:(wr&&wr.chat)||{msgs:[],busy:false}};
  if(!plan.error){placeModules();linkNets();}
  renderWiringSide();drawWiring();$('wrCanvas').focus();drawGuide();
}
function closeWiring(){wrBack.style.display='none';drawGuide();}
// Controller in the middle with the parts spread round it: above it, then below it, then to the right;
// power parts (battery, charger, switch) on the left.
function placeModules(){
  const {insts,ctrl,nets}=wr.plan,pos=wr.pos,G=26,R=38,cw=ctrl.part.w,cd=ctrl.part.d;
  pos[ctrl.key]=[0,0];
  const power=new Set(insts.filter(i=>pinsOf(i.part).some(p=>/^(bat|chg_|sw_)/.test(p.r))).map(i=>i.key));
  const rows={top:[],bottom:[],right:[],left:[]},others=[];
  for(const i of insts){
    if(i===ctrl)continue;
    if(power.has(i.key)){rows.left.push(i);continue;}
    const cps=nets.filter(n=>n.pins.some(p=>p.inst===i)).flatMap(n=>n.pins.filter(p=>p.inst===ctrl&&p.pin.x!==undefined).map(p=>p.pin));
    i._ax=cps.length?cps.reduce((s,p)=>s+p.x,0)/cps.length:cw/2;
    i._side=cps.length?(cps.reduce((s,p)=>s+p.y,0)/cps.length>cd/2?'top':'bottom'):'top';
    others.push(i);
  }
  // a speaker sits by its amplifier
  for(const i of others){const amp=nets.find(n=>n.kind==='spk'&&n.pins.some(p=>p.inst===i));if(amp){const o=amp.pins.find(p=>p.inst!==i).inst;if(o&&o._ax!==undefined&&!nets.some(n=>n.kind!=='spk'&&n.pins.some(p=>p.inst===i)&&n.pins.some(p=>p.inst===ctrl))){i._ax=o._ax+1;i._side=o._side;}}}
  others.sort((a,b)=>a._ax-b._ax);
  const used=list=>list.reduce((s,i)=>s+i.part.w,0)+G*list.length,room=cw+40;
  for(const i of others){
    const want=i._side,other=want==='top'?'bottom':'top';
    if(used(rows[want])+i.part.w<=room)rows[want].push(i);
    else if(rows.right.length<2)rows.right.push(i);
    else if(used(rows[other])+i.part.w<=room)rows[other].push(i);
    else if(rows.right.length<=rows.left.length)rows.right.push(i);else rows.left.push(i);
  }
  const row=(list,below)=>{let x=cw/2-(used(list)-G)/2;for(const i of list){pos[i.key]=[x,below?cd+R:-R-i.part.d];x+=i.part.w+G;}};
  const col=(list,right)=>{let y=cd/2-(list.reduce((s,i)=>s+i.part.d,0)+G*(list.length-1))/2;for(const i of list){pos[i.key]=[right?cw+R:-R-i.part.w,y];y+=i.part.d+G;}};
  row(rows.top,false);row(rows.bottom,true);col(rows.right,true);col(rows.left,false);
}
// pin position in the picture (mm, y down)
function pinXY(i,p){
  const [mx,my]=wr.pos[i.key]||[0,0],w=i.part.w,d=i.part.d;
  if(p.x===undefined){const k=i.pins.indexOf(p),n=i.pins.length;return [mx+w*(k+1)/(n+1),my+d];}
  return [mx+p.x,my+(d-p.y)];
}
// red for power, black for ground, and each signal wire a colour of its own
function netColour(n,k){
  if(WIRE_COLOURS[n.kind])return WIRE_COLOURS[n.kind];
  const nets=wr&&wr.plan&&wr.plan.nets||[];let j=0;for(let q=0;q<k&&q<nets.length;q++)if(!WIRE_COLOURS[nets[q].kind])j++;
  return SIG_COLOURS[j%SIG_COLOURS.length];
}
// Which pins each wire joins: every pin to its nearest pin already on that connection (a short chain,
// like a real ground bus), instead of one long wire per pin back to the first.
function linkNets(){
  for(const n of wr.plan.nets){
    const pts=n.pins.map(p=>pinXY(p.inst,p.pin)),inT=[0],rest=new Set(pts.map((_,i)=>i).slice(1));n.links=[];
    while(rest.size){
      let best=null;
      for(const a of inT)for(const b of rest){const d=Math.hypot(pts[a][0]-pts[b][0],pts[a][1]-pts[b][1]);if(!best||d<best[2])best=[a,b,d];}
      n.links.push([best[0],best[1]]);inT.push(best[1]);rest.delete(best[1]);
    }
  }
}
// every wire in wiring-list order (the "one wire at a time" order)
function wrLinks(){return wr.plan.nets.flatMap((n,k)=>n.links.map(([ia,ib],j)=>({k,j,n,a:n.pins[ia],b:n.pins[ib]})));}
const wrPinId=p=>p.inst.key+'|'+p.pin.n+'|'+p.pin.h;
// a short name for a part: its model number (SSD1306, MPU6050...) plus what it is, e.g. "SSD1306 OLED"
function wrShort(i){
  const l=i.label.replace(/\s*\(.*$/,''),w=l.split(/\s+/),num=(i.label.match(/#\d+$/)||[''])[0];
  const model=w.find(x=>/[A-Za-z]/.test(x)&&/\d/.test(x)&&!/^\d/.test(x)&&!/^#/.test(x)),kind=(l.match(/\b(OLED|LCD|TFT|buzzer|relay|PIR|servo|speaker|microphone|button|LED)\b/i)||[])[0];
  return ((model?model+(kind&&kind!==model?' '+kind:''):w.slice(0,2).join(' '))+(num?' '+num:'')).slice(0,30);
}
function wrLinkText(a,b){
  const ctrl=wr.plan.ctrl;if(b.inst===ctrl&&a.inst!==ctrl)[a,b]=[b,a];
  return (a.inst===ctrl?a.pin.n:a.pin.n+' ('+wrShort(a.inst)+')')+' → '+b.pin.n+' ('+wrShort(b.inst)+')';
}
// what is in focus: the wires, pins and parts to show, and the big label
function wrFocusSets(){
  const f=wr.focus;if(!f)return null;
  const L=wrLinks(),pick=f.type==='link'?L.filter(l=>l.k===f.k&&l.j===f.j):f.type==='net'?L.filter(l=>l.k===f.k):L.filter(l=>l.a.inst.key===f.key||l.b.inst.key===f.key);
  const S={links:new Set(pick.map(l=>l.k+'-'+l.j)),pins:new Set(),insts:new Set(f.type==='inst'?[f.key]:[]),big:'',sub:'',col:'#333'};
  for(const l of pick){S.pins.add(wrPinId(l.a));S.pins.add(wrPinId(l.b));S.insts.add(l.a.inst.key);S.insts.add(l.b.inst.key);}
  if(f.type==='link'&&pick[0]){const l=pick[0];S.big=wrLinkText(l.a,l.b);S.col=netColour(l.n,l.k);S.sub=l.n.name+(wr.step>=0?' · wire '+(wr.step+1)+' of '+L.length:'');}
  else if(f.type==='net'){const n=wr.plan.nets[f.k];S.big=n.name;S.col=netColour(n,f.k);S.sub=pick.length+(pick.length===1?' wire':' wires');}
  else{const i=wr.plan.insts.find(i=>i.key===f.key);S.big=i?i.label:'';S.sub=pick.length+(pick.length===1?' wire goes':' wires go')+' to this part';}
  return S;
}
// the view that shows everything (pixels per mm and offset), leaving room round the edge for labels
function wrFitView(cw,ch){
  const {insts}=wr.plan,M={l:56,r:56,t:92,b:86};
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const i of insts){if(!wr.pos[i.key])continue;const [x,y]=wr.pos[i.key];x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+i.part.w);y1=Math.max(y1,y+i.part.d);}
  let s=Math.min((cw-M.l-M.r)/(x1-x0),(ch-M.t-M.b)/(y1-y0));
  if(!(s>0))s=WR_MIN_S;
  if(s<WR_MIN_S){// too small to read: keep it readable, centred on the controller (zoom out or Fit... drag to move about)
    s=WR_MIN_S;const c=wr.plan.ctrl,p=wr.pos[c.key]||[0,0];
    return {s,ox:cw/2-(p[0]+c.part.w/2)*s,oy:ch/2-(p[1]+c.part.d/2)*s,fit:true};
  }
  return {s,ox:M.l+(cw-M.l-M.r-(x1-x0)*s)/2-x0*s,oy:M.t+(ch-M.t-M.b-(y1-y0)*s)/2-y0*s,fit:true};
}
function drawWiring(){
  const cv=$('wrCanvas'),wrap=cv.parentElement,dpr=window.devicePixelRatio||1,cw=wrap.clientWidth,ch=wrap.clientHeight;if(!cw||!ch)return;
  if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(ch*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr);}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
  wrToolsShow();
  if(!wr||wr.plan.error){c.clearRect(0,0,cw,ch);c.fillStyle='#fbfcfe';c.fillRect(0,0,cw,ch);c.font='13px '+WR_FONT;c.fillStyle='#777';c.textAlign='center';c.fillText(wr?wr.plan.error:'',cw/2,ch/2);return;}
  wr.view=wr.userView||wrFitView(cw,ch);
  const r=renderWiring(c,cw,ch,wr.view,wrFocusSets(),false);
  Object.assign(wr,r);
}
// Draws the whole picture on c; returns where the labels, parts and wires ended up (for clicks and tests).
function renderWiring(c,cw,ch,view,F,exporting){
  const {insts,nets,ctrl}=wr.plan,s=view.s,X=x=>view.ox+x*s,Y=y=>view.oy+y*s;
  c.clearRect(0,0,cw,ch);c.fillStyle=exporting?'#ffffff':'#fbfcfe';c.fillRect(0,0,cw,ch);
  const partRects=[],hit=[],labelRects=[],obst=[];
  const hitR=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
  const fitText=(t,max)=>{if(c.measureText(t).width<=max)return t;while(t.length>3&&c.measureText(t+'…').width>max)t=t.slice(0,-1);return t+'…';};
  for(const i of insts){if(!wr.pos[i.key])continue;const [mx,my]=wr.pos[i.key];partRects.push({x:X(mx),y:Y(my),w:i.part.w*s,h:i.part.d*s,key:i.key});}
  for(const q of partRects)obst.push({x:q.x-3,y:q.y-3,w:q.w+6,h:q.h+6});
  if(!exporting){const tb=$('wrTools');obst.push({x:0,y:0,w:tb.offsetWidth+14,h:tb.offsetHeight+12});obst.push({x:0,y:ch-40,w:Math.min(cw,420),h:40});}
  // boards and their names
  c.font='bold 13px '+WR_FONT;
  const names=[];
  for(const i of insts){
    if(!wr.pos[i.key])continue;const [mx,my]=wr.pos[i.key],p=i.part,col=typeOf(p).color,on=!F||F.insts.has(i.key);
    c.save();c.globalAlpha=on?1:0.22;c.beginPath();c.rect(X(mx),Y(my),p.w*s,p.d*s);
    const im=imgOf(p.photo,drawWiring);
    if(im){c.save();c.clip();c.drawImage(im,X(mx),Y(my),p.w*s,p.d*s);c.restore();c.fillStyle='#ffffff55';c.fill();}
    else{c.fillStyle=col+'2a';c.fill();}
    c.lineWidth=F&&F.insts.has(i.key)?3:2;c.strokeStyle=col;c.stroke();
    const t=fitText(i===ctrl?i.label:i.label.replace(/\s*\(.*$/,''),i===ctrl?p.w*s-8:Math.max(60,Math.min(Math.max(p.w*s+18*s,120),cw-X(mx)-6))),tw=c.measureText(t).width;
    // the name goes on the side away from the pins in use (inside the controller, which is big enough)
    const up=nets.flatMap(n=>n.pins.filter(q=>q.inst===i)).map(q=>pinXY(i,q.pin)[1]-my),pinsTop=up.length&&up.reduce((a,b)=>a+b,0)/up.length<p.d/2;
    let nr=i===ctrl&&p.d*s>40?{x:X(mx)+(p.w*s-tw)/2,y:Y(my)+(p.d*s-17)/2,w:tw,h:17}:pinsTop?{x:X(mx),y:Y(my+p.d)+4,w:tw,h:17}:{x:X(mx),y:Y(my)-21,w:tw,h:17};
    if(i!==ctrl&&(names.some(o=>hitR(o,nr))||nr.y<2))nr=pinsTop?{x:X(mx),y:Y(my)-21,w:tw,h:17}:{x:X(mx),y:Y(my+p.d)+4,w:tw,h:17};
    names.push(nr);obst.push(nr);
    c.fillStyle='#111';c.textAlign='left';c.textBaseline='alphabetic';c.fillText(t,nr.x,nr.y+13);
    c.restore();
    // pins: a small dot each (the used ones get a ring further down)
    c.save();c.globalAlpha=on?1:0.22;
    for(const pin of i.pins){if(pin.r==='nc'&&i!==ctrl)continue;const [px,py]=pinXY(i,pin);c.beginPath();c.arc(X(px),Y(py),Math.max(1.6,Math.min(3,s*0.5)),0,Math.PI*2);c.fillStyle='#b9a24a';c.fill();}
    c.restore();
  }
  // zero-connection overlay: parts that are positioned but have no wires at all
  {const inNets=new Set(nets.flatMap(n=>n.pins.map(p=>p.inst.key)));
  for(const i of insts){
    if(i===ctrl||!wr.pos[i.key])continue;
    if(inNets.has(i.key))continue;
    // this part has pins but landed on zero nets (usually: no free GPIO left)
    const [mx,my]=wr.pos[i.key],p=i.part,on=!F||F.insts.has(i.key);
    c.save();c.globalAlpha=on?0.85:0.2;
    // hatched warning fill
    c.beginPath();c.rect(X(mx),Y(my),p.w*s,p.d*s);c.clip();
    c.strokeStyle='#f97316';c.lineWidth=2;
    for(let d=-(p.d*s+p.w*s);d<p.w*s+p.d*s;d+=10){
      c.beginPath();c.moveTo(X(mx)+d,Y(my));c.lineTo(X(mx)+d+p.d*s,Y(my)+p.d*s);c.stroke();
    }
    c.restore();
    c.save();c.globalAlpha=on?1:0.3;
    // orange border
    c.beginPath();c.rect(X(mx),Y(my),p.w*s,p.d*s);c.strokeStyle='#f97316';c.lineWidth=2.5;c.stroke();
    // small warning badge
    const bw=Math.min(p.w*s-6,100),bh=18,bx=X(mx)+(p.w*s-bw)/2,by=Y(my+p.d)-bh-2;
    if(bh<p.d*s-4){
      c.fillStyle='#f97316';c.beginPath();c.roundRect?c.roundRect(bx,by,bw,bh,4):c.rect(bx,by,bw,bh);c.fill();
      c.fillStyle='#fff';c.font='bold 11px '+WR_FONT;c.textAlign='center';c.textBaseline='middle';
      c.fillText('⚠ no connections',bx+bw/2,by+bh/2+0.5);
    }
    c.restore();
  }}
  // wires
  nets.forEach((n,k)=>{
    const colr=netColour(n,k);
    n.links.forEach(([ia,ib],j)=>{
      const on=F?F.links.has(k+'-'+j):(exporting||wr.hi<0||wr.hi===k);
      const a=n.pins[ia],b=n.pins[ib],[ax,ay]=pinXY(a.inst,a.pin),[bx,by]=pinXY(b.inst,b.pin);
      const out=(i,x,y)=>{const [mx,my]=wr.pos[i.key],d=[[0,-1,y-my],[0,1,my+i.part.d-y],[-1,0,x-mx],[1,0,mx+i.part.w-x]].sort((u,v)=>u[2]-v[2])[0];return [d[0],d[1]];};
      const [adx,ady]=out(a.inst,ax,ay),[bdx,bdy]=out(b.inst,bx,by),L=Math.max(12,Math.hypot(bx-ax,by-ay)*0.35);
      const P=[[X(ax),Y(ay)],[X(ax+adx*L),Y(ay+ady*L)],[X(bx+bdx*L),Y(by+bdy*L)],[X(bx),Y(by)]];
      const pts=[];for(let q=0;q<=24;q++){const t=q/24,u=1-t;pts.push([0,1].map(e=>u*u*u*P[0][e]+3*u*u*t*P[1][e]+3*u*t*t*P[2][e]+t*t*t*P[3][e]));}
      hit.push({k,j,pts});
      c.save();c.globalAlpha=on?1:(F?0.07:0.15);c.strokeStyle=colr;c.lineCap='round';
      c.lineWidth=F&&on?5:(wr.hi===k&&!F&&!exporting?4.5:2.6);if(n.kind==='5v')c.setLineDash([9,5]);
      if(F&&on){c.save();c.strokeStyle='#ffffff';c.lineWidth=9;c.setLineDash([]);c.beginPath();c.moveTo(...P[0]);c.bezierCurveTo(...P[1],...P[2],...P[3]);c.stroke();c.restore();}
      c.beginPath();c.moveTo(...P[0]);c.bezierCurveTo(...P[1],...P[2],...P[3]);c.stroke();c.restore();
    });
  });
  // labels: only the pins in use, outside the boards, each moved along/outwards until it overlaps nothing
  const big=!!F,seen=new Set(),todo=[];
  if(F&&F.big){c.font='bold 20px '+WR_FONT;const w1=c.measureText(F.big).width;c.font='13px '+WR_FONT;const bw=Math.min(cw-16,Math.max(w1,c.measureText(F.sub).width)+28);obst.push({x:(cw-bw)/2-4,y:(exporting?8:44)-4,w:bw+8,h:60});}
  nets.forEach((n,k)=>{for(const p of n.pins){const id=wrPinId(p);if(seen.has(id))continue;seen.add(id);if(F&&!F.pins.has(id))continue;todo.push({p,k,col:netColour(n,k)});}});
  c.font=(big?'bold 14px ':'bold 11px ')+WR_FONT;const lh=big?20:15;
  for(const L of todo){
    const {p}=L,[px0,py0]=pinXY(p.inst,p.pin),[mx,my]=wr.pos[p.inst.key],pw=p.inst.part.w,pd=p.inst.part.d;
    const px=X(px0),py=Y(py0),t=p.pin.n,tw=c.measureText(t).width+8;
    const e=[[0,-1,py0-my],[0,1,my+pd-py0],[-1,0,px0-mx],[1,0,mx+pw-px0]].sort((u,v)=>u[2]-v[2])[0],[dx,dy]=e;
    const edge=dy<0?Y(my):dy>0?Y(my+pd):dx<0?X(mx):X(mx+pw);// the board edge the label goes past
    let best=null;
    search:for(let tier=0;tier<9;tier++){
      const off=8+tier*(dy?lh+2:tw*0.6+6);
      for(const sh of [0,1,-1,2,-2,3,-3,4,-4]){
        let r;
        if(dy){const y=dy<0?edge-off-lh:edge+off;r={x:px-tw/2+sh*(tw*0.55+3),y,w:tw,h:lh};}
        else{const x=dx<0?edge-off-tw:edge+off;r={x,y:py-lh/2+sh*(lh+2),w:tw,h:lh};}
        if(!obst.some(o=>hitR(o,r))&&!labelRects.some(o=>hitR({x:o.x-2,y:o.y-2,w:o.w+4,h:o.h+4},r))){best=r;break search;}
        if(!best)best=r;
      }
    }
    const r=best;labelRects.push({x:r.x,y:r.y,w:r.w,h:r.h,t:p.inst.label+' '+t,px,py,col:L.col,text:t,k:L.k});
  }
  for(const r of labelRects){// leader line from the pin to the nearest point of its label
    const lOn=!F&&wr.hi>=0&&!exporting?r.k===wr.hi:true;
    const qx=Math.max(r.x,Math.min(r.px,r.x+r.w)),qy=Math.max(r.y,Math.min(r.py,r.y+r.h));
    c.save();c.strokeStyle=r.col;c.globalAlpha=lOn?0.85:0.1;c.lineWidth=1.2;c.beginPath();c.moveTo(r.px,r.py);c.lineTo(qx,qy);c.stroke();
    c.beginPath();c.arc(r.px,r.py,big?4:3,0,Math.PI*2);c.fillStyle='#fff';c.fill();c.lineWidth=big?2.5:1.8;c.stroke();c.restore();
  }
  for(const r of labelRects){
    const lOn=!F&&wr.hi>=0&&!exporting?r.k===wr.hi:true;
    c.save();c.globalAlpha=lOn?1:0.1;c.fillStyle='#ffffff';c.strokeStyle=r.col;c.lineWidth=big?2:1.4;
    c.beginPath();c.roundRect?c.roundRect(r.x,r.y,r.w,r.h,4):c.rect(r.x,r.y,r.w,r.h);c.fill();c.stroke();
    c.fillStyle='#111';c.textAlign='center';c.textBaseline='middle';c.fillText(r.text,r.x+r.w/2,r.y+r.h/2+0.5);c.restore();
  }
  // the key
  const kinds=[...new Set(nets.map(n=>WIRE_COLOURS[n.kind]?n.kind:'sig'))].sort((a,b)=>'3v35vvbatgndspksig'.indexOf(a)-'3v35vvbatgndspksig'.indexOf(b));
  c.font='12px '+WR_FONT;
  const items=kinds.map(k=>({k,t:k==='sig'?'Signals: one colour each':WIRE_KEY[k]}));
  let kx=10;const ky=ch-24,kw=items.reduce((s,it)=>s+30+c.measureText(it.t).width+12,0);
  c.save();c.fillStyle='#ffffffe8';c.strokeStyle='#ccd';c.lineWidth=1;c.beginPath();c.rect(6,ky-11,Math.min(kw+6,cw-12),22);c.fill();c.stroke();
  for(const it of items){
    c.lineWidth=4;c.lineCap='round';c.setLineDash(it.k==='5v'?[6,4]:[]);
    if(it.k==='sig'){SIG_COLOURS.slice(0,3).forEach((cl,q)=>{c.strokeStyle=cl;c.beginPath();c.moveTo(kx+4+q*8,ky);c.lineTo(kx+9+q*8,ky);c.stroke();});}
    else{c.strokeStyle=WIRE_COLOURS[it.k];c.beginPath();c.moveTo(kx+4,ky);c.lineTo(kx+24,ky);c.stroke();}
    c.setLineDash([]);c.fillStyle='#222';c.textAlign='left';c.textBaseline='middle';c.fillText(it.t,kx+30,ky+0.5);kx+=30+c.measureText(it.t).width+12;
  }
  c.restore();
  // the big label for what is in focus
  let bigLabel='';
  if(F&&F.big){
    bigLabel=F.big;
    c.save();c.font='bold 20px '+WR_FONT;const t=fitText(F.big,cw-30),w1=c.measureText(t).width;c.font='13px '+WR_FONT;const w2=c.measureText(F.sub).width;
    const bw=Math.min(cw-16,Math.max(w1,w2)+28),bx=(cw-bw)/2,by=exporting?8:44;
    c.fillStyle='#ffffff';c.strokeStyle=F.col;c.lineWidth=3;c.beginPath();c.roundRect?c.roundRect(bx,by,bw,52,8):c.rect(bx,by,bw,52);c.fill();c.stroke();
    c.fillStyle='#111';c.textAlign='center';c.textBaseline='alphabetic';c.font='bold 20px '+WR_FONT;c.fillText(t,cw/2,by+25);
    c.font='13px '+WR_FONT;c.fillStyle='#555';c.fillText(F.sub,cw/2,by+44);c.restore();
  }
  return {labelRects,partRects,hit,bigLabel,keyShown:items.length>0};
}
// the buttons over the picture
function wrToolsShow(){
  const ok=wr&&!wr.plan.error;$('wrTools').style.display=ok?'flex':'none';if(!ok)return;
  $('wrStepBox').style.display=wr.step>=0?'inline-flex':'none';$('wrStep').style.display=wr.step>=0?'none':'';
  $('wrShowAll').style.display=wr.focus?'':'none';
  if(wr.step>=0)$('wrStepN').textContent=' Wire '+(wr.step+1)+' of '+wrLinks().length+' ';
}
// focus on one wire / connection / part (null = show all), and mark it in the wiring list
function wrSetFocus(f,step){
  wr.focus=f;wr.step=f&&f.type==='link'&&step!==undefined?step:(f&&f.type==='link'&&wr.step>=0?wrLinks().findIndex(l=>l.k===f.k&&l.j===f.j):-1);
  if(!f)wr.step=-1;
  document.querySelectorAll('#wrSide [data-link]').forEach(el=>el.classList.toggle('on',!!f&&f.type==='link'&&el.dataset.link===f.k+'-'+f.j));
  document.querySelectorAll('#wrSide .wrNet').forEach(el=>el.classList.toggle('on',!!f&&f.type==='net'&&+el.dataset.net===f.k));
  if(f&&f.type==='link'){const el=document.querySelector(`#wrSide [data-link="${f.k}-${f.j}"]`);if(el&&wr.step>=0)el.scrollIntoView({block:'nearest'});}
  drawWiring();
}
function wrGoStep(i){const L=wrLinks();if(!L.length)return;i=Math.max(0,Math.min(L.length-1,i));wrSetFocus({type:'link',k:L[i].k,j:L[i].j},i);}
function wrZoom(f,sx,sy){
  const cv=$('wrCanvas'),v=wr.userView||{...wr.view},fit=wrFitView(cv.clientWidth,cv.clientHeight);
  const s=Math.max(fit.s*0.4,Math.min(fit.s*8,v.s*f)),k=s/v.s;
  if(sx===undefined){sx=cv.clientWidth/2;sy=cv.clientHeight/2;}
  wr.userView={s,ox:sx-(sx-v.ox)*k,oy:sy-(sy-v.oy)*k};drawWiring();
}
// "Save picture": the whole picture at a good size, every label shown, whatever is zoomed or in focus
function wrSavePicture(){
  if(!wr||wr.plan.error)return;
  const {insts}=wr.plan;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const i of insts){if(!wr.pos[i.key])continue;const [x,y]=wr.pos[i.key];x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+i.part.w);y1=Math.max(y1,y+i.part.d);}
  // drawn at 5 px a millimetre and then doubled, so the labels and names are big and sharp too
  const K=2,S=Math.min(6,Math.max(4.5,1800/Math.max(x1-x0,y1-y0))),W=Math.round((x1-x0)*S+180),H=Math.round((y1-y0)*S+200);
  const cv=document.createElement('canvas');cv.width=W*K;cv.height=H*K;
  const v={s:S,ox:90-x0*S,oy:110-y0*S},c=cv.getContext('2d');c.setTransform(K,0,0,K,0,0);
  renderWiring(c,W,H,v,null,true);
  cv.toBlob(b=>WF.downloadBlob('Wiring diagram.png',b));
}
function renderWiringSide(){
  const s=$('wrSide'),P=wr.plan;
  if(P.error){s.innerHTML='<h4>Nothing to wire yet</h4><p>'+esc(P.error)+'</p><div class="ewRow"><button id="wrToWiz">Open the Enclosure Wizard</button></div>';return;}
  const tab=wr.tab,pf=pfOfPlan(P),tabs=['list','code','esphome','ai'].map(t=>`<button data-wrtab="${t}" class="${tab===t?'on':''}">${{list:'Wiring list',code:'Code pins',esphome:(PLATFORMS[pf]||PLATFORMS.esphome).code,ai:'Ask AI'}[t]}</button>`).join('');
  const warn=P.warn.map(w=>{const np=(P.noPinParts||[]).find(p=>w.startsWith(p.label+' has no pin data'));return`<li class="warn"><span class="ic">!</span><span style="color:var(--text)">${esc(w)}</span>${np?` <button class="wrFixPins" data-partid="${esc(np.id)}" style="margin-left:6px;padding:2px 8px;font-size:11px;border-radius:4px;border:1px solid #e67700;background:color-mix(in srgb,#e67700 12%,var(--bg2));color:#e67700;cursor:pointer">Fix: add pins →</button>`:''}</li>`;}).join('');
  const info=P.info.map(w=>`<li class="ok"><span class="ic">✓</span><span style="color:var(--text)">${esc(w)}</span></li>`).join('');
  let body='';
  if(tab==='list'){
    const F=wr.focus;
    body='<div class="ewNote" style="margin:6px 0">Tick each wire as you solder it. Click a line to see just that wire in the picture, or a heading for the whole connection; <b>One wire at a time</b> (over the picture) goes through them in this order.</div>'+P.nets.map((n,k)=>
      `<div class="wrNet${F&&F.type==='net'&&F.k===k?' on':''}" data-net="${k}"><span class="sw${n.kind==='5v'?' dash':''}" style="background:${netColour(n,k)}"></span><b data-netfocus="${k}" title="Show this whole connection">${esc(n.name)}</b>`+
        n.links.map(([ia,ib],j)=>{const a=n.pins[ia],b=n.pins[ib],id=k+'-'+j;return `<div class="wrLink${F&&F.type==='link'&&F.k===k&&F.j===j?' on':''}" data-link="${id}" title="Show just this wire"><input type="checkbox" data-done="${id}"${wr.done[id]?' checked':''}> ${esc(a.inst.label)} <b>${esc(a.pin.n)}</b> → ${esc(b.inst.label)} <b>${esc(b.pin.n)}</b></div>`;}).join('')+'</div>'
    ).join('');
  }else if(tab==='esphome')body=pf==='esphome'?esphPanel():platformCodePanel(pf);
  else if(tab==='ai')body=chatPanel();
  else{
    body=`<h4>ESPHome</h4><textarea readonly class="wrCode" id="wrYml">${esc(P.code.esphome)}</textarea><div class="ewRow"><button data-copy="wrYml">Copy</button></div>
<h4>Arduino</h4><textarea readonly class="wrCode" id="wrIno">${esc(P.code.arduino)}</textarea><div class="ewRow"><button data-copy="wrIno">Copy</button></div>`;
  }
  // tabs first; warnings always shown so the Fix button is accessible on any tab
  const warnHtml=warn||info?`<ul style="list-style:none;padding:0;margin:8px 0">${warn}${info}</ul>`:'';
  s.innerHTML=`<div class="ewRow" style="margin-top:6px">${tabs}</div>`+warnHtml+body;
}
// The ESPHome device tab: a few questions, then the whole file to copy, save or check.
function esphPanel(){
  const P=wr.plan,f=esphForm(),brd=espBoard(P.ctrl.part);
  if(!brd)return `<h4>ESPHome device</h4><p>${esc(P.ctrl.label)} can't run ESPHome: ESPHome needs an ESP32 or ESP8266 board as the controller.</p>`;
  if(!f.name)f.name='My Device';
  const has=r=>P.assigned.some(a=>a.role===r),voice=f.purpose==='voice';
  const buttons=P.assigned.some(a=>a.role==='sig'&&/button|touch|ttp22|push|tact/i.test(a.inst.part.name));
  const opt=(o,v)=>Object.entries(o).map(([k,n])=>`<option value="${k}"${k===v?' selected':''}>${esc(n)}</option>`).join('');
  const r=esphomeYaml(P,f);
  // Restore a previously AI-written result if the same unknown parts are still present (same fingerprint).
  // This prevents the red "needs the AI" banner from reappearing after a re-render or page reload.
  if(!wr.ai&&r.unknown.length){
    try{const stored=JSON.parse(WF.store.get(ESPH_AI_KEY)||'null');
      if(stored&&stored.sig===esphAiSig(r.unknown))wr.ai={yaml:stored.yaml,notes:stored.notes,ok:stored.ok};}
    catch(e){}
  }
  let h=`<h4>ESPHome device</h4>${capHtml(planIssues(P))}<div class="ewNote" style="margin-bottom:6px">Answer a few questions and EvenUCan writes the whole ESPHome file for ${esc(P.ctrl.label)}, with the pins from this wiring.</div>
<label class="ef">Device name <input data-ef="name" value="${esc(f.name)}" maxlength="40"></label>
<label class="ef">What is it for? <select data-ef="purpose">${opt(ESPH_PURPOSES,f.purpose)}</select></label>`;
  if(!voice)h+=`<div class="ef">Works with <label><input type="radio" name="efha" data-ef="ha" value="1"${f.ha?' checked':''}> Home Assistant</label> <label><input type="radio" name="efha" data-ef="ha" value="0"${f.ha?'':' checked'}> on its own (own web page)</label></div>
<label class="ef">Read the sensors every <input data-ef="every" type="number" min="1" max="3600" value="${esc(f.every)}" style="width:60px"> seconds</label>`;
  if(!voice&&has('trig'))h+=`<label class="ef">"Something close" alarm under <input data-ef="alarm" type="number" min="0" max="400" value="${esc(f.alarm)}" style="width:60px"> cm <span class="ewNote">(0 = no alarm)</span></label>`;
  if(voice)h+=`<label class="ef">Wake word <select data-ef="wake">${opt(WAKE_WORDS,f.wake)}</select></label>`;
  if(P.batSense)h+=`<label class="ef">Battery low below <input data-ef="lowbat" type="number" min="2.8" max="4.2" step="0.1" value="${esc(f.lowbat)}" style="width:60px"> V</label>`;
  if(buttons)h+=`<label class="ef">The button <select data-ef="button">${opt(Object.assign({report:'just reports when pressed',light:'turns the light on and off'},voice?{talk:'starts talking to the assistant'}:{}),f.button)}</select></label>`;
  if(brd.led!==undefined)h+=`<label class="ef"><input type="checkbox" data-ef="status"${f.status?' checked':''}> Use the board's own RGB LED as a status light</label>`;
  if(r.error)return h+`<p class="bad" style="margin-top:8px">${esc(r.error)}</p>`;
  if(r.meas.length&&r.lightId){// a reading drives the light
    const cols=r.rgb?Object.keys(RULE_COLOURS):['on','off'],co=v=>cols.map(c=>`<option${c===v?' selected':''}>${c}</option>`).join('');
    const m=r.meas.find(x=>x.id===f.ruleSrc)||r.meas[0];
    h+=`<div class="efbox"><b>Light rule</b> <span class="ewNote">(written into the file, no internet needed)</span><br>
<label><input type="checkbox" data-ef="ruleOn"${f.ruleOn?' checked':''}> The ${r.rgb?'status light':'LED'} is</label> <select data-ef="ruleA">${co(r.rgb?f.ruleA:(f.ruleA==='off'?'off':'on'))}</select>
while <select data-ef="ruleSrc">${r.meas.map(x=>`<option value="${x.id}"${x===m?' selected':''}>${esc(x.label)}</option>`).join('')}</select>
is <select data-ef="ruleOp"><option value="above"${f.ruleOp!=='below'?' selected':''}>above</option><option value="below"${f.ruleOp==='below'?' selected':''}>below</option></select>
<input data-ef="ruleVal" type="number" step="0.1" value="${esc(f.ruleVal)}" style="width:58px"> ${esc(m.unit)}, otherwise <select data-ef="ruleB">${co(r.rgb?f.ruleB:(f.ruleB==='on'?'on':'off'))}</select></div>`;
  }
  const canAI=!!aiKey();
  const unk=r.unknown.map(u=>esc(u.label)).join(', ');
  // When wr.ai is set the AI has already written the code for all unknown parts — replace the red
  // warning with a green tick so the user can see it's been handled.
  const unkBanner=r.unknown.length
    ?(wr.ai
      ?`<div style="background:#e8f5e9;border:2px solid #2e7d32;border-radius:6px;padding:10px 14px;margin-bottom:10px;line-height:1.5">✅ <b>Done!</b> Your AI has sorted out the code for <b>${unk}</b>.<br><span style="font-size:12px;color:#555">Scroll down to see your finished code.</span></div>`
      :`<div style="background:#fff3e0;border:2px solid #e65100;border-radius:6px;padding:10px 14px;margin-bottom:8px;line-height:1.6"><b>⚠️ One thing to do first</b><br>Your design includes <b>${unk}</b> — a part EvenUCan hasn't seen before. Your AI needs to write the code for it.<br><b>👇 Press the red button below to fix this — it only takes a moment.</b></div><div class="ewRow" style="margin-bottom:2px"><button id="wrAiFix" style="font-size:14px;font-weight:bold;padding:8px 20px;background:#c0392b;color:#fff;border:none;border-radius:6px;cursor:pointer;letter-spacing:0.3px"${esphAiBusy||!canAI?' disabled':''}>${esphAiBusy?'⏳ Writing the code — please wait…':'🔧 Fix this part with AI'}</button></div><div style="font-size:12px;color:#888;margin-bottom:10px;margin-top:4px">After pressing, wait a moment — then scroll down to see your code.</div>`)
    :'';
  const _hasUnknown=r.unknown&&r.unknown.length&&!wr.ai;
  const _makeAiBtn=_hasUnknown?'':(`<div class="ewRow" style="margin-top:8px;margin-bottom:4px"><button id="wrAi"${esphAiBusy||!canAI?' disabled':''}>${esphAiBusy?'Writing… please wait':'Make it with AI'}</button>${canAI?'':'<span class="ewNote">Needs a key for this AI: click <b>'+esc(keyLabel())+'</b> above.</span>'}</div>`);
  h+=`<div class="efbox">`+unkBanner+`<b>What should it do?</b> <span class="ewNote">(optional: in your own words; your AI adds it${window.wfNative&&window.wfNative.esphomeCheck?', then ESPHome checks it':''})</span>
<textarea data-ef="desc" rows="3" style="width:100%;margin-top:4px" placeholder="In your own words, e.g. Light the LED red when the temperature is over 28 °C and green when it's fine, and turn on the relay when it's over 30 °C.">${esc(f.desc||'')}</textarea>
<div id="wrAiOut">${wr.aiMsg||''}</div>
`+_makeAiBtn+`<div class="ewRow"><label>AI <select id="wrProv">${Object.entries(PROVIDERS).map(([k,v])=>`<option value="${k}"${aiProv()===k?' selected':''}>${esc(v.name)}${aiKey(k)?' ✓':''}</option>`).join('')}</select></label><button id="wrKey">${keyLabel()}</button></div></div>`;
  h+=`<textarea readonly class="wrCode" id="wrEsp" style="height:200px;margin-top:6px">${esc(esphCurrent(r))}</textarea>
<div class="ewRow"><button id="wrPfIde" class="primary hoMain" title="Put this device into your ESPHome folder, open ESPHome and show each step to get it on the board">Open in ESPHome</button><button class="sec" data-copy="wrEsp">Copy YAML</button><button class="sec" id="wrEspSave">Save .yaml…</button>${window.wfNative&&window.wfNative.esphomeCheck?'<button class="sec" id="wrEspCheck" title="Check the file with the ESPHome on this computer (the same as Validate in ESPHome Device Builder)">Check with ESPHome</button>':''}</div>
<div id="wrEspOut"></div>`+ntfyBox(intentTopic())+(r.warn.length?`<ul style="list-style:none;padding:0;margin:6px 0">${r.warn.map(w=>`<li class="warn"><span class="ic">!</span><span style="color:var(--text)">${esc(w)}</span></li>`).join('')}</ul>`:'')+
`<div class="ewNote" style="margin-top:6px">Click <b>Open in ESPHome</b>: EvenUCan puts this device in your ESPHome folder, opens ESPHome and stays on screen with each step until it is on your board.</div>`;
  return h;
}
// ---- (r3) Arduino and Raspberry Pi: the whole program is written by the user's AI from the idea and this wiring.
// Only when asked (the Generate button, or "Now let's look at the code"); kept until the wiring changes.
let pfCode=null,pfBusy=false,pfMsg='';// pfCode: {pf, sig, code, notes, warn}
// ---- AI countdown timer helpers (shared by pfGenerate and esphWithAI)
let _aiCd=null;
function _cdStart(spanId,secs){
  if(_aiCd)clearInterval(_aiCd);
  let s=secs;
  const show=()=>{const el=document.getElementById(spanId);if(el)el.textContent=s+'s';};
  show();// show immediately, don't wait 1 second
  _aiCd=setInterval(()=>{s--;show();if(s<=0)clearInterval(_aiCd);},1000);
}
function _cdStop(){if(_aiCd){clearInterval(_aiCd);_aiCd=null;}}
// Return a "try a different AI" hint if another provider has a key set up.
function _otherAiHint(){
  const cur=aiProv();
  const others=Object.entries(PROVIDERS).filter(([k])=>k!==cur&&aiKey(k));
  if(!others.length)return '';
  return ' You could try switching to '+others.map(([,v])=>v.name).join(' or ')+'.';
}
// Arduino/Raspberry Pi need their own software on this computer, which (unlike ESPHome) EvenUCan never
// installs or runs anything of - just a presence check, so the Wiring window can point at the download page
// instead of assuming. In the desktop app that's a real check (window.wfNative.checkTool); the web page can't
// see what's on your computer at all, so there it just always offers the link.
let toolCheck={};
function toolLinkHtml(pf){
  const t=PLATFORMS[pf]&&PLATFORMS[pf].tool;if(!t)return '';
  if(window.wfNative&&window.wfNative.checkTool){
    if(!toolCheck[pf]){toolCheck[pf]={checking:true};window.wfNative.checkTool(t.check).then(r=>{toolCheck[pf]=r;if(wrBack.style.display==='grid'&&wr.tab==='esphome')renderWiringSide();});}
    const c=toolCheck[pf];
    if(c.checking)return `<div class="ewNote" style="margin-top:6px">Checking whether ${esc(t.name)} is on this computer…</div>`;
    if(c.found)return '';
  }
  return `<div class="ewNote" style="margin-top:6px">Don't have ${esc(t.name)} yet? You'll need it ${esc(t.why)}: <a href="${esc(t.url)}" target="_blank" rel="noopener">get it from ${esc(new URL(t.url).hostname)}</a>.</div>`;
}
function pfOfPlan(P){
  const part=P.ctrl.part;if(espBoard(part))return (intentNow()||{}).platform==='esp32ide'?'esp32ide':'esphome';
  const mcu=part.mcu||(builtinById(part.id)||{}).mcu||'';
  return /bcm|rp1/.test(mcu)||/raspberry/i.test(part.name)?'raspberrypi':'arduino';
}
const planSig=P=>P.ctrl.part.id+'|'+P.nets.map(n=>n.name+':'+n.pins.map(p=>p.inst.label+'.'+p.pin.n).join(',')).join(';');
const pfFresh=P=>!!(pfCode&&pfCode.pf===pfOfPlan(P)&&pfCode.sig===planSig(P));
const PF_CODE_PROMPT={
  arduino:`You write Arduino sketches for complete beginners. Write ONE complete .ino sketch, ready to compile in the Arduino IDE, for the board and wiring below, that does what the project needs.
Rules:
- Start with a comment block whose first line is "// LIBRARIES_NEEDED:" followed by every library to install from the Arduino IDE Library Manager (its exact Library Manager name), one per line, or "//   (none: only built-in libraries)".
- Then the correct #include lines for everything used (Wire.h for I2C parts, and each library's own header).
- After the #include lines, ONE clearly marked SETTINGS block before setup(), headed "// ===== SETTINGS: everything you may want to change =====". Every value the user could want to edit goes in that block, one per line, each with a short plain-English comment: Wi-Fi name and password, any ntfy topic, the exact message text that gets sent, every pin, and every timing, cooldown or threshold constant. Nothing like that may be buried in loop() or a helper function - the message text in particular must be a named constant (e.g. const char* NTFY_MESSAGE) in this block, never written inline where it is sent.
- A #define for every pin the code uses, inside the SETTINGS block, with the EXACT pin numbers from the wiring below (Arduino pins 14-17 are A0-A3; I2C parts use the board's own SDA/SCL through Wire, so no #define for them).
- setup() and loop(), plus small helper functions with clear names. Plain-English comments explaining each step to someone who has never coded.
- Use only the parts in the wiring. Use millis() timing instead of long delay() calls when buttons or beeps must react.
- You MUST make the code do EVERY requirement listed under "Requirements". Never silently leave one out, never replace one with a comment, and never write a comment saying something isn't possible. If a requirement truly cannot be met with this board and these parts, write NO code: return {"refuse":true,"reason":"<one plain-English sentence: which requirement, and why>"} instead.
Return ONLY a JSON object: {"code":"<the complete sketch>","notes":"<two to four short plain-English sentences: what it does, which libraries to install, anything to adjust or calibrate>"}.`,
  raspberrypi:`You write Python 3 programs for a Raspberry Pi 4 (Raspberry Pi OS) for complete beginners. Write ONE complete program for the wiring below that does what the project needs.
Rules:
- The first line is exactly "#!/usr/bin/env python3".
- Then a comment block starting with "# Requirements (install with pip):" listing each pip package, one per line as "#   pip install <name>" (e.g. RPi.GPIO, smbus2, luma.oled, requests), plus any "sudo raspi-config" step needed (e.g. turn on I2C).
- Use BCM GPIO numbers EXACTLY as in the wiring below (GPIO.setmode(GPIO.BCM)); I2C parts are on bus 1.
- Small functions with clear names (e.g. read_tilt(), show_on_screen(), beep()) and a main() with the main loop.
- Wrap the main loop in try/finally and call GPIO.cleanup() (and close any I2C bus or display) in the finally block, so stopping it with Ctrl+C leaves the pins safe. Handle KeyboardInterrupt quietly.
- Plain-English comments for someone who has never coded. Use only the parts in the wiring. Put every setting in ONE clearly marked block near the top, after the imports, headed "# ===== SETTINGS: everything you may want to change =====": Wi-Fi details, API keys, topics, the exact message text that gets sent, pin numbers, timings and thresholds, each on its own line with a short comment. Nothing editable may be buried in a function - the message text in particular must be a named constant (e.g. NTFY_MESSAGE) in this block, never written inline where it is sent.
- You MUST make the code do EVERY requirement listed under "Requirements". Never silently leave one out, never replace one with a comment, and never write a comment saying something isn't possible. If a requirement truly cannot be met with this board and these parts, write NO code: return {"refuse":true,"reason":"<one plain-English sentence: which requirement, and why>"} instead.
Return ONLY a JSON object: {"code":"<the complete program>","notes":"<two to four short plain-English sentences: what it does, how to install and run it, anything to adjust>"}.`
};
PF_CODE_PROMPT.esp32ide=PF_CODE_PROMPT.arduino;// (wizard-r2) an ESP32 programmed with the Arduino IDE: the same sketch writer
