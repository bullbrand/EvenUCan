// EvenUCan AI helpers and Surgery - 07-training-suite.js
// One of the files in js/ai/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- 10 Beginner User Inputs Test & Learning Suite ----
const SURGERY_TEST_CASES=[
  {id:1,input:'i want a way to see how many times my dog goes through his backdoor dog flap ina day it can send me a message at the end of the day with a count',
   expectPart:/reed|mc-38/i,forbidPart:/\bpir\b|hc-sr501|ssd1306|oled|lcd|display|screen/i,expectPf:'esphome',expectNotify:true},
  {id:2,input:'i want an auto-leveller for my motorhome with 4 electric corner jacks that go up and down, a small screen showing the angle, and a button to start levelling',
   expectPart:/8-channel.*relay/i,expectPart2:/mpu6050|bno085/i,expectPart3:/ssd1306|oled/i},
  {id:3,input:'water my tomato plants in the greenhouse automatically with a small pump when the soil gets dry and send me a phone alert if the water tank is empty',
   expectPart:/pump/i,expectPart2:/relay/i,expectPart3:/capacitive.*soil/i,expectNotify:true},
  {id:4,input:'feed my cat twice a day at 7am and 6pm using a small motor that turns a chute, plus a button for an extra treat and a little screen',
   expectPart:/sg90|servo/i,expectPart2:/button/i,expectPart3:/ssd1306|oled/i,expectPf:'esphome'},
  {id:5,input:'tell me on my phone if I leave the garage door open for more than 10 minutes after 9pm, and flash a red light in the hallway',
   expectPart:/reed|mc-38/i,expectPart2:/led/i,expectPf:'esphome',expectNotify:true},
  {id:6,input:'measure the temperature and humidity in my garden shed, show it on a screen, and beep a buzzer if it drops below freezing',
   expectPart:/bme280|dht/i,expectPart2:/ssd1306|oled/i,expectPart3:/buzzer/i,forbidInput:'owm_api_key'},
  {id:7,input:'open my chicken coop door when the sun comes up and close it when it gets dark using a reversible 12V motor',
   expectPart:/bh1750|ldr/i,expectPart2:/2-channel.*relay/i},
  {id:8,input:'check the water temperature in my aquarium and beep and message my phone if the water gets too warm or too cold',
   expectPart:/ds18b20/i,forbidPart:/bme280|dht/i,expectPart2:/buzzer/i,expectNotify:true},
  {id:9,input:'let me know on my phone when the courier drops a parcel into my porch delivery box and flashes a green LED',
   expectPart:/reed|mc-38/i,expectPart2:/led/i,expectNotify:true},
  {id:10,input:'check the air quality and smoke in my workshop and turn on an extractor fan relay and beep if the air gets bad',
   expectPart:/mq-135|mq-2/i,expectPart2:/relay/i,expectPart3:/buzzer/i}
];

const runSurgeryTrainingSuite=async function runSurgeryTrainingSuite(){
  const results=[];
  for(const tc of SURGERY_TEST_CASES){
    const raw=partsDoctorOffline(tc.input,{power:'usb',phone:false});
    let A=tidyIntent(raw,tc.input);
    A=applySurgeryRules(tc.input,A,{power:'usb',phone:false});
    const pf=pfOkAi(A.platform);
    const base=await surgeryMatchParts(A.parts);
    const matches=pfMatchesAi(base,pf);
    const plan=electricDoctor(matches,pf,'usb');
    let verify=specialistVerify(tc.input,A,matches,pf,'usb',plan);
    if(!verify.ok){
      specialistRepair(tc.input,A,base,pf,'usb',verify);
    }
    const partNames=matches.filter(m=>m.part).map(m=>m.part.name).join(' | ');
    const passParts=(!tc.expectPart||tc.expectPart.test(partNames))&&(!tc.expectPart2||tc.expectPart2.test(partNames))&&(!tc.expectPart3||tc.expectPart3.test(partNames));
    const passForbid=!tc.forbidPart||!tc.forbidPart.test(partNames);
    const passNoOwm=!tc.forbidInput||!A.extra_inputs_needed.some(x=>x.key===tc.forbidInput);
    const passNotify=!tc.expectNotify||A.extra_inputs_needed.some(x=>x.key==='ntfy_topic');
    const pass=verify.ok&&passParts&&passForbid&&passNoOwm&&passNotify;
    results.push({id:tc.id,name:A.name,pass,parts:matches.filter(m=>m.part).map(m=>m.part.name),wires:(plan.nets||[]).length,pins:(plan.assigned||[]).length});
  }
  window.SURGERY_LAST_AUDIT=results;
  return results;
};
window.runSurgeryTrainingSuite=runSurgeryTrainingSuite;
setTimeout(()=>{try{runSurgeryTrainingSuite();}catch(e){}},400);

