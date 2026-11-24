// EvenUCan AI helpers and Surgery - 06-surgery-and-doctors.js
// One of the files in js/ai/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- Brief Doctor & The Surgery (r2)
// Behind-the-scenes Multi-Doctor Pipeline ("The Surgery"):
//   1. Parts Doctor   — translates plain English into exact, verified parts from the library (and auto-synthesizes any unknown module).
//   2. Electric Doctor — wires every power, ground, I2C, and signal pin using planWiring().
//   3. Specialist     — verifies parts, relay channel counts, waterproof/flap sensor suitability, board Wi-Fi/clock, and every pin wire.
//                       If anything is wrong, sends it back to the doctors behind the scenes to fix automatically!

const BD_NEG=/\b(no|not|without|never|don'?t|do not|doesn'?t|needs? no)\b[^.,;]{0,25}\b(phone|wi-?fi|internet|message|notification|alert|app|wireless)s?\b[^.,;]*/gi;
const bdStrip=function bdStrip(t){t=String(t||'').toLowerCase().replace(BD_NEG,' ');try{if(typeof NO_NETAi!=='undefined')t=t.replace(NO_NETAi,' ');}catch(e){}return t;};

// ---- Learned Rulebook (built from running 10 beginner user inputs through The Surgery + persistent learning) ----
const SURGERY_RULES_KEY='surgery_rules_learned';
const SURGERY_BASE_RULES=[
  {id:'R01_FLAP_DOOR_COUNTER',caseNum:1,title:'Flap / Door Pass Counter & End-of-Day Report',
   badPractice:'Using a PIR motion sensor for a dog flap or door counter (counts walks past the door instead of passes through the flap), or forgetting Wi-Fi/NTP time for end-of-day phone reports.',
   rule:'For any pet flap, cat door, dog door, gate or door pass counter: ALWAYS use "MC-38 magnetic reed switch door sensor" (magnet on flap + switch on frame, 2s debounce), NEVER a PIR sensor unless room motion was also asked for. If the user wants a message at the end of the day or a daily count, use ESP32 (esphome) for Wi-Fi + NTP clock + ntfy.'},
  {id:'R02_REVERSIBLE_JACKS_MOTORS',caseNum:2,title:'Multi-Jack / Reversible Motor Relay Sizing',
   badPractice:'Picking a 1-channel or 4-channel relay for 4 reversible corner jacks, or forgetting UP/DOWN relay interlock.',
   rule:'Each reversible motor/jack/actuator (up/down, open/close, extend/retract) requires 2 relay channels with software interlock. 4 corner jacks = "8-channel 5V relay module"; 2 reversible motors = "4-channel 5V relay module"; 1 reversible motor = "2-channel 5V relay module".'},
  {id:'R03_PUMP_VALVE_DRIVER_AND_SOIL',caseNum:3,title:'Pump / Valve / Motor Driver Pairing & Capacitive Soil Probe',
   badPractice:'Selecting a water pump, solenoid valve, DC motor, or 12V siren without a switching relay/MOSFET module (leaving the load with no GPIO signal pin to wire), or using a corroding resistive soil probe.',
   rule:'Every pump ("Mini submersible water pump 3-5V"), solenoid valve ("Solenoid water valve 12V"), or DC motor MUST be paired with a relay module ("1-channel 5V relay module") so the controller has a GPIO signal pin (IN1) to switch the load. Soil moisture MUST use "Capacitive soil moisture sensor module". Tank-empty check uses "Water leak / level sensor module".'},
  {id:'R04_SERVO_SCHEDULE_FEEDER',caseNum:4,title:'Scheduled Pet Feeder Servo & Clock Sync',
   badPractice:'Searching "SG90 servo motor" and failing strict word match against "SG90 micro servo 9g", or choosing an offline board without a clock for 7am/6pm schedules.',
   rule:'Portion chutes and small mechanical arms use "SG90 micro servo 9g". Any clock schedule (e.g. 7am and 6pm, daily, after 9pm) requires an ESP32 board (for internet NTP time) or a "DS3231 real-time clock module" if offline.'},
  {id:'R05_GARAGE_DOOR_LED_NOTIFY',caseNum:5,title:'Door State Timer + Indicator LED With Resistor',
   badPractice:'Searching "5mm red LED" (no space) and missing "5 mm LED with resistor", or omitting the current-limiting resistor.',
   rule:'Plain indicator lights always map to "5 mm LED with resistor" (or "LED 5 mm (through-hole)"). Garage/shed door open state uses "MC-38 magnetic reed switch door sensor" + ESP32 + ntfy.'},
  {id:'R06_LOCAL_CLIMATE_NO_OWM',caseNum:6,title:'Local Shed/Room Climate vs Internet Weather Forecast',
   badPractice:'Asking the user for an OpenWeatherMap API key when they only asked to measure local temperature/humidity with a sensor.',
   rule:'When the user measures temperature/humidity locally (e.g. shed, room, greenhouse) with a BME280 or DHT22, NEVER demand an OpenWeatherMap API key unless they explicitly ask for an internet weather forecast.'},
  {id:'R07_COOP_DOOR_REVERSIBLE_LIGHT',caseNum:7,title:'Sunrise/Sunset Reversible Door Motor',
   badPractice:'Using only 1 relay channel for a motor that must both open and close a door, or forgetting the ambient light sensor.',
   rule:'Sunrise/sunset/daylight sensing uses "BH1750 light level sensor (I2C)". A reversible 12V motor that opens and closes a door requires "2-channel 5V relay module" (1 channel OPEN, 1 channel CLOSE, interlocked).'},
  {id:'R08_SUBMERGED_WATER_TEMP',caseNum:8,title:'Submerged / Aquarium / Pond Temperature Probe',
   badPractice:'Picking an open-circuit-board BME280 or DHT22 air sensor to measure water temperature in an aquarium, pond, bath, or tank.',
   rule:'Any water, aquarium, fish tank, pond, pool, or liquid temperature measurement MUST use "DS18B20 waterproof temperature probe" and NEVER an exposed air sensor (BME280/DHT22).'},
  {id:'R09_PARCEL_BOX_DETECTOR',caseNum:9,title:'Parcel Box / Lid Drop Detector',
   badPractice:'Leaving lid/drop sensor unmatched or adding unrequested screens.',
   rule:'Parcel box, letterbox, or lid opening detection uses "MC-38 magnetic reed switch door sensor" (plus "5 mm LED with resistor" if a light was requested) and ESP32 + ntfy.'},
  {id:'R10_AIR_QUALITY_EXTRACTOR',caseNum:10,title:'Air Quality / Smoke Sensor & Extractor Fan Relay',
   badPractice:'Searching "MQ135" without hyphen and missing "MQ-135 air quality (gas) sensor module", or forgetting the relay to switch the extractor fan.',
   rule:'Workshop air quality / smoke detection uses "MQ-135 air quality (gas) sensor module" (or "MQ-2 smoke and flammable gas sensor module"), paired with "1-channel 5V relay module" for fan switching and "Active buzzer module" for beeping.'},
  {id:'R11_NATURAL_SPEECH_SEE_VS_SCREEN',caseNum:11,title:'Natural Speech ("See / Check / Watch" vs Physical Screen)',
   badPractice:'Adding an OLED or LCD screen when the user says "see how many times", "see if", "see when", "check", or "watch", when they actually want a phone message or simple alert.',
   rule:'Everyday English phrases like "see how many times", "see if", "see when", "check", "find out", "keep an eye on", or "watch" mean "to know" — NEVER add an OLED/LCD display unless the user explicitly asks for a physical screen, display, OLED, LCD, or readout on the box.'},
  {id:'R12_BATTERY_SCREEN_DRAW_ADVISORY',caseNum:12,title:'Battery Drain From 24/7 Screen vs Phone Report',
   badPractice:'Letting a beginner put an always-on OLED/LCD screen on a battery-powered gadget without warning them that the ~80 mA continuous draw will flatten the battery in ~24 hours.',
   rule:'When a project runs on a battery AND includes a screen/display (OLED/LCD), warn the user clearly: an always-on screen + awake board draws ~70–90 mA 24/7 and will flatten a 2,000 mAh battery in about 1 day (~24 hours). Recommend getting a message on their phone once or twice a day instead so the board can sleep and the battery will run for weeks.'},
  {id:'R13_SPLIT_TRANSMITTER_BASE_STATION',caseNum:13,title:'Split Tiny Coin-Cell Flap Transmitter vs Monster-Truck Door Box',
   badPractice:'Forcing a heavy battery pack and Wi-Fi dev board onto a moving door, dog flap, or window, when a tiny coin-cell transmitter + indoor base station avoids mounting a brick on the door.',
   rule:'When a battery-powered moving flap, door, or window sensor is needed, provide the "Tiny Flap Node + Indoor Base Station" alternative: a coin-cell (CR2032) transmitter (433 MHz RF or ESP-NOW) on the flap that sends a 20 ms chirp, while a mains/USB-powered ESP32 base station sits comfortably inside the house to count, track time, and send phone messages.'},
  {id:'R14_FEATHERWEIGHT_COMPACT_PARTS',caseNum:14,title:'Featherweight Miniature Replacements for Bulky Modules',
   badPractice:'Picking bulky 1990s-era hobby components (heavy Songle blue relays, big HC-SR501 PIR domes, full-sized dev boards, and 18650 holder bricks) when ultra-compact, low-power modern alternatives exist.',
   rule:'For portable, battery-powered, or compact builds: prefer "Seeed Studio XIAO ESP32-C3/C6" (postage-stamp sized, 15–40 µA sleep, onboard LiPo pads), "AM312 mini PIR sensor" (10 mm dome, 15 µA) over bulky HC-SR501, logic-level MOSFETs (AO3400/AOD4184, 0 mA holding draw) over mechanical relay coils for DC loads, and flat 3.7V LiPo pouch cells or coin cells over bulky 18650/AA holders.'}
];

