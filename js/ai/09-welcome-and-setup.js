// EvenUCan AI helpers and Surgery - 09-welcome-and-setup.js
// One of the files in js/ai/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- (r4) Welcome: greets a new drawing and walks a beginner through their idea in the same window
// (steps welcome, w1 idea, w2 what it does, w3 what they have; then the wizard's own busy / result steps).
const WC_DOES=[
  {k:'screen',label:'Display information on a small screen',say:'show information on a small screen'},
  {k:'sound',label:'Make a sound (beep, buzzer)',say:'make a sound (beep or buzzer)'},
  {k:'led',label:'Light up an LED',say:'light up an LED'},
  {k:'phone',label:'Send me a message on my phone',say:'send me a message on my phone'},
  {k:'control',label:'Control something (motor, pump, relay)',say:'control something (a motor, pump or relay)'},
  {k:'quiet',label:'Just work quietly in the background',say:'just work quietly in the background'}];
const WC_PF={
  esphome:{label:'An ESP32 board',tip:'recommended, handles Wi-Fi',say:'an ESP32 board'},
  arduino:{label:'An Arduino',tip:'great for simple projects',say:'an Arduino'},
  raspberrypi:{label:'A Raspberry Pi',tip:'for more complex projects',say:'a Raspberry Pi'},
  auto:{label:'I\'m not sure — suggest the best one for me',tip:'',say:''}};
// chip label → the example idea (EXAMPLES) and the Step 2 boxes it ticks
const WC_EX=[['🚐 RV level checker','RV level checker',['screen','sound']],['🌤 Weather station','Weather station',['screen','phone']],
  ['🌱 Plant watering','Plant watering reminder',['led','phone']],['🚨 Motion alarm','Motion alarm',['sound','phone']],['🐾 Pet feeder','Pet feeder timer',['control']]];
const WC_STEPS=['welcome','w1','w2','w3','w4'];
const WC_MORE=['noai','nokey'];// (1.9.37) carry on without AI; no key yet: choose
// (wizard-r1) Step 4: the free program each board needs on this computer. id names the program.
const WC_TOOL={
  esphome:{id:'esphome',name:'ESPHome Device Builder',url:'https://esphome.io/install/',btn:'Get ESPHome Device Builder — it\'s free',why:'puts the settings file EvenUCan writes onto your ESP32 board',
    steps:['Go to esphome.io/install and download the Desktop App.','Run the installer.','Open ESPHome Device Builder — it will set itself up.']},
  arduino:{id:'arduino',name:'Arduino IDE',url:'https://www.arduino.cc/en/software',btn:'Download Arduino IDE 2',why:'sends the sketch your AI writes onto the Arduino board',
    steps:['Go to arduino.cc/en/software and click Download.','Run the installer.','Click Next until it\'s done.']},
  raspberrypi:{id:'pi',name:'Thonny',url:'https://thonny.org/',btn:'Download Thonny — it\'s free',why:'opens and runs the Python program your AI writes',
    steps:['Go to thonny.org and download.','Run the installer.','Open Thonny.']}};