const briefDoctor=function briefDoctor(desc,A,pf,power){
  const d=bdStrip(String(desc||'')+' '+((A&&A.requirements)||[]).join(' . '));
  const parts=((A&&A.parts)||[]).map(p=>(p.search+' '+p.category+' '+p.function).toLowerCase()).join(' | ');
  const has=re=>re.test(d),hasP=re=>re.test(parts);
  const out=[],add=(kind,text,why,checked)=>out.push({kind,text,why:why||'',checked:checked!==false});
  const online=pf!=='arduino';
  const wantsPhone=/phone|message|text me|notify|notification|alert me|tell me|let me know|send me/.test(d);
  const noise=has(/siren|alarm|loud|horn|sounder|bell|hooter|noise|sound|beep|buzz|bleep|ring|shout|scream|scare|wake (me|us)|make a racket/);
  const siren=has(/siren|alarm|loud|horn|sounder|hooter|deter|scare|scream|wake (me|us)|racket|intruder/);
  const times=has(/\b\d{1,2}\s*(am|pm)\b|\b\d{1,2}:\d{2}\b|between .* and |outside (those )?hours|at night|overnight|after hours|office hours|every (day|morning|evening|night|week)|daily|weekly|each (day|morning|night)|end of the day/);
  const window_=has(/between .{1,25} and |\b\d{1,2}\s*(am|pm)?\s*(to|until|till|-)\s*\d{1,2}\s*(am|pm)\b|outside (those )?hours|office hours|after hours|overnight|at night/);
  const reportWhen=has(/daily|each day|every day|weekly|every week|each week|on request|when i ask|end of the day/);
  const outdoors=has(/shed|garage|garden|outside|outdoor|greenhouse|barn|gate|fence|yard|porch|flap|kennel|hutch|coop|pond|roof|caravan|boat|\brv\b/);
  const counting=has(/how many|\bcount(s|ed|ing)?\b|\blog\b|history|\brecord(s|ed|ing)?\b|\breport\b|statistic|how often|times a day|per day/);
  const mains=has(/\b(230|240|110|120)\s*v\b|mains (light|lamp|socket|appliance|device)|\bkettle|\bheater\b|\bplug socket\b|light bulb|household/);
  const servoOnly=has(/\bservo\b/)&&!has(/relay|\bpump\b|valve|solenoid|12 ?v|siren|heater|\bjacks?\b|winch/);
  const loads=!servoOnly&&(hasP(/relay|pump|valve|solenoid|motor|siren|buzzer 12|fan|heater|12 ?v/)||has(/pump|valve|solenoid|motor|pour|dispens|water the|irrigat|lock|latch|siren|heater|fan\b/));
  const guard=has(/intrud|someone|somebody|burglar|thief|thieves|break.?in|trespass|security|alarm|\benters?\b|who.{0,12}(in|enter)/);
  const flap=has(/\bflap\b|cat ?door|pet ?door/);
  const pet=has(/\bdog\b|\bcat\b|\bpet\b|puppy|kitten|rabbit|chicken|\bhen\b/);

  if(times){
    add('added','The correct time, fetched from the internet when it starts (no extra part to buy).','A microcontroller has no clock of its own. Without this the time schedule or daily report would not know the time of day.');
    add('assumed','Your local time zone: '+(function(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'your computer\'s time zone';}catch(e){return 'your computer\'s time zone';}})()+'.','The hours you typed are read in this time zone. Change it if the device lives somewhere else.');
    if(!online)add('risk','This board has no Wi-Fi, so it cannot get the time.','Pick an ESP32 board, or add a real-time clock module (DS3231).');
    if(window_)add('assumed','If the clock is not set yet (just after a power cut, before Wi-Fi connects), it counts as outside the allowed hours.','The safe side: an alarm that is too watchful is better than one that is asleep.');
  }
  const namedNoise=has(/\bbuzzers?\b|\bsirens?\b|\bhorns?\b|\bspeakers?\b|\bsounders?\b|\bpiezo\b|\bbells?\b/);
  if(noise&&!namedNoise){
    add('assumed',siren?'You asked for a noise but did not say what makes it. I chose a loud 12 V siren, because you want to be heard or to scare someone off.':'You asked for a sound but did not say what makes it. I chose a small piezo buzzer, because a beep is enough.',siren?'A buzzer is only about 85 dB up close and is not loud across a garden. If you want something smaller and quieter, say so in your idea.':'If you wanted something much louder, say "loud alarm" in your idea and I will use a siren.');
  }
  if(siren){
    add('added','A loud siren needs its own power and a switch (a relay or transistor module). A microcontroller pin cannot drive it.','A pin gives only about 12 mA. Real sirens need 12 V and an amp or more.');
    add('assumed','The siren sounds for at most 30 seconds, then stops and waits 60 seconds before it can sound again.','A siren that never stops annoys neighbours and flattens a battery. Change these numbers in the code if you want.');
    add('risk','Test the siren with a short pulse at home first, with ear protection.','Sirens of this type reach 100 dB or more.');
  }
  if(loads){
    add('added','A flyback diode across every coil load (relay, pump, valve, motor, siren), and a fuse on the supply.','Without the diode a spike can destroy the switching part. Without the fuse a short can start a fire.');
    add('assumed','Loads run from their own supply (for example 12 V). The microcontroller has its own 5 V supply. Their grounds are joined.','If the grounds are not joined the switching signals have no reference and nothing works reliably.');
  }
  if(mains){
    add('risk','Mains voltage (230 V / 120 V) can kill. Do not switch it with a hobby relay board unless it is rated for it and fully enclosed.','Use a ready-made, enclosed, certified smart plug or relay unit, and have an electrician do the mains wiring.');
  }
  const retrigger=has(/\bmotion\b|\bmovement\b|\bpir\b|\bvibration\b|\bknock\b|\bdoor\b|\bgate\b|\bflap\b|someone enters/);
  if(wantsPhone&&online&&retrigger&&!reportWhen){
    add('assumed','While it keeps triggering, it sends at most one phone message every 5 minutes.','A sensor that fires again and again without a limit could send dozens of alerts.');
  }
  if(wantsPhone&&online){
    add('assumed','Messages go to your phone through ntfy.sh (free, no account).','You install the free ntfy app and subscribe to your private topic name shown further down.');
  }
  if(outdoors){
    add('added','A weatherproof box with cable glands'+(has(/\bflap\b/)?' (sensor mounted on the flap frame, cable brought inside)':', and the electronics mounted off the floor')+'.','Keeps damp away from the electronics.');
  }
  const weather=has(/weather|temperature|humidity|barometric|pressure|bme280|bmp280|dht2?2|dht11|climate/)||hasP(/bme280|bmp280|dht|temperature|humidity/);
  if(weather&&!hasP(/ds18b20/)){
    add('risk','Do not seal the air sensor inside the box. Mount it where outside air can reach it, away from the board.','The board gives off a little heat inside a closed box.');
  }
  if(counting){
    add('added','A saved pass counter: each pass is counted and kept safe even if power briefly blinks, then reported at the end of the day and reset for tomorrow.','So you get one clear daily total on your phone.');
  }
  if(counting&&(flap||has(/\bswitch\b|\bdoor\b|\bgate\b|\bbutton\b|\bpress/))){
    add('added','Bounce protection (2-second debounce): one pass through the flap counts once, even if the flap swings back and forth as it closes.','A swinging flap closes the reed switch two or three times on one pass; the 2-second filter ignores the swing-back.');
  }
  const hn=((A&&A.hidden_needs)||[]).map(h=>h.need).join(' ').toLowerCase();
  if(hasP(/reed/)||/reed switch/.test(hn)||(flap&&counting)){
    add('added','A small magnet fixed to the moving flap or door, and the reed switch fixed to the frame beside it.','When the dog pushes the flap open, the magnet moves away from the reed switch and logs +1 pass.');
  }
  const motors=!servoOnly&&has(/\bmotors?\b|\bjacks?\b|actuator|winch|linear|gearbox|leveller|leveler|levelling|leveling/);
  if(motors){
    add('added','A maximum run time for every move, so a stuck or fully extended motor stops itself.','Protects the motor and supply.');
  }
  if(motors&&has(/\bup\b.{0,20}\bdown\b|forward.{0,20}reverse|reversible|both directions|extend.{0,20}retract|open.{0,20}close/)){
    add('added','An interlock: the two relays of one motor (up/open and down/close) can never be on at the same time.','Prevents a short circuit when reversing direction.');
  }
  if(servoOnly){
    add('added','Power the servo from the 5 V pin with grounds joined, and auto-detach after each move so it never buzzes or overheats.','Keeps the servo quiet and reliable.');
  }
  if(has(/\bleds?\b/)){
    add('added','A resistor for each LED (220 to 330 ohms).','Protects the LED and the controller pin.');
  }
  const watering=loads&&has(/water|irrigat|pump|valve|drip|sprinkl|plant|tank|reservoir/);
  if(watering){
    add('added','A safety limit on watering: the pump runs in short bursts and stops if the water tank is empty.','Prevents over-watering and stops the pump running dry.');
  }
  if(power==='battery'&&(hasP(/ssd1306|sh1106|oled|lcd|display|screen|16x2/)||(typeof iwAi!=='undefined'&&iwAi&&iwAi.matches&&iwAi.matches.some(m=>m.part&&(m.part.type==='display'||/ssd1306|sh1106|oled|lcd|16x2/i.test(m.part.id+' '+m.part.name)))))){
    add('risk','A screen left on 24/7 (plus the awake board driving it) draws about 70–90 mA continuously — a typical 2,000 mAh battery will die in about 24 hours (1 day).','A much better way on battery is to get a message on your phone once or twice a day instead of a screen — then the board sleeps between events and your battery runs for weeks!');
  }
  const partNames=((A&&A.parts)||[]).map(p=>String(p.search||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim()).filter(x=>x.length>3);
  for(const h of ((A&&A.hidden_needs)||[]).filter(h=>!partNames.some(n=>String(h.need).toLowerCase().includes(n))&&!(/bounc|count(s|ed)? twice|double.?count/i.test(h.need)&&out.some(o=>/^Bounce protection/.test(o.text)))))add(h.kind==='ask'?'ask':h.kind==='risk'?'risk':'added',h.need,h.why,false);

  add('assumed','Board: '+((PLATFORMSAi[pf]&&PLATFORMSAi[pf].name)||pf)+'. Power: '+({usb:'USB cable',battery:'battery',mains:'mains adapter'}[power]||power)+'.','You can change both on this page.');
  const seen=new Set();return out.filter(n=>{if(seen.has(n.text))return false;seen.add(n.text);return true;});
};