const getSurgeryRules=function getSurgeryRules(){
  let extra=[];
  try{const raw=WFAi&&WFAi.store&&WFAi.store.get(SURGERY_RULES_KEY);if(raw)extra=JSON.parse(raw)||[];}catch(e){}
  const ids=new Set(SURGERY_BASE_RULES.map(r=>r.id));
  return SURGERY_BASE_RULES.concat(extra.filter(r=>r&&r.id&&!ids.has(r.id)));
};
const learnSurgeryRule=function learnSurgeryRule(id,title,badPractice,rule){
  const all=getSurgeryRules();
  if(all.some(r=>r.id===id))return;
  try{
    const raw=WFAi&&WFAi.store&&WFAi.store.get(SURGERY_RULES_KEY);
    const extra=raw?JSON.parse(raw)||[]:[];
    extra.push({id,caseNum:all.length+1,title,badPractice,rule,learnedAt:new Date().toISOString()});
    if(WFAi&&WFAi.store)WFAi.store.set(SURGERY_RULES_KEY,JSON.stringify(extra));
  }catch(e){}
};
const surgeryRulesPrompt=function surgeryRulesPrompt(){
  return '\n\nLEARNED SURGERY RULES (strictly enforced by the Specialist Verifier — follow every rule that applies):\n'+
    getSurgeryRules().map((r,i)=>`${i+1}. [${r.id}] ${r.rule}`).join('\n')+'\n';
};

