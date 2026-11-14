// ---------------------------------------------------------------- Brief Doctor (r1)
// The user typed a loose idea. The AI picked parts for what was SAID. The Doctor adds what the user could not know to
// ask for: hidden essentials, what it ASSUMED (so they can correct it), questions to settle, and risks.
// Every note: {kind:'added'|'assumed'|'ask'|'risk', text, why, checked}. checked=true: a fixed rule written from known
// electronics facts. checked=false: the AI's own guess (shown, but marked as not checked).
function briefDoctor(desc,A,pf,power){
  const d=String(desc||'').toLowerCase()+' '+((A&&A.requirements)||[]).join(' ').toLowerCase();
  const parts=((A&&A.parts)||[]).map(p=>(p.search+' '+p.category+' '+p.function).toLowerCase()).join(' | ');
  const has=re=>re.test(d),hasP=re=>re.test(parts);
  const out=[],add=(kind,text,why,checked)=>out.push({kind,text,why:why||'',checked:checked!==false});
  const online=pf!=='arduino';
  const wantsPhone=/phone|message|text me|notify|notification|alert me|tell me|let me know|send me/.test(d);
  const noise=has(/siren|alarm|loud|horn|sounder|bell|hooter|noise|sound|beep|buzz|bleep|ring|shout|scream|scare|wake (me|us)|make a racket/);
  const siren=has(/siren|alarm|loud|horn|sounder|hooter|deter|scare|scream|wake (me|us)|racket|intruder/);
  const times=has(/\b\d{1,2}\s*(am|pm)\b|\b\d{1,2}:\d{2}\b|between .* and |outside (those )?hours|at night|overnight|after hours|office hours|every (day|morning|evening|night|week)|daily|weekly|each (day|morning|night)/);
  const window_=has(/\b\d{1,2}\s*(am|pm)\b|between .* and |outside (those )?hours|office hours|after hours|overnight|at night/);
  const reportWhen=has(/daily|each day|every day|weekly|every week|each week|on request|when i ask/);
  const outdoors=has(/shed|garage|garden|outside|outdoor|greenhouse|barn|gate|fence|yard|porch|flap|kennel|hutch|coop|pond|roof|caravan|boat|\brv\b/);
  const counting=has(/how many|count|log\b|history|record|report|statistic|how often|times a day|per day/);
  const mains=has(/\b(230|240|110|120)\s*v\b|mains (light|lamp|socket|appliance|device)|\bkettle|\bheater\b|\bplug socket\b|light bulb|household/);
  const loads=hasP(/relay|pump|valve|solenoid|motor|siren|buzzer 12|fan|heater|12 ?v/)||has(/pump|valve|solenoid|motor|pour|dispens|water the|irrigat|lock|latch|siren|heater|fan\b/);
  const guard=has(/intrud|someone|somebody|burglar|thief|thieves|break.?in|trespass|security|alarm|\benters?\b|who.{0,12}(in|enter)/);
  const flap=has(/\bflap\b|cat ?door|pet ?door/);
  const pet=has(/\bdog\b|\bcat\b|\bpet\b|puppy|kitten|rabbit|chicken|\bhen\b/);

  // ---- things the user could not know they needed
  if(times){
    add('added','The correct time, fetched from the internet when it starts (no extra part to buy).','A microcontroller has no clock of its own. Without this the time rule (for example "8am to 5pm") would silently stop working.');
    add('assumed','Your local time zone: '+(function(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'your computer\'s time zone';}catch(e){return 'your computer\'s time zone';}})()+'.','The hours you typed are read in this time zone. Change it if the device lives somewhere else.');
    if(!online)add('risk','This board has no Wi-Fi, so it cannot get the time.','Pick an ESP32 board, or add a real-time clock module (DS3231).');
    if(window_)add('assumed','If the clock is not set yet (just after a power cut, before Wi-Fi connects), it counts as outside the allowed hours.','The safe side: an alarm that is too watchful is better than one that is asleep.');
  }
  if(noise){
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
  if(wantsPhone&&online){
    add('assumed','Messages go to your phone through ntfy.sh (free, no account).','You install the ntfy app and subscribe to your private topic name shown further down.');
    if(power==='battery')add('added','A check on the daily report: if one does not arrive, look at the battery first.','A device that sleeps to save power is offline most of the time, so it cannot send a "went offline" message. A missing report is the warning instead.');
    else add('added','A "went offline" message: if the device stops reporting, you are told.','A silent device looks the same as a working one. This is the commonest way a home alarm fails without you knowing.');
    add('risk','If your Wi-Fi or internet is down, no message can be sent.','Anything the device does on its own (counting, saving, sounding a siren) still works.');
  }
  if(outdoors){
    add('ask','Is there Wi-Fi where it will live? Stand there with your phone and check the signal.','No Wi-Fi means no phone messages and no clock. This is the most common reason these projects fail after the build.');
    if(power!=='battery')add('ask','Is there mains power there, or must it run on a battery?','It decides the power choice below. Wi-Fi on a battery lasts only days unless the device sleeps between events.');
    add('added','A weatherproof box (IP65 or better) with cable glands'+(has(/\bflap\b/)?'':', and the electronics mounted off the floor')+'.','Damp is the usual killer of outdoor electronics. EvenUCan designs the box in the next step.');
  }
  if(guard){
    add('assumed','You can disarm it when you arrive (a button or a phone message), or it waits a short delay before sounding.','Otherwise the first person it catches is you.');
    add('risk','Motion sensors trigger on pets, spiders, insects, heaters and sun through glass; door contacts miss a window.','A door contact plus a motion sensor together give far fewer false alarms than either alone.');
  }
  if(counting){
    add('added','A saved log: each event stored with its time, kept through a power cut.','So you can ask for counts and a report later, not only see the latest value.');
    add('assumed','The log keeps the most recent events (about the last 30 days). Older ones are overwritten.','Flash memory is small. Say so in your idea if you need a longer history.');
    if(!reportWhen)add('ask','What should the report show, and when should it be sent (on request, daily, weekly)?','A short daily or weekly summary is far more likely to be read than a message for every event.');
    add('risk','A sensor counts what passes it, not what happens next. Treat it as a good guide, not proof.','For example a flap sensor counts trips out, not what the dog did outside.');
  }
  if(counting&&(flap||has(/\bswitch\b|\bdoor\b|\bgate\b|\bbutton\b|\bpress/))){
    add('added','Bounce protection: one pass counts once. Repeat triggers within about 2 seconds are ignored.','A swinging flap or a mechanical switch bounces and makes several triggers for one pass. Without this the count comes out too high.');
  }
  const hn=((A&&A.hidden_needs)||[]).map(h=>h.need).join(' ').toLowerCase();
  if(hasP(/reed/)||/reed switch/.test(hn)||(flap&&counting)){
    add('added','A small magnet fixed to the moving part (the flap or door), so the reed switch closes when it moves.','A reed switch only reacts to a magnet. Mount them 5 to 10 mm apart when closed, and test it before fixing it down.');
  }
  if(flap&&counting){
    add('ask','Do you want to know in from out? One sensor counts passes only. Two sensors (one each side of the flap) tell the direction and so how long he was outside.','Without direction you cannot measure the time spent outside, only the number of passes.');
  }
  if(pet&&(outdoors||flap)){
    add('risk','Animals chew and knock things: put the box and its wires out of reach or inside a chew-proof cover, and keep the flap swinging freely.','A chewed battery or wire is dangerous to the animal.');
  }
  if(has(/water|wet|rain|irrigat|pump|leak|pond/)&&loads)add('risk','Keep every water joint below and away from the electronics, and use hose clips.','A drip onto a relay board is a short circuit.');
  const disposable=has(/\baaa?\b|\baa\b|alkaline|disposable|non.?rechargeable|battery holder|\bcr2032\b|coin cell|\bpp3\b/);
  if(power==='battery'){
    if(disposable){
      const cells=has(/\b(2|two)\s*(x\s*)?(aaa?|cells?|pack)\b|\b(2|two)[- ]pack/)?2:has(/\b(3|three)\s*(x\s*)?(aaa?|cells?)\b/)?3:4;
      if(cells===2)add('added','A holder for the 2 disposable cells (no charger needed), and a small step-up (boost) module to give the board a steady 5 V. Choose one advertised as low quiescent current (microamps).','Two cells give only about 3 V when fresh and about 2 V when nearly flat. The board needs more than that to run, so without a boost module it would stop working long before the cells are empty. A cheap boost module keeps using power even while the board sleeps, and can flatten two cells in days, so pick a low-quiescent-current one if the device sleeps between events.');
      else if(cells===3)add('added','A holder for the 3 disposable cells (no charger needed), and a small step-up or step-down module to give the board a steady 5 V.','Three fresh cells are about 4.5 V, which is a little too low for the board and falls lower as they run down. A module keeps the board steady.');
      else add('added','A holder for the 4 disposable cells (no charger needed), and a small 5 V step-down module after it.','Four fresh alkaline cells give about 6 V, which is more than the 5 V pin on the board should get. The step-down module gives the board a steady 5 V as the cells run down.');
    }
    else add('added','A charger and protection module for the lithium battery (for example a TP4056 with protection).','A bare LiPo or 18650 cell must never be charged or run without protection: overcharging, over-draining or a short can make it hot or start a fire.');
  }
  if(power==='battery'&&online){
    add('added','Battery level check: two equal resistors (for example 100 k each) split the battery voltage so the ESP32 can read it on an analog pin. At 30% it sends: "My battery is at 30%. Please recharge as soon as possible."','A LiPo battery reads 4.2 V full and about 3.7 V near 30%. The ESP32 pin can only take 3.3 V, so the voltage must be halved first, on a pin that works while Wi-Fi is on.');
    add('assumed','The battery percentage is estimated from the voltage, so it is a good guide and not exact. The separate 30% warning is sent once. While the battery stays low, each daily report ends with the line "Battery low: please recharge." Charging it is up to you. The warning is re-armed once the battery has been charged.','Voltage only roughly shows how full a LiPo battery is, and it reads a little differently when the device is busy. One separate message keeps the phone quiet, and the reminder inside the daily report gives you more chances without extra messages.');
  }
  if(power==='battery'&&loads)add('risk','Motors, pumps and sirens need more current than a small battery gives.','Use a battery sized for the load, or a mains supply.');

  // ---- what the AI itself thought of (not checked by a fixed rule)
  const partNames=((A&&A.parts)||[]).map(p=>String(p.search||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim()).filter(x=>x.length>3);
  for(const h of ((A&&A.hidden_needs)||[]).filter(h=>!partNames.some(n=>String(h.need).toLowerCase().includes(n))&&!(/bounc|count(s|ed)? twice|double.?count/i.test(h.need)&&out.some(o=>/^Bounce protection/.test(o.text)))))add(h.kind==='ask'?'ask':h.kind==='risk'?'risk':'added',h.need,h.why,false);

  // ---- the basic assumptions, always shown
  add('assumed','Board: '+((PLATFORMS[pf]&&PLATFORMS[pf].name)||pf)+'. Power: '+({usb:'USB cable',battery:'battery',mains:'mains adapter'}[power]||power)+'.','You can change both on this page.');
  const seen=new Set();return out.filter(n=>{if(seen.has(n.text))return false;seen.add(n.text);return true;});
}
// The user never sees a "Doctor". They see one plain screen: what they asked for, what it takes, and only the few
// things they need to check. Everything the Doctor decided is also passed to the code writer (briefDoctorCodeNote).
function briefDoctorHtml(list,A){
  if(!list||!list.length)return '';
  const reqs=((A&&A.requirements)||[]),ps=((A&&A.parts)||[]),added=list.filter(n=>n.kind==='added');
  const ul=items=>`<ul style="margin:3px 0 0;padding-left:20px">${items.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  const why=n=>n.why?`<details class="ewNote" style="margin:0"><summary style="cursor:pointer">why?</summary>${esc(n.why)}</details>`:'';
  const unchecked=n=>n.checked?'':' <span class="ewNote">(a suggestion: not double-checked)</span>';
  const head=reqs.length?`<div style="margin:6px 0"><b>So this is what you want:</b>${ul(reqs.map(esc))}</div>`:'';
  const need=(ps.length||added.length)?`<div style="margin:6px 0"><b>To do that, we will need:</b>${ul(ps.map(p=>`<b>${esc(p.search)}</b>${p.why?' – '+esc(p.why):''}`).concat(added.map(n=>esc(n.text))))}</div>`:'';
  const ask=list.filter(n=>n.kind==='ask'),risk=list.filter(n=>n.kind==='risk'),assumed=list.filter(n=>n.kind==='assumed');
  const askH=ask.length?`<div style="margin:6px 0"><b>❓ Please check before you build:</b>${ul(ask.map(n=>esc(n.text)+unchecked(n)+why(n)))}</div>`:'';
  const riskH=risk.length?`<div style="margin:6px 0"><b>⚠️ Good to know:</b>${ul(risk.map(n=>esc(n.text)+unchecked(n)+why(n)))}</div>`:'';
  const asmH=assumed.length?`<details style="margin:6px 0"><summary style="cursor:pointer"><b>📝 Things I decided for you (tap to see, change if wrong)</b></summary>${ul(assumed.map(n=>esc(n.text)+why(n)))}</details>`:'';
  return `<div class="efbox" id="iwDoctor" style="line-height:1.4">${head}${need}${askH}${riskH}${asmH}<div class="ewNote" style="margin-top:8px">Is that right? If not, press "Start again" and tell me what is different.</div></div>`;
}
// What the code writer must build in, in plain instructions (used by intentAINote).
function briefDoctorCodeNote(desc,A,pf,power){
  const l=briefDoctor(desc,A,pf,power).filter(n=>n.kind==='added'||n.kind==='assumed');
  return l.length?'Engineering requirements already decided for this project (implement every one that applies to the code; do not mention them as options): '+l.map(n=>n.text).join(' | ')+'\n':'';
}