// iw.tc = {pf, st:'checking'|'found'|'missing'|'web', path, have}. The desktop app looks on disk; a web page can only
// see ESPHome (its dashboard answers on localhost:6052 while it runs), so for Arduino/Pi it asks instead.
const wcCheckTool=function wcCheckTool(force){
  const pf=iwAi.w.pf,T=WC_TOOL[pf];if(!T)return;
  if(iwAi.tc&&iwAi.tc.pf===pf&&(iwAi.tc.st==='checking'||!force))return;
  const tc=iwAi.tc={pf,st:'checking',path:'',have:false};
  const done=(found,path)=>{if(iwAi.tc!==tc)return;tc.st=found?'found':'missing';tc.path=path||'';if(iwBack.style.display==='grid'&&iwAi.step==='w4')renderIntentAi();};
  if(window.wfNative&&window.wfNative.checkTool){
    Promise.resolve().then(()=>window.wfNative.checkTool(T.id)).then(r=>done(!!(r&&r.found),r&&r.path),e=>{console.warn('EvenUCan: could not check for '+T.name,e);done(false);});
  }else if(pf==='esphome'){
    let ac=null,t=null,signal;
    if(window.AbortSignal&&AbortSignal.timeout)signal=AbortSignal.timeout(2000);else{ac=new AbortController();signal=ac.signal;t=setTimeout(()=>ac.abort(),2000);}
    // no-cors: the dashboard sends no CORS headers; any answer at all means it's running
    fetch('http://localhost:6052/',{mode:'no-cors',cache:'no-store',signal}).then(()=>done(true,'http://localhost:6052'),()=>done(false)).finally(()=>clearTimeout(t));
  }else tc.st='web';
};
const wcSeen=()=>WFAi.store.get('welcome_seen')==='1';
// Steps 2 and 3 only add to the idea: with nothing ticked the AI gets just the Step 1 words.
const wcDesc=function wcDesc(){
  const w=iwAi.w,text=w.text.trim(),does=WC_DOES.filter(d=>w.does.includes(d.k)).map(d=>d.say);
  if(!does.length&&w.pf==='auto')return text;
  return 'I want to build: '+text.replace(/[.!\s]+$/,'')+'.'+(does.length?' It should: '+does.join('; ')+'.':'')+(w.pf!=='auto'?' I have / prefer: '+WC_PF[w.pf].say+'.':'');
};
// What's on screen now goes back into iw.w before the step changes.
const wcKeep=function wcKeep(){
  const b=$Ai('iwBody'),t=$Ai('wcDesc');if(t)iwAi.w.text=t.value;
  if(b.querySelector('[data-wdo]'))iwAi.w.does=[...b.querySelectorAll('[data-wdo]:checked')].map(e=>e.dataset.wdo);
  const r=b.querySelector('input[name="wcPf"]:checked');if(r)iwAi.w.pf=r.value;
  const n=$Ai('wcNoShow');if(n)iwAi.w.noShow=n.checked;
};
const wcProg=n=>`<div class="u-mb-6 ewNote">Step ${n} of ${WC_STEPS.length-1}</div>`;
const wcRender=function wcRender(){
  const win=$Ai('iwWin'),welcome=iwAi.welcome;
  $Ai('iwTitle').textContent=welcome?'👋 Welcome to EvenUCan':'🤔 What problem would you like to solve?';
  $Ai('iwSub').textContent=welcome?'From idea to object: tell me about your gadget and I\'ll plan the parts, the box and the code.':'Plain words are fine — tell me what\'s giving you grief and I\'ll sort out the parts, the box and the code.';
  win.style.width=welcome&&iwAi.step!=='result'?'min(620px,calc(100vw - 20px))':'min(780px,calc(100vw - 20px))';
  const f=$Ai('iwFoot');f.style.display='';
  if(!WC_STEPS.includes(iwAi.step)&&!WC_MORE.includes(iwAi.step))return false;
  const b=$Ai('iwBody'),w=iwAi.w;let focus=null;
  if(iwAi.step==='welcome'){
    b.innerHTML=`<div style="text-align:center;padding:6px 4px 2px"><div style="font-size:22px;font-weight:600;margin-bottom:4px">👋 Hello! Welcome to EvenUCan</div>
<div style="font-size:15px;margin-bottom:10px">What would you like to do today?</div></div>${aiHelperBox()}<div style="text-align:center;padding:2px 4px">
<button id="wcIdea" class="primary wcBig"><span class="u-fs-18">💡 I have an idea for a gadget</span><br><span class="u-fw-400">Tell the AI helper what it should do: it picks the parts and writes the code</span></button>
<button id="wcNoAi" class="u-mt-8 wcBig wcPlain"><span class="u-fs-15">🧰 Carry on without AI</span><br><span class="ewNote">Start from a ready-made example, or tick the parts you have</span></button>
<button id="wcDraw" class="wcBig wcPlain"><span class="u-fs-15">✏️ I want to draw something myself</span><br><span class="ewNote">(close this and use the drawing canvas)</span></button>
<div class="u-tint-box"><b>🍳 New: Open Cookbook</b> — tick the parts you own at home, set quantities, then press <b>💡 What can I build?</b> and the AI suggests up to 6 projects you can start today. Find it in the <b>Tools</b> menu or the <b>🍳 Cookbook</b> button in the top bar.</div>
<label style="display:inline-flex;gap:6px;align-items:center;margin-top:16px"><input type="checkbox" id="wcNoShow"${w.noShow?' checked':''}> Don't show this when I open a new file</label>
<div class="u-mt-4 ewNote">You can always come back with <b>💡 Start a project</b> at the top right.</div></div>`;
    f.style.display='none';f.innerHTML='';focus='wcIdea';
  }else if(iwAi.step==='w1'){
    b.innerHTML=wcProg(1)+`<div class="u-title-16">Great! Tell me about your gadget.</div>
<label for="wcDesc" style="font-weight:600;display:block;margin-bottom:4px">What should it do?</label>
<textarea id="wcDesc" rows="6" class="u-full u-fs-14 u-lh-145 u-resize-v" placeholder="e.g. I want to know when my RV is level and beep when it is. Or: a weather station that shows the forecast on a little screen. Just describe it in your own words — there are no wrong answers!">${escAi(w.text)}</textarea>
<div class="u-mt-6 u-wrap-6 ewRow"><span class="ewNote">Try an example:</span>${WC_EX.map(([l],k)=>`<button data-wex="${k}" class="u-pill">${escAi(l)}</button>`).join('')}</div>
${iwAi.err?`<div class="u-mt-8 bad">${escAi(iwAi.err)}</div>`:''}`+
      (aiKeyAi()?'':`<div class="u-mt-8 ewNote"><span class="warn">The AI helper (${escAi(PROVIDERSAi[aiProvAi()].name)}) needs a free key before it can plan this:</span> <button id="iwKey">${escAi(_intAi.keyLabel())}</button> or <button id="wcNoAi">Carry on without AI</button></div>`);
    f.innerHTML='<button id="wcBack1">← Back</button><button id="wcNext1" class="primary">Next →</button>';focus='wcDesc';
  }else if(iwAi.step==='w2'){
    b.innerHTML=wcProg(2)+`<fieldset class="u-reset-btn"><legend style="font-size:16px;font-weight:600;margin-bottom:8px;padding:0">What should it show or do when it's working?</legend>`+
      WC_DOES.map(d=>`<label class="u-row u-my-7 u-fs-14"><input type="checkbox" data-wdo="${d.k}"${w.does.includes(d.k)?' checked':''}> ${escAi(d.label)}</label>`).join('')+
      `</fieldset><div class="u-mt-6 ewNote">Optional: tick what you want, or just click Next and I'll work it out.</div>`;
    f.innerHTML='<button id="wcBack2">← Back</button><button id="wcNext2" class="primary">Next →</button>';focus='[data-wdo]';
  }else if(iwAi.step==='w3'){
    b.innerHTML=wcProg(3)+`<fieldset class="u-reset-btn"><legend style="font-size:16px;font-weight:600;margin-bottom:4px;padding:0">What equipment do you have?</legend>
<div class="u-mb-6 ewNote">Or leave it on "not sure" and I'll suggest what to buy.</div>`+
      Object.entries(WC_PF).map(([k,p])=>`<label class="u-row u-my-7 u-fs-14"><input type="radio" name="wcPf" value="${k}"${w.pf===k?' checked':''}> ${escAi(p.label)}${p.tip?` <span class="ewNote">← ${escAi(p.tip)}</span>`:''}</label>`).join('')+
      `</fieldset>${iwAi.err?`<div class="u-mt-8 bad">${escAi(iwAi.err)}</div>`:''}`;
    f.innerHTML='<button id="wcBack3">← Back</button><button id="wcGo" class="primary">Let\'s go! →</button>';focus='input[name="wcPf"]:checked';
  }else if(iwAi.step==='w4'){
    // (wizard-r1) Step 4: is the software for this board on the computer? Next only once it is (or ticked on the web); Skip always works.
    const pf=iwAi.w.pf,T=WC_TOOL[pf],P=PLATFORMSAi[pf];
    if(!T){iwAi.step='w3';return wcRender();}
    wcCheckTool(false);
    const tc=iwAi.tc,desk=!!(window.wfNative&&window.wfNative.checkTool);
    const guide=`<a class="wcBig primary" href="${escAi(T.url)}" target="_blank" rel="noopener">⬇ ${escAi(T.btn)}</a>
<div style="font-weight:600;margin-top:6px">How to install it:</div><ol style="margin:4px 0 0;padding-left:22px;font-size:14px">${T.steps.map(x=>`<li style="margin:3px 0">${escAi(x)}</li>`).join('')}</ol>`;
    let h=wcProg(4)+`<div style="font-size:16px;font-weight:600;margin-bottom:4px">Have you got the software for it?</div>
<div class="u-mb-8 ewNote">${P.icon} ${escAi(P.name)} needs <b>${escAi(T.name)}</b> (free): it ${escAi(T.why)}.</div>`;
    if(tc.st==='checking')h+=`<div style="font-size:14px;margin:12px 0" aria-live="polite"><span class="wcSpin">⟳</span> Checking your computer...</div>`;
    else if(tc.st==='found')h+=`<div class="ok" style="font-size:15px;margin:12px 0" aria-live="polite">✓ ${escAi(T.name)} is ${desk?'installed and ready. We\'ll send your code straight to it when you\'re done.':'running on this computer and ready.'}</div>`+(tc.path?`<div class="ewNote">Found: ${escAi(tc.path)}</div>`:'');
    else if(tc.st==='missing')h+=`<div class="warn" style="font-size:15px;margin:12px 0 4px" aria-live="polite">✗ I couldn't find ${escAi(T.name)} on this computer${desk?'':' (it isn\'t running right now)'}.</div>
<div style="font-size:14px">No problem — it's free and only takes a few minutes to install.</div>${guide}`+
      (desk?'':`<div class="u-mt-6 ewNote">Already installed? Open ${escAi(T.name)} first so I can see it, then check again.</div>`)+
      `<div class="u-mt-10 ewRow"><button id="wcRecheck4">I've installed it — check again</button></div>`;
    else h+=`<div style="font-size:14px;margin:8px 0">A web page can't see what's installed on your computer, so I can't check for you. If you haven't got it yet:</div>${guide}
<label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:14px"><input type="checkbox" id="wcHave4"${tc.have?' checked':''}> I've got ${escAi(T.name)}</label>`;
    if(iwAi.err)h+=`<div class="u-mt-8 bad">${escAi(iwAi.err)}</div>`;
    b.innerHTML=h;
    const can=tc.st==='found'||(tc.st==='web'&&tc.have);
    f.innerHTML=`<button id="wcBack4">← Back</button><button id="wcSkip4">Skip for now →</button><button id="wcNext4" class="primary"${can?'':' disabled title="Install it first (or skip for now)"'}>Next →</button>`;
    focus=tc.st==='missing'?'wcRecheck4':tc.st==='web'?'wcHave4':can?'wcNext4':'wcSkip4';
  }
  else if(iwAi.step==='noai'){
    const ticked=iwAi.noai.parts,pf=iwAi.noai.pf;
    b.innerHTML=`<div style="font-size:16px;font-weight:600;margin-bottom:2px">🧰 Carry on without AI</div>
<div class="u-mb-8 ewNote">Nothing is sent anywhere. You choose the parts; EvenUCan still designs the box, works out the wiring and writes the ESPHome code. For an Arduino board you get a starter sketch with the pins filled in, for you to finish.</div>
<div style="font-weight:600;margin:6px 0 4px">Start from a ready-made example:</div>
<div style="display:flex;flex-wrap:wrap;gap:6px">${NOAI_EX.map((x,k)=>`<button data-noex="${k}" title="${escAi(x.what)}" style="text-align:left">${escAi(x.label)}<br><span class="ewNote">${escAi(x.what)}</span></button>`).join('')}</div>
<div style="font-weight:600;margin:12px 0 4px">Or tick the parts you want (from the built-in library):</div>
<div style="columns:2;column-gap:14px">${noaiChoices().map(c=>`<label style="display:flex;gap:6px;align-items:flex-start;margin:3px 0;break-inside:avoid"><input type="checkbox" data-noai="${escAi(c.v)}"${ticked.includes(c.v)?' checked':''}> <span>${escAi(c.name)}</span></label>`).join('')}</div>
<div class="ewNote">Not here? Add it later in <b>Tools → Parts library</b>.</div>
<fieldset style="border:none;padding:0;margin:10px 0 0"><legend style="font-weight:600;padding:0;margin-bottom:4px">Which board?</legend>${Object.entries(PLATFORMSAi).map(([k,P])=>`<label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="radio" name="noaiPf" value="${k}"${pf===k?' checked':''}> ${P.icon} ${escAi(P.name)} <span class="ewNote">(${escAi(P.code)})</span></label>`).join('')}</fieldset>
${iwAi.err?`<div class="u-mt-8 bad">${escAi(iwAi.err)}</div>`:''}`;
    f.innerHTML='<button id="wcNoAiBack">← Back</button><button id="wcNoAiGo" class="primary">Next: check the parts →</button>';focus='[data-noex]';
  }else if(iwAi.step==='nokey'){
    b.innerHTML=`<div class="u-title-16">The AI helper needs a key first</div>
<div style="font-size:14px;margin-bottom:10px">To turn your idea into a parts list, EvenUCan asks a free online AI, and that needs a key (a kind of password from the AI company). Getting one takes about two minutes and costs nothing.</div>
${aiHelperBox(true)}
<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px"><button id="nkKey" class="primary wcBig"><span class="u-fs-15">🔑 Set up a free key now</span><br><span class="u-fw-400">then I'll carry on with your idea</span></button>
<button id="wcNoAi" class="wcBig wcPlain"><span class="u-fs-15">🧰 Carry on without AI</span><br><span class="ewNote">pick a ready-made example or tick the parts yourself</span></button></div>`;
    f.innerHTML='<button id="nkBack">← Back</button>';focus='nkKey';
  }
  setTimeout(()=>{const el=focus&&(focus[0]==='['||focus.includes(':')?b.querySelector(focus):$Ai(focus));if(el&&iwBack.style.display==='grid')el.focus();},0);
  return true;
};
// (1.9.37) "About the AI helper": honest about what is sent where, which keys work, and whether one is set up.
const aiHelperBox=function aiHelperBox(short){
  const has=!!aiKeyAi(),P=PROVIDERSAi[aiProvAi()];
  return `<div class="u-help-box aiHelp">
<div style="font-weight:600;font-size:14px">🤖 About the AI helper</div>
${short?'':'<div>When you describe an idea, an AI turns it into a parts list and writes the Arduino sketch. EvenUCan comes pre-configured with a built-in Local AI specialist (Local AI + Qwen Coder) that runs 100% offline on this computer with zero internet and zero keys needed, or you can connect a cloud AI key if you prefer.</div>'}
<div style="font-size:12px;color:var(--text2);margin:6px 0 2px;font-weight:600">Offline & Free AI:</div>
<div class="ewRow" style="flex-wrap:wrap;gap:6px;margin:0 0 8px"><button id="wcAiLocal" class="primary" style="font-weight:bold">⚡ Local AI (Offline Specialist)</button><button id="wcAiGem">🆓 Google Gemini</button><button id="wcAiGroq">🆓 Groq</button><button id="wcAiOr">🆓 OpenRouter</button></div>
<div style="font-size:12px;color:var(--text2);margin:2px 0 2px;font-weight:600">Paid keys (very cheap, most capable):</div>
<div class="ewRow" style="flex-wrap:wrap;gap:6px;margin:0 0 4px"><button id="wcAiCl">💳 Claude (Anthropic)</button><button id="wcAiOa">💳 ChatGPT (OpenAI)</button><button id="wcAiDs">💳 DeepSeek</button><button id="wcAiGrok">💳 Grok (xAI)</button></div>
<div class="ewNote">Paid keys cost a fraction of a cent per run — DeepSeek is the cheapest.</div>
<div class="u-mt-4">${has?`<span class="ok">✓ ${escAi(P.name)} is ready${P.noKey?' (offline, no key needed)':' (key saved)'}.</span> <button id="wcAiTest">Configure / test...</button>`:'<span class="warn">No AI key is set up yet.</span> You can set one up now or later.'}</div>
<div class="u-mt-4 ewNote">Local AI runs directly on this computer and sends nothing anywhere over the internet. What you type about your idea stays completely private. The drawing, box design, wiring and ESPHome code also don\'t need the internet.</div></div>`;
};
// (1.9.37) Carry on without AI: ready-made examples (common modules and built-in parts, no look-up needed)
const NOAI_EX=[
  {label:'🚐 Level checker',what:'Screen, beeper and tilt sensor; Arduino IDE on an ESP32',pf:'esp32ide',name:'level-checker',parts:['cm:p-cm-ssd1306','cm:p-cm-buzzer','cm:p-cm-mpu6050'],desc:'A level checker: shows the tilt on a small screen and beeps when it is level.'},
  {label:'🌡 Room climate display',what:'Temperature, humidity and pressure on a small screen; ESPHome',pf:'esphome',name:'room-climate',parts:['cm:p-cm-bme280','cm:p-cm-ssd1306'],desc:'Shows the room temperature, humidity and pressure on a small screen and reports them to Home Assistant.'},
  {label:'🚶 Motion alarm',what:'Motion sensor, beeper and a coloured light; ESPHome',pf:'esphome',name:'motion-alarm',parts:['cm:p-cm-pir','cm:p-cm-buzzer','cm:p-cm-ws2812'],desc:'Beeps and lights up when someone walks past.'},
  {label:'💧 Leak alarm',what:'Water sensor and beeper; ESPHome',pf:'esphome',name:'leak-alarm',parts:['cm:p-cm-water','cm:p-cm-buzzer'],desc:'Beeps when the water sensor gets wet.'},
  {label:'💡 Light-controlled lamp',what:'Light sensor, coloured light and a button; Arduino Nano',pf:'arduino',name:'night-light',parts:['cm:p-cm-bh1750','cm:p-cm-ws2812','cm:p-cm-button'],desc:'A night light that turns on when it gets dark, with a button to switch it.'}
];
// the parts to tick: the common modules, then the built-in parts that aren't boards or power
const noaiChoices=function noaiChoices(){
  const out=COMMON_MODS.map(m=>({v:'cm:'+m.part.id,name:m.part.name}));
  for(const p of allPartsAi())if(p.builtin&&!CTRL_IDSAi.includes(p.id)&&!p.mcu&&!/^p-cm-/.test(p.id)&&!['b-tp4056c','b-lipo1000','b-18650','b-ss12'].includes(p.id))out.push({v:'p:'+p.id,name:p.name});
  return out;
};
const noaiPart=function noaiPart(v){
  if(v.startsWith('cm:')){const m=COMMON_MODS.find(m=>m.part.id===v.slice(3));return m?commonPart(m):null;}
  return partByIdAi(v.slice(2));
};
// Sets the wizard up exactly as if the AI had answered, from the parts chosen here (then: check the parts → box → wiring → code).
const noaiPlan=function noaiPlan(vals,pf,name,desc){
  const parts=vals.map(noaiPart).filter(Boolean);
  if(!parts.length){iwAi.err='Tick at least one part, or pick an example.';return renderIntentAi();}
  iwAi.desc=desc||('My gadget with: '+parts.map(p=>p.name).join(', ')+'.');
  iwAi.analysis=tidyIntent({name:name||'my-gadget',summary:'Parts picked without AI.',platform:pf,parts:[]},iwAi.desc);iwAi.analysis.noAI=true;
  iwAi.pf=pfOkAi(pf);iwAi.override=false;iwAi.missingAdded=[];iwAi.vals={};iwAi.userPf=null;
  iwAi.base=parts.map(part=>({spec:{category:'added',function:'picked by you',search:part.name,required:true},part,from:'your choice',note:''}));
  iwAi.matches=pfMatchesAi(iwAi.base,iwAi.pf);iwAi.power='usb';iwAi.dropped=[];iwAi.edit=false;iwAi.err='';iwAi.step='result';
  renderIntentAi();
};
const noaiKeep=function noaiKeep(){
  const b=$Ai('iwBody');if(!b.querySelector('[data-noai]'))return;
  iwAi.noai.parts=[...b.querySelectorAll('[data-noai]:checked')].map(e=>e.dataset.noai);
  const r=b.querySelector('input[name="noaiPf"]:checked');if(r)iwAi.noai.pf=r.value;
};
// auto: only on a fresh, empty drawing, and not if the user asked for it not to show again
const openWelcomeAi=function openWelcomeAi(auto){
  if(auto&&(wcSeen()||!WFAi.docEmpty||[ewBackAi,plBackAi,wrBackAi,iwBack].some(x=>x.style.display==='grid')))return;
  if(iwAi.step==='result'&&!iwAi.busy)iwAi.w={text:'',does:[],pf:'auto',noShow:false};// a finished idea: start the next one afresh
  if(iwAi.step==='nokey'&&!iwAi.busy)iwAi.step='ask';
  iwAi.welcome=false;iwAi.w.noShow=wcSeen();iwAi.err='';
  if(!iwAi.busy)iwAi.step='ask';
  iwBack.style.display='grid';renderIntentAi();
};
const wcGo=async function wcGo(){
  wcKeep();iwAi.err='';
  if(!aiKeyAi()){iwAi.nokeyFrom='wc';iwAi.step='nokey';return renderIntentAi();}// (1.9.37) a choice, not a dead end
  iwAi.desc=wcDesc();iwAi.userPf=iwAi.w.pf==='auto'?null:iwAi.w.pf;
  await intentAnalyse();
};
iwBack.addEventListener('click',e=>{
  const el=e.target.closest('button');if(!el||!iwBack.contains(el))return;
  const go=s=>{wcKeep();iwAi.err='';iwAi.step=s;renderIntentAi();};
  const run=()=>wcGo().catch(err=>{console.error('EvenUCan: the welcome idea could not be planned',err);iwAi.step='error';iwAi.err='Something went wrong: '+(err.message||err);renderIntentAi();});
  if(el.dataset.noex!==undefined){const x=NOAI_EX[+el.dataset.noex];if(x){iwAi.noai={parts:[...x.parts],pf:x.pf};noaiPlan(x.parts,x.pf,x.name,x.desc);}return;}
  if(el.dataset.wex!==undefined){const x=WC_EX[+el.dataset.wex];if(!x)return;wcKeep();iwAi.w.text=EXAMPLES[x[1]]||'';iwAi.w.does=[...x[2]];
    const t=$Ai('wcDesc');if(t){t.value=iwAi.w.text;t.focus();}WFAi.flash('Filled in the example, and ticked what it does in Step 2',3500);return;}
  switch(el.id){
    case 'wcIdea':go('w1');break;
    case 'wcDraw':wcKeep();closeIntentAi();break;
    case 'wcNoAi':wcKeep();iwAi.welcome=true;iwAi.err='';iwAi.step='noai';renderIntentAi();break;
    case 'wcNoAiBack':noaiKeep();go('welcome');break;
    case 'wcNoAiGo':noaiKeep();iwAi.err='';noaiPlan(iwAi.noai.parts,iwAi.noai.pf,'','');break;
    case 'wcAiGem':askKeyAi('gemini').then(renderIntentAi);break;
    
    case 'wcAiGroq':askKeyAi('groq').then(renderIntentAi);break;
    case 'wcAiOr':askKeyAi('openrouter').then(renderIntentAi);break;
    case 'wcAiLocal':askKeyAi('localai').then(renderIntentAi);break;
    case 'wcAiCl':askKeyAi('claude').then(renderIntentAi);break;
    case 'wcAiOa':askKeyAi('openai').then(renderIntentAi);break;
    case 'wcAiDs':askKeyAi('deepseek').then(renderIntentAi);break;
    case 'wcAiGrok':askKeyAi('grok').then(renderIntentAi);break;
    case 'wcAiTest':askKeyAi(aiProvAi()).then(renderIntentAi);break;
    case 'nkKey':askKeyAi().then(()=>{if(!aiKeyAi())return renderIntentAi();if(iwAi.nokeyFrom==='ask'){iwAi.welcome=false;iwAi.step='ask';intentAnalyse();}else run();});break;
    case 'nkBack':iwAi.err='';if(iwAi.nokeyFrom==='ask'){iwAi.welcome=false;iwAi.step='ask';renderIntentAi();}else go('w3');break;
    case 'wcBack1':go('welcome');break;
    case 'wcNext1':wcKeep();if(iwAi.w.text.trim().length<8){iwAi.err='Tell me a little about what it should do first (a sentence or two is plenty), or pick an example.';renderIntentAi();}else go('w2');break;
    case 'wcBack2':go('w1');break;
    case 'wcNext2':go('w3');break;
    case 'wcBack3':go('w2');break;
    case 'wcGo':wcKeep();if(WC_TOOL[iwAi.w.pf])go('w4');else run();break;// (wizard-r1) a chosen board: check its software first
    case 'wcBack4':go('w3');break;
    case 'wcSkip4':run();break;
    case 'wcNext4':if(!el.disabled)run();break;
    case 'wcRecheck4':iwAi.err='';wcCheckTool(true);renderIntentAi();break;
    case 'rdParts':WFAi.download(_intAi.readySlug()+'-parts.txt',_intAi.readyParts(),'text/plain');break;
    case 'rdStl':downloadBoxAi('stl');break;
    case 'rd3mf':downloadBoxAi('3mf');break;
    case 'rdBox':closeIntentAi();gStepAi='box';openWizardAi();break;
    case 'rdWire':WFAi.download(_intAi.readySlug()+'-wiring.txt',_intAi.readyWiring(),'text/plain');break;
    case 'rdCode':{const c=currentCodeAi();if(c)WFAi.download(c.name,c.text,'text/plain');break;}
    case 'rdIde':openInIdeAi();break;
    case 'rdToCode':case 'rdBack':iwAi.step='result';iwBack.style.display='none';_intAi.guideGo('code');break;
    case 'rdClose':closeIntentAi();break;
  }
});
iwBack.addEventListener('change',e=>{if(e.target.id==='wcNoShow')iwAi.w.noShow=e.target.checked;
  else if(e.target.id==='wcHave4'){if(iwAi.tc)iwAi.tc.have=e.target.checked;const n=$Ai('wcNext4');if(n){n.disabled=!e.target.checked;n.title=n.disabled?'Install it first (or skip for now)':'';}}});