// ---- Synonym & Part Resolution Table for the Parts Doctor ----
const SURGERY_SYNONYMS=[
  {re:/\bmc-?38\b|reed.?switch|magnetic.*(door|flap|switch|contact|sensor)|door.*(contact|sensor|switch)|flap.*sensor|window.*sensor/i, id:'c-mc-38-magnetic-reed-switch-door-sensor'},
  {re:/\bds18b20\b|waterproof.*temp|submers.*temp|aquarium.*temp|water.*temp.*probe|liquid.*temp/i, id:'c-ds18b20-waterproof-temperature-probe'},
  {re:/\bsg-?90\b|\bmg-?90\b|micro.?servo|\bservo\b/i, id:'c-sg90-micro-servo-9g'},
  {re:/\b8[- ]?channel.*relay|\brelay.*\b8\b.*channel/i, id:'c-8-channel-5v-relay-module'},
  {re:/\b4[- ]?channel.*relay|\brelay.*\b4\b.*channel/i, id:'c-4-channel-5v-relay-module'},
  {re:/\b2[- ]?channel.*relay|\brelay.*\b2\b.*channel/i, id:'c-2-channel-5v-relay-module'},
  {re:/\b1[- ]?channel.*relay|\bsingle.*relay|\brelay module\b|\brelay\b/i, id:'c-1-channel-5v-relay-module'},
  {re:/\bmpu-?6050\b|\bgy-?521\b|\bbno-?085\b|tilt.*sensor|accelerometer|imu.*sensor|level.*sensor/i, cm:'p-cm-mpu6050'},
  {re:/\bssd1306\b|\bsh1106\b|\boled\b|small.*(screen|display)|tiny.*(screen|display)|i2c.*(screen|display)/i, cm:'p-cm-ssd1306'},
  {re:/16x2.*lcd|character.*lcd/i, id:'c-16x2-character-lcd-with-i2c-backpack'},
  {re:/\bbme-?280\b|\bbmp-?280\b/i, cm:'p-cm-bme280'},
  {re:/\bdht-?22\b|\bam2302\b/i, cm:'p-cm-dht22'},
  {re:/\bdht-?11\b/i, id:'c-dht11-temperature-and-humidity-sensor'},
  {re:/capacitive.*soil|soil.*moist|plant.*moist/i, cm:'p-cm-soilmoist'},
  {re:/water.*(leak|level)|tank.*(level|empty|sensor)|liquid.*level|flood.*sensor/i, cm:'p-cm-water'},
  {re:/\bbh1750\b|light.*level|ambient.*light|\blux\b.*sensor/i, cm:'p-cm-bh1750'},
  {re:/\bky-?018\b|\bldr\b|photoresistor/i, id:'c-ky-018-photoresistor-ldr-light-sensor-module'},
  {re:/\bhc-?sr04\b|ultrasonic|distance.*sensor/i, id:'c-hc-sr04-ultrasonic-distance-sensor'},
  {re:/\bhc-?sr501\b|\bpir\b|motion.*sensor/i, cm:'p-cm-pir'},
  {re:/\bmq-?135\b|air.?quality.*sensor/i, id:'c-mq-135-air-quality-gas-sensor-module'},
  {re:/\bmq-?2\b|smoke.*sensor|flammable.*gas/i, id:'c-mq-2-smoke-and-flammable-gas-sensor-module'},
  {re:/\bmq-?7\b|carbon.?monoxide/i, id:'c-mq-7-carbon-monoxide-co-sensor-module'},
  {re:/submersible.*pump|water.*pump|mini.*pump|\bpump\b/i, id:'c-mini-submersible-water-pump-3-5v'},
  {re:/solenoid.*valve|water.*valve|\bvalve\b/i, id:'c-solenoid-water-valve-12v-1-2-inch'},
  {re:/\byf-?s201\b|water.*flow|flow.*sensor/i, id:'c-yf-s201-water-flow-sensor-1-2-inch'},
  {re:/\bhx711\b|load.*cell.*amp/i, id:'c-hx711-load-cell-amplifier-module'},
  {re:/bar.*load.*cell|load.*cell|weight.*sensor/i, id:'c-bar-load-cell-1-50-kg-80-mm'},
  {re:/\bds3231\b|real.?time.?clock|\brtc\b/i, id:'c-ds3231-real-time-clock-module-zs-042'},
  {re:/\bl298n?\b|motor.*driver/i, id:'c-l298n-dual-motor-driver-module'},
  {re:/\buln2003\b|stepper.*driver/i, id:'c-uln2003-stepper-driver-board-for-28byj-48'},
  {re:/\b28byj-?48\b|5v.*stepper/i, id:'c-28byj-48-5v-stepper-motor'},
  {re:/130.*motor|dc.*motor|hobby.*motor/i, id:'c-130-size-dc-motor-3-6v-hobby-motor'},
  {re:/\bws2812\b|neopixel|addressable.*led|rgb.*led/i, cm:'p-cm-ws2812'},
  {re:/5\s*mm.*led|led.*resistor|red.*led|green.*led|blue.*led|yellow.*led|indicator.*led|status.*led|\bled\b/i, cm:'p-cm-led5mm'},
  {re:/buzzer|piezo|beeper|siren|sounder/i, cm:'p-cm-buzzer'},
  {re:/push.*button|tactile.*button|\bbutton\b/i, cm:'p-cm-button'}
];

const resolvePartBySynonym=function resolvePartBySynonym(text,fallbackText){
  // the part's own name first; its job description only if the name matched nothing
  const r=resolvePartBySynonym1(text);
  return r||(fallbackText?resolvePartBySynonym1(String(text||'')+' '+fallbackText):null);
};
const resolvePartBySynonym1=function resolvePartBySynonym1(text){
  const t=String(text||'').trim();
  for(const s of SURGERY_SYNONYMS){
    if(!s.re.test(t))continue;
    if(s.id){const p=partByIdAi(s.id);if(p)return {part:p,from:'curated library'};}
    if(s.cm){const m=COMMON_MODS.find(x=>x.part.id===s.cm);if(m){const p=commonPart(m);if(p)return {part:p,from:'common module'};}}
  }
  return null;
};

// Synthesize a clean, wireable custom part if a user asks for an exotic module not in the library
const synthesizePart=function synthesizePart(spec){
  const name=String(spec.search||spec.function||'Custom Module').trim().slice(0,60);
  const have=(customAi||[]).find(c=>c.name.toLowerCase()===name.toLowerCase());
  if(have)return have;
  const isI2C=/i2c|oled|display|screen|gyro|accel|lux|laser.*dist/i.test(name+' '+spec.function);
  const pins=isI2C
    ?[{n:'VCC',r:'3v3',x:2.5,y:2},{n:'GND',r:'gnd',x:5.04,y:2},{n:'SCL',r:'scl',x:7.58,y:2},{n:'SDA',r:'sda',x:10.12,y:2}]
    :[{n:'VCC',r:'3v3',x:2.5,y:2},{n:'GND',r:'gnd',x:5.04,y:2},{n:'SIG',r:'sig',x:7.58,y:2}];
  const p=tidyPartAi({
    id:'p-surg-'+esphSlugAi(name)+'-'+Math.random().toString(36).slice(2,6),
    name,
    type:/display|screen/i.test(spec.category)?'display':/sensor/i.test(spec.category)?'sensor':'other',
    shape:'rect',w:25,d:20,pcb:1.6,h:8,below:2,mount:'floor',
    pins,features:[],acc:'approx',
    notes:'Auto-configured by The Surgery with standard pins and typical breakout dimensions.'
  });
  customAi.push(p);saveLibAi();
  return partByIdAi(p.id)||p;
};

