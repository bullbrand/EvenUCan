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
  const outdoors=has(/shed|garage|garden|outside|outdoor|greenhouse|barn|gate|fence|yard|porch|flap|kennel|hutch|coop|pond|roof|caravan|boat|\brv\b/);
  const counting=has(/how many|count|log\b|history|record|report|statistic|how often|times a day|per day/);
  const mains=has(/\b(230|240|110|120)\s*v\b|mains (light|lamp|socket|appliance|device)|\bkettle|\bheater\b|\bplug socket\b|light bulb|household/);
  const loads=hasP(/relay|pump|valve|solenoid|motor|siren|buzzer 12|fan|heater|12 ?v/)||has(/pump|valve|solenoid|motor|pour|dispens|water the|irrigat|lock|latch|siren|heater|fan\b/);
  const guard=has(/intrud|someone|somebody|burglar|thief|thieves|break.?in|trespass|security|alarm|\benters?\b|who.{0,12}(in|enter)/);
  const flap=has(/\bflap\b|cat ?door|pet ?door/);
  const pet=has(/\bdog\b|\bcat\b|\bpet\b|puppy|kitten|rabbit|chicken|\bhen\b/);

  // ---- things the user could not know they needed
  if(times){
    add('added','A real-time clock: the device sets its own time from the internet when it starts.','A microcontroller has no clock of its own. Without this the time rule (for example "8am to 5pm") would silently stop working.');
    add('assumed','Your local time zone: '+(function(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'your computer\'s time zone';}catch(e){return 'your computer\'s time zone';}})()+'.','The hours you typed are read in this time zone. Change it if the device lives somewhere else.');
    if(!online)add('risk','This board has no Wi-Fi, so it cannot get the time.','Pick an ESP32 board, or add a real-time clock module (DS3231).');
    add('assumed','If the clock is not set yet (just after a power cut, before Wi-Fi connects), it counts as outside the allowed hours.','The safe side: an alarm that is too watchful is better than one that is asleep.');
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
    add('added','A "went offline" message: if the device stops reporting, you are told.','A silent device looks the same as a working one. This is the commonest way a home alarm fails without you knowing.');
    add('risk','If your Wi-Fi or internet is down, no message can be sent.','Anything the device does on its own (counting, saving, sounding a siren) still works.');
  }
  if(outdoors){
    add('ask','Is there Wi-Fi where it will live? Stand there with your phone and check the signal.','No Wi-Fi means no phone messages and no clock. This is the most common reason these projects fail after the build.');
    if(power!=='battery')add('ask','Is there mains power there, or must it run on a battery?','It decides the power choice below. Wi-Fi on a battery lasts only days unless the device sleeps between events.');
    add('added','A weatherproof box (IP65 or better) with cable glands, and the electronics mounted off the floor.','Damp is the usual killer of outdoor electronics. EvenUCan designs the box in the next step.');
  }
  if(guard){
    add('assumed','You can disarm it when you arrive (a button or a phone message), or it waits a short delay before sounding.','Otherwise the first person it catches is you.');
    add('risk','Motion sensors trigger on pets, spiders, insects, heaters and sun through glass; door contacts miss a window.','A door contact plus a motion sensor together give far fewer false alarms than either alone.');
  }
  if(counting){
    add('added','A saved log: each event stored with its time, kept through a power cut.','So you can ask for counts and a report later, not only see the latest value.');
    add('assumed','The log keeps the most recent events (about the last 30 days). Older ones are overwritten.','Flash memory is small. Say so in your idea if you need a longer history.');
    add('ask','What should the report show, and when should it be sent (on request, daily, weekly)?','A short daily or weekly summary is far more likely to be read than a message for every event.');
    add('risk','A sensor counts what passes it, not what happens next. Treat it as a good guide, not proof.','For example a flap sensor counts trips out, not what the dog did outside.');
  }
  if(flap&&counting){
    add('ask','Do you want to know in from out? One sensor counts passes only. Two sensors (one each side of the flap) tell the direction and so how long he was outside.','Without direction you cannot measure the time spent outside, only the number of passes.');
  }
  if(pet&&(outdoors||flap)){
    add('risk','Animals chew and knock things: put the box and its wires out of reach or inside a chew-proof cover, and keep the flap swinging freely.','A chewed battery or wire is dangerous to the animal.');
  }
  if(has(/water|wet|rain|irrigat|pump|leak|pond/)&&loads)add('risk','Keep every water joint below and away from the electronics, and use hose clips.','A drip onto a relay board is a short circuit.');
  if(power==='battery'&&loads)add('risk','Motors, pumps and sirens need more current than a small battery gives.','Use a battery sized for the load, or a mains supply.');

  // ---- what the AI itself thought of (not checked by a fixed rule)
  for(const h of ((A&&A.hidden_needs)||[]))add(h.kind==='ask'?'ask':h.kind==='risk'?'risk':'added',h.need,h.why,false);

  // ---- the basic assumptions, always shown
  add('assumed','Board: '+((PLATFORMS[pf]&&PLATFORMS[pf].name)||pf)+'. Power: '+({usb:'USB cable',battery:'battery',mains:'mains adapter'}[power]||power)+'.','You can change both on this page.');
  const seen=new Set();return out.filter(n=>{if(seen.has(n.text))return false;seen.add(n.text);return true;});
}
const BD_KINDS={added:['➕','I added this for you'],assumed:['📝','I assumed this: change it if it is wrong'],ask:['❓','Please check this'],risk:['⚠️','Watch out']};
function briefDoctorHtml(list,A){
  if(!list||!list.length)return '';
  const reqs=((A&&A.requirements)||[]),ps=((A&&A.parts)||[]),added=list.filter(n=>n.kind==='added');
  const readBack=(reqs.length?`<div style="margin:6px 0"><b>So this is what you want:</b><ul style="margin:3px 0 0;padding-left:20px">${reqs.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></div>`:'')+
    (ps.length||added.length?`<div style="margin:6px 0"><b>To do that, we will need:</b><ul style="margin:3px 0 0;padding-left:20px">${ps.map(p=>`<li><b>${esc(p.search)}</b>${p.why?' – '+esc(p.why):''}</li>`).join('')}${added.map(n=>`<li>${esc(n.text)}</li>`).join('')}</ul></div>`:'');
  const rows=['assumed','ask','risk'].map(k=>{
    const it=list.filter(n=>n.kind===k);if(!it.length)return '';
    return `<div style="margin:6px 0"><b>${BD_KINDS[k][0]} ${BD_KINDS[k][1]}</b><ul style="margin:3px 0 0;padding-left:20px">`+
      it.map(n=>`<li>${esc(n.text)}${n.checked?'':' <span class="ewNote">(the AI\'s own idea, not checked)</span>'}${n.why?`<details class="ewNote" style="margin:0"><summary style="cursor:pointer">why?</summary>${esc(n.why)}</details>`:''}</li>`).join('')+'</ul></div>';
  }).join('');
  return `<div class="efbox" id="iwDoctor" style="line-height:1.4"><b>🩺 The Doctor looked over your idea</b>
${readBack}<div class="ewNote" style="margin-top:8px">Is that right? These are the things you did not mention but will need. If something is wrong, use "Start again" and say so in your idea.</div>${rows}</div>`;
}