// Keyboard: Tab stays inside the window, Ctrl+Enter in the idea box is Next (Esc closes, as for every window).
iwBack.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&e.target.id==='wcDesc'){e.preventDefault();$Ai('wcNext1').click();return;}
  if(e.key!=='Tab')return;
  const els=[...iwBack.querySelectorAll('button,input,textarea,select,a[href]')].filter(x=>!x.disabled&&x.offsetParent!==null);
  if(!els.length)return;const a=els[0],z=els[els.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}
});
$Ai('ewIntent').onclick=openIntentAi;
$Ai('bBuild').onclick=()=>openWelcomeAi(false);
$Ai('bCookbook').onclick=()=>openCookbook();
// Projects: the saved-projects list lives in the Enclosure window, so open that and show the list.
$Ai('bProjects').onclick=()=>{const enc=$('bEnclosure');if(enc)enc.click();setTimeout(()=>{const panel=$('ewProjPanel');if(panel){panel.style.display='block';ewProjRender();setTimeout(()=>{const inp=$('ewProjName');if(inp)inp.focus();},50);}},300);};
$Ai('iwX').onclick=closeIntentAi;
$Ai('iwFoot').addEventListener('click',e=>{
  const id=e.target.id;
  if(id==='iwGo'){const t=$Ai('iwDesc');if(t)iwAi.desc=t.value.trim();if(iwAi.desc.length<8){iwAi.err='Tell me a little more (a sentence or two is plenty).';return renderIntentAi();}iwAi.err='';iwAi.step='clarify';renderIntentAi();}
  else if(id==='iwClBack'){iwAi.step='ask';iwAi.err='';renderIntentAi();}
  else if(id==='iwClGo'){const r=$Ai('iwBody').querySelector('input[name="iwClPow"]:checked');const ph=$Ai('iwClPhone');iwAi.clarify={power:r?r.value:'usb',phone:ph?ph.checked:true};intentAnalyse();}
  else if(id==='iwRetry')intentAnalyse();
  else if(id==='iwCancel')closeIntentAi();
  else if(id==='iwEdit'){iwAi.step=iwAi.analysis&&iwAi.analysis.noAI?'noai':iwAi.welcome?'w1':'ask';if(iwAi.step==='noai')iwAi.welcome=true;iwAi.err='';renderIntentAi();}
  else if(id==='iwAgain'){iwKeepVals();iwAi.edit=!iwAi.edit;renderIntentAi();if(iwAi.edit){const h=$Ai('iwEditor');if(h)h.scrollIntoView({block:'nearest'});const sel=$Ai('iwAddSearch');if(sel)sel.focus();}}// (wizard-r2) change the parts, not the idea
  else if(id==='iwRestart')_intAi.guideRestart();
  else if(id==='iwApply')intentApply().catch(err=>{console.error('EvenUCan: could not set up the project idea',err);iwAi.step='error';iwAi.err='Could not set up the enclosure: '+(err.message||err);iwAi.raw='';renderIntentAi();});
});
let _iwLib=null,_iwLibSrc=null,_iwPick={},_iwSearchTimer=0;
const iwLibList=async function iwLibList(){
  if(_iwLib&&_iwLib.length)return _iwLib;
  try{const src=await _intAi.partsSource(false);if(src){_iwLibSrc=src;_intAi.partsSrc=src;_iwLib=await src.list();}}catch(e){console.warn('EvenUCan: could not open the parts library for the parts search',e);}
  if(!_iwLib||!_iwLib.length){_iwLib=[];} // JSON databases disconnected; AI lookup used at search time
  return _iwLib||[];
};
const iwOwnList=function iwOwnList(){
  return COMMON_MODS.map((m,i)=>({v:'cm:'+i,title:m.part.name,family:'Common module',tags:[m.part.type],desc:''}))
    .concat(allPartsAi().filter(p=>!CTRL_IDSAi.includes(p.id)).map(p=>({v:'p:'+p.id,title:p.name,family:p.builtin?'Built-in part':'Your parts',tags:[p.type],desc:String(p.notes||'').slice(0,300)})));
};
const iwAddSearchRun=async function iwAddSearchRun(q){
  try{await iwLibList();}catch(e){console.warn('EvenUCan: the ready-made parts could not be listed',e);}
  const box=$Ai('iwAddResults');if(!box)return;
  const now=$Ai('iwAddSearch');if(!now||now.value.trim()!==q)return;
  const own=searchPartsAi(iwOwnList(),q,'all').slice(0,40),ready=searchPartsAi(_iwLib||[],q,'all').slice(0,60);
  const row=(v,t,sub)=>`<div class="iwAddRow" data-v="${escAi(v)}" style="display:flex;align-items:center;gap:8px;padding:4px 10px;cursor:pointer;border-bottom:1px solid color-mix(in srgb,var(--line) 45%,transparent)"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${escAi(t)}</b> <span class="ewNote">${escAi(sub)}</span></span><span class="ewNote">click to add</span></div>`;
  let html='';
  if(own.length)html+='<div class="u-pad-5-10 ewNote"><b>Your parts</b></div>'+own.map(h=>row(h.v,h.title,h.family)).join('');
  if(ready.length)html+='<div class="u-pad-5-10 ewNote"><b>Ready-made parts library</b></div>'+ready.map(h=>row(h._pick?'__pick:'+h._pick:'libid:'+h.id,h.title,h._src||(h.family||''))).join('');
  // AI parts search (databases disconnected — AI used instead)
  html+='<div class="u-pad-5-10 ewNote"><b>AI Parts Search</b></div>'+row('__ailookup:'+q,aiKeyAi()?'🤖 Look up "'+q+'" with AI…':'🤖 AI parts search',aiKeyAi()?'asks your AI for sizes and pins (approximate)':'set up an AI key first — click "AI helper key…" above');
  box.innerHTML=html;
};
const iwAddPick=async function iwAddPick(v){
  iwKeepVals();
  let part=null,from='your choice';
  try{
    if(v.startsWith('cm:'))part=commonPart(COMMON_MODS[+v.slice(3)]);
    else if(v.startsWith('p:'))part=partByIdAi(v.slice(2));
    else if(v.startsWith('libid:')){
      if(!_iwLibSrc){const src=await _intAi.partsSource(false);if(src){_iwLibSrc=src;_intAi.partsSrc=src;}}
      if(!_iwLibSrc)return WFAi.flash('The ready-made parts library isn\'t loaded. Open Parts → Browse parts… once, then try again.',7000);
      part=await importLibPart(_iwLibSrc,v.slice(6));if(part)from='parts library';
    }else if(v.startsWith('__pick:')){
      const raw=_iwPick[v.slice(7)];
      if(raw){part=lookupToPart(_dbToLookupData(raw,raw.title||''),raw.title||'');part.source=raw._src||'';
        part.notes='Pin positions and board size from '+(raw._src||'the parts library')+'. Component height is estimated at '+part.h+' mm — check yours.';
        customAi.push(part);if(!saveLibAi()){customAi.pop();part=null;}else from=raw._src||'parts library';}
    }else if(v.startsWith('__ailookup:')){
      const q=v.slice(11);
      if(!aiKeyAi()){await askKeyAi();if(!aiKeyAi())return WFAi.flash('Set up an AI key first — click "AI helper key…" in the menu.',5000);}
      // Step 1: verify the part fully (pins + dimensions) and store in Parts Library
      WFAi.flash('Verifying "'+q+'" — checking pins and dimensions…',10000);
      const dbRec=await verifyPartWithAI(q);
      // Step 2: also get the layout data for the EvenUCan enclosure (LOOKUP_PROMPT gives x/y coords)
      WFAi.flash('Asking AI for layout data…',8000);
      const {data:d}=await callAI(LOOKUP_PROMPT+'\n\nThe part: "'+q+'"\nWhat it does: a hobby electronics module.');
      if(!d||typeof d!=='object')throw new Error('garbled: no part data');
      if(d.unknown)return WFAi.flash('The AI doesn\'t know this part: '+(d.notes||'try a more specific name.'),6000);
      if(!(parseFloat(d.width_mm)>0)||!(parseFloat(d.height_mm)>0))throw new Error('garbled: no sizes');
      // If we got better dimensions from the verify step, use those
      if(dbRec&&dbRec.dimensions&&dbRec.dimension_status!=='UNVERIFIED'){
        const dim=dbRec.dimensions;
        if(dim.length_mm>0){d.width_mm=dim.length_mm;d.height_mm=dim.width_mm;d.depth_mm=dim.height_mm;}
      }
      part=lookupToPart(d,q);
      // Carry dimension status into the part notes
      if(dbRec){
        if(dbRec.dimension_status==='UNVERIFIED'){
          part.notes=(part.notes||'')+'\n⚠ DIMENSIONS UNVERIFIED: measure this part and update it in Parts Library before printing an enclosure.';
          part.approximate=true;
        } else if(dbRec.dimension_status==='ESTIMATED'){
          part.notes=(part.notes||'')+'\n⚠ Dimensions estimated — confirm in Parts Library for a perfect fit.';
          part.approximate=true;
        }
      }
      customAi.push(part);if(!saveLibAi()){customAi.pop();return WFAi.flash('Couldn\'t save the part.',4000);}
      from='AI lookup';
      if(dbRec&&dbRec.dimension_status==='UNVERIFIED'){
        WFAi.flash('⚠ Added "'+part.name+'" — dimensions unknown. Measure it and update Parts Library.',8000);
      } else {
        WFAi.flash('Added "'+part.name+'" to your library'+(dbRec?' ('+dbRec.dimension_status.toLowerCase()+' dimensions)':' (approximate)'),5000);
      }
    }
  }catch(err){console.error('EvenUCan: could not add the chosen part',err);return WFAi.flash('Couldn\'t add that part: '+(err.message||err),7000);}
  if(!part)return WFAi.flash('Couldn\'t add that part.',5000);
  iwAi.base.push({spec:{category:'added',function:'added by you',search:part.name,required:true},part,from,note:''});
  iwAi.matches=pfMatchesAi(iwAi.base,iwAi.pf);renderIntentAi();WFAi.flash('Added '+part.name,3000);
};
$Ai('iwBody').addEventListener('click',e=>{
  const rowEl=e.target.closest('.iwAddRow');
  if(rowEl)return iwAddPick(rowEl.dataset.v||'');
  const el=e.target.closest('button');if(!el)return;
  if(el.id==='iwKey')askKeyAi().then(renderIntentAi);
  else if(el.dataset.ex){iwAi.desc=EXAMPLES[el.dataset.ex]||'';const t=$Ai('iwDesc');if(t){t.value=iwAi.desc;t.focus();}}
  else if(el.dataset.pf){iwKeepVals();intentSetPf(el.dataset.pf);}
  else if(el.dataset.look!==undefined){iwKeepVals();lookupPart(+el.dataset.look);}
  else if(el.dataset.capfix){iwKeepVals();const a=el.dataset.capfix;
    if(PLATFORMSAi[a])intentSetPf(a);
    else{if(/^drop-/.test(a))iwAi.dropped=[...new Set([...(iwAi.dropped||[]),a.slice(5)])];else if(/^pow-/.test(a))iwAi.power=a.slice(4);renderIntentAi();}}
  else if(el.dataset.iwdel!==undefined){iwKeepVals();const k=+el.dataset.iwdel;if(k>0&&iwAi.base[k-1]){iwAi.base.splice(k-1,1);iwAi.matches=pfMatchesAi(iwAi.base,iwAi.pf);renderIntentAi();}}
});
$Ai('iwBody').addEventListener('change',e=>{if(e.target.name==='iwPow'){iwKeepVals();iwAi.power=e.target.value;renderIntentAi();}});
$Ai('iwBody').addEventListener('input',e=>{const t=e.target;
  if(t.id==='iwSsid')wifiMemAi.ssid=t.value;else if(t.id==='iwPass')wifiMemAi.pass=t.value;
  else if(t.id==='iwAddSearch'){clearTimeout(_iwSearchTimer);const q=t.value.trim();
    _iwSearchTimer=setTimeout(async()=>{const box=$Ai('iwAddResults');if(!box)return;
      if(!q){box.innerHTML='<div class="u-pad-6-8 ewNote">Type above to search your own parts and the full ready-made library.</div>';return;}
      box.innerHTML='<div class="u-pad-6-8 ewNote">Searching…</div>';
      try{await iwAddSearchRun(q);}catch(err){console.error('EvenUCan: parts search failed',err);}
    },200);}
  else if(t.dataset.iw==='ntfy_topic'){iwAi.vals.ntfy_topic=t.value;const box=$Ai('iwBody').querySelector('.ntfyBox');if(box){box.querySelector('.topic').textContent=t.value.trim();box.querySelector('[data-copytext]').dataset.copytext=t.value.trim();}}});