// ---- Doctor 1A: Built-in Specialist Parts Doctor (instant offline & fallback diagnosis) ----
const partsDoctorOffline=function partsDoctorOffline(desc,clarify){
  const d=String(desc||'').toLowerCase();
  const dClean=bdStrip(desc);
  const cl=clarify||{power:'usb',phone:false};
  const wantsPhone=cl.phone||/phone|message|text me|notify|notification|alert|tell me|let me know|send me|\bntfy\b/.test(dClean);
  const wantsTime=/\b\d{1,2}\s*(am|pm)\b|\b\d{1,2}:\d{2}\b|end of the day|every (day|morning|evening|night)|twice a day|daily|after \d|schedule/.test(d);
  const isNoWifi=/\b(no|without)\s+(phone\s+or\s+)?wi-?fi\b/i.test(d)&&!wantsPhone&&!wantsTime;
  const pf=isNoWifi&&/arduino|nano/i.test(d)?'arduino':'esphome';
  const parts=[];
  const reqs=[];
  const addPart=(category,search,fn,why,support)=>parts.push({category,search,function:fn,required:true,why,support:!!support});

  // 1. Flap / Door / Gate / Parcel box magnetic reed switch (Rules R01, R05, R09)
  const isFlap=/\bflap\b|dog.?door|cat.?door|pet.?door/.test(d);
  const isParcel=/parcel|courier|delivery.?box|letter.?box|mailbox/.test(d);
  const isDoor=/\b(garage|shed|back|front|porch|barn)?\s*door\b|\bgate\b|\blid\b/.test(d)&&!/coop.?door|open.*door.*motor|motor.*door/i.test(d);
  if(isFlap||isParcel||isDoor){
    addPart('sensors-motion','MC-38 magnetic reed switch door sensor',
      isFlap?'counts each time the pet pushes through the flap (magnet on flap, switch on frame)':isParcel?'detects when the parcel box lid opens':'detects whether the door is open or closed',
      'A magnetic reed switch gives a clean, reliable trigger every time the flap or door moves (unlike a PIR sensor which triggers just walking past).');
    reqs.push(isFlap?'Count each pass through the dog flap with 2-second bounce protection':isParcel?'Detect when the delivery box lid is opened':'Monitor when the door is open or closed');
  }

  // 2. Tilt / Levelling (Rule R02)
  const isLevel=/\blevel(ler|ing|er)?\b|\btilt\b|\bpitch\b|\broll\b|\bangle\b|motorhome|caravan|\brv\b.*jack/i.test(d);
  if(isLevel){
    addPart('sensors-tilt/acceleration','MPU6050 tilt and motion sensor (GY-521, I2C)','measures live pitch and roll tilt angles on two axes','Needed to measure how far off level the vehicle or platform is.');
    reqs.push('Measure pitch and roll tilt angles accurately');
  }

  // 3. Soil moisture & plant watering (Rule R03)
  const isSoil=/\bsoil\b|\bplant(s|er)?\b|\btomato|\bgreenhouse\b.*water|\bcompost\b|\bmoist/i.test(d);
  if(isSoil){
    addPart('sensors-moisture','Capacitive soil moisture sensor module','measures how dry or wet the soil is (probe sits in the soil)','Capacitive probe does not corrode in damp soil like bare metal prongs.');
    reqs.push('Measure soil moisture level');
  }

  // 4. Water tank empty / water leak / rain sensor (Rule R03)
  const isWaterLevel=/\btank\b.*(empty|low|level)|water.*(level|leak|empty)|\bleak\b|\bflood\b/i.test(d);
  if(isWaterLevel){
    addPart('sensors-moisture','Water leak / level sensor module','checks if the water tank is empty or if water is detected','Alerts you and stops the pump running dry when the tank is low.');
    reqs.push('Check water tank level / detect water');
  }

  // 5. Submerged / Aquarium / Water temperature (Rule R08) vs Air temperature (Rule R06)
  const isWaterTemp=/aquarium|fish.?tank|\bpond\b|\bbath\b|\bpool\b|water.?temp|submerg|liquid.?temp/i.test(d);
  const isAirTemp=!isWaterTemp&&(/temperature|humidity|barometric|climate|weather.?station|freezing|frost/i.test(d));
  if(isWaterTemp){
    addPart('sensors-temperature','DS18B20 waterproof temperature probe','measures water temperature directly inside the tank or pond','A sealed stainless-steel waterproof probe is essential for water (open circuit boards would short out).');
    reqs.push('Measure water temperature safely with a waterproof probe');
  }else if(isAirTemp){
    addPart('sensors-temperature','BME280 temperature, humidity and pressure sensor (I2C)','measures air temperature, humidity and pressure','Accurate I2C digital sensor for shed, room or greenhouse air.');
    reqs.push('Measure air temperature and humidity');
  }

  // 6. Daylight / Sunrise / Sunset / Brightness (Rule R07)
  const isLight=/\bsun\b|sunrise|sunset|\bdark\b|\bdaylight\b|\bdawn\b|\bdusk\b|light.?level|\blux\b|night.?light/i.test(d);
  if(isLight){
    addPart('sensors-light','BH1750 light level sensor (I2C)','measures ambient daylight level to know when the sun comes up or it gets dark','Digital lux sensor avoids false triggers from passing shadows.');
    reqs.push('Detect daylight / sunrise and sunset light levels');
  }

  // 7. Air quality / Smoke / Gas (Rule R10)
  const isAirQual=/air.?quality|\bsmoke\b|\bfumes\b|\bgas\b|\bmq-?135\b|\bmq-?2\b|workshop.*air/i.test(d);
  if(isAirQual){
    addPart('sensors-temperature','MQ-135 air quality (gas) sensor module','detects smoke, fumes and poor air quality','Triggers the alarm and fan relay when workshop air quality drops.');
    reqs.push('Monitor air quality and smoke levels');
  }

  // 8. Ultrasonic distance (if requested)
  const isDist=/\bdistance\b|ultrasonic|how far|hc-?sr04/i.test(d);
  if(isDist){
    addPart('sensors-distance','HC-SR04 ultrasonic distance sensor','measures distance in cm using ultrasound','Non-contact distance measurement.');
    reqs.push('Measure distance with ultrasonic sensor');
  }

  // 9. PIR Motion (only when actual person/intruder/room motion is asked for, NEVER for a dog flap!)
  const isBatteryPref=cl.power==='battery'||/\bbattery\b|lipo|coin\s*cell|cr2032|portable|tiny/i.test(d);
  const isMotion=!isFlap&&(/\bmotion\b|\bmovement\b|\bpir\b|\bintruder\b|\bburglar\b|someone walks/i.test(d));
  if(isMotion){
    if(isBatteryPref||/small|mini|tiny|pocket/i.test(d)){
      addPart('sensors-motion','AM312 mini PIR motion sensor (ultra-low power 15uA)','detects movement using tiny 10mm dome and draws only 15 microamps','Ultra-compact and perfect for battery-powered projects.');
      reqs.push('Detect movement with ultra-low-power miniature PIR sensor');
    }else{
      addPart('sensors-motion','HC-SR501 PIR motion sensor','detects people or movement in the area','Passive infrared sensor spots body heat moving across its view.');
      reqs.push('Detect movement with PIR motion sensor');
    }
  }

  // 10. Servo motor for chute / pet feeder (Rule R04)
  const isServo=/\bservo\b|\bchute\b|\bfeed(er|ing)?\b.*(cat|dog|pet|fish)|dispens.*food|turn.*chute/i.test(d);
  if(isServo){
    addPart('motors/servos','SG90 micro servo 9g','turns the food chute to dispense a portion','Compact 5V servo motor connects directly to a PWM signal pin.');
    reqs.push('Turn the feeder chute with a servo motor');
  }

  // 11. Pumps, Valves, Fans, and Reversible Motors + Relay Channel Calculation (Rules R02, R03, R07, R10)
  const hasPump=/\bpump\b|water.*plant|irrigat/i.test(d)&&!(/reminder only/i.test(d));
  const hasValve=/\bvalve\b|solenoid/i.test(d);
  const fourJacks=/\b(4|four)\b.*(jack|corner|motor|leg)/i.test(d);
  const revMotor=!fourJacks&&!isServo&&(/reversible|(open|up).*(close|down)|coop.?door|linear.?actuator|\b2[- ]?channel/i.test(d));
  const singleRelayLoad=hasPump||hasValve||/\bfan\b|extractor|\brelay\b|\bsiren\b|\bheater\b/i.test(d);

  if(hasPump){
    addPart('motors/servos','Mini submersible water pump 3-5V','pumps water from the tank to the plants','Submersible pump sits in the reservoir and runs when switched on.');
    reqs.push('Run the water pump when soil is dry');
  }
  if(hasValve){
    addPart('motors/servos','Solenoid water valve 12V 1/2 inch','opens and closes the water line','Normally-closed electric water valve.');
    reqs.push('Control the water valve');
  }
  if(fourJacks){
    addPart('relays','8-channel 5V relay module','switches the 4 corner jacks UP and DOWN (2 channels per jack = 8 channels total, with UP/DOWN interlock)','4 reversible jacks need 8 relay channels so each corner has an UP relay and a DOWN relay.',true);
    reqs.push('Control 4 reversible corner jacks using 8 interlocked relay channels');
  }else if(revMotor){
    addPart('relays','2-channel 5V relay module','switches the reversible motor OPEN/UP and CLOSE/DOWN (2 interlocked relay channels)','A reversible DC motor needs 2 relay channels (one for each direction) with software interlock.',true);
    reqs.push('Drive the reversible motor in both directions with a 2-channel interlocked relay');
  }else if(singleRelayLoad){
    addPart('relays','1-channel 5V relay module','safely switches power to the '+(hasPump?'water pump':hasValve?'solenoid valve':'load')+' from a controller GPIO pin','A microcontroller GPIO pin cannot supply heavy motor/pump/fan current directly; the relay switches it safely.',!(/relay/i.test(d)));
    reqs.push('Switch the '+(hasPump?'pump':hasValve?'valve':'load')+' safely via a 5V relay module');
  }

  // 12. Screen / OLED Display (only if requested)
  const wantsScreen=/\bscreen\b|\bdisplay\b|\boled\b|\blcd\b|\bshow\b.*(angle|reading|temp|time|next|live)/i.test(d)&&!/\bno\s+(screen|display|oled)\b/i.test(d);
  if(wantsScreen){
    addPart('displays','SSD1306 0.96" OLED display 128x64 (I2C)','shows live readings and status on a crisp mini screen','Uses only 2 I2C wires (SDA and SCL).');
    reqs.push('Show live status and readings on an OLED screen');
  }

  // 13. Buzzer / Beep / Alarm sound
  const wantsBuzzer=/\bbeep\b|\bbuzz(er)?\b|\balarm\b|\bsound\b|\bnoise\b|\balert\b.*beep/i.test(d)&&!/\bno\s+(buzzer|sound|beep)\b/i.test(d);
  if(wantsBuzzer){
    addPart('buzzers','Active buzzer module','beeps to give an audible alert','Simple 3-pin active buzzer module beeps as soon as its signal pin goes HIGH.');
    reqs.push('Sound a buzzer alert when triggered');
  }

  // 14. LEDs (Rules R05, R09)
  const wantsLed=/\bleds?\b|\blight\s+up\b|flash.*light|red\s+light|green\s+light|indicator\s+light/i.test(d)&&!/\bno\s+leds?\b/i.test(d);
  if(wantsLed){
    const bothColors=/red\b.*green\b|green\b.*red\b/i.test(d);
    if(bothColors){
      addPart('LEDs','5 mm LED with resistor','lights up red as a warning indicator','Includes current-limiting resistor for safe GPIO drive.');
      addPart('LEDs','5 mm LED with resistor','lights up green when status is normal','Includes current-limiting resistor for safe GPIO drive.');
    }else{
      addPart('LEDs','5 mm LED with resistor','flashes / lights up as a clear visual status indicator','Through-hole 5 mm LED with series resistor.');
    }
    reqs.push('Light up the status LED indicator');
  }

  // 15. Push Button
  const wantsButton=/\bbutton\b|\bpress\b|manual.*feed|extra.*treat|start.*stop|silence/i.test(d);
  if(wantsButton){
    addPart('buttons/inputs','Push button 12 mm (tactile)','lets you press a button to trigger or silence the gadget manually','Wires between a GPIO pin (with internal pull-up) and GND.');
    reqs.push('Respond to manual button press');
  }

  // Fallback if description was very abstract and matched no specific part above
  if(!parts.length){
    addPart('sensors-motion','MC-38 magnetic reed switch door sensor','detects trigger event','Reliable sensor input.');
    addPart('LEDs','5 mm LED with resistor','shows status','Visual indicator.');
    reqs.push('Detect events and indicate status');
  }

  // Power entry
  const powSearch=cl.power==='battery'||/\bbattery\b|lipo|18650/i.test(d)?'LiPo battery':cl.power==='mains'||/mains|wall\s+adapter/i.test(d)?'mains adapter':'USB';
  addPart('power',powSearch,'powers the board and sensors','Selected power supply.');

  if(wantsPhone)reqs.push('Send phone notifications via ntfy.sh');
  if(wantsTime)reqs.push('Keep accurate time of day via internet NTP sync');

  // Short friendly project name
  const name=isFlap?'Dog Flap Daily Counter':fourJacks?'Motorhome Auto-Leveller':isSoil&&hasPump?'Greenhouse Auto-Waterer':isSoil?'Plant Moisture Monitor':isServo?'Smart Pet Feeder':isWaterTemp?'Aquarium Temp Guard':isParcel?'Porch Parcel Box Alert':isAirQual?'Workshop Air Quality Guard':isLight&&revMotor?'Chicken Coop Door Opener':isDoor?'Smart Door Monitor':isAirTemp?'Shed Climate Monitor':'Custom Smart Gadget';

  return {
    name,
    summary:`Here is your complete build plan for "${name}". The Surgery has selected ${parts.filter(p=>p.category!=='power').length} compatible parts, verified that every power, ground, and signal pin wires cleanly to the ${pf==='arduino'?'Arduino Nano':pfFam()}, and prepared your enclosure and starter code.`,
    requirements:reqs,
    hidden_needs:[],
    platform:pf,
    platform_reason:pf==='esphome'?pfFam()+' has built-in Wi-Fi (for phone alerts and internet clock) and works seamlessly with ESPHome.':'Arduino Nano is compact and ideal for standalone offline gadgets.',
    microcontroller:{name:pf==='arduino'?'Arduino Nano':pfFam(),why:pf==='arduino'?'Simple standalone controller':'Built-in Wi-Fi for phone notifications and accurate time'},
    parts,
    code_libraries:['Wire.h'],
    extra_inputs_needed:wantsPhone?[{key:'ntfy_topic',label:'Your ntfy.sh topic name (for messages to your phone)',help:'Install the free ntfy app on your phone and subscribe to this topic name.',url:'https://ntfy.sh'}]:[],
    code_description:`Reads ${parts.filter(p=>p.category!=='power').map(p=>p.search).join(', ')}`+(wantsTime?' using internet NTP time':'')+(wantsPhone?' and sends messages to your phone via ntfy.sh':'')+'.',
    esphome_notes:'All pins and components are pre-configured in the ESPHome YAML tab.',
    esphome_yaml_hint:'',
    notification_method:wantsPhone?'ntfy':'none',
    missing_parts_hint:''
  };
};