const briefDoctorHtml=function briefDoctorHtml(list,A){
  const sr=(typeof iwAi!=='undefined'&&iwAi&&iwAi.surgeryReport)||null;
  const badge=sr?`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;margin:8px 0;background:color-mix(in srgb,var(--ok) 10%,var(--panel));border:1px solid #86efac;border-radius:8px;font-size:13px"><span style="font-size:16px">🩺</span><span><b>Checked &amp; wired by The Surgery:</b> ${sr.partCount} parts matched · ${sr.wiredPins} pins wired across ${sr.wiredNets} nets · Specialist verified ✓</span></div>`:'';
  const hasBatScreen=(typeof iwAi!=='undefined'&&iwAi&&iwAi.power==='battery'&&Array.isArray(iwAi.matches)&&iwAi.matches.some(m=>m.part&&(m.part.type==='display'||/ssd1306|sh1106|oled|lcd|16x2/i.test(m.part.id+' '+m.part.name))));
  const batCard=hasBatScreen?`<div style="padding:10px 14px;margin:8px 0;background:color-mix(in srgb,#f59e0b 12%,var(--panel));border:1px solid #f59e0b;border-left:4px solid var(--warn);border-radius:8px;font-size:13px;line-height:1.5">
    <div><b>🔋 Specialist Battery Advice — Screen on 24/7 (~1 day battery life):</b></div>
    <div style="margin-top:4px">A screen left on 24/7 (plus keeping the board awake to drive it) draws about <b>70–90 mA continuously</b> — a typical 2,000 mAh rechargeable battery will go flat in <b>about 24 hours</b>.</div>
    <div style="margin-top:4px">💡 <b>A better way:</b> Skip the screen and have it <b>send a message to your phone once or twice a day</b>. That lets the board sleep between events so your battery will <b>run for weeks!</b></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button type="button" id="iwBatDropScreen" class="primary" style="padding:4px 12px;border-radius:6px;font-size:12.5px">📱 Get Phone Messages Instead (Battery runs for weeks!)</button>
      <button type="button" id="iwBatUseMains" style="padding:4px 12px;border-radius:6px;font-size:12.5px">🔌 Keep Screen &amp; Use USB / Plug-in Power</button>
    </div>
  </div>`:'';
  const isMovingDoorFlap=(typeof iwAi!=='undefined'&&iwAi&&(iwAi.power==='battery'||/battery|lipo|cell/i.test(iwAi.desc))&&/\b(flap|door|gate|window|mailbox|parcel)\b/i.test(iwAi.desc));
  const splitCard=isMovingDoorFlap?`<div style="padding:10px 14px;margin:8px 0;background:color-mix(in srgb,#3b82f6 10%,var(--panel));border:1px solid #93c5fd;border-left:4px solid #2563eb;border-radius:8px;font-size:13px;line-height:1.5">
    <div><b>🪙 Specialist Tip: The Smart Solution vs. The Heath Robinson Approach!</b></div>
    <div style="margin-top:4px">Strapping a heavy battery pack, charging board, and Wi-Fi dev board to a swinging pet flap is a classic <b>Heath Robinson contraption</b> — it drags the door down and you have to unmount it to recharge.
      <br><br>The <b>Smart Solution</b> splits the job cleanly:
      <ul style="margin:4px 0 6px;padding-left:18px">
        <li><b>On the moving flap (featherlight):</b> A coin-sized <b>CR2032 transmitter</b> (433MHz RF or ultra-fast ESP-NOW) that pulls <b>0 µA</b> at rest, weighs ~15g, and runs 1–2 years.</li>
        <li><b>Inside the house (plugged into the wall):</b> An <b>ESP32 Base Station</b> that catches the chirp, tracks the count, syncs NTP internet time, and sends your daily phone message!</li>
      </ul>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
      <button type="button" id="iwSplitFlapPlan" class="primary" style="padding:4px 12px;border-radius:6px;font-size:12.5px">✨ Smart Solution: Tiny Flap Node + Indoor ESP32 Base</button>
      <button type="button" id="iwKeepDirectFlap" style="padding:4px 12px;border-radius:6px;font-size:12.5px">🛠️ Heath Robinson: Keep All-in-One Battery Box on Door</button>
    </div>
  </div>`:'';
  if(!list||!list.length)return badge+batCard+splitCard;
  const added=list.filter(n=>n.kind==='added'),tips=list.filter(n=>n.kind==='ask'||n.kind==='risk'),assumed=list.filter(n=>n.kind==='assumed');
  const ul=items=>`<ul style="margin:4px 0 0;padding-left:20px">${items.map(x=>`<li style="margin:3px 0">${x}</li>`).join('')}</ul>`;
  const why=n=>n.why?` <span class="ewNote">— ${escAi(n.why)}</span>`:'';
  const addH=added.length?`<div style="margin:6px 0"><b>✨ Handled automatically for you:</b>${ul(added.map(n=>escAi(n.text)+why(n)))}</div>`:'';
  const tipH=tips.length?`<div style="margin:6px 0"><b>💡 Handy build tips:</b>${ul(tips.map(n=>escAi(n.text)+why(n)))}</div>`:'';
  const asmH=assumed.length?`<div style="margin:6px 0"><b>📝 Default settings used:</b>${ul(assumed.map(n=>escAi(n.text)+why(n)))}</div>`:'';
  return badge+batCard+splitCard+`<details class="efbox" id="iwDoctor" style="line-height:1.45;margin:8px 0"><summary style="cursor:pointer;font-weight:600">💡 Helpful build tips &amp; things set up for you (${list.length}) <span class="ewNote" style="font-weight:400">— optional, click to view</span></summary><div style="margin-top:8px">${addH}${tipH}${asmH}</div></details>`;
};

const briefDoctorCodeNote=function briefDoctorCodeNote(desc,A,pf,power){
  const l=briefDoctor(desc,A,pf,power).filter(n=>n.kind==='added'||n.kind==='assumed');
  return l.length?'Engineering requirements already decided for this project (implement every one that applies to the code; do not mention them as options): '+l.map(n=>n.text).join(' | ')+'\n':'';
};