$Ai('iwBody').addEventListener('keydown',e=>{if(e.target.id==='iwDesc'&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)){const desc=(e.target.value||'').trim();if(desc.length>=8){iwAi.desc=desc;iwAi.err='';iwAi.step='clarify';renderIntentAi();}else{iwAi.err='Tell me a little more (a sentence or two is plenty).';renderIntentAi();}}});
$Ai('ewIntentMsg').addEventListener('click',e=>{if(e.target.id==='ewIntentHide')$Ai('ewIntentMsg').style.display='none';else if(e.target.id==='ewIntentCode')intentCodeAi();});

// Ready-made project ideas for the Cookbook ("Ready-made ideas" tab).
// parts: [library id, name to show if that part is not in the parts list yet]. extra: things to buy that are not parts in the library.
// build: what the project wizard is told when the user presses "Build this".
const COOKBOOK_RECIPES=[
  {id:'r-tripwire',where:'House',icon:'🚪',title:'Doorway tripwire alarm',
   blurb:'A red laser shines across a doorway onto a receiver. Break the beam and a buzzer sounds, or your phone gets a message.',
   parts:[['c-ky-008-laser-transmitter-module-650-nm','KY-008 laser module'],['c-laser-receiver-module-tripwire','Laser receiver module'],['c-active-buzzer-12-mm-5v','Active buzzer'],['p-esp32-devkit38','ESP32 DevKit'],['b-tp4056c','TP4056 charger'],['b-lipo1000','LiPo battery']],
   extra:['A small mirror or two to bend the beam round a corner (optional)','Never point the laser at eyes: keep the beam low and marked'],
   build:'A doorway tripwire alarm. A red laser module shines across the doorway onto a laser receiver module on an ESP32. When the beam is broken, a buzzer sounds and the ESP32 sends a notification. Battery powered with a USB charger board.'},
  {id:'r-air-watch',where:'House',icon:'🔥',title:'Kitchen and workshop air watch',
   blurb:'Smoke, carbon monoxide and air-quality sensors with a screen and a beeper, so you can see the air at a glance.',
   parts:[['c-mq-2-smoke-and-flammable-gas-sensor-module','MQ-2 smoke sensor'],['c-mq-7-carbon-monoxide-co-sensor-module','MQ-7 CO sensor'],['c-active-buzzer-12-mm-5v','Active buzzer'],['p-cm-ssd1306','OLED display'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['A proper smoke and CO alarm as well: this is a hobby gadget, NOT a certified alarm','Gas sensors need 24-48 hours of burn-in before the readings settle'],
   build:'A kitchen and workshop air monitor on an ESP32 with an MQ-2 smoke sensor, an MQ-7 carbon monoxide sensor, an OLED screen showing the readings and a buzzer that beeps above a set level. Needs vent slots over the sensors.'},
  {id:'r-night-light',where:'House',icon:'🌙',title:'Motion night light',
   blurb:'Walk into the hall at night and a soft strip light fades up, then fades out again. It stays off in daylight.',
   parts:[['c-hc-sr501-pir-motion-sensor','HC-SR501 PIR'],['c-ws2812b-addressable-led-strip-5v-1-m-60-leds','WS2812B LED strip'],['c-ky-018-photoresistor-ldr-light-sensor-module','Light sensor'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['A 5V power supply of 2 A or more for a long strip'],
   build:'A motion night light. A PIR motion sensor and a light sensor on an ESP32 control a WS2812B addressable LED strip: it fades up when someone walks past in the dark and fades out after a minute.'},
  {id:'r-climate',where:'House',icon:'🌡️',title:'Room climate display',
   blurb:'Temperature, humidity, air pressure and light level on a little screen, and sent to your phone or home system.',
   parts:[['p-cm-bme280','BME280 sensor'],['p-cm-bh1750','BH1750 light sensor'],['p-cm-ssd1306','OLED display'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:[],
   build:'A room climate display on an ESP32 with a BME280 temperature, humidity and pressure sensor, a BH1750 light sensor and an OLED screen that shows all four readings.'},
  {id:'r-mains-switch',where:'House',icon:'💡',title:'Wi-Fi switch for a lamp or fan',
   blurb:'Switch a lamp, fan or heater from your phone or on a timer, using a relay board and an ESP32.',
   parts:[['c-1-channel-5v-relay-module','1-channel relay board'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['CARE: mains voltage can kill. Keep the mains side in a closed box with a proper fused plug and cable, or practise first with a low-voltage lamp'],
   build:'A Wi-Fi switch on an ESP32 with a 1-channel relay board to turn a lamp or fan on and off from a phone or a timer.'},
  {id:'r-mood',where:'House',icon:'🎨',title:'Mood lighting (one colour at a time)',
   blurb:'A simple 12V colour strip behind the TV or under a shelf. Pick any colour from your phone: the whole strip shows the same colour.',
   parts:[['c-rgb-led-strip-12v-5050-4-wire-one-colour-at-a-ti','RGB LED strip 12V'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['3 MOSFET modules or a 3-channel MOSFET board (the ESP32 cannot drive the strip directly)','A 12V power supply (1.2 A per metre of strip)'],
   build:'Mood lighting with a 12V RGB LED strip (4-wire, one colour at a time) driven through three MOSFETs from an ESP32, with colour and brightness chosen from a phone.'},
  {id:'r-pixel-show',where:'House',icon:'✨',title:'Light show (every LED its own colour)',
   blurb:'Rainbows, chasing lights, flames and music-style effects: each LED on the strip can be a different colour.',
   parts:[['c-ws2812b-addressable-led-strip-5v-1-m-60-leds','WS2812B LED strip'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['A separate 5V power supply, 3 A per metre at full white','A 330 ohm resistor in the data wire and a 1000 uF capacitor across the supply'],
   build:'A light show with a WS2812B addressable LED strip on an ESP32 running colour effects, with a separate 5V supply for the strip.'},
  {id:'r-printer-watch',where:'Workshop',icon:'🖨️',title:'3D printer chamber monitor',
   blurb:'For an enclosed printer such as a Voron: chamber temperature, humidity and fume level on a screen, with a fan switched on when it gets hot.',
   parts:[['p-cm-bme280','BME280 sensor'],['c-mq-135-air-quality-gas-sensor-module','MQ-135 air quality sensor'],['p-cm-ssd1306','OLED display'],['c-1-channel-5v-relay-module','1-channel relay board'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['A 5V or 12V extraction fan','The air sensor shows a trend, NOT a safe-or-unsafe fume level'],
   build:'A 3D printer chamber monitor on an ESP32 with a BME280 temperature and humidity sensor, an MQ-135 air quality sensor and an OLED screen, with a relay board switching an extraction fan when the chamber gets hot.'},
  {id:'r-plant-water',where:'Garden',icon:'🌱',title:'Automatic plant watering',
   blurb:'When the soil gets dry, a small pump waters the plant, and it tells you when the tank is low.',
   parts:[['p-cm-soilmoist','Soil moisture sensor'],['c-mini-submersible-water-pump-3-5v','Mini water pump'],['c-1-channel-5v-relay-module','1-channel relay board'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['Some silicone tubing','A water bottle or tank','Soil sensors rust: choose the capacitive kind'],
   build:'Automatic plant watering on an ESP32 with a capacitive soil moisture sensor and a relay board switching a small water pump when the soil is dry.'},
  {id:'r-solar-light',where:'Garden',icon:'☀️',title:'Solar garden light',
   blurb:'A small solar panel charges a battery all day, and the lights come on by themselves at dusk.',
   parts:[['c-small-solar-panel-about-6-x-4-in','Small solar panel'],['b-tp4056c','TP4056 charger'],['b-lipo1000','LiPo battery'],['c-ky-018-photoresistor-ldr-light-sensor-module','Light sensor'],['c-ws2812b-addressable-led-strip-5v-1-m-60-leds','WS2812B LED strip'],['c-seeed-studio-xiao-esp32-c3','XIAO ESP32-C3']],
   extra:['A waterproof box and cable glands','A 5V panel (or a charge board made for your panel voltage)'],
   build:'A solar garden light: a small solar panel and a charger board charging a LiPo battery, with a light sensor and a small ESP32 turning on an LED strip at dusk.'},
  {id:'r-weather',where:'Garden',icon:'⛅',title:'Solar weather station',
   blurb:'Temperature, humidity, pressure and daylight sent from the garden every few minutes, running on a solar panel.',
   parts:[['p-cm-bme280','BME280 sensor'],['p-cm-bh1750','BH1750 light sensor'],['c-rain-sensor-plate-fc-37-yl-83','Rain sensor plate'],['c-rain-sensor-control-board-lm393','Rain sensor control board'],['c-small-solar-panel-about-6-x-4-in','Small solar panel'],['b-tp4056c','TP4056 charger'],['b-lipo1000','LiPo battery'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['A ventilated sun shield so the sun does not heat the temperature sensor','A waterproof box'],
   build:'A solar-powered garden weather station on an ESP32 with a BME280 and a BH1750, charging a LiPo battery from a small solar panel and sleeping between readings.'},
  {id:'r-greenhouse',where:'Garden',icon:'🏡',title:'Greenhouse vent opener',
   blurb:'When the greenhouse gets too warm, a small servo opens the vent. It closes again when it cools.',
   parts:[['c-sg90-micro-servo-9g','SG90 servo'],['p-cm-dht22','DHT22 sensor'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['A lever or string to link the servo to the vent (an SG90 is small: use a bigger servo for a heavy vent)','A 5V supply of 1 A'],
   build:'A greenhouse vent opener on an ESP32 with a DHT22 temperature sensor and an SG90 servo that opens the vent when it is warm.'},
  {id:'r-visitor',where:'Garden',icon:'🐦',title:'Garden visitor alert',
   blurb:'A motion sensor by the bird feeder, gate or shed tells you when something moves. Add a camera to see what it was.',
   parts:[['c-hc-sr501-pir-motion-sensor','HC-SR501 PIR'],['c-small-solar-panel-about-6-x-4-in','Small solar panel'],['b-tp4056c','TP4056 charger'],['b-lipo1000','LiPo battery'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['A waterproof box, with a hole for the PIR lens'],
   build:'A garden visitor alert on an ESP32 with a PIR motion sensor, powered by a small solar panel and a LiPo battery, sending a message when something moves.'},
  {id:'r-water-butt',where:'Garden',icon:'🛢️',title:'Water butt level gauge',
   blurb:'An ultrasonic sensor looks down into the tank and tells you how full it is, on a screen or on your phone.',
   parts:[['c-jsn-sr04t-waterproof-ultrasonic-sensor','JSN-SR04T waterproof ultrasonic sensor'],['p-cm-ssd1306','OLED display'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['The waterproof probe cannot read closer than about 25 cm: mount it higher than the full-water mark','Keep the probe pointing straight down, clear of the tank sides'],
   build:'A water butt level gauge on an ESP32 with a waterproof JSN-SR04T ultrasonic sensor looking down into the tank and an OLED showing how full it is.'},
  {id:'r-door-alert',where:'House',icon:'🚪',title:'Door and window alert',
   blurb:'A small magnet switch on a door, window or shed tells you when it opens, and for how long it stayed open.',
   parts:[['c-mc-38-magnetic-reed-switch-door-sensor','MC-38 reed switch'],['c-active-buzzer-12-mm-5v','Active buzzer'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['Double-sided tape or screws for the magnet and the switch','Keep the magnet within about 15 mm of the switch when closed'],
   build:'A door and window alert on an ESP32 with a magnetic reed switch on the door and a buzzer, sending a message when the door opens.'},
  {id:'r-pet-feeder',where:'House',icon:'🐟',title:'Timed pet or fish feeder',
   blurb:'Feeds at set times using a clock that keeps the time when the power goes off, and a servo to turn the dispenser.',
   parts:[['c-ds3231-real-time-clock-module-zs-042','DS3231 clock'],['c-sg90-micro-servo-9g','SG90 servo'],['c-16x2-character-lcd-with-i2c-backpack','16x2 LCD'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['A hopper and a turning paddle (3D print one)','A weigh-in check: add a load cell and HX711 if you want to measure the portion'],
   build:'A timed pet or fish feeder on an ESP32 with a DS3231 real-time clock, an SG90 servo turning a dispenser and a 16x2 LCD showing the next feed time.'},
  {id:'r-scale',where:'Workshop',icon:'⚖️',title:'Filament or kitchen scale',
   blurb:'Weigh a spool of filament to see how much is left, or weigh ingredients, and show it on a screen.',
   parts:[['c-bar-load-cell-1-50-kg-80-mm','Bar load cell'],['c-hx711-load-cell-amplifier-module','HX711 amplifier'],['c-16x2-character-lcd-with-i2c-backpack','16x2 LCD'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['A base plate and a platform plate, with spacers so the free end of the bar can move','Calibrate with a known weight'],
   build:'A digital scale on an ESP32 with a bar load cell, an HX711 amplifier and a 16x2 LCD showing the weight.'},
  {id:'r-pond',where:'Garden',icon:'🐠',title:'Pond or tank thermometer',
   blurb:'A waterproof probe in the pond reports the water temperature, and warns you if it gets too hot or freezes.',
   parts:[['c-ds18b20-waterproof-temperature-probe','DS18B20 probe'],['p-cm-ssd1306','OLED display'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['A 4.7k resistor between the data wire and 3.3V','A waterproof box, with the probe cable through a cable gland'],
   build:'A pond thermometer on an ESP32 with a waterproof DS18B20 temperature probe and an OLED showing the water temperature.'},
  {id:'r-irrigation',where:'Garden',icon:'🚿',title:'Timed garden tap',
   blurb:'A valve in the hose line opens at set times and a flow meter tells you how much water went through.',
   parts:[['c-solenoid-water-valve-12v-1-2-inch','12V water valve'],['c-yf-s201-water-flow-sensor-1-2-inch','Flow sensor'],['c-1-channel-5v-relay-module','1-channel relay board'],['c-ds3231-real-time-clock-module-zs-042','DS3231 clock'],['c-lm2596-buck-converter-adjustable-step-down','LM2596 buck converter'],['p-esp32-devkit38','ESP32 DevKit']],
   extra:['A 12V supply: the buck converter makes 5V for the ESP32 from it','Hose fittings for 1/2 inch threads','The valve needs some water pressure to work'],
   build:'A timed garden tap on an ESP32 with a 12V solenoid valve switched by a relay board, a YF-S201 flow sensor, a DS3231 clock and an LM2596 buck converter making 5V from the 12V supply.'}
];

// Register reverse callbacks onto _int and window
_intAi.openUniversalAiChat = window.openUniversalAiChat = openUniversalAiChat;
_intAi.openIntent = window.openIntent = openIntentAi;
_intAi.openWelcome = window.openWelcome = openWelcomeAi;
_intAi.openStartupChoice = window.openStartupChoice = openStartupChoiceAi;
_intAi.openSetup = window.openSetup = openSetupAi;
_intAi.intentNow = intentNowAi;
_intAi.intentSubs = intentSubsAi;
_intAi.intentInputs = intentInputsAi;
_intAi.intentAINote = intentAINoteAi;
_intAi.intentWeather = typeof intentWeatherAi !== 'undefined' ? intentWeatherAi : null;
_intAi.theSurgery = window.theSurgery = theSurgery;
_intAi.briefDoctor = window.briefDoctor = briefDoctor;
_intAi.verifyPartViaAi = typeof verifyPartViaAi !== 'undefined' ? verifyPartViaAi : null;
_intAi.commonPart = typeof commonPart !== 'undefined' ? commonPart : null;
_intAi.NOAI_EX = window.NOAI_EX = typeof NOAI_EX !== 'undefined' ? NOAI_EX : [];
_intAi.askHtml = askHtmlAi;
_intAi.askConfirm = askConfirmAi;
_intAi.wcSeen = wcSeen;
_intAi.COOKBOOK_RECIPES = COOKBOOK_RECIPES;
_intAi.renderIntent = renderIntentAi;
_intAi.closeIntent = closeIntentAi;
Object.defineProperty(_intAi, 'iw', {
  get: () => (typeof iwAi !== 'undefined' ? iwAi : null),
  set: (v) => { if (typeof iwAi !== 'undefined') iwAi = v; }
});

// (bridge) names other files use
_intAi.LOOKUP_PROMPT = LOOKUP_PROMPT;
_intAi.SECRETISH = SECRETISH;
_intAi._dbToLookupData = _dbToLookupData;
_intAi.lookupToPart = lookupToPart;
_intAi.openPartsLibrary = openPartsLibrary;
_intAi.weatherYaml = weatherYaml;