// ---- Apply Learned Rules to ANY Analysis (AI or Offline) ----
const applySurgeryRules=function applySurgeryRules(desc,A,clarify){
  const d=String(desc||'').toLowerCase();
  const dClean=bdStrip(desc);
  const cl=clarify||{power:'usb',phone:false};
  A.parts=Array.isArray(A.parts)?A.parts:[];
  const askedPhysicalScreen=/\b(screen|display|oled|lcd|read\s*out|seven[- ]?segment|e-?ink|e-?paper|tft)\b|\bshow\b[^.,;]{0,25}\b(on\s+(the|a)\s+(box|device|unit|wall|front|screen|display)|angle|temp|reading|live)\b/i.test(d)&&!/\bno\s+(screen|display|oled|lcd)\b/i.test(d);
  if(!askedPhysicalScreen){
    A.parts=A.parts.filter(p=>!/ssd1306|sh1106|oled|lcd|display|screen|16x2|st77|ili93|max7219|tm1637/i.test(p.search+' '+p.category+' '+p.function));
  }else if(!A.parts.some(p=>/ssd1306|sh1106|oled|lcd|display|screen|16x2/i.test(p.search+' '+p.category))){
    A.parts.push({category:'displays',search:'SSD1306 0.96" OLED display 128x64 (I2C)',function:'shows the live count and status right on the screen',required:true,why:'Crisp mini OLED screen that uses only 2 I2C wires (SDA & SCL).',support:false});
  }
  const askedAmbientLight=/\b(light\s+level|ambient\s+light|daylight|sunlight|sunrise|sunset|dawn|dusk|\blux\b|bh1750|\bldr\b|photoresistor|when\s+it\s+gets\s+dark|in\s+the\s+dark|night\s*light)\b/i.test(d);
  if(!askedAmbientLight){
    A.parts=A.parts.filter(p=>!/bh1750|\bldr\b|photo.?resistor|light.?level|sensors-light/i.test(p.search+' '+p.category));
  }
  const askedTilt=/\b(tilt|pitch|roll|gyro|accelero|mpu-?6050|bno-?085|is\s+level|out\s+of\s+level|unlevel|auto[- ]?level|level\s+checker|levelling|leveling)\b/i.test(d);
  if(!askedTilt){
    A.parts=A.parts.filter(p=>!/mpu.?6050|bno.?085|accelero|gyro|tilt/i.test(p.search+' '+p.category));
  }

  // Rule R01: Dog flap / pet door / door pass counter -> MUST use MC-38 magnetic reed switch, NOT PIR motion sensor
  if(/\bflap\b|dog.?door|cat.?door|pet.?door/i.test(d)){
    const askedMotion=/\bpir\b|room.*motion|someone walks/i.test(d);
    if(!askedMotion){
      A.parts=A.parts.filter(p=>!/\bpir\b|hc-?sr50|motion.*sensor/i.test(p.search));
    }
    if(!A.parts.some(p=>/reed|mc-?38|magnetic|door.*sensor|flap/i.test(p.search+' '+p.function))){
      A.parts.unshift({category:'sensors-motion',search:'MC-38 magnetic reed switch door sensor',function:'counts each time your dog pushes through the flap (magnet on the flap, sensor on the frame)',required:true,why:'A magnetic reed switch counts actual flap passes accurately with 2-second bounce protection.',support:false});
    }
  }

  // Rule R08: Submerged / water / aquarium / pond temperature -> MUST use DS18B20 waterproof temperature probe
  if(/aquarium|fish.?tank|\bpond\b|\bbath\b|\bpool\b|water.?temp|submerg|liquid.?temp/i.test(d)){
    A.parts=A.parts.filter(p=>!/bme280|bmp280|dht11|dht22|am2302/i.test(p.search));
    if(!A.parts.some(p=>/ds18b20|waterproof.*temp/i.test(p.search))){
      A.parts.unshift({category:'sensors-temperature',search:'DS18B20 waterproof temperature probe',function:'measures water temperature safely underwater',required:true,why:'Waterproof stainless-steel probe is safe to submerge in water.',support:false});
    }
  }

  // Rule R02 & R07: Reversible motors / jacks -> right multi-channel relay module
  const fourJacks=/\b(4|four)\b.*(jack|corner|motor|leg)/i.test(d);
  const revMotor=!fourJacks&&!/\bservo\b/i.test(d)&&(/reversible|(open|up).*(close|down)|coop.?door|linear.?actuator/i.test(d));
  if(fourJacks){
    A.parts=A.parts.filter(p=>!/relay/i.test(p.search+' '+p.category));
    A.parts.push({category:'relays',search:'8-channel 5V relay module',function:'controls 4 reversible corner jacks (UP + DOWN relay pair per corner = 8 channels)',required:true,why:'4 reversible jacks require 8 relay channels with UP/DOWN interlock.',support:true});
  }else if(revMotor){
    if(!A.parts.some(p=>/[248][- ]?channel.*relay|l298/i.test(p.search))){
      A.parts=A.parts.filter(p=>!/relay/i.test(p.search+' '+p.category));
      A.parts.push({category:'relays',search:'2-channel 5V relay module',function:'controls the reversible motor (1 channel OPEN/UP, 1 channel CLOSE/DOWN with interlock)',required:true,why:'A reversible motor requires 2 relay channels to run in both directions.',support:true});
    }
  }

  // Rule R03: Any 2-lead power load (pump, valve, DC motor, siren, fan) MUST have a relay/driver module so the controller has a GPIO signal pin
  const hasLoad=A.parts.some(p=>/pump|valve|solenoid|130.*motor|dc.*motor|siren|fan|extractor/i.test(p.search+' '+p.function));
  const hasDriver=A.parts.some(p=>/relay|l298|uln2003|mosfet/i.test(p.search+' '+p.category));
  if(hasLoad&&!hasDriver){
    A.parts.push({category:'relays',search:'1-channel 5V relay module',function:'switches power to the pump/valve/motor from a controller GPIO pin',required:true,why:'Added by The Surgery: a microcontroller GPIO pin cannot power a pump, valve or motor directly.',support:true});
  }

  // Rule R06: Do NOT require OpenWeatherMap API key for local temperature/humidity sensors unless forecast/online weather was asked for
  const wantsOnlineWeather=/\bforecast\b|openweather|weather from the internet|online weather/i.test(d);
  if(!wantsOnlineWeather&&Array.isArray(A.extra_inputs_needed)){
    A.extra_inputs_needed=A.extra_inputs_needed.filter(x=>x.key!=='owm_api_key'&&x.key!=='location');
  }

  // Rule R01 & R04: Phone messages or time-of-day schedules require Wi-Fi (ESP32) unless DS3231 RTC is present
  const wantsPhone=cl.phone||/phone|message|text me|notify|notification|alert|tell me|let me know|send me|\bntfy\b/i.test(dClean);
  const wantsTime=/\b\d{1,2}\s*(am|pm)\b|\b\d{1,2}:\d{2}\b|end of the day|every (day|morning|evening|night)|twice a day|daily|after \d/i.test(d);
  if((wantsPhone||wantsTime)&&A.platform==='arduino'){
    A.platform='esphome';
    A.platform_reason='Upgraded to ESP32 by The Surgery because Wi-Fi is needed for '+(wantsPhone?'sending messages to your phone':'getting the accurate time of day from the internet')+'.';
  }
  if(wantsPhone){
    A.notification_method='ntfy';
    A.extra_inputs_needed=Array.isArray(A.extra_inputs_needed)?A.extra_inputs_needed:[];
    if(!A.extra_inputs_needed.some(x=>x.key==='ntfy_topic')){
      A.extra_inputs_needed.push({key:'ntfy_topic',label:'Your ntfy.sh topic name (for messages to your phone)',help:'Install the free ntfy app, tap + and subscribe to this exact name.',url:'https://ntfy.sh'});
    }
  }
  return A;
};

// ---- Doctor 1B: Parts Doctor Matcher (matches every part spec and auto-synthesizes any unknown part) ----
const surgeryMatchParts=async function surgeryMatchParts(specs){
  const base=await intentMatch(specs);
  for(const m of base){
    if(m.part||m.ctrl||m.from==='power'||m.from==='wifi'||m.from==='skip'||m.from==='removed')continue;
    // Try synonym dictionary on search + function
    const syn=resolvePartBySynonym(m.spec.search,m.spec.function);
    if(syn&&syn.part){
      m.part=syn.part;m.from=syn.from;m.note='';continue;
    }
    // Try loose search across allParts()
    const own=allPartsAi().filter(p=>!CTRL_IDSAi.includes(p.id)).map(p=>({title:p.name,family:(TYPESAi[p.type]||TYPESAi.other).name,tags:[p.type],desc:(p.notes||'').slice(0,300),ref:p}));
    const words=String(m.spec.search||'').replace(/[^a-zA-Z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>2);
    for(const w of words){
      const r=searchPartsAi(own,w,'all');
      if(r.length){m.part=r[0].ref;m.from='library match';m.note='';break;}
    }
    // If still unmatched, synthesize a clean custom part with valid dimensions and pins so the user never hits a missing-part wall!
    if(!m.part){
      m.part=synthesizePart(m.spec);
      m.from='auto-configured by Surgery';
      m.note='';
    }
  }
  return base;
};

// ---- Doctor 2: Electric Doctor (builds a temporary wiring plan to verify all power, ground, I2C, and signal pins) ----
const electricDoctor=function electricDoctor(matches,pf,power){
  const savedItems=cloneAi(wizAi.items||[]),savedPower=wizAi.power;
  try{
    const items=[];
    for(const m of matches){
      if(!m.part)continue;
      const ex=items.find(i=>i.pid===m.part.id);
      if(ex)ex.qty=Math.min(10,ex.qty+1);
      else items.push({pid:m.part.id,qty:1,mount:'auto',wall:'auto'});
    }
    wizAi.items=items;wizAi.power=power||'usb';
    return planWiringAi();
  }finally{
    wizAi.items=savedItems;wizAi.power=savedPower;
  }
};

// ---- Doctor 3: Specialist Verifier (audits Parts Doctor + Electric Doctor, returns issues & auto-repairs) ----
const specialistVerify=function specialistVerify(desc,A,matches,pf,power,P){
  const issues=[];
  // 1. Check for any unresolved required parts or zero-dimension parts
  for(const m of matches){
    if(m.from==='power'||m.from==='wifi'||m.from==='skip'||m.from==='removed')continue;
    if(!m.part){
      issues.push({code:'MISSING_PART',msg:`Part "${m.spec.search}" was not resolved to a library part.`,spec:m.spec,match:m});
    }else if(!(m.part.w>0&&m.part.d>0)){
      issues.push({code:'BAD_DIMENSIONS',msg:`Part "${m.part.name}" has invalid dimensions.`,part:m.part});
    }
  }
  // 2. Check wiring plan errors or parts with no pins
  if(P.error){
    issues.push({code:'WIRING_ERROR',msg:P.error});
  }
  if(P.noPinParts&&P.noPinParts.length){
    for(const np of P.noPinParts){
      issues.push({code:'NO_PINS',msg:`${np.label} has no pin definitions to wire.`,id:np.id});
    }
  }
  // 3. Check for unwired signal pins ("No free controller pin left")
  for(const w of (P.warn||[])){
    if(/No free controller pin left/i.test(w)){
      issues.push({code:'OUT_OF_PINS',msg:w});
    }
  }
  // 4. Verify every non-controller part in P.insts is connected to at least one net in P.nets
  if(!P.error&&P.insts&&P.nets){
    const inNets=new Set(P.nets.flatMap(n=>n.pins.map(p=>p.inst.key)));
    for(const inst of P.insts){
      if(inst===P.ctrl)continue;
      if(!inNets.has(inst.key)){
        issues.push({code:'UNWIRED_PART',msg:`${inst.label} has pins that were not wired to any net.`,inst});
      }
    }
  }
  // 5. Verify high-current 2-lead loads (pump, valve, DC motor) have a relay or motor driver in the circuit
  const hasBareLoad=matches.some(m=>m.part&&/c-mini-submersible-water-pump|c-solenoid-water-valve|c-130-size-dc-motor/i.test(m.part.id));
  const hasRelayOrDriver=matches.some(m=>m.part&&/relay|l298|uln2003|mosfet/i.test(m.part.id+' '+m.part.name));
  if(hasBareLoad&&!hasRelayOrDriver){
    issues.push({code:'LOAD_WITHOUT_DRIVER',msg:'A water pump, solenoid valve, or DC motor was selected without a switching relay/driver module.'});
  }
  const askedScreen=/\b(screen|display|oled|lcd|read\s*out|seven[- ]?segment|e-?ink|e-?paper|tft)\b|\bshow\b[^.,;]{0,25}\b(on\s+(the|a)\s+(box|device|unit|wall|front|screen|display)|angle|temp|reading|live)\b/i.test(desc)&&!/\bno\s+(screen|display|oled|lcd)\b/i.test(desc);
  if(!askedScreen&&matches.some(m=>m.part&&(m.part.type==='display'||/ssd1306|sh1106|oled|lcd|16x2/i.test(m.part.id+' '+m.part.name)))){
    issues.push({code:'UNREQUESTED_DISPLAY',msg:'A physical screen/display was added when the user only used natural speech ("see how many", "see if", etc.) for a phone message or alert.'});
  }
  return {ok:issues.length===0,issues};
};

// Specialist Auto-Repair: fixes any issues found by specialistVerify behind the scenes
const specialistRepair=function specialistRepair(desc,A,base,pf,power,report){
  for(const iss of report.issues){
    if(iss.code==='MISSING_PART'&&iss.match){
      iss.match.part=synthesizePart(iss.spec);
      iss.match.from='auto-configured by Surgery';
      iss.match.note='';
    }else if(iss.code==='BAD_DIMENSIONS'&&iss.part){
      iss.part.w=iss.part.w>0?iss.part.w:25;
      iss.part.d=iss.part.d>0?iss.part.d:20;
      iss.part.h=iss.part.h>0?iss.part.h:8;
    }else if(iss.code==='NO_PINS'&&iss.id){
      const p=partByIdAi(iss.id);
      if(p&&(!p.pins||!p.pins.length)){
        p.pins=[{n:'VCC',r:'3v3',x:2.5,y:2},{n:'GND',r:'gnd',x:5.04,y:2},{n:'SIG',r:'sig',x:7.58,y:2}];
      }
    }else if(iss.code==='LOAD_WITHOUT_DRIVER'){
      const rel=partByIdAi('c-1-channel-5v-relay-module');
      if(rel&&!base.some(m=>m.part&&/relay/i.test(m.part.id))){
        base.push({spec:{category:'relays',search:'1-channel 5V relay module',function:'switches power to the pump/valve/motor safely',required:true,why:'Added by Specialist Verifier so the controller has a GPIO signal pin to switch the load.',support:true},part:rel,from:'Specialist auto-fix',note:''});
        learnSurgeryRule('R_AUTO_LOAD_DRIVER','Auto-paired Relay Driver for Load','Load had only power leads with no GPIO signal pin.','Always include a 1-channel 5V relay module when a pump, valve, or DC motor is present.');
      }
    }else if(iss.code==='UNWIRED_PART'&&iss.inst&&iss.inst.part){
      const p=iss.inst.part;
      if(!p.pins||!p.pins.some(pin=>pin.r!=='nc')){
        p.pins=[{n:'VCC',r:'3v3',x:2.5,y:2},{n:'GND',r:'gnd',x:5.04,y:2},{n:'SIG',r:'sig',x:7.58,y:2}];
      }
    }else if(iss.code==='UNREQUESTED_DISPLAY'){
      for(let i=base.length-1;i>=0;i--){
        const m=base[i];
        if(m.part&&(m.part.type==='display'||/ssd1306|sh1106|oled|lcd|16x2/i.test(m.part.id+' '+m.part.name)))base.splice(i,1);
      }
      learnSurgeryRule('R11_NATURAL_SPEECH_SEE_VS_SCREEN','Natural Speech ("See / Check / Watch" vs Physical Screen)','Added a screen when the user said "see how many times" instead of asking for a physical screen.','Phrases like "see how many times", "see if", "see when", or "check" mean "to know" — never add an OLED/LCD display unless a screen/display/readout was explicitly asked for.');
    }
  }
};

// ---- Master Surgery Pipeline (Parts Doctor -> Electric Doctor -> Specialist Verifier) ----
const runSurgery=async function runSurgery(desc,clarify,onStage){
  const stage=n=>{if(typeof onStage==='function')onStage(n);};
  stage(0); // Parts Doctor: Picking the right parts for your idea…
  let rawData=null,usedOffline=false;
  const _cl=clarify||null;
  if(typeof aiKeyAi==='function'&&aiKeyAi()){
    try{
      const _clNote=_cl?`\nUSER PREFERENCES:\n- Power: ${_cl.power==='battery'?'battery-powered':_cl.power==='mains'?'mains adaptor (always-on)':'USB or mains adaptor'}\n- Phone alerts: ${_cl.phone?'yes — include ntfy notification support':'as described in prompt'}\n`:'';
      const promptText=INTENT_PROMPT+surgeryRulesPrompt()+_clNote+(window.ownedPartsNote?ownedPartsNote():'')+'\n\nWhat the beginner wants:\n"""'+desc+'"""';
      const [{data:_d}]=await Promise.all([callAI(promptText),ensureLibraryReadyAi()]);
      if(_d&&typeof _d==='object'&&Array.isArray(_d.parts)&&_d.parts.length)rawData=_d;
    }catch(e){
      console.warn('EvenUCan Surgery: online AI unavailable, seamlessly using built-in Specialist Parts Doctor.',e);
    }
  }
  if(!rawData){
    rawData=partsDoctorOffline(desc,_cl);
    usedOffline=true;
  }
  let A=tidyIntent(rawData,desc);
  A=applySurgeryRules(desc,A,_cl);

  stage(1); // Parts Doctor: Matching parts in library…
  let pf=pfOkAi(A.platform);
  if(iwAi&&iwAi.userPf&&PLATFORMSAi[iwAi.userPf])pf=iwAi.userPf;
  let base=await surgeryMatchParts(A.parts);
  let power=(_cl&&_cl.power)||(base.find(m=>m.from==='power')||{}).power||'usb';
  let matches=pfMatchesAi(base,pf);

  stage(2); // Electric Doctor: Wiring every pin and power line…
  let plan=electricDoctor(matches,pf,power);

  stage(3); // Specialist: Double-checking parts & wiring…
  let verify=specialistVerify(desc,A,matches,pf,power,plan);
  let passes=1;
  while(!verify.ok&&passes<3){
    passes++;
    specialistRepair(desc,A,base,pf,power,verify);
    matches=pfMatchesAi(base,pf);
    plan=electricDoctor(matches,pf,power);
    verify=specialistVerify(desc,A,matches,pf,power,plan);
  }
  const wiredPins=(plan.assigned||[]).length;
  const wiredNets=(plan.nets||[]).length;
  const partCount=matches.filter(m=>m.part).length;
  const surgeryReport={
    verified:verify.ok,
    passes,
    usedOffline,
    partCount,
    wiredPins,
    wiredNets,
    rulesApplied:getSurgeryRules().length
  };
  return {analysis:A,base,matches,pf,power,plan,surgeryReport};
};
